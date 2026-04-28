'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

type Horse = { number: number; name: string; odds: string }
type ParsedRace = { number: number; postTime: string; name: string; purse: number; horses: Horse[] }
type ErrorPayload = { msgs: string[]; type: 'error' | 'warning' }

const NOISE: RegExp[] = [
  /^daily double/i,
  /^exacta\s*\//i,
  /^picks report/i,
  /^race \d+:/i,
  /^get churchill/i,
  /^get keeneland/i,
  /^get .+ picks/i,
  /^top kentucky derby/i,
  /^five.star horses/i,
  /^the kentucky derby is/i,
  /^reserve preakness/i,
  /^get a head start/i,
  /^get the triple crown/i,
  /^\(also.eligible\)/i,
  /^in a 20.horse field/i,
  /^add to cart/i,
  /^there's potential/i,
  /^super hi.5/i,
  /^matchup/i,
]

function isNoise(line: string): boolean {
  return NOISE.some(re => re.test(line))
}

// "6F, Dirt, $50,000 Claiming" → "$50,000 Claiming"
// "5F, Turf, Kentucky Juvenile S. presented by Resolute Racing" → "Kentucky Juvenile S."
function extractRaceName(line: string): string {
  let s = line.replace(/^\d+(?:\s+\d+\/\d+)?\s*(?:f|m|furlongs?|miles?)\s*,?\s*/i, '').trim()
  s = s.replace(/^(?:dirt|turf|all weather|synthetic|inner dirt)\s*,?\s*/i, '').trim()
  s = s.replace(/\s+presented by\s+.*/i, '').trim()
  s = s.replace(/,\s*$/, '').trim()
  return s.length > 2 ? s : ''
}

