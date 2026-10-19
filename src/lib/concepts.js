const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, '').trim();
export const nuevoId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

// Une conceptos repetidos entre trozos (mismo nombre normalizado): conserva la referencia más larga.
export function unirConceptos(lista) {
  const mapa = new Map();
  for (const c of lista) {
    const k = norm(c.nombre);
    if (!k) continue;
    const prev = mapa.get(k);
    if (!prev || c.referencia.length > prev.referencia.length) mapa.set(k, c);
  }
  return [...mapa.values()];
}
