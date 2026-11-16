// Ficha de conformidad con el Estándar (inspector / administrador)
import * as datos from '../datos.js';
import { ESTANDAR, evaluarConformidad, nombreVariedad, sexoTexto, variedadPorId, pesoConforme } from '../estandar.js';
import * as docs from '../documentos.js';
import { h, pintar, $, aviso, confirmar } from '../ui.js';

export default function (main, { id }) {
  const a = datos.animal(id);
  if (!a) { pintar(main, h`<div class="tarjeta"><h2>Ejemplar no encontrado</h2></div>`); return; }
  const v = variedadPorId(a.variedad);
  const sexoTxt = a.sexo === 'M' ? 'gallo' : 'gallina';
  const defectosAplicables = ESTANDAR.defectosGraves.filter(d => !(d.soloVariedadesFlameado && !v?.flameadoDescalifica));
  let posicion = null;

  pintar(main, h`
    <p><a href="#/animal/${a.id}">← ${a.anilla}</a></p>
    <h1>Calificación de ${a.anilla}</h1>
    <p class="muted">${sexoTexto(a.sexo)} · ${nombreVariedad(a.variedad)} · ${a.seccion}</p>
    ${!v?.oficial ? h`<div class="aviso-caja aviso">Variedad en proceso de reconocimiento: la calificación queda registrada, pero no da acceso al Registro Definitivo.</div>` : ''}
    <form id="form-cal" novalidate>
      <fieldset class="tarjeta"><legend>Defectos graves del Estándar</legend>
        ${defectosAplicables.map(d => h`<label class="check-grande"><input type="checkbox" name="defecto" value="${d.id}"> ${d.texto}</label>`)}
      </fieldset>
      <div class="tarjeta"><h2>Regiones (Estándar ${ESTANDAR.codigo})</h2>
        <p class="muted peq">Marca cada región como conforme (✓) o no conforme (✗). Pulsa sobre el nombre para ver el texto del Estándar para el ${sexoTxt}.</p>
        ${ESTANDAR.regiones.map((r, i) => h`<div class="region">
          <div class="region-cab">
            <details style="flex:1"><summary><strong>${i + 1}. ${r.nombre}</strong></summary><p class="peq">${a.sexo === 'M' ? r.gallo : r.gallina}</p></details>
            <div class="segmentado" role="radiogroup" aria-label="${r.nombre}">
              <label><input type="radio" name="r-${r.id}" value="si"><span class="si">✓</span></label>
              <label><input type="radio" name="r-${r.id}" value="no"><span class="no">✗</span></label>
            </div>
          </div>
          <input class="peq" name="n-${r.id}" placeholder="Observación (opcional)" style="margin-top:.4rem;min-height:36px" hidden>
        </div>`)}
        <button type="button" class="btn btn-pequeno" id="todo-conforme">Marcar el resto como conforme</button>
      </div>
      <div class="tarjeta">
        <div class="campo"><label for="c-peso">Peso en báscula (g)</label>
          <input id="c-peso" type="number" inputmode="numeric" min="30" max="6000" value="${a.peso_g ?? ''}">
          <p class="ayuda" id="c-peso-ayuda"></p></div>
        <div class="campo"><label for="c-obs">Observaciones</label><textarea id="c-obs"></textarea></div>
        <div id="c-resumen" class="aviso-caja info"></div>
        <div class="campo"><label for="c-res">Resultado</label>
          <select id="c-res"><option>Apto</option><option>No apto</option></select></div>
        <div class="fila"><button class="btn" type="button" id="c-gps">📍 Registrar ubicación</button><span id="c-gps-txt" class="muted peq"></span></div>
        <button class="btn btn-primario btn-bloque" type="submit" style="margin-top:1rem">Cerrar ficha y generar acta</button>
      </div>
    </form>`);

  const f = $('#form-cal', main);
  const leer = () => {
    const regiones = {};
    ESTANDAR.regiones.forEach(r => {
      const val = f.querySelector(`input[name="r-${r.id}"]:checked`)?.value;
      const nota = f.querySelector(`[name="n-${r.id}"]`);
      nota.hidden = val !== 'no';
      if (val) regiones[r.id] = { conforme: val === 'si', ...(val === 'no' && nota.value.trim() ? { nota: nota.value.trim() } : {}) };
    });
    const defectos = [...f.querySelectorAll('input[name=defecto]:checked')].map(x => x.value);
    return { regiones, defectos, pesoG: $('#c-peso', f).value ? Number($('#c-peso', f).value) : null };
  };
  const refrescar = () => {
    const l = leer();
    const ev = evaluarConformidad({ sexo: a.sexo, variedad: a.variedad, ...l });
    const res = $('#c-res', f);
    if (ev.defectosGraves.length) { res.value = 'No apto'; res.querySelector('option').disabled = true; }
    else res.querySelector('option').disabled = false;
    const r = ESTANDAR.peso[a.sexo];
    const conf = pesoConforme(a.sexo, l.pesoG);
    $('#c-peso-ayuda', f).textContent = `Estándar: ${r.min}–${r.max} g${conf === null ? '' : conf ? ' · ✓ conforme' : ' · fuera de rango'}`;
    const box = $('#c-resumen', f);
    box.className = `aviso-caja ${ev.defectosGraves.length ? 'alerta' : ev.noConformes.length ? 'aviso' : 'ok'}`;
    box.textContent = `Regiones evaluadas: ${12 - ev.sinEvaluar.length}/12 · No conformes: ${ev.noConformes.length} · Defectos graves: ${ev.defectosGraves.length}` +
      ` · Propuesta: ${ev.propuesta}${ev.propuesta === 'Apto' && !ev.accedeRD ? ' (sin acceso a RD)' : ''}`;
    f.dataset.sucio = '1';
  };
  f.addEventListener('change', refrescar);
  f.addEventListener('input', refrescar);
  $('#todo-conforme', f).addEventListener('click', () => {
    ESTANDAR.regiones.forEach(r => {
      if (!f.querySelector(`input[name="r-${r.id}"]:checked`)) f.querySelector(`input[name="r-${r.id}"][value="si"]`).checked = true;
    });
    refrescar();
  });
  $('#c-gps', f).addEventListener('click', () => {
    navigator.geolocation?.getCurrentPosition(p => {
      posicion = { latitud: Math.round(p.coords.latitude * 1e6) / 1e6, longitud: Math.round(p.coords.longitude * 1e6) / 1e6 };
      $('#c-gps-txt', f).textContent = `${posicion.latitud.toFixed(5)}, ${posicion.longitud.toFixed(5)}`;
    }, () => aviso('No se pudo obtener la ubicación.', 'error'), { enableHighAccuracy: true, timeout: 20000 });
  });
  refrescar();
  f.dataset.sucio = '';

  f.addEventListener('submit', async e => {
    e.preventDefault();
    const l = leer();
    const resultado = $('#c-res', f).value;
    if (!(await confirmar('Cerrar ficha', `Resultado: ${resultado}. La ficha no se puede modificar después.`, 'Cerrar ficha'))) return;
    try {
      const c = await datos.guardarCalificacion({ animalId: a.id, ...l, resultado, observaciones: $('#c-obs', f).value.trim(), posicion });
      f.dataset.sucio = '';
      const actual = datos.animal(a.id);
      aviso(`Ficha registrada: ${resultado}${actual.seccion !== a.seccion ? ` · pasa a ${actual.seccion}` : ''}`, 'ok');
      const titular = datos.estado.perfiles.find(x => x.id === a.usuario_id);
      docs.acta(actual, c, titular);
      location.hash = `#/animal/${a.id}`;
    } catch (err) { aviso(err.message, 'error'); }
  });
}
