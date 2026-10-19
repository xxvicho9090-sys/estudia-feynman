import { hayIA } from './ai.js';
import { descargarLocal, estadoLocal, setLocal, soporte, ESPACIO_MIN_GB } from './local.js';

// Descarga automática de la IA offline, para que quien reciba la app no tenga que instalar nada:
// se baja sola en segundo plano la primera vez. Reglas para no molestar:
//  · solo si el dispositivo la soporta (WebGPU) y hay espacio libre,
//  · sin avisar de más: con datos móviles o poca memoria se PREGUNTA en vez de bajarla sola,
//  · se respeta "No, gracias" y se puede apagar en Ajustes.
const k = { auto: 'feynman.localAuto', no: 'feynman.localNo' };
const ls = {
  get: (x) => { try { return localStorage.getItem(x) || ''; } catch { return ''; } },
  set: (x, v) => { try { v ? localStorage.setItem(x, v) : localStorage.removeItem(x); } catch { /* sin almacenamiento */ } },
};
export const getAutoLocal = () => ls.get(k.auto) !== '0'; // activada por defecto
export const setAutoLocal = (v) => ls.set(k.auto, v ? '' : '0');
export const rechazoLocal = () => ls.get(k.no) === '1';
export const setRechazoLocal = (v) => ls.set(k.no, v ? '1' : '');

// Decisión pura (probada en tests): qué hacer según cómo está el dispositivo.
export function decidirAuto({ soportado, listo, bajando, rechazado, auto, datosMoviles, libreGB, memoriaGB }) {
  if (!soportado || listo || bajando || rechazado || !auto) return 'nada';
  if (libreGB != null && libreGB < ESPACIO_MIN_GB) return 'espacio';
  if (memoriaGB != null && memoriaGB <= 4) return 'memoria';
  if (datosMoviles) return 'datos';
  return 'descargar';
}

async function espacioLibreGB() {
  try { const e = await navigator.storage?.estimate?.(); return e?.quota ? (e.quota - (e.usage || 0)) / 1e9 : null; } catch { return null; }
}
const datosMoviles = () => { const c = typeof navigator !== 'undefined' ? navigator.connection : null; return !!c && (c.type === 'cellular' || c.saveData === true); };

// Se llama al abrir la app. Devuelve la decisión (útil para pruebas).
export async function iniciarAutoLocal({ espera } = {}) {
  const sop = await soporte();
  const e = estadoLocal();
  const accion = decidirAuto({
    soportado: sop.ok, listo: e.fase === 'listo', bajando: e.fase === 'bajando', rechazado: rechazoLocal(), auto: getAutoLocal(),
    datosMoviles: datosMoviles(), libreGB: await espacioLibreGB(), memoriaGB: sop.memoriaGB ?? null,
  });
  // Sin ninguna IA conectada (p. ej. un amigo que recién abre la app) empieza casi de inmediato; si ya hay una, con calma.
  if (accion === 'descargar') setTimeout(() => { if (['inicio', 'pausada'].includes(estadoLocal().fase) && !rechazoLocal()) descargarLocal({ auto: true }); }, espera ?? (hayIA() ? 15000 : 2000));
  else if (['datos', 'memoria', 'espacio'].includes(accion)) setLocal({ pregunta: accion });
  return accion;
}
