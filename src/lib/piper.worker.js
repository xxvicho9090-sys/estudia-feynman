// Hilo aparte para la voz natural de la app (Piper): así la pantalla no se congela mientras se genera el audio.
import { TtsSession, remove } from '@mintplex-labs/piper-tts-web';

let sesion = null;

self.onmessage = async (e) => {
  const m = e.data;
  try {
    if (m.cmd === 'init') {
      sesion = await TtsSession.create({ voiceId: m.voiceId, progress: (p) => self.postMessage({ tipo: 'progreso', url: p.url, loaded: p.loaded, total: p.total }) });
      self.postMessage({ tipo: 'listo' });
    } else if (m.cmd === 'decir') {
      const blob = await sesion.predict(m.texto);
      self.postMessage({ tipo: 'audio', id: m.id, blob });
    } else if (m.cmd === 'borrar') {
      await remove(m.voiceId);
      self.postMessage({ tipo: 'borrada' });
    }
  } catch (err) {
    self.postMessage({ tipo: 'error', id: m.id, mensaje: String(err?.message || err) });
  }
};
