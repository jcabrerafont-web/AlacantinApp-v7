// ============================================================================
// Estado de la aplicación y operaciones de negocio (Libro Genealógico).
// Las vistas leen `estado` y llaman a estas funciones; nunca tocan IndexedDB
// ni Supabase directamente.
// ============================================================================
import * as db from './db.js';
import * as sync from './sync.js';
import { ESTANDAR, REGLAS, variedadPorId, evaluarConformidad, huevoApto, edadMeses } from './estandar.js';
import { indice, fxAnimal, creaCiclo } from './genetica.js';
import { esAuditor } from './auth.js';
import { uuid } from './ui.js';

export const estado = {
  perfil: null,         // null = visitante
  todos: [],            // todos los animales conocidos (base del pedigrí)
  idx: new Map(),
  calificaciones: [],
  huevos: [],
  perfiles: [],
  pendientes: 0,
  online: navigator.onLine
};

const oyentes = new Set();
export const suscribir = (fn) => { oyentes.add(fn); return () => oyentes.delete(fn); };
export const notificar = () => oyentes.forEach(fn => { try { fn(estado); } catch (e) { console.error(e); } });

export const rol = () => estado.perfil?.rol || 'visitante';
export const esVisitante = () => !estado.perfil;

// Campos que nunca se muestran en el censo público
const PRIVADOS = ['usuario_id', 'rega', 'latitud', 'longitud', 'notas', 'baja_causa'];
export const versionPublica = (a) => Object.fromEntries(Object.entries(a).filter(([k]) => !PRIVADOS.includes(k)));

export async function cargar() {
  const [animales, calificaciones, huevos, perfiles] = await Promise.all(
    ['animales', 'calificaciones', 'huevos', 'perfiles'].map(s => db.todos(s)));
  estado.todos = animales;
  estado.idx = indice(animales);
  const p = estado.perfil;
  if (!p) {
    estado.calificaciones = [];
    estado.huevos = [];
    estado.perfiles = [];
  } else if (esAuditor(p.rol)) {
    estado.calificaciones = calificaciones;
    estado.huevos = huevos;
    estado.perfiles = perfiles;
  } else {
    const mios = new Set(animales.filter(a => a.usuario_id === p.id).map(a => a.id));
    estado.calificaciones = calificaciones.filter(c => mios.has(c.animal_id));
    estado.huevos = huevos.filter(h => mios.has(h.animal_id));
    estado.perfiles = perfiles.filter(x => x.id === p.id);
  }
  estado.pendientes = await sync.pendientes();
  notificar();
}

/** Animales visibles en "Mi censo" (o en el censo público para visitantes). */
export function censo({ incluirBajas = false, todos = false } = {}) {
  const p = estado.perfil;
  let lista = estado.todos;
  if (!p) lista = lista.map(versionPublica);                       // visitante: censo público
  else if (esAuditor(p.rol)) lista = [...lista];                      // inspector/administrador: todo
  else lista = todos ? lista.map(versionPublica) : lista.filter(a => a.usuario_id === p.id); // criador
  if (!incluirBajas) lista = lista.filter(a => a.estado !== 'baja');
  return lista.sort((a, b) => String(a.anilla).localeCompare(String(b.anilla), 'es', { numeric: true }));
}

export const animal = (id) => estado.idx.get(id) || null;
export const puedeEditar = (a) => Boolean(estado.perfil && a && (a.usuario_id === estado.perfil.id || rol() === 'administrador'));
export const fx = (a) => fxAnimal(a, estado.idx);

