// Guarda la app en el móvil para que abra sin cobertura
const CACHE = 'pcbinv-v3';
const SHELL = ['./', './index.html', './support.js', './manifest.webmanifest', './apps-script.gs',
  './_ds/industry-ebf0d374-a771-42d1-a95c-91d2700af12e/styles.css',
  './_ds/industry-ebf0d374-a771-42d1-a95c-91d2700af12e/_ds_bundle.js',
  'https://unpkg.com/@zxing/library@0.21.3/umd/index.min.js',
  'https://fastly.jsdelivr.net/npm/barcode-detector@3/dist/iife/index.min.js'];
self.addEventListener('install', e => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => {}))))); });
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || req.url.includes('script.google.com') || req.url.includes('googleusercontent.com')) return;
  e.respondWith(caches.open(CACHE).then(async c => {
    const hit = await c.match(req, { ignoreSearch: true });
    const net = fetch(req).then(r => { if (r && (r.ok || r.type === 'opaque')) c.put(req, r.clone()); return r; }).catch(() => hit);
    return hit || net;
  }));
});
