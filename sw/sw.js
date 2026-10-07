// Harvest Lane service worker. Generated into dist/sw.js at build time with the list of built files.
const VERSION = '__VERSION__';
const PRECACHE = __PRECACHE__;
const CACHE = 'harvest-lane-' + VERSION;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('harvest-lane-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);
  // The payment server (/api/) is always live.
  if (req.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
  // The store's info pages (terms, privacy, pricing...) come straight from the network.
  if (req.mode === 'navigate' && url.pathname !== '/' && url.pathname !== '/index.html') return;
  if (req.mode === 'navigate') {
    // Page loads: try the network for the newest version, fall back to the cached page offline.
    e.respondWith(
      fetch(req)
        .then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put('/', copy)); return res; })
        .catch(() => caches.match('/')),
    );
    return;
  }
  // Everything else is content-hashed or static: cache first.
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    })),
  );
});
