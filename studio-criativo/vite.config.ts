import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  base: '/studio-criativo/',
  plugins: [react()],
  build: {
    outDir: resolve(__dirname, '../frontend/studio-criativo'),
    emptyOutDir: true,
  },
});