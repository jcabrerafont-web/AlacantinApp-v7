// ============================================================================
// AlacantinApp v7 · Service Worker
//  · Toda la app se precachea al instalar: funciona sin cobertura desde el
//    primer uso.
//  · Archivos propios: network-first con timeout (si hay red, siempre la
//    versión nueva; sin red o con red muy lenta, la copia en caché).
//  · Al publicar una versión nueva basta con cambiar VERSION: se purgan las
//    cachés antiguas y la app recarga sola (salvo formularios a medias).
//  · Supabase (datos, sesión, fotos) nunca se cachea: los datos offline
//    viven en IndexedDB.
// ============================================================================
const VERSION = '7.0.0';
const CACHE = `alacantinapp-${VERSION}`;
const CACHE_CDN = 'alacantinapp-cdn-1';
const TIMEOUT_MS = 3500;

const APP = [
  './', './index.html', './manifest.json', './css/app.css',
  './js/app.js', './js/auth.js', './js/config.js', './js/datos.js', './js/db.js', './js/documentos.js',
  './js/estandar.js', './js/genetica.js', './js/sync.js', './js/ui.js',
  './js/vistas/acceso.js', './js/vistas/alta.js', './js/vistas/apareamientos.js', './js/vistas/calificacion.js',
  './js/vistas/censo.js', './js/vistas/estandar.js', './js/vistas/ficha.js', './js/vistas/guia.js',
  './js/vistas/herramientas.js', './js/vistas/informes.js', './js/vistas/pedigri.js', './js/vistas/perfil.js',
  './js/vistas/puesta.js', './js/vistas/sincronizacion.js', './js/vistas/usuarios.js',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png', './icons/apple-touch-icon.png',
  './icons/logo.png', './docs/Estandar-Alacantina2025.pdf'
];
const CDN = ['https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js'];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(APP.map(u => new Request(u, { cache: 'reload' })));
    const cdn = await caches.open(CACHE_CDN);
    await Promise.allSettled(CDN.map(async u => { if (!(await cdn.match(u))) await cdn.add(u); }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE && k !== CACHE_CDN) await caches.delete(k);
    await self.clients.claim();
  })());
});

function conTimeout(promesa, ms) {
  return new Promise((ok, ko) => {
    const t = setTimeout(() => ko(new Error('timeout')), ms);
    promesa.then(v => { clearTimeout(t); ok(v); }, err => { clearTimeout(t); ko(err); });
  });
}

async function redPrimero(req, clave) {
  const c = await caches.open(CACHE);
  try {
    const res = await conTimeout(fetch(req, { cache: 'no-cache' }), TIMEOUT_MS);
    if (res.ok) await c.put(clave || req, res.clone());
    return res;
  } catch {
    return (await c.match(clave || req, { ignoreSearch: true })) ||
      (req.mode === 'navigate' ? await c.match('./index.html') : null) ||
      new Response('Sin conexión', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    e.respondWith(redPrimero(req, req.mode === 'navigate' ? './index.html' : undefined));
    return;
  }
  if (CDN.includes(url.href)) {
    // Librería con versión fijada en la URL: inmutable, caché primero
    e.respondWith(caches.open(CACHE_CDN).then(async c => (await c.match(req)) || fetch(req).then(res => {
      if (res.ok) c.put(req, res.clone());
      return res;
    })));
  }
  // Resto (Supabase, mapas…): sin intervención del SW
});
