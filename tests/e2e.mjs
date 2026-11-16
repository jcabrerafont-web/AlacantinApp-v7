// Prueba de extremo a extremo en Chrome (modo dispositivo, sin Supabase ni CDN)
// Uso: npm i -D playwright && npx playwright install chromium && node tests/e2e.mjs http://localhost:8820
//      (opcional) CHROME=/ruta/a/chrome para usar un navegador ya instalado
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.argv[2] || 'http://localhost:8820';
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--no-sandbox', '--no-proxy-server'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
await ctx.route(/^https?:\/\/(?!localhost)/, r => r.abort());
const page = await ctx.newPage();
const errores = [];
page.on('pageerror', e => errores.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_FAILED/.test(m.text())) errores.push(m.text()); });
let fallos = 0;
const ok = (cond, txt) => { console.log(`${cond ? '✓' : '✗'} ${txt}`); if (!cond) fallos++; };
const ir = async (hash) => { await page.evaluate(h => { location.hash = h; }, hash); await page.waitForTimeout(350); };
const barra = () => page.$$eval('#barra a', as => as.map(a => a.innerText.replace(/\s+/g, ' ').trim()));
const aviso = () => page.$eval('#aviso', e => e.textContent);

await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('#barra a');
// 1. Visitante
ok(JSON.stringify(await barra()) === JSON.stringify(['📖 Estándar Racial', '📋 Guía de Campo', '🔍 Censo Público']), `Visitante: barra de 3 columnas ${JSON.stringify(await barra())}`);
ok(page.url().endsWith('#/estandar'), 'Visitante aterriza en el Estándar');
ok((await page.$$eval('#barra a', a => a.length)) === 3 && !(await page.$('#barra a[href="#/alta"]')), 'Alta Rápida no existe en el DOM del visitante');
await ir('#/alta');
ok(page.url().endsWith('#/acceso'), 'Visitante que fuerza #/alta va a Acceso');
await ir('#/guia');
ok((await page.$$('#guia-lista details')).length === 12, 'Guía de campo: 12 regiones');

// 2. Registro y Mi aviario
await ir('#/acceso');
await page.click('[data-tab="registro"]');
await page.fill('#r-nombre', 'Criadora <b>Prueba</b>');
await page.fill('#r-email', 'criadora@ejemplo.es');
await page.fill('#r-pass', 'clave-segura-1');
await page.click('#form-registro button[type=submit]');
await page.waitForTimeout(1200);
ok(page.url().endsWith('#/perfil'), 'Tras registrarse va a Mi aviario');
ok(await page.$eval('#estado-cola', e => e.classList.contains('oculto')), 'Modo dispositivo: sin contador de cola');
ok(JSON.stringify(await barra()) === JSON.stringify(['📚 Mi Censo', '➕ Alta Rápida', '🥚 Puesta & RFID', '🧰 Herramientas']), 'Usuario: barra de 4 columnas');
await page.fill('#pf-rega', 'ES030140001234');
await page.fill('#pf-mun', 'Elche');
await page.fill('#pf-prov', 'Alicante');
await page.click('#form-perfil button[type=submit]');
await page.waitForTimeout(600);
ok((await aviso()).includes('Criador'), `REGA válido promociona a Criador (${await aviso()})`);
const credEnClaro = await page.evaluate(async () => {
  const db = await import('./js/db.js');
  return JSON.stringify(await db.todos('perfiles')).includes('clave-segura-1') || JSON.stringify(await db.todos('meta')).includes('clave-segura-1');
});
ok(!credEnClaro, 'La contraseña no se guarda en claro');

