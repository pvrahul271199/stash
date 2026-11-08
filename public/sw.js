/* Chelav service worker.
 * `scripts/build-sw.mjs` replaces __VERSION__ and the precache list after `next build`.
 * - Precaches the whole static export (HTML, JS, CSS, self-hosted fonts, icons).
 * - Navigations: cache-first. The precached page always matches the precached JS of this version, and it
 *   opens instantly on a slow or flaky network (network-first made the app shell hang for 10-30 s on 3G).
 *   New versions arrive through the worker update + "Reload" toast, not by re-fetching pages here.
 * - Static assets: cache-first.
 * - A new worker waits until the app asks it to take over (the "Reload" toast). */
const VERSION = '__VERSION__';
const CACHE = 'stash-' + VERSION;
const PRECACHE = /*__PRECACHE__*/ [];

/* Precache one asset at a time: cache.addAll() rejects the whole install if any single request fails,
 * and on a flaky connection that left some users without a worker at all. Only the app shell ('/') must
 * succeed; anything else that failed is fetched and cached the first time it is used. */
async function precache() {
  const cache = await caches.open(CACHE);
  const results = await Promise.allSettled(
    PRECACHE.map(async (url) => {
      const res = await fetch(url, { cache: 'reload' });
      if (!res.ok) throw new Error(url + ' ' + res.status);
      await cache.put(url, res);
    }),
  );
  const shell = PRECACHE.indexOf('/');
  if (shell !== -1 && results[shell].status === 'rejected') throw results[shell].reason;
}

self.addEventListener('install', (event) => {
  event.waitUntil(precache());
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

async function pageFirst(request) {
  const cache = await caches.open(CACHE);
  const hit = (await cache.match(request, { ignoreSearch: true })) || (await cache.match('/'));
  if (hit) return hit;
  const fresh = await fetch(request);
  if (fresh.ok) cache.put(request, fresh.clone());
  return fresh;
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
  if (req.mode === 'navigate') event.respondWith(pageFirst(req));
  else event.respondWith(cacheFirst(req));
});
