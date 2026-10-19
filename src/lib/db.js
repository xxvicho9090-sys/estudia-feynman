// Almacenamiento local (IndexedDB). Cada documento guarda sus conceptos y la última nota de cada uno.
const DB = 'feynman2';
const STORE = 'docs';
let dbp;
const open = () => (dbp ||= new Promise((res, rej) => {
  const r = indexedDB.open(DB, 1);
  r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'id' });
  r.onsuccess = () => res(r.result);
  r.onerror = () => rej(r.error);
}));
const tx = async (mode, fn) => {
  const db = await open();
  return new Promise((res, rej) => {
    const t = db.transaction(STORE, mode);
    const out = fn(t.objectStore(STORE));
    t.oncomplete = () => res(out?.result);
    t.onerror = () => rej(t.error);
    t.onabort = () => rej(t.error);
  });
};

export const listarDocs = async () => (await tx('readonly', (s) => s.getAll())).sort((a, b) => a.creado - b.creado);
export const guardarDoc = (doc) => tx('readwrite', (s) => s.put(doc));
export const borrarDoc = (id) => tx('readwrite', (s) => s.delete(id));

export async function pedirPersistencia() {
  try { if (navigator.storage?.persist && !(await navigator.storage.persisted())) await navigator.storage.persist(); } catch { /* opcional */ }
}
