<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { VdDock, VdThemeSwitcher, dockOrientationOf, useTooltips } from '@vanduo-oss/vd3';
import LabsBrandMark from './LabsBrandMark.vue';
import LabsThemeCustomizer from '../overlays/LabsThemeCustomizer.vue';
import {
  LABS_DOCK_RADIUS,
  LABS_DOCK_STORAGE_KEY,
  LABS_DOCK_TOOLTIP_DELAY_MS,
} from '../composables/labsDock.js';
import { useLabsDockNarrow } from '../composables/useLabsDockNarrow.js';
import { useLabsDockTint } from '../composables/useLabsDockTint.js';
import { useSiteDockBrandSpin } from '../composables/useSiteDockBrandSpin.js';

const props = defineProps({
  /** Active top-level route: home | about | demos | widgets */
  route: { type: String, required: true },
  /** Nested widget slug when on widgets route (optional). */
  widgetSlug: { type: String, default: null },
});

const BRAND_EDGE_TIP = {
  bottom: 'Move dock to left',
  left: 'Move dock to top',
  top: 'Move dock to right',
  right: 'Move dock to bottom',
};

const placement = ref('top');
const tooltipRoot = ref(null);
const dockEl = ref(null);
const dockInst = ref(null);
const lastWidePlacement = ref('top');

const { dockTint } = useLabsDockTint();

const isNarrow = useLabsDockNarrow({
  onExitNarrow: () => {
    persistSiteDockPlacement(lastWidePlacement.value);
  },
});

const isHorizontalEdge = computed(() => dockOrientationOf(placement.value) === 'horizontal');

const itemLayout = computed(() =>
  isHorizontalEdge.value && !isNarrow.value ? 'inline' : 'stack',
);

const showDockTooltips = computed(() => !isNarrow.value && !isHorizontalEdge.value);

const tooltipPlacement = computed(() => {
  switch (placement.value) {
    case 'top':
      return 'bottom';
    case 'left':
      return 'right';
    case 'right':
      return 'left';
    default:
      return 'top';
  }
});

const brandTooltip = computed(() => BRAND_EDGE_TIP[placement.value]);

const dockTooltipBind = computed(() =>
  showDockTooltips.value
    ? {
        'data-tooltip-placement': tooltipPlacement.value,
        'data-tooltip-variant': 'dock',
      }
    : {},
);

const themeTooltipPlacement = computed(() =>
  showDockTooltips.value ? tooltipPlacement.value : undefined,
);

const links = [
  { id: 'home', label: 'Home', icon: 'house', hash: '#home' },
  { id: 'widgets', label: 'Widgets', icon: 'package', hash: '#widgets' },
  { id: 'demos', label: 'Demos', icon: 'flask', hash: '#demos' },
  { id: 'about', label: 'About', icon: 'info', hash: '#about' },
];

const activeId = computed(() => {
  if (links.some((l) => l.id === props.route)) return props.route;
  return '';
});

function persistSiteDockPlacement(edge) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(LABS_DOCK_STORAGE_KEY, edge);
  } catch {
    /* ignore quota / private mode */
  }
}

function hideVisibleDockTooltips() {
  if (typeof document === 'undefined') return;
  document.querySelectorAll('.vd-tooltip.vd-tooltip-dock').forEach((tip) => tip.remove());
}

function go(hash) {
  if (location.hash === hash) return;
  location.hash = hash;
}

function onDockClick(event) {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const item = target.closest('.vd-dock-item');
  if (!item || !(item instanceof HTMLElement)) return;
  const label = item.getAttribute('aria-label');
  const link = links.find((entry) => entry.label === label);
  if (link) go(link.hash);
}

function onBrandCapture(event) {
  if (!isNarrow.value) return;
  const target = event.target;
  if (!(target instanceof Element)) return;
  if (!target.closest('.vd-dock-brand')) return;

  event.stopPropagation();
  event.preventDefault();

  const next = placement.value === 'top' ? 'bottom' : 'top';
  dockInst.value?.snapToPlacement?.(next);
  persistSiteDockPlacement(next);
  void nextTick(() => {
    patchBrandA11y();
    syncDockTooltips();
  });
}

function syncDockAttr(edge) {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-labs-dock', edge);
}

function patchBrandA11y() {
  const el = dockEl.value;
  if (!el || !isNarrow.value) return;
  const brand = el.querySelector('.vd-dock-brand');
  if (!(brand instanceof HTMLButtonElement)) return;
  brand.removeAttribute('aria-disabled');
  brand.setAttribute(
    'aria-label',
    placement.value === 'top' ? 'Move dock to bottom' : 'Move dock to top',
  );
}

