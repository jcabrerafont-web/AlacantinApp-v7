// ============================================================================
// Genética: consanguinidad de Wright (método tabular exacto), parentesco,
// pedigrí, tamaño efectivo, integridad genealógica y rotación de Gobe.
// Funciones puras: sin DOM ni almacenamiento (probadas en tests/genetica.test.mjs).
// ============================================================================
import { ESTANDAR, REGLAS } from './estandar.js';

export const indice = (animales) => {
  const m = new Map();
  (animales || []).forEach(a => { if (a && a.id) m.set(a.id, a); });
  return m;
};

// Parentesco aditivo a(i,j) en el sub-pedigrí de las raíces, truncado a maxGen.
// Los individuos en la generación maxGen se tratan como fundadores.
function crearParentesco(raices, idx, maxGen) {
  const prof = new Map();
  const cola = raices.filter(Boolean).map(id => [id, 1]);
  while (cola.length) {
    const [id, g] = cola.shift();
    if (!idx.has(id) || g > maxGen) continue;
    if (prof.has(id) && prof.get(id) <= g) continue;
    prof.set(id, g);
    const a = idx.get(id);
    if (g < maxGen) {
      if (a.padre_id) cola.push([a.padre_id, g + 1]);
      if (a.madre_id) cola.push([a.madre_id, g + 1]);
    }
  }
  const padres = (id) => {
    const a = idx.get(id);
    const g = prof.get(id);
    if (!a || g === undefined || g >= maxGen) return [null, null];
    return [prof.has(a.padre_id) ? a.padre_id : null, prof.has(a.madre_id) ? a.madre_id : null];
  };
  const orden = new Map();
  const ordenDe = (id, pila = new Set()) => {
    if (!id) return -1;
    if (orden.has(id)) return orden.get(id);
    if (pila.has(id)) return 0; // ciclo por error de datos
    pila.add(id);
    const [s, d] = padres(id);
    const o = 1 + Math.max(ordenDe(s, pila), ordenDe(d, pila));
    pila.delete(id);
    orden.set(id, o);
    return o;
  };
  const memo = new Map();
  const enCurso = new Set();
  const a = (i, j) => {
    if (!i || !j) return 0;
    const k = i < j ? `${i}|${j}` : `${j}|${i}`;
    if (memo.has(k)) return memo.get(k);
    if (enCurso.has(k)) return 0;
    enCurso.add(k);
    let r;
    if (i === j) {
      const [s, d] = padres(i);
      r = 1 + 0.5 * a(s, d);
    } else {
      const [x, y] = ordenDe(i) >= ordenDe(j) ? [i, j] : [j, i]; // recurrir sobre el más joven
      const [s, d] = padres(x);
      r = 0.5 * (a(y, s) + a(y, d));
    }
    enCurso.delete(k);
    memo.set(k, r);
    return r;
  };
  return a;
}

// Memoria de resultados por índice genealógico. Si la genealogía no cambia entre dos
// cargas (p. ej. al guardar un huevo), datos.js pasa la memoria al índice nuevo.
const memorias = new WeakMap();
const memoria = (idx) => { let m = memorias.get(idx); if (!m) { m = new Map(); memorias.set(idx, m); } return m; };
export function heredarMemoria(idxViejo, idxNuevo) { if (idxViejo && memorias.has(idxViejo)) memorias.set(idxNuevo, memorias.get(idxViejo)); }

/** Fx del descendiente de padreId × madreId: Fx = a(P,M)/2 (Wright, 5 generaciones por defecto). */
export function fxDescendencia(padreId, madreId, animalesOIndice, maxGen = REGLAS.generacionesWright) {
  if (!padreId || !madreId || padreId === madreId) return 0;
  const conMemoria = animalesOIndice instanceof Map;
  const idx = conMemoria ? animalesOIndice : indice(animalesOIndice);
  const clave = `fx|${padreId}|${madreId}|${maxGen}`;
  if (conMemoria && memoria(idx).has(clave)) return memoria(idx).get(clave);
  const a = crearParentesco([padreId, madreId], idx, maxGen);
  const fx = Math.min(1, Math.max(0, a(padreId, madreId) / 2));
  if (conMemoria) memoria(idx).set(clave, fx);
  return fx;
}

export const fxAnimal = (animal, idx, maxGen) =>
  animal?.padre_id && animal?.madre_id ? fxDescendencia(animal.padre_id, animal.madre_id, idx, maxGen) : 0;

