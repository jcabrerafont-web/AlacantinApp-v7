// Prueba del retorno desde los correos de Supabase (recuperar contraseña, confirmar cuenta,
// enlace caducado) con un Supabase simulado: config.js con URL ficticia y supabase-js sustituido.
// Uso: node tests/recuperacion.mjs http://localhost:8820
//      (opcional) CHROME=/ruta/a/chrome  PLAYWRIGHT_MODULE=/ruta/a/playwright
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.argv[2] || 'http://localhost:8820';

// Supabase simulado: auth con sesión del enlace, perfiles y cualquier consulta (vacía)
const STUB = `
(() => {
  const S = window.__sb = { reset: [], updates: [], signups: [], sesion: null };
  const h = location.hash;
  if (/access_token=/.test(h)) S.sesion = { user: { id: '11111111-1111-4111-8111-111111111111', email: 'criador@ejemplo.es', user_metadata: { nombre: 'Criadora' } } };
  const vacio = { data: [], error: null, count: 0 };
  const cadena = () => {
    const p = Promise.resolve(vacio);
    const prox = new Proxy(function () {}, {
      get: (_, k) => {
        if (k === 'then') return p.then.bind(p);
        if (k === 'maybeSingle' || k === 'single') return () => Promise.resolve({ data: S.sesion ? { id: S.sesion.user.id, email: S.sesion.user.email, nombre: 'Criadora', rol: 'criador', rega: 'ES030140001234' } : null, error: null });
        return () => prox;
      },
      apply: () => prox
    });
    return prox;
  };
  window.supabase = { createClient: () => ({
    auth: {
      getSession: async () => ({ data: { session: S.sesion }, error: null }),
      getUser: async () => ({ data: { user: S.sesion?.user || null }, error: S.sesion ? null : { name: 'AuthSessionMissingError' } }),
      resetPasswordForEmail: async (email, opt) => { S.reset.push({ email, opt }); return { data: {}, error: null }; },
      updateUser: async (x) => { S.updates.push(x); return { data: { user: S.sesion?.user }, error: null }; },
      signUp: async (x) => { S.signups.push(x); return { data: { user: null, session: null }, error: null }; },
      signInWithPassword: async () => ({ data: null, error: { message: 'Invalid login credentials' } }),
      signOut: async () => ({ error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } })
    },
    from: () => cadena(), rpc: () => cadena(),
    storage: { from: () => ({ upload: async () => ({ error: null }), getPublicUrl: () => ({ data: { publicUrl: '' } }) }) },
    channel: () => ({ on() { return this; }, subscribe() { return this; } }), removeChannel() {}
  }) };
})();`;

let fallos = 0;
const ok = (c, t) => { console.log(`${c ? '✓' : '✗'} ${t}`); if (!c) fallos++; };
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--no-sandbox', '--no-proxy-server'] });
const contexto = async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
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
  return { ctx, page, errores };
};
const textoAviso = (page) => page.evaluate(() => document.getElementById('aviso')?.textContent || '');

