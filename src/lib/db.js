// Almacenamiento local (IndexedDB). Ramos y documentos; cada documento guarda sus conceptos y la última nota de cada uno.
const DB = 'feynman2';
let dbp;
const open = () => (dbp ||= new Promise((res, rej) => {
  const r = indexedDB.open(DB, 2);
  r.onupgradeneeded = () => {
    const db = r.result;
    if (!db.objectStoreNames.contains('docs')) db.createObjectStore('docs', { keyPath: 'id' });
    if (!db.objectStoreNames.contains('ramos')) db.createObjectStore('ramos', { keyPath: 'id' });
  };
  r.onsuccess = () => res(r.result);
  r.onerror = () => rej(r.error);
}));
const tx = async (store, mode, fn) => {
  const db = await open();
  return new Promise((res, rej) => {
    const t = db.transaction(store, mode);
    const out = fn(t.objectStore(store));
    t.oncomplete = () => res(out?.result);
    t.onerror = () => rej(t.error);
    t.onabort = () => rej(t.error);
  });
};
const sortCreado = (a, b) => a.creado - b.creado;

export const listarDocs = async () => (await tx('docs', 'readonly', (s) => s.getAll())).sort(sortCreado);
export const guardarDoc = (doc) => tx('docs', 'readwrite', (s) => s.put(doc));
export const borrarDoc = (id) => tx('docs', 'readwrite', (s) => s.delete(id));
export const listarRamos = async () => (await tx('ramos', 'readonly', (s) => s.getAll())).sort(sortCreado);
export const guardarRamo = (r) => tx('ramos', 'readwrite', (s) => s.put(r));
export const borrarRamo = (id) => tx('ramos', 'readwrite', (s) => s.delete(id));

export async function pedirPersistencia() {
  try { if (navigator.storage?.persist && !(await navigator.storage.persisted())) await navigator.storage.persist(); } catch { /* opcional */ }
}
