import test from 'node:test';
import assert from 'node:assert/strict';

const mem = new Map();
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
let llamadas = [];
let responder = async () => new Response('{}', { status: 500 });
globalThis.fetch = async (url, init) => { llamadas.push({ url: String(url), body: init?.body ? JSON.parse(init.body) : null }); return responder(String(url), init); };

const q = await import('../src/lib/quiz.js');
const { ampliarPrueba, corregirPrueba } = await import('../src/lib/pruebas.js');
const ai = await import('../src/lib/ai.js');

const docs = [{ id: 'd1', ramoId: 'r1', nombre: 'Doc 1', conceptos: Array.from({ length: 8 }, (_, i) => ({ id: 'c' + i, nombre: 'Concepto ' + i, referencia: 'La institución número ' + i + ' produce efectos entre las partes. '.repeat(8) })) }];
const caso = (id, num) => ({ id, num, titulo: 'Caso ' + num, hechos: 'x'.repeat(200) });
const base = () => ({
  id: 'p1', creado: 1, titulo: 'Todo', origen: { nombre: 'Todo', clave: 'todo' }, plan: { alternativas: 2, vf: 0, desarrollo: 0, casos: 1, porCaso: 2, extension: 'breve' },
  estado: 'corregida', resultado: { nota: 5 }, entregada: 99, conceptosIds: ['c0', 'c1', 'c2'],
  preguntas: [
    { id: 'a1', tipo: 'alternativas', enunciado: '¿Pregunta alternativa número uno sobre el tema?', opciones: ['a', 'b', 'c', 'd'], correcta: 0 },
    { id: 'a2', tipo: 'alternativas', enunciado: '¿Pregunta alternativa número dos sobre el tema?', opciones: ['a', 'b', 'c', 'd'], correcta: 1 },
    { id: 'k1', tipo: 'desarrollo', enunciado: '¿Primera pregunta del caso uno aplicada?', pauta: ['a', 'b'], caso: caso('cA', 1), casoOrden: 0 },
    { id: 'k2', tipo: 'desarrollo', enunciado: '¿Segunda pregunta del caso uno aplicada?', pauta: ['a', 'b'], caso: caso('cA', 1), casoOrden: 1 },
  ],
  respuestas: { a1: 0, a2: 0, k1: 'respuesta uno', k2: 'respuesta dos' },
  evaluaciones: { k1: { ideas: [{ estado: 'bien' }, { estado: 'falta' }] }, k2: { ideas: [{ estado: 'bien' }, { estado: 'bien' }] } },
});

test('ordenarPreguntas: alternativas, V/F, desarrollo y casos; casos por número y sus preguntas en orden', () => {
  const m = [
    { id: 'k2b', tipo: 'desarrollo', caso: caso('cB', 2), casoOrden: 1 },
    { id: 'k1a', tipo: 'desarrollo', caso: caso('cA', 1), casoOrden: 0 },
    { id: 'v1', tipo: 'vf' },
    { id: 'k2a', tipo: 'desarrollo', caso: caso('cB', 2), casoOrden: 0 },
    { id: 'd1', tipo: 'desarrollo' },
    { id: 'a1', tipo: 'alternativas' },
    { id: 'a2', tipo: 'alternativas' },
    { id: 'k1b', tipo: 'desarrollo', caso: caso('cA', 1), casoOrden: 1 },
  ];
  assert.deepEqual(q.ordenarPreguntas(m).map((x) => x.id), ['a1', 'a2', 'v1', 'd1', 'k1a', 'k1b', 'k2a', 'k2b']);
  const antes = m.map((x) => x.id);
  q.ordenarPreguntas(m);
  assert.deepEqual(m.map((x) => x.id), antes); // no muta
});

test('sumaPlan acumula lo agregado y conserva/actualiza el detalle de los casos', () => {
  const r = q.sumaPlan({ alternativas: 2, vf: 1, desarrollo: 0, casos: 1, porCaso: 2, extension: 'breve' }, { alternativas: 3, vf: 0, desarrollo: 1, casos: 2, porCaso: 4, extension: 'plana' });
  assert.deepEqual(r, { alternativas: 5, vf: 1, desarrollo: 1, casos: 3, porCaso: 4, extension: 'plana' });
  const sinCasos = q.sumaPlan({ alternativas: 2, casos: 1, porCaso: 2, extension: 'dos' }, { vf: 2, casos: 0 });
  assert.equal(sinCasos.porCaso, 2); assert.equal(sinCasos.extension, 'dos'); assert.equal(sinCasos.vf, 2);
  assert.equal(q.sumaPlan(undefined, { alternativas: 1 }).alternativas, 1);
});

