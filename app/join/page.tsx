'use client'

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import { supabase } from "@/lib/supabase"
import { AVATARS, AvatarIcon } from "@/lib/avatars"
import type { Event, Player } from "@/lib/types"

type TakenInfo = { avatar: string; name: string; id: string }

type WelcomeInfo = {
  id: string
  name: string
  avatar: string
  score: number
  rank: number
  totalPlayers: number
}

type Step = 'name' | 'welcome' | 'avatar'

function normalizeName(s: string): string {
  return s.trim().toLowerCase()
}

async function findPlayerByName(eventId: string, rawName: string): Promise<Player | null> {
  const target = normalizeName(rawName)
  if (!target) return null
  const { data: players } = await supabase
    .from('players')
    .select('*')
    .eq('event_id', eventId)
  return (players ?? []).find(p => normalizeName(p.name) === target) ?? null
}

async function loadWelcomeInfo(player: Player, eventId: string): Promise<WelcomeInfo> {
  const [{ data: allPlayers }, { data: scoreRows }] = await Promise.all([
    supabase.from('players').select('id').eq('event_id', eventId),
    supabase.from('scores').select('player_id, final_points').eq('event_id', eventId),
  ])
  const totals = new Map<string, number>()
  for (const p of allPlayers ?? []) totals.set(p.id, 0)
  for (const s of scoreRows ?? []) {
    totals.set(s.player_id, (totals.get(s.player_id) ?? 0) + (s.final_points ?? 0))
  }
  const sorted = [...totals.entries()].sort((a, b) => b[1] - a[1])
  const idx = sorted.findIndex(([id]) => id === player.id)
  return {
    id: player.id,
    name: player.name,
    avatar: player.avatar,
    score: totals.get(player.id) ?? 0,
    rank: idx === -1 ? sorted.length : idx + 1,
    totalPlayers: sorted.length,
  }
}

