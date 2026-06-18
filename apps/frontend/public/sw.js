/**
 * Service Worker | Moneyball Cabinet
 * Provides offline installability (Add to Home Screen) and caches
 * critical static assets. Network-first for API, cache-first for assets.
 */

const CACHE_NAME = 'moneyball-v1'
const STATIC_ASSETS = [
  '/',
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

  // Static assets: cache-first
  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request))
  )
})
