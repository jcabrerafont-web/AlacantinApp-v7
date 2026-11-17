// ============================================================================
// ESTÁNDAR OFICIAL DE LA RAZA ALACANTINA · Código ESGA025 · Revisión 20/03/2025
// Única fuente de verdad de la app. Los textos reproducen el documento oficial
// (docs/Estandar-Alacantina2025.pdf). No añadir criterios que no figuren en él:
// si el Club aprueba cambios, se actualiza este archivo y la fecha de revisión.
// ============================================================================

export const ESTANDAR = Object.freeze({
  raza: 'Alacantina',
  codigo: 'ESGA025',
  revision: '20/03/2025',
  origen: 'Alicante / España',
  impresionGeneral:
    'Tipo esbelto, talla alta y de porte erguido. Tronco triangular, con la cabeza más alta que la cola, pecho plano y cola llevada alta.',

  // Pesos en gramos (Gallo 3,000–3,500 kg · Gallina 2,200–2,600 kg)
  peso: Object.freeze({
    M: Object.freeze({ min: 3000, max: 3500 }),
    H: Object.freeze({ min: 2200, max: 2600 })
  }),

  // Diámetro de las anillas (mm)
  anilla: Object.freeze({ M: 20, H: 18 }),

  // Huevo: el Estándar da 55–70 g como rango habitual y 55 g como mínimo.
  // Criterio del Club: apto desde 55 g, sin límite superior (más de 70 g solo se señala).
  huevo: Object.freeze({ min: 55, habitualMax: 70, cascara: 'Blanco crema' }),

  // Variedades (denominación en femenino). Solo las oficiales del Estándar
  // pueden acceder al Registro Definitivo; las "en proceso" se registran
  // para su seguimiento genealógico (art. 3.3 Protocolo CNZ 5/6/2025).
  variedades: Object.freeze([
    Object.freeze({ id: 'negra-moteada', nombre: 'Negra moteada', oficial: true, flameadoDescalifica: true,
      detalle: 'Tarsos blanco rosáceo con roña, pico de color córneo con manchas negras y la mandíbula superior más oscura que la inferior.' }),
    Object.freeze({ id: 'pinta', nombre: 'Pinta o exchequer', oficial: true, flameadoDescalifica: true,
      detalle: 'Tarsos blanco rosáceo con roña, pico de color córneo con manchas negras y la mandíbula superior más oscura que la inferior.' }),
    Object.freeze({ id: 'blanca', nombre: 'Blanca', oficial: true, flameadoDescalifica: false,
      detalle: 'Tarsos blanco rosáceo y pico color hueso.' }),
    Object.freeze({ id: 'arminada', nombre: 'Armiñada', oficial: false, flameadoDescalifica: false,
      detalle: 'En proceso de reconocimiento: sin descripción oficial en el Estándar.' }),
    Object.freeze({ id: 'milflores', nombre: 'Milflores', oficial: false, flameadoDescalifica: false,
      detalle: 'En proceso de reconocimiento: sin descripción oficial en el Estándar.' })
  ]),

  // Defectos graves en la raza (texto oficial)
  defectosGraves: Object.freeze([
    Object.freeze({ id: 'orejilla', texto: 'Orejilla amarilla, roja o con exceso de rojo' }),
    Object.freeze({ id: 'pecho', texto: 'Pecho prominente' }),
    Object.freeze({ id: 'cola', texto: 'Cola baja o larga' }),
    Object.freeze({ id: 'flameado', texto: 'Flameado de esclavina en variedades moteado y exchequer', soloVariedadesFlameado: true }),
    Object.freeze({ id: 'tarsos', texto: 'Tarsos amarillos' })
  ]),

  // 12 regiones de la ficha de conformidad / guía de campo, agrupando
  // literalmente los apartados del Estándar (gallo · diferencias de la gallina).
  regiones: Object.freeze([
    { id: 'tronco', nombre: 'Impresión general y tronco',
      gallo: 'Tipo esbelto, talla alta y porte erguido. Tronco esbelto, largo y en forma de triángulo.',
      gallina: 'Mismas características, teniendo en cuenta las diferencias sexuales.', defectos: [] },
    { id: 'cabeza', nombre: 'Cabeza, cara, ojos y pico',
      gallo: 'Cabeza grande en conjunto por el tamaño de cresta y barbillas; cráneo moderadamente grande, ancho y largo. Cara lisa y roja. Ojos grandes, iris anaranjado. Pico medio y ligeramente curvado.',
      gallina: 'Mismas características, teniendo en cuenta las diferencias sexuales.', defectos: [] },
    { id: 'cresta', nombre: 'Cresta',
      gallo: 'Sencilla y derecha, con 5/6 dientes bien definidos y largos, grande, con el lóbulo siguiendo la línea de la nuca sin tocarla, roja.',
      gallina: 'Sencilla, de tamaño mediano y caída hacia un lado sin que llegue a tapar el ojo.', defectos: [] },
    { id: 'barbillas', nombre: 'Barbillas',
      gallo: 'Grandes o muy grandes, largas y de color rojo.',
      gallina: 'Medianas.', defectos: [] },
    { id: 'orejillas', nombre: 'Orejillas',
      gallo: 'Ovaladas, de tamaño medio y blancas.',
      gallina: 'Ovaladas, de tamaño medio y blancas.', defectos: ['orejilla'] },
    { id: 'cuello', nombre: 'Cuello y esclavina',
      gallo: 'Largo, con la cabeza por encima de la cola, erguido y con esclavina hasta el dorso, sin cubrir hombros.',
      gallina: 'Mismas características, teniendo en cuenta las diferencias sexuales.', defectos: ['flameado'] },
    { id: 'dorso', nombre: 'Dorso',
      gallo: 'Largo, de anchura media e inclinado desde los hombros hasta la cola, recto y formando un ángulo de 40º con la horizontal.',
      gallina: 'Ligeramente inclinado u horizontal.', defectos: [] },
    { id: 'alas', nombre: 'Alas',
      gallo: 'Grandes, plegadas y ceñidas al cuerpo en línea paralela al dorso.',
      gallina: 'Mismas características, teniendo en cuenta las diferencias sexuales.', defectos: [] },
    { id: 'pecho', nombre: 'Pecho y abdomen',
      gallo: 'Pecho no prominente, recto. Abdomen poco desarrollado.',
      gallina: 'Pecho algo más prominente que el gallo. Abdomen más desarrollado.', defectos: ['pecho'] },
    { id: 'cola', nombre: 'Cola',
      gallo: 'Tamaño medio, muy alta, llevada a 70º con respecto a la horizontal.',
      gallina: 'Llevada algo más baja que el gallo y más abierta.', defectos: ['cola'] },
    { id: 'extremidades', nombre: 'Muslos, tarsos y dedos',
      gallo: 'Muslos largos y muy visibles. Tarsos semiflexionados, largos, lisos y libres de plumas; color según variedad. Cuatro dedos.',
      gallina: 'Muslos más cortos y menos visibles que el gallo.', defectos: ['tarsos'] },
    { id: 'plumaje', nombre: 'Plumaje y variedad',
      gallo: 'Plumaje ceñido. Color, tarsos y pico conformes a la descripción de la variedad.',
      gallina: 'Plumaje ceñido. Color, tarsos y pico conformes a la descripción de la variedad.', defectos: [] }
  ].map(r => Object.freeze({ ...r, defectos: Object.freeze(r.defectos) }))),

  // Secciones del Libro Genealógico
  secciones: Object.freeze({
    RN: 'Registro de Nacimientos',
    RF: 'Registro Fundacional',
    RA: 'Registro Auxiliar',
    RD: 'Registro Definitivo',
    RM: 'Registro de Méritos'
  }),

  // Familias para la rotación circular de Gobe
  familias: Object.freeze(['A', 'B', 'C', 'D', 'E'])
});

