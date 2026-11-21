// Propuesta de programa de cría (borrador), para el expediente del Catálogo
// (Protocolo CNZ 2025, apdo. 3.1 n). Se genera con las reglas de la app y los
// datos del Libro; se imprime o se guarda en PDF para que el Club lo complete.
import * as datos from '../datos.js';
import * as docs from '../documentos.js';
import { h, pintar, $ } from '../ui.js';

export function datosPrograma() {
  const anio = new Date().getFullYear();
  const resumen = datos.resumenAnual(anio);
  const vivos = datos.censo().filter(a => a.estado !== 'baja');
  const porProv = {};
  vivos.forEach(a => { const k = a.provincia || 'Sin provincia'; porProv[k] = (porProv[k] || 0) + 1; });
  const cal = datos.estado.calificaciones.filter(c => Number.isFinite(Number(c.total)));
  return {
    resumen,
    provincias: Object.entries(porProv).sort((a, b) => b[1] - a[1]),
    calif: { n: datos.estado.calificaciones.length, aptos: datos.estado.calificaciones.filter(c => c.resultado === 'Apto').length,
      media: cal.length ? cal.reduce((s, c) => s + Number(c.total), 0) / cal.length : null },
    evolucion: datos.evolucionCenso(),
    puesta: datos.puestaRaza(),
    situacion: vivos.length ? datos.situacionPoblacional() : null
  };
}

export default function (main) {
  const dibujar = () => {
    const d = datosPrograma();
    pintar(main, h`
      <p class="peq"><a href="#/admin/expediente">‹ Expediente para el Catálogo</a></p>
      <h1>Programa de cría (borrador)</h1>
      <p class="muted">Propuesta para el apartado n) del expediente: el programa de cría que la app ya aplica, con los datos y resultados del Libro. Lo marcado en amarillo lo tiene que decidir el Club.</p>
      <div class="tarjeta fila"><button class="btn btn-primario" id="pc-imprimir">🖨️ Imprimir o guardar en PDF</button></div>
      <div class="doc-pantalla" id="programa-cria">${docs.plantillaProgramaCria(d)}</div>`);
    const t = main.querySelector('#programa-cria h1');
    if (t) { const h2 = document.createElement('h2'); h2.innerHTML = t.innerHTML; t.replaceWith(h2); }
    $('#pc-imprimir', main).addEventListener('click', () => docs.programaCria(d));
  };
  dibujar();
  return datos.suscribir(dibujar);
}
