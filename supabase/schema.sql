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
  usuario_id       uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE RESTRICT,
  anilla           text NOT NULL,
  sexo             char(1) NOT NULL CHECK (sexo IN ('M', 'H')),
  variedad         text NOT NULL CHECK (variedad IN ('negra-moteada', 'pinta', 'blanca', 'arminada', 'milflores')),
  fecha_nacimiento date NOT NULL CHECK (fecha_nacimiento <= current_date),
  seccion          text NOT NULL DEFAULT 'RN' CHECK (seccion IN ('RN', 'RF', 'RA', 'RD')),
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
  notas            text,
  estado           text NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'baja')),
  baja_fecha       date,
  baja_causa       text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT progenitores_distintos CHECK (padre_id IS NULL OR madre_id IS NULL OR padre_id <> madre_id),
  CONSTRAINT no_es_su_propio_padre CHECK (padre_id IS DISTINCT FROM id AND madre_id IS DISTINCT FROM id),
  CONSTRAINT rd_solo_oficiales CHECK (seccion <> 'RD' OR variedad IN ('negra-moteada', 'pinta', 'blanca'))
);
CREATE UNIQUE INDEX IF NOT EXISTS animales_anilla_activa ON public.animales (upper(anilla)) WHERE estado = 'activo';
CREATE UNIQUE INDEX IF NOT EXISTS animales_rfid_activo ON public.animales (rfid) WHERE rfid IS NOT NULL AND estado = 'activo';
CREATE INDEX IF NOT EXISTS animales_usuario ON public.animales (usuario_id);
CREATE INDEX IF NOT EXISTS animales_padre ON public.animales (padre_id);
CREATE INDEX IF NOT EXISTS animales_madre ON public.animales (madre_id);

-- Reglas que no puede saltarse el cliente: titularidad, sexo de progenitores y sección
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
    IF NOT public.es_auditor() THEN
      NEW.usuario_id := auth.uid();                       -- el titular es siempre quien da el alta
      IF NEW.seccion NOT IN ('RN') THEN NEW.seccion := 'RN'; END IF;  -- RF/RA las asigna el Libro
    END IF;
  ELSE
    IF NOT public.es_admin() THEN NEW.usuario_id := OLD.usuario_id; END IF;
    -- La sección solo cambia por calificación (trigger) o por la Dirección Técnica
    IF NEW.seccion IS DISTINCT FROM OLD.seccion AND NOT public.es_auditor()
       AND coalesce(current_setting('alacantina.promocion', true), '') <> 'si' THEN
      NEW.seccion := OLD.seccion;
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
         peso_g, municipio, provincia, estado, fotos, created_at, updated_at
  FROM public.animales
  WHERE estado = 'activo' OR id IN (SELECT padre_id FROM public.animales UNION SELECT madre_id FROM public.animales);

-- ----------------------------------------------------------------------------
-- 3. Calificaciones (ficha de conformidad con el Estándar)
CREATE OR REPLACE FUNCTION public.num_claves(j jsonb) RETURNS integer
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN jsonb_typeof(j) = 'object' THEN (SELECT count(*)::int FROM jsonb_object_keys(j)) ELSE 0 END
$$;
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.calificaciones (
  id               uuid PRIMARY KEY,
  animal_id        uuid NOT NULL REFERENCES public.animales(id) ON DELETE CASCADE,
  inspector_id     uuid NOT NULL REFERENCES public.perfiles(id),
  inspector_nombre text NOT NULL,
  fecha            date NOT NULL DEFAULT current_date,
  regiones         jsonb NOT NULL,
  defectos         jsonb NOT NULL DEFAULT '[]'::jsonb,
  peso_g           integer CHECK (peso_g IS NULL OR peso_g BETWEEN 30 AND 6000),
  peso_conforme    boolean,
  resultado        text NOT NULL CHECK (resultado IN ('Apto', 'No apto')),
  observaciones    text,
  latitud          double precision,
  longitud         double precision,
  created_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT doce_regiones CHECK (public.num_claves(regiones) = 12),
  CONSTRAINT grave_no_apto CHECK (jsonb_array_length(defectos) = 0 OR resultado = 'No apto')
);
CREATE INDEX IF NOT EXISTS calificaciones_animal ON public.calificaciones (animal_id);

-- Promoción RN -> RD: Apto, sin defectos graves, variedad oficial y >= 180 días de edad
CREATE OR REPLACE FUNCTION public.procesar_calificacion() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a public.animales%ROWTYPE;
BEGIN
  IF NOT public.es_auditor() THEN
    RAISE EXCEPTION 'Solo un inspector acreditado puede registrar calificaciones' USING ERRCODE = '42501';
  END IF;
  NEW.inspector_id := auth.uid();
  SELECT * INTO a FROM public.animales WHERE id = NEW.animal_id;
  IF NEW.resultado = 'Apto' AND jsonb_array_length(NEW.defectos) = 0 AND a.seccion = 'RN'
     AND a.variedad IN ('negra-moteada', 'pinta', 'blanca') AND current_date - a.fecha_nacimiento >= 180 THEN
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
  apto        boolean GENERATED ALWAYS AS (peso_g BETWEEN 55 AND 70 AND cascara = 'Blanco crema') STORED,
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
-- 5. Seguridad a nivel de fila (RLS)
-- ----------------------------------------------------------------------------
ALTER TABLE public.perfiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.animales       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calificaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.huevos         ENABLE ROW LEVEL SECURITY;

DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public'
           AND tablename IN ('perfiles', 'animales', 'calificaciones', 'huevos') LOOP
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

GRANT SELECT ON public.censo_publico TO anon, authenticated;
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
