import { useMemo, useState } from 'react';
import { Trash } from '../icons.jsx';
import { Stepper } from './PruebasTab.jsx';
import { hayIA } from '../lib/ai.js';
import { ESTILOS, CONCEPTOS } from '../lib/oral.js';
import { formatoNota } from '../lib/grade.js';

// Pestaña "Oral": elegir material y estilo del profesor, y ver los interrogatorios anteriores.
export default function OralTab({ ramos, docs, sel, orales, error, onCrear, onAbrir, onBorrar }) {
  const [origen, setOrigen] = useState(sel.docId ? 'd:' + sel.docId : sel.ramoId ? 'r:' + sel.ramoId : 'todo');
  const [n, setN] = useState(CONCEPTOS.defecto);
  const [estilo, setEstilo] = useState('dinamico');
  const [borrar, setBorrar] = useState(null);
  const { docsOrigen, nombre } = useMemo(() => {
    if (origen.startsWith('d:')) { const d = docs.find((x) => x.id === origen.slice(2)); return { docsOrigen: d ? [d] : [], nombre: d?.nombre || '' }; }
    if (origen.startsWith('r:')) { const r = ramos.find((x) => x.id === origen.slice(2)); return { docsOrigen: docs.filter((d) => d.ramoId === r?.id), nombre: r?.nombre || '' }; }
    return { docsOrigen: docs, nombre: 'Todos los ramos' };
  }, [origen, docs, ramos]);
  const total = docsOrigen.reduce((s, d) => s + d.conceptos.length, 0);
  const tope = Math.max(CONCEPTOS.min, Math.min(CONCEPTOS.max, total));
  const cuantos = Math.min(n, tope, total);
  const puede = total > 0 && hayIA();

  return (
    <>
      <section className="card prep" aria-label="Nuevo interrogatorio">
        <h2 className="h2">Interrogatorio oral</h2>
        <p className="sub" style={{ margin: '4px 0 14px', lineHeight: 1.5 }}>Un profesor te pregunta de a un concepto, escucha tu respuesta y repregunta lo que quede flojo, como en una interrogación de verdad. Al final recibes tu nota del 1 al 7.</p>
        <label className="l" htmlFor="orig-o">Sobre qué material</label>
        <select id="orig-o" className="txt" value={origen} onChange={(e) => setOrigen(e.target.value)}>
          <option value="todo">Todos mis ramos</option>
          {ramos.map((r) => (
            <optgroup key={r.id} label={r.nombre}>
              <option value={'r:' + r.id}>Todo {r.nombre}</option>
              {docs.filter((d) => d.ramoId === r.id).map((d) => <option key={d.id} value={'d:' + d.id}>{d.nombre}</option>)}
            </optgroup>
          ))}
        </select>
        <div className="sub" style={{ marginTop: 8 }}>{total ? `${total} conceptos disponibles.` : 'Este material no tiene conceptos todavía.'}</div>

        <div className="steppers"><Stepper etiqueta="Conceptos a preguntar" valor={Math.min(n, tope)} min={CONCEPTOS.min} max={tope} onChange={setN} /></div>

        <div className="l" style={{ marginTop: 18 }} id="es-o">Estilo del profesor</div>
        <div className="chips" role="group" aria-labelledby="es-o">
          {Object.entries(ESTILOS).map(([k, e]) => <button key={k} className={'chipb' + (estilo === k ? ' on' : '')} aria-pressed={estilo === k} onClick={() => setEstilo(k)}>{e.nombre}</button>)}
        </div>
        <div className="sub" style={{ marginTop: 8 }}>{ESTILOS[estilo].desc}</div>

        {!hayIA() && <div className="notice info">Para el interrogatorio necesitas una IA conectada o la IA offline lista (Ajustes).</div>}
        {error && <div className="notice" role="alert">{error}</div>}
        <button className="btn block" style={{ marginTop: 16 }} disabled={!puede} onClick={() => onCrear({ docs: docsOrigen, origen: { nombre, clave: origen }, n: cuantos, estilo })}>Comenzar interrogatorio</button>
      </section>

      <h2 className="h2" style={{ margin: '28px 0 0' }}>Mis interrogatorios</h2>
      {!orales.length
        ? <div className="empty">Todavía no has rendido ningún interrogatorio oral.</div>
        : <div className="list" role="list">{orales.map((o) => (
          <div key={o.id} role="listitem" className="row" style={{ padding: 0 }}>
            <button className="row" style={{ border: 0, flex: 1, minWidth: 0 }} onClick={() => onAbrir(o)}>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.titulo}</span>
                <span className="sub">{new Date(o.creado).toLocaleDateString('es-CL')} · {o.conceptos.length} conceptos · {ESTILOS[o.estilo]?.nombre}</span>
              </span>
              {o.resultado ? <span className={'chip ' + (o.resultado.nota >= 4 ? 'ok' : 'no')}>{formatoNota(o.resultado.nota)}</span> : <span className="go">Continuar</span>}
            </button>
            <button className="ibtn" style={{ border: 0, background: 'transparent', marginRight: 6 }} aria-label={`Borrar interrogatorio ${o.titulo}`} onClick={() => setBorrar(o)}><Trash /></button>
          </div>
        ))}</div>}

      {borrar && (
        <div className="sheet" role="alertdialog" aria-modal="true" aria-label="Borrar interrogatorio">
          <div>
            <h2>¿Borrar este interrogatorio?</h2>
            <p className="sub" style={{ fontSize: 15, margin: '8px 0 18px' }}>“{borrar.titulo}” y su corrección se eliminarán.</p>
            <div className="two"><button className="btn ghost" onClick={() => setBorrar(null)}>Cancelar</button><button className="btn" onClick={() => { onBorrar(borrar.id); setBorrar(null); }}>Borrar</button></div>
          </div>
        </div>
      )}
    </>
  );
}
