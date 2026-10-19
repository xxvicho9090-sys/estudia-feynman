import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizarPreguntas, calcularPrueba, puntosDe, presetPlan, planValido, totalPlan, armarMaterial, contestadas, PUNTOS } from '../src/lib/quiz.js';

const sinAzar = () => 0; // barajado determinista

test('alternativas: valida y conserva cuál es la correcta tras barajar', () => {
  const crudo = { preguntas: [
    { enunciado: '¿Qué es el capital social?', opciones: ['A', 'B', 'C', 'D'], correcta: 2, explicacion: 'x' },
    { enunciado: 'corta', opciones: ['A', 'B', 'C'], correcta: 0 },                       // enunciado muy corto
    { enunciado: 'Pregunta con opciones repetidas', opciones: ['A', 'a', 'C'], correcta: 0 }, // duplicadas
    { enunciado: 'Pregunta con correcta fuera de rango', opciones: ['A', 'B', 'C'], correcta: 7 },
    { enunciado: 'Pregunta con pocas opciones', opciones: ['A', 'B'], correcta: 0 },
  ] };
  const r = normalizarPreguntas('alternativas', crudo, { rnd: sinAzar });
  assert.equal(r.length, 1);
  assert.equal(r[0].opciones[r[0].correcta], 'C'); // la correcta sigue siendo "C"
  assert.equal(new Set(r[0].opciones).size, 4);
});

test('alternativas: el barajado mueve la correcta pero no la pierde (varios azares)', () => {
  for (let k = 0; k < 20; k++) {
    let s = k + 1; const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    const r = normalizarPreguntas('alternativas', { preguntas: [{ enunciado: 'Pregunta de prueba larga', opciones: ['uno', 'dos', 'tres', 'cuatro'], correcta: 1 }] }, { rnd });
    assert.equal(r[0].opciones[r[0].correcta], 'dos');
  }
});

test('vf: acepta booleanos y textos; descarta ambiguos', () => {
  const r = normalizarPreguntas('vf', { preguntas: [
    { enunciado: 'La sociedad anónima es persona jurídica.', correcta: true },
    { enunciado: 'El capital social varía con las utilidades.', correcta: 'Falso' },
    { enunciado: 'Afirmación sin respuesta clara aquí.', correcta: 'quizás' },
  ] });
  assert.deepEqual(r.map((q) => q.correcta), [true, false]);
});

test('desarrollo: exige pauta con al menos 2 ideas (lista o texto)', () => {
  const r = normalizarPreguntas('desarrollo', { preguntas: [
    { enunciado: 'Explique los requisitos de la sociedad.', pauta: ['Consentimiento', 'Objeto lícito', 'Capital'] },
    { enunciado: 'Explique la disolución de la sociedad.', pauta: 'Causales legales; Acuerdo de socios' },
    { enunciado: 'Explique algo sin pauta suficiente.', pauta: ['una sola'] },
  ] });
  assert.equal(r.length, 2);
  assert.deepEqual(r[1].pauta, ['Causales legales', 'Acuerdo de socios']);
});

test('respuesta basura de la IA no revienta', () => {
  assert.deepEqual(normalizarPreguntas('vf', null), []);
  assert.deepEqual(normalizarPreguntas('alternativas', { preguntas: 'nada' }), []);
});

test('puntos: alternativas, vf y desarrollo', () => {
  assert.deepEqual(puntosDe({ tipo: 'alternativas', correcta: 1 }, 1), { puntos: 1, max: 1 });
  assert.deepEqual(puntosDe({ tipo: 'alternativas', correcta: 0 }, undefined), { puntos: 0, max: 1 }); // sin responder
  assert.deepEqual(puntosDe({ tipo: 'vf', correcta: false }, false), { puntos: 1, max: 1 });
  assert.deepEqual(puntosDe({ tipo: 'vf', correcta: false }, true), { puntos: 0, max: 1 });
  assert.deepEqual(puntosDe({ tipo: 'desarrollo' }, '   '), { puntos: 0, max: 3 });          // vacío: 0 sin gastar IA
  assert.equal(puntosDe({ tipo: 'desarrollo' }, 'respuesta', null), null);                     // pendiente de corregir
  const ev = { ideas: [{ estado: 'bien' }, { estado: 'bien' }, { estado: 'falta' }, { estado: 'falta' }] };  // 50 %
  assert.deepEqual(puntosDe({ tipo: 'desarrollo' }, 'respuesta', ev), { puntos: 1.5, max: 3 });
});

