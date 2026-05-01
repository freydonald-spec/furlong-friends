'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { WatchPartyBadge } from '@/lib/watch-party-badge'
import { WatermarkBG } from '@/components/WatermarkBG'

type ReturningPlayer = {
  id: string
  name: string
  rank: number | null
  points: number | null
  totalPlayers: number | null
  eventName: string | null
}

export default function SplashPage() {
  const [returningPlayer, setReturningPlayer] = useState<ReturningPlayer | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const id = localStorage.getItem('furlong_player_id')
    const name = localStorage.getItem('furlong_player_name')
    if (!id || !name) return

    void (async () => {
      const { data: events } = await supabase
        .from('events')
        .select('*')
        .eq('status', 'active')
        .order('date', { ascending: false })
        .limit(1)
      const event = events?.[0]

      if (!event) {
        // No active event — still recognize the player but skip rank/points.
        setReturningPlayer({ id, name, rank: null, points: null, totalPlayers: null, eventName: null })
        return
      }

      const { data: player } = await supabase
        .from('players')
        .select('*')
        .eq('id', id)
        .eq('event_id', event.id)
        .maybeSingle()

      if (!player) {
        // Stored player belongs to a different event (or was deleted) —
        // don't promote them; let them go through /join again.
        return
      }

      const [{ data: allPlayers }, { data: scores }] = await Promise.all([
        supabase.from('players').select('id').eq('event_id', event.id),
        supabase.from('scores').select('*').eq('event_id', event.id),
      ])

      const totals = new Map<string, number>()
      for (const p of allPlayers ?? []) totals.set(p.id, 0)
      for (const s of scores ?? []) {
        totals.set(s.player_id, (totals.get(s.player_id) || 0) + (s.final_points || 0))
      }
      const standings = [...totals.entries()]
        .map(([pid, score]) => ({ id: pid, score }))
        .sort((a, b) => b.score - a.score)
      const myIdx = standings.findIndex(s => s.id === id)
      const rank = myIdx === -1 ? standings.length : myIdx + 1
      const points = totals.get(id) ?? 0

      setReturningPlayer({
        id,
        name: player.name,
        rank,
        points,
        totalPlayers: standings.length,
        eventName: event.name,
      })
    })()
  }, [])

  function notMe() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('furlong_player_id')
      localStorage.removeItem('furlong_player_name')
    }
    setReturningPlayer(null)
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-between px-6 py-10 relative overflow-hidden bg-derby">
      <WatermarkBG />
      {/* Decorative roses */}
      <div className="pointer-events-none select-none absolute inset-0 opacity-[0.06] flex flex-wrap content-start gap-10 text-7xl overflow-hidden">
        {Array.from({ length: 30 }).map((_, i) => (
          <span key={i}>🌹</span>
        ))}
      </div>

      <div className="flex-1 flex flex-col items-center justify-center w-full relative z-10">
        {returningPlayer
          ? <ReturningContent rp={returningPlayer} onNotMe={notMe} />
          : <SplashContent />}
      </div>

      {/* Footer */}
      <div className="relative z-10 flex flex-col items-center gap-4">
        <WatchPartyBadge className="mt-8" />
        <Link
          href="/admin"
          className="text-white/30 text-sm hover:text-white/60 transition-colors"
        >
          Admin
        </Link>
      </div>
    </main>
  )
}

