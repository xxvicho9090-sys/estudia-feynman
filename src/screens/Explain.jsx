import { useEffect, useRef, useState } from 'react';
import { Back, Chevron, List, Mic, Stop } from '../icons.jsx';
import BotonPantallaCompleta from './BotonPantallaCompleta.jsx';
import { formatoNota } from '../lib/grade.js';
import { evaluarExplicacion } from '../lib/groq.js';
import { calentar } from '../lib/ai.js';
import { empezarDictado, pararDictado, soportado } from '../lib/voice.js';

// Borradores por concepto: al saltar a otro concepto no se pierde lo que ibas escribiendo.
const borradores = new Map();
const palabras = (t) => (t.trim() ? t.trim().split(/\s+/).length : 0);

export default function Explain({ doc, concepto, indice, onBack, onResult, onGo }) {
  const [texto, setTextoRaw] = useState(borradores.get(concepto.id) || '');
  const setTexto = (t) => { borradores.set(concepto.id, t); setTextoRaw(t); };
  const [lista, setLista] = useState(false);
  const i = doc.conceptos.findIndex((c) => c.id === concepto.id);
  const ir = (c) => { if (c) { setLista(false); onGo(c.id); } };
  const [oyendo, setOyendo] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [seg, setSeg] = useState(0);
  const base = useRef('');
  const abort = useRef(null);

  useEffect(() => {
    if (!cargando) { setSeg(0); return undefined; }
    const t = setInterval(() => setSeg((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [cargando]);

  useEffect(() => { calentar(); return () => { pararDictado(); abort.current?.abort(); }; }, []);

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
      borradores.delete(concepto.id);
      onResult(texto, ev);
    } catch (e) {
      if (e?.name !== 'AbortError') setError(e.message || 'No se pudo evaluar. Intenta de nuevo.');
      setCargando(false);
    }
  };

  return (
    <div className="page">
      <div className="bar">
        <button className="ibtn" aria-label="Volver" onClick={onBack}><Back /></button>
        <div className="crumb" style={{ flex: 1, minWidth: 0 }}>{doc.nombre} · {indice}</div>
        <button className="ibtn" aria-label="Concepto anterior" disabled={i <= 0 || cargando} onClick={() => ir(doc.conceptos[i - 1])} style={{ opacity: i <= 0 ? .4 : 1 }}><Back /></button>
        <button className="ibtn" aria-label="Concepto siguiente" disabled={i >= doc.conceptos.length - 1 || cargando} onClick={() => ir(doc.conceptos[i + 1])} style={{ opacity: i >= doc.conceptos.length - 1 ? .4 : 1 }}><Chevron /></button>
        <button className="ibtn" aria-label="Ver todos los conceptos" onClick={() => setLista(true)}><List /></button>
        <BotonPantallaCompleta />
      </div>
      <div style={{ marginTop: 24 }}>
        <div className="crumb" style={{ color: 'var(--acc)' }}>Explícalo con tus palabras</div>
        <h1 style={{ fontSize: 36, marginTop: 8 }}>{concepto.nombre}</h1>
        <p style={{ margin: '12px 0 0', fontSize: 15, lineHeight: 1.5, color: 'var(--mut)' }}>Como si se lo contaras a alguien que no sabe nada del tema. Sin mirar el PDF.</p>
      </div>
      <div style={{ marginTop: 22, flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <label className="l" htmlFor="exp">Tu explicación</label>
        <textarea id="exp" className="exp" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Escribe o usa el micrófono…" disabled={cargando} />
        <div className="sub" style={{ marginTop: 8 }}>{palabras(texto)} palabras</div>
      </div>
      {error && <div className="notice" role="alert">{error}</div>}
      <div className="two" style={{ marginTop: 16, alignItems: 'center' }}>
        {soportado() && (
          <button className="ibtn" style={{ flex: 'none', width: 60, height: 60, borderRadius: 20, color: oyendo ? 'var(--bad)' : 'var(--acc)', borderColor: oyendo ? 'var(--bad-bar)' : 'var(--line2)' }}
            aria-label={oyendo ? 'Detener dictado' : 'Dictar por voz'} onClick={toggleMic} disabled={cargando}>{oyendo ? <Stop /> : <Mic />}</button>
        )}
        <button className="btn" style={{ height: 60, borderRadius: 20, fontSize: 17 }} onClick={evaluar} disabled={cargando}>
          {cargando ? `Evaluando… ${seg} s` : 'Evaluar mi explicación'}
        </button>
      </div>
      {lista && (
        <div className="sheet" role="dialog" aria-modal="true" aria-label="Conceptos" onClick={(e) => { if (e.target === e.currentTarget) setLista(false); }}>
          <div>
            <h2>Conceptos de {doc.nombre}</h2>
            <div className="list" role="list" style={{ marginTop: 14 }}>
              {doc.conceptos.map((c) => (
                <button key={c.id} role="listitem" className="row" aria-current={c.id === concepto.id} style={c.id === concepto.id ? { background: 'var(--acc-soft)', color: 'var(--acc-d)' } : undefined} onClick={() => ir(c)}>
                  <span>{c.nombre}</span>
                  {c.nota != null && <span className={'chip ' + (c.nota >= 4 ? 'ok' : 'no')}>{formatoNota(c.nota)}</span>}
                </button>
              ))}
            </div>
            <button className="btn ghost block" style={{ marginTop: 14 }} onClick={() => setLista(false)}>Cerrar</button>
          </div>
        </div>
      )}
    </div>
  );
}
