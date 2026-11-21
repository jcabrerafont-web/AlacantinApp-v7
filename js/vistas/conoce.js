// La Alacantina y su Club: los textos para conocer la raza (historia, el Club y el
// Libro Genealógico). Pública, sin cuenta. El Estándar queda solo con el Estándar.
import { CONFIG } from '../config.js';
import { ESTANDAR, REGLAS } from '../estandar.js';
import { h, html, pintar } from '../ui.js';
import { icono } from '../iconos.js';

// Historia de la raza: resumen del documento del Club «Historia y recuperación de la
// gallina alacantina» (Protocolo CNZ 2025, apdo. 3.1 b). Aprobado por el Club el 21/11/2026.
const HISTORIA = [
  ['Antes de su desaparición', [
    'En 1905, la revista <em>La Avicultura Práctica</em>, de Salvador Castelló, ya citaba la gallina alicantina como raza ponedora regional.',
    'Fernando Orozco recordaba en 1987 que Joaquín Ferrán, de Valencia, había seleccionado las alicantinas blancas, llamadas también «blanqueñas». En 1989, en su libro <em>Razas de Gallinas Españolas</em>, la dio por desaparecida.'
  ]],
  ['Redescubrimiento (1999–2011)', [
    'En 1999, el Grupo Naturalista Heliaca de Monóvar encontró gallinas de la raza en una casa de campo de Monóvar. Julio Díez Moltó, de Aspe, las reconoció como iguales a un núcleo que él conservaba desde los años sesenta.',
    'Orozco confirmó por fotografías que eran alicantinas y los puso en contacto con Amadeu Francesch, del IRTA, que asesoró la caracterización de la raza desde 2004.',
    'Se localizaron otros núcleos en l’Alcoià, el Vinalopó Mitjà y el Baix Vinalopó: unos 15 gallos y 50 gallinas «afabades», las actuales negra moteada y exchequer, además de las «pintadas», hoy milflores.'
  ]],
  ['Primera asociación (2011–2016)', [
    'En 2011 se inscribió la Asociación de Criadores de Gallinas de Raza Alicantina. Aprobó el primer patrón racial, organizó exposiciones monográficas en San Vicente del Raspeig y se adhirió a FESACOCUR en 2013.'
  ]],
  ['Club Gallina Alacantina (2017–hoy)', [
    'En 2016 se retomó el contacto entre criadores y el trabajo de reconocimiento, y en enero de 2017 se reunió por primera vez el Club, en Benissa. Se definió el estándar, se presentaron ejemplares en las exposiciones validadas por la Comisión Nacional de Estándares y se trabajó en la mejora de la variedad milflores.',
    'El <strong>18 de diciembre de 2020</strong>, FESACOCUR reconoció la raza Alacantina con tres variedades: blanca, negra moteada y exchequer.',
    'El <strong>8 de marzo de 2025</strong>, el Club se constituyó formalmente como asociación. Hoy lleva el Libro Genealógico con el objetivo de que la raza entre en el Catálogo Oficial de Razas de Ganado de España.'
  ]]
];

// El Club: qué es un club de raza, sus fines y por qué asociarse. Texto aprobado por el
// Club el 21/11/2026 (con el enfoque de los clubes de raza alemanes y neerlandeses).
const CLUB = {
  quees: 'Es una asociación de criadores y aficionados dedicada a una sola raza. Su razón de ser es la propia raza: conservarla, mantenerla fiel a su estándar y darla a conocer. La Asociación Club Gallina Alacantina se constituyó formalmente el 8 de marzo de 2025 y continúa el trabajo que el Club venía haciendo desde 2017. Está integrada en FESACOCUR.',
  fines: [
    '<strong>Conservar la raza:</strong> quedan pocos ejemplares, así que hay que criar sin perder variabilidad, evitando la consanguinidad y manteniendo vivas todas las líneas.',
    '<strong>Cuidar el estándar:</strong> define cómo debe ser la Alacantina y lo defiende ante la Comisión Nacional de Estándares de FESACOCUR.',
    '<strong>Llevar el Libro Genealógico:</strong> registra cada ave con su anilla, sus padres y su calificación, y ese es el registro que lleva esta app.',
    '<strong>Mejorar las variedades en proceso</strong>, como la armiñada y la milflores, hasta que puedan reconocerse.',
    '<strong>Conseguir que la raza entre en el Catálogo Oficial de Razas de Ganado de España.</strong>',
    '<strong>Darla a conocer</strong> con exposiciones, monográficos y encuentros.'
  ],
  comun: 'En un club de raza nadie cría solo. Se revisan juntos los reproductores antes de la temporada y los pollos al final. Se intercambian huevos y gallos entre criadores para que no se cierren las líneas. Y se acompaña a quien empieza. La app ayuda en ese trabajo: el Libro, el planificador de apareamientos y la calificación de cada ejemplar.',
  porque: [
    '<strong>Anillas oficiales:</strong> las anillas de FESACOCUR se piden a través del Club.',
    '<strong>Tus aves en el Libro</strong>, con calificación de un inspector y certificado.',
    '<strong>Reproductores de otras líneas:</strong> cruzar sin parentesco, con el consejo de criadores con experiencia.',
    '<strong>Exposiciones y concursos</strong>, y voz en las decisiones sobre el estándar y el futuro de la raza.',
    '<strong>Tu cría cuenta:</strong> cada criador y cada ave inscrita suman al censo que necesita la raza para su reconocimiento oficial.'
  ],
  web: 'https://www.clubalacantina.com/',
  youtube: 'https://www.youtube.com/channel/UCiW1IoJmsL_f55NOdAKWuRw'
};

