import { useSyncExternalStore } from 'react';
import { Capacitor, SystemBars } from '@capacitor/core';

// Pantalla completa: en el navegador/laptop usa la API del navegador; en el APK oculta las barras del sistema.
const native = Capacitor.isNativePlatform();
const KEY = 'feynman.pantallaCompleta';
let activa = false;
const subs = new Set();
const emit = () => subs.forEach((f) => f());

export const puedeFullscreen = () => native || (typeof document !== 'undefined' && !!document.documentElement.requestFullscreen);
export const useFullscreen = () => useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => activa);

async function aplicar(on) {
  if (native) { await (on ? SystemBars.hide() : SystemBars.show()); activa = on; try { localStorage.setItem(KEY, on ? '1' : ''); } catch { /* sin almacenamiento */ } }
  else if (on) await document.documentElement.requestFullscreen();
  else if (document.fullscreenElement) await document.exitFullscreen();
  emit();
}
export const alternarFullscreen = () => aplicar(!activa).catch(() => {});

if (typeof document !== 'undefined') {
  if (!native) document.addEventListener('fullscreenchange', () => { activa = !!document.fullscreenElement; emit(); });
  else { try { if (localStorage.getItem(KEY) === '1') aplicar(true).catch(() => {}); } catch { /* sin almacenamiento */ } } // el APK recuerda tu preferencia
}
