/**
 * Ensure Labs always paints with a resolved `data-theme` of `light` or `dark`.
 *
 * Preference may still be stored as `system` (first-visit default / Auto toggle).
 * Older `@vanduo-oss/vd3` clears `data-theme` for that preference; newer vd3
 * stamps the resolved scheme. This helper covers both and keeps `color-scheme`
 * in sync when the OS theme flips.
 */

/**
 * @param {'light' | 'dark' | 'system' | string | null | undefined} theme
 * @returns {'light' | 'dark'}
 */
export function resolveThemeScheme(theme) {
  if (theme === 'light' || theme === 'dark') return theme;
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
}

/**
 * @param {{ storagePrefix?: string, defaultTheme?: string }} [options]
 */
export function readThemePreference(options = {}) {
  const prefix = options.storagePrefix ?? 'vdl-';
  const fallback = options.defaultTheme ?? 'system';
  const key = `${prefix}theme-preference`;
  try {
    return window.localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}

/**
 * Stamp resolved light|dark on <html> from the stored preference.
 * @param {{ storagePrefix?: string, defaultTheme?: string }} [options]
 * @returns {'light' | 'dark'}
 */
export function applyResolvedTheme(options = {}) {
  if (typeof document === 'undefined') return 'light';
  const resolved = resolveThemeScheme(readThemePreference(options));
  const root = document.documentElement;
  if (root.getAttribute('data-theme') !== resolved) {
    root.setAttribute('data-theme', resolved);
  }
  if (root.style.getPropertyValue('color-scheme') !== resolved) {
    root.style.setProperty('color-scheme', resolved);
  }
  return resolved;
}

/**
 * @param {'light' | 'dark'} resolved
 */
function stampResolved(resolved) {
  const root = document.documentElement;
  if (root.getAttribute('data-theme') !== resolved) {
    root.setAttribute('data-theme', resolved);
  }
  if (root.style.getPropertyValue('color-scheme') !== resolved) {
    root.style.setProperty('color-scheme', resolved);
  }
}

/**
 * Keep DOM theme resolved for the app lifetime.
 * @param {{ storagePrefix?: string, defaultTheme?: string }} [options]
 * @returns {() => void} disposer
 */
export function installResolvedTheme(options = {}) {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return () => {};
  }

  const storageKey = `${options.storagePrefix ?? 'vdl-'}theme-preference`;

  applyResolvedTheme(options);

  const onSchemeChange = () => {
    // Only follow OS while preference is Auto/system.
    if (readThemePreference(options) === 'system') applyResolvedTheme(options);
  };

  /** @type {MediaQueryList | null} */
  let mq = null;
  if (typeof window.matchMedia === 'function') {
    mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', onSchemeChange);
  }

  // Trust an explicit light|dark stamp from vd3. If anything clears data-theme
  // (legacy system behavior) or writes "system", re-resolve from the OS — do
  // not re-read localStorage here (persist can lag behind applyPreference).
  const mo = new MutationObserver(() => {
    const current = document.documentElement.getAttribute('data-theme');
    if (current === 'light' || current === 'dark') {
      if (document.documentElement.style.getPropertyValue('color-scheme') !== current) {
        document.documentElement.style.setProperty('color-scheme', current);
      }
      return;
    }
    stampResolved(resolveThemeScheme('system'));
  });
  mo.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });

  const onStorage = (event) => {
    if (event.key === storageKey) applyResolvedTheme(options);
  };
  window.addEventListener('storage', onStorage);

  return () => {
    if (mq) mq.removeEventListener('change', onSchemeChange);
    mo.disconnect();
    window.removeEventListener('storage', onStorage);
  };
}
