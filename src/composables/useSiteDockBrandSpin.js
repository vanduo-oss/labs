import { onUnmounted, watch } from 'vue';
import {
  SITE_DOCK_SPIN_HOVER_MS,
  SITE_DOCK_SPIN_IDLE_MS,
  SITE_DOCK_SPIN_MORPH_MS,
  SITE_DOCK_SPIN_RAMP_MS,
  setSiteDockBrandSpinDurationPreservingPhase,
} from './siteDockBrandSpin.js';

function getBrandSpin(dock) {
  return dock.querySelector('.vd-dock-brand .labs-dock-atom-spin');
}

/**
 * Preserves brand-mark rotation when hover/morph changes spin speed.
 * CSS keeps play-state; this composable ramps duration without resetting angle.
 */
export function useSiteDockBrandSpin(dockEl) {
  let rampFrame = 0;
  let cleanup;

  const cancelRamp = () => {
    if (rampFrame) cancelAnimationFrame(rampFrame);
    rampFrame = 0;
  };

  const rampHoverSpeed = (spin) => {
    cancelRamp();
    setSiteDockBrandSpinDurationPreservingPhase(spin, SITE_DOCK_SPIN_IDLE_MS);

    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / SITE_DOCK_SPIN_RAMP_MS);
      const eased = t * (2 - t);
      const duration =
        SITE_DOCK_SPIN_IDLE_MS +
        (SITE_DOCK_SPIN_HOVER_MS - SITE_DOCK_SPIN_IDLE_MS) * eased;
      setSiteDockBrandSpinDurationPreservingPhase(spin, duration);
      if (t < 1) rampFrame = requestAnimationFrame(tick);
    };
    rampFrame = requestAnimationFrame(tick);
  };

  const syncMorphSpeed = (dock, brand) => {
    const spin = getBrandSpin(dock);
    if (!spin) return;

    if (dock.classList.contains('is-morphing')) {
      cancelRamp();
      setSiteDockBrandSpinDurationPreservingPhase(spin, SITE_DOCK_SPIN_MORPH_MS);
      return;
    }

    const hovered = brand.matches(':hover') || brand.matches(':focus-visible');
    if (hovered) {
      setSiteDockBrandSpinDurationPreservingPhase(spin, SITE_DOCK_SPIN_HOVER_MS);
      return;
    }

    setSiteDockBrandSpinDurationPreservingPhase(spin, SITE_DOCK_SPIN_IDLE_MS);
  };

  const bindBrandSpin = (dock) => {
    const brand = dock.querySelector('.vd-dock-brand');
    const spin = getBrandSpin(dock);
    if (!(brand instanceof HTMLElement) || !spin) return () => undefined;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    const onActivate = () => {
      if (reducedMotion.matches) return;
      rampHoverSpeed(spin);
    };

    const onDeactivate = () => {
      cancelRamp();
    };

    brand.addEventListener('pointerenter', onActivate);
    brand.addEventListener('pointerleave', onDeactivate);
    brand.addEventListener('focusin', onActivate);
    brand.addEventListener('focusout', onDeactivate);

    const morphObserver = new MutationObserver(() => {
      if (reducedMotion.matches) return;
      syncMorphSpeed(dock, brand);
    });
    morphObserver.observe(dock, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => {
      cancelRamp();
      brand.removeEventListener('pointerenter', onActivate);
      brand.removeEventListener('pointerleave', onDeactivate);
      brand.removeEventListener('focusin', onActivate);
      brand.removeEventListener('focusout', onDeactivate);
      morphObserver.disconnect();
    };
  };

  watch(
    dockEl,
    (el) => {
      cleanup?.();
      cleanup = el ? bindBrandSpin(el) : undefined;
    },
    { immediate: true },
  );

  onUnmounted(() => {
    cleanup?.();
    cleanup = undefined;
  });
}
