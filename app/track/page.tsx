'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { getAvatar, AvatarIcon } from '@/lib/avatars'
import type { Event, Race, Player, Score } from '@/lib/types'

// Track geometry (SVG viewBox 0 0 800 400)
const CX = 400
const CY = 200
const RX_OUTER = 360
const RY_OUTER = 175
const RX_INNER = 280
const RY_INNER = 115
const RX_MID = (RX_OUTER + RX_INNER) / 2
const RY_MID = (RY_OUTER + RY_INNER) / 2

function positionOnOval(percent: number, laneOffset = 0) {
  // percent 0..1 around the oval, starting at right (0°), going clockwise in SVG
  const angle = percent * Math.PI * 2
  const rx = RX_MID + laneOffset
  const ry = RY_MID + laneOffset * (RY_MID / RX_MID)
  const x = CX + rx * Math.cos(angle)
  const y = CY + ry * Math.sin(angle)
  return { x, y, angle }
}

export default function TrackPage() {
  const [event, setEvent] = useState<Event | null>(null)
  const [races, setRaces] = useState<Race[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [scores, setScores] = useState<Score[]>([])
  const [revealedRaces, setRevealedRaces] = useState<Set<string>>(new Set())
  const [confettiKey, setConfettiKey] = useState(0)
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function loadAll() {
    try {
      const { data: events } = await supabase
        .from('events')
        .select('*')
        .eq('status', 'active')
        .order('date', { ascending: false })
        .limit(1)
      const evt = events?.[0]
      if (!evt) {
        setError("No event is active right now.")
        setLoading(false)
        return
      }
      setEvent(evt)

      const [racesQ, playersQ, scoresQ] = await Promise.all([
        supabase.from('races').select('*').eq('event_id', evt.id).order('race_number'),
        supabase.from('players').select('*').eq('event_id', evt.id),
        supabase.from('scores').select('*').eq('event_id', evt.id),
      ])
      setRaces(racesQ.data ?? [])
      setPlayers(playersQ.data ?? [])
      setScores(scoresQ.data ?? [])
    } catch (e) {
      console.error(e)
      setError("Couldn't load the live track.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadAll()
  }, [])

  // Realtime
  useEffect(() => {
    if (!event) return
    const channel = supabase
      .channel(`track-${event.id}`)
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
        // Trigger confetti if it's the featured race
        const race = races.find(r => r.id === payload.race_id)
        if (race?.is_featured) setConfettiKey(k => k + 1)
      })
      .subscribe()

    return () => { void supabase.removeChannel(channel) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event?.id, races])

  // Effective revealed: in auto mode every race is implicitly revealed
  const effectiveRevealed = useMemo(() => {
    if (event?.score_reveal_mode === 'auto') return new Set(races.map(r => r.id))
    return revealedRaces
  }, [event?.score_reveal_mode, races, revealedRaces])

  // Compute player progress (0..1) for the track.
  // Use cumulative score / theoretical max possible across all revealed races.
  const standings = useMemo(() => {
    const playerScores: { player: Player; total: number }[] = players.map(p => ({
      player: p,
      total: scores
        .filter(s => s.player_id === p.id && effectiveRevealed.has(s.race_id))
        .reduce((sum, s) => sum + (s.final_points || 0), 0),
    }))

    // Theoretical max per race: base 10 × featured_multiplier × max token (3)
    const ceilPoints = races.reduce((sum, r) => {
      if (!effectiveRevealed.has(r.id)) return sum
      return sum + 10 * (r.featured_multiplier || 1) * 3
    }, 0)
    const denom = Math.max(ceilPoints, 60)

    const sorted = [...playerScores].sort((a, b) => b.total - a.total)
    return sorted.map((row, idx) => ({
      ...row,
      rank: idx + 1,
      // Cap at 0.95 so the leader doesn't sit on the start line.
      percent: Math.min(0.95, row.total / denom),
    }))
  }, [players, scores, effectiveRevealed, races])

  // Group players whose track positions are within ~3% of each other and offset them
  const positionedPlayers = useMemo(() => {
    const sorted = [...standings].sort((a, b) => a.percent - b.percent)
    const result: Array<typeof standings[number] & { laneOffset: number }> = []
    for (let i = 0; i < sorted.length; i++) {
      let laneOffset = 0
      // Look back to find clusters
      let cluster = 0
      for (let j = i - 1; j >= 0; j--) {
        if (Math.abs(sorted[i].percent - sorted[j].percent) < 0.025) cluster++
        else break
      }
      laneOffset = cluster * 22 - (cluster > 0 ? 11 : 0)
      result.push({ ...sorted[i], laneOffset })
    }
    return result
  }, [standings])

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-3 animate-pulse">🏁</div>
          <p className="text-white/70 text-lg">Setting the field...</p>
        </div>
      </main>
    )
  }

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6 text-center">
        <div>
          <p className="text-white/80 mb-4">{error}</p>
          <Link href="/" className="inline-block px-6 h-12 leading-[3rem] rounded-full bg-[var(--rose-dark)] border-2 border-[var(--gold)]/60 text-white font-bold">
            Home
          </Link>
        </div>
      </main>
    )
  }

  const totalRevealed = races.filter(r => effectiveRevealed.has(r.id)).length
  const totalRaces = races.length
  const leader = positionedPlayers.length > 0 ? [...positionedPlayers].sort((a, b) => b.total - a.total)[0] : null

  return (
    <main className="min-h-screen flex flex-col bg-derby">
      {/* Top header */}
      <header className="px-4 py-3 flex items-center justify-between border-b border-white/10 backdrop-blur-sm bg-black/30">
        <Link href="/" className="text-white/60 hover:text-white text-sm">← Home</Link>
        <div className="text-center">
          <h1 className="font-serif text-lg sm:text-xl font-bold text-white leading-tight">{event?.name ?? 'Live Track'}</h1>
          <div className="text-[var(--gold)]/80 text-xs">
            {totalRevealed}/{totalRaces} races • {players.length} players
          </div>
        </div>
        <Link href="/picks" className="text-[var(--gold)] hover:text-[var(--gold)]/80 text-sm font-semibold">My Picks</Link>
      </header>

      {/* Rotate hint for portrait */}
      <div className="sm:hidden px-4 py-2 bg-amber-500/15 text-amber-200 text-xs text-center landscape:hidden">
        💡 Rotate your phone for the best view
      </div>

      {/* Track SVG */}
      <div className="flex-1 flex items-center justify-center p-2 sm:p-4 relative">
        <svg
          viewBox="0 0 800 400"
          preserveAspectRatio="xMidYMid meet"
          className="w-full h-full max-h-[70vh]"
        >
          <defs>
            <radialGradient id="infield" cx="50%" cy="50%" r="60%">
              <stop offset="0%" stopColor="#2d6749" />
              <stop offset="100%" stopColor="#143b2a" />
            </radialGradient>
            <linearGradient id="dirt" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#a06a4a" />
              <stop offset="100%" stopColor="#6e4530" />
            </linearGradient>
            <filter id="avatar-shadow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity="0.6" />
            </filter>
            {/* Clips a player-token avatar to a circle, scaled to whatever bbox the inner svg has. */}
            <clipPath id="token-clip" clipPathUnits="objectBoundingBox">
              <circle cx="0.5" cy="0.5" r="0.5" />
            </clipPath>
          </defs>

          {/* Outer track surface */}
          <ellipse cx={CX} cy={CY} rx={RX_OUTER} ry={RY_OUTER} fill="url(#dirt)" stroke="#FFFFFF" strokeWidth="2" />
          {/* Infield grass */}
          <ellipse cx={CX} cy={CY} rx={RX_INNER} ry={RY_INNER} fill="url(#infield)" stroke="#FFFFFF" strokeWidth="2" />

          {/* Lane markers (dashed white inner) */}
          <ellipse cx={CX} cy={CY} rx={RX_MID} ry={RY_MID} fill="none" stroke="#FFFFFF" strokeOpacity="0.2" strokeWidth="1" strokeDasharray="6 8" />

          {/* Start/finish line at right */}
          <line x1={CX + RX_INNER} y1={CY} x2={CX + RX_OUTER} y2={CY} stroke="#FFFFFF" strokeWidth="3" strokeDasharray="4 4" />
          <text x={CX + RX_OUTER + 8} y={CY + 4} fontSize="14" fill="#FFFFFF" fontFamily="serif" fontWeight="bold">START / FINISH</text>

          {/* Roses in infield */}
          <text x={CX} y={CY - 10} fontSize="60" textAnchor="middle" opacity="0.15">🌹</text>
          <text x={CX} y={CY + 50} fontSize="22" textAnchor="middle" fill="#C9A84C" fontFamily="serif" fontStyle="italic" fontWeight="bold">
            {event?.track ?? 'Churchill Downs'}
          </text>
          <text x={CX} y={CY + 75} fontSize="14" textAnchor="middle" fill="#F5EDD6" opacity="0.6" fontFamily="serif">
            {event?.location ?? 'Louisville, KY'}
          </text>

          {/* Player tokens */}
          {positionedPlayers.map((row) => {
            const pos = positionOnOval(row.percent, row.laneOffset)
            return (
              <PlayerToken
                key={row.player.id}
                pos={pos}
                player={row.player}
                isLeader={leader?.player.id === row.player.id}
                onTap={() => setSelectedPlayer(row.player.id)}
              />
            )
          })}
        </svg>

        {/* Confetti */}
        <AnimatePresence>
          {confettiKey > 0 && <Confetti key={confettiKey} />}
        </AnimatePresence>
      </div>

      {/* Mini leaderboard */}
      <footer className="border-t border-white/10 bg-black/40 backdrop-blur-sm">
        <div className="overflow-x-auto no-scrollbar">
          <div className="flex gap-2 px-3 py-3 min-w-max">
            {[...standings].sort((a, b) => b.total - a.total).slice(0, 10).map((row, idx) => {
              const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : null
              return (
                <button
                  key={row.player.id}
                  onClick={() => setSelectedPlayer(row.player.id)}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-full border border-white/15 bg-white/5 hover:bg-white/10 text-sm shrink-0"
                >
                  <AvatarIcon id={row.player.avatar} className="w-7 h-7 rounded-full" />
                  <span className="text-white font-semibold">{row.player.name}</span>
                  <span className="text-[var(--gold)] font-bold">{row.total}</span>
                  {medal && <span>{medal}</span>}
                </button>
              )
            })}
            {standings.length === 0 && (
              <div className="px-3 py-2 text-white/60 text-sm">No players yet — share the join link!</div>
            )}
          </div>
        </div>
      </footer>

      {/* Player popup */}
      <AnimatePresence>
        {selectedPlayer && (() => {
          const row = standings.find(r => r.player.id === selectedPlayer)
          if (!row) return null
          return (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setSelectedPlayer(null)}
              className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-6"
            >
              <motion.div
                initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
                onClick={e => e.stopPropagation()}
                className="bg-[var(--dark)] border-2 border-[var(--gold)]/50 rounded-2xl p-6 text-center max-w-sm w-full"
              >
                <AvatarIcon id={row.player.avatar} className="w-24 h-24 mx-auto mb-2 rounded-2xl shadow-lg" />
                <h3 className="font-serif text-2xl font-bold text-white">{row.player.name}</h3>
                <div className="flex items-center justify-around mt-4">
                  <div>
                    <div className="text-[var(--gold)] text-3xl font-bold">{row.total}</div>
                    <div className="text-white/60 text-xs uppercase">Points</div>
                  </div>
                  <div>
                    <div className="text-[var(--gold)] text-3xl font-bold">#{row.rank}</div>
                    <div className="text-white/60 text-xs uppercase">Rank</div>
                  </div>
                </div>
                <button onClick={() => setSelectedPlayer(null)} className="mt-5 px-6 h-11 rounded-full border-2 border-white/20 text-white font-semibold">
                  Close
                </button>
              </motion.div>
            </motion.div>
          )
        })()}
      </AnimatePresence>
    </main>
  )
}

