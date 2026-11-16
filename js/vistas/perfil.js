// Mi aviario: datos del titular que heredan las altas (REGA, municipio, ubicación GPS)
import * as datos from '../datos.js';
import * as auth from '../auth.js';
import { iniciarSesion } from '../app.js';
import { h, pintar, $, aviso } from '../ui.js';

export default function (main) {
  const p = datos.estado.perfil;
  pintar(main, h`
    <h1>Mi aviario</h1>
    <form id="form-perfil" class="tarjeta" novalidate>
      <div class="rejilla rejilla-2">
        <div class="campo"><label for="pf-nombre">Nombre y apellidos</label><input id="pf-nombre" value="${p.nombre || ''}" autocomplete="name"></div>
        <div class="campo"><label for="pf-tel">Teléfono</label><input id="pf-tel" type="tel" value="${p.telefono || ''}" autocomplete="tel"></div>
        <div class="campo"><label for="pf-rega">Código REGA</label>
          <input id="pf-rega" value="${p.rega || ''}" placeholder="ES + 12 dígitos" autocapitalize="characters" autocomplete="off">
          <p class="ayuda" id="pf-rega-ayuda"></p></div>
        <div class="campo"><label for="pf-socio">Nº de socio del Club</label><input id="pf-socio" value="${p.numero_socio || ''}"></div>
        <div class="campo"><label for="pf-mun">Municipio</label><input id="pf-mun" value="${p.municipio || ''}" autocomplete="address-level2"></div>
        <div class="campo"><label for="pf-prov">Provincia</label><input id="pf-prov" value="${p.provincia || ''}" autocomplete="address-level1"></div>
      </div>
      <fieldset><legend>Ubicación del aviario</legend>
        <p id="pf-gps" class="muted">${p.latitud != null ? `${Number(p.latitud).toFixed(5)}, ${Number(p.longitud).toFixed(5)}` : 'Sin ubicación registrada'}</p>
        <button class="btn" type="button" id="pf-capturar">📍 Usar mi ubicación actual</button>
        <p class="ayuda">Captúrala estando en el aviario. Solo la ven tú, los inspectores y la administración del Club.</p>
      </fieldset>
      <button class="btn btn-primario" type="submit">Guardar</button>
    </form>
    <form id="form-pass" class="tarjeta" novalidate>
      <h2>Cambiar contraseña</h2>
      <div class="campo"><label for="pf-pass">Nueva contraseña (mín. 8)</label><input id="pf-pass" type="password" autocomplete="new-password" minlength="8"></div>
      <button class="btn" type="submit">Cambiar contraseña</button>
    </form>`);

  const f = $('#form-perfil', main);
  let lat = p.latitud ?? null;
  let lng = p.longitud ?? null;
  const ayudaRega = () => {
    const v = $('#pf-rega', f).value.trim().toUpperCase();
    $('#pf-rega-ayuda', f).textContent = !v ? 'Sin REGA la cuenta es de Aspirante.'
      : auth.regaValido(v) ? '✓ Formato oficial válido' : 'Formato: ES seguido de 12 dígitos';
  };
  $('#pf-rega', f).addEventListener('input', ayudaRega);
  ayudaRega();

  $('#pf-capturar', f).addEventListener('click', () => {
    if (!navigator.geolocation) { aviso('Este dispositivo no ofrece geolocalización.', 'error'); return; }
    $('#pf-gps', f).textContent = 'Obteniendo ubicación…';
    navigator.geolocation.getCurrentPosition(pos => {
      lat = Math.round(pos.coords.latitude * 1e6) / 1e6;
      lng = Math.round(pos.coords.longitude * 1e6) / 1e6;
      $('#pf-gps', f).textContent = `${lat.toFixed(5)}, ${lng.toFixed(5)} (±${Math.round(pos.coords.accuracy)} m)`;
    }, err => {
      $('#pf-gps', f).textContent = 'No se pudo obtener la ubicación';
      aviso(err.code === 1 ? 'Permiso de ubicación denegado.' : 'Sin señal GPS. Prueba en exterior.', 'error');
    }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
  });

  f.addEventListener('submit', async e => {
    e.preventDefault();
    const rega = $('#pf-rega', f).value.trim().toUpperCase();
    if (rega && !auth.regaValido(rega)) { aviso('El REGA debe ser ES seguido de 12 dígitos.', 'error'); return; }
    try {
      const rolAntes = p.rol;
      const { perfil, paraServidor } = await auth.actualizarPerfil(p, {
        nombre: $('#pf-nombre', f).value.trim(), telefono: $('#pf-tel', f).value.trim(), rega: rega || null,
        numero_socio: $('#pf-socio', f).value.trim(), municipio: $('#pf-mun', f).value.trim(),
        provincia: $('#pf-prov', f).value.trim(), latitud: lat, longitud: lng
      });
      await datos.guardarPerfilServidor(paraServidor);
      await iniciarSesion(perfil);
      aviso(rolAntes === 'aspirante' && perfil.rol === 'criador' ? '🟢 REGA registrado: ya eres Criador.' : 'Datos guardados.', 'ok');
    } catch (err) { aviso(err.message, 'error'); }
  });

  $('#form-pass', main).addEventListener('submit', async e => {
    e.preventDefault();
    try {
      await auth.cambiarPassword(p.email, $('#pf-pass', main).value);
      $('#pf-pass', main).value = '';
      aviso('Contraseña actualizada.', 'ok');
    } catch (err) { aviso(err.message, 'error'); }
  });
}
