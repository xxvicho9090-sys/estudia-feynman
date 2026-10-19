import test from 'node:test';
import assert from 'node:assert/strict';
import { TIPO_DOC, empezarArrastre, hayArrastreDoc, leerArrastre, docsAMover, textoMovido } from '../src/lib/mover.js';

const docs = [{ id: 'a', ramoId: 'r1' }, { id: 'b', ramoId: 'r1' }, { id: 'c', ramoId: 'r2' }];

test('docsAMover: solo los que cambian de ramo', () => {
  assert.deepEqual(docsAMover(docs, ['a', 'b', 'c'], 'r2').map((d) => d.id), ['a', 'b']);
  assert.deepEqual(docsAMover(docs, ['c'], 'r2'), []); // ya estaba ahí
  assert.deepEqual(docsAMover(docs, ['zzz'], 'r1'), []); // id que no existe
  assert.deepEqual(docsAMover(docs, [], 'r1'), []);
});

test('textos', () => {
  assert.equal(textoMovido(1, 'Contratos'), '1 PDF movido a Contratos');
  assert.equal(textoMovido(3, 'Contratos'), '3 PDFs movidos a Contratos');
});

test('arrastre: lo que se guarda al empezar se puede leer al soltar', () => {
  const guardado = new Map();
  const dt = { setData: (t, v) => guardado.set(t, v), getData: (t) => guardado.get(t) ?? '', get types() { return [...guardado.keys()]; } };
  empezarArrastre({ dataTransfer: dt }, ['a', 'b']);
  assert.equal(dt.effectAllowed, 'move');
  assert.equal(hayArrastreDoc({ dataTransfer: dt }), true);
  assert.deepEqual(leerArrastre({ dataTransfer: dt }), ['a', 'b']);
});

test('arrastrar archivos del escritorio o texto NO se confunde con arrastrar un PDF de la app', () => {
  assert.equal(hayArrastreDoc({ dataTransfer: { types: ['Files'] } }), false);
  assert.equal(hayArrastreDoc({ dataTransfer: { types: ['text/plain'] } }), false);
  assert.equal(hayArrastreDoc({ dataTransfer: undefined }), false);
  assert.ok(TIPO_DOC.startsWith('application/'));
});

test('leerArrastre tolera datos rotos', () => {
  const dt = (v) => ({ dataTransfer: { getData: () => v } });
  assert.deepEqual(leerArrastre(dt('no es json')), []);
  assert.deepEqual(leerArrastre(dt('{"a":1}')), []);
  assert.deepEqual(leerArrastre(dt('["a", 5, null, "b"]')), ['a', 'b']);
});
