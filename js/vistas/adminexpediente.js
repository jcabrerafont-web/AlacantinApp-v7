// Expediente para el Catálogo Oficial: los 14 apartados del Protocolo de la CNZ
// (5/6/2025, apdo. 3.1 a–n) con lo que ya aporta la app, lo que falta y lo que
// corresponde al Club o a una entidad científica. Solo informa; no cambia nada.
import * as datos from '../datos.js';
import { ESTANDAR, REGLAS } from '../estandar.js';
import { h, pintar } from '../ui.js';
import { recopilar } from './dossier.js';

const ESTADOS = { cubierto: ['Cubierto', 'chip-ok'], parte: ['En parte', 'chip-aviso'], pendiente: ['Pendiente en la app', 'chip-alerta'], club: ['Corresponde al Club', 'chip-info'] };

function apartados() {
  const activos = datos.estado.todos.filter(a => a.estado !== 'baja');
  const celdas = recopilar();
  const totalCasillas = ESTANDAR.variedades.length * 2 * REGLAS.tramosEdadMeses.length;
  const conFoto = [...celdas.values()].filter(l => l.length).length;
  const evol = datos.evolucionCenso();
  const criadores = new Set(activos.map(a => a.usuario_id).filter(Boolean)).size;
  const inspectores = datos.estado.perfiles.filter(p => p.rol === 'inspector').length;
  const conUbic = datos.aviarios().conUbicacion.length;
  const campanas = datos.estado.campanas.length;
  const sit = activos.length ? datos.situacionPoblacional() : null;
  return [
    ['a', 'Nombre de la raza', 'cubierto', 'Alacantina, con el Estándar oficial ESGA025.', [['#/estandar', 'Estándar']]],
    ['b', 'Historia de la raza', 'parte', 'Historia en cuatro etapas, del documento del Club. Faltan la primera directiva (2011–2013) y el VII encuentro, y conviene detallar la evolución territorial histórica.', [['#/conoce?s=historia', 'Historia de la raza']]],
    ['c', 'Morfología con fotos de ambos sexos, edades y variedades, y el estándar', conFoto === totalCasillas ? 'cubierto' : 'parte', `Dossier fotográfico: ${conFoto} de ${totalCasillas} casillas (variedad × sexo × edad) con foto.`, [['#/dossier', 'Dossier fotográfico'], ['#/estandar', 'Estándar']]],
    ['d', 'Estudios comparativos con razas afines', 'club', 'Estudio morfológico y productivo frente a razas afines (otras mediterráneas). Lo hace una entidad científica; la app aporta los datos de calificación y puesta.', []],
    ['e', 'Aptitudes pasadas y presentes', 'parte', `Presentes: control de puesta individual (${campanas} campaña(s) registradas). Pasadas: en la historia. Falta un resumen de puesta de toda la raza por año.`, [['#/campanas', 'Control de puesta']]],
    ['f', 'Censos y su tendencia por sexo y edad, criadores y distribución territorial', 'cubierto', `Evolución del censo año a año (${evol.length} año(s)), censo por sexo y edad, ${criadores} criador(es) con ejemplares, distribución por municipio y mapa (${conUbic} aviario(s) con ubicación).`, [['#/informes', 'Informes'], ['#/mapa', 'Mapa de aviarios']]],
    ['g', 'Situación poblacional para la categoría del Catálogo', sit ? 'cubierto' : 'parte', sit
      ? `Con los criterios de la CNZ para aves (media ${sit.anios[0]}–${sit.anios[2]}): ${sit.amenazada ? `raza amenazada, grado ${sit.grado}` : 'no amenazada'} (${Math.round(sit.medias.hembras)} hembras que criaron en pureza, ${Math.round(sit.medias.machos)} machos y ${Math.round(sit.medias.reposicion)} de reposición al año), con Ne, consanguinidad y tendencia como información complementaria.`
      : 'Se calcula con los criterios de la CNZ para aves en cuanto haya ejemplares en el Libro.', [['#/informes', 'Informes › Situación poblacional']]],
    ['h', 'Caracterización genética', 'club', 'Análisis de ADN en un laboratorio, salvo que el número de ejemplares no lo permita.', []],
    ['i', 'Gestión y organización de la raza', 'club', `Estatutos, Dirección Técnica e inspectores. En la app: ${inspectores} inspector(es) nombrado(s), roles y panel de inspección.`, [['#/usuarios', 'Usuarios y roles']]],
    ['j', 'Tamaño efectivo, variabilidad genética y endogamia', 'cubierto', 'Ne demográfico y realizado, consanguinidad de Wright, generaciones equivalentes y matriz de pedigrí para ENDOG.', [['#/informes', 'Informes']]],
    ['k', 'Utilización sostenible de la raza', 'club', 'Plan del Club: usos (huevo, exposición, conservación), difusión y relevo de criadores.', []],
    ['l', 'Asociación de criadores y número de criadores', 'cubierto', `Asociación Club Gallina Alacantina; ${datos.estado.perfiles.length} usuario(s), ${criadores} con ejemplares.`, [['#/usuarios', 'Usuarios'], ['#/conoce?s=club', 'El Club']]],
    ['m', 'Material genético almacenado (banco de germoplasma)', 'pendiente', 'Inventario de muestras (semen, etc.) cuando las haya. Hoy no hay muestras.', []],
    ['n', 'Propuesta de programa de cría, con datos y resultados', 'pendiente', 'Borrador generado por la app con sus reglas (estructura del Libro, calificación, objetivos de conservación) y los resultados reales. Lo redacta y aprueba el Club.', [['#/programa', 'Guía del criador']]]
  ];
}

export default function (main) {
  const lista = apartados();
  const cuenta = (e) => lista.filter(x => x[2] === e).length;
  pintar(main, h`
    <p class="peq"><a href="#/admin">‹ Administración</a></p>
    <h1>Expediente para el Catálogo</h1>
    <p class="muted">Lo que pide el Protocolo de la Comisión Nacional de Zootecnia (5 de junio de 2025, apartado 3.1) para incluir una raza autóctona en el Catálogo Oficial, y en qué punto estamos. Toda la solicitud debe ir avalada por el informe de una entidad científica.</p>
    <div class="kpis">
      ${Object.entries(ESTADOS).map(([k, [n]]) => h`<div class="kpi"><b>${cuenta(k)}</b><span>${n}</span></div>`)}
    </div>
    <ul class="lista tarjeta expediente">${lista.map(([letra, titulo, estado, texto, enlaces]) => h`<li class="item" id="exp-${letra}">
      <div class="item-principal">
        <div class="item-titulo"><span class="exp-letra">${letra})</span> ${titulo} <span class="chip ${ESTADOS[estado][1]}">${ESTADOS[estado][0]}</span></div>
        <div class="item-sub">${texto}</div>
        ${enlaces.length ? h`<div class="peq" style="margin-top:.25rem">${enlaces.map(([href, t], i) => h`${i ? ' · ' : ''}<a href="${href}">${t} →</a>`)}</div>` : ''}
      </div></li>`)}</ul>
    <p class="peq muted">Resumen orientativo para la Junta y la Dirección Técnica; no sustituye al texto del Protocolo.</p>`);
}
