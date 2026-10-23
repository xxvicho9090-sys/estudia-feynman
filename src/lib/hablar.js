// Voz del profesor: síntesis de voz del navegador (la app instalada en Android puede no tenerla; en ese caso solo se muestra el texto).
const hay = () => typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
export const puedeHablar = hay;

// Elige la voz en español más cercana al español de Chile.
export function elegirVoz(voces) {
  const es = voces.filter((v) => /^es([-_]|$)/i.test(v.lang));
  for (const pref of [/es[-_]CL/i, /es[-_](419|MX|US|AR|CO|PE)/i, /es[-_]ES/i]) { const v = es.find((x) => pref.test(x.lang)); if (v) return v; }
  return es[0] || null;
}

let cola = 0;
export function hablar(texto, onFin) {
  if (!hay()) { onFin?.(); return; }
  const s = window.speechSynthesis;
  s.cancel();
  const id = ++cola;
  // Frases cortas: Chrome corta las lecturas largas.
  const partes = String(texto).match(/[^.!?]+[.!?]*/g)?.map((x) => x.trim()).filter(Boolean) || [String(texto)];
  const voz = elegirVoz(s.getVoices());
  partes.forEach((p, i) => {
    const u = new SpeechSynthesisUtterance(p);
    u.lang = voz?.lang || 'es-CL';
    if (voz) u.voice = voz;
    u.rate = 0.97;
    if (i === partes.length - 1) {
      u.onend = () => { if (id === cola) onFin?.(); };
      u.onerror = () => { if (id === cola) onFin?.(); };
    }
    s.speak(u);
  });
}
export function callar() { cola++; if (hay()) window.speechSynthesis.cancel(); }
