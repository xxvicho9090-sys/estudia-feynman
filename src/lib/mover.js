// Mover PDFs de un ramo a otro (arrastrando o con el botón "Mover a…").
export const TIPO_DOC = 'application/x-feynman-docs';

export function empezarArrastre(e, ids) {
  e.dataTransfer.setData(TIPO_DOC, JSON.stringify(ids));
  e.dataTransfer.setData('text/plain', ''); // algunos navegadores no inician el arrastre sin esto
  e.dataTransfer.effectAllowed = 'move';
}
// Durante el arrastre el navegador solo deja ver los tipos, no el contenido.
export const hayArrastreDoc = (e) => [...(e.dataTransfer?.types || [])].includes(TIPO_DOC);
export function leerArrastre(e) {
  try { const v = JSON.parse(e.dataTransfer.getData(TIPO_DOC)); return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []; } catch { return []; }
}

// De los PDFs pedidos, los que realmente cambian de ramo (los que ya están en el destino no cuentan).
export const docsAMover = (docs, ids, ramoId) => docs.filter((d) => ids.includes(d.id) && d.ramoId !== ramoId);
export const textoMovido = (n, ramo) => `${n} ${n === 1 ? 'PDF movido' : 'PDFs movidos'} a ${ramo}`;
