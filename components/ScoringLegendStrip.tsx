'use client'

import { useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { ScoringHelpModal } from '@/components/ScoringHelpModal'

type Variant = 'compact' | 'full'

type Props = {
  /** Layout variant. `full` is for the picks-grid bar (wraps if needed,
   *  fills width). `compact` is for the wizard header (single row, sits
   *  next to "RACE N OF M"). */
  variant?: Variant
  className?: string
}

/** Tappable scoring-legend strip — clicking anywhere on it opens the
 *  ScoringHelpModal with the full rules. Owns its own modal state so callers
 *  just drop it in. */
export function ScoringLegendStrip({ variant = 'full', className }: Props) {
  const [open, setOpen] = useState(false)
  const compact = variant === 'compact'
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="View scoring details"
        className={`
          group inline-flex items-center gap-1 font-semibold
          text-[var(--text-muted)]
          rounded-md
          ${compact
            ? 'text-[10px] flex-nowrap whitespace-nowrap'
            : 'text-sm flex-wrap gap-x-1.5 gap-y-0.5 w-full'}
          hover:text-[var(--text-primary)] cursor-pointer
          ${className ?? ''}
        `}
      >
        <span className={`inline-flex items-center flex-wrap underline decoration-dotted decoration-[var(--text-muted)]/40 underline-offset-4 group-hover:decoration-[var(--text-primary)]/70 ${compact ? 'gap-x-1 gap-y-0.5' : 'gap-x-1.5 gap-y-0.5'}`}>
          <span><span className="text-[var(--success)] font-bold">W=5</span></span>
          <span className="opacity-50">·</span>
          <span><span className="text-[var(--gold)] font-bold">P=3</span></span>
          <span className="opacity-50">·</span>
          <span><span className="text-[var(--text-primary)] font-bold">S=2</span></span>
          <span className="opacity-50">·</span>
          <span>wrong spot=<span className="text-[var(--text-primary)] font-bold">1</span></span>
          <span className="opacity-50">·</span>
          <span><span className="text-rose-700 font-bold">🎰+5</span></span>
          <span className="opacity-50">·</span>
          <span><span className="text-[var(--gold)] font-bold">⭐+5</span></span>
        </span>
        {/* Affordance — small chevron makes it feel like a tappable surface
            without needing a separate (i) button. */}
        <span aria-hidden className={`${compact ? 'text-[10px]' : 'text-sm'} text-[var(--text-muted)]/70 group-hover:text-[var(--rose-dark)] shrink-0`}>
          ›
        </span>
      </button>
      <AnimatePresence>
        {open && <ScoringHelpModal onClose={() => setOpen(false)} />}
      </AnimatePresence>
    </>
  )
}
