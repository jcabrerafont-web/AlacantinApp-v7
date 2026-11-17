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
await page.selectOption('#a-sexo', 'H');
await page.selectOption('#a-variedad', 'blanca');
await page.click('#form-alta button[type=submit]');
await page.waitForTimeout(800);
ok(page.url().includes('#/animal/'), `Pollito dado de alta (${(await aviso()).slice(0, 80)})`);
const vinc = await page.evaluate(async () => { const d = await import('./js/datos.js'); const f = d.estado.incubaciones[0].filas[0]; return { pollitos: f.pollitos.length, pendientes: d.pollitosPendientes().reduce((s, x) => s + x.pendientes, 0) }; });
ok(vinc.pollitos === 1 && vinc.pendientes === 3, `El pollito queda unido a su incubación (quedan ${vinc.pendientes} por dar de alta)`);
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
await page.fill('#a-num', '41'); await page.selectOption('#a-sexo', 'H'); await page.selectOption('#a-variedad', 'blanca'); await page.fill('#a-fecha', '2025-05-01');
await page.click('#form-alta button[type=submit]'); await page.waitForTimeout(700);
await ir('#/censo');
ok(!!(await page.$('#censo-insp')), `Mi censo invita a solicitar la inspección de los ejemplares con un año (${(await page.$eval('#censo-insp', e => e.textContent).catch(() => '—')).trim().slice(0, 70)})`);
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
ok(await page.$eval('main a[href="#/inspecciones"]', a => a.textContent.includes('1 abierta')), 'Herramientas del inspector: 1 solicitud abierta');
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
