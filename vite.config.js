import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const localModelsDir = path.join(root, '.models');

/** Dev-only: serve `.models/<id>/…` at `/models/<id>/…` (never copied into `dist/`).
 *  Also accepts HuggingFace-style `/resolve/main/…` suffixes that WebLLM appends.
 */
function localModelsPlugin() {
  return {
    name: 'labs-local-models',
    configureServer(server) {
      server.middlewares.use('/models', (req, res, next) => {
        try {
          const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
          let rel = urlPath.replace(/^\/+/, '');
          // WebLLM HF URL helper: {model}/resolve/main/<file>
          rel = rel.replace(/\/resolve\/main(?=\/|$)/g, '');
          if (!rel || rel.includes('..')) {
            res.statusCode = 400;
            res.end('Bad path');
            return;
          }
          const filePath = path.join(localModelsDir, rel);
          if (!filePath.startsWith(localModelsDir)) {
            res.statusCode = 400;
            res.end('Bad path');
            return;
          }
          if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
            res.statusCode = 404;
            res.end('Not found');
            return;
          }
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          fs.createReadStream(filePath).pipe(res);
        } catch (err) {
          next(err);
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [
    vue(),
    localModelsPlugin(),
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
