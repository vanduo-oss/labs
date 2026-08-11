<script setup>
import { computed, onMounted, ref } from 'vue';
import { VdCard, VdSpinner } from '@vanduo-oss/vd3';
import { VdBarChart } from '@vanduo-oss/vd3-cbun/charts';
import '@vanduo-oss/vd3-cbun/charts/css';
import { VDL_MODEL_EVAL_VERSION } from '../../model-eval.js';

const report = ref(null);
const loading = ref(true);
const error = ref('');

/**
 * Short x-axis labels for vd3-cbun bar charts.
 * Categorical axes ignore `xFormat` and render the category string as-is
 * (no rotate / truncate API), so Labs supplies compact display names here
 * while the summary table keeps full `modelId`s.
 */
function compactAxisLabel(text, maxLen = 14) {
  const parts = String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
  if (!parts.length) return 'model';
  let label = parts.join(' ');
  if (label.length <= maxLen) return label;
  // Prefer "Family Size" (drop middle tokens) when the last token has digits.
  if (parts.length >= 3 && /\d/.test(parts[parts.length - 1])) {
    label = `${parts[0]} ${parts[parts.length - 1]}`;
    if (label.length <= maxLen) return label;
  }
  if (parts.length >= 2) {
    label = parts.slice(0, 2).join(' ');
    if (label.length <= maxLen) return label;
  }
  return `${parts[0].slice(0, Math.max(1, maxLen - 1))}…`;
}

function shortChartLabel(model) {
  const fromLabel = String(model?.label || '')
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/\s+-\s+.+$/, '')
    .replace(/\s+MLC$/i, '')
    .trim();
  if (fromLabel) return compactAxisLabel(fromLabel);

  const fromId = String(model?.modelId || 'model')
    .replace(/-q4f16_1-MLC$/i, '')
    .replace(/-Instruct$/i, '')
    .replace(/-it-web$/i, '')
    .replace(/-/g, ' ')
    .trim();
  return compactAxisLabel(fromId);
}

function uniqueChartLabels(models) {
  const counts = new Map();
  for (const m of models) {
    const base = shortChartLabel(m);
    counts.set(base, (counts.get(base) || 0) + 1);
  }
  const seen = new Map();
  return models.map((m) => {
    const base = shortChartLabel(m);
    if ((counts.get(base) || 0) <= 1) return base;
    const n = (seen.get(base) || 0) + 1;
    seen.set(base, n);
    return `${base} (${n})`;
  });
}

function chartRows(models, mapValue) {
  const labels = uniqueChartLabels(models);
  return models.map((m, i) => ({
    model: labels[i],
    modelId: m.modelId,
    family: m.family || '—',
    ...mapValue(m),
  }));
}

function passRateTooltip(datum, ctx) {
  const value = ctx?.value ?? datum?.passRate;
  return `${datum?.modelId || datum?.model}: ${value}%`;
}

function latencyTooltip(datum, ctx) {
  const value = ctx?.value ?? datum?.latencyMs;
  return `${datum?.modelId || datum?.model}: ${Number(value).toLocaleString()} ms`;
}

