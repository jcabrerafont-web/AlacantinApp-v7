// Guía de campo: qué observar en cada región, con los defectos graves asociados.
import { ESTANDAR } from '../estandar.js';
import { h, pintar, $ } from '../ui.js';

const normal = (s) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

export default function (main) {
  const defecto = (id) => ESTANDAR.defectosGraves.find(d => d.id === id);
  const dibujar = (filtro = '') => {
    const f = normal(filtro);
    const regiones = ESTANDAR.regiones.filter(r => !f || normal(`${r.nombre} ${r.gallo} ${r.gallina}`).includes(f));
    pintar($('#guia-lista', main), h`${regiones.map((r, i) => h`
      <details class="tarjeta" ${i === 0 && !f ? h`open` : ''}>
        <summary><strong>${ESTANDAR.regiones.indexOf(r) + 1}. ${r.nombre}</strong></summary>
        <p><span class="chip chip-info">Gallo</span> ${r.gallo}</p>
        <p><span class="chip chip-info">Gallina</span> ${r.gallina}</p>
        ${r.defectos.length ? h`<div class="aviso-caja alerta"><strong>Defecto grave:</strong> ${r.defectos.map(id => defecto(id).texto).join(' · ')}</div>` : ''}
      </details>`)}
      ${regiones.length === 0 ? h`<p class="muted">Ninguna región coincide con la búsqueda.</p>` : ''}`);
  };
  pintar(main, h`
    <h1>Guía de campo</h1>
    <p class="muted">Las 12 regiones del Estándar ${ESTANDAR.codigo} que se puntúan en el baremo de calificación.</p>
    <div class="campo"><label for="guia-buscar">Buscar</label>
      <input id="guia-buscar" type="search" placeholder="Ej.: orejilla, cola, tarsos…" autocomplete="off"></div>
    <div id="guia-lista"></div>
    <div class="tarjeta">
      <h2>Rasgos por variedad</h2>
      <ul>${ESTANDAR.variedades.filter(v => v.oficial).map(v => h`<li><strong>${v.nombre}:</strong> ${v.detalle}</li>`)}</ul>
      <p class="muted peq">El flameado de esclavina es defecto grave en las variedades moteada y exchequer.</p>
    </div>`);
  $('#guia-buscar', main).addEventListener('input', e => dibujar(e.target.value));
  dibujar();
}
