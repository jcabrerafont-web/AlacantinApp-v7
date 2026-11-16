-- Pruebas de supabase/schema.sql: ejecutar sobre una BD con supabase_stub.sql + schema.sql
\set ON_ERROR_STOP 0
\pset footer off
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
 ('00000000-0000-0000-0000-00000000000a', 'criador@x.es', '{"nombre":"Criadora","rol":"administrador"}'),
 ('00000000-0000-0000-0000-00000000000b', 'inspector@x.es', '{"nombre":"Inspector"}'),
 ('00000000-0000-0000-0000-00000000000c', 'otro@x.es', '{"nombre":"Otro"}');
ALTER TABLE perfiles DISABLE TRIGGER trg_proteger_perfil;
UPDATE perfiles SET rol = 'inspector' WHERE email = 'inspector@x.es';
ALTER TABLE perfiles ENABLE TRIGGER trg_proteger_perfil;
\echo '== 1. Rol inicial ignora metadata (esperado: aspirante, inspector, aspirante)'
SELECT email, rol FROM perfiles ORDER BY email;

SET ROLE authenticated; SET request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
\echo '== 2. Autoescalada bloqueada (esperado: aspirante) y REGA promociona (esperado: criador)'
UPDATE perfiles SET rol = 'administrador' WHERE id = auth.uid();
SELECT rol AS tras_autoescalada FROM perfiles WHERE id = auth.uid();
INSERT INTO perfiles (id, rega, municipio) VALUES (auth.uid(), 'ES030140001234', 'Elche')
  ON CONFLICT (id) DO UPDATE SET rega = EXCLUDED.rega, municipio = EXCLUDED.municipio;
SELECT rol AS tras_rega FROM perfiles WHERE id = auth.uid();

\echo '== 3. Altas del criador (sección forzada a RN, titular = él mismo)'
INSERT INTO animales (id, usuario_id, anilla, sexo, variedad, fecha_nacimiento, seccion) VALUES
 ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000c', 'E2420000001', 'M', 'negra-moteada', '2024-01-01', 'RD'),
 ('10000000-0000-0000-0000-000000000002', auth.uid(), 'E2418000002', 'H', 'negra-moteada', '2024-01-01', 'RN');
INSERT INTO animales (id, usuario_id, anilla, sexo, variedad, fecha_nacimiento, padre_id, madre_id) VALUES
 ('10000000-0000-0000-0000-000000000003', auth.uid(), 'E2518000003', 'H', 'blanca', '2025-03-01', '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002');
SELECT anilla, seccion, usuario_id = auth.uid() AS es_mio FROM animales ORDER BY anilla;
\echo '== 4. Rechazos esperados: padre hembra, variedad no reconocida, anilla duplicada, RFID inválido, anilla no EE, año de anilla distinto del de nacimiento, diámetro no admitido'
INSERT INTO animales (id, usuario_id, anilla, sexo, variedad, fecha_nacimiento, padre_id) VALUES (gen_random_uuid(), auth.uid(), 'E2520000010', 'M', 'blanca', '2025-05-01', '10000000-0000-0000-0000-000000000002');
INSERT INTO animales (id, usuario_id, anilla, sexo, variedad, fecha_nacimiento) VALUES (gen_random_uuid(), auth.uid(), 'E2520000011', 'M', 'aperdizada', '2025-05-01');
INSERT INTO animales (id, usuario_id, anilla, sexo, variedad, fecha_nacimiento) VALUES (gen_random_uuid(), auth.uid(), 'E2418000002', 'H', 'blanca', '2024-05-01');
INSERT INTO animales (id, usuario_id, anilla, sexo, variedad, fecha_nacimiento, rfid) VALUES (gen_random_uuid(), auth.uid(), 'E2518000012', 'H', 'blanca', '2025-05-01', '123');
INSERT INTO animales (id, usuario_id, anilla, sexo, variedad, fecha_nacimiento) VALUES (gen_random_uuid(), auth.uid(), 'ABC123', 'H', 'blanca', '2025-05-01');
INSERT INTO animales (id, usuario_id, anilla, sexo, variedad, fecha_nacimiento) VALUES (gen_random_uuid(), auth.uid(), 'E2618000020', 'H', 'blanca', '2025-05-01');
INSERT INTO animales (id, usuario_id, anilla, sexo, variedad, fecha_nacimiento) VALUES (gen_random_uuid(), auth.uid(), 'E2518000021', 'M', 'blanca', '2025-05-01');
\echo '== 5. El criador no puede subirse de sección (esperado: RN)'
UPDATE animales SET seccion = 'RD' WHERE anilla = 'E2518000003';
SELECT anilla, seccion FROM animales WHERE anilla = 'E2518000003';
\echo '== 6. Puesta: apto calculado en servidor; huevo de gallo rechazado'
INSERT INTO huevos (id, animal_id, usuario_id, fecha, peso_g, cascara) VALUES
 (gen_random_uuid(), '10000000-0000-0000-0000-000000000002', auth.uid(), current_date, 61.5, 'Blanco crema'),
 (gen_random_uuid(), '10000000-0000-0000-0000-000000000002', auth.uid(), current_date, 72.0, 'Blanco crema'),
 (gen_random_uuid(), '10000000-0000-0000-0000-000000000002', auth.uid(), current_date, 60.0, 'Tostada');
