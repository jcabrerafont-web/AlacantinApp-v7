// Solicitar inspección (criador): elige los ejemplares listos, deja el teléfono y el horario.
// La calificación es la llave del Registro Definitivo; esta pantalla la organiza.
import * as datos from '../datos.js';
import { esAuditor } from '../auth.js';
import { REGLAS } from '../estandar.js';
import { h, pintar, $, aviso, fecha, confirmar } from '../ui.js';

const CHIP = { pendiente: 'chip-aviso', programada: 'chip-info', realizada: 'chip-ok', anulada: '' };

export default function (main) {
  const dibujar = () => {
    const p = datos.estado.perfil;
    const abierta = datos.solicitudAbierta();
    const historial = datos.misSolicitudes().filter(s => s !== abierta);
    const cands = datos.porCalificar(p.id);
    const listos = cands.filter(x => x.listo);
    const proximos = cands.filter(x => !x.listo);
    const anilla = (id) => datos.animal(id)?.anilla || '—';

    pintar(main, h`
      <h1>Solicitar inspección</h1>
      ${esAuditor(p.rol) ? h`<p class="peq"><a href="#/inspecciones">Ver las solicitudes de todos los criadores →</a></p>` : ''}
      <div class="aviso-caja info peq">Un inspector del Club visita tu aviario, pesa y califica cada ejemplar en las 12 regiones del Estándar.
        Con la calificación <strong>Apto</strong> y un año cumplido, el ejemplar pasa al <strong>Registro Definitivo</strong>.
        Ten los animales en jaulas o en un corral pequeño, cada uno con su anilla legible. <a href="#/programa?s=calificacion">Cómo es la calificación →</a></div>
      ${!p.rega ? h`<div class="aviso-caja aviso peq">Sin código REGA puedes calificar tus animales, pero no pasarán al Registro Definitivo. Añádelo en <a href="#/perfil">Mi aviario</a>.</div>` : ''}

      ${abierta ? (() => {
        const pr = datos.progresoSolicitud(abierta);
        return h`<div class="tarjeta" id="sol-abierta"><div class="fila entre"><h2>Tu solicitud</h2><span class="chip ${CHIP[abierta.estado]}">${datos.ESTADOS_SOLICITUD[abierta.estado]}</span></div>
          <p>Enviada el ${fecha(abierta.created_at)} · ${pr.total} ejemplar(es) · ${datos.HORARIOS[abierta.horario]} · tel. ${abierta.telefono}</p>
          ${abierta.estado === 'programada' ? h`<div class="aviso-caja ok"><strong>Visita el ${fecha(abierta.fecha_visita)}</strong>${abierta.inspector_nombre ? ` · ${abierta.inspector_nombre}` : ''}${abierta.respuesta ? h`<br>${abierta.respuesta}` : ''}</div>`
            : h`<p class="muted peq">El inspector te llamará para concertar la visita.${datos.estado.online ? '' : ' La solicitud se enviará cuando tengas cobertura.'}</p>`}
          <ul class="lista-simple">${pr.filas.map(f => h`<li>${f.calif ? '✓' : '○'} <a href="#/animal/${f.id}">${f.a?.anilla || '—'}</a>${f.calif ? ` · ${String(f.calif.total).replace('.', ',')} puntos · ${f.calif.resultado}` : ''}</li>`)}</ul>
          <button class="btn" id="sol-anular">Anular la solicitud</button></div>`;
      })() : listos.length ? h`<form id="f-sol" class="tarjeta" novalidate><h2>Nueva solicitud</h2>
          <fieldset><legend>Ejemplares para calificar (${listos.length} con un año cumplido)</legend>
            ${listos.map(x => h`<label class="check-grande neutro"><input type="checkbox" name="sol-a" value="${x.a.id}" checked>
              ${x.a.anilla}${x.a.nombre ? ` · ${x.a.nombre}` : ''} <span class="muted peq">${x.a.sexo === 'M' ? 'gallo' : 'gallina'} · ${x.meses} meses${x.califs.length ? ' · recalificación' : ''}</span></label>`)}
          </fieldset>
          <div class="rejilla rejilla-2">
            <div class="campo"><label for="sol-tel">Teléfono de contacto</label><input id="sol-tel" type="tel" autocomplete="tel" value="${p.telefono || ''}" placeholder="612 345 678">
              ${!p.telefono ? h`<p class="ayuda">Se guardará también en Mi aviario.</p>` : ''}</div>
            <div class="campo"><label for="sol-horario">Mejor momento para la visita</label><select id="sol-horario">${Object.entries(datos.HORARIOS).map(([k, v]) => h`<option value="${k}">${v}</option>`)}</select></div>
          </div>
          <div class="campo"><label for="sol-notas">Notas para el inspector (opcional)</label><textarea id="sol-notas" rows="2" maxlength="500" placeholder="Cómo llegar, días que no estás…"></textarea></div>
          <button class="btn btn-primario btn-bloque" type="submit">Enviar solicitud</button></form>`
        : h`<div class="tarjeta"><p>${cands.length ? 'Aún no tienes ejemplares con un año cumplido sin calificar.' : 'No tienes ejemplares pendientes de calificar.'}</p></div>`}

      ${proximos.length ? h`<div class="tarjeta"><h2>Próximos</h2><p class="muted peq">Podrán pasar al Registro Definitivo cuando cumplan ${REGLAS.edadMinimaRD_meses} meses:</p>
        <ul class="lista-simple">${proximos.slice(0, 20).map(x => h`<li><a href="#/animal/${x.a.id}">${x.a.anilla}</a> · desde el ${fecha(x.fechaListo)}</li>`)}</ul></div>` : ''}

      ${historial.length ? h`<div class="tarjeta"><h2>Solicitudes anteriores</h2><ul class="lista">${historial.map(s => h`<li class="item"><div class="item-principal">
        <div class="item-titulo">${fecha(s.created_at)} · ${s.animales.length} ejemplar(es)</div>
        <div class="item-sub">${s.fecha_visita ? `Visita ${fecha(s.fecha_visita)} · ` : ''}${s.animales.map(anilla).join(', ')}${s.respuesta ? ` · ${s.respuesta}` : ''}</div></div>
        <span class="chip ${CHIP[s.estado]}">${datos.ESTADOS_SOLICITUD[s.estado]}</span></li>`)}</ul></div>` : ''}`);

    $('#sol-anular', main)?.addEventListener('click', async () => {
      if (!(await confirmar('Anular la solicitud', 'El inspector dejará de verla como pendiente. Podrás hacer otra cuando quieras.', 'Anular', true))) return;
      try { await datos.atenderSolicitud(abierta.id, { estado: 'anulada', respuesta: 'Anulada por el criador' }); aviso('Solicitud anulada.', 'ok'); dibujar(); } catch (e) { aviso(e.message, 'error'); }
    });
    const f = $('#f-sol', main);
    f?.addEventListener('submit', async e => {
      e.preventDefault();
      try {
        await datos.crearSolicitud({ animales: [...f.querySelectorAll('input[name=sol-a]:checked')].map(x => x.value),
          telefono: $('#sol-tel', f).value, horario: $('#sol-horario', f).value, notas: $('#sol-notas', f).value });
        aviso('Solicitud enviada. El inspector te llamará para concertar la visita.', 'ok');
        dibujar();
      } catch (err) { aviso(err.message, 'error'); }
    });
  };
  dibujar();
  return datos.suscribir(() => { if (!document.activeElement?.closest?.('form')) dibujar(); });
}
