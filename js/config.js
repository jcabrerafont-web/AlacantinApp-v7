// ============================================================================
// Configuración de despliegue.
// Proyecto Supabase del Club (región Central EU, Frankfurt), creado el 17/11/2026.
// supabaseAnonKey lleva la "publishable key" (sb_publishable_…), que sustituye a
// la antigua anon key: es pública por diseño y la seguridad la garantizan las
// políticas RLS de supabase/schema.sql. NUNCA poner aquí la secret/service_role key.
// Si se dejan vacías, la app funciona en "modo dispositivo" (solo local).
// ============================================================================
export const CONFIG = Object.freeze({
  supabaseUrl: 'https://mliunedrpbigybsovdyu.supabase.co',
  supabaseAnonKey: 'sb_publishable_VwsP4abnoL_WeWHo69JpfQ_FBN-VZ1s',
  bucketFotos: 'fotos-alacantina',
  // Responsable del tratamiento de datos personales (política de privacidad, #/privacidad).
  // El NIF y el domicilio postal del Club conviene completarlos: identifican al responsable.
  club: Object.freeze({
    nombre: 'Club de la Gallina Alacantina',
    nif: 'G21807508',
    domicilio: 'Calle Doctor Fleming, 16, 1.º, puerta 7, 03720 Benissa (Alicante)',
    email: 'clubalacantina@gmail.com',
    revisionPrivacidad: '17/11/2026'
  }),
  // Dónde llegan los informes de problemas (Herramientas → Informar de un problema).
  // WhatsApp vacío: el criador elige a quién enviarlo.
  soporteEmail: 'clubalacantina@gmail.com',
  soporteWhatsApp: '',   // con prefijo, solo cifras: p. ej. 34600000000
  version: '7.15.0'
});

export const supabaseConfigurado = () => Boolean(CONFIG.supabaseUrl && CONFIG.supabaseAnonKey);
