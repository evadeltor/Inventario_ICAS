// Red primero para la app (siempre la última versión si hay cobertura); caché si no hay red
const CACHE = 'pcbinv-v7';
const CDN = ['unpkg.com', 'jsdelivr.net', 'cdn.sheetjs.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];
const SHELL = ['./', './index.html', './support.js', './manifest.webmanifest', './apps-script.gs',
  './_ds/industry-ebf0d374-a771-42d1-a95c-91d2700af12e/styles.css',
  './_ds/industry-ebf0d374-a771-42d1-a95c-91d2700af12e/_ds_bundle.js'];
self.addEventListener('install', e => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => {}))))); });
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || req.url.includes('script.google.com') || req.url.includes('googleusercontent.com')) return;
  const isCdn = CDN.some(h => new URL(req.url).hostname.endsWith(h));
  e.respondWith(caches.open(CACHE).then(async c => {
    if (isCdn) {
      const hit = await c.match(req);
      if (hit) return hit;
      const r = await fetch(req); if (r && (r.ok || r.type === 'opaque')) c.put(req, r.clone()); return r;
    }
    try {
      const r = await fetch(req, { cache: 'no-cache' });
      if (r && r.ok) c.put(req, r.clone());
      return r;
    } catch (err) {
      return (await c.match(req, { ignoreSearch: true })) || (req.mode === 'navigate' ? c.match('./index.html') : Response.error());
    }
  }));
});
