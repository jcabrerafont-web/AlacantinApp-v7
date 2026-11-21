// Estado de la cola offline: qué falta por enviar y por qué ha fallado
import * as datos from '../datos.js';
import * as sync from '../sync.js';
import { supabaseConfigurado } from '../config.js';
import { obtenerCliente } from '../auth.js';
import { h, pintar, $, aviso } from '../ui.js';

const NOMBRES = { animales: 'Ejemplar', huevos: 'Huevo', calificaciones: 'Calificación', perfiles: 'Perfil', campanas: 'Campaña', lotes: 'Lote', incubaciones: 'Incubación', solicitudes: 'Solicitud de inspección' };

export default async function (main) {
  const dibujar = async () => {
    const cola = await sync.listarCola();
    const conf = await datos.conflictos();
    const uid = datos.estado.perfil?.id;
    const ultima = await sync.ultimaDescarga(uid);
    const puede = navigator.onLine && obtenerCliente();
    pintar(main, h`
      <h1>Sincronización</h1>
      ${!supabaseConfigurado() ? h`<div class="aviso-caja aviso">Modo dispositivo: no hay servidor configurado. Los datos solo están en este dispositivo.</div>`
        : !obtenerCliente() ? h`<div class="aviso-caja aviso">No se pudo cargar el cliente del servidor (sin cobertura al abrir la app). Se reintentará al recargar con red.</div>` : ''}
      <div class="tarjeta fila entre">
        <div><b>${cola.length}</b> operación(es) pendientes · ${navigator.onLine ? 'con conexión' : 'sin cobertura'}</div>
        <button class="btn btn-primario" id="s-ahora" ${!puede ? h`disabled` : ''}>Sincronizar ahora</button>
      </div>
      ${supabaseConfigurado() ? h`<p class="peq muted">Última descarga del Libro: ${ultima ? new Date(ultima).toLocaleString('es-ES') : 'ninguna'}. Solo se descarga lo que ha cambiado, por páginas, para gastar pocos datos.</p>` : ''}
      ${conf.length ? h`<div class="tarjeta" id="s-conflictos"><h2>Cambiado por dos personas a la vez (${conf.length})</h2>
        <p class="peq">Este dato se cambió aquí y, mientras tanto, otra persona lo cambió en el Libro central. Los demás cambios se han juntado solos; aquí tienes que elegir.</p>
        <ul class="lista">${conf.map((c, i) => h`<li class="item conflicto"><div class="item-principal">
          <div class="item-titulo">${c.enlace ? h`<a href="${c.enlace}">${c.que}</a>` : c.que} · ${c.nombre}</div>
          <div class="item-sub">En este móvil: <strong>${c.mioTexto}</strong> · En el Libro: <strong>${c.servidorTexto}</strong>${c.servidorFecha ? ` (cambiado el ${new Date(c.servidorFecha).toLocaleString('es-ES')})` : ''}</div>
          <div class="fila" style="margin-top:.35rem">
            <button class="btn btn-pequeno" data-conf="${i}" data-eleccion="servidor">Dejar «${c.servidorTexto}»</button>
            ${c.existe ? h`<button class="btn btn-pequeno" data-conf="${i}" data-eleccion="mio">Usar «${c.mioTexto}»</button>` : ''}
          </div></div></li>`)}</ul></div>` : ''}
      ${cola.length ? h`<div class="tarjeta"><ul class="lista">${cola.map(i => h`<li class="item"><div class="item-principal">
        <div class="item-titulo">${NOMBRES[i.tabla] || i.tabla} · ${i.op === 'delete' ? 'borrado' : (i.registro.anilla || i.registro.fecha || '')}</div>
        <div class="item-sub">${new Date(i.creado).toLocaleString('es-ES')}${i.intentos ? ` · ${i.intentos} intento(s)` : ''}</div>
        ${i.error ? h`<div class="peq" style="color:var(--rojo-t)">${i.error}</div>` : ''}</div></li>`)}</ul></div>`
        : h`<p class="muted">Todo está sincronizado.</p>`}
      ${supabaseConfigurado() ? h`<div class="tarjeta"><p class="peq">Si sospechas que falta algo en este móvil, puedes volver a descargar todo el Libro (gasta más datos).</p>
        <button class="btn" id="s-todo" ${!puede ? h`disabled` : ''}>Volver a descargar todo</button></div>` : ''}`);
    main.querySelectorAll('[data-conf]').forEach(b => b.addEventListener('click', async () => {
      const c = conf[Number(b.dataset.conf)];
      try {
        await datos.resolverConflicto(c, b.dataset.eleccion);
        aviso(b.dataset.eleccion === 'mio' ? `Se envía «${c.mioTexto}» al Libro.` : `Se queda «${c.servidorTexto}».`, 'ok');
      } catch (e) { aviso(e.message, 'error'); }
      dibujar();
    }));
    $('#s-ahora', main)?.addEventListener('click', async () => {
      const r = await sync.drenar();
      let bajadas = '';
      try { const d = await sync.descargar(uid); if (d) bajadas = ` · Recibidas: ${d.filas}${d.borradas ? ` · Borradas: ${d.borradas}` : ''}`; }
      catch (e) { aviso(`No se pudo descargar: ${e.message}`, 'error'); }
      if (!r.conflictos) aviso(r.omitido ? 'Inicia sesión con conexión para sincronizar.' : `Enviadas: ${r.ok} · Con error: ${r.fallidos}${bajadas}`, r.fallidos ? 'error' : 'ok');
      await datos.cargar();
      dibujar();
    });
    $('#s-todo', main)?.addEventListener('click', async () => {
      await sync.reiniciarMarcas(uid);
      try { const d = await sync.descargar(uid); aviso(d ? `Descargado de nuevo: ${d.filas} registros.` : 'Sin conexión con el servidor.', d ? 'ok' : 'error'); }
      catch (e) { aviso(`No se pudo descargar: ${e.message}`, 'error'); }
      await datos.cargar();
      dibujar();
    });
  };
  await dibujar();
  return sync.alCambiar(() => dibujar());
}
