// Reproducción e incubación: lotes (gallo + gallinas), incubaciones y pollitos por dar de alta.
// Cierra el ciclo puesta -> incubación -> alta con padre y madre conocidos (filiación).
import * as datos from '../datos.js';
import { ESTANDAR, REGLAS } from '../estandar.js';
import { fxDescendencia, nivelFx } from '../genetica.js';
import { h, pintar, $, aviso, fecha, hoyISO, pct, confirmar } from '../ui.js';

const RP = REGLAS.reproduccion;
const FASES = { incubando: 'Incubando', miraje: 'Toca el miraje', nacedora: 'En nacedora', eclosion: 'Nacimiento', cerrada: 'Cerrada' };

export default function (main) {
  const p = datos.estado.perfil;
  let formLote = false, formInc = false;

  const dibujar = () => {
    const mias = datos.censo().filter(a => a.usuario_id === p.id && a.estado !== 'baja');
    const gallos = mias.filter(a => a.sexo === 'M');
    const gallinas = mias.filter(a => a.sexo === 'H');
    const lotes = datos.misLotes();
    const activos = lotes.filter(l => datos.loteActivo(l));
    const incs = datos.misIncubaciones();
    const pend = datos.pollitosPendientes();
    const anilla = (id) => datos.animal(id)?.anilla || '—';

    pintar(main, h`
      <h1>Reproducción e incubación</h1>
      <div class="aviso-caja info peq">1) Forma los <strong>lotes</strong>: cada gallo con sus gallinas (de ${RP.gallinasPorGallo[0]} a ${RP.gallinasPorGallo[1]}), uno por familia.
        2) Mete los huevos en la <strong>incubadora</strong> anotando de qué gallina es cada uno.
        3) Al nacer, <strong>da de alta los pollitos</strong>: la app ya sabe su padre y su madre. <a href="#/programa?s=familias">Más en la guía →</a></div>

      ${pend.length ? h`<div class="tarjeta"><h2>🐣 Pollitos por dar de alta (${pend.reduce((s, x) => s + x.pendientes, 0)})</h2>
        <ul class="lista">${pend.map(x => h`<li class="item"><div class="item-principal">
          <div class="item-titulo">${x.pendientes} de ${anilla(x.fila.madre_id)} × ${x.fila.padre_id ? anilla(x.fila.padre_id) : 'padre desconocido'}</div>
          <div class="item-sub">Nacidos el ${fecha(x.nacimiento)} · anilla en cuanto pase por el pie</div></div>
          <a class="btn btn-pequeno btn-primario" href="#/alta?inc=${x.inc.id}&madre=${x.fila.madre_id}${x.fila.padre_id ? `&padre=${x.fila.padre_id}` : ''}&fecha=${x.nacimiento}">Dar de alta</a></li>`)}</ul></div>` : ''}

      <div class="tarjeta"><div class="fila entre"><h2>Lotes de reproducción</h2>
        ${gallos.length && gallinas.length ? h`<button class="btn btn-pequeno" id="r-nuevo-lote">${formLote ? 'Cancelar' : '➕ Nuevo lote'}</button>` : ''}</div>
        ${!gallos.length || !gallinas.length ? h`<p class="muted peq">Necesitas al menos un gallo y una gallina en tu censo.</p>` : ''}
        ${formLote ? h`<form id="f-lote" novalidate class="sub-form">
          <div class="rejilla rejilla-2">
            <div class="campo"><label for="l-familia">Familia</label><select id="l-familia"><option value="">Sin familia</option>${ESTANDAR.familias.map(f => h`<option value="${f}">Familia ${f}</option>`)}</select></div>
            <div class="campo"><label for="l-gallo">Gallo</label><select id="l-gallo">${gallos.map(g => h`<option value="${g.id}">${g.anilla}${g.nombre ? ` · ${g.nombre}` : ''}${g.familia ? ` (fam. ${g.familia})` : ''}</option>`)}</select></div>
            <div class="campo"><label for="l-inicio">Juntos desde</label><input id="l-inicio" type="date" value="${hoyISO()}" max="${hoyISO()}"></div>
          </div>
          <fieldset><legend>Gallinas del lote</legend><div id="l-gallinas"></div></fieldset>
          <p class="ayuda">Los huevos se atribuyen a este gallo a partir de ${RP.diasEsperaCambioGallo} días después de juntarlos: antes pueden estar fecundados por el gallo anterior.</p>
          <button class="btn btn-primario btn-bloque" type="submit">Guardar lote</button></form>` : ''}
        ${lotes.length ? h`<ul class="lista">${lotes.map(l => {
          const fiable = datos.fechaFiable(l);
          const est = !datos.loteActivo(l) ? 'cerrado' : hoyISO() < fiable ? `en espera hasta ${fecha(fiable)}` : 'activo';
          return h`<li class="item"><div class="item-principal">
            <div class="item-titulo">${l.familia ? `Familia ${l.familia} · ` : ''}${anilla(l.gallo_id)} con ${l.gallinas.length} gallina(s)</div>
            <div class="item-sub">${fecha(l.inicio)}${l.fin ? ` – ${fecha(l.fin)}` : ''} · ${l.gallinas.map(anilla).join(', ')}</div></div>
            <span class="chip ${est === 'activo' ? 'chip-ok' : est === 'cerrado' ? '' : 'chip-aviso'}">${est}</span>
            ${datos.loteActivo(l) ? h`<button class="btn btn-pequeno" data-cerrar="${l.id}">Separar</button>` : ''}</li>`;
        })}</ul>` : h`<p class="muted peq">Aún no hay lotes. Sin lote, la app no puede saber el padre de los pollitos.</p>`}
      </div>

      <div class="tarjeta"><div class="fila entre"><h2>Incubaciones</h2>
        ${gallinas.length ? h`<button class="btn btn-pequeno" id="r-nueva-inc">${formInc ? 'Cancelar' : '➕ Nueva incubación'}</button>` : ''}</div>
        ${formInc ? h`<form id="f-inc" novalidate class="sub-form">
          <div class="campo"><label for="i-entrada">Entrada en la incubadora (día 0)</label><input id="i-entrada" type="date" value="${hoyISO()}" max="${hoyISO()}"></div>
          <p class="peq muted">Huevos por gallina. Se proponen sus huevos aptos (desde ${ESTANDAR.huevo.min} g) registrados en los últimos ${RP.diasMaxHuevo} días; puedes cambiar el número. Marca cada huevo a lápiz con la gallina.</p>
          <div id="i-filas"></div>
          <button class="btn btn-primario btn-bloque" type="submit">Meter en la incubadora</button></form>` : ''}
        ${incs.length ? h`<ul class="lista">${incs.map(inc => {
          const r = datos.resultadoIncubacion(inc);
          const fase = datos.faseIncubacion(inc);
          const c = datos.calendarioIncubacion(inc.entrada);
          return h`<li><a class="item" href="#/incubacion/${inc.id}"><span class="item-principal">
            <span class="item-titulo">${fecha(inc.entrada)} · ${r.puestos} huevos de ${inc.filas.length} gallina(s)</span>
            <span class="item-sub">${fase === 'incubando' ? `Miraje el ${fecha(c.miraje)}` : fase === 'miraje' ? `Nacedora el ${fecha(c.nacedora)}` : fase === 'nacedora' ? `Nacimiento el ${fecha(c.eclosion)}` : ''}
              ${r.fertilidad !== null ? ` · fertilidad ${pct(r.fertilidad, 0)}` : ''}${r.nacimiento !== null ? ` · nacimiento ${pct(r.nacimiento, 0)}` : ''}</span></span>
            <span class="chip ${fase === 'cerrada' ? '' : fase === 'incubando' ? 'chip-info' : 'chip-aviso'}">${FASES[fase]}</span></a></li>`;
        })}</ul>` : h`<p class="muted peq">Aún no hay incubaciones.</p>`}
      </div>`);

    $('#r-nuevo-lote', main)?.addEventListener('click', () => { formLote = !formLote; dibujar(); });
    $('#r-nueva-inc', main)?.addEventListener('click', () => { formInc = !formInc; dibujar(); });
    main.querySelectorAll('[data-cerrar]').forEach(b => b.addEventListener('click', async () => {
      const id = b.dataset.cerrar;
      try {
        await datos.cerrarLote(id);
        dibujar();
        aviso('Lote separado: termina hoy.', 'ok', { accion: { texto: 'Deshacer', fn: async () => { await datos.reabrirLote(id); dibujar(); aviso('Lote activo de nuevo.', 'ok'); } } });
      } catch (e) { aviso(e.message, 'error'); }
    }));

    // Formulario de lote: gallinas con la consanguinidad esperada con el gallo elegido
    const fl = $('#f-lote', main);
    if (fl) {
      const pintarGallinas = () => {
        const gallo = $('#l-gallo', fl).value;
        const ocupadas = new Set(activos.flatMap(l => l.gallinas));
        pintar($('#l-gallinas', fl), h`${gallinas.map(g => {
          const fx = fxDescendencia(gallo, g.id, datos.estado.idx);
          const n = nivelFx(fx);
          return h`<label class="check-grande neutro"><input type="checkbox" name="l-g" value="${g.id}" ${ocupadas.has(g.id) ? h`disabled` : ''}>
            ${g.anilla}${g.familia ? ` · fam. ${g.familia}` : ''} <span class="chip ${n.nivel === 'alerta' ? 'chip-alerta' : n.nivel === 'precaucion' ? 'chip-aviso' : 'chip-ok'}" title="Consanguinidad de los pollitos">Fx ${pct(fx, 1)}</span>
            ${ocupadas.has(g.id) ? h`<span class="muted peq">ya en otro lote</span>` : ''}</label>`;
        })}`);
      };
      $('#l-gallo', fl).addEventListener('change', pintarGallinas);
      pintarGallinas();
      fl.addEventListener('submit', async e => {
        e.preventDefault();
        try {
          const l = await datos.guardarLote({ familia: $('#l-familia', fl).value, gallo_id: $('#l-gallo', fl).value, inicio: $('#l-inicio', fl).value,
            gallinas: [...fl.querySelectorAll('input[name=l-g]:checked')].map(x => x.value) });
          formLote = false;
          dibujar();
          aviso(`Lote guardado. Sus huevos cuentan como hijos de ${anilla(l.gallo_id)} desde el ${fecha(datos.fechaFiable(l))}.`, 'ok');
        } catch (err) { aviso(err.message, 'error'); }
      });
    }

    // Formulario de incubación: una fila por gallina con sus huevos disponibles
    const fi = $('#f-inc', main);
    if (fi) {
      const pintarFilas = () => {
        const entrada = $('#i-entrada', fi).value || hoyISO();
        pintar($('#i-filas', fi), h`<div class="tabla-scroll"><table><thead><tr><th>Gallina</th><th>Padre (lote)</th><th class="num">Huevos</th></tr></thead><tbody>
          ${gallinas.map(g => {
            const disp = datos.huevosDisponibles(g.id, entrada);
            const pd = datos.padreDe(g.id, entrada);
            return h`<tr><td>${g.anilla}</td>
              <td>${pd ? h`${anilla(pd.gallo_id)}${pd.fiable ? '' : h` <span class="chip chip-aviso" title="Menos de ${RP.diasEsperaCambioGallo} días juntos">en espera</span>`}` : h`<span class="muted">sin lote</span>`}</td>
              <td class="num"><input type="number" inputmode="numeric" min="0" max="40" value="${disp.length || ''}" data-madre="${g.id}" style="width:4.5rem" aria-label="Huevos de ${g.anilla}"></td></tr>`;
          })}</tbody></table></div>`);
      };
      $('#i-entrada', fi).addEventListener('change', pintarFilas);
      pintarFilas();
      fi.addEventListener('submit', async e => {
        e.preventDefault();
        const entrada = $('#i-entrada', fi).value;
        const filas = [...fi.querySelectorAll('[data-madre]')].filter(x => Number(x.value) > 0)
          .map(x => ({ madre_id: x.dataset.madre, puestos: Number(x.value), huevos: datos.huevosDisponibles(x.dataset.madre, entrada).map(hv => hv.id) }));
        const sinPadre = filas.filter(f => !datos.padreDe(f.madre_id, entrada));
        if (sinPadre.length && !(await confirmar('Huevos sin padre conocido', `${sinPadre.map(f => anilla(f.madre_id)).join(', ')} no está en ningún lote: sus pollitos no tendrán padre y no podrán pasar al Registro Definitivo. ¿Continuar?`, 'Continuar'))) return;
        try {
          const inc = await datos.crearIncubacion({ entrada, filas });
          formInc = false;
          aviso(`Incubación registrada: miraje el ${fecha(datos.calendarioIncubacion(entrada).miraje)}.`, 'ok');
          location.hash = `#/incubacion/${inc.id}`;
        } catch (err) { aviso(err.message, 'error'); }
      });
    }
  };
  dibujar();
  return datos.suscribir(() => { if (!document.activeElement?.closest?.('form')) dibujar(); });
}
