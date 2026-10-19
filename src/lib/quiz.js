import { notaDePuntaje, puntajeDeIdeas } from './grade.js';

// Pruebas: validación de lo que devuelve la IA, barajado de alternativas y cálculo de nota.
export const TIPOS = ['alternativas', 'vf', 'desarrollo'];
export const PUNTOS = { alternativas: 1, vf: 1, desarrollo: 3, caso: 3 };
export const NOMBRES = { alternativas: 'Alternativas', vf: 'Verdadero o falso', desarrollo: 'Desarrollo', caso: 'Casos prácticos' };
export const MAX_PREGUNTAS = 25;
export const MAX_CASOS = 5;
export const POR_CASO = { min: 1, max: 6, defecto: 3 };

// Extensión del relato de cada caso práctico. Por defecto "breve" (la opción "plana"/"dos" es para quien la pida).
export const EXTENSIONES = {
  breve: { nombre: 'Breve (media plana)', palabras: '120 a 220', porLlamada: 5 },
  plana: { nombre: 'Una plana', palabras: '450 a 600', porLlamada: 2 },
  dos: { nombre: 'Dos planas', palabras: '900 a 1.100', porLlamada: 1 },
};
export const extensionDe = (plan) => (EXTENSIONES[plan?.extension] ? plan.extension : 'breve');
// Un relato largo no se repite entero en cada hoja: en las siguientes se muestra resumido y se puede releer.
export const esLargo = (caso) => caso.hechos.length > 1800;

// Secciones de la hoja: las preguntas de un caso práctico son de desarrollo, pero van en su propia parte.
export const SECCIONES = ['alternativas', 'vf', 'desarrollo', 'caso'];
export const seccionDe = (p) => (p.caso ? 'caso' : p.tipo);

// Preguntas de un plan: los casos cuentan por sus preguntas (casos × preguntas por caso).
export const preguntasPorCaso = (plan) => (plan.casos > 0 ? plan.porCaso || POR_CASO.defecto : 0);
export const totalPlan = (plan) => TIPOS.reduce((n, t) => n + (plan[t] || 0), 0) + (plan.casos || 0) * preguntasPorCaso(plan);
export const planValido = (plan) => {
  const n = totalPlan(plan);
  const ok = TIPOS.every((t) => Number.isInteger(plan[t] || 0) && (plan[t] || 0) >= 0);
  const casos = Number.isInteger(plan.casos || 0) && (plan.casos || 0) >= 0 && (plan.casos || 0) <= MAX_CASOS;
  const por = !plan.casos || (Number.isInteger(preguntasPorCaso(plan)) && preguntasPorCaso(plan) >= POR_CASO.min && preguntasPorCaso(plan) <= POR_CASO.max);
  const ext = !plan.casos || plan.extension === undefined || !!EXTENSIONES[plan.extension];
  return n >= 1 && n <= MAX_PREGUNTAS && ok && casos && por && ext;
};

// Presets: una sola modalidad o mixto.
export function presetPlan(preset, total = 10) {
  if (preset === 'mixto') {
    const des = Math.max(1, Math.round(total * 0.2));
    const vf = Math.round(total * 0.3);
    return { alternativas: Math.max(0, total - des - vf), vf, desarrollo: des, casos: 0, porCaso: POR_CASO.defecto };
  }
  if (preset === 'caso') return { alternativas: 0, vf: 0, desarrollo: 0, casos: Math.max(1, Math.min(MAX_CASOS, Math.round(total / 5))), porCaso: POR_CASO.defecto };
  return { alternativas: 0, vf: 0, desarrollo: 0, casos: 0, porCaso: POR_CASO.defecto, [preset]: total };
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
  const porTipo = Object.fromEntries(SECCIONES.map((t) => [t, { puntos: 0, max: 0, n: 0, buenas: 0 }]));
  for (const p of prueba.preguntas) {
    const r = puntosDe(p, prueba.respuestas?.[p.id], prueba.evaluaciones?.[p.id]);
    total += PUNTOS[p.tipo];
    const sec = porTipo[seccionDe(p)];
    sec.max += PUNTOS[p.tipo]; sec.n += 1;
    if (r === null) { pendientes += 1; continue; }
    puntos += r.puntos; sec.puntos += r.puntos;
    if (r.puntos >= r.max * 0.999) sec.buenas += 1;
  }
  const porcentaje = total ? (puntos / total) * 100 : 0;
  return { puntos: Math.round(puntos * 100) / 100, total, porcentaje, nota: pendientes ? null : notaDePuntaje(porcentaje), pendientes, porTipo };
}

