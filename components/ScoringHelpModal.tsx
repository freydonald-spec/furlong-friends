'use client'

import { motion } from 'framer-motion'

/** Light-themed help dialog explaining the full scoring system. Rendered at
 *  z-[100] so it sits above the picks grid (no z) AND the pick wizard
 *  (z-[60]) AND any wizard-internal modal (z-[70]). */
export function ScoringHelpModal({ onClose }: { onClose: () => void }) {
  const rules: { label: string; value: string; tone: string }[] = [
    { label: 'Win correct', value: '5 pts', tone: 'text-[var(--success)]' },
    { label: 'Place correct', value: '3 pts', tone: 'text-[var(--gold)]' },
    { label: 'Show correct', value: '2 pts', tone: 'text-[var(--text-primary)]' },
    { label: 'Right horse, wrong spot', value: '1 pt', tone: 'text-[var(--text-muted)]' },
  ]
  const bonuses: { label: string; value: string; emoji: string }[] = [
    { emoji: '🎰', label: 'Longshot bonus (15-1+) on exact match', value: '+5 pts' },
    { emoji: '⭐', label: 'Perfect race (all 3 exact)', value: '+5 pts' },
  ]
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-[100] bg-black/40 flex items-end sm:items-center justify-center"
    >
      <motion.div
        initial={{ y: '100%', opacity: 0.6 }} animate={{ y: 0, opacity: 1 }} exit={{ y: '100%', opacity: 0.6 }}
        transition={{ type: 'spring', damping: 26, stiffness: 220 }}
        onClick={e => e.stopPropagation()}
        className="bg-white border-t-2 sm:border-2 border-[var(--border)] sm:rounded-2xl rounded-t-3xl w-full sm:max-w-md max-h-[88vh] overflow-hidden flex flex-col shadow-xl"
      >
        <div className="px-5 pt-4 pb-3 border-b border-[var(--border)] flex items-center justify-between">
          <h3 className="font-serif text-xl font-bold text-[var(--text-primary)]">How scoring works</h3>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-9 h-9 rounded-full bg-[var(--bg-primary)] hover:bg-[var(--bg-card-hover)] text-[var(--text-primary)] text-xl leading-none flex items-center justify-center border border-[var(--border)]"
          >
            ✕
          </button>
        </div>
        <div className="overflow-y-auto p-5 bg-[var(--bg-primary)] space-y-4">
          <section>
            <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--text-muted)] mb-2">
              Base points
            </h4>
            <ul className="bg-white border border-[var(--border)] rounded-xl divide-y divide-[var(--border)] overflow-hidden shadow-sm">
              {rules.map(r => (
                <li key={r.label} className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <span className="text-sm text-[var(--text-primary)]">{r.label}</span>
                  <span className={`text-sm font-extrabold tabular-nums ${r.tone}`}>{r.value}</span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--text-muted)] mb-2">
              Bonuses
            </h4>
            <ul className="bg-white border border-[var(--border)] rounded-xl divide-y divide-[var(--border)] overflow-hidden shadow-sm">
              {bonuses.map(b => (
                <li key={b.label} className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <span className="text-sm text-[var(--text-primary)] flex items-center gap-2">
                    <span aria-hidden>{b.emoji}</span>
                    <span>{b.label}</span>
                  </span>
                  <span className="text-sm font-extrabold text-[var(--gold)] tabular-nums">{b.value}</span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--text-muted)] mb-2">
              Power Plays
            </h4>
            <div className="bg-white border border-[var(--border)] rounded-xl px-3 py-2.5 shadow-sm">
              <p className="text-sm text-[var(--text-primary)] leading-relaxed">
                <span className="font-bold text-[var(--gold)]">×3</span> and{' '}
                <span className="font-bold text-[var(--gold)]">×2</span> multipliers apply to your{' '}
                <span className="font-semibold">base score</span> for that race.
                Bonuses (🎰 longshot, ⭐ perfect race) are added{' '}
                <span className="font-semibold">after</span> the multiplier.
              </p>
            </div>
          </section>
        </div>
        <div className="px-4 py-3 border-t border-[var(--border)] bg-white">
          <button
            type="button"
            onClick={onClose}
            className="w-full h-12 rounded-full bg-[var(--rose-dark)] text-white font-bold shadow-md hover:bg-[var(--rose-dark)]/90"
          >
            Got it
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
