<script setup>
import DocCodeSnippet from '../DocCodeSnippet.vue';
import CbunShowcaseRow from './CbunShowcaseRow.vue';
import CbunPreviewDraw from './CbunPreviewDraw.vue';
import CbunPreviewHex from './CbunPreviewHex.vue';
import CbunPreviewCodeEditor from './CbunPreviewCodeEditor.vue';
import CbunPreviewMusic from './CbunPreviewMusic.vue';

const entries = [
  {
    id: 'draw',
    title: 'Draw',
    icon: 'pencil-simple',
    blurb:
      'An SVG whiteboard with pressure-aware brushes, shapes, sticky notes, and export — from @vanduo-oss/vdl-cbun/draw.',
    strengths: [
      'Pressure-aware brushes for freehand sketching',
      'Shapes, sticky notes, and structured export',
      'Theme-aware chrome on --vd-* tokens',
    ],
    docsHash: '#widgets/draw',
    preview: CbunPreviewDraw,
  },
  {
    id: 'hex',
    title: 'Hex grid',
    icon: 'hexagon',
    blurb:
      'Axial hex canvases with terrain helpers and pathfinding math — @vanduo-oss/vdl-cbun/hex-grid.',
    strengths: [
      'Axial hex math with terrain helpers',
      'DPR-aware canvas and viewport culling',
      'Picks up --vd-* colors from the page theme',
    ],
    docsHash: '#widgets/hex',
    preview: CbunPreviewHex,
  },
  {
    id: 'code-editor',
    title: 'Code editor',
    icon: 'code',
    blurb:
      'Lightweight syntax-highlighted editor for playgrounds and snippets — @vanduo-oss/vdl-cbun/code-editor.',
    strengths: [
      'First-party highlighter (no highlight.js)',
      'Tokenizer-only highlight subpath',
      'Multi-language support including Vue SFC',
    ],
    docsHash: '#widgets/code-editor',
    preview: CbunPreviewCodeEditor,
  },
  {
    id: 'music-player',
    title: 'Music player',
    icon: 'music-note',
    blurb:
      'HTML5 audio with playlist, progress, and detachable floating modes — @vanduo-oss/vdl-cbun/music-player.',
    strengths: [
      'Playlist, progress, shuffle, and repeat',
      'Detachable floating playback',
      'Styled to match vd3 surfaces',
    ],
    docsHash: '#widgets/music-player',
    preview: CbunPreviewMusic,
  },
];

const installShell = `pnpm add @vanduo-oss/vdl-cbun`;
</script>

<template>
  <section id="labs-widgets" data-labs-panel="widgets-landing">
    <div class="about-header vd-mb-4">
      <h2 style="color: var(--vd-color-primary)">
        <i class="ph ph-package"></i> Widgets
      </h2>
      <p class="vd-text-lg vd-text-muted">
        Live previews from <code>@vanduo-oss/vdl-cbun</code> — draw, hex grid, code editor, and music
        player.
      </p>
    </div>

    <div class="cbun-intro vd-mb-6">
      <DocCodeSnippet :shell="installShell" toggle-label="Installation" :default-open="true" />
    </div>

    <div class="cbun-showcase">
      <CbunShowcaseRow
        v-for="(entry, index) in entries"
        :key="entry.id"
        :title="entry.title"
        :icon="entry.icon"
        :blurb="entry.blurb"
        :strengths="entry.strengths"
        :docs-hash="entry.docsHash"
        :reversed="index % 2 === 1"
      >
        <component :is="entry.preview" />
      </CbunShowcaseRow>
    </div>
  </section>
</template>

<style scoped>
.cbun-intro {
  max-width: 48rem;
}
.cbun-showcase {
  padding-bottom: 3rem;
}
</style>