export function nivelFx(fx) {
  if (fx >= REGLAS.fxAlerta) return { nivel: 'alerta', texto: 'Consanguinidad elevada' };
  if (fx >= REGLAS.fxPrecaucion) return { nivel: 'precaucion', texto: 'Precaución' };
  return { nivel: 'ok', texto: fx > 0 ? 'Baja' : 'Nula' };
}

/** Ancestros hasta maxGen: [{ id, generacion, ruta }] (ruta: 'P', 'PM', ...) */
export function ancestros(animalId, idx, maxGen = REGLAS.generacionesWright) {
  const out = [];
  const visitar = (id, g, ruta) => {
    const a = idx.get(id);
    if (!a || g >= maxGen) return;
    if (a.padre_id) { out.push({ id: a.padre_id, generacion: g + 1, ruta: ruta + 'P' }); visitar(a.padre_id, g + 1, ruta + 'P'); }
    if (a.madre_id) { out.push({ id: a.madre_id, generacion: g + 1, ruta: ruta + 'M' }); visitar(a.madre_id, g + 1, ruta + 'M'); }
  };
  visitar(animalId, 0, '');
  return out;
}

/** Ancestros comunes de dos individuos (informativo; el valor de Fx es el tabular). */
export function ancestrosComunes(idA, idB, idx, maxGen = REGLAS.generacionesWright) {
  const setA = new Set([idA, ...ancestros(idA, idx, maxGen).map(x => x.id)]);
  const setB = new Set([idB, ...ancestros(idB, idx, maxGen).map(x => x.id)]);
  return [...setA].filter(id => setB.has(id) && idx.has(id));
}

/**
 * Integridad del pedigrí (equivalentes de generaciones conocidas, Maignel et al. 1996):
 * Σ (1/2)^g sobre todos los ancestros conocidos hasta maxGen.
 */
export function generacionesEquivalentes(animalId, idx, maxGen = REGLAS.generacionesWright) {
  const clave = `ge|${animalId}|${maxGen}`;
  const m = idx instanceof Map ? memoria(idx) : null;
  if (m?.has(clave)) return m.get(clave);
  const ge = ancestros(animalId, idx, maxGen).reduce((s, x) => s + Math.pow(0.5, x.generacion), 0);
  m?.set(clave, ge);
  return ge;
}

/**
 * Pureza de variedad (RD 45/2019, art. 3 b; Protocolo CNZ 2025, variedades): una variedad
 * exige aislamiento reproductivo durante al menos 5 generaciones.
 * - generacionesPuras: generaciones seguidas (1, 2, 3…) con TODOS los ancestros conocidos y de la misma variedad.
 * - conocidos: ancestros conocidos, ponderados por (1/2)^g, sobre el máximo posible (1 = pedigrí completo).
 * - misma: de lo conocido, parte ponderada de la misma variedad (null si no hay ancestros).
 * - otras: otras variedades encontradas, con la generación más cercana.
 */
export function purezaVariedad(animalId, idx, maxGen = REGLAS.generacionesVariedad) {
  const a = idx.get(animalId);
  if (!a) return null;
  const porGen = Array.from({ length: maxGen }, (_, i) => ({ generacion: i + 1, esperados: 2 ** (i + 1), conocidos: 0, mismos: 0 }));
  let pesoConocido = 0, pesoMismo = 0;
  const otras = new Map();
  for (const x of ancestros(animalId, idx, maxGen)) {
    const b = idx.get(x.id);
    if (!b) continue;                                   // registro no visible: cuenta como desconocido
    const g = porGen[x.generacion - 1];
    const w = 0.5 ** x.generacion;
    g.conocidos++; pesoConocido += w;
    if (b.variedad === a.variedad) { g.mismos++; pesoMismo += w; }
    else if (!otras.has(b.variedad) || otras.get(b.variedad) > x.generacion) otras.set(b.variedad, x.generacion);
  }
  let generacionesPuras = 0;
  for (const g of porGen) { if (g.conocidos === g.esperados && g.mismos === g.esperados) generacionesPuras++; else break; }
  return { variedad: a.variedad, generacionesPuras, porGen, conocidos: pesoConocido / maxGen, misma: pesoConocido ? pesoMismo / pesoConocido : null,
    otras: [...otras].map(([variedad, generacion]) => ({ variedad, generacion })).sort((p, q) => p.generacion - q.generacion) };
}

