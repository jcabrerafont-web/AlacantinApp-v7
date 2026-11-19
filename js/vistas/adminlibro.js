// Inscripciones del Libro (administración): candidatos al Registro de Méritos,
// fundadores (RF/RA) y cambio de titular, con un buscador por anilla.
import * as datos from '../datos.js';
import { buscarEjemplares } from '../buscar.js';
import { REGLAS } from '../estandar.js';
import { h, pintar, $ } from '../ui.js';
import { ave } from '../iconos.js';

const titular = (a) => { const u = datos.estado.perfiles.find(x => x.id === a.usuario_id); return u ? (u.nombre || u.email) : 'titular sin datos'; };
const fila = (a, extra = '') => h`<li><a class="item" href="#/animal/${a.id}">
  ${ave(a)}<span class="item-principal"><span class="item-titulo">${a.anilla}${a.nombre ? ` · ${a.nombre}` : ''}</span>
  <span class="item-sub">${a.seccion} · ${titular(a)}${extra}${a.estado === 'baja' ? ' · de baja' : ''}</span></span><span aria-hidden="true">›</span></a></li>`;

export default function (main) {
  let consulta = '';
  const dibujar = () => {
    const rm = datos.candidatosRM();
    const resultados = consulta.trim().length >= 2 ? buscarEjemplares(consulta).slice(0, 12) : [];
    pintar(main, h`
      <p class="peq"><a href="#/admin">‹ Administración</a></p>
      <h1>Inscripciones del Libro</h1>

      <div class="tarjeta" id="al-rm">
        <h2>Registro de Méritos</h2>
        ${rm.length
          ? h`<p class="peq muted">Cumplen la puntuación y los descendientes en el Registro Definitivo. Abre cada uno y pulsa «★ Inscribir en RM».</p>
              <ul class="lista">${rm.map(({ a, m }) => fila(a, ` · ${m.mejorPuntos} puntos · ${m.hijosRD} descendientes en RD`))}</ul>`
          : h`<p class="muted" style="margin:0">Ningún ejemplar cumple ahora los requisitos. Los gallos necesitan ${REGLAS.rm.M.puntos} puntos y ${REGLAS.rm.M.hijosRD} hijos en el RD; las gallinas, ${REGLAS.rm.H.puntos} puntos y ${REGLAS.rm.H.hijosRD} hijos. También se puede inscribir por un premio en exposición, desde la ficha del ejemplar.</p>`}
      </div>

      <div class="tarjeta">
        <h2>Buscar un ejemplar</h2>
        <p class="peq muted">Para inscribir un fundador (RF) o un auxiliar (RA), o para cambiar el titular tras una venta o cesión: busca el ejemplar y, en su ficha, usa el botón correspondiente.</p>
        <div class="campo"><label for="al-buscar">Anilla o nombre</label>
          <input id="al-buscar" inputmode="search" autocomplete="off" placeholder="Ej.: 000123 o E2524000123" value="${consulta}"></div>
        ${resultados.length ? h`<ul class="lista" id="al-resultados">${resultados.map(a => fila(a))}</ul>`
          : consulta.trim().length >= 2 ? h`<p class="muted">Ningún ejemplar coincide.</p>` : ''}
        <ul class="peq muted" style="margin:.75rem 0 0">
          <li><strong>Inscribir en RF / RA:</strong> solo ejemplares del Registro de Nacimientos. Hay que indicar el motivo (por ejemplo, «fundador de la raza, aviario de …»).</li>
          <li><strong>Cambiar titular:</strong> el criador de origen no cambia nunca; el ejemplar pasa al socio que elijas.</li>
        </ul>
      </div>`);
    const input = $('#al-buscar', main);
    input.addEventListener('input', () => { consulta = input.value; const pos = input.selectionStart; dibujar(); const i = $('#al-buscar', main); i.focus(); i.setSelectionRange(pos, pos); });
  };
  dibujar();
  return datos.suscribir(dibujar);
}
