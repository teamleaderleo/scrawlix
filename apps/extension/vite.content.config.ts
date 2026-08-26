import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    emptyOutDir: true,
    outDir: 'dist',
    sourcemap: true,
    minify: false,
    lib: {
      entry: fileURLToPath(new URL('./src/content.ts', import.meta.url)),
      name: 'ScrawlixContent',
      formats: ['iife'],
      fileName: () => 'content.js',
    },
  },
});
