// Utilidades para subir un "pack" de PDFs (varios archivos, una carpeta o arrastrados).
export const esPdf = (f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name || '');
export const soloPdfs = (files) => [...files].filter(esPdf);
export const nombreBase = (n) => String(n).replace(/\.pdf$/i, '').trim().toLowerCase();
export const esDuplicado = (file, docsDelRamo) => docsDelRamo.some((d) => nombreBase(d.nombre) === nombreBase(file.name));
export const tamanoLegible = (b) => (b >= 1e6 ? `${(b / 1e6).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(b / 1e3))} KB`);

// Quita repetidos dentro del mismo pack (mismo nombre y tamaño), p. ej. al elegir dos veces la misma carpeta.
export function sinRepetidos(files) {
  const vistos = new Set();
  return files.filter((f) => { const k = `${nombreBase(f.name)}|${f.size}`; if (vistos.has(k)) return false; vistos.add(k); return true; });
}

// Mensaje final de una subida de varios PDFs.
export function resumenSubida({ listos, conceptos, fallidos, cancelado, total }) {
  const pdfs = (n) => `${n} ${n === 1 ? 'PDF' : 'PDFs'}`;
  const partes = [];
  if (cancelado) partes.push(`Subida cancelada: ${listos} de ${total} agregados`);
  else partes.push(`Listo: ${pdfs(listos)} ${listos === 1 ? 'agregado' : 'agregados'}`);
  if (listos) partes[0] += ` (${conceptos} conceptos)`;
  if (fallidos) partes.push(fallidos === 1 ? '1 no se pudo leer' : `${fallidos} no se pudieron leer`);
  return partes.join('. ') + '.';
}

// Arrastrar y soltar: acepta archivos sueltos y carpetas completas (recorre sus subcarpetas).
async function leerEntrada(entry, out) {
  if (entry.isFile) await new Promise((res) => entry.file((f) => { out.push(f); res(); }, res));
  else if (entry.isDirectory) {
    const lector = entry.createReader();
    let lote;
    do {
      lote = await new Promise((res) => lector.readEntries(res, () => res([])));
      for (const e of lote) await leerEntrada(e, out);
    } while (lote.length);
  }
}
export async function leerDrop(dt) {
  // Las entradas hay que tomarlas ahora mismo: el navegador las invalida después del evento.
  const entradas = [...(dt.items || [])].map((i) => i.webkitGetAsEntry?.()).filter(Boolean);
  const sueltos = [...(dt.files || [])];
  if (!entradas.length) return soloPdfs(sueltos);
  const out = [];
  for (const e of entradas) await leerEntrada(e, out);
  return soloPdfs(out);
}
