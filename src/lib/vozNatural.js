import { useSyncExternalStore } from 'react';

// Voz natural de la app: un modelo de voz (Piper, es_MX "claude", calidad alta) que se descarga una sola vez y habla sin internet.
// Suena mucho mejor que las voces básicas del sistema. Se genera en un hilo aparte.
export const VOZ_ID = 'es_MX-claude-high';
export const TAMANO = '≈ 63 MB';
const FLAG = 'feynman.vozNatural';

const ls = {
  get: () => { try { return localStorage.getItem(FLAG) === 'listo'; } catch { return false; } },
  set: (v) => { try { v ? localStorage.setItem(FLAG, 'listo') : localStorage.removeItem(FLAG); } catch { /* sin almacenamiento */ } },
};
export const vozNaturalLista = ls.get;

// fase: inicio | bajando | listo | error
let est = { fase: ls.get() ? 'listo' : 'inicio', f: 0, error: '' };
const subs = new Set();
const set = (p) => { est = { ...est, ...p }; subs.forEach((f) => f()); };
export const estadoVoz = () => est;
export const useVozNatural = () => useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => est);

let worker = null;
let iniciando = null;
let listoMotor = false;
const pedidos = new Map(); // id → { res, rej }
const archivos = new Map(); // url → { loaded, total } (para el avance de la descarga)
let seq = 0;

function crear() {
  worker = new Worker(new URL('./piper.worker.js', import.meta.url), { type: 'module' });
  worker.onmessage = (e) => {
    const m = e.data;
    if (m.tipo === 'progreso') {
      archivos.set(m.url, { loaded: m.loaded, total: m.total });
      const grande = [...archivos.values()].sort((a, b) => b.total - a.total)[0];
      if (grande?.total && est.fase === 'bajando') set({ f: Math.min(1, grande.loaded / grande.total) });
    } else if (m.tipo === 'audio') { pedidos.get(m.id)?.res(m.blob); pedidos.delete(m.id); }
    else if (m.tipo === 'error') { const p = pedidos.get(m.id); if (p) { p.rej(new Error(m.mensaje)); pedidos.delete(m.id); } }
  };
}

// Descarga (la primera vez) y carga el motor. Lo ya descargado se conserva en el dispositivo.
export function prepararVoz() {
  if (listoMotor) return Promise.resolve();
  if (!iniciando) {
    iniciando = new Promise((res, rej) => {
      if (!worker) crear();
      const previo = worker.onmessage;
      worker.onmessage = (e) => {
        previo(e);
        if (e.data.tipo === 'listo') { worker.onmessage = previo; res(); }
        else if (e.data.tipo === 'error' && e.data.id === undefined) { worker.onmessage = previo; rej(new Error(e.data.mensaje)); }
      };
      worker.postMessage({ cmd: 'init', voiceId: VOZ_ID });
    }).then(() => { listoMotor = true; ls.set(true); }).catch((e) => { worker?.terminate(); worker = null; throw e; }).finally(() => { iniciando = null; });
  }
  return iniciando;
}

export async function descargarVoz() {
  if (est.fase === 'bajando') return;
  set({ fase: 'bajando', f: 0, error: '' });
  try {
    try { await navigator.storage?.persist?.(); } catch { /* opcional */ }
    await prepararVoz();
    set({ fase: 'listo', f: 1 });
  } catch (e) { set({ fase: 'error', error: `No se pudo descargar la voz: ${String(e?.message || e).slice(0, 140)}` }); }
}

export async function borrarVoz() {
  try { if (worker) { worker.postMessage({ cmd: 'borrar', voiceId: VOZ_ID }); await new Promise((r) => setTimeout(r, 400)); } } catch { /* ya borrada */ }
  worker?.terminate(); worker = null; listoMotor = false; iniciando = null;
  try { const m = await import('@mintplex-labs/piper-tts-web'); await m.remove(VOZ_ID); } catch { /* sin datos */ }
  ls.set(false);
  set({ fase: 'inicio', f: 0, error: '' });
}

// Texto → audio (Blob WAV). Si el motor aún no está cargado en memoria, lo carga primero (unos segundos la primera vez).
export async function sintetizar(texto) {
  await prepararVoz();
  return new Promise((res, rej) => {
    const id = ++seq;
    pedidos.set(id, { res, rej });
    worker.postMessage({ cmd: 'decir', id, texto });
  });
}
