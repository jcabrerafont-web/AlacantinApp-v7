// Comunicados del Club: circulares fechadas a los socios. Todos los usuarios los leen;
// la administración los escribe, los corrige o los borra. Un comunicado dice qué
// comunicó el Club y cuándo, con su fuente; no pretende estar siempre vigente.
import * as datos from '../datos.js';
import { h, pintar, $, aviso, confirmar, fecha, hoyISO } from '../ui.js';

export default function (main) {
  const admin = datos.rol() === 'administrador';
  const q = new URLSearchParams(location.hash.split('?')[1] || '');
  let editando = null;
  const dibujar = () => {
    const lista = datos.comunicados();
    const hoy = hoyISO();
    const e = editando ? lista.find(x => x.id === editando) : null;
    pintar(main, h`
      <h1>Comunicados del Club</h1>
      <p class="muted">Avisos de la Asociación a sus socios: sanidad animal, plazos, encuentros y novedades del Libro. Cada uno lleva su fecha; lo que dice vale para ese momento.</p>
      ${lista.length ? h`<ul class="lista comunicados">${lista.map(c => h`<li class="tarjeta comunicado" id="com-${c.id}">
        <div class="fila entre" style="align-items:baseline"><h2 style="margin:0">${c.titulo}</h2>
          ${c.destacado_hasta && c.destacado_hasta >= hoy ? h`<span class="chip chip-info">Destacado</span>` : ''}</div>
        <p class="peq muted" style="margin:.15rem 0 .5rem">${fecha(c.fecha)}</p>
        <p class="comunicado-texto">${c.texto}</p>
        ${c.fuente || c.enlace ? h`<p class="peq"><strong>Fuente:</strong> ${c.fuente || ''}${c.enlace ? h`${c.fuente ? ' · ' : ''}<a href="${c.enlace}" target="_blank" rel="noopener">enlace oficial</a>` : ''}</p>` : ''}
        ${admin ? h`<button class="btn btn-pequeno" data-editar="${c.id}">Editar</button>` : ''}
      </li>`)}</ul>` : h`<p class="muted tarjeta">Todavía no hay comunicados.</p>`}

      ${admin ? h`<form class="tarjeta" id="com-form"><h2>${e ? 'Editar comunicado' : 'Nuevo comunicado'}</h2>
        <div class="campo"><label for="com-titulo">Título</label><input id="com-titulo" maxlength="120" required value="${e?.titulo || ''}"></div>
        <div class="campo"><label for="com-fecha">Fecha</label><input id="com-fecha" type="date" required value="${e?.fecha || hoy}"></div>
        <div class="campo"><label for="com-texto">Texto</label><textarea id="com-texto" rows="6" maxlength="4000" required>${e?.texto || ''}</textarea></div>
        <div class="campo"><label for="com-fuente">Fuente (opcional)</label><input id="com-fuente" maxlength="300" placeholder="Resolución de…, Orden…, FESACOCUR…" value="${e?.fuente || ''}"></div>
        <div class="campo"><label for="com-enlace">Enlace oficial (opcional)</label><input id="com-enlace" type="url" placeholder="https://" value="${e?.enlace || ''}"></div>
        <div class="campo"><label for="com-destacado">Destacar en Mi censo hasta (opcional)</label><input id="com-destacado" type="date" value="${e?.destacado_hasta || ''}">
          <p class="ayuda">Hasta esa fecha sale arriba en Mi censo de cada socio, hasta que lo abra o lo cierre. Pasada la fecha queda en esta lista como archivo.</p></div>
        <div class="fila"><button class="btn btn-primario" type="submit">${e ? 'Guardar cambios' : 'Publicar'}</button>
          ${e ? h`<button class="btn" type="button" id="com-cancelar">Cancelar</button><button class="btn btn-peligro" type="button" id="com-borrar">Borrar</button>` : ''}</div>
      </form>` : ''}`);

    main.querySelectorAll('[data-editar]').forEach(b => b.addEventListener('click', () => { editando = b.dataset.editar; dibujar(); $('#com-form', main).scrollIntoView({ block: 'start' }); }));
    $('#com-cancelar', main)?.addEventListener('click', () => { editando = null; dibujar(); });
    $('#com-borrar', main)?.addEventListener('click', async () => {
      if (!await confirmar('¿Borrar este comunicado?', 'Desaparecerá también de los móviles de los socios.', 'Borrar', true)) return;
      try { await datos.borrarComunicado(editando); editando = null; aviso('Comunicado borrado', 'ok'); dibujar(); } catch (err) { aviso(err.message, 'error'); }
    });
    $('#com-form', main)?.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      try {
        await datos.guardarComunicado({ id: editando, titulo: $('#com-titulo', main).value, fecha: $('#com-fecha', main).value, texto: $('#com-texto', main).value,
          fuente: $('#com-fuente', main).value, enlace: $('#com-enlace', main).value, destacado_hasta: $('#com-destacado', main).value });
        aviso(editando ? 'Cambios guardados' : 'Comunicado publicado', 'ok'); editando = null; dibujar();
      } catch (err) { aviso(err.message, 'error'); }
    });
  };
  dibujar();
  const c = q.get('c');
  if (c && document.getElementById(`com-${c}`)) { datos.marcarComunicadoVisto(c); setTimeout(() => document.getElementById(`com-${c}`)?.scrollIntoView({ block: 'start' }), 50); }
}
