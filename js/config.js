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
  // Dónde llegan los informes de problemas (Herramientas → Informar de un problema).
  // Vacíos: el criador elige a quién enviarlo (WhatsApp o correo).
  soporteEmail: '',
  soporteWhatsApp: '',   // con prefijo, solo cifras: p. ej. 34600000000
  version: '7.12.0'
});

export const supabaseConfigurado = () => Boolean(CONFIG.supabaseUrl && CONFIG.supabaseAnonKey);