function parseHrn(text: string, dateVal: string): { races: ParsedRace[]; warnings: string[] } {
  const warnings: string[] = []
  const [yr, mo, dy] = dateVal.split('-')
  const dateStr = `${mo}/${dy}/${yr}`

  const lines = text.split('\n').map(l => l.trim())

  const raceHeaderRe = /race\s*#\s*(\d+)\s*,\s*(\d{1,2}:\d{2}\s*(?:AM|PM))/i
  const purseRe = /^purse\s*:\s*\$?([\d,]+)/i
  const oddsOnlyRe = /^(\d+\/\d+)$/
  // Horse number line: `program#\tpost-position#` followed by an optional
  // tabbed name. Trailing tabs are stripped by the earlier `.trim()`, so the
  // third group is optional and matches both "1\t1" and "1\t1\tHorse Name".
  const horseNumLineRe = /^(\d+)\t(\d+)(?:\t(.*))?$/
  const distSurfaceRe = /^\d+(?:\s+\d+\/\d+)?\s*(?:f|m|furlongs?|miles?)\s*,\s*(?:dirt|turf|all weather|synthetic)/i

  const races: ParsedRace[] = []
  let currentRace: ParsedRace | null = null
  let expectingHorseName = false
  let pendingHorseNum: number | null = null
  let pendingHorseName: string | null = null

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!line) {
      // No reset on blank lines — HRN's per-horse block (name, sire, blank,
      // trainer, blank, jockey, blank, odds) easily exceeds the old threshold
      // of 3, killing the pending horse before its odds line arrives. State
      // is naturally cleared by the next "N\tN\t" horseNum line or the next
      // race header.
      continue
    }

    if (isNoise(line)) continue

    const raceMatch = line.match(raceHeaderRe)
    if (raceMatch) {
      if (currentRace && currentRace.horses.length > 0) races.push(currentRace)
      currentRace = {
        number: parseInt(raceMatch[1], 10),
        postTime: `${dateStr} ${raceMatch[2].trim().toUpperCase()}`,
        name: '',
        purse: 0,
        horses: [],
      }
      expectingHorseName = false
      pendingHorseNum = null
      pendingHorseName = null
      continue
    }

    if (!currentRace) continue

    const purseMatch = line.match(purseRe)
    if (purseMatch) {
      currentRace.purse = parseInt(purseMatch[1].replace(/,/g, ''), 10)
      continue
    }

    if (!currentRace.name && distSurfaceRe.test(line)) {
      const name = extractRaceName(line)
      if (name) currentRace.name = name
      continue
    }

    if (/fillies|mares|geldings|colts|open|year olds/i.test(line) && line.includes('|')) continue
    if (/^#\s+PP\s+Horse/i.test(line)) continue

    const oddsMatch = line.match(oddsOnlyRe)
    if (oddsMatch && pendingHorseName && pendingHorseNum !== null) {
      const odds = oddsMatch[1].replace('/', '-')
      const exists = currentRace.horses.find(h => h.number === pendingHorseNum)
      if (!exists) {
        currentRace.horses.push({ number: pendingHorseNum, name: pendingHorseName, odds })
      }
      expectingHorseName = false
      pendingHorseNum = null
      pendingHorseName = null
      continue
    }

    const horseNumMatch = line.match(horseNumLineRe)
    if (horseNumMatch) {
      const num = parseInt(horseNumMatch[1], 10)
      if (num >= 1 && num <= 30) {
        pendingHorseNum = num
        pendingHorseName = null
        expectingHorseName = true

        const inline = (horseNumMatch[3] || '').trim()
        if (inline.length > 1) {
          pendingHorseName = inline.replace(/\s*\(\d+\)\s*$/, '').trim()
        }
        continue
      }
    }

    if (expectingHorseName && pendingHorseName === null && line.length > 1) {
      if (!isNoise(line) && !purseRe.test(line) && !raceHeaderRe.test(line)) {
        pendingHorseName = line.replace(/\s*\(\d+\)\s*$/, '').trim()
      }
      continue
    }

    if (expectingHorseName && pendingHorseName !== null) {
      if (oddsOnlyRe.test(line)) {
        const odds = line.replace('/', '-')
        const exists = currentRace.horses.find(h => h.number === pendingHorseNum)
        if (!exists && pendingHorseNum !== null) {
          currentRace.horses.push({ number: pendingHorseNum, name: pendingHorseName, odds })
        }
        expectingHorseName = false
        pendingHorseNum = null
        pendingHorseName = null
      }
    }
  }

  if (currentRace && currentRace.horses.length > 0) races.push(currentRace)

  races.forEach(r => {
    if (!r.name) r.name = `Race ${r.number}`
  })

  races.forEach(r => {
    if (r.horses.length < 2) {
      warnings.push(`Race ${r.number} (${r.name}) only found ${r.horses.length} horse — check that race.`)
    }
  })

  return { races, warnings }
}

const SAMPLE_TEXT = `Churchill Downs Race # 1, 12:45 PM
6 f, Dirt, $50,000 Claiming
Open | 3 Year Olds And Up
Purse: $78,000
Daily Double / Exacta / Trifecta / Superfecta / Pick 3 (Races 1-2-3)

Picks Report HRN Power Pick selection. (races 1-3 provided free)
Race 1: Get Churchill Downs Picks for all of today's races.

#\tPP\tHorse (last) / Sire\tTrainer / Jockey\t\tML
1\t1\t
Banned for Life (114)
Maximus Mischief

Albert M. Stall, Jr.

Luis Saez

8/5

2\t2\t
Optical (96)
City of Light

J. Keith Desormeaux

James Graham

6/1

3\t3\t
Surf City (74)
Mendelssohn

Victoria H. Oliver

Junior Alvarado

12/1

Churchill Downs Race # 2, 1:15 PM
6 f, Dirt, Allowance
Fillies & Mares | 3 Year Olds And Up
Purse: $127,000
Daily Double / Exacta / Trifecta

#\tPP\tHorse (last) / Sire\tTrainer / Jockey\t\tML
1\t1\t
Delightful Claire (114)
Thousand Words

Philip A. Bauer

Tyler Gaffalione

6/5

2\t2\t
Chatter (102)
Vekoma

Saffie A. Joseph, Jr.

Irad Ortiz, Jr.

5/2

3\t3\t
Shared Vision (99)
McKinzie

George R. Arnold II

Edgar Morales

3/1`

