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

const cabecera = (titulo, ref, sub = `${CONFIG.club.nombre} · Libro Genealógico · Estándar ${ESTANDAR.codigo} (rev. ${ESTANDAR.revision})`) => h`
  <div class="doc-cab">
    <img src="./icons/logo.png" alt="" width="64" height="64">
    <div><h1>${titulo}</h1>
      <div>${sub}</div>
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

// ---------------------------------------------------------------------------
// Propuesta de programa de cría (borrador). Protocolo CNZ 2025, apdo. 3.1 n.
// Sigue el contenido del anexo I, parte 2, punto 1 del Reglamento (UE) 2016/1012,
// aplicado a las aves por el art. 26 del RD 45/2019. Las cifras y reglas salen de
// estandar.js y del Libro; lo que solo puede decidir el Club va marcado.
// ---------------------------------------------------------------------------
export function plantillaProgramaCria(d) {
  const R = REGLAS, E = ESTANDAR, CP = REGLAS.controlPuesta, RP = REGLAS.reproduccion;
  const n = (x, dec = 0) => (x === null || x === undefined || !Number.isFinite(x) ? '—' : x.toFixed(dec).replace('.', ','));
  const decidir = (texto) => h`<span class="a-decidir">A decidir por el Club: ${texto}</span>`;
  const r = d.resumen, g = r.genetica;
  const oficiales = E.variedades.filter(v => v.oficial), enProceso = E.variedades.filter(v => !v.oficial);
  const ref = `PC-${E.codigo}-${huella(JSON.stringify([r.corte, r.censo.total, g.nm, g.nf, d.calif.n, d.puesta.length]))}`;
  return h`
    ${cabecera('Propuesta de programa de cría de la raza Alacantina', ref)}
    <p class="doc-aviso"><strong>Borrador de trabajo</strong> generado por AlacantinApp con las reglas que la app aplica y los datos del Libro a ${fecha(r.corte)}. Lo revisan y completan la Junta y la Dirección Técnica; lo aprueba la autoridad competente (RD 45/2019, arts. 8 y 9). Estructura del anexo I, parte 2, punto 1 del Reglamento (UE) 2016/1012, aplicado a las aves por el art. 26 del RD 45/2019.</p>

    <h2>1. Finalidad del programa</h2>
    <p><strong>Conservación de la raza</strong>, con mejora de los caracteres del Estándar y de la aptitud de puesta sin perder variabilidad genética. Se propone programa de <em>conservación</em> porque el censo es pequeño (ver apartado 11) y la prioridad es mantener el tamaño efectivo y frenar la consanguinidad.</p>
    <p>${decidir('confirmar la finalidad (conservación, o conservación y mejora).')}</p>

    <h2>2. Nombre de la raza</h2>
    <p><strong>Alacantina</strong> (gallina alacantina), raza aviar autóctona de origen ${E.origen}. Estándar oficial <strong>${E.codigo}</strong>, revisión de ${E.revision}.</p>
    <p>Variedades del Estándar: ${oficiales.map(v => v.nombre).join(', ')}. En proceso de reconocimiento, con registro y seguimiento genealógico pero sin acceso al Registro Definitivo ni al de Méritos: ${enProceso.map(v => v.nombre).join(' y ')}.</p>

    <h2>3. Características de la raza y rasgos esenciales</h2>
    <p>${E.impresionGeneral}</p>
    <ul>
      <li><strong>Peso:</strong> gallo ${kg(E.peso.M.min)}–${kg(E.peso.M.max)}; gallina ${kg(E.peso.H.min)}–${kg(E.peso.H.max)}.</li>
      <li><strong>Huevo:</strong> cáscara ${E.huevo.cascara.toLowerCase()}, mínimo ${E.huevo.min} g, habitual ${E.huevo.min}–${E.huevo.habitualMax} g.</li>
      <li><strong>Defectos graves (descalifican):</strong> ${E.defectosGraves.map(x => x.texto.toLowerCase()).join('; ')}.</li>
    </ul>
    <p>La descripción completa por regiones y variedades es la del Estándar ${E.codigo}, que se adjunta como anexo.</p>

    <h2>4. Territorio</h2>
    <p>Explotaciones de los socios en España. Hoy hay ejemplares en ${d.provincias.length} provincia(s)${d.provincias.length ? h`: ${d.provincias.map(([p, x]) => `${p} (${x})`).join(', ')}` : ''}; ${r.territorio.municipios.length} municipio(s) y ${r.territorio.explotaciones} explotación(es) con REGA.</p>
    <p>${decidir('ámbito del programa y autoridad que lo aprueba: la comunidad autónoma con más reproductoras o, si el censo está repartido en tres o más y ninguna supera el 60 %, el Ministerio (RD 45/2019, art. 9).')}</p>

    <h2>5. Identificación de los animales</h2>
    <p>Cada reproductor lleva <strong>anilla cerrada</strong> de la Entente Europea suministrada por FESACOCUR, colocada al pollito: ${E.anilla.M} mm el gallo y ${E.anilla.H} mm la gallina. El código (E + año + diámetro + número) es único en el Libro; la app lo compone, lo valida y rechaza duplicados. Solo se inscriben animales anillados, criados en una explotación con su <strong>REGA</strong>, que es la identificación que exige la sanidad animal en las aves.</p>

    <h2>6. Registro de las genealogías</h2>
    <ul>
      <li>Cada alta anota padre y madre, que deben ser un gallo y una gallina inscritos y nacidos antes; la app impide ciclos y filiaciones imposibles.</li>
      <li>La paternidad se asegura con <strong>lotes de reproducción</strong> (un gallo con ${RP.gallinasPorGallo[0]}–${RP.gallinasPorGallo[1]} gallinas, con fecha de inicio) y una espera de ${RP.diasEsperaCambioGallo} días tras cambiar de gallo; la maternidad, con huevos identificados por gallina e incubados por separado desde el día ${RP.nacedora}.</li>
      <li>El Libro se guarda en una base de datos con historial de cambios (quién, cuándo y qué), copias completas y auditoría de coherencia.</li>
    </ul>

    <h2>7. Objetivos de selección y de cría</h2>
    <h3>Conservación</h3>
    <ul>
      <li><strong>Cría en familias</strong> (${E.familias.join(', ')}) con reposición de Gobe: de cada gallo se queda un hijo y de cada gallina una hija. El gallo nuevo sigue en la familia de su padre; las pollitas pasan a la siguiente, en círculo.</li>
      <li><strong>Consanguinidad</strong> de Wright a ${R.generacionesWright} generaciones en cada apareamiento: precaución desde ${n(R.fxPrecaucion * 100, 2)} % y alerta desde ${n(R.fxAlerta * 100, 1)} %.</li>
      <li>Seguimiento anual del <strong>tamaño efectivo</strong> (Ne demográfico y realizado) y de la consanguinidad media.</li>
      <li>Variedades como subpoblaciones cerradas: pureza de variedad a ${R.generacionesVariedad} generaciones.</li>
    </ul>
    <h3>Selección</h3>
    <ul>
      <li><strong>Morfología:</strong> calificación sobre 100 puntos en las 12 regiones del Estándar (${BAREMO.apartados.map(a => `${a.nombre.toLowerCase()} ${a.max}`).join(', ')}). Apto sin defectos graves y con ${R.puntosMinimosApto.H} puntos las gallinas y ${R.puntosMinimosApto.M} los gallos. Clases: ${BAREMO.clases.map(c => `${c.nombre} desde ${c.min}`).join(', ')}.</li>
      <li><strong>Puesta:</strong> dentro de cada familia, la madre del gallo de reposición es la gallina con más <em>masa de huevo</em> (porcentaje de puesta × peso medio), para no premiar solo la cantidad ni solo el tamaño.</li>
      <li><strong>Huevo para incubar:</strong> desde ${E.huevo.min} g y cáscara ${E.huevo.cascara.toLowerCase()}.</li>
    </ul>
    <p>${decidir(`ratificar el baremo (hoy «${BAREMO.estado}») y los mínimos de puntuación.`)}</p>

    <h2>8. Control de rendimientos y evaluación genética</h2>
    <p><strong>Control de puesta</strong> en ${CP.ciclos} campañas por temporada de ${CP.dias} días, entre febrero y junio, con cada huevo pesado y asignado a su gallina (jaula individual, ponedero trampa o RFID). Por gallina se calculan los huevos, el porcentaje de puesta, el peso medio (fiable desde ${CP.minHuevosPeso} huevos), la masa de huevo y los huevos aptos. También se anotan la fertilidad (miraje del día ${RP.miraje}) y el nacimiento (día ${RP.eclosion}) de cada madre.</p>
    <p>No se prevé evaluación genética (BLUP ni genómica): la selección se hace sobre el fenotipo propio y la familia.</p>

    <h2>9. Estructura del Libro Genealógico</h2>
    <ul>
      <li><strong>RF · ${E.secciones.RF}:</strong> animales con los que arranca el Libro. Los asigna la Dirección Técnica, con motivo anotado.</li>
      <li><strong>RA · ${E.secciones.RA}:</strong> animales de buena morfología sin genealogía completa. Los asigna la Dirección Técnica.</li>
      <li><strong>RN · ${E.secciones.RN}:</strong> pollitos anillados con padre y madre conocidos.</li>
      <li><strong>RD · ${E.secciones.RD}</strong> (sección principal): animal Apto, de variedad del Estándar, con ${R.edadMinimaRD_meses} meses cumplidos, padre y madre inscritos y explotación con REGA.</li>
      <li><strong>RM · ${E.secciones.RM}:</strong> reproductores del RF o el RD con al menos ${R.rm.H.puntos} puntos y ${R.rm.H.hijosRD} hijos en el RD (gallinas) o ${R.rm.M.puntos} puntos y ${R.rm.M.hijosRD} hijos (gallos), o con premio en exposición y la misma puntuación. Lo acuerda la administración del Libro.</li>
    </ul>

    <h2>10. Actividades encargadas a terceros</h2>
    <ul>
      <li>Anillas: FESACOCUR.</li>
      <li>Gestión informática del Libro: AlacantinApp, del Club; los datos se guardan en servidores de la Unión Europea (Frankfurt).</li>
      <li>${decidir('entidad científica que avale el programa y, si se hacen, laboratorio de ADN y banco de germoplasma.')}</li>
    </ul>

    <h2>11. Datos y resultados</h2>
    <p>Libro a ${fecha(r.corte)}${r.enCurso ? ' (año en curso)' : ''}.</p>
    <table><tbody>
      <tr><th>Censo vivo</th><td class="num">${r.censo.total} (${r.censo.M} gallos, ${r.censo.H} gallinas)</td></tr>
      <tr><th>Por sección</th><td class="num">${r.censo.secciones.filter(s => s.total).map(s => `${s.id} ${s.total}`).join(' · ') || '—'}</td></tr>
      <tr><th>Criadores · explotaciones con REGA</th><td class="num">${r.territorio.titulares} · ${r.territorio.explotaciones}</td></tr>
      <tr><th>Reproductores adultos ♂ / ♀</th><td class="num">${g.nm} / ${g.nf}</td></tr>
      <tr><th>Ne demográfico · Ne realizado</th><td class="num">${n(g.neDem, 1)} · ${g.neReal ? n(g.neReal.ne, 1) : '—'}</td></tr>
      <tr><th>Consanguinidad media</th><td class="num">${g.fxMedio == null ? '—' : pct(g.fxMedio, 2)}</td></tr>
      <tr><th>Con padre y madre registrados</th><td class="num">${g.conPadres == null ? '—' : pct(g.conPadres, 0)}</td></tr>
      <tr><th>Calificaciones (todas) · aptas · media</th><td class="num">${d.calif.n} · ${d.calif.aptos} · ${n(d.calif.media, 1)} puntos</td></tr>
      <tr><th>Material genético almacenado</th><td class="num">${d.germoplasma?.germoplasma ? `${d.germoplasma.germoplasma} muestra(s) de germoplasma, ${d.germoplasma.reconocido} en centros reconocidos` : 'ninguno'}</td></tr>
      ${d.situacion ? h`<tr><th>Situación (criterios CNZ para aves)</th><td class="num">${d.situacion.amenazada ? `amenazada, grado ${d.situacion.grado}` : 'no amenazada'}</td></tr>` : ''}
    </tbody></table>
    ${d.evolucion.length ? h`<h3>Evolución del censo</h3><table><thead><tr><th>Año</th><th class="num">Censo</th><th class="num">Nacidos</th><th class="num">Bajas</th><th class="num">Ne</th><th class="num">Fx medio</th></tr></thead><tbody>
      ${d.evolucion.map(f => h`<tr><td>${f.anio}${f.enCurso ? '*' : ''}</td><td class="num">${f.total}</td><td class="num">${f.nacidos}</td><td class="num">${f.bajas}</td><td class="num">${n(f.neDem, 1)}</td><td class="num">${f.fxMedio == null ? '—' : pct(f.fxMedio, 2)}</td></tr>`)}</tbody></table>` : ''}
    ${d.puesta.length ? h`<h3>Puesta</h3><table><thead><tr><th>Año</th><th class="num">Gallinas controladas</th><th class="num">Puesta</th><th class="num">Huevos pesados</th><th class="num">Peso medio</th><th class="num">Aptos</th></tr></thead><tbody>
      ${d.puesta.map(f => h`<tr><td>${f.anio}${f.enCurso ? '*' : ''}</td><td class="num">${f.gallinas}</td><td class="num">${f.puesta == null ? '—' : pct(f.puesta, 0)}</td><td class="num">${f.peso.n}</td><td class="num">${f.peso.media == null ? '—' : `${n(f.peso.media, 1)} g`}</td><td class="num">${f.aptos == null ? '—' : pct(f.aptos, 0)}</td></tr>`)}</tbody></table>` : ''}
    ${d.evolucion.some(f => f.enCurso) || d.puesta.some(f => f.enCurso) ? h`<p class="peq">* Año en curso.</p>` : ''}

    <h2>Anexos</h2>
    <ul><li>Estándar oficial ${E.codigo} (rev. ${E.revision}).</li><li>Reglamento interno del Libro y baremo de calificación.</li><li>Matriz de pedigrí (CSV) e informes de censo, de la app.</li></ul>`;
}
export const programaCria = (d) => imprimir(plantillaProgramaCria(d));

// ---------------------------------------------------------------------------
// Cuentas del año de la tesorería, para la asamblea. Los datos llegan ya abiertos
// (descifrados) desde la tesorería; al terminar de imprimir se borran de la página.
// ---------------------------------------------------------------------------
export function plantillaCuentas(c) {
  const e = (n) => (n === null || n === undefined ? '—' : `${Number(n).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`);
  const ref = `CU-${c.anio}-${huella(JSON.stringify([c.ingresos, c.gastos, c.banco.inicial, c.banco.final]))}`;
  const conAnterior = c.anterior.n > 0;
  const ingresos = c.filas.filter(f => f.ingresos || f.anterior.ingresos || f.previsto?.ingresos), gastos = c.filas.filter(f => f.gastos || f.anterior.gastos || f.previsto?.gastos);
  const conPres = Boolean(c.presupuesto);
  const tabla = (titulo, lista, k, total, totalAnt, sinClas) => h`<table><thead><tr><th>${titulo}</th>${conPres ? h`<th class="num">Presupuesto</th>` : ''}<th class="num">${c.anio}</th>${conAnterior ? h`<th class="num">${c.anio - 1}</th>` : ''}</tr></thead><tbody>
    ${lista.map(f => h`<tr><td>${f.partida.nombre}</td>${conPres ? h`<td class="num">${e(f.previsto?.[k] || 0)}</td>` : ''}<td class="num">${e(f[k])}</td>${conAnterior ? h`<td class="num">${e(f.anterior[k])}</td>` : ''}</tr>`)}
    ${sinClas ? h`<tr><td><em>Sin clasificar</em></td>${conPres ? h`<td></td>` : ''}<td class="num">${e(sinClas)}</td>${conAnterior ? h`<td></td>` : ''}</tr>` : ''}
    <tr><th>Total</th>${conPres ? h`<th class="num">${e(c.presupuesto[k])}</th>` : ''}<th class="num">${e(total)}</th>${conAnterior ? h`<th class="num">${e(totalAnt)}</th>` : ''}</tr></tbody></table>`;
  return h`
    ${cabecera(`Cuentas del ejercicio ${c.anio}`, ref, `${CONFIG.club.nombre} · Tesorería`)}
    <p>${c.cuenta ? `Cuenta ${String(c.cuenta).replace(/(.{4})/g, '$1 ').trim()}. ` : ''}Del 1 de enero al 31 de diciembre de ${c.anio}${c.banco.hasta && c.banco.hasta < `${c.anio}-12-31` ? ` (movimientos hasta el ${fecha(c.banco.hasta)})` : ''}.</p>
    <h2>Resumen</h2>
    <table><tbody>
      <tr><td>Saldo en el banco al empezar el año</td><td class="num">${e(c.banco.inicial)}</td></tr>
      <tr><td>Ingresos</td><td class="num">${e(c.ingresos)}</td></tr>
      <tr><td>Gastos</td><td class="num">${e(c.gastos)}</td></tr>
      <tr><th>Resultado del ejercicio</th><th class="num">${e(c.resultado)}</th></tr>
      <tr><td>Saldo en el banco al acabar${c.banco.hasta && c.banco.hasta < `${c.anio}-12-31` ? ` (a ${fecha(c.banco.hasta)})` : ' el año'}</td><td class="num">${e(c.banco.final)}</td></tr>
      ${c.efectivo.n ? h`<tr><td>Cobros y pagos en efectivo del año (no pasan por el banco)</td><td class="num">${e(c.efectivo.neto)}</td></tr>` : ''}
      ${c.caja !== null && c.caja !== undefined ? h`<tr><td>Dinero en caja al acabar el año</td><td class="num">${e(c.caja)}</td></tr>` : ''}
      ${c.inventario ? h`<tr><td>Bienes del inventario (valor de compra)</td><td class="num">${e(c.inventario)}</td></tr>` : ''}
      ${c.justificantes?.total ? h`<tr><td>Gastos con factura o justificante</td><td class="num">${c.justificantes.total - c.justificantes.sin} de ${c.justificantes.total}</td></tr>` : ''}
    </tbody></table>
    ${c.banco.cuadra === false || c.huecos.length ? h`<p class="doc-aviso"><strong>Atención:</strong> ${c.huecos.length ? c.huecos.map(x => x.texto).join(' ') : 'el saldo final no coincide con el inicial más los movimientos del banco: falta algún movimiento por importar.'}</p>` : ''}
    ${conPres ? h`<p class="peq">Presupuesto ${c.anio}${c.presupuesto.aprobado ? `, aprobado en asamblea el ${fecha(c.presupuesto.aprobado)}` : ''}: ingresos ${e(c.presupuesto.ingresos)} y gastos ${e(c.presupuesto.gastos)}.</p>` : ''}
    <h2>Ingresos</h2>${tabla('Partida', ingresos, 'ingresos', c.ingresos, c.anterior.ingresos, c.sinClasificar.ingresos)}
    <h2>Gastos</h2>${tabla('Partida', gastos, 'gastos', c.gastos, c.anterior.gastos, c.sinClasificar.gastos)}
    <h2>Cuotas ${c.anio}</h2>
    <p>${c.cuotas.socios} socio(s) con cuota: ${c.cuotas.pagadas} pagada(s) y ${c.cuotas.pendientes} pendiente(s). Recaudado ${e(c.cuotas.recaudado)}${c.cuotas.pendiente ? `; por cobrar ${e(c.cuotas.pendiente)}` : ''}.</p>
    <div class="doc-firmas"><div>Tesorería</div><div>Visto bueno de la Presidencia</div></div>
    <p class="doc-pie">Documento generado por AlacantinApp a partir del extracto bancario y de los movimientos anotados por la tesorería.</p>`;
}
export function cuentas(c) {
  imprimir(plantillaCuentas(c));
  window.addEventListener('afterprint', () => pintar('#impresion', ''), { once: true });
}

// ---------------------------------------------------------------------------
// Orden de domiciliación de adeudo directo SEPA (mandato), con los datos del Club
// y del socio ya puestos, para que la firme. El texto es el que fija el esquema SEPA.
// ---------------------------------------------------------------------------
export function plantillaMandato({ socio, acreedor }) {
  const linea = (et, v) => h`<tr><th>${et}</th><td>${v || h`<span class="doc-hueco">&nbsp;</span>`}</td></tr>`;
  const iban = String(socio.iban || '').replace(/\s+/g, '').replace(/(.{4})/g, '$1 ').trim();
  return h`
    ${cabecera('Orden de domiciliación de adeudo directo SEPA', socio.mandato_ref || '', 'SEPA Direct Debit Mandate')}
    <table class="doc-mandato"><tbody>
      ${linea('Referencia de la orden / Mandate reference', socio.mandato_ref)}
      ${linea('Identificador del acreedor / Creditor Identifier', acreedor.id)}
      ${linea('Nombre del acreedor / Creditor’s name', acreedor.nombre)}
      ${linea('Dirección / Address', acreedor.direccion)}
      ${linea('Código postal - Población - Provincia', acreedor.poblacion)}
      ${linea('País / Country', 'España')}
    </tbody></table>
    <p class="doc-legal">Mediante la firma de esta orden de domiciliación, el deudor autoriza (A) al acreedor a enviar instrucciones a la entidad del deudor para adeudar su cuenta y (B) a la entidad para efectuar los adeudos en su cuenta siguiendo las instrucciones del acreedor. Como parte de sus derechos, el deudor está legitimado al reembolso por su entidad en los términos y condiciones del contrato suscrito con la misma. La solicitud de reembolso deberá efectuarse dentro de las ocho semanas que siguen a la fecha de adeudo en cuenta. Puede obtener información adicional sobre sus derechos en su entidad financiera.</p>
    <p class="doc-legal"><em>By signing this mandate form, you authorise (A) the Creditor to send instructions to your bank to debit your account and (B) your bank to debit your account in accordance with the instructions from the Creditor. As part of your rights, you are entitled to a refund from your bank under the terms and conditions of your agreement with your bank. A refund must be claimed within eight weeks starting from the date on which your account was debited. Your rights are explained in a statement that you can obtain from your bank.</em></p>
    <table class="doc-mandato"><tbody>
      ${linea('Nombre del deudor (titular de la cuenta) / Debtor', [socio.nombre, socio.apellidos].filter(Boolean).join(' '))}
      ${linea('Dirección del deudor / Address', socio.direccion)}
      ${linea('Código postal - Población - Provincia', [socio.cp, socio.municipio, socio.provincia].filter(Boolean).join(' '))}
      ${linea('País del deudor / Country', 'España')}
      ${linea('Swift BIC (8 u 11 posiciones)', socio.bic)}
      ${linea('Número de cuenta - IBAN / Account number', iban)}
      ${linea('Tipo de pago / Type of payment', 'Pago recurrente / Recurrent payment (cuota anual del Club)')}
      ${linea('Fecha - Localidad / Date - location', '')}
    </tbody></table>
    <div class="doc-firmas"><div>Firma del deudor / Signature of the debtor</div><div></div></div>
    <p class="doc-pie">Todos los campos han de ser cumplimentados obligatoriamente. Una vez firmada, esta orden de domiciliación debe ser enviada al acreedor para su custodia. / All gaps are mandatory. Once this mandate has been signed must be sent to creditor for storage.</p>`;
}
export function mandato(d) {
  imprimir(plantillaMandato(d));
  window.addEventListener('afterprint', () => pintar('#impresion', ''), { once: true });
}

// Presupuesto del año, para aprobarlo en la asamblea (con la ejecución si ya hay datos)
export function plantillaPresupuesto(x) {
  const e = (n) => `${Number(n || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
  const conReal = x.total.real.ingresos || x.total.real.gastos;
  const conAnt = x.filas.some(f => f.anterior.ingresos || f.anterior.gastos);
  const ref = `PR-${x.anio}-${huella(JSON.stringify(x.presupuesto?.lineas || {}))}`;
  const tabla = (k, titulo) => { const filas = x.filas.filter(f => f.previsto[k] || (conReal && f.real[k]));
    return h`<h2>${titulo}</h2><table><thead><tr><th>Partida</th><th class="num">Presupuesto ${x.anio}</th>${conReal ? h`<th class="num">Real hasta hoy</th>` : ''}${conAnt ? h`<th class="num">Real ${x.anio - 1}</th>` : ''}</tr></thead><tbody>
      ${filas.map(f => h`<tr><td>${f.partida.nombre}</td><td class="num">${e(f.previsto[k])}</td>${conReal ? h`<td class="num">${e(f.real[k])}</td>` : ''}${conAnt ? h`<td class="num">${e(f.anterior[k])}</td>` : ''}</tr>`)}
      <tr><th>Total</th><th class="num">${e(x.total.previsto[k])}</th>${conReal ? h`<th class="num">${e(x.total.real[k])}</th>` : ''}${conAnt ? h`<th class="num">${e(filas.reduce((s, f) => s + f.anterior[k], 0))}</th>` : ''}</tr></tbody></table>`; };
  return h`
    ${cabecera(`Presupuesto ${x.anio}`, ref, `${CONFIG.club.nombre} · Tesorería`)}
    <p>${x.presupuesto?.aprobado ? `Aprobado en asamblea el ${fecha(x.presupuesto.aprobado)}.` : 'Propuesta para la asamblea.'}</p>
    ${tabla('ingresos', 'Ingresos previstos')}${tabla('gastos', 'Gastos previstos')}
    <table><tbody><tr><th>Resultado previsto</th><th class="num">${e(x.total.previsto.ingresos - x.total.previsto.gastos)}</th></tr></tbody></table>
    ${x.presupuesto?.notas ? h`<p>${x.presupuesto.notas}</p>` : ''}
    <div class="doc-firmas"><div>Tesorería</div><div>Visto bueno de la Presidencia</div></div>`;
}
export function presupuestoDoc(x) {
  imprimir(plantillaPresupuesto(x));
  window.addEventListener('afterprint', () => pintar('#impresion', ''), { once: true });
}

// Inventario de bienes del Club a una fecha (LO 1/2002, art. 14), para el libro de la asociación
export function plantillaInventario(x) {
  const e = (n) => (n === null || n === undefined ? '—' : `${Number(n).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`);
  const estado = { bueno: 'Bueno', regular: 'Regular', malo: 'Malo' };
  const ref = `IN-${x.dia}-${huella(JSON.stringify(x.bienes.map(b => [b.numero, b.cantidad, b.valor])))}`;
  return h`
    ${cabecera(`Inventario de bienes a ${fecha(x.dia)}`, ref, `${CONFIG.club.nombre} · Tesorería`)}
    ${x.bienes.length ? h`<table><thead><tr><th>Nº</th><th>Bien</th><th>Tipo</th><th class="num">Cant.</th><th>Alta</th><th>Ubicación</th><th>Estado</th><th class="num">Valor</th></tr></thead><tbody>
      ${x.bienes.map(b => h`<tr><td>${b.numero}</td><td>${b.nombre}${b.notas ? h`<br><span class="peq">${b.notas}</span>` : ''}</td><td>${b.categoria}</td><td class="num">${b.cantidad}</td><td>${b.fecha_alta ? fecha(b.fecha_alta) : '—'}</td><td>${b.ubicacion || '—'}</td><td>${estado[b.estado] || b.estado}</td><td class="num">${e(b.valor)}</td></tr>`)}
      <tr><th colspan="7">Total (valor de compra${x.sinValor ? `; ${x.sinValor} bien(es) sin valor conocido` : ''})</th><th class="num">${e(x.total)}</th></tr></tbody></table>` : h`<p>El Club no tiene bienes anotados a esta fecha.</p>`}
    ${x.porCategoria.length > 1 ? h`<h2>Por tipo</h2><table><tbody>${x.porCategoria.map(c => h`<tr><td>${c.categoria}</td><td class="num">${c.n}</td><td class="num">${e(c.valor)}</td></tr>`)}</tbody></table>` : ''}
    ${x.bajas.length ? h`<h2>Bajas en ${x.dia.slice(0, 4)}</h2><table><thead><tr><th>Nº</th><th>Bien</th><th>Fecha</th><th>Motivo</th></tr></thead><tbody>
      ${x.bajas.map(b => h`<tr><td>${b.numero}</td><td>${b.nombre}</td><td>${fecha(b.fecha_baja)}</td><td>${b.motivo_baja || ''}</td></tr>`)}</tbody></table>` : ''}
    <div class="doc-firmas"><div>Tesorería</div><div>Visto bueno de la Presidencia</div></div>
    <p class="doc-pie">Inventario de bienes de la asociación (Ley Orgánica 1/2002, de 22 de marzo, art. 14). Generado por AlacantinApp.</p>`;
}
export function inventarioDoc(x) {
  imprimir(plantillaInventario(x));
  window.addEventListener('afterprint', () => pintar('#impresion', ''), { once: true });
}

// Relación de asociados (LO 1/2002, art. 14): nº, nombre, DNI, alta y baja de cada socio
export function plantillaRelacionSocios({ titulo, socios, periodos, dia = new Date().toISOString().slice(0, 10) }) {
  const ref = `RS-${dia}-${huella(JSON.stringify(socios.map(s => [s.numero, s.fecha_alta, s.fecha_baja])))}`;
  const f = (x) => (x ? fecha(x) : '—');
  return h`
    ${cabecera(`Relación de asociados · ${titulo}`, ref, `${CONFIG.club.nombre} · Tesorería`)}
    <p>A ${fecha(dia)}. ${socios.length} persona(s).</p>
    <table><thead><tr><th>Nº</th><th>Nombre y apellidos</th><th>DNI / NIE</th><th>Alta</th><th>Baja</th></tr></thead><tbody>
      ${socios.map(s => { const ps = periodos(s); return h`<tr><td>${s.numero || ''}</td><td>${[s.nombre, s.apellidos].filter(Boolean).join(' ')}</td><td>${s.dni || ''}</td>
        <td>${ps.map((p, i) => h`${i ? h`<br>` : ''}${f(p.alta)}`)}</td><td>${ps.map((p, i) => h`${i ? h`<br>` : ''}${p.baja ? `${f(p.baja)}${p.motivo ? ` (${p.motivo})` : ''}` : ''}`)}</td></tr>`; })}
    </tbody></table>
    <div class="doc-firmas"><div>Secretaría / Tesorería</div><div>Visto bueno de la Presidencia</div></div>
    <p class="doc-pie">Relación de asociados (Ley Orgánica 1/2002, de 22 de marzo, art. 14). Contiene datos personales: guárdala en lugar seguro y destrúyela cuando no haga falta.</p>`;
}
export function relacionSocios(d) {
  imprimir(plantillaRelacionSocios(d));
  window.addEventListener('afterprint', () => pintar('#impresion', ''), { once: true });
}

// Hoja con el código de recuperación de la tesorería, para guardarla en sobre cerrado
export function codigoRecuperacionDoc(codigo) {
  imprimir(h`${cabecera('Código de recuperación de la tesorería', new Date().toLocaleDateString('es-ES'), `${CONFIG.club.nombre} · Tesorería`)}
    <p>Este código abre la tesorería de AlacantinApp si se olvida la contraseña de tesorería. Guárdalo en sobre cerrado, en manos de la Presidencia o la Secretaría. Si se crea un código nuevo, este deja de valer.</p>
    <p style="font-size:20pt;font-family:monospace;letter-spacing:.08em;text-align:center;border:2px solid #000;padding:12pt">${codigo}</p>
    <p class="doc-pie">Quien tenga este código y una cuenta con el rol de tesorería puede leer todos los datos de la tesorería.</p>`);
  window.addEventListener('afterprint', () => pintar('#impresion', ''), { once: true });
}
