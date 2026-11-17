-- ============================================================================
-- AlacantinApp v7 · Esquema Supabase (PostgreSQL 15+)
-- Libro Genealógico de la Gallina Alacantina · Estándar ESGA025 (rev. 20/03/2025)
-- Ejecutar completo en Supabase > SQL Editor sobre un proyecto NUEVO.
-- Es idempotente: puede volver a ejecutarse sin perder datos.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Perfiles y roles
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.perfiles (
  id            uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         text,
  nombre        text,
  telefono      text,
  rol           text NOT NULL DEFAULT 'aspirante'
                CHECK (rol IN ('aspirante', 'criador', 'inspector', 'administrador')),
  numero_socio  text,
  rega          text CHECK (rega IS NULL OR rega ~ '^ES[0-9]{12}$'),
  municipio     text,
  provincia     text,
  latitud       double precision CHECK (latitud IS NULL OR latitud BETWEEN -90 AND 90),
  longitud      double precision CHECK (longitud IS NULL OR longitud BETWEEN -180 AND 180),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.rol_actual() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT rol FROM public.perfiles WHERE id = auth.uid()
$$;
CREATE OR REPLACE FUNCTION public.es_auditor() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(public.rol_actual() IN ('inspector', 'administrador'), false)
$$;
CREATE OR REPLACE FUNCTION public.es_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(public.rol_actual() = 'administrador', false)
$$;

-- Perfil automático al registrarse (siempre aspirante; nunca se lee el rol de metadata)
CREATE OR REPLACE FUNCTION public.crear_perfil() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.perfiles (id, email, nombre, telefono, rol)
  VALUES (NEW.id, NEW.email,
          coalesce(NEW.raw_user_meta_data->>'nombre', split_part(NEW.email, '@', 1)),
          NEW.raw_user_meta_data->>'telefono', 'aspirante')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_crear_perfil ON auth.users;
CREATE TRIGGER trg_crear_perfil AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.crear_perfil();

-- Protección del rol: solo un administrador lo cambia; aspirante -> criador al registrar un REGA válido.
CREATE OR REPLACE FUNCTION public.proteger_perfil() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT public.es_admin() THEN NEW.rol := 'aspirante'; END IF;
  ELSIF NEW.rol IS DISTINCT FROM OLD.rol AND NOT public.es_admin() THEN
    NEW.rol := OLD.rol;
  END IF;
  IF TG_OP = 'UPDATE' THEN NEW.email := OLD.email; END IF;
  IF NEW.rol = 'aspirante' AND NEW.rega ~ '^ES[0-9]{12}$' THEN NEW.rol := 'criador'; END IF;
  IF NEW.rol = 'criador' AND (NEW.rega IS NULL OR NEW.rega !~ '^ES[0-9]{12}$') THEN NEW.rol := 'aspirante'; END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_proteger_perfil ON public.perfiles;
CREATE TRIGGER trg_proteger_perfil BEFORE INSERT OR UPDATE ON public.perfiles
  FOR EACH ROW EXECUTE FUNCTION public.proteger_perfil();

-- ----------------------------------------------------------------------------
-- 2. Ejemplares
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.animales (
  id               uuid PRIMARY KEY,
  usuario_id       uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE RESTRICT,  -- propietario actual
  criador_id       uuid REFERENCES public.perfiles(id) ON DELETE SET NULL,          -- criador de origen (inmutable)
  anilla           text NOT NULL,
  sexo             char(1) NOT NULL CHECK (sexo IN ('M', 'H')),
  variedad         text NOT NULL CHECK (variedad IN ('negra-moteada', 'pinta', 'blanca', 'arminada', 'milflores')),
  fecha_nacimiento date NOT NULL CHECK (fecha_nacimiento <= current_date),
  seccion          text NOT NULL DEFAULT 'RN' CHECK (seccion IN ('RN', 'RF', 'RA', 'RD', 'RM')),
  padre_id         uuid REFERENCES public.animales(id) ON DELETE SET NULL,
  madre_id         uuid REFERENCES public.animales(id) ON DELETE SET NULL,
  familia          text CHECK (familia IS NULL OR familia IN ('A', 'B', 'C', 'D', 'E')),
  nombre           text,
  peso_g           integer CHECK (peso_g IS NULL OR peso_g BETWEEN 30 AND 6000),
  rfid             text CHECK (rfid IS NULL OR rfid ~ '^[0-9]{15}$'),
  rega             text,
  municipio        text,
  provincia        text,
  latitud          double precision,
  longitud         double precision,
  fotos            jsonb NOT NULL DEFAULT '{}'::jsonb,
  fotos_fecha      jsonb NOT NULL DEFAULT '{}'::jsonb,   -- fecha de cada foto (edad del animal en ella)
  notas            text,
  estado           text NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'baja')),
  baja_fecha       date,
  baja_causa       text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT progenitores_distintos CHECK (padre_id IS NULL OR madre_id IS NULL OR padre_id <> madre_id),
  CONSTRAINT no_es_su_propio_padre CHECK (padre_id IS DISTINCT FROM id AND madre_id IS DISTINCT FROM id),
  rm_fecha         date,
  rm_via           text CHECK (rm_via IS NULL OR rm_via IN ('requisitos', 'premio')),
  rm_motivo        text,
  CONSTRAINT rd_solo_oficiales CHECK (seccion NOT IN ('RD', 'RM') OR variedad IN ('negra-moteada', 'pinta', 'blanca')),
  CONSTRAINT rm_documentado CHECK (seccion <> 'RM' OR (rm_fecha IS NOT NULL AND rm_via IS NOT NULL AND coalesce(trim(rm_motivo), '') <> '')),
  -- Anilla oficial EE: E + año de nacimiento (2) + diámetro (2) + número (6). Ej.: E2620000123
  CONSTRAINT anilla_ee CHECK (anilla ~ '^E[0-9]{10}$' AND substr(anilla, 6, 6) <> '000000'),
  CONSTRAINT anilla_anio CHECK (substr(anilla, 2, 2) = to_char(fecha_nacimiento, 'YY')),
  CONSTRAINT anilla_diametro CHECK ((sexo = 'M' AND substr(anilla, 4, 2) IN ('20', '22'))
                                 OR (sexo = 'H' AND substr(anilla, 4, 2) IN ('18', '20')))
);
CREATE UNIQUE INDEX IF NOT EXISTS animales_anilla_activa ON public.animales (upper(anilla)) WHERE estado = 'activo';
CREATE UNIQUE INDEX IF NOT EXISTS animales_rfid_activo ON public.animales (rfid) WHERE rfid IS NOT NULL AND estado = 'activo';
CREATE INDEX IF NOT EXISTS animales_usuario ON public.animales (usuario_id);
CREATE INDEX IF NOT EXISTS animales_padre ON public.animales (padre_id);
CREATE INDEX IF NOT EXISTS animales_madre ON public.animales (madre_id);

