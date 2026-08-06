import { EGG } from '../config.js';

const ARC_RISE = 46; // pixels of parabolic lift at mid-flight

export function eggArcHeight() {
  return ARC_RISE;
}

/**
 * An egg thrown at (targetX, targetY). Interpolates linearly from the hand to
 * the target over EGG.FLIGHT_MS and adds a parabolic rise that is zero at both
 * ends, so the landing point is exactly the clicked point.
 */
export function spawnEgg(targetX, targetY, isFirstEgg) {
  return {
    x: EGG.HAND_X,
    y: EGG.HAND_Y,
    sx: EGG.HAND_X,
    sy: EGG.HAND_Y,
    tx: targetX,
    ty: targetY,
    t: 0,
    rot: 0,
    isFirstEgg,
    landed: false
  };
}

/** Advance `egg` by dtMs. Returns true only on the frame it lands. */
export function updateEgg(egg, dtMs) {
  if (egg.landed) return false;

  egg.t = Math.min(egg.t + dtMs, EGG.FLIGHT_MS);
  const p = egg.t / EGG.FLIGHT_MS;

  egg.x = egg.sx + (egg.tx - egg.sx) * p;
  egg.y = egg.sy + (egg.ty - egg.sy) * p - ARC_RISE * 4 * p * (1 - p);
  egg.rot += dtMs * 0.02;

  if (egg.t >= EGG.FLIGHT_MS) {
    egg.x = egg.tx;
    egg.y = egg.ty;
    egg.landed = true;
    return true;
  }
  return false;
}