// Reglas del Club (no proceden del Estándar; ajustables por la Dirección Técnica)
export const REGLAS = Object.freeze({
  // Paso RN -> RD, equiparado a la reglamentación del LG de la Castellana Negra
  // (anexo I, A.6): un año de edad y 65 puntos las gallinas / 70 los gallos.
  edadMinimaRD_meses: 12,
  puntosMinimosApto: Object.freeze({ H: 65, M: 70 }),
  // Registro de Méritos: equiparado a la reglamentación oficial del LG de la
  // Castellana Negra (anexo I, apdo. A.7): reproductores sobresalientes del RF o
  // RD, a propuesta de la asociación y con acuerdo de la comisión del Libro.
  // Vía alternativa (reglamento del LG de la Gallina del Sobrarbe, 2.4): premio
  // en feria, concurso o exposición, con calificación igualmente alta.
  rm: Object.freeze({
    seccionesOrigen: Object.freeze(['RF', 'RD']),
    H: Object.freeze({ puntos: 80, hijosRD: 3 }),
    M: Object.freeze({ puntos: 85, hijosRD: 10 })
  }),
  // Control de puesta por campañas (modelo del programa de conservación de la
  // Castellana Negra, manual GANECA): 15 días por gallina, 3 ciclos por temporada
  // repartidos entre febrero y junio.
  // Resultados en tres criterios paralelos: puesta (cantidad), peso medio (tamaño;
  // mínimo de huevos para que cuente) y masa de huevo (g/día = puesta × peso medio).
  // La madre propuesta del gallo de reposición sale de criterioMadre.
  controlPuesta: Object.freeze({ dias: 15, ciclos: 3, mesInicio: 2, mesFin: 6, minHuevosPeso: 5, criterioMadre: 'masa' }),
  generacionesWright: 5,             // Profundidad del cálculo de consanguinidad
  fxPrecaucion: 0.0625,              // 6,25 %: equivalente a primos hermanos
  fxAlerta: 0.125,                   // 12,5 %: equivalente a medio hermanos
  tramosEdadMeses: Object.freeze([   // Tramos del informe de censo (Protocolo CNZ 3.1.f)
    Object.freeze({ id: 'pollito', nombre: 'Pollito (< 6 meses)', hasta: 6 }),
    Object.freeze({ id: 'joven', nombre: 'Joven (6–12 meses)', hasta: 12 }),
    Object.freeze({ id: 'adulto', nombre: 'Adulto (> 12 meses)', hasta: Infinity })
  ])
});

