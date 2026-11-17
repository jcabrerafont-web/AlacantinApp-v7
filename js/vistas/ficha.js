// Ficha del ejemplar (datos, genealogía, puesta, calificaciones y acciones según rol)
import * as datos from '../datos.js';
import { esAuditor } from '../auth.js';
import { ESTANDAR, REGLAS, sumarMeses, anillaLegible, parsearAnilla, nombreVariedad, sexoTexto, pesoConforme, edadMeses, variedadPorId } from '../estandar.js';
import { nivelFx, generacionesEquivalentes } from '../genetica.js';
import * as docs from '../documentos.js';
import { h, pintar, $, aviso, fecha, kg, pct, dialogo, confirmar, hoyISO } from '../ui.js';

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
    const rm = verPrivado && a.estado !== 'baja' ? datos.meritosRM(completo) : null;
    const admin = datos.rol() === 'administrador';
    const rd = verPrivado && a.estado !== 'baja' && a.seccion === 'RN' ? datos.requisitosRD(completo) : null;
    const criador = completo.criador_id && completo.criador_id !== completo.usuario_id ? datos.estado.perfiles.find(x => x.id === completo.criador_id) : null;
    const enlace = (x) => (x ? h`<a href="#/animal/${x.id}">${x.anilla}</a>${x.nombre ? h` · ${x.nombre}` : ''}` : h`<span class="muted">No registrado</span>`);

    pintar(main, h`
      <p><a href="#/censo">← Censo</a></p>
      <div class="tarjeta">
        <div class="fila entre">
          <div class="fila"><span class="sexo sexo-${a.sexo}">${a.sexo === 'M' ? '♂' : '♀'}</span>
            <div><h1 style="margin:0">${a.anilla}</h1><div class="muted">${a.nombre || sexoTexto(a.sexo)}</div></div></div>
          <div class="fila">
            <span class="chip ${['RD', 'RM'].includes(a.seccion) ? 'chip-ok' : 'chip-info'}">${a.seccion === 'RM' ? '★ ' : ''}${a.seccion} · ${ESTANDAR.secciones[a.seccion]}</span>
            ${a.estado === 'baja' ? h`<span class="chip chip-alerta">Baja</span>` : ''}
          </div>
        </div>
        <table style="margin-top:.75rem"><tbody>
          <tr><th>Sexo</th><td>${sexoTexto(a.sexo)}</td></tr>
          <tr><th>Anilla EE</th><td>${anillaLegible(a.anilla)}${parsearAnilla(a.anilla) ? ` · ${parsearAnilla(a.anilla).diametro} mm${parsearAnilla(a.anilla).diametro !== ESTANDAR.anilla[a.sexo] ? ` (Estándar ${ESTANDAR.anilla[a.sexo]} mm)` : ''}` : ''}</td></tr>
          <tr><th>Variedad</th><td>${nombreVariedad(a.variedad)} ${v && !v.oficial ? h`<span class="chip chip-aviso">En proceso</span>` : ''}</td></tr>
          <tr><th>Nacimiento</th><td>${fecha(a.fecha_nacimiento)}${meses !== null ? ` · ${meses} meses` : ''}</td></tr>
          <tr><th>Peso</th><td>${kg(a.peso_g)} ${conf === true ? h`<span class="chip chip-ok">Estándar</span>` : conf === false ? h`<span class="chip chip-aviso">Fuera de rango</span>` : ''}</td></tr>
          <tr><th>Familia</th><td>${a.familia ? `Familia ${a.familia}` : '—'}</td></tr>
          <tr><th>Padre</th><td>${enlace(padre)}</td></tr>
          <tr><th>Madre</th><td>${enlace(madre)}</td></tr>
          <tr><th>Consanguinidad</th><td>${pct(fx, 3)} <span class="chip ${nf.nivel === 'alerta' ? 'chip-alerta' : nf.nivel === 'precaucion' ? 'chip-aviso' : 'chip-ok'}">${nf.texto}</span>
            <div class="muted peq">Generaciones equivalentes conocidas: ${generacionesEquivalentes(a.id, datos.estado.idx).toFixed(2).replace('.', ',')}</div></td></tr>
          ${verPrivado ? h`<tr><th>Aviario</th><td>${a.rega || 'REGA pendiente'} · ${a.municipio || '—'}</td></tr>
            ${criador ? h`<tr><th>Criador de origen</th><td>${criador.nombre || criador.email}</td></tr>` : ''}
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
        ${admin && a.estado !== 'baja' ? h`<button class="btn" id="b-titular">Cambiar titular</button>` : ''}
        ${propio && a.estado !== 'baja' ? h`<button class="btn btn-peligro" id="b-baja">Dar de baja</button>` : ''}
      </div>

      ${puesta ? h`<div class="tarjeta"><div class="fila entre"><h2>Puesta</h2><a class="btn btn-pequeno" href="#/puesta?gallina=${a.id}">🥚 Registrar</a></div>
        ${puesta.n ? h`<div class="kpis">
          <div class="kpi"><b>${puesta.n}</b><span>Huevos pesados</span></div>
          <div class="kpi"><b>${puesta.media.toFixed(1).replace('.', ',')} g</b><span>Peso medio</span></div>
          <div class="kpi"><b>${puesta.aptos}/${puesta.n}</b><span>Aptos (desde ${ESTANDAR.huevo.min} g, blanco crema)</span></div></div>`
          : h`<p class="muted">Sin huevos registrados.</p>`}</div>` : ''}

      ${verPrivado ? h`<div class="tarjeta"><h2>Calificaciones</h2>
        ${a.seccion === 'RN' && califs[0]?.resultado === 'Apto' && meses !== null && meses < REGLAS.edadMinimaRD_meses && v?.oficial
          ? h`<div class="aviso-caja info peq">Apto, pero el Registro Definitivo exige un año de edad: podrá calificarse de nuevo a partir del ${fecha(sumarMeses(a.fecha_nacimiento, REGLAS.edadMinimaRD_meses))}.</div>` : ''}
        ${califs.length ? h`<ul class="lista">${califs.map(c => h`<li class="item"><div class="item-principal">
          <div class="item-titulo">${c.clase ?? '—'} · ${c.total === undefined || c.total === null ? "—" : String(c.total).replace(".", ",")} puntos · ${c.resultado} · ${fecha(c.fecha)}</div>
          <div class="item-sub">${c.inspector_nombre}${c.defectos?.length ? ` · ${c.defectos.length} defecto(s) descalificante(s)` : ''}</div></div>
          <button class="btn btn-pequeno" data-acta="${c.id}">Acta</button></li>`)}</ul>`
          : h`<p class="muted">Sin calificar. ${propio ? 'La califica un inspector del Club en visita al aviario.' : ''}</p>`}</div>` : ''}

      ${rd ? h`<div class="tarjeta"><h2>Camino al Registro Definitivo</h2>
        <ul class="lista-simple">${rd.lista.map(x => h`<li>${x.ok ? '✓' : '○'} ${x.texto}</li>`)}</ul>
        <p class="muted peq">${rd.cumple ? 'Cumple todo: pasará al RD con su calificación.' : 'Cuando se cumpla todo, una calificación Apto lo pasa al RD. '}<a href="#/programa?s=libro">¿Por qué?</a></p>
        ${auditor ? h`<div class="fila"><button class="btn" data-base="RF">Inscribir en RF (fundador)</button><button class="btn" data-base="RA">Inscribir en RA (auxiliar)</button></div>` : ''}
      </div>` : ''}

      ${a.seccion === 'RM' ? h`<div class="tarjeta"><h2>★ Registro de Méritos</h2>
        <p>Inscrito el ${fecha(a.rm_fecha)} · ${a.rm_via === 'premio' ? 'por premio' : 'por calificación y descendencia'}${a.rm_motivo ? h`<br><span class="muted">${a.rm_motivo}</span>` : ''}</p></div>`
      : rm && rm.origenValido ? h`<div class="tarjeta"><h2>Camino al Registro de Méritos</h2>
        <ul class="lista-simple">
          <li>${rm.cumplePuntos ? '✓' : '○'} Calificación: <strong>${rm.mejorPuntos === null ? 'sin calificar' : String(rm.mejorPuntos).replace('.', ',')}</strong> / ${rm.req.puntos} puntos</li>
          <li>${rm.cumpleHijos ? '✓' : '○'} Descendientes en el Registro Definitivo: <strong>${rm.hijosRD}</strong> / ${rm.req.hijosRD}</li>
        </ul>
        <p class="muted peq">Requisitos equiparados a la reglamentación oficial del Libro de la Castellana Negra (${a.sexo === 'M' ? 'gallos' : 'gallinas'}). La inscripción la acuerda la administración del Libro.</p>
        ${admin ? h`<div class="fila"><button class="btn btn-primario" id="b-rm" ${rm.cumple ? '' : h`disabled`}>★ Inscribir en RM</button>
          ${rm.cumplePuntos && !rm.cumpleHijos ? h`<button class="btn" id="b-rm-premio">Inscribir por premio…</button>` : ''}</div>` : ''}
      </div>` : ''}

      ${hijos.length ? h`<div class="tarjeta"><h2>Descendencia (${hijos.length})</h2><ul class="lista">
        ${hijos.map(x => h`<li><a class="item" href="#/animal/${x.id}"><span class="sexo sexo-${x.sexo}">${x.sexo === 'M' ? '♂' : '♀'}</span>
          <span class="item-principal"><span class="item-titulo">${x.anilla}</span><span class="item-sub">${fecha(x.fecha_nacimiento)} · ${x.seccion}</span></span></a></li>`)}</ul></div>` : ''}`);

    const titular = () => datos.estado.perfiles.find(x => x.id === completo.usuario_id) || (propio ? datos.estado.perfil : null);
    $('#b-cert', main)?.addEventListener('click', () => {
      // Rendimiento: acumulado de la temporada más reciente con campañas; si no, la puesta registrada
      const temporadas = [...new Set(datos.estado.campanas.map(c => c.temporada))].sort((x, y) => y - x);
      let rendimiento = null;
      for (const t of temporadas) {
        const f = datos.temporadaPuesta(t).filas.find(x => x.id === completo.id);
        if (f?.n) { rendimiento = { ...f, etiqueta: `Campañas ${t}` }; break; }
      }
      docs.certificado(completo, { idx: datos.estado.idx, titular: titular(), ultimaCalificacion: califs[0],
        criador: completo.criador_id && completo.criador_id !== completo.usuario_id ? datos.estado.perfiles.find(x => x.id === completo.criador_id) : null, rendimiento });
    });
    main.querySelectorAll('[data-acta]').forEach(b => b.addEventListener('click', () =>
      docs.acta(completo, califs.find(c => c.id === b.dataset.acta), titular())));
    $('#b-rm', main)?.addEventListener('click', async () => {
      if (!(await confirmar('Registro de Méritos', `Inscribir ${a.anilla} en el RM por calificación y descendencia.`, 'Inscribir'))) return;
      try { await datos.inscribirRM(a.id, { via: 'requisitos' }); aviso(`${a.anilla} inscrito en el Registro de Méritos.`, 'ok'); }
      catch (e) { aviso(e.message, 'error'); }
    });
    $('#b-rm-premio', main)?.addEventListener('click', async () => {
      const r = await dialogo({
        titulo: `RM por premio · ${a.anilla}`,
        cuerpo: h`<div class="campo"><label for="rm-motivo">Premio (certamen, fecha y distinción)</label><textarea id="rm-motivo" placeholder="Ej.: Campeonato de España 2026, Valencia · 1º premio gallo Blanca"></textarea></div>`,
        acciones: [{ valor: 'no', texto: 'Cancelar' }, { valor: 'si', texto: 'Inscribir' }]
      });
      if (r !== 'si') return;
      try { await datos.inscribirRM(a.id, { via: 'premio', motivo: document.getElementById('rm-motivo')?.value || '' }); aviso(`${a.anilla} inscrito en el Registro de Méritos.`, 'ok'); }
      catch (e) { aviso(e.message, 'error'); }
    });
    main.querySelectorAll('[data-base]').forEach(b => b.addEventListener('click', async () => {
      const sec = b.dataset.base;
      const r = await dialogo({
        titulo: `Inscribir ${a.anilla} en ${sec}`,
        cuerpo: h`<p class="peq">${sec === 'RF' ? 'Registro Fundacional: animales con los que arranca el Libro de la raza.' : 'Registro Auxiliar: buena morfología, pero sin genealogía completa.'} Sus hijos podrán pasar al RD.</p>
          <div class="campo"><label for="base-motivo">Motivo</label><textarea id="base-motivo" placeholder="Ej.: fundador de la raza, revisado en el aviario de …"></textarea></div>`,
        acciones: [{ valor: 'no', texto: 'Cancelar' }, { valor: 'si', texto: `Inscribir en ${sec}` }]
      });
      if (r !== 'si') return;
      try { await datos.inscribirSeccionBase(a.id, sec, document.getElementById('base-motivo')?.value || ''); aviso(`${a.anilla} inscrito en ${sec}.`, 'ok'); }
      catch (e) { aviso(e.message, 'error'); }
    }));
    $('#b-titular', main)?.addEventListener('click', async () => {
      const socios = datos.estado.perfiles.filter(x => x.id !== completo.usuario_id);
      const r = await dialogo({
        titulo: `Cambiar titular de ${a.anilla}`,
        cuerpo: h`<p class="peq">Para ventas o cesiones a otro socio: el animal sigue en el Libro con el nuevo propietario y hereda su REGA. El criador de origen se conserva.</p>
          <div class="campo"><label for="nuevo-titular">Nuevo titular</label><select id="nuevo-titular">${socios.map(x => h`<option value="${x.id}">${x.nombre || x.email}${x.rega ? ` · ${x.rega}` : ''}</option>`)}</select></div>`,
        acciones: [{ valor: 'no', texto: 'Cancelar' }, { valor: 'si', texto: 'Cambiar titular' }]
      });
      if (r !== 'si') return;
      try { await datos.cambiarTitular(a.id, document.getElementById('nuevo-titular')?.value); aviso('Titular cambiado.', 'ok'); }
      catch (e) { aviso(e.message, 'error'); }
    });
    $('#b-baja', main)?.addEventListener('click', async () => {
      const r = await dialogo({
        titulo: `Baja de ${a.anilla}`,
        cuerpo: h`<p class="peq muted">Si lo vendes o cedes a otro socio del Club, no lo des de baja: pide a la administración el cambio de titular para que siga en el Libro.</p>
          <div class="campo"><label for="baja-causa">Causa</label><select id="baja-causa">
          <option>Muerte</option><option>Venta fuera del Club</option><option>Cesión fuera del Club</option><option>Sacrificio</option><option>Desaparición</option><option>Otra</option></select></div>
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
