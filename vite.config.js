import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const localModelsDir = path.join(root, '.models');
const vdlCbunRoot = path.resolve(root, '../vdl-cbun');
const vdlCbunDist = path.join(vdlCbunRoot, 'dist');
const useLocalVdlCbun = fs.existsSync(path.join(vdlCbunDist, 'index.js'));

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
          const st = fs.statSync(filePath);
          res.setHeader('Content-Length', String(st.size));
          res.setHeader('Content-Type', 'application/octet-stream');
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          res.setHeader('Accept-Ranges', 'bytes');
          fs.createReadStream(filePath).pipe(res);
        } catch (err) {
          next(err);
        }
      });
    },
  };
}

const vdlCbunAlias = useLocalVdlCbun
  ? {
      '@vanduo-oss/vdl-cbun/code-editor/css': path.join(
        vdlCbunDist,
        'code-editor/vd3-code-editor.css',
      ),
      '@vanduo-oss/vdl-cbun/code-editor/highlight': path.join(
        vdlCbunDist,
        'code-editor/highlight.js',
      ),
      '@vanduo-oss/vdl-cbun/code-editor': path.join(vdlCbunDist, 'code-editor'),
      '@vanduo-oss/vdl-cbun/draw/css': path.join(vdlCbunDist, 'draw/vd3-draw.css'),
      '@vanduo-oss/vdl-cbun/draw': path.join(vdlCbunDist, 'draw'),
      '@vanduo-oss/vdl-cbun/hex-grid/hex-math': path.join(vdlCbunDist, 'hex-grid/hex-math.js'),
      '@vanduo-oss/vdl-cbun/hex-grid': path.join(vdlCbunDist, 'hex-grid'),
      '@vanduo-oss/vdl-cbun/music-player/css': path.join(
        vdlCbunDist,
        'music-player/vd3-music-player.css',
      ),
      '@vanduo-oss/vdl-cbun/music-player': path.join(vdlCbunDist, 'music-player'),
      '@vanduo-oss/vdl-cbun': vdlCbunDist,
    }
  : {};

export default defineConfig({
  plugins: [
    vue(),
    localModelsPlugin(),
    viteStaticCopy({
      targets: [
        { src: 'model-eval.js', dest: '.' },
        { src: 'data', dest: '.' },
        { src: 'doc', dest: '.' },
        { src: 'favicon.svg', dest: '.' },
      ],
    }),
  ],
  resolve: {
    alias: {
      ...vdlCbunAlias,
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rolldownOptions: {
      input: {
        main: path.resolve(root, 'index.html'),
        'ai-chat-demo': path.resolve(root, 'demo/ai-chat-demo.html'),
        'ai-draw-demo': path.resolve(root, 'demo/ai-draw-demo.html'),
        'hybrid-search-demo': path.resolve(root, 'demo/hybrid-search-demo.html'),
        'model-eval-harness': path.resolve(root, 'demo/model-eval-harness.html'),
      },
    },
  },
  server: {
    port: 3000,
    // Large local `.litertlm` downloads need more than the default keep-alive window.
    headers: {
      Connection: 'keep-alive',
    },
    fs: {
      allow: [root, ...(useLocalVdlCbun ? [vdlCbunRoot] : [])],
    },
  },
  preview: {
    port: 3000,
  },
});