export const variedadPorId = (id) => ESTANDAR.variedades.find(v => v.id === id) || null;
export const nombreVariedad = (id) => variedadPorId(id)?.nombre || id || '—';
export const sexoTexto = (s) => (s === 'M' ? 'Gallo' : s === 'H' ? 'Gallina' : '—');

export function pesoConforme(sexo, gramos) {
  const r = ESTANDAR.peso[sexo];
  const g = Number(gramos);
  if (!r || !Number.isFinite(g) || g <= 0) return null;
  return g >= r.min && g <= r.max;
}

export function huevoApto(gramos, cascara) {
  const g = Number(gramos);
  return Number.isFinite(g) && g >= ESTANDAR.huevo.min && cascara === ESTANDAR.huevo.cascara;
}

// Por encima del rango habitual del Estándar (no descalifica: solo se señala)
export const huevoGrande = (gramos) => Number(gramos) > ESTANDAR.huevo.habitualMax;

// 'AAAA-MM-DD' + n meses -> 'AAAA-MM-DD'
export function sumarMeses(fechaISO, n) {
  const [y, m, d] = fechaISO.split('-').map(Number);
  const f = new Date(Date.UTC(y, m - 1 + n, d));
  return f.toISOString().slice(0, 10);
}

export function edadMeses(fechaNacimiento, hoy = new Date()) {
  if (!fechaNacimiento) return null;
  const n = new Date(`${fechaNacimiento}T00:00:00`);
  if (Number.isNaN(n.getTime())) return null;
  let m = (hoy.getFullYear() - n.getFullYear()) * 12 + (hoy.getMonth() - n.getMonth());
  if (hoy.getDate() < n.getDate()) m -= 1;
  return Math.max(0, m);
}

export function tramoEdad(fechaNacimiento, hoy = new Date()) {
  const m = edadMeses(fechaNacimiento, hoy);
  if (m === null) return null;
  return REGLAS.tramosEdadMeses.find(t => m < t.hasta) || REGLAS.tramosEdadMeses.at(-1);
}

