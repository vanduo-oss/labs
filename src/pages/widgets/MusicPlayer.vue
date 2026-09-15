<script setup>
import { computed, onBeforeUnmount, ref } from 'vue';
import DocCodeSnippet from '../../components/DocCodeSnippet.vue';
import { VdMusicPlayer } from '@vanduo-oss/vdl-cbun/music-player';

const base = import.meta.env.BASE_URL;

const tracks = [
  {
    name: 'Pale Blue Dot',
    url: `${base}music/Stellardrone/Invent the Universe/06 - Pale Blue Dot.mp3`,
  },
  {
    name: 'Maia Nebula',
    url: `${base}music/Stellardrone/Invent the Universe/03 - Maia Nebula.mp3`,
  },
  {
    name: 'Approaching the Heliopause',
    url: `${base}music/Stellardrone/Invent the Universe/04 - Approaching the Heliopause.mp3`,
  },
  {
    name: 'An Ocean of Galaxies',
    url: `${base}music/Stellardrone/Invent the Universe/07 - An Ocean of Galaxies.mp3`,
  },
  {
    name: 'Infinite Void',
    url: `${base}music/Stellardrone/Invent the Universe/08 - Infinite Void.mp3`,
  },
];

const showProgress = ref(true);
const showPlaylist = ref(true);
const glass = ref(false);
const detachable = ref(false);
const draggable = ref(false);
const minimizable = ref(false);
const sizeClass = ref('');

const sizeOptions = [
  { id: '', label: 'Default' },
  { id: 'vd-music-player-sm', label: 'Small' },
  { id: 'vd-music-player-lg', label: 'Large' },
  { id: 'vd-music-player-compact', label: 'Compact' },
  { id: 'vd-music-player-inline', label: 'Inline' },
];

const playgroundOptions = computed(() => ({
  showProgress: showProgress.value,
  showPlaylist: showPlaylist.value,
  glass: glass.value,
  detachable: detachable.value,
  draggable: detachable.value && draggable.value,
  minimizable: detachable.value && minimizable.value,
  floatingPosition: 'bottom-right',
}));

const playgroundRef = ref(null);
const detachRef = ref(null);
const dragRef = ref(null);
const progRef = ref(null);
const progState = ref('—');
const logEntries = ref([]);

function withPlayer(r, fn) {
  const el = r?.container?.();
  if (!r || !el) return;
  fn(r.player, el);
}

function detachCorner(corner) {
  withPlayer(detachRef.value, (p, el) => p.detach(el, corner));
}

function attachPlayer() {
  withPlayer(detachRef.value, (p, el) => p.attach(el));
}

function dragDetachMinimize() {
  withPlayer(dragRef.value, (p, el) => {
    p.detach(el, 'bottom-right');
    p.minimize(el);
  });
}

function dragExpand() {
  withPlayer(dragRef.value, (p, el) => p.expand(el));
}

function dragAttach() {
  withPlayer(dragRef.value, (p, el) => p.attach(el));
}

function playgroundDetach() {
  withPlayer(playgroundRef.value, (p, el) => p.detach(el, 'bottom-right'));
}

function playgroundAttach() {
  withPlayer(playgroundRef.value, (p, el) => p.attach(el));
}

function refreshProgState() {
  withPlayer(progRef.value, (p, el) => {
    const s = p.getState(el);
    progState.value = s
      ? `${s.isPlaying ? 'Playing' : 'Paused'} · #${s.currentIndex} ${s.currentTrack?.name ?? '—'} · vol ${(s.volume * 100).toFixed(0)}%`
      : '—';
  });
}

function prog(fn) {
  withPlayer(progRef.value, (p, el) => {
    fn(p, el);
    setTimeout(refreshProgState, 0);
  });
}

function onLogged(type, detail) {
  const time = new Date().toLocaleTimeString([], { hour12: false });
  logEntries.value.unshift({ time, type, detail });
  if (logEntries.value.length > 12) logEntries.value.length = 12;
}

function attachCleanup(r) {
  if (!r) return;
  const el = r.container?.();
  if (!el) return;
  try {
    const s = r.player.getState(el);
    if (s?.isDetached) r.player.attach(el);
  } catch {
    /* ignore */
  }
}

onBeforeUnmount(() => {
  for (const r of [playgroundRef.value, detachRef.value, dragRef.value, progRef.value]) {
    attachCleanup(r);
  }
});