function SplashContent() {
  return (
    <>
      {/* Logo + title */}
      <div className="text-center mb-12">
        <div className="text-7xl mb-3 drop-shadow-lg">🏇</div>
        <h1 className="font-serif text-5xl sm:text-6xl font-extrabold text-white tracking-tight leading-none">
          Furlong
          <span className="text-[var(--gold)]"> &amp; </span>
          Friends
        </h1>
        <div className="flex items-center justify-center gap-3 my-5">
          <div className="h-px w-12 bg-[var(--gold)]" />
          <span className="text-[var(--gold)] text-lg">🌹</span>
          <div className="h-px w-12 bg-[var(--gold)]" />
        </div>
        <p className="text-[var(--gold)] font-serif italic text-base sm:text-xl whitespace-nowrap">
          The Ultimate Derby Day Pick &lsquo;Em Game
        </p>
      </div>

      {/* Buttons */}
      <div className="flex flex-col gap-4 w-full max-w-sm">
        <Link
          href="/join"
          className="flex items-center justify-center h-14 rounded-full bg-[var(--rose-dark)] text-white font-bold text-xl border-2 border-[var(--gold)]/60 shadow-lg hover:bg-[var(--rose-dark)]/85 active:scale-[0.98] transition-all"
        >
          <span className="mr-2">🐎</span>
          Join Game
        </Link>
        <Link
          href="/login"
          className="text-center text-white/55 hover:text-white text-sm underline underline-offset-4"
        >
          Already joined? Log back in
        </Link>
        <Link
          href="/track"
          className="flex items-center justify-center h-14 rounded-full bg-transparent text-[var(--gold)] font-bold text-xl border-2 border-[var(--gold)] hover:bg-[var(--gold)]/10 active:scale-[0.98] transition-all mt-1"
        >
          <span className="mr-2">🏁</span>
          Live Track
        </Link>
      </div>
    </>
  )
}

function ReturningContent({ rp, onNotMe }: { rp: ReturningPlayer; onNotMe: () => void }) {
  return (
    <>
      <div className="text-center mb-8">
        <div className="text-5xl mb-3 drop-shadow-lg">👋</div>
        <h1 className="font-serif text-3xl sm:text-4xl font-extrabold text-white leading-tight">
          Welcome back,
          <br />
          <span className="text-[var(--gold)]">{rp.name}!</span>
        </h1>
        {rp.eventName && (
          <p className="text-[var(--gold)]/80 font-serif italic mt-3 text-sm">
            {rp.eventName}
          </p>
        )}
      </div>

      {rp.rank !== null && rp.points !== null && rp.totalPlayers !== null && (
        <div className="bg-gradient-to-br from-[var(--rose-dark)] to-[#5a0f1d] rounded-2xl p-5 border-2 border-[var(--gold)]/40 shadow-lg w-full max-w-sm mb-6 flex justify-around items-center">
          <div className="text-center">
            <div className="text-[var(--gold)] text-3xl font-bold leading-none tabular-nums">
              {rp.points}
            </div>
            <div className="text-white/60 text-xs uppercase tracking-wide mt-1">
              Points
            </div>
          </div>
          <div className="w-px h-10 bg-white/15" />
          <div className="text-center">
            <div className="text-[var(--gold)] text-3xl font-bold leading-none tabular-nums">
              #{rp.rank}
              <span className="text-white/50 text-lg font-normal"> / {rp.totalPlayers}</span>
            </div>
            <div className="text-white/60 text-xs uppercase tracking-wide mt-1">
              Rank
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3 w-full max-w-sm">
        <Link
          href="/picks"
          className="flex items-center justify-center h-14 rounded-full bg-[var(--rose-dark)] text-white font-bold text-lg border-2 border-[var(--gold)]/60 shadow-lg hover:bg-[var(--rose-dark)]/85 active:scale-[0.98] transition-all"
        >
          <span className="mr-2">🏇</span>
          My Picks
        </Link>
        <Link
          href="/track"
          className="flex items-center justify-center h-14 rounded-full bg-transparent text-[var(--gold)] font-bold text-lg border-2 border-[var(--gold)] hover:bg-[var(--gold)]/10 active:scale-[0.98] transition-all"
        >
          <span className="mr-2">🏁</span>
          Live Track
        </Link>
        <Link
          href="/leaderboard"
          className="flex items-center justify-center h-14 rounded-full bg-transparent text-white font-bold text-lg border-2 border-white/30 hover:bg-white/10 active:scale-[0.98] transition-all"
        >
          <span className="mr-2">📊</span>
          Leaderboard
        </Link>
        <button
          onClick={onNotMe}
          className="text-white/55 hover:text-white text-sm underline underline-offset-4 mt-2"
        >
          Not you? Switch player
        </button>
      </div>
    </>
  )
}
