// Panel de inspección: lo pendiente (llamadas, visitas de hoy y de la semana, visitas
// sin cerrar) y, debajo, cada tarea del inspector a un toque. Inspector y administración.
import * as datos from '../datos.js';
import { buscarEjemplares } from '../buscar.js';
import { ESTANDAR, REGLAS } from '../estandar.js';
import { h, pintar, $, hoyISO } from '../ui.js';
import { desdeEmoji, ave } from '../iconos.js';
import { itemTarea } from './hoy.js';
import { recopilar } from './dossier.js';

const SECCIONES = [
  ['Visitas', [
    ['#/inspecciones', '📞', 'Solicitudes de inspección', 'Llamar al criador, programar la visita, cómo llegar y cerrarla']
  ]],
  ['Para calificar bien', [
    ['#/guia', '📋', 'Guía de campo', 'Las 12 regiones del baremo, con lo que se valora y los defectos de cada una'],
    ['#/estandar', '📖', 'Estándar oficial', 'Rasgos clave, variedades, defectos graves y el PDF']
  ]],
  ['Libro', [
    ['#/dossier', '📷', 'Dossier fotográfico', 'Fotos por variedad, sexo y edad para el Catálogo y FESACOCUR'],
    ['#/auditoria', '🩺', 'Auditoría del Libro', 'Errores y avisos por corregir'],
    ['#/informes', '📊', 'Informes del Libro', 'Censos, Ne, consanguinidad y exportaciones']
  ]]
];

const enlace = ([href, ico, titulo, sub]) => h`<li><a class="item tarea" href="${href}">
  <span class="tarea-ico" aria-hidden="true">${desdeEmoji(ico)}</span>
  <span class="item-principal"><span class="item-titulo">${titulo}</span><span class="item-sub">${sub}</span></span>
  <span aria-hidden="true">›</span></a></li>`;

// Casillas del dossier (variedad × sexo × edad) que aún no tienen foto
function huecosDossier() {
  const celdas = recopilar();
  let total = 0, vacias = 0;
  for (const v of ESTANDAR.variedades) for (const s of ['M', 'H']) for (const t of REGLAS.tramosEdadMeses) {
    total++;
    if (!(celdas.get(`${v.id}|${s}|${t.id}`) || []).length) vacias++;
  }
  return { total, vacias };
}

export default function (main) {
  let consulta = '';
  const dibujar = () => {
    const yo = datos.estado.perfil.id;
    const hoy = hoyISO();
    const tareas = datos.tareasInspector();
    const dossier = huecosDossier();
    if (dossier.vacias) tareas.push({ nivel: 'info', icono: '📷', texto: `Faltan fotos en ${dossier.vacias} de ${dossier.total} casillas del dossier`,
      sub: 'Al calificar, pide una foto de perfil si el ejemplar es bueno y su casilla está vacía', href: '#/dossier' });
    const abiertas = datos.solicitudesTodas().filter(datos.solicitudAbiertaEs).length;
    const semana = datos.solicitudesTodas().filter(s => s.estado === 'programada' && s.fecha_visita >= hoy && s.fecha_visita <= datos.sumaDias(hoy, 7)).length;
    const anio = hoy.slice(0, 4);
    const calificados = datos.estado.calificaciones.filter(c => c.inspector_id === yo && String(c.created_at).startsWith(anio)).length;
    const resultados = consulta.trim().length >= 2 ? buscarEjemplares(consulta).filter(a => a.estado !== 'baja').slice(0, 10) : [];
    pintar(main, h`
      <h1>Inspección</h1>
      <p class="muted" style="margin-top:-.5rem">Llamadas, visitas y calificaciones, en un solo sitio.</p>

      <div class="kpis">
        <div class="kpi"><b>${abiertas}</b><span>Solicitudes abiertas</span></div>
        <div class="kpi"><b>${semana}</b><span>Visitas en 7 días</span></div>
        <div class="kpi"><b>${calificados}</b><span>Calificados por ti en ${anio}</span></div>
        <div class="kpi"><b>${dossier.total - dossier.vacias}/${dossier.total}</b><span>Casillas del dossier</span></div>
      </div>

      <div class="tarjeta" id="in-pendiente">
        <h2>Qué hay que hacer</h2>
        ${tareas.length ? h`<ul class="lista">${tareas.map(itemTarea)}</ul>` : h`<p class="aviso-caja ok" style="margin:0">✓ Todo al día. No hay llamadas ni visitas pendientes.</p>`}
      </div>

      <div class="tarjeta">
        <h2>Calificar un ejemplar</h2>
        <p class="peq muted">Busca por anilla y abre directamente la hoja de calificación (baremo de 100 puntos).</p>
        <div class="campo"><label for="in-buscar">Anilla o nombre</label>
          <input id="in-buscar" inputmode="search" autocomplete="off" placeholder="Ej.: 000123" value="${consulta}"></div>
        ${resultados.length ? h`<ul class="lista" id="in-resultados">${resultados.map(a => h`<li><a class="item" href="#/calificar/${a.id}">
            ${ave(a)}<span class="item-principal"><span class="item-titulo">${a.anilla}${a.nombre ? ` · ${a.nombre}` : ''}</span>
            <span class="item-sub">${a.seccion} · ${datos.calificacionesDe(a.id).length ? `${datos.calificacionesDe(a.id).length} calificación(es)` : 'sin calificar'}</span></span>
            <span aria-hidden="true">Calificar ›</span></a></li>`)}</ul>`
          : consulta.trim().length >= 2 ? h`<p class="muted">Ningún ejemplar coincide.</p>` : ''}
      </div>

      ${SECCIONES.map(([titulo, items]) => h`<div class="tarjeta"><h2>${titulo}</h2><ul class="lista">${items.map(enlace)}</ul></div>`)}`);
    const input = $('#in-buscar', main);
    input.addEventListener('input', () => { consulta = input.value; const pos = input.selectionStart; dibujar(); const i = $('#in-buscar', main); i.focus(); i.setSelectionRange(pos, pos); });
  };
  dibujar();
  return datos.suscribir(dibujar);
}
