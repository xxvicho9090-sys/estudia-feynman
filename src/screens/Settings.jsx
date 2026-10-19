import { useEffect, useState } from 'react';
import { Back, Check } from '../icons.jsx';
import { SeccionInstalar } from './Instalar.jsx';
import { PROVEEDORES, configurado, getClave, setClave, getOllama, setOllama, estadoOllama, detectarOllama, probar, ultimoUsado, proveedor, getLocalesPrimero, setLocalesPrimero } from '../lib/ai.js';
import { useActualizacion, buscarActualizacion, aplicarActualizacion } from '../actualizar.js';
import { useLocal, descargarLocal, detenerDescarga, borrarLocal, soporte, TAMANO } from '../lib/local.js';
import { getAutoLocal, setAutoLocal, setRechazoLocal } from '../lib/autolocal.js';

const Cabecera = ({ p, conectada, texto }) => (
  <summary>
    <span className="ia-n">{p.nombre}</span>
    <span className="ia-rol">{p.rol}</span>
    <span className={'ia-est' + (conectada ? ' on' : '')}>{texto || (conectada ? '✓ Conectada' : 'Sin conectar')}</span>
  </summary>
);
const Estado = ({ estado }) => (
  <>
    {estado?.ok && <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, fontSize: 14, color: 'var(--ok)' }}><Check /> Funciona{estado.modelo ? ` (modelo ${estado.modelo})` : ''}</div>}
    {estado?.error && <div className="notice" role="alert">{estado.error}</div>}
  </>
);

// IAs en la nube: una clave y "Guardar y probar".
function TarjetaNube({ p, abierta, onCambio }) {
  const [clave, setCl] = useState(getClave(p.id));
  const [estado, setEstado] = useState(null);
  const [open, setOpen] = useState(abierta); // la tarjeta no se cierra sola al conectar
  const conectada = configurado(p);
  const guardar = async () => {
    setClave(p.id, clave); onCambio();
    if (!configurado(p)) { setEstado(null); return; }
    setEstado('probando');
    try { setEstado({ ok: true, modelo: await probar(p.id) }); } catch (e) { setEstado({ error: e.message || 'No se pudo probar.' }); }
  };
  return (
    <details className="ia" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <Cabecera p={p} conectada={conectada} />
      <div className="ia-body">
        <p className="sub" style={{ lineHeight: 1.5, margin: 0 }}>{p.desc}</p>
        <p className="sub" style={{ lineHeight: 1.5, margin: '8px 0 0', color: 'var(--ink)' }}><b>Cómo conseguirla:</b> entra a <a href={`https://${p.url}`} target="_blank" rel="noopener noreferrer">{p.url}</a>. {p.pasos}</p>
        <label className="l" htmlFor={`k-${p.id}`} style={{ marginTop: 14 }}>Clave de {p.nombre}</label>
        <input id={`k-${p.id}`} className="txt" type="password" autoComplete="off" autoCapitalize="off" spellCheck="false" value={clave} onChange={(e) => { setCl(e.target.value); setEstado(null); }} placeholder={p.prefijo ? `${p.prefijo}…` : 'Pega tu clave'} />
        <button className="btn block" style={{ marginTop: 12 }} onClick={guardar} disabled={estado === 'probando'}>{estado === 'probando' ? 'Probando…' : 'Guardar y probar'}</button>
        <Estado estado={estado} />
        {conectada && <button className="linkbtn" style={{ marginTop: 12, color: 'var(--bad)' }} onClick={() => { setClave(p.id, ''); setCl(''); setEstado(null); onCambio(); }}>Quitar esta IA</button>}
      </div>
    </details>
  );
}