-- Reglas que no puede saltarse el cliente: titularidad, sexo de progenitores y sección
-- Requisitos del Registro de Méritos (equiparados al LG de la Castellana Negra, A.7):
-- origen RF o RD, variedad oficial y calificación >= 80 (gallinas) / 85 (gallos), y
--   via 'requisitos': >= 3 (gallinas) / 10 (gallos) descendientes en RD o RM
--   via 'premio'    : premio en feria, concurso o exposición, descrito en rm_motivo
CREATE OR REPLACE FUNCTION public.comprobar_rm(a public.animales, via text, motivo text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE puntos numeric; hijos integer;
  min_puntos integer := CASE a.sexo WHEN 'M' THEN 85 ELSE 80 END;
  min_hijos  integer := CASE a.sexo WHEN 'M' THEN 10 ELSE 3 END;
BEGIN
  IF NOT public.es_admin() THEN
    RAISE EXCEPTION 'La inscripción en el Registro de Méritos la acuerda la administración del Libro' USING ERRCODE = '42501';
  END IF;
  IF a.seccion NOT IN ('RF', 'RD') THEN
    RAISE EXCEPTION 'Solo acceden al RM ejemplares del Registro Fundacional o del Definitivo' USING ERRCODE = '23514';
  END IF;
  SELECT max(total) INTO puntos FROM public.calificaciones WHERE animal_id = a.id AND clase <> 'D';
  IF coalesce(puntos, 0) < min_puntos THEN
    RAISE EXCEPTION 'El RM exige una calificación de % puntos o más', min_puntos USING ERRCODE = '23514';
  END IF;
  IF via = 'requisitos' THEN
    SELECT count(*) INTO hijos FROM public.animales h
      WHERE (h.padre_id = a.id OR h.madre_id = a.id) AND h.seccion IN ('RD', 'RM');
    IF hijos < min_hijos THEN
      RAISE EXCEPTION 'El RM exige % descendientes en el Registro Definitivo (tiene %)', min_hijos, hijos USING ERRCODE = '23514';
    END IF;
  ELSIF via = 'premio' THEN
    IF coalesce(trim(motivo), '') = '' THEN
      RAISE EXCEPTION 'Describe el premio que justifica la inscripción en el RM' USING ERRCODE = '23514';
    END IF;
  ELSE
    RAISE EXCEPTION 'Vía de inscripción en el RM no válida' USING ERRCODE = '23514';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.validar_animal() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_sexo char(1); v_nac date;
BEGIN
  IF NEW.padre_id IS NOT NULL THEN
    SELECT sexo, fecha_nacimiento INTO v_sexo, v_nac FROM public.animales WHERE id = NEW.padre_id;
    IF v_sexo IS DISTINCT FROM 'M' THEN RAISE EXCEPTION 'El padre debe ser un gallo registrado'; END IF;
    IF v_nac >= NEW.fecha_nacimiento THEN RAISE EXCEPTION 'El padre debe haber nacido antes que el ejemplar'; END IF;
  END IF;
  IF NEW.madre_id IS NOT NULL THEN
    SELECT sexo, fecha_nacimiento INTO v_sexo, v_nac FROM public.animales WHERE id = NEW.madre_id;
    IF v_sexo IS DISTINCT FROM 'H' THEN RAISE EXCEPTION 'La madre debe ser una gallina registrada'; END IF;
    IF v_nac >= NEW.fecha_nacimiento THEN RAISE EXCEPTION 'La madre debe haber nacido antes que el ejemplar'; END IF;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.criador_id := coalesce(NEW.criador_id, NEW.usuario_id);
    IF NEW.seccion = 'RM' THEN
      RAISE EXCEPTION 'El Registro de Méritos se alcanza desde el RF o el RD, no en el alta' USING ERRCODE = '23514';
    END IF;
    IF NOT public.es_auditor() THEN
      NEW.usuario_id := auth.uid();                       -- el titular es siempre quien da el alta
      NEW.criador_id := auth.uid();                       -- y es también su criador de origen
      IF NEW.seccion NOT IN ('RN') THEN NEW.seccion := 'RN'; END IF;  -- RF/RA las asigna el Libro
    END IF;
  ELSE
    IF NOT public.es_admin() THEN NEW.usuario_id := OLD.usuario_id; END IF;
    NEW.criador_id := OLD.criador_id;                    -- el criador de origen no cambia nunca
    -- La sección solo cambia por calificación (trigger) o por la Dirección Técnica
    IF NEW.seccion IS DISTINCT FROM OLD.seccion AND NOT public.es_auditor()
       AND coalesce(current_setting('alacantina.promocion', true), '') <> 'si' THEN
      NEW.seccion := OLD.seccion;
    END IF;
    -- Registro de Méritos: solo la administración y con los requisitos comprobados aquí
    IF NEW.seccion = 'RM' AND OLD.seccion IS DISTINCT FROM 'RM' THEN
      PERFORM public.comprobar_rm(OLD, NEW.rm_via, NEW.rm_motivo);
    ELSIF NEW.seccion <> 'RM' THEN
      NEW.rm_fecha := NULL; NEW.rm_via := NULL; NEW.rm_motivo := NULL;
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_validar_animal ON public.animales;
CREATE TRIGGER trg_validar_animal BEFORE INSERT OR UPDATE ON public.animales
  FOR EACH ROW EXECUTE FUNCTION public.validar_animal();

-- Censo público: sin titular, REGA, coordenadas ni notas (RGPD)
CREATE OR REPLACE VIEW public.censo_publico WITH (security_invoker = false) AS
  SELECT id, anilla, sexo, variedad, fecha_nacimiento, seccion, padre_id, madre_id, familia, nombre,
         peso_g, municipio, provincia, estado, fotos, fotos_fecha, created_at, updated_at
  FROM public.animales
  WHERE estado = 'activo' OR id IN (SELECT padre_id FROM public.animales UNION SELECT madre_id FROM public.animales);

-- ----------------------------------------------------------------------------
-- 3. Calificaciones: baremo de 100 puntos en las 12 regiones del Estándar (PROPUESTA)
--    Clases EX>=90, MB>=80, B>=70, R>=65, I<65; D = descalificado por defecto grave.
--    Total, clase y resultado se recalculan SIEMPRE en el servidor.
--    El peso es obligatorio; se contrasta con el Estándar pero no puntúa.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.baremo_maximos() RETURNS jsonb
LANGUAGE sql IMMUTABLE AS $$
  SELECT '{"tronco":15,"cabeza":6,"cresta":10,"barbillas":5,"orejillas":10,"cuello":6,
           "dorso":8,"alas":4,"pecho":10,"cola":10,"extremidades":6,"plumaje":10}'::jsonb
