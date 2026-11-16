// ============================================================================
// Documentos imprimibles (certificado genealógico y acta de calificación).
// Se maquetan en #impresion y se imprimen con el diálogo del sistema
// ("Guardar como PDF"). Sin ventanas emergentes ni librerías externas.
// ============================================================================
import { ESTANDAR, nombreVariedad, sexoTexto, evaluarConformidad } from './estandar.js';
import { ancestros, fxAnimal } from './genetica.js';
import { h, pintar, fecha, kg, pct } from './ui.js';

// Código de verificación reproducible (FNV-1a) a partir de los datos certificados
function huella(texto) {
  let x = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) { x ^= texto.charCodeAt(i); x = Math.imul(x, 0x01000193); }
  return (x >>> 0).toString(16).toUpperCase().padStart(8, '0');
}

const cabecera = (titulo, ref) => h`
  <div class="doc-cab">
    <img src="./icons/logo.png" alt="" width="64" height="64">
    <div><h1>${titulo}</h1>
      <div>Club Gallina Alacantina · Libro Genealógico · Estándar ${ESTANDAR.codigo} (rev. ${ESTANDAR.revision})</div>
      <div>Referencia: <strong>${ref}</strong> · Emitido el ${new Date().toLocaleDateString('es-ES')}</div></div>
  </div>`;

function imprimir(plantilla) {
  pintar('#impresion', plantilla);
  setTimeout(() => window.print(), 50);
}

export function certificado(a, { idx, titular, ultimaCalificacion }) {
  const anc = new Map(ancestros(a.id, idx, 3).map(x => [x.ruta, idx.get(x.id)]));
  const celda = (ruta, rol) => {
    const x = anc.get(ruta);
    return x ? h`<td><strong>${x.anilla}</strong>${x.nombre ? h` · ${x.nombre}` : ''}<br><small>${rol} · ${nombreVariedad(x.variedad)} · ${x.seccion}</small></td>`
      : h`<td><small>${rol}: no registrado</small></td>`;
  };
  const fx = fxAnimal(a, idx);
  const ref = `CG-${ESTANDAR.codigo}-${String(a.anilla).replace(/\W/g, '')}-${huella([a.id, a.anilla, a.seccion, a.padre_id, a.madre_id, ultimaCalificacion?.id || ''].join('|'))}`;
  imprimir(h`
    ${cabecera('Certificado genealógico', ref)}
    <h2>Ejemplar</h2>
    <table><tbody>
      <tr><th>Anilla</th><td>${a.anilla} (${ESTANDAR.anilla[a.sexo] || '—'} mm)</td><th>Sexo</th><td>${sexoTexto(a.sexo)}</td></tr>
      <tr><th>Nombre</th><td>${a.nombre || '—'}</td><th>Variedad</th><td>${nombreVariedad(a.variedad)}</td></tr>
      <tr><th>Nacimiento</th><td>${fecha(a.fecha_nacimiento)}</td><th>Sección</th><td>${a.seccion} · ${ESTANDAR.secciones[a.seccion] || ''}</td></tr>
      <tr><th>Peso</th><td>${kg(a.peso_g)}</td><th>Familia</th><td>${a.familia ? `Familia ${a.familia}` : '—'}</td></tr>
      <tr><th>Consanguinidad (Wright, 5 gen.)</th><td colspan="3">${pct(fx, 3)}</td></tr>
    </tbody></table>
    <h2>Titular</h2>
    <table><tbody><tr><th>Criador</th><td>${titular?.nombre || '—'}</td><th>REGA</th><td>${a.rega || titular?.rega || '—'}</td></tr>
      <tr><th>Municipio</th><td colspan="3">${a.municipio || titular?.municipio || '—'}${a.provincia ? ` (${a.provincia})` : ''}</td></tr></tbody></table>
    <h2>Genealogía (3 generaciones)</h2>
    <table><tbody>
      <tr>${celda('P', 'Padre')}${celda('PP', 'Abuelo paterno')}${celda('PPP', 'Bisabuelo')}</tr>
      <tr><td></td><td></td>${celda('PPM', 'Bisabuela')}</tr>
      <tr><td></td>${celda('PM', 'Abuela paterna')}${celda('PMP', 'Bisabuelo')}</tr>
      <tr><td></td><td></td>${celda('PMM', 'Bisabuela')}</tr>
      <tr>${celda('M', 'Madre')}${celda('MP', 'Abuelo materno')}${celda('MPP', 'Bisabuelo')}</tr>
      <tr><td></td><td></td>${celda('MPM', 'Bisabuela')}</tr>
      <tr><td></td>${celda('MM', 'Abuela materna')}${celda('MMP', 'Bisabuelo')}</tr>
      <tr><td></td><td></td>${celda('MMM', 'Bisabuela')}</tr>
    </tbody></table>
    <h2>Calificación morfológica</h2>
    ${ultimaCalificacion ? h`<p>${fecha(ultimaCalificacion.fecha)} · ${ultimaCalificacion.inspector_nombre} · Resultado: <strong>${ultimaCalificacion.resultado}</strong></p>`
      : h`<p>Sin calificación registrada.</p>`}
    <div class="doc-firmas"><div>Firma del titular</div><div>Firma y sello de la Dirección Técnica del Libro Genealógico</div></div>
    <p class="doc-pie">Documento generado por AlacantinApp a partir de los registros del Libro Genealógico. La referencia identifica de forma única el contenido certificado. Solo es válido con la firma de la Dirección Técnica.</p>`);
}

