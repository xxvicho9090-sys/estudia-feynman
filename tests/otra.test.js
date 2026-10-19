import test from 'node:test';
import assert from 'node:assert/strict';

const mem = new Map();
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
let llamadas = [];
let responder = async () => new Response('{}', { status: 500 });
globalThis.fetch = async (url, init) => { llamadas.push({ url: String(url), body: init?.body ? JSON.parse(init.body) : null }); return responder(String(url), init); };

const { armarMaterial, cobertura, conceptosCubiertos, enunciadosPrevios, similares, mismoOrigen, docsDeOrigen } = await import('../src/lib/quiz.js');
const { crearPrueba } = await import('../src/lib/pruebas.js');
const ai = await import('../src/lib/ai.js');

const sinAzar = () => 0;
const docs = [{ id: 'd1', ramoId: 'r1', nombre: 'Doc 1', conceptos: Array.from({ length: 10 }, (_, i) => ({ id: 'c' + i, nombre: 'Concepto ' + i, referencia: 'x'.repeat(400) })) }];

test('armarMaterial parte por los conceptos NO practicados', () => {
  const vistos = new Set(['c0', 'c1', 'c2', 'c3', 'c4', 'c5']); // quedan c6..c9 sin ver
  const m = armarMaterial(docs, 1700, sinAzar, vistos); // caben ~4 conceptos
  assert.equal(m.conceptos, 4);
  assert.deepEqual(m.ids.sort(), ['c6', 'c7', 'c8', 'c9']);
  assert.equal(m.nuevos, 4);
  assert.equal(m.cicloNuevo, false);
});

test('armarMaterial: si caben más que los nuevos, completa con los ya vistos (nuevos primero)', () => {
  const vistos = new Set(['c0', 'c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8']); // solo c9 nuevo
  const m = armarMaterial(docs, 1300, sinAzar, vistos);
  assert.equal(m.ids[0], 'c9');
  assert.equal(m.nuevos, 1);
  assert.ok(m.ids.length > 1);
});

test('armarMaterial: si ya practicaste todo, empieza un ciclo nuevo', () => {
  const vistos = new Set(docs[0].conceptos.map((c) => c.id));
  const m = armarMaterial(docs, 1700, sinAzar, vistos);
  assert.equal(m.cicloNuevo, true);
  assert.ok(m.conceptos > 0);
});

test('armarMaterial sin historial se comporta como siempre', () => {
  const m = armarMaterial(docs, 100000, sinAzar);
  assert.equal(m.conceptos, 10); assert.equal(m.total, 10); assert.equal(m.nuevos, 10);
  // concepto sin id: se usa documento+nombre como clave
  const sinId = armarMaterial([{ nombre: 'D', conceptos: [{ nombre: 'A', referencia: 'r' }] }], 1000, sinAzar);
  assert.deepEqual(sinId.ids, ['D|A']);
});

test('cobertura y conceptosCubiertos', () => {
  const previas = [{ conceptosIds: ['c0', 'c1'] }, { conceptosIds: ['c1', 'c2'] }, {}];
  assert.deepEqual([...conceptosCubiertos(previas)].sort(), ['c0', 'c1', 'c2']);
  assert.deepEqual(cobertura(docs, previas), { total: 10, cubiertos: 3 });
  assert.deepEqual(cobertura(docs, []), { total: 10, cubiertos: 0 });
});

test('enunciadosPrevios: recientes primero, sin repetidos, con tope', () => {
  const pruebas = [
    { creado: 1, preguntas: [{ enunciado: 'Vieja A' }, { enunciado: 'Común' }] },
    { creado: 2, preguntas: [{ enunciado: 'Nueva B' }, { enunciado: 'común' }] },
  ];
  assert.deepEqual(enunciadosPrevios(pruebas), ['Nueva B', 'común', 'Vieja A']);
  assert.equal(enunciadosPrevios(pruebas, 2).length, 2);
});

test('similares detecta preguntas casi iguales y no confunde las distintas', () => {
  assert.equal(similares('¿Qué es el capital social de una sociedad anónima?', 'Qué es el capital social de una sociedad anónima'), true);
  assert.equal(similares('¿Cuál es la naturaleza jurídica del pago?', '¿Cuáles son los requisitos de la persona jurídica?'), false);
  assert.equal(similares('', 'algo'), false);
});

