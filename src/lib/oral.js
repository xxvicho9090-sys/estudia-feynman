import { notaDePuntaje, extraerJson } from './grade.js';
import { nuevoId } from './concepts.js';

// Interrogatorio oral: un profesor te pregunta concepto por concepto, repregunta lo que quede flojo y al final te pone nota.
// Aquí vive la lógica pura (sin IA ni pantalla), para poder probarla; las llamadas a la IA están en oralIA.js.

export const ESTILOS = {
  cordial: { nombre: 'Cordial', maxRep: 1, desc: 'Repregunta una vez si algo queda incompleto.' },
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
  return { valoracion: val, reaccion: t(o.reaccion, 260), repregunta: t(o.repregunta, 260), observacion: t(o.observacion, 180) };
}

export function puntajeConcepto(c) {
  const vals = c.turnos.filter((t) => t.rol === 'alumno' && t.val).map((t) => PUNTOS[t.val]);
  if (!vals.length) return 0;
  if (vals.length === 1) return vals[0];
  return 0.4 * vals[0] + 0.6 * vals[vals.length - 1]; // pesa más cómo terminas que cómo empiezas: la repregunta es para rescatar
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
