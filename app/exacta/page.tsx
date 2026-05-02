'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import type { Event, Race } from '@/lib/types'

/** Slim slice of horses we care about for scratched detection on the
 *  exacta board — the page never needs morning_line_odds or finish_position. */
type ExactaHorse = { id: string; number: number; scratched: boolean; name: string }

const PASSWORD = 'roses2025'
/** Fallback grid size used only before the horses for the chosen race have
 *  loaded — once `activeHorseNumbers` is known, `N` is derived from it so
 *  any field size (19-horse Derby, 20-horse full field, 14-horse Oaks, etc.)
 *  works without a config change. */
const FALLBACK_N = 20

const COLORS = [
  '#C0392B','#1A6B3C','#2471A3','#8E44AD','#D97706',
  '#0E7490','#BE185D','#065F46','#92400E','#1D4ED8',
  '#7C3AED','#B45309','#0F766E','#9D174D','#1E40AF',
  '#6D28D9','#047857','#B91C1C','#0369A1','#7E22CE',
  '#D97706','#15803D','#C2410C','#0E7490','#4338CA',
]

type Square = {
  id: string
  event_id: string
  row_horse: number
  col_horse: number
  buyer_name: string | null
  is_diagonal: boolean
}

type Player = { name: string; count: number; color: string; idx: number }
type BoardCell = number | 'X' | null

function emptyBoard(n: number): BoardCell[][] {
  return Array.from({ length: n }, (_, r) =>
    Array.from({ length: n }, (_, c) => (r === c ? ('X' as const) : null))
  )
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400;1,700&family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=Bebas+Neue&display=swap');

.exacta-root {
  --rose: #8B1A2F;
  --rose-light: #B52340;
  --gold: #C9A84C;
  --gold-light: #E8C96A;
  --cream: #F5EDD6;
  --dark: #1A0A0E;
  --green: #1B4332;
  --green-light: #2D6A4F;
  --text-dark: #2C1810;
  --border: #C9A84C;

  background: var(--dark);
  font-family: 'Libre Baskerville', serif;
  color: var(--cream);
  min-height: 100vh;
  position: relative;
  overflow-x: hidden;
}

.exacta-root *,
.exacta-root *::before,
.exacta-root *::after { box-sizing: border-box; }

.exacta-root::before {
  content: '';
  position: fixed;
  inset: 0;
  background-image:
    repeating-linear-gradient(45deg, transparent, transparent 40px, rgba(201,168,76,0.03) 40px, rgba(201,168,76,0.03) 41px),
    repeating-linear-gradient(-45deg, transparent, transparent 40px, rgba(201,168,76,0.03) 40px, rgba(201,168,76,0.03) 41px);
  pointer-events: none;
  z-index: 0;
}

.exacta-root .container {
  position: relative;
  z-index: 1;
  max-width: 1400px;
  margin: 0 auto;
  padding: 20px;
}

/* EVENT BAR */
.exacta-root .event-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: rgba(0,0,0,0.4);
  border: 1px solid rgba(201,168,76,0.3);
  border-radius: 8px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}
.exacta-root .event-bar-label {
  font-family: 'Bebas Neue', cursive;
  letter-spacing: 3px;
  color: var(--gold);
  font-size: 0.85rem;
}
.exacta-root .event-bar select {
  flex: 1;
  min-width: 200px;
  max-width: 400px;
}
.exacta-root .event-bar .lock-btn {
  margin-left: auto;
  background: transparent;
  border: 1px solid rgba(245,237,214,0.3);
  color: rgba(245,237,214,0.7);
  border-radius: 6px;
  padding: 6px 14px;
  font-size: 0.78rem;
  cursor: pointer;
  font-family: 'Libre Baskerville', serif;
}
.exacta-root .event-bar .lock-btn:hover { color: var(--cream); border-color: var(--gold); }

/* HEADER */
.exacta-root .header {
  text-align: center;
  padding: 30px 20px 20px;
  border-bottom: 2px solid var(--gold);
  margin-bottom: 24px;
  position: relative;
}
.exacta-root .header::before, .exacta-root .header::after {
  content: '🌹';
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  font-size: 2rem;
}
.exacta-root .header::before { left: 20px; }
.exacta-root .header::after { right: 20px; }
.exacta-root .header-sub {
  font-family: 'Bebas Neue', cursive;
  letter-spacing: 6px;
  color: var(--gold);
  font-size: 0.85rem;
  margin-bottom: 6px;
}
.exacta-root .header h1 {
  font-family: 'Playfair Display', serif;
  font-size: clamp(1.8rem, 4vw, 3.2rem);
  font-weight: 900;
  color: var(--cream);
  line-height: 1.1;
  margin: 0;
}
.exacta-root .header h1 span { color: var(--gold); font-style: italic; }
.exacta-root .header-year {
  font-family: 'Bebas Neue', cursive;
  font-size: 1.1rem;
  letter-spacing: 4px;
  color: var(--rose-light);
  margin-top: 4px;
}

/* POT BANNER */
.exacta-root .pot-banner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: linear-gradient(135deg, var(--rose), var(--rose-light));
  border: 2px solid var(--gold);
  border-radius: 12px;
  padding: 18px 28px;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 10px;
}
.exacta-root .pot-label {
  font-family: 'Bebas Neue', cursive;
  font-size: 1.6rem;
  letter-spacing: 4px;
  color: var(--gold);
}
.exacta-root .pot-sub {
  font-size: 0.78rem;
  color: rgba(245,237,214,0.8);
  margin-top: 2px;
  letter-spacing: 1px;
}
.exacta-root .pot-amount {
  font-family: 'Bebas Neue', cursive;
  font-size: 3rem;
  color: var(--gold);
  line-height: 1;
  text-align: right;
  text-shadow: 0 2px 10px rgba(201,168,76,0.4);
}
.exacta-root .pot-right { text-align: right; }

/* PICK MODE */
.exacta-root .cell-picking {
  cursor: crosshair !important;
  outline: 2px dashed rgba(201,168,76,0.6);
}
.exacta-root .cell-picking:hover {
  outline: 2px solid var(--gold);
  transform: scale(1.4) !important;
}
.exacta-root .picking-banner {
  display: none;
  background: rgba(201,168,76,0.12);
  border: 1px solid var(--gold);
  border-radius: 8px;
  padding: 10px 16px;
  margin-bottom: 12px;
  font-size: 0.85rem;
  color: var(--gold);
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.exacta-root .picking-banner.active { display: flex; }

/* CONTROLS */
.exacta-root .controls {
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(201,168,76,0.3);
  border-radius: 12px;
  padding: 20px 24px;
  margin-bottom: 24px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}
@media (max-width: 720px) {
  .exacta-root .controls { grid-template-columns: 1fr; }
}
.exacta-root .control-section h3 {
  font-family: 'Bebas Neue', cursive;
  letter-spacing: 3px;
  color: var(--gold);
  font-size: 1rem;
  margin: 0 0 12px;
  padding-bottom: 6px;
  border-bottom: 1px solid rgba(201,168,76,0.3);
}
.exacta-root .add-player-form { display: flex; flex-direction: column; gap: 10px; }
.exacta-root .form-row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }

.exacta-root input[type="text"],
.exacta-root input[type="password"],
.exacta-root input[type="number"] {
  background: rgba(255,255,255,0.08);
  border: 1px solid rgba(201,168,76,0.4);
  border-radius: 6px;
  padding: 8px 12px;
  color: var(--cream);
  font-family: 'Libre Baskerville', serif;
  font-size: 0.85rem;
  flex: 1;
  min-width: 120px;
  transition: border-color 0.2s;
}
.exacta-root input[type="text"]:focus,
.exacta-root input[type="password"]:focus,
.exacta-root input[type="number"]:focus { outline: none; border-color: var(--gold); }
.exacta-root input::placeholder { color: rgba(245,237,214,0.4); }

.exacta-root select {
  background: rgba(255,255,255,0.08);
  border: 1px solid rgba(201,168,76,0.4);
  border-radius: 6px;
  padding: 8px 12px;
  color: var(--cream);
  font-family: 'Libre Baskerville', serif;
  font-size: 0.85rem;
  cursor: pointer;
}
.exacta-root select option { background: #1A0A0E; }

.exacta-root .btn {
  font-family: 'Bebas Neue', cursive;
  letter-spacing: 2px;
  border: none;
  border-radius: 6px;
  padding: 8px 16px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.2s;
}
.exacta-root .btn-gold { background: linear-gradient(135deg, var(--gold), var(--gold-light)); color: var(--dark); }
.exacta-root .btn-gold:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(201,168,76,0.4); }
.exacta-root .btn-rose { background: linear-gradient(135deg, var(--rose), var(--rose-light)); color: var(--cream); }
.exacta-root .btn-rose:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(139,26,47,0.4); }
.exacta-root .btn-green { background: linear-gradient(135deg, var(--green), var(--green-light)); color: var(--cream); }
.exacta-root .btn-green:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(27,67,50,0.4); }
.exacta-root .btn-outline { background: transparent; border: 1px solid var(--gold); color: var(--gold); }
.exacta-root .btn-outline:hover { background: rgba(201,168,76,0.1); }

.exacta-root .players-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 160px;
  overflow-y: auto;
}
.exacta-root .player-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(255,255,255,0.05);
  border-radius: 6px;
  padding: 6px 10px;
  font-size: 0.82rem;
  border-left: 3px solid;
  animation: ex-fadeIn 0.3s ease;
}
@keyframes ex-fadeIn { from { opacity: 0; transform: translateX(-10px); } to { opacity: 1; transform: translateX(0); } }
.exacta-root .player-name { font-weight: 700; }
.exacta-root .player-squares { color: var(--gold); font-size: 0.75rem; margin-left: 6px; }
.exacta-root .player-remove { background: none; border: none; color: rgba(245,237,214,0.4); cursor: pointer; font-size: 0.9rem; padding: 0 4px; }
.exacta-root .player-remove:hover { color: var(--rose-light); }

