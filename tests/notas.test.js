import test from 'node:test';
import assert from 'node:assert/strict';
import { reiniciarNotasDe, restaurarNotasDe, evaluados, promedio } from '../src/lib/ramos.js';

const doc = () => ({ id: 'd1', nombre: 'Doc', conceptos: [
  { id: 'a', nombre: 'A', nota: 6.2, notaFecha: 111 },
  { id: 'b', nombre: 'B', nota: null, notaFecha: null },
  { id: 'c', nombre: 'C', nota: 3.4, notaFecha: 222 },
] });

test('reiniciarNotasDe quita todas las notas y cuenta cuántas había', () => {
  const r = reiniciarNotasDe(doc());
  assert.equal(r.n, 2);
  assert.ok(r.doc.conceptos.every((c) => c.nota === null && c.notaFecha === null));
  assert.equal(evaluados([r.doc]), 0);
  assert.equal(promedio([r.doc]), null);
  assert.deepEqual(r.previas, { a: { nota: 6.2, notaFecha: 111 }, c: { nota: 3.4, notaFecha: 222 } });
});

test('no modifica el PDF original (el estado de React no se muta)', () => {
  const original = doc();
  reiniciarNotasDe(original);
  assert.equal(original.conceptos[0].nota, 6.2);
});

test('un PDF sin notas no cambia y cuenta 0', () => {
  const sin = { id: 'x', conceptos: [{ id: 'a', nota: null }, { id: 'b', nota: null }] };
  const r = reiniciarNotasDe(sin);
  assert.equal(r.n, 0);
  assert.deepEqual(r.previas, {});
  assert.deepEqual(r.doc.conceptos, sin.conceptos);
});

test('deshacer devuelve exactamente las mismas notas y fechas', () => {
  const original = doc();
  const r = reiniciarNotasDe(original);
  const vuelta = restaurarNotasDe(r.doc, r.previas);
  assert.deepEqual(vuelta, original);
});

test('deshacer ignora conceptos que se borraron entretanto y respeta los nuevos', () => {
  const r = reiniciarNotasDe(doc());
  const cambiado = { ...r.doc, conceptos: [r.doc.conceptos[0], { id: 'z', nombre: 'Nuevo', nota: null, notaFecha: null }] }; // se quitaron b y c, se agregó z
  const vuelta = restaurarNotasDe(cambiado, r.previas);
  assert.equal(vuelta.conceptos.length, 2);
  assert.equal(vuelta.conceptos[0].nota, 6.2);
  assert.equal(vuelta.conceptos[1].nota, null);
});

test('notas con valor 0 o sin fecha también se reinician y se restauran', () => {
  const d = { id: 'q', conceptos: [{ id: 'a', nota: 1.0 }, { id: 'b', nota: 0 }] };
  const r = reiniciarNotasDe(d);
  assert.equal(r.n, 2);
  assert.deepEqual(restaurarNotasDe(r.doc, r.previas).conceptos.map((c) => c.nota), [1.0, 0]);
});
