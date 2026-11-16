// Árbol genealógico a 5 generaciones con ancestros comunes resaltados
import * as datos from '../datos.js';
import { REGLAS, nombreVariedad } from '../estandar.js';
import { ancestrosComunes, nivelFx } from '../genetica.js';
import { h, pintar, pct } from '../ui.js';

export default function (main, { id }) {
  const a = datos.animal(id);
  if (!a) { pintar(main, h`<div class="tarjeta"><h2>Ejemplar no encontrado</h2></div>`); return; }
  const idx = datos.estado.idx;
  const G = REGLAS.generacionesWright;
  const comunes = new Set(a.padre_id && a.madre_id ? ancestrosComunes(a.padre_id, a.madre_id, idx, G - 1) : []);
  const fx = datos.fx(a);
  const nf = nivelFx(fx);

  // columnas: generación 1..G, cada una con 2^g casillas
  const columnas = [];
  let nivel = [a.id];
  for (let g = 1; g <= G; g++) {
    nivel = nivel.flatMap(x => { const n = x ? idx.get(x) : null; return [n?.padre_id || null, n?.madre_id || null]; });
    columnas.push(nivel);
  }
  const nombresGen = ['Padres', 'Abuelos', 'Bisabuelos', 'Tatarabuelos', '5ª generación'];
  const nodo = (x, i) => {
    const n = x ? idx.get(x) : null;
    const sexo = i % 2 === 0 ? 'M' : 'H';
    if (!n) return h`<div class="nodo vacio ${sexo}">${sexo === 'M' ? 'Padre' : 'Madre'} no registrado</div>`;
    return h`<a class="nodo ${n.sexo} ${comunes.has(n.id) ? 'comun' : ''}" href="#/animal/${n.id}" style="text-decoration:none;color:inherit">
      <strong>${n.anilla}</strong><br><small>${nombreVariedad(n.variedad)} · ${n.seccion}</small></a>`;
  };
  const conocidos = columnas.map(c => c.filter(Boolean).length);
  // No pintar generaciones más allá de la primera sin ningún ancestro registrado
  const ultima = conocidos.findIndex(n => n === 0);
  const visibles = ultima === -1 ? columnas : columnas.slice(0, Math.max(1, ultima));

  pintar(main, h`
    <p><a href="#/animal/${a.id}">← ${a.anilla}</a></p>
    <h1>Pedigrí de ${a.anilla}</h1>
    <div class="kpis">
      <div class="kpi"><b>${pct(fx, 3)}</b><span>Fx de Wright (${G} gen.) · ${nf.texto}</span></div>
      <div class="kpi"><b>${comunes.size}</b><span>Ancestros comunes de padre y madre</span></div>
      <div class="kpi"><b>${conocidos.reduce((s, n) => s + n, 0)}</b><span>Ancestros conocidos de ${2 ** (G + 1) - 2}</span></div>
    </div>
    ${comunes.size ? h`<p class="aviso-caja aviso peq">Recuadrados en ámbar: ancestros comunes por línea paterna y materna.</p>` : ''}
    <div class="tarjeta" style="overflow-x:auto">
      <div class="pedigri" style="--gen:${visibles.length}">
        ${visibles.map((col, g) => h`<div class="col"><div class="muted peq gen-titulo"><strong>${nombresGen[g]}</strong> · ${conocidos[g]}/${col.length}</div>${col.map((x, i) => nodo(x, i))}</div>`)}
      </div>
      ${visibles.length < columnas.length ? h`<p class="muted peq" style="margin-top:.75rem">Sin ancestros registrados en ${nombresGen[visibles.length].toLowerCase()} ni anteriores.</p>` : ''}
    </div>`);
}
