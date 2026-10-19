import { extraerJson, parseEvaluacion } from './grade.js';

const BASE = 'https://api.groq.com/openai/v1';
const KEY = 'feynman.groqKey';
const MODEL_KEY = 'feynman.groqModel';
// Orden de preferencia; si el primero no está disponible para la cuenta, se prueba el siguiente.
const PREFERIDOS = ['llama-3.3-70b-versatile', 'openai/gpt-oss-120b', 'llama-3.1-8b-instant', 'openai/gpt-oss-20b'];

export const getKey = () => { try { return (localStorage.getItem(KEY) || '').trim(); } catch { return ''; } };
export const setKey = (k) => { try { localStorage.setItem(KEY, k.trim()); localStorage.removeItem(MODEL_KEY); } catch { /* sin almacenamiento */ } };
const getModel = () => { try { return localStorage.getItem(MODEL_KEY) || ''; } catch { return ''; } };
const setModel = (m) => { try { localStorage.setItem(MODEL_KEY, m); } catch { /* sin almacenamiento */ } };

export class AiError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

const detalle = async (res) => { try { const j = await res.json(); return j?.error?.message ? ` Groq dice: ${j.error.message}` : ''; } catch { return ''; } };

async function pedir(path, init) {
  const key = getKey();
  if (!key) throw new AiError('nokey', 'Falta la clave de Groq. Pégala en Ajustes.');
  try {
    return await fetch(BASE + path, { ...init, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` } });
  } catch (e) {
    if (e?.name === 'AbortError') throw e;
    throw new AiError('offline', 'No hay conexión con la IA. Revisa tu internet e intenta de nuevo.');
  }
}

// Modelos de chat que la cuenta puede usar, en orden de preferencia.
async function modelosDisponibles() {
  const res = await pedir('/models', { method: 'GET' });
  if (!res.ok) return [...PREFERIDOS];
  const ids = ((await res.json())?.data || []).filter((m) => m.active !== false).map((m) => m.id);
  const utiles = ids.filter((id) => !/whisper|tts|guard|prompt-guard|orpheus|playai|distil/i.test(id));
  const orden = [...PREFERIDOS.filter((p) => utiles.includes(p)), ...utiles.filter((id) => !PREFERIDOS.includes(id))];
  return orden.length ? orden : [...PREFERIDOS];
}

async function chatCon(model, messages, signal) {
  return pedir('/chat/completions', { method: 'POST', signal, body: JSON.stringify({ model, temperature: 0.2, response_format: { type: 'json_object' }, messages }) });
}

async function chat(messages, { signal } = {}) {
  let candidatos = [getModel() || PREFERIDOS[0]];
  let res;
  for (let i = 0; i < candidatos.length; i++) {
    res = await chatCon(candidatos[i], messages, signal);
    if (res.status === 404 || res.status === 400 || res.status === 403) {
      // Modelo inexistente o sin acceso para esta cuenta: probar con los que sí tiene.
      if (i === 0 && candidatos.length === 1) candidatos = [...new Set([...candidatos, ...(await modelosDisponibles())])];
      if (i < candidatos.length - 1) continue;
    }
    if (res.ok) setModel(candidatos[i]);
    break;
  }
  if (res.status === 401) throw new AiError('badkey', 'La clave de Groq no es válida. Revísala en Ajustes (debe empezar con gsk_).');
  if (res.status === 429) throw new AiError('limit', 'Llegaste al límite gratuito de Groq. Espera un minuto e intenta de nuevo.');
  if (!res.ok) throw new AiError('http', `La IA respondió con error (${res.status}).${await detalle(res)}`);
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

// ---- Pruebas ----
const REGLAS = `Eres profesor de Derecho en Chile y preparas pruebas para estudiantes de pregrado. Redacta con precisión jurídica y en español.
REGLAS GENERALES: usa SOLO la información del MATERIAL (no inventes artículos, plazos, cifras ni doctrina que no aparezca); cada pregunta evalúa un concepto distinto cuando sea posible; enunciados claros, sin ambigüedad ni trampas de redacción; incluye en "concepto" el nombre del concepto del material al que se refiere; "explicacion" justifica la respuesta correcta según el material en 1-3 frases.`;

const SYS_TIPO = {
  alternativas: (n) => `${REGLAS}
Crea EXACTAMENTE ${n} preguntas de ALTERNATIVAS (selección única). Cada una con 4 opciones plausibles y UNA sola correcta; los distractores deben ser errores típicos de estudiantes, no absurdos; evita "todas las anteriores" y "ninguna de las anteriores"; opciones de largo parecido.
Responde SOLO JSON: {"preguntas":[{"enunciado":"...","opciones":["...","...","...","..."],"correcta":0,"explicacion":"...","concepto":"..."}]} donde "correcta" es el índice (0-3) de la opción correcta.`,
  vf: (n) => `${REGLAS}
Crea EXACTAMENTE ${n} afirmaciones de VERDADERO O FALSO. Mezcla verdaderas y falsas en proporción parecida (las falsas deben ser errores sutiles pero claramente falsos según el material, p. ej. cambiar un requisito, un efecto o una condición); nada de "siempre/nunca" como única pista.
Responde SOLO JSON: {"preguntas":[{"enunciado":"afirmación","correcta":true,"explicacion":"si es falsa, indica cuál sería lo correcto","concepto":"..."}]}`,
  desarrollo: (n) => `${REGLAS}
Crea EXACTAMENTE ${n} preguntas de DESARROLLO (respuesta escrita de un párrafo o más), del tipo "Explique…", "Distinga…", "Señale los requisitos de…", "Analice…". Cada una con una "pauta": lista de 3 a 5 ideas clave que una buena respuesta debe contener, tomadas del material.
Responde SOLO JSON: {"preguntas":[{"enunciado":"...","pauta":["idea clave 1","idea clave 2","idea clave 3"],"concepto":"..."}]}`,
};

export async function generarPreguntasDeTipo(tipo, n, material, opts) {
  const out = await chat([{ role: 'system', content: SYS_TIPO[tipo](n) }, { role: 'user', content: `MATERIAL:\n${material}` }], opts);
  return extraerJson(out);
}

// Corrige una respuesta de desarrollo contra la pauta (misma salida que evaluarExplicacion).
export function corregirDesarrollo(pregunta, respuesta, opts) {
  const ref = `PREGUNTA: ${pregunta.enunciado}\nIDEAS QUE DEBE CONTENER UNA BUENA RESPUESTA (pauta):\n${pregunta.pauta.map((p) => `- ${p}`).join('\n')}`;
  return evaluarExplicacion(ref, respuesta, opts);
}
