// Esquemas JSON de lo que debe responder cada tarea. Las IAs locales (Ollama y la de la app) los usan para
// no salirse del formato; las de la nube los ignoran (ya obedecen el modo JSON).
const S = { type: 'string' };
const arr = (items) => ({ type: 'array', items });
const obj = (properties, required = Object.keys(properties)) => ({ type: 'object', properties, required });

export const ESQ_PRUEBA = obj({ ok: { type: 'boolean' } });
export const ESQ_CONCEPTOS = obj({ conceptos: arr(obj({ nombre: S, referencia: S })) });
export const ESQ_EVALUACION = obj({
  ideas: arr(obj({ idea: S, estado: { type: 'string', enum: ['bien', 'parcial', 'falta', 'incorrecto'] }, dijiste: S, comentario: S })),
  resumen: S,
});
export const ESQ_ALTERNATIVAS = obj({ preguntas: arr(obj({ enunciado: S, opciones: arr(S), correcta: { type: 'integer' }, explicacion: S, concepto: S })) });
export const ESQ_VF = obj({ preguntas: arr(obj({ enunciado: S, correcta: { type: 'boolean' }, explicacion: S, concepto: S })) });
export const ESQ_DESARROLLO = obj({ preguntas: arr(obj({ enunciado: S, pauta: arr(S), concepto: S })) });
export const ESQ_TIPO = { alternativas: ESQ_ALTERNATIVAS, vf: ESQ_VF, desarrollo: ESQ_DESARROLLO };
