import * as auth from '../auth.js';
import { supabaseConfigurado } from '../config.js';
import { iniciarSesion } from '../app.js';
import { estado } from '../datos.js';
import { h, pintar, $, aviso } from '../ui.js';
import { capaBasica } from './privacidad.js';

export default function (main) {
  if (estado.perfil) { location.hash = '#/censo'; return; }
  const local = !supabaseConfigurado();
  pintar(main, h`
    <div class="tarjeta" style="max-width:460px;margin:0 auto">
      <div class="fila entre"><h1>Acceso</h1>
        <div class="fila" role="tablist">
          <button class="btn btn-pequeno" data-tab="entrar" role="tab" aria-selected="true">Entrar</button>
          <button class="btn btn-pequeno" data-tab="registro" role="tab" aria-selected="false">Crear cuenta</button>
        </div>
      </div>
      ${local ? h`<div class="aviso-caja aviso peq">Modo dispositivo: los datos se guardan solo en este teléfono o tablet. Para compartir el Libro con el Club hay que configurar Supabase (ver README).</div>` : ''}

      <form id="form-entrar" novalidate>
        <div class="campo"><label for="e-email">Correo electrónico</label>
          <input id="e-email" type="email" autocomplete="username" required></div>
        <div class="campo"><label for="e-pass">Contraseña</label>
          <input id="e-pass" type="password" autocomplete="current-password" required></div>
        <button class="btn btn-primario btn-bloque" type="submit">Entrar</button>
        ${local ? '' : h`<p class="peq" style="margin:.75rem 0 0;text-align:center"><button class="enlace" type="button" id="e-olvido">¿Has olvidado la contraseña?</button></p>`}
      </form>

      <form id="form-olvido" novalidate hidden>
        <h2>Recuperar la contraseña</h2>
        <p class="peq muted">Te enviaremos un correo con un enlace para poner una contraseña nueva. Ábrelo en este mismo móvil u ordenador.</p>
        <div class="campo"><label for="o-email">Correo de tu cuenta</label>
          <input id="o-email" type="email" autocomplete="username" required></div>
        <button class="btn btn-primario btn-bloque" type="submit">Enviar el enlace</button>
        <p class="peq" style="margin:.75rem 0 0;text-align:center"><button class="enlace" type="button" id="o-volver">Volver a Entrar</button></p>
      </form>

      <form id="form-registro" novalidate hidden>
        <div class="campo"><label for="r-nombre">Nombre y apellidos</label>
          <input id="r-nombre" autocomplete="name" required></div>
        <div class="campo"><label for="r-email">Correo electrónico</label>
          <input id="r-email" type="email" autocomplete="email" required></div>
        <div class="campo"><label for="r-tel">Teléfono (opcional)</label>
          <input id="r-tel" type="tel" autocomplete="tel"></div>
        <div class="campo"><label for="r-pass">Contraseña (mín. 8 caracteres)</label>
          <input id="r-pass" type="password" autocomplete="new-password" minlength="8" required></div>
        <p class="ayuda">Las cuentas nuevas empiezan como <strong>Aspirante</strong>. Al añadir el código REGA oficial (ES + 12 dígitos) en «Mi aviario» pasan a <strong>Criador</strong>.</p>
        ${capaBasica()}
        <label class="check-grande neutro" style="margin:.75rem 0"><input type="checkbox" id="r-acepto" required>
          <span>Tengo 14 años o más y he leído la información sobre protección de datos.</span></label>
        <button class="btn btn-primario btn-bloque" type="submit">Crear cuenta</button>
      </form>

      <p class="muted peq" style="margin-top:1rem"><a href="#/privacidad">Política de privacidad</a> · ¿Solo quieres consultar? El <a href="#/estandar">Estándar</a>, la <a href="#/guia">Guía de campo</a> y el <a href="#/censo">Censo público</a> están abiertos sin cuenta.</p>
    </div>`);

  const tabs = main.querySelectorAll('[data-tab]');
  tabs.forEach(b => b.addEventListener('click', () => {
    tabs.forEach(x => x.setAttribute('aria-selected', String(x === b)));
    $('#form-entrar', main).hidden = b.dataset.tab !== 'entrar';
    $('#form-registro', main).hidden = b.dataset.tab !== 'registro';
    $('#form-olvido', main).hidden = true;
  }));

  // ¿Has olvidado la contraseña?
  $('#e-olvido', main)?.addEventListener('click', () => {
    $('#o-email', main).value = $('#e-email', main).value.trim();
    $('#form-entrar', main).hidden = true;
    $('#form-olvido', main).hidden = false;
    $('#o-email', main).focus();
  });
  $('#o-volver', main).addEventListener('click', () => {
    $('#form-olvido', main).hidden = true;
    $('#form-entrar', main).hidden = false;
  });

  const ocupado = (form, si) => form.querySelectorAll('button,input').forEach(el => { el.disabled = si; });

  $('#form-entrar', main).addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const f = ev.currentTarget;
    ocupado(f, true);
    try {
      const p = await auth.entrar($('#e-email', f).value, $('#e-pass', f).value);
      await iniciarSesion(p);
      aviso(`Bienvenido/a, ${p.nombre || p.email}`, 'ok');
      location.hash = '#/censo';
    } catch (e) {
      aviso(e.message, 'error');
    } finally { ocupado(f, false); }
  });

  $('#form-olvido', main).addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const f = ev.currentTarget;
    ocupado(f, true);
    let enviado = false;
    try {
      await auth.pedirRecuperacion($('#o-email', f).value);
      enviado = true;
    } catch (e) {
      aviso(e.message, 'error');
    } finally { ocupado(f, false); }
    if (enviado) {
      $('#o-volver', f).click();
      aviso('Si hay una cuenta con ese correo, en unos minutos te llegará el enlace. Mira también en «Spam» o «Promociones».', 'ok');
    }
  });

  $('#form-registro', main).addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const f = ev.currentTarget;
    const datosForm = { nombre: $('#r-nombre', f).value.trim(), email: $('#r-email', f).value, telefono: $('#r-tel', f).value.trim(), password: $('#r-pass', f).value };
    if (!datosForm.nombre || !datosForm.email) { aviso('Completa nombre y correo.', 'error'); return; }
    if (!$('#r-acepto', f).checked) { aviso('Para crear la cuenta, confirma que tienes 14 años o más y que has leído la información sobre protección de datos.', 'error'); $('#r-acepto', f).focus(); return; }
    ocupado(f, true);
    try {
      const r = await auth.registrar(datosForm);
      if (r.pendienteConfirmacion) {
        aviso('Te hemos enviado un correo para confirmar la cuenta: ábrelo y pulsa el enlace. Mira también en «Spam» o «Promociones».', 'ok');
        tabs[0].click();
        return;
      }
      await iniciarSesion(r);
      aviso('Cuenta creada. Completa los datos de tu aviario.', 'ok');
      location.hash = '#/perfil';
    } catch (e) {
      aviso(e.message, 'error');
    } finally { ocupado(f, false); }
  });
}
