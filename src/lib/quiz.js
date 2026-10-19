import { notaDePuntaje, puntajeDeIdeas } from './grade.js';

// Pruebas: validación de lo que devuelve la IA, barajado de alternativas y cálculo de nota.
export const TIPOS = ['alternativas', 'vf', 'desarrollo'];
export const PUNTOS = { alternativas: 1, vf: 1, desarrollo: 3 };
export const NOMBRES = { alternativas: 'Alternativas', vf: 'Verdadero o falso', desarrollo: 'Desarrollo' };
export const MAX_PREGUNTAS = 25;

export const totalPlan = (plan) => TIPOS.reduce((n, t) => n + (plan[t] || 0), 0);
export const planValido = (plan) => { const n = totalPlan(plan); return n >= 1 && n <= MAX_PREGUNTAS && TIPOS.every((t) => Number.isInteger(plan[t] || 0) && (plan[t] || 0) >= 0); };

// Presets: una sola modalidad o mixto.
export function presetPlan(preset, total = 10) {
  if (preset === 'mixto') {
    const des = Math.max(1, Math.round(total * 0.2));
    const vf = Math.round(total * 0.3);
    return { alternativas: Math.max(0, total - des - vf), vf, desarrollo: des };
  }
  return { alternativas: 0, vf: 0, desarrollo: 0, [preset]: total };
}

function barajar(arr, rnd = Math.random) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

const texto = (v) => String(v ?? '').trim();
const bool = (v) => {
  if (typeof v === 'boolean') return v;
  const s = texto(v).toLowerCase();
  if (['verdadero', 'verdadera', 'true', 'v', 'si', 'sí'].includes(s)) return true;
  if (['falso', 'falsa', 'false', 'f', 'no'].includes(s)) return false;
  return null;
};

// Convierte lo que devolvió la IA para un tipo en preguntas válidas (descarta las defectuosas).
export function normalizarPreguntas(tipo, crudo, { rnd = Math.random, nuevoId = () => Math.random().toString(36).slice(2, 10) } = {}) {
  const lista = Array.isArray(crudo?.preguntas) ? crudo.preguntas : [];
  const out = [];
  for (const q of lista) {
    const enunciado = texto(q?.enunciado);
    if (enunciado.length < 10) continue;
    const base = { id: nuevoId(), tipo, enunciado, explicacion: texto(q?.explicacion), concepto: texto(q?.concepto) };
    if (tipo === 'alternativas') {
      const ops = (Array.isArray(q?.opciones) ? q.opciones : []).map(texto).filter(Boolean).slice(0, 5);
      const c = Number.isInteger(q?.correcta) ? q.correcta : parseInt(q?.correcta, 10);
      if (ops.length < 3 || new Set(ops.map((o) => o.toLowerCase())).size !== ops.length || !(c >= 0 && c < ops.length)) continue;
      const orden = barajar(ops.map((_, i) => i), rnd);
      out.push({ ...base, opciones: orden.map((i) => ops[i]), correcta: orden.indexOf(c) });
    } else if (tipo === 'vf') {
      const c = bool(q?.correcta);
      if (c === null) continue;
      out.push({ ...base, correcta: c });
    } else {
      const pauta = (Array.isArray(q?.pauta) ? q.pauta : texto(q?.pauta).split(/\n|;/)).map(texto).filter(Boolean);
      if (pauta.length < 2) continue;
      out.push({ ...base, pauta });
    }
  }
  return out;
}

// Puntos obtenidos en una pregunta. Devuelve null si es un desarrollo aún sin corregir.
export function puntosDe(p, respuesta, evaluacion) {
  const max = PUNTOS[p.tipo];
  if (p.tipo === 'desarrollo') {
    if (!texto(respuesta)) return { puntos: 0, max };
    if (!evaluacion) return null;
    return { puntos: Math.round((puntajeDeIdeas(evaluacion.ideas) / 100) * max * 100) / 100, max };
  }
  return { puntos: respuesta === p.correcta && respuesta !== undefined ? max : 0, max };
}

