// Historial de cambios del Libro: quién dio de alta, cambió, borró o calificó
// cada ejemplar, y cuándo. Lo escribe el servidor; aquí solo se consulta (en línea).
import * as datos from '../datos.js';
import { supabaseConfigurado } from '../config.js';
import { h, pintar, $ } from '../ui.js';

const FILTROS = [['', 'Todo'], ['animales', 'Ejemplares'], ['calificaciones', 'Calificaciones'], ['germoplasma', 'Material genético']];
const ACCION = { INSERT: 'Alta', UPDATE: 'Cambio', DELETE: 'Borrado' };
const dia = (iso) => new Date(iso).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const hora = (iso) => new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

// Valor legible de un campo: los identificadores se traducen a anilla o a nombre
function valor(k, v) {
  if (v == null || v === '') return '—';
  if (k === 'padre_id' || k === 'madre_id') return datos.animal(v)?.anilla || 'otro ejemplar';
  if (k === 'usuario_id' || k === 'criador_id') return datos.estado.perfiles.find(p => p.id === v)?.nombre || 'usuario dado de baja';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

function detalle(e) {
  if (e.operacion !== 'UPDATE' || !e.antes || !e.despues) return '';
  const claves = Object.keys({ ...e.antes, ...e.despues })
    .filter(k => !['updated_at', 'sync_ts', 'created_at', 'fotos', 'fotos_fecha'].includes(k) && JSON.stringify(e.antes[k] ?? null) !== JSON.stringify(e.despues[k] ?? null));
  if (!claves.length) return '';
  return h`<details class="peq"><summary>Ver el cambio</summary><dl class="datos-usuario">${claves.map(k => h`
    <dt>${k.replace(/_/g, ' ')}</dt><dd><s>${valor(k, e.antes[k])}</s> → ${valor(k, e.despues[k])}</dd>`)}</dl></details>`;
}

export default function (main) {
  let filtro = '';
  let filas = [];
  let pagina = 0;
  let hayMas = false;
  let error = '';
  let cargando = false;

  const dibujar = () => {
    const sinServidor = !supabaseConfigurado();
    const porDia = [];
    for (const e of filas) {
      const d = e.fecha.slice(0, 10);
      if (porDia.at(-1)?.d !== d) porDia.push({ d, items: [] });
      porDia.at(-1).items.push(e);
    }
    pintar(main, h`
      <p class="peq"><a href="#/admin">‹ Administración</a></p>
      <h1>Historial de cambios</h1>
      <p class="muted">Quién dio de alta, cambió, borró o calificó cada ejemplar, y cuándo. Lo anota el servidor automáticamente y nadie puede modificarlo. Sirve para responder a la inspección oficial y para aclarar cualquier duda sobre un registro.</p>
      ${sinServidor ? h`<div class="aviso-caja aviso">El historial está en el Libro central. En modo dispositivo no hay historial.</div>` : h`
      <div class="fila" role="group" aria-label="Mostrar">${FILTROS.map(([v, n]) => h`<button type="button" class="btn btn-pequeno" data-filtro="${v}" aria-pressed="${String(filtro === v)}">${n}</button>`)}</div>
      ${error ? h`<div class="aviso-caja alerta" role="alert">${error}</div>` : ''}
      ${!error && !cargando && !filas.length ? h`<p class="muted">Todavía no hay cambios anotados${filtro ? ' de este tipo' : ''}.</p>` : ''}
      <div id="hi-lista">${porDia.map(({ d, items }) => h`<div class="tarjeta"><h2 class="peq">${dia(`${d}T12:00:00`)}</h2><ul class="lista">${items.map(e => {
        const x = datos.describirHistorial(e);
        return h`<li class="item"><span class="item-principal">
          <span class="item-titulo">${x.enlace ? h`<a href="${x.enlace}">${x.que}</a>` : x.que}</span>
          <span class="item-sub">${hora(e.fecha)} · ${x.quien} · ${ACCION[e.operacion] || e.operacion}</span>
          ${detalle(e)}</span></li>`;
      })}</ul></div>`)}</div>
      ${cargando ? h`<p class="muted" role="status">Cargando…</p>` : ''}
      ${hayMas && !cargando ? h`<button type="button" class="btn btn-bloque" id="hi-mas">Ver cambios anteriores</button>` : ''}`}`);

    main.querySelectorAll('[data-filtro]').forEach(b => b.addEventListener('click', () => { filtro = b.dataset.filtro; pedir(true); }));
    $('#hi-mas', main)?.addEventListener('click', () => { pagina++; pedir(false); });
  };

  async function pedir(desdeCero) {
    if (desdeCero) { pagina = 0; filas = []; }
    cargando = true; error = ''; dibujar();
    try {
      const nuevas = await datos.historialServidor({ tabla: filtro, pagina });
      filas = filas.concat(nuevas);
      hayMas = nuevas.length === datos.TAM_HISTORIAL;
    } catch (e) { error = e.message; hayMas = false; }
    cargando = false;
    dibujar();
  }

  if (supabaseConfigurado()) pedir(true); else dibujar();
  return datos.suscribir(() => { if (!cargando) dibujar(); });
}
