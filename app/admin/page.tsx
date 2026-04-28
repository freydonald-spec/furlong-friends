'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { AvatarIcon } from '@/lib/avatars'
import { formatLocalIso, parseLocalIso } from '@/lib/time'
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
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed, event?.id])

  // Auto-lock: on every 1s tick, lock any race whose post_time has just passed.
  // `autoLockedRef` prevents us from re-firing the same update while waiting
  // for the realtime subscription to echo the new status back.
  useEffect(() => {
    if (!authed || !event) return
    const overdue = races.filter(r => {
      if (r.status === 'locked' || r.status === 'finished') return false
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
      <main className="min-h-screen flex items-center justify-center px-6">
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
    <main className="min-h-screen flex flex-col">
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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
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
  if (!event) return <p className="text-white/60">Pick or create an event first.</p>

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="font-serif text-2xl font-bold text-white">Races</h2>
        <div className="flex items-center gap-4 flex-wrap">
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

function BulkHorseImport({ event, races, onChange }: { event: Event; races: Race[]; onChange: () => void }) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ inserted: number; raceCount: number; errors: string[] } | null>(null)

  function onPickFile(file: File) {
    setResult(null)
    const reader = new FileReader()
    reader.onload = () => setText(String(reader.result ?? ''))
    reader.onerror = () => setResult({ inserted: 0, raceCount: 0, errors: ["Couldn't read file"] })
    reader.readAsText(file)
  }

  async function importCsv() {
    setImporting(true)
    setResult(null)
    const { rows, errors } = parseHorseCsv(text)
    if (rows.length === 0) {
      setResult({ inserted: 0, raceCount: 0, errors: errors.length ? errors : ['No valid rows found.'] })
      setImporting(false)
      return
    }
    const allErrors = [...errors]
    const eventDate = typeof event.date === 'string' ? event.date.slice(0, 10) : ''

    // Group rows by race_number; first row's post_time/race_name wins for the race record.
    const groups = new Map<number, typeof rows>()
    for (const r of rows) {
      const g = groups.get(r.race_number)
      if (g) g.push(r)
      else groups.set(r.race_number, [r])
    }

    // Resolve each race_number → race record, creating any that don't exist yet.
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

      const existing = raceByNumber.get(raceNumber)
      if (existing) {
        const { error: rerr } = await supabase.from('races').update({
          name: raceName,
          post_time: postTimeIso,
          is_featured: isFeatured,
          featured_multiplier: featuredMultiplier,
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
        }).select('id').single()
        if (cerr || !created) {
          allErrors.push(`Race ${raceNumber}: couldn't create race: ${cerr?.message ?? 'unknown error'}`)
          continue
        }
        raceIdByNumber.set(raceNumber, created.id)
        resolvedRaceIds.push(created.id)
      }
    }

    // Wipe any pre-existing horses on the races we're about to repopulate so the
    // CSV is the source of truth and re-imports don't leave stale rows behind.
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
            onClick={() => { setOpen(o => !o); setResult(null) }}
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

      {open && (
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
              onClick={importCsv}
              disabled={importing || !text.trim()}
              className="px-4 h-10 rounded-lg bg-[var(--rose-dark)] border border-[var(--gold)]/60 text-white text-sm font-bold disabled:opacity-50"
            >
              {importing ? 'Importing…' : 'Import Horses'}
            </button>
            {text && (
              <button
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
    </div>
  )
}

function RaceAdminCard({ race, allRaces, horses, players, picks, now, onChange }: {
  race: Race
  allRaces: Race[]
  horses: Horse[]
  players: Player[]
  picks: Pick[]
  now: number
  onChange: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [horseName, setHorseName] = useState('')
  const [horseNumber, setHorseNumber] = useState('')
  const [horseOdds, setHorseOdds] = useState('')
  const [busy, setBusy] = useState(false)

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
    if (!confirm(`Delete "${race.name || `Race ${race.race_number}`}" entirely?\n\nRemoves the race, its ${horses.length} horse${horses.length === 1 ? '' : 's'}, all player picks for it, and any scores. This cannot be undone.`)) return
    await supabase.from('picks').delete().eq('race_id', race.id)
    await supabase.from('scores').delete().eq('race_id', race.id)
    await supabase.from('horses').delete().eq('race_id', race.id)
    await supabase.from('races').delete().eq('id', race.id)
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
    await supabase.from('horses').update({ scratched: !h.scratched }).eq('id', h.id)
    onChange()
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
              onClick={(e) => { e.stopPropagation(); void toggleFeatured() }}
              title={race.is_featured ? `Featured (${race.featured_multiplier}× multiplier) — click to un-feature` : 'Mark as featured race (only one per event)'}
              className={`text-[10px] font-bold inline-flex items-center gap-1 px-1.5 py-0.5 rounded border ${race.is_featured ? 'text-[var(--gold)] bg-[var(--gold)]/15 border-[var(--gold)]/50' : 'text-white/50 border-white/20 hover:text-[var(--gold)] hover:border-[var(--gold)]/40'}`}
            >
              {race.is_featured ? '⭐' : '☆'}
              {race.is_featured && (
                <span className="ml-0.5">FEATURED · {race.featured_multiplier}×</span>
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
            onClick={(e) => { e.stopPropagation(); void deleteRace() }}
            title="Delete this race entirely (race, horses, picks, scores)"
            className="px-3 h-9 rounded-full border-2 border-red-500/40 text-red-300 hover:bg-red-500/10 hover:border-red-500/70 text-xs font-bold"
          >
            🗑 Delete Race
          </button>
          <span className="text-white/50 text-xl">{expanded ? '−' : '+'}</span>
        </div>
      </div>

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
                      <div className={`text-white font-semibold text-sm truncate ${h.scratched ? 'line-through' : ''}`}>{h.name}</div>
                      {h.morning_line_odds && <div className="text-white/50 text-xs">{h.morning_line_odds}</div>}
                    </div>
                    <button onClick={() => toggleScratch(h)} className="text-xs px-2 h-8 rounded border border-white/20 text-white/70">
                      {h.scratched ? 'Unscratch' : 'Scratch'}
                    </button>
                    <button onClick={() => removeHorse(h.id)} className="text-xs px-2 h-8 rounded border border-red-500/30 text-red-300">
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
      const final_points = base * multiplier

      const existing = scores.find(s => s.player_id === player.id)
      return {
        ...(existing ? { id: existing.id } : {}),
        player_id: player.id,
        race_id: race.id,
        event_id: race.event_id,
        base_points: base,
        multiplier_applied: multiplier,
        final_points,
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
            RACE {race.race_number} {race.is_featured && <span className="text-[var(--gold)]">⭐ DERBY</span>}
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
                      .map(({ s, p }) => (
                        <div key={s.id} className="flex items-center gap-2 p-2 rounded bg-white/5 border border-white/10">
                          <AvatarIcon id={p!.avatar} className="w-7 h-7 rounded shrink-0" />
                          <span className="text-white text-sm flex-1 truncate">{p!.name}</span>
                          <span className="text-[var(--gold)] font-bold">+{s.final_points}</span>
                          <span className="text-white/40 text-xs">({s.base_points}×{s.multiplier_applied})</span>
                        </div>
                      ))}
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
    <label className="flex items-center justify-between gap-3 p-3 rounded-lg border-2 border-white/20 bg-white/5 cursor-pointer">
      <span className="text-white text-sm">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`relative w-12 h-7 rounded-full transition-colors ${value ? 'bg-[var(--gold)]' : 'bg-white/20'}`}
      >
        <span className={`absolute top-0.5 w-6 h-6 rounded-full bg-white transition-transform ${value ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </button>
    </label>
  )
}
