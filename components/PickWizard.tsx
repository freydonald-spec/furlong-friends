'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { parseLocalIso } from '@/lib/time'
import { oddsToValue, LONGSHOT_THRESHOLD } from '@/lib/scoring'
import type { Race, Horse, Pick, Player } from '@/lib/types'

// Saddle-cloth post-position colors so the picker has real horse-racing feel
// instead of a wall of identical gold circles.
const POST_COLORS: Record<number, { bg: string; text: string; ring: string }> = {
  1:  { bg: '#DC2626', text: '#FFFFFF', ring: '#7F1D1D' },
  2:  { bg: '#FFFFFF', text: '#000000', ring: '#9CA3AF' },
  3:  { bg: '#2563EB', text: '#FFFFFF', ring: '#1E3A8A' },
  4:  { bg: '#FACC15', text: '#000000', ring: '#A16207' },
  5:  { bg: '#16A34A', text: '#FFFFFF', ring: '#14532D' },
  6:  { bg: '#000000', text: '#FBBF24', ring: '#FBBF24' },
  7:  { bg: '#F97316', text: '#FFFFFF', ring: '#9A3412' },
  8:  { bg: '#EC4899', text: '#FFFFFF', ring: '#831843' },
  9:  { bg: '#06B6D4', text: '#000000', ring: '#155E75' },
  10: { bg: '#7C3AED', text: '#FFFFFF', ring: '#3B0764' },
  11: { bg: '#9CA3AF', text: '#000000', ring: '#374151' },
  12: { bg: '#84CC16', text: '#000000', ring: '#365314' },
}
function postColor(n: number) {
  return POST_COLORS[n] ?? { bg: '#1F2937', text: '#FFFFFF', ring: '#111827' }
}

const PEER_THRESHOLD = 5
const BOLD_PCT = 20

type Slot = 'win' | 'place' | 'show'
type CurPicks = { win: string | null; place: string | null; show: string | null }

function slotLabel(s: Slot): string {
  return s === 'win' ? '1ST' : s === 'place' ? '2ND' : '3RD'
}
function slotEmoji(s: Slot): string {
  return s === 'win' ? '🥇' : s === 'place' ? '🥈' : '🥉'
}

type Props = {
  open: boolean
  races: Race[]
  horsesByRace: Record<string, Horse[]>
  picks: Pick[]
  allEventPicks: Pick[]
  player: Player
  eventId: string
  /** Featured-multiplier visibility — drives whether we show the Power Play step. */
  multiplierVisible: boolean
  /** Toast trigger after each save. */
  onSaved?: () => void
  /** Wizard finished or skipped. `completed=true` only when the player ran all
   *  the way through (or hit the final All Done button). The page uses this to
   *  decide whether to flip players.wizard_completed. */
  onClose: (opts: { completed: boolean }) => void
  /** When true, the wizard is in mandatory mode and the page should mark the
   *  player wizard_completed on a successful finish. The wizard itself is
   *  agnostic; this just feeds back into onClose. */
  markCompleteOnFinish: boolean
}

export function PickWizard(props: Props) {
  if (!props.open) return null
  return <PickWizardInner {...props} />
}

