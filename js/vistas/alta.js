// Alta rápida / edición de ejemplar. Campos mínimos visibles; el resto en "Más datos".
import * as datos from '../datos.js';
import { esAuditor } from '../auth.js';
import { ESTANDAR, REGLAS, pesoConforme, sexoTexto, parsearAnilla, componerAnilla, comprobarAnilla } from '../estandar.js';
import { fxDescendencia, nivelFx, familiaDescendencia } from '../genetica.js';
import { h, pintar, $, aviso, pct, hoyISO, fechaLocal, comprimirFoto } from '../ui.js';

const FOTOS = [['lateral', 'Vista lateral'], ['cabeza', 'Cabeza y orejilla'], ['tarsos', 'Tarsos']];

export default function (main, params) {
  const p = datos.estado.perfil;
  const previo = params.id ? datos.animal(params.id) : null;
  if (params.id && (!previo || !datos.puedeEditar(previo))) {
    pintar(main, h`<div class="tarjeta"><h2>No se puede editar</h2><p>Solo el titular puede modificar este ejemplar.</p></div>`);
    return;
  }
  const a = previo || { sexo: '', variedad: '', fecha_nacimiento: '', seccion: 'RN', fotos: {} };
  const fotos = { ...(a.fotos || {}) };
  const fotosFecha = { ...(a.fotos_fecha || {}) };
  const pa = parsearAnilla(a.anilla);
  const machos = datos.estado.todos.filter(x => x.sexo === 'M' && x.estado !== 'baja' && x.id !== a.id);
  const hembras = datos.estado.todos.filter(x => x.sexo === 'H' && x.estado !== 'baja' && x.id !== a.id);
  const etiqueta = (x) => `${x.anilla}${x.nombre ? ' · ' + x.nombre : ''}${x.usuario_id !== p.id ? ' (otro criador)' : ''}`;
  const puedeSeccionFundacional = esAuditor(p.rol);
  const sinAviario = !p.rega && !p.municipio;

  pintar(main, h`
    <h1>${previo ? `Editar ${previo.anilla}` : 'Alta rápida'}</h1>
    ${sinAviario ? h`<div class="aviso-caja aviso">Completa <a href="#/perfil">Mi aviario</a> (REGA y municipio): cada alta los hereda automáticamente.</div>`
      : h`<p class="muted peq">Aviario: ${p.rega || 'REGA pendiente'} · ${p.municipio || '—'}${p.latitud ? ' · ubicación registrada' : ''}</p>`}
    <form id="form-alta" class="tarjeta" novalidate>
      <div class="rejilla rejilla-2">
        <div class="campo"><label for="a-num">Nº de anilla EE *</label>
          <div class="fila" style="gap:.5rem;flex-wrap:nowrap">
            <input id="a-num" required inputmode="numeric" autocomplete="off" maxlength="6" style="flex:1" value="${pa ? String(Number(pa.numero)) : ''}" placeholder="Número grabado">
            <select id="a-diam" aria-label="Diámetro de la anilla (mm)" style="width:6.5rem">
              ${[18, 20, 22].map(d => h`<option value="${d}">${d} mm</option>`)}</select>
          </div>
          <p class="ayuda" id="a-anilla-ayuda">Anilla oficial EE de FESACOCUR. El año lo pone la fecha de nacimiento.</p></div>
        <div class="campo"><label id="a-sexo-et">Sexo *</label>
          <input type="hidden" id="a-sexo" value="${a.sexo || ''}">
          <div class="opciones" role="radiogroup" aria-labelledby="a-sexo-et">
            <label data-sexo="M"><input type="radio" name="a-sexo-r" value="M" ${a.sexo === 'M' ? h`checked` : ''}><span>♂ Gallo</span></label>
            <label data-sexo="H"><input type="radio" name="a-sexo-r" value="H" ${a.sexo === 'H' ? h`checked` : ''}><span>♀ Gallina</span></label>
          </div></div>
        <div class="campo"><label for="a-variedad">Variedad *</label>
          <select id="a-variedad" required><option value="">Elegir…</option>
            <optgroup label="Oficiales">${ESTANDAR.variedades.filter(v => v.oficial).map(v => h`<option value="${v.id}">${v.nombre}</option>`)}</optgroup>
            <optgroup label="En proceso de reconocimiento">${ESTANDAR.variedades.filter(v => !v.oficial).map(v => h`<option value="${v.id}">${v.nombre}</option>`)}</optgroup>
          </select></div>
        <div class="campo"><label for="a-fecha">Fecha de nacimiento *</label>
          <input id="a-fecha" type="date" required max="${hoyISO()}" value="${a.fecha_nacimiento || ''}"></div>
        <div class="campo"><label for="a-madre">Madre</label>
          <select id="a-madre"><option value="">Desconocida / fundadora</option>${hembras.map(x => h`<option value="${x.id}">${etiqueta(x)}</option>`)}</select></div>
        <div class="campo"><label for="a-padre">Padre</label>
          <select id="a-padre"><option value="">Desconocido / fundador</option>${machos.map(x => h`<option value="${x.id}">${etiqueta(x)}</option>`)}</select>
          <p class="ayuda">Si la madre está en un lote de reproducción, se propone su gallo.</p></div>
      </div>
      <div id="a-fx" class="aviso-caja info" hidden></div>

      <details ${previo ? h`open` : ''}>
        <summary><strong>Más datos</strong> <span class="muted peq">(peso, familia, chip, fotos, notas)</span></summary>
        <div class="rejilla rejilla-2" style="margin-top:.75rem">
          <div class="campo"><label for="a-peso">Peso (g)</label>
            <input id="a-peso" type="number" inputmode="numeric" min="30" max="6000" step="1" value="${a.peso_g ?? ''}">
            <p class="ayuda" id="a-peso-ayuda"></p></div>
          <div class="campo"><label for="a-familia">Familia (rotación de Gobe)</label>
            <select id="a-familia"><option value="">Sin asignar</option>${ESTANDAR.familias.map(f => h`<option value="${f}">Familia ${f}</option>`)}</select>
            <p class="ayuda">Por defecto, la de la madre.</p></div>
          <div class="campo"><label for="a-nombre">Nombre (opcional)</label><input id="a-nombre" value="${a.nombre || ''}"></div>
          <div class="campo"><label for="a-rfid">Chip RFID (opcional)</label>
            <input id="a-rfid" inputmode="numeric" autocomplete="off" value="${a.rfid || ''}" placeholder="15 dígitos ISO 11784/85">
            <p class="ayuda">Con un lector Bluetooth/USB en modo teclado basta con leer el chip aquí.</p></div>
          ${!previo && puedeSeccionFundacional ? h`<div class="campo"><label for="a-seccion">Sección del libro</label>
            <select id="a-seccion"><option value="RN">RN · Registro de Nacimientos</option>
              <option value="RF">RF · Registro Fundacional</option><option value="RA">RA · Registro Auxiliar</option></select></div>` : ''}
        </div>
        <fieldset><legend>Fotografías (recomendadas)</legend>
          <details class="peq" style="margin-bottom:.5rem"><summary>📷 Cómo hacer una foto que sirva al Club</summary>
            <ul>
              <li><strong>De perfil</strong>, el animal entero, de pie y tranquilo (la vista lateral es la más importante).</li>
              <li><strong>Fondo liso</strong> y claro (una pared o una tela), sin otros animales ni objetos.</li>
              <li>Buena luz natural, sin contraluz; cámara a la altura del animal.</li>
              <li>Las fotos de perfil de gallos y gallinas de cada variedad y edad forman el expediente del Club para el Catálogo Oficial y para FESACOCUR.</li>
            </ul></details>
          <div class="fotos">${FOTOS.map(([k, t]) => h`<label class="foto" id="foto-${k}">
            <span>${t}</span><input type="file" accept="image/*" capture="environment" data-foto="${k}" aria-label="${t}"></label>`)}</div>
        </fieldset>
        <div class="campo"><label for="a-notas">Notas</label><textarea id="a-notas">${a.notas || ''}</textarea></div>
      </details>

      <p class="peq" style="margin-top:1rem"><a href="${previo ? `#/animal/${previo.id}` : '#/censo'}">Cancelar y volver</a>${previo ? '' : ' · «Registrar y otro» guarda y prepara el siguiente de la pollada (misma madre, padre, fecha y variedad; anilla siguiente).'}</p>
      <div class="acciones-fijas acciones-una-fila">
        <button class="btn btn-primario" type="submit">${previo ? 'Guardar cambios' : 'Registrar'}</button>
        ${previo ? '' : h`<button class="btn" type="submit" id="a-otro">Registrar y otro</button>`}
      </div>
    </form>`);

  const f = $('#form-alta', main);
  $('#a-sexo', f).value = a.sexo || '';
  if (pa) { $('#a-diam', f).value = String(pa.diametro); $('#a-diam', f).dataset.sexo = a.sexo; }
  else $('#a-diam', f).value = String(ESTANDAR.anilla.M);
  $('#a-variedad', f).value = a.variedad || '';
  $('#a-padre', f).value = a.padre_id || '';
  $('#a-madre', f).value = a.madre_id || '';
  // Alta de un pollito desde una incubación: padre, madre y fecha de nacimiento ya puestos
  let propuestoPara = null; // propone el padre una sola vez por madre elegida
  const q = new URLSearchParams(location.hash.split('?')[1] || '');
  const desdeInc = !previo && q.get('inc') ? { inc: q.get('inc'), madre: q.get('madre') } : null;
  // Datos que vienen de la incubación o de «Guardar y otro» (alta en serie de una pollada)
  if (!previo) {
    if (q.get('madre') && datos.animal(q.get('madre'))) $('#a-madre', f).value = q.get('madre');
    if (q.get('padre') && datos.animal(q.get('padre'))) $('#a-padre', f).value = q.get('padre');
    if (/^\d{4}-\d{2}-\d{2}$/.test(q.get('fecha') || '')) $('#a-fecha', f).value = q.get('fecha');
    if (ESTANDAR.variedades.some(v => v.id === q.get('variedad'))) $('#a-variedad', f).value = q.get('variedad');
    if (/^\d{1,6}$/.test(q.get('num') || '')) $('#a-num', f).value = q.get('num');
  }
  $('#a-familia', f).value = a.familia || (!previo && ESTANDAR.familias.includes(q.get('familia')) ? q.get('familia') : '');
  // Sexo con dos botones grandes (un toque) en vez de un desplegable
  f.querySelectorAll('input[name=a-sexo-r]').forEach(r => r.addEventListener('change', () => {
    $('#a-sexo', f).value = r.value;
    $('#a-sexo', f).dispatchEvent(new Event('change', { bubbles: true }));
  }));

  const pintarFoto = (k) => {
    const cont = $(`#foto-${k}`, f);
    const img = cont.querySelector('img');
    if (fotos[k]) {
      if (img) img.src = fotos[k];
      else { const i = document.createElement('img'); i.alt = ''; i.src = fotos[k]; cont.prepend(i); }
      cont.querySelector('span').hidden = true;
    }
  };
  FOTOS.forEach(([k]) => pintarFoto(k));

  const codigoAnilla = () => componerAnilla({
    anio: ($('#a-fecha', f).value || '').slice(0, 4), diametro: $('#a-diam', f).value, numero: $('#a-num', f).value });
  const refrescar = () => {
    const sexo = $('#a-sexo', f).value;
    const diam = $('#a-diam', f);
    if (sexo && diam.dataset.sexo !== sexo) { diam.value = String(ESTANDAR.anilla[sexo]); diam.dataset.sexo = sexo; } // diámetro del Estándar
    const fechaN = $('#a-fecha', f).value;
    const codigo = codigoAnilla();
    const ayuda = $('#a-anilla-ayuda', f);
    if (!codigo || !fechaN || !sexo) {
      ayuda.className = 'ayuda';
      ayuda.textContent = `Anilla oficial EE de FESACOCUR (gallo ${ESTANDAR.anilla.M} mm · gallina ${ESTANDAR.anilla.H} mm). El año lo pone la fecha de nacimiento.`;
    } else {
      const c = comprobarAnilla(codigo, { sexo, fechaNacimiento: fechaN });
      ayuda.className = `ayuda ${c.errores.length ? 'error' : ''}`;
      ayuda.textContent = `Código del Libro: ${codigo}` + (c.errores.length ? ` · ${c.errores.join(' ')}` : c.avisos.length ? ` · ⚠ ${c.avisos.join(' ')}` : ' · ✓');
    }
    const peso = $('#a-peso', f).value;
    const r = ESTANDAR.peso[sexo];
    const conf = pesoConforme(sexo, peso);
    $('#a-peso-ayuda', f).textContent = !r ? 'Elige el sexo para ver el rango del Estándar.'
      : `Estándar: ${r.min}–${r.max} g${conf === null ? '' : conf ? ' · ✓ dentro del rango' : ' · fuera del rango'}`;
    const madre = $('#a-madre', f).value;
    // Padre propuesto por el lote de reproducción en el que estaba la madre (fecha de puesta ≈ nacimiento − 21 días)
    if (madre && madre !== propuestoPara && !$('#a-padre', f).value && !previo) {
      propuestoPara = madre;
      const nac = $('#a-fecha', f).value;
      const puesta = nac ? new Date(new Date(`${nac}T12:00:00Z`).getTime() - REGLAS.reproduccion.eclosion * 864e5).toISOString().slice(0, 10) : undefined;
      const pd = datos.padreDe(madre, puesta);
      if (pd && datos.animal(pd.gallo_id)) { $('#a-padre', f).value = pd.gallo_id; aviso(`Padre propuesto por el lote de reproducción: ${datos.animal(pd.gallo_id).anilla}${pd.fiable ? '' : ' (dudoso: menos de 15 días juntos)'}.`); }
    }
    const padre = $('#a-padre', f).value;
    const caja = $('#a-fx', f);
    if (padre && madre) {
      const fx = fxDescendencia(padre, madre, datos.estado.idx);
      const n = nivelFx(fx);
      caja.hidden = false;
      caja.className = `aviso-caja ${n.nivel === 'alerta' ? 'alerta' : n.nivel === 'precaucion' ? 'aviso' : 'ok'}`;
      caja.textContent = `Consanguinidad esperada (Wright, 5 generaciones): ${pct(fx)} · ${n.texto}`;
    } else caja.hidden = true;
    if (madre && !$('#a-familia', f).value) {
      const fam = familiaDescendencia(datos.animal(madre));
      if (fam) $('#a-familia', f).value = fam;
    }
  };
  f.addEventListener('input', () => { f.dataset.sucio = '1'; refrescar(); });
  f.addEventListener('change', refrescar);
  refrescar();

  f.querySelectorAll('[data-foto]').forEach(inp => inp.addEventListener('change', async () => {
    const archivo = inp.files?.[0];
    if (!archivo) return;
    try {
      fotos[inp.dataset.foto] = await comprimirFoto(archivo);
      // Fecha de la foto (la del archivo, si es coherente): sirve para saber la edad del animal en ella
      const f0 = fechaLocal(new Date(archivo.lastModified || Date.now()));
      const nac = $('#a-fecha', f).value;
      fotosFecha[inp.dataset.foto] = f0 > hoyISO() || (nac && f0 < nac) ? hoyISO() : f0;
      pintarFoto(inp.dataset.foto);
    } catch { aviso('No se pudo procesar la foto.', 'error'); }
  }));

  f.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const boton = f.querySelector('[type=submit]');
    const otro = ev.submitter?.id === 'a-otro';
    boton.disabled = true;
    try {
      const guardado = await datos.guardarAnimal({
        id: previo?.id,
        anilla: codigoAnilla() || `E??${$('#a-diam', f).value}${$('#a-num', f).value}`,
        sexo: $('#a-sexo', f).value,
        variedad: $('#a-variedad', f).value,
        fecha_nacimiento: $('#a-fecha', f).value,
        padre_id: $('#a-padre', f).value || null,
        madre_id: $('#a-madre', f).value || null,
        peso_g: $('#a-peso', f).value,
        familia: $('#a-familia', f).value || null,
        nombre: $('#a-nombre', f).value.trim() || null,
        rfid: $('#a-rfid', f).value.replace(/\D/g, '') || null,
        seccion: previo ? previo.seccion : ($('#a-seccion', f)?.value || 'RN'),
        notas: $('#a-notas', f).value.trim() || null,
        fotos,
        fotos_fecha: fotosFecha
      });
      f.dataset.sucio = '';
      if (desdeInc) await datos.vincularPollito(desdeInc.inc, guardado.madre_id || desdeInc.madre, guardado.id).catch(() => {});
      aviso(`${previo ? 'Guardado' : 'Registrado'} ${guardado.anilla}${navigator.onLine ? '' : ' (se sincronizará al tener cobertura)'}`, 'ok');
      if (otro) {
        // Siguiente de la pollada: misma madre, padre, fecha, variedad y familia; anilla siguiente
        const sig = new URLSearchParams();
        if (desdeInc) sig.set('inc', desdeInc.inc);
        for (const [k, v] of [['madre', guardado.madre_id], ['padre', guardado.padre_id], ['fecha', guardado.fecha_nacimiento], ['variedad', guardado.variedad], ['familia', guardado.familia]]) if (v) sig.set(k, v);
        const n = Number(parsearAnilla(guardado.anilla)?.numero);
        if (Number.isFinite(n) && n < 999999) sig.set('num', String(n + 1));
        sig.set('t', Date.now().toString(36)); // fuerza un formulario nuevo
        location.hash = `#/alta?${sig}`;
        setTimeout(() => document.getElementById('a-num')?.focus(), 400);
      } else location.hash = `#/animal/${guardado.id}`;
    } catch (e) {
      aviso(e.message, 'error');
    } finally { boton.disabled = false; }
  });
}