function syncDockTooltips() {
  const el = dockEl.value;
  if (!el) return;

  const brand = el.querySelector('.vd-dock-brand');
  if (!(brand instanceof HTMLElement)) return;

  if (isNarrow.value || isHorizontalEdge.value) {
    brand.removeAttribute('data-tooltip');
    brand.removeAttribute('data-tooltip-placement');
    brand.removeAttribute('data-tooltip-variant');
    hideVisibleDockTooltips();
    return;
  }

  brand.setAttribute('data-tooltip', brandTooltip.value);
  for (const [key, value] of Object.entries(dockTooltipBind.value)) {
    brand.setAttribute(key, value);
  }
}

function setDockRef(inst) {
  dockInst.value = inst;
  const el = inst?.$el;
  const node = el instanceof HTMLElement ? el : null;
  dockEl.value = node;
  tooltipRoot.value = node;
}

useTooltips(tooltipRoot, { showDelay: LABS_DOCK_TOOLTIP_DELAY_MS });
useSiteDockBrandSpin(dockEl);

watch(
  placement,
  (edge) => {
    syncDockAttr(edge);
    void nextTick(() => {
      patchBrandA11y();
      syncDockTooltips();
    });
  },
  { immediate: true },
);

watch(placement, (edge) => {
  if (!isNarrow.value) {
    lastWidePlacement.value = edge;
    persistSiteDockPlacement(edge);
  } else if (edge === 'top' || edge === 'bottom') {
    persistSiteDockPlacement(edge);
  }
});

watch(isNarrow, (narrow) => {
  if (narrow) hideVisibleDockTooltips();
  void nextTick(() => {
    patchBrandA11y();
    syncDockTooltips();
  });
});

watch(brandTooltip, () => {
  void nextTick(() => syncDockTooltips());
});

onMounted(() => {
  if (!isNarrow.value) {
    lastWidePlacement.value = placement.value;
  } else {
    try {
      const stored = localStorage.getItem(LABS_DOCK_STORAGE_KEY);
      if (stored === 'left' || stored === 'right' || stored === 'top' || stored === 'bottom') {
        lastWidePlacement.value = stored;
      }
    } catch {
      /* ignore */
    }
  }

  const el = dockEl.value;
  if (el instanceof HTMLElement) {
    el.addEventListener('click', onDockClick);
    el.addEventListener('click', onBrandCapture, true);
  }

  void nextTick(() => {
    patchBrandA11y();
    syncDockTooltips();
  });
});

onUnmounted(() => {
  const el = dockEl.value;
  if (el instanceof HTMLElement) {
    el.removeEventListener('click', onDockClick);
    el.removeEventListener('click', onBrandCapture, true);
  }
  if (typeof document === 'undefined') return;
  document.documentElement.removeAttribute('data-labs-dock');
});
</script>

<template>
  <VdDock
    :ref="setDockRef"
    class="vd-site-dock labs-site-dock"
    v-model:placement="placement"
    position="fixed"
    cycle="edges"
    persist
    :storage-key="LABS_DOCK_STORAGE_KEY"
    :radius="LABS_DOCK_RADIUS"
    :item-layout="itemLayout"
    tint-mode="surface"
    :tint="dockTint"
    label="Site"
  >
    <template #brand>
      <LabsBrandMark size="var(--vd-dock-brand-size)" class="vd-site-dock-brand-mark" />
    </template>

    <button
      v-for="link in links"
      :key="link.id"
      type="button"
      class="vd-dock-item"
      :class="{ 'is-active': activeId === link.id }"
      :aria-current="activeId === link.id ? 'page' : undefined"
      :aria-label="link.label"
      :data-tooltip="showDockTooltips ? link.label : undefined"
      v-bind="dockTooltipBind"
    >
      <i
        :class="activeId === link.id ? `ph-fill ph-${link.icon}` : `ph ph-${link.icon}`"
        aria-hidden="true"
      ></i>
      <span class="vd-dock-label">{{ link.label }}</span>
    </button>

    <template v-if="isNarrow">
      <span class="vd-site-dock-strip-divider" aria-hidden="true"></span>
      <VdThemeSwitcher :menu="false" />
      <LabsThemeCustomizer :tooltip-placement="themeTooltipPlacement" />
    </template>

    <template #actions>
      <a
        class="labs-dock-github"
        href="https://github.com/vanduo-oss/labs"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Open Vanduo Labs GitHub repository"
        :data-tooltip="showDockTooltips ? 'GitHub' : undefined"
        v-bind="dockTooltipBind"
      >
        <i class="ph-bold ph-github-logo" aria-hidden="true"></i>
      </a>
      <template v-if="!isNarrow">
        <VdThemeSwitcher :menu="false" />
        <LabsThemeCustomizer :tooltip-placement="themeTooltipPlacement" />
      </template>
    </template>
  </VdDock>
</template>