$$;

-- true si "puntos" tiene exactamente las 12 regiones, cada uno numérico,
-- entre 0 y su máximo y en pasos de 0,5
CREATE OR REPLACE FUNCTION public.puntos_validos(j jsonb) RETURNS boolean
LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_typeof(j) = 'object'
     AND (SELECT count(*) FROM jsonb_object_keys(j)) = (SELECT count(*) FROM jsonb_object_keys(public.baremo_maximos()))
     AND NOT EXISTS (
       SELECT 1 FROM jsonb_each(j) e
       LEFT JOIN jsonb_each(public.baremo_maximos()) m ON m.key = e.key
       WHERE m.key IS NULL OR jsonb_typeof(e.value) <> 'number'
          OR (e.value)::numeric < 0 OR (e.value)::numeric > (m.value)::numeric
          OR ((e.value)::numeric * 2) <> trunc((e.value)::numeric * 2))
$$;

CREATE OR REPLACE FUNCTION public.clase_de(total numeric, descalificado boolean) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN descalificado THEN 'D' WHEN total >= 90 THEN 'EX' WHEN total >= 80 THEN 'MB'
              WHEN total >= 70 THEN 'B' WHEN total >= 65 THEN 'R' ELSE 'I' END
$$;

CREATE TABLE IF NOT EXISTS public.calificaciones (
  id               uuid PRIMARY KEY,
  animal_id        uuid NOT NULL REFERENCES public.animales(id) ON DELETE CASCADE,
  inspector_id     uuid NOT NULL REFERENCES public.perfiles(id),
  inspector_nombre text NOT NULL,
  fecha            date NOT NULL DEFAULT current_date,
  puntos           jsonb NOT NULL,
  total            numeric(4,1) NOT NULL,
  clase            text NOT NULL CHECK (clase IN ('EX', 'MB', 'B', 'R', 'I', 'D')),
  defectos         jsonb NOT NULL DEFAULT '[]'::jsonb,
  peso_g           integer NOT NULL CHECK (peso_g BETWEEN 30 AND 6000),
  peso_conforme    boolean,
  resultado        text NOT NULL CHECK (resultado IN ('Apto', 'No apto')),
  observaciones    text,
  latitud          double precision,
  longitud         double precision,
  created_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT doce_regiones CHECK (public.puntos_validos(puntos)),
  CONSTRAINT total_rango CHECK (total BETWEEN 0 AND 100),
  CONSTRAINT clase_coherente CHECK (clase = public.clase_de(total, jsonb_array_length(defectos) > 0)),
  CONSTRAINT resultado_coherente CHECK (resultado = 'No apto' OR clase IN ('EX', 'MB', 'B', 'R'))
);
CREATE INDEX IF NOT EXISTS calificaciones_animal ON public.calificaciones (animal_id);

