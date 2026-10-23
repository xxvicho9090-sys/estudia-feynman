import { Back } from '../icons.jsx';
import BotonPantallaCompleta from './BotonPantallaCompleta.jsx';
import { formatoNota, mensajeNota } from '../lib/grade.js';
import { ESTILOS, puntajeConcepto } from '../lib/oral.js';

const NIVEL = (p) => (p >= 0.85 ? ['ok', 'Dominado'] : p >= 0.45 ? ['ok', 'A medias'] : ['no', 'Por reforzar']);

// Resultado del interrogatorio: nota, qué tal te fue en cada concepto, la conversación y lo que decía el material.
export default function ResultadoOral({ oral, onVolver, onOtro }) {
  const r = oral.resultado;
  return (
    <div className="mesa">
      <div className="mesa-bar">
        <button className="ibtn" aria-label="Volver a Oral" onClick={onVolver}><Back /></button>
        <div style={{ flex: 1, minWidth: 0 }}><div className="crumb">Interrogatorio · {ESTILOS[oral.estilo]?.nombre}</div><div style={{ fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{oral.titulo}</div></div>
        <BotonPantallaCompleta />
      </div>

      <section className="gcard resumen" aria-label="Resumen del interrogatorio">
        <div className={'nota' + (r.nota < 4 ? ' bajo' : '')} aria-label={`Nota ${formatoNota(r.nota)} de 7`}><b>{formatoNota(r.nota)}</b><span>de 7,0</span></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="gt">{mensajeNota(r.nota)}</div>
          <div className="sub" style={{ marginTop: 6, fontSize: 14 }}>{Math.round(r.porcentaje)} % · {oral.conceptos.length} conceptos · aprobado desde 60 %</div>
        </div>
      </section>

      <div style={{ maxWidth: 794, margin: '18px auto 0' }}>
        <h2 className="h2" style={{ marginBottom: 4 }}>Cómo te fue en cada tema</h2>
        <p className="sub" style={{ margin: '0 0 12px', lineHeight: 1.5 }}>Cuenta más cómo terminas cada respuesta que cómo empiezas: la repregunta sirve para rescatar.</p>
        {oral.conceptos.map((c) => {
          const p = c.puntaje ?? puntajeConcepto(c);
          const [cl, et] = NIVEL(p);
          // Si terminó bien la respuesta, las observaciones de intentos anteriores ya no importan.
          const alumno = c.turnos.filter((t) => t.rol === 'alumno');
          const obs = alumno[alumno.length - 1]?.val === 'correcta' ? [] : alumno.filter((t) => t.obs).map((t) => t.obs);
          return (
            <article key={c.id} className="card oral-res">
              <div className="oral-res-top"><b>{c.nombre}</b><span className={'chip ' + cl}>{et}</span></div>
              <div className="sub">{c.docNombre}</div>
              {obs.length > 0 && <ul className="oral-obs">{obs.map((o, i) => <li key={i}>{o}</li>)}</ul>}
              {p < 0.85 && c.referencia && <div className="oral-ref"><b>Lo que decía tu material:</b> {c.referencia}</div>}
              <details className="oral-conv">
                <summary>Ver la conversación</summary>
                {c.turnos.map((t, i) => <p key={i} className={t.rol}><b>{t.rol === 'profesor' ? 'Profesor' : 'Usted'}:</b> {t.texto}</p>)}
              </details>
            </article>
          );
        })}
        <div className="two" style={{ marginTop: 16 }}>
          <button className="btn" onClick={onOtro}>Otro interrogatorio</button>
          <button className="btn ghost" onClick={onVolver}>Volver a Oral</button>
        </div>
      </div>
    </div>
  );
}
