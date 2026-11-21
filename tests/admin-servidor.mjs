// Herramientas del administrador que necesitan el servidor (fase 2 del panel):
// baja RGPD de un usuario, historial de cambios y copia completa del Libro.
// Supabase simulado: config.js con URL ficticia y supabase-js sustituido.
// Uso: node tests/admin-servidor.mjs http://localhost:8820
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.argv[2] || 'http://localhost:8820';

const STUB = `
(() => {
  const ADMIN = '00000000-0000-4000-8000-0000000000a1', PEPE = '00000000-0000-4000-8000-0000000000b2', LUIS = '00000000-0000-4000-8000-0000000000c3';
  const ANIMAL = '00000000-0000-4000-8000-0000000000d4';
  const ts = '2026-11-01T10:00:00Z';
  const S = window.__sb = { rpc: [], consultas: [], sesion: { user: { id: ADMIN, email: 'admin@club.es' } } };
  const T = {
    perfiles: [
      { id: ADMIN, nombre: 'Admin Club', email: 'admin@club.es', rol: 'administrador', created_at: '2026-01-01T00:00:00Z', sync_ts: ts },
      { id: PEPE, nombre: 'Pepe Criador', email: 'pepe@x.es', telefono: '600111222', rega: 'ES030140001234', municipio: 'Elche', provincia: 'Alicante', latitud: 38.2669, longitud: -0.6984, rol: 'criador', created_at: '2026-02-01T00:00:00Z', sync_ts: ts },
      { id: LUIS, nombre: 'Luis Sinnada', email: 'luis@x.es', rol: 'aspirante', created_at: '2026-03-01T00:00:00Z', sync_ts: ts }
    ],
    animales: [{ id: ANIMAL, usuario_id: PEPE, criador_id: PEPE, anilla: 'E2422000101', sexo: 'M', variedad: 'negra-moteada', fecha_nacimiento: '2024-03-01', seccion: 'RA', estado: 'activo', created_at: ts, updated_at: ts, sync_ts: ts }],
    solicitudes: [{ id: '00000000-0000-4000-8000-0000000000e5', usuario_id: PEPE, estado: 'pendiente', animales: [ANIMAL], telefono: '600111222', horario: 'indiferente', created_at: ts, updated_at: ts, sync_ts: ts }],
    historial: [
      { id: 3, tabla: 'calificaciones', registro: '00000000-0000-4000-8000-0000000000f6', operacion: 'INSERT', usuario_id: ADMIN, fecha: '2026-11-10T09:30:00Z', antes: null, despues: { animal_id: ANIMAL, total: 86 } },
      { id: 2, tabla: 'animales', registro: ANIMAL, operacion: 'UPDATE', usuario_id: PEPE, fecha: '2026-11-05T18:00:00Z',
        antes: { anilla: 'E2422000101', nombre: null, peso_g: 2500, updated_at: 'a' }, despues: { anilla: 'E2422000101', nombre: 'Moro', peso_g: 2600, updated_at: 'b' } },
      { id: 1, tabla: 'animales', registro: ANIMAL, operacion: 'INSERT', usuario_id: '00000000-0000-4000-8000-000000000999', fecha: '2026-11-05T17:00:00Z', antes: null, despues: { anilla: 'E2422000101' } }
    ]
  };
  const cadena = (tabla, base) => {
    const llamadas = [];
    const resultado = () => {
      S.consultas.push({ tabla, llamadas });
      if (base) return base();
      let filas = T[tabla] || [];
      for (const [m, a] of llamadas) if (m === 'eq') filas = filas.filter(f => f[a[0]] === a[1]);
      const r = llamadas.find(([m]) => m === 'range');
      if (r && r[1][0] > 0) filas = [];
      return { data: filas, error: null };
    };
    const prox = new Proxy(function () {}, {
      get: (_, k) => {
        if (k === 'then') { const p = Promise.resolve(resultado()); return p.then.bind(p); }
        if (k === 'maybeSingle' || k === 'single') return () => Promise.resolve({ data: T.perfiles[0], error: null });
        return (...a) => { llamadas.push([k, a]); return prox; };
      }
    });
    return prox;
  };
  window.supabase = { createClient: () => ({
    auth: {
      getSession: async () => ({ data: { session: S.sesion }, error: null }),
      getUser: async () => ({ data: { user: S.sesion.user }, error: null }),
      signOut: async () => ({ error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } })
    },
    from: (t) => cadena(t),
    rpc: (f, args) => { S.rpc.push({ f, args }); return cadena('rpc', () => f === 'dar_baja_usuario'
      ? { data: { perfil: args.p_id === '${'${'}LUIS}' ? 'borrado' : 'anonimizado', cuenta: args.p_id === '${'${'}LUIS}' ? 'borrada' : 'pendiente' }, error: null }
      : { data: null, error: null }); },
    storage: { from: () => ({ upload: async () => ({ error: null }), getPublicUrl: () => ({ data: { publicUrl: '' } }) }) },
    channel: () => ({ on() { return this; }, subscribe() { return this; } }), removeChannel() {}
  }) };
})();`.replaceAll('${LUIS}', '00000000-0000-4000-8000-0000000000c3');

