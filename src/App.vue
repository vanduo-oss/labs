<script setup>
import { computed, nextTick, onMounted, onBeforeUnmount, ref, watch } from 'vue';
import {
  VdButton,
  VdCard,
  VdIcon,
  VdModal,
  VdNavbar,
  VdThemeSwitcher,
} from '@vanduo-oss/vd3';
import { NeptuneSearch, NeptuneSearchUI, VD_NEPTUNE_SEARCH_VERSION } from '../neptune-search.js';
import { AiChat, AiChatUI, VD_AI_CHAT_VERSION } from '../ai-chat.js';
import { labsMarkdownToHtml } from '../labs-md-to-html.js';

const DEMO_SLUGS = new Set(['neptune', 'aichat']);
const ROUTES = ['home', 'about', 'demos'];
const LABS_DEMOS_DISCLAIMER_KEY = 'vanduo-labs-demos-disclaimer-v1';
const LOCAL_DOCS_PORT = '65349';

const COMPONENT_VERSION_MAP = {
  neptune: VD_NEPTUNE_SEARCH_VERSION,
  aichat: VD_AI_CHAT_VERSION,
};

const route = ref('home');
const demoSlug = ref(null);
const disclaimerOpen = ref(false);
const docHtml = ref('');
const docLoading = ref(false);
const docError = ref('');
const liveRegionText = ref('');

const searchMount = ref(null);
const chatMount = ref(null);

const docHtmlCache = { neptune: null, aichat: null };
let docLoadSeq = 0;
let searchUi = null;
let chatUi = null;
let lastTopLevelRoute = 'home';

const neptuneVersion = computed(() => `v${COMPONENT_VERSION_MAP.neptune}`);
const aichatVersion = computed(() => `v${COMPONENT_VERSION_MAP.aichat}`);

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
    return { route: nextRoute, demoSlug: nextDemo };
  }
  if (!ROUTES.includes(nextRoute)) nextRoute = 'home';
  return { route: nextRoute, demoSlug: null };
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
    slug === 'neptune' ? '/doc/vd-neptune-search.md' : '/doc/vd-ai-chat.md';
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
      'Documentation could not be loaded. Check that <code>doc/vd-neptune-search.md</code> and <code>doc/vd-ai-chat.md</code> are present, serve this folder over HTTP (not file://), then refresh.';
    console.warn('[labs]', err);
  } finally {
    if (seq === docLoadSeq) docLoading.value = false;
  }
}

