import { textoDePdf, trocear } from './pdf.js';
import { conceptosDeTexto } from './groq.js';
import { hayIA } from './ai.js';
import { conceptosPorTitulos } from './heuristic.js';
import { nuevoId, unirConceptos } from './concepts.js';

// Archivo PDF → { nombre, conceptos, aviso }. onProgress(texto, fraccion).
export async function procesarPdf(file, onProgress) {
  onProgress?.('Leyendo el PDF…', 0);
  const paginas = await textoDePdf(file, (n, total) => onProgress?.(`Leyendo página ${n} de ${total}…`, (n / total) * 0.3));
  const texto = paginas.join('\n');
  if (texto.replace(/\s/g, '').length < 80) {
    return { nombre: file.name, conceptos: [], aviso: 'Este PDF parece una imagen escaneada: no tiene texto que leer. Puedes agregar los conceptos a mano.' };
  }
  let conceptos = [];
  let aviso = '';
  if (hayIA()) {
    const trozos = trocear(texto);
    for (let i = 0; i < trozos.length; i++) {
      onProgress?.(`La IA busca conceptos (${i + 1} de ${trozos.length})…`, 0.3 + ((i + 1) / trozos.length) * 0.7);
      try {
        conceptos.push(...(await conceptosDeTexto(trozos[i])));
      } catch (e) {
        if (e.code === 'badkey' || e.code === 'limit' || e.code === 'offline') { aviso = e.message; conceptos = []; break; }
        console.warn('trozo omitido', e);
      }
    }
  } else {
    aviso = 'Sin IA conectada: separé los conceptos por títulos, que es menos preciso. Revísalos o conecta una IA gratis en Ajustes.';
  }
  if (!conceptos.length) {
    conceptos = conceptosPorTitulos(texto);
    if (conceptos.length && !aviso) aviso = 'La IA no encontró conceptos; separé por títulos. Revisa la lista.';
  }
  conceptos = unirConceptos(conceptos).map((c) => ({ id: nuevoId(), nombre: c.nombre, referencia: c.referencia, nota: null, notaFecha: null }));
  if (!conceptos.length && !aviso) aviso = 'No encontré conceptos en este PDF. Puedes agregarlos a mano.';
  return { nombre: file.name.replace(/\.pdf$/i, ''), conceptos, aviso };
}
