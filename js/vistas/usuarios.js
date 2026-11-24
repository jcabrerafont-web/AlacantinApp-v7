// Usuarios y roles (solo administrador): buscador, filtros, altas nuevas destacadas,
// contacto de cada socio y cambio de rol.
import * as datos from '../datos.js';
import { ROLES } from '../auth.js';
import { h, pintar, $, aviso, confirmar } from '../ui.js';

const FILTROS = [['', 'Todos'], ['nuevos', `Altas nuevas`], ['aspirante', 'Aspirantes'], ['criador', 'Criadores'], ['inspector', 'Inspectores'], ['administrador', 'Administradores']];
const fecha = (iso) => (iso ? new Date(iso).toLocaleDateString('es-ES') : '—');
const sinAcentos = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export default function (main) {
  const q = new URLSearchParams(location.hash.split('?')[1] || '');
  let filtro = q.get('filtro') === 'nuevos' ? 'nuevos' : (q.get('rol') || '');
  let texto = '';
  const abiertas = new Set(); // fichas abiertas: siguen abiertas al repintar
  let resultado = null; // última baja hecha: se queda a la vista (lleva el correo para contestarle)
  const dibujar = () => {
    const yo = datos.estado.perfil.id;
    const ejemplares = (id) => datos.estado.todos.filter(a => a.usuario_id === id);
    const t = sinAcentos(texto.trim());
    const porRevisar = datos.estado.perfiles.filter(u => u.id !== yo && datos.altaPorRevisar(u));
    const lista = [...datos.estado.perfiles]
      .filter(u => !filtro || (filtro === 'nuevos' ? datos.esAltaNueva(u) : u.rol === filtro))
      .filter(u => !t || sinAcentos([u.nombre, u.email, u.rega, u.municipio, u.numero_socio].join(' ')).includes(t))
      .sort((a, b) => (datos.altaPorRevisar(b) - datos.altaPorRevisar(a)) || (datos.esAltaNueva(b) - datos.esAltaNueva(a)) || String(a.nombre || a.email).localeCompare(String(b.nombre || b.email), 'es'));
    pintar(main, h`
      <p class="peq"><a href="#/admin">‹ Administración</a></p>
      <h1>Usuarios y roles</h1>
      <p class="muted">Aspirante → Criador es automático al registrar un REGA válido. Inspector y Administrador los asignas tú; el servidor rechaza cualquier otro cambio de rol.</p>
      <div class="tarjeta">
        <div class="campo"><label for="us-buscar">Buscar</label>
          <input id="us-buscar" type="search" autocomplete="off" placeholder="Nombre, correo, REGA o municipio" value="${texto}"></div>
        <div class="fila" role="group" aria-label="Filtrar por">${FILTROS.map(([v, n]) => h`<button type="button" class="btn btn-pequeno" data-filtro="${v}" aria-pressed="${String(filtro === v)}">${n}${v === 'nuevos' && porRevisar.length ? h` <span class="insignia-item" style="margin:0" aria-label="${porRevisar.length} por revisar">${porRevisar.length}</span>` : ''}</button>`)}</div>
      </div>
      ${porRevisar.length ? h`<div class="aviso-caja aviso peq" id="us-por-revisar"><strong>${porRevisar.length} alta(s) nueva(s) por revisar.</strong> Abre su ficha (queda revisada al abrirla): comprueba que es socio del Club y, si hace falta, cámbiale el rol.
        <button type="button" class="enlace" id="us-revisadas">Marcar ${porRevisar.length > 1 ? 'todas ' : ''}como revisada${porRevisar.length > 1 ? 's' : ''}</button></div>` : ''}
      ${resultado ? h`<div class="aviso-caja ${resultado.cuenta === 'pendiente' ? 'aviso' : 'ok'}" id="us-resultado" role="status" tabindex="-1">
        <strong>${resultado.nombre}: baja hecha.</strong> ${resultado.perfil === 'borrado' ? 'No tenía nada en el Libro: se ha borrado su perfil por completo.' : 'Se han borrado sus datos personales; sus ejemplares siguen en el Libro a su nombre.'}
        ${resultado.cuenta === 'pendiente' ? h`<br>Falta borrar su cuenta de acceso: <a href="#/admin/supabase">sigue la tarea «Dar de baja una cuenta» en Supabase</a> con el correo <strong>${resultado.email}</strong>.` : ' Su cuenta de acceso también está borrada.'}
        ${resultado.email ? h`<br>Si te pidió la baja, contéstale a <a href="mailto:${resultado.email}?subject=${encodeURIComponent('Baja en AlacantinApp')}">${resultado.email}</a> confirmándola.` : ''}
      </div>` : ''}
      <p class="peq muted">${lista.length} usuario(s)</p>
      <ul class="lista tarjeta" id="us-lista">${lista.map(u => {
        const ej = ejemplares(u.id);
        const activos = ej.filter(a => a.estado !== 'baja').length;
        return h`<li><details class="usuario" data-ficha="${u.id}" ${abiertas.has(u.id) ? h`open` : ''}>
          <summary class="item"><span class="item-principal">
            <span class="item-titulo">${u.nombre || '—'} ${u.baja ? h`<span class="chip">De baja</span>` : u.id !== yo && datos.altaPorRevisar(u) ? h`<span class="chip chip-revisar">Por revisar</span>` : datos.esAltaNueva(u) ? h`<span class="chip chip-info">Nueva</span>` : ''}</span>
            <span class="item-sub">${ROLES[u.rol] || u.rol} · ${activos} ejemplar(es) · ${u.municipio || 'sin municipio'}</span></span></summary>
          <dl class="datos-usuario">
            <dt>Correo</dt><dd>${u.email ? h`<a href="mailto:${u.email}">${u.email}</a>` : '—'}</dd>
            <dt>Teléfono</dt><dd>${u.telefono ? h`<a href="tel:${u.telefono}">${u.telefono}</a>` : '—'}</dd>
            <dt>REGA</dt><dd>${u.rega || '—'}</dd>
            <dt>Socio n.º</dt><dd>${u.numero_socio || '—'}</dd>
            <dt>Municipio</dt><dd>${[u.municipio, u.provincia].filter(Boolean).join(' (') + (u.provincia && u.municipio ? ')' : '') || '—'}</dd>
            <dt>Ejemplares</dt><dd>${activos} activo(s)${ej.length > activos ? `, ${ej.length - activos} de baja` : ''}</dd>
            <dt>Alta</dt><dd>${fecha(u.created_at)}</dd>
            ${u.baja ? h`<dt>Baja</dt><dd>${fecha(u.baja)} (datos personales borrados)</dd>` : ''}
          </dl>
          ${u.baja ? '' : h`
          <div class="campo"><label for="rol-${u.id}">Rol</label>
            <select id="rol-${u.id}" data-usuario="${u.id}" ${u.id === yo ? h`disabled title="No puedes cambiar tu propio rol"` : ''}>
              ${Object.entries(ROLES).filter(([k]) => k !== 'visitante').map(([k, n]) => h`<option value="${k}" ${u.rol === k ? h`selected` : ''}>${n}</option>`)}
            </select></div>
          <p class="peq"><a href="#/admin/supabase">Contraseña olvidada →</a></p>
          ${u.id === yo ? '' : h`<button type="button" class="btn btn-pequeno btn-peligro" data-baja="${u.id}">Dar de baja (RGPD)…</button>`}`}
        </details></li>`;
      })}</ul>
      ${datos.estado.perfiles.length <= 1 ? h`<p class="muted">Los usuarios aparecen aquí cuando se registran en la app.</p>` : ''}`);

    const input = $('#us-buscar', main);
    input.addEventListener('input', () => { texto = input.value; const pos = input.selectionStart; dibujar(); const i = $('#us-buscar', main); i.focus(); i.setSelectionRange(pos, pos); });
    // Abrir la ficha de un alta nueva cuenta como revisarla (deja de sumar en el aviso)
    main.querySelectorAll('[data-ficha]').forEach(d => d.addEventListener('toggle', () => {
      const u = datos.estado.perfiles.find(x => x.id === d.dataset.ficha);
      if (d.open) abiertas.add(d.dataset.ficha); else abiertas.delete(d.dataset.ficha);
      if (d.open && u && datos.altaPorRevisar(u)) datos.marcarAltasRevisadas([u.id]);
    }));
    $('#us-revisadas', main)?.addEventListener('click', () => datos.marcarAltasRevisadas(porRevisar.map(u => u.id)));
    main.querySelectorAll('[data-filtro]').forEach(b => b.addEventListener('click', () => { filtro = b.dataset.filtro; dibujar(); }));
    main.querySelectorAll('[data-usuario]').forEach(sel => sel.addEventListener('change', async () => {
      const u = datos.estado.perfiles.find(x => x.id === sel.dataset.usuario);
      if (!(await confirmar('Cambiar rol', `¿Asignar el rol «${ROLES[sel.value]}» a ${u.nombre || u.email}?`))) { sel.value = u.rol; return; }
      try { await datos.cambiarRol(u.id, sel.value); aviso('Rol actualizado.', 'ok'); } catch (e) { aviso(e.message, 'error'); sel.value = u.rol; }
    }));
    main.querySelectorAll('[data-baja]').forEach(b => b.addEventListener('click', async () => {
      const u = datos.estado.perfiles.find(x => x.id === b.dataset.baja);
      const n = datos.estado.todos.filter(a => a.usuario_id === u.id || a.criador_id === u.id).length;
      const c = datos.estado.calificaciones.filter(x => x.inspector_id === u.id).length;
      const quien = u.nombre || u.email;
      const enLibro = [n ? `${n} ejemplar(es)` : '', c ? `${c} calificación(es) firmadas` : ''].filter(Boolean).join(' y ');
      const texto = enLibro
        ? `${quien} tiene ${enLibro} en el Libro. Se borrarán su correo, teléfono, REGA, n.º de socio, ubicación, sus solicitudes de inspección y su cuenta de acceso. Lo inscrito en el Libro se conserva a nombre de «${u.nombre || 'usuario dado de baja'}», como exige la normativa del Libro Genealógico. No se puede deshacer.`
        : `${quien} no tiene nada en el Libro. Se borrarán su perfil, sus solicitudes de inspección y su cuenta de acceso. No se puede deshacer.`;
      if (!(await confirmar('Dar de baja (RGPD)', texto, 'Dar de baja', true))) return;
      b.disabled = true;
      try {
        const r = await datos.darDeBajaUsuario(u.id);
        resultado = { ...r, nombre: quien };
        dibujar();
        $('#us-resultado', main)?.focus?.();
      } catch (e) { aviso(e.message, 'error'); b.disabled = false; }
    }));
  };
  dibujar();
  return datos.suscribir(dibujar);
}
