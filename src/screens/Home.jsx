import { useRef, useState } from 'react';
import { Gear, Plus, Folder, Trash, Back, Mover } from '../icons.jsx';
import MoverA from './MoverA.jsx';
import { empezarArrastre, hayArrastreDoc, leerArrastre } from '../lib/mover.js';
import RamosPanel from './RamosPanel.jsx';
import { BannerInstalar } from './Instalar.jsx';
import PruebasTab from './PruebasTab.jsx';
import OralTab from './OralTab.jsx';
import BannerIA from './BannerIA.jsx';
import { useLocal } from '../lib/local.js';
import BotonPantallaCompleta from './BotonPantallaCompleta.jsx';
import { formatoNota } from '../lib/grade.js';
import { hayIA } from '../lib/ai.js';
import { soloPdfs, sinRepetidos, leerDrop, esDuplicado, tamanoLegible } from '../lib/archivos.js';
import { promedio, evaluados, totalConceptos, colorRamo } from '../lib/ramos.js';

const prom = (docs) => { const p = promedio(docs); return p == null ? null : formatoNota(p); };

// Flecha para volver un paso (PDF → ramo → inicio), con el nombre de adónde lleva.
function Atras({ texto, etiqueta, onClick }) {
  return <button className="atras" aria-label={etiqueta} onClick={onClick}><Back /><span>{texto}</span></button>;
}

function Notas({ docs, onReiniciar }) {
  const p = prom(docs);
  return (
    <div className="stats">
      {totalConceptos(docs)} conceptos · {evaluados(docs)} evaluados{p && <> · promedio <b>{p}</b></>}
      {onReiniciar && evaluados(docs) > 0 && <> · <button className="linkbtn" style={{ fontWeight: 700 }} onClick={onReiniciar} title="Quita las notas de los conceptos para volver a empezar">Reiniciar notas</button></>}
    </div>
  );
}

