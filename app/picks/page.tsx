'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { AvatarIcon, AVATARS } from '@/lib/avatars'
import { parseLocalIso } from '@/lib/time'
import type { Event, Race, Horse, Player, Pick, Score } from '@/lib/types'

type PickDraft = {
  win: string | null
  place: string | null
  show: string | null
}

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

  const [openModalRaceId, setOpenModalRaceId] = useState<string | null>(null)
  const [tokenAssignType, setTokenAssignType] = useState<'2x' | '3x' | null>(null)
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set())
  const [adminAlert, setAdminAlert] = useState<string | null>(null)
  const [changeAvatarOpen, setChangeAvatarOpen] = useState(false)

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
      </AnimatePresence>

      {/* Player Hero */}
      <section className="px-5 pt-6 pb-4">
        <div className="max-w-2xl mx-auto bg-gradient-to-br from-[var(--rose-dark)] to-[#5a0f1d] rounded-2xl p-5 border-2 border-[var(--gold)]/40 shadow-lg relative overflow-hidden">
          <div className="absolute -top-8 -right-8 text-9xl opacity-10">🌹</div>
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
        <section className="px-5 pb-4">
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
          <h3 className="text-white/80 text-sm uppercase tracking-wider font-semibold mb-2">
            Races
          </h3>
          {races.length === 0 ? (
            <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center text-white/60">
              No races posted yet. The host will set them up before post time.
            </div>
          ) : (
            <div className="space-y-3">
              {races.map(race => (
                <RaceCard
                  key={race.id}
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
                  onPick={() => setOpenModalRaceId(race.id)}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Picks Modal */}
      <AnimatePresence>
        {openModalRaceId && (
          <PicksModal
            race={races.find(r => r.id === openModalRaceId)!}
            horses={horsesByRace[openModalRaceId] ?? []}
            existingPick={picks.find(p => p.race_id === openModalRaceId) ?? null}
            playerId={player.id}
            eventId={event.id}
            onClose={() => setOpenModalRaceId(null)}
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

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-[var(--dark)]/95 border-t border-white/10 backdrop-blur-sm z-10">
        <div className="max-w-2xl mx-auto flex">
          <Link href="/" className="flex-1 py-3 text-center text-white/60 hover:text-white text-sm">
            🏠 Home
          </Link>
          <Link href="/track" className="flex-1 py-3 text-center text-[var(--gold)] hover:text-[var(--gold)]/80 text-sm font-semibold">
            🏁 Live Track
          </Link>
        </div>
      </nav>
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
  race, horses, pick, score, scoreRevealed, multiplier, multiplierVisible, now, onPick,
}: {
  race: Race
  horses: Horse[]
  pick: Pick | null
  score: Score | null
  scoreRevealed: boolean
  multiplier: '2x' | '3x' | null
  multiplierVisible: boolean
  now: number
  onPick: () => void
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
  // Format: M:SS under one hour, H:MM:SS at one hour or more.
  const postTimeLocal = parseLocalIso(race.post_time)
  const countdown = (() => {
    if (race.status === 'locked' || race.status === 'finished') return null
    if (!postTimeLocal) return null
    const ms = postTimeLocal.getTime() - now
    const secondsLeft = Math.floor(ms / 1000)
    if (secondsLeft < 0) {
      return { text: 'Post Time', secondsLeft: -1, cls: 'bg-red-600/30 text-red-200 border-red-500/50' }
    }
    const h = Math.floor(secondsLeft / 3600)
    const m = Math.floor((secondsLeft % 3600) / 60)
    const s = secondsLeft % 60
    const formatted = h > 0
      ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      : `${m}:${String(s).padStart(2, '0')}`
    const text = `Locks in ${formatted}`
    if (secondsLeft < 60) return { text, secondsLeft, cls: 'bg-red-600/30 text-red-200 border-red-500/60 animate-pulse' }
    if (secondsLeft < 300) return { text, secondsLeft, cls: 'bg-amber-500/20 text-amber-200 border-amber-400/50' }
    return { text, secondsLeft, cls: 'bg-white/10 text-white/75 border-white/20' }
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

  return (
    <div className={`relative rounded-xl border-2 p-4 ${cardClasses}`}>
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

      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-white/50 text-xs font-mono">RACE {race.race_number}</span>
            {race.is_featured && (
              <span className="text-[10px] font-bold text-[var(--gold)] bg-[var(--gold)]/15 border border-[var(--gold)]/40 px-1.5 py-0.5 rounded">
                ⭐ FEATURED {race.featured_multiplier > 1 ? `${race.featured_multiplier}x` : ''}
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
            {countdown && (
              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${countdown.cls}`}>
                {countdown.text}
              </span>
            )}
          </div>
        </div>
        <span className={`text-[11px] font-semibold px-2 py-1 rounded-full ${statusBadge.cls}`}>
          {statusBadge.label}
        </span>
      </div>

      {/* Picks */}
      {pick && (pick.win_horse_id || pick.place_horse_id || pick.show_horse_id) ? (
        <div className="grid grid-cols-3 gap-2 mb-3">
          {(['win', 'place', 'show'] as const).map(slot => {
            const horseId = slot === 'win' ? pick.win_horse_id : slot === 'place' ? pick.place_horse_id : pick.show_horse_id
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
      ) : (
        race.status !== 'finished' && (
          <div className="text-white/50 text-sm italic mb-3">No picks yet</div>
        )
      )}

      {/* Results / Action */}
      {finished && score ? (
        <div className="flex items-center justify-between border-t border-white/10 pt-3">
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
      ) : finished ? (
        <div className="text-white/50 text-sm italic border-t border-white/10 pt-3">
          You didn&apos;t pick this race.
        </div>
      ) : (
        canPick && (
          <button
            onClick={onPick}
            disabled={horses.length === 0}
            className="w-full h-12 rounded-full bg-[var(--rose-dark)] border-2 border-[var(--gold)]/60 text-white font-bold text-base disabled:opacity-40 hover:bg-[var(--rose-dark)]/85 active:scale-[0.98] transition-all"
          >
            {horses.length === 0 ? 'Waiting for horses...' : (pick && (pick.win_horse_id || pick.place_horse_id) ? 'Edit Picks' : 'Make Picks')}
          </button>
        )
      )}
    </div>
  )
}

// ----- PICKS MODAL -----
function PicksModal({
  race, horses, existingPick, playerId, eventId, onClose,
}: {
  race: Race
  horses: Horse[]
  existingPick: Pick | null
  playerId: string
  eventId: string
  onClose: () => void
}) {
  const [draft, setDraft] = useState<PickDraft>({
    win: existingPick?.win_horse_id ?? null,
    place: existingPick?.place_horse_id ?? null,
    show: existingPick?.show_horse_id ?? null,
  })
  const [activeSlot, setActiveSlot] = useState<'win' | 'place' | 'show'>('win')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  function selectHorse(horseId: string) {
    setErr(null)
    setDraft(d => {
      const next = { ...d }
      // Remove from any other slot
      if (next.win === horseId) next.win = null
      if (next.place === horseId) next.place = null
      if (next.show === horseId) next.show = null
      next[activeSlot] = horseId
      return next
    })
    // Auto-advance
    if (activeSlot === 'win') setActiveSlot('place')
    else if (activeSlot === 'place') setActiveSlot('show')
  }

  async function save() {
    if (!draft.win || !draft.place || !draft.show) {
      setErr('Pick a horse for Win, Place, AND Show.')
      return
    }
    setSaving(true)
    try {
      if (existingPick) {
        await supabase
          .from('picks')
          .update({
            win_horse_id: draft.win,
            place_horse_id: draft.place,
            show_horse_id: draft.show,
          })
          .eq('id', existingPick.id)
      } else {
        await supabase.from('picks').insert({
          player_id: playerId,
          race_id: race.id,
          event_id: eventId,
          win_horse_id: draft.win,
          place_horse_id: draft.place,
          show_horse_id: draft.show,
        })
      }
      onClose()
    } catch (e) {
      console.error(e)
      setErr("Couldn't save your picks. Try again.")
      setSaving(false)
    }
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
          <div className="flex items-center justify-between mb-1">
            <span className="text-[var(--gold)]/80 text-xs uppercase font-bold">Race {race.race_number}</span>
            <button onClick={onClose} className="text-white/60 hover:text-white text-xl leading-none">✕</button>
          </div>
          <h3 className="font-serif text-xl font-bold text-white">{race.name || `Race ${race.race_number}`}</h3>
        </div>

        {/* Slot tabs */}
        <div className="grid grid-cols-3 gap-2 p-3 border-b border-white/10">
          {(['win', 'place', 'show'] as const).map(slot => {
            const horseId = draft[slot]
            const horse = horses.find(h => h.id === horseId)
            const active = activeSlot === slot
            return (
              <button
                key={slot}
                onClick={() => setActiveSlot(slot)}
                className={`rounded-lg border-2 p-2 text-center transition-all min-h-[60px] ${active ? 'border-[var(--gold)] bg-[var(--gold)]/10' : 'border-white/20 hover:border-white/40'}`}
              >
                <div className="text-[10px] font-bold uppercase tracking-wider text-white/60">
                  {slot === 'win' ? '1st • Win' : slot === 'place' ? '2nd • Place' : '3rd • Show'}
                </div>
                {horse ? (
                  <div className="mt-0.5">
                    <div className="text-white font-bold text-sm">#{horse.number}</div>
                    <div className="text-white/70 text-[10px] truncate">{horse.name}</div>
                  </div>
                ) : (
                  <div className="text-white/40 text-xs mt-1">Tap to set</div>
                )}
              </button>
            )
          })}
        </div>

        {/* Horse list */}
        <div className="flex-1 overflow-y-auto p-3">
          {horses.length === 0 ? (
            <div className="text-white/50 text-center py-8">No horses listed for this race yet.</div>
          ) : (
            <div className="space-y-2">
              {horses.map(h => {
                const used =
                  draft.win === h.id ? 'WIN' :
                  draft.place === h.id ? 'PLACE' :
                  draft.show === h.id ? 'SHOW' : null
                const usedInActive = draft[activeSlot] === h.id
                return (
                  <button
                    key={h.id}
                    onClick={() => !h.scratched && selectHorse(h.id)}
                    disabled={h.scratched}
                    className={`
                      w-full text-left p-3 rounded-xl border-2 transition-all flex items-center justify-between min-h-[56px]
                      ${h.scratched ? 'border-white/5 bg-white/[0.02] opacity-40' :
                        usedInActive ? 'border-[var(--gold)] bg-[var(--gold)]/15' :
                        used ? 'border-white/30 bg-white/10' :
                        'border-white/15 bg-white/5 hover:border-white/40'}
                    `}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-[var(--rose-dark)] border-2 border-[var(--gold)]/60 flex items-center justify-center font-bold text-white shrink-0">
                        {h.number}
                      </div>
                      <div className="min-w-0">
                        <div className={`font-semibold truncate ${h.scratched ? 'line-through' : 'text-white'}`}>
                          {h.name}
                        </div>
                        {h.morning_line_odds && (
                          <div className="text-white/50 text-xs">{h.morning_line_odds}</div>
                        )}
                      </div>
                    </div>
                    {used && (
                      <span className="text-[10px] font-bold bg-[var(--gold)]/20 text-[var(--gold)] px-2 py-0.5 rounded-full border border-[var(--gold)]/40">
                        {used}
                      </span>
                    )}
                    {h.scratched && (
                      <span className="text-[10px] text-red-400 font-bold uppercase">Scratched</span>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 bg-black/40">
          {err && (
            <p className="text-red-300 text-sm text-center mb-2">{err}</p>
          )}
          <button
            onClick={save}
            disabled={saving || !draft.win || !draft.place || !draft.show}
            className="w-full h-14 rounded-full bg-[var(--rose-dark)] border-2 border-[var(--gold)]/60 text-white font-bold text-lg disabled:opacity-40 hover:bg-[var(--rose-dark)]/85 active:scale-[0.98] transition-all"
          >
            {saving ? 'Saving…' : '🏁 Lock In Picks'}
          </button>
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
                  {race.is_featured && <div className="text-[var(--gold)] text-xs">⭐ Featured ({race.featured_multiplier}x base)</div>}
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
            {AVATARS.map(av => {
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
                    relative aspect-square flex items-center justify-center rounded-xl border-2 transition-all min-h-[48px]
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
        </div>
      </motion.div>
    </motion.div>
  )
}
