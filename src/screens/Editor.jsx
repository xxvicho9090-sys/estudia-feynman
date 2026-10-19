import { useState } from 'react';
import { nuevoId } from '../lib/concepts.js';
import { Trash } from '../icons.jsx';

// Corregir la lista de conceptos de un PDF: renombrar, cambiar texto, borrar, agregar y borrar el PDF.
export default function Editor({ doc, ramos, onSave, onDeleteDoc, onClose }) {
  const [nombre, setNombre] = useState(doc.nombre);
  const [conceptos, setConceptos] = useState(doc.conceptos.map((c) => ({ ...c })));
  const [confirmar, setConfirmar] = useState(false);
  const [ramoId, setRamoId] = useState(doc.ramoId);
  const set = (id, campo, v) => setConceptos(conceptos.map((c) => (c.id === id ? { ...c, [campo]: v } : c)));
  const guardar = () => onSave({ ...doc, ramoId, nombre: nombre.trim() || doc.nombre, conceptos: conceptos.filter((c) => c.nombre.trim() && c.referencia.trim()).map((c) => ({ ...c, nombre: c.nombre.trim(), referencia: c.referencia.trim() })) });
  return (
    <div className="sheet" role="dialog" aria-label="Editar conceptos" aria-modal="true">
      <div>
        <h2>Editar PDF</h2>
        <label className="l" htmlFor="dn" style={{ marginTop: 16 }}>Nombre del PDF</label>
        <input id="dn" className="txt" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        <label className="l" htmlFor="dr" style={{ marginTop: 14 }}>Ramo</label>
        <select id="dr" className="txt" value={ramoId} onChange={(e) => setRamoId(e.target.value)}>{ramos.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}</select>
        {conceptos.map((c, i) => (
          <div key={c.id} className="card" style={{ padding: 14 }}>
            <label className="l" htmlFor={'n' + c.id}>Concepto {i + 1}</label>
            <input id={'n' + c.id} className="txt" style={{ height: 48 }} value={c.nombre} onChange={(e) => set(c.id, 'nombre', e.target.value)} />
            <label className="l" htmlFor={'r' + c.id} style={{ marginTop: 10 }}>Lo que dice el material</label>
            <textarea id={'r' + c.id} className="exp" style={{ minHeight: 110, fontSize: 15 }} value={c.referencia} onChange={(e) => set(c.id, 'referencia', e.target.value)} />
            <button className="linkbtn" style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--bad)', marginTop: 10 }} onClick={() => setConceptos(conceptos.filter((x) => x.id !== c.id))}><Trash /> Quitar concepto</button>
          </div>
        ))}
        <button className="btn ghost block" style={{ marginTop: 14 }} onClick={() => setConceptos([...conceptos, { id: nuevoId(), nombre: '', referencia: '', nota: null, notaFecha: null }])}>+ Agregar concepto</button>
        <div className="two" style={{ marginTop: 16 }}>
          <button className="btn ghost" onClick={onClose}>Cancelar</button>
          <button className="btn" onClick={guardar}>Guardar</button>
        </div>
        {!confirmar
          ? <button className="linkbtn" style={{ color: 'var(--bad)', marginTop: 18 }} onClick={() => setConfirmar(true)}>Borrar este PDF</button>
          : <div className="notice">¿Borrar “{doc.nombre}” y sus conceptos? <button className="linkbtn" onClick={onDeleteDoc}>Sí, borrar</button></div>}
      </div>
    </div>
  );
}
