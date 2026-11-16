// Pruebas unitarias: node tests/genetica.test.mjs
import assert from 'node:assert/strict';
import { fxDescendencia, ordenTopologico, neDemografico, familiaGalloGobe, generacionesEquivalentes, indice, creaCiclo, ancestrosComunes } from '../js/genetica.js';
import { evaluarCalificacion, claseDe, puntoValido, BAREMO, huevoApto, pesoConforme, tramoEdad, ESTANDAR } from '../js/estandar.js';

let ok = 0;
const t = (nombre, fn) => { fn(); ok++; console.log('✓', nombre); };
const A = (id, padre_id = null, madre_id = null, extra = {}) => ({ id, padre_id, madre_id, ...extra });
const cerca = (a, b) => assert.ok(Math.abs(a - b) < 1e-12, `${a} ≠ ${b}`);

t('Fx hermanos completos = 0,25', () => cerca(fxDescendencia('X1', 'X2', [A('S'), A('D'), A('X1', 'S', 'D'), A('X2', 'S', 'D')]), 0.25));
t('Fx medio hermanos = 0,125', () => cerca(fxDescendencia('X1', 'X2', [A('S'), A('D1'), A('D2'), A('X1', 'S', 'D1'), A('X2', 'S', 'D2')]), 0.125));
t('Fx padre × hija = 0,25', () => cerca(fxDescendencia('S', 'H', [A('S'), A('D'), A('H', 'S', 'D')]), 0.25));
t('Fx primos hermanos = 0,0625', () => cerca(fxDescendencia('C1', 'C2', [A('S'), A('D'), A('B1', 'S', 'D'), A('B2', 'S', 'D'), A('E1'), A('E2'), A('C1', 'B1', 'E1'), A('C2', 'B2', 'E2')]), 0.0625));
t('Fx 2 generaciones de hermanos = 0,375', () => cerca(fxDescendencia('Y1', 'Y2', [A('S'), A('D'), A('X1', 'S', 'D'), A('X2', 'S', 'D'), A('Y1', 'X1', 'X2'), A('Y2', 'X1', 'X2')]), 0.375));
t('Fx con ancestro común consanguíneo (FA = 0,25) = 0,15625', () => cerca(fxDescendencia('X1', 'X2', [A('a'), A('b'), A('s1', 'a', 'b'), A('s2', 'a', 'b'), A('S', 's1', 's2'), A('D1'), A('D2'), A('X1', 'S', 'D1'), A('X2', 'S', 'D2')]), 0.15625));
t('Truncado a 5 generaciones', () => {
  const c = [A('Z')];
  let p = 'Z', m = 'Z';
  for (let i = 0; i < 4; i++) { c.push(A(`p${i}`, p, `fp${i}`), A(`fp${i}`), A(`m${i}`, m, `fm${i}`), A(`fm${i}`)); p = `p${i}`; m = `m${i}`; }
  c.push(A('P', p, 'x'), A('x'), A('M', m, 'y'), A('y'));
  cerca(fxDescendencia('P', 'M', c), 0);
  cerca(fxDescendencia('P', 'M', c, 10), 0.5 ** 11);
});
t('Padre = madre o datos vacíos → 0', () => { assert.equal(fxDescendencia('a', 'a', []), 0); assert.equal(fxDescendencia(null, 'b', []), 0); });
t('Ciclo de datos no bloquea', () => { fxDescendencia('A1', 'C1', [A('A1', 'B1', 'C1'), A('B1', 'A1', 'C1'), A('C1')]); });
t('Detección de ciclo genealógico', () => {
  const idx = indice([A('abuelo'), A('padre', 'abuelo'), A('hijo', 'padre')]);
  assert.equal(creaCiclo('abuelo', 'hijo', null, idx), true);
  assert.equal(creaCiclo('nuevo', 'padre', null, idx), false);
});
t('Ancestros comunes', () => {
  const idx = indice([A('S'), A('D'), A('X1', 'S', 'D'), A('X2', 'S', 'D')]);
  assert.deepEqual(ancestrosComunes('X1', 'X2', idx).sort(), ['D', 'S']);
});
t('Orden topológico: progenitores antes', () => {
  const ord = ordenTopologico([A('hijo', 'pa', 'ma'), A('pa', 'ab'), A('ma'), A('ab')]).map(a => a.id);
  assert.ok(ord.indexOf('ab') < ord.indexOf('pa') && ord.indexOf('pa') < ord.indexOf('hijo') && ord.indexOf('ma') < ord.indexOf('hijo'));
});
t('Ne demográfico', () => { assert.equal(neDemografico(5, 20), 16); assert.equal(neDemografico(0, 10), 0); });
t('Generaciones equivalentes (padres y abuelos completos = 2)', () => {
  const idx = indice([A('a'), A('b'), A('c'), A('d'), A('P', 'a', 'b'), A('M', 'c', 'd'), A('X', 'P', 'M')]);
  cerca(generacionesEquivalentes('X', idx), 2);
});
t('Gobe circular A→B→C→D→E→A', () => {
  assert.equal(familiaGalloGobe('B'), 'A');
  assert.equal(familiaGalloGobe('A'), 'E');
  assert.equal(familiaGalloGobe('Z'), null);
});
t('Estándar: 3 variedades oficiales + 2 en proceso', () => {
  assert.deepEqual(ESTANDAR.variedades.filter(v => v.oficial).map(v => v.nombre), ['Negra moteada', 'Pinta o exchequer', 'Blanca']);
  assert.equal(ESTANDAR.variedades.filter(v => !v.oficial).length, 2);
  assert.equal(ESTANDAR.regiones.length, 12);
  assert.equal(ESTANDAR.defectosGraves.length, 5);
});
t('Huevo apto: 55–70 g y blanco crema', () => {
  assert.equal(huevoApto(55, 'Blanco crema'), true);
  assert.equal(huevoApto(70, 'Blanco crema'), true);
  assert.equal(huevoApto(54.9, 'Blanco crema'), false);
  assert.equal(huevoApto(62, 'Tostada'), false);
});
t('Peso conforme', () => {
  assert.equal(pesoConforme('M', 3200), true);
  assert.equal(pesoConforme('H', 2700), false);
  assert.equal(pesoConforme('H', ''), null);
});
t('Tramos de edad', () => {
  const hoy = new Date('2026-11-16T12:00:00');
  assert.equal(tramoEdad('2026-07-01', hoy).id, 'pollito');
  assert.equal(tramoEdad('2026-01-10', hoy).id, 'joven');
  assert.equal(tramoEdad('2024-05-01', hoy).id, 'adulto');
});
t('Baremo: 13 apartados que suman 100; clases EX/MB/B/R/I en sus límites', () => {
  assert.equal(BAREMO.apartados.length, 13);
  assert.equal(BAREMO.apartados.reduce((x, y) => x + y.max, 0), 100);
  assert.deepEqual([100, 90, 89.5, 80, 79.5, 70, 69.5, 65, 64.5, 0].map(n => claseDe(n).id),
    ['EX', 'EX', 'MB', 'MB', 'B', 'B', 'R', 'R', 'I', 'I']);
});

