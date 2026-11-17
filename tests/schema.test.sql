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
\echo '== 10. Inspector: 12 regiones obligatorias y en rango; el servidor recalcula total/clase/resultado; Apto promociona RN->RD (>= 1 año; gallina >= 65)'
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
\echo '   10e 82,5 puntos -> MB / Apto, pero SIN padres en el Libro ni REGA: sigue en RN'
INSERT INTO calificaciones (id, animal_id, inspector_id, inspector_nombre, peso_g, puntos, total, clase, resultado) VALUES
 (gen_random_uuid(), '10000000-0000-0000-0000-000000000002', auth.uid(), 'Insp', 2400, '{"tronco":12.5,"cabeza":5,"cresta":8,"barbillas":4,"orejillas":9,"cuello":5,"dorso":6,"alas":3,"pecho":8,"cola":8,"extremidades":5,"plumaje":9}', 0, 'I', 'No apto');
\echo '   10f sin peso (esperado: error de NOT NULL)'
INSERT INTO calificaciones (id, animal_id, inspector_id, inspector_nombre, puntos, total, clase, resultado) VALUES
 (gen_random_uuid(), '10000000-0000-0000-0000-000000000002', auth.uid(), 'Insp', '{"tronco":15,"cabeza":6,"cresta":10,"barbillas":5,"orejillas":10,"cuello":6,"dorso":8,"alas":4,"pecho":10,"cola":10,"extremidades":6,"plumaje":10}', 100, 'EX', 'Apto');