function applyLabsRoute(nextRoute, nextDemoSlug) {
  if (nextRoute !== 'demos') closeDisclaimer();

  const routeChanged = lastTopLevelRoute !== nextRoute;
  lastTopLevelRoute = nextRoute;
  route.value = nextRoute;
  demoSlug.value = nextRoute === 'demos' ? nextDemoSlug : null;

  if (routeChanged) window.scrollTo(0, 0);

  if (nextRoute === 'demos') {
    maybeOpenDemosDisclaimer();
    if (nextDemoSlug) {
      liveRegionText.value =
        (nextDemoSlug === 'neptune' ? 'vd-neptune-search' : 'vd-ai-chat') +
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
  }
}

function syncLabsRouteFromHash() {
  let parsed = parseLabsHash();
  if (!location.hash) {
    history.replaceState(null, '', '#home');
    parsed = { route: 'home', demoSlug: null };
  }
  applyLabsRoute(parsed.route, parsed.demoSlug);
}

function selectDemo(slug) {
  const parsed = parseLabsHash();
  if (parsed.route === 'demos' && parsed.demoSlug === slug) {
    location.hash = '#demos';
    return;
  }
  location.hash = `#demos/${slug}`;
}

function docsBaseUrl() {
  return location.hostname === 'localhost' || location.hostname === '127.0.0.1'
    ? `http://localhost:${LOCAL_DOCS_PORT}`
    : 'https://vanduo.dev';
}

onMounted(() => {
  const search = new NeptuneSearch({
    indexUrl: '/data/search-index.json',
    vectorsUrl: '/data/vectors.json',
  });
  const baseUrl = docsBaseUrl();
  searchUi = new NeptuneSearchUI({
    container: searchMount.value,
    search,
    placeholder: 'Search Vanduo docs...',
    baseUrl,
    onResultClick: (result) => {
      window.open(`${baseUrl}/#${result.doc.route}`, '_blank', 'noopener,noreferrer');
    },
  });
  searchUi.mount();

  const chat = new AiChat();
  chatUi = new AiChatUI({
    container: chatMount.value,
    chat,
  });
  chatUi.mount();

  window.addEventListener('hashchange', syncLabsRouteFromHash);
  syncLabsRouteFromHash();
});

onBeforeUnmount(() => {
  window.removeEventListener('hashchange', syncLabsRouteFromHash);
  searchUi = null;
  chatUi = null;
});

watch(demoSlug, (slug) => {
  if (route.value === 'demos' && slug) {
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
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 100 100"
            width="2.2em"
            height="2.2em"
            style="margin-right: 0.2em; flex-shrink: 0; transform: translateY(-0.05em)"
          >
            <style>
              .hero-atom-orbit {
                fill: none;
                stroke: var(--vd-color-primary);
                stroke-width: 6;
                stroke-linecap: round;
                stroke-linejoin: round;
                opacity: 0.9;
              }
              .hero-atom-core {
                fill: var(--vd-color-primary);
              }
              .hero-atom-core-ring {
                fill: rgba(var(--vd-color-primary-rgb), 0.18);
                stroke: var(--vd-color-primary);
                stroke-width: 3;
              }
              .hero-atom-spin {
                transform-origin: 50px 50px;
                animation: hero-atom-spin 12s linear infinite;
              }
              .hero-atom-spin-reverse {
                transform-origin: 50px 50px;
                animation: hero-atom-spin-reverse 9s linear infinite;
              }
              @keyframes hero-atom-spin {
                from {
                  transform: rotate(0deg);
                }
                to {
                  transform: rotate(360deg);
                }
              }
              @keyframes hero-atom-spin-reverse {
                from {
                  transform: rotate(360deg);
                }
                to {
                  transform: rotate(0deg);
                }
              }
            </style>
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
        <p class="vd-text-lg vd-text-muted">
          We are not yet building
          <a
            href="https://en.wikipedia.org/wiki/GLaDOS"
            class="hero-wiki-link"
            rel="noopener noreferrer"
            title="GLaDOS — Wikipedia (article)"
            >GLaDOS</a
          >, but we might soon…
          <span class="vd-text-sm hero-wiki-cite">
            (<a href="https://en.wikipedia.org/wiki/GLaDOS" rel="noopener noreferrer">Wikipedia</a>)
          </span>
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
          <VdCard class="vd-card-glow vd-glass labs-about-card">
            <p class="labs-about-pill">
              <VdIcon name="flask" aria-hidden="true" /> Experimental by design
            </p>
            <h2 class="labs-about-title">A small playground for curious builds</h2>
            <p class="labs-about-lede">
              Vanduo Labs is where we ship ideas before they are polished—interactive demos, odd
              widgets, and half-serious prototypes that might graduate into the framework, or might
              just make us smile. Most demos are not guaranteed stable; that is the point. Some
              components, like <code>vd-neptune-search</code>, are experimental prototypes that may
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
              <span class="labs-demo-card-title">vd-neptune-search</span>
              <span class="labs-demo-card-desc" id="labs-card-neptune-desc"
                >In-browser hybrid fuzzy + semantic search for documentation—no server required</span
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
              <span class="labs-demo-card-title">vd-ai-chat</span>
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
            class="labs-demos-detail vd-card-glow vd-glass"
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
                    ? 'vd-neptune-search'
                    : demoSlug === 'aichat'
                      ? 'vd-ai-chat'
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
                  <div id="search-mount" ref="searchMount"></div>
                </div>
                <div
                  class="labs-demo-panel-inner"
                  id="labs-demo-aichat"
                  :hidden="demoSlug !== 'aichat'"
                >
                  <div id="chat-mount" ref="chatMount"></div>
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
