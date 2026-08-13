import { createApp, h } from 'vue';
import { VanduoVue } from '@vanduo-oss/vd3';
import '@vanduo-oss/vd3/css';
import '../styles/legacy-bridge.css';
import { installResolvedTheme } from '../vdl-resolved-theme.js';
import AiDrawDemo from '../components/AiDrawDemo.vue';

installResolvedTheme({ storagePrefix: 'vanduo-', defaultTheme: 'dark' });

const DemoApp = {
  name: 'AiDrawDemoEntry',
  setup() {
    return () => h('div', { id: 'ai-draw-app' }, [h(AiDrawDemo)]);
  },
};

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
