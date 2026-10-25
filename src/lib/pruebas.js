import { generarPreguntasDeTipo, corregirDesarrollo } from './groq.js';
import { armarMaterial, normalizarPreguntas, normalizarCasos, aplanarCasos, conceptosCubiertos, enunciadosPrevios, similares, TIPOS, NOMBRES, totalPlan, preguntasPorCaso, extensionDe, EXTENSIONES, calcularPrueba, ordenarPreguntas, sumaPlan } from './quiz.js';
import { nuevoId } from './concepts.js';
import { soloLocal } from './ai.js';

const FATALES = ['badkey', 'nokey', 'limit', 'offline'];

// Con una IA que corre en el dispositivo se piden pocas preguntas por vez (si no, la respuesta sale cortada o enredada y no sirve nada).
const LOTE_LOCAL = { alternativas: 3, vf: 4, desarrollo: 2 };
const loteDe = (tipo) => (soloLocal() ? LOTE_LOCAL[tipo] || 3 : Infinity);
const AYUDA_LOCAL = ' Para pruebas más largas y precisas conecta una IA gratis (Groq o Gemini) en Ajustes: la IA offline es lenta y se equivoca más.';
const detalleDe = (fallo) => (fallo ? ` (${String(fallo).slice(0, 140)})` : '') + (soloLocal() ? AYUDA_LOCAL : '');

// Crea una prueba nueva: genera las preguntas de cada tipo con la IA y las valida.
// `previas` = pruebas anteriores del mismo material: se parte por los conceptos que aún no practicaste y se evita repetir preguntas.
export async function crearPrueba({ docs, origen, plan, previas = [], evitarRepetir = true }, onProgress, signal) {
  const vistos = evitarRepetir ? conceptosCubiertos(previas) : new Set();
  const evitar = evitarRepetir ? enunciadosPrevios(previas) : [];
  const material = armarMaterial(docs, 12000, Math.random, vistos);
  if (!material.conceptos) throw new Error('No hay conceptos en el material elegido. Sube un PDF o agrega conceptos primero.');
  const { preguntas, avisos, fallo } = await generarLote({ plan, material, evitar, signal, onProgress });
  if (!preguntas.length) throw new Error(`La IA no pudo crear preguntas con este material${detalleDe(fallo)}. Intenta de nuevo con menos preguntas.`);
  return {
    id: nuevoId(), creado: Date.now(), titulo: origen.nombre, origen, plan, preguntas, respuestas: {}, evaluaciones: {},
    estado: 'en curso', resultado: null, aviso: avisos.join(' '),
    conceptosIds: material.ids,
    cicloNuevo: material.cicloNuevo,
    cobertura: `${material.conceptos} de ${material.total} conceptos${material.nuevos && previas.length ? ` (${material.nuevos} que aún no habías practicado)` : ''}`,
    pedidas: totalPlan(plan),
  };
}

