import { createApp, h } from 'vue';
import { VanduoVue, VdCard, VdThemeSwitcher } from '@vanduo-oss/vd3';
import '@vanduo-oss/vd3/css';
import '../styles/legacy-bridge.css';
import { AiChat, AiChatUI } from '../../ai-chat.js';

const DemoApp = {
  name: 'AiChatDemo',
  setup() {
    return () =>
      h('div', { class: 'demo-root' }, [
        h('header', { class: 'demo-header' }, [
          h('h1', 'AI Chat (WebGPU)'),
          h(
            'p',
            [
              'In-browser inference using WebLLM with Gemma 4 first, plus optional small/fast models.',
              h('br'),
              'Fully private, FOSS guardrails enforced. No server required.',
            ],
          ),
          h(VdThemeSwitcher, { menu: false }),
        ]),
        h('div', { class: 'demo-chat-wrap' }, [h('div', { id: 'chat-mount' })]),
        h(
          VdCard,
          { class: 'demo-info-section vd-card-glow vd-glass' },
          {
            default: () => [
              h('h3', 'How it Works'),
              h('h4', 'Browser Caching & Loading Behavior'),
              h(
                'p',
                'This component requires the user to explicitly click "Load AI Model" to initiate the WebGPU engine. This prevents hijacking your GPU and network bandwidth immediately upon page load.',
              ),
              h('p', [h('strong', 'What happens when the page is refreshed?')]),
              h('ul', [
                h('li', [
                  h('strong', 'The Download is Cached: '),
                  h(
                    'a',
                    { href: 'https://webllm.mlc.ai/', target: '_blank', rel: 'noopener noreferrer' },
                    'WebLLM',
                  ),
                  ' automatically utilizes the browser\'s native Cache API. After the initial model download, weights are stored securely on your hard drive.',
                ]),
                h('li', [
                  h('strong', 'VRAM Initialization: '),
                  'A page refresh destroys the active WebAssembly memory and WebGPU context. When you click "Load AI Model" after a refresh, the component skips the network download and reads weights from the local cache into GPU VRAM.',
                ]),
              ]),
              h('h4', 'Acknowledgments, Technologies & Attribution'),
              h(
                'p',
                'Building a fully private, in-browser AI chat with robust guardrails relies on an incredible ecosystem of open-source tools:',
              ),
              h('h5', 'Core AI & Inference'),
              h('ul', [
                h('li', [
                  h('strong', [
                    h(
                      'a',
                      {
                        href: 'https://webllm.mlc.ai/',
                        target: '_blank',
                        rel: 'noopener noreferrer',
                      },
                      'WebLLM (@mlc-ai/web-llm)',
                    ),
                  ]),
                  ': The core inference engine bringing LLM chat to browsers using WebGPU acceleration and WebAssembly.',
                ]),
                h('li', [
                  h('strong', [
                    h(
                      'a',
                      {
                        href: 'https://ai.google.dev/gemma',
                        target: '_blank',
                        rel: 'noopener noreferrer',
                      },
                      'Gemma 4 (Google DeepMind)',
                    ),
                  ]),
                  ': Primary local models (E2B / E4B) packaged for WebLLM/WebGPU.',
                ]),
                h('li', [
                  h('strong', [
                    h(
                      'a',
                      {
                        href: 'https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API',
                        target: '_blank',
                        rel: 'noopener noreferrer',
                      },
                      'WebGPU API',
                    ),
                  ]),
                  ': The modern web standard allowing applications to access the device\'s underlying GPU.',
                ]),
              ]),
              h('h5', 'UI & Design'),
              h('ul', [
                h('li', [
                  h('strong', [
                    h(
                      'a',
                      {
                        href: 'https://github.com/vanduo-oss/vd3',
                        target: '_blank',
                        rel: 'noopener noreferrer',
                      },
                      '@vanduo-oss/vd3',
                    ),
                  ]),
                  ': Vanduo UI for Vue 3 powering the Labs site shell.',
                ]),
                h('li', [
                  h('strong', [
                    h(
                      'a',
                      {
                        href: 'https://phosphoricons.com/',
                        target: '_blank',
                        rel: 'noopener noreferrer',
                      },
                      'Phosphor Icons',
                    ),
                  ]),
                  ': Iconography used throughout.',
                ]),
              ]),
            ],
          },
        ),
        h('footer', { class: 'demo-footer' }, 'AI Chat — Experimental Labs Component for Vanduo'),
      ]);
  },
  mounted() {
    const chat = new AiChat();
    const ui = new AiChatUI({
      container: document.getElementById('chat-mount'),
      chat,
    });
    ui.mount();
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
    max-width: 36rem;
    margin: 0 auto 1.5rem;
  }
  .demo-chat-wrap {
    padding: 0 1.5rem 2rem;
    max-width: min(70rem, 100%);
    margin: 0 auto;
    width: 100%;
  }
  .demo-info-section {
    max-width: min(70rem, 100%);
    margin: 0 auto 3rem;
    padding: 0 1.5rem;
    color: var(--text-primary);
    line-height: 1.6;
  }
  .demo-info-section h3 {
    color: var(--color-primary);
    margin-top: 2rem;
    margin-bottom: 1rem;
    font-size: 1.25rem;
  }
  .demo-info-section h4 {
    color: var(--text-primary);
    margin-top: 1.5rem;
    margin-bottom: 0.5rem;
    font-size: 1.05rem;
  }
  .demo-info-section p,
  .demo-info-section ul {
    margin-bottom: 1rem;
    color: var(--text-secondary);
  }
  .demo-info-section ul {
    padding-left: 1.5rem;
  }
  .demo-info-section a {
    color: var(--color-primary);
    text-decoration: none;
  }
  .demo-info-section a:hover {
    text-decoration: underline;
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