// ---------------------------------------------------------------------------
// Validación y alta/edición de ejemplares
// ---------------------------------------------------------------------------
export function validarAnimal(a, { esNuevo }) {
  const errores = [];
  const anilla = String(a.anilla || '').trim().toUpperCase();
  if (!anilla) errores.push('La anilla es obligatoria.');
  if (!['M', 'H'].includes(a.sexo)) errores.push('Indica el sexo.');
  if (!variedadPorId(a.variedad)) errores.push('Elige una variedad.');
  if (!a.fecha_nacimiento) errores.push('La fecha de nacimiento es obligatoria.');
  else if (a.fecha_nacimiento > new Date().toISOString().slice(0, 10)) errores.push('La fecha de nacimiento no puede ser futura.');
  if (!ESTANDAR.secciones[a.seccion]) errores.push('Sección del libro no válida.');
  if (a.seccion === 'RD' && esNuevo) errores.push('El Registro Definitivo solo se alcanza tras una calificación Apto.');
  if (a.seccion === 'RD' && !variedadPorId(a.variedad)?.oficial) errores.push('Las variedades en proceso de reconocimiento no acceden al Registro Definitivo.');
  const dup = estado.todos.find(x => x.id !== a.id && String(x.anilla).toUpperCase() === anilla && x.estado !== 'baja');
  if (dup) errores.push(`La anilla ${anilla} ya está registrada.`);
  if (a.rfid && !/^\d{15}$/.test(a.rfid)) errores.push('El chip RFID debe tener 15 dígitos (ISO 11784/85).');
  if (a.rfid && estado.todos.some(x => x.id !== a.id && x.rfid === a.rfid && x.estado !== 'baja')) errores.push('Ese chip RFID ya está asignado a otro ejemplar.');
  const padre = a.padre_id ? estado.idx.get(a.padre_id) : null;
  const madre = a.madre_id ? estado.idx.get(a.madre_id) : null;
  if (a.padre_id && (!padre || padre.sexo !== 'M')) errores.push('El padre debe ser un gallo registrado.');
  if (a.madre_id && (!madre || madre.sexo !== 'H')) errores.push('La madre debe ser una gallina registrada.');
  for (const [p, rolP] of [[padre, 'padre'], [madre, 'madre']]) {
    if (p?.fecha_nacimiento && a.fecha_nacimiento && p.fecha_nacimiento >= a.fecha_nacimiento) {
      errores.push(`La fecha de nacimiento del ${rolP} debe ser anterior a la del ejemplar.`);
    }
  }
  if (a.id && creaCiclo(a.id, a.padre_id, a.madre_id, estado.idx)) errores.push('La genealogía crearía un ciclo (un ejemplar sería ancestro de sí mismo).');
  const g = Number(a.peso_g);
  if (a.peso_g !== null && a.peso_g !== '' && a.peso_g !== undefined && (!Number.isFinite(g) || g < 30 || g > 6000)) {
    errores.push('Peso fuera de un rango físico plausible (30–6000 g).');
  }
  return errores;
}

export async function guardarAnimal(datos) {
  const p = estado.perfil;
  if (!p) throw new Error('Inicia sesión para registrar ejemplares.');
  const previo = datos.id ? estado.idx.get(datos.id) : null;
  if (previo && !puedeEditar(previo)) throw new Error('Solo el titular puede modificar este ejemplar.');
  const ahora = new Date().toISOString();
  const a = {
    ...(previo || {}),
    ...datos,
    id: previo?.id || uuid(),
    anilla: String(datos.anilla).trim().toUpperCase(),
    peso_g: datos.peso_g === '' || datos.peso_g === null || datos.peso_g === undefined ? null : Math.round(Number(datos.peso_g)),
    padre_id: datos.padre_id || null,
    madre_id: datos.madre_id || null,
    usuario_id: previo?.usuario_id || p.id,
    estado: previo?.estado || 'activo',
    created_at: previo?.created_at || ahora,
    updated_at: ahora
  };
  // Herencia transparente del aviario del titular (REGA, ubicación)
  if (!previo) {
    a.rega = p.rega || null;
    a.municipio = p.municipio || null;
    a.provincia = p.provincia || null;
    a.latitud = p.latitud ?? null;
    a.longitud = p.longitud ?? null;
    a.seccion = a.seccion || 'RN';
  } else {
    a.seccion = previo.seccion; // la sección cambia solo por calificación
  }
  const errores = validarAnimal(a, { esNuevo: !previo });
  if (errores.length) throw new Error(errores.join('\n'));
  await db.guardar('animales', a);
  await sync.encolar('animales', 'upsert', a);
  await cargar();
  return a;
}

export async function darDeBaja(id, causa, fechaBaja) {
  const a = estado.idx.get(id);
  if (!puedeEditar(a)) throw new Error('Solo el titular puede dar de baja este ejemplar.');
  const nuevo = { ...a, estado: 'baja', baja_causa: causa, baja_fecha: fechaBaja, updated_at: new Date().toISOString() };
  await db.guardar('animales', nuevo);
  await sync.encolar('animales', 'upsert', nuevo);
  await cargar();
}

// ---------------------------------------------------------------------------
// Puesta: pesaje individual de cada huevo
// ---------------------------------------------------------------------------
export async function registrarHuevos(animalId, fecha, pesos, cascara) {
  const a = estado.idx.get(animalId);
  if (!puedeEditar(a)) throw new Error('Solo el titular puede registrar la puesta de esta gallina.');
  if (a.sexo !== 'H') throw new Error('El control de puesta es solo para gallinas.');
  if (a.fecha_nacimiento && fecha < a.fecha_nacimiento) throw new Error('La fecha de puesta es anterior al nacimiento.');
  const lista = pesos.map(Number).filter(g => Number.isFinite(g) && g > 0);
  if (!lista.length) throw new Error('Introduce al menos un peso.');
  if (lista.some(g => g < 20 || g > 120)) throw new Error('Hay pesos fuera de un rango físico plausible (20–120 g). Revisa la báscula.');
  const registros = lista.map(g => ({
    id: uuid(), animal_id: animalId, usuario_id: a.usuario_id, fecha, peso_g: Math.round(g * 10) / 10,
    cascara, apto: huevoApto(g, cascara), created_at: new Date().toISOString()
  }));
  for (const r of registros) {
    await db.guardar('huevos', r);
    await sync.encolar('huevos', 'upsert', r);
  }
  await cargar();
  return registros;
}

