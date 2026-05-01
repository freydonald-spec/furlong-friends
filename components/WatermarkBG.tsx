import * as React from 'react'

/**
 * Subtle rose watermark — fixed full-screen background, behind all content.
 * Sits at z-index: -1 (works because globals.css gives <body> an isolated
 * stacking context). Drop as the first child of any page <main>.
 */
export function WatermarkBG() {
  return (
    <div
      aria-hidden
      className="fixed inset-0 pointer-events-none flex items-center justify-center"
      style={{ zIndex: -1, opacity: 0.08 }}
    >
      <svg
        viewBox="0 0 600 600"
        xmlns="http://www.w3.org/2000/svg"
        className="w-[min(90vmin,640px)] h-[min(90vmin,640px)]"
        aria-hidden
      >
        {/* Rose centered on canvas — built from layered petals.
            Soft pink #FFB6C1 throughout; the deeper crimson outline is dropped
            so the mark reads as a delicate watermark on the light page bg. */}
        <g transform="translate(300 300)" fill="#FFB6C1" stroke="#FFB6C1" strokeWidth="1">
          {/* Outer petals */}
          <ellipse cx="0" cy="-160" rx="70" ry="100" />
          <ellipse cx="152" cy="-50" rx="70" ry="100" transform="rotate(72 152 -50)" />
          <ellipse cx="94" cy="130" rx="70" ry="100" transform="rotate(144 94 130)" />
          <ellipse cx="-94" cy="130" rx="70" ry="100" transform="rotate(216 -94 130)" />
          <ellipse cx="-152" cy="-50" rx="70" ry="100" transform="rotate(288 -152 -50)" />
        </g>
        <g transform="translate(300 300)" fill="#FFC0CB" opacity="0.85">
          {/* Mid petals — rotated 36° to fill gaps */}
          <ellipse cx="0" cy="-110" rx="55" ry="75" transform="rotate(36)" />
          <ellipse cx="105" cy="-34" rx="55" ry="75" transform="rotate(108 105 -34)" />
          <ellipse cx="65" cy="89" rx="55" ry="75" transform="rotate(180 65 89)" />
          <ellipse cx="-65" cy="89" rx="55" ry="75" transform="rotate(252 -65 89)" />
          <ellipse cx="-105" cy="-34" rx="55" ry="75" transform="rotate(324 -105 -34)" />
        </g>
        <g transform="translate(300 300)" fill="#FFB6C1">
          {/* Inner bloom */}
          <circle cx="0" cy="0" r="50" />
          <path d="M -38 -10 Q 0 -40 38 -10 Q 30 22 0 18 Q -30 22 -38 -10 Z" fill="#FF8FA3" />
          <circle cx="0" cy="0" r="14" fill="#FF8FA3" />
        </g>
        {/* Stem */}
        <g stroke="#A7D7A8" strokeWidth="6" fill="none" opacity="0.85">
          <path d="M300 480 Q280 530 260 580" />
          <path d="M300 480 Q320 530 340 580" />
        </g>
        {/* Leaves */}
        <g fill="#A7D7A8">
          <ellipse cx="276" cy="510" rx="22" ry="11" transform="rotate(-30 276 510)" />
          <ellipse cx="324" cy="540" rx="22" ry="11" transform="rotate(30 324 540)" />
        </g>
      </svg>
    </div>
  )
}
