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
import * as sepa from './tesoreria/sepa.js';
import { CONFIG } from './config.js';

export const FORMATO_COPIA = 'alacantinapp-tesoreria';
const MINUTOS_CIERRE = 15;

const t = { clave: null, socios: [], movimientos: [], partidas: [], reglas: [], remesas: [], presupuestos: [], config: null, temporizador: null };
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
  t.clave = null; t.socios = []; t.movimientos = []; t.partidas = []; t.reglas = []; t.remesas = []; t.presupuestos = []; t.config = null;
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
  const por = { socio: [], movimiento: [], partida: [], regla: [], remesa: [], presupuesto: [], config: [] };
  for (const f of filas) {
    if (!por[f.tipo]) continue;
    try { por[f.tipo].push({ ...(await cripto.descifrar(t.clave, f.id, f.datos)), id: f.id, _actualizado: f.updated_at }); }
    catch { console.warn('[tesorería] registro ilegible', f.id); }
  }
  t.socios = por.socio; t.movimientos = por.movimiento; t.partidas = por.partida; t.reglas = por.regla; t.remesas = por.remesa; t.presupuestos = por.presupuesto;
  t.config = por.config.sort((a, b) => String(b._actualizado).localeCompare(String(a._actualizado)))[0] || null;
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
  ['bic', 'BIC del banco del socio (opcional)', ['bic', 'swift']],
  ['cuota_especial', 'Cuota especial (€; 0 si está exento)', ['cuota especial', 'exento']],
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
  if (r.cuota_especial !== null) { const c = Number(String(r.cuota_especial).replace(',', '.')); r.cuota_especial = Number.isFinite(c) && c >= 0 ? Math.round(c * 100) / 100 : r.cuota_especial; }
  if (r.dni) r.dni = String(r.dni).replace(/[\s.-]+/g, '').toUpperCase();
  if (r.bic) r.bic = String(r.bic).replace(/\s+/g, '').toUpperCase();
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
  if (s.bic && !sepa.bicValido(s.bic)) e.push('El BIC no es válido (8 u 11 letras y números).');
  if (s.mandato_ref && t.socios.some(x => x.id !== id && x.mandato_ref && x.mandato_ref === s.mandato_ref)) e.push('Esa referencia de mandato ya la tiene otro socio.');
  for (const k of CAMPOS_FECHA) if (s[k] && !/^\d{4}-\d{2}-\d{2}$/.test(s[k])) e.push(`La ${CAMPOS_SOCIO.find(c => c[0] === k)[1].toLowerCase()} no es una fecha válida.`);
  if (s.fecha_alta && s.fecha_baja && s.fecha_baja < s.fecha_alta) e.push('La fecha de baja es anterior a la de alta.');
  if (s.cuota_especial !== null && s.cuota_especial !== undefined && !(typeof s.cuota_especial === 'number' && s.cuota_especial >= 0)) e.push('La cuota especial debe ser un importe (0 si está exento).');
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

// ===========================================================================
// Fase 2: movimientos del banco, partidas y reglas
// ===========================================================================
const quitarInternos = ({ id, _actualizado, ...resto }) => resto;
async function guardarRegistro(tipo, obj) {
  const id = obj.id || uuid();
  const previo = [...t.movimientos, ...t.partidas, ...t.reglas, ...t.remesas, ...t.presupuestos, ...(t.config ? [t.config] : [])].find(x => x.id === id);
  await guardarCifrado(tipo, id, quitarInternos({ ...obj, creado: previo?.creado || obj.creado || new Date().toISOString() }));
  return id;
}
async function borrarRegistro(id) {
  await db.borrar('tesoreria', id);
  await sync.encolar('tesoreria', 'delete', { id });
}

// --- Configuración (cuenta del Club e importe de la cuota) ------------------
export const configuracion = () => ({ cuota: 25, cuenta: null, ...(t.config || {}) });
export async function guardarConfiguracion(cambios) {
  exigirAbierta();
  const c = { ...configuracion(), ...cambios };
  const cuota = Number(String(c.cuota).replace(',', '.'));
  if (!Number.isFinite(cuota) || cuota <= 0) throw new Error('Indica el importe de la cuota.');
  await guardarRegistro('config', { ...c, cuota, id: t.config?.id });
  await recargar();
}

// --- Partidas -------------------------------------------------------------
// [nombre, tipo, palabras del concepto del banco que la identifican]
export const PARTIDAS_INICIALES = [
  ['Cuotas de socios', 'ingreso', [], true],
  ['Anillas', 'ambos', ['anilla']],
  ['Federación (FESACOCUR)', 'gasto', ['federacion', 'fesacocur', 'federaion']],
  ['Encuentros y exposiciones', 'ambos', ['encuentro', 'exposicion', 'feria', 'concurso']],
  ['Material y difusión', 'gasto', []],
  ['Comisiones y gastos del banco', 'gasto', ['comision', 'mantenimiento', 'liquidacion']],
  ['Subvenciones y donativos', 'ingreso', ['subvencion', 'donativo', 'donacion']],
  ['Otros', 'ambos', []]
];
export const partidas = () => { exigirAbierta(); return [...t.partidas].sort((a, b) => (a.orden ?? 99) - (b.orden ?? 99) || a.nombre.localeCompare(b.nombre, 'es')); };
export const partidaCuotas = () => t.partidas.find(p => p.cuotas) || null;
export const nombrePartida = (id) => t.partidas.find(p => p.id === id)?.nombre || null;

