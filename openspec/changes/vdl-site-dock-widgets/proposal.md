# Change: Labs Oola dock + vdl-cbun widgets

## Why
Move Labs shell to the docs-style VdDock and host vdl-cbun widget demos under `#widgets/*` with local `@vanduo-oss/vdl-cbun`.

## Dependency note (blocker until publish)
`package.json` keeps `"@vanduo-oss/vdl-cbun": "link:../vdl-cbun"` because the package is not on the npm registry yet. Local install stays on `link:` + `vite.config.js` aliases into `../vdl-cbun/dist`. After `@vanduo-oss/vdl-cbun` publishes, replace `link:` with a semver pin and drop the temporary aliases if exports resolve cleanly.

## Specs
- `vdl-site-dock` — fixed dock, `vdl-site-dock` storage, `data-labs-dock`, Widgets nav
- `vdl-widgets` — hash routes + landing previews
- Updates: `vdl-theme-customizer` (RADIUS 0.5, lock font/radius), `vdl-tools-nav` (Widgets item, vd3-charts)
