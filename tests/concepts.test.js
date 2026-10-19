import test from 'node:test';
import assert from 'node:assert/strict';
import { unirConceptos } from '../src/lib/concepts.js';
import { conceptosPorTitulos } from '../src/lib/heuristic.js';

test('unirConceptos junta repetidos sin importar tildes ni mayúsculas', () => {
  const r = unirConceptos([
    { nombre: 'Persona Jurídica', referencia: 'corta' },
    { nombre: 'persona juridica', referencia: 'una referencia bastante más larga' },
    { nombre: 'Capital social', referencia: 'x' },
  ]);
  assert.equal(r.length, 2);
  assert.equal(r.find((c) => /persona/i.test(c.nombre)).referencia, 'una referencia bastante más larga');
});

test('conceptosPorTitulos separa por títulos y usa el texto siguiente', () => {
  const largo = 'Es el aporte en dinero o bienes que hacen los socios al formar la sociedad y que sirve de garantía a los acreedores.';
  const texto = `CAPITAL SOCIAL\n${largo}\nSe divide en acciones o cuotas según el tipo de sociedad.\nPersona jurídica\n${largo.replace('aporte', 'ente')}\nOtra línea de la definición para alcanzar largo mínimo suficiente.`;
  const r = conceptosPorTitulos(texto);
  assert.equal(r.length, 2);
  assert.equal(r[0].nombre, 'CAPITAL SOCIAL');
  assert.match(r[0].referencia, /acciones o cuotas/);
});

test('conceptosPorTitulos ignora títulos sin contenido', () => {
  assert.equal(conceptosPorTitulos('TITULO SOLO\nOtro titulo').length, 0);
});