// El Libro Genealógico explicado para cualquiera. Texto aprobado por el Club el
// 21/11/2026. El detalle práctico y norma por norma está en la Guía del criador.
const LIBRO = {
  quees: 'Es el registro de los animales de una raza. Cada ave figura identificada con su anilla, junto con su padre y su madre, su calificación y su historia. La norma europea admite que sea un libro, un archivo o un sistema informático llevado por una asociación de criadores; el de la Alacantina es esta app, que lleva el Club.',
  sirve: [
    '<strong>Dar fe de que una Alacantina lo es:</strong> por su genealogía conocida y por su calificación conforme al Estándar.',
    '<strong>Conservar la raza:</strong> conociendo los parentescos se evita la consanguinidad y se mantiene la variabilidad de una población pequeña.',
    '<strong>Mejorarla:</strong> permite elegir los reproductores por su calificación y su puesta.',
    '<strong>Respaldar a la raza ante la Administración:</strong> con certificados de cada animal y con los censos y datos que pide el Catálogo Oficial.'
  ],
  registros: [
    '<strong>Registro de Nacimientos (RN):</strong> donde entra cada pollito anillado.',
    '<strong>Registro Definitivo (RD):</strong> la sección principal, para los animales calificados como aptos y de padres inscritos.',
    '<strong>Registro de Méritos (RM):</strong> para los reproductores sobresalientes.',
    '<strong>Registros Fundacional (RF) y Auxiliar (RA):</strong> para los animales con los que arranca el Libro.'
  ],
  variedades: 'Las variedades en proceso de reconocimiento se registran, pero no pasan al RD hasta que se reconozcan.',
  normas: [
    '<strong>Real Decreto 45/2019:</strong> son las normas zootécnicas de España y contienen el Catálogo Oficial de Razas de Ganado. Para las aves, su artículo 26 fija lo que debe cumplir la asociación y su programa de cría: identificación individual, registro de genealogías, fiabilidad de la filiación, estructura del Libro y objetivos de conservación.',
    '<strong>Reglamento (UE) 2016/1012:</strong> es la norma europea de zootecnia. Se aplica directamente al vacuno, porcino, ovino, caprino y equino; en las aves, en lo que corresponda. El Libro sigue sus criterios para la sección principal, los animales fundadores y el certificado zootécnico.',
    '<strong>Protocolo de la Comisión Nacional de Zootecnia (5 de junio de 2025):</strong> dice qué hay que presentar para que una raza entre en el Catálogo Oficial.',
    '<strong>Estándar oficial ESGA025 (FESACOCUR, 2025):</strong> describe cómo debe ser la Alacantina y es la base de la calificación.',
    '<strong>RGPD y Ley Orgánica 3/2018 de protección de datos:</strong> protegen los datos personales de los criadores.'
  ],
  estado: 'FESACOCUR reconoció la Alacantina en 2020, pero la raza todavía no figura en el Catálogo Oficial. El Club lleva el Libro conforme a estas normas para que, cuando se pida la inclusión, haya años de genealogías, calificaciones y censos que la respalden. Con la raza en el Catálogo, la Administración podría reconocer al Club como asociación oficial de criadores y aprobar su programa de cría, y se abriría la puerta a las ayudas públicas para razas autóctonas.'
};

