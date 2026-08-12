/**
 * Labs global theme defaults for `@vanduo-oss/vd3`.
 *
 * Passed as `themeDefaults` to `VanduoVue`. vd3 falls back to these when the
 * corresponding `vdl-*` localStorage key is unset (`storagePrefix: 'vdl-'`).
 * Existing stored preferences are never overwritten by these defaults.
 */
export const VDL_THEME_DEFAULTS = Object.freeze({
  PALETTE: 'open-color',
  PRIMARY_LIGHT: 'sky',
  PRIMARY_DARK: 'sky',
  NEUTRAL: 'neutral',
  RADIUS: '0.25',
  FONT: 'open-sans',
  THEME: 'system',
});
