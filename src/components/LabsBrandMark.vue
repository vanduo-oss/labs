<script setup>
/**
 * Atom mark + “vanduo labs” wordmark for the site dock brand slot.
 * Vertical edges hide the wordmark via CSS (logo only).
 */
defineProps({
  size: { type: String, default: 'var(--vd-dock-brand-size)' },
});
</script>

<template>
  <span class="labs-site-dock-brand-mark" :style="{ '--labs-brand-size': size }">
    <svg
      class="labs-dock-atom-icon"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      aria-hidden="true"
    >
      <g class="labs-dock-atom-spin">
        <g
          fill="none"
          stroke="currentColor"
          stroke-width="6"
          stroke-linecap="round"
          stroke-linejoin="round"
          opacity="0.9"
        >
          <ellipse cx="50" cy="50" rx="31" ry="13"></ellipse>
          <g transform="rotate(60 50 50)">
            <ellipse cx="50" cy="50" rx="31" ry="13"></ellipse>
          </g>
          <g transform="rotate(-60 50 50)">
            <ellipse cx="50" cy="50" rx="31" ry="13"></ellipse>
          </g>
        </g>
      </g>
      <circle
        cx="50"
        cy="50"
        r="10"
        fill="rgba(var(--vd-color-primary-rgb), 0.18)"
        stroke="currentColor"
        stroke-width="3"
      ></circle>
      <circle cx="50" cy="50" r="5.5" fill="currentColor"></circle>
    </svg>
    <span class="labs-dock-brand-title">
      <span class="hero-title-brand">vanduo</span>&nbsp;<span class="vd-text-muted">labs</span>
    </span>
  </span>
</template>

<style scoped>
.labs-site-dock-brand-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4em;
  line-height: 0;
  color: var(--vd-dock-ink, var(--vd-dock-tint, var(--vd-color-primary)));
  font-family: 'Zen Dots', sans-serif;
  text-transform: lowercase;
}

.labs-dock-atom-icon {
  width: var(--labs-brand-size, 2rem);
  height: var(--labs-brand-size, 2rem);
  flex-shrink: 0;
  display: block;
  line-height: 0;
}

.labs-dock-brand-title {
  white-space: nowrap;
  font-size: 1.05rem;
  line-height: 1;
  display: inline-flex;
  align-items: center;
}
</style>
