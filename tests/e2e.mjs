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
const alta = async ({ num, diam, sexo, variedad, fecha, padre, madre, nombre, peso }) => {
  await ir('#/censo'); await ir('#/alta'); // formulario limpio aunque el alta anterior fallara
  await page.fill('#a-num', num);
  await page.selectOption('#a-sexo', sexo);
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
await cambiarRolLocal('inspector');

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
