// Detalle de una campaña de control de puesta: progreso día a día y resultados.
import * as datos from '../datos.js';
import { ESTANDAR, REGLAS } from '../estandar.js';
import { h, pintar, $, aviso, fecha, confirmar } from '../ui.js';

const coma = (n, d = 1) => (n === null || n === undefined || !Number.isFinite(n) ? '—' : Number(n).toFixed(d).replace('.', ','));
const pctTxt = (x) => `${Math.round(100 * x)} %`;

const CRIT = {
  puesta: { ico: '🥚', nombre: 'La que más pone', texto: 'porcentaje de días con huevo' },
  peso: { ico: '🔶', nombre: 'Huevo más grande', texto: `peso medio, con al menos ${REGLAS.controlPuesta.minHuevosPeso} huevos` },
  masa: { ico: '⭐', nombre: 'Mejor masa de huevo', texto: 'gramos de huevo al día: puesta × peso medio' }
};
const edadTxt = (m) => (m === null || m === undefined ? '' : m < 24 ? `${m} meses` : `${Math.floor(m / 12)} años`);

// Tarjetas de destacadas + tabla con los tres criterios + explicación
export function bloqueResultados(r, { enCurso = false } = {}) {
  const crit = REGLAS.controlPuesta.criterioMadre;
  const fila = (id) => r.filas.find(f => f.id === id);
  const iconos = (f) => Object.keys(CRIT).filter(k => f.destaca[k]).map(k => CRIT[k].ico).join('');
  return h`
    <div class="tarjeta"><h2>Destacadas</h2>
      <ul class="lista-simple">${Object.entries(CRIT).map(([k, c]) => {
        const f = fila(r.general[k]);
        return h`<li>${c.ico} <strong>${c.nombre}:</strong> ${f ? h`<a href="#/animal/${f.id}">${f.a.anilla}</a> · ${k === 'puesta' ? pctTxt(f.puesta) : k === 'peso' ? `${coma(f.media)} g` : `${coma(f.masa)} g/día`}` : h`<span class="muted">aún sin datos suficientes</span>`}</li>`;
      })}</ul>
    </div>

    <div class="tarjeta"><h2>Gallinas</h2>
      <div class="tabla-scroll"><table><thead><tr><th>Gallina</th>${enCurso ? h`<th class="num">Hoy</th>` : ''}<th class="num">Huevos</th><th class="num">🥚 Puesta</th><th class="num">🔶 Peso medio</th><th class="num">⭐ Masa</th><th class="num">Aptos</th></tr></thead>
        <tbody>${r.filas.map(f => h`<tr>
          <td><a href="${enCurso ? `#/puesta?gallina=${f.id}` : `#/animal/${f.id}`}">${f.a.anilla}</a> ${iconos(f)}${f.madreFamilia ? h` <span class="chip chip-ok" title="Madre propuesta para el gallo de reposición de su familia">madre ${f.a.familia}</span>` : ''}
            <div class="muted peq">${[f.a.familia ? `fam. ${f.a.familia}` : '', edadTxt(f.edadMeses)].filter(Boolean).join(' · ')}</div></td>
          ${enCurso ? h`<td class="num">${f.hoy || '·'}</td>` : ''}
          <td class="num">${f.n}${f.diasDobles ? h` <span class="chip chip-aviso" title="Días con más de un huevo anotado: revisa los registros">!</span>` : ''}</td>
          <td class="num">${pctTxt(f.puesta)}</td>
          <td class="num">${f.media ? h`${coma(f.media)} g${f.pesoFiable ? '' : h`<span class="muted" title="Menos de ${REGLAS.controlPuesta.minHuevosPeso} huevos: aún no cuenta para el tamaño">*</span>`}` : '—'}</td>
          <td class="num">${coma(f.masa)} g/día</td><td class="num">${f.aptos}</td></tr>`)}</tbody></table></div>
      ${r.filas.some(f => f.diasDobles) ? h`<div class="aviso-caja aviso peq">! Hay días con más de un huevo anotado para la misma gallina. Una gallina pone como mucho uno al día: revisa esos registros en Puesta & RFID (puede ser un huevo de otra gallina o una doble anotación).</div>` : ''}
      ${Object.keys(r.porFamilia).length ? '' : h`<p class="peq muted">Asigna una familia (A–E) a tus gallinas para que la app proponga la madre del gallo de reposición de cada familia.</p>`}
    </div>

    <details class="tarjeta"><summary><strong>Cómo leer estos resultados</strong></summary>
      <ul>
        ${Object.values(CRIT).map(c => h`<li>${c.ico} <strong>${c.nombre}</strong>: ${c.texto}.</li>`)}
        <li><strong>Por qué tres criterios:</strong> las gallinas que más huevos ponen tienden a ponerlos algo más pequeños, y al revés. Si solo se premia uno, el otro empeora con las generaciones. La <strong>masa de huevo</strong> une los dos: una gallina con 10 huevos de 65 g produce más que una con 12 de 52 g.</li>
        <li><strong>Madre propuesta:</strong> en cada familia, la mejor en ${CRIT[crit].nombre.toLowerCase()} (${CRIT[crit].ico}). Su hijo será el gallo de reposición de la familia (regla de Gobe).</li>
        <li><strong>* Peso con pocos huevos:</strong> con menos de ${REGLAS.controlPuesta.minHuevosPeso} huevos el peso medio no es fiable y no cuenta para el tamaño.</li>
        <li><strong>La edad importa:</strong> las pollitas del primer año ponen huevos más pequeños que las gallinas adultas, y el huevo crece a lo largo de la temporada. Compara gallinas de la misma campaña y ten en cuenta su edad.</li>
      </ul></details>`;
}

export default function (main, { id }) {
  const dibujar = () => {
    const c = datos.estado.campanas.find(x => x.id === id);
    if (!c) { pintar(main, h`<div class="tarjeta"><h2>Campaña no encontrada</h2><p><a href="#/campanas">Volver a Control de puesta</a></p></div>`); return; }
    const est = datos.estadoCampana(c);
    const dia = datos.diaCampana(c);
    const r = datos.resultadosCampana(c);

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

      ${bloqueResultados(r, { enCurso: est === 'en curso' })}
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
