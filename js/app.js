// ============================================================================
// AlacantinApp v7 · arranque, enrutado por rol y barra de navegación.
// ============================================================================
import { CONFIG } from './config.js';
import * as auth from './auth.js';
import * as sync from './sync.js';
import * as datos from './datos.js';
import { $, aviso, esc } from './ui.js';

// Rutas: [patrón, módulo, roles permitidos ('*' = todos, 'usuario' = cualquier sesión)]
const RUTAS = [
  ['estandar', 'estandar', '*'],
  ['guia', 'guia', '*'],
  ['programa', 'programa', '*'],
  ['censo', 'censo', '*'],
  ['animal/:id', 'ficha', '*'],
  ['pedigri/:id', 'pedigri', '*'],
  ['acceso', 'acceso', '*'],
  ['alta', 'alta', 'usuario'],
  ['editar/:id', 'alta', 'usuario'],
  ['puesta', 'puesta', 'usuario'],
  ['campanas', 'campanas', 'usuario'],
  ['campana/:id', 'campana', 'usuario'],
  ['herramientas', 'herramientas', 'usuario'],
  ['perfil', 'perfil', 'usuario'],
  ['apareamientos', 'apareamientos', 'usuario'],
  ['informes', 'informes', 'usuario'],
  ['sincronizacion', 'sincronizacion', 'usuario'],
  ['copia', 'copia', 'usuario'],
  ['reproduccion', 'reproduccion', 'usuario'],
  ['incubacion/:id', 'incubacion', 'usuario'],
  ['inspeccion', 'inspeccion', 'usuario'],
  ['auditoria', 'auditoria', 'usuario'],
  ['calificar/:id', 'calificacion', ['inspector', 'administrador']],
  ['dossier', 'dossier', ['inspector', 'administrador']],
  ['inspecciones', 'inspecciones', ['inspector', 'administrador']],
  ['usuarios', 'usuarios', ['administrador']]
];

// Barra inferior: visitante 3 columnas; usuarios registrados 4 columnas.
// Se genera desde cero en cada cambio de sesión: nunca hay botones bloqueados.
const BARRA = {
  visitante: [
    ['estandar', '📖', 'Estándar Racial'],
    ['guia', '📋', 'Guía de Campo'],
    ['censo', '🔍', 'Censo Público']
  ],
  usuario: [
    ['censo', '📚', 'Mi Censo'],
    ['alta', '➕', 'Alta Rápida'],
    ['puesta', '🥚', 'Puesta & RFID'],
    ['herramientas', '🧰', 'Herramientas']
  ]
};

let limpiezaVista = null;

