import { Back, Check, Cross } from '../icons.jsx';
import { formatoNota, mensajeNota } from '../lib/grade.js';

export default function Result({ concepto, resultado, hayMas, onBack, onRetry, onNext }) {
  const { ideas, nota, resumen } = resultado;
  const bien = ideas.filter((i) => i.estado === 'bien');
  const mal = ideas.filter((i) => i.estado !== 'bien');
  return (
    <div className="app">
      <div className="bar">
        <button className="ibtn" aria-label="Volver" onClick={onBack}><Back /></button>
        <div className="sub">{concepto.nombre}</div>
      </div>
      <div className="grade">
        <div className={'nota' + (nota < 4 ? ' bajo' : '')} aria-label={`Nota ${formatoNota(nota)} de 7`}>
          <b>{formatoNota(nota)}</b><span>de 7,0</span>
        </div>
        <div>
          <div style={{ font: '800 24px/1.15 var(--disp)' }}>{mensajeNota(nota)}</div>
          <div className="sub" style={{ marginTop: 8, fontSize: 14, lineHeight: 1.45 }}>Cubriste {bien.length} de {ideas.length} ideas. Aprobado desde 4,0.</div>
        </div>
      </div>
      {resumen && <p style={{ margin: '16px 0 0', fontSize: 15, lineHeight: 1.5, color: 'var(--tx2)' }}>{resumen}</p>}

      {bien.length > 0 && (
        <section className="box ok">
          <h3><Check /> Bien dicho</h3>
          <ul>{bien.map((i, k) => <li key={k}>{i.idea}</li>)}</ul>
        </section>
      )}
      {mal.length > 0 && (
        <section className="box mal">
          <h3><Cross /> Mal o faltó</h3>
          <ul>
            {mal.map((i, k) => (
              <li key={k}>
                {i.estado === 'incorrecto' && <><b style={{ fontWeight: 600 }}>Dijiste:</b> “{i.dijiste || i.idea}”<br /></>}
                {i.estado === 'parcial' && <><b style={{ fontWeight: 600 }}>Incompleto:</b> {i.idea}<br /></>}
                {i.estado === 'falta' && <><b style={{ fontWeight: 600 }}>Faltó:</b> {i.idea}<br /></>}
                {i.comentario && <span className="fix">{i.comentario}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="box ref">
        <div className="eyebrow">Lo que dice tu PDF</div>
        <p>{concepto.referencia}</p>
      </section>

      <div className="row" style={{ marginTop: 20 }}>
        <button className="btn ghost" onClick={onRetry}>Intentar de nuevo</button>
        <button className="btn" onClick={onNext}>{hayMas ? 'Siguiente' : 'Terminar'}</button>
      </div>
    </div>
  );
}
