// ============================================================================
// Tesorería del Club. Aparte del Libro Genealógico: otro rol (tesorero), otras
// tablas y datos cifrados en el propio dispositivo (ver tesoreria/cripto.js).
// En el móvil y en el servidor solo hay texto cifrado; lo abierto vive en memoria
// mientras la tesorería está abierta y se borra al cerrarla o a los 15 minutos
// sin usarla.
// ============================================================================
import * as db from './db.js';
import * as sync from './sync.js';
import * as datos from './datos.js';
import { supabaseConfigurado } from './config.js';
import { obtenerCliente } from './auth.js';
import { uuid, hoyISO } from './ui.js';
import * as cripto from './tesoreria/cripto.js';
import { fechaExcel } from './tesoreria/xlsx.js';

export const FORMATO_COPIA = 'alacantinapp-tesoreria';
const MINUTOS_CIERRE = 15;

const t = { clave: null, socios: [], temporizador: null };
const oyentes = new Set();
export const alCambiar = (fn) => { oyentes.add(fn); return () => oyentes.delete(fn); };
const avisar = () => oyentes.forEach(fn => { try { fn(); } catch (e) { console.warn(e); } });

// ---------------------------------------------------------------------------
// ¿Es tesorero? Lo dice el servidor (tabla tesoreria_miembros, que solo se
// cambia desde Supabase). Sin conexión, lo último que dijo. En modo dispositivo
// (sin servidor), el administrador local.
// ---------------------------------------------------------------------------
export async function comprobarTesorero() {
  const p = datos.estado.perfil;
  if (!p) { datos.estado.tesorero = false; return false; }
  const clave = `tesorero:${p.id}`;
  let si = await db.metaGet(clave, false);
  if (!supabaseConfigurado()) si = p.rol === 'administrador';
  else if (navigator.onLine && obtenerCliente()) {
    try {
      const r = await obtenerCliente().rpc('es_tesorero');
      if (!r.error) { si = r.data === true; await db.metaSet(clave, si); }
    } catch { /* sin cambios: lo último conocido */ }
  }
  datos.estado.tesorero = Boolean(si);
  if (!si) cerrar();
  return datos.estado.tesorero;
}
export const esTesorero = () => Boolean(datos.estado.tesorero);

// ---------------------------------------------------------------------------
// Clave y apertura
// ---------------------------------------------------------------------------
const filaClave = async () => (await db.todos('tesoreria_clave')).sort((a, b) => a.created_at.localeCompare(b.created_at))[0] || null;
export const configurada = async () => Boolean(await filaClave());
export const abierta = () => Boolean(t.clave);

function vigilar() {
  clearTimeout(t.temporizador);
  if (t.clave) t.temporizador = setTimeout(() => { cerrar(); }, MINUTOS_CIERRE * 60000);
}
export const actividad = () => vigilar();

export function cerrar() {
  const estaba = Boolean(t.clave);
  t.clave = null; t.socios = [];
  clearTimeout(t.temporizador);
  if (estaba) avisar();
}

function exigirTesorero() {
  if (!esTesorero()) throw new Error('La tesorería solo la puede usar quien tiene el rol de tesorería.');
}
function exigirAbierta() {
  exigirTesorero();
  if (!t.clave) throw new Error('Abre la tesorería con su contraseña.');
}

export async function crear(contrasena, repetida) {
  exigirTesorero();
  if (await configurada()) throw new Error('La tesorería ya tiene contraseña. Ábrela con ella.');
  if (contrasena !== repetida) throw new Error('Las dos contraseñas no coinciden.');
  const { clave, envuelta } = await cripto.crearClave(contrasena);
  const ahora = new Date().toISOString();
  const fila = { id: uuid(), ...envuelta, version: 1, usuario_id: datos.estado.perfil.id, created_at: ahora, updated_at: ahora };
  await db.guardar('tesoreria_clave', fila);
  await sync.encolar('tesoreria_clave', 'upsert', fila);
  t.clave = clave;
  await recargar();
}

