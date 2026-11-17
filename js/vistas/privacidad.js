// Política de privacidad (información completa, «segunda capa»: RGPD art. 13; LOPDGDD art. 11).
// Pública: se puede leer sin cuenta. Los datos del responsable salen de CONFIG.club.
import { CONFIG } from '../config.js';
import * as datos from '../datos.js';
import { h, pintar } from '../ui.js';

const C = CONFIG.club;

// Primera capa (información básica), reutilizada en el registro
export const capaBasica = () => h`<div class="tabla-scroll"><table class="info-basica"><caption>Información básica sobre protección de datos</caption><tbody>
  <tr><th scope="row">Responsable</th><td>${C.nombre}${C.nif ? ` (NIF ${C.nif})` : ''} · <a href="mailto:${C.email}">${C.email}</a></td></tr>
  <tr><th scope="row">Finalidad</th><td>Gestionar tu cuenta y el Libro Genealógico de la Gallina Alacantina: tus ejemplares, su genealogía, puesta, calificaciones e inspecciones.</td></tr>
  <tr><th scope="row">Legitimación</th><td>Tu participación en el Libro del Club. La ubicación del aviario, solo si das tu consentimiento.</td></tr>
  <tr><th scope="row">Destinatarios</th><td>La inspección y la administración del Club. No se ceden a terceros salvo obligación legal. El censo público muestra los animales, nunca tu nombre ni tus datos de contacto.</td></tr>
  <tr><th scope="row">Derechos</th><td>Acceder, rectificar y suprimir tus datos, y los demás que explica la información adicional.</td></tr>
  <tr><th scope="row">Más información</th><td><a href="#/privacidad">Política de privacidad completa</a></td></tr>
</tbody></table></div>`;

