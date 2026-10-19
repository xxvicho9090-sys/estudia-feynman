import { Capacitor } from '@capacitor/core';
import { SpeechRecognition as Native } from '@capacitor-community/speech-recognition';

// Dictado: plugin nativo en el APK, Web Speech en el navegador. Si no hay ninguno, soportado() = false y se escribe.
const Web = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;
const nativo = Capacitor.isNativePlatform();
export const soportado = () => nativo || !!Web;

let web = null;
let nativeHandle = null;

// onTexto(textoCompleto) se llama con lo dictado en esta sesión; onFin() al terminar.
export async function empezarDictado(onTexto, onFin, onError) {
  if (nativo) {
    try {
      const perm = await Native.requestPermissions();
      if (perm.speechRecognition !== 'granted') { onError?.('Sin permiso del micrófono. Actívalo en los ajustes del teléfono o escribe.'); onFin?.(); return; }
      nativeHandle = await Native.addListener('partialResults', (d) => onTexto(d.matches?.[0] || ''));
      await Native.start({ language: 'es-CL', maxResults: 1, partialResults: true, popup: false });
    } catch (e) { onError?.('No se pudo iniciar el dictado. Escribe tu explicación.'); onFin?.(); }
    return;
  }
  web = new Web();
  web.lang = 'es-CL';
  web.continuous = true;
  web.interimResults = true;
  web.onresult = (ev) => { let t = ''; for (let i = 0; i < ev.results.length; i++) t += ev.results[i][0].transcript; onTexto(t); };
  web.onerror = (ev) => { if (ev.error !== 'no-speech' && ev.error !== 'aborted') onError?.('El dictado no está disponible. Escribe tu explicación.'); };
  web.onend = () => onFin?.();
  web.start();
}

export async function pararDictado() {
  if (nativo) {
    try { await Native.stop(); } catch { /* ya detenido */ }
    try { await nativeHandle?.remove(); } catch { /* ya removido */ }
    nativeHandle = null;
  } else web?.stop();
}
