// ============================================================================
// Cola de sincronización offline-first.
// Toda escritura se guarda primero en IndexedDB y se encola. La cola se drena
// cuando hay red y sesión de Supabase. Un elemento SOLO se elimina cuando
// Supabase confirma sin { error } (supabase-js no lanza excepciones).
// ============================================================================
import * as db from './db.js';
import { CONFIG, supabaseConfigurado } from './config.js';

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

/**
 * Descarga datos del servidor sin pisar cambios locales pendientes.
 * El alcance lo decide RLS: cada usuario recibe solo lo que puede ver.
 */
export async function descargar(usuarioId) {
  if (!cliente || !navigator.onLine) return false;
  const pend = new Set((await db.todos('cola')).map(i => i.id));
  const fusionar = async (store, filas) => {
    const validas = (filas || []).filter(f => !pend.has(f.id));
    if (validas.length) await db.guardarVarios(store, validas);
  };
  // Censo público completo (sin datos personales): base del pedigrí y del Fx
  const pub = await cliente.from('censo_publico').select('*');
  if (!pub.error) {
    const propios = new Set((await db.todos('animales')).filter(a => a.usuario_id === usuarioId).map(a => a.id));
    await fusionar('animales', pub.data.filter(a => !propios.has(a.id)));
  }
  if (usuarioId) {
    for (const [tabla, store] of [['animales', 'animales'], ['calificaciones', 'calificaciones'], ['huevos', 'huevos'], ['perfiles', 'perfiles'], ['campanas', 'campanas']]) {
      const r = await cliente.from(tabla).select('*');
      if (!r.error) await fusionar(store, r.data);
    }
  }
  return true;
}