export async function asegurarPartidas() {
  exigirAbierta();
  if (t.partidas.length) return;
  let orden = 0;
  for (const [nombre, tipo, palabras, cuotas] of PARTIDAS_INICIALES) {
    const id = await guardarRegistro('partida', { nombre, tipo, orden: orden++, cuotas: Boolean(cuotas) });
    for (const texto of palabras) await guardarRegistro('regla', { texto, partida: id, signo: tipo === 'gasto' ? '-' : tipo === 'ingreso' ? '+' : '' });
  }
  await recargar();
}

export async function guardarPartida(p) {
  exigirAbierta();
  const nombre = String(p.nombre || '').trim();
  if (!nombre) throw new Error('Escribe el nombre de la partida.');
  if (t.partidas.some(x => x.id !== p.id && normalizar(x.nombre) === normalizar(nombre))) throw new Error('Ya hay una partida con ese nombre.');
  const previa = t.partidas.find(x => x.id === p.id);
  await guardarRegistro('partida', { ...(previa ? quitarInternos(previa) : { orden: t.partidas.length, cuotas: false }), nombre, tipo: p.tipo || previa?.tipo || 'ambos', id: p.id });
  await recargar();
}
export async function borrarPartida(id) {
  exigirAbierta();
  const usos = t.movimientos.filter(m => m.partida === id).length;
  if (usos) throw new Error(`No se puede borrar: tiene ${usos} movimiento(s). Pásalos antes a otra partida.`);
  if (t.partidas.find(p => p.id === id)?.cuotas) throw new Error('La partida de cuotas no se puede borrar.');
  for (const r of t.reglas.filter(r => r.partida === id)) await borrarRegistro(r.id);
  await borrarRegistro(id);
  await recargar();
}

// --- Reglas: «si el concepto contiene…, va a tal partida» ---------------------
export const reglas = () => { exigirAbierta(); return [...t.reglas].sort((a, b) => a.texto.localeCompare(b.texto, 'es')); };
export async function guardarRegla(r) {
  exigirAbierta();
  const texto = normalizar(r.texto);
  if (texto.length < 3) throw new Error('El texto de la regla debe tener al menos 3 letras.');
  if (!t.partidas.some(p => p.id === r.partida)) throw new Error('Elige la partida.');
  if (t.reglas.some(x => x.id !== r.id && x.texto === texto && (x.signo || '') === (r.signo || ''))) throw new Error('Ya hay una regla con ese texto.');
  await guardarRegistro('regla', { texto, partida: r.partida, signo: r.signo || '', id: r.id });
  await recargar();
}
export async function borrarRegla(id) { exigirAbierta(); await borrarRegistro(id); await recargar(); }

// --- Quién paga: el nombre del concepto del banco frente a los socios -----------
const PREFIJOS = new Set(['trf', 'transf', 'transferencia', 'traspaso', 'bizum', 'ingreso', 'de', 'del', 'la', 'las', 'los', 'y', 'rcbo', 'recibo', 'abono', 'pago']);
const palabras = (s) => normalizar(s).split(' ').filter(w => w.length > 1 && !PREFIJOS.has(w));
export function socioDelConcepto(concepto) {
  const enConcepto = new Set(palabras(concepto));
  if (!enConcepto.size) return null;
  let mejor = null, empate = false;
  for (const s of t.socios) {
    const suyas = [...new Set(palabras(`${s.nombre || ''} ${s.apellidos || ''}`))];
    if (suyas.length < 2) continue;
    const coinciden = suyas.filter(w => enConcepto.has(w)).length;
    // El banco corta el concepto a unos 40 caracteres: basta con 2 palabras y 2/3 del nombre
    const nota = coinciden / suyas.length;
    if (coinciden < 2 || nota < 0.66) continue;
    if (!mejor || nota > mejor.nota) { mejor = { socio: s, nota }; empate = false; }
    else if (nota === mejor.nota) empate = true;
  }
  return mejor && !empate ? mejor.socio : null;
}

// Propuesta automática para un movimiento (no toca lo que se haya puesto a mano)
export function clasificar(m) {
  const n = normalizar(m.concepto);
  const signo = m.importe >= 0 ? '+' : '-';
  const regla = t.reglas.find(r => n.includes(r.texto) && (!r.signo || r.signo === signo));
  const socio = m.importe > 0 ? socioDelConcepto(m.concepto) : null;
  let partida = regla?.partida || null;
  const cuotas = partidaCuotas();
  // Abono de una remesa SEPA del Club: mismo importe y fecha cercana a la de cobro
  const remesa = m.importe > 0 ? remesaDelAbono(m) : null;
  if (remesa && cuotas) return { partida: cuotas.id, socio_id: null, anio: remesa.anio, remesa_id: remesa.id };
  if (!partida && socio && cuotas && Math.abs(m.importe - configuracion().cuota) < 0.005) partida = cuotas.id;
  return { partida, socio_id: socio?.id || null, anio: partida && partida === cuotas?.id ? Number(String(m.fecha).slice(0, 4)) : null };
}

