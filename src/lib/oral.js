import { notaDePuntaje, extraerJson } from './grade.js';
import { nuevoId } from './concepts.js';

// Interrogatorio oral: un profesor te pregunta concepto por concepto, repregunta lo que quede flojo y al final te pone nota.
// Aquí vive la lógica pura (sin IA ni pantalla), para poder probarla; las llamadas a la IA están en oralIA.js.

export const ESTILOS = {
  cordial: { nombre: 'Cordial', maxRep: 1, desc: 'Repregunta una vez si algo queda incompleto.' },
  dinamico: { nombre: 'Dinámico', maxRep: 4, desc: 'Una conversación ágil: el profesor te hace contrapreguntas cortas (casos, «¿y si…?», «¿por qué?», contradicciones) hasta quedar conforme.' },
  riguroso: { nombre: 'Riguroso', maxRep: 2, desc: 'Hasta dos repreguntas y profundiza aunque respondas bien, como en una interrogación de verdad.' },
};
export const CONCEPTOS = { min: 2, max: 10, defecto: 5 };
const PUNTOS = { correcta: 1, parcial: 0.5, incorrecta: 0, sin_respuesta: 0 };
export const VALORACIONES = ['correcta', 'parcial', 'incorrecta'];

const MAX_REF = 900; // caracteres del material de cada concepto que ve el profesor

// ---- Qué se pregunta ----
// Prioriza conceptos que no han salido en interrogatorios anteriores y los que menos dominas; el azar mezcla el resto.
export function elegirConceptos(docs, n, usados = new Set(), rnd = Math.random) {
  const todos = docs.flatMap((d) => d.conceptos.map((c) => ({ c, d })));
  const prio = ({ c }) => (usados.has(c.id) ? 10 : 0) + (c.nota == null ? 2 : c.nota < 4 ? 0 : c.nota < 5.5 ? 3 : 5) + rnd() * 2.5;
  return todos
    .map((x) => ({ x, p: prio(x) }))
    .sort((a, b) => a.p - b.p)
    .slice(0, n)
    .map(({ x }) => ({ id: x.c.id, docNombre: x.d.nombre, nombre: x.c.nombre, referencia: String(x.c.referencia || '').slice(0, MAX_REF), turnos: [], rep: 0, estado: 'pendiente', puntaje: null }));
}

// ---- Cómo habla el profesor ----
export const saludo = (hora) => (hora < 12 ? 'Buenos días.' : hora < 20 ? 'Buenas tardes.' : 'Buenas noches.');
const PRIMERA = [
  (n) => `Comencemos con «${n}». ¿Qué puede explicarme al respecto?`,
  (n) => `Hábleme de «${n}»: ¿en qué consiste y por qué es importante?`,
  (n) => `Para comenzar, ¿qué entiende usted por «${n}»?`,
];
const SIGUIENTE = [
  (n) => `Pasemos a «${n}». ¿Qué puede decirme?`,
  (n) => `Ahora, respecto de «${n}»: explíqueme en qué consiste, con sus palabras.`,
  (n) => `Cambiemos de tema. ¿Qué entiende usted por «${n}»?`,
  (n) => `Sigamos con «${n}». ¿Cómo lo explicaría?`,
];
export function preguntaInicial(nombre, k, rnd = Math.random) {
  const lista = k === 0 ? PRIMERA : SIGUIENTE;
  return lista[Math.floor(rnd() * lista.length) % lista.length](nombre);
}
export const CIERRE = 'Con eso concluimos la interrogación. Muchas gracias.';

export function nuevoOral({ docs, origen, n, estilo = 'riguroso', usados = new Set(), voz = false, rnd = Math.random, ahora = new Date() }) {
  const conceptos = elegirConceptos(docs, Math.min(Math.max(n, 1), CONCEPTOS.max), usados, rnd);
  if (!conceptos.length) throw new Error('No hay conceptos en el material elegido. Sube un PDF o agrega conceptos primero.');
  conceptos[0].estado = 'en curso';
  conceptos[0].turnos.push({ rol: 'profesor', texto: `${saludo(ahora.getHours())} ${preguntaInicial(conceptos[0].nombre, 0, rnd)}` });
  return { id: nuevoId(), creado: ahora.getTime(), titulo: origen.nombre, origen, estilo, voz, conceptos, actual: 0, estado: 'en curso', resultado: null };
}

