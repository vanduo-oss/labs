import { computed } from 'vue';
import { DOCK_TINTS, useThemePreference } from '@vanduo-oss/vd3';

/** Fan hues that are not DOCK_TINTS — nearest tint so VdDock surface mode can paint. */
const FAN_DOCK_TINT_ALIAS = Object.freeze({
  cyan: 'teal',
  sky: 'blue',
  purple: 'violet',
  rose: 'pink',
});

const DOCK_TINT_SET = new Set(DOCK_TINTS);

/**
 * Map the active theme primary to a VdDock `:tint` token.
 * Ink (`black`) yields "" so the dock stays neutral; sky defaults to blue.
 */
export function labsPrimaryToDockTint(primary) {
  if (!primary || primary === 'black') return '';
  if (DOCK_TINT_SET.has(primary)) return primary;
  return FAN_DOCK_TINT_ALIAS[primary] ?? FAN_DOCK_TINT_ALIAS.sky;
}

/**
 * Reactive dock surface tint from the shared `useThemePreference()` singleton.
 * Updates when the swatches fan or theme switcher changes primary.
 */
export function useLabsDockTint() {
  const theme = useThemePreference();
  const dockTint = computed(() => labsPrimaryToDockTint(theme.state.primary));
  return { dockTint, primary: computed(() => theme.state.primary) };
}