// 3. Altas
const alta = async ({ anilla, sexo, variedad, fecha, padre, madre, nombre, peso }) => {
  await ir('#/alta');
  await page.fill('#a-anilla', anilla);
  await page.selectOption('#a-sexo', sexo);
  await page.selectOption('#a-variedad', variedad);
  await page.fill('#a-fecha', fecha);
  if (padre) await page.selectOption('#a-padre', { label: padre });
  if (madre) await page.selectOption('#a-madre', { label: madre });
  if (nombre || peso) { await page.click('#form-alta details summary'); }
  if (nombre) await page.fill('#a-nombre', nombre);
  if (peso) await page.fill('#a-peso', String(peso));
  await page.click('#form-alta button[type=submit]');
  await page.waitForTimeout(700);
};
await alta({ anilla: 'e 0001', sexo: 'M', variedad: 'negra-moteada', fecha: '2024-01-10', peso: 3200 });
ok(page.url().includes('#/animal/'), 'Alta del gallo E 0001 → ficha');
await alta({ anilla: 'E 0002', sexo: 'H', variedad: 'negra-moteada', fecha: '2024-02-01', nombre: '<img src=x onerror="window.__xss=1">' });
await alta({ anilla: 'E 0003', sexo: 'H', variedad: 'blanca', fecha: '2025-03-01', padre: 'E 0001', madre: 'E 0002 · <img src=x onerror="window.__xss=1">' });
const fichaHija = await page.evaluate(() => ({ url: location.hash, texto: document.querySelector('main').innerText }));
ok(fichaHija.texto.includes('E 0003') && /consanguinidad/i.test(fichaHija.texto), `Ficha de la hija con padres y consanguinidad (${fichaHija.url} · ${(await aviso()).slice(0, 80)})`);
await alta({ anilla: 'E 0002', sexo: 'H', variedad: 'blanca', fecha: '2025-01-01' });
ok((await aviso()).includes('ya está registrada'), 'Anilla duplicada rechazada');
await alta({ anilla: 'E 0009', sexo: 'M', variedad: 'blanca', fecha: '2023-01-01', padre: 'E 0001' });
ok((await aviso()).includes('anterior'), `Padre más joven que el hijo rechazado (${(await aviso()).slice(0, 60)})`);
await ir('#/censo');
ok((await page.$$('#censo-lista a.item')).length === 3, 'Mi censo: 3 ejemplares');
ok((await page.evaluate(() => window.__xss)) === undefined, 'XSS en nombre neutralizado');
const herenciaRega = await page.evaluate(async () => (await (await import('./js/db.js')).todos('animales')).every(a => a.rega === 'ES030140001234' && a.municipio === 'Elche'));
ok(herenciaRega, 'Las altas heredan REGA y municipio del aviario');

// 4. Puesta
await ir('#/puesta');
await page.selectOption('#pu-gallina', { label: 'E 0002 · <img src=x onerror="window.__xss=1">' });
for (const g of ['61,5', '72', '58']) { await page.fill('#pu-peso', g); await page.press('#pu-peso', 'Enter'); }
await page.click('#pu-guardar');
await page.waitForTimeout(600);
ok((await aviso()).includes('3 huevo(s) guardados · 2 aptos'), `Puesta individual (${await aviso()})`);
const huevoGallo = await page.evaluate(async () => {
  const d = await import('./js/datos.js');
  const g = d.estado.todos.find(a => a.anilla === 'E 0001');
  try { await d.registrarHuevos(g.id, '2026-01-01', [60], 'Blanco crema'); return 'aceptado'; } catch (e) { return e.message; }
});
ok(huevoGallo.includes('solo para gallinas'), 'Huevo asignado a un gallo rechazado');

// 5. Informes y exportación
await ir('#/informes');
ok((await page.innerText('main')).includes('Ne demográfico'), 'Informe con Ne y censo por edad');
const [descarga] = await Promise.all([page.waitForEvent('download'), page.click('#x-pedigri')]);
const ruta = await descarga.path();
const contenido = (await import('node:fs')).readFileSync(ruta, 'utf8');
const lineas = contenido.trim().split(/\r?\n/);
ok(lineas.length === 4 && lineas.findIndex(l => l.startsWith('E 0003')) > lineas.findIndex(l => l.startsWith('E 0001')), 'Matriz de pedigrí CSV ordenada (progenitores primero)');

