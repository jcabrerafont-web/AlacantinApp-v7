// ============================================================================
// Copia de seguridad del Libro en este dispositivo (exportar / restaurar).
// Imprescindible en modo dispositivo: sin servidor, los datos solo viven aquí.
// Nunca incluye contraseñas ni la sesión (almacén «meta»).
// ============================================================================
import * as db from './db.js';
import * as sync from './sync.js';
import { CONFIG, supabaseConfigurado } from './config.js';

export const FORMATO = 'alacantinapp-respaldo';
const TABLAS = ['animales', 'calificaciones', 'huevos', 'campanas', 'lotes', 'incubaciones', 'perfiles'];
const DIAS_RECORDATORIO = 30;

const sinFotosLocales = (a) => {
  if (!a.fotos) return a;
  const fotos = Object.fromEntries(Object.entries(a.fotos).map(([k, v]) => [k, typeof v === 'string' && v.startsWith('data:') ? null : v]));
  return { ...a, fotos };
};

// Genera el objeto de la copia con todo lo que hay en este dispositivo
export async function crearCopia(perfil, { incluirFotos = true } = {}) {
  const datos = {};
  for (const t of TABLAS) datos[t] = await db.todos(t);
  if (!incluirFotos) datos.animales = datos.animales.map(sinFotosLocales);
  return {
    formato: FORMATO, version: 1, app: CONFIG.version, creado: new Date().toISOString(),
    modo: supabaseConfigurado() ? 'servidor' : 'dispositivo',
    perfil: perfil ? { id: perfil.id, nombre: perfil.nombre || '', email: perfil.email || '' } : null,
    fotos: incluirFotos, datos
  };
}

export const marcarCopiaHecha = () => db.metaSet('ultimaCopia', new Date().toISOString());
export const ultimaCopia = () => db.metaGet('ultimaCopia', null);

// ¿Toca recordar la copia? (hay datos propios y la última copia es antigua o no existe)
export async function copiaPendiente(perfil, numAnimalesPropios) {
  if (!perfil || !numAnimalesPropios) return null;
  const u = await ultimaCopia();
  const dias = u ? Math.floor((Date.now() - Date.parse(u)) / 86400000) : null;
  return dias === null || dias >= DIAS_RECORDATORIO ? { dias } : null;
}

// Comprueba la estructura y descarta registros mal formados
export function validarCopia(obj) {
  if (!obj || obj.formato !== FORMATO || !obj.datos || typeof obj.datos !== 'object') {
    throw new Error('El archivo no es una copia de seguridad de AlacantinApp.');
  }
  const descartados = {};
  const ok = (t, r) => {
    if (!r || typeof r.id !== 'string' || !r.id) return false;
    if (t === 'animales') return typeof r.anilla === 'string' && ['M', 'H'].includes(r.sexo) && /^\d{4}-\d{2}-\d{2}$/.test(r.fecha_nacimiento || '');
    if (t === 'huevos') return typeof r.animal_id === 'string' && Number.isFinite(Number(r.peso_g));
    if (t === 'calificaciones') return typeof r.animal_id === 'string' && r.puntos && typeof r.puntos === 'object';
    if (t === 'campanas' || t === 'lotes') return Array.isArray(r.gallinas) && /^\d{4}-\d{2}-\d{2}$/.test(r.inicio || '');
    if (t === 'incubaciones') return Array.isArray(r.filas) && /^\d{4}-\d{2}-\d{2}$/.test(r.entrada || '');
    return true;
  };
  const datos = {};
  for (const t of TABLAS) {
    const lista = Array.isArray(obj.datos[t]) ? obj.datos[t] : [];
    datos[t] = lista.filter(r => ok(t, r));
    if (lista.length !== datos[t].length) descartados[t] = lista.length - datos[t].length;
  }
  return { ...obj, datos, descartados };
}

// Resumen para mostrar antes de restaurar
export const resumenCopia = (c) => Object.fromEntries(TABLAS.map(t => [t, c.datos[t]?.length || 0]));

// Restaura una copia validada. modo: 'fusionar' (conserva lo más reciente) | 'reemplazar'
export async function restaurar(copia, perfil, { modo = 'fusionar' } = {}) {
  const datos = structuredClone(copia.datos);
  // En modo dispositivo, una copia de otra cuenta local (p. ej. de un móvil anterior)
  // se adopta como propia: se cambia el titular antiguo por la cuenta actual.
  let adoptada = false;
  const viejo = copia.perfil?.id;
  if (!supabaseConfigurado() && perfil && viejo && viejo !== perfil.id) {
    const cambia = (v) => (v === viejo ? perfil.id : v);
    datos.animales.forEach(a => { a.usuario_id = cambia(a.usuario_id); a.criador_id = cambia(a.criador_id); });
    datos.huevos.forEach(h => { h.usuario_id = cambia(h.usuario_id); });
    datos.campanas.forEach(c => { c.usuario_id = cambia(c.usuario_id); });
    (datos.lotes || []).forEach(l => { l.usuario_id = cambia(l.usuario_id); });
    (datos.incubaciones || []).forEach(i => { i.usuario_id = cambia(i.usuario_id); });
    datos.calificaciones.forEach(c => { c.inspector_id = cambia(c.inspector_id); });
    adoptada = true;
  }
  // El perfil de la sesión actual nunca se sobrescribe desde una copia
  datos.perfiles = datos.perfiles.filter(p => p.id !== perfil?.id && p.id !== viejo);

  if (modo === 'reemplazar') {
    for (const t of ['animales', 'calificaciones', 'huevos', 'campanas', 'lotes', 'incubaciones']) await db.vaciar(t);
  }
  const fecha = (r) => r.updated_at || r.created_at || '';
  const cuenta = {};
  for (const t of TABLAS) {
    let lista = datos[t];
    if (modo === 'fusionar' && lista.length) {
      const locales = new Map((await db.todos(t)).map(r => [r.id, r]));
      lista = lista.filter(r => !locales.has(r.id) || fecha(r) > fecha(locales.get(r.id)));
    }
    if (lista.length) await db.guardarVarios(t, lista);
    cuenta[t] = lista.length;
  }
  // Con servidor: lo propio se envía para que llegue al Libro central
  if (supabaseConfigurado() && perfil) {
    const mios = (r) => r.usuario_id === perfil.id;
    for (const a of datos.animales.filter(mios)) await sync.encolar('animales', 'upsert', a);
    for (const hv of datos.huevos.filter(mios)) await sync.encolar('huevos', 'upsert', hv);
    for (const c of datos.campanas.filter(mios)) await sync.encolar('campanas', 'upsert', c);
    for (const l of (datos.lotes || []).filter(mios)) await sync.encolar('lotes', 'upsert', l);
    for (const i of (datos.incubaciones || []).filter(mios)) await sync.encolar('incubaciones', 'upsert', i);
    // Las calificaciones no se reenvían: una ficha cerrada no se modifica en el servidor
  }
  return { cuenta, adoptada };
}
