// Herramientas: lo que no cabe en la barra, mostrado según el rol
import * as datos from '../datos.js';
import { ROLES, esAuditor } from '../auth.js';
import { CONFIG, supabaseConfigurado } from '../config.js';
import { cerrarSesion } from '../app.js';
import { h, pintar, $, confirmar, aviso } from '../ui.js';
import * as instalacion from '../instalacion.js';
import * as tema from '../tema.js';
import { desdeEmoji } from '../iconos.js';

export default function (main) {
  const p = datos.estado.perfil;
  const r = p.rol;
  const grupos = [
    ['Mi cuenta', [
      ['#/perfil', '🏡', 'Mi aviario', 'Nombre, REGA, municipio y ubicación que heredan las altas'],
      ['#/copia', '💾', 'Copia de seguridad', supabaseConfigurado() ? 'Descargar o restaurar tus datos' : 'Imprescindible: tus datos solo están en este dispositivo'],
      ['#/privacidad', '🔒', 'Privacidad y tus datos', 'Qué datos usa la app, para qué, y cómo descargarlos o pedir la baja'],
      ['#/problema', '🐞', 'Informar de un problema', 'Cuenta qué ha pasado y envíalo por WhatsApp o correo'],
      ['#/sincronizacion', '☁️', 'Sincronización', supabaseConfigurado() ? `${datos.estado.pendientes} operación(es) pendientes` : 'Modo dispositivo: datos solo en este equipo']
    ]],
    ['Cría', [
      ['#/hoy', '📅', 'Hoy', 'Qué toca hacer hoy y esta semana, y los primeros pasos'],
      ['#/inspeccion', '🔎', 'Solicitar inspección', (() => { const s = datos.solicitudAbierta(); if (s) return s.estado === 'programada' ? `Visita el ${s.fecha_visita.split('-').reverse().join('/')}` : 'Solicitud enviada: pendiente de llamada'; const n = datos.porCalificar(p.id).filter(x => x.listo).length; return n ? `${n} ejemplar(es) con un año listos para calificar` : 'Calificación por un inspector del Club: la llave del Registro Definitivo'; })()],
      ['#/programa', '🧭', 'Guía del criador', 'Qué hacer y cuándo: Libro, anillas, calificación, familias, puesta'],
      ['#/campanas', '🥚', 'Control de puesta', 'Campañas de 15 días y resultados por gallina'],
      ['#/reproduccion', '🐣', 'Reproducción e incubación', 'Lotes gallo + gallinas, incubadora y alta de pollitos con sus padres'],
      ['#/apareamientos', '💞', 'Apareamientos', 'Rotación de Gobe y consanguinidad esperada'],
      ['#/auditoria', '🩺', esAuditor(r) ? 'Auditoría del Libro' : 'Revisar mi censo', 'Incoherencias por corregir y pureza de variedad'],
      ['#/acta', '📄', esAuditor(r) ? 'Acta anual de cierre censal' : 'Resumen anual de mi aviario', 'Balance del año para imprimir y firmar: censo, movimientos, Ne, reproducción y puesta'],
      ['#/informes', '📊', esAuditor(r) ? 'Informes del Libro' : 'Informe de mi censo', 'Censo por sexo y edad, Ne, consanguinidad y exportaciones']
    ]],
    ['Consulta', [
      ['#/estandar', '📖', 'Estándar Racial', 'Texto oficial ESGA025'],
      ['#/guia', '📋', 'Guía de Campo', 'Las 12 regiones y los defectos graves']
    ]]
  ];
  if (r === 'inspector') grupos.unshift(['Inspección', [['#/inspector', '🩺', 'Panel de inspección', (() => { const n = datos.tareasInspector().filter(x => x.nivel !== 'info').length; return n ? `${n} tarea(s) pendiente(s): llamadas, visitas y calificaciones` : 'Todo al día · llamadas, visitas y calificaciones'; })()]]]);
  else if (esAuditor(r)) grupos.splice(1, 0, ['Inspección', [['#/inspecciones', '📞', 'Solicitudes de inspección', (() => { const n = datos.solicitudesTodas().filter(datos.solicitudAbiertaEs).length; return n ? `${n} abierta(s): llamar, programar y calificar` : 'No hay solicitudes abiertas'; })()], ['#/censo', '✅', 'Calificar ejemplares', 'Abre un ejemplar del censo y pulsa «Calificar»'], ['#/dossier', '📷', 'Dossier fotográfico', 'Fotos por variedad, sexo y edad para el Catálogo y FESACOCUR']]]);
  if (r === 'administrador') grupos.unshift(['Administración', [['#/admin', '🛡️', 'Panel de administración', (() => { const n = datos.tareasAdmin().filter(x => x.nivel !== 'info').length; return n ? `${n} tarea(s) pendiente(s): usuarios, Libro, inspecciones y servidor` : 'Todo al día · usuarios, Libro, inspecciones y servidor'; })()]]]);

  pintar(main, h`
    <h1>Herramientas</h1>
    <div class="tarjeta fila entre">
      <div><strong>${p.nombre || p.email}</strong><div class="muted peq">${ROLES[r]} · ${p.email || ''}</div></div>
      <button class="btn" id="b-salir">Cerrar sesión</button>
    </div>
    <div class="tarjeta" id="h-movil"></div>
    <div class="tarjeta"><h2 id="h-pantalla-et">Pantalla</h2>
      <div class="opciones" role="radiogroup" aria-labelledby="h-pantalla-et">${Object.entries(tema.TEMAS).map(([k, v]) => h`<label><input type="radio" name="h-tema" value="${k}" ${tema.actual() === k ? h`checked` : ''}><span>${v}</span></label>`)}</div>
      <p class="ayuda">«Sol»: máximo contraste y letra más grande, para leer al aire libre. Se guarda en este dispositivo.</p></div>
    ${grupos.map(([titulo, items]) => h`<div class="tarjeta${titulo === 'Administración' || (titulo === 'Inspección' && r === 'inspector') ? ' solo-estrecho' : ''}"><h2>${titulo}</h2><ul class="lista">
      ${items.map(([href, ico, t, sub]) => h`<li><a class="item" href="${href}"><span class="tarea-ico" aria-hidden="true">${desdeEmoji(ico)}</span>
        <span class="item-principal"><span class="item-titulo">${t}</span><span class="item-sub">${sub}</span></span><span aria-hidden="true">›</span></a></li>`)}
    </ul></div>`)}
    <p class="muted peq">AlacantinApp ${CONFIG.version} · ${supabaseConfigurado() ? 'Conectada al Libro central' : 'Modo dispositivo (sin servidor)'}</p>`);

  // La app en este móvil: instalación y conservación de los datos
  const pintarMovil = async () => {
    const caja = $('#h-movil', main);
    if (!caja) return;
    const a = await instalacion.estadoAlmacen();
    const fotos = await (async () => { try { return (await (await caches.open('alacantinapp-fotos')).keys()).length; } catch { return 0; } })();
    const inst = instalacion.instalada();
    pintar(caja, h`<h2 id="instalar">La app en este dispositivo</h2>
      <p>${inst ? '✓ Instalada: se abre desde su icono, a pantalla completa y sin conexión.' : 'Aún no está instalada.'}
        ${a.persistente === true ? h`<br>✓ Datos protegidos: el navegador no los borrará para liberar espacio.` : a.persistente === false ? h`<br><strong>Datos sin proteger:</strong> el navegador podría borrarlos si le falta espacio.` : ''}
        ${a.usoMB != null ? h`<br><span class="peq muted">Espacio usado: ${a.usoMB < 1 ? '< 1' : Math.round(a.usoMB)} MB${a.cuotaMB ? ` de ${Math.round(a.cuotaMB / 1024 * 10) / 10} GB disponibles` : ''} (las fotos son lo que más ocupa).</span>` : ''}</p>
      ${!inst && instalacion.puedeInstalar() ? h`<button class="btn btn-primario" id="h-instalar">📲 Instalar AlacantinApp</button>` : ''}
      ${!inst && instalacion.esIOS() ? h`<div class="aviso-caja aviso peq"><strong>En iPhone, instálala:</strong> si no, Safari borra los datos de la web tras 7 días sin abrirla.
        <ol class="pasos" style="margin:.4rem 0 0"><li>Ábrela en <strong>Safari</strong>.</li><li>Pulsa <strong>Compartir</strong> (el cuadrado con la flecha hacia arriba).</li><li>Elige <strong>«Añadir a pantalla de inicio»</strong> y luego «Añadir».</li></ol></div>`
        : !inst && !instalacion.puedeInstalar() ? h`<p class="peq muted">Para instalarla, abre el menú del navegador (⋮) y elige «Instalar aplicación» o «Añadir a pantalla de inicio».</p>` : ''}
      ${a.persistente === false && inst ? h`<button class="btn" id="h-proteger">Proteger los datos</button>` : ''}
      ${fotos ? h`<p class="peq muted" style="margin-top:.5rem">Fotos guardadas para verlas sin cobertura: ${fotos}. <button class="enlace" type="button" id="h-fotos">Borrarlas para liberar espacio</button></p>` : ''}`);
    $('#h-fotos', caja)?.addEventListener('click', async () => { await caches.delete('alacantinapp-fotos'); aviso('Fotos guardadas borradas. Se volverán a guardar al verlas con cobertura.', 'ok'); pintarMovil(); });
    $('#h-instalar', caja)?.addEventListener('click', async () => { if (await instalacion.instalar()) aviso('App instalada. Ábrela desde su icono.', 'ok'); });
    $('#h-proteger', caja)?.addEventListener('click', async () => { const ok = await instalacion.pedirPersistencia(); aviso(ok ? 'Datos protegidos.' : 'El navegador no lo ha permitido. Instala la app y vuelve a probar.', ok ? 'ok' : 'error'); pintarMovil(); });
  };
  main.querySelectorAll('input[name=h-tema]').forEach(r => r.addEventListener('change', () => tema.aplicar(r.value)));
  pintarMovil();
  // El resumen de la auditoría se calcula después de pintar: la pantalla abre al instante
  const tAud = setTimeout(() => {
    const sub = main.querySelector('a[href="#/auditoria"] .item-sub');
    if (!sub) return;
    const x = datos.auditarLibro(); const e = x.filter(y => y.nivel === 'error').length;
    sub.textContent = x.length ? `${e} error(es) y ${x.length - e} aviso(s) · pureza de variedad` : 'Sin incoherencias · pureza de variedad';
  }, 60);
  const quitar = instalacion.alCambiar(pintarMovil);

  $('#b-salir', main).addEventListener('click', async () => {
    const pend = datos.estado.pendientes;
    if (pend && !(await confirmar('Cerrar sesión', `Hay ${pend} operación(es) sin sincronizar. Se conservarán en este dispositivo y se enviarán cuando vuelvas a entrar.`, 'Cerrar sesión'))) return;
    await cerrarSesion();
  });
  return () => { clearTimeout(tAud); quitar(); };
}
