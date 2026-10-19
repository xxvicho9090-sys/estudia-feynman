import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_CONCEPTOS, maxPorTrozo, limitarConceptos, repartirTrozos, unirConceptos } from '../src/lib/concepts.js';

const lista = (n, largo = (i) => 100 + i) => Array.from({ length: n }, (_, i) => ({ nombre: 'c' + i, referencia: 'x'.repeat(largo(i)) }));

test('el tope es 26', () => assert.equal(MAX_CONCEPTOS, 26));

test('96 conceptos quedan en 26, sin pasarse nunca', () => {
  const r = limitarConceptos(lista(96));
  assert.equal(r.length, 26);
  assert.equal(limitarConceptos(lista(26)).length, 26);
  assert.equal(limitarConceptos(lista(10)).length, 10);
  assert.equal(limitarConceptos(lista(1000)).length, 26);
  assert.deepEqual(limitarConceptos([]), []);
});

test('se quedan los más sustanciosos y se respeta el orden del PDF', () => {
  const conceptos = lista(40, (i) => (i % 2 === 0 ? 500 : 50)); // los pares tienen más contenido
  const r = limitarConceptos(conceptos, 10);
  assert.equal(r.length, 10);
  assert.ok(r.every((c) => c.referencia.length === 500));
  const idx = r.map((c) => Number(c.nombre.slice(1)));
  assert.deepEqual(idx, [...idx].sort((a, b) => a - b)); // mismo orden que en el documento
});

test('desempate estable: con el mismo largo gana el que aparece primero', () => {
  const r = limitarConceptos(lista(30, () => 100), 5);
  assert.deepEqual(r.map((c) => c.nombre), ['c0', 'c1', 'c2', 'c3', 'c4']);
});

test('maxPorTrozo: pocos trozos piden más, muchos piden pocos, nunca menos de 2 ni más de 12', () => {
  assert.equal(maxPorTrozo(1), 12);
  assert.equal(maxPorTrozo(3), 12);
  assert.equal(maxPorTrozo(4), 10);
  assert.equal(maxPorTrozo(12), 4);
  assert.equal(maxPorTrozo(100), 2);
  assert.ok(maxPorTrozo(12) * 12 >= 26); // alcanza para llenar el tope
});

test('repartirTrozos: PDF largo → máximo 12 trozos repartidos de punta a punta', () => {
  const t = Array.from({ length: 100 }, (_, i) => 'trozo' + i);
  const r = repartirTrozos(t);
  assert.equal(r.length, 12);
  assert.equal(r[0], 'trozo0');
  assert.equal(r.at(-1), 'trozo99');
  assert.equal(new Set(r).size, 12);
  assert.deepEqual(repartirTrozos(['a', 'b']), ['a', 'b']);
});

test('flujo completo: 96 conceptos con repetidos → unir → tope 26', () => {
  const crudo = [...lista(60), ...lista(36).map((c) => ({ ...c, nombre: 'C' + c.nombre.slice(1) }))]; // 36 repetidos con otra mayúscula
  const unidos = unirConceptos(crudo);
  assert.equal(unidos.length, 60);
  assert.equal(limitarConceptos(unidos).length, 26);
});
