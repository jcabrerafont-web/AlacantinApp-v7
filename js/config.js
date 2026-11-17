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
  version: '7.3.0'
});

export const supabaseConfigurado = () => Boolean(CONFIG.supabaseUrl && CONFIG.supabaseAnonKey);
