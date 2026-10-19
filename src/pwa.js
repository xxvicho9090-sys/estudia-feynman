import { useSyncExternalStore } from 'react';
import { Capacitor } from '@capacitor/core';
import { iniciarActualizacionesWeb } from './actualizar.js';

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

// Service worker (abrir rápido y funcionar sin conexión) + aviso/botón "Actualizar" cuando hay una versión nueva publicada.
export function registrarSW() {
  if (native) return; // en el APK actualiza ota.js
  iniciarActualizacionesWeb(__APP_VERSION__);
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return;
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
