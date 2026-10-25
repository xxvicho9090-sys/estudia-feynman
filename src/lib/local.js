import { useSyncExternalStore } from 'react';

// IA que corre DENTRO de la app/navegador (WebGPU), sin servidor ni claves y sin internet después de descargarla.
// La librería es pesada: solo se carga cuando se usa (import dinámico). El modelo se descarga solo la primera vez.
export const MODELO = 'Llama-3.2-3B-Instruct-q4f16_1-MLC'; // ~2 GB, buen español y entiende JSON
export const TAMANO = '≈ 2 GB';
export const ESPACIO_MIN_GB = 3.5; // lo que debe haber libre para descargarla
const FLAG = 'feynman.local'; // 'listo' cuando el modelo ya está descargado

const flag = {
  get: () => { try { return localStorage.getItem(FLAG) === 'listo'; } catch { return false; } },
  set: (v) => { try { v ? localStorage.setItem(FLAG, 'listo') : localStorage.removeItem(FLAG); } catch { /* sin almacenamiento */ } },
};
export const localListo = flag.get;

// ---- Estado compartido (pantalla principal y Ajustes muestran lo mismo) ----
// fase: inicio | bajando | pausada | error | listo ; pregunta: '' | 'datos' | 'memoria' | 'espacio' (por qué no se baja sola)
let est = { fase: flag.get() ? 'listo' : 'inicio', f: 0, texto: '', error: '', auto: false, pregunta: '' };
const subs = new Set();
export const setLocal = (p) => { est = { ...est, ...p }; subs.forEach((f) => f()); };
export const estadoLocal = () => est;
export const useLocal = () => useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => est);

// ¿Este dispositivo puede correr el modelo? (WebGPU + algo de memoria)
export async function soporte() {
  if (typeof navigator === 'undefined' || !navigator.gpu) return { ok: false, motivo: 'Este navegador o dispositivo no tiene WebGPU (usa Chrome o Edge actualizado en una laptop o tablet reciente).' };
  try {
    const a = await navigator.gpu.requestAdapter();
    if (!a) return { ok: false, motivo: 'No encontré una tarjeta gráfica compatible con WebGPU.' };
  } catch { return { ok: false, motivo: 'WebGPU no está disponible en este dispositivo.' }; }
  const gb = navigator.deviceMemory || 8;
  return { ok: true, memoriaGB: gb, aviso: gb <= 4 ? 'Este dispositivo tiene poca memoria: la IA puede ser muy lenta o cerrarse sola.' : '' };
}

let motor = null;
let cargando = null;
let worker = null;

async function crearMotor(onProgreso) {
  const web = await import('@mlc-ai/web-llm');
  worker = new Worker(new URL('./llm.worker.js', import.meta.url), { type: 'module' });
  return web.CreateWebWorkerMLCEngine(worker, MODELO, { initProgressCallback: (r) => onProgreso?.(r.text, r.progress) }, { context_window_size: 6144 });
}

// Descarga (la primera vez) y deja el motor listo. onProgreso(texto, 0..1).
export async function prepararLocal(onProgreso) {
  if (motor) return motor;
  if (!cargando) {
    cargando = crearMotor(onProgreso)
      .then((m) => { motor = m; flag.set(true); return m; })
      .catch((e) => { worker?.terminate(); worker = null; throw e; })
      .finally(() => { cargando = null; });
  }
  return cargando;
}

// Descarga con estado visible. Lo ya descargado se conserva, así que reintentar o reanudar no empieza de cero.
export async function descargarLocal({ auto = false } = {}) {
  if (est.fase === 'bajando' || est.fase === 'listo') return;
  setLocal({ fase: 'bajando', f: 0, texto: 'Preparando la descarga…', error: '', auto, pregunta: '' });
  try {
    try { await navigator.storage?.persist?.(); } catch { /* opcional: pide que el navegador no borre la IA */ }
    await prepararLocal((texto, f) => { if (est.fase === 'bajando') setLocal({ texto, f: f || 0 }); });
    setLocal({ fase: 'listo', f: 1 });
  } catch (e) {
    if (est.fase === 'pausada') return;
    setLocal({ fase: 'error', error: `No se pudo descargar: ${String(e?.message || e).slice(0, 160)}` });
  }
}

export function detenerDescarga() {
  worker?.terminate(); worker = null; cargando = null; motor = null;
  setLocal({ fase: 'pausada', texto: '' });
}