// Ollama: se detecta sola; aquí solo se ve el estado y se puede apagar o ajustar.
function TarjetaOllama({ p, onCambio }) {
  const [cfg, setCfg] = useState(getOllama());
  const [est, setEst] = useState(estadoOllama());
  const [buscando, setBuscando] = useState(false);
  const [estado, setEstado] = useState(null);
  const buscar = async () => { setBuscando(true); await detectarOllama(true); setEst({ ...estadoOllama() }); setBuscando(false); onCambio(); };
  useEffect(() => { buscar(); /* eslint-disable-next-line */ }, []);
  const probarlo = async () => { setEstado('probando'); try { setEstado({ ok: true, modelo: await probar('ollama') }); } catch (e) { setEstado({ error: e.message }); } };
  const aplicar = (c) => { setCfg(c); setOllama({ url: c.url, modelo: c.modelo, apagada: c.apagada }); buscar(); };
  return (
    <details className="ia">
      <Cabecera p={p} conectada={est.ok} texto={buscando ? 'Buscando…' : est.ok ? '✓ Detectada' : cfg.apagada ? 'Apagada' : 'No detectada'} />
      <div className="ia-body">
        <p className="sub" style={{ lineHeight: 1.5, margin: 0 }}>{p.desc}</p>
        {est.ok
          ? <div role="status" style={{ marginTop: 12, color: 'var(--ok)', fontWeight: 700, fontSize: 14 }}>✓ Detecté Ollama con el modelo {est.modelo}. Se usa sola cuando lo necesites.</div>
          : <div className="sub" style={{ marginTop: 12, lineHeight: 1.6, color: 'var(--ink)' }}>
            No lo encuentro ahora mismo. {cfg.apagada ? 'Está apagada abajo.' : 'Ábrelo (o instálalo desde ollama.com y ejecuta “ollama pull qwen2.5:7b”).'}<br />
            <b>Si estás en la web</b> y Ollama está abierto, permite este sitio: define la variable de usuario <code>OLLAMA_ORIGINS</code> con <code>{location.origin}</code> y reinicia Ollama. Si Chrome pregunta si este sitio puede “acceder a dispositivos de la red local”, acepta.
          </div>}
        <label className="check"><input type="checkbox" checked={!cfg.apagada} onChange={(e) => aplicar({ ...cfg, apagada: !e.target.checked })} /> Usar Ollama automáticamente</label>
        <div className="two" style={{ marginTop: 12 }}>
          <button className="btn ghost" onClick={buscar} disabled={buscando}>{buscando ? 'Buscando…' : 'Buscar de nuevo'}</button>
          <button className="btn" onClick={probarlo} disabled={!est.ok || estado === 'probando'}>{estado === 'probando' ? 'Probando…' : 'Probar'}</button>
        </div>
        <Estado estado={estado} />
        <details style={{ marginTop: 14 }}>
          <summary className="sub" style={{ cursor: 'pointer', fontWeight: 700 }}>Avanzado</summary>
          <label className="l" htmlFor="ol-url" style={{ marginTop: 10 }}>Dirección</label>
          <input id="ol-url" className="txt" value={cfg.url} onChange={(e) => setCfg({ ...cfg, url: e.target.value })} onBlur={() => aplicar(cfg)} placeholder="http://localhost:11434" />
          <div className="sub" style={{ marginTop: 6 }}>Desde el celular usa la IP de tu laptop (ej. http://192.168.1.20:11434) y arranca Ollama con OLLAMA_HOST=0.0.0.0.</div>
          <label className="l" htmlFor="ol-mod" style={{ marginTop: 10 }}>Modelo (vacío = elegir automáticamente)</label>
          <input id="ol-mod" className="txt" value={cfg.modelo} onChange={(e) => setCfg({ ...cfg, modelo: e.target.value })} onBlur={() => aplicar(cfg)} placeholder="automático" autoCapitalize="off" spellCheck="false" list="ol-lista" />
          <datalist id="ol-lista">{est.modelos.map((m) => <option key={m} value={m} />)}</datalist>
        </details>
      </div>
    </details>
  );
}

// IA que corre dentro de la app: se descarga sola la primera vez (o a mano) y queda en el dispositivo.
function TarjetaLocal({ p, onCambio }) {
  const [sop, setSop] = useState(null);
  const l = useLocal();
  const [estado, setEstado] = useState(null);
  const [auto, setAuto] = useState(getAutoLocal());
  useEffect(() => { soporte().then(setSop); }, []);
  useEffect(() => { onCambio(); /* eslint-disable-next-line */ }, [l.fase]);
  const pct = Math.round((l.f || 0) * 100);
  const probarla = async () => { setEstado('probando'); try { setEstado({ ok: true, modelo: await probar('local') }); } catch (e) { setEstado({ error: e.message }); } };
  const listo = l.fase === 'listo';
  return (
    <details className="ia">
      <Cabecera p={p} conectada={listo} texto={l.fase === 'bajando' ? `Descargando ${pct} %` : listo ? '✓ Lista' : sop && !sop.ok ? 'No disponible' : 'Sin descargar'} />
      <div className="ia-body">
        <p className="sub" style={{ lineHeight: 1.5, margin: 0 }}>{p.desc} <b style={{ color: 'var(--ink)' }}>Viene incluida: la app la descarga sola la primera vez (con Wi-Fi), para que cualquiera que reciba la app no tenga que instalar nada.</b></p>
        {sop && !sop.ok && <div className="notice">{sop.motivo}</div>}
        {sop?.ok && sop.aviso && <div className="notice info">{sop.aviso}</div>}
        {!listo && l.fase !== 'bajando' && sop?.ok && <>
          <p className="sub" style={{ lineHeight: 1.5, margin: '12px 0 0', color: 'var(--ink)' }}>Descarga única de {TAMANO}. Después funciona sin internet y sin límites, aunque es más lenta y menos precisa que las IAs de la nube.</p>
          <button className="btn block" style={{ marginTop: 12 }} onClick={() => descargarLocal()}>{l.fase === 'pausada' ? 'Reanudar la descarga' : `Descargar la IA (${TAMANO})`}</button>
        </>}
        {l.fase === 'bajando' && <div role="status" style={{ marginTop: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><div className="spin" /><b style={{ fontSize: 14 }}>Descargando… {pct} %</b></div>
          <div className="prog" style={{ marginTop: 10, height: 8 }}><i style={{ width: `${pct}%` }} /></div>
          <div className="sub" style={{ marginTop: 8 }}>{l.texto}</div>
          <button className="linkbtn" style={{ marginTop: 8 }} onClick={detenerDescarga}>Detener</button>
        </div>}
        {l.fase === 'error' && <div className="notice" role="alert">{l.error}</div>}
        {listo && <div className="two" style={{ marginTop: 14 }}>
          <button className="btn" onClick={probarla} disabled={estado === 'probando'}>{estado === 'probando' ? 'Probando…' : 'Probar'}</button>
          <button className="btn ghost" onClick={async () => { await borrarLocal(); setEstado(null); }}>Borrar del dispositivo</button>
        </div>}
        <Estado estado={estado} />
        <label className="check"><input type="checkbox" checked={auto} onChange={(e) => { setAuto(e.target.checked); setAutoLocal(e.target.checked); if (e.target.checked) setRechazoLocal(false); }} /> Descargarla automáticamente al abrir la app (solo con Wi-Fi)</label>
      </div>
    </details>
  );
}

function SeccionActualizar() {
  const a = useActualizacion();
  const [aplicando, setAplicando] = useState(false);
  const texto = { idle: 'Aún no he buscado.', buscando: 'Buscando…', descargando: `Descargando la versión ${a.version}…`, lista: `La versión ${a.version} está lista.`, alDia: 'Estás al día ✓', error: a.detalle }[a.estado];
  return (
    <section className="card" style={{ marginTop: 14 }} aria-label="Actualizaciones">
      <div style={{ fontWeight: 800, fontSize: 16 }}>Actualizaciones</div>
      <div className="sub" style={{ marginTop: 6 }}>Versión instalada: <b style={{ color: 'var(--ink)' }}>{__APP_VERSION__}</b> · <span role="status" style={{ color: a.estado === 'lista' ? 'var(--acc-d)' : a.estado === 'error' ? 'var(--bad)' : undefined, fontWeight: 600 }}>{texto}</span></div>
      {a.estado === 'lista' && a.notas && <div className="sub" style={{ marginTop: 6 }}>{a.notas}</div>}
      {a.estado === 'lista'
        ? <button className="btn block" style={{ marginTop: 12 }} disabled={aplicando} onClick={() => { setAplicando(true); aplicarActualizacion(); }}>{aplicando ? 'Actualizando…' : 'Actualizar ahora'}</button>
        : <button className="btn ghost block" style={{ marginTop: 12 }} disabled={a.estado === 'buscando' || a.estado === 'descargando'} onClick={buscarActualizacion}>{a.estado === 'buscando' ? 'Buscando…' : a.estado === 'descargando' ? 'Descargando…' : 'Buscar actualizaciones'}</button>}
    </section>
  );
}

export default function Settings({ onBack }) {
  const [, forzar] = useState(0);
  const cambio = () => forzar((x) => x + 1);
  const n = PROVEEDORES.filter(configurado).length;
  const usada = ultimoUsado();
  return (
    <div className="page">
      <div className="bar">
        <button className="ibtn" aria-label="Volver" onClick={onBack}><Back /></button>
        <div className="crumb">Ajustes</div>
      </div>
      <h1 style={{ marginTop: 24, fontSize: 32 }}>Las IAs que<br />te ayudan</h1>
      <p style={{ margin: '12px 0 0', fontSize: 15, lineHeight: 1.55, color: 'var(--mut)' }}>Conecta una o varias, todas gratis. <b style={{ color: 'var(--ink)' }}>Si una llega a su límite o no hay internet, uso la siguiente automáticamente</b>, así nunca te quedas sin poder estudiar. Las claves quedan solo en este dispositivo.</p>
      <div className="sub" style={{ marginTop: 10 }}>{n ? `${n} ${n === 1 ? 'IA disponible' : 'IAs disponibles'}${usada ? ` · última usada: ${proveedor(usada).nombre}` : ''}.` : 'Todavía no hay ninguna disponible.'}</div>

      <div className="ias">
        {PROVEEDORES.map((p, i) => p.id === 'ollama' ? <TarjetaOllama key={p.id} p={p} onCambio={cambio} />
          : p.id === 'local' ? <TarjetaLocal key={p.id} p={p} onCambio={cambio} />
            : <TarjetaNube key={p.id} p={p} abierta={i < 2 && !configurado(p)} onCambio={cambio} />)}
      </div>
      <label className="check" style={{ marginTop: 16 }}><input type="checkbox" defaultChecked={getLocalesPrimero()} onChange={(e) => setLocalesPrimero(e.target.checked)} /> Usar primero las IAs locales (Ollama y la de la app) y dejar la nube de respaldo</label>
      <div className="sub" style={{ marginTop: 10, lineHeight: 1.5 }}>Tu explicación y el texto de tus PDFs se envían solo a la IA que uses para evaluarte (con las locales no sale de tu dispositivo). Nada se guarda en otro servidor.</div>

      <SeccionInstalar />
      <SeccionActualizar />
      <div style={{ marginTop: 'auto', paddingTop: 24 }} />
    </div>
  );
}
