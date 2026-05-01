import type { Pick, Score, Horse, Race } from './types'
import { computeBonus } from './scoring'

export type Badge = {
  emoji: string
  label: string
  /** Tailwind utility group for the pill background — kept here so all
   *  consumers render badges with the same look. */
  cls: string
}

const ON_FIRE: Badge   = { emoji: '🔥', label: 'On Fire',     cls: 'bg-orange-500/25 text-orange-200 border-orange-400/40' }
const SHARP: Badge     = { emoji: '🎯', label: 'Sharp',       cls: 'bg-[var(--gold)]/25 text-[var(--gold)] border-[var(--gold)]/50' }
const DEGEN: Badge     = { emoji: '🎰', label: 'Degen',       cls: 'bg-rose-500/20 text-rose-200 border-rose-400/40' }
const COLD: Badge      = { emoji: '❄️', label: 'Cold',        cls: 'bg-cyan-500/15 text-cyan-200 border-cyan-400/30' }
const LEADER: Badge    = { emoji: '👑', label: 'Leader',      cls: 'bg-[var(--gold)]/35 text-[var(--gold)] border-[var(--gold)]/70' }
const DARK_HORSE: Badge = { emoji: '🐴', label: 'Dark Horse', cls: 'bg-blue-500/20 text-blue-200 border-blue-400/40' }

/** Display priority — when a player qualifies for several, we pick the
 *  most "interesting" 1-2 from the top of this list. */
const PRIORITY = [LEADER, ON_FIRE, DARK_HORSE, SHARP, DEGEN, COLD]

function rankPlayersByTotal(totals: Map<string, number>): Map<string, number> {
  const arr = [...totals.entries()].sort((a, b) => b[1] - a[1])
  const ranks = new Map<string, number>()
  arr.forEach(([id], idx) => ranks.set(id, idx + 1))
  return ranks
}

export function computePlayerBadges(opts: {
  playerId: string
  rank: number
  totalPlayers: number
  /** Every score row for the event (across all players). */
  scores: Score[]
  /** Every pick row for the event (across all players). Used for bonus detection. */
  picks: Pick[]
  /** Every race for the event (any status). Sorting is handled internally. */
  races: Race[]
  /** Horses keyed by race id. Bonus detection needs morning_line_odds + finish_position. */
  horsesByRace: Record<string, Horse[]>
}): Badge[] {
  const { playerId, rank, totalPlayers, scores, picks, races, horsesByRace } = opts
  const finishedRaces = races
    .filter(r => r.status === 'finished')
    .sort((a, b) => a.race_number - b.race_number)

  // Per-race score in race-number order, with `null` for races the player
  // didn't pick.
  const myFinishedScores = finishedRaces.map(r => ({
    race: r,
    score: scores.find(s => s.player_id === playerId && s.race_id === r.id) ?? null,
  }))

  const earned: Badge[] = []

  // 🔥 On Fire — 3+ consecutive scoring races (final_points > 0)
  let streak = 0
  let maxStreak = 0
  for (const item of myFinishedScores) {
    if (item.score && item.score.final_points > 0) {
      streak++
      if (streak > maxStreak) maxStreak = streak
    } else {
      streak = 0
    }
  }
  if (maxStreak >= 3) earned.push(ON_FIRE)

  // ❄️ Cold — 0 points in last 2 finished races
  if (myFinishedScores.length >= 2) {
    const last2 = myFinishedScores.slice(-2)
    const both0 = last2.every(item => !item.score || item.score.final_points === 0)
    if (both0) earned.push(COLD)
  }

  // 👑 Leader — currently #1 (with at least one other player to lead over)
  if (rank === 1 && totalPlayers > 1) earned.push(LEADER)

  // 🎯 Sharp + 🎰 Degen — count perfect-race + longshot bonuses
  let perfectCount = 0
  let longshotCount = 0
  for (const item of myFinishedScores) {
    if (!item.score) continue
    const myPick = picks.find(p => p.player_id === playerId && p.race_id === item.race.id)
    if (!myPick) continue
    const raceHorses = horsesByRace[item.race.id] ?? []
    const winH = raceHorses.find(h => h.finish_position === 1) ?? null
    const placeH = raceHorses.find(h => h.finish_position === 2) ?? null
    const showH = raceHorses.find(h => h.finish_position === 3) ?? null
    const bonus = computeBonus(myPick, winH, placeH, showH)
    if (bonus.perfect) perfectCount++
    if (bonus.longshot) longshotCount++
  }
  if (perfectCount >= 2) earned.push(SHARP)
  if (longshotCount >= 1) earned.push(DEGEN)

  // 🐴 Dark Horse — bottom-half player who jumped 3+ ranks in the last race
  if (
    finishedRaces.length > 0 &&
    rank > totalPlayers / 2 &&
    totalPlayers >= 4
  ) {
    const allPlayerIds = new Set<string>()
    for (const s of scores) allPlayerIds.add(s.player_id)
    if (allPlayerIds.has(playerId)) {
      const racesBeforeLast = finishedRaces.slice(0, -1)
      const before = new Map<string, number>()
      for (const id of allPlayerIds) before.set(id, 0)
      for (const s of scores) {
        if (racesBeforeLast.some(r => r.id === s.race_id)) {
          before.set(s.player_id, (before.get(s.player_id) || 0) + s.final_points)
        }
      }
      const after = new Map<string, number>()
      for (const id of allPlayerIds) after.set(id, 0)
      for (const s of scores) {
        if (finishedRaces.some(r => r.id === s.race_id)) {
          after.set(s.player_id, (after.get(s.player_id) || 0) + s.final_points)
        }
      }
      const ranksBefore = rankPlayersByTotal(before)
      const ranksAfter = rankPlayersByTotal(after)
      const beforeR = ranksBefore.get(playerId)
      const afterR = ranksAfter.get(playerId)
      if (beforeR !== undefined && afterR !== undefined && beforeR - afterR >= 3) {
        earned.push(DARK_HORSE)
      }
    }
  }

  // Sort by priority + take top 2
  const ordered = [...earned].sort(
    (a, b) => PRIORITY.indexOf(a) - PRIORITY.indexOf(b),
  )
  return ordered.slice(0, 2)
}
