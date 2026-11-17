import { ESTANDAR } from '../estandar.js';
import { h, pintar } from '../ui.js';

const kg = (g) => (g / 1000).toFixed(3).replace('.', ',');

export default function (main) {
  const E = ESTANDAR;
  pintar(main, h`
    <h1>Estándar oficial · Alacantina</h1>
    <p class="muted">Código ${E.codigo} · Revisión ${E.revision} · Origen: ${E.origen}</p>

    <div class="tarjeta">
      <h2>Impresión general</h2>
      <p>${E.impresionGeneral}</p>
    </div>

    <div class="kpis">
      <div class="kpi"><b>${kg(E.peso.M.min)}–${kg(E.peso.M.max)} kg</b><span>Peso del gallo</span></div>
      <div class="kpi"><b>${kg(E.peso.H.min)}–${kg(E.peso.H.max)} kg</b><span>Peso de la gallina</span></div>
      <div class="kpi"><b>${E.anilla.M} / ${E.anilla.H} mm</b><span>Anilla gallo / gallina</span></div>
      <div class="kpi"><b>≥ ${E.huevo.min} g</b><span>Huevo · habitual ${E.huevo.min}–${E.huevo.habitualMax} g · cáscara ${E.huevo.cascara.toLowerCase()}</span></div>
    </div>

    <div class="tarjeta">
      <h2>Variedades</h2>
      <ul class="lista">
        ${E.variedades.map(v => h`<li class="item"><div class="item-principal">
          <div class="item-titulo">${v.nombre} ${v.oficial ? h`<span class="chip chip-ok">Oficial</span>` : h`<span class="chip chip-aviso">En proceso de reconocimiento</span>`}</div>
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

    <a class="tarjeta item" href="#/programa" style="display:flex"><span style="font-size:1.4rem" aria-hidden="true">🧭</span>
      <span class="item-principal"><span class="item-titulo">¿Quieres criar Alacantinas para el Libro?</span>
      <span class="item-sub">Guía del criador: anillas, calificación, familias y control de puesta</span></span><span aria-hidden="true">›</span></a>

    <p><a class="btn" href="./docs/Estandar-Alacantina2025.pdf" target="_blank" rel="noopener">📄 Ver el Estándar oficial (PDF)</a></p>
  `);
}
