import { useMemo, useState } from 'react';
import { Back, Chevron } from '../icons.jsx';
import Hoja, { Pregunta, CasoBox } from './Hoja.jsx';
import BotonPantallaCompleta from './BotonPantallaCompleta.jsx';
import { paginar, calcularPrueba, puntosDe, NOMBRES, SECCIONES, seccionDe, esLargo } from '../lib/quiz.js';
import { formatoNota, mensajeNota } from '../lib/grade.js';

const pts = (n) => String(Math.round(n * 10) / 10).replace('.', ',');

// Prueba corregida: resumen con la nota y la prueba en hojas, con las correcciones en rojo.
export default function ResultadoPrueba({ prueba, corrigiendo, error, onCorregir, onVolver, onRepetir, onOtra }) {
  const paginas = useMemo(() => paginar(prueba.preguntas), [prueba.preguntas]);
  const r = useMemo(() => calcularPrueba(prueba), [prueba]);
  const [i, setI] = useState(0);
  // Retroalimentación: las preguntas en que perdiste puntos (alternativas/V-F falladas o sin responder, desarrollos incompletos).
  const errores = useMemo(() => prueba.preguntas.map((p, k) => ({ p, n: k + 1, r: puntosDe(p, prueba.respuestas?.[p.id], prueba.evaluaciones?.[p.id]) })).filter((x) => x.r && x.r.puntos < x.r.max * 0.999), [prueba]);
  const [vista, setVista] = useState(errores.length ? 'errores' : 'completa');
  const ir = (n) => { setI(Math.max(0, Math.min(paginas.length - 1, n))); scrollTo({ top: 0 }); };
  return (
    <div className="mesa">
      <div className="mesa-bar">
        <button className="ibtn" aria-label="Volver a Pruebas" onClick={onVolver}><Back /></button>
        <div style={{ flex: 1, minWidth: 0 }}><div className="crumb">Prueba corregida</div><div style={{ fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{prueba.titulo}</div></div>
        <BotonPantallaCompleta />
      </div>

      <section className="gcard resumen" aria-label="Resumen de la prueba">
        {r.nota != null
          ? <div className={'nota' + (r.nota < 4 ? ' bajo' : '')} aria-label={`Nota ${formatoNota(r.nota)} de 7`}><b>{formatoNota(r.nota)}</b><span>de 7,0</span></div>
          : <div className="nota pend"><b>—</b><span>sin nota</span></div>}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="gt">{r.nota != null ? mensajeNota(r.nota) : 'Faltan desarrollos por corregir'}</div>
          <div className="sub" style={{ marginTop: 6, fontSize: 14 }}>{pts(r.puntos)} de {r.total} puntos · {Math.round(r.porcentaje)} % · aprobado desde 60 %</div>
          <div className="tipos">
            {SECCIONES.filter((t) => r.porTipo[t].n).map((t) => <span key={t} className="tipo-chip">{NOMBRES[t]}: {t === 'desarrollo' || t === 'caso' ? `${pts(r.porTipo[t].puntos)}/${r.porTipo[t].max} pts` : `${r.porTipo[t].buenas}/${r.porTipo[t].n}`}</span>)}
          </div>
        </div>
      </section>

      {(r.pendientes > 0 || error) && (
        <div className="notice" role="alert" style={{ maxWidth: 794, margin: '14px auto 0' }}>
          {error || `Quedaron ${r.pendientes} ${r.pendientes === 1 ? 'desarrollo' : 'desarrollos'} sin corregir.`}{' '}
          <button className="linkbtn" disabled={corrigiendo} onClick={onCorregir}>{corrigiendo ? 'Corrigiendo…' : 'Corregir ahora'}</button>
        </div>
      )}

      <div className="tabs" role="tablist" aria-label="Cómo ver la corrección" style={{ margin: '18px auto 0', maxWidth: 794, width: 'fit-content' }}>
        <button role="tab" aria-selected={vista === 'errores'} className={vista === 'errores' ? 'on' : ''} onClick={() => { setVista('errores'); scrollTo({ top: 0 }); }}>Mis errores ({errores.length})</button>
        <button role="tab" aria-selected={vista === 'completa'} className={vista === 'completa' ? 'on' : ''} onClick={() => { setVista('completa'); scrollTo({ top: 0 }); }}>Prueba corregida</button>
      </div>

      {vista === 'errores' && (
        <section aria-label="En qué te equivocaste" style={{ marginTop: 14 }}>
          <h2 className="h2" style={{ color: '#1d1a17', marginBottom: 4 }}>{errores.length ? 'En qué te equivocaste' : '¡Sin errores!'}</h2>
          <p className="sub" style={{ margin: '0 0 14px', lineHeight: 1.5 }}>{errores.length ? `Perdiste puntos en ${errores.length} ${errores.length === 1 ? 'pregunta' : 'preguntas'}. Aquí está lo que respondiste, la respuesta correcta y por qué.` : 'Respondiste todo correctamente. Puedes revisar la prueba corregida completa.'}</p>
          {errores.map(({ p, n, r: pr }) => (
            <article key={p.id} className="hoja err-card" aria-label={`Pregunta ${n}`}>
              <div className="err-tipo">{NOMBRES[seccionDe(p)]} · pregunta {n} · {pts(pr.puntos)} de {pr.max} {pr.max === 1 ? 'punto' : 'puntos'}</div>
              {p.caso && <CasoBox caso={p.caso} compacto={esLargo(p.caso)} />}
              <Pregunta p={p} n={n} modo="corregida" respuesta={prueba.respuestas?.[p.id]} evaluacion={prueba.evaluaciones?.[p.id]} />
            </article>
          ))}
        </section>
      )}

      {vista === 'completa' && <Hoja prueba={prueba} paginas={paginas} indice={i} modo="corregida" resumen={r} />}

      {vista === 'completa' && <nav className="mesa-nav" aria-label="Hojas corregidas">
        <button className="btn ghost" disabled={i === 0} onClick={() => ir(i - 1)}><Back /> Hoja anterior</button>
        <span className="sub">{i + 1} / {paginas.length}</span>
        <button className="btn" disabled={i === paginas.length - 1} onClick={() => ir(i + 1)}>Hoja siguiente <Chevron /></button>
      </nav>}
      <div style={{ maxWidth: 794, margin: '4px auto 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <button className="btn block" onClick={onOtra}>Generar otra prueba distinta</button>
        <div className="sub" style={{ textAlign: 'center', marginTop: -4 }}>Usa tu material con preguntas nuevas: parte por los conceptos que aún no practicaste y no repite estas preguntas.</div>
        <div className="two">
          <button className="btn ghost" onClick={onRepetir}>Rendir esta misma de nuevo</button>
          <button className="btn ghost" onClick={onVolver}>Volver a Pruebas</button>
        </div>
      </div>
    </div>
  );
}