// Genera las preguntas de un plan (de cada tipo y los casos) con la IA, validadas y sin repetir las de `evitar`.
async function generarLote({ plan, material, evitar, signal, onProgress, desdeCaso = 0 }) {
  const pasos = [...TIPOS.filter((t) => plan[t] > 0), ...(plan.casos > 0 ? ['caso'] : [])]; // los casos prácticos van al final
  const preguntas = [];
  const avisos = [];
  let fallo = '';
  for (let i = 0; i < pasos.length; i++) {
    const tipo = pasos[i];
    onProgress?.(`Creando ${NOMBRES[tipo].toLowerCase()} (${i + 1} de ${pasos.length})…`, i / pasos.length);
    if (tipo === 'caso') {
      const casos = await crearCasos(plan, material, evitar, signal, avisos, (texto) => onProgress?.(texto, i / pasos.length), (m) => { fallo = m; });
      preguntas.push(...aplanarCasos(casos, { nuevoId, desde: desdeCaso }));
      continue;
    }
    let lista = [];
    const parecidas = []; // repetidas respecto de pruebas anteriores: solo se usan si no alcanza con preguntas nuevas
    const lote = loteDe(tipo);
    const maxIntentos = Math.ceil(plan[tipo] / lote) + 1;
    for (let intento = 0; intento < maxIntentos && lista.length < plan[tipo]; intento++) {
      const faltan = plan[tipo] - lista.length;
      onProgress?.(`Creando ${NOMBRES[tipo].toLowerCase()} (${lista.length} de ${plan[tipo]})…${soloLocal() ? ' La IA offline es lenta: puede tardar varios minutos.' : ''}`, i / pasos.length);
      try {
        const crudo = await generarPreguntasDeTipo(tipo, Math.min(lote, intento ? faltan + 1 : faltan), material.texto, { signal, evitar: [...evitar, ...lista.map((x) => x.enunciado)] });
        // Por si la IA repite igual una pregunta de antes o de este mismo intento, se descarta.
        for (const q of normalizarPreguntas(tipo, crudo, { nuevoId })) {
          if (lista.some((x) => similares(q.enunciado, x.enunciado))) continue;
          if (evitar.some((e) => similares(q.enunciado, e))) parecidas.push(q); else lista.push(q);
        }
      } catch (e) {
        if (e?.name === 'AbortError' || FATALES.includes(e?.code)) throw e;
        fallo = e?.message || String(e);
        if (intento === maxIntentos - 1) avisos.push(`No pude crear todas las preguntas de ${NOMBRES[tipo].toLowerCase()}.`);
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
  return { preguntas, avisos, fallo };
}

// Agrega más preguntas (de cualquier tipo, también casos) a una prueba ya creada. Parte por conceptos que la prueba aún no usa,
// no repite las preguntas que ya tiene ni las de pruebas anteriores, y deja la prueba "en curso" para responder lo nuevo.
export async function ampliarPrueba({ prueba, docs, plan, previas = [] }, onProgress, signal) {
  const vistos = new Set([...conceptosCubiertos(previas), ...(prueba.conceptosIds || [])]);
  const evitar = enunciadosPrevios([prueba, ...previas]);
  const material = armarMaterial(docs, 12000, Math.random, vistos);
  if (!material.conceptos) throw new Error('No queda material de esta prueba (¿borraste los PDFs?).');
  const casosExistentes = new Set(prueba.preguntas.filter((p) => p.caso).map((p) => p.caso.id)).size;
  const { preguntas, avisos, fallo } = await generarLote({ plan, material, evitar, signal, onProgress, desdeCaso: casosExistentes });
  if (!preguntas.length) throw new Error(`La IA no pudo crear más preguntas${detalleDe(fallo)}. Intenta de nuevo.`);
  const nueva = {
    ...prueba,
    preguntas: ordenarPreguntas([...prueba.preguntas, ...preguntas]),
    conceptosIds: [...new Set([...(prueba.conceptosIds || []), ...material.ids])],
    plan: sumaPlan(prueba.plan, plan),
    estado: 'en curso', resultado: null, entregada: undefined, aviso: avisos.join(' '),
  };
  return { prueba: nueva, nuevas: preguntas.map((p) => p.id) };
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

// Casos prácticos ficticios. Los largos se piden de a pocos por consulta (dos planas = de a uno) para que la IA no se corte a la mitad;
// se descartan los repetidos y se reintenta si faltan.
async function crearCasos(plan, material, evitar, signal, avisos, onTexto, onFallo) {
  const porCaso = preguntasPorCaso(plan);
  const extension = extensionDe(plan);
  const porLlamada = EXTENSIONES[extension].porLlamada;
  const huella = (c) => `${c.titulo} ${c.hechos.slice(0, 220)}`;
  const casos = [];
  const maxIntentos = Math.ceil(plan.casos / porLlamada) + 1;
  let fallos = 0;
  for (let intento = 0; intento < maxIntentos && casos.length < plan.casos; intento++) {
    const pedir = Math.min(porLlamada, plan.casos - casos.length);
    onTexto?.(`Creando casos prácticos (${Math.min(casos.length + 1, plan.casos)} de ${plan.casos})…`);
    try {
      const crudo = await generarPreguntasDeTipo('caso', pedir, material.texto, { signal, evitar: [...evitar, ...casos.map((c) => `CASO ya usado: ${c.titulo}`)], porCaso, extension });
      for (const c of normalizarCasos(crudo, { nuevoId })) {
        if (casos.length >= plan.casos || casos.some((x) => similares(huella(c), huella(x)))) continue;
        casos.push({ ...c, preguntas: c.preguntas.slice(0, porCaso) });
      }
    } catch (e) {
      if (e?.name === 'AbortError' || FATALES.includes(e?.code)) throw e;
      fallos += 1;
      onFallo?.(e?.message || String(e));
    }
  }
  if (casos.length < plan.casos) avisos.push(fallos && !casos.length ? 'No pude crear los casos prácticos.' : `De los casos prácticos salieron ${casos.length} de ${plan.casos} pedidos.`);
  return casos.slice(0, plan.casos);
}
