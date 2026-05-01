'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { AvatarIcon } from '@/lib/avatars'
import { WatchPartyBadge } from '@/lib/watch-party-badge'
import { WatermarkBG } from '@/components/WatermarkBG'
import { computePlayerBadges } from '@/lib/badges'
import type { Event, Race, Horse, Pick, Player, Score } from '@/lib/types'

// Public, read-only leaderboard. No password gate — same data shape as the
// admin LeaderboardTab, but score totals are filtered through the same
// reveal-mode logic that gates the picks/track pages so manual-mode hosts
// keep their dramatic-reveal moment.

export default function LeaderboardPage() {
  const [event, setEvent] = useState<Event | null>(null)
  const [races, setRaces] = useState<Race[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [scores, setScores] = useState<Score[]>([])
  const [revealedRaces, setRevealedRaces] = useState<Set<string>>(new Set())
  const [expandedPlayerId, setExpandedPlayerId] = useState<string | null>(null)
  const [picks, setPicks] = useState<Pick[]>([])
  const [horsesByRace, setHorsesByRace] = useState<Record<string, Horse[]>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const { data: events } = await supabase
          .from('events')
          .select('*')
          .eq('status', 'active')
          .order('date', { ascending: false })
          .limit(1)
        const evt = events?.[0]
        if (cancelled) return
        if (!evt) {
          setError('No event is active right now.')
          setLoading(false)
          return
        }
        setEvent(evt)

        const [racesQ, playersQ, scoresQ, picksQ] = await Promise.all([
          supabase.from('races').select('*').eq('event_id', evt.id).order('race_number'),
          supabase.from('players').select('*').eq('event_id', evt.id),
          supabase.from('scores').select('*').eq('event_id', evt.id),
          supabase.from('picks').select('*').eq('event_id', evt.id),
        ])
        if (cancelled) return
        setRaces(racesQ.data ?? [])
        setPlayers(playersQ.data ?? [])
        setScores(scoresQ.data ?? [])
        setPicks(picksQ.data ?? [])

        // Horses for the event — needed for longshot/perfect-race bonus
        // detection in badge calculation. Pulled by race id list.
        const raceIds = (racesQ.data ?? []).map(r => r.id)
        if (raceIds.length > 0) {
          const { data: horsesRows } = await supabase
            .from('horses')
            .select('*')
            .in('race_id', raceIds)
          if (!cancelled) {
            const grouped: Record<string, Horse[]> = {}
            for (const h of horsesRows ?? []) {
              if (!grouped[h.race_id]) grouped[h.race_id] = []
              grouped[h.race_id].push(h)
            }
            setHorsesByRace(grouped)
          }
        }
      } catch (e) {
        console.error(e)
        if (!cancelled) setError("Couldn't load the leaderboard.")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [])

  // Realtime subscription — refresh on any players/scores/races change for
  // this event, plus the `reveal_race` broadcast that the admin uses for
  // manual-mode reveals.
  useEffect(() => {
    if (!event) return
    const channel = supabase
      .channel(`leaderboard-${event.id}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'players', filter: `event_id=eq.${event.id}` },
        async () => {
          const { data } = await supabase.from('players').select('*').eq('event_id', event.id)
          if (data) setPlayers(data)
        })
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'scores', filter: `event_id=eq.${event.id}` },
        async () => {
          const { data } = await supabase.from('scores').select('*').eq('event_id', event.id)
          if (data) setScores(data)
        })
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'races', filter: `event_id=eq.${event.id}` },
        async () => {
          const { data } = await supabase.from('races').select('*').eq('event_id', event.id).order('race_number')
          if (data) setRaces(data)
        })
      .on('broadcast', { event: 'reveal_race' }, ({ payload }) => {
        setRevealedRaces(prev => new Set([...prev, payload.race_id]))
      })
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event?.id])

  const effectiveRevealed = useMemo(() => {
    if (event?.score_reveal_mode === 'auto') return new Set(races.map(r => r.id))
    return revealedRaces
  }, [event?.score_reveal_mode, races, revealedRaces])

  const standings = useMemo(() => {
    return players.map(p => {
      const playerScores = scores.filter(s =>
        s.player_id === p.id && effectiveRevealed.has(s.race_id)
      )
      const total = playerScores.reduce((sum, s) => sum + s.final_points, 0)
      const wins = playerScores.filter(s => s.win_correct).length
      const places = playerScores.filter(s => s.place_correct).length
      const shows = playerScores.filter(s => s.show_correct).length
      return { player: p, total, wins, places, shows }
    }).sort((a, b) => b.total - a.total || a.player.name.localeCompare(b.player.name))
  }, [players, scores, effectiveRevealed])

  const badgesByPlayerId = useMemo(() => {
    const out = new Map<string, ReturnType<typeof computePlayerBadges>>()
    standings.forEach((row, idx) => {
      out.set(row.player.id, computePlayerBadges({
        playerId: row.player.id,
        rank: idx + 1,
        totalPlayers: standings.length,
        scores,
        picks,
        races,
        horsesByRace,
      }))
    })
    return out
  }, [standings, scores, picks, races, horsesByRace])

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-3 animate-pulse">📊</div>
          <p className="text-[var(--text-muted)] text-lg">Loading leaderboard…</p>
        </div>
      </main>
    )
  }

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6 text-center">
        <div>
          <p className="text-[var(--text-primary)] mb-4">{error}</p>
          <Link
            href="/"
            className="inline-block px-6 h-12 leading-[3rem] rounded-full bg-[var(--rose-dark)] border-2 border-[var(--gold)]/60 text-white font-bold"
          >
            Home
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen flex flex-col">
      <WatermarkBG />
      {/* Header */}
      <header className="px-4 py-3 flex items-center justify-between border-b border-[var(--border)] backdrop-blur-sm bg-white/95 gap-3 shadow-sm">
        <Link href="/" className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-sm shrink-0">← Home</Link>
        <div className="text-center min-w-0">
          <h1 className="font-serif text-lg sm:text-xl font-bold text-[var(--text-primary)] leading-tight truncate">
            Leaderboard
          </h1>
          <div className="text-[var(--rose-dark)] text-xs truncate font-medium">
            {event?.name ?? 'Live event'} • {standings.length} players
          </div>
        </div>
        <Link href="/track" className="text-[var(--rose-dark)] hover:text-[var(--rose-dark)]/80 text-sm font-semibold shrink-0">
          🏁 Track
        </Link>
      </header>

      {/* Standings */}
      <section className="flex-1 px-4 py-4">
        <div className="max-w-2xl mx-auto">
          {standings.length === 0 ? (
            <div className="bg-white border border-[var(--border)] rounded-xl p-6 text-center text-[var(--text-muted)] shadow-sm">
              No players yet — share the join link!
            </div>
          ) : (
            <div className="rounded-xl border border-[var(--border)] bg-white overflow-hidden shadow-sm">
              {/* Header row */}
              <div className="bg-[var(--bg-primary)] text-[var(--text-muted)] text-[10px] uppercase tracking-wider px-3 py-2 grid grid-cols-[24px_1fr_56px_30px_30px_30px] gap-2 items-center font-bold">
                <span>#</span>
                <span>Player</span>
                <span className="text-right text-[var(--rose-dark)]">Score</span>
                <span className="text-center text-[var(--success)]" title="Win picks correct">W</span>
                <span className="text-center text-[var(--gold)]" title="Place picks correct">P</span>
                <span className="text-center" title="Show picks correct">S</span>
              </div>
              {/* Rows */}
              {standings.map((row, idx) => {
                const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : null
                const isExpanded = expandedPlayerId === row.player.id
                return (
                  <div key={row.player.id}>
                    <button
                      type="button"
                      onClick={() => setExpandedPlayerId(prev => prev === row.player.id ? null : row.player.id)}
                      aria-expanded={isExpanded}
                      className={`w-full text-left px-3 py-2.5 grid grid-cols-[24px_1fr_56px_30px_30px_30px] gap-2 items-center border-t border-[var(--border)] transition-colors hover:bg-[var(--bg-card-hover)] ${
                        idx === 0 ? 'bg-amber-50' : ''
                      } ${isExpanded ? 'bg-[var(--bg-card-hover)]' : ''}`}
                    >
                      <span className="text-[var(--text-muted)] font-bold text-sm">{idx + 1}</span>
                      <div className="flex items-center gap-2 min-w-0">
                        <AvatarIcon id={row.player.avatar} className="w-9 h-9 rounded shrink-0" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[var(--text-primary)] font-semibold truncate">{row.player.name}</span>
                            {medal && <span className="shrink-0 text-base">{medal}</span>}
                            {(badgesByPlayerId.get(row.player.id) ?? []).map(b => (
                              <span
                                key={b.label}
                                title={b.label}
                                className={`shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold border ${b.cls}`}
                              >
                                <span aria-hidden>{b.emoji}</span>
                                <span>{b.label}</span>
                              </span>
                            ))}
                          </div>
                          <span className="text-[10px] text-[var(--text-muted)] font-medium">
                            {isExpanded ? '▴ hide details' : '▾ details'}
                          </span>
                        </div>
                      </div>
                      <span className="text-[var(--rose-dark)] font-bold text-lg text-right tabular-nums">
                        {row.total}
                      </span>
                      <span className="text-center text-[var(--success)] font-mono text-sm">{row.wins}</span>
                      <span className="text-center text-[var(--gold)] font-mono text-sm">{row.places}</span>
                      <span className="text-center text-[var(--text-muted)] font-mono text-sm">{row.shows}</span>
                    </button>
                    <AnimatePresence initial={false}>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.22, ease: 'easeOut' }}
                          className="overflow-hidden bg-[var(--bg-primary)] border-t border-[var(--border)]"
                        >
                          <div className="px-4 py-3">
                            <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-bold mb-2">
                              Race-by-race
                            </div>
                            <div className="grid grid-cols-[repeat(auto-fill,minmax(80px,1fr))] gap-1.5">
                              {races.map(r => {
                                const revealed = effectiveRevealed.has(r.id)
                                const sc = revealed
                                  ? scores.find(s => s.player_id === row.player.id && s.race_id === r.id)
                                  : null
                                const points = sc?.final_points
                                const hasPoints = typeof points === 'number'
                                const bonus = sc?.bonus_points ?? 0
                                const positive = hasPoints && points > 0
                                const zero = hasPoints && points === 0
                                // Pull this player's pick + horse numbers for the W·P·S strip below
                                // the points. Use '—' for any slot they left empty.
                                const pk = picks.find(p => p.player_id === row.player.id && p.race_id === r.id)
                                const horseList = horsesByRace[r.id] ?? []
                                const numFor = (id: string | null | undefined) =>
                                  id ? (horseList.find(h => h.id === id)?.number ?? '—') : '—'
                                const wps = pk
                                  ? `${numFor(pk.win_horse_id)}·${numFor(pk.place_horse_id)}·${numFor(pk.show_horse_id)}`
                                  : null
                                // Power-play bubble — players.multiplier_*x_race_id flags which race
                                // they spent each token on. Show the higher one (×3) when both happen
                                // to land on the same race.
                                const powerPlay = row.player.multiplier_3x_race_id === r.id
                                  ? '×3'
                                  : row.player.multiplier_2x_race_id === r.id
                                    ? '×2'
                                    : null
                                const display = hasPoints
                                  ? (points > 0 ? `+${points}` : `${points}`)
                                  : '—'
                                const titleParts = [`Race ${r.race_number}`]
                                if (wps) titleParts.push(`Picks ${wps}`)
                                if (hasPoints) titleParts.push(`${display} pts`)
                                if (bonus > 0) titleParts.push(`includes +${bonus} bonus`)
                                if (powerPlay) titleParts.push(`Power Play ${powerPlay}`)
                                return (
                                  <div
                                    key={r.id}
                                    title={titleParts.join(' · ')}
                                    className={`relative flex flex-col items-center justify-center rounded-lg py-1.5 px-1 text-center border ${
                                      positive
                                        ? 'bg-amber-50 border-[var(--gold)]/50'
                                        : zero
                                          ? 'bg-white border-[var(--border)]'
                                          : 'bg-white/40 border-[var(--border)]'
                                    }`}
                                  >
                                    <span className="text-[10px] text-[var(--text-muted)] font-bold">R{r.race_number}</span>
                                    <span className={`text-sm font-bold tabular-nums leading-tight ${
                                      positive
                                        ? 'text-[var(--gold)]'
                                        : zero
                                          ? 'text-[var(--text-primary)]'
                                          : 'text-[var(--text-muted)]/60'
                                    }`}>{display}</span>
                                    <span className={`text-[9px] font-mono tabular-nums leading-tight ${
                                      wps ? 'text-[var(--text-muted)]' : 'text-[var(--text-muted)]/40'
                                    }`}>
                                      {wps ?? '—·—·—'}
                                    </span>
                                    {bonus > 0 && (
                                      <span className="absolute -top-1 -right-1 text-[8px]" aria-label="bonus">✨</span>
                                    )}
                                    {powerPlay && (
                                      <span
                                        className="absolute -top-1.5 -left-1.5 inline-flex items-center justify-center min-w-[20px] h-[14px] px-1 rounded-full bg-[var(--gold)] text-white text-[8px] font-extrabold leading-none border border-white shadow-sm"
                                        aria-label={`Power play ${powerPlay}`}
                                      >
                                        {powerPlay}
                                      </span>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                            <div className="mt-3 pt-2 border-t border-[var(--border)] flex items-center justify-between">
                              <span className="text-[11px] text-[var(--text-muted)] uppercase tracking-wider font-bold">Total</span>
                              <span className="text-[var(--rose-dark)] font-bold text-lg tabular-nums">{row.total}</span>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </section>

      {/* Powered by Watch Party — pb-20 clears the fixed bottom nav */}
      <div className="flex justify-center mt-8 pb-20 px-4">
        <WatchPartyBadge />
      </div>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 border-t-2 border-[var(--rose-dark)]/30 backdrop-blur-sm z-10 shadow-[0_-2px_8px_rgba(0,0,0,0.05)]">
        <div className="max-w-2xl mx-auto flex">
          <NavTab href="/" label="Home" icon="🏠" active={false} />
          <NavTab href="/track" label="Live Track" icon="🏁" active={false} />
          <NavTab href="/leaderboard" label="Leaderboard" icon="📊" active={true} />
        </div>
      </nav>
    </main>
  )
}

function NavTab({ href, label, icon, active }: { href: string; label: string; icon: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`flex-1 py-3.5 text-center text-sm font-semibold transition-colors ${
        active ? 'text-[var(--rose-dark)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
      }`}
    >
      <div className="flex flex-col items-center gap-0.5 leading-none">
        {active && <span className="block w-1 h-1 rounded-full bg-[var(--rose-dark)] mb-0.5" />}
        <span className="text-lg">{icon}</span>
        <span className="text-[10px] uppercase tracking-wide">{label}</span>
      </div>
    </Link>
  )
}