// Misma forma que las otras IAs: recibe mensajes y devuelve texto.
export const calentarLocal = () => prepararLocal();

// Si la tarjeta gráfica se queda sin memoria (o el navegador la reinicia), WebLLM descarga el modelo solo y TODAS las consultas siguientes
// fallan con «Model not loaded». Se detecta y se vuelve a cargar el motor desde lo ya descargado (sin bajar nada de nuevo).
export const modeloPerdido = (e) => /not loaded|ModelNotLoaded|device.{0,12}lost|DeviceLost|out of memory|OutOfMemory/i.test(String(e?.message || e));
export function reiniciarMotor() { try { worker?.terminate(); } catch { /* ya detenido */ } worker = null; motor = null; cargando = null; }

// En algunos dispositivos (se vio en una tablet) la decodificación guiada por esquema falla a medio camino con
// «Grammar matcher rejected the newly sampled token». Ahí se sigue SIN esquema (el formato JSON lo pide el propio prompt y se valida después)
// y se recuerda para ese dispositivo, para no volver a fallar y perder tiempo.
export const errorGramatica = (e) => /grammar|rejected the newly sampled/i.test(String(e?.message || e));
const GRAMATICA = 'feynman.localSinGramatica';
const sinGramaticaGuardado = () => { try { return localStorage.getItem(GRAMATICA) === '1'; } catch { return false; } };
const guardarSinGramatica = () => { try { localStorage.setItem(GRAMATICA, '1'); } catch { /* sin almacenamiento */ } };

// Reintentos: sin esquema si falla la gramática, y con el motor recargado si la GPU perdió el modelo (cada remedio se usa una sola vez).
export async function conRespaldo(intento, { signal, reiniciar = () => {}, sinEsquemaInicial = false, marcarSinEsquema = () => {} } = {}) {
  let sinEsquema = sinEsquemaInicial;
  let recargado = false;
  for (let n = 0; n < 3; n++) {
    try { return await intento(sinEsquema); } catch (e) {
      if (e?.name === 'AbortError' || signal?.aborted) throw e;
      if (errorGramatica(e) && !sinEsquema) { sinEsquema = true; marcarSinEsquema(); continue; }
      if (modeloPerdido(e) && !recargado) { recargado = true; reiniciar(); continue; }
      throw e;
    }
  }
  throw new Error('La IA offline no pudo responder.');
}

export function chatLocal(messages, signal, esquema, rapido) {
  return conRespaldo((sinEsquema) => chatLocalUnaVez(messages, signal, esquema, rapido, sinEsquema), {
    signal, reiniciar: reiniciarMotor, sinEsquemaInicial: sinGramaticaGuardado(), marcarSinEsquema: guardarSinGramatica,
  });
}

async function chatLocalUnaVez(messages, signal, esquema, rapido, sinEsquema) {
  const m = await prepararLocal();
  const parar = () => m.interruptGenerate?.();
  signal?.addEventListener('abort', parar, { once: true });
  try {
    if (sinEsquema) { try { await m.resetChat?.(); } catch { /* sin conversación previa */ } }
    const usar = esquema && !sinEsquema;
    // Sin esquema se refuerza en el último mensaje que la respuesta debe ser solo el JSON.
    const msgs = esquema && sinEsquema ? messages.map((x, i) => (i === messages.length - 1 ? { ...x, content: x.content + '\n\nResponde únicamente con el JSON pedido, sin texto antes ni después.' } : x)) : messages;
    const r = await m.chat.completions.create({ messages: msgs, temperature: rapido ? 0 : 0.2, max_tokens: rapido ? 700 : 1800, ...(usar ? { response_format: { type: 'json_object', schema: JSON.stringify(esquema) } } : {}) });
    return r.choices?.[0]?.message?.content ?? '';
  } finally { signal?.removeEventListener('abort', parar); }
}

export async function borrarLocal() {
  try { await motor?.unload(); } catch { /* ya descargado */ }
  motor = null; cargando = null; worker?.terminate(); worker = null;
  try { const web = await import('@mlc-ai/web-llm'); await web.deleteModelAllInfoInCache(MODELO); } catch { /* sin caché */ }
  flag.set(false);
  setLocal({ fase: 'inicio', f: 0, texto: '', error: '' });
}
