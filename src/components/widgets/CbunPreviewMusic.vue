<script setup>
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
];
</script>

<template>
  <div class="cbun-music-wrap">
    <VdMusicPlayer
      :tracks="tracks"
      :options="{ showProgress: true, showPlaylist: true }"
    />
  </div>
</template>

<style scoped>
.cbun-music-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 0;
  border-radius: var(--vd-card-border-radius, var(--card-border-radius));
  overflow: hidden;
  --vd-music-player-border-radius: var(--vd-card-border-radius, var(--card-border-radius));
}
</style>
