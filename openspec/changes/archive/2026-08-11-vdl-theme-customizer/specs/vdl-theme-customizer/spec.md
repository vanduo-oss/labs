## Purpose

Expose vd3 theme customization on the Labs shell while persisting preferences under Labs-owned `vdl-*` localStorage keys so they do not collide with Vanduo docs on the shared GitHub Pages origin.

## ADDED Requirements

### Requirement: Theme customizer is available in the Labs shell

The Labs site shell MUST expose `@vanduo-oss/vd3`'s `VdThemeCustomizer` in a discoverable chrome location (navbar actions) without breaking existing demos/tools routing. Design-system APIs (`Vd*`, `--vd-*`, `.vd-*`) MUST remain unchanged.

#### Scenario: Customizer control is present in the navbar

- **WHEN** a user opens the Labs site
- **THEN** a theme customizer control is available in the navbar actions area alongside the existing theme switcher

#### Scenario: Customizer opens without changing route

- **WHEN** a user opens the theme customizer while on a demos or tools route
- **THEN** the hash route remains unchanged and the customizer panel can be used to adjust theme preferences

#### Scenario: Palette selector is not shown

- **WHEN** a user opens the Labs theme customizer
- **THEN** the Palette segmented control (Open Color / Fibonacci) is not shown
- **AND** the site remains on the Open Color palette

### Requirement: Theme preferences use vdl- localStorage keys

Labs MUST persist and restore vd3 theme preferences using `vdl-` prefixed localStorage keys. Labs MUST NOT write theme preferences to the default `vanduo-` keys used by Vanduo docs.

#### Scenario: Preference write uses vdl keys

- **WHEN** a user changes a theme preference via the theme switcher or customizer on Labs
- **THEN** the preference is stored under the corresponding `vdl-*` key (for example `vdl-theme-preference`, `vdl-palette`, `vdl-primary-color`, `vdl-neutral-color`, `vdl-radius`, `vdl-font-preference`)
- **AND** the corresponding `vanduo-*` key is not written by Labs theme persistence

#### Scenario: Preference restores on reload

- **WHEN** a user has previously saved Labs theme preferences under `vdl-*` keys
- **AND** the Labs site loads again
- **THEN** those preferences are applied to the document theme attributes

#### Scenario: Docs keys are not overwritten

- **WHEN** `vanduo-*` theme keys already exist in localStorage (for example from Vanduo docs)
- **AND** the Labs site loads or updates theme preferences
- **THEN** Labs theme persistence reads and writes only `vdl-*` keys and leaves existing `vanduo-*` values intact

### Requirement: Labs global theme defaults for unset preferences

Labs MUST configure vd3 `themeDefaults` so new visitors (no stored `vdl-*` preference) get Open Sans, Neutral, and radius `0.25` on the Open Color palette. Labs MUST NOT overwrite existing `vdl-*` preferences with these defaults.

#### Scenario: Defaults apply when no preference is stored

- **WHEN** a visitor loads the Labs site with no `vdl-font-preference`, `vdl-neutral-color`, or `vdl-radius` keys
- **THEN** the effective theme uses font `open-sans`, neutral `neutral`, and radius `0.25`

#### Scenario: Stored preferences override defaults

- **WHEN** a visitor already has one or more `vdl-*` theme preference keys stored
- **AND** the Labs site loads
- **THEN** those stored values are applied instead of the corresponding Labs `themeDefaults`
