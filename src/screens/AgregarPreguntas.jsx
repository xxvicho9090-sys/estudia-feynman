import { useState } from 'react';
import { Stepper } from './PruebasTab.jsx';
import { TIPOS, NOMBRES, MAX_CASOS, POR_CASO, EXTENSIONES, MAX_TOTAL, totalPlan, puedeAgregar } from '../lib/quiz.js';

// Hoja para agregar más preguntas a una prueba ya creada: alternativas, V/F, desarrollo y casos prácticos.
export default function AgregarPreguntas({ prueba, onAmpliar, onClose }) {
  const [plan, setPlan] = useState({ alternativas: 3, vf: 0, desarrollo: 0, casos: 0, porCaso: POR_CASO.defecto, extension: 'breve' });
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const nuevas = totalPlan(plan);
  const total = prueba.preguntas.length;
  const cambiar = (k, v) => { setError(''); setPlan((p) => ({ ...p, [k]: v })); };
  const agregar = async () => {
    setOcupado(true); setError('');
    const fallo = await onAmpliar(plan);
    setOcupado(false);
    if (fallo) setError(fallo); else onClose();
  };
  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-label="Agregar preguntas" onClick={(e) => { if (e.target === e.currentTarget && !ocupado) onClose(); }}>
      <div>
        <h2>Agregar preguntas a esta prueba</h2>
        <p className="sub" style={{ margin: '4px 0 14px', lineHeight: 1.5 }}>Usa el mismo material, parte por conceptos que la prueba aún no usa y no repite las preguntas que ya tiene. Lo que ya respondiste se conserva.</p>
        <div className="steppers">
          {TIPOS.map((t) => <Stepper key={t} etiqueta={NOMBRES[t]} valor={plan[t] || 0} onChange={(v) => cambiar(t, v)} />)}
          <Stepper etiqueta={NOMBRES.caso} valor={plan.casos || 0} max={MAX_CASOS} onChange={(v) => cambiar('casos', v)} />
          {plan.casos > 0 && <Stepper etiqueta="Preguntas por caso" valor={plan.porCaso} max={POR_CASO.max} min={POR_CASO.min} onChange={(v) => cambiar('porCaso', Math.max(POR_CASO.min, v))} />}
        </div>
        {plan.casos > 0 && (
          <div style={{ marginTop: 12 }}>
            <label className="l" htmlFor="ext2">Extensión de cada caso</label>
            <select id="ext2" className="txt" value={plan.extension} onChange={(e) => cambiar('extension', e.target.value)}>
              {Object.entries(EXTENSIONES).map(([k, v]) => <option key={k} value={k}>{v.nombre} · {v.palabras} palabras</option>)}
            </select>
          </div>
        )}
        <div className="sub" style={{ marginTop: 12 }}>Se agregan <b style={{ color: 'var(--ink)' }}>{nuevas}</b> {nuevas === 1 ? 'pregunta' : 'preguntas'}; la prueba quedará con {total + nuevas}{total + nuevas > MAX_TOTAL ? ` (máximo ${MAX_TOTAL})` : ''}.</div>
        {error && <div className="notice" role="alert">{error}</div>}
        <div className="two" style={{ marginTop: 18 }}>
          <button className="btn ghost" onClick={onClose} disabled={ocupado}>Cancelar</button>
          <button className="btn" onClick={agregar} disabled={ocupado || !puedeAgregar(prueba, plan)}>{ocupado ? 'Agregando…' : nuevas ? `Agregar ${nuevas}` : 'Agregar'}</button>
        </div>
      </div>
    </div>
  );
}
