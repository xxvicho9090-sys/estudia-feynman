import test from 'node:test';
import assert from 'node:assert/strict';
import { elegirVoz, esNatural, frases, paraVoz } from '../src/lib/hablar.js';

const v = (name, lang) => ({ name, lang });

test('elige primero una voz natural, y entre ellas la de Chile', () => {
  const voces = [v('Microsoft Sabina - Spanish (Mexico)', 'es-MX'), v('Microsoft Dalia Online (Natural) - Spanish (Mexico)', 'es-MX'), v('Microsoft Lorenzo Online (Natural) - Spanish (Chile)', 'es-CL'), v('Google US English', 'en-US')];
  assert.equal(elegirVoz(voces).name, 'Microsoft Lorenzo Online (Natural) - Spanish (Chile)');
});

test('sin voces naturales usa la básica más cercana, y sin español devuelve null', () => {
  assert.equal(elegirVoz([v('Microsoft Raul', 'es-MX'), v('Microsoft Helena', 'es-ES')]).name, 'Microsoft Raul');
  assert.equal(elegirVoz([v('Alex', 'en-US')]), null);
  assert.equal(esNatural(v('Microsoft Sabina - Spanish (Mexico)', 'es-MX')), false);
  assert.equal(esNatural(v('Google español de Estados Unidos', 'es-US')), true);
});

test('el texto se limpia para la voz y se parte en frases', () => {
  assert.equal(paraVoz('Pasemos a «Mandato» — con 50% de avance / ahora'), 'Pasemos a Mandato, con 50 por ciento de avance o ahora');
  assert.deepEqual(frases('Buenos días. ¿Qué entiende usted por «Mandato»? Gracias.'), ['Buenos días.', '¿Qué entiende usted por Mandato?', 'Gracias.']);
});