// Cómo empezar a criar. Aprobado por el Club el 21/11/2026. El REGA es obligatorio
// también para el autoconsumo desde 2024 (Real Decreto 637/2021).
const EMPEZAR = [
  ['Escribe al Club', `(${CONFIG.club.email}). Te orientará y te pondrá en contacto con criadores que tengan animales.`],
  ['Inscribe tu gallinero en el REGA.', 'Desde 2024 es obligatorio para cualquier gallinero, aunque sea para consumo propio y tengas pocas gallinas. Se pide en la oficina comarcal agraria o en la consejería de agricultura de tu comunidad, y te dan un código que empieza por ES.'],
  ['Consigue animales con genealogía conocida', 'de criadores del Club, con su anilla y sus padres. Mejor si el gallo y las gallinas son de líneas distintas, sin parentesco.'],
  ['Crea tu cuenta en la app', 'y pon tu REGA en «Mi aviario»: pasarás de Aspirante a Criador. Después da de alta tus animales.'],
  ['Pide las anillas a tiempo', 'a través del Club. FESACOCUR abre plazos en octubre, diciembre y febrero.'],
  ['Cría con método:', 'forma familias de un gallo con sus gallinas y apunta de qué gallina es cada huevo. Anilla cada pollito y dalo de alta con su padre y su madre.'],
  ['Cuando un animal cumpla un año, pide su calificación', 'desde la app. Si es apto, pasa al Registro Definitivo.']
];

// Plumaje y pollitos de cada variedad: descripción del Club (web clubalacantina.com,
// sección «Colores»), revisada el 21/11/2026. No forma parte del texto del Estándar.
const PLUMAJE = {
  'blanca': ['Plumaje completamente blanco.', 'Plumón blanquecino o blanco amarillento.'],
  'negra-moteada': ['Plumas negras con la punta blanca, repartidas por igual por todo el cuerpo; en alas y cola se admite alguna pluma blanca.', 'Plumón blanco amarillento y negro.'],
  'pinta': ['Mezcla de plumas enteramente blancas y enteramente negras, mitad y mitad, repartidas lo más uniformemente posible, sin el moteado regular de la negra moteada.', 'Como los de la negra moteada, pero con menos negro.'],
  'arminada': ['Cuerpo blanco con negro en el cuello, el dorso, la cola y algunas plumas del ala; es el dibujo «Columbia».', 'Plumón blanco amarillento.'],
  'milflores': ['Cada pluma tiene fondo leonado, una banda negra bien marcada y la punta blanca, repartidas por igual como en la moteada; el subplumón es de color crema. El Club sigue trabajando para mejorar el dibujo.', 'Plumón marrón anaranjado, con el pecho y el vientre amarillos.']
};

// Glosario. Las cifras salen de REGLAS para que nunca contradigan a la app.
const GLOSARIO = [
  ['Anilla', 'anilla cerrada de la Entente Europea que reparte FESACOCUR. Identifica a cada ave para toda su vida; su código lleva el año de nacimiento.'],
  ['Apto', `animal calificado sin ningún defecto descalificante y con al menos ${REGLAS.puntosMinimosApto.H} puntos (gallinas) o ${REGLAS.puntosMinimosApto.M} (gallos).`],
  ['Calificación', 'valoración de un inspector del Club sobre 100 puntos, repartidos en las 12 regiones del Estándar.'],
  ['Catálogo Oficial', 'la lista de razas de ganado reconocidas por el Estado español. La Alacantina aún no figura en él.'],
  ['CNZ', 'Comisión Nacional de Zootecnia. Informa sobre qué razas entran en el Catálogo Oficial.'],
  ['Consanguinidad (Fx)', 'cuánto están emparentados los padres de un animal. Cuanto más alta, más riesgo de perder vigor y variabilidad.'],
  ['Dirección Técnica', 'las personas del Club responsables del Libro y de sus criterios.'],
  ['Estándar (ESGA025)', 'la descripción oficial de cómo debe ser la Alacantina.'],
  ['Exchequer o pinta', 'variedad de plumas enteramente blancas y enteramente negras, mitad y mitad. Más en «Las variedades».'],
  ['Familia', 'un gallo con sus gallinas, criados juntos para saber de quién es cada pollito.'],
  ['FESACOCUR', 'Federación Española de Avicultura, Colombicultura y Cunicultura de Raza.'],
  ['Gobe (rotación de)', 'forma de criar en la que cada gallo y cada gallina dejan un hijo como reproductor y los gallos rotan entre familias, para no perder variabilidad.'],
  ['Ne (tamaño efectivo)', 'a cuántos reproductores «equivale» genéticamente la población. Cuanto más alto, mejor se conserva la raza.'],
  ['REGA', 'Registro General de Explotaciones Ganaderas. Obligatorio para cualquier gallinero.'],
  ['RN, RD, RM, RF, RA', 'los registros del Libro: Nacimientos, Definitivo, Méritos, Fundacional y Auxiliar.'],
  ['Variedad', 'cada color de plumaje de la raza. Están reconocidas la blanca, la negra moteada y la exchequer; la armiñada y la milflores están en proceso de reconocimiento.']
];

const lista = (items) => h`<ul>${items.map(x => h`<li>${html(x)}</li>`)}</ul>`;
const apartado = (id, titulo, sub, cuerpo, abierto = false) => h`<details class="tarjeta historia" id="${id}" ${abierto ? h`open` : ''}>
  <summary><span><strong>${titulo}</strong><span class="item-sub">${sub}</span></span></summary>${cuerpo}</details>`;