export const contestadas = (prueba) => prueba.preguntas.filter((p) => { const r = prueba.respuestas?.[p.id]; return p.tipo === 'desarrollo' ? !!texto(r) : r !== undefined && r !== null; }).length;

// Clave estable de un concepto (los PDFs viejos y los de prueba pueden no tener id).
export const claveDe = (d, c) => c.id ?? `${d.nombre}|${c.nombre}`;

// Material para la IA: conceptos con su referencia, hasta ~maxChars. Empieza por los que NO se han practicado
// en pruebas anteriores (`vistos`); si ya se practicaron todos, empieza un ciclo nuevo con todos.
export function armarMaterial(docs, maxChars = 12000, rnd = Math.random, vistos = new Set()) {
  const todos = docs.flatMap((d) => d.conceptos.map((c) => ({ ...c, doc: d.nombre, clave: claveDe(d, c) })));
  const nuevos = todos.filter((c) => !vistos.has(c.clave));
  const cicloNuevo = todos.length > 0 && nuevos.length === 0;
  const orden = cicloNuevo ? barajar(todos, rnd) : [...barajar(nuevos, rnd), ...barajar(todos.filter((c) => vistos.has(c.clave)), rnd)];
  const elegidos = [];
  const ids = [];
  let n = 0;
  for (const c of orden) {
    const bloque = `## ${c.nombre}\n${c.referencia}`;
    if (n + bloque.length > maxChars && elegidos.length) continue;
    elegidos.push(bloque); ids.push(c.clave); n += bloque.length;
  }
  return { texto: elegidos.join('\n\n'), conceptos: elegidos.length, total: todos.length, ids, nuevos: ids.filter((k) => !vistos.has(k)).length, cicloNuevo };
}

// Conceptos ya usados en una lista de pruebas.
export const conceptosCubiertos = (pruebas) => new Set(pruebas.flatMap((p) => p.conceptosIds || []));
export function cobertura(docs, previas) {
  const vistos = conceptosCubiertos(previas);
  const claves = docs.flatMap((d) => d.conceptos.map((c) => claveDe(d, c)));
  return { total: claves.length, cubiertos: claves.filter((k) => vistos.has(k)).length };
}

// Enunciados de pruebas anteriores (los más recientes primero, sin repetir) para pedirle a la IA que no los repita.
export function enunciadosPrevios(pruebas, max = 40) {
  const vistos = new Set();
  const out = [];
  for (const p of [...pruebas].sort((x, y) => y.creado - x.creado)) {
    for (const q of p.preguntas) {
      if (q.caso && !vistos.has('caso:' + q.caso.id)) { vistos.add('caso:' + q.caso.id); out.push(`CASO ya usado: ${q.caso.titulo}`); if (out.length >= max) return out; }
      const t = q.enunciado.trim();
      const k = t.toLowerCase();
      if (vistos.has(k)) continue;
      vistos.add(k); out.push(t);
      if (out.length >= max) return out;
    }
  }
  return out;
}

// ¿Dos enunciados son casi lo mismo? (solapamiento de palabras)
const palabrasDe = (t) => new Set(String(t).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length > 3));
export function similares(a, b) {
  const x = palabrasDe(a), y = palabrasDe(b);
  if (!x.size || !y.size) return false;
  let comunes = 0;
  for (const w of x) if (y.has(w)) comunes += 1;
  return comunes / (x.size + y.size - comunes) >= 0.75;
}

// Origen de una prueba (todo / un ramo / un PDF).
export const mismoOrigen = (a, b) => (a?.clave && b?.clave ? a.clave === b.clave : (a?.nombre ?? '') === (b?.nombre ?? ''));
export function docsDeOrigen(origen, docs, ramos) {
  const c = origen?.clave;
  if (c?.startsWith('d:')) return docs.filter((d) => d.id === c.slice(2));
  if (c?.startsWith('r:')) return docs.filter((d) => d.ramoId === c.slice(2));
  if (c === 'todo') return docs;
  const n = origen?.nombre; // pruebas antiguas sin clave: se busca por nombre
  const r = ramos.find((x) => x.nombre === n);
  if (r) return docs.filter((d) => d.ramoId === r.id);
  const d = docs.find((x) => x.nombre === n);
  return d ? [d] : docs;
}

// ---- Paginación: la prueba se ve como hojas de papel ----
export const FILAS_CASO = 6; // renglones de respuesta de una pregunta de caso (las de desarrollo normal tienen 8)
const PESO = { alternativas: 1, vf: 0.7, desarrollo: 1.7, desarrolloCaso: 1.35 };
const CAPACIDAD = 5.2;      // "unidades" por hoja (≈ 197 px cada una)
const CAPACIDAD_PRIMERA = 3.4; // la primera hoja lleva el encabezado

