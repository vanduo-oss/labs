<script setup>
import { computed, ref } from 'vue';
import { VdThemeCustomizer as VdThemeCustomizerBase } from '@vanduo-oss/vd3';

/**
 * Labs wrapper: hide palette (prop) and lock font + radius sections via CSS
 * (package only exposes showPalette today).
 */
const props = defineProps({
  tooltipPlacement: { type: String, default: undefined },
});

const base = ref(null);

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
    class="labs-theme-customizer"
    :show-palette="false"
    v-bind="dockTooltipBind"
  />
</template>

<style>
/* Package VdThemeCustomizer has no showFont/showRadius — lock those sections. */
.labs-theme-customizer .tc-section:has(.tc-radius-group),
.labs-theme-customizer .tc-section:has(.tc-font-select) {
  display: none !important;
}
</style>
