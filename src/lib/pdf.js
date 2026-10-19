import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

// PDF → texto por páginas (reconstruye líneas por la posición vertical).
export async function textoDePdf(file, onPage) {
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data, isEvalSupported: false }).promise;
  const paginas = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n);
    const content = await page.getTextContent();
    let y = null;
    let linea = '';
    const lineas = [];
    for (const it of content.items) {
      if (!('str' in it)) continue;
      const iy = Math.round(it.transform[5]);
      if (y !== null && Math.abs(iy - y) > 3) { lineas.push(linea.trim()); linea = ''; }
      y = iy;
      linea += it.str + (it.hasEOL ? '\n' : '');
    }
    lineas.push(linea.trim());
    paginas.push(lineas.filter(Boolean).join('\n'));
    page.cleanup();
    onPage?.(n, pdf.numPages);
  }
  await pdf.destroy();
  return paginas;
}

// Trozos de ~maxChars cortando en saltos de línea, para mandarlos a la IA uno por uno.
export function trocear(texto, maxChars = 6000) {
  const trozos = [];
  let actual = '';
  for (const l of texto.split('\n')) {
    if (actual.length + l.length + 1 > maxChars && actual) { trozos.push(actual); actual = ''; }
    actual += (actual ? '\n' : '') + l;
  }
  if (actual.trim()) trozos.push(actual);
  return trozos;
}
