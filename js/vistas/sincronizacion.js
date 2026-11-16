// Estado de la cola offline: qué falta por enviar y por qué ha fallado
import * as datos from '../datos.js';
import * as sync from '../sync.js';
import { supabaseConfigurado } from '../config.js';
import { obtenerCliente } from '../auth.js';
import { h, pintar, $, aviso } from '../ui.js';

const NOMBRES = { animales: 'Ejemplar', huevos: 'Huevo', calificaciones: 'Calificación', perfiles: 'Perfil' };

export default async function (main) {
  const dibujar = async () => {
    const cola = await sync.listarCola();
    pintar(main, h`
      <h1>Sincronización</h1>
      ${!supabaseConfigurado() ? h`<div class="aviso-caja aviso">Modo dispositivo: no hay servidor configurado. Los datos solo están en este dispositivo.</div>`
        : !obtenerCliente() ? h`<div class="aviso-caja aviso">No se pudo cargar el cliente del servidor (sin cobertura al abrir la app). Se reintentará al recargar con red.</div>` : ''}
      <div class="tarjeta fila entre">
        <div><b>${cola.length}</b> operación(es) pendientes · ${navigator.onLine ? 'con conexión' : 'sin cobertura'}</div>
        <button class="btn btn-primario" id="s-ahora" ${!navigator.onLine || !obtenerCliente() || !cola.length ? h`disabled` : ''}>Sincronizar ahora</button>
      </div>
      ${cola.length ? h`<div class="tarjeta"><ul class="lista">${cola.map(i => h`<li class="item"><div class="item-principal">
        <div class="item-titulo">${NOMBRES[i.tabla] || i.tabla} · ${i.op === 'delete' ? 'borrado' : (i.registro.anilla || i.registro.fecha || '')}</div>
        <div class="item-sub">${new Date(i.creado).toLocaleString('es-ES')}${i.intentos ? ` · ${i.intentos} intento(s)` : ''}</div>
        ${i.error ? h`<div class="peq" style="color:var(--rojo)">${i.error}</div>` : ''}</div></li>`)}</ul></div>`
        : h`<p class="muted">Todo está sincronizado.</p>`}`);
    $('#s-ahora', main)?.addEventListener('click', async () => {
      const r = await sync.drenar();
      aviso(r.omitido ? 'Inicia sesión con conexión para sincronizar.' : `Enviadas: ${r.ok} · Con error: ${r.fallidos}`, r.fallidos ? 'error' : 'ok');
      await datos.cargar();
      dibujar();
    });
  };
  await dibujar();
  return sync.alCambiar(() => dibujar());
}
