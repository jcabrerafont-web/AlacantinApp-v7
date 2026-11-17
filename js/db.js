// ============================================================================
// Almacenamiento local (IndexedDB): fuente de verdad en el dispositivo para
// trabajar en gallineros sin cobertura. Supabase es la copia central.
// ============================================================================
const NOMBRE = 'alacantinapp-v7';
const VERSION = 3;
export const STORES = ['animales', 'calificaciones', 'huevos', 'perfiles', 'campanas', 'lotes', 'incubaciones'];

let conexion = null;

export function abrir() {
  if (conexion) return Promise.resolve(conexion);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(NOMBRE, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const s of STORES) {
        if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('cola')) db.createObjectStore('cola', { keyPath: 'n', autoIncrement: true });
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'clave' });
    };
    req.onsuccess = () => {
      conexion = req.result;
      conexion.onversionchange = () => { conexion.close(); conexion = null; };
      resolve(conexion);
    };
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('Base de datos local bloqueada por otra pestaña abierta de la app.'));
  });
}

function tx(store, modo, fn) {
  return abrir().then(db => new Promise((resolve, reject) => {
    const t = db.transaction(store, modo);
    const s = t.objectStore(store);
    let resultado;
    Promise.resolve(fn(s)).then(r => { resultado = r; });
    t.oncomplete = () => resolve(resultado);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error || new Error('Transacción abortada'));
  }));
}

const req2p = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

export const todos = (store) => tx(store, 'readonly', s => req2p(s.getAll()));
export const obtener = (store, id) => tx(store, 'readonly', s => req2p(s.get(id)));
export const guardar = (store, obj) => tx(store, 'readwrite', s => req2p(s.put(obj)));
export const borrar = (store, id) => tx(store, 'readwrite', s => req2p(s.delete(id)));
export const vaciar = (store) => tx(store, 'readwrite', s => req2p(s.clear()));
export const guardarVarios = (store, lista) => tx(store, 'readwrite', s => { lista.forEach(o => s.put(o)); });

export async function metaGet(clave, porDefecto = null) {
  const r = await obtener('meta', clave);
  return r ? r.valor : porDefecto;
}
export const metaSet = (clave, valor) => guardar('meta', { clave, valor });

export async function borrarTodo() {
  for (const s of [...STORES, 'cola', 'meta']) await vaciar(s);
}
