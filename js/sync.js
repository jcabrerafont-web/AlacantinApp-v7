// ============================================================================
// Cola de sincronización offline-first.
// Toda escritura se guarda primero en IndexedDB y se encola. La cola se drena
// cuando hay red y sesión de Supabase. Un elemento SOLO se elimina cuando
// Supabase confirma sin { error } (supabase-js no lanza excepciones).
// ============================================================================
import * as db from './db.js';
import { CONFIG, supabaseConfigurado } from './config.js';
import { anotarError } from './diagnostico.js';

let cliente = null;
let enCurso = null;
const oyentes = new Set();

export const usarCliente = (c) => { cliente = c; };
export const alCambiar = (fn) => { oyentes.add(fn); return () => oyentes.delete(fn); };
const avisar = async () => { const n = await pendientes(); oyentes.forEach(fn => fn(n)); };

export const pendientes = async () => (await db.todos('cola')).length;
export const listarCola = () => db.todos('cola');

/** Encola una operación. op: 'upsert' | 'delete' */
export async function encolar(tabla, op, registro) {
  if (!supabaseConfigurado()) return; // modo dispositivo: no hay servidor al que enviar
  await db.guardar('cola', {
    tabla, op, id: registro.id,
    registro: op === 'delete' ? { id: registro.id } : structuredClone(registro),
    creado: Date.now(), intentos: 0, error: null
  });
  await avisar();
  if (navigator.onLine) drenar();
}

// Sube las fotos en Base64 a Storage y devuelve el objeto fotos con URLs
async function subirFotos(registro) {
  const fotos = { ...(registro.fotos || {}) };
  for (const [tipo, valor] of Object.entries(fotos)) {
    if (typeof valor !== 'string' || !valor.startsWith('data:')) continue;
    const [cab, b64] = valor.split(',');
    const mime = cab.match(/data:(.*?);/)?.[1] || 'image/jpeg';
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    const ruta = `${registro.usuario_id}/${registro.id}/${tipo}.${mime.includes('webp') ? 'webp' : 'jpg'}`;
    const { error } = await cliente.storage.from(CONFIG.bucketFotos).upload(ruta, new Blob([bytes], { type: mime }), { upsert: true, contentType: mime });
    if (error) throw error;
    fotos[tipo] = cliente.storage.from(CONFIG.bucketFotos).getPublicUrl(ruta).data.publicUrl;
  }
  return fotos;
}

async function ejecutar(item) {
  if (item.op === 'delete') {
    return cliente.from(item.tabla).delete().eq('id', item.id);
  }
  let reg = item.registro;
  if (item.tabla === 'animales' && reg.fotos && Object.values(reg.fotos).some(v => typeof v === 'string' && v.startsWith('data:'))) {
    const fotos = await subirFotos(reg);
    reg = { ...reg, fotos };
    // Sustituir Base64 por URL en local: libera espacio en el móvil
    const local = await db.obtener('animales', reg.id);
    if (local) await db.guardar('animales', { ...local, fotos });
  }
  if (item.tabla === 'huevos') { const { apto, ...resto } = reg; reg = resto; } // "apto" es columna generada en el servidor
  return cliente.from(item.tabla).upsert(reg, { onConflict: 'id' });
}

/** Drena la cola en orden FIFO. Devuelve { ok, fallidos }. */
export function drenar() {
  if (enCurso) return enCurso;
  if (!cliente || !navigator.onLine) return Promise.resolve({ ok: 0, fallidos: 0, omitido: true });
  enCurso = (async () => {
    const { data } = await cliente.auth.getSession();
    if (!data?.session) return { ok: 0, fallidos: 0, omitido: true };
    let ok = 0;
    let fallidos = 0;
    const cola = (await db.todos('cola')).sort((a, b) => a.n - b.n);
    for (const item of cola) {
      try {
        const res = await ejecutar(item);
        if (res?.error) throw res.error;
        await db.borrar('cola', item.n);
        ok++;
      } catch (e) {
        fallidos++;
        anotarError(`Sincronización (${item.tabla}, ${item.op}): ${e?.message || e}`, 'sync');
        await db.guardar('cola', { ...item, intentos: item.intentos + 1, error: String(e?.message || e), ultimo: Date.now() });
        if (!navigator.onLine) break;
      }
    }
    await avisar();
    return { ok, fallidos };
  })().finally(() => { enCurso = null; });
  return enCurso;
}

