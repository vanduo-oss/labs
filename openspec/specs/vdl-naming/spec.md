# vdl-naming Specification

## Purpose
Defines the naming boundary between Labs-owned product surface (`vdl`) and the `@vanduo-oss/vd3` design system (`Vd` / `vd`).
## Requirements
### Requirement: Labs-owned surface uses vdl prefix
Labs-owned UI components, CSS class prefixes, and product module ids MUST use `vdl` / `Vdl` / `vdl-` (for example `VdlAiChatUI`, `VdlNeptuneSearchUI`, `.vdl-ai-*`, `vdl-ai-chat`).

#### Scenario: Labs Vue chat component name
- **WHEN** a consumer imports the Labs Vue AI chat UI
- **THEN** the component is named `VdlAiChatUI` (not a `Vd*` design-system name)

#### Scenario: Labs Vue search component name
- **WHEN** a consumer imports the Labs Vue Neptune search UI
- **THEN** the component is named `VdlNeptuneSearchUI`

### Requirement: vd3 design system remains Vd
`@vanduo-oss/vd3` component, token, and class APIs MUST remain `Vd*` / `--vd-*` / `.vd-*` and MUST NOT be renamed to `vdl` as part of Labs work.

#### Scenario: Shell continues to use vd3 Vd* components
- **WHEN** the Labs site shell renders design-system controls (buttons, cards, theme switcher, icons)
- **THEN** it imports and uses `@vanduo-oss/vd3` `Vd*` APIs unchanged

