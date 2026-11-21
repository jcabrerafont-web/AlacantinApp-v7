// Mapa de aviarios (administración e inspección): cada aviario con su censo, filtros
// por variedad y tamaño, fondo de mapa o foto aérea, «Cómo llegar» y exportación para
// QGIS. Leaflet va dentro de la app (vendor/leaflet); solo el fondo necesita conexión.
// La ubicación exacta es un dato personal: no sale de administración e inspección.
import * as datos from '../datos.js';
import { ESTANDAR, variedadPorId } from '../estandar.js';
import { h, crudo, pintar, $, descargar, hoyISO } from '../ui.js';
import { icono } from '../iconos.js';

const TAMANOS = [['', 'Todos'], ['0', 'Sin ejemplares'], ['1-3', '1 a 3'], ['4-8', '4 a 8'], ['9-', '9 o más']];
const enTamano = (t, n) => !t || (t === '0' ? n === 0 : t === '9-' ? n >= 9 : (([a, b]) => n >= a && n <= b)(t.split('-').map(Number)));
const comoLlegar = (x) => `https://www.google.com/maps/dir/?api=1&destination=${x.lat},${x.lng}`;
const color = (n) => (n === 0 ? '#94a3b8' : n <= 3 ? '#60a5fa' : n <= 8 ? '#2b44a0' : '#c0262d');
const nombreVar = (id) => variedadPorId(id)?.nombre || id;

let L = null;
async function cargarLeaflet() {
  if (!document.querySelector('link[data-leaflet]')) {
    const css = document.createElement('link');
    css.rel = 'stylesheet'; css.href = './vendor/leaflet/leaflet.css'; css.dataset.leaflet = '1';
    document.head.appendChild(css);
  }
  if (!L) L = (await import('../../vendor/leaflet/leaflet.js')).default;
  return L;
}

