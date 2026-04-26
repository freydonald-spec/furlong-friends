'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { AvatarIcon } from '@/lib/avatars'
import type { Event, Race, Horse, Player, Pick, Score } from '@/lib/types'

const ADMIN_PASSWORD = 'roses2025'
type Tab = 'event' | 'races' | 'results' | 'players' | 'leaderboard'

export default function AdminPage() {
  // Auth must start `false` on the server to avoid a hydration mismatch.
  // The sessionStorage check is then promoted to the client in an effect below.
  const [authed, setAuthed] = useState(false)
  const [pwInput, setPwInput] = useState('')
  const [pwError, setPwError] = useState(false)
  const [tab, setTab] = useState<Tab>('event')

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
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed, event?.id])

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
            {tab === 'event' && <EventTab key={event?.id ?? 'new'} event={event} onChange={refresh} />}
            {tab === 'races' && <RacesTab event={event} races={races} horsesByRace={horsesByRace} players={players} picks={picks} onChange={refresh} />}
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
function EventTab({ event, onChange }: { event: Event | null; onChange: () => void }) {
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
  return <EventEditor event={event} onChange={onChange} />
}

function EventEditor({ event, onChange }: { event: Event; onChange: () => void }) {
  const [draft, setDraft] = useState<Partial<Event>>(() => event)
  const [saving, setSaving] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)

  // Race-builder inputs
  const [startNum, setStartNum] = useState<number>(7)
  const [endNum, setEndNum] = useState<number>(14)
  const [featuredNum, setFeaturedNum] = useState<number>(14)
  const [creatingRaces, setCreatingRaces] = useState(false)

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
    if (!confirm(`Permanently delete "${event.name || 'this event'}" and ALL of its races, horses, players, picks, and scores? This cannot be undone.`)) return
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
    onChange()
  }

  async function addRaces() {
    const start = Number(startNum), end = Number(endNum), featured = Number(featuredNum)
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < 1) {
      alert('Race numbers must be positive whole numbers.')
      return
    }
    if (start > end) {
      alert('Start race number must be less than or equal to end race number.')
      return
    }
    if (featured && (featured < start || featured > end)) {
      alert(`Featured race ${featured} is outside the range ${start}–${end}.`)
      return
    }
    if (end - start > 30) {
      if (!confirm(`That's ${end - start + 1} races. Continue?`)) return
    }
    setCreatingRaces(true)
    const rows = []
    for (let n = start; n <= end; n++) {
      const isFeatured = n === featured
      rows.push({
        event_id: event.id,
        race_number: n,
        name: isFeatured ? 'Featured Race' : `Race ${n}`,
        distance: null,
        post_time: null,
        is_featured: isFeatured,
        featured_multiplier: isFeatured ? 2 : 1,
        status: 'upcoming',
      })
    }
    const { error: err } = await supabase.from('races').insert(rows)
    setCreatingRaces(false)
    if (err) { alert("Couldn't add races: " + err.message); return }
    onChange()
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
          onClick={deleteEvent}
          className="ml-auto px-4 h-12 rounded-full border-2 border-red-500/30 text-red-300 text-sm font-semibold hover:border-red-500/60"
        >
          Delete Event
        </button>
      </div>

      {/* Add Races section */}
      <div className="mt-8 rounded-xl border border-white/15 bg-white/5 p-4">
        <h3 className="text-white/80 text-sm uppercase tracking-wider font-bold mb-1">Add Races</h3>
        <p className="text-white/50 text-xs mb-3">
          Create a sequential range of races. The featured race gets a 2x base multiplier.
        </p>
        <div className="grid grid-cols-3 gap-2">
          <Field label="Start #">
            <input
              type="number"
              min={1}
              value={startNum}
              onChange={e => setStartNum(Number(e.target.value))}
              className="admin-input"
            />
          </Field>
          <Field label="End #">
            <input
              type="number"
              min={1}
              value={endNum}
              onChange={e => setEndNum(Number(e.target.value))}
              className="admin-input"
            />
          </Field>
          <Field label="Featured #">
            <input
              type="number"
              min={1}
              value={featuredNum}
              onChange={e => setFeaturedNum(Number(e.target.value))}
              className="admin-input"
            />
          </Field>
        </div>
        <button
          onClick={addRaces}
          disabled={creatingRaces}
          className="mt-3 px-6 h-11 rounded-full bg-[var(--rose-dark)] border-2 border-[var(--gold)]/60 text-white font-bold disabled:opacity-50"
        >
          {creatingRaces ? 'Adding…' : '+ Add Races'}
        </button>
      </div>
    </section>
  )
}

