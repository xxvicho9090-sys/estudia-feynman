import { useState } from 'react';
import { Back, Check } from '../icons.jsx';
import { SeccionInstalar } from './Instalar.jsx';
import { PROVEEDORES, configurado, getClave, setClave, getOllama, setOllama, probar, ultimoUsado, proveedor } from '../lib/ai.js';

// Una tarjeta por IA: clave, "Guardar y probar" y cómo conseguirla.
function Tarjeta({ p, abierta, onCambio }) {
  const [clave, setCl] = useState(getClave(p.id));
  const [ollama, setOl] = useState(getOllama());
  const [estado, setEstado] = useState(null); // null | 'probando' | { ok, modelo } | { error }
  const [open, setOpen] = useState(abierta); // la tarjeta no se cierra sola al conectar
  const conectada = configurado(p);
  const guardar = async () => {
    if (p.local) setOllama({ url: ollama.url, modelo: ollama.modelo }); else setClave(p.id, clave);
    onCambio();
    if (!configurado(p)) { setEstado(null); return; }
    setEstado('probando');
    try { const modelo = await probar(p.id); setEstado({ ok: true, modelo }); } catch (e) { setEstado({ error: e.message || 'No se pudo probar.' }); }
  };
  return (
    <details className="ia" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>
        <span className="ia-n">{p.nombre}</span>
        <span className="ia-rol">{p.rol}</span>
        <span className={'ia-est' + (conectada ? ' on' : '')}>{conectada ? '✓ Conectada' : 'Sin conectar'}</span>
      </summary>
      <div className="ia-body">
        <p className="sub" style={{ lineHeight: 1.5, margin: 0 }}>{p.desc}</p>
        <p className="sub" style={{ lineHeight: 1.5, margin: '8px 0 0', color: 'var(--ink)' }}><b>Cómo conseguirla:</b> entra a <a href={`https://${p.url}`} target="_blank" rel="noopener noreferrer">{p.url}</a>. {p.pasos}</p>
        {p.local ? (
          <>
            <label className="l" htmlFor={`u-${p.id}`} style={{ marginTop: 14 }}>Dirección de Ollama</label>
            <input id={`u-${p.id}`} className="txt" value={ollama.url} onChange={(e) => { setOl({ ...ollama, url: e.target.value }); setEstado(null); }} placeholder="http://localhost:11434/v1" />
            <div className="sub" style={{ marginTop: 6 }}>En el celular usa la IP de tu laptop, por ejemplo http://192.168.1.20:11434/v1 (Ollama con OLLAMA_HOST=0.0.0.0).</div>
            <label className="l" htmlFor={`m-${p.id}`} style={{ marginTop: 14 }}>Modelo</label>
            <input id={`m-${p.id}`} className="txt" value={ollama.modelo} onChange={(e) => { setOl({ ...ollama, modelo: e.target.value }); setEstado(null); }} placeholder="qwen2.5:7b" autoCapitalize="off" spellCheck="false" />
          </>
        ) : (
          <>
            <label className="l" htmlFor={`k-${p.id}`} style={{ marginTop: 14 }}>Clave de {p.nombre}</label>
            <input id={`k-${p.id}`} className="txt" type="password" autoComplete="off" autoCapitalize="off" spellCheck="false" value={clave} onChange={(e) => { setCl(e.target.value); setEstado(null); }} placeholder={p.prefijo ? `${p.prefijo}…` : 'Pega tu clave'} />
          </>
        )}
        <button className="btn block" style={{ marginTop: 12 }} onClick={guardar} disabled={estado === 'probando'}>{estado === 'probando' ? 'Probando…' : 'Guardar y probar'}</button>
        {estado?.ok && <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, fontSize: 14, color: 'var(--ok)' }}><Check /> Conectada{estado.modelo ? ` (modelo ${estado.modelo})` : ''}</div>}
        {estado?.error && <div className="notice" role="alert">{estado.error}</div>}
        {conectada && <button className="linkbtn" style={{ marginTop: 12, color: 'var(--bad)' }} onClick={() => { if (p.local) { setOllama({ url: '', modelo: '' }); setOl(getOllama()); } else { setClave(p.id, ''); setCl(''); } setEstado(null); onCambio(); }}>Quitar esta IA</button>}
      </div>
    </details>
  );
}

export default function Settings({ onBack }) {
  const [, forzar] = useState(0);
  const n = PROVEEDORES.filter(configurado).length;
  const usada = ultimoUsado();
  return (
    <div className="page">
      <div className="bar">
        <button className="ibtn" aria-label="Volver" onClick={onBack}><Back /></button>
        <div className="crumb">Ajustes</div>
      </div>
      <h1 style={{ marginTop: 24, fontSize: 32 }}>Las IAs que<br />te ayudan</h1>
      <p style={{ margin: '12px 0 0', fontSize: 15, lineHeight: 1.55, color: 'var(--mut)' }}>Conecta una o varias, todas gratis. <b style={{ color: 'var(--ink)' }}>Si una llega a su límite, uso la siguiente automáticamente</b>, así nunca te quedas sin poder estudiar. Las claves quedan solo en este dispositivo.</p>
      <div className="sub" style={{ marginTop: 10 }}>{n ? `${n} ${n === 1 ? 'IA conectada' : 'IAs conectadas'}${usada ? ` · última usada: ${proveedor(usada).nombre}` : ''}.` : 'Todavía no hay ninguna conectada.'}</div>

      <div className="ias">
        {PROVEEDORES.map((p, i) => <Tarjeta key={p.id} p={p} abierta={i < 2 && !configurado(p)} onCambio={() => forzar((x) => x + 1)} />)}
      </div>
      <div className="sub" style={{ marginTop: 14, lineHeight: 1.5 }}>Tu explicación y el texto de tus PDFs se envían solo a la IA que uses para evaluarte (con Ollama no sale de tu computador). Nada se guarda en otro servidor.</div>

      <SeccionInstalar />
      <div className="sub" style={{ marginTop: 'auto', paddingTop: 24, textAlign: 'center' }}>Versión {__APP_VERSION__}</div>
    </div>
  );
}
