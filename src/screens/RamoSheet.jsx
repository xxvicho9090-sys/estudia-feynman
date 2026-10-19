import { useState } from 'react';

// Crear un ramo (ramo = null) o renombrar / borrar uno existente.
export default function RamoSheet({ ramo, nDocs, onSave, onDelete, onClose }) {
  const [nombre, setNombre] = useState(ramo?.nombre || '');
  const [confirmar, setConfirmar] = useState(false);
  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-label={ramo ? 'Editar ramo' : 'Nuevo ramo'}>
      <div>
        <h2>{ramo ? 'Editar ramo' : 'Nuevo ramo'}</h2>
        <label className="l" htmlFor="rn2" style={{ marginTop: 16 }}>Nombre</label>
        <input id="rn2" className="txt" autoFocus value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej.: Contratos" onKeyDown={(e) => { if (e.key === 'Enter' && nombre.trim()) onSave(nombre.trim()); }} />
        <div className="two" style={{ marginTop: 20 }}>
          <button className="btn ghost" onClick={onClose}>Cancelar</button>
          <button className="btn" disabled={!nombre.trim()} onClick={() => onSave(nombre.trim())}>Guardar</button>
        </div>
        {ramo && (!confirmar
          ? <button className="linkbtn" style={{ marginTop: 18, color: 'var(--bad)' }} onClick={() => setConfirmar(true)}>Borrar este ramo</button>
          : <div className="notice">¿Borrar “{ramo.nombre}”{nDocs ? ` y sus ${nDocs} PDFs con todos sus conceptos` : ''}? <button className="linkbtn" onClick={onDelete}>Sí, borrar</button></div>)}
      </div>
    </div>
  );
}
