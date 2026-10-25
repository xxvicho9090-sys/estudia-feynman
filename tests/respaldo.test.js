import test from 'node:test';
import assert from 'node:assert/strict';
import { conRespaldo, errorGramatica, modeloPerdido } from '../src/lib/local.js';

const gram = () => new Error('Error: Grammar matcher rejected the newly sampled token.');
const perdido = () => new Error('ModelNotLoadedError: Model not loaded before trying to complete ChatCompletionRequest');

test('reconoce los dos errores de la IA offline', () => {
  assert.equal(errorGramatica(gram()), true);
  assert.equal(modeloPerdido(perdido()), true);
  assert.equal(errorGramatica(new Error('otra cosa')), false);
});

test('si falla la gramática sigue sin esquema y lo recuerda', async () => {
  const llamadas = [];
  let marcado = false;
  const r = await conRespaldo(async (sinEsquema) => { llamadas.push(sinEsquema); if (!sinEsquema) throw gram(); return 'ok'; }, { marcarSinEsquema: () => { marcado = true; } });
  assert.equal(r, 'ok');
  assert.deepEqual(llamadas, [false, true]);
  assert.equal(marcado, true);
});

test('si ya se sabe que ese dispositivo falla con esquema, parte sin esquema', async () => {
  const llamadas = [];
  await conRespaldo(async (s) => { llamadas.push(s); return 'ok'; }, { sinEsquemaInicial: true });
  assert.deepEqual(llamadas, [true]);
});

test('si la GPU perdió el modelo recarga el motor una vez y reintenta', async () => {
  let recargas = 0, n = 0;
  const r = await conRespaldo(async () => { n += 1; if (n === 1) throw perdido(); return 'ok'; }, { reiniciar: () => { recargas += 1; } });
  assert.equal(r, 'ok');
  assert.equal(recargas, 1);
});

test('puede encadenar los dos remedios, pero no insiste sin fin', async () => {
  let n = 0;
  const r = await conRespaldo(async (s) => { n += 1; if (n === 1) throw gram(); if (n === 2) throw perdido(); return s ? 'ok' : 'mal'; });
  assert.equal(r, 'ok');
  await assert.rejects(conRespaldo(async () => { throw perdido(); }), /Model not loaded/);
  await assert.rejects(conRespaldo(async () => { throw new Error('fallo raro'); }), /fallo raro/);
});

test('un aborto no se reintenta', async () => {
  const ac = new AbortController(); ac.abort();
  let n = 0;
  await assert.rejects(conRespaldo(async () => { n += 1; const e = new Error('x'); e.name = 'AbortError'; throw e; }, { signal: ac.signal }));
  assert.equal(n, 1);
});
