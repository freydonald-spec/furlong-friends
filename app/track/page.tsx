'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { getAvatar, AvatarIcon } from '@/lib/avatars'
import { WatchPartyBadge } from '@/lib/watch-party-badge'
import type { Event, Race, Player, Score } from '@/lib/types'

// ─── Track geometry (SVG viewBox 0 0 800 280) ─────────────────────────────
// Horizontal oval (long straights + semicircle ends) with a horizontal
// chute that extends right from the top of the oval. The starting gate
// sits at the far-right end of the chute. Race path runs counter-clockwise:
//   gate → chute (R→L) → backstretch (R→L) → far turn (top→bottom via the
//   left semicircle) → homestretch (L→R) → finish line.
// Real Churchill Downs (and all US horse racing) runs counter-clockwise —
// the user's described layout (top-right gate, bottom-right finish, "left
// turn" first) only resolves into a coherent path going CCW. The right
// semicircle of the oval is visual only; the racing path skips it.
const VIEWBOX_W = 800
const VIEWBOX_H = 280

const STRAIGHT_X_START = 170          // left end of straight portion
const STRAIGHT_X_END = 540            // right end of straight portion (oval)
const TRACK_CY = 140                  // vertical center of the oval

const OUTER_R = 110                   // outer rail radius (semicircles)
const INNER_R = 55                    // inner rail radius
// Racing line hugs the INSIDE rail (real horses run the shortest path on the
// inner rail). The path sits one default-token radius (13) outside the inner
// rail so a token at vOffset=0 puts its inner edge right against the rail.
// Cluster offsets (defined further down) are one-sided and push outward from
// here toward the outer rail, never inward into the infield.
const RAIL_HUG_OFFSET = 13
const PATH_R = INNER_R + RAIL_HUG_OFFSET  // 68 — curve racing radius

const OUTER_TOP_Y = TRACK_CY - OUTER_R   // 30
const OUTER_BOT_Y = TRACK_CY + OUTER_R   // 250
const INNER_TOP_Y = TRACK_CY - INNER_R   // 85
const INNER_BOT_Y = TRACK_CY + INNER_R   // 195
const PATH_TOP_Y  = INNER_TOP_Y - RAIL_HUG_OFFSET   // 72 — top straight racing line
const PATH_BOT_Y  = INNER_BOT_Y + RAIL_HUG_OFFSET   // 208 — bottom straight racing line

const STRAIGHT_LEN = STRAIGHT_X_END - STRAIGHT_X_START   // 370
const ARC_LEN = Math.PI * PATH_R                          // ≈ 257.6

// Chute: extends right from the top of the oval. The chute GRAPHIC fills
// x = CHUTE_X_START..CHUTE_X_END; the racing PATH starts at GATE_CENTER_X
// (centered inside the gate, well inside the chute's right edge) so 0-point
// players render IN the gate rather than past it. The two lengths are
// kept separate to avoid the dirt rect getting clipped.
const CHUTE_X_START = STRAIGHT_X_END                      // 540
const CHUTE_X_END = 770                                   // 770 — chute right edge
const CHUTE_LEN = CHUTE_X_END - CHUTE_X_START             // 230 — visual width
const GATE_CENTER_X = CHUTE_X_END - 15                    // 755 — racing path start
const CHUTE_PATH_LEN = GATE_CENTER_X - CHUTE_X_START      // 215 — racing path length

// Race path = chute + backstretch + far turn + homestretch
const TOTAL_LEN = CHUTE_PATH_LEN + STRAIGHT_LEN + ARC_LEN + STRAIGHT_LEN
//              ≈ 215 + 370 + 257.6 + 370 ≈ 1212.6

/**
 * Maps race progress (0..1) to an (x, y) point on the racing path.
 * `vOffset` shifts the avatar perpendicular to the path. Positive offset =
 * outward (away from infield), negative = inward.
 */