export async function aplicarReglas() {
  exigirAbierta();
  let cambiados = 0;
  for (const m of t.movimientos) {
    if (m.manual) continue;
    const c = clasificar(m);
    const nuevo = { partida: m.partida || c.partida, socio_id: m.socio_id || c.socio_id, anio: m.anio || c.anio, remesa_id: m.remesa_id || c.remesa_id || null };
    if (nuevo.partida !== m.partida || nuevo.socio_id !== m.socio_id || nuevo.anio !== m.anio || nuevo.remesa_id !== (m.remesa_id || null)) {
      await guardarRegistro('movimiento', { ...quitarInternos(m), ...nuevo, id: m.id }); cambiados++;
    }
  }
  await recargar();
  return cambiados;
}

// --- Movimientos ------------------------------------------------------------
export const claveMovimiento = (m) => `${m.fecha}|${m.apunte ?? ''}|${Number(m.importe).toFixed(2)}`;
export function movimientos({ anio = null, partida = undefined, socio = null, texto = '' } = {}) {
  exigirAbierta();
  vigilar();
  const n = normalizar(texto);
  return t.movimientos.filter(m => (!anio || String(m.fecha).startsWith(String(anio)))
      && (partida === undefined || (partida === null ? !m.partida : m.partida === partida))
      && (!socio || m.socio_id === socio)
      && (!n || normalizar(`${m.concepto} ${m.nota || ''} ${nombrePartida(m.partida) || ''}`).includes(n)))
    .sort((a, b) => b.fecha.localeCompare(a.fecha) || (b.apunte ?? 0) - (a.apunte ?? 0));
}
export const aniosMovimientos = () => [...new Set(t.movimientos.map(m => Number(String(m.fecha).slice(0, 4))))].sort((a, b) => b - a);

// Lee el Excel de movimientos de Caixa Popular (y otros parecidos): busca la fila de
// títulos y las columnas por nombre; la cuenta va en las primeras filas («IBAN»).
const COLUMNAS_BANCO = {
  fecha: ['fecha de la operacion', 'fecha operacion', 'fecha'], fecha_valor: ['fecha valor'],
  concepto: ['tipo movimiento', 'concepto', 'descripcion', 'movimiento'], importe: ['importe', 'cantidad'],
  saldo: ['saldo'], apunte: ['nro apunte', 'n apunte', 'numero apunte', 'apunte']
};
export function leerMovimientosBanco(hojas) {
  for (const hoja of hojas) {
    const i = hoja.filas.findIndex(f => { const n = (f || []).map(normalizar); return n.some(x => x === 'importe' || x === 'cantidad') && n.some(x => x.startsWith('fecha')); });
    if (i < 0) continue;
    const tit = hoja.filas[i].map(normalizar);
    const col = {};
    for (const [k, alias] of Object.entries(COLUMNAS_BANCO)) {
      const j = alias.map(a => tit.findIndex((x, n) => x === a && !Object.values(col).includes(n))).find(n => n >= 0);
      if (j !== undefined) col[k] = j;
    }
    if (col.fecha === undefined || col.importe === undefined || col.concepto === undefined) continue;
    let cuenta = null;
    for (const f of hoja.filas.slice(0, i)) { const k = (f || []).findIndex(v => normalizar(v) === 'iban'); if (k >= 0 && f[k + 1]) cuenta = String(f[k + 1]).replace(/\s+/g, '').toUpperCase(); }
    const lista = [];
    for (const f of hoja.filas.slice(i + 1)) {
      if (!f || f[col.importe] === null || f[col.importe] === undefined || f[col.importe] === '') continue;
      const importe = typeof f[col.importe] === 'number' ? f[col.importe] : Number(String(f[col.importe]).replace(/\./g, '').replace(',', '.'));
      const fecha = fechaExcel(f[col.fecha]);
      if (!fecha || !Number.isFinite(importe)) continue;
      const saldo = col.saldo === undefined ? null : (typeof f[col.saldo] === 'number' ? f[col.saldo] : Number(String(f[col.saldo] ?? '').replace(/\./g, '').replace(',', '.')));
      lista.push({ fecha, fecha_valor: col.fecha_valor === undefined ? null : fechaExcel(f[col.fecha_valor]), concepto: String(f[col.concepto] ?? '').trim(),
        importe: Math.round(importe * 100) / 100, saldo: Number.isFinite(saldo) ? Math.round(saldo * 100) / 100 : null,
        apunte: col.apunte === undefined || f[col.apunte] === null ? null : Number(f[col.apunte]) });
    }
    return { cuenta, movimientos: lista };
  }
  throw new Error('No se encuentran los movimientos en el Excel (faltan las columnas de fecha, concepto e importe).');
}

