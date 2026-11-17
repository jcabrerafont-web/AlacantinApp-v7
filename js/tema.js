// Tema de la pantalla: 'auto' (según el sistema), 'claro', 'oscuro' o 'sol' (alto contraste
// y letra mayor, para leer al aire libre). Se guarda en este dispositivo.
const CLAVE = 'alacantinapp-tema';
export const TEMAS = { auto: 'Automático', claro: 'Claro', oscuro: 'Oscuro', sol: 'Sol' };
export function actual() { try { return localStorage.getItem(CLAVE) || 'auto'; } catch { return 'auto'; } }
export function aplicar(t) {
  if (!TEMAS[t]) t = 'auto';
  try { if (t === 'auto') localStorage.removeItem(CLAVE); else localStorage.setItem(CLAVE, t); } catch { /* sin almacenamiento: solo esta sesión */ }
  if (t === 'auto') delete document.documentElement.dataset.tema; else document.documentElement.dataset.tema = t;
}
