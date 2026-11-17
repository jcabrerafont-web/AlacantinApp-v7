// Buscar un ejemplar por su anilla desde cualquier pantalla (botón 🔍 de la cabecera o tecla «/»).
// En el gallinero se tiene el animal en la mano y se leen las últimas cifras de la anilla.
import * as datos from './datos.js';
import { nombreVariedad } from './estandar.js';
import { h, pintar } from './ui.js';

const MAX = 8;
const normal = (s) => String(s || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

// Puntuación: número de anilla que empieza por lo escrito > termina en lo escrito > lo contiene > nombre
export function buscarEjemplares(texto, lista = datos.censo({ incluirBajas: true })) {
  const q = normal(texto).replace(/\s+/g, '');
  if (!q) return [];
  const soloCifras = /^\d+$/.test(q);
  const res = [];
  for (const a of lista) {
    const anilla = normal(a.anilla);
    const numero = anilla.slice(-6).replace(/^0+/, '');
    let p = 0;
    if (soloCifras) {
      // Solo cifras: se mira el número grabado (las 6 últimas), no el año ni el diámetro
      const qn = q.replace(/^0+/, '') || '0';
      const seis = anilla.slice(-6);
      if (numero.startsWith(qn)) p = 4;
      else if (seis.endsWith(q)) p = 3;
      else if (seis.includes(q)) p = 2;
    } else if (anilla.includes(q)) p = 2;
    else if (normal(a.nombre).includes(q)) p = 1;
    if (p) res.push({ a, p });
  }
  return res.sort((x, y) => y.p - x.p || (x.a.estado === 'baja') - (y.a.estado === 'baja') || x.a.anilla.localeCompare(y.a.anilla)).map(x => x.a);
}

export function abrirBuscador() {
  if (document.getElementById('buscador')) return;
  const d = document.createElement('dialog');
  d.id = 'buscador';
  d.className = 'dialogo buscador';
  d.innerHTML = `<form method="dialog">
      <label for="buscar-q"><strong>Buscar por anilla</strong> <span class="muted peq">· últimas cifras o nombre</span></label>
      <input id="buscar-q" type="search" inputmode="numeric" autocomplete="off" enterkeyhint="go" placeholder="Ej.: 123">
      <p class="peq muted" style="margin:.4rem 0 0"><button type="button" class="enlace" id="buscar-letras">Escribir letras (nombre)</button></p>
      <ul id="buscar-res" class="lista" aria-live="polite"></ul>
      <menu><button class="btn" value="cerrar">Cerrar</button></menu>
    </form>`;
  document.body.appendChild(d);
  const q = d.querySelector('#buscar-q');
  const ul = d.querySelector('#buscar-res');
  let resultados = [];
  const ir = (a) => { d.close(); location.hash = `#/animal/${encodeURIComponent(a.id)}`; };
  const pintarRes = () => {
    resultados = buscarEjemplares(q.value);
    pintar(ul, !q.value.trim() ? '' : !resultados.length ? h`<li class="muted peq" style="padding:.5rem 0">Ninguna anilla coincide.</li>`
      : h`${resultados.slice(0, MAX).map((a, i) => h`<li><a class="item" href="#/animal/${encodeURIComponent(a.id)}" data-i="${i}">
          <span class="sexo sexo-${a.sexo}" aria-hidden="true">${a.sexo === 'M' ? '♂' : '♀'}</span>
          <span class="item-principal"><span class="item-titulo">${a.anilla}${a.nombre ? ` · ${a.nombre}` : ''}</span>
          <span class="item-sub">${nombreVariedad(a.variedad)} · ${a.seccion}${a.estado === 'baja' ? ' · baja' : ''}</span></span></a></li>`)}
        ${resultados.length > MAX ? h`<li class="muted peq" style="padding:.4rem 0">Y ${resultados.length - MAX} más: escribe más cifras.</li>` : ''}`);
  };
  q.addEventListener('input', pintarRes);
  q.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); if (resultados[0]) ir(resultados[0]); } });
  ul.addEventListener('click', e => { const a = e.target.closest('[data-i]'); if (a) { e.preventDefault(); ir(resultados[Number(a.dataset.i)]); } });
  d.querySelector('#buscar-letras').addEventListener('click', (e) => {
    const letras = q.inputMode !== 'text';
    q.inputMode = letras ? 'text' : 'numeric';
    e.target.textContent = letras ? 'Volver al teclado numérico' : 'Escribir letras (nombre)';
    q.blur(); q.focus();
  });
  d.addEventListener('close', () => d.remove());
  d.showModal();
  q.focus();
}
