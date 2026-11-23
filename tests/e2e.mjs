import fs from 'node:fs';
// Prueba de extremo a extremo en Chrome (modo dispositivo, sin Supabase ni CDN)
// Uso: npm i -D playwright && npx playwright install chromium && node tests/e2e.mjs http://localhost:8820
//      (opcional) CHROME=/ruta/a/chrome para usar un navegador ya instalado
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.argv[2] || 'http://localhost:8820';
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--no-sandbox', '--no-proxy-server', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true, permissions: ['camera', 'geolocation'], geolocation: { latitude: 38.6489, longitude: 0.0447, accuracy: 12 } });
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
const GRUPO_TES = { inicio: 'inicio', movimientos: 'dia', cuotas: 'dia', socios: 'socios', importar: 'socios', cuentas: 'informes', presupuesto: 'informes', partidas: 'ajustes', sepa: 'ajustes', seguridad: 'ajustes' };
const irTes = async (p) => {
  await page.click(`[data-grupo=${GRUPO_TES[p]}]`);
  await page.waitForSelector(`[data-grupo=${GRUPO_TES[p]}][aria-selected=true]`);
  if (p !== GRUPO_TES[p] || p === 'socios') { await page.waitForSelector(`[data-pestana=${p}]`).catch(() => {}); if (!(await page.$(`[data-pestana=${p}][aria-selected=true]`))) await page.click(`[data-pestana=${p}]`); }
  await page.waitForSelector(`[data-pestana=${p}][aria-selected=true], [data-grupo=inicio][aria-selected=true]`);
  await page.waitForTimeout(150);
};
const tesSocios = () => page.evaluate(async () => (await import('./js/tesoreria.js')).socios().length);

await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('#barra a');
// 1. Visitante
ok((await page.$$eval('#barra a svg.icono', x => x.length)) === 3, 'Barra con iconos propios (sin emoji)');
ok(JSON.stringify(await barra()) === JSON.stringify(['Estándar Racial', 'Guía de Campo', 'Censo Público']), `Visitante: barra de 3 columnas ${JSON.stringify(await barra())}`);
ok(page.url().endsWith('#/estandar'), 'Visitante aterriza en el Estándar');
{ const t = await page.$eval('main', m => m.textContent);
  ok((await page.$$('main .rasgos li')).length === 6 && t.includes('40º') && t.includes('70º') && (await page.$$('main .accesos a')).length === 3,
    'Estándar: rasgos clave (dorso 40º, cola 70º…) y accesos a Guía, Censo y PDF'); }
ok(!(await page.$('#historia')) && !(await page.$('#club')) && Boolean(await page.$('main .accesos a[href="#/conoce"]')) && Boolean(await page.$('main .accesos a[href="#/programa"]')),
  'Estándar: solo el Estándar; arriba, accesos a «La Alacantina y su Club», Guía del criador y PDF (no repite la barra)');
ok(Boolean(await page.$('main a[href="#/conoce?s=variedades"]')), 'Estándar: enlace «Plumaje y pollitos de cada variedad»');
await ir('#/conoce');
ok(await page.$eval('#historia', d => !d.open && d.querySelectorAll('h3').length === 4 && d.textContent.includes('18 de diciembre de 2020') && d.textContent.includes('8 de marzo de 2025')),
  'La Alacantina y su Club: «Historia de la raza» con sus cuatro etapas');
ok(await page.$eval('#club', d => d.querySelectorAll('h3').length === 5 && d.textContent.includes('nadie cría solo') && Boolean(d.querySelector('a[href="https://www.clubalacantina.com/"]')) && Boolean(d.querySelector('a[href*="youtube.com/channel/"]')) && Boolean(d.querySelector('a[href^="mailto:clubalacantina@gmail.com"]'))),
  'La Alacantina y su Club: «El Club» con qué es, fines, criar en común, por qué asociarse, correo, web y YouTube');
ok(await page.$eval('#libro', d => d.querySelectorAll('h3').length === 5 && d.textContent.includes('Real Decreto 45/2019') && d.textContent.includes('todavía no figura en el Catálogo Oficial') && Boolean(d.querySelector('a[href="#/programa?s=normativa"]'))),
  'La Alacantina y su Club: «El Libro Genealógico» con qué es, para qué sirve, registros, normas y dónde estamos');
ok(await page.$eval('#empezar', d => d.querySelectorAll('ol.pasos li').length === 7 && d.textContent.includes('REGA')) && await page.$eval('main', m => m.querySelector('details')?.id === 'empezar'),
  'La Alacantina y su Club: «Cómo empezar a criar», el primero, con 7 pasos (REGA incluido)');
ok(await page.$eval('#variedades', d => d.querySelectorAll('li.item').length === 5 && d.textContent.includes('mitad y mitad') && d.textContent.includes('oscuro bajo lo negro y blanco bajo lo blanco') && d.textContent.includes('El subplumón es negro') && d.textContent.includes('subplumón es de color crema') && d.textContent.includes('no forma parte del texto del Estándar')),
  'La Alacantina y su Club: «Las variedades» con el plumaje y los pollitos de las 5, señalado como descripción del Club');
ok(await page.$eval('#glosario', d => d.querySelectorAll('dt').length === 16 && d.textContent.includes('al menos 65 puntos (gallinas) o 70 (gallos)')),
  'La Alacantina y su Club: glosario de 16 términos, con las cifras de la app');
ok(await page.$eval('#sanidad', d => d.querySelectorAll('h3').length === 7 && d.textContent.includes('Real Decreto 637/2021') && d.textContent.includes('veterinario de referencia')
    && !/Orden APA|Resolución de|20\d\d-20\d\d|de 202\d/.test(d.textContent) && Boolean(d.querySelector('a[href^="https://www.boe.es/eli/es/rd/2021/07/27/637"]')) && Boolean(d.querySelector('a[href*="influenza-aviar"]')))
  && await page.$eval('#empezar', d => Boolean(d.querySelector('a[href="#/conoce?s=sanidad"]'))),
  'La Alacantina y su Club: «Obligaciones sanitarias» atemporal (sin órdenes ni fechas de temporada), con las fuentes oficiales');
await ir('#/conoce?s=libro');
ok(await page.$eval('#libro', d => d.open), 'La Alacantina y su Club: enlace directo a un apartado (?s=libro) lo abre');
await ir('#/estandar');
ok((await page.$$eval('#barra a', a => a.length)) === 3 && !(await page.$('#barra a[href="#/alta"]')), 'Alta Rápida no existe en el DOM del visitante');
await ir('#/alta');
ok(page.url().endsWith('#/acceso'), 'Visitante que fuerza #/alta va a Acceso');
await ir('#/guia');
ok((await page.$$('#guia-lista details')).length === 12, 'Guía de campo: 12 regiones');
await ir('#/programa');
ok((await page.$$('details.guia-sec')).length === 7 && (await page.innerText('main')).includes('Control de puesta'), 'Visitante: Guía del criador con 7 secciones');
ok(await page.$eval('#sec-normativa', e => e.textContent.includes('Real Decreto 45/2019') && e.querySelectorAll('.lista-normas li').length >= 20), 'Guía: apartado de normativa con requisitos y tareas del Club');
if (process.env.CAPTURAS) { await ir('#/programa?s=normativa'); await page.waitForTimeout(300); await page.screenshot({ path: `${process.env.CAPTURAS}/guia-normativa.png` }); }
ok((await page.innerText('#sec-puesta')).length > 0 && await page.$eval('#sec-puesta', e => e.textContent.includes('masa de huevo')), 'Guía explica los tres criterios de puesta');
await ir('#/programa?s=puesta');
ok(await page.$eval('#sec-puesta', e => e.open), 'Guía: enlace directo a la sección de puesta');
if (process.env.CAPTURAS) { await page.waitForTimeout(200); await page.screenshot({ path: `${process.env.CAPTURAS}/guia-puesta.png` }); }

