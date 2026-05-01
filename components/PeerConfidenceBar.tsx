'use client'

type Props = {
  pct: number
  /** Suffix shown after the percent number; defaults to "to win". */
  label?: string
  className?: string
}

/** Reusable peer-confidence bar — 3px gray-200 track, rose-400 fill, with a
 *  tiny right-aligned percentage label. Driven entirely by `pct` so callers
 *  decide when to render (5+ pickers gate lives in usePeerConfidence). */
export function PeerConfidenceBar({ pct, label = 'to win', className }: Props) {
  const safePct = Math.max(0, Math.min(100, Math.round(pct)))
  return (
    <div className={`flex items-center gap-2 ${className ?? ''}`}>
      <div className="flex-1 h-[3px] rounded-full bg-gray-200 overflow-hidden">
        <div
          className="h-full bg-rose-400 rounded-full transition-all"
          style={{ width: `${safePct}%` }}
        />
      </div>
      <span className="text-[10px] text-[var(--text-muted)] tabular-nums shrink-0 font-semibold">
        {safePct}% {label}
      </span>
    </div>
  )
}
