// Iconos propios (trazo de 24×24, color del texto). Sustituyen a los emoji, que cambian de
// aspecto en cada móvil. Decorativos: aria-hidden; el texto de al lado da el nombre.
import { html } from './ui.js';

const T = {
  libro: '<path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5z"/><path d="M5 19.5A1.5 1.5 0 0 0 6.5 21H19v-3"/><path d="M9 7h6"/>',
  alta: '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
  huevo: '<path d="M12 3c3.6 0 6.5 5.4 6.5 9.8a6.5 6.5 0 0 1-13 0C5.5 8.4 8.4 3 12 3z"/>',
  herramientas: '<path d="M14.5 5.5a4 4 0 0 0-5.2 5.2L4 16v4h4l5.3-5.3a4 4 0 0 0 5.2-5.2l-2.7 2.7-2.6-.4-.4-2.6z"/>',
  estandar: '<circle cx="12" cy="9" r="5.5"/><path d="m8.7 13.5-1.2 7.5L12 19l4.5 2-1.2-7.5"/>',
  guia: '<rect x="5.5" y="4" width="13" height="17" rx="2"/><path d="M9 4V2.8h6V4M8.5 10h7M8.5 14h7M8.5 18h4"/>',
  lupa: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m20 20-4.8-4.8"/>',
  calendario: '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M8 3v4M16 3v4M3.5 10h17"/>',
  luz: '<path d="M9.5 18h5M10.5 21h3M12 3a6 6 0 0 0-3.5 10.9V16h7v-2.1A6 6 0 0 0 12 3z"/>',
  nacimiento: '<path d="M5.5 13.5a6.5 6.5 0 0 0 13 0c0-.9-.1-1.8-.4-2.6L16 12.5l-2-3-2 3-2-3-2 3-2.1-1.6c-.3.8-.4 1.7-.4 2.6z"/>',
  pollito: '<circle cx="10" cy="9" r="4"/><path d="M14 9l2.5 1-2.5 1M6 13.5C6 18 8.5 20 12 20s6-2 6-5.5c0-1.4-.6-2.4-1.5-3"/><circle cx="9" cy="8.5" r=".6" fill="currentColor"/>',
  balanza: '<path d="M12 4v15M7.5 19h9M5 7.5h14"/><path d="M5 7.5 2.5 13a2.5 2.5 0 0 0 5 0zM19 7.5 16.5 13a2.5 2.5 0 0 0 5 0z"/>',
  reloj: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
  telefono: '<path d="M5 3.5h3.5l2 5L8 10a11 11 0 0 0 6 6l1.5-2.5 5 2V19a2 2 0 0 1-2 2A16.5 16.5 0 0 1 3 5.5a2 2 0 0 1 2-2z"/>',
  coche: '<path d="M4.5 16v-4.5L6.8 6h10.4l2.3 5.5V16M3 16h18M7 19v-3M17 19v-3"/><circle cx="7.5" cy="13" r=".9" fill="currentColor"/><circle cx="16.5" cy="13" r=".9" fill="currentColor"/>',
  revision: '<path d="M10 6h10M10 12h10M10 18h10"/><path d="m3.5 6 1.5 1.5L7.5 5M3.5 12l1.5 1.5L7.5 11M3.5 18l1.5 1.5 2.5-2.5"/>',
  familia: '<circle cx="8" cy="7" r="3"/><circle cx="16.5" cy="8.5" r="2.5"/><path d="M3 20a5 5 0 0 1 10 0M13 20a4 4 0 0 1 8 0"/>',
  casa: '<path d="M4 11 12 4l8 7v9H4z"/><path d="M10 20v-5h4v5"/>',
  mapa: '<path d="m9 4-6 2v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/>',
  video: '<rect x="3" y="5" width="18" height="14" rx="4"/><path d="m10 9 5 3-5 3z"/>',
  guardar: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  nube: '<path d="M7 18h10a4 4 0 0 0 .6-8A6 6 0 0 0 6 9a4.5 4.5 0 0 0 1 9z"/>',
  candado: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>',
  aviso: '<path d="M12 3.5 2.5 20h19z"/><path d="M12 10v4.5M12 17.2v.3"/>',
  brujula: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>',
  grafico: '<path d="M4 20V4M4 20h16"/><path d="M8 16v-4M12 16V8M16 16v-6"/>',
  documento: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  camara: '<path d="M4 8h3l1.5-2.5h7L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  escudo: '<path d="M12 3 5 6v5.5c0 4.5 3 7.5 7 9.5 4-2 7-5 7-9.5V6z"/>',
  movil: '<rect x="7" y="2.5" width="10" height="19" rx="2"/><path d="M11 18.5h2"/>',
  bandera: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  cesta: '<path d="M3.5 10h17l-2 10h-13z"/><path d="m8 10 3-6M16 10l-3-6"/>',
  arbol: '<path d="M12 21v-6M12 15l-5-4M12 15l5-4M7 11V8M17 11V8"/><circle cx="7" cy="6" r="2"/><circle cx="17" cy="6" r="2"/>',
  lapiz: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  copia: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"/>',
  usuarios: '<circle cx="9" cy="8.5" r="3.5"/><path d="M2.5 20c.6-3.6 3.2-5.6 6.5-5.6s5.9 2 6.5 5.6"/><circle cx="17" cy="9.5" r="2.7"/><path d="M16.5 14.6c2.6.1 4.5 1.8 5 4.9"/>',
  estrella: '<path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.8z"/>',
  sol: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
  baja: '<path d="M5 7h14M10 7V4.5h4V7M7 7l1 13h8l1-13"/>',
  pareja: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>'
};