export async function importarMovimientos(hojas) {
  exigirAbierta();
  await asegurarPartidas();
  const { cuenta, movimientos: lista } = leerMovimientosBanco(hojas);
  const conf = configuracion();
  if (cuenta && conf.cuenta && cuenta !== conf.cuenta) throw new Error(`Este Excel es de otra cuenta (${formatearIban(cuenta)}), no de la del Club (${formatearIban(conf.cuenta)}).`);
  if (cuenta && !conf.cuenta) await guardarConfiguracion({ cuenta });
  const ya = new Set(t.movimientos.map(claveMovimiento));
  let nuevos = 0, repetidos = 0, clasificados = 0;
  for (const m of lista) {
    if (ya.has(claveMovimiento(m))) { repetidos++; continue; }
    const c = clasificar(m);
    if (c.partida) clasificados++;
    await guardarRegistro('movimiento', { ...m, ...c, nota: null, manual: false, origen: 'banco' });
    ya.add(claveMovimiento(m));
    nuevos++;
  }
  await recargar();
  return { nuevos, repetidos, clasificados, sinClasificar: nuevos - clasificados, huecos: comprobarSaldos() };
}

export async function guardarMovimiento(m) {
  exigirAbierta();
  const previo = t.movimientos.find(x => x.id === m.id);
  const importe = Math.round(Number(String(m.importe).replace(',', '.')) * 100) / 100;
  if (!previo) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(m.fecha || ''))) throw new Error('Indica la fecha.');
    if (!Number.isFinite(importe) || importe === 0) throw new Error('Indica el importe (en negativo si es un gasto).');
    if (!String(m.concepto || '').trim()) throw new Error('Escribe el concepto.');
  }
  if (m.partida && !t.partidas.some(p => p.id === m.partida)) throw new Error('Partida desconocida.');
  if (m.socio_id && !t.socios.some(s => s.id === m.socio_id)) throw new Error('Socio desconocido.');
  const anio = m.anio ? Number(m.anio) : null;
  if (anio !== null && (!Number.isInteger(anio) || anio < 2000 || anio > 2100)) throw new Error('El año de la cuota no es válido.');
  const base = previo ? quitarInternos(previo) : { fecha: m.fecha, fecha_valor: null, concepto: String(m.concepto).trim(), importe, saldo: null, apunte: null, origen: 'manual' };
  const remesa_id = m.remesa_id !== undefined ? (m.remesa_id || null) : (previo?.remesa_id || null);
  if (remesa_id && !t.remesas.some(r => r.id === remesa_id)) throw new Error('Remesa desconocida.');
  await guardarRegistro('movimiento', { ...base, partida: m.partida || null, socio_id: remesa_id ? null : (m.socio_id || null), anio, remesa_id, nota: String(m.nota || '').trim() || null, manual: true, id: previo?.id });
  await recargar();
}
export async function borrarMovimiento(id) {
  exigirAbierta();
  const m = t.movimientos.find(x => x.id === id);
  if (m?.origen === 'banco') throw new Error('Los movimientos del banco no se borran: si uno está mal clasificado, cámbialo.');
  await borrarRegistro(id); await recargar();
}

const dma = (iso) => String(iso).split('-').reverse().join('/');
// Comprueba que no falte ningún movimiento: apuntes seguidos y saldo = anterior + importe
export function comprobarSaldos() {
  const banco = t.movimientos.filter(m => m.origen === 'banco' && m.apunte !== null && m.saldo !== null).sort((a, b) => a.apunte - b.apunte);
  const huecos = [];
  for (let i = 1; i < banco.length; i++) {
    const a = banco[i - 1], b = banco[i];
    if (b.apunte !== a.apunte + 1) huecos.push({ desde: a, hasta: b, texto: `Faltan los apuntes ${a.apunte + 1}${b.apunte - a.apunte > 2 ? `–${b.apunte - 1}` : ''} (entre el ${dma(a.fecha)} y el ${dma(b.fecha)}).` });
    else if (Math.abs(a.saldo + b.importe - b.saldo) > 0.005) huecos.push({ desde: a, hasta: b, texto: `El saldo no cuadra entre los apuntes ${a.apunte} y ${b.apunte}.` });
  }
  return huecos;
}

export function saldoBanco() {
  const banco = t.movimientos.filter(m => m.origen === 'banco' && m.saldo !== null).sort((a, b) => (a.apunte ?? 0) - (b.apunte ?? 0) || a.fecha.localeCompare(b.fecha));
  const u = banco.at(-1);
  return u ? { saldo: u.saldo, fecha: u.fecha } : null;
}

export function resumen(anio) {
  exigirAbierta();
  const del = movimientos({ anio });
  const filas = partidas().map(p => {
    const ms = del.filter(m => m.partida === p.id);
    return { partida: p, ingresos: ms.filter(m => m.importe > 0).reduce((s, m) => s + m.importe, 0), gastos: ms.filter(m => m.importe < 0).reduce((s, m) => s - m.importe, 0), n: ms.length };
  }).filter(f => f.n);
  const sin = del.filter(m => !m.partida);
  return { filas, sinClasificar: sin.length, ingresos: del.filter(m => m.importe > 0).reduce((s, m) => s + m.importe, 0),
    gastos: del.filter(m => m.importe < 0).reduce((s, m) => s - m.importe, 0), n: del.length };
}

