// Capa de IA con varios proveedores y respaldo automático:
// si uno llega a su límite (o falla), la app usa el siguiente que tengas disponible.
// En la nube (gratis): Groq, Gemini, Cerebras, Mistral, OpenRouter. Sin internet: Ollama (tu computador) y la IA dentro de la app.
// Todos los datos (claves, modelos) quedan solo en este dispositivo.
import { chatLocal, localListo, calentarLocal } from './local.js';
import { ESQ_PRUEBA } from './esquemas.js';

export class AiError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

const MIN = 60 * 1000;
const NO_CHAT = /embed|moderation|ocr|whisper|tts|guard|orpheus|playai|transcribe|rerank|safety|image|vision-only/i;
const SOLO_ESPANOL = '\n\nIMPORTANTE: responde únicamente en español (alfabeto latino), sin otros idiomas ni caracteres extraños, y solo con el JSON pedido.';

// Orden = prioridad. "pref" ordena los modelos descubiertos; "defecto" se usa si no se puede listar.
export const PROVEEDORES = [
  { id: 'groq', nombre: 'Groq', tipo: 'openai', base: 'https://api.groq.com/openai/v1', clave: true, prefijo: 'gsk_',
    pref: [/llama-3\.3-70b-versatile/, /gpt-oss-120b/, /llama-3\.1-8b-instant/, /gpt-oss-20b/], defecto: ['llama-3.3-70b-versatile', 'openai/gpt-oss-120b', 'llama-3.1-8b-instant'],
    rol: 'Principal', desc: 'Muy rápida y gratis. Límite diario de uso.', url: 'console.groq.com', pasos: 'Crea una cuenta gratis, entra a “API Keys” y crea una clave.' },
  { id: 'gemini', nombre: 'Gemini (Google)', tipo: 'gemini', base: 'https://generativelanguage.googleapis.com/v1beta', clave: true, prefijo: 'AI',
    pref: [/gemini-2\.5-flash$/, /gemini-flash-latest/, /gemini-2\.0-flash$/, /gemini-.*flash(?!.*lite)/], defecto: ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-2.0-flash'],
    rol: 'Respaldo recomendado', desc: 'Gratis con límites muy generosos. Excelente en español.', url: 'aistudio.google.com/apikey', pasos: 'Entra con tu cuenta de Google y pulsa “Create API key”.' },
  { id: 'cerebras', nombre: 'Cerebras', tipo: 'openai', base: 'https://api.cerebras.ai/v1', clave: true, prefijo: 'csk-',
    pref: [/gpt-oss-120b/, /llama-?3\.3-70b/, /qwen-?3-235b/, /llama/], defecto: ['gpt-oss-120b', 'llama-3.3-70b'],
    rol: 'Respaldo', desc: 'Gratis y ultra rápida.', url: 'cloud.cerebras.ai', pasos: 'Crea una cuenta gratis y genera una API key.' },
  { id: 'mistral', nombre: 'Mistral', tipo: 'openai', base: 'https://api.mistral.ai/v1', clave: true, prefijo: '',
    pref: [/mistral-large-latest/, /mistral-medium-latest/, /mistral-small-latest/, /^open-mistral/], defecto: ['mistral-small-latest', 'mistral-large-latest'],
    rol: 'Respaldo', desc: 'Plan gratuito “Experiment”. Buen español jurídico.', url: 'console.mistral.ai', pasos: 'Crea una cuenta, elige el plan gratuito Experiment y crea una API key.' },
  { id: 'openrouter', nombre: 'OpenRouter', tipo: 'openai', base: 'https://openrouter.ai/api/v1', clave: true, prefijo: 'sk-or-', soloGratis: true,
    pref: [/gemma-4-31b/, /nemotron-3-super/, /gemma-4-26b/, /minimax/, /llama-3\.3-70b/, /deepseek/, /qwen/], defecto: ['google/gemma-4-31b-it:free'],
    rol: 'Respaldo (muchos modelos)', desc: 'Usa modelos gratuitos (:free) de varias empresas. Algo más lenta.', url: 'openrouter.ai/keys', pasos: 'Crea una cuenta gratis y una clave en “Keys”.' },
  { id: 'ollama', nombre: 'Ollama (tu computador)', tipo: 'ollama', local: true, auto: true, maxChars: 9000,
    pref: [/qwen2\.5.*(32b|14b|7b)/, /llama3\.[123]/, /gemma[23]/, /qwen|mistral|phi/],
    rol: 'Automática, sin internet', desc: 'Corre en tu propio computador: gratis, privado y sin límites. Se detecta sola cuando Ollama está abierto. Más lenta y menos precisa que las de la nube.', url: 'ollama.com', pasos: 'Instala Ollama y ejecuta “ollama pull qwen2.5:7b” una vez.' },
  { id: 'local', nombre: 'IA dentro de la app', tipo: 'webllm', local: true, maxChars: 6500,
    rol: 'Sin internet, para todos', desc: 'Una IA que se descarga una sola vez y corre en este dispositivo, sin cuentas ni claves. Necesita un computador o tablet reciente con WebGPU.', url: '', pasos: '' },
];
export const proveedor = (id) => PROVEEDORES.find((p) => p.id === id);

