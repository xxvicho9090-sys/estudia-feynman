import { useSyncExternalStore } from 'react';
import { Capacitor } from '@capacitor/core';

// Web instalable (laptop y Android) + actualización automática. En el APK no se usa: ahí actualiza ota.js.
const native = Capacitor.isNativePlatform();
export const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

let prompt = null;
let instalada = standalone();
const subs = new Set();
const emit = () => subs.forEach((f) => f());
const snapshot = () => (native || instalada ? 'no' : prompt ? 'listo' : 'manual');
export const useInstalable = () => useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, snapshot);

if (!native) {
  addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); prompt = e; emit(); });
  addEventListener('appinstalled', () => { instalada = true; prompt = null; emit(); });
}

export async function instalar() {
  if (!prompt) return false;
  prompt.prompt();
  const { outcome } = await prompt.userChoice;
  prompt = null; emit();
  return outcome === 'accepted';
}

// Service worker: si llega una versión nueva se aplica sola cuando la app está en segundo plano;
// con la app abierta se avisa con un botón para no perder lo que estás escribiendo.
export function registrarSW(avisar) {
  if (native || !('serviceWorker' in navigator) || !import.meta.env.PROD) return;
  const habia = !!navigator.serviceWorker.controller;
  let recargando = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!habia || recargando) return;
    if (document.hidden) { recargando = true; location.reload(); return; }
    avisar(() => { recargando = true; location.reload(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden && !recargando) { recargando = true; location.reload(); } });
  });
  navigator.serviceWorker.register('./sw.js').then((reg) => {
    const buscar = () => reg.update().catch(() => {});
    setInterval(buscar, 30 * 60 * 1000);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') buscar(); });
  }).catch(() => {});
}
