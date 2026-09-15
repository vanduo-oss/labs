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

/** Dev-only: write verbose telemetry/trace logs from browser harness to project root `logs/` (gitignored). */
function devLogsPlugin() {
  const logsDir = path.join(root, 'logs');
  return {
    name: 'labs-dev-logs',
    configureServer(server) {
      server.middlewares.use('/api/dev-log', (req, res, next) => {
        if (req.method !== 'POST') {
          return next();
        }
        let body = '';
        req.on('data', (chunk) => {
          body += chunk;
        });
        req.on('end', () => {
          try {
            if (!fs.existsSync(logsDir)) {
              fs.mkdirSync(logsDir, { recursive: true });
            }
            const dateStr = new Date().toISOString().slice(0, 10);
            const logFile = path.join(logsDir, `aidraw-${dateStr}.log`);
            const payload = JSON.parse(body || '{}');
            const timestamp = new Date().toISOString();
            const level = payload.level || 'INFO';
            const tag = payload.tag || 'AI-DRAW';
            const title = payload.title || '';
            const dataStr =
              typeof payload.data === 'string' ? payload.data : JSON.stringify(payload.data, null, 2);
            const entry = `[${timestamp}] [${level}] [${tag}] ${title}\n${dataStr}\n${'─'.repeat(80)}\n`;
            fs.appendFileSync(logFile, entry, 'utf8');
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: true }));
          } catch (err) {
            res.statusCode = 500;
            res.end(JSON.stringify({ ok: false, error: String(err) }));
          }
        });
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
    devLogsPlugin(),
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
