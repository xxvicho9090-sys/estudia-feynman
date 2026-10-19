import { generarPreguntasDeTipo, corregirDesarrollo } from './groq.js';
import { armarMaterial, normalizarPreguntas, conceptosCubiertos, enunciadosPrevios, similares, TIPOS, NOMBRES, totalPlan, calcularPrueba } from './quiz.js';
import { nuevoId } from './concepts.js';

const FATALES = ['badkey', 'nokey', 'limit', 'offline'];

// Crea una prueba nueva: genera las preguntas de cada tipo con la IA y las valida.
// `previas` = pruebas anteriores del mismo material: se parte por los conceptos que aún no practicaste y se evita repetir preguntas.
export async function crearPrueba({ docs, origen, plan, previas = [], evitarRepetir = true }, onProgress, signal) {
  const vistos = evitarRepetir ? conceptosCubiertos(previas) : new Set();
  const evitar = evitarRepetir ? enunciadosPrevios(previas) : [];
  const material = armarMaterial(docs, 12000, Math.random, vistos);
  if (!material.conceptos) throw new Error('No hay conceptos en el material elegido. Sube un PDF o agrega conceptos primero.');
  const pasos = TIPOS.filter((t) => plan[t] > 0);
  const preguntas = [];
  const avisos = [];
  for (let i = 0; i < pasos.length; i++) {
    const tipo = pasos[i];
    onProgress?.(`Creando ${NOMBRES[tipo].toLowerCase()} (${i + 1} de ${pasos.length})…`, i / pasos.length);
    let lista = [];
    const parecidas = []; // repetidas respecto de pruebas anteriores: solo se usan si no alcanza con preguntas nuevas
    for (let intento = 0; intento < 2 && lista.length < plan[tipo]; intento++) {
      const faltan = plan[tipo] - lista.length;
      try {
        const crudo = await generarPreguntasDeTipo(tipo, intento ? faltan + 1 : faltan, material.texto, { signal, evitar });
        // Por si la IA repite igual una pregunta de antes o de este mismo intento, se descarta.
        for (const q of normalizarPreguntas(tipo, crudo, { nuevoId })) {
          if (lista.some((x) => similares(q.enunciado, x.enunciado))) continue;
          if (evitar.some((e) => similares(q.enunciado, e))) parecidas.push(q); else lista.push(q);
        }
      } catch (e) {
        if (e?.name === 'AbortError' || FATALES.includes(e?.code)) throw e;
        if (intento) avisos.push(`No pude crear todas las preguntas de ${NOMBRES[tipo].toLowerCase()}.`);
      }
    }
    if (lista.length < plan[tipo] && parecidas.length) {
      lista.push(...parecidas.slice(0, plan[tipo] - lista.length));
      avisos.push('Algunas preguntas pueden parecerse a las de pruebas anteriores.');
    }
    lista = lista.slice(0, plan[tipo]);
    if (lista.length < plan[tipo] && !avisos.length) avisos.push(`De ${NOMBRES[tipo].toLowerCase()} salieron ${lista.length} de ${plan[tipo]} pedidas.`);
    preguntas.push(...lista);
  }
  if (!preguntas.length) throw new Error('La IA no pudo crear preguntas con este material. Intenta de nuevo.');
  return {
    id: nuevoId(), creado: Date.now(), titulo: origen.nombre, origen, plan, preguntas, respuestas: {}, evaluaciones: {},
    estado: 'en curso', resultado: null, aviso: avisos.join(' '),
    conceptosIds: material.ids,
    cicloNuevo: material.cicloNuevo,
    cobertura: `${material.conceptos} de ${material.total} conceptos${material.nuevos && previas.length ? ` (${material.nuevos} que aún no habías practicado)` : ''}`,
    pedidas: totalPlan(plan),
  };
}

// Corrige los desarrollos pendientes. Devuelve la prueba actualizada y, si algo falló, el mensaje.
export async function corregirPrueba(prueba, onProgress) {
  const evaluaciones = { ...prueba.evaluaciones };
  const pend = prueba.preguntas.filter((p) => p.tipo === 'desarrollo' && String(prueba.respuestas[p.id] || '').trim() && !evaluaciones[p.id]);
  let error = '';
  for (let i = 0; i < pend.length; i++) {
    onProgress?.(`Corrigiendo desarrollo ${i + 1} de ${pend.length}…`, i / pend.length);
    try {
      evaluaciones[pend[i].id] = await corregirDesarrollo(pend[i], prueba.respuestas[pend[i].id]);
    } catch (e) {
      error = e?.message || 'No se pudo corregir.';
      if (FATALES.includes(e?.code)) break;
    }
  }
  const sig = { ...prueba, evaluaciones };
  const r = calcularPrueba(sig);
  return { prueba: { ...sig, estado: r.pendientes ? 'por corregir' : 'corregida', resultado: r.pendientes ? null : r, entregada: prueba.entregada || Date.now() }, error };
}