// ---- Configuración local ----
const ls = { get: (k) => { try { return localStorage.getItem(k) || ''; } catch { return ''; } }, set: (k, v) => { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch { /* sin almacenamiento */ } } };
const kClave = (id) => (id === 'groq' ? 'feynman.groqKey' : `feynman.key.${id}`); // groq conserva su llave antigua
const kModelo = (id) => `feynman.model.${id}`;
export const getClave = (id) => ls.get(kClave(id)).trim();
export const setClave = (id, v) => { ls.set(kClave(id), String(v || '').trim()); ls.set(kModelo(id), ''); enfriar.delete(id); };

export const getOllama = () => ({ url: (ls.get('feynman.ollamaUrl') || 'http://localhost:11434').replace(/\/+$/, '').replace(/\/v1$/, ''), modelo: ls.get('feynman.ollamaModel'), apagada: ls.get('feynman.ollamaOff') === '1' });
export const setOllama = ({ url, modelo, apagada }) => {
  if (url !== undefined) ls.set('feynman.ollamaUrl', String(url || '').trim());
  if (modelo !== undefined) ls.set('feynman.ollamaModel', String(modelo || '').trim());
  if (apagada !== undefined) ls.set('feynman.ollamaOff', apagada ? '1' : '');
  det.ollama = { ok: false, modelo: '', modelos: [], hasta: 0 };
};
export const getLocalesPrimero = () => ls.get('feynman.localesPrimero') === '1';
export const setLocalesPrimero = (v) => ls.set('feynman.localesPrimero', v ? '1' : '');

export const configurado = (p) => (p.id === 'ollama' ? det.ollama.ok : p.id === 'local' ? localListo() : !!getClave(p.id));
export const hayIA = () => PROVEEDORES.some(configurado);
export const proveedoresConfigurados = () => PROVEEDORES.filter(configurado);

// ---- Detección automática de Ollama ----
const det = { ollama: { ok: false, modelo: '', modelos: [], hasta: 0 } };
export const estadoOllama = () => det.ollama;
function mejorModelo(nombres) {
  const p = proveedor('ollama');
  for (const r of p.pref) { const m = nombres.find((n) => r.test(n)); if (m) return m; }
  return nombres[0] || '';
}
export async function detectarOllama(forzar = false) {
  const ahora = Date.now();
  const { url, modelo: pedido, apagada } = getOllama();
  if (apagada) { det.ollama = { ok: false, modelo: '', modelos: [], hasta: ahora + MIN }; return false; }
  if (!forzar && ahora < det.ollama.hasta) return det.ollama.ok;
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 1500);
  try {
    const r = await fetch(`${url}/api/tags`, { signal: ac.signal });
    const j = await r.json();
    const nombres = (j.models || []).map((m) => m.name).filter((n) => !/embed/i.test(n));
    const elegido = nombres.includes(pedido) ? pedido : mejorModelo(nombres);
    det.ollama = { ok: !!elegido, modelo: elegido, modelos: nombres, hasta: ahora + MIN };
  } catch { det.ollama = { ok: false, modelo: '', modelos: [], hasta: ahora + 30 * 1000 }; } finally { clearTimeout(t); }
  return det.ollama.ok;
}

// ---- Transporte ----
const enfriar = new Map(); // proveedor → hasta cuándo se evita (límite alcanzado)
let ultimo = null;
export const ultimoUsado = () => ultimo;

async function http(p, url, init, signal) {
  try { return await fetch(url, { ...init, signal }); } catch (e) {
    if (e?.name === 'AbortError') throw e;
    throw new AiError('offline', p.id === 'ollama' ? `No pude conectar con Ollama en ${getOllama().url}. ¿Está abierto?` : `No hay conexión con ${p.nombre}. Revisa tu internet.`);
  }
}
const detalle = async (res) => { try { const j = await res.json(); const m = j?.error?.message || j?.error || j?.message || j?.detail; return m ? ` ${typeof m === 'string' ? m : JSON.stringify(m)}`.slice(0, 220) : ''; } catch { return ''; } };
const errorDe = async (p, res) => {
  if (res.status === 401 || (p.id === 'gemini' && (res.status === 403 || res.status === 400) && /api key|permission|credential/i.test(await detalle(res.clone())))) return new AiError('badkey', `La clave de ${p.nombre} no es válida. Revísala en Ajustes.`);
  if (res.status === 429) return new AiError('limit', `${p.nombre} llegó a su límite gratuito.`);
  return new AiError('http', `${p.nombre} respondió con error (${res.status}).${await detalle(res)}`);
};

