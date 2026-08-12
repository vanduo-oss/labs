<script setup>
import { ref } from 'vue';
import { useNavbarGlassScroll, VdIcon, VdThemeCustomizer, VdThemeSwitcher } from '@vanduo-oss/vd3';

const props = defineProps({
  /** Active top-level route: home | about | demos | tools */
  route: { type: String, required: true },
});

/**
 * Labs shell dogfoods package classes:
 * `.vd-navbar-fixed` + `.vd-navbar-float` + `.vd-navbar-glass`
 * (+ scroll via `useNavbarGlassScroll`). Frost / float / centering CSS ships
 * in `@vanduo-oss/vd3` — Labs only adds brand typography + always-visible
 * GitHub/theme actions (`.navbar-actions-always`).
 */
const navRef = ref(null);
const isScrolled = useNavbarGlassScroll(navRef);
const menuOpen = ref(false);

const links = [
  { label: 'Home', href: '#home', id: 'home' },
  { label: 'About', href: '#about', id: 'about' },
  { label: 'Demos', href: '#demos', id: 'demos' },
  { label: 'Tools', href: '#tools', id: 'tools' },
];

function toggleMenu() {
  menuOpen.value = !menuOpen.value;
}

function closeMenu() {
  menuOpen.value = false;
}
</script>

<template>
  <nav
    ref="navRef"
    class="vd-navbar vd-navbar-fixed vd-navbar-float vd-navbar-glass"
    :class="{ 'vd-navbar-scrolled': isScrolled }"
  >
    <div class="vd-navbar-container">
      <div class="vd-navbar-brand">
        <div class="vd-navbar-brand-wrap">
          <a
            href="#home"
            class="navbar-brand-title"
            aria-label="Vanduo Labs home"
            @click="closeMenu"
          >
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
              <span class="hero-title-brand">vanduo</span>&nbsp;<span class="vd-text-muted"
                >labs</span
              >
            </span>
          </a>
        </div>
      </div>

      <div class="navbar-actions-always">
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
      </div>

      <button
        type="button"
        class="vd-navbar-toggle"
        aria-label="Toggle navigation"
        :aria-expanded="menuOpen ? 'true' : 'false'"
        @click="toggleMenu"
      >
        <span></span><span></span><span></span>
      </button>

      <div class="vd-navbar-menu" :class="{ 'is-open': menuOpen }">
        <ul class="vd-navbar-nav">
          <li v-for="link in links" :key="link.id">
            <a
              :href="link.href"
              class="vd-nav-link"
              :class="{ active: props.route === link.id }"
              @click="closeMenu"
            >
              {{ link.label }}
            </a>
          </li>
        </ul>
      </div>
    </div>
  </nav>
</template>
