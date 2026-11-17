// Acta anual de cierre censal (inspección y administración: todo el Libro) o resumen anual del aviario (criador)
import * as datos from '../datos.js';
import { esAuditor } from '../auth.js';
import * as docs from '../documentos.js';
import { h, pintar, $, hoyISO } from '../ui.js';

export default function (main) {
  const p = datos.estado.perfil;
  const libro = esAuditor(p.rol);
  const actual = Number(hoyISO().slice(0, 4));
  // Años con datos: desde el nacimiento más antiguo del censo (máximo 10 años atrás)
  const primero = Math.max(actual - 10, Math.min(actual, ...datos.censo({ incluirBajas: true }).map(a => Number(String(a.fecha_nacimiento).slice(0, 4))).filter(Number.isFinite)));
  const anios = Array.from({ length: actual - primero + 1 }, (_, i) => actual - i);
  const q = new URLSearchParams(location.hash.split('?')[1] || '');
  let anio = anios.includes(Number(q.get('anio'))) ? Number(q.get('anio')) : (new Date().getMonth() === 0 ? actual - 1 : actual); // en enero, el año que se cierra

  const dibujar = () => {
    const r = datos.resumenAnual(anio);
    pintar(main, h`
      <h1>${libro ? 'Acta anual de cierre censal' : 'Resumen anual de mi aviario'}</h1>
      <p class="muted peq">${libro ? 'Balance del Libro a 31 de diciembre: censo por sección, edad y variedad, movimientos, variabilidad genética, reproducción y puesta. Se firma por la Dirección Técnica, la Secretaría y la Presidencia y se archiva cada año.'
        : 'Tu balance del año: censo, nacimientos y bajas, calificaciones, reproducción y puesta. Puedes imprimirlo o guardarlo en PDF.'}</p>
      <div class="tarjeta fila" style="flex-wrap:wrap;gap:.5rem;align-items:flex-end">
        <div class="campo" style="margin:0"><label for="ac-anio">Año</label><select id="ac-anio">${anios.map(x => h`<option value="${x}" ${x === anio ? h`selected` : ''}>${x}${x === actual ? ' (en curso)' : ''}</option>`)}</select></div>
        <button class="btn btn-primario" id="ac-imprimir">🖨️ Imprimir o guardar en PDF</button>
      </div>
      ${r.calidad.errores ? h`<div class="aviso-caja aviso peq">La auditoría tiene ${r.calidad.errores} error(es) sin corregir: conviene revisarlos antes de firmar el acta. <a href="#/auditoria">Ver auditoría →</a></div>` : ''}
      <div class="doc-pantalla" id="acta-anual">${docs.plantillaActaAnual(r)}</div>`);
    $('#ac-anio', main).addEventListener('change', e => { anio = Number(e.target.value); dibujar(); });
    $('#ac-imprimir', main).addEventListener('click', () => docs.actaAnual(r));
  };
  dibujar();
  return datos.suscribir(dibujar);
}