export async function borrarHuevo(id) {
  const h = estado.huevos.find(x => x.id === id);
  if (!h || !puedeEditar(estado.idx.get(h.animal_id))) throw new Error('No autorizado.');
  await db.borrar('huevos', id);
  await sync.encolar('huevos', 'delete', { id });
  await cargar();
}

export function resumenPuesta(animalId, desde = null, hasta = null) {
  const lista = estado.huevos.filter(h => (!animalId || h.animal_id === animalId) &&
    (!desde || h.fecha >= desde) && (!hasta || h.fecha <= hasta));
  const n = lista.length;
  const pesos = lista.map(h => h.peso_g);
  const media = n ? pesos.reduce((s, x) => s + x, 0) / n : null;
  const aptos = lista.filter(h => h.apto).length;
  const dias = new Set(lista.map(h => h.fecha)).size;
  return { n, aptos, media, min: n ? Math.min(...pesos) : null, max: n ? Math.max(...pesos) : null, dias, lista };
}

// ---------------------------------------------------------------------------
// Calificación (ficha de conformidad con el Estándar) — solo inspectores
// ---------------------------------------------------------------------------
export async function guardarCalificacion({ animalId, regiones, defectos, pesoG, resultado, observaciones, posicion }) {
  const p = estado.perfil;
  if (!esAuditor(p?.rol)) throw new Error('La calificación oficial corresponde a un inspector acreditado.');
  const a = estado.idx.get(animalId);
  if (!a) throw new Error('Ejemplar no encontrado.');
  const ev = evaluarConformidad({ sexo: a.sexo, variedad: a.variedad, pesoG, regiones, defectos });
  if (!ev.completa) throw new Error('Evalúa las 12 regiones antes de cerrar la ficha.');
  if (ev.defectosGraves.length && resultado === 'Apto') throw new Error('Con un defecto grave el resultado no puede ser Apto.');
  if (resultado === 'No apto' && ev.defectosGraves.length === 0 && !String(observaciones || '').trim()) {
    throw new Error('Justifica en observaciones el resultado No apto sin defectos graves.');
  }
  const c = {
    id: uuid(), animal_id: a.id, inspector_id: p.id, inspector_nombre: p.nombre || p.email,
    fecha: new Date().toISOString().slice(0, 10), regiones, defectos: ev.defectosGraves,
    peso_g: pesoG ? Math.round(Number(pesoG)) : null, peso_conforme: ev.pesoConforme,
    resultado, observaciones: observaciones || '',
    latitud: posicion?.latitud ?? null, longitud: posicion?.longitud ?? null,
    created_at: new Date().toISOString()
  };
  await db.guardar('calificaciones', c);
  await sync.encolar('calificaciones', 'upsert', c);
  // Promoción RN -> RD (la confirma también el trigger del servidor)
  const meses = edadMeses(a.fecha_nacimiento);
  if (resultado === 'Apto' && ev.accedeRD && a.seccion === 'RN' && meses !== null &&
      meses * 30.44 >= REGLAS.edadMinimaRD_dias) {
    const promovido = { ...a, seccion: 'RD', updated_at: new Date().toISOString() };
    await db.guardar('animales', promovido);
  }
  await cargar();
  return c;
}

export const calificacionesDe = (animalId) =>
  estado.calificaciones.filter(c => c.animal_id === animalId).sort((x, y) => y.created_at.localeCompare(x.created_at));

// ---------------------------------------------------------------------------
// Perfil y administración
// ---------------------------------------------------------------------------
export async function guardarPerfilServidor(paraServidor) {
  await sync.encolar('perfiles', 'upsert', paraServidor);
}

export async function cambiarRol(perfilId, nuevoRol) {
  if (rol() !== 'administrador') throw new Error('Solo un administrador puede cambiar roles.');
  const p = estado.perfiles.find(x => x.id === perfilId);
  if (!p) throw new Error('Usuario no encontrado.');
  const nuevo = { ...p, rol: nuevoRol, updated_at: new Date().toISOString() };
  await db.guardar('perfiles', nuevo);
  await sync.encolar('perfiles', 'upsert', { id: p.id, rol: nuevoRol, updated_at: nuevo.updated_at });
  await cargar();
}