.exacta-root .action-row {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 20px;
  align-items: center;
}
.exacta-root .status-badge {
  margin-left: auto;
  font-size: 0.78rem;
  color: rgba(245,237,214,0.6);
  font-style: italic;
}

.exacta-root .legend {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 16px;
  padding: 12px 16px;
  background: rgba(255,255,255,0.03);
  border-radius: 8px;
  border: 1px solid rgba(201,168,76,0.15);
}
.exacta-root .legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.75rem;
  color: rgba(245,237,214,0.8);
}
.exacta-root .legend-swatch {
  width: 16px;
  height: 16px;
  border-radius: 3px;
  border: 1px solid rgba(255,255,255,0.2);
  flex-shrink: 0;
}

.exacta-root .board-wrapper { overflow-x: auto; padding-bottom: 10px; }
.exacta-root .board-container { display: inline-block; min-width: 100%; }

.exacta-root .board-label {
  font-family: 'Bebas Neue', cursive;
  letter-spacing: 3px;
  color: var(--gold);
  font-size: 0.8rem;
  text-align: center;
  margin-bottom: 6px;
}
.exacta-root .board-label.vertical {
  writing-mode: vertical-rl;
  transform: rotate(180deg);
  margin-bottom: 0;
  margin-right: 6px;
  align-self: center;
}

