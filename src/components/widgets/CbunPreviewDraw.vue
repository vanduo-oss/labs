<script setup>
import { VdDraw } from '@vanduo-oss/vdl-cbun/draw';
import { drawSeedDoc, fitDrawDemoView } from '../../constants/drawSeed.js';

function onReady(instance) {
  fitDrawDemoView(instance);
  requestAnimationFrame(() => {
    requestAnimationFrame(() => fitDrawDemoView(instance));
  });
}
</script>

<template>
  <div class="cbun-draw-wrap">
    <VdDraw :data="drawSeedDoc" tool="draw" @ready="onReady" />
  </div>
</template>

<style scoped>
.cbun-draw-wrap {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  border-radius: var(--vd-card-border-radius, var(--card-border-radius));
  overflow: hidden;
  clip-path: inset(0 round var(--vd-card-border-radius, var(--card-border-radius, 0.5rem)));
}

.cbun-draw-wrap :deep(.vd-draw),
.cbun-draw-wrap :deep(.vd-draw-host) {
  flex: 1 1 auto;
  width: 100%;
  height: 100%;
  min-height: 0;
}

.cbun-draw-wrap :deep(.vd-draw-shell) {
  height: 100%;
  min-height: 0;
  border-radius: var(--vd-card-border-radius, var(--card-border-radius));
  overflow: hidden;
}

.cbun-draw-wrap :deep(.vd-draw-canvas) {
  border-bottom-left-radius: var(--vd-card-border-radius, var(--card-border-radius));
  border-bottom-right-radius: var(--vd-card-border-radius, var(--card-border-radius));
  overflow: hidden;
}

@media (max-width: 768px) {
  .cbun-draw-wrap :deep(.vd-draw-toolbar) {
    display: none;
  }

  .cbun-draw-wrap :deep(.vd-draw-shell) {
    grid-template-rows: auto minmax(0, 1fr);
  }

  .cbun-draw-wrap :deep(.vd-draw-panel) {
    justify-content: center;
    gap: 0.35rem;
    padding: 0.45rem 0.55rem;
  }

  .cbun-draw-wrap :deep(.vd-draw-panel-group) {
    display: none;
    border-right: none;
    padding-right: 0;
  }

  .cbun-draw-wrap :deep(.vd-draw-panel-group:nth-child(2)) {
    display: flex;
    justify-content: center;
    flex: 1 1 auto;
  }

  .cbun-draw-wrap :deep(.vd-draw-panel-label) {
    display: none;
  }
}
</style>
