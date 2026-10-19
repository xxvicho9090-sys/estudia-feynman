import test from 'node:test';
import assert from 'node:assert/strict';

const mem = new Map();
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
const nav = (o) => Object.defineProperty(globalThis, 'navigator', { value: o, configurable: true });

const al = await import('../src/lib/autolocal.js');
const lo = await import('../src/lib/local.js');
const base = { soportado: true, listo: false, bajando: false, rechazado: false, auto: true, datosMoviles: false, libreGB: 40, memoriaGB: 8 };

test('decidirAuto: descarga sola solo cuando todo está en orden', () => {
  assert.equal(al.decidirAuto(base), 'descargar');
  assert.equal(al.decidirAuto({ ...base, libreGB: null, memoriaGB: null }), 'descargar'); // no se pudo medir: se asume bien
});

test('decidirAuto: no hace nada si no corresponde', () => {
  for (const cambio of [{ soportado: false }, { listo: true }, { bajando: true }, { rechazado: true }, { auto: false }]) {
    assert.equal(al.decidirAuto({ ...base, ...cambio }), 'nada', JSON.stringify(cambio));
  }
});

test('decidirAuto: pregunta (no descarga sola) con datos móviles o poca memoria; avisa si falta espacio', () => {
  assert.equal(al.decidirAuto({ ...base, datosMoviles: true }), 'datos');
  assert.equal(al.decidirAuto({ ...base, memoriaGB: 4 }), 'memoria');
  assert.equal(al.decidirAuto({ ...base, memoriaGB: 2 }), 'memoria');
  assert.equal(al.decidirAuto({ ...base, libreGB: 2 }), 'espacio');
  assert.equal(al.decidirAuto({ ...base, libreGB: 2, datosMoviles: true }), 'espacio'); // sin espacio manda sobre todo
});

test('preferencias: automática por defecto; "No, gracias" se recuerda', () => {
  mem.clear();
  assert.equal(al.getAutoLocal(), true);
  al.setAutoLocal(false); assert.equal(al.getAutoLocal(), false);
  al.setAutoLocal(true); assert.equal(al.getAutoLocal(), true);
  assert.equal(al.rechazoLocal(), false);
  al.setRechazoLocal(true); assert.equal(al.rechazoLocal(), true);
  al.setRechazoLocal(false); assert.equal(al.rechazoLocal(), false);
});

const dispositivo = (o = {}) => nav({ gpu: { requestAdapter: async () => ({}) }, deviceMemory: 8, storage: { estimate: async () => ({ quota: 50e9, usage: 1e9 }) }, connection: { type: 'wifi' }, ...o });

test('iniciarAutoLocal: con datos móviles deja la pregunta lista en el estado', async () => {
  mem.clear(); lo.setLocal({ fase: 'inicio', pregunta: '' });
  dispositivo({ connection: { type: 'cellular' } });
  assert.equal(await al.iniciarAutoLocal({ espera: 0 }), 'datos');
  assert.equal(lo.estadoLocal().pregunta, 'datos');
});

test('iniciarAutoLocal: poca memoria y poco espacio', async () => {
  mem.clear(); lo.setLocal({ fase: 'inicio', pregunta: '' });
  dispositivo({ deviceMemory: 4 });
  assert.equal(await al.iniciarAutoLocal({ espera: 0 }), 'memoria');
  lo.setLocal({ pregunta: '' });
  dispositivo({ storage: { estimate: async () => ({ quota: 5e9, usage: 4e9 }) } });
  assert.equal(await al.iniciarAutoLocal({ espera: 0 }), 'espacio');
});

test('iniciarAutoLocal: sin WebGPU no molesta (amigos con teléfonos viejos)', async () => {
  mem.clear(); lo.setLocal({ fase: 'inicio', pregunta: '' });
  nav({ deviceMemory: 8 });
  assert.equal(await al.iniciarAutoLocal({ espera: 0 }), 'nada');
  assert.equal(lo.estadoLocal().pregunta, '');
  dispositivo();
  al.setRechazoLocal(true);
  assert.equal(await al.iniciarAutoLocal({ espera: 0 }), 'nada'); // dijo "No, gracias"
});

test('detenerDescarga deja la fase en "pausada" y se puede reanudar', () => {
  lo.setLocal({ fase: 'bajando', f: 0.4 });
  lo.detenerDescarga();
  assert.equal(lo.estadoLocal().fase, 'pausada');
});