export const movimientosDeSocio = (id) => pagosDeCuotas().filter(m => m.socio_id === id).sort((a, b) => b.fecha.localeCompare(a.fecha));

// ===========================================================================
// Fase 3: cuotas por año
// ===========================================================================
// Socio del Club durante el año: dado de alta antes de que acabe y sin baja antes de que empiece
export const socioEnAnio = (s, anio) => (!s.fecha_alta || s.fecha_alta <= `${anio}-12-31`) && (!s.fecha_baja || s.fecha_baja >= `${anio}-01-01`);
export const cuotaDe = (s) => (typeof s.cuota_especial === 'number' ? s.cuota_especial : configuracion().cuota);

export function cuotasAnio(anio) {
  exigirAbierta();
  vigilar();
  const pc = partidaCuotas();
  const pagos = pagosDeCuotas().filter(m => pc && m.partida === pc.id && Number(m.anio) === Number(anio) && m.socio_id);
  const filas = socios().filter(s => socioEnAnio(s, anio)).map(s => {
    const suyos = pagos.filter(m => m.socio_id === s.id);
    const pagado = Math.round(suyos.reduce((x, m) => x + m.importe, 0) * 100) / 100;
    const debe = cuotaDe(s);
    const estado = debe === 0 ? 'exento' : pagado >= debe - 0.005 ? 'pagado' : pagado > 0 ? 'parcial' : 'pendiente';
    return { socio: s, debe, pagado, falta: Math.max(0, Math.round((debe - pagado) * 100) / 100), estado, pagos: suyos };
  });
  // Cuotas cobradas de personas que ya no figuran como socias ese año
  const fuera = pagos.filter(m => !filas.some(f => f.socio.id === m.socio_id));
  const total = (k) => Math.round(filas.reduce((x, f) => x + f[k], 0) * 100) / 100;
  return { anio: Number(anio), filas, fuera,
    cuenta: Object.fromEntries(['pagado', 'parcial', 'pendiente', 'exento'].map(e => [e, filas.filter(f => f.estado === e).length])),
    recaudado: total('pagado'), previsto: total('debe'), pendiente: total('falta') };
}
export const aniosCuotas = () => {
  const a = new Set([new Date().getFullYear(), ...t.movimientos.filter(m => m.anio).map(m => Number(m.anio))]);
  return [...a].sort((x, y) => y - x);
};

export async function pagoEnEfectivo(socioId, anio, importe, fecha = hoyISO()) {
  exigirAbierta();
  await asegurarPartidas();
  const s = t.socios.find(x => x.id === socioId);
  if (!s) throw new Error('Socio no encontrado.');
  await guardarMovimiento({ fecha, importe, concepto: `Cuota ${anio} en efectivo · ${nombreCompleto(s)}`, partida: partidaCuotas().id, socio_id: socioId, anio, nota: 'Efectivo' });
}

// Recordatorio: texto editable en Partidas › Cuota; {nombre}, {anio}, {importe}, {cuenta}
export const MENSAJE_CUOTA = 'Hola, {nombre}. Te recordamos que está pendiente la cuota {anio} del Club Gallina Alacantina ({importe}). Puedes pagarla por transferencia a la cuenta {cuenta}, indicando tu nombre. ¡Gracias!';
export function mensajeRecordatorio(fila) {
  const c = configuracion();
  const euros = `${fila.falta.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
  return String(c.mensaje || MENSAJE_CUOTA).replaceAll('{nombre}', fila.socio.nombre || nombreCompleto(fila.socio)).replaceAll('{anio}', String(fila.anio ?? ''))
    .replaceAll('{importe}', euros).replaceAll('{cuenta}', c.cuenta ? formatearIban(c.cuenta) : '(cuenta del Club)');
}
export function enlaceWhatsApp(telefono, texto) {
  let n = String(telefono || '').replace(/\D/g, '');
  if (!n) return null;
  if (n.length === 9) n = `34${n}`;
  if (n.startsWith('00')) n = n.slice(2);
  return `https://wa.me/${n}?text=${encodeURIComponent(texto)}`;
}

// ===========================================================================
// Fase 4: cuentas del año para la asamblea
// ===========================================================================
const r2 = (n) => Math.round(n * 100) / 100;
// Saldo del banco al empezar y al acabar el año, según los apuntes del extracto
function saldosBanco(anio) {
  const banco = t.movimientos.filter(m => m.origen === 'banco' && m.saldo !== null)
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || (a.apunte ?? 0) - (b.apunte ?? 0));
  const del = banco.filter(m => m.fecha.startsWith(String(anio)));
  const antes = banco.filter(m => m.fecha < `${anio}-01-01`).at(-1);
  const inicial = antes ? antes.saldo : del.length ? r2(del[0].saldo - del[0].importe) : null;
  const final = del.length ? del.at(-1).saldo : antes ? antes.saldo : null;
  return { inicial, final, desde: del[0]?.fecha || null, hasta: del.at(-1)?.fecha || null, completo: Boolean(antes) || Boolean(del.length) };
}

