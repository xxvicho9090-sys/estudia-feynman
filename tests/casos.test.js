import test from 'node:test';
import assert from 'node:assert/strict';

const mem = new Map();
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
let llamadas = [];
let responder = async () => new Response('{}', { status: 500 });
globalThis.fetch = async (url, init) => { llamadas.push({ url: String(url), body: init?.body ? JSON.parse(init.body) : null }); return responder(String(url), init); };

const q = await import('../src/lib/quiz.js');
const { crearPrueba } = await import('../src/lib/pruebas.js');
const { corregirDesarrollo } = await import('../src/lib/groq.js');
const ai = await import('../src/lib/ai.js');

const HECHOS = 'Don Pedro Soto celebró el 3 de marzo un contrato de compraventa con la sociedad Inversiones Alfa Limitada por un inmueble avaluado en cuarenta millones de pesos, pagando un anticipo y quedando el saldo para la escritura definitiva.';
let n = 0;
const id = () => 'id' + ++n;

test('plan con casos: cuenta casos × preguntas por caso y valida límites', () => {
  assert.equal(q.totalPlan({ alternativas: 2, vf: 0, desarrollo: 1, casos: 2, porCaso: 3 }), 9);
  assert.equal(q.totalPlan({ alternativas: 0, vf: 0, desarrollo: 0, casos: 2 }), 6); // sin porCaso usa 3
  assert.equal(q.totalPlan({ alternativas: 3, vf: 0, desarrollo: 0, casos: 0, porCaso: 5 }), 3); // sin casos, porCaso no suma
  assert.equal(q.planValido({ alternativas: 0, vf: 0, desarrollo: 0, casos: 2, porCaso: 3 }), true);
  assert.equal(q.planValido({ alternativas: 0, vf: 0, desarrollo: 0, casos: 6, porCaso: 1 }), false); // máx. 5 casos
  assert.equal(q.planValido({ alternativas: 0, vf: 0, desarrollo: 0, casos: 5, porCaso: 6 }), false); // 30 preguntas > 25
  assert.equal(q.planValido({ alternativas: 0, vf: 0, desarrollo: 0, casos: 1, porCaso: 7 }), false); // máx. 6 por caso
  assert.equal(q.planValido({ alternativas: 0, vf: 0, desarrollo: 0, casos: 0, porCaso: 3 }), false); // vacío
});

test('presets: "caso" arma casos de 3 preguntas; los demás no traen casos', () => {
  assert.deepEqual(q.presetPlan('caso', 10), { alternativas: 0, vf: 0, desarrollo: 0, casos: 2, porCaso: 3 });
  assert.equal(q.presetPlan('caso', 3).casos, 1); assert.equal(q.presetPlan('caso', 9).casos, 2);
  assert.equal(q.presetPlan('caso', 100).casos, 5); // tope
  assert.equal(q.presetPlan('vf', 8).casos, 0);
  assert.equal(q.presetPlan('mixto', 10).casos, 0);
});

test('normalizarCasos: exige relato, preguntas con pauta y descarta lo defectuoso', () => {
  const crudo = { casos: [
    { titulo: 'Compraventa de inmueble', hechos: HECHOS, preguntas: [
      { enunciado: '¿Se cumplen los requisitos de validez del contrato?', pauta: ['Consentimiento', 'Objeto lícito', 'Causa'] },
      { enunciado: 'corta', pauta: ['a', 'b'] },
      { enunciado: '¿Qué puede exigir la sociedad a don Pedro?', pauta: 'Saldo del precio; Entrega' },
      { enunciado: '¿Qué pasa si falta la escritura pública prometida?', pauta: ['solo una'] },
    ] },
    { titulo: 'Sin relato', hechos: 'muy corto', preguntas: [{ enunciado: '¿Pregunta suficientemente larga?', pauta: ['a', 'b'] }] },
    { titulo: 'Sin preguntas válidas', hechos: HECHOS, preguntas: [{ enunciado: 'x', pauta: [] }] },
  ] };
  const r = q.normalizarCasos(crudo, { nuevoId: id });
  assert.equal(r.length, 1);
  assert.equal(r[0].preguntas.length, 2);
  assert.deepEqual(r[0].preguntas[1].pauta, ['Saldo del precio', 'Entrega']);
  assert.deepEqual(q.normalizarCasos(null), []);
  assert.deepEqual(q.normalizarCasos({ casos: 'nada' }), []);
});

