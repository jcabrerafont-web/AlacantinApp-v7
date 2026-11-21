// Informes demográficos y genéticos (datos del Protocolo CNZ 5/6/2025, apdo. 3.1 f, j, l):
// censo por sexo y edad, criadores y distribución, tamaño efectivo y endogamia.
import * as datos from '../datos.js';
import { CONFIG } from '../config.js';
import { esAuditor } from '../auth.js';
import { ESTANDAR, REGLAS, tramoEdad, nombreVariedad } from '../estandar.js';
import { neDemografico, neRealizado, generacionesEquivalentes, ordenTopologico, fxAnimal } from '../genetica.js';
import { h, pintar, $, descargar, csv, pct, hoyISO } from '../ui.js';

const coma = (n, d = 2) => (n === null || n === undefined || !Number.isFinite(n) ? '—' : n.toFixed(d).replace('.', ','));

export default function (main) {
  const auditor = esAuditor(datos.rol());
  const activos = datos.censo().filter(a => a.estado !== 'baja');
  const idx = datos.estado.idx;
  const tramos = REGLAS.tramosEdadMeses;
  const cuenta = (f) => activos.filter(f).length;
  const adultos = activos.filter(a => tramoEdad(a.fecha_nacimiento)?.id === 'adulto');
  const nm = adultos.filter(a => a.sexo === 'M').length;
  const nf = adultos.filter(a => a.sexo === 'H').length;
  const neR = neRealizado(activos, idx);
  const fMedio = activos.length ? activos.reduce((s, a) => s + fxAnimal(a, idx), 0) / activos.length : 0;
  const geMedio = activos.length ? activos.reduce((s, a) => s + generacionesEquivalentes(a.id, idx), 0) / activos.length : 0;
  const conPadres = cuenta(a => a.padre_id && a.madre_id);
  const criadores = new Set(activos.map(a => a.usuario_id).filter(Boolean));
  const candidatos = datos.rol() === 'administrador' ? datos.candidatosRM() : [];
  const evolucion = datos.evolucionCenso();
  const situacion = auditor && activos.length ? datos.situacionPoblacional() : null;
  const porMunicipio = {};
  activos.forEach(a => { const k = [a.municipio, a.provincia].filter(Boolean).join(' · ') || 'Sin municipio'; porMunicipio[k] = (porMunicipio[k] || 0) + 1; });

  pintar(main, h`
    <h1>${auditor ? 'Informes del Libro Genealógico' : 'Informe de mi censo'}</h1>
    <p class="muted">Ejemplares activos a ${new Date().toLocaleDateString('es-ES')}. Datos útiles para la memoria técnica del Protocolo CNZ (censos, tamaño efectivo, endogamia).</p>

    <div class="kpis">
      <div class="kpi"><b>${activos.length}</b><span>Ejemplares activos</span></div>
      ${auditor ? h`<div class="kpi"><b>${criadores.size}</b><span>Criadores con ejemplares</span></div>` : ''}
      <div class="kpi"><b>${nm} / ${nf}</b><span>Reproductores adultos ♂ / ♀</span></div>
      <div class="kpi"><b>${coma(neDemografico(nm, nf), 1)}</b><span>Ne demográfico (4·Nm·Nf/(Nm+Nf))</span></div>
      <div class="kpi"><b>${neR ? coma(neR.ne, 1) : '—'}</b><span>Ne realizado (ΔF individual${neR ? `, n=${neR.n}` : ''})</span></div>
      <div class="kpi"><b>${pct(fMedio, 2)}</b><span>Consanguinidad media</span></div>
      <div class="kpi"><b>${coma(geMedio)}</b><span>Generaciones equivalentes medias</span></div>
      <div class="kpi"><b>${activos.length ? Math.round(100 * conPadres / activos.length) : 0} %</b><span>Con padre y madre registrados</span></div>
    </div>

    ${evolucion.length ? h`<div class="tarjeta" id="evolucion"><h2>Evolución del censo</h2>
      <p class="peq muted">Censo a 31 de diciembre de cada año (el año en curso, a hoy). Reproductores: adultos. Protocolo CNZ, apdo. 3.1 f.</p>
      <div class="tabla-scroll"><table class="tabla-evolucion">
        <thead><tr><th scope="col">Año</th><th scope="col">Censo</th><th scope="col">♂</th><th scope="col">♀</th><th scope="col">Reprod. ♂ / ♀</th>${tramos.filter(t => t.id !== 'adulto').map(t => h`<th scope="col">${t.nombre}</th>`)}<th scope="col">Nacidos</th><th scope="col">Bajas</th>${auditor ? h`<th scope="col">Criadores</th><th scope="col">Municipios</th>` : ''}<th scope="col">Ne</th><th scope="col">Fx medio</th><th scope="col">Tendencia</th></tr></thead>
        <tbody>${evolucion.map(f => h`<tr><th scope="row">${f.anio}${f.enCurso ? '*' : ''}</th><td>${f.total}</td><td>${f.machos}</td><td>${f.hembras}</td><td>${f.reproductoresM} / ${f.reproductoras}</td>
          ${tramos.filter(t => t.id !== 'adulto').map(t => h`<td>${f.edades[t.id].total}</td>`)}<td>${f.nacidos}</td><td>${f.bajas}</td>${auditor ? h`<td>${f.criadores}</td><td>${f.municipios}</td>` : ''}
          <td>${coma(f.neDem, 1)}</td><td>${f.fxMedio == null ? '—' : pct(f.fxMedio, 2)}</td><td>${f.variacion == null ? '—' : h`<span class="${f.variacion > 0 ? 'sube' : f.variacion < 0 ? 'baja' : ''}">${f.variacion > 0 ? '▲' : f.variacion < 0 ? '▼' : '='} ${Math.abs(Math.round(f.variacion * 100))} %</span>`}</td></tr>`)}</tbody>
      </table></div>
      ${evolucion.some(f => f.enCurso) ? h`<p class="peq muted">* Año en curso: censo a hoy.</p>` : ''}
    </div>` : ''}

    ${situacion ? h`<div class="tarjeta" id="situacion"><h2>Situación poblacional (Catálogo)</h2>
      <p class="peq muted">Criterios de la Comisión Nacional de Zootecnia (21/7/2022) para aves, con la media de ${situacion.anios[0]}–${situacion.anios[2]}. Una raza está amenazada si queda por debajo en cualquiera de los tres; el grado lo da la reposición. Protocolo CNZ 2025, apdo. 3.1 g.</p>
      <div class="tabla-scroll"><table class="tabla-evolucion tabla-situacion">
        <thead><tr><th scope="col">Criterio</th>${situacion.anios.map(a => h`<th scope="col">${a}</th>`)}<th scope="col">Media</th><th scope="col">Umbral</th></tr></thead>
        <tbody>${[['hembras', 'a) Hembras que criaron en pureza'], ['machos', 'b) Machos reproductores (6 meses o más)'], ['reposicion', 'c) Reposición: hembras que cumplieron 6 meses']].map(([k, n]) => h`<tr>
          <th scope="row">${n}</th>${situacion.filas.map(f => h`<td>${f[k]}</td>`)}<td><strong>${coma(situacion.medias[k], 1)}</strong></td><td><span class="${situacion.bajo[k] ? 'baja' : 'sube'}">${situacion.umbrales[k].toLocaleString('es-ES')}</span></td></tr>`)}</tbody>
      </table></div>
      <p class="aviso-caja ${situacion.amenazada ? 'alerta' : 'ok'}" style="margin:.75rem 0 .5rem">${situacion.amenazada
        ? h`<strong>Raza amenazada · grado de amenaza ${situacion.grado}.</strong> Queda por debajo de los umbrales de la CNZ para aves (grado alto: 750 o menos hembras de reposición al año).`
        : h`<strong>No amenazada</strong> según los tres criterios censales.`}</p>
      ${situacion.complementaria ? h`<p class="peq">Información complementaria, que la CNZ puede valorar de forma excepcional: Ne ${coma(situacion.complementaria.neDem, 1)} · consanguinidad media ${situacion.complementaria.fxMedio == null ? '—' : pct(situacion.complementaria.fxMedio, 2)} · ${situacion.complementaria.criadores} criador(es) · ${situacion.complementaria.explotaciones} explotación(es) con REGA · ${situacion.complementaria.municipios} municipio(s)${situacion.complementaria.tendencia == null ? '' : ` · censo ${situacion.complementaria.tendencia >= 0 ? '+' : ''}${Math.round(situacion.complementaria.tendencia * 100)} % desde ${situacion.complementaria.desde}`} · sin material genético en banco de germoplasma.</p>` : ''}
      <p class="peq muted">Aproximaciones del Libro: a) madres de pollitos del año con padre y madre inscritos; b) machos vivos a 31 de diciembre; c) hembras que cumplieron 6 meses en el año. Los umbrales de aves son los del protocolo de 2022; comprobadlos con el texto oficial antes de presentar el expediente.</p>
    </div>` : ''}

    <div class="tarjeta"><h2>Censo por sexo y edad</h2><div class="tabla-scroll"><table>
      <thead><tr><th>Tramo</th><th class="num">Gallos</th><th class="num">Gallinas</th><th class="num">Total</th></tr></thead>
      <tbody>${tramos.map(t => h`<tr><td>${t.nombre}</td>
        <td class="num">${cuenta(a => a.sexo === 'M' && tramoEdad(a.fecha_nacimiento)?.id === t.id)}</td>
        <td class="num">${cuenta(a => a.sexo === 'H' && tramoEdad(a.fecha_nacimiento)?.id === t.id)}</td>
        <td class="num">${cuenta(a => tramoEdad(a.fecha_nacimiento)?.id === t.id)}</td></tr>`)}
        <tr><th>Total</th><th class="num">${cuenta(a => a.sexo === 'M')}</th><th class="num">${cuenta(a => a.sexo === 'H')}</th><th class="num">${activos.length}</th></tr></tbody>
    </table></div></div>

    <div class="rejilla rejilla-2">
      <div class="tarjeta"><h2>Por variedad</h2><table><tbody>${ESTANDAR.variedades.map(v => h`<tr><td>${v.nombre}${v.oficial ? '' : ' (en proceso)'}</td>
        <td class="num">${cuenta(a => a.variedad === v.id)}</td></tr>`)}</tbody></table></div>
      <div class="tarjeta"><h2>Por sección del libro</h2><table><tbody>${Object.entries(ESTANDAR.secciones).map(([k, n]) => h`<tr><td>${k} · ${n}</td>
        <td class="num">${cuenta(a => a.seccion === k)}</td></tr>`)}</tbody></table></div>
    </div>
    ${auditor ? h`<div class="tarjeta"><h2>Distribución territorial</h2><table><tbody>${Object.entries(porMunicipio).sort((a, b) => b[1] - a[1])
      .map(([k, n]) => h`<tr><td>${k}</td><td class="num">${n}</td></tr>`)}</tbody></table></div>` : ''}

    ${candidatos.length ? h`<div class="tarjeta"><h2>★ Candidatos al Registro de Méritos (${candidatos.length})</h2>
      <p class="muted peq">Cumplen la calificación y la descendencia exigidas. Ábrelos para acordar la inscripción.</p>
      <ul class="lista">${candidatos.map(({ a, m }) => h`<li><a class="item" href="#/animal/${a.id}"><span class="item-principal">
        <span class="item-titulo">${a.anilla} · ${a.sexo === 'M' ? 'Gallo' : 'Gallina'} · ${a.seccion}</span>
        <span class="item-sub">${String(m.mejorPuntos).replace('.', ',')} puntos · ${m.hijosRD} descendientes en RD</span></span></a></li>`)}</ul></div>` : ''}

    <div class="tarjeta"><p>📄 <a href="#/acta">${auditor ? 'Acta anual de cierre censal' : 'Resumen anual de mi aviario'}</a>: balance del año listo para imprimir y firmar.</p></div>
    <div class="tarjeta"><p>🩺 <a href="#/auditoria">${auditor ? 'Auditoría del Libro' : 'Revisar mi censo'}</a>: incoherencias por corregir y <a href="#/auditoria">pureza de variedad</a> (${REGLAS.generacionesVariedad} generaciones).</p></div>
    <div class="tarjeta"><h2>Exportar</h2>
      <div class="fila">
        <button class="btn" id="x-pedigri">⬇️ Matriz de pedigrí (CSV · ENDOG/CFC/R)</button>
        <button class="btn" id="x-censo">⬇️ Censo (CSV)</button>
        ${evolucion.length ? h`<button class="btn" id="x-evolucion">⬇️ Evolución del censo (CSV)</button>` : ''}
        ${auditor ? h`<button class="btn" id="x-criadores">⬇️ Criadores y explotaciones (CSV)</button>` : ''}
        <button class="btn" id="x-imprimir">🖨️ Imprimir informe</button>
      </div>
      <p class="ayuda">La matriz incluye los ascendientes de otros criadores necesarios para el cálculo y está ordenada con progenitores antes que su descendencia.</p>
    </div>`);

  $('#x-pedigri', main).addEventListener('click', () => {
    const incluidos = new Map();
    const pila = [...activos];
    while (pila.length) {
      const a = pila.pop();
      if (!a || incluidos.has(a.id)) continue;
      incluidos.set(a.id, a);
      [a.padre_id, a.madre_id].forEach(x => { if (x && idx.has(x)) pila.push(idx.get(x)); });
    }
    const filas = [['ANIMAL', 'PADRE', 'MADRE', 'ANIO_NAC', 'SEXO', 'VARIEDAD', 'SECCION', 'FX_WRIGHT_5G']];
    ordenTopologico([...incluidos.values()]).forEach(a => filas.push([
      a.anilla, idx.get(a.padre_id)?.anilla || '0', idx.get(a.madre_id)?.anilla || '0',
      a.fecha_nacimiento ? a.fecha_nacimiento.slice(0, 4) : '0', a.sexo === 'M' ? 1 : 2,
      nombreVariedad(a.variedad), a.seccion, fxAnimal(a, idx).toFixed(6)]));
    descargar(csv(filas), `ESGA025_pedigri_${hoyISO()}.csv`);
  });
  $('#x-censo', main).addEventListener('click', () => {
    const filas = [['ANILLA', 'NOMBRE', 'SEXO', 'VARIEDAD', 'NACIMIENTO', 'TRAMO_EDAD', 'SECCION', 'FAMILIA', 'PESO_G', 'MUNICIPIO', 'FX']];
    activos.forEach(a => filas.push([a.anilla, a.nombre || '', a.sexo, nombreVariedad(a.variedad), a.fecha_nacimiento,
      tramoEdad(a.fecha_nacimiento)?.nombre || '', a.seccion, a.familia || '', a.peso_g ?? '', a.municipio || '', fxAnimal(a, idx).toFixed(6)]));
    descargar(csv(filas), `ESGA025_censo_${hoyISO()}.csv`);
  });
  $('#x-evolucion', main)?.addEventListener('click', () => {
    const tr = tramos.filter(t => t.id !== 'adulto');
    const filas = [['ANIO', 'FECHA_CENSO', 'CENSO', 'MACHOS', 'HEMBRAS', 'REPRODUCTORES_MACHOS', 'REPRODUCTORAS_HEMBRAS', ...tr.map(t => t.id.toUpperCase()), 'NACIDOS', 'BAJAS', 'CRIADORES', 'EXPLOTACIONES', 'MUNICIPIOS', 'NE_DEMOGRAFICO', 'FX_MEDIO', 'VARIACION_CENSO']];
    for (const f of evolucion) filas.push([f.anio, f.corte, f.total, f.machos, f.hembras, f.reproductoresM, f.reproductoras, ...tr.map(t => f.edades[t.id].total), f.nacidos, f.bajas,
      f.criadores, f.explotaciones, f.municipios, f.neDem == null ? '' : f.neDem.toFixed(1), f.fxMedio == null ? '' : f.fxMedio.toFixed(4), f.variacion == null ? '' : f.variacion.toFixed(3)]);
    descargar(csv(filas), `ESGA025_evolucion_censo_${hoyISO()}.csv`);
  });

  // Relación de criadores y explotaciones con sus efectivos (RD 45/2019, art. 14.5 c y d)
  $('#x-criadores', main)?.addEventListener('click', () => {
    const porTitular = new Map();
    activos.forEach(a => {
      const k = a.usuario_id || '—';
      const x = porTitular.get(k) || { machos: 0, hembras: 0, rd: 0, rega: a.rega, municipio: a.municipio, provincia: a.provincia };
      x[a.sexo === 'M' ? 'machos' : 'hembras'] += 1;
      if (['RD', 'RM'].includes(a.seccion)) x.rd += 1;
      porTitular.set(k, x);
    });
    const filas = [['CRIADOR', 'CORREO', 'REGA', 'MUNICIPIO', 'PROVINCIA', 'MACHOS', 'HEMBRAS', 'TOTAL', 'EN_RD_O_RM', 'CAMPANAS_PUESTA']];
    for (const [id, x] of porTitular) {
      const p = datos.estado.perfiles.find(q => q.id === id);
      filas.push([p?.nombre || '', p?.email || '', p?.rega || x.rega || '', p?.municipio || x.municipio || '', p?.provincia || x.provincia || '',
        x.machos, x.hembras, x.machos + x.hembras, x.rd, datos.estado.campanas.filter(c => c.usuario_id === id).length]);
    }
    descargar(csv(filas), `ESGA025_criadores_explotaciones_${hoyISO()}.csv`);
  });
  $('#x-imprimir', main).addEventListener('click', () => {
    pintar('#impresion', h`<h1>${auditor ? 'Informe del Libro Genealógico' : 'Informe de censo'} · ${ESTANDAR.codigo}</h1>
      <p>${CONFIG.club.nombre} · ${new Date().toLocaleDateString('es-ES')}${datos.estado.perfil?.rega && !auditor ? ` · REGA ${datos.estado.perfil.rega}` : ''}</p>`);
    document.getElementById('impresion').append(...[...main.querySelectorAll('.kpis, .tarjeta')].filter(n => !n.querySelector('#x-pedigri')).map(n => n.cloneNode(true)));
    setTimeout(() => window.print(), 50);
  });
}