// 2. Registro y Mi aviario
await ir('#/acceso');
await page.click('[data-tab="registro"]');
await page.fill('#r-nombre', 'Criadora <b>Prueba</b>');
await page.fill('#r-email', 'criadora@ejemplo.es');
await page.fill('#r-pass', 'clave-segura-1');
const capa = await page.$eval('#form-registro .info-basica', t => t.textContent.replace(/\s+/g, ' '));
ok(['Responsable', 'Finalidad', 'Legitimación', 'Destinatarios', 'Derechos', 'clubalacantina@gmail.com'].every(x => capa.includes(x)), 'Registro: información básica de protección de datos (responsable, finalidad, legitimación, destinatarios, derechos)');
await page.click('#form-registro button[type=submit]');
await page.waitForTimeout(400);
ok(page.url().endsWith('#/acceso') && (await aviso()).includes('14 años'), 'Sin marcar «14 años y he leído la información» no se crea la cuenta');
await page.check('#r-acepto');
await page.click('#form-registro button[type=submit]');
await page.waitForTimeout(1200);
ok(page.url().endsWith('#/perfil'), 'Tras registrarse va a Mi aviario');
ok(await page.isVisible('#pf-rega-como a[href="#/conoce?s=empezar"]'), 'Mi aviario: sin REGA, enlace «¿No tienes REGA? Cómo se pide»');
await page.click('#pf-capturar');
ok((await page.innerText('dialog[open]')).includes('¿Estás ahora en tu aviario?'), 'Ubicación: antes de tomarla pregunta si estás en el aviario');
await page.click('dialog[open] button[value=no]'); await page.waitForTimeout(200);
ok((await page.innerText('#pf-gps')).includes('Sin ubicación'), 'Ubicación: si no estás en el aviario, no se toma');
await page.click('#pf-capturar'); await page.click('dialog[open] button[value=si]');
await page.waitForFunction(() => document.querySelector('#pf-gps a[href*="openstreetmap.org"]'), null, { timeout: 5000 });
ok((await page.innerText('#pf-gps')).includes('±12 m'), 'Ubicación: tomada en el aviario, con su precisión y enlace para comprobarla en el mapa');
await page.click('#pf-borrar-gps'); await page.waitForTimeout(400);
ok(await page.$eval('#estado-cola', e => e.classList.contains('oculto')), 'Modo dispositivo: sin contador de cola');
ok(JSON.stringify(await barra()) === JSON.stringify(['Mi Censo', 'Alta Rápida', 'Puesta & RFID', 'Herramientas']), 'Usuario: barra de 4 columnas');
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
const alta = async ({ num, diam, sexo, variedad, fecha, padre, madre, nombre, peso }) => {
  await ir('#/censo'); await ir('#/alta'); // formulario limpio aunque el alta anterior fallara
  await page.fill('#a-num', num);
  await page.click(`#form-alta label[data-sexo="${sexo}"]`);
  if (diam) await page.selectOption('#a-diam', diam);
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
await alta({ num: '1', sexo: 'M', variedad: 'negra-moteada', fecha: '2024-01-10', peso: 3200 });
ok(page.url().includes('#/animal/') && (await page.innerText('main')).includes('E2420000001'), 'Alta del gallo nº 1 → código E2420000001 (E + 24 + 20 mm + 000001)');
await alta({ num: '2', sexo: 'H', variedad: 'negra-moteada', fecha: '2024-02-01', nombre: '<img src=x onerror="window.__xss=1">' });
await alta({ num: '3', sexo: 'H', variedad: 'blanca', fecha: '2025-03-01', padre: 'E2420000001', madre: 'E2418000002 · <img src=x onerror="window.__xss=1">' });
const fichaHija = await page.evaluate(() => ({ url: location.hash, texto: document.querySelector('main').innerText }));
ok(fichaHija.texto.includes('E2518000003') && /consanguinidad/i.test(fichaHija.texto), `Ficha de la hija con padres y consanguinidad (${fichaHija.url} · ${(await aviso()).slice(0, 80)})`);
await alta({ num: '000002', sexo: 'H', variedad: 'blanca', fecha: '2024-05-01' });
ok((await aviso()).includes('ya está registrada'), 'Anilla duplicada rechazada');
await alta({ num: '7', diam: '18', sexo: 'M', variedad: 'blanca', fecha: '2025-01-01' });
ok((await aviso()).includes('no admitido para gallo'), `Gallo con anilla de 18 mm rechazado (${(await aviso()).slice(0, 70)})`);
await alta({ num: '9', sexo: 'M', variedad: 'blanca', fecha: '2023-01-01', padre: 'E2420000001' });
ok((await aviso()).includes('anterior'), `Padre más joven que el hijo rechazado (${(await aviso()).slice(0, 60)})`);
await ir('#/censo');
ok((await page.$$('#censo-lista a.item')).length === 3, 'Mi censo: 3 ejemplares');
ok((await page.evaluate(() => window.__xss)) === undefined, 'XSS en nombre neutralizado');
const herenciaRega = await page.evaluate(async () => (await (await import('./js/db.js')).todos('animales')).every(a => a.rega === 'ES030140001234' && a.municipio === 'Elche'));
ok(herenciaRega, 'Las altas heredan REGA y municipio del aviario');

// 4. Puesta
await ir('#/puesta');
await page.selectOption('#pu-gallina', { label: 'E2418000002 · <img src=x onerror="window.__xss=1">' });
for (const g of ['61,5', '72', '54']) { await page.fill('#pu-peso', g); await page.press('#pu-peso', 'Enter'); }
await page.click('#pu-guardar');
await page.waitForTimeout(600);
ok((await aviso()).includes('3 huevo(s) guardados · 2 aptos'), `Puesta individual: 61,5 y 72 g aptos, 54 g no (${await aviso()})`);
const huevoGallo = await page.evaluate(async () => {
  const d = await import('./js/datos.js');
  const g = d.estado.todos.find(a => a.anilla === 'E2420000001');
  try { await d.registrarHuevos(g.id, '2026-01-01', [60], 'Blanco crema'); return 'aceptado'; } catch (e) { return e.message; }
});
ok(huevoGallo.includes('solo para gallinas'), 'Huevo asignado a un gallo rechazado');

// 4b. Campañas de control de puesta
await ir('#/puesta');
ok((await page.innerText('#pu-campana')).includes('Control de puesta'), 'Puesta: acceso a las campañas');
await ir('#/campanas');
await page.fill('#cp-inicio', await page.evaluate(() => new Date().toISOString().slice(0, 10)));
await page.click('#cp-form button[type=submit]');
await page.waitForTimeout(600);
ok(page.url().includes('#/campana/'), `Ciclo 1 creado (${await aviso()})`);
if (process.env.CAPTURAS) { await page.waitForTimeout(3500); await page.screenshot({ path: `${process.env.CAPTURAS}/campana.png`, fullPage: true }); }
const txtCamp = await page.innerText('main');
ok(txtCamp.includes('Día 1 de 15') && /Huevos\s*\n?\s*3|3\s*\n\s*Huevos/.test(txtCamp.replace(/\t/g, ' ')), 'Campaña en curso: día 1 de 15 y cuenta los huevos de hoy');
const repetida = await page.evaluate(async () => {
  const d = await import('./js/datos.js');
  try { await d.crearCampana({ ciclo: 1, inicio: new Date().toISOString().slice(0, 10), gallinas: d.estado.campanas[0].gallinas }); return 'aceptada'; } catch (e) { return e.message; }
});
ok(repetida.includes('Ya tienes el ciclo 1'), 'No se repite un ciclo en la misma temporada');
const txtRes = await page.innerText('main');
ok(txtRes.includes('Huevo más grande') && txtRes.includes('Mejor masa de huevo') && txtRes.includes('Cómo leer estos resultados'), 'Resultados con los tres criterios y su explicación');
const res3 = await page.evaluate(async () => {
  const d = await import('./js/datos.js');
  const r = d.resultadosCampana(d.estado.campanas[0]);
  const f = r.filas.find(x => x.n === 3);
  return { puesta: f.puesta, media: Math.round(f.media * 10) / 10, masa: Math.round(f.masa * 10) / 10, fiable: f.pesoFiable, lider: r.general };
});
ok(res3.puesta === 1 && res3.media === 62.5 && res3.masa === 62.5 && res3.fiable === false && res3.lider.peso === null && res3.lider.masa,
  `Masa = puesta × peso medio; con menos de 5 huevos no cuenta para el tamaño (${JSON.stringify(res3)})`);
const madre = await page.evaluate(async () => {
  const d = await import('./js/datos.js');
  const db = await import('./js/db.js');
  const [g1, g2] = ['E2418000002', 'E2518000003'].map(an => d.estado.todos.find(a => a.anilla === an));
  for (const g of [g1, g2]) await db.guardar('animales', { ...g, familia: 'A' });
  await d.cargar();
  const dia = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
  const c = await d.crearCampana({ ciclo: 2, inicio: dia(40), dias: 15, gallinas: [g1.id, g2.id] });
  for (let i = 0; i < 12; i++) await d.registrarHuevos(g1.id, dia(40 - i), [52], 'Blanco crema');
  for (let i = 0; i < 10; i++) await d.registrarHuevos(g2.id, dia(40 - i), [65], 'Blanco crema');
  const r = d.resultadosCampana(d.estado.campanas.find(x => x.id === c.id));
  const an = (id) => d.animal(id)?.anilla;
  return { puesta: an(r.general.puesta), peso: an(r.general.peso), masa: an(r.general.masa), madre: an(r.filas.find(f => f.madreFamilia)?.id) };
});
ok(madre.puesta === 'E2418000002' && madre.peso === 'E2518000003' && madre.masa === 'E2518000003' && madre.madre === 'E2518000003',
  `12 huevos de 52 g frente a 10 de 65 g: más pone la 1ª, más grande y más masa la 2ª, que es la madre propuesta (${JSON.stringify(madre)})`);
await ir('#/puesta');
ok((await page.innerText('#pu-campana')).includes('Día 1 de 15'), 'Puesta muestra la campaña en curso');
if (process.env.CAPTURAS) { await page.screenshot({ path: `${process.env.CAPTURAS}/puesta-campana.png` }); await ir('#/campanas'); await page.waitForTimeout(3500); await page.screenshot({ path: `${process.env.CAPTURAS}/campanas.png`, fullPage: true }); }

// 5. Informes y exportación
await ir('#/informes');
ok((await page.innerText('main')).includes('Ne demográfico'), 'Informe con Ne y censo por edad');
{ const pr = await page.evaluate(async () => {
    const d = await import('./js/datos.js');
    const filas = d.puestaRaza(); const anio = new Date().getFullYear();
    // Esperado calculado aparte: días con huevo / días controlados de todas las campañas del año
    let dg = 0, dc = 0;
    for (const c of d.estado.campanas.filter(c => c.temporada === anio)) { const r = d.resultadosCampana(c); for (const f of r.filas) { dg += r.transcurridos; dc += f.diasConHuevo; } }
    const pesos = d.estado.huevos.filter(h => h.fecha.startsWith(String(anio))).map(h => h.peso_g);
    const f = filas.find(x => x.anio === anio);
    return { f, esperado: dg ? dc / dg : null, n: pesos.length, media: pesos.reduce((s, x) => s + x, 0) / pesos.length };
  });
  ok(pr.f && Math.abs(pr.f.puesta - pr.esperado) < 1e-9 && pr.f.gallinas >= 2 && pr.f.peso.n === pr.n && Math.abs(pr.f.peso.media - pr.media) < 1e-9 && pr.f.aptos > 0 && pr.f.aptos < 1 && pr.f.variedades.length >= 1,
    `Puesta de la raza: intensidad de las campañas y peso de todos los huevos del año (${JSON.stringify({ puesta: pr.f?.puesta, esperado: pr.esperado, n: pr.f?.peso.n, aptos: pr.f?.aptos })})`);
  ok((await page.$$('#puesta tbody tr')).length >= 1 && (await page.innerText('#puesta')).includes('Puesta de mi aviario'), 'Informes: tabla de puesta por año');
  const [dp] = await Promise.all([page.waitForEvent('download'), page.click('#x-puesta')]);
  ok(dp.suggestedFilename().startsWith('ESGA025_puesta_'), 'Puesta por año exportable en CSV');
  if (process.env.CAPTURAS) { await page.$eval('#puesta details', e => { e.open = true; }); await (await page.$('#puesta')).screenshot({ path: `${process.env.CAPTURAS}/puesta-raza.png` }); }
}
{ const ev = await page.$$eval('#evolucion tbody tr', trs => trs.map(t => t.querySelector('th').textContent.trim()));
  const ult = await page.evaluate(async () => (await import('./js/datos.js')).evolucionCenso().at(-1));
  ok(ev.length >= 2 && ev[0] === '2024' && ev.at(-1).endsWith('*') && ult.total === 3, `Informes: evolución del censo año a año desde 2024 (${ev.join(', ')}; hoy ${ult.total})`);
  const [dev] = await Promise.all([page.waitForEvent('download'), page.click('#x-evolucion')]);
  const lin = (await import('node:fs')).readFileSync(await dev.path(), 'utf8').trim().split(/\r?\n/);
  ok(lin[0].includes('ANIO') && lin[0].includes('NE_DEMOGRAFICO') && lin.length === ev.length + 1, 'Informes: evolución del censo en CSV'); }
const [descarga] = await Promise.all([page.waitForEvent('download'), page.click('#x-pedigri')]);
const ruta = await descarga.path();
const contenido = (await import('node:fs')).readFileSync(ruta, 'utf8');
const lineas = contenido.trim().split(/\r?\n/);
ok(lineas.length === 4 && lineas.findIndex(l => l.startsWith('E2518000003')) > lineas.findIndex(l => l.startsWith('E2420000001')), 'Matriz de pedigrí CSV ordenada (progenitores primero)');

// 6. Inspector (rol asignado por el servidor; aquí se simula en la copia local)
await page.evaluate(async () => {
  const db = await import('./js/db.js');
  const id = await db.metaGet('sesion');
  const p = await db.obtener('perfiles', id);
  await db.guardar('perfiles', { ...p, rol: 'inspector' });
});
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForSelector('#barra a');
const idH1 = await page.evaluate(async () => (await import('./js/datos.js')).estado.todos.find(a => a.anilla === 'E2418000002').id);
await ir(`#/calificar/${idH1}`);
ok((await page.$$('#form-cal [data-apartado]')).length === 12, 'Baremo: 12 regiones del Estándar');
await page.click('#form-cal button[type=submit]');
ok((await aviso()).includes('Faltan 12'), `Calificación incompleta bloqueada (${await aviso()})`);
await page.click('#todo-max');
ok((await page.textContent('#c-total')) === '100' && (await page.textContent('#c-clase')).includes('EX'), 'Máximo en todo: 100 · EX');
// Descontar: plumaje 10 -> 7, cola 10 -> 8,5
for (let i = 0; i < 6; i++) await page.click('[data-apartado="plumaje"] button[data-paso="-1"]');
await page.fill('[name="p-cola"]', '8,5');
await page.dispatchEvent('[name="p-cola"]', 'input');
ok((await page.textContent('#c-total')) === '95,5', `Total con descuentos y coma decimal (${await page.textContent('#c-total')})`);
if (process.env.CAPTURAS) { await page.screenshot({ path: `${process.env.CAPTURAS}/calificacion-arriba.png` }); await page.$eval('[data-apartado="pecho"]', e => e.scrollIntoView()); await page.screenshot({ path: `${process.env.CAPTURAS}/calificacion-medio.png` }); }
await page.fill('[name="p-alas"]', '5');
await page.dispatchEvent('[name="p-alas"]', 'input');
ok(await page.$eval('[data-apartado="alas"]', e => e.classList.contains('invalido')), 'Puntuación por encima del máximo marcada');
await page.fill('[name="p-alas"]', '4');
await page.dispatchEvent('[name="p-alas"]', 'input');
await page.click('#form-cal button[type=submit]');
ok((await aviso()).includes('peso'), `Peso obligatorio (${await aviso()})`);
await page.fill('#c-peso', '2750');
await page.dispatchEvent('#c-peso', 'input');
ok((await page.textContent('#c-peso-ayuda')).includes('fuera de rango'), 'Peso fuera del rango del Estándar señalado');
await page.fill('#c-peso', '2400');
await page.evaluate(() => { window.print = () => { window.__impreso = true; }; });
await page.click('#form-cal button[type=submit]');
await page.click('dialog button[value="si"]');
await page.waitForTimeout(800);
const sec = await page.evaluate(async id => (await import('./js/datos.js')).animal(id).seccion, idH1);
ok(sec === 'RN', `Apto pero sin padres en el Libro: sigue en RN (${sec})`);
ok((await page.innerText('main')).includes('Camino al Registro Definitivo'), 'La ficha explica qué le falta para el RD');
ok(await page.evaluate(() => window.__impreso === true && document.querySelector('#impresion').innerText.includes('95,5') && /2400 g.*conforme/.test(document.querySelector('#impresion').innerText) && !document.querySelector('#impresion').innerText.includes('<strong>')), 'Acta con desglose de puntos y peso conforme');
const conDefecto = await page.evaluate(async id => {
  const d = await import('./js/datos.js');
  const { BAREMO } = await import('./js/estandar.js');
  const puntos = Object.fromEntries(BAREMO.apartados.map(x => [x.id, x.max]));
  const c = await d.guardarCalificacion({ animalId: id, puntos, pesoG: 2400, defectos: ['orejilla'] });
  return `${c.total}/${c.clase}/${c.resultado}`;
}, idH1);
ok(conDefecto === '100/D/No apto', `Defecto descalificante: descalificado aunque sume 100 (${conDefecto})`);
const rdHija = await page.evaluate(async () => {
  const d = await import('./js/datos.js');
  const { BAREMO } = await import('./js/estandar.js');
  const por = (an) => d.estado.todos.find(a => a.anilla === an);
  let sinMotivo;
  try { await d.inscribirSeccionBase(por('E2420000001').id, 'RF', ''); sinMotivo = 'aceptado'; } catch (e) { sinMotivo = e.message; }
  await d.inscribirSeccionBase(por('E2420000001').id, 'RF', 'Fundador de la raza');
  await d.inscribirSeccionBase(por('E2418000002').id, 'RF', 'Fundadora de la raza');
  const hija = por('E2518000003');
  const req = d.requisitosRD(hija).lista.filter(x => !x.ok).length;
  await d.guardarCalificacion({ animalId: hija.id, puntos: Object.fromEntries(BAREMO.apartados.map(x => [x.id, x.max - 2])), pesoG: 2400 });
  return { sinMotivo, faltabanAntes: req, seccion: d.animal(hija.id).seccion, padre: por('E2420000001').seccion };
});
ok(rdHija.sinMotivo.includes('motivo') && rdHija.padre === 'RF', 'La Dirección Técnica inscribe fundadores en RF (con motivo obligatorio)');
ok(rdHija.seccion === 'RD', `Hija de fundadores, con un año, REGA y Apto: pasa a RD (${JSON.stringify(rdHija)})`);
if (process.env.CAPTURAS) {
  const idHija = await page.evaluate(async () => (await import('./js/datos.js')).estado.todos.find(a => a.anilla === 'E2518000003').id);
  await ir('#/censo'); await ir(`#/animal/${idHija}`);
  await page.click('#b-cert'); await page.waitForTimeout(300);
  await page.addStyleTag({ content: '#impresion{display:block!important;position:static!important} body>*:not(#impresion){display:none!important}' });
  await page.screenshot({ path: `${process.env.CAPTURAS}/certificado.png`, fullPage: true });
  await page.evaluate(() => document.querySelectorAll('style').forEach(st => { if (st.textContent.includes('#impresion{display:block')) st.remove(); }));
}

// 6b. Registro de Méritos (administración): requisitos y vía por premio
const cambiarRolLocal = async (nuevo) => {
  await page.evaluate(async r => {
    const db = await import('./js/db.js');
    const p = await db.obtener('perfiles', await db.metaGet('sesion'));
    await db.guardar('perfiles', { ...p, rol: r });
  }, nuevo);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#barra a');
};
await cambiarRolLocal('administrador');
const rmRes = await page.evaluate(async id => {
  const d = await import('./js/datos.js');
  const out = [];
  const m = d.meritosRM(d.animal(id));
  out.push(`${m.mejorPuntos}/${m.hijosRD}/${m.cumple}`);
  try { await d.inscribirRM(id, { via: 'requisitos' }); out.push('aceptado'); } catch (e) { out.push(e.message); }
  try { await d.inscribirRM(id, { via: 'premio', motivo: '' }); out.push('aceptado'); } catch (e) { out.push(e.message); }
  const r = await d.inscribirRM(id, { via: 'premio', motivo: 'Exposición de Elche 2026 · 1º gallina Negra moteada' });
  out.push(`${r.seccion}/${r.rm_via}`);
  return out;
}, idH1);
ok(rmRes[0] === '95.5/1/false', `RM: mejor calificación no descalificada (95,5; el 100 con defecto no cuenta) y descendientes en RD (${rmRes[0]})`);
ok(rmRes[1].includes('3 descendientes'), `RM por requisitos exige 3 hijas/os en RD a una gallina (tiene 1) (${rmRes[1]})`);
ok(rmRes[2].includes('premio'), 'RM por premio exige describir el premio');
ok(rmRes[3] === 'RM/premio', `RM por premio inscrito (${rmRes[3]})`);
await ir('#/censo'); await ir(`#/animal/${idH1}`);
ok((await page.innerText('main')).includes('Registro de Méritos'), 'Ficha muestra la inscripción en el RM');
if (process.env.CAPTURAS) { await page.$eval('main', m => [...m.querySelectorAll('h2')].find(x => x.textContent.includes('Méritos'))?.scrollIntoView({ block: 'center' })); await page.screenshot({ path: `${process.env.CAPTURAS}/ficha-rm.png` }); }

// 6b-bis. Panel de administración (con un socio dado de alta hoy: tarea pendiente)
await page.evaluate(async () => {
  const db = await import('./js/db.js'); const d = await import('./js/datos.js');
  await db.guardar('perfiles', { id: '00000000-0000-4000-8000-00000000a1a1', nombre: 'Socio Nuevo', email: 'nuevo@ejemplo.es', rol: 'aspirante', rega: '', created_at: new Date().toISOString() });
  await d.cargar();
});
await ir('#/herramientas');
ok(Boolean(await page.$('main a[href="#/admin"]')), 'Herramientas: el administrador tiene «Panel de administración» arriba');
{ const ins = await page.evaluate(async () => {
    const d = await import('./js/datos.js');
    const n = d.tareasAdmin().filter(x => x.nivel !== 'info').length;
    const a = document.querySelector('#barra a[data-ruta="herramientas"]');
    return [n, a.querySelector('.insignia')?.textContent || '0', a.getAttribute('aria-label') || ''];
  });
  ok(ins[0] > 0 && ins[1] === String(ins[0]) && ins[2].includes('tarea(s) de administración'),
    `Barra (móvil): Herramientas muestra el número de tareas de administración pendientes (${ins[0]} → «${ins[1]}»)`); }
ok(await page.$eval('#barra a[data-ruta="admin"]', a => getComputedStyle(a).display === 'none') && (await page.$$eval('#barra a', l => l.filter(a => getComputedStyle(a).display !== 'none').length)) === 4,
  'Barra (móvil): sigue con 4 botones; «Administración» solo en el menú lateral del ordenador');
await page.setViewportSize({ width: 1280, height: 800 });
await ir('#/usuarios');
ok(await page.$eval('#barra a[data-ruta="admin"]', a => getComputedStyle(a).display !== 'none' && a.getAttribute('aria-current') === 'page'),
  'Menú lateral (ordenador): «Administración» visible y marcada en sus pantallas');
await ir('#/herramientas');
ok(await page.$eval('main a[href="#/admin"]', a => a.offsetParent === null), 'Ordenador: Herramientas no repite «Panel de administración» (ya está en el menú lateral)');
await page.setViewportSize({ width: 390, height: 844 });
await ir('#/admin');
{ const t = await page.innerText('main');
  ok(t.includes('Qué hay que hacer') && t.includes('No hay ningún inspector nombrado') && (await page.$$('main a[href="#/admin/supabase"], main a[href="#/admin/libro"], main a[href="#/usuarios"]')).length >= 3,
    'Panel de administración: tareas pendientes (falta nombrar inspector) y accesos a usuarios, Libro y Supabase'); }
await ir('#/admin/libro');
await page.fill('#al-buscar', '0001');
await page.waitForTimeout(200);
ok((await page.$$('#al-resultados a')).length > 0 && (await page.inputValue('#al-buscar')) === '0001', 'Inscripciones del Libro: buscador por anilla que lleva a la ficha');
await ir('#/usuarios?filtro=nuevos');
ok((await page.$eval('[data-filtro="nuevos"]', b => b.getAttribute('aria-pressed'))) === 'true' && (await page.$$('#us-lista details')).length >= 1, 'Usuarios: filtro de altas nuevas y ficha de cada usuario');
await ir('#/admin/expediente');
{ const ex = await page.$$eval('main .expediente li', ls => ls.map(l => l.id));
  const t = await page.innerText('main');
  ok(ex.length === 14 && ex[0] === 'exp-a' && ex[13] === 'exp-n' && t.includes('entidad científica') && t.includes('Corresponde al Club'),
    'Expediente para el Catálogo: los 14 apartados del Protocolo CNZ (a–n), con su estado y lo que corresponde al Club'); }
await ir('#/informes');
{ const t = await page.innerText('#situacion');
  const sp = await page.evaluate(async () => { const d = await import('./js/datos.js'); const r = d.situacionPoblacional(); return { anios: r.anios, grado: r.grado, am: r.amenazada, u: r.umbrales }; });
  ok(t.includes('Raza amenazada · grado de amenaza alto') && sp.am && sp.grado === 'alto' && sp.u.hembras === 25000 && sp.u.machos === 500 && sp.u.reposicion === 15000 && sp.anios.length === 3,
    `Informes: situación poblacional con los criterios CNZ para aves (${sp.anios.join('–')}: amenazada, grado ${sp.grado})`);
  await ir('#/admin/expediente');
  ok((await page.innerText('#exp-g')).includes('Cubierto') && (await page.innerText('#exp-g')).includes('grado alto'), 'Expediente: el apartado g) pasa a cubierto con el resultado'); }
await ir('#/admin/programa');
{ const t = await page.innerText('#programa-cria');
  const hs = await page.$$eval('#programa-cria h2', l => l.map(x => x.textContent.trim()));
  ok(hs.includes('1. Finalidad del programa') && hs.includes('11. Datos y resultados') && t.includes('65 puntos las gallinas y 70 los gallos') && t.includes('3 campañas por temporada de 15 días')
    && (await page.$$('#programa-cria .a-decidir')).length >= 4 && /amenazada, grado alto/.test(t),
    `Programa de cría (borrador): estructura del Reg. (UE) 2016/1012, reglas de la app, datos del Libro y lo que decide el Club (${hs.length} apartados)`);
  if (process.env.CAPTURAS) await page.screenshot({ path: `${process.env.CAPTURAS}/programa-cria.png`, fullPage: true });
  await ir('#/admin/expediente');
  ok((await page.$('#exp-n a[href="#/admin/programa"]')) !== null, 'Expediente: el apartado n) enlaza al borrador'); }
await ir('#/admin/germoplasma');
{ ok((await page.innerText('#gm-lista')).includes('Todavía no hay muestras'), 'Material genético: inventario vacío explicado');
  const [gallo, gallina] = await page.evaluate(async () => { const d = await import('./js/datos.js'); const t = d.estado.todos; return [t.find(a => a.sexo === 'M').anilla, t.find(a => a.sexo === 'H').anilla]; });
  const rellenar = async (anilla) => {
    await page.selectOption('#gm-tipo', 'semen'); await page.fill('#gm-muestras', '24'); await page.fill('#gm-fecha', '2026-03-10');
    await page.fill('#gm-anilla', anilla); await page.fill('#gm-centro', 'Banco Nacional de Germoplasma Animal'); await page.check('#gm-reconocido');
    await page.click('#gm-form button[type=submit]');
  };
  await rellenar(gallina);
  await page.waitForTimeout(200);
  ok((await aviso()).includes('tiene que ser de un gallo'), `Material genético: el semen tiene que ser de un gallo (${await aviso()})`);
  await rellenar(gallo);
  await page.waitForSelector('#gm-lista table');
  const t = await page.innerText('#gm-lista');
  const r = await page.evaluate(async () => { const d = await import('./js/datos.js'); return { r: d.resumenGermoplasma(), cola: (await (await import('./js/db.js')).todos('cola')).some(i => i.tabla === 'germoplasma') }; });
  ok(t.includes(gallo) && t.includes('24') && r.r.germoplasma === 24 && r.r.reconocido === 24 && r.r.donantes === 1, `Material genético: muestras anotadas con su donante y centro reconocido (${JSON.stringify({ g: r.r.germoplasma, d: r.r.donantes })})`);
  await ir('#/admin/expediente');
  ok((await page.innerText('#exp-m')).includes('Cubierto') && (await page.innerText('#exp-m')).includes('24 muestra'), 'Expediente: el apartado m) pasa a cubierto con el inventario');
  await ir('#/informes');
  ok((await page.innerText('#situacion')).includes('24 muestra(s) de germoplasma'), 'Situación poblacional: recoge el germoplasma como información complementaria');
  await ir('#/admin/germoplasma');
  await page.click('[data-editar]'); await page.click('#gm-borrar'); await page.click('dialog.dialogo button[value="si"]');
  await page.waitForTimeout(300);
  ok((await page.innerText('#gm-lista')).includes('Todavía no hay muestras'), 'Material genético: se puede borrar un registro, con confirmación'); }
await ir('#/comunicados');
{ ok((await page.innerText('main')).includes('Todavía no hay comunicados') && Boolean(await page.$('#com-form')), 'Comunicados: vacío y con formulario para la administración');
  const hoy = new Date().toISOString().slice(0, 10), fin = `${Number(hoy.slice(0, 4)) + 1}-01-31`;
  await page.fill('#com-titulo', 'Vacunación de Newcastle en la Comunitat Valenciana');
  await page.fill('#com-texto', 'Es obligatoria en las explotaciones que no son de autoconsumo.\nPregunta a tu veterinario.');
  await page.fill('#com-fuente', 'Resolución de 24/2/2026');
  await page.fill('#com-enlace', 'javascript:alert(1)'); await page.fill('#com-destacado', fin);
  await page.click('#com-form button[type=submit]'); await page.waitForTimeout(200);
  ok((await aviso()).includes('https://'), `Comunicados: el enlace tiene que ser https (${await aviso()})`);
  await page.fill('#com-enlace', 'https://dogv.gva.es/');
  await page.click('#com-form button[type=submit]');
  await page.waitForSelector('.comunicado');
  const t = await page.innerText('.comunicado');
  ok(t.includes('Vacunación de Newcastle') && t.includes('Pregunta a tu veterinario') && t.includes('Resolución de 24/2/2026') && t.includes('Destacado') && Boolean(await page.$('.comunicado a[href="https://dogv.gva.es/"]')),
    'Comunicados: publicado con fecha, texto, fuente, enlace oficial y destacado');
  await ir('#/censo');
  await page.waitForSelector('#censo-comunicados .comunicado-aviso', { timeout: 3000 });
  ok((await page.innerText('#censo-comunicados')).includes('Comunicado del Club: Vacunación de Newcastle'), 'Mi censo: el comunicado destacado sale arriba');
  await page.click('[data-cerrar-comunicado]'); await page.waitForTimeout(200);
  ok(!(await page.$('#censo-comunicados .comunicado-aviso')), 'Mi censo: al cerrarlo no vuelve a salir');
  await ir('#/herramientas');
  ok((await page.innerText('main')).includes('Comunicados del Club') && (await page.innerText('main')).includes('Vacunación de Newcastle'), 'Herramientas: acceso a los comunicados con el último');
  await ir('#/conoce?s=sanidad');
  ok(Boolean(await page.$('#sanidad a[href="#/comunicados"]')), 'Obligaciones sanitarias: enlaza a los comunicados del Club (con sesión)');
  if (process.env.CAPTURAS) { await ir('#/comunicados'); await page.screenshot({ path: `${process.env.CAPTURAS}/comunicados.png`, fullPage: true }); }
  await ir('#/comunicados');
  await page.click('[data-editar]'); await page.click('#com-borrar'); await page.click('dialog.dialogo button[value="si"]');
  await page.waitForTimeout(300);
  ok((await page.innerText('main')).includes('Todavía no hay comunicados'), 'Comunicados: se pueden borrar, con confirmación'); }

// 6m. Tesorería: rol aparte, datos cifrados en el dispositivo (modo dispositivo: el administrador local)
await ir('#/herramientas');
ok((await page.innerText('main')).includes('Tesorería del Club'), 'Herramientas: acceso a Tesorería para quien tiene el rol');
await ir('#/tesoreria');
{ await page.fill('#te-c1', 'corta'); await page.fill('#te-c2', 'corta'); await page.click('#te-crear button[type=submit]'); await page.waitForTimeout(200);
  ok((await aviso()).includes('al menos 12 caracteres'), 'Tesorería: la contraseña tiene que ser larga');
  await page.fill('#te-c1', 'gallinas del club 2026'); await page.fill('#te-c2', 'gallinas del club 2026'); await page.click('#te-crear button[type=submit]');
  await page.waitForSelector('[data-grupo=inicio]', { timeout: 8000 });
  ok(await page.$eval('[data-grupo=inicio]', b => b.getAttribute('aria-selected') === 'true') && (await page.innerText('#te-tareas')).includes('Importa el primer extracto del banco') && (await page.innerText('#te-tareas')).includes('Crea el código de recuperación'),
    'Tesorería: se abre en Inicio, con lo que hay que hacer');
  ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1) && (await page.$$('[data-grupo]')).length === 5,
    'Tesorería: Inicio y 4 grupos caben en el móvil sin desplazamiento lateral');
  await page.click('[data-tarea]:has-text("código de recuperación")');
  await page.waitForSelector('[data-pestana=seguridad][aria-selected=true]');
  ok(await page.$eval('[data-grupo=ajustes]', b => b.getAttribute('aria-selected') === 'true'), 'Tesorería: una tarea de Inicio lleva a su sitio (Ajustes › Seguridad)');
  await irTes('inicio'); await page.click('[data-ir=cuotas]'); await page.waitForSelector('[data-pestana=cuotas][aria-selected=true]');
  ok(await page.$eval('[data-grupo=dia]', b => b.getAttribute('aria-selected') === 'true'), 'Tesorería: accesos rápidos de Inicio (Cuotas, en «Día a día»)');
  await irTes('socios'); await page.waitForSelector('#te-nuevo');
  await page.click('#te-nuevo');
  await page.fill('#ts-numero', '7'); await page.fill('#ts-nombre', 'Zacarías'); await page.fill('#ts-apellidos', 'Secretísimo'); await page.fill('#ts-dni', '12345678Z');
  await page.fill('#ts-iban', 'ES91 2100 0418 4502 0005 1332');
  await page.click('#te-ficha button[type=submit]');
  await page.waitForSelector('#te-lista');
  ok((await page.innerText('#te-lista')).includes('7 · Zacarías Secretísimo'), 'Tesorería: alta de un socio');
  const enMovil = await page.evaluate(async () => { const db = await import('./js/db.js'); return JSON.stringify([await db.todos('tesoreria'), await db.todos('tesoreria_clave'), await db.todos('cola')]); });
  ok(!/Zacar|Secret|12345678Z|ES91|gallinas del club/i.test(enMovil) && /v1\./.test(enMovil), 'Tesorería: en el móvil solo hay texto cifrado (ni nombre, ni DNI, ni IBAN, ni la contraseña)');
  await page.click('#te-cerrar');
  await page.waitForSelector('#te-abrir');
  await page.fill('#te-clave', 'otra contraseña cualquiera'); await page.click('#te-abrir button[type=submit]');
  await page.waitForFunction(() => document.querySelector('#aviso')?.textContent.includes('no es correcta'), null, { timeout: 8000 });
  ok(true, 'Tesorería: con otra contraseña no se abre');
  await page.fill('#te-clave', 'gallinas del club 2026'); await page.click('#te-abrir button[type=submit]');
  await page.waitForSelector('#te-lista', { timeout: 8000 });
  ok((await page.innerText('#te-lista')).includes('Zacarías'), 'Tesorería: con su contraseña se abre y los datos están');
  // Importar el Excel de socios (datos ficticios): hoja «SOCIOS», títulos en la fila 3
  await irTes('importar');
  await page.setInputFiles('#te-archivo', 'tests/fixtures/socios_ficticios.xlsx');
  await page.waitForSelector('#te-importar', { timeout: 5000 });
  const imp = await page.evaluate(() => ({ hoja: document.querySelector('#te-hoja').selectedOptions[0].textContent, fila: document.querySelector('#te-fila').value,
    mapa: Object.fromEntries([...document.querySelectorAll('[data-mapa]')].filter(x => x.value !== '').map(x => [x.dataset.mapa, x.selectedOptions[0].textContent.split(' · ')[1]])) }));
  ok(imp.hoja === 'SOCIOS' && imp.fila === '3' && imp.mapa.numero === 'Nº SOCIO' && imp.mapa.dni === 'DNI' && imp.mapa.telefono === 'TELÉFONO' && imp.mapa.email === 'E-MAIL'
    && imp.mapa.municipio === 'POBLACIÓN' && imp.mapa.fecha_alta === 'FECHA ALTA' && imp.mapa.iban === 'IBAN' && imp.mapa.cp === 'C.P.' && imp.mapa.direccion === 'DOMICILIO',
    `Importar: encuentra la hoja de socios, la fila de títulos y adivina las columnas (${JSON.stringify(imp)})`);
  ok((await page.innerText('#te-cuerpo')).includes('3 socio(s) para importar') && (await page.innerText('#te-cuerpo')).includes('01/03/2021'), 'Importar: vista previa con las fechas del Excel');
  await page.click('#te-importar');
  await page.waitForTimeout(1500);
  ok((await aviso()).includes('2 nuevos') && (await aviso()).includes('1 con errores') && (await page.innerText('main')).includes('IBAN no es válido'),
    `Importar: 2 socios nuevos y el del IBAN erróneo se señala sin importar (${await aviso()})`);
  await irTes('socios'); await page.waitForSelector('#te-lista');
  { const n = await page.$$eval('#te-lista [data-socio]', l => l.map(x => x.textContent.trim().slice(0, 30))); ok(n.length === 3, `Tesorería: 3 socios en la lista (${n.join(' | ')})`); }
  await page.fill('#te-buscar', 'denia');
  ok((await page.$$('#te-lista [data-socio]')).length === 1, 'Tesorería: búsqueda sin acentos (Dénia)');
  await irTes('seguridad');
  const [cop] = await Promise.all([page.waitForEvent('download'), page.click('#te-copia')]);
  const txtCopia = fs.readFileSync(await cop.path(), 'utf8');
  ok(cop.suggestedFilename().startsWith('CGA_tesoreria_cifrada_') && !/Zacar|Bernat|00000000T/.test(txtCopia) && JSON.parse(txtCopia).registros.filter(r => r.tipo === 'socio').length === 3 && !/Cuotas de socios/.test(txtCopia), 'Tesorería: copia cifrada descargable, sin datos legibles');
  // Código de recuperación: sin él, aviso; se crea, se muestra una vez y abre la tesorería si se olvida la contraseña
  ok(Boolean(await page.$('#te-aviso-rec')), 'Tesorería: avisa de que falta el código de recuperación');
  await page.click('#te-crear-rec'); await page.waitForSelector('#dlg-codigo');
  const codigo = (await page.innerText('#dlg-codigo')).trim();
  ok(/^[A-Z2-9]{5}(-[A-Z2-9]{5}){5}$/.test(codigo) && !/[01ILO]/.test(codigo), `Código de recuperación: 30 caracteres en grupos de 5, sin letras que se confundan (${codigo.slice(0, 5)}…)`);
  await page.click('dialog.dialogo button[value="ok"]'); await page.waitForSelector('#te-rec .chip-ok');
  ok(Boolean(await page.$('#te-rec .chip-ok')), 'Código de recuperación creado');
  { const enMovil = await page.evaluate(async () => JSON.stringify(await (await import('./js/db.js')).todos('tesoreria_clave')));
    ok(!enMovil.includes(codigo) && !enMovil.includes(codigo.replace(/-/g, '')), 'Código de recuperación: no se guarda en ningún sitio, solo la clave envuelta con él'); }
  await page.click('#te-cerrar'); await page.waitForSelector('#te-olvido');
  await page.click('#te-olvido'); await page.fill('#tr-codigo', 'AAAAA-BBBBB-CCCCC-DDDDD-EEEEE-FFFFF'); await page.fill('#tr-n1', 'otra frase de tesoreria'); await page.fill('#tr-n2', 'otra frase de tesoreria');
  await page.click('#te-recuperar button[type=submit]');
  await page.waitForFunction(() => document.querySelector('#aviso')?.textContent.includes('código de recuperación no es correcto'), null, { timeout: 8000 });
  ok(true, 'Recuperación: un código equivocado no abre');
  await page.fill('#tr-codigo', codigo.toLowerCase().replace(/-/g, ' ')); await page.click('#te-recuperar button[type=submit]');
  await page.waitForSelector('#te-cerrar', { timeout: 8000 });
  await page.click('#te-cerrar'); await page.waitForSelector('#te-clave');
  await page.fill('#te-clave', 'otra frase de tesoreria'); await page.click('#te-abrir button[type=submit]');
  await page.waitForSelector('#te-cerrar', { timeout: 8000 });
  ok((await tesSocios()) === 3, 'Recuperación: con el código se abre, se pone contraseña nueva y los datos siguen ahí');
  ok(!(await page.$('#te-aviso-copia')), 'Tesorería: sin aviso de copia, porque se acaba de descargar');
  const unidad = await page.evaluate(async () => { const t = await import('./js/tesoreria.js'); return [t.ibanValido('ES9121000418450200051332'), t.ibanValido('ES9121000418450200051333'), t.ibanValido('ES91 2100 0418 4502 0005 1332')]; });
  ok(JSON.stringify(unidad) === '[true,false,true]', 'IBAN: comprobación de los dígitos de control');
  // Fase 2: movimientos del banco (Excel con el formato de Caixa Popular, datos ficticios)
  await irTes('movimientos');
  await page.waitForSelector('#te-banco', { state: 'attached' });
  ok((await page.innerText('#te-cuerpo')).includes('Todavía no hay movimientos'), 'Movimientos: vacío, con el botón para importar el Excel del banco');
  await page.setInputFiles('#te-banco', 'tests/fixtures/banco_ficticio_1.xlsx');
  await page.waitForSelector('#te-movs', { timeout: 8000 });
  ok((await aviso()).includes('5 nuevos (4 clasificados solos)') && (await aviso()).includes('Quedan 1 por clasificar'), `Movimientos: 5 importados, 4 clasificados solos (${await aviso()})`);
  const movs = await page.evaluate(async () => { const t = await import('./js/tesoreria.js');
    return t.movimientos().map(m => [m.concepto.slice(0, 14), t.nombrePartida(m.partida), m.socio_id ? t.socios().find(s => s.id === m.socio_id).nombre : null, m.anio]); });
  const por = Object.fromEntries(movs.map(m => [m[0], m.slice(1)]));
  ok(JSON.stringify(por['trf. ana prueb']) === JSON.stringify(['Cuotas de socios', 'Ana', 2026]) && JSON.stringify(por['trf. prueba do']) === JSON.stringify(['Cuotas de socios', 'Bernat', 2026])
    && por['rcbo.federaion'][0] === 'Federación (FESACOCUR)' && por['comision mante'][0] === 'Comisiones y gastos del banco' && por['trf. fulano de'][0] === null && por['trf. fulano de'][1] === null,
    `Clasificación: cuotas por socio e importe (también con el nombre al revés), federación y comisiones por regla, y lo desconocido sin clasificar (${JSON.stringify(por)})`);
  ok((await page.innerText('#te-cuerpo')).includes('973,00 €'), 'Movimientos: saldo según el banco (el del último apunte)');
  await page.setInputFiles('#te-banco', 'tests/fixtures/banco_ficticio_2.xlsx');
  await page.waitForSelector('#te-huecos', { timeout: 8000 });
  ok((await aviso()).includes('1 nuevos') && (await aviso()).includes('1 que ya estaban') && (await page.innerText('#te-huecos')).includes('Faltan los apuntes 15'),
    `Movimientos: al volver a importar no se duplican y avisa del apunte que falta (${await aviso()})`);
  await page.setInputFiles('#te-banco', 'tests/fixtures/banco_otra_cuenta.xlsx');
  await page.waitForTimeout(800);
  ok((await aviso()).includes('es de otra cuenta'), 'Movimientos: rechaza el Excel de otra cuenta');
  // Clasificar a mano el desconocido y crear una regla desde un movimiento
  await page.selectOption('#mf-partida', 'sin');
  await page.waitForTimeout(200);
  await page.click('[data-editar-mov]');
  await page.selectOption('#me-partida', { label: 'Otros' }); await page.fill('#me-nota', 'Donativo en mano');
  await page.click('.mov-form button[type=submit]'); await page.waitForTimeout(300);
  ok((await page.innerText('#te-cuerpo')).includes('Ningún movimiento con estos filtros'), 'Movimientos: clasificado a mano, ya no queda ninguno sin clasificar');
  await page.selectOption('#mf-partida', ''); await page.waitForTimeout(200);
  ok((await page.innerText('#te-cuerpo')).includes('Resumen por partidas 2026'), 'Movimientos: resumen por partidas del año');
  const tot = await page.evaluate(async () => { const t = await import('./js/tesoreria.js'); const r = t.resumen(2026); return [r.ingresos, r.gastos, r.filas.find(f => f.partida.nombre === 'Anillas')?.ingresos]; });
  ok(JSON.stringify(tot) === JSON.stringify([72, 87, 12]), `Resumen 2026: 72 € de ingresos, 87 € de gastos, anillas 12 € (${JSON.stringify(tot)})`);
  await irTes('partidas');
  await page.waitForSelector('#tr-nueva');
  await page.fill('#tr-texto', 'loteria'); await page.selectOption('#tr-partida', { label: 'Otros' }); await page.click('#tr-nueva button[type=submit]'); await page.waitForTimeout(300);
  ok((await page.innerText('#tp-reglas')).includes('«loteria» → Otros'), 'Partidas: regla nueva');
  await irTes('socios'); await page.waitForSelector('#te-buscar');
  await page.fill('#te-buscar', ''); await page.waitForSelector('#te-lista');
  await page.click('#te-lista [data-socio]');
  await page.waitForSelector('#te-pagos');
  ok((await page.$$('#te-pagos li')).length === 2 && (await page.innerText('#te-pagos')).includes('Cuotas de socios 2026'), 'Ficha del socio: sus movimientos (cuota 2026 y anillas)');
  await page.click('#te-volver');
  // Fase 3: cuotas por año
  await irTes('cuotas'); await page.waitForSelector('#cu-anio');
  { const t = await page.innerText('#te-cuerpo');
    ok(t.includes('2 / 3') && t.includes('50,00 €') && t.includes('Recaudado de 75,00 €') && (await page.$$('#cu-lista .cuota')).length === 1 && (await page.innerText('#cu-lista')).includes('Zacarías Secretísimo'),
      'Cuotas 2026: han pagado 2 de 3, 50 € de 75 €, y falta Zacarías'); }
  // Le ponemos teléfono: sale el recordatorio por WhatsApp con la cuenta del Club
  await irTes('socios'); await page.waitForSelector('#te-buscar'); await page.fill('#te-buscar', 'zacar');
  await page.click('#te-lista [data-socio]'); await page.waitForSelector('#ts-telefono');
  await page.fill('#ts-telefono', '600 111 222'); await page.click('#te-ficha button[type=submit]'); await page.waitForSelector('#te-lista');
  await page.fill('#te-buscar', '');
  await irTes('cuotas'); await page.waitForSelector('#cu-lista');
  { const wa = await page.getAttribute('#cu-lista a[href^="https://wa.me/"]', 'href');
    const txt = decodeURIComponent(wa.split('text=')[1]);
    ok(wa.startsWith('https://wa.me/34600111222?') && txt.includes('Hola, Zacarías') && txt.includes('cuota 2026') && txt.includes('25,00 €') && txt.includes('ES91 2100 0418 4502 0005 1332'),
      `Cuotas: recordatorio por WhatsApp con su nombre, el año, lo que falta y la cuenta (${txt.slice(0, 60)}…)`); }
  ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'Cuotas: en el móvil no se sale de la pantalla');
  if (process.env.CAPTURAS) await page.screenshot({ path: `${process.env.CAPTURAS}/cuotas.png`, fullPage: true });
  await page.click('[data-efectivo]'); await page.fill('#dlg-importe', '25'); await page.click('dialog.dialogo button[value="si"]');
  await page.waitForTimeout(500);
  { const t = await page.innerText('#te-cuerpo');
    ok(t.includes('3 / 3') && t.includes('¡Todos han pagado la cuota de este año!'), 'Cuotas: el pago en efectivo cuenta y ya han pagado todos'); }
  ok(await page.evaluate(async () => { const t = await import('./js/tesoreria.js'); const m = t.movimientos().find(x => x.nota === 'Efectivo'); return Boolean(m) && m.anio === 2026 && t.nombrePartida(m.partida) === 'Cuotas de socios' && m.origen === 'manual'; }),
    'Cuotas: el pago en efectivo queda como movimiento de «Cuotas de socios» 2026');
  // Exento y cuota especial
  const esp = await page.evaluate(async () => { const t = await import('./js/tesoreria.js'); const s = t.socios().find(x => x.nombre === 'Bernat'); await t.guardarSocio({ ...s, cuota_especial: '0' }); const c = t.cuotasAnio(2026); return [c.cuenta.exento, c.previsto, t.socios().find(x => x.nombre === 'Bernat').cuota_especial]; });
  ok(JSON.stringify(esp) === JSON.stringify([1, 50, 0]), `Cuotas: un socio exento (cuota especial 0) no cuenta en lo previsto (${JSON.stringify(esp)})`);
  // Fase 4: cuentas del año para la asamblea
  await irTes('cuentas'); await page.waitForSelector('#cc-doc');
  { const t = await page.innerText('#cc-doc');
    const cu = await page.evaluate(async () => { const t = await import('./js/tesoreria.js'); const c = t.cuentasAnio(2026); return [c.banco.inicial, c.banco.final, c.ingresos, c.gastos, c.resultado, c.efectivo.neto, c.banco.cuadra, c.cuotas.pagadas, c.cuotas.recaudado]; });
    ok(JSON.stringify(cu) === JSON.stringify([1000, 1015, 97, 87, 10, 25, false, 2, 75]), `Cuentas 2026: saldo inicial y final del banco, ingresos, gastos, resultado, efectivo y cuotas (${JSON.stringify(cu)})`);
    ok(t.includes('Cuentas del ejercicio 2026') && t.includes('1000,00 €') && t.includes('Cuotas de socios') && t.includes('Federación (FESACOCUR)') && t.includes('Faltan los apuntes 15') && t.includes('Visto bueno de la Presidencia'),
      'Cuentas: documento con resumen, ingresos y gastos por partida, aviso del apunte que falta y firmas'); }
  { const limpio = await page.evaluate(async () => { const d = await import('./js/documentos.js'); const t = await import('./js/tesoreria.js');
      window.print = () => {}; d.cuentas(t.cuentasAnio(2026)); await new Promise(r => setTimeout(r, 100));
      const antes = document.querySelector('#impresion').textContent.includes('Cuentas del ejercicio'); window.dispatchEvent(new Event('afterprint'));
      return antes && document.querySelector('#impresion').textContent.trim() === ''; });
    ok(limpio, 'Cuentas: al terminar de imprimir, los datos se borran de la página'); }
  const [dcc] = await Promise.all([page.waitForEvent('download'), page.click('#cc-csv')]);
  ok(dcc.suggestedFilename() === 'CGA_cuentas_2026.csv', 'Cuentas: CSV del ejercicio');
  if (process.env.CAPTURAS) await page.screenshot({ path: `${process.env.CAPTURAS}/cuentas.png`, fullPage: true });
  // Fase 5: SEPA. Ana pasa a tener una cuota especial de 40 €: le faltan 15 € de 2026
  await page.evaluate(async () => { const t = await import('./js/tesoreria.js'); const s = t.socios().find(x => x.nombre === 'Ana'); await t.guardarSocio({ ...s, cuota_especial: '40' }); });
  await irTes('sepa'); await page.waitForSelector('#se-acreedor');
  ok((await page.innerText('#se-id')) === 'ES98000G21807508', 'SEPA: identificador de acreedor calculado del NIF del Club (ES98000G21807508)');
  ok(await page.evaluate(async () => { const s = await import('./js/tesoreria/sepa.js'); return s.idAcreedorValido('ES98000G21807508') && !s.idAcreedorValido('ES97000G21807508') && s.idAcreedor('B12345678') === 'ES97000B12345678'; }), 'SEPA: dígitos de control del identificador (módulo 97)');
  ok((await page.innerText('#se-remesa')).includes('No se puede: falta orden de domiciliación') && await page.$eval('#se-remesa input[type=checkbox]', c => c.disabled), 'Remesa: sin orden firmada no se puede cobrar');
  { const ana = await page.evaluate(async () => (await import('./js/tesoreria.js')).socios().find(x => x.nombre === 'Ana').id);
    await page.evaluate(() => { window.print = () => {}; });
    await page.click(`[data-mandato="${ana}"]`); await page.waitForTimeout(300);
    const imp = await page.$eval('#impresion', e => e.textContent);
    ok(imp.includes('Orden de domiciliación de adeudo directo SEPA') && imp.includes('ES98000G21807508') && imp.includes('Ana Prueba Uno') && imp.includes('ES91 2100 0418 4502 0005 1332') && imp.includes('CGA-1') && imp.includes('ocho semanas'),
      'Mandato: orden para firmar con los datos del Club y del socio y su referencia (CGA-1)');
    await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
    await page.waitForSelector(`[data-firmada="${ana}"]`);
    await page.click(`[data-firmada="${ana}"]`); await page.click('dialog.dialogo button[value="si"]'); await page.waitForTimeout(400); }
  ok(await page.$eval('#se-remesa input[type=checkbox]', c => !c.disabled && c.checked) && (await page.innerText('#se-remesa')).includes('1 cobro(s) · 15,00 €'), 'Remesa: con la orden firmada, Ana entra por los 15 € que le faltan');
  const [rx] = await Promise.all([page.waitForEvent('download'), (async () => { await page.click('#sr-generar'); await page.click('dialog.dialogo button[value="si"]'); })()]);
  const xml = fs.readFileSync(await rx.path(), 'utf8');
  const xv = await page.evaluate((x) => { const d = new DOMParser().parseFromString(x, 'application/xml'); const q = (s) => d.getElementsByTagName(s)[0]?.textContent;
    return { error: Boolean(d.getElementsByTagName('parsererror').length), ns: d.documentElement.namespaceURI, n: q('NbOfTxs'), suma: q('CtrlSum'), mandato: q('MndtId'), firma: q('DtOfSgntr'), seq: q('SeqTp'), lcl: q('LclInstrm'), iban: [...d.getElementsByTagName('IBAN')].map(e => e.textContent), id: q('CdtrSchmeId'), nombre: d.getElementsByTagName('Dbtr')[0]?.textContent }; }, xml);
  ok(rx.suggestedFilename().startsWith('remesa_CGA-') && !xv.error && xv.ns === 'urn:iso:std:iso:20022:tech:xsd:pain.008.001.02' && xv.n === '1' && xv.suma === '15.00' && xv.mandato === 'CGA-1' && /^\d{4}-\d{2}-\d{2}$/.test(xv.firma)
    && xv.seq === 'RCUR' && xv.lcl === 'CORE' && xv.iban.includes('ES9121000418450200051332') && xv.id.includes('ES98000G21807508') && xv.nombre === 'Ana Prueba Uno',
    `Remesa: fichero SEPA pain.008.001.02 válido (1 cobro de 15,00 €, mandato CGA-1, RCUR, CORE) (${JSON.stringify(xv)})`);
  ok((await page.innerText('#se-emitidas')).includes('Pendiente de ver en el banco'), 'Remesa: queda pendiente de ver en el banco');
  // El banco abona la remesa (15 €, un día después): al importarlo se reparte como cuota de Ana
  const tras = await page.evaluate(async () => { const t = await import('./js/tesoreria.js'); const r = t.remesas()[0];
    const serie = (iso) => (Date.parse(`${iso}T00:00:00Z`) - Date.UTC(1899, 11, 30)) / 86400000 + 1 + 1 / 12;
    const hojas = [{ nombre: 'movimientos', filas: [['Nombre', 'X'], ['IBAN', 'ES91 2100 0418 4502 0005 1332'], [], ['Fecha de la operación', 'Fecha valor', 'Tipo movimiento', 'Importe', 'Saldo', 'Nro. Apunte'],
      [serie(r.fecha_cobro), serie(r.fecha_cobro), 'abono remesa adeudos', 15, 1030, 17]] }];
    const res = await t.importarMovimientos(hojas);
    const ana = t.cuotasAnio(2026).filas.find(f => f.socio.nombre === 'Ana');
    return { nuevos: res.nuevos, estado: ana.estado, pagado: ana.pagado, cobrada: Boolean(t.abonoDeRemesa(r.id)), pagos: t.movimientosDeSocio(ana.socio.id).length }; });
  ok(tras.nuevos === 1 && tras.estado === 'pagado' && tras.pagado === 40 && tras.cobrada && tras.pagos === 3, `Remesa: el abono del banco se reparte y la cuota de Ana queda pagada (${JSON.stringify(tras)})`);
  await irTes('cuotas'); await irTes('sepa'); await page.waitForSelector('#se-emitidas');
  ok((await page.innerText('#se-emitidas')).includes('Cobrada'), 'Remesa: marcada como cobrada');
  if (process.env.CAPTURAS) await page.screenshot({ path: `${process.env.CAPTURAS}/sepa.png`, fullPage: true });
  // Presupuesto anual por partidas
  await irTes('presupuesto'); await page.waitForSelector('#pp-form');
  const anioP = new Date().getMonth() >= 9 ? new Date().getFullYear() + 1 : new Date().getFullYear();
  ok(await page.$eval('#pp-anio', s => s.value) === String(anioP), `Presupuesto: propone el año que toca preparar (${anioP})`);
  await page.selectOption('#pp-anio', '2027'); await page.waitForSelector('#pp-rellenar');
  await page.click('#pp-rellenar'); await page.waitForTimeout(300);
  ok((await page.innerText('#pp-ti')) === '112,00 €' && (await page.innerText('#pp-tg')) === '87,00 €', `Presupuesto 2027: rellenado con lo real de 2026 (ingresos ${await page.innerText('#pp-ti')}, gastos ${await page.innerText('#pp-tg')})`);
  { const fed = await page.evaluate(async () => (await import('./js/tesoreria.js')).partidas().find(p => p.nombre.startsWith('Federación')).id);
    await page.fill(`#pp-gastos-${fed}`, '90'); await page.dispatchEvent(`#pp-gastos-${fed}`, 'change');
    ok((await page.innerText('#pp-tg')) === '92,00 €', 'Presupuesto: los totales se actualizan al escribir');
    await page.fill('#pp-aprobado', '2026-12-15'); await page.click('#pp-form button[type=submit]'); await page.waitForTimeout(400);
    const pr = await page.evaluate(async () => { const t = await import('./js/tesoreria.js'); const p = t.presupuesto(2027); return [Object.keys(p.lineas).length, p.aprobado, Object.values(p.lineas).reduce((a, l) => a + l.gastos, 0)]; });
    ok(JSON.stringify(pr) === JSON.stringify([5, '2026-12-15', 92]), `Presupuesto 2027 guardado, cifrado como el resto, con su fecha de aprobación (${JSON.stringify(pr)})`);
    // 2026: Federación prevista en 80 € y gastado 85 €: se avisa
    await page.selectOption('#pp-anio', '2026'); await page.waitForSelector(`#pp-gastos-${fed}`);
    await page.fill(`#pp-gastos-${fed}`, '80'); await page.dispatchEvent(`#pp-gastos-${fed}`, 'change'); await page.click('#pp-form button[type=submit]'); await page.waitForTimeout(400);
    ok((await page.innerText('#pp-form')).includes('Real: 85,00 € (106 %) · por encima de lo previsto'), 'Presupuesto: ejecución por partida y aviso si un gasto pasa de lo previsto'); }
  ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'Presupuesto: en el móvil no se sale de la pantalla');
  if (process.env.CAPTURAS) await page.screenshot({ path: `${process.env.CAPTURAS}/presupuesto.png`, fullPage: true });
  { const doc = await page.evaluate(async () => { const d = await import('./js/documentos.js'); const t = await import('./js/tesoreria.js'); window.print = () => {};
      d.presupuestoDoc(t.ejecucion(2027)); await new Promise(r => setTimeout(r, 100)); const txt = document.querySelector('#impresion').textContent; window.dispatchEvent(new Event('afterprint')); return txt; });
    ok(doc.includes('Presupuesto 2027') && doc.includes('Aprobado en asamblea el 15/12/2026') && doc.includes('Resultado previsto') && doc.includes('Real 2026'), 'Presupuesto: documento para la asamblea, con lo real del año anterior'); }
  await irTes('cuentas'); await page.waitForSelector('#cc-doc'); await page.selectOption('#cc-anio', '2026'); await page.waitForTimeout(300);
  ok((await page.innerText('#cc-doc')).includes('Presupuesto') && (await page.innerText('#cc-doc')).includes('80,00 €'), 'Cuentas: columna del presupuesto junto a lo real');
  // Histórico de movimientos (todos los años) y cada año aparte
  await page.evaluate(async () => { const t = await import('./js/tesoreria.js'); await t.guardarMovimiento({ fecha: '2025-06-15', importe: '-30', concepto: 'Material del encuentro 2025' }); });
  await irTes('movimientos'); await page.waitForSelector('#mf-anio');
  ok(await page.$eval('#mf-anio', s => s.options[0].value === 'todos' && s.options[0].textContent.includes('Histórico')), 'Movimientos: el selector empieza por el histórico de todos los años');
  await page.selectOption('#mf-anio', 'todos'); await page.waitForSelector('#te-historico');
  { const filas = await page.$$eval('#te-historico tbody tr', trs => trs.map(t => t.textContent.replace(/\s+/g, ' ').trim()));
    const n = (await page.$$('#te-movs li')).length;
    ok(filas.length === 3 && filas[0].startsWith('2026') && filas[1].startsWith('2025') && filas[1].includes('30,00 €') && filas[2].startsWith('Total') && n === 9,
      `Histórico: resumen año por año, total y todos los movimientos (${filas.join(' | ')}; ${n} movimientos)`); }
  await page.click('[data-ir-anio="2025"]'); await page.waitForTimeout(300);
  ok(await page.$eval('#mf-anio', s => s.value) === '2025' && (await page.$$('#te-movs li')).length === 1 && !(await page.$('#te-historico')), 'Histórico: al tocar un año se ven solo sus movimientos');
  // Partidas desde Movimientos: añadir, editar, crear al clasificar y borrar pasando sus movimientos a otra
  await page.click('#te-partidas summary');
  await page.click('#te-partidas [data-nueva-partida]'); await page.fill('#dlg-pnombre', 'Lotería'); await page.selectOption('#dlg-ptipo', 'ingreso'); await page.click('dialog.dialogo button[value="si"]');
  await page.waitForTimeout(400);
  ok((await page.innerText('#te-partidas')).includes('Lotería') && await page.$eval('#te-partidas', d => d.open), 'Movimientos: añadir una partida sin salir de la pestaña');
  { const lot = await page.evaluate(async () => (await import('./js/tesoreria.js')).partidas().find(p => p.nombre === 'Lotería').id);
    await page.click(`#te-partidas [data-editar-partida="${lot}"]`); await page.fill('#dlg-pnombre', 'Lotería de Navidad'); await page.click('dialog.dialogo button[value="si"]'); await page.waitForTimeout(400);
    ok((await page.innerText('#te-partidas')).includes('Lotería de Navidad'), 'Movimientos: editar una partida (nombre y tipo)'); }
  await page.click('[data-editar-mov]'); await page.waitForSelector('#me-partida');
  await page.selectOption('#me-partida', '__nueva'); await page.fill('#dlg-pnombre', 'Material'); await page.selectOption('#dlg-ptipo', 'gasto'); await page.click('dialog.dialogo button[value="si"]');
  await page.waitForTimeout(400);
  { const sel = await page.$eval('#me-partida', s => s.selectedOptions[0].textContent);
    await page.fill('#me-nota', 'Mantener la nota'); await page.click('.mov-form button[type=submit]'); await page.waitForTimeout(400);
    const m = await page.evaluate(async () => { const t = await import('./js/tesoreria.js'); const x = t.movimientos({ anio: 2025 })[0]; return [t.nombrePartida(x.partida), x.nota]; });
    ok(sel === 'Material' && JSON.stringify(m) === JSON.stringify(['Material', 'Mantener la nota']), `Movimiento: «Nueva partida…» la crea y la deja elegida sin perder lo escrito (${JSON.stringify(m)})`); }
  { const mat = await page.evaluate(async () => (await import('./js/tesoreria.js')).partidas().find(p => p.nombre === 'Material').id);
    await page.click('#te-partidas summary').catch(() => {});
    if (!(await page.$eval('#te-partidas', d => d.open))) await page.click('#te-partidas summary');
    await page.click(`#te-partidas [data-borrar-partida="${mat}"]`);
    ok((await page.innerText('dialog[open]')).includes('Tiene 1 movimiento(s)'), 'Borrar partida con movimientos: pregunta a cuál pasan');
    await page.selectOption('#dlg-mover', { label: 'Material y difusión' }); await page.click('dialog.dialogo button[value="si"]'); await page.waitForTimeout(400);
    const m = await page.evaluate(async () => { const t = await import('./js/tesoreria.js'); return [t.nombrePartida(t.movimientos({ anio: 2025 })[0].partida), t.partidas().some(p => p.nombre === 'Material')]; });
    ok(JSON.stringify(m) === JSON.stringify(['Material y difusión', false]), `Borrar partida: sus movimientos pasan a la elegida (${JSON.stringify(m)})`); }
  // Aprender de lo que se clasifica a mano: el ordenante desconocido es de Bernat, y una regla desde un movimiento
  await page.selectOption('#mf-anio', '2026'); await page.fill('#mf-texto', 'fulano'); await page.waitForTimeout(300);
  await page.click('[data-editar-mov]'); await page.waitForSelector('#me-socio');
  await page.selectOption('#me-socio', { label: '2 · Bernat Prueba Dos' }); await page.click('.mov-form button[type=submit]'); await page.waitForTimeout(600);
  ok((await aviso()).includes('Aprendido: lo que llegue de «fulano desconocido» es de Bernat Prueba Dos'), `Aprender: el ordenante asignado a mano se recuerda (${await aviso()})`);
  { const r = await page.evaluate(async () => { const t = await import('./js/tesoreria.js');
      const serie = (iso) => (Date.parse(`${iso}T00:00:00Z`) - Date.UTC(1899, 11, 30)) / 86400000 + 1 + 1 / 12;
      await t.importarMovimientos([{ nombre: 'm', filas: [['IBAN', 'ES91 2100 0418 4502 0005 1332'], ['Fecha de la operación', 'Fecha valor', 'Tipo movimiento', 'Importe', 'Saldo', 'Nro. Apunte'], [serie('2026-11-20'), serie('2026-11-20'), 'trf. fulano desconocido', 25, 1055, 18]] }]);
      const m = t.movimientos({ texto: 'fulano' }).find(x => x.apunte === 18); return [t.socios().find(s => s.id === m.socio_id)?.nombre, t.nombrePartida(m.partida)]; });
    ok(JSON.stringify(r) === JSON.stringify(['Bernat', 'Cuotas de socios']), `Aprender: el siguiente pago de ese ordenante se asigna solo (${JSON.stringify(r)})`); }
  await page.evaluate(async () => { const t = await import('./js/tesoreria.js'); await t.guardarMovimiento({ fecha: '2026-11-21', importe: '-18,40', concepto: 'Compra de pienso' }); });
  await page.fill('#mf-texto', 'pienso'); await page.waitForTimeout(300);
  await page.click('[data-editar-mov]'); await page.waitForSelector('#me-partida');
  await page.selectOption('#me-partida', { label: 'Encuentros y exposiciones' }); await page.click('.mov-form button[type=submit]'); await page.waitForTimeout(500);
  ok((await aviso()).includes('«compra de pienso»') && (await page.innerText('#aviso')).includes('Sí, siempre'), `Clasificar a mano propone crear la regla (${await aviso()})`);
  await page.click('#aviso .toast-accion'); await page.waitForTimeout(500);
  ok(await page.evaluate(async () => (await import('./js/tesoreria.js')).reglas().some(r => r.texto === 'compra de pienso' && r.signo === '-')), 'Con «Sí, siempre» queda la regla para los siguientes');
  await page.fill('#mf-texto', ''); await page.waitForTimeout(200);
  await irTes('movimientos'); await page.waitForSelector('#te-movs');
  { const ancho = await page.evaluate(() => { const w = window.innerWidth; const fuera = [...document.querySelectorAll('main *')].filter(e => e.getBoundingClientRect().right > w + 1).slice(0, 3).map(e => `${e.tagName}#${e.id}.${e.className}`); return { sw: document.documentElement.scrollWidth, w, fuera }; });
    ok(ancho.sw <= ancho.w + 1, `Tesorería: en el móvil no se sale de la pantalla (${JSON.stringify(ancho)})`); }
  ok((await page.innerText('#te-huecos')).includes('entre el 09/10/2026 y el 02/11/2026'), 'Movimientos: el aviso del apunte que falta sigue al volver');
  // Hoja de tesorería del Club (la del Google Sheets en Excel; datos ficticios): Nº Socio, Concepto y Concepto ampliación
  await page.setInputFiles('#te-banco', 'tests/fixtures/hoja_tesoreria_ficticia.xlsx');
  await page.waitForSelector('#te-hoja-tes', { timeout: 8000 });
  { const txt = await page.innerText('#te-hoja-tes');
    const eq = await page.$$eval('[data-equiv]', ss => Object.fromEntries(ss.map(x => [x.closest('tr').cells[0].textContent, x.selectedOptions[0].textContent])));
    ok(txt.includes('MOVIMIENTOS2026 (5)') && !txt.includes('CUOTASOCIOS') && txt.includes('2 ya están en la app') && txt.includes('2 sin nº de apunte') && txt.includes('2 de 3 reconocidos'),
      `Hoja del Club: lee la hoja de movimientos (sin la fila de totales ni la hoja de cuotas) y dice qué hará (${txt.replace(/\s+/g, ' ').slice(0, 300)})`);
    ok(eq['Cuota socio'] === 'Cuotas de socios' && eq['Donación'] === 'Subvenciones y donativos' && eq['Anillas'] === 'Anillas' && eq['Rifa Enero 2026'] === 'Nueva partida: «Rifa Enero 2026»',
      `Hoja del Club: propone la partida de cada concepto (${JSON.stringify(eq)})`); }
  await page.click('#th-importar');
  await page.waitForSelector('#te-hoja-tes', { state: 'detached', timeout: 8000 });
  ok(/1 movimientos nuevos, 1 completados con la hoja y 1 sin cambios; 2 sin nº de apunte/.test(await aviso()) && (await aviso()).includes('2 partida(s) nueva(s)') && (await aviso()).includes('1 con el nº de socio por revisar'),
    `Hoja del Club: importada (${await aviso()})`);
  { const r = await page.evaluate(async () => { const t = await import('./js/tesoreria.js'); const ms = t.movimientos();
      const de = (c) => ms.find(m => m.concepto === c);
      return { don: t.nombrePartida(de('trf. donante anonimo').partida), anillas: de('trf. ana prueba uno anillas').nota, rifa: [t.nombrePartida(de('Rifa en mano').partida), de('Rifa en mano').nota, de('Rifa en mano').origen],
        huevos: t.partidas().find(p => p.nombre === 'Proyecto huevos gordos')?.tipo, huecos: t.comprobarSaldos().length }; });
    ok(r.don === 'Subvenciones y donativos' && r.anillas === 'Pedido de 10' && JSON.stringify(r.rifa) === JSON.stringify(['Rifa Enero 2026', 'Nº de socio en la hoja: REVISAR', 'manual']) && r.huevos === 'gasto' && r.huecos === 0,
      `Hoja del Club: el apunte que faltaba llega de la hoja, la nota completa el del banco y lo de efectivo queda a mano en su partida (${JSON.stringify(r)})`); }
  ok(!(await page.$('#te-huecos')), 'Movimientos: ya no falta ningún apunte');
  await page.setInputFiles('#te-banco', 'tests/fixtures/hoja_tesoreria_ficticia.xlsx');
  await page.waitForSelector('#te-hoja-tes', { timeout: 8000 });
  { const eq = await page.$$eval('[data-equiv]', ss => Object.fromEntries(ss.map(x => [x.closest('tr').cells[0].textContent, x.selectedOptions[0].textContent])));
    ok(eq['Rifa Enero 2026'] === 'Rifa Enero 2026' && eq['Proyecto huevos gordos'] === 'Proyecto huevos gordos', `Hoja del Club: recuerda las equivalencias de la vez anterior (${JSON.stringify(eq)})`); }
  await page.click('#th-importar'); await page.waitForSelector('#te-hoja-tes', { state: 'detached', timeout: 8000 });
  ok((await aviso()).includes('0 movimientos nuevos, 0 completados con la hoja y 5 sin cambios.') && !(await aviso()).includes('por revisar'), `Hoja del Club: importarla otra vez no duplica nada (${await aviso()})`);
  if (process.env.CAPTURAS) { await irTes('movimientos'); await page.waitForSelector('#te-movs'); await page.screenshot({ path: `${process.env.CAPTURAS}/tesoreria-movimientos.png`, fullPage: true }); }
  if (process.env.CAPTURAS) { await irTes('socios'); await page.waitForSelector('#te-buscar'); await page.fill('#te-buscar', ''); await page.screenshot({ path: `${process.env.CAPTURAS}/tesoreria.png`, fullPage: true }); }
}
await cambiarRolLocal('criador');
await ir('#/herramientas');
ok(!(await page.innerText('main')).includes('Tesorería del Club'), 'Tesorería: un criador no la ve en Herramientas');
await ir('#/tesoreria');
ok(!page.url().includes('#/tesoreria'), 'Tesorería: un criador no puede entrar ni escribiendo la dirección');
await cambiarRolLocal('administrador');
await ir('#/admin/supabase');
ok((await page.innerText('main')).includes('modo dispositivo'), 'Tareas en Supabase: en modo dispositivo explica que no hay servidor');
{ const sb = await page.evaluate(async () => { const m = await import('./js/vistas/adminsupabase.js'); return [m.refProyecto('https://mliunedrpbigybsovdyu.supabase.co'), m.refProyecto('')]; });
  ok(sb[0] === 'mliunedrpbigybsovdyu' && sb[1] === '', `Tareas en Supabase: saca la referencia del proyecto de la dirección del servidor (${sb[0]})`); }
