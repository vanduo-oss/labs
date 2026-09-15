import { PRIMARY_COLORS } from '@vanduo-oss/vd3';

/**
 * Fan hues shared with vd3-docs accretion dock customizer. Filtered through
 * `PRIMARY_COLORS` so blades stay in package rainbow order.
 */
export const LABS_FAN_HUES = [
  'red',
  'orange',
  'yellow',
  'green',
  'teal',
  'cyan',
  'sky',
  'blue',
  'violet',
  'purple',
  'pink',
  'rose',
];

const FAN_HUE_SET = new Set(LABS_FAN_HUES);

const FAN_PRIMARY_COLORS = PRIMARY_COLORS.filter((c) => FAN_HUE_SET.has(c.key));

/**
 * Keys for the package swatches fan — Ink plus the twelve accretion hues.
 * Same set as vd3-docs `DOCS_PRIMARY_SWATCH_KEYS`. Labs defaults stay sky via
 * `VDL_THEME_DEFAULTS` / `vdl-` storage.
 */
export const LABS_PRIMARY_SWATCH_KEYS = Object.freeze([
  'black',
  ...FAN_PRIMARY_COLORS.map((c) => c.key),
]);
