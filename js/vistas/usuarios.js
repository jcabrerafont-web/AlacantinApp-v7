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
  const dibujar = () => {
    const yo = datos.estado.perfil.id;
    const ejemplares = (id) => datos.estado.todos.filter(a => a.usuario_id === id);
    const t = sinAcentos(texto.trim());
    const lista = [...datos.estado.perfiles]
      .filter(u => !filtro || (filtro === 'nuevos' ? datos.esAltaNueva(u) : u.rol === filtro))
      .filter(u => !t || sinAcentos([u.nombre, u.email, u.rega, u.municipio, u.numero_socio].join(' ')).includes(t))
      .sort((a, b) => (datos.esAltaNueva(b) - datos.esAltaNueva(a)) || String(a.nombre || a.email).localeCompare(String(b.nombre || b.email), 'es'));
    pintar(main, h`
      <p class="peq"><a href="#/admin">‹ Administración</a></p>
      <h1>Usuarios y roles</h1>
      <p class="muted">Aspirante → Criador es automático al registrar un REGA válido. Inspector y Administrador los asignas tú; el servidor rechaza cualquier otro cambio de rol.</p>
      <div class="tarjeta">
        <div class="campo"><label for="us-buscar">Buscar</label>
          <input id="us-buscar" type="search" autocomplete="off" placeholder="Nombre, correo, REGA o municipio" value="${texto}"></div>
        <div class="fila" role="group" aria-label="Filtrar por">${FILTROS.map(([v, n]) => h`<button type="button" class="btn btn-pequeno" data-filtro="${v}" aria-pressed="${String(filtro === v)}">${n}</button>`)}</div>
      </div>
      <p class="peq muted">${lista.length} usuario(s)</p>
      <ul class="lista tarjeta" id="us-lista">${lista.map(u => {
        const ej = ejemplares(u.id);
        const activos = ej.filter(a => a.estado !== 'baja').length;
        return h`<li><details class="usuario">
          <summary class="item"><span class="item-principal">
            <span class="item-titulo">${u.nombre || '—'} ${datos.esAltaNueva(u) ? h`<span class="chip chip-info">Nueva</span>` : ''}</span>
            <span class="item-sub">${ROLES[u.rol] || u.rol} · ${activos} ejemplar(es) · ${u.municipio || 'sin municipio'}</span></span></summary>
          <dl class="datos-usuario">
            <dt>Correo</dt><dd>${u.email ? h`<a href="mailto:${u.email}">${u.email}</a>` : '—'}</dd>
            <dt>Teléfono</dt><dd>${u.telefono ? h`<a href="tel:${u.telefono}">${u.telefono}</a>` : '—'}</dd>
            <dt>REGA</dt><dd>${u.rega || '—'}</dd>
            <dt>Socio n.º</dt><dd>${u.numero_socio || '—'}</dd>
            <dt>Municipio</dt><dd>${[u.municipio, u.provincia].filter(Boolean).join(' (') + (u.provincia && u.municipio ? ')' : '') || '—'}</dd>
            <dt>Ejemplares</dt><dd>${activos} activo(s)${ej.length > activos ? `, ${ej.length - activos} de baja` : ''}</dd>
            <dt>Alta</dt><dd>${fecha(u.created_at)}</dd>
          </dl>
          <div class="campo"><label for="rol-${u.id}">Rol</label>
            <select id="rol-${u.id}" data-usuario="${u.id}" ${u.id === yo ? h`disabled title="No puedes cambiar tu propio rol"` : ''}>
              ${Object.entries(ROLES).filter(([k]) => k !== 'visitante').map(([k, n]) => h`<option value="${k}" ${u.rol === k ? h`selected` : ''}>${n}</option>`)}
            </select></div>
          <p class="peq"><a href="#/admin/supabase">Contraseña olvidada o baja de la cuenta →</a></p>
        </details></li>`;
      })}</ul>
      ${datos.estado.perfiles.length <= 1 ? h`<p class="muted">Los usuarios aparecen aquí cuando se registran en la app.</p>` : ''}`);

    const input = $('#us-buscar', main);
    input.addEventListener('input', () => { texto = input.value; const pos = input.selectionStart; dibujar(); const i = $('#us-buscar', main); i.focus(); i.setSelectionRange(pos, pos); });
    main.querySelectorAll('[data-filtro]').forEach(b => b.addEventListener('click', () => { filtro = b.dataset.filtro; dibujar(); }));
    main.querySelectorAll('[data-usuario]').forEach(sel => sel.addEventListener('change', async () => {
      const u = datos.estado.perfiles.find(x => x.id === sel.dataset.usuario);
      if (!(await confirmar('Cambiar rol', `¿Asignar el rol «${ROLES[sel.value]}» a ${u.nombre || u.email}?`))) { sel.value = u.rol; return; }
      try { await datos.cambiarRol(u.id, sel.value); aviso('Rol actualizado.', 'ok'); } catch (e) { aviso(e.message, 'error'); sel.value = u.rol; }
    }));
  };
  dibujar();
  return datos.suscribir(dibujar);
}
