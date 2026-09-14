<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { VdHexGrid } from '@vanduo-oss/vdl-cbun/hex-grid';

const themeTick = ref(0);

const hexThemeKey = computed(() => {
  if (typeof document === 'undefined') return `light:sky:${themeTick.value}`;
  const theme = document.documentElement.getAttribute('data-theme') || 'light';
  const primary = document.documentElement.getAttribute('data-primary-color') || 'sky';
  return `${theme}:${primary}:${themeTick.value}`;
});

let observer = null;
onMounted(() => {
  observer = new MutationObserver(() => {
    themeTick.value += 1;
  });
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme', 'data-primary-color'],
  });
});
onUnmounted(() => observer?.disconnect());

function onReady(instance) {
  instance.generateRandomTerrain();
}
</script>

<template>
  <div class="cbun-hex-wrap" style="height: 420px">
    <VdHexGrid
      :key="hexThemeKey"
      :size="28"
      :width="10"
      :height="7"
      :pixel-ratio="'auto'"
      :cull="true"
      @ready="onReady"
    />
  </div>
</template>

<style scoped>
.cbun-hex-wrap {
  position: relative;
  width: 100%;
  min-height: 240px;
  overflow: hidden;
  background: var(--vd-bg-primary);
  border-radius: var(--vd-radius-md, 0.5rem);
}
</style>
