import { VIEW, FINALE, PALETTE as P } from '../config.js';
import { pointInBox } from '../rules.js';

// The statue's whole simulation: what it is doing, what can hit it, and how it comes
// down. It lives here rather than in state.js for the same reason finale.js lives outside
// background.js — this is a simulation, not another field on the game blob, and state.js
// is already long enough without seventy lines of rigid-body physics in the middle of it.
//
// Nothing in this module touches the particle system, the audio or the game object. Every
// side effect goes through the `fx` sink the caller passes in, which keeps the whole thing
// testable without a canvas and keeps state.js owning the things it already owns.

/** The side-effect sink. state.js supplies the real one; tests can pass a no-op. */
export const NO_FX = { splat() {}, sound() {}, text() {}, confetti() {}, flash() {} };

export function createMonument() {
  return {
    hits: 0, rest: 0, angle: 0, drop: 0, state: 'standing', ms: 0, shake: 0, dust: 0,
    // The head, once the impact shears it off. Null while it is still attached, which is
    // also what the renderer keys off to decide whether to draw a head or a torn neck.
    head: null,
    // Where each landed egg broke, in the statue's OWN frame, so the yolk rides the
    // bronze all the way over instead of hanging in the air where the hit happened.
    splats: []
  };
}

/**
 * The statue's hitbox, swung about the plinth by however far it is currently leaning.
 *
 * Derived from the angle rather than fixed, so what the player can hit is always what
 * they can see: once the thing is going over, its chest genuinely is somewhere else.
 */
export function monumentBox(m) {
  const a = m?.angle ?? 0;
  const r = FINALE.STATUE.h * FINALE.AIM_UP;
  const cx = FINALE.PLINTH.x + FINALE.PIVOT_DX + Math.sin(a) * r;
  const cy = FINALE.STATUE.footY + (m?.drop ?? 0) - Math.cos(a) * r;
  return {
    x: cx - FINALE.AIM_W / 2, y: cy - FINALE.AIM_H / 2, w: FINALE.AIM_W, h: FINALE.AIM_H
  };
}

/** A world point in the statue's own frame — the inverse of the renderer's transform. */
function toLocal(m, x, y) {
  const dx = x - (FINALE.PLINTH.x + FINALE.PIVOT_DX);
  const dy = y - (FINALE.STATUE.footY + (m.drop ?? 0));
  const c = Math.cos(m.angle), s = Math.sin(m.angle);
  return { x: dx * c + dy * s, y: -dx * s + dy * c };
}

/**
 * Resolve a landed egg against the statue. Returns 'hit' or 'miss' so the caller decides
 * what to spawn on the paving — this module does not know what a decal is.
 */
export function hitMonument(m, x, y, fx = NO_FX) {
  if (m.state !== 'standing' || !pointInBox(x, y, monumentBox(m))) return 'miss';
  m.hits += 1;
  m.rest = m.hits * FINALE.LEAN_PER_HIT;
  const local = toLocal(m, x, y);
  m.splats.push({ x: local.x, y: local.y, r: FINALE.SPLAT_R + Math.random() * 2 });
  // Kicked past the tilt it will keep; updateMonument springs it back. A statue that
  // lurches and rights itself reads as something heavy being fought with.
  m.angle = m.rest + FINALE.LEAN_KICK;
  m.shake = FINALE.SHAKE_MS;
  fx.text(x, y - 8, `${m.hits}/${FINALE.HITS_TO_TOPPLE}`, P.yolk);
  fx.sound('splat');
  if (m.hits >= FINALE.HITS_TO_TOPPLE) {
    m.state = 'falling';
    m.ms = 0;
    // Rubble at the ankles the moment it tears off the plinth.
    fx.splat(FINALE.PLINTH.x, FINALE.STATUE.footY - 2, P.rubble);
    fx.splat(FINALE.PLINTH.x + 6, FINALE.STATUE.footY - 4, P.bronzeShade);
  }
  return 'hit';
}

/**
 * How fast the world runs, as a multiplier on dtMs.
 *
 * Deliberately a function of the monument alone, and deliberately 1 in every state but
 * `falling`: nothing may slow down while the player is still throwing. state.js applies it
 * once, before the particles advance, so the crowd, the debris and the statue all dilate
 * together — slowing the statue on its own slides it against a world still running at full
 * speed, which reads as a frame-rate fault rather than as slow motion.
 *
 * The consequence is that m.ms counts finale time, not wall clock. FALL_MS still means
 * what it always meant; only the mapping to seconds moved.
 */