test('aplanarCasos: cada pregunta es un desarrollo con el caso adjunto y numeración Caso 1, Caso 2', () => {
  const casos = [
    { id: 'c1', titulo: 'Uno', hechos: HECHOS, preguntas: [{ enunciado: '¿Primera pregunta del caso uno?', pauta: ['a', 'b'] }, { enunciado: '¿Segunda pregunta del caso uno?', pauta: ['a', 'b'] }] },
    { id: 'c2', titulo: 'Dos', hechos: HECHOS, preguntas: [{ enunciado: '¿Única pregunta del caso dos?', pauta: ['a', 'b'] }] },
  ];
  const p = q.aplanarCasos(casos, { nuevoId: id });
  assert.equal(p.length, 3);
  assert.ok(p.every((x) => x.tipo === 'desarrollo' && x.caso && x.pauta.length === 2));
  assert.deepEqual(p.map((x) => x.caso.num), [1, 2 - 1 + 0 === 1 ? 1 : 1, 2].slice(0, 3));
  assert.deepEqual(p.map((x) => x.casoOrden), [0, 1, 0]);
  assert.equal(q.seccionDe(p[0]), 'caso');
  assert.equal(q.seccionDe({ tipo: 'desarrollo' }), 'desarrollo');
});

test('se puntúan como desarrollo (3 pts) y aparecen aparte en el resumen', () => {
  const casos = [{ id: 'c1', titulo: 'Uno', hechos: HECHOS, preguntas: [{ enunciado: '¿Primera pregunta del caso uno?', pauta: ['a', 'b'] }] }];
  const preguntas = [{ id: 'd1', tipo: 'desarrollo', enunciado: 'Desarrolle algo largo', pauta: ['a', 'b'] }, ...q.aplanarCasos(casos, { nuevoId: () => 'k1' })];
  const prueba = { preguntas, respuestas: { d1: 'resp', k1: 'resp' }, evaluaciones: { d1: { ideas: [{ estado: 'bien' }, { estado: 'bien' }] }, k1: { ideas: [{ estado: 'bien' }, { estado: 'falta' }] } } };
  const r = q.calcularPrueba(prueba);
  assert.equal(r.total, 6);
  assert.equal(r.porTipo.desarrollo.n, 1); assert.equal(r.porTipo.desarrollo.puntos, 3);
  assert.equal(r.porTipo.caso.n, 1); assert.equal(r.porTipo.caso.puntos, 1.5);
  assert.equal(r.puntos, 4.5);
});

test('paginar: los casos van en su propia sección y el relato pesa (se pasa a otra hoja antes)', () => {
  const caso = { id: 'cx', num: 1, titulo: 'T', hechos: HECHOS.repeat(3) };
  const alt = Array.from({ length: 2 }, (_, i) => ({ id: 'a' + i, tipo: 'alternativas', enunciado: 'x'.repeat(40), opciones: ['a', 'b', 'c', 'd'] }));
  const cs = Array.from({ length: 3 }, (_, i) => ({ id: 'q' + i, tipo: 'desarrollo', enunciado: 'pregunta del caso ' + i, pauta: ['a', 'b'], caso, casoOrden: i }));
  const pags = q.paginar([...alt, ...cs]);
  const todas = pags.flatMap((p) => p.preguntas);
  assert.equal(todas.length, 5);
  assert.deepEqual(todas.filter((x) => x.seccion).map((x) => x.seccion), ['alternativas', 'caso']);
  // 3 desarrollos de 2,4 + relato no caben en una hoja con las alternativas
  assert.ok(pags.length >= 2);
  assert.ok(q.NOMBRES.caso && q.INSTRUCCION.caso && q.ROMANO.length >= 4);
});

test('enunciadosPrevios incluye los casos ya usados para no repetir el escenario', () => {
  const caso = { id: 'cx', num: 1, titulo: 'Compraventa de inmueble', hechos: HECHOS };
  const e = q.enunciadosPrevios([{ creado: 1, preguntas: [{ enunciado: '¿Pregunta uno del caso?', tipo: 'desarrollo', caso }, { enunciado: '¿Pregunta dos del caso?', tipo: 'desarrollo', caso }] }]);
  assert.equal(e.filter((t) => t.startsWith('CASO ya usado')).length, 1);
  assert.ok(e.includes('CASO ya usado: Compraventa de inmueble'));
});

