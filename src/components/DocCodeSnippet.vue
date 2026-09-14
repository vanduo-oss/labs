<script setup>
import { VdCodeSnippet } from '@vanduo-oss/vd3';
import { highlightCode } from '../utils/highlight.js';

defineProps({
  html: { type: String, default: undefined },
  css: { type: String, default: undefined },
  js: { type: String, default: undefined },
  shell: { type: String, default: undefined },
  vue: { type: String, default: undefined },
  defaultOpen: { type: Boolean, default: false },
  toggleLabel: { type: String, default: 'View Code' },
});
</script>

<template>
  <VdCodeSnippet v-bind="$props" :highlight="highlightCode" />
</template>
