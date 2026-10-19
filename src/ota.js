import { Capacitor } from '@capacitor/core';
import { CapacitorUpdater } from '@capgo/capacitor-updater';

// Actualizaciones desde la misma app: Render publica /update/version.json y un zip con la web nueva;
// la app lo baja en segundo plano y queda activa al reabrirla. Si una versión no arranca, Capgo vuelve a la anterior.
const BASE = 'https://estudia-feynman.onrender.com/update/';
const native = Capacitor.isNativePlatform();
const newer = (a, b) => { const x = a.split('.').map(Number), y = b.split('.').map(Number); for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); return false; };
const BAD = 'feynman.badVersions';
const bad = () => { try { return JSON.parse(localStorage.getItem(BAD) || '[]'); } catch { return []; } };
const markBad = (v) => { if (!v || v === 'builtin') return; try { localStorage.setItem(BAD, JSON.stringify([...new Set([...bad(), v])].slice(-20))); } catch { /* sin almacenamiento */ } };

function toast(text) {
  const t = document.createElement('div');
  t.textContent = text;
  t.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);max-width:88vw;background:#1a1612;color:#fff;padding:12px 18px;border-radius:12px;font:500 14px DM Sans,system-ui,sans-serif;z-index:99999;box-shadow:0 6px 24px rgba(0,0,0,.3)';
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 6000);
}

let busy = false;
let pending = false;
async function check() {
  if (busy) return;
  busy = true;
  try {
    const res = await fetch(`${BASE}version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const info = await res.json();
    if (!info?.version || !info?.url) return;
    const want = info.force ? info.version !== __APP_VERSION__ : newer(info.version, __APP_VERSION__);
    if (!want || bad().includes(info.version)) return;
    const { bundles } = await CapacitorUpdater.list();
    let b = bundles.find((x) => x.version === info.version && x.status !== 'error');
    if (!b) b = await CapacitorUpdater.download({ url: new URL(info.url, BASE).href, version: info.version, checksum: info.checksum });
    await CapacitorUpdater.next({ id: b.id });
    await CapacitorUpdater.setMultiDelay({ delayConditions: [{ kind: 'kill' }] }).catch(() => {});
    pending = true;
    toast(`Actualización ${info.version} lista: se aplica al reabrir la app`);
  } catch (e) { console.warn('Actualización no disponible:', e); } finally { busy = false; }
}

if (native) {
  window.__FEYNMAN_VERSION__ = __APP_VERSION__;
  CapacitorUpdater.notifyAppReady().catch(() => {});
  CapacitorUpdater.addListener('updateFailed', (e) => markBad(e?.bundle?.version)).catch?.(() => {});
  setTimeout(check, 3000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && !pending) check(); });
  setInterval(() => { if (!pending && document.visibilityState === 'visible') check(); }, 15 * 60 * 1000);
}
