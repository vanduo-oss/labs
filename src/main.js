import { createApp } from 'vue';
import { VanduoVue } from '@vanduo-oss/vd3';
import '@vanduo-oss/vd3/css';
import './styles/legacy-bridge.css';
import './styles/labs.css';
import App from './App.vue';

createApp(App)
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
  .mount('#app');
