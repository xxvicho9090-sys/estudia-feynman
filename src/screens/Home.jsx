import { useRef, useState } from 'react';
import { Gear, Plus, Folder, Trash } from '../icons.jsx';
import RamosPanel from './RamosPanel.jsx';
import { BannerInstalar } from './Instalar.jsx';
import PruebasTab from './PruebasTab.jsx';
import BannerIA from './BannerIA.jsx';
import { useLocal } from '../lib/local.js';
import BotonPantallaCompleta from './BotonPantallaCompleta.jsx';
import { formatoNota } from '../lib/grade.js';
import { hayIA } from '../lib/ai.js';
import { promedio, evaluados, totalConceptos, colorRamo } from '../lib/ramos.js';

const prom = (docs) => { const p = promedio(docs); return p == null ? null : formatoNota(p); };

function Notas({ docs }) {
  const p = prom(docs);
  return <div className="stats">{totalConceptos(docs)} conceptos · {evaluados(docs)} evaluados{p && <> · promedio <b>{p}</b></>}</div>;
}

export default function Home({ ramos, docs, sel, setSel, avisos, cerrarAviso, progreso, onFiles, onOpenConcept, onEditDoc, onNewRamo, onEditRamo, onSettings, tab, setTab, pruebas, errorPrueba, onCrearPrueba, onAbrirPrueba, onBorrarPrueba, onBorrarDocs }) {
  const input = useRef(null);
  const [modoSel, setModoSel] = useState(false);
  const [marcados, setMarcados] = useState([]);
  const [confirmar, setConfirmar] = useState(null); // lista de PDFs a borrar, esperando confirmación
  const alternar = (id) => setMarcados((m) => (m.includes(id) ? m.filter((x) => x !== id) : [...m, id]));
  const salirSel = () => { setModoSel(false); setMarcados([]); };
  const local = useLocal();
  const [panel, setPanel] = useState(false);
  const [pendientes, setPendientes] = useState(null);
  const ramo = ramos.find((r) => r.id === sel.ramoId);
  const doc = docs.find((d) => d.id === sel.docId);
  const docsRamo = ramo ? docs.filter((d) => d.ramoId === ramo.id) : docs;

  let cabecera, cuerpo;
  if (doc) {
    cabecera = <><div className="crumb">{ramo?.nombre}</div><h1>{doc.nombre}</h1><Notas docs={[doc]} /></>;
    cuerpo = !doc.conceptos.length
      ? <div className="empty">Este PDF no tiene conceptos todavía.<br /><button className="linkbtn" onClick={() => onEditDoc(doc.id)}>Agrégalos a mano</button></div>
      : <div className="list" role="list">{doc.conceptos.map((c) => (
        <button key={c.id} role="listitem" className="row" onClick={() => onOpenConcept(doc.id, c.id)}>
          <span>{c.nombre}</span>
          {c.nota == null ? <span className="go">Explicar</span> : <span className={'chip ' + (c.nota >= 4 ? 'ok' : 'no')}>{formatoNota(c.nota)}</span>}
        </button>))}</div>;
  } else if (ramo) {
    cabecera = <><div className="crumb">Ramo</div><h1>{ramo.nombre}</h1><Notas docs={docsRamo} /></>;
    cuerpo = !docsRamo.length
      ? <div className="empty">Este ramo no tiene PDFs.<br />Toca “Subir PDF” para agregar el primero.</div>
      : <div className="grid">{docsRamo.map((d) => (
        <div key={d.id} className={'tile-wrap' + (modoSel && marcados.includes(d.id) ? ' sel' : '')}>
          <Tile titulo={d.nombre} docs={[d]} pressed={modoSel ? marcados.includes(d.id) : undefined} onClick={() => (modoSel ? alternar(d.id) : setSel({ ramoId: ramo.id, docId: d.id }))} />
          {modoSel
            ? <span className="tile-check" aria-hidden="true">{marcados.includes(d.id) ? '✓' : ''}</span>
            : <button className="tile-del" aria-label={`Borrar ${d.nombre}`} title="Borrar este PDF" onClick={() => setConfirmar([d])}><Trash /></button>}
        </div>))}</div>;
  } else {
    cabecera = <><div className="crumb">Todos mis ramos</div><h1>Qué voy a<br />explicar hoy</h1></>;
    cuerpo = !ramos.length
      ? <div className="empty">Todavía no hay nada.<br />Sube un PDF de tus apuntes, elige su ramo y saco los conceptos para que los expliques.</div>
      : <div className="grid">{ramos.map((r) => { const ds = docs.filter((d) => d.ramoId === r.id); return <Tile key={r.id} color={colorRamo(ramos, r)} titulo={r.nombre} docs={ds} extra={`${ds.length} PDFs`} onClick={() => setSel({ ramoId: r.id })} />; })}</div>;
  }

  const enPruebas = tab === 'pruebas';
  if (enPruebas) {
    cabecera = <><div className="crumb">Evaluación</div><h1>Pruebas</h1><div className="stats">Crea una prueba sobre tus apuntes y recibe tu nota del 1 al 7.</div></>;
    cuerpo = <PruebasTab ramos={ramos} docs={docs} sel={sel} pruebas={pruebas} errorPrueba={errorPrueba} onCrear={onCrearPrueba} onAbrir={onAbrirPrueba} onBorrar={onBorrarPrueba} />;
  }

  return (
    <div className="shell">
      <main className="main">
        <div className="head">
          <div style={{ minWidth: 0 }}>{cabecera}</div>
          <div style={{ display: 'flex', gap: 8, flex: 'none' }}>
            {ramo && !doc && !enPruebas && <button className="ibtn" aria-label="Editar ramo" onClick={() => onEditRamo(ramo.id)}><span style={{ fontWeight: 800 }}>···</span></button>}
            {doc && !enPruebas && <button className="ibtn" aria-label="Editar PDF y conceptos" onClick={() => onEditDoc(doc.id)}><span style={{ fontWeight: 800 }}>···</span></button>}
            {doc && !enPruebas && <button className="ibtn" style={{ color: 'var(--bad)' }} aria-label={`Borrar ${doc.nombre}`} title="Borrar este PDF" onClick={() => setConfirmar([doc])}><Trash /></button>}
            {ramo && !doc && !enPruebas && docsRamo.length > 0 && <button className="ibtn" aria-label="Seleccionar PDFs para borrar" aria-pressed={modoSel} title="Seleccionar varios" style={modoSel ? { background: 'var(--acc-soft)', borderColor: 'var(--acc)' } : undefined} onClick={() => (modoSel ? salirSel() : setModoSel(true))}><span style={{ fontWeight: 800, fontSize: 18 }}>☑</span></button>}
            <BotonPantallaCompleta />
            <button className="ibtn" aria-label="Ajustes" onClick={onSettings}><Gear /></button>
            <button className="ibtn only-narrow" aria-label="Ver ramos y PDFs" onClick={() => setPanel(true)}><Folder /></button>
          </div>
        </div>

        <div className="tabs" role="tablist" aria-label="Secciones">
          <button role="tab" aria-selected={!enPruebas} className={!enPruebas ? 'on' : ''} onClick={() => setTab('estudiar')}>Estudiar</button>
          <button role="tab" aria-selected={enPruebas} className={enPruebas ? 'on' : ''} onClick={() => setTab('pruebas')}>Pruebas</button>
        </div>

        <input ref={input} type="file" accept="application/pdf,.pdf" multiple hidden onChange={(e) => { const f = [...e.target.files]; e.target.value = ''; if (f.length) setPendientes(f); }} />
        {!enPruebas && <button className="btn block up" onClick={() => input.current.click()} disabled={!!progreso}><Plus /> Subir PDF</button>}

        <BannerIA />
        {!enPruebas && !hayIA() && local.fase === 'inicio' && !local.pregunta && <button className="notice info" onClick={onSettings}>Falta conectar una IA gratis: sin ella no puedo sacar conceptos con precisión ni evaluarte. <b>Tocar para conectarla.</b></button>}
        {!enPruebas && <BannerInstalar />}
        {!enPruebas && avisos.map((a) => (
          <div key={a.id} className="notice" role="status"><b>{a.doc}:</b> {a.texto} <button className="linkbtn" onClick={() => cerrarAviso(a.id)}>Entendido</button></div>
        ))}
        {cuerpo}
      </main>

      <aside className="side" aria-label="Ramos y PDFs">
        <RamosPanel ramos={ramos} docs={docs} sel={sel} onSelect={setSel} onNewRamo={onNewRamo} />
      </aside>
      {panel && (
        <>
          <div className="drawer-bg" onClick={() => setPanel(false)} />
          <aside className="drawer" aria-label="Ramos y PDFs">
            <RamosPanel ramos={ramos} docs={docs} sel={sel} onSelect={setSel} onNewRamo={() => { setPanel(false); onNewRamo(); }} onClose={() => setPanel(false)} />
          </aside>
        </>
      )}

      {modoSel && (
        <div className="actualizar selbar" role="status">
          <span>{marcados.length === 0 ? 'Toca los PDFs que quieres borrar' : `${marcados.length} ${marcados.length === 1 ? 'seleccionado' : 'seleccionados'}`}</span>
          <button className="linkbtn" style={{ color: '#fff' }} onClick={salirSel}>Cancelar</button>
          <button className="btn" disabled={!marcados.length} onClick={() => setConfirmar(docsRamo.filter((d) => marcados.includes(d.id)))}>Borrar</button>
        </div>
      )}
      {confirmar && <ConfirmarBorrar docs={confirmar} onCancel={() => setConfirmar(null)} onOk={() => { const ids = confirmar.map((d) => d.id); setConfirmar(null); salirSel(); onBorrarDocs(ids); }} />}
      {pendientes && <ElegirRamo archivos={pendientes} ramos={ramos} inicial={sel.ramoId} onCancel={() => setPendientes(null)} onOk={(destino) => { const f = pendientes; setPendientes(null); onFiles(f, destino); }} />}
      {progreso && (
        <div className="sheet" role="alertdialog" aria-label="Procesando">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><div className="spin" /><b style={{ fontSize: 18 }}>Preparando tus conceptos</b></div>
            <div className="sub" style={{ marginTop: 10 }}>{progreso.archivo}</div>
            <div className="sub">{progreso.texto}</div>
            <div className="prog" style={{ marginTop: 14, height: 8 }}><i style={{ width: `${Math.round(progreso.fraccion * 100)}%` }} /></div>
          </div>
        </div>
      )}
    </div>
  );
}

