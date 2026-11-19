// Tareas que solo se pueden hacer en el panel de Supabase: enlace directo a la
// pantalla exacta y pasos uno a uno, para que el administrador no tenga que
// conocer Supabase. Solo administración.
import * as datos from '../datos.js';
import { CONFIG, supabaseConfigurado } from '../config.js';
import { h, html, pintar, $, aviso } from '../ui.js';

// Referencia del proyecto: «https://<ref>.supabase.co» → «<ref>»
export const refProyecto = (url = CONFIG.supabaseUrl) => (String(url).match(/^https:\/\/([a-z0-9]+)\.supabase\.co/i) || [])[1] || '';
const panel = (ref, ruta = '') => `https://supabase.com/dashboard/project/${ref}${ruta}`;

const CUENTA = 'alacantinapp@gmail.com';
const sqlAdmin = (email) => `ALTER TABLE public.perfiles DISABLE TRIGGER trg_proteger_perfil;
UPDATE public.perfiles SET rol = 'administrador' WHERE email = lower('${String(email).replace(/'/g, "''")}');
ALTER TABLE public.perfiles ENABLE TRIGGER trg_proteger_perfil;
SELECT nombre, email, rol FROM public.perfiles WHERE rol = 'administrador';`;

async function copiar(texto, que) {
  try { await navigator.clipboard.writeText(texto); aviso(`${que} copiado.`, 'ok'); }
  catch { aviso('No se pudo copiar: selecciónalo y cópialo a mano.', 'error'); }
}

const tarea = (id, titulo, cuando, href, pasos, extra = '') => h`<details class="tarjeta tarea-guiada" id="${id}">
  <summary><strong>${titulo}</strong><span class="item-sub">${cuando}</span></summary>
  ${href ? h`<p><a class="btn btn-primario" href="${href}" target="_blank" rel="noopener">Abrir en Supabase ↗</a></p>` : ''}
  <ol class="pasos-guiados">${pasos.map(p => h`<li>${html(p)}</li>`)}</ol>${extra}</details>`;

