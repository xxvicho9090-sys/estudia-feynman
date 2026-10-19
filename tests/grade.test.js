import test from 'node:test';
import assert from 'node:assert/strict';
import { notaDePuntaje, puntajeDeIdeas, notaDeIdeas, parseEvaluacion, mensajeNota, formatoNota } from '../src/lib/grade.js';

test('escala chilena 60 %', () => {
  assert.equal(notaDePuntaje(0), 1.0);
  assert.equal(notaDePuntaje(60), 4.0);
  assert.equal(notaDePuntaje(100), 7.0);
  assert.equal(notaDePuntaje(30), 2.5);
  assert.equal(notaDePuntaje(80), 5.5);
  assert.equal(notaDePuntaje(-5), 1.0);
  assert.equal(notaDePuntaje(500), 7.0);
});

test('puntaje por ideas', () => {
  const i = (estado) => ({ idea: 'x', estado });
  assert.equal(puntajeDeIdeas([i('bien'), i('bien'), i('bien'), i('bien')]), 100);
  assert.equal(puntajeDeIdeas([i('bien'), i('parcial'), i('falta'), i('falta')]), 37.5);
  assert.equal(puntajeDeIdeas([i('incorrecto')]), 0); // no baja de 0
  assert.equal(puntajeDeIdeas([]), 0);
  assert.equal(notaDeIdeas([i('bien'), i('bien'), i('bien'), i('falta'), i('falta')]), 4.0); // 3/5 = 60 %
});

test('formato y mensajes', () => {
  assert.equal(formatoNota(5.3), '5,3');
  assert.equal(formatoNota(7), '7,0');
  assert.match(mensajeNota(6.8), /Excelente/);
  assert.match(mensajeNota(2.0), /Falta bastante/);
});

test('parseEvaluacion acepta JSON con cercas y ruido', () => {
  const raw = 'Aquí va:\n```json\n{"ideas":[{"idea":"A","estado":"bien","comentario":"ok"},{"idea":"B","estado":"incorrecto","dijiste":"no","comentario":"c"},{"idea":"C","estado":"raro"},{"idea":"","estado":"bien"}],"resumen":"r"}\n```';
  const r = parseEvaluacion(raw);
  assert.equal(r.ideas.length, 2); // descarta estado inválido e idea vacía
  assert.equal(r.ideas[1].dijiste, 'no');
  assert.equal(r.resumen, 'r');
});

test('parseEvaluacion falla con respuesta inválida', () => {
  assert.throws(() => parseEvaluacion('sin json'));
  assert.throws(() => parseEvaluacion('{"ideas":[]}'));
  assert.throws(() => parseEvaluacion({ ideas: [{ idea: 'x', estado: 'nada' }] }));
});