t('Baremo: validación de puntos (rango, pasos de 0,5, coma decimal)', () => {
  assert.equal(puntoValido('7,5', 10), 7.5);
  assert.equal(puntoValido(0, 3), 0);
  assert.equal(puntoValido(10.5, 10), null);
  assert.equal(puntoValido(-1, 10), null);
  assert.equal(puntoValido(7.3, 10), null);
  assert.equal(puntoValido('', 10), null);
});

t('Calificación: total, clase, descalificación y acceso a RD', () => {
  const max = Object.fromEntries(BAREMO.apartados.map(x => [x.id, x.max]));
  const e1 = evaluarCalificacion({ sexo: 'M', variedad: 'negra-moteada', pesoG: 3200, puntos: max });
  assert.equal(e1.total, 100); assert.equal(e1.clase, 'EX'); assert.equal(e1.resultado, 'Apto'); assert.equal(e1.accedeRD, true);
  const e2 = evaluarCalificacion({ sexo: 'M', variedad: 'negra-moteada', puntos: max, defectos: ['flameado'] });
  assert.equal(e2.clase, 'D'); assert.equal(e2.resultado, 'No apto');
  // El flameado no descalifica en la Blanca
  assert.equal(evaluarCalificacion({ sexo: 'M', variedad: 'blanca', puntos: max, defectos: ['flameado'] }).clase, 'EX');
  // 64,5 puntos -> I, No apto
  const bajo = { ...max, plumaje: 0, tipo: 0, cresta: 10 - 0.5, orejillas: 0 }; // 100-15-10-0,5-10 = 64,5
  const e3 = evaluarCalificacion({ sexo: 'H', variedad: 'blanca', puntos: bajo });
  assert.equal(e3.total, 64.5); assert.equal(e3.clase, 'I'); assert.equal(e3.resultado, 'No apto');
  // Variedad en proceso: Apto pero sin RD
  const e4 = evaluarCalificacion({ sexo: 'H', variedad: 'milflores', puntos: max });
  assert.equal(e4.resultado, 'Apto'); assert.equal(e4.accedeRD, false);
  // Incompleta o fuera de rango
  assert.equal(evaluarCalificacion({ sexo: 'H', variedad: 'blanca', puntos: { tipo: 5 } }).completa, false);
  const e5 = evaluarCalificacion({ sexo: 'H', variedad: 'blanca', puntos: { ...max, ojos: 4 } });
  assert.deepEqual(e5.invalidos, ['ojos']); assert.equal(e5.resultado, 'No apto');
});
console.log(`\n${ok} pruebas superadas`);
