// Furlong & Friends — basic offline-first service worker.
// Caches the app shell on install so a returning player gets a fast first
// paint and a polite "you're offline" page when there's no network and no
// cached response. Bump CACHE_NAME on a new release to force a refresh.

const CACHE_NAME = 'furlong-v1'

// Routes worth pre-warming so the app launches instantly from the home screen.
// These are document HTML responses; Next.js serves the page shells fine here.
const APP_SHELL = ['/', '/picks', '/track', '/leaderboard', '/join']

const OFFLINE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Furlong &amp; Friends — Offline</title>
  <style>
    body {
      margin: 0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #F8F9FA;
      color: #1A1A2E;
      padding: 24px;
    }
    .card {
      max-width: 360px;
      text-align: center;
    }
    .emoji { font-size: 48px; }
    h1 { margin: 12px 0 8px; font-size: 20px; }
    p { margin: 0; color: #6B7280; font-size: 14px; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="card">
    <div class="emoji">🏇</div>
    <h1>You're offline</h1>
    <p>Check your connection and reload the page.</p>
  </div>
</body>
</html>`

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME)
    // Pre-cache best-effort — failures on individual routes shouldn't block install.
    await Promise.all(APP_SHELL.map(async (url) => {
      try {
        await cache.add(url)
      } catch (e) {
        console.warn('[sw] could not pre-cache', url, e)
      }
    }))
    await self.skipWaiting()
  })())
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // Drop any older caches so a version bump replaces stale content.
    const names = await caches.keys()
    await Promise.all(names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n)))
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  // Only handle GETs — leave Supabase POST/PATCH/DELETE alone.
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  // Skip cross-origin requests (Supabase, fonts, analytics, etc.).
  if (url.origin !== self.location.origin) return

  event.respondWith((async () => {
    try {
      const networkResponse = await fetch(request)
      // Cache successful HTML/static responses opportunistically.
      if (networkResponse.ok && (request.destination === 'document' || request.destination === 'script' || request.destination === 'style' || request.destination === 'image')) {
        const cache = await caches.open(CACHE_NAME)
        cache.put(request, networkResponse.clone()).catch(() => {})
      }
      return networkResponse
    } catch {
      const cached = await caches.match(request)
      if (cached) return cached
      // Fall back to offline shell for navigation requests.
      if (request.mode === 'navigate' || request.destination === 'document') {
        return new Response(OFFLINE_HTML, {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        })
      }
      return new Response('', { status: 503, statusText: 'Offline' })
    }
  })())
})
