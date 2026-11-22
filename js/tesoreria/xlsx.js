// ============================================================================
// Lector mínimo de archivos Excel (.xlsx) en el navegador, sin librerías externas.
// Un .xlsx es un ZIP con XML dentro: se descomprime con DecompressionStream y se
// leen las hojas con DOMParser. Devuelve valores (texto o número); las fechas de
// Excel llegan como número de serie y se convierten con fechaExcel().
// El archivo se lee en el dispositivo: no se envía a ningún sitio.
// ============================================================================
const dec = new TextDecoder();

async function inflar(bytes) {
  const s = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(s).arrayBuffer());
}

// Índice central del ZIP: nombre -> { metodo, inicio, tamano }
function entradasZip(buf) {
  const v = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let fin = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 66000); i--) if (v.getUint32(i, true) === 0x06054b50) { fin = i; break; }
  if (fin < 0) throw new Error('El archivo no es un Excel (.xlsx) válido.');
  const total = v.getUint16(fin + 10, true);
  let p = v.getUint32(fin + 16, true);
  const mapa = new Map();
  for (let n = 0; n < total; n++) {
    if (v.getUint32(p, true) !== 0x02014b50) throw new Error('El Excel está dañado.');
    const metodo = v.getUint16(p + 10, true), tamano = v.getUint32(p + 20, true);
    const lnom = v.getUint16(p + 28, true), lext = v.getUint16(p + 30, true), lcom = v.getUint16(p + 32, true);
    const local = v.getUint32(p + 42, true);
    const nombre = dec.decode(buf.subarray(p + 46, p + 46 + lnom));
    const inicio = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true);
    mapa.set(nombre, { metodo, inicio, tamano });
    p += 46 + lnom + lext + lcom;
  }
  return mapa;
}

async function leerEntrada(buf, mapa, nombre) {
  const e = mapa.get(nombre);
  if (!e) return null;
  const datos = buf.subarray(e.inicio, e.inicio + e.tamano);
  if (e.metodo === 0) return dec.decode(datos);
  if (e.metodo === 8) return dec.decode(await inflar(datos));
  throw new Error('El Excel usa una compresión que no se puede leer.');
}

const xml = (t) => new DOMParser().parseFromString(t, 'application/xml');
const hijos = (el, nombre) => [...el.getElementsByTagNameNS('*', nombre)];
const columna = (ref) => { let n = 0; for (const c of ref.replace(/\d+/g, '')) n = n * 26 + (c.charCodeAt(0) - 64); return n - 1; };

/** Lee todas las hojas: [{ nombre, filas: [[valor, …], …] }] */
export async function leerXlsx(archivo) {
  const buf = new Uint8Array(await archivo.arrayBuffer());
  const mapa = entradasZip(buf);
  const libro = xml(await leerEntrada(buf, mapa, 'xl/workbook.xml') || '');
  const rels = xml(await leerEntrada(buf, mapa, 'xl/_rels/workbook.xml.rels') || '<r/>');
  const destino = Object.fromEntries(hijos(rels, 'Relationship').map(r => [r.getAttribute('Id'), r.getAttribute('Target')]));
  const sst = await leerEntrada(buf, mapa, 'xl/sharedStrings.xml');
  const compartidas = sst ? hijos(xml(sst), 'si').map(si => hijos(si, 't').map(t => t.textContent).join('')) : [];
  const hojas = [];
  for (const h of hijos(libro, 'sheet')) {
    const rid = h.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id') || h.getAttribute('r:id');
    let ruta = destino[rid] || '';
    ruta = ruta.startsWith('/') ? ruta.slice(1) : `xl/${ruta.replace(/^\.\//, '')}`;
    const texto = await leerEntrada(buf, mapa, ruta);
    if (!texto) continue;
    const filas = [];
    for (const r of hijos(xml(texto), 'row')) {
      const fila = [];
      for (const c of hijos(r, 'c')) {
        const t = c.getAttribute('t'), v = hijos(c, 'v')[0]?.textContent;
        let valor = null;
        if (t === 's') valor = compartidas[Number(v)] ?? null;
        else if (t === 'inlineStr') valor = hijos(c, 't').map(x => x.textContent).join('');
        else if (t === 'str' || t === 'e') valor = v ?? null;
        else if (t === 'b') valor = v === '1';
        else if (v !== undefined) valor = Number(v);
        fila[c.getAttribute('r') ? columna(c.getAttribute('r')) : fila.length] = valor;
      }
      filas[Number(r.getAttribute('r') || filas.length + 1) - 1] = Array.from(fila, x => (x === undefined ? null : x));
    }
    hojas.push({ nombre: h.getAttribute('name'), filas: Array.from(filas, f => f || []) });
  }
  return hojas;
}

/** Número de serie de Excel (días desde 1899-12-30) → AAAA-MM-DD. Texto dd/mm/aaaa también. */
export function fechaExcel(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number' && v > 59 && v < 80000) {
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(v * 86400000));
    return d.toISOString().slice(0, 10);
  }
  const m = String(v).trim().match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (m) { const a = m[3].length === 2 ? `20${m[3]}` : m[3]; return `${a}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; }
  if (/^\d{4}-\d{2}-\d{2}/.test(String(v))) return String(v).slice(0, 10);
  return null;
}
