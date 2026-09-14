<script setup>
import { computed, nextTick, ref, watch } from 'vue';
import DocCodeSnippet from '../../components/DocCodeSnippet.vue';
import { VdHexGrid } from '@vanduo-oss/vdl-cbun/hex-grid';
import { TerrainType, getAdjacentHexes, hexDistance } from '@vanduo-oss/vdl-cbun/hex-grid/hex-math';

const DEFAULT_SIZE = 30;
const DEFAULT_WIDTH = 15;
const DEFAULT_HEIGHT = 10;

const size = ref(DEFAULT_SIZE);
const width = ref(DEFAULT_WIDTH);
const height = ref(DEFAULT_HEIGHT);
const rotationDeg = ref(0);
const rotationRad = computed(() => (rotationDeg.value * Math.PI) / 180);
const pixelRatio = ref('auto');
const cull = ref(true);
const renderStats = ref({
  total: 0,
  visible: 0,
  drawn: 0,
  mode: 'sharp',
  lastRenderMs: 0,
  pixelRatio: 1,
  scale: 1,
});
const zoomPercent = ref(100);
const showInfo = ref(false);
const selectedCoords = ref('');
const selectedQ = ref(null);
const selectedR = ref(null);
const showCoords = ref(false);
const pathMode = ref(false);
const pathStartLabel = ref('');
const pathLength = ref(null);
const pathNoRoute = ref(false);
const pathHexes = ref([]);
const pickedTerrain = ref(TerrainType.GRASSLAND);
const terrainTypes = Object.values(TerrainType);
const terrainName = ref(null);

let gridInstance = null;
let pathKeyIndex = new Map();
let pathStart = null;
let pathFillBackup = new Map();

const PATH_FILL = 'rgba(255, 159, 28, 0.5)';
const PATH_ACCENT = '#ff9f1c';
const DEMO_CELL_FILL = 'transparent';

const hexThemeKey = computed(() => {
  if (typeof document === 'undefined') return 'light:sky';
  const theme = document.documentElement.getAttribute('data-theme') || 'light';
  const primary = document.documentElement.getAttribute('data-primary-color') || 'sky';
  return `${theme}:${primary}`;
});

function readToken(token, fallback) {
  if (typeof document === 'undefined') return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(token).trim() || fallback;
}

function demoCellStroke() {
  return readToken('--vd-color-primary', '#3b82f6');
}

function requestRender() {
  gridInstance?.setCustomRender(overlayRender);
}

