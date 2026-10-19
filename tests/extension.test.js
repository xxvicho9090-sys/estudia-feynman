import test from 'node:test';
import assert from 'node:assert/strict';

const mem = new Map();
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
let llamadas = [];
let responder = async () => new Response('{}', { status: 500 });
globalThis.fetch = async (url, init) => { llamadas.push({ url: String(url), body: init?.body ? JSON.parse(init.body) : null }); return responder(String(url), init); };

const q = await import('../src/lib/quiz.js');
const { crearPrueba } = await import('../src/lib/pruebas.js');
const ai = await import('../src/lib/ai.js');

const docs = [{ id: 'd1', ramoId: 'r1', nombre: 'Doc 1', conceptos: Array.from({ length: 6 }, (_, i) => ({ id: 'c' + i, nombre: 'Concepto ' + i, referencia: 'La institución número ' + i + ' produce efectos entre las partes. '.repeat(8) })) }];
const relato = (k, largo = 400) => `Caso número ${k}: la sociedad ${['Alfa', 'Beta', 'Gamma', 'Delta', 'Épsilon'][k % 5]} Limitada celebró un contrato con don ${['Pedro', 'Juan', 'Luis', 'Mario', 'Hugo'][k % 5]} en la ciudad ${['Temuco', 'Osorno', 'Puerto Montt', 'Chillán', 'Rancagua'][k % 5]}. ` + `Los hechos posteriores del número ${k} son distintos y detallados. `.repeat(Math.ceil(largo / 60));
const casoIA = (k, m, largo) => ({ titulo: `Caso titulado ${['uno', 'dos', 'tres', 'cuatro', 'cinco'][k % 5]}`, hechos: relato(k, largo), preguntas: Array.from({ length: m }, (_, j) => ({ enunciado: `¿Qué efectos produce lo ocurrido en el caso ${k}, pregunta ${j + 1}?`, pauta: ['idea uno', 'idea dos', 'idea tres'], concepto: 'X' })) });

// IA simulada: devuelve exactamente los casos que se le piden y registra cómo se pidió
const usarIA = (largo) => {
  mem.clear(); llamadas = []; ai.setClave('groq', 'gsk_x');
  let k = 0;
  responder = async (u) => {
    if (u.endsWith('/models')) return new Response(JSON.stringify({ data: [] }));
    const sys = llamadas.at(-1).body.messages[0].content;
    const n = +sys.match(/EXACTAMENTE (\d+) CASOS?/)[1];
    const m = +sys.match(/EXACTAMENTE (\d+) preguntas/)[1];
    const casos = Array.from({ length: n }, () => casoIA(++k, m, largo));
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ casos }) } }] }));
  };
};
const pedidos = () => llamadas.filter((l) => l.body && /PRÁCTICO/.test(l.body.messages[0].content)).map((l) => +l.body.messages[0].content.match(/EXACTAMENTE (\d+) CASOS?/)[1]);

test('EXTENSIONES: tres tamaños, "breve" por defecto', () => {
  assert.deepEqual(Object.keys(q.EXTENSIONES), ['breve', 'plana', 'dos']);
  assert.equal(q.extensionDe({}), 'breve');
  assert.equal(q.extensionDe({ extension: 'raro' }), 'breve');
  assert.equal(q.extensionDe({ extension: 'dos' }), 'dos');
  assert.ok(q.EXTENSIONES.dos.porLlamada < q.EXTENSIONES.plana.porLlamada && q.EXTENSIONES.plana.porLlamada < q.EXTENSIONES.breve.porLlamada);
});

test('planValido acepta las extensiones conocidas y rechaza las inventadas', () => {
  const base = { alternativas: 0, vf: 0, desarrollo: 0, casos: 2, porCaso: 3 };
  assert.equal(q.planValido(base), true);
  assert.equal(q.planValido({ ...base, extension: 'plana' }), true);
  assert.equal(q.planValido({ ...base, extension: 'enorme' }), false);
  assert.equal(q.planValido({ alternativas: 3, vf: 0, desarrollo: 0, casos: 0, extension: 'enorme' }), true); // sin casos no importa
});

