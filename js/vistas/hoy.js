// «Hoy»: qué toca hacer hoy y en los próximos días, lo propio del mes y los primeros pasos.
import * as datos from '../datos.js';
import * as db from '../db.js';
import * as instalacion from '../instalacion.js';
import { ultimaCopia } from '../respaldo.js';
import { supabaseConfigurado } from '../config.js';
import { h, pintar, $, hoyISO } from '../ui.js';
import { desdeEmoji } from '../iconos.js';

const GRUPOS = [['hoy', 'Para hoy'], ['pronto', 'Próximos días'], ['info', 'Para tener en cuenta']];

export const fechaLarga = (iso = hoyISO()) => { const t = new Date(`${iso}T12:00:00`).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }); return t.charAt(0).toUpperCase() + t.slice(1); };

// Estado de los primeros pasos (lo asíncrono: instalación, copia y guía leída)
export async function estadoPasos() {
  const p = datos.estado.perfil;
  const [copia, guia, ocultos] = await Promise.all([ultimaCopia().catch(() => null), db.metaGet(`guia:${p.id}`, false), db.metaGet(`pasos-ocultos:${p.id}`, false)]);
  const pasos = datos.primerosPasos({ instalada: instalacion.instalada(), copiaHecha: Boolean(copia), guiaVista: guia, conServidor: supabaseConfigurado() });
  return { pasos, hechos: pasos.filter(x => x.hecho).length, ocultos: ocultos || pasos.every(x => x.hecho) };
}

export const itemTarea = (x) => h`<li><a class="item tarea tarea-${x.nivel}" href="${x.href}">
  <span class="tarea-ico" aria-hidden="true">${desdeEmoji(x.icono)}</span>
  <span class="item-principal"><span class="item-titulo">${x.texto}</span>${x.sub ? h`<span class="item-sub">${x.sub}</span>` : ''}</span>
  <span aria-hidden="true">›</span></a></li>`;

export const tarjetaPasos = (e) => h`<div class="tarjeta" id="primeros-pasos"><div class="fila entre"><h2>Primeros pasos</h2><span class="chip chip-info">${e.hechos} de ${e.pasos.length}</span></div>
  <div class="progreso"><span style="width:${Math.round(100 * e.hechos / e.pasos.length)}%"></span></div>
  <ol class="lista-pasos">${e.pasos.map(x => h`<li class="${x.hecho ? 'hecho' : ''}"><a href="${x.href}">${x.hecho ? '✓ ' : ''}${x.texto}</a></li>`)}</ol>
  <button class="enlace peq" type="button" id="pasos-ocultar">Ocultar esta lista</button></div>`;

export default function (main) {
  const p = datos.estado.perfil;
  const dibujar = async () => {
    const tareas = datos.agendaHoy();
    const pasos = await estadoPasos();
    const [ico, texto, href] = datos.TAREAS_DEL_MES[new Date().getMonth() + 1];
    pintar(main, h`
      <h1>Hoy</h1>
      <p class="muted" style="margin-top:-.5rem">${fechaLarga()}</p>
      ${pasos.ocultos ? '' : tarjetaPasos(pasos)}
      ${GRUPOS.map(([nivel, titulo]) => { const l = tareas.filter(x => x.nivel === nivel); return l.length ? h`<div class="tarjeta"><h2>${titulo}</h2><ul class="lista">${l.map(itemTarea)}</ul></div>` : ''; })}
      ${!tareas.some(x => x.nivel !== 'info') ? h`<div class="aviso-caja ok">✓ Nada urgente para hoy.</div>` : ''}
      <div class="tarjeta"><h2>Este mes</h2><a class="item tarea" href="${href}"><span class="tarea-ico" aria-hidden="true">${desdeEmoji(ico)}</span><span class="item-principal"><span class="item-titulo">${texto}</span></span><span aria-hidden="true">›</span></a>
        <p class="peq muted" style="margin:.5rem 0 0">Calendario completo en la <a href="#/programa?s=calendario">Guía del criador</a>.</p></div>`);
    $('#pasos-ocultar', main)?.addEventListener('click', async () => { await db.metaSet(`pasos-ocultos:${p.id}`, true); dibujar(); });
  };
  dibujar();
  return datos.suscribir(() => dibujar());
}
