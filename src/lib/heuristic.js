// Respaldo sin IA: parte el texto por títulos (líneas cortas sin punto final, o en MAYÚSCULAS)
// y toma el texto que sigue como referencia. Menos preciso que la IA; el usuario lo corrige a mano.
const esTitulo = (l) => {
  const t = l.trim();
  if (t.length < 3 || t.length > 70) return false;
  if (/[.;,:]$/.test(t)) return false;
  if (/^\d+$/.test(t)) return false;
  const palabras = t.split(/\s+/);
  if (palabras.length > 9) return false;
  const mayus = t === t.toUpperCase() && /[A-ZÁÉÍÓÚÑ]/.test(t);
  const titulo = /^([IVXLC]+\.|\d+(\.\d+)*[.)]?|[A-Z]\))\s/.test(t) || /^[A-ZÁÉÍÓÚÑ]/.test(t);
  return mayus || (titulo && palabras.length <= 6);
};

export function conceptosPorTitulos(texto) {
  const out = [];
  let actual = null;
  for (const l of texto.split('\n')) {
    if (esTitulo(l)) {
      if (actual && actual.referencia.trim().length >= 80) out.push(actual);
      actual = { nombre: l.trim().replace(/^([IVXLC]+\.|\d+(\.\d+)*[.)]?|[A-Z]\))\s*/, ''), referencia: '' };
    } else if (actual) {
      actual.referencia += (actual.referencia ? ' ' : '') + l.trim();
    }
  }
  if (actual && actual.referencia.trim().length >= 80) out.push(actual);
  return out
    .map((c) => ({ nombre: c.nombre.slice(0, 80), referencia: c.referencia.slice(0, 1200) }))
    .filter((c) => c.nombre.length >= 3);
}
