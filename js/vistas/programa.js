// Guía del criador: cómo funciona el programa de cría de la Alacantina, paso a
// paso. Las cifras se leen de estandar.js (REGLAS, BAREMO, ESTANDAR) para que la
// guía nunca contradiga lo que la app aplica.
// Fuentes: Estándar ESGA025; reglamentación del Libro Genealógico de la Castellana
// Negra (MAPA) y manual GANECA como modelo; reglamento del Sobrarbe (RM por premio).
import { ESTANDAR, REGLAS, BAREMO } from '../estandar.js';
import * as datos from '../datos.js';
import { h, pintar } from '../ui.js';


// Requisito · norma · cómo lo cumple la app
const NORMAS = [
  ['Identificación individual de cada animal', 'RD 45/2019, art. 26.5 b', 'Anilla cerrada EE de FESACOCUR, única en el Libro. La app compone y valida el código (año, diámetro y número) y rechaza duplicados.'],
  ['Registro de las genealogías', 'RD 45/2019, arts. 26.5 c y 14.5 a', 'Padre y madre de cada animal, pedigrí de 5 generaciones y matriz genealógica exportable en CSV.'],
  ['Fiabilidad de la filiación', 'RD 45/2019, art. 26.5 d', 'El padre debe ser un gallo y la madre una gallina registrados y nacidos antes; no se admiten ciclos. El control de puesta con identificación del huevo asegura la madre.'],
  ['Estructura del Libro y criterios de cada sección', 'RD 45/2019, art. 26.5 d', 'Registros Fundacional, Auxiliar, de Nacimientos, Definitivo y de Méritos, con sus requisitos aplicados por la app y comprobados en el servidor.'],
  ['Filiación establecida para la sección principal', 'Reg. (UE) 2016/1012, anexo II (por analogía)', 'Para pasar al RD, el padre y la madre deben estar inscritos en el Libro y la explotación debe tener REGA. La ficha muestra qué falta.'],
  ['Animales fundadores identificados (raza sin libro previo)', 'Reg. (UE) 2016/1012, art. 19 (por analogía)', 'Registro Fundacional, que solo asigna la Dirección Técnica y con motivo anotado.'],
  ['Características de la raza y sistema de calificación', 'RD 45/2019, arts. 26.5 a y 3 e', 'Estándar ESGA025 completo y baremo de 100 puntos por las 12 regiones del Estándar, aplicado por inspectores.'],
  ['Objetivos de conservación y control de la consanguinidad', 'RD 45/2019, arts. 26.5 f y 8.2 f', 'Consanguinidad de Wright, familias con rotación de Gobe, planificador de apareamientos y tamaño efectivo (Ne).'],
  ['Control de rendimientos (aptitudes aviares)', 'RD 45/2019, arts. 3 h y 8.6 b', 'Campañas de control de puesta con pesaje individual: puesta, tamaño del huevo y masa de huevo.'],
  ['Base de datos de la asociación', 'RD 45/2019, art. 14.1 y 14.5', 'Libro con identificación y genealogías, resultados del programa, criadores con sus efectivos y explotaciones (CSV en Informes).'],
  ['Acceso a los datos y protección de datos personales', 'RD 45/2019, art. 14.6; RGPD', 'Cada criador ve lo suyo; la inspección y la administración, todo; el público, el censo sin titular, REGA ni ubicación.'],
  ['Información pública sobre el programa de cría', 'RD 45/2019, art. 14.7', 'El Estándar y esta Guía son públicos, sin necesidad de registrarse.'],
  ['Datos para el Catálogo y el Sistema Nacional de Información (ARCA)', 'RD 45/2019, art. 12; Protocolo CNZ 2025, 3.1 f, j, l', 'Informes de censo por sexo y edad, criadores, distribución territorial, Ne y endogamia.'],
  ['Certificado zootécnico', 'Reg. (UE) 2016/1012, anexo V (por analogía)', 'Especie, libro, sección, identificación, fecha y país de nacimiento, criador y propietario, genealogía, resultados de calificación y puesta, lugar, fecha y firma.'],
  ['Trazabilidad ante el control oficial', 'RD 45/2019, arts. 14.2 y 29', 'Historial de cambios en el servidor (quién, cuándo y qué) y actas de calificación firmadas.'],
  ['Cambio de propietario sin perder el Libro', 'Reg. (UE) 2016/1012, anexo V j-k (por analogía)', 'La administración cambia el titular; el criador de origen se conserva siempre.']
];
// Lo que corresponde al Club
const CLUB = [
  ['Asociación con personalidad jurídica, estatutos y reglamento interno sin discriminación entre socios', 'RD 45/2019, art. 26.4 a y f'],
  ['Personal cualificado: Dirección Técnica del Libro e inspectores calificadores', 'RD 45/2019, arts. 26.4 b y 3 e'],
  ['Programa de cría escrito y aprobado por la autoridad competente: la comunidad autónoma con más reproductoras o, si el censo está repartido en al menos tres y ninguna supera el 60 %, el Ministerio', 'RD 45/2019, arts. 9 y 26.5'],
  ['Solicitud de inclusión de la raza en el Catálogo Oficial, avalada por el informe de una entidad científica (historia, morfología con fotos de ambos sexos, edades y variedades, censos, caracterización genética, Ne…). La app reúne las fotos en el Dossier fotográfico', 'RD 45/2019, art. 6; Protocolo CNZ 2025, 3.1'],
  ['Ratificar el baremo de calificación y las reglas que la app aplica como propuesta', 'RD 45/2019, art. 26.5 a y d'],
  ['Conservación fuera del aviario (banco de germoplasma) y, si se usan, análisis de ADN en un laboratorio reconocido', 'RD 45/2019, arts. 8.2 f, 15 y 18'],
  ['Reconocimiento de la Blanca armiñada en negro y la Milflores: ante FESACOCUR para exposiciones y, como variedad de la raza, con cinco generaciones en aislamiento reproductivo', 'RD 45/2019, art. 3 b; Protocolo CNZ 2025, 3.3']
];

