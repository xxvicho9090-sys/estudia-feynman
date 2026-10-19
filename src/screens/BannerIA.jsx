import { useLocal, descargarLocal, detenerDescarga, setLocal, TAMANO } from '../lib/local.js';
import { setRechazoLocal } from '../lib/autolocal.js';

// Aviso de la IA offline: avance de la descarga automática o por qué no se bajó sola.
export default function BannerIA() {
  const l = useLocal();
  const pct = Math.round((l.f || 0) * 100);
  if (l.fase === 'bajando') {
    return (
      <div className="notice info" role="status" aria-live="polite">
        <b>Preparando tu IA offline… {pct} %</b>
        <div className="prog" style={{ marginTop: 10, height: 8, background: '#fff' }}><i style={{ width: `${pct}%` }} /></div>
        <div style={{ marginTop: 8, lineHeight: 1.45 }}>Se descarga una sola vez ({TAMANO}) y queda guardada. Puedes seguir usando la app; al terminar funcionará sin internet y sin claves.</div>
        <button className="linkbtn" style={{ marginTop: 8 }} onClick={detenerDescarga}>Detener</button>
      </div>
    );
  }
  if (l.fase === 'error') {
    return <div className="notice" role="alert">{l.error} <button className="linkbtn" onClick={() => descargarLocal({ auto: true })}>Reintentar</button></div>;
  }
  if (l.fase === 'pausada') {
    return <div className="notice info" role="status">Descarga de la IA offline detenida. <button className="linkbtn" onClick={() => descargarLocal({ auto: true })}>Reanudar</button></div>;
  }
  if (l.fase !== 'inicio' || !l.pregunta) return null;
  const txt = {
    datos: `Estás con datos móviles. ¿Descargo ahora la IA offline (${TAMANO})? Con Wi-Fi se baja sola.`,
    memoria: `Este dispositivo tiene poca memoria: la IA offline puede ser lenta o cerrarse sola. ¿La descargo igual (${TAMANO})?`,
    espacio: 'No hay espacio libre suficiente para la IA offline (necesita unos 3,5 GB). Libera espacio y se intentará de nuevo.',
  }[l.pregunta];
  return (
    <div className="notice info" role="region" aria-label="IA offline">
      <div style={{ lineHeight: 1.45 }}>{txt}</div>
      <div style={{ display: 'flex', gap: 14, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        {l.pregunta !== 'espacio' && <button className="btn" style={{ height: 44, boxShadow: 'none' }} onClick={() => descargarLocal({ auto: true })}>Descargar</button>}
        <button className="linkbtn" onClick={() => { if (l.pregunta !== 'espacio') setRechazoLocal(true); setLocal({ pregunta: '' }); }}>{l.pregunta === 'espacio' ? 'Entendido' : 'No, gracias'}</button>
      </div>
    </div>
  );
}
