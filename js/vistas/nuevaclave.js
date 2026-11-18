// Contraseña nueva, tras abrir el enlace del correo «Recuperar la contraseña».
import * as auth from '../auth.js';
import { estado } from '../datos.js';
import { h, pintar, $, aviso } from '../ui.js';

export default function (main) {
  const p = estado.perfil;
  pintar(main, h`
    <div class="tarjeta" style="max-width:460px;margin:0 auto">
      <h1>Contraseña nueva</h1>
      <p class="muted">Cuenta: <strong>${p.email}</strong>. Escribe la contraseña nueva dos veces.</p>
      <form id="form-clave" novalidate>
        <div class="campo"><label for="nc-pass">Contraseña nueva (mín. 8 caracteres)</label>
          <input id="nc-pass" type="password" autocomplete="new-password" minlength="8" required></div>
        <div class="campo"><label for="nc-pass2">Repite la contraseña</label>
          <input id="nc-pass2" type="password" autocomplete="new-password" minlength="8" required></div>
        <button class="btn btn-primario btn-bloque" type="submit">Guardar la contraseña</button>
      </form>
      <p class="peq muted" style="margin-top:1rem">Si no has pedido cambiar la contraseña, puedes seguir usando la app: la de antes sigue valiendo hasta que guardes una nueva.</p>
    </div>`);

  const f = $('#form-clave', main);
  $('#nc-pass', f).focus();
  f.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const a = $('#nc-pass', f).value;
    const b = $('#nc-pass2', f).value;
    if (a.length < 8) { aviso('La contraseña debe tener al menos 8 caracteres.', 'error'); $('#nc-pass', f).focus(); return; }
    if (a !== b) { aviso('Las dos contraseñas no coinciden.', 'error'); $('#nc-pass2', f).focus(); return; }
    f.querySelectorAll('button,input').forEach(el => { el.disabled = true; });
    try {
      await auth.cambiarPassword(p.email, a);
      aviso('Contraseña guardada. A partir de ahora, entra con la nueva.', 'ok');
      location.hash = '#/censo';
    } catch (e) {
      aviso(e.message, 'error');
      f.querySelectorAll('button,input').forEach(el => { el.disabled = false; });
    }
  });
}
