import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.location = { reload: () => { globalThis.__recargado = true; } };
const a = await import('../src/actualizar.js');

test('masNueva compara versiones numéricamente', () => {
  assert.equal(a.masNueva('2.10.0', '2.9.9'), true);
  assert.equal(a.masNueva('2.9.0', '2.9.0'), false);
  assert.equal(a.masNueva('2.8.9', '2.9.0'), false);
  assert.equal(a.masNueva('3.0.0', '2.99.99'), true);
  assert.equal(a.masNueva('2.9', '2.9.0'), false);
});

test('buscar y aplicar usan lo que registra cada plataforma', async () => {
  const llamadas = [];
  a.registrarActualizador({ buscar: async () => { llamadas.push('buscar'); a.setActualizacion({ estado: 'lista', version: '9.9.9' }); }, aplicar: async () => { llamadas.push('aplicar'); } });
  await a.buscarActualizacion();
  await a.aplicarActualizacion();
  assert.deepEqual(llamadas, ['buscar', 'aplicar']);
});

test('no lanza dos búsquedas a la vez', async () => {
  let n = 0;
  a.registrarActualizador({ buscar: async () => { n++; }, aplicar: async () => {} });
  a.setActualizacion({ estado: 'buscando' });
  await a.buscarActualizacion();
  assert.equal(n, 0);
  a.setActualizacion({ estado: 'idle' });
  await a.buscarActualizacion();
  assert.equal(n, 1);
});

test('si aplicar falla, igual recarga la página', async () => {
  globalThis.__recargado = false;
  a.registrarActualizador({ buscar: async () => {}, aplicar: async () => { throw new Error('plugin roto'); } });
  await a.aplicarActualizacion();
  assert.equal(globalThis.__recargado, true);
});

test('web: detecta versión nueva, "al día", error de red, y aplica con recarga limpia', async () => {
  globalThis.document = { addEventListener() {}, visibilityState: 'visible' };
  Object.defineProperty(globalThis, 'navigator', { value: { serviceWorker: { getRegistrations: async () => [{ update: async () => {} }] } }, configurable: true });
  const borradas = [];
  globalThis.caches = { keys: async () => ['c1', 'c2'], delete: async (k) => { borradas.push(k); return true; } };
  let respuesta = () => new Response(JSON.stringify({ version: '2.10.0', notes: 'novedades' }));
  globalThis.fetch = async () => respuesta();
  a.iniciarActualizacionesWeb('2.9.0');

  a.setActualizacion({ estado: 'idle' });
  await a.buscarActualizacion();
  assert.deepEqual([a.estadoActualizacion().estado, a.estadoActualizacion().version, a.estadoActualizacion().notas], ['lista', '2.10.0', 'novedades']);

  globalThis.__recargado = false;
  await a.aplicarActualizacion();
  assert.deepEqual(borradas, ['c1', 'c2']);
  assert.equal(globalThis.__recargado, true);

  respuesta = () => new Response(JSON.stringify({ version: '2.9.0' }));
  a.setActualizacion({ estado: 'idle' });
  await a.buscarActualizacion();
  assert.equal(a.estadoActualizacion().estado, 'alDia');

  respuesta = () => { throw new TypeError('sin internet'); };
  a.setActualizacion({ estado: 'idle' });
  await a.buscarActualizacion();
  assert.equal(a.estadoActualizacion().estado, 'error');
  assert.match(a.estadoActualizacion().detalle, /internet/);

  respuesta = () => new Response('<html>no json</html>');
  a.setActualizacion({ estado: 'idle' });
  await a.buscarActualizacion();
  assert.equal(a.estadoActualizacion().estado, 'error');

  respuesta = () => new Response(JSON.stringify({ version: '1.0.0', force: true }));
  a.setActualizacion({ estado: 'idle' });
  await a.buscarActualizacion();
  assert.equal(a.estadoActualizacion().estado, 'lista'); // force: instala aunque sea menor (para revertir)
});
