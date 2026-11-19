// Censo: "Mi censo" (criador), censo completo (inspector/administrador) o censo público (visitante)
import * as datos from '../datos.js';
import { esAuditor } from '../auth.js';
import { ESTANDAR, nombreVariedad, tramoEdad } from '../estandar.js';
import { nivelFx } from '../genetica.js';
import { h, pintar, $, pct } from '../ui.js';
import { copiaPendiente } from '../respaldo.js';
import * as instalacion from '../instalacion.js';
import { estadoPasos, itemTarea, fechaLarga } from './hoy.js';
import { desdeEmoji, icono, ave } from '../iconos.js';
import { supabaseConfigurado } from '../config.js';

const normal = (s) => String(s || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
const filtros = { q: '', sexo: '', variedad: '', seccion: '', bajas: false };

export default function (main) {
  const p = datos.estado.perfil;
  const limpiar = [];
  const titulo = !p ? 'Censo público' : esAuditor(p.rol) ? 'Censo del Libro' : 'Mi censo';

  pintar(main, h`
    <div class="fila entre"><h1>${titulo}</h1>
      ${p ? h`<a class="btn btn-primario btn-pequeno" href="#/alta">${icono('alta')} Alta</a>` : ''}</div>
    ${!p ? h`<p class="muted">Ejemplares inscritos en el Libro Genealógico. No se muestran datos personales de los criadores.</p>` : ''}
    ${p?.rol === 'aspirante' ? h`<div class="aviso-caja aviso">Cuenta de aspirante: añade tu código REGA en <a href="#/perfil">Mi aviario</a> para pasar a Criador.</div>` : ''}
    <div id="censo-riesgo"></div>
    <div id="censo-copia"></div>
    ${p ? h`<div id="censo-hoy"></div>` : ''}
    <div id="censo-kpis" class="kpis"></div>
    <div class="tarjeta">
      <label for="f-q">Buscar</label><input id="f-q" type="search" placeholder="Anilla o nombre" value="${filtros.q}">
      <details style="margin-top:.6rem" ${filtros.sexo || filtros.variedad || filtros.seccion || filtros.bajas ? h`open` : ''}><summary class="muted">Filtros</summary>
      <div class="rejilla rejilla-3" style="margin-top:.5rem">
        <div><label for="f-sexo">Sexo</label><select id="f-sexo">
          <option value="">Todos</option><option value="M">Gallos</option><option value="H">Gallinas</option></select></div>
        <div><label for="f-var">Variedad</label><select id="f-var"><option value="">Todas</option>
          ${ESTANDAR.variedades.map(v => h`<option value="${v.id}">${v.nombre}</option>`)}</select></div>
        <div><label for="f-sec">Sección</label><select id="f-sec"><option value="">Todas</option>
          ${Object.entries(ESTANDAR.secciones).map(([k, v]) => h`<option value="${k}">${k} · ${v}</option>`)}</select></div>
        ${p ? h`<label class="fila" style="align-self:end"><input id="f-bajas" type="checkbox"> Incluir bajas</label>` : ''}
      </div></details>
    </div>
    <div class="tarjeta"><ul id="censo-lista" class="lista"></ul></div>`);

  // Recordatorio de copia de seguridad (sobre todo en modo dispositivo)
  if (p) {
    const propios = datos.estado.todos.filter(a => a.usuario_id === p.id).length;
    // «Hoy» resumido: lo urgente y lo próximo, y los primeros pasos si faltan. Se calcula
    // después de pintar la lista para que el censo abra al instante.
    const tHoy = setTimeout(async () => {
      const caja = $('#censo-hoy', main);
      if (!caja) return;
      const tareas = datos.agendaHoy().filter(x => x.nivel !== 'info');
      const pasos = await estadoPasos();
      if (!tareas.length && pasos.ocultos) { pintar(caja, ''); return; }
      pintar(caja, h`<div class="tarjeta tarjeta-hoy"><div class="fila entre"><h2 style="margin:0">Hoy <span class="muted peq" style="font-weight:500">· ${fechaLarga()}</span></h2>
          <a class="peq" href="#/hoy">Ver todo ›</a></div>
        ${tareas.length ? h`<ul class="lista">${tareas.slice(0, 3).map(itemTarea)}</ul>${tareas.length > 3 ? h`<p class="peq" style="margin:.25rem 0 0"><a href="#/hoy">y ${tareas.length - 3} más →</a></p>` : ''}` : ''}
        ${pasos.ocultos ? '' : h`<a class="item tarea" href="#/hoy"><span class="tarea-ico" aria-hidden="true">${desdeEmoji('🚀')}</span><span class="item-principal"><span class="item-titulo">Primeros pasos: ${pasos.hechos} de ${pasos.pasos.length}</span><span class="item-sub">${pasos.pasos.find(x => !x.hecho)?.texto || ''}</span></span><span aria-hidden="true">›</span></a>`}
      </div>`);
    }, 0);
    limpiar.push(() => clearTimeout(tHoy));
    instalacion.riesgo().then(r => {
      const caja = $('#censo-riesgo', main);
      if (!r || !caja) return;
      pintar(caja, h`<a class="aviso-caja aviso peq" href="#/herramientas" style="display:block;text-decoration:none">⚠️ ${r === 'ios'
        ? 'En iPhone, si no instalas la app, Safari puede borrar tus datos tras 7 días sin abrirla.'
        : 'El navegador podría borrar los datos de este móvil si le falta espacio.'} <strong>Ver cómo evitarlo →</strong></a>`);
    });
    copiaPendiente(p, propios).then(r => {
      const caja = $('#censo-copia', main);
      if (!r || !caja) return;
      pintar(caja, h`<a class="aviso-caja ${supabaseConfigurado() ? 'info' : 'aviso'} peq" href="#/copia" style="display:block;text-decoration:none">💾 ${r.dias === null ? 'Aún no has hecho ninguna copia de seguridad' : `Tu última copia de seguridad es de hace ${r.dias} días`}${supabaseConfigurado() ? '' : ': tus datos solo están en este dispositivo'}. <strong>Hacer copia →</strong></a>`);
    });
  }
  for (const [id, k] of [['#f-sexo', 'sexo'], ['#f-var', 'variedad'], ['#f-sec', 'seccion']]) $(id, main).value = filtros[k];
  if ($('#f-bajas', main)) $('#f-bajas', main).checked = filtros.bajas;

  const PAGINA = 60;
  let mostrar = PAGINA;   // se pintan por tandas: con cientos de aves, la lista abre al instante
  const dibujar = () => {
    const todos = datos.censo({ incluirBajas: filtros.bajas });
    const q = normal(filtros.q);
    const lista = todos.filter(a => (!q || normal(`${a.anilla} ${a.nombre}`).includes(q)) &&
      (!filtros.sexo || a.sexo === filtros.sexo) && (!filtros.variedad || a.variedad === filtros.variedad) &&
      (!filtros.seccion || a.seccion === filtros.seccion));
    const activos = todos.filter(a => a.estado !== 'baja');
    pintar($('#censo-kpis', main), h`
      <div class="kpi"><b>${activos.length}</b><span>Ejemplares activos</span></div>
      <div class="kpi"><b>${activos.filter(a => a.sexo === 'M').length}</b><span>Gallos</span></div>
      <div class="kpi"><b>${activos.filter(a => a.sexo === 'H').length}</b><span>Gallinas</span></div>
      <div class="kpi"><b>${activos.filter(a => ['RD', 'RM'].includes(a.seccion)).length}</b><span>Definitivo + Méritos</span></div>`);
    pintar($('#censo-lista', main), lista.length === 0
      ? h`<li class="muted" style="padding:1rem 0">${todos.length === 0
        ? (p ? h`Aún no hay ejemplares. Empieza con <a href="#/alta">Alta Rápida</a>.` : h`Todavía no hay ejemplares publicados. Aquí aparecerán las Alacantinas inscritas por los criadores del Club, con su anilla, variedad, sección del Libro y genealogía, sin datos personales. ¿Crías Alacantinas? <a href="#/programa">Mira cómo inscribirlas</a>.`)
        : 'Ningún ejemplar coincide con los filtros.'}</li>`
      : h`${lista.slice(0, mostrar).map(a => {
        const f = datos.fx(datos.animal(a.id) || a);
        const nf = nivelFx(f);
        const t = tramoEdad(a.fecha_nacimiento);
        return h`<li><a class="item" href="#/animal/${encodeURIComponent(a.id)}">
          ${ave(a)}
          <span class="item-principal">
            <span class="item-titulo">${a.anilla}${a.nombre ? h` · ${a.nombre}` : ''}</span>
            <span class="item-sub">${nombreVariedad(a.variedad)} · ${t ? t.nombre : 'Edad desconocida'}</span>
          </span>
          <span class="fila" style="flex-direction:column;align-items:flex-end;gap:.2rem">
            <span class="chip ${['RD', 'RM'].includes(a.seccion) ? 'chip-ok' : 'chip-info'}">${a.seccion === 'RM' ? '★ ' : ''}${a.seccion}</span>
            ${a.estado === 'baja' ? h`<span class="chip chip-alerta">Baja</span>` :
              (f > 0 ? h`<span class="chip ${nf.nivel === 'alerta' ? 'chip-alerta' : nf.nivel === 'precaucion' ? 'chip-aviso' : ''}">Fx ${pct(f, 1)}</span>` : '')}
          </span></a></li>`;
      })}${lista.length > mostrar ? h`<li style="padding:.75rem 0"><button class="btn btn-bloque" id="censo-mas" type="button">Ver más (${lista.length - mostrar} restantes)</button></li>` : ''}`);
    $('#censo-mas', main)?.addEventListener('click', () => { mostrar += PAGINA * 2; dibujar(); });
  };
  const filtrar = (fn) => (e) => { fn(e); mostrar = PAGINA; dibujar(); };

  $('#f-q', main).addEventListener('input', filtrar(e => { filtros.q = e.target.value; }));
  $('#f-sexo', main).addEventListener('change', filtrar(e => { filtros.sexo = e.target.value; }));
  $('#f-var', main).addEventListener('change', filtrar(e => { filtros.variedad = e.target.value; }));
  $('#f-sec', main).addEventListener('change', filtrar(e => { filtros.seccion = e.target.value; }));
  $('#f-bajas', main)?.addEventListener('change', filtrar(e => { filtros.bajas = e.target.checked; }));
  dibujar();
  const quitar = datos.suscribir(dibujar);
  return () => { quitar(); limpiar.forEach(fn => fn()); };
}
