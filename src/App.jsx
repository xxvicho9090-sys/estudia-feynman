import { useCallback, useEffect, useRef, useState } from 'react';
import Home from './screens/Home.jsx';
import Explain from './screens/Explain.jsx';
import Result from './screens/Result.jsx';
import Settings from './screens/Settings.jsx';
import Editor from './screens/Editor.jsx';
import RamoSheet from './screens/RamoSheet.jsx';
import Rendir from './screens/Rendir.jsx';
import ResultadoPrueba from './screens/ResultadoPrueba.jsx';
import { listarDocs, guardarDoc, borrarDoc, listarRamos, guardarRamo, borrarRamo, listarPruebas, guardarPrueba, borrarPrueba, pedirPersistencia } from './lib/db.js';
import { crearPrueba, corregirPrueba } from './lib/pruebas.js';
import { detectarOllama } from './lib/ai.js';
import { iniciarAutoLocal } from './lib/autolocal.js';
import { useLocal } from './lib/local.js';
import { useActualizacion, aplicarActualizacion } from './actualizar.js';
import { procesarPdf } from './lib/extract.js';
import { nuevoId } from './lib/concepts.js';
import { nuevoRamo } from './lib/ramos.js';
import { notaDeIdeas } from './lib/grade.js';

const HOME = { name: 'home' };

