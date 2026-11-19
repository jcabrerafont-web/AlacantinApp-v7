// Dossier fotográfico de la raza (Dirección Técnica). Reúne las mejores fotos de
// perfil por variedad, sexo y edad y señala qué falta, para:
//  - el expediente de inclusión en el Catálogo Oficial (Protocolo CNZ 5/6/2025,
//    apdo. 3.1 c: fotos de ambos sexos, en diferentes edades y de cada variedad);
//  - el dossier técnico de FESACOCUR (gallo y gallina de perfil, fondo uniforme,
//    misma variedad).
import * as datos from '../datos.js';
import { CONFIG } from '../config.js';
import { ESTANDAR, REGLAS, edadMeses, sexoTexto } from '../estandar.js';
import { h, pintar, $, fecha } from '../ui.js';

const valida = (src) => typeof src === 'string' && /^(data:image\/|https:\/\/)/.test(src);
const tramoEn = (a, f) => {
  const m = edadMeses(a.fecha_nacimiento, f ? new Date(`${f}T12:00:00`) : new Date());
  return m === null ? null : (REGLAS.tramosEdadMeses.find(t => m < t.hasta) || REGLAS.tramosEdadMeses.at(-1));
};

export function recopilar() {
  const mejorCalif = (a) => Math.max(-1, ...datos.calificacionesDe(a.id).filter(c => c.clase !== 'D').map(c => Number(c.total) || 0));
  const celdas = new Map(); // variedad|sexo|tramo -> [{ a, src, fecha, puntos }]
  for (const a of datos.estado.todos) {
    if (a.estado === 'baja' || !valida(a.fotos?.lateral)) continue;
    const f = a.fotos_fecha?.lateral || null;
    const t = tramoEn(a, f);
    if (!t) continue;
    const k = `${a.variedad}|${a.sexo}|${t.id}`;
    const lista = celdas.get(k) || [];
    lista.push({ a, src: a.fotos.lateral, fecha: f, tramo: t, puntos: mejorCalif(a) });
    celdas.set(k, lista);
  }
  for (const lista of celdas.values()) lista.sort((x, y) => y.puntos - x.puntos || String(y.fecha).localeCompare(String(x.fecha)));
  return celdas;
}

export default function (main) {
  const celdas = recopilar();
  const tramos = REGLAS.tramosEdadMeses;
  const sexos = ['M', 'H'];
  const celda = (v, s, t) => celdas.get(`${v.id}|${s}|${t.id}`) || [];
  const resumen = ESTANDAR.variedades.map(v => {
    const total = sexos.length * tramos.length;
    const hechas = sexos.reduce((n, s) => n + tramos.filter(t => celda(v, s, t).length).length, 0);
    const fesa = celda(v, 'M', tramos.at(-1)).length > 0 && celda(v, 'H', tramos.at(-1)).length > 0;
    return { v, total, hechas, fesa };
  });

  pintar(main, h`
    <p><a href="#/herramientas">← Herramientas</a></p>
    <h1>Dossier fotográfico</h1>
    <div class="aviso-caja info peq">Fotos de perfil reunidas de todo el censo, por variedad, sexo y edad (la edad del animal en la fecha de la foto).
      En cada casilla se propone la del animal mejor calificado.
      <strong>Catálogo Oficial</strong> (Protocolo CNZ, 3.1 c): ambos sexos, varias edades y cada variedad.
      <strong>FESACOCUR</strong>: un gallo y una gallina adultos de la misma variedad, de perfil y con fondo uniforme.</div>

    <div class="tarjeta"><h2>Qué tenemos y qué falta</h2>
      <p class="peq muted">Catálogo: casillas con foto de las 6 (2 sexos × 3 edades). FESACOCUR: gallo y gallina adultos.</p>
      <div class="tabla-scroll"><table><thead><tr><th>Variedad</th><th class="num">Catálogo</th><th>FESACOCUR</th></tr></thead>
        <tbody>${resumen.map(r => h`<tr><td>${r.v.nombre}${r.v.oficial ? '' : h` <span class="chip chip-aviso">en proceso</span>`}</td>
          <td class="num">${r.hechas}/${r.total}</td><td>${r.fesa ? '✓' : h`<span class="muted">falta ${[celda(r.v, 'M', tramos.at(-1)).length ? '' : 'gallo', celda(r.v, 'H', tramos.at(-1)).length ? '' : 'gallina'].filter(Boolean).join(' y ')}</span>`}</td></tr>`)}</tbody></table></div>
      <button class="btn" id="d-imprimir">🖨️ Imprimir dossier (PDF)</button>
    </div>

    ${ESTANDAR.variedades.map(v => h`<div class="tarjeta"><h2>${v.nombre}</h2>
      ${sexos.map(s => h`<h3 class="peq">${s === 'M' ? 'Gallos' : 'Gallinas'}</h3>
        <div class="dossier-fila">${tramos.map(t => {
          const lista = celda(v, s, t);
          const x = lista[0];
          return x ? h`<a class="dossier-celda" href="#/animal/${x.a.id}"><img src="${x.src}" alt="${sexoTexto(s)} ${v.nombre}, ${t.nombre}" loading="lazy">
              <span><strong>${t.nombre}</strong><br>${x.a.anilla}${x.puntos >= 0 ? ` · ${String(x.puntos).replace('.', ',')} p` : ''}${lista.length > 1 ? ` · ${lista.length} fotos` : ''}</span></a>`
            : h`<div class="dossier-celda falta"><span><strong>${t.nombre}</strong><br>Falta foto</span></div>`;
        })}</div>`)}
    </div>`)}

    <p class="peq muted">Para mejorar el dossier, pide a los criadores fotos de perfil con fondo liso de los animales que faltan. En el alta tienen los consejos para hacerlas.</p>`);

  $('#d-imprimir', main).addEventListener('click', () => {
    pintar('#impresion', h`
      <div class="doc-cab"><img src="./icons/logo.png" alt="" width="64" height="64">
        <div><h1>Dossier fotográfico de la raza Alacantina</h1>
        <div>${CONFIG.club.nombre} · Estándar ${ESTANDAR.codigo} (rev. ${ESTANDAR.revision}) · ${new Date().toLocaleDateString('es-ES')}</div></div></div>
      ${ESTANDAR.variedades.map(v => h`<h2>${v.nombre}${v.oficial ? '' : ' (variedad en proceso de reconocimiento)'}</h2>
        <div class="dossier-fila">${sexos.flatMap(s => tramos.map(t => {
          const x = celda(v, s, t)[0];
          return x ? h`<div class="dossier-celda"><img src="${x.src}" alt=""><span>${sexoTexto(s)} · ${t.nombre}<br>${x.a.anilla} · foto ${x.fecha ? fecha(x.fecha) : 's/f'}</span></div>`
            : h`<div class="dossier-celda falta"><span>${sexoTexto(s)} · ${t.nombre}<br>sin foto</span></div>`;
        }))}</div>`)}`);
    setTimeout(() => window.print(), 50);
  });
}
