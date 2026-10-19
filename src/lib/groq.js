import { extraerJson, parseEvaluacion } from './grade.js';
import { chat, AiError } from './ai.js';
import { ESQ_CONCEPTOS, ESQ_EVALUACION, ESQ_TIPO } from './esquemas.js';

// Tareas de estudio (conceptos, evaluación, pruebas). La conexión con las IAs y el respaldo automático están en ai.js.
export { AiError };

const sysConceptos = (max) => `Eres un ayudante de estudio. Del texto que te doy, extrae los CONCEPTOS importantes que un estudiante debe saber explicar (definiciones, instituciones, principios, procesos). Responde SOLO JSON: {"conceptos":[{"nombre":"...","referencia":"..."}]}.
Reglas: máximo ${max} conceptos por texto (elige solo los MÁS importantes, no repitas ni incluyas detalles menores); "nombre" corto (2 a 6 palabras); "referencia" = lo que dice el texto sobre ese concepto, fiel y completo, 2 a 6 frases, sin inventar nada. Si el texto no tiene conceptos, devuelve {"conceptos":[]}. Español.`;

export async function conceptosDeTexto(texto, opts, max = 12) {
  const out = await chat([{ role: 'system', content: sysConceptos(max) }, { role: 'user', content: texto }], { ...opts, esquema: ESQ_CONCEPTOS });
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
  const out = await chat([{ role: 'system', content: SYS_EVAL }, { role: 'user', content: user }], { ...opts, esquema: ESQ_EVALUACION });
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
  const out = await chat([{ role: 'system', content: SYS_TIPO[tipo](n) }, { role: 'user', content: `MATERIAL:\n${material}` }], { ...opts, esquema: ESQ_TIPO[tipo] });
  return extraerJson(out);
}

// Corrige una respuesta de desarrollo contra la pauta (misma salida que evaluarExplicacion).
export function corregirDesarrollo(pregunta, respuesta, opts) {
  const ref = `PREGUNTA: ${pregunta.enunciado}\nIDEAS QUE DEBE CONTENER UNA BUENA RESPUESTA (pauta):\n${pregunta.pauta.map((p) => `- ${p}`).join('\n')}`;
  return evaluarExplicacion(ref, respuesta, opts);
}
