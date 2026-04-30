'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { AvatarIcon } from '@/lib/avatars'
import { WatchPartyBadge } from '@/lib/watch-party-badge'
import type { Event, Race, Player, Score } from '@/lib/types'

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

        const [racesQ, playersQ, scoresQ] = await Promise.all([
          supabase.from('races').select('*').eq('event_id', evt.id).order('race_number'),
          supabase.from('players').select('*').eq('event_id', evt.id),
          supabase.from('scores').select('*').eq('event_id', evt.id),
        ])
        if (cancelled) return
        setRaces(racesQ.data ?? [])
        setPlayers(playersQ.data ?? [])
        setScores(scoresQ.data ?? [])
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

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-3 animate-pulse">📊</div>
          <p className="text-white/70 text-lg">Loading leaderboard…</p>
        </div>
      </main>
    )
  }

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6 text-center">
        <div>
          <p className="text-white/80 mb-4">{error}</p>
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
      {/* Header */}
      <header className="px-4 py-3 flex items-center justify-between border-b border-white/10 backdrop-blur-sm bg-black/30 gap-3">
        <Link href="/" className="text-white/60 hover:text-white text-sm shrink-0">← Home</Link>
        <div className="text-center min-w-0">
          <h1 className="font-serif text-lg sm:text-xl font-bold text-white leading-tight truncate">
            Leaderboard
          </h1>
          <div className="text-[var(--gold)]/80 text-xs truncate">
            {event?.name ?? 'Live event'} • {standings.length} players
          </div>
        </div>
        <Link href="/track" className="text-[var(--gold)] hover:text-[var(--gold)]/80 text-sm font-semibold shrink-0">
          🏁 Track
        </Link>
      </header>

      {/* Standings */}
      <section className="flex-1 px-4 py-4">
        <div className="max-w-2xl mx-auto">
          {standings.length === 0 ? (
            <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center text-white/60">
              No players yet — share the join link!
            </div>
          ) : (
            <div className="rounded-xl border border-white/15 bg-white/5 overflow-hidden">
              {/* Header row */}
              <div className="bg-black/40 text-white/70 text-[10px] uppercase tracking-wider px-3 py-2 grid grid-cols-[24px_1fr_56px_30px_30px_30px] gap-2 items-center">
                <span>#</span>
                <span>Player</span>
                <span className="text-right text-[var(--gold)]">Score</span>
                <span className="text-center text-emerald-400" title="Win picks correct">W</span>
                <span className="text-center text-amber-300" title="Place picks correct">P</span>
                <span className="text-center text-white/70" title="Show picks correct">S</span>
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
                      className={`w-full text-left px-3 py-2.5 grid grid-cols-[24px_1fr_56px_30px_30px_30px] gap-2 items-center border-t border-white/10 transition-colors hover:bg-white/[0.07] ${
                        idx === 0 ? 'bg-[var(--gold)]/10' : ''
                      } ${isExpanded ? 'bg-white/[0.08]' : ''}`}
                    >
                      <span className="text-white/70 font-bold text-sm">{idx + 1}</span>
                      <div className="flex items-center gap-2 min-w-0">
                        <AvatarIcon id={row.player.avatar} className="w-9 h-9 rounded shrink-0" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1">
                            <span className="text-white font-semibold truncate">{row.player.name}</span>
                            {medal && <span className="shrink-0 text-base">{medal}</span>}
                          </div>
                          <span className="text-[10px] text-white/40 font-medium">
                            {isExpanded ? '▴ hide details' : '▾ details'}
                          </span>
                        </div>
                      </div>
                      <span className="text-[var(--gold)] font-bold text-lg text-right tabular-nums">
                        {row.total}
                      </span>
                      <span className="text-center text-emerald-400 font-mono text-sm">{row.wins}</span>
                      <span className="text-center text-amber-300 font-mono text-sm">{row.places}</span>
                      <span className="text-center text-white/70 font-mono text-sm">{row.shows}</span>
                    </button>
                    <AnimatePresence initial={false}>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.22, ease: 'easeOut' }}
                          className="overflow-hidden bg-black/30 border-t border-white/10"
                        >
                          <div className="px-4 py-3">
                            <div className="text-[10px] uppercase tracking-wider text-white/55 font-bold mb-2">
                              Race-by-race
                            </div>
                            <div className="grid grid-cols-[repeat(auto-fill,minmax(64px,1fr))] gap-1.5">
                              {races.map(r => {
                                const revealed = effectiveRevealed.has(r.id)
                                const sc = revealed
                                  ? scores.find(s => s.player_id === row.player.id && s.race_id === r.id)
                                  : null
                                const points = sc?.final_points
                                const hasPoints = typeof points === 'number'
                                const display = hasPoints
                                  ? (points > 0 ? `+${points}` : `${points}`)
                                  : '—'
                                const positive = hasPoints && points > 0
                                const zero = hasPoints && points === 0
                                return (
                                  <div
                                    key={r.id}
                                    title={`Race ${r.race_number}`}
                                    className={`flex flex-col items-center justify-center rounded-lg py-1.5 text-center border ${
                                      positive
                                        ? 'bg-[var(--gold)]/15 border-[var(--gold)]/50'
                                        : zero
                                          ? 'bg-white/5 border-white/15'
                                          : 'bg-white/[0.03] border-white/10'
                                    }`}
                                  >
                                    <span className="text-[10px] text-white/55 font-bold">R{r.race_number}</span>
                                    <span className={`text-sm font-bold tabular-nums ${
                                      positive
                                        ? 'text-[var(--gold)]'
                                        : zero
                                          ? 'text-white/60'
                                          : 'text-white/35'
                                    }`}>{display}</span>
                                  </div>
                                )
                              })}
                            </div>
                            <div className="mt-3 pt-2 border-t border-white/10 flex items-center justify-between">
                              <span className="text-[11px] text-white/55 uppercase tracking-wider font-bold">Total</span>
                              <span className="text-[var(--gold)] font-bold text-lg tabular-nums">{row.total}</span>
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
      <nav className="fixed bottom-0 left-0 right-0 bg-[var(--dark)]/95 border-t border-white/10 backdrop-blur-sm z-10">
        <div className="max-w-2xl mx-auto flex">
          <Link href="/" className="flex-1 py-3 text-center text-white/60 hover:text-white text-sm">
            🏠 Home
          </Link>
          <Link href="/track" className="flex-1 py-3 text-center text-white/60 hover:text-white text-sm">
            🏁 Live Track
          </Link>
          <Link href="/leaderboard" className="flex-1 py-3 text-center text-[var(--gold)] hover:text-[var(--gold)]/80 text-sm font-semibold">
            📊 Leaderboard
          </Link>
        </div>
      </nav>
    </main>
  )
}
