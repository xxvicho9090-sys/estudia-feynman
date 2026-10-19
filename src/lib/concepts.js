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

// ---- Tope de conceptos por PDF ----
export const MAX_CONCEPTOS = 26;
export const MAX_TROZOS = 12; // llamadas a la IA por PDF como máximo (acota el tiempo con IAs locales)

// Cuántos conceptos pedir por trozo para no pasarse del tope (con holgura para descartar repetidos).
export const maxPorTrozo = (nTrozos, tope = MAX_CONCEPTOS) => Math.max(2, Math.min(12, Math.ceil((tope * 1.4) / Math.max(1, nTrozos))));

// Si hay más conceptos que el tope, deja los más sustanciosos (referencia más larga) y respeta el orden del PDF.
export function limitarConceptos(lista, tope = MAX_CONCEPTOS) {
  if (lista.length <= tope) return lista;
  const quedan = lista
    .map((c, i) => ({ i, largo: c.referencia.length }))
    .sort((a, b) => b.largo - a.largo || a.i - b.i)
    .slice(0, tope)
    .map((x) => x.i)
    .sort((a, b) => a - b);
  return quedan.map((i) => lista[i]);
}

// PDF muy largo: en vez de leerlo entero se toman trozos repartidos de principio a fin.
export function repartirTrozos(trozos, max = MAX_TROZOS) {
  if (trozos.length <= max) return trozos;
  return Array.from({ length: max }, (_, k) => trozos[Math.floor((k * (trozos.length - 1)) / (max - 1))]);
}