export async function abrir(contrasena) {
  exigirTesorero();
  const fila = await filaClave();
  if (!fila) throw new Error('La tesorería aún no tiene contraseña.');
  t.clave = await cripto.abrirClave(fila, contrasena);
  await recargar();
}

export async function cambiarContrasena(actual, nueva, repetida) {
  exigirAbierta();
  if (nueva !== repetida) throw new Error('Las dos contraseñas nuevas no coinciden.');
  cripto.comprobarContrasena(nueva);
  const fila = await filaClave();
  await cripto.abrirClave(fila, actual); // comprueba la actual
  const r = { ...fila, ...(await cripto.envolver(t.clave, nueva)), updated_at: new Date().toISOString() };
  await db.guardar('tesoreria_clave', r);
  await sync.encolar('tesoreria_clave', 'upsert', r);
  vigilar();
}

// Descifra lo guardado en el móvil (lo descargado del servidor incluido)
export async function recargar() {
  if (!t.clave) return;
  const filas = await db.todos('tesoreria');
  const socios = [];
  for (const f of filas) {
    if (f.tipo !== 'socio') continue;
    try { socios.push({ ...(await cripto.descifrar(t.clave, f.id, f.datos)), id: f.id }); }
    catch { console.warn('[tesorería] registro ilegible', f.id); }
  }
  t.socios = socios;
  vigilar();
  avisar();
}

async function guardarCifrado(tipo, id, objeto, creado) {
  const ahora = new Date().toISOString();
  const fila = { id, tipo, datos: await cripto.cifrar(t.clave, id, objeto), usuario_id: datos.estado.perfil.id, created_at: creado || ahora, updated_at: ahora };
  await db.guardar('tesoreria', fila);
  await sync.encolar('tesoreria', 'upsert', fila);
}

// ---------------------------------------------------------------------------
// Socios
// ---------------------------------------------------------------------------
// [campo, etiqueta, palabras de los títulos del Excel que lo identifican]
export const CAMPOS_SOCIO = [
  ['numero', 'Nº de socio', ['n socio', 'no socio', 'num socio', 'numero socio', 'numero', 'socio n', 'n']],
  ['nombre', 'Nombre', ['nombre']],
  ['apellidos', 'Apellidos', ['apellidos', 'apellido']],
  ['dni', 'DNI / NIE', ['dni', 'nif', 'nie', 'documento']],
  ['telefono', 'Teléfono', ['telefono', 'tlf', 'tfno', 'movil', 'tel']],
  ['email', 'Correo', ['email', 'e mail', 'correo', 'mail']],
  ['direccion', 'Dirección', ['direccion', 'domicilio', 'calle']],
  ['cp', 'Código postal', ['cp', 'c p', 'codigo postal', 'postal']],
  ['municipio', 'Municipio', ['municipio', 'poblacion', 'localidad', 'ciudad']],
  ['provincia', 'Provincia', ['provincia']],
  ['fecha_alta', 'Fecha de alta', ['fecha alta', 'alta', 'fecha de alta', 'ingreso']],
  ['fecha_baja', 'Fecha de baja', ['fecha baja', 'baja', 'fecha de baja']],
  ['iban', 'IBAN (cuenta)', ['iban', 'cuenta', 'ccc', 'cuenta bancaria']],
  ['mandato_ref', 'Referencia del mandato SEPA', ['mandato', 'referencia mandato', 'ref mandato']],
  ['mandato_fecha', 'Fecha de firma del mandato', ['fecha mandato', 'firma mandato']],
  ['notas', 'Notas', ['notas', 'observaciones', 'comentarios']]
];
const CAMPOS_FECHA = new Set(['fecha_alta', 'fecha_baja', 'mandato_fecha']);
export const normalizar = (s) => String(s ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export const nombreCompleto = (s) => [s.nombre, s.apellidos].filter(Boolean).join(' ') || '(sin nombre)';
export const estaDeBaja = (s, dia = hoyISO()) => Boolean(s.fecha_baja && s.fecha_baja <= dia);
export function socios() {
  exigirAbierta();
  vigilar();
  const num = (s) => (Number.isFinite(Number(s.numero)) && String(s.numero).trim() !== '' ? Number(s.numero) : Infinity);
  return [...t.socios].sort((a, b) => num(a) - num(b) || nombreCompleto(a).localeCompare(nombreCompleto(b), 'es'));
}

export function ibanValido(iban) {
  const s = String(iban || '').replace(/\s+/g, '').toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(s)) return false;
  if (s.startsWith('ES') && s.length !== 24) return false;
  const reord = (s.slice(4) + s.slice(0, 4)).replace(/[A-Z]/g, c => String(c.charCodeAt(0) - 55));
  let resto = 0;
  for (const d of reord) resto = (resto * 10 + Number(d)) % 97;
  return resto === 1;
}
export const formatearIban = (iban) => String(iban || '').replace(/\s+/g, '').toUpperCase().replace(/(.{4})/g, '$1 ').trim();

