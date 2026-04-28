// One-time seed: populate the "502sday" event with 25 fake players, each with
// random Win/Place/Show picks for every non-locked race and a 3x + 2x token
// assigned to two distinct random non-locked races.
//
// Run:  npx ts-node scripts/seed-players.ts
// (Reads NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY from
//  .env.local — same vars the Next app uses.)

import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'

// ── env: load .env.local without depending on dotenv ───────────────────────
function loadEnvLocal(): void {
  const path = resolve(__dirname, '..', '.env.local')
  if (!existsSync(path)) return
  for (const raw of readFileSync(path, 'utf8').split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq < 0) continue
    const key = line.slice(0, eq).trim()
    let val = line.slice(eq + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    if (!(key in process.env)) process.env[key] = val
  }
}
loadEnvLocal()

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local')
  process.exit(1)
}
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// ── data ───────────────────────────────────────────────────────────────────
const EVENT_NAME = '502sday'
const PLAYER_NAMES = [
  'Big Red', 'Mint Julep', 'Roses Only', 'Fast Money',
  'Long Shot Larry', 'Photo Finish', 'Muddy Boots',
  'Triple Crown', 'Silks & Spurs', 'Morning Line',
  'Backstretch Betty', 'Paddock Pete', 'Churchill Chuck',
  'Odds Maker', 'Blanket of Roses', 'Stewards Inquiry',
  'Furlong Frank', 'Homestretch', 'Wire to Wire',
  'Rail Rider', 'Favorite Son', 'Dark Horse Dana',
  'Exacta Eddie', 'Trifecta Tina', 'Place Bet Paul',
] as const

