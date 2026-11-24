// PDF mínimo, sin dependencias: una página A4 con texto (Helvetica y Helvetica-Bold,
// codificación WinAnsi para tildes, ñ y €), líneas y rectángulos. Basta para recibos.
// Uso: const p = nuevoPdf(); p.texto(x, y, 'Hola', { tam: 12, negrita: true }); ... p.bytes()
// Las coordenadas van en milímetros desde la esquina superior izquierda.

const MM = 72 / 25.4;
const ALTO = 297, ANCHO = 210;

// Anchos de Helvetica (1/1000 em) para medir y alinear a la derecha o centrar
const ANCHOS = { ' ': 278, '!': 278, '"': 355, '#': 556, '$': 556, '%': 889, '&': 667, "'": 191, '(': 333, ')': 333, '*': 389, '+': 584, ',': 278, '-': 333, '.': 278, '/': 278,
  0: 556, 1: 556, 2: 556, 3: 556, 4: 556, 5: 556, 6: 556, 7: 556, 8: 556, 9: 556, ':': 278, ';': 278, '<': 584, '=': 584, '>': 584, '?': 556, '@': 1015,
  A: 667, B: 667, C: 722, D: 722, E: 667, F: 611, G: 778, H: 722, I: 278, J: 500, K: 667, L: 556, M: 833, N: 722, O: 778, P: 667, Q: 778, R: 722, S: 667, T: 611,
  U: 722, V: 667, W: 944, X: 667, Y: 667, Z: 611, a: 556, b: 556, c: 500, d: 556, e: 556, f: 278, g: 556, h: 556, i: 222, j: 222, k: 500, l: 222, m: 833, n: 556,
  o: 556, p: 556, q: 556, r: 333, s: 500, t: 278, u: 556, v: 500, w: 722, x: 500, y: 500, z: 500, '€': 556, 'º': 365, 'ª': 370, '·': 278 };
const SIN_TILDE = (c) => c.normalize('NFD').replace(/[̀-ͯ]/g, '');
export const anchoTexto = (s, tam, negrita = false) => [...String(s)].reduce((x, c) => x + (ANCHOS[c] ?? ANCHOS[SIN_TILDE(c)] ?? 556), 0) * tam / 1000 * (negrita ? 1.05 : 1) / MM;

// WinAnsi (CP1252): Latin-1 tal cual y unos pocos caracteres en 0x80–0x9F
const CP1252 = { '€': 0x80, '‚': 0x82, '„': 0x84, '…': 0x85, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '–': 0x96, '—': 0x97 };
function cadena(s) {
  let out = '';
  for (const c of String(s)) {
    let b = CP1252[c] ?? c.codePointAt(0);
    if (b > 255) b = 63; // «?» para lo que WinAnsi no tiene
    if (b === 40 || b === 41 || b === 92) out += '\\' + c;
    else if (b < 32 || b > 126) out += '\\' + b.toString(8).padStart(3, '0');
    else out += c;
  }
  return `(${out})`;
}
const n2 = (v) => (Math.round(v * 100) / 100).toString();

