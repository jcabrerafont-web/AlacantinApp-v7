// ============================================================================
// Estado de la aplicación y operaciones de negocio (Libro Genealógico).
// Las vistas leen `estado` y llaman a estas funciones; nunca tocan IndexedDB
// ni Supabase directamente.
// ============================================================================
import * as db from './db.js';
import * as sync from './sync.js';
import { ESTANDAR, REGLAS, BAREMO, puntoValido, variedadPorId, evaluarCalificacion, huevoApto, edadMeses, normalizarAnilla, comprobarAnilla } from './estandar.js';
import { indice, fxAnimal, creaCiclo } from './genetica.js';
import { esAuditor } from './auth.js';
import { uuid } from './ui.js';

export const estado = {
  perfil: null,         // null = visitante
  todos: [],            // todos los animales conocidos (base del pedigrí)
  idx: new Map(),
  calificaciones: [],
  huevos: [],
  campanas: [],
  lotes: [],
  incubaciones: [],
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
  const [animales, calificaciones, huevos, perfiles, campanas, lotes, incubaciones] = await Promise.all(
    ['animales', 'calificaciones', 'huevos', 'perfiles', 'campanas', 'lotes', 'incubaciones'].map(s => db.todos(s)));
  estado.todos = animales;
  estado.idx = indice(animales);
  const p = estado.perfil;
  if (!p) {
    estado.calificaciones = [];
    estado.huevos = [];
    estado.perfiles = [];
    estado.campanas = [];
    estado.lotes = [];
    estado.incubaciones = [];
  } else if (esAuditor(p.rol)) {
    estado.calificaciones = calificaciones;
    estado.huevos = huevos;
    estado.perfiles = perfiles;
    estado.campanas = campanas;
    estado.lotes = lotes;
    estado.incubaciones = incubaciones;
  } else {
    const mios = new Set(animales.filter(a => a.usuario_id === p.id).map(a => a.id));
    estado.calificaciones = calificaciones.filter(c => mios.has(c.animal_id));
    estado.huevos = huevos.filter(h => mios.has(h.animal_id));
    estado.perfiles = perfiles.filter(x => x.id === p.id);
    estado.campanas = campanas.filter(c => c.usuario_id === p.id);
    estado.lotes = lotes.filter(l => l.usuario_id === p.id);
    estado.incubaciones = incubaciones.filter(i => i.usuario_id === p.id);
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
  const anilla = normalizarAnilla(a.anilla);
  if (!anilla) errores.push('La anilla es obligatoria.');
  else errores.push(...comprobarAnilla(anilla, { sexo: a.sexo, fechaNacimiento: a.fecha_nacimiento }).errores);
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
    anilla: normalizarAnilla(datos.anilla),
    peso_g: datos.peso_g === '' || datos.peso_g === null || datos.peso_g === undefined ? null : Math.round(Number(datos.peso_g)),
    padre_id: datos.padre_id || null,
    madre_id: datos.madre_id || null,
    usuario_id: previo?.usuario_id || p.id,
    criador_id: previo ? (previo.criador_id ?? previo.usuario_id) : p.id, // criador de origen: no cambia
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

// Cambio de titular (venta o cesión a otro socio): el animal sigue en el Libro con
// el nuevo propietario; el criador de origen se conserva. Solo la administración.
export async function cambiarTitular(animalId, perfilId) {
  if (rol() !== 'administrador') throw new Error('El cambio de titular lo registra la administración del Libro.');
  const a = estado.idx.get(animalId);
  const nuevo = estado.perfiles.find(x => x.id === perfilId);
  if (!a || !nuevo) throw new Error('Ejemplar o socio no encontrado.');
  if (a.usuario_id === perfilId) throw new Error('Ya es el titular.');
  const r = { ...a, criador_id: a.criador_id ?? a.usuario_id, usuario_id: perfilId,
    rega: nuevo.rega || null, municipio: nuevo.municipio || null, provincia: nuevo.provincia || null,
    latitud: nuevo.latitud ?? null, longitud: nuevo.longitud ?? null, updated_at: new Date().toISOString() };
  await db.guardar('animales', r);
  await sync.encolar('animales', 'upsert', r);
  await cargar();
  return r;
}

// Requisitos para pasar del RN al Registro Definitivo, uno a uno, para guiar al criador.
// (Castellana Negra A.6 y Reg. UE 2016/1012 anexo II por analogía: filiación establecida
//  con padres inscritos en el Libro; explotación registrada.)
export const SECCIONES_LIBRO = ['RF', 'RA', 'RD', 'RM'];
export function requisitosRD(a) {
  const padre = estado.idx.get(a.padre_id), madre = estado.idx.get(a.madre_id);
  const meses = edadMeses(a.fecha_nacimiento);
  const califs = calificacionesDe(a.id);
  const apto = califs.find(c => c.resultado === 'Apto');
  const v = variedadPorId(a.variedad);
  const lista = [
    { ok: Boolean(v?.oficial), texto: v?.oficial ? `Variedad oficial (${v.nombre})` : 'Variedad oficial (la suya está en proceso de reconocimiento)' },
    { ok: Boolean(padre && SECCIONES_LIBRO.includes(padre.seccion)), texto: padre ? `Padre inscrito en el Libro (${padre.anilla} · ${padre.seccion})` : 'Padre registrado e inscrito en el Libro' },
    { ok: Boolean(madre && SECCIONES_LIBRO.includes(madre.seccion)), texto: madre ? `Madre inscrita en el Libro (${madre.anilla} · ${madre.seccion})` : 'Madre registrada e inscrita en el Libro' },
    { ok: Boolean(a.rega), texto: a.rega ? `Explotación registrada (REGA ${a.rega})` : 'Explotación con REGA (complétalo en Mi aviario)' },
    { ok: meses !== null && meses >= REGLAS.edadMinimaRD_meses, texto: `Un año de edad${meses !== null && meses < REGLAS.edadMinimaRD_meses ? ` (tiene ${meses} meses)` : ''}` },
    { ok: Boolean(apto), texto: apto ? `Calificación Apto (${String(apto.total).replace('.', ',')} puntos)` : `Calificación Apto: ${REGLAS.puntosMinimosApto[a.sexo] ?? 65} puntos o más y sin defectos descalificantes` }
  ];
  return { lista, cumple: lista.every(x => x.ok) };
}

// Inscripción directa en el Registro Fundacional (fundadores de la raza, Reg. UE 2016/1012
// art. 19 por analogía) o en el Auxiliar (buena morfología sin genealogía completa).
// La decide la Dirección Técnica (inspector o administración).
export async function inscribirSeccionBase(animalId, seccion, motivo) {
  if (!esAuditor(rol())) throw new Error('Esta inscripción la decide la Dirección Técnica del Libro.');
  if (!['RF', 'RA'].includes(seccion)) throw new Error('Sección no válida.');
  const a = estado.idx.get(animalId);
  if (!a || a.seccion !== 'RN') throw new Error('Solo se inscriben en RF o RA ejemplares que están en el RN.');
  if (!String(motivo || '').trim()) throw new Error('Indica el motivo (p. ej. «fundador de la raza, aviario X»).');
  const ahora = new Date().toISOString();
  const r = { ...a, seccion, notas: [a.notas, `${ahora.slice(0, 10)} · ${seccion}: ${String(motivo).trim()}`].filter(Boolean).join('\n'), updated_at: ahora };
  await db.guardar('animales', r);
  await sync.encolar('animales', 'upsert', r);
  await cargar();
  return r;
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
// Campañas de control de puesta (15 días, 3 ciclos por temporada)
// ---------------------------------------------------------------------------
const masDias = (iso, n) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
export const finCampana = (c) => masDias(c.inicio, c.dias - 1);
export const diaCampana = (c, hoy = new Date().toISOString().slice(0, 10)) =>
  hoy < c.inicio ? 0 : Math.min(c.dias, Math.round((Date.parse(`${hoy}T12:00:00Z`) - Date.parse(`${c.inicio}T12:00:00Z`)) / 86400000) + 1);
export const estadoCampana = (c, hoy = new Date().toISOString().slice(0, 10)) =>
  hoy < c.inicio ? 'programada' : hoy > finCampana(c) ? 'terminada' : 'en curso';
export const misCampanas = () => [...estado.campanas].sort((a, b) => b.inicio.localeCompare(a.inicio));
export const campanaEnCurso = () => misCampanas().find(c => estadoCampana(c) === 'en curso') || null;

export async function crearCampana({ ciclo, inicio, dias = REGLAS.controlPuesta.dias, metodo, gallinas, notas }) {
  const p = estado.perfil;
  if (!p) throw new Error('Inicia sesión para organizar campañas.');
  const temporada = Number(String(inicio).slice(0, 4));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(inicio || ''))) throw new Error('Indica la fecha de inicio.');
  if (![1, 2, 3].includes(Number(ciclo))) throw new Error('El ciclo debe ser 1, 2 o 3.');
  const d = Number(dias);
  if (!Number.isInteger(d) || d < 7 || d > 30) throw new Error('La campaña debe durar entre 7 y 30 días (el protocolo recomienda 15).');
  const lista = [...new Set(gallinas || [])].filter(id => { const a = estado.idx.get(id); return a && a.sexo === 'H' && a.usuario_id === p.id && a.estado !== 'baja'; });
  if (!lista.length) throw new Error('Elige al menos una gallina.');
  if (estado.campanas.some(c => c.usuario_id === p.id && c.temporada === temporada && c.ciclo === Number(ciclo))) {
    throw new Error(`Ya tienes el ciclo ${ciclo} de ${temporada}.`);
  }
  const nueva = { inicio, dias: d };
  const solapa = estado.campanas.find(c => c.usuario_id === p.id && !(finCampana(nueva) < c.inicio || inicio > finCampana(c)));
  if (solapa) throw new Error(`Se solapa con el ciclo ${solapa.ciclo} de ${solapa.temporada}.`);
  const ahora = new Date().toISOString();
  const c = { id: uuid(), usuario_id: p.id, temporada, ciclo: Number(ciclo), inicio, dias: d,
    metodo: metodo || 'jaula', gallinas: lista, notas: notas || '', created_at: ahora, updated_at: ahora };
  await db.guardar('campanas', c);
  await sync.encolar('campanas', 'upsert', c);
  await cargar();
  return c;
}

export async function borrarCampana(id) {
  const c = estado.campanas.find(x => x.id === id);
  if (!c || c.usuario_id !== estado.perfil?.id) throw new Error('No autorizado.');
  await db.borrar('campanas', id);
  await sync.encolar('campanas', 'delete', { id });
  await cargar();
}

// Tres criterios en paralelo (ver REGLAS.controlPuesta):
//  - puesta: % de días controlados con huevo (cantidad)
//  - peso:   peso medio del huevo, solo con un mínimo de huevos (tamaño)
//  - masa:   gramos de huevo al día = puesta × peso medio (equilibra los dos;
//            criterio por defecto para proponer la madre del gallo de reposición)
const CRITERIOS = {
  puesta: f => f.puesta,
  peso: f => (f.n >= REGLAS.controlPuesta.minHuevosPeso ? f.media || 0 : -1),
  masa: f => f.masa
};
function destacar(filas) {
  const lider = (lista, k) => {
    const v = CRITERIOS[k];
    const cand = lista.filter(f => f.n > 0 && v(f) > 0).sort((x, y) => v(y) - v(x) || y.n - x.n);
    return cand[0]?.id || null;
  };
  const general = Object.fromEntries(Object.keys(CRITERIOS).map(k => [k, lider(filas, k)]));
  const familias = [...new Set(filas.map(f => f.a.familia).filter(Boolean))];
  const porFamilia = Object.fromEntries(familias.map(fam => {
    const del = filas.filter(f => f.a.familia === fam);
    return [fam, Object.fromEntries(Object.keys(CRITERIOS).map(k => [k, lider(del, k)]))];
  }));
  const criterio = REGLAS.controlPuesta.criterioMadre;
  filas.forEach(f => {
    const fam = f.a.familia ? porFamilia[f.a.familia] : null;
    f.destaca = { puesta: general.puesta === f.id, peso: general.peso === f.id, masa: general.masa === f.id };
    f.madreFamilia = Boolean(fam && fam[criterio] === f.id);
  });
  return { general, porFamilia, criterio };
}
const conIndicadores = (f, dias, inicio) => {
  const puesta = dias ? Math.min(1, f.diasConHuevo / dias) : 0;
  const media = f.pesos.length ? f.pesos.reduce((s, g) => s + g, 0) / f.pesos.length : null;
  return { ...f, puesta, media, masa: media ? puesta * media : 0,
    pesoFiable: f.n >= REGLAS.controlPuesta.minHuevosPeso, edadMeses: edadMeses(f.a.fecha_nacimiento, new Date(`${inicio}T12:00:00`)) };
};

// Resultados de una campaña por gallina
export function resultadosCampana(c, hoy = new Date().toISOString().slice(0, 10)) {
  const fin = finCampana(c);
  const transcurridos = estadoCampana(c, hoy) === 'terminada' ? c.dias : diaCampana(c, hoy);
  const filas = c.gallinas.map(id => {
    const a = estado.idx.get(id);
    if (!a) return null;
    const r = resumenPuesta(id, c.inicio, fin);
    // Una gallina pone como mucho un huevo al día: la puesta se calcula con los días
    // con huevo y se avisan los días con más de uno (doble anotación o error).
    const porDia = {};
    r.lista.forEach(x => { porDia[x.fecha] = (porDia[x.fecha] || 0) + 1; });
    return conIndicadores({ a, id, n: r.n, aptos: r.aptos, lista: r.lista, pesos: r.lista.map(x => x.peso_g), diasConHuevo: r.dias,
      diasDobles: Object.values(porDia).filter(n => n > 1).length, hoy: porDia[hoy] || 0 }, transcurridos, c.inicio);
  }).filter(Boolean);
  filas.sort((x, y) => y.masa - x.masa || y.n - x.n);
  const lideres = destacar(filas);
  const total = filas.reduce((s, f) => s + f.n, 0);
  const diasConHuevo = filas.reduce((s, f) => s + f.diasConHuevo, 0);
  return { filas, total, transcurridos, fin, ...lideres,
    puestaMedia: filas.length && transcurridos ? diasConHuevo / (filas.length * transcurridos) : 0 };
}

// Acumulado de la temporada (todas las campañas del año) por gallina
export function temporadaPuesta(temporada) {
  const camps = estado.campanas.filter(c => c.usuario_id === estado.perfil?.id && c.temporada === temporada && estadoCampana(c) !== 'programada');
  const acc = new Map();
  for (const c of camps) {
    const res = resultadosCampana(c);
    for (const f of res.filas) {
      const x = acc.get(f.id) || { a: f.a, id: f.id, n: 0, dias: 0, diasConHuevo: 0, aptos: 0, pesos: [], ciclos: 0, inicio: c.inicio };
      x.n += f.n; x.dias += res.transcurridos; x.diasConHuevo += f.diasConHuevo; x.aptos += f.aptos; x.pesos.push(...f.pesos); x.ciclos += 1;
      if (c.inicio < x.inicio) x.inicio = c.inicio;
      acc.set(f.id, x);
    }
  }
  const filas = [...acc.values()].map(x => conIndicadores(x, x.dias, x.inicio)).sort((p, q) => q.masa - p.masa || q.n - p.n);
  return { filas, ...destacar(filas) };
}

// ---------------------------------------------------------------------------
// Reproducción: lotes (gallo + gallinas de una familia, desde una fecha)
// ---------------------------------------------------------------------------
const RP = () => REGLAS.reproduccion;
const sumaDias = (iso, n) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const hoyIso = () => new Date().toISOString().slice(0, 10);
export const misLotes = () => [...estado.lotes].sort((a, b) => b.inicio.localeCompare(a.inicio));
export const loteActivo = (l, dia = hoyIso()) => l.inicio <= dia && (!l.fin || l.fin >= dia);
// Desde qué día los huevos del lote se atribuyen al gallo (fecundidad residual del anterior)
export const fechaFiable = (l) => sumaDias(l.inicio, RP().diasEsperaCambioGallo);

export async function guardarLote({ id, familia, gallo_id, gallinas, inicio, fin = null, notas = '' }) {
  const p = estado.perfil;
  if (!p) throw new Error('Inicia sesión para organizar la reproducción.');
  const g = estado.idx.get(gallo_id);
  if (!g || g.sexo !== 'M' || g.usuario_id !== p.id || g.estado === 'baja') throw new Error('Elige un gallo tuyo y activo.');
  const lista = [...new Set(gallinas || [])].filter(x => { const a = estado.idx.get(x); return a && a.sexo === 'H' && a.usuario_id === p.id && a.estado !== 'baja'; });
  if (!lista.length) throw new Error('Elige al menos una gallina.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(inicio || ''))) throw new Error('Indica desde cuándo están juntos.');
  if (fin && fin < inicio) throw new Error('La fecha de fin es anterior a la de inicio.');
  // Una gallina no puede estar en dos lotes a la vez
  const solapa = (l) => l.id !== id && !(fin && fin < l.inicio) && !(l.fin && l.fin < inicio);
  for (const l of estado.lotes.filter(solapa)) {
    const repetidas = l.gallinas.filter(x => lista.includes(x));
    if (repetidas.length) throw new Error(`${repetidas.map(x => estado.idx.get(x)?.anilla).join(', ')} ya está en el lote de la familia ${l.familia || '—'} en esas fechas. Cierra antes ese lote.`);
    if (l.gallo_id === gallo_id) throw new Error(`Ese gallo ya está en el lote de la familia ${l.familia || '—'} en esas fechas.`);
  }
  const previo = id ? estado.lotes.find(x => x.id === id) : null;
  const ahora = new Date().toISOString();
  const l = { ...(previo || {}), id: previo?.id || uuid(), usuario_id: p.id, temporada: Number(inicio.slice(0, 4)), familia: familia || null,
    gallo_id, gallinas: lista, inicio, fin: fin || null, notas: notas || '', created_at: previo?.created_at || ahora, updated_at: ahora };
  await db.guardar('lotes', l);
  await sync.encolar('lotes', 'upsert', l);
  await cargar();
  return l;
}

export async function cerrarLote(id, fin = hoyIso()) {
  const l = estado.lotes.find(x => x.id === id);
  if (!l || l.usuario_id !== estado.perfil?.id) throw new Error('No autorizado.');
  return guardarLote({ ...l, fin });
}

// Padre probable de un huevo puesto por una gallina en una fecha
export function padreDe(madreId, fecha = hoyIso()) {
  const l = estado.lotes.find(x => x.gallinas.includes(madreId) && x.inicio <= fecha && (!x.fin || x.fin >= fecha));
  if (!l) return null;
  return { gallo_id: l.gallo_id, lote: l, fiable: fecha >= fechaFiable(l) };
}

// ---------------------------------------------------------------------------
// Incubaciones: una fila por madre (huevos puestos, claros en el miraje, nacidos)
// ---------------------------------------------------------------------------
export const misIncubaciones = () => [...estado.incubaciones].sort((a, b) => b.entrada.localeCompare(a.entrada));
export const calendarioIncubacion = (entrada) => ({
  entrada, miraje: sumaDias(entrada, RP().miraje), nacedora: sumaDias(entrada, RP().nacedora), eclosion: sumaDias(entrada, RP().eclosion)
});
export function faseIncubacion(inc, dia = hoyIso()) {
  const c = calendarioIncubacion(inc.entrada);
  if (inc.cerrada) return 'cerrada';
  if (dia < c.miraje) return 'incubando';
  if (dia < c.nacedora) return 'miraje';
  if (dia < c.eclosion) return 'nacedora';
  return 'eclosion';
}
// Huevos aptos de una gallina, recientes y aún no incubados
export function huevosDisponibles(madreId, dia = hoyIso()) {
  const usados = new Set(estado.incubaciones.flatMap(i => i.filas.flatMap(f => f.huevos || [])));
  const desde = sumaDias(dia, -RP().diasMaxHuevo);
  return estado.huevos.filter(x => x.animal_id === madreId && x.apto && x.fecha >= desde && x.fecha <= dia && !usados.has(x.id));
}

export async function crearIncubacion({ entrada, filas, notas = '' }) {
  const p = estado.perfil;
  if (!p) throw new Error('Inicia sesión para registrar incubaciones.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(entrada || ''))) throw new Error('Indica la fecha de entrada en la incubadora.');
  const limpias = (filas || []).map(f => {
    const m = estado.idx.get(f.madre_id);
    const n = Math.round(Number(f.puestos));
    if (!m || m.sexo !== 'H' || m.usuario_id !== p.id || !Number.isFinite(n) || n <= 0) return null;
    const pd = padreDe(m.id, entrada);
    return { madre_id: m.id, padre_id: f.padre_id ?? pd?.gallo_id ?? null, padre_fiable: f.padre_id ? true : Boolean(pd?.fiable),
      puestos: n, huevos: (f.huevos || []).slice(0, n), claros: null, nacidos: null, pollitos: [] };
  }).filter(Boolean);
  if (!limpias.length) throw new Error('Indica cuántos huevos de cada gallina entran en la incubadora.');
  const ahora = new Date().toISOString();
  const inc = { id: uuid(), usuario_id: p.id, entrada, filas: limpias, notas, cerrada: false, created_at: ahora, updated_at: ahora };
  await db.guardar('incubaciones', inc);
  await sync.encolar('incubaciones', 'upsert', inc);
  await cargar();
  return inc;
}

export async function actualizarIncubacion(id, cambios) {
  const inc = estado.incubaciones.find(x => x.id === id);
  if (!inc || inc.usuario_id !== estado.perfil?.id) throw new Error('No autorizado.');
  const filas = inc.filas.map((f, i) => {
    const c = cambios.filas?.[i] || {};
    const claros = c.claros === undefined ? f.claros : c.claros === '' || c.claros === null ? null : Math.round(Number(c.claros));
    const nacidos = c.nacidos === undefined ? f.nacidos : c.nacidos === '' || c.nacidos === null ? null : Math.round(Number(c.nacidos));
    if (claros !== null && (!Number.isFinite(claros) || claros < 0 || claros > f.puestos)) throw new Error(`Claros fuera de rango para ${estado.idx.get(f.madre_id)?.anilla}.`);
    const fertiles = f.puestos - (claros ?? 0);
    if (nacidos !== null && (!Number.isFinite(nacidos) || nacidos < 0 || nacidos > fertiles)) throw new Error(`Nacidos fuera de rango para ${estado.idx.get(f.madre_id)?.anilla} (máximo ${fertiles}).`);
    if (nacidos !== null && nacidos < f.pollitos.length) throw new Error(`Ya hay ${f.pollitos.length} pollito(s) dados de alta de ${estado.idx.get(f.madre_id)?.anilla}.`);
    return { ...f, claros, nacidos };
  });
  const r = { ...inc, filas, cerrada: cambios.cerrada ?? inc.cerrada, notas: cambios.notas ?? inc.notas, updated_at: new Date().toISOString() };
  await db.guardar('incubaciones', r);
  await sync.encolar('incubaciones', 'upsert', r);
  await cargar();
  return r;
}

export function resultadoIncubacion(inc) {
  const tot = inc.filas.reduce((a, f) => ({ puestos: a.puestos + f.puestos, claros: a.claros + (f.claros ?? 0), nacidos: a.nacidos + (f.nacidos ?? 0),
    conMiraje: a.conMiraje && f.claros !== null, conNacidos: a.conNacidos && f.nacidos !== null }), { puestos: 0, claros: 0, nacidos: 0, conMiraje: true, conNacidos: true });
  const fertiles = tot.puestos - tot.claros;
  return { ...tot, fertiles, fertilidad: tot.conMiraje && tot.puestos ? fertiles / tot.puestos : null,
    nacimiento: tot.conNacidos && fertiles ? tot.nacidos / fertiles : null, nacimientoTotal: tot.conNacidos && tot.puestos ? tot.nacidos / tot.puestos : null };
}

// Une un pollito dado de alta a su fila de incubación (trazabilidad huevo -> ejemplar)
export async function vincularPollito(incId, madreId, animalId) {
  const inc = estado.incubaciones.find(x => x.id === incId);
  if (!inc) return;
  const filas = inc.filas.map(f => (f.madre_id === madreId && !f.pollitos.includes(animalId) ? { ...f, pollitos: [...f.pollitos, animalId] } : f));
  const r = { ...inc, filas, updated_at: new Date().toISOString() };
  await db.guardar('incubaciones', r);
  await sync.encolar('incubaciones', 'upsert', r);
  await cargar();
}

// Pollitos nacidos pendientes de dar de alta (por anillar)
export const pollitosPendientes = () => misIncubaciones().flatMap(inc => inc.filas
  .filter(f => (f.nacidos ?? 0) > f.pollitos.length)
  .map(f => ({ inc, fila: f, pendientes: f.nacidos - f.pollitos.length, nacimiento: calendarioIncubacion(inc.entrada).eclosion })));

// ---------------------------------------------------------------------------
// Calificación morfológica (baremo de 100 puntos) — solo inspectores
// El resultado y la clase se calculan; el inspector no puede forzarlos.
// ---------------------------------------------------------------------------
export async function guardarCalificacion({ animalId, puntos, defectos, pesoG, observaciones, posicion }) {
  const p = estado.perfil;
  if (!esAuditor(p?.rol)) throw new Error('La calificación oficial corresponde a un inspector acreditado.');
  const a = estado.idx.get(animalId);
  if (!a) throw new Error('Ejemplar no encontrado.');
  const ev = evaluarCalificacion({ sexo: a.sexo, variedad: a.variedad, fechaNacimiento: a.fecha_nacimiento, pesoG, puntos, defectos });
  if (ev.invalidos.length) throw new Error('Hay puntuaciones fuera de rango (de 0 al máximo del apartado, en pasos de 0,5).');
  if (!ev.completa) throw new Error(`Puntúa las ${BAREMO.apartados.length} regiones antes de cerrar la ficha.`);
  if (ev.pesoConforme === null) throw new Error('El peso del animal (en gramos) es obligatorio en la calificación.');
  const limpios = Object.fromEntries(BAREMO.apartados.map(x => [x.id, puntoValido(puntos[x.id], x.max)]));
  const c = {
    id: uuid(), animal_id: a.id, inspector_id: p.id, inspector_nombre: p.nombre || p.email,
    fecha: new Date().toISOString().slice(0, 10), puntos: limpios, total: ev.total, clase: ev.clase,
    defectos: ev.defectosGraves,
    peso_g: pesoG ? Math.round(Number(pesoG)) : null, peso_conforme: ev.pesoConforme,
    resultado: ev.resultado, observaciones: observaciones || '',
    latitud: posicion?.latitud ?? null, longitud: posicion?.longitud ?? null,
    created_at: new Date().toISOString()
  };
  await db.guardar('calificaciones', c);
  await sync.encolar('calificaciones', 'upsert', c);
  // Promoción RN -> RD (la confirma también el trigger del servidor)
  const padresEnLibro = [a.padre_id, a.madre_id].every(id => SECCIONES_LIBRO.includes(estado.idx.get(id)?.seccion));
  if (ev.accedeRD && a.seccion === 'RN' && padresEnLibro && a.rega) {
    const promovido = { ...a, seccion: 'RD', updated_at: new Date().toISOString() };
    await db.guardar('animales', promovido);
  }
  await cargar();
  return c;
}

export const calificacionesDe = (animalId) =>
  estado.calificaciones.filter(c => c.animal_id === animalId).sort((x, y) => y.created_at.localeCompare(x.created_at));

// ---------------------------------------------------------------------------
// Registro de Méritos (RM)
// ---------------------------------------------------------------------------
// Situación de un ejemplar frente a los requisitos del RM
export function meritosRM(a) {
  const req = REGLAS.rm[a?.sexo];
  if (!req) return null;
  const califs = calificacionesDe(a.id).filter(c => c.clase !== 'D');
  const mejorPuntos = califs.length ? Math.max(...califs.map(c => Number(c.total) || 0)) : null;
  const hijosRD = estado.todos.filter(x => (x.padre_id === a.id || x.madre_id === a.id) && ['RD', 'RM'].includes(x.seccion)).length;
  const origenValido = REGLAS.rm.seccionesOrigen.includes(a.seccion);
  const cumplePuntos = mejorPuntos !== null && mejorPuntos >= req.puntos;
  const cumpleHijos = hijosRD >= req.hijosRD;
  return { req, mejorPuntos, hijosRD, origenValido, cumplePuntos, cumpleHijos,
    cumple: origenValido && cumplePuntos && cumpleHijos && Boolean(variedadPorId(a.variedad)?.oficial) };
}

// Inscripción en el RM (solo administración). via: 'requisitos' | 'premio'
export async function inscribirRM(animalId, { via = 'requisitos', motivo = '' } = {}) {
  if (rol() !== 'administrador') throw new Error('La inscripción en el Registro de Méritos la acuerda la administración del Libro.');
  const a = estado.idx.get(animalId);
  if (!a) throw new Error('Ejemplar no encontrado.');
  const m = meritosRM(a);
  if (!m.origenValido) throw new Error('Solo acceden al RM ejemplares del Registro Fundacional o del Definitivo.');
  if (!variedadPorId(a.variedad)?.oficial) throw new Error('Las variedades en proceso de reconocimiento no acceden al RM.');
  if (!m.cumplePuntos) throw new Error(`Necesita una calificación de ${m.req.puntos} puntos o más.`);
  if (via === 'requisitos' && !m.cumpleHijos) throw new Error(`Necesita ${m.req.hijosRD} descendientes en el Registro Definitivo (tiene ${m.hijosRD}).`);
  if (via === 'premio' && !String(motivo).trim()) throw new Error('Indica el premio: certamen, fecha y distinción.');
  const ahora = new Date().toISOString();
  const nuevo = { ...a, seccion: 'RM', rm_fecha: ahora.slice(0, 10), rm_via: via,
    rm_motivo: via === 'premio' ? String(motivo).trim() : `${m.mejorPuntos} puntos · ${m.hijosRD} descendientes en RD`, updated_at: ahora };
  await db.guardar('animales', nuevo);
  await sync.encolar('animales', 'upsert', nuevo);
  await cargar();
  return nuevo;
}

// Ejemplares que cumplen los requisitos y aún no están en el RM
export const candidatosRM = () => estado.todos
  .filter(a => a.estado !== 'baja' && a.seccion !== 'RM')
  .map(a => ({ a, m: meritosRM(a) }))
  .filter(x => x.m?.cumple);

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
