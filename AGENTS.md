# Agent instructions — vanduo labs

## OpenSpec

This repo uses [OpenSpec](https://openspec.dev) for change planning.

- Project config / context: [`openspec/config.yaml`](./openspec/config.yaml)
- Specs grow via archived changes under `openspec/specs/` (start empty; delta-first)
- Cursor slash commands: `/opsx-explore`, `/opsx-propose`, `/opsx-apply`, `/opsx-archive`
- Skills live under `.cursor/skills/openspec-*`

When proposing or implementing non-trivial changes, prefer OpenSpec (`/opsx-propose` → `/opsx-apply`) over ad-hoc large edits.

## Naming

Labs-owned UI, CSS, and product prefixes use **`vdl` / `Vdl` / `vdl-`**. Keep **`@vanduo-oss/vd3`** and its `Vd*` / `--vd-*` / `.vd-*` design-system surface unchanged.
