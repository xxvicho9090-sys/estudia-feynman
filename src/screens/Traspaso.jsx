import { useRef, useState } from 'react';
import { leerTodo, armarCopia, nombreArchivo, entregarArchivo, leerCopia, planImportar, hayAlgoNuevo, aplicarImportacion } from '../lib/copia.js';

const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

// Ajustes → pasar tus ramos, PDFs, notas, pruebas e interrogatorios a otro dispositivo (por ejemplo del computador a la tablet).
export default function Traspaso() {
  const input = useRef(null);
  const [msg, setMsg] = useState(null); // { ok, texto }
  const [plan, setPlan] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  const exportar = async () => {
    setOcupado(true); setMsg(null);
    try {
      const todo = await leerTodo();
      if (!todo.docs.length && !todo.ramos.length) { setMsg({ ok: false, texto: 'Todavía no hay nada que copiar: sube algún PDF primero.' }); return; }
      const r = await entregarArchivo(nombreArchivo(), JSON.stringify(armarCopia(todo)));
      if (r !== 'cancelado') setMsg({ ok: true, texto: `Listo: ${plural(todo.ramos.length, 'ramo', 'ramos')}, ${plural(todo.docs.length, 'PDF', 'PDFs')}, ${plural(todo.pruebas.length, 'prueba', 'pruebas')} y ${plural(todo.orales.length, 'interrogatorio', 'interrogatorios')}. ${r === 'descargado' ? 'Se guardó en tu carpeta de Descargas: pásalo al otro dispositivo (Drive, correo, WhatsApp, cable…) y en él toca “Importar copia”.' : 'Envíalo al otro dispositivo y en él toca “Importar copia”.'}` });
    } catch { setMsg({ ok: false, texto: 'No se pudo crear la copia.' }); } finally { setOcupado(false); }
  };

  const elegido = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setMsg(null); setOcupado(true);
    try {
      const copia = leerCopia(await f.text());
      setPlan(planImportar(await leerTodo(), copia));
    } catch (err) { setMsg({ ok: false, texto: err.message }); } finally { setOcupado(false); }
  };

  const importar = async () => {
    setOcupado(true);
    try {
      await aplicarImportacion(plan);
      setPlan(null);
      setMsg({ ok: true, texto: 'Importado. Cargando tus datos…' });
      setTimeout(() => location.reload(), 900);
    } catch { setMsg({ ok: false, texto: 'No se pudo importar la copia.' }); setOcupado(false); }
  };

  const r = plan?.resumen;
  return (
    <section className="card" style={{ marginTop: 14 }} aria-label="Pasar mis datos a otro dispositivo">
      <div style={{ fontWeight: 800, fontSize: 16 }}>Pasar mis datos a otro dispositivo</div>
      <p className="sub" style={{ lineHeight: 1.5, margin: '6px 0 0' }}>Lleva tus ramos, PDFs (con sus conceptos y notas), pruebas e interrogatorios del computador a la tablet, o al revés. <b style={{ color: 'var(--ink)' }}>1)</b> En el dispositivo que ya los tiene toca “Exportar copia”. <b style={{ color: 'var(--ink)' }}>2)</b> Pasa el archivo al otro. <b style={{ color: 'var(--ink)' }}>3)</b> Allí toca “Importar copia”. Las claves de las IAs no van en el archivo: pégalas de nuevo en el otro dispositivo.</p>
      <div className="two" style={{ marginTop: 12 }}>
        <button className="btn" disabled={ocupado} onClick={exportar}>Exportar copia</button>
        <button className="btn ghost" disabled={ocupado} onClick={() => input.current.click()}>Importar copia</button>
      </div>
      <input ref={input} type="file" accept=".json,application/json" hidden onChange={elegido} />
      {msg && <div className={'notice' + (msg.ok ? ' info' : '')} role={msg.ok ? 'status' : 'alert'}>{msg.texto}</div>}

      {plan && (
        <div className="sheet" role="alertdialog" aria-modal="true" aria-label="Importar copia" onClick={(e) => { if (e.target === e.currentTarget && !ocupado) setPlan(null); }}>
          <div>
            <h2>{hayAlgoNuevo(plan) ? 'Importar esta copia' : 'No hay nada nuevo'}</h2>
            {hayAlgoNuevo(plan)
              ? <p className="sub" style={{ fontSize: 15, lineHeight: 1.6, margin: '8px 0 18px' }}>Se agregarán <b style={{ color: 'var(--ink)' }}>{plural(r.ramos, 'ramo', 'ramos')}, {plural(r.pdfs, 'PDF', 'PDFs')} ({plural(r.conceptos, 'concepto', 'conceptos')}), {plural(r.pruebas, 'prueba', 'pruebas')} y {plural(r.orales, 'interrogatorio', 'interrogatorios')}</b>.{r.yaEstaban ? ` ${plural(r.yaEstaban, 'elemento ya estaba', 'elementos ya estaban')} aquí y se deja${r.yaEstaban === 1 ? '' : 'n'} como está.` : ''} Lo que ya tienes en este dispositivo no se toca.</p>
              : <p className="sub" style={{ fontSize: 15, lineHeight: 1.5, margin: '8px 0 18px' }}>Todo lo de esta copia ya está en este dispositivo.</p>}
            <div className="two">
              <button className="btn ghost" disabled={ocupado} onClick={() => setPlan(null)}>{hayAlgoNuevo(plan) ? 'Cancelar' : 'Cerrar'}</button>
              {hayAlgoNuevo(plan) && <button className="btn" disabled={ocupado} onClick={importar}>{ocupado ? 'Importando…' : 'Importar'}</button>}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