function Tile({ titulo, docs, color, extra, onClick, pressed }) {
  const total = totalConceptos(docs), ev = evaluados(docs), p = prom(docs);
  return (
    <button className="tile" onClick={onClick} aria-pressed={pressed}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}>
        {color && <span className="dot" style={{ background: color }} />}
        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{titulo}</span>
        {p && <span className={'chip ' + (parseFloat(p.replace(',', '.')) >= 4 ? 'ok' : 'no')}>{p}</span>}
      </span>
      <span className="prog" style={{ width: '100%' }}><i style={{ width: total ? `${(ev / total) * 100}%` : 0 }} /></span>
      <span className="sub">{extra ? extra + ' · ' : ''}{ev} de {total} conceptos evaluados</span>
    </button>
  );
}

// Pregunta en qué ramo van los PDFs: uno existente o uno nuevo.
function ElegirRamo({ archivos, ramos, inicial, onCancel, onOk }) {
  const [valor, setValor] = useState(inicial || ramos[0]?.id || '__nuevo');
  const [nombre, setNombre] = useState('');
  const nuevo = valor === '__nuevo';
  const ok = () => onOk(nuevo ? { nuevo: nombre.trim() } : { ramoId: valor });
  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-label="Elegir ramo">
      <div>
        <h2>¿En qué ramo van?</h2>
        <div className="sub" style={{ marginBottom: 16 }}>{archivos.length === 1 ? archivos[0].name : `${archivos.length} PDFs`}</div>
        <label className="l" htmlFor="rm">Ramo</label>
        <select id="rm" className="txt" value={valor} onChange={(e) => setValor(e.target.value)}>
          {ramos.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
          <option value="__nuevo">+ Crear ramo nuevo…</option>
        </select>
        {nuevo && <><label className="l" htmlFor="rn" style={{ marginTop: 14 }}>Nombre del ramo nuevo</label>
          <input id="rn" className="txt" autoFocus value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej.: Derecho societario" /></>}
        <div className="two" style={{ marginTop: 20 }}>
          <button className="btn ghost" onClick={onCancel}>Cancelar</button>
          <button className="btn" onClick={ok} disabled={nuevo && !nombre.trim()}>Subir</button>
        </div>
      </div>
    </div>
  );
}

// Confirmación antes de borrar: dice exactamente qué se pierde.
function ConfirmarBorrar({ docs, onCancel, onOk }) {
  const conceptos = docs.reduce((n, d) => n + d.conceptos.length, 0);
  const notas = docs.reduce((n, d) => n + d.conceptos.filter((c) => c.nota != null).length, 0);
  return (
    <div className="sheet" role="alertdialog" aria-modal="true" aria-label="Borrar PDFs" onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div>
        <h2>{docs.length === 1 ? '¿Borrar este PDF?' : `¿Borrar ${docs.length} PDFs?`}</h2>
        <ul style={{ margin: '10px 0 0', paddingLeft: 20, fontSize: 15, lineHeight: 1.6 }}>
          {docs.slice(0, 5).map((d) => <li key={d.id} style={{ overflowWrap: 'anywhere' }}>{d.nombre}</li>)}
          {docs.length > 5 && <li>y {docs.length - 5} más…</li>}
        </ul>
        <p className="sub" style={{ fontSize: 14, lineHeight: 1.5, margin: '12px 0 18px' }}>Se eliminan sus {conceptos} conceptos{notas ? ` y las ${notas} notas que sacaste` : ''}. Las pruebas ya creadas se conservan. Después podrás pulsar “Deshacer” unos segundos.</p>
        <div className="two">
          <button className="btn ghost" onClick={onCancel}>Cancelar</button>
          <button className="btn" style={{ background: 'var(--bad-bar)', boxShadow: 'none' }} onClick={onOk}>Borrar</button>
        </div>
      </div>
    </div>
  );
}