export function cuentasAnio(anio) {
  exigirAbierta();
  const a = Number(anio);
  const porPartida = (y) => {
    const del = t.movimientos.filter(m => m.fecha.startsWith(String(y)));
    const fila = (p) => { const ms = del.filter(m => m.partida === p); return { ingresos: r2(ms.filter(m => m.importe > 0).reduce((x, m) => x + m.importe, 0)), gastos: r2(ms.filter(m => m.importe < 0).reduce((x, m) => x - m.importe, 0)) }; };
    return { del, fila };
  };
  const act = porPartida(a), ant = porPartida(a - 1);
  const pres = presupuesto(a);
  const filas = partidas().map(p => ({ partida: p, ...act.fila(p.id), anterior: ant.fila(p.id), previsto: pres?.lineas?.[p.id] || null }));
  const sin = { ingresos: r2(act.del.filter(m => !m.partida && m.importe > 0).reduce((x, m) => x + m.importe, 0)), gastos: r2(act.del.filter(m => !m.partida && m.importe < 0).reduce((x, m) => x - m.importe, 0)) };
  const tot = (lista, k) => r2(lista.reduce((x, f) => x + f[k], 0));
  const ingresos = r2(tot(filas, 'ingresos') + sin.ingresos), gastos = r2(tot(filas, 'gastos') + sin.gastos);
  const banco = saldosBanco(a);
  const netoBanco = r2(act.del.filter(m => m.origen === 'banco').reduce((x, m) => x + m.importe, 0));
  const efectivo = act.del.filter(m => m.origen !== 'banco');
  const cuotas = cuotasAnio(a);
  return {
    anio: a, filas: filas.filter(f => f.ingresos || f.gastos || f.anterior.ingresos || f.anterior.gastos || f.previsto), sinClasificar: sin,
    presupuesto: pres ? { aprobado: pres.aprobado, ingresos: r2(Object.values(pres.lineas).reduce((x, l) => x + l.ingresos, 0)), gastos: r2(Object.values(pres.lineas).reduce((x, l) => x + l.gastos, 0)) } : null,
    ingresos, gastos, resultado: r2(ingresos - gastos),
    anterior: { ingresos: r2(ant.del.filter(m => m.importe > 0).reduce((x, m) => x + m.importe, 0)), gastos: r2(ant.del.filter(m => m.importe < 0).reduce((x, m) => x - m.importe, 0)), n: ant.del.length },
    banco: { ...banco, neto: netoBanco, cuadra: banco.inicial === null || banco.final === null ? null : Math.abs(r2(banco.inicial + netoBanco) - banco.final) < 0.005 },
    efectivo: { n: efectivo.length, neto: r2(efectivo.reduce((x, m) => x + m.importe, 0)) },
    cuotas: { socios: cuotas.filas.length - cuotas.cuenta.exento, pagadas: cuotas.cuenta.pagado, pendientes: cuotas.cuenta.pendiente + cuotas.cuenta.parcial, recaudado: cuotas.recaudado, pendiente: cuotas.pendiente },
    huecos: comprobarSaldos().filter(x => x.hasta.fecha.startsWith(String(a)) || x.desde.fecha.startsWith(String(a))),
    cuenta: configuracion().cuenta
  };
}

// ===========================================================================
// Fase 5: SEPA (adeudos directos): acreedor, mandatos y remesas
// ===========================================================================
// Un abono de remesa del banco se reparte entre los socios de la remesa, para que
// cada uno cuente como pagado (las devoluciones se anotan al socio en negativo)
export function pagosDeCuotas() {
  const lista = [];
  for (const m of t.movimientos) {
    const r = m.remesa_id ? t.remesas.find(x => x.id === m.remesa_id) : null;
    if (!r) { lista.push(m); continue; }
    for (const d of r.detalle) lista.push({ ...m, id: `${m.id}:${d.socio_id}`, socio_id: d.socio_id, importe: d.importe, concepto: `Remesa SEPA ${dma(r.fecha_cobro)}`, remesa: true });
  }
  return lista;
}

export function acreedor() {
  const c = configuracion();
  const a = { nif: CONFIG.club.nif, sufijo: '000', nombre: CONFIG.club.nombre, direccion: '', poblacion: '', bic: '', ...(c.acreedor || {}) };
  if (!a.direccion && !a.poblacion && CONFIG.club.domicilio) {
    const m = CONFIG.club.domicilio.match(/^(.*?),\s*(\d{5}\s.*)$/);
    if (m) { a.direccion = m[1]; a.poblacion = m[2]; }
  }
  let id = null;
  try { id = sepa.idAcreedor(a.nif, a.sufijo); } catch { id = null; }
  return { ...a, id, cuenta: c.cuenta };
}
export async function guardarAcreedor(a) {
  exigirAbierta();
  const datos = { nif: String(a.nif || '').replace(/[\s-]/g, '').toUpperCase(), sufijo: String(a.sufijo || '000').toUpperCase(), nombre: String(a.nombre || '').trim(),
    direccion: String(a.direccion || '').trim(), poblacion: String(a.poblacion || '').trim(), bic: String(a.bic || '').replace(/\s+/g, '').toUpperCase() };
  sepa.idAcreedor(datos.nif, datos.sufijo); // valida
  if (!datos.nombre) throw new Error('Escribe el nombre del acreedor (el Club).');
  if (datos.bic && !sepa.bicValido(datos.bic)) throw new Error('El BIC del Club no es válido.');
  await guardarConfiguracion({ acreedor: datos });
}