let fallos = 0;
const ok = (c, t) => { console.log(`${c ? '✓' : '✗'} ${t}`); if (!c) fallos++; };
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--no-sandbox', '--no-proxy-server'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', acceptDownloads: true });
await ctx.route(/cdn\.jsdelivr\.net\/npm\/@supabase/, r => r.fulfill({ status: 200, contentType: 'text/javascript', body: STUB }));
await ctx.route(/\/js\/config\.js$/, async r => {
  const res = await r.fetch();
  const body = (await res.text()).replace(/supabaseUrl:\s*'[^']*'/, "supabaseUrl: 'https://prueba.supabase.co'").replace(/supabaseAnonKey:\s*'[^']*'/, "supabaseAnonKey: 'sb_publishable_prueba'");
  await r.fulfill({ response: res, body });
});
await ctx.route(/^https?:\/\/(?!localhost|cdn\.jsdelivr)/, r => r.abort());
const page = await ctx.newPage();
const errores = [];
page.on('pageerror', e => errores.push(e.message));
const ir = async (hash) => { await page.evaluate(h => { location.hash = h; }, hash); await page.waitForTimeout(400); };
const textoMain = () => page.innerText('main');

try {
  // Entra como administrador por el enlace de un correo de confirmación (deja la sesión guardada)
  await page.goto(base + '/#access_token=abc&expires_in=3600&refresh_token=def&token_type=bearer&type=signup');
  await page.waitForFunction(() => location.hash === '#/censo', null, { timeout: 10000 });
  await page.waitForTimeout(500);
  await ir('#/admin');
  try { await page.waitForFunction(() => document.querySelector('main h1')?.textContent === 'Administración', null, { timeout: 10000 }); }
  catch (e) { console.log('URL', page.url(), '\nMAIN', (await page.innerText('main').catch(() => '')).slice(0, 400), '\nERR', errores.join(' | ')); throw e; }
  await page.waitForFunction(() => document.querySelector('main')?.innerText.includes('Datos y seguridad'));
  ok(Boolean(await page.$('main a[href="#/admin/historial"]')) && Boolean(await page.$('main a[href="#/copia"]')),
    'Panel: sección «Datos y seguridad» con historial y copia completa');

  // --- Mapa de aviarios ---
  await ir('#/mapa');
  await page.waitForSelector('#m-mapa .leaflet-container, #m-mapa.leaflet-container', { timeout: 8000 });
  await page.waitForTimeout(500);
  const marcas = await page.$$eval('#m-mapa path.leaflet-interactive', p => p.length);
  ok(marcas === 1 && (await textoMain()).includes('Pepe Criador') && (await textoMain()).includes('Sin ubicación (2)'),
    `Mapa de aviarios: Leaflet dentro de la app, 1 aviario con ubicación y 2 sin ella (${marcas} marcador)`);
  await page.click('[data-ver="00000000-0000-4000-8000-0000000000b2"]'); await page.waitForTimeout(600);
  const pop = await page.innerText('.leaflet-popup-content').catch(() => '');
  ok(pop.includes('Pepe Criador') && pop.includes('Elche') && pop.includes('♂ 1') && pop.includes('Negra moteada') && pop.includes('Cómo llegar'), 'Mapa: la ficha del aviario con censo, variedades y «Cómo llegar»');
  const [geo] = await Promise.all([page.waitForEvent('download'), page.click('#m-geojson')]);
  const gj = JSON.parse(await (await import('node:fs/promises')).readFile(await geo.path(), 'utf8'));
  ok(gj.type === 'FeatureCollection' && gj.features.length === 1 && gj.features[0].geometry.coordinates[0] === -0.6984 && gj.features[0].properties.rega === 'ES030140001234',
    `Mapa: exportación GeoJSON para QGIS (${geo.suggestedFilename()})`);
  await page.selectOption('#m-variedad', 'blanca'); await page.waitForTimeout(500);
  ok((await page.$$eval('#m-mapa path.leaflet-interactive', p => p.length)) === 0 && (await textoMain()).includes('Ningún aviario cumple los filtros'), 'Mapa: el filtro por variedad deja fuera a quien no la cría');

  // --- Baja RGPD ---
  await ir('#/usuarios');
  await page.waitForFunction(() => document.querySelectorAll('[data-baja]').length === 2);
  ok(true, 'Usuarios: botón «Dar de baja (RGPD)» en los demás usuarios, no en uno mismo');
  // Criador con ejemplares: se anonimiza y la cuenta queda pendiente
  await page.click('summary:has-text("Pepe Criador")');
  await page.click('[data-baja="00000000-0000-4000-8000-0000000000b2"]');
  const dialogo = await page.innerText('dialog[open]').catch(() => '');
  ok(dialogo.includes('1 ejemplar(es)') && dialogo.includes('se conserva'), 'Confirmación: dice cuántos ejemplares tiene y que el Libro se conserva');
  await page.click('dialog[open] button[value="si"]');
  await page.waitForSelector('#us-resultado');
  const r1 = await page.innerText('#us-resultado');
  ok(await page.evaluate(() => window.__sb.rpc.some(x => x.f === 'dar_baja_usuario' && x.args.p_id.endsWith('b2'))), 'Llama a dar_baja_usuario en el servidor');
  ok(r1.includes('sus ejemplares siguen en el Libro') && r1.includes('Falta borrar su cuenta') && r1.includes('pepe@x.es'),
    'Resultado: datos borrados, ejemplares conservados, y cómo borrar la cuenta pendiente (con su correo)');
  const pepe = await page.evaluate(() => new Promise(res => { const q = indexedDB.open('alacantinapp-v7'); q.onsuccess = () => {
    const tx = q.result.transaction(['perfiles', 'solicitudes']); const out = {};
    tx.objectStore('perfiles').get('00000000-0000-4000-8000-0000000000b2').onsuccess = e => { out.p = e.target.result; };
    tx.objectStore('solicitudes').getAll().onsuccess = e => { out.s = e.target.result.length; };
    tx.oncomplete = () => res(out); }; }));
  ok(pepe.p && pepe.p.nombre === 'Pepe Criador' && !pepe.p.email && !pepe.p.telefono && !pepe.p.rega && pepe.p.baja && pepe.s === 0,
    'En el dispositivo: nombre conservado, correo/teléfono/REGA borrados, fecha de baja y sin solicitudes');
  await page.click('summary:has-text("Pepe Criador")').catch(() => {});
  const fichaPepe = await page.innerText('details.usuario:has-text("Pepe Criador")');
  ok(fichaPepe.includes('De baja') && !(await page.$('[data-baja$="b2"]')) && !(await page.$('#rol-00000000-0000-4000-8000-0000000000b2')),
    'Ficha del dado de baja: marca «De baja», sin botón de baja ni cambio de rol');
  // Usuario sin nada en el Libro: se borra por completo
  await page.click('summary:has-text("Luis Sinnada")');
  await page.click('[data-baja$="c3"]');
  ok((await page.innerText('dialog[open]')).includes('no tiene nada en el Libro'), 'Sin ejemplares: la confirmación dice que se borra todo');
  await page.click('dialog[open] button[value="si"]');
  await page.waitForFunction(() => document.querySelector('#us-resultado')?.innerText.includes('Luis'));
  ok((await page.innerText('#us-resultado')).includes('se ha borrado su perfil por completo') && !(await textoMain()).includes('luis@x.es</') && !(await page.$('summary:has-text("Luis Sinnada")')),
    'Sin ejemplares: perfil borrado y desaparece de la lista');

  // --- Historial ---
  await ir('#/admin/historial');
  await page.waitForSelector('#hi-lista li');
  const t = await textoMain();
  ok(t.includes('Calificó E2422000101 (86 puntos)') && t.includes('Cambió nombre, peso de E2422000101') && t.includes('Alta de E2422000101'),
    'Historial: alta, cambio (con los campos cambiados) y calificación, descritos en castellano');
  ok(t.includes('Usuario dado de baja') && t.includes('Pepe Criador'), 'Historial: nombra a quien hizo el cambio (y a los usuarios borrados como «dado de baja»)');
  await page.click('[data-filtro="calificaciones"]');
  await page.waitForFunction(() => document.querySelectorAll('#hi-lista li').length === 1);
  ok(await page.evaluate(() => window.__sb.consultas.filter(c => c.tabla === 'historial').at(-1).llamadas.some(([m, a]) => m === 'eq' && a[1] === 'calificaciones')),
    'Filtro «Calificaciones»: lo pide filtrado al servidor');

  // --- Copia completa ---
  await ir('#/copia');
  ok((await page.innerText('#cp-descargar')).includes('copia completa del Libro'), 'Copia: el administrador descarga la copia completa del Libro');
  const antes = await page.evaluate(() => window.__sb.consultas.filter(c => c.tabla === 'animales').length);
  const [descarga] = await Promise.all([page.waitForEvent('download'), page.click('#cp-descargar')]);
  const despues = await page.evaluate(() => window.__sb.consultas.filter(c => c.tabla === 'animales').length);
  const nombre = descarga.suggestedFilename();
  const copia = JSON.parse(await (await import('node:fs/promises')).readFile(await descarga.path(), 'utf8'));
  ok(despues > antes && nombre.startsWith('AlacantinApp_Libro_completo_') && copia.datos.animales.some(a => a.anilla === 'E2422000101'),
    `Copia completa: vuelve a bajar todo del servidor antes de guardarla (${nombre})`);
  ok(errores.length === 0, `Sin errores de página${errores.length ? ': ' + errores.join(' | ') : ''}`);
} finally {
  await browser.close();
}
console.log(fallos ? `\n${fallos} FALLO(S)` : '\nTODO CORRECTO');
process.exit(fallos ? 1 : 0);
