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

  // Huevo: 55 a 70 g, cáscara blanco crema
  huevo: Object.freeze({ min: 55, max: 70, cascara: 'Blanco crema' }),

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
    RD: 'Registro Definitivo'
  }),

  // Familias para la rotación circular de Gobe
  familias: Object.freeze(['A', 'B', 'C', 'D', 'E'])
});

// Reglas del Club (no proceden del Estándar; ajustables por la Dirección Técnica)
export const REGLAS = Object.freeze({
  edadMinimaRD_dias: 180,            // Edad mínima para promocionar RN -> RD tras calificación Apto
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
  return Number.isFinite(g) && g >= ESTANDAR.huevo.min && g <= ESTANDAR.huevo.max && cascara === ESTANDAR.huevo.cascara;
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
  // Clases que se admiten en el Libro (en el modelo GANECA: EX, MB, B y R)
  clasesAptas: Object.freeze(['EX', 'MB', 'B', 'R']),
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
export function evaluarCalificacion({ sexo, variedad, pesoG, puntos = {}, defectos = [] }) {
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
  const apto = completa && BAREMO.clasesAptas.includes(clase.id);
  const motivos = [];
  graves.forEach(id => motivos.push(ESTANDAR.defectosGraves.find(d => d.id === id).texto));
  if (!graves.length && completa && !apto) motivos.push(`Puntuación inferior a ${BAREMO.clases.find(c => c.id === 'R').min}`);
  if (!v) motivos.push('Variedad no registrada');
  else if (!v.oficial) motivos.push(`Variedad «${v.nombre}» en proceso de reconocimiento`);
  return {
    completa, sinPuntuar, invalidos,
    total: Math.round(total * 2) / 2,
    clase: clase.id, claseNombre: clase.nombre,
    defectosGraves: graves,
    pesoConforme: pesoConforme(sexo, pesoG),
    resultado: apto ? 'Apto' : 'No apto',
    accedeRD: apto && Boolean(v?.oficial),
    motivos
  };
}
