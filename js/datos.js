// ============================================================================
// Estado de la aplicación y operaciones de negocio (Libro Genealógico).
// Las vistas leen `estado` y llaman a estas funciones; nunca tocan IndexedDB
// ni Supabase directamente.
// ============================================================================
import * as db from './db.js';
import * as sync from './sync.js';
import { ESTANDAR, REGLAS, BAREMO, puntoValido, variedadPorId, evaluarCalificacion, huevoApto, huevoGrande, edadMeses, normalizarAnilla, comprobarAnilla, tramoEdad } from './estandar.js';
import { indice, fxAnimal, creaCiclo, animalesEnCiclo, nivelFx, neDemografico, neRealizado, generacionesEquivalentes, heredarMemoria } from './genetica.js';
import { esAuditor, actualizarPerfil, obtenerCliente } from './auth.js';
import { uuid, hoyISO } from './ui.js';

export const estado = {
  perfil: null,         // null = visitante
  todos: [],            // todos los animales conocidos (base del pedigrí)
  idx: new Map(),
  calificaciones: [],
  huevos: [],
  germoplasma: [],
  campanas: [],
  lotes: [],
  incubaciones: [],
  solicitudes: [],
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

// Calcula en segundo plano, a ratos libres, la consanguinidad de todo el Libro: así Informes,
// Auditoría y el Acta abren con los cálculos ya hechos. Se abandona si cambia la genealogía.
function calentarFx(idx) {
  const libre = window.requestIdleCallback || ((fn) => setTimeout(() => fn({ timeRemaining: () => 8 }), 30));
  const ids = [...idx.keys()];
  let i = 0;
  const paso = (plazo) => {
    if (estado.idx !== idx) return;
    while (i < ids.length && plazo.timeRemaining() > 2) fxAnimal(idx.get(ids[i++]), idx);
    if (i < ids.length) libre(paso);
  };
  libre(paso);
}

export async function cargar() {
  const [animales, calificaciones, huevos, perfiles, campanas, lotes, incubaciones, solicitudes, germoplasma] = await Promise.all(
    ['animales', 'calificaciones', 'huevos', 'perfiles', 'campanas', 'lotes', 'incubaciones', 'solicitudes', 'germoplasma'].map(s => db.todos(s)));
  estado.todos = animales;
  // Si la genealogía no ha cambiado (lo normal al guardar un huevo o una calificación),
  // se conservan los cálculos de consanguinidad ya hechos.
  const idxViejo = estado.idx;
  estado.idx = indice(animales);
  const firma = animales.map(a => `${a.id}:${a.padre_id || ''}:${a.madre_id || ''}`).join('|');
  if (firma === estado.firmaGenealogia) heredarMemoria(idxViejo, estado.idx);
  else calentarFx(estado.idx);
  estado.firmaGenealogia = firma;
  const p = estado.perfil;
  if (!p) {
    estado.calificaciones = [];
    estado.huevos = [];
    estado.perfiles = [];
    estado.campanas = [];
    estado.lotes = [];
    estado.incubaciones = [];
    estado.solicitudes = [];
    estado.germoplasma = [];
  } else if (esAuditor(p.rol)) {
    estado.calificaciones = calificaciones;
    estado.huevos = huevos;
    estado.perfiles = perfiles;
    estado.campanas = campanas;
    estado.lotes = lotes;
    estado.incubaciones = incubaciones;
    estado.solicitudes = solicitudes;
    estado.germoplasma = germoplasma;
  } else {
    const mios = new Set(animales.filter(a => a.usuario_id === p.id).map(a => a.id));
    estado.calificaciones = calificaciones.filter(c => mios.has(c.animal_id));
    estado.huevos = huevos.filter(h => mios.has(h.animal_id));
    estado.perfiles = perfiles.filter(x => x.id === p.id);
    estado.campanas = campanas.filter(c => c.usuario_id === p.id);
    estado.lotes = lotes.filter(l => l.usuario_id === p.id);
    estado.incubaciones = incubaciones.filter(i => i.usuario_id === p.id);
    estado.solicitudes = solicitudes.filter(x => x.usuario_id === p.id);
    estado.germoplasma = [];
  }
  // Huevos por gallina (evita recorrer todos los huevos para cada gallina)
  estado.huevosPorAnimal = new Map();
  for (const x of estado.huevos) { const l = estado.huevosPorAnimal.get(x.animal_id); if (l) l.push(x); else estado.huevosPorAnimal.set(x.animal_id, [x]); }
  estado.hijosPorAnimal = new Map();
  for (const a of estado.todos) for (const pr of [a.padre_id, a.madre_id]) if (pr) { const l = estado.hijosPorAnimal.get(pr); if (l) l.push(a); else estado.hijosPorAnimal.set(pr, [a]); }
  estado.califPorAnimal = new Map();
  for (const c of estado.calificaciones) { const l = estado.califPorAnimal.get(c.animal_id); if (l) l.push(c); else estado.califPorAnimal.set(c.animal_id, [c]); }
  estado.pendientes = await sync.pendientes();
  notificar();
}

// Un solo comparador para ordenar por anilla (crear uno en cada comparación es muy lento)
const ORDEN_ANILLA = new Intl.Collator('es', { numeric: true });

/** Animales visibles en "Mi censo" (o en el censo público para visitantes). */
export function censo({ incluirBajas = false, todos = false } = {}) {
  const p = estado.perfil;
  let lista = estado.todos;
  if (!p) lista = lista.map(versionPublica);                       // visitante: censo público
  else if (esAuditor(p.rol)) lista = [...lista];                      // inspector/administrador: todo
  else lista = todos ? lista.map(versionPublica) : lista.filter(a => a.usuario_id === p.id); // criador
  if (!incluirBajas) lista = lista.filter(a => a.estado !== 'baja');
  return lista.sort((a, b) => ORDEN_ANILLA.compare(String(a.anilla), String(b.anilla)));
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
  else if (a.fecha_nacimiento > hoyISO()) errores.push('La fecha de nacimiento no puede ser futura.');
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
  for (const [p, rolP] of [[padre, 'del padre'], [madre, 'de la madre']]) {
    if (p?.fecha_nacimiento && a.fecha_nacimiento && p.fecha_nacimiento >= a.fecha_nacimiento) {
      errores.push(`La fecha de nacimiento ${rolP} debe ser anterior a la del ejemplar.`);
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
  return h; // para poder deshacer
}

// Deshacer un borrado: el huevo vuelve con el mismo id (la cola envía el borrado y luego esto)
export async function restaurarHuevo(h) {
  if (!h || !puedeEditar(estado.idx.get(h.animal_id))) throw new Error('No autorizado.');
  await db.guardar('huevos', h);
  await sync.encolar('huevos', 'upsert', h);
  await cargar();
}

// Deshacer «Separar»: el lote vuelve a estar activo
export async function reabrirLote(id) {
  const l = estado.lotes.find(x => x.id === id);
  if (!l) throw new Error('Lote no encontrado.');
  return guardarLote({ ...l, fin: null });
}

export function resumenPuesta(animalId, desde = null, hasta = null) {
  const base = animalId ? (estado.huevosPorAnimal?.get(animalId) || []) : estado.huevos;
  const lista = base.filter(h => (!desde || h.fecha >= desde) && (!hasta || h.fecha <= hasta));
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
export const diaCampana = (c, hoy = hoyISO()) =>
  hoy < c.inicio ? 0 : Math.min(c.dias, Math.round((Date.parse(`${hoy}T12:00:00Z`) - Date.parse(`${c.inicio}T12:00:00Z`)) / 86400000) + 1);
export const estadoCampana = (c, hoy = hoyISO()) =>
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
export function resultadosCampana(c, hoy = hoyISO()) {
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
export const sumaDias = (iso, n) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const hoyIso = () => hoyISO();
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
  return (estado.huevosPorAnimal?.get(madreId) || []).filter(x => x.apto && x.fecha >= desde && x.fecha <= dia && !usados.has(x.id));
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
    fecha: hoyISO(), puntos: limpios, total: ev.total, clase: ev.clase,
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
  [...(estado.califPorAnimal?.get(animalId) || [])].sort((x, y) => y.created_at.localeCompare(x.created_at));

// ---------------------------------------------------------------------------
// Registro de Méritos (RM)
// ---------------------------------------------------------------------------
// Situación de un ejemplar frente a los requisitos del RM
export function meritosRM(a) {
  const req = REGLAS.rm[a?.sexo];
  if (!req) return null;
  const califs = calificacionesDe(a.id).filter(c => c.clase !== 'D');
  const mejorPuntos = califs.length ? Math.max(...califs.map(c => Number(c.total) || 0)) : null;
  const hijosRD = (estado.hijosPorAnimal?.get(a.id) || []).filter(x => ['RD', 'RM'].includes(x.seccion)).length;
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
  const nuevo = { ...a, seccion: 'RM', rm_origen: a.seccion, rm_fecha: ahora.slice(0, 10), rm_via: via,
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
// Auditoría del Libro: incoherencias que la Dirección Técnica (todo el Libro) o el
// criador (su censo) deben revisar. Solo informa: nunca corrige sola.
// ---------------------------------------------------------------------------
export const TIPOS_AUDITORIA = {
  anilla_duplicada: ['error', 'Anilla repetida'],
  anilla_invalida: ['error', 'Anilla incoherente'],
  sexo_progenitor: ['error', 'Sexo del padre o de la madre'],
  edad_progenitor: ['error', 'Padre o madre demasiado joven'],
  baja_progenitor: ['error', 'Padre o madre dado de baja antes'],
  ciclo: ['error', 'Genealogía circular'],
  rd_sin_apto: ['error', 'En RD o RM sin calificación Apto'],
  rd_padres: ['error', 'En RD o RM con padres fuera del Libro'],
  rd_variedad: ['error', 'En RD o RM con variedad no oficial'],
  sin_padres: ['aviso', 'Sin padre o madre (no podrá pasar al RD)'],
  sin_rega: ['aviso', 'Sin REGA'],
  consanguinidad: ['aviso', 'Consanguinidad elevada'],
  variedad_padres: ['aviso', 'Variedad distinta de la de los padres'],
  muy_viejo: ['aviso', '¿Sigue vivo?']
};

export function auditarLibro({ hoy = hoyIso() } = {}) {
  const p = estado.perfil;
  if (!p) return [];
  const AU = REGLAS.auditoria;
  const lista = censo({ incluirBajas: true });
  const activos = lista.filter(a => a.estado !== 'baja');
  const hallazgos = [];
  const anotar = (tipo, a, texto) => hallazgos.push({ tipo, nivel: TIPOS_AUDITORIA[tipo][0], animal: a, texto });
  // Anillas repetidas en todo lo visible (incluidas las bajas: una anilla no se reutiliza)
  const porAnilla = new Map();
  estado.todos.forEach(a => { const k = normalizarAnilla(a.anilla); porAnilla.set(k, (porAnilla.get(k) || 0) + 1); });
  const diasEntre = (x, y) => Math.round((new Date(`${y}T12:00:00Z`) - new Date(`${x}T12:00:00Z`)) / 864e5);
  const aptos = new Set(estado.calificaciones.filter(c => c.resultado === 'Apto').map(c => c.animal_id));
  const enCiclo = animalesEnCiclo(estado.todos);
  for (const a of lista) {
    if (porAnilla.get(normalizarAnilla(a.anilla)) > 1) anotar('anilla_duplicada', a, `La anilla ${a.anilla} está registrada más de una vez.`);
    const an = comprobarAnilla(a.anilla, { sexo: a.sexo, fechaNacimiento: a.fecha_nacimiento });
    if (an.errores.length) anotar('anilla_invalida', a, an.errores.join(' '));
    const padre = estado.idx.get(a.padre_id), madre = estado.idx.get(a.madre_id);
    if (padre && padre.sexo !== 'M') anotar('sexo_progenitor', a, `El padre ${padre.anilla} está registrado como hembra.`);
    if (madre && madre.sexo !== 'H') anotar('sexo_progenitor', a, `La madre ${madre.anilla} está registrada como macho.`);
    for (const [pr, quien] of [[padre, 'El padre'], [madre, 'La madre']]) {
      if (!pr || !pr.fecha_nacimiento || !a.fecha_nacimiento) continue;
      if (pr.fecha_nacimiento >= a.fecha_nacimiento) { anotar('edad_progenitor', a, `${quien} ${pr.anilla} nació después que su hijo/a.`); continue; }
      const m = edadMeses(pr.fecha_nacimiento, new Date(`${a.fecha_nacimiento}T12:00:00`));
      if (m < AU.edadMinimaPadres_meses) anotar('edad_progenitor', a, `${quien} ${pr.anilla} tenía ${m} meses cuando nació (mínimo plausible: ${AU.edadMinimaPadres_meses}).`);
    }
    if (madre?.baja_fecha && a.fecha_nacimiento && diasEntre(madre.baja_fecha, a.fecha_nacimiento) > AU.margenBajaMadre_dias)
      anotar('baja_progenitor', a, `La madre ${madre.anilla} se dio de baja el ${madre.baja_fecha.split('-').reverse().join('/')}, antes de poder poner el huevo.`);
    if (padre?.baja_fecha && a.fecha_nacimiento && diasEntre(padre.baja_fecha, a.fecha_nacimiento) > AU.margenBajaPadre_dias)
      anotar('baja_progenitor', a, `El padre ${padre.anilla} se dio de baja el ${padre.baja_fecha.split('-').reverse().join('/')}, antes de poder fecundar el huevo.`);
    if (enCiclo.has(a.id)) anotar('ciclo', a, 'El ejemplar aparece como ancestro de sí mismo.');
    if (a.estado === 'baja') continue;
    if (['RD', 'RM'].includes(a.seccion)) {
      if (!aptos.has(a.id)) anotar('rd_sin_apto', a, `Está en ${a.seccion} sin ninguna calificación Apto registrada.`);
      // Un RM que procede del Registro Fundacional no tiene por qué tener padres en el Libro
      const desdeRF = a.seccion === 'RM' && (a.rm_origen === 'RF' || (!a.rm_origen && !a.padre_id && !a.madre_id));
      const fuera = desdeRF ? [] : [[padre, a.padre_id, 'padre'], [madre, a.madre_id, 'madre']].filter(([x, id]) => !id || (x && !SECCIONES_LIBRO.includes(x.seccion)));
      if (fuera.length) anotar('rd_padres', a, fuera.map(([x, , q]) => (x ? `${q} ${x.anilla} en ${x.seccion}` : `${q} desconocido/a`)).join('; ') + '.');
      if (!variedadPorId(a.variedad)?.oficial) anotar('rd_variedad', a, `Variedad ${variedadPorId(a.variedad)?.nombre || a.variedad} aún no oficial.`);
    }
    if (a.seccion === 'RN' && (!a.padre_id || !a.madre_id)) anotar('sin_padres', a, `Sin ${!a.padre_id && !a.madre_id ? 'padre ni madre' : !a.padre_id ? 'padre' : 'madre'}. Si es un fundador, la Dirección Técnica puede inscribirlo en RF.`);
    if (!a.rega) anotar('sin_rega', a, esAuditor(p.rol) ? 'Explotación sin REGA.' : 'Sin REGA: añádelo en Mi aviario y edita el ejemplar.');
    const f = fxAnimal(a, estado.idx);
    if (nivelFx(f).nivel === 'alerta') anotar('consanguinidad', a, `Fx ${(f * 100).toFixed(1).replace('.', ',')} %: evita usarlo con parientes.`);
    if (padre && madre && padre.variedad !== madre.variedad) anotar('variedad_padres', a, `Cruce de variedades: padre ${variedadPorId(padre.variedad)?.nombre || padre.variedad}, madre ${variedadPorId(madre.variedad)?.nombre || madre.variedad}.`);
    else if (padre && madre && padre.variedad !== a.variedad) anotar('variedad_padres', a, `Sus padres son ${variedadPorId(padre.variedad)?.nombre || padre.variedad}: ¿variedad mal anotada?`);
    const anios = edadMeses(a.fecha_nacimiento, new Date(`${hoy}T12:00:00`));
    if (anios !== null && anios >= AU.edadRevisar_anios * 12) anotar('muy_viejo', a, `Tiene ${Math.floor(anios / 12)} años. Si ya no vive, dalo de baja.`);
  }
  const orden = Object.keys(TIPOS_AUDITORIA);
  return hallazgos.sort((x, y) => orden.indexOf(x.tipo) - orden.indexOf(y.tipo) || x.animal.anilla.localeCompare(y.animal.anilla));
}

// ---------------------------------------------------------------------------
// Acta anual de cierre censal: foto del Libro a 31 de diciembre (o a hoy, si el año
// está en curso) y balance del año. Inspección y administración: todo el Libro;
// criador: su aviario.
// ---------------------------------------------------------------------------
export function resumenAnual(anio) {
  const p = estado.perfil;
  const hoy = hoyIso();
  const enCurso = String(anio) === hoy.slice(0, 4);
  const corte = enCurso ? hoy : `${anio}-12-31`;
  const delAnio = (f) => Boolean(f) && String(f).slice(0, 4) === String(anio);
  const todos = censo({ incluirBajas: true });
  const vivos = todos.filter(a => a.fecha_nacimiento <= corte && (a.estado !== 'baja' || (a.baja_fecha && a.baja_fecha > corte)));
  const ids = new Set(todos.map(a => a.id));
  const dCorte = new Date(`${corte}T12:00:00`);
  const porSexo = (lista) => ({ M: lista.filter(a => a.sexo === 'M').length, H: lista.filter(a => a.sexo === 'H').length, total: lista.length });
  const agrupar = (claves, f) => claves.map(([id, nombre]) => ({ id, nombre, ...porSexo(vivos.filter(a => f(a) === id)) })).filter(x => x.total);

  const adultos = vivos.filter(a => tramoEdad(a.fecha_nacimiento, dCorte)?.id === 'adulto');
  const nm = adultos.filter(a => a.sexo === 'M').length, nf = adultos.filter(a => a.sexo === 'H').length;
  const neR = neRealizado(vivos, estado.idx);
  const media = (lista, f) => (lista.length ? lista.reduce((s, a) => s + f(a), 0) / lista.length : null);

  const bajas = todos.filter(a => a.estado === 'baja' && delAnio(a.baja_fecha));
  const causas = {};
  bajas.forEach(a => { const k = a.baja_causa || 'Sin indicar'; causas[k] = (causas[k] || 0) + 1; });
  const califs = estado.calificaciones.filter(c => ids.has(c.animal_id) && delAnio(c.fecha));
  const porClase = Object.fromEntries(BAREMO.clases.map(c => [c.id, 0]).concat([['D', 0]]));
  califs.forEach(c => { if (c.clase in porClase) porClase[c.clase]++; });
  const huevos = estado.huevos.filter(x => ids.has(x.animal_id) && delAnio(x.fecha));
  const pesos = huevos.map(x => Number(x.peso_g)).filter(Number.isFinite);
  const incs = estado.incubaciones.filter(i => delAnio(i.entrada)).map(resultadoIncubacion);
  const rep = incs.reduce((t, r) => ({ puestos: t.puestos + r.puestos, claros: t.claros + r.claros, nacidos: t.nacidos + r.nacidos, conMiraje: t.conMiraje + (r.fertilidad !== null ? r.puestos : 0), fertConMiraje: t.fertConMiraje + (r.fertilidad !== null ? r.fertiles : 0) }),
    { puestos: 0, claros: 0, nacidos: 0, conMiraje: 0, fertConMiraje: 0 });
  const lotes = estado.lotes.filter(l => delAnio(l.inicio));
  const sols = estado.solicitudes.filter(x => delAnio(x.created_at));
  const titulares = new Set(vivos.map(a => a.usuario_id).filter(Boolean));
  const regas = new Set(vivos.map(a => a.rega).filter(Boolean));
  const municipios = {};
  vivos.forEach(a => { const k = [a.municipio, a.provincia].filter(Boolean).join(' · ') || 'Sin municipio'; municipios[k] = (municipios[k] || 0) + 1; });
  const au = auditarLibro();

  return {
    anio: Number(anio), corte, enCurso, ambito: esAuditor(p?.rol) ? 'libro' : 'aviario', perfil: p,
    censo: {
      ...porSexo(vivos),
      secciones: agrupar(Object.entries(ESTANDAR.secciones), a => a.seccion),
      variedades: agrupar(ESTANDAR.variedades.map(v => [v.id, v.nombre + (v.oficial ? '' : ' (en proceso)')]), a => a.variedad),
      edades: agrupar(REGLAS.tramosEdadMeses.map(t => [t.id, t.nombre]), a => tramoEdad(a.fecha_nacimiento, dCorte)?.id)
    },
    genetica: { nm, nf, neDem: neDemografico(nm, nf), neReal: neR, fxMedio: media(vivos, a => fxAnimal(a, estado.idx)),
      geMedio: media(vivos, a => generacionesEquivalentes(a.id, estado.idx)), conPadres: vivos.length ? vivos.filter(a => a.padre_id && a.madre_id).length / vivos.length : null },
    movimientos: { nacidos: porSexo(todos.filter(a => delAnio(a.fecha_nacimiento))), bajas: bajas.length, causas,
      calificaciones: califs.length, ejemplaresCalificados: new Set(califs.map(c => c.animal_id)).size, aptos: califs.filter(c => c.resultado === 'Apto').length, porClase,
      rm: todos.filter(a => a.seccion === 'RM' && delAnio(a.rm_fecha)).length, solicitudes: sols.length, visitas: sols.filter(x => x.estado === 'realizada').length },
    reproduccion: { lotes: lotes.length, gallos: new Set(lotes.map(l => l.gallo_id)).size, incubaciones: incs.length, ...rep,
      fertilidad: rep.conMiraje ? rep.fertConMiraje / rep.conMiraje : null, nacimiento: rep.puestos - rep.claros > 0 && incs.length && incs.every(r => r.nacimiento !== null) ? rep.nacidos / (rep.puestos - rep.claros) : null },
    puesta: { huevos: huevos.length, gallinas: new Set(huevos.map(x => x.animal_id)).size, pesoMedio: pesos.length ? pesos.reduce((s, x) => s + x, 0) / pesos.length : null,
      pesoMax: pesos.length ? Math.max(...pesos) : null, aptos: huevos.filter(x => x.apto).length, campanas: estado.campanas.filter(c => c.temporada === Number(anio)).length },
    territorio: { titulares: titulares.size, explotaciones: regas.size, municipios: Object.entries(municipios).sort((x, y) => y[1] - x[1]) },
    calidad: { errores: au.filter(x => x.nivel === 'error').length, avisos: au.filter(x => x.nivel === 'aviso').length }
  };
}

// ---------------------------------------------------------------------------
// Evolución del censo año a año (Protocolo CNZ 2025, apdo. 3.1 f: «censos y tendencia
// o evolución de los mismos, por sexo y edades»). Censo a 31 de diciembre de cada año
// (el año en curso, a hoy), desde el primer nacimiento registrado.
// ---------------------------------------------------------------------------
export function evolucionCenso({ hasta = Number(hoyIso().slice(0, 4)) } = {}) {
  const fechas = censo({ incluirBajas: true }).map(a => a.fecha_nacimiento).filter(Boolean).sort();
  if (!fechas.length) return [];
  const desde = Math.max(Number(fechas[0].slice(0, 4)), hasta - 14);
  const filas = [];
  for (let anio = desde; anio <= hasta; anio++) {
    const r = resumenAnual(anio);
    const tramo = (id) => r.censo.edades.find(e => e.id === id) || { M: 0, H: 0, total: 0 };
    filas.push({
      anio, corte: r.corte, enCurso: r.enCurso,
      total: r.censo.total, machos: r.censo.M, hembras: r.censo.H,
      reproductoresM: r.genetica.nm, reproductoras: r.genetica.nf,
      edades: Object.fromEntries(REGLAS.tramosEdadMeses.map(t => [t.id, tramo(t.id)])),
      nacidos: r.movimientos.nacidos.total, bajas: r.movimientos.bajas,
      criadores: r.territorio.titulares, explotaciones: r.territorio.explotaciones, municipios: r.territorio.municipios.length,
      neDem: r.genetica.neDem, fxMedio: r.genetica.fxMedio
    });
  }
  filas.forEach((f, i) => { const a = filas[i - 1]; f.variacion = a && a.total ? (f.total - a.total) / a.total : null; });
  return filas;
}

// ---------------------------------------------------------------------------
// Puesta de la raza por año (Protocolo CNZ 2025, apdo. 3.1 e: aptitudes presentes).
// La intensidad de puesta sale solo de las campañas de control (días controlados);
// el peso del huevo, de todos los huevos pesados del año. Para el criador, su aviario.
// ---------------------------------------------------------------------------
const estadisticas = (v) => {
  if (!v.length) return { n: 0, media: null, de: null, min: null, max: null };
  const media = v.reduce((s, x) => s + x, 0) / v.length;
  const de = v.length > 1 ? Math.sqrt(v.reduce((s, x) => s + (x - media) ** 2, 0) / (v.length - 1)) : null;
  return { n: v.length, media, de, min: Math.min(...v), max: Math.max(...v) };
};
export function puestaRaza({ hoy = hoyIso() } = {}) {
  const porAnio = new Map();
  const fila = (anio) => {
    if (!porAnio.has(anio)) porAnio.set(anio, { anio, campanas: 0, criadores: new Set(), gallinas: new Set(), diasGallina: 0, diasConHuevo: 0,
      huevosCampana: 0, variedades: new Map(), edades: { jovenes: { d: 0, c: 0, g: new Set() }, adultas: { d: 0, c: 0, g: new Set() } }, pesos: [], aptos: 0, grandes: 0 });
    return porAnio.get(anio);
  };
  for (const c of estado.campanas) {
    if (estadoCampana(c, hoy) === 'programada') continue;
    const res = resultadosCampana(c, hoy);
    if (!res.transcurridos || !res.filas.length) continue;
    const f = fila(c.temporada);
    f.campanas += 1; f.criadores.add(c.usuario_id);
    for (const g of res.filas) {
      f.gallinas.add(g.id); f.diasGallina += res.transcurridos; f.diasConHuevo += g.diasConHuevo; f.huevosCampana += g.n;
      const v = f.variedades.get(g.a.variedad) || { d: 0, c: 0, g: new Set(), pesos: [] };
      v.d += res.transcurridos; v.c += g.diasConHuevo; v.g.add(g.id); v.pesos.push(...g.pesos);
      f.variedades.set(g.a.variedad, v);
      const e = f.edades[g.edadMeses != null && g.edadMeses < 12 ? 'jovenes' : 'adultas'];
      e.d += res.transcurridos; e.c += g.diasConHuevo; e.g.add(g.id);
    }
  }
  for (const x of estado.huevos) {
    if (!x.fecha || x.fecha > hoy || !Number.isFinite(Number(x.peso_g))) continue;
    const f = fila(Number(x.fecha.slice(0, 4)));
    f.pesos.push(Number(x.peso_g));
    if (x.apto) f.aptos += 1;
    if (huevoGrande(x.peso_g)) f.grandes += 1;
  }
  return [...porAnio.values()].sort((a, b) => b.anio - a.anio).map(f => {
    const peso = estadisticas(f.pesos);
    const tasa = (d, c) => (d ? c / d : null);
    return {
      anio: f.anio, enCurso: f.anio === Number(hoy.slice(0, 4)), campanas: f.campanas, criadores: f.criadores.size, gallinas: f.gallinas.size,
      diasGallina: f.diasGallina, huevosCampana: f.huevosCampana, puesta: tasa(f.diasGallina, f.diasConHuevo),
      jovenes: { gallinas: f.edades.jovenes.g.size, puesta: tasa(f.edades.jovenes.d, f.edades.jovenes.c) },
      adultas: { gallinas: f.edades.adultas.g.size, puesta: tasa(f.edades.adultas.d, f.edades.adultas.c) },
      peso, aptos: peso.n ? f.aptos / peso.n : null, grandes: peso.n ? f.grandes / peso.n : null,
      variedades: [...f.variedades.entries()].map(([id, v]) => ({ id, gallinas: v.g.size, puesta: tasa(v.d, v.c), peso: estadisticas(v.pesos) }))
        .sort((a, b) => b.gallinas - a.gallinas)
    };
  });
}

// ---------------------------------------------------------------------------
// Situación poblacional para la categoría del Catálogo (Protocolo CNZ 2025, apdo.
// 3.1 g). Criterios del «Protocolo con los criterios para determinar la situación de
// amenaza de una raza» (CNZ, 21/7/2022), umbrales de aves: la raza está amenazada si
// la media de los tres años anteriores queda por debajo en cualquiera de a), b) o c);
// el grado se fija con c). Ne, consanguinidad, tendencia y explotaciones son
// información complementaria que la CNZ puede tener en cuenta de forma excepcional.
// ---------------------------------------------------------------------------
export const UMBRALES_AMENAZA_AVES = Object.freeze({
  hembras: 25000, machos: 500, reposicion: 15000, edadMeses: 6,
  grados: Object.freeze([['alto', 750], ['medio', 7499], ['bajo', 14999]])
});

export function situacionPoblacional({ hasta = Number(hoyIso().slice(0, 4)) - 1 } = {}) {
  const U = UMBRALES_AMENAZA_AVES;
  const todos = censo({ incluirBajas: true });
  const enLibro = new Set(todos.map(a => a.id));
  const vivoEn = (a, fecha) => a.fecha_nacimiento && a.fecha_nacimiento <= fecha && (a.estado !== 'baja' || !a.baja_fecha || a.baja_fecha > fecha);
  const meses = (iso, n) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCMonth(d.getUTCMonth() + n); return d.toISOString().slice(0, 10); };
  const anios = [hasta - 2, hasta - 1, hasta];
  const filas = anios.map(anio => {
    const ini = `${anio}-01-01`, fin = `${anio}-12-31`;
    // a) Hembras que se reprodujeron en pureza: madres de algún pollito del año con padre y madre inscritos
    const madres = new Set(todos.filter(h => String(h.fecha_nacimiento || '').startsWith(String(anio)) && enLibro.has(h.madre_id) && enLibro.has(h.padre_id)).map(h => h.madre_id));
    // b) Machos que pueden usarse como reproductores: vivos a 31 de diciembre y con 6 meses o más
    const machos = todos.filter(a => a.sexo === 'M' && vivoEn(a, fin) && meses(a.fecha_nacimiento, U.edadMeses) <= fin).length;
    // c) Reposición: hembras inscritas que cumplieron 6 meses durante el año (y seguían vivas)
    const reposicion = todos.filter(a => { if (a.sexo !== 'H' || !a.fecha_nacimiento) return false; const f6 = meses(a.fecha_nacimiento, U.edadMeses); return f6 >= ini && f6 <= fin && vivoEn(a, f6); }).length;
    return { anio, hembras: madres.size, machos, reposicion };
  });
  const media = (k) => filas.reduce((n, f) => n + f[k], 0) / filas.length;
  const m = { hembras: media('hembras'), machos: media('machos'), reposicion: media('reposicion') };
  const bajo = { hembras: m.hembras < U.hembras, machos: m.machos < U.machos, reposicion: m.reposicion < U.reposicion };
  const amenazada = bajo.hembras || bajo.machos || bajo.reposicion;
  const grado = !amenazada ? null : !bajo.reposicion ? 'bajo' : (U.grados.find(([, max]) => m.reposicion <= max) || ['bajo'])[0];
  const evol = evolucionCenso();
  const ult = evol.at(-1) || null;
  const hace = evol.length > 3 ? evol.at(-4) : evol[0] || null;
  return {
    anios, filas, medias: m, bajo, amenazada, grado, umbrales: U,
    complementaria: ult ? { neDem: ult.neDem, fxMedio: ult.fxMedio, explotaciones: ult.explotaciones, municipios: ult.municipios, criadores: ult.criadores,
      tendencia: hace && hace !== ult && hace.total ? (ult.total - hace.total) / hace.total : null, desde: hace?.anio ?? null, germoplasma: resumenGermoplasma().germoplasma } : null
  };
}

// ---------------------------------------------------------------------------
// «Hoy»: lo que toca hacer, reunido de todas partes (incubaciones, campaña, pollitos,
// lotes, inspección, auditoría) y lo propio del mes. nivel: 'hoy' | 'pronto' | 'info'.
// ---------------------------------------------------------------------------
const fechaCorta = (iso) => iso.split('-').reverse().slice(0, 2).join('/');
const ORDEN_NIVEL = { hoy: 0, pronto: 1, info: 2 };
export const TAREAS_DEL_MES = {
  1: ['🧬', 'Forma las familias y los lotes de la temporada, mirando la consanguinidad de cada cruce. Cierra el año anterior con el acta.', '#/reproduccion'],
  2: ['🥚', 'Junta gallos y gallinas al menos 15 días antes de incubar. Organiza la primera campaña de puesta.', '#/campanas'],
  3: ['🐣', 'Temporada de puesta e incubación: campañas de 15 días e incubar huevos identificados.', '#/reproduccion'],
  4: ['🐣', 'Temporada de puesta e incubación. Anilla los pollitos en cuanto la anilla pase por el pie.', '#/reproduccion'],
  5: ['🐣', 'Última campaña de puesta. Anilla y da de alta los pollitos con sus padres.', '#/reproduccion'],
  6: ['🐣', 'Cierra las campañas de puesta: mira qué gallina de cada familia da la reposición.', '#/campanas'],
  7: ['🐥', 'Anilla y da de alta los pollitos que falten. Separa machos y hembras cuando se distingan.', '#/alta'],
  8: ['🐥', 'Recría: revisa que todos los pollitos estén dados de alta y con su anilla.', '#/censo'],
  9: ['🔎', 'Elige la reposición: un hijo de cada gallo y una hija de cada gallina.', '#/apareamientos'],
  10: ['🔎', 'Pide las anillas a FESACOCUR. Solicita la inspección de los ejemplares que ya tienen un año.', '#/inspeccion'],
  11: ['🔎', 'Calificaciones: solicita la inspección de los ejemplares con un año. Pide las anillas si aún no lo has hecho.', '#/inspeccion'],
  12: ['📄', 'Revisa tu censo, da de baja los que ya no están y haz la copia de seguridad. El Club cierra el año con el acta.', '#/auditoria']
};

export function agendaHoy(dia = hoyIso()) {
  const p = estado.perfil;
  if (!p) return [];
  const t = [];
  const add = (nivel, icono, texto, href, sub = '') => t.push({ nivel, icono, texto, href, sub });
  const manana = sumaDias(dia, 1);
  // Incubaciones
  for (const inc of misIncubaciones().filter(i => !i.cerrada)) {
    const c = calendarioIncubacion(inc.entrada);
    const href = `#/incubacion/${inc.id}`;
    const sinClaros = inc.filas.some(f => f.claros === null || f.claros === undefined);
    const sinNacidos = inc.filas.some(f => f.nacidos === null || f.nacidos === undefined);
    const de = `la incubación del ${fechaCorta(inc.entrada)}`;
    if (dia >= c.eclosion && sinNacidos) add('hoy', '🐣', `Anota los nacimientos de ${de}`, href, 'Nacidos por gallina; después, dalos de alta.');
    else if (dia >= c.miraje && sinClaros) add('hoy', '🔦', `Miraje de ${de}${dia > c.miraje ? ` (tocaba el ${fechaCorta(c.miraje)})` : ''}`, href, 'Al trasluz, retira y anota los huevos claros.');
    else if (dia === c.nacedora) add('hoy', '🧺', `Pasa a la nacedora ${de}`, href, 'Deja de voltear y separa los huevos de cada gallina.');
    else if (manana === c.miraje) add('pronto', '🔦', `Mañana: miraje de ${de}`, href);
    else if (manana === c.nacedora) add('pronto', '🧺', `Mañana: pasar a la nacedora ${de}`, href);
    else if (manana === c.eclosion) add('pronto', '🐣', `Mañana nacen los pollitos de ${de}`, href);
    else if (dia < c.eclosion) add('info', '🥚', `Incubando: ${de}`, href, `Nacimiento previsto el ${fechaCorta(c.eclosion)}.`);
  }
  // Pollitos por dar de alta
  const pend = pollitosPendientes().reduce((n, x) => n + x.pendientes, 0);
  if (pend) add('hoy', '🐥', `${pend} pollito(s) por anillar y dar de alta`, '#/reproduccion', 'Padre, madre y fecha ya puestos desde la incubación.');
  // Campaña de puesta
  const camp = campanaEnCurso();
  if (camp) {
    const faltan = resultadosCampana(camp, dia).filas.filter(x => !x.hoy).length;
    add(faltan ? 'hoy' : 'info', '⚖️', `Campaña de puesta: día ${diaCampana(camp, dia)} de ${camp.dias}`, '#/puesta',
      faltan ? `${faltan} gallina(s) sin huevo anotado hoy.` : 'Hoy ya están anotadas todas las gallinas.');
  } else {
    const prox = misCampanas().find(c => estadoCampana(c, dia) === 'programada' && c.inicio <= sumaDias(dia, 3));
    if (prox) add('pronto', '⚖️', `La campaña ${prox.ciclo} empieza el ${fechaCorta(prox.inicio)}`, `#/campana/${prox.id}`, 'Prepara las jaulas o los ponederos y la báscula.');
  }
  // Lotes recién formados: desde cuándo valen sus huevos
  for (const l of misLotes().filter(l => loteActivo(l, dia) && dia < fechaFiable(l))) {
    add('info', '⏳', `Lote${l.familia ? ` de la familia ${l.familia}` : ''}: sus huevos valen para incubar desde el ${fechaCorta(fechaFiable(l))}`, '#/reproduccion');
  }
  // Inspección
  const sol = solicitudAbierta();
  if (sol?.estado === 'programada' && sol.fecha_visita >= dia) add(sol.fecha_visita === dia ? 'hoy' : 'pronto', '🔎', `Visita del inspector ${sol.fecha_visita === dia ? 'hoy' : `el ${fechaCorta(sol.fecha_visita)}`}`, '#/inspeccion', sol.respuesta || 'Ten los animales a mano, con la anilla legible.');
  else if (sol?.estado === 'pendiente') add('info', '🔎', 'Solicitud de inspección enviada', '#/inspeccion', 'El inspector te llamará para concertar la visita.');
  else if (!sol) {
    const listos = porCalificar(p.id).filter(x => x.listo).length;
    if (listos) add('pronto', '🔎', `${listos} ejemplar(es) con un año sin calificar`, '#/inspeccion', 'Solicita la inspección: es la llave del Registro Definitivo.');
  }
  // Inspección y administración: solicitudes de los criadores
  if (esAuditor(p.rol)) {
    const abiertas = solicitudesTodas().filter(solicitudAbiertaEs);
    const porLlamar = abiertas.filter(x => x.estado === 'pendiente').length;
    if (porLlamar) add('hoy', '📞', `${porLlamar} solicitud(es) de inspección por llamar`, '#/inspecciones');
    const visitas = abiertas.filter(x => x.estado === 'programada' && x.fecha_visita >= dia && x.fecha_visita <= sumaDias(dia, 7));
    const sinCerrar = abiertas.filter(x => x.estado === 'programada' && x.fecha_visita && x.fecha_visita < dia && (!x.inspector_id || x.inspector_id === p.id)).length;
    if (sinCerrar) add('hoy', '🩺', `${sinCerrar} visita(s) sin cerrar`, '#/inspecciones', 'Califica los ejemplares y márcalas como realizadas.');
    for (const v of visitas) {
      const c = estado.perfiles.find(x => x.id === v.usuario_id);
      add(v.fecha_visita === dia ? 'hoy' : 'pronto', '🚗', `Visita ${v.fecha_visita === dia ? 'hoy' : `el ${fechaCorta(v.fecha_visita)}`}: ${c?.nombre || 'criador'}${c?.municipio ? ` (${c.municipio})` : ''}`, '#/inspecciones', `${v.animales.length} ejemplar(es).`);
    }
  }
  // Calidad del censo
  const errores = auditarLibro().filter(x => x.nivel === 'error').length;
  if (errores) add('pronto', '🩺', `${errores} error(es) en ${esAuditor(p.rol) ? 'el Libro' : 'tu censo'}`, '#/auditoria', 'Corrígelos antes de la inspección o del cierre del año.');
  // Administración: lo demás del panel (las inspecciones y la auditoría ya salen arriba)
  if (p.rol === 'administrador') {
    const resto = tareasAdmin({ hoy: dia }).filter(x => x.nivel !== 'info' && !['#/inspecciones', '#/auditoria'].includes(x.href));
    if (resto.length) add(resto.some(x => x.nivel === 'hoy') ? 'hoy' : 'pronto', '🛡️', resto.length === 1 ? resto[0].texto : `${resto.length} tareas de administración`, '#/admin', resto.length === 1 ? resto[0].sub : resto.map(x => x.texto).join(' · '));
  }
  return t.sort((x, y) => ORDEN_NIVEL[x.nivel] - ORDEN_NIVEL[y.nivel]);
}

// Primeros pasos del criador nuevo. Lo asíncrono (instalación, copia, guía) se pasa desde la vista.
export function primerosPasos({ instalada = false, copiaHecha = false, guiaVista = false, conServidor = false } = {}) {
  const p = estado.perfil;
  if (!p) return [];
  const propios = estado.todos.filter(a => a.usuario_id === p.id);
  return [
    { id: 'aviario', texto: 'Completa Mi aviario: REGA, municipio y ubicación', href: '#/perfil', hecho: Boolean(p.rega && p.municipio && p.latitud != null) },
    { id: 'instalar', texto: 'Instala la app en el móvil', href: '#/herramientas', hecho: instalada },
    { id: 'guia', texto: 'Lee la Guía del criador (10 minutos)', href: '#/programa', hecho: guiaVista },
    { id: 'altas', texto: 'Da de alta tus gallos y gallinas', href: '#/alta', hecho: propios.length > 0 },
    { id: 'lotes', texto: 'Forma tus lotes de reproducción (gallo + gallinas)', href: '#/reproduccion', hecho: estado.lotes.length > 0 },
    ...(conServidor ? [] : [{ id: 'copia', texto: 'Haz tu primera copia de seguridad', href: '#/copia', hecho: copiaHecha }])
  ];
}

// ---------------------------------------------------------------------------
// Solicitudes de inspección: el criador pide la visita con los ejemplares listos;
// inspección y administración la programan, califican y la cierran.
// ---------------------------------------------------------------------------
export const ESTADOS_SOLICITUD = { pendiente: 'Pendiente', programada: 'Visita programada', realizada: 'Realizada', anulada: 'Anulada' };
export const HORARIOS = { indiferente: 'Cualquier momento', mananas: 'Mañanas', tardes: 'Tardes', findes: 'Fines de semana' };
export const solicitudAbiertaEs = (s) => s.estado === 'pendiente' || s.estado === 'programada';
export const misSolicitudes = () => estado.solicitudes.filter(s => s.usuario_id === estado.perfil?.id).sort((a, b) => b.created_at.localeCompare(a.created_at));
export const solicitudAbierta = () => misSolicitudes().find(solicitudAbiertaEs) || null;
// Para inspección: abiertas primero (la más antigua antes), luego el resto
export const solicitudesTodas = () => [...estado.solicitudes].sort((a, b) =>
  (solicitudAbiertaEs(b) - solicitudAbiertaEs(a)) || (solicitudAbiertaEs(a) ? a.created_at.localeCompare(b.created_at) : b.created_at.localeCompare(a.created_at)));

// Ejemplares del criador pendientes de calificar: en RN o RA, sin Apto ni descalificación.
// «listo» = ya tiene la edad mínima del RD; el resto se muestra con la fecha en que la cumple.
export function porCalificar(usuarioId = estado.perfil?.id) {
  return estado.todos
    .filter(a => a.usuario_id === usuarioId && a.estado !== 'baja' && ['RN', 'RA'].includes(a.seccion))
    .map(a => {
      const califs = calificacionesDe(a.id);
      const meses = edadMeses(a.fecha_nacimiento);
      return { a, meses, califs, listo: meses !== null && meses >= REGLAS.edadMinimaRD_meses, fechaListo: sumaMesesIso(a.fecha_nacimiento, REGLAS.edadMinimaRD_meses) };
    })
    .filter(x => !x.califs.some(c => c.resultado === 'Apto' || c.clase === 'D'))
    .sort((x, y) => x.a.anilla.localeCompare(y.a.anilla));
}
const sumaMesesIso = (iso, n) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCMonth(d.getUTCMonth() + n); return d.toISOString().slice(0, 10); };

// Teléfono para llamar y para WhatsApp (los móviles españoles de 9 cifras llevan el prefijo 34)
export function telefonoInternacional(t) {
  let d = String(t || '').replace(/[^\d+]/g, '');
  if (d.startsWith('+')) d = d.slice(1); else if (d.startsWith('00')) d = d.slice(2);
  d = d.replace(/\D/g, '');
  if (/^[6789]\d{8}$/.test(d)) d = `34${d}`;
  return d.length >= 9 ? d : null;
}

export async function crearSolicitud({ animales, telefono, horario = 'indiferente', notas = '' }) {
  let p = estado.perfil;
  if (!p) throw new Error('Inicia sesión para solicitar una inspección.');
  if (solicitudAbierta()) throw new Error('Ya tienes una solicitud abierta. Espera a la visita o anúlala para hacer otra.');
  const listos = new Set(porCalificar(p.id).filter(x => x.listo).map(x => x.a.id));
  const lista = [...new Set(animales || [])].filter(id => listos.has(id));
  if (!lista.length) throw new Error('Elige al menos un ejemplar con un año cumplido y sin calificar.');
  const tel = String(telefono || '').trim();
  if (!telefonoInternacional(tel)) throw new Error('Indica un teléfono de contacto válido: el inspector te llamará para concertar la visita.');
  if (!HORARIOS[horario]) horario = 'indiferente';
  // El teléfono se guarda en el perfil si no estaba o ha cambiado
  if (tel !== (p.telefono || '')) {
    const { perfil, paraServidor } = await actualizarPerfil(p, { telefono: tel });
    estado.perfil = p = perfil;
    await guardarPerfilServidor(paraServidor);
  }
  const ahora = new Date().toISOString();
  const s = { id: uuid(), usuario_id: p.id, animales: lista, telefono: tel, horario, notas: String(notas || '').trim().slice(0, 500),
    estado: 'pendiente', fecha_visita: null, inspector_id: null, inspector_nombre: null, respuesta: null, created_at: ahora, updated_at: ahora };
  await db.guardar('solicitudes', s);
  await sync.encolar('solicitudes', 'upsert', s);
  await cargar();
  return s;
}

// Cambios de estado. El criador solo puede anular la suya mientras está abierta;
// inspección y administración programan la visita, la dan por realizada o la anulan.
export async function atenderSolicitud(id, { estado: nuevo, fecha_visita, respuesta }) {
  const p = estado.perfil;
  const s = estado.solicitudes.find(x => x.id === id);
  if (!p || !s) throw new Error('Solicitud no encontrada.');
  const auditor = esAuditor(p.rol);
  if (!auditor && (s.usuario_id !== p.id || nuevo !== 'anulada')) throw new Error('No autorizado.');
  if (!solicitudAbiertaEs(s)) throw new Error('La solicitud ya está cerrada.');
  if (!ESTADOS_SOLICITUD[nuevo] || nuevo === 'pendiente') throw new Error('Estado no válido.');
  if (nuevo === 'programada' && !/^\d{4}-\d{2}-\d{2}$/.test(String(fecha_visita || ''))) throw new Error('Indica la fecha de la visita.');
  if (nuevo === 'programada' && fecha_visita < s.created_at.slice(0, 10)) throw new Error('La visita no puede ser anterior a la solicitud.');
  const r = { ...s, estado: nuevo, updated_at: new Date().toISOString(),
    fecha_visita: nuevo === 'programada' || nuevo === 'realizada' ? (fecha_visita || s.fecha_visita || hoyIso()) : s.fecha_visita,
    respuesta: respuesta !== undefined ? String(respuesta || '').trim().slice(0, 500) || null : s.respuesta,
    ...(auditor ? { inspector_id: p.id, inspector_nombre: p.nombre || p.email } : {}) };
  await db.guardar('solicitudes', r);
  await sync.encolar('solicitudes', 'upsert', r);
  await cargar();
  return r;
}

// Qué ejemplares de la solicitud ya se han calificado desde que se pidió
export function progresoSolicitud(s) {
  const filas = s.animales.map(id => ({ id, a: estado.idx.get(id), calif: calificacionesDe(id).find(c => c.created_at >= s.created_at) || null }));
  return { filas, hechas: filas.filter(f => f.calif).length, total: filas.length };
}

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

// ---------------------------------------------------------------------------
// Baja de un usuario (RGPD, art. 17). La hace el servidor en una sola operación:
// borra sus datos personales y su cuenta, y conserva el Libro (sus ejemplares,
// calificaciones y puesta quedan a nombre del criador, sin contacto ni REGA).
// Solo con conexión: no se puede encolar porque es irreversible.
// ---------------------------------------------------------------------------
const CAMPOS_PERSONALES = ['email', 'telefono', 'numero_socio', 'rega', 'municipio', 'provincia', 'latitud', 'longitud'];
const servidor = (para) => {
  const c = obtenerCliente();
  if (!c || !navigator.onLine) throw new Error(`${para} necesita conexión con el Libro central. Inténtalo cuando tengas cobertura.`);
  return c;
};

export async function darDeBajaUsuario(perfilId) {
  if (rol() !== 'administrador') throw new Error('Solo un administrador puede dar de baja a un usuario.');
  if (perfilId === estado.perfil.id) throw new Error('No puedes darte de baja a ti mismo desde aquí.');
  const p = estado.perfiles.find(x => x.id === perfilId);
  if (!p) throw new Error('Usuario no encontrado.');
  const { data, error } = await servidor('La baja').rpc('dar_baja_usuario', { p_id: perfilId });
  if (error) throw new Error(error.message || String(error));
  const r = { perfil: data?.perfil || 'anonimizado', cuenta: data?.cuenta || 'pendiente', email: p.email || '' };
  if (r.perfil === 'borrado') await db.borrar('perfiles', perfilId);
  else await db.guardar('perfiles', { ...p, ...Object.fromEntries(CAMPOS_PERSONALES.map(k => [k, null])), baja: hoyIso(), updated_at: new Date().toISOString() });
  for (const s of estado.solicitudes.filter(x => x.usuario_id === perfilId)) await db.borrar('solicitudes', s.id);
  await cargar();
  return r;
}

// ---------------------------------------------------------------------------
// Material genético almacenado (Protocolo CNZ 2025, apdo. 3.1 m; RD 45/2019,
// arts. 3 n y 15). En aves no se conservan ovocitos ni embriones: semen y células
// germinales primordiales (PGC) son el germoplasma; ADN y células somáticas, otras
// colecciones (art. 15.4). Lo anota la administración.
// ---------------------------------------------------------------------------
export const TIPOS_GERMOPLASMA = Object.freeze({ semen: 'semen congelado', pgc: 'células germinales primordiales (PGC)', celulas: 'células somáticas', adn: 'ADN (sangre o plumas)' });
export const esGermoplasma = (tipo) => tipo === 'semen' || tipo === 'pgc';

export async function guardarGermoplasma(m) {
  if (rol() !== 'administrador') throw new Error('Solo la administración anota el material genético.');
  if (!TIPOS_GERMOPLASMA[m.tipo]) throw new Error('Elige el tipo de muestra.');
  const muestras = Number(m.muestras);
  if (!Number.isInteger(muestras) || muestras < 1) throw new Error('Indica cuántas muestras (dosis, pajuelas o tubos) hay.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(m.fecha || '')) || m.fecha > hoyIso()) throw new Error('Indica la fecha de recogida (no puede ser futura).');
  const centro = String(m.centro || '').trim();
  if (!centro) throw new Error('Indica el centro o banco donde se guarda.');
  let animalId = null;
  if (m.anilla) {
    const a = estado.todos.find(x => normalizarAnilla(x.anilla) === normalizarAnilla(m.anilla));
    if (!a) throw new Error(`No hay ningún ejemplar con la anilla ${m.anilla}.`);
    if (m.tipo === 'semen' && a.sexo !== 'M') throw new Error('El semen tiene que ser de un gallo.');
    animalId = a.id;
  }
  const ahora = new Date().toISOString();
  const previo = m.id ? estado.germoplasma.find(x => x.id === m.id) : null;
  const r = { id: m.id || uuid(), usuario_id: estado.perfil.id, animal_id: animalId, tipo: m.tipo, muestras, fecha: m.fecha, centro,
    centro_reconocido: Boolean(m.centro_reconocido), referencia: String(m.referencia || '').trim() || null, notas: String(m.notas || '').trim() || null,
    created_at: previo?.created_at || ahora, updated_at: ahora };
  await db.guardar('germoplasma', r);
  await sync.encolar('germoplasma', 'upsert', r);
  await cargar();
  return r;
}

export async function borrarGermoplasma(id) {
  if (rol() !== 'administrador') throw new Error('Solo la administración anota el material genético.');
  await db.borrar('germoplasma', id);
  await sync.encolar('germoplasma', 'delete', { id });
  await cargar();
}

export function resumenGermoplasma() {
  const lista = [...estado.germoplasma].sort((a, b) => b.fecha.localeCompare(a.fecha));
  const porTipo = Object.keys(TIPOS_GERMOPLASMA).map(t => {
    const de = lista.filter(x => x.tipo === t);
    return { tipo: t, nombre: TIPOS_GERMOPLASMA[t], registros: de.length, muestras: de.reduce((s, x) => s + x.muestras, 0),
      donantes: new Set(de.map(x => x.animal_id).filter(Boolean)).size };
  });
  const germo = lista.filter(x => esGermoplasma(x.tipo));
  return { lista, porTipo, germoplasma: germo.reduce((s, x) => s + x.muestras, 0),
    reconocido: germo.filter(x => x.centro_reconocido).reduce((s, x) => s + x.muestras, 0),
    donantes: new Set(germo.map(x => x.animal_id).filter(Boolean)).size };
}

// ---------------------------------------------------------------------------
// Historial de cambios del Libro (quién cambió qué y cuándo). Lo escriben los
// triggers del servidor; solo lo leen administración e inspección, y solo en línea.
// ---------------------------------------------------------------------------
export const TAM_HISTORIAL = 50;
const NOMBRES_CAMPO = {
  anilla: 'anilla', nombre: 'nombre', sexo: 'sexo', variedad: 'variedad', fecha_nacimiento: 'nacimiento', padre_id: 'padre', madre_id: 'madre',
  familia: 'familia', peso_g: 'peso', rfid: 'RFID', rega: 'REGA', municipio: 'municipio', provincia: 'provincia', latitud: 'ubicación', longitud: 'ubicación',
  estado: 'estado', baja_fecha: 'fecha de baja', baja_causa: 'causa de baja', seccion: 'sección del Libro', usuario_id: 'titular', criador_id: 'criador',
  notas: 'notas', rm_fecha: 'Registro de Méritos', rm_via: 'Registro de Méritos', rm_motivo: 'Registro de Méritos', rm_origen: 'Registro de Méritos'
};
const IGNORAR = new Set(['updated_at', 'sync_ts', 'created_at', 'fotos', 'fotos_fecha']);

export function cambiosHistorial(e) {
  if (e.operacion !== 'UPDATE' || !e.antes || !e.despues) return [];
  return Object.keys({ ...e.antes, ...e.despues })
    .filter(k => !IGNORAR.has(k) && JSON.stringify(e.antes[k] ?? null) !== JSON.stringify(e.despues[k] ?? null))
    .map(k => NOMBRES_CAMPO[k] || k.replace(/_/g, ' '))
    .filter((n, i, l) => l.indexOf(n) === i);
}

export function describirHistorial(e) {
  const fila = e.despues || e.antes || {};
  const nombrePerfil = (id) => estado.perfiles.find(p => p.id === id)?.nombre || null;
  const quien = e.usuario_id ? (nombrePerfil(e.usuario_id) || 'Usuario dado de baja') : 'El servidor';
  if (e.tabla === 'germoplasma') {
    const a = animal(fila.animal_id);
    const t = `${fila.muestras ?? ''} muestra(s) de ${TIPOS_GERMOPLASMA[fila.tipo] || fila.tipo || 'material genético'}${a ? ` de ${a.anilla}` : ''}`;
    return { quien, que: e.operacion === 'INSERT' ? `Anotó ${t}` : e.operacion === 'DELETE' ? `Borró ${t}` : `Cambió ${cambiosHistorial(e).join(', ') || 'el registro'} de ${t}`, enlace: '#/admin/germoplasma' };
  }
  if (e.tabla === 'calificaciones') {
    const a = animal(fila.animal_id);
    return { quien, que: `Calificó ${a ? a.anilla : 'un ejemplar'}${fila.total != null ? ` (${fila.total} puntos)` : ''}`, enlace: a ? `#/animal/${a.id}` : null };
  }
  const anilla = fila.anilla || animal(e.registro)?.anilla || 'un ejemplar';
  const enlace = animal(e.registro) ? `#/animal/${e.registro}` : null;
  if (e.operacion === 'INSERT') return { quien, que: `Alta de ${anilla}`, enlace };
  if (e.operacion === 'DELETE') return { quien, que: `Borró ${anilla}`, enlace: null };
  const c = cambiosHistorial(e);
  return { quien, que: c.length ? `Cambió ${c.join(', ')} de ${anilla}` : `Guardó ${anilla} sin cambios en el Libro`, enlace };
}

export async function historialServidor({ tabla = '', pagina = 0 } = {}) {
  if (!esAuditor(rol())) throw new Error('El historial solo lo pueden ver administración e inspección.');
  let q = servidor('El historial').from('historial').select('*');
  if (tabla) q = q.eq('tabla', tabla);
  const { data, error } = await q.order('fecha', { ascending: false }).order('id', { ascending: false })
    .range(pagina * TAM_HISTORIAL, pagina * TAM_HISTORIAL + TAM_HISTORIAL - 1);
  if (error) throw new Error(error.message || String(error));
  return data || [];
}

// ---------------------------------------------------------------------------
// Copia completa del Libro (administración): vuelve a bajar todo lo que el
// servidor le deja ver al administrador —que es todo— antes de hacer la copia.
// ---------------------------------------------------------------------------
export async function refrescarTodoDesdeServidor() {
  if (rol() !== 'administrador') throw new Error('Solo un administrador puede bajar el Libro completo.');
  servidor('Bajar el Libro completo');
  await sync.drenar();
  await sync.reiniciarMarcas(estado.perfil.id);
  const r = await sync.descargar(estado.perfil.id);
  if (r === false) throw new Error('No se pudo conectar con el Libro central.');
  await cargar();
  return r;
}

// ---------------------------------------------------------------------------
// Aviarios para el mapa (administración e inspección): cada criador con su ubicación
// y su censo activo. Los que no tienen ubicación se devuelven aparte.
// ---------------------------------------------------------------------------
export function aviarios() {
  if (!esAuditor(rol())) return { conUbicacion: [], sinUbicacion: [] };
  const porTitular = new Map();
  for (const a of estado.todos) {
    if (a.estado === 'baja') continue;
    const x = porTitular.get(a.usuario_id) || { machos: 0, hembras: 0, rd: 0, variedades: new Set() };
    x[a.sexo === 'M' ? 'machos' : 'hembras'] += 1;
    if (['RD', 'RM'].includes(a.seccion)) x.rd += 1;
    if (a.variedad) x.variedades.add(a.variedad);
    porTitular.set(a.usuario_id, x);
  }
  const lista = estado.perfiles.filter(p => !p.baja).map(p => {
    const c = porTitular.get(p.id) || { machos: 0, hembras: 0, rd: 0, variedades: new Set() };
    return { perfil: p, machos: c.machos, hembras: c.hembras, total: c.machos + c.hembras, rd: c.rd, variedades: [...c.variedades],
      lat: p.latitud != null ? Number(p.latitud) : null, lng: p.longitud != null ? Number(p.longitud) : null };
  });
  const ok = (x) => Number.isFinite(x.lat) && Number.isFinite(x.lng);
  return { conUbicacion: lista.filter(ok), sinUbicacion: lista.filter(x => !ok(x)) };
}

// GeoJSON de los aviarios (para QGIS, uMap o Google Earth). Lleva datos personales:
// solo para administración e inspección.
export function geojsonAviarios(lista) {
  return {
    type: 'FeatureCollection',
    features: lista.map(x => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [x.lng, x.lat] },
      properties: { criador: x.perfil.nombre || '', rega: x.perfil.rega || '', municipio: x.perfil.municipio || '', provincia: x.perfil.provincia || '',
        machos: x.machos, hembras: x.hembras, total: x.total, en_rd_o_rm: x.rd, variedades: x.variedades.join(', ') }
    }))
  };
}

// ---------------------------------------------------------------------------
// Panel de administración: lo que el administrador tiene pendiente, con el
// enlace que lleva a resolverlo. Solo informa; nunca cambia nada.
// ---------------------------------------------------------------------------
export const DIAS_ALTA_NUEVA = 30;
export const esAltaNueva = (u, hoy = hoyIso()) => Boolean(u?.created_at) &&
  (new Date(`${hoy}T12:00:00`) - new Date(u.created_at)) / 864e5 <= DIAS_ALTA_NUEVA;

export function tareasAdmin({ hoy = hoyIso() } = {}) {
  if (rol() !== 'administrador') return [];
  const t = [];
  const yo = estado.perfil.id;
  const otros = estado.perfiles.filter(u => u.id !== yo);
  const nuevos = otros.filter(u => esAltaNueva(u, hoy));
  if (nuevos.length) t.push({ nivel: 'hoy', icono: '👥', texto: `${nuevos.length} alta(s) nueva(s) en los últimos ${DIAS_ALTA_NUEVA} días`,
    sub: 'Comprueba que son socios del Club y, si hace falta, asígnales su rol', href: '#/usuarios?filtro=nuevos' });
  const pendientes = estado.solicitudes.filter(s => s.estado === 'pendiente');
  if (pendientes.length) t.push({ nivel: 'hoy', icono: '📞', texto: `${pendientes.length} solicitud(es) de inspección sin atender`,
    sub: 'Llama al criador y programa la visita', href: '#/inspecciones' });
  const inspectores = estado.perfiles.filter(u => u.rol === 'inspector');
  if (!inspectores.length) t.push({ nivel: pendientes.length ? 'hoy' : 'info', icono: '🛡️', texto: 'No hay ningún inspector nombrado',
    sub: 'Asigna el rol de Inspector a quien vaya a calificar en los aviarios', href: '#/usuarios' });
  const errores = auditarLibro({ hoy }).filter(x => x.nivel === 'error').length;
  if (errores) t.push({ nivel: 'hoy', icono: '🩺', texto: `${errores} error(es) en la auditoría del Libro`,
    sub: 'Incoherencias que hay que corregir antes de expedir certificados o cerrar el año', href: '#/auditoria' });
  const rm = candidatosRM().length;
  if (rm) t.push({ nivel: 'pronto', icono: '⭐', texto: `${rm} ejemplar(es) cumplen los requisitos del Registro de Méritos`,
    sub: 'Revísalos e inscríbelos si procede', href: '#/admin/libro' });
  const mes = Number(hoy.slice(5, 7));
  if (mes === 12 || mes === 1) t.push({ nivel: 'pronto', icono: '📄', texto: 'Cierre del año: acta anual del censo',
    sub: mes === 12 ? 'En enero, revisa la auditoría y genera el acta del año que termina' : 'Genera el acta del año pasado, imprímela y fírmala', href: '#/acta' });
  const aspirantes = otros.filter(u => u.rol === 'aspirante').length;
  if (aspirantes) t.push({ nivel: 'info', icono: '👥', texto: `${aspirantes} aspirante(s) sin REGA`,
    sub: 'Pasarán a Criador en cuanto añadan el REGA de su explotación en «Mi aviario»', href: '#/usuarios?rol=aspirante' });
  return t;
}

// ---------------------------------------------------------------------------
// Panel de inspección: llamadas, visitas de hoy y de la semana, y visitas que
// quedaron sin cerrar. Las de otro inspector no se cuentan como propias.
// ---------------------------------------------------------------------------
export function tareasInspector({ hoy = hoyIso() } = {}) {
  if (!esAuditor(rol())) return [];
  const yo = estado.perfil.id;
  const t = [];
  const quien = (s) => { const c = estado.perfiles.find(x => x.id === s.usuario_id); return `${c?.nombre || 'criador'}${c?.municipio ? ` (${c.municipio})` : ''}`; };
  const abiertas = solicitudesTodas().filter(solicitudAbiertaEs);
  const porLlamar = abiertas.filter(s => s.estado === 'pendiente');
  if (porLlamar.length) t.push({ nivel: 'hoy', icono: '📞', texto: `${porLlamar.length} solicitud(es) por llamar`,
    sub: 'Llama al criador, acordad el día y programa la visita', href: '#/inspecciones' });
  const mias = abiertas.filter(s => s.estado === 'programada' && s.fecha_visita && (!s.inspector_id || s.inspector_id === yo));
  for (const s of mias.filter(x => x.fecha_visita < hoy).sort((a, b) => a.fecha_visita.localeCompare(b.fecha_visita))) {
    t.push({ nivel: 'hoy', icono: '🩺', texto: `Visita del ${fechaCorta(s.fecha_visita)} sin cerrar: ${quien(s)}`,
      sub: 'Califica los ejemplares y márcala como realizada (o anúlala con el motivo)', href: '#/inspecciones' });
  }
  for (const s of mias.filter(x => x.fecha_visita >= hoy && x.fecha_visita <= sumaDias(hoy, 7)).sort((a, b) => a.fecha_visita.localeCompare(b.fecha_visita))) {
    t.push({ nivel: s.fecha_visita === hoy ? 'hoy' : 'pronto', icono: '🚗', texto: `Visita ${s.fecha_visita === hoy ? 'hoy' : `el ${fechaCorta(s.fecha_visita)}`}: ${quien(s)}`,
      sub: `${s.animales.length} ejemplar(es) por calificar`, href: '#/inspecciones' });
  }
  return t;
}