export default function Home({ ramos, docs, sel, setSel, avisos, cerrarAviso, progreso, onFiles, onOpenConcept, onEditDoc, onNewRamo, onEditRamo, onSettings, tab, setTab, pruebas, errorPrueba, onCrearPrueba, onAbrirPrueba, onBorrarPrueba, onBorrarDocs, onCancelarSubida, onMoverDocs, onReiniciarNotas, orales, errorOral, onCrearOral, onAbrirOral, onBorrarOral }) {
  const input = useRef(null);
  const [reiniciar, setReiniciar] = useState(null); // { docs, donde }: PDFs cuyas notas se van a reiniciar, esperando confirmación
  const [moviendo, setMoviendo] = useState(null); // PDFs que se van a mover con el botón "Mover a…"
  const [arrastrandoDoc, setArrastrandoDoc] = useState(false);
  const [sobreRamo, setSobreRamo] = useState(null);
  // Arrastrar un PDF (o los seleccionados) y soltarlo sobre un ramo.
  const arrastrarDocs = (d) => ({
    draggable: true,
    onDragStart: (e) => { empezarArrastre(e, modoSel && marcados.includes(d.id) ? marcados : [d.id]); setArrastrandoDoc(true); },
    onDragEnd: () => { setArrastrandoDoc(false); setSobreRamo(null); },
  });
  const soltarEn = (ramoId) => ({
    onDragOver: (e) => { if (!hayArrastreDoc(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setSobreRamo(ramoId); },
    onDragLeave: (e) => { if (!e.currentTarget.contains(e.relatedTarget)) setSobreRamo((x) => (x === ramoId ? null : x)); },
    onDrop: (e) => { if (!hayArrastreDoc(e)) return; e.preventDefault(); e.stopPropagation(); setSobreRamo(null); setArrastrandoDoc(false); const ids = leerArrastre(e); if (ids.length) { setMarcados([]); onMoverDocs(ids, { ramoId }); } },
  });
  const carpeta = useRef(null);
  const [arrastrando, setArrastrando] = useState(false);
  const [sinPdf, setSinPdf] = useState(false);
  // Recibe lo elegido (archivos, carpeta o arrastrado): se queda solo con los PDFs, sin repetidos dentro del pack.
  const recibir = (lista) => { const pdfs = sinRepetidos(soloPdfs(lista)); setSinPdf(!pdfs.length); if (pdfs.length) setPendientes(pdfs); };
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
    cabecera = <><Atras texto={ramo?.nombre} etiqueta={`Volver a ${ramo?.nombre || 'el ramo'}`} onClick={() => setSel({ ramoId: ramo?.id })} /><h1>{doc.nombre}</h1><Notas docs={[doc]} onReiniciar={() => setReiniciar({ docs: [doc], donde: `de “${doc.nombre}”` })} /></>;
    cuerpo = !doc.conceptos.length
      ? <div className="empty">Este PDF no tiene conceptos todavía.<br /><button className="linkbtn" onClick={() => onEditDoc(doc.id)}>Agrégalos a mano</button></div>
      : <div className="list" role="list">{doc.conceptos.map((c) => (
        <button key={c.id} role="listitem" className="row" onClick={() => onOpenConcept(doc.id, c.id)}>
          <span>{c.nombre}</span>
          {c.nota == null ? <span className="go">Explicar</span> : <span className={'chip ' + (c.nota >= 4 ? 'ok' : 'no')}>{formatoNota(c.nota)}</span>}
        </button>))}</div>;
  } else if (ramo) {
    cabecera = <><Atras texto="Todos los ramos" etiqueta="Volver al inicio" onClick={() => { salirSel(); setSel({}); }} /><h1>{ramo.nombre}</h1><Notas docs={docsRamo} onReiniciar={() => setReiniciar({ docs: docsRamo, donde: `del ramo “${ramo.nombre}”` })} /></>;
    cuerpo = !docsRamo.length
      ? <div className="empty">Este ramo no tiene PDFs.<br />Toca “Subir PDFs” para agregar el primero.</div>
      : <div className="grid">{docsRamo.map((d) => (
        <div key={d.id} {...arrastrarDocs(d)} className={'tile-wrap' + (modoSel && marcados.includes(d.id) ? ' sel' : '')}>
          <Tile titulo={d.nombre} docs={[d]} pressed={modoSel ? marcados.includes(d.id) : undefined} onClick={() => (modoSel ? alternar(d.id) : setSel({ ramoId: ramo.id, docId: d.id }))} />
          {modoSel
            ? <span className="tile-check" aria-hidden="true">{marcados.includes(d.id) ? '✓' : ''}</span>
            : <>
              <button className="tile-mover" aria-label={`Mover ${d.nombre} a otro ramo`} title="Mover a otro ramo" onClick={() => setMoviendo([d])}><Mover /></button>
              <button className="tile-del" aria-label={`Borrar ${d.nombre}`} title="Borrar este PDF" onClick={() => setConfirmar([d])}><Trash /></button>
            </>}
        </div>))}</div>;
  } else {
    cabecera = <><div className="crumb">Todos mis ramos</div><h1>Qué voy a<br />explicar hoy</h1>{docs.length > 0 && <Notas docs={docs} onReiniciar={() => setReiniciar({ docs, donde: 'de todos tus ramos' })} />}</>;
    cuerpo = !ramos.length
      ? <div className="empty">Todavía no hay nada.<br />Sube un PDF de tus apuntes, elige su ramo y saco los conceptos para que los expliques.</div>
      : <div className="grid">{ramos.map((r) => { const ds = docs.filter((d) => d.ramoId === r.id); return <div key={r.id} {...soltarEn(r.id)} className={sobreRamo === r.id ? 'tile-wrap dropzona' : 'tile-wrap'}><Tile color={colorRamo(ramos, r)} titulo={r.nombre} docs={ds} extra={`${ds.length} PDFs`} onClick={() => setSel({ ramoId: r.id })} /></div>; })}</div>;
  }

  // "enPruebas" = fuera de la pestaña Estudiar (Pruebas u Oral): ahí no se muestran las herramientas de subir PDFs.
  const enPruebas = tab !== 'estudiar';
  if (tab === 'pruebas') {
    cabecera = <><div className="crumb">Evaluación</div><h1>Pruebas</h1><div className="stats">Crea una prueba sobre tus apuntes y recibe tu nota del 1 al 7.</div></>;
    cuerpo = <PruebasTab ramos={ramos} docs={docs} sel={sel} pruebas={pruebas} errorPrueba={errorPrueba} onCrear={onCrearPrueba} onAbrir={onAbrirPrueba} onBorrar={onBorrarPrueba} />;
  } else if (tab === 'oral') {
    cabecera = <><div className="crumb">Evaluación</div><h1>Oral</h1><div className="stats">Un profesor te interroga sobre tus apuntes, hablando o escribiendo.</div></>;
    cuerpo = <OralTab ramos={ramos} docs={docs} sel={sel} orales={orales} error={errorOral} onCrear={onCrearOral} onAbrir={onAbrirOral} onBorrar={onBorrarOral} />;
  }

  return (
    <div className={'shell' + (arrastrando ? ' drop' : '')}
      onDragOver={(e) => { if (enPruebas || progreso || !e.dataTransfer?.types?.includes('Files')) return; e.preventDefault(); setArrastrando(true); }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setArrastrando(false); }}
      onDrop={async (e) => { e.preventDefault(); setArrastrando(false); if (hayArrastreDoc(e) || enPruebas || progreso) return; recibir(await leerDrop(e.dataTransfer)); }}>
      <main className="main">
        <div className="head">
          <div style={{ minWidth: 0 }}>{cabecera}</div>
          <div style={{ display: 'flex', gap: 8, flex: 'none' }}>
            {ramo && !doc && !enPruebas && <button className="ibtn" aria-label="Editar ramo" onClick={() => onEditRamo(ramo.id)}><span style={{ fontWeight: 800 }}>···</span></button>}
            {doc && !enPruebas && <button className="ibtn" aria-label="Editar PDF y conceptos" onClick={() => onEditDoc(doc.id)}><span style={{ fontWeight: 800 }}>···</span></button>}
            {doc && !enPruebas && <button className="ibtn" aria-label={`Mover ${doc.nombre} a otro ramo`} title="Mover a otro ramo" onClick={() => setMoviendo([doc])}><Mover /></button>}
            {doc && !enPruebas && <button className="ibtn" style={{ color: 'var(--bad)' }} aria-label={`Borrar ${doc.nombre}`} title="Borrar este PDF" onClick={() => setConfirmar([doc])}><Trash /></button>}
            {ramo && !doc && !enPruebas && docsRamo.length > 0 && <button className="ibtn" aria-label="Seleccionar PDFs para borrar" aria-pressed={modoSel} title="Seleccionar varios" style={modoSel ? { background: 'var(--acc-soft)', borderColor: 'var(--acc)' } : undefined} onClick={() => (modoSel ? salirSel() : setModoSel(true))}><span style={{ fontWeight: 800, fontSize: 18 }}>☑</span></button>}
            <BotonPantallaCompleta />
            <button className="ibtn" aria-label="Ajustes" onClick={onSettings}><Gear /></button>
            <button className="ibtn only-narrow" aria-label="Ver ramos y PDFs" onClick={() => setPanel(true)}><Folder /></button>
          </div>
        </div>

        <div className="tabs" role="tablist" aria-label="Secciones">
          <button role="tab" aria-selected={!enPruebas} className={!enPruebas ? 'on' : ''} onClick={() => setTab('estudiar')}>Estudiar</button>
          <button role="tab" aria-selected={tab === 'pruebas'} className={tab === 'pruebas' ? 'on' : ''} onClick={() => setTab('pruebas')}>Pruebas</button>
          <button role="tab" aria-selected={tab === 'oral'} className={tab === 'oral' ? 'on' : ''} onClick={() => setTab('oral')}>Oral</button>
        </div>

        <input ref={input} type="file" accept="application/pdf,.pdf" multiple hidden onChange={(e) => { const f = [...e.target.files]; e.target.value = ''; if (f.length) recibir(f); }} />
        <input ref={carpeta} type="file" webkitdirectory="" directory="" multiple hidden onChange={(e) => { const f = [...e.target.files]; e.target.value = ''; if (f.length) recibir(f); }} />
        {!enPruebas && (
          <>
            <div className="subir-fila">
              <button className="btn" style={{ flex: 1 }} onClick={() => input.current.click()} disabled={!!progreso}><Plus /> Subir PDFs</button>
              <button className="btn ghost" onClick={() => carpeta.current.click()} disabled={!!progreso} title="Sube todos los PDFs de una carpeta"><Folder /> Subir carpeta</button>
            </div>
            <div className="sub" style={{ marginTop: 8 }}>Puedes elegir muchos PDFs a la vez (con Ctrl o Shift), una carpeta entera, o arrastrarlos aquí.</div>
            {sinPdf && <div className="notice" role="alert">No encontré PDFs en lo que elegiste. <button className="linkbtn" onClick={() => setSinPdf(false)}>Entendido</button></div>}
          </>
        )}

        <BannerIA />
        {!enPruebas && !hayIA() && local.fase === 'inicio' && !local.pregunta && <button className="notice info" onClick={onSettings}>Falta conectar una IA gratis: sin ella no puedo sacar conceptos con precisión ni evaluarte. <b>Tocar para conectarla.</b></button>}
        {!enPruebas && <BannerInstalar />}
        {!enPruebas && avisos.map((a) => (
          <div key={a.id} className="notice" role="status"><b>{a.doc}:</b> {a.texto} <button className="linkbtn" onClick={() => cerrarAviso(a.id)}>Entendido</button></div>
        ))}
        {cuerpo}
      </main>

      <aside className="side" aria-label="Ramos y PDFs">
        <RamosPanel ramos={ramos} docs={docs} sel={sel} onSelect={setSel} onNewRamo={onNewRamo} destino={soltarEn} sobre={sobreRamo} arrastrar={arrastrarDocs} />
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
          <span>{marcados.length === 0 ? 'Toca los PDFs que quieres borrar o mover' : `${marcados.length} ${marcados.length === 1 ? 'seleccionado' : 'seleccionados'}`}</span>
          <button className="linkbtn" style={{ color: '#fff' }} onClick={salirSel}>Cancelar</button>
          <button className="btn" style={{ background: 'var(--card)', color: 'var(--ink)' }} disabled={!marcados.length} onClick={() => setMoviendo(docsRamo.filter((d) => marcados.includes(d.id)))}>Mover</button>
          <button className="btn" disabled={!marcados.length} onClick={() => setConfirmar(docsRamo.filter((d) => marcados.includes(d.id)))}>Borrar</button>
        </div>
      )}
      {arrastrandoDoc && <div className="actualizar arrastre-hint" role="status">Suelta el PDF sobre un ramo del panel de la derecha</div>}
      {moviendo && <MoverA docs={moviendo} ramos={ramos} onCancel={() => setMoviendo(null)} onOk={(destino) => { const ids = moviendo.map((d) => d.id); setMoviendo(null); salirSel(); onMoverDocs(ids, destino); }} />}
      {reiniciar && <ConfirmarReiniciar docs={reiniciar.docs} donde={reiniciar.donde} onCancel={() => setReiniciar(null)} onOk={() => { const ids = reiniciar.docs.map((d) => d.id); setReiniciar(null); onReiniciarNotas(ids); }} />}
      {confirmar && <ConfirmarBorrar docs={confirmar} onCancel={() => setConfirmar(null)} onOk={() => { const ids = confirmar.map((d) => d.id); setConfirmar(null); salirSel(); onBorrarDocs(ids); }} />}
      {pendientes && <ElegirRamo archivos={pendientes} ramos={ramos} docs={docs} inicial={sel.ramoId} onCancel={() => setPendientes(null)} onOk={(destino, elegidos) => { setPendientes(null); onFiles(elegidos, destino); }} />}
      {progreso && (
        <div className="sheet" role="alertdialog" aria-label="Procesando">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><div className="spin" /><b style={{ fontSize: 18 }}>{progreso.total > 1 ? `PDF ${progreso.indice} de ${progreso.total}` : 'Preparando tus conceptos'}</b></div>
            <div className="sub" style={{ marginTop: 10, overflowWrap: 'anywhere' }}>{progreso.archivo}</div>
            <div className="sub">{progreso.texto}</div>
            <div className="prog" style={{ marginTop: 14, height: 8 }}><i style={{ width: `${Math.round(((progreso.total > 1 ? progreso.indice - 1 + progreso.fraccion : progreso.fraccion) / (progreso.total || 1)) * 100)}%` }} /></div>
            {progreso.total > 1 && <div className="sub" style={{ marginTop: 8 }}>Avance general: {Math.round(((progreso.indice - 1 + progreso.fraccion) / progreso.total) * 100)} %. Con muchos PDFs puede tardar varios minutos.</div>}
            <button className="linkbtn" style={{ marginTop: 14 }} onClick={onCancelarSubida}>{progreso.total > 1 ? 'Cancelar lo que falta' : 'Cancelar'}</button>
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

// Pack de PDFs: elige en qué ramo van y cuáles subir. Se puede quitar cualquiera; los repetidos vienen sin marcar.
const alternarEn = (set, i) => { const n = new Set(set); if (n.has(i)) n.delete(i); else n.add(i); return n; };

function ElegirRamo({ archivos, ramos, docs, inicial, onCancel, onOk }) {
  const [valor, setValor] = useState(inicial || ramos[0]?.id || '__nuevo');
  const [nombre, setNombre] = useState('');
  const [quitados, setQuitados] = useState(new Set()); // desmarcados por la persona
  const [conRepetidos, setConRepetidos] = useState(new Set()); // repetidos que marcó a propósito
  const nuevo = valor === '__nuevo';
  const delRamo = nuevo ? [] : docs.filter((d) => d.ramoId === valor);
  const repetido = archivos.map((f) => esDuplicado(f, delRamo));
  const incluido = (i) => (repetido[i] ? conRepetidos.has(i) : !quitados.has(i));
  const elegidos = archivos.filter((_, i) => incluido(i));
  const peso = elegidos.reduce((n, f) => n + f.size, 0);
  const nRep = repetido.filter(Boolean).length;
  const alternar = (i) => (repetido[i] ? setConRepetidos((s) => alternarEn(s, i)) : setQuitados((s) => alternarEn(s, i)));
  const todos = (marcar) => { setConRepetidos(new Set()); setQuitados(marcar ? new Set() : new Set(archivos.map((_, i) => i).filter((i) => !repetido[i]))); };
  const ok = () => onOk(nuevo ? { nuevo: nombre.trim() } : { ramoId: valor }, elegidos);
  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-label="Elegir ramo">
      <div>
        <h2>{archivos.length === 1 ? '¿En qué ramo va?' : `Subir ${archivos.length} PDFs: ¿en qué ramo van?`}</h2>
        <label className="l" htmlFor="rm" style={{ marginTop: 14 }}>Ramo</label>
        <select id="rm" className="txt" value={valor} onChange={(e) => setValor(e.target.value)}>
          {ramos.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
          <option value="__nuevo">+ Crear ramo nuevo…</option>
        </select>
        {nuevo && <><label className="l" htmlFor="rn" style={{ marginTop: 14 }}>Nombre del ramo nuevo</label>
          <input id="rn" className="txt" autoFocus value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej.: Derecho societario" /></>}

        {archivos.length > 1 && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 18 }}>
              <div className="l" style={{ margin: 0 }}>Archivos del pack</div>
              <span><button className="linkbtn" style={{ fontSize: 13 }} onClick={() => todos(true)}>Marcar todos</button> · <button className="linkbtn" style={{ fontSize: 13 }} onClick={() => todos(false)}>Quitar todos</button></span>
            </div>
            <div className="pack" role="group" aria-label="PDFs a subir">
              {archivos.map((f, i) => (
                <label key={i} className="pack-fila">
                  <input type="checkbox" checked={incluido(i)} onChange={() => alternar(i)} />
                  <span className="pack-n">{f.name}</span>
                  {repetido[i] && <span className="pack-rep">Ya está en este ramo</span>}
                  <span className="sub">{tamanoLegible(f.size)}</span>
                </label>
              ))}
            </div>
            {nRep > 0 && <div className="sub" style={{ marginTop: 8 }}>{nRep === 1 ? '1 PDF ya estaba' : `${nRep} PDFs ya estaban`} en este ramo y vienen sin marcar; márcalos si quieres subirlos otra vez.</div>}
            {elegidos.length > 5 && <div className="sub" style={{ marginTop: 8 }}>Con muchos PDFs puede tardar varios minutos. Si una IA llega a su límite, sigo con la siguiente que tengas conectada.</div>}
          </>
        )}

        <div className="two" style={{ marginTop: 20 }}>
          <button className="btn ghost" onClick={onCancel}>Cancelar</button>
          <button className="btn" onClick={ok} disabled={!elegidos.length || (nuevo && !nombre.trim())}>{elegidos.length === 1 ? 'Subir 1 PDF' : `Subir ${elegidos.length} PDFs`}{peso && elegidos.length > 1 ? ` (${tamanoLegible(peso)})` : ''}</button>
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

// Confirmación antes de reiniciar notas: dice cuántas se quitan y qué NO se toca.
function ConfirmarReiniciar({ docs, donde, onCancel, onOk }) {
  const n = evaluados(docs);
  return (
    <div className="sheet" role="alertdialog" aria-modal="true" aria-label="Reiniciar notas" onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div>
        <h2>¿Reiniciar las notas {donde}?</h2>
        <p className="sub" style={{ fontSize: 15, lineHeight: 1.55, margin: '10px 0 18px' }}>Se quitan <b style={{ color: 'var(--ink)' }}>{n} {n === 1 ? 'nota' : 'notas'}</b> de conceptos y vuelven a aparecer como “Explicar”, para empezar de cero. Tus PDFs, conceptos y <b style={{ color: 'var(--ink)' }}>pruebas</b> no se tocan. Después podrás pulsar “Deshacer” unos segundos.</p>
        <div className="two">
          <button className="btn ghost" onClick={onCancel}>Cancelar</button>
          <button className="btn" onClick={onOk}>Reiniciar notas</button>
        </div>
      </div>
    </div>
  );
}
