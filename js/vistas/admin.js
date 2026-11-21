// Panel de administración: lo pendiente arriba y, debajo, cada tarea del
// administrador a un toque. Solo para el rol «administrador».
import * as datos from '../datos.js';
import { supabaseConfigurado } from '../config.js';
import { h, pintar } from '../ui.js';
import { desdeEmoji } from '../iconos.js';
import { itemTarea } from './hoy.js';

// [grupo, [[enlace, emoji, título, explicación]]]
const SECCIONES = [
  ['Personas', [
    ['#/usuarios', '👥', 'Usuarios y roles', 'Altas nuevas, contacto de cada socio y quién es inspector o administrador'],
    ['#/mapa', '🗺️', 'Mapa de aviarios', 'Dónde está cada aviario y qué cría; cómo llegar y exportación para QGIS']
  ]],
  ['Libro Genealógico', [
    ['#/admin/expediente', '📄', 'Expediente para el Catálogo', 'Los 14 apartados que pide la CNZ: qué está cubierto, qué falta y qué le toca al Club'],
    ['#/admin/programa', '🧬', 'Programa de cría (borrador)', 'La propuesta de programa de cría con las reglas de la app y los resultados del Libro, para imprimir'],
    ['#/admin/libro', '⭐', 'Inscripciones del Libro', 'Registro de Méritos, fundadores (RF y RA) y cambios de titular'],
    ['#/auditoria', '🩺', 'Auditoría del Libro', 'Errores y avisos por corregir, y pureza de variedad'],
    ['#/acta', '📄', 'Acta anual de cierre censal', 'Balance del año para imprimir y firmar'],
    ['#/informes', '📊', 'Informes y exportaciones', 'Censos, Ne, consanguinidad y archivos CSV']
  ]],
  ['Inspección', [
    ['#/inspector', '🩺', 'Panel de inspección', 'Llamadas, visitas de la semana y calificar por anilla'],
    ['#/inspecciones', '📞', 'Solicitudes de inspección', 'Llamar, programar la visita y calificar'],
    ['#/dossier', '📷', 'Dossier fotográfico', 'Fotos por variedad, sexo y edad para el Catálogo y FESACOCUR']
  ]],
  ['Datos y seguridad', [
    ['#/admin/historial', '⏳', 'Historial de cambios', 'Quién dio de alta, cambió, borró o calificó cada ejemplar, y cuándo'],
    ['#/copia', '💾', 'Copia completa del Libro', 'Baja todo del servidor y lo guarda en un archivo, para el archivo del Club'],
    ['#/usuarios', '🗑', 'Baja de un socio (RGPD)', 'Abre su ficha en Usuarios y pulsa «Dar de baja»: se borran sus datos y se conserva el Libro']
  ]],
  ['Servidor y cuentas', [
    ['#/admin/supabase', '🔒', 'Tareas en el panel de Supabase', 'Contraseñas, bajas, correo de la app, proyecto en pausa: enlace directo y pasos exactos']
  ]]
];

const enlace = ([href, ico, titulo, sub]) => h`<li><a class="item tarea" href="${href}">
  <span class="tarea-ico" aria-hidden="true">${desdeEmoji(ico)}</span>
  <span class="item-principal"><span class="item-titulo">${titulo}</span><span class="item-sub">${sub}</span></span>
  <span aria-hidden="true">›</span></a></li>`;

export default function (main) {
  const dibujar = () => {
    const tareas = datos.tareasAdmin();
    const urgentes = tareas.filter(x => x.nivel !== 'info');
    const usuarios = datos.estado.perfiles.length;
    const activos = datos.estado.todos.filter(a => a.estado !== 'baja').length;
    const abiertas = datos.solicitudesTodas().filter(datos.solicitudAbiertaEs).length;
    pintar(main, h`
      <h1>Administración</h1>
      <p class="muted" style="margin-top:-.5rem">Todo lo que lleva el administrador del Libro, en un solo sitio.</p>
      ${supabaseConfigurado() ? '' : h`<div class="aviso-caja aviso peq">Modo dispositivo: sin servidor solo ves los datos de este teléfono.</div>`}

      <div class="kpis">
        <div class="kpi"><b>${usuarios}</b><span>Usuarios</span></div>
        <div class="kpi"><b>${activos}</b><span>Ejemplares en el Libro</span></div>
        <div class="kpi"><b>${abiertas}</b><span>Inspecciones abiertas</span></div>
        <div class="kpi"><b>${urgentes.length}</b><span>Tareas pendientes</span></div>
      </div>

      <div class="tarjeta" id="admin-pendiente">
        <h2>Qué hay que hacer</h2>
        ${tareas.length ? h`<ul class="lista">${tareas.map(itemTarea)}</ul>` : h`<p class="aviso-caja ok" style="margin:0">✓ Todo al día. No hay nada pendiente.</p>`}
      </div>

      ${SECCIONES.map(([titulo, items]) => h`<div class="tarjeta"><h2>${titulo}</h2><ul class="lista">${items.map(enlace)}</ul></div>`)}`);
  };
  dibujar();
  return datos.suscribir(dibujar);
}