// Emoji que usaba la app → icono propio
const EMOJI = {
  '📚': 'libro', '➕': 'alta', '🥚': 'huevo', '🧰': 'herramientas', '📖': 'estandar', '📋': 'guia', '🔍': 'lupa', '🔎': 'lupa',
  '📅': 'calendario', '🗓️': 'calendario', '🔦': 'luz', '🐣': 'nacimiento', '🐥': 'pollito', '⚖️': 'balanza', '⏳': 'reloj', '📞': 'telefono',
  '🚗': 'coche', '🩺': 'revision', '🧬': 'familia', '🏡': 'casa', '💾': 'guardar', '☁️': 'nube', '🔒': 'candado', '🐞': 'aviso',
  '🧭': 'brujula', '💞': 'pareja', '📊': 'grafico', '📄': 'documento', '✅': 'check', '📷': 'camara', '🛡️': 'escudo', '📲': 'movil',
  '🚀': 'bandera', '🧺': 'cesta', '🌳': 'arbol', '✏️': 'lapiz', '🖨️': 'documento', '⬇️': 'guardar', '☀️': 'sol', '🗑': 'baja', '🏷️': 'documento', '👥': 'usuarios', '🗺️': 'mapa', '⭐': 'estrella'
};

export const svgIcono = (nombre, clase = '') => T[nombre]
  ? `<svg class="icono ${clase}" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${T[nombre]}</svg>`
  : '';
export const icono = (nombre, clase = '') => html(svgIcono(nombre, clase));
// Para textos que traían un emoji: si hay icono propio se usa; si no, el emoji tal cual
export const desdeEmoji = (e, clase = '') => (EMOJI[e] ? icono(EMOJI[e], clase) : e);
export const nombreDeEmoji = (e) => EMOJI[e] || null;

// Muestra del plumaje de la variedad con el sexo en una insignia (censo, ficha, buscador)
import { nombreVariedad } from './estandar.js';
const escAttr = (t) => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const ave = (a, clase = '') => html(`<span class="ave var-${escAttr(a.variedad || '')} sexo-${a.sexo === 'M' ? 'M' : 'H'} ${clase}" role="img" aria-label="${escAttr(`${a.sexo === 'M' ? 'Gallo' : 'Gallina'} ${nombreVariedad(a.variedad).toLowerCase()}`)}"><span class="ave-sexo" aria-hidden="true">${a.sexo === 'M' ? '♂' : '♀'}</span></span>`);
