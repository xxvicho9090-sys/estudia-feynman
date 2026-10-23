import test from 'node:test';
import assert from 'node:assert/strict';
import { elegirConceptos, nuevoOral, registrarRespuesta, aplicarEvaluacion, pasarConcepto, puntajeConcepto, resultadoOral, normalizarEvaluacion, repreguntasQuedan, conceptoActual, conceptosUsados, saludo, CIERRE } from '../src/lib/oral.js';

const docs = [
  { id: 'd1', nombre: 'Contratos', conceptos: [
    { id: 'c1', nombre: 'Compraventa', referencia: 'Contrato en que una parte da una cosa y la otra la paga.', nota: null },
    { id: 'c2', nombre: 'Mandato', referencia: 'Contrato en que una persona confía la gestión de uno o más negocios a otra.', nota: 6.5 },
    { id: 'c3', nombre: 'Arrendamiento', referencia: 'Contrato en que las partes se obligan recíprocamente, la una a conceder el goce de una cosa.', nota: 3.0 },
  ] },
];
const seq = (...v) => { let i = 0; return () => v[i++ % v.length]; };
const ev = (valoracion, extra = {}) => ({ valoracion, reaccion: 'Bien.', repregunta: '', observacion: '', ...extra });
const nuevo = (estilo = 'riguroso', n = 2) => nuevoOral({ docs, origen: { nombre: 'Contratos', clave: 'd:d1' }, n, estilo, rnd: seq(0.1), ahora: new Date(2026, 9, 20, 10) });

test('elegirConceptos prioriza los no preguntados y los que menos dominas', () => {
  const r = elegirConceptos(docs, 2, new Set(), () => 0.5);
  assert.deepEqual(r.map((c) => c.id).sort(), ['c1', 'c3']); // c2 (nota 6,5) queda al final
  const sinC1 = elegirConceptos(docs, 2, new Set(['c1']), () => 0.5);
  assert.ok(!sinC1.some((c) => c.id === 'c1'));
});

test('el interrogatorio parte con saludo y una pregunta del primer concepto', () => {
  const o = nuevo();
  assert.equal(o.estado, 'en curso');
  const t = conceptoActual(o).turnos;
  assert.equal(t.length, 1);
  assert.equal(t[0].rol, 'profesor');
  assert.ok(t[0].texto.startsWith('Buenos días.'));
  assert.ok(t[0].texto.includes(conceptoActual(o).nombre));
  assert.equal(saludo(15), 'Buenas tardes.');
  assert.equal(saludo(22), 'Buenas noches.');
});

test('sin conceptos no se puede interrogar', () => {
  assert.throws(() => nuevoOral({ docs: [{ id: 'x', nombre: 'x', conceptos: [] }], origen: { nombre: 'x' }, n: 3 }), /No hay conceptos/);
});

test('una respuesta correcta sin repregunta pasa al siguiente concepto', () => {
  let o = nuevo('cordial');
  o = registrarRespuesta(o, 'Es un contrato en que uno entrega una cosa y el otro paga un precio.');
  o = aplicarEvaluacion(o, ev('correcta'), seq(0.1));
  assert.equal(o.actual, 1);
  assert.equal(o.conceptos[0].estado, 'listo');
  assert.equal(o.conceptos[0].puntaje, 1);
  assert.equal(o.conceptos[1].turnos[0].rol, 'profesor');
  assert.ok(o.conceptos[1].turnos[0].texto.includes(o.conceptos[1].nombre));
});

test('una respuesta parcial genera repregunta y se rescata con la segunda', () => {
  let o = nuevo('cordial');
  o = registrarRespuesta(o, 'Se vende algo.');
  o = aplicarEvaluacion(o, ev('parcial', { reaccion: 'Es correcto, pero incompleto.', repregunta: '¿Qué obligación tiene el comprador?', observacion: 'Faltó el pago del precio.' }));
  assert.equal(o.actual, 0);
  const t = conceptoActual(o).turnos;
  assert.equal(t[t.length - 1].rol, 'profesor');
  assert.match(t[t.length - 1].texto, /¿Qué obligación tiene el comprador\?/);
  assert.equal(repreguntasQuedan(o), 0);
  o = registrarRespuesta(o, 'Pagar el precio en dinero.');
  o = aplicarEvaluacion(o, ev('correcta'));
  assert.equal(o.actual, 1);
  assert.equal(o.conceptos[0].puntaje, 0.4 * 0.5 + 0.6 * 1);
});

test('no hace más repreguntas que las permitidas por el estilo', () => {
  let o = nuevo('cordial'); // 1 repregunta
  o = registrarRespuesta(o, 'no sé bien');
  o = aplicarEvaluacion(o, ev('incorrecta', { repregunta: 'Otra vez?' }));
  o = registrarRespuesta(o, 'tampoco');
  o = aplicarEvaluacion(o, ev('incorrecta', { repregunta: 'Y otra más?' })); // ya no quedan: se ignora
  assert.equal(o.actual, 1);
  assert.equal(o.conceptos[0].puntaje, 0);
  const rig = nuevo('riguroso');
  assert.equal(repreguntasQuedan(rig), 2);
});

test('terminar el último concepto cierra el interrogatorio con nota', () => {
  let o = nuevo('cordial');
  o = aplicarEvaluacion(registrarRespuesta(o, 'respuesta completa'), ev('correcta'));
  o = aplicarEvaluacion(registrarRespuesta(o, 'respuesta completa'), ev('correcta'));
  assert.equal(o.estado, 'terminado');
  assert.equal(o.resultado.nota, 7);
  const ult = o.conceptos[1].turnos;
  assert.ok(ult[ult.length - 1].texto.endsWith(CIERRE));
});

test('pasar un concepto cuenta como sin respuesta', () => {
  let o = nuevo('riguroso');
  o = pasarConcepto(o, seq(0.1));
  assert.equal(o.conceptos[0].puntaje, 0);
  assert.equal(o.conceptos[0].turnos.find((t) => t.rol === 'alumno').val, 'sin_respuesta');
  assert.equal(o.actual, 1);
});

test('la nota usa la escala 1–7 con 60 % de exigencia', () => {
  const o = nuevo();
  o.conceptos[0].puntaje = 1; o.conceptos[1].puntaje = 0.2; // 60 %
  assert.equal(resultadoOral(o).nota, 4);
  assert.equal(puntajeConcepto({ turnos: [] }), 0);
});

test('normalizarEvaluacion acepta JSON con ruido y rechaza valoraciones inválidas', () => {
  const r = normalizarEvaluacion('```json\n{"valoracion":"parcial","reaccion":" Bien  encaminado. ","repregunta":"¿Y la tradición?","observacion":""}\n```');
  assert.equal(r.valoracion, 'parcial');
  assert.equal(r.reaccion, 'Bien encaminado.');
  assert.throws(() => normalizarEvaluacion('{"valoracion":"excelente"}'));
});

test('conceptosUsados junta los ids de interrogatorios previos', () => {
  const u = conceptosUsados([nuevo()]);
  assert.equal(u.size, 2);
});