const pesoDe = (p) => {
  if (p.tipo === 'alternativas') { const largo = p.enunciado.length + (p.opciones || []).join('').length; return PESO.alternativas + (largo > 420 ? 0.5 : largo > 260 ? 0.2 : 0); }
  if (p.tipo === 'vf') return PESO.vf + (p.enunciado.length > 200 ? 0.3 : 0);
  return p.caso ? PESO.desarrolloCaso : PESO.desarrollo;
};
// El relato de un caso mide ≈ 62 px de título/margen + 27 px por cada ~78 caracteres.
const pesoRelato = (hechos) => (62 + Math.ceil(hechos.length / 78) * 27 + 22) / 197;

// Reparte las preguntas (numeradas de corrido) en hojas; marca la primera pregunta de cada sección para poner su título.
export function paginar(preguntas) {
  const paginas = [];
  let actual = { preguntas: [] };
  let uso = 0;
  const vistos = new Set();
  let casosEnPagina = new Set();
  preguntas.forEach((p, i) => {
    const sec = seccionDe(p);
    const cajaCaso = (pg) => (p.caso && !pg.has(p.caso.id) ? (esLargo(p.caso) && p.casoOrden > 0 ? 1.0 : pesoRelato(p.caso.hechos)) : 0); // el relato del caso se repite en cada hoja donde haya preguntas suyas
    let w = pesoDe(p) + (vistos.has(sec) ? 0 : 0.35) + cajaCaso(casosEnPagina);
    const cap = paginas.length === 0 ? CAPACIDAD_PRIMERA : CAPACIDAD;
    if (actual.preguntas.length && uso + w > cap) { paginas.push(actual); actual = { preguntas: [] }; uso = 0; casosEnPagina = new Set(); w = pesoDe(p) + (vistos.has(sec) ? 0 : 0.35) + cajaCaso(casosEnPagina); }
    actual.preguntas.push({ p, n: i + 1, seccion: vistos.has(sec) ? null : sec });
    vistos.add(sec);
    if (p.caso) casosEnPagina.add(p.caso.id);
    uso += w;
  });
  if (actual.preguntas.length) paginas.push(actual);
  return paginas;
}

export const ROMANO = ['I', 'II', 'III', 'IV'];
export const INSTRUCCION = {
  alternativas: 'Marque con lápiz la alternativa correcta. Solo una es correcta.',
  vf: 'Indique si la afirmación es verdadera (V) o falsa (F).',
  desarrollo: 'Responda con sus palabras, de forma completa y ordenada.',
  caso: 'Lea cada caso y responda aplicando la materia a los hechos, de forma fundada.',
};

// ---- Casos prácticos ----
// La IA devuelve casos {titulo, hechos, preguntas[{enunciado, pauta}]}. Se validan y se aplanan a preguntas de desarrollo
// que llevan el caso adjunto (así se rinden, corrigen y puntúan igual que un desarrollo).
export function normalizarCasos(crudo, { nuevoId = () => Math.random().toString(36).slice(2, 10) } = {}) {
  const lista = Array.isArray(crudo?.casos) ? crudo.casos : [];
  const out = [];
  for (const c of lista) {
    const hechos = texto(c?.hechos);
    if (hechos.length < 80) continue; // un caso necesita un relato de verdad
    const preguntas = (Array.isArray(c?.preguntas) ? c.preguntas : []).map((q) => ({
      enunciado: texto(q?.enunciado),
      pauta: (Array.isArray(q?.pauta) ? q.pauta : texto(q?.pauta).split(/\n|;/)).map(texto).filter(Boolean),
      concepto: texto(q?.concepto),
    })).filter((q) => q.enunciado.length >= 10 && q.pauta.length >= 2);
    if (!preguntas.length) continue;
    out.push({ id: nuevoId(), titulo: texto(c?.titulo) || 'Caso práctico', hechos, preguntas });
  }
  return out;
}

// Casos → preguntas de desarrollo numeradas (Caso 1, Caso 2…), cada una con el caso adjunto.
export function aplanarCasos(casos, { desde = 0, nuevoId = () => Math.random().toString(36).slice(2, 10) } = {}) {
  return casos.flatMap((c, k) => c.preguntas.map((q, j) => ({
    id: nuevoId(), tipo: 'desarrollo', enunciado: q.enunciado, pauta: q.pauta, concepto: q.concepto, explicacion: '',
    caso: { id: c.id, num: desde + k + 1, titulo: c.titulo, hechos: c.hechos }, casoOrden: j,
  })));
}
