import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';
import './ota.js';
import { registrarSW } from './pwa.js';

createRoot(document.getElementById('root')).render(<App />);
registrarSW((aplicar) => window.dispatchEvent(new CustomEvent('feynman-update', { detail: aplicar })));
