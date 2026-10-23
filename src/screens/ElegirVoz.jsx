import { useEffect, useState } from 'react';
import { useVozNatural, descargarVoz, borrarVoz, TAMANO } from '../lib/vozNatural.js';
import { getVoz, setVoz, vocesDisponibles, motorActual, hablar, callar, alCambiarVoces, hayVozNatural, puedeOfrecerVoz } from '../lib/hablar.js';

const PRUEBA = 'Buenos días. Comencemos la interrogación. Hábleme del contrato de compraventa: ¿en qué consiste y por qué es importante?';

// Hoja para elegir la voz del profesor: la mejor disponible, la voz natural de la app (se descarga una vez) o una del dispositivo.
export default function ElegirVoz({ onClose }) {
  const app = useVozNatural();
  const [, redibujar] = useState(0);
  const [pref, setPref] = useState(getVoz());
  useEffect(() => alCambiarVoces(() => redibujar((x) => x + 1)), []);
  useEffect(() => () => callar(), []);
  const elegir = (v) => { setVoz(v); setPref(v); callar(); redibujar((x) => x + 1); };
  const sistema = vocesDisponibles();
  const ahora = motorActual();
  const probar = () => { callar(); hablar(PRUEBA); };
  const fila = (clave, titulo, sub, extra) => (
    <label className={'voz-op' + (pref === clave ? ' on' : '')} key={clave}>
      <input type="radio" name="voz" checked={pref === clave} onChange={() => elegir(clave)} />
      <span style={{ flex: 1, minWidth: 0 }}><b>{titulo}</b><span className="sub" style={{ display: 'block' }}>{sub}</span></span>
      {extra}
    </label>
  );
  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-label="Voz del profesor" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div>
        <h2>Voz del profesor</h2>
        <p className="sub" style={{ margin: '4px 0 12px', lineHeight: 1.5 }}>Ahora suena con: <b style={{ color: 'var(--ink)' }}>{ahora.etiqueta}</b>{ahora.tipo !== 'ninguno' && !ahora.natural ? ' (voz básica, suena robótica)' : ''}.</p>

        {puedeOfrecerVoz() && (
          <div className="voz-app">
            <div style={{ flex: 1, minWidth: 0 }}>
              <b>Voz natural de la app</b>
              <div className="sub" style={{ lineHeight: 1.45 }}>{app.fase === 'listo' ? 'Lista. Funciona sin internet en cualquier dispositivo.' : app.fase === 'bajando' ? `Descargando… ${Math.round(app.f * 100)} %` : `Una voz humana en español, mucho más natural que las básicas. Se descarga una sola vez (${TAMANO}).`}</div>
              {app.fase === 'bajando' && <div className="prog" style={{ marginTop: 8, height: 6 }}><i style={{ width: `${Math.round(app.f * 100)}%` }} /></div>}
              {app.fase === 'error' && <div className="sub" style={{ color: 'var(--bad)', marginTop: 6 }}>{app.error}</div>}
            </div>
            {app.fase === 'listo'
              ? <button className="linkbtn" onClick={() => { if (confirm('¿Borrar la voz natural de la app? Se puede volver a descargar.')) { borrarVoz(); if (pref === 'natural') elegir('auto'); } }}>Borrar</button>
              : <button className="btn" disabled={app.fase === 'bajando'} onClick={() => descargarVoz().then(() => elegir('natural'))}>{app.fase === 'error' ? 'Reintentar' : 'Descargar'}</button>}
          </div>
        )}

        <div className="voz-lista" role="radiogroup" aria-label="Voces disponibles">
          {fila('auto', 'Automática (recomendada)', 'Usa siempre la voz más natural que tenga este dispositivo.')}
          {app.fase === 'listo' && fila('natural', 'Voz natural de la app', 'Voz en español latino, funciona sin internet.')}
          {sistema.map((v) => fila('sys:' + v.nombre, v.nombre, `${v.lang}${v.natural ? ' · natural' : ' · básica'}`))}
        </div>
        {!hayVozNatural() && app.fase !== 'listo' && <div className="sub" style={{ marginTop: 10, lineHeight: 1.5 }}>Consejo: en el computador, abre la app en Microsoft Edge; trae voces «Natural» en español de Chile gratis, sin descargar nada.</div>}

        <div className="two" style={{ marginTop: 16 }}>
          <button className="btn ghost" onClick={probar} disabled={ahora.tipo === 'ninguno'}>Probar la voz</button>
          <button className="btn" onClick={onClose}>Listo</button>
        </div>
      </div>
    </div>
  );
}