test('puedeAgregar respeta el plan válido y el tope total de la prueba', () => {
  const p = base();
  assert.equal(q.puedeAgregar(p, { alternativas: 3, vf: 0, desarrollo: 0, casos: 0 }), true);
  assert.equal(q.puedeAgregar(p, { alternativas: 0, vf: 0, desarrollo: 0, casos: 0 }), false); // nada que agregar
  assert.equal(q.puedeAgregar(p, { alternativas: 0, vf: 0, desarrollo: 0, casos: 1, porCaso: 3 }), true);
  const grande = { ...p, preguntas: Array.from({ length: q.MAX_TOTAL - 2 }, (_, i) => ({ id: 'x' + i, tipo: 'vf', enunciado: 'e' })) };
  assert.equal(q.puedeAgregar(grande, { alternativas: 2, vf: 0, desarrollo: 0, casos: 0 }), true);
  assert.equal(q.puedeAgregar(grande, { alternativas: 3, vf: 0, desarrollo: 0, casos: 0 }), false); // pasaría el máximo
});

const usarIA = () => {
  mem.clear(); llamadas = []; ai.setClave('groq', 'gsk_x');
  let k = 0;
  responder = async (u) => {
    if (u.endsWith('/models')) return new Response(JSON.stringify({ data: [] }));
    const sys = llamadas.at(-1).body.messages[0].content;
    const n = +sys.match(/EXACTAMENTE (\d+)/)[1];
    let body;
    if (/PRÁCTICO/.test(sys)) {
      const m = +sys.match(/EXACTAMENTE (\d+) preguntas/)[1];
      body = { casos: Array.from({ length: n }, () => { k++; return { titulo: `Caso nuevo ${['alfa', 'beta', 'gamma'][k % 3]} ${k}`, hechos: `El señor ${['Pérez', 'Soto', 'Rojas'][k % 3]} y la empresa ${['Norte', 'Sur', 'Centro'][k % 3]} Limitada celebraron un acuerdo número ${k} en el que se pactaron prestaciones recíprocas con plazos y garantías distintas para cada parte involucrada.`, preguntas: Array.from({ length: m }, (_, j) => ({ enunciado: `¿Cómo se resuelve la situación ${['primera', 'segunda', 'tercera', 'cuarta'][j]} del acuerdo ${k}?`, pauta: ['idea uno', 'idea dos'], concepto: 'X' })) }; }) };
    } else if (/ALTERNATIVAS/.test(sys)) {
      body = { preguntas: Array.from({ length: n }, () => { k++; return { enunciado: `¿Qué ocurre en la institución ${['alfa', 'beta', 'gamma', 'delta', 'épsilon'][k % 5]} cuando se produce el hecho ${k}?`, opciones: ['uno', 'dos', 'tres', 'cuatro'], correcta: 0, explicacion: 'e' }; }) };
    } else if (/VERDADERO O FALSO/.test(sys)) {
      body = { preguntas: Array.from({ length: n }, () => { k++; return { enunciado: `La institución ${['alfa', 'beta', 'gamma'][k % 3]} siempre produce el efecto número ${k} entre quienes la celebran.`, correcta: true, explicacion: 'e' }; }) };
    } else {
      body = { preguntas: Array.from({ length: n }, () => { k++; return { enunciado: `Desarrolle los elementos de la figura ${['alfa', 'beta', 'gamma'][k % 3]} número ${k}.`, pauta: ['idea uno', 'idea dos', 'idea tres'], concepto: 'X' }; }) };
    }
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(body) } }] }));
  };
};

