import { useMemo, useState } from 'react';
import { Trash } from '../icons.jsx';
import { hayIA } from '../lib/ai.js';
import { armarMaterial, cobertura, mismoOrigen, presetPlan, planValido, totalPlan, NOMBRES, TIPOS, MAX_PREGUNTAS } from '../lib/quiz.js';
import { formatoNota } from '../lib/grade.js';

const PRESETS = [['alternativas', 'Alternativas'], ['vf', 'Verdadero o falso'], ['desarrollo', 'Desarrollo'], ['mixto', 'Mixto']];

function Stepper({ etiqueta, valor, onChange }) {
  return (
    <div className="stepper">
      <span>{etiqueta}</span>
      <button className="ibtn" style={{ width: 40, height: 40 }} aria-label={`Menos ${etiqueta}`} disabled={valor <= 0} onClick={() => onChange(valor - 1)}>−</button>
      <b aria-live="polite" aria-label={`${valor} ${etiqueta}`}>{valor}</b>
      <button className="ibtn" style={{ width: 40, height: 40 }} aria-label={`Más ${etiqueta}`} onClick={() => onChange(valor + 1)}>+</button>
    </div>
  );
}

// Pestaña "Pruebas": configurar una prueba nueva y ver el historial.
export default function PruebasTab({ ramos, docs, sel, pruebas, errorPrueba, onCrear, onAbrir, onBorrar }) {
  const [origen, setOrigen] = useState(sel.docId ? 'd:' + sel.docId : sel.ramoId ? 'r:' + sel.ramoId : 'todo');
  const [preset, setPreset] = useState('mixto');
  const [plan, setPlan] = useState(presetPlan('mixto', 10));
  const [borrar, setBorrar] = useState(null);
  const [evitarRepetir, setEvitarRepetir] = useState(true);

  const { docsOrigen, nombre } = useMemo(() => {
    if (origen.startsWith('d:')) { const d = docs.find((x) => x.id === origen.slice(2)); return { docsOrigen: d ? [d] : [], nombre: d?.nombre || '' }; }
    if (origen.startsWith('r:')) { const r = ramos.find((x) => x.id === origen.slice(2)); return { docsOrigen: docs.filter((d) => d.ramoId === r?.id), nombre: r?.nombre || '' }; }
    return { docsOrigen: docs, nombre: 'Todos los ramos' };
  }, [origen, docs, ramos]);
  const mat = useMemo(() => armarMaterial(docsOrigen), [docsOrigen]);
  const n = totalPlan(plan);
  // Qué parte de este material ya practicaste con pruebas anteriores.
  const cob = useMemo(() => cobertura(docsOrigen, pruebas.filter((x) => mismoOrigen(x.origen, { clave: origen, nombre }))), [docsOrigen, pruebas, origen, nombre]);
  const cambiar = (tipo, v) => { setPreset('custom'); setPlan({ ...plan, [tipo]: v }); };
  const elegirPreset = (p) => { setPreset(p); setPlan(presetPlan(p, Math.max(5, Math.min(n || 10, MAX_PREGUNTAS)))); };
  const puedeCrear = planValido(plan) && mat.conceptos > 0 && hayIA();

  return (
    <>
      <section className="card prep" aria-label="Nueva prueba">
        <h2 className="h2">Crear una prueba</h2>
        <label className="l" htmlFor="orig">Sobre qué material</label>
        <select id="orig" className="txt" value={origen} onChange={(e) => setOrigen(e.target.value)}>
          <option value="todo">Todos mis ramos</option>
          {ramos.map((r) => (
            <optgroup key={r.id} label={r.nombre}>
              <option value={'r:' + r.id}>Todo {r.nombre}</option>
              {docs.filter((d) => d.ramoId === r.id).map((d) => <option key={d.id} value={'d:' + d.id}>{d.nombre}</option>)}
            </optgroup>
          ))}
        </select>
        <div className="sub" style={{ marginTop: 8 }}>{mat.total ? `${mat.total} conceptos disponibles${mat.conceptos < mat.total ? ` (se usarán ${mat.conceptos} al azar, el máximo que cabe)` : ''}.` : 'Este material no tiene conceptos todavía.'}</div>

        <div className="l" style={{ marginTop: 18 }} id="tp">Tipo de prueba</div>
        <div className="chips" role="group" aria-labelledby="tp">
          {PRESETS.map(([k, l]) => <button key={k} className={'chipb' + (preset === k ? ' on' : '')} aria-pressed={preset === k} onClick={() => elegirPreset(k)}>{l}</button>)}
        </div>

        <div className="steppers">
          {TIPOS.map((t) => <Stepper key={t} etiqueta={NOMBRES[t]} valor={plan[t] || 0} onChange={(v) => cambiar(t, v)} />)}
        </div>
        <div className="sub" style={{ marginTop: 10 }}>{n} {n === 1 ? 'pregunta' : 'preguntas'} en total{n > MAX_PREGUNTAS ? ` (máximo ${MAX_PREGUNTAS})` : ''}. Desarrollo vale 3 puntos; las demás, 1.</div>

        {cob.cubiertos > 0 && (
          <label className="check" style={{ marginTop: 14 }}>
            <input type="checkbox" checked={evitarRepetir} onChange={(e) => setEvitarRepetir(e.target.checked)} />
            <span>Preguntas distintas a las de mis pruebas anteriores<br /><span className="sub">{cob.cubiertos >= cob.total ? 'Ya practicaste todo este material: empiezo un ciclo nuevo con preguntas diferentes.' : `Ya practicaste ${cob.cubiertos} de ${cob.total} conceptos; esta prueba parte por los que faltan.`}</span></span>
          </label>
        )}
        {!hayIA() && <div className="notice info">Para crear pruebas necesitas conectar una IA gratis (Ajustes).</div>}
        {errorPrueba && <div className="notice" role="alert">{errorPrueba}</div>}
        <button className="btn block" style={{ marginTop: 16 }} disabled={!puedeCrear} onClick={() => onCrear({ docs: docsOrigen, origen: { nombre, clave: origen }, plan, evitarRepetir })}>Crear prueba</button>
      </section>

      <h2 className="h2" style={{ margin: '28px 0 0' }}>Mis pruebas</h2>
      {!pruebas.length
        ? <div className="empty">Todavía no has rendido ninguna prueba.</div>
        : <div className="list" role="list">{pruebas.map((p) => {
          const r = p.resultado;
          return (
            <div key={p.id} role="listitem" className="row" style={{ padding: 0 }}>
              <button className="row" style={{ border: 0, flex: 1, minWidth: 0 }} onClick={() => onAbrir(p)}>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.titulo}</span>
                  <span className="sub">{new Date(p.creado).toLocaleDateString('es-CL')} · {p.preguntas.length} preguntas · {p.estado}</span>
                </span>
                {r?.nota != null ? <span className={'chip ' + (r.nota >= 4 ? 'ok' : 'no')}>{formatoNota(r.nota)}</span> : <span className="go">{p.estado === 'en curso' ? 'Continuar' : 'Corregir'}</span>}
              </button>
              <button className="ibtn" style={{ border: 0, background: 'transparent', marginRight: 6 }} aria-label={`Borrar prueba ${p.titulo}`} onClick={() => setBorrar(p)}><Trash /></button>
            </div>
          );
        })}</div>}

      {borrar && (
        <div className="sheet" role="alertdialog" aria-modal="true" aria-label="Borrar prueba">
          <div>
            <h2>¿Borrar esta prueba?</h2>
            <p className="sub" style={{ fontSize: 15, margin: '8px 0 18px' }}>“{borrar.titulo}” y su corrección se eliminarán.</p>
            <div className="two"><button className="btn ghost" onClick={() => setBorrar(null)}>Cancelar</button><button className="btn" onClick={() => { onBorrar(borrar.id); setBorrar(null); }}>Borrar</button></div>
          </div>
        </div>
      )}
    </>
  );
}
