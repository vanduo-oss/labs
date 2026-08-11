## Context

Labs already mounts `VdThemeSwitcher` in `App.vue` and sets `themeDefaults` via `VanduoVue` in `main.js`. `@vanduo-oss/vd3@1.2.1` hardcodes six `vanduo-*` localStorage keys inside `loadPreference` / `persistPreference` and does not expose a storage-prefix option. Labs and vd3-docs share the `vanduo-oss.github.io` origin, so those keys collide without an override. See proposal.md for motivation.

## Goals / Non-Goals

**Goals:**
- Mount `VdThemeCustomizer` next to the existing switcher in navbar actions.
- Remap the six vd3 theme storage keys to `vdl-*` before any theme preference I/O.
- Keep styling consistent with Labs navbar action controls.
- Cover the remap with a focused Playwright unit test.

**Non-Goals:**
- Forking or patching `@vanduo-oss/vd3` package sources.
- Renaming `--vd-*` CSS variables or `Vd*` component APIs.
- Migrating existing `vanduo-*` values into `vdl-*` (would steal docs prefs on shared origin).
- Changing demos/tools routing or unrelated Labs storage keys.

## Decisions

1. **localStorage method remap (not a vd3 fork)**  
   Install a small Labs helper before `createApp` that wraps `localStorage.getItem` / `setItem` / `removeItem` and redirects only the six known theme keys from `vanduo-*` → `vdl-*`. Other keys pass through unchanged.  
   *Alternatives considered:* monkey-patching exported `persistPreference`/`loadPreference` (not overrideable for the singleton path without deep hooks); waiting for an upstream `storagePrefix` API (not available in 1.2.1).

2. **Key names** — replace prefix only:  
   `vanduo-palette` → `vdl-palette`, `vanduo-primary-color` → `vdl-primary-color`, `vanduo-neutral-color` → `vdl-neutral-color`, `vanduo-radius` → `vdl-radius`, `vanduo-theme-preference` → `vdl-theme-preference`, `vanduo-font-preference` → `vdl-font-preference`.

3. **UI placement** — navbar `#actions` next to GitHub link + `VdThemeSwitcher`, with `:show-palette="false"` (vd3-supported) so Fibonacci is not exposed; light CSS so the customizer trigger matches `.dark-mode-toggle` sizing.

4. **No migration from `vanduo-*`** — Labs must not copy or delete docs keys on shared origin.

5. **Labs themeDefaults** — pass site defaults through `VanduoVue` `{ themeDefaults }` (`FONT: 'open-sans'`, `NEUTRAL: 'neutral'`, `RADIUS: '0.25'`, `PALETTE: 'open-color'`). vd3 `loadPreference` uses `localStorage.getItem(key) ?? default`, so stored `vdl-*` prefs win; defaults apply only when unset.

## Risks / Trade-offs

- [Risk] Wrapping `localStorage` methods is global for the Labs page → Mitigation: remap only the six exact theme keys; leave all other keys untouched; install once before mount.
- [Risk] Upstream vd3 may add a prefix API later → Mitigation: keep remap in one Labs module so it can be removed when upstream supports configuration.
- [Trade-off] Users who previously set theme on Labs under `vanduo-*` will not auto-migrate; they re-pick once under `vdl-*` (acceptable to protect docs prefs).

## Migration Plan

Ship with the Labs site build. No data migration. Rollback: remove customizer mount + storage helper import.
