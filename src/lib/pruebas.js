import { generarPreguntasDeTipo, corregirDesarrollo } from './groq.js';
import { armarMaterial, normalizarPreguntas, TIPOS, NOMBRES, totalPlan, calcularPrueba } from './quiz.js';
import { nuevoId } from './concepts.js';

const FATALES = ['badkey', 'nokey', 'limit', 'offline'];

// Crea una prueba nueva: genera las preguntas de cada tipo con la IA y las valida.
export async function crearPrueba({ docs, origen, plan }, onProgress, signal) {
  const material = armarMaterial(docs);
  if (!material.conceptos) throw new Error('No hay conceptos en el material elegido. Sube un PDF o agrega conceptos primero.');
  const pasos = TIPOS.filter((t) => plan[t] > 0);
  const preguntas = [];
  const avisos = [];
  for (let i = 0; i < pasos.length; i++) {
    const tipo = pasos[i];
    onProgress?.(`Creando ${NOMBRES[tipo].toLowerCase()} (${i + 1} de ${pasos.length})…`, i / pasos.length);
    let lista = [];
    for (let intento = 0; intento < 2 && lista.length < plan[tipo]; intento++) {
      const faltan = plan[tipo] - lista.length;
      try {
        const crudo = await generarPreguntasDeTipo(tipo, intento ? faltan + 1 : faltan, material.texto, { signal });
        lista.push(...normalizarPreguntas(tipo, crudo, { nuevoId }));
      } catch (e) {
        if (e?.name === 'AbortError' || FATALES.includes(e?.code)) throw e;
        if (intento) avisos.push(`No pude crear todas las preguntas de ${NOMBRES[tipo].toLowerCase()}.`);
      }
    }
    lista = lista.slice(0, plan[tipo]);
    if (lista.length < plan[tipo] && !avisos.length) avisos.push(`De ${NOMBRES[tipo].toLowerCase()} salieron ${lista.length} de ${plan[tipo]} pedidas.`);
    preguntas.push(...lista);
  }
  if (!preguntas.length) throw new Error('La IA no pudo crear preguntas con este material. Intenta de nuevo.');
  return {
    id: nuevoId(), creado: Date.now(), titulo: origen.nombre, origen, plan, preguntas, respuestas: {}, evaluaciones: {},
    estado: 'en curso', resultado: null, aviso: avisos.join(' '),
    cobertura: `${material.conceptos} de ${material.total} conceptos`,
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