// ============================================================================
// BAREMO DE CALIFICACIÓN MORFOLÓGICA DE LA ALACANTINA — PROPUESTA
// El Estándar ESGA025 no fija baremo. Se puntúan sobre 100 las 12 regiones en
// que se agrupa el Estándar, con más peso en lo que define la impresión general
// de la raza y en las regiones de los defectos graves. Precedente de método:
// programa de cría de la Castellana Negra (BOE 15/02/2019).
// Pendiente de ratificar por la Dirección Técnica del Libro Genealógico.
// Si cambia un máximo, actualizar también baremo_maximos() en supabase/schema.sql.
// ============================================================================
const MAXIMOS = Object.freeze({
  tronco: 15,       // Impresión general y tronco: esbelto, talla alta, porte erguido, triangular
  cabeza: 6,
  cresta: 10,
  barbillas: 5,
  orejillas: 10,    // defecto grave: orejilla amarilla o roja
  cuello: 6,        // defecto grave: flameado (moteada, exchequer)
  dorso: 8,
  alas: 4,
  pecho: 10,        // defecto grave: pecho prominente
  cola: 10,         // defecto grave: cola baja o larga
  extremidades: 6,  // defecto grave: tarsos amarillos
  plumaje: 10       // color según la variedad
});
export const BAREMO = Object.freeze({
  estado: 'propuesta',
  fuente: 'Baremo propuesto para la Alacantina sobre las 12 regiones del Estándar ESGA025, pendiente de ratificar por la Dirección Técnica',
  apartados: Object.freeze(ESTANDAR.regiones.map(r => Object.freeze({ ...r, max: MAXIMOS[r.id] }))),
  // Clases por puntuación total (límite inferior incluido)
  clases: Object.freeze([
    Object.freeze({ id: 'EX', nombre: 'Excelente', min: 90 }),
    Object.freeze({ id: 'MB', nombre: 'Muy bueno', min: 80 }),
    Object.freeze({ id: 'B', nombre: 'Bueno', min: 70 }),
    Object.freeze({ id: 'R', nombre: 'Regular', min: 65 }),
    Object.freeze({ id: 'I', nombre: 'Insuficiente', min: 0 })
  ]),
  descalificado: Object.freeze({ id: 'D', nombre: 'Descalificado' }),
  paso: 0.5
});

export const claseDe = (total) => BAREMO.clases.find(c => total >= c.min) || BAREMO.clases.at(-1);
export const nombreClase = (id) => (id === 'D' ? BAREMO.descalificado.nombre : BAREMO.clases.find(c => c.id === id)?.nombre || id || '—');

// Normaliza una puntuación: número entre 0 y max, en pasos de 0,5. null si no es válida.
export function puntoValido(valor, max) {
  const n = typeof valor === 'string' ? Number(valor.replace(',', '.')) : Number(valor);
  if (valor === '' || valor === null || valor === undefined || !Number.isFinite(n)) return null;
  if (n < 0 || n > max || Math.round(n / BAREMO.paso) * BAREMO.paso !== n) return null;
  return n;
}

// Evalúa una calificación morfológica.
// puntos: { [apartadoId]: number }   defectos: ids de defectos graves observados
export function evaluarCalificacion({ sexo, variedad, pesoG, fechaNacimiento, puntos = {}, defectos = [], hoy = new Date() }) {
  const v = variedadPorId(variedad);
  const graves = [...new Set(defectos)].filter(id => {
    const d = ESTANDAR.defectosGraves.find(x => x.id === id);
    if (!d) return false;
    return !(d.soloVariedadesFlameado && !v?.flameadoDescalifica);
  });
  const invalidos = [];
  const sinPuntuar = [];
  let total = 0;
  for (const a of BAREMO.apartados) {
    const bruto = puntos[a.id];
    if (bruto === undefined || bruto === null || bruto === '') { sinPuntuar.push(a.id); continue; }
    const n = puntoValido(bruto, a.max);
    if (n === null) invalidos.push(a.id); else total += n;
  }
  const completa = sinPuntuar.length === 0 && invalidos.length === 0;
  const clase = graves.length ? BAREMO.descalificado : claseDe(total);
  const minimo = REGLAS.puntosMinimosApto[sexo] ?? REGLAS.puntosMinimosApto.M;
  const apto = completa && clase.id !== 'D' && total >= minimo;
  const meses = edadMeses(fechaNacimiento, hoy);
  const cumpleEdad = meses !== null && meses >= REGLAS.edadMinimaRD_meses;
  const fechaEdadRD = fechaNacimiento ? sumarMeses(fechaNacimiento, REGLAS.edadMinimaRD_meses) : null;
  const motivos = [];
  graves.forEach(id => motivos.push(ESTANDAR.defectosGraves.find(d => d.id === id).texto));
  if (!graves.length && completa && !apto) motivos.push(`Menos de ${minimo} puntos (mínimo para ${sexo === 'H' ? 'gallinas' : 'gallos'})`);
  if (!v) motivos.push('Variedad no registrada');
  else if (!v.oficial) motivos.push(`Variedad «${v.nombre}» en proceso de reconocimiento`);
  if (apto && v?.oficial && !cumpleEdad && fechaEdadRD) motivos.push(`Sin acceso a RD hasta cumplir un año (${fechaEdadRD.split('-').reverse().join('/')}): habrá que calificarlo de nuevo`);
  return {
    completa, sinPuntuar, invalidos,
    total: Math.round(total * 2) / 2,
    clase: clase.id, claseNombre: clase.nombre,
    defectosGraves: graves,
    pesoConforme: pesoConforme(sexo, pesoG),
    resultado: apto ? 'Apto' : 'No apto',
    minimo, cumpleEdad, fechaEdadRD,
    accedeRD: apto && Boolean(v?.oficial) && cumpleEdad,
    motivos
  };
}