export default function (main) {
  const R = REGLAS, E = ESTANDAR, CP = REGLAS.controlPuesta, RP = REGLAS.reproduccion;
  const usuario = !datos.esVisitante();
  const enlace = (href, texto) => (usuario ? h`<a href="${href}">${texto}</a>` : h`<span>${texto}</span>`);
  const q = new URLSearchParams(location.hash.split('?')[1] || '');
  const abierta = q.get('s') || 'libro';

  const seccion = (id, titulo, cuerpo) => h`<details class="tarjeta guia-sec" id="sec-${id}" ${id === abierta ? h`open` : ''}>
    <summary><strong>${titulo}</strong></summary>${cuerpo}</details>`;

  pintar(main, h`
    <h1>Guía del criador</h1>
    <p class="muted">Qué hay que hacer, cuándo y por qué para que tus gallinas formen parte del Libro Genealógico de la Alacantina. La app te acompaña en cada paso.</p>

    ${seccion('libro', '1. El Libro Genealógico, en cuatro pasos', h`
      <ol class="pasos">
        <li><strong>Nacimiento (RN).</strong> Anilla el pollito con su anilla oficial y dalo de alta con su padre y su madre. Entra en el <em>Registro de Nacimientos</em>. ${enlace('#/alta', 'Alta rápida →')}</li>
        <li><strong>Calificación.</strong> Un inspector del Club puntúa al animal sobre 100 y lo pesa. Es <em>Apto</em> si no tiene ningún defecto descalificante y llega a <strong>${R.puntosMinimosApto.H} puntos (gallinas)</strong> o <strong>${R.puntosMinimosApto.M} (gallos)</strong>.</li>
        <li><strong>Registro Definitivo (RD).</strong> Pasa a él el animal Apto, de variedad oficial, con <strong>${R.edadMinimaRD_meses / 12 === 1 ? 'un año' : `${R.edadMinimaRD_meses} meses`}</strong> cumplido, con <strong>padre y madre inscritos en el Libro</strong> y criado en una explotación con <strong>REGA</strong>. La ficha de cada animal te dice qué le falta. Solo los animales del RD (y del RF y RA) deben usarse como reproductores del Libro.</li>
        <li><strong>Registro de Méritos (RM).</strong> Para los reproductores sobresalientes: gallinas con ${R.rm.H.puntos} puntos o más y ${R.rm.H.hijosRD} hijos en el RD; gallos con ${R.rm.M.puntos} puntos y ${R.rm.M.hijosRD} hijos en el RD. También por un premio en exposición, con la misma puntuación. Lo acuerda la administración del Libro.</li>
      </ol>
      <p class="peq muted">Además existen el <strong>Registro Fundacional (RF)</strong>, para los animales con los que arranca el Libro, y el <strong>Registro Auxiliar (RA)</strong>, para animales de buena morfología sin genealogía completa. Los asigna la Dirección Técnica. Al empezar el Libro, los buenos animales que ya tenéis entran como fundadores, y sus hijos ya pueden llegar al RD.</p>
      <p class="peq muted">Las variedades en proceso de reconocimiento (${E.variedades.filter(v => !v.oficial).map(v => v.nombre).join(' y ')}) se registran y se siguen genealógicamente, pero no acceden al RD ni al RM hasta su reconocimiento oficial.</p>`)}

    ${seccion('anillas', '2. Anillas oficiales', h`
      <p>Se usan las <strong>anillas cerradas de la Entente Europea</strong> que suministra FESACOCUR a través del Club. Diámetro según el Estándar: <strong>gallo ${E.anilla.M} mm, gallina ${E.anilla.H} mm</strong>.</p>
      <ul>
        <li><strong>Pide las anillas a tiempo.</strong> FESACOCUR abre varios plazos de pedido al año (para la temporada 2026: octubre, diciembre y febrero). Calcula cuántos pollitos esperas sacar.</li>
        <li><strong>Colócala en cuanto pase por el pie</strong> del pollito: dedo trasero hacia atrás, junto a la pata, y desliza la anilla. Si esperas demasiado ya no entrará; si no entra la del Estándar, se admite la de 2 mm más.</li>
        <li><strong>Cuídala.</strong> Una anilla rota, cortada o ilegible deja al animal fuera del Libro.</li>
        <li>En la app solo escribes el <strong>número grabado</strong>: el año sale de la fecha de nacimiento y el diámetro del sexo. El código queda así: E + año + diámetro + número (p. ej. E2620000123). El año de la anilla debe coincidir con el de nacimiento.</li>
      </ul>`)}

    ${seccion('calificacion', '3. La calificación', h`
      <p>Un inspector del Club visita el aviario y valora cada animal en las <strong>12 regiones del Estándar</strong> (${BAREMO.apartados.map(a => `${a.nombre.toLowerCase()} ${a.max}`).join(', ')}): 100 puntos en total.</p>
      <p>Clases: ${BAREMO.clases.map(c => `${c.nombre} (${c.id}) desde ${c.min}`).join(' · ')}.</p>
      <div class="aviso-caja alerta peq"><strong>Defectos que descalifican</strong>, sume lo que sume: ${E.defectosGraves.map(d => d.texto.toLowerCase()).join('; ')}.</div>
      <p>El inspector también <strong>pesa al animal</strong>. El Estándar fija gallo ${E.peso.M.min / 1000}–${E.peso.M.max / 1000} kg y gallina ${E.peso.H.min / 1000}–${E.peso.H.max / 1000} kg; el peso queda en el acta, pero no suma puntos.</p>
      <p class="peq">Para prepararte, repasa la ${enlace('#/guia', 'Guía de campo')} y el ${enlace('#/estandar', 'Estándar')}. Los animales jóvenes pueden calificarse, pero no pasan al RD hasta cumplir un año: la ficha te dirá desde qué fecha.</p>
      <p class="peq muted">El baremo es una propuesta del Club pendiente de ratificar por la Dirección Técnica.</p>`)}

    ${seccion('familias', '4. Familias y consanguinidad', h`
      <p>La raza tiene pocos animales: cada criador guarda una parte de su variabilidad genética. Por eso se cría en <strong>familias</strong> y se evita cruzar parientes.</p>
      <ul>
        <li><strong>Una familia</strong> es un gallo con su grupo de gallinas (de 5 a 15) y su descendencia. Con las mismas gallinas, <strong>más gallos con grupos pequeños conservan mejor la raza</strong> que un solo gallo con muchas.</li>
        <li><strong>Reposición (regla de Gobe):</strong> de cada gallo se queda un hijo, y de cada gallina una hija, para que todos dejen descendencia.</li>
        <li><strong>Rotación:</strong> el gallo nuevo se queda en la familia de su padre; las pollitas pasan a otra familia, nunca con el gallo de la suya. La app usa las familias ${E.familias.join(', ')} en círculo.</li>
        <li><strong>Consanguinidad:</strong> antes de juntar un gallo con una gallina, mira la consanguinidad esperada de sus pollitos. La app avisa con <em>precaución</em> desde ${String(R.fxPrecaucion * 100).replace('.', ',')} % (como entre primos hermanos) y con <em>alerta</em> desde ${String(R.fxAlerta * 100).replace('.', ',')} % (como entre medio hermanos).</li>
      </ul>
      <p class="peq">${enlace('#/apareamientos', 'Planificar apareamientos →')}</p>
      <h3>De la familia al pollito anotado</h3>
      <ol class="pasos">
        <li><strong>Forma el lote</strong> en ${enlace('#/reproduccion', 'Reproducción e incubación')}: el gallo, sus gallinas y el día en que los juntas. La app muestra la consanguinidad de los pollitos con cada gallina.</li>
        <li><strong>Espera ${RP.diasEsperaCambioGallo} días</strong> antes de incubar los huevos de una gallina que viene de otro gallo: la app marca esos huevos como «dudosos».</li>
        <li><strong>Incuba huevos de no más de ${RP.diasMaxHuevo} días</strong>, marcados a lápiz con la gallina. La app propone los huevos aptos registrados en Puesta.</li>
        <li><strong>Día ${RP.miraje}: miraje.</strong> Al trasluz, retira y anota los huevos claros (sin embrión). Así sale la <em>fertilidad</em> de cada gallina.</li>
        <li><strong>Día ${RP.nacedora}: nacedora.</strong> Deja de voltear y separa los huevos de cada gallina en su cestillo, para saber de quién es cada pollito.</li>
        <li><strong>Día ${RP.eclosion}: nacimiento.</strong> Anota los nacidos (sale el <em>porcentaje de nacimiento</em>) y marca cada pollito hasta ponerle la anilla. Al darlo de alta desde la incubación, la app ya pone el padre, la madre y la fecha.</li>
      </ol>
      <p class="peq">Un pollito sin padre o madre conocidos nunca podrá pasar al Registro Definitivo: la filiación es la base del Libro.</p>`)}

    ${seccion('puesta', '5. Control de puesta', h`
      <p>Saber cuánto y qué huevo pone cada gallina permite elegir como madres a las mejores <strong>sin perder variabilidad</strong>: dentro de cada familia, la mejor gallina da el gallo de reposición.</p>
      <ol class="pasos">
        <li><strong>${CP.ciclos} campañas por temporada</strong>, de <strong>${CP.dias} días</strong> cada una, repartidas entre febrero y junio (por ejemplo, una en febrero–marzo, otra en abril y otra en mayo–junio). ${enlace('#/campanas', 'Organizar campañas →')}</li>
        <li><strong>Prepara cómo saber de quién es cada huevo:</strong> jaulas individuales durante la campaña, ponederos trampa o un ponedero con lector RFID.</li>
        <li><strong>Cada día:</strong> recoge los huevos, pésalos uno a uno con una báscula de cocina y anótalos en ${enlace('#/puesta', 'Puesta & RFID')} con su cáscara.</li>
        <li><strong>Huevo para incubar:</strong> desde <strong>${E.huevo.min} g</strong> y cáscara ${E.huevo.cascara.toLowerCase()}. El Estándar da ${E.huevo.min}–${E.huevo.habitualMax} g como rango habitual, pero un huevo más grande también vale.</li>
        <li><strong>Si cambias una gallina de gallo</strong>, espera unas dos semanas antes de incubar sus huevos: puede seguir fecundada por el anterior y la genealogía sería falsa.</li>
        <li><strong>Al terminar</strong>, la app calcula para cada gallina los huevos, el porcentaje de puesta (días con huevo sobre días controlados), el peso medio, la masa de huevo y cuántos son aptos.</li>
      </ol>
      <h3>Tres maneras de ser buena ponedora</h3>
      <ul>
        <li>🥚 <strong>La que más pone</strong>: la que pone más días de la campaña.</li>
        <li>🔶 <strong>La de huevo más grande</strong>: la de mayor peso medio, si ha puesto al menos ${CP.minHuevosPeso} huevos (con menos, el peso medio no es fiable).</li>
        <li>⭐ <strong>La mejor en masa de huevo</strong>: los gramos de huevo que da al día (porcentaje de puesta × peso medio). Une cantidad y tamaño: una gallina con 10 huevos de 65 g produce más que una con 12 de 52 g.</li>
      </ul>
      <p>Las gallinas que más huevos ponen tienden a ponerlos algo más pequeños, y al revés. Si solo se premia la cantidad, el huevo se va haciendo más pequeño con las generaciones; si solo se premia el tamaño, baja la puesta. Por eso la app muestra las tres clasificaciones a la vez y propone como <strong>madre del gallo de reposición</strong> de cada familia a la mejor en <strong>masa de huevo</strong>.</p>
      <p class="peq">Ten en cuenta la edad: las pollitas del primer año ponen huevos más pequeños que las gallinas adultas, y el huevo crece a lo largo de la temporada. Compara gallinas de la misma campaña.</p>`)}

    ${seccion('calendario', '6. Calendario orientativo del año', h`
      <div class="tabla-scroll"><table><tbody>
        <tr><th>Octubre – febrero</th><td>Pedir anillas en los plazos de FESACOCUR.</td></tr>
        <tr><th>Enero – febrero</th><td>Formar las familias para la temporada y revisar la consanguinidad de cada cruce.</td></tr>
        <tr><th>Febrero – junio</th><td>${CP.ciclos} campañas de control de puesta. Incubar huevos identificados (padre y madre conocidos).</td></tr>
        <tr><th>Primavera – verano</th><td>Anillar los pollitos y darlos de alta en la app (RN) con sus padres.</td></tr>
        <tr><th>Otoño</th><td>Elegir la reposición (un hijo de cada gallo, una hija de cada gallina). Calificar los animales que ya tienen un año.</td></tr>
      </tbody></table></div>
      <p class="peq muted">Orientativo: cada aviario y cada año pueden necesitar ajustes. Ante cualquier duda, consulta a la Dirección Técnica del Club.</p>`)}

    ${seccion('normativa', '7. Qué exige la normativa y cómo lo cumple la app', h`
      <p>La Alacantina es una raza <strong>aviar</strong>. El Reglamento (UE) 2016/1012 solo regula directamente bovino, porcino, ovino, caprino y équidos. Para las aves rige el <strong>artículo 26 del Real Decreto 45/2019</strong>, que aplica ese Reglamento «mutatis mutandis», adaptado a cada especie. La app sigue ambos.</p>
      <div class="aviso-caja info peq"><strong>Situación de la raza:</strong> la Alacantina aún no figura en el Catálogo Oficial de Razas de Ganado de España (anexo I del RD 45/2019). El primer paso es solicitar su inclusión según el Protocolo de la Comisión Nacional de Zootecnia (5 de junio de 2025). La app ya reúne los datos que ese protocolo pide.</div>
      <h3>Requisito por requisito</h3>
      <ul class="lista-normas">${NORMAS.map(([req, norma, app]) => h`<li><strong>${req}</strong> <span class="muted peq">· ${norma}</span><br><span class="peq">✓ ${app}</span></li>`)}</ul>
      <h3>Lo que tiene que hacer el Club (fuera de la app)</h3>
      <ul class="lista-normas">${CLUB.map(([req, norma]) => h`<li>☐ ${req} <span class="muted peq">· ${norma}</span></li>`)}</ul>
      <p class="peq muted">Resumen orientativo para el criador y la junta, no asesoramiento jurídico. Ante cualquier duda manda el texto oficial de cada norma.</p>`)}

    <p class="peq muted">Esta guía sigue el Estándar ${E.codigo}, las normas del Libro de la Alacantina y, donde el Club aún no tiene norma propia, la reglamentación oficial del Libro Genealógico de la Castellana Negra como referencia.</p>`);

  const objetivo = document.getElementById(`sec-${abierta}`);
  if (objetivo && q.get('s')) setTimeout(() => objetivo.scrollIntoView({ block: 'start' }), 50);
}
