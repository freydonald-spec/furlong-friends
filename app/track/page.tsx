'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { getAvatar, AvatarIcon } from '@/lib/avatars'
import type { Event, Race, Player, Score } from '@/lib/types'

// ─── Stadium track geometry (SVG viewBox 0 0 800 280) ──────────────────────
// The track is a horizontal stadium: long straight sides + tight semicircle ends.
// All numbers are in viewBox units.
const VIEWBOX_W = 800
const VIEWBOX_H = 280

const STRAIGHT_X_START = 200          // left end of straight portion
const STRAIGHT_X_END = 600            // right end of straight portion
const TRACK_CY = 140                  // vertical center of the track

const OUTER_R = 120                   // outer rail radius (semicircles)
const INNER_R = 60                    // inner rail radius
const PATH_R = 90                     // mid-track path radius (avatars travel here)

// Y coordinates of the straight rails / path
const OUTER_TOP_Y = TRACK_CY - OUTER_R   // 20
const OUTER_BOT_Y = TRACK_CY + OUTER_R   // 260
const INNER_TOP_Y = TRACK_CY - INNER_R   // 80
const INNER_BOT_Y = TRACK_CY + INNER_R   // 200
const PATH_TOP_Y  = TRACK_CY - PATH_R    // 50
const PATH_BOT_Y  = TRACK_CY + PATH_R    // 230

const STRAIGHT_LEN = STRAIGHT_X_END - STRAIGHT_X_START   // 400
const ARC_LEN = Math.PI * PATH_R                          // ≈ 282.7
// Path follows: bottom (L→R) + right semicircle + top (R→L) + left semicircle + bottom (L→R) again
// 1¼ laps so START and FINISH end up at distinct points on the home stretch.
const TOTAL_LEN = 3 * STRAIGHT_LEN + 2 * ARC_LEN          // ≈ 1765.5

/**
 * Maps race progress (0..1) to an (x, y) point on the stadium path.
 * `vOffset` shifts the avatar perpendicular to the track (radially on curves,
 * vertically on straights). Positive offset = away from infield.
 */
function positionAt(progress: number, vOffset = 0): { x: number; y: number } {
  const p = Math.max(0, Math.min(1, progress))
  let d = p * TOTAL_LEN

  // 1. Bottom straight (left → right)
  if (d <= STRAIGHT_LEN) {
    return { x: STRAIGHT_X_START + d, y: PATH_BOT_Y + vOffset }
  }
  d -= STRAIGHT_LEN

  // 2. Right semicircle clockwise: (600, 230) → (600, 50)
  if (d <= ARC_LEN) {
    const u = d / PATH_R
    const r = PATH_R + vOffset
    return {
      x: STRAIGHT_X_END + r * Math.sin(u),
      y: TRACK_CY + r * Math.cos(u),
    }
  }
  d -= ARC_LEN

  // 3. Top straight (right → left)
  if (d <= STRAIGHT_LEN) {
    return { x: STRAIGHT_X_END - d, y: PATH_TOP_Y - vOffset }
  }
  d -= STRAIGHT_LEN

  // 4. Left semicircle clockwise: (200, 50) → (200, 230)
  if (d <= ARC_LEN) {
    const u = d / PATH_R
    const r = PATH_R + vOffset
    return {
      x: STRAIGHT_X_START - r * Math.sin(u),
      y: TRACK_CY - r * Math.cos(u),
    }
  }
  d -= ARC_LEN

  // 5. Bottom straight again to FINISH at (600, 230)
  return { x: STRAIGHT_X_START + d, y: PATH_BOT_Y + vOffset }
}

// SVG path strings for the stadium rails (used for filled regions and outline strokes)
const OUTER_RAIL_D =
  `M ${STRAIGHT_X_START} ${OUTER_TOP_Y}` +
  ` L ${STRAIGHT_X_END} ${OUTER_TOP_Y}` +
  ` A ${OUTER_R} ${OUTER_R} 0 0 1 ${STRAIGHT_X_END} ${OUTER_BOT_Y}` +
  ` L ${STRAIGHT_X_START} ${OUTER_BOT_Y}` +
  ` A ${OUTER_R} ${OUTER_R} 0 0 1 ${STRAIGHT_X_START} ${OUTER_TOP_Y} Z`

const INNER_RAIL_D =
  `M ${STRAIGHT_X_START} ${INNER_TOP_Y}` +
  ` L ${STRAIGHT_X_END} ${INNER_TOP_Y}` +
  ` A ${INNER_R} ${INNER_R} 0 0 1 ${STRAIGHT_X_END} ${INNER_BOT_Y}` +
  ` L ${STRAIGHT_X_START} ${INNER_BOT_Y}` +
  ` A ${INNER_R} ${INNER_R} 0 0 1 ${STRAIGHT_X_START} ${INNER_TOP_Y} Z`

