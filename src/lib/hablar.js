import { vozNaturalLista, sintetizar } from './vozNatural.js';

// Voz del profesor. Tres motores, del más natural al más básico:
//  1) voces "naturales" (neuronales) del propio dispositivo: Microsoft Edge trae voces en español de Chile excelentes y gratis;
//     Chrome/Android traen las de Google;
//  2) la voz natural de la app (Piper), que se descarga una vez y sirve en cualquier dispositivo, también en el APK;
//  3) cualquier voz básica del sistema (suena robótica).
const SIN_SINTESIS = typeof window === 'undefined' || !('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined';
const ls = {
  get: (k) => { try { return localStorage.getItem(k) || ''; } catch { return ''; } },
  set: (k, v) => { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch { /* sin almacenamiento */ } },
};
export const getVoz = () => ls.get('feynman.voz') || 'auto'; // 'auto' | 'natural' | 'sys:<nombre>'
export const setVoz = (v) => ls.set('feynman.voz', v === 'auto' ? '' : v);

const delSistema = () => (SIN_SINTESIS ? [] : window.speechSynthesis.getVoices().filter((v) => /^es([-_]|$)/i.test(v.lang)));
export const esNatural = (v) => /natural|neural|online|google|premium|enhanced|siri|apple/i.test(v.name);
// Mejor voz del sistema: primero las naturales, y entre ellas el español de Chile / Latinoamérica.
export function elegirVoz(voces) {
  const es = voces.filter((v) => /^es([-_]|$)/i.test(v.lang));
  const pts = (v) => (esNatural(v) ? 100 : 0) + (/es[-_]CL/i.test(v.lang) ? 30 : /es[-_](419|MX|US|AR|CO|PE|UY)/i.test(v.lang) ? 20 : /es[-_]ES/i.test(v.lang) ? 10 : 0);
  return [...es].sort((a, b) => pts(b) - pts(a))[0] || null;
}
export const vocesDisponibles = () => delSistema().map((v) => ({ nombre: v.name, lang: v.lang, natural: esNatural(v) }));
export const hayVozNatural = () => delSistema().some(esNatural);

// Qué motor se usaría ahora. { tipo: 'natural' | 'sistema' | 'ninguno', voz?, natural: boolean (suena natural), etiqueta }
export function motorActual() {
  const pref = getVoz();
  const sis = delSistema();
  const mejor = elegirVoz(sis.length ? window.speechSynthesis.getVoices() : []);
  const app = vozNaturalLista();
  const sistema = (v) => ({ tipo: 'sistema', voz: v, natural: esNatural(v), etiqueta: `${v.name}` });
  const delApp = { tipo: 'natural', natural: true, etiqueta: 'Voz natural de la app' };
  if (pref === 'natural' && app) return delApp;
  if (pref.startsWith('sys:')) { const v = sis.find((x) => x.name === pref.slice(4)); if (v) return sistema(v); }
  if (mejor && esNatural(mejor)) return sistema(mejor);
  if (app) return delApp;
  if (mejor) return sistema(mejor);
  return { tipo: 'ninguno', natural: false, etiqueta: 'Sin voz disponible' };
}
export const puedeHablar = () => motorActual().tipo !== 'ninguno';
// Se puede ofrecer la voz (hay motor, o se puede descargar la de la app: necesita WebAssembly y Worker).
export const puedeOfrecerVoz = () => typeof Worker !== 'undefined' && typeof WebAssembly !== 'undefined';
export function alCambiarVoces(fn) {
  if (SIN_SINTESIS) return () => {};
  window.speechSynthesis.addEventListener('voiceschanged', fn);
  return () => window.speechSynthesis.removeEventListener('voiceschanged', fn);
}

// Texto listo para leer: sin comillas angulares ni símbolos que el motor deletrea.
export function paraVoz(t) {
  return String(t)
    .replace(/[«»“”"]/g, '')
    .replace(/\s+[—–-]\s+/g, ', ')
    .replace(/(\d)\s*%/g, '$1 por ciento')
    .replace(/\s*\/\s*/g, ' o ')
    .replace(/\s+/g, ' ')
    .trim();
}
// Frases (el audio de la siguiente se prepara mientras suena la anterior).
export const frases = (t) => paraVoz(t).match(/[^.!?]+[.!?]*/g)?.map((x) => x.trim()).filter((x) => /\w/.test(x)) || [];

let cola = 0;
let audio = null;
const detener = () => { if (audio) { audio.pause(); audio.src = ''; audio = null; } if (!SIN_SINTESIS) window.speechSynthesis.cancel(); };
export function callar() { cola++; detener(); }

function hablarSistema(partes, id, voz, onFin) {
  const s = window.speechSynthesis;
  partes.forEach((p, i) => {
    const u = new SpeechSynthesisUtterance(p);
    u.lang = voz?.lang || 'es-CL';
    if (voz) u.voice = voz;
    u.rate = esNatural(voz || { name: '' }) ? 1 : 0.95;
    if (i === partes.length - 1) { u.onend = () => { if (id === cola) onFin?.(); }; u.onerror = () => { if (id === cola) onFin?.(); }; }
    s.speak(u);
  });
}

function reproducir(blob, id) {
  return new Promise((res) => {
    if (id !== cola) { res(); return; }
    const url = URL.createObjectURL(blob);
    audio = new Audio(url);
    const fin = () => { URL.revokeObjectURL(url); res(); };
    audio.onended = fin; audio.onerror = fin;
    audio.play().catch(fin);
  });
}

async function hablarNatural(partes, id, onFin) {
  try {
    let sig = sintetizar(partes[0]);
    for (let i = 0; i < partes.length; i++) {
      const blob = await sig;
      if (id !== cola) return;
      if (i + 1 < partes.length) sig = sintetizar(partes[i + 1]);
      await reproducir(blob, id);
      if (id !== cola) return;
    }
    onFin?.();
  } catch {
    // Si la voz de la app falla, se sigue con la mejor voz del sistema para no quedarse mudo.
    if (id !== cola) return;
    const v = elegirVoz(SIN_SINTESIS ? [] : window.speechSynthesis.getVoices());
    if (v) hablarSistema(partes, id, v, onFin); else onFin?.();
  }
}

export function hablar(texto, onFin) {
  const partes = frases(texto);
  if (!partes.length) { onFin?.(); return; }
  const id = ++cola;
  detener();
  const m = motorActual();
  if (m.tipo === 'natural') hablarNatural(partes, id, onFin);
  else if (m.tipo === 'sistema') hablarSistema(partes, id, m.voz, onFin);
  else onFin?.();
}
