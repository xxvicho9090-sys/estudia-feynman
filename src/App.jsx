import { useCallback, useEffect, useState } from 'react';
import Home from './screens/Home.jsx';
import Explain from './screens/Explain.jsx';
import Result from './screens/Result.jsx';
import Settings from './screens/Settings.jsx';
import Editor from './screens/Editor.jsx';
import { listarDocs, guardarDoc, borrarDoc, pedirPersistencia } from './lib/db.js';
import { procesarPdf } from './lib/extract.js';
import { nuevoId } from './lib/concepts.js';
import { notaDeIdeas } from './lib/grade.js';

const HOME = { name: 'home' };

export default function App() {
  const [docs, setDocs] = useState([]);
  const [screen, setScreen] = useState(HOME);
  const [editId, setEditId] = useState(null);
  const [progreso, setProgreso] = useState(null);
  const [avisos, setAvisos] = useState([]);
  const [toast, setToast] = useState('');

  useEffect(() => { listarDocs().then(setDocs).catch(() => setToast('No se pudo abrir el almacenamiento del dispositivo.')); pedirPersistencia(); }, []);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(''), 3500); return () => clearTimeout(t); } }, [toast]);

  // El botón "atrás" del teléfono vuelve a la pantalla anterior en vez de cerrar la app.
  useEffect(() => {
    history.replaceState({ screen: HOME }, '');
    const on = (e) => { setEditId(null); setScreen(e.state?.screen || HOME); };
    window.addEventListener('popstate', on);
    return () => window.removeEventListener('popstate', on);
  }, []);
  const ir = useCallback((s) => { history.pushState({ screen: s }, ''); setScreen(s); }, []);
  const volver = useCallback(() => { if (history.state && history.length > 1 && screen.name !== 'home') history.back(); else setScreen(HOME); }, [screen]);

  const docDe = (id) => docs.find((d) => d.id === id);
  const guardar = async (doc) => { await guardarDoc(doc); setDocs((ds) => ds.map((d) => (d.id === doc.id ? doc : d))); };

  const subir = async (files) => {
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      try {
        setProgreso({ archivo: `${f.name} (${i + 1} de ${files.length})`, texto: 'Empezando…', fraccion: 0 });
        const r = await procesarPdf(f, (texto, fraccion) => setProgreso({ archivo: `${f.name} (${i + 1} de ${files.length})`, texto, fraccion }));
        const doc = { id: nuevoId(), nombre: r.nombre, creado: Date.now(), conceptos: r.conceptos };
        await guardarDoc(doc);
        setDocs((ds) => [...ds, doc]);
        if (r.aviso) setAvisos((a) => [...a, { id: doc.id, doc: doc.nombre, texto: r.aviso }]);
      } catch (e) {
        console.warn(e);
        setAvisos((a) => [...a, { id: nuevoId(), doc: f.name, texto: e?.name === 'QuotaExceededError' ? 'No hay espacio en el dispositivo para guardar este PDF.' : 'No pude leer este archivo. ¿Es un PDF válido?' }]);
      }
    }
    setProgreso(null);
  };

  const concepto = (s) => docDe(s.docId)?.conceptos.find((c) => c.id === s.conceptId);
  const indice = (s) => { const d = docDe(s.docId); return d ? `${d.conceptos.findIndex((c) => c.id === s.conceptId) + 1} de ${d.conceptos.length}` : ''; };

  const resultado = async (s, texto, ev) => {
    const nota = notaDeIdeas(ev.ideas);
    const d = docDe(s.docId);
    await guardar({ ...d, conceptos: d.conceptos.map((c) => (c.id === s.conceptId ? { ...c, nota, notaFecha: Date.now() } : c)) });
    history.replaceState({ screen: { name: 'result', docId: s.docId, conceptId: s.conceptId, result: { ...ev, nota } } }, '');
    setScreen({ name: 'result', docId: s.docId, conceptId: s.conceptId, result: { ...ev, nota } });
  };

  const siguiente = (s) => {
    const d = docDe(s.docId);
    const i = d.conceptos.findIndex((c) => c.id === s.conceptId);
    const sig = d.conceptos[i + 1];
    if (!sig) { setScreen(HOME); history.replaceState({ screen: HOME }, ''); return; }
    const ns = { name: 'explain', docId: s.docId, conceptId: sig.id };
    history.replaceState({ screen: ns }, '');
    setScreen(ns);
  };

  const c = screen.docId && concepto(screen);
  let vista;
  if (screen.name === 'settings') vista = <Settings onBack={volver} />;
  else if (screen.name === 'explain' && c) vista = <Explain key={screen.conceptId} doc={docDe(screen.docId)} concepto={c} indice={indice(screen)} onBack={volver} onResult={(t, ev) => resultado(screen, t, ev)} />;
  else if (screen.name === 'result' && c && screen.result) {
    const d = docDe(screen.docId);
    const hayMas = d.conceptos.findIndex((x) => x.id === c.id) < d.conceptos.length - 1;
    vista = <Result concepto={c} resultado={screen.result} hayMas={hayMas} onBack={() => { setScreen(HOME); history.replaceState({ screen: HOME }, ''); }}
      onRetry={() => { const ns = { name: 'explain', docId: screen.docId, conceptId: screen.conceptId }; history.replaceState({ screen: ns }, ''); setScreen(ns); }} onNext={() => siguiente(screen)} />;
  } else vista = (
    <Home docs={docs} avisos={avisos} cerrarAviso={(id) => setAvisos((a) => a.filter((x) => x.id !== id))} progreso={progreso} onFiles={subir}
      onOpenConcept={(docId, conceptId) => ir({ name: 'explain', docId, conceptId })} onEdit={setEditId} onSettings={() => ir({ name: 'settings' })} />
  );

  const editDoc = editId && docDe(editId);
  return (
    <>
      {vista}
      {editDoc && <Editor key={editDoc.id} doc={editDoc} onClose={() => setEditId(null)}
        onSave={async (d) => { await guardar(d); setEditId(null); setToast('Cambios guardados'); }}
        onDeleteDoc={async () => { await borrarDoc(editDoc.id); setDocs((ds) => ds.filter((x) => x.id !== editDoc.id)); setEditId(null); }} />}
      {toast && <div className="toast" role="status">{toast}</div>}
    </>
  );
}