// Mandato completo: IBAN válido, referencia y fecha de firma
export function estadoMandato(s) {
  if (!s.iban || !ibanValido(s.iban)) return { ok: false, falta: 'IBAN' };
  if (!s.mandato_ref) return { ok: false, falta: 'orden de domiciliación' };
  if (!s.mandato_fecha) return { ok: false, falta: 'fecha de firma' };
  return { ok: true };
}
export function referenciaMandato(s) {
  const base = `CGA-${String(s.numero || '').replace(/\W/g, '') || String(s.id).slice(0, 8).toUpperCase()}`;
  let ref = base, n = 2;
  while (t.socios.some(x => x.id !== s.id && x.mandato_ref === ref)) ref = `${base}-${n++}`;
  return ref;
}
// Prepara la orden de domiciliación para firmar: le pone referencia si no tiene
export async function prepararMandato(socioId) {
  exigirAbierta();
  const s = t.socios.find(x => x.id === socioId);
  if (!s) throw new Error('Socio no encontrado.');
  if (!s.mandato_ref) await guardarSocio({ ...s, mandato_ref: referenciaMandato(s) });
  return { socio: t.socios.find(x => x.id === socioId), acreedor: acreedor() };
}

// Fecha de cobro: al menos el siguiente día hábil (plazo D-1 de los adeudos SEPA Core)
export function fechaCobroMinima(dia = new Date()) {
  const d = new Date(dia); d.setHours(12, 0, 0, 0);
  do { d.setDate(d.getDate() + 1); } while (d.getDay() === 0 || d.getDay() === 6);
  return d.toISOString().slice(0, 10);
}

// Socios a los que se puede cobrar la cuota del año por remesa
export function candidatosRemesa(anio) {
  const c = cuotasAnio(anio);
  return c.filas.filter(f => (f.estado === 'pendiente' || f.estado === 'parcial')).map(f => ({ ...f, mandato: estadoMandato(f.socio) }));
}