function PlayerToken({
  pos, player, isLeader, onTap,
}: {
  pos: { x: number; y: number; angle: number }
  player: Player
  isLeader: boolean
  onTap: () => void
}) {
  const av = getAvatar(player.avatar)
  return (
    <motion.g
      initial={false}
      animate={{ x: pos.x, y: pos.y }}
      transition={{ type: 'spring', stiffness: 60, damping: 18 }}
      style={{ cursor: 'pointer' }}
      onClick={onTap}
      filter="url(#avatar-shadow)"
    >
      {isLeader && (
        <circle cx="0" cy="0" r="22" fill="none" stroke="#C9A84C" strokeWidth="2.5" opacity="0.9">
          <animate attributeName="r" values="20;26;20" dur="1.6s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.9;0.3;0.9" dur="1.6s" repeatCount="indefinite" />
        </circle>
      )}
      <circle cx="0" cy="0" r="17" fill={isLeader ? '#C9A84C' : '#8B1A2F'} />
      {/* Avatar art rendered as a nested SVG, clipped to a circle. */}
      <svg
        x="-15"
        y="-15"
        width="30"
        height="30"
        viewBox="0 0 60 60"
        clipPath="url(#token-clip)"
        dangerouslySetInnerHTML={{ __html: av.svg }}
      />
      <circle cx="0" cy="0" r="15" fill="none" stroke="#FFFFFF" strokeWidth="2" pointerEvents="none" />
      <text x="0" y="-22" fontSize="11" fill="#FFFFFF" textAnchor="middle" fontWeight="bold" stroke="#000" strokeWidth="2.5" paintOrder="stroke">
        {player.name}
      </text>
    </motion.g>
  )
}

