import { extraerJson, parseEvaluacion } from './grade.js';

const URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.3-70b-versatile';
const KEY = 'feynman.groqKey';

export const getKey = () => { try { return (localStorage.getItem(KEY) || '').trim(); } catch { return ''; } };
export const setKey = (k) => { try { localStorage.setItem(KEY, k.trim()); } catch { /* sin almacenamiento */ } };

export class AiError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

async function chat(messages, { signal } = {}) {
  const key = getKey();
  if (!key) throw new AiError('nokey', 'Falta la clave de Groq. Pégala en Ajustes.');
  let res;
  try {
    res = await fetch(URL, {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: MODEL, temperature: 0.2, response_format: { type: 'json_object' }, messages }),
    });
  } catch (e) {
    if (e?.name === 'AbortError') throw e;
    throw new AiError('offline', 'No hay conexión con la IA. Revisa tu internet e intenta de nuevo.');
  }
  if (res.status === 401) throw new AiError('badkey', 'La clave de Groq no es válida. Revísala en Ajustes.');
  if (res.status === 429) throw new AiError('limit', 'Llegaste al límite gratuito de Groq. Espera un minuto e intenta de nuevo.');
  if (!res.ok) throw new AiError('http', `La IA respondió con error (${res.status}). Intenta de nuevo.`);
  const data = await res.json();
  return data?.choices?.[0]?.message?.content ?? '';
}

export async function probarClave() {
  const out = await chat([{ role: 'user', content: 'Responde solo este JSON: {"ok":true}' }]);
  if (extraerJson(out)?.ok !== true) throw new AiError('http', 'La IA no respondió como se esperaba.');
}

const SYS_CONCEPTOS = `Eres un ayudante de estudio. Del texto que te doy, extrae los CONCEPTOS importantes que un estudiante debe saber explicar (definiciones, instituciones, principios, procesos). Responde SOLO JSON: {"conceptos":[{"nombre":"...","referencia":"..."}]}.
Reglas: máximo 12 conceptos por texto; "nombre" corto (2 a 6 palabras); "referencia" = lo que dice el texto sobre ese concepto, fiel y completo, 2 a 6 frases, sin inventar nada. Si el texto no tiene conceptos, devuelve {"conceptos":[]}. Español.`;

export async function conceptosDeTexto(texto, opts) {
  const out = await chat([{ role: 'system', content: SYS_CONCEPTOS }, { role: 'user', content: texto }], opts);
  const lista = extraerJson(out)?.conceptos;
  if (!Array.isArray(lista)) return [];
  return lista
    .map((c) => ({ nombre: String(c?.nombre ?? '').trim(), referencia: String(c?.referencia ?? '').trim() }))
    .filter((c) => c.nombre && c.referencia);
}

const SYS_EVAL = `Eres un profesor exigente pero justo. Te doy el MATERIAL de referencia de un concepto y la EXPLICACIÓN de un estudiante. Descompón el material en 4 a 8 IDEAS CLAVE y clasifica cada una según la explicación:
- "bien": la explicó correctamente (aunque con otras palabras).
- "parcial": la mencionó incompleta o imprecisa.
- "falta": no la mencionó.
- "incorrecto": dijo algo que contradice el material o es falso.
Responde SOLO JSON: {"ideas":[{"idea":"idea clave en una frase","estado":"bien|parcial|falta|incorrecto","dijiste":"cita corta de lo que dijo el estudiante (solo si estado es incorrecto o parcial; si no, vacío)","comentario":"explicación breve: por qué está bien, qué faltó o por qué es incorrecto y cuál es lo correcto según el material"}],"resumen":"una frase de balance"}.
Reglas: juzga SOLO con el material dado, no con tu conocimiento externo; no premies relleno; no inventes ideas que no estén en el material; español.`;

export async function evaluarExplicacion(referencia, explicacion, opts) {
  const user = `MATERIAL:\n${referencia}\n\nEXPLICACIÓN DEL ESTUDIANTE:\n${explicacion}`;
  const out = await chat([{ role: 'system', content: SYS_EVAL }, { role: 'user', content: user }], opts);
  return parseEvaluacion(out);
}