export const sincronizando = () => Boolean(enCurso);

// Descarga por páginas (Supabase devuelve como máximo 1.000 filas por consulta) y solo
// lo cambiado desde la última vez (sync_ts lo pone el servidor). El margen cubre filas
// guardadas en transacciones que terminaron un poco después de la última descarga.
export const TAM_PAGINA = 1000;
const MARGEN_MS = 2 * 60 * 1000;
const TABLAS_DESCARGA = [
  ['censo_publico', 'animales'], ['animales', 'animales'], ['calificaciones', 'calificaciones'], ['huevos', 'huevos'],
  ['perfiles', 'perfiles'], ['campanas', 'campanas'], ['lotes', 'lotes'], ['incubaciones', 'incubaciones'], ['solicitudes', 'solicitudes']
];
// Marca por usuario y tabla: si otra persona inicia sesión en el mismo móvil, descarga lo suyo completo
const claveMarca = (usuarioId, tabla) => `sync:${usuarioId || 'visitante'}:${tabla}`;

async function bajarPaginas(usuarioId, tabla, alPagina) {
  const marca = await db.metaGet(claveMarca(usuarioId, tabla), null);
  const desde = marca ? new Date(Date.parse(marca) - MARGEN_MS).toISOString() : null;
  let max = marca, total = 0;
  for (let pagina = 0; ; pagina++) {
    let q = cliente.from(tabla).select('*');
    if (desde) q = q.gte('sync_ts', desde);
    const r = await q.order('sync_ts', { ascending: true }).order('id', { ascending: true })
      .range(pagina * TAM_PAGINA, pagina * TAM_PAGINA + TAM_PAGINA - 1);
    if (r.error) throw new Error(`${tabla}: ${r.error.message || r.error}`);
    const filas = r.data || [];
    await alPagina(filas);
    total += filas.length;
    for (const f of filas) if (f.sync_ts && (!max || Date.parse(f.sync_ts) > Date.parse(max))) max = f.sync_ts;
    if (filas.length < TAM_PAGINA) break;
  }
  if (max && max !== marca) await db.metaSet(claveMarca(usuarioId, tabla), max);
  return total;
}

/**
 * Descarga datos del servidor sin pisar cambios locales pendientes.
 * El alcance lo decide RLS: cada usuario recibe solo lo que puede ver.
 * Devuelve { filas, borradas } o false si no hay servidor o cobertura.
 */
export async function descargar(usuarioId) {
  if (!cliente || !navigator.onLine) return false;
  const pend = new Set((await db.todos('cola')).map(i => i.id));
  const propios = new Set((await db.todos('animales')).filter(a => a.usuario_id === usuarioId).map(a => a.id));
  let filas = 0, borradas = 0;
  // Primero los borrados y después las tablas: si algo se borró y se recuperó («Deshacer»),
  // la versión recuperada (más reciente) es la que queda.
  if (usuarioId) {
    const store = { huevos: 'huevos', campanas: 'campanas', lotes: 'lotes', incubaciones: 'incubaciones', perfiles: 'perfiles', solicitudes: 'solicitudes' };
    await bajarPaginas(usuarioId, 'borrados', async (lote) => {
      for (const b of lote) if (store[b.tabla] && !pend.has(b.registro)) { await db.borrar(store[b.tabla], b.registro); borradas++; }
    });
  }
  for (const [tabla, store] of TABLAS_DESCARGA) {
    if (tabla !== 'censo_publico' && !usuarioId) continue;
    filas += await bajarPaginas(usuarioId, tabla, async (lote) => {
      // Del censo público solo lo ajeno: lo propio llega completo (con datos privados) desde «animales»
      const validas = lote.filter(f => !pend.has(f.id) && !(tabla === 'censo_publico' && propios.has(f.id)));
      if (validas.length) await db.guardarVarios(store, validas);
    });
  }
  await db.metaSet(`sync:${usuarioId || 'visitante'}:ultima`, new Date().toISOString());
  return { filas, borradas };
}

/** Olvida las marcas: la próxima descarga trae todo de nuevo (p. ej. tras un error). */
export async function reiniciarMarcas(usuarioId) {
  for (const [tabla] of [...TABLAS_DESCARGA, ['borrados']]) await db.metaSet(claveMarca(usuarioId, tabla), null);
}
export const ultimaDescarga = (usuarioId) => db.metaGet(`sync:${usuarioId || 'visitante'}:ultima`, null);
