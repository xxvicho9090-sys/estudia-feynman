import { Capacitor } from '@capacitor/core';
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { masNueva, registrarActualizador, setActualizacion } from './actualizar.js';

// Actualizaciones del APK: Render publica /update/version.json y un zip con la web nueva; la app lo baja en segundo plano
// y, cuando está lista, aparece el botón "Actualizar" (se aplica al instante). Si no lo pulsas, queda para la próxima vez que
// abras la app. Si una versión no arranca, Capgo vuelve sola a la anterior.
const BASE = 'https://estudia-feynman.onrender.com/update/';
const native = Capacitor.isNativePlatform();
const BAD = 'feynman.badVersions';
const bad = () => { try { return JSON.parse(localStorage.getItem(BAD) || '[]'); } catch { return []; } };
const markBad = (v) => { if (!v || v === 'builtin') return; try { localStorage.setItem(BAD, JSON.stringify([...new Set([...bad(), v])].slice(-20))); } catch { /* sin almacenamiento */ } };

let busy = false;
let listo = null; // { id, version }
async function check() {
  if (busy || listo) return;
  busy = true;
  setActualizacion({ estado: 'buscando', detalle: '' });
  try {
    const res = await fetch(`${BASE}version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const info = await res.json();
    if (!info?.version || !info?.url) throw new Error('version.json incompleto');
    const want = info.force ? info.version !== __APP_VERSION__ : masNueva(info.version, __APP_VERSION__);
    if (!want || bad().includes(info.version)) { setActualizacion({ estado: 'alDia', version: info.version }); return; }
    const { bundles } = await CapacitorUpdater.list();
    let b = bundles.find((x) => x.version === info.version && x.status !== 'error');
    if (!b) {
      setActualizacion({ estado: 'descargando', version: info.version });
      b = await CapacitorUpdater.download({ url: new URL(info.url, BASE).href, version: info.version, checksum: info.checksum });
    }
    await CapacitorUpdater.next({ id: b.id });
    await CapacitorUpdater.setMultiDelay({ delayConditions: [{ kind: 'kill' }] }).catch(() => {});
    listo = { id: b.id, version: info.version };
    setActualizacion({ estado: 'lista', version: info.version, notas: info.notes || '' });
  } catch (e) {
    console.warn('Actualización no disponible:', e);
    setActualizacion({ estado: 'error', detalle: 'No pude comprobar si hay una versión nueva. Revisa tu internet.' });
  } finally { busy = false; }
}

// Aplica de inmediato la versión descargada: reinicia la web de la app con los archivos nuevos (sin cerrarla).
async function aplicar() {
  if (!listo) { await check(); if (!listo) return; }
  await CapacitorUpdater.set({ id: listo.id });
}

if (native) {
  registrarActualizador({ buscar: check, aplicar });
  CapacitorUpdater.notifyAppReady().catch(() => {});
  CapacitorUpdater.addListener('updateFailed', (e) => markBad(e?.bundle?.version)).catch?.(() => {});
  setTimeout(check, 3000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
  setInterval(() => { if (document.visibilityState === 'visible') check(); }, 15 * 60 * 1000);
}