const PAGE_CSS = `
.cb-root {
  --rose:    #8B1A1A;
  --rose-lt: #A52020;
  --gold:    #C9A84C;
  --gold-lt: #E2C06A;
  --cream:   #F5EDD8;
  --dark:    #0E0B07;
  --dark2:   #1A1510;
  --dark3:   #241E16;
  --mid:     #3A3028;
  --muted:   #8A7A6A;
  --white:   #FFFFFF;
  --green:   #2E7D32;
  --red:     #C62828;

  background: var(--dark);
  color: var(--cream);
  font-family: 'DM Sans', sans-serif;
  min-height: 100vh;
  background-image:
    radial-gradient(ellipse at 20% 0%, rgba(139,26,26,0.15) 0%, transparent 60%),
    radial-gradient(ellipse at 80% 100%, rgba(201,168,76,0.08) 0%, transparent 60%);
}

.cb-root * { box-sizing: border-box; margin: 0; padding: 0; }

.cb-header {
  border-bottom: 1px solid rgba(201,168,76,0.2);
  padding: 24px 40px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(14,11,7,0.8);
  backdrop-filter: blur(10px);
  position: sticky;
  top: 0;
  z-index: 100;
}

.cb-logo { display: flex; align-items: center; gap: 14px; }
.cb-logo-icon {
  width: 40px; height: 40px;
  background: var(--rose);
  border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  font-size: 20px;
  border: 1px solid rgba(201,168,76,0.3);
}
.cb-logo-text {
  font-family: 'Playfair Display', serif;
  font-size: 22px; font-weight: 700;
  color: var(--white);
}
.cb-logo-text span { color: var(--gold); }
.cb-badge {
  font-family: 'DM Mono', monospace;
  font-size: 11px;
  color: var(--gold);
  border: 1px solid rgba(201,168,76,0.3);
  padding: 4px 10px;
  border-radius: 20px;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.cb-main {
  max-width: 1100px;
  margin: 0 auto;
  padding: 40px 24px 80px;
}
.cb-hero { text-align: center; margin-bottom: 48px; }
.cb-hero h1 {
  font-family: 'Playfair Display', serif;
  font-size: clamp(32px, 5vw, 52px);
  font-weight: 900;
  line-height: 1.1;
  margin-bottom: 16px;
}
.cb-hero h1 em { font-style: italic; color: var(--gold); }
.cb-hero p {
  color: var(--muted);
  font-size: 16px;
  max-width: 560px;
  margin: 0 auto;
  line-height: 1.6;
}

.cb-steps {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-bottom: 40px;
}
.cb-step {
  background: var(--dark2);
  border: 1px solid rgba(201,168,76,0.15);
  border-radius: 12px;
  padding: 20px;
  display: flex; gap: 14px; align-items: flex-start;
}
.cb-step-num {
  width: 32px; height: 32px; min-width: 32px;
  background: var(--rose);
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-family: 'DM Mono', monospace;
  font-size: 13px; font-weight: 500;
  color: var(--white);
  border: 1px solid rgba(201,168,76,0.3);
}
.cb-step-text strong {
  display: block;
  font-size: 13px; font-weight: 600;
  color: var(--white);
  margin-bottom: 4px;
}
.cb-step-text span {
  font-size: 12px;
  color: var(--muted);
  line-height: 1.5;
}
.cb-step-text a { color: var(--gold); text-decoration: none; }
.cb-step-text a:hover { text-decoration: underline; }

.cb-card {
  background: var(--dark2);
  border: 1px solid rgba(201,168,76,0.15);
  border-radius: 16px;
  padding: 32px;
  margin-bottom: 24px;
}
.cb-card-title {
  font-family: 'Playfair Display', serif;
  font-size: 20px; font-weight: 700;
  color: var(--white);
  margin-bottom: 20px;
  display: flex; align-items: center; gap: 10px;
}
.cb-card-title::after {
  content: '';
  flex: 1;
  height: 1px;
  background: rgba(201,168,76,0.2);
}

.cb-field-row {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 16px;
  margin-bottom: 20px;
}
.cb-field-row.two-col { grid-template-columns: 1fr 1fr; }
.cb-field { display: flex; flex-direction: column; gap: 8px; }
.cb-root label {
  font-size: 12px;
  font-weight: 600;
  color: var(--gold);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-family: 'DM Mono', monospace;
}
.cb-root input, .cb-root select {
  background: var(--dark3);
  border: 1px solid rgba(201,168,76,0.2);
  border-radius: 8px;
  color: var(--cream);
  font-family: 'DM Sans', sans-serif;
  font-size: 14px;
  padding: 10px 14px;
  outline: none;
  transition: border-color 0.2s;
}
.cb-root input:focus, .cb-root select:focus { border-color: var(--gold); }
.cb-root input::placeholder { color: var(--muted); }
.cb-root select option { background: var(--dark3); }
.cb-root textarea {
  width: 100%;
  background: var(--dark3);
  border: 1px solid rgba(201,168,76,0.2);
  border-radius: 10px;
  color: var(--cream);
  font-family: 'DM Mono', monospace;
  font-size: 12px;
  line-height: 1.6;
  padding: 16px;
  outline: none;
  resize: vertical;
  transition: border-color 0.2s;
  min-height: 280px;
}
.cb-root textarea:focus { border-color: var(--gold); }
.cb-root textarea::placeholder { color: var(--muted); }

.cb-btn-row {
  display: flex; gap: 12px;
  margin-top: 20px;
  flex-wrap: wrap;
}
.cb-btn {
  padding: 12px 24px;
  border-radius: 10px;
  font-family: 'DM Sans', sans-serif;
  font-size: 14px; font-weight: 600;
  cursor: pointer;
  border: none;
  transition: all 0.2s;
  display: flex; align-items: center; gap: 8px;
}
.cb-btn-primary {
  background: var(--rose);
  color: var(--white);
  border: 1px solid rgba(201,168,76,0.4);
}
.cb-btn-primary:hover { background: var(--rose-lt); transform: translateY(-1px); }
.cb-btn-primary:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }
.cb-btn-gold {
  background: var(--gold);
  color: var(--dark);
  font-weight: 700;
}
.cb-btn-gold:hover { background: var(--gold-lt); transform: translateY(-1px); }
.cb-btn-gold:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }
.cb-btn-ghost {
  background: transparent;
  color: var(--muted);
  border: 1px solid rgba(255,255,255,0.1);
}
.cb-btn-ghost:hover { border-color: var(--muted); color: var(--cream); }

.cb-preview-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 12px;
}
.cb-preview-stats { display: flex; gap: 20px; flex-wrap: wrap; }
.cb-stat { display: flex; flex-direction: column; gap: 2px; }
.cb-stat-val {
  font-family: 'Playfair Display', serif;
  font-size: 28px; font-weight: 700;
  color: var(--gold);
  line-height: 1;
}
.cb-stat-label {
  font-size: 11px;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-family: 'DM Mono', monospace;
}

.cb-race-grid { display: grid; gap: 10px; }
.cb-race-row {
  background: var(--dark3);
  border: 1px solid rgba(201,168,76,0.1);
  border-radius: 10px;
  padding: 14px 18px;
  display: flex; align-items: center; gap: 14px;
  transition: border-color 0.2s;
}
.cb-race-row:hover { border-color: rgba(201,168,76,0.3); }
.cb-race-row.featured {
  border-color: rgba(201,168,76,0.5);
  background: rgba(201,168,76,0.05);
}
.cb-race-num {
  width: 36px; height: 36px; min-width: 36px;
  background: var(--rose);
  border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  font-family: 'DM Mono', monospace;
  font-size: 13px; font-weight: 500;
  color: var(--white);
}
.cb-race-info { flex: 1; min-width: 0; }
.cb-race-name-display {
  font-size: 14px; font-weight: 600;
  color: var(--white);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.cb-race-meta {
  font-size: 12px;
  color: var(--muted);
  font-family: 'DM Mono', monospace;
  margin-top: 2px;
}
.cb-race-pills {
  display: flex; gap: 8px; align-items: center; flex-wrap: wrap;
}
.cb-pill {
  font-size: 11px;
  padding: 3px 10px;
  border-radius: 20px;
  font-family: 'DM Mono', monospace;
  font-weight: 500;
  white-space: nowrap;
}
.cb-pill-horses { background: rgba(255,255,255,0.08); color: var(--cream); }
.cb-pill-purse { background: rgba(201,168,76,0.15); color: var(--gold); }
.cb-pill-featured { background: var(--gold); color: var(--dark); font-weight: 700; }
.cb-pill-time { background: rgba(139,26,26,0.3); color: #FF8A80; }

.cb-error-box {
  background: rgba(198,40,40,0.15);
  border: 1px solid rgba(198,40,40,0.4);
  border-radius: 10px;
  padding: 14px 18px;
  margin-top: 16px;
  font-size: 13px;
  color: #FF8A80;
}
.cb-error-box.warning {
  background: rgba(255,152,0,0.1);
  border-color: rgba(255,152,0,0.4);
  color: #FFB74D;
}
.cb-error-box ul { padding-left: 18px; margin-top: 6px; }
.cb-error-box li { margin-bottom: 4px; }

.cb-success-box {
  background: rgba(46,125,50,0.15);
  border: 1px solid rgba(46,125,50,0.4);
  border-radius: 10px;
  padding: 14px 18px;
  margin-top: 16px;
  font-size: 13px;
  color: #A5D6A7;
}

.cb-csv-output {
  background: var(--dark);
  border: 1px solid rgba(201,168,76,0.2);
  border-radius: 10px;
  padding: 16px;
  font-family: 'DM Mono', monospace;
  font-size: 11px;
  color: var(--cream);
  line-height: 1.7;
  max-height: 300px;
  overflow-y: auto;
  white-space: pre;
  margin-top: 16px;
}

.cb-divider {
  height: 1px;
  background: rgba(201,168,76,0.15);
  margin: 28px 0;
}

.cb-instructions {
  background: rgba(201,168,76,0.05);
  border: 1px solid rgba(201,168,76,0.2);
  border-radius: 10px;
  padding: 16px 20px;
  margin-bottom: 20px;
  font-size: 13px;
  color: var(--muted);
  line-height: 1.7;
}
.cb-instructions strong { color: var(--gold); }
.cb-instructions code {
  background: rgba(255,255,255,0.08);
  padding: 1px 6px;
  border-radius: 4px;
  font-family: 'DM Mono', monospace;
  font-size: 11px;
  color: var(--cream);
}

@media (max-width: 700px) {
  .cb-steps { grid-template-columns: 1fr; }
  .cb-field-row { grid-template-columns: 1fr 1fr; }
  .cb-header { padding: 16px 20px; }
  .cb-main { padding: 24px 16px 60px; }
  .cb-card { padding: 20px; }
}
`