function Confetti() {
  // Deterministic pseudo-random keeps render pure but still looks chaotic.
  const [pieces] = useState(() => {
    const rand = (seed: number) => {
      const x = Math.sin(seed * 9301 + 49297) * 233280
      return x - Math.floor(x)
    }
    const colors = ['#8B1A2F', '#C9A84C', '#F5EDD6', '#1B4332', '#FFFFFF']
    return Array.from({ length: 80 }).map((_, i) => ({
      id: i,
      x: rand(i + 1) * 100,
      delay: rand(i + 17) * 1.5,
      duration: 2.5 + rand(i + 31) * 2,
      color: colors[Math.floor(rand(i + 53) * colors.length)],
      size: 6 + rand(i + 73) * 10,
      rotate: (rand(i + 97) - 0.5) * 720,
      drift: (rand(i + 113) - 0.5) * 200,
      round: rand(i + 131) > 0.5,
    }))
  })

  return (
    <div className="fixed inset-0 pointer-events-none z-40 overflow-hidden">
      {pieces.map(p => (
        <motion.div
          key={p.id}
          initial={{ x: 0, y: -20, rotate: 0, opacity: 1 }}
          animate={{ x: p.drift, y: '100vh', rotate: p.rotate, opacity: [1, 1, 0] }}
          transition={{ duration: p.duration, delay: p.delay, ease: 'linear' }}
          style={{
            position: 'absolute',
            left: `${p.x}%`,
            top: 0,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            borderRadius: p.round ? '50%' : '2px',
          }}
        />
      ))}
    </div>
  )
}