const installShell = `# clone beside Labs, then in package.json:
# "@vanduo-oss/vdl-cbun": "link:../vdl-cbun"`;
const vue3Usage = `<script setup>
import { VdMusicPlayer } from '@vanduo-oss/vdl-cbun/music-player';
import '@vanduo-oss/vdl-cbun/music-player/css';

const tracks = [{ name: 'Pale Blue Dot', url: '/music/pale-blue-dot.mp3' }];
<\/script>

<template>
  <VdMusicPlayer
    :tracks="tracks"
    :options="{ showPlaylist: true, showProgress: true, detachable: true, draggable: true, minimizable: true }"
  />
</template>`;
</script>

<template>
  <section id="music-player" data-labs-widget="music-player">
    <p class="vd-mb-4">
      <a href="#widgets" class="vd-text-sm">← Widgets</a>
    </p>
    <h5 class="demo-title"><i class="ph ph-music-note"></i> Music Player</h5>
    <p class="vd-mb-8">
      HTML5 audio player from <code>@vanduo-oss/vdl-cbun/music-player</code>. Demo audio:
      Stellardrone — <em>Invent the Universe</em> (CC BY 4.0).
    </p>

    <div class="vd-card vd-card-glow demo-card vd-mb-6">
      <div class="vd-card-header">
        <h6>Interactive playground</h6>
      </div>
      <div class="vd-card-body">
        <div class="mp-controls vd-mb-4">
          <label class="mp-control">
            <span>Size</span>
            <select v-model="sizeClass" class="mp-select">
              <option v-for="s in sizeOptions" :key="s.id || 'default'" :value="s.id">{{ s.label }}</option>
            </select>
          </label>
          <label class="mp-control mp-check"><input v-model="showProgress" type="checkbox" /> progress</label>
          <label class="mp-control mp-check"><input v-model="showPlaylist" type="checkbox" /> playlist</label>
          <label class="mp-control mp-check"><input v-model="glass" type="checkbox" /> glass</label>
          <label class="mp-control mp-check"><input v-model="detachable" type="checkbox" /> detachable</label>
          <label class="mp-control mp-check">
            <input v-model="draggable" type="checkbox" :disabled="!detachable" /> draggable
          </label>
          <label class="mp-control mp-check">
            <input v-model="minimizable" type="checkbox" :disabled="!detachable" /> minimizable
          </label>
        </div>

        <VdMusicPlayer
          ref="playgroundRef"
          data-testid="labs-widget-music-player"
          :class="sizeClass"
          :tracks="tracks"
          :options="playgroundOptions"
        />

        <div v-if="detachable" class="vd-mt-4" style="display: flex; flex-wrap: wrap; gap: 0.5rem">
          <button type="button" class="vd-btn vd-btn-sm vd-btn-primary" @click="playgroundDetach">Detach</button>
          <button type="button" class="vd-btn vd-btn-sm vd-btn-secondary" @click="playgroundAttach">Attach</button>
        </div>
      </div>
    </div>

    <div class="vd-row vd-mb-6">
      <div class="vd-col-12 vd-col-md-6 vd-mb-6">
        <div class="vd-card demo-card">
          <div class="vd-card-header"><h6>Glass surface</h6></div>
          <div class="vd-card-body">
            <VdMusicPlayer :tracks="tracks" :options="{ showProgress: true, glass: true }" />
          </div>
        </div>
      </div>
      <div class="vd-col-12 vd-col-md-6 vd-mb-6">
        <div class="vd-card demo-card">
          <div class="vd-card-header"><h6>Inline + playlist</h6></div>
          <div class="vd-card-body">
            <VdMusicPlayer
              class="vd-music-player-inline"
              :tracks="tracks"
              :options="{ showProgress: true, showPlaylist: true }"
            />
          </div>
        </div>
      </div>
    </div>

    <div class="vd-row vd-mb-6">
      <div class="vd-col-12 vd-col-md-6 vd-mb-6">
        <div class="vd-card demo-card">
          <div class="vd-card-header"><h6>Detachable — fixed corners</h6></div>
          <div class="vd-card-body">
            <p class="vd-text-sm vd-text-muted vd-mb-3">
              <code>detachable: true</code>, <code>minimizable: true</code>, <code>draggable: false</code>.
            </p>
            <VdMusicPlayer
              ref="detachRef"
              :tracks="tracks"
              :options="{
                showProgress: true,
                detachable: true,
                minimizable: true,
                draggable: false,
                floatingPosition: 'bottom-right',
              }"
            />
            <div class="vd-mt-4" style="display: flex; flex-wrap: wrap; gap: 0.5rem">
              <button type="button" class="vd-btn vd-btn-sm vd-btn-primary" @click="detachCorner('bottom-left')">
                Detach bottom-left
              </button>
              <button type="button" class="vd-btn vd-btn-sm vd-btn-primary" @click="detachCorner('top-right')">
                Detach top-right
              </button>
              <button type="button" class="vd-btn vd-btn-sm vd-btn-secondary" @click="attachPlayer">Attach</button>
            </div>
          </div>
        </div>
      </div>
      <div class="vd-col-12 vd-col-md-6 vd-mb-6">
        <div class="vd-card demo-card">
          <div class="vd-card-header"><h6>Detachable — draggable</h6></div>
          <div class="vd-card-body">
            <p class="vd-text-sm vd-text-muted vd-mb-3">
              <code>draggable: true</code> adds a drag handle when floating. Free positioning overrides corner presets.
            </p>
            <VdMusicPlayer
              ref="dragRef"
              :tracks="tracks"
              :options="{
                showProgress: true,
                showPlaylist: true,
                detachable: true,
                draggable: true,
                minimizable: true,
              }"
            />
            <div class="vd-mt-4" style="display: flex; flex-wrap: wrap; gap: 0.5rem">
              <button type="button" class="vd-btn vd-btn-sm vd-btn-primary" @click="dragDetachMinimize">
                Detach &amp; minimize
              </button>
              <button type="button" class="vd-btn vd-btn-sm vd-btn-outline" @click="dragExpand">Expand</button>
              <button type="button" class="vd-btn vd-btn-sm vd-btn-secondary" @click="dragAttach">Attach</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="vd-card demo-card vd-mb-6">
      <div class="vd-card-header"><h6>Programmatic + events</h6></div>
      <div class="vd-card-body">
        <VdMusicPlayer
          ref="progRef"
          :tracks="tracks"
          :options="{ showProgress: true, showPlaylist: true }"
          @trackchange="
            (d) => {
              refreshProgState();
              onLogged('trackchange', d?.name);
            }
          "
          @play="
            () => {
              refreshProgState();
              onLogged('play');
            }
          "
          @pause="
            () => {
              refreshProgState();
              onLogged('pause');
            }
          "
          @volumechange="(d) => onLogged('volumechange', d?.volume)"
          @repeatchange="(d) => onLogged('repeatchange', d?.repeat)"
          @ended="() => onLogged('ended')"
          @detach="() => onLogged('detach')"
          @attach="() => onLogged('attach')"
          @minimize="() => onLogged('minimize')"
          @expand="() => onLogged('expand')"
        />
        <p class="vd-text-sm vd-mt-3"><strong>State:</strong> <code>{{ progState }}</code></p>
        <div style="display: flex; flex-wrap: wrap; gap: 0.5rem">
          <button type="button" class="vd-btn vd-btn-outline vd-btn-sm" @click="prog((p, el) => p.play(el))">Play</button>
          <button type="button" class="vd-btn vd-btn-outline vd-btn-sm" @click="prog((p, el) => p.pause(el))">Pause</button>
          <button type="button" class="vd-btn vd-btn-outline vd-btn-sm" @click="prog((p, el) => p.next(el))">Next</button>
          <button type="button" class="vd-btn vd-btn-outline vd-btn-sm" @click="prog((p, el) => p.previous(el))">
            Prev
          </button>
          <button type="button" class="vd-btn vd-btn-outline vd-btn-sm" @click="prog((p, el) => p.setVolume(el, 0.75))">
            Vol 75%
          </button>
        </div>
        <ul class="vd-mt-3 vd-mb-0" style="list-style: none; padding: 0; max-height: 120px; overflow: auto">
          <li v-for="(e, i) in logEntries" :key="`${e.time}-${i}`" class="vd-text-sm">
            <code>{{ e.time }}</code> {{ e.type
            }}<template v-if="e.detail != null"> · {{ e.detail }}</template>
          </li>
        </ul>
      </div>
    </div>

    <div class="vd-card demo-card">
      <div class="vd-card-body">
        <h4>Install</h4>
        <DocCodeSnippet :shell="installShell" />
        <h4 class="vd-mt-6">Usage</h4>
        <DocCodeSnippet :html="vue3Usage" :default-open="true" />
        <div class="vd-alert vd-alert-info vd-mt-6">
          <div>
            <strong>Attribution</strong>
            <p class="vd-mb-0 vd-mt-1">
              Bundled tracks from
              <a href="https://stellardrone.bandcamp.com/album/invent-the-universe" target="_blank" rel="noopener noreferrer"
                >Stellardrone — Invent the Universe</a
              >
              (CC BY 4.0).
            </p>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.mp-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-items: center;
}
.mp-control {
  display: inline-flex;
  gap: 0.4rem;
  align-items: center;
  font-size: 0.875rem;
}
.mp-select {
  padding: 0.3rem 0.5rem;
  font: inherit;
  color: var(--vd-text-primary);
  background: var(--vd-bg-primary);
  border: 1px solid var(--vd-border-color);
  border-radius: var(--vd-border-radius-md, var(--radius-md, 0.5rem));
}
</style>
