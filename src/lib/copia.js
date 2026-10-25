import { listarDocs, listarRamos, listarPruebas, listarOrales, guardarDoc, guardarRamo, guardarPrueba, guardarOral } from './db.js';

// Copia de seguridad / traspaso entre dispositivos: un archivo con tus ramos, PDFs (conceptos y notas), pruebas e interrogatorios.
// No incluye las claves de las IAs (son secretas): se vuelven a pegar en Ajustes del otro dispositivo.
const MARCA = 'estudia-con-feynman';
export const VERSION_COPIA = 1;

export const nombreArchivo = (fecha = new Date()) => `feynman-copia-${fecha.toISOString().slice(0, 10)}.json`;

export function armarCopia({ docs, ramos, pruebas, orales }, fecha = new Date()) {
  return { app: MARCA, version: VERSION_COPIA, creada: fecha.toISOString(), docs, ramos, pruebas, orales };
}
export async function leerTodo() {
  const [docs, ramos, pruebas, orales] = await Promise.all([listarDocs(), listarRamos(), listarPruebas(), listarOrales()]);
  return { docs, ramos, pruebas, orales };
}

// Valida el archivo elegido y devuelve la copia; si no es de esta app, un error claro.
export function leerCopia(texto) {
  let o;
  try { o = JSON.parse(texto); } catch { throw new Error('Ese archivo no se puede leer. Elige el archivo “feynman-copia-….json” que exportaste.'); }
  if (o?.app !== MARCA) throw new Error('Ese archivo no es una copia de Estudia con Feynman.');
  if (o.version > VERSION_COPIA) throw new Error('Esta copia viene de una versión más nueva. Actualiza la app y vuelve a intentarlo.');
  const lista = (x) => (Array.isArray(x) ? x.filter((e) => e && typeof e.id === 'string') : []);
  return { ...o, docs: lista(o.docs), ramos: lista(o.ramos), pruebas: lista(o.pruebas), orales: lista(o.orales) };
}

const norm = (t) => String(t ?? '').trim().toLowerCase();

// Qué se agregaría: lo que ya está (mismo id, o mismo ramo con el mismo nombre de PDF) se deja como está en este dispositivo.
export function planImportar(actual, copia) {
  const idsRamo = new Set(actual.ramos.map((r) => r.id));
  const mapaRamo = new Map(); // id del ramo en la copia → id del ramo que usará aquí
  const ramosNuevos = [];
  for (const r of copia.ramos) {
    if (idsRamo.has(r.id)) { mapaRamo.set(r.id, r.id); continue; }
    const igual = actual.ramos.find((x) => norm(x.nombre) === norm(r.nombre));
    if (igual) mapaRamo.set(r.id, igual.id); else { mapaRamo.set(r.id, r.id); ramosNuevos.push(r); }
  }
  const idsDoc = new Set(actual.docs.map((d) => d.id));
  const mapaDoc = new Map();
  const docsNuevos = [];
  let docsYaEstaban = 0;
  for (const d of copia.docs) {
    const ramoId = mapaRamo.get(d.ramoId) ?? d.ramoId;
    const existente = actual.docs.find((x) => x.id === d.id || (x.ramoId === ramoId && norm(x.nombre) === norm(d.nombre)));
    if (existente) { mapaDoc.set(d.id, existente.id); docsYaEstaban += 1; continue; }
    mapaDoc.set(d.id, d.id);
    idsDoc.add(d.id);
    docsNuevos.push(ramoId === d.ramoId ? d : { ...d, ramoId });
  }
  // Pruebas e interrogatorios recuerdan de qué ramo o PDF salieron («r:id» / «d:id»): se apuntan a los de este dispositivo.
  const remapOrigen = (o) => {
    const c = o?.origen?.clave;
    if (typeof c !== 'string') return o;
    const nueva = c.startsWith('r:') ? 'r:' + (mapaRamo.get(c.slice(2)) ?? c.slice(2)) : c.startsWith('d:') ? 'd:' + (mapaDoc.get(c.slice(2)) ?? c.slice(2)) : c;
    return nueva === c ? o : { ...o, origen: { ...o.origen, clave: nueva } };
  };
  const nuevos = (lista, existentes) => { const ids = new Set(existentes.map((x) => x.id)); return lista.filter((x) => !ids.has(x.id)).map(remapOrigen); };
  const pruebasNuevas = nuevos(copia.pruebas, actual.pruebas);
  const oralesNuevos = nuevos(copia.orales, actual.orales);
  return {
    ramos: ramosNuevos, docs: docsNuevos, pruebas: pruebasNuevas, orales: oralesNuevos,
    resumen: {
      ramos: ramosNuevos.length, pdfs: docsNuevos.length, conceptos: docsNuevos.reduce((n, d) => n + (d.conceptos?.length || 0), 0),
      pruebas: pruebasNuevas.length, orales: oralesNuevos.length, yaEstaban: docsYaEstaban + (copia.pruebas.length - pruebasNuevas.length) + (copia.orales.length - oralesNuevos.length),
    },
  };
}

export const hayAlgoNuevo = (plan) => plan.ramos.length + plan.docs.length + plan.pruebas.length + plan.orales.length > 0;

export async function aplicarImportacion(plan) {
  for (const r of plan.ramos) await guardarRamo(r);
  for (const d of plan.docs) await guardarDoc(d);
  for (const p of plan.pruebas) await guardarPrueba(p);
  for (const o of plan.orales) await guardarOral(o);
}

// Entrega el archivo: en el celular o tablet abre "Compartir" (para mandarlo por Drive, WhatsApp, correo…); en el computador lo descarga.
export async function entregarArchivo(nombre, texto) {
  const archivo = new File([texto], nombre, { type: 'application/json' });
  try {
    if (navigator.canShare?.({ files: [archivo] })) { await navigator.share({ files: [archivo], title: nombre }); return 'compartido'; }
  } catch (e) { if (e?.name === 'AbortError') return 'cancelado'; }
  const url = URL.createObjectURL(archivo);
  const a = document.createElement('a');
  a.href = url; a.download = nombre;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return 'descargado';
}
