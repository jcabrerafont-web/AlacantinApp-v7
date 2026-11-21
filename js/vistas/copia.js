// Copia de seguridad: descargar todo el Libro de este dispositivo y restaurarlo.
import * as datos from '../datos.js';
import * as respaldo from '../respaldo.js';
import { supabaseConfigurado } from '../config.js';
import { h, pintar, $, aviso, confirmar, descargar, fecha, hoyISO } from '../ui.js';

const NOMBRES = { animales: 'ejemplares', calificaciones: 'calificaciones', huevos: 'huevos', campanas: 'campañas de puesta', lotes: 'lotes de reproducción', incubaciones: 'incubaciones', solicitudes: 'solicitudes de inspección', perfiles: 'perfiles', germoplasma: 'muestras de material genético' };

export default function (main) {
  const p = datos.estado.perfil;
  const completa = datos.rol() === 'administrador' && supabaseConfigurado();
  let copia = null;

  const dibujar = async () => {
    const u = await respaldo.ultimaCopia();
    const dias = u ? Math.floor((Date.now() - Date.parse(u)) / 86400000) : null;
    pintar(main, h`
      <p>${completa ? h`<a href="#/admin">← Administración</a>` : h`<a href="#/herramientas">← Herramientas</a>`}</p>
      <h1>Copia de seguridad</h1>
      ${supabaseConfigurado() ? h`<div class="aviso-caja info peq">Tus datos se guardan también en el Libro central del Club. La copia es una garantía adicional y sirve para llevarte tus datos.</div>`
        : h`<div class="aviso-caja aviso peq"><strong>Modo dispositivo:</strong> tus datos solo están en este móvil u ordenador. Si se pierde, se rompe o borras los datos del navegador, se pierden. Haz una copia con frecuencia y guárdala fuera del móvil: en el correo, en la nube o en un ordenador.</div>`}

      <div class="tarjeta"><h2>1. Descargar copia</h2>
        <p class="peq">${u ? `Última copia: ${fecha(u.slice(0, 10))} (hace ${dias} día${dias === 1 ? '' : 's'}).` : 'Todavía no has hecho ninguna copia en este dispositivo.'}</p>
        <label class="check-grande neutro"><input type="checkbox" id="cp-fotos" checked> Incluir las fotos (el archivo ocupa más)</label>
        ${completa ? h`<p class="peq">Como administrador, la copia es del <strong>Libro completo</strong>: antes de hacerla se baja de nuevo todo del servidor (ejemplares, calificaciones y puesta de todos los criadores, y los perfiles de los socios).</p>` : ''}
        <button class="btn btn-primario btn-bloque" id="cp-descargar">⬇️ ${completa ? 'Descargar copia completa del Libro' : 'Descargar copia de seguridad'}</button>
        <p class="ayuda">${completa ? h`Lleva datos personales de los socios (correo, teléfono, REGA): guárdala en un sitio protegido del Club, no en un móvil ni en un correo reenviado. No incluye contraseñas.`
          : h`Se descarga un archivo <code>.json</code> con tus ejemplares, calificaciones, huevos y campañas. No incluye contraseñas.`}</p>
      </div>

      <div class="tarjeta"><h2>2. Restaurar una copia</h2>
        <p class="peq">Para recuperar los datos en un móvil nuevo o después de un borrado. ${supabaseConfigurado() ? '' : 'Si la copia es de otra cuenta de este modo (por ejemplo, de tu móvil anterior), sus ejemplares pasarán a tu cuenta actual.'}</p>
        <input type="file" id="cp-archivo" aria-label="Archivo de copia de seguridad (.json)" accept=".json,application/json">
        <div id="cp-vista"></div>
      </div>`);

    $('#cp-descargar', main).addEventListener('click', async () => {
      const boton = $('#cp-descargar', main);
      const fotos = $('#cp-fotos', main).checked;
      try {
        if (completa) { boton.disabled = true; boton.textContent = 'Bajando el Libro del servidor…'; await datos.refrescarTodoDesdeServidor(); }
        const c = await respaldo.crearCopia(p, { incluirFotos: fotos });
        descargar(JSON.stringify(c), `AlacantinApp_${completa ? 'Libro_completo' : 'copia'}_${hoyISO()}.json`, 'application/json');
        await respaldo.marcarCopiaHecha();
        aviso(`Copia descargada: ${c.datos.animales.length} ejemplares. Guárdala fuera de este dispositivo.`, 'ok');
        dibujar();
      } catch (e) { aviso(`No se pudo crear la copia: ${e.message}`, 'error'); boton.disabled = false; dibujar(); }
    });

    $('#cp-archivo', main).addEventListener('change', async (e) => {
      const archivo = e.target.files?.[0];
      if (!archivo) return;
      try {
        copia = respaldo.validarCopia(JSON.parse(await archivo.text()));
      } catch (err) {
        copia = null;
        pintar($('#cp-vista', main), h`<div class="aviso-caja alerta peq">${err instanceof SyntaxError ? 'El archivo está dañado o no es una copia de AlacantinApp.' : err.message}</div>`);
        return;
      }
      const r = respaldo.resumenCopia(copia);
      const desc = Object.entries(copia.descartados);
      pintar($('#cp-vista', main), h`
        <div class="aviso-caja info peq" style="margin-top:.75rem">
          Copia del ${fecha(copia.creado.slice(0, 10))}${copia.perfil?.nombre ? ` · ${copia.perfil.nombre}` : ''} · versión ${copia.app || '—'}<br>
          ${Object.entries(r).filter(([, n]) => n).map(([t, n]) => `${n} ${NOMBRES[t]}`).join(' · ') || 'Sin datos'}
          ${desc.length ? h`<br>Se ignorarán registros incompletos: ${desc.map(([t, n]) => `${n} ${NOMBRES[t]}`).join(', ')}.` : ''}
        </div>
        <div class="fila" style="margin-top:.5rem">
          <button class="btn btn-primario" data-modo="fusionar">Fusionar con lo que hay</button>
          <button class="btn btn-peligro" data-modo="reemplazar">Reemplazar todo</button>
        </div>
        <p class="ayuda"><strong>Fusionar</strong> añade lo que falta y conserva la versión más reciente de cada registro. <strong>Reemplazar</strong> borra antes los ejemplares, calificaciones, huevos y campañas de este dispositivo.</p>`);
      main.querySelectorAll('[data-modo]').forEach(b => b.addEventListener('click', async () => {
        const modo = b.dataset.modo;
        if (modo === 'reemplazar' && !(await confirmar('Reemplazar todo', 'Se borrarán los datos actuales de este dispositivo y se sustituirán por los de la copia. ¿Continuar?', 'Reemplazar', true))) return;
        try {
          const { cuenta, adoptada } = await respaldo.restaurar(copia, p, { modo });
          await datos.cargar();
          aviso(`Restaurado: ${Object.entries(cuenta).filter(([, n]) => n).map(([t, n]) => `${n} ${NOMBRES[t]}`).join(' · ') || 'nada nuevo'}${adoptada ? ' · pasados a tu cuenta' : ''}.`, 'ok');
          location.hash = '#/censo';
        } catch (err) { aviso(`No se pudo restaurar: ${err.message}`, 'error'); }
      }));
    });
  };
  dibujar();
}
