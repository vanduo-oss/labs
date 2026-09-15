# vdl-theme-customizer Specification

## Purpose
Expose vd3 theme customization on the Labs shell while persisting preferences under Labs-owned `vdl-*` localStorage keys so they do not collide with Vanduo docs on the shared GitHub Pages origin.
## Requirements
### Requirement: Theme customizer is available in the Labs shell

The Labs site shell MUST expose `@vanduo-oss/vd3`'s `VdThemeCustomizer` in a discoverable chrome location (navbar actions) without breaking existing demos/tools routing. Design-system APIs (`Vd*`, `--vd-*`, `.vd-*`) MUST remain unchanged.

#### Scenario: Customizer control is present in the site dock

- **WHEN** a user opens the Labs site
- **THEN** a theme customizer control is available in the site dock actions area alongside the theme switcher

#### Scenario: Customizer opens without changing route

- **WHEN** a user opens the theme customizer while on a demos or widgets route
- **THEN** the hash route remains unchanged and the customizer panel can be used to adjust theme preferences

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

Labs MUST configure vd3 `themeDefaults` so new visitors (no stored `vdl-*` preference) get Open Sans, Neutral, radius `0.5`, and sky primary on the Open Color palette. Labs MUST NOT overwrite existing `vdl-*` preferences with these defaults.

#### Scenario: Defaults apply when no preference is stored

- **WHEN** a visitor loads the Labs site with no `vdl-font-preference`, `vdl-neutral-color`, `vdl-radius`, or `vdl-primary-color` keys
- **THEN** the effective theme uses font `open-sans`, neutral `neutral`, radius `0.5`, and primary `sky`

#### Scenario: Stored preferences override defaults

- **WHEN** a visitor already has one or more `vdl-*` theme preference keys stored
- **AND** the Labs site loads
- **THEN** those stored values are applied instead of the corresponding Labs `themeDefaults`

### Requirement: Primary-only swatches fan in the dock

The Labs theme customizer MUST use the package `variant="swatches"` fan (same interaction model as vd3-docs). Users MAY change primary color only. Palette, Neutral, Border Radius, and Font Family MUST NOT be exposed in the customizer UI. Fan direction MUST follow `html[data-labs-dock]` (bottom→up, top→down, left→right, right→left), not viewport-edge `auto`.

#### Scenario: Customizer opens as a primary fan

- **WHEN** a user activates the theme customizer trigger in the site dock
- **THEN** a hinged primary swatches fan opens (not the full panel editor)
- **AND** Palette, Neutral, Border Radius, and Font Family controls are not shown

#### Scenario: Fan direction tracks dock edge

- **WHEN** `html[data-labs-dock]` is `bottom`, `top`, `left`, or `right`
- **AND** the user opens the theme customizer fan
- **THEN** the fan opens away from the dock (`up`, `down`, `right`, or `left` respectively)

#### Scenario: Primary pick persists under vdl-

- **WHEN** a user selects a primary swatch from the fan
- **THEN** the site primary updates
- **AND** the choice is stored under `vdl-primary-color` (not `vanduo-primary-color`)
