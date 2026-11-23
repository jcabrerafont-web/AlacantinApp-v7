// ============================================================================
// Cifrado de la tesorería (Web Crypto del navegador, sin librerías externas).
//  · Una clave de datos (AES-GCM 256) aleatoria cifra cada registro.
//  · Esa clave se guarda «envuelta» con otra derivada de la contraseña de
//    tesorería (PBKDF2-SHA-256). Cambiar la contraseña solo vuelve a envolverla.
//  · Cada registro lleva su id como dato asociado: no se puede cambiar el
//    contenido de un registro por el de otro sin que el descifrado falle.
// La contraseña y la clave abierta nunca salen del dispositivo ni se guardan.
// ============================================================================
export const ITERACIONES = 600000;   // recomendación OWASP para PBKDF2-SHA-256
export const MIN_CONTRASENA = 12;

const enc = new TextEncoder(), dec = new TextDecoder();
const b64 = (buf) => { const b = new Uint8Array(buf); let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000)); return btoa(s); };
const desdeB64 = (s) => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const azar = (n) => crypto.getRandomValues(new Uint8Array(n));

async function derivar(contrasena, sal, iteraciones) {
  const base = await crypto.subtle.importKey('raw', enc.encode(contrasena.normalize('NFC')), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: sal, iterations: iteraciones, hash: 'SHA-256' }, base,
    { name: 'AES-GCM', length: 256 }, false, ['wrapKey', 'unwrapKey']);
}

export function comprobarContrasena(c) {
  if (String(c || '').length < MIN_CONTRASENA) throw new Error(`La contraseña de tesorería debe tener al menos ${MIN_CONTRASENA} caracteres. Mejor una frase que recuerdes.`);
}

/** Crea la clave de datos y la devuelve abierta junto con su versión envuelta (para guardar). */
export async function crearClave(contrasena, iteraciones = ITERACIONES) {
  comprobarContrasena(contrasena);
  const clave = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  return { clave, envuelta: await envolver(clave, contrasena, iteraciones) };
}

export async function envolver(clave, contrasena, iteraciones = ITERACIONES) {
  const sal = azar(16), iv = azar(12);
  const kek = await derivar(contrasena, sal, iteraciones);
  const envuelta = await crypto.subtle.wrapKey('raw', clave, kek, { name: 'AES-GCM', iv });
  return { sal: b64(sal), iteraciones, iv: b64(iv), clave: b64(envuelta) };
}

/** Abre la clave de datos con la contraseña. Contraseña errónea: lanza un error claro. */
export async function abrirClave(envuelta, contrasena) {
  const kek = await derivar(contrasena, desdeB64(envuelta.sal), envuelta.iteraciones);
  try {
    return await crypto.subtle.unwrapKey('raw', desdeB64(envuelta.clave), kek, { name: 'AES-GCM', iv: desdeB64(envuelta.iv) },
      { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  } catch {
    throw new Error('La contraseña de tesorería no es correcta.');
  }
}

/** Cifra un objeto: devuelve texto «v1.<iv>.<cifrado>» ligado al id del registro. */
export async function cifrar(clave, id, objeto) {
  const iv = azar(12);
  const datos = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: enc.encode(id) }, clave, enc.encode(JSON.stringify(objeto)));
  return `v1.${b64(iv)}.${b64(datos)}`;
}

export async function descifrar(clave, id, texto) {
  const [v, iv, datos] = String(texto).split('.');
  if (v !== 'v1' || !iv || !datos) throw new Error('Registro cifrado con un formato desconocido.');
  const plano = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: desdeB64(iv), additionalData: enc.encode(id) }, clave, desdeB64(datos));
  return JSON.parse(dec.decode(plano));
}

// Código de recuperación: 30 caracteres al azar (unos 150 bits) en grupos de 5,
// sin letras que se confundan (0/O, 1/I/L). Abre la tesorería si se olvida la contraseña.
const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export function codigoRecuperacion() {
  const b = azar(30);
  const s = Array.from(b, x => ALFABETO[x % ALFABETO.length]).join('');
  return s.match(/.{5}/g).join('-');
}
export const normalizarCodigo = (c) => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '').match(/.{1,5}/g)?.join('-') || '';
