<script setup>
/**
 * Mandatory terms gate. Site-local overlay (not VdModal) so Accept / Decline
 * are the only exits — Escape declines. Focus stays trapped in the panel.
 */
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import {
  DISCLAIMER_INTRO,
  DISCLAIMER_SECTIONS,
  DISCLAIMER_TITLE,
  TOC_VERSION,
} from '../content/disclaimer.js';

const emit = defineEmits(['accept', 'decline']);

const panelRef = ref(null);
const acceptRef = ref(null);
/** @type {HTMLElement | null} */
let previousFocus = null;

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

function focusableInPanel() {
  if (!panelRef.value) return [];
  return Array.from(panelRef.value.querySelectorAll(FOCUSABLE));
}

function onKeydown(event) {
  if (event.key === 'Escape') {
    event.preventDefault();
    emit('decline');
    return;
  }
  if (event.key !== 'Tab' || !panelRef.value) return;
  const nodes = focusableInPanel();
  if (nodes.length === 0) return;
  const first = nodes[0];
  const last = nodes[nodes.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

onMounted(async () => {
  previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  window.addEventListener('keydown', onKeydown);
  await nextTick();
  acceptRef.value?.focus();
});

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown);
  previousFocus?.focus();
});

watch(panelRef, async (el) => {
  if (!el) return;
  await nextTick();
  acceptRef.value?.focus();
});
</script>

<template>
  <div
    class="labs-consent-overlay"
    data-testid="disclaimer-gate"
    role="dialog"
    aria-modal="true"
    aria-labelledby="disclaimer-gate-title"
  >
    <div ref="panelRef" class="labs-consent-panel" tabindex="-1">
      <header class="labs-consent-header">
        <h1 id="disclaimer-gate-title">{{ DISCLAIMER_TITLE }}</h1>
        <p class="labs-consent-version">Terms version {{ TOC_VERSION }}</p>
        <p>{{ DISCLAIMER_INTRO }}</p>
      </header>

      <div class="labs-consent-body">
        <section
          v-for="section in DISCLAIMER_SECTIONS"
          :key="section.heading"
          class="labs-consent-section"
        >
          <h2>{{ section.heading }}</h2>
          <p>{{ section.body }}</p>
          <p v-if="section.linkHref" class="labs-consent-link">
            <a :href="section.linkHref" rel="noopener noreferrer" target="_blank">
              {{ section.linkLabel ?? section.linkHref }}
            </a>
          </p>
        </section>
      </div>

      <footer class="labs-consent-actions">
        <button
          type="button"
          class="vd-btn vd-btn-ghost-primary"
          data-testid="disclaimer-decline"
          @click="emit('decline')"
        >
          I do not accept
        </button>
        <button
          ref="acceptRef"
          type="button"
          class="vd-btn vd-btn-primary"
          data-testid="disclaimer-accept"
          @click="emit('accept')"
        >
          I understand and accept
        </button>
      </footer>
    </div>
  </div>
</template>
