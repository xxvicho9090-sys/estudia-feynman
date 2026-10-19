import test from 'node:test';
import assert from 'node:assert/strict';
import { esPdf, soloPdfs, nombreBase, esDuplicado, tamanoLegible, sinRepetidos, resumenSubida, leerDrop } from '../src/lib/archivos.js';

const f = (name, size = 1000, type = '') => ({ name, size, type });

test('soloPdfs deja PDFs por tipo o extensión (mayúsculas incluidas) y descarta lo demás', () => {
  const r = soloPdfs([f('a.pdf'), f('B.PDF'), f('c.docx'), f('sin-extension', 5, 'application/pdf'), f('foto.png', 5, 'image/png'), f('d.pdf.txt')]);
  assert.deepEqual(r.map((x) => x.name), ['a.pdf', 'B.PDF', 'sin-extension']);
  assert.equal(esPdf(f('x.PdF')), true);
});

test('repetidos contra el ramo: ignora mayúsculas, espacios y la extensión', () => {
  const docs = [{ nombre: 'Clase 3 — Sociedades' }, { nombre: 'contratos' }];
  assert.equal(esDuplicado(f('clase 3 — sociedades.PDF'), docs), true);
  assert.equal(esDuplicado(f(' Contratos .pdf'), docs), true);
  assert.equal(esDuplicado(f('Clase 4.pdf'), docs), false);
  assert.equal(nombreBase('Apunte.PDF'), 'apunte');
});

test('sinRepetidos quita el mismo archivo elegido dos veces, pero no dos distintos con igual nombre', () => {
  const r = sinRepetidos([f('a.pdf', 10), f('A.pdf', 10), f('a.pdf', 99), f('b.pdf', 10)]);
  assert.deepEqual(r.map((x) => `${x.name}:${x.size}`), ['a.pdf:10', 'a.pdf:99', 'b.pdf:10']);
});

test('tamaño legible', () => {
  assert.equal(tamanoLegible(500), '1 KB');
  assert.equal(tamanoLegible(250_000), '250 KB');
  assert.equal(tamanoLegible(2_500_000), '2,5 MB');
});

test('resumen final de la subida', () => {
  assert.equal(resumenSubida({ listos: 11, conceptos: 214, fallidos: 1, cancelado: false, total: 12 }), 'Listo: 11 PDFs agregados (214 conceptos). 1 no se pudo leer.');
  assert.equal(resumenSubida({ listos: 1, conceptos: 20, fallidos: 0, cancelado: false, total: 1 }), 'Listo: 1 PDF agregado (20 conceptos).');
  assert.equal(resumenSubida({ listos: 4, conceptos: 90, fallidos: 0, cancelado: true, total: 12 }), 'Subida cancelada: 4 de 12 agregados (90 conceptos).');
  assert.equal(resumenSubida({ listos: 0, conceptos: 0, fallidos: 3, cancelado: false, total: 3 }), 'Listo: 0 PDFs agregados. 3 no se pudieron leer.');
});

test('leerDrop sin soporte de carpetas usa los archivos sueltos', async () => {
  const r = await leerDrop({ items: [], files: [f('a.pdf'), f('b.txt')] });
  assert.deepEqual(r.map((x) => x.name), ['a.pdf']);
});

test('leerDrop recorre carpetas y subcarpetas completas', async () => {
  const archivo = (nombre) => ({ isFile: true, file: (ok) => ok(f(nombre)) });
  const carpeta = (hijos) => { let entregado = false; return { isDirectory: true, createReader: () => ({ readEntries: (ok) => { if (entregado) return ok([]); entregado = true; ok(hijos); } }) }; };
  const raiz = carpeta([archivo('uno.pdf'), archivo('notas.txt'), carpeta([archivo('dos.PDF'), carpeta([archivo('tres.pdf')])])]);
  const r = await leerDrop({ items: [{ webkitGetAsEntry: () => raiz }, { webkitGetAsEntry: () => archivo('suelto.pdf') }], files: [] });
  assert.deepEqual(r.map((x) => x.name).sort(), ['dos.PDF', 'suelto.pdf', 'tres.pdf', 'uno.pdf']);
});
