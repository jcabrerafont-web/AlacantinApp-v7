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
 ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000c', 'G1', 'M', 'negra-moteada', '2024-01-01', 'RD'),
 ('10000000-0000-0000-0000-000000000002', auth.uid(), 'H1', 'H', 'negra-moteada', '2024-01-01', 'RN');
INSERT INTO animales (id, usuario_id, anilla, sexo, variedad, fecha_nacimiento, padre_id, madre_id) VALUES
 ('10000000-0000-0000-0000-000000000003', auth.uid(), 'H2', 'H', 'blanca', '2025-03-01', '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002');
SELECT anilla, seccion, usuario_id = auth.uid() AS es_mio FROM animales ORDER BY anilla;
\echo '== 4. Rechazos esperados: padre hembra, variedad no reconocida, anilla duplicada, RFID inválido'
INSERT INTO animales (id, usuario_id, anilla, sexo, variedad, fecha_nacimiento, padre_id) VALUES (gen_random_uuid(), auth.uid(), 'X1', 'M', 'blanca', '2025-05-01', '10000000-0000-0000-0000-000000000002');
INSERT INTO animales (id, usuario_id, anilla, sexo, variedad, fecha_nacimiento) VALUES (gen_random_uuid(), auth.uid(), 'X2', 'M', 'aperdizada', '2025-05-01');
INSERT INTO animales (id, usuario_id, anilla, sexo, variedad, fecha_nacimiento) VALUES (gen_random_uuid(), auth.uid(), 'h1', 'H', 'blanca', '2025-05-01');
INSERT INTO animales (id, usuario_id, anilla, sexo, variedad, fecha_nacimiento, rfid) VALUES (gen_random_uuid(), auth.uid(), 'X3', 'H', 'blanca', '2025-05-01', '123');
\echo '== 5. El criador no puede subirse de sección (esperado: RN)'
UPDATE animales SET seccion = 'RD' WHERE anilla = 'H2';
SELECT anilla, seccion FROM animales WHERE anilla = 'H2';
\echo '== 6. Puesta: apto calculado en servidor; huevo de gallo rechazado'
INSERT INTO huevos (id, animal_id, usuario_id, fecha, peso_g, cascara) VALUES
 (gen_random_uuid(), '10000000-0000-0000-0000-000000000002', auth.uid(), current_date, 61.5, 'Blanco crema'),
 (gen_random_uuid(), '10000000-0000-0000-0000-000000000002', auth.uid(), current_date, 72.0, 'Blanco crema'),
 (gen_random_uuid(), '10000000-0000-0000-0000-000000000002', auth.uid(), current_date, 60.0, 'Tostada');
SELECT peso_g, cascara, apto FROM huevos ORDER BY peso_g;
\echo '== 7. El criador no puede calificar (esperado: error 42501)'
INSERT INTO calificaciones (id, animal_id, inspector_id, inspector_nombre, regiones, resultado) VALUES
 (gen_random_uuid(), '10000000-0000-0000-0000-000000000002', auth.uid(), 'yo', '{"a":1,"b":1,"c":1,"d":1,"e":1,"f":1,"g":1,"h":1,"i":1,"j":1,"k":1,"l":1}', 'Apto');
RESET ROLE;

SET ROLE authenticated; SET request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
\echo '== 8. Otro criador: no ve animales ajenos en la tabla (0), sí en el censo público, y no los edita'
SELECT count(*) AS animales_ajenos_visibles FROM animales WHERE usuario_id <> auth.uid();
SELECT count(*) AS en_censo_publico FROM censo_publico;
UPDATE animales SET nombre = 'hackeado' WHERE anilla = 'H1';
RESET ROLE;
SELECT nombre AS nombre_h1_tras_intento FROM animales WHERE anilla = 'H1';

SET ROLE anon; SET request.jwt.claim.sub = '';
\echo '== 9. Anónimo: censo público sin datos personales; sin acceso a tablas'
SELECT anilla, seccion FROM censo_publico ORDER BY anilla;
SELECT count(*) FROM animales;
RESET ROLE;
\echo '   (columnas del censo público)'
SELECT string_agg(column_name, ', ' ORDER BY ordinal_position) FROM information_schema.columns WHERE table_name = 'censo_publico';

SET ROLE authenticated; SET request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
\echo '== 10. Inspector: 12 regiones obligatorias; defecto grave impide Apto; Apto promociona RN->RD (>=180 días)'
INSERT INTO calificaciones (id, animal_id, inspector_id, inspector_nombre, regiones, resultado) VALUES
 (gen_random_uuid(), '10000000-0000-0000-0000-000000000002', auth.uid(), 'Insp', '{"a":1}', 'Apto');
INSERT INTO calificaciones (id, animal_id, inspector_id, inspector_nombre, regiones, defectos, resultado) VALUES
 (gen_random_uuid(), '10000000-0000-0000-0000-000000000002', auth.uid(), 'Insp', '{"a":1,"b":1,"c":1,"d":1,"e":1,"f":1,"g":1,"h":1,"i":1,"j":1,"k":1,"l":1}', '["orejilla"]', 'Apto');
INSERT INTO calificaciones (id, animal_id, inspector_id, inspector_nombre, regiones, resultado) VALUES
 (gen_random_uuid(), '10000000-0000-0000-0000-000000000002', auth.uid(), 'Insp', '{"a":1,"b":1,"c":1,"d":1,"e":1,"f":1,"g":1,"h":1,"i":1,"j":1,"k":1,"l":1}', 'Apto');
SELECT anilla, seccion FROM animales WHERE anilla = 'H1';
\echo '== 11. Calificación cerrada no modificable (esperado: 0 filas)'
UPDATE calificaciones SET resultado = 'No apto';
RESET ROLE;
SELECT count(*) AS calificaciones FROM calificaciones;
