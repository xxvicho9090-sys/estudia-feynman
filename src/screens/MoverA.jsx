import { useState } from 'react';
import { colorRamo } from '../lib/ramos.js';

// "Mover a…": para el celular (donde no se puede arrastrar) y para elegir sin arrastrar.
export default function MoverA({ docs, ramos, onCancel, onOk }) {
  const actuales = new Set(docs.map((d) => d.ramoId));
  const [valor, setValor] = useState('');
  const [nombre, setNombre] = useState('');
  const nuevo = valor === '__nuevo';
  const valido = nuevo ? !!nombre.trim() : !!valor && !(actuales.size === 1 && actuales.has(valor));
  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-label="Mover PDFs" onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div>
        <h2>{docs.length === 1 ? 'Mover este PDF a…' : `Mover ${docs.length} PDFs a…`}</h2>
        <div className="sub" style={{ margin: '4px 0 12px', overflowWrap: 'anywhere' }}>{docs.slice(0, 3).map((d) => d.nombre).join(' · ')}{docs.length > 3 ? ` y ${docs.length - 3} más` : ''}</div>
        <div role="radiogroup" aria-label="Ramo de destino" className="pack">
          {ramos.map((r) => {
            const aqui = actuales.size === 1 && actuales.has(r.id);
            return (
              <label key={r.id} className="pack-fila" style={aqui ? { opacity: 0.55, cursor: 'default' } : undefined}>
                <input type="radio" name="destino" disabled={aqui} checked={valor === r.id} onChange={() => setValor(r.id)} />
                <span className="dot" style={{ background: colorRamo(ramos, r) }} />
                <span className="pack-n">{r.nombre}</span>
                {aqui && <span className="sub">está aquí</span>}
              </label>
            );
          })}
          <label className="pack-fila"><input type="radio" name="destino" checked={nuevo} onChange={() => setValor('__nuevo')} /><span className="pack-n">+ Crear ramo nuevo…</span></label>
        </div>
        {nuevo && <><label className="l" htmlFor="mn" style={{ marginTop: 14 }}>Nombre del ramo nuevo</label><input id="mn" className="txt" autoFocus value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej.: Derecho laboral" /></>}
        <div className="two" style={{ marginTop: 18 }}>
          <button className="btn ghost" onClick={onCancel}>Cancelar</button>
          <button className="btn" disabled={!valido} onClick={() => onOk(nuevo ? { nuevo: nombre.trim() } : { ramoId: valor })}>Mover</button>
        </div>
      </div>
    </div>
  );
}
