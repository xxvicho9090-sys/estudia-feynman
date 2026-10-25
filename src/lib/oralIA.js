import { chat } from './ai.js';
import { ESQ_ORAL } from './esquemas.js';
import { conceptoActual, repreguntasQuedan, normalizarEvaluacion, esRepetida, mencionaMaterial, ESTILOS } from './oral.js';

// El profesor evalúa lo último que dijo el alumno. Una sola llamada corta (valoración + reacción + repregunta), para que no se sienta lenta.
const BASE = (quedan) => `Eres un profesor universitario que toma una INTERROGACIÓN ORAL a un alumno. Hablas de usted, con un tono profesional, sobrio y respetuoso, sin halagos exagerados. Te doy el MATERIAL de referencia del concepto que estás preguntando, lo conversado hasta ahora y la última respuesta del alumno.
Evalúa por COMPRENSIÓN, no por memoria: si el alumno expresa el mismo significado con otras palabras, es correcto. Valoración de la ÚLTIMA respuesta:
- "correcta": explicó lo esencial de forma correcta.
- "parcial": dijo algo correcto pero incompleto o impreciso.
- "incorrecta": no respondió lo pedido o dijo algo que contradice el material.
Responde SOLO JSON: {"valoracion":"correcta|parcial|incorrecta","reaccion":"1 frase breve (máx. 18 palabras) en que reconoces lo acertado o señalas con tacto lo que falla, SIN dar la respuesta completa","repregunta":"una pregunta breve (máx. 22 palabras) o vacío","observacion":"máx. 14 palabras: qué faltó o estuvo mal (vacío si fue correcta)"}.
Repregunta: te quedan ${quedan} ${quedan === 1 ? 'repregunta' : 'repreguntas'} para este concepto. `;

const REGLA = {
  cordial: () => 'Si la respuesta fue parcial o incorrecta, repregunta apuntando a lo que faltó o falló. Si fue correcta, déjala vacía.',
  riguroso: (hechas) => `Si la respuesta fue parcial o incorrecta, repregunta apuntando justo a lo que faltó o falló. Si fue correcta${hechas === 0 ? ' y todavía no has hecho ninguna repregunta en este concepto, DEBES hacer una repregunta que lleve el concepto un paso más allá (una consecuencia, una excepción, una diferencia con otra figura o un caso breve)' : ', déjala vacía: ya profundizaste'}.`,
  // Conversación ágil: contrapreguntas cortas y variadas que reaccionan a lo que dijo el alumno, hasta quedar conforme.
  dinamico: (hechas) => `ESTILO DINÁMICO: esto es una conversación ágil, no un examen escrito. Reacciona a lo que el alumno acaba de decir con una CONTRAPREGUNTA corta que lo haga pensar, y varía el tipo: un caso hipotético breve («¿y si el comprador no paga?»), una consecuencia, una excepción, un «¿por qué?», pedir un ejemplo, comparar con otra figura, o señalar una contradicción con algo que dijo antes («hace un momento dijo X; ¿cómo lo concilia con Y?»). Si fue parcial o incorrecta, contrapregunta justo sobre lo que falló o faltó, sin darle la respuesta. ${hechas < 2 ? 'Todavía no has contrapreguntado lo suficiente: DEBES hacer una contrapregunta, aunque la respuesta haya sido buena.' : 'Ya contrapreguntaste varias veces: si las últimas respuestas fueron sólidas, queda conforme y deja "repregunta" VACÍA; si siguen flojas, insiste en lo que falla.'} Tu "reaccion" debe ser muy corta (máx. 10 palabras) y natural, como en una charla: «Bien.», «Mm, no del todo.», «Interesante.». No repitas contrapreguntas ya hechas.`,
};

const FIN = 'Nunca des la respuesta completa en la reacción ni en la repregunta. Usa SOLO el material de referencia, pero no lo menciones: habla como quien domina la materia (nunca digas "según el material" ni "el texto"). Español.';

const sys = (estilo, quedan, hechas) => `${BASE(quedan)}${quedan === 0 ? 'Deja "repregunta" VACÍA.' : (REGLA[estilo] || REGLA.cordial)(hechas)}\n${FIN}`;

const lineas = (turnos) => turnos.map((t) => `${t.rol === 'profesor' ? 'PROFESOR' : 'ALUMNO'}: ${t.texto}`).join('\n');

export async function evaluarRespuestaOral(oral, { signal } = {}) {
  const c = conceptoActual(oral);
  const user = `CONCEPTO: ${c.nombre}\nMATERIAL DE REFERENCIA:\n${c.referencia}\n\nCONVERSACIÓN:\n${lineas(c.turnos)}`;
  const preguntar = (extra = '') => chat([{ role: 'system', content: sys(oral.estilo, repreguntasQuedan(oral), c.rep) }, { role: 'user', content: user + extra }], { signal, esquema: ESQ_ORAL, rapido: true }).then(normalizarEvaluacion);
  const previas = c.turnos.filter((t) => t.rol === 'profesor').map((t) => t.texto);
  let ev = await preguntar();
  // Si repite una pregunta ya hecha, se le pide otra distinta una vez; si insiste, se da por cerrado el tema.
  if (ev.repregunta && (esRepetida(ev.repregunta, previas) || mencionaMaterial(ev.repregunta))) {
    const hechas = previas.map((p) => `- ${p}`).join('\n');
    ev = await preguntar(`\n\nYA PREGUNTASTE ESTO, NO LO REPITAS NI LO REFORMULES:\n${hechas}\nHaz una contrapregunta sobre OTRO aspecto (sin mencionar "el material" ni "el texto"), o deja "repregunta" vacía si ya quedaste conforme.`);
    if (ev.repregunta && (esRepetida(ev.repregunta, previas) || mencionaMaterial(ev.repregunta))) ev = { ...ev, repregunta: '' };
    if (mencionaMaterial(ev.reaccion)) ev = { ...ev, reaccion: '' };
  }
  return ev;
}

export { ESTILOS };
