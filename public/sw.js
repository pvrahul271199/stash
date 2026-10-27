/* Stash service worker.
 * `scripts/build-sw.mjs` replaces __VERSION__ and the precache list after `next build`.
 * - Precaches the whole static export (HTML, JS, CSS, self-hosted fonts, icons).
 * - Navigations: network-first, falling back to the cached page / app shell.
 * - Static assets: cache-first.
 * - A new worker waits until the app asks it to take over (the "Reload" toast). */
const VERSION = '__VERSION__';
const CACHE = 'stash-' + VERSION;
const PRECACHE = /*__PRECACHE__*/ [];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)));
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('stash-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const fresh = await fetch(request);
    if (fresh.ok) cache.put(request, fresh.clone());
    return fresh;
  } catch (err) {
    const hit = (await cache.match(request, { ignoreSearch: true })) || (await cache.match('/'));
    if (hit) return hit;
    throw err;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const fresh = await fetch(request);
  if (fresh.ok) cache.put(request, fresh.clone());
  return fresh;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname === '/sw.js') return;
  if (req.mode === 'navigate') event.respondWith(networkFirst(req));
  else event.respondWith(cacheFirst(req));
});