// ============================ RACES TAB ============================
function RacesTab({
  event, races, horsesByRace, players, picks, onChange,
}: {
  event: Event | null
  races: Race[]
  horsesByRace: Record<string, Horse[]>
  players: Player[]
  picks: Pick[]
  onChange: () => void
}) {
  if (!event) return <p className="text-white/60">Pick or create an event first.</p>
  if (races.length === 0) return <p className="text-white/60">No races yet. Use &quot;+ Add Races&quot; in the Event tab.</p>

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="font-serif text-2xl font-bold text-white">Races</h2>
        <button
          onClick={downloadHorseTemplate}
          className="text-sm text-[var(--gold)] hover:text-[var(--gold)]/80 underline underline-offset-4"
        >
          ↓ Download CSV template
        </button>
      </div>
      <p className="text-white/50 text-xs -mt-2">
        Each race accepts a CSV with columns: <code className="text-[var(--gold)]">number</code>, <code className="text-[var(--gold)]">name</code>, <code className="text-[var(--gold)]">odds</code>.
      </p>
      {races.map(race => (
        <RaceAdminCard
          key={race.id}
          race={race}
          horses={horsesByRace[race.id] ?? []}
          players={players}
          picks={picks.filter(p => p.race_id === race.id)}
          onChange={onChange}
        />
      ))}
    </section>
  )
}

function downloadHorseTemplate() {
  const csv = 'number,name,odds\n1,Example Horse,5-1\n2,Another Horse,8-1\n'
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
  rows: Array<{ number: number; name: string; odds: string | null }>
  errors: string[]
}

function parseHorseCsv(text: string): CsvHorseParse {
  const rows: CsvHorseParse['rows'] = []
  const errors: string[] = []
  const lines = text.replace(/\r\n/g, '\n').split('\n').map(l => l.trim()).filter(l => l.length > 0)
  if (lines.length === 0) {
    return { rows, errors: ['File is empty.'] }
  }

  // Header detection
  const header = parseCsvLine(lines[0]).map(c => c.toLowerCase())
  const hasHeader = header.includes('number') || header.includes('name')
  const startIdx = hasHeader ? 1 : 0

  let numberIdx = 0, nameIdx = 1, oddsIdx = 2
  if (hasHeader) {
    const idxOf = (n: string) => header.indexOf(n)
    numberIdx = idxOf('number') !== -1 ? idxOf('number') : 0
    nameIdx = idxOf('name') !== -1 ? idxOf('name') : 1
    oddsIdx = idxOf('odds') !== -1 ? idxOf('odds') : 2
  }

  for (let i = startIdx; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i])
    const lineNo = i + 1
    const rawNum = cells[numberIdx]
    const name = (cells[nameIdx] ?? '').trim()
    const odds = (cells[oddsIdx] ?? '').trim()

    const num = Number(rawNum)
    if (!rawNum || !Number.isFinite(num) || !Number.isInteger(num) || num < 1) {
      errors.push(`Line ${lineNo}: invalid number "${rawNum ?? ''}"`)
      continue
    }
    if (!name) {
      errors.push(`Line ${lineNo}: missing name`)
      continue
    }
    rows.push({ number: num, name, odds: odds || null })
  }

  return { rows, errors }
}

