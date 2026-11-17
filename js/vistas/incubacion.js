// Detalle de una incubación: calendario, miraje, nacimiento y alta de los pollitos.
import * as datos from '../datos.js';
import { h, pintar, $, aviso, fecha, hoyISO, pct, confirmar } from '../ui.js';

export default function (main, { id }) {
  const dibujar = () => {
    const inc = datos.estado.incubaciones.find(x => x.id === id);
    if (!inc) { pintar(main, h`<div class="tarjeta"><h2>Incubación no encontrada</h2><p><a href="#/reproduccion">Volver</a></p></div>`); return; }
    const c = datos.calendarioIncubacion(inc.entrada);
    const fase = datos.faseIncubacion(inc);
    const r = datos.resultadoIncubacion(inc);
    const hoy = hoyISO();
    const anilla = (x) => datos.animal(x)?.anilla || '—';
    const paso = (dia, titulo, texto) => h`<li class="${hoy >= dia ? 'hecho' : ''}"><strong>${fecha(dia)} · ${titulo}</strong><br><span class="peq">${texto}</span></li>`;
    const puedeMiraje = hoy >= c.miraje && !inc.cerrada;
    const puedeNacidos = hoy >= c.eclosion && !inc.cerrada;

    pintar(main, h`
      <p><a href="#/reproduccion">← Reproducción e incubación</a></p>
      <h1>Incubación del ${fecha(inc.entrada)}</h1>
      <div class="tarjeta"><h2>Calendario</h2><ol class="pasos calendario">
        ${paso(c.entrada, 'Día 0 · Entrada', 'Huevos marcados a lápiz con la gallina, con la punta hacia abajo y volteo diario.')}
        ${paso(c.miraje, 'Día 7 · Miraje (ovoscopia)', 'Al trasluz, retira los claros (sin embrión) y anótalos.')}
        ${paso(c.nacedora, 'Día 18 · Nacedora', 'Deja de voltear. Pon los huevos de cada gallina en su cestillo, para saber de quién es cada pollito.')}
        ${paso(c.eclosion, 'Día 21 · Nacimiento', 'Anota los nacidos de cada gallina. Identifica cada pollito (clip o anilla provisional) hasta la anilla definitiva.')}
      </ol></div>

      <div class="kpis">
        <div class="kpi"><b>${r.puestos}</b><span>Huevos</span></div>
        <div class="kpi"><b>${r.fertilidad === null ? '—' : pct(r.fertilidad, 0)}</b><span>Fertilidad (fértiles ÷ huevos)</span></div>
        <div class="kpi"><b>${r.nacimiento === null ? '—' : pct(r.nacimiento, 0)}</b><span>Nacimiento (nacidos ÷ fértiles)</span></div>
      </div>

      <form id="f-inc-det" class="tarjeta" novalidate><h2>Por gallina</h2>
        <div class="tabla-scroll"><table><thead><tr><th>Madre × padre</th><th class="num">Huevos</th><th class="num">Claros</th><th class="num">Nacidos</th><th>Pollitos</th></tr></thead><tbody>
          ${inc.filas.map((f, i) => h`<tr>
            <td>${anilla(f.madre_id)} × ${f.padre_id ? anilla(f.padre_id) : h`<span class="muted">¿?</span>`}${f.padre_id && !f.padre_fiable ? h` <span class="chip chip-aviso" title="El gallo llevaba menos de 15 días con la gallina">dudoso</span>` : ''}</td>
            <td class="num">${f.puestos}</td>
            <td class="num"><input type="number" inputmode="numeric" min="0" max="${f.puestos}" value="${f.claros ?? ''}" data-claros="${i}" style="width:4rem" ${puedeMiraje ? '' : h`disabled`} aria-label="Claros de ${anilla(f.madre_id)}"></td>
            <td class="num"><input type="number" inputmode="numeric" min="0" max="${f.puestos}" value="${f.nacidos ?? ''}" data-nacidos="${i}" style="width:4rem" ${puedeNacidos ? '' : h`disabled`} aria-label="Nacidos de ${anilla(f.madre_id)}"></td>
            <td>${f.pollitos.map(x => h`<a href="#/animal/${x}">${anilla(x)}</a> `)}
              ${(f.nacidos ?? 0) > f.pollitos.length ? h`<a class="btn btn-pequeno btn-primario" href="#/alta?inc=${inc.id}&madre=${f.madre_id}${f.padre_id ? `&padre=${f.padre_id}` : ''}&fecha=${c.eclosion}">Dar de alta</a>` : ''}</td></tr>`)}
        </tbody></table></div>
        ${!puedeMiraje && !inc.cerrada ? h`<p class="ayuda">Los claros se anotan a partir del día 7 y los nacidos a partir del día 21.</p>` : ''}
        ${!inc.cerrada ? h`<div class="fila" style="margin-top:.75rem"><button class="btn btn-primario" type="submit" ${puedeMiraje ? '' : h`disabled`}>Guardar</button>
          ${fase === 'eclosion' ? h`<button class="btn" type="button" id="i-cerrar">Cerrar incubación</button>` : ''}</div>` : h`<p class="muted peq">Incubación cerrada.</p>`}
      </form>
      ${inc.filas.some(f => !f.padre_id) ? h`<div class="aviso-caja aviso peq">Hay huevos sin padre conocido: esos pollitos no podrán pasar al Registro Definitivo. Forma lotes antes de la próxima incubación.</div>` : ''}`);

    const f = $('#f-inc-det', main);
    f.addEventListener('submit', async e => {
      e.preventDefault();
      const filas = inc.filas.map((_, i) => ({
        ...(puedeMiraje ? { claros: f.querySelector(`[data-claros="${i}"]`).value } : {}),
        ...(puedeNacidos ? { nacidos: f.querySelector(`[data-nacidos="${i}"]`).value } : {})
      }));
      try { await datos.actualizarIncubacion(inc.id, { filas }); dibujar(); aviso('Guardado.', 'ok'); } catch (err) { aviso(err.message, 'error'); }
    });
    $('#i-cerrar', main)?.addEventListener('click', async () => {
      if (!(await confirmar('Cerrar incubación', 'Ya no se podrán cambiar los claros ni los nacidos. Los pollitos pendientes se pueden seguir dando de alta.', 'Cerrar'))) return;
      try { await datos.actualizarIncubacion(inc.id, { cerrada: true }); } catch (err) { aviso(err.message, 'error'); }
    });
  };
  dibujar();
  return datos.suscribir(() => { if (!document.activeElement?.closest?.('form')) dibujar(); });
}
