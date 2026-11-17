// Campañas de control de puesta: organizar los 3 ciclos de la temporada y ver
// el acumulado por gallina. Pensado para guiar al criador que empieza.
import * as datos from '../datos.js';
import { REGLAS } from '../estandar.js';
import { h, pintar, $, aviso, fecha, hoyISO } from '../ui.js';

const coma = (n, d = 1) => (n === null || n === undefined || !Number.isFinite(n) ? '—' : Number(n).toFixed(d).replace('.', ','));
const pctTxt = (x) => `${Math.round(100 * x)} %`;
const METODOS = { jaula: 'Jaula individual', ponedero: 'Ponedero trampa', rfid: 'Ponedero con lector RFID' };
const CP = REGLAS.controlPuesta;

export default function (main) {
  const p = datos.estado.perfil;
  const anio = new Date().getFullYear();
  let temporada = anio;

  const dibujar = () => {
    const camps = datos.misCampanas();
    const gallinas = datos.censo().filter(a => a.sexo === 'H' && a.usuario_id === p.id && a.estado !== 'baja');
    const deTemporada = camps.filter(c => c.temporada === temporada);
    const usados = new Set(deTemporada.map(c => c.ciclo));
    const libre = [1, 2, 3].find(n => !usados.has(n));
    const acumulado = datos.temporadaPuesta(temporada);
    const temporadas = [...new Set([anio, ...camps.map(c => c.temporada)])].sort((a, b) => b - a);

    pintar(main, h`
      <p><a href="#/puesta">← Puesta & RFID</a></p>
      <h1>Control de puesta</h1>
      <div class="aviso-caja info peq">Cada temporada se hacen <strong>${CP.ciclos} campañas de ${CP.dias} días</strong> repartidas entre febrero y junio.
        Durante cada campaña se pesa y anota cada huevo de cada gallina controlada. Con los resultados se elige, en cada familia, la gallina más ponedora como madre del gallo de reposición.
        <a href="#/programa?s=puesta">Cómo se hace, paso a paso →</a></div>

      <div class="fila" style="margin:.75rem 0">
        <label for="cp-temp" class="peq">Temporada</label>
        <select id="cp-temp" style="width:auto">${temporadas.map(t => h`<option value="${t}" ${t === temporada ? h`selected` : ''}>${t}</option>`)}</select>
      </div>

      <div class="tarjeta"><h2>Ciclos ${temporada}</h2>
        <ul class="lista">${[1, 2, 3].map(n => {
          const c = deTemporada.find(x => x.ciclo === n);
          if (!c) return h`<li class="item"><div class="item-principal"><div class="item-titulo">Ciclo ${n}</div>
            <div class="item-sub">${n === libre ? 'Pendiente de organizar' : 'Pendiente'}</div></div><span class="chip">Sin crear</span></li>`;
          const est = datos.estadoCampana(c);
          return h`<li><a class="item" href="#/campana/${c.id}"><span class="item-principal">
            <span class="item-titulo">Ciclo ${n} · ${fecha(c.inicio)} – ${fecha(datos.finCampana(c))}</span>
            <span class="item-sub">${c.gallinas.length} gallina(s) · ${METODOS[c.metodo] || c.metodo}${est === 'en curso' ? ` · día ${datos.diaCampana(c)} de ${c.dias}` : ''}</span></span>
            <span class="chip ${est === 'en curso' ? 'chip-ok' : est === 'programada' ? 'chip-info' : ''}">${est}</span></a></li>`;
        })}</ul>
      </div>

      ${libre ? h`<form id="cp-form" class="tarjeta" novalidate><h2>Organizar el ciclo ${libre} de ${temporada}</h2>
        ${gallinas.length ? h`
          <div class="rejilla rejilla-2">
            <div class="campo"><label for="cp-inicio">Primer día</label>
              <input id="cp-inicio" type="date" value="${String(temporada) === hoyISO().slice(0, 4) ? hoyISO() : `${temporada}-02-01`}">
              <p class="ayuda" id="cp-inicio-ayuda"></p></div>
            <div class="campo"><label for="cp-dias">Días</label>
              <input id="cp-dias" type="number" inputmode="numeric" min="7" max="30" value="${CP.dias}">
              <p class="ayuda">El protocolo recomienda ${CP.dias}.</p></div>
            <div class="campo"><label for="cp-metodo">Cómo se identifica el huevo de cada gallina</label>
              <select id="cp-metodo">${Object.entries(METODOS).map(([k, v]) => h`<option value="${k}">${v}</option>`)}</select></div>
          </div>
          <fieldset><legend>Gallinas controladas (${gallinas.length})</legend>
            ${gallinas.map(a => h`<label class="check-grande neutro"><input type="checkbox" name="cp-g" value="${a.id}" checked> ${a.anilla}${a.nombre ? ` · ${a.nombre}` : ''}${a.familia ? ` · familia ${a.familia}` : ''}</label>`)}
          </fieldset>
          <div class="campo"><label for="cp-notas">Notas (opcional)</label><textarea id="cp-notas" placeholder="Ej.: gallo de la familia A con estas gallinas"></textarea></div>
          <button class="btn btn-primario btn-bloque" type="submit">Crear ciclo ${libre}</button>`
          : h`<p class="muted">Aún no tienes gallinas en tu censo. <a href="#/alta">Da de alta tus gallinas</a> para poder organizar el control.</p>`}
      </form>` : h`<div class="aviso-caja ok">Los ${CP.ciclos} ciclos de ${temporada} están organizados.</div>`}

      ${acumulado.length ? h`<div class="tarjeta"><h2>Acumulado de la temporada ${temporada}</h2>
        <p class="muted peq">Suma de todas las campañas del año. La puesta es el porcentaje de días controlados en los que la gallina puso huevo.</p>
        <div class="tabla-scroll"><table><thead><tr><th>Gallina</th><th>Fam.</th><th class="num">Ciclos</th><th class="num">Huevos</th><th class="num">Puesta</th><th class="num">Peso medio</th><th class="num">Aptos</th></tr></thead>
          <tbody>${acumulado.map(x => h`<tr><td><a href="#/animal/${x.a.id}">${x.a.anilla}</a></td><td>${x.a.familia || '—'}</td>
            <td class="num">${x.ciclos}</td><td class="num">${x.n}</td><td class="num">${pctTxt(x.puesta)}</td><td class="num">${coma(x.media)} g</td><td class="num">${x.aptos}</td></tr>`)}</tbody></table></div>
      </div>` : ''}`);

    $('#cp-temp', main).addEventListener('change', e => { temporada = Number(e.target.value); dibujar(); });
    const f = $('#cp-form', main);
    if (!f || !gallinas.length) return;
    const ayudaInicio = () => {
      const v = $('#cp-inicio', f).value;
      const mes = Number(v.slice(5, 7));
      const t = $('#cp-inicio-ayuda', f);
      t.className = `ayuda ${v && (mes < CP.mesInicio || mes > CP.mesFin) ? 'error' : ''}`;
      t.textContent = !v ? '' : (mes < CP.mesInicio || mes > CP.mesFin)
        ? 'Fuera de la temporada recomendada (febrero a junio). Se puede crear igualmente.'
        : `Termina el ${fecha(new Date(Date.parse(`${v}T12:00:00Z`) + (Number($('#cp-dias', f).value || CP.dias) - 1) * 86400000).toISOString().slice(0, 10))}.`;
    };
    f.addEventListener('input', ayudaInicio);
    ayudaInicio();
    f.addEventListener('submit', async e => {
      e.preventDefault();
      try {
        const inicio = $('#cp-inicio', f).value;
        if (inicio.slice(0, 4) !== String(temporada)) throw new Error(`El primer día debe ser de ${temporada}.`);
        const c = await datos.crearCampana({
          ciclo: libre, inicio, dias: Number($('#cp-dias', f).value),
          metodo: $('#cp-metodo', f).value, notas: $('#cp-notas', f).value.trim(),
          gallinas: [...f.querySelectorAll('input[name=cp-g]:checked')].map(x => x.value)
        });
        aviso(`Ciclo ${c.ciclo} creado: del ${fecha(c.inicio)} al ${fecha(datos.finCampana(c))}.`, 'ok');
        location.hash = `#/campana/${c.id}`;
      } catch (err) { aviso(err.message, 'error'); }
    });
  };
  dibujar();
  return datos.suscribir(() => { if (!document.activeElement?.closest?.('#cp-form')) dibujar(); });
}
