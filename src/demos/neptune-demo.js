import { createApp, h } from 'vue';
import { VanduoVue, VdThemeSwitcher } from '@vanduo-oss/vd3';
import '@vanduo-oss/vd3/css';
import '../styles/legacy-bridge.css';
import { NeptuneSearch, NeptuneSearchUI } from '../../neptune-search.js';

const DemoApp = {
  name: 'NeptuneDemo',
  setup() {
    return () =>
      h('div', { class: 'demo-root' }, [
        h('header', { class: 'demo-header' }, [
          h('h1', 'Neptune Hybrid Search'),
          h('p', [
            'Instant fuzzy search + semantic AI search over Vanduo Docs.',
            h('br'),
            'Try: ',
            h('strong', '"glass card"'),
            ', ',
            h('strong', '"how to theme"'),
            ', or ',
            h('strong', '"button sizes"'),
          ]),
          h(VdThemeSwitcher, { menu: false }),
        ]),
        h('div', { class: 'demo-search-wrap' }, [h('div', { id: 'search-mount' })]),
        h('div', { class: 'demo-debug' }, [
          h('h3', 'Debug Output (last search)'),
          h(
            'pre',
            { id: 'debug-output' },
            'Type a query and press Enter to see raw results…',
          ),
        ]),
        h(
          'footer',
          { class: 'demo-footer' },
          'Neptune Hybrid Search — Experimental Labs Component for Vanduo',
        ),
      ]);
  },
  mounted() {
    const debugOutput = document.getElementById('debug-output');
    const search = new NeptuneSearch({
      indexUrl: '/data/search-index.json',
      vectorsUrl: '/data/vectors.json',
    });

    const ui = new NeptuneSearchUI({
      container: document.getElementById('search-mount'),
      search,
      placeholder: 'Search docs…',
      onResultClick: (result) => {
        debugOutput.textContent = JSON.stringify(
          {
            timestamp: new Date().toISOString(),
            selected: {
              id: result.doc.id,
              title: result.doc.title,
              score: result.score,
              source: result.source,
              route: result.doc.route,
            },
          },
          null,
          2,
        );
        window.open(`https://vanduo.dev/#${result.doc.route}`, '_blank', 'noopener,noreferrer');
      },
    });
    ui.mount();

    const originalSearch = search.search.bind(search);
    search.search = async function (...args) {
      const result = await originalSearch(...args);
      debugOutput.textContent = JSON.stringify(
        {
          timestamp: new Date().toISOString(),
          query: result.query,
          mode: result.mode,
          fuzzyCount: result.fuzzy.length,
          semanticCount: result.semantic.length,
          merged: result.merged.map((r) => ({
            id: r.doc.id,
            title: r.doc.title,
            score: r.score,
            source: r.source,
          })),
        },
        null,
        2,
      );
      return result;
    };
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
    line-height: 1.5;
    overflow-x: auto;
    overflow-y: auto;
    max-height: 320px;
    color: var(--text-primary);
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

createApp(DemoApp)
  .use(VanduoVue, {
    themeDefaults: {
      PRIMARY_LIGHT: 'sky',
      PRIMARY_DARK: 'sky',
      NEUTRAL: 'neutral',
      RADIUS: '0.25',
      FONT: 'jetbrains-mono',
      THEME: 'dark',
    },
  })
  .mount('#demo-root');
