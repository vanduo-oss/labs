<script setup>
import { computed, ref } from 'vue';
import DocCodeSnippet from '../../components/DocCodeSnippet.vue';
import { VdCodeEditor } from '@vanduo-oss/vdl-cbun/code-editor';

const SAMPLES = {
  javascript: `// Fibonacci with memoization
function fib(n) {
  const memo = [0, 1];
  for (let i = 2; i <= n; i++) {
    memo[i] = memo[i - 1] + memo[i - 2];
  }
  return memo[n];
}

console.log(fib(10)); // 55
`,
  typescript: `interface User {
  id: number;
  name: string;
}

const greet = (u: User): string => \`Hi \${u.name}\`;
`,
  python: `import math

class Point:
    def __init__(self, x: float, y: float) -> None:
        self.x = x
        self.y = y

print(Point(0, 0))
`,
  json: `{
  "name": "@vanduo-oss/vdl-cbun",
  "version": "1.0.0"
}
`,
  vue: `<script setup>
import { ref } from "vue";
const count = ref(0);
<\/script>

<template>
  <button type="button" @click="count++">{{ count }}</button>
</template>
`,
};

const languageOptions = [
  { id: 'javascript', label: 'JavaScript' },
  { id: 'typescript', label: 'TypeScript' },
  { id: 'vue', label: 'Vue' },
  { id: 'python', label: 'Python' },
  { id: 'json', label: 'JSON' },
];

const language = ref('javascript');
const code = ref(SAMPLES.javascript);
const readOnly = ref(false);
const lineNumbers = ref(true);
const wrap = ref(false);
const autoClose = ref(true);
const tabSize = ref(2);
const highlightActiveLine = ref(true);
const showCopy = ref(true);

function onLanguageChange() {
  code.value = SAMPLES[language.value] ?? '';
}

const charCount = computed(() => code.value.length);
const lineCount = computed(() => code.value.split('\n').length);

const installShell = `# clone beside Labs, then in package.json:
# "@vanduo-oss/vdl-cbun": "link:../vdl-cbun"`;
const vue3Usage = `<script setup>
import { ref } from 'vue';
import { VdCodeEditor } from '@vanduo-oss/vdl-cbun/code-editor';
import '@vanduo-oss/vdl-cbun/code-editor/css';

const code = ref('const hello = "world";');
<\/script>

<template>
  <VdCodeEditor v-model="code" language="javascript" />
</template>`;
</script>

<template>
  <section id="code-editor" data-labs-widget="code-editor">
    <p class="vd-mb-4">
      <a href="#widgets" class="vd-text-sm">← Widgets</a>
    </p>
    <h5 class="demo-title"><i class="ph ph-code"></i> Code Editor</h5>
    <p class="vd-mb-8">
      Lightweight textarea-overlay editor from <code>@vanduo-oss/vdl-cbun/code-editor</code>.
    </p>

    <div class="vd-card vd-card-glow demo-card vd-mb-6">
      <div class="vd-card-header">
        <h6>Interactive playground</h6>
      </div>
      <div class="vd-card-body">
        <div class="ce-controls vd-mb-4">
          <label class="ce-control">
            <span>Language</span>
            <select v-model="language" class="ce-select" @change="onLanguageChange">
              <option v-for="l in languageOptions" :key="l.id" :value="l.id">{{ l.label }}</option>
            </select>
          </label>
          <label class="ce-control ce-check"><input v-model="lineNumbers" type="checkbox" /> line numbers</label>
          <label class="ce-control ce-check"><input v-model="wrap" type="checkbox" /> wrap</label>
          <label class="ce-control ce-check"><input v-model="readOnly" type="checkbox" /> read-only</label>
          <label class="ce-control ce-check"><input v-model="autoClose" type="checkbox" /> auto-close</label>
          <label class="ce-control ce-check"><input v-model="highlightActiveLine" type="checkbox" /> active line</label>
          <label class="ce-control ce-check"><input v-model="showCopy" type="checkbox" /> copy</label>
        </div>

        <VdCodeEditor
          v-model="code"
          data-testid="labs-widget-code-editor"
          :language="language"
          :read-only="readOnly"
          :line-numbers="lineNumbers"
          :wrap="wrap"
          :auto-close="autoClose"
          :tab-size="tabSize"
          :highlight-active-line="highlightActiveLine"
          :copy="showCopy"
          style="height: 340px"
        />

        <p class="vd-text-sm vd-text-muted vd-mt-3 vd-mb-0">
          Bound value: {{ charCount }} chars · {{ lineCount }} lines
        </p>
      </div>
    </div>

    <div class="vd-row vd-mb-6">
      <div class="vd-col-12 vd-col-md-6 vd-mb-6">
        <div class="vd-card demo-card">
          <div class="vd-card-header"><h6>Python</h6></div>
          <div class="vd-card-body">
            <VdCodeEditor :model-value="SAMPLES.python" language="python" style="height: 220px" />
          </div>
        </div>
      </div>
      <div class="vd-col-12 vd-col-md-6 vd-mb-6">
        <div class="vd-card demo-card">
          <div class="vd-card-header"><h6>JSON</h6></div>
          <div class="vd-card-body">
            <VdCodeEditor :model-value="SAMPLES.json" language="json" style="height: 220px" />
          </div>
        </div>
      </div>
    </div>

    <div class="vd-card demo-card">
      <div class="vd-card-body">
        <h4>Install</h4>
        <DocCodeSnippet :shell="installShell" />
        <h4 class="vd-mt-6">Usage</h4>
        <DocCodeSnippet :html="vue3Usage" :default-open="true" />
      </div>
    </div>
  </section>
</template>

<style scoped>
.ce-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-items: center;
}
.ce-control {
  display: inline-flex;
  gap: 0.4rem;
  align-items: center;
  font-size: 0.875rem;
}
.ce-select {
  padding: 0.3rem 0.5rem;
  font: inherit;
  color: var(--vd-text-primary);
  background: var(--vd-bg-primary);
  border: 1px solid var(--vd-border-color);
  border-radius: var(--vd-border-radius-md, var(--radius-md, 0.5rem));
}
</style>
