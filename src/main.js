import { createApp } from 'vue';
import { VanduoVue } from '@vanduo-oss/vd3';
import '@vanduo-oss/vd3/css';
import './styles/legacy-bridge.css';
import './styles/labs.css';
import { VDL_THEME_DEFAULTS } from './vdl-theme-defaults.js';
import App from './App.vue';

createApp(App)
  .use(VanduoVue, {
    themeDefaults: { ...VDL_THEME_DEFAULTS },
    // Isolate Labs prefs from vd3-docs on shared Pages origins (was remapper).
    storagePrefix: 'vdl-',
  })
  .mount('#app');
