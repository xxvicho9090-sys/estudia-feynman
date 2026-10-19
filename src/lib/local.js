// IA que corre DENTRO de la app/navegador (WebGPU), sin servidor ni claves y sin internet después de descargarla.
// La librería es pesada: solo se carga cuando se usa (import dinámico).
export const MODELO = 'Llama-3.2-3B-Instruct-q4f16_1-MLC'; // ~2 GB, buen español y entiende JSON
export const TAMANO = '≈ 2 GB';
const FLAG = 'feynman.local'; // 'listo' cuando el modelo ya está descargado

const flag = {
  get: () => { try { return localStorage.getItem(FLAG) === 'listo'; } catch { return false; } },
  set: (v) => { try { v ? localStorage.setItem(FLAG, 'listo') : localStorage.removeItem(FLAG); } catch { /* sin almacenamiento */ } },
};
export const localListo = flag.get;

// ¿Este dispositivo puede correr el modelo? (WebGPU + algo de memoria)
export async function soporte() {
  if (typeof navigator === 'undefined' || !navigator.gpu) return { ok: false, motivo: 'Este navegador o dispositivo no tiene WebGPU (usa Chrome o Edge actualizado en una laptop o tablet reciente).' };
  try {
    const a = await navigator.gpu.requestAdapter();
    if (!a) return { ok: false, motivo: 'No encontré una tarjeta gráfica compatible con WebGPU.' };
  } catch { return { ok: false, motivo: 'WebGPU no está disponible en este dispositivo.' }; }
  const gb = navigator.deviceMemory || 8;
  return { ok: true, aviso: gb <= 4 ? 'Este dispositivo tiene poca memoria: la IA puede ser muy lenta o cerrarse sola.' : '' };
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

// Misma forma que las otras IAs: recibe mensajes y devuelve texto.
export async function chatLocal(messages, signal, esquema) {
  const m = await prepararLocal();
  const parar = () => m.interruptGenerate?.();
  signal?.addEventListener('abort', parar, { once: true });
  try {
    const r = await m.chat.completions.create({ messages, temperature: 0.2, max_tokens: 1800, ...(esquema ? { response_format: { type: 'json_object', schema: JSON.stringify(esquema) } } : {}) });
    return r.choices?.[0]?.message?.content ?? '';
  } finally { signal?.removeEventListener('abort', parar); }
}

export async function borrarLocal() {
  try { await motor?.unload(); } catch { /* ya descargado */ }
  motor = null; worker?.terminate(); worker = null;
  try { const web = await import('@mlc-ai/web-llm'); await web.deleteModelAllInfoInCache(MODELO); } catch { /* sin caché */ }
  flag.set(false);
}
