import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/studio-criativo/',
  plugins: [react()],
  build: {
    outDir: '../frontend/studio-criativo',
    emptyOutDir: true,
  },
});