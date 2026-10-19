import { useSyncExternalStore } from 'react';

// Estado único de las actualizaciones, para el botón "Actualizar" (web y APK).
//  estado: idle | buscando | descargando | lista | alDia | error
let est = { estado: 'idle', version: '', notas: '', detalle: '' };
const subs = new Set();
export const estadoActualizacion = () => est;
export const setActualizacion = (p) => { est = { ...est, ...p }; subs.forEach((f) => f()); };
export const useActualizacion = () => useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => est);

// Cada plataforma registra cómo buscar y cómo aplicar.
let buscarFn = null;
let aplicarFn = null;
export const registrarActualizador = ({ buscar, aplicar }) => { buscarFn = buscar; aplicarFn = aplicar; };
export const buscarActualizacion = () => (est.estado === 'buscando' || est.estado === 'descargando' ? Promise.resolve() : buscarFn?.() ?? Promise.resolve());
export const aplicarActualizacion = async () => { try { await (aplicarFn ? aplicarFn() : location.reload()); } catch { location.reload(); } };

// "2.10.1" es mayor que "2.9.0".
export function masNueva(a, b) {
  const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number);
  for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0);
  return false;
}

// ---- Web / PWA: compara la versión publicada en el servidor con la que estás usando ----
const PROD = typeof import.meta !== 'undefined' && import.meta.env?.PROD;
export function iniciarActualizacionesWeb(versionActual) {
  const buscar = async () => {
    setActualizacion({ estado: 'buscando', detalle: '' });
    try {
      const res = await fetch(`./update/version.json?t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const info = await res.json();
      if (!info?.version) throw new Error('version.json incompleto');
      const hay = info.force ? info.version !== versionActual : masNueva(info.version, versionActual);
      setActualizacion(hay ? { estado: 'lista', version: info.version, notas: info.notes || '' } : { estado: 'alDia', version: info.version });
    } catch (e) {
      setActualizacion({ estado: 'error', detalle: 'No pude comprobar si hay una versión nueva. Revisa tu internet.' });
    }
  };
  // Recarga limpia: borra lo guardado por el service worker para traer los archivos nuevos.
  const aplicar = async () => {
    try { for (const k of await caches.keys()) await caches.delete(k); } catch { /* sin caché */ }
    try { for (const r of await navigator.serviceWorker.getRegistrations()) await r.update(); } catch { /* sin service worker */ }
    location.reload();
  };
  registrarActualizador({ buscar, aplicar });
  if (!PROD) return;
  setTimeout(buscar, 2500);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && est.estado !== 'lista') buscar(); });
  setInterval(() => { if (document.visibilityState === 'visible' && est.estado !== 'lista') buscar(); }, 15 * 60 * 1000);
}
