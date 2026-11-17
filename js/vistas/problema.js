// Informar de un problema: el criador describe qué pasó y lo envía con los datos técnicos
import * as datos from '../datos.js';
import { CONFIG } from '../config.js';
import * as diag from '../diagnostico.js';
import { h, pintar, $, aviso } from '../ui.js';

export default async function (main) {
  const tecnico = await diag.informe({ datos });
  pintar(main, h`
    <h1>Informar de un problema</h1>
    <form id="f-problema" class="tarjeta" novalidate>
      <div class="campo"><label for="pr-texto">¿Qué ha pasado?</label>
        <textarea id="pr-texto" rows="4" placeholder="Qué estabas haciendo, qué esperabas y qué ha pasado."></textarea></div>
      <label class="fila peq" style="font-weight:500"><input type="checkbox" id="pr-tecnico" checked> Incluir los datos técnicos (sin datos personales)</label>
      <details class="peq" style="margin:.5rem 0"><summary>Ver los datos técnicos</summary><pre class="pre-informe">${tecnico}</pre></details>
      <div class="acciones-fijas">
        <button class="btn btn-primario" type="button" id="pr-wa">💬 WhatsApp</button>
        <button class="btn" type="button" id="pr-mail">✉️ Correo</button>
        <button class="btn" type="button" id="pr-copiar">Copiar</button>
      </div>
    </form>
    ${diag.errores().length ? h`<p class="peq muted">${diag.errores().length} error(es) registrado(s) en este móvil. <button class="enlace" type="button" id="pr-limpiar">Borrar el registro</button></p>` : ''}`);
  const f = $('#f-problema', main);
  const texto = () => [`Problema en AlacantinApp:`, $('#pr-texto', f).value.trim() || '(sin descripción)', ...($('#pr-tecnico', f).checked ? ['', '— Datos técnicos —', tecnico] : [])].join('\n');
  $('#pr-wa', f).addEventListener('click', () => { window.open(`https://wa.me/${CONFIG.soporteWhatsApp || ''}?text=${encodeURIComponent(texto())}`, '_blank', 'noopener'); });
  $('#pr-mail', f).addEventListener('click', () => { location.href = `mailto:${CONFIG.soporteEmail || ''}?subject=${encodeURIComponent(`Problema en AlacantinApp ${CONFIG.version}`)}&body=${encodeURIComponent(texto())}`; });
  $('#pr-copiar', f).addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(texto()); aviso('Copiado: pégalo donde quieras enviarlo.', 'ok'); }
    catch { aviso('No se pudo copiar. Abre «Ver los datos técnicos» y cópialos a mano.', 'error'); }
  });
  $('#pr-limpiar', main)?.addEventListener('click', () => { diag.borrarErrores(); aviso('Registro de errores borrado.', 'ok'); location.hash = '#/herramientas'; });
}
