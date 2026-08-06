import { VIEW, DECOY, FEEL } from '../config.js';

const SIZES = {
  flamingo: { w: 17, h: 23 },
  protester: { w: 18, h: 30 }
};

export function pickDecoyKind(rng = Math.random) {
  return rng() < 0.5 ? 'flamingo' : 'protester';
}

/** A protected crosser. Flamingos glide across the sky, protesters walk the ground. */
export function spawnDecoy(kind, round) {
  const size = SIZES[kind];
  if (!size) throw new Error(`unknown decoy kind: ${kind}`);
  const fromLeft = Math.random() < 0.5;
  return {
    kind,
    x: fromLeft ? -size.w : VIEW.W + size.w,
    // A protester walks the near rank's ground line, not GROUND_Y: it is drawn at
    // foreground size, so standing it where the far rank stands makes it float.
    y: kind === 'flamingo'
      ? 40 + Math.random() * 50
      : VIEW.GROUND_Y + DECOY.FOOT_DY - size.h / 2,
    w: size.w,
    h: size.h,
    vx: (fromLeft ? 1 : -1) * DECOY.SPEED * FEEL.SPEED_SCALE,
    phase: Math.random() * Math.PI * 2,
    state: 'crossing',
    yolk: 0
  };
}

export function decoyBox(d) {
  return { x: d.x - d.w / 2, y: d.y - d.h / 2, w: d.w, h: d.h };
}

/** Egged a protected crosser: mark it and let it keep going, yolked. */
export function hitDecoy(d) {
  d.yolk = 1;
}

export function updateDecoy(d, dtMs) {
  if (d.state === 'gone') return 'gone';
  d.phase += dtMs * FEEL.DECOY_BOB_RATE;
  d.x += d.vx * dtMs;
  if (d.kind === 'flamingo') d.y += Math.sin(d.phase) * FEEL.DECOY_BOB_AMPLITUDE * dtMs;
  if (d.x < -d.w * 2 || d.x > VIEW.W + d.w * 2) {
    d.state = 'gone';
    return 'gone';
  }
  return 'crossing';
}
