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
  - Blanca armiñada en negro y Milflores se pueden registrar marcadas «en proceso de reconocimiento» (art. 3.3 del Protocolo CNZ), pero no acceden al Registro Definitivo.
- **Anilla oficial EE (FESACOCUR):**
  - El código del Libro es **E + año de nacimiento (2 cifras) + diámetro (mm) + número (6 cifras, con ceros delante)**. Por ejemplo, un gallo nacido en 2026 con la anilla nº 123 es `E2620000123`. Es el mismo sistema que usa el Libro de la Castellana Negra (manual GANECA).
  - En el alta se escribe solo el número grabado. El año sale de la fecha de nacimiento y el diámetro se propone según el sexo.
  - Se rechaza una anilla cuyo año no coincide con el de nacimiento, o con un diámetro no admitido. Se admite el diámetro del Estándar o el inmediatamente superior (+2 mm), este último con aviso. La base de datos aplica las mismas reglas.
- **Pesos y anillas:**
  - Gallo: 3,000–3,500 kg, anilla de 20 mm.
  - Gallina: 2,200–2,600 kg, anilla de 18 mm.
- **Huevo:** apto para incubar **desde 55 g** con cáscara blanco crema, **sin límite superior**. El Estándar da 55–70 g como rango habitual; un huevo de más de 70 g se acepta y solo se señala. Cada huevo se pesa y se registra por separado.
- **Calificación morfológica (baremo de 100 puntos, en fase de propuesta):**
  - El Estándar ESGA025 no fija baremo. Se puntúan sobre 100 las **12 regiones** en que se agrupa el Estándar, con el texto oficial del gallo y de la gallina en cada una. Las que más puntúan son las que definen la impresión general de la raza y las de los defectos graves. Precedente de método: programa de cría de la Castellana Negra (BOE 15/02/2019).
  - Reparto: impresión general y tronco 15 · cabeza, cara, ojos y pico 6 · cresta 10 · barbillas 5 · orejillas 10 · cuello y esclavina 6 · dorso 8 · alas 4 · pecho y abdomen 10 · cola 10 · muslos, tarsos y dedos 6 · plumaje y color de la variedad 10. Se puntúa de 0 al máximo en pasos de 0,5.
  - Clases: **EX** ≥ 90 · **MB** ≥ 80 · **B** ≥ 70 · **R** ≥ 65 · **I** < 65. Cualquiera de los 5 defectos graves del Estándar da **D (descalificado)**, sume lo que sume; el flameado de esclavina solo cuenta en las variedades moteada y exchequer.
  - El resultado es **Apto** con clase EX, MB, B o R. Lo calcula la app y lo **recalcula el servidor**: el inspector no lo elige.
  - **Peso:** obligatorio en la calificación. Se pesa al animal y se anota en gramos; la app y el servidor lo contrastan con el Estándar (gallo 3000–3500 g, gallina 2200–2600 g) y el acta lo refleja como conforme o fuera de rango. No suma puntos.
  - Para ajustar el reparto hay que cambiar `MAXIMOS` en `js/estandar.js` y `baremo_maximos()` en `supabase/schema.sql`.
- **Registro Definitivo:** equiparado a la reglamentación oficial del Libro de la Castellana Negra (anexo I, A.6). Se exige:
  - resultado **Apto**: sin descalificación y con **65 puntos o más las gallinas y 70 los gallos**;
  - variedad oficial;
  - **un año de edad**.

  Un animal más joven puede salir Apto, pero sigue en RN: la ficha indica desde qué fecha puede calificarse de nuevo. Estos criterios están en `REGLAS` y los aplica también el servidor.
