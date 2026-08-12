<script setup>
import { FAREWELL_BODY, FAREWELL_TITLE } from '../content/disclaimer.js';

const emit = defineEmits(['reread']);
</script>

<template>
  <div class="labs-farewell-page" data-testid="disclaimer-farewell">
    <div class="labs-farewell-inner">
      <i class="ph ph-hand-waving labs-farewell-icon" aria-hidden="true"></i>
      <h1 id="farewell-title">{{ FAREWELL_TITLE }}</h1>
      <p>{{ FAREWELL_BODY }}</p>
      <div class="labs-farewell-actions">
        <button
          type="button"
          class="vd-btn vd-btn-primary"
          data-testid="disclaimer-reread"
          @click="emit('reread')"
        >
          Re-read the disclaimer
        </button>
      </div>
    </div>
  </div>
</template>