export default function (main) {
  const abierto = new URLSearchParams(location.hash.split('?')[1] || '').get('s') || '';
  pintar(main, h`
    <p class="peq"><a href="#/estandar">‹ Estándar</a></p>
    <h1>La Alacantina y su Club</h1>
    <p class="muted">Cómo empezar, de dónde viene la raza, quién la cuida, cómo se lleva su Libro Genealógico y cómo es cada variedad.</p>

    ${apartado('empezar', 'Cómo empezar a criar Alacantinas', 'Del primer contacto con el Club a la primera calificación', h`
      <ol class="pasos">${EMPEZAR.map(([a, b]) => h`<li><strong>${a}</strong> ${b}</li>`)}</ol>`, abierto === 'empezar')}

    ${apartado('historia', 'Historia de la raza', 'De 1905 al reconocimiento de 2020 y el Libro Genealógico',
      h`${HISTORIA.map(([etapa, parrafos]) => h`<h3>${etapa}</h3>${parrafos.map(p => h`<p>${html(p)}</p>`)}`)}`, abierto === 'historia')}

    ${apartado('club', 'El Club Gallina Alacantina', 'Qué es un club de raza, para qué trabaja y por qué asociarse', h`
      <h3>Qué es un club de raza</h3><p>${CLUB.quees}</p>
      <h3>Para qué trabaja el Club</h3>${lista(CLUB.fines)}
      <h3>Criar en común</h3><p>${CLUB.comun}</p>
      <h3>Por qué asociarse</h3>${lista(CLUB.porque)}
      <h3>Cómo asociarse</h3><p>Escribe a <a href="mailto:${CONFIG.club.email}?subject=${encodeURIComponent('Quiero asociarme al Club Gallina Alacantina')}">${CONFIG.club.email}</a>.</p>
      <p class="club-enlaces">
        <a class="btn" href="${CLUB.web}" target="_blank" rel="noopener">${icono('casa')} Web del Club</a>
        <a class="btn" href="${CLUB.youtube}" target="_blank" rel="noopener">${icono('video')} Canal de YouTube</a>
      </p>`, abierto === 'club')}

    ${apartado('libro', 'El Libro Genealógico', 'Qué es, para qué sirve y qué normas lo regulan', h`
      <h3>Qué es</h3><p>${LIBRO.quees}</p>
      <h3>Para qué sirve</h3>${lista(LIBRO.sirve)}
      <h3>Cómo se organiza</h3><p>El Libro tiene varios registros:</p>${lista(LIBRO.registros)}<p>${LIBRO.variedades}</p>
      <h3>Qué normas lo regulan</h3>${lista(LIBRO.normas)}
      <h3>Dónde estamos</h3><p>${LIBRO.estado}</p>
      <p class="peq">Para saber más: Guía del criador, <a href="#/programa?s=libro">«El Libro Genealógico, en cuatro pasos»</a> y <a href="#/programa?s=normativa">«Normativa»</a>.</p>`, abierto === 'libro')}

    ${apartado('variedades', 'Las variedades', 'Plumaje de los adultos y plumón de los pollitos', h`
      <p class="peq muted">Descripción del Club; no forma parte del texto del Estándar ${ESTANDAR.codigo}, que describe los tarsos y el pico de cada variedad.</p>
      <ul class="lista">${ESTANDAR.variedades.map(v => h`<li class="item"><div class="item-principal">
        <div class="item-titulo"><span class="ave var-${v.id}" style="width:28px;height:28px;vertical-align:middle;margin-right:.4rem" aria-hidden="true"></span>${v.nombre} ${v.oficial ? h`<span class="chip chip-ok">Oficial</span>` : h`<span class="chip chip-aviso">En proceso de reconocimiento</span>`}</div>
        <p style="margin:.35rem 0 .2rem">${PLUMAJE[v.id]?.[0] || '—'}</p>
        <p class="peq muted" style="margin:0"><strong>Pollitos:</strong> ${PLUMAJE[v.id]?.[1] || '—'}</p></div></li>`)}</ul>`, abierto === 'variedades')}

    ${apartado('glosario', 'Glosario', 'Las palabras y siglas que usa la app', h`
      <dl class="glosario">${GLOSARIO.map(([t, d]) => h`<dt>${t}</dt><dd>${d}</dd>`)}</dl>`, abierto === 'glosario')}

    <a class="tarjeta item" href="#/programa" style="display:flex"><span class="tarea-ico" aria-hidden="true">${icono('brujula')}</span>
      <span class="item-principal"><span class="item-titulo">¿Quieres criar Alacantinas para el Libro?</span>
      <span class="item-sub">Guía del criador: anillas, calificación, familias y control de puesta</span></span><span aria-hidden="true">›</span></a>
  `);
}
