// Revisión de accesibilidad en el navegador (sin dependencias): nombres accesibles, etiquetas,
// alt, ids repetidos, un h1 por pantalla, contraste de texto (WCAG AA) en tema claro, oscuro y
// sol, y foco tras navegar. Uso: node tests/accesibilidad.mjs (con la app servida en :8820)
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.argv[2] || 'http://localhost:8820';
const b = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--no-sandbox','--no-proxy-server'] });
const salida = {};
for (const tema of ['claro', 'oscuro', 'sol']) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, colorScheme: tema === 'oscuro' ? 'dark' : 'light' });
  await ctx.route(/^https?:\/\/(?!localhost)/, r => r.abort());
  const page = await ctx.newPage();
  await page.goto(base + '/'); await page.waitForSelector('#barra a');
  const ir = async (x) => { await page.evaluate(h => { location.hash = h; }, x); await page.waitForTimeout(450); };
  // visitante
  const rutasVis = ['#/estandar', '#/guia', '#/censo', '#/programa', '#/acceso', '#/privacidad'];
  const rutasUsu = ['#/censo', '#/hoy', '#/alta', '#/puesta', '#/herramientas', '#/reproduccion', '#/inspeccion', '#/campanas', '#/auditoria', '#/acta', '#/perfil', '#/informes', '#/copia', '#/problema', '#/sincronizacion', '#/apareamientos'];
  const revisar = async () => page.evaluate(() => {
    const vis = (e) => { const r = e.getBoundingClientRect(); const c = getComputedStyle(e); return r.width > 0 && r.height > 0 && c.visibility !== 'hidden' && c.display !== 'none' && c.opacity !== '0'; };
    const nombre = (e) => (e.getAttribute('aria-label') || (e.getAttribute('aria-labelledby') || '').split(' ').map(i => document.getElementById(i)?.textContent || '').join(' ') || [...(e.labels || [])].map(l => l.textContent).join(' ') || e.textContent || e.value || e.title || e.alt || e.placeholder || '').replace(/[\s\u{1F300}-\u{1FAFF}☀-➿️›]/gu, '').trim();
    const p = [];
    for (const e of document.querySelectorAll('a, button, input:not([type=hidden]), select, textarea, [role=button]')) {
      if (!vis(e) && !(e.type === 'radio' || e.type === 'checkbox')) continue;
      if (!nombre(e)) p.push(`sin nombre: <${e.tagName.toLowerCase()}${e.id ? '#' + e.id : ''} class="${e.className}">`);
    }
    for (const e of document.querySelectorAll('input:not([type=hidden]):not([type=radio]):not([type=checkbox]), select, textarea'))
      if (vis(e) && !e.labels?.length && !e.getAttribute('aria-label') && !e.getAttribute('aria-labelledby')) p.push(`campo sin etiqueta: #${e.id || e.name || e.className}`);
    for (const e of document.querySelectorAll('img')) if (!e.hasAttribute('alt')) p.push(`img sin alt: ${e.src.slice(-30)}`);
    const ids = {}; for (const e of document.querySelectorAll('[id]')) ids[e.id] = (ids[e.id] || 0) + 1;
    for (const [k, n] of Object.entries(ids)) if (n > 1) p.push(`id repetido: ${k}`);
    const h1 = [...document.querySelectorAll('main h1')].filter(vis).length; if (h1 !== 1) p.push(`h1 en main: ${h1}`);
    // contraste
    const rgb = (s) => (s.match(/[\d.]+/g) || []).map(Number);
    const lum = ([r, g, b]) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    const fondo = (e) => { for (let x = e; x; x = x.parentElement) { const c = rgb(getComputedStyle(x).backgroundColor); if (c.length === 3 || (c.length === 4 && c[3] > 0.5)) return c.slice(0, 3); } return [255, 255, 255]; };
    const vistos = new Set();
    for (const e of document.querySelectorAll('main *, .cabecera *, #barra *')) {
      if (!vis(e) || parseFloat(getComputedStyle(e).fontSize) === 0 || ![...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim().replace(/[\u{1F300}-\u{1FAFF}☀-➿️]/gu, '').trim())) continue;
      const cs = getComputedStyle(e); if (e.closest('[disabled]') || e.matches(':disabled')) continue;
      const c = rgb(cs.color).slice(0, 3), f = fondo(e);
      const L1 = lum(c), L2 = lum(f); const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
      const grande = parseFloat(cs.fontSize) >= 24 || (parseFloat(cs.fontSize) >= 18.66 && Number(cs.fontWeight) >= 700);
      if (ratio < (grande ? 3 : 4.5)) { const k = `${cs.color} sobre rgb(${f}) ${ratio.toFixed(2)} «${e.textContent.trim().slice(0, 25)}» .${String(e.className).slice(0, 25)}`; if (!vistos.has(k)) { vistos.add(k); p.push('contraste ' + k); } }
    }
    return p;
  });
  const res = {};
  if (tema === 'sol') await page.evaluate(() => { localStorage.setItem('alacantinapp-tema', 'sol'); document.documentElement.dataset.tema = 'sol'; });
  for (const r of rutasVis) { await ir(r); res['vis ' + r] = await revisar(); }
  await ir('#/acceso'); await page.click('[data-tab="registro"]');
  await page.fill('#r-nombre', 'Ana'); await page.fill('#r-email', `a${tema}@x.es`); await page.fill('#r-pass', 'clave-segura-1');
  await page.check('#r-acepto'); await page.click('#form-registro button[type=submit]'); await page.waitForTimeout(1200);
  await page.evaluate(async () => { const d = await import('./js/datos.js'); await d.guardarAnimal({ anilla: 'E2420000001', sexo: 'M', variedad: 'blanca', fecha_nacimiento: '2024-03-01', seccion: 'RN' }); await d.guardarAnimal({ anilla: 'E2418000002', sexo: 'H', variedad: 'blanca', fecha_nacimiento: '2024-03-01', seccion: 'RN' }); });
  for (const r of rutasUsu) { await ir(r); res['usu ' + r] = await revisar(); }
  // Administración (rol local de administrador)
  await page.evaluate(async () => { const db = await import('./js/db.js'); const p = await db.obtener('perfiles', await db.metaGet('sesion')); await db.guardar('perfiles', { ...p, rol: 'administrador' }); });
  await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForSelector('#barra a');
  for (const r of ['#/admin', '#/admin/libro', '#/usuarios', '#/admin/supabase']) { await ir(r); res['adm ' + r] = await revisar(); }
  await ir('#/usuarios'); await page.click('#us-lista summary'); res['adm #/usuarios abierto'] = await revisar();
  // foco tras navegar
  await ir('#/censo'); await page.click('#barra a[href="#/puesta"]'); await page.waitForTimeout(500);
  const foco = await page.evaluate(() => `${document.activeElement?.tagName}#${document.activeElement?.id}`);
  res.foco = foco === 'MAIN#principal' ? [] : [`tras navegar, el foco queda en ${foco} (debería ir al contenido)`];
  salida[tema] = res;
  await ctx.close();
}
await b.close();
let fallos = 0;
for (const [tema, res] of Object.entries(salida)) {
  const todos = {};
  for (const [r, l] of Object.entries(res)) for (const x of l) (todos[x] ||= []).push(r);
  const n = Object.keys(todos).length;
  fallos += n;
  console.log(`${n ? '✗' : '✓'} Tema ${tema}: ${Object.keys(res).length - 1} pantallas revisadas${n ? `, ${n} problema(s)` : ', sin problemas'}`);
  for (const [x, rs] of Object.entries(todos)) console.log(`    ${x}   [${rs.length}: ${rs.slice(0, 3).join(', ')}]`);
}
console.log(fallos ? `\n${fallos} FALLO(S)` : '\nTODO CORRECTO');
process.exit(fallos ? 1 : 0);
