# vdl-engines-package Specification

## Purpose

Versioned npm package exporting Labs headless engines for product apps.

## Requirements

### Requirement: Subpath exports for engines

The package MUST export Neptune search, AiChat, and guardrails modules via documented subpaths.

#### Scenario: Import AiChat

- **WHEN** a consumer imports `@vanduo-oss/vdl-engines/ai-chat.js`
- **THEN** `AiChat` is available

### Requirement: Injectable Neptune library loaders

`NeptuneSearch` MUST accept optional `loadFuse` and `loadTransformers` functions that replace CDN loaders.

#### Scenario: Custom Fuse loader

- **WHEN** constructed with `{ loadFuse: async () => fuseModule, indexUrl, … }`
- **THEN** fuzzy init uses the provided loader and does not require CDN Fuse