SELECT total, clase, resultado, peso_g, peso_conforme FROM calificaciones ORDER BY created_at, total;
SELECT anilla, seccion FROM animales WHERE anilla = 'E2418000002';
\echo '   10e2 la Dirección Técnica (inspector) inscribe a los fundadores G1 y H1 en el RF'
UPDATE animales SET seccion = 'RF', rega = 'ES030140001234' WHERE anilla IN ('E2420000001', 'E2418000002');
SELECT anilla, seccion FROM animales WHERE anilla IN ('E2420000001', 'E2418000002') ORDER BY anilla;
INSERT INTO animales (id, usuario_id, anilla, sexo, variedad, fecha_nacimiento, padre_id, madre_id, rega) VALUES
 ('10000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-00000000000a', 'E2520000050', 'M', 'blanca', '2025-01-10',
  '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'ES030140001234');
\echo '   10g hijo de fundadores, gallo con 67 puntos -> R pero No apto (gallos >= 70); sigue en RN'
INSERT INTO calificaciones (id, animal_id, inspector_id, inspector_nombre, peso_g, puntos, total, clase, resultado) VALUES
 (gen_random_uuid(), '10000000-0000-0000-0000-000000000005', auth.uid(), 'Insp', 3200, '{"tronco":10,"cabeza":4,"cresta":7,"barbillas":3,"orejillas":7,"cuello":4,"dorso":5,"alas":3,"pecho":7,"cola":7,"extremidades":4,"plumaje":6}', 0, 'I', 'No apto');
\echo '   10h el mismo gallo con 72 puntos -> B / Apto y promoción a RD (padres en RF, REGA, 1 año)'
INSERT INTO calificaciones (id, animal_id, inspector_id, inspector_nombre, peso_g, puntos, total, clase, resultado) VALUES
 (gen_random_uuid(), '10000000-0000-0000-0000-000000000005', auth.uid(), 'Insp', 3200, '{"tronco":11,"cabeza":4,"cresta":7,"barbillas":4,"orejillas":7,"cuello":4,"dorso":6,"alas":3,"pecho":7,"cola":7,"extremidades":4,"plumaje":8}', 0, 'I', 'No apto');
SELECT total, clase, resultado FROM calificaciones WHERE animal_id = '10000000-0000-0000-0000-000000000005' ORDER BY total;
SELECT anilla, seccion FROM animales WHERE anilla = 'E2520000050';
\echo '   10i hija de menos de un año, 82,5 puntos -> Apto pero sigue en RN'
INSERT INTO animales (id, usuario_id, anilla, sexo, variedad, fecha_nacimiento) VALUES
 ('10000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-00000000000a', 'E' || to_char(current_date - 60, 'YY') || '18000099', 'H', 'blanca', current_date - 60);
INSERT INTO calificaciones (id, animal_id, inspector_id, inspector_nombre, peso_g, puntos, total, clase, resultado) VALUES
 (gen_random_uuid(), '10000000-0000-0000-0000-000000000009', auth.uid(), 'Insp', 2300, '{"tronco":12.5,"cabeza":5,"cresta":8,"barbillas":4,"orejillas":9,"cuello":5,"dorso":6,"alas":3,"pecho":8,"cola":8,"extremidades":5,"plumaje":9}', 0, 'I', 'No apto');
SELECT a.seccion, c.total, c.resultado FROM animales a JOIN calificaciones c ON c.animal_id = a.id WHERE a.id = '10000000-0000-0000-0000-000000000009';
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
\echo '   12a2 el criador titular tampoco: la sección no cambia (esperado: RF)'
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
SELECT anilla, seccion, rm_via, rm_motivo, rm_origen FROM animales WHERE anilla = 'E2418000002';
\echo '   12e gallo fundador (RF) sin calificación, por premio: no llega a 85 (esperado: error 23514)'
UPDATE animales SET seccion = 'RM', rm_fecha = current_date, rm_via = 'premio', rm_motivo = 'Campeonato' WHERE anilla = 'E2420000001';
\echo '   12f hija en RD sin calificación suficiente (esperado: error 23514)'
UPDATE animales SET seccion = 'RM', rm_fecha = current_date, rm_via = 'premio', rm_motivo = '' WHERE anilla = 'E2518000030';
RESET ROLE;

SET ROLE authenticated; SET request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
\echo '== 13. Campañas de control de puesta'
\echo '   13a campaña con gallina propia -> OK'
INSERT INTO campanas (id, usuario_id, temporada, ciclo, inicio, dias, gallinas) VALUES
 (gen_random_uuid(), auth.uid(), 2026, 1, '2026-02-02', 15, '["10000000-0000-0000-0000-000000000002"]');
\echo '   13b mismo ciclo y temporada (esperado: error unique)'
INSERT INTO campanas (id, usuario_id, temporada, ciclo, inicio, dias, gallinas) VALUES
 (gen_random_uuid(), auth.uid(), 2026, 1, '2026-03-02', 15, '["10000000-0000-0000-0000-000000000002"]');
\echo '   13c con un gallo (esperado: error 23514)'
INSERT INTO campanas (id, usuario_id, temporada, ciclo, inicio, dias, gallinas) VALUES
 (gen_random_uuid(), auth.uid(), 2026, 2, '2026-04-06', 15, '["10000000-0000-0000-0000-000000000001"]');
RESET ROLE;
SET ROLE authenticated; SET request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
\echo '   13d otro criador no la ve (esperado: 0)'
SELECT count(*) AS campanas_ajenas FROM campanas;
RESET ROLE;

\echo '== 14. Criador de origen inmutable e historial de cambios'
SET ROLE authenticated; SET request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
\echo '   14a la administración cambia el titular de H2 (venta a otro socio): el criador de origen se conserva'
UPDATE animales SET usuario_id = '00000000-0000-0000-0000-00000000000c' WHERE anilla = 'E2518000003';
SELECT anilla, usuario_id = '00000000-0000-0000-0000-00000000000c' AS nuevo_titular, criador_id = '00000000-0000-0000-0000-00000000000a' AS criador_origen FROM animales WHERE anilla = 'E2518000003';
\echo '   14b el historial registra los cambios y solo lo leen inspección y administración'
SELECT operacion, count(*) FROM historial WHERE registro = '10000000-0000-0000-0000-000000000003' GROUP BY operacion ORDER BY operacion;
RESET ROLE;
SET ROLE authenticated; SET request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
SELECT count(*) AS historial_visible_para_criador FROM historial;
RESET ROLE;

\echo '== 15. Reproducción: lotes e incubaciones'
SET ROLE authenticated; SET request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
\echo '   15a lote con gallo y gallina propios -> OK'
INSERT INTO lotes (id, usuario_id, temporada, familia, gallo_id, gallinas, inicio) VALUES
 ('30000000-0000-0000-0000-000000000001', auth.uid(), 2026, 'A', '10000000-0000-0000-0000-000000000001', '["10000000-0000-0000-0000-000000000002"]', '2026-02-01');
\echo '   15b gallina como gallo (esperado: error 23514)'
INSERT INTO lotes (id, usuario_id, temporada, gallo_id, gallinas, inicio) VALUES
 (gen_random_uuid(), auth.uid(), 2026, '10000000-0000-0000-0000-000000000002', '["10000000-0000-0000-0000-000000000002"]', '2026-02-01');
\echo '   15c gallina ya vendida a otro criador (esperado: error 23514)'
INSERT INTO lotes (id, usuario_id, temporada, gallo_id, gallinas, inicio) VALUES
 (gen_random_uuid(), auth.uid(), 2026, '10000000-0000-0000-0000-000000000001', '["10000000-0000-0000-0000-000000000003"]', '2026-02-01');
\echo '   15d incubación coherente -> OK'
INSERT INTO incubaciones (id, usuario_id, entrada, filas) VALUES
 ('40000000-0000-0000-0000-000000000001', auth.uid(), '2026-03-01',
  '[{"madre_id":"10000000-0000-0000-0000-000000000002","padre_id":"10000000-0000-0000-0000-000000000001","puestos":8,"claros":1,"nacidos":6,"pollitos":[]}]');
\echo '   15e más nacidos que huevos fértiles (esperado: error 23514)'
UPDATE incubaciones SET filas = jsonb_set(filas, '{0,nacidos}', '8') WHERE id = '40000000-0000-0000-0000-000000000001';
\echo '   15f pollito que no es hijo de esa gallina (esperado: error 23514)'
UPDATE incubaciones SET filas = jsonb_set(filas, '{0,pollitos}', '["10000000-0000-0000-0000-000000000001"]') WHERE id = '40000000-0000-0000-0000-000000000001';
RESET ROLE;
SET ROLE authenticated; SET request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
\echo '   15g otro criador no ve lotes ni incubaciones ajenos (esperado: 0 0)'
SELECT (SELECT count(*) FROM lotes) AS lotes_ajenos, (SELECT count(*) FROM incubaciones) AS incubaciones_ajenas;
RESET ROLE;

\echo '== 16. Solicitudes de inspección'
SET ROLE authenticated; SET request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
INSERT INTO animales (id, usuario_id, anilla, sexo, variedad, fecha_nacimiento) VALUES
 ('10000000-0000-0000-0000-000000000050', auth.uid(), 'E2518000050', 'H', 'blanca', '2025-01-01');
\echo '   16a solicitud con un ejemplar propio en RN -> OK'
INSERT INTO solicitudes (id, usuario_id, animales, telefono) VALUES
 ('50000000-0000-0000-0000-000000000001', auth.uid(), '["10000000-0000-0000-0000-000000000050"]', '612 345 678');
\echo '   16b segunda solicitud abierta (esperado: error unique)'
INSERT INTO solicitudes (id, usuario_id, animales, telefono) VALUES
 (gen_random_uuid(), auth.uid(), '["10000000-0000-0000-0000-000000000050"]', '612 345 678');
\echo '   16c el criador intenta programarse la visita (esperado: error 42501)'
UPDATE solicitudes SET estado = 'programada', fecha_visita = current_date WHERE id = '50000000-0000-0000-0000-000000000001';
RESET ROLE;
SET ROLE authenticated; SET request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
\echo '   16d otro criador con un ejemplar ajeno (esperado: error 23514) y sin ver la ajena (0)'
INSERT INTO solicitudes (id, usuario_id, animales, telefono) VALUES
 (gen_random_uuid(), auth.uid(), '["10000000-0000-0000-0000-000000000050"]', '612 345 678');
SELECT count(*) AS solicitudes_ajenas FROM solicitudes;
RESET ROLE;
SET ROLE authenticated; SET request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
\echo '   16e el inspector la ve y programa la visita; no puede cambiar los ejemplares'
UPDATE solicitudes SET estado = 'programada', fecha_visita = current_date + 3, respuesta = 'Iré a las 10', animales = '["10000000-0000-0000-0000-000000000001"]' WHERE id = '50000000-0000-0000-0000-000000000001';
SELECT estado, inspector_id = auth.uid() AS inspector, animales = '["10000000-0000-0000-0000-000000000050"]'::jsonb AS ejemplares_intactos FROM solicitudes;
\echo '   16f programada sin fecha (esperado: error check)'
UPDATE solicitudes SET fecha_visita = NULL WHERE id = '50000000-0000-0000-0000-000000000001';
UPDATE solicitudes SET estado = 'realizada' WHERE id = '50000000-0000-0000-0000-000000000001';
\echo '   16g una solicitud realizada no se reabre (esperado: error 23514)'
UPDATE solicitudes SET estado = 'pendiente' WHERE id = '50000000-0000-0000-0000-000000000001';
RESET ROLE;
\echo '   16h sincronización por upsert: el criador anula la suya y el inspector cierra otra'
SET ROLE authenticated; SET request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
INSERT INTO solicitudes (id, usuario_id, animales, telefono) VALUES
 ('50000000-0000-0000-0000-000000000002', auth.uid(), '["10000000-0000-0000-0000-000000000050"]', '612345678');
INSERT INTO solicitudes (id, usuario_id, animales, telefono, estado, respuesta) VALUES
 ('50000000-0000-0000-0000-000000000002', auth.uid(), '["10000000-0000-0000-0000-000000000050"]', '612345678', 'anulada', 'Anulada por el criador')
 ON CONFLICT (id) DO UPDATE SET estado = EXCLUDED.estado, respuesta = EXCLUDED.respuesta;
INSERT INTO solicitudes (id, usuario_id, animales, telefono) VALUES
 ('50000000-0000-0000-0000-000000000003', auth.uid(), '["10000000-0000-0000-0000-000000000050"]', '612345678');
RESET ROLE;
SET ROLE authenticated; SET request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
INSERT INTO solicitudes (id, usuario_id, animales, telefono, estado, fecha_visita) VALUES
 ('50000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-00000000000b', '["10000000-0000-0000-0000-000000000001"]', '612345678', 'programada', current_date + 1)
 ON CONFLICT (id) DO UPDATE SET usuario_id = EXCLUDED.usuario_id, animales = EXCLUDED.animales, estado = EXCLUDED.estado, fecha_visita = EXCLUDED.fecha_visita;
SELECT right(id::text, 1) AS sol, estado, usuario_id = '00000000-0000-0000-0000-00000000000a' AS del_criador, animales = '["10000000-0000-0000-0000-000000000050"]'::jsonb AS intactos FROM solicitudes ORDER BY id;
RESET ROLE;

\echo '== 17. Sincronización incremental: sello del servidor y registro de borrados'
SET ROLE authenticated; SET request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
\echo '   17a el móvil manda una fecha antigua: el servidor pone la suya (sync_ts reciente)'
INSERT INTO huevos (id, animal_id, usuario_id, fecha, peso_g, cascara, created_at) VALUES
 ('60000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000050', auth.uid(), current_date - 30, 61, 'Blanco crema', now() - interval '30 days');
SELECT sync_ts > now() - interval '1 minute' AS sello_del_servidor, created_at < now() - interval '29 days' AS fecha_del_movil FROM huevos WHERE id = '60000000-0000-0000-0000-000000000001';
\echo '   17b una edición renueva el sello'
SELECT sync_ts AS antes FROM animales WHERE id = '10000000-0000-0000-0000-000000000050' \gset
SELECT pg_sleep(0.01);
UPDATE animales SET nombre = 'Lola' WHERE id = '10000000-0000-0000-0000-000000000050';
SELECT sync_ts > :'antes' AS sello_renovado FROM animales WHERE id = '10000000-0000-0000-0000-000000000050';
\echo '   17c borrar un huevo queda anotado para los demás dispositivos'
DELETE FROM huevos WHERE id = '60000000-0000-0000-0000-000000000001';
SELECT tabla, registro = '60000000-0000-0000-0000-000000000001' AS es_el_huevo FROM borrados;
RESET ROLE;
SET ROLE authenticated; SET request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
\echo '   17d otro criador no ve los borrados ajenos (0) y el censo público trae sync_ts'
SELECT count(*) AS borrados_ajenos FROM borrados;
SELECT count(*) > 0 AS con_sync_ts FROM censo_publico WHERE sync_ts IS NOT NULL;
RESET ROLE;
