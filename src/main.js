import { createApp } from 'vue';
import { VanduoVue } from '@vanduo-oss/vd3';
import '@vanduo-oss/vd3/css';
import './styles/legacy-bridge.css';
import './styles/labs.css';
import { VDL_THEME_DEFAULTS } from './vdl-theme-defaults.js';
import { installResolvedTheme } from './vdl-resolved-theme.js';
import App from './App.vue';

// Preference may be "system"; DOM must always expose resolved light|dark.
installResolvedTheme({
  storagePrefix: 'vdl-',
  defaultTheme: VDL_THEME_DEFAULTS.THEME,
});

createApp(App)
  .use(VanduoVue, {
    themeDefaults: { ...VDL_THEME_DEFAULTS },
    // Isolate Labs prefs from vd3-docs on shared Pages origins (was remapper).
    storagePrefix: 'vdl-',
  })
  .mount('#app');
