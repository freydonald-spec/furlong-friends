'use client'

import { useEffect } from 'react'

/**
 * Registers the service worker on the client. Mounted once from the root
 * layout — renders nothing. Defers registration until window load so it
 * doesn't compete with first-paint resources.
 */
export function RegisterSW() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return
    const onLoad = () => {
      navigator.serviceWorker.register('/sw.js').catch(err => {
        // eslint-disable-next-line no-console
        console.warn('[sw] registration failed', err)
      })
    }
    if (document.readyState === 'complete') {
      onLoad()
    } else {
      window.addEventListener('load', onLoad)
      return () => window.removeEventListener('load', onLoad)
    }
  }, [])
  return null
}