export function monumentTimeScale(m) {
  if (!m || m.state !== 'falling') return 1;
  const p = Math.min(1, m.ms / FINALE.FALL_MS);
  if (p < FINALE.TEETER) return FINALE.SLOMO_SCALE;
  const q = Math.min(1, (p - FINALE.TEETER) / ((1 - FINALE.TEETER) * FINALE.SLOMO_RAMP));
  return FINALE.SLOMO_SCALE + (1 - FINALE.SLOMO_SCALE) * q;
}

/**
 * Where the view is, as a zoom about a focal point. `fx`/`fy` are a world point that stays
 * put on screen while everything around it magnifies — NOT a point that gets centred.
 *
 * Identity for the whole of `standing`, which is the restriction the whole feature rests
 * on: while the player is throwing, what they see and what statueBox() says they can hit
 * are the same coordinates, unmediated.
 *
 * The focal point is the statue's own midpoint rather than the screen's, because the
 * monument stands off-centre in the square — zooming about the middle of the view would
 * push the figure toward the edge at exactly the moment it goes over.
 */
export function monumentCamera(m) {
  const home = { fx: VIEW.W / 2, fy: VIEW.H / 2, zoom: 1 };
  if (!m || m.state === 'standing') return home;

  const zoom = m.state === 'falling'
    ? 1 + (FINALE.CAM_ZOOM - 1) * Math.min(1, m.ms / FINALE.CAM_IN_MS)
    : 1 + (FINALE.CAM_ZOOM - 1)
        * (1 - Math.min(1, Math.max(0, m.ms - FINALE.CAM_HOLD_MS) / FINALE.CAM_OUT_MS));
  // Once there is no zoom there is no focal point either, and returning `home` keeps the
  // "is the camera home?" check a plain equality rather than an epsilon.
  if (zoom <= 1) return home;

  // It watches the head: on the way down where the head still is, and after the impact
  // wherever the head has rolled to.
  const head = m.head ?? toWorld(m, FINALE.HEAD_LOCAL.x, FINALE.HEAD_LOCAL.y);
  const px = FINALE.PLINTH.x + FINALE.PIVOT_DX;
  const py = FINALE.STATUE.footY + m.drop;
  return { fx: (px + head.x) / 2, fy: (py + head.y) / 2, zoom };
}

/**
 * How hard the crowd is celebrating, 0 to 1.
 *
 * It does not decay to nothing. The square has just won, and a crowd that snapped back to
 * an idle sway the moment the dust settled would undo the whole scene — so it falls to a
 * raised baseline and stays there, under the victory card and for as long as the player
 * leaves it up.
 */
export function monumentSurge(m) {
  if (!m || m.state !== 'down') return 0;
  const spike = Math.max(0, 1 - m.ms / FINALE.SURGE_MS);
  return FINALE.SURGE_BASE + (1 - FINALE.SURGE_BASE) * spike;
}

export function updateMonument(m, dtMs, fx = NO_FX) {
  if (!m) return;
  m.ms += dtMs;
  if (m.shake > 0) m.shake = Math.max(0, m.shake - dtMs);
  if (m.dust > 0) m.dust = Math.max(0, m.dust - dtMs);

  if (m.state === 'standing') {
    const k = Math.min(1, dtMs * FINALE.SETTLE_RATE);
    m.angle += (m.rest - m.angle) * k;
    return;
  }
  if (m.state === 'falling') {
    const p = Math.min(1, m.ms / FINALE.FALL_MS);
    if (p < FINALE.TEETER) {
      // It hangs first. A statue this size does not simply start rotating — it stands
      // there a beat, rocking, while it decides, and that beat is what sells the mass.
      m.angle = m.rest + Math.sin((p / FINALE.TEETER) * Math.PI) * FINALE.TEETER_ROCK;
      m.drop = 0;
    } else {
      // Then its own weight has it. Squared, so it accelerates the whole way down.
      const q = (p - FINALE.TEETER) / (1 - FINALE.TEETER);
      m.angle = m.rest + (FINALE.FALL_ANGLE - m.rest) * q * q;
      // And it comes off the pedestal as it turns. Rotation alone would leave it lying
      // in mid-air at the height of the plinth it was standing on.
      m.drop = FINALE.FALL_DROP * q * q;
    }
    if (p >= 1) land(m, fx);
    return;
  }
  if (m.state === 'down') {
    // It rocks to a stop rather than freezing on the frame it landed.
    const s = Math.max(0, 1 - m.ms / FINALE.SETTLE_MS);
    m.angle = FINALE.FALL_ANGLE + Math.sin(m.ms * 0.035) * FINALE.SETTLE_ROCK * s * s;
    updateHead(m.head, dtMs, fx);
  }
}

