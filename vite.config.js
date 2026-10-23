import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import pkg from './package.json' with { type: 'json' };

export default defineConfig({
  plugins: [react()],
  base: './',
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  build: { target: 'es2020', chunkSizeWarningLimit: 2000 },
  worker: { format: 'es' }, // los hilos (IA y voz) usan módulos con carga dinámica
});
