// ============================================================================
// Configuración de despliegue.
// Rellenar con los datos del proyecto Supabase (Project Settings > API).
// La "anon key" es pública por diseño: la seguridad la garantizan las políticas
// RLS de supabase/schema.sql. NUNCA poner aquí la service_role key.
// Si se dejan vacías, la app funciona en "modo dispositivo" (solo local).
// ============================================================================
export const CONFIG = Object.freeze({
  supabaseUrl: '',
  supabaseAnonKey: '',
  bucketFotos: 'fotos-alacantina',
  // Responsable del tratamiento de datos personales (política de privacidad, #/privacidad).
  // El NIF y el domicilio postal del Club conviene completarlos: identifican al responsable.
  club: Object.freeze({
    nombre: 'Club de la Gallina Alacantina',
    nif: '',
    domicilio: '',
    email: 'clubalacantina@gmail.com',
    revisionPrivacidad: '17/11/2026'
  }),
  // Dónde llegan los informes de problemas (Herramientas → Informar de un problema).
  // WhatsApp vacío: el criador elige a quién enviarlo.
  soporteEmail: 'clubalacantina@gmail.com',
  soporteWhatsApp: '',   // con prefijo, solo cifras: p. ej. 34600000000
  version: '7.13.0'
});

export const supabaseConfigurado = () => Boolean(CONFIG.supabaseUrl && CONFIG.supabaseAnonKey);
