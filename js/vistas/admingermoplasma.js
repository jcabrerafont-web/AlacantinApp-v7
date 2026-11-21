// Material genético almacenado (Protocolo CNZ 2025, apdo. 3.1 m): inventario de
// muestras de la raza conservadas en centros o bancos. Lo anota la administración.
import * as datos from '../datos.js';
import { h, pintar, $, aviso, confirmar, fecha, hoyISO, descargar, csv } from '../ui.js';

export default function (main) {
  let editando = null;
  const dibujar = () => {
    const r = datos.resumenGermoplasma();
    const T = datos.TIPOS_GERMOPLASMA;
    const e = editando ? r.lista.find(x => x.id === editando) : null;
    const anillaDe = (id) => datos.animal(id)?.anilla || '';
    pintar(main, h`
      <p class="peq"><a href="#/admin/expediente">‹ Expediente para el Catálogo</a></p>
      <h1>Material genético</h1>
      <p class="muted">Muestras de la raza guardadas fuera del aviario, para el apartado m) del expediente. En aves no se conservan ovocitos ni embriones: el germoplasma es el <strong>semen</strong> congelado y las <strong>células germinales primordiales (PGC)</strong>. El ADN y las células somáticas son otras colecciones útiles para estudios genéticos (RD 45/2019, art. 15).</p>

      <div class="kpis">
        <div class="kpi"><b>${r.germoplasma}</b><span>Muestras de germoplasma</span></div>
        <div class="kpi"><b>${r.reconocido}</b><span>En centros o bancos reconocidos</span></div>
        <div class="kpi"><b>${r.donantes}</b><span>Donantes identificados</span></div>
      </div>

      <div class="tarjeta" id="gm-lista"><h2>Inventario</h2>
        ${r.lista.length ? h`<div class="tabla-scroll"><table>
          <thead><tr><th>Fecha</th><th>Tipo</th><th class="num">Muestras</th><th>Donante</th><th>Centro</th><th></th></tr></thead>
          <tbody>${r.lista.map(x => h`<tr><td>${fecha(x.fecha)}</td><td>${T[x.tipo]}</td><td class="num">${x.muestras}</td>
            <td>${x.animal_id ? h`<a href="#/animal/${x.animal_id}">${anillaDe(x.animal_id)}</a>` : '—'}</td>
            <td>${x.centro}${x.centro_reconocido ? ' ✓' : ''}${x.referencia ? h`<br><span class="peq muted">${x.referencia}</span>` : ''}</td>
            <td><button class="btn btn-pequeno" data-editar="${x.id}">Editar</button></td></tr>`)}</tbody></table></div>
          <p class="peq muted">✓ Centro o banco reconocido por la autoridad competente.</p>
          <button class="btn" id="gm-csv">⬇️ Inventario (CSV)</button>`
        : h`<p class="muted">Todavía no hay muestras guardadas. Cuando el Club conserve semen, PGC o ADN de la raza, anótalas aquí: el expediente y la situación poblacional lo recogerán.</p>`}
      </div>

      <form class="tarjeta" id="gm-form"><h2>${e ? 'Editar registro' : 'Anotar muestras'}</h2>
        <div class="campo"><label for="gm-tipo">Tipo</label><select id="gm-tipo" required>
          <option value="">Elige…</option>${Object.entries(T).map(([k, n]) => h`<option value="${k}" ${e?.tipo === k ? h`selected` : ''}>${n}</option>`)}</select></div>
        <div class="campo"><label for="gm-muestras">Muestras (dosis, pajuelas o tubos)</label><input id="gm-muestras" type="number" min="1" step="1" inputmode="numeric" required value="${e?.muestras ?? ''}"></div>
        <div class="campo"><label for="gm-fecha">Fecha de recogida</label><input id="gm-fecha" type="date" max="${hoyISO()}" required value="${e?.fecha || ''}"></div>
        <div class="campo"><label for="gm-anilla">Anilla del donante (opcional)</label><input id="gm-anilla" autocomplete="off" placeholder="E2420000001" value="${e ? anillaDe(e.animal_id) : ''}"></div>
        <div class="campo"><label for="gm-centro">Centro o banco donde se guarda</label><input id="gm-centro" required value="${e?.centro || ''}"></div>
        <label class="check-grande neutro"><input type="checkbox" id="gm-reconocido" ${e?.centro_reconocido ? h`checked` : ''}> Reconocido o autorizado por la autoridad competente</label>
        <div class="campo"><label for="gm-ref">Referencia del centro (opcional)</label><input id="gm-ref" value="${e?.referencia || ''}"></div>
        <div class="campo"><label for="gm-notas">Notas (opcional)</label><textarea id="gm-notas" rows="2">${e?.notas || ''}</textarea></div>
        <div class="fila"><button class="btn btn-primario" type="submit">${e ? 'Guardar cambios' : 'Anotar'}</button>
          ${e ? h`<button class="btn" type="button" id="gm-cancelar">Cancelar</button><button class="btn btn-peligro" type="button" id="gm-borrar">Borrar</button>` : ''}</div>
      </form>`);

    main.querySelectorAll('[data-editar]').forEach(b => b.addEventListener('click', () => { editando = b.dataset.editar; dibujar(); $('#gm-form', main).scrollIntoView({ block: 'start' }); }));
    $('#gm-cancelar', main)?.addEventListener('click', () => { editando = null; dibujar(); });
    $('#gm-borrar', main)?.addEventListener('click', async () => {
      if (!await confirmar('¿Borrar este registro?', 'Se quitará del inventario de material genético.', 'Borrar', true)) return;
      await datos.borrarGermoplasma(editando); editando = null; aviso('Registro borrado', 'ok'); dibujar();
    });
    $('#gm-csv', main)?.addEventListener('click', () => {
      const filas = [['FECHA', 'TIPO', 'MUESTRAS', 'DONANTE', 'CENTRO', 'RECONOCIDO', 'REFERENCIA', 'NOTAS']];
      r.lista.forEach(x => filas.push([x.fecha, T[x.tipo], x.muestras, anillaDe(x.animal_id), x.centro, x.centro_reconocido ? 'sí' : 'no', x.referencia || '', x.notas || '']));
      descargar(csv(filas), `ESGA025_material_genetico_${hoyISO()}.csv`);
    });
    $('#gm-form', main).addEventListener('submit', async (ev) => {
      ev.preventDefault();
      try {
        await datos.guardarGermoplasma({ id: editando, tipo: $('#gm-tipo', main).value, muestras: $('#gm-muestras', main).value, fecha: $('#gm-fecha', main).value,
          anilla: $('#gm-anilla', main).value.trim(), centro: $('#gm-centro', main).value, centro_reconocido: $('#gm-reconocido', main).checked,
          referencia: $('#gm-ref', main).value, notas: $('#gm-notas', main).value });
        aviso(editando ? 'Cambios guardados' : 'Muestras anotadas', 'ok'); editando = null; dibujar();
      } catch (err) { aviso(err.message, 'error'); }
    });
  };
  dibujar();
}