// Resultado global de la prueba. Si hay desarrollos sin corregir, nota = null.
export function calcularPrueba(prueba) {
  let puntos = 0; let total = 0; let pendientes = 0;
  const porTipo = Object.fromEntries(TIPOS.map((t) => [t, { puntos: 0, max: 0, n: 0, buenas: 0 }]));
  for (const p of prueba.preguntas) {
    const r = puntosDe(p, prueba.respuestas?.[p.id], prueba.evaluaciones?.[p.id]);
    total += PUNTOS[p.tipo];
    porTipo[p.tipo].max += PUNTOS[p.tipo]; porTipo[p.tipo].n += 1;
    if (r === null) { pendientes += 1; continue; }
    puntos += r.puntos; porTipo[p.tipo].puntos += r.puntos;
    if (r.puntos >= r.max * 0.999) porTipo[p.tipo].buenas += 1;
  }
  const porcentaje = total ? (puntos / total) * 100 : 0;
  return { puntos: Math.round(puntos * 100) / 100, total, porcentaje, nota: pendientes ? null : notaDePuntaje(porcentaje), pendientes, porTipo };
}

export const contestadas = (prueba) => prueba.preguntas.filter((p) => { const r = prueba.respuestas?.[p.id]; return p.tipo === 'desarrollo' ? !!texto(r) : r !== undefined && r !== null; }).length;

// Material para la IA: conceptos con su referencia, hasta ~maxChars, repartidos entre los PDFs elegidos.
export function armarMaterial(docs, maxChars = 12000, rnd = Math.random) {
  const todos = docs.flatMap((d) => d.conceptos.map((c) => ({ ...c, doc: d.nombre })));
  const orden = barajar(todos, rnd);
  const elegidos = [];
  let n = 0;
  for (const c of orden) {
    const bloque = `## ${c.nombre}\n${c.referencia}`;
    if (n + bloque.length > maxChars && elegidos.length) continue;
    elegidos.push(bloque); n += bloque.length;
  }
  return { texto: elegidos.join('\n\n'), conceptos: elegidos.length, total: todos.length };
}

// ---- Paginación: la prueba se ve como hojas de papel ----
const PESO = { alternativas: 1, vf: 0.7, desarrollo: 2.4 };
const CAPACIDAD = 5;        // "unidades" por hoja
const CAPACIDAD_PRIMERA = 3.4; // la primera hoja lleva el encabezado

const pesoDe = (p) => {
  if (p.tipo === 'alternativas') { const largo = p.enunciado.length + (p.opciones || []).join('').length; return PESO.alternativas + (largo > 420 ? 0.5 : largo > 260 ? 0.2 : 0); }
  if (p.tipo === 'vf') return PESO.vf + (p.enunciado.length > 200 ? 0.3 : 0);
  return PESO.desarrollo;
};

// Reparte las preguntas (numeradas de corrido) en hojas; marca la primera pregunta de cada sección para poner su título.
export function paginar(preguntas) {
  const paginas = [];
  let actual = { preguntas: [] };
  let uso = 0;
  const vistos = new Set();
  preguntas.forEach((p, i) => {
    const w = pesoDe(p) + (vistos.has(p.tipo) ? 0 : 0.35);
    const cap = paginas.length === 0 ? CAPACIDAD_PRIMERA : CAPACIDAD;
    if (actual.preguntas.length && uso + w > cap) { paginas.push(actual); actual = { preguntas: [] }; uso = 0; }
    actual.preguntas.push({ p, n: i + 1, seccion: vistos.has(p.tipo) ? null : p.tipo });
    vistos.add(p.tipo);
    uso += w;
  });
  if (actual.preguntas.length) paginas.push(actual);
  return paginas;
}

export const ROMANO = ['I', 'II', 'III'];
export const INSTRUCCION = {
  alternativas: 'Marque con lápiz la alternativa correcta. Solo una es correcta.',
  vf: 'Indique si la afirmación es verdadera (V) o falsa (F).',
  desarrollo: 'Responda con sus palabras, de forma completa y ordenada.',
};
