/**
 * Service Worker | Moneyball Cabinet | v2
 * Provides offline installability (Add to Home Screen).
 * Stale-while-revalidate for HTML (fixes dynamic import hash mismatch).
 * Cache-first for static assets (fonts, images).
 * Network-first for API calls.
 */

const CACHE_NAME = 'moneyball-v2'
const STATIC_ASSETS = [
  '/favicon.svg',
  '/assets/fonts/fonts.css',
  '/assets/fonts/PressStart2P-Latin.woff2',
  '/assets/fonts/VT323-Latin.woff2',
  '/assets/backgrounds/room_bg_v02_table_clock_pennant.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET and cross-origin
  if (request.method !== 'GET' || url.origin !== self.location.origin) return

  // API calls: network-first
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(() => caches.match(request))
    )
    return
  }

  // HTML navigation (index.html): network-first with cache fallback
  // This avoids stale index.html serving old JS chunk hashes
  if (request.mode === 'navigate' || url.pathname === '/') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
          return response
        })
        .catch(() => caches.match(request))
    )
    return
  }

  // JS/CSS bundles with content hash: cache-first (hash guarantees freshness)
  if (/\.[a-f0-9]{8,}\.(js|css)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached
        return fetch(request).then((response) => {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
          return response
        })
      })
    )
    return
  }

  // Other static assets: cache-first
  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request))
  )
})