function RaceAdminCard({ race, horses, players, picks, onChange }: {
  race: Race; horses: Horse[]; players: Player[]; picks: Pick[]; onChange: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [horseName, setHorseName] = useState('')
  const [horseNumber, setHorseNumber] = useState('')
  const [horseOdds, setHorseOdds] = useState('')
  const [busy, setBusy] = useState(false)

  // CSV import state
  const [csvOpen, setCsvOpen] = useState(false)
  const [csvText, setCsvText] = useState('')
  const [csvImporting, setCsvImporting] = useState(false)
  const [csvResult, setCsvResult] = useState<{ inserted: number; errors: string[] } | null>(null)

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

  function onPickFile(file: File) {
    setCsvResult(null)
    const reader = new FileReader()
    reader.onload = () => setCsvText(String(reader.result ?? ''))
    reader.onerror = () => setCsvResult({ inserted: 0, errors: ["Couldn't read file"] })
    reader.readAsText(file)
  }

  async function importCsv() {
    setCsvImporting(true)
    setCsvResult(null)
    const { rows, errors } = parseHorseCsv(csvText)
    if (rows.length === 0) {
      setCsvResult({ inserted: 0, errors: errors.length ? errors : ['No valid rows found.'] })
      setCsvImporting(false)
      return
    }
    const payload = rows.map(r => ({
      race_id: race.id,
      number: r.number,
      name: r.name,
      morning_line_odds: r.odds,
      scratched: false,
      finish_position: null,
    }))
    const { error: err } = await supabase.from('horses').insert(payload)
    if (err) {
      setCsvResult({ inserted: 0, errors: [...errors, `Database error: ${err.message}`] })
    } else {
      setCsvResult({ inserted: rows.length, errors })
      setCsvText('')
    }
    setCsvImporting(false)
    onChange()
  }

  async function setStatus(status: Race['status']) {
    await supabase.from('races').update({ status }).eq('id', race.id)
    onChange()
  }

  async function removeHorse(id: string) {
    if (!confirm('Remove this horse?')) return
    await supabase.from('horses').delete().eq('id', id)
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

  return (
    <div className={`rounded-xl border-2 ${race.is_featured ? 'border-[var(--gold)]/50' : 'border-white/15'} bg-white/5 overflow-hidden`}>
      <button onClick={() => setExpanded(e => !e)} className="w-full p-4 flex items-center justify-between text-left">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-white/60 text-xs font-mono">RACE {race.race_number}</span>
            {race.is_featured && <span className="text-[10px] text-[var(--gold)] font-bold">⭐ FEATURED ({race.featured_multiplier}x)</span>}
            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${statusColor}`}>{race.status}</span>
          </div>
          <h3 className="text-white font-semibold mt-0.5 truncate">{race.name}</h3>
          <div className="text-white/50 text-xs mt-0.5">
            🐴 {horses.length} horses • 📋 {playersWithPick}/{players.length} picked
          </div>
        </div>
        <span className="text-white/50 text-xl shrink-0 ml-3">{expanded ? '−' : '+'}</span>
      </button>

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
                value={race.post_time ? new Date(race.post_time).toISOString().slice(0, 16) : ''}
                onChange={async e => {
                  await supabase.from('races').update({ post_time: e.target.value ? new Date(e.target.value).toISOString() : null }).eq('id', race.id)
                  onChange()
                }}
                className="admin-input h-10 text-sm"
              />
            </Field>
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
              <button
                onClick={() => { setCsvOpen(o => !o); setCsvResult(null) }}
                className="px-3 h-10 rounded-lg border border-[var(--gold)]/40 text-[var(--gold)] text-sm font-bold"
              >
                📥 {csvOpen ? 'Cancel' : 'Import CSV'}
              </button>
            </div>

            {csvOpen && (
              <div className="mt-3 rounded-lg border border-[var(--gold)]/30 bg-black/30 p-3 space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
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
                  <button
                    onClick={downloadHorseTemplate}
                    type="button"
                    className="text-xs text-[var(--gold)] underline underline-offset-4"
                  >↓ Download template</button>
                </div>
                <textarea
                  value={csvText}
                  onChange={e => setCsvText(e.target.value)}
                  rows={5}
                  placeholder={`number,name,odds\n1,Mage,8-1\n2,Two Phil's,12-1`}
                  className="w-full p-2 rounded-lg bg-white/10 border-2 border-white/15 text-white text-xs font-mono focus:outline-none focus:border-[var(--gold)]"
                />
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={importCsv}
                    disabled={csvImporting || !csvText.trim()}
                    className="px-4 h-10 rounded-lg bg-[var(--rose-dark)] border border-[var(--gold)]/60 text-white text-sm font-bold disabled:opacity-50"
                  >
                    {csvImporting ? 'Importing…' : 'Import Horses'}
                  </button>
                  {csvText && (
                    <button
                      onClick={() => { setCsvText(''); setCsvResult(null) }}
                      className="px-3 h-10 rounded-lg border border-white/20 text-white/70 text-sm"
                    >Clear</button>
                  )}
                </div>
                {csvResult && (
                  <div className="text-xs space-y-1">
                    {csvResult.inserted > 0 && (
                      <div className="text-emerald-400 font-semibold">
                        ✓ Imported {csvResult.inserted} horse{csvResult.inserted === 1 ? '' : 's'}
                      </div>
                    )}
                    {csvResult.errors.length > 0 && (
                      <div className="text-amber-300">
                        <div className="font-semibold mb-0.5">Skipped {csvResult.errors.length} row{csvResult.errors.length === 1 ? '' : 's'}:</div>
                        <ul className="list-disc list-inside ml-1 space-y-0.5">
                          {csvResult.errors.slice(0, 8).map((e, i) => <li key={i}>{e}</li>)}
                          {csvResult.errors.length > 8 && <li>…and {csvResult.errors.length - 8} more</li>}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
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
  if (!event) return <p className="text-white/60">Set up the event first.</p>

  const racesWithResults = races.filter(r => r.status === 'locked' || r.status === 'finished' || r.status === 'open')
  if (racesWithResults.length === 0) return <p className="text-white/60">No races are locked yet.</p>

  return (
    <section className="space-y-4">
      <h2 className="font-serif text-2xl font-bold text-white">Results</h2>
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
            onChange={onChange}
          />
        )
      })}
    </section>
  )
}

function ResultsCard({
  race, event, horses, players, racesAll, picks, scores, onChange,
}: {
  race: Race
  event: Event
  horses: Horse[]
  players: Player[]
  racesAll: Race[]
  picks: Pick[]
  scores: Score[]
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
    onChange()
  }

  async function dramaticReveal() {
    setRevealing(true)
    const channel = supabase.channel(`reveal-${event.id}`)
    await channel.subscribe()
    await channel.send({
      type: 'broadcast', event: 'reveal_race', payload: { race_id: race.id },
    })
    // Also send to the picks/track default channels by name
    await supabase.channel(`track-${event.id}`).send({
      type: 'broadcast', event: 'reveal_race', payload: { race_id: race.id },
    })
    // Send player-specific channels by emitting on a wildcard pattern won't work; the picks page
    // also subscribes to `picks-${player.id}` so we send a generic "reveal" channel:
    await supabase.channel('reveals').send({
      type: 'broadcast', event: 'reveal_race', payload: { race_id: race.id },
    })
    setTimeout(() => setRevealing(false), 1200)
  }

  return (
    <div className={`rounded-xl border-2 ${race.is_featured ? 'border-[var(--gold)]/60' : 'border-white/15'} bg-white/5 p-4`}>
      <div className="flex items-start justify-between mb-3 flex-wrap gap-2">
        <div>
          <div className="text-white/60 text-xs font-mono">RACE {race.race_number} {race.is_featured && <span className="text-[var(--gold)]">⭐ DERBY</span>}</div>
          <h3 className="text-white font-serif text-lg font-bold">{race.name}</h3>
          <div className="text-white/50 text-xs">{totalPicked} picks • status: <span className="font-bold">{race.status}</span></div>
        </div>
        {calculated && <span className="text-emerald-400 text-sm font-bold">✓ Scored</span>}
      </div>

      {horses.length === 0 ? (
        <p className="text-white/50 text-sm">No horses to score yet.</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 mb-3">
            {[
              { label: '🥇 Win', val: winId, set: setWinId },
              { label: '🥈 Place', val: placeId, set: setPlaceId },
              { label: '🥉 Show', val: showId, set: setShowId },
            ].map(slot => (
              <div key={slot.label}>
                <div className="text-white/70 text-xs font-bold uppercase mb-1">{slot.label}</div>
                <select value={slot.val} onChange={e => slot.set(e.target.value)} className="admin-input w-full text-sm h-12">
                  <option value="">—</option>
                  {horses.filter(h => !h.scratched).map(h => (
                    <option key={h.id} value={h.id}>#{h.number} {h.name}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <div className="flex gap-2 flex-wrap">
            <button onClick={calculate} disabled={busy} className="px-5 h-12 rounded-full bg-[var(--rose-dark)] border-2 border-[var(--gold)]/60 text-white font-bold disabled:opacity-50">
              {busy ? 'Calculating…' : calculated ? 'Recalculate Scores' : 'Calculate Scores'}
            </button>
            {calculated && event.score_reveal_mode === 'manual' && (
              <button
                onClick={dramaticReveal}
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
        <div className="mt-3 pt-3 border-t border-white/10">
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
    if (!confirm(`Remove ${p.name}? Their picks and scores will also be deleted.`)) return
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
                  <div className="flex justify-end pt-1">
                    <button onClick={() => removePlayer(p)} className="text-red-400 text-xs hover:text-red-300">
                      Remove player
                    </button>
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
