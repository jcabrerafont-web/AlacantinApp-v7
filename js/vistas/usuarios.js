// Administración de usuarios y roles (solo administrador)
import * as datos from '../datos.js';
import { ROLES } from '../auth.js';
import { h, pintar, aviso, confirmar } from '../ui.js';

export default function (main) {
  const dibujar = () => {
    const lista = [...datos.estado.perfiles].sort((a, b) => String(a.nombre || a.email).localeCompare(String(b.nombre || b.email), 'es'));
    const animalesDe = (id) => datos.estado.todos.filter(a => a.usuario_id === id && a.estado !== 'baja').length;
    pintar(main, h`
      <h1>Usuarios y roles</h1>
      <p class="muted">Los roles los asigna solo un administrador; el servidor rechaza cualquier otro cambio de rol. Aspirante → Criador es automático al registrar un REGA válido.</p>
      <div class="tarjeta"><div class="tabla-scroll"><table>
        <thead><tr><th>Usuario</th><th>REGA</th><th class="num">Ejemplares</th><th>Rol</th></tr></thead>
        <tbody>${lista.map(u => h`<tr>
          <td><strong>${u.nombre || '—'}</strong><br><small>${u.email || ''}</small></td>
          <td>${u.rega || '—'}</td><td class="num">${animalesDe(u.id)}</td>
          <td><select data-usuario="${u.id}" aria-label="Rol de ${u.nombre || u.email}" ${u.id === datos.estado.perfil.id ? h`disabled title="No puedes cambiar tu propio rol"` : ''}>
            ${Object.entries(ROLES).filter(([k]) => k !== 'visitante').map(([k, t]) => h`<option value="${k}" ${u.rol === k ? h`selected` : ''}>${t}</option>`)}
          </select></td></tr>`)}</tbody>
      </table></div>
      ${lista.length <= 1 ? h`<p class="muted">Los usuarios aparecen aquí tras registrarse y sincronizar.</p>` : ''}</div>`);
    main.querySelectorAll('[data-usuario]').forEach(sel => sel.addEventListener('change', async () => {
      const u = datos.estado.perfiles.find(x => x.id === sel.dataset.usuario);
      if (!(await confirmar('Cambiar rol', `¿Asignar el rol «${ROLES[sel.value]}» a ${u.nombre || u.email}?`))) { sel.value = u.rol; return; }
      try { await datos.cambiarRol(u.id, sel.value); aviso('Rol actualizado.', 'ok'); } catch (e) { aviso(e.message, 'error'); sel.value = u.rol; }
    }));
  };
  dibujar();
  return datos.suscribir(dibujar);
}
