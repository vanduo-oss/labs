/**
 * Remap vd3 theme localStorage keys from `vanduo-*` → `vdl-*` for Labs.
 *
 * `@vanduo-oss/vd3` hardcodes `vanduo-*` keys. Labs shares the GitHub Pages
 * origin with Vanduo docs, so those keys would collide. This helper wraps
 * localStorage get/set/remove for the six theme keys only — it does not
 * migrate or delete existing `vanduo-*` values.
 */

export const VDL_THEME_STORAGE_KEYS = Object.freeze({
  'vanduo-palette': 'vdl-palette',
  'vanduo-primary-color': 'vdl-primary-color',
  'vanduo-neutral-color': 'vdl-neutral-color',
  'vanduo-radius': 'vdl-radius',
  'vanduo-theme-preference': 'vdl-theme-preference',
  'vanduo-font-preference': 'vdl-font-preference',
});

const INSTALL_FLAG = '__vdlThemeStorageInstalled';
const installedTargets = new WeakSet();

/**
 * Install the Labs theme storage remap. Safe to call multiple times.
 * Must run before any vd3 theme preference load/persist.
 *
 * @param {Storage} [storage]
 * @returns {boolean} true if this call installed the remap
 */
export function installVdlThemeStorage(
  storage = typeof window !== 'undefined' ? window.localStorage : null,
) {
  if (!storage || typeof storage.getItem !== 'function') return false;
  if (installedTargets.has(storage)) return false;
  if (typeof window !== 'undefined' && storage === window.localStorage && window[INSTALL_FLAG]) {
    return false;
  }

  const originalGetItem = storage.getItem.bind(storage);
  const originalSetItem = storage.setItem.bind(storage);
  const originalRemoveItem = storage.removeItem.bind(storage);

  storage.getItem = (key) => {
    const mapped = VDL_THEME_STORAGE_KEYS[key];
    return originalGetItem(mapped || key);
  };

  storage.setItem = (key, value) => {
    const mapped = VDL_THEME_STORAGE_KEYS[key];
    return originalSetItem(mapped || key, value);
  };

  storage.removeItem = (key) => {
    const mapped = VDL_THEME_STORAGE_KEYS[key];
    return originalRemoveItem(mapped || key);
  };

  installedTargets.add(storage);
  if (typeof window !== 'undefined' && storage === window.localStorage) {
    try {
      Object.defineProperty(window, INSTALL_FLAG, {
        value: true,
        configurable: true,
        enumerable: false,
        writable: false,
      });
    } catch {
      window[INSTALL_FLAG] = true;
    }
  }
  return true;
}
