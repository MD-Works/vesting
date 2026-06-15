/**
 * Vesting — by MD Works
 * sw.js — Cache-first service worker
 *
 * Strategy:
 *   Install  → cache all app shell files
 *   Fetch    → serve from cache first; update cache in background (stale-while-revalidate)
 *   Activate → delete old caches
 *   Offline  → full functionality (all data in IndexedDB, not network)
 */

const CACHE_NAME = 'vesting-v1'

const APP_SHELL = [
  '/',
  '/index.html',
  '/leads.html',
  '/lead-form.html',
  '/contacts.html',
  '/contact-form.html',
  '/properties.html',
  '/property-form.html',
  '/inspections.html',
  '/inspection-form.html',
  '/diary.html',
  '/settings.html',
  '/css/style.css',
  '/js/db.js',
  '/js/crypto.js',
  '/js/app.js',
  '/js/export.js',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
]

// ── Install: cache the app shell ────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  )
})

// ── Activate: clean up old caches ───────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  )
})

// ── Fetch: cache-first with background update ───────────────────────────────
self.addEventListener('fetch', event => {
  // Only handle GET requests for same-origin or Google Fonts
  const url = new URL(event.request.url)
  if (event.request.method !== 'GET') return
  if (url.origin !== location.origin &&
      !url.hostname.includes('fonts.googleapis.com') &&
      !url.hostname.includes('fonts.gstatic.com')) return

  event.respondWith(
    caches.open(CACHE_NAME).then(cache =>
      cache.match(event.request).then(cached => {
        // Fetch fresh copy in background (stale-while-revalidate)
        const fetchPromise = fetch(event.request)
          .then(response => {
            if (response && response.status === 200 && response.type !== 'opaque') {
              cache.put(event.request, response.clone())
            }
            return response
          })
          .catch(() => null)

        // Return cached immediately, or wait for network if nothing cached
        return cached || fetchPromise
      })
    )
  )
})
