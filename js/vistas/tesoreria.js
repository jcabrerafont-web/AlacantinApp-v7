// Tesorería del Club (rol aparte del Libro). Pantallas: crear la contraseña, abrir,
// socios (lista y ficha), importar socios desde Excel y seguridad (contraseña y
// copia cifrada). Todo lo abierto vive en memoria; se cierra con el botón, a los
// 15 minutos sin uso, al cerrar la sesión o al recargar la app.
import * as datos from '../datos.js';
import * as sync from '../sync.js';
import * as tes from '../tesoreria.js';
import { leerXlsx } from '../tesoreria/xlsx.js';
import { MIN_CONTRASENA } from '../tesoreria/cripto.js';
import { h, pintar, $, aviso, confirmar, dialogo, descargar, csv, hoyISO, fecha } from '../ui.js';

const PESTANAS = [['socios', 'Socios'], ['importar', 'Importar'], ['seguridad', 'Seguridad']];

export default async function (main) {
  let pestana = 'socios', editando = null, buscar = '', verBajas = false, importacion = null, noImportados = [];

  // Antes de crear la contraseña, mirar si ya existe en el servidor (otro dispositivo)
  if (navigator.onLine) await sync.descargar(datos.estado.perfil.id).catch(() => {});

  const cabecera = () => h`<h1>Tesorería del Club</h1>
    <p class="muted">Solo para tesorería. Los datos se cifran en este dispositivo con tu contraseña de tesorería: nadie más puede leerlos, ni el administrador del Libro ni quien entre en el servidor.</p>`;

  const dibujar = async () => {
    if (!tes.esTesorero()) { pintar(main, h`${cabecera()}<div class="aviso-caja aviso">No tienes el rol de tesorería.</div>`); return; }
    if (!(await tes.configurada())) return pintarCrear();
    if (!tes.abierta()) return pintarAbrir();
    tes.actividad();
    pintar(main, h`${cabecera()}
      <div class="fila entre tarjeta" style="align-items:center">
        <div class="segmentado" role="tablist">${PESTANAS.map(([k, n]) => h`<button type="button" role="tab" class="btn btn-pequeno ${k === pestana ? 'btn-primario' : ''}" aria-selected="${k === pestana}" data-pestana="${k}">${n}</button>`)}</div>
        <button type="button" class="btn btn-pequeno" id="te-cerrar">🔒 Cerrar tesorería</button>
      </div>
      <div id="te-cuerpo"></div>`);
    main.querySelectorAll('[data-pestana]').forEach(b => b.addEventListener('click', () => { pestana = b.dataset.pestana; editando = null; dibujar(); }));
    $('#te-cerrar', main).addEventListener('click', () => { tes.cerrar(); });
    const cuerpo = $('#te-cuerpo', main);
    if (pestana === 'socios') pintarSocios(cuerpo);
    else if (pestana === 'importar') pintarImportar(cuerpo);
    else pintarSeguridad(cuerpo);
  };

  // --- Primera vez: crear la contraseña -----------------------------------
  const pintarCrear = () => {
    pintar(main, h`${cabecera()}
      <form class="tarjeta" id="te-crear"><h2>Crea la contraseña de tesorería</h2>
        <p>Es distinta de la contraseña con la que entras en la app. Con ella se cifran y se abren los datos de tesorería.</p>
        <div class="aviso-caja alerta peq"><strong>Si la pierdes, nadie podrá recuperar los datos</strong>, tampoco el Club ni el servidor. Guárdala por escrito en sobre cerrado con la Presidencia o la Secretaría y descarga de vez en cuando la copia cifrada.</div>
        <div class="campo"><label for="te-c1">Contraseña (mínimo ${MIN_CONTRASENA} caracteres; mejor una frase)</label><input id="te-c1" type="password" autocomplete="new-password" required></div>
        <div class="campo"><label for="te-c2">Repítela</label><input id="te-c2" type="password" autocomplete="new-password" required></div>
        <button class="btn btn-primario" type="submit">Crear y abrir la tesorería</button>
      </form>`);
    $('#te-crear', main).addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const b = ev.submitter; b.disabled = true;
      try { await tes.crear($('#te-c1', main).value, $('#te-c2', main).value); aviso('Tesorería creada', 'ok'); }
      catch (e) { aviso(e.message, 'error'); b.disabled = false; }
    });
  };

  // --- Abrir --------------------------------------------------------------
  const pintarAbrir = () => {
    pintar(main, h`${cabecera()}
      <form class="tarjeta" id="te-abrir"><h2>🔒 Tesorería cerrada</h2>
        <div class="campo"><label for="te-clave">Contraseña de tesorería</label><input id="te-clave" type="password" autocomplete="current-password" required></div>
        <button class="btn btn-primario" type="submit">Abrir</button>
        <p class="peq muted">Se cierra sola a los 15 minutos sin usarla y al salir de la app.</p>
      </form>`);
    $('#te-clave', main).focus();
    $('#te-abrir', main).addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const b = ev.submitter; b.disabled = true; b.textContent = 'Abriendo…';
      try { await tes.abrir($('#te-clave', main).value); }
      catch (e) { aviso(e.message, 'error'); b.disabled = false; b.textContent = 'Abrir'; $('#te-clave', main).select(); }
    });
  };

  // --- Socios -------------------------------------------------------------
  const pintarSocios = (cuerpo) => {
    const todos = tes.socios();
    const n = tes.normalizar(buscar);
    const lista = todos.filter(s => (verBajas || !tes.estaDeBaja(s)) && (!n || tes.normalizar([s.numero, s.nombre, s.apellidos, s.dni, s.municipio, s.email, s.telefono].join(' ')).includes(n)));
    const activos = todos.filter(s => !tes.estaDeBaja(s)).length;
    const e = editando === 'nuevo' ? {} : editando ? todos.find(s => s.id === editando) : null;
    if (e) return pintarFicha(cuerpo, e);
    pintar(cuerpo, h`
      <div class="kpis"><div class="kpi"><b>${activos}</b><span>Socios activos</span></div><div class="kpi"><b>${todos.length - activos}</b><span>De baja</span></div>
        <div class="kpi"><b>${todos.filter(s => s.iban && !tes.estaDeBaja(s)).length}</b><span>Con cuenta (IBAN)</span></div></div>
      <div class="tarjeta">
        <div class="fila"><input id="te-buscar" type="search" placeholder="Buscar por nombre, nº, DNI, municipio…" value="${buscar}" style="flex:1" aria-label="Buscar socios">
          <button class="btn btn-primario" id="te-nuevo">+ Nuevo socio</button></div>
        <label class="peq" style="display:block;margin-top:.5rem"><input type="checkbox" id="te-bajas" ${verBajas ? h`checked` : ''}> Ver también los de baja</label>
      </div>
      ${lista.length ? h`<ul class="lista tarjeta" id="te-lista">${lista.map(s => h`<li><a class="item" href="#/tesoreria" data-socio="${s.id}">
        <span class="item-principal"><span class="item-titulo">${s.numero ? `${s.numero} · ` : ''}${tes.nombreCompleto(s)}${tes.estaDeBaja(s) ? h` <span class="chip chip-aviso">Baja</span>` : ''}</span>
        <span class="item-sub">${[s.municipio, s.telefono, s.email].filter(Boolean).join(' · ') || '—'}</span></span><span aria-hidden="true">›</span></a></li>`)}</ul>`
      : h`<p class="muted tarjeta">${todos.length ? 'Ningún socio coincide con la búsqueda.' : 'Todavía no hay socios. Añádelos uno a uno o impórtalos desde el Excel del Club en «Importar».'}</p>`}
      ${todos.length ? h`<button class="btn" id="te-csv">⬇️ Socios (CSV)</button>` : ''}`);
    const campoBuscar = $('#te-buscar', cuerpo);
    campoBuscar.addEventListener('input', () => { buscar = campoBuscar.value; pintarSocios(cuerpo); const c = $('#te-buscar', cuerpo); c.focus(); c.setSelectionRange(c.value.length, c.value.length); });
    $('#te-bajas', cuerpo).addEventListener('change', (ev) => { verBajas = ev.target.checked; pintarSocios(cuerpo); });
    $('#te-nuevo', cuerpo).addEventListener('click', () => { editando = 'nuevo'; pintarSocios(cuerpo); });
    cuerpo.querySelectorAll('[data-socio]').forEach(b => b.addEventListener('click', (ev) => { ev.preventDefault(); editando = b.dataset.socio; pintarSocios(cuerpo); window.scrollTo(0, 0); }));
    $('#te-csv', cuerpo)?.addEventListener('click', () => {
      const filas = [tes.CAMPOS_SOCIO.map(c => c[1])];
      todos.forEach(s => filas.push(tes.CAMPOS_SOCIO.map(([k]) => s[k] ?? '')));
      descargar(csv(filas), `CGA_socios_${hoyISO()}.csv`);
      aviso('Ojo: el CSV no va cifrado. Guárdalo en un sitio seguro y bórralo cuando no lo necesites.', 'info', { ms: 7000 });
    });
  };

  const pintarFicha = (cuerpo, s) => {
    const nuevo = !s.id;
    const tipo = (k) => (['fecha_alta', 'fecha_baja', 'mandato_fecha'].includes(k) ? 'date' : k === 'email' ? 'email' : k === 'telefono' ? 'tel' : 'text');
    pintar(cuerpo, h`<form class="tarjeta" id="te-ficha">
      <p class="peq"><button type="button" class="enlace" id="te-volver">‹ Volver a la lista</button></p>
      <h2>${nuevo ? 'Nuevo socio' : tes.nombreCompleto(s)}</h2>
      <div class="rejilla rejilla-2">${tes.CAMPOS_SOCIO.filter(([k]) => k !== 'notas').map(([k, et]) => h`<div class="campo"><label for="ts-${k}">${et}</label>
        <input id="ts-${k}" name="${k}" type="${tipo(k)}" value="${s[k] ?? ''}" ${k === 'dni' || k === 'iban' ? h`autocomplete="off" spellcheck="false"` : ''}></div>`)}</div>
      <div class="campo"><label for="ts-notas">Notas</label><textarea id="ts-notas" name="notas" rows="3">${s.notas || ''}</textarea></div>
      <div class="fila"><button class="btn btn-primario" type="submit">${nuevo ? 'Añadir socio' : 'Guardar cambios'}</button>
        ${nuevo ? '' : h`<button class="btn btn-peligro" type="button" id="te-borrar">Borrar</button>`}</div>
      <p class="peq muted">Para un socio que deja el Club, mejor poner la fecha de baja que borrarlo: así se conserva su historial de cuotas.</p>
    </form>`);
    $('#te-volver', cuerpo).addEventListener('click', () => { editando = null; pintarSocios(cuerpo); });
    $('#ts-iban', cuerpo).addEventListener('change', (ev) => { if (ev.target.value && !tes.ibanValido(ev.target.value)) aviso('Ese IBAN no es válido: revisa los dígitos.', 'error'); });
    $('#te-borrar', cuerpo)?.addEventListener('click', async () => {
      if (!await confirmar('¿Borrar este socio?', 'Se borra de la tesorería en todos los dispositivos. Si deja el Club, es mejor poner su fecha de baja.', 'Borrar', true)) return;
      await tes.borrarSocio(s.id); editando = null; aviso('Socio borrado', 'ok'); pintarSocios(cuerpo);
    });
    $('#te-ficha', cuerpo).addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const d = Object.fromEntries(tes.CAMPOS_SOCIO.map(([k]) => [k, $(`#ts-${k}`, cuerpo).value]));
      try { await tes.guardarSocio({ ...s, ...d, id: s.id }); aviso(nuevo ? 'Socio añadido' : 'Cambios guardados', 'ok'); editando = null; pintarSocios(cuerpo); }
      catch (e) { aviso(e.message, 'error'); }
    });
  };

  // --- Importar desde Excel -----------------------------------------------
  const pintarImportar = (cuerpo) => {
    const imp = importacion;
    const hoja = imp?.hojas[imp.hoja];
    const titulos = hoja ? (hoja.filas[imp.filaTit] || []) : [];
    const columnas = titulos.map((t, i) => [i, `${String.fromCharCode(65 + (i % 26))}${i >= 26 ? Math.floor(i / 26) : ''} · ${t ?? '(sin título)'}`]);
    const previa = hoja ? tes.prepararImportacion(hoja.filas, imp.filaTit, imp.mapa) : [];
    pintar(cuerpo, h`<div class="tarjeta">
      <h2>Importar socios desde Excel</h2>
      <p class="peq">El archivo se lee en este dispositivo y los datos se guardan cifrados: el Excel no se envía a ningún sitio. Si un socio ya existe (mismo nº de socio o, si no tiene, mismo DNI), se actualiza; si no, se añade.</p>
      <div class="campo"><label for="te-archivo">Archivo .xlsx</label><input id="te-archivo" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"></div>
      ${imp ? h`
        <div class="rejilla rejilla-2">
          <div class="campo"><label for="te-hoja">Hoja</label><select id="te-hoja">${imp.hojas.map((x, i) => h`<option value="${i}" ${i === imp.hoja ? h`selected` : ''}>${x.nombre}</option>`)}</select></div>
          <div class="campo"><label for="te-fila">Fila de los títulos</label><input id="te-fila" type="number" min="1" value="${imp.filaTit + 1}"></div>
        </div>
        <h3>Qué columna es cada dato</h3>
        <p class="peq muted">La app lo ha adivinado por los títulos; corrige lo que haga falta. Lo que dejes en «—» no se importa.</p>
        <div class="rejilla rejilla-2">${tes.CAMPOS_SOCIO.map(([k, et]) => h`<div class="campo"><label for="tm-${k}">${et}</label>
          <select id="tm-${k}" data-mapa="${k}"><option value="">—</option>${columnas.map(([i, n]) => h`<option value="${i}" ${imp.mapa[k] === i ? h`selected` : ''}>${n}</option>`)}</select></div>`)}</div>
        <h3>Vista previa</h3>
        <p class="peq">${previa.length} socio(s) para importar.${previa.length ? h` Los tres primeros:` : ''}</p>
        ${previa.length ? h`<div class="tabla-scroll"><table><thead><tr><th>Nº</th><th>Nombre</th><th>DNI</th><th>Teléfono</th><th>Municipio</th><th>Alta</th><th>IBAN</th></tr></thead>
          <tbody>${previa.slice(0, 3).map(s => h`<tr><td>${s.numero || ''}</td><td>${tes.nombreCompleto(s)}</td><td>${s.dni || ''}</td><td>${s.telefono || ''}</td><td>${s.municipio || ''}</td><td>${s.fecha_alta ? fecha(s.fecha_alta) : ''}</td><td>${s.iban ? (tes.ibanValido(s.iban) ? '✓' : '✗ no válido') : ''}</td></tr>`)}</tbody></table></div>` : ''}
        <button class="btn btn-primario" id="te-importar" ${previa.length ? '' : h`disabled`}>Importar ${previa.length} socio(s)</button>` : ''}
    </div>
    ${noImportados.length ? h`<div class="tarjeta aviso-caja alerta" id="te-no-importados"><strong>No importados (corrígelos en el Excel o añádelos a mano):</strong><ul>${noImportados.map(x => h`<li>${x}</li>`)}</ul></div>` : ''}`);
    $('#te-archivo', cuerpo).addEventListener('change', async (ev) => {
      const f = ev.target.files?.[0];
      if (!f) return;
      noImportados = [];
      try {
        const hojas = (await leerXlsx(f)).filter(x => x.filas.length);
        if (!hojas.length) throw new Error('El Excel no tiene datos.');
        const i = Math.max(0, hojas.findIndex(x => /socio/i.test(x.nombre)));
        const filaTit = tes.filaTitulos(hojas[i].filas);
        importacion = { hojas, hoja: i, filaTit, mapa: tes.adivinarMapa(hojas[i].filas[filaTit] || []) };
      } catch (e) { aviso(e.message || 'No se pudo leer el Excel.', 'error'); importacion = null; }
      pintarImportar(cuerpo);
    });
    $('#te-hoja', cuerpo)?.addEventListener('change', (ev) => {
      const i = Number(ev.target.value); const filaTit = tes.filaTitulos(imp.hojas[i].filas);
      importacion = { ...imp, hoja: i, filaTit, mapa: tes.adivinarMapa(imp.hojas[i].filas[filaTit] || []) }; pintarImportar(cuerpo);
    });
    $('#te-fila', cuerpo)?.addEventListener('change', (ev) => {
      const filaTit = Math.max(0, Number(ev.target.value) - 1);
      importacion = { ...imp, filaTit, mapa: tes.adivinarMapa(hoja.filas[filaTit] || []) }; pintarImportar(cuerpo);
    });
    cuerpo.querySelectorAll('[data-mapa]').forEach(sel => sel.addEventListener('change', () => {
      const mapa = { ...imp.mapa }; if (sel.value === '') delete mapa[sel.dataset.mapa]; else mapa[sel.dataset.mapa] = Number(sel.value);
      importacion = { ...imp, mapa }; pintarImportar(cuerpo);
    }));
    $('#te-importar', cuerpo)?.addEventListener('click', async (ev) => {
      ev.target.disabled = true; ev.target.textContent = 'Importando…';
      try {
        const r = await tes.importarSocios(previa);
        aviso(`Importados: ${r.nuevos} nuevos y ${r.actualizados} actualizados${r.errores.length ? ` · ${r.errores.length} con errores` : ''}.`, r.errores.length ? 'error' : 'ok', { ms: 8000 });
        noImportados = r.errores;
        importacion = null;
        if (!r.errores.length) pestana = 'socios';
        dibujar();
      } catch (e) { aviso(e.message, 'error'); ev.target.disabled = false; }
    });
  };

  // --- Seguridad: contraseña y copia cifrada ------------------------------
  const pintarSeguridad = (cuerpo) => {
    pintar(cuerpo, h`
      <form class="tarjeta" id="te-cambiar"><h2>Cambiar la contraseña de tesorería</h2>
        <div class="campo"><label for="tc-actual">Contraseña actual</label><input id="tc-actual" type="password" autocomplete="current-password" required></div>
        <div class="campo"><label for="tc-nueva">Nueva (mínimo ${MIN_CONTRASENA} caracteres)</label><input id="tc-nueva" type="password" autocomplete="new-password" required></div>
        <div class="campo"><label for="tc-repe">Repite la nueva</label><input id="tc-repe" type="password" autocomplete="new-password" required></div>
        <button class="btn btn-primario" type="submit">Cambiar</button>
        <p class="peq muted">Al pasar la tesorería a otra persona: se le da el rol en Supabase, se le entrega la contraseña y la cambia aquí.</p>
      </form>
      <div class="tarjeta"><h2>Copia cifrada</h2>
        <p class="peq">Un archivo con todos los datos de tesorería, cifrados: solo se abre con la contraseña. Guárdalo fuera de la app de vez en cuando.</p>
        <div class="fila"><button class="btn" id="te-copia">⬇️ Descargar copia cifrada</button>
          <label class="btn">Restaurar una copia<input type="file" id="te-restaurar" accept=".json,application/json" hidden></label></div>
      </div>
      <div class="tarjeta peq"><h2>Cómo está protegido</h2><ul>
        <li>Solo usan la tesorería las personas con el rol de tesorería, que se da en Supabase y no desde la app: ser administrador del Libro no da acceso.</li>
        <li>Cada dato se cifra en este dispositivo antes de guardarse o enviarse. El servidor solo guarda texto cifrado.</li>
        <li>Abierta, se cierra sola a los 15 minutos sin uso, al cerrar la sesión y al recargar la app.</li>
      </ul></div>`);
    $('#te-cambiar', cuerpo).addEventListener('submit', async (ev) => {
      ev.preventDefault();
      try { await tes.cambiarContrasena($('#tc-actual', cuerpo).value, $('#tc-nueva', cuerpo).value, $('#tc-repe', cuerpo).value); aviso('Contraseña de tesorería cambiada', 'ok'); ev.target.reset(); }
      catch (e) { aviso(e.message, 'error'); }
    });
    $('#te-copia', cuerpo).addEventListener('click', async () => {
      descargar(JSON.stringify(await tes.copiaCifrada()), `CGA_tesoreria_cifrada_${hoyISO()}.json`, 'application/json');
    });
    $('#te-restaurar', cuerpo).addEventListener('change', async (ev) => {
      const f = ev.target.files?.[0]; ev.target.value = '';
      if (!f) return;
      try {
        const copia = JSON.parse(await f.text());
        const ok = await dialogo({ titulo: 'Restaurar la copia cifrada', cuerpo: h`<label for="dlg-clave">Contraseña de tesorería de esa copia</label><input id="dlg-clave" type="password" autocomplete="off">`,
          acciones: [{ valor: 'no', texto: 'Cancelar' }, { valor: 'si', texto: 'Restaurar', primario: true }] });
        const clave = document.getElementById('dlg-clave')?.value;
        if (ok !== 'si' || !clave) return;
        const n = await tes.restaurarCopia(copia, clave);
        aviso(`Copia restaurada: ${n} registro(s).`, 'ok');
      } catch (e) { aviso(e.message || 'No se pudo restaurar la copia.', 'error'); }
    });
  };

  await dibujar();
  const quitar = tes.alCambiar(() => { if (!editando) dibujar(); else if (!tes.abierta()) { editando = null; dibujar(); } });
  const tocar = () => tes.actividad();
  main.addEventListener('input', tocar); main.addEventListener('click', tocar);
  return () => { quitar(); main.removeEventListener('input', tocar); main.removeEventListener('click', tocar); };
}