-- Recalcula total/clase/resultado y promociona RN -> RD (equiparado al LG de la
-- Castellana Negra, A.6): Apto = sin descalificación y >= 65 puntos las gallinas /
-- >= 70 los gallos; para pasar a RD, además, variedad oficial y un año de edad.
CREATE OR REPLACE FUNCTION public.procesar_calificacion() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a public.animales%ROWTYPE;
BEGIN
  IF NOT public.es_auditor() THEN
    RAISE EXCEPTION 'Solo un inspector acreditado puede registrar calificaciones' USING ERRCODE = '42501';
  END IF;
  IF NOT public.puntos_validos(NEW.puntos) THEN
    RAISE EXCEPTION 'Puntuación incompleta o fuera de rango (12 regiones, de 0 al máximo, pasos de 0,5)' USING ERRCODE = '23514';
  END IF;
  NEW.inspector_id := auth.uid();
  NEW.total := (SELECT sum(value::numeric) FROM jsonb_each_text(NEW.puntos));
  NEW.clase := public.clase_de(NEW.total, jsonb_array_length(NEW.defectos) > 0);
  SELECT * INTO a FROM public.animales WHERE id = NEW.animal_id;
  NEW.resultado := CASE WHEN NEW.clase <> 'D' AND NEW.total >= (CASE a.sexo WHEN 'H' THEN 65 ELSE 70 END)
                        THEN 'Apto' ELSE 'No apto' END;
  -- Estándar ESGA025: gallo 3000–3500 g, gallina 2200–2600 g
  NEW.peso_conforme := CASE a.sexo WHEN 'M' THEN NEW.peso_g BETWEEN 3000 AND 3500
                                   WHEN 'H' THEN NEW.peso_g BETWEEN 2200 AND 2600 END;
  IF NEW.resultado = 'Apto' AND a.seccion = 'RN'
     AND a.variedad IN ('negra-moteada', 'pinta', 'blanca') AND a.fecha_nacimiento + interval '1 year' <= current_date
     AND coalesce(a.rega, '') <> ''
     -- filiación establecida: padre y madre inscritos en el Libro (Reg. UE 2016/1012, anexo II, por analogía)
     AND EXISTS (SELECT 1 FROM public.animales p WHERE p.id = a.padre_id AND p.seccion IN ('RF', 'RA', 'RD', 'RM'))
     AND EXISTS (SELECT 1 FROM public.animales m WHERE m.id = a.madre_id AND m.seccion IN ('RF', 'RA', 'RD', 'RM')) THEN
    PERFORM set_config('alacantina.promocion', 'si', true);
    UPDATE public.animales SET seccion = 'RD' WHERE id = NEW.animal_id;
    PERFORM set_config('alacantina.promocion', '', true);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_procesar_calificacion ON public.calificaciones;
CREATE TRIGGER trg_procesar_calificacion BEFORE INSERT ON public.calificaciones
  FOR EACH ROW EXECUTE FUNCTION public.procesar_calificacion();

