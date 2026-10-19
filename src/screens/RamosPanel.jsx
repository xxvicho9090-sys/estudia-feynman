import { useState } from 'react';
import { Plus, Close } from '../icons.jsx';
import { formatoNota } from '../lib/grade.js';
import { promedio, colorRamo } from '../lib/ramos.js';

const nota = (docs) => { const p = promedio(docs); return p == null ? '—' : formatoNota(p); };

// Panel con TODOS los ramos y sus PDFs. sel = { ramoId, docId }.
export default function RamosPanel({ ramos, docs, sel, onSelect, onNewRamo, onClose }) {
  const [abiertos, setAbiertos] = useState({});
  const abierto = (r) => abiertos[r.id] ?? sel.ramoId === r.id;
  const pick = (s) => { onSelect(s); onClose?.(); };
  return (
    <>
      <div className="ptop">
        <h2>Mis ramos</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="ibtn" style={{ width: 40, height: 40 }} aria-label="Nuevo ramo" onClick={onNewRamo}><Plus /></button>
          {onClose && <button className="ibtn" style={{ width: 40, height: 40 }} aria-label="Cerrar panel" onClick={onClose}><Close /></button>}
        </div>
      </div>
      <button className={'pbtn' + (!sel.ramoId ? ' on' : '')} onClick={() => pick({})}>
        <span style={{ flex: 1 }}>Todos los ramos</span><span className="n">{docs.length} PDFs</span>
      </button>
      <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {ramos.map((r) => {
          const ds = docs.filter((d) => d.ramoId === r.id);
          const open = abierto(r);
          return (
            <div key={r.id}>
              <button className={'pbtn' + (sel.ramoId === r.id && !sel.docId ? ' on' : '')} aria-expanded={open}
                onClick={() => { setAbiertos({ ...abiertos, [r.id]: sel.ramoId === r.id && !sel.docId ? !open : true }); onSelect({ ramoId: r.id }); }}>
                <span className="dot" style={{ background: colorRamo(ramos, r) }} /><span>{r.nombre}</span><span className="n">{ds.length}</span>
              </button>
              {open && ds.map((d) => (
                <button key={d.id} className={'pdoc' + (sel.docId === d.id ? ' on' : '')} onClick={() => pick({ ramoId: r.id, docId: d.id })}>
                  <span>{d.nombre}</span><span className="n">{nota([d])}</span>
                </button>
              ))}
              {open && !ds.length && <div className="sub" style={{ padding: '4px 12px 8px 34px' }}>Sin PDFs todavía</div>}
            </div>
          );
        })}
      </div>
      {!ramos.length && <div className="sub" style={{ padding: '12px 12px' }}>Aún no tienes ramos. Crea uno con “+” o al subir tu primer PDF.</div>}
    </>
  );
}
