import { useEffect, useRef, useState } from 'react';
import { Mic, Stop } from '../icons.jsx';
import { empezarDictado, pararDictado, soportado } from '../lib/voice.js';
import { puntosDe, NOMBRES, INSTRUCCION, ROMANO, PUNTOS, TIPOS } from '../lib/quiz.js';
import { formatoNota } from '../lib/grade.js';

const LETRAS = ['A', 'B', 'C', 'D', 'E'];
const pts = (n) => String(Math.round(n * 10) / 10).replace('.', ',');

// Una hoja de la prueba, con aspecto de papel. modo: 'rendir' (se responde) | 'corregida' (con correcciones en rojo).
export default function Hoja({ prueba, paginas, indice, modo, onResp, resumen }) {
  const pag = paginas[indice];
  const corr = modo === 'corregida';
  const secciones = TIPOS.filter((t) => prueba.preguntas.some((p) => p.tipo === t));
  return (
    <article className="hoja" aria-label={`Hoja ${indice + 1} de ${paginas.length}`}>
      {indice === 0 && (
        <header className="hoja-head">
          <div className="hh-top">
            <div>
              <div className="hh-kicker">Prueba de Derecho</div>
              <h2 className="hh-titulo">{prueba.titulo}</h2>
            </div>
            {corr && resumen?.nota != null && <div className="sello" aria-label={`Nota ${formatoNota(resumen.nota)}`}><span>{formatoNota(resumen.nota)}</span></div>}
          </div>
          <div className="hh-datos">
            <span>Nombre: <i className="linea" /></span>
            <span>Fecha: <b>{new Date(prueba.creado).toLocaleDateString('es-CL')}</b></span>
            <span>Puntaje total: <b>{prueba.preguntas.reduce((n, p) => n + PUNTOS[p.tipo], 0)} pts</b></span>
          </div>
          <p className="hh-instr">Lea con atención cada pregunta. {secciones.length > 1 ? 'La prueba tiene ' + secciones.length + ' partes: ' + secciones.map((t) => NOMBRES[t].toLowerCase()).join(', ') + '.' : ''}</p>
        </header>
      )}

      {pag.preguntas.map(({ p, n, seccion }) => (
        <section key={p.id} className="preg" aria-label={`Pregunta ${n}`}>
          {seccion && (
            <div className="sec">
              <b>{ROMANO[secciones.indexOf(seccion)]}. {NOMBRES[seccion].toUpperCase()}</b>
              <span>{INSTRUCCION[seccion]} <em>({PUNTOS[seccion]} {PUNTOS[seccion] === 1 ? 'punto' : 'puntos'} cada una)</em></span>
            </div>
          )}
          <Pregunta p={p} n={n} modo={modo} respuesta={prueba.respuestas?.[p.id]} evaluacion={prueba.evaluaciones?.[p.id]} onResp={(v) => onResp?.(p.id, v)} />
        </section>
      ))}
      <footer className="hoja-pie">Hoja {indice + 1} de {paginas.length}</footer>
    </article>
  );
}

function Marca({ p, respuesta, evaluacion }) {
  const r = puntosDe(p, respuesta, evaluacion);
  if (r === null) return <span className="roja">pendiente</span>;
  return <span className={'roja' + (r.puntos >= r.max * 0.999 ? ' bien' : '')}>{pts(r.puntos)}/{r.max}</span>;
}

export function Pregunta({ p, n, modo, respuesta, evaluacion, onResp }) {
  const corr = modo === 'corregida';
  return (
    <div className="q">
      <div className="q-enun"><span className="q-n">{n}.</span><span>{p.enunciado}</span>{corr && <Marca p={p} respuesta={respuesta} evaluacion={evaluacion} />}</div>

      {p.tipo === 'alternativas' && (
        <div className="ops" role="radiogroup" aria-label={`Alternativas de la pregunta ${n}`}>
          {p.opciones.map((o, i) => {
            const marcada = respuesta === i;
            const cls = 'op' + (marcada ? ' marcada' : '') + (corr && i === p.correcta ? ' correcta' : '') + (corr && marcada && i !== p.correcta ? ' mala' : '');
            return (
              <button key={i} role="radio" aria-checked={marcada} className={cls} disabled={corr} onClick={() => onResp(marcada ? undefined : i)}>
                <span className="burbuja">{LETRAS[i]}</span><span className="op-t">{o}</span>
                {corr && i === p.correcta && <span className="roja bien" aria-label="correcta">✓</span>}
                {corr && marcada && i !== p.correcta && <span className="roja" aria-label="incorrecta">✗</span>}
              </button>
            );
          })}
        </div>
      )}

      {p.tipo === 'vf' && (
        <div className="vf" role="radiogroup" aria-label={`Verdadero o falso, pregunta ${n}`}>
          {[[true, 'V', 'Verdadero'], [false, 'F', 'Falso']].map(([val, l, nombre]) => {
            const marcada = respuesta === val;
            const cls = 'op' + (marcada ? ' marcada' : '') + (corr && val === p.correcta ? ' correcta' : '') + (corr && marcada && val !== p.correcta ? ' mala' : '');
            return (
              <button key={l} role="radio" aria-checked={marcada} className={cls} disabled={corr} onClick={() => onResp(marcada ? undefined : val)}>
                <span className="burbuja">{l}</span><span className="op-t">{nombre}</span>
                {corr && val === p.correcta && <span className="roja bien" aria-label="correcta">✓</span>}
                {corr && marcada && val !== p.correcta && <span className="roja" aria-label="incorrecta">✗</span>}
              </button>
            );
          })}
        </div>
      )}

      {p.tipo === 'desarrollo' && <Desarrollo valor={respuesta || ''} onChange={onResp} corr={corr} n={n} />}

      {corr && <Correccion p={p} respuesta={respuesta} evaluacion={evaluacion} />}
    </div>
  );
}

