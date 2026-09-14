<script setup>
import { onBeforeUnmount, ref } from 'vue';
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

const detachRef = ref(null);
const progRef = ref(null);
const progState = ref('—');
const logEntries = ref([]);

function detachCorner(corner) {
  const r = detachRef.value;
  const el = r?.container?.();
  if (r && el) r.player.detach(el, corner);
}

function attachPlayer() {
  const r = detachRef.value;
  const el = r?.container?.();
  if (r && el) r.player.attach(el);
}

function refreshProgState() {
  const r = progRef.value;
  const el = r?.container?.();
  if (!r || !el) return;
  const s = r.player.getState(el);
  progState.value = s
    ? `${s.isPlaying ? 'Playing' : 'Paused'} · #${s.currentIndex} ${s.currentTrack?.name ?? '—'} · vol ${(s.volume * 100).toFixed(0)}%`
    : '—';
}

function prog(fn) {
  const r = progRef.value;
  const el = r?.container?.();
  if (!r || !el) return;
  fn(r.player, el);
  setTimeout(refreshProgState, 0);
}

function onLogged(type, detail) {
  const time = new Date().toLocaleTimeString([], { hour12: false });
  logEntries.value.unshift({ time, type, detail });
  if (logEntries.value.length > 12) logEntries.value.length = 12;
}

onBeforeUnmount(() => {
  for (const r of [detachRef.value, progRef.value]) {
    if (!r) continue;
    const el = r.container?.();
    if (!el) continue;
    try {
      const s = r.player.getState(el);
      if (s?.isDetached) r.player.attach(el);
    } catch {
      /* ignore */
    }
  }
});

const installShell = `pnpm add @vanduo-oss/vdl-cbun`;
const vue3Usage = `<script setup>
import { VdMusicPlayer } from '@vanduo-oss/vdl-cbun/music-player';
import '@vanduo-oss/vdl-cbun/music-player/css';

const tracks = [{ name: 'Pale Blue Dot', url: '/music/pale-blue-dot.mp3' }];
<\/script>

<template>
  <VdMusicPlayer :tracks="tracks" :options="{ showPlaylist: true, showProgress: true }" />
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

    <div class="vd-card demo-card vd-mb-6">
      <div class="vd-card-header">
        <h6>Playlist + progress</h6>
      </div>
      <div class="vd-card-body">
        <VdMusicPlayer
          data-testid="labs-widget-music-player"
          :tracks="tracks"
          :options="{ showPlaylist: true, showProgress: true }"
        />
      </div>
    </div>

    <div class="vd-row vd-mb-6">
      <div class="vd-col-12 vd-col-md-6 vd-mb-6">
        <div class="vd-card demo-card">
          <div class="vd-card-header"><h6>Detachable</h6></div>
          <div class="vd-card-body">
            <VdMusicPlayer
              ref="detachRef"
              :tracks="tracks"
              :options="{
                showProgress: true,
                detachable: true,
                minimizable: true,
                floatingPosition: 'bottom-right',
              }"
            />
            <div class="vd-mt-4" style="display: flex; flex-wrap: wrap; gap: 0.5rem">
              <button type="button" class="vd-btn vd-btn-sm vd-btn-primary" @click="detachCorner('bottom-left')">
                Detach bottom-left
              </button>
              <button type="button" class="vd-btn vd-btn-sm vd-btn-secondary" @click="attachPlayer">Attach</button>
            </div>
          </div>
        </div>
      </div>
      <div class="vd-col-12 vd-col-md-6 vd-mb-6">
        <div class="vd-card demo-card">
          <div class="vd-card-header"><h6>Programmatic + events</h6></div>
          <div class="vd-card-body">
            <VdMusicPlayer
              ref="progRef"
              :tracks="tracks"
              :options="{ showProgress: true, showPlaylist: true }"
              @trackchange="refreshProgState"
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
            />
            <p class="vd-text-sm vd-mt-3"><strong>State:</strong> <code>{{ progState }}</code></p>
            <div style="display: flex; flex-wrap: wrap; gap: 0.5rem">
              <button type="button" class="vd-btn vd-btn-outline vd-btn-sm" @click="prog((p, el) => p.play(el))">Play</button>
              <button type="button" class="vd-btn vd-btn-outline vd-btn-sm" @click="prog((p, el) => p.pause(el))">Pause</button>
              <button type="button" class="vd-btn vd-btn-outline vd-btn-sm" @click="prog((p, el) => p.next(el))">Next</button>
            </div>
            <ul class="vd-mt-3 vd-mb-0" style="list-style: none; padding: 0; max-height: 120px; overflow: auto">
              <li v-for="(e, i) in logEntries" :key="`${e.time}-${i}`" class="vd-text-sm">
                <code>{{ e.time }}</code> {{ e.type }}
              </li>
            </ul>
          </div>
        </div>
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
