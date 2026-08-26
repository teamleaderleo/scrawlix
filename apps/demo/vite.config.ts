import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const workspaceFile = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: '@scrawlix/react/styles.css',
        replacement: workspaceFile('../../packages/react/src/styles.css'),
      },
      {
        find: '@scrawlix/react',
        replacement: workspaceFile('../../packages/react/src/index.tsx'),
      },
      {
        find: '@scrawlix/en',
        replacement: workspaceFile('../../packages/en/src/index.ts'),
      },
      {
        find: '@scrawlix/core',
        replacement: workspaceFile('../../packages/core/src/index.ts'),
      },
    ],
  },
});
