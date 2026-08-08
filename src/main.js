import { createApp } from 'vue';
import { VanduoVue } from '@vanduo-oss/vd3';
import '@vanduo-oss/vd3/css';
import './styles/legacy-bridge.css';
import './styles/labs.css';
import { VDL_THEME_DEFAULTS } from './vdl-theme-defaults.js';
import { installVdlThemeStorage } from './vdl-theme-storage.js';
import App from './App.vue';

// Before VanduoVue / theme preference I/O: remap vanduo-* → vdl-* keys.
installVdlThemeStorage();

createApp(App)
  .use(VanduoVue, {
    themeDefaults: { ...VDL_THEME_DEFAULTS },
  })
  .mount('#app');
