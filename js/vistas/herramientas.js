// Herramientas: lo que no cabe en la barra, mostrado según el rol
import * as datos from '../datos.js';
import { ROLES, esAuditor } from '../auth.js';
import { CONFIG, supabaseConfigurado } from '../config.js';
import { cerrarSesion } from '../app.js';
import { h, pintar, $, confirmar } from '../ui.js';

export default function (main) {
  const p = datos.estado.perfil;
  const r = p.rol;
  const grupos = [
    ['Mi cuenta', [
      ['#/perfil', '🏡', 'Mi aviario', 'Nombre, REGA, municipio y ubicación que heredan las altas'],
      ['#/copia', '💾', 'Copia de seguridad', supabaseConfigurado() ? 'Descargar o restaurar tus datos' : 'Imprescindible: tus datos solo están en este dispositivo'],
      ['#/sincronizacion', '☁️', 'Sincronización', supabaseConfigurado() ? `${datos.estado.pendientes} operación(es) pendientes` : 'Modo dispositivo: datos solo en este equipo']
    ]],
    ['Cría', [
      ['#/inspeccion', '🔎', 'Solicitar inspección', (() => { const s = datos.solicitudAbierta(); if (s) return s.estado === 'programada' ? `Visita el ${s.fecha_visita.split('-').reverse().join('/')}` : 'Solicitud enviada: pendiente de llamada'; const n = datos.porCalificar(p.id).filter(x => x.listo).length; return n ? `${n} ejemplar(es) con un año listos para calificar` : 'Calificación por un inspector del Club: la llave del Registro Definitivo'; })()],
      ['#/programa', '🧭', 'Guía del criador', 'Qué hacer y cuándo: Libro, anillas, calificación, familias, puesta'],
      ['#/campanas', '🥚', 'Control de puesta', 'Campañas de 15 días y resultados por gallina'],
      ['#/reproduccion', '🐣', 'Reproducción e incubación', 'Lotes gallo + gallinas, incubadora y alta de pollitos con sus padres'],
      ['#/apareamientos', '💞', 'Apareamientos', 'Rotación de Gobe y consanguinidad esperada'],
      ['#/auditoria', '🩺', esAuditor(r) ? 'Auditoría del Libro' : 'Revisar mi censo', (() => { const x = datos.auditarLibro(); const e = x.filter(y => y.nivel === 'error').length; return x.length ? `${e} error(es) y ${x.length - e} aviso(s) · pureza de variedad` : 'Sin incoherencias · pureza de variedad'; })()],
      ['#/informes', '📊', esAuditor(r) ? 'Informes del Libro' : 'Informe de mi censo', 'Censo por sexo y edad, Ne, consanguinidad y exportaciones']
    ]],
    ['Consulta', [
      ['#/estandar', '📖', 'Estándar Racial', 'Texto oficial ESGA025'],
      ['#/guia', '📋', 'Guía de Campo', 'Las 12 regiones y los defectos graves']
    ]]
  ];
  if (esAuditor(r)) grupos.splice(1, 0, ['Inspección', [['#/inspecciones', '📞', 'Solicitudes de inspección', (() => { const n = datos.solicitudesTodas().filter(datos.solicitudAbiertaEs).length; return n ? `${n} abierta(s): llamar, programar y calificar` : 'No hay solicitudes abiertas'; })()], ['#/censo', '✅', 'Calificar ejemplares', 'Abre un ejemplar del censo y pulsa «Calificar»'], ['#/dossier', '📷', 'Dossier fotográfico', 'Fotos por variedad, sexo y edad para el Catálogo y FESACOCUR']]]);
  if (r === 'administrador') grupos.push(['Administración', [['#/usuarios', '🛡️', 'Usuarios y roles', 'Asignar inspectores y administradores']]]);

  pintar(main, h`
    <h1>Herramientas</h1>
    <div class="tarjeta fila entre">
      <div><strong>${p.nombre || p.email}</strong><div class="muted peq">${ROLES[r]} · ${p.email || ''}</div></div>
      <button class="btn" id="b-salir">Cerrar sesión</button>
    </div>
    ${grupos.map(([titulo, items]) => h`<div class="tarjeta"><h2>${titulo}</h2><ul class="lista">
      ${items.map(([href, ico, t, sub]) => h`<li><a class="item" href="${href}"><span style="font-size:1.4rem" aria-hidden="true">${ico}</span>
        <span class="item-principal"><span class="item-titulo">${t}</span><span class="item-sub">${sub}</span></span><span aria-hidden="true">›</span></a></li>`)}
    </ul></div>`)}
    <p class="muted peq">AlacantinApp ${CONFIG.version} · ${supabaseConfigurado() ? 'Conectada al Libro central' : 'Modo dispositivo (sin servidor)'}</p>`);

  $('#b-salir', main).addEventListener('click', async () => {
    const pend = datos.estado.pendientes;
    if (pend && !(await confirmar('Cerrar sesión', `Hay ${pend} operación(es) sin sincronizar. Se conservarán en este dispositivo y se enviarán cuando vuelvas a entrar.`, 'Cerrar sesión'))) return;
    await cerrarSesion();
  });
}
