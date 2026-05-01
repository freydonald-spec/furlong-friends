'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Pick } from '@/lib/types'

/** Below this number of players win-picking a race we suppress confidence
 *  display entirely so a single early picker doesn't get rendered as 100%. */
export const PEER_CONFIDENCE_THRESHOLD = 5

export type RaceConfidence = {
  /** horseId → percentage (0..100, rounded). Horses nobody picked are absent. */
  pctByHorse: Record<string, number>
  /** Most-picked horse for the win slot. */
  topHorseId: string
  /** Cached % for the top horse — equal to pctByHorse[topHorseId]. */
  topPct: number
  /** Total players who win-picked this race (after any opt-in exclusion). */
  total: number
}

/** Pure aggregator for one race's worth of picks. Returns null when the
 *  threshold isn't met so consumers don't need to repeat the gate. */
export function computeRaceConfidence(
  picksForRace: Pick[],
  opts?: { excludePlayerId?: string },
): RaceConfidence | null {
  const counts = new Map<string, number>()
  let total = 0
  for (const p of picksForRace) {
    if (!p.win_horse_id) continue
    if (opts?.excludePlayerId && p.player_id === opts.excludePlayerId) continue
    counts.set(p.win_horse_id, (counts.get(p.win_horse_id) ?? 0) + 1)
    total++
  }
  if (total < PEER_CONFIDENCE_THRESHOLD) return null
  const pctByHorse: Record<string, number> = {}
  let topHorseId: string | null = null
  let topCount = 0
  for (const [hid, c] of counts) {
    pctByHorse[hid] = Math.round((c / total) * 100)
    if (c > topCount) { topCount = c; topHorseId = hid }
  }
  if (!topHorseId) return null
  return { pctByHorse, topHorseId, topPct: pctByHorse[topHorseId], total }
}

/** Convenience: derive RaceConfidence for every race in `picks`. Races whose
 *  pick count is below the threshold are simply omitted from the result. */
export function computeAllConfidence(
  picks: Pick[],
  opts?: { excludePlayerId?: string },
): Record<string, RaceConfidence> {
  const grouped = new Map<string, Pick[]>()
  for (const p of picks) {
    const arr = grouped.get(p.race_id) ?? []
    arr.push(p)
    grouped.set(p.race_id, arr)
  }
  const result: Record<string, RaceConfidence> = {}
  for (const [raceId, racePicks] of grouped) {
    const conf = computeRaceConfidence(racePicks, opts)
    if (conf) result[raceId] = conf
  }
  return result
}

/** Subscribes to event-wide picks and exposes both the raw rows and a
 *  per-race confidence summary. Use the hook when a component owns its own
 *  data; if a parent already holds picks (e.g. /picks page), prefer
 *  `computeAllConfidence` to avoid setting up a duplicate channel. */
export function usePeerConfidence(
  eventId: string | null,
  opts?: { excludePlayerId?: string },
): {
  picks: Pick[]
  byRace: Record<string, RaceConfidence>
} {
  const [picks, setPicks] = useState<Pick[]>([])
  const excludeId = opts?.excludePlayerId

  useEffect(() => {
    if (!eventId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPicks([])
      return
    }
    let cancelled = false

    void (async () => {
      const { data, error } = await supabase
        .from('picks')
        .select('*')
        .eq('event_id', eventId)
      if (cancelled) return
      if (error) {
        console.error('[usePeerConfidence] load failed', error)
        return
      }
      setPicks((data as Pick[] | null) ?? [])
    })()

    const channel = supabase
      .channel(`peer-confidence-${eventId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'picks', filter: `event_id=eq.${eventId}` },
        (payload) => {
          if (cancelled) return
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const p = payload.new as Pick
            setPicks(prev => {
              const idx = prev.findIndex(x => x.id === p.id)
              if (idx === -1) return [...prev, p]
              const next = prev.slice()
              next[idx] = p
              return next
            })
          } else if (payload.eventType === 'DELETE') {
            const oldP = payload.old as Pick
            setPicks(prev => prev.filter(x => x.id !== oldP.id))
          }
        })
      .subscribe()

    return () => {
      cancelled = true
      void supabase.removeChannel(channel)
    }
  }, [eventId])

  const byRace = useMemo(
    () => computeAllConfidence(picks, excludeId ? { excludePlayerId: excludeId } : undefined),
    [picks, excludeId],
  )

  return { picks, byRace }
}
