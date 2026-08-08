<script setup>
import { computed, nextTick, onMounted, onBeforeUnmount, ref, watch } from 'vue';
import {
  VdButton,
  VdCard,
  VdIcon,
  VdModal,
  VdNavbar,
  VdThemeCustomizer,
  VdThemeSwitcher,
} from '@vanduo-oss/vd3';
import { DEFAULT_DOCS_BASE_URL, VDL_NEPTUNE_SEARCH_VERSION } from '../neptune-search.js';
import { VDL_AI_CHAT_VERSION } from '../ai-chat.js';
import { VDL_MODEL_EVAL_VERSION } from '../model-eval.js';
import { labsMarkdownToHtml } from '../labs-md-to-html.js';
import VdlNeptuneSearchUI from './components/VdlNeptuneSearchUI.vue';
import VdlAiChatUI from './components/VdlAiChatUI.vue';
import VdlModelEvalUI from './components/VdlModelEvalUI.vue';
import {
  isGladosHomeQuote,
  nextHomeQuoteIntervalMs,
  pickNextHomeQuote,
} from './vdl-home-quotes.js';

const DEMO_SLUGS = new Set(['neptune', 'aichat']);
const TOOL_SLUGS = new Set(['model-eval']);
const ROUTES = ['home', 'about', 'demos', 'tools'];
const LABS_DEMOS_DISCLAIMER_KEY = 'vanduo-labs-demos-disclaimer-v1';
const DOCS_BASE_URL = DEFAULT_DOCS_BASE_URL;
const HOME_QUOTE_FADE_MS = 180;

const COMPONENT_VERSION_MAP = {
  neptune: VDL_NEPTUNE_SEARCH_VERSION,
  aichat: VDL_AI_CHAT_VERSION,
  'model-eval': VDL_MODEL_EVAL_VERSION,
};

const route = ref('home');
const demoSlug = ref(null);
const toolSlug = ref(null);
const disclaimerOpen = ref(false);
const docHtml = ref('');
const docLoading = ref(false);
const docError = ref('');
const liveRegionText = ref('');
/** @type {import('vue').Ref<{ id: string, text: string } | null>} */
const homeQuoteEntry = ref(null);
const homeQuoteVisible = ref(true);
const homeQuoteIsGlados = computed(() => isGladosHomeQuote(homeQuoteEntry.value));

const docHtmlCache = { neptune: null, aichat: null, 'model-eval': null };
let docLoadSeq = 0;
/** Empty until first hash sync so the initial `#home` visit advances the quote bag. */
let lastTopLevelRoute = '';
let homeQuoteTimer = null;
let homeQuoteFadeTimer = null;

function clearHomeQuoteTimers() {
  if (homeQuoteTimer != null) {
    clearTimeout(homeQuoteTimer);
    homeQuoteTimer = null;
  }
  if (homeQuoteFadeTimer != null) {
    clearTimeout(homeQuoteFadeTimer);
    homeQuoteFadeTimer = null;
  }
}

function applyHomeQuotePick(animate) {
  if (homeQuoteFadeTimer != null) {
    clearTimeout(homeQuoteFadeTimer);
    homeQuoteFadeTimer = null;
  }
  const { entry } = pickNextHomeQuote();
  if (!animate || !homeQuoteEntry.value) {
    homeQuoteEntry.value = entry;
    homeQuoteVisible.value = true;
    return;
  }
  homeQuoteVisible.value = false;
  homeQuoteFadeTimer = window.setTimeout(() => {
    homeQuoteEntry.value = entry;
    homeQuoteVisible.value = true;
    homeQuoteFadeTimer = null;
  }, HOME_QUOTE_FADE_MS);
}

function scheduleHomeQuoteTick() {
  clearTimeout(homeQuoteTimer);
  homeQuoteTimer = window.setTimeout(() => {
    applyHomeQuotePick(true);
    scheduleHomeQuoteTick();
  }, nextHomeQuoteIntervalMs());
}

function startHomeQuoteRotation() {
  clearHomeQuoteTimers();
  applyHomeQuotePick(false);
  scheduleHomeQuoteTick();
}

