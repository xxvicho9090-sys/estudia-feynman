import test from 'node:test';
import assert from 'node:assert/strict';

// Entorno falso: localStorage y fetch controlados por cada prueba.
const mem = new Map();
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
let handler = async () => new Response('{}', { status: 500 });
let llamadas = [];
globalThis.fetch = async (url, init) => { llamadas.push({ url: String(url), body: init?.body ? JSON.parse(init.body) : null }); return handler(String(url), init); };

const ai = await import('../src/lib/ai.js');
const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status });
const openai = (texto) => json({ choices: [{ message: { content: texto } }] });
const gemini = (texto) => json({ candidates: [{ content: { parts: [{ text: texto }] } }] });
const reset = () => { mem.clear(); llamadas = []; };
const msgs = [{ role: 'system', content: 'sys' }, { role: 'user', content: 'hola' }];

test('sin ninguna IA conectada: error claro', async () => {
  reset();
  assert.equal(ai.hayIA(), false);
  await assert.rejects(() => ai.chat(msgs), (e) => e.code === 'nokey');
});

test('Groq responde normal y se recuerda el modelo', async () => {
  reset(); ai.setClave('groq', 'gsk_x');
  handler = async (u) => (u.endsWith('/models') ? json({ data: [] }) : openai('{"ok":true}'));
  assert.equal(await ai.chat(msgs), '{"ok":true}');
  assert.equal(llamadas.at(-1).body.model, 'llama-3.3-70b-versatile'); // primera opción del proveedor
  assert.equal(ai.ultimoUsado(), 'groq');
});

test('límite de Groq (429): pasa a Gemini y luego evita a Groq un rato', async () => {
  reset(); ai.setClave('groq', 'gsk_x'); ai.setClave('gemini', 'AIx');
  handler = async (u) => {
    if (u.includes('groq.com')) return u.endsWith('/models') ? json({ data: [] }) : json({ error: { message: 'rate' } }, 429);
    if (u.endsWith('/models') || u.includes('?pageSize')) return json({ models: [{ name: 'models/gemini-2.5-flash', supportedGenerationMethods: ['generateContent'] }] });
    return gemini('{"de":"gemini"}');
  };
  assert.equal(await ai.chat(msgs), '{"de":"gemini"}');
  assert.equal(ai.ultimoUsado(), 'gemini');
  const groqAntes = llamadas.filter((l) => l.url.includes('groq.com/openai/v1/chat')).length;
  assert.equal(groqAntes, 1);
  llamadas = [];
  assert.equal(await ai.chat(msgs), '{"de":"gemini"}');
  assert.equal(llamadas.filter((l) => l.url.includes('groq.com')).length, 0); // Groq en descanso: ni se intenta
});

test('Gemini: systemInstruction + JSON, y la clave va en cabecera, no en la URL', async () => {
  reset(); ai.setClave('gemini', 'AIsecreta');
  let visto;
  handler = async (u, init) => { if (u.includes('generateContent')) { visto = { u, init }; return gemini('{"ok":true}'); } return json({ models: [] }); };
  await ai.chat(msgs);
  assert.ok(!visto.u.includes('AIsecreta'));
  assert.equal(visto.init.headers['x-goog-api-key'], 'AIsecreta');
  const b = JSON.parse(visto.init.body);
  assert.equal(b.systemInstruction.parts[0].text, 'sys');
  assert.equal(b.generationConfig.responseMimeType, 'application/json');
  assert.equal(b.contents[0].role, 'user');
});

test('modelo inexistente (404): descubre la lista y prueba otro', async () => {
  reset(); ai.setClave('cerebras', 'csk-x');
  handler = async (u, init) => {
    if (u.endsWith('/models')) return json({ data: [{ id: 'llama-3.3-70b' }, { id: 'text-embedding-x' }] });
    const m = JSON.parse(init.body).model;
    return m === 'llama-3.3-70b' ? openai('{"ok":true}') : json({ error: { message: 'model not found' } }, 404);
  };
  assert.equal(await ai.chat(msgs), '{"ok":true}');
  assert.equal(ai.ultimoUsado(), 'cerebras');
});