test('ampliarPrueba: agrega de todos los tipos, ordena, numera casos a continuación y deja la prueba en curso', async () => {
  usarIA();
  const original = base();
  const { prueba: p, nuevas } = await ampliarPrueba({ prueba: original, docs, plan: { alternativas: 2, vf: 1, desarrollo: 1, casos: 1, porCaso: 2, extension: 'breve' } });
  assert.equal(nuevas.length, 2 + 1 + 1 + 2);
  assert.equal(p.preguntas.length, 4 + 6);
  assert.deepEqual(p.preguntas.map((x) => (x.caso ? 'caso' + x.caso.num : x.tipo)), ['alternativas', 'alternativas', 'alternativas', 'alternativas', 'vf', 'desarrollo', 'caso1', 'caso1', 'caso2', 'caso2']);
  assert.equal(p.estado, 'en curso'); assert.equal(p.resultado, null); assert.equal(p.entregada, undefined);
  assert.deepEqual(p.plan, { alternativas: 4, vf: 1, desarrollo: 1, casos: 2, porCaso: 2, extension: 'breve' });
  // conserva lo ya respondido y corregido
  assert.deepEqual(p.respuestas, original.respuestas);
  assert.deepEqual(p.evaluaciones, original.evaluaciones);
  assert.equal(new Set(p.preguntas.map((x) => x.id)).size, p.preguntas.length); // ids únicos
  assert.ok(['c0', 'c1', 'c2'].every((c) => p.conceptosIds.includes(c)) && p.conceptosIds.length > 3);
  assert.equal(original.preguntas.length, 4); // no muta la original
});

test('ampliarPrueba: la IA recibe las preguntas que la prueba ya tiene para no repetirlas y empieza por conceptos nuevos', async () => {
  usarIA();
  await ampliarPrueba({ prueba: base(), docs, plan: { alternativas: 1, vf: 0, desarrollo: 0, casos: 0 } });
  const user = llamadas.find((l) => l.body)?.body.messages.at(-1).content;
  assert.match(user, /PREGUNTAS YA USADAS/);
  assert.match(user, /Pregunta alternativa número uno/);
  assert.match(user, /CASO ya usado: Caso 1/);
  // conceptos c0..c2 ya se usaron: el material debe traer primero otros
  const primeros = [...user.matchAll(/## (Concepto \d+)/g)].map((m) => m[1]);
  assert.ok(!['Concepto 0', 'Concepto 1', 'Concepto 2'].includes(primeros[0]));
});

test('después de ampliar solo hay que corregir lo nuevo: lo ya corregido no se vuelve a pedir a la IA', async () => {
  usarIA();
  const { prueba: p } = await ampliarPrueba({ prueba: base(), docs, plan: { alternativas: 0, vf: 0, desarrollo: 1, casos: 0 } });
  const nuevoDes = p.preguntas.find((x) => x.tipo === 'desarrollo' && !x.caso);
  const conRespuesta = { ...p, respuestas: { ...p.respuestas, [nuevoDes.id]: 'mi respuesta del desarrollo nuevo' } };
  llamadas = [];
  responder = async (u) => (u.endsWith('/models') ? new Response(JSON.stringify({ data: [] })) : new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ ideas: [{ idea: 'a', estado: 'bien', comentario: '' }], resumen: 'ok' }) } }] })));
  const r = await corregirPrueba(conRespuesta);
  assert.equal(llamadas.filter((l) => l.body && !l.url.endsWith('/models')).length, 1); // solo el desarrollo nuevo (k1 y k2 ya estaban corregidos)
  assert.equal(r.prueba.estado, 'corregida');
  assert.ok(r.prueba.resultado.nota != null);
});

test('ampliarPrueba falla con mensaje claro si no queda material o la IA no entrega nada', async () => {
  usarIA();
  await assert.rejects(() => ampliarPrueba({ prueba: base(), docs: [], plan: { alternativas: 1, vf: 0, desarrollo: 0, casos: 0 } }), /No queda material/);
  mem.clear(); ai.setClave('groq', 'gsk_x');
  responder = async (u) => (u.endsWith('/models') ? new Response(JSON.stringify({ data: [] })) : new Response(JSON.stringify({ choices: [{ message: { content: '{"preguntas":[]}' } }] })));
  await assert.rejects(() => ampliarPrueba({ prueba: base(), docs, plan: { alternativas: 2, vf: 0, desarrollo: 0, casos: 0 } }), /no pudo crear más preguntas/i);
});
