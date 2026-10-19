import test from 'node:test';
import assert from 'node:assert/strict';
import { promedio, evaluados, totalConceptos, nuevoRamo, COLORES } from '../src/lib/ramos.js';

const doc = (...notas) => ({ conceptos: notas.map((nota) => ({ nota })) });

test('promedio ignora conceptos sin evaluar', () => {
  assert.equal(promedio([doc(6, 4, null), doc(5)]), 5.0);
  assert.equal(promedio([doc(null)]), null);
  assert.equal(promedio([]), null);
  assert.equal(promedio([doc(6.2, 3.4)]), 4.8);
});

test('conteos', () => {
  assert.equal(evaluados([doc(6, null), doc(null, null, 3)]), 2);
  assert.equal(totalConceptos([doc(6, null), doc(null, null, 3)]), 5);
});

test('nuevoRamo asigna colores rotando', () => {
  const r = Array.from({ length: COLORES.length + 1 }, (_, i) => i).reduce((acc, i) => [...acc, nuevoRamo(' Ramo ' + i + ' ', acc)], []);
  assert.equal(r[0].nombre, 'Ramo 0');
  assert.equal(r[0].color, r[COLORES.length].color);
  assert.notEqual(r[0].color, r[1].color);
});