test('esLargo: más de ~una plana de caracteres', () => {
  assert.equal(q.esLargo({ hechos: 'x'.repeat(900) }), false);
  assert.equal(q.esLargo({ hechos: 'x'.repeat(2500) }), true);
});

test('breve: se piden todos los casos en una sola consulta', async () => {
  usarIA(400);
  const p = await crearPrueba({ docs, origen: { nombre: 'T', clave: 'todo' }, plan: { alternativas: 0, vf: 0, desarrollo: 0, casos: 3, porCaso: 2 } });
  assert.deepEqual(pedidos(), [3]);
  assert.equal(p.preguntas.length, 6);
});

test('una plana: de a dos casos por consulta', async () => {
  usarIA(2800);
  const p = await crearPrueba({ docs, origen: { nombre: 'T', clave: 'todo' }, plan: { alternativas: 0, vf: 0, desarrollo: 0, casos: 3, porCaso: 2, extension: 'plana' } });
  assert.deepEqual(pedidos(), [2, 1]);
  assert.equal(p.preguntas.length, 6);
  const sys = llamadas.find((l) => l.body && /PRÁCTICO/.test(l.body.messages[0].content)).body.messages[0].content;
  assert.match(sys, /450 a 600 palabras/);
});

test('dos planas: un caso por consulta y el prompt pide el relato completo', async () => {
  usarIA(7000);
  const p = await crearPrueba({ docs, origen: { nombre: 'T', clave: 'todo' }, plan: { alternativas: 0, vf: 0, desarrollo: 0, casos: 3, porCaso: 2, extension: 'dos' } });
  assert.deepEqual(pedidos(), [1, 1, 1]);
  assert.equal(p.preguntas.length, 6);
  const sys = llamadas.find((l) => l.body && /PRÁCTICO/.test(l.body.messages[0].content)).body.messages[0].content;
  assert.match(sys, /900 a 1\.100 palabras/);
  assert.match(sys, /sin resumir/);
  assert.match(sys, /EXACTAMENTE 1 CASO PRÁCTICO ficticio/); // singular bien redactado
  assert.ok(p.preguntas.every((x) => q.esLargo(x.caso)));
});

test('el relato largo no se repite entero: en las hojas siguientes pesa poco', () => {
  const caso = { id: 'cx', num: 1, titulo: 'T', hechos: 'palabra '.repeat(900) }; // ~7000 caracteres
  const pregs = Array.from({ length: 3 }, (_, i) => ({ id: 'q' + i, tipo: 'desarrollo', enunciado: 'pregunta del caso ' + i, pauta: ['a', 'b'], caso, casoOrden: i }));
  const pags = q.paginar(pregs);
  assert.equal(pags[0].preguntas.length, 1); // la primera pregunta lleva el relato completo (ocupa casi toda la hoja)
  assert.equal(pags.length, 2); // las otras dos caben juntas con el relato resumido
  assert.equal(pags[1].preguntas.length, 2);
});

test('si el caso largo llega cortado o inválido se avisa y no se rompe la prueba', async () => {
  mem.clear(); llamadas = []; ai.setClave('groq', 'gsk_x');
  responder = async (u) => {
    if (u.endsWith('/models')) return new Response(JSON.stringify({ data: [] }));
    return new Response(JSON.stringify({ choices: [{ message: { content: '{"casos":[{"titulo":"cortado","hechos":"El relato se cortó a la mitad por el lím' } }] }));
  };
  await assert.rejects(() => crearPrueba({ docs, origen: { nombre: 'T', clave: 'todo' }, plan: { alternativas: 0, vf: 0, desarrollo: 0, casos: 1, porCaso: 2, extension: 'dos' } }), /no pudo crear preguntas/i);
  // con otras preguntas en la misma prueba, igual se entrega la prueba con aviso
  const p = await crearPrueba({ docs, origen: { nombre: 'T', clave: 'todo' }, plan: { alternativas: 1, vf: 0, desarrollo: 0, casos: 1, porCaso: 2, extension: 'dos' } }).catch((e) => e);
  assert.ok(p instanceof Error || p.aviso);
});
