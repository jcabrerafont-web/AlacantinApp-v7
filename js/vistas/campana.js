// Detalle de una campaña de control de puesta: progreso día a día y resultados.
import * as datos from '../datos.js';
import { ESTANDAR } from '../estandar.js';
import { h, pintar, $, aviso, fecha, confirmar } from '../ui.js';

const coma = (n, d = 1) => (n === null || n === undefined || !Number.isFinite(n) ? '—' : Number(n).toFixed(d).replace('.', ','));
const pctTxt = (x) => `${Math.round(100 * x)} %`;

export default function (main, { id }) {
  const dibujar = () => {
    const c = datos.estado.campanas.find(x => x.id === id);
    if (!c) { pintar(main, h`<div class="tarjeta"><h2>Campaña no encontrada</h2><p><a href="#/campanas">Volver a Control de puesta</a></p></div>`); return; }
    const est = datos.estadoCampana(c);
    const dia = datos.diaCampana(c);
    const r = datos.resultadosCampana(c);
    const familias = [...new Set(r.filas.map(f => f.a.familia).filter(Boolean))].sort();

    pintar(main, h`
      <p><a href="#/campanas">← Control de puesta</a></p>
      <h1>Ciclo ${c.ciclo} · ${c.temporada}</h1>
      <p class="muted">${fecha(c.inicio)} – ${fecha(r.fin)} · ${c.gallinas.length} gallina(s)</p>

      <div class="tarjeta">
        <div class="fila entre"><strong>${est === 'en curso' ? `Día ${dia} de ${c.dias}` : est === 'programada' ? `Empieza el ${fecha(c.inicio)}` : 'Campaña terminada'}</strong>
          <span class="chip ${est === 'en curso' ? 'chip-ok' : est === 'programada' ? 'chip-info' : ''}">${est}</span></div>
        <div class="progreso" role="progressbar" aria-valuemin="0" aria-valuemax="${c.dias}" aria-valuenow="${r.transcurridos}"><span style="width:${Math.round(100 * r.transcurridos / c.dias)}%"></span></div>
        ${est === 'en curso' ? h`<p class="peq">Hoy: pesa cada huevo y anótalo en <a href="#/puesta">Puesta & RFID</a>. Pulsa una gallina para registrar sus huevos.</p>` : ''}
        ${est === 'programada' ? h`<p class="peq">Antes de empezar: prepara las ${c.metodo === 'jaula' ? 'jaulas individuales' : 'ponederos'} y comprueba que cada gallina lleva su anilla legible.</p>` : ''}
      </div>

      <div class="kpis">
        <div class="kpi"><b>${r.total}</b><span>Huevos</span></div>
        <div class="kpi"><b>${pctTxt(r.puestaMedia)}</b><span>Puesta media</span></div>
        <div class="kpi"><b>${r.filas.reduce((s, f) => s + f.aptos, 0)}</b><span>Aptos para incubar (desde ${ESTANDAR.huevo.min} g)</span></div>
      </div>

      <div class="tarjeta"><h2>Gallinas</h2>
        <div class="tabla-scroll"><table><thead><tr><th>Gallina</th><th>Fam.</th>${est === 'en curso' ? h`<th class="num">Hoy</th>` : ''}<th class="num">Huevos</th><th class="num">Puesta</th><th class="num">Peso medio</th><th class="num">Aptos</th></tr></thead>
          <tbody>${r.filas.map(f => h`<tr>
            <td><a href="${est === 'en curso' ? `#/puesta?gallina=${f.id}` : `#/animal/${f.id}`}">${f.a.anilla}</a>${f.mejorDeFamilia ? h` <span class="chip chip-ok" title="La más ponedora de su familia">★</span>` : ''}</td>
            <td>${f.a.familia || '—'}</td>${est === 'en curso' ? h`<td class="num">${f.hoy || '·'}</td>` : ''}
            <td class="num">${f.n}${f.diasDobles ? h` <span class="chip chip-aviso" title="Días con más de un huevo anotado: revisa los registros">!</span>` : ''}</td><td class="num">${pctTxt(f.puesta)}</td><td class="num">${coma(f.media)} g</td><td class="num">${f.aptos}</td></tr>`)}</tbody></table></div>
        ${r.filas.some(f => f.diasDobles) ? h`<div class="aviso-caja aviso peq">! Hay días con más de un huevo anotado para la misma gallina. Una gallina pone como mucho uno al día: revisa esos registros en Puesta & RFID (puede ser un huevo de otra gallina o una doble anotación).</div>` : ''}
        ${familias.length ? h`<p class="peq">★ La más ponedora de cada familia: según la rotación de Gobe, es la candidata a madre del gallo de reposición de esa familia.</p>`
          : h`<p class="peq muted">Asigna una familia (A–E) a tus gallinas para que la app marque la más ponedora de cada una.</p>`}
      </div>
      ${c.notas ? h`<div class="tarjeta"><h2>Notas</h2><p>${c.notas}</p></div>` : ''}
      ${est === 'programada' || r.total === 0 ? h`<button class="btn btn-peligro" id="cp-borrar">Eliminar campaña</button>` : ''}`);

    $('#cp-borrar', main)?.addEventListener('click', async () => {
      if (!(await confirmar('Eliminar campaña', 'Los huevos registrados no se borran; solo la campaña.', 'Eliminar', true))) return;
      try { await datos.borrarCampana(c.id); location.hash = '#/campanas'; } catch (e) { aviso(e.message, 'error'); }
    });
  };
  dibujar();
  return datos.suscribir(dibujar);
}
