import test from 'node:test';
import assert from 'node:assert/strict';
import { extraerJson, repararJson } from '../src/lib/grade.js';

test('un JSON cortado a la mitad se rescata con las preguntas completas', () => {
  const cortado = '{"preguntas":[{"enunciado":"¿A?","opciones":["a","b","c","d"],"correcta":1},{"enunciado":"¿B?","opciones":["a","b","c","d"],"correcta":2},{"enunciado":"¿C?","opciones":["a","b';
  const o = extraerJson(cortado);
  assert.equal(o.preguntas.length, 2);
  assert.equal(o.preguntas[1].enunciado, '¿B?');
});

test('un JSON enredado al final conserva lo anterior', () => {
  const enredado = '{"preguntas":[{"enunciado":"¿A?","correcta":0},{"enunciado":"¿B?","correcta":1}  ,  ,, {"enunciado": }';
  const o = extraerJson(enredado);
  assert.equal(o.preguntas.length, 2);
});

test('un JSON bueno no se toca y el basura sigue fallando', () => {
  assert.deepEqual(extraerJson('texto {"a":1} más texto'), { a: 1 });
  assert.throws(() => extraerJson('sin json'));
  assert.equal(repararJson('{"a":'), null);
});
