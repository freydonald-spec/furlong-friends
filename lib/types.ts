export type Event = {
  id: string
  name: string
  track: string
  location: string
  date: string
  buy_in_amount: number
  multiplier_visible: boolean
  score_reveal_mode: 'auto' | 'manual'
  status: string
  /** Soft cap on how many races the wizard / picks page exposes to a player.
   *  Optional on the type for backward compatibility; defaults to 7 at the
   *  DB level (see scripts/add-game-race-columns.sql). */
  max_game_races?: number
}

export type Race = {
  id: string
  event_id: string
  race_number: number
  name: string
  distance: string | null
  post_time: string | null
  is_featured: boolean
  featured_multiplier: number
  status: 'upcoming' | 'open' | 'locked' | 'finished'
  /** Hide a race from players entirely — admin-tab toggle. Optional on the
   *  type so reads of pre-migration rows still work; new writes always set it.
   *  Defaults to true at the DB level (see scripts/add-game-race-columns.sql). */
  is_game_race?: boolean
}

export type Horse = {
  id: string
  race_id: string
  name: string
  number: number
  morning_line_odds: string | null
  scratched: boolean
  finish_position: number | null
}

export type Player = {
  id: string
  event_id: string
  name: string
  avatar: string
  paid: boolean
  multiplier_3x_race_id: string | null
  multiplier_2x_race_id: string | null
}

export type Pick = {
  id: string
  player_id: string
  race_id: string
  event_id: string
  win_horse_id: string | null
  place_horse_id: string | null
  show_horse_id: string | null
}

export type Score = {
  id: string
  player_id: string
  race_id: string
  event_id: string
  base_points: number
  multiplier_applied: number
  final_points: number
  /** Longshot + perfect-race bonus, added on top of base × multiplier.
   *  Optional on the type so reads of pre-migration rows still work; new
   *  writes always include it (see scripts/add-bonus-points-column.sql). */
  bonus_points?: number
  win_correct: boolean
  place_correct: boolean
  show_correct: boolean
}