await cambiarRolLocal('inspector');
ok(!(await page.$('main a[href="#/admin"]')) && await (async () => { await ir('#/admin'); return !page.url().includes('#/admin'); })(), 'El panel de administración no existe para el inspector');

// 6b-ter. Panel de inspección (con una solicitud por llamar: tarea pendiente)
await page.evaluate(async () => {
  const db = await import('./js/db.js'); const d = await import('./js/datos.js');
  const a = d.estado.todos.find(x => x.estado !== 'baja');
  await db.guardar('solicitudes', { id: '00000000-0000-4000-8000-0000000050a1', usuario_id: '00000000-0000-4000-8000-00000000a1a1', animales: [a.id], telefono: '612345678', horario: 'mañanas', estado: 'pendiente', fecha_visita: null, inspector_id: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
  await d.cargar();
});
await ir('#/herramientas');
{ const ins = await page.evaluate(async () => { const d = await import('./js/datos.js'); const n = d.tareasInspector().filter(x => x.nivel !== 'info').length; const a = document.querySelector('#barra a[data-ruta="herramientas"]'); return [n, a.querySelector('.insignia')?.textContent || '0', a.getAttribute('aria-label') || '']; });
  ok(Boolean(await page.$('main a[href="#/inspector"]')) && ins[0] > 0 && ins[1] === String(ins[0]) && ins[2].includes('de inspección'),
    `Inspector: «Panel de inspección» en Herramientas y número de tareas sobre Herramientas (${ins[0]})`); }
await ir('#/inspector');
{ const t = await page.innerText('main');
  ok(t.includes('Qué hay que hacer') && t.includes('solicitud(es) por llamar') && t.includes('casillas del dossier'), 'Panel de inspección: llamadas pendientes y huecos del dossier'); }
await page.fill('#in-buscar', '0001'); await page.waitForTimeout(200);
ok((await page.$$eval('#in-resultados a', l => l.map(a => a.getAttribute('href')))).every(h => h.startsWith('#/calificar/')) && (await page.$$('#in-resultados a')).length > 0, 'Panel de inspección: buscar por anilla abre la hoja de calificación');
await page.setViewportSize({ width: 1280, height: 800 });
await ir('#/inspecciones');
ok(await page.$eval('#barra a[data-ruta="inspector"]', a => getComputedStyle(a).display !== 'none' && a.getAttribute('aria-current') === 'page') && !(await page.$('#barra a[data-ruta="admin"]')),
  'Menú lateral del inspector (ordenador): «Inspección», marcada en sus pantallas, sin «Administración»');
await ir('#/herramientas');
ok(await page.$eval('main a[href="#/inspector"]', a => a.offsetParent === null), 'Ordenador: Herramientas no repite «Panel de inspección»');
await page.setViewportSize({ width: 390, height: 844 });
await page.evaluate(async () => { const db = await import('./js/db.js'); const d = await import('./js/datos.js'); await db.borrar?.('solicitudes', '00000000-0000-4000-8000-0000000050a1'); await d.cargar(); });

// 6c. Dossier fotográfico (Dirección Técnica)
await page.evaluate(async () => {
  const db = await import('./js/db.js');
  const d = await import('./js/datos.js');
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const g = d.estado.todos.find(a => a.anilla === 'E2418000002');
  await db.guardar('animales', { ...g, fotos: { ...(g.fotos || {}), lateral: png }, fotos_fecha: { lateral: '2025-06-01' } });
  await d.cargar();
});
await ir('#/dossier');
const txtDossier = await page.innerText('main');
ok((await page.$$('#app .dossier-celda img, main .dossier-celda img')).length === 1 && txtDossier.includes('falta gallo'),
  'Dossier: la foto aparece en su casilla (gallina adulta, Negra moteada) y señala que falta el gallo adulto');
ok((await page.$$('main .dossier-celda.falta')).length === 29, 'Dossier: marca las 29 casillas sin foto (5 variedades × 2 sexos × 3 edades − 1)');
if (process.env.CAPTURAS) await page.screenshot({ path: `${process.env.CAPTURAS}/dossier.png`, fullPage: true });
await ir('#/alta');
ok((await page.innerText('main')).includes('Cómo hacer una foto que sirva al Club') || await page.$eval('main', m => m.textContent.includes('Cómo hacer una foto que sirva al Club')), 'Alta: consejos para la foto de perfil');

{ // Fotos: cada una con cámara (capture) y galería (sin capture); la de galería también se guarda
  const huecos = await page.$$eval('main .foto-hueco', hs => hs.map(h => [...h.querySelectorAll('input[type=file]')].map(i => i.hasAttribute('capture'))));
  ok(huecos.length === 4 && huecos.every(x => x.length === 2 && x[0] === true && x[1] === false), 'Alta: cada foto se puede hacer con la cámara o elegir de la galería');
  ok(await page.$eval('#form-alta .foto-hueco:last-child', e => e.textContent.includes('Foto libre: perspectiva o detalle')), 'Alta: cuarta foto, libre (perspectiva o detalle)');
  await page.click('main details summary >> text=Más datos');
  const png1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
  await page.setInputFiles('#form-alta .foto-galeria input[data-foto=cabeza]', { name: 'cabeza.png', mimeType: 'image/png', buffer: png1 });
  await page.waitForSelector('#foto-cabeza img', { timeout: 5000 });
  ok(await page.$eval('#foto-cabeza', e => e.classList.contains('con-foto') && e.querySelector('.foto-vacio').hidden), 'Alta: la foto elegida de la galería aparece en su recuadro');
  ok(await page.isVisible('[data-quitar=cabeza]') && !(await page.isVisible('[data-quitar=tarsos]')), 'Alta: «Quitar foto» aparece solo donde hay foto');
  ok(!(await page.isVisible('#form-alta .foto-galeria:has(input[data-foto=cabeza])')), 'Alta: con foto, «Quitar foto» ocupa el sitio de la galería');
  await page.click('[data-quitar=cabeza]');
  ok((await page.innerText('dialog[open]')).includes('«Cabeza y orejilla»'), 'Alta: «Quitar foto» pide confirmación');
  await page.click('dialog[open] button[value=no]');
  ok(await page.$eval('#foto-cabeza', e => Boolean(e.querySelector('img'))), 'Alta: si se cancela, la foto se queda');
  await page.click('[data-quitar=cabeza]');
  await page.click('dialog[open] button[value=si]');
  await page.waitForFunction(() => !document.querySelector('#foto-cabeza img'), null, { timeout: 3000 }).catch(() => {});
  ok(await page.$eval('#foto-cabeza', e => !e.querySelector('img') && !e.classList.contains('con-foto') && !e.querySelector('.foto-vacio').hidden) && !(await page.isVisible('[data-quitar=cabeza]')),
    'Alta: «Quitar foto» la quita y el recuadro vuelve a «Hacer foto»');
  ok(await page.isVisible('#form-alta .foto-galeria:has(input[data-foto=cabeza])'), 'Alta: al quitarla vuelve «o elegir de la galería»');
  await page.setInputFiles('#form-alta .foto-galeria input[data-foto=cabeza]', { name: 'cabeza.png', mimeType: 'image/png', buffer: png1 });
  await page.waitForSelector('#foto-cabeza img', { timeout: 5000 });
  const orden = await page.$$eval('#form-alta .foto-hueco:first-child > :is(button, label):not([hidden])', a => a.map(x => x.textContent.trim()));
  ok(orden[0] === 'Hacer foto' && orden[1] === 'o elegir de la galería', `Alta: primero «Hacer foto» (cámara) y después la galería (${orden.join(', ')})`);
  // Ordenador: «Cámara» abre la webcam con vista previa y «Hacer foto» la pone en su recuadro
  await page.click('#foto-lateral');
  await page.waitForSelector('dialog.dialogo-camara[open] video', { timeout: 5000 });
  await page.waitForFunction(() => document.querySelector('dialog.dialogo-camara video')?.videoWidth > 0, null, { timeout: 5000 });
  await page.click('#camara-disparar');
  await page.waitForSelector('#foto-lateral img', { timeout: 5000 });
  ok(!(await page.$('dialog.dialogo-camara')) && await page.$eval('#foto-lateral', e => e.classList.contains('con-foto')),
    'Alta (ordenador): «Hacer foto» abre la webcam y la foto hecha aparece en su recuadro');
  // Varias fotos libres: al poner una aparece otro recuadro; al quitar una se renumeran
  const libres = () => page.$$eval('#a-fotos .foto-hueco', hs => hs.slice(3).map(h => [h.querySelector('.foto').id.slice(5), h.querySelector('.foto').classList.contains('con-foto')]));
  for (const k of ['libre', 'libre2', 'libre3']) {
    await page.setInputFiles(`#form-alta .foto-galeria input[data-foto=${k}]`, { name: `${k}.png`, mimeType: 'image/png', buffer: png1 });
    await page.waitForSelector(`#foto-${k} img`, { timeout: 5000 });
  }
  const l1 = await libres();
  ok(JSON.stringify(l1) === JSON.stringify([['libre', true], ['libre2', true], ['libre3', true], ['libre4', false]]) && (await page.innerText('#foto-libre2 + .foto-nombre')) === 'Foto libre 2',
    `Alta: varias fotos libres; con cada una aparece otro recuadro (${l1.map(x => x[0] + (x[1] ? '✓' : '')).join(', ')})`);
  await page.click('[data-quitar=libre2]'); await page.click('dialog[open] button[value=si]');
  await page.waitForFunction(() => !document.querySelector('#foto-libre4'), null, { timeout: 3000 }).catch(() => {});
  const l2 = await libres();
  ok(JSON.stringify(l2) === JSON.stringify([['libre', true], ['libre2', true], ['libre3', false]]), `Alta: al quitar una libre las demás se renumeran (${l2.map(x => x[0] + (x[1] ? '✓' : '')).join(', ')})`);
  const max = await page.evaluate(async () => { const m = await import('./js/vistas/alta.js'); return { max: m.MAX_LIBRES, ficha: m.fotosDe({ lateral: 'x', libre: 'y', libre2: 'z', libre9: 'w', otra: 'v' }).map(x => x[0]) }; });
  ok(max.max === 6 && JSON.stringify(max.ficha) === JSON.stringify(['lateral', 'cabeza', 'tarsos', 'libre', 'libre2']), `Ficha: muestra las tres fijas y las libres válidas (${max.ficha.join(', ')})`);
}
// 6d. Copia de seguridad
await ir('#/censo');
ok((await page.innerText('#censo-copia')).includes('copia de seguridad'), 'Mi censo recuerda hacer la copia de seguridad');
await ir('#/copia');
if (process.env.CAPTURAS) await page.screenshot({ path: `${process.env.CAPTURAS}/copia.png` });
const [descargaCopia] = await Promise.all([page.waitForEvent('download'), page.click('#cp-descargar')]);
const rutaCopia = await descargaCopia.path();
const textoCopia = (await import('node:fs')).readFileSync(rutaCopia, 'utf8');
const copiaJson = JSON.parse(textoCopia);
ok(descargaCopia.suggestedFilename().startsWith('AlacantinApp_copia_') && copiaJson.formato === 'alacantinapp-respaldo' && copiaJson.datos.animales.length === 3 && !textoCopia.includes('credenciales'),
  `Copia descargada en JSON sin contraseñas (${copiaJson.datos.animales.length} ejemplares)`);
await ir('#/censo');
ok((await page.innerText('#censo-copia')).trim() === '', 'Tras la copia desaparece el recordatorio');
const restauracion = await page.evaluate(async (copia) => {
  const db = await import('./js/db.js');
  const d = await import('./js/datos.js');
  const r = await import('./js/respaldo.js');
  const antes = (await db.todos('animales')).length;
  let basura;
  try { r.validarCopia({ hola: 1 }); basura = 'aceptada'; } catch (e) { basura = e.message; }
  for (const t of ['animales', 'calificaciones', 'huevos', 'campanas']) await db.vaciar(t);
  await d.cargar();
  const vacio = d.estado.todos.length;
  const { cuenta } = await r.restaurar(r.validarCopia(copia), d.estado.perfil, { modo: 'reemplazar' });
  await d.cargar();
  // Copia de "otro móvil": otra cuenta local -> los ejemplares pasan a la cuenta actual
  const otra = structuredClone(copia);
  const viejo = 'cuenta-antigua-movil';
  otra.perfil = { id: viejo, nombre: 'Yo en el móvil viejo' };
  otra.datos.animales = [{ ...copia.datos.animales[0], id: 'animal-movil-viejo', anilla: 'E2420000099', usuario_id: viejo, criador_id: viejo, padre_id: null, madre_id: null }];
  otra.datos.calificaciones = []; otra.datos.huevos = []; otra.datos.campanas = [];
  const { adoptada } = await r.restaurar(r.validarCopia(otra), d.estado.perfil, { modo: 'fusionar' });
  await d.cargar();
  const adoptado = d.animal('animal-movil-viejo');
  return { antes, vacio, restaurados: cuenta.animales, despues: d.estado.todos.length, basura, adoptada, titular: adoptado?.usuario_id === d.estado.perfil.id, editable: d.puedeEditar(adoptado) };
}, copiaJson);
ok(restauracion.vacio === 0 && restauracion.restaurados === restauracion.antes && restauracion.despues === restauracion.antes + 1,
  `Borrado total y restauración completa (${JSON.stringify(restauracion)})`);
ok(restauracion.basura.includes('no es una copia'), 'Rechaza archivos que no son copias de AlacantinApp');
ok(restauracion.adoptada && restauracion.titular && restauracion.editable, 'Copia de otro móvil: sus ejemplares pasan a la cuenta actual y se pueden editar');

// 6e. Las advertencias ámbar (aviso-caja aviso) se ven: no chocan con la clase de los mensajes emergentes
await ir('#/copia');
const ambar = await page.$$eval('.aviso-caja.aviso', els => els.map(e => { const c = getComputedStyle(e); return c.opacity === '1' && c.position !== 'fixed' && e.offsetHeight > 0; }));
ok(ambar.length > 0 && ambar.every(Boolean), `Advertencias ámbar visibles (${ambar.length})`);

// 6f. Reproducción e incubación: lote -> incubadora -> miraje y nacimiento -> alta del pollito con sus padres
const diasAtras = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
await ir('#/herramientas');
ok(!!(await page.$('main a[href="#/reproduccion"]')), 'Herramientas enlaza Reproducción e incubación');
await ir('#/reproduccion');
await page.click('#r-nuevo-lote');
await page.selectOption('#l-familia', 'A');
await page.selectOption('#l-gallo', { label: 'E2420000001' });
await page.fill('#l-inicio', diasAtras(60));
const fxLote = await page.$$eval('#l-gallinas label', ls => ls.map(l => l.textContent.replace(/\s+/g, ' ').trim()));
ok(fxLote.some(t => t.includes('E2518000003') && t.includes('Fx 25')), `Lote: muestra la consanguinidad de los pollitos con cada gallina (padre × hija = 25 %) (${fxLote.join(' | ').slice(0, 120)})`);
await page.check('#l-gallinas input[value]:not([disabled]) >> nth=0');
const idGallinaLote = await page.$eval('#l-gallinas input:checked', i => i.value);
await page.click('#f-lote button[type=submit]');
await page.waitForTimeout(500);
ok((await aviso()).includes('Lote guardado') && await page.$eval('main', m => m.textContent.includes('activo')), `Lote guardado y activo (${(await aviso()).slice(0, 90)})`);
const repetido = await page.evaluate(async (g) => { const d = await import('./js/datos.js'); const gallo = d.estado.todos.find(a => a.anilla === 'E2420000001'); try { await d.guardarLote({ gallo_id: gallo.id, gallinas: [g], inicio: new Date().toISOString().slice(0, 10) }); return 'aceptado'; } catch (e) { return e.message; } }, idGallinaLote);
ok(repetido.includes('ya está en el lote'), `Una gallina no puede estar en dos lotes a la vez (${repetido.slice(0, 70)})`);
await page.click('#r-nueva-inc');
await page.fill('#i-entrada', diasAtras(25));
await page.dispatchEvent('#i-entrada', 'change');
const filaPadre = await page.$eval(`#i-filas [data-madre="${idGallinaLote}"]`, i => i.closest('tr').textContent);
ok(filaPadre.includes('E2420000001'), 'Incubación: el padre sale del lote');
await page.$$eval('#i-filas [data-madre]', is => is.forEach(i => { i.value = ''; }));
await page.fill(`#i-filas [data-madre="${idGallinaLote}"]`, '6');
await page.click('#f-inc button[type=submit]');
await page.waitForTimeout(600);
ok(page.url().includes('#/incubacion/'), 'Incubación creada: abre su detalle');
ok((await page.$$('.pasos.calendario li.hecho')).length === 4, 'Calendario: entrada, miraje (día 7), nacedora (día 18) y nacimiento (día 21) ya pasados');
await page.fill('[data-claros="0"]', '1');
await page.fill('[data-nacidos="0"]', '4');
await page.click('#f-inc-det button[type=submit]');
await page.waitForTimeout(500);
const kpisInc = await page.$$eval('.kpi b', bs => bs.map(b => b.textContent.trim()));
ok(kpisInc[0] === '6' && kpisInc[1] === '83 %' && kpisInc[2] === '80 %', `Fertilidad 5/6 = 83 % y nacimiento 4/5 = 80 % (${kpisInc.join(' · ')})`);
const malos = await page.evaluate(async () => { const d = await import('./js/datos.js'); const inc = d.estado.incubaciones[0]; try { await d.actualizarIncubacion(inc.id, { filas: [{ nacidos: 6 }] }); return 'aceptado'; } catch (e) { return e.message; } });
ok(malos.includes('máximo 5'), `No admite más nacidos que huevos fértiles (${malos.slice(0, 60)})`);
await page.click('main a.btn-primario[href^="#/alta?inc="]');
await page.waitForTimeout(500);
const pre = await page.evaluate(() => ({ madre: document.querySelector('#a-madre').value, padre: document.querySelector('#a-padre').selectedOptions[0]?.textContent, fecha: document.querySelector('#a-fecha').value }));
ok(pre.madre === idGallinaLote && pre.padre.includes('E2420000001') && pre.fecha === diasAtras(4), `Alta del pollito con madre, padre y fecha de nacimiento ya puestos (${pre.padre} · ${pre.fecha})`);
await page.fill('#a-num', '40');
await page.click('#form-alta label[data-sexo="H"]');
await page.selectOption('#a-variedad', 'blanca');
await page.click('#form-alta button[type=submit]');
await page.waitForTimeout(800);
ok(page.url().includes('#/animal/'), `Pollito dado de alta (${(await aviso()).slice(0, 80)})`);
const vinc = await page.evaluate(async () => { const d = await import('./js/datos.js'); const f = d.estado.incubaciones[0].filas[0]; return { pollitos: f.pollitos.length, pendientes: d.pollitosPendientes().reduce((s, x) => s + x.pendientes, 0) }; });
ok(vinc.pollitos === 1 && vinc.pendientes === 3, `El pollito queda unido a su incubación (quedan ${vinc.pendientes} por dar de alta)`);
await ir('#/alta');
ok(await page.$eval('#a-pollitos', e => e.textContent.includes('3 pollito(s)') && Boolean(e.querySelector('a[href^="#/alta?inc="]'))) && await page.$eval('#barra a.principal', a => a.dataset.ruta === 'alta'),
  'Alta Rápida: destacada en la barra y, arriba, los pollitos de incubación pendientes con su enlace');
await page.click('#a-pollitos a[href^="#/alta?inc="]'); await page.waitForTimeout(500);
ok(!(await page.$('#a-pollitos')) && await page.$eval('#a-madre', s => s.value !== ''), 'Desde el aviso, el alta llega con la madre puesta y sin repetir el aviso');
const sugerido = await page.evaluate(async (g) => {
  location.hash = '#/censo'; await new Promise(r => setTimeout(r, 300)); location.hash = '#/alta'; await new Promise(r => setTimeout(r, 400));
  const f = document.querySelector('#form-alta'); f.querySelector('#a-fecha').value = new Date(Date.now() - 2 * 864e5).toISOString().slice(0, 10);
  f.querySelector('#a-madre').value = g; f.querySelector('#a-madre').dispatchEvent(new Event('change', { bubbles: true }));
  return f.querySelector('#a-padre').selectedOptions[0]?.textContent || '';
}, idGallinaLote);
ok(sugerido.includes('E2420000001'), `Alta normal: al elegir la madre, propone el gallo de su lote (${sugerido})`);
if (process.env.CAPTURAS) { await ir('#/reproduccion'); await page.screenshot({ path: `${process.env.CAPTURAS}/reproduccion.png`, fullPage: true }); }
await ir('#/censo');

// 6g. Solicitud de inspección: el criador la pide, el inspector llama y programa, el criador la ve
await cambiarRolLocal('criador');
await ir('#/censo'); await ir('#/alta');
await page.fill('#a-num', '41'); await page.click('#form-alta label[data-sexo="H"]'); await page.selectOption('#a-variedad', 'blanca'); await page.fill('#a-fecha', '2025-05-01');
await page.click('#form-alta button[type=submit]'); await page.waitForTimeout(700);
await ir('#/censo');
await page.waitForSelector('#censo-hoy .tarjeta-hoy', { timeout: 3000 }).catch(() => {});
const hoyCenso = await page.$eval('#censo-hoy', e => e.textContent.replace(/\s+/g, ' ')).catch(() => '—');
if (process.env.CAPTURAS) await page.screenshot({ path: `${process.env.CAPTURAS}/censo-hoy.png` });
ok(hoyCenso.includes('con un año sin calificar') && hoyCenso.includes('Hoy'), `Mi censo («Hoy»): invita a solicitar la inspección de los ejemplares con un año (${hoyCenso.slice(0, 90)})`);
await ir('#/inspeccion');
const idSol41 = await page.evaluate(async () => (await import('./js/datos.js')).estado.todos.find(a => a.anilla === 'E2518000041').id);
ok(!!(await page.$(`#f-sol input[value="${idSol41}"]:checked`)), 'Solicitud: el ejemplar de un año sin calificar aparece marcado');
ok(await page.$eval('main', m => m.textContent.includes('Próximos') && m.textContent.includes('E2618000040')), 'Solicitud: el pollito sale en «Próximos» con la fecha en que cumple el año');
await page.$$eval('#f-sol input[name=sol-a]', is => is.forEach(i => { i.checked = false; }));
await page.check(`#f-sol input[value="${idSol41}"]`);
await page.fill('#sol-tel', '');
await page.click('#f-sol button[type=submit]'); await page.waitForTimeout(300);
ok((await aviso()).includes('teléfono'), 'Solicitud: el teléfono es obligatorio');
await page.fill('#sol-tel', '612 345 678');
await page.selectOption('#sol-horario', 'tardes');
await page.click('#f-sol button[type=submit]'); await page.waitForTimeout(600);
const trasSol = await page.evaluate(async () => { const d = await import('./js/datos.js'); let otra; try { await d.crearSolicitud({ animales: [], telefono: '600000000' }); otra = 'aceptada'; } catch (e) { otra = e.message; } return { tel: d.estado.perfil.telefono, texto: document.querySelector('#sol-abierta')?.textContent || '', otra }; });
ok(trasSol.texto.includes('Pendiente') && trasSol.texto.includes('Tardes') && trasSol.tel === '612 345 678', `Solicitud enviada y el teléfono queda en Mi aviario (${trasSol.tel})`);
ok(trasSol.otra.includes('Ya tienes una solicitud abierta'), 'Solo una solicitud abierta a la vez');
await cambiarRolLocal('inspector');
await ir('#/herramientas');
ok(await page.$eval('main a[href="#/inspector"]', a => a.textContent.includes('1 tarea(s) pendiente(s)')), 'Herramientas del inspector: el Panel de inspección avisa de 1 tarea (la solicitud por llamar)');
await ir('#/inspecciones');
const panel = await page.evaluate(() => ({ tel: document.querySelector('form[data-sol] a[href^="tel:"]')?.getAttribute('href'), wa: document.querySelector('form[data-sol] a[href^="https://wa.me/"]')?.getAttribute('href') || '', calificar: !!document.querySelector('form[data-sol] a[href^="#/calificar/"]'), realizadaOff: document.querySelector('[data-accion="realizada"]')?.disabled }));
ok(panel.tel === 'tel:+34612345678' && panel.wa.startsWith('https://wa.me/34612345678?text='), `Panel: llamar y WhatsApp con prefijo 34 (${panel.tel})`);
ok(panel.calificar && panel.realizadaOff, 'Panel: enlace para calificar cada ejemplar; «realizada» bloqueada hasta calificar alguno');
await page.click('[data-accion="anulada"]'); await page.waitForTimeout(300);
ok((await aviso()).includes('por qué'), 'Anular exige explicar el motivo al criador');
const manana = new Date(Date.now() + 864e5).toISOString().slice(0, 10);
await page.fill('form[data-sol] [name=fecha]', manana);
await page.fill('form[data-sol] [name=respuesta]', 'Iré a las 10 h');
await page.click('[data-accion="programada"]'); await page.waitForTimeout(500);
ok(await page.$eval('form[data-sol] .chip', c => c.textContent.includes('programada')), 'El inspector programa la visita');
if (process.env.CAPTURAS) await page.screenshot({ path: `${process.env.CAPTURAS}/inspecciones.png`, fullPage: true });
await cambiarRolLocal('criador');
await ir('#/inspeccion');
ok(await page.$eval('#sol-abierta', e => e.textContent.includes('Visita el') && e.textContent.includes('Iré a las 10 h')), 'El criador ve la fecha de la visita y el mensaje del inspector');
if (process.env.CAPTURAS) await page.screenshot({ path: `${process.env.CAPTURAS}/inspeccion.png`, fullPage: true });
await page.click('#sol-anular'); await page.click('dialog button[value="si"]'); await page.waitForTimeout(500);
ok(!(await page.$('#sol-abierta')) && await page.$eval('main', m => m.textContent.includes('Anulada')), 'El criador puede anular su solicitud y queda en el historial');
await cambiarRolLocal('inspector');
await ir('#/censo');

// 6h. Auditoría del Libro y pureza de variedad (inspector: todo el Libro)
await page.evaluate(async () => {
  const db = await import('./js/db.js'); const d = await import('./js/datos.js');
  const gallina = d.estado.todos.find(a => a.anilla === 'E2418000002');
  const yo = d.estado.perfil.id;
  // Datos imposibles a propósito: «padre» que es una gallina y nació después que el hijo; anilla de otro año
  await db.guardar('animales', { id: 'au-malo', usuario_id: yo, criador_id: yo, anilla: 'E2318000077', sexo: 'H', variedad: 'blanca', fecha_nacimiento: '2022-04-01', padre_id: gallina.id, madre_id: null, seccion: 'RN', estado: 'activo', created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
  await d.cargar();
});
await ir('#/auditoria');
const au = await page.evaluate(() => ({ tipos: [...document.querySelectorAll('.auditoria-grupo')].map(d => d.dataset.tipo), kpis: [...document.querySelectorAll('.kpi b')].map(b => b.textContent),
  pureza: [...document.querySelectorAll('#pureza tbody tr')].map(t => t.textContent.replace(/\s+/g, ' ').trim()), malo: [...document.querySelectorAll('.auditoria-grupo li')].filter(li => li.textContent.includes('E2318000077')).map(li => li.textContent.replace(/\s+/g, ' ').trim()) }));
ok(['anilla_invalida', 'sexo_progenitor', 'edad_progenitor', 'sin_padres', 'variedad_padres'].every(t => au.tipos.includes(t)), `Auditoría: detecta anilla incoherente, sexo y edad del padre, falta de padres y variedad distinta de los padres (${au.tipos.join(', ')})`);
ok(au.malo.some(t => t.includes('nació después')) && au.malo.some(t => t.includes('registrado como hembra')) && au.malo.some(t => t.includes('Corregir')), 'Auditoría: explica cada incoherencia y enlaza para corregirla');
ok(au.pureza.some(t => t.startsWith('Blanca')) && au.pureza.some(t => t.startsWith('Negra moteada')), `Auditoría: pureza por variedad (${au.pureza.join(' | ').slice(0, 120)})`);
if (process.env.CAPTURAS) await page.screenshot({ path: `${process.env.CAPTURAS}/auditoria.png`, fullPage: true });
const [descargaAu] = await Promise.all([page.waitForEvent('download'), page.click('#au-csv')]);
ok(descargaAu.suggestedFilename().startsWith('AlacantinApp_auditoria_'), 'Auditoría descargable en CSV');
await page.evaluate(async () => { const db = await import('./js/db.js'); await db.borrar('animales', 'au-malo'); await (await import('./js/datos.js')).cargar(); });
const idHija3 = await page.evaluate(async () => (await import('./js/datos.js')).estado.todos.find(a => a.anilla === 'E2518000003').id);
await ir(`#/animal/${idHija3}`);
ok(await page.$eval('#ficha-pureza', e => e.textContent.includes('0 de 5') && e.textContent.includes('Negra moteada (padres)')), 'Ficha: pureza de variedad (hija blanca de padres negra moteada: 0 de 5 generaciones)');
await ir('#/censo');

// 6i. Acta anual de cierre censal (inspección: todo el Libro) y resumen anual del criador
const anioActual = new Date().getFullYear();
await ir(`#/acta?anio=${anioActual}`);
const acta = await page.evaluate(async (y) => {
  const d = await import('./js/datos.js');
  const r = d.resumenAnual(y);
  const t = document.querySelector('#acta-anual')?.textContent.replace(/\s+/g, ' ') || '';
  return { t, total: r.censo.total, vivos: d.censo().filter(a => a.estado !== 'baja').length, nac: r.movimientos.nacidos.total, rep: r.reproduccion, firmas: document.querySelectorAll('#acta-anual .doc-firmas div').length };
}, anioActual);
ok(acta.t.includes(`Acta de cierre censal ${anioActual}`) && acta.total === acta.vivos && acta.firmas === 3, `Acta anual: censo a la fecha (${acta.total} ejemplares) y tres firmas (Dirección Técnica, Secretaría, Presidencia)`);
ok(acta.rep.incubaciones === 1 && acta.rep.puestos === 6 && acta.rep.nacidos === 4 && Math.round(acta.rep.fertilidad * 100) === 83, `Acta anual: reproducción del año (1 incubación, 6 huevos, 4 nacidos, fertilidad ${Math.round(acta.rep.fertilidad * 100)} %)`);
ok(acta.t.includes('Variabilidad genética') && acta.t.includes('Control de puesta') && acta.t.includes('Criadores y distribución'), 'Acta anual: genética, puesta y distribución territorial');
await page.selectOption('#ac-anio', String(anioActual - 1)); await page.waitForTimeout(300);
const acta2 = await page.evaluate(async (y) => { const r = (await import('./js/datos.js')).resumenAnual(y); return { corte: r.corte, pollito: r.censo.total, t: document.querySelector('#acta-anual').textContent }; }, anioActual - 1);
ok(acta2.corte === `${anioActual - 1}-12-31` && acta2.t.includes(`31/12/${anioActual - 1}`) && acta2.pollito < acta.total, `Año anterior: censo a 31 de diciembre, sin los nacidos después (${acta2.pollito} ejemplares)`);
if (process.env.CAPTURAS) { await page.selectOption('#ac-anio', String(anioActual)); await page.waitForTimeout(300); await page.screenshot({ path: `${process.env.CAPTURAS}/acta-anual.png`, fullPage: true }); }
await page.evaluate(() => { window.__impreso = false; window.print = () => { window.__impreso = true; }; });
await page.click('#ac-imprimir'); await page.waitForTimeout(200);
ok(await page.evaluate(() => window.__impreso && document.querySelector('#impresion').textContent.includes('Acta de cierre censal')), 'Acta anual: se imprime o se guarda en PDF');
await cambiarRolLocal('criador');
await ir('#/acta');
ok(await page.$eval('#acta-anual', e => e.textContent.includes('Resumen anual') && e.textContent.includes('Titular') && !e.textContent.includes('Criadores y distribución') && e.querySelectorAll('.doc-firmas div').length === 2), 'Criador: resumen anual de su aviario, con su firma y la de la Dirección Técnica');
await cambiarRolLocal('inspector');
await ir('#/censo');

// 6j. Uso en campo con una mano: puesta con un toque por gallina, botón fijo, alta en serie
await cambiarRolLocal('criador');
await ir('#/herramientas'); await page.waitForTimeout(300);
const movil = await page.$eval('#h-movil', e => e.textContent.replace(/\s+/g, ' '));
ok(movil.includes('Aún no está instalada') && movil.includes('Espacio usado') && /protegidos|sin proteger/.test(movil), `Herramientas: estado de la app en el móvil (instalación, datos protegidos y espacio) (${movil.slice(0, 90)})`);
const persist = await page.evaluate(async () => (await import('./js/instalacion.js')).pedirPersistencia());
ok(persist !== undefined, `Se pide al navegador que conserve los datos (respuesta: ${persist})`);
await ir('#/puesta');
const botonesG = await page.$$eval('#pu-rejilla .boton-gallina', bs => bs.map(b => ({ txt: b.textContent.trim(), alto: b.getBoundingClientRect().height })));
ok(botonesG.length >= 3 && botonesG.every(b => b.alto >= 60), `Puesta: rejilla de gallinas con botones grandes (${botonesG.length}, ${Math.round(botonesG[0]?.alto)} px)`);
await page.click('#pu-rejilla .boton-gallina >> nth=0');
ok(await page.evaluate(() => document.activeElement?.id === 'pu-peso' && document.querySelector('#pu-gallina').value !== ''), 'Puesta: tocar una gallina la elige y pone el cursor en el peso');
ok(await page.evaluate(() => document.body.classList.contains('escribiendo') && getComputedStyle(document.querySelector('#barra')).display === 'none'), 'Con el teclado abierto se oculta la barra inferior (más espacio)');
await page.fill('#pu-peso', '63'); await page.press('#pu-peso', 'Enter');
const fijo = await page.evaluate(() => { const b = document.querySelector('#pu-guardar').getBoundingClientRect(); return { visible: b.bottom <= window.innerHeight && b.top >= 0, alto: b.height, texto: document.querySelector('#pu-guardar').textContent }; });
ok(fijo.visible && fijo.alto >= 48 && fijo.texto.includes('1 huevo'), `Puesta: «Guardar» siempre a la vista y grande (${Math.round(fijo.alto)} px)`);
await page.click('#pu-guardar'); await page.waitForTimeout(500);
ok(await page.$$eval('#pu-rejilla .boton-gallina.hecha', bs => bs.length >= 1), 'Puesta: la gallina queda marcada con ✓ al guardar');
const toastArriba = await page.evaluate(() => { const r = document.querySelector('#aviso').getBoundingClientRect(); return r.top < window.innerHeight / 2; });
ok(toastArriba, 'En el móvil los mensajes salen arriba, sin tapar el campo ni el pulgar');
await page.evaluate(() => document.activeElement?.blur());
// Alta en serie: «Guardar y otro» mantiene madre, padre, fecha y variedad y sube el número de anilla
await ir('#/censo'); await ir('#/alta');
await page.fill('#a-num', '60'); await page.click('#form-alta label[data-sexo="H"]'); await page.selectOption('#a-variedad', 'blanca'); await page.fill('#a-fecha', '2025-04-02');
await page.evaluate(async () => { const d = await import('./js/datos.js'); const m = d.estado.todos.find(a => a.anilla === 'E2418000002'); const s = document.querySelector('#a-madre'); s.value = m.id; s.dispatchEvent(new Event('change', { bubbles: true })); });
await page.click('#a-otro'); await page.waitForTimeout(900);
const serie = await page.evaluate(() => ({ num: document.querySelector('#a-num').value, fecha: document.querySelector('#a-fecha').value, variedad: document.querySelector('#a-variedad').value, madre: document.querySelector('#a-madre').value, sexo: document.querySelector('#a-sexo').value, existe: !!document.querySelector('#form-alta') }));
ok(serie.existe && serie.num === '61' && serie.fecha === '2025-04-02' && serie.variedad === 'blanca' && serie.madre && serie.sexo === '', `«Guardar y otro»: siguiente anilla (${serie.num}) con la misma madre, fecha y variedad; el sexo se elige de nuevo (${(await aviso()).slice(0, 80)})`);
await page.evaluate(async () => { const d = await import('./js/datos.js'); const db = await import('./js/db.js'); const x = d.estado.todos.find(a => a.anilla === 'E2518000060'); if (x) await db.borrar('animales', x.id); await d.cargar(); });
await cambiarRolLocal('inspector');
await ir('#/censo');

// 6k. «Hoy», primeros pasos, «Deshacer» y buscador por anilla
await cambiarRolLocal('criador');
const agenda = await page.evaluate(async () => {
  const d = await import('./js/datos.js');
  const ent = new Date(Date.now() - 7 * 864e5); const iso = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  const g = d.estado.todos.find(a => a.anilla === 'E2418000002');
  const inc = await d.crearIncubacion({ entrada: iso(ent), filas: [{ madre_id: g.id, puestos: 4 }] });
  const t = d.agendaHoy();
  return { inc: inc.id, textos: t.map(x => `${x.nivel}:${x.texto}`) };
});
ok(agenda.textos.some(x => x.startsWith('hoy:Miraje')), `«Hoy»: la incubación de hace 7 días pide el miraje (${agenda.textos.slice(0, 3).join(' | ')})`);
await ir('#/hoy'); await page.waitForTimeout(300);
const pHoy = await page.evaluate(() => ({ t: document.querySelector('main').textContent.replace(/\s+/g, ' '), pasos: document.querySelectorAll('#primeros-pasos li').length, hechos: document.querySelectorAll('#primeros-pasos li.hecho').length }));
ok(pHoy.t.includes('Miraje') && pHoy.t.includes('Este mes') && pHoy.t.includes('Próximos días'), 'Pantalla «Hoy»: tareas de hoy, próximos días y lo propio del mes');
ok(pHoy.pasos === 6 && pHoy.hechos >= 3 && pHoy.hechos < 6, `Primeros pasos con su estado (${pHoy.hechos} de ${pHoy.pasos} hechos)`);
if (process.env.CAPTURAS) await page.screenshot({ path: `${process.env.CAPTURAS}/hoy.png`, fullPage: true });
await page.click('#pasos-ocultar'); await page.waitForTimeout(300);
ok(!(await page.$('#primeros-pasos')), 'Los primeros pasos se pueden ocultar');
await page.evaluate(async (id) => { const d = await import('./js/datos.js'); const db = await import('./js/db.js'); await db.borrar('incubaciones', id); await d.cargar(); }, agenda.inc);
// Deshacer: borrar un huevo sin preguntar y recuperarlo con un toque
await ir('#/puesta'); await page.waitForTimeout(300);
const nHuevos = await page.evaluate(async () => (await import('./js/datos.js')).estado.huevos.length);
await page.click('[data-borrar] >> nth=0'); await page.waitForTimeout(400);
const trasBorrar = await page.evaluate(async () => ({ n: (await import('./js/datos.js')).estado.huevos.length, dialogo: !!document.querySelector('dialog[open]'), boton: document.querySelector('#aviso .toast-accion')?.textContent }));
ok(trasBorrar.n === nHuevos - 1 && !trasBorrar.dialogo && trasBorrar.boton === 'Deshacer', 'Borrar un huevo: sin «¿Seguro?», con «Deshacer» en el mensaje');
await page.click('#aviso .toast-accion'); await page.waitForTimeout(400);
ok(await page.evaluate(async () => (await import('./js/datos.js')).estado.huevos.length) === nHuevos, '«Deshacer» recupera el huevo');
// Buscador por anilla en la cabecera
await page.click('#boton-buscar');
await page.fill('#buscar-q', '41');
const resBusca = await page.$$eval('#buscar-res .item-titulo', xs => xs.map(x => x.textContent));
ok(resBusca.length === 1 && resBusca[0].startsWith('E2518000041'), `Buscar «41» encuentra solo la anilla E2518000041, sin confundir el año ni el diámetro (${resBusca.join(', ')})`);
if (process.env.CAPTURAS) await page.screenshot({ path: `${process.env.CAPTURAS}/buscar.png` });
await page.press('#buscar-q', 'Enter'); await page.waitForTimeout(400);
ok(page.url().includes('#/animal/') && !(await page.$('#buscador')), 'Intro abre la ficha y cierra el buscador');
await page.keyboard.press('/'); await page.waitForTimeout(200);
ok(!!(await page.$('#buscador[open]')), 'En el ordenador, la tecla «/» abre el buscador');
await page.keyboard.press('Escape');
// Modo sol: se elige en Herramientas, se aplica al momento y se recuerda al volver a abrir
await ir('#/herramientas');
await page.click('input[name=h-tema][value=sol] + span');
const sol1 = await page.evaluate(() => ({ tema: document.documentElement.dataset.tema, letra: getComputedStyle(document.documentElement).fontSize }));
await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForSelector('#barra a');
const sol2 = await page.evaluate(() => document.documentElement.dataset.tema);
ok(sol1.tema === 'sol' && sol1.letra === '18px' && sol2 === 'sol', `Modo sol: alto contraste y letra mayor (${sol1.letra}), recordado al volver a abrir`);
await ir('#/herramientas'); await page.click('input[name=h-tema][value=auto] + span');
ok(await page.evaluate(() => !document.documentElement.dataset.tema), 'Volver al tema automático');
// Informe de problemas: los errores quedan anotados sin datos personales
await page.evaluate(async () => { const d = await import('./js/diagnostico.js'); d.borrarErrores(); d.anotarError('Fallo de prueba con criadora@ejemplo.es', 'prueba.js:1'); });
await ir('#/problema'); await page.waitForTimeout(300);
const inf = await page.$eval('.pre-informe', e => e.textContent);
ok(inf.includes('Fallo de prueba con [correo]') && !inf.includes('criadora@ejemplo.es') && !inf.includes('Criadora') && inf.includes('AlacantinApp 7.'), 'Informe de problemas: versión, conexión y últimos errores, sin nombre ni correo');
{ // La CSP de _headers (script-src 'self') bloquea los scripts en línea
  const html = await (await fetch('http://localhost:8820/index.html')).text();
  ok(!/<script(?![^>]*\bsrc=)[^>]*>/i.test(html), 'index.html sin scripts en línea (CSP de _headers)');
}
ok(!!(await page.$('#pr-wa')) && !!(await page.$('#pr-mail')) && !!(await page.$('#pr-copiar')), 'Informe de problemas: enviar por WhatsApp, por correo o copiar');
await page.evaluate(async () => (await import('./js/diagnostico.js')).borrarErrores());
await cambiarRolLocal('inspector');
await ir('#/censo');

// 6l. Privacidad: política pública, ubicación con consentimiento y borrable, descarga de los datos propios
await cambiarRolLocal('criador');
await ir('#/privacidad');
const pol = await page.$eval('main', m => m.textContent.replace(/\s+/g, ' '));
ok(pol.includes('G21807508') && pol.includes('Calle Doctor Fleming, 16, 1.º, puerta 7, 03720 Benissa (Alicante)'), 'Política: responsable con NIF y domicilio del Club');
ok(['Quién es el responsable', 'Qué datos tratamos', 'base legal', 'Quién ve tus datos', 'Supabase', 'Cloudflare', 'Cuánto tiempo', 'Tus derechos', 'Agencia Española de Protección de Datos', '14 años'].every(x => pol.includes(x)), 'Política de privacidad completa (responsable, datos, bases legales, destinatarios, proveedores, plazos, derechos, AEPD, edad)');
await page.evaluate(async () => { const d = await import('./js/datos.js'); const auth = await import('./js/auth.js'); const { perfil } = await auth.actualizarPerfil(d.estado.perfil, { latitud: 38.27, longitud: -0.7 }); d.estado.perfil = perfil; });
await ir('#/censo'); await ir('#/perfil');
await page.click('#pf-borrar-gps'); await page.waitForTimeout(500);
ok(await page.evaluate(async () => (await import('./js/datos.js')).estado.perfil.latitud == null) && (await page.innerText('#pf-gps')).includes('Sin ubicación'), 'Mi aviario: la ubicación (consentimiento) se borra con un toque');
const [misDatos] = await Promise.all([page.waitForEvent('download'), page.click('#pf-descargar')]);
const md = JSON.parse(fs.readFileSync(await misDatos.path(), 'utf8'));
ok(misDatos.suggestedFilename().startsWith('AlacantinApp_mis_datos_') && md.perfil.email === 'criadora@ejemplo.es' && md.ejemplares.length >= 3 && !JSON.stringify(md).includes('clave-segura'), `Descargar mis datos: perfil, ${md.ejemplares.length} ejemplares, huevos y calificaciones, sin contraseña`);
ok((await page.getAttribute('#pf-derechos', 'href')).startsWith('mailto:clubalacantina@gmail.com'), 'Pedir la baja o ejercer un derecho: correo al Club');
await cambiarRolLocal('inspector');
await ir('#/censo');

// 7. Sincronización con servidor simulado: un error no borra la operación
const res = await page.evaluate(async () => {
  const sync = await import('./js/sync.js');
  let llamadas = 0;
  const fake = {
    auth: { getSession: async () => ({ data: { session: { user: {} } } }) },
    storage: { from: () => ({ upload: async () => ({ error: null }), getPublicUrl: () => ({ data: { publicUrl: 'https://x.supabase.co/f.webp' } }) }) },
    from: () => ({ upsert: () => { const r = ++llamadas === 1 ? { error: { message: 'fallo simulado' } } : { data: null, error: null }; const p = Promise.resolve(r); p.select = () => ({ maybeSingle: async () => r }); return p; },
      delete: () => ({ eq: async () => ({ error: null }) }) })
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

// 7a. Dos personas cambian la misma ficha sin cobertura: se juntan los cambios y el mismo dato no se pisa
const fusion = await page.evaluate(async () => {
  const sync = await import('./js/sync.js'); const db = await import('./js/db.js'); const d = await import('./js/datos.js');
  // Función pura
  const f = sync.fusionar({ a: 1, b: 1, c: 1, sync_ts: 't1' }, { a: 2, b: 1, c: 5, sync_ts: 't1' }, { a: 1, b: 3, c: 7, sync_ts: 't2' });
  const g = (await db.todos('animales')).find(x => x.sexo === 'M' && x.estado !== 'baja');
  const base = { ...g, familia: 'A', peso_g: 2500, seccion: 'RD', sync_ts: '2026-11-21T10:00:00Z' };
  const servidor = { ...base, seccion: 'RM', peso_g: 2600, updated_at: '2026-11-21T11:00:00Z', sync_ts: '2026-11-21T11:00:01Z' };   // la administración
  const local = { ...base, familia: 'B', peso_g: 2700, updated_at: '2026-11-21T12:00:00Z' };                                          // el criador, sin cobertura
  await db.guardar('animales', local);
  const llamadas = [];
  const fake = {
    auth: { getSession: async () => ({ data: { session: { user: {} } } }) },
    from: (t) => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: servidor, error: null }) }) }),
      update: (parche) => ({ eq: () => ({ select: () => ({ maybeSingle: async () => { llamadas.push(['update', parche]); Object.assign(servidor, parche, { sync_ts: '2026-11-21T12:30:00Z' }); return { data: { ...servidor }, error: null }; } }) }) }),
      upsert: (r) => { llamadas.push(['upsert', r]); const p = Promise.resolve({ error: null }); p.select = () => ({ maybeSingle: async () => ({ data: r, error: null }) }); return p; }
    })
  };
  sync.usarCliente(fake);
  for (const i of await db.todos('cola')) await db.borrar('cola', i.n);
  await db.guardar('cola', { tabla: 'animales', op: 'upsert', id: g.id, registro: local, base, creado: Date.now(), intentos: 0, error: null });
  const r = await sync.drenar();
  const enMovil = await db.obtener('animales', g.id);
  await d.cargar();
  const conf = await d.conflictos();
  sync.usarCliente(null);
  return { f, r, llamadas, enMovil: { seccion: enMovil.seccion, familia: enMovil.familia, peso: enMovil.peso_g }, conf: conf.map(c => [c.campo, c.mioTexto, c.servidorTexto]), id: g.id, anilla: g.anilla };
});
ok(JSON.stringify(fusion.f) === JSON.stringify({ parche: { a: 2 }, conflictos: ['c'] }), `Fusión: lo cambiado solo aquí se envía y lo cambiado en los dos sitios es conflicto (${JSON.stringify(fusion.f)})`);
ok(fusion.llamadas.length === 1 && fusion.llamadas[0][0] === 'update' && JSON.stringify(Object.keys(fusion.llamadas[0][1]).sort()) === JSON.stringify(['familia', 'updated_at']),
  `Edición a la vez: solo se sube la familia (cambiada aquí), no la ficha entera (${JSON.stringify(fusion.llamadas.map(x => [x[0], Object.keys(x[1])]))})`);