function overlayRender(ctx, hex, hexSize) {
  const key = `${hex.q},${hex.r}`;
  const idx = pathKeyIndex.get(key);
  if (idx !== undefined && gridInstance) {
    ctx.save();
    if (idx > 0) {
      const prev = pathHexes.value[idx - 1];
      const prevHex = gridInstance.getHex(prev.q, prev.r);
      if (prevHex) {
        ctx.strokeStyle = PATH_ACCENT;
        ctx.lineWidth = Math.max(2, hexSize * 0.12);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(prevHex.x, prevHex.y);
        ctx.lineTo(hex.x, hex.y);
        ctx.stroke();
      }
    }
    const isEnd = idx === 0 || idx === pathHexes.value.length - 1;
    ctx.fillStyle = PATH_ACCENT;
    ctx.beginPath();
    ctx.arc(hex.x, hex.y, Math.max(3, hexSize * (isEnd ? 0.26 : 0.16)), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  if (showCoords.value) {
    ctx.save();
    ctx.fillStyle = readToken('--vd-text-muted', '#868e96');
    ctx.font = `${Math.max(8, hexSize * 0.32)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${hex.q},${hex.r}`, hex.x, hex.y + hexSize * 0.42);
    ctx.restore();
  }
}

function applyDemoOutlineStyle() {
  if (!gridInstance) return;
  const stroke = demoCellStroke();
  for (const hex of gridInstance.getAllHexes()) {
    if (hex.terrain) continue;
    hex.fill = DEMO_CELL_FILL;
    hex.stroke = stroke;
  }
  requestRender();
}

function clearPathHighlight() {
  if (gridInstance) {
    for (const [key, fill] of pathFillBackup) {
      const [q, r] = key.split(',').map(Number);
      gridInstance.setHexFill(q, r, fill);
    }
  }
  pathFillBackup = new Map();
  pathHexes.value = [];
  pathKeyIndex = new Map();
}

function highlightPath(path) {
  if (!gridInstance) return;
  clearPathHighlight();
  pathHexes.value = path;
  pathKeyIndex = new Map(path.map((p, i) => [`${p.q},${p.r}`, i]));
  path.forEach(({ q, r }) => {
    const hex = gridInstance.getHex(q, r);
    if (hex) pathFillBackup.set(`${q},${r}`, hex.fill);
    gridInstance.setHexFill(q, r, PATH_FILL);
  });
  requestRender();
}

function computePath(start, end) {
  if (!gridInstance) return [];
  const startTerrain = gridInstance.getHexTerrain(start.q, start.r);
  const endTerrain = gridInstance.getHexTerrain(end.q, end.r);
  if (startTerrain && endTerrain) {
    const corePath = gridInstance.getPath(start.q, start.r, end.q, end.r);
    if (corePath.length) return corePath;
  }
  const passable = (q, r) => {
    if (!gridInstance.hasHex(q, r)) return false;
    const terrain = gridInstance.getHexTerrain(q, r);
    return terrain ? gridInstance.isHexPassable(q, r) : true;
  };
  if (!passable(start.q, start.r) || !passable(end.q, end.r)) return [];
  const startKey = `${start.q},${start.r}`;
  const endKey = `${end.q},${end.r}`;
  const queue = [start];
  const visited = new Set([startKey]);
  const parent = new Map();
  while (queue.length > 0) {
    const cur = queue.shift();
    const curKey = `${cur.q},${cur.r}`;
    if (curKey === endKey) {
      const path = [];
      let key = endKey;
      while (key) {
        const [q, r] = key.split(',').map(Number);
        path.unshift({ q, r });
        key = parent.get(key);
      }
      return path;
    }
    for (const n of getAdjacentHexes(cur.q, cur.r)) {
      const nKey = `${n.q},${n.r}`;
      if (!visited.has(nKey) && passable(n.q, n.r)) {
        visited.add(nKey);
        parent.set(nKey, curKey);
        queue.push(n);
      }
    }
  }
  return [];
}

function onReady(instance) {
  gridInstance = instance;
  zoomPercent.value = 100;
  instance.setCustomRender(overlayRender);
  applyDemoOutlineStyle();
  renderStats.value = { ...instance.getRenderStats() };
  nextTick(() => {
    renderStats.value = { ...instance.getRenderStats() };
  });
}

function onZoom(data) {
  zoomPercent.value = Math.round(data.scale * 100);
  if (gridInstance) renderStats.value = { ...gridInstance.getRenderStats() };
}

function onSelect(hex) {
  showInfo.value = true;
  selectedCoords.value = `(${hex.q}, ${hex.r})`;
  selectedQ.value = hex.q;
  selectedR.value = hex.r;
  terrainName.value = gridInstance?.getHexTerrain(hex.q, hex.r) ?? null;

  if (!pathMode.value || !gridInstance) return;
  if (!pathStart) {
    pathStart = { q: hex.q, r: hex.r };
    pathStartLabel.value = `(${hex.q}, ${hex.r})`;
    pathLength.value = null;
    pathNoRoute.value = false;
    clearPathHighlight();
    return;
  }
  const path = computePath(pathStart, { q: hex.q, r: hex.r });
  if (path.length > 0) {
    pathLength.value = path.length - 1;
    pathNoRoute.value = false;
    highlightPath(path);
  } else {
    pathLength.value = null;
    pathNoRoute.value = true;
    clearPathHighlight();
  }
  pathStart = null;
  pathStartLabel.value = '';
}

function resetGrid() {
  size.value = DEFAULT_SIZE;
  width.value = DEFAULT_WIDTH;
  height.value = DEFAULT_HEIGHT;
  rotationDeg.value = 0;
  gridInstance?.resetView();
  zoomPercent.value = 100;
  showInfo.value = false;
  clearPathHighlight();
  applyDemoOutlineStyle();
}

function generateTerrain() {
  clearPathHighlight();
  gridInstance?.generateRandomTerrain();
}

function applyTerrainToSelected() {
  if (!gridInstance || selectedQ.value === null || selectedR.value === null) return;
  gridInstance.setHexTerrain(selectedQ.value, selectedR.value, pickedTerrain.value);
  terrainName.value = pickedTerrain.value;
}

watch(showCoords, () => requestRender());
watch(pathMode, (on) => {
  if (!on) {
    pathStart = null;
    pathStartLabel.value = '';
    pathLength.value = null;
    pathNoRoute.value = false;
    clearPathHighlight();
  }
});

const mathTargetQ = ref(2);
const mathTargetR = ref(-1);
const mathDistance = computed(() => hexDistance(0, 0, mathTargetQ.value, mathTargetR.value));

const installShell = `pnpm add @vanduo-oss/vdl-cbun`;
const vue3Usage = `<script setup>
import { VdHexGrid } from '@vanduo-oss/vdl-cbun/hex-grid';
<\/script>

<template>
  <VdHexGrid :size="30" :width="15" :height="10" />
</template>`;
</script>

<template>
  <section id="vd-hex" data-labs-widget="hex">
    <p class="vd-mb-4">
      <a href="#widgets" class="vd-text-sm">← Widgets</a>
    </p>
    <h5 class="demo-title"><i class="ph ph-hexagon"></i> Hex Grid</h5>
    <p class="vd-mb-8">
      Axial hex canvas from <code>@vanduo-oss/vdl-cbun/hex-grid</code> with terrain and pathfinding.
    </p>

    <div class="vd-row vd-mb-6">
      <div class="vd-col-12 vd-col-lg-8 vd-mb-6">
        <div class="vd-card demo-card" style="padding: 1rem">
          <div class="hex-demo-container" style="position: relative; width: 100%; height: 420px; background: var(--vd-bg-primary)">
            <VdHexGrid
              :key="hexThemeKey"
              data-testid="labs-widget-hex"
              :size="size"
              :width="width"
              :height="height"
              :rotation="rotationRad"
              :pixel-ratio="pixelRatio"
              :cull="cull"
              @ready="onReady"
              @select="onSelect"
              @zoom="onZoom"
            />
            <div class="canvas-toolbar" style="position: absolute; top: 10px; right: 10px; display: flex; gap: 8px; z-index: 10">
              <button type="button" class="vd-btn vd-btn-sm vd-btn-outline" @click="gridInstance?.zoomOut()">−</button>
              <span class="vd-text-sm">{{ zoomPercent }}%</span>
              <button type="button" class="vd-btn vd-btn-sm vd-btn-outline" @click="gridInstance?.zoomIn()">+</button>
              <button type="button" class="vd-btn vd-btn-sm vd-btn-outline" @click="gridInstance?.resetView()">Reset</button>
            </div>
          </div>
        </div>
      </div>
      <div class="vd-col-12 vd-col-lg-4 vd-mb-6">
        <div class="vd-card demo-card">
          <div class="vd-card-body">
            <h4 class="vd-mb-4">Controls</h4>
            <label class="vd-form-label">Hex size {{ size }}px</label>
            <input v-model.number="size" type="range" class="vd-range" min="10" max="50" style="width: 100%" />
            <label class="vd-form-label vd-mt-3">Width {{ width }}</label>
            <input v-model.number="width" type="range" class="vd-range" min="5" max="30" style="width: 100%" />
            <label class="vd-form-label vd-mt-3">Height {{ height }}</label>
            <input v-model.number="height" type="range" class="vd-range" min="5" max="20" style="width: 100%" />
            <label class="vd-form-label vd-mt-3">Rotation {{ rotationDeg }}°</label>
            <input v-model.number="rotationDeg" type="range" class="vd-range" min="-180" max="180" style="width: 100%" />
            <label class="vd-form-check vd-mt-3">
              <input v-model="cull" type="checkbox" /> Viewport culling
            </label>
            <p class="vd-text-sm vd-text-muted">
              Visible {{ renderStats.visible }} / {{ renderStats.total }}
            </p>
            <div class="vd-mt-3" style="display: flex; flex-wrap: wrap; gap: 0.5rem">
              <button type="button" class="vd-btn vd-btn-outline vd-btn-sm" @click="resetGrid">Reset grid</button>
              <button type="button" class="vd-btn vd-btn-outline vd-btn-sm" @click="generateTerrain">Terrain</button>
            </div>
            <label class="vd-form-label vd-mt-3">Paint terrain</label>
            <select v-model="pickedTerrain" class="vd-form-select" :disabled="selectedQ === null">
              <option v-for="t in terrainTypes" :key="t" :value="t">{{ t }}</option>
            </select>
            <button type="button" class="vd-btn vd-btn-sm vd-btn-outline vd-mt-2" :disabled="selectedQ === null" @click="applyTerrainToSelected">
              Apply
            </button>
            <label class="vd-form-check vd-mt-3">
              <input v-model="pathMode" type="checkbox" /> Path mode
            </label>
            <p v-if="pathMode" class="vd-text-sm vd-text-muted">
              <span v-if="pathStartLabel">Start: {{ pathStartLabel }}</span>
              <span v-if="pathLength !== null"> · length {{ pathLength }}</span>
              <span v-else-if="pathNoRoute"> · no route</span>
            </p>
            <label class="vd-form-check">
              <input v-model="showCoords" type="checkbox" /> Show coordinates
            </label>
          </div>
        </div>
      </div>
    </div>

    <div v-show="showInfo" class="vd-card vd-mb-6 demo-card">
      <div class="vd-card-body">
        Selected: <strong>{{ selectedCoords || '—' }}</strong>
        <span v-if="terrainName"> · terrain {{ terrainName }}</span>
      </div>
    </div>

    <div class="vd-card demo-card">
      <div class="vd-card-body">
        <h4>Math demo</h4>
        <p>
          Distance (0,0) → ({{ mathTargetQ }}, {{ mathTargetR }}) =
          <code>{{ mathDistance }}</code>
        </p>
        <div style="display: flex; gap: 1rem">
          <label>q <input v-model.number="mathTargetQ" type="number" class="vd-form-control" /></label>
          <label>r <input v-model.number="mathTargetR" type="number" class="vd-form-control" /></label>
        </div>
        <h4 class="vd-mt-6">Install</h4>
        <DocCodeSnippet :shell="installShell" />
        <h4 class="vd-mt-6">Usage</h4>
        <DocCodeSnippet :html="vue3Usage" :default-open="true" />
      </div>
    </div>
  </section>
</template>