/** Ne demográfico (Wright, 1931): 4·Nm·Nf / (Nm + Nf) */
export function neDemografico(nMachos, nHembras) {
  const t = nMachos + nHembras;
  return t > 0 ? (4 * nMachos * nHembras) / t : 0;
}

/** Ne a partir del incremento individual de consanguinidad (Gutiérrez et al. 2008, simplificado):
 *  ΔFi = 1 - (1 - Fi)^(1/(t-1)), t = generaciones equivalentes; Ne = 1 / (2·media ΔFi). */
export function neRealizado(animales, idx, maxGen = REGLAS.generacionesWright) {
  const deltas = [];
  for (const a of animales) {
    const t = generacionesEquivalentes(a.id, idx, maxGen);
    if (t <= 1) continue;
    const f = fxAnimal(a, idx, maxGen);
    deltas.push(1 - Math.pow(1 - f, 1 / (t - 1)));
  }
  if (deltas.length === 0) return null;
  const media = deltas.reduce((s, d) => s + d, 0) / deltas.length;
  return media > 0 ? { ne: 1 / (2 * media), n: deltas.length } : { ne: Infinity, n: deltas.length };
}

/** Orden topológico (Kahn): progenitores antes que su descendencia. */
export function ordenTopologico(animales) {
  const porId = indice(animales);
  const hijos = new Map();
  const grado = new Map();
  animales.forEach(a => {
    const ps = [a.padre_id, a.madre_id].filter(p => p && porId.has(p));
    grado.set(a.id, ps.length);
    ps.forEach(p => { if (!hijos.has(p)) hijos.set(p, []); hijos.get(p).push(a.id); });
  });
  const cola = animales.map(a => a.id).filter(id => grado.get(id) === 0);
  const out = [];
  while (cola.length) {
    const id = cola.shift();
    out.push(porId.get(id));
    (hijos.get(id) || []).forEach(h => { grado.set(h, grado.get(h) - 1); if (grado.get(h) === 0) cola.push(h); });
  }
  if (out.length !== animales.length) animales.forEach(a => { if (!out.includes(a)) out.push(a); });
  return out;
}

/**
 * Animales que forman parte de un ciclo genealógico, en una sola pasada por todo el Libro.
 * Lo que sobra al ordenar de padres a hijos son los ciclos y sus descendientes; lo que sobra
 * al ordenar de hijos a padres, los ciclos y sus ancestros. Lo común a ambos: los ciclos.
 */
export function animalesEnCiclo(animales) {
  const porId = indice(animales);
  const sobrantes = (aristas) => {
    const sig = new Map(), grado = new Map(animales.map(a => [a.id, 0]));
    for (const [de, a] of aristas) { if (!sig.has(de)) sig.set(de, []); sig.get(de).push(a); grado.set(a, grado.get(a) + 1); }
    const cola = [...grado].filter(([, g]) => g === 0).map(([id]) => id);
    for (let i = 0; i < cola.length; i++) for (const h of sig.get(cola[i]) || []) { grado.set(h, grado.get(h) - 1); if (grado.get(h) === 0) cola.push(h); }
    const fuera = new Set(cola);
    return new Set(animales.map(a => a.id).filter(id => !fuera.has(id)));
  };
  const aristas = animales.flatMap(a => [a.padre_id, a.madre_id].filter(p => p && porId.has(p)).map(p => [p, a.id]));
  const haciaAbajo = sobrantes(aristas);
  if (!haciaAbajo.size) return haciaAbajo;
  const haciaArriba = sobrantes(aristas.map(([p, h]) => [h, p]));
  return new Set([...haciaAbajo].filter(id => haciaArriba.has(id)));
}

/** Detecta ciclos genealógicos (un animal que es ancestro de sí mismo). */
export function creaCiclo(animalId, padreId, madreId, idx) {
  for (const p of [padreId, madreId]) {
    if (!p) continue;
    if (p === animalId) return true;
    if (ancestros(p, idx, 50).some(x => x.id === animalId)) return true;
  }
  return false;
}

/**
 * Rotación circular de Gobe: el gallo de la familia N cubre a las gallinas de la
 * familia N+1 (A→B→C→D→E→A). Devuelve la familia de la que debe proceder el gallo.
 */
export function familiaGalloGobe(familiaHembras) {
  const f = ESTANDAR.familias;
  const i = f.indexOf(familiaHembras);
  return i < 0 ? null : f[(i - 1 + f.length) % f.length];
}

/** La descendencia hereda la familia de la madre (convención del método de Gobe). */
export const familiaDescendencia = (madre) => madre?.familia || null;
