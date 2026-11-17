// Puesta y RFID: pesaje individual de cada huevo (apto desde 55 g, cáscara blanco crema; sin límite superior).
// Lectores RFID en modo teclado (Bluetooth/USB HID): leer el chip en el campo
// "Chip" selecciona la gallina automáticamente.
import * as datos from '../datos.js';
import { ESTANDAR, REGLAS, huevoApto, huevoGrande } from '../estandar.js';
import { h, pintar, $, aviso, fecha, hoyISO, confirmar } from '../ui.js';

const coma = (n, d = 1) => (n === null || n === undefined ? '—' : Number(n).toFixed(d).replace('.', ','));

export default function (main) {
  const p = datos.estado.perfil;
  const q = new URLSearchParams(location.hash.split('?')[1] || '');
  let seleccion = q.get('gallina') || '';
  const pesos = [];

  const gallinas = () => datos.censo().filter(a => a.sexo === 'H' && (a.usuario_id === p.id));

  const conChip = () => gallinas().some(a => a.rfid);
  const corto = (a) => String(a.anilla).slice(-4).replace(/^0+(?=\d)/, '');

  pintar(main, h`
    <h1>Puesta & RFID</h1>
    <div id="pu-campana"></div>
    <form id="form-puesta" class="tarjeta" novalidate>
      ${conChip() ? h`<div class="campo"><label for="pu-chip">Chip RFID</label>
        <input id="pu-chip" inputmode="numeric" autocomplete="off" placeholder="Leer chip o escribir 15 dígitos">
        <p class="ayuda">Con el lector en modo teclado, acerca la gallina y lee.</p></div>` : ''}
      <div class="campo"><label id="pu-gallina-et">Gallina *</label>
        <div id="pu-rejilla" class="rejilla-gallinas" role="group" aria-labelledby="pu-gallina-et"></div>
        <label for="pu-gallina" class="peq muted" style="margin-top:.5rem;font-weight:500">o elige en la lista completa</label>
        <select id="pu-gallina"></select></div>
      <div class="campo"><label for="pu-peso">Peso del huevo (g)</label>
        <div class="fila" style="flex-wrap:nowrap"><input id="pu-peso" class="peso-grande" type="text" inputmode="decimal" enterkeyhint="done" autocomplete="off" pattern="[0-9]+([.,][0-9])?" style="flex:1" placeholder="61,5">
          <button class="btn btn-grande" type="button" id="pu-anadir">＋ Añadir</button></div>
        <p class="ayuda">Un huevo cada vez: escribe el peso y pulsa «Añadir» (o Intro). Apto desde ${ESTANDAR.huevo.min} g y cáscara blanco crema; los de más de ${ESTANDAR.huevo.habitualMax} g también valen.</p></div>
      <div id="pu-pesos" class="fila" style="margin-bottom:.5rem"></div>
      <details id="pu-mas"><summary class="peq" id="pu-mas-resumen"></summary>
        <div class="rejilla rejilla-2" style="margin-top:.5rem">
          <div class="campo"><label for="pu-fecha">Fecha *</label><input id="pu-fecha" type="date" value="${hoyISO()}" max="${hoyISO()}"></div>
          <div class="campo"><label for="pu-cascara">Cáscara</label><select id="pu-cascara">
            <option>Blanco crema</option><option>Blanco puro</option><option>Tostada</option><option>Defectuosa</option></select></div>
          ${conChip() ? '' : h`<div class="campo"><label for="pu-chip">Chip RFID</label>
            <input id="pu-chip" inputmode="numeric" autocomplete="off" placeholder="Leer chip o escribir 15 dígitos"></div>`}
        </div></details>
      <div class="acciones-fijas"><button class="btn btn-primario btn-bloque" type="submit" id="pu-guardar" disabled>Guardar huevos</button></div>
    </form>
    <div id="pu-resumen"></div>`);

  const f = $('#form-puesta', main);
  const sel = $('#pu-gallina', f);

  const resumenMas = () => {
    const fe = $('#pu-fecha', f).value;
    $('#pu-mas-resumen', f).textContent = `${fe === hoyISO() ? 'Hoy' : fecha(fe)} · cáscara ${$('#pu-cascara', f).value.toLowerCase()} · cambiar`;
  };

  const pintarSelect = () => {
    const lista = gallinas();
    const dia = $('#pu-fecha', f)?.value || hoyISO();
    const conHuevo = new Set(datos.estado.huevos.filter(x => x.fecha === dia).map(x => x.animal_id));
    const camp = datos.campanaEnCurso();
    const enCampana = new Set(camp ? camp.gallinas : []);
    pintar(sel, h`<option value="">${lista.length ? 'Elegir gallina…' : 'No tienes gallinas activas'}</option>
      ${lista.map(a => h`<option value="${a.id}">${a.anilla}${a.nombre ? ` · ${a.nombre}` : ''}</option>`)}`);
    sel.value = lista.some(a => a.id === seleccion) ? seleccion : '';
    // Rejilla: primero las de la campaña en curso que aún no tienen huevo hoy
    const orden = [...lista].sort((x, y) => (enCampana.has(y.id) && !conHuevo.has(y.id)) - (enCampana.has(x.id) && !conHuevo.has(x.id)) || x.anilla.localeCompare(y.anilla));
    pintar($('#pu-rejilla', f), h`${orden.map(a => h`<button type="button" class="boton-gallina ${conHuevo.has(a.id) ? 'hecha' : enCampana.has(a.id) ? 'pendiente' : ''}"
        data-gallina="${a.id}" aria-pressed="${a.id === seleccion ? 'true' : 'false'}" title="${a.anilla}${conHuevo.has(a.id) ? ' · ya tiene huevo este día' : ''}">
        <b>${corto(a)}</b><small>${a.nombre || a.anilla}</small></button>`)}`);
  };

  const pintarPesos = () => {
    const cascara = $('#pu-cascara', f).value;
    pintar($('#pu-pesos', f), h`${pesos.map((g, i) => h`<button type="button" class="chip chip-boton ${huevoApto(g, cascara) ? 'chip-ok' : 'chip-aviso'}" data-quitar="${i}" title="Quitar">${coma(g)} g${huevoGrande(g) ? ' ↑' : ''} ✕</button>`)}`);
    $('#pu-guardar', f).disabled = pesos.length === 0 || !sel.value;
    $('#pu-guardar', f).textContent = pesos.length ? `Guardar ${pesos.length} huevo(s)` : 'Guardar huevos';
  };

  const pintarCampana = () => {
    const c = datos.campanaEnCurso();
    const caja = $('#pu-campana', main);
    if (c) {
      const r = datos.resultadosCampana(c);
      const pendientes = r.filas.filter(x => !x.hoy);
      pintar(caja, h`<div class="tarjeta"><div class="fila entre"><strong>Control de puesta · ciclo ${c.ciclo}</strong>
          <a class="chip chip-ok" href="#/campana/${c.id}">Día ${datos.diaCampana(c)} de ${c.dias}</a></div>
        <div class="progreso"><span style="width:${Math.round(100 * datos.diaCampana(c) / c.dias)}%"></span></div>
        <p class="peq">${pendientes.length ? h`Sin huevos anotados hoy: ${pendientes.map((x, i) => h`${i ? ', ' : ''}<a href="#/puesta?gallina=${x.id}" data-elegir="${x.id}">${x.a.anilla}</a>`)}` : 'Hoy ya has anotado huevos de todas las gallinas controladas.'}</p></div>`);
    } else {
      const prox = datos.misCampanas().find(x => datos.estadoCampana(x) === 'programada');
      pintar(caja, h`<a class="tarjeta item" href="#/campanas" style="display:flex"><span style="font-size:1.4rem" aria-hidden="true">🗓️</span>
        <span class="item-principal"><span class="item-titulo">Control de puesta</span>
        <span class="item-sub">${prox ? `Próximo: ciclo ${prox.ciclo}, empieza el ${fecha(prox.inicio)}` : `${REGLAS.controlPuesta.ciclos} campañas de ${REGLAS.controlPuesta.dias} días entre febrero y junio. Organízalas aquí.`}</span></span><span aria-hidden="true">›</span></a>`);
    }
  };

  const pintarResumen = () => {
    const desde = new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
    const lista = gallinas();
    const filas = lista.map(a => ({ a, r: datos.resumenPuesta(a.id, desde) })).filter(x => x.r.n > 0);
    const total = datos.resumenPuesta(null, desde);
    const recientes = datos.estado.huevos.filter(x => lista.some(a => a.id === x.animal_id))
      .sort((x, y) => (y.fecha + y.created_at).localeCompare(x.fecha + x.created_at)).slice(0, 15);
    pintar($('#pu-resumen', main), h`
      <div class="tarjeta"><h2>Últimos 30 días</h2>
        ${total.n ? h`<div class="kpis">
          <div class="kpi"><b>${total.n}</b><span>Huevos</span></div>
          <div class="kpi"><b>${coma(total.media)} g</b><span>Peso medio</span></div>
          <div class="kpi"><b>${Math.round(100 * total.aptos / total.n)} %</b><span>Aptos para incubar</span></div></div>
          <div class="tabla-scroll"><table><thead><tr><th>Gallina</th><th class="num">Huevos</th><th class="num">Medio</th><th class="num">Mín–máx</th><th class="num">Aptos</th></tr></thead>
          <tbody>${filas.map(({ a, r }) => h`<tr><td><a href="#/animal/${a.id}">${a.anilla}</a></td><td class="num">${r.n}</td><td class="num">${coma(r.media)} g</td>
            <td class="num">${coma(r.min)}–${coma(r.max)}</td><td class="num">${r.aptos}</td></tr>`)}</tbody></table></div>`
          : h`<p class="muted">Sin registros en los últimos 30 días.</p>`}
      </div>
      ${recientes.length ? h`<div class="tarjeta"><h2>Últimos registros</h2><ul class="lista">${recientes.map(x => {
        const a = datos.animal(x.animal_id);
        return h`<li class="item"><div class="item-principal"><div class="item-titulo">${coma(x.peso_g)} g · ${a?.anilla || ''}</div>
          <div class="item-sub">${fecha(x.fecha)} · ${x.cascara}${huevoGrande(x.peso_g) ? ` · por encima de ${ESTANDAR.huevo.habitualMax} g (habitual)` : ''}</div></div>
          <span class="chip ${x.apto ? 'chip-ok' : 'chip-aviso'}">${x.apto ? 'Apto' : 'No apto'}</span>
          <button class="btn btn-pequeno" data-borrar="${x.id}" aria-label="Borrar registro">🗑</button></li>`;
      })}</ul></div>` : ''}`);
  };

  const anadir = () => {
    const inp = $('#pu-peso', f);
    const g = Number(String(inp.value).replace(',', '.'));
    if (!Number.isFinite(g) || g < 20 || g > 120) { aviso('Peso fuera de rango físico (20–120 g).', 'error'); return; }
    pesos.push(Math.round(g * 10) / 10);
    inp.value = '';
    inp.focus();
    f.dataset.sucio = '1';
    pintarPesos();
  };

  $('#pu-anadir', f).addEventListener('click', anadir);
  $('#pu-peso', f).addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); anadir(); } });
  $('#pu-pesos', f).addEventListener('click', e => {
    const i = e.target.closest('[data-quitar]')?.dataset.quitar;
    if (i !== undefined) { pesos.splice(Number(i), 1); pintarPesos(); }
  });
  $('#pu-cascara', f).addEventListener('change', () => { resumenMas(); pintarPesos(); });
  const elegir = (id, enfocar) => {
    seleccion = id; sel.value = id;
    f.querySelectorAll('[data-gallina]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.gallina === id)));
    pintarPesos();
    if (enfocar) $('#pu-peso', f).focus();
  };
  sel.addEventListener('change', () => elegir(sel.value, false));
  $('#pu-rejilla', f).addEventListener('click', e => { const b = e.target.closest('[data-gallina]'); if (b) elegir(b.dataset.gallina, true); });
  $('#pu-fecha', f).addEventListener('change', () => { resumenMas(); pintarSelect(); });
  $('#pu-chip', f)?.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const chip = e.target.value.replace(/\D/g, '');
    const g = gallinas().find(a => a.rfid === chip);
    if (g) { elegir(g.id, true); aviso(`Gallina ${g.anilla}`, 'ok'); }
    else aviso(chip ? `El chip ${chip} no está asignado a ninguna de tus gallinas.` : 'Lectura vacía.', 'error');
    e.target.value = '';
  });
  f.addEventListener('submit', async e => {
    e.preventDefault();
    try {
      const regs = await datos.registrarHuevos(sel.value, $('#pu-fecha', f).value, pesos, $('#pu-cascara', f).value);
      const aptos = regs.filter(r => r.apto).length;
      aviso(`${regs.length} huevo(s) guardados · ${aptos} aptos`, 'ok');
      pesos.length = 0;
      f.dataset.sucio = '';
      seleccion = ''; pintarSelect(); pintarPesos();
      $('#pu-rejilla', f).scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    } catch (err) { aviso(err.message, 'error'); }
  });
  main.addEventListener('click', async e => {
    const id = e.target.closest('[data-borrar]')?.dataset.borrar;
    if (!id) return;
    if (await confirmar('Borrar registro', '¿Eliminar este huevo del control de puesta?', 'Borrar', true)) {
      try { await datos.borrarHuevo(id); } catch (err) { aviso(err.message, 'error'); }
    }
  });

  main.addEventListener('click', e => {
    const id = e.target.closest('[data-elegir]')?.dataset.elegir;
    if (!id) return;
    e.preventDefault(); elegir(id, true);
  });

  resumenMas();
  pintarSelect();
  pintarPesos();
  pintarCampana();
  pintarResumen();
  return datos.suscribir(() => { pintarSelect(); pintarCampana(); pintarResumen(); });
}
