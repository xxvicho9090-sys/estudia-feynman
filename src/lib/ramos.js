import { nuevoId } from './concepts.js';

export const COLORES = ['#3347F5', '#12A594', '#F5832B', '#D6409F', '#7C4DFF', '#C99A00'];

export const nuevoRamo = (nombre, existentes) => ({ id: nuevoId(), nombre: nombre.trim(), color: COLORES[existentes.length % COLORES.length], creado: Date.now() });

// Promedio de las notas de una lista de documentos (solo conceptos ya evaluados); null si no hay ninguna.
export function promedio(docs) {
  const notas = docs.flatMap((d) => d.conceptos.map((c) => c.nota)).filter((n) => n != null);
  return notas.length ? Math.round((notas.reduce((a, b) => a + b, 0) / notas.length) * 10) / 10 : null;
}

export const evaluados = (docs) => docs.reduce((n, d) => n + d.conceptos.filter((c) => c.nota != null).length, 0);
export const totalConceptos = (docs) => docs.reduce((n, d) => n + d.conceptos.length, 0);
