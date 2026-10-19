import { useEffect, useRef, useState } from 'react';
import { Back, Mic, Stop } from '../icons.jsx';
import { evaluarExplicacion } from '../lib/groq.js';
import { empezarDictado, pararDictado, soportado } from '../lib/voice.js';

const palabras = (t) => (t.trim() ? t.trim().split(/\s+/).length : 0);

export default function Explain({ doc, concepto, indice, onBack, onResult }) {
  const [texto, setTexto] = useState('');
  const [oyendo, setOyendo] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const base = useRef('');
  const abort = useRef(null);

  useEffect(() => () => { pararDictado(); abort.current?.abort(); }, []);

  const toggleMic = async () => {
    setError('');
    if (oyendo) { await pararDictado(); setOyendo(false); return; }
    base.current = texto ? texto.trimEnd() + ' ' : '';
    setOyendo(true);
    await empezarDictado((t) => setTexto(base.current + t), () => setOyendo(false), (m) => { setError(m); setOyendo(false); });
  };

  const evaluar = async () => {
    if (oyendo) { await pararDictado(); setOyendo(false); }
    if (palabras(texto) < 8) { setError('Explícalo un poco más (al menos una o dos frases) para poder evaluarte.'); return; }
    setError(''); setCargando(true);
    abort.current = new AbortController();
    try {
      const ev = await evaluarExplicacion(concepto.referencia, texto, { signal: abort.current.signal });
      onResult(texto, ev);
    } catch (e) {
      if (e?.name !== 'AbortError') setError(e.message || 'No se pudo evaluar. Intenta de nuevo.');
      setCargando(false);
    }
  };

  return (
    <div className="app" style={{ minHeight: '100%' }}>
      <div className="bar">
        <button className="ibtn" aria-label="Volver" onClick={onBack}><Back /></button>
        <div className="sub">{doc.nombre} · {indice}</div>
      </div>
      <div style={{ marginTop: 24 }}>
        <div className="eyebrow" style={{ color: 'var(--acc)' }}>Explícalo con tus palabras</div>
        <h1 style={{ fontSize: 36, marginTop: 10 }}>{concepto.nombre}</h1>
        <p style={{ margin: '12px 0 0', fontSize: 15, lineHeight: 1.5, color: 'var(--mut)' }}>Como si se lo contaras a alguien que no sabe nada del tema. Sin mirar el PDF.</p>
      </div>
      <div style={{ marginTop: 22, flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <label className="l" htmlFor="exp">Tu explicación</label>
        <textarea id="exp" className="exp" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Escribe o usa el micrófono…" disabled={cargando} />
        <div className="sub" style={{ marginTop: 8 }}>{palabras(texto)} palabras</div>
      </div>
      {error && <div className="notice" role="alert">{error}</div>}
      <div className="row" style={{ marginTop: 16, alignItems: 'center' }}>
        {soportado() && (
          <button className="ibtn" style={{ flex: 'none', width: 60, height: 60, borderRadius: 20, color: oyendo ? 'var(--bad)' : 'var(--acc)', borderColor: oyendo ? 'var(--bad)' : 'var(--line2)' }}
            aria-label={oyendo ? 'Detener dictado' : 'Dictar por voz'} onClick={toggleMic} disabled={cargando}>{oyendo ? <Stop /> : <Mic />}</button>
        )}
        <button className="btn" style={{ height: 60, borderRadius: 20, fontSize: 18 }} onClick={evaluar} disabled={cargando}>
          {cargando ? 'Evaluando…' : 'Evaluar mi explicación'}
        </button>
      </div>
    </div>
  );
}