SELECT peso_g, cascara, apto FROM huevos ORDER BY peso_g;
\echo '== 7. El criador no puede calificar (esperado: error 42501)'
INSERT INTO calificaciones (id, animal_id, inspector_id, inspector_nombre, peso_g, puntos, total, clase, resultado) VALUES
 (gen_random_uuid(), '10000000-0000-0000-0000-000000000002', auth.uid(), 'yo', 2400, '{"tronco":15,"cabeza":6,"cresta":10,"barbillas":5,"orejillas":10,"cuello":6,"dorso":8,"alas":4,"pecho":10,"cola":10,"extremidades":6,"plumaje":10}', 100, 'EX', 'Apto');
RESET ROLE;

SET ROLE authenticated; SET request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
\echo '== 8. Otro criador: no ve animales ajenos en la tabla (0), sí en el censo público, y no los edita'
SELECT count(*) AS animales_ajenos_visibles FROM animales WHERE usuario_id <> auth.uid();
SELECT count(*) AS en_censo_publico FROM censo_publico;
UPDATE animales SET nombre = 'hackeado' WHERE anilla = 'E2418000002';
RESET ROLE;
SELECT nombre AS nombre_h1_tras_intento FROM animales WHERE anilla = 'E2418000002';

SET ROLE anon; SET request.jwt.claim.sub = '';
\echo '== 9. Anónimo: censo público sin datos personales; sin acceso a tablas'
SELECT anilla, seccion FROM censo_publico ORDER BY anilla;
SELECT count(*) FROM animales;
RESET ROLE;
\echo '   (columnas del censo público)'
SELECT string_agg(column_name, ', ' ORDER BY ordinal_position) FROM information_schema.columns WHERE table_name = 'censo_publico';

SET ROLE authenticated; SET request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
\echo '== 10. Inspector: 12 regiones obligatorias y en rango; el servidor recalcula total/clase/resultado; Apto promociona RN->RD (>=180 días)'
\echo '   10a incompleto (esperado: error 23514)'
INSERT INTO calificaciones (id, animal_id, inspector_id, inspector_nombre, peso_g, puntos, total, clase, resultado) VALUES
 (gen_random_uuid(), '10000000-0000-0000-0000-000000000002', auth.uid(), 'Insp', 2400, '{"tronco":15}', 100, 'EX', 'Apto');
\echo '   10b apartado por encima del máximo (esperado: error 23514)'
INSERT INTO calificaciones (id, animal_id, inspector_id, inspector_nombre, peso_g, puntos, total, clase, resultado) VALUES
 (gen_random_uuid(), '10000000-0000-0000-0000-000000000002', auth.uid(), 'Insp', 2400, '{"tronco":16,"cabeza":6,"cresta":10,"barbillas":5,"orejillas":10,"cuello":6,"dorso":8,"alas":4,"pecho":10,"cola":10,"extremidades":6,"plumaje":10}', 100, 'EX', 'Apto');
\echo '   10c cliente miente (100 con 58 puntos reales) -> servidor guarda 58 / I / No apto'
INSERT INTO calificaciones (id, animal_id, inspector_id, inspector_nombre, peso_g, puntos, total, clase, resultado) VALUES
 (gen_random_uuid(), '10000000-0000-0000-0000-000000000002', auth.uid(), 'Insp', 2400, '{"tronco":9,"cabeza":3,"cresta":6,"barbillas":3,"orejillas":6,"cuello":3,"dorso":5,"alas":2,"pecho":6,"cola":6,"extremidades":3,"plumaje":6}', 100, 'EX', 'Apto');
\echo '   10d 100 puntos con defecto grave -> D / No apto'
INSERT INTO calificaciones (id, animal_id, inspector_id, inspector_nombre, peso_g, puntos, total, clase, defectos, resultado) VALUES
 (gen_random_uuid(), '10000000-0000-0000-0000-000000000002', auth.uid(), 'Insp', 2400, '{"tronco":15,"cabeza":6,"cresta":10,"barbillas":5,"orejillas":10,"cuello":6,"dorso":8,"alas":4,"pecho":10,"cola":10,"extremidades":6,"plumaje":10}', 100, 'EX', '["orejilla"]', 'Apto');
