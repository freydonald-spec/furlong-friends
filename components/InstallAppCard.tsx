'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

type Platform = 'ios' | 'android' | 'desktop' | 'unknown'

function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'unknown'
  const ua = navigator.userAgent
  if (/iPad|iPhone|iPod/.test(ua)) return 'ios'
  if (/Android/.test(ua)) return 'android'
  return 'desktop'
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  // Android & desktop PWAs report through the display-mode media query.
  if (window.matchMedia?.('(display-mode: standalone)').matches) return true
  // iOS Safari uses a non-standard navigator.standalone flag for home-screen-launched apps.
  const navStandalone = (navigator as unknown as { standalone?: boolean }).standalone
  return navStandalone === true
}

const STEPS: Record<Exclude<Platform, 'unknown'>, string[]> = {
  ios: [
    'Tap the Share button (box with arrow pointing up) at the bottom of Safari',
    'Scroll down and tap "Add to Home Screen"',
    'Tap "Add" in the top right',
  ],
  android: [
    'Tap the three-dot menu (⋮) in the top right of Chrome',
    'Tap "Add to Home Screen" or "Install App"',
    'Tap "Add"',
  ],
  desktop: [
    'Look for the install icon (⊕) in the address bar',
    'Click "Install" when prompted',
  ],
}

/** Collapsible "Install the app" panel, surfaced on /join and /login. Detects
 *  iOS / Android / desktop on mount and shows only the relevant instructions.
 *  Hides itself entirely when the page is already running standalone — the
 *  user has already installed the app, no need to upsell them. */
export function InstallAppCard({ className }: { className?: string }) {
  // SSR-safe defaults: detection runs in an effect on first mount so the
  // server-rendered HTML doesn't pick a platform that doesn't match the
  // hydrated client.
  const [platform, setPlatform] = useState<Platform>('unknown')
  const [standalone, setStandalone] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    // navigator is undefined during SSR, so detection has to land on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPlatform(detectPlatform())
    setStandalone(isStandalone())
  }, [])

  if (platform === 'unknown') return null
  if (standalone) return null

  const steps = STEPS[platform]
  const platformLabel =
    platform === 'ios' ? 'iOS (Safari)' :
    platform === 'android' ? 'Android (Chrome)' :
    'Desktop'

  return (
    <section className={`mt-6 w-full max-w-md mx-auto ${className ?? ''}`}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-controls="install-app-body"
        className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-white border border-[var(--border)] shadow-sm hover:bg-[var(--bg-card-hover)] transition-colors text-left"
      >
        <span className="flex items-center gap-2 min-w-0">
          <span aria-hidden className="text-xl shrink-0">📲</span>
          <span className="text-sm font-semibold text-[var(--text-primary)] truncate">
            Install the app for the best experience
          </span>
        </span>
        <span
          aria-hidden
          className={`shrink-0 text-[var(--text-muted)] text-base leading-none transition-transform ${open ? 'rotate-180' : ''}`}
        >
          ▾
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id="install-app-body"
            key="install-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div className="mt-2 px-4 py-3 rounded-xl bg-white border border-[var(--border)] shadow-sm">
              <div className="text-[10px] uppercase tracking-wider font-bold text-[var(--text-muted)] mb-2">
                {platformLabel}
              </div>
              <ol className="space-y-2 list-decimal list-inside text-sm text-[var(--text-primary)] leading-relaxed">
                {steps.map((s, i) => <li key={i}>{s}</li>)}
              </ol>
              {platform === 'desktop' && (
                <p className="mt-3 text-xs text-[var(--text-muted)]">
                  Or just bookmark this page for quick access.
                </p>
              )}
              <p className="mt-3 text-xs text-[var(--text-muted)] italic">
                Works best in Safari on iPhone / Chrome on Android.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}