-- ----------------------------------------------------------------------------
-- 4. Puesta: un registro por huevo pesado
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.huevos (
  id          uuid PRIMARY KEY,
  animal_id   uuid NOT NULL REFERENCES public.animales(id) ON DELETE CASCADE,
  usuario_id  uuid NOT NULL REFERENCES public.perfiles(id),
  fecha       date NOT NULL CHECK (fecha <= current_date),
  peso_g      numeric(5,1) NOT NULL CHECK (peso_g BETWEEN 20 AND 120),
  cascara     text NOT NULL,
  -- Apto desde 55 g con cáscara blanco crema; sin límite superior (criterio del Club)
  apto        boolean GENERATED ALWAYS AS (peso_g >= 55 AND cascara = 'Blanco crema') STORED,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS huevos_animal_fecha ON public.huevos (animal_id, fecha);

CREATE OR REPLACE FUNCTION public.validar_huevo() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_sexo char(1); v_tit uuid;
BEGIN
  SELECT sexo, usuario_id INTO v_sexo, v_tit FROM public.animales WHERE id = NEW.animal_id;
  IF v_sexo IS DISTINCT FROM 'H' THEN RAISE EXCEPTION 'El control de puesta es solo para gallinas'; END IF;
  NEW.usuario_id := v_tit;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_validar_huevo ON public.huevos;
CREATE TRIGGER trg_validar_huevo BEFORE INSERT OR UPDATE ON public.huevos
  FOR EACH ROW EXECUTE FUNCTION public.validar_huevo();

-- ----------------------------------------------------------------------------
-- 4b. Campañas de control de puesta: 15 días por gallina, 3 ciclos por temporada
--     (los huevos se siguen registrando en public.huevos; la campaña define el
--      periodo y las gallinas controladas)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.campanas (
  id          uuid PRIMARY KEY,
  usuario_id  uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  temporada   integer NOT NULL,
  ciclo       integer NOT NULL CHECK (ciclo BETWEEN 1 AND 3),
  inicio      date NOT NULL,
  dias        integer NOT NULL DEFAULT 15 CHECK (dias BETWEEN 7 AND 30),
  metodo      text NOT NULL DEFAULT 'jaula' CHECK (metodo IN ('jaula', 'ponedero', 'rfid')),
  gallinas    jsonb NOT NULL CHECK (jsonb_typeof(gallinas) = 'array' AND jsonb_array_length(gallinas) > 0),
  notas       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT temporada_inicio CHECK (temporada = extract(year FROM inicio)),
  CONSTRAINT un_ciclo_por_temporada UNIQUE (usuario_id, temporada, ciclo)
);

CREATE OR REPLACE FUNCTION public.validar_campana() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.es_admin() THEN NEW.usuario_id := auth.uid(); END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements_text(NEW.gallinas) g
             LEFT JOIN public.animales a ON a.id = g::uuid
             WHERE a.id IS NULL OR a.sexo <> 'H' OR a.usuario_id <> NEW.usuario_id) THEN
    RAISE EXCEPTION 'La campaña solo puede incluir gallinas del propio criador' USING ERRCODE = '23514';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_validar_campana ON public.campanas;
CREATE TRIGGER trg_validar_campana BEFORE INSERT OR UPDATE ON public.campanas
  FOR EACH ROW EXECUTE FUNCTION public.validar_campana();

-- ----------------------------------------------------------------------------
-- 4d. Reproducción: lotes (gallo + gallinas desde una fecha) e incubaciones
--     (una fila por madre: huevos, claros en el miraje, nacidos y pollitos dados de alta)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lotes (
  id          uuid PRIMARY KEY,
  usuario_id  uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  temporada   integer NOT NULL,
  familia     text,
  gallo_id    uuid NOT NULL REFERENCES public.animales(id),
  gallinas    jsonb NOT NULL CHECK (jsonb_typeof(gallinas) = 'array' AND jsonb_array_length(gallinas) > 0),
  inicio      date NOT NULL,
  fin         date,
  notas       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lote_temporada CHECK (temporada = extract(year FROM inicio)),
  CONSTRAINT lote_fechas CHECK (fin IS NULL OR fin >= inicio)
);

CREATE OR REPLACE FUNCTION public.validar_lote() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.es_admin() THEN NEW.usuario_id := auth.uid(); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.animales WHERE id = NEW.gallo_id AND sexo = 'M' AND usuario_id = NEW.usuario_id) THEN
    RAISE EXCEPTION 'El gallo del lote debe ser un macho del propio criador' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements_text(NEW.gallinas) g
             LEFT JOIN public.animales a ON a.id = g::uuid
             WHERE a.id IS NULL OR a.sexo <> 'H' OR a.usuario_id <> NEW.usuario_id) THEN
    RAISE EXCEPTION 'El lote solo puede incluir gallinas del propio criador' USING ERRCODE = '23514';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_validar_lote ON public.lotes;
