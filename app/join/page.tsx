'use client'

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import { supabase } from "@/lib/supabase"
import { AVATARS, AvatarIcon } from "@/lib/avatars"
import type { Event } from "@/lib/types"

type TakenInfo = { avatar: string; name: string; id: string }

export default function JoinPage() {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2>(1)
  const [name, setName] = useState("")
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null)
  const [taken, setTaken] = useState<TakenInfo[]>([])
  const [event, setEvent] = useState<Event | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rejoinCandidate, setRejoinCandidate] = useState<TakenInfo | null>(null)

  async function init() {
    try {
      // We'll check the returning-player redirect after we know the active event.

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

  async function rejoin(player: TakenInfo) {
    if (typeof window !== 'undefined') {
      localStorage.setItem('furlong_player_id', player.id)
      localStorage.setItem('furlong_player_name', player.name)
    }
    router.replace('/picks')
  }

  async function handleJoin() {
    if (!selectedAvatar || !event || !name.trim()) return
    setSubmitting(true)
    setError(null)

    try {
      // Race-condition check
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

      if (typeof window !== 'undefined') {
        localStorage.setItem('furlong_player_id', player.id)
        localStorage.setItem('furlong_player_name', player.name)
      }
      router.replace('/picks')
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

        {step === 1 && (
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
                onKeyDown={e => e.key === 'Enter' && name.trim() && setStep(2)}
              />
              <button
                onClick={() => name.trim() && setStep(2)}
                disabled={!name.trim()}
                className="w-full h-14 rounded-full bg-[var(--rose-dark)] border-2 border-[var(--gold)]/60 text-white font-bold text-xl disabled:opacity-40 hover:bg-[var(--rose-dark)]/85 active:scale-[0.98] transition-all"
              >
                Continue →
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
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
                  onClick={() => setStep(1)}
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

      {/* Rejoin modal */}
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
                    onClick={() => rejoin(rejoinCandidate)}
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