// 6. Inspector (rol asignado por el servidor; aquí se simula en la copia local)
await page.evaluate(async () => {
  const db = await import('./js/db.js');
  const id = await db.metaGet('sesion');
  const p = await db.obtener('perfiles', id);
  await db.guardar('perfiles', { ...p, rol: 'inspector' });
});
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForSelector('#barra a');
const idH1 = await page.evaluate(async () => (await import('./js/datos.js')).estado.todos.find(a => a.anilla === 'E 0002').id);
await ir(`#/calificar/${idH1}`);
ok((await page.$$('#form-cal [data-apartado]')).length === 13, 'Baremo: 13 apartados');
await page.click('#form-cal button[type=submit]');
ok((await aviso()).includes('Faltan 13'), `Calificación incompleta bloqueada (${await aviso()})`);
await page.click('#todo-max');
ok((await page.textContent('#c-total')) === '100' && (await page.textContent('#c-clase')).includes('EX'), 'Máximo en todo: 100 · EX');
// Descontar: plumaje 15 -> 12, cola 10 -> 8,5
for (let i = 0; i < 6; i++) await page.click('[data-apartado="plumaje"] button[data-paso="-1"]');
await page.fill('[name="p-cola"]', '8,5');
await page.dispatchEvent('[name="p-cola"]', 'input');
ok((await page.textContent('#c-total')) === '95,5', `Total con descuentos y coma decimal (${await page.textContent('#c-total')})`);
if (process.env.CAPTURAS) { await page.screenshot({ path: `${process.env.CAPTURAS}/calificacion-arriba.png` }); await page.$eval('[data-apartado="tronco"]', e => e.scrollIntoView()); await page.screenshot({ path: `${process.env.CAPTURAS}/calificacion-medio.png` }); }
await page.fill('[name="p-ojos"]', '4');
await page.dispatchEvent('[name="p-ojos"]', 'input');
ok(await page.$eval('[data-apartado="ojos"]', e => e.classList.contains('invalido')), 'Puntuación por encima del máximo marcada');
await page.fill('[name="p-ojos"]', '3');
await page.dispatchEvent('[name="p-ojos"]', 'input');
await page.fill('#c-peso', '2400');
await page.evaluate(() => { window.print = () => { window.__impreso = true; }; });
await page.click('#form-cal button[type=submit]');
await page.click('dialog button[value="si"]');
await page.waitForTimeout(800);
const sec = await page.evaluate(async id => (await import('./js/datos.js')).animal(id).seccion, idH1);
ok(sec === 'RD', `Calificación EX (Apto) promociona RN → RD (${sec})`);
ok(await page.evaluate(() => window.__impreso === true && document.querySelector('#impresion').innerText.includes('95,5')), 'Acta con desglose de puntos generada');
const conDefecto = await page.evaluate(async id => {
  const d = await import('./js/datos.js');
  const { BAREMO } = await import('./js/estandar.js');
  const puntos = Object.fromEntries(BAREMO.apartados.map(x => [x.id, x.max]));
  const c = await d.guardarCalificacion({ animalId: id, puntos, defectos: ['orejilla'] });
  return `${c.total}/${c.clase}/${c.resultado}`;
}, idH1);
ok(conDefecto === '100/D/No apto', `Defecto descalificante: descalificado aunque sume 100 (${conDefecto})`);

// 7. Sincronización con servidor simulado: un error no borra la operación
const res = await page.evaluate(async () => {
  const sync = await import('./js/sync.js');
  let llamadas = 0;
  const fake = {
    auth: { getSession: async () => ({ data: { session: { user: {} } } }) },
    storage: { from: () => ({ upload: async () => ({ error: null }), getPublicUrl: () => ({ data: { publicUrl: 'https://x.supabase.co/f.webp' } }) }) },
    from: () => ({ upsert: async () => (++llamadas === 1 ? { error: { message: 'fallo simulado' } } : { error: null }), delete: () => ({ eq: async () => ({ error: null }) }) })
  };
  sync.usarCliente(fake);
  // En modo dispositivo no se encola nada: se insertan operaciones como lo haría encolar() con servidor
  const db = await import('./js/db.js');
  for (const a of (await db.todos('animales')).slice(0, 3)) {
    await db.guardar('cola', { tabla: 'animales', op: 'upsert', id: a.id, registro: a, creado: Date.now(), intentos: 0, error: null });
  }
  const antes = await sync.pendientes();
  const r1 = await sync.drenar();
  const tras1 = await sync.pendientes();
  const cola = await sync.listarCola();
  const r2 = await sync.drenar();
  const tras2 = await sync.pendientes();
  sync.usarCliente(null);
  return { antes, r1, tras1, errorGuardado: cola.find(i => i.error)?.error, r2, tras2 };
});
ok(res.antes > 0 && res.tras1 === 1 && res.errorGuardado === 'fallo simulado' && res.tras2 === 0,
  `Cola: ${res.antes} pendientes → 1 retenida con error tras el fallo → 0 al reintentar`);

// 8. Offline tras la primera visita (Service Worker)
await page.waitForTimeout(1500);
await ctx.setOffline(true);
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForSelector('#barra a', { timeout: 8000 });
await ir('#/censo');
ok((await page.$$('#censo-lista a.item')).length === 3, 'Sin cobertura: la app abre y el censo sigue disponible');
ok((await page.innerText('#estado-red')).includes('Sin cobertura'), 'Indicador de cobertura');
await ctx.setOffline(false);

// 9. Cierre de sesión → visitante sin datos personales
await page.evaluate(async () => (await import('./js/app.js')).cerrarSesion());
await page.waitForTimeout(400);
ok((await barra()).length === 3, 'Al cerrar sesión vuelve la barra de visitante');
await ir('#/censo');
const publico = await page.evaluate(async () => (await import('./js/datos.js')).censo().some(a => 'rega' in a || 'latitud' in a || 'usuario_id' in a));
ok(!publico, 'Censo público sin REGA, coordenadas ni titular');

ok(errores.length === 0, `Sin errores de consola${errores.length ? ': ' + errores.join(' | ') : ''}`);
await browser.close();
console.log(fallos ? `\n${fallos} FALLO(S)` : '\nTODO CORRECTO');
process.exit(fallos ? 1 : 0);
