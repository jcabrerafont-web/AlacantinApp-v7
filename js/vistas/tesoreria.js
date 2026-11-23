// Tesorería del Club (rol aparte del Libro). Pantallas: crear la contraseña, abrir,
// socios (lista y ficha), importar socios desde Excel y seguridad (contraseña y
// copia cifrada). Todo lo abierto vive en memoria; se cierra con el botón, a los
// 15 minutos sin uso, al cerrar la sesión o al recargar la app.
import * as datos from '../datos.js';
import * as sync from '../sync.js';
import * as tes from '../tesoreria.js';
import { leerXlsx } from '../tesoreria/xlsx.js';
import * as docs from '../documentos.js';
import * as sepa from '../tesoreria/sepa.js';
import { MIN_CONTRASENA } from '../tesoreria/cripto.js';
import { h, pintar, $, aviso, confirmar, dialogo, descargar, csv, hoyISO, fecha } from '../ui.js';

const PESTANAS = [['movimientos', 'Movimientos'], ['cuotas', 'Cuotas'], ['cuentas', 'Cuentas'], ['presupuesto', 'Presupuesto'], ['sepa', 'SEPA'], ['socios', 'Socios'], ['partidas', 'Partidas'], ['importar', 'Importar socios'], ['seguridad', 'Seguridad']];
const aNum = (v) => { const t = String(v ?? '').trim(); const n = Number(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t); return Number.isFinite(n) ? n : 0; };
const euros = (n) => `${Number(n || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

export default async function (main) {
  let pestana = 'movimientos', editando = null, buscar = '', verBajas = false, importacion = null, noImportados = [];
  const filtro = { anio: new Date().getFullYear(), partida: '', texto: '', limite: 200 }; // anio: número o 'todos' (histórico)
  let editandoMov = null, reglaPropuesta = '';
  const fc = { anio: new Date().getFullYear(), ver: 'pendientes' };
  let anioCuentas = null;
  const fr = { anio: new Date().getFullYear(), fecha: null, quitados: new Set() };
  let anioPres = null, borradorPres = null, partidasAbiertas = false;

  // --- Partidas: crear, editar y borrar (desde Movimientos y desde Partidas) -------
  const TIPOS = { ingreso: 'Ingresos', gasto: 'Gastos', ambos: 'Ingresos y gastos' };
  const dialogoPartida = async (p = null) => {
    const ok = await dialogo({ titulo: p ? 'Editar partida' : 'Nueva partida', cuerpo: h`<label for="dlg-pnombre">Nombre</label><input id="dlg-pnombre" value="${p?.nombre || ''}" placeholder="p. ej. Lotería de Navidad">
      <label for="dlg-ptipo">Tipo</label><select id="dlg-ptipo">${Object.entries(TIPOS).map(([k, n]) => h`<option value="${k}" ${(p?.tipo || 'ambos') === k ? h`selected` : ''}>${n}</option>`)}</select>`,
      acciones: [{ valor: 'no', texto: 'Cancelar' }, { valor: 'si', texto: p ? 'Guardar' : 'Añadir', primario: true }] });
    const nombre = document.getElementById('dlg-pnombre')?.value, tipo = document.getElementById('dlg-ptipo')?.value;
    if (ok !== 'si') return null;
    await tes.guardarPartida({ ...(p || {}), nombre, tipo });
    return tes.partidas().find(x => tes.normalizar(x.nombre) === tes.normalizar(nombre)) || null;
  };
  const borrarPartidaDialogo = async (p) => {
    const usos = tes.movimientos({ partida: p.id }).length;
    if (!usos) { if (!await confirmar(`¿Borrar «${p.nombre}»?`, 'Se borran también sus reglas.', 'Borrar', true)) return false; await tes.borrarPartida(p.id); return true; }
    const otras = tes.partidas().filter(x => x.id !== p.id);
    const ok = await dialogo({ titulo: `Borrar «${p.nombre}»`, cuerpo: h`<p>Tiene ${usos} movimiento(s). ¿A qué partida pasan?</p>
      <label for="dlg-mover">Pasan a</label><select id="dlg-mover"><option value="">— Sin clasificar —</option>${otras.map(x => h`<option value="${x.id}">${x.nombre}</option>`)}</select>`,
      acciones: [{ valor: 'no', texto: 'Cancelar' }, { valor: 'si', texto: 'Borrar la partida', peligro: true }] });
    const moverA = document.getElementById('dlg-mover')?.value || null;
    if (ok !== 'si') return false;
    await tes.borrarPartida(p.id, { moverA });
    return true;
  };
  const listaPartidas = (parts) => { const usos = (id) => tes.movimientos({ partida: id }).length;
    return h`<ul class="lista">${parts.map(p => h`<li class="item"><span class="item-principal"><span class="item-titulo">${p.nombre}${p.cuotas ? h` <span class="chip chip-info">Cuotas</span>` : ''}</span>
      <span class="item-sub">${TIPOS[p.tipo] || ''} · ${usos(p.id)} movimiento(s)</span></span>
      <span class="fila"><button type="button" class="btn btn-pequeno" data-editar-partida="${p.id}">Editar</button>${p.cuotas ? '' : h`<button type="button" class="btn btn-pequeno" data-borrar-partida="${p.id}">Borrar</button>`}</span></li>`)}</ul>
      <button type="button" class="btn" data-nueva-partida>+ Nueva partida</button>`; };
  const conectarPartidas = (cuerpo, repintar) => {
    cuerpo.querySelectorAll('[data-editar-partida]').forEach(b => b.addEventListener('click', async () => {
      try { if (await dialogoPartida(tes.partidas().find(x => x.id === b.dataset.editarPartida))) { aviso('Partida guardada', 'ok'); repintar(); } } catch (e) { aviso(e.message, 'error'); }
    }));
    cuerpo.querySelectorAll('[data-borrar-partida]').forEach(b => b.addEventListener('click', async () => {
      try { if (await borrarPartidaDialogo(tes.partidas().find(x => x.id === b.dataset.borrarPartida))) { aviso('Partida borrada', 'ok'); repintar(); } } catch (e) { aviso(e.message, 'error'); }
    }));
    cuerpo.querySelectorAll('[data-nueva-partida]').forEach(b => b.addEventListener('click', async () => {
      try { if (await dialogoPartida()) { aviso('Partida añadida', 'ok'); repintar(); } } catch (e) { aviso(e.message, 'error'); }
    }));
  };
  // En un desplegable de partidas, «Nueva partida…» la crea ahí mismo y la deja elegida
  const NUEVA = '__nueva';
  const opcionNueva = h`<option value="${NUEVA}">➕ Nueva partida…</option>`;
  const conectarSelectPartida = (sel) => {
    let anterior = sel.value;
    sel.addEventListener('focus', () => { anterior = sel.value; });
    sel.addEventListener('change', async () => {
      if (sel.value !== NUEVA) { anterior = sel.value; return; }
      try {
        const p = await dialogoPartida();
        if (!p) { sel.value = anterior; return; }
        const o = document.createElement('option'); o.value = p.id; o.textContent = p.nombre;
        sel.insertBefore(o, sel.querySelector(`option[value="${NUEVA}"]`)); sel.value = p.id; anterior = p.id;
        aviso(`Partida «${p.nombre}» añadida`, 'ok');
        sel.dispatchEvent(new Event('change'));
      } catch (e) { aviso(e.message, 'error'); sel.value = anterior; }
    });
  };

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
        <div class="pestanas" role="tablist">${PESTANAS.map(([k, n]) => h`<button type="button" role="tab" class="btn btn-pequeno ${k === pestana ? 'btn-primario' : ''}" aria-selected="${k === pestana}" data-pestana="${k}">${n}</button>`)}</div>
        <button type="button" class="btn btn-pequeno" id="te-cerrar" style="margin-left:auto">🔒 Cerrar tesorería</button>
      </div>
      <div id="te-cuerpo"></div>`);
    main.querySelectorAll('[data-pestana]').forEach(b => b.addEventListener('click', () => { pestana = b.dataset.pestana; editando = null; editandoMov = null; dibujar(); }));
    $('#te-cerrar', main).addEventListener('click', () => { tes.cerrar(); });
    const cuerpo = $('#te-cuerpo', main);
    if (pestana === 'movimientos') await pintarMovimientos(cuerpo);
    else if (pestana === 'cuotas') await pintarCuotas(cuerpo);
    else if (pestana === 'cuentas') await pintarCuentas(cuerpo);
    else if (pestana === 'sepa') await pintarSepa(cuerpo);
    else if (pestana === 'presupuesto') await pintarPresupuesto(cuerpo);
    else if (pestana === 'socios') pintarSocios(cuerpo);
    else if (pestana === 'partidas') await pintarPartidas(cuerpo);
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
    </form>
    ${nuevo ? '' : (() => { const pagos = tes.movimientosDeSocio(s.id); return h`<div class="tarjeta" id="te-pagos"><h2>Movimientos de este socio</h2>
      ${pagos.length ? h`<ul class="lista">${pagos.map(m => h`<li class="item"><span class="item-principal"><span class="item-titulo">${fecha(m.fecha)} · ${euros(m.importe)}</span>
        <span class="item-sub">${tes.nombrePartida(m.partida) || 'Sin clasificar'}${m.anio ? ` ${m.anio}` : ''} · ${m.concepto}</span></span></li>`)}</ul>`
      : h`<p class="muted peq">Todavía no tiene movimientos asignados.</p>`}</div>`; })()}`);
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

  // --- Movimientos del banco -------------------------------------------------
  const pintarMovimientos = async (cuerpo) => {
    await tes.asegurarPartidas();
    const anios = tes.aniosMovimientos();
    if (anios.length && filtro.anio !== 'todos' && !anios.includes(filtro.anio)) filtro.anio = anios[0];
    const anioSel = filtro.anio === 'todos' ? null : filtro.anio;
    const etiqueta = anioSel ?? 'desde el principio';
    const parts = tes.partidas();
    const lista = tes.movimientos({ anio: anioSel, partida: filtro.partida === '' ? undefined : filtro.partida === 'sin' ? null : filtro.partida, texto: filtro.texto });
    const r = tes.resumen(anioSel);
    const porAnios = anioSel ? [] : tes.resumenPorAnios();
    const sb = tes.saldoBanco();
    const huecos = tes.comprobarSaldos();
    const socios = tes.socios();
    const nombreSocio = (id) => { const x = socios.find(y => y.id === id); return x ? tes.nombreCompleto(x) : (id ? 'socio borrado' : null); };
    const fila = (m) => {
      if (editandoMov === m.id) return h`<li class="item mov-editar" id="mov-${m.id}"><form class="mov-form" data-mov="${m.id}" style="width:100%">
        <p style="margin:0 0 .5rem"><strong>${fecha(m.fecha)} · ${euros(m.importe)}</strong><br><span class="peq">${m.concepto}</span></p>
        <div class="rejilla rejilla-2">
          <div class="campo"><label for="me-partida">Partida</label><select id="me-partida"><option value="">— Sin clasificar —</option>${parts.map(p => h`<option value="${p.id}" ${m.partida === p.id ? h`selected` : ''}>${p.nombre}</option>`)}${opcionNueva}</select></div>
          <div class="campo"><label for="me-socio">Socio</label><select id="me-socio"><option value="">— Ninguno —</option>${socios.map(x => h`<option value="${x.id}" ${m.socio_id === x.id ? h`selected` : ''}>${x.numero ? `${x.numero} · ` : ''}${tes.nombreCompleto(x)}</option>`)}</select></div>
          <div class="campo"><label for="me-anio">Año de la cuota</label><input id="me-anio" type="number" min="2000" max="2100" value="${m.anio ?? ''}" placeholder="Solo para cuotas"></div>
          <div class="campo"><label for="me-nota">Nota</label><input id="me-nota" value="${m.nota || ''}"></div>
        </div>
        <div class="fila"><button class="btn btn-primario btn-pequeno" type="submit">Guardar</button><button class="btn btn-pequeno" type="button" data-cancelar>Cancelar</button>
          <button class="btn btn-pequeno" type="button" data-regla="${m.concepto}">Crear regla con este concepto</button>
          ${m.origen === 'banco' ? '' : h`<button class="btn btn-peligro btn-pequeno" type="button" data-borrar-mov="${m.id}">Borrar</button>`}</div>
      </form></li>`;
      return h`<li><a class="item mov" href="#/tesoreria" data-editar-mov="${m.id}" id="mov-${m.id}">
        <span class="item-principal"><span class="item-titulo">${m.concepto}</span>
          <span class="item-sub">${fecha(m.fecha)} · ${m.partida ? h`${tes.nombrePartida(m.partida)}${m.anio ? ` ${m.anio}` : ''}` : h`<span class="chip chip-aviso">Sin clasificar</span>`}${m.socio_id ? ` · ${nombreSocio(m.socio_id)}` : ''}${m.remesa_id ? ' · Remesa SEPA' : ''}${m.nota ? ` · ${m.nota}` : ''}</span></span>
        <span class="importe ${m.importe < 0 ? 'negativo' : 'positivo'}">${euros(m.importe)}</span></a></li>`;
    };
    pintar(cuerpo, h`
      <div class="kpis">
        <div class="kpi"><b>${sb ? euros(sb.saldo) : '—'}</b><span>Saldo según el banco${sb ? ` (${fecha(sb.fecha)})` : ''}</span></div>
        <div class="kpi"><b>${euros(r.ingresos)}</b><span>Ingresos ${etiqueta}</span></div>
        <div class="kpi"><b>${euros(r.gastos)}</b><span>Gastos ${etiqueta}</span></div>
        <div class="kpi"><b>${r.sinClasificar}</b><span>Sin clasificar</span></div>
      </div>
      ${huecos.length ? h`<div class="aviso-caja alerta peq" id="te-huecos"><strong>Revisa los movimientos:</strong><ul>${huecos.map(x => h`<li>${x.texto}</li>`)}</ul>Descarga del banco un periodo que los incluya e impórtalo: los que ya están no se duplican.</div>` : ''}
      <div class="tarjeta">
        <label class="btn btn-primario">⬆️ Importar movimientos del banco (Excel)<input type="file" id="te-banco" accept=".xlsx" hidden></label>
        <p class="peq muted" style="margin:.4rem 0 0">El Excel que descargas de la banca online. Se puede importar las veces que haga falta: los movimientos que ya están no se repiten.</p>
      </div>
      <div class="tarjeta">
        <div class="rejilla rejilla-3">
          <div class="campo"><label for="mf-anio">Año</label><select id="mf-anio"><option value="todos" ${anioSel ? '' : h`selected`}>Histórico (todos los años)</option>${(anios.length ? anios : [new Date().getFullYear()]).map(a => h`<option value="${a}" ${a === anioSel ? h`selected` : ''}>${a}</option>`)}</select></div>
          <div class="campo"><label for="mf-partida">Partida</label><select id="mf-partida"><option value="">Todas</option><option value="sin" ${filtro.partida === 'sin' ? h`selected` : ''}>Sin clasificar</option>${parts.map(p => h`<option value="${p.id}" ${filtro.partida === p.id ? h`selected` : ''}>${p.nombre}</option>`)}</select></div>
          <div class="campo"><label for="mf-texto">Buscar</label><input id="mf-texto" type="search" value="${filtro.texto}" placeholder="Concepto, nota…"></div>
        </div>
        ${r.filas.length ? h`<details><summary><strong>Resumen por partidas ${etiqueta}</strong></summary><div class="tabla-scroll"><table class="tabla-resumen">
          <thead><tr><th>Partida</th><th class="num">Ingresos</th><th class="num">Gastos</th><th class="num">Neto</th></tr></thead>
          <tbody>${r.filas.map(f => h`<tr><td>${f.partida.nombre}</td><td class="num">${euros(f.ingresos)}</td><td class="num">${euros(f.gastos)}</td><td class="num">${euros(f.ingresos - f.gastos)}</td></tr>`)}
            <tr><th>Total</th><th class="num">${euros(r.ingresos)}</th><th class="num">${euros(r.gastos)}</th><th class="num">${euros(r.ingresos - r.gastos)}</th></tr></tbody></table></div></details>` : ''}
        <details id="te-partidas" ${partidasAbiertas ? h`open` : ''}><summary><strong>Partidas: añadir, editar o borrar</strong></summary>${listaPartidas(parts)}
          <p class="peq muted">Las reglas automáticas, la cuota y el texto del recordatorio están en la pestaña «Partidas».</p></details>
      </div>
      ${porAnios.length ? h`<div class="tarjeta" id="te-historico"><h2>Año por año</h2><div class="tabla-scroll"><table class="tabla-resumen">
        <thead><tr><th>Año</th><th class="num">Ingresos</th><th class="num">Gastos</th><th class="num">Resultado</th><th class="num">Saldo al acabar</th></tr></thead>
        <tbody>${porAnios.map(y => h`<tr><td><button type="button" class="enlace" data-ir-anio="${y.anio}">${y.anio}</button></td><td class="num">${euros(y.ingresos)}</td><td class="num">${euros(y.gastos)}</td><td class="num">${euros(y.resultado)}</td><td class="num">${y.saldoFinal === null ? '—' : euros(y.saldoFinal)}</td></tr>`)}
          <tr><th>Total</th><th class="num">${euros(r.ingresos)}</th><th class="num">${euros(r.gastos)}</th><th class="num">${euros(r.ingresos - r.gastos)}</th><th></th></tr></tbody></table></div>
        <p class="peq muted">Toca un año para ver solo sus movimientos.</p></div>` : ''}
      ${lista.length ? h`<ul class="lista tarjeta" id="te-movs">${lista.slice(0, filtro.limite).map(fila)}</ul>${lista.length > filtro.limite ? h`<p class="tarjeta"><button type="button" class="btn" id="te-mas">Ver ${Math.min(200, lista.length - filtro.limite)} más (de ${lista.length})</button></p>` : ''}` : h`<p class="muted tarjeta">${tes.aniosMovimientos().length ? 'Ningún movimiento con estos filtros.' : 'Todavía no hay movimientos. Importa el Excel del banco.'}</p>`}
      <details class="tarjeta"><summary><strong>Añadir un movimiento a mano</strong> <span class="muted peq">(efectivo, por ejemplo)</span></summary>
        <form id="te-manual" class="rejilla rejilla-2" style="margin-top:.5rem">
          <div class="campo"><label for="mm-fecha">Fecha</label><input id="mm-fecha" type="date" value="${hoyISO()}" required></div>
          <div class="campo"><label for="mm-importe">Importe (negativo si es gasto)</label><input id="mm-importe" inputmode="decimal" required placeholder="25 o -12,50"></div>
          <div class="campo"><label for="mm-concepto">Concepto</label><input id="mm-concepto" required></div>
          <div class="campo"><label for="mm-partida">Partida</label><select id="mm-partida"><option value="">— Sin clasificar —</option>${parts.map(p => h`<option value="${p.id}">${p.nombre}</option>`)}${opcionNueva}</select></div>
          <div><button class="btn btn-primario" type="submit">Añadir</button></div>
        </form></details>`);

    $('#te-banco', cuerpo).addEventListener('change', async (ev) => {
      const f = ev.target.files?.[0]; ev.target.value = '';
      if (!f) return;
      try {
        const res = await tes.importarMovimientos(await leerXlsx(f));
        aviso(`Movimientos: ${res.nuevos} nuevos (${res.clasificados} clasificados solos) y ${res.repetidos} que ya estaban.${res.sinClasificar ? ` Quedan ${res.sinClasificar} por clasificar.` : ''}`, 'ok', { ms: 8000 });
        if (filtro.anio !== 'todos') filtro.anio = tes.aniosMovimientos()[0] || filtro.anio;
      } catch (e) { aviso(e.message || 'No se pudo leer el Excel.', 'error'); }
      dibujar();
    });
    $('#mf-anio', cuerpo).addEventListener('change', (ev) => { filtro.anio = ev.target.value === 'todos' ? 'todos' : Number(ev.target.value); filtro.limite = 200; pintarMovimientos(cuerpo); });
    cuerpo.querySelectorAll('[data-ir-anio]').forEach(b => b.addEventListener('click', () => { filtro.anio = Number(b.dataset.irAnio); filtro.limite = 200; pintarMovimientos(cuerpo).then(() => window.scrollTo(0, 0)); }));
    $('#te-mas', cuerpo)?.addEventListener('click', () => { filtro.limite += 200; pintarMovimientos(cuerpo); });
    $('#mf-partida', cuerpo).addEventListener('change', (ev) => { filtro.partida = ev.target.value; pintarMovimientos(cuerpo); });
    $('#mf-texto', cuerpo).addEventListener('input', async (ev) => { filtro.texto = ev.target.value; await pintarMovimientos(cuerpo); const c = $('#mf-texto', cuerpo); c.focus(); c.setSelectionRange(c.value.length, c.value.length); });
    cuerpo.querySelectorAll('[data-editar-mov]').forEach(a => a.addEventListener('click', (ev) => { ev.preventDefault(); editandoMov = a.dataset.editarMov; pintarMovimientos(cuerpo).then(() => $(`#mov-${editandoMov}`, cuerpo)?.scrollIntoView({ block: 'center' })); }));
    $('#te-partidas', cuerpo).addEventListener('toggle', (ev) => { partidasAbiertas = ev.target.open; });
    conectarPartidas(cuerpo, () => pintarMovimientos(cuerpo));
    conectarSelectPartida($('#mm-partida', cuerpo));
    const form = $('.mov-form', cuerpo);
    if (form) {
      conectarSelectPartida($('#me-partida', form));
      const m = tes.movimientos().find(x => x.id === form.dataset.mov);
      // Al elegir la partida de cuotas, el año se propone solo
      $('#me-partida', form).addEventListener('change', (ev) => { if (ev.target.value === tes.partidaCuotas()?.id && !$('#me-anio', form).value) $('#me-anio', form).value = String(m.fecha).slice(0, 4); });
      form.querySelector('[data-cancelar]').addEventListener('click', () => { editandoMov = null; pintarMovimientos(cuerpo); });
      form.querySelector('[data-regla]').addEventListener('click', (ev) => { reglaPropuesta = ev.target.dataset.regla; pestana = 'partidas'; editandoMov = null; dibujar(); });
      form.querySelector('[data-borrar-mov]')?.addEventListener('click', async () => {
        if (!await confirmar('¿Borrar este movimiento?', 'Solo se pueden borrar los añadidos a mano.', 'Borrar', true)) return;
        try { await tes.borrarMovimiento(m.id); editandoMov = null; aviso('Movimiento borrado', 'ok'); pintarMovimientos(cuerpo); } catch (e) { aviso(e.message, 'error'); }
      });
      form.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        try {
          await tes.guardarMovimiento({ id: m.id, partida: $('#me-partida', form).value, socio_id: $('#me-socio', form).value, anio: $('#me-anio', form).value, nota: $('#me-nota', form).value });
          editandoMov = null; aviso('Movimiento guardado', 'ok'); pintarMovimientos(cuerpo);
        } catch (e) { aviso(e.message, 'error'); }
      });
    }
    $('#te-manual', cuerpo).addEventListener('submit', async (ev) => {
      ev.preventDefault();
      try {
        await tes.guardarMovimiento({ fecha: $('#mm-fecha', cuerpo).value, importe: $('#mm-importe', cuerpo).value, concepto: $('#mm-concepto', cuerpo).value, partida: $('#mm-partida', cuerpo).value });
        aviso('Movimiento añadido', 'ok'); pintarMovimientos(cuerpo);
      } catch (e) { aviso(e.message, 'error'); }
    });
  };

  // --- Cuotas por año ---------------------------------------------------------
  const ESTADOS = { pagado: ['Pagada', 'chip-ok'], parcial: ['Pago parcial', 'chip-aviso'], pendiente: ['Pendiente', 'chip-alerta'], exento: ['Exento', 'chip-info'] };
  const pintarCuotas = async (cuerpo) => {
    await tes.asegurarPartidas();
    const anios = tes.aniosCuotas();
    if (!anios.includes(fc.anio)) fc.anio = anios[0];
    const c = tes.cuotasAnio(fc.anio);
    const debenPagar = (f) => f.estado === 'pendiente' || f.estado === 'parcial';
    const lista = c.filas.filter(f => fc.ver === 'todos' || (fc.ver === 'pendientes' ? debenPagar(f) : f.estado === 'pagado'));
    pintar(cuerpo, h`
      <div class="tarjeta fila" style="align-items:flex-end">
        <div class="campo" style="margin:0"><label for="cu-anio">Cuota del año</label><select id="cu-anio">${anios.map(a => h`<option value="${a}" ${a === fc.anio ? h`selected` : ''}>${a}</option>`)}</select></div>
        <div class="pestanas" role="group" aria-label="Qué socios ver" style="flex:1 1 auto">${[['pendientes', 'Pendientes'], ['pagados', 'Pagadas'], ['todos', 'Todos']].map(([k, n]) => h`<button type="button" class="btn btn-pequeno ${fc.ver === k ? 'btn-primario' : ''}" aria-pressed="${fc.ver === k}" data-ver="${k}">${n}</button>`)}</div>
      </div>
      <div class="kpis">
        <div class="kpi"><b>${c.cuenta.pagado} / ${c.filas.length - c.cuenta.exento}</b><span>Han pagado</span></div>
        <div class="kpi"><b>${c.cuenta.pendiente + c.cuenta.parcial}</b><span>Faltan${c.cuenta.parcial ? ` (${c.cuenta.parcial} con pago parcial)` : ''}</span></div>
        <div class="kpi"><b>${euros(c.recaudado)}</b><span>Recaudado de ${euros(c.previsto)}</span></div>
        <div class="kpi"><b>${euros(c.pendiente)}</b><span>Por cobrar</span></div>
      </div>
      ${c.filas.length ? '' : h`<p class="muted tarjeta">No hay socios dados de alta en ${fc.anio}. Añádelos o impórtalos en «Socios».</p>`}
      ${lista.length ? h`<ul class="lista tarjeta" id="cu-lista">${lista.map(f => { const correo = f.socio.email; const tel = f.socio.telefono; const texto = tes.mensajeRecordatorio({ ...f, anio: fc.anio }); const wa = tes.enlaceWhatsApp(tel, texto);
        return h`<li class="item cuota" data-cuota="${f.socio.id}"><div class="item-principal">
          <div class="item-titulo">${f.socio.numero ? `${f.socio.numero} · ` : ''}${tes.nombreCompleto(f.socio)} <span class="chip ${ESTADOS[f.estado][1]}">${ESTADOS[f.estado][0]}</span></div>
          <div class="item-sub">${f.estado === 'exento' ? 'No paga cuota' : `Pagado ${euros(f.pagado)} de ${euros(f.debe)}`}${f.pagos.length ? ` · ${f.pagos.map(m => fecha(m.fecha)).join(', ')}` : ''}</div>
          ${debenPagar(f) ? h`<div class="fila" style="margin-top:.35rem">
            ${wa ? h`<a class="btn btn-pequeno" href="${wa}" target="_blank" rel="noopener">WhatsApp</a>` : ''}
            ${correo ? h`<a class="btn btn-pequeno" href="mailto:${correo}?subject=${encodeURIComponent(`Cuota ${fc.anio} del Club Gallina Alacantina`)}&body=${encodeURIComponent(texto)}">Correo</a>` : ''}
            <button type="button" class="btn btn-pequeno" data-efectivo="${f.socio.id}" data-falta="${f.falta}">Pago en efectivo</button></div>` : ''}
        </div></li>`; })}</ul>`
      : c.filas.length ? h`<p class="muted tarjeta">${fc.ver === 'pendientes' ? '¡Todos han pagado la cuota de este año!' : 'Nadie en esta lista.'}</p>` : ''}
      ${c.fuera.length ? h`<p class="aviso-caja info peq">Hay ${c.fuera.length} cuota(s) de ${fc.anio} de personas que no constan como socias ese año (revisa sus fechas de alta y baja).</p>` : ''}
      <div class="fila">${c.cuenta.pendiente + c.cuenta.parcial ? h`<button class="btn" id="cu-copiar">📋 Copiar la lista de pendientes</button>` : ''}
        ${c.filas.length ? h`<button class="btn" id="cu-csv">⬇️ Cuotas ${fc.anio} (CSV)</button>` : ''}</div>
      <p class="peq muted">Cuenta como pagada la cuota con movimientos en «Cuotas de socios» de ese año asignados al socio. El texto del recordatorio y el importe de la cuota se cambian en «Partidas»; la cuota especial o la exención, en la ficha del socio.</p>`);
    $('#cu-anio', cuerpo).addEventListener('change', (ev) => { fc.anio = Number(ev.target.value); pintarCuotas(cuerpo); });
    cuerpo.querySelectorAll('[data-ver]').forEach(b => b.addEventListener('click', () => { fc.ver = b.dataset.ver; pintarCuotas(cuerpo); }));
    cuerpo.querySelectorAll('[data-efectivo]').forEach(b => b.addEventListener('click', async () => {
      const s = c.filas.find(f => f.socio.id === b.dataset.efectivo).socio;
      const ok = await dialogo({ titulo: `Pago en efectivo · ${tes.nombreCompleto(s)}`, cuerpo: h`<label for="dlg-importe">Importe (€)</label><input id="dlg-importe" inputmode="decimal" value="${String(b.dataset.falta).replace('.', ',')}">
        <label for="dlg-fecha">Fecha</label><input id="dlg-fecha" type="date" value="${hoyISO()}">`,
        acciones: [{ valor: 'no', texto: 'Cancelar' }, { valor: 'si', texto: 'Anotar el pago', primario: true }] });
      const importe = document.getElementById('dlg-importe')?.value, f = document.getElementById('dlg-fecha')?.value;
      if (ok !== 'si') return;
      try { await tes.pagoEnEfectivo(s.id, fc.anio, importe, f); aviso(`Pago de ${tes.nombreCompleto(s)} anotado`, 'ok'); pintarCuotas(cuerpo); } catch (e) { aviso(e.message, 'error'); }
    }));
    $('#cu-copiar', cuerpo)?.addEventListener('click', async () => {
      const txt = `Cuota ${fc.anio}: pendientes\n` + c.filas.filter(debenPagar).map(f => `${f.socio.numero ? `${f.socio.numero} · ` : ''}${tes.nombreCompleto(f.socio)} · falta ${euros(f.falta)}${f.socio.telefono ? ` · ${f.socio.telefono}` : ''}`).join('\n');
      try { await navigator.clipboard.writeText(txt); aviso('Lista copiada', 'ok'); } catch { aviso('No se pudo copiar.', 'error'); }
    });
    $('#cu-csv', cuerpo)?.addEventListener('click', () => {
      const filas = [['NUMERO', 'NOMBRE', 'ESTADO', 'CUOTA', 'PAGADO', 'FALTA', 'FECHAS_PAGO', 'TELEFONO', 'CORREO']];
      c.filas.forEach(f => filas.push([f.socio.numero || '', tes.nombreCompleto(f.socio), ESTADOS[f.estado][0], f.debe, f.pagado, f.falta, f.pagos.map(m => m.fecha).join(' '), f.socio.telefono || '', f.socio.email || '']));
      descargar(csv(filas), `CGA_cuotas_${fc.anio}_${hoyISO()}.csv`);
      aviso('Ojo: el CSV no va cifrado. Guárdalo en un sitio seguro.', 'info', { ms: 7000 });
    });
  };

  // --- Cuentas del año (asamblea) -----------------------------------------------
  const pintarCuentas = async (cuerpo) => {
    await tes.asegurarPartidas();
    const anios = tes.aniosMovimientos();
    if (!anios.length) { pintar(cuerpo, h`<p class="muted tarjeta">Todavía no hay movimientos. Importa el Excel del banco en «Movimientos».</p>`); return; }
    // Por defecto, el último año cerrado si lo hay (en enero se preparan las cuentas del anterior)
    if (!anios.includes(anioCuentas)) anioCuentas = anios.find(a => a < new Date().getFullYear()) || anios[0];
    const c = tes.cuentasAnio(anioCuentas);
    pintar(cuerpo, h`
      <div class="tarjeta fila" style="align-items:flex-end">
        <div class="campo" style="margin:0"><label for="cc-anio">Ejercicio</label><select id="cc-anio">${anios.map(a => h`<option value="${a}" ${a === anioCuentas ? h`selected` : ''}>${a}</option>`)}</select></div>
        <button class="btn btn-primario" id="cc-imprimir">🖨️ Imprimir o guardar en PDF</button>
        <button class="btn" id="cc-csv">⬇️ CSV</button>
      </div>
      ${c.sinClasificar.ingresos || c.sinClasificar.gastos ? h`<p class="aviso-caja aviso peq">Hay movimientos sin clasificar en ${c.anio}: aparecen como «Sin clasificar». Clasifícalos en «Movimientos» antes de presentar las cuentas.</p>` : ''}
      <div class="doc-pantalla" id="cc-doc">${docs.plantillaCuentas(c)}</div>`);
    const t1 = cuerpo.querySelector('#cc-doc h1');
    if (t1) { const h2 = document.createElement('h2'); h2.innerHTML = t1.innerHTML; t1.replaceWith(h2); }
    $('#cc-anio', cuerpo).addEventListener('change', (ev) => { anioCuentas = Number(ev.target.value); pintarCuentas(cuerpo); });
    $('#cc-imprimir', cuerpo).addEventListener('click', () => docs.cuentas(c));
    $('#cc-csv', cuerpo).addEventListener('click', () => {
      const filas = [['TIPO', 'PARTIDA', String(c.anio), String(c.anio - 1)]];
      c.filas.filter(f => f.ingresos || f.anterior.ingresos).forEach(f => filas.push(['Ingreso', f.partida.nombre, f.ingresos, f.anterior.ingresos]));
      c.filas.filter(f => f.gastos || f.anterior.gastos).forEach(f => filas.push(['Gasto', f.partida.nombre, f.gastos, f.anterior.gastos]));
      filas.push(['Total', 'Ingresos', c.ingresos, c.anterior.ingresos], ['Total', 'Gastos', c.gastos, c.anterior.gastos], ['Total', 'Resultado', c.resultado, Math.round((c.anterior.ingresos - c.anterior.gastos) * 100) / 100],
        ['Banco', 'Saldo inicial', c.banco.inicial ?? '', ''], ['Banco', 'Saldo final', c.banco.final ?? '', '']);
      descargar(csv(filas), `CGA_cuentas_${c.anio}.csv`);
    });
  };

  // --- Presupuesto anual por partidas ----------------------------------------------
  const pintarPresupuesto = async (cuerpo) => {
    await tes.asegurarPartidas();
    const anios = tes.aniosPresupuesto();
    if (!anios.includes(anioPres)) anioPres = (tes.presupuesto(new Date().getFullYear() + 1) || new Date().getMonth() >= 9) ? new Date().getFullYear() + 1 : new Date().getFullYear(); // desde octubre se prepara el del año siguiente
    const x = tes.ejecucion(anioPres);
    const lineas = borradorPres || Object.fromEntries(x.filas.map(f => [f.partida.id, { ...f.previsto }]));
    const num = (v) => (v ? String(v).replace('.', ',') : '');
    const pct = (real, prev) => (prev ? Math.round(100 * real / prev) : null);
    const conReal = x.total.real.ingresos || x.total.real.gastos;
    const celda = (f, k) => { const prev = aNum(lineas[f.partida.id]?.[k]); const p = pct(f.real[k], prev);
      const pasa = k === 'gastos' && prev && f.real[k] > prev;
      return h`<div class="campo" style="margin:0"><label for="pp-${k}-${f.partida.id}">${k === 'ingresos' ? 'Ingresos' : 'Gastos'} previstos (€)</label>
        <input id="pp-${k}-${f.partida.id}" data-linea="${f.partida.id}" data-k="${k}" inputmode="decimal" value="${num(lineas[f.partida.id]?.[k])}" placeholder="0">
        <span class="peq ${pasa ? 'texto-alerta' : 'muted'}">${conReal || f.real[k] ? `Real: ${euros(f.real[k])}${p !== null ? ` (${p} %)` : ''}${pasa ? ' · por encima de lo previsto' : ''}` : ''}${f.anterior[k] ? ` · ${x.anio - 1}: ${euros(f.anterior[k])}` : ''}</span></div>`; };
    const totPrev = (k) => Object.values(lineas).reduce((a, l) => a + aNum(l?.[k]), 0);
    pintar(cuerpo, h`
      <div class="tarjeta fila" style="align-items:flex-end">
        <div class="campo" style="margin:0"><label for="pp-anio">Año</label><select id="pp-anio">${anios.map(a => h`<option value="${a}" ${a === anioPres ? h`selected` : ''}>${a}${tes.presupuesto(a) ? '' : ' (sin presupuesto)'}</option>`)}</select></div>
        <button class="btn" type="button" id="pp-rellenar">Rellenar con lo real de ${anioPres - 1}</button>
      </div>
      <div class="kpis">
        <div class="kpi"><b id="pp-ti">${euros(totPrev('ingresos'))}</b><span>Ingresos previstos</span></div>
        <div class="kpi"><b id="pp-tg">${euros(totPrev('gastos'))}</b><span>Gastos previstos</span></div>
        <div class="kpi"><b id="pp-tr">${euros(totPrev('ingresos') - totPrev('gastos'))}</b><span>Resultado previsto</span></div>
        ${conReal ? h`<div class="kpi"><b>${pct(x.total.real.gastos, totPrev('gastos')) ?? '—'} %</b><span>Gasto ejecutado (${Math.round(100 * x.transcurrido)} % del año)</span></div>` : ''}
      </div>
      <form class="tarjeta" id="pp-form">
        <ul class="lista">${x.filas.map(f => h`<li class="item"><div class="item-principal">
          <div class="item-titulo">${f.partida.nombre}</div>
          <div class="rejilla rejilla-2" style="margin-top:.35rem">${f.partida.tipo !== 'gasto' ? celda(f, 'ingresos') : ''}${f.partida.tipo !== 'ingreso' ? celda(f, 'gastos') : ''}</div>
        </div></li>`)}</ul>
        <div class="rejilla rejilla-2">
          <div class="campo"><label for="pp-aprobado">Aprobado en asamblea el (opcional)</label><input id="pp-aprobado" type="date" value="${x.presupuesto?.aprobado || ''}"></div>
          <div class="campo"><label for="pp-notas">Notas (opcional)</label><input id="pp-notas" value="${x.presupuesto?.notas || ''}" placeholder="p. ej. subida de la cuota a 30 €"></div>
        </div>
        <div class="fila"><button class="btn btn-primario" type="submit">Guardar el presupuesto</button>
          <button class="btn" type="button" id="pp-imprimir" ${x.presupuesto ? '' : h`disabled`}>🖨️ Imprimir o guardar en PDF</button>
          ${x.presupuesto ? h`<button class="btn btn-peligro" type="button" id="pp-borrar">Borrar</button>` : ''}</div>
        ${borradorPres ? h`<p class="peq aviso-caja aviso">Hay cambios sin guardar.</p>` : ''}
      </form>
      <p class="peq muted">Para cada partida, lo que se prevé ingresar o gastar en el año. Mientras el año avanza, debajo de cada importe sale lo real y el porcentaje ejecutado. Las cuentas del ejercicio muestran también la columna del presupuesto.</p>`);
    $('#pp-anio', cuerpo).addEventListener('change', async (ev) => {
      if (borradorPres && !await confirmar('¿Cambiar de año?', 'Hay cambios sin guardar en este presupuesto.', 'Cambiar', true)) { ev.target.value = String(anioPres); return; }
      anioPres = Number(ev.target.value); borradorPres = null; pintarPresupuesto(cuerpo);
    });
    $('#pp-rellenar', cuerpo).addEventListener('click', () => {
      const prop = tes.propuestaPresupuesto(anioPres);
      if (!Object.keys(prop).length) { aviso(`No hay movimientos de ${anioPres - 1} para tomar como base.`, 'error'); return; }
      borradorPres = Object.fromEntries(x.filas.map(f => [f.partida.id, prop[f.partida.id] || { ingresos: 0, gastos: 0 }]));
      pintarPresupuesto(cuerpo);
    });
    cuerpo.querySelectorAll('[data-linea]').forEach(inp => inp.addEventListener('change', () => {
      borradorPres = borradorPres || Object.fromEntries(Object.entries(lineas).map(([k, v]) => [k, { ...v }]));
      borradorPres[inp.dataset.linea] = { ...(borradorPres[inp.dataset.linea] || {}), [inp.dataset.k]: inp.value };
      // Solo se actualizan los totales: sin volver a pintar, para no perder el sitio al escribir
      const t2 = (k) => Object.values(borradorPres).reduce((a, l) => a + aNum(l?.[k]), 0);
      $('#pp-ti', cuerpo).textContent = euros(t2('ingresos')); $('#pp-tg', cuerpo).textContent = euros(t2('gastos')); $('#pp-tr', cuerpo).textContent = euros(t2('ingresos') - t2('gastos'));
    }));
    $('#pp-form', cuerpo).addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const l = Object.fromEntries(x.filas.map(f => [f.partida.id, { ingresos: $(`#pp-ingresos-${f.partida.id}`, cuerpo)?.value ?? 0, gastos: $(`#pp-gastos-${f.partida.id}`, cuerpo)?.value ?? 0 }]));
      try { await tes.guardarPresupuesto(anioPres, { lineas: l, aprobado: $('#pp-aprobado', cuerpo).value || null, notas: $('#pp-notas', cuerpo).value }); borradorPres = null; aviso(`Presupuesto ${anioPres} guardado`, 'ok'); pintarPresupuesto(cuerpo); }
      catch (e) { aviso(e.message, 'error'); }
    });
    $('#pp-imprimir', cuerpo).addEventListener('click', () => docs.presupuestoDoc(tes.ejecucion(anioPres)));
    $('#pp-borrar', cuerpo)?.addEventListener('click', async () => {
      if (!await confirmar(`¿Borrar el presupuesto ${anioPres}?`, 'Se borra en todos los dispositivos de tesorería.', 'Borrar', true)) return;
      await tes.borrarPresupuesto(anioPres); borradorPres = null; pintarPresupuesto(cuerpo);
    });
  };

  // --- SEPA: acreedor, mandatos y remesas ----------------------------------------
  const pintarSepa = async (cuerpo) => {
    await tes.asegurarPartidas();
    const a = tes.acreedor();
    const socios = tes.socios().filter(s => !tes.estaDeBaja(s));
    const conCuenta = socios.filter(s => s.iban || s.mandato_ref);
    const anios = tes.aniosCuotas();
    if (!anios.includes(fr.anio)) fr.anio = anios[0];
    if (!fr.fecha || fr.fecha < tes.fechaCobroMinima()) fr.fecha = tes.fechaCobroMinima();
    const cand = tes.candidatosRemesa(fr.anio);
    const elegidos = cand.filter(f => f.mandato.ok && !fr.quitados.has(f.socio.id));
    const total = elegidos.reduce((x, f) => x + f.falta, 0);
    const rem = tes.remesas();
    pintar(cuerpo, h`
      <form class="tarjeta" id="se-acreedor"><h2>El Club como acreedor</h2>
        <div class="rejilla rejilla-2">
          <div class="campo"><label for="se-nif">NIF del Club</label><input id="se-nif" value="${a.nif || ''}"></div>
          <div class="campo"><label for="se-sufijo">Sufijo (lo da el banco; normalmente 000)</label><input id="se-sufijo" value="${a.sufijo || '000'}" maxlength="3"></div>
          <div class="campo"><label>Identificador de acreedor</label><p style="margin:.4rem 0"><strong id="se-id">${a.id || '—'}</strong></p></div>
          <div class="campo"><label for="se-bic">BIC de la cuenta del Club (opcional)</label><input id="se-bic" value="${a.bic || ''}" placeholder="Lo indica el banco"></div>
          <div class="campo"><label for="se-nombre">Nombre</label><input id="se-nombre" value="${a.nombre || ''}"></div>
          <div class="campo"><label>Cuenta del Club</label><p style="margin:.4rem 0">${a.cuenta ? tes.formatearIban(a.cuenta) : 'Se guarda al importar el primer Excel del banco'}</p></div>
          <div class="campo"><label for="se-dir">Dirección</label><input id="se-dir" value="${a.direccion || ''}"></div>
          <div class="campo"><label for="se-pob">Código postal, población y provincia</label><input id="se-pob" value="${a.poblacion || ''}"></div>
        </div>
        <p class="peq muted">El identificador sale del NIF con la fórmula oficial (ES + dígitos de control + sufijo + NIF). Confirmad con Caixa Popular el sufijo y el identificador al dar de alta el servicio de adeudos.</p>
        <button class="btn" type="submit">Guardar</button>
      </form>

      <div class="tarjeta" id="se-mandatos"><h2>Órdenes de domiciliación (mandatos)</h2>
        <p class="peq">Para cobrar a un socio por el banco hace falta su orden firmada: imprímela con sus datos ya puestos, que la firme, guárdala y anota la fecha de firma. Guárdala firmada mientras se le sigan pasando cobros; si pasan 36 meses sin cobrarle nada, la orden caduca y tendría que firmar otra.</p>
        ${conCuenta.length ? h`<ul class="lista">${conCuenta.map(s => { const e = tes.estadoMandato(s); return h`<li class="item"><div class="item-principal">
          <div class="item-titulo">${s.numero ? `${s.numero} · ` : ''}${tes.nombreCompleto(s)} ${e.ok ? h`<span class="chip chip-ok">Firmada ${fecha(s.mandato_fecha)}</span>` : h`<span class="chip chip-aviso">Falta ${e.falta}</span>`}</div>
          <div class="item-sub">${s.iban ? tes.formatearIban(s.iban) : 'Sin IBAN'}${s.mandato_ref ? ` · ref. ${s.mandato_ref}` : ''}</div>
          <div class="fila" style="margin-top:.35rem">${s.iban && tes.ibanValido(s.iban) ? h`<button type="button" class="btn btn-pequeno" data-mandato="${s.id}">🖨️ Orden para firmar</button>` : ''}
            ${s.mandato_ref && !s.mandato_fecha ? h`<button type="button" class="btn btn-pequeno" data-firmada="${s.id}">Anotar la firma</button>` : ''}</div>
        </div></li>`; })}</ul>` : h`<p class="muted peq">Ningún socio tiene todavía IBAN. Pónselo en su ficha (pestaña Socios) a quien quiera domiciliar la cuota.</p>`}
      </div>

      <div class="tarjeta" id="se-remesa"><h2>Nueva remesa de cuotas</h2>
        <div class="rejilla rejilla-3">
          <div class="campo"><label for="sr-anio">Cuota del año</label><select id="sr-anio">${anios.map(x => h`<option value="${x}" ${x === fr.anio ? h`selected` : ''}>${x}</option>`)}</select></div>
          <div class="campo"><label for="sr-fecha">Fecha de cobro</label><input id="sr-fecha" type="date" min="${tes.fechaCobroMinima()}" value="${fr.fecha}"></div>
          <div class="campo"><label for="sr-concepto">Concepto (lo verá el socio en su banco)</label><input id="sr-concepto" maxlength="140" value="Cuota ${fr.anio} Club Gallina Alacantina"></div>
        </div>
        ${cand.length ? h`<ul class="lista">${cand.map(f => h`<li class="item"><label class="fila" style="width:100%;margin:0">
          <input type="checkbox" data-incluir="${f.socio.id}" ${f.mandato.ok && !fr.quitados.has(f.socio.id) ? h`checked` : ''} ${f.mandato.ok ? '' : h`disabled`}>
          <span class="item-principal"><span class="item-titulo">${tes.nombreCompleto(f.socio)} · ${euros(f.falta)}</span>
          <span class="item-sub">${f.mandato.ok ? `Mandato ${f.socio.mandato_ref}` : `No se puede: falta ${f.mandato.falta}`}</span></span></label></li>`)}</ul>`
        : h`<p class="muted peq">No hay cuotas pendientes de ${fr.anio}.</p>`}
        <p><strong>${elegidos.length} cobro(s) · ${euros(total)}</strong></p>
        <button class="btn btn-primario" id="sr-generar" ${elegidos.length ? '' : h`disabled`}>Generar el fichero de la remesa</button>
        <p class="peq muted">Se descarga un fichero XML (SEPA, «Cuaderno 19.14»). Súbelo en la banca online de Caixa Popular, en el apartado de remesas de adeudos o envío de ficheros. Cuando el abono aparezca en el extracto, al importarlo se reparte solo entre estos socios como cuotas pagadas.</p>
      </div>

      ${rem.length ? h`<div class="tarjeta" id="se-emitidas"><h2>Remesas generadas</h2><ul class="lista">${rem.map(r => { const ab = tes.abonoDeRemesa(r.id); return h`<li class="item"><div class="item-principal">
        <div class="item-titulo">Cobro ${fecha(r.fecha_cobro)} · ${r.detalle.length} socio(s) · ${euros(r.total)} ${ab ? h`<span class="chip chip-ok">Cobrada</span>` : h`<span class="chip chip-aviso">Pendiente de ver en el banco</span>`}</div>
        <div class="item-sub">Cuota ${r.anio} · ${r.msg_id}${ab ? ` · abono del ${fecha(ab.fecha)}` : ''}</div>
        ${ab ? '' : h`<button type="button" class="btn btn-pequeno" data-borrar-remesa="${r.id}" style="margin-top:.35rem">Borrar (no se presentó)</button>`}</div></li>`; })}</ul>
        <p class="peq muted">Si el banco devuelve algún recibo, la devolución sale en el extracto en negativo: asígnala al socio y a «Cuotas de socios» y su cuota volverá a quedar pendiente.</p></div>` : ''}`);

    $('#se-acreedor', cuerpo).addEventListener('input', () => {
      try { $('#se-id', cuerpo).textContent = sepa.idAcreedor($('#se-nif', cuerpo).value, $('#se-sufijo', cuerpo).value); } catch { $('#se-id', cuerpo).textContent = '—'; }
    });
    $('#se-acreedor', cuerpo).addEventListener('submit', async (ev) => {
      ev.preventDefault();
      try { await tes.guardarAcreedor({ nif: $('#se-nif', cuerpo).value, sufijo: $('#se-sufijo', cuerpo).value, nombre: $('#se-nombre', cuerpo).value, direccion: $('#se-dir', cuerpo).value, poblacion: $('#se-pob', cuerpo).value, bic: $('#se-bic', cuerpo).value }); aviso('Datos del acreedor guardados', 'ok'); pintarSepa(cuerpo); }
      catch (e) { aviso(e.message, 'error'); }
    });
    cuerpo.querySelectorAll('[data-mandato]').forEach(b => b.addEventListener('click', async () => {
      try { docs.mandato(await tes.prepararMandato(b.dataset.mandato)); pintarSepa(cuerpo); } catch (e) { aviso(e.message, 'error'); }
    }));
    cuerpo.querySelectorAll('[data-firmada]').forEach(b => b.addEventListener('click', async () => {
      const s = tes.socios().find(x => x.id === b.dataset.firmada);
      const ok = await dialogo({ titulo: `Orden firmada · ${tes.nombreCompleto(s)}`, cuerpo: h`<label for="dlg-firma">Fecha de la firma</label><input id="dlg-firma" type="date" max="${hoyISO()}" value="${hoyISO()}">`,
        acciones: [{ valor: 'no', texto: 'Cancelar' }, { valor: 'si', texto: 'Guardar', primario: true }] });
      const f = document.getElementById('dlg-firma')?.value;
      if (ok !== 'si' || !f) return;
      try { await tes.guardarSocio({ ...s, mandato_fecha: f }); aviso('Firma anotada', 'ok'); pintarSepa(cuerpo); } catch (e) { aviso(e.message, 'error'); }
    }));
    $('#sr-anio', cuerpo).addEventListener('change', (ev) => { fr.anio = Number(ev.target.value); fr.quitados.clear(); pintarSepa(cuerpo); });
    $('#sr-fecha', cuerpo).addEventListener('change', (ev) => { fr.fecha = ev.target.value; });
    cuerpo.querySelectorAll('[data-incluir]').forEach(c => c.addEventListener('change', () => { if (c.checked) fr.quitados.delete(c.dataset.incluir); else fr.quitados.add(c.dataset.incluir); pintarSepa(cuerpo); }));
    $('#sr-generar', cuerpo)?.addEventListener('click', async () => {
      const fechaCobro = $('#sr-fecha', cuerpo).value;
      if (!await confirmar('¿Generar la remesa?', `${elegidos.length} cobro(s) por ${euros(total)}, con fecha de cobro ${fecha(fechaCobro)}. Después súbela a la banca online.`, 'Generar')) return;
      try {
        const r = await tes.generarRemesa({ anio: fr.anio, fechaCobro, socioIds: elegidos.map(f => f.socio.id), concepto: $('#sr-concepto', cuerpo).value });
        descargar(r.xml, r.nombre, 'application/xml');
        aviso(`Remesa generada: ${r.n} cobro(s) por ${euros(r.total)}. Súbela a la banca online.`, 'ok', { ms: 8000 });
        fr.quitados.clear(); pintarSepa(cuerpo);
      } catch (e) { aviso(e.message, 'error'); }
    });
    cuerpo.querySelectorAll('[data-borrar-remesa]').forEach(b => b.addEventListener('click', async () => {
      if (!await confirmar('¿Borrar la remesa?', 'Solo si no llegaste a presentarla en el banco.', 'Borrar', true)) return;
      try { await tes.borrarRemesa(b.dataset.borrarRemesa); pintarSepa(cuerpo); } catch (e) { aviso(e.message, 'error'); }
    }));
  };

  // --- Partidas, reglas y cuota --------------------------------------------------
  const pintarPartidas = async (cuerpo) => {
    await tes.asegurarPartidas();
    const parts = tes.partidas(), rs = tes.reglas(), conf = tes.configuracion();
    const propuesta = reglaPropuesta ? tes.normalizar(reglaPropuesta).split(' ').filter(w => w.length > 2 && !['trf', 'rcbo'].includes(w)).slice(0, 3).join(' ') : '';
    pintar(cuerpo, h`
      <div class="tarjeta"><h2>Partidas</h2>
        <p class="peq muted">Los grupos en que se reparten ingresos y gastos para las cuentas. «Cuotas de socios» es la que cuenta para saber quién ha pagado.</p>
        ${listaPartidas(parts)}
      </div>
      <div class="tarjeta" id="tp-reglas"><h2>Reglas automáticas</h2>
        <p class="peq muted">Al importar, si el concepto del banco contiene el texto, el movimiento va a esa partida. Las transferencias de un socio por el importe de la cuota van solas a «Cuotas de socios».</p>
        ${rs.length ? h`<ul class="lista">${rs.map(r => h`<li class="item"><span class="item-principal"><span class="item-titulo">«${r.texto}» → ${tes.nombrePartida(r.partida) || '¿?'}</span>
          <span class="item-sub">${r.signo === '+' ? 'Solo ingresos' : r.signo === '-' ? 'Solo gastos' : 'Ingresos y gastos'}</span></span>
          <button class="btn btn-pequeno" data-borrar-regla="${r.id}" aria-label="Borrar la regla ${r.texto}">Borrar</button></li>`)}</ul>` : h`<p class="muted peq">Sin reglas.</p>`}
        <form id="tr-nueva" class="rejilla rejilla-3" style="margin-top:.5rem">
          <div class="campo"><label for="tr-texto">Si el concepto contiene</label><input id="tr-texto" value="${propuesta}" placeholder="p. ej. anillas"></div>
          <div class="campo"><label for="tr-partida">Va a la partida</label><select id="tr-partida">${parts.map(p => h`<option value="${p.id}">${p.nombre}</option>`)}</select></div>
          <div class="campo"><label for="tr-signo">Para</label><select id="tr-signo"><option value="">Ingresos y gastos</option><option value="+">Solo ingresos</option><option value="-">Solo gastos</option></select></div>
          <div class="fila"><button class="btn btn-primario" type="submit">Añadir regla</button><button class="btn" type="button" id="tr-aplicar">Aplicar a los sin clasificar</button></div>
        </form>
      </div>
      <form class="tarjeta" id="tc-config"><h2>Cuota y cuenta</h2>
        <div class="rejilla rejilla-2">
          <div class="campo"><label for="tc-cuota">Importe de la cuota anual (€)</label><input id="tc-cuota" inputmode="decimal" value="${String(conf.cuota).replace('.', ',')}"></div>
          <div class="campo"><label>Cuenta del Club</label><p style="margin:.4rem 0">${conf.cuenta ? tes.formatearIban(conf.cuenta) : 'Se guarda al importar el primer Excel del banco'}</p></div>
        </div>
        <div class="campo"><label for="tc-mensaje">Texto del recordatorio de la cuota</label><textarea id="tc-mensaje" rows="4">${conf.mensaje || tes.MENSAJE_CUOTA}</textarea>
          <p class="ayuda">Se rellenan solos: {nombre}, {anio}, {importe} (lo que falta) y {cuenta}.</p></div>
        <button class="btn" type="submit">Guardar</button>
      </form>`);
    if (propuesta) { $('#tr-texto', cuerpo).focus(); $('#tp-reglas', cuerpo).scrollIntoView({ block: 'start' }); reglaPropuesta = ''; }
    conectarPartidas(cuerpo, () => pintarPartidas(cuerpo));
    cuerpo.querySelectorAll('[data-borrar-regla]').forEach(b => b.addEventListener('click', async () => { await tes.borrarRegla(b.dataset.borrarRegla); pintarPartidas(cuerpo); }));
    $('#tr-nueva', cuerpo).addEventListener('submit', async (ev) => {
      ev.preventDefault();
      try { await tes.guardarRegla({ texto: $('#tr-texto', cuerpo).value, partida: $('#tr-partida', cuerpo).value, signo: $('#tr-signo', cuerpo).value }); const n = await tes.aplicarReglas(); aviso(`Regla añadida${n ? `: ${n} movimiento(s) clasificados` : ''}.`, 'ok'); pintarPartidas(cuerpo); }
      catch (e) { aviso(e.message, 'error'); }
    });
    $('#tr-aplicar', cuerpo).addEventListener('click', async () => { const n = await tes.aplicarReglas(); aviso(n ? `${n} movimiento(s) clasificados.` : 'No había nada nuevo que clasificar.', 'ok'); });
    $('#tc-config', cuerpo).addEventListener('submit', async (ev) => { ev.preventDefault(); try { await tes.guardarConfiguracion({ cuota: $('#tc-cuota', cuerpo).value, mensaje: $('#tc-mensaje', cuerpo).value.trim() || null }); aviso('Guardado', 'ok'); } catch (e) { aviso(e.message, 'error'); } });
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
  // No se vuelve a pintar mientras se edita (una ficha, un movimiento o el presupuesto): se perdería lo escrito
  const quitar = tes.alCambiar(() => { if (!tes.abierta()) { editando = null; editandoMov = null; borradorPres = null; dibujar(); } else if (!editando && !editandoMov && !borradorPres && !document.querySelector('dialog[open]')) dibujar(); });
  const tocar = () => tes.actividad();
  main.addEventListener('input', tocar); main.addEventListener('click', tocar);
  return () => { quitar(); main.removeEventListener('input', tocar); main.removeEventListener('click', tocar); };
}