export default function JoinPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('name')
  const [name, setName] = useState("")
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null)
  const [taken, setTaken] = useState<TakenInfo[]>([])
  const [event, setEvent] = useState<Event | null>(null)
  const [loading, setLoading] = useState(true)
  const [continuing, setContinuing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rejoinCandidate, setRejoinCandidate] = useState<TakenInfo | null>(null)
  const [welcomeMatch, setWelcomeMatch] = useState<WelcomeInfo | null>(null)

  async function init() {
    try {
      const { data: events, error: evtErr } = await supabase
        .from('events')
        .select('*')
        .eq('status', 'active')
        .order('date', { ascending: false })
        .limit(1)

      if (evtErr) throw evtErr
      const activeEvent = events?.[0] ?? null

      if (!activeEvent) {
        setError("No event is active right now. Ask the host to set one as active.")
        setLoading(false)
        return
      }
      setEvent(activeEvent)

      // Returning player: only auto-redirect if they're already in THIS event.
      if (typeof window !== 'undefined') {
        const playerId = localStorage.getItem('furlong_player_id')
        if (playerId) {
          const { data: existing } = await supabase
            .from('players')
            .select('id, event_id')
            .eq('id', playerId)
            .maybeSingle()
          if (existing && existing.event_id === activeEvent.id) {
            router.replace('/picks')
            return
          }
          localStorage.removeItem('furlong_player_id')
          localStorage.removeItem('furlong_player_name')
        }
      }

      const { data: players } = await supabase
        .from('players')
        .select('id, name, avatar')
        .eq('event_id', activeEvent.id)

      setTaken(players ?? [])
    } catch (e) {
      console.error(e)
      setError("Couldn't connect. Check your internet and try again.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void init()

  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function pickAvatar(avatarId: string) {
    setError(null)
    const t = taken.find(p => p.avatar === avatarId)
    if (t) {
      setRejoinCandidate(t)
      setSelectedAvatar(null)
      return
    }
    setRejoinCandidate(null)
    setSelectedAvatar(avatarId)
  }

  function restoreSession(player: { id: string; name: string }) {
    if (typeof window !== 'undefined') {
      localStorage.setItem('furlong_player_id', player.id)
      localStorage.setItem('furlong_player_name', player.name)
    }
    router.replace('/picks')
  }

  async function handleContinue() {
    if (!name.trim() || !event || continuing) return
    setContinuing(true)
    setError(null)
    try {
      const existing = await findPlayerByName(event.id, name)
      if (existing) {
        const info = await loadWelcomeInfo(existing, event.id)
        setWelcomeMatch(info)
        setStep('welcome')
      } else {
        setStep('avatar')
      }
    } catch (e) {
      console.error(e)
      setError("Couldn't check that name. Try again.")
    } finally {
      setContinuing(false)
    }
  }

  async function handleJoin() {
    if (!selectedAvatar || !event || !name.trim()) return
    setSubmitting(true)
    setError(null)

    try {
      // Final duplicate-name guard (race-condition safety).
      const dupByName = await findPlayerByName(event.id, name)
      if (dupByName) {
        const info = await loadWelcomeInfo(dupByName, event.id)
        setWelcomeMatch(info)
        setStep('welcome')
        setSubmitting(false)
        return
      }

      // Avatar conflict check
      const { data: conflict } = await supabase
        .from('players')
        .select('id, name')
        .eq('event_id', event.id)
        .eq('avatar', selectedAvatar)
        .maybeSingle()

      if (conflict) {
        setError("Someone just grabbed that avatar — try another!")
        setSelectedAvatar(null)
        setTaken(t => [...t, { id: conflict.id, name: conflict.name, avatar: selectedAvatar }])
        setSubmitting(false)
        return
      }

      const { data: player, error: insertErr } = await supabase
        .from('players')
        .insert({
          event_id: event.id,
          name: name.trim(),
          avatar: selectedAvatar,
          paid: false,
          multiplier_3x_race_id: null,
          multiplier_2x_race_id: null,
        })
        .select()
        .single()

      if (insertErr) throw insertErr
      if (!player) throw new Error('No player returned')

      restoreSession(player)
    } catch (e) {
      console.error(e)
      setError("Something went wrong joining. Please try again.")
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-3 animate-pulse">🐎</div>
          <p className="text-white/70 text-lg">Saddling up...</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen flex flex-col px-5 py-8">
      <div className="w-full max-w-md mx-auto flex-1 flex flex-col">
        {/* Header */}
        <div className="flex items-center mb-6">
          <Link href="/" className="text-white/60 hover:text-white text-sm">← Back</Link>
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-500/40 rounded-xl p-3 mb-4 text-red-200 text-sm text-center">
            {error}
          </div>
        )}

        {step === 'name' && (
          <div className="flex-1 flex flex-col justify-center">
            <div className="text-center mb-8">
              <div className="text-5xl mb-3">🎩</div>
              <h1 className="font-serif text-4xl font-bold text-white mb-2">Welcome</h1>
              <p className="text-white/70 text-lg">What should we call you?</p>
              {event && (
                <p className="text-[var(--gold)]/80 text-sm mt-2 font-serif italic">
                  {event.name}
                </p>
              )}
            </div>

            <div className="space-y-4">
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Your name"
                maxLength={28}
                autoFocus
                className="w-full h-14 px-5 rounded-xl bg-white/10 border-2 border-[var(--gold)]/30 text-white text-lg placeholder:text-white/40 focus:outline-none focus:border-[var(--gold)] transition-colors"
                onKeyDown={e => { if (e.key === 'Enter' && name.trim()) void handleContinue() }}
              />
              <button
                onClick={() => void handleContinue()}
                disabled={!name.trim() || continuing}
                className="w-full h-14 rounded-full bg-[var(--rose-dark)] border-2 border-[var(--gold)]/60 text-white font-bold text-xl disabled:opacity-40 hover:bg-[var(--rose-dark)]/85 active:scale-[0.98] transition-all"
              >
                {continuing ? 'Checking…' : 'Continue →'}
              </button>
              <div className="text-center pt-2">
                <Link href="/login" className="text-white/55 hover:text-white text-sm underline underline-offset-4">
                  Already joined? Log back in
                </Link>
              </div>
            </div>
          </div>
        )}

        {step === 'welcome' && welcomeMatch && (
          <div className="flex-1 flex flex-col justify-center">
            <div className="text-center mb-8">
              <AvatarIcon
                id={welcomeMatch.avatar}
                className="w-32 h-32 mx-auto rounded-2xl shadow-lg mb-4"
              />
              <h1 className="font-serif text-3xl font-bold text-white mb-1">Welcome back,</h1>
              <h2 className="font-serif text-3xl font-bold text-[var(--gold)] mb-4 truncate">
                {welcomeMatch.name}!
              </h2>
              <div className="inline-flex items-center gap-6 bg-white/5 border border-[var(--gold)]/30 rounded-xl px-5 py-3">
                <div>
                  <div className="text-[var(--gold)] text-2xl font-bold leading-none">
                    {welcomeMatch.score}
                  </div>
                  <div className="text-white/60 text-xs uppercase tracking-wide">Points</div>
                </div>
                <div className="w-px h-8 bg-white/15" />
                <div>
                  <div className="text-[var(--gold)] text-2xl font-bold leading-none">
                    #{welcomeMatch.rank}
                    <span className="text-white/50 text-sm font-normal">
                      {' '}/ {welcomeMatch.totalPlayers}
                    </span>
                  </div>
                  <div className="text-white/60 text-xs uppercase tracking-wide">Rank</div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <button
                onClick={() =>
                  restoreSession({ id: welcomeMatch.id, name: welcomeMatch.name })
                }
                className="w-full h-14 rounded-full bg-[var(--rose-dark)] border-2 border-[var(--gold)]/60 text-white font-bold text-xl hover:bg-[var(--rose-dark)]/85 active:scale-[0.98] transition-all"
              >
                🏇 That&apos;s me — Let&apos;s play!
              </button>
              <button
                onClick={() => {
                  setWelcomeMatch(null)
                  setName('')
                  setStep('name')
                }}
                className="w-full text-center text-white/60 hover:text-white text-sm underline underline-offset-4 py-2"
              >
                Not me — use a different name
              </button>
            </div>
          </div>
        )}

        {step === 'avatar' && (
          <div className="flex-1 flex flex-col">
            <div className="text-center mb-5">
              <h1 className="font-serif text-3xl font-bold text-white">Choose Your Avatar</h1>
              <p className="text-white/60 mt-1 text-sm">
                Hi <span className="text-[var(--gold)] font-semibold">{name}</span>! Pick your Derby persona
              </p>
              {taken.length > 0 && (
                <p className="text-white/40 text-xs mt-1">
                  Already taken? Tap to rejoin as that player
                </p>
              )}
            </div>

            <div className="grid grid-cols-5 gap-2.5 mb-6">
              {AVATARS.map(avatar => {
                const t = taken.find(p => p.avatar === avatar.id)
                const selected = selectedAvatar === avatar.id
                return (
                  <button
                    key={avatar.id}
                    onClick={() => pickAvatar(avatar.id)}
                    title={t ? `Taken by ${t.name}` : avatar.label}
                    className={`
                      relative aspect-square flex items-center justify-center rounded-xl border-2 transition-all min-h-[48px]
                      ${selected
                        ? 'border-[var(--gold)] bg-[var(--gold)]/20 scale-105'
                        : t
                          ? 'border-white/10 bg-white/5 opacity-50 hover:opacity-80'
                          : 'border-white/15 bg-white/5 hover:border-[var(--gold)]/60 hover:bg-white/10'}
                    `}
                  >
                    <AvatarIcon id={avatar.id} className="w-full h-full p-0.5" />
                  </button>
                )
              })}
            </div>

            <div className="mt-auto space-y-3">
              {selectedAvatar && (
                <p className="text-center text-white/80 text-sm">
                  You picked: <span className="text-[var(--gold)] font-semibold">
                    {AVATARS.find(a => a.id === selectedAvatar)?.label}
                  </span>
                </p>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setStep('name')}
                  className="h-14 px-6 rounded-full border-2 border-white/20 text-white/70 font-medium hover:border-white/40 transition-colors"
                >
                  ← Back
                </button>
                <button
                  onClick={handleJoin}
                  disabled={!selectedAvatar || submitting}
                  className="flex-1 h-14 rounded-full bg-[var(--rose-dark)] border-2 border-[var(--gold)]/60 text-white font-bold text-lg disabled:opacity-40 hover:bg-[var(--rose-dark)]/85 active:scale-[0.98] transition-all"
                >
                  {submitting ? 'Joining…' : '🏁 Join Game'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Rejoin modal (avatar-tap path) */}
      <AnimatePresence>
        {rejoinCandidate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-6"
            onClick={() => setRejoinCandidate(null)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={e => e.stopPropagation()}
              className="bg-[var(--dark)] border-2 border-[var(--gold)]/40 rounded-2xl p-6 max-w-sm w-full"
            >
              <div className="text-center">
                <AvatarIcon id={rejoinCandidate.avatar} className="w-20 h-20 mx-auto mb-3 rounded-xl" />
                <h3 className="font-serif text-2xl font-bold text-white mb-1">
                  Rejoin as {rejoinCandidate.name}?
                </h3>
                <p className="text-white/60 text-sm mb-5">
                  This avatar belongs to <span className="text-[var(--gold)]">{rejoinCandidate.name}</span>.
                  Continue if that&apos;s you.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setRejoinCandidate(null)}
                    className="flex-1 h-12 rounded-full border-2 border-white/20 text-white/70 font-medium"
                  >
                    Not me
                  </button>
                  <button
                    onClick={() => {
                      const c = rejoinCandidate
                      setRejoinCandidate(null)
                      restoreSession({ id: c.id, name: c.name })
                    }}
                    className="flex-1 h-12 rounded-full bg-[var(--rose-dark)] border-2 border-[var(--gold)]/60 text-white font-bold"
                  >
                    Yes, that&apos;s me
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  )
}