// Avatar IDs in lib/avatars.tsx are zero-padded `avatar_01` … `avatar_40`.
function randomAvatarId(): string {
  const n = Math.floor(Math.random() * 40) + 1
  return `avatar_${String(n).padStart(2, '0')}`
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function pickThreeDistinct<T>(items: T[]): [T, T, T] | null {
  if (items.length < 3) return null
  const pool = items.slice()
  const out: T[] = []
  for (let i = 0; i < 3; i++) {
    const idx = randInt(0, pool.length - 1)
    out.push(pool[idx])
    pool.splice(idx, 1)
  }
  return [out[0], out[1], out[2]]
}

// ── main ───────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  // 1. Find the 502sday event.
  const { data: events, error: eErr } = await supabase
    .from('events')
    .select('id, name')
    .eq('name', EVENT_NAME)
  if (eErr) throw new Error(`events query failed: ${eErr.message}`)
  if (!events || events.length === 0) {
    throw new Error(`No event named "${EVENT_NAME}" found.`)
  }
  if (events.length > 1) {
    console.warn(`Warning: ${events.length} events named "${EVENT_NAME}" — using the first.`)
  }
  const event = events[0] as { id: string; name: string }
  console.log(`✓ Found event "${event.name}" (${event.id})`)

  // 2. Idempotency guard — refuse to double-seed.
  const { data: existing, error: exErr } = await supabase
    .from('players')
    .select('id, name')
    .eq('event_id', event.id)
    .in('name', PLAYER_NAMES as unknown as string[])
  if (exErr) throw new Error(`existing-players check failed: ${exErr.message}`)
  if (existing && existing.length > 0) {
    console.error(`Refusing to seed: ${existing.length} test player(s) already exist for this event.`)
    console.error(`First few: ${existing.slice(0, 5).map(p => p.name).join(', ')}`)
    console.error('Delete them in the admin Players tab if you want to re-seed.')
    process.exit(1)
  }

  // 3. Load races and horses.
  const { data: races, error: rErr } = await supabase
    .from('races')
    .select('id, race_number, status')
    .eq('event_id', event.id)
    .order('race_number')
  if (rErr) throw new Error(`races query failed: ${rErr.message}`)
  if (!races || races.length === 0) throw new Error('No races found for the 502sday event.')
  console.log(`✓ Loaded ${races.length} races`)

  const { data: horses, error: hErr } = await supabase
    .from('horses')
    .select('id, race_id, scratched')
    .in('race_id', races.map(r => r.id))
  if (hErr) throw new Error(`horses query failed: ${hErr.message}`)

  const horsesByRace = new Map<string, string[]>()
  for (const h of horses ?? []) {
    if (h.scratched) continue
    const list = horsesByRace.get(h.race_id) ?? []
    list.push(h.id)
    horsesByRace.set(h.race_id, list)
  }
  console.log(`✓ Loaded ${horses?.length ?? 0} horses (${[...horsesByRace.values()].reduce((s, a) => s + a.length, 0)} unscratched)`)

  // Picks AND multiplier tokens skip locked/finished races — those are no
  // longer in the player flow.
  const pickableRaces = races.filter(r => r.status !== 'locked' && r.status !== 'finished')
  console.log(`✓ ${pickableRaces.length}/${races.length} race(s) are pickable (not locked/finished)`)
  if (pickableRaces.length === 0) {
    throw new Error('All races are locked/finished — nothing to pick.')
  }

  // 4. Insert players.
  const playerRows = PLAYER_NAMES.map(name => ({
    event_id: event.id,
    name,
    avatar: randomAvatarId(),
    paid: false,
    multiplier_3x_race_id: null,
    multiplier_2x_race_id: null,
  }))
  const { data: insertedPlayers, error: pErr } = await supabase
    .from('players')
    .insert(playerRows)
    .select('id, name')
  if (pErr) throw new Error(`players insert failed: ${pErr.message}`)
  if (!insertedPlayers || insertedPlayers.length !== PLAYER_NAMES.length) {
    throw new Error(`expected ${PLAYER_NAMES.length} players inserted, got ${insertedPlayers?.length ?? 0}`)
  }
  console.log(`✓ Inserted ${insertedPlayers.length} players`)

  // 5. Build picks: 3 distinct unscratched horses per pickable race per player.
  type PickRow = {
    player_id: string
    race_id: string
    event_id: string
    win_horse_id: string
    place_horse_id: string
    show_horse_id: string
  }
  const pickRows: PickRow[] = []
  let skippedThinFields = 0
  for (const player of insertedPlayers) {
    for (const race of pickableRaces) {
      const candidates = horsesByRace.get(race.id) ?? []
      const trio = pickThreeDistinct(candidates)
      if (!trio) { skippedThinFields++; continue }
      pickRows.push({
        player_id: player.id,
        race_id: race.id,
        event_id: event.id,
        win_horse_id: trio[0],
        place_horse_id: trio[1],
        show_horse_id: trio[2],
      })
    }
  }
  if (skippedThinFields > 0) {
    console.warn(`  (${skippedThinFields} pick slot(s) skipped — race had <3 unscratched horses)`)
  }

  // Chunk inserts to avoid hitting payload limits on big events.
  const CHUNK = 200
  for (let i = 0; i < pickRows.length; i += CHUNK) {
    const slice = pickRows.slice(i, i + CHUNK)
    const { error } = await supabase.from('picks').insert(slice)
    if (error) throw new Error(`picks insert failed at chunk ${i}: ${error.message}`)
  }
  console.log(`✓ Inserted ${pickRows.length} pick row(s) (${pickableRaces.length} race(s) × ${insertedPlayers.length} player(s) − ${skippedThinFields} skipped)`)

  // 6. Multiplier tokens — stored on the players row (the schema keeps them
  //    there, not on picks). 3x and 2x always land on two distinct pickable
  //    races. Skipped if there are fewer than 2 pickable races.
  if (pickableRaces.length < 2) {
    console.warn('Skipping multiplier assignment — need at least 2 pickable races.')
  } else {
    let assigned = 0
    for (const player of insertedPlayers) {
      const idxA = randInt(0, pickableRaces.length - 1)
      let idxB = randInt(0, pickableRaces.length - 1)
      while (idxB === idxA) idxB = randInt(0, pickableRaces.length - 1)
      const { error } = await supabase
        .from('players')
        .update({
          multiplier_3x_race_id: pickableRaces[idxA].id,
          multiplier_2x_race_id: pickableRaces[idxB].id,
        })
        .eq('id', player.id)
      if (error) {
        console.warn(`  ✗ ${player.name}: ${error.message}`)
      } else {
        assigned++
      }
    }
    console.log(`✓ Assigned 3x + 2x tokens to ${assigned}/${insertedPlayers.length} players`)
  }

  console.log('\nSeed complete.')
}

main().catch(err => {
  console.error('Seed failed:', err instanceof Error ? err.message : err)
  process.exit(1)
})