SELECT anilla, seccion AS seccion_tras_no_aptos FROM animales WHERE anilla = 'E2418000002';
\echo '   10e 82,5 puntos -> MB / Apto y promoción a RD'
INSERT INTO calificaciones (id, animal_id, inspector_id, inspector_nombre, peso_g, puntos, total, clase, resultado) VALUES
 (gen_random_uuid(), '10000000-0000-0000-0000-000000000002', auth.uid(), 'Insp', 2400, '{"tronco":12.5,"cabeza":5,"cresta":8,"barbillas":4,"orejillas":9,"cuello":5,"dorso":6,"alas":3,"pecho":8,"cola":8,"extremidades":5,"plumaje":9}', 0, 'I', 'No apto');
\echo '   10f sin peso (esperado: error de NOT NULL)'
INSERT INTO calificaciones (id, animal_id, inspector_id, inspector_nombre, puntos, total, clase, resultado) VALUES
 (gen_random_uuid(), '10000000-0000-0000-0000-000000000002', auth.uid(), 'Insp', '{"tronco":15,"cabeza":6,"cresta":10,"barbillas":5,"orejillas":10,"cuello":6,"dorso":8,"alas":4,"pecho":10,"cola":10,"extremidades":6,"plumaje":10}', 100, 'EX', 'Apto');
SELECT total, clase, resultado, peso_g, peso_conforme FROM calificaciones ORDER BY created_at, total;
SELECT anilla, seccion FROM animales WHERE anilla = 'E2418000002';
\echo '== 11. Calificación cerrada no modificable (esperado: 0 filas)'
UPDATE calificaciones SET resultado = 'No apto';
RESET ROLE;
SELECT count(*) AS calificaciones FROM calificaciones;

SET ROLE authenticated; SET request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
\echo '== 12. Registro de Méritos'
\echo '   12a inspector no puede inscribir en RM (esperado: error 42501)'
UPDATE animales SET seccion = 'RM', rm_fecha = current_date, rm_via = 'premio', rm_motivo = 'Premio' WHERE anilla = 'E2418000002';
RESET ROLE;
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES ('00000000-0000-0000-0000-00000000000d', 'admin@x.es', '{"nombre":"Admin"}');
ALTER TABLE perfiles DISABLE TRIGGER trg_proteger_perfil;
UPDATE perfiles SET rol = 'administrador' WHERE email = 'admin@x.es';
ALTER TABLE perfiles ENABLE TRIGGER trg_proteger_perfil;
\echo '   12a2 el criador titular tampoco: la sección no cambia (esperado: RD)'
SET ROLE authenticated; SET request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
UPDATE animales SET seccion = 'RM', rm_fecha = current_date, rm_via = 'premio', rm_motivo = 'Premio' WHERE anilla = 'E2418000002';
SELECT seccion FROM animales WHERE anilla = 'E2418000002';
RESET ROLE;
SET ROLE authenticated; SET request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
\echo '   12b admin, gallina con 82,5 puntos pero 0 descendientes en RD (esperado: error 23514)'
UPDATE animales SET seccion = 'RM', rm_fecha = current_date, rm_via = 'requisitos', rm_motivo = 'auto' WHERE anilla = 'E2418000002';
\echo '   12c alta directa en RM (esperado: error 23514)'
INSERT INTO animales (id, usuario_id, anilla, sexo, variedad, fecha_nacimiento, seccion, rm_fecha, rm_via, rm_motivo) VALUES
 (gen_random_uuid(), auth.uid(), 'E2518000040', 'H', 'blanca', '2025-06-01', 'RM', current_date, 'premio', 'x');
\echo '   12d con 3 hijas en RD -> inscrita en RM'
INSERT INTO animales (id, usuario_id, anilla, sexo, variedad, fecha_nacimiento, madre_id, seccion) VALUES
 (gen_random_uuid(), '00000000-0000-0000-0000-00000000000a', 'E2518000030', 'H', 'blanca', '2025-06-01', '10000000-0000-0000-0000-000000000002', 'RD'),
 (gen_random_uuid(), '00000000-0000-0000-0000-00000000000a', 'E2518000031', 'H', 'blanca', '2025-06-01', '10000000-0000-0000-0000-000000000002', 'RD'),
 (gen_random_uuid(), '00000000-0000-0000-0000-00000000000a', 'E2518000032', 'H', 'blanca', '2025-06-01', '10000000-0000-0000-0000-000000000002', 'RD');
UPDATE animales SET seccion = 'RM', rm_fecha = current_date, rm_via = 'requisitos', rm_motivo = '82,5 puntos · 3 descendientes en RD' WHERE anilla = 'E2418000002';
SELECT anilla, seccion, rm_via, rm_motivo FROM animales WHERE anilla = 'E2418000002';
\echo '   12e gallo que sigue en RN, aunque sea por premio (esperado: error 23514)'
UPDATE animales SET seccion = 'RM', rm_fecha = current_date, rm_via = 'premio', rm_motivo = 'Campeonato' WHERE anilla = 'E2420000001';
\echo '   12f hija en RD sin calificación suficiente (esperado: error 23514)'
UPDATE animales SET seccion = 'RM', rm_fecha = current_date, rm_via = 'premio', rm_motivo = '' WHERE anilla = 'E2518000030';
RESET ROLE;