export function acta(a, c, titular) {
  const ev = evaluarConformidad({ sexo: a.sexo, variedad: a.variedad, pesoG: c.peso_g, regiones: c.regiones, defectos: c.defectos });
  const ref = `AC-${ESTANDAR.codigo}-${huella([c.id, a.id, c.resultado, c.fecha].join('|'))}`;
  imprimir(h`
    ${cabecera('Acta de calificación morfológica', ref)}
    <p><strong>Ejemplar:</strong> ${a.anilla} · ${sexoTexto(a.sexo)} · ${nombreVariedad(a.variedad)} · nacido el ${fecha(a.fecha_nacimiento)}<br>
      <strong>Titular:</strong> ${titular?.nombre || '—'} · REGA ${a.rega || '—'}<br>
      <strong>Inspector:</strong> ${c.inspector_nombre} · <strong>Fecha:</strong> ${fecha(c.fecha)}
      ${c.latitud ? h` · <strong>Lugar (GPS):</strong> ${Number(c.latitud).toFixed(5)}, ${Number(c.longitud).toFixed(5)}` : ''}</p>
    <h2>Conformidad con el Estándar por regiones</h2>
    <table><thead><tr><th>Región</th><th>Resultado</th><th>Observación</th></tr></thead><tbody>
      ${ESTANDAR.regiones.map(r => h`<tr><td>${r.nombre}</td><td>${c.regiones?.[r.id]?.conforme === false ? 'No conforme' : 'Conforme'}</td><td>${c.regiones?.[r.id]?.nota || ''}</td></tr>`)}
      <tr><td>Peso</td><td>${ev.pesoConforme === null ? 'No medido' : ev.pesoConforme ? 'Conforme' : 'Fuera de rango'}</td><td>${c.peso_g ? `${c.peso_g} g` : ''}</td></tr>
    </tbody></table>
    <h2>Defectos graves</h2>
    <p>${c.defectos?.length ? c.defectos.map(id => ESTANDAR.defectosGraves.find(d => d.id === id)?.texto).join(' · ') : 'No se observan.'}</p>
    <h2>Resultado: ${c.resultado}</h2>
    ${c.observaciones ? h`<p>${c.observaciones}</p>` : ''}
    <div class="doc-firmas"><div>Firma del inspector: ${c.inspector_nombre}</div><div>Enterado, el titular: ${titular?.nombre || ''}</div></div>
    <p class="doc-pie">Ficha de conformidad con el Estándar ${ESTANDAR.codigo} (rev. ${ESTANDAR.revision}). El acceso al Registro Definitivo exige resultado Apto, variedad oficial y edad mínima según las normas del Libro.</p>`);
}