- **Registro de Méritos (RM):** el Club no tenía criterio propio. Se equipara a la reglamentación oficial del Libro Genealógico de la Castellana Negra (anexo I, apdo. A.7, MAPA):
  - Acceden ejemplares del **RF o del RD**, de variedad oficial, que tengan una calificación (no descalificada) de **80 puntos o más las gallinas y 85 los gallos**, y **3 (gallinas) o 10 (gallos) descendientes** en el Registro Definitivo.
  - Vía alternativa, tomada del reglamento de la Gallina del Sobrarbe: con la misma calificación mínima, un **premio en feria, concurso o exposición**, que debe describirse.
  - La app muestra en la ficha el camino al RM y, en Informes, la lista de candidatos. La inscripción la confirma un **administrador**, y el servidor vuelve a comprobar los requisitos (`comprobar_rm`). Los umbrales están en `REGLAS.rm`.
- **Control de puesta por campañas:**
  - **3 ciclos de 15 días por temporada**, repartidos entre febrero y junio. Es el modelo del programa de conservación de la Castellana Negra.
  - El criador crea cada ciclo, eligiendo el primer día, las gallinas y el método: jaula individual, ponedero trampa o RFID. Durante la campaña, la pantalla de Puesta muestra el día y qué gallinas no tienen huevos anotados hoy.
  - Resultados con **tres criterios en paralelo**:
    - 🥚 puesta: días con huevo sobre días controlados;
    - 🔶 tamaño: peso medio, solo con al menos 5 huevos;
    - ⭐ **masa de huevo**: g/día, que es puesta × peso medio.

    Se explican en la pantalla y en la Guía: la cantidad y el tamaño del huevo tienden a ir en sentido contrario, y la masa los equilibra. La madre propuesta del gallo de reposición de cada familia es la mejor en masa de huevo (`REGLAS.controlPuesta.criterioMadre`). Se muestra la edad de cada gallina y se avisa de los días con más de un huevo anotado.
  - Hay un acumulado de la temporada. En el servidor se guardan en la tabla `campanas` (un ciclo por criador y temporada, solo gallinas propias).
- **Guía del criador** (`#/programa`, también para visitantes): explica en lenguaje sencillo el Libro (RN → RD → RM), las anillas, la calificación, las familias y la consanguinidad, el control de puesta y un calendario orientativo del año. Las cifras se leen de `REGLAS`, `BAREMO` y `ESTANDAR`, así que nunca contradice lo que la app aplica.
- **Cumplimiento normativo** (detalle en la Guía del criador, apartado 7):
  - Las aves no están en el ámbito directo del Reglamento (UE) 2016/1012. Rige el **art. 26 del RD 45/2019**, que lo aplica «mutatis mutandis».
  - **Paso al RD:** además de Apto, un año y variedad oficial, exige **padre y madre inscritos en el Libro** (RF, RA, RD o RM) y **REGA**. Es la filiación establecida del anexo II del Reglamento, por analogía.
  - **Fundadores:** la Dirección Técnica inscribe a los fundadores (RF) y a los animales sin genealogía completa (RA) desde la ficha, con motivo obligatorio (art. 19, por analogía).
  - **Certificado zootécnico** con el contenido del anexo V, por analogía: especie, libro, sección, identificación, fecha y país de nacimiento, criador de origen y propietario, genealogía, calificación, control de puesta, consanguinidad, y lugar, fecha y firma.
  - **Criador de origen** (`criador_id`), que no cambia nunca. **Cambio de titular** por la administración para ventas o cesiones entre socios: el animal sigue en el Libro.
  - **Historial de cambios** en el servidor (`historial`), solo legible por inspección y administración, para el control oficial.
  - **Relación de criadores y explotaciones con sus efectivos** en CSV (art. 14.5).
