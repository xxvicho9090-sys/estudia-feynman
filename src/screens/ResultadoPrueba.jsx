import { useMemo, useState } from 'react';
import { Back, Chevron } from '../icons.jsx';
import Hoja from './Hoja.jsx';
import { paginar, calcularPrueba, NOMBRES, TIPOS } from '../lib/quiz.js';
import { formatoNota, mensajeNota } from '../lib/grade.js';

const pts = (n) => String(Math.round(n * 10) / 10).replace('.', ',');

// Prueba corregida: resumen con la nota y la prueba en hojas, con las correcciones en rojo.
export default function ResultadoPrueba({ prueba, corrigiendo, error, onCorregir, onVolver, onRepetir }) {
  const paginas = useMemo(() => paginar(prueba.preguntas), [prueba.preguntas]);
  const r = useMemo(() => calcularPrueba(prueba), [prueba]);
  const [i, setI] = useState(0);
  const ir = (n) => { setI(Math.max(0, Math.min(paginas.length - 1, n))); scrollTo({ top: 0 }); };
  return (
    <div className="mesa">
      <div className="mesa-bar">
        <button className="ibtn" aria-label="Volver a Pruebas" onClick={onVolver}><Back /></button>
        <div style={{ flex: 1, minWidth: 0 }}><div className="crumb">Prueba corregida</div><div style={{ fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{prueba.titulo}</div></div>
      </div>

      <section className="gcard resumen" aria-label="Resumen de la prueba">
        {r.nota != null
          ? <div className={'nota' + (r.nota < 4 ? ' bajo' : '')} aria-label={`Nota ${formatoNota(r.nota)} de 7`}><b>{formatoNota(r.nota)}</b><span>de 7,0</span></div>
          : <div className="nota pend"><b>—</b><span>sin nota</span></div>}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="gt">{r.nota != null ? mensajeNota(r.nota) : 'Faltan desarrollos por corregir'}</div>
          <div className="sub" style={{ marginTop: 6, fontSize: 14 }}>{pts(r.puntos)} de {r.total} puntos · {Math.round(r.porcentaje)} % · aprobado desde 60 %</div>
          <div className="tipos">
            {TIPOS.filter((t) => r.porTipo[t].n).map((t) => <span key={t} className="tipo-chip">{NOMBRES[t]}: {t === 'desarrollo' ? `${pts(r.porTipo[t].puntos)}/${r.porTipo[t].max} pts` : `${r.porTipo[t].buenas}/${r.porTipo[t].n}`}</span>)}
          </div>
        </div>
      </section>

      {(r.pendientes > 0 || error) && (
        <div className="notice" role="alert" style={{ maxWidth: 794, margin: '14px auto 0' }}>
          {error || `Quedaron ${r.pendientes} ${r.pendientes === 1 ? 'desarrollo' : 'desarrollos'} sin corregir.`}{' '}
          <button className="linkbtn" disabled={corrigiendo} onClick={onCorregir}>{corrigiendo ? 'Corrigiendo…' : 'Corregir ahora'}</button>
        </div>
      )}

      <Hoja prueba={prueba} paginas={paginas} indice={i} modo="corregida" resumen={r} />

      <nav className="mesa-nav" aria-label="Hojas corregidas">
        <button className="btn ghost" disabled={i === 0} onClick={() => ir(i - 1)}><Back /> Hoja anterior</button>
        <span className="sub">{i + 1} / {paginas.length}</span>
        <button className="btn" disabled={i === paginas.length - 1} onClick={() => ir(i + 1)}>Hoja siguiente <Chevron /></button>
      </nav>
      <div className="two" style={{ maxWidth: 794, margin: '4px auto 0' }}>
        <button className="btn ghost" onClick={onRepetir}>Rendir de nuevo</button>
        <button className="btn" onClick={onVolver}>Volver a Pruebas</button>
      </div>
    </div>
  );
}