/** Where a point on the statue's own axis currently is in the world. */
function toWorld(m, lx, ly) {
  const c = Math.cos(m.angle), s = Math.sin(m.angle);
  return {
    x: FINALE.PLINTH.x + FINALE.PIVOT_DX + lx * c - ly * s,
    y: FINALE.STATUE.footY + m.drop + lx * s + ly * c
  };
}

/**
 * The head, after the neck shears. A separate body in WORLD coordinates — unlike the
 * yolk, which rides the statue's own frame, this one has stopped being part of the statue.
 */
function detachHead(m) {
  const at = toWorld(m, FINALE.HEAD_LOCAL.x, FINALE.HEAD_LOCAL.y);
  return {
    x: at.x, y: at.y,
    vx: FINALE.HEAD_LAUNCH_VX, vy: FINALE.HEAD_LAUNCH_VY,
    angle: m.angle, spin: 0, resting: false, bounces: 0
  };
}

function updateHead(h, dtMs, fx) {
  if (!h || h.resting) return;
  const floor = VIEW.GROUND_Y - FINALE.HEAD_REST_Y;
  h.vy += FINALE.HEAD_GRAVITY * dtMs;
  h.x += h.vx * dtMs;
  h.y += h.vy * dtMs;
  if (h.y >= floor) {
    h.y = floor;
    if (h.vy > FINALE.HEAD_STOP_V * 4) {
      h.vy = -h.vy * FINALE.HEAD_RESTITUTION;        // it bounces
      h.vx *= FINALE.HEAD_BOUNCE_FRICTION;
      h.bounces += 1;
      fx.sound('headfall');
    } else {
      h.vy = 0;                                       // and then it rolls
      const drag = FINALE.HEAD_ROLL_FRICTION * dtMs;
      h.vx = Math.sign(h.vx) * Math.max(0, Math.abs(h.vx) - drag);
      if (Math.abs(h.vx) < FINALE.HEAD_STOP_V) { h.vx = 0; h.resting = true; }
    }
  }
  // Rolling without slipping, so the spin and the travel can never disagree — a head
  // sliding along the paving without turning is the tell that this is two animations.
  h.spin = h.vx / FINALE.HEAD_RADIUS;
  h.angle += h.spin * dtMs;
}

function land(m, fx) {
  m.state = 'down';
  m.ms = 0;
  m.shake = FINALE.LAND_SHAKE_MS;
  m.dust = FINALE.DUST_MS;
  m.head = detachHead(m);
  // Debris where it struck: at the base, and out where the head came down.
  fx.splat(FINALE.PLINTH.x + 10, VIEW.GROUND_Y - 6, P.rubble);
  fx.splat(FINALE.PLINTH.x + 92, VIEW.GROUND_Y - 8, P.rubble);
  fx.splat(FINALE.PLINTH.x + 96, VIEW.GROUND_Y - 6, P.dust);
  fx.confetti(FINALE.PLINTH.x + 40, VIEW.GROUND_Y - 30, FINALE.CONFETTI, FINALE.CONFETTI_SPREAD);
  fx.flash();
  fx.sound('crash');
  fx.sound('roar');
}

/**
 * Snap the whole sequence to its finished frame.
 *
 * The head is fast-forwarded through the real simulation rather than parked at a stored
 * resting place. Two reasons: the physics is deterministic, so this lands it on exactly
 * the pixel it would have reached on its own — a hardcoded rest position would drift out
 * of agreement the first time the launch or the friction was retuned, and the skipped
 * ending would quietly stop matching the played one. It is also only a few dozen cheap
 * iterations. The cap is a guard against a future tuning that never comes to rest.
 */
export function skipToSettled(m) {
  if (m.state === 'falling') {
    m.angle = FINALE.FALL_ANGLE;
    m.drop = FINALE.FALL_DROP;
    land(m, NO_FX);            // silently: a skipped fall must not fire the crash
  }
  for (let i = 0; i < 4000 && m.head && !m.head.resting; i += 1) {
    updateHead(m.head, 16, NO_FX);
  }
  m.state = 'down';
  m.ms = FINALE.CARD_DELAY_MS;
  m.angle = FINALE.FALL_ANGLE;
  m.shake = 0;
  m.dust = 0;
}

/** Has the statue been down long enough for the victory card to be up? */
export function monumentCardUp(m) {
  return !!m && m.state === 'down' && m.ms >= FINALE.CARD_DELAY_MS;
}
