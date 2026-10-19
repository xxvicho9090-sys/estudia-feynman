import { useRef, useState } from 'react';
import { Gear, Upload } from '../icons.jsx';
import { formatoNota } from '../lib/grade.js';
import { getKey } from '../lib/groq.js';

const MAX_VISIBLE = 5;

export default function Home({ docs, avisos, cerrarAviso, progreso, onFiles, onOpenConcept, onEdit, onSettings }) {
  const input = useRef(null);
  const [abiertos, setAbiertos] = useState({});
  return (
    <div className="app">
      <div className="bar" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div className="eyebrow">Mis PDFs</div>
          <h1>Qué voy a<br />explicar hoy</h1>
        </div>
        <button className="ibtn" aria-label="Ajustes" onClick={onSettings}><Gear /></button>
      </div>

      <input ref={input} type="file" accept="application/pdf,.pdf" multiple hidden onChange={(e) => { const f = [...e.target.files]; e.target.value = ''; if (f.length) onFiles(f); }} />
      <button className="up" onClick={() => input.current.click()} disabled={!!progreso}><Upload /> Subir PDF</button>

      {!getKey() && (
        <button className="notice" style={{ textAlign: 'left', width: '100%' }} onClick={onSettings}>
          Falta tu clave gratis de Groq: sin ella la IA no puede evaluarte. <b>Tocar para ponerla.</b>
        </button>
      )}
      {avisos.map((a) => (
        <div key={a.id} className="notice" role="status">
          <b>{a.doc}:</b> {a.texto}{' '}
          <button className="link" style={{ padding: 0, color: '#F3C9C0', textDecoration: 'underline' }} onClick={() => cerrarAviso(a.id)}>Entendido</button>
        </div>
      ))}

      {!docs.length && !progreso && (
        <div className="empty">Todavía no hay nada.<br />Sube un PDF de tus apuntes y saco los conceptos para que los expliques.</div>
      )}

      {docs.map((d) => {
        const evaluados = d.conceptos.filter((c) => c.nota != null).length;
        const open = abiertos[d.id] ?? true;
        const lista = open ? d.conceptos.slice(0, abiertos[d.id + 'all'] ? undefined : MAX_VISIBLE) : [];
        return (
          <section key={d.id} className="card" aria-label={d.nombre}>
            <div className="doc-h">
              <button className="doc-h" style={{ flex: 1, minWidth: 0 }} aria-expanded={open} onClick={() => setAbiertos({ ...abiertos, [d.id]: !open })}>
                <div className="pdfi">PDF</div>
                <div className="doc-t"><b>{d.nombre}</b><span className="sub">{d.conceptos.length} conceptos · {evaluados} evaluados</span></div>
              </button>
              <button className="ibtn" style={{ width: 40, height: 40 }} aria-label={`Editar ${d.nombre}`} onClick={() => onEdit(d.id)}><span style={{ fontSize: 12, fontWeight: 700 }}>···</span></button>
            </div>
            {open && <div style={{ marginTop: 14 }}>
              {!d.conceptos.length && <div className="sub" style={{ padding: '8px 4px' }}>Sin conceptos. Toca “···” para agregarlos a mano.</div>}
              {lista.map((c) => (
                <button key={c.id} className="crow" onClick={() => onOpenConcept(d.id, c.id)}>
                  <span>{c.nombre}</span>
                  {c.nota == null
                    ? <span className="go">Explicar</span>
                    : <span className={'chip ' + (c.nota >= 4 ? 'ok' : 'no')}>{formatoNota(c.nota)}</span>}
                </button>
              ))}
              {d.conceptos.length > MAX_VISIBLE && !abiertos[d.id + 'all'] && (
                <button className="link" onClick={() => setAbiertos({ ...abiertos, [d.id + 'all']: true })}>+ {d.conceptos.length - MAX_VISIBLE} conceptos más</button>
              )}
            </div>}
          </section>
        );
      })}
      {progreso && (
        <div className="sheet" role="alertdialog" aria-label="Procesando">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><div className="spin" /><b style={{ fontFamily: 'var(--disp)', fontSize: 18 }}>Preparando tus conceptos</b></div>
            <div className="sub" style={{ marginTop: 10 }}>{progreso.archivo}</div>
            <div className="sub">{progreso.texto}</div>
            <div className="prog"><i style={{ width: `${Math.round(progreso.fraccion * 100)}%` }} /></div>
          </div>
        </div>
      )}
    </div>
  );
}
