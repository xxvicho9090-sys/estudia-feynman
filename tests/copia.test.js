import test from 'node:test';
import assert from 'node:assert/strict';
import { armarCopia, leerCopia, planImportar, hayAlgoNuevo, nombreArchivo } from '../src/lib/copia.js';

const ramo = (id, nombre) => ({ id, nombre, creado: 1 });
const doc = (id, nombre, ramoId, n = 2) => ({ id, nombre, ramoId, creado: 2, conceptos: Array.from({ length: n }, (_, i) => ({ id: `${id}-${i}`, nombre: `C${i}`, referencia: 'x', nota: null })) });
const vacio = { docs: [], ramos: [], pruebas: [], orales: [] };

test('la copia sale con su marca y se lee de vuelta', () => {
  const c = armarCopia({ ...vacio, ramos: [ramo('r1', 'Civil')] }, new Date('2026-10-26T10:00:00Z'));
  assert.equal(nombreArchivo(new Date('2026-10-26T10:00:00Z')), 'feynman-copia-2026-10-26.json');
  const l = leerCopia(JSON.stringify(c));
  assert.equal(l.ramos.length, 1);
});

test('rechaza archivos que no son una copia', () => {
  assert.throws(() => leerCopia('esto no es json'), /no se puede leer/);
  assert.throws(() => leerCopia(JSON.stringify({ hola: 1 })), /no es una copia/);
  assert.throws(() => leerCopia(JSON.stringify({ app: 'estudia-con-feynman', version: 99 })), /más nueva/);
});

test('a un dispositivo vacío entra todo', () => {
  const copia = { ramos: [ramo('r1', 'Civil')], docs: [doc('d1', 'Contratos.pdf', 'r1', 3)], pruebas: [{ id: 'p1', origen: { clave: 'd:d1' } }], orales: [{ id: 'o1', origen: { clave: 'r:r1' } }] };
  const plan = planImportar(vacio, copia);
  assert.deepEqual(plan.resumen, { ramos: 1, pdfs: 1, conceptos: 3, pruebas: 1, orales: 1, yaEstaban: 0 });
  assert.equal(hayAlgoNuevo(plan), true);
});

test('lo que ya está no se duplica ni se pisa', () => {
  const actual = { ...vacio, ramos: [ramo('r1', 'Civil')], docs: [doc('d1', 'Contratos.pdf', 'r1')], pruebas: [{ id: 'p1', origen: { clave: 'd:d1' } }] };
  const copia = { ramos: [ramo('r1', 'Civil')], docs: [doc('d1', 'Contratos.pdf', 'r1'), doc('d2', 'Mandato.pdf', 'r1')], pruebas: [{ id: 'p1', origen: { clave: 'd:d1' } }, { id: 'p2', origen: { clave: 'd:d2' } }], orales: [] };
  const plan = planImportar(actual, copia);
  assert.equal(plan.docs.length, 1);
  assert.equal(plan.docs[0].id, 'd2');
  assert.equal(plan.pruebas.length, 1);
  assert.equal(plan.resumen.yaEstaban, 2);
});

test('un ramo con el mismo nombre se une al que ya existe y se reapuntan sus PDFs y pruebas', () => {
  const actual = { ...vacio, ramos: [ramo('t1', 'derecho civil')] };
  const copia = { ramos: [ramo('r9', 'Derecho Civil')], docs: [doc('d1', 'Contratos.pdf', 'r9')], pruebas: [{ id: 'p1', origen: { clave: 'r:r9', nombre: 'Derecho Civil' } }], orales: [{ id: 'o1', origen: { clave: 'd:d1' } }] };
  const plan = planImportar(actual, copia);
  assert.equal(plan.ramos.length, 0);
  assert.equal(plan.docs[0].ramoId, 't1');
  assert.equal(plan.pruebas[0].origen.clave, 'r:t1');
  assert.equal(plan.orales[0].origen.clave, 'd:d1');
});

test('el mismo PDF subido en ambos dispositivos cuenta como repetido y reapunta lo que lo usaba', () => {
  const actual = { ...vacio, ramos: [ramo('t1', 'Civil')], docs: [doc('dt', 'Contratos.pdf', 't1')] };
  const copia = { ramos: [ramo('t1', 'Civil')], docs: [doc('dl', 'contratos.pdf', 't1')], pruebas: [{ id: 'p1', origen: { clave: 'd:dl' } }], orales: [] };
  const plan = planImportar(actual, copia);
  assert.equal(plan.docs.length, 0);
  assert.equal(plan.pruebas[0].origen.clave, 'd:dt');
  assert.equal(plan.resumen.yaEstaban, 1);
});

test('si todo ya estaba, no hay nada nuevo', () => {
  const actual = { ...vacio, ramos: [ramo('r1', 'Civil')], docs: [doc('d1', 'A.pdf', 'r1')] };
  assert.equal(hayAlgoNuevo(planImportar(actual, { ramos: [ramo('r1', 'Civil')], docs: [doc('d1', 'A.pdf', 'r1')], pruebas: [], orales: [] })), false);
});
