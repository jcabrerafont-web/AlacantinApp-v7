// ============================================================================
// Diagnóstico: registro local de errores y texto del «Informe de problemas».
// Sin datos personales: ni nombre, ni correo, ni REGA, ni ubicación.
// ============================================================================
import { CONFIG, supabaseConfigurado } from './config.js';

const CLAVE = 'alacantinapp-errores';
const MAX = 20;

const leer = () => { try { return JSON.parse(localStorage.getItem(CLAVE) || '[]'); } catch { return []; } };
export const errores = leer;
export function anotarError(mensaje, origen = '') {
  try {
    const l = leer();
    l.push({ fecha: new Date().toISOString(), version: CONFIG.version, ruta: location.hash.split('?')[0].replace(/[0-9a-f-]{36}/gi, ':id'),
      mensaje: String(mensaje || '').replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[correo]').slice(0, 300), origen: String(origen).slice(0, 160) });
    localStorage.setItem(CLAVE, JSON.stringify(l.slice(-MAX)));
  } catch { /* sin almacenamiento */ }
}
export function borrarErrores() { try { localStorage.removeItem(CLAVE); } catch { /* nada */ } }

export function vigilar() {
  window.addEventListener('error', e => anotarError(e.message, `${(e.filename || '').split('/').pop()}:${e.lineno || ''}`));
  window.addEventListener('unhandledrejection', e => anotarError(e.reason?.message || e.reason, 'promesa'));
}

// Texto técnico para el informe
export async function informe({ datos }) {
  const est = datos.estado;
  let almacen = '';
  try {
    const e = await navigator.storage?.estimate?.();
    const p = await navigator.storage?.persisted?.();
    if (e) almacen = `${Math.round((e.usage || 0) / 1048576)} MB usados · ${p ? 'protegidos' : 'sin proteger'}`;
  } catch { /* sin soporte */ }
  const instalada = window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const lineas = [
    `AlacantinApp ${CONFIG.version} · ${supabaseConfigurado() ? 'con servidor' : 'modo dispositivo'} · ${instalada ? 'instalada' : 'en el navegador'}`,
    `Rol: ${est.perfil?.rol || 'visitante'} · ejemplares en el móvil: ${est.todos.length} · pendientes de enviar: ${est.pendientes}`,
    `Conexión: ${navigator.onLine ? 'sí' : 'no'} · pantalla ${window.innerWidth}×${window.innerHeight} · ${almacen}`,
    `Navegador: ${navigator.userAgent}`,
    `Pantalla abierta: ${location.hash.split('?')[0].replace(/[0-9a-f-]{36}/gi, ':id') || '#/'}`
  ];
  const err = leer();
  if (err.length) {
    lineas.push('', `Últimos errores (${err.length}):`);
    for (const x of err.slice(-8)) lineas.push(`- ${x.fecha.slice(0, 16).replace('T', ' ')} · v${x.version} · ${x.ruta} · ${x.mensaje}${x.origen ? ` (${x.origen})` : ''}`);
  } else lineas.push('', 'Sin errores registrados.');
  return lineas.join('\n');
}
