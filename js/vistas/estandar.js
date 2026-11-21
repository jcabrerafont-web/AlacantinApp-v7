import { ESTANDAR } from '../estandar.js';
import { CONFIG } from '../config.js';
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

// 3000 → «3», 3500 → «3,5» (sin ceros de relleno)
const kg = (g) => String(Math.round(g / 10) / 100).replace('.', ',');

export default function (main) {
  const E = ESTANDAR;
  pintar(main, h`
    <header class="portada">
      <img src="./icons/logo.png" alt="Escudo de la Asociación Club Gallina Alacantina" width="112" height="112">
      <div><h1>Gallina Alacantina</h1><span class="portada-raya" aria-hidden="true"></span>
        <p>Raza autóctona de la provincia de Alicante. Estándar oficial ${E.codigo}, revisión del ${E.revision}.</p></div>
    </header>

    <nav class="accesos" aria-label="Accesos rápidos">
      <a class="btn" href="#/guia">${icono('guia')} Guía de campo</a>
      <a class="btn" href="#/censo">${icono('lupa')} Censo público</a>
      <a class="btn" href="./docs/Estandar-Alacantina2025.pdf" target="_blank" rel="noopener">${icono('documento')} Estándar (PDF)</a>
    </nav>

    <div class="tarjeta">
      <h2>Impresión general</h2>
      <p>${E.impresionGeneral}</p>
    </div>

    <div class="tarjeta">
      <h2>Rasgos clave</h2>
      <ul class="rasgos">${E.rasgosClave.map(r => h`<li><span class="rasgo-nombre">${r.rasgo}</span><b class="rasgo-valor">${r.valor}</b><span class="rasgo-detalle">${r.detalle}</span></li>`)}</ul>
      <p class="peq muted" style="margin:.5rem 0 0">El detalle de cada región, más abajo en «Morfología por regiones».</p>
    </div>

    <div class="kpis">
      <div class="kpi"><b>${kg(E.peso.M.min)}–${kg(E.peso.M.max)} kg</b><span>Peso del gallo</span></div>
      <div class="kpi"><b>${kg(E.peso.H.min)}–${kg(E.peso.H.max)} kg</b><span>Peso de la gallina</span></div>
      <div class="kpi"><b class="sin-corte">${E.anilla.M} / ${E.anilla.H} mm</b><span>Anilla gallo / gallina</span></div>
      <div class="kpi"><b>≥ ${E.huevo.min} g</b><span>Huevo · habitual ${E.huevo.min}–${E.huevo.habitualMax} g · cáscara ${E.huevo.cascara.toLowerCase()}</span></div>
    </div>

    <div class="tarjeta">
      <h2>Variedades</h2>
      <ul class="lista">
        ${E.variedades.map(v => h`<li class="item"><div class="item-principal">
          <div class="item-titulo"><span class="ave var-${v.id}" style="width:28px;height:28px;vertical-align:middle;margin-right:.4rem" aria-hidden="true"></span>${v.nombre} ${v.oficial ? h`<span class="chip chip-ok">Oficial</span>` : h`<span class="chip chip-aviso">En proceso de reconocimiento</span>`}</div>
          <div class="item-sub">${v.detalle}</div></div></li>`)}
      </ul>
    </div>

    <div class="tarjeta">
      <h2>Defectos graves</h2>
      <ul>${E.defectosGraves.map(d => h`<li>${d.texto}</li>`)}</ul>
    </div>

    <div class="tarjeta">
      <h2>Morfología por regiones</h2>
      <div class="tabla-scroll"><table>
        <thead><tr><th>Región</th><th>Gallo</th><th>Gallina</th></tr></thead>
        <tbody>${E.regiones.map(r => h`<tr><th scope="row">${r.nombre}</th><td>${r.gallo}</td><td>${r.gallina}</td></tr>`)}</tbody>
      </table></div>
    </div>

    <details class="tarjeta historia" id="historia">
      <summary><span><strong>Historia de la raza</strong><span class="item-sub">De 1905 al reconocimiento de 2020 y el Libro Genealógico</span></span></summary>
      ${HISTORIA.map(([etapa, parrafos]) => h`<h3>${etapa}</h3>${parrafos.map(p => h`<p>${html(p)}</p>`)}`)}
    </details>

    <details class="tarjeta historia" id="club">
      <summary><span><strong>El Club Gallina Alacantina</strong><span class="item-sub">Qué es un club de raza, para qué trabaja y por qué asociarse</span></span></summary>
      <h3>Qué es un club de raza</h3><p>${CLUB.quees}</p>
      <h3>Para qué trabaja el Club</h3><ul>${CLUB.fines.map(f => h`<li>${html(f)}</li>`)}</ul>
      <h3>Criar en común</h3><p>${CLUB.comun}</p>
      <h3>Por qué asociarse</h3><ul>${CLUB.porque.map(f => h`<li>${html(f)}</li>`)}</ul>
      <h3>Cómo asociarse</h3><p>Escribe a <a href="mailto:${CONFIG.club.email}?subject=${encodeURIComponent('Quiero asociarme al Club Gallina Alacantina')}">${CONFIG.club.email}</a>.</p>
      <p class="club-enlaces">
        <a class="btn" href="${CLUB.web}" target="_blank" rel="noopener">${icono('casa')} Web del Club</a>
        <a class="btn" href="${CLUB.youtube}" target="_blank" rel="noopener">${icono('video')} Canal de YouTube</a>
      </p>
    </details>

    <a class="tarjeta item" href="#/programa" style="display:flex"><span class="tarea-ico" aria-hidden="true">${icono('brujula')}</span>
      <span class="item-principal"><span class="item-titulo">¿Quieres criar Alacantinas para el Libro?</span>
      <span class="item-sub">Guía del criador: anillas, calificación, familias y control de puesta</span></span><span aria-hidden="true">›</span></a>

    <p><a class="btn" href="./docs/Estandar-Alacantina2025.pdf" target="_blank" rel="noopener">${icono('documento')} Ver el Estándar oficial (PDF)</a></p>
    <p class="peq muted"><a href="#/privacidad">Política de privacidad</a></p>
  `);
}