function resolver(hash) {
  const ruta = hash.replace(/^#\/?/, '').split('?')[0];
  for (const [patron, modulo, roles] of RUTAS) {
    const p = patron.split('/');
    const r = ruta.split('/');
    if (p.length !== r.length) continue;
    const params = {};
    if (p.every((seg, i) => (seg.startsWith(':') ? (params[seg.slice(1)] = decodeURIComponent(r[i]), true) : seg === r[i]))) {
      return { patron, modulo, roles, params, base: p[0] };
    }
  }
  return null;
}

function permitido(roles) {
  if (roles === '*') return true;
  if (!datos.estado.perfil) return false;
  return roles === 'usuario' || roles.includes(datos.rol());
}

const inicio = () => (datos.estado.perfil ? '#/censo' : '#/estandar');

async function navegar() {
  let r = resolver(location.hash);
  if (!r) { location.replace(inicio()); return; }
  if (!permitido(r.roles)) {
    if (!datos.estado.perfil && r.roles === 'usuario') {
      location.replace('#/acceso');
    } else {
      aviso('No tienes permiso para esa sección.', 'error');
      location.replace(inicio());
    }
    return;
  }
  if (typeof limpiezaVista === 'function') limpiezaVista();
  limpiezaVista = null;
  const main = $('#principal');
  try {
    const mod = await import(`./vistas/${r.modulo}.js`);
    limpiezaVista = await mod.default(main, r.params) || null;
  } catch (e) {
    console.error(e);
    main.innerHTML = `<div class="tarjeta"><h2>No se pudo abrir la sección</h2><p class="muted">${esc(e.message)}</p></div>`;
  }
  marcarBarra(r.base);
  main.focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

function pintarBarra() {
  const items = datos.estado.perfil ? BARRA.usuario : BARRA.visitante;
  const nav = $('#barra');
  nav.dataset.columnas = String(items.length);
  nav.innerHTML = items.map(([ruta, ico, texto]) =>
    `<a href="#/${ruta}" data-ruta="${ruta}"><span class="ico" aria-hidden="true">${ico}</span><span>${esc(texto)}</span></a>`).join('');
  marcarBarra(resolver(location.hash)?.base);
}

function marcarBarra(base) {
  const equivalencias = { animal: 'censo', pedigri: 'censo', editar: 'alta', perfil: 'herramientas', apareamientos: 'herramientas',
    informes: 'herramientas', sincronizacion: 'herramientas', calificar: 'censo', usuarios: 'herramientas' };
  const activo = equivalencias[base] || base;
  document.querySelectorAll('#barra a').forEach(a => {
    if (a.dataset.ruta === activo) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
}

function pintarCabecera() {
  const red = $('#estado-red');
  red.textContent = navigator.onLine ? 'En línea' : 'Sin cobertura';
  red.className = `chip ${navigator.onLine ? 'chip-ok' : 'chip-aviso'}`;
  const cola = $('#estado-cola');
  const n = datos.estado.pendientes;
  cola.classList.toggle('oculto', !datos.estado.perfil || n === 0);
  cola.textContent = `⏳ ${n}`;
  cola.title = `${n} operación(es) pendientes de sincronizar`;
  const boton = $('#boton-cuenta');
  boton.textContent = datos.estado.perfil ? (datos.estado.perfil.nombre || 'Mi cuenta').split(' ')[0] : 'Entrar';
}

export async function iniciarSesion(perfil) {
  datos.estado.perfil = perfil;
  await datos.cargar();
  pintarBarra();
  pintarCabecera();
  if (navigator.onLine && auth.obtenerCliente()) {
    sync.drenar().then(() => sync.descargar(perfil.id)).then(() => datos.cargar()).catch(e => console.warn('[sync]', e));
  }
}

export async function cerrarSesion() {
  await auth.salir();
  datos.estado.perfil = null;
  await datos.cargar();
  pintarBarra();
  pintarCabecera();
  location.hash = '#/estandar';
}

async function arrancar() {
  // Espera breve al cliente Supabase (script diferido); si no carga, modo dispositivo
  for (let i = 0; i < 20 && !window.supabase && navigator.onLine; i++) await new Promise(r => setTimeout(r, 50));
  const cliente = auth.crearCliente();
  sync.usarCliente(cliente);

  try {
    datos.estado.perfil = await auth.sesionGuardada();
  } catch (e) {
    console.warn('[auth]', e);
  }
  await datos.cargar();
  if (!datos.estado.perfil && navigator.onLine && cliente) {
    sync.descargar(null).then(() => datos.cargar()).catch(() => {});
  }
  if (datos.estado.perfil && navigator.onLine && cliente) {
    sync.drenar().then(() => sync.descargar(datos.estado.perfil.id)).then(() => datos.cargar()).catch(e => console.warn('[sync]', e));
  }

  sync.alCambiar(n => { datos.estado.pendientes = n; pintarCabecera(); });
  datos.suscribir(pintarCabecera);
  const alRed = () => {
    datos.estado.online = navigator.onLine;
    pintarCabecera();
    if (navigator.onLine && datos.estado.perfil) {
      sync.drenar().then(r => { if (r?.ok) aviso(`☁️ ${r.ok} registro(s) sincronizados`, 'ok'); return datos.cargar(); });
    }
  };
  window.addEventListener('online', alRed);
  window.addEventListener('offline', alRed);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') alRed(); });

  $('#boton-cuenta').addEventListener('click', () => {
    location.hash = datos.estado.perfil ? '#/herramientas' : '#/acceso';
  });
  $('#estado-cola').addEventListener('click', () => { location.hash = '#/sincronizacion'; });

  window.addEventListener('hashchange', navegar);
  pintarBarra();
  pintarCabecera();
  if (!location.hash || location.hash === '#' || location.hash === '#/') location.replace(inicio());
  await navegar();
  registrarServiceWorker();
}

function registrarServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).then(reg => {
    const comprobar = () => reg.update().catch(() => {});
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') comprobar(); });
    setInterval(comprobar, 60 * 60 * 1000);
  }).catch(e => console.warn('[PWA]', e));
  const habiaControlador = Boolean(navigator.serviceWorker.controller);
  let recargado = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!habiaControlador || recargado) return;
    // No recargar si hay un formulario a medias: se avisa y se aplica al volver a abrir
    const editando = document.querySelector('form[data-sucio="1"]');
    if (editando || sync.sincronizando()) {
      aviso('Hay una versión nueva de AlacantinApp. Se aplicará al terminar.', 'info');
      return;
    }
    recargado = true;
    location.reload();
  });
}

console.info(`[AlacantinApp] v${CONFIG.version}`);
arrancar();
