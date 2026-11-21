// Mi aviario: datos del titular que heredan las altas (REGA, municipio, ubicación GPS)
import * as datos from '../datos.js';
import * as auth from '../auth.js';
import { iniciarSesion } from '../app.js';
import { h, pintar, $, aviso, descargar, hoyISO, confirmar } from '../ui.js';
import { CONFIG } from '../config.js';

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
          <p class="ayuda" id="pf-rega-ayuda"></p>
          <p class="ayuda" id="pf-rega-como"><a href="#/conoce?s=empezar">¿No tienes REGA? Cómo se pide →</a></p></div>
        <div class="campo"><label for="pf-socio">Nº de socio del Club</label><input id="pf-socio" value="${p.numero_socio || ''}"></div>
        <div class="campo"><label for="pf-mun">Municipio</label><input id="pf-mun" value="${p.municipio || ''}" autocomplete="address-level2"></div>
        <div class="campo"><label for="pf-prov">Provincia</label><input id="pf-prov" value="${p.provincia || ''}" autocomplete="address-level1"></div>
      </div>
      <fieldset><legend>Ubicación del aviario</legend>
        <p id="pf-gps" class="muted">${p.latitud != null ? `${Number(p.latitud).toFixed(5)}, ${Number(p.longitud).toFixed(5)}` : 'Sin ubicación registrada'}</p>
        <div class="fila" style="flex-wrap:wrap;gap:.5rem"><button class="btn" type="button" id="pf-capturar">📍 Usar mi ubicación actual</button>
          <button class="btn" type="button" id="pf-borrar-gps" ${p.latitud != null ? '' : h`hidden`}>Borrar la ubicación</button></div>
        <p class="ayuda"><strong>Pulsa el botón estando en el aviario, junto a los gallineros:</strong> se guarda la posición del móvil en ese momento, así que si lo haces desde casa o desde otro sitio, el inspector irá allí.</p>
        <p class="ayuda">Opcional. Sirve para que el inspector llegue al aviario. Al pulsar «Usar mi ubicación actual» das tu consentimiento para que el Club la guarde; puedes borrarla cuando quieras. Solo la ven tú, la inspección y la administración del Club.</p>
      </fieldset>
      <button class="btn btn-primario" type="submit">Guardar</button>
    </form>
    <div class="tarjeta" id="pf-mis-datos"><h2>Tus datos y tus derechos</h2>
      <p class="peq">Aquí puedes corregir tus datos. También puedes descargar una copia de todo lo tuyo (portabilidad) o pedir la baja y ejercer tus demás derechos. <a href="#/privacidad">Política de privacidad</a></p>
      <div class="fila" style="flex-wrap:wrap;gap:.5rem">
        <button class="btn" type="button" id="pf-descargar">⬇️ Descargar mis datos</button>
        <a class="btn" id="pf-derechos" href="mailto:${CONFIG.club.email}?subject=${encodeURIComponent('Protección de datos: ejercicio de derechos')}&body=${encodeURIComponent(`Nombre: ${p.nombre || ''}
Correo de la cuenta: ${p.email || ''}

Solicito (marca lo que corresponda): acceso / rectificación / supresión (baja) / oposición / limitación / portabilidad.

Detalle:
`)}">✉️ Pedir la baja o ejercer un derecho</a>
      </div></div>
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
    $('#pf-rega-como', f).hidden = auth.regaValido(v);
  };
  $('#pf-rega', f).addEventListener('input', ayudaRega);
  ayudaRega();

  // Retirar el consentimiento de la ubicación: se borra al momento
  $('#pf-borrar-gps', f).addEventListener('click', async () => {
    try {
      const { perfil, paraServidor } = await auth.actualizarPerfil(datos.estado.perfil, { latitud: null, longitud: null });
      await datos.guardarPerfilServidor(paraServidor);
      await iniciarSesion(perfil);
      lat = null; lng = null;
      $('#pf-gps', f).textContent = 'Sin ubicación registrada';
      $('#pf-borrar-gps', f).hidden = true;
      aviso('Ubicación borrada.', 'ok');
    } catch (err) { aviso(err.message, 'error'); }
  });
  // Portabilidad: todo lo del usuario en un archivo JSON legible
  $('#pf-descargar', main).addEventListener('click', () => {
    const e = datos.estado, yo = e.perfil.id;
    const mios = e.todos.filter(a => a.usuario_id === yo || a.criador_id === yo);
    const ids = new Set(mios.map(a => a.id));
    const perfil = Object.fromEntries(['id', 'nombre', 'email', 'telefono', 'numero_socio', 'rega', 'municipio', 'provincia', 'latitud', 'longitud', 'rol', 'created_at', 'updated_at'].map(k => [k, e.perfil[k] ?? null]));
    const contenido = { formato: 'alacantinapp-mis-datos', fecha: new Date().toISOString(), responsable: CONFIG.club.nombre, perfil,
      ejemplares: mios.map(({ fotos, ...a }) => ({ ...a, fotos: Object.keys(fotos || {}) })),
      calificaciones: e.calificaciones.filter(c => ids.has(c.animal_id)), huevos: e.huevos.filter(x => ids.has(x.animal_id)),
      campanas: e.campanas.filter(x => x.usuario_id === yo), lotes: e.lotes.filter(x => x.usuario_id === yo),
      incubaciones: e.incubaciones.filter(x => x.usuario_id === yo), solicitudes: e.solicitudes.filter(x => x.usuario_id === yo) };
    descargar(JSON.stringify(contenido, null, 2), `AlacantinApp_mis_datos_${hoyISO()}.json`, 'application/json');
    aviso('Descargado: un archivo con todos tus datos.', 'ok');
  });
  $('#pf-capturar', f).addEventListener('click', async () => {
    if (!navigator.geolocation) { aviso('Este dispositivo no ofrece geolocalización.', 'error'); return; }
    if (!(await confirmar('¿Estás ahora en tu aviario?', 'Se guarda la posición del móvil en este momento. Si estás en casa o en otro sitio, hazlo cuando vayas al aviario, junto a los gallineros.', 'Sí, estoy en el aviario'))) return;
    $('#pf-gps', f).textContent = 'Obteniendo ubicación…';
    navigator.geolocation.getCurrentPosition(pos => {
      lat = Math.round(pos.coords.latitude * 1e6) / 1e6;
      lng = Math.round(pos.coords.longitude * 1e6) / 1e6;
      const prec = Math.round(pos.coords.accuracy);
      pintar($('#pf-gps', f), h`${lat.toFixed(5)}, ${lng.toFixed(5)} (±${prec} m) · <a href="https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=18/${lat}/${lng}" target="_blank" rel="noopener">comprobar en el mapa</a>`);
      $('#pf-borrar-gps', f).hidden = false;
      if (prec > 100) aviso(`Precisión baja (±${prec} m). Sal al exterior, espera unos segundos y vuelve a pulsar el botón.`, 'error');
      else aviso('Ubicación tomada. Compruébala en el mapa y pulsa «Guardar».', 'ok');
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
