// ============================================================================
// Instalación de la app y conservación de los datos del móvil.
//  · Almacenamiento persistente: sin él, el navegador puede vaciar IndexedDB
//    (Chrome, si falta espacio; Safari en iPhone, tras 7 días sin abrir una web
//    que no está instalada).
//  · Instalar: botón del navegador (Android, ordenador) o instrucciones (iPhone).
// ============================================================================
let aplazado = null;            // evento beforeinstallprompt guardado para usarlo al pulsar «Instalar»
const oyentes = new Set();
const avisar = () => oyentes.forEach(fn => { try { fn(); } catch { /* sin efecto */ } });
export const alCambiar = (fn) => { oyentes.add(fn); return () => oyentes.delete(fn); };

export const esIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const instalada = () => window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
export const puedeInstalar = () => Boolean(aplazado);

export function vigilar() {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); aplazado = e; avisar(); });
  window.addEventListener('appinstalled', () => { aplazado = null; avisar(); });
}

export async function instalar() {
  if (!aplazado) return false;
  aplazado.prompt();
  const { outcome } = await aplazado.userChoice;
  aplazado = null;
  avisar();
  return outcome === 'accepted';
}

// Pide que el navegador no borre los datos. Chrome lo concede solo (app instalada o
// usada a menudo); Firefox pregunta; Safari lo concede a las apps instaladas.
export async function pedirPersistencia() {
  try {
    if (!navigator.storage?.persist) return null;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch { return null; }
}

export async function estadoAlmacen() {
  const r = { persistente: null, usoMB: null, cuotaMB: null };
  try {
    if (navigator.storage?.persisted) r.persistente = await navigator.storage.persisted();
    if (navigator.storage?.estimate) {
      const e = await navigator.storage.estimate();
      r.usoMB = e.usage != null ? e.usage / 1048576 : null;
      r.cuotaMB = e.quota != null ? e.quota / 1048576 : null;
    }
  } catch { /* navegador sin soporte */ }
  return r;
}

// ¿Hay que advertir? Solo si los datos corren peligro: no instalada en iPhone, o almacenamiento no persistente
export async function riesgo() {
  const a = await estadoAlmacen();
  if (esIOS() && !instalada()) return 'ios';
  if (a.persistente === false) return 'no-persistente';
  return null;
}
