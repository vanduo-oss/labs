<script setup>
import { ref } from 'vue';
import { VdCodeEditor } from '@vanduo-oss/vdl-cbun/code-editor';

const code = ref(`<script setup>
import { ref } from "vue";

const count = ref(0);
const increment = () => {
  count.value++;
};
<\/script>

<template>
  <button type="button" @click="increment">
    Count is: {{ count }}
  </button>
</template>
`);
</script>

<template>
  <div class="cbun-code-wrap">
    <VdCodeEditor
      v-model="code"
      language="vue"
      :auto-close="true"
      :highlight-active-line="true"
    />
  </div>
</template>

<style scoped>
.cbun-code-wrap {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  border-radius: var(--vd-card-border-radius, var(--card-border-radius));
  overflow: hidden;
  clip-path: inset(0 round var(--vd-card-border-radius, var(--card-border-radius, 0.5rem)));
  --vd-code-editor-radius: var(--vd-card-border-radius, var(--card-border-radius));
}

.cbun-code-wrap :deep(.vd-code-editor) {
  flex: 1 1 auto;
  width: 100%;
  height: 100%;
  min-height: 0;
  border-radius: var(--vd-card-border-radius, var(--card-border-radius));
  overflow: hidden;
}
</style>
