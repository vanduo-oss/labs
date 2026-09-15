<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { VdThemeCustomizer as VdThemeCustomizerBase } from '@vanduo-oss/vd3';
import { LABS_PRIMARY_SWATCH_KEYS } from '../labs-primary-swatches.js';

/**
 * Labs lock-in around the package swatches fan: only Primary Color is
 * user-editable. Palette / Neutral / Radius / Font stay forced to Labs
 * `themeDefaults` (sky, open-sans, RADIUS 0.5, open-color). Persistence stays
 * on the package `useThemePreference()` singleton under `storagePrefix: 'vdl-'`.
 */

const props = defineProps({
  /** When set, wires a site-dock tooltip on the swatches trigger. */
  tooltipPlacement: { type: String, default: undefined },
});

/**
 * The fan follows the dock, not the viewport: `direction="auto"` would aim it
 * away from the nearest edge, which is the same answer only while the dock is
 * pinned to that edge.
 */
const FAN_DIRECTION = {
  bottom: 'up',
  top: 'down',
  left: 'right',
  right: 'left',
};

const dockEdge = ref('bottom');

const syncDockEdge = () => {
  const edge = document.documentElement.getAttribute('data-labs-dock');
  dockEdge.value = edge === 'top' || edge === 'left' || edge === 'right' ? edge : 'bottom';
};

const direction = computed(() => FAN_DIRECTION[dockEdge.value]);

const base = ref(null);

let dockObserver = null;

onMounted(() => {
  syncDockEdge();
  dockObserver = new MutationObserver(syncDockEdge);
  dockObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-labs-dock'],
  });
});

onUnmounted(() => {
  dockObserver?.disconnect();
  dockObserver = null;
});

const dockTooltipBind = computed(() =>
  props.tooltipPlacement
    ? {
        'data-tooltip': 'Theme color',
        'data-tooltip-placement': props.tooltipPlacement,
        'data-tooltip-variant': 'dock',
      }
    : {},
);

defineExpose({
  open: () => base.value?.open(),
  close: () => base.value?.close(),
  toggle: () => base.value?.toggle(),
});
</script>

<template>
  <VdThemeCustomizerBase
    ref="base"
    variant="swatches"
    :swatches="LABS_PRIMARY_SWATCH_KEYS"
    :direction="direction"
    v-bind="dockTooltipBind"
  />
</template>
