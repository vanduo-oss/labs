<script setup>
import { computed, onBeforeUnmount, ref } from 'vue';
import DocCodeSnippet from '../../components/DocCodeSnippet.vue';
import { VdDraw } from '@vanduo-oss/vdl-cbun/draw';
import { drawSeedDoc, fitDrawDemoView } from '../../constants/drawSeed.js';

const drawRef = ref(null);
const fullscreen = ref(false);
const shapeCount = ref(drawSeedDoc.shapes.length);
const selectionCount = ref(0);
const activeBrush = ref('pen');
const zoomPercent = ref(100);
const panPos = ref({ x: 0, y: 0 });
const lastAction = ref('mounted');
const readonly = ref(false);
const snap = ref(true);
const canUndo = ref(false);
const canRedo = ref(false);
const exportedSvg = ref('');
const exportedPng = ref('');
const exportFormat = ref('svg');
const copied = ref(false);
const isExporting = ref(false);

function onKeydown(event) {
  if (event.key === 'Escape') exitFullscreen();
}

function enterFullscreen() {
  fullscreen.value = true;
  document.body.style.overflow = 'hidden';
  window.addEventListener('keydown', onKeydown);
}

function exitFullscreen() {
  if (!fullscreen.value) return;
  fullscreen.value = false;
  document.body.style.overflow = '';
  window.removeEventListener('keydown', onKeydown);
}

function toggleFullscreen() {
  if (fullscreen.value) exitFullscreen();
  else enterFullscreen();
}

onBeforeUnmount(exitFullscreen);

function refreshHistoryFlags() {
  const inst = drawRef.value?.getInstance();
  if (!inst) return;
  canUndo.value = Boolean(inst.canUndo?.());
  canRedo.value = Boolean(inst.canRedo?.());
}

function resetToSeed() {
  drawRef.value?.load(drawSeedDoc);
  fitDrawDemoView(drawRef.value?.getInstance());
  shapeCount.value = drawSeedDoc.shapes.length;
  lastAction.value = 'reset (seed loaded)';
}

function clearCanvas() {
  drawRef.value?.getInstance()?.clear();
  shapeCount.value = 0;
  lastAction.value = 'canvas cleared';
}

function toggleGrid() {
  drawRef.value?.getInstance()?.toggleGrid();
  lastAction.value = 'grid toggled';
}

function selectBrush(brushName) {
  const inst = drawRef.value?.getInstance();
  if (!inst) return;
  inst.setBrush(brushName);
  inst.setTool('draw');
  activeBrush.value = brushName;
  lastAction.value = `brush: ${brushName}`;
}

function undoDraw() {
  drawRef.value?.undo?.() ?? drawRef.value?.getInstance()?.undo();
  refreshHistoryFlags();
  lastAction.value = 'undo';
}

function redoDraw() {
  drawRef.value?.redo?.() ?? drawRef.value?.getInstance()?.redo();
  refreshHistoryFlags();
  lastAction.value = 'redo';
}

function onChange(payload) {
  lastAction.value = payload.reason || 'change';
  const inst = drawRef.value?.getInstance();
  if (inst) shapeCount.value = inst.getShapes().length;
  refreshHistoryFlags();
}

function onSelect(payload) {
  const count = payload.ids.length;
  selectionCount.value = count;
  lastAction.value = count ? `select (${count})` : 'deselect';
}

function onViewport(payload) {
  const vp = payload.viewport;
  zoomPercent.value = Math.round((vp.scale || 1) * 100);
  panPos.value = { x: Math.round(vp.x || 0), y: Math.round(vp.y || 0) };
}

function onReady(instance) {
  fitDrawDemoView(instance);
  shapeCount.value = instance.getShapes().length;
  refreshHistoryFlags();
}

function formatByteSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

