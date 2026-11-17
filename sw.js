// ============================================================================
// AlacantinApp v7 · Service Worker
//  · Toda la versión se guarda en el móvil al instalarla: funciona sin cobertura
//    desde el primer uso.
//  · Archivos de la app: primero la copia guardada de ESTA versión. La app abre al
//    instante aunque la cobertura sea mala (antes se esperaba a la red hasta 3,5 s
//    por archivo).
//  · Versión nueva: el navegador descarga sw.js al abrir la app (y la app lo
//    comprueba cada hora y al volver a ella). La versión nueva se descarga entera
//    en segundo plano y ESPERA: la app la activa al arrancar o cuando el usuario
//    pulsa «Actualizar», nunca con un formulario a medias. Así no se mezclan
//    archivos de dos versiones.
//  · Supabase (datos, sesión, fotos) nunca se cachea: los datos viven en IndexedDB.
// ============================================================================
const VERSION = '7.10.0';
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
  './js/vistas/programa.js', './js/vistas/campanas.js', './js/vistas/campana.js', './js/vistas/dossier.js', './js/vistas/copia.js', './js/respaldo.js', './js/instalacion.js', './js/vistas/reproduccion.js', './js/vistas/incubacion.js', './js/vistas/inspeccion.js', './js/vistas/inspecciones.js', './js/vistas/auditoria.js', './js/vistas/acta.js',
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
    // Sin skipWaiting: la versión nueva espera a que la app la active (mensaje «activar»)
  })());
});

self.addEventListener('message', (e) => {
  if (e.data?.tipo === 'activar') self.skipWaiting();
  if (e.data?.tipo === 'version') e.source?.postMessage({ tipo: 'version', version: VERSION });
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

// Archivos de la versión: copia guardada primero; si faltara alguno, red (y se guarda)
async function cachePrimero(req, clave) {
  const c = await caches.open(CACHE);
  const guardado = await c.match(clave || req, { ignoreSearch: true });
  if (guardado) return guardado;
  return redPrimero(req, clave);
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
    // sw.js nunca pasa por aquí (el navegador lo pide directamente). El resto, de la caché de la versión.
    e.respondWith(cachePrimero(req, req.mode === 'navigate' ? './index.html' : undefined));
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
