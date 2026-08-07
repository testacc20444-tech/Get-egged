import { VIEW, PALETTE } from '../config.js';

const GRAVITY = 0.0009;

export function createParticleSystem() {
  return { bits: [], floats: [], decals: [] };
}

/** A burst of yolk fragments at the point of impact. */
export function spawnSplat(sys, x, y, color = PALETTE.yolk) {
  for (let i = 0; i < 10; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const s = 0.03 + Math.random() * 0.09;
    sys.bits.push({
      x, y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s - 0.05,
      r: 1 + Math.random() * 2,
      color,
      life: 0,
      ttl: 500 + Math.random() * 400
    });
  }
}

/**
 * An egg breaking: yolk plus shell. Both colours matter — a break in shell white
 * alone reads as a snowball, which is exactly the report this fixes.
 */
export function spawnEggBreak(sys, x, y) {
  spawnSplat(sys, x, y, PALETTE.yolk);
  spawnSplat(sys, x, y, PALETTE.egg);
}

/**
 * Paper thrown up over the square when the statue goes over. Reuses `bits` rather than
 * introducing a particle type: the only thing confetti needs that yolk does not is to fall
 * slowly and last, and that is one gravity scale and a longer ttl.
 *
 * Red and black are the flag; the shell white is what is left of the eggs.
 */
export function spawnConfetti(sys, x, y, count, spread) {
  const colors = [PALETTE.flag, PALETTE.flag, PALETTE.flagEagle, PALETTE.egg];
  for (let i = 0; i < count; i += 1) {
    sys.bits.push({
      x: x + (Math.random() - 0.5) * spread,
      y: y - Math.random() * 20,
      vx: (Math.random() - 0.5) * 0.07,
      vy: -0.05 - Math.random() * 0.09,
      r: 1 + Math.round(Math.random()),
      g: 0.16,                                 // it is paper, so it hangs
      color: colors[i % colors.length],
      life: 0,
      ttl: 2600 + Math.random() * 1800
    });
  }
}

export function spawnFloatingText(sys, x, y, text, color = PALETTE.hudText) {
  sys.floats.push({ x, y, text, color, life: 0, ttl: 900 });
}

/** A yolk smear on the ground where a missed egg landed. */
export function spawnDecal(sys, x, y) {
  // Decals must not slide under the HUD bar.
  const groundY = Math.min(Math.max(y, VIEW.GROUND_Y), VIEW.H - VIEW.HUD_BAR_H - 2);
  sys.decals.push({ x, y: groundY, r: 3 + Math.random() * 2, life: 0, ttl: 3000 });
}

function advance(list, dtMs, step) {
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const p = list[i];
    p.life += dtMs;
    if (p.life >= p.ttl) { list.splice(i, 1); continue; }
    if (step) step(p, dtMs);
  }
}

export function updateParticles(sys, dtMs) {
  advance(sys.bits, dtMs, (p) => {
    // `g` scales gravity per bit; yolk and shell leave it unset and fall at 1.
    p.vy += GRAVITY * (p.g ?? 1) * dtMs;
    p.x += p.vx * dtMs;
    p.y += p.vy * dtMs;
  });
  advance(sys.floats, dtMs, (p) => { p.y -= dtMs * 0.02; });
  advance(sys.decals, dtMs, null);
}
