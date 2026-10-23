import { chat } from './ai.js';
import { ESQ_ORAL } from './esquemas.js';
import { conceptoActual, repreguntasQuedan, normalizarEvaluacion, ESTILOS } from './oral.js';

// El profesor evalúa lo último que dijo el alumno. Una sola llamada corta (valoración + reacción + repregunta), para que no se sienta lenta.
const sys = (estilo, quedan, hechas) => `Eres un profesor universitario que toma una INTERROGACIÓN ORAL a un alumno. Hablas de usted, con un tono profesional, sobrio y respetuoso, sin halagos exagerados. Te doy el MATERIAL de referencia del concepto que estás preguntando, lo conversado hasta ahora y la última respuesta del alumno.
Evalúa por COMPRENSIÓN, no por memoria: si el alumno expresa el mismo significado con otras palabras, es correcto. Valoración:
- "correcta": explicó lo esencial de forma correcta.
- "parcial": dijo algo correcto pero incompleto o impreciso.
- "incorrecta": no respondió lo pedido o dijo algo que contradice el material.
Responde SOLO JSON: {"valoracion":"correcta|parcial|incorrecta","reaccion":"1 frase breve (máx. 18 palabras) en que reconoces lo acertado o señalas con tacto lo que falla, SIN dar la respuesta completa","repregunta":"una pregunta breve (máx. 22 palabras) o vacío","observacion":"máx. 14 palabras: qué faltó o estuvo mal (vacío si fue correcta)"}.
Repregunta: te quedan ${quedan} ${quedan === 1 ? 'repregunta' : 'repreguntas'} para este concepto. ${quedan === 0 ? 'Deja "repregunta" VACÍA.' : estilo === 'riguroso'
    ? `Si la respuesta fue parcial o incorrecta, repregunta apuntando justo a lo que faltó o falló. Si fue correcta${hechas === 0 ? ' y todavía no has hecho ninguna repregunta en este concepto, DEBES hacer una repregunta que lleve el concepto un paso más allá (una consecuencia, una excepción, una diferencia con otra figura o un caso breve)' : ', déjala vacía: ya profundizaste'}.`
    : 'Si la respuesta fue parcial o incorrecta, repregunta apuntando a lo que faltó o falló. Si fue correcta, déjala vacía.'}
Nunca des la respuesta completa en la reacción ni en la repregunta. Usa SOLO el material de referencia, pero no lo menciones: habla como quien domina la materia (nunca digas "según el material" ni "el texto"). Español.`;

const lineas = (turnos) => turnos.map((t) => `${t.rol === 'profesor' ? 'PROFESOR' : 'ALUMNO'}: ${t.texto}`).join('\n');

export async function evaluarRespuestaOral(oral, { signal } = {}) {
  const c = conceptoActual(oral);
  const user = `CONCEPTO: ${c.nombre}\nMATERIAL DE REFERENCIA:\n${c.referencia}\n\nCONVERSACIÓN:\n${lineas(c.turnos)}`;
  const out = await chat([{ role: 'system', content: sys(oral.estilo, repreguntasQuedan(oral), c.rep) }, { role: 'user', content: user }], { signal, esquema: ESQ_ORAL, rapido: true });
  return normalizarEvaluacion(out);
}

export { ESTILOS };