const CENTER_LANE_D =
  `M ${STRAIGHT_X_START} ${PATH_TOP_Y}` +
  ` L ${STRAIGHT_X_END} ${PATH_TOP_Y}` +
  ` A ${PATH_R} ${PATH_R} 0 0 1 ${STRAIGHT_X_END} ${PATH_BOT_Y}` +
  ` L ${STRAIGHT_X_START} ${PATH_BOT_Y}` +
  ` A ${PATH_R} ${PATH_R} 0 0 1 ${STRAIGHT_X_START} ${PATH_TOP_Y} Z`

// ─── Component ─────────────────────────────────────────────────────────────

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
      })
      .subscribe()

    return () => { void supabase.removeChannel(channel) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event?.id])

  // In auto-reveal mode every race counts as revealed.
  const effectiveRevealed = useMemo(() => {
    if (event?.score_reveal_mode === 'auto') return new Set(races.map(r => r.id))
    return revealedRaces
  }, [event?.score_reveal_mode, races, revealedRaces])

  // Race progress: completedRaces / totalRaces
  const totalRaces = races.length
  const completedRaces = useMemo(
    () => races.filter(r => r.status === 'finished' && effectiveRevealed.has(r.id)).length,
    [races, effectiveRevealed]
  )
  const raceProgress = totalRaces > 0 ? completedRaces / totalRaces : 0

  // Standings (with totals counted only against revealed races)
  const standings = useMemo(() => {
    const rows = players.map(p => ({
      player: p,
      total: scores
        .filter(s => s.player_id === p.id && effectiveRevealed.has(s.race_id))
        .reduce((sum, s) => sum + (s.final_points || 0), 0),
    }))
    return rows.sort((a, b) => b.total - a.total)
  }, [players, scores, effectiveRevealed])

  const leaderScore = standings[0]?.total ?? 0

  // Map each player to a track progress.
  // Top scorer anchors near (but never at) the finish line; everyone else
  // is positioned proportionally behind based on their share of the leader's
  // score. This guarantees no one ever completes a full loop or overlaps
  // with players still near the start.
  const LEADER_ANCHOR = 0.92
  const playersOnTrack = useMemo(() => {
    return standings.map((row, idx) => {
      let trackProgress: number
      if (leaderScore <= 0) trackProgress = 0
      else trackProgress = LEADER_ANCHOR * (row.total / leaderScore)
      trackProgress = Math.max(0, Math.min(LEADER_ANCHOR, trackProgress))
      return { ...row, rank: idx + 1, trackProgress }
    })
  }, [standings, leaderScore])

  // When two avatars are within ~1.5% of each other on the track, stagger them
  // a few units perpendicular to the path so they don't fully overlap.
  const positionedPlayers = useMemo(() => {
    // Sort by progress so we can detect adjacent runs of similar values.
    const sorted = [...playersOnTrack].sort((a, b) => a.trackProgress - b.trackProgress)
    const out = sorted.map((row, i) => {
      // Offset rotates within a small cluster
      let cluster = 0
      for (let j = i - 1; j >= 0; j--) {
        if (Math.abs(sorted[i].trackProgress - sorted[j].trackProgress) < 0.015) cluster++
        else break
      }
      // Alternate pattern: 0, +12, -12, +24, -24 ...
      const sign = cluster % 2 === 0 ? 1 : -1
      const magnitude = Math.ceil(cluster / 2) * 12
      return { ...row, vOffset: cluster === 0 ? 0 : sign * magnitude }
    })
    return out
  }, [playersOnTrack])

  // Derby finish trigger: when raceProgress crosses 1.0, fire confetti + open winner popup
  const finishedRef = useRef(false)
  useEffect(() => {
    if (raceProgress < 1) {
      finishedRef.current = false
      return
    }
    if (finishedRef.current) return
    if (positionedPlayers.length === 0) return
    finishedRef.current = true
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setConfettiKey(k => k + 1)
    const winner = [...positionedPlayers].sort((a, b) => b.total - a.total)[0]
    setSelectedPlayer(winner.player.id)
  }, [raceProgress, positionedPlayers])

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

  const leader = positionedPlayers.length > 0 ? [...positionedPlayers].sort((a, b) => b.total - a.total)[0] : null

  return (
    <main className="min-h-screen flex flex-col bg-derby">
      {/* Top header */}
      <header className="px-4 py-3 flex items-center justify-between border-b border-white/10 backdrop-blur-sm bg-black/30">
        <Link href="/" className="text-white/60 hover:text-white text-sm">← Home</Link>
        <div className="text-center">
          <h1 className="font-serif text-lg sm:text-xl font-bold text-white leading-tight">{event?.name ?? 'Live Track'}</h1>
          <div className="text-[var(--gold)]/80 text-xs">
            {completedRaces}/{totalRaces} races • {players.length} players
          </div>
        </div>
        <Link href="/picks" className="text-[var(--gold)] hover:text-[var(--gold)]/80 text-sm font-semibold">My Picks</Link>
      </header>

      {/* Track SVG */}
      <div className="flex-1 flex items-center justify-center p-2 sm:p-4 bg-black relative">
        <svg
          viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`}
          preserveAspectRatio="xMidYMid meet"
          className="w-full h-full max-h-[70vh]"
        >
          <defs>
            <radialGradient id="infieldGrass" cx="50%" cy="50%" r="60%">
              <stop offset="0%" stopColor="#2d6749" />
              <stop offset="100%" stopColor="#143b2a" />
            </radialGradient>
            <linearGradient id="dirtSurface" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#c08660" />
              <stop offset="100%" stopColor="#7a4a30" />
            </linearGradient>
            <filter id="tokenShadow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity="0.55" />
            </filter>
            {/* Clips an avatar to a circle (using its bounding box) */}
            <clipPath id="trackTokenClip" clipPathUnits="objectBoundingBox">
              <circle cx="0.5" cy="0.5" r="0.5" />
            </clipPath>
          </defs>

          {/* Dirt racing surface (outer rail filled) */}
          <path d={OUTER_RAIL_D} fill="url(#dirtSurface)" />
          {/* Cut out the infield */}
          <path d={INNER_RAIL_D} fill="url(#infieldGrass)" />

          {/* White outer + inner rails */}
          <path d={OUTER_RAIL_D} fill="none" stroke="#FFFFFF" strokeWidth="2" />
          <path d={INNER_RAIL_D} fill="none" stroke="#FFFFFF" strokeWidth="2" />

          {/* Dashed center lane line along the path */}
          <path
            d={CENTER_LANE_D}
            fill="none"
            stroke="#FFFFFF"
            strokeOpacity="0.55"
            strokeWidth="1.2"
            strokeDasharray="6 6"
          />

          {/* START line and label (bottom-left of home stretch) */}
          <line
            x1={STRAIGHT_X_START + 30}
            y1={INNER_BOT_Y}
            x2={STRAIGHT_X_START + 30}
            y2={OUTER_BOT_Y}
            stroke="#FFFFFF"
            strokeWidth="3"
          />
          <text
            x={STRAIGHT_X_START + 30}
            y={OUTER_BOT_Y + 16}
            fontSize="13"
            fill="#FFFFFF"
            fontFamily="serif"
            fontWeight="bold"
            textAnchor="middle"
          >
            START
          </text>

          {/* FINISH line and label (bottom-right of home stretch) */}
          <line
            x1={STRAIGHT_X_END - 30}
            y1={INNER_BOT_Y}
            x2={STRAIGHT_X_END - 30}
            y2={OUTER_BOT_Y}
            stroke="#FFFFFF"
            strokeWidth="3"
          />
          <text
            x={STRAIGHT_X_END - 30}
            y={OUTER_BOT_Y + 16}
            fontSize="13"
            fill="#FFFFFF"
            fontFamily="serif"
            fontWeight="bold"
            textAnchor="middle"
          >
            FINISH
          </text>

          {/* Decorative roses sprinkled in the infield */}
          <text x={STRAIGHT_X_START + 60} y={TRACK_CY - 10} fontSize="20" opacity="0.18">🌹</text>
          <text x={STRAIGHT_X_END - 70} y={TRACK_CY + 22} fontSize="20" opacity="0.18">🌹</text>

          {/* "Churchill Downs" — gold italic in infield */}
          <text
            x={VIEWBOX_W / 2}
            y={TRACK_CY - 6}
            textAnchor="middle"
            fontFamily="serif"
            fontStyle="italic"
            fontWeight="bold"
            fontSize="22"
            fill="#C9A84C"
          >
            {event?.track || 'Churchill Downs'}
          </text>
          {/* "Louisville, KY" subtitle */}
          <text
            x={VIEWBOX_W / 2}
            y={TRACK_CY + 16}
            textAnchor="middle"
            fontFamily="serif"
            fontSize="11"
            fill="#FFFFFF"
            opacity="0.75"
          >
            {event?.location || 'Louisville, KY'}
          </text>

          {/* Player tokens */}
          {positionedPlayers.map(row => {
            const pos = positionAt(row.trackProgress, row.vOffset)
            const isLeader = leader?.player.id === row.player.id
            return (
              <PlayerToken
                key={row.player.id}
                pos={pos}
                player={row.player}
                isLeader={isLeader}
                showName={positionedPlayers.length <= 12}
                onTap={() => setSelectedPlayer(row.player.id)}
              />
            )
          })}
        </svg>

        {/* Confetti overlay */}
        <AnimatePresence>
          {confettiKey > 0 && <Confetti key={confettiKey} />}
        </AnimatePresence>
      </div>

      {/* Mini leaderboard */}
      <footer className="border-t border-white/10 bg-black/40 backdrop-blur-sm">
        <div className="overflow-x-auto no-scrollbar">
          <div className="flex gap-2 px-3 py-3 min-w-max">
            {standings.slice(0, 12).map((row, idx) => {
              const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : null
              return (
                <button
                  key={row.player.id}
                  onClick={() => setSelectedPlayer(row.player.id)}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-full border border-white/15 bg-white/5 hover:bg-white/10 text-sm shrink-0"
                >
                  <span className="text-white/60 text-xs font-mono w-5 text-right">#{idx + 1}</span>
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
          const row = positionedPlayers.find(r => r.player.id === selectedPlayer)
          if (!row) return null
          const isWinner = raceProgress >= 1 && row === [...positionedPlayers].sort((a, b) => b.total - a.total)[0]
          return (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setSelectedPlayer(null)}
              className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-6"
            >
              <motion.div
                initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
                onClick={e => e.stopPropagation()}
                className={`bg-[var(--dark)] border-2 ${isWinner ? 'border-[var(--gold)]' : 'border-[var(--gold)]/50'} rounded-2xl p-6 text-center max-w-sm w-full ${isWinner ? 'shadow-[0_0_60px_rgba(201,168,76,0.6)]' : ''}`}
              >
                {isWinner && (
                  <div className="text-[var(--gold)] font-serif italic font-extrabold text-3xl mb-2 tracking-wide">
                    🏆 WINNER 🏆
                  </div>
                )}
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

// ─── PlayerToken ────────────────────────────────────────────────────────────

function PlayerToken({
  pos, player, isLeader, showName, onTap,
}: {
  pos: { x: number; y: number }
  player: Player
  isLeader: boolean
  showName: boolean
  onTap: () => void
}) {
  const av = getAvatar(player.avatar)
  return (
    <motion.g
      initial={false}
      animate={{ x: pos.x, y: pos.y }}
      transition={{ type: 'spring', stiffness: 70, damping: 18 }}
      style={{ cursor: 'pointer' }}
      onClick={onTap}
      filter="url(#tokenShadow)"
    >
      {isLeader && (
        <circle cx="0" cy="0" r="20" fill="none" stroke="#C9A84C" strokeWidth="2.5" opacity="0.9">
          <animate attributeName="r" values="18;28;18" dur="1.6s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.9;0.2;0.9" dur="1.6s" repeatCount="indefinite" />
        </circle>
      )}
      <circle cx="0" cy="0" r="15" fill={isLeader ? '#C9A84C' : '#8B1A2F'} />
      <svg
        x="-13"
        y="-13"
        width="26"
        height="26"
        viewBox="0 0 60 60"
        clipPath="url(#trackTokenClip)"
        dangerouslySetInnerHTML={{ __html: av.svg }}
      />
      <circle cx="0" cy="0" r="13" fill="none" stroke="#FFFFFF" strokeWidth="1.8" pointerEvents="none" />
      {showName && (
        <text
          x="0"
          y="-19"
          fontSize="9"
          fill="#FFFFFF"
          textAnchor="middle"
          fontWeight="bold"
          stroke="#000"
          strokeWidth="2"
          paintOrder="stroke"
        >
          {player.name}
        </text>
      )}
    </motion.g>
  )
}

// ─── Confetti ───────────────────────────────────────────────────────────────

function Confetti() {
  const [pieces] = useState(() => {
    const rand = (seed: number) => {
      const x = Math.sin(seed * 9301 + 49297) * 233280
      return x - Math.floor(x)
    }
    const colors = ['#8B1A2F', '#C9A84C', '#F5EDD6', '#1B4332', '#FFFFFF']
    return Array.from({ length: 100 }).map((_, i) => ({
      id: i,
      x: rand(i + 1) * 100,
      delay: rand(i + 17) * 1.5,
      duration: 3 + rand(i + 31) * 2.5,
      color: colors[Math.floor(rand(i + 53) * colors.length)],
      size: 6 + rand(i + 73) * 12,
      rotate: (rand(i + 97) - 0.5) * 720,
      drift: (rand(i + 113) - 0.5) * 240,
      round: rand(i + 131) > 0.5,
    }))
  })

  return (
    <div className="fixed inset-0 pointer-events-none z-40 overflow-hidden">
      {pieces.map(p => (
        <motion.div
          key={p.id}
          initial={{ x: 0, y: -20, rotate: 0, opacity: 1 }}
          animate={{ x: p.drift, y: '110vh', rotate: p.rotate, opacity: [1, 1, 0.8, 0] }}
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
