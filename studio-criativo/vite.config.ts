import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  base: '/studio-criativo/',
  plugins: [react()],
  build: {
    outDir: fileURLToPath(new URL('../frontend/studio-criativo', import.meta.url)),
    emptyOutDir: true,
  },
});