function stopHomeQuoteRotation() {
  clearHomeQuoteTimers();
}

const neptuneVersion = computed(() => `v${COMPONENT_VERSION_MAP.neptune}`);
const aichatVersion = computed(() => `v${COMPONENT_VERSION_MAP.aichat}`);
const modelEvalVersion = computed(() => `v${COMPONENT_VERSION_MAP['model-eval']}`);

function getComponentVersion(slug) {
  return COMPONENT_VERSION_MAP[slug] || '0.0.1';
}

function hydrateComponentVersionTokens(md, slug) {
  return md.replace(/\{\{COMPONENT_VERSION\}\}/g, getComponentVersion(slug));
}

function parseLabsHash() {
  const raw = (location.hash || '#home').replace(/^#/, '').toLowerCase();
  const segments = raw.split('/').map((s) => s.trim()).filter(Boolean);
  let nextRoute = segments[0] || 'home';
  if (nextRoute === 'demos') {
    let nextDemo = segments.length > 1 ? segments[1] : null;
    if (nextDemo && !DEMO_SLUGS.has(nextDemo)) nextDemo = null;
    return { route: nextRoute, demoSlug: nextDemo, toolSlug: null };
  }
  if (nextRoute === 'tools') {
    let nextTool = segments.length > 1 ? segments[1] : 'model-eval';
    if (!TOOL_SLUGS.has(nextTool)) nextTool = 'model-eval';
    return { route: nextRoute, demoSlug: null, toolSlug: nextTool };
  }
  if (!ROUTES.includes(nextRoute)) nextRoute = 'home';
  return { route: nextRoute, demoSlug: null, toolSlug: null };
}

function closeDisclaimer() {
  disclaimerOpen.value = false;
}

function maybeOpenDemosDisclaimer() {
  try {
    if (localStorage.getItem(LABS_DEMOS_DISCLAIMER_KEY) === '1') return;
  } catch (_e) {
    /* ignore */
  }
  disclaimerOpen.value = true;
}

function acceptDisclaimer() {
  try {
    localStorage.setItem(LABS_DEMOS_DISCLAIMER_KEY, '1');
  } catch (_e) {
    /* ignore */
  }
  closeDisclaimer();
}

async function fetchDocumentationHtml(slug) {
  if (docHtmlCache[slug]) return docHtmlCache[slug];
  const path =
    slug === 'neptune'
      ? '/doc/vdl-neptune-search.md'
      : slug === 'model-eval'
        ? '/doc/vdl-model-eval.md'
        : '/doc/vdl-ai-chat.md';
  const res = await fetch(path, { credentials: 'same-origin' });
  if (!res.ok) throw new Error(`Could not load documentation (${res.status})`);
  const md = hydrateComponentVersionTokens(await res.text(), slug);
  docHtmlCache[slug] = labsMarkdownToHtml(md);
  return docHtmlCache[slug];
}

async function loadDocumentationForSlug(slug) {
  const seq = ++docLoadSeq;
  docLoading.value = true;
  docError.value = '';
  docHtml.value = '';
  try {
    const html = await fetchDocumentationHtml(slug);
    if (seq !== docLoadSeq) return;
    docHtml.value = html;
  } catch (err) {
    if (seq !== docLoadSeq) return;
    docError.value =
      'Documentation could not be loaded. Check that <code>doc/vdl-neptune-search.md</code> and <code>doc/vdl-ai-chat.md</code> are present, serve this folder over HTTP (not file://), then refresh.';
    console.warn('[labs]', err);
  } finally {
    if (seq === docLoadSeq) docLoading.value = false;
  }
}

function applyLabsRoute(nextRoute, nextDemoSlug, nextToolSlug) {
  if (nextRoute !== 'demos') closeDisclaimer();

  const routeChanged = lastTopLevelRoute !== nextRoute;
  lastTopLevelRoute = nextRoute;
  route.value = nextRoute;
  demoSlug.value = nextRoute === 'demos' ? nextDemoSlug : null;
  toolSlug.value = nextRoute === 'tools' ? nextToolSlug : null;

  if (routeChanged) window.scrollTo(0, 0);

  if (nextRoute === 'home') {
    if (routeChanged) startHomeQuoteRotation();
  } else if (routeChanged) {
    stopHomeQuoteRotation();
  }

  if (nextRoute === 'demos') {
    maybeOpenDemosDisclaimer();
    if (nextDemoSlug) {
      liveRegionText.value =
        (nextDemoSlug === 'neptune' ? 'vdl-neptune-search' : 'vdl-ai-chat') +
        ' demo and documentation opened.';
      loadDocumentationForSlug(nextDemoSlug);
      nextTick(() => {
        document.getElementById('labs-demos-detail')?.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
        });
      });
    } else {
      liveRegionText.value = '';
      docHtml.value = '';
      docError.value = '';
      docLoading.value = false;
    }
  } else if (nextRoute === 'tools') {
    liveRegionText.value = 'vdl-model-eval tool and documentation opened.';
    loadDocumentationForSlug(nextToolSlug || 'model-eval');
  }
}

