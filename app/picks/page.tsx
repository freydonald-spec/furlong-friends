'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { AvatarIcon, useAvatarSampler } from '@/lib/avatars'
import { parseLocalIso } from '@/lib/time'
import { WatchPartyBadge } from '@/lib/watch-party-badge'
import type { Event, Race, Horse, Player, Pick, Score } from '@/lib/types'

export default function PicksPage() {
  const router = useRouter()
  const [event, setEvent] = useState<Event | null>(null)
  const [player, setPlayer] = useState<Player | null>(null)
  const [allPlayers, setAllPlayers] = useState<Player[]>([])
  const [races, setRaces] = useState<Race[]>([])
  const [horsesByRace, setHorsesByRace] = useState<Record<string, Horse[]>>({})
  const [picks, setPicks] = useState<Pick[]>([])
  const [allScores, setAllScores] = useState<Score[]>([])
  const [revealedRaces, setRevealedRaces] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())

  const [infoModalRaceId, setInfoModalRaceId] = useState<string | null>(null)
  const [tokenAssignType, setTokenAssignType] = useState<'2x' | '3x' | null>(null)
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set())
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
  // Picks ref: realtime callbacks need to read picks without going stale.
  const picksRef = useRef<Pick[]>([])
  useEffect(() => { picksRef.current = picks }, [picks])

  // ----- First-run tutorial tour -----
  const [tourActive, setTourActive] = useState(false)
  const [tourStepIdx, setTourStepIdx] = useState(0)
  const tourAutoStartedRef = useRef(false)

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

  // Auto-start the tour for first-time players once data has loaded.
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (loading) return
    if (tourAutoStartedRef.current) return
    if (races.length === 0) return
    if (tourSteps.length === 0) return
    if (localStorage.getItem('furlong_tour_seen')) return
    tourAutoStartedRef.current = true
    setTourStepIdx(0)
    setTourActive(true)
    tourSteps[0].prepare?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, races.length, tourSteps.length])

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
      const raceList = racesRows ?? []
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
              const existing = prev.find(x => x.id === r.id)
              if (existing) return prev.map(x => x.id === r.id ? r : x).sort((a, b) => a.race_number - b.race_number)
              return [...prev, r].sort((a, b) => a.race_number - b.race_number)
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

  // Race tab strip: refs to each race card + active race tracker via IntersectionObserver.
  const raceCardRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map())
  const tabStripRef = useRef<HTMLDivElement>(null)
  const tabScrollerRef = useRef<HTMLDivElement>(null)
  const [activeRaceId, setActiveRaceId] = useState<string | null>(null)
  const [showLeftFade, setShowLeftFade] = useState(false)
  const [showRightFade, setShowRightFade] = useState(false)

  useEffect(() => {
    if (races.length === 0) return
    const observer = new IntersectionObserver(
      entries => {
        const visible = entries.filter(e => e.isIntersecting)
        if (visible.length === 0) return
        visible.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        const top = visible[0]
        const id = top.target.getAttribute('data-race-id')
        if (id) setActiveRaceId(id)
      },
      { rootMargin: '-80px 0px -60% 0px', threshold: 0 }
    )
    raceCardRefs.current.forEach(el => observer.observe(el))
    return () => observer.disconnect()
  }, [races])

  // Keep the active tab visible inside the horizontally scrolling strip.
  useEffect(() => {
    if (!activeRaceId) return
    const tab = tabRefs.current.get(activeRaceId)
    tab?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }, [activeRaceId])

  function scrollToRace(raceId: string) {
    const el = raceCardRefs.current.get(raceId)
    if (!el) return
    const stripHeight = tabStripRef.current?.offsetHeight ?? 0
    const cardTop = el.getBoundingClientRect().top + window.scrollY
    window.scrollTo({ top: cardTop - stripHeight - 12, behavior: 'smooth' })
  }

  // Track scroll position of the tab strip to drive fade indicators + arrow visibility.
  useEffect(() => {
    const el = tabScrollerRef.current
    if (!el) return
    const update = () => {
      const left = el.scrollLeft > 4
      const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 4
      // eslint-disable-next-line no-console
      console.log('[tabs]', {
        scrollLeft: el.scrollLeft,
        clientWidth: el.clientWidth,
        scrollWidth: el.scrollWidth,
        racesCount: races.length,
        showLeftFade: left,
        showRightFade: right,
      })
      setShowLeftFade(left)
      setShowRightFade(right)
    }
    // Optimistic bias: with many races we almost certainly overflow on every
    // viewport, so show the right arrow immediately. Real measurements below
    // override this once layout has settled.
    if (races.length > 8) setShowRightFade(true)
    update()
    const t1 = setTimeout(update, 100)
    const t2 = setTimeout(update, 300)
    el.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      el.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [races.length])

  function scrollStripBy(direction: 'left' | 'right') {
    const el = tabScrollerRef.current
    if (!el || races.length === 0) return
    const tabAvgWidth = el.scrollWidth / races.length
    const delta = tabAvgWidth * 3 * (direction === 'left' ? -1 : 1)
    el.scrollBy({ left: delta, behavior: 'smooth' })
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

  // Locking alert: races within 5 minutes of post time that the player hasn't
  // picked yet. Banner switches into urgent (red, pulsing) under 1 minute.
  const lockingSoon = useMemo(() => {
    if (!races.length || !player) return [] as Race[]
    return races
      .filter(r => {
        if (r.status !== 'open' && r.status !== 'upcoming') return false
        const target = parseLocalIso(r.post_time)
        if (!target) return false
        const secondsUntil = (target.getTime() - now) / 1000
        if (secondsUntil > 300 || secondsUntil < 0) return false
        const hasPick = picks.some(p => p.race_id === r.id && (p.win_horse_id || p.place_horse_id || p.show_horse_id))
        return !hasPick && !dismissedAlerts.has(r.id)
      })
  }, [races, player, picks, now, dismissedAlerts])

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-3 animate-pulse">🏇</div>
          <p className="text-white/70 text-lg">Loading the field...</p>
        </div>
      </main>
    )
  }

  if (!player || !event) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6 text-center">
        <div>
          <p className="text-white/80 mb-4">{error ?? "Couldn't find your player record."}</p>
          <Link href="/join" className="inline-block px-6 h-12 leading-[3rem] rounded-full bg-[var(--rose-dark)] border-2 border-[var(--gold)]/60 text-white font-bold">
            Join the game
          </Link>
        </div>
      </main>
    )
  }

  const totalPlayers = allPlayers.length

  return (
    <main className="min-h-screen pb-24">
      {/* Alert banners */}
      <AnimatePresence>
        {adminAlert && (
          <motion.div
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            className="sticky top-0 z-30 bg-amber-500/95 text-amber-950 px-4 py-3 flex items-center justify-between shadow-lg"
          >
            <span className="font-semibold text-sm">⚠️ {adminAlert}</span>
            <button onClick={() => setAdminAlert(null)} className="text-amber-950/80 ml-3 px-2 font-bold">✕</button>
          </motion.div>
        )}
        {lockingSoon.map(race => {
          const target = parseLocalIso(race.post_time)
          const secsLeft = target ? Math.max(0, Math.round((target.getTime() - now) / 1000)) : 0
          const m = Math.floor(secsLeft / 60)
          const s = secsLeft % 60
          const urgent = secsLeft < 60
          return (
            <motion.div
              key={race.id}
              initial={{ y: -100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -100, opacity: 0 }}
              className={`sticky top-0 z-20 px-4 py-3 flex items-center justify-between shadow-lg ${urgent ? 'bg-red-600/95 text-white animate-pulse' : 'bg-amber-400/95 text-amber-950'}`}
            >
              <span className="font-semibold text-sm">
                ⚠️ Race {race.race_number} locks in {m}:{String(s).padStart(2, '0')} — make your picks!
              </span>
              <button
                onClick={() => setDismissedAlerts(prev => new Set([...prev, race.id]))}
                className={`ml-3 px-2 font-bold ${urgent ? 'text-white/85' : 'text-amber-950/70'}`}
              >✕</button>
            </motion.div>
          )
        })}
        {lockedToasts.map(t => (
          <motion.div
            key={`lock-${t.id}`}
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            transition={{ type: 'spring', damping: 24, stiffness: 260 }}
            className="sticky top-0 z-30 bg-[var(--rose-dark)]/95 text-white px-4 py-3 shadow-lg border-b-2 border-[var(--gold)]/40"
          >
            <span className="font-semibold text-sm">
              🔒 Race {t.raceNumber} just locked! No more changes.
            </span>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Player Hero */}
      <section className="px-5 pt-6 pb-4">
        <div className="max-w-2xl mx-auto bg-gradient-to-br from-[var(--rose-dark)] to-[#5a0f1d] rounded-2xl p-5 border-2 border-[var(--gold)]/40 shadow-lg relative overflow-hidden">
          <div className="absolute -top-8 -right-8 text-9xl opacity-10">🌹</div>
          <button
            type="button"
            onClick={startTour}
            title="How to Play"
            aria-label="How to play"
            className="absolute top-3 right-3 z-10 inline-flex items-center gap-1.5 px-3 h-8 rounded-full bg-[var(--gold)]/15 border border-[var(--gold)]/60 text-[var(--gold)] hover:bg-[var(--gold)]/25 text-xs font-bold"
          >
            <span aria-hidden>?</span>
            <span className="hidden sm:inline">How to Play</span>
          </button>
          <div className="flex items-start gap-4 relative">
            <button
              type="button"
              onClick={() => setChangeAvatarOpen(true)}
              title="Change avatar"
              className="relative shrink-0 group"
            >
              <AvatarIcon id={player.avatar} className="w-20 h-20 rounded-xl shadow-md" />
              <span className="absolute -bottom-1 -right-1 bg-[var(--gold)] text-black text-[10px] font-bold rounded-full w-6 h-6 flex items-center justify-center border-2 border-[var(--rose-dark)] group-hover:scale-110 transition-transform">
                ✎
              </span>
            </button>
            <div className="flex-1 min-w-0">
              <h2 className="font-serif text-2xl font-bold text-white truncate">{player.name}</h2>
              <button
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    localStorage.removeItem('furlong_player_id')
                    localStorage.removeItem('furlong_player_name')
                  }
                  router.push('/')
                }}
                className="text-white/55 hover:text-white text-xs underline underline-offset-2 mt-0.5"
              >
                Not you?
              </button>
              <p className="text-[var(--gold)]/80 text-sm font-serif italic mt-1">{event.name}</p>
              <div className="flex gap-4 mt-2">
                <div>
                  <div className="text-[var(--gold)] text-2xl font-bold leading-none">{myTotalScore}</div>
                  <div className="text-white/60 text-xs uppercase tracking-wide">Points</div>
                </div>
                <div>
                  <div className="text-[var(--gold)] text-2xl font-bold leading-none">
                    #{myRank}<span className="text-white/50 text-sm font-normal"> / {totalPlayers}</span>
                  </div>
                  <div className="text-white/60 text-xs uppercase tracking-wide">Rank</div>
                </div>
              </div>
            </div>
          </div>
          <button
            onClick={() => setChangeAvatarOpen(true)}
            className="mt-3 text-xs font-semibold text-[var(--gold)] hover:text-white border border-[var(--gold)]/40 rounded-full px-3 h-8 inline-flex items-center"
          >
            🎨 Change Avatar
          </button>
        </div>
      </section>

      {/* Multiplier Tokens */}
      {event.multiplier_visible && (
        <section className="px-5 pb-4" data-tour-bonus-tokens="true">
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[var(--gold)] text-sm uppercase tracking-wider font-bold flex items-center gap-2">
                <span aria-hidden>✨</span> Your Bonus Tokens
              </h3>
              <span className="text-white/45 text-[10px] uppercase tracking-wide">multiply your points</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <TokenCard
                type="3x"
                assignedRaceId={player.multiplier_3x_race_id}
                races={races}
                onAssign={() => setTokenAssignType('3x')}
              />
              <TokenCard
                type="2x"
                assignedRaceId={player.multiplier_2x_race_id}
                races={races}
                onAssign={() => setTokenAssignType('2x')}
              />
            </div>
            <p className="text-white/45 text-[11px] mt-3 text-center italic">
              Unassigned tokens auto-apply at race time · 3× → Race 14 · 2× → Race 13
            </p>
          </div>
        </section>
      )}

      {/* Race Cards */}
      <section className="px-5">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-end justify-between mb-2 gap-3">
            <h3 className="text-white/80 text-sm uppercase tracking-wider font-semibold">
              Races
            </h3>
            {races.length > 1 && (() => {
              const allExpanded = races.every(r => expandedRaces.has(r.id))
              return (
                <button
                  onClick={() => setExpandedRaces(allExpanded ? new Set() : new Set(races.map(r => r.id)))}
                  className="text-white/65 hover:text-white text-xs font-semibold underline-offset-2 hover:underline"
                >
                  {allExpanded ? 'Collapse All' : 'Expand All'}
                </button>
              )
            })()}
          </div>
          {races.length === 0 ? (
            <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center text-white/60">
              No races posted yet. The host will set them up before post time.
            </div>
          ) : (
            <>
              {/* Race progress indicator */}
              {(() => {
                const finishedCount = races.filter(r => r.status === 'finished').length
                return (
                  <div className="mb-3 px-1">
                    <div className="flex items-center justify-between text-[11px] text-white/65 mb-1.5">
                      <span className="uppercase tracking-wider font-bold text-white/55">Day Progress</span>
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
                                : 'bg-white/10'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                )
              })()}

              {/* Race tab strip — sticky horizontal nav with fade indicators + desktop arrows */}
              <div
                ref={tabStripRef}
                className="sticky top-0 z-10 -mx-2 mb-3 bg-[var(--dark)]/95 backdrop-blur-sm border-b border-white/10 rounded-b-lg"
              >
                <div className="relative">
                  {/* Left fade */}
                  <div
                    className={`pointer-events-none absolute left-0 top-0 bottom-0 w-12 z-10 bg-gradient-to-r from-[var(--dark)] via-[var(--dark)]/80 to-transparent transition-opacity duration-200 ${showLeftFade ? 'opacity-100' : 'opacity-0'}`}
                  />
                  {/* Right fade */}
                  <div
                    className={`pointer-events-none absolute right-0 top-0 bottom-0 w-12 z-10 bg-gradient-to-l from-[var(--dark)] via-[var(--dark)]/80 to-transparent transition-opacity duration-200 ${showRightFade ? 'opacity-100' : 'opacity-0'}`}
                  />
                  {/* Left arrow */}
                  {showLeftFade && (
                    <button
                      type="button"
                      onClick={() => scrollStripBy('left')}
                      aria-label="Scroll tabs left"
                      className="flex absolute left-2 top-1/2 -translate-y-1/2 z-20 w-8 h-8 items-center justify-center rounded-full bg-white text-[var(--dark)] shadow-lg text-lg font-bold leading-none hover:bg-[var(--gold)] transition-colors"
                    >
                      ‹
                    </button>
                  )}
                  {/* Right arrow */}
                  {showRightFade && (
                    <button
                      type="button"
                      onClick={() => scrollStripBy('right')}
                      aria-label="Scroll tabs right"
                      className="flex absolute right-2 top-1/2 -translate-y-1/2 z-20 w-8 h-8 items-center justify-center rounded-full bg-white text-[var(--dark)] shadow-lg text-lg font-bold leading-none hover:bg-[var(--gold)] transition-colors"
                    >
                      ›
                    </button>
                  )}
                  <div
                    ref={tabScrollerRef}
                    className="flex gap-2 overflow-x-scroll px-12 py-2 [&::-webkit-scrollbar]:hidden"
                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', touchAction: 'pan-x', WebkitOverflowScrolling: 'touch' }}
                  >
                    {races.map(r => {
                      const active = r.id === activeRaceId
                      const finished = r.status === 'finished'
                      const locked = r.status === 'locked'
                      const icon = finished ? '✅' : locked ? '🔒' : null
                      const stateClass = active
                        ? 'bg-[var(--gold)] text-[var(--dark)] font-bold shadow-md ring-2 ring-[var(--gold)]/40'
                        : locked
                          ? 'bg-[var(--rose-dark)]/30 text-rose-100 border border-[var(--rose-dark)]/70 opacity-90'
                          : finished
                            ? 'bg-emerald-900/30 text-emerald-200/80 border border-emerald-700/40 opacity-70'
                            : 'bg-white/5 text-[var(--cream)] border border-white/10 hover:bg-white/10 hover:text-white'
                      return (
                        <button
                          key={r.id}
                          ref={el => {
                            if (el) tabRefs.current.set(r.id, el)
                            else tabRefs.current.delete(r.id)
                          }}
                          onClick={() => scrollToRace(r.id)}
                          className={`flex-shrink-0 px-4 py-2 rounded-full text-base font-semibold whitespace-nowrap transition-colors ${stateClass}`}
                        >
                          {icon ? <span className="mr-1">{icon}</span> : null}R{r.race_number}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {races.map((race, idx) => (
                <div
                  key={race.id}
                  data-race-id={race.id}
                  data-tour-first={idx === 0 ? 'true' : undefined}
                  data-tour-featured={race.is_featured ? 'true' : undefined}
                  ref={el => {
                    if (el) raceCardRefs.current.set(race.id, el)
                    else raceCardRefs.current.delete(race.id)
                  }}
                >
                  <RaceCard
                    race={race}
                    horses={horsesByRace[race.id] ?? []}
                    pick={picks.find(p => p.race_id === race.id) ?? null}
                    score={allScores.find(s => s.race_id === race.id && s.player_id === player.id) ?? null}
                    scoreRevealed={effectiveRevealed.has(race.id)}
                    multiplier={
                      player.multiplier_3x_race_id === race.id ? '3x' :
                      player.multiplier_2x_race_id === race.id ? '2x' : null
                    }
                    multiplierVisible={event.multiplier_visible}
                    now={now}
                    expanded={expandedRaces.has(race.id)}
                    onToggle={() => setExpandedRaces(prev => {
                      const next = new Set(prev)
                      if (next.has(race.id)) next.delete(race.id)
                      else next.add(race.id)
                      return next
                    })}
                    onOpenRaceInfo={() => setInfoModalRaceId(race.id)}
                  />
                </div>
              ))}
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
            <div className="max-w-2xl mx-auto bg-gradient-to-r from-[var(--gold)] to-[#E8C96A] text-[var(--dark)] rounded-xl px-4 py-3 shadow-lg flex items-center justify-between gap-3 border-2 border-[var(--gold)]/80">
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
                className="text-[var(--dark)]/80 hover:text-[var(--dark)] font-bold text-lg leading-none px-2"
              >✕</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-[var(--dark)]/95 border-t border-white/10 backdrop-blur-sm z-10">
        <div className="max-w-2xl mx-auto flex">
          <Link href="/" className="flex-1 py-3 text-center text-white/60 hover:text-white text-sm">
            🏠 Home
          </Link>
          <Link href="/track" data-tour-live-track="true" className="flex-1 py-3 text-center text-[var(--gold)] hover:text-[var(--gold)]/80 text-sm font-semibold">
            🏁 Live Track
          </Link>
          <Link href="/leaderboard" className="flex-1 py-3 text-center text-white/60 hover:text-white text-sm">
            📊 Leaderboard
          </Link>
        </div>
      </nav>

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

// ----- TOKEN CARD -----
function TokenCard({
  type, assignedRaceId, races, onAssign,
}: {
  type: '2x' | '3x'
  assignedRaceId: string | null
  races: Race[]
  onAssign: () => void
}) {
  const race = races.find(r => r.id === assignedRaceId)
  const locked = !!race && (race.status === 'locked' || race.status === 'finished')
  const isAssigned = !!race
  const isGold = type === '3x'

  return (
    <motion.button
      onClick={onAssign}
      disabled={locked}
      whileHover={locked ? undefined : { scale: 1.025, y: -2 }}
      whileTap={locked ? undefined : { scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 360, damping: 22 }}
      className={`
        relative rounded-2xl border-2 overflow-hidden text-left
        min-h-[120px] p-3 pl-2
        ${isGold
          ? 'bg-gradient-to-br from-[#e2c569] via-[#C9A84C] to-[#8e6c1c] border-[#fef3c7]/70 shadow-lg shadow-[var(--gold)]/30'
          : 'bg-gradient-to-br from-white/20 via-white/10 to-white/5 border-white/50 shadow-md shadow-white/10'}
        ${locked ? 'opacity-75 cursor-not-allowed' : ''}
      `}
    >
      {/* Shimmer sweep — only when unassigned & unlocked, to invite a tap */}
      {!isAssigned && !locked && (
        <motion.div
          aria-hidden
          initial={{ x: '-120%' }}
          animate={{ x: '220%' }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'linear', delay: isGold ? 0 : 1.2 }}
          className="absolute inset-y-0 w-1/2 pointer-events-none"
          style={{
            background: 'linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.35) 50%, transparent 70%)',
          }}
        />
      )}

      <div className="relative flex items-center gap-3">
        {/* Big circular badge */}
        <motion.div
          animate={isAssigned || locked ? undefined : { scale: [1, 1.08, 1] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
          className={`
            shrink-0 w-16 h-16 rounded-full flex items-center justify-center
            font-serif font-extrabold text-2xl leading-none
            ${isGold
              ? 'bg-[#1a0a05] text-[var(--gold)] ring-[3px] ring-[var(--gold)] shadow-inner'
              : 'bg-[var(--dark)] text-white ring-[3px] ring-white shadow-inner'}
          `}
        >
          {type.toUpperCase()}
        </motion.div>

        <div className="flex-1 min-w-0 self-stretch flex flex-col justify-center">
          <div className={`text-[10px] font-extrabold uppercase tracking-wider ${isGold ? 'text-black/65' : 'text-white/65'}`}>
            Bonus Token
          </div>
          {isAssigned ? (
            <>
              <div className={`text-base font-bold leading-tight ${isGold ? 'text-black' : 'text-white'}`}>
                Race {race!.race_number}
              </div>
              <div className={`text-xs truncate ${isGold ? 'text-black/75' : 'text-white/75'}`}>
                {race!.name || `Race ${race!.race_number}`}
              </div>
              {locked ? (
                <div className={`text-[10px] mt-0.5 font-bold ${isGold ? 'text-red-900/85' : 'text-amber-300'}`}>
                  🔒 Locked in
                </div>
              ) : (
                <div className={`text-[10px] mt-0.5 font-semibold ${isGold ? 'text-black/60' : 'text-white/55'}`}>
                  Tap to reassign →
                </div>
              )}
            </>
          ) : (
            <>
              <div className={`text-base font-extrabold leading-tight ${isGold ? 'text-black' : 'text-white'}`}>
                Tap to assign!
              </div>
              <div className={`text-[11px] mt-0.5 ${isGold ? 'text-black/70' : 'text-white/70'}`}>
                Pick any race to {type === '3x' ? 'triple' : 'double'} your points
              </div>
            </>
          )}
        </div>
      </div>
    </motion.button>
  )
}

// ----- RACE CARD -----
function RaceCard({
  race, horses, pick, score, scoreRevealed, multiplier, multiplierVisible, now,
  expanded, onToggle, onOpenRaceInfo,
}: {
  race: Race
  horses: Horse[]
  pick: Pick | null
  score: Score | null
  scoreRevealed: boolean
  multiplier: '2x' | '3x' | null
  multiplierVisible: boolean
  now: number
  expanded: boolean
  onToggle: () => void
  onOpenRaceInfo: () => void
}) {
  const horseById = (id: string | null) => horses.find(h => h.id === id) ?? null
  const winHorse = horses.find(h => h.finish_position === 1)
  const placeHorse = horses.find(h => h.finish_position === 2)
  const showHorse = horses.find(h => h.finish_position === 3)
  const finished = race.status === 'finished' && scoreRevealed

  const slotColor = (slot: 'win' | 'place' | 'show', horseId: string | null) => {
    if (!finished || !horseId) return 'border-white/10'
    const correctHorseId =
      slot === 'win' ? winHorse?.id :
      slot === 'place' ? placeHorse?.id : showHorse?.id
    if (horseId === correctHorseId) return 'border-emerald-400 bg-emerald-500/15'
    if (horseId === winHorse?.id || horseId === placeHorse?.id || horseId === showHorse?.id) {
      return 'border-amber-400 bg-amber-400/10'
    }
    return 'border-red-500/60 bg-red-500/10'
  }

  const statusBadge = (() => {
    switch (race.status) {
      case 'upcoming': return { label: 'Upcoming', cls: 'bg-white/10 text-white/70' }
      case 'open':     return { label: 'Open', cls: 'bg-emerald-600/30 text-emerald-200' }
      case 'locked':   return { label: '🔒 Locked', cls: 'bg-amber-600/30 text-amber-200' }
      case 'finished': return { label: '🏁 Finished', cls: 'bg-[var(--rose-dark)]/40 text-white' }
    }
  })()

  // Live countdown for races still accepting picks. Hides once locked/finished.
  // H:MM (no seconds) at ≥1h, M:SS under 1h. Color/pulse escalate as post time
  // approaches: white (>5m) → gold solid (<5m) → red solid pulsing (<1m).
  const postTimeLocal = parseLocalIso(race.post_time)
  const countdown = (() => {
    if (race.status === 'locked' || race.status === 'finished') return null
    if (!postTimeLocal) return null
    const ms = postTimeLocal.getTime() - now
    const secondsLeft = Math.floor(ms / 1000)
    if (secondsLeft < 0) {
      return {
        text: 'POST TIME',
        secondsLeft: -1,
        cls: 'bg-red-600 text-white border-red-400',
        pulse: false,
        atPost: true,
      }
    }
    const h = Math.floor(secondsLeft / 3600)
    const m = Math.floor((secondsLeft % 3600) / 60)
    const s = secondsLeft % 60
    const text = h > 0
      ? `${h}:${String(m).padStart(2, '0')}`
      : `${m}:${String(s).padStart(2, '0')}`
    if (secondsLeft < 60) {
      return { text, secondsLeft, cls: 'bg-red-600 text-white border-red-400', pulse: true, atPost: false }
    }
    if (secondsLeft < 300) {
      return { text, secondsLeft, cls: 'bg-[var(--gold)] text-[var(--dark)] border-[var(--gold)]', pulse: false, atPost: false }
    }
    return { text, secondsLeft, cls: 'bg-white/10 text-white border-white/25', pulse: false, atPost: false }
  })()

  const canPick = race.status === 'open' || race.status === 'upcoming'

  const tokenBoost = multiplierVisible ? multiplier : null
  const cardClasses =
    tokenBoost === '3x'
      ? 'border-[var(--gold)] bg-gradient-to-br from-[var(--gold)]/15 via-[var(--rose-dark)]/25 to-black/40 shadow-lg shadow-[var(--gold)]/20'
      : tokenBoost === '2x'
        ? 'border-white/70 bg-gradient-to-br from-white/15 via-white/5 to-black/40 shadow-md shadow-white/10'
        : race.is_featured
          ? 'border-[var(--gold)]/60 bg-gradient-to-br from-[var(--rose-dark)]/30 to-black/40'
          : 'border-white/15 bg-white/5'

  // One-line picks summary used in the always-visible (collapsed) header.
  const hasPicks = !!(pick && (pick.win_horse_id || pick.place_horse_id || pick.show_horse_id))
  const pickSummary = hasPicks ? (
    <>
      <span>🥇 {horseById(pick!.win_horse_id)?.name ?? '—'}</span>
      <span className="mx-2 text-white/30">·</span>
      <span>🥈 {horseById(pick!.place_horse_id)?.name ?? '—'}</span>
      <span className="mx-2 text-white/30">·</span>
      <span>🥉 {horseById(pick!.show_horse_id)?.name ?? '—'}</span>
    </>
  ) : (
    <span className="italic text-white/45">No picks yet</span>
  )

  return (
    <div
      onClick={onToggle}
      role="button"
      tabIndex={0}
      aria-expanded={expanded}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle() } }}
      className={`relative rounded-xl border-2 p-4 cursor-pointer ${cardClasses}`}
    >
      {/* Token ribbon — sits at the top-right corner when this race is boosted */}
      {tokenBoost && (
        <div className="absolute -top-3 right-3 z-10">
          <div
            className={`
              inline-flex items-center gap-1 px-3 py-1 rounded-full
              font-serif font-extrabold text-[11px] uppercase tracking-wider
              shadow-lg
              ${tokenBoost === '3x'
                ? 'bg-gradient-to-br from-[#fef3c7] via-[var(--gold)] to-[#a87f1c] text-[var(--rose-dark)] border-2 border-[var(--gold)]'
                : 'bg-gradient-to-br from-white via-white to-gray-200 text-[var(--dark)] border-2 border-white/80'}
            `}
          >
            <span aria-hidden>✨</span>
            {tokenBoost} BONUS
          </div>
        </div>
      )}

      {/* Header — always visible (collapsed view) */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-white/50 text-xs font-mono">RACE {race.race_number}</span>
            {race.is_featured && (
              <span className="text-[10px] font-bold text-[var(--gold)] bg-[var(--gold)]/15 border border-[var(--gold)]/40 px-1.5 py-0.5 rounded">
                ⭐ {race.featured_multiplier}X POINTS
              </span>
            )}
          </div>
          <h4 className="font-serif text-lg font-bold text-white mt-0.5 truncate">
            {race.name || `Race ${race.race_number}`}
          </h4>
          <div className="text-white/50 text-xs mt-0.5 flex items-center gap-2 flex-wrap">
            {race.distance && <span>{race.distance}</span>}
            {postTimeLocal && (
              <span>{postTimeLocal.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
            )}
          </div>
          {countdown && (
            <div
              className={`mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border-2 shadow-sm ${countdown.cls} ${countdown.pulse ? 'animate-pulse' : ''}`}
            >
              {countdown.atPost ? (
                <span className="text-[14px] font-extrabold uppercase tracking-wider">⚑ {countdown.text}</span>
              ) : (
                <>
                  <span className="text-[12px] font-bold uppercase tracking-wider opacity-80">Post Time In</span>
                  <span className="text-[16px] font-extrabold font-mono tabular-nums leading-none">{countdown.text}</span>
                </>
              )}
            </div>
          )}
          {/* Picks summary — visible whether expanded or collapsed */}
          <div className="mt-2 text-sm text-white/75 truncate">
            {pickSummary}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          {/* Score badge: bright gold for ≥2pts, muted for the 1pt consolation,
              hidden for 0 / unrevealed / unscored. */}
          {finished && score && score.final_points > 0 && (
            score.final_points === 1 ? (
              <span className="text-[11px] font-semibold text-[var(--gold)]/70 px-2 py-0.5 rounded-full border border-[var(--gold)]/30 bg-[var(--gold)]/5 leading-none tabular-nums">
                +1
              </span>
            ) : (
              <span className="text-base font-extrabold text-[var(--gold)] px-2.5 py-1 rounded-full border-2 border-[var(--gold)]/60 bg-[var(--gold)]/15 shadow shadow-[var(--gold)]/30 leading-none tabular-nums">
                +{score.final_points}
              </span>
            )
          )}
          <span className={`text-[11px] font-semibold px-2 py-1 rounded-full ${statusBadge.cls}`}>
            {statusBadge.label}
          </span>
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
              {/* Pick boxes */}
              {hasPicks ? (
                <div className="grid grid-cols-3 gap-2">
                  {(['win', 'place', 'show'] as const).map(slot => {
                    const horseId = slot === 'win' ? pick!.win_horse_id : slot === 'place' ? pick!.place_horse_id : pick!.show_horse_id
                    const h = horseById(horseId)
                    return (
                      <div key={slot} className={`rounded-lg border-2 ${slotColor(slot, horseId)} p-2 text-center transition-colors`}>
                        <div className="text-[10px] uppercase tracking-wider text-white/50 font-bold">
                          {slot === 'win' ? '1st' : slot === 'place' ? '2nd' : '3rd'}
                        </div>
                        {h ? (
                          <>
                            <div className="text-white font-bold text-sm">#{h.number}</div>
                            <div className="text-white/80 text-[11px] truncate">{h.name}</div>
                          </>
                        ) : (
                          <div className="text-white/30 text-xs italic">—</div>
                        )}
                      </div>
                    )
                  })}
                </div>
              ) : race.status !== 'finished' && (
                <div className="text-white/50 text-sm italic">No picks yet</div>
              )}

              {/* Results — only for finished races */}
              {finished && score && (
                <div className="flex items-center justify-between">
                  <div className="text-xs text-white/60">
                    🥇 #{winHorse?.number ?? '?'} • 🥈 #{placeHorse?.number ?? '?'} • 🥉 #{showHorse?.number ?? '?'}
                  </div>
                  <div className="text-right">
                    <div className="text-[var(--gold)] font-bold text-xl leading-none">
                      +{score.final_points}
                    </div>
                    <div className="text-white/50 text-[10px]">
                      {score.base_points} × {score.multiplier_applied}
                    </div>
                  </div>
                </div>
              )}
              {finished && !score && (
                <div className="text-white/50 text-sm italic">
                  You didn&apos;t pick this race.
                </div>
              )}

              {/* Unified Race Info / Picks button */}
              {(() => {
                const noHorses = horses.length === 0
                const readOnly = race.status === 'locked' || race.status === 'finished'
                const label = noHorses
                  ? 'Waiting for horses...'
                  : readOnly
                    ? '📋 Race Info'
                    : hasPicks
                      ? '✏️ Edit Picks'
                      : '🏇 Pick Horses'
                return (
                  <button
                    onClick={(e) => { e.stopPropagation(); onOpenRaceInfo() }}
                    disabled={noHorses}
                    data-tour-pick-button="true"
                    className="w-full h-12 rounded-full bg-[var(--rose-dark)] border-2 border-[var(--gold)]/60 text-white font-bold text-base disabled:opacity-40 hover:bg-[var(--rose-dark)]/85 active:scale-[0.98] transition-all"
                  >
                    {label}
                  </button>
                )
              })()}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
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
}: {
  race: Race
  horses: Horse[]
  existingPick: Pick | null
  playerId: string
  eventId: string
  onSaved?: () => void
  onClose: () => void
}) {
  const postTimeLocal = parseLocalIso(race.post_time)
  // Sort by post position (number) so the program reads in gate order. Scratched
  // horses stay inline in number order (the user wants them visible with SCR badge).
  const sorted = [...horses].sort((a, b) => a.number - b.number)
  const programUrl = `https://www.twinspires.com/bet/program/classic/churchill-downs/cd/Thoroughbred/${race.race_number}/program`

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
            ? 'bg-[var(--gold)] text-[var(--dark)] shadow-md'
            : 'bg-white/5 text-white/65 border border-white/15 hover:bg-white/10 hover:text-white'
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
      className="fixed inset-0 z-50 bg-black/80 flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 26, stiffness: 200 }}
        onClick={e => e.stopPropagation()}
        className="bg-[var(--dark)] border-t-2 sm:border-2 border-[var(--gold)]/40 sm:rounded-2xl rounded-t-3xl w-full sm:max-w-md sm:max-h-[90vh] max-h-[92vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="px-5 pt-4 pb-3 border-b border-white/10">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[var(--gold)]/80 text-xs uppercase font-bold tracking-wider">
                Race {race.race_number}
                {race.is_featured && (
                  <span className="ml-2 text-[var(--gold)]">⭐ {race.featured_multiplier}X POINTS</span>
                )}
              </div>
              <h3 className="font-serif text-xl font-bold text-white mt-0.5 leading-tight">
                {race.name || `Race ${race.race_number}`}
              </h3>
              <div className="text-white/50 text-xs mt-1 flex items-center gap-2 flex-wrap">
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
              className="shrink-0 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white text-xl leading-none flex items-center justify-center transition-colors"
            >
              ✕
            </button>
          </div>
          {canPick && (
            <p className="mt-2 text-[11px] text-white/45">
              Tap <span className="text-[var(--gold)]/80 font-semibold">1st / 2nd / 3rd</span> to set Win, Place, Show — picks save instantly.
            </p>
          )}
        </div>

        {/* Horse list */}
        <div className="flex-1 overflow-y-auto px-2 py-2">
          {sorted.length === 0 ? (
            <div className="text-white/50 text-sm italic px-4 py-6 text-center">
              No horses listed yet.
            </div>
          ) : (
            <ul className="divide-y divide-white/5">
              {sorted.map((h, i) => {
                const stripe = i % 2 === 1 ? 'bg-white/[0.03]' : ''
                const isFavorite = !h.scratched && h.id === favoriteId
                const rowBg = isFavorite ? 'bg-[var(--gold)]/[0.08]' : stripe
                return (
                  <li
                    key={h.id}
                    className={`flex items-center gap-2 px-3 py-2.5 ${rowBg}`}
                  >
                    <span className={`inline-flex items-center justify-center w-9 h-9 rounded-full font-bold text-sm tabular-nums shrink-0 ${
                      h.scratched
                        ? 'bg-white/5 text-white/30 border border-white/10'
                        : isFavorite
                          ? 'bg-[var(--gold)]/30 text-[var(--gold)] border-2 border-[var(--gold)]/70'
                          : 'bg-[var(--gold)]/10 text-[var(--gold)] border-2 border-[var(--gold)]/40'
                    }`}>
                      {h.number}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-medium flex items-center gap-1.5 ${
                        h.scratched ? 'text-white/40 line-through' : 'text-white'
                      }`}>
                        <span className="truncate">{h.name}</span>
                        {h.scratched && (
                          <span className="shrink-0 bg-red-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded leading-none no-underline">
                            SCR
                          </span>
                        )}
                        {isFavorite && (
                          <span className="shrink-0 text-[10px] text-[var(--gold)] font-bold uppercase tracking-wide">
                            Fav
                          </span>
                        )}
                      </div>
                    </div>
                    <span className={`w-12 text-right text-sm font-mono tabular-nums shrink-0 ${
                      h.scratched ? 'text-white/30 line-through' : 'text-white/70'
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

        {/* Footer — TwinSpires link */}
        <div className="px-5 py-4 border-t border-white/10 bg-black/30">
          <a
            href={programUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full h-12 leading-[3rem] rounded-full bg-[var(--rose-dark)] border-2 border-[var(--gold)]/60 text-white font-bold text-center hover:bg-[var(--rose-dark)]/85 active:scale-[0.98] transition-all"
          >
            View full program on TwinSpires ↗
          </a>
        </div>
      </motion.div>
    </motion.div>
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
        className="bg-[var(--dark)] border-t-2 sm:border-2 border-[var(--gold)]/40 sm:rounded-2xl rounded-t-3xl w-full sm:max-w-md max-h-[80vh] overflow-hidden flex flex-col"
      >
        <div className="px-5 pt-4 pb-3 border-b border-white/10 flex items-center justify-between">
          <h3 className="font-serif text-xl font-bold text-white">Assign your {type} token</h3>
          <button onClick={onClose} className="text-white/60 hover:text-white text-xl">✕</button>
        </div>

        <div className="overflow-y-auto p-4 space-y-2">
          {eligibleRaces.length === 0 ? (
            <p className="text-white/60 text-center py-6">No races available to assign to right now.</p>
          ) : eligibleRaces.map(race => {
            const isCurrent = currentRaceId === race.id
            return (
              <button
                key={race.id}
                onClick={() => onAssign(race.id)}
                className={`w-full text-left p-3 rounded-xl border-2 transition-all min-h-[60px] flex justify-between items-center ${isCurrent ? 'border-[var(--gold)] bg-[var(--gold)]/15' : 'border-white/15 bg-white/5 hover:border-[var(--gold)]/60'}`}
              >
                <div>
                  <div className="text-white/60 text-xs">RACE {race.race_number}</div>
                  <div className="text-white font-semibold">{race.name || `Race ${race.race_number}`}</div>
                  {race.is_featured && <div className="text-[var(--gold)] text-xs">⭐ {race.featured_multiplier}X POINTS</div>}
                </div>
                {isCurrent && <span className="text-[var(--gold)] text-xl">✓</span>}
              </button>
            )
          })}
          {currentRaceId && (
            <button
              onClick={() => onAssign(null)}
              className="w-full p-3 rounded-xl border-2 border-red-500/40 bg-red-500/10 text-red-300 font-semibold min-h-[48px]"
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

        <div className="bg-[var(--dark)] border-2 border-[var(--gold)]/60 rounded-2xl p-5 shadow-2xl shadow-[var(--gold)]/20">
          <div className="text-[10px] text-[var(--gold)]/70 font-bold uppercase tracking-wider mb-1">
            Step {stepIndex + 1} of {totalSteps}
          </div>
          <h3 className="font-serif text-xl text-white font-bold mb-2 leading-tight">
            {title}
          </h3>
          <p className="text-white/75 text-sm leading-relaxed mb-4">
            {body}
          </p>
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onSkip}
              className="text-white/55 hover:text-white text-sm font-semibold underline-offset-2 hover:underline"
            >
              Skip Tour
            </button>
            <button
              type="button"
              onClick={onNext}
              className="px-5 h-10 rounded-full bg-[var(--gold)] text-[var(--dark)] font-bold text-sm shadow-md hover:bg-[var(--gold)]/90 active:scale-[0.97] transition-all"
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
      className="fixed inset-0 z-50 bg-black/80 flex items-end sm:items-center justify-center"
    >
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 26, stiffness: 200 }}
        onClick={e => e.stopPropagation()}
        className="bg-[var(--dark)] border-t-2 sm:border-2 border-[var(--gold)]/40 sm:rounded-2xl rounded-t-3xl w-full sm:max-w-md max-h-[88vh] overflow-hidden flex flex-col"
      >
        <div className="px-5 pt-4 pb-3 border-b border-white/10 flex items-center justify-between">
          <h3 className="font-serif text-xl font-bold text-white">Change Avatar</h3>
          <button onClick={onClose} className="text-white/60 hover:text-white text-xl">✕</button>
        </div>
        <div className="overflow-y-auto p-3">
          <p className="text-white/55 text-xs text-center mb-3">
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
                      ? 'border-[var(--gold)] bg-[var(--gold)]/20'
                      : taken
                        ? 'border-white/10 bg-white/5 opacity-40'
                        : 'border-white/15 bg-white/5 hover:border-[var(--gold)]/60 hover:bg-white/10'}
                    ${isPending ? 'opacity-50' : ''}
                  `}
                >
                  <AvatarIcon id={av.id} className="w-full h-full p-0.5" />
                  {isCurrent && (
                    <span className="absolute top-0.5 right-0.5 bg-[var(--gold)] text-black text-[8px] font-bold rounded-full w-4 h-4 flex items-center justify-center">✓</span>
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
                  className="text-sm text-white/70 hover:text-white font-medium"
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
                <span className="text-sm text-white/50">Showing all {sampler.total}</span>
                <button
                  type="button"
                  onClick={sampler.collapse}
                  className="text-sm text-white/70 hover:text-white font-medium"
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