export async function generarRemesa({ anio, fechaCobro, socioIds, concepto }) {
  exigirAbierta();
  const a = acreedor();
  if (!a.id) throw new Error('Falta el identificador de acreedor del Club (pestaña SEPA).');
  if (!a.cuenta) throw new Error('Falta la cuenta del Club: importa antes un Excel del banco.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(fechaCobro || '')) || fechaCobro < fechaCobroMinima()) throw new Error(`La fecha de cobro debe ser como pronto el ${dma(fechaCobroMinima())} (día hábil siguiente).`);
  const cand = candidatosRemesa(anio).filter(f => socioIds.includes(f.socio.id));
  const sinMandato = cand.filter(f => !f.mandato.ok);
  if (sinMandato.length) throw new Error(`Sin mandato completo: ${sinMandato.map(f => `${nombreCompleto(f.socio)} (falta ${f.mandato.falta})`).join(', ')}.`);
  if (!cand.length) throw new Error('Elige al menos un socio con la cuota pendiente.');
  const ahora = new Date();
  const msgId = `CGA-${String(ahora.getFullYear())}${String(ahora.getMonth() + 1).padStart(2, '0')}${String(ahora.getDate()).padStart(2, '0')}-${String(ahora.getTime()).slice(-6)}`;
  const texto = String(concepto || `Cuota ${anio} ${CONFIG.club.nombre}`).trim();
  const cobros = cand.map(f => ({ endToEnd: `${msgId.slice(4)}-${String(f.socio.numero || f.socio.id.slice(0, 4))}`.slice(0, 35), importe: f.falta, mandato: f.socio.mandato_ref,
    fechaFirma: f.socio.mandato_fecha, secuencia: 'RCUR' /* cuota anual: pago recurrente (desde 2016 no hace falta FRST) */, nombre: nombreCompleto(f.socio), iban: f.socio.iban, bic: f.socio.bic, concepto: texto }));
  const xml = sepa.remesaXml({ msgId, creado: ahora, fechaCobro, acreedor: { id: a.id, nombre: a.nombre, iban: a.cuenta, bic: a.bic, direccion: a.direccion, poblacion: a.poblacion }, cobros });
  const total = Math.round(cobros.reduce((x, c) => x + c.importe, 0) * 100) / 100;
  const id = await guardarRegistro('remesa', { msg_id: msgId, anio: Number(anio), fecha_cobro: fechaCobro, concepto: texto, total,
    detalle: cand.map(f => ({ socio_id: f.socio.id, importe: f.falta, mandato: f.socio.mandato_ref })) });
  await recargar();
  return { xml, nombre: `remesa_${msgId}.xml`, total, n: cobros.length, id };
}
export const remesas = () => { exigirAbierta(); return [...t.remesas].sort((a, b) => b.fecha_cobro.localeCompare(a.fecha_cobro)); };
export const abonoDeRemesa = (id) => t.movimientos.find(m => m.remesa_id === id) || null;
export async function borrarRemesa(id) {
  exigirAbierta();
  if (abonoDeRemesa(id)) throw new Error('Esta remesa ya está cobrada en el banco: no se puede borrar.');
  await borrarRegistro(id); await recargar();
}
function remesaDelAbono(m) {
  const dias = (a, b) => Math.abs((Date.parse(`${a}T12:00:00Z`) - Date.parse(`${b}T12:00:00Z`)) / 86400000);
  return t.remesas.find(r => !t.movimientos.some(x => x.remesa_id === r.id && x.id !== m.id) && Math.abs(r.total - m.importe) < 0.005 && dias(r.fecha_cobro, m.fecha) <= 10) || null;
}

// ===========================================================================
// Presupuesto anual por partidas (lo aprueba la asamblea) y su ejecución
// ===========================================================================
export const presupuesto = (anio) => t.presupuestos.find(p => Number(p.anio) === Number(anio)) || null;
export const aniosPresupuesto = () => {
  const y = new Date().getFullYear();
  return [...new Set([y + 1, y, ...t.presupuestos.map(p => Number(p.anio)), ...aniosMovimientos()])].sort((a, b) => b - a);
};

const real = (anio) => {
  const del = t.movimientos.filter(m => m.fecha.startsWith(String(anio)));
  return (id) => { const ms = del.filter(m => m.partida === id);
    return { ingresos: r2(ms.filter(m => m.importe > 0).reduce((x, m) => x + m.importe, 0)), gastos: r2(ms.filter(m => m.importe < 0).reduce((x, m) => x - m.importe, 0)) }; };
};

// lineas: { [partidaId]: { ingresos, gastos } }
export async function guardarPresupuesto(anio, { lineas, aprobado = null, notas = '' }) {
  exigirAbierta();
  const a = Number(anio);
  if (!Number.isInteger(a) || a < 2000 || a > 2100) throw new Error('Año no válido.');
  if (aprobado && !/^\d{4}-\d{2}-\d{2}$/.test(aprobado)) throw new Error('La fecha de aprobación no es válida.');
  const limpio = {};
  for (const [id, l] of Object.entries(lineas || {})) {
    if (!t.partidas.some(p => p.id === id)) continue;
    const n = (v) => { if (v === '' || v === null || v === undefined) return 0; const txt = String(v).trim(); const x = Number(txt.includes(',') ? txt.replace(/\./g, '').replace(',', '.') : txt); if (!Number.isFinite(x) || x < 0) throw new Error('Los importes del presupuesto deben ser cantidades positivas.'); return r2(x); };
    const fila = { ingresos: n(l.ingresos), gastos: n(l.gastos) };
    if (fila.ingresos || fila.gastos) limpio[id] = fila;
  }
  const previo = presupuesto(a);
  await guardarRegistro('presupuesto', { anio: a, lineas: limpio, aprobado: aprobado || null, notas: String(notas || '').trim() || null, id: previo?.id });
  await recargar();
}
export async function borrarPresupuesto(anio) {
  exigirAbierta();
  const p = presupuesto(anio);
  if (p) { await borrarRegistro(p.id); await recargar(); }
}
// Propuesta: lo que se movió de verdad el año anterior en cada partida
export function propuestaPresupuesto(anio) {
  exigirAbierta();
  const r = real(Number(anio) - 1);
  return Object.fromEntries(t.partidas.map(p => [p.id, r(p.id)]).filter(([, f]) => f.ingresos || f.gastos));
}

export function ejecucion(anio) {
  exigirAbierta();
  const p = presupuesto(anio), r = real(anio), ant = real(Number(anio) - 1);
  const filas = partidas().map(partida => {
    const pr = p?.lineas?.[partida.id] || { ingresos: 0, gastos: 0 };
    return { partida, previsto: pr, real: r(partida.id), anterior: ant(partida.id) };
  });
  const suma = (k, c) => r2(filas.reduce((x, f) => x + f[k][c], 0));
  const tot = { previsto: { ingresos: suma('previsto', 'ingresos'), gastos: suma('previsto', 'gastos') }, real: { ingresos: suma('real', 'ingresos'), gastos: suma('real', 'gastos') } };
  const hoy = hoyISO(), y = Number(anio);
  const transcurrido = y < Number(hoy.slice(0, 4)) ? 1 : y > Number(hoy.slice(0, 4)) ? 0 : (Date.parse(`${hoy}T12:00:00Z`) - Date.UTC(y, 0, 1)) / (Date.UTC(y + 1, 0, 1) - Date.UTC(y, 0, 1));
  return { anio: y, presupuesto: p, filas, total: tot, transcurrido };
}
