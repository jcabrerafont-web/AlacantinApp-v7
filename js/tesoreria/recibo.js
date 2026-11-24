// Recibo de cuota de socio en PDF (A4, mitad superior, para imprimir o enviar).
import { CONFIG } from '../config.js';
import { nuevoPdf, importeEnLetra } from './pdf.js';

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const dma = (iso) => iso.split('-').reverse().join('/');
const largo = (iso) => { const [y, m, d] = iso.split('-').map(Number); return `${d} de ${MESES[m - 1]} de ${y}`; };
const euros = (n) => `${Number(n).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
// Localidad del domicilio del Club («…, 03720 Benissa (Alicante)» → «Benissa»)
const localidad = () => (String(CONFIG.club.domicilio || '').match(/\d{5}\s+([^,(]+)/)?.[1] || '').trim();

// logo: bytes de un JPEG (icons/logo-recibo.jpg); sin él, el recibo sale sin escudo
export function reciboPdf(r, { logo = null } = {}) {
  const nombre = [r.socio.nombre, r.socio.apellidos].filter(Boolean).join(' ');
  const p = nuevoPdf({ titulo: `Recibo ${r.numero} · ${nombre}` });
  const izq = 20, der = 190;
  p.rect(14, 12, 182, 138, { grosor: 0.8 });
  const x0 = logo ? izq + 24 : izq;
  if (logo) p.imagen(izq, 15.5, 20, 20, logo);
  p.texto(x0, 24, CONFIG.club.nombre, { tam: 14, negrita: true });
  p.texto(x0, 30, `NIF ${CONFIG.club.nif}${CONFIG.club.domicilio ? ` · ${CONFIG.club.domicilio}` : ''}`, { tam: 8.5, gris: 0.3 });
  p.texto(der, 24, `Recibo nº ${r.numero}`, { tam: 11, negrita: true, alinear: 'der' });
  p.linea(izq, 38, der, 38, { grosor: 0.5, gris: 0.5 });
  p.texto(105, 48, 'RECIBO DE CUOTA DE SOCIO', { tam: 15, negrita: true, alinear: 'centro' });
  let y = 61;
  const fila = (et, v) => { p.texto(izq, y, et, { tam: 10, gris: 0.35 }); p.texto(izq + 38, y, v, { tam: 11, negrita: true }); y += 8; };
  fila('Recibido de', nombre || '—');
  if (r.socio.dni) fila('DNI / NIE', r.socio.dni);
  if (r.socio.numero) fila('Nº de socio', String(r.socio.numero));
  fila('Concepto', `Cuota de socio del año ${r.anio}${r.completa ? '' : ' (pago parcial)'}`);
  // Importe destacado
  p.rect(izq, y - 4, 170, 14, { grosor: 0.5, relleno: 0.94 });
  p.texto(izq + 4, y + 5, 'Importe', { tam: 10, gris: 0.35 });
  p.texto(izq + 38, y + 5.3, euros(r.importe), { tam: 14, negrita: true });
  y += 16;
  y = p.parrafo(izq, y, `Son ${importeEnLetra(r.importe)}.`, 170, { tam: 10 });
  y += 2;
  p.texto(izq, y, r.pagos.length > 1 ? 'Pagos' : 'Forma de pago', { tam: 10, gris: 0.35 });
  for (const m of r.pagos) { p.texto(izq + 38, y, `${m.forma} · ${dma(m.fecha)}${r.pagos.length > 1 ? ` · ${euros(m.importe)}` : ''}`, { tam: 10.5 }); y += 6; }
  const lugar = localidad();
  p.texto(izq, Math.max(y + 6, 118), `${lugar ? `${lugar}, ` : ''}${largo(r.emitido)}`, { tam: 10.5 });
  p.linea(125, 136, der, 136, { grosor: 0.4 });
  p.texto(157.5, 141, 'La Tesorería', { tam: 10, alinear: 'centro' });
  p.texto(105, 145.5, 'Recibo emitido por la tesorería del Club con AlacantinApp.', { tam: 7.5, gris: 0.45, alinear: 'centro' });
  return p.bytes();
}
export const nombreArchivoRecibo = (r) => `Recibo_${r.numero}_${[r.socio.nombre, r.socio.apellidos].filter(Boolean).join('_').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '_')}.pdf`;

// El logo se descarga una vez (lo guarda el service worker para usarlo sin cobertura)
let logoCache = null;
export async function logoRecibo() {
  if (logoCache) return logoCache;
  try { const r = await fetch('./icons/logo-recibo.jpg'); if (!r.ok) return null; logoCache = new Uint8Array(await r.arrayBuffer()); return logoCache; } catch { return null; }
}
