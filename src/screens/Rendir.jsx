import { useEffect, useMemo, useState } from 'react';
import { Back, Chevron, List } from '../icons.jsx';
import Hoja from './Hoja.jsx';
import { paginar, contestadas } from '../lib/quiz.js';

const respondida = (prueba, p) => { const r = prueba.respuestas?.[p.id]; return p.tipo === 'desarrollo' ? !!String(r || '').trim() : r !== undefined && r !== null; };

// Rendir la prueba: hojas de papel que se pasan con "Hoja siguiente"; todo se guarda solo.
export default function Rendir({ prueba, onChange, onEntregar, onBack }) {
  const paginas = useMemo(() => paginar(prueba.preguntas), [prueba.preguntas]);
  const [i, setI] = useState(Math.min(prueba.pagina || 0, paginas.length - 1));
  const [lista, setLista] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const total = prueba.preguntas.length;
  const hechas = contestadas(prueba);
  const ultima = i === paginas.length - 1;

  const ir = (n) => { const k = Math.max(0, Math.min(paginas.length - 1, n)); setI(k); onChange(prueba.id, (p) => ({ ...p, pagina: k })); scrollTo({ top: 0 }); };
  const resp = (id, v) => onChange(prueba.id, (p) => ({ ...p, respuestas: { ...p.respuestas, [id]: v } }));
  useEffect(() => {
    const on = (e) => { if (/TEXTAREA|INPUT/.test(e.target.tagName)) return; if (e.key === 'ArrowRight') ir(i + 1); if (e.key === 'ArrowLeft') ir(i - 1); };
    addEventListener('keydown', on); return () => removeEventListener('keydown', on);
  });
  const irAPregunta = (n) => { const k = paginas.findIndex((pg) => pg.preguntas.some((x) => x.n === n)); setLista(false); ir(k); };

  return (
    <div className="mesa">
      <div className="mesa-bar">
        <button className="ibtn" aria-label="Salir (la prueba queda guardada)" onClick={onBack}><Back /></button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="crumb">Prueba en curso</div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>Respondidas {hechas} de {total}</div>
        </div>
        <button className="ibtn" aria-label="Ver todas las preguntas" onClick={() => setLista(true)}><List /></button>
      </div>

      <Hoja prueba={prueba} paginas={paginas} indice={i} modo="rendir" onResp={resp} />

      <nav className="mesa-nav" aria-label="Hojas de la prueba">
        <button className="btn ghost" disabled={i === 0} onClick={() => ir(i - 1)}><Back /> Hoja anterior</button>
        <span className="sub" aria-live="polite">{i + 1} / {paginas.length}</span>
        {ultima
          ? <button className="btn" onClick={() => (hechas < total ? setConfirmar(true) : onEntregar())}>Entregar prueba</button>
          : <button className="btn" onClick={() => ir(i + 1)}>Hoja siguiente <Chevron /></button>}
      </nav>

      {lista && (
        <div className="sheet" role="dialog" aria-modal="true" aria-label="Preguntas" onClick={(e) => { if (e.target === e.currentTarget) setLista(false); }}>
          <div>
            <h2>Preguntas de la prueba</h2>
            <div className="sub" style={{ margin: '4px 0 14px' }}>Toca una para ir a su hoja. Marcadas en naranja = respondidas.</div>
            <div className="nums">
              {prueba.preguntas.map((p, k) => <button key={p.id} className={'num' + (respondida(prueba, p) ? ' ok' : '')} onClick={() => irAPregunta(k + 1)} aria-label={`Pregunta ${k + 1}${respondida(prueba, p) ? ', respondida' : ', sin responder'}`}>{k + 1}</button>)}
            </div>
            <div className="two" style={{ marginTop: 18 }}>
              <button className="btn ghost" onClick={() => setLista(false)}>Seguir</button>
              <button className="btn" onClick={() => { setLista(false); hechas < total ? setConfirmar(true) : onEntregar(); }}>Entregar</button>
            </div>
          </div>
        </div>
      )}
      {confirmar && (
        <div className="sheet" role="alertdialog" aria-modal="true" aria-label="Confirmar entrega">
          <div>
            <h2>¿Entregar la prueba?</h2>
            <p className="sub" style={{ fontSize: 15, lineHeight: 1.5, margin: '8px 0 18px' }}>Te faltan {total - hechas} preguntas por responder. Las que queden en blanco valen 0 puntos.</p>
            <div className="two"><button className="btn ghost" onClick={() => setConfirmar(false)}>Seguir respondiendo</button><button className="btn" onClick={() => { setConfirmar(false); onEntregar(); }}>Entregar igual</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
