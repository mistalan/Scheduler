const CACHE_NAME = 'scheduler-shell-v2';
const ASSETS = [
  '/',
  '/index.html',
  '/patient.html',
  '/admin.html',
  '/styles.css',
  '/patient.js',
  '/admin.js',
  '/manifest.webmanifest',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }

  const url = new URL(event.request.url);

  // API and SSE requests always go to the network — never serve stale data.
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // App shell: cache-first for fast offline startup.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        return cached;
      }

      return fetch(event.request);
    }),
  );
});
