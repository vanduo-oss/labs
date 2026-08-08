import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    vue(),
    viteStaticCopy({
      targets: [
        { src: 'ai-chat.js', dest: '.' },
        { src: 'neptune-search.js', dest: '.' },
        { src: 'labs-md-to-html.js', dest: '.' },
        { src: 'guardrails', dest: '.' },
        { src: 'data', dest: '.' },
        { src: 'doc', dest: '.' },
        { src: 'favicon.svg', dest: '.' },
        { src: 'tests', dest: '.' },
      ],
    }),
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: path.resolve(root, 'index.html'),
        'ai-chat-demo': path.resolve(root, 'demo/ai-chat-demo.html'),
        'neptune-demo': path.resolve(root, 'demo/neptune-demo.html'),
      },
    },
  },
  server: {
    port: 3000,
  },
  preview: {
    port: 3000,
  },
});
