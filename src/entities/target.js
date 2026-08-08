import { VIEW, FIGURES, FEEL } from '../config.js';
import { speedMultiplier, escapeMsForRound } from '../rules.js';

/**
 * A politician flapping across the sky. Horizontal drift plus a sine bob,
 * with periodic direction changes driven by `wobble`.
 */
export function spawnTarget(figureIndex, round, side) {
  const f = FIGURES[figureIndex];
  const mult = speedMultiplier(round);
  const dir = side === 'left' ? 1 : -1;
  return {
    id: f.id,
    name: f.name,
    points: f.points,
    x: side === 'left' ? -f.w : VIEW.W + f.w,
    y: FEEL.SPAWN_Y_MIN + Math.random() * FEEL.SPAWN_Y_SPAN,
    w: f.w,
    h: f.h,
    vx: dir * f.speed * mult * FEEL.SPEED_SCALE,
    vy: 0,
    phase: Math.random() * Math.PI * 2,
    wobble: f.wobble,
    life: 0,
    escapeMs: escapeMsForRound(round),
    state: 'flying',
    yolk: 0,
    rot: 0,
    flap: 0,
    scared: 0,
    fleeing: false,
    entered: false,     // has the whole hitbox been inside the view yet?
    enteredAt: null,    // the `life` at which that first happened
    goneAt: null,       // set once it starts leaving: the `life` it must be gone by
    removeAt: null
  };
}

export function targetBox(t) {
  return { x: t.x - t.w / 2, y: t.y - t.h / 2, w: t.w, h: t.h };
}

/**
 * The box an egg is tested against: the drawn figure, grown by FEEL.HIT_PAD on every
 * side.
 *
 * Deliberately a second function rather than a wider targetBox. updateTarget below uses
 * targetBox for the entry gate — "is the whole hitbox inside the view yet?" — and a
 * padded box there would make every figure count as arriving later, quietly shifting
 * MIN_ON_SCREEN_MS and the escape timing with it. The two boxes answer different
 * questions and only one of them should be generous.
 */
export function hitBox(t) {
  const p = FEEL.HIT_PAD;
  return { x: t.x - t.w / 2 - p, y: t.y - t.h / 2 - p, w: t.w + p * 2, h: t.h + p * 2 };
}

/** Egged: stop flying, start tumbling. */
export function hitTarget(t) {
  if (t.state !== 'flying') return;
  t.state = 'falling';
  t.yolk = 1;
  t.vy = FEEL.HIT_LAUNCH_VY;
  t.vx *= FEEL.HIT_DRAG;
}

/** An egg landed close by: swerve and climb for a moment. */
export function nearMissScare(t) {
  if (t.state !== 'flying') return;
  t.scared = FEEL.SCARE_MS;
  t.phase += Math.PI / 2;
}

/**
 * Start leaving: speed up in whichever direction the figure is already travelling (not
 * necessarily toward the nearest edge), and set a deadline to be gone by.
 *
 * Two things call this and they are the same event from the figure's point of view: the
 * player running out of eggs, and the figure's own time on screen running out. Both used
 * to end with it being deleted where it stood — see updateTarget below.
 */
export function flee(t) {
  if (t.state !== 'flying' || t.fleeing) return;
  t.fleeing = true;
  t.vx *= FEEL.FLEE_BOOST;
  t.goneAt = t.life + FEEL.EXIT_MS;
}

export function updateTarget(t, dtMs) {
  if (t.state === 'gone') return 'gone';

  t.life += dtMs;
  t.flap = (t.flap + dtMs / FEEL.FLAP_MS) % 2;

  if (t.state === 'falling') {
    t.vy += FEEL.FALL_ACCEL * dtMs;
    t.x += t.vx * dtMs;
    t.y += t.vy * dtMs;
    t.rot += dtMs * FEEL.TUMBLE_RATE;
    if (t.y >= VIEW.GROUND_Y) {
      t.y = VIEW.GROUND_Y;
      t.state = 'gone';
      return 'landed';
    }
    return 'falling';
  }

  // Flying: drift, bob, and swerve now and then.
  if (t.scared > 0) {
    t.scared = Math.max(0, t.scared - dtMs);
    t.y -= dtMs * FEEL.SCARE_CLIMB;           // panic climb after a near miss
  }
  t.phase += dtMs * FEEL.BOB_RATE * t.wobble;
  t.x += t.vx * dtMs;
  t.y += Math.sin(t.phase) * FEEL.BOB_AMPLITUDE * dtMs * t.wobble;
  t.y = Math.max(FEEL.FLY_Y_MIN, Math.min(FEEL.FLY_Y_MAX, t.y));

  // A figure spawns outside the view, so until its whole hitbox has been inside
  // it is still arriving, not escaping.
  if (!t.entered) {
    const box = targetBox(t);
    if (box.x >= 0 && box.x + box.w <= VIEW.W) {
      t.entered = true;
      t.enteredAt = t.life;
    }
  }

  // No swerving during the entrance: a figure that turned around while still off
  // the edge would fly straight back out having never been hittable. Gating the
  // roll (rather than the flip) also makes the entrance monotonic — nothing can
  // reverse vx before entry — so every flying figure is guaranteed to enter.
  if (t.entered && !t.fleeing && Math.random() < dtMs * FEEL.SWERVE_CHANCE * t.wobble) t.vx *= -1;

  // Time up. This STARTS the exit rather than ending the figure. escapeMs says a
  // politician has had its moment, not that it should cease to exist — and it used to
  // mean the latter: measured over the real engine it removed 76-88% of every figure
  // spawned, and 94-96% of those were mid-air, on average ~150px from the nearest edge.
  // state.js sets removeAt to the current clock for an escape, so they did not fly off,
  // they blinked out of existence a third of the way across an empty sky.
  //
  // A bolting figure is still `flying`, so it stays hittable the whole way out. That is
  // deliberate: the boost already makes it a harder shot, and a last chance reads far
  // better than a target being confiscated.
  if (t.life >= t.escapeMs) flee(t);

  // Leaving by an edge only counts once the figure has arrived and been on offer
  // for MIN_ON_SCREEN_MS. goneAt sits outside that gate on purpose: it is what now
  // guarantees every target eventually reports a terminal result, including one that
  // starts leaving before it ever enters, or that is too slow to reach any edge.
  const offScreen = t.x < -t.w * 2 || t.x > VIEW.W + t.w * 2;
  const mayExit = t.entered && t.life - t.enteredAt >= FEEL.MIN_ON_SCREEN_MS;
  if ((offScreen && mayExit) || (t.goneAt !== null && t.life >= t.goneAt)) {
    t.state = 'gone';
    return 'escaped';
  }
  return 'flying';
}
