// ============================================================================
// Autenticación y roles.
// · Con Supabase: Supabase Auth es la única autoridad y el rol se lee de la
//   tabla `perfiles` (protegida por RLS y trigger). Las credenciales se cachean
//   como hash PBKDF2 para poder entrar sin cobertura en el gallinero.
// · Sin Supabase ("modo dispositivo"): cuentas locales con hash PBKDF2; solo
//   roles de criador (los roles de inspección exigen servidor).
// ============================================================================
import * as db from './db.js';
import { CONFIG, supabaseConfigurado } from './config.js';
import { uuid } from './ui.js';

export const ROLES = Object.freeze({
  visitante: 'Visitante',
  aspirante: 'Aspirante',
  criador: 'Criador',
  inspector: 'Inspector',
  administrador: 'Administrador'
});
export const esAuditor = (rol) => rol === 'inspector' || rol === 'administrador';
export const regaValido = (r) => /^ES\d{12}$/.test(String(r || '').trim().toUpperCase());

let cliente = null;
export function crearCliente() {
  if (!supabaseConfigurado() || !window.supabase?.createClient) return null;
  if (!cliente) {
    cliente = window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true }
    });
  }
  return cliente;
}
export const obtenerCliente = () => cliente;

// ---- PBKDF2 ---------------------------------------------------------------
const b64 = (u8) => btoa(String.fromCharCode(...u8));
const deb64 = (s) => Uint8Array.from(atob(s), c => c.charCodeAt(0));
async function derivar(password, salt) {
  const clave = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 210000, hash: 'SHA-256' }, clave, 256);
  return new Uint8Array(bits);
}
async function guardarCredencial(email, password, perfilId) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derivar(password, salt);
  const creds = await db.metaGet('credenciales', {});
  creds[email] = { hash: b64(hash), salt: b64(salt), perfilId };
  await db.metaSet('credenciales', creds);
}
async function verificarCredencial(email, password) {
  const c = (await db.metaGet('credenciales', {}))[email];
  if (!c) return null;
  const h = await derivar(password, deb64(c.salt));
  const ref = deb64(c.hash);
  let diff = h.length ^ ref.length;
  for (let i = 0; i < Math.min(h.length, ref.length); i++) diff |= h[i] ^ ref[i];
  return diff === 0 ? c.perfilId : null;
}

// ---- Perfil -----------------------------------------------------------------
function normalizarPerfil(p) {
  const rega = (p.rega || '').trim().toUpperCase();
  let rol = p.rol || 'aspirante';
  if (rol === 'aspirante' && regaValido(rega)) rol = 'criador';
  return { ...p, rega, rol };
}

async function perfilServidor(user) {
  const { data, error } = await cliente.from('perfiles').select('*').eq('id', user.id).maybeSingle();
  if (error) throw error;
  const p = normalizarPerfil(data || { id: user.id, email: user.email, nombre: user.user_metadata?.nombre || '', rol: 'aspirante' });
  await db.guardar('perfiles', p);
  return p;
}

export async function sesionGuardada() {
  const id = await db.metaGet('sesion');
  if (!id) return null;
  if (cliente && navigator.onLine) {
    const { data, error } = await cliente.auth.getUser();
    if (data?.user?.id === id) {
      try { return await perfilServidor(data.user); } catch { /* sigue con la copia local */ }
    } else if ((data?.user && data.user.id !== id) || error?.name === 'AuthSessionMissingError' || error?.status === 401 || error?.status === 403) {
      // Sesión caducada, revocada o de otra cuenta: hay que volver a entrar
      await db.metaSet('sesion', null);
      return null;
    }
  }
  const p = await db.obtener('perfiles', id);
  return p ? normalizarPerfil(p) : null;
}

export async function entrar(email, password) {
  email = email.trim().toLowerCase();
  if (cliente && navigator.onLine) {
    const { data, error } = await cliente.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message === 'Invalid login credentials' ? 'Correo o contraseña incorrectos.' : error.message);
    const p = await perfilServidor(data.user);
    await guardarCredencial(email, password, p.id);
    await db.metaSet('sesion', p.id);
    return p;
  }
  const id = await verificarCredencial(email, password);
  if (!id) {
    throw new Error(cliente
      ? 'Sin conexión: solo pueden entrar las cuentas que ya iniciaron sesión con red en este dispositivo.'
      : 'Correo o contraseña incorrectos.');
  }
  const p = await db.obtener('perfiles', id);
  if (!p) throw new Error('Perfil no encontrado en este dispositivo.');
  await db.metaSet('sesion', id);
  return normalizarPerfil(p);
}

export async function registrar({ nombre, email, password, telefono }) {
  email = email.trim().toLowerCase();
  if (password.length < 8) throw new Error('La contraseña debe tener al menos 8 caracteres.');
  if (supabaseConfigurado()) {
    if (!cliente || !navigator.onLine) throw new Error('El registro de cuentas necesita conexión a internet.');
    const { data, error } = await cliente.auth.signUp({ email, password, options: { data: { nombre, telefono } } });
    if (error) throw new Error(error.message);
    if (!data.session) {
      return { pendienteConfirmacion: true };
    }
    const p = await perfilServidor(data.user);
    await guardarCredencial(email, password, p.id);
    await db.metaSet('sesion', p.id);
    return p;
  }
  const creds = await db.metaGet('credenciales', {});
  if (creds[email]) throw new Error('Ya existe una cuenta con ese correo en este dispositivo.');
  const p = normalizarPerfil({ id: uuid(), nombre, email, telefono, rol: 'aspirante', numero_socio: '', rega: '', created_at: new Date().toISOString() });
  await db.guardar('perfiles', p);
  await guardarCredencial(email, password, p.id);
  await db.metaSet('sesion', p.id);
  return p;
}

export async function salir() {
  if (cliente) { try { await cliente.auth.signOut(); } catch { /* sin red */ } }
  await db.metaSet('sesion', null);
}

export async function cambiarPassword(email, nueva) {
  if (nueva.length < 8) throw new Error('La contraseña debe tener al menos 8 caracteres.');
  if (cliente) {
    if (!navigator.onLine) throw new Error('Cambiar la contraseña necesita conexión.');
    const { error } = await cliente.auth.updateUser({ password: nueva });
    if (error) throw new Error(error.message);
  }
  const creds = await db.metaGet('credenciales', {});
  await guardarCredencial(email, nueva, creds[email]?.perfilId);
}

/** Actualiza datos del perfil. El rol nunca se envía (lo asigna un administrador). */
export async function actualizarPerfil(perfil, cambios) {
  const permitido = ['nombre', 'telefono', 'numero_socio', 'rega', 'municipio', 'provincia', 'latitud', 'longitud'];
  const limpio = Object.fromEntries(Object.entries(cambios).filter(([k]) => permitido.includes(k)));
  const nuevo = normalizarPerfil({ ...perfil, ...limpio, updated_at: new Date().toISOString() });
  await db.guardar('perfiles', nuevo);
  return { perfil: nuevo, paraServidor: { id: nuevo.id, ...limpio, updated_at: nuevo.updated_at } };
}