// ---- Turnos ----
export const conceptoActual = (oral) => oral.conceptos[oral.actual];
export const ultimaPregunta = (oral) => { const t = conceptoActual(oral)?.turnos; return [...(t || [])].reverse().find((x) => x.rol === 'profesor')?.texto || ''; };
export const repreguntasQuedan = (oral) => Math.max(0, ESTILOS[oral.estilo].maxRep - conceptoActual(oral).rep);

// Anota lo que dijo el alumno (queda a la vista mientras el profesor evalúa).
export function registrarRespuesta(oral, texto) {
  const conceptos = oral.conceptos.map((c, i) => (i === oral.actual ? { ...c, turnos: [...c.turnos, { rol: 'alumno', texto: String(texto).trim() }] } : c));
  return { ...oral, conceptos };
}

// Lo que devuelve la IA, ya depurado: valoración válida y textos acotados.
export function normalizarEvaluacion(crudo) {
  const o = extraerJson(crudo);
  const val = VALORACIONES.includes(o?.valoracion) ? o.valoracion : null;
  if (!val) throw new Error('El profesor no entregó una evaluación válida');
  const t = (x, max) => String(x ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
  return { valoracion: val, reaccion: t(o.reaccion, 260), repregunta: soloUnaPregunta(t(o.repregunta, 260)), observacion: t(o.observacion, 180) };
}

// El profesor hace UNA contrapregunta por turno (los modelos chicos a veces encadenan dos o tres).
export function soloUnaPregunta(texto) {
  const i = texto.indexOf('?');
  return i >= 0 ? texto.slice(0, i + 1) : texto;
}
const palabrasClave = (t) => new Set(String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length > 3));
// ¿La contrapregunta nueva repite (o reformula casi igual) una que el profesor ya hizo?
export function esRepetida(nueva, previas) {
  const a = palabrasClave(nueva);
  if (a.size < 3) return false;
  return previas.some((p) => { const b = palabrasClave(p); let comunes = 0; for (const w of a) if (b.has(w)) comunes += 1; return comunes / a.size >= 0.7; });
}

// El profesor no debe delatar que lee un material («según el material», «el texto»…).
export const mencionaMaterial = (t) => /\b(el|del|al|este|ese) (material|texto|apunte|pdf)\b/i.test(t);

// ---- «No entendí»: el profesor lo explica con un caso hipotético y vuelve a preguntar (no cuenta como respuesta ni gasta contrapreguntas) ----
export const ACLARACIONES_MAX = 3;
const PIDE_ACLARACION = /(no\s+(lo\s+|la\s+|le\s+|te\s+)?(he\s+)?(entend|comprend|captad|capt[eé])|no\s+(me\s+)?qued[oó]\s+clar|no\s+entiendo|no\s+comprendo|no\s+(s[eé]|sabr[ií]a)\s+(a\s+)?qu[eé]\s+(se\s+)?(refiere|quiere|pregunta)|no\s+(s[eé]|entiendo)\s+(qu[eé]|a\s+qu[eé])\s+(me\s+)?(pregunta|pide)|(puede|podr[ií]a)\s+(repetir|explicar|aclarar|darme\s+un\s+ejemplo)|me\s+(puede|podr[ií]a)\s+(repetir|explicar|dar)|p[oó]ngame\s+un\s+ejemplo|un\s+ejemplo,?\s+por\s+favor|expl[ií]queme|repita)/i;
// Solo cuenta si es un mensaje corto (una respuesta larga que mencione «no entendí» sigue siendo una respuesta).
export const pideAclaracion = (texto) => { const t = String(texto || ''); return t.trim().split(/\s+/).length <= 25 && PIDE_ACLARACION.test(t); };
export const aclaracionesQuedan = (oral) => Math.max(0, ACLARACIONES_MAX - (conceptoActual(oral).aclar || 0));

