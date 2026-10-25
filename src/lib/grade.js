// Nota 1–7 (escala chilena, exigencia 60 %): 4,0 con 60 % del puntaje, 7,0 con 100 %, 1,0 con 0 %.
// La IA solo clasifica ideas; la nota la calcula la app con esta fórmula fija para que sea siempre consistente.

export const ESTADOS = ['bien', 'parcial', 'falta', 'incorrecto'];

export function puntajeDeIdeas(ideas) {
  if (!ideas.length) return 0;
  let pts = 0;
  for (const i of ideas) {
    if (i.estado === 'bien') pts += 1;
    else if (i.estado === 'parcial') pts += 0.5;
    else if (i.estado === 'incorrecto') pts -= 0.25; // decir algo falso resta
  }
  return Math.max(0, Math.min(100, (pts / ideas.length) * 100));
}

export function notaDePuntaje(p) {
  const x = Math.max(0, Math.min(100, Number(p) || 0));
  const n = x < 60 ? 1 + (3 * x) / 60 : 4 + (3 * (x - 60)) / 40;
  return Math.round(n * 10) / 10;
}

export function notaDeIdeas(ideas) {
  return notaDePuntaje(puntajeDeIdeas(ideas));
}

export const formatoNota = (n) => n.toFixed(1).replace('.', ',');

export function mensajeNota(n) {
  if (n >= 6.5) return 'Excelente: lo dominas';
  if (n >= 5.5) return 'Muy bien, casi perfecto';
  if (n >= 4.0) return 'Vas bien, pero te faltó algo clave';
  if (n >= 3.0) return 'Aún no alcanza: repasa y vuelve a intentar';
  return 'Falta bastante: lee el material otra vez';
}

// Respuesta de la IA → ideas validadas. Acepta JSON con o sin ```cercas``` y ruido alrededor.
export function parseEvaluacion(raw) {
  const obj = extraerJson(raw);
  const lista = Array.isArray(obj?.ideas) ? obj.ideas : [];
  const ideas = lista
    .map((i) => ({
      idea: String(i?.idea ?? '').trim(),
      estado: ESTADOS.includes(i?.estado) ? i.estado : null,
      dijiste: String(i?.dijiste ?? '').trim(),
      comentario: String(i?.comentario ?? '').trim(),
    }))
    .filter((i) => i.idea && i.estado);
  if (!ideas.length) throw new Error('La IA no devolvió una evaluación válida');
  return { ideas, resumen: String(obj?.resumen ?? '').trim() };
}

export function extraerJson(raw) {
  if (raw && typeof raw === 'object') return raw;
  const s = String(raw ?? '');
  const a = s.indexOf('{');
  const b = s.lastIndexOf('}');
  if (a < 0 || b <= a) throw new Error('Respuesta sin JSON');
  try { return JSON.parse(s.slice(a, b + 1)); } catch (e) {
    const rescatado = repararJson(s.slice(a));
    if (rescatado) return rescatado;
    throw e;
  }
}

// Cierra las llaves y corchetes que faltan (ignorando lo que va entre comillas).
function cierres(s) {
  const pila = [];
  let enTexto = false, escape = false;
  for (const ch of s) {
    if (enTexto) { if (escape) escape = false; else if (ch === '\\') escape = true; else if (ch === '"') enTexto = false; continue; }
    if (ch === '"') enTexto = true;
    else if (ch === '{' || ch === '[') pila.push(ch);
    else if (ch === '}' || ch === ']') pila.pop();
  }
  return (enTexto ? '"' : '') + pila.reverse().map((c) => (c === '{' ? '}' : ']')).join('');
}

// Las IAs chicas a veces se cortan a la mitad (o se enredan al final): se rescata lo que sí quedó completo,
// por ejemplo las primeras preguntas de una lista, cortando en el último objeto cerrado que deja un JSON válido.
export function repararJson(s) {
  const t = String(s ?? '');
  for (let i = t.length - 1, intentos = 0; i > 0 && intentos < 400; i--) {
    if (t[i] !== '}') continue;
    intentos += 1;
    const cand = t.slice(0, i + 1);
    try { return JSON.parse(cand + cierres(cand)); } catch { /* se prueba con el cierre anterior */ }
  }
  return null;
}
