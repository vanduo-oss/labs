## Context

ts-school dogfoods published packages and cannot `link:`. Headless ESM must be installable.

## Decisions

1. Single package `@vanduo-oss/vdl-engines` with subpath exports (less churn than three packages).
2. Injectable loaders on `NeptuneSearch` for Fuse/Transformers.
3. Until npm publish credentials are available, consumers MAY use `file:` path to this repo; `pnpm pack` verifies the tarball.

## Non-Goals

- Publishing Vue `Vdl*UI` components as the product API.
- Changing vd3-docs corpus content.