- **Fotos y dossier fotográfico:**
  - Las fotos no son obligatorias para inscribir un animal: ni el RD 45/2019 ni el Reglamento las exigen.
  - Sí las piden los expedientes de reconocimiento: el Protocolo CNZ 2025 (3.1 c: ambos sexos, varias edades y cada variedad) y el dossier técnico de FESACOCUR (gallo y gallina de perfil, fondo uniforme, misma variedad).
  - En el alta hay consejos para hacer una foto útil, y se guarda la fecha de cada foto (`fotos_fecha`) para saber la edad del animal en ella.
  - La Dirección Técnica tiene el **Dossier fotográfico** (`#/dossier`): mejores fotos de perfil por variedad, sexo y edad, qué falta para el Catálogo y para FESACOCUR, e impresión en PDF.
- **Copia de seguridad** (`#/copia`, Herramientas):
  - Descarga en JSON de todo el Libro del dispositivo: ejemplares, calificaciones, huevos, campañas, lotes, incubaciones, solicitudes de inspección y perfiles; fotos opcionales. Nunca incluye contraseñas ni la sesión.
  - Restauración de dos formas: «fusionar», que conserva la versión más reciente de cada registro, o «reemplazar». Los archivos que no son copias o los registros incompletos se rechazan.
  - En modo dispositivo, la copia de otra cuenta local (un móvil anterior) se adopta como propia. Con servidor, lo propio se reenvía al Libro central.
  - Mi censo recuerda hacer la copia si nunca se ha hecho o tiene más de 30 días.
- **Reproducción e incubación** (`#/reproduccion`, Herramientas → Cría):
  - **Lotes:** gallo + gallinas (5 a 15) de una familia desde una fecha, con la consanguinidad de los pollitos con cada gallina. Una gallina o un gallo no pueden estar en dos lotes a la vez.
  - Los huevos se atribuyen al gallo del lote a partir de 15 días después de juntarlos; antes se marcan como «dudosos» (fecundidad residual del gallo anterior).
  - **Incubaciones:** se proponen los huevos aptos de los últimos 10 días de cada gallina; calendario día 0 / 7 (miraje) / 18 (nacedora) / 21 (nacimiento); fertilidad (fértiles ÷ huevos) y nacimiento (nacidos ÷ fértiles) por gallina.
  - **Alta del pollito** desde la incubación con madre, padre y fecha ya puestos, y unido a su incubación. En un alta normal, al elegir la madre se propone el gallo de su lote.
  - En el servidor, `lotes` e `incubaciones` validan que gallo y gallinas son del criador y que nacidos ≤ huevos − claros.
- **Solicitud de inspección** (`#/inspeccion` para el criador, `#/inspecciones` para inspección y administración):
  - El criador elige sus ejemplares en RN o RA con un año cumplido y sin calificar, deja su teléfono (se guarda en Mi aviario) y el mejor momento. Solo una solicitud abierta a la vez; puede anularla.
  - Mi censo y la ficha invitan a pedirla cuando hay ejemplares listos; los que aún no tienen un año salen en «Próximos» con la fecha.
  - El panel de inspección muestra los datos del criador (socio, municipio, REGA), botones para llamar, WhatsApp (prefijo 34) y cómo llegar (coordenadas del aviario), y el avance de la calificación de cada ejemplar.
  - Estados: pendiente → visita programada (con fecha y mensaje al criador) → realizada, o anulada con motivo.
  - En el servidor: una sola solicitud abierta por criador; el criador solo puede anular; inspección no puede cambiar los ejemplares pedidos; una solicitud cerrada no se reabre.
- **Consanguinidad de Wright:**
  - Método tabular exacto, a 5 generaciones.
  - Umbrales (criterio técnico del Club, confirmado el 16/11/2026; la normativa no los fija): precaución a partir del 6,25 % (primos hermanos) y alerta a partir del 12,5 % (medio hermanos). Solo avisan, no bloquean el apareamiento. Se configuran en `REGLAS`.
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
node tests/genetica.test.mjs                  # 25 pruebas: Wright, Ne, Gobe, Estándar
python3 -m http.server 8820 &                 # servir la app
npx playwright install chromium; node tests/e2e.mjs http://localhost:8820   # 94 comprobaciones en Chrome (Playwright)
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
