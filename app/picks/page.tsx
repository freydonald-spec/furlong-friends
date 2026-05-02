'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { AvatarIcon, useAvatarSampler } from '@/lib/avatars'
import { parseLocalIso } from '@/lib/time'
import { WatchPartyBadge } from '@/lib/watch-party-badge'
import { WatermarkBG } from '@/components/WatermarkBG'
import { computePlayerBadges, type Badge } from '@/lib/badges'
import { usePeerConfidence, type RaceConfidence } from '@/lib/usePeerConfidence'
import { PeerConfidenceBar } from '@/components/PeerConfidenceBar'
import { PickWizard } from '@/components/PickWizard'
import { ScoringLegendStrip } from '@/components/ScoringLegendStrip'
import { PartyChat } from '@/components/PartyChat'
import { findScratchAlerts } from '@/lib/scratches'
import type { Event, Race, Horse, Player, Pick, Score } from '@/lib/types'

export default function PicksPage() {
  const router = useRouter()
  const [event, setEvent] = useState<Event | null>(null)
  const [player, setPlayer] = useState<Player | null>(null)
  const [allPlayers, setAllPlayers] = useState<Player[]>([])
  const [races, setRaces] = useState<Race[]>([])
  const [horsesByRace, setHorsesByRace] = useState<Record<string, Horse[]>>({})
  const [picks, setPicks] = useState<Pick[]>([])
  // Event-wide pick distribution + per-race peer-confidence summary. The hook
  // owns the realtime channel for event-scoped picks; the component-local
  // `picks` state above is just the current player's row.
  const { picks: allEventPicks, byRace: peerByRace } = usePeerConfidence(event?.id ?? null)
  const [allScores, setAllScores] = useState<Score[]>([])
  const [revealedRaces, setRevealedRaces] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())

  const [infoModalRaceId, setInfoModalRaceId] = useState<string | null>(null)
  const [tokenAssignType, setTokenAssignType] = useState<'2x' | '3x' | null>(null)
  const [adminAlert, setAdminAlert] = useState<string | null>(null)
  const [changeAvatarOpen, setChangeAvatarOpen] = useState(false)
  const [expandedRaces, setExpandedRaces] = useState<Set<string>>(new Set())
  // Ref keeps the first-load defaults from being re-applied every time
  // realtime updates re-fire the effect — once the user has interacted with
  // a card we don't want to undo their toggles.
  const expandInitializedRef = useRef(false)

  // Toasts + nudges
  const [picksSavedToast, setPicksSavedToast] = useState(false)
  const [lockedToasts, setLockedToasts] = useState<{ id: string; raceNumber: number }[]>([])
  const [allPicksNudgeOpen, setAllPicksNudgeOpen] = useState(false)
  // Rank/score toasts: top-of-screen feedback that auto-dismisses after 3s.
  type RankToast = { id: string; message: string; tone: 'green' | 'red' | 'gold' }
  const [rankToasts, setRankToasts] = useState<RankToast[]>([])
  // Pick wizard — `markComplete` flips on the mandatory first-run open so we
  // know to set players.wizard_completed when the user reaches the end. Manual
  // re-runs from the "Pick All Races" button leave the flag alone.
  const [wizardState, setWizardState] = useState<{ open: boolean; markComplete: boolean }>({
    open: false,
    markComplete: false,
  })
  // Guard so realtime player updates don't re-trigger the wizard after the
  // user has dismissed it within this session.
  const mandatoryWizardCheckedRef = useRef(false)
  // Picks ref: realtime callbacks need to read picks without going stale.
  const picksRef = useRef<Pick[]>([])
  useEffect(() => { picksRef.current = picks }, [picks])

  // ----- Tutorial tour — manual-only (auto-start removed; the Pick Wizard
  // is taking over first-run onboarding). The "? How to Play" button still
  // calls startTour() below.
  const [tourActive, setTourActive] = useState(false)
  const [tourStepIdx, setTourStepIdx] = useState(0)

  const tourSteps = useMemo(() => {
    const featuredRaceExists = races.some(r => r.is_featured)
    return [
      {
        id: 'race-cards',
        selector: '[data-tour-first]',
        title: '📋 Your Races',
        body: 'Each race locks at post time — make your picks before the countdown hits zero! Tap 🏇 Pick Horses to make your selections.',
        prepare: () => {},
      },
      {
        id: 'pick-button',
        selector: '[data-tour-first] [data-tour-pick-button]',
        title: '🏇 Pick Your Horses',
        body: 'Pick which horse finishes 1st, 2nd, and 3rd. Exact match = 5 / 3 / 2 points. Right horse, wrong spot = 1 point.',
        prepare: () => {
          const firstRaceId = races[0]?.id
          if (firstRaceId) {
            setExpandedRaces(prev => {
              if (prev.has(firstRaceId)) return prev
              const next = new Set(prev)
              next.add(firstRaceId)
              return next
            })
          }
        },
      },
      {
        id: 'featured-race',
        selector: '[data-tour-featured]',
        title: '⭐ Featured Race = 2X Points!',
        body: 'This race is worth DOUBLE points. Use your best picks here — it could make or break your leaderboard position.',
        skip: !featuredRaceExists,
        prepare: () => {},
      },
      {
        id: 'bonus-tokens',
        selector: '[data-tour-bonus-tokens]',
        title: '✨ Bonus Tokens = Multiplied Points',
        body: 'You get a 3X and a 2X token. Tap a token to assign it to any upcoming race — that race’s points get multiplied! Use them on your most confident picks.',
        skip: !event?.multiplier_visible,
        prepare: () => {},
      },
      {
        id: 'live-track',
        selector: '[data-tour-live-track]',
        title: '🏁 Watch the Race Live!',
        body: 'After picking, head to the Live Track to watch everyone’s position update in real time. The leaderboard updates after each race!',
        prepare: () => {},
      },
    ].filter(s => !s.skip)
  }, [races, event?.multiplier_visible])

  function startTour() {
    if (tourSteps.length === 0) return
    setTourStepIdx(0)
    setTourActive(true)
    tourSteps[0].prepare?.()
  }

  function finishTour() {
    setTourActive(false)
    if (typeof window !== 'undefined') {
      localStorage.setItem('furlong_tour_seen', 'true')
    }
  }

  function nextTourStep() {
    const next = tourStepIdx + 1
    if (next >= tourSteps.length) {
      finishTour()
      return
    }
    tourSteps[next].prepare?.()
    setTourStepIdx(next)
  }


  async function loadAll() {
    if (typeof window === 'undefined') return
    const playerId = localStorage.getItem('furlong_player_id')
    if (!playerId) {
      router.replace('/join')
      return
    }

    try {
      const { data: playerRow, error: pErr } = await supabase
        .from('players')
        .select('*')
        .eq('id', playerId)
        .maybeSingle()

      if (pErr) throw pErr
      if (!playerRow) {
        localStorage.removeItem('furlong_player_id')
        router.replace('/join')
        return
      }

      // The player-facing screens always work against the currently active event.
      const { data: activeEvents } = await supabase
        .from('events')
        .select('*')
        .eq('status', 'active')
        .order('date', { ascending: false })
        .limit(1)
      const activeEvent = activeEvents?.[0] ?? null

      if (!activeEvent || activeEvent.id !== playerRow.event_id) {
        // Player belongs to a different event — bounce them to /join for the active one.
        localStorage.removeItem('furlong_player_id')
        localStorage.removeItem('furlong_player_name')
        router.replace('/join')
        return
      }

      setPlayer(playerRow)
      setEvent(activeEvent)

      const { data: racesRows } = await supabase
        .from('races')
        .select('*')
        .eq('event_id', playerRow.event_id)
        .order('race_number')
      // Players only see races flagged as in-game. Pre-migration rows have
      // is_game_race === undefined, which we treat as in-game (default true).
      const raceList = (racesRows ?? []).filter(r => r.is_game_race !== false)
      setRaces(raceList)

      if (raceList.length > 0) {
        const raceIds = raceList.map(r => r.id)
        const { data: horsesRows } = await supabase
          .from('horses')
          .select('*')
          .in('race_id', raceIds)
          .order('number')
        const grouped: Record<string, Horse[]> = {}
        for (const h of horsesRows ?? []) {
          if (!grouped[h.race_id]) grouped[h.race_id] = []
          grouped[h.race_id].push(h)
        }
        setHorsesByRace(grouped)
      }

      const { data: picksRows } = await supabase
        .from('picks')
        .select('*')
        .eq('player_id', playerRow.id)
      setPicks(picksRows ?? [])

      const { data: scoresRows } = await supabase
        .from('scores')
        .select('*')
        .eq('event_id', playerRow.event_id)
      setAllScores(scoresRows ?? [])

      const { data: playersRows } = await supabase
        .from('players')
        .select('*')
        .eq('event_id', playerRow.event_id)
      setAllPlayers(playersRows ?? [])
    } catch (e) {
      console.error(e)
      setError("Couldn't load your data. Pull to refresh.")
    } finally {
      setLoading(false)
    }
  }

  // Tick clock every second so the per-race countdown stays smooth.
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 1_000)
    return () => clearInterval(i)
  }, [])

  // Initial load + auth check
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadAll()

  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Realtime subscriptions
  useEffect(() => {
    if (!event || !player) return

    const channel = supabase
      .channel(`picks-${player.id}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'races', filter: `event_id=eq.${event.id}` },
        (payload) => {
          // Lock detection: if a race transitions INTO 'locked' and the player
          // hadn't picked it, surface a toast.
          if (payload.eventType === 'UPDATE') {
            const newR = payload.new as Race
            const oldR = payload.old as Partial<Race>
            if (oldR.status !== 'locked' && newR.status === 'locked') {
              const hadPick = picksRef.current.some(p =>
                p.race_id === newR.id && (p.win_horse_id || p.place_horse_id || p.show_horse_id)
              )
              if (!hadPick) {
                const tid = `${newR.id}-${Date.now()}`
                setLockedToasts(prev => [...prev, { id: tid, raceNumber: newR.race_number }])
                setTimeout(() => {
                  setLockedToasts(prev => prev.filter(t => t.id !== tid))
                }, 3000)
              }
            }
          }
          if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
            const r = payload.new as Race
            setRaces(prev => {
              // If admin just flipped is_game_race off, drop the race; otherwise
              // upsert it (re-include if it was hidden before).
              const filtered = prev.filter(x => x.id !== r.id)
              if (r.is_game_race === false) return filtered
              return [...filtered, r].sort((a, b) => a.race_number - b.race_number)
            })
          } else if (payload.eventType === 'DELETE') {
            setRaces(prev => prev.filter(x => x.id !== (payload.old as Race).id))
          }
        })
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'horses' },
        async () => {
          // Reload horses on any change (simpler than tracking)
          const { data } = await supabase
            .from('horses')
            .select('*')
            .order('number')
          if (data) {
            const grouped: Record<string, Horse[]> = {}
            for (const h of data) {
              if (!grouped[h.race_id]) grouped[h.race_id] = []
              grouped[h.race_id].push(h)
            }
            setHorsesByRace(grouped)
          }
        })
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'picks', filter: `player_id=eq.${player.id}` },
        (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const p = payload.new as Pick
            setPicks(prev => {
              const existing = prev.find(x => x.id === p.id)
              if (existing) return prev.map(x => x.id === p.id ? p : x)
              return [...prev, p]
            })
          } else if (payload.eventType === 'DELETE') {
            setPicks(prev => prev.filter(x => x.id !== (payload.old as Pick).id))
          }
        })
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'scores', filter: `event_id=eq.${event.id}` },
        (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const s = payload.new as Score
            setAllScores(prev => {
              const existing = prev.find(x => x.id === s.id)
              if (existing) return prev.map(x => x.id === s.id ? s : x)
              return [...prev, s]
            })
          }
        })
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'players', filter: `event_id=eq.${event.id}` },
        async () => {
          const { data } = await supabase
            .from('players')
            .select('*')
            .eq('event_id', event.id)
          if (data) {
            setAllPlayers(data)
            const me = data.find(p => p.id === player.id)
            if (me) setPlayer(me)
          }
        })
      .on('broadcast', { event: 'reveal_race' }, ({ payload }) => {
        setRevealedRaces(prev => new Set([...prev, payload.race_id]))
      })
      .on('broadcast', { event: 'admin_alert' }, ({ payload }) => {
        setAdminAlert(payload.message ?? null)
      })
      .subscribe()

    return () => { void supabase.removeChannel(channel) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event?.id, player?.id])

  // First-load expansion defaults: only upcoming/open races without picks
  // start expanded. Finished, locked, and already-picked races collapse.
  // Ref-guarded so realtime updates don't reset user toggles.
  useEffect(() => {
    if (expandInitializedRef.current) return
    if (loading || races.length === 0) return
    expandInitializedRef.current = true
    const defaults = new Set<string>()
    for (const r of races) {
      if (r.status === 'finished' || r.status === 'locked') continue
      const racePick = picks.find(p => p.race_id === r.id)
      const hasPicks = !!(racePick && (racePick.win_horse_id || racePick.place_horse_id || racePick.show_horse_id))
      if (!hasPicks) defaults.add(r.id)
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setExpandedRaces(defaults)
  }, [loading, races, picks])

  // Auto-dismiss the green "Picks saved!" toast after 2s.
  useEffect(() => {
    if (!picksSavedToast) return
    const t = setTimeout(() => setPicksSavedToast(false), 2000)
    return () => clearTimeout(t)
  }, [picksSavedToast])

  // Auto-assign multipliers on first load if both are unassigned.
  // 3X → featured race (or highest race_number if none featured).
  // 2X → next-highest race_number after the 3X target.
  // (purse isn't stored on the Race row, so we use race ordering as the
  // closest stable proxy for "second-most important race" on a stakes card.)
  const tokenAutoAssignedRef = useRef(false)
  useEffect(() => {
    if (!player || !event || tokenAutoAssignedRef.current) return
    if (races.length === 0) return
    if (player.multiplier_3x_race_id || player.multiplier_2x_race_id) {
      tokenAutoAssignedRef.current = true
      return
    }
    const assignable = races.filter(r => r.status !== 'finished' && r.status !== 'locked')
    if (assignable.length === 0) return
    const sortedByNumber = [...assignable].sort((a, b) => b.race_number - a.race_number)
    const featured = assignable.find(r => r.is_featured)
    const threeX = featured ?? sortedByNumber[0]
    const twoX = sortedByNumber.find(r => r.id !== threeX.id) ?? null
    tokenAutoAssignedRef.current = true
    void supabase
      .from('players')
      .update({
        multiplier_3x_race_id: threeX.id,
        multiplier_2x_race_id: twoX?.id ?? null,
      })
      .eq('id', player.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player?.id, event?.id, races.length])

  // Mandatory wizard trigger — opens full-screen on first /picks load when the
  // player hasn't completed it yet AND there's still at least one pickable race.
  useEffect(() => {
    if (loading) return
    if (!player) return
    if (mandatoryWizardCheckedRef.current) return
    if (player.wizard_completed === true) return
    mandatoryWizardCheckedRef.current = true
    const hasPickable = races.some(r => r.status === 'upcoming' || r.status === 'open')
    if (!hasPickable) return // spec: skip wizard if all game races are locked
    setWizardState({ open: true, markComplete: true })
  }, [loading, player, races])

  async function handleWizardClose({ completed }: { completed: boolean }) {
    const shouldMark =
      wizardState.markComplete && completed && player && player.wizard_completed !== true
    if (shouldMark && player) {
      try {
        await supabase
          .from('players')
          .update({ wizard_completed: true })
          .eq('id', player.id)
        setPlayer({ ...player, wizard_completed: true })
      } catch (e) {
        console.error('[picks] failed to mark wizard_completed', e)
      }
    }
    setWizardState({ open: false, markComplete: false })
  }

  // Rank/score toast plumbing. The useEffects that read myRank/myTotalScore/
  // effectiveRevealed live below those memos to avoid TDZ.
  const prevRankRef = useRef<{ rank: number; score: number } | null>(null)
  const prevScoreByRaceRef = useRef<Map<string, number>>(new Map())

  function pushRankToast(toast: Omit<RankToast, 'id'>) {
    const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
    setRankToasts(prev => [...prev, { id, ...toast }])
    setTimeout(() => {
      setRankToasts(prev => prev.filter(t => t.id !== id))
    }, 3000)
  }

  // Once all races have picks, prompt the player to head to /track.
  // sessionStorage flag prevents re-showing within the same browser session.
  const allPicksIn = useMemo(() => {
    if (races.length === 0) return false
    return races.every(r => picks.some(p =>
      p.race_id === r.id && (p.win_horse_id || p.place_horse_id || p.show_horse_id)
    ))
  }, [races, picks])

  useEffect(() => {
    if (!event || !allPicksIn) return
    if (typeof window === 'undefined') return
    const key = `furlong_all_picks_nudge_${event.id}`
    if (sessionStorage.getItem(key) === 'dismissed') return
    setAllPicksNudgeOpen(true)
  }, [allPicksIn, event])

  function dismissAllPicksNudge() {
    if (event && typeof window !== 'undefined') {
      sessionStorage.setItem(`furlong_all_picks_nudge_${event.id}`, 'dismissed')
    }
    setAllPicksNudgeOpen(false)
  }

  // Effective revealed set: in auto mode, every race is implicitly revealed;
  // in manual mode, only those broadcast by admin (or already in `revealedRaces`).
  const effectiveRevealed = useMemo(() => {
    if (event?.score_reveal_mode === 'auto') {
      return new Set(races.map(r => r.id))
    }
    return revealedRaces
  }, [event?.score_reveal_mode, races, revealedRaces])

  // Computed: my total score and rank
  const myTotalScore = useMemo(() => {
    if (!player) return 0
    return allScores
      .filter(s => s.player_id === player.id && effectiveRevealed.has(s.race_id))
      .reduce((sum, s) => sum + (s.final_points || 0), 0)
  }, [allScores, player, effectiveRevealed])

  const standings = useMemo(() => {
    const totals = new Map<string, number>()
    for (const p of allPlayers) totals.set(p.id, 0)
    for (const s of allScores) {
      if (!effectiveRevealed.has(s.race_id)) continue
      totals.set(s.player_id, (totals.get(s.player_id) || 0) + (s.final_points || 0))
    }
    return [...totals.entries()]
      .map(([id, score]) => ({ id, score }))
      .sort((a, b) => b.score - a.score)
  }, [allPlayers, allScores, effectiveRevealed])

  const myRank = useMemo(() => {
    if (!player) return 0
    const idx = standings.findIndex(s => s.id === player.id)
    return idx === -1 ? standings.length : idx + 1
  }, [standings, player])

  const myBadges = useMemo<Badge[]>(() => {
    if (!player) return []
    return computePlayerBadges({
      playerId: player.id,
      rank: myRank,
      totalPlayers: allPlayers.length,
      scores: allScores,
      picks: allEventPicks,
      races,
      horsesByRace,
    })
  }, [player, myRank, allPlayers.length, allScores, allEventPicks, races, horsesByRace])

  // Newly-revealed race scores → "+X points from Race N!" gold toast.
  useEffect(() => {
    if (!player) return
    const current = new Map<string, number>()
    for (const s of allScores) {
      if (s.player_id !== player.id) continue
      if (!effectiveRevealed.has(s.race_id)) continue
      current.set(s.race_id, s.final_points)
    }
    const prev = prevScoreByRaceRef.current
    // Skip the initial population — only emit on subsequent additions.
    if (prev.size > 0) {
      for (const [raceId, points] of current) {
        if (!prev.has(raceId)) {
          const race = races.find(r => r.id === raceId)
          if (race) {
            pushRankToast({
              message: `+${points} points from Race ${race.race_number}!`,
              tone: 'gold',
            })
          }
        }
      }
    }
    prevScoreByRaceRef.current = current
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allScores, effectiveRevealed, races, player?.id])

  // Rank movement → green/red toast.
  useEffect(() => {
    if (!player) return
    const prev = prevRankRef.current
    if (prev !== null && prev.rank !== myRank) {
      if (myRank < prev.rank) {
        pushRankToast({
          message: `📈 You moved up to #${myRank}!`,
          tone: 'green',
        })
      } else {
        pushRankToast({
          message: `📉 You dropped to #${myRank}`,
          tone: 'red',
        })
      }
    }
    prevRankRef.current = { rank: myRank, score: myTotalScore }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myRank, myTotalScore, player?.id])

  // Critical-only warning banner: surfaces a single red banner when any
  // unpicked upcoming race is within 10 minutes of locking. Below that
  // threshold we stay quiet — the per-tile countdown handles the rest.
  const unpickedSummary = useMemo(() => {
    if (!races.length) return null
    const unpicked = races.filter(r => {
      if (r.status !== 'upcoming' && r.status !== 'open') return false
      const has = picks.some(p =>
        p.race_id === r.id && (p.win_horse_id || p.place_horse_id || p.show_horse_id)
      )
      return !has
    })
    if (unpicked.length === 0) return null
    const withSeconds = unpicked.map(r => {
      const target = parseLocalIso(r.post_time)
      const secondsUntil = target ? (target.getTime() - now) / 1000 : Infinity
      return { race: r, secondsUntil }
    }).sort((a, b) => a.secondsUntil - b.secondsUntil)
    const soonest = withSeconds[0]
    const critical = soonest.secondsUntil <= 10 * 60 && soonest.secondsUntil > 0
    if (!critical) return null
    return { count: unpicked.length, soonest, races: unpicked }
  }, [races, picks, now])

  // Scratched-pick alerts for the current player. The horses-table realtime
  // subscription further up updates `horsesByRace` whenever an admin flips a
  // scratch, so this memo recomputes automatically and the banner appears /
  // disappears on its own (no manual dismiss state needed). The Set of race
  // ids is consumed by the RaceTile to draw a ⚠️ corner badge.
  const myScratchAlerts = useMemo(
    () => player ? findScratchAlerts({
      players: player ? [player] : [],
      picks,
      races,
      horsesByRace,
      playerId: player.id,
    }) : [],
    [player, picks, races, horsesByRace],
  )
  const scratchedRaceIds = useMemo(
    () => new Set(myScratchAlerts.map(a => a.raceId)),
    [myScratchAlerts],
  )

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-3 animate-pulse">🏇</div>
          <p className="text-[var(--text-muted)] text-lg">Loading the field...</p>
        </div>
      </main>
    )
  }

  if (!player || !event) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6 text-center">
        <div>
          <p className="text-[var(--text-primary)] mb-4">{error ?? "Couldn't find your player record."}</p>
          <Link href="/join" className="inline-block px-6 h-12 leading-[3rem] rounded-full bg-[var(--rose-dark)] border-2 border-[var(--gold)]/60 text-white font-bold">
            Join the game
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen pb-24">
      <WatermarkBG />

      {/* Top-of-screen rank/score toasts (auto-dismiss in 3s) */}
      <div className="fixed top-14 left-0 right-0 z-40 pointer-events-none flex flex-col items-center gap-2 px-4">
        <AnimatePresence>
          {rankToasts.map(t => {
            const tone = t.tone === 'gold'
              ? 'bg-[var(--gold)] text-[var(--bg-primary)] border-[var(--gold)]'
              : t.tone === 'green'
                ? 'bg-[var(--success)] text-white border-emerald-300'
                : 'bg-rose-900/90 text-rose-100 border-rose-400/60'
            return (
              <motion.div
                key={t.id}
                initial={{ y: -40, opacity: 0, scale: 0.9 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                exit={{ y: -20, opacity: 0 }}
                transition={{ type: 'spring', damping: 22, stiffness: 280 }}
                className={`pointer-events-auto px-4 py-2.5 rounded-full border-2 font-bold text-sm shadow-xl ${tone}`}
              >
                {t.message}
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>

      {/* Slim sticky profile header — light theme */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-[var(--border)] px-3 py-2 shadow-sm">
        <div className="max-w-2xl mx-auto flex items-center gap-3 h-9">
          <button
            type="button"
            onClick={() => setChangeAvatarOpen(true)}
            title="Tap to change avatar"
            aria-label="Tap to change avatar"
            className="shrink-0"
          >
            <AvatarIcon id={player.avatar} className="w-9 h-9 rounded-md" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[var(--text-primary)] font-semibold text-sm truncate">{player.name}</span>
              {myBadges.slice(0, 2).map(b => (
                <span
                  key={b.label}
                  title={b.label}
                  className={`shrink-0 inline-flex items-center px-1.5 h-4 rounded-full text-[10px] font-bold border ${b.cls}`}
                >
                  <span aria-hidden>{b.emoji}</span>
                </span>
              ))}
            </div>
            <div className="text-sm text-[var(--text-muted)] truncate flex items-center gap-1.5 leading-tight mt-0.5">
              <span className="truncate">{event.name}</span>
              <span className="opacity-60">·</span>
              <button
                type="button"
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    localStorage.removeItem('furlong_player_id')
                    localStorage.removeItem('furlong_player_name')
                  }
                  router.push('/')
                }}
                className="text-[var(--text-muted)] hover:text-[var(--rose-dark)] shrink-0"
              >
                Not you?
              </button>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="px-2 h-7 rounded-full bg-[var(--rose-dark)]/10 border border-[var(--rose-dark)]/30 text-[var(--rose-dark)] text-xs font-bold tabular-nums inline-flex items-center">
              <motion.span
                key={`pts-${myTotalScore}`}
                initial={{ filter: 'brightness(1.4)' }}
                animate={{ filter: 'brightness(1)' }}
                transition={{ duration: 0.6 }}
                className="inline-block"
              >
                {myTotalScore}
              </motion.span>
            </span>
            <span className="px-2 h-7 rounded-full bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-primary)] text-xs font-bold tabular-nums inline-flex items-center">
              <motion.span
                key={`rank-${myRank}`}
                initial={{ filter: 'brightness(1.4)' }}
                animate={{ filter: 'brightness(1)' }}
                transition={{ duration: 0.6 }}
                className="inline-block"
              >
                #{myRank}
              </motion.span>
            </span>
            <button
              type="button"
              onClick={startTour}
              title="How to Play"
              aria-label="How to play"
              className="w-7 h-7 rounded-full bg-[var(--rose-dark)]/10 border border-[var(--rose-dark)]/40 text-[var(--rose-dark)] hover:bg-[var(--rose-dark)]/20 flex items-center justify-center text-xs font-bold shrink-0"
            >
              ?
            </button>
          </div>
        </div>
      </header>

      {/* Transient alert banners — sit below the slim header */}
      <AnimatePresence>
        {adminAlert && (
          <motion.div
            initial={{ y: -60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -60, opacity: 0 }}
            className="sticky top-[52px] z-30 bg-amber-500/95 text-amber-950 px-4 py-3 flex items-center justify-between shadow-lg"
          >
            <span className="font-semibold text-sm">⚠️ {adminAlert}</span>
            <button onClick={() => setAdminAlert(null)} className="text-amber-950/80 ml-3 px-2 font-bold">✕</button>
          </motion.div>
        )}
        {lockedToasts.map(t => (
          <motion.div
            key={`lock-${t.id}`}
            initial={{ y: -60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -60, opacity: 0 }}
            transition={{ type: 'spring', damping: 24, stiffness: 260 }}
            className="sticky top-[52px] z-30 bg-[var(--rose-dark)] text-white px-4 py-3 shadow-lg border-b-2 border-[var(--gold)]"
          >
            <span className="font-semibold text-sm">
              🔒 Race {t.raceNumber} just locked! No more changes.
            </span>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Critical unpicked-race banner — only shown when ≤10 min from lock */}
      {unpickedSummary && (() => {
        const { soonest } = unpickedSummary
        const minutesLeft = Math.max(0, Math.floor(soonest.secondsUntil / 60))
        const message = `🔴 Race ${soonest.race.race_number} locks in ${minutesLeft} min — pick now!`
        return (
          <div
            className="sticky top-[52px] z-[15] mx-3 mt-2 mb-2 max-w-2xl md:mx-auto rounded-xl border-2 shadow-lg backdrop-blur-sm cursor-pointer bg-[var(--warning)] border-red-300 text-white animate-pulse"
            onClick={() => setInfoModalRaceId(soonest.race.id)}
            role="button"
            tabIndex={0}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setInfoModalRaceId(soonest.race.id) }}
          >
            <div className="px-4 py-2.5 flex items-center justify-between gap-3">
              <span className="font-bold text-sm">{message}</span>
              <span className="text-xs font-semibold opacity-90 shrink-0">Tap →</span>
            </div>
          </div>
        )
      })()}

      {/* Slim Power Plays row — read-only status display. Assignment happens
          inside the Race Info popup, so these pills don't need to be tappable. */}
      {event.multiplier_visible && (
        <section className="px-3 pt-3 pb-2" data-tour-bonus-tokens="true">
          <div className="max-w-2xl mx-auto flex items-center gap-2 flex-wrap">
            <span className="text-[var(--gold)] font-bold text-[11px] uppercase tracking-wider shrink-0">⚡ Power Plays:</span>
            {(['3x', '2x'] as const).map(t => {
              const assignedId = t === '3x' ? player.multiplier_3x_race_id : player.multiplier_2x_race_id
              const r = races.find(x => x.id === assignedId)
              const mult = t === '3x' ? '×3' : '×2'
              return (
                <span
                  key={t}
                  className={`px-3 h-8 rounded-full border text-xs font-bold inline-flex items-center ${
                    r
                      ? 'bg-[var(--gold)]/15 border-[var(--gold)]/60 text-[var(--gold)]'
                      : 'bg-white border-[var(--border)] text-[var(--text-muted)]'
                  }`}
                >
                  {r ? `R${r.race_number} ${mult}` : `${mult} unassigned`}
                </span>
              )
            })}
            <span className="text-[10px] text-[var(--text-muted)] italic ml-1">tap a race to assign</span>
          </div>
        </section>
      )}

      {/* Scratched-pick warnings — one persistent banner per affected race.
          Tappable to open the race info modal so the player can swap horses;
          the banner self-dismisses once the swap removes the scratched horse
          from their picks. Lives directly above the race grid as spec'd. */}
      {myScratchAlerts.length > 0 && (
        <section className="px-5 mb-2">
          <div className="max-w-2xl mx-auto space-y-2">
            {myScratchAlerts.map(a => (
              <button
                key={`${a.raceId}-${a.slot}`}
                type="button"
                onClick={() => setInfoModalRaceId(a.raceId)}
                className="w-full text-left px-4 py-3 rounded-xl border-2 border-[var(--warning)] bg-red-50 text-[var(--text-primary)] shadow-sm hover:bg-red-100 active:scale-[0.99] transition-all"
              >
                <div className="text-sm font-semibold leading-snug">
                  <span aria-hidden className="mr-1">⚠️</span>
                  Your pick in{' '}
                  <span className="font-bold">Race {a.raceNumber}</span>,{' '}
                  <span className="font-bold">#{a.horseNumber} {a.horseName}</span>
                  , has been scratched.{' '}
                  <span className="text-[var(--rose-dark)] underline underline-offset-2">
                    Tap to update your pick.
                  </span>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Race Cards */}
      <section className="px-5">
        <div className="max-w-2xl mx-auto">
          {/* Manual "Pick All Races" trigger — top-right of the section.
              No more "Races" h3 above it; the grid speaks for itself. */}
          {races.some(r => r.status === 'upcoming' || r.status === 'open') && (
            <div className="flex justify-end mb-2">
              <button
                onClick={() => setWizardState({ open: true, markComplete: false })}
                className="px-3 h-8 rounded-full bg-[var(--rose-dark)] text-white text-xs font-bold shadow-md hover:bg-[var(--rose-dark)]/90 active:scale-[0.97] transition-all inline-flex items-center gap-1"
              >
                🏇 Pick All Races
              </button>
            </div>
          )}
          {races.length === 0 ? (
            <div className="bg-white border border-[var(--border)] rounded-xl p-6 text-center text-[var(--text-muted)] shadow-sm">
              No races posted yet. The host will set them up before post time.
            </div>
          ) : (
            <>
              {/* Scoring legend — tappable strip; opens the scoring rules modal. */}
              <div className="mb-2 px-1">
                <ScoringLegendStrip variant="full" />
              </div>

              {/* Next-race countdown banner — points to the soonest pickable
                  race so players see what's about to start without scanning
                  the grid. Hidden when no upcoming/open races remain. */}
              <NextRaceBanner races={races} now={now} onTap={raceId => setInfoModalRaceId(raceId)} />

              {/* Day progress bar */}
              {(() => {
                const finishedCount = races.filter(r => r.status === 'finished').length
                return (
                  <div className="mb-3 px-1">
                    <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)] mb-1.5">
                      <span className="uppercase tracking-wider font-bold">Day Progress</span>
                      <span className="font-semibold tabular-nums">
                        Race {finishedCount} of {races.length} complete
                      </span>
                    </div>
                    <div className="flex gap-1 h-2">
                      {races.map(r => (
                        <div
                          key={r.id}
                          title={`Race ${r.race_number} — ${r.status}`}
                          className={`flex-1 rounded-full ${
                            r.status === 'finished'
                              ? 'bg-[var(--gold)]'
                              : r.status === 'locked'
                                ? 'bg-[var(--rose-dark)]'
                                : 'bg-[var(--border)]'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                )
              })()}

              {/* Compact race tile grid — replaces the old vertical card list */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {(() => {
                  // Sort: critical unpicked → other unpicked → picked → locked → finished
                  function rankFor(r: Race): number {
                    const hasPick = picks.some(p =>
                      p.race_id === r.id && (p.win_horse_id || p.place_horse_id || p.show_horse_id)
                    )
                    if (r.status === 'finished') return 5
                    if (r.status === 'locked') return 4
                    if (hasPick) return 3
                    const target = parseLocalIso(r.post_time)
                    const secondsUntil = target ? (target.getTime() - now) / 1000 : Infinity
                    if (secondsUntil > 0 && secondsUntil < 30 * 60) return 1
                    return 2
                  }
                  return [...races].sort((a, b) => {
                    const ra = rankFor(a), rb = rankFor(b)
                    if (ra !== rb) return ra - rb
                    return a.race_number - b.race_number
                  }).map((race, idx) => (
                    <div
                      key={race.id}
                      data-tour-first={idx === 0 ? 'true' : undefined}
                      data-tour-featured={race.is_featured ? 'true' : undefined}
                    >
                      <RaceTile
                        race={race}
                        horses={horsesByRace[race.id] ?? []}
                        pick={picks.find(p => p.race_id === race.id) ?? null}
                        score={allScores.find(s => s.race_id === race.id && s.player_id === player.id) ?? null}
                        scoreRevealed={effectiveRevealed.has(race.id)}
                        multiplier={
                          player.multiplier_3x_race_id === race.id ? '3x' :
                          player.multiplier_2x_race_id === race.id ? '2x' : null
                        }
                        peerConf={peerByRace[race.id] ?? null}
                        hasScratchedPick={scratchedRaceIds.has(race.id)}
                        now={now}
                        onOpen={() => setInfoModalRaceId(race.id)}
                      />
                    </div>
                  ))
                })()}
              </div>
            </>
          )}
        </div>
      </section>

      {/* Race Info Modal */}
      <AnimatePresence>
        {infoModalRaceId && (
          <RaceInfoModal
            race={races.find(r => r.id === infoModalRaceId)!}
            horses={horsesByRace[infoModalRaceId] ?? []}
            existingPick={picks.find(p => p.race_id === infoModalRaceId) ?? null}
            playerId={player.id}
            eventId={event.id}
            onSaved={() => setPicksSavedToast(true)}
            onClose={() => setInfoModalRaceId(null)}
            races={races}
            multiplier3xRaceId={player.multiplier_3x_race_id}
            multiplier2xRaceId={player.multiplier_2x_race_id}
            multiplierVisible={event.multiplier_visible}
            peerConf={peerByRace[infoModalRaceId] ?? null}
          />
        )}
      </AnimatePresence>

      {/* Pick wizard — mandatory on first run, manual otherwise */}
      <AnimatePresence>
        {wizardState.open && (
          <PickWizard
            open={wizardState.open}
            races={races}
            horsesByRace={horsesByRace}
            picks={picks}
            peerByRace={peerByRace}
            player={player}
            eventId={event.id}
            multiplierVisible={event.multiplier_visible}
            markCompleteOnFinish={wizardState.markComplete}
            onSaved={() => setPicksSavedToast(true)}
            onClose={handleWizardClose}
          />
        )}
      </AnimatePresence>

      {/* Change Avatar Modal */}
      <AnimatePresence>
        {changeAvatarOpen && (
          <ChangeAvatarModal
            player={player}
            takenAvatars={allPlayers.filter(p => p.id !== player.id).map(p => p.avatar)}
            onClose={() => setChangeAvatarOpen(false)}
            onPick={async (avatarId) => {
              const { error: err } = await supabase
                .from('players')
                .update({ avatar: avatarId })
                .eq('id', player.id)
              if (err) {
                alert("Couldn't change avatar: " + err.message)
                return
              }
              setPlayer({ ...player, avatar: avatarId })
              setChangeAvatarOpen(false)
            }}
          />
        )}
      </AnimatePresence>

      {/* Token Assign Modal */}
      <AnimatePresence>
        {tokenAssignType && (
          <TokenAssignModal
            type={tokenAssignType}
            races={races}
            player={player}
            onAssign={async (raceId) => {
              const field = tokenAssignType === '3x' ? 'multiplier_3x_race_id' : 'multiplier_2x_race_id'
              await supabase.from('players').update({ [field]: raceId }).eq('id', player.id)
              setPlayer({ ...player, [field]: raceId })
              setTokenAssignType(null)
            }}
            onClose={() => setTokenAssignType(null)}
          />
        )}
      </AnimatePresence>

      {/* Powered by Watch Party — pb-20 clears the fixed bottom nav below */}
      <div className="flex justify-center mt-8 pb-20 px-4">
        <WatchPartyBadge />
      </div>

      {/* "Picks saved!" toast (bottom center) */}
      <AnimatePresence>
        {picksSavedToast && (
          <motion.div
            key="picks-saved"
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            transition={{ type: 'spring', damping: 22, stiffness: 280 }}
            className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 bg-emerald-500 text-white font-bold px-5 py-3 rounded-full shadow-lg flex items-center gap-2 pointer-events-none"
          >
            <span>✅</span>
            <span>Picks saved!</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* All-picks-in nudge (above bottom nav) */}
      <AnimatePresence>
        {allPicksNudgeOpen && (
          <motion.div
            key="all-picks-nudge"
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: 'spring', damping: 24, stiffness: 240 }}
            className="fixed bottom-14 left-0 right-0 z-20 px-3 pb-2"
          >
            <div className="max-w-2xl mx-auto bg-gradient-to-r from-[var(--gold)] to-[#E8C96A] text-[var(--text-primary)] rounded-xl px-4 py-3 shadow-lg flex items-center justify-between gap-3 border-2 border-[var(--gold)]/80">
              <Link
                href="/track"
                onClick={dismissAllPicksNudge}
                className="flex-1 font-bold flex items-center gap-2"
              >
                🏇 All picks in! Watch the race live →
              </Link>
              <button
                onClick={dismissAllPicksNudge}
                aria-label="Dismiss"
                className="text-[var(--text-primary)]/80 hover:text-[var(--text-primary)] font-bold text-lg leading-none px-2"
              >✕</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 border-t-2 border-[var(--rose-dark)]/30 backdrop-blur-sm z-10 shadow-[0_-2px_8px_rgba(0,0,0,0.05)]">
        <div className="max-w-2xl mx-auto flex">
          <PicksNavTab href="/" label="Home" icon="🏠" active={false} />
          <PicksNavTab href="/track" label="Live Track" icon="🏁" active={false} dataTourLiveTrack />
          <PicksNavTab href="/leaderboard" label="Leaderboard" icon="📊" active={false} />
        </div>
      </nav>

      {/* Floating party-chat bubble — sits above the bottom nav. */}
      <PartyChat eventId={event.id} player={player} players={allPlayers} theme="light" />

      {/* First-run tutorial tour */}
      <AnimatePresence>
        {tourActive && tourSteps[tourStepIdx] && (
          <TourOverlay
            key={tourSteps[tourStepIdx].id}
            stepIndex={tourStepIdx}
            totalSteps={tourSteps.length}
            selector={tourSteps[tourStepIdx].selector}
            title={tourSteps[tourStepIdx].title}
            body={tourSteps[tourStepIdx].body}
            isLastStep={tourStepIdx === tourSteps.length - 1}
            onNext={nextTourStep}
            onSkip={finishTour}
          />
        )}
      </AnimatePresence>
    </main>
  )
}

// ----- BOTTOM NAV TAB -----
function PicksNavTab({
  href, label, icon, active, dataTourLiveTrack,
}: {
  href: string
  label: string
  icon: string
  active: boolean
  dataTourLiveTrack?: boolean
}) {
  return (
    <Link
      href={href}
      data-tour-live-track={dataTourLiveTrack ? 'true' : undefined}
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

// ----- NEXT RACE BANNER -----
// Highlights the soonest pickable race (upcoming OR open) with a live H:MM:SS
// countdown. Goes red/urgent when ≤ 5 minutes from post; stays gold otherwise.
// Tapping the banner opens the race info modal so players can pick fast.
function NextRaceBanner({
  races, now, onTap,
}: {
  races: Race[]
  now: number
  onTap: (raceId: string) => void
}) {
  // Pick the soonest race that's still pickable. We don't include races
  // already past post-time without a status flip — those resolve via the
  // realtime races handler within seconds. Sort by post_time ascending and
  // skip anything we couldn't parse.
  const next = (() => {
    const candidates = races
      .filter(r => r.status === 'upcoming' || r.status === 'open')
      .map(r => ({ race: r, t: parseLocalIso(r.post_time)?.getTime() ?? Infinity }))
      .filter(x => Number.isFinite(x.t))
      .sort((a, b) => a.t - b.t)
    return candidates[0] ?? null
  })()
  if (!next) return null

  const secs = Math.max(0, Math.floor((next.t - now) / 1000))
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  const countdown = secs <= 0
    ? 'POST TIME'
    : `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  // ≤5 minutes → urgent red; otherwise calmer rose-on-cream pill.
  const urgent = secs > 0 && secs <= 5 * 60
  const containerCls = urgent
    ? 'bg-[var(--warning)] border-red-300 text-white animate-pulse'
    : 'bg-white border-[var(--rose-dark)]/40 text-[var(--text-primary)]'
  const countdownCls = urgent
    ? 'text-white'
    : 'text-[var(--rose-dark)]'

  return (
    <button
      type="button"
      onClick={() => onTap(next.race.id)}
      className={`w-full mb-2 px-3 py-2 rounded-xl border-2 shadow-sm text-left flex items-center justify-between gap-3 transition-all hover:shadow-md ${containerCls}`}
    >
      <div className="min-w-0 flex-1">
        <div className={`text-[10px] uppercase font-extrabold tracking-wider ${urgent ? 'text-white/80' : 'text-[var(--text-muted)]'}`}>
          Next race
        </div>
        <div className="font-semibold text-sm truncate">
          R{next.race.race_number}{' '}
          <span className={urgent ? 'text-white/85' : 'text-[var(--text-muted)]'}>·</span>{' '}
          {next.race.name || `Race ${next.race.race_number}`}
        </div>
      </div>
      <div className={`shrink-0 font-mono tabular-nums font-extrabold text-base leading-none ${countdownCls}`}>
        {countdown}
      </div>
    </button>
  )
}

// ----- RACE TILE — compact grid card -----
function RaceTile({
  race, horses, pick, score, scoreRevealed, multiplier, peerConf, hasScratchedPick, now, onOpen,
}: {
  race: Race
  horses: Horse[]
  pick: Pick | null
  score: Score | null
  scoreRevealed: boolean
  multiplier: '2x' | '3x' | null
  /** Per-race confidence summary; null when fewer than 5 players have win-picked. */
  peerConf: RaceConfidence | null
  /** True if at least one of the player's picks for this race is on a horse
   *  that's now scratched. Drives the corner ⚠️ badge. */
  hasScratchedPick: boolean
  now: number
  onOpen: () => void
}) {
  const hasPicks = !!(pick && (pick.win_horse_id || pick.place_horse_id || pick.show_horse_id))
  const finished = race.status === 'finished' && scoreRevealed
  const locked = race.status === 'locked'
  const upcoming = race.status === 'upcoming' || race.status === 'open'
  const winHorse = horses.find(h => h.finish_position === 1)
  const placeHorse = horses.find(h => h.finish_position === 2)
  const showHorse = horses.find(h => h.finish_position === 3)

  // Coarse countdown — minute-level precision is enough on a tile; the
  // banner above the grid carries the H:MM:SS for the imminent race.
  // Format: "in Xh Ym", "in Xm", "in <1m", or "POST TIME" once it lands.
  const countdown = (() => {
    if (!upcoming) return null
    const target = parseLocalIso(race.post_time)
    if (!target) return null
    const secs = Math.floor((target.getTime() - now) / 1000)
    if (secs <= 0) return { text: 'POST TIME', urgent: true }
    const h = Math.floor(secs / 3600)
    const m = Math.floor((secs % 3600) / 60)
    const text = h > 0
      ? `in ${h}h ${m}m`
      : m > 0
        ? `in ${m}m`
        : 'in <1m'
    return { text, urgent: secs < 5 * 60 }
  })()

  const postTime = parseLocalIso(race.post_time)
  const postTimeText = postTime
    ? postTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : null

  // Tile state styling: bg, left-border, footer content.
  let bgClass = 'bg-white'
  let borderL = 'border-l-[var(--border)]'
  let badge: React.ReactNode = null
  let footer: React.ReactNode = null

  if (race.is_featured) {
    bgClass = 'bg-amber-50'
    borderL = 'border-l-[var(--gold)]'
    badge = (
      <span className="text-[10px] font-extrabold text-[var(--gold)] bg-white border border-[var(--gold)]/50 px-1.5 py-0.5 rounded">
        ⭐ {race.featured_multiplier}X
      </span>
    )
  }

  if (finished && score) {
    borderL = score.final_points > 0 ? 'border-l-[var(--success)]' : 'border-l-gray-300'
    if (!race.is_featured) bgClass = 'bg-white'
    badge = (
      <span className="text-sm font-extrabold text-[var(--gold)] bg-amber-50 border border-[var(--gold)]/50 px-2 py-0.5 rounded-full leading-none tabular-nums">
        +{score.final_points}
      </span>
    )
    footer = (
      <div className="text-[11px] text-[var(--text-muted)] leading-tight">
        🥇 #{winHorse?.number ?? '?'} · 🥈 #{placeHorse?.number ?? '?'} · 🥉 #{showHorse?.number ?? '?'}
      </div>
    )
  } else if (race.status === 'finished' && !score) {
    borderL = 'border-l-gray-300'
    bgClass = race.is_featured ? bgClass : 'bg-gray-50'
    footer = <div className="text-[11px] text-[var(--text-muted)] italic">No pick</div>
  } else if (locked) {
    borderL = 'border-l-gray-400'
    bgClass = race.is_featured ? bgClass : 'bg-gray-50'
    footer = (
      <div className="flex items-center justify-between gap-1">
        <span className="text-[11px] font-bold text-gray-600 inline-flex items-center gap-1">
          🔒 Locked
        </span>
        {hasPicks && pick && (
          <span className="text-[11px] text-[var(--text-muted)] font-mono tabular-nums">
            {[pick.win_horse_id, pick.place_horse_id, pick.show_horse_id]
              .map(id => horses.find(h => h.id === id)?.number ?? '—').join('·')}
          </span>
        )}
      </div>
    )
  } else if (hasPicks && upcoming) {
    if (!race.is_featured) bgClass = 'bg-emerald-50'
    borderL = 'border-l-[var(--success)]'
    footer = (
      <div className="flex items-center justify-between gap-1">
        <span className="text-[11px] font-bold text-[var(--success)] inline-flex items-center gap-1">
          ✓ Picked
        </span>
        {pick && (
          <span className="text-[11px] text-[var(--text-muted)] font-mono tabular-nums">
            {[pick.win_horse_id, pick.place_horse_id, pick.show_horse_id]
              .map(id => horses.find(h => h.id === id)?.number ?? '—').join('·')}
          </span>
        )}
      </div>
    )
  } else if (upcoming) {
    if (!race.is_featured) bgClass = 'bg-white'
    borderL = 'border-l-[var(--rose-dark)]'
    footer = (
      <span className="text-[11px] font-bold text-[var(--rose-dark)] inline-flex items-center gap-1">
        🏇 Tap to pick
      </span>
    )
  }

  // Token overlay — small chip if 2x/3x assigned to this race
  const tokenChip = multiplier ? (
    <span className="text-[9px] font-extrabold text-[var(--gold)] bg-white border border-[var(--gold)]/50 px-1 py-0.5 rounded leading-none">
      {multiplier === '3x' ? '×3' : '×2'}
    </span>
  ) : null

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`relative text-left w-full min-h-[120px] p-3 rounded-xl border border-[var(--border)] border-l-[3px] ${borderL} ${bgClass} shadow-sm hover:shadow-md hover:bg-[var(--bg-card-hover)] active:scale-[0.99] transition-all`}
    >
      {/* Scratched-pick corner badge — pulses to nudge the player toward the
          warning banner above the grid. */}
      {hasScratchedPick && (
        <span
          aria-label="One of your picks for this race was scratched"
          className="absolute -top-2 -right-2 z-10 inline-flex items-center justify-center w-7 h-7 rounded-full bg-[var(--warning)] text-white text-sm border-2 border-white shadow-md animate-pulse"
        >
          ⚠️
        </span>
      )}
      <div className="flex items-start justify-between gap-1 mb-1">
        <div className="flex items-center gap-1">
          <span className="text-sm font-extrabold text-[var(--text-muted)]">Race {race.race_number}</span>
          {tokenChip}
        </div>
        {badge}
      </div>
      <div className="font-semibold text-[var(--text-primary)] text-sm truncate" title={race.name}>
        {race.name || `Race ${race.race_number}`}
      </div>
      {/* Post time always visible; the coarse countdown sits underneath it on
          upcoming/open races only — locked/finished tiles drop the second row. */}
      {postTimeText && (
        <div className="text-sm text-[var(--text-muted)] mt-0.5 leading-tight">
          {postTimeText}
          {countdown && (
            <>
              {' · '}
              <span className={`font-bold ${countdown.urgent ? 'text-[var(--warning)]' : 'text-[var(--gold)]'}`}>
                {countdown.text}
              </span>
            </>
          )}
        </div>
      )}
      {/* Mini peer-confidence: only after the race locks (so the bar can't
          steer live picks) and only when 5+ players win-picked. */}
      {(locked || race.status === 'finished') && peerConf && (() => {
        const top = horses.find(h => h.id === peerConf.topHorseId)
        if (!top) return null
        return (
          <div className="text-[11px] text-[var(--text-muted)] mt-0.5 truncate">
            👥 #{top.number} {top.name}{' '}
            <span className="font-bold tabular-nums">{peerConf.topPct}%</span>
          </div>
        )
      })()}
      <div className="mt-2">{footer}</div>
    </button>
  )
}

// ----- RACE INFO MODAL -----
function oddsToValue(odds: string | null | undefined): number {
  if (!odds) return Infinity
  const m = odds.trim().match(/^(\d+(?:\.\d+)?)\s*[\/\-]\s*(\d+(?:\.\d+)?)$/)
  if (m) {
    const denom = parseFloat(m[2])
    if (denom === 0) return Infinity
    return parseFloat(m[1]) / denom
  }
  const n = parseFloat(odds)
  return isNaN(n) ? Infinity : n
}

function RaceInfoModal({
  race, horses, existingPick, playerId, eventId, onSaved, onClose,
  races, multiplier3xRaceId, multiplier2xRaceId, multiplierVisible, peerConf,
}: {
  race: Race
  horses: Horse[]
  existingPick: Pick | null
  playerId: string
  eventId: string
  onSaved?: () => void
  onClose: () => void
  /** Full race list — needed to label tokens that are assigned to a different race. */
  races: Race[]
  multiplier3xRaceId: string | null
  multiplier2xRaceId: string | null
  multiplierVisible: boolean
  /** Per-race confidence summary; null when fewer than 5 players have win-picked. */
  peerConf: RaceConfidence | null
}) {
  const postTimeLocal = parseLocalIso(race.post_time)
  // Sort by post position (number) so the program reads in gate order. Scratched
  // horses stay inline in number order (the user wants them visible with SCR badge).
  const sorted = [...horses].sort((a, b) => a.number - b.number)

  // Identify the morning-line favorite (lowest odds value) among non-scratched horses.
  const favoriteId = (() => {
    let best = Infinity
    let id: string | null = null
    for (const h of horses) {
      if (h.scratched) continue
      const v = oddsToValue(h.morning_line_odds)
      if (v < best) {
        best = v
        id = h.id
      }
    }
    return best === Infinity ? null : id
  })()

  const canPick = race.status === 'upcoming' || race.status === 'open'
  const [pendingHorseId, setPendingHorseId] = useState<string | null>(null)

  async function applyQuickPick(slot: 'win' | 'place' | 'show', horseId: string) {
    if (!canPick) return
    setPendingHorseId(horseId)
    try {
      const cur = {
        win: existingPick?.win_horse_id ?? null,
        place: existingPick?.place_horse_id ?? null,
        show: existingPick?.show_horse_id ?? null,
      }
      const isToggle = cur[slot] === horseId
      // Strip the horse out of any other slot to keep the no-dup invariant.
      if (cur.win === horseId) cur.win = null
      if (cur.place === horseId) cur.place = null
      if (cur.show === horseId) cur.show = null
      cur[slot] = isToggle ? null : horseId

      const payload = {
        win_horse_id: cur.win,
        place_horse_id: cur.place,
        show_horse_id: cur.show,
      }

      if (existingPick) {
        await supabase.from('picks').update(payload).eq('id', existingPick.id)
      } else {
        await supabase.from('picks').insert({
          player_id: playerId,
          race_id: race.id,
          event_id: eventId,
          ...payload,
        })
      }
      onSaved?.()
    } catch (e) {
      console.error(e)
    } finally {
      setPendingHorseId(null)
    }
  }

  function QuickPickBtn({ slot, horseId, label }: { slot: 'win' | 'place' | 'show'; horseId: string; label: string }) {
    const cur = slot === 'win'
      ? existingPick?.win_horse_id
      : slot === 'place'
        ? existingPick?.place_horse_id
        : existingPick?.show_horse_id
    const active = cur === horseId
    const disabled = !canPick || pendingHorseId === horseId
    return (
      <button
        type="button"
        onClick={() => applyQuickPick(slot, horseId)}
        disabled={disabled}
        aria-label={`Pick #${horseId} for ${slot}`}
        className={`shrink-0 h-8 w-10 rounded-md text-[11px] font-bold uppercase tracking-wide transition-colors ${
          active
            ? 'bg-[var(--rose-dark)] text-white shadow-md'
            : 'bg-white text-[var(--text-muted)] border border-[var(--border)] hover:bg-[var(--bg-card-hover)] hover:text-[var(--text-primary)]'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        {label}
      </button>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 26, stiffness: 200 }}
        onClick={e => e.stopPropagation()}
        className="bg-white border-t-2 sm:border-2 border-[var(--border)] sm:rounded-2xl rounded-t-3xl w-full sm:max-w-md sm:max-h-[90vh] max-h-[92vh] overflow-hidden flex flex-col shadow-xl"
      >
        {/* Header */}
        <div className="px-5 pt-4 pb-3 border-b border-[var(--border)] bg-white">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[var(--rose-dark)] text-xs uppercase font-bold tracking-wider">
                Race {race.race_number}
                {race.is_featured && (
                  <span className="ml-2 text-[var(--gold)]">⭐ {race.featured_multiplier}X POINTS</span>
                )}
              </div>
              <h3 className="font-serif text-xl font-bold text-[var(--text-primary)] mt-0.5 leading-tight">
                {race.name || `Race ${race.race_number}`}
              </h3>
              <div className="text-[var(--text-muted)] text-xs mt-1 flex items-center gap-2 flex-wrap">
                {race.distance && <span>{race.distance}</span>}
                {postTimeLocal && (
                  <span>
                    {postTimeLocal.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                  </span>
                )}
                <span>· {sorted.filter(h => !h.scratched).length} {sorted.filter(h => !h.scratched).length === 1 ? 'horse' : 'horses'}</span>
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="shrink-0 w-9 h-9 rounded-full bg-[var(--bg-primary)] hover:bg-[var(--bg-card-hover)] text-[var(--text-primary)] text-xl leading-none flex items-center justify-center transition-colors border border-[var(--border)]"
            >
              ✕
            </button>
          </div>
          {canPick && (
            <p className="mt-2 text-[11px] text-[var(--text-muted)]">
              Tap <span className="text-[var(--rose-dark)] font-semibold">1st / 2nd / 3rd</span> to set Win, Place, Show — picks save instantly.
            </p>
          )}
        </div>

        {/* Horse list */}
        <div className="flex-1 overflow-y-auto px-2 py-2 bg-white">
          {sorted.length === 0 ? (
            <div className="text-[var(--text-muted)] text-sm italic px-4 py-6 text-center">
              No horses listed yet.
            </div>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {sorted.map((h, i) => {
                const stripe = i % 2 === 1 ? 'bg-[var(--bg-primary)]' : ''
                const isFavorite = !h.scratched && h.id === favoriteId
                const rowBg = isFavorite ? 'bg-amber-50' : stripe
                return (
                  <li
                    key={h.id}
                    className={`flex items-center gap-2 px-3 py-2.5 ${rowBg}`}
                  >
                    <span className={`inline-flex items-center justify-center w-9 h-9 rounded-full font-bold text-sm tabular-nums shrink-0 ${
                      h.scratched
                        ? 'bg-gray-100 text-gray-400 border border-gray-300'
                        : isFavorite
                          ? 'bg-[var(--gold)]/30 text-[var(--gold)] border-2 border-[var(--gold)]'
                          : 'bg-[var(--gold)]/10 text-[var(--gold)] border-2 border-[var(--gold)]/40'
                    }`}>
                      {h.number}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-medium flex items-center gap-1.5 ${
                        h.scratched ? 'text-gray-400 line-through' : 'text-[var(--text-primary)]'
                      }`}>
                        <span className="truncate">{h.name}</span>
                        {h.scratched && (
                          <span className="shrink-0 bg-[var(--warning)] text-white text-[9px] font-bold px-1.5 py-0.5 rounded leading-none no-underline">
                            SCR
                          </span>
                        )}
                        {isFavorite && (
                          <span className="shrink-0 text-[10px] text-[var(--gold)] font-bold uppercase tracking-wide">
                            Fav
                          </span>
                        )}
                      </div>
                      {peerConf && !h.scratched && (
                        <PeerConfidenceBar
                          pct={peerConf.pctByHorse[h.id] ?? 0}
                          className="mt-1"
                        />
                      )}
                    </div>
                    <span className={`w-12 text-right text-sm font-mono tabular-nums shrink-0 ${
                      h.scratched ? 'text-gray-400 line-through' : 'text-[var(--text-muted)]'
                    }`}>
                      {h.morning_line_odds || '—'}
                    </span>
                    {!h.scratched && (
                      <div className="flex gap-1 shrink-0">
                        <QuickPickBtn slot="win" horseId={h.id} label="1st" />
                        <QuickPickBtn slot="place" horseId={h.id} label="2nd" />
                        <QuickPickBtn slot="show" horseId={h.id} label="3rd" />
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* Power Play assignment — only when picks are still allowed for this race */}
        {canPick && multiplierVisible && (
          <div className="px-5 py-3 border-t border-[var(--border)] bg-[var(--bg-primary)]">
            <div className="text-[var(--gold)] font-bold text-[11px] uppercase tracking-wider mb-2">
              ⚡ Power Play
            </div>
            <div className="flex flex-wrap gap-2">
              {(['3x', '2x'] as const).map(t => (
                <PowerPlayButton
                  key={t}
                  type={t}
                  thisRaceId={race.id}
                  assignedRaceId={t === '3x' ? multiplier3xRaceId : multiplier2xRaceId}
                  races={races}
                  playerId={playerId}
                />
              ))}
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}

function PowerPlayButton({
  type, thisRaceId, assignedRaceId, races, playerId,
}: {
  type: '3x' | '2x'
  thisRaceId: string
  assignedRaceId: string | null
  races: Race[]
  playerId: string
}) {
  const [busy, setBusy] = useState(false)
  const label = type === '3x' ? '×3' : '×2'
  const field = type === '3x' ? 'multiplier_3x_race_id' : 'multiplier_2x_race_id'
  const onThisRace = assignedRaceId === thisRaceId
  const otherRace = assignedRaceId && !onThisRace
    ? races.find(r => r.id === assignedRaceId)
    : null

  async function applyOrToggle() {
    setBusy(true)
    try {
      const next = onThisRace ? null : thisRaceId
      await supabase.from('players').update({ [field]: next }).eq('id', playerId)
    } finally {
      setBusy(false)
    }
  }

  let cls = 'bg-white border-[var(--gold)]/60 text-[var(--gold)] hover:bg-[var(--gold)]/10'
  let text = `Use ${label} here`
  if (onThisRace) {
    cls = 'bg-[var(--gold)] border-[var(--gold)] text-white shadow-md hover:bg-[var(--gold)]/90'
    text = `✓ ${label} Applied — remove`
  } else if (otherRace) {
    cls = 'bg-white border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--gold)]/60 hover:text-[var(--text-primary)]'
    text = `Switch ${label} to this race`
  }

  return (
    <button
      type="button"
      onClick={applyOrToggle}
      disabled={busy}
      className={`px-3 h-9 rounded-full border-2 text-xs font-bold transition-colors ${cls} ${busy ? 'opacity-60 cursor-wait' : ''}`}
    >
      {text}
    </button>
  )
}

// ----- TOKEN ASSIGN MODAL -----
function TokenAssignModal({
  type, races, player, onAssign, onClose,
}: {
  type: '2x' | '3x'
  races: Race[]
  player: Player
  onAssign: (raceId: string | null) => Promise<void>
  onClose: () => void
}) {
  const eligibleRaces = races.filter(r => r.status === 'open' || r.status === 'upcoming')
  const currentRaceId = type === '3x' ? player.multiplier_3x_race_id : player.multiplier_2x_race_id
  // The race already locked to the OTHER multiplier. Disabled in this list so
  // the player can't assign the same race to both ×3 and ×2 simultaneously.
  const otherSlotRaceId = type === '3x' ? player.multiplier_2x_race_id : player.multiplier_3x_race_id
  const otherSlotLabel = type === '3x' ? '×2' : '×3'

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 26, stiffness: 200 }}
        onClick={e => e.stopPropagation()}
        className="bg-white border-t-2 sm:border-2 border-[var(--border)] sm:rounded-2xl rounded-t-3xl w-full sm:max-w-md max-h-[80vh] overflow-hidden flex flex-col shadow-xl"
      >
        <div className="px-5 pt-4 pb-3 border-b border-[var(--border)] flex items-center justify-between">
          <h3 className="font-serif text-xl font-bold text-[var(--text-primary)]">Assign your {type} token</h3>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-xl">✕</button>
        </div>

        <div className="overflow-y-auto p-4 space-y-2 bg-[var(--bg-primary)]">
          {eligibleRaces.length === 0 ? (
            <p className="text-[var(--text-muted)] text-center py-6">No races available to assign to right now.</p>
          ) : eligibleRaces.map(race => {
            const isCurrent = currentRaceId === race.id
            const isOtherSlot = race.id === otherSlotRaceId
            const stateCls = isOtherSlot
              ? 'border-[var(--border)] bg-gray-50 opacity-60 cursor-not-allowed'
              : isCurrent
                ? 'border-[var(--gold)] bg-amber-50'
                : 'border-[var(--border)] bg-white hover:border-[var(--gold)]/60 hover:bg-[var(--bg-card-hover)]'
            return (
              <button
                key={race.id}
                onClick={() => { if (!isOtherSlot) onAssign(race.id) }}
                disabled={isOtherSlot}
                aria-disabled={isOtherSlot}
                className={`w-full text-left p-3 rounded-xl border-2 transition-all min-h-[60px] flex justify-between items-center ${stateCls}`}
              >
                <div>
                  <div className="text-[var(--text-muted)] text-xs">RACE {race.race_number}</div>
                  <div className="text-[var(--text-primary)] font-semibold">{race.name || `Race ${race.race_number}`}</div>
                  {race.is_featured && <div className="text-[var(--gold)] text-xs">⭐ {race.featured_multiplier}X POINTS</div>}
                  {isOtherSlot && (
                    <div className="text-[var(--text-muted)] text-[11px] italic mt-0.5">
                      already used for {otherSlotLabel}
                    </div>
                  )}
                </div>
                {isCurrent && !isOtherSlot && <span className="text-[var(--gold)] text-xl">✓</span>}
              </button>
            )
          })}
          {currentRaceId && (
            <button
              onClick={() => onAssign(null)}
              className="w-full p-3 rounded-xl border-2 border-red-300 bg-red-50 text-red-700 font-semibold min-h-[48px]"
            >
              Remove assignment
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}

// ----- TOUR OVERLAY -----
function TourOverlay({
  stepIndex, totalSteps, selector, title, body, isLastStep, onNext, onSkip,
}: {
  stepIndex: number
  totalSteps: number
  selector: string
  title: string
  body: string
  isLastStep: boolean
  onNext: () => void
  onSkip: () => void
}) {
  const [target, setTarget] = useState<HTMLElement | null>(null)
  const [, setTick] = useState(0)

  // Find the target on mount + on selector change. Re-query a few times so
  // freshly-rendered elements (e.g. a card we just expanded) get picked up.
  useEffect(() => {
    let cancelled = false
    const find = () => {
      if (cancelled) return
      const el = document.querySelector(selector) as HTMLElement | null
      setTarget(el)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
    find()
    const t1 = setTimeout(find, 80)
    const t2 = setTimeout(find, 240)
    const t3 = setTimeout(() => setTick(t => t + 1), 600) // re-measure after smooth scroll settles
    return () => {
      cancelled = true
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
    }
  }, [selector])

  // Re-render on scroll/resize so the spotlight tracks the target as the page moves.
  useEffect(() => {
    const handler = () => setTick(t => t + 1)
    window.addEventListener('scroll', handler, { passive: true })
    window.addEventListener('resize', handler)
    return () => {
      window.removeEventListener('scroll', handler)
      window.removeEventListener('resize', handler)
    }
  }, [])

  if (!target) {
    // Fallback while we haven't found the target yet — render a click-blocker
    // so users can't accidentally interact with the page during the (very brief)
    // gap between step transitions.
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[99] bg-black/70"
      />
    )
  }

  const rect = target.getBoundingClientRect()
  const vw = typeof window !== 'undefined' ? window.innerWidth : 0
  const vh = typeof window !== 'undefined' ? window.innerHeight : 0

  // Tooltip placement.
  const tooltipWidth = Math.min(360, vw - 32)
  const tooltipHeightEstimate = 220
  const margin = 22
  const spaceBelow = vh - rect.bottom
  const spaceAbove = rect.top
  const placeBelow = spaceBelow >= tooltipHeightEstimate + margin || spaceBelow > spaceAbove

  const tooltipTop = placeBelow
    ? Math.min(rect.bottom + margin, vh - tooltipHeightEstimate - margin)
    : Math.max(margin, rect.top - margin - tooltipHeightEstimate)

  const tooltipLeft = Math.max(
    16,
    Math.min(vw - tooltipWidth - 16, rect.left + rect.width / 2 - tooltipWidth / 2)
  )

  return (
    <>
      {/* Click-blocker behind the spotlight + tooltip. Captures any clicks that
          would otherwise reach the dimmed area of the page. */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[99]"
        onClick={onSkip}
      />

      {/* Spotlight: 9999px shroud + gold ring + pulsing glow, all in one box-shadow.
          pointer-events:none so the underlying click-blocker still catches clicks
          on the highlighted area. */}
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0 }}
        transition={{ type: 'spring', damping: 22, stiffness: 260 }}
        className="tour-spotlight"
        style={{
          position: 'fixed',
          top: rect.top - 8,
          left: rect.left - 8,
          width: rect.width + 16,
          height: rect.height + 16,
          borderRadius: 14,
          pointerEvents: 'none',
          zIndex: 100,
        }}
      />

      {/* Tooltip card */}
      <motion.div
        initial={{ opacity: 0, y: placeBelow ? -10 : 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        className="fixed z-[101]"
        style={{
          top: tooltipTop,
          left: tooltipLeft,
          width: tooltipWidth,
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Animated arrow pointing at the target */}
        <div
          aria-hidden
          className={`absolute left-1/2 -translate-x-1/2 ${placeBelow ? '-top-8' : '-bottom-8'} text-3xl text-[var(--gold)] animate-bounce select-none drop-shadow-[0_0_8px_rgba(201,168,76,0.6)]`}
        >
          {placeBelow ? '↑' : '↓'}
        </div>

        <div className="bg-white border-2 border-[var(--gold)]/60 rounded-2xl p-5 shadow-2xl shadow-[var(--gold)]/20">
          <div className="text-[10px] text-[var(--gold)] font-bold uppercase tracking-wider mb-1">
            Step {stepIndex + 1} of {totalSteps}
          </div>
          <h3 className="font-serif text-xl text-[var(--text-primary)] font-bold mb-2 leading-tight">
            {title}
          </h3>
          <p className="text-[var(--text-muted)] text-sm leading-relaxed mb-4">
            {body}
          </p>
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onSkip}
              className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-sm font-semibold underline-offset-2 hover:underline"
            >
              Skip Tour
            </button>
            <button
              type="button"
              onClick={onNext}
              className="px-5 h-10 rounded-full bg-[var(--gold)] text-[var(--text-primary)] font-bold text-sm shadow-md hover:bg-[var(--gold)]/90 active:scale-[0.97] transition-all"
            >
              {isLastStep ? 'Got it! 🏇' : 'Next →'}
            </button>
          </div>
        </div>
      </motion.div>
    </>
  )
}

// ----- CHANGE AVATAR MODAL -----
function ChangeAvatarModal({
  player, takenAvatars, onPick, onClose,
}: {
  player: Player
  takenAvatars: string[]
  onPick: (avatarId: string) => Promise<void>
  onClose: () => void
}) {
  const [pending, setPending] = useState<string | null>(null)
  const sampler = useAvatarSampler({ currentId: player.avatar })
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center"
    >
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 26, stiffness: 200 }}
        onClick={e => e.stopPropagation()}
        className="bg-white border-t-2 sm:border-2 border-[var(--border)] sm:rounded-2xl rounded-t-3xl w-full sm:max-w-md max-h-[88vh] overflow-hidden flex flex-col shadow-xl"
      >
        <div className="px-5 pt-4 pb-3 border-b border-[var(--border)] flex items-center justify-between">
          <h3 className="font-serif text-xl font-bold text-[var(--text-primary)]">Change Avatar</h3>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-xl">✕</button>
        </div>
        <div className="overflow-y-auto p-3 bg-[var(--bg-primary)]">
          <p className="text-[var(--text-muted)] text-xs text-center mb-3">
            Tap a new avatar to switch. Grayed-out avatars are taken by other players.
          </p>
          <div className="grid grid-cols-5 gap-2">
            {sampler.visible.map(av => {
              const taken = takenAvatars.includes(av.id) // doesn't include current player
              const isCurrent = av.id === player.avatar
              const isPending = pending === av.id
              return (
                <button
                  key={av.id}
                  disabled={taken || isPending}
                  onClick={async () => {
                    if (taken || isCurrent) return
                    setPending(av.id)
                    try { await onPick(av.id) } finally { setPending(null) }
                  }}
                  title={taken ? 'Taken' : av.label}
                  className={`
                    relative aspect-square flex items-center justify-center rounded-xl border-2 transition-all min-h-[64px]
                    ${isCurrent
                      ? 'border-[var(--gold)] bg-amber-50'
                      : taken
                        ? 'border-[var(--border)] bg-gray-50 opacity-40'
                        : 'border-[var(--border)] bg-white hover:border-[var(--gold)]/60 hover:bg-[var(--bg-card-hover)]'}
                    ${isPending ? 'opacity-50' : ''}
                  `}
                >
                  <AvatarIcon id={av.id} className="w-full h-full p-0.5" />
                  {isCurrent && (
                    <span className="absolute top-0.5 right-0.5 bg-[var(--gold)] text-white text-[8px] font-bold rounded-full w-4 h-4 flex items-center justify-center">✓</span>
                  )}
                </button>
              )
            })}
          </div>

          <div className="flex items-center justify-between gap-3 mt-3 px-1">
            {!sampler.expanded ? (
              <>
                <button
                  type="button"
                  onClick={sampler.shuffle}
                  className="text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] font-medium"
                >
                  🔀 Shuffle
                </button>
                <button
                  type="button"
                  onClick={sampler.expand}
                  className="text-sm text-[var(--gold)] hover:text-[var(--gold)]/80 font-medium"
                >
                  See all {sampler.total} →
                </button>
              </>
            ) : (
              <>
                <span className="text-sm text-[var(--text-muted)]">Showing all {sampler.total}</span>
                <button
                  type="button"
                  onClick={sampler.collapse}
                  className="text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] font-medium"
                >
                  Show fewer
                </button>
              </>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