.exacta-root .board-outer { display: flex; align-items: flex-start; gap: 0; }
.exacta-root .grid-wrapper { display: flex; flex-direction: column; }
.exacta-root .grid-header-row { display: flex; margin-left: 52px; }
.exacta-root .col-label {
  width: 26px; height: 26px;
  display: flex; align-items: center; justify-content: center;
  font-family: 'Bebas Neue', cursive; font-size: 0.75rem;
  color: var(--gold-light); flex-shrink: 0;
  background: rgba(201,168,76,0.1);
  border-radius: 3px 3px 0 0;
  margin: 0 1px;
}
.exacta-root .grid-body { display: flex; flex-direction: column; gap: 1px; }
.exacta-root .grid-row { display: flex; gap: 1px; align-items: center; }
.exacta-root .row-label {
  width: 50px; height: 26px;
  display: flex; align-items: center; justify-content: center;
  font-family: 'Bebas Neue', cursive; font-size: 0.75rem;
  color: var(--gold-light); flex-shrink: 0;
  background: rgba(201,168,76,0.1);
  border-radius: 3px 0 0 3px;
  margin-right: 1px;
}
.exacta-root .cell {
  width: 26px; height: 26px;
  border-radius: 2px;
  flex-shrink: 0;
  cursor: default;
  transition: transform 0.15s, box-shadow 0.15s;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.45rem;
  font-weight: 700;
  overflow: hidden;
  font-family: 'Bebas Neue', cursive;
  border: 0;
  padding: 0;
  color: inherit;
}
.exacta-root .cell:hover { transform: scale(1.3); z-index: 10; box-shadow: 0 4px 12px rgba(0,0,0,0.5); }
.exacta-root .cell-empty {
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.08);
}
.exacta-root .cell-invalid {
  background: repeating-linear-gradient(
    45deg,
    rgba(80,0,0,0.5),
    rgba(80,0,0,0.5) 3px,
    rgba(30,0,0,0.6) 3px,
    rgba(30,0,0,0.6) 6px
  );
  border: 1px solid rgba(139,26,47,0.4);
  cursor: not-allowed;
}
.exacta-root .cell-winner {
  background: linear-gradient(135deg, #FFD700, #FFA500);
  border: 1px solid #FFD700;
  animation: ex-winnerPulse 1.5s infinite;
}
@keyframes ex-winnerPulse {
  0%, 100% { box-shadow: 0 0 6px rgba(255,215,0,0.6); }
  50% { box-shadow: 0 0 16px rgba(255,215,0,1); }
}

.exacta-root .tooltip {
  position: absolute;
  bottom: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
  background: var(--dark);
  border: 1px solid var(--gold);
  border-radius: 6px;
  padding: 6px 10px;
  font-size: 0.7rem;
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  z-index: 100;
  font-family: 'Libre Baskerville', serif;
  font-style: normal;
  font-weight: normal;
  color: var(--cream);
  transition: opacity 0.15s;
  letter-spacing: 0;
}
.exacta-root .cell:hover .tooltip { opacity: 1; }

.exacta-root .result-section {
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(201,168,76,0.3);
  border-radius: 12px;
  padding: 20px 24px;
  margin-top: 24px;
}
.exacta-root .result-section h3 {
  font-family: 'Bebas Neue', cursive;
  letter-spacing: 3px;
  color: var(--gold);
  margin: 0 0 14px;
  font-size: 1rem;
}
.exacta-root .result-row { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; margin-bottom: 12px; }
.exacta-root .result-inputs { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.exacta-root .result-label { font-size: 0.82rem; color: rgba(245,237,214,0.7); min-width: 60px; }
.exacta-root .horse-num-input { width: 70px; text-align: center; flex: 0 0 70px; min-width: 70px; }

.exacta-root .winner-display {
  margin-top: 14px;
  padding: 14px;
  background: rgba(201,168,76,0.08);
  border: 1px solid var(--gold);
  border-radius: 8px;
}
.exacta-root .winner-title {
  font-family: 'Bebas Neue', cursive;
  letter-spacing: 3px;
  color: var(--gold);
  font-size: 0.9rem;
  margin-bottom: 8px;
}
.exacta-root .winner-name {
  font-family: 'Playfair Display', serif;
  font-size: 1.6rem;
  font-style: italic;
  color: var(--cream);
}
.exacta-root .winner-detail { font-size: 0.8rem; color: rgba(245,237,214,0.7); margin-top: 4px; }

.exacta-root .footer {
  text-align: center;
  margin-top: 30px;
  padding-top: 20px;
  border-top: 1px solid rgba(201,168,76,0.2);
  font-size: 0.75rem;
  color: rgba(245,237,214,0.4);
  font-style: italic;
}

@media print {
  .exacta-root { background: white; color: black; }
  .exacta-root .controls,
  .exacta-root .action-row,
  .exacta-root .result-section,
  .exacta-root .event-bar { display: none; }
  .exacta-root .cell-empty { background: #f0f0f0; border-color: #ccc; }
  .exacta-root .col-label,
  .exacta-root .row-label { color: #333; background: #eee; }
}

.exacta-root ::-webkit-scrollbar { width: 6px; height: 6px; }
.exacta-root ::-webkit-scrollbar-track { background: rgba(255,255,255,0.05); }
.exacta-root ::-webkit-scrollbar-thumb { background: var(--gold); border-radius: 3px; }

/* Display mode */
.exacta-root .display-overlay {
  position: fixed; inset: 0;
  background: #0a0203;
  z-index: 1000;
  display: flex;
  flex-direction: column;
}
.exacta-root .dcell {
  border-radius: 2px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-family: 'Bebas Neue', cursive;
  position: relative;
}
.exacta-root .dcell:hover .dtip { opacity: 1; }
.exacta-root .dtip {
  position: absolute;
  bottom: calc(100% + 4px);
  left: 50%;
  transform: translateX(-50%);
  background: #1A0A0E;
  border: 1px solid #C9A84C;
  border-radius: 5px;
  padding: 4px 8px;
  font-size: 0.65rem;
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  z-index: 200;
  font-family: 'Libre Baskerville', serif;
  color: #F5EDD6;
  transition: opacity 0.15s;
}

/* Auth gate */
.exacta-root .auth-wrap {
  min-height: 100vh;
  display: flex; align-items: center; justify-content: center;
  padding: 24px;
}
.exacta-root .auth-card {
  width: 100%;
  max-width: 380px;
  text-align: center;
}
.exacta-root .auth-card .auth-title {
  font-family: 'Playfair Display', serif;
  font-size: 2rem;
  font-weight: 900;
  color: var(--cream);
  margin: 16px 0 24px;
}
.exacta-root .auth-card input {
  width: 100%;
  height: 52px;
  font-size: 1rem;
  text-align: center;
  margin-bottom: 12px;
}
.exacta-root .auth-card .auth-btn {
  width: 100%;
  height: 52px;
  font-size: 1rem;
}
.exacta-root .auth-error { color: #F87171; font-size: 0.8rem; margin: 4px 0 8px; }

/* ─── iPad-fit compaction ─────────────────────────────────────── */
.exacta-root .container { padding: 6px 10px; }

.exacta-root .header { padding: 4px 14px; margin-bottom: 6px; border-bottom-width: 1px; }
.exacta-root .header::before, .exacta-root .header::after { font-size: 1.1rem; }
.exacta-root .header-sub { font-size: 0.6rem; letter-spacing: 3px; margin-bottom: 0; }
.exacta-root .header h1 { font-size: clamp(0.95rem, 2.4vw, 1.4rem); line-height: 1.05; }
.exacta-root .header-year { font-size: 0.62rem; letter-spacing: 2px; margin-top: 2px; }

.exacta-root .pot-banner {
  padding: 4px 14px;
  margin-bottom: 6px;
  align-items: center;
  border-width: 1px;
}
.exacta-root .pot-label { font-size: 0.85rem; letter-spacing: 2px; }
.exacta-root .pot-sub { display: none; }
.exacta-root .pot-amount { font-size: 1.2rem; }

.exacta-root .event-bar { padding: 4px 10px; margin-bottom: 6px; gap: 8px; }
.exacta-root .event-bar-label { font-size: 0.7rem; letter-spacing: 2px; }
.exacta-root .event-bar select { padding: 3px 8px; font-size: 0.78rem; min-width: 160px; }
.exacta-root .event-bar .lock-btn { padding: 3px 10px; font-size: 0.7rem; }

.exacta-root .controls { padding: 8px 12px; margin-bottom: 6px; gap: 10px; }
.exacta-root .control-section h3 {
  font-size: 0.78rem; letter-spacing: 2px;
  margin-bottom: 4px; padding-bottom: 3px;
}
.exacta-root .players-list { max-height: 76px; gap: 3px; }
.exacta-root .player-item { padding: 3px 8px; font-size: 0.74rem; }
.exacta-root .player-squares { font-size: 0.68rem; }

.exacta-root input[type="text"],
.exacta-root input[type="password"],
.exacta-root input[type="number"] {
  padding: 4px 10px;
  font-size: 0.78rem;
  border-radius: 4px;
}
.exacta-root select { padding: 4px 8px; font-size: 0.78rem; border-radius: 4px; }
.exacta-root .btn { padding: 5px 11px; font-size: 0.76rem; letter-spacing: 1.5px; border-radius: 4px; }

.exacta-root .action-row { margin-bottom: 6px; gap: 6px; }
.exacta-root .status-badge { font-size: 0.7rem; }
.exacta-root .picking-banner {
  padding: 4px 10px;
  margin-bottom: 6px;
  font-size: 0.76rem;
  gap: 8px;
}

.exacta-root .legend { display: none; }
.exacta-root .footer { display: none; }

.exacta-root .board-label { font-size: 0.65rem; margin-bottom: 2px; letter-spacing: 2px; }

.exacta-root .cell { width: 22px; height: 22px; font-size: 0.45rem; }
.exacta-root .col-label {
  width: 22px; height: 18px;
  font-size: 0.62rem;
  margin: 0;
}
.exacta-root .row-label { width: 40px; height: 22px; font-size: 0.62rem; margin-right: 1px; }
.exacta-root .grid-header-row { margin-left: 41px; gap: 1px; }

.exacta-root .result-section { padding: 8px 12px; margin-top: 6px; }
.exacta-root .result-section h3 { font-size: 0.78rem; letter-spacing: 2px; margin: 0 0 6px; padding-bottom: 0; border-bottom: 0; }
.exacta-root .result-row { margin-bottom: 0; }
.exacta-root .result-label { font-size: 0.74rem; min-width: 0; }
.exacta-root .horse-num-input { width: 56px; flex: 0 0 56px; min-width: 56px; }
.exacta-root .winner-display { padding: 8px 12px; margin-top: 8px; }
.exacta-root .winner-title { font-size: 0.74rem; margin-bottom: 4px; letter-spacing: 2px; }
.exacta-root .winner-name { font-size: 1.05rem; }
.exacta-root .winner-detail { font-size: 0.7rem; margin-top: 2px; }

/* ─── Grid-priority layout: fixed left panel, flex grid right ─── */
.exacta-root { overflow: hidden; }
.exacta-root .container {
  padding: 6px 8px;
  max-width: none;
  height: 100vh;
  height: 100dvh;
}
.exacta-root .main-split {
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 10px;
  align-items: stretch;
  height: 100%;
}
.exacta-root .main-split .left-col {
  display: flex;
  flex-direction: column;
  gap: 6px;
  overflow-y: auto;
  max-height: 100%;
  padding-right: 4px;
}
.exacta-root .main-split .right-col {
  min-width: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
}
.exacta-root .main-split .controls { grid-template-columns: 1fr; margin-bottom: 0; gap: 8px; }
.exacta-root .main-split .action-row { margin-bottom: 0; }
.exacta-root .main-split .result-section { margin-top: 0; }
.exacta-root .main-split .picking-banner { margin-bottom: 0; }

/* Compact event bar in left panel */
.exacta-root .main-split .event-bar {
  margin-bottom: 0;
  padding: 4px 10px;
}

/* Compact header in left panel — left-aligned, no rose ornaments */
.exacta-root .main-split .header {
  text-align: left;
  padding: 4px 0 6px;
  margin-bottom: 0;
  border-bottom: 1px solid var(--gold);
}
.exacta-root .main-split .header::before,
.exacta-root .main-split .header::after { display: none; }
.exacta-root .main-split .header h1 {
  font-size: 1.05rem;
  line-height: 1.05;
  margin: 0;
}
.exacta-root .main-split .header-sub {
  font-size: 0.55rem;
  letter-spacing: 2px;
  margin-bottom: 2px;
}
.exacta-root .main-split .header-year {
  font-size: 0.58rem;
  letter-spacing: 1px;
  margin-top: 2px;
}

/* Compact pot banner — left panel sized */
.exacta-root .main-split .pot-banner {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px;
  margin-bottom: 0;
  gap: 6px;
}
.exacta-root .main-split .pot-banner .pot-sub { display: block; font-size: 0.55rem; letter-spacing: 0.5px; }
.exacta-root .main-split .pot-banner .pot-amount { font-size: 1.4rem; }
.exacta-root .main-split .pot-banner .pot-label { font-size: 0.78rem; letter-spacing: 2px; }

/* Cells & labels: width/height set inline from cellSize state. */
.exacta-root .main-split .cell { padding: 0; }

/* Hide footer/legend (they were already hidden via earlier rules). */

/* Stack on phones */
@media (max-width: 760px) {
  .exacta-root { overflow: auto; }
  .exacta-root .container { height: auto; }
  .exacta-root .main-split { grid-template-columns: 1fr; height: auto; }
  .exacta-root .main-split .left-col { max-height: none; overflow-y: visible; }
  .exacta-root .main-split .right-col { height: auto; min-height: 60vh; }
}
`

export default function ExactaPage() {
  // ── Auth ───────────────────────────────────────────────────────
  const [authed, setAuthed] = useState(false)
  const [pwInput, setPwInput] = useState('')
  const [pwError, setPwError] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined' && sessionStorage.getItem('furlong_exacta') === 'yes') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAuthed(true)
    }
  }, [])

  // ── Events ─────────────────────────────────────────────────────
  const [events, setEvents] = useState<Event[]>([])
  const [eventId, setEventId] = useState<string | null>(null)
  const [loadingEvents, setLoadingEvents] = useState(true)
  // The race the exacta board is built around — picked from the event's
  // races (featured wins; fall back to highest race_number, the marquee
  // closer slot most cards put the Derby in). Stored as a slim record so
  // the debug pill can render name + number without a second lookup.
  const [exactaRace, setExactaRace] = useState<
    { id: string; race_number: number; name: string } | null
  >(null)
  const exactaRaceId = exactaRace?.id ?? null
  const [horses, setHorses] = useState<ExactaHorse[]>([])

  useEffect(() => {
    if (!authed) return
    void (async () => {
      const { data } = await supabase
        .from('events')
        .select('*')
        .order('date', { ascending: false })
      const list = (data ?? []) as Event[]
      setEvents(list)
      const next = list.find(e => e.status === 'active') ?? list[0] ?? null
      setEventId(next?.id ?? null)
      setLoadingEvents(false)
    })()
  }, [authed])

  // Realtime: any horse change for the exacta race re-syncs the local list,
  // so a scratch flipped from /admin shows up on the board immediately.
  useEffect(() => {
    if (!exactaRaceId) return
    const channel = supabase
      .channel(`exacta-horses-${exactaRaceId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'horses', filter: `race_id=eq.${exactaRaceId}` },
        async () => {
          const { data } = await supabase
            .from('horses')
            .select('id, number, scratched, name')
            .eq('race_id', exactaRaceId)
          if (data) setHorses(data as ExactaHorse[])
        })
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [exactaRaceId])

  // Set of post-position numbers that are currently scratched. Empty until
  // numbersLocked is true — before lock-in the row/col labels are placeholder
  // "?"s so there's no meaningful number-to-horse mapping yet.
  const scratchedNumbers = useMemo(() => {
    const s = new Set<number>()
    for (const h of horses) if (h.scratched) s.add(h.number)
    return s
  }, [horses])
  const scratchCount = scratchedNumbers.size

  // ── Dynamic grid size ─────────────────────────────────────────
  // Active (non-scratched at seed time) horse numbers, ascending. Drives the
  // grid dimensions and the pool we shuffle/randomize from. Falls back to
  // 1..20 before horses load so the page can render a placeholder grid
  // instead of flashing 0×0.
  const activeHorseNumbers = useMemo(() => {
    if (horses.length === 0) {
      return Array.from({ length: FALLBACK_N }, (_, i) => i + 1)
    }
    return horses
      .filter(h => !h.scratched)
      .map(h => h.number)
      .sort((a, b) => a - b)
  }, [horses])
  const N = activeHorseNumbers.length || FALLBACK_N
  const totalSquares = N * N
  const playableSquares = totalSquares - N

  // ── Board / Players state (mirrors original HTML) ──────────────
  const [players, setPlayers] = useState<Player[]>([])
  // Initial board / axis values use the FALLBACK size; loadBoard replaces
  // them with the real shape once the chosen race's horses are loaded.
  const [board, setBoard] = useState<BoardCell[][]>(() => emptyBoard(FALLBACK_N))
  const [rowNums, setRowNums] = useState<number[]>(() => Array.from({ length: FALLBACK_N }, (_, i) => i + 1))
  const [colNums, setColNums] = useState<number[]>(() => Array.from({ length: FALLBACK_N }, (_, i) => i + 1))
  const [numbersLocked, setNumbersLocked] = useState(false)
  const [winnerCell, setWinnerCell] = useState<{ row: number; col: number } | null>(null)
  const [winnerInfo, setWinnerInfo] = useState<{ name: string; detail: string; color: string } | null>(null)

  const [assignMode, setAssignMode] = useState<'random' | 'pick'>('pick')
  const [pickingPlayer, setPickingPlayer] = useState<number | null>(null)
  const [pickingCount, setPickingCount] = useState(0)
  const [pickingTarget, setPickingTarget] = useState(0)

  const [playerName, setPlayerName] = useState('')
  const [bundleSize, setBundleSize] = useState('16')
  const [customAmount, setCustomAmount] = useState('')

  const [first, setFirst] = useState('')
  const [second, setSecond] = useState('')

  const [statusBadge, setStatusBadge] = useState('Add players, then randomize numbers to lock the board')

  const [displayMode, setDisplayMode] = useState(false)
  const displayOverlayRef = useRef<HTMLDivElement | null>(null)
  const [displayCellSize, setDisplayCellSize] = useState(22)

  // squaresMap: position "r,c" (1-indexed) → square id, used for batch DB updates
  const [squaresMap, setSquaresMap] = useState<Record<string, Square>>({})
  const [loadingBoard, setLoadingBoard] = useState(false)

  // Adaptive grid cell sizing — fills the right panel
  const rightColRef = useRef<HTMLDivElement | null>(null)
  const [cellSize, setCellSize] = useState(28)

  // ── Load (or seed) board for selected event ────────────────────
  // Takes the race's actual active horse numbers so the seed can write
  // real post-position values (Derby alternates use 21/22/23) instead of
  // the legacy 1..20 sequence. The board is built as an N×N matrix indexed
  // 0..N-1 internally, but squaresMap is keyed by ACTUAL horse numbers so
  // axis-number lookups work directly without an index translation.
  const loadBoard = useCallback(async (eId: string, activeNumbers: number[]) => {
    setLoadingBoard(true)
    setWinnerCell(null)
    setWinnerInfo(null)
    setFirst(''); setSecond('')
    setPickingPlayer(null); setPickingCount(0); setPickingTarget(0)

    const n = activeNumbers.length
    const numberToIndex = new Map(activeNumbers.map((num, idx) => [num, idx]))

    let { data } = await supabase
      .from('exacta_squares')
      .select('*')
      .eq('event_id', eId)
    let list = (data ?? []) as Square[]

    if (list.length === 0 && n > 0) {
      // Seed every (row_horse, col_horse) pair from the active set. Numbers
      // are the real post positions, not 1..N indices, so a future renderer
      // can read them directly.
      const rows: Omit<Square, 'id'>[] = []
      for (const rNum of activeNumbers) {
        for (const cNum of activeNumbers) {
          rows.push({
            event_id: eId,
            row_horse: rNum,
            col_horse: cNum,
            buyer_name: null,
            is_diagonal: rNum === cNum,
          })
        }
      }
      const { data: inserted, error } = await supabase
        .from('exacta_squares').insert(rows).select()
      if (error) { alert("Couldn't seed board: " + error.message); setLoadingBoard(false); return }
      list = (inserted ?? []) as Square[]
    }

    // Build squaresMap keyed by the actual horse numbers (e.g. "21,4" or
    // "1,1"). Renderers and click handlers look up squares by axis number,
    // not grid index, so this avoids an extra translation hop.
    const map: Record<string, Square> = {}
    for (const s of list) map[`${s.row_horse},${s.col_horse}`] = s

    // Group buyer_names → player order (alphabetical for stable colors)
    const namesSet = new Set<string>()
    for (const s of list) if (!s.is_diagonal && s.buyer_name) namesSet.add(s.buyer_name)
    const sortedNames = Array.from(namesSet).sort((a, b) => a.localeCompare(b))
    const newPlayers: Player[] = sortedNames.map((name, i) => ({
      name,
      count: 0,
      color: COLORS[i % COLORS.length],
      idx: i,
    }))
    const nameToIdx: Record<string, number> = {}
    newPlayers.forEach(p => { nameToIdx[p.name] = p.idx })

    // Build the visual board. Squares whose horse numbers aren't in the
    // current active set (e.g. legacy 1..20 data on a race that now uses
    // alternates) silently fall off the grid — they stay in the DB but
    // can't be rendered anywhere meaningful.
    const newBoard = emptyBoard(n)
    for (const s of list) {
      const r = numberToIndex.get(s.row_horse)
      const c = numberToIndex.get(s.col_horse)
      if (r === undefined || c === undefined) continue
      if (s.is_diagonal) { newBoard[r][c] = 'X'; continue }
      if (s.buyer_name && nameToIdx[s.buyer_name] !== undefined) {
        const idx = nameToIdx[s.buyer_name]
        newBoard[r][c] = idx
        newPlayers[idx].count++
      }
    }

    // Restore axis numbers from localStorage (per event). Validate against
    // the current active set — if the persisted axes use stale numbers we
    // discard them and fall back to the identity sequence.
    let nextRow: number[] = activeNumbers
    let nextCol: number[] = activeNumbers
    let nextLocked = false
    try {
      const raw = localStorage.getItem(`exacta_axes_${eId}`)
      if (raw) {
        const parsed = JSON.parse(raw)
        const validAxis = (arr: unknown): arr is number[] =>
          Array.isArray(arr)
            && arr.length === n
            && arr.every(x => typeof x === 'number' && numberToIndex.has(x))
        if (validAxis(parsed.rowNums)) nextRow = parsed.rowNums
        if (validAxis(parsed.colNums)) nextCol = parsed.colNums
        if (typeof parsed.numbersLocked === 'boolean') nextLocked = parsed.numbersLocked
      }
    } catch {}

    setSquaresMap(map)
    setPlayers(newPlayers)
    setBoard(newBoard)
    setRowNums(nextRow)
    setColNums(nextCol)
    setNumbersLocked(nextLocked)
    setLoadingBoard(false)
  }, [])

  // Resolve the "exacta race" for the chosen event, load its horses, then
  // hand the active-horse-number list to loadBoard so the seed (or
  // existing-row hydration) can use real post-position numbers as keys.
  // Sequenced as one effect to avoid the race where loadBoard fires before
  // horses are known and seeds with the fallback 1..20 numbers.
  useEffect(() => {
    // TEMP debug — confirms the effect fires every time the dropdown writes
    // a fresh eventId. If you select Kentucky Derby 152 and DON'T see this
    // log with the right uuid, the bug is in the picker, not the loader.
    // eslint-disable-next-line no-console
    console.log('[exacta] race-loader effect entered', {
      authed,
      eventId,
      willBail: !authed || !eventId,
    })
    if (!authed || !eventId) {
      setExactaRace(null)
      setHorses([])
      return
    }
    let cancelled = false
    void (async () => {
      // 1) Pull every race for THIS event only (event-scoped query — never
      // crosses events).
      const { data: racesData, error: racesErr } = await supabase
        .from('races')
        .select('*')
        .eq('event_id', eventId)
        .order('race_number')
      if (cancelled) return
      if (racesErr) {
        // Surfaces RLS denials, network failures, malformed queries — used
        // to be silently swallowed which left exactaRace stuck at null.
        // eslint-disable-next-line no-console
        console.error('[exacta] races query failed', { eventId, error: racesErr })
      }
      const list = (racesData ?? []) as Race[]
      if (list.length === 0) {
        // eslint-disable-next-line no-console
        console.warn(
          '[exacta] races query returned 0 rows for event_id=' + eventId
          + ' — check RLS on public.races or whether the event actually has any race rows.'
        )
      }
      // 2) Heuristic: highest-multiplier featured race wins; otherwise the
      // race with the highest race_number (the marquee closer slot most
      // cards put the Derby in). The Supabase query already orders ASC by
      // race_number, but we sort defensively here so the fallback is
      // explicit and doesn't rely on the upstream order.
      const featured = [...list]
        .filter(r => r.is_featured)
        .sort((a, b) => b.featured_multiplier - a.featured_multiplier)[0]
      const highestNumberRace = [...list]
        .sort((a, b) => b.race_number - a.race_number)[0]
        ?? null
      const target = featured ?? highestNumberRace ?? null
      // TEMP debug — verify the heuristic landed on the right race.
      // Compare `chosenRaceId` against the expected Derby race id in devtools.
      // eslint-disable-next-line no-console
      console.log('[exacta] race selection', {
        eventId,
        racesInEvent: list.map(r => ({
          id: r.id, race_number: r.race_number, name: r.name,
          is_featured: r.is_featured, featured_multiplier: r.featured_multiplier,
        })),
        chosenRaceId: target?.id ?? null,
        chosenName: target?.name ?? null,
        chosenRaceNumber: target?.race_number ?? null,
        reason: featured
          ? 'highest-multiplier featured race'
          : highestNumberRace
            ? 'fallback: highest race_number'
            : 'no races available — exactaRace will be null',
      })
      setExactaRace(target ? { id: target.id, race_number: target.race_number, name: target.name } : null)

      // 3) Load horses for that ONE race only — single .eq filter, no joins
      // and no cross-race fan-out. The realtime channel below also pins to
      // this race_id so a scratch on another race never lands here.
      let horseList: ExactaHorse[] = []
      if (target) {
        const { data: horsesData, error: horsesErr } = await supabase
          .from('horses')
          .select('id, number, scratched, name')
          .eq('race_id', target.id)
        if (cancelled) return
        if (horsesErr) {
          // eslint-disable-next-line no-console
          console.error('[exacta] horse load failed', horsesErr)
        }
        horseList = (horsesData ?? []) as ExactaHorse[]
        // eslint-disable-next-line no-console
        console.log('[exacta] horses loaded', {
          raceId: target.id,
          total: horseList.length,
          active: horseList.filter(h => !h.scratched).length,
          scratched: horseList.filter(h => h.scratched).length,
          numbers: horseList.map(h => h.number).sort((a, b) => a - b),
        })
      }
      setHorses(horseList)

      const activeNumbers = horseList.length > 0
        ? horseList.filter(h => !h.scratched).map(h => h.number).sort((a, b) => a - b)
        // Brand-new event with no horses yet — fall back to 1..20 so the
        // user can still fool around with the board pre-race-card.
        : Array.from({ length: FALLBACK_N }, (_, i) => i + 1)

      await loadBoard(eventId, activeNumbers)
    })()
    return () => { cancelled = true }
  }, [authed, eventId, loadBoard])

  // ── Helpers: persist axis state to localStorage ────────────────
  const persistAxes = useCallback((rowN: number[], colN: number[], locked: boolean) => {
    if (!eventId) return
    try {
      localStorage.setItem(`exacta_axes_${eventId}`, JSON.stringify({
        rowNums: rowN, colNums: colN, numbersLocked: locked,
      }))
    } catch {}
  }, [eventId])

  // ── Bundle size handling ───────────────────────────────────────
  function getBundleCount(): number {
    if (bundleSize === 'custom') {
      const v = parseInt(customAmount, 10)
      return isNaN(v) || v < 1 ? 0 : v
    }
    return parseInt(bundleSize, 10)
  }

  // ── Add player ─────────────────────────────────────────────────
  async function addPlayer() {
    const name = playerName.trim()
    const count = getBundleCount()
    if (!name) return
    if (!count || count < 1) { alert('Please enter a valid number of squares.'); return }

    const taken = players.reduce((s, p) => s + p.count, 0)
    const available = playableSquares - taken
    if (count > available) { alert(`Only ${available} squares left! Choose a smaller bundle.`); return }
    if (players.some(p => p.name === name)) { alert('That name is already in use — pick a unique one.'); return }

    const idx = players.length
    const color = COLORS[idx % COLORS.length]

    if (assignMode === 'random') {
      // Pick random empty cells
      const empties: [number, number][] = []
      for (let r = 0; r < N; r++)
        for (let c = 0; c < N; c++)
          if (board[r][c] === null) empties.push([r, c])
      const chosen = shuffle(empties).slice(0, count)

      const newBoard = board.map(row => [...row])
      chosen.forEach(([r, c]) => { newBoard[r][c] = idx })

      const newPlayer: Player = { name, count, color, idx }
      setPlayers([...players, newPlayer])
      setBoard(newBoard)
      setPlayerName('')

      // Save to Supabase. squaresMap keys are actual horse-number pairs
      // (e.g. "21,4"), not grid indices, so map (r, c) → (rowNums[r], colNums[c]).
      const ids = chosen
        .map(([r, c]) => squaresMap[`${rowNums[r]},${colNums[c]}`]?.id)
        .filter(Boolean) as string[]
      if (ids.length > 0) {
        const { error } = await supabase
          .from('exacta_squares')
          .update({ buyer_name: name })
          .in('id', ids)
        if (error) alert("Couldn't save: " + error.message)
      }
    } else {
      // Pick mode — add player with 0 squares, let them click
      const newPlayer: Player = { name, count: 0, color, idx }
      setPlayers([...players, newPlayer])
      setPickingPlayer(idx)
      setPickingCount(0)
      setPickingTarget(count)
      setPlayerName('')
    }
  }

  // ── Pick mode click ────────────────────────────────────────────
  function clickCell(r: number, c: number) {
    if (assignMode !== 'pick' || pickingPlayer === null) return
    if (r === c) return
    if (board[r][c] !== null) return
    // Belt-and-braces: even though scratched cells render disabled with a
    // not-allowed cursor, also bail here so a stray re-render race can't
    // sneak a purchase through.
    if (numbersLocked && (
      scratchedNumbers.has(rowNums[r]) || scratchedNumbers.has(colNums[c])
    )) return
    if (pickingCount >= pickingTarget) {
      alert(`You've already selected ${pickingTarget} squares. Click ✓ Confirm to save.`)
      return
    }
    const newBoard = board.map(row => [...row])
    newBoard[r][c] = pickingPlayer
    const newCount = pickingCount + 1
    setBoard(newBoard)
    setPickingCount(newCount)
    setPlayers(prev => prev.map((p, i) => i === pickingPlayer ? { ...p, count: newCount } : p))
  }

  async function confirmPicks() {
    if (pickingPlayer === null) return
    if (pickingCount < pickingTarget) {
      if (!confirm(`You've only selected ${pickingCount} of ${pickingTarget} squares. Save anyway?`)) return
    }
    const player = players[pickingPlayer]
    if (!player) { setPickingPlayer(null); setPickingCount(0); setPickingTarget(0); return }

    // Find all cells claimed by this player
    const cells: [number, number][] = []
    for (let r = 0; r < N; r++)
      for (let c = 0; c < N; c++)
        if (board[r][c] === pickingPlayer) cells.push([r, c])

    // Same translation as random-assign: grid index → actual horse-number key.
    const ids = cells
      .map(([r, c]) => squaresMap[`${rowNums[r]},${colNums[c]}`]?.id)
      .filter(Boolean) as string[]

    if (ids.length > 0) {
      const { error } = await supabase
        .from('exacta_squares')
        .update({ buyer_name: player.name })
        .in('id', ids)
      if (error) { alert("Couldn't save: " + error.message); return }
    }

    setPickingPlayer(null)
    setPickingCount(0)
    setPickingTarget(0)
  }

  function cancelPicks() {
    if (pickingPlayer === null) return
    // Remove their cells locally (they were never saved to DB)
    const newBoard = board.map(row => row.map(cell => (cell === pickingPlayer ? null : cell)))
    // Splice player
    const newPlayers = players
      .filter((_, i) => i !== pickingPlayer)
      .map((p, i) => ({ ...p, idx: i, color: COLORS[i % COLORS.length] }))
    setBoard(newBoard)
    setPlayers(newPlayers)
    setPickingPlayer(null)
    setPickingCount(0)
    setPickingTarget(0)
  }

  // ── Remove player ──────────────────────────────────────────────
  async function removePlayer(idx: number) {
    const removed = players[idx]
    if (!removed) return

    // Remove from DB (set buyer_name = null where buyer_name = removed.name)
    if (eventId) {
      const { error } = await supabase
        .from('exacta_squares')
        .update({ buyer_name: null })
        .eq('event_id', eventId)
        .eq('buyer_name', removed.name)
      if (error) { alert("Couldn't remove: " + error.message); return }
    }

    // Local: clear their cells, splice, remap remaining indices
    const newBoard = board.map((row, r) => row.map((cell, c) => {
      if (cell === idx) return r === c ? 'X' as const : null
      if (typeof cell === 'number' && cell > idx) return cell - 1
      return cell
    }))
    const newPlayers = players
      .filter((_, i) => i !== idx)
      .map((p, i) => ({ ...p, idx: i, color: COLORS[i % COLORS.length] }))

    setBoard(newBoard)
    setPlayers(newPlayers)
    setWinnerCell(null)
    setWinnerInfo(null)

    // If we were picking that player, cancel
    if (pickingPlayer === idx) {
      setPickingPlayer(null); setPickingCount(0); setPickingTarget(0)
    } else if (pickingPlayer !== null && pickingPlayer > idx) {
      setPickingPlayer(pickingPlayer - 1)
    }
  }

  // ── Clear all ──────────────────────────────────────────────────
  async function clearAll() {
    if (players.length === 0 && !numbersLocked) return
    const answer = prompt('Type RESET to clear all players and start over:')
    if (answer === null) return
    if (answer.trim().toUpperCase() !== 'RESET') {
      alert('Incorrect — board not cleared. (Type RESET in all caps to confirm)')
      return
    }
    if (eventId) {
      const { error } = await supabase
        .from('exacta_squares')
        .update({ buyer_name: null })
        .eq('event_id', eventId)
      if (error) { alert("Couldn't clear: " + error.message); return }
      try { localStorage.removeItem(`exacta_axes_${eventId}`) } catch {}
    }
    setPlayers([])
    setBoard(emptyBoard(N))
    // Reset axes back to the identity sequence of active horse numbers —
    // pre-lock display shows "?", so the underlying value just needs to be
    // a coherent permutation of activeHorseNumbers so subsequent renders /
    // shuffles operate on the correct pool.
    setRowNums(activeHorseNumbers)
    setColNums(activeHorseNumbers)
    setNumbersLocked(false)
    setWinnerCell(null)
    setWinnerInfo(null)
    setPickingPlayer(null); setPickingCount(0); setPickingTarget(0)
    setFirst(''); setSecond('')
  }

  // ── Randomize horse numbers ────────────────────────────────────
  // Shuffles the actual active-horse-number pool onto each axis so
  // alternates (PP 21/22/23) get a real chance at any grid position.
  function shuffleNumbers() {
    const nextRow = shuffle(activeHorseNumbers)
    const nextCol = shuffle(activeHorseNumbers)
    setRowNums(nextRow)
    setColNums(nextCol)
    setNumbersLocked(true)
    setWinnerCell(null)
    setWinnerInfo(null)
    setStatusBadge('✅ Numbers locked! Board is ready.')
    persistAxes(nextRow, nextCol, true)
  }

  // ── Find winner ────────────────────────────────────────────────
  function findWinner() {
    const f = parseInt(first, 10)
    const s = parseInt(second, 10)
    if (isNaN(f) || isNaN(s) || f === s) {
      alert('Please enter two different horse numbers.')
      return
    }
    // Validate against the active set (e.g. Derby alternates use 21/22/23
    // — a flat 1..20 range check would reject those).
    const validNumbers = new Set(activeHorseNumbers)
    if (!validNumbers.has(f) || !validNumbers.has(s)) {
      alert(`Horse numbers must be in the active set: ${activeHorseNumbers.join(', ')}.`)
      return
    }
    const row = rowNums.indexOf(f)
    const col = colNums.indexOf(s)
    if (row === -1 || col === -1) {
      alert('Horse numbers not found on board. Have you randomized yet?')
      return
    }
    setWinnerCell({ row, col })
    const cell = board[row][col]
    if (typeof cell === 'number') {
      const p = players[cell]
      setWinnerInfo({
        name: p.name,
        detail: `Row ${f} (1st) × Column ${s} (2nd) — ${p.count} squares owned`,
        color: p.color,
      })
    } else {
      setWinnerInfo({
        name: 'Unclaimed Square',
        detail: `Row ${f} × Column ${s} — no player owns this square`,
        color: 'rgba(245,237,214,0.6)',
      })
    }
  }

  function clearResult() {
    setWinnerCell(null)
    setWinnerInfo(null)
    setFirst(''); setSecond('')
  }

  // ── Display mode ───────────────────────────────────────────────
  function enterDisplayMode() {
    setDisplayMode(true)
    requestAnimationFrame(() => {
      const el = displayOverlayRef.current
      if (!el) return
      const anyEl = el as HTMLElement & {
        webkitRequestFullscreen?: () => Promise<void>
      }
      if (el.requestFullscreen) el.requestFullscreen().catch(() => {})
      else if (anyEl.webkitRequestFullscreen) anyEl.webkitRequestFullscreen()
    })
  }

  function exitDisplayMode() {
    setDisplayMode(false)
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {})
    }
  }

  // Adaptive cell size for display mode
  useEffect(() => {
    if (!displayMode) return
    function recalc() {
      const padding = 48
      const labelW = 42
      const labelH = 22
      const legendW = 220
      const topBarH = 80
      const availW = window.innerWidth - legendW - padding - labelW
      const availH = window.innerHeight - topBarH - padding - labelH - 24
      const cellByW = Math.floor((availW - N) / N)
      const cellByH = Math.floor((availH - N) / N)
      const cs = Math.max(14, Math.min(cellByW, cellByH, 42))
      setDisplayCellSize(cs)
    }
    recalc()
    window.addEventListener('resize', recalc)
    return () => window.removeEventListener('resize', recalc)
  }, [displayMode])

  // Adaptive cell size for the main right-panel grid — fills available space.
  useEffect(() => {
    if (!authed || loadingBoard) return
    const el = rightColRef.current
    if (!el) return

    function recalc() {
      const node = rightColRef.current
      if (!node) return
      const rect = node.getBoundingClientRect()
      const rowLabelW = 50
      const colLabelH = 24
      const verticalLabelW = 22
      const topBoardLabelH = 22
      const padding = 12
      const availW = rect.width - rowLabelW - verticalLabelW - padding
      const availH = rect.height - colLabelH - topBoardLabelH - padding
      const cellByW = Math.floor((availW - (N - 1)) / N)
      const cellByH = Math.floor((availH - (N - 1)) / N)
      const cs = Math.max(20, Math.min(cellByW, cellByH, 64))
      setCellSize(cs)
    }
    recalc()
    const ro = new ResizeObserver(recalc)
    ro.observe(el)
    return () => ro.disconnect()
  }, [authed, loadingBoard])

  // ── Derived values ─────────────────────────────────────────────
  const used = useMemo(() => players.reduce((s, p) => s + p.count, 0), [players])

  useEffect(() => {
    if (!numbersLocked && players.length > 0) {
      setStatusBadge(`${playableSquares - used} squares remaining — click 🎲 Randomize to lock in horse numbers`)
    } else if (players.length === 0) {
      setStatusBadge('Add players, then randomize numbers to lock the board')
    }
  }, [numbersLocked, players.length, used])

  function tryLogin() {
    if (pwInput === PASSWORD) {
      setAuthed(true)
      setPwError(false)
      if (typeof window !== 'undefined') sessionStorage.setItem('furlong_exacta', 'yes')
    } else {
      setPwError(true)
    }
  }

  // ── Auth screen ────────────────────────────────────────────────
  if (!authed) {
    return (
      <div className="exacta-root">
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
        <div className="auth-wrap">
          <div className="auth-card">
            <div style={{ fontSize: '3rem' }}>🌹</div>
            <div className="auth-title">Exacta Board</div>
            <input
              type="password"
              value={pwInput}
              onChange={e => { setPwInput(e.target.value); setPwError(false) }}
              onKeyDown={e => e.key === 'Enter' && tryLogin()}
              placeholder="Password"
              autoFocus
              style={pwError ? { borderColor: '#F87171' } : undefined}
            />
            {pwError && <div className="auth-error">Wrong password</div>}
            <button onClick={tryLogin} className="btn btn-rose auth-btn">Enter</button>
          </div>
        </div>
      </div>
    )
  }

  // ── Render board cells ─────────────────────────────────────────
  function renderCell(r: number, c: number) {
    const cell = board[r][c]
    const isWinner = winnerCell && winnerCell.row === r && winnerCell.col === c
    const isDiagonal = r === c
    const pIdx = typeof cell === 'number' ? cell : null
    const player = pIdx !== null ? players[pIdx] : null
    // Scratched only matters once the row/col labels point to real horses.
    const rowScratched = numbersLocked && scratchedNumbers.has(rowNums[r])
    const colScratched = numbersLocked && scratchedNumbers.has(colNums[c])
    const scratched = !isDiagonal && (rowScratched || colScratched)

    const classes: string[] = ['cell']
    const baseFs = Math.max(8, Math.floor(cellSize * 0.4))
    let style: React.CSSProperties = {
      width: cellSize,
      height: cellSize,
      fontSize: `${baseFs}px`,
      position: 'relative', // anchor for the VOID overlay
    }
    let content: React.ReactNode = null
    let tooltip = ''

    if (
      assignMode === 'pick' && pickingPlayer !== null
      && !isDiagonal && cell === null && !scratched
    ) {
      classes.push('cell-picking')
    }

    if (isDiagonal) {
      classes.push('cell-invalid')
      const lbl = numbersLocked ? `Horse #${rowNums[r]}` : `—`
      tooltip = `Invalid · ${lbl} can't finish 1st & 2nd`
    } else if (isWinner) {
      classes.push('cell-winner')
      content = '🏆'
      style = { ...style, fontSize: `${Math.max(10, Math.floor(cellSize * 0.55))}px` }
    } else if (player) {
      style = {
        ...style,
        background: player.color,
        border: `1px solid ${player.color}`,
        color: 'rgba(255,255,255,0.95)',
        fontSize: `${Math.max(9, Math.floor(cellSize * 0.46))}px`,
      }
      const parts = player.name.split(' ')
      content = parts.map(p => p[0]).join('').slice(0, 2).toUpperCase()
      const rowLabel = numbersLocked ? `Horse #${rowNums[r]}` : `Row ${r + 1}`
      const colLabel = numbersLocked ? `Horse #${colNums[c]}` : `Col ${c + 1}`
      tooltip = `${player.name} · ${rowLabel} × ${colLabel}`
    } else {
      classes.push('cell-empty')
      const rowLabel = numbersLocked ? `Horse #${rowNums[r]}` : `Row ${r + 1}`
      const colLabel = numbersLocked ? `Horse #${colNums[c]}` : `Col ${c + 1}`
      tooltip = `Empty · ${rowLabel} × ${colLabel}`
    }

    if (scratched) {
      // Diagonal stripes overlay communicates "this row/col is voided".
      // For owned (player) squares we keep the buyer color visible underneath
      // and lay the stripes on top via backgroundImage; the player initials
      // stay readable. For empty squares the stripes are the entire fill.
      const stripe = 'repeating-linear-gradient(45deg, rgba(120,0,0,0.55) 0 4px, rgba(0,0,0,0.65) 4px 8px)'
      if (player) {
        style = {
          ...style,
          backgroundImage: stripe,
          backgroundColor: player.color,
          opacity: 0.85,
        }
      } else {
        style = {
          ...style,
          background: stripe,
          border: '1px solid rgba(139,26,47,0.4)',
          opacity: 0.7,
          cursor: 'not-allowed',
        }
      }
      const rowLabel = numbersLocked ? `Horse #${rowNums[r]}` : `Row ${r + 1}`
      const colLabel = numbersLocked ? `Horse #${colNums[c]}` : `Col ${c + 1}`
      const which = rowScratched && colScratched
        ? 'both horses'
        : rowScratched ? rowLabel : colLabel
      tooltip = player
        ? `VOID · ${player.name}'s square (${which} scratched)`
        : `VOID · ${which} scratched`
    }

    return (
      <button
        key={`${r}-${c}`}
        type="button"
        className={classes.join(' ')}
        style={style}
        onClick={() => clickCell(r, c)}
        disabled={isDiagonal || scratched}
      >
        {content}
        {scratched && (
          // Small red corner badge — visible regardless of whether the cell
          // was owned (overlays the player initials) or empty (sits on stripes).
          <span
            aria-hidden
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              padding: '0 3px',
              fontSize: `${Math.max(7, Math.floor(cellSize * 0.28))}px`,
              fontWeight: 800,
              letterSpacing: '0.4px',
              color: '#fff',
              background: 'rgba(200,20,30,0.95)',
              borderBottomLeftRadius: 3,
              lineHeight: 1.1,
              pointerEvents: 'none',
            }}
          >VOID</span>
        )}
        {tooltip && <span className="tooltip">{tooltip}</span>}
      </button>
    )
  }

  // ── Display-mode cells ─────────────────────────────────────────
  function renderDisplayCell(r: number, c: number) {
    const cell = board[r][c]
    const isWinner = winnerCell && winnerCell.row === r && winnerCell.col === c
    const isDiagonal = r === c
    const pIdx = typeof cell === 'number' ? cell : null
    const player = pIdx !== null ? players[pIdx] : null
    const rowScratched = numbersLocked && scratchedNumbers.has(rowNums[r])
    const colScratched = numbersLocked && scratchedNumbers.has(colNums[c])
    const scratched = !isDiagonal && (rowScratched || colScratched)
    const cs = displayCellSize
    const fs = Math.max(7, Math.floor(cs * 0.38))

    const baseStyle: React.CSSProperties = {
      width: cs, height: cs,
      fontSize: `${fs}px`,
      position: 'relative',
    }
    const voidBadge = (
      <span
        aria-hidden
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          padding: '0 2px',
          fontSize: `${Math.max(6, Math.floor(cs * 0.26))}px`,
          fontWeight: 800,
          color: '#fff',
          background: 'rgba(200,20,30,0.95)',
          borderBottomLeftRadius: 2,
          lineHeight: 1.1,
        }}
      >VOID</span>
    )
    const stripe = 'repeating-linear-gradient(45deg, rgba(120,0,0,0.55) 0 4px, rgba(0,0,0,0.65) 4px 8px)'

    if (isDiagonal) {
      return (
        <div key={`d-${r}-${c}`} className="dcell" style={{
          ...baseStyle,
          background: 'repeating-linear-gradient(45deg,rgba(80,0,0,0.5),rgba(80,0,0,0.5) 3px,rgba(30,0,0,0.6) 3px,rgba(30,0,0,0.6) 6px)',
          border: '1px solid rgba(139,26,47,0.3)',
          cursor: 'not-allowed',
        }} />
      )
    }
    if (isWinner) {
      return (
        <div key={`d-${r}-${c}`} className="dcell" style={{
          ...baseStyle,
          background: 'linear-gradient(135deg,#FFD700,#FFA500)',
          border: '1px solid #FFD700',
          fontSize: `${Math.max(10, cs * 0.5)}px`,
        }}>🏆</div>
      )
    }
    if (player) {
      const parts = player.name.split(' ')
      const initials = parts.map(p => p[0]).join('').slice(0, 2).toUpperCase()
      const rl2 = numbersLocked ? `Horse #${rowNums[r]}` : `Row ${r + 1}`
      const cl2 = numbersLocked ? `Horse #${colNums[c]}` : `Col ${c + 1}`
      return (
        <div key={`d-${r}-${c}`} className="dcell" style={{
          ...baseStyle,
          background: player.color,
          border: `1px solid ${player.color}`,
          color: 'rgba(255,255,255,0.9)',
          ...(scratched ? { backgroundImage: stripe, opacity: 0.85 } : {}),
        }}>
          {initials}
          {scratched && voidBadge}
          <span className="dtip">
            {scratched ? `VOID · ${player.name}` : `${player.name} · ${rl2} × ${cl2}`}
          </span>
        </div>
      )
    }
    return (
      <div key={`d-${r}-${c}`} className="dcell" style={{
        ...baseStyle,
        ...(scratched
          ? { background: stripe, border: '1px solid rgba(139,26,47,0.4)', opacity: 0.7 }
          : { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)' }),
      }}>
        {scratched && voidBadge}
      </div>
    )
  }

  // ── MAIN RENDER ────────────────────────────────────────────────
  return (
    <div className="exacta-root">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="container">

        <div className="main-split">
          <div className="left-col">

            {/* Event bar */}
            <div className="event-bar">
              <span className="event-bar-label">EVENT</span>
              {loadingEvents ? (
                <span style={{ fontStyle: 'italic', color: 'rgba(245,237,214,0.5)' }}>Loading…</span>
              ) : events.length === 0 ? (
                <span style={{ fontStyle: 'italic', color: 'rgba(245,237,214,0.5)' }}>No events yet</span>
              ) : (
                <select value={eventId ?? ''} onChange={e => setEventId(e.target.value || null)}>
                  {events.map(ev => (
                    <option key={ev.id} value={ev.id}>
                      {ev.status === 'active' ? '⭐ ' : ev.status === 'archived' ? '📋 ' : ev.status === 'draft' ? '📝 ' : ''}
                      {ev.name || '(unnamed event)'}
                    </option>
                  ))}
                </select>
              )}
              <button
                className="lock-btn"
                onClick={() => {
                  if (typeof window !== 'undefined') sessionStorage.removeItem('furlong_exacta')
                  setAuthed(false)
                }}
              >Lock</button>
            </div>

            {/* HEADER */}
            <div className="header">
              <div className="header-sub">Churchill Downs · Louisville, Kentucky</div>
              <h1>Frey Family Kentucky Derby <span>Exacta</span> Board</h1>
              <div className="header-year">May 2, 2026 · The 152nd Run for the Roses</div>
            </div>

            {!loadingBoard && (
            <>
              {/* POT BANNER */}
              <div className="pot-banner">
                <div className="pot-left">
                  <div className="pot-label">🏆 WINNER TAKES ALL</div>
                  <div className="pot-sub">Exacta · 1st & 2nd place in exact order</div>
                </div>
                <div className="pot-right">
                  <div className="pot-amount">${used}</div>
                  <div className="pot-sub">{used} of {playableSquares} squares sold</div>
                </div>
              </div>

              {/* TEMP debug pill — surfaces which race the exacta board is
                  actually pinned to so we can verify the heuristic landed
                  on the right one. Kentucky Derby 152 should read
                  bb4164b7-6e6b-4d29-a079-467ac5c60b7d with 24 horses
                  (19 active, 5 scratched). Remove once verified. */}
              {exactaRace && (
                <div
                  style={{
                    margin: '8px 0',
                    padding: '6px 10px',
                    borderRadius: 8,
                    border: '1px dashed rgba(201,168,76,0.45)',
                    background: 'rgba(201,168,76,0.08)',
                    color: 'rgba(245,237,214,0.9)',
                    fontSize: '0.72rem',
                    fontFamily: 'ui-monospace, monospace',
                    lineHeight: 1.5,
                  }}
                >
                  <span style={{ color: '#C9A84C', fontWeight: 700 }}>[DEBUG]</span>{' '}
                  exacta_race_id = <span style={{ color: '#E8C96A' }}>{exactaRace.id}</span>
                  {' · '}R{exactaRace.race_number} {exactaRace.name && `· ${exactaRace.name}`}
                  {' · '}horses: {horses.length} ({horses.filter(h => !h.scratched).length} active,{' '}
                  {horses.filter(h => h.scratched).length} scratched)
                </div>
              )}

              {/* Scratch warning — only when at least one horse in the exacta
                  race is flagged scratched. Squares on those rows / columns
                  are visually voided in the grid below. */}
              {scratchCount > 0 && (
                <div
                  style={{
                    margin: '8px 0',
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: '1px solid rgba(220,30,30,0.5)',
                    background: 'rgba(220,30,30,0.12)',
                    color: '#FFD9D9',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    letterSpacing: '0.4px',
                  }}
                >
                  ⚠️ {scratchCount} horse{scratchCount === 1 ? '' : 's'} scratched
                  {' — '}
                  <span style={{ fontWeight: 400, opacity: 0.85 }}>
                    affected rows &amp; columns are voided. Existing buyers keep their square color
                    but it pays $0.
                  </span>
                </div>
              )}

              <div className="controls">
                <div className="control-section">
                  <h3>Add Player</h3>
                  <div className="add-player-form">
                    <div className="form-row">
                      <input
                        type="text"
                        value={playerName}
                        onChange={e => setPlayerName(e.target.value)}
                        placeholder="Player name..."
                        onKeyDown={e => { if (e.key === 'Enter') void addPlayer() }}
                      />
                      <select
                        value={bundleSize}
                        onChange={e => {
                          setBundleSize(e.target.value)
                          if (e.target.value !== 'custom') setCustomAmount('')
                        }}
                      >
                        <option value="2">2 squares — $2</option>
                        <option value="4">4 squares — $4</option>
                        <option value="8">8 squares — $8</option>
                        <option value="16">16 squares — $16</option>
                        <option value="24">24 squares — $24</option>
                        <option value="32">32 squares — $32</option>
                        <option value="custom">Custom amount...</option>
                      </select>
                      {bundleSize === 'custom' && (
                        <input
                          type="text"
                          value={customAmount}
                          onChange={e => setCustomAmount(e.target.value)}
                          placeholder="# squares"
                          style={{ width: 90, flex: '0 0 90px', minWidth: 90 }}
                        />
                      )}
                      <button className="btn btn-gold" onClick={() => void addPlayer()}>Add</button>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4, flexWrap: 'wrap' }}>
                      <label style={{ fontSize: '0.72rem', color: 'rgba(245,237,214,0.7)', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                        <input
                          type="radio"
                          name="assignMode"
                          checked={assignMode === 'random'}
                          onChange={() => setAssignMode('random')}
                          style={{ accentColor: '#C9A84C' }}
                        />
                        Random
                      </label>
                      <label style={{ fontSize: '0.72rem', color: 'rgba(245,237,214,0.7)', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                        <input
                          type="radio"
                          name="assignMode"
                          checked={assignMode === 'pick'}
                          onChange={() => setAssignMode('pick')}
                          style={{ accentColor: '#C9A84C' }}
                        />
                        Pick own
                      </label>
                    </div>
                    {assignMode === 'pick' && (
                      <div style={{ fontSize: '0.7rem', color: '#C9A84C', fontStyle: 'italic', marginTop: 2 }}>
                        Click "Add" then click squares to claim them
                      </div>
                    )}
                  </div>
                </div>
                <div className="control-section">
                  <h3>Players ({players.length} · {used}/{playableSquares})</h3>
                  <div className="players-list">
                    {players.length === 0 ? (
                      <div style={{ fontSize: '0.75rem', color: 'rgba(245,237,214,0.4)', fontStyle: 'italic', padding: 6 }}>
                        No players yet — add someone above
                      </div>
                    ) : (
                      players.map((p, i) => (
                        <div key={`${p.name}-${i}`} className="player-item" style={{ borderLeftColor: p.color }}>
                          <span>
                            <span className="player-name" style={{ color: p.color }}>{p.name}</span>
                            <span className="player-squares">{p.count}</span>
                          </span>
                          <button className="player-remove" onClick={() => void removePlayer(i)} title="Remove">✕</button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <div className="action-row">
                <button className="btn btn-rose" onClick={() => void clearAll()}>Clear All</button>
                <button className="btn btn-green" onClick={shuffleNumbers}>🎲 Randomize</button>
                <button className="btn btn-outline" onClick={() => window.print()}>🖨 Print</button>
                <button
                  className="btn"
                  style={{ background: 'linear-gradient(135deg,#8B1A2F,#B52340)', color: '#F5EDD6' }}
                  onClick={enterDisplayMode}
                >📺 Display</button>
              </div>
              <div className="status-badge" style={{ fontSize: '0.7rem', color: 'rgba(245,237,214,0.6)', fontStyle: 'italic' }}>{statusBadge}</div>

              <div className={`picking-banner${pickingPlayer !== null ? ' active' : ''}`}>
                <span>{pickingPlayer !== null && players[pickingPlayer] ? `${players[pickingPlayer].name} — claim:` : 'Click squares to claim them'}</span>
                <span style={{ fontWeight: 700 }}>{pickingCount} / {pickingTarget}</span>
                <button className="btn btn-gold" onClick={() => void confirmPicks()} style={{ padding: '4px 10px', fontSize: '0.75rem' }}>✓ Confirm</button>
                <button className="btn btn-outline" onClick={cancelPicks} style={{ padding: '4px 10px', fontSize: '0.75rem' }}>Cancel</button>
              </div>

              <div className="result-section">
                <h3>🏆 Race Results</h3>
                <div className="result-row">
                  <div className="result-inputs">
                    <span className="result-label">🥇 1st:</span>
                    <input
                      type="text"
                      className="horse-num-input"
                      value={first}
                      onChange={e => setFirst(e.target.value)}
                      placeholder="#"
                    />
                    <span className="result-label">🥈 2nd:</span>
                    <input
                      type="text"
                      className="horse-num-input"
                      value={second}
                      onChange={e => setSecond(e.target.value)}
                      placeholder="#"
                    />
                    <button className="btn btn-gold" onClick={findWinner}>Find</button>
                    <button className="btn btn-outline" onClick={clearResult}>Clear</button>
                  </div>
                </div>
                {winnerInfo && (
                  <div className="winner-display">
                    <div className="winner-title">🎉 Exacta Winner</div>
                    <div className="winner-name">{winnerInfo.name}</div>
                    <div className="winner-detail" style={{ color: winnerInfo.color }}>{winnerInfo.detail}</div>
                  </div>
                )}
              </div>
            </>
            )}
          </div>

          <div className="right-col" ref={rightColRef}>
            {loadingBoard ? (
              <div style={{ textAlign: 'center', padding: 24, color: 'rgba(245,237,214,0.6)' }}>
                <div style={{ fontSize: '2rem', marginBottom: 8 }}>🏇</div>
                <div>Loading board…</div>
              </div>
            ) : (
            <>
              <div style={{ marginBottom: 4 }}>
                <div className="board-label" style={{ marginLeft: 51 }}>🏇 2nd Place Horse (Columns)</div>
              </div>
              <div className="board-outer">
                <div className="board-label vertical">🏇 1st Place Horse (Rows)</div>
                <div className="grid-wrapper">
                  <div className="grid-header-row" style={{ marginLeft: 51 }}>
                    {colNums.map((n, i) => {
                      const isScratched = numbersLocked && scratchedNumbers.has(n)
                      return (
                        <div
                          key={i}
                          className="col-label"
                          style={{
                            width: cellSize,
                            height: Math.max(18, Math.round(cellSize * 0.7)),
                            fontSize: `${Math.max(10, Math.floor(cellSize * 0.36))}px`,
                            ...(isScratched ? {
                              background: 'repeating-linear-gradient(45deg, rgba(120,0,0,0.55) 0 4px, rgba(0,0,0,0.65) 4px 8px)',
                              color: '#FFD9D9',
                              opacity: 0.85,
                            } : {}),
                          }}
                          title={isScratched ? `Horse #${n} scratched` : undefined}
                        >{numbersLocked ? (isScratched ? 'SCR' : n) : '?'}</div>
                      )
                    })}
                  </div>
                  <div className="grid-body">
                    {Array.from({ length: N }, (_, r) => {
                      const isScratched = numbersLocked && scratchedNumbers.has(rowNums[r])
                      return (
                        <div key={r} className="grid-row">
                          <div
                            className="row-label"
                            style={{
                              width: 50,
                              height: cellSize,
                              fontSize: `${Math.max(10, Math.floor(cellSize * 0.36))}px`,
                              ...(isScratched ? {
                                background: 'repeating-linear-gradient(45deg, rgba(120,0,0,0.55) 0 4px, rgba(0,0,0,0.65) 4px 8px)',
                                color: '#FFD9D9',
                                opacity: 0.85,
                              } : {}),
                            }}
                            title={isScratched ? `Horse #${rowNums[r]} scratched` : undefined}
                          >{numbersLocked ? (isScratched ? 'SCR' : `#${rowNums[r]}`) : '?'}</div>
                          {Array.from({ length: N }, (_, c) => renderCell(r, c))}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </>
            )}
          </div>
        </div>

          {/* legend (hidden via CSS, kept for parity with original markup) */}
          <div className="legend">
            {players.length === 0 ? (
              <div style={{ fontSize: '0.75rem', color: 'rgba(245,237,214,0.5)', fontStyle: 'italic' }}>
                Player legend will appear here as you add players
              </div>
            ) : (
              players.map((p, i) => (
                <div key={`l-${p.name}-${i}`} className="legend-item">
                  <div className="legend-swatch" style={{ background: p.color }} />
                  <span>{p.name} ({p.count})</span>
                </div>
              ))
            )}
          </div>

          <div className="footer">
            The Run for the Roses · Churchill Downs · May 2, 2026<br />
            Exacta: correctly predicting 1st &amp; 2nd place finishers in exact order
          </div>
      </div>

      {/* DISPLAY MODE OVERLAY */}
      {displayMode && (
        <div ref={displayOverlayRef} className="display-overlay">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 24px', background: 'linear-gradient(135deg,#8B1A2F,#B52340)', borderBottom: '2px solid #C9A84C', flexShrink: 0 }}>
            <div>
              <div style={{ fontFamily: '"Bebas Neue", cursive', fontSize: '1.1rem', letterSpacing: '4px', color: '#C9A84C' }}>
                Churchill Downs · May 2, 2026 · The 152nd Run for the Roses
              </div>
              <div style={{ fontFamily: '"Bebas Neue", cursive', fontSize: '1.8rem', letterSpacing: '3px', color: '#F5EDD6', lineHeight: 1 }}>
                Frey Family Kentucky Derby <span style={{ color: '#C9A84C', fontStyle: 'italic' }}>Exacta</span> Board
              </div>
            </div>
            <div style={{ textAlign: 'center', padding: '0 24px' }}>
              <div style={{ fontFamily: '"Bebas Neue", cursive', fontSize: '0.9rem', letterSpacing: '3px', color: 'rgba(245,237,214,0.7)' }}>🏆 WINNER TAKES ALL</div>
              <div style={{ fontFamily: '"Bebas Neue", cursive', fontSize: '3.5rem', color: '#C9A84C', lineHeight: 1, textShadow: '0 2px 20px rgba(201,168,76,0.5)' }}>${used}</div>
              <div style={{ fontSize: '0.7rem', color: 'rgba(245,237,214,0.6)', letterSpacing: '1px' }}>{used} of {playableSquares} squares sold</div>
            </div>
            <button
              onClick={exitDisplayMode}
              style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: '#F5EDD6', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontFamily: '"Libre Baskerville", serif', fontSize: '0.85rem' }}
            >✕ Exit</button>
          </div>

          <div style={{ display: 'flex', flex: 1, overflow: 'hidden', padding: 12, gap: 12 }}>
            <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ fontFamily: '"Bebas Neue", cursive', fontSize: '0.7rem', letterSpacing: '3px', color: '#C9A84C', marginBottom: 4, textAlign: 'center' }}>
                🏇 2nd Place Horse (Columns)
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                <div style={{ fontFamily: '"Bebas Neue", cursive', fontSize: '0.65rem', letterSpacing: '2px', color: '#C9A84C', writingMode: 'vertical-rl', transform: 'rotate(180deg)', marginRight: 4, alignSelf: 'center' }}>
                  🏇 1st Place Horse (Rows)
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <div style={{ display: 'flex', gap: 1, marginLeft: 43 }}>
                    {colNums.map((n, i) => {
                      const isScratched = numbersLocked && scratchedNumbers.has(n)
                      return (
                        <div key={`dh-${i}`} style={{
                          width: displayCellSize,
                          height: Math.round(displayCellSize * 0.85),
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontFamily: '"Bebas Neue", cursive',
                          fontSize: `${Math.max(7, Math.floor(displayCellSize * 0.32))}px`,
                          color: isScratched ? '#FFD9D9' : '#E8C96A',
                          background: isScratched
                            ? 'repeating-linear-gradient(45deg, rgba(120,0,0,0.55) 0 4px, rgba(0,0,0,0.65) 4px 8px)'
                            : 'rgba(201,168,76,0.1)',
                          opacity: isScratched ? 0.85 : 1,
                          borderRadius: '2px 2px 0 0', flexShrink: 0,
                        }}>{numbersLocked ? (isScratched ? 'SCR' : n) : '?'}</div>
                      )
                    })}
                  </div>
                  {Array.from({ length: N }, (_, r) => {
                    const isScratched = numbersLocked && scratchedNumbers.has(rowNums[r])
                    return (
                      <div key={`dr-${r}`} style={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                        <div style={{
                          width: 42,
                          height: displayCellSize,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontFamily: '"Bebas Neue", cursive',
                          fontSize: `${Math.max(7, Math.floor(displayCellSize * 0.32))}px`,
                          color: isScratched ? '#FFD9D9' : '#E8C96A',
                          background: isScratched
                            ? 'repeating-linear-gradient(45deg, rgba(120,0,0,0.55) 0 4px, rgba(0,0,0,0.65) 4px 8px)'
                            : 'rgba(201,168,76,0.1)',
                          opacity: isScratched ? 0.85 : 1,
                          borderRadius: '2px 0 0 2px', flexShrink: 0, marginRight: 1,
                        }}>{numbersLocked ? (isScratched ? 'SCR' : `#${rowNums[r]}`) : '?'}</div>
                        {Array.from({ length: N }, (_, c) => renderDisplayCell(r, c))}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            <div style={{ width: 200, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 0, overflowY: 'auto', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(201,168,76,0.15)', borderRadius: 10, padding: 10 }}>
              <div style={{ fontFamily: '"Bebas Neue", cursive', letterSpacing: '3px', color: '#C9A84C', fontSize: '0.8rem', marginBottom: 8, textAlign: 'center', borderBottom: '1px solid rgba(201,168,76,0.2)', paddingBottom: 6 }}>
                PLAYERS
              </div>
              {players.length === 0 ? (
                <div style={{ fontSize: '0.75rem', color: 'rgba(245,237,214,0.4)', fontStyle: 'italic', textAlign: 'center' }}>
                  No players yet
                </div>
              ) : (
                players.map((p, i) => (
                  <div key={`dl-${p.name}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 4px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ width: 14, height: 14, borderRadius: 3, background: p.color, flexShrink: 0, border: '1px solid rgba(255,255,255,0.2)' }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#FFFFFF', lineHeight: 1.2 }}>{p.name}</div>
                      <div style={{ fontSize: 10, color: '#C9A84C' }}>{p.count} squares · ${p.count}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