export function normalizarAclaracion(crudo) {
  const o = extraerJson(crudo);
  const t = (x, max) => String(x ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
  const ejemplo = t(o?.ejemplo, 700);
  const pregunta = soloUnaPregunta(t(o?.pregunta, 260));
  if (ejemplo.length < 20 || !pregunta) throw new Error('El profesor no entregó un ejemplo válido');
  return { ejemplo, pregunta };
}

// Anota la aclaración: la última frase del alumno queda como «aclaración» (sin nota) y el profesor responde con el caso y una pregunta sencilla.
export function aplicarAclaracion(oral, { ejemplo, pregunta }) {
  const c0 = conceptoActual(oral);
  const turnos = [...c0.turnos];
  const i = turnos.map((t) => t.rol).lastIndexOf('alumno');
  turnos[i] = { ...turnos[i], val: 'aclaracion' };
  const intro = ['Claro, se lo explico con un caso.', 'Por supuesto, veámoslo con un ejemplo.', 'Sin problema. Imagine esto.'][(c0.aclar || 0) % 3];
  const c = { ...c0, aclar: (c0.aclar || 0) + 1, turnos: [...turnos, { rol: 'profesor', texto: `${intro} ${ejemplo} ${pregunta}` }] };
  const conceptos = oral.conceptos.map((x, k) => (k === oral.actual ? c : x));
  return { ...oral, conceptos };
}

export function puntajeConcepto(c) {
  const vals = c.turnos.filter((t) => t.rol === 'alumno' && t.val in PUNTOS).map((t) => PUNTOS[t.val]);
  if (!vals.length) return 0;
  if (vals.length === 1) return vals[0];
  // Pesa más cómo terminas que cómo empiezas: la repregunta es para rescatar. Con varias contrapreguntas cuenta el promedio de lo que vino después.
  if (vals.length === 2) return 0.4 * vals[0] + 0.6 * vals[1];
  const resto = vals.slice(1);
  return 0.3 * vals[0] + 0.7 * (resto.reduce((s, v) => s + v, 0) / resto.length);
}

export function resultadoOral(oral) {
  const porConcepto = oral.conceptos.map((c) => ({ id: c.id, nombre: c.nombre, puntaje: c.puntaje ?? puntajeConcepto(c) }));
  const porcentaje = porConcepto.length ? (porConcepto.reduce((s, c) => s + c.puntaje, 0) / porConcepto.length) * 100 : 0;
  return { porcentaje, nota: notaDePuntaje(porcentaje), porConcepto };
}

// Aplica la evaluación del profesor a la última respuesta: o repregunta, o pasa al siguiente concepto, o termina.
export function aplicarEvaluacion(oral, ev, rnd = Math.random) {
  const c0 = conceptoActual(oral);
  const turnos = [...c0.turnos];
  const iAlumno = turnos.map((t) => t.rol).lastIndexOf('alumno');
  turnos[iAlumno] = { ...turnos[iAlumno], val: ev.valoracion, obs: ev.observacion || '' };
  const quedan = repreguntasQuedan(oral);
  const rep = ev.valoracion === 'sin_respuesta' ? '' : ev.repregunta;
  let c = { ...c0, turnos };
  const conceptos = [...oral.conceptos];

  if (rep && quedan > 0) {
    c = { ...c, rep: c0.rep + 1, turnos: [...turnos, { rol: 'profesor', texto: [ev.reaccion, rep].filter(Boolean).join(' ') }] };
    conceptos[oral.actual] = c;
    return { ...oral, conceptos };
  }
  c = { ...c, estado: 'listo', puntaje: puntajeConcepto({ turnos }) };
  conceptos[oral.actual] = c;
  const sig = oral.actual + 1;
  if (sig < conceptos.length) {
    conceptos[sig] = { ...conceptos[sig], estado: 'en curso', turnos: [{ rol: 'profesor', texto: [ev.reaccion, preguntaInicial(conceptos[sig].nombre, sig, rnd)].filter(Boolean).join(' ') }] };
    return { ...oral, conceptos, actual: sig };
  }
  const fin = { ...oral, conceptos, estado: 'terminado' };
  c = { ...c, turnos: [...turnos, { rol: 'profesor', texto: [ev.reaccion, CIERRE].filter(Boolean).join(' ') }] };
  conceptos[oral.actual] = c;
  return { ...fin, conceptos, resultado: resultadoOral({ ...fin, conceptos }) };
}

// "No sé / pasar": cuenta como sin respuesta y el profesor sigue con el siguiente tema.
export function pasarConcepto(oral, rnd = Math.random) {
  const o = registrarRespuesta(oral, '(No respondió)');
  return aplicarEvaluacion(o, { valoracion: 'sin_respuesta', reaccion: 'Bien, lo dejaremos pendiente.', repregunta: '', observacion: 'No respondió.' }, rnd);
}

// Para no repetir en el siguiente interrogatorio los conceptos ya preguntados.
export const conceptosUsados = (orales) => new Set(orales.flatMap((o) => o.conceptos.map((c) => c.id)));
