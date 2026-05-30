import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react()],
  // On GitHub Pages the app is served from https://<user>.github.io/villani-nation-daw/,
  // so production assets must be requested under that sub-path. Dev/preview stay at
  // root so `npm run dev` is still http://localhost:5173/.
  base: command === 'build' ? '/villani-nation-daw/' : '/',
  // Tone is a large pure-ESM dep; pre-bundling it keeps the dev loop snappy.
  optimizeDeps: { include: ['tone'] },
}));