export default function (main) {
  const ref = refProyecto();
  if (!supabaseConfigurado() || !ref) {
    pintar(main, h`<p class="peq"><a href="#/admin">‹ Administración</a></p><h1>Tareas en Supabase</h1>
      <div class="aviso-caja aviso">La app funciona en modo dispositivo, sin servidor: no hay panel de Supabase que gestionar.</div>`);
    return;
  }
  const usuarios = [...datos.estado.perfiles].sort((a, b) => String(a.nombre || a.email).localeCompare(String(b.nombre || b.email), 'es'));
  pintar(main, h`
    <p class="peq"><a href="#/admin">‹ Administración</a></p>
    <h1>Tareas en Supabase</h1>
    <p class="muted">Supabase es el servidor donde se guarda el Libro. Unas pocas tareas solo se pueden hacer en su panel: aquí tienes el enlace directo a cada pantalla y los pasos exactos.</p>
    <div class="aviso-caja info peq">Entra siempre con la cuenta <strong>${CUENTA}</strong>: te pedirá la contraseña y el código de 6 cifras de la app de códigos del móvil.</div>

    <div class="tarjeta">
      <label for="sb-usuario"><strong>¿Para qué usuario?</strong> <span class="muted peq">(opcional: copia su correo para buscarlo en Supabase)</span></label>
      <div class="fila" style="margin-top:.4rem">
        <select id="sb-usuario" style="flex:1"><option value="">Elige un usuario…</option>${usuarios.map(u => h`<option value="${u.email || ''}">${u.nombre || '—'} · ${u.email || 'sin correo'}</option>`)}</select>
        <button class="btn" type="button" id="sb-copiar">Copiar correo</button>
      </div>
    </div>

    ${tarea('sb-clave', 'Alguien no puede entrar: restablecer su contraseña', 'Primero, que lo intente él mismo con «¿Has olvidado la contraseña?» en la pantalla de Entrar.', panel(ref, '/auth/users'), [
      'Pulsa <strong>«Abrir en Supabase»</strong>: se abre la lista de usuarios (Authentication › Users).',
      'Arriba, en <strong>«Search by email»</strong>, pega su correo (botón «Copiar correo» de arriba).',
      'Haz clic en su fila: se abre un panel a la derecha.',
      'Pulsa <strong>«Send password recovery»</strong>. Le llegará un correo de AlacantinApp para poner una contraseña nueva.',
      'Dile que mire también en «Spam» o «Promociones». El enlace caduca en 1 hora.'
    ])}

    ${tarea('sb-baja', 'Dar de baja una cuenta que no tiene ejemplares', 'Cuando alguien pide la baja o se registró por error y no ha inscrito ningún ejemplar.', panel(ref, '/auth/users'), [
      'Comprueba antes en <a href="#/usuarios">Usuarios y roles</a> que no tiene ningún ejemplar, ni activo ni de baja.',
      'Pulsa <strong>«Abrir en Supabase»</strong> y busca su correo en <strong>«Search by email»</strong>.',
      'En su fila, pulsa los tres puntos <strong>«⋯»</strong> de la derecha (o haz clic derecho) y elige <strong>«Delete user»</strong>. Confírmalo.',
      'Se borran su cuenta y su perfil. Si te escribió pidiendo la baja, contéstale confirmándola (tienes un mes de plazo).',
      'Si tiene ejemplares, Supabase no deja borrarla: el Libro los protege. Esa baja (borrar sus datos personales y conservar los ejemplares) llegará en una próxima versión de la app.'
    ])}

    ${tarea('sb-pausa', 'La app no carga datos: el proyecto está en pausa', 'El plan gratuito pausa el proyecto tras 7 días sin uso. No se pierde nada.', panel(ref), [
      'Pulsa <strong>«Abrir en Supabase»</strong>: se abre la página principal del proyecto AlacantinApp.',
      'Si ves el aviso <strong>«Project is paused»</strong>, pulsa <strong>«Restore project»</strong>.',
      'Espera unos minutos hasta que ponga <strong>«Healthy»</strong>. Después, los criadores solo tienen que volver a abrir la app.'
    ])}

    ${tarea('sb-correo', 'No llegan los correos de la app', 'Confirmar la cuenta y recuperar la contraseña salen desde alacantinapp@gmail.com.', panel(ref, '/auth/smtp'), [
      'Lo más probable es que la <strong>contraseña de aplicación de Gmail</strong> haya dejado de valer (por ejemplo, si cambiasteis la contraseña de alacantinapp@gmail.com).',
      'Con la cuenta alacantinapp@gmail.com abierta, entra en <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener">myaccount.google.com/apppasswords</a>, crea una nueva llamada «Supabase AlacantinApp» y copia la clave de 16 letras.',
      'Pulsa <strong>«Abrir en Supabase»</strong> (Authentication › Emails › SMTP Settings).',
      'En <strong>Password</strong> borra lo que haya y pega la clave <strong>sin espacios</strong> (16 puntos). Pulsa <strong>«Save changes»</strong>.',
      'Compruébalo con «Alguien no puede entrar» enviándote a ti mismo un correo de recuperación.'
    ])}

    ${tarea('sb-plantillas', 'Cambiar el texto de los correos', 'Los correos de confirmar la cuenta y de recuperar la contraseña están en español.', panel(ref, '/auth/templates'), [
      'Pulsa <strong>«Abrir en Supabase»</strong> (Authentication › Emails › Templates).',
      'Elige <strong>«Confirm sign up»</strong> o <strong>«Reset password»</strong>.',
      'Cambia el texto, pero <strong>no toques</strong> lo que va entre llaves dobles, como <code>{{ .ConfirmationURL }}</code>: es el enlace de cada persona.',
      'Pulsa <strong>«Save changes»</strong>.'
    ])}

    ${tarea('sb-direccion', 'La app cambia de dirección (por ejemplo, un dominio propio)', 'Para que los enlaces de los correos lleven a la dirección nueva.', panel(ref, '/auth/url-configuration'), [
      'Pulsa <strong>«Abrir en Supabase»</strong> (Authentication › URL Configuration).',
      `En <strong>Site URL</strong> pon la dirección nueva y pulsa «Save». Ahora es <code>${location.origin}</code>.`,
      'En <strong>Redirect URLs</strong> pulsa «Add URL» y añade la dirección nueva terminada en <code>/**</code>. Deja la antigua unos días y bórrala después.'
    ])}

    ${tarea('sb-admin', 'Nombrar administrador a alguien desde Supabase', 'Solo si nadie puede hacerlo desde la app (por ejemplo, si no queda ningún administrador).', panel(ref, '/sql/new'), [
      'La persona tiene que haberse registrado antes en la app.',
      'Escribe su correo aquí abajo y pulsa <strong>«Copiar instrucciones»</strong>.',
      'Pulsa <strong>«Abrir en Supabase»</strong>: se abre una consulta nueva del SQL Editor. Pega lo copiado y pulsa <strong>«Run»</strong>.',
      'Si avisa de «destructive operations», acepta con «Run this query». Abajo debe salir esa persona con rol «administrador».'
    ], h`<div class="fila"><input id="sb-admin-email" type="email" placeholder="correo@ejemplo.es" aria-label="Correo de la persona" style="flex:1">
      <button class="btn" type="button" id="sb-admin-copiar">Copiar instrucciones</button></div>`)}`);

  $('#sb-copiar', main).addEventListener('click', () => {
    const v = $('#sb-usuario', main).value;
    if (!v) { aviso('Elige primero un usuario.', 'error'); return; }
    copiar(v, 'Correo');
  });
  $('#sb-admin-copiar', main).addEventListener('click', () => {
    const v = $('#sb-admin-email', main).value.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) { aviso('Escribe el correo con el que se registró.', 'error'); return; }
    copiar(sqlAdmin(v), 'Instrucciones');
  });
}