function positionAt(progress: number, vOffset = 0): { x: number; y: number } {
  const p = Math.max(0, Math.min(1, progress))
  let d = p * TOTAL_LEN

  // 1. Chute (right→left): from gate center (GATE_CENTER_X) to oval entry (CHUTE_X_START)
  if (d <= CHUTE_PATH_LEN) {
    return { x: GATE_CENTER_X - d, y: PATH_TOP_Y - vOffset }
  }
  d -= CHUTE_PATH_LEN

  // 2. Backstretch / top straight (right→left)
  if (d <= STRAIGHT_LEN) {
    return { x: STRAIGHT_X_END - d, y: PATH_TOP_Y - vOffset }
  }
  d -= STRAIGHT_LEN

  // 3. Far turn / left semicircle (top → bottom via the leftmost point)
  //    At u=0: (STRAIGHT_X_START, PATH_TOP_Y)
  //    At u=π/2: (STRAIGHT_X_START - PATH_R, TRACK_CY)
  //    At u=π: (STRAIGHT_X_START, PATH_BOT_Y)
  if (d <= ARC_LEN) {
    const u = d / PATH_R
    const r = PATH_R + vOffset
    return {
      x: STRAIGHT_X_START - r * Math.sin(u),
      y: TRACK_CY - r * Math.cos(u),
    }
  }
  d -= ARC_LEN

  // 4. Homestretch / bottom straight (left→right) → finish at STRAIGHT_X_END
  return { x: STRAIGHT_X_START + d, y: PATH_BOT_Y + vOffset }
}

// SVG path strings for the rails
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

// Chute outline: top edge → right end cap → bottom edge.
// Left side intentionally open — that's where the chute joins the oval.
const CHUTE_OUTLINE_D =
  `M ${CHUTE_X_START} ${OUTER_TOP_Y}` +
  ` L ${CHUTE_X_END} ${OUTER_TOP_Y}` +
  ` L ${CHUTE_X_END} ${INNER_TOP_Y}` +
  ` L ${CHUTE_X_START} ${INNER_TOP_Y}`

// Center lane (dashed) — only along the racing path (gate center → finish).
// Left arc uses sweep=0 to bulge LEFT (the path goes via the leftmost point).
const CENTER_LANE_D =
  `M ${GATE_CENTER_X} ${PATH_TOP_Y}` +
  ` L ${STRAIGHT_X_START} ${PATH_TOP_Y}` +
  ` A ${PATH_R} ${PATH_R} 0 0 0 ${STRAIGHT_X_START} ${PATH_BOT_Y}` +
  ` L ${STRAIGHT_X_END} ${PATH_BOT_Y}`

// ─── Component ─────────────────────────────────────────────────────────────