test('calcularPrueba: nota 1-7 con exigencia 60 %', () => {
  const preguntas = [
    ...Array.from({ length: 6 }, (_, i) => ({ id: 'a' + i, tipo: 'alternativas', correcta: 0 })),
    ...Array.from({ length: 4 }, (_, i) => ({ id: 'v' + i, tipo: 'vf', correcta: true })),
  ];
  const resp = Object.fromEntries([...preguntas.slice(0, 6).map((p) => [p.id, 0]), ...preguntas.slice(6).map((p) => [p.id, false])]);
  const r = calcularPrueba({ preguntas, respuestas: resp, evaluaciones: {} });
  assert.equal(r.puntos, 6); assert.equal(r.total, 10); assert.equal(r.nota, 4.0); // 60 % exacto
  assert.equal(r.porTipo.alternativas.buenas, 6);
  const perfecta = calcularPrueba({ preguntas, respuestas: Object.fromEntries(preguntas.map((p) => [p.id, p.correcta])), evaluaciones: {} });
  assert.equal(perfecta.nota, 7.0);
  const vacia = calcularPrueba({ preguntas, respuestas: {}, evaluaciones: {} });
  assert.equal(vacia.nota, 1.0);
});

test('calcularPrueba: con desarrollo sin corregir no hay nota; al corregir se suma', () => {
  const preguntas = [{ id: 'a', tipo: 'alternativas', correcta: 0 }, { id: 'd', tipo: 'desarrollo' }];
  const base = { preguntas, respuestas: { a: 0, d: 'mi respuesta' } };
  const pend = calcularPrueba({ ...base, evaluaciones: {} });
  assert.equal(pend.nota, null); assert.equal(pend.pendientes, 1);
  const ok = calcularPrueba({ ...base, evaluaciones: { d: { ideas: [{ estado: 'bien' }, { estado: 'bien' }] } } });
  assert.equal(ok.total, PUNTOS.alternativas + PUNTOS.desarrollo);
  assert.equal(ok.nota, 7.0);
});

test('planes', () => {
  assert.deepEqual(presetPlan('vf', 8), { alternativas: 0, vf: 8, desarrollo: 0, casos: 0, porCaso: 3 });
  const m = presetPlan('mixto', 10);
  assert.equal(totalPlan(m), 10); assert.ok(m.alternativas > 0 && m.vf > 0 && m.desarrollo > 0);
  assert.equal(planValido({ alternativas: 0, vf: 0, desarrollo: 0 }), false);
  assert.equal(planValido({ alternativas: 20, vf: 10, desarrollo: 0 }), false); // más de 25
  assert.equal(planValido({ alternativas: 5, vf: 0, desarrollo: 1 }), true);
});

test('armarMaterial respeta el límite y cuenta conceptos', () => {
  const docs = [{ nombre: 'd', conceptos: Array.from({ length: 30 }, (_, i) => ({ nombre: 'c' + i, referencia: 'x'.repeat(500) })) }];
  const m = armarMaterial(docs, 3000, sinAzar);
  assert.ok(m.texto.length <= 3000 + 100);
  assert.equal(m.total, 30);
  assert.ok(m.conceptos >= 4 && m.conceptos < 30);
});

test('contestadas', () => {
  const preguntas = [{ id: 'a', tipo: 'alternativas' }, { id: 'v', tipo: 'vf' }, { id: 'd', tipo: 'desarrollo' }];
  assert.equal(contestadas({ preguntas, respuestas: { a: 0, v: false, d: '  ' } }), 2);
});

import { paginar } from '../src/lib/quiz.js';

test('paginar: numera de corrido, no pierde preguntas y marca el inicio de cada sección', () => {
  const qs = [
    ...Array.from({ length: 10 }, (_, i) => ({ id: 'a' + i, tipo: 'alternativas', enunciado: 'x'.repeat(50), opciones: ['a', 'b', 'c', 'd'] })),
    ...Array.from({ length: 6 }, (_, i) => ({ id: 'v' + i, tipo: 'vf', enunciado: 'afirmación' })),
    ...Array.from({ length: 3 }, (_, i) => ({ id: 'd' + i, tipo: 'desarrollo', enunciado: 'explique', pauta: ['a', 'b'] })),
  ];
  const pags = paginar(qs);
  const todas = pags.flatMap((p) => p.preguntas);
  assert.equal(todas.length, 19);
  assert.deepEqual(todas.map((x) => x.n), Array.from({ length: 19 }, (_, i) => i + 1));
  assert.deepEqual(todas.filter((x) => x.seccion).map((x) => x.seccion), ['alternativas', 'vf', 'desarrollo']);
  assert.ok(pags.length >= 3 && pags.length <= 6);
  assert.ok(pags[0].preguntas.length < pags[1].preguntas.length || pags.length === 1); // la primera hoja lleva menos (encabezado)
  assert.deepEqual(paginar([]), []);
});
