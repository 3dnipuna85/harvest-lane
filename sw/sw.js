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

// Farm alerts (server/notify.ts). Pushes arrive empty; ask the server what this one was about.
self.addEventListener('push', e => {
  e.waitUntil((async () => {
    let m = { title: 'Harvest Lane', body: 'Your farm needs you! 🌾' };
    try {
      const sub = await self.registration.pushManager.getSubscription();
      const r = await fetch('/api/notify/msg', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ endpoint: sub ? sub.endpoint : '' }) });
      if (r.ok) m = await r.json();
    } catch { /* keep the general message */ }
    await self.registration.showNotification(m.title, { body: m.body, icon: '/icons/icon-192.png', badge: '/icons/icon-192.png', tag: 'farm-alert', data: { url: '/' } });
  })());
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    const open = list.find(c => new URL(c.url).origin === location.origin);
    return open ? open.focus() : self.clients.openWindow('/');
  }));
});
