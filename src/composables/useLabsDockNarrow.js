import { onUnmounted, ref } from 'vue';
import { DOCK_NARROW_QUERY } from '@vanduo-oss/vd3';

/**
 * Tracks whether the viewport matches VdDock's phone lock query (520px).
 * Keep CSS @media for narrow dock in sync with DOCK_NARROW_QUERY.
 */
export function useLabsDockNarrow(options = {}) {
  const isNarrow = ref(false);
  let mq = null;

  const onChange = (event) => {
    if (!event.matches) {
      options.onExitNarrow?.();
    }
    isNarrow.value = event.matches;
  };

  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    mq = window.matchMedia(DOCK_NARROW_QUERY);
    isNarrow.value = mq.matches;
    mq.addEventListener('change', onChange);
  }

  onUnmounted(() => {
    mq?.removeEventListener('change', onChange);
    mq = null;
  });

  return isNarrow;
}
