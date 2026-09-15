<script setup>
defineProps({
  title: { type: String, required: true },
  icon: { type: String, required: true },
  blurb: { type: String, required: true },
  strengths: { type: Array, required: true },
  docsHash: { type: String, required: true },
  reversed: { type: Boolean, default: false },
});
</script>

<template>
  <section class="cbun-row" :class="{ 'is-reversed': reversed }">
    <div class="cbun-row-demo">
      <div class="cbun-row-demo-stage">
        <slot />
      </div>
    </div>

    <div class="cbun-row-context">
      <h3 class="cbun-row-title">
        <i :class="`ph ph-${icon}`"></i>
        {{ title }}
      </h3>
      <p class="cbun-row-blurb vd-text-muted">{{ blurb }}</p>
      <ul class="cbun-row-strengths">
        <li v-for="item in strengths" :key="item">{{ item }}</li>
      </ul>
      <div class="cbun-row-actions">
        <a :href="docsHash" class="vd-btn vd-btn-primary">
          <i class="ph ph-book-open-text"></i>
          Open widget
        </a>
      </div>
    </div>
  </section>
</template>

<style scoped>
.cbun-row {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(0, 0.5fr);
  gap: 2rem;
  align-items: center;
  padding: 2.5rem 0;
}

.cbun-row.is-reversed {
  grid-template-columns: minmax(0, 0.5fr) minmax(0, 2fr);
}

.cbun-row.is-reversed .cbun-row-demo {
  order: 2;
}

.cbun-row.is-reversed .cbun-row-context {
  order: 1;
}

.cbun-row-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0 0 0.75rem;
  color: var(--vd-color-primary);
  font-size: 1.5rem;
}

.cbun-row-blurb {
  margin: 0 0 1rem;
  line-height: 1.6;
}

.cbun-row-strengths {
  margin: 0 0 1.25rem;
  padding-left: 1.15rem;
  line-height: 1.55;
  color: var(--vd-text-secondary);
}

.cbun-row-strengths li + li {
  margin-top: 0.35rem;
}

.cbun-row-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.cbun-row-demo {
  min-width: 0;
}

.cbun-row-demo-stage {
  display: flex;
  flex-direction: column;
  width: 100%;
  min-height: 520px;
  height: 520px;
  border-radius: var(--vd-card-border-radius, var(--card-border-radius));
  overflow: hidden;
  clip-path: inset(0 round var(--vd-card-border-radius, var(--card-border-radius, 0.5rem)));
}

.cbun-row-demo-stage > :deep(*) {
  flex: 1 1 auto;
  width: 100%;
  min-height: 0;
  height: 100%;
}

@media (max-width: 900px) {
  .cbun-row,
  .cbun-row.is-reversed {
    grid-template-columns: 1fr;
  }

  .cbun-row.is-reversed .cbun-row-demo,
  .cbun-row.is-reversed .cbun-row-context,
  .cbun-row .cbun-row-demo,
  .cbun-row .cbun-row-context {
    order: initial;
  }

  .cbun-row-context {
    order: 1;
  }

  .cbun-row-demo {
    order: 2;
    min-width: 0;
    max-width: 100%;
  }
}
</style>