export default function (main) {
  const usuario = Boolean(datos.estado.perfil);
  pintar(main, h`
    <h1>Política de privacidad</h1>
    <p class="muted peq">Última revisión: ${C.revisionPrivacidad}. Escrita para esta aplicación: describe exactamente qué datos usa AlacantinApp y para qué.</p>
    ${capaBasica()}

    <div class="tarjeta texto-legal">
      <h2>1. Quién es el responsable</h2>
      <p><strong>${C.nombre}</strong>${C.nif ? `, con NIF ${C.nif}` : ''}${C.domicilio ? ` y domicilio en ${C.domicilio}` : ''}. Para cualquier cuestión sobre tus datos: <a href="mailto:${C.email}?subject=${encodeURIComponent('Protección de datos')}">${C.email}</a>.</p>
      <p>El Club no está obligado a tener delegado de protección de datos; las consultas se atienden en ese correo.</p>

      <h2>2. Qué datos tratamos</h2>
      <ul>
        <li><strong>Tu cuenta:</strong> nombre y apellidos, correo electrónico y contraseña. La contraseña no se guarda nunca en claro: el servidor guarda una huella cifrada y el móvil solo una clave derivada (PBKDF2), para poder entrar sin cobertura.</li>
        <li><strong>Tu aviario</strong> (los completas tú): teléfono, número de socio, código REGA de la explotación, municipio y provincia.</li>
        <li><strong>Ubicación del aviario</strong> (opcional): las coordenadas GPS, solo si pulsas «Usar mi ubicación actual».</li>
        <li><strong>Tus ejemplares y su actividad:</strong> anilla, sexo, variedad, nacimiento, padres, fotos de los animales, puesta, lotes, incubaciones, calificaciones y solicitudes de inspección. Por sí mismos no son datos personales, pero están unidos a ti como titular o criador.</li>
        <li><strong>Registro de cambios:</strong> el servidor anota quién y cuándo modifica un ejemplar o una calificación, como control del Libro.</li>
        <li><strong>Datos técnicos</strong> en tu propio dispositivo: los datos del Libro para trabajar sin cobertura, tu tema de pantalla y un registro de los últimos errores. Solo salen del dispositivo si tú envías un «Informe de problemas».</li>
      </ul>
      <p>No pedimos datos de salud, ideología ni otras categorías especiales. Te pedimos que <strong>no aparezcan personas</strong> en las fotos de los animales.</p>

      <h2>3. Para qué y con qué base legal</h2>
      <div class="tabla-scroll"><table><thead><tr><th>Finalidad</th><th>Base legal (RGPD)</th></tr></thead><tbody>
        <tr><td>Crear y mantener tu cuenta y tu perfil de criador.</td><td>Tu participación en el Libro del Club como socio o usuario (art. 6.1.b).</td></tr>
        <tr><td>Llevar el Libro Genealógico de la raza: inscribir tus ejemplares y su genealogía, calificarlos, cambiar de sección, expedir certificados y actas, y elaborar los censos e informes de la raza.</td><td>Tu participación en el Libro (art. 6.1.b) y el interés legítimo del Club en conservar la raza (art. 6.1.f). Cuando el Club gestione un Libro oficialmente reconocido, también el cumplimiento de las obligaciones del Real Decreto 45/2019 (art. 6.1.c).</td></tr>
        <tr><td>Organizar las inspecciones: el inspector usa tu teléfono, tu municipio y, si la diste, la ubicación del aviario, para contactarte y llegar.</td><td>Tu solicitud de inspección (art. 6.1.b). La ubicación, tu consentimiento (art. 6.1.a).</td></tr>
        <tr><td>Guardar la ubicación GPS del aviario.</td><td>Tu consentimiento (art. 6.1.a), que puedes retirar cuando quieras borrándola en «Mi aviario».</td></tr>
        <tr><td>Atender los informes de problemas que nos envíes.</td><td>Interés legítimo en que la aplicación funcione (art. 6.1.f). Solo recibimos lo que tú decides enviar.</td></tr>
      </tbody></table></div>
      <p>No hacemos perfiles comerciales ni tomamos decisiones automatizadas sobre ti. La aplicación calcula automáticamente la puntuación y la sección de los <em>animales</em> según las reglas del Libro, y la inspección del Club las revisa.</p>

      <h2>4. Quién ve tus datos</h2>
      <ul>
        <li><strong>Tú:</strong> todo lo tuyo.</li>
        <li><strong>La inspección y la administración del Club:</strong> lo necesario para llevar el Libro y hacer las inspecciones.</li>
        <li><strong>Otros criadores y el público:</strong> solo el <em>censo público</em>, que muestra los animales (anilla, sexo, variedad, sección, genealogía, municipio y provincia) <strong>sin el nombre del criador ni sus datos de contacto, REGA o ubicación</strong>.</li>
        <li><strong>Administraciones públicas</strong> (Ministerio de Agricultura, Pesca y Alimentación y consejería competente): solo cuando una norma lo exija, por ejemplo para el Catálogo Oficial de Razas o el sistema ARCA.</li>
        <li>No vendemos ni cedemos tus datos a nadie más.</li>
      </ul>

      <h2>5. Proveedores que tratan datos por encargo del Club</h2>
      <ul>
        <li><strong>Supabase</strong> (base de datos, cuentas y fotos). Los datos se guardan en un servidor de la Unión Europea (Frankfurt). Supabase actúa como encargado del tratamiento con un contrato conforme al art. 28 del RGPD. Si algún servicio técnico suyo trata datos fuera de la UE, lo hace con cláusulas contractuales tipo aprobadas por la Comisión Europea.</li>
        <li><strong>Vercel</strong> (alojamiento de la aplicación web). Puede registrar datos técnicos de conexión, como la dirección IP. Está certificada en el Marco de Privacidad de Datos UE-EE. UU.</li>
        <li><strong>Correo y WhatsApp:</strong> si escribes al Club o envías un informe de problemas, se usan esos servicios (Google para el correo del Club; Meta para WhatsApp) con sus propias condiciones.</li>
      </ul>
      <p>La aplicación <strong>no usa cookies de publicidad ni de analítica</strong>, ni herramientas de seguimiento. Lo que guarda en tu dispositivo es solo para que funcione, también sin cobertura.</p>

      <h2>6. Cuánto tiempo los conservamos</h2>
      <ul>
        <li><strong>Cuenta y datos de contacto</strong> (correo, teléfono, número de socio, ubicación): mientras seas usuario. Si te das de baja, se borran.</li>
        <li><strong>Libro Genealógico</strong> (ejemplares, genealogía, calificaciones, certificados y su historial): de forma indefinida, porque es el registro de la raza y la genealogía de los animales posteriores depende de él. Tras tu baja se conserva tu nombre <em>solo</em> como criador o titular que figura en esos registros.</li>
        <li><strong>Solicitudes de inspección:</strong> hasta tres años después de cerrarse.</li>
        <li><strong>Informes de problemas:</strong> hasta que se resuelva el problema y, como mucho, un año.</li>
        <li><strong>Datos en tu dispositivo:</strong> hasta que cierres sesión y borres los datos del navegador o desinstales la aplicación.</li>
      </ul>

      <h2>7. Tus derechos</h2>
      <p>Puedes <strong>acceder</strong> a tus datos, <strong>rectificarlos</strong>, <strong>suprimirlos</strong>, <strong>oponerte</strong> a su tratamiento, pedir que se <strong>limite</strong> y llevártelos a otro sitio (<strong>portabilidad</strong>). También puedes <strong>retirar tu consentimiento</strong> (por ejemplo, para la ubicación) cuando quieras, sin que afecte a lo hecho antes.</p>
      <ul>
        <li>Muchos los ejerces <strong>desde la propia aplicación</strong>: en «Mi aviario» corriges tus datos, borras la ubicación y descargas tus datos.</li>
        <li>Para lo demás, incluida la baja, escribe a <a href="mailto:${C.email}?subject=${encodeURIComponent('Protección de datos: ejercicio de derechos')}">${C.email}</a> desde el correo de tu cuenta. Te responderemos en un mes como máximo.</li>
        <li>Si crees que no hemos atendido bien tus derechos, puedes reclamar ante la <strong>Agencia Española de Protección de Datos</strong> (<a href="https://www.aepd.es" target="_blank" rel="noopener">www.aepd.es</a>).</li>
      </ul>
      <p>La supresión no alcanza a los registros del Libro Genealógico que deban conservarse (apartado 6).</p>

      <h2>8. Edad mínima</h2>
      <p>Para crear una cuenta hay que tener <strong>14 años o más</strong>. Los menores de 14 años pueden participar a través de la cuenta de su padre, madre o tutor.</p>

      <h2>9. Seguridad</h2>
      <p>Las comunicaciones van cifradas (HTTPS). En el servidor, cada criador solo puede leer y modificar lo suyo, y las reglas del Libro se comprueban también allí. Las contraseñas nunca se guardan en claro. En el móvil, los datos quedan en el almacenamiento de la aplicación: protege tu dispositivo con bloqueo de pantalla.</p>

      <h2>10. Cambios en esta política</h2>
      <p>Si cambia algo importante, lo avisaremos en la aplicación. La fecha de la última revisión figura al principio.</p>
    </div>
    ${usuario ? h`<p><a class="btn" href="#/perfil">Ir a Mi aviario: tus datos y tus derechos</a></p>` : ''}`);
}
