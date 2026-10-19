import { useState } from 'react';
import { instalar, useInstalable } from '../pwa.js';

const OCULTO = 'feynman.ocultarInstalar';
const leer = () => { try { return localStorage.getItem(OCULTO) === '1'; } catch { return false; } };

// Aviso de instalación en la pantalla principal (solo en la web, y solo si el navegador deja instalar).
export function BannerInstalar() {
  const estado = useInstalable();
  const [oculto, setOculto] = useState(leer());
  if (estado !== 'listo' || oculto) return null;
  const cerrar = () => { try { localStorage.setItem(OCULTO, '1'); } catch { /* opcional */ } setOculto(true); };
  return (
    <div className="notice info" role="region" aria-label="Instalar la app" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <span style={{ flex: '1 1 220px' }}><b>Instala la app.</b> Se abre como programa propio, sin pasar por el navegador, y se actualiza sola.</span>
      <button className="btn" style={{ height: 44, boxShadow: 'none' }} onClick={() => instalar()}>Instalar</button>
      <button className="linkbtn" onClick={cerrar}>Ahora no</button>
    </div>
  );
}

// Sección de Ajustes: botón de instalar o, si el navegador no ofrece el botón, cómo hacerlo a mano.
export function SeccionInstalar() {
  const estado = useInstalable();
  if (estado === 'no') return null;
  return (
    <section className="card" style={{ marginTop: 14 }}>
      <div style={{ fontWeight: 800, fontSize: 16 }}>Instalar en este dispositivo</div>
      <div className="sub" style={{ marginTop: 6, lineHeight: 1.5 }}>Se abre como programa propio (laptop) o como app (Android), sin entrar a la página, y recibe las actualizaciones automáticamente.</div>
      {estado === 'listo'
        ? <button className="btn block" style={{ marginTop: 14 }} onClick={() => instalar()}>Instalar la app</button>
        : <div className="sub" style={{ marginTop: 12, lineHeight: 1.6, color: 'var(--ink)' }}>
          Tu navegador no muestra el botón. Hazlo a mano:<br />
          • <b>Chrome / Edge:</b> menú ⋮ → “Instalar app” (o el ícono ⊕ en la barra de direcciones).<br />
          • <b>Android:</b> menú ⋮ → “Instalar app” o “Añadir a la pantalla de inicio”.<br />
          • <b>iPhone / iPad (Safari):</b> Compartir → “Añadir a pantalla de inicio”.
        </div>}
    </section>
  );
}