const docs = [{ id: 'd1', ramoId: 'r1', nombre: 'Doc 1', conceptos: Array.from({ length: 6 }, (_, i) => ({ id: 'c' + i, nombre: 'Concepto ' + i, referencia: 'La institución número ' + i + ' produce efectos entre las partes. '.repeat(8) })) }];
const RELATOS = {
  A: 'Doña Marta Rojas arrendó un local comercial en Valdivia a la empresa Panadería Sur Limitada por veinticuatro meses, con renta mensual de seiscientos mil pesos, y a los ocho meses el arrendatario dejó de pagar alegando que el techo tenía goteras graves que impedían trabajar.',
  B: 'Constructora Pehuén S.A. y el ingeniero Luis Cárcamo pactaron la edificación de una bodega por noventa millones de pesos, entregándose el terreno en enero; al vencer el plazo la obra estaba inconclusa y el mandante pretende cobrar la cláusula penal convenida en el contrato.',
  Único: 'Un grupo de socios de la agrícola Los Andes Limitada acordó disolver anticipadamente la sociedad en junta extraordinaria, pero uno de ellos, ausente y sin citación válida, impugna el acuerdo exigiendo se declare su nulidad y se repartan las utilidades pendientes.',
};
const casoIA = (k, m) => ({ titulo: `Caso ${k} sobre contratos`, hechos: RELATOS[k], preguntas: Array.from({ length: m }, (_, j) => ({ enunciado: `¿Pregunta número ${j + 1} del caso ${k} aplicada a los hechos?`, pauta: ['idea clave uno', 'idea clave dos', 'idea clave tres'], concepto: 'X' })) });

test('crearPrueba con casos: pide casos a la IA, los aplana y los deja al final', async () => {
  mem.clear(); llamadas = []; ai.setClave('groq', 'gsk_x');
  responder = async (u) => {
    if (u.endsWith('/models')) return new Response(JSON.stringify({ data: [] }));
    const sys = llamadas.at(-1).body.messages[0].content;
    let body;
    if (sys.includes('CASOS PRÁCTICOS')) {
      assert.match(sys, /EXACTAMENTE 2 CASOS/); assert.match(sys, /EXACTAMENTE 3 preguntas/);
      body = { casos: [casoIA('A', 3), casoIA('B', 3)] };
    } else body = { preguntas: [{ enunciado: '¿Cuál es la definición correcta del concepto en la materia?', opciones: ['a1', 'b1', 'c1', 'd1'], correcta: 0 }] };
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(body) } }] }));
  };
  const plan = { alternativas: 1, vf: 0, desarrollo: 0, casos: 2, porCaso: 3 };
  const p = await crearPrueba({ docs, origen: { nombre: 'Todo', clave: 'todo' }, plan });
  assert.equal(p.preguntas.length, 7); // 1 alternativa + 2 casos × 3
  assert.equal(p.preguntas[0].tipo, 'alternativas');
  const delCaso = p.preguntas.filter((x) => x.caso);
  assert.equal(delCaso.length, 6);
  assert.deepEqual([...new Set(delCaso.map((x) => x.caso.num))], [1, 2]);
  assert.ok(delCaso.every((x) => x.tipo === 'desarrollo' && x.pauta.length === 3 && x.caso.hechos.length > 80));
  assert.equal(q.totalPlan(plan), 7);
});

test('crearPrueba: si la IA entrega menos casos de los pedidos, avisa y no falla', async () => {
  mem.clear(); llamadas = []; ai.setClave('groq', 'gsk_x');
  responder = async (u) => {
    if (u.endsWith('/models')) return new Response(JSON.stringify({ data: [] }));
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ casos: [casoIA('Único', 2)] }) } }] }));
  };
  const p = await crearPrueba({ docs, origen: { nombre: 'Todo', clave: 'todo' }, plan: { alternativas: 0, vf: 0, desarrollo: 0, casos: 3, porCaso: 2 } });
  assert.ok(p.preguntas.length >= 2);
  assert.match(p.aviso, /casos prácticos/);
});

test('corregir una pregunta de caso: la IA recibe el relato del caso junto con la pregunta y la pauta', async () => {
  mem.clear(); llamadas = []; ai.setClave('groq', 'gsk_x');
  let visto = '';
  responder = async (u) => {
    if (u.endsWith('/models')) return new Response(JSON.stringify({ data: [] }));
    visto = llamadas.at(-1).body.messages.at(-1).content;
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ ideas: [{ idea: 'a', estado: 'bien', comentario: '' }], resumen: 'ok' }) } }] }));
  };
  const pregunta = q.aplanarCasos([{ id: 'c1', titulo: 'Compraventa', hechos: HECHOS, preguntas: [{ enunciado: '¿Se cumplen los requisitos de validez?', pauta: ['Consentimiento', 'Objeto'] }] }], { nuevoId: id })[0];
  const r = await corregirDesarrollo(pregunta, 'Sí, porque hubo consentimiento.');
  assert.equal(r.ideas.length, 1);
  assert.match(visto, /CASO PRÁCTICO \(Compraventa\)/);
  assert.match(visto, /Don Pedro Soto/);
  assert.match(visto, /¿Se cumplen los requisitos de validez\?/);
  assert.match(visto, /Consentimiento/);
});
