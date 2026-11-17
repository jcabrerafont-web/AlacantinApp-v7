// Auditoría del Libro (Dirección Técnica: todo el Libro; criador: su censo) y pureza de variedad.
import * as datos from '../datos.js';
import { esAuditor } from '../auth.js';
import { ESTANDAR, REGLAS } from '../estandar.js';
import { purezaVariedad } from '../genetica.js';
import { h, pintar, $, pct, descargar, csv, hoyISO } from '../ui.js';

export default function (main) {
  const p = datos.estado.perfil;
  const auditor = esAuditor(p.rol);
  const hallazgos = datos.auditarLibro();
  const errores = hallazgos.filter(x => x.nivel === 'error');
  const avisos = hallazgos.filter(x => x.nivel === 'aviso');
  const activos = datos.censo().filter(a => a.estado !== 'baja');
  const titular = (a) => { const t = datos.estado.perfiles.find(x => x.id === a.usuario_id); return t?.nombre || t?.email || ''; };
  const G = REGLAS.generacionesVariedad;

  // Pureza por variedad
  const pureza = ESTANDAR.variedades.map(v => {
    const r = activos.filter(a => a.variedad === v.id).map(a => purezaVariedad(a.id, datos.estado.idx)).filter(Boolean);
    const conMisma = r.filter(x => x.misma !== null);
    return { v, n: r.length, puras: r.length ? r.reduce((s, x) => s + x.generacionesPuras, 0) / r.length : null,
      maxPuras: r.reduce((m, x) => Math.max(m, x.generacionesPuras), 0), completas: r.filter(x => x.generacionesPuras >= G).length,
      conocidos: r.length ? r.reduce((s, x) => s + x.conocidos, 0) / r.length : null,
      misma: conMisma.length ? conMisma.reduce((s, x) => s + x.misma, 0) / conMisma.length : null, cruces: r.filter(x => x.otras.length).length };
  }).filter(x => x.n);

  const grupo = (lista) => {
    const tipos = [...new Set(lista.map(x => x.tipo))];
    return tipos.map(t => {
      const items = lista.filter(x => x.tipo === t);
      return h`<details class="tarjeta auditoria-grupo" data-tipo="${t}" ${items.length <= 5 ? h`open` : ''}>
        <summary><strong>${datos.TIPOS_AUDITORIA[t][1]}</strong> <span class="chip ${datos.TIPOS_AUDITORIA[t][0] === 'error' ? 'chip-alerta' : 'chip-aviso'}">${items.length}</span></summary>
        <ul class="lista">${items.map(x => h`<li class="item"><div class="item-principal">
          <div class="item-titulo"><a href="#/animal/${x.animal.id}">${x.animal.anilla}</a>${x.animal.estado === 'baja' ? ' (baja)' : ''}${auditor ? h` <span class="muted peq">· ${titular(x.animal)}</span>` : ''}</div>
          <div class="item-sub">${x.texto}</div></div>
          ${datos.puedeEditar(x.animal) && x.animal.estado !== 'baja' ? h`<a class="btn btn-pequeno" href="#/editar/${x.animal.id}">Corregir</a>` : ''}</li>`)}</ul></details>`;
    });
  };

  pintar(main, h`
    <h1>${auditor ? 'Auditoría del Libro' : 'Revisar mi censo'}</h1>
    <p class="muted">Incoherencias que conviene corregir antes de una inspección o de enviar datos al Catálogo. La app solo avisa: cada corrección la hace el titular (o la administración) desde la ficha.</p>
    <div class="kpis">
      <div class="kpi"><b>${datos.censo({ incluirBajas: true }).length}</b><span>Ejemplares revisados</span></div>
      <div class="kpi"><b>${errores.length}</b><span>Errores</span></div>
      <div class="kpi"><b>${avisos.length}</b><span>Avisos</span></div>
    </div>
    ${!hallazgos.length ? h`<div class="aviso-caja ok">✓ No se han encontrado incoherencias.</div>` : ''}
    ${errores.length ? h`<h2>Errores</h2><p class="peq muted">Datos imposibles o que contradicen las reglas del Libro.</p>${grupo(errores)}` : ''}
    ${avisos.length ? h`<h2>Avisos</h2><p class="peq muted">Datos posibles pero que conviene revisar.</p>${grupo(avisos)}` : ''}

    <div class="tarjeta" id="pureza"><h2>Pureza de variedad</h2>
      <p class="peq">Una <strong>variedad</strong> es una subpoblación cerrada, criada sin material de otras variedades durante al menos <strong>${G} generaciones</strong> (RD 45/2019, art. 3 b; Protocolo CNZ 2025). Para reconocer la Blanca armiñada en negro y la Milflores hay que demostrarlo con el Libro.</p>
      <div class="tabla-scroll"><table><thead><tr><th>Variedad</th><th class="num">Ejemplares</th><th class="num">Generaciones puras (media / máx.)</th><th class="num">Con ${G} generaciones puras</th><th class="num">Pedigrí conocido</th><th class="num">Ancestros de la misma variedad</th><th class="num">Con otras variedades</th></tr></thead><tbody>
        ${pureza.map(x => h`<tr><td>${x.v.nombre}${x.v.oficial ? '' : h` <span class="chip chip-aviso">en proceso</span>`}</td><td class="num">${x.n}</td>
          <td class="num">${x.puras.toFixed(1).replace('.', ',')} / ${x.maxPuras}</td><td class="num">${x.completas}</td>
          <td class="num">${pct(x.conocidos, 0)}</td><td class="num">${x.misma === null ? '—' : pct(x.misma, 0)}</td><td class="num">${x.cruces}</td></tr>`)}
      </tbody></table></div>
      <p class="peq muted"><strong>Generaciones puras:</strong> generaciones seguidas con todos los ancestros conocidos y de la misma variedad (padres = 1, abuelos = 2…). <strong>Pedigrí conocido:</strong> ancestros registrados hasta la ${G}.ª generación, ponderados por su parentesco. Los fundadores (RF) no tienen ancestros: la cuenta empieza en ellos.</p>
    </div>

    ${hallazgos.length ? h`<div class="tarjeta"><button class="btn" id="au-csv">⬇️ Descargar la auditoría (CSV)</button></div>` : ''}`);

  $('#au-csv', main)?.addEventListener('click', () => descargar(csv([
    ['Nivel', 'Tipo', 'Anilla', 'Estado', ...(auditor ? ['Titular'] : []), 'Detalle'],
    ...hallazgos.map(x => [x.nivel, datos.TIPOS_AUDITORIA[x.tipo][1], x.animal.anilla, x.animal.estado || 'activo', ...(auditor ? [titular(x.animal)] : []), x.texto])
  ]), `AlacantinApp_auditoria_${hoyISO()}.csv`));
}
