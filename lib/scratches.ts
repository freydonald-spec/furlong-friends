import type { Horse, Pick, Player, Race, ScratchAlert } from './types'

const SLOT_ORDER: Record<ScratchAlert['slot'], number> = {
  win: 0, place: 1, show: 2,
}

/** Cross-references picks against the current scratched-horses set and
 *  produces a flat list of "pick is on a scratched horse" alerts. Pure —
 *  the same fn drives both the per-player banner on /picks and the
 *  event-wide warning panel on /admin. Pass `playerId` to scope the result
 *  to a single player. */
export function findScratchAlerts(opts: {
  players: Player[]
  picks: Pick[]
  races: Race[]
  horsesByRace: Record<string, Horse[]>
  /** When provided, only alerts for this player are returned. */
  playerId?: string
}): ScratchAlert[] {
  const { players, picks, races, horsesByRace, playerId } = opts
  const playersById = new Map(players.map(p => [p.id, p]))
  const racesById = new Map(races.map(r => [r.id, r]))
  const out: ScratchAlert[] = []

  for (const pick of picks) {
    if (playerId && pick.player_id !== playerId) continue
    const player = playersById.get(pick.player_id)
    if (!player) continue
    const race = racesById.get(pick.race_id)
    if (!race) continue
    const horses = horsesByRace[race.id] ?? []
    const slots: { slot: ScratchAlert['slot']; horseId: string | null }[] = [
      { slot: 'win',   horseId: pick.win_horse_id },
      { slot: 'place', horseId: pick.place_horse_id },
      { slot: 'show',  horseId: pick.show_horse_id },
    ]
    for (const { slot, horseId } of slots) {
      if (!horseId) continue
      const horse = horses.find(h => h.id === horseId)
      if (!horse || !horse.scratched) continue
      out.push({
        playerId: player.id,
        playerName: player.name,
        playerAvatar: player.avatar,
        raceId: race.id,
        raceNumber: race.race_number,
        raceName: race.name || `Race ${race.race_number}`,
        slot,
        horseNumber: horse.number,
        horseName: horse.name,
      })
    }
  }

  // Stable display order: race number → player name → slot priority.
  out.sort((a, b) => {
    if (a.raceNumber !== b.raceNumber) return a.raceNumber - b.raceNumber
    if (a.playerName !== b.playerName) return a.playerName.localeCompare(b.playerName)
    return SLOT_ORDER[a.slot] - SLOT_ORDER[b.slot]
  })
  return out
}
