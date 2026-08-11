<script setup>
/**
 * Decorative home atmosphere.
 *
 * Inspired by Cameron Knight — “Interactive Liquid Gradient using Three.js”
 * https://codepen.io/cameronknight/pen/ogxWmBP
 * (vanilla WebGL reimplementation; theme-bound primary + neutral mix.)
 */
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { createVdlHomeAtmosphere } from '../vdl-home-atmosphere.js';

const props = defineProps({
  /** When false, animation pauses and the layer is hidden. */
  active: { type: Boolean, default: true },
});

const canvasRef = ref(null);
const unsupported = ref(false);

/** @type {ReturnType<typeof createVdlHomeAtmosphere> | null} */
let engine = null;
/** @type {MutationObserver | null} */
let themeObserver = null;
/** @type {MediaQueryList | null} */
let motionQuery = null;

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

function bindPointer() {
  window.addEventListener('pointermove', onPointerMove, { passive: true });
}

function unbindPointer() {
  window.removeEventListener('pointermove', onPointerMove);
}

function onPointerMove(ev) {
  if (!props.active || !engine) return;
  engine.onPointer(ev.clientX, ev.clientY);
}

function onResize() {
  engine?.resize();
}

function syncActive() {
  if (!engine) return;
  if (props.active) {
    engine.syncThemeColors();
    engine.start();
    bindPointer();
  } else {
    unbindPointer();
    engine.stop();
  }
}

function observeTheme() {
  themeObserver = new MutationObserver(() => {
    if (!props.active || !engine) return;
    engine.syncThemeColors();
  });
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme', 'style', 'class'],
  });
}

onMounted(() => {
  const canvas = canvasRef.value;
  if (!canvas) return;

  engine = createVdlHomeAtmosphere(canvas, { reducedMotion: prefersReducedMotion() });
  if (!engine) {
    unsupported.value = true;
    return;
  }

  observeTheme();
  window.addEventListener('resize', onResize, { passive: true });
  motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  motionQuery.addEventListener?.('change', onMotionChange);
  syncActive();
});

function onMotionChange() {
  // Recreate engine so reduced-motion takes effect without a full page reload.
  const canvas = canvasRef.value;
  if (!canvas) return;
  engine?.destroy();
  engine = createVdlHomeAtmosphere(canvas, { reducedMotion: prefersReducedMotion() });
  if (!engine) {
    unsupported.value = true;
    return;
  }
  unsupported.value = false;
  syncActive();
}

watch(
  () => props.active,
  () => {
    syncActive();
  },
);

onBeforeUnmount(() => {
  unbindPointer();
  window.removeEventListener('resize', onResize);
  motionQuery?.removeEventListener?.('change', onMotionChange);
  themeObserver?.disconnect();
  themeObserver = null;
  engine?.destroy();
  engine = null;
});
</script>

<template>
  <!--
    Inspired by Cameron Knight — Interactive Liquid Gradient using Three.js
    https://codepen.io/cameronknight/pen/ogxWmBP
  -->
  <div
    class="vdl-home-atmosphere"
    :class="{ 'vdl-home-atmosphere-active': active && !unsupported }"
    aria-hidden="true"
  >
    <canvas ref="canvasRef" class="vdl-home-atmosphere-canvas"></canvas>
  </div>
</template>
