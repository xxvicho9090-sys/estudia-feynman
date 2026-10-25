// Esquemas JSON de lo que debe responder cada tarea. Las IAs locales (Ollama y la de la app) los usan para
// no salirse del formato; las de la nube los ignoran (ya obedecen el modo JSON).
const S = { type: 'string' };
const arr = (items) => ({ type: 'array', items });
const obj = (properties, required = Object.keys(properties)) => ({ type: 'object', properties, required });

export const ESQ_PRUEBA = obj({ ok: { type: 'boolean' } });
export const ESQ_CONCEPTOS = obj({ conceptos: arr(obj({ nombre: S, referencia: S })) });
export const ESQ_EVALUACION = obj({
  // "dijiste" es opcional: solo se pide cuando algo es incorrecto (menos texto = evaluación más rápida).
  ideas: arr(obj({ idea: S, estado: { type: 'string', enum: ['bien', 'parcial', 'falta', 'incorrecto'] }, dijiste: S, comentario: S }, ['idea', 'estado', 'comentario'])),
  resumen: S,
});
export const ESQ_ALTERNATIVAS = obj({ preguntas: arr(obj({ enunciado: S, opciones: arr(S), correcta: { type: 'integer' }, explicacion: S, concepto: S })) });
export const ESQ_VF = obj({ preguntas: arr(obj({ enunciado: S, correcta: { type: 'boolean' }, explicacion: S, concepto: S })) });
export const ESQ_DESARROLLO = obj({ preguntas: arr(obj({ enunciado: S, pauta: arr(S), concepto: S })) });
export const ESQ_CASOS = obj({ casos: arr(obj({ titulo: S, hechos: S, preguntas: arr(obj({ enunciado: S, pauta: arr(S), concepto: S })) })) });
export const ESQ_TIPO = { alternativas: ESQ_ALTERNATIVAS, vf: ESQ_VF, desarrollo: ESQ_DESARROLLO, caso: ESQ_CASOS };
export const ESQ_ORAL = obj({ valoracion: { type: 'string', enum: ['correcta', 'parcial', 'incorrecta'] }, reaccion: S, repregunta: S, observacion: S });
export const ESQ_ACLARACION = obj({ ejemplo: S, pregunta: S });
export const ESQ_MODELO = obj({ respuesta: S });