const exportByteLabel = computed(() => {
  if (exportFormat.value === 'svg' && exportedSvg.value) {
    return formatByteSize(new TextEncoder().encode(exportedSvg.value).length);
  }
  if (exportFormat.value === 'png' && exportedPng.value) {
    const comma = exportedPng.value.indexOf(',');
    const b64 = comma >= 0 ? exportedPng.value.slice(comma + 1) : exportedPng.value;
    const padding = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
    return formatByteSize(Math.max(0, Math.floor((b64.length * 3) / 4) - padding));
  }
  return '';
});

async function triggerExport(format) {
  exportFormat.value = format;
  isExporting.value = true;
  const inst = drawRef.value?.getInstance();
  if (!inst) {
    isExporting.value = false;
    return;
  }
  try {
    if (format === 'svg') exportedSvg.value = inst.toSVG();
    else exportedPng.value = await inst.toPNG({ scale: 2 });
  } finally {
    isExporting.value = false;
  }
}

async function copySvgToClipboard() {
  if (!exportedSvg.value) return;
  await navigator.clipboard.writeText(exportedSvg.value);
  copied.value = true;
  setTimeout(() => (copied.value = false), 2000);
}

function downloadExport() {
  const a = document.createElement('a');
  if (exportFormat.value === 'svg' && exportedSvg.value) {
    const blob = new Blob([exportedSvg.value], { type: 'image/svg+xml' });
    a.href = URL.createObjectURL(blob);
    a.download = 'sketchpad.svg';
    a.click();
    URL.revokeObjectURL(a.href);
  } else if (exportFormat.value === 'png' && exportedPng.value) {
    a.href = exportedPng.value;
    a.download = 'sketchpad.png';
    a.click();
  }
}

const brushDetails = [
  { name: 'pen', label: 'Pen', icon: 'ph ph-pen-nib', color: '#245f52' },
  { name: 'pencil', label: 'Pencil', icon: 'ph ph-pencil-simple', color: '#868e96' },
  { name: 'marker', label: 'Marker', icon: 'ph ph-paint-brush', color: '#1971c2' },
  { name: 'highlighter', label: 'Highlighter', icon: 'ph ph-highlighter', color: '#fab005' },
  { name: 'calligraphy', label: 'Calligraphy', icon: 'ph ph-scribble-loop', color: '#7048e8' },
];

const installShell = `pnpm add @vanduo-oss/vdl-cbun`;
const vue3Usage = `<script setup>
import { VdDraw } from '@vanduo-oss/vdl-cbun/draw';
import '@vanduo-oss/vdl-cbun/draw/css';
<\/script>

<template>
  <VdDraw tool="draw" @change="onChange" />
</template>`;
</script>

