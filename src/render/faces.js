import { FACES } from '../config.js';

const loaded = new Map();

/**
 * Begin loading every face. Safe to call once at boot, never throws, and never blocks:
 * until an image arrives the sprite layer keeps drawing the caricature.
 */
export function preloadFaces() {
  if (typeof Image === 'undefined') return;      // Node has no DOM; stay empty
  Object.entries(FACES).forEach(([id, spec]) => {
    try {
      const img = new Image();
      img.addEventListener('load', () => loaded.set(id, img));
      img.addEventListener('error', () => {
        // A missing face is not fatal — the caricature stands in for it.
        console.warn(`Get Egged: face for ${id} failed to load, drawing the caricature`);
      });
      img.src = spec.src;
    } catch {
      /* nothing here may stop the game from starting */
    }
  });
}

/** The loaded photo for `id`, or null while it loads or if it failed. */
export function faceFor(id) {
  return loaded.get(id) ?? null;
}
