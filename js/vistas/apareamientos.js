// Apareamientos: rotación circular de Gobe + consanguinidad esperada de cada cruce
import * as datos from '../datos.js';
import { ESTANDAR, REGLAS, nombreVariedad } from '../estandar.js';
import { fxDescendencia, nivelFx, familiaGalloGobe } from '../genetica.js';
import { h, pintar, $, pct } from '../ui.js';

export default function (main) {
  const p = datos.estado.perfil;
  const mios = datos.censo().filter(a => a.usuario_id === p.id || datos.rol() === 'administrador');
  const gallos = mios.filter(a => a.sexo === 'M');
  const gallinas = mios.filter(a => a.sexo === 'H');
  const etiqueta = (a) => `${a.anilla}${a.nombre ? ' · ' + a.nombre : ''}${a.familia ? ` (fam. ${a.familia})` : ''}`;

  pintar(main, h`
    <h1>Apareamientos</h1>
    <div class="tarjeta">
      <h2>Rotación de Gobe</h2>
      <p class="muted peq">El gallo de la familia N cubre a las gallinas de la familia siguiente (${ESTANDAR.familias.join(' → ')} → ${ESTANDAR.familias[0]}). La descendencia queda en la familia de la madre.</p>
      <div class="campo"><label for="ap-fam">Familia de las gallinas</label>
        <select id="ap-fam"><option value="">Elegir…</option>${ESTANDAR.familias.map(f => h`<option value="${f}">Familia ${f}</option>`)}</select></div>
      <div id="ap-gobe"></div>
    </div>
    <div class="tarjeta">
      <h2>Simulador de cruce</h2>
      <div class="rejilla rejilla-2">
        <div class="campo"><label for="ap-gallo">Gallo</label><select id="ap-gallo"><option value="">Elegir…</option>${gallos.map(a => h`<option value="${a.id}">${etiqueta(a)}</option>`)}</select></div>
        <div class="campo"><label for="ap-gallina">Gallina</label><select id="ap-gallina"><option value="">Elegir…</option>${gallinas.map(a => h`<option value="${a.id}">${etiqueta(a)}</option>`)}</select></div>
      </div>
      <div id="ap-res"></div>
    </div>`);

  const filaCruce = (g, hs) => {
    const fxs = hs.map(x => fxDescendencia(g.id, x.id, datos.estado.idx));
    const max = Math.max(0, ...fxs);
    return { g, max, media: fxs.length ? fxs.reduce((s, x) => s + x, 0) / fxs.length : 0 };
  };

  $('#ap-fam', main).addEventListener('change', e => {
    const fam = e.target.value;
    const out = $('#ap-gobe', main);
    if (!fam) { out.innerHTML = ''; return; }
    const famGallo = familiaGalloGobe(fam);
    const hs = gallinas.filter(a => a.familia === fam);
    const candidatos = gallos.map(g => filaCruce(g, hs)).sort((x, y) =>
      (Number(y.g.familia === famGallo) - Number(x.g.familia === famGallo)) || (x.max - y.max));
    pintar(out, h`
      <p>Según Gobe, para la familia <strong>${fam}</strong> corresponde un gallo de la familia <strong>${famGallo}</strong>. Gallinas en la familia ${fam}: ${hs.length}.</p>
      ${!hs.length ? h`<p class="aviso-caja aviso">No tienes gallinas asignadas a la familia ${fam} (campo «Familia» del ejemplar).</p>` : ''}
      ${candidatos.length ? h`<div class="tabla-scroll"><table><thead><tr><th>Gallo</th><th>Familia</th><th class="num">Fx máx.</th><th class="num">Fx medio</th></tr></thead><tbody>
        ${candidatos.map(c => { const n = nivelFx(c.max); return h`<tr>
          <td>${c.g.anilla} ${c.g.familia === famGallo ? h`<span class="chip chip-ok">Gobe</span>` : ''}</td><td>${c.g.familia || '—'}</td>
          <td class="num"><span class="chip ${n.nivel === 'alerta' ? 'chip-alerta' : n.nivel === 'precaucion' ? 'chip-aviso' : 'chip-ok'}">${pct(c.max)}</span></td>
          <td class="num">${pct(c.media)}</td></tr>`; })}</tbody></table></div>` : h`<p class="muted">No tienes gallos activos.</p>`}`);
  });

  const simular = () => {
    const g = $('#ap-gallo', main).value;
    const x = $('#ap-gallina', main).value;
    const out = $('#ap-res', main);
    if (!g || !x) { out.innerHTML = ''; return; }
    const fx = fxDescendencia(g, x, datos.estado.idx);
    const n = nivelFx(fx);
    const ga = datos.animal(g);
    const ha = datos.animal(x);
    const famOk = ha.familia && ga.familia === familiaGalloGobe(ha.familia);
    pintar(out, h`<div class="aviso-caja ${n.nivel === 'alerta' ? 'alerta' : n.nivel === 'precaucion' ? 'aviso' : 'ok'}">
      Consanguinidad esperada de la descendencia: <strong>${pct(fx, 3)}</strong> (${n.texto}).
      Umbrales: precaución ≥ ${pct(REGLAS.fxPrecaucion)} · alerta ≥ ${pct(REGLAS.fxAlerta)}.</div>
      <p class="peq">${ha.familia ? (famOk ? '✓ Cruce conforme a la rotación de Gobe.' : `Según Gobe, la familia ${ha.familia} debería cubrirse con un gallo de la familia ${familiaGalloGobe(ha.familia)}.`) : 'La gallina no tiene familia asignada.'}
      ${ga.variedad !== ha.variedad ? h`<br>Cruce entre variedades distintas (${nombreVariedad(ga.variedad)} × ${nombreVariedad(ha.variedad)}).` : ''}</p>`);
  };
  $('#ap-gallo', main).addEventListener('change', simular);
  $('#ap-gallina', main).addEventListener('change', simular);
}