test('modelo sin modo JSON (400 response_format): reintenta sin él', async () => {
  reset(); ai.setClave('openrouter', 'sk-or-x');
  handler = async (u, init) => {
    if (u.endsWith('/models')) return json({ data: [{ id: 'google/gemma-4-31b-it:free', supported_parameters: ['response_format'] }] });
    const b = JSON.parse(init.body);
    return b.response_format ? json({ error: { message: 'response_format not supported' } }, 400) : openai('{"ok":true}');
  };
  assert.equal(await ai.chat(msgs), '{"ok":true}');
  assert.ok(llamadas.some((l) => l.body && !l.body.response_format));
});

test('OpenRouter solo usa modelos gratis con modo JSON', async () => {
  reset(); ai.setClave('openrouter', 'sk-or-x');
  handler = async (u, init) => {
    if (u.endsWith('/models')) return json({ data: [{ id: 'caro/modelo' }, { id: 'sin-json/m:free', supported_parameters: [] }, { id: 'google/gemma-4-31b-it:free', supported_parameters: ['response_format'] }] });
    return openai('{"ok":true}');
  };
  await ai.chat(msgs);
  assert.equal(llamadas.find((l) => l.body)?.body.model, 'google/gemma-4-31b-it:free');
});

test('clave inválida en el primero: usa el respaldo; si todos fallan, mensaje con cada motivo', async () => {
  reset(); ai.setClave('groq', 'malo'); ai.setClave('mistral', 'malo2');
  handler = async (u) => (u.endsWith('/models') ? json({ data: [] }) : json({ error: { message: 'bad' } }, 401));
  await assert.rejects(() => ai.chat(msgs), (e) => e.code === 'badkey' && /Groq/.test(e.message) && /Mistral/.test(e.message));
  ai.setClave('mistral', 'bueno');
  handler = async (u) => (u.includes('groq.com') ? json({}, 401) : u.endsWith('/models') ? json({ data: [] }) : openai('{"ok":true}'));
  assert.equal(await ai.chat(msgs), '{"ok":true}');
});

test('una sola IA con límite: el error es el suyo, sin enredos', async () => {
  reset(); ai.setClave('groq', 'gsk_x');
  handler = async (u) => (u.endsWith('/models') ? json({ data: [] }) : json({}, 429));
  await assert.rejects(() => ai.chat(msgs), (e) => e.code === 'limit' && /Groq/.test(e.message));
});

test('sin conexión: error "offline" y pasa al siguiente', async () => {
  reset(); ai.setClave('groq', 'gsk_x'); ai.setClave('mistral', 'm');
  handler = async (u) => { if (u.includes('groq.com')) throw new TypeError('fail'); return u.endsWith('/models') ? json({ data: [] }) : openai('{"ok":true}'); };
  assert.equal(await ai.chat(msgs), '{"ok":true}');
});

test('Ollama local: necesita modelo, usa su URL y no manda clave', async () => {
  reset();
  assert.equal(ai.configurado(ai.proveedor('ollama')), false);
  ai.setOllama({ url: 'http://192.168.1.20:11434/v1/', modelo: 'qwen2.5:7b' });
  assert.equal(ai.configurado(ai.proveedor('ollama')), true);
  let visto;
  handler = async (u, init) => { visto = { u, init }; return openai('{"ok":true}'); };
  await ai.chat(msgs);
  assert.equal(visto.u, 'http://192.168.1.20:11434/v1/chat/completions');
  assert.equal(visto.init.headers.Authorization, undefined);
  assert.equal(JSON.parse(visto.init.body).model, 'qwen2.5:7b');
});

test('probar() devuelve el modelo y detecta respuestas fuera de formato', async () => {
  reset(); ai.setClave('groq', 'gsk_x');
  handler = async (u) => (u.endsWith('/models') ? json({ data: [] }) : openai('{"ok":true}'));
  assert.equal(await ai.probar('groq'), 'llama-3.3-70b-versatile');
  handler = async (u) => (u.endsWith('/models') ? json({ data: [] }) : openai('hola, ¿en qué te ayudo?'));
  ai.setClave('groq', 'gsk_x');
  await assert.rejects(() => ai.probar('groq'), (e) => e.code === 'http');
  await assert.rejects(() => ai.probar('mistral'), (e) => e.code === 'nokey');
});

test('setClave de Groq conserva la llave antigua (compatibilidad)', () => {
  reset(); ai.setClave('groq', 'gsk_abc');
  assert.equal(localStorage.getItem('feynman.groqKey'), 'gsk_abc');
});