onMounted(async () => {
  loading.value = true;
  error.value = '';
  try {
    const res = await fetch('/data/model-eval-reports/latest/report.json', {
      credentials: 'same-origin',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    report.value = await res.json();
  } catch (err) {
    error.value = err?.message || String(err);
  } finally {
    loading.value = false;
  }
});

const passRateRows = computed(() =>
  chartRows(report.value?.models || [], (m) => ({
    passRate: Math.round((m.passRate || 0) * 100),
  })),
);

const latencyRows = computed(() =>
  chartRows(report.value?.models || [], (m) => ({
    latencyMs: Math.round(m.avgLatencyMs || 0),
  })),
);

const finishedLabel = computed(() => report.value?.finishedAt || '—');
</script>

<template>
  <div class="vdl-model-eval">
    <header class="vdl-model-eval-header">
      <p class="vdl-model-eval-kicker">vdl-model-eval · v{{ VDL_MODEL_EVAL_VERSION }}</p>
      <h3 class="vdl-model-eval-title">Published local eval report</h3>
      <p class="vdl-model-eval-lead">
        Compare in-browser models on branding, honesty, and instruction-following. Regenerate with
        <code>pnpm model-eval</code> (Vite + WebGPU).
      </p>
    </header>

    <div v-if="loading" class="vdl-model-eval-status">
      <VdSpinner />
      <span>Loading report…</span>
    </div>
    <p v-else-if="error" class="vdl-model-eval-error">Could not load report: {{ error }}</p>

    <template v-else-if="report">
      <p class="vdl-model-eval-meta">
        Suite {{ report.suiteName }} v{{ report.suiteVersion }} · finished {{ finishedLabel }}
      </p>
      <p v-if="report.summary?.note" class="vdl-model-eval-note">{{ report.summary.note }}</p>

      <div class="vdl-model-eval-charts">
        <VdCard class="vdl-model-eval-chart-card">
          <h4>Pass rate (%)</h4>
          <VdBarChart
            :data="passRateRows"
            x="model"
            y="passRate"
            color="family"
            :height="280"
            :y-include-zero="true"
            :y-max="100"
            :tooltip="passRateTooltip"
            title="Pass rate by model"
          />
        </VdCard>
        <VdCard class="vdl-model-eval-chart-card">
          <h4>Avg latency (ms)</h4>
          <VdBarChart
            :data="latencyRows"
            x="model"
            y="latencyMs"
            color="family"
            :height="280"
            :y-include-zero="true"
            :tooltip="latencyTooltip"
            title="Average latency by model"
          />
        </VdCard>
      </div>

      <div class="vdl-model-eval-table-wrap">
        <table class="vdl-model-eval-table">
          <thead>
            <tr>
              <th>Model</th>
              <th>Family</th>
              <th>Backend</th>
              <th>Pass</th>
              <th>Avg latency</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="m in report.models" :key="m.modelId">
              <td>{{ m.modelId }}</td>
              <td>{{ m.family }}</td>
              <td>{{ m.backend }}{{ m.litertKind ? ` · ${m.litertKind}` : '' }}</td>
              <td>{{ Math.round((m.passRate || 0) * 100) }}% ({{ m.passed }}/{{ m.total }})</td>
              <td>{{ m.avgLatencyMs != null ? `${Math.round(m.avgLatencyMs)} ms` : '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p class="vdl-model-eval-html-link">
        <a href="/data/model-eval-reports/latest/index.html" target="_blank" rel="noopener">
          Open full HTML report
        </a>
      </p>
    </template>
  </div>
</template>

<style scoped>
.vdl-model-eval {
  display: grid;
  gap: 1rem;
}
.vdl-model-eval-kicker {
  margin: 0;
  opacity: 0.7;
  font-size: 0.85rem;
}
.vdl-model-eval-title {
  margin: 0.25rem 0;
  font-size: 1.35rem;
}
.vdl-model-eval-lead,
.vdl-model-eval-meta,
.vdl-model-eval-note {
  margin: 0;
  opacity: 0.85;
}
.vdl-model-eval-note {
  font-style: italic;
}
.vdl-model-eval-status {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
.vdl-model-eval-error {
  color: #c92a2a;
}
.vdl-model-eval-charts {
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
}
.vdl-model-eval-chart-card h4 {
  margin: 0 0 0.5rem;
}
.vdl-model-eval-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.92rem;
}
.vdl-model-eval-table th,
.vdl-model-eval-table td {
  border: 1px solid color-mix(in oklab, currentColor 18%, transparent);
  padding: 0.45rem 0.55rem;
  text-align: left;
}
.vdl-model-eval-html-link a {
  color: inherit;
}
</style>