function syncLabsRouteFromHash() {
  let parsed = parseLabsHash();
  if (!location.hash) {
    history.replaceState(null, '', '#home');
    parsed = { route: 'home', demoSlug: null, toolSlug: null };
  }
  applyLabsRoute(parsed.route, parsed.demoSlug, parsed.toolSlug);
}

function selectDemo(slug) {
  const parsed = parseLabsHash();
  if (parsed.route === 'demos' && parsed.demoSlug === slug) {
    location.hash = '#demos';
    return;
  }
  location.hash = `#demos/${slug}`;
}

onMounted(() => {
  window.addEventListener('hashchange', syncLabsRouteFromHash);
  syncLabsRouteFromHash();
});

onBeforeUnmount(() => {
  window.removeEventListener('hashchange', syncLabsRouteFromHash);
  stopHomeQuoteRotation();
});

watch(demoSlug, (slug) => {
  if (route.value === 'demos' && slug) {
    loadDocumentationForSlug(slug);
  }
});

watch(toolSlug, (slug) => {
  if (route.value === 'tools' && slug) {
    loadDocumentationForSlug(slug);
  }
});
</script>

<template>
  <VdNavbar variant="glass" position="fixed" class="vd-glass-contrast">
    <template #brand>
      <div class="vd-navbar-brand-wrap">
        <a href="#home" class="navbar-brand-title" aria-label="Vanduo Labs home">
          <svg
            class="navbar-atom-icon"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 100 100"
            width="1.35em"
            height="1.35em"
            aria-hidden="true"
          >
            <g
              fill="none"
              stroke="var(--vd-color-primary)"
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
            <circle
              cx="50"
              cy="50"
              r="10"
              fill="rgba(var(--vd-color-primary-rgb), 0.18)"
              stroke="var(--vd-color-primary)"
              stroke-width="3"
            ></circle>
            <circle cx="50" cy="50" r="5.5" fill="var(--vd-color-primary)"></circle>
          </svg>
          <span class="navbar-brand-title-text">
            <span class="hero-title-brand">vanduo</span>&nbsp;<span class="vd-text-muted">labs</span>
          </span>
        </a>
      </div>
    </template>

    <ul class="vd-navbar-nav">
      <li>
        <a href="#home" class="vd-nav-link" :class="{ active: route === 'home' }">Home</a>
      </li>
      <li>
        <a href="#about" class="vd-nav-link" :class="{ active: route === 'about' }">About</a>
      </li>
      <li>
        <a href="#demos" class="vd-nav-link" :class="{ active: route === 'demos' }">Demos</a>
      </li>
      <li>
        <a href="#tools" class="vd-nav-link" :class="{ active: route === 'tools' }">Tools</a>
      </li>
    </ul>

    <template #actions>
      <a
        class="dark-mode-toggle"
        href="https://github.com/vanduo-oss/labs"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Open Vanduo Labs GitHub repository"
        title="View source on GitHub"
      >
        <VdIcon name="github-logo" />
      </a>
      <VdThemeCustomizer class="vdl-theme-customizer" :show-palette="false" />
      <VdThemeSwitcher :menu="false" />
    </template>
  </VdNavbar>

  <main :data-labs-route="route" style="padding-top: 80px">
    <div
      class="labs-view labs-view-home"
      data-labs-panel="home"
      :aria-hidden="route === 'home' ? 'false' : 'true'"
      :inert="route !== 'home'"
    >
      <section class="hero">
        <h2
          class="hero-title"
          style="color: var(--color-primary); display: flex; align-items: center; justify-content: center"
        >
          <svg
            class="hero-atom-icon"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 100 100"
            width="2.2em"
            height="2.2em"
            aria-hidden="true"
          >
            <g class="hero-atom-spin">
              <ellipse class="hero-atom-orbit" cx="50" cy="50" rx="31" ry="13"></ellipse>
            </g>
            <g transform="rotate(60 50 50)">
              <g class="hero-atom-spin-reverse">
                <ellipse class="hero-atom-orbit" cx="50" cy="50" rx="31" ry="13"></ellipse>
              </g>
            </g>
            <g transform="rotate(-60 50 50)">
              <ellipse class="hero-atom-orbit" cx="50" cy="50" rx="31" ry="13"></ellipse>
            </g>
            <circle class="hero-atom-core-ring" cx="50" cy="50" r="10"></circle>
            <circle class="hero-atom-core" cx="50" cy="50" r="5.5"></circle>
          </svg>
          <span class="hero-title-brand">vanduo</span>&nbsp;<span class="vd-text-muted">labs</span>
        </h2>
        <p
          class="vd-text-lg vd-text-muted hero-home-quote"
          :class="{ 'hero-home-quote-fading': !homeQuoteVisible }"
          aria-live="polite"
        >
          <template v-if="homeQuoteIsGlados">
            We are not yet building
            <a
              href="https://en.wikipedia.org/wiki/GLaDOS"
              class="hero-wiki-link"
              rel="noopener noreferrer"
              title="GLaDOS — Wikipedia (article)"
              >GLaDOS</a
            >, but we might soon…
          </template>
          <template v-else-if="homeQuoteEntry">{{ homeQuoteEntry.text }}</template>
        </p>
      </section>
    </div>

    <div
      class="labs-view labs-view-about"
      data-labs-panel="about"
      :aria-hidden="route === 'about' ? 'false' : 'true'"
      :inert="route !== 'about'"
    >
      <div class="vd-container-responsive labs-main">
        <section id="labs-about" class="labs-section">
          <VdCard class="vdl-card-glow vd-glass labs-about-card">
            <p class="labs-about-pill">
              <VdIcon name="flask" aria-hidden="true" /> Experimental by design
            </p>
            <h2 class="labs-about-title">A small playground for curious builds</h2>
            <p class="labs-about-lede">
              Vanduo Labs is where we ship ideas before they are polished—interactive demos, odd
              widgets, and half-serious prototypes that might graduate into the framework, or might
              just make us smile. Most demos are not guaranteed stable; that is the point. Some
              components, like <code>vdl-neptune-search</code>, are experimental prototypes that may
              graduate into the framework.
            </p>
            <div class="labs-about-grid">
              <div class="labs-about-tile">
                <h3>
                  <VdIcon name="test-tube" aria-hidden="true" />
                  <span>Try things</span>
                </h3>
                <p class="vd-text-muted">
                  Grids, search, and UI experiments invite you to click, drag, and break assumptions
                  safely. If something misbehaves, we have learned something useful.
                </p>
              </div>
              <div class="labs-about-tile">
                <h3>
                  <VdIcon name="sparkle" aria-hidden="true" />
                  <span>Fun is a feature</span>
                </h3>
                <p class="vd-text-muted">
                  We keep the tone light on purpose: exploration should feel inviting, not like
                  reading a spec sheet. The GLaDOS jokes are optional; the curiosity is not.
                </p>
              </div>
            </div>
            <div class="labs-about-cta">
              <a href="#demos" class="vd-btn vd-btn-outline">Open live demos</a>
              <span class="labs-about-cta-note vd-text-sm vd-text-muted"
                >Hybrid search, AI chat, and whatever we wire up next.</span
              >
            </div>
          </VdCard>
        </section>
      </div>
    </div>

    <div
      class="labs-view labs-view-demos"
      data-labs-panel="demos"
      :aria-hidden="route === 'demos' ? 'false' : 'true'"
      :inert="route !== 'demos'"
    >
      <div class="vd-container-responsive labs-main">
        <section id="labs-demos" class="labs-section" aria-label="Component demos">
          <div class="labs-demo-card-grid" role="list">
            <button
              type="button"
              class="labs-demo-card"
              id="labs-card-neptune"
              data-demo-slug="neptune"
              :class="{ 'is-selected': demoSlug === 'neptune' }"
              :aria-pressed="demoSlug === 'neptune' ? 'true' : 'false'"
              aria-controls="labs-demos-detail"
              aria-describedby="labs-card-neptune-desc"
              @click="selectDemo('neptune')"
            >
              <span class="labs-demo-card-icon" aria-hidden="true">
                <i class="ph ph-magnifying-glass" style="font-size: 3rem"></i>
              </span>
              <span class="labs-demo-card-title">vdl-neptune-search</span>
              <span class="labs-demo-card-desc" id="labs-card-neptune-desc"
                >In-browser hybrid fuzzy + semantic search over vd3 docs—no server required</span
              >
              <span class="labs-demo-card-source">Source: vanduo-oss/labs</span>
              <span class="labs-demo-card-badge-row">
                <span class="labs-demo-card-badge">Experimental</span>
                <span class="labs-demo-card-badge labs-demo-card-badge-version">{{
                  neptuneVersion
                }}</span>
              </span>
            </button>

            <button
              type="button"
              class="labs-demo-card"
              id="labs-card-aichat"
              data-demo-slug="aichat"
              :class="{ 'is-selected': demoSlug === 'aichat' }"
              :aria-pressed="demoSlug === 'aichat' ? 'true' : 'false'"
              aria-controls="labs-demos-detail"
              aria-describedby="labs-card-aichat-desc"
              @click="selectDemo('aichat')"
            >
              <span class="labs-demo-card-icon" aria-hidden="true">
                <i class="ph ph-robot" style="font-size: 3rem"></i>
              </span>
              <span class="labs-demo-card-title">vdl-ai-chat</span>
              <span class="labs-demo-card-desc" id="labs-card-aichat-desc"
                >In-browser AI chat with Gemma 4 and FOSS guardrails—no server required</span
              >
              <span class="labs-demo-card-source">Source: vanduo-oss/labs</span>
              <span class="labs-demo-card-badge-row">
                <span class="labs-demo-card-badge">Experimental</span>
                <span class="labs-demo-card-badge labs-demo-card-badge-version">{{
                  aichatVersion
                }}</span>
              </span>
            </button>
          </div>

          <p id="labs-demos-live-region" class="sr-only" role="status" aria-live="polite">
            {{ liveRegionText }}
          </p>

          <div class="labs-demo-empty" id="labs-demo-empty" :hidden="!!demoSlug">
            Choose a component above to open its live demo and documentation.
          </div>

          <VdCard
            id="labs-demos-detail"
            class="labs-demos-detail vdl-card-glow vd-glass"
            role="region"
            aria-labelledby="labs-demos-detail-title"
            :hidden="!demoSlug"
          >
            <div class="labs-demos-detail-header" id="labs-demos-detail-header">
              <span class="labs-demo-card-icon" id="labs-demos-detail-icon" aria-hidden="true">
                <i
                  v-if="demoSlug === 'neptune'"
                  class="ph ph-magnifying-glass"
                  style="font-size: 2.25rem"
                ></i>
                <i
                  v-else-if="demoSlug === 'aichat'"
                  class="ph ph-robot"
                  style="font-size: 2.25rem"
                ></i>
              </span>
              <h2 id="labs-demos-detail-title">
                {{
                  demoSlug === 'neptune'
                    ? 'vdl-neptune-search'
                    : demoSlug === 'aichat'
                      ? 'vdl-ai-chat'
                      : 'Component'
                }}
              </h2>
            </div>

            <div class="labs-detail-stack-section">
              <h3 id="labs-demo-heading">Demo</h3>
              <div id="labs-demo-panel">
                <div
                  class="labs-demo-panel-inner"
                  id="labs-demo-neptune"
                  :hidden="demoSlug !== 'neptune'"
                >
                  <VdlNeptuneSearchUI
                    v-if="demoSlug === 'neptune'"
                    :base-url="DOCS_BASE_URL"
                    placeholder="Search vd3 docs…"
                  />
                </div>
                <div
                  class="labs-demo-panel-inner"
                  id="labs-demo-aichat"
                  :hidden="demoSlug !== 'aichat'"
                >
                  <VdlAiChatUI v-if="demoSlug === 'aichat'" />
                </div>
              </div>
            </div>

            <div class="labs-detail-stack-section" aria-labelledby="labs-doc-heading">
              <h3 id="labs-doc-heading">Documentation</h3>
              <div
                id="labs-doc-panel"
                :class="{ 'labs-doc-loading': docLoading }"
              >
                <template v-if="docLoading">Loading documentation…</template>
                <p
                  v-else-if="docError"
                  class="labs-doc-error"
                  role="alert"
                  v-html="docError"
                ></p>
                <div v-else-if="docHtml" class="labs-md-prose" v-html="docHtml"></div>
              </div>
            </div>
          </VdCard>
        </section>
      </div>
    </div>

    <div
      class="labs-view labs-view-tools"
      data-labs-panel="tools"
      :aria-hidden="route === 'tools' ? 'false' : 'true'"
      :inert="route !== 'tools'"
    >
      <div class="vd-container-responsive labs-main">
        <section id="labs-tools" class="labs-section" aria-label="On-computer helper tools">
          <p class="labs-tools-lede vd-text-muted">
            On-computer helper for Labs development — not an Interactive Demo. Prefetch models locally,
            run evals, publish reports.
          </p>

          <VdCard
            id="labs-tools-detail"
            class="labs-demos-detail vdl-card-glow vd-glass"
            role="region"
            aria-labelledby="labs-tools-detail-title"
          >
            <div class="labs-demos-detail-header">
              <span class="labs-demo-card-icon" aria-hidden="true">
                <i class="ph ph-chart-bar" style="font-size: 2.25rem"></i>
              </span>
              <h2 id="labs-tools-detail-title">vdl-model-eval</h2>
              <span class="labs-demo-card-badge labs-demo-card-badge-version">{{
                modelEvalVersion
              }}</span>
            </div>

            <div class="labs-detail-stack-section">
              <h3>Report</h3>
              <VdlModelEvalUI />
            </div>

            <div class="labs-detail-stack-section" aria-labelledby="labs-tools-doc-heading">
              <h3 id="labs-tools-doc-heading">Documentation</h3>
              <div :class="{ 'labs-doc-loading': docLoading && route === 'tools' }">
                <template v-if="docLoading && route === 'tools'">Loading documentation…</template>
                <p
                  v-else-if="docError && route === 'tools'"
                  class="labs-doc-error"
                  role="alert"
                  v-html="docError"
                ></p>
                <div
                  v-else-if="docHtml && route === 'tools'"
                  class="labs-md-prose"
                  v-html="docHtml"
                ></div>
              </div>
            </div>
          </VdCard>
        </section>
      </div>
    </div>
  </main>

  <VdModal
    v-model:open="disclaimerOpen"
    title="Experimental demos"
    size="xl"
    :close-on-backdrop="false"
    glass
  >
    <p>
      Vanduo Labs hosts prototypes and demos that are <strong>not</strong> polished products. By
      continuing, you acknowledge the following:
    </p>
    <ul>
      <li>
        Demos are <strong>experimental</strong> and may change, break, or disappear without notice.
      </li>
      <li>
        Demos are provided <strong>as-is</strong>, for exploration only—not as production guidance
        or a stable API surface.
      </li>
      <li>
        There is <strong>no warranty</strong> of any kind (including fitness for a particular
        purpose).
      </li>
      <li>
        You use Labs demos <strong>at your own risk</strong>; we are not liable for any loss or
        damage arising from use.
      </li>
    </ul>
    <template #footer>
      <VdButton variant="primary" @click="acceptDisclaimer">I understand and agree</VdButton>
    </template>
  </VdModal>
</template>
