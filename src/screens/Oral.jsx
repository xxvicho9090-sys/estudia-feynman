import { useEffect, useRef, useState } from 'react';
import { Back, Mic, Stop, Altavoz, Enviar } from '../icons.jsx';
import BotonPantallaCompleta from './BotonPantallaCompleta.jsx';
import { empezarDictado, pararDictado, soportado } from '../lib/voice.js';
import { hablar, callar, motorActual, puedeOfrecerVoz, alCambiarVoces } from '../lib/hablar.js';
import { useVozNatural } from '../lib/vozNatural.js';
import ElegirVoz from './ElegirVoz.jsx';
import { calentar } from '../lib/ai.js';
import { conceptoActual, ultimaPregunta, registrarRespuesta, aplicarEvaluacion, pasarConcepto } from '../lib/oral.js';
import { evaluarRespuestaOral } from '../lib/oralIA.js';

const palabras = (t) => (t.trim() ? t.trim().split(/\s+/).length : 0);
const SILENCIO_MS = 2800; // en manos libres: tras este silencio se entrega la respuesta

// Sesión de interrogatorio: el profesor pregunta (en texto y, si quieres, en voz), tú respondes hablando o escribiendo.
export default function Oral({ oral, onActualizar, onBack, onResultado }) {
  const c = conceptoActual(oral);
  const fin = oral.estado === 'terminado';
  const pendiente = !fin && c.turnos.length > 0 && c.turnos[c.turnos.length - 1].rol === 'alumno'; // respondió pero aún no lo evaluaron
  const [texto, setTexto] = useState('');
  const [oyendo, setOyendo] = useState(false);
  const [evaluando, setEvaluando] = useState(false);
  const [error, setError] = useState('');
  const [seg, setSeg] = useState(0);
  const [confirmarPasar, setConfirmarPasar] = useState(false);
  const [eligiendoVoz, setEligiendoVoz] = useState(false);
  const [, redibujar] = useState(0);
  useVozNatural(); // al terminar de descargar la voz natural, esta pantalla se actualiza sola
  useEffect(() => alCambiarVoces(() => redibujar((x) => x + 1)), []);
  const base = useRef('');
  const abort = useRef(null);
  const silencio = useRef(null);
  const lista = useRef(null);
  const ultimo = useRef({});
  const motor = motorActual();
  const voz = oral.voz && motor.tipo !== 'ninguno';
  const manos = oral.manos && voz && soportado();
  ultimo.current = { oral, manos };

  useEffect(() => { calentar(); return () => { callar(); pararDictado(); clearTimeout(silencio.current); abort.current?.abort(); }; }, []);
  useEffect(() => {
    if (!evaluando) { setSeg(0); return undefined; }
    const t = setInterval(() => setSeg((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [evaluando]);
  useEffect(() => { const el = lista.current; if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' }); }, [oral.actual, c.turnos.length, evaluando, fin]);

  const parar = async () => { clearTimeout(silencio.current); if (oyendo) { await pararDictado(); setOyendo(false); } };
  const evaluar = async (desde) => {
    setError(''); setEvaluando(true);
    abort.current = new AbortController();
    try {
      const ev = await evaluarRespuestaOral(desde, { signal: abort.current.signal });
      onActualizar((actual) => aplicarEvaluacion(actual, ev));
    } catch (e) {
      if (e?.name !== 'AbortError') setError(e?.message || 'No pude evaluar su respuesta.');
    } finally { setEvaluando(false); }
  };
  const entregar = async (t) => {
    await parar(); callar();
    if (palabras(t) < 2) { setError('Responda con al menos una frase para que el profesor pueda evaluarlo.'); return; }
    setTexto('');
    const conRespuesta = registrarRespuesta(ultimo.current.oral, t);
    onActualizar(() => conRespuesta);
    evaluar(conRespuesta);
  };
  const empezar = async () => {
    setError('');
    base.current = texto ? texto.trimEnd() + ' ' : '';
    setOyendo(true);
    await empezarDictado(
      (t) => {
        setTexto(base.current + t);
        clearTimeout(silencio.current);
        if (ultimo.current.manos) silencio.current = setTimeout(() => entregar(base.current + t), SILENCIO_MS);
      },
      () => setOyendo(false),
      (m) => { setError(m); setOyendo(false); },
    );
  };

  // Cuando el profesor formula una pregunta nueva se lee en voz alta y, en manos libres, se abre el micrófono al terminar.
  const pregunta = ultimaPregunta(oral);
  const leida = useRef('');
  useEffect(() => {
    if (fin || pendiente || !pregunta || leida.current === pregunta) return;
    leida.current = pregunta;
    if (!voz) return;
    hablar(pregunta, () => { if (ultimo.current.manos) empezar(); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pregunta, voz, fin, pendiente]);
  useEffect(() => { if (fin && voz) hablar(c.turnos[c.turnos.length - 1].texto); }, [fin]); // eslint-disable-line react-hooks/exhaustive-deps

  const pasar = async () => { await parar(); callar(); setConfirmarPasar(false); setTexto(''); onActualizar((actual) => pasarConcepto(actual)); };

  const estado = evaluando ? 'escribiendo…' : fin ? 'Interrogatorio terminado' : oyendo ? 'escuchándole…' : `Pregunta ${oral.actual + 1} de ${oral.conceptos.length}`;
  const enviarConEnter = (e) => { if (e.key === 'Enter' && !e.shiftKey && window.matchMedia?.('(pointer:fine)').matches) { e.preventDefault(); if (!evaluando && palabras(texto) >= 2) entregar(texto); } };
  const crecer = (el) => { if (!el) return; el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 150) + 'px'; };
  const visibles = oral.conceptos.map((k, i) => ({ k, i })).filter(({ i }) => i <= oral.actual);

  return (
    <div className="page oral">
      <div className="chat-head">
        <button className="ibtn" aria-label="Salir del interrogatorio" onClick={onBack}><Back /></button>
        <div className="avatar" aria-hidden="true">Pr</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="chat-nombre">Profesor</div>
          <div className={'chat-estado' + (evaluando ? ' esc' : '')} role="status">{estado}</div>
        </div>
        {puedeOfrecerVoz() && <button className={'ibtn' + (voz ? ' on' : '')} aria-pressed={!!voz} aria-label={voz ? 'Apagar la voz del profesor' : 'Activar la voz del profesor'} title="Voz del profesor" onClick={() => { callar(); if (!voz && motor.tipo === 'ninguno') { setEligiendoVoz(true); onActualizar((o) => ({ ...o, voz: true })); return; } onActualizar((o) => ({ ...o, voz: !o.voz, manos: o.voz ? false : o.manos })); }}><Altavoz /></button>}
        <BotonPantallaCompleta />
      </div>
      <div className="oral-prog" role="progressbar" aria-valuemin={0} aria-valuemax={oral.conceptos.length} aria-valuenow={fin ? oral.conceptos.length : oral.actual} aria-label="Avance del interrogatorio">
        {oral.conceptos.map((k, i) => <i key={k.id} className={k.estado === 'listo' ? 'ok' : i === oral.actual && !fin ? 'now' : ''} />)}
      </div>

      <section className="chat" ref={lista} aria-label="Conversación con el profesor" aria-live="polite">
        <div className="chat-aviso">Interrogatorio oral · {oral.titulo}</div>
        {visibles.map(({ k, i }) => (
          <div key={k.id} className="chat-tema">
            <div className="chat-sep"><span>Tema {i + 1} de {oral.conceptos.length} · {k.nombre}</span></div>
            {k.turnos.map((t, j) => (
              <div key={j} className={'msg ' + t.rol + (j > 0 && k.turnos[j - 1].rol === t.rol ? ' seguido' : '')}>
                {t.rol === 'profesor' && <div className="avatar mini" aria-hidden="true">Pr</div>}
                <div className="msg-b">{t.texto}</div>
              </div>
            ))}
          </div>
        ))}
        {evaluando && <div className="msg profesor"><div className="avatar mini" aria-hidden="true">Pr</div><div className="msg-b escribiendo" aria-label="El profesor está escribiendo"><span className="puntos"><i /><i /><i /></span>{seg >= 6 && <span className="seg">{seg} s</span>}</div></div>}
      </section>

      {fin ? (
        <div className="oral-ctl"><button className="btn block" style={{ height: 56 }} onClick={onResultado}>Ver mi nota y la retroalimentación</button></div>
      ) : pendiente && !evaluando ? (
        <div className="oral-ctl">
          <div className="notice" role="alert">{error || 'Falta evaluar su última respuesta.'}</div>
          <button className="btn block" onClick={() => evaluar(oral)}>Reintentar evaluación</button>
        </div>
      ) : (
        <div className="oral-ctl">
          {error && <div className="notice" role="alert" style={{ marginTop: 0, marginBottom: 8 }}>{error}</div>}
          <div className="compositor">
            <textarea ref={(el) => crecer(el)} rows={1} className="oral-ta" value={texto} onChange={(e) => { setTexto(e.target.value); crecer(e.target); }} onKeyDown={enviarConEnter} disabled={evaluando} aria-label="Su respuesta" placeholder={oyendo ? 'Escuchándole…' : soportado() ? 'Escriba o use el micrófono…' : 'Escriba su respuesta…'} />
            {soportado() && <button className={'rbtn' + (oyendo ? ' rec' : '')} aria-label={oyendo ? 'Detener dictado' : 'Responder hablando'} onClick={oyendo ? parar : empezar} disabled={evaluando}>{oyendo ? <Stop /> : <Mic />}</button>}
            <button className="rbtn enviar" aria-label="Enviar respuesta" disabled={evaluando || palabras(texto) < 2} onClick={() => entregar(texto)}><Enviar /></button>
          </div>
          <div className="oral-extra">
            {voz && <button className="chipmini" onClick={() => hablar(pregunta)}>↻ Repetir pregunta</button>}
            {puedeOfrecerVoz() && soportado() && <button className={'chipmini' + (manos ? ' on' : '')} aria-pressed={!!manos} title="El profesor habla y su respuesta se envía sola al callar" onClick={() => onActualizar((o) => ({ ...o, voz: manos ? o.voz : true, manos: !manos }))}>Manos libres</button>}
            {voz && <button className="chipmini" onClick={() => setEligiendoVoz(true)}>Voz: {motor.etiqueta}{!motor.natural ? ' ⚠' : ''}</button>}
            <button className="chipmini" disabled={evaluando} onClick={() => setConfirmarPasar(true)}>No sé, pasar</button>
          </div>
        </div>
      )}

      {eligiendoVoz && <ElegirVoz onClose={() => setEligiendoVoz(false)} />}
      {confirmarPasar && (
        <div className="sheet" role="alertdialog" aria-modal="true" aria-label="Pasar de concepto" onClick={(e) => { if (e.target === e.currentTarget) setConfirmarPasar(false); }}>
          <div>
            <h2>¿Pasar a la siguiente pregunta?</h2>
            <p className="sub" style={{ fontSize: 15, lineHeight: 1.5, margin: '8px 0 18px' }}>«{c.nombre}» quedará sin responder y cuenta como 0 en este interrogatorio.</p>
            <div className="two"><button className="btn ghost" onClick={() => setConfirmarPasar(false)}>Volver</button><button className="btn" onClick={pasar}>Pasar</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
