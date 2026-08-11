## 1. Storage remap

- [x] 1.1 Add Labs helper that remaps the six vd3 theme localStorage keys from `vanduo-*` to `vdl-*` (get/set/remove only; no migration that deletes docs keys)
- [x] 1.2 Install the remap in `src/main.js` before `createApp` / `VanduoVue` mount

## 2. UI integration

- [x] 2.1 Mount `VdThemeCustomizer` in `App.vue` navbar actions beside `VdThemeSwitcher` with `:show-palette="false"` (Open Color only)
- [x] 2.2 Align customizer trigger styling with existing Labs navbar action controls in `labs.css`

## 3. Docs and verification

- [x] 3.1 Add a brief README note about theme customizer + `vdl-*` storage keys
- [x] 3.2 Add a focused Playwright unit test for the storage remap
- [x] 3.3 Run the focused unit test / `pnpm test` subset and confirm preferences persist under `vdl-*`

## 4. Global theme defaults

- [x] 4.1 Set Labs `themeDefaults` (Open Sans / Neutral / radius `0.25`, Open Color) via `VanduoVue` so new visitors get them when no `vdl-*` preference is stored
- [x] 4.2 Document defaults in README; assert default tokens in the unit test
