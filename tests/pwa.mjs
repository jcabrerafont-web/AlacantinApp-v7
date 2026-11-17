// Prueba del Service Worker: arranque con mala cobertura y actualización de versión.
// Uso: node tests/pwa.mjs   (sirve una copia de la app en un puerto propio)
//      (opcional) CHROME=/ruta/a/chrome  PLAYWRIGHT_MODULE=/ruta/a/playwright
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const raiz = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'alacantinapp-pwa-'));
for (const x of ['index.html', 'manifest.json', 'sw.js', 'css', 'js', 'icons', 'docs', 'fonts']) fs.cpSync(path.join(raiz, x), path.join(tmp, x), { recursive: true });
// Servidor propio con retraso regulable: simula la cobertura mala para TODAS las peticiones,
// también las que hace el Service Worker (las rutas de Playwright no las ven).
const PUERTO = 8831;
let retrasoMs = 0;
const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.pdf': 'application/pdf' };
const servidor = http.createServer(async (req, res) => {
  const ruta = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const archivo = path.join(tmp, ruta.endsWith('/') ? ruta + 'index.html' : ruta);
  if (retrasoMs && !ruta.endsWith('/sw.js')) await new Promise(r => setTimeout(r, retrasoMs));
  if (!archivo.startsWith(tmp) || !fs.existsSync(archivo) || fs.statSync(archivo).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(archivo)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
  fs.createReadStream(archivo).pipe(res);
}).listen(PUERTO, '127.0.0.1');
// Segundo origen que hace de Supabase Storage (fotos)
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
let fotosServidas = 0;
const storage = http.createServer((req, res) => {
  fotosServidas++;
  res.writeHead(200, { 'Content-Type': 'image/png', 'Access-Control-Allow-Origin': '*' });
  res.end(PNG);
}).listen(8832, '127.0.0.1');
const FOTO = 'http://127.0.0.1:8832/storage/v1/object/public/fotos-alacantina/u1/a1/lateral.png';
const base = `http://localhost:${PUERTO}`;

let fallos = 0;
const ok = (c, t) => { console.log(`${c ? '✓' : '✗'} ${t}`); if (!c) fallos++; };
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--no-sandbox', '--no-proxy-server'] });
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/, r => r.abort());
  const page = await ctx.newPage();
  const errores = [];
  page.on('pageerror', e => errores.push(e.message));
  const version = () => page.evaluate(async () => (await import('./js/config.js')).CONFIG.version);

  // 1. Primera visita: el SW se instala y guarda la versión
  await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#barra a');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller), null, { timeout: 10000 });
  const v1 = await version();
  const guardados = await page.evaluate(async () => (await (await caches.open((await caches.keys()).find(k => /^alacantinapp-7/.test(k)))).keys()).length);
  ok(guardados > 40, `Primera visita: versión ${v1} instalada y guardada en el móvil (${guardados} archivos)`);

  // 2. Cobertura muy mala (cada petición tarda 4 s): la app abre con la copia del móvil
  retrasoMs = 4000;
  const t0 = Date.now();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#barra a', { timeout: 20000 });
  const tArranque = Date.now() - t0;
  ok(tArranque < 2500, `Con cobertura muy mala (4 s por petición) la app abre en ${(tArranque / 1000).toFixed(1)} s, con la copia guardada`);
  retrasoMs = 0;

  // 3. Se publica una versión nueva: al abrir la app se aplica sola (no hay nada a medias)
  const nueva = (v) => {
    for (const f of ['sw.js', 'js/config.js']) {
      const p = path.join(tmp, f);
      fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace(/'7\.\d+\.\d+(-prueba\d)?'/, `'${v}'`));
    }
  };
  nueva('7.99.0-prueba1');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#barra a');
  let v2 = await version();
  for (let i = 0; i < 20 && v2 !== '7.99.0-prueba1'; i++) { await page.waitForTimeout(500); try { v2 = await version(); } catch { /* recargando */ } }
  ok(v2 === '7.99.0-prueba1', `Al abrir la app con una versión nueva publicada, se actualiza sola (${v1} → ${v2})`);

  // 4. Con la app ya en uso y un formulario a medias: no se recarga; aparece «Actualizar»
  await page.waitForTimeout(10500); // pasa el margen de arranque
  await page.evaluate(() => { location.hash = '#/estandar'; });
  await page.evaluate(() => { const f = document.createElement('form'); f.dataset.sucio = '1'; f.id = 'a-medias'; document.querySelector('main').appendChild(f); });
  nueva('7.99.0-prueba2');
  await page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
  await page.waitForSelector('#actualizacion', { timeout: 15000 });
  ok(await version() === '7.99.0-prueba1' && Boolean(await page.$('#a-medias')), 'En uso y con datos a medias: no recarga; muestra «Hay una versión nueva · Actualizar»');
  await page.evaluate(() => document.getElementById('a-medias').remove());
  await Promise.all([page.waitForEvent('load', { timeout: 15000 }), page.click('#actualizacion button')]);
  await page.waitForSelector('#barra a');
  ok(await version() === '7.99.0-prueba2', 'Al pulsar «Actualizar» se carga la versión nueva entera');
  const caches = await page.evaluate(async () => (await caches.keys()).filter(k => k.startsWith('alacantinapp-7')));
  ok(caches.length === 1 && caches[0].endsWith('7.99.0-prueba2'), `Solo queda la caché de la versión en uso (${caches.join(', ')})`);

  // 4b. Fotos del servidor: se guardan al verlas y se ven sin cobertura
  const cargarFoto = () => page.evaluate((src) => new Promise(r => { const i = new Image(); i.onload = () => r(true); i.onerror = () => r(false); i.src = `${src}`; }), FOTO);
  ok(await cargarFoto(), 'Foto del servidor vista con cobertura');
  await page.waitForTimeout(300);
  const enCache = await page.evaluate(async () => (await (await caches.open('alacantinapp-fotos')).keys()).length);

  // 5. Sin cobertura, tras actualizar
  await page.waitForTimeout(1500);
  await ctx.setOffline(true);
  await page.goto(base + '/#/estandar', { waitUntil: 'domcontentloaded' }).catch(() => page.waitForTimeout(500));
  await page.waitForSelector('#barra a', { timeout: 8000 });
  ok(await version() === '7.99.0-prueba2', 'Sin cobertura abre la versión actualizada');
  const servidasAntes = fotosServidas;
  ok(enCache === 1 && await cargarFoto(), `Sin cobertura se sigue viendo la foto guardada (en caché: ${enCache}; la caché de fotos no se borra al actualizar)`);
  ok(fotosServidas === servidasAntes, 'Sin cobertura la foto no se pide al servidor');
  ok(errores.length === 0, `Sin errores de página${errores.length ? ': ' + errores.join(' | ') : ''}`);
} finally {
  await browser.close();
  servidor.close();
  storage.close();
  fs.rmSync(tmp, { recursive: true, force: true });
}
console.log(fallos ? `\n${fallos} FALLO(S)` : '\nTODO CORRECTO');
process.exit(fallos ? 1 : 0);