try {
  // 1. Pedir el enlace desde «¿Has olvidado la contraseña?»
  {
    const { ctx, page, errores } = await contexto();
    await page.goto(base + '/#/acceso');
    await page.waitForSelector('#e-olvido');
    await page.fill('#e-email', 'Criador@Ejemplo.es');
    await page.click('#e-olvido');
    ok(await page.isVisible('#form-olvido') && !(await page.isVisible('#form-entrar')) && await page.inputValue('#o-email') === 'Criador@Ejemplo.es',
      'Acceso: «¿Has olvidado la contraseña?» abre el formulario con el correo ya escrito');
    await page.click('#form-olvido button[type=submit]');
    await page.waitForFunction(() => window.__sb.reset.length === 1);
    const r = await page.evaluate(() => window.__sb.reset[0]);
    ok(r.email === 'criador@ejemplo.es' && r.opt.redirectTo === base + '/', `Se pide el correo de recuperación (a ${r.email}, vuelta a ${r.opt.redirectTo})`);
    ok((await textoAviso(page)).includes('te llegará el enlace') && await page.isVisible('#form-entrar'), 'Aviso de envío y vuelta a «Entrar»');
    await page.click('[data-tab="registro"]');
    await page.fill('#r-nombre', 'Nuevo'); await page.fill('#r-email', 'nuevo@ejemplo.es'); await page.fill('#r-pass', 'clave-segura-1'); await page.check('#r-acepto');
    await page.click('#form-registro button[type=submit]');
    await page.waitForFunction(() => window.__sb.signups.length === 1);
    ok(await page.evaluate(() => window.__sb.signups[0].options.emailRedirectTo) === base + '/', 'Registro: el correo de confirmación vuelve a la app');
    ok(errores.length === 0, `Sin errores de página${errores.length ? ': ' + errores.join(' | ') : ''}`);
    await ctx.close();
  }
  // 2. Abrir el enlace de recuperación: sesión iniciada y pantalla «Contraseña nueva»
  {
    const { ctx, page, errores } = await contexto();
    await page.goto(base + '/#access_token=abc&expires_in=3600&refresh_token=def&token_type=bearer&type=recovery');
    await page.waitForSelector('#form-clave', { timeout: 8000 });
    ok(!/access_token/.test(page.url()) && page.url().endsWith('#/nueva-clave'), `El código se quita de la dirección (${page.url().replace(base, '')})`);
    ok((await page.innerText('main')).includes('criador@ejemplo.es'), 'Pantalla «Contraseña nueva» con la cuenta del enlace');
    await page.fill('#nc-pass', 'nueva-clave-1'); await page.fill('#nc-pass2', 'otra-clave-2');
    await page.click('#form-clave button[type=submit]');
    ok((await textoAviso(page)).includes('no coinciden') && await page.evaluate(() => window.__sb.updates.length) === 0, 'Si las dos no coinciden, avisa y no cambia nada');
    await page.fill('#nc-pass2', 'nueva-clave-1');
    await page.click('#form-clave button[type=submit]');
    await page.waitForFunction(() => location.hash === '#/censo');
    ok(await page.evaluate(() => window.__sb.updates[0]?.password) === 'nueva-clave-1' && (await textoAviso(page)).includes('Contraseña guardada'),
      'Guarda la contraseña nueva en el servidor y entra en Mi censo');
    ok(errores.length === 0, `Sin errores de página${errores.length ? ': ' + errores.join(' | ') : ''}`);
    await ctx.close();
  }
  // 3. Enlace de confirmación de cuenta: entra directamente
  {
    const { ctx, page } = await contexto();
    await page.goto(base + '/#access_token=abc&expires_in=3600&refresh_token=def&token_type=bearer&type=signup');
    await page.waitForFunction(() => location.hash === '#/censo', null, { timeout: 8000 });
    await page.waitForTimeout(300);
    ok((await textoAviso(page)).includes('Correo confirmado') && await page.$$eval('#barra a', a => a.length) === 4, 'Confirmar la cuenta desde el correo: entra con la barra de 4 botones');
    await ctx.close();
  }
  // 4. Enlace caducado o ya usado
  {
    const { ctx, page, errores } = await contexto();
    await page.goto(base + '/#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired');
    await page.waitForFunction(() => location.hash === '#/acceso', null, { timeout: 8000 });
    await page.waitForTimeout(300);
    ok((await textoAviso(page)).includes('ha caducado') && !/error=/.test(page.url()), 'Enlace caducado: lo explica, quita el error de la dirección y deja pedir otro');
    ok(errores.length === 0, `Sin errores de página${errores.length ? ': ' + errores.join(' | ') : ''}`);
    await ctx.close();
  }
} finally {
  await browser.close();
}
console.log(fallos ? `\n${fallos} FALLO(S)` : '\nTODO CORRECTO');
process.exit(fallos ? 1 : 0);
