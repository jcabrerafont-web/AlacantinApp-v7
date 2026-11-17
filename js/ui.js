// ============================================================================
// Utilidades de interfaz: escape HTML, plantillas seguras, avisos y diálogos.
// Regla de la v7: TODO dato de usuario se inserta con esc() o textContent.
// ============================================================================

const MAPA = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' };
export const esc = (v) => (v === null || v === undefined ? '' : String(v).replace(/[&<>"'`]/g, c => MAPA[c]));

// Plantilla etiquetada: interpola escapando salvo valores marcados con html()
const CRUDO = Symbol('crudo');
export const html = (s) => ({ [CRUDO]: String(s) });
export function h(partes, ...valores) {
  let out = partes[0];
  valores.forEach((v, i) => {
    if (Array.isArray(v)) out += v.map(x => (x && x[CRUDO] !== undefined ? x[CRUDO] : esc(x))).join('');
    else if (v && v[CRUDO] !== undefined) out += v[CRUDO];
    else if (v === false || v === null || v === undefined) out += '';
    else out += esc(v);
    out += partes[i + 1];
  });
  return html(out);
}
export const crudo = (x) => (x && x[CRUDO] !== undefined ? x[CRUDO] : esc(x));

export const $ = (sel, raiz = document) => raiz.querySelector(sel);
export const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];

export function pintar(el, plantilla) {
  if (typeof el === 'string') el = $(el);
  if (el) el.innerHTML = crudo(plantilla);
  return el;
}

let temporizador = null;
// Mensaje breve. Con { accion: { texto, fn } } lleva un botón (p. ej. «Deshacer») y dura más:
// para lo que tiene arreglo es mejor deshacer que preguntar «¿seguro?» antes.
export function aviso(texto, tipo = 'info', { accion = null, ms = null } = {}) {
  const el = $('#aviso');
  if (!el) return;
  el.textContent = '';
  const t = document.createElement('span');
  t.textContent = texto;
  el.appendChild(t);
  if (accion) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'toast-accion';
    b.textContent = accion.texto;
    b.addEventListener('click', async () => {
      el.classList.remove('visible');
      clearTimeout(temporizador);
      try { await accion.fn(); } catch (e) { aviso(e.message || String(e), 'error'); }
    }, { once: true });
    el.appendChild(b);
  }
  el.className = `toast toast-${tipo} visible${accion ? ' con-accion' : ''}`;
  el.setAttribute('role', tipo === 'error' ? 'alert' : 'status');
  clearTimeout(temporizador);
  temporizador = setTimeout(() => el.classList.remove('visible'), ms ?? (accion ? 7000 : tipo === 'error' ? 6000 : 3500));
}

// Diálogo modal accesible (<dialog>). Devuelve el valor con que se cierra.
export function dialogo({ titulo, cuerpo, acciones = [{ valor: 'ok', texto: 'Aceptar', primario: true }] }) {
  return new Promise(resolve => {
    const d = document.createElement('dialog');
    d.className = 'dialogo';
    d.innerHTML = crudo(h`<form method="dialog">
      <h2>${titulo}</h2>
      <div class="dialogo-cuerpo">${cuerpo}</div>
      <menu>${acciones.map(a => h`<button value="${a.valor}" class="${a.primario ? 'btn btn-primario' : (a.peligro ? 'btn btn-peligro' : 'btn')}">${a.texto}</button>`)}</menu>
    </form>`);
    document.body.appendChild(d);
    d.addEventListener('close', () => { resolve(d.returnValue || null); setTimeout(() => d.remove(), 0); }); // los campos siguen disponibles al resolver
    d.showModal();
  });
}

export const confirmar = async (titulo, texto, textoSi = 'Confirmar', peligro = false) =>
  (await dialogo({ titulo, cuerpo: h`<p>${texto}</p>`, acciones: [
    { valor: 'no', texto: 'Cancelar' },
    { valor: 'si', texto: textoSi, primario: !peligro, peligro }
  ] })) === 'si';

export const fecha = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
};
export const kg = (g) => (Number.isFinite(Number(g)) && g ? `${(Number(g) / 1000).toFixed(3).replace('.', ',')} kg` : '—');
export const pct = (x, dec = 2) => `${(Number(x || 0) * 100).toFixed(dec).replace('.', ',')} %`;
// Fecha de hoy en la hora del móvil (no en UTC: en España, entre la medianoche y la 1:00
// o las 2:00, la fecha UTC todavía es ayer).
export const fechaLocal = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const hoyISO = () => fechaLocal();

export function descargar(contenido, nombre, tipo = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }));
  const a = Object.assign(document.createElement('a'), { href: url, download: nombre });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export const csv = (filas) => '﻿' + filas.map(f => f.map(v => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",;\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}).join(',')).join('\r\n');

// Comprime una foto a WebP (máx. 1280 px) para ahorrar datos en zonas rurales
export async function comprimirFoto(archivo, lado = 1280, calidad = 0.8) {
  const bmp = await createImageBitmap(archivo);
  const k = Math.min(1, lado / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k);
  c.height = Math.round(bmp.height * k);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close?.();
  const tipo = c.toDataURL('image/webp').startsWith('data:image/webp') ? 'image/webp' : 'image/jpeg';
  return c.toDataURL(tipo, calidad);
}

export const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : ([1e7] + -1e3 + -4e3 + -8e3 + -1e11)
  .replace(/[018]/g, c => (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)));