function limpiarSocio(s) {
  const r = {};
  for (const [k] of CAMPOS_SOCIO) {
    let v = s[k];
    if (v === undefined || v === null) { r[k] = null; continue; }
    v = typeof v === 'number' && !CAMPOS_FECHA.has(k) ? String(v) : v;
    r[k] = typeof v === 'string' ? (v.trim() || null) : v;
  }
  if (r.iban) r.iban = formatearIban(r.iban);
  if (r.dni) r.dni = String(r.dni).replace(/[\s.-]+/g, '').toUpperCase();
  if (r.email) r.email = r.email.toLowerCase();
  r.perfil_id = s.perfil_id || null;
  return r;
}

export function validarSocio(s, { id = null } = {}) {
  const e = [];
  if (!s.nombre && !s.apellidos) e.push('Escribe el nombre del socio.');
  if (s.numero && t.socios.some(x => x.id !== id && String(x.numero) === String(s.numero))) e.push(`El número de socio ${s.numero} ya lo tiene otra persona.`);
  if (s.iban && !ibanValido(s.iban)) e.push('El IBAN no es válido (revisa los dígitos).');
  if (s.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s.email)) e.push('El correo no parece válido.');
  for (const k of CAMPOS_FECHA) if (s[k] && !/^\d{4}-\d{2}-\d{2}$/.test(s[k])) e.push(`La ${CAMPOS_SOCIO.find(c => c[0] === k)[1].toLowerCase()} no es una fecha válida.`);
  if (s.fecha_alta && s.fecha_baja && s.fecha_baja < s.fecha_alta) e.push('La fecha de baja es anterior a la de alta.');
  return e;
}

export async function guardarSocio(socio) {
  exigirAbierta();
  const id = socio.id || uuid();
  const s = limpiarSocio(socio);
  const errores = validarSocio(s, { id });
  if (errores.length) throw new Error(errores.join('\n'));
  const previo = t.socios.find(x => x.id === id);
  await guardarCifrado('socio', id, { ...s, creado: previo?.creado || new Date().toISOString() });
  await recargar();
  return { ...s, id };
}

export async function borrarSocio(id) {
  exigirAbierta();
  await db.borrar('tesoreria', id);
  await sync.encolar('tesoreria', 'delete', { id });
  await recargar();
}

// ---------------------------------------------------------------------------
// Importar socios desde un Excel (el del Club, por ejemplo). Se lee y se cifra en
// este dispositivo. mapa: { campo: índiceDeColumna }. Coincidencia por nº de socio
// y, si no tiene, por DNI: se actualiza; si no, se da de alta.
// ---------------------------------------------------------------------------
export function adivinarMapa(titulos) {
  const norm = titulos.map(normalizar);
  const mapa = {};
  const usados = new Set();
  // Primero coincidencias exactas; después, que el título contenga la palabra
  for (const exacta of [true, false]) {
    for (const [campo, , alias] of CAMPOS_SOCIO) {
      if (mapa[campo] !== undefined) continue;
      const i = norm.findIndex((x, j) => !usados.has(j) && x && alias.some(a => (exacta ? x === a : a.length > 2 && x.includes(a))));
      if (i >= 0) { mapa[campo] = i; usados.add(i); }
    }
  }
  return mapa;
}

