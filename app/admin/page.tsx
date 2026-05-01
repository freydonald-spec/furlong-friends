'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { AvatarIcon } from '@/lib/avatars'
import { formatLocalIso, parseLocalIso } from '@/lib/time'
import { computeBonus } from '@/lib/scoring'
import type { Event, Race, Horse, Player, Pick, Score } from '@/lib/types'

// Tick every second for live countdowns. Shared by every component that calls it.
function useNowTick(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(i)
  }, [intervalMs])
  return now
}

// Time until post_time, formatted "M:SS" under one hour, "H:MM:SS" over.
// Negative (already past) → null so callers can render "Post Time" instead.
function formatCountdown(postTime: string | null, now: number): { text: string; secondsLeft: number } | null {
  const target = parseLocalIso(postTime)
  if (!target) return null
  const ms = target.getTime() - now
  const secondsLeft = Math.floor(ms / 1000)
  if (secondsLeft < 0) return null
  const h = Math.floor(secondsLeft / 3600)
  const m = Math.floor((secondsLeft % 3600) / 60)
  const s = secondsLeft % 60
  const text = h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`
  return { text, secondsLeft }
}

const ADMIN_PASSWORD = 'roses2025'
type Tab = 'event' | 'races' | 'results' | 'players' | 'leaderboard'

export default function AdminPage() {
  const router = useRouter()
  // Auth must start `false` on the server to avoid a hydration mismatch.
  // The sessionStorage check is then promoted to the client in an effect below.
  const [authed, setAuthed] = useState(false)
  const [pwInput, setPwInput] = useState('')
  const [pwError, setPwError] = useState(false)
  const [tab, setTab] = useState<Tab>('event')
  const now = useNowTick(1000)
  const autoLockedRef = useRef<Set<string>>(new Set())

  const [allEvents, setAllEvents] = useState<Event[]>([])
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [races, setRaces] = useState<Race[]>([])
  const [horsesByRace, setHorsesByRace] = useState<Record<string, Horse[]>>({})
  const [players, setPlayers] = useState<Player[]>([])
  const [picks, setPicks] = useState<Pick[]>([])
  const [scores, setScores] = useState<Score[]>([])
  const [loading, setLoading] = useState(true)

  const event = useMemo(
    () => allEvents.find(e => e.id === selectedEventId) ?? null,
    [allEvents, selectedEventId]
  )

  // Restore admin session after hydration.
  useEffect(() => {
    if (sessionStorage.getItem('furlong_admin') === 'yes') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAuthed(true)
    }
  }, [])

  async function loadEventList() {
    const { data } = await supabase
      .from('events')
      .select('*')
      .order('date', { ascending: false })
    const list = data ?? []
    setAllEvents(list)
    if (!selectedEventId || !list.find(e => e.id === selectedEventId)) {
      const next = list.find(e => e.status === 'active') ?? list[0] ?? null
      setSelectedEventId(next?.id ?? null)
      if (!next) setLoading(false) // nothing further to load
    }
  }

  async function loadEventData(eventId: string) {
    setLoading(true)
    const [r, p, sc] = await Promise.all([
      supabase.from('races').select('*').eq('event_id', eventId).order('race_number'),
      supabase.from('players').select('*').eq('event_id', eventId),
      supabase.from('scores').select('*').eq('event_id', eventId),
    ])
    const racesList = r.data ?? []
    setRaces(racesList)
    setPlayers(p.data ?? [])
    setScores(sc.data ?? [])

    if (racesList.length > 0) {
      const { data: horses } = await supabase
        .from('horses').select('*').in('race_id', racesList.map(r => r.id)).order('number')
      const grouped: Record<string, Horse[]> = {}
      for (const h of horses ?? []) {
        if (!grouped[h.race_id]) grouped[h.race_id] = []
        grouped[h.race_id].push(h)
      }
      setHorsesByRace(grouped)
      const { data: picksRows } = await supabase.from('picks').select('*').eq('event_id', eventId)
      setPicks(picksRows ?? [])
    } else {
      setHorsesByRace({})
      setPicks([])
    }
    setLoading(false)
  }

  async function refresh() {
    await loadEventList()
    if (selectedEventId) await loadEventData(selectedEventId)
  }

  async function createNewEvent() {
    const { data, error: err } = await supabase.from('events').insert({
      name: 'New Event',
      track: '',
      location: '',
      date: new Date().toISOString().slice(0, 10),
      buy_in_amount: 0,
      multiplier_visible: true,
      score_reveal_mode: 'auto',
      status: 'draft',
    }).select().single()
    if (err) { alert("Couldn't create event: " + err.message); return }
    if (data) {
      await loadEventList()
      setSelectedEventId(data.id)
      setTab('event')
    }
  }

  useEffect(() => {
    if (!authed) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadEventList()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed])

  useEffect(() => {
    if (!authed || !selectedEventId) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadEventData(selectedEventId)
  }, [authed, selectedEventId])

  // Realtime
  useEffect(() => {
    if (!authed || !event) return
    const channel = supabase.channel(`admin-${event.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: `event_id=eq.${event.id}` },
        async () => { const { data } = await supabase.from('players').select('*').eq('event_id', event.id); if (data) setPlayers(data) })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'picks', filter: `event_id=eq.${event.id}` },
        async () => { const { data } = await supabase.from('picks').select('*').eq('event_id', event.id); if (data) setPicks(data) })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'races', filter: `event_id=eq.${event.id}` },
        async () => { const { data } = await supabase.from('races').select('*').eq('event_id', event.id).order('race_number'); if (data) setRaces(data) })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'horses' },
        async () => {
          // Reload horses for this event's races. No filter on horses table by
          // event_id so we re-fetch and regroup; volume is small.
          const raceIds = (await supabase.from('races').select('id').eq('event_id', event.id)).data?.map(r => r.id) ?? []
          if (raceIds.length === 0) return
          const { data } = await supabase.from('horses').select('*').in('race_id', raceIds).order('number', { ascending: true })
          if (data) {
            const grouped: Record<string, Horse[]> = {}
            for (const h of data) {
              if (!grouped[h.race_id]) grouped[h.race_id] = []
              grouped[h.race_id].push(h)
            }
            // Defensive sort — supabase already ordered, but multi-race
            // groupings can interleave; sort each group on its own.
            for (const k of Object.keys(grouped)) grouped[k].sort((a, b) => a.number - b.number)
            setHorsesByRace(grouped)
          }
        })
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed, event?.id])

  // Auto-lock: client-side backup for the pg_cron job (scripts/auto-lock-races-cron.sql).
  // The cron is authoritative and runs every minute regardless of who has the app open;
  // this 1s tick just makes the lock feel instant when the admin is watching.
  // `autoLockedRef` prevents us from re-firing the same update while waiting
  // for the realtime subscription to echo the new status back.
  //
  // TIMEZONE: post_time is stored as a naive ISO wall-clock string anchored to
  // America/New_York (see lib/time.ts). parseLocalIso() builds a Date using the
  // browser's local fields, and `now` is the current local instant — so this
  // comparison is correct as long as the admin is browsing from Eastern time
  // (which we assume on Derby Day). The pg_cron job in
  // scripts/auto-lock-races-cron.sql does the equivalent comparison server-side
  // for non-Eastern admins and times when no admin tab is open.
  useEffect(() => {
    if (!authed || !event) return
    const overdue = races.filter(r => {
      if (r.status !== 'upcoming' && r.status !== 'open') return false
      if (autoLockedRef.current.has(r.id)) return false
      const target = parseLocalIso(r.post_time)
      return target != null && target.getTime() <= now
    })
    if (overdue.length === 0) return
    for (const r of overdue) autoLockedRef.current.add(r.id)
    void (async () => {
      for (const r of overdue) {
        await supabase.from('races').update({ status: 'locked' }).eq('id', r.id)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed, event?.id, races, now])

  function tryLogin() {
    if (pwInput === ADMIN_PASSWORD) {
      setAuthed(true)
      setPwError(false)
      if (typeof window !== 'undefined') sessionStorage.setItem('furlong_admin', 'yes')
    } else {
      setPwError(true)
    }
  }

  if (!authed) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6 bg-[#0A0D16] text-white">
        <div className="w-full max-w-sm">
          <Link href="/" className="text-white/60 hover:text-white text-sm mb-6 inline-block">← Home</Link>
          <div className="text-center mb-6">
            <div className="text-5xl mb-3">🔐</div>
            <h1 className="font-serif text-3xl font-bold text-white">Admin Access</h1>
          </div>
          <input
            type="password"
            value={pwInput}
            onChange={e => { setPwInput(e.target.value); setPwError(false) }}
            onKeyDown={e => e.key === 'Enter' && tryLogin()}
            placeholder="Password"
            autoFocus
            className={`w-full h-14 px-5 rounded-xl bg-white/10 border-2 ${pwError ? 'border-red-500' : 'border-[var(--gold)]/30'} text-white text-lg placeholder:text-white/40 focus:outline-none focus:border-[var(--gold)] mb-3`}
          />
          {pwError && <p className="text-red-400 text-sm mb-3 text-center">Wrong password</p>}
          <button
            onClick={tryLogin}
            className="w-full h-14 rounded-full bg-[var(--rose-dark)] border-2 border-[var(--gold)]/60 text-white font-bold text-xl"
          >
            Enter
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen flex flex-col bg-[#0A0D16] text-white">
      <header className="px-4 py-3 border-b border-white/10 bg-black/40 sticky top-0 z-20">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3 flex-wrap">
          <Link href="/" className="text-white/60 hover:text-white text-sm">← Home</Link>
          <h1 className="font-serif text-xl font-bold text-white">⚙️ Admin Console</h1>
          <button
            onClick={() => { sessionStorage.removeItem('furlong_admin'); setAuthed(false) }}
            className="text-white/60 hover:text-white text-sm"
          >Lock</button>
        </div>
        {/* Event picker */}
        <div className="max-w-4xl mx-auto flex items-center gap-2 mt-2 flex-wrap">
          <span className="text-white/60 text-xs uppercase font-bold tracking-wider">Managing:</span>
          {allEvents.length === 0 ? (
            <span className="text-white/40 text-sm italic">No events yet</span>
          ) : (
            <select
              value={selectedEventId ?? ''}
              onChange={e => setSelectedEventId(e.target.value || null)}
              className="admin-input h-9 text-sm flex-1 min-w-[200px] max-w-md"
            >
              {allEvents.map(e => (
                <option key={e.id} value={e.id}>
                  {e.status === 'active' ? '⭐ ' : e.status === 'archived' ? '📋 ' : e.status === 'draft' ? '📝 ' : ''}
                  {e.name || '(unnamed event)'}
                </option>
              ))}
            </select>
          )}
          <button
            onClick={createNewEvent}
            className="px-3 h-9 rounded-full bg-[var(--rose-dark)] border border-[var(--gold)]/60 text-white text-xs font-bold whitespace-nowrap"
          >+ New Event</button>
          <a
            href="/exacta"
            target="_blank"
            rel="noreferrer"
            className="px-3 h-9 inline-flex items-center rounded-full bg-emerald-700/60 border border-emerald-400/40 text-white text-xs font-bold whitespace-nowrap"
          >🎯 Exacta Board</a>
        </div>
      </header>

      {/* Tabs */}
      <nav className="border-b border-white/10 bg-black/30">
        <div className="max-w-4xl mx-auto flex overflow-x-auto no-scrollbar">
          {(['event', 'races', 'results', 'players', 'leaderboard'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-3 text-sm font-semibold capitalize whitespace-nowrap transition-colors min-h-[48px] ${tab === t ? 'text-[var(--gold)] border-b-2 border-[var(--gold)]' : 'text-white/60 hover:text-white'}`}
            >
              {t}
            </button>
          ))}
        </div>
      </nav>

      <div className="max-w-4xl mx-auto w-full px-4 py-6 flex-1">
        {loading ? (
          <div className="text-center py-20"><div className="text-4xl mb-2 animate-pulse">⚙️</div><p className="text-white/70">Loading…</p></div>
        ) : (
          <>
            {tab === 'event' && <EventTab key={event?.id ?? 'new'} event={event} onChange={refresh} onDeleted={() => router.push('/')} />}
            {tab === 'races' && <RacesTab event={event} races={races} horsesByRace={horsesByRace} players={players} picks={picks} now={now} onChange={refresh} />}
            {tab === 'results' && <ResultsTab event={event} races={races} horsesByRace={horsesByRace} players={players} picks={picks} scores={scores} onChange={refresh} />}
            {tab === 'players' && <PlayersTab players={players} races={races} horsesByRace={horsesByRace} picks={picks} scores={scores} onChange={refresh} />}
            {tab === 'leaderboard' && <LeaderboardTab players={players} races={races} scores={scores} />}
          </>
        )}
      </div>
    </main>
  )
}

// ============================ EVENT TAB ============================
function EventTab({ event, onChange, onDeleted }: { event: Event | null; onChange: () => void; onDeleted: () => void }) {
  if (!event) {
    return (
      <section className="text-center py-16">
        <div className="text-5xl mb-3">📅</div>
        <h2 className="font-serif text-2xl font-bold text-white">No event selected</h2>
        <p className="text-white/60 mt-2">
          Pick one from the dropdown above, or use <span className="text-[var(--gold)] font-bold">+ New Event</span> to create one.
        </p>
      </section>
    )
  }
  return <EventEditor event={event} onChange={onChange} onDeleted={onDeleted} />
}

function EventEditor({ event, onChange, onDeleted }: { event: Event; onChange: () => void; onDeleted: () => void }) {
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteText, setDeleteText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [draft, setDraft] = useState<Partial<Event>>(() => event)
  const [saving, setSaving] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)

  // Enforces the invariant that at most one event has status='active'.
  // Silently archives any other active event(s) so this one can become active.
  async function demoteOtherActives() {
    await supabase
      .from('events')
      .update({ status: 'archived' })
      .eq('status', 'active')
      .neq('id', event.id)
  }

  async function save() {
    setSaving(true)
    // If the admin is setting this event to Active via the Status dropdown,
    // silently demote any other active event first.
    if (draft.status === 'active') {
      await demoteOtherActives()
    }
    const { error: err } = await supabase.from('events').update(draft).eq('id', event.id)
    setSaving(false)
    if (err) { alert("Couldn't save: " + err.message); return }
    setSavedFlash(true)
    setTimeout(() => setSavedFlash(false), 1500)
    onChange()
  }

  async function setAsActive() {
    if (!confirm(`Set "${event.name || 'this event'}" as the active event? Any other active event will be archived.`)) return
    setSaving(true)
    await demoteOtherActives()
    await supabase.from('events').update({ status: 'active' }).eq('id', event.id)
    setDraft(d => ({ ...d, status: 'active' }))
    setSaving(false)
    onChange()
  }

  async function deleteEvent() {
    setDeleting(true)
    // Manual cascade in case FK cascade isn't set up
    await supabase.from('scores').delete().eq('event_id', event.id)
    await supabase.from('picks').delete().eq('event_id', event.id)
    await supabase.from('players').delete().eq('event_id', event.id)
    const { data: rs } = await supabase.from('races').select('id').eq('event_id', event.id)
    if (rs && rs.length) {
      await supabase.from('horses').delete().in('race_id', rs.map(r => r.id))
    }
    await supabase.from('races').delete().eq('event_id', event.id)
    await supabase.from('events').delete().eq('id', event.id)
    setDeleting(false)
    setDeleteOpen(false)
    onDeleted()
  }

  const isActive = draft.status === 'active'

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="font-serif text-2xl font-bold text-white">Event Setup</h2>
        <div className="flex items-center gap-2">
          <span className={`text-[11px] font-bold uppercase px-2 py-1 rounded-full ${
            draft.status === 'active' ? 'bg-emerald-600/30 text-emerald-200' :
            draft.status === 'archived' ? 'bg-white/10 text-white/70' :
            draft.status === 'completed' ? 'bg-[var(--rose-dark)]/40 text-white' :
            'bg-amber-600/30 text-amber-200'
          }`}>
            {draft.status ?? 'draft'}
          </span>
          {!isActive && (
            <button
              onClick={setAsActive}
              disabled={saving}
              className="px-3 h-9 rounded-full bg-[var(--gold)] text-black font-bold text-xs disabled:opacity-50"
            >
              ⭐ Set as Active
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Event Name">
          <input
            value={draft.name ?? ''}
            onChange={e => setDraft({ ...draft, name: e.target.value })}
            className="admin-input"
          />
        </Field>
        <Field label="Track">
          <input
            value={draft.track ?? ''}
            onChange={e => setDraft({ ...draft, track: e.target.value })}
            className="admin-input"
          />
        </Field>
        <Field label="Location">
          <input
            value={draft.location ?? ''}
            onChange={e => setDraft({ ...draft, location: e.target.value })}
            className="admin-input"
          />
        </Field>
        <Field label="Date">
          <input
            type="date"
            value={typeof draft.date === 'string' ? draft.date.slice(0, 10) : ''}
            onChange={e => setDraft({ ...draft, date: e.target.value })}
            className="admin-input"
          />
        </Field>
        <Field label="Entry Fee ($)">
          <input
            type="number"
            min={0}
            value={draft.buy_in_amount ?? 0}
            onChange={e => setDraft({ ...draft, buy_in_amount: Number(e.target.value) })}
            className="admin-input"
          />
        </Field>
        <Field label="Max races for players">
          <input
            type="number"
            min={1}
            value={draft.max_game_races ?? 7}
            onChange={e => setDraft({ ...draft, max_game_races: Number(e.target.value) })}
            className="admin-input"
          />
        </Field>
        <Field label="Status">
          <select
            value={draft.status ?? 'draft'}
            onChange={e => setDraft({ ...draft, status: e.target.value })}
            className="admin-input"
          >
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="archived">Archived</option>
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2 items-end">
        <Toggle
          label="Multiplier tokens visible to players"
          value={!!draft.multiplier_visible}
          onChange={v => setDraft({ ...draft, multiplier_visible: v })}
        />
        <Field label="Score Reveal Mode">
          <div className="flex gap-2">
            {(['auto', 'manual'] as const).map(m => (
              <button
                key={m}
                onClick={() => setDraft({ ...draft, score_reveal_mode: m })}
                className={`flex-1 h-12 rounded-lg border-2 capitalize font-semibold ${draft.score_reveal_mode === m ? 'border-[var(--gold)] bg-[var(--gold)]/10 text-[var(--gold)]' : 'border-white/20 text-white/70'}`}
              >
                {m}
              </button>
            ))}
          </div>
        </Field>
      </div>

      <div className="flex gap-3 pt-2 flex-wrap">
        <button
          onClick={save}
          disabled={saving}
          className="px-6 h-12 rounded-full bg-[var(--rose-dark)] border-2 border-[var(--gold)]/60 text-white font-bold disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
        {savedFlash && <span className="self-center text-emerald-400 text-sm">✓ Saved</span>}
        <button
          onClick={() => { setDeleteText(''); setDeleteOpen(true) }}
          className="ml-auto px-4 h-12 rounded-full border-2 border-red-500/40 bg-red-500/10 text-red-300 text-sm font-semibold hover:border-red-500/70 hover:bg-red-500/20"
        >
          🗑 Delete Event
        </button>
      </div>

      <p className="mt-6 text-white/50 text-xs">
        Build the race card by uploading a CSV in the <span className="text-[var(--gold)] font-semibold">Races</span> tab.
        The CSV creates races, names, post times, and horses in one shot.
      </p>

      {deleteOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => !deleting && setDeleteOpen(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="bg-[var(--dark)] border-2 border-red-500/60 rounded-2xl w-full max-w-md p-5 space-y-4"
          >
            <div>
              <h3 className="font-serif text-2xl font-bold text-red-300">Delete Event</h3>
              <p className="text-white/70 text-sm mt-1">
                This will permanently delete{' '}
                <span className="text-white font-bold">&ldquo;{event.name || 'this event'}&rdquo;</span>{' '}
                and ALL of its races, horses, players, picks, and scores.
                <span className="block mt-2 text-red-300 font-semibold">This cannot be undone.</span>
              </p>
            </div>
            <div>
              <label className="text-white/80 text-xs uppercase tracking-wider font-bold block mb-1">
                Type the event name to confirm:
              </label>
              <div className="text-white/40 text-xs mb-2 font-mono">{event.name || '(unnamed event)'}</div>
              <input
                value={deleteText}
                onChange={e => setDeleteText(e.target.value)}
                placeholder="Event name"
                autoFocus
                className="admin-input w-full"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setDeleteOpen(false)}
                disabled={deleting}
                className="px-4 h-11 rounded-full border-2 border-white/20 text-white/80 text-sm font-semibold disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={deleteEvent}
                disabled={deleting || deleteText.trim() !== (event.name ?? '').trim() || !event.name?.trim()}
                className="px-5 h-11 rounded-full bg-red-600 border-2 border-red-400 text-white font-bold text-sm disabled:opacity-40"
              >
                {deleting ? 'Deleting…' : 'Delete forever'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

// ============================ RACES TAB ============================
function RacesTab({
  event, races, horsesByRace, players, picks, now, onChange,
}: {
  event: Event | null
  races: Race[]
  horsesByRace: Record<string, Horse[]>
  players: Player[]
  picks: Pick[]
  now: number
  onChange: () => void
}) {
  const [oddsModalOpen, setOddsModalOpen] = useState(false)

  if (!event) return <p className="text-white/60">Pick or create an event first.</p>

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="font-serif text-2xl font-bold text-white">Races</h2>
        <div className="flex items-center gap-4 flex-wrap">
          <button
            onClick={() => setOddsModalOpen(true)}
            className="text-sm text-[var(--gold)] hover:text-[var(--gold)]/80 underline underline-offset-4"
          >
            📊 Update Odds
          </button>
          <a
            href="/csv-builder"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-[var(--gold)] hover:text-[var(--gold)]/80 underline underline-offset-4"
          >
            🛠 Open CSV builder ↗
          </a>
          <button
            onClick={downloadHorseTemplate}
            className="text-sm text-[var(--gold)] hover:text-[var(--gold)]/80 underline underline-offset-4"
          >
            ↓ Download CSV template
          </button>
        </div>
      </div>
      <BulkHorseImport event={event} races={races} onChange={onChange} />
      <AnimatePresence>
        {oddsModalOpen && (
          <OddsUpdaterModal
            races={races}
            horsesByRace={horsesByRace}
            onClose={() => setOddsModalOpen(false)}
            onSaved={onChange}
          />
        )}
      </AnimatePresence>
      {races.length === 0 && (
        <p className="text-white/60 text-sm italic">
          No races yet. Upload a CSV above to create them automatically.
        </p>
      )}
      {races.map(race => (
        <RaceAdminCard
          key={race.id}
          race={race}
          allRaces={races}
          horses={horsesByRace[race.id] ?? []}
          players={players}
          picks={picks.filter(p => p.race_id === race.id)}
          now={now}
          onChange={onChange}
        />
      ))}
    </section>
  )
}

function downloadHorseTemplate() {
  // 9-column template. `post_time` accepts "MM/DD/YYYY HH:MM AM/PM" (preferred,
  // so day-before uploads don't auto-lock against today's date) or "HH:MM AM/PM"
  // (uses the event's date). The optional `purse` column drives auto-detection
  // of the featured race — whichever race has the highest purse is auto-flagged
  // with a 2× multiplier (overriding is_featured/featured_multiplier).
  const csv =
    'race_number,number,name,odds,post_time,race_name,is_featured,featured_multiplier,purse\n' +
    '1,1,Banned for Life,8-5,05/02/2026 12:45 PM,Allowance,false,1,80000\n' +
    '1,2,Optical,6-1,05/02/2026 12:45 PM,Allowance,false,1,80000\n' +
    '2,1,Delightful Claire,6-5,05/02/2026 1:15 PM,Fillies Allowance,false,1,100000\n' +
    '14,1,Sovereignty,3-1,05/02/2026 06:57 PM,Kentucky Derby,true,2,5000000\n' +
    '14,2,Journalism,5-2,05/02/2026 06:57 PM,Kentucky Derby,true,2,5000000\n'
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'horses-template.csv'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// Parses a single CSV line with proper quoted-field handling.
function parseCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (c === ',' && !inQuotes) {
      out.push(cur.trim())
      cur = ''
    } else {
      cur += c
    }
  }
  out.push(cur.trim())
  return out
}

type CsvHorseParse = {
  rows: Array<{
    race_number: number
    number: number
    name: string
    odds: string | null
    post_time: string | null
    race_name: string | null
    is_featured: boolean
    featured_multiplier: number
    purse: number | null
  }>
  errors: string[]
  /** True when at least one row supplied a parseable purse value. */
  purseProvided: boolean
}

function parseHorseCsv(text: string): CsvHorseParse {
  const rows: CsvHorseParse['rows'] = []
  const errors: string[] = []
  const lines = text.replace(/\r\n/g, '\n').split('\n').map(l => l.trim()).filter(l => l.length > 0)
  if (lines.length === 0) {
    return { rows, errors: ['File is empty.'], purseProvided: false }
  }

  // Header detection
  const header = parseCsvLine(lines[0]).map(c => c.toLowerCase())
  const hasHeader = header.includes('race_number') || header.includes('number') || header.includes('name')
  const startIdx = hasHeader ? 1 : 0

  let raceNumIdx = 0, numberIdx = 1, nameIdx = 2, oddsIdx = 3, postTimeIdx = 4, raceNameIdx = 5
  let isFeaturedIdx = 6, featuredMultIdx = 7, purseIdx = 8
  if (hasHeader) {
    const idxOf = (n: string) => header.indexOf(n)
    raceNumIdx = idxOf('race_number') !== -1 ? idxOf('race_number') : 0
    numberIdx = idxOf('number') !== -1 ? idxOf('number') : 1
    nameIdx = idxOf('name') !== -1 ? idxOf('name') : 2
    oddsIdx = idxOf('odds') !== -1 ? idxOf('odds') : 3
    postTimeIdx = idxOf('post_time') !== -1 ? idxOf('post_time') : 4
    raceNameIdx = idxOf('race_name') !== -1 ? idxOf('race_name') : 5
    isFeaturedIdx = idxOf('is_featured')
    featuredMultIdx = idxOf('featured_multiplier')
    purseIdx = idxOf('purse')
  }

  let purseProvided = false

  for (let i = startIdx; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i])
    const lineNo = i + 1
    const rawRace = cells[raceNumIdx]
    const rawNum = cells[numberIdx]
    const name = (cells[nameIdx] ?? '').trim()
    const odds = (cells[oddsIdx] ?? '').trim()
    const postTime = (cells[postTimeIdx] ?? '').trim()
    const raceName = (cells[raceNameIdx] ?? '').trim()
    const rawFeatured = isFeaturedIdx >= 0 ? (cells[isFeaturedIdx] ?? '').trim().toLowerCase() : ''
    const rawMult = featuredMultIdx >= 0 ? (cells[featuredMultIdx] ?? '').trim() : ''
    const rawPurse = purseIdx >= 0 ? (cells[purseIdx] ?? '').trim() : ''

    const raceNum = Number(rawRace)
    if (!rawRace || !Number.isFinite(raceNum) || !Number.isInteger(raceNum) || raceNum < 1) {
      errors.push(`Line ${lineNo}: invalid race_number "${rawRace ?? ''}"`)
      continue
    }
    const num = Number(rawNum)
    if (!rawNum || !Number.isFinite(num) || !Number.isInteger(num) || num < 1) {
      errors.push(`Line ${lineNo}: invalid number "${rawNum ?? ''}"`)
      continue
    }
    if (!name) {
      errors.push(`Line ${lineNo}: missing name`)
      continue
    }
    const isFeatured = rawFeatured === 'true' || rawFeatured === '1' || rawFeatured === 'yes'
    let featuredMultiplier = 1
    if (rawMult) {
      const m = Number(rawMult)
      if (Number.isFinite(m) && m > 0) featuredMultiplier = m
    }
    let purse: number | null = null
    if (rawPurse) {
      // Strip $ and , so admins can paste "$5,000,000" or "5000000" interchangeably.
      const cleaned = rawPurse.replace(/[$,\s]/g, '')
      const p = Number(cleaned)
      if (Number.isFinite(p) && p >= 0) {
        purse = p
        purseProvided = true
      }
    }
    rows.push({
      race_number: raceNum,
      number: num,
      name,
      odds: odds || null,
      post_time: postTime || null,
      race_name: raceName || null,
      is_featured: isFeatured,
      featured_multiplier: featuredMultiplier,
      purse,
    })
  }

  // Auto-detect featured race by purse. Highest purse wins; ties broken by
  // lower race_number. Overrides the per-row is_featured/featured_multiplier
  // values from the CSV. Only runs when at least one row supplied a purse.
  if (purseProvided && rows.length > 0) {
    // Aggregate the purse for each race_number — first non-null purse wins.
    const purseByRace = new Map<number, number>()
    for (const r of rows) {
      if (r.purse != null && !purseByRace.has(r.race_number)) {
        purseByRace.set(r.race_number, r.purse)
      }
    }
    let bestRaceNum: number | null = null
    let bestPurse = -Infinity
    for (const [rn, p] of purseByRace) {
      if (p > bestPurse || (p === bestPurse && bestRaceNum != null && rn < bestRaceNum)) {
        bestPurse = p
        bestRaceNum = rn
      }
    }
    if (bestRaceNum != null) {
      for (const r of rows) {
        if (r.race_number === bestRaceNum) {
          r.is_featured = true
          if (!(r.featured_multiplier > 1)) r.featured_multiplier = 2
        } else {
          r.is_featured = false
          r.featured_multiplier = 1
        }
      }
    }
  }

  return { rows, errors, purseProvided }
}

// Converts a CSV post_time string into a naive local ISO string
// ("YYYY-MM-DDTHH:MM:SS", no timezone marker). Accepts either:
//   "MM/DD/YYYY HH:MM AM/PM"  (full date + time — preferred)
//   "HH:MM AM/PM"             (time only — uses the event's date)
// We deliberately do NOT call .toISOString() because that converts to UTC and
// any subsequent `new Date(stored)` would re-interpret in the engine's local
// zone, producing a TZ-offset shift on round-trip.
function parsePostTime(timeStr: string, eventDate: string): string | null {
  const trimmed = timeStr.trim()

  // Date + time: MM/DD/YYYY HH:MM AM/PM (1- or 2-digit month/day, 4-digit year)
  const dt = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (dt) {
    const month = parseInt(dt[1], 10)
    const day = parseInt(dt[2], 10)
    const year = parseInt(dt[3], 10)
    let hours = parseInt(dt[4], 10)
    const minutes = parseInt(dt[5], 10)
    if (month < 1 || month > 12 || day < 1 || day > 31) return null
    if (hours < 1 || hours > 12 || minutes < 0 || minutes > 59) return null
    if (dt[6].toUpperCase() === 'PM' && hours !== 12) hours += 12
    if (dt[6].toUpperCase() === 'AM' && hours === 12) hours = 0
    const date = new Date(year, month - 1, day, hours, minutes, 0, 0)
    if (isNaN(date.getTime())) return null
    return formatLocalIso(date)
  }

  // Time only — fall back to the event date.
  if (!eventDate) return null
  const t = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (!t) return null
  let hours = parseInt(t[1], 10)
  const minutes = parseInt(t[2], 10)
  if (hours < 1 || hours > 12 || minutes < 0 || minutes > 59) return null
  if (t[3].toUpperCase() === 'PM' && hours !== 12) hours += 12
  if (t[3].toUpperCase() === 'AM' && hours === 12) hours = 0
  const dateParts = eventDate.slice(0, 10).split('-').map(Number)
  if (dateParts.length !== 3 || dateParts.some(n => !Number.isFinite(n))) return null
  const [eY, eM, eD] = dateParts
  const date = new Date(eY, eM - 1, eD, hours, minutes, 0, 0)
  if (isNaN(date.getTime())) return null
  return formatLocalIso(date)
}

/** Stakes-race heuristic: race name contains a stakes-y word, OR purse ≥ $100k.
 *  Used to pre-check the most interesting races in the import preview. */
const STAKES_NAME_RX = /\b(Stakes|S\.|Oaks|Derby|Cup|Handicap|Classic|Futurity|Championship|Invitational|Memorial|Sprint|Mile|Turf)\b/i
function isStakesRace(name: string | null, purse: number | null): boolean {
  if (purse !== null && purse >= 100000) return true
  if (name && STAKES_NAME_RX.test(name)) return true
  return false
}

type PreviewRace = {
  race_number: number
  race_name: string
  post_time: string | null
  purse: number | null
  horseCount: number
  selected: boolean
  isStakes: boolean
}

function BulkHorseImport({ event, races, onChange }: { event: Event; races: Race[]; onChange: () => void }) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ inserted: number; raceCount: number; errors: string[] } | null>(null)
  // Two-phase import: first parse + show a checklist of races (preview),
  // then on confirm only the selected race_numbers are written to Supabase.
  const [preview, setPreview] = useState<PreviewRace[] | null>(null)
  const [parsedRows, setParsedRows] = useState<ReturnType<typeof parseHorseCsv>['rows']>([])
  const [parseErrors, setParseErrors] = useState<string[]>([])

  function onPickFile(file: File) {
    setResult(null)
    setPreview(null)
    const reader = new FileReader()
    reader.onload = () => setText(String(reader.result ?? ''))
    reader.onerror = () => setResult({ inserted: 0, raceCount: 0, errors: ["Couldn't read file"] })
    reader.readAsText(file)
  }

  /** Parse the textarea, build per-race summary, and show the selection screen.
   *  No DB writes happen here — that's deferred to runImport(). */
  function buildPreview() {
    setResult(null)
    const { rows, errors } = parseHorseCsv(text)
    if (rows.length === 0) {
      setResult({ inserted: 0, raceCount: 0, errors: errors.length ? errors : ['No valid rows found.'] })
      return
    }
    const groups = new Map<number, typeof rows>()
    for (const r of rows) {
      const g = groups.get(r.race_number)
      if (g) g.push(r)
      else groups.set(r.race_number, [r])
    }
    const previewRaces: PreviewRace[] = [...groups.entries()]
      .map(([raceNumber, groupRows]) => {
        const first = groupRows[0]
        const name = first.race_name || `Race ${raceNumber}`
        const stakes = isStakesRace(first.race_name, first.purse)
        return {
          race_number: raceNumber,
          race_name: name,
          post_time: first.post_time,
          purse: first.purse,
          horseCount: groupRows.length,
          selected: stakes,
          isStakes: stakes,
        }
      })
      .sort((a, b) => a.race_number - b.race_number)
    setParsedRows(rows)
    setParseErrors(errors)
    setPreview(previewRaces)
  }

  function toggleRace(raceNumber: number) {
    setPreview(prev => prev?.map(r =>
      r.race_number === raceNumber ? { ...r, selected: !r.selected } : r
    ) ?? null)
  }
  function selectAll() {
    setPreview(prev => prev?.map(r => ({ ...r, selected: true })) ?? null)
  }
  function deselectAll() {
    setPreview(prev => prev?.map(r => ({ ...r, selected: false })) ?? null)
  }

  /** Phase 2: import EVERY parsed race row, but flag is_game_race per the
   *  admin's checkbox. Hidden races still land in the DB so the admin can
   *  flip them on later via the per-card toggle. */
  async function runImport() {
    if (!preview) return
    const selectedNumbers = new Set(preview.filter(r => r.selected).map(r => r.race_number))
    setImporting(true)
    setResult(null)
    const allErrors = [...parseErrors]
    const eventDate = typeof event.date === 'string' ? event.date.slice(0, 10) : ''

    // Group all parsed rows by race_number — selection now drives the flag,
    // not whether the race row gets written.
    const groups = new Map<number, typeof parsedRows>()
    for (const r of parsedRows) {
      const g = groups.get(r.race_number)
      if (g) g.push(r)
      else groups.set(r.race_number, [r])
    }

    const raceByNumber = new Map(races.map(r => [r.race_number, r]))
    const resolvedRaceIds: string[] = []
    const raceIdByNumber = new Map<number, string>()

    for (const [raceNumber, groupRows] of groups) {
      const first = groupRows[0]
      let postTimeIso: string | null = null
      if (first.post_time) {
        const iso = parsePostTime(first.post_time, eventDate)
        if (iso) postTimeIso = iso
        else allErrors.push(`Race ${raceNumber}: couldn't parse post_time "${first.post_time}" (expected e.g. "04/30/2026 12:45 PM" or "12:45 PM")`)
      }
      const raceName = first.race_name || `Race ${raceNumber}`
      const isFeatured = first.is_featured
      const featuredMultiplier = first.featured_multiplier

      const inGame = selectedNumbers.has(raceNumber)
      const existing = raceByNumber.get(raceNumber)
      if (existing) {
        const { error: rerr } = await supabase.from('races').update({
          name: raceName,
          post_time: postTimeIso,
          is_featured: isFeatured,
          featured_multiplier: featuredMultiplier,
          is_game_race: inGame,
        }).eq('id', existing.id)
        if (rerr) {
          allErrors.push(`Race ${raceNumber}: couldn't update race fields: ${rerr.message}`)
          continue
        }
        raceIdByNumber.set(raceNumber, existing.id)
        resolvedRaceIds.push(existing.id)
      } else {
        const { data: created, error: cerr } = await supabase.from('races').insert({
          event_id: event.id,
          race_number: raceNumber,
          name: raceName,
          distance: null,
          post_time: postTimeIso,
          is_featured: isFeatured,
          featured_multiplier: featuredMultiplier,
          status: 'upcoming',
          is_game_race: inGame,
        }).select('id').single()
        if (cerr || !created) {
          allErrors.push(`Race ${raceNumber}: couldn't create race: ${cerr?.message ?? 'unknown error'}`)
          continue
        }
        raceIdByNumber.set(raceNumber, created.id)
        resolvedRaceIds.push(created.id)
      }
    }

    if (resolvedRaceIds.length > 0) {
      const { error: derr } = await supabase
        .from('horses')
        .delete()
        .in('race_id', resolvedRaceIds)
      if (derr) {
        setResult({ inserted: 0, raceCount: 0, errors: [...allErrors, `Couldn't clear existing horses: ${derr.message}`] })
        setImporting(false)
        onChange()
        return
      }
    }

    const payload: Array<{
      race_id: string
      number: number
      name: string
      morning_line_odds: string | null
      scratched: boolean
      finish_position: number | null
    }> = []
    const racesTouched = new Set<string>()
    for (const [raceNumber, groupRows] of groups) {
      const raceId = raceIdByNumber.get(raceNumber)
      if (!raceId) continue
      for (const r of groupRows) {
        payload.push({
          race_id: raceId,
          number: r.number,
          name: r.name,
          morning_line_odds: r.odds,
          scratched: false,
          finish_position: null,
        })
        racesTouched.add(raceId)
      }
    }

    if (payload.length === 0) {
      setResult({ inserted: 0, raceCount: racesTouched.size, errors: allErrors })
      setImporting(false)
      onChange()
      return
    }

    const { error: err } = await supabase.from('horses').insert(payload)
    if (err) {
      setResult({ inserted: 0, raceCount: 0, errors: [...allErrors, `Database error: ${err.message}`] })
    } else {
      setResult({ inserted: payload.length, raceCount: racesTouched.size, errors: allErrors })
      setText('')
      setPreview(null)
      setParsedRows([])
      setParseErrors([])
    }
    setImporting(false)
    onChange()
  }

  async function clearAllRaces() {
    if (races.length === 0) return
    if (!confirm(`☢️ NUCLEAR DELETE — wipe every race in "${event.name}"?\n\nThis removes:\n• All ${races.length} race${races.length === 1 ? '' : 's'}\n• All horses\n• All player picks for those races\n• All scores for those races\n\nPlayers and event settings are kept. This cannot be undone.`)) return
    const raceIds = races.map(r => r.id)
    const { error: pErr } = await supabase.from('picks').delete().in('race_id', raceIds)
    if (pErr) { alert("Couldn't delete picks: " + pErr.message); return }
    const { error: sErr } = await supabase.from('scores').delete().in('race_id', raceIds)
    if (sErr) { alert("Couldn't delete scores: " + sErr.message); return }
    const { error: hErr } = await supabase.from('horses').delete().in('race_id', raceIds)
    if (hErr) { alert("Couldn't delete horses: " + hErr.message); return }
    const { error: rErr } = await supabase.from('races').delete().in('id', raceIds)
    if (rErr) { alert("Couldn't delete races: " + rErr.message); return }
    setResult(null)
    onChange()
  }

  return (
    <div className="rounded-xl border border-[var(--gold)]/30 bg-black/30 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="min-w-0">
          <h3 className="text-white/80 text-sm uppercase tracking-wider font-bold">Bulk Horse Import</h3>
          <p className="text-white/50 text-xs mt-0.5">
            One CSV for all races. Columns:{' '}
            <code className="text-[var(--gold)]">race_number</code>,{' '}
            <code className="text-[var(--gold)]">number</code>,{' '}
            <code className="text-[var(--gold)]">name</code>,{' '}
            <code className="text-[var(--gold)]">odds</code>,{' '}
            <code className="text-[var(--gold)]">post_time</code>,{' '}
            <code className="text-[var(--gold)]">race_name</code>,{' '}
            <code className="text-[var(--gold)]">is_featured</code>,{' '}
            <code className="text-[var(--gold)]">featured_multiplier</code>,{' '}
            <code className="text-[var(--gold)]">purse</code>{' '}
            <span className="text-white/40">(optional — highest purse auto-becomes featured)</span>
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => { setOpen(o => !o); setResult(null); setPreview(null); setParsedRows([]); setParseErrors([]) }}
            className="px-3 h-9 rounded-lg border border-[var(--gold)]/40 text-[var(--gold)] text-sm font-bold"
          >
            📥 {open ? 'Cancel' : 'Import CSV'}
          </button>
          <button
            onClick={clearAllRaces}
            title="Delete every horse from every race in this event"
            className="px-3 h-9 rounded-lg border-2 border-red-500/40 text-red-300 hover:bg-red-500/10 hover:border-red-500/70 text-sm font-bold"
          >
            ☢️ Clear All Races
          </button>
        </div>
      </div>

      {open && !preview && (
        <div className="space-y-2 pt-1">
          <label className="inline-flex items-center gap-2 text-sm text-white/80 cursor-pointer">
            <span className="px-3 h-9 inline-flex items-center rounded-lg border border-white/30 hover:border-white/60">
              Choose .csv file
            </span>
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={e => {
                const f = e.target.files?.[0]
                if (f) onPickFile(f)
                e.target.value = ''
              }}
            />
          </label>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            rows={6}
            placeholder={`race_number,number,name,odds,post_time,race_name,is_featured,featured_multiplier,purse\n1,1,Banned for Life,8-5,05/02/2026 12:45 PM,Allowance,false,1,80000\n14,1,Sovereignty,3-1,05/02/2026 06:57 PM,Kentucky Derby,true,2,5000000\n14,2,Journalism,5-2,05/02/2026 06:57 PM,Kentucky Derby,true,2,5000000`}
            className="w-full p-2 rounded-lg bg-white/10 border-2 border-white/15 text-white text-xs font-mono focus:outline-none focus:border-[var(--gold)]"
          />
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={buildPreview}
              disabled={!text.trim()}
              className="px-4 h-10 rounded-lg bg-[var(--rose-dark)] border border-[var(--gold)]/60 text-white text-sm font-bold disabled:opacity-50"
            >
              Preview Races →
            </button>
            {text && (
              <button
                type="button"
                onClick={() => { setText(''); setResult(null) }}
                className="px-3 h-10 rounded-lg border border-white/20 text-white/70 text-sm"
              >Clear</button>
            )}
          </div>
          {result && (
            <div className="text-xs space-y-1">
              {result.inserted > 0 && (
                <div className="text-emerald-400 font-semibold">
                  ✓ Imported {result.inserted} horse{result.inserted === 1 ? '' : 's'} across {result.raceCount} race{result.raceCount === 1 ? '' : 's'}
                </div>
              )}
              {result.errors.length > 0 && (
                <div className="text-amber-300">
                  <div className="font-semibold mb-0.5">Skipped {result.errors.length} row{result.errors.length === 1 ? '' : 's'}:</div>
                  <ul className="list-disc list-inside ml-1 space-y-0.5">
                    {result.errors.slice(0, 8).map((e, i) => <li key={i}>{e}</li>)}
                    {result.errors.length > 8 && <li>…and {result.errors.length - 8} more</li>}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {open && preview && (
        <div className="space-y-3 pt-1">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h4 className="text-white text-sm font-bold">
              Select races to include in the game
              <span className="ml-2 text-white/50 font-normal">({preview.filter(r => r.selected).length} of {preview.length} selected)</span>
            </h4>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={selectAll}
                className="text-[var(--gold)] hover:text-[var(--gold)]/80 text-xs font-semibold underline-offset-2 hover:underline"
              >
                Select All
              </button>
              <span className="text-white/30">·</span>
              <button
                type="button"
                onClick={deselectAll}
                className="text-white/60 hover:text-white text-xs font-semibold underline-offset-2 hover:underline"
              >
                Deselect All
              </button>
            </div>
          </div>
          <p className="text-[11px] text-white/45 italic">
            Unchecked races will still be imported but hidden from players —
            you can flip the In Game toggle on each card later.
          </p>
          <ul className="rounded-lg border border-white/15 bg-white/5 divide-y divide-white/10 max-h-80 overflow-y-auto">
            {preview.map(r => {
              const postTimeFormatted = r.post_time ? r.post_time : 'no post time'
              return (
                <li key={r.race_number} className="px-3 py-2">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={r.selected}
                      onChange={() => toggleRace(r.race_number)}
                      className="w-4 h-4 accent-[var(--gold)] shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-white font-bold text-sm">Race {r.race_number}</span>
                        <span className="text-white/85 text-sm truncate">{r.race_name}</span>
                        {r.isStakes && (
                          <span className="text-[10px] font-bold text-[var(--gold)] bg-[var(--gold)]/15 border border-[var(--gold)]/40 px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0">
                            Stakes
                          </span>
                        )}
                      </div>
                      <div className="text-white/55 text-xs flex items-center gap-2 flex-wrap mt-0.5">
                        <span>{postTimeFormatted}</span>
                        <span>· {r.horseCount} horse{r.horseCount === 1 ? '' : 's'}</span>
                        {r.purse !== null && <span>· ${r.purse.toLocaleString()}</span>}
                      </div>
                    </div>
                  </label>
                </li>
              )
            })}
          </ul>
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={runImport}
              disabled={importing}
              className="px-4 h-10 rounded-lg bg-[var(--rose-dark)] border border-[var(--gold)]/60 text-white text-sm font-bold disabled:opacity-50"
            >
              {importing
                ? 'Importing…'
                : `Import Selected Races (${preview.filter(r => r.selected).length} of ${preview.length})`}
            </button>
            <button
              type="button"
              onClick={() => { setPreview(null); setParsedRows([]); setParseErrors([]) }}
              disabled={importing}
              className="px-3 h-10 rounded-lg border border-white/20 text-white/70 text-sm"
            >
              ← Back to CSV
            </button>
          </div>
          {parseErrors.length > 0 && (
            <div className="text-xs text-amber-300">
              <div className="font-semibold mb-0.5">{parseErrors.length} parse warning{parseErrors.length === 1 ? '' : 's'}:</div>
              <ul className="list-disc list-inside ml-1 space-y-0.5">
                {parseErrors.slice(0, 5).map((e, i) => <li key={i}>{e}</li>)}
                {parseErrors.length > 5 && <li>…and {parseErrors.length - 5} more</li>}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ---------- TwinSpires odds parser ----------

type ParsedHorseOdds = {
  pp: number
  odds: string | null
  scratched: boolean
}
type ParsedOdds = {
  raceNumber: number | null
  raceName: string | null
  horses: ParsedHorseOdds[]
  warnings: string[]
}

const ODDS_RX = /\b(\d{1,3}\/\d{1,3}|\d{1,3}-\d{1,3}|EVN|EVEN)\b/gi
const SCRATCH_RX = /\b(SCR|SCRATCHED|SCRATCH)\b/i

/** A whole-line position token: just a number 1-20 with nothing else on the line. */
function isPositionLine(s: string): boolean {
  if (!/^\d{1,2}$/.test(s)) return false
  const n = parseInt(s, 10)
  return n >= 1 && n <= 20
}

/** A whole-line odds-shaped token (used by the multi-line parser). Includes
 *  bare integers ("6" → 6-1), fractions, dashed forms, EVN/EVEN, SCR, and "-". */
function isOddsLine(s: string): boolean {
  return /^(\d{1,3}\/\d{1,3}|\d{1,3}-\d{1,3}|\d{1,3}|EVN|EVEN|SCR|SCRATCHED|-)$/i.test(s.trim())
}

/** A line that looks like a horse name — has letters and isn't an odds token
 *  or a column header. */
function isHorseNameLine(s: string): boolean {
  if (!/[A-Za-z]/.test(s)) return false
  if (isOddsLine(s)) return false
  if (/^(PP|POST|HORSE|JOCKEY|TRAINER|ML|ODDS|RUNNER|ALL|EASY|BETS)\b/i.test(s)) return false
  return true
}

/** Convert a parsed odds token to the canonical morning_line_odds string we
 *  store on horses ("5/2", "8-1"). Bare integer N → "N-1" (TwinSpires shows
 *  whole-number odds without the "-1" suffix). */
function normalizeOddsToken(s: string): { odds: string | null; scratched: boolean } {
  const t = s.trim().toUpperCase()
  if (/^SCR(ATCHED)?$/.test(t)) return { odds: null, scratched: true }
  if (t === '-') return { odds: null, scratched: false }
  if (t === 'EVEN' || t === 'EVN') return { odds: 'EVN', scratched: false }
  if (/^\d+$/.test(t)) return { odds: `${t}-1`, scratched: false }
  return { odds: t, scratched: false }
}

/** Mobile TwinSpires copy-paste puts each cell on its own line. Horse rows
 *  arrive as 5-line groups: PP, O, ML, PL, name. SCR replaces the O column
 *  for scratched horses (with "-" or another SCR in PL). We claim greedy
 *  5-line windows whenever the shape matches and bail otherwise. */
function parseMultilineHorses(lines: string[], startIdx: number, endIdx: number): ParsedHorseOdds[] {
  const horses: ParsedHorseOdds[] = []
  const seen = new Set<number>()
  let i = startIdx
  while (i + 4 < endIdx) {
    const ppLine = lines[i]
    if (!isPositionLine(ppLine)) { i++; continue }
    const o = lines[i + 1]
    const ml = lines[i + 2]
    const pl = lines[i + 3]
    const name = lines[i + 4]
    if (isOddsLine(o) && isOddsLine(ml) && isOddsLine(pl) && isHorseNameLine(name)) {
      const pp = parseInt(ppLine, 10)
      if (!seen.has(pp)) {
        seen.add(pp)
        // Prefer the O (current) column. If O is "-" because the row is
        // scratched, fall back to ML so we still get a sensible record.
        let primary = o.trim()
        if (primary === '-') primary = ml.trim()
        horses.push({ pp, ...normalizeOddsToken(primary) })
      }
      i += 5
      continue
    }
    i++
  }
  return horses
}

/** Legacy single-line format: every horse on one line, e.g.
 *  "1  6  6  11  Amalfi Drive  5-2  3/1". Pull the LAST odds-shaped token
 *  (TwinSpires lists ML first, then live current odds). */
function parseSingleLineHorses(lines: string[], startIdx: number, endIdx: number, warnings: string[]): ParsedHorseOdds[] {
  const horses: ParsedHorseOdds[] = []
  const seen = new Set<number>()
  for (let idx = startIdx; idx < endIdx; idx++) {
    const line = lines[idx]
    if (/^(PP|POST|HORSE|JOCKEY|TRAINER|ML|ODDS)\b/i.test(line)) continue
    const m = line.match(/^(\d{1,2})\b/)
    if (!m) continue
    // Reject bare-number lines — those are part of the multi-line format and
    // would be misread as zero-odds horses here.
    if (/^\d{1,2}$/.test(line)) continue
    const pp = parseInt(m[1], 10)
    if (pp < 1 || pp > 20) continue
    if (seen.has(pp)) continue
    seen.add(pp)

    if (SCRATCH_RX.test(line)) {
      horses.push({ pp, odds: null, scratched: true })
      continue
    }
    const matches = [...line.matchAll(ODDS_RX)]
    if (matches.length === 0) {
      warnings.push(`PP ${pp}: no odds found on line "${line.slice(0, 60)}"`)
      continue
    }
    let odds = matches[matches.length - 1][1].toUpperCase()
    if (odds === 'EVEN' || odds === 'EVN') odds = 'EVN'
    horses.push({ pp, odds, scratched: false })
  }
  return horses
}

/** Best-effort parse of a TwinSpires "race page" text dump. Handles two paste
 *  shapes and picks whichever yields more horses:
 *   - Multi-line (mobile TwinSpires): each cell on its own line — PP, O, ML,
 *     PL, name — so we group every 5 consecutive lines.
 *   - Single-line (desktop / older paste): each horse fits on one line and the
 *     LAST odds-shaped token is the live current odds. */
function parseTwinSpiresOdds(text: string): ParsedOdds {
  const warnings: string[] = []
  const lines = text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0)

  let raceNumber: number | null = null
  let raceName: string | null = null
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/\bRACE\s+(\d+)/i)
    if (m) {
      raceNumber = parseInt(m[1], 10)
      const next = lines[i + 1]
      if (next && !/^\d/.test(next) && !/Post\s*Time/i.test(next)) {
        raceName = next
      }
      break
    }
  }

  // Bound the parse to the horse section if delimiters are present —
  // start after a `# ALL O ML PL RUNNER`-style header, stop at "EASY BETS".
  let startIdx = 0
  let endIdx = lines.length
  for (let i = 0; i < lines.length; i++) {
    const u = lines[i].toUpperCase()
    if (/^#?\s*ALL\b.*\bO\b.*\bML\b/.test(u) || u === 'RUNNER' || /\bRUNNER\b/.test(u)) {
      startIdx = i + 1
      break
    }
  }
  for (let i = startIdx; i < lines.length; i++) {
    if (/EASY\s+BETS/i.test(lines[i])) {
      endIdx = i
      break
    }
  }

  // Try multi-line first; if it yields no horses, fall back to single-line on
  // the same range. Whichever returns more is what we trust.
  const multi = parseMultilineHorses(lines, startIdx, endIdx)
  let horses: ParsedHorseOdds[]
  if (multi.length > 0) {
    horses = multi
  } else {
    horses = parseSingleLineHorses(lines, startIdx, endIdx, warnings)
  }

  if (horses.length === 0) {
    warnings.push('No horses parsed — check that the paste includes the post position column.')
  }

  return { raceNumber, raceName, horses, warnings }
}

// ---------- Odds Updater modal ----------

function OddsUpdaterModal({
  races, horsesByRace, onClose, onSaved,
}: {
  races: Race[]
  horsesByRace: Record<string, Horse[]>
  onClose: () => void
  onSaved: () => void
}) {
  const [text, setText] = useState('')
  const [parsed, setParsed] = useState<ParsedOdds | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<string | null>(null)

  // Resolve the parsed race number to a race row in the current event.
  const matchedRace = parsed?.raceNumber != null
    ? races.find(r => r.race_number === parsed.raceNumber)
    : null
  const matchedHorses = matchedRace ? (horsesByRace[matchedRace.id] ?? []) : []

  type Diff =
    | { kind: 'change'; horse: Horse; from: string | null; to: string }
    | { kind: 'scratch'; horse: Horse }
    | { kind: 'unscratch'; horse: Horse; to: string | null }
    | { kind: 'unchanged'; horse: Horse }
    | { kind: 'unmatched'; pp: number; odds: string | null; scratched: boolean }

  const diffs: Diff[] = (() => {
    if (!parsed || !matchedRace) return []
    const out: Diff[] = []
    const dbByPP = new Map(matchedHorses.map(h => [h.number, h]))
    const seenPP = new Set<number>()
    for (const p of parsed.horses) {
      seenPP.add(p.pp)
      const h = dbByPP.get(p.pp)
      if (!h) {
        out.push({ kind: 'unmatched', pp: p.pp, odds: p.odds, scratched: p.scratched })
        continue
      }
      if (p.scratched && !h.scratched) {
        out.push({ kind: 'scratch', horse: h })
      } else if (!p.scratched && h.scratched) {
        out.push({ kind: 'unscratch', horse: h, to: p.odds })
      } else if (!p.scratched && (h.morning_line_odds ?? '') !== (p.odds ?? '')) {
        out.push({ kind: 'change', horse: h, from: h.morning_line_odds, to: p.odds! })
      } else {
        out.push({ kind: 'unchanged', horse: h })
      }
    }
    // Horses in DB that weren't in the paste — leave alone, but flag as unchanged.
    for (const h of matchedHorses) {
      if (!seenPP.has(h.number)) out.push({ kind: 'unchanged', horse: h })
    }
    out.sort((a, b) => {
      const an = 'horse' in a ? a.horse.number : a.pp
      const bn = 'horse' in b ? b.horse.number : b.pp
      return an - bn
    })
    return out
  })()

  function handleParse() {
    setError(null)
    setResult(null)
    const p = parseTwinSpiresOdds(text)
    if (p.raceNumber == null) {
      setError('Could not find a "RACE N" header — make sure the paste includes the race header.')
      return
    }
    setParsed(p)
  }

  function handleBack() {
    setParsed(null)
    setError(null)
  }

  async function handleConfirm() {
    if (!parsed || !matchedRace) return
    setSaving(true)
    setError(null)
    let updated = 0
    let scratched = 0
    let errors = 0
    try {
      for (const d of diffs) {
        if (d.kind === 'change') {
          const { error: e } = await supabase.from('horses')
            .update({ morning_line_odds: d.to }).eq('id', d.horse.id)
          if (e) errors++; else updated++
        } else if (d.kind === 'scratch') {
          const { error: e } = await supabase.from('horses')
            .update({ scratched: true }).eq('id', d.horse.id)
          if (e) errors++; else scratched++
        } else if (d.kind === 'unscratch') {
          const payload: { scratched: boolean; morning_line_odds?: string | null } = { scratched: false }
          if (d.to !== null) payload.morning_line_odds = d.to
          const { error: e } = await supabase.from('horses')
            .update(payload).eq('id', d.horse.id)
          if (e) errors++; else updated++
        }
      }
      if (errors > 0) setError(`${errors} update${errors === 1 ? '' : 's'} failed — check the console.`)
      const parts: string[] = []
      if (updated > 0) parts.push(`${updated} odds update${updated === 1 ? '' : 's'}`)
      if (scratched > 0) parts.push(`${scratched} scratch${scratched === 1 ? '' : 'es'}`)
      setResult(parts.length ? `✓ Applied ${parts.join(' and ')} to Race ${parsed.raceNumber}.` : '✓ No changes needed.')
      onSaved()
    } catch (e) {
      console.error('[oddsUpdater]', e)
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/80 flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 26, stiffness: 200 }}
        onClick={e => e.stopPropagation()}
        className="bg-[#0A0D16] border-t-2 sm:border-2 border-[var(--gold)]/40 sm:rounded-2xl rounded-t-3xl w-full sm:max-w-2xl sm:max-h-[90vh] max-h-[92vh] overflow-hidden flex flex-col text-white"
      >
        <div className="px-5 pt-4 pb-3 border-b border-white/10 flex items-center justify-between">
          <h3 className="font-serif text-xl font-bold">📊 Update Odds from TwinSpires</h3>
          <button onClick={onClose} className="text-white/60 hover:text-white text-xl leading-none">✕</button>
        </div>

        {/* Paste / parse phase */}
        {!parsed && (
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            <p className="text-xs text-white/55">
              Paste the entire race page text from TwinSpires. We auto-detect the race number from the
              <code className="text-[var(--gold)] mx-1">RACE N</code> header and match horses by post position.
            </p>
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              rows={14}
              placeholder="RACE 9 - Alysheba S. (G2)\nPost Time: 4:55 PM ET\nPP  Horse                    ML    O\n1   Locked                   5-2   3/1\n2   Faiza                    7-2   9/2\n3   Country Grammer          SCR\n…"
              className="w-full p-3 rounded-lg bg-white/10 border-2 border-white/15 text-white text-xs font-mono focus:outline-none focus:border-[var(--gold)]"
            />
            {error && (
              <div className="text-red-300 text-sm bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
                {error}
              </div>
            )}
            <div className="flex gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleParse}
                disabled={!text.trim()}
                className="px-4 h-10 rounded-lg bg-[var(--rose-dark)] border border-[var(--gold)]/60 text-white text-sm font-bold disabled:opacity-50"
              >
                Parse →
              </button>
              {text && (
                <button
                  type="button"
                  onClick={() => { setText(''); setError(null) }}
                  className="px-3 h-10 rounded-lg border border-white/20 text-white/70 text-sm"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        )}

        {/* Preview / confirm phase */}
        {parsed && (
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {!matchedRace ? (
              <div className="text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-3 text-sm">
                Race {parsed.raceNumber} not found in this event.
                {parsed.raceName && <span className="text-white/55"> ({parsed.raceName})</span>}
              </div>
            ) : (
              <div className="text-[var(--gold)] text-sm font-semibold">
                Updating Race {matchedRace.race_number}
                {matchedRace.name && <span className="text-white/85"> — {matchedRace.name}</span>}
                {parsed.raceName && parsed.raceName !== matchedRace.name && (
                  <span className="text-white/45 italic"> · (paste says “{parsed.raceName}”)</span>
                )}
              </div>
            )}

            {matchedRace && (
              <ul className="rounded-lg border border-white/15 bg-white/5 divide-y divide-white/10 overflow-hidden">
                {diffs.map((d, i) => {
                  if (d.kind === 'change') {
                    return (
                      <li key={i} className="px-3 py-2 flex items-center gap-2 text-sm">
                        <span className="w-7 h-7 inline-flex items-center justify-center rounded-full bg-[var(--gold)]/20 text-[var(--gold)] font-bold text-xs shrink-0">{d.horse.number}</span>
                        <span className="flex-1 truncate text-white/90">{d.horse.name}</span>
                        <span className="font-mono tabular-nums text-white/45">{d.from || '—'}</span>
                        <span className="text-[var(--gold)]">→</span>
                        <span className="font-mono tabular-nums text-[var(--gold)] font-bold">{d.to}</span>
                      </li>
                    )
                  }
                  if (d.kind === 'scratch') {
                    return (
                      <li key={i} className="px-3 py-2 flex items-center gap-2 text-sm bg-red-500/5">
                        <span className="w-7 h-7 inline-flex items-center justify-center rounded-full bg-red-500/20 text-red-300 font-bold text-xs shrink-0">{d.horse.number}</span>
                        <span className="flex-1 truncate text-white/90">{d.horse.name}</span>
                        <span className="text-red-300 font-bold text-xs uppercase tracking-wider">⚠️ Scratched</span>
                      </li>
                    )
                  }
                  if (d.kind === 'unscratch') {
                    return (
                      <li key={i} className="px-3 py-2 flex items-center gap-2 text-sm bg-emerald-500/5">
                        <span className="w-7 h-7 inline-flex items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300 font-bold text-xs shrink-0">{d.horse.number}</span>
                        <span className="flex-1 truncate text-white/90">{d.horse.name}</span>
                        <span className="text-emerald-300 font-bold text-xs uppercase tracking-wider">↺ Un-scratched</span>
                        {d.to && <span className="font-mono tabular-nums text-[var(--gold)] font-bold">{d.to}</span>}
                      </li>
                    )
                  }
                  if (d.kind === 'unmatched') {
                    return (
                      <li key={i} className="px-3 py-2 flex items-center gap-2 text-sm bg-amber-500/5">
                        <span className="w-7 h-7 inline-flex items-center justify-center rounded-full bg-amber-500/20 text-amber-200 font-bold text-xs shrink-0">{d.pp}</span>
                        <span className="flex-1 truncate text-amber-200 italic">No matching horse in DB</span>
                        <span className="font-mono tabular-nums text-amber-200/80">{d.scratched ? 'SCR' : (d.odds ?? '—')}</span>
                      </li>
                    )
                  }
                  // unchanged
                  return (
                    <li key={i} className="px-3 py-2 flex items-center gap-2 text-sm opacity-50">
                      <span className="w-7 h-7 inline-flex items-center justify-center rounded-full bg-white/5 text-white/55 font-bold text-xs shrink-0">{d.horse.number}</span>
                      <span className="flex-1 truncate text-white/55">{d.horse.name}</span>
                      <span className="font-mono tabular-nums text-white/40">{d.horse.scratched ? 'SCR' : (d.horse.morning_line_odds ?? '—')}</span>
                      <span className="text-white/30 text-xs">unchanged</span>
                    </li>
                  )
                })}
              </ul>
            )}

            {parsed.warnings.length > 0 && (
              <div className="text-xs text-amber-300">
                <div className="font-semibold mb-0.5">{parsed.warnings.length} warning{parsed.warnings.length === 1 ? '' : 's'}:</div>
                <ul className="list-disc list-inside ml-1 space-y-0.5">
                  {parsed.warnings.slice(0, 5).map((w, i) => <li key={i}>{w}</li>)}
                  {parsed.warnings.length > 5 && <li>…and {parsed.warnings.length - 5} more</li>}
                </ul>
              </div>
            )}

            {error && (
              <div className="text-red-300 text-sm bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
                {error}
              </div>
            )}
            {result && (
              <div className="text-emerald-300 text-sm bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-2">
                {result}
              </div>
            )}
          </div>
        )}

        {parsed && (
          <div className="px-4 py-3 border-t border-white/10 bg-black/40 flex items-center justify-between gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleBack}
              disabled={saving}
              className="px-3 h-10 rounded-lg border border-white/20 text-white/70 text-sm"
            >
              ← Back
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="px-3 h-10 rounded-lg border border-white/20 text-white/70 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={saving || !matchedRace || diffs.every(d => d.kind === 'unchanged' || d.kind === 'unmatched')}
                className="px-4 h-10 rounded-lg bg-[var(--rose-dark)] border border-[var(--gold)]/60 text-white text-sm font-bold disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Confirm Update'}
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}

function RaceAdminCard({ race, allRaces, horses: horsesProp, players, picks, now, onChange }: {
  race: Race
  allRaces: Race[]
  horses: Horse[]
  players: Player[]
  picks: Pick[]
  now: number
  onChange: () => void
}) {
  // Always render and operate on horses sorted by post position. Memoised so
  // the sort doesn't run on every render unless the underlying array changes.
  const horses = useMemo(
    () => [...horsesProp].sort((a, b) => a.number - b.number),
    [horsesProp],
  )
  const [expanded, setExpanded] = useState(false)
  const [horseName, setHorseName] = useState('')
  const [horseNumber, setHorseNumber] = useState('')
  const [horseOdds, setHorseOdds] = useState('')
  const [busy, setBusy] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function addHorse() {
    if (!horseName.trim() || !horseNumber.trim()) return
    setBusy(true)
    await supabase.from('horses').insert({
      race_id: race.id,
      name: horseName.trim(),
      number: Number(horseNumber),
      morning_line_odds: horseOdds.trim() || null,
      scratched: false,
      finish_position: null,
    })
    setHorseName(''); setHorseNumber(''); setHorseOdds('')
    setBusy(false)
    onChange()
  }

  async function setStatus(status: Race['status']) {
    await supabase.from('races').update({ status }).eq('id', race.id)
    onChange()
  }

  async function lockNow() {
    await supabase.from('races').update({ status: 'locked' }).eq('id', race.id)
    onChange()
  }

  async function removeHorse(id: string) {
    if (!confirm('Remove this horse?')) return
    await supabase.from('horses').delete().eq('id', id)
    onChange()
  }

  async function deleteRace() {
    const label = `Race ${race.race_number}${race.name ? ` - ${race.name}` : ''}`
    if (!confirm(`Delete ${label}? This cannot be undone.\n\nRemoves the race, its ${horses.length} horse${horses.length === 1 ? '' : 's'}, all player picks for it, and any scores.`)) return
    setDeleting(true)
    setDeleteError(null)
    try {
      // Cascade delete in dependency order: picks → scores → horses → race.
      // Each step's error is logged + surfaced inline so a silent FK / RLS
      // failure can't leave the admin guessing.
      const pErr = (await supabase.from('picks').delete().eq('race_id', race.id)).error
      if (pErr) throw new Error(`picks delete failed: ${pErr.message}`)
      const sErr = (await supabase.from('scores').delete().eq('race_id', race.id)).error
      if (sErr) throw new Error(`scores delete failed: ${sErr.message}`)
      const hErr = (await supabase.from('horses').delete().eq('race_id', race.id)).error
      if (hErr) throw new Error(`horses delete failed: ${hErr.message}`)
      const rErr = (await supabase.from('races').delete().eq('id', race.id)).error
      if (rErr) throw new Error(`race delete failed: ${rErr.message}`)
      // The races realtime subscription removes the card from the list — no
      // explicit refresh needed, but call onChange anyway for any listeners
      // that aren't subscription-driven.
      onChange()
    } catch (e) {
      console.error('[deleteRace]', e)
      setDeleteError(e instanceof Error ? e.message : String(e))
    } finally {
      setDeleting(false)
    }
  }

  async function toggleGameRace() {
    // is_game_race controls whether players see the race at all. Default true
    // — admins flip it off for races they don't want in the player game.
    const next = !(race.is_game_race ?? true)
    await supabase.from('races').update({ is_game_race: next }).eq('id', race.id)
    onChange()
  }

  // Toggle this race's featured flag. Only one race per event can be featured,
  // so flipping ON also flips OFF every other race in the same event.
  async function toggleFeatured() {
    if (race.is_featured) {
      await supabase.from('races').update({ is_featured: false, featured_multiplier: 1 }).eq('id', race.id)
    } else {
      const others = allRaces.filter(r => r.id !== race.id && r.is_featured).map(r => r.id)
      if (others.length > 0) {
        await supabase.from('races').update({ is_featured: false, featured_multiplier: 1 }).in('id', others)
      }
      const nextMult = race.featured_multiplier > 1 ? race.featured_multiplier : 2
      await supabase.from('races').update({ is_featured: true, featured_multiplier: nextMult }).eq('id', race.id)
    }
    onChange()
  }

  async function setMultiplier(mult: number) {
    if (!Number.isFinite(mult) || mult < 1) return
    await supabase.from('races').update({ featured_multiplier: mult }).eq('id', race.id)
    onChange()
  }

  async function toggleScratch(h: Horse) {
    // Optimistic: skip the parent refresh() because the admin's horses-table
    // realtime subscription will push the update back. Avoids the perceived
    // "navigation" jolt the full event reload was causing.
    await supabase.from('horses').update({ scratched: !h.scratched }).eq('id', h.id)
  }

  const playersWithPick = picks.filter(p => p.win_horse_id || p.place_horse_id || p.show_horse_id).length
  const statusColor = {
    upcoming: 'bg-white/15 text-white',
    open: 'bg-emerald-700/50 text-emerald-200',
    locked: 'bg-amber-700/50 text-amber-200',
    finished: 'bg-[var(--rose-dark)]/50 text-white',
  }[race.status]

  const locked = race.status === 'locked' || race.status === 'finished'

  return (
    <div className={`rounded-xl border-2 ${race.is_featured ? 'border-[var(--gold)]/50' : 'border-white/15'} bg-white/5 overflow-hidden`}>
      <div
        onClick={() => setExpanded(e => !e)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setExpanded(x => !x) }}
        className="w-full p-4 flex items-center justify-between gap-3 text-left cursor-pointer"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-white/60 text-xs font-mono">RACE {race.race_number}</span>
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); void toggleGameRace() }}
              title={(race.is_game_race ?? true) ? 'In game — players see this race. Click to hide.' : 'Hidden from players. Click to include in game.'}
              className={`text-[10px] font-bold inline-flex items-center gap-1 px-1.5 py-0.5 rounded border ${
                (race.is_game_race ?? true)
                  ? 'text-emerald-300 bg-emerald-500/15 border-emerald-500/50'
                  : 'text-white/40 bg-white/5 border-white/15 hover:text-white/70 hover:border-white/30'
              }`}
            >
              {(race.is_game_race ?? true) ? 'In Game ✓' : 'Hidden'}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); void toggleFeatured() }}
              title={race.is_featured ? `Featured (${race.featured_multiplier}× multiplier) — click to un-feature` : 'Mark as featured race (only one per event)'}
              className={`text-[10px] font-bold inline-flex items-center gap-1 px-1.5 py-0.5 rounded border ${race.is_featured ? 'text-[var(--gold)] bg-[var(--gold)]/15 border-[var(--gold)]/50' : 'text-white/50 border-white/20 hover:text-[var(--gold)] hover:border-[var(--gold)]/40'}`}
            >
              {race.is_featured ? '⭐' : '☆'}
              {race.is_featured && (
                <span className="ml-0.5">{race.featured_multiplier}X POINTS</span>
              )}
            </button>
            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${statusColor}`}>{race.status}</span>
            <RaceCountdownBadge race={race} now={now} />
          </div>
          <h3 className="text-white font-semibold mt-0.5 truncate">
            {race.name}
            {(() => {
              const d = parseLocalIso(race.post_time)
              if (!d) return null
              return (
                <span className="text-white/50 text-xs font-normal ml-2">
                  • {d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                </span>
              )
            })()}
          </h3>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
            {(() => {
              const d = parseLocalIso(race.post_time)
              const dateStr = d
                ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
                : null
              if (!dateStr) return null
              return (
                <a
                  href={`https://entries.horseracingnation.com/entries-results/churchill-downs/${dateStr}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-[var(--gold)]/70 hover:text-[var(--gold)] text-xs font-normal underline-offset-2 hover:underline"
                >
                  📊 Results ↗
                </a>
              )
            })()}
          </div>
          <div className="text-white/50 text-xs mt-0.5">
            🐴 {horses.length} horses • 📋 {playersWithPick}/{players.length} picked
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!locked && (
            <button
              onClick={(e) => { e.stopPropagation(); void lockNow() }}
              className="px-3 h-9 rounded-full bg-amber-500 text-black text-xs font-bold border-2 border-amber-300 hover:bg-amber-400 shadow"
            >
              🔒 Lock Now
            </button>
          )}
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); void deleteRace() }}
            disabled={deleting}
            title="Delete this race entirely (race, horses, picks, scores)"
            className="px-3 h-9 rounded-full border-2 border-red-500/40 text-red-300 hover:bg-red-500/10 hover:border-red-500/70 text-xs font-bold disabled:opacity-50 disabled:cursor-wait"
          >
            {deleting ? 'Deleting…' : '🗑 Delete Race'}
          </button>
          <span className="text-white/50 text-xl">{expanded ? '−' : '+'}</span>
        </div>
      </div>

      {deleteError && (
        <div className="px-4 pb-3 text-xs text-red-300 bg-red-500/10 border-t border-red-500/30">
          <div className="pt-2 flex items-center justify-between gap-2">
            <span><span className="font-bold">Delete failed:</span> {deleteError}</span>
            <button onClick={() => setDeleteError(null)} className="text-red-200/70 hover:text-red-100 px-2">✕</button>
          </div>
        </div>
      )}

      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-white/10 pt-4">
          {/* Status controls */}
          <div className="flex gap-2 flex-wrap">
            {(['upcoming', 'open', 'locked'] as const).map(s => (
              <button key={s} onClick={() => setStatus(s)} disabled={race.status === s}
                className={`px-3 h-10 rounded-lg border-2 capitalize text-sm font-semibold disabled:opacity-100 ${race.status === s ? 'border-[var(--gold)] bg-[var(--gold)]/10 text-[var(--gold)]' : 'border-white/20 text-white/70 hover:border-white/40'}`}>
                {s}
              </button>
            ))}
            <Field label="Post Time" inline>
              <input
                type="datetime-local"
                value={(() => {
                  const d = parseLocalIso(race.post_time)
                  // datetime-local takes "YYYY-MM-DDTHH:MM" — just trim seconds.
                  return d ? formatLocalIso(d).slice(0, 16) : ''
                })()}
                onChange={async e => {
                  // e.target.value is already a naive local string ("YYYY-MM-DDTHH:MM");
                  // store as-is with seconds appended, no UTC conversion.
                  const next = e.target.value ? `${e.target.value}:00` : null
                  await supabase.from('races').update({ post_time: next }).eq('id', race.id)
                  onChange()
                }}
                className="admin-input h-10 text-sm"
              />
            </Field>
            {race.is_featured && (
              <Field label="Featured ×" inline>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={race.featured_multiplier}
                  onChange={e => {
                    const v = Number(e.target.value)
                    if (Number.isFinite(v) && v >= 1) void setMultiplier(v)
                  }}
                  className="admin-input h-10 text-sm w-20"
                />
              </Field>
            )}
          </div>

          {/* Horses */}
          <div>
            <h4 className="text-white/80 text-sm font-bold uppercase mb-2">Horses</h4>
            {horses.length === 0 ? (
              <p className="text-white/40 text-sm">No horses added yet</p>
            ) : (
              <div className="space-y-1.5">
                {horses.map(h => (
                  <div key={h.id} className={`flex items-center gap-2 p-2 rounded-lg border ${h.scratched ? 'border-red-500/30 bg-red-500/5 opacity-70' : 'border-white/10 bg-white/5'}`}>
                    <div className="w-9 h-9 rounded-full bg-[var(--rose-dark)] border border-[var(--gold)]/50 flex items-center justify-center font-bold text-white text-sm shrink-0">
                      {h.number}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-white font-semibold text-sm truncate ${h.scratched ? 'line-through' : ''}`}>{h.name}</span>
                        {h.scratched && (
                          <span className="shrink-0 bg-red-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded leading-none">SCR</span>
                        )}
                      </div>
                      {h.morning_line_odds && <div className="text-white/50 text-xs">{h.morning_line_odds}</div>}
                    </div>
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); void toggleScratch(h) }}
                      className="text-xs px-2 h-8 rounded border border-white/20 text-white/70 hover:border-white/40"
                    >
                      {h.scratched ? 'Unscratch' : 'Scratch'}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); void removeHorse(h.id) }}
                      className="text-xs px-2 h-8 rounded border border-red-500/30 text-red-300 hover:border-red-500/60"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-3 flex gap-2 flex-wrap">
              <input value={horseNumber} onChange={e => setHorseNumber(e.target.value)} placeholder="#" type="number" className="admin-input w-16 text-sm h-10" />
              <input value={horseName} onChange={e => setHorseName(e.target.value)} placeholder="Horse name" className="admin-input flex-1 min-w-[140px] text-sm h-10" />
              <input value={horseOdds} onChange={e => setHorseOdds(e.target.value)} placeholder="Odds (e.g. 5-1)" className="admin-input w-28 text-sm h-10" />
              <button onClick={addHorse} disabled={busy || !horseName || !horseNumber} className="px-4 h-10 rounded-lg bg-[var(--rose-dark)] border border-[var(--gold)]/60 text-white text-sm font-bold disabled:opacity-50">
                Add
              </button>
            </div>
          </div>

          {/* Pick status */}
          <div>
            <h4 className="text-white/80 text-sm font-bold uppercase mb-2">Player Picks</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {players.map(p => {
                const has = picks.find(pi => pi.player_id === p.id && (pi.win_horse_id || pi.place_horse_id || pi.show_horse_id))
                return (
                  <div key={p.id} className={`flex items-center gap-1.5 p-1.5 rounded border ${has ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-amber-500/30 bg-amber-500/5'}`}>
                    <AvatarIcon id={p.avatar} className="w-6 h-6 rounded shrink-0" />
                    <span className="text-white text-xs truncate">{p.name}</span>
                    <span className="ml-auto text-xs">{has ? '✓' : '⚠️'}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================ RESULTS TAB ============================
function ResultsTab({
  event, races, horsesByRace, players, picks, scores, onChange,
}: {
  event: Event | null
  races: Race[]
  horsesByRace: Record<string, Horse[]>
  players: Player[]
  picks: Pick[]
  scores: Score[]
  onChange: () => void
}) {
  // Hooks must run before the early returns below.
  const racesWithResults = useMemo(
    () => races.filter(r => r.status === 'locked' || r.status === 'finished' || r.status === 'open'),
    [races]
  )

  const [expandedRaces, setExpandedRaces] = useState<Set<string>>(new Set())
  const expandInitRef = useRef(false)

  // Default expansion: only races without scores yet (unscored = needs admin
  // attention) start expanded. Ref guard so realtime updates don't re-apply
  // defaults after the admin has manually toggled cards.
  useEffect(() => {
    if (expandInitRef.current) return
    if (racesWithResults.length === 0) return
    expandInitRef.current = true
    const defaults = new Set<string>()
    for (const r of racesWithResults) {
      const raceScores = scores.filter(s => s.race_id === r.id)
      if (raceScores.length === 0) defaults.add(r.id)
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setExpandedRaces(defaults)
  }, [racesWithResults, scores])

  if (!event) return <p className="text-white/60">Set up the event first.</p>
  if (racesWithResults.length === 0) return <p className="text-white/60">No races are locked yet.</p>

  const allExpanded = racesWithResults.every(r => expandedRaces.has(r.id))

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-serif text-2xl font-bold text-white">Results</h2>
        {racesWithResults.length > 1 && (
          <button
            onClick={() => setExpandedRaces(allExpanded ? new Set() : new Set(racesWithResults.map(r => r.id)))}
            className="text-white/65 hover:text-white text-xs font-semibold underline-offset-2 hover:underline"
          >
            {allExpanded ? 'Collapse All' : 'Expand All'}
          </button>
        )}
      </div>
      <p className="text-white/60 text-sm">
        Mode: <span className="font-bold text-[var(--gold)]">{event.score_reveal_mode}</span> — change in Event tab.
      </p>
      {racesWithResults.map(race => {
        const horses = horsesByRace[race.id] ?? []
        const finishKey = horses.map(h => `${h.id}:${h.finish_position ?? '_'}`).join('|')
        return (
          <ResultsCard
            key={`${race.id}:${finishKey}`}
            race={race}
            event={event}
            horses={horses}
            players={players}
            racesAll={races}
            picks={picks.filter(p => p.race_id === race.id)}
            scores={scores.filter(s => s.race_id === race.id)}
            expanded={expandedRaces.has(race.id)}
            onToggle={() => setExpandedRaces(prev => {
              const next = new Set(prev)
              if (next.has(race.id)) next.delete(race.id)
              else next.add(race.id)
              return next
            })}
            onCalculated={() => setExpandedRaces(prev => {
              const next = new Set(prev)
              next.delete(race.id)
              return next
            })}
            onChange={onChange}
          />
        )
      })}
    </section>
  )
}

function ResultsCard({
  race, event, horses, players, racesAll, picks, scores,
  expanded, onToggle, onCalculated, onChange,
}: {
  race: Race
  event: Event
  horses: Horse[]
  players: Player[]
  racesAll: Race[]
  picks: Pick[]
  scores: Score[]
  expanded: boolean
  onToggle: () => void
  onCalculated: () => void
  onChange: () => void
}) {
  // Sort by post position so dropdown / horse grids always read 1, 2, 3, …
  horses = useMemo(
    () => [...horses].sort((a, b) => a.number - b.number),
    [horses],
  )
  const [winId, setWinId] = useState<string>(() => horses.find(h => h.finish_position === 1)?.id ?? '')
  const [placeId, setPlaceId] = useState<string>(() => horses.find(h => h.finish_position === 2)?.id ?? '')
  const [showId, setShowId] = useState<string>(() => horses.find(h => h.finish_position === 3)?.id ?? '')
  const [busy, setBusy] = useState(false)
  const [revealing, setRevealing] = useState(false)

  const calculated = scores.length > 0
  const totalPicked = picks.filter(p => p.win_horse_id || p.place_horse_id || p.show_horse_id).length

  async function calculate() {
    if (!winId || !placeId || !showId) {
      alert('Please choose Win, Place, AND Show horses.')
      return
    }
    if (winId === placeId || winId === showId || placeId === showId) {
      alert('Win, Place, and Show must all be different horses.')
      return
    }
    setBusy(true)

    // Update finish positions on horses
    for (const h of horses) {
      let pos: number | null = null
      if (h.id === winId) pos = 1
      else if (h.id === placeId) pos = 2
      else if (h.id === showId) pos = 3
      await supabase.from('horses').update({ finish_position: pos }).eq('id', h.id)
    }

    // Race 13/14 lookup for auto-assign
    const race13 = racesAll.find(r => r.race_number === 13)
    const race14 = racesAll.find(r => r.race_number === 14)

    const newScores = picks.map(pick => {
      const player = players.find(p => p.id === pick.player_id)
      if (!player) return null

      let base = 0
      let win_correct = false, place_correct = false, show_correct = false

      if (pick.win_horse_id === winId) { base += 5; win_correct = true }
      else if (pick.win_horse_id === placeId || pick.win_horse_id === showId) base += 1

      if (pick.place_horse_id === placeId) { base += 3; place_correct = true }
      else if (pick.place_horse_id === winId || pick.place_horse_id === showId) base += 1

      if (pick.show_horse_id === showId) { base += 2; show_correct = true }
      else if (pick.show_horse_id === winId || pick.show_horse_id === placeId) base += 1

      const eff3x = player.multiplier_3x_race_id ?? race14?.id ?? null
      const eff2x = player.multiplier_2x_race_id ?? race13?.id ?? null

      let token = 1
      if (eff3x === race.id) token = 3
      else if (eff2x === race.id) token = 2

      const featured = race.featured_multiplier || 1
      const multiplier = featured * token
      // Longshot + perfect-race bonuses are flat — they sit on top of the
      // multiplied base so a 5-pt bonus is always 5 points, regardless of
      // whether this race carried a 2X / 3X token.
      const winHorse = horses.find(h => h.id === winId) ?? null
      const placeHorse = horses.find(h => h.id === placeId) ?? null
      const showHorse = horses.find(h => h.id === showId) ?? null
      const bonus = computeBonus(
        pick as Pick,
        winHorse,
        placeHorse,
        showHorse,
      )
      const final_points = base * multiplier + bonus.total

      const existing = scores.find(s => s.player_id === player.id)
      return {
        ...(existing ? { id: existing.id } : {}),
        player_id: player.id,
        race_id: race.id,
        event_id: race.event_id,
        base_points: base,
        multiplier_applied: multiplier,
        final_points,
        bonus_points: bonus.total,
        win_correct,
        place_correct,
        show_correct,
      }
    }).filter(Boolean) as Array<Partial<Score>>

    // Upsert one-by-one (avoid relying on a unique constraint that may not exist)
    for (const s of newScores) {
      if ('id' in s && s.id) {
        await supabase.from('scores').update(s).eq('id', s.id)
      } else {
        await supabase.from('scores').insert(s)
      }
    }

    // Mark race finished
    await supabase.from('races').update({ status: 'finished' }).eq('id', race.id)

    // For auto reveal mode, broadcast right away
    if (event.score_reveal_mode === 'auto') {
      await supabase.channel(`track-${event.id}`).send({
        type: 'broadcast', event: 'reveal_race', payload: { race_id: race.id },
      })
    }

    setBusy(false)
    // Auto-collapse the card now that scoring succeeded — admin's done with it.
    onCalculated()
    onChange()
  }

  async function dramaticReveal() {
    setRevealing(true)
    // The track page subscribes to `track-${event.id}` and listens for
    // 'reveal_race' broadcasts on it. To send on that channel we have to
    // be JOINED first — the prior version called `.send()` without ever
    // subscribing, which is why the broadcast never reached the track page.
    const channel = supabase.channel(`track-${event.id}`)
    try {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('subscribe timed out')), 5000)
        channel.subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            clearTimeout(timer)
            resolve()
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            clearTimeout(timer)
            reject(new Error(status))
          }
        })
      })
      await channel.send({
        type: 'broadcast',
        event: 'reveal_race',
        payload: { race_id: race.id },
      })
    } catch (e) {
      console.error('Reveal broadcast failed:', e)
      alert(`Couldn't broadcast reveal: ${e instanceof Error ? e.message : 'unknown error'}`)
    } finally {
      await supabase.removeChannel(channel)
      setTimeout(() => setRevealing(false), 1200)
    }
  }

  // Picks summary uses the actual race results (finish_position 1/2/3),
  // shown only once the race has been scored.
  const winHorse = horses.find(h => h.finish_position === 1)
  const placeHorse = horses.find(h => h.finish_position === 2)
  const showHorse = horses.find(h => h.finish_position === 3)
  const stop = (e: React.MouseEvent | React.PointerEvent) => e.stopPropagation()

  return (
    <div
      onClick={onToggle}
      role="button"
      tabIndex={0}
      aria-expanded={expanded}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle() } }}
      className={`rounded-xl border-2 ${race.is_featured ? 'border-[var(--gold)]/60' : 'border-white/15'} bg-white/5 p-4 cursor-pointer`}
    >
      {/* Header — always visible (collapsed view) */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="text-white/60 text-xs font-mono">
            RACE {race.race_number} {race.is_featured && <span className="text-[var(--gold)]">⭐ {race.featured_multiplier}X POINTS</span>}
          </div>
          <h3 className="text-white font-serif text-lg font-bold truncate">{race.name}</h3>
          <div className="mt-0.5">
            <a
              href={`https://www.twinspires.com/bet/program/classic/churchill-downs/cd/Thoroughbred/${race.race_number}/payouts`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-[var(--gold)]/70 hover:text-[var(--gold)] text-xs font-normal underline-offset-2 hover:underline"
            >
              📊 Results ↗
            </a>
          </div>
          <div className="text-white/50 text-xs mt-0.5">
            {totalPicked} {calculated ? 'picks scored' : 'picks'}
            {' • '}
            status: <span className="font-bold">{race.status}</span>
          </div>
          {/* One-line race-result summary, shown only when scored */}
          {calculated && (
            <div className="mt-2 text-sm text-white/85 truncate">
              <span>🥇 {winHorse?.name ?? '—'}</span>
              <span className="mx-2 text-white/30">·</span>
              <span>🥈 {placeHorse?.name ?? '—'}</span>
              <span className="mx-2 text-white/30">·</span>
              <span>🥉 {showHorse?.name ?? '—'}</span>
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          {calculated ? (
            <span className="text-emerald-400 text-sm font-bold">✓ Scored</span>
          ) : (
            <span className="text-amber-300 text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-400/30">
              Needs Results
            </span>
          )}
          <span aria-hidden className="text-white/45 text-base leading-none select-none">
            {expanded ? '▴' : '▾'}
          </span>
        </div>
      </div>

      {/* Expandable detail */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="detail"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div className="pt-3 mt-3 border-t border-white/10 space-y-3">
              {horses.length === 0 ? (
                <p className="text-white/50 text-sm">No horses to score yet.</p>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: '🥇 Win', val: winId, set: setWinId },
                      { label: '🥈 Place', val: placeId, set: setPlaceId },
                      { label: '🥉 Show', val: showId, set: setShowId },
                    ].map(slot => (
                      <div key={slot.label} onClick={stop}>
                        <div className="text-white/70 text-xs font-bold uppercase mb-1">{slot.label}</div>
                        <select
                          value={slot.val}
                          onChange={e => slot.set(e.target.value)}
                          onClick={stop}
                          className="admin-input w-full text-sm h-12"
                        >
                          <option value="">—</option>
                          {horses.filter(h => !h.scratched).map(h => (
                            <option key={h.id} value={h.id}>#{h.number} {h.name}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={(e) => { e.stopPropagation(); void calculate() }}
                      disabled={busy}
                      className="px-5 h-12 rounded-full bg-[var(--rose-dark)] border-2 border-[var(--gold)]/60 text-white font-bold disabled:opacity-50"
                    >
                      {busy ? 'Calculating…' : calculated ? 'Recalculate Scores' : 'Calculate Scores'}
                    </button>
                    {calculated && event.score_reveal_mode === 'manual' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); void dramaticReveal() }}
                        disabled={revealing}
                        className="px-5 h-12 rounded-full bg-[var(--gold)] text-black font-extrabold border-2 border-white/60 shadow-lg hover:bg-yellow-300 disabled:opacity-50"
                      >
                        {revealing ? '🎉 REVEALED!' : '✨ DRAMATIC REVEAL'}
                      </button>
                    )}
                  </div>
                </>
              )}

              {calculated && (
                <div className="pt-3 border-t border-white/10">
                  <div className="text-white/70 text-xs font-bold uppercase mb-2">Player Scores</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {scores
                      .map(s => ({ s, p: players.find(p => p.id === s.player_id) }))
                      .filter(x => x.p)
                      .sort((a, b) => b.s.final_points - a.s.final_points)
                      .map(({ s, p }) => {
                        const bonus = s.bonus_points ?? 0
                        return (
                          <div key={s.id} className="flex items-center gap-2 p-2 rounded bg-white/5 border border-white/10">
                            <AvatarIcon id={p!.avatar} className="w-7 h-7 rounded shrink-0" />
                            <span className="text-white text-sm flex-1 truncate">{p!.name}</span>
                            <span className="text-[var(--gold)] font-bold">+{s.final_points}</span>
                            <span className="text-white/40 text-xs">
                              ({s.base_points}×{s.multiplier_applied}{bonus > 0 ? ` +${bonus}` : ''})
                            </span>
                          </div>
                        )
                      })}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ============================ PLAYERS TAB ============================
function PlayersTab({
  players, races, horsesByRace, picks, scores, onChange,
}: {
  players: Player[]
  races: Race[]
  horsesByRace: Record<string, Horse[]>
  picks: Pick[]
  scores: Score[]
  onChange: () => void
}) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const [alertText, setAlertText] = useState('Make your picks now — race locking soon!')

  async function togglePaid(p: Player) {
    await supabase.from('players').update({ paid: !p.paid }).eq('id', p.id)
    onChange()
  }

  async function removePlayer(p: Player) {
    if (!confirm(`Delete ${p.name}? This will remove all their picks and scores.`)) return
    await supabase.from('scores').delete().eq('player_id', p.id)
    await supabase.from('picks').delete().eq('player_id', p.id)
    await supabase.from('players').delete().eq('id', p.id)
    onChange()
  }

  async function broadcastAlert() {
    if (!alertText.trim()) return
    await supabase.channel('reveals').send({
      type: 'broadcast', event: 'admin_alert', payload: { message: alertText },
    })
    if (players.length > 0) {
      // Also broadcast on each player's picks channel where the picks screen listens
      const eventId = players[0].event_id
      await supabase.channel(`track-${eventId}`).send({
        type: 'broadcast', event: 'admin_alert', payload: { message: alertText },
      })
    }
    alert('Alert sent to all connected players.')
  }

  if (players.length === 0) return <p className="text-white/60">No players have joined yet.</p>

  const totalPaid = players.filter(p => p.paid).length

  return (
    <section className="space-y-4">
      <h2 className="font-serif text-2xl font-bold text-white">Players ({players.length})</h2>

      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
        <div className="text-amber-200 text-xs font-bold uppercase mb-1">Broadcast Alert</div>
        <div className="flex gap-2">
          <input value={alertText} onChange={e => setAlertText(e.target.value)} placeholder="Message" className="admin-input flex-1 text-sm h-10" />
          <button onClick={broadcastAlert} className="px-4 h-10 rounded-lg bg-amber-400 text-black font-bold text-sm">Send</button>
        </div>
      </div>

      <div className="text-white/60 text-sm">
        💵 Paid: <span className="font-bold text-emerald-400">{totalPaid}</span> / {players.length}
      </div>

      <div className="space-y-2">
        {players.map(p => {
          const total = scores.filter(s => s.player_id === p.id).reduce((sum, s) => sum + s.final_points, 0)
          const isOpen = expanded === p.id
          return (
            <div key={p.id} className="rounded-xl border border-white/15 bg-white/5">
              <div className="flex items-center gap-3 p-3">
                <AvatarIcon id={p.avatar} className="w-12 h-12 rounded-lg shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-white font-semibold truncate">{p.name}</div>
                  <div className="text-white/50 text-xs">
                    {picks.filter(pi => pi.player_id === p.id && (pi.win_horse_id || pi.place_horse_id || pi.show_horse_id)).length} picks made
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[var(--gold)] font-bold text-lg leading-none">{total}</div>
                  <div className="text-white/40 text-[10px]">PTS</div>
                </div>
                <button
                  onClick={() => togglePaid(p)}
                  className={`px-3 h-9 rounded-full text-xs font-bold border-2 ${p.paid ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300' : 'border-white/30 text-white/70'}`}
                >
                  {p.paid ? '✓ Paid' : 'Mark Paid'}
                </button>
                <button
                  onClick={() => removePlayer(p)}
                  title={`Delete ${p.name}`}
                  aria-label={`Delete ${p.name}`}
                  className="w-9 h-9 rounded-full border border-red-500/30 text-red-300 hover:bg-red-500/15 hover:border-red-500/60 flex items-center justify-center text-base"
                >
                  🗑
                </button>
                <button onClick={() => setExpanded(isOpen ? null : p.id)} className="text-white/50 text-xl px-2">
                  {isOpen ? '−' : '+'}
                </button>
              </div>

              {isOpen && (
                <div className="px-3 pb-3 border-t border-white/10 pt-3 space-y-2">
                  <div className="grid grid-cols-1 gap-1">
                    {races.map(r => {
                      const pi = picks.find(x => x.player_id === p.id && x.race_id === r.id)
                      const sc = scores.find(x => x.player_id === p.id && x.race_id === r.id)
                      const horses = horsesByRace[r.id] ?? []
                      const lookupHorse = (id?: string | null) => horses.find(h => h.id === id)
                      return (
                        <div key={r.id} className="flex items-center gap-2 text-xs py-1">
                          <span className="text-white/50 w-12">R{r.race_number}</span>
                          {pi ? (
                            <span className="text-white/80 flex-1 truncate">
                              W: #{lookupHorse(pi.win_horse_id)?.number ?? '—'} •
                              P: #{lookupHorse(pi.place_horse_id)?.number ?? '—'} •
                              S: #{lookupHorse(pi.show_horse_id)?.number ?? '—'}
                            </span>
                          ) : (
                            <span className="text-white/30 italic flex-1">no pick</span>
                          )}
                          {sc && <span className="text-[var(--gold)] font-bold">+{sc.final_points}</span>}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

// ============================ LEADERBOARD TAB ============================
function LeaderboardTab({ players, races, scores }: { players: Player[]; races: Race[]; scores: Score[] }) {
  const standings = useMemo(() => {
    return players.map(p => {
      const playerScores = scores.filter(s => s.player_id === p.id)
      const total = playerScores.reduce((sum, s) => sum + s.final_points, 0)
      const wins = playerScores.filter(s => s.win_correct).length
      const places = playerScores.filter(s => s.place_correct).length
      const shows = playerScores.filter(s => s.show_correct).length
      return { player: p, total, wins, places, shows, scores: playerScores }
    }).sort((a, b) => b.total - a.total)
  }, [players, scores])

  if (players.length === 0) return <p className="text-white/60">No players yet.</p>

  return (
    <section className="space-y-4">
      <h2 className="font-serif text-2xl font-bold text-white">Leaderboard</h2>
      <div className="overflow-x-auto rounded-xl border border-white/15 bg-white/5">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="bg-black/40 text-white/70 text-xs uppercase">
              <th className="text-left p-2">#</th>
              <th className="text-left p-2">Player</th>
              {races.map(r => (
                <th key={r.id} className={`text-center p-2 ${r.is_featured ? 'text-[var(--gold)]' : ''}`}>R{r.race_number}</th>
              ))}
              <th className="text-center p-2 text-[var(--gold)]">Total</th>
              <th className="text-center p-2">W</th>
              <th className="text-center p-2">P</th>
              <th className="text-center p-2">S</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((row, idx) => (
                <tr key={row.player.id} className="border-t border-white/10 hover:bg-white/5">
                  <td className="p-2 text-white/80 font-bold">{idx + 1}</td>
                  <td className="p-2">
                    <div className="flex items-center gap-2">
                      <AvatarIcon id={row.player.avatar} className="w-7 h-7 rounded shrink-0" />
                      <span className="text-white font-semibold truncate">{row.player.name}</span>
                    </div>
                  </td>
                  {races.map(r => {
                    const s = row.scores.find(s => s.race_id === r.id)
                    return (
                      <td key={r.id} className="text-center p-2 text-white/80">
                        {s ? <span className={r.is_featured ? 'text-[var(--gold)] font-bold' : ''}>+{s.final_points}</span> : <span className="text-white/20">—</span>}
                      </td>
                    )
                  })}
                  <td className="text-center p-2 text-[var(--gold)] font-bold text-base">{row.total}</td>
                  <td className="text-center p-2 text-emerald-400">{row.wins}</td>
                  <td className="text-center p-2 text-amber-300">{row.places}</td>
                  <td className="text-center p-2 text-white/70">{row.shows}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

// ============================ HELPERS ============================
// Live countdown pill shown next to race status. Color escalates as we approach
// post time: white → gold under 5min → red+pulse under 1min → red "Post Time"
// once the time has passed (until admin/auto-lock fires and we render "🔒 Locked").
function RaceCountdownBadge({ race, now }: { race: Race; now: number }) {
  if (race.status === 'locked' || race.status === 'finished') {
    return <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-700/40 text-amber-200">🔒 Locked</span>
  }
  if (!race.post_time) return null
  const cd = formatCountdown(race.post_time, now)
  if (!cd) {
    return <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-red-600/30 text-red-300 border border-red-500/40">Post Time</span>
  }
  const urgent = cd.secondsLeft < 60
  const warn = !urgent && cd.secondsLeft < 300
  const cls = urgent
    ? 'bg-red-600/30 text-red-200 border border-red-500/60 animate-pulse'
    : warn
      ? 'bg-amber-500/20 text-amber-200 border border-amber-400/50'
      : 'bg-white/10 text-white/80 border border-white/20'
  return (
    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${cls}`} title="Locks at post time">
      Locks in {cd.text}
    </span>
  )
}

function Field({ label, children, inline }: { label: string; children: React.ReactNode; inline?: boolean }) {
  return (
    <label className={inline ? 'flex items-center gap-2' : 'block'}>
      <span className={`text-white/70 text-xs font-bold uppercase ${inline ? '' : 'block mb-1'}`}>{label}</span>
      {children}
    </label>
  )
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      aria-pressed={value}
      className={`flex items-center justify-between gap-4 w-full h-12 px-3 rounded-lg border-2 transition-colors text-left ${
        value
          ? 'border-[var(--gold)]/60 bg-[var(--gold)]/10 hover:border-[var(--gold)]'
          : 'border-white/20 bg-white/5 hover:border-white/40'
      }`}
    >
      <span className="text-white text-sm flex-1 min-w-0">{label}</span>
      <span className="flex items-center gap-2 shrink-0">
        <span className={`text-[10px] font-bold uppercase tracking-wider ${value ? 'text-[var(--gold)]' : 'text-white/40'}`}>
          {value ? 'On' : 'Off'}
        </span>
        <span
          aria-hidden
          className={`relative w-11 h-6 rounded-full transition-colors ${value ? 'bg-[var(--gold)]' : 'bg-white/20'}`}
        >
          <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${value ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
        </span>
      </span>
    </button>
  )
}
