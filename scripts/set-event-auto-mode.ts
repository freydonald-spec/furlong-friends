// One-shot: flip the 502sday event's score_reveal_mode to 'auto' so scores
// publish immediately on Recalculate (no manual reveal needed).
//
// Run: npx ts-node scripts/set-event-auto-mode.ts

import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'

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

const EVENT_NAME = '502sday'

async function main(): Promise<void> {
  // Show current state first.
  const { data: before, error: bErr } = await supabase
    .from('events')
    .select('id, name, score_reveal_mode')
    .eq('name', EVENT_NAME)
  if (bErr) throw new Error(`lookup failed: ${bErr.message}`)
  if (!before || before.length === 0) {
    throw new Error(`No event named "${EVENT_NAME}" found.`)
  }
  console.log('Before:', before)

  const { data: after, error: uErr } = await supabase
    .from('events')
    .update({ score_reveal_mode: 'auto' })
    .eq('name', EVENT_NAME)
    .select('id, name, score_reveal_mode')
  if (uErr) throw new Error(`update failed: ${uErr.message}`)
  console.log('After: ', after)
}

main().catch(err => {
  console.error('Failed:', err instanceof Error ? err.message : err)
  process.exit(1)
})
