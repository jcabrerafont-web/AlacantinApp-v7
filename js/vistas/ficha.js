// Ficha del ejemplar (datos, genealogía, puesta, calificaciones y acciones según rol)
import * as datos from '../datos.js';
import { esAuditor } from '../auth.js';
import { ESTANDAR, nombreVariedad, sexoTexto, pesoConforme, edadMeses, variedadPorId } from '../estandar.js';
import { nivelFx, generacionesEquivalentes } from '../genetica.js';
import * as docs from '../documentos.js';
import { h, pintar, $, aviso, fecha, kg, pct, dialogo, hoyISO } from '../ui.js';

export default function (main, { id }) {
  const dibujar = () => {
    const completo = datos.animal(id);
    if (!completo) {
      pintar(main, h`<div class="tarjeta"><h2>Ejemplar no encontrado</h2><p><a href="#/censo">Volver al censo</a></p></div>`);
      return;
    }
    const visitante = datos.esVisitante();
    const a = visitante ? datos.versionPublica(completo) : completo;
    const propio = datos.puedeEditar(completo);
    const auditor = esAuditor(datos.rol());
    const verPrivado = propio || auditor;
    const padre = datos.animal(a.padre_id);
    const madre = datos.animal(a.madre_id);
    const fx = datos.fx(completo);
    const nf = nivelFx(fx);
    const meses = edadMeses(a.fecha_nacimiento);
    const conf = pesoConforme(a.sexo, a.peso_g);
    const v = variedadPorId(a.variedad);
    const califs = verPrivado ? datos.calificacionesDe(a.id) : [];
    const puesta = verPrivado && a.sexo === 'H' ? datos.resumenPuesta(a.id) : null;
    const hijos = datos.estado.todos.filter(x => x.padre_id === a.id || x.madre_id === a.id);
    const enlace = (x) => (x ? h`<a href="#/animal/${x.id}">${x.anilla}</a>${x.nombre ? h` · ${x.nombre}` : ''}` : h`<span class="muted">No registrado</span>`);

    pintar(main, h`
      <p><a href="#/censo">← Censo</a></p>
      <div class="tarjeta">
        <div class="fila entre">
          <div class="fila"><span class="sexo sexo-${a.sexo}">${a.sexo === 'M' ? '♂' : '♀'}</span>
            <div><h1 style="margin:0">${a.anilla}</h1><div class="muted">${a.nombre || sexoTexto(a.sexo)}</div></div></div>
          <div class="fila">
            <span class="chip ${a.seccion === 'RD' ? 'chip-ok' : 'chip-info'}">${a.seccion} · ${ESTANDAR.secciones[a.seccion]}</span>
            ${a.estado === 'baja' ? h`<span class="chip chip-alerta">Baja</span>` : ''}
          </div>
        </div>
        <table style="margin-top:.75rem"><tbody>
          <tr><th>Sexo</th><td>${sexoTexto(a.sexo)} · anilla ${ESTANDAR.anilla[a.sexo] || '—'} mm</td></tr>
          <tr><th>Variedad</th><td>${nombreVariedad(a.variedad)} ${v && !v.oficial ? h`<span class="chip chip-aviso">En proceso</span>` : ''}</td></tr>
          <tr><th>Nacimiento</th><td>${fecha(a.fecha_nacimiento)}${meses !== null ? ` · ${meses} meses` : ''}</td></tr>
          <tr><th>Peso</th><td>${kg(a.peso_g)} ${conf === true ? h`<span class="chip chip-ok">Estándar</span>` : conf === false ? h`<span class="chip chip-aviso">Fuera de rango</span>` : ''}</td></tr>
          <tr><th>Familia</th><td>${a.familia ? `Familia ${a.familia}` : '—'}</td></tr>
          <tr><th>Padre</th><td>${enlace(padre)}</td></tr>
          <tr><th>Madre</th><td>${enlace(madre)}</td></tr>
          <tr><th>Consanguinidad</th><td>${pct(fx, 3)} <span class="chip ${nf.nivel === 'alerta' ? 'chip-alerta' : nf.nivel === 'precaucion' ? 'chip-aviso' : 'chip-ok'}">${nf.texto}</span>
            <div class="muted peq">Generaciones equivalentes conocidas: ${generacionesEquivalentes(a.id, datos.estado.idx).toFixed(2).replace('.', ',')}</div></td></tr>
          ${verPrivado ? h`<tr><th>Aviario</th><td>${a.rega || 'REGA pendiente'} · ${a.municipio || '—'}</td></tr>
            ${a.rfid ? h`<tr><th>Chip RFID</th><td>${a.rfid}</td></tr>` : ''}
            ${a.estado === 'baja' ? h`<tr><th>Baja</th><td>${fecha(a.baja_fecha)} · ${a.baja_causa || ''}</td></tr>` : ''}
            ${a.notas ? h`<tr><th>Notas</th><td>${a.notas}</td></tr>` : ''}` : ''}
        </tbody></table>
        ${a.fotos && Object.values(a.fotos).some(Boolean) ? h`<div class="fotos" style="margin-top:.75rem">${['lateral', 'cabeza', 'tarsos'].map(k =>
          a.fotos[k] && /^(data:image\/|https:\/\/)/.test(a.fotos[k]) ? h`<div class="foto"><img src="${a.fotos[k]}" alt="Foto ${k}" loading="lazy"></div>` : h`<div class="foto"><span>Sin foto</span></div>`)}</div>` : ''}
      </div>

      <div class="fila" style="margin-bottom:1rem">
        <a class="btn" href="#/pedigri/${a.id}">🌳 Pedigrí</a>
        ${propio && a.estado !== 'baja' ? h`<a class="btn" href="#/editar/${a.id}">✏️ Editar</a>` : ''}
        ${verPrivado ? h`<button class="btn" id="b-cert">📄 Certificado</button>` : ''}
        ${auditor && a.estado !== 'baja' ? h`<a class="btn btn-primario" href="#/calificar/${a.id}">✅ Calificar</a>` : ''}
        ${propio && a.estado !== 'baja' ? h`<button class="btn btn-peligro" id="b-baja">Dar de baja</button>` : ''}
      </div>

      ${puesta ? h`<div class="tarjeta"><div class="fila entre"><h2>Puesta</h2><a class="btn btn-pequeno" href="#/puesta?gallina=${a.id}">🥚 Registrar</a></div>
        ${puesta.n ? h`<div class="kpis">
          <div class="kpi"><b>${puesta.n}</b><span>Huevos pesados</span></div>
          <div class="kpi"><b>${puesta.media.toFixed(1).replace('.', ',')} g</b><span>Peso medio</span></div>
          <div class="kpi"><b>${puesta.aptos}/${puesta.n}</b><span>Aptos (${ESTANDAR.huevo.min}–${ESTANDAR.huevo.max} g, blanco crema)</span></div></div>`
          : h`<p class="muted">Sin huevos registrados.</p>`}</div>` : ''}

      ${verPrivado ? h`<div class="tarjeta"><h2>Calificaciones</h2>
        ${califs.length ? h`<ul class="lista">${califs.map(c => h`<li class="item"><div class="item-principal">
          <div class="item-titulo">${c.resultado} · ${fecha(c.fecha)}</div>
          <div class="item-sub">${c.inspector_nombre}${c.defectos?.length ? ` · ${c.defectos.length} defecto(s) grave(s)` : ''}</div></div>
          <button class="btn btn-pequeno" data-acta="${c.id}">Acta</button></li>`)}</ul>`
          : h`<p class="muted">Sin calificar. ${propio ? 'La califica un inspector del Club en visita al aviario.' : ''}</p>`}</div>` : ''}

      ${hijos.length ? h`<div class="tarjeta"><h2>Descendencia (${hijos.length})</h2><ul class="lista">
        ${hijos.map(x => h`<li><a class="item" href="#/animal/${x.id}"><span class="sexo sexo-${x.sexo}">${x.sexo === 'M' ? '♂' : '♀'}</span>
          <span class="item-principal"><span class="item-titulo">${x.anilla}</span><span class="item-sub">${fecha(x.fecha_nacimiento)} · ${x.seccion}</span></span></a></li>`)}</ul></div>` : ''}`);

    const titular = () => datos.estado.perfiles.find(x => x.id === completo.usuario_id) || (propio ? datos.estado.perfil : null);
    $('#b-cert', main)?.addEventListener('click', () => docs.certificado(completo, { idx: datos.estado.idx, titular: titular(), ultimaCalificacion: califs[0] }));
    main.querySelectorAll('[data-acta]').forEach(b => b.addEventListener('click', () =>
      docs.acta(completo, califs.find(c => c.id === b.dataset.acta), titular())));
    $('#b-baja', main)?.addEventListener('click', async () => {
      const r = await dialogo({
        titulo: `Baja de ${a.anilla}`,
        cuerpo: h`<div class="campo"><label for="baja-causa">Causa</label><select id="baja-causa">
          <option>Muerte</option><option>Venta</option><option>Cesión</option><option>Sacrificio</option><option>Desaparición</option><option>Otra</option></select></div>
          <div class="campo"><label for="baja-fecha">Fecha</label><input id="baja-fecha" type="date" value="${hoyISO()}" max="${hoyISO()}"></div>`,
        acciones: [{ valor: 'no', texto: 'Cancelar' }, { valor: 'si', texto: 'Dar de baja', peligro: true }]
      });
      if (r !== 'si') return;
      try {
        await datos.darDeBaja(a.id, document.getElementById('baja-causa')?.value || 'Otra', document.getElementById('baja-fecha')?.value || hoyISO());
        aviso('Baja registrada.', 'ok');
      } catch (e) { aviso(e.message, 'error'); }
    });
  };
  dibujar();
  return datos.suscribir(dibujar);
}