export function nuevoPdf({ titulo = '' } = {}) {
  const ops = [];
  const api = {
    // alinear: 'izq' | 'der' | 'centro' (x es el borde izquierdo, derecho o el centro)
    texto(x, y, s, { tam = 11, negrita = false, alinear = 'izq', gris = 0 } = {}) {
      const w = anchoTexto(s, tam, negrita);
      const x0 = alinear === 'der' ? x - w : alinear === 'centro' ? x - w / 2 : x;
      ops.push(`BT ${n2(gris)} g /${negrita ? 'F2' : 'F1'} ${tam} Tf ${n2(x0 * MM)} ${n2((ALTO - y) * MM)} Td ${cadena(s)} Tj ET 0 g`);
      return api;
    },
    // Texto en varias líneas dentro de un ancho (mm); devuelve la y siguiente
    parrafo(x, y, s, ancho, { tam = 11, negrita = false, interlinea = 1.35 } = {}) {
      const palabras = String(s).split(/\s+/);
      let linea = '';
      for (const p of palabras) {
        const prueba = linea ? `${linea} ${p}` : p;
        if (anchoTexto(prueba, tam, negrita) > ancho && linea) { api.texto(x, y, linea, { tam, negrita }); y += tam * interlinea / MM; linea = p; } else linea = prueba;
      }
      if (linea) { api.texto(x, y, linea, { tam, negrita }); y += tam * interlinea / MM; }
      return y;
    },
    linea(x1, y1, x2, y2, { grosor = 0.6, gris = 0 } = {}) {
      ops.push(`${n2(gris)} G ${grosor} w ${n2(x1 * MM)} ${n2((ALTO - y1) * MM)} m ${n2(x2 * MM)} ${n2((ALTO - y2) * MM)} l S 0 G`);
      return api;
    },
    rect(x, y, w, hh, { grosor = 0.8, relleno = null } = {}) {
      if (relleno !== null) ops.push(`${n2(relleno)} g ${n2(x * MM)} ${n2((ALTO - y - hh) * MM)} ${n2(w * MM)} ${n2(hh * MM)} re f 0 g`);
      ops.push(`${grosor} w ${n2(x * MM)} ${n2((ALTO - y - hh) * MM)} ${n2(w * MM)} ${n2(hh * MM)} re S`);
      return api;
    },
    bytes() {
      const enc = (s) => Uint8Array.from(s, c => c.charCodeAt(0) & 255);
      const contenido = ops.join('\n');
      const objs = [
        '<< /Type /Catalog /Pages 2 0 R >>',
        '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${n2(ANCHO * MM)} ${n2(ALTO * MM)}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>`,
        '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
        '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
        `<< /Length ${contenido.length} >>\nstream\n${contenido}\nendstream`,
        `<< /Title ${cadena(titulo)} /Producer (AlacantinApp) >>`
      ];
      let pdf = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
      const offs = [];
      objs.forEach((o, i) => { offs.push(pdf.length); pdf += `${i + 1} 0 obj\n${o}\nendobj\n`; });
      const xref = pdf.length;
      pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offs.map(o => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
      pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R /Info 7 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
      return enc(pdf);
    }
  };
  return api;
}

// Importe en letra (castellano), para los recibos: 25,5 → «veinticinco euros con cincuenta céntimos»
const UNIDADES = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce', 'trece', 'catorce', 'quince',
  'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve', 'veinte', 'veintiuno', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve'];
const DECENAS = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
const CENTENAS = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];
function hasta999(n) {
  if (n === 100) return 'cien';
  const c = Math.floor(n / 100), r = n % 100;
  const resto = r < 30 ? (r ? UNIDADES[r] : '') : DECENAS[Math.floor(r / 10)] + (r % 10 ? ` y ${UNIDADES[r % 10]}` : '');
  return [CENTENAS[c], resto].filter(Boolean).join(' ') || 'cero';
}
function enteroEnLetra(n) {
  if (n < 1000) return hasta999(n);
  const miles = Math.floor(n / 1000), r = n % 1000;
  return `${miles === 1 ? 'mil' : hasta999(miles).replace(/veintiuno$/, 'veintiún').replace(/uno$/, 'un') + ' mil'}${r ? ` ${hasta999(r)}` : ''}`;
}
export function importeEnLetra(importe) {
  const cent = Math.round(Math.abs(importe) * 100);
  const e = Math.floor(cent / 100), c = cent % 100;
  const euros = e === 1 ? 'un euro' : `${enteroEnLetra(e).replace(/veintiuno$/, 'veintiún').replace(/uno$/, 'un')} euros`;
  if (!e && c) return `${enteroEnLetra(c).replace(/veintiuno$/, 'veintiún').replace(/uno$/, 'un')} céntimo${c === 1 ? '' : 's'}`;
  return c ? `${euros} con ${enteroEnLetra(c).replace(/veintiuno$/, 'veintiún').replace(/uno$/, 'un')} céntimo${c === 1 ? '' : 's'}` : euros;
}
