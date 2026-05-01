import * as React from 'react'

// Press Start 2P (the canonical NES / Tecmo Bowl pixel font) is wired up in
// app/layout.tsx as the --font-press-start CSS variable.
export function WatchPartyBadge({ className = '' }: { className?: string }) {
  return (
    <a
      href="https://watchparty.games"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Powered by WatchParty.Games"
      className={`inline-block text-center ${className}`}
    >
      <span
        className="text-[var(--gold)] hover:text-white transition-colors"
        style={{
          fontFamily: 'var(--font-press-start), "Courier New", monospace',
          fontSize: '10px',
          letterSpacing: '0.04em',
          lineHeight: 1.8,
        }}
      >
        {/* Use --text-muted (#6B7280) so the prefix stays legible on both
            the dark splash pages and the light /picks + /leaderboard pages. */}
        <span className="text-[var(--text-muted)]">Powered by </span>
        WatchParty.Games
      </span>
    </a>
  )
}