// ============================================================================
// ANILLA OFICIAL EE (suministrada por FESACOCUR)
// Código del Libro Genealógico = E + año de nacimiento (2 dígitos) + diámetro (mm)
// + número de anilla completado con ceros hasta 6 cifras. Ej.: E2620000123.
// Diámetros del Estándar ESGA025: gallo 20, gallina 18. Si el pie no admite la
// anilla del Estándar se acepta el diámetro inmediatamente superior (+2 mm), con aviso.
// ============================================================================
export const ANILLA = Object.freeze({
  pais: 'E',
  patron: /^E(\d{2})(\d{2})(\d{6})$/,
  diametrosAdmitidos: Object.freeze({ M: Object.freeze([20, 22]), H: Object.freeze([18, 20]) })
});

export const normalizarAnilla = (txt) => String(txt ?? '').toUpperCase().replace(/[\s.\-]/g, '');

export function componerAnilla({ anio, diametro, numero }) {
  const n = String(numero ?? '').replace(/\D/g, '');
  const yy = String(anio ?? '').slice(-2);
  const d = String(diametro ?? '');
  if (!/^\d{2}$/.test(yy) || !/^\d{2}$/.test(d) || !n || n.length > 6 || Number(n) === 0) return null;
  return `${ANILLA.pais}${yy}${d}${n.padStart(6, '0')}`;
}

export function parsearAnilla(codigo) {
  const m = ANILLA.patron.exec(normalizarAnilla(codigo));
  if (!m || Number(m[3]) === 0) return null;
  return { anio2: m[1], diametro: Number(m[2]), numero: m[3] };
}

// "E2620000123" -> "E 26 20 000123" (lectura humana)
export const anillaLegible = (codigo) => {
  const p = parsearAnilla(codigo);
  return p ? `E ${p.anio2} ${String(p.diametro).padStart(2, '0')} ${p.numero}` : String(codigo ?? '');
};

// Errores (bloquean) y avisos (no bloquean) de una anilla para un ejemplar
export function comprobarAnilla(codigo, { sexo, fechaNacimiento } = {}) {
  const errores = []; const avisos = [];
  const p = parsearAnilla(codigo);
  if (!p) { errores.push('La anilla debe ser oficial EE: E + año + diámetro + número (p. ej. E2620000123).'); return { errores, avisos, partes: null }; }
  if (fechaNacimiento && fechaNacimiento.slice(2, 4) !== p.anio2) {
    errores.push(`El año de la anilla (${p.anio2}) no coincide con el año de nacimiento (${fechaNacimiento.slice(0, 4)}).`);
  }
  const admitidos = ANILLA.diametrosAdmitidos[sexo];
  if (admitidos && !admitidos.includes(p.diametro)) {
    errores.push(`Diámetro ${p.diametro} mm no admitido para ${sexo === 'M' ? 'gallo' : 'gallina'} (Estándar: ${ESTANDAR.anilla[sexo]} mm).`);
  } else if (admitidos && p.diametro !== ESTANDAR.anilla[sexo]) {
    avisos.push(`Diámetro ${p.diametro} mm, distinto del Estándar (${ESTANDAR.anilla[sexo]} mm).`);
  }
  return { errores, avisos, partes: p };
}