CREATE TRIGGER trg_validar_lote BEFORE INSERT OR UPDATE ON public.lotes
  FOR EACH ROW EXECUTE FUNCTION public.validar_lote();

CREATE TABLE IF NOT EXISTS public.incubaciones (
  id          uuid PRIMARY KEY,
  usuario_id  uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  entrada     date NOT NULL,
  filas       jsonb NOT NULL CHECK (jsonb_typeof(filas) = 'array' AND jsonb_array_length(filas) > 0),
  notas       text,
  cerrada     boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.validar_incubacion() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE f jsonb; puestos int; claros int; nacidos int;
BEGIN
  IF NOT public.es_admin() THEN NEW.usuario_id := auth.uid(); END IF;
  FOR f IN SELECT * FROM jsonb_array_elements(NEW.filas) LOOP
    IF NOT EXISTS (SELECT 1 FROM public.animales WHERE id = (f->>'madre_id')::uuid AND sexo = 'H' AND usuario_id = NEW.usuario_id) THEN
      RAISE EXCEPTION 'Cada fila de la incubación debe ser de una gallina del propio criador' USING ERRCODE = '23514';
    END IF;
    IF f->>'padre_id' IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.animales WHERE id = (f->>'padre_id')::uuid AND sexo = 'M') THEN
      RAISE EXCEPTION 'El padre indicado no es un macho del Libro' USING ERRCODE = '23514';
    END IF;
    puestos := (f->>'puestos')::int; claros := coalesce((f->>'claros')::int, 0); nacidos := coalesce((f->>'nacidos')::int, 0);
    IF puestos IS NULL OR puestos <= 0 OR claros < 0 OR claros > puestos OR nacidos < 0 OR nacidos > puestos - claros THEN
      RAISE EXCEPTION 'Huevos, claros y nacidos incoherentes (nacidos ≤ huevos − claros)' USING ERRCODE = '23514';
    END IF;
    IF EXISTS (SELECT 1 FROM jsonb_array_elements_text(coalesce(f->'pollitos', '[]'::jsonb)) p
               LEFT JOIN public.animales a ON a.id = p::uuid
               WHERE a.id IS NULL OR a.madre_id IS DISTINCT FROM (f->>'madre_id')::uuid) THEN
      RAISE EXCEPTION 'Un pollito vinculado no es hijo de esa gallina' USING ERRCODE = '23514';
    END IF;
  END LOOP;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_validar_incubacion ON public.incubaciones;
CREATE TRIGGER trg_validar_incubacion BEFORE INSERT OR UPDATE ON public.incubaciones
  FOR EACH ROW EXECUTE FUNCTION public.validar_incubacion();

-- ----------------------------------------------------------------------------
-- 4e. Solicitudes de inspección: el criador pide la visita; inspección la programa y la cierra
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.solicitudes (
  id               uuid PRIMARY KEY,
  usuario_id       uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  animales         jsonb NOT NULL CHECK (jsonb_typeof(animales) = 'array' AND jsonb_array_length(animales) > 0),
  telefono         text NOT NULL CHECK (length(regexp_replace(telefono, '\D', '', 'g')) >= 9),
  horario          text NOT NULL DEFAULT 'indiferente' CHECK (horario IN ('indiferente', 'mananas', 'tardes', 'findes')),
  notas            text CHECK (length(notas) <= 500),
  estado           text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'programada', 'realizada', 'anulada')),
  fecha_visita     date,
  inspector_id     uuid REFERENCES public.perfiles(id),
  inspector_nombre text,
  respuesta        text CHECK (length(respuesta) <= 500),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT visita_con_fecha CHECK (estado NOT IN ('programada', 'realizada') OR fecha_visita IS NOT NULL)
);
-- Una sola solicitud abierta por criador
CREATE UNIQUE INDEX IF NOT EXISTS solicitud_abierta_unica ON public.solicitudes (usuario_id) WHERE estado IN ('pendiente', 'programada');