function PickWizardInner({
  races, horsesByRace, picks, allEventPicks, player, eventId,
  multiplierVisible, onSaved, onClose, markCompleteOnFinish,
}: Props) {
  // Snapshot of pickable races taken at wizard open time so race-status changes
  // mid-flow don't yank the user around. We do still skip a race if it locks
  // while we're on it (see effect below).
  const [pickableSnapshot] = useState<Race[]>(() =>
    races
      .filter(r => r.status === 'upcoming' || r.status === 'open')
      .sort((a, b) => a.race_number - b.race_number)
  )
  // Re-derive against current race statuses every render so a race that just
  // locked drops out of the wizard automatically.
  const wizardRaces = useMemo(() => {
    const liveById = new Map(races.map(r => [r.id, r]))
    return pickableSnapshot.filter(r => {
      const live = liveById.get(r.id)
      if (!live) return false
      return live.status === 'upcoming' || live.status === 'open'
    })
  }, [pickableSnapshot, races])

  type Phase = 'race' | 'summary' | 'powerplay'
  const [phase, setPhase] = useState<Phase>('race')
  const [stepIdx, setStepIdx] = useState(0)
  const [direction, setDirection] = useState(1)
  const [confirmClose, setConfirmClose] = useState(false)
  const [pendingHorseId, setPendingHorseId] = useState<string | null>(null)
  const [busyClose, setBusyClose] = useState(false)
  // Touch-swipe scratchpad — hoisted up here so it lives above the empty-state
  // early return below (rules-of-hooks: refs can't sit beneath conditional returns).
  const swipeStart = useRef<{ x: number; y: number; t: number } | null>(null)

  // Local mirror of multiplier assignments — lets the Power Play step react
  // instantly without waiting for realtime to round-trip. We sync from props
  // via useEffect so the parent can override too.
  const [mult3x, setMult3x] = useState<string | null>(player.multiplier_3x_race_id)
  const [mult2x, setMult2x] = useState<string | null>(player.multiplier_2x_race_id)
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setMult3x(player.multiplier_3x_race_id) }, [player.multiplier_3x_race_id])
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setMult2x(player.multiplier_2x_race_id) }, [player.multiplier_2x_race_id])

  // Auto-advance past the current race if it locks underneath us.
  useEffect(() => {
    if (phase !== 'race') return
    if (wizardRaces.length === 0) return
    if (stepIdx >= wizardRaces.length) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPhase('summary')
    }
  }, [wizardRaces.length, stepIdx, phase])

  // Hooks must run unconditionally — derive race-dependent memos before any
  // early return so the empty-state branch below doesn't trip rules-of-hooks.
  // `race` is memoized off (wizardRaces, stepIdx) so its reference stays stable
  // across re-renders driven by other state (e.g. a pick INSERT bumping `picks`).
  // Without this, parent re-renders could cascade through the horses useMemo
  // and look like the list "vanished" on tap.
  const race = useMemo<Race | null>(
    () => (wizardRaces.length > 0 ? wizardRaces[Math.min(stepIdx, wizardRaces.length - 1)] : null),
    [wizardRaces, stepIdx],
  )
  const existingPick = race ? (picks.find(p => p.race_id === race.id) ?? null) : null
  const horses = useMemo<Horse[]>(
    () => (race ? (horsesByRace[race.id] ?? []) : []),
    [race, horsesByRace],
  )
  const sortedHorses = useMemo<Horse[]>(
    () => [...horses].sort((a, b) => a.number - b.number),
    [horses],
  )

  // Morning-line favorite (lowest odds, non-scratched).
  const favoriteId = useMemo(() => {
    let best = Infinity
    let id: string | null = null
    for (const h of horses) {
      if (h.scratched) continue
      const v = oddsToValue(h.morning_line_odds)
      if (v < best) { best = v; id = h.id }
    }
    return best === Infinity ? null : id
  }, [horses])

  // Peer win-pick distribution for THIS race (excludes the current player so
  // the bar isn't influenced by their own taps).
  const peerWinDist = useMemo(() => {
    const counts = new Map<string, number>()
    let total = 0
    if (!race) return { counts, total }
    for (const p of allEventPicks) {
      if (p.race_id !== race.id) continue
      if (p.player_id === player.id) continue
      if (!p.win_horse_id) continue
      counts.set(p.win_horse_id, (counts.get(p.win_horse_id) || 0) + 1)
      total++
    }
    return { counts, total }
  }, [allEventPicks, race, player.id])

  // Empty state — every race is already locked or finished.
  if (wizardRaces.length === 0 || !race) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-[var(--bg-primary)] flex flex-col items-center justify-center px-6 text-center"
      >
        <div className="text-6xl mb-3">✅</div>
        <p className="text-[var(--text-primary)] text-lg font-semibold">
          Every race is already locked or finished.
        </p>
        <p className="text-[var(--text-muted)] text-sm mt-2">
          Nothing to pick right now — head to the leaderboard to track the action.
        </p>
        <button
          onClick={() => onClose({ completed: true })}
          className="mt-6 h-12 px-8 rounded-full bg-[var(--rose-dark)] text-white font-bold shadow-md hover:bg-[var(--rose-dark)]/90"
        >
          Got it
        </button>
      </motion.div>
    )
  }

  function pctFor(horseId: string): number {
    if (peerWinDist.total === 0) return 0
    return Math.round(((peerWinDist.counts.get(horseId) ?? 0) / peerWinDist.total) * 100)
  }

  // The "all 3 picked" gate that enables the Next Race button.
  const allPicked = !!(existingPick?.win_horse_id && existingPick?.place_horse_id && existingPick?.show_horse_id)

  // ----- TAP HANDLER -----
  // First tap → 1st (Win), second → 2nd (Place), third → 3rd (Show).
  // Tapping any already-selected horse clears that slot. Once all three slots
  // are full, further taps on new horses are ignored — the user has to clear
  // a slot first.
  async function handleTap(horseId: string) {
    if (pendingHorseId) return
    if (!race) return // narrows for the supabase insert below
    const cur: CurPicks = {
      win: existingPick?.win_horse_id ?? null,
      place: existingPick?.place_horse_id ?? null,
      show: existingPick?.show_horse_id ?? null,
    }
    let next: CurPicks
    if (cur.win === horseId) next = { ...cur, win: null }
    else if (cur.place === horseId) next = { ...cur, place: null }
    else if (cur.show === horseId) next = { ...cur, show: null }
    else if (cur.win === null) next = { ...cur, win: horseId }
    else if (cur.place === null) next = { ...cur, place: horseId }
    else if (cur.show === null) next = { ...cur, show: horseId }
    else return // all three slots full + new horse — ignore

    setPendingHorseId(horseId)
    try {
      const payload = {
        win_horse_id: next.win,
        place_horse_id: next.place,
        show_horse_id: next.show,
      }
      if (existingPick) {
        await supabase.from('picks').update(payload).eq('id', existingPick.id)
      } else {
        await supabase.from('picks').insert({
          player_id: player.id,
          race_id: race.id,
          event_id: eventId,
          ...payload,
        })
      }
      onSaved?.()
    } catch (e) {
      console.error('[PickWizard] save failed', e)
    } finally {
      setPendingHorseId(null)
    }
  }

  function selectedSlotFor(horseId: string): Slot | null {
    if (existingPick?.win_horse_id === horseId) return 'win'
    if (existingPick?.place_horse_id === horseId) return 'place'
    if (existingPick?.show_horse_id === horseId) return 'show'
    return null
  }

  // ----- NAVIGATION -----
  const isLastRaceStep = stepIdx === wizardRaces.length - 1
  const isFirstRaceStep = stepIdx === 0

  function goNextRace() {
    if (isLastRaceStep) {
      setPhase('summary')
      return
    }
    setDirection(1)
    setStepIdx(i => i + 1)
  }
  function goPrevRace() {
    if (isFirstRaceStep) return
    setDirection(-1)
    setStepIdx(i => i - 1)
  }

  // Swipe detection via native touch events on the outer container — keeping
  // this off the animated motion.div prevents Framer's drag pan-recognizer
  // from firing on every horse tap (which previously interfered with the
  // declarative `animate={{ x: 0 }}` and shifted the list off-screen on save).
  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0]
    swipeStart.current = { x: t.clientX, y: t.clientY, t: Date.now() }
  }
  function onTouchEnd(e: React.TouchEvent) {
    const start = swipeStart.current
    swipeStart.current = null
    if (!start) return
    const t = e.changedTouches[0]
    const dx = t.clientX - start.x
    const dy = t.clientY - start.y
    const dt = Date.now() - start.t
    if (dt > 500) return                          // too slow → vertical scroll, not a swipe
    if (Math.abs(dx) < 70) return                 // not far enough
    if (Math.abs(dy) > Math.abs(dx) * 0.6) return // mostly vertical
    if (dx < 0) goNextRace()
    else goPrevRace()
  }

  function attemptClose() {
    setConfirmClose(true)
  }

  async function finalizeClose(completed: boolean) {
    if (busyClose) return
    setBusyClose(true)
    onClose({ completed })
    setBusyClose(false)
  }

  const postTimeLocal = parseLocalIso(race.post_time)

  // ----- RENDER -----
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] bg-[var(--bg-primary)] flex flex-col"
    >
      {phase === 'race' && (
        <RaceStep
          race={race}
          stepIdx={stepIdx}
          totalSteps={wizardRaces.length}
          direction={direction}
          horses={sortedHorses}
          favoriteId={favoriteId}
          peerTotal={peerWinDist.total}
          pctFor={pctFor}
          existingPick={existingPick}
          selectedSlotFor={selectedSlotFor}
          onTapHorse={handleTap}
          pendingHorseId={pendingHorseId}
          allPicked={allPicked}
          isFirstRaceStep={isFirstRaceStep}
          isLastRaceStep={isLastRaceStep}
          postTimeLocal={postTimeLocal}
          onPrev={goPrevRace}
          onNext={goNextRace}
          onSkipRace={goNextRace}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          onClose={attemptClose}
        />
      )}

      {phase === 'summary' && (
        <SummaryStep
          races={wizardRaces}
          horsesByRace={horsesByRace}
          picks={picks}
          peerPicksByRace={allEventPicks}
          playerId={player.id}
          onBack={() => { setDirection(-1); setPhase('race'); setStepIdx(wizardRaces.length - 1) }}
          onContinue={() => setPhase(multiplierVisible ? 'powerplay' : 'race')}
          onContinueAllDone={() => finalizeClose(true)}
          showPowerPlay={multiplierVisible}
        />
      )}

      {phase === 'powerplay' && (
        <PowerPlayStep
          races={wizardRaces}
          horsesByRace={horsesByRace}
          picks={picks}
          peerPicksByRace={allEventPicks}
          playerId={player.id}
          mult3x={mult3x}
          mult2x={mult2x}
          onAssign={async (slot, raceId) => {
            const field = slot === '3x' ? 'multiplier_3x_race_id' : 'multiplier_2x_race_id'
            if (slot === '3x') setMult3x(raceId); else setMult2x(raceId)
            await supabase.from('players').update({ [field]: raceId }).eq('id', player.id)
          }}
          onBack={() => setPhase('summary')}
          onAllDone={() => finalizeClose(true)}
        />
      )}

      {/* Skip-confirmation overlay */}
      <AnimatePresence>
        {confirmClose && (
          <motion.div
            key="skip-confirm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center px-4"
            onClick={() => setConfirmClose(false)}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: 'spring', damping: 24, stiffness: 280 }}
              onClick={e => e.stopPropagation()}
              className="bg-white border border-[var(--border)] rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center"
            >
              <div className="text-4xl mb-2">⏸️</div>
              <h3 className="font-serif text-xl font-bold text-[var(--text-primary)] mb-1">
                Skip for now?
              </h3>
              <p className="text-sm text-[var(--text-muted)] mb-5">
                You can always pick later from the grid.
              </p>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => { setConfirmClose(false); finalizeClose(markCompleteOnFinish) }}
                  className="h-12 rounded-full bg-[var(--rose-dark)] text-white font-bold shadow-md hover:bg-[var(--rose-dark)]/90"
                >
                  Yes, skip for now
                </button>
                <button
                  onClick={() => setConfirmClose(false)}
                  className="h-12 rounded-full bg-white border-2 border-[var(--border)] text-[var(--text-primary)] font-semibold hover:bg-[var(--bg-card-hover)]"
                >
                  Keep picking
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ===== RACE STEP =====
function RaceStep({
  race, stepIdx, totalSteps, direction, horses, favoriteId, peerTotal, pctFor,
  existingPick, selectedSlotFor, onTapHorse, pendingHorseId, allPicked,
  isFirstRaceStep, isLastRaceStep, postTimeLocal, onPrev, onNext, onSkipRace,
  onTouchStart, onTouchEnd, onClose,
}: {
  race: Race
  stepIdx: number
  totalSteps: number
  direction: number
  horses: Horse[]
  favoriteId: string | null
  peerTotal: number
  pctFor: (horseId: string) => number
  existingPick: Pick | null
  selectedSlotFor: (horseId: string) => Slot | null
  onTapHorse: (horseId: string) => void
  pendingHorseId: string | null
  allPicked: boolean
  isFirstRaceStep: boolean
  isLastRaceStep: boolean
  postTimeLocal: Date | null
  onPrev: () => void
  onNext: () => void
  onSkipRace: () => void
  onTouchStart: (e: React.TouchEvent) => void
  onTouchEnd: (e: React.TouchEvent) => void
  onClose: () => void
}) {
  return (
    <>
      {/* Header */}
      <div className="px-5 pt-4 pb-3 border-b border-[var(--border)] bg-white">
        <div className="flex items-center justify-between gap-3 mb-2">
          <span className="text-[var(--rose-dark)] text-xs uppercase font-bold tracking-wider tabular-nums">
            Race {stepIdx + 1} of {totalSteps}
          </span>
          <button
            onClick={onClose}
            aria-label="Close wizard"
            className="w-9 h-9 rounded-full bg-[var(--bg-primary)] hover:bg-[var(--bg-card-hover)] text-[var(--text-primary)] text-xl leading-none flex items-center justify-center border border-[var(--border)]"
          >
            ✕
          </button>
        </div>
        {/* Progress bar */}
        <div className="h-1.5 rounded-full bg-[var(--border)] overflow-hidden">
          <motion.div
            className="h-full bg-[var(--gold)]"
            initial={false}
            animate={{ width: `${((stepIdx + 1) / totalSteps) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
        <div className="mt-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[var(--text-muted)] text-[11px] font-mono">RACE {race.race_number}</span>
            {race.is_featured && (
              <span className="text-[10px] font-extrabold text-[var(--gold)] bg-amber-50 border border-[var(--gold)]/50 px-1.5 py-0.5 rounded">
                ⭐ {race.featured_multiplier}X POINTS
              </span>
            )}
          </div>
          <h2 className="font-serif text-xl font-bold text-[var(--text-primary)] leading-tight mt-0.5">
            {race.name || `Race ${race.race_number}`}
          </h2>
          <div className="text-[var(--text-muted)] text-xs mt-1 flex items-center gap-2 flex-wrap">
            {race.distance && <span>{race.distance}</span>}
            {postTimeLocal && (
              <span>
                {postTimeLocal.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
              </span>
            )}
          </div>
          {/* Slot status pills */}
          <div className="flex items-center gap-2 mt-3">
            {(['win', 'place', 'show'] as const).map(s => {
              const horseId = s === 'win' ? existingPick?.win_horse_id
                : s === 'place' ? existingPick?.place_horse_id
                : existingPick?.show_horse_id
              const filled = !!horseId
              return (
                <span
                  key={s}
                  className={`inline-flex items-center gap-1 px-2.5 h-7 rounded-full text-[11px] font-bold border ${
                    filled
                      ? 'bg-[var(--gold)]/15 text-[var(--gold)] border-[var(--gold)]/60'
                      : 'bg-white text-[var(--text-muted)] border-[var(--border)]'
                  }`}
                >
                  <span aria-hidden>{slotEmoji(s)}</span>
                  <span>{slotLabel(s)}</span>
                  {filled && <span aria-hidden>✓</span>}
                </span>
              )
            })}
          </div>
        </div>
      </div>

      {/* Horse list — swipeable container.
          Swipe is handled via native touch events on this outer wrapper so the
          inner motion.div doesn't need Framer's `drag`, which used to fight
          with `animate={{ x: 0 }}` whenever a tap-driven re-render landed
          mid-gesture and translated the whole list off-screen. */}
      <div
        className="flex-1 overflow-hidden relative"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <AnimatePresence mode="wait" initial={false} custom={direction}>
          <motion.div
            key={race.id}
            custom={direction}
            initial={{ x: direction > 0 ? 60 : -60, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: direction > 0 ? -60 : 60, opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 240 }}
            className="absolute inset-0 overflow-y-auto bg-[var(--bg-primary)]"
          >
            <ul className="divide-y divide-[var(--border)] bg-white">
              {horses.length === 0 ? (
                <li className="px-4 py-10 text-center text-[var(--text-muted)] italic">
                  No horses listed yet.
                </li>
              ) : horses.map(h => {
                const isFavorite = !h.scratched && h.id === favoriteId
                const sel = selectedSlotFor(h.id)
                const peerPct = pctFor(h.id)
                const showPeer = peerTotal >= PEER_THRESHOLD
                const disabled = h.scratched || pendingHorseId === h.id
                const cls = h.scratched
                  ? 'bg-gray-50 opacity-60'
                  : sel
                    ? 'bg-[var(--gold)]/15 border-l-4 border-l-[var(--gold)]'
                    : 'bg-white border-l-4 border-l-transparent hover:bg-[var(--bg-card-hover)]'
                const pos = postColor(h.number)
                return (
                  <li key={h.id}>
                    <button
                      type="button"
                      onClick={() => !disabled && onTapHorse(h.id)}
                      disabled={disabled}
                      aria-label={`Pick ${h.name}`}
                      className={`w-full text-left px-4 py-3 min-h-[64px] flex items-center gap-3 transition-colors ${cls} ${disabled ? 'cursor-not-allowed' : 'active:scale-[0.995]'}`}
                    >
                      {/* Post position circle */}
                      <span
                        className="shrink-0 w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg tabular-nums shadow-sm border-2"
                        style={{
                          backgroundColor: h.scratched ? '#E5E7EB' : pos.bg,
                          color: h.scratched ? '#9CA3AF' : pos.text,
                          borderColor: h.scratched ? '#D1D5DB' : pos.ring,
                        }}
                      >
                        {h.number}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-base font-bold truncate ${
                            h.scratched ? 'text-gray-400 line-through' : 'text-[var(--text-primary)]'
                          }`}>
                            {h.name}
                          </span>
                          {isFavorite && (
                            <span className="shrink-0 text-[10px] font-extrabold text-[var(--gold)] bg-amber-50 border border-[var(--gold)]/50 px-1.5 py-0.5 rounded uppercase tracking-wide">
                              FAV
                            </span>
                          )}
                          {h.scratched && (
                            <span className="shrink-0 bg-[var(--warning)] text-white text-[9px] font-bold px-1.5 py-0.5 rounded leading-none no-underline">
                              SCR
                            </span>
                          )}
                        </div>
                        {showPeer && !h.scratched && (
                          <div className="mt-1.5 flex items-center gap-2">
                            <div className="flex-1 h-1.5 rounded-full bg-gray-200 overflow-hidden max-w-[180px]">
                              <div
                                className="h-full bg-gray-400 rounded-full transition-all"
                                style={{ width: `${peerPct}%` }}
                              />
                            </div>
                            <span className="text-[10px] text-[var(--text-muted)] font-semibold tabular-nums">
                              {peerPct}% picked to win
                            </span>
                          </div>
                        )}
                      </div>
                      {/* Right side: odds + selected badge */}
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-sm font-mono tabular-nums ${
                          h.scratched ? 'text-gray-400 line-through' : 'text-[var(--text-muted)]'
                        }`}>
                          {h.morning_line_odds || '—'}
                        </span>
                        {sel && (
                          <span className="inline-flex items-center justify-center min-w-[44px] h-7 px-2 rounded-full bg-[var(--gold)] text-[var(--bg-primary)] text-[11px] font-extrabold tabular-nums shadow">
                            ✓ {slotLabel(sel)}
                          </span>
                        )}
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-[var(--border)] bg-white flex items-center gap-3">
        <button
          type="button"
          onClick={onPrev}
          disabled={isFirstRaceStep}
          className="h-12 px-4 rounded-full border-2 border-[var(--border)] text-[var(--text-primary)] font-semibold disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[var(--bg-card-hover)] transition-colors"
        >
          ← Back
        </button>
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          {!allPicked && (
            <button
              type="button"
              onClick={onSkipRace}
              className="text-xs text-[var(--text-muted)] underline-offset-2 hover:underline hover:text-[var(--text-primary)]"
            >
              Skip this race
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={onNext}
          disabled={!allPicked}
          className={`h-12 px-5 rounded-full font-bold shadow-md transition-all ${
            allPicked
              ? 'bg-[var(--rose-dark)] text-white hover:bg-[var(--rose-dark)]/90 active:scale-[0.98]'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          {isLastRaceStep ? 'Review →' : 'Next Race →'}
        </button>
      </div>
    </>
  )
}

// ===== SUMMARY STEP =====
function SummaryStep({
  races, horsesByRace, picks, peerPicksByRace, playerId,
  onBack, onContinue, onContinueAllDone, showPowerPlay,
}: {
  races: Race[]
  horsesByRace: Record<string, Horse[]>
  picks: Pick[]
  peerPicksByRace: Pick[]
  playerId: string
  onBack: () => void
  onContinue: () => void
  onContinueAllDone: () => void
  showPowerPlay: boolean
}) {
  return (
    <>
      <div className="px-5 pt-4 pb-3 border-b border-[var(--border)] bg-white text-center">
        <div className="text-4xl mb-1">🏇</div>
        <h2 className="font-serif text-2xl font-bold text-[var(--text-primary)] leading-tight">
          Your picks are in!
        </h2>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          Here&apos;s how your card looks. {showPowerPlay ? 'Up next: pick where to spend your Power Plays.' : 'You\'re all set!'}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 bg-[var(--bg-primary)]">
        <ul className="space-y-3 max-w-xl mx-auto">
          {races.map(r => {
            const pick = picks.find(p => p.race_id === r.id) ?? null
            const horses = horsesByRace[r.id] ?? []
            return (
              <SummaryCard
                key={r.id}
                race={r}
                horses={horses}
                pick={pick}
                allEventPicks={peerPicksByRace}
                playerId={playerId}
              />
            )
          })}
        </ul>
      </div>

      <div className="px-4 py-3 border-t border-[var(--border)] bg-white flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="h-12 px-4 rounded-full border-2 border-[var(--border)] text-[var(--text-primary)] font-semibold hover:bg-[var(--bg-card-hover)]"
        >
          ← Edit picks
        </button>
        <button
          type="button"
          onClick={showPowerPlay ? onContinue : onContinueAllDone}
          className="flex-1 h-12 px-5 rounded-full bg-[var(--rose-dark)] text-white font-bold shadow-md hover:bg-[var(--rose-dark)]/90 active:scale-[0.98]"
        >
          {showPowerPlay ? 'Power Plays →' : 'All done! Let\'s race! 🏇'}
        </button>
      </div>
    </>
  )
}

function SummaryCard({
  race, horses, pick, allEventPicks, playerId,
}: {
  race: Race
  horses: Horse[]
  pick: Pick | null
  allEventPicks: Pick[]
  playerId: string
}) {
  // Win-pick distribution for this race excluding the current player.
  const peer = useMemo(() => {
    const counts = new Map<string, number>()
    let total = 0
    for (const p of allEventPicks) {
      if (p.race_id !== race.id) continue
      if (p.player_id === playerId) continue
      if (!p.win_horse_id) continue
      counts.set(p.win_horse_id, (counts.get(p.win_horse_id) || 0) + 1)
      total++
    }
    return { counts, total }
  }, [allEventPicks, race.id, playerId])

  const favId = useMemo(() => {
    let best = Infinity
    let id: string | null = null
    for (const h of horses) {
      if (h.scratched) continue
      const v = oddsToValue(h.morning_line_odds)
      if (v < best) { best = v; id = h.id }
    }
    return best === Infinity ? null : id
  }, [horses])

  const slots: { slot: Slot; horseId: string | null }[] = [
    { slot: 'win', horseId: pick?.win_horse_id ?? null },
    { slot: 'place', horseId: pick?.place_horse_id ?? null },
    { slot: 'show', horseId: pick?.show_horse_id ?? null },
  ]

  const anyPicked = slots.some(s => s.horseId)

  return (
    <li className="bg-white border border-[var(--border)] rounded-xl p-3 shadow-sm">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="min-w-0">
          <div className="text-[var(--text-muted)] text-[10px] uppercase tracking-wider font-bold">
            Race {race.race_number}
          </div>
          <div className="font-semibold text-sm text-[var(--text-primary)] truncate">
            {race.name || `Race ${race.race_number}`}
          </div>
        </div>
        {race.is_featured && (
          <span className="shrink-0 text-[10px] font-extrabold text-[var(--gold)] bg-amber-50 border border-[var(--gold)]/50 px-1.5 py-0.5 rounded">
            ⭐ {race.featured_multiplier}X
          </span>
        )}
      </div>
      {!anyPicked ? (
        <div className="text-xs italic text-[var(--text-muted)]">
          You skipped this race — you can still pick from the grid.
        </div>
      ) : (
        <ul className="space-y-1.5">
          {slots.map(({ slot, horseId }) => {
            const h = horses.find(x => x.id === horseId) ?? null
            if (!h) {
              return (
                <li key={slot} className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                  <span className="w-8 text-center">{slotEmoji(slot)}</span>
                  <span className="italic">— empty —</span>
                </li>
              )
            }
            const oddsVal = oddsToValue(h.morning_line_odds)
            const longshot = oddsVal >= LONGSHOT_THRESHOLD
            const isFav = h.id === favId
            const peerCount = peer.counts.get(h.id) ?? 0
            const peerPct = peer.total > 0 ? Math.round((peerCount / peer.total) * 100) : 0
            const isWin = slot === 'win'
            const bold = isWin && peer.total >= 1 && peerPct < BOLD_PCT
            const pos = postColor(h.number)
            return (
              <li key={slot} className="flex items-center gap-2">
                <span className="w-8 text-center text-base">{slotEmoji(slot)}</span>
                <span
                  className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs tabular-nums border"
                  style={{ backgroundColor: pos.bg, color: pos.text, borderColor: pos.ring }}
                >
                  {h.number}
                </span>
                <span className="flex-1 min-w-0 text-sm font-semibold text-[var(--text-primary)] truncate">
                  {h.name}
                </span>
                <span className="shrink-0 text-[11px] font-mono tabular-nums text-[var(--text-muted)]">
                  {h.morning_line_odds || '—'}
                </span>
                <span className="shrink-0 flex items-center gap-1 flex-wrap justify-end">
                  {isFav && (
                    <span className="text-[9px] font-extrabold text-[var(--gold)] bg-amber-50 border border-[var(--gold)]/50 px-1 py-0.5 rounded">
                      ⭐ FAV
                    </span>
                  )}
                  {longshot && (
                    <span className="text-[9px] font-extrabold text-rose-700 bg-rose-50 border border-rose-300 px-1 py-0.5 rounded">
                      🎰 LONGSHOT
                    </span>
                  )}
                  {bold && (
                    <span className="text-[9px] font-extrabold text-orange-700 bg-orange-50 border border-orange-300 px-1 py-0.5 rounded">
                      🔥 BOLD
                    </span>
                  )}
                  {isWin && peer.total >= 1 && (
                    <span className="text-[9px] font-bold text-[var(--text-muted)] bg-gray-50 border border-gray-200 px-1 py-0.5 rounded tabular-nums">
                      👥 {peerPct}%
                    </span>
                  )}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </li>
  )
}

// ===== POWER PLAY STEP =====
function PowerPlayStep({
  races, horsesByRace, picks, peerPicksByRace, playerId,
  mult3x, mult2x, onAssign, onBack, onAllDone,
}: {
  races: Race[]
  horsesByRace: Record<string, Horse[]>
  picks: Pick[]
  peerPicksByRace: Pick[]
  playerId: string
  mult3x: string | null
  mult2x: string | null
  onAssign: (slot: '3x' | '2x', raceId: string) => Promise<void>
  onBack: () => void
  onAllDone: () => void
}) {
  // Only races where the player made a win pick are shown (you can't power-play
  // a race you didn't pick).
  const pickedRaces = useMemo(() => races.filter(r => {
    const pk = picks.find(p => p.race_id === r.id)
    return !!pk?.win_horse_id
  }), [races, picks])

  // Smart suggestions:
  //   ×3 → race where my win pick has the highest peer agreement
  //        (safer bet — crowd backs the same horse)
  //   ×2 → highest-multiplier featured race, falling back to first picked race
  const suggestions = useMemo(() => {
    let bestAgreementRaceId: string | null = null
    let bestAgreement = -1
    for (const r of pickedRaces) {
      const myPick = picks.find(p => p.race_id === r.id)
      if (!myPick?.win_horse_id) continue
      let total = 0, mine = 0
      for (const p of peerPicksByRace) {
        if (p.race_id !== r.id) continue
        if (p.player_id === playerId) continue
        if (!p.win_horse_id) continue
        total++
        if (p.win_horse_id === myPick.win_horse_id) mine++
      }
      const pct = total > 0 ? mine / total : 0
      if (pct > bestAgreement) { bestAgreement = pct; bestAgreementRaceId = r.id }
    }
    const featured = [...pickedRaces]
      .filter(r => r.is_featured)
      .sort((a, b) => b.featured_multiplier - a.featured_multiplier)[0]
    const featuredRaceId = featured?.id ?? pickedRaces[0]?.id ?? null
    return { threeX: bestAgreementRaceId, twoX: featuredRaceId }
  }, [pickedRaces, picks, peerPicksByRace, playerId])

  const [activeSlot, setActiveSlot] = useState<'3x' | '2x'>('3x')
  const [busy, setBusy] = useState(false)

  async function applySuggestions() {
    if (busy) return
    setBusy(true)
    try {
      if (suggestions.threeX) await onAssign('3x', suggestions.threeX)
      if (suggestions.twoX && suggestions.twoX !== suggestions.threeX) {
        await onAssign('2x', suggestions.twoX)
      }
    } finally {
      setBusy(false)
    }
  }

  async function applyOne(slot: '3x' | '2x', raceId: string) {
    if (busy) return
    setBusy(true)
    try { await onAssign(slot, raceId) } finally { setBusy(false) }
  }

  return (
    <>
      <div className="px-5 pt-4 pb-3 border-b border-[var(--border)] bg-white">
        <div className="flex items-center justify-between gap-3 mb-2">
          <span className="text-[var(--rose-dark)] text-xs uppercase font-bold tracking-wider">
            Power Plays
          </span>
        </div>
        <h2 className="font-serif text-xl font-bold text-[var(--text-primary)] leading-tight">
          Where do you want to swing for the fences?
        </h2>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          You get one ×3 and one ×2 multiplier — they apply to that race&apos;s final score.
        </p>

        {/* Slot pills */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          {(['3x', '2x'] as const).map(slot => {
            const assigned = slot === '3x' ? mult3x : mult2x
            const r = races.find(x => x.id === assigned) ?? null
            const isActive = activeSlot === slot
            return (
              <button
                key={slot}
                type="button"
                onClick={() => setActiveSlot(slot)}
                className={`text-left rounded-xl border-2 px-3 py-2 transition-all ${
                  isActive
                    ? 'border-[var(--gold)] bg-amber-50 shadow-md'
                    : 'border-[var(--border)] bg-white hover:bg-[var(--bg-card-hover)]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">⚡</span>
                  <span className="text-base font-extrabold text-[var(--text-primary)]">
                    ×{slot === '3x' ? '3 TRIPLE' : '2 DOUBLE'}
                  </span>
                </div>
                <div className="text-[11px] text-[var(--text-muted)] mt-0.5 truncate">
                  {r ? `R${r.race_number} · ${r.name || `Race ${r.race_number}`}` : 'unassigned'}
                </div>
              </button>
            )
          })}
        </div>

        {/* Suggestion line */}
        {(suggestions.threeX || suggestions.twoX) && (
          <button
            type="button"
            onClick={applySuggestions}
            disabled={busy}
            className="mt-3 w-full text-left bg-white border border-[var(--gold)]/50 rounded-lg px-3 py-2 hover:bg-amber-50 disabled:opacity-60"
          >
            <div className="text-[11px] font-bold text-[var(--gold)] uppercase tracking-wider">
              💡 We suggest
            </div>
            <div className="text-xs text-[var(--text-primary)] mt-0.5">
              {suggestions.threeX && (
                <span>×3 on R{races.find(r => r.id === suggestions.threeX)?.race_number ?? '?'}</span>
              )}
              {suggestions.threeX && suggestions.twoX && suggestions.threeX !== suggestions.twoX && (
                <span> · ×2 on R{races.find(r => r.id === suggestions.twoX)?.race_number ?? '?'}</span>
              )}
              <span className="text-[var(--text-muted)] ml-1">— tap to accept, or pick your own below.</span>
            </div>
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 bg-[var(--bg-primary)]">
        {pickedRaces.length === 0 ? (
          <div className="text-center text-[var(--text-muted)] italic py-10">
            You haven&apos;t picked any races, so there&apos;s nothing to multiply yet.
          </div>
        ) : (
          <ul className="space-y-2 max-w-xl mx-auto">
            <li className="text-[11px] text-[var(--text-muted)] uppercase tracking-wider font-bold px-2">
              Tap a race to assign your <span className="text-[var(--gold)]">×{activeSlot === '3x' ? '3' : '2'}</span>
            </li>
            {pickedRaces.map(r => {
              const myPick = picks.find(p => p.race_id === r.id)
              const winHorse = (horsesByRace[r.id] ?? []).find(h => h.id === myPick?.win_horse_id)
              // Confidence indicator: peer agreement on the player's win pick.
              let agree = 0, peerTotal = 0
              for (const p of peerPicksByRace) {
                if (p.race_id !== r.id) continue
                if (p.player_id === playerId) continue
                if (!p.win_horse_id) continue
                peerTotal++
                if (p.win_horse_id === myPick?.win_horse_id) agree++
              }
              const confPct = peerTotal > 0 ? Math.round((agree / peerTotal) * 100) : null
              const isAssigned = activeSlot === '3x' ? mult3x === r.id : mult2x === r.id
              const isSuggested = activeSlot === '3x'
                ? suggestions.threeX === r.id
                : suggestions.twoX === r.id
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => applyOne(activeSlot, r.id)}
                    disabled={busy}
                    className={`w-full text-left p-3 rounded-xl border-2 transition-all min-h-[64px] ${
                      isAssigned
                        ? 'border-[var(--gold)] bg-amber-50 shadow-md'
                        : 'border-[var(--border)] bg-white hover:bg-[var(--bg-card-hover)]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-[10px] text-[var(--text-muted)] uppercase font-bold tracking-wider">
                          Race {r.race_number}
                          {r.is_featured && (
                            <span className="ml-1.5 text-[var(--gold)]">⭐ {r.featured_multiplier}X</span>
                          )}
                        </div>
                        <div className="font-semibold text-sm text-[var(--text-primary)] truncate">
                          {r.name || `Race ${r.race_number}`}
                        </div>
                        {winHorse && (
                          <div className="text-[11px] text-[var(--text-muted)] truncate mt-0.5">
                            🥇 #{winHorse.number} {winHorse.name}
                          </div>
                        )}
                        {confPct !== null && (
                          <div className="mt-1.5 flex items-center gap-2">
                            <div className="flex-1 h-1.5 rounded-full bg-gray-200 overflow-hidden max-w-[140px]">
                              <div
                                className={`h-full rounded-full ${confPct >= 50 ? 'bg-[var(--success)]' : confPct >= 25 ? 'bg-[var(--gold)]' : 'bg-gray-400'}`}
                                style={{ width: `${confPct}%` }}
                              />
                            </div>
                            <span className="text-[10px] text-[var(--text-muted)] font-semibold tabular-nums">
                              {confPct}% agree
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        {isAssigned && (
                          <span className="text-[10px] font-extrabold text-[var(--gold)] bg-white border border-[var(--gold)] px-1.5 py-0.5 rounded uppercase tracking-wide">
                            ✓ ×{activeSlot === '3x' ? '3' : '2'} HERE
                          </span>
                        )}
                        {isSuggested && !isAssigned && (
                          <span className="text-[10px] font-bold text-[var(--gold)] bg-amber-50 border border-[var(--gold)]/50 px-1.5 py-0.5 rounded">
                            💡 suggested
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div className="px-4 py-3 border-t border-[var(--border)] bg-white flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="h-12 px-4 rounded-full border-2 border-[var(--border)] text-[var(--text-primary)] font-semibold hover:bg-[var(--bg-card-hover)]"
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={onAllDone}
          className="flex-1 h-12 px-5 rounded-full bg-[var(--rose-dark)] text-white font-bold shadow-md hover:bg-[var(--rose-dark)]/90 active:scale-[0.98]"
        >
          All done! Let&apos;s race! 🏇
        </button>
      </div>
    </>
  )
}
