# AlacantinApp v7

Aplicación web instalable (PWA) del **Libro Genealógico de la Gallina Alacantina**, conforme al **Estándar oficial ESGA025 (revisión 20/03/2025)**. Funciona sin cobertura en el gallinero y se sincroniza al volver la señal.

La v7 es una reescritura completa de la v6. Ocupa unas 3.200 líneas frente a las más de 20.000 de la v6, no depende de ninguna compilación y no contiene datos de demostración.

## Qué ve cada usuario

| Rol | Barra inferior | Además, en «Herramientas» |
|---|---|---|
| **Visitante** (sin cuenta) | 📖 Estándar Racial · 📋 Guía de Campo · 🔍 Censo Público | — |
| **Aspirante** (sin REGA) | 📚 Mi Censo · ➕ Alta Rápida · 🥚 Puesta & RFID · 🧰 Herramientas | Mi aviario, apareamientos, informe de su censo |
| **Criador** (con REGA válido) | igual que el aspirante | igual que el aspirante |
| **Inspector** | igual que el aspirante | Censo completo y **calificación** de ejemplares |
| **Administrador** | igual que el aspirante | Lo del inspector y **usuarios y roles** |

- La barra del visitante tiene exactamente 3 columnas y no contiene botones bloqueados: «Alta Rápida» no existe en su pantalla.
- El censo público no muestra titular, REGA, coordenadas ni notas.
- Una cuenta nueva es **Aspirante**. Al guardar un REGA con formato oficial (`ES` + 12 dígitos) pasa a **Criador** automáticamente, en la app y en el servidor.
- Los roles **Inspector** y **Administrador** solo los asigna un administrador; el servidor rechaza cualquier otro intento.
- Cada alta **hereda** del aviario del criador el REGA, el municipio, la provincia y la ubicación GPS.

## Criterios normativos aplicados

- **Variedades:**
  - Oficiales, según el Estándar 2025: Negra moteada, Pinta o exchequer y Blanca.
  - Armiñada y Milflores se pueden registrar marcadas «en proceso de reconocimiento» (art. 3.3 del Protocolo CNZ), pero no acceden al Registro Definitivo.
- **Pesos y anillas:**
  - Gallo: 3,000–3,500 kg, anilla de 20 mm.
  - Gallina: 2,200–2,600 kg, anilla de 18 mm.
- **Huevo:** de 55 a 70 g con cáscara blanco crema. Cada huevo se pesa y se registra por separado.
- **Calificación morfológica:**
  - Es una **ficha de conformidad** con el Estándar: 12 regiones que reproducen literalmente el texto oficial para el gallo y la gallina, marcadas como conforme o no conforme, más los 5 **defectos graves**.
  - Un defecto grave implica «No apto»; en el flameado de esclavina, solo en las variedades moteada y exchequer.
  - El Estándar, el Protocolo CNZ y el RD 45/2019 **no contienen un baremo de 100 puntos**: el RD remite al programa de cría de la raza. Si el Club aprueba un baremo con puntos, se añade en `js/estandar.js`.
- **Registro Definitivo:** se alcanza con resultado Apto, sin defectos graves, en una variedad oficial y con 180 días o más de edad. Es una regla del Club, configurable en `REGLAS`, y la aplica también el servidor.
- **Consanguinidad de Wright:**
  - Método tabular exacto, a 5 generaciones.
  - Umbrales: precaución a partir del 6,25 % y alerta a partir del 12,5 % (configurables).
- **Informes:** recogen los datos que pide la memoria técnica del Protocolo CNZ (apdo. 3.1 f, j, l):
  - censo por sexo y edad;
  - criadores y distribución territorial;
  - Ne demográfico y realizado;
  - consanguinidad media e integridad del pedigrí;
  - matriz de pedigrí en CSV para ENDOG, CFC o R.
- **Rotación de Gobe:** familias A–E en círculo (A→B→C→D→E→A). La descendencia queda en la familia de la madre.

Toda la normativa vive en **`js/estandar.js`**: es la única fuente de verdad de la app.

## Puesta en marcha

### 1. Supabase (servidor del Libro)

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. En *SQL Editor*, ejecuta completo `supabase/schema.sql`. Es idempotente.
3. Regístrate en la app con el correo de la Dirección Técnica.
4. Ejecuta el bloque final de `schema.sql` (sección 7) para convertir esa cuenta en administrador.
5. Opcional: en *Authentication > Providers > Email*, decide si se exige confirmar el correo.

### 2. Configuración de la app

En `js/config.js`, rellena `supabaseUrl` y `supabaseAnonKey` (*Project Settings > API*).
- La *anon key* es pública por diseño: la seguridad la dan las políticas RLS.
- **Nunca** pongas la *service_role key*.
- Si los dejas vacíos, la app funciona en **modo dispositivo**: los datos se guardan solo en ese móvil o tablet.

### 3. Vercel

1. Importa el repositorio en Vercel, sin *framework* ni comando de *build*.
2. `vercel.json` ya incluye las cabeceras: el Service Worker sin caché y la política de seguridad (CSP).
3. Para publicar una versión nueva, sube `VERSION` en `sw.js` y `version` en `js/config.js`. Los móviles se actualizan solos en la siguiente apertura.

## Estructura

```
index.html            Página única
css/app.css           Estilos propios (sin CDN: funciona offline desde el primer uso)
js/estandar.js        Estándar ESGA025 y reglas del Club
js/genetica.js        Wright, pedigrí, Ne, orden topológico, Gobe (funciones puras)
js/db.js              IndexedDB
js/sync.js            Cola offline y descarga desde Supabase
js/auth.js            Sesión, roles, credenciales offline (PBKDF2)
js/datos.js           Reglas de negocio del Libro
js/documentos.js      Certificado genealógico y acta (impresión / PDF)
js/vistas/*.js        Una pantalla por archivo
sw.js                 Service Worker
supabase/schema.sql   Tablas, triggers, RLS y Storage
tests/                Pruebas (ver abajo)
docs/                 Estándar oficial en PDF
```

## Pruebas

```bash
node tests/genetica.test.mjs                  # 20 pruebas: Wright, Ne, Gobe, Estándar
python3 -m http.server 8820 &                 # servir la app
npx playwright install chromium; node tests/e2e.mjs http://localhost:8820   # 30 comprobaciones en Chrome (Playwright)
# SQL: sobre PostgreSQL 15+ ejecutar tests/supabase_stub.sql, supabase/schema.sql y tests/schema.test.sql
```

## Cambios respecto a la v6

- **Eliminado:**
  - datos y cuentas de demostración, núcleos GIS ficticios y simuladores de RFID;
  - baremo de 100 puntos sin respaldo normativo;
  - variedades ajenas a la raza;
  - Tailwind y otras librerías por CDN, salvo el cliente de Supabase.
- **Corregido:**
  - censo que no se pintaba;
  - contraseñas en claro y escalada de roles;
  - escritura anónima en la base de datos;
  - XSS;
  - pérdida silenciosa de datos al sincronizar;
  - Service Worker que retenía versiones antiguas.
- **Nuevo:**
  - modo sencillo para el criador;
  - pesaje individual de huevos con lector RFID en modo teclado;
  - informes para la memoria del Protocolo CNZ;
  - censo público protegido por una vista sin datos personales.

### Migración de datos de la v6

La v6 guardaba los datos solo en el navegador y usaba identificadores no compatibles. Si hay censos reales en dispositivos con la v6, conviene exportar su CSV y darlos de alta en la v7. Para importaciones grandes, pídeselo al administrador.