export default function (main) {
  let variedad = '';
  let tamano = '';
  let mapa = null, capa = null;

  const filtrados = () => datos.aviarios().conUbicacion
    .filter(x => !variedad || x.variedades.includes(variedad))
    .filter(x => enTamano(tamano, x.total));

  const fichaPopup = (x) => h`<strong>${x.perfil.nombre || 'Sin nombre'}</strong><br>
    ${x.perfil.municipio || '—'}${x.perfil.rega ? h` · ${x.perfil.rega}` : ''}<br>
    ♂ ${x.machos} · ♀ ${x.hembras}${x.rd ? h` · ${x.rd} en RD/RM` : ''}<br>
    ${x.variedades.length ? x.variedades.map(nombreVar).join(', ') : 'Sin ejemplares en el Libro'}<br>
    <a href="${comoLlegar(x)}" target="_blank" rel="noopener">Cómo llegar</a> · <a href="#/usuarios">Ver en Usuarios</a>`;

  const dibujar = () => {
    const { sinUbicacion } = datos.aviarios();
    const lista = filtrados();
    const totalAves = lista.reduce((n, x) => n + x.total, 0);
    const municipios = new Set(lista.map(x => x.perfil.municipio).filter(Boolean)).size;
    pintar(main, h`
      <p class="peq"><a href="#/${datos.rol() === 'administrador' ? 'admin' : 'inspector'}">‹ ${datos.rol() === 'administrador' ? 'Administración' : 'Inspección'}</a></p>
      <h1>Mapa de aviarios</h1>
      <p class="muted">Dónde está cada aviario y qué cría. La ubicación exacta solo la ven administración e inspección.</p>
      <div class="kpis">
        <div class="kpi"><b>${lista.length}</b><span>Aviarios en el mapa</span></div>
        <div class="kpi"><b>${municipios}</b><span>Municipios</span></div>
        <div class="kpi"><b>${totalAves}</b><span>Ejemplares activos</span></div>
        <div class="kpi"><b>${sinUbicacion.length}</b><span>Sin ubicación</span></div>
      </div>
      <div class="tarjeta">
        <div class="rejilla rejilla-2">
          <div class="campo"><label for="m-variedad">Variedad</label><select id="m-variedad">
            <option value="">Todas</option>${ESTANDAR.variedades.map(v => h`<option value="${v.id}" ${variedad === v.id ? h`selected` : ''}>${v.nombre}</option>`)}</select></div>
          <div class="campo"><label for="m-tamano">Ejemplares en el aviario</label><select id="m-tamano">
            ${TAMANOS.map(([v, n]) => h`<option value="${v}" ${tamano === v ? h`selected` : ''}>${n}</option>`)}</select></div>
        </div>
        <div id="m-mapa" class="mapa" role="region" aria-label="Mapa de aviarios"></div>
        <p class="peq muted leyenda-mapa">${[[0, 'sin ejemplares'], [1, '1 a 3'], [4, '4 a 8'], [9, '9 o más']].map(([n, t]) => h`<span><i style="background:${color(n)}"></i>${t}</span>`)}</p>
        <p class="peq muted" id="m-sin-red" hidden>Sin conexión no se ve el fondo del mapa, pero los aviarios y la lista siguen disponibles.</p>
      </div>

      <div class="tarjeta"><div class="fila entre"><h2>Aviarios</h2>
        <button class="btn btn-pequeno" id="m-geojson" ${lista.length ? '' : h`disabled`}>${icono('guardar')} Exportar para QGIS</button></div>
        ${lista.length ? h`<ul class="lista">${lista.sort((a, b) => String(a.perfil.municipio || '').localeCompare(String(b.perfil.municipio || ''), 'es')).map(x => h`<li class="item">
          <div class="item-principal"><div class="item-titulo"><i class="punto-mapa" style="background:${color(x.total)}"></i>${x.perfil.nombre || 'Sin nombre'} <span class="muted peq">· ${x.perfil.municipio || '—'}</span></div>
          <div class="item-sub">♂ ${x.machos} · ♀ ${x.hembras}${x.variedades.length ? ` · ${x.variedades.map(nombreVar).join(', ')}` : ''}${x.perfil.rega ? ` · ${x.perfil.rega}` : ''}</div></div>
          <div class="fila" style="gap:.35rem;flex-wrap:nowrap">
            <button class="btn btn-pequeno" type="button" data-ver="${x.perfil.id}" aria-label="Ver ${x.perfil.nombre || 'aviario'} en el mapa">${icono('mapa')}</button>
            <a class="btn btn-pequeno" href="${comoLlegar(x)}" target="_blank" rel="noopener">Cómo llegar</a></div></li>`)}</ul>`
          : h`<p class="muted">${datos.aviarios().conUbicacion.length ? 'Ningún aviario cumple los filtros.' : 'Todavía no hay aviarios con ubicación. Cada criador la guarda en «Mi aviario», estando en el aviario.'}</p>`}
        <p class="peq muted">El archivo GeoJSON se abre en QGIS, uMap o Google Earth. Lleva nombres, REGA y ubicaciones: guárdalo solo en sitios del Club.</p>
      </div>

      ${sinUbicacion.length ? h`<details class="tarjeta"><summary><strong>Sin ubicación (${sinUbicacion.length})</strong></summary>
        <p class="peq muted">Pídeles que abran «Mi aviario» estando en el aviario y pulsen «Usar mi ubicación actual».</p>
        <ul class="lista">${sinUbicacion.map(x => h`<li class="item"><div class="item-principal"><div class="item-titulo">${x.perfil.nombre || x.perfil.email || '—'}</div>
          <div class="item-sub">${x.perfil.municipio || 'sin municipio'} · ${x.total} ejemplar(es)</div></div>
          ${x.perfil.telefono ? h`<a class="btn btn-pequeno" href="tel:${x.perfil.telefono}">Llamar</a>` : x.perfil.email ? h`<a class="btn btn-pequeno" href="mailto:${x.perfil.email}">Escribir</a>` : ''}</li>`)}</ul></details>` : ''}`);

    $('#m-variedad', main).addEventListener('change', e => { variedad = e.target.value; dibujar(); });
    $('#m-tamano', main).addEventListener('change', e => { tamano = e.target.value; dibujar(); });
    $('#m-geojson', main)?.addEventListener('click', () =>
      descargar(JSON.stringify(datos.geojsonAviarios(lista), null, 1), `ESGA025_aviarios_${hoyISO()}.geojson`, 'application/geo+json'));
    pintarMapa(lista);
  };

  async function pintarMapa(lista) {
    const cont = $('#m-mapa', main);
    try { await cargarLeaflet(); } catch { cont.textContent = 'No se pudo cargar el mapa.'; return; }
    if (!cont.isConnected) return;
    if (mapa) { mapa.remove(); mapa = null; }
    mapa = L.map(cont, { zoomControl: true, attributionControl: true }).setView([38.55, -0.5], 8);
    const callejero = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© colaboradores de <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>' });
    const aerea = L.tileLayer('https://www.ign.es/wmts/pnoa-ma?layer=OI.OrthoimageCoverage&style=default&tilematrixset=GoogleMapsCompatible&Service=WMTS&Request=GetTile&Version=1.0.0&Format=image/jpeg&TileMatrix={z}&TileCol={x}&TileRow={y}',
      { maxZoom: 19, attribution: 'PNOA cedido por © <a href="https://www.ign.es" target="_blank" rel="noopener">Instituto Geográfico Nacional</a>' });
    callejero.addTo(mapa);
    L.control.layers({ 'Mapa': callejero, 'Foto aérea (PNOA)': aerea }, null, { collapsed: true }).addTo(mapa);
    callejero.on('tileerror', () => { const n = $('#m-sin-red', main); if (n) n.hidden = false; });
    capa = L.layerGroup().addTo(mapa);
    const marcas = new Map();
    for (const x of lista) {
      const m = L.circleMarker([x.lat, x.lng], { radius: 9 + Math.min(x.total, 30) / 3, color: '#fff', weight: 2, fillColor: color(x.total), fillOpacity: .9 })
        .bindPopup(crudo(fichaPopup(x)));
      m.addTo(capa);
      marcas.set(x.perfil.id, m);
    }
    if (lista.length === 1) mapa.setView([lista[0].lat, lista[0].lng], 13);
    else if (lista.length) mapa.fitBounds(L.latLngBounds(lista.map(x => [x.lat, x.lng])), { padding: [30, 30], maxZoom: 13 });
    main.querySelectorAll('[data-ver]').forEach(b => b.addEventListener('click', () => {
      const m = marcas.get(b.dataset.ver);
      if (!m) return;
      cont.scrollIntoView({ behavior: 'smooth', block: 'center' });
      mapa.setView(m.getLatLng(), 14); m.openPopup();
    }));
  }

  dibujar();
  const quitar = datos.suscribir(() => { /* el mapa no se repinta solo: evita perder el zoom del usuario */ });
  return () => { quitar(); if (mapa) { mapa.remove(); mapa = null; } };
}
