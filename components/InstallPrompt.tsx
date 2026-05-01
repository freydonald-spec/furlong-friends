'use client'

import { useEffect, useState } from 'react'

/**
 * Subtle "add to home screen" banner shown only on mobile, only when:
 *   - the app isn't already running standalone (i.e. not already installed)
 *   - the user hasn't dismissed it before (localStorage flag)
 *   - the browser supports the `beforeinstallprompt` event (Chrome / Android)
 *     OR the user is on iOS Safari (which has no programmatic install)
 *
 * On Chrome we surface the captured prompt; on iOS Safari we just show a
 * one-line tip telling the user to use the share-sheet "Add to Home Screen".
 */
type BIPEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const STORAGE_KEY = 'furlong_pwa_dismissed'

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null)
  const [showIosTip, setShowIosTip] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (localStorage.getItem(STORAGE_KEY) === '1') {
      setDismissed(true)
      return
    }
    // Don't prompt when running as an installed app already.
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      // iOS Safari sets navigator.standalone when launched from home screen.
      ('standalone' in navigator && (navigator as unknown as { standalone?: boolean }).standalone === true)
    if (standalone) {
      setDismissed(true)
      return
    }
    // Mobile-only — desktop browsers shouldn't see this nudge.
    const isMobile = window.matchMedia('(max-width: 820px)').matches ||
      /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
    if (!isMobile) return

    const onBIP = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BIPEvent)
    }
    window.addEventListener('beforeinstallprompt', onBIP)

    // iOS Safari fallback: there's no programmatic prompt, so we just show
    // a tip with manual instructions.
    const isIos = /iPhone|iPad|iPod/i.test(navigator.userAgent)
    if (isIos) setShowIosTip(true)

    return () => window.removeEventListener('beforeinstallprompt', onBIP)
  }, [])

  function dismiss() {
    setDismissed(true)
    if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, '1')
  }

  async function install() {
    if (!deferred) return
    await deferred.prompt()
    await deferred.userChoice
    setDeferred(null)
    setDismissed(true)
    if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, '1')
  }

  if (dismissed) return null
  if (!deferred && !showIosTip) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 z-40 mx-auto max-w-sm rounded-xl bg-white border-2 border-[var(--rose-dark)]/40 shadow-lg px-4 py-3 flex items-center gap-3">
      <span className="text-2xl shrink-0" aria-hidden>📱</span>
      <div className="flex-1 min-w-0 text-sm text-[var(--text-primary)] leading-snug">
        {deferred ? (
          <>Add to your home screen for the best experience</>
        ) : (
          <>Tap <span className="font-semibold">Share → Add to Home Screen</span> for the best experience</>
        )}
      </div>
      {deferred && (
        <button
          type="button"
          onClick={install}
          className="shrink-0 px-3 h-8 rounded-full bg-[var(--rose-dark)] text-white text-xs font-bold hover:bg-[var(--rose-dark)]/90"
        >
          Install
        </button>
      )}
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss install prompt"
        className="shrink-0 text-[var(--text-muted)] hover:text-[var(--text-primary)] text-lg leading-none"
      >
        ✕
      </button>
    </div>
  )
}