function ordenar(p, ids) {
  const utiles = ids.filter((id) => !NO_CHAT.test(id));
  const rank = (id) => { const i = p.pref.findIndex((r) => r.test(id)); return i < 0 ? 99 : i; };
  return [...utiles].sort((a, b) => rank(a) - rank(b));
}

async function listar(p, signal) {
  const headers = p.tipo === 'gemini' ? { 'x-goog-api-key': getClave(p.id) } : { Authorization: `Bearer ${getClave(p.id)}` };
  const res = await http(p, p.tipo === 'gemini' ? `${p.base}/models?pageSize=200` : `${p.base}/models`, { headers }, signal).catch(() => null);
  if (!res?.ok) return [...p.defecto];
  const j = await res.json().catch(() => ({}));
  let ids;
  if (p.tipo === 'gemini') ids = (j.models || []).filter((m) => (m.supportedGenerationMethods || []).includes('generateContent')).map((m) => m.name.replace(/^models\//, ''));
  else {
    let data = j.data || [];
    if (p.soloGratis) data = data.filter((m) => m.id.endsWith(':free') && (m.supported_parameters || []).includes('response_format'));
    ids = data.filter((m) => m.active !== false).map((m) => m.id);
  }
  const orden = ordenar(p, ids);
  return orden.length ? orden : [...p.defecto];
}

async function llamarOpenAI(p, modelo, messages, signal, conJson = true) {
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${getClave(p.id)}` };
  const body = { model: modelo, temperature: 0.2, messages, ...(conJson ? { response_format: { type: 'json_object' } } : {}) };
  return http(p, `${p.base}/chat/completions`, { method: 'POST', headers, body: JSON.stringify(body) }, signal);
}

async function llamarGemini(p, modelo, messages, signal) {
  const sistema = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
  const body = {
    ...(sistema ? { systemInstruction: { parts: [{ text: sistema }] } } : {}),
    contents: messages.filter((m) => m.role !== 'system').map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
    generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
  };
  return http(p, `${p.base}/models/${modelo}:generateContent`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': getClave(p.id) }, body: JSON.stringify(body) }, signal);
}

// Los modelos locales son chicos: se les recorta el texto largo y se refuerza el idioma.
function paraLocal(p, messages) {
  return messages.map((m, i) => {
    if (m.role === 'system') return { ...m, content: m.content + SOLO_ESPANOL };
    return m.content.length > p.maxChars ? { ...m, content: m.content.slice(0, p.maxChars) + '\n[…texto recortado por límite de memoria]' } : m;
  }).map((m, i, a) => (i === a.length - 1 && !a.some((x) => x.role === 'system') ? { ...m, content: m.content + SOLO_ESPANOL } : m));
}

async function textoDe(p, res) {
  const j = await res.json();
  if (p.tipo === 'gemini') return (j?.candidates?.[0]?.content?.parts || []).map((x) => x.text || '').join('');
  if (p.tipo === 'ollama') return j?.message?.content ?? '';
  return j?.choices?.[0]?.message?.content ?? '';
}

// Una consulta a UN proveedor, probando otros modelos de su lista si el elegido no existe o no está permitido.
async function consultar(p, messages, signal, esquema, rapido) {
  if (p.tipo === 'webllm') {
    try { return await chatLocal(paraLocal(p, messages), signal, esquema, rapido); } catch (e) {
      if (e?.name === 'AbortError') throw e;
      throw new AiError('http', `La IA dentro de la app falló: ${String(e?.message || e).slice(0, 160)}`);
    }
  }
  if (p.tipo === 'ollama') {
    const modelo = det.ollama.modelo || getOllama().modelo;
    if (!modelo) throw new AiError('nokey', 'Ollama no tiene ningún modelo instalado.');
    const { url } = getOllama();
    const body = { model: modelo, stream: false, format: esquema || 'json', keep_alive: '30m', options: rapido ? { temperature: 0, num_ctx: 4096, num_predict: 700 } : { temperature: 0.2, num_ctx: 8192 }, messages: paraLocal(p, messages) };
    const res = await http(p, `${url}/api/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }, signal);
    if (!res.ok) throw await errorDe(p, res);
    return textoDe(p, res);
  }
  const cache = ls.get(kModelo(p.id));
  let candidatos = cache ? [cache] : await listar(p, signal);
  let descubierto = !cache;
  let ultimoRes = null;
  for (let i = 0; i < candidatos.length; i++) {
    const m = candidatos[i];
    let res = p.tipo === 'gemini' ? await llamarGemini(p, m, messages, signal) : await llamarOpenAI(p, m, messages, signal);
    // Algunos modelos no aceptan modo JSON: reintentar sin él (el parseo tolera texto alrededor).
    if (p.tipo === 'openai' && (res.status === 400 || res.status === 422) && /response_format|json/i.test(await detalle(res.clone()))) res = await llamarOpenAI(p, m, messages, signal, false);
    if (res.ok) { ls.set(kModelo(p.id), m); return textoDe(p, res); }
    ultimoRes = res;
    if ([404, 400, 403, 422].includes(res.status) && !(p.id === 'gemini' && /api key/i.test(await detalle(res.clone())))) {
      if (!descubierto) { candidatos = [...new Set([...candidatos, ...(await listar(p, signal))])]; descubierto = true; }
      if (i < candidatos.length - 1) continue;
    }
    break;
  }
  throw await errorDe(p, ultimoRes);
}

