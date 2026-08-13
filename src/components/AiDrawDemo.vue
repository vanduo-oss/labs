<template>
  <div class="ai-draw-demo-page">
    <header class="demo-header" style="padding: 2rem 1.5rem 1rem; text-align: center">
      <h1
        style="
          font-size: 2rem;
          font-weight: 700;
          color: var(--color-primary);
          margin-bottom: 0.5rem;
        "
      >
        AI Draw (WebGPU)
      </h1>
      <p style="color: var(--text-muted); max-width: 36rem; margin: 0 auto 1rem">
        In-browser vector drawing canvas with Gemma 4 tool calling. Fully private, FOSS guardrails
        enforced.
      </p>
    </header>

    <div style="max-width: min(76rem, 100%); margin: 0 auto; padding: 0 1.5rem 2rem">
      <VdlAiDrawUI />
    </div>
  </div>
</template>

<script setup>
import VdlAiDrawUI from './VdlAiDrawUI.vue';
</script>