<template>
  <section id="vd-draw" data-labs-widget="draw">
    <p class="vd-mb-4">
      <a href="#widgets" class="vd-text-sm">← Widgets</a>
    </p>
    <h5 class="demo-title"><i class="ph ph-paint-brush"></i> Draw</h5>
    <p class="vd-mb-8">
      Vector sketchpad from <code>@vanduo-oss/vdl-cbun/draw</code> — brushes, shapes,
      sticky notes, and SVG/PNG export.
    </p>

    <div
      id="sketchpad-stage"
      class="vd-card demo-card vd-mb-4 draw-stage"
      :class="{ 'is-fullscreen labs-stage-fullscreen': fullscreen }"
    >
      <div class="vd-card-header draw-stage-header">
        <h6><i class="ph ph-paint-brush"></i> Interactive Sketchpad</h6>
        <div class="draw-stage-actions">
          <button type="button" class="vd-btn vd-btn-outline vd-btn-sm" :disabled="!canUndo || readonly" @click="undoDraw">
            Undo
          </button>
          <button type="button" class="vd-btn vd-btn-outline vd-btn-sm" :disabled="!canRedo || readonly" @click="redoDraw">
            Redo
          </button>
          <button type="button" class="vd-btn vd-btn-outline vd-btn-sm" @click="resetToSeed">Reset</button>
          <button type="button" class="vd-btn vd-btn-outline vd-btn-sm" :disabled="readonly" @click="clearCanvas">Clear</button>
          <button type="button" class="vd-btn vd-btn-outline vd-btn-sm" @click="toggleGrid">Grid</button>
          <label class="vd-btn vd-btn-outline vd-btn-sm draw-toggle"><input v-model="snap" type="checkbox" /> Snap</label>
          <label class="vd-btn vd-btn-outline vd-btn-sm draw-toggle"><input v-model="readonly" type="checkbox" /> Readonly</label>
          <button type="button" class="vd-btn vd-btn-outline vd-btn-sm" :aria-pressed="fullscreen" @click="toggleFullscreen">
            {{ fullscreen ? 'Exit full screen' : 'Full screen' }}
          </button>
        </div>
      </div>
      <div class="vd-card-body draw-stage-body">
        <VdDraw
          ref="drawRef"
          data-testid="labs-widget-draw"
          :data="drawSeedDoc"
          tool="draw"
          :readonly="readonly"
          :snap="snap"
          :style="fullscreen ? { height: '100%' } : undefined"
          @change="onChange"
          @select="onSelect"
          @viewport="onViewport"
          @ready="onReady"
        />
      </div>
    </div>

    <div class="draw-state-bar vd-mb-6">
      <span>Shapes: <strong>{{ shapeCount }}</strong></span>
      <span>Selection: <strong>{{ selectionCount }}</strong></span>
      <span>Zoom: <strong>{{ zoomPercent }}%</strong></span>
      <span>Pan: <strong>{{ panPos.x }}, {{ panPos.y }}</strong></span>
      <span>Last: <code>{{ lastAction }}</code></span>
    </div>

    <div class="brush-grid vd-mb-6">
      <button
        v-for="b in brushDetails"
        :key="b.name"
        type="button"
        class="vd-btn vd-btn-outline vd-btn-sm"
        :class="{ 'is-active': activeBrush === b.name }"
        @click="selectBrush(b.name)"
      >
        <i :class="b.icon" :style="{ color: b.color }"></i> {{ b.label }}
      </button>
    </div>

    <div class="vd-card demo-card vd-mb-6">
      <div class="vd-card-body">
        <div class="export-actions vd-mb-4">
          <button type="button" class="vd-btn vd-btn-primary vd-btn-sm" :disabled="isExporting" @click="triggerExport('svg')">
            Export SVG
          </button>
          <button type="button" class="vd-btn vd-btn-outline vd-btn-sm" :disabled="isExporting" @click="triggerExport('png')">
            Export PNG
          </button>
          <span v-if="exportByteLabel" class="vd-text-sm vd-text-muted">{{ exportByteLabel }}</span>
          <button v-if="exportFormat === 'svg' && exportedSvg" type="button" class="vd-btn vd-btn-outline vd-btn-sm" @click="copySvgToClipboard">
            {{ copied ? 'Copied!' : 'Copy SVG' }}
          </button>
          <button v-if="exportedSvg || exportedPng" type="button" class="vd-btn vd-btn-outline vd-btn-sm" @click="downloadExport">
            Download
          </button>
        </div>
      </div>
    </div>

    <div class="vd-card demo-card">
      <div class="vd-card-body">
        <h4>Install</h4>
        <DocCodeSnippet :shell="installShell" />
        <h4 class="vd-mt-6">Usage</h4>
        <DocCodeSnippet :html="vue3Usage" :default-open="true" />
      </div>
    </div>
  </section>
</template>

<style scoped>
.draw-stage-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}
.draw-stage-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}
.draw-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  margin: 0;
}
.draw-stage-body {
  min-height: 420px;
}
.draw-state-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  padding: 0.6rem 1rem;
  background: var(--vd-bg-secondary);
  border-radius: 8px;
  font-size: 0.85rem;
}
.brush-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
.export-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
}
</style>
