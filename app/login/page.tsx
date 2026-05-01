'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { AvatarIcon } from '@/lib/avatars'
import { InstallAppCard } from '@/components/InstallAppCard'
import type { Event, Player } from '@/lib/types'

type WelcomeInfo = {
  id: string
  name: string
  avatar: string
  score: number
  rank: number
  totalPlayers: number
}

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

export default function LoginPage() {
  const router = useRouter()
  const [event, setEvent] = useState<Event | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [searching, setSearching] = useState(false)
  const [match, setMatch] = useState<WelcomeInfo | null>(null)
  const [notFoundFor, setNotFoundFor] = useState<string | null>(null)

  async function init() {
    try {
      const { data: events } = await supabase
        .from('events')
        .select('*')
        .eq('status', 'active')
        .order('date', { ascending: false })
        .limit(1)
      const evt = events?.[0] ?? null
      if (!evt) {
        setLoadError("No event is active right now. Ask the host to set one as active.")
        setLoading(false)
        return
      }
      setEvent(evt)

      // If they're already signed in for this event, send them straight to picks.
      if (typeof window !== 'undefined') {
        const playerId = localStorage.getItem('furlong_player_id')
        if (playerId) {
          const { data: existing } = await supabase
            .from('players')
            .select('id, event_id')
            .eq('id', playerId)
            .maybeSingle()
          if (existing && existing.event_id === evt.id) {
            router.replace('/picks')
            return
          }
        }
      }
    } catch (e) {
      console.error(e)
      setLoadError("Couldn't connect. Check your internet and try again.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void init()

  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function lookup() {
    if (!name.trim() || !event || searching) return
    setSearching(true)
    setNotFoundFor(null)
    try {
      const existing = await findPlayerByName(event.id, name)
      if (!existing) {
        setNotFoundFor(name.trim())
        return
      }
      const info = await loadWelcomeInfo(existing, event.id)
      setMatch(info)
    } catch (e) {
      console.error(e)
      setNotFoundFor(null)
      alert("Couldn't look that up. Try again.")
    } finally {
      setSearching(false)
    }
  }

  function restoreSession(info: WelcomeInfo) {
    if (typeof window !== 'undefined') {
      localStorage.setItem('furlong_player_id', info.id)
      localStorage.setItem('furlong_player_name', info.name)
    }
    router.replace('/picks')
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-3 animate-pulse">🔑</div>
          <p className="text-[var(--text-muted)] text-lg">Looking up the field...</p>
        </div>
      </main>
    )
  }

  if (loadError) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6 text-center">
        <div>
          <p className="text-[var(--text-primary)] mb-4">{loadError}</p>
          <Link
            href="/"
            className="inline-block px-6 h-12 leading-[3rem] rounded-full bg-[var(--rose-dark)] border-2 border-[var(--gold)]/60 text-white font-bold shadow-md"
          >
            Home
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen flex flex-col px-5 py-8">
      <div className="w-full max-w-md mx-auto flex-1 flex flex-col">
        <div className="flex items-center mb-6">
          <Link href="/" className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-sm">← Back</Link>
        </div>

        {!match ? (
          <div className="flex-1 flex flex-col justify-center">
            <div className="text-center mb-8">
              <div className="text-5xl mb-3">🔑</div>
              <h1 className="font-serif text-4xl font-bold text-[var(--text-primary)] mb-2">Log Back In</h1>
              <p className="text-[var(--text-muted)] text-lg">Type your name to restore your session</p>
              {event && (
                <p className="text-[var(--gold)] text-sm mt-2 font-serif italic">{event.name}</p>
              )}
            </div>

            <div className="space-y-4">
              <input
                type="text"
                value={name}
                onChange={e => { setName(e.target.value); setNotFoundFor(null) }}
                placeholder="Your name"
                maxLength={28}
                autoFocus
                className="w-full h-14 px-5 rounded-xl bg-white border-2 border-[var(--border)] text-[var(--text-primary)] text-lg placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--gold)] transition-colors shadow-sm"
                onKeyDown={e => { if (e.key === 'Enter' && name.trim()) void lookup() }}
              />
              <button
                onClick={() => void lookup()}
                disabled={!name.trim() || searching}
                className="w-full h-14 rounded-full bg-[var(--rose-dark)] border-2 border-[var(--gold)]/60 text-white font-bold text-xl disabled:opacity-40 hover:bg-[var(--rose-dark)]/85 active:scale-[0.98] transition-all shadow-md"
              >
                {searching ? 'Searching…' : 'Find me →'}
              </button>

              {notFoundFor && (
                <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 text-center mt-4">
                  <p className="text-amber-800 text-sm">
                    No player named <span className="font-semibold">&ldquo;{notFoundFor}&rdquo;</span> in this event.
                  </p>
                  <Link
                    href="/join"
                    className="inline-block mt-2 text-[var(--rose-dark)] hover:text-[var(--rose-dark)]/80 text-sm font-semibold underline underline-offset-4"
                  >
                    Join as a new player →
                  </Link>
                </div>
              )}

              <div className="text-center pt-2">
                <Link href="/join" className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-sm underline underline-offset-4">
                  Haven&apos;t joined yet? Sign up
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col justify-center">
            <div className="text-center mb-8">
              <AvatarIcon
                id={match.avatar}
                className="w-32 h-32 mx-auto rounded-2xl shadow-lg mb-4"
              />
              <h1 className="font-serif text-3xl font-bold text-[var(--text-primary)] mb-1">Welcome back,</h1>
              <h2 className="font-serif text-3xl font-bold text-[var(--gold)] mb-4 truncate">
                {match.name}!
              </h2>
              <div className="inline-flex items-center gap-6 bg-white border border-[var(--border)] rounded-xl px-5 py-3 shadow-sm">
                <div>
                  <div className="text-[var(--gold)] text-2xl font-bold leading-none">{match.score}</div>
                  <div className="text-[var(--text-muted)] text-xs uppercase tracking-wide">Points</div>
                </div>
                <div className="w-px h-8 bg-[var(--border)]" />
                <div>
                  <div className="text-[var(--gold)] text-2xl font-bold leading-none">
                    #{match.rank}
                    <span className="text-[var(--text-muted)] text-sm font-normal">{' '}/ {match.totalPlayers}</span>
                  </div>
                  <div className="text-[var(--text-muted)] text-xs uppercase tracking-wide">Rank</div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => restoreSession(match)}
                className="w-full h-14 rounded-full bg-[var(--rose-dark)] border-2 border-[var(--gold)]/60 text-white font-bold text-xl hover:bg-[var(--rose-dark)]/85 active:scale-[0.98] transition-all shadow-md"
              >
                🏇 That&apos;s me — Let&apos;s play!
              </button>
              <button
                onClick={() => { setMatch(null); setName(''); setNotFoundFor(null) }}
                className="w-full text-center text-[var(--text-muted)] hover:text-[var(--text-primary)] text-sm underline underline-offset-4 py-2"
              >
                Not me — use a different name
              </button>
            </div>
          </div>
        )}

        {/* Install-the-app helper — collapsed by default, instructions are
            tailored to whichever platform the visitor is on. Self-hides if
            they've already installed (display-mode: standalone). */}
        <InstallAppCard />
      </div>
    </main>
  )
}