export default function CsvBuilderPage() {
  const [eventName, setEventName] = useState('')
  const [raceDate, setRaceDate] = useState('')
  const [track, setTrack] = useState('Churchill Downs')
  const [featuredMultiplier, setFeaturedMultiplier] = useState('2')
  const [featuredMode, setFeaturedMode] = useState<'purse' | 'manual'>('purse')
  const [pasteText, setPasteText] = useState('')
  const [parsedRaces, setParsedRaces] = useState<ParsedRace[]>([])
  // Manual override for the featured race. When null in manual mode we fall
  // back to the first race; in purse mode this is ignored entirely.
  const [manualFeaturedNum, setManualFeaturedNum] = useState<number | null>(null)
  const [errors, setErrors] = useState<ErrorPayload | null>(null)
  const [csvVisible, setCsvVisible] = useState(false)
  const [successVisible, setSuccessVisible] = useState(false)
  const previewRef = useRef<HTMLDivElement | null>(null)

  // Default the date input to today on first mount. The setState is wrapped in
  // a `typeof window` check so SSR is a no-op and the React 19 lint rule
  // (no unconditional setState in effects) sees a conditional invocation.
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const now = new Date()
      const yyyy = now.getFullYear()
      const mm = String(now.getMonth() + 1).padStart(2, '0')
      const dd = String(now.getDate()).padStart(2, '0')
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRaceDate(`${yyyy}-${mm}-${dd}`)
    }
  }, [])

  // Featured race is derived, not stored — purse mode always picks the highest
  // purse, manual mode honors `manualFeaturedNum` (falling back to the first
  // race if the manual pick is missing or stale).
  const featuredRaceNum = useMemo<number | null>(() => {
    if (parsedRaces.length === 0) return null
    if (featuredMode === 'manual') {
      if (manualFeaturedNum != null && parsedRaces.some(r => r.number === manualFeaturedNum)) {
        return manualFeaturedNum
      }
      return parsedRaces[0].number
    }
    let chosen = parsedRaces[0].number
    let maxPurse = -1
    for (const r of parsedRaces) {
      if (r.purse > maxPurse) { maxPurse = r.purse; chosen = r.number }
    }
    return chosen
  }, [parsedRaces, featuredMode, manualFeaturedNum])

  // Smooth scroll to the preview the first time it appears for a given parse.
  useEffect(() => {
    if (parsedRaces.length > 0 && previewRef.current) {
      previewRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [parsedRaces])

  function loadSample() {
    setPasteText(SAMPLE_TEXT)
    setEventName('Thurby 2026')
    setRaceDate('2026-04-30')
  }

  function clearAll() {
    setPasteText('')
    setParsedRaces([])
    setManualFeaturedNum(null)
    setErrors(null)
    setCsvVisible(false)
    setSuccessVisible(false)
  }

  function handleParse() {
    const text = pasteText.trim()
    if (!text) { setErrors({ msgs: ['Please paste HRN entries text first.'], type: 'error' }); return }
    if (!raceDate) { setErrors({ msgs: ['Please select a race date.'], type: 'error' }); return }

    const { races, warnings } = parseHrn(text, raceDate)
    if (races.length === 0) {
      setErrors({
        msgs: [
          'No races found. Make sure you pasted the full HRN entries text.',
          'Race headers should include: "Churchill Downs Race # 1, 12:45 PM"',
          'Try the Load Sample button to see the expected format.',
        ],
        type: 'error',
      })
      return
    }

    setParsedRaces(races)
    setCsvVisible(false)
    setSuccessVisible(false)
    setErrors(warnings.length > 0 ? { msgs: warnings, type: 'warning' } : null)
  }

  const csvText = useMemo(() => {
    if (parsedRaces.length === 0) return ''
    const rows = ['race_number,number,name,odds,post_time,race_name,is_featured,featured_multiplier,purse']
    for (const r of parsedRaces) {
      const isFeatured = r.number === featuredRaceNum
      for (const h of r.horses) {
        rows.push([
          r.number,
          h.number,
          `"${h.name.replace(/"/g, '""')}"`,
          h.odds,
          r.postTime,
          `"${r.name.replace(/"/g, '""')}"`,
          isFeatured ? 'true' : 'false',
          isFeatured ? featuredMultiplier : '1',
          r.purse || 0,
        ].join(','))
      }
    }
    return rows.join('\n')
  }, [parsedRaces, featuredRaceNum, featuredMultiplier])

  function downloadCSV() {
    const safeName = (eventName || 'race-card').toLowerCase().replace(/\s+/g, '-')
    const filename = `${safeName}-${raceDate || 'date'}.csv`
    const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
    setSuccessVisible(true)
    setTimeout(() => setSuccessVisible(false), 5000)
  }

  const totalHorses = parsedRaces.reduce((s, r) => s + r.horses.length, 0)
  const featured = parsedRaces.find(r => r.number === featuredRaceNum) ?? null
  const previewVisible = parsedRaces.length > 0

  return (
    <div className="cb-root">
      {/* React 19 hoists <link rel="stylesheet"> automatically into <head>. */}
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,700&family=DM+Mono:wght@400;500&family=DM+Sans:wght@300;400;500;600&display=swap"
      />
      <style dangerouslySetInnerHTML={{ __html: PAGE_CSS }} />

      <header className="cb-header">
        <div className="cb-logo">
          <div className="cb-logo-icon">🏇</div>
          <div className="cb-logo-text">Watch <span>Party</span></div>
        </div>
        <div className="cb-badge">Race Card Builder</div>
      </header>

      <main className="cb-main">
        <div className="cb-hero">
          <h1>Build a Race Card<br /><em>from HRN entries</em></h1>
          <p>Paste entries from Horse Racing Nation, configure your event, and download a ready-to-upload CSV in seconds.</p>
        </div>

        <div className="cb-steps">
          <div className="cb-step">
            <div className="cb-step-num">1</div>
            <div className="cb-step-text">
              <strong>Visit HRN Entries</strong>
              <span>Go to <a href="https://entries.horseracingnation.com/entries-results/churchill-downs/" target="_blank" rel="noopener noreferrer">entries.horseracingnation.com</a>, select your track and date.</span>
            </div>
          </div>
          <div className="cb-step">
            <div className="cb-step-num">2</div>
            <div className="cb-step-text">
              <strong>Copy the page text</strong>
              <span>Select all (Ctrl+A), copy (Ctrl+C), then paste it into the box below.</span>
            </div>
          </div>
          <div className="cb-step">
            <div className="cb-step-num">3</div>
            <div className="cb-step-text">
              <strong>Download &amp; Upload</strong>
              <span>Generate your CSV, download it, then import it in the Watch Party admin console.</span>
            </div>
          </div>
        </div>

        <div className="cb-card">
          <div className="cb-card-title">Event Configuration</div>
          <div className="cb-field-row">
            <div className="cb-field">
              <label htmlFor="cb-event-name">Event Name</label>
              <input
                id="cb-event-name"
                type="text"
                value={eventName}
                onChange={e => setEventName(e.target.value)}
                placeholder="e.g. Thurby 2026"
              />
            </div>
            <div className="cb-field">
              <label htmlFor="cb-race-date">Race Date</label>
              <input
                id="cb-race-date"
                type="date"
                value={raceDate}
                onChange={e => setRaceDate(e.target.value)}
              />
            </div>
            <div className="cb-field">
              <label htmlFor="cb-track">Track</label>
              <input
                id="cb-track"
                type="text"
                value={track}
                onChange={e => setTrack(e.target.value)}
              />
            </div>
          </div>
          <div className="cb-field-row two-col">
            <div className="cb-field">
              <label htmlFor="cb-featured-multiplier">Featured Multiplier</label>
              <select
                id="cb-featured-multiplier"
                value={featuredMultiplier}
                onChange={e => setFeaturedMultiplier(e.target.value)}
              >
                <option value="2">2x — Standard Featured</option>
                <option value="3">3x — Special Featured</option>
              </select>
            </div>
            <div className="cb-field">
              <label htmlFor="cb-featured-mode">Featured Race Selection</label>
              <select
                id="cb-featured-mode"
                value={featuredMode}
                onChange={e => setFeaturedMode(e.target.value as 'purse' | 'manual')}
              >
                <option value="purse">Auto — Highest Purse</option>
                <option value="manual">Manual — I&apos;ll pick below</option>
              </select>
            </div>
          </div>
        </div>

        <div className="cb-card">
          <div className="cb-card-title">Paste HRN Entries</div>

          <div className="cb-instructions">
            <strong>How to get the best results:</strong> On the HRN entries page, scroll past the navigation and select from the first race header down to the last horse in the final race. The parser looks for patterns like <code>Churchill Downs Race # 1</code>, horse numbers, odds like <code>8/1</code> or <code>8-1</code>, and post times like <code>12:45 PM</code>. The more complete the paste, the better the result.
          </div>

          <textarea
            id="cb-paste-input"
            value={pasteText}
            onChange={e => setPasteText(e.target.value)}
            placeholder={`Paste HRN entries text here...

Example of what to paste:
Churchill Downs Race # 1, 12:45 PM
6F, Dirt, $50,000 Claiming
Purse: $78,000

#  PP  Horse
1  1   Banned for Life   Luis Saez   8/5
2  2   Optical           James Graham  6/1
...`}
          />

          {errors && (
            <div className={`cb-error-box${errors.type === 'warning' ? ' warning' : ''}`}>
              {errors.msgs.length === 1
                ? errors.msgs[0]
                : <ul>{errors.msgs.map((m, i) => <li key={i}>{m}</li>)}</ul>}
            </div>
          )}

          <div className="cb-btn-row">
            <button type="button" className="cb-btn cb-btn-primary" onClick={handleParse}>⚙️ Parse Entries</button>
            <button type="button" className="cb-btn cb-btn-ghost" onClick={clearAll}>✕ Clear</button>
            <button type="button" className="cb-btn cb-btn-ghost" onClick={loadSample}>📋 Load Sample</button>
          </div>
        </div>

        {previewVisible && (
          <div ref={previewRef}>
            <div className="cb-card">
              <div className="cb-card-title">Preview</div>

              <div className="cb-preview-header">
                <div className="cb-preview-stats">
                  <div className="cb-stat">
                    <div className="cb-stat-val">{parsedRaces.length}</div>
                    <div className="cb-stat-label">Races</div>
                  </div>
                  <div className="cb-stat">
                    <div className="cb-stat-val">{totalHorses}</div>
                    <div className="cb-stat-label">Horses</div>
                  </div>
                  <div className="cb-stat">
                    <div className="cb-stat-val">{featured ? `Race ${featured.number}` : '—'}</div>
                    <div className="cb-stat-label">Featured Race</div>
                  </div>
                </div>
              </div>

              {featuredMode === 'manual' && (
                <div style={{ marginBottom: 16 }}>
                  <div className="cb-field" style={{ maxWidth: 300 }}>
                    <label htmlFor="cb-manual-featured">Select Featured Race</label>
                    <select
                      id="cb-manual-featured"
                      value={featuredRaceNum ?? ''}
                      onChange={e => setManualFeaturedNum(parseInt(e.target.value, 10))}
                    >
                      {parsedRaces.map(r => (
                        <option key={r.number} value={r.number}>Race {r.number} — {r.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <div className="cb-race-grid">
                {parsedRaces.map(r => {
                  const isFeatured = r.number === featuredRaceNum
                  const purseStr = r.purse > 0 ? `$${r.purse.toLocaleString()}` : null
                  const timePart = r.postTime.split(' ').slice(1).join(' ')
                  return (
                    <div key={r.number} className={`cb-race-row${isFeatured ? ' featured' : ''}`}>
                      <div className="cb-race-num">{r.number}</div>
                      <div className="cb-race-info">
                        <div className="cb-race-name-display">{r.name}{isFeatured ? ' ⭐' : ''}</div>
                        <div className="cb-race-meta">{r.postTime} · {r.horses.length} horses</div>
                      </div>
                      <div className="cb-race-pills">
                        {r.horses.length > 0 && <span className="cb-pill cb-pill-horses">{r.horses.length} horses</span>}
                        {purseStr && <span className="cb-pill cb-pill-purse">{purseStr}</span>}
                        {isFeatured && <span className="cb-pill cb-pill-featured">⭐ {featuredMultiplier}x FEATURED</span>}
                        <span className="cb-pill cb-pill-time">{timePart}</span>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="cb-divider" />

              <div className="cb-btn-row">
                <button type="button" className="cb-btn cb-btn-gold" onClick={downloadCSV}>⬇ Download CSV</button>
                <button type="button" className="cb-btn cb-btn-ghost" onClick={() => setCsvVisible(v => !v)}>{'{ }'} View Raw CSV</button>
              </div>

              {csvVisible && <div className="cb-csv-output">{csvText}</div>}
              {successVisible && (
                <div className="cb-success-box">✓ CSV downloaded! Go to your Watch Party admin console → Races tab → Import CSV.</div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
