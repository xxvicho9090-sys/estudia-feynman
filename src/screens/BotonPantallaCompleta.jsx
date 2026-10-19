import { Expandir, Contraer } from '../icons.jsx';
import { alternarFullscreen, puedeFullscreen, useFullscreen } from '../fullscreen.js';

// Botón para entrar y salir de pantalla completa (se oculta donde el dispositivo no lo permite).
export default function BotonPantallaCompleta() {
  const on = useFullscreen();
  if (!puedeFullscreen()) return null;
  return <button className="ibtn" aria-label={on ? 'Salir de pantalla completa' : 'Pantalla completa'} aria-pressed={on} title={on ? 'Salir de pantalla completa (Esc)' : 'Pantalla completa'} onClick={alternarFullscreen}>{on ? <Contraer /> : <Expandir />}</button>;
}