ok(fusion.enMovil.seccion === 'RM' && fusion.enMovil.familia === 'B' && fusion.enMovil.peso === 2600, `Edición a la vez: no se pierde el Registro de Méritos de la administración y llega al móvil (${JSON.stringify(fusion.enMovil)})`);
ok(fusion.r.conflictos === 1 && JSON.stringify(fusion.conf) === JSON.stringify([['peso_g', '2700', '2600']]), `Edición a la vez: el peso, cambiado por los dos, queda como conflicto (${JSON.stringify(fusion.conf)})`);
await ir('#/sincronizacion');
{ const t = await page.innerText('#s-conflictos');
  ok(t.includes(fusion.anilla) && t.includes('peso') && t.includes('2700') && t.includes('2600'), 'Sincronización: muestra el conflicto con los dos valores');
  ok((await aviso()).includes('Otra persona cambió lo mismo que tú') && (await page.innerText('#aviso')).includes('Revisar'), 'Aviso al sincronizar: otra persona cambió lo mismo, con botón «Revisar»');
  await page.waitForFunction(() => !document.querySelector('#aviso.visible'), null, { timeout: 9000 });
  if (process.env.CAPTURAS) await page.screenshot({ path: `${process.env.CAPTURAS}/conflicto.png`, fullPage: true });
  await page.click('[data-eleccion="mio"]');
  await page.waitForTimeout(300);
  const tras = await page.evaluate(async (id) => { const d = await import('./js/datos.js'); return { peso: d.animal(id).peso_g, n: (await d.conflictos()).length }; }, fusion.id);
  ok(tras.peso === 2700 && tras.n === 0 && !(await page.$('#s-conflictos')), `Sincronización: «Usar el mío» deja el valor de este móvil y quita el conflicto (${JSON.stringify(tras)})`); }