// Consulta con respaldo automático entre proveedores.
// rapido = respuestas cortas y deterministas (evaluar una explicación): menos contexto y tope de palabras.
export async function chat(messages, { signal, esquema, rapido } = {}) {
  await detectarOllama();
  const lista = proveedoresConfigurados();
  if (!lista.length) throw new AiError('nokey', 'Falta conectar una IA. Pega una clave gratis en Ajustes.');
  const sinInternet = typeof navigator !== 'undefined' && navigator.onLine === false;
  const nube = lista.filter((p) => !p.local);
  const locales = lista.filter((p) => p.local);
  let orden = (getLocalesPrimero() || sinInternet) ? [...locales, ...nube] : [...nube, ...locales];
  if (sinInternet && locales.length) orden = orden.filter((p) => p.local); // sin internet la nube ni se intenta
  const ahora = Date.now();
  orden = [...orden.filter((p) => (enfriar.get(p.id) || 0) <= ahora), ...orden.filter((p) => (enfriar.get(p.id) || 0) > ahora)];
  const fallos = [];
  for (const p of orden) {
    try {
      const out = await consultar(p, messages, signal, esquema, rapido);
      ultimo = p.id;
      return out;
    } catch (e) {
      if (e?.name === 'AbortError') throw e;
      if (!(e instanceof AiError)) throw e;
      fallos.push({ p, e });
      if (e.code === 'limit') enfriar.set(p.id, Date.now() + 10 * MIN);
    }
  }
  if (fallos.length === 1) throw fallos[0].e;
  const code = fallos.some((f) => f.e.code === 'limit') ? 'limit' : fallos[0].e.code;
  throw new AiError(code, `No pude usar ninguna IA. ${fallos.map((f) => f.e.message).join(' ')}`);
}

// Prueba un proveedor concreto (botón "Guardar y probar" de Ajustes).
export async function probar(id) {
  const p = proveedor(id);
  if (p.id === 'ollama') { if (!(await detectarOllama(true))) throw new AiError('offline', `No encuentro Ollama en ${getOllama().url}. Ábrelo y revisa que tenga un modelo instalado.`); }
  else if (!configurado(p)) throw new AiError('nokey', 'Pega la clave primero.');
  const out = await consultar(p, [{ role: 'user', content: 'Responde solo este JSON: {"ok":true}' }], undefined, ESQ_PRUEBA);
  const a = out.indexOf('{'), b = out.lastIndexOf('}');
  let ok = false;
  try { ok = JSON.parse(out.slice(a, b + 1)).ok === true; } catch { /* respuesta no JSON */ }
  if (!ok) throw new AiError('http', `${p.nombre} respondió, pero no en el formato esperado. Prueba con otro modelo.`);
  enfriar.delete(id);
  ultimo = id;
  return p.id === 'ollama' ? det.ollama.modelo : ls.get(kModelo(id));
}

// Deja la IA local "caliente" antes de usarla (cargar el modelo en memoria es lo que más demora la primera vez).
export async function calentar() {
  try {
    if (await detectarOllama()) {
      const { url } = getOllama();
      fetch(`${url}/api/generate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: det.ollama.modelo, keep_alive: '30m' }) }).catch(() => {});
    } else if (localListo()) calentarLocal().catch(() => {});
  } catch { /* calentar es opcional */ }
}
