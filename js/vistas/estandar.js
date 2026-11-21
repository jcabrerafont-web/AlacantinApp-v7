import { ESTANDAR } from '../estandar.js';
import { h, pintar } from '../ui.js';
import { icono } from '../iconos.js';

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
      <a class="btn" href="#/conoce">${icono('estrella')} La Alacantina y su Club</a>
      <a class="btn" href="#/programa">${icono('brujula')} Guía del criador</a>
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

    <a class="tarjeta item" href="#/programa" style="display:flex"><span class="tarea-ico" aria-hidden="true">${icono('brujula')}</span>
      <span class="item-principal"><span class="item-titulo">¿Quieres criar Alacantinas para el Libro?</span>
      <span class="item-sub">Guía del criador: anillas, calificación, familias y control de puesta</span></span><span aria-hidden="true">›</span></a>

    <p><a class="btn" href="./docs/Estandar-Alacantina2025.pdf" target="_blank" rel="noopener">${icono('documento')} Ver el Estándar oficial (PDF)</a></p>
    <p class="peq muted"><a href="#/privacidad">Política de privacidad</a></p>
  `);
}