test('origen: comparar y volver a encontrar el material', () => {
  assert.equal(mismoOrigen({ clave: 'r:r1', nombre: 'A' }, { clave: 'r:r1', nombre: 'B' }), true);
  assert.equal(mismoOrigen({ clave: 'r:r1' }, { clave: 'r:r2' }), false);
  assert.equal(mismoOrigen({ nombre: 'Contratos' }, { nombre: 'Contratos' }), true); // pruebas antiguas sin clave
  const varios = [...docs, { id: 'd2', ramoId: 'r2', nombre: 'Doc 2', conceptos: [] }];
  const ramos = [{ id: 'r1', nombre: 'Civil' }, { id: 'r2', nombre: 'Laboral' }];
  assert.deepEqual(docsDeOrigen({ clave: 'd:d2' }, varios, ramos).map((d) => d.id), ['d2']);
  assert.deepEqual(docsDeOrigen({ clave: 'r:r1' }, varios, ramos).map((d) => d.id), ['d1']);
  assert.equal(docsDeOrigen({ clave: 'todo' }, varios, ramos).length, 2);
  assert.deepEqual(docsDeOrigen({ nombre: 'Laboral' }, varios, ramos).map((d) => d.id), ['d2']); // antiguas: por nombre de ramo
  assert.deepEqual(docsDeOrigen({ nombre: 'Doc 1' }, varios, ramos).map((d) => d.id), ['d1']); // o de PDF
});

test('crearPrueba: pide a la IA no repetir, parte por lo no practicado y descarta preguntas repetidas', async () => {
  mem.clear(); llamadas = [];
  ai.setClave('groq', 'gsk_x');
  const previas = [{ creado: 1, origen: { clave: 'todo' }, conceptosIds: ['c0', 'c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7'], preguntas: [{ enunciado: '¿Cuál es la definición correcta del concepto uno en esta materia?' }] }];
  responder = async (u) => {
    if (u.endsWith('/models')) return new Response(JSON.stringify({ data: [] }));
    const cuerpo = llamadas.at(-1).body;
    assert.ok(cuerpo.messages.at(-1).content.includes('PREGUNTAS YA USADAS'));
    const preguntas = [
      { enunciado: '¿Cuál es la definición correcta del concepto uno en esta materia?', opciones: ['a1', 'b1', 'c1', 'd1'], correcta: 0 }, // repetida → se descarta
      { enunciado: '¿Qué efecto produce el concepto nueve en la práctica jurídica?', opciones: ['a2', 'b2', 'c2', 'd2'], correcta: 1 },
      { enunciado: '¿Cuándo se extingue el concepto ocho según la ley vigente?', opciones: ['a3', 'b3', 'c3', 'd3'], correcta: 2 },
    ];
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ preguntas }) } }] }));
  };
  const p = await crearPrueba({ docs, origen: { nombre: 'Todo', clave: 'todo' }, plan: { alternativas: 2, vf: 0, desarrollo: 0 }, previas });
  assert.equal(p.preguntas.length, 2);
  assert.ok(p.preguntas.every((q) => !/concepto uno/.test(q.enunciado)));
  assert.ok(p.conceptosIds.includes('c8') && p.conceptosIds.includes('c9')); // los no practicados entran
  const material = llamadas.find((l) => l.body)?.body.messages.at(-1).content;
  assert.ok(material.indexOf('Concepto 8') >= 0 || material.indexOf('Concepto 9') >= 0);
  assert.match(p.cobertura, /que aún no habías practicado/);
});

test('crearPrueba: si todas las preguntas nuevas se parecen a las viejas, igual entrega la prueba (con aviso)', async () => {
  mem.clear(); llamadas = [];
  ai.setClave('groq', 'gsk_x');
  const previas = [{ creado: 1, origen: { clave: 'todo' }, conceptosIds: [], preguntas: [{ enunciado: '¿Cuál es la definición correcta del concepto uno en esta materia?' }] }];
  responder = async (u) => {
    if (u.endsWith('/models')) return new Response(JSON.stringify({ data: [] }));
    const preguntas = [{ enunciado: '¿Cuál es la definición correcta del concepto uno en esta materia?', opciones: ['a1', 'b1', 'c1', 'd1'], correcta: 0 }];
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ preguntas }) } }] }));
  };
  const p = await crearPrueba({ docs, origen: { nombre: 'Todo', clave: 'todo' }, plan: { alternativas: 1, vf: 0, desarrollo: 0 }, previas });
  assert.equal(p.preguntas.length, 1);
  assert.match(p.aviso, /parecerse a las de pruebas anteriores/);
});