CREATE OR REPLACE FUNCTION public.validar_solicitud() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- La app sincroniza con upsert: si ya existe, decide la rama UPDATE
    IF EXISTS (SELECT 1 FROM public.solicitudes WHERE id = NEW.id) THEN RETURN NEW; END IF;
    IF NOT public.es_auditor() THEN NEW.usuario_id := auth.uid(); END IF;
    IF NEW.estado <> 'pendiente' OR NEW.inspector_id IS NOT NULL THEN
      RAISE EXCEPTION 'Una solicitud nueva empieza como pendiente' USING ERRCODE = '23514';
    END IF;
    IF EXISTS (SELECT 1 FROM jsonb_array_elements_text(NEW.animales) x
               LEFT JOIN public.animales a ON a.id = x::uuid
               WHERE a.id IS NULL OR a.usuario_id <> NEW.usuario_id OR a.estado = 'baja' OR a.seccion NOT IN ('RN', 'RA')) THEN
      RAISE EXCEPTION 'La solicitud solo puede incluir ejemplares activos del criador en RN o RA' USING ERRCODE = '23514';
    END IF;
  ELSE
    -- Lo que pidió el criador no cambia; una solicitud cerrada no se reabre
    NEW.usuario_id := OLD.usuario_id; NEW.animales := OLD.animales; NEW.created_at := OLD.created_at;
    IF OLD.estado IN ('realizada', 'anulada') AND NEW.estado IS DISTINCT FROM OLD.estado THEN
      RAISE EXCEPTION 'La solicitud ya está cerrada' USING ERRCODE = '23514';
    END IF;
    IF public.es_auditor() THEN
      IF NEW.estado <> OLD.estado OR NEW.fecha_visita IS DISTINCT FROM OLD.fecha_visita THEN NEW.inspector_id := auth.uid(); END IF;
    ELSE
      -- El criador solo puede anular la suya
      IF NEW.estado NOT IN (OLD.estado, 'anulada') THEN
        RAISE EXCEPTION 'Solo la inspección programa o cierra una solicitud' USING ERRCODE = '42501';
      END IF;
      NEW.fecha_visita := OLD.fecha_visita; NEW.inspector_id := OLD.inspector_id; NEW.inspector_nombre := OLD.inspector_nombre;
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_validar_solicitud ON public.solicitudes;
CREATE TRIGGER trg_validar_solicitud BEFORE INSERT OR UPDATE ON public.solicitudes
  FOR EACH ROW EXECUTE FUNCTION public.validar_solicitud();

-- ----------------------------------------------------------------------------
-- 4c. Historial de cambios del Libro (para el control oficial: quién, cuándo, qué)
--     Solo lo escriben los triggers; lo leen la administración y la inspección.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.historial (
  id         bigserial PRIMARY KEY,
  tabla      text NOT NULL,
  registro   uuid NOT NULL,
  operacion  text NOT NULL,
  usuario_id uuid,
  fecha      timestamptz NOT NULL DEFAULT now(),
  antes      jsonb,
  despues    jsonb
);
CREATE INDEX IF NOT EXISTS historial_registro ON public.historial (registro, fecha);

CREATE OR REPLACE FUNCTION public.anotar_historial() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.historial (tabla, registro, operacion, usuario_id, antes, despues)
  VALUES (TG_TABLE_NAME, coalesce(NEW.id, OLD.id), TG_OP, auth.uid(),
          CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) - 'fotos' - 'fotos_fecha' END,
          CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) - 'fotos' - 'fotos_fecha' END);
  RETURN coalesce(NEW, OLD);
END $$;
DROP TRIGGER IF EXISTS trg_historial_animales ON public.animales;
CREATE TRIGGER trg_historial_animales AFTER INSERT OR UPDATE OR DELETE ON public.animales
  FOR EACH ROW EXECUTE FUNCTION public.anotar_historial();
DROP TRIGGER IF EXISTS trg_historial_calificaciones ON public.calificaciones;
CREATE TRIGGER trg_historial_calificaciones AFTER INSERT ON public.calificaciones
  FOR EACH ROW EXECUTE FUNCTION public.anotar_historial();

-- ----------------------------------------------------------------------------
-- 5. Seguridad a nivel de fila (RLS)
-- ----------------------------------------------------------------------------
ALTER TABLE public.perfiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.animales       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calificaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.huevos         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campanas       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historial      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lotes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incubaciones   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solicitudes    ENABLE ROW LEVEL SECURITY;

DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public'
           AND tablename IN ('perfiles', 'animales', 'calificaciones', 'huevos', 'campanas', 'historial', 'lotes', 'incubaciones', 'solicitudes') LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

CREATE POLICY perfiles_ver ON public.perfiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.es_auditor());
CREATE POLICY perfiles_editar ON public.perfiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.es_admin()) WITH CHECK (id = auth.uid() OR public.es_admin());
CREATE POLICY perfiles_crear ON public.perfiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid() OR public.es_admin());

CREATE POLICY animales_ver ON public.animales FOR SELECT TO authenticated
  USING (usuario_id = auth.uid() OR public.es_auditor());
CREATE POLICY animales_crear ON public.animales FOR INSERT TO authenticated
  WITH CHECK (public.rol_actual() IS NOT NULL);
CREATE POLICY animales_editar ON public.animales FOR UPDATE TO authenticated
  USING (usuario_id = auth.uid() OR public.es_auditor()) WITH CHECK (usuario_id = auth.uid() OR public.es_auditor());

CREATE POLICY calif_ver ON public.calificaciones FOR SELECT TO authenticated
  USING (public.es_auditor() OR EXISTS (SELECT 1 FROM public.animales a WHERE a.id = animal_id AND a.usuario_id = auth.uid()));
CREATE POLICY calif_crear ON public.calificaciones FOR INSERT TO authenticated
  WITH CHECK (public.es_auditor());