function Desarrollo({ valor, onChange, corr, n }) {
  const [oyendo, setOyendo] = useState(false);
  const [err, setErr] = useState('');
  const base = useRef('');
  useEffect(() => () => { pararDictado(); }, []);
  const toggle = async () => {
    setErr('');
    if (oyendo) { await pararDictado(); setOyendo(false); return; }
    base.current = valor ? valor.trimEnd() + ' ' : '';
    setOyendo(true);
    await empezarDictado((t) => onChange(base.current + t), () => setOyendo(false), (m) => { setErr(m); setOyendo(false); });
  };
  return (
    <div className="des">
      <textarea className="rayas" aria-label={`Respuesta de desarrollo, pregunta ${n}`} value={valor} readOnly={corr} placeholder={corr ? '(sin respuesta)' : 'Escriba su respuesta aquí…'} onChange={(e) => onChange(e.target.value)} rows={corr ? Math.max(3, Math.ceil(valor.length / 70)) : 8} />
      {!corr && soportado() && <button className={'mic' + (oyendo ? ' on' : '')} aria-label={oyendo ? 'Detener dictado' : 'Dictar la respuesta'} onClick={toggle}>{oyendo ? <Stop /> : <Mic size={20} />}</button>}
      {err && <div className="sub" role="alert" style={{ color: 'var(--bad)' }}>{err}</div>}
    </div>
  );
}

// Correcciones "con lápiz rojo" debajo de cada pregunta.
function Correccion({ p, respuesta, evaluacion }) {
  if (p.tipo === 'alternativas') {
    const ok = respuesta === p.correcta;
    return (
      <div className="nota-roja">
        {respuesta === undefined && <div>Sin responder.</div>}
        {!ok && <div>Correcta: <b>{LETRAS[p.correcta]}) {p.opciones[p.correcta]}</b></div>}
        {p.explicacion && <div className="expl">{p.explicacion}</div>}
      </div>
    );
  }
  if (p.tipo === 'vf') {
    const ok = respuesta === p.correcta;
    return (
      <div className="nota-roja">
        {respuesta === undefined && <div>Sin responder.</div>}
        {!ok && <div>Correcta: <b>{p.correcta ? 'Verdadero' : 'Falso'}</b></div>}
        {p.explicacion && <div className="expl">{p.explicacion}</div>}
      </div>
    );
  }
  if (!String(respuesta || '').trim()) return <div className="nota-roja"><div>Sin responder.</div><Pauta p={p} /></div>;
  if (!evaluacion) return <div className="nota-roja"><div>Pendiente de corrección.</div></div>;
  const bien = evaluacion.ideas.filter((i) => i.estado === 'bien');
  const mal = evaluacion.ideas.filter((i) => i.estado !== 'bien');
  return (
    <div className="nota-roja">
      {evaluacion.resumen && <div>{evaluacion.resumen}</div>}
      {bien.map((i, k) => <div key={'b' + k} className="ok">✓ {i.idea}</div>)}
      {mal.map((i, k) => (
        <div key={'m' + k}>
          {i.estado === 'incorrecto' ? '✗ Dijo: “' + (i.dijiste || i.idea) + '”' : i.estado === 'parcial' ? '△ Incompleto: ' + i.idea : '✗ Faltó: ' + i.idea}
          {i.comentario && <span className="expl"> — {i.comentario}</span>}
        </div>
      ))}
    </div>
  );
}

function Pauta({ p }) {
  return <div className="expl">Pauta: {p.pauta.join(' · ')}</div>;
}
