import type { Pick, Horse } from './types'

/** Parses morning-line odds strings like "5/2", "9-2", or "30" into a numeric
 *  value (the "X-to-1" payout multiplier). Returns Infinity if unparseable. */
export function oddsToValue(odds: string | null | undefined): number {
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

export const LONGSHOT_THRESHOLD = 15
export const LONGSHOT_BONUS = 5
export const PERFECT_RACE_BONUS = 5

export type BonusBreakdown = {
  /** True if any exact-match pick was on a horse with morning-line >= 15-1. */
  longshot: boolean
  /** True if all three slots (W/P/S) were exact matches. */
  perfect: boolean
  /** Sum of bonus points awarded (longshot + perfect, capped per category). */
  total: number
}

/** Detects longshot + perfect-race bonuses for a single player's pick on a
 *  finished race. Pure: callers pass the post-result horse identities (e.g.
 *  the horses with finish_position 1/2/3, or the explicit ids during admin
 *  scoring) so the same helper drives both the calculation path and any
 *  display-time recompute. */
export function computeBonus(
  pick: Pick | null,
  winHorse: Horse | null,
  placeHorse: Horse | null,
  showHorse: Horse | null,
): BonusBreakdown {
  if (!pick) return { longshot: false, perfect: false, total: 0 }

  const isLongshot = (h: Horse | null) =>
    h ? oddsToValue(h.morning_line_odds) >= LONGSHOT_THRESHOLD : false

  let longshot = false
  if (pick.win_horse_id && winHorse && pick.win_horse_id === winHorse.id && isLongshot(winHorse)) longshot = true
  if (pick.place_horse_id && placeHorse && pick.place_horse_id === placeHorse.id && isLongshot(placeHorse)) longshot = true
  if (pick.show_horse_id && showHorse && pick.show_horse_id === showHorse.id && isLongshot(showHorse)) longshot = true

  const perfect =
    !!pick.win_horse_id && !!winHorse && pick.win_horse_id === winHorse.id &&
    !!pick.place_horse_id && !!placeHorse && pick.place_horse_id === placeHorse.id &&
    !!pick.show_horse_id && !!showHorse && pick.show_horse_id === showHorse.id

  const total = (longshot ? LONGSHOT_BONUS : 0) + (perfect ? PERFECT_RACE_BONUS : 0)
  return { longshot, perfect, total }
}
