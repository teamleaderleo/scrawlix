import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    emptyOutDir: false,
    outDir: 'dist',
    sourcemap: true,
    minify: false,
    lib: {
      entry: fileURLToPath(new URL('./src/background.ts', import.meta.url)),
      name: 'ScrawlixBackground',
      formats: ['iife'],
      fileName: () => 'background.js',
    },
  },
});
