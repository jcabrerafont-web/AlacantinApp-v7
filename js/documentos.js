// ============================================================================
// Documentos imprimibles (certificado genealógico y acta de calificación).
// Se maquetan en #impresion y se imprimen con el diálogo del sistema
// ("Guardar como PDF"). Sin ventanas emergentes ni librerías externas.
// ============================================================================
import { ESTANDAR, REGLAS, BAREMO, anillaLegible, parsearAnilla, variedadPorId, nombreVariedad, sexoTexto, nombreClase, pesoConforme } from './estandar.js';
import { CONFIG } from './config.js';
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
      <div>${CONFIG.club.nombre} · Libro Genealógico · Estándar ${ESTANDAR.codigo} (rev. ${ESTANDAR.revision})</div>
      <div>Referencia: <strong>${ref}</strong> · Emitido el ${new Date().toLocaleDateString('es-ES')}</div></div>
  </div>`;

function imprimir(plantilla) {
  pintar('#impresion', plantilla);
  setTimeout(() => window.print(), 50);
}

// Certificado zootécnico de animal reproductor de raza pura.
// Las aves se rigen por el art. 26 del RD 45/2019; el contenido sigue, por analogía,
// el anexo V, parte 2, capítulo I del Reglamento (UE) 2016/1012 (letras a–o).
export function certificado(a, { idx, titular, criador, ultimaCalificacion, rendimiento }) {
  const anc = new Map(ancestros(a.id, idx, 3).map(x => [x.ruta, idx.get(x.id)]));
  const celda = (ruta, rol) => {
    const x = anc.get(ruta);
    return x ? h`<td><strong>${x.anilla}</strong>${x.nombre ? h` · ${x.nombre}` : ''}<br><small>${rol} · ${nombreVariedad(x.variedad)} · sección ${x.seccion}</small></td>`
      : h`<td><small>${rol}: no registrado</small></td>`;
  };
  const fx = fxAnimal(a, idx);
  const pa = parsearAnilla(a.anilla);
  const persona = (p, extra = {}) => p ? h`${p.nombre || '—'}${p.email ? h`<br><small>${p.email}</small>` : ''}<br><small>${[extra.rega || p.rega ? `REGA ${extra.rega || p.rega}` : '', extra.municipio || p.municipio, extra.provincia || p.provincia].filter(Boolean).join(' · ')}</small>` : '—';
  const ref = `CZ-${ESTANDAR.codigo}-${String(a.anilla).replace(/\W/g, '')}-${huella([a.id, a.anilla, a.seccion, a.usuario_id, a.padre_id, a.madre_id, ultimaCalificacion?.id || ''].join('|'))}`;
  const coma = (n, d = 1) => (n === null || n === undefined || !Number.isFinite(Number(n)) ? '—' : Number(n).toFixed(d).replace('.', ','));
  imprimir(h`
    ${cabecera('Certificado zootécnico · Animal reproductor de raza pura', ref)}
    <p class="peq">Especie: <em>Gallus gallus domesticus</em> (gallina) · Expedido conforme al art. 26 del Real Decreto 45/2019 y, por analogía, al anexo V del Reglamento (UE) 2016/1012.
      Sociedad expedidora: <strong>${CONFIG.club.nombre}</strong> · ${location.origin}</p>
    <h2>Ejemplar</h2>
    <table><tbody>
      <tr><th>Libro genealógico</th><td>Libro Genealógico de la Gallina Alacantina</td><th>Sección</th><td>${a.seccion} · ${ESTANDAR.secciones[a.seccion] || ''}</td></tr>
      <tr><th>Raza</th><td>Alacantina · ${nombreVariedad(a.variedad)}${variedadPorId(a.variedad)?.oficial ? '' : ' (variedad en reconocimiento)'}</td><th>Sexo</th><td>${sexoTexto(a.sexo)}</td></tr>
      <tr><th>Nº en el Libro</th><td>${a.anilla}</td><th>Identificación</th><td>Anilla cerrada EE (FESACOCUR) ${anillaLegible(a.anilla)} · ${pa?.diametro ?? '—'} mm${a.rfid ? h`<br><small>Chip ${a.rfid}</small>` : ''}</td></tr>
      <tr><th>Nacimiento</th><td>${fecha(a.fecha_nacimiento)} · ${pa ? 'España' : '—'}</td><th>Nombre</th><td>${a.nombre || '—'}</td></tr>
    </tbody></table>
    <table><tbody>
      <tr><th>Criador (lugar de nacimiento)</th><td>${persona(criador || titular, criador ? {} : a)}</td>
          <th>Propietario</th><td>${persona(titular, a)}</td></tr>
    </tbody></table>
    <h2>Genealogía</h2>
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
    <h2>Resultados de control y evaluación</h2>
    <table><tbody>
      <tr><th>Calificación morfológica</th><td>${ultimaCalificacion ? h`${fecha(ultimaCalificacion.fecha)} · <strong>${coma(ultimaCalificacion.total)} puntos · ${ultimaCalificacion.clase} (${nombreClase(ultimaCalificacion.clase)})</strong> · ${ultimaCalificacion.resultado} · inspector ${ultimaCalificacion.inspector_nombre}` : 'Sin calificación registrada'}</td></tr>
      <tr><th>Peso</th><td>${kg(a.peso_g)}</td></tr>
      ${a.sexo === 'H' ? h`<tr><th>Control de puesta</th><td>${rendimiento?.n ? `${rendimiento.etiqueta}: ${rendimiento.n} huevos · puesta ${Math.round(100 * rendimiento.puesta)} % · peso medio ${coma(rendimiento.media)} g · masa ${coma(rendimiento.masa)} g/día` : 'Sin campañas de control registradas'}</td></tr>` : ''}
      <tr><th>Consanguinidad</th><td>${pct(fx, 3)} (Wright, 5 generaciones)</td></tr>
      <tr><th>Defectos genéticos conocidos</th><td>Ninguno registrado</td></tr>
    </tbody></table>
    <div class="doc-firmas">
      <div>Expedido en ______________________, a ${new Date().toLocaleDateString('es-ES')}</div>
      <div>Nombre, cargo y firma de la persona autorizada<br>(Dirección Técnica del Libro Genealógico)</div>
    </div>
    <p class="doc-pie">Generado por AlacantinApp a partir de los registros del Libro Genealógico. La referencia identifica de forma única el contenido certificado; solo es válido con la firma de la persona autorizada por el Club.</p>`);
}

export function acta(a, c, titular) {
  const ref = `AC-${ESTANDAR.codigo}-${huella([c.id, a.id, c.total, c.clase, c.resultado, c.fecha].join('|'))}`;
  const pc = c.peso_conforme ?? pesoConforme(a.sexo, c.peso_g);
  const num = (n) => (n === null || n === undefined ? '—' : String(n).replace('.', ','));
  imprimir(h`
    ${cabecera('Acta de calificación morfológica', ref)}
    <p><strong>Ejemplar:</strong> ${a.anilla} · ${sexoTexto(a.sexo)} · ${nombreVariedad(a.variedad)} · nacido el ${fecha(a.fecha_nacimiento)}<br>
      <strong>Titular:</strong> ${titular?.nombre || '—'} · REGA ${a.rega || '—'}<br>
      <strong>Inspector:</strong> ${c.inspector_nombre} · <strong>Fecha:</strong> ${fecha(c.fecha)}
      ${c.latitud ? h` · <strong>Lugar (GPS):</strong> ${Number(c.latitud).toFixed(5)}, ${Number(c.longitud).toFixed(5)}` : ''}</p>
    <h2>Valoración morfológica (100 puntos)</h2>
    <table><thead><tr><th>Región</th><th class="num">Máx.</th><th class="num">Puntos</th></tr></thead><tbody>
      ${BAREMO.apartados.map(x => h`<tr><td>${x.nombre}</td><td class="num">${x.max}</td><td class="num">${num(c.puntos?.[x.id])}</td></tr>`)}
      <tr><th>Total</th><th class="num">100</th><th class="num">${num(c.total)}</th></tr>
    </tbody></table>
    <p><strong>Peso en báscula:</strong> ${c.peso_g ? `${c.peso_g} g` : 'no medido'} · Estándar ${sexoTexto(a.sexo).toLowerCase()}: ${ESTANDAR.peso[a.sexo]?.min}–${ESTANDAR.peso[a.sexo]?.max} g${pc === null || pc === undefined ? '' : h` · <strong>${pc ? 'conforme' : 'fuera de rango'}</strong>`}</p>
    <h2>Defectos descalificantes</h2>
    <p>${c.defectos?.length ? c.defectos.map(id => ESTANDAR.defectosGraves.find(d => d.id === id)?.texto).join(' · ') : 'No se observan.'}</p>
    <h2>Clase: ${c.clase} · ${nombreClase(c.clase)} — Resultado: ${c.resultado}</h2>
    ${c.observaciones ? h`<p>${c.observaciones}</p>` : ''}
    <div class="doc-firmas"><div>Firma del inspector: ${c.inspector_nombre}</div><div>Enterado, el titular: ${titular?.nombre || ''}</div></div>
    <p class="doc-pie">${BAREMO.fuente}. El peso se registra y se contrasta con el Estándar, pero no puntúa. Clases: ${BAREMO.clases.map(x => `${x.id} ≥ ${x.min}`).join(', ')}; un defecto descalificante supone la descalificación. Apto con ${REGLAS.puntosMinimosApto.H} puntos o más las gallinas y ${REGLAS.puntosMinimosApto.M} los gallos, sin descalificación. El acceso al Registro Definitivo exige además variedad oficial y un año de edad.</p>`);
}

// Acta anual de cierre censal (Libro completo) o resumen anual del aviario (criador).
// La misma plantilla se ve en pantalla y se imprime.
export function plantillaActaAnual(r) {
  const libro = r.ambito === 'libro';
  const n = (x, d = 0) => (x === null || x === undefined || !Number.isFinite(x) ? '—' : x.toFixed(d).replace('.', ','));
  const ref = `CC-${ESTANDAR.codigo}-${r.anio}-${huella(JSON.stringify([r.corte, r.censo, r.movimientos, r.puesta, r.reproduccion, r.perfil?.id || '']))}`;
  const tabla = (titulo, filas) => h`<table><thead><tr><th>${titulo}</th><th class="num">Gallos</th><th class="num">Gallinas</th><th class="num">Total</th></tr></thead><tbody>
    ${filas.map(f => h`<tr><td>${f.nombre}</td><td class="num">${f.M}</td><td class="num">${f.H}</td><td class="num">${f.total}</td></tr>`)}
    <tr><th>Total</th><th class="num">${r.censo.M}</th><th class="num">${r.censo.H}</th><th class="num">${r.censo.total}</th></tr></tbody></table>`;
  const m = r.movimientos, g = r.genetica, rp = r.reproduccion, pu = r.puesta;
  return h`
    ${cabecera(libro ? `Acta de cierre censal ${r.anio}` : `Resumen anual ${r.anio} del aviario`, ref)}
    <p>${libro ? 'Libro Genealógico de la raza Gallina Alacantina, todas las explotaciones.' : h`Titular: <strong>${r.perfil?.nombre || r.perfil?.email || ''}</strong>${r.perfil?.numero_socio ? ` · socio nº ${r.perfil.numero_socio}` : ''} · REGA ${r.perfil?.rega || '—'}${r.perfil?.municipio ? ` · ${r.perfil.municipio}` : ''}`}
      Censo a <strong>${fecha(r.corte)}</strong>${r.enCurso ? ' (año en curso: datos a la fecha de emisión)' : ''}; movimientos del 1 de enero al ${fecha(r.corte)}.</p>

    <h2>1. Censo de ejemplares vivos a ${fecha(r.corte)}</h2>
    <div class="doc-col2">${tabla('Sección del Libro', r.censo.secciones)}${tabla('Tramo de edad', r.censo.edades)}</div>
    ${tabla('Variedad', r.censo.variedades)}
    <p class="doc-nota">La sección es la actual de cada ejemplar. El tramo de edad se calcula a la fecha de corte.</p>

    <h2>2. Movimientos del año</h2>
    <table><tbody>
      <tr><th>Nacimientos registrados</th><td>${m.nacidos.total} (${m.nacidos.M} ♂ · ${m.nacidos.H} ♀)</td></tr>
      <tr><th>Bajas</th><td>${m.bajas}${m.bajas ? ` · ${Object.entries(m.causas).map(([k, v]) => `${k}: ${v}`).join(' · ')}` : ''}</td></tr>
      <tr><th>Calificaciones morfológicas</th><td>${m.calificaciones} (${m.ejemplaresCalificados} ejemplares) · Apto ${m.aptos} · ${Object.entries(m.porClase).map(([k, v]) => `${k} ${v}`).join(' · ')}</td></tr>
      <tr><th>Inscripciones en el Registro de Méritos</th><td>${m.rm}</td></tr>
      <tr><th>Solicitudes de inspección</th><td>${m.solicitudes} (visitas realizadas: ${m.visitas})</td></tr>
    </tbody></table>

    <h2>3. Variabilidad genética</h2>
    <table><tbody>
      <tr><th>Reproductores adultos</th><td>gallos: ${g.nm} · gallinas: ${g.nf}</td></tr>
      <tr><th>Tamaño efectivo demográfico (4·Nm·Nf / (Nm+Nf))</th><td>${n(g.neDem, 1)}</td></tr>
      <tr><th>Tamaño efectivo realizado (ΔF individual)</th><td>${g.neReal ? `${Number.isFinite(g.neReal.ne) ? n(g.neReal.ne, 1) : '∞'} (n = ${g.neReal.n})` : '— (pedigrí insuficiente)'}</td></tr>
      <tr><th>Consanguinidad media (Wright, ${REGLAS.generacionesWright} generaciones)</th><td>${g.fxMedio === null ? '—' : pct(g.fxMedio, 2)}</td></tr>
      <tr><th>Generaciones equivalentes conocidas (media)</th><td>${n(g.geMedio, 2)}</td></tr>
      <tr><th>Ejemplares con padre y madre registrados</th><td>${g.conPadres === null ? '—' : pct(g.conPadres, 0)}</td></tr>
    </tbody></table>

    <h2>4. Reproducción e incubación</h2>
    <table><tbody>
      <tr><th>Lotes de reproducción formados</th><td>${rp.lotes} (gallos: ${rp.gallos})</td></tr>
      <tr><th>Incubaciones</th><td>${rp.incubaciones} · ${rp.puestos} huevos · ${rp.nacidos} nacidos</td></tr>
      <tr><th>Fertilidad (fértiles ÷ huevos)</th><td>${rp.fertilidad === null ? '—' : pct(rp.fertilidad, 0)}</td></tr>
      <tr><th>Nacimiento (nacidos ÷ fértiles)</th><td>${rp.nacimiento === null ? '—' : pct(rp.nacimiento, 0)}</td></tr>
    </tbody></table>

    <h2>5. Control de puesta</h2>
    <table><tbody>
      <tr><th>Campañas de control</th><td>${pu.campanas}</td></tr>
      <tr><th>Huevos pesados</th><td>${pu.huevos} de ${pu.gallinas} gallinas</td></tr>
      <tr><th>Peso medio / máximo</th><td>${pu.pesoMedio === null ? '—' : `${n(pu.pesoMedio, 1)} g / ${pu.pesoMax} g`}</td></tr>
      <tr><th>Aptos para incubar (desde ${ESTANDAR.huevo.min} g, cáscara ${ESTANDAR.huevo.cascara.toLowerCase()})</th><td>${pu.huevos ? `${pu.aptos} (${pct(pu.aptos / pu.huevos, 0)})` : '—'}</td></tr>
    </tbody></table>

    ${libro ? h`<h2>6. Criadores y distribución</h2>
      <p>${r.territorio.titulares} criadores titulares · ${r.territorio.explotaciones} explotaciones con REGA.</p>
      <table><thead><tr><th>Municipio</th><th class="num">Ejemplares</th></tr></thead><tbody>
        ${r.territorio.municipios.map(([k, v]) => h`<tr><td>${k}</td><td class="num">${v}</td></tr>`)}</tbody></table>` : ''}

    <h2>${libro ? '7' : '6'}. Calidad de los datos</h2>
    <p>Auditoría a la fecha de emisión: <strong>${r.calidad.errores} errores</strong> y ${r.calidad.avisos} avisos pendientes de revisar${r.calidad.errores ? ' (ver Auditoría del Libro en la app)' : ''}.</p>

    ${libro ? h`<div class="doc-firmas doc-firmas-3"><div>El/La Director/a Técnico/a del Libro</div><div>El/La Secretario/a</div><div>Vº Bº El/La Presidente/a</div></div>`
      : h`<div class="doc-firmas"><div>El/La titular: ${r.perfil?.nombre || ''}</div><div>Recibido, la Dirección Técnica</div></div>`}
    <p class="doc-pie">Datos del Libro Genealógico gestionado con AlacantinApp ${libro ? '(todas las explotaciones)' : '(aviario del titular)'}. Base normativa: RD 45/2019, arts. 14 y 26; Protocolo CNZ de 5/6/2025, apdo. 3.1 f, j y l (censos, criadores, Ne y endogamia). El código de referencia cambia si cambia cualquier dato del acta.</p>`;
}
export const actaAnual = (r) => imprimir(plantillaActaAnual(r));