export default function TrackPage() {
  const [event, setEvent] = useState<Event | null>(null)
  const [races, setRaces] = useState<Race[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [scores, setScores] = useState<Score[]>([])
  const [revealedRaces, setRevealedRaces] = useState<Set<string>>(new Set())
  // Stagger window: when a `reveal_race` broadcast lands, we briefly turn
  // on a per-player delay (last place first, leader last) so the field
  // resolves in dramatic order. After the longest delay completes we drop
  // back to the normal instant-spring transition.
  const [revealAnimAt, setRevealAnimAt] = useState(0)
  const revealResetRef = useRef<ReturnType<typeof setTimeout> | null>(null)
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
        // Kick off the staggered animation window. 30s is plenty even for
        // a packed field — once it's done positions snap back to the
        // normal zero-delay spring transition.
        setRevealAnimAt(Date.now())
        if (revealResetRef.current) clearTimeout(revealResetRef.current)
        revealResetRef.current = setTimeout(() => setRevealAnimAt(0), 30000)
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

  // The track is divided into N segments where N = total races. The leader's
  // maximum reachable position grows by 1/N each time a race locks or finishes
  // — after race 1 of 9 the leader can be at most 1/9 around the track, after
  // race 5 of 9, 5/9 around, and so on. Everyone else scales proportionally
  // by (score / leaderScore) within that envelope. A 0-point player sits at
  // the starting gate.
  // Note: the envelope tracks "racing has happened" (locked or finished),
  // independent of the host's score-reveal flow which still gates the
  // finale trigger via `raceProgress`.
  const envelopeRaces = useMemo(
    () => races.filter(r => r.status === 'finished' || r.status === 'locked').length,
    [races]
  )
  const maxProgress = totalRaces > 0 ? envelopeRaces / totalRaces : 0
  // Compressed spread: the field bunches together inside the back half of
  // the current envelope. Anyone with even a single point jumps to at least
  // 50% of maxProgress, and the leader sits at maxProgress. This keeps the
  // pack visually dramatic instead of stretched thin in the early races.
  // 0-point players still sit at the gate (progress = 0).
  const playersOnTrack = useMemo(() => {
    const minProgress = maxProgress * 0.5
    return standings.map((row, idx) => {
      let trackProgress: number
      if (row.total <= 0 || leaderScore <= 0) {
        trackProgress = 0
      } else {
        trackProgress = minProgress + (row.total / leaderScore) * (maxProgress - minProgress)
      }
      trackProgress = Math.max(0, Math.min(maxProgress, trackProgress))
      return { ...row, rank: idx + 1, trackProgress }
    })
  }, [standings, leaderScore, maxProgress])

  // Per-player reveal delay. playersOnTrack is sorted by score desc (idx 0 =
  // leader). We want LAST PLACE to animate first (delay 0) and the leader to
  // animate last (delay (N-1)*0.5s) for maximum drama.
  const playerRevealDelays = useMemo(() => {
    const m = new Map<string, number>()
    const N = playersOnTrack.length
    playersOnTrack.forEach((row, idx) => {
      m.set(row.player.id, (N - 1 - idx) * 0.5)
    })
    return m
  }, [playersOnTrack])

  // Compact-token mode kicks in once the field gets crowded — smaller tokens
  // give more room for clustered players to fan out without crashing into
  // each other or the rails.
  const compactTokens = playersOnTrack.length >= 20
  const TOKEN_RADIUS = compactTokens ? 11 : 15

  // Cluster handling:
  //   Up to 4 players sharing ~the same progress fan out perpendicular to
  //   the path. A cluster of 5+ shows the top 3 (by progress, ties broken
  //   by source order) plus a "+N more" badge in the 4th slot.
  //   Offsets are ONE-SIDED — slot 0 sits on the rail-hugging line, every
  //   subsequent slot drifts outward toward the outer rail. The leader
  //   (highest progress in a cluster) always gets the innermost slot.
  //   Threshold 0.015 of TOTAL_LEN (~18 viewBox units along the path) is
  //   tight enough that distinct scores stay separate but tied players
  //   still collapse together.
  const CLUSTER_THRESHOLD = 0.015
  const MAX_VISIBLE_PER_CLUSTER = 4
  const OFFSET_TABLE: Record<number, number[]> = {
    1: [0],
    2: [0, 14],
    3: [0, 11, 22],
    4: [0, 8, 16, 24],
  }
  const { positionedPlayers, clusterOverflows } = useMemo(() => {
    const sorted = [...playersOnTrack].sort((a, b) => a.trackProgress - b.trackProgress)
    const positioned: Array<typeof sorted[number] & { vOffset: number }> = []
    const overflows: Array<{ progress: number; vOffset: number; count: number }> = []

    let i = 0
    while (i < sorted.length) {
      const cluster = [sorted[i]]
      while (
        i + cluster.length < sorted.length &&
        sorted[i + cluster.length].trackProgress - cluster[cluster.length - 1].trackProgress < CLUSTER_THRESHOLD
      ) {
        cluster.push(sorted[i + cluster.length])
      }

      // Reverse so the leader (highest progress) lands in slot 0 = rail.
      const ordered = [...cluster].reverse()

      if (ordered.length <= MAX_VISIBLE_PER_CLUSTER) {
        const offsets = OFFSET_TABLE[ordered.length]
        ordered.forEach((p, k) => positioned.push({ ...p, vOffset: offsets[k] }))
      } else {
        // Top 3 visible on the rail side; "+N more" badge takes slot 3.
        const offsets = OFFSET_TABLE[4]
        ordered.slice(0, 3).forEach((p, k) => positioned.push({ ...p, vOffset: offsets[k] }))
        overflows.push({
          progress: ordered[0].trackProgress,
          vOffset: offsets[3],
          count: ordered.length - 3,
        })
      }

      i += cluster.length
    }

    return { positionedPlayers: positioned, clusterOverflows: overflows }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playersOnTrack])

  // Derby finish trigger: when raceProgress crosses 1.0, fire confetti + open winner popup
  const finishedRef = useRef(false)
  useEffect(() => {
    if (raceProgress < 1) {
      finishedRef.current = false
      return
    }
    if (finishedRef.current) return
    if (playersOnTrack.length === 0) return
    finishedRef.current = true
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setConfettiKey(k => k + 1)
    // playersOnTrack is sorted by total desc (it derives from standings).
    const winner = playersOnTrack[0]
    setSelectedPlayer(winner.player.id)
  }, [raceProgress, playersOnTrack])

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
      <header className="px-4 py-3 flex items-center justify-between border-b border-white/10 backdrop-blur-sm bg-black/30 gap-3">
        <Link href="/" className="text-white/60 hover:text-white text-sm shrink-0">← Home</Link>
        <div className="text-center min-w-0">
          <h1 className="font-serif text-lg sm:text-xl font-bold text-white leading-tight truncate">{event?.name ?? 'Live Track'}</h1>
          <div className="text-[var(--gold)]/80 text-xs truncate">
            {completedRaces}/{totalRaces} races • {players.length} players
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Link href="/leaderboard" className="text-[var(--gold)] hover:text-[var(--gold)]/80 text-sm font-semibold whitespace-nowrap">📊 Leaderboard</Link>
          <Link href="/picks" className="text-[var(--gold)] hover:text-[var(--gold)]/80 text-sm font-semibold whitespace-nowrap">My Picks</Link>
        </div>
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

          {/* Dirt — oval annulus */}
          <path d={OUTER_RAIL_D} fill="url(#dirtSurface)" />
          <path d={INNER_RAIL_D} fill="url(#infieldGrass)" />
          {/* Dirt — chute (rectangle joining the top of the oval) */}
          <rect
            x={CHUTE_X_START}
            y={OUTER_TOP_Y}
            width={CHUTE_LEN}
            height={INNER_TOP_Y - OUTER_TOP_Y}
            fill="url(#dirtSurface)"
          />

          {/* Rails — oval (outer + inner) */}
          <path d={OUTER_RAIL_D} fill="none" stroke="#FFFFFF" strokeWidth="2" />
          <path d={INNER_RAIL_D} fill="none" stroke="#FFFFFF" strokeWidth="2" />
          {/* Rails — chute (top edge + right cap + bottom edge) */}
          <path d={CHUTE_OUTLINE_D} fill="none" stroke="#FFFFFF" strokeWidth="2" />

          {/* Dashed center lane along the racing path */}
          <path
            d={CENTER_LANE_D}
            fill="none"
            stroke="#FFFFFF"
            strokeOpacity="0.55"
            strokeWidth="1.2"
            strokeDasharray="6 6"
          />

          {/* ═══ STARTING GATE — at the far end of the chute ═══ */}
          {/* Top-down view: the gate spans the chute's perpendicular axis
              (vertical in our viewBox) and stalls stack top-to-bottom. Horses
              face LEFT (running direction), so the gold "front bar" is on
              the left edge — that's the door that flies open at the start. */}
          {(() => {
            const gateW = 22
            const gateGapTop = 4
            const gateGapBot = 4
            const gateY = OUTER_TOP_Y + gateGapTop
            const gateH = (INNER_TOP_Y - OUTER_TOP_Y) - gateGapTop - gateGapBot
            const gateX = CHUTE_X_END - gateW - 4
            return (
              <g>
                {/* Gate body — dark frame with gold trim */}
                <rect x={gateX} y={gateY} width={gateW} height={gateH} fill="#1a1a1a" stroke="#C9A84C" strokeWidth="1.4" rx="1.5" />
                {/* Front bar (gold) — on the LEFT, where horses break out */}
                <rect x={gateX - 3} y={gateY - 1.5} width="3" height={gateH + 3} fill="#C9A84C" rx="1" />
                {/* Stall dividers — horizontal lines, splitting the gate into 4 stacked stalls */}
                {[0.25, 0.5, 0.75].map(t => {
                  const y = gateY + gateH * t
                  return <line key={t} x1={gateX + 2} y1={y} x2={gateX + gateW - 2} y2={y} stroke="#FFFFFF" strokeWidth="0.7" opacity="0.85" />
                })}
                {/* Stall numbers — one per row, vertically stacked */}
                {[0.125, 0.375, 0.625, 0.875].map((t, i) => (
                  <text
                    key={t}
                    x={gateX + gateW / 2}
                    y={gateY + gateH * t + 2}
                    fontSize="5"
                    fill="#C9A84C"
                    textAnchor="middle"
                    fontFamily="monospace"
                    fontWeight="bold"
                  >
                    {i + 1}
                  </text>
                ))}
              </g>
            )
          })()}

          {/* "START" label below the gate */}
          <text
            x={CHUTE_X_END - 15}
            y={INNER_TOP_Y + 14}
            fontSize="12"
            fill="#FFFFFF"
            fontFamily="serif"
            fontWeight="bold"
            textAnchor="middle"
          >
            START
          </text>

          {/* ═══ FINISH LINE — at the right end of the homestretch ═══ */}
          {/* White line across the homestretch */}
          <line
            x1={STRAIGHT_X_END}
            y1={INNER_BOT_Y}
            x2={STRAIGHT_X_END}
            y2={OUTER_BOT_Y}
            stroke="#FFFFFF"
            strokeWidth="3"
          />
          {/* Black checker stripes layered on top */}
          <line
            x1={STRAIGHT_X_END}
            y1={INNER_BOT_Y}
            x2={STRAIGHT_X_END}
            y2={OUTER_BOT_Y}
            stroke="#000000"
            strokeWidth="3"
            strokeDasharray="4 4"
          />

          {/* Finish pole on the inside rail */}
          <g transform={`translate(${STRAIGHT_X_END}, ${INNER_BOT_Y})`}>
            {/* Pole — white with red bands (Churchill-style candy stripe) */}
            <rect x="-1.5" y="-34" width="3" height="34" fill="#FFFFFF" stroke="#000" strokeWidth="0.3" />
            <rect x="-1.5" y="-32" width="3" height="5" fill="#C41E3A" />
            <rect x="-1.5" y="-22" width="3" height="5" fill="#C41E3A" />
            <rect x="-1.5" y="-12" width="3" height="5" fill="#C41E3A" />
            {/* Pennant flag at the top */}
            <polygon points="0,-34 12,-31 0,-28" fill="#C9A84C" stroke="#8B1A2F" strokeWidth="0.6" />
            <circle cx="0" cy="-34" r="1.3" fill="#C9A84C" stroke="#8B1A2F" strokeWidth="0.4" />
          </g>

          {/* "FINISH" label on dirt below the line */}
          <text
            x={STRAIGHT_X_END}
            y={OUTER_BOT_Y + 14}
            fontSize="13"
            fill="#FFFFFF"
            fontFamily="serif"
            fontWeight="bold"
            textAnchor="middle"
          >
            FINISH
          </text>

          {/* Decorative roses in the infield */}
          <text x={STRAIGHT_X_START + 50} y={TRACK_CY - 10} fontSize="20" opacity="0.18">🌹</text>
          <text x={STRAIGHT_X_END - 60} y={TRACK_CY + 22} fontSize="20" opacity="0.18">🌹</text>

          {/* Track name (centered in the oval infield, not the canvas) */}
          <text
            x={(STRAIGHT_X_START + STRAIGHT_X_END) / 2}
            y={TRACK_CY - 6}
            textAnchor="middle"
            fontFamily="serif"
            fontStyle="italic"
            fontWeight="bold"
            fontSize="20"
            fill="#C9A84C"
          >
            {event?.track || 'Churchill Downs'}
          </text>
          <text
            x={(STRAIGHT_X_START + STRAIGHT_X_END) / 2}
            y={TRACK_CY + 14}
            textAnchor="middle"
            fontFamily="serif"
            fontSize="10"
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
                showName={!compactTokens && positionedPlayers.length <= 12}
                radius={TOKEN_RADIUS}
                revealDelay={revealAnimAt > 0 ? (playerRevealDelays.get(row.player.id) ?? 0) : 0}
                onTap={() => setSelectedPlayer(row.player.id)}
              />
            )
          })}

          {/* Cluster overflow badges — "+N more" tokens for clusters of 5+ */}
          {clusterOverflows.map((o, i) => {
            const pos = positionAt(o.progress, o.vOffset)
            const r = TOKEN_RADIUS - 3
            return (
              <g
                key={`overflow-${i}`}
                transform={`translate(${pos.x}, ${pos.y})`}
                filter="url(#tokenShadow)"
              >
                <circle cx="0" cy="0" r={r} fill="#1a1a1a" stroke="#C9A84C" strokeWidth="1.4" />
                <text
                  x="0"
                  y={r * 0.35}
                  fontSize={r * 0.85}
                  fontWeight="bold"
                  fill="#C9A84C"
                  textAnchor="middle"
                  fontFamily="monospace"
                >
                  +{o.count}
                </text>
              </g>
            )
          })}
        </svg>

        {/* Confetti overlay */}
        <AnimatePresence>
          {confettiKey > 0 && <Confetti key={confettiKey} />}
        </AnimatePresence>
      </div>

      {/* Mini leaderboard ticker */}
      <LeaderboardTicker standings={standings} onSelect={setSelectedPlayer} />

      {/* Powered by Watch Party */}
      <div className="flex justify-center mt-8 pb-6 px-4">
        <WatchPartyBadge />
      </div>

      {/* Player popup */}
      <AnimatePresence>
        {selectedPlayer && (() => {
          // Look up against playersOnTrack so cluster-overflowed players still
          // open a popup when tapped via the leaderboard.
          const row = playersOnTrack.find(r => r.player.id === selectedPlayer)
          if (!row) return null
          const isWinner = raceProgress >= 1 && row.player.id === playersOnTrack[0]?.player.id
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

// ─── LeaderboardTicker ──────────────────────────────────────────────────────
// Auto-scrolling marquee at the bottom of the track page. Renders the full
// standings list twice so the scroll wraps seamlessly: every animation frame
// nudges scrollLeft forward, and once we've passed the first copy we subtract
// halfWidth (which lands on visually identical content). Pointer interaction
// pauses the auto-scroll for 2s of grace so users can flick to a specific
// player without fighting the marquee.

function LeaderboardTicker({
  standings, onSelect,
}: {
  standings: Array<{ player: Player; total: number }>
  onSelect: (id: string) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const interactingRef = useRef(false)
  const lastInteractionRef = useRef(0)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    let raf = 0
    const tick = () => {
      raf = requestAnimationFrame(tick)
      if (interactingRef.current) return
      if (Date.now() - lastInteractionRef.current < 2000) return
      const half = el.scrollWidth / 2
      if (half <= el.clientWidth) return // nothing to scroll
      el.scrollLeft += 0.6 // ≈ 36 px/s at 60fps
      if (el.scrollLeft >= half) el.scrollLeft -= half
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [standings.length])

  if (standings.length === 0) {
    return (
      <footer className="border-t border-white/10 bg-black/40 backdrop-blur-sm">
        <div className="px-3 py-3 text-white/60 text-sm text-center">
          No players yet — share the join link!
        </div>
      </footer>
    )
  }

  const renderRow = (row: typeof standings[number], idx: number, copy: 'a' | 'b') => {
    const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : null
    return (
      <button
        key={`${copy}-${row.player.id}`}
        onClick={() => onSelect(row.player.id)}
        aria-hidden={copy === 'b'}
        tabIndex={copy === 'b' ? -1 : 0}
        className="flex items-center gap-2 px-2 py-1.5 rounded-full border border-white/15 bg-white/5 hover:bg-white/10 text-sm shrink-0"
      >
        <span className="text-white/60 text-xs font-mono w-5 text-right">#{idx + 1}</span>
        <AvatarIcon id={row.player.avatar} className="w-7 h-7 rounded-full" />
        <span className="text-white font-semibold">{row.player.name}</span>
        <span className="text-[var(--gold)] font-bold">{row.total}</span>
        {medal && <span>{medal}</span>}
      </button>
    )
  }

  const handleInteractEnd = () => {
    interactingRef.current = false
    lastInteractionRef.current = Date.now()
  }

  return (
    <footer className="border-t border-white/10 bg-black/40 backdrop-blur-sm">
      <div
        ref={containerRef}
        className="overflow-x-auto no-scrollbar"
        onPointerDown={() => { interactingRef.current = true }}
        onPointerUp={handleInteractEnd}
        onPointerCancel={handleInteractEnd}
        onPointerLeave={() => { if (interactingRef.current) handleInteractEnd() }}
      >
        <div className="flex gap-2 px-3 py-3 min-w-max">
          {standings.map((row, idx) => renderRow(row, idx, 'a'))}
          {standings.map((row, idx) => renderRow(row, idx, 'b'))}
        </div>
      </div>
    </footer>
  )
}

// ─── PlayerToken ────────────────────────────────────────────────────────────

function PlayerToken({
  pos, player, isLeader, showName, radius, revealDelay, onTap,
}: {
  pos: { x: number; y: number }
  player: Player
  isLeader: boolean
  showName: boolean
  radius: number
  revealDelay: number
  onTap: () => void
}) {
  const av = getAvatar(player.avatar)
  // Inner avatar is sized so it just fits inside the white ring.
  const innerR = Math.max(8, radius - 2)
  const inner = innerR * 2
  // Leader pulse oscillates between r-2 and r+8 for a subtle halo effect.
  const pulseLow = radius + 3
  const pulseHigh = radius + 13
  return (
    <motion.g
      initial={false}
      animate={{ x: pos.x, y: pos.y }}
      transition={{ type: 'spring', stiffness: 70, damping: 18, delay: revealDelay }}
      style={{ cursor: 'pointer' }}
      onClick={onTap}
      filter="url(#tokenShadow)"
    >
      {isLeader && (
        <circle cx="0" cy="0" r={pulseLow + 2} fill="none" stroke="#C9A84C" strokeWidth="2.5" opacity="0.9">
          <animate attributeName="r" values={`${pulseLow};${pulseHigh};${pulseLow}`} dur="1.6s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.9;0.2;0.9" dur="1.6s" repeatCount="indefinite" />
        </circle>
      )}
      <circle cx="0" cy="0" r={radius} fill={isLeader ? '#C9A84C' : '#8B1A2F'} />
      <svg
        x={-innerR}
        y={-innerR}
        width={inner}
        height={inner}
        viewBox="0 0 60 60"
        clipPath="url(#trackTokenClip)"
        dangerouslySetInnerHTML={{ __html: av.svg }}
      />
      <circle cx="0" cy="0" r={innerR} fill="none" stroke="#FFFFFF" strokeWidth={radius >= 14 ? 1.8 : 1.4} pointerEvents="none" />
      {showName && (
        <text
          x="0"
          y={-(radius + 4)}
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