export function filaTitulos(filas) {
  const i = filas.findIndex(f => (f || []).filter(v => typeof v === 'string' && v.trim()).length >= 3);
  return i < 0 ? 0 : i;
}

export function prepararImportacion(filas, filaTit, mapa) {
  const lista = [];
  for (const f of filas.slice(filaTit + 1)) {
    if (!f || !f.some(v => v !== null && v !== '')) continue;
    const s = {};
    for (const [campo] of CAMPOS_SOCIO) {
      const i = mapa[campo];
      if (i === undefined || i === null || i === '') continue;
      const v = f[Number(i)];
      s[campo] = CAMPOS_FECHA.has(campo) ? fechaDe(v) : v;
    }
    if (!s.nombre && !s.apellidos) continue;
    lista.push(limpiarSocio(s));
  }
  return lista;
}
const fechaDe = fechaExcel;

export async function importarSocios(lista) {
  exigirAbierta();
  let nuevos = 0, actualizados = 0;
  const errores = [];
  for (const s of lista) {
    const previo = (s.numero && t.socios.find(x => String(x.numero) === String(s.numero)))
      || (s.dni && t.socios.find(x => x.dni && x.dni === s.dni)) || null;
    const fusion = previo ? { ...previo, ...Object.fromEntries(Object.entries(s).filter(([, v]) => v !== null)) } : s;
    const e = validarSocio(fusion, { id: previo?.id || null });
    if (e.length) { errores.push(`${nombreCompleto(s)}: ${e.join(' ')}`); continue; }
    const id = previo?.id || uuid();
    await guardarCifrado('socio', id, { ...fusion, id: undefined, creado: previo?.creado || new Date().toISOString() });
    t.socios = [...t.socios.filter(x => x.id !== id), { ...fusion, id }];
    if (previo) actualizados++; else nuevos++;
  }
  await recargar();
  return { nuevos, actualizados, errores };
}

// ---------------------------------------------------------------------------
// Copia cifrada (para guardarla fuera: se abre con la contraseña de tesorería)
// ---------------------------------------------------------------------------
export async function copiaCifrada() {
  exigirAbierta();
  return { formato: FORMATO_COPIA, version: 1, creado: new Date().toISOString(),
    clave: await filaClave(), registros: await db.todos('tesoreria') };
}

export async function restaurarCopia(copia, contrasena) {
  exigirTesorero();
  if (!copia || copia.formato !== FORMATO_COPIA || !copia.clave || !Array.isArray(copia.registros)) throw new Error('El archivo no es una copia de la tesorería.');
  const local = await filaClave();
  if (local && local.id !== copia.clave.id) throw new Error('Esta copia es de otra tesorería (otra clave). Solo se puede restaurar en un dispositivo sin tesorería o con la misma.');
  const clave = await cripto.abrirClave(copia.clave, contrasena);
  // Comprueba que los registros se pueden abrir antes de guardar nada
  for (const f of copia.registros.slice(0, 3)) await cripto.descifrar(clave, f.id, f.datos);
  if (!local) { await db.guardar('tesoreria_clave', copia.clave); await sync.encolar('tesoreria_clave', 'upsert', copia.clave); }
  const actuales = new Map((await db.todos('tesoreria')).map(f => [f.id, f]));
  let restaurados = 0;
  for (const f of copia.registros) {
    const a = actuales.get(f.id);
    if (a && a.updated_at >= f.updated_at) continue;
    await db.guardar('tesoreria', f);
    await sync.encolar('tesoreria', 'upsert', f);
    restaurados++;
  }
  t.clave = clave;
  await recargar();
  return restaurados;
}
