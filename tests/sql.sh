#!/usr/bin/env bash
# Pruebas del esquema en PostgreSQL 16: carga dos veces (se puede volver a ejecutar sin
# problemas) y compara la salida de tests/schema.test.sql con la salida revisada
# tests/schema.test.esperado.txt.
# Uso: PGHOST=... PGPORT=... PGUSER=postgres [PGPASSWORD=...] bash tests/sql.sh
# Si un cambio altera la salida a propósito: revisarla y copiarla en el archivo esperado.
set -euo pipefail
cd "$(dirname "$0")/.."
BD=alacantinapp_pruebas
psql -q -d postgres -c "DROP DATABASE IF EXISTS $BD" -c "CREATE DATABASE $BD"
cargar() { if ! psql -q -d "$BD" -v ON_ERROR_STOP=1 "$@" > /tmp/schema.carga.txt 2>&1; then grep -v NOTICE /tmp/schema.carga.txt; echo "✗ El esquema no se carga"; exit 1; fi; }
cargar -f tests/supabase_stub.sql -f supabase/schema.sql
cargar -f supabase/schema.sql
echo "✓ El esquema se carga dos veces sin errores"
psql -q -d "$BD" -f tests/schema.test.sql > /tmp/schema.test.salida.txt 2>&1 || true
if diff -u tests/schema.test.esperado.txt /tmp/schema.test.salida.txt; then
  echo "✓ Salida de las pruebas SQL igual a la revisada ($(grep -c 'ERROR' tests/schema.test.esperado.txt) rechazos esperados)"
  echo; echo "TODO CORRECTO"
else
  echo "✗ La salida de las pruebas SQL ha cambiado (arriba, las diferencias)"; exit 1
fi
