import { createApp, h, ref } from 'vue';
import { VanduoVue, VdThemeSwitcher } from '@vanduo-oss/vd3';
import '@vanduo-oss/vd3/css';
import '../styles/legacy-bridge.css';
import { installResolvedTheme } from '../vdl-resolved-theme.js';
import { DEFAULT_DOCS_BASE_URL } from '@vanduo-oss/vdl-hybrid-search';
import VdlHybridSearchUI from '../components/VdlHybridSearchUI.vue';

const lastDebug = ref('Type a query to see hybrid results (AI + fuzzy)…');

const DemoApp = {
  name: 'HybridSearchDemo',
  setup() {
    function onResultClick(result) {
      lastDebug.value = JSON.stringify(
        {
          timestamp: new Date().toISOString(),
          selected: {
            id: result.doc.id,
            title: result.doc.title,
            score: result.score,
            source: result.source,
            route: result.doc.route,
            href: `${DEFAULT_DOCS_BASE_URL}${result.doc.route === '/' ? '/' : result.doc.route}`,
          },
        },
        null,
        2,
      );
    }

    return () =>
      h('div', { class: 'demo-root' }, [
        h('header', { class: 'demo-header' }, [
          h('h1', 'Vdl Hybrid Search'),
          h('p', [
            'Instant fuzzy search + semantic AI search over ',
            h('strong', 'vd3 docs'),
            '.',
            h('br'),
            'Try: ',
            h('strong', '"button ring"'),
            ', ',
            h('strong', '"glass"'),
            ', or ',
            h('strong', '"getting started"'),
          ]),
          h(VdThemeSwitcher, { menu: false }),
        ]),
        h('div', { class: 'demo-search-wrap' }, [
          h(VdlHybridSearchUI, {
            baseUrl: DEFAULT_DOCS_BASE_URL,
            placeholder: 'Search vd3 docs…',
            onResultClick,
          }),
        ]),
        h('div', { class: 'demo-debug' }, [
          h('h3', 'Debug Output (last selection)'),
          h('pre', { id: 'debug-output' }, lastDebug.value),
        ]),
        h(
          'footer',
          { class: 'demo-footer' },
          'Hybrid Search — Experimental Labs demo using @vanduo-oss/vdl-hybrid-search',
        ),
      ]);
  },
};

const style = document.createElement('style');
style.textContent = `
  .demo-root {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    background: var(--bg-primary);
    color: var(--text-primary);
  }
  .demo-header {
    padding: 3rem 1.5rem 1.5rem;
    text-align: center;
  }
  .demo-header h1 {
    font-size: 2rem;
    font-weight: 700;
    margin-bottom: 0.5rem;
    color: var(--color-primary);
  }
  .demo-header p {
    color: var(--text-muted);
    max-width: 480px;
    margin: 0 auto 1.5rem;
  }
  .demo-search-wrap {
    padding: 0 1.5rem 2rem;
    max-width: min(70rem, 100%);
    margin: 0 auto;
    width: 100%;
  }
  .demo-debug {
    max-width: min(70rem, 100%);
    margin: 2.5rem auto 0;
    padding: 0 1.5rem 3rem;
    width: 100%;
  }
  .demo-debug h3 {
    font-size: 0.875rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted);
    margin-bottom: 0.75rem;
  }
  .demo-debug pre {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    padding: 1rem;
    font-size: 0.75rem;
    overflow-x: auto;
    overflow-y: auto;
    max-height: 320px;
    color: var(--text-primary);
    line-height: 1.5;
  }
  .demo-footer {
    margin-top: auto;
    padding: 2rem 1.5rem;
    text-align: center;
    font-size: 0.75rem;
    color: var(--text-muted);
    border-top: 1px solid var(--border-color);
  }
`;
document.head.appendChild(style);

installResolvedTheme({ storagePrefix: 'vanduo-', defaultTheme: 'dark' });

createApp(DemoApp)
  .use(VanduoVue, {
    themeDefaults: {
      PRIMARY_LIGHT: 'sky',
      PRIMARY_DARK: 'sky',
      NEUTRAL: 'neutral',
      RADIUS: '0.25',
      FONT: 'open-sans',
      THEME: 'dark',
    },
  })
  .mount('#demo-root');
