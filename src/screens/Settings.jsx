import { useState } from 'react';
import { Back, Check } from '../icons.jsx';
import { SeccionInstalar } from './Instalar.jsx';
import { getKey, setKey, probarClave } from '../lib/groq.js';

export default function Settings({ onBack }) {
  const [clave, setClave] = useState(getKey());
  const [estado, setEstado] = useState(null); // null | 'probando' | 'ok' | {error}
  const guardar = async () => {
    setKey(clave);
    if (!clave.trim()) { setEstado(null); return; }
    setEstado('probando');
    try { await probarClave(); setEstado('ok'); } catch (e) { setEstado({ error: e.message || 'No se pudo probar la clave.' }); }
  };
  return (
    <div className="page">
      <div className="bar">
        <button className="ibtn" aria-label="Volver" onClick={onBack}><Back /></button>
        <div className="crumb">Ajustes</div>
      </div>
      <h1 style={{ marginTop: 24, fontSize: 32 }}>La IA que<br />te corrige</h1>
      <p style={{ margin: '12px 0 0', fontSize: 15, lineHeight: 1.55, color: 'var(--mut)' }}>Usa Groq, que es gratis. Pegas tu clave una sola vez y queda guardada solo en este dispositivo.</p>
      <div style={{ marginTop: 24 }}>
        <label className="l" htmlFor="clave">Clave de Groq</label>
        <input id="clave" className="txt" type="password" autoComplete="off" autoCapitalize="off" spellCheck="false" value={clave} onChange={(e) => { setClave(e.target.value); setEstado(null); }} placeholder="gsk_…" />
        <button className="btn block" style={{ marginTop: 12 }} onClick={guardar} disabled={estado === 'probando'}>{estado === 'probando' ? 'Probando…' : 'Guardar y probar'}</button>
        {estado === 'ok' && <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, fontSize: 14, color: 'var(--ok)' }}><Check /> Conectada: la IA respondió bien</div>}
        {estado?.error && <div className="notice" role="alert">{estado.error}</div>}
      </div>
      <SeccionInstalar />
      <section className="card" style={{ marginTop: 14 }}>
        <div style={{ fontWeight: 800, fontSize: 16 }}>¿Cómo la consigo?</div>
        <ol style={{ margin: '10px 0 0', paddingLeft: 20, fontSize: 15, lineHeight: 1.7, color: 'var(--ink)' }}>
          <li>Entra a console.groq.com</li>
          <li>Crea una cuenta gratis</li>
          <li>En “API Keys”, crea una y cópiala</li>
        </ol>
        <div className="sub" style={{ marginTop: 12, lineHeight: 1.5 }}>Tu explicación y el texto del PDF se envían a Groq solo para evaluarte. Nada se guarda en otro servidor.</div>
      </section>
      <div className="sub" style={{ marginTop: 'auto', paddingTop: 24, textAlign: 'center' }}>Versión {__APP_VERSION__}</div>
    </div>
  );
}