export default function App() {
  const [docs, setDocs] = useState([]);
  const [ramos, setRamos] = useState([]);
  const [sel, setSel] = useState({});
  const [screen, setScreen] = useState(HOME);
  const [editId, setEditId] = useState(null);
  const [ramoSheet, setRamoSheet] = useState(undefined); // undefined = cerrado, null = nuevo, string = id a editar
  const [progreso, setProgreso] = useState(null);
  const [avisos, setAvisos] = useState([]);
  const [toast, setToast] = useState('');
  const [, redibujar] = useState(0);
  const [tab, setTab] = useState('estudiar');
  const [pruebas, setPruebas] = useState([]);
  const [errorPrueba, setErrorPrueba] = useState('');
  const [trabajando, setTrabajando] = useState(null); // { titulo, texto, fraccion } al crear o corregir una prueba
  const [errorCorreccion, setErrorCorreccion] = useState('');
  const abortPrueba = useRef(null);
  const guardado = useRef({});
  const pruebasRef = useRef([]);
  const act = useActualizacion();
  const local = useLocal();
  const faseAntes = useRef(local.fase);
  const [aplicando, setAplicando] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        let ds = await listarDocs();
        let rs = await listarRamos();
        // Documentos de versiones anteriores sin ramo: se agrupan en "Sin ramo".
        const huerfanos = ds.filter((d) => !d.ramoId || !rs.some((r) => r.id === d.ramoId));
        if (huerfanos.length) {
          let base = rs.find((r) => r.nombre === 'Sin ramo');
          if (!base) { base = nuevoRamo('Sin ramo', rs); await guardarRamo(base); rs = [...rs, base]; }
          ds = await Promise.all(ds.map(async (d) => (huerfanos.includes(d) ? (async () => { const n = { ...d, ramoId: base.id }; await guardarDoc(n); return n; })() : d)));
        }
        setDocs(ds); setRamos(rs);
        const ps = await listarPruebas(); pruebasRef.current = ps; setPruebas(ps);
      } catch { setToast('No se pudo abrir el almacenamiento del dispositivo.'); }
    })();
    pedirPersistencia();
  }, []);
  // Ollama se detecta solo al abrir la app y cada vez que vuelves a ella.
  useEffect(() => {
    const buscar = () => detectarOllama().then(() => redibujar((x) => x + 1));
    buscar();
    const on = () => { if (document.visibilityState === 'visible') buscar(); };
    document.addEventListener('visibilitychange', on);
    return () => document.removeEventListener('visibilitychange', on);
  }, []);
  // La IA offline se prepara sola al abrir la app (reglas en autolocal.js) y avisa cuando está lista.
  useEffect(() => { iniciarAutoLocal(); }, []);
  useEffect(() => { if (faseAntes.current === 'bajando' && local.fase === 'listo') setToast('La IA offline ya está lista: funciona sin internet'); faseAntes.current = local.fase; }, [local.fase]);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(''), 3500); return () => clearTimeout(t); } }, [toast]);

  // El botón "atrás" del teléfono vuelve a la pantalla anterior en vez de cerrar la app.
  useEffect(() => {
    history.replaceState({ screen: HOME }, '');
    const on = (e) => { setEditId(null); setScreen(e.state?.screen || HOME); };
    window.addEventListener('popstate', on);
    return () => window.removeEventListener('popstate', on);
  }, []);
  const ir = useCallback((s) => { history.pushState({ screen: s }, ''); setScreen(s); }, []);
  const reemplazar = (s) => { history.replaceState({ screen: s }, ''); setScreen(s); };
  const volver = useCallback(() => { if (screen.name !== 'home' && history.length > 1) history.back(); else setScreen(HOME); }, [screen]);

  const docDe = (id) => docs.find((d) => d.id === id);
  const guardar = async (doc) => { await guardarDoc(doc); setDocs((ds) => ds.map((d) => (d.id === doc.id ? doc : d))); };

  const subir = async (files, destino) => {
    let ramoId = destino.ramoId;
    if (destino.nuevo) {
      const r = nuevoRamo(destino.nuevo, ramos);
      await guardarRamo(r); setRamos((rs) => [...rs, r]); ramoId = r.id;
    }
    let ultimo = null;
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const etiqueta = `${f.name} (${i + 1} de ${files.length})`;
      try {
        setProgreso({ archivo: etiqueta, texto: 'Empezando…', fraccion: 0 });
        const r = await procesarPdf(f, (texto, fraccion) => setProgreso({ archivo: etiqueta, texto, fraccion }));
        const doc = { id: nuevoId(), ramoId, nombre: r.nombre, creado: Date.now(), conceptos: r.conceptos };
        await guardarDoc(doc);
        setDocs((ds) => [...ds, doc]);
        ultimo = doc;
        if (r.aviso) setAvisos((a) => [...a, { id: doc.id, doc: doc.nombre, texto: r.aviso }]);
      } catch (e) {
        console.warn(e);
        setAvisos((a) => [...a, { id: nuevoId(), doc: f.name, texto: e?.name === 'QuotaExceededError' ? 'No hay espacio en el dispositivo para guardar este PDF.' : 'No pude leer este archivo. ¿Es un PDF válido?' }]);
      }
    }
    setProgreso(null);
    if (ultimo) setSel({ ramoId, docId: files.length === 1 ? ultimo.id : undefined });
  };

  const guardarRamoNuevoOEditado = async (nombre) => {
    if (ramoSheet === null) {
      const r = nuevoRamo(nombre, ramos);
      await guardarRamo(r); setRamos((rs) => [...rs, r]); setSel({ ramoId: r.id });
    } else {
      const r = { ...ramos.find((x) => x.id === ramoSheet), nombre };
      await guardarRamo(r); setRamos((rs) => rs.map((x) => (x.id === r.id ? r : x)));
    }
    setRamoSheet(undefined);
  };
  const borrarRamoYDocs = async () => {
    const id = ramoSheet;
    for (const d of docs.filter((x) => x.ramoId === id)) await borrarDoc(d.id);
    await borrarRamo(id);
    setDocs((ds) => ds.filter((d) => d.ramoId !== id)); setRamos((rs) => rs.filter((r) => r.id !== id));
    setSel({}); setRamoSheet(undefined);
  };

  // ---- Pruebas ----
  const pruebaDe = (id) => pruebas.find((p) => p.id === id);
  // Guarda cambios de la prueba al instante en pantalla y en disco (con un pequeño retardo mientras se escribe).
  // fn recibe la versión MÁS reciente de la prueba (así dos cambios seguidos no se pisan).
  const actualizarPrueba = (id, fn) => {
    const actual = pruebasRef.current.find((x) => x.id === id);
    if (!actual) return;
    const p = fn(actual);
    pruebasRef.current = pruebasRef.current.map((x) => (x.id === id ? p : x));
    setPruebas(pruebasRef.current);
    clearTimeout(guardado.current[id]);
    guardado.current[id] = setTimeout(() => guardarPrueba(p).catch(() => setToast('No se pudo guardar tu avance.')), 350);
  };
  const crearNuevaPrueba = async (cfg) => {
    setErrorPrueba('');
    abortPrueba.current = new AbortController();
    setTrabajando({ titulo: 'Creando tu prueba', texto: 'Preparando…', fraccion: 0 });
    try {
      const p = await crearPrueba(cfg, (texto, fraccion) => setTrabajando({ titulo: 'Creando tu prueba', texto, fraccion }), abortPrueba.current.signal);
      await guardarPrueba(p);
      pruebasRef.current = [p, ...pruebasRef.current]; setPruebas(pruebasRef.current);
      setTrabajando(null);
      if (p.aviso) setToast(p.aviso);
      ir({ name: 'rendir', pruebaId: p.id });
    } catch (e) {
      setTrabajando(null);
      if (e?.name !== 'AbortError') setErrorPrueba(e?.message || 'No se pudo crear la prueba.');
    }
  };
  const corregir = async (prueba) => {
    setErrorCorreccion('');
    abortPrueba.current = new AbortController();
    setTrabajando({ titulo: 'Corrigiendo tu prueba', texto: 'Revisando tus respuestas…', fraccion: 0 });
    try {
      const { prueba: nueva, error } = await corregirPrueba(prueba, (texto, fraccion) => setTrabajando({ titulo: 'Corrigiendo tu prueba', texto, fraccion }));
      await guardarPrueba(nueva);
      pruebasRef.current = pruebasRef.current.map((x) => (x.id === nueva.id ? nueva : x)); setPruebas(pruebasRef.current);
      setErrorCorreccion(error);
      reemplazar({ name: 'prueba-result', pruebaId: nueva.id });
    } finally { setTrabajando(null); }
  };
  const abrirPrueba = (p) => ir(p.estado === 'en curso' ? { name: 'rendir', pruebaId: p.id } : { name: 'prueba-result', pruebaId: p.id });
  const rendirDeNuevo = async (p) => {
    const copia = { ...p, id: nuevoId(), creado: Date.now(), respuestas: {}, evaluaciones: {}, estado: 'en curso', resultado: null, entregada: undefined, pagina: 0, aviso: '' };
    await guardarPrueba(copia); pruebasRef.current = [copia, ...pruebasRef.current]; setPruebas(pruebasRef.current);
    reemplazar({ name: 'rendir', pruebaId: copia.id });
  };
  const volverAPruebas = () => { setTab('pruebas'); reemplazar(HOME); };

  const concepto = (s) => docDe(s.docId)?.conceptos.find((c) => c.id === s.conceptId);
  const indice = (s) => { const d = docDe(s.docId); return d ? `${d.conceptos.findIndex((c) => c.id === s.conceptId) + 1} de ${d.conceptos.length}` : ''; };

  const resultado = async (s, ev) => {
    const nota = notaDeIdeas(ev.ideas);
    const d = docDe(s.docId);
    await guardar({ ...d, conceptos: d.conceptos.map((c) => (c.id === s.conceptId ? { ...c, nota, notaFecha: Date.now() } : c)) });
    reemplazar({ name: 'result', docId: s.docId, conceptId: s.conceptId, result: { ...ev, nota } });
  };
  const siguiente = (s) => {
    const d = docDe(s.docId);
    const sig = d.conceptos[d.conceptos.findIndex((c) => c.id === s.conceptId) + 1];
    reemplazar(sig ? { name: 'explain', docId: s.docId, conceptId: sig.id } : HOME);
  };

  const c = screen.docId && concepto(screen);
  let vista;
  if (screen.name === 'settings') vista = <Settings onBack={volver} />;
  else if (screen.name === 'rendir' && pruebaDe(screen.pruebaId)) vista = <Rendir key={screen.pruebaId} prueba={pruebaDe(screen.pruebaId)} onChange={actualizarPrueba} onBack={volverAPruebas} onEntregar={() => corregir({ ...pruebaDe(screen.pruebaId), entregada: Date.now() })} />;
  else if (screen.name === 'prueba-result' && pruebaDe(screen.pruebaId)) vista = <ResultadoPrueba key={screen.pruebaId} prueba={pruebaDe(screen.pruebaId)} corrigiendo={!!trabajando} error={errorCorreccion} onCorregir={() => corregir(pruebaDe(screen.pruebaId))} onVolver={volverAPruebas} onRepetir={() => rendirDeNuevo(pruebaDe(screen.pruebaId))} />;
  else if (screen.name === 'explain' && c) vista = <Explain key={screen.conceptId} doc={docDe(screen.docId)} concepto={c} indice={indice(screen)} onBack={volver} onResult={(t, ev) => resultado(screen, ev)} onGo={(id) => reemplazar({ name: 'explain', docId: screen.docId, conceptId: id })} />;
  else if (screen.name === 'result' && c && screen.result) {
    const d = docDe(screen.docId);
    const hayMas = d.conceptos.findIndex((x) => x.id === c.id) < d.conceptos.length - 1;
    vista = <Result concepto={c} resultado={screen.result} hayMas={hayMas} onBack={() => reemplazar(HOME)}
      onRetry={() => reemplazar({ name: 'explain', docId: screen.docId, conceptId: screen.conceptId })} onNext={() => siguiente(screen)} />;
  } else vista = (
    <Home ramos={ramos} docs={docs} sel={sel} setSel={setSel} avisos={avisos} cerrarAviso={(id) => setAvisos((a) => a.filter((x) => x.id !== id))} progreso={progreso} onFiles={subir}
      onOpenConcept={(docId, conceptId) => ir({ name: 'explain', docId, conceptId })} onEditDoc={setEditId} onNewRamo={() => setRamoSheet(null)} onEditRamo={setRamoSheet} onSettings={() => ir({ name: 'settings' })}
      tab={tab} setTab={setTab} pruebas={pruebas} errorPrueba={errorPrueba} onCrearPrueba={crearNuevaPrueba} onAbrirPrueba={abrirPrueba}
      onBorrarPrueba={async (id) => { await borrarPrueba(id); pruebasRef.current = pruebasRef.current.filter((p) => p.id !== id); setPruebas(pruebasRef.current); }} />
  );

  const editDoc = editId && docDe(editId);
  return (
    <>
      {vista}
      {editDoc && <Editor key={editDoc.id} doc={editDoc} ramos={ramos} onClose={() => setEditId(null)}
        onSave={async (d) => { await guardar(d); setEditId(null); setSel((s) => (s.docId === d.id ? { ramoId: d.ramoId, docId: d.id } : s)); setToast('Cambios guardados'); }}
        onDeleteDoc={async () => { await borrarDoc(editDoc.id); setDocs((ds) => ds.filter((x) => x.id !== editDoc.id)); setEditId(null); setSel({ ramoId: editDoc.ramoId }); }} />}
      {ramoSheet !== undefined && <RamoSheet key={String(ramoSheet)} ramo={ramoSheet ? ramos.find((r) => r.id === ramoSheet) : null} nDocs={docs.filter((d) => d.ramoId === ramoSheet).length}
        onClose={() => setRamoSheet(undefined)} onSave={guardarRamoNuevoOEditado} onDelete={borrarRamoYDocs} />}
      {trabajando && (
        <div className="sheet" role="alertdialog" aria-label={trabajando.titulo}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><div className="spin" /><b style={{ fontSize: 18 }}>{trabajando.titulo}</b></div>
            <div className="sub" style={{ marginTop: 10 }}>{trabajando.texto}</div>
            <div className="prog" style={{ marginTop: 14, height: 8 }}><i style={{ width: `${Math.round(trabajando.fraccion * 100)}%` }} /></div>
            {trabajando.titulo.startsWith('Creando') && <button className="linkbtn" style={{ marginTop: 16 }} onClick={() => abortPrueba.current?.abort()}>Cancelar</button>}
          </div>
        </div>
      )}
      {act.estado === 'lista' && (
        <div className="actualizar" role="status">
          <span>Hay una versión nueva{act.version ? ` (${act.version})` : ''}</span>
          <button className="btn" disabled={aplicando} onClick={() => { setAplicando(true); aplicarActualizacion(); }}>{aplicando ? 'Actualizando…' : 'Actualizar'}</button>
        </div>
      )}
      {toast && act.estado !== 'lista' && <div className="toast" role="status">{toast}</div>}
    </>
  );
}