// 7b. Descarga paginada e incremental (servidor simulado con 2.500 aves ajenas y un borrado)
const bajada = await page.evaluate(async () => {
  const sync = await import('./js/sync.js'); const db = await import('./js/db.js'); const d = await import('./js/datos.js');
  const hace = (min) => new Date(Date.now() - min * 60000).toISOString();
  const tablas = { censo_publico: [], animales: [], calificaciones: [], huevos: [], perfiles: [], campanas: [], lotes: [], incubaciones: [], solicitudes: [], borrados: [] };
  for (let i = 0; i < 2500; i++) tablas.censo_publico.push({ id: `ajeno-${i}`, anilla: `E2320${String(500000 + i)}`, sexo: i % 2 ? 'H' : 'M', variedad: 'blanca', fecha_nacimiento: '2023-05-01', seccion: 'RN', estado: 'activo', sync_ts: hace(600 - i / 10) });
  const consultas = [];
  const fake = {
    auth: { getSession: async () => ({ data: { session: { user: {} } } }) },
    from: (t) => { const st = { t, desde: null }; const b = {
      select: () => b, gte: (c, v) => { st.desde = v; return b; }, order: () => b,
      range: async (a, z) => { consultas.push(`${t}:${a}`);
        // Servidor con el esquema sin actualizar: no tiene la tabla del material genético
        if (!tablas[t]) return { data: null, error: { message: `Could not find the table 'public.${t}' in the schema cache` } };
        let f = [...tablas[t]].sort((x, y) => x.sync_ts.localeCompare(y.sync_ts));
        if (st.desde) f = f.filter(x => x.sync_ts >= st.desde); return { data: f.slice(a, z + 1), error: null }; } }; return b; }
  };
  sync.usarCliente(fake);
  const uid = d.estado.perfil.id;
  await sync.reiniciarMarcas(uid);
  const r1 = await sync.descargar(uid);
  const paginas1 = consultas.filter(c => c.startsWith('censo_publico')).length;
  const enMovil1 = (await db.todos('animales')).filter(a => a.id.startsWith('ajeno-')).length;
  // Cambios en el servidor: un ave nueva y el borrado de un huevo propio
  const huevo = (await db.todos('huevos'))[0];
  tablas.censo_publico.push({ id: 'ajeno-nuevo', anilla: 'E2420777777', sexo: 'M', variedad: 'pinta', fecha_nacimiento: '2024-05-01', seccion: 'RN', estado: 'activo', sync_ts: hace(0) });
  tablas.borrados.push({ id: 1, tabla: 'huevos', registro: huevo.id, sync_ts: hace(0) });
  consultas.length = 0;
  const r2 = await sync.descargar(uid);
  const huevoSigue = Boolean(await db.obtener('huevos', huevo.id));
  const enMovil2 = (await db.todos('animales')).filter(a => a.id.startsWith('ajeno-')).length;
  // limpieza
  for (const a of await db.todos('animales')) if (a.id.startsWith('ajeno-')) await db.borrar('animales', a.id);
  await d.cargar();
  return { r1, paginas1, enMovil1, r2, enMovil2, huevoSigue };
});
ok(bajada.r1 && bajada.r1.filas >= 2500, 'Descarga con un servidor sin la tabla nueva (esquema sin actualizar): se omite y sigue');
ok(bajada.enMovil1 === 2500 && bajada.paginas1 === 3, `Descarga por páginas: 2.500 aves en ${bajada.paginas1} páginas de 1.000 (antes se perdían las que pasaban de 1.000)`);
ok(bajada.r2.filas < 30 && bajada.enMovil2 === 2501, `Segunda descarga: solo lo cambiado (${bajada.r2.filas} filas, no 2.500)`);
ok(bajada.r2.borradas === 1 && !bajada.huevoSigue, 'Lo borrado en el servidor se borra también en el móvil');

// 8. Offline tras la primera visita (Service Worker)
await page.waitForTimeout(1500);
await ctx.setOffline(true);
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForSelector('#barra a', { timeout: 8000 });
await ir('#/censo');
ok((await page.$$('#censo-lista a.item')).length === 6, 'Sin cobertura: la app abre y el censo sigue disponible (6 ejemplares: 4 tras la restauración, el pollito y la gallina de la inspección)');
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
