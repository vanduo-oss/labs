# Change: Labs Oola dock + vdl-cbun widgets

## Why
Move Labs shell to the docs-style VdDock and host vdl-cbun widget demos under `#widgets/*` with local `@vanduo-oss/vdl-cbun`.

## Dependency note (`link:` is the SoT)
`package.json` keeps `"@vanduo-oss/vdl-cbun": "link:../vdl-cbun"` — Labs `vdl-*` packages are sibling repos, not on npm. Local install stays on `link:` + `vite.config.js` aliases into `../vdl-cbun/dist`.

## Specs
- `vdl-site-dock` — fixed dock, `vdl-site-dock` storage, `data-labs-dock`, Widgets nav
- `vdl-widgets` — hash routes + landing previews
- Updates: `vdl-theme-customizer` (swatches fan, primary-only; sky / RADIUS 0.5 defaults), `vdl-tools-nav` (Widgets item, vd3-charts)
