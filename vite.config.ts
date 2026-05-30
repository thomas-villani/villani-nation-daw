import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Tone is a large pure-ESM dep; pre-bundling it keeps the dev loop snappy.
  optimizeDeps: { include: ['tone'] },
});