-- Sin UPDATE ni DELETE: una ficha cerrada no se modifica (se emite otra)

CREATE POLICY huevos_ver ON public.huevos FOR SELECT TO authenticated
  USING (usuario_id = auth.uid() OR public.es_auditor());
CREATE POLICY huevos_crear ON public.huevos FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.animales a WHERE a.id = animal_id AND a.usuario_id = auth.uid()));
CREATE POLICY huevos_borrar ON public.huevos FOR DELETE TO authenticated
  USING (usuario_id = auth.uid());

CREATE POLICY campanas_ver ON public.campanas FOR SELECT TO authenticated
  USING (usuario_id = auth.uid() OR public.es_auditor());
CREATE POLICY campanas_crear ON public.campanas FOR INSERT TO authenticated
  WITH CHECK (usuario_id = auth.uid() OR public.es_admin());
CREATE POLICY campanas_editar ON public.campanas FOR UPDATE TO authenticated
  USING (usuario_id = auth.uid()) WITH CHECK (usuario_id = auth.uid());
CREATE POLICY campanas_borrar ON public.campanas FOR DELETE TO authenticated
  USING (usuario_id = auth.uid());

CREATE POLICY lotes_ver ON public.lotes FOR SELECT TO authenticated
  USING (usuario_id = auth.uid() OR public.es_auditor());
CREATE POLICY lotes_crear ON public.lotes FOR INSERT TO authenticated
  WITH CHECK (usuario_id = auth.uid() OR public.es_admin());
CREATE POLICY lotes_editar ON public.lotes FOR UPDATE TO authenticated
  USING (usuario_id = auth.uid()) WITH CHECK (usuario_id = auth.uid());
CREATE POLICY lotes_borrar ON public.lotes FOR DELETE TO authenticated
  USING (usuario_id = auth.uid());

CREATE POLICY incubaciones_ver ON public.incubaciones FOR SELECT TO authenticated
  USING (usuario_id = auth.uid() OR public.es_auditor());
CREATE POLICY incubaciones_crear ON public.incubaciones FOR INSERT TO authenticated
  WITH CHECK (usuario_id = auth.uid() OR public.es_admin());
CREATE POLICY incubaciones_editar ON public.incubaciones FOR UPDATE TO authenticated
  USING (usuario_id = auth.uid()) WITH CHECK (usuario_id = auth.uid());
CREATE POLICY incubaciones_borrar ON public.incubaciones FOR DELETE TO authenticated
  USING (usuario_id = auth.uid());

CREATE POLICY solicitudes_ver ON public.solicitudes FOR SELECT TO authenticated
  USING (usuario_id = auth.uid() OR public.es_auditor());
CREATE POLICY solicitudes_crear ON public.solicitudes FOR INSERT TO authenticated
  WITH CHECK (usuario_id = auth.uid() OR public.es_auditor());
CREATE POLICY solicitudes_editar ON public.solicitudes FOR UPDATE TO authenticated
  USING (usuario_id = auth.uid() OR public.es_auditor()) WITH CHECK (usuario_id = auth.uid() OR public.es_auditor());

CREATE POLICY historial_ver ON public.historial FOR SELECT TO authenticated USING (public.es_auditor());

GRANT SELECT ON public.censo_publico TO anon, authenticated;
GRANT SELECT ON public.historial TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campanas, public.lotes, public.incubaciones TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.solicitudes TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.perfiles, public.animales TO authenticated;
GRANT SELECT, INSERT ON public.calificaciones TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.huevos TO authenticated;

-- ----------------------------------------------------------------------------
-- 6. Fotos (Storage). Cada usuario escribe solo en su carpeta: <usuario_id>/...
-- ----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('fotos-alacantina', 'fotos-alacantina', true, 5242880, ARRAY['image/webp', 'image/jpeg', 'image/png'])
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/webp', 'image/jpeg', 'image/png'];

DROP POLICY IF EXISTS fotos_ver ON storage.objects;
DROP POLICY IF EXISTS fotos_subir ON storage.objects;
DROP POLICY IF EXISTS fotos_actualizar ON storage.objects;
CREATE POLICY fotos_ver ON storage.objects FOR SELECT USING (bucket_id = 'fotos-alacantina');
CREATE POLICY fotos_subir ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'fotos-alacantina' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY fotos_actualizar ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'fotos-alacantina' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ----------------------------------------------------------------------------
-- 7. Primer administrador (ejecutar UNA vez, con el correo real, tras registrarse en la app)
-- ----------------------------------------------------------------------------
-- ALTER TABLE public.perfiles DISABLE TRIGGER trg_proteger_perfil;
-- UPDATE public.perfiles SET rol = 'administrador' WHERE email = '<correo de la Dirección Técnica>';
-- ALTER TABLE public.perfiles ENABLE TRIGGER trg_proteger_perfil;
