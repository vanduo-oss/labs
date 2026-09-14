# vdl-widgets Specification

## Purpose
Document Labs hash routes for `@vanduo-oss/vdl-cbun` widget demos and the Widgets landing with live previews.

## Requirements
### Requirement: Widgets hash routes
The Labs SPA (no vue-router) MUST support `#widgets` and nested `#widgets/draw`, `#widgets/hex`, `#widgets/code-editor`, and `#widgets/music-player`.

#### Scenario: Nested draw route mounts VdDraw
- **WHEN** a user opens `#widgets/draw` with the app unlocked
- **THEN** a real `VdDraw` instance from `@vanduo-oss/vdl-cbun/draw` is mounted

#### Scenario: Nested hex route mounts VdHexGrid
- **WHEN** a user opens `#widgets/hex` with the app unlocked
- **THEN** a real `VdHexGrid` instance from `@vanduo-oss/vdl-cbun/hex-grid` is mounted

#### Scenario: Nested code-editor route mounts VdCodeEditor
- **WHEN** a user opens `#widgets/code-editor` with the app unlocked
- **THEN** a real `VdCodeEditor` instance from `@vanduo-oss/vdl-cbun/code-editor` is mounted

#### Scenario: Nested music-player route mounts VdMusicPlayer
- **WHEN** a user opens `#widgets/music-player` with the app unlocked
- **THEN** a real `VdMusicPlayer` instance from `@vanduo-oss/vdl-cbun/music-player` is mounted

### Requirement: Widgets landing previews
`#widgets` MUST show four live preview cards linking to the nested widget hashes.

#### Scenario: Landing links to nested widgets
- **WHEN** a user views `#widgets`
- **THEN** links to `#widgets/draw`, `#widgets/hex`, `#widgets/code-editor`, and `#widgets/music-player` are available
