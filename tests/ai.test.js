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

test('Ollama: se detecta sola, elige el mejor modelo y usa la API nativa con num_ctx y JSON', async () => {
  reset(); ai.setOllama({ url: '', modelo: '', apagada: false });
  assert.equal(ai.configurado(ai.proveedor('ollama')), false);
  handler = async (u, init) => {
    if (u.endsWith('/api/tags')) return json({ models: [{ name: 'nomic-embed-text:latest' }, { name: 'phi3:mini' }, { name: 'qwen2.5:7b-instruct-q4_K_M' }] });
    if (u.endsWith('/api/chat')) return json({ message: { content: '{"ok":true}' } });
    return json({}, 404);
  };
  assert.equal(await ai.detectarOllama(true), true);
  assert.equal(ai.estadoOllama().modelo, 'qwen2.5:7b-instruct-q4_K_M'); // ni embedding ni el más chico
  assert.equal(ai.configurado(ai.proveedor('ollama')), true);
  assert.equal(await ai.chat(msgs), '{"ok":true}');
  const c = llamadas.find((l) => l.url.endsWith('/api/chat'));
  assert.equal(c.url, 'http://localhost:11434/api/chat');
  assert.equal(c.body.format, 'json');
  assert.equal(c.body.stream, false);
  assert.equal(c.body.options.num_ctx, 8192);
  assert.match(c.body.messages[0].content, /español/); // refuerzo de idioma para modelos chicos
  assert.equal(ai.ultimoUsado(), 'ollama');
});

test('Ollama: sin servidor no se detecta (y no rompe nada); se puede apagar', async () => {
  reset(); ai.setOllama({ url: '', modelo: '', apagada: false });
  handler = async () => { throw new TypeError('connection refused'); };
  assert.equal(await ai.detectarOllama(true), false);
  assert.equal(ai.hayIA(), false);
  handler = async (u) => json({ models: [{ name: 'llama3.2:3b' }] });
  assert.equal(await ai.detectarOllama(true), true);
  ai.setOllama({ apagada: true });
  assert.equal(await ai.detectarOllama(true), false); // apagada: ni se consulta
  ai.setOllama({ apagada: false });
});

test('Ollama: respeta el modelo pedido y con URL /v1 antigua la corrige', async () => {
  reset(); ai.setOllama({ url: 'http://192.168.1.20:11434/v1/', modelo: 'gemma2:9b', apagada: false });
  assert.equal(ai.getOllama().url, 'http://192.168.1.20:11434');
  let pedido;
  handler = async (u) => { pedido = u; return json({ models: [{ name: 'qwen2.5:7b' }, { name: 'gemma2:9b' }] }); };
  await ai.detectarOllama(true);
  assert.equal(pedido, 'http://192.168.1.20:11434/api/tags');
  assert.equal(ai.estadoOllama().modelo, 'gemma2:9b');
  ai.setOllama({ url: '', modelo: '' });
});

test('nube con límite + Ollama detectada: cae a Ollama automáticamente', async () => {
  reset(); ai.setOllama({ url: '', modelo: '', apagada: false }); ai.setClave('groq', 'gsk_x');
  handler = async (u) => {
    if (u.includes('groq.com')) return u.endsWith('/models') ? json({ data: [] }) : json({}, 429);
    if (u.endsWith('/api/tags')) return json({ models: [{ name: 'qwen2.5:7b' }] });
    return json({ message: { content: '{"de":"ollama"}' } });
  };
  await ai.detectarOllama(true);
  assert.equal(await ai.chat(msgs), '{"de":"ollama"}');
  assert.equal(ai.ultimoUsado(), 'ollama');
});

test('"Usar primero las locales": Ollama va antes que la nube', async () => {
  reset(); ai.setOllama({ url: '', modelo: '', apagada: false }); ai.setClave('groq', 'gsk_x'); ai.setLocalesPrimero(true);
  handler = async (u) => (u.endsWith('/api/tags') ? json({ models: [{ name: 'qwen2.5:7b' }] }) : u.endsWith('/api/chat') ? json({ message: { content: '{"ok":true}' } }) : json({ error: {} }, 500));
  await ai.detectarOllama(true);
  await ai.chat(msgs);
  assert.equal(ai.ultimoUsado(), 'ollama');
  assert.equal(llamadas.filter((l) => l.url.includes('groq.com')).length, 0);
  ai.setLocalesPrimero(false);
});

test('IA dentro de la app: se considera lista solo si el modelo ya se descargó', () => {
  reset();
  assert.equal(ai.configurado(ai.proveedor('local')), false);
  localStorage.setItem('feynman.local', 'listo');
  assert.equal(ai.configurado(ai.proveedor('local')), true);
  localStorage.removeItem('feynman.local');
});

test('recorte de texto largo para modelos locales', async () => {
  reset(); ai.setOllama({ url: '', modelo: '', apagada: false });
  let enviado;
  handler = async (u, init) => { if (u.endsWith('/api/tags')) return json({ models: [{ name: 'qwen2.5:7b' }] }); enviado = JSON.parse(init.body); return json({ message: { content: '{}' } }); };
  await ai.detectarOllama(true);
  await ai.chat([{ role: 'system', content: 'sys' }, { role: 'user', content: 'x'.repeat(20000) }]);
  const usuario = enviado.messages.find((m) => m.role === 'user').content;
  assert.ok(usuario.length < 9500 && /recortado/.test(usuario));
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
