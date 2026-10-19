import { useRef, useState } from 'react';
import { Gear, Plus, Folder } from '../icons.jsx';
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

export default function Home({ ramos, docs, sel, setSel, avisos, cerrarAviso, progreso, onFiles, onOpenConcept, onEditDoc, onNewRamo, onEditRamo, onSettings, tab, setTab, pruebas, errorPrueba, onCrearPrueba, onAbrirPrueba, onBorrarPrueba }) {
  const input = useRef(null);
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
      : <div className="grid">{docsRamo.map((d) => <Tile key={d.id} titulo={d.nombre} docs={[d]} onClick={() => setSel({ ramoId: ramo.id, docId: d.id })} />)}</div>;
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

function Tile({ titulo, docs, color, extra, onClick }) {
  const total = totalConceptos(docs), ev = evaluados(docs), p = prom(docs);
  return (
    <button className="tile" onClick={onClick}>
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
