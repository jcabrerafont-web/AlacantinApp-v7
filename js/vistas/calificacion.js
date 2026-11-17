// Calificación morfológica: baremo de 100 puntos en las 12 regiones del Estándar (inspector / administrador)
import * as datos from '../datos.js';
import { ESTANDAR, REGLAS, BAREMO, evaluarCalificacion, nombreVariedad, sexoTexto, variedadPorId, pesoConforme } from '../estandar.js';
import * as docs from '../documentos.js';
import { h, pintar, $, aviso, confirmar } from '../ui.js';

const coma = (n) => String(n).replace('.', ',');

export default function (main, { id }) {
  const a = datos.animal(id);
  if (!a) { pintar(main, h`<div class="tarjeta"><h2>Ejemplar no encontrado</h2></div>`); return; }
  const v = variedadPorId(a.variedad);
  const defectosAplicables = ESTANDAR.defectosGraves.filter(d => !(d.soloVariedadesFlameado && !v?.flameadoDescalifica));
  let posicion = null;

  pintar(main, h`
    <p><a href="#/animal/${a.id}">← ${a.anilla}</a></p>
    <h1>Calificación de ${a.anilla}</h1>
    <p class="muted">${sexoTexto(a.sexo)} · ${nombreVariedad(a.variedad)} · ${a.seccion}</p>
    <div class="aviso-caja info peq">Baremo en fase de <strong>propuesta</strong>, pendiente de ratificar por la Dirección Técnica. Clases: ${BAREMO.clases.map(c => `${c.id} ≥ ${c.min}`).join(' · ')}. Apto: ${REGLAS.puntosMinimosApto[a.sexo]} puntos o más (${a.sexo === 'M' ? 'gallos' : 'gallinas'}).</div>
    ${!v?.oficial ? h`<div class="aviso-caja aviso">Variedad en proceso de reconocimiento: la calificación queda registrada, pero no da acceso al Registro Definitivo.</div>` : ''}
    <form id="form-cal" novalidate>
      <div class="tarjeta marcador" aria-live="polite"><div><b id="c-total">0</b> <span class="muted">/ 100</span></div><span id="c-clase" class="chip">—</span></div>
      <fieldset class="tarjeta"><legend>Defectos descalificantes del Estándar</legend>
        ${defectosAplicables.map(d => h`<label class="check-grande"><input type="checkbox" name="defecto" value="${d.id}"> ${d.texto}</label>`)}
      </fieldset>
      <div class="tarjeta"><h2>Regiones (Estándar ${ESTANDAR.codigo})</h2>
        <p class="muted peq">Puntúa cada región de 0 a su máximo, en pasos de 0,5. Pulsa sobre el nombre para ver el texto del Estándar para ${a.sexo === 'M' ? 'el gallo' : 'la gallina'}.</p>
        ${BAREMO.apartados.map((x, i) => h`<div class="region" data-apartado="${x.id}">
          <div class="region-cab">
            <details style="flex:1"><summary><strong>${i + 1}. ${x.nombre}</strong></summary>
              <p class="peq">${a.sexo === 'M' ? x.gallo : x.gallina}${x.id === 'plumaje' && v ? ` ${v.detalle}` : ''}</p></details>
            <div class="puntos">
              <button type="button" data-paso="-1" aria-label="Restar 0,5 a ${x.nombre}">−</button>
              <input name="p-${x.id}" inputmode="decimal" autocomplete="off" aria-label="Puntos de ${x.nombre} (máximo ${x.max})">
              <button type="button" data-paso="1" aria-label="Sumar 0,5 a ${x.nombre}">+</button>
              <span class="max">/ ${x.max}</span>
            </div>
          </div>
        </div>`)}
        <button type="button" class="btn btn-pequeno" id="todo-max">Poner el máximo en las regiones vacías</button>
      </div>
      <div class="tarjeta">
        <div class="campo"><label for="c-peso">Peso en báscula (g) <span class="muted">· obligatorio</span></label>
          <input id="c-peso" type="number" inputmode="numeric" min="30" max="6000" required>
          <p class="ayuda" id="c-peso-ayuda"></p></div>
        <div class="campo"><label for="c-obs">Observaciones</label><textarea id="c-obs"></textarea></div>
        <div id="c-resumen" class="aviso-caja info"></div>
        <div class="fila"><button class="btn" type="button" id="c-gps">📍 Registrar ubicación</button><span id="c-gps-txt" class="muted peq"></span></div>
        <button class="btn btn-primario btn-bloque" type="submit" style="margin-top:1rem">Cerrar ficha y generar acta</button>
      </div>
    </form>`);

  const f = $('#form-cal', main);
  const campo = (apId) => f.querySelector(`[name="p-${apId}"]`);
  const leer = () => ({
    puntos: Object.fromEntries(BAREMO.apartados.map(x => [x.id, campo(x.id).value.trim()]).filter(([, val]) => val !== '')),
    defectos: [...f.querySelectorAll('input[name=defecto]:checked')].map(x => x.value),
    pesoG: $('#c-peso', f).value ? Number($('#c-peso', f).value) : null
  });
  const refrescar = () => {
    const l = leer();
    const ev = evaluarCalificacion({ sexo: a.sexo, variedad: a.variedad, fechaNacimiento: a.fecha_nacimiento, ...l });
    BAREMO.apartados.forEach(x => f.querySelector(`[data-apartado="${x.id}"]`).classList.toggle('invalido', ev.invalidos.includes(x.id)));
    $('#c-total', f).textContent = coma(ev.total);
    const chip = $('#c-clase', f);
    chip.textContent = ev.completa || ev.clase === 'D' ? `${ev.clase} · ${ev.claseNombre}` : `${BAREMO.apartados.length - ev.sinPuntuar.length}/${BAREMO.apartados.length} regiones`;
    chip.className = `chip ${ev.clase === 'D' ? 'chip-alerta' : !ev.completa ? '' : ev.resultado === 'Apto' ? 'chip-ok' : 'chip-aviso'}`;
    const r = ESTANDAR.peso[a.sexo];
    const conf = pesoConforme(a.sexo, l.pesoG);
    $('#c-peso-ayuda', f).textContent = `Estándar: ${r.min}–${r.max} g${conf === null ? '' : conf ? ' · ✓ conforme' : ' · fuera de rango'}`;
    const box = $('#c-resumen', f);
    box.className = `aviso-caja ${ev.clase === 'D' ? 'alerta' : !ev.completa ? 'info' : ev.resultado === 'Apto' ? 'ok' : 'aviso'}`;
    box.textContent = !ev.completa && ev.clase !== 'D'
      ? `Faltan ${ev.sinPuntuar.length} región(es)${ev.invalidos.length ? ` y hay ${ev.invalidos.length} fuera de rango` : ''}.`
      : `Total ${coma(ev.total)} · ${ev.claseNombre} · Resultado: ${ev.resultado}` +
        (ev.motivos.length ? ` · ${ev.motivos.join(' · ')}` : '');
    f.dataset.sucio = '1';
  };
  f.addEventListener('input', refrescar);
  f.addEventListener('change', refrescar);
  f.addEventListener('click', e => {
    const b = e.target.closest('button[data-paso]');
    if (!b) return;
    const apId = b.closest('[data-apartado]').dataset.apartado;
    const max = BAREMO.apartados.find(x => x.id === apId).max;
    const c = campo(apId);
    const actual = Number(c.value.replace(',', '.'));
    // Vacío: se parte del máximo (se califica descontando)
    const nuevo = c.value.trim() === '' || !Number.isFinite(actual) ? max : actual + Number(b.dataset.paso) * BAREMO.paso;
    c.value = coma(Math.min(max, Math.max(0, Math.round(nuevo * 2) / 2)));
    refrescar();
  });
  $('#todo-max', f).addEventListener('click', () => {
    BAREMO.apartados.forEach(x => { if (!campo(x.id).value.trim()) campo(x.id).value = String(x.max); });
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
    const ev = evaluarCalificacion({ sexo: a.sexo, variedad: a.variedad, fechaNacimiento: a.fecha_nacimiento, ...l });
    if (!ev.completa) { aviso(ev.invalidos.length ? 'Hay puntuaciones fuera de rango.' : `Faltan ${ev.sinPuntuar.length} región(es) por puntuar.`, 'error'); return; }
    if (ev.pesoConforme === null) { aviso('Pesa al animal y anota el peso en gramos.', 'error'); $('#c-peso', f).focus(); return; }
    if (!(await confirmar('Cerrar ficha', `${coma(ev.total)} puntos · ${ev.claseNombre} · ${ev.resultado}. Peso ${l.pesoG} g (${ev.pesoConforme ? 'conforme' : 'fuera del rango del Estándar'}). La ficha no se puede modificar después.`, 'Cerrar ficha'))) return;
    try {
      const c = await datos.guardarCalificacion({ animalId: a.id, ...l, observaciones: $('#c-obs', f).value.trim(), posicion });
      f.dataset.sucio = '';
      const actual = datos.animal(a.id);
      aviso(`Ficha registrada: ${c.clase} (${coma(c.total)}) · ${c.resultado}${actual.seccion !== a.seccion ? ` · pasa a ${actual.seccion}` : ''}`, 'ok');
      const titular = datos.estado.perfiles.find(x => x.id === a.usuario_id);
      docs.acta(actual, c, titular);
      location.hash = `#/animal/${a.id}`;
    } catch (err) { aviso(err.message, 'error'); }
  });
}
