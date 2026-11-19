// Solicitudes de inspección (inspección y administración): contactar, programar, calificar y cerrar.
import * as datos from '../datos.js';
import { h, pintar, $, aviso, fecha, hoyISO } from '../ui.js';

const CHIP = { pendiente: 'chip-aviso', programada: 'chip-info', realizada: 'chip-ok', anulada: '' };
let verTodas = false;

export default function (main) {
  const dibujar = () => {
    const todas = datos.solicitudesTodas();
    const abiertas = todas.filter(datos.solicitudAbiertaEs);
    const lista = verTodas ? todas : abiertas;
    const perfil = (id) => datos.estado.perfiles.find(x => x.id === id) || {};

    pintar(main, h`
      <h1>Solicitudes de inspección</h1>
      <div class="kpis">
        <div class="kpi"><b>${todas.filter(s => s.estado === 'pendiente').length}</b><span>Pendientes de llamar</span></div>
        <div class="kpi"><b>${todas.filter(s => s.estado === 'programada').length}</b><span>Visitas programadas</span></div>
        <div class="kpi"><b>${abiertas.reduce((n, s) => n + datos.progresoSolicitud(s).total - datos.progresoSolicitud(s).hechas, 0)}</b><span>Ejemplares por calificar</span></div>
      </div>
      <label class="fila peq"><input type="checkbox" id="ins-todas" ${verTodas ? h`checked` : ''}> Ver también las realizadas y anuladas</label>
      ${!lista.length ? h`<div class="tarjeta"><p class="muted">No hay solicitudes ${verTodas ? '' : 'abiertas'}.</p></div>` : ''}
      ${lista.map(s => {
        const c = perfil(s.usuario_id);
        const pr = datos.progresoSolicitud(s);
        const tel = datos.telefonoInternacional(s.telefono);
        const msg = encodeURIComponent(`Hola${c.nombre ? ` ${c.nombre.split(' ')[0]}` : ''}, soy ${datos.estado.perfil.nombre || 'el inspector'} de la Asociación Club Gallina Alacantina. Te escribo por tu solicitud de inspección de ${pr.total} ejemplar(es).`);
        const abierta = datos.solicitudAbiertaEs(s);
        return h`<form class="tarjeta" data-sol="${s.id}" novalidate>
          <div class="fila entre"><h2>${c.nombre || c.email || 'Criador'}</h2><span class="chip ${CHIP[s.estado]}">${datos.ESTADOS_SOLICITUD[s.estado]}</span></div>
          <p class="peq">${[c.numero_socio ? `Socio nº ${c.numero_socio}` : 'Sin nº de socio', c.municipio, c.provincia, c.rega ? `REGA ${c.rega}` : 'sin REGA'].filter(Boolean).join(' · ')}<br>
            Solicitada el ${fecha(s.created_at)} · ${datos.HORARIOS[s.horario] || ''}${s.notas ? h`<br><em>«${s.notas}»</em>` : ''}</p>
          <div class="fila" style="flex-wrap:wrap;gap:.4rem">
            ${tel ? h`<a class="btn btn-pequeno" href="tel:+${tel}">📞 ${s.telefono}</a>
              <a class="btn btn-pequeno" href="https://wa.me/${tel}?text=${msg}" target="_blank" rel="noopener">💬 WhatsApp</a>` : h`<span class="muted">Sin teléfono</span>`}
            ${c.latitud != null ? h`<a class="btn btn-pequeno" href="https://www.google.com/maps/search/?api=1&query=${c.latitud},${c.longitud}" target="_blank" rel="noopener">📍 Cómo llegar</a>` : ''}
          </div>
          <h3>Ejemplares (${pr.hechas} de ${pr.total} calificados)</h3>
          <ul class="lista-simple">${pr.filas.map(f => h`<li>${f.calif ? '✓' : '○'} <a href="#/animal/${f.id}">${f.a?.anilla || '—'}</a>
            ${f.a ? ` · ${f.a.sexo === 'M' ? 'gallo' : 'gallina'}` : ''}${f.calif ? ` · ${String(f.calif.total).replace('.', ',')} puntos · ${f.calif.resultado}`
              : abierta && f.a ? h` · <a href="#/calificar/${f.id}">Calificar</a>` : ''}</li>`)}</ul>
          ${abierta ? h`<div class="rejilla rejilla-2">
              <div class="campo"><label>Fecha de la visita</label><input type="date" name="fecha" value="${s.fecha_visita || ''}" min="${s.created_at.slice(0, 10)}"></div>
              <div class="campo"><label>Mensaje para el criador</label><input name="respuesta" value="${s.respuesta || ''}" maxlength="500" placeholder="Hora, qué preparar…"></div>
            </div>
            <div class="fila" style="flex-wrap:wrap;gap:.4rem">
              <button class="btn btn-primario btn-pequeno" type="submit" data-accion="programada">📅 ${s.estado === 'programada' ? 'Cambiar visita' : 'Programar visita'}</button>
              <button class="btn btn-pequeno" type="submit" data-accion="realizada" ${pr.hechas ? '' : h`disabled title="Califica al menos un ejemplar"`}>✅ Visita realizada</button>
              <button class="btn btn-pequeno" type="submit" data-accion="anulada">Anular</button>
            </div>` : h`<p class="muted peq">${s.fecha_visita ? `Visita ${fecha(s.fecha_visita)} · ` : ''}${s.inspector_nombre || ''}${s.respuesta ? ` · ${s.respuesta}` : ''}</p>`}
        </form>`;
      })}`);

    $('#ins-todas', main).addEventListener('change', e => { verTodas = e.target.checked; dibujar(); });
    main.querySelectorAll('form[data-sol]').forEach(f => f.addEventListener('submit', async e => {
      e.preventDefault();
      const accion = e.submitter?.dataset.accion;
      if (!accion) return;
      const fechaV = f.querySelector('[name=fecha]').value;
      if (accion === 'programada' && !fechaV) { aviso('Indica la fecha de la visita.', 'error'); return; }
      if (accion === 'anulada' && !f.querySelector('[name=respuesta]').value.trim()) { aviso('Explica al criador por qué se anula (campo «Mensaje»).', 'error'); return; }
      try {
        await datos.atenderSolicitud(f.dataset.sol, { estado: accion, fecha_visita: accion === 'realizada' ? fechaV || hoyISO() : fechaV, respuesta: f.querySelector('[name=respuesta]').value });
        aviso({ programada: 'Visita programada: el criador la verá en su solicitud.', realizada: 'Solicitud cerrada como realizada.', anulada: 'Solicitud anulada.' }[accion], 'ok');
        dibujar();
      } catch (err) { aviso(err.message, 'error'); }
    }));
  };
  dibujar();
  return datos.suscribir(() => { if (!document.activeElement?.closest?.('form')) dibujar(); });
}
