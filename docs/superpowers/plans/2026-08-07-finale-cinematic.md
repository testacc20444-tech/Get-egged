# Cinematic Finale Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the working triumph finale into a six-second cinematic sequence — slow-motion teeter, a camera push-in, the statue's head breaking off and rolling, an impact that reads as a bronze figure hitting stone, and a skippable finish.

**Architecture:** The statue's simulation moves out of `state.js` into a new pure module `src/entities/monument.js`. `state.js` becomes a router that delegates and keeps its current exports. The camera and time scale are pure functions of monument state, consumed by `main.js` at the single `setTransform` seam that already carries the screen shake.

**Tech Stack:** Vanilla ESM + Canvas2D. No build step, no dependencies. Tests are `node:test` over pure logic only (`npm test`).

## Global Constraints

- **No build step, no bundler, no dependencies.** The browser loads `src/*.js` directly.
- **`src/config.js` single-sources every tunable, colour and player-facing string.** A prior commit stripped hex literals out of the render modules; do not reintroduce them.
- **All player-facing text is Albanian.**
- **Comments document *why*.** Several record specific fixed bugs — do not "clean up" those.
- **Tests cover pure logic only.** Rendering has no test harness and stays untested by design.
- **`DEBUG.START_IN_FINALE` must be `false` at the end of the final task.** It is turned on in Task 1 for development.
- Run the game with `npm start` (`npx serve -l 5173 .`). ES modules will not load from `file://`.
- Baseline before any work: **91 tests passing.**

---

### Task 1: Extract the monument simulation

Pure refactor. Behaviour must not change and all 91 tests must pass untouched — that is the whole point of doing it first.

**Files:**
- Create: `src/entities/monument.js`
- Modify: `src/state.js` (finale section, ~lines 243-383)
- Modify: `src/config.js` (`DEBUG.START_IN_FINALE` → `true`)

**Interfaces:**
- Produces: `createMonument()`, `updateMonument(m, dtMs, fx)`, `hitMonument(m, x, y)`, `monumentBox(m)`, `monumentCardUp(m)`.
- `fx` is a side-effect sink `{ splat(x,y,color), sound(name), text(x,y,str,color) }` so the simulation stays pure and `state.js` keeps owning the particle system and audio.
- `hitMonument` returns `'hit' | 'miss'` so `state.js` decides what to spawn.
- `state.js` continues to export `statueBox` and `finaleCardUp` with identical signatures.

- [ ] **Step 1: Create the module by moving the existing logic verbatim**

Move `statueBox`, `toStatueLocal`, `resolveFinaleLanding` and `updateFinale` into `src/entities/monument.js`, renaming to the interface above and threading `fx` where they currently touch `g.particles` / `sound(g, ...)`.

- [ ] **Step 2: Delegate from state.js**

```js
import {
  createMonument, updateMonument, hitMonument, monumentBox, monumentCardUp
} from './entities/monument.js';

export const statueBox = monumentBox;
export const finaleCardUp = monumentCardUp;
```

- [ ] **Step 3: Run the full suite — nothing may change**

Run: `npm test`
Expected: 91 passing, 0 failing.

- [ ] **Step 4: Turn on the debug flag and look at it**

Set `DEBUG.START_IN_FINALE: true`, run `npm start`, confirm the finale still plays exactly as before.

- [ ] **Step 5: Commit**

```bash
git add src/entities/monument.js src/state.js src/config.js
git commit -m "refactor: lift the monument simulation out of state.js"
```

---

### Task 2: Time dilation

**Files:**
- Modify: `src/entities/monument.js`, `src/config.js`, `src/state.js`
- Test: `tests/finale.test.js`

**Interfaces:**
- Produces: `monumentTimeScale(m) -> number`.

**Config additions:**

```js
FALL_MS: 1500,
TEETER: 0.24,        // raised from 0.16: long enough to read as hesitation
SLOMO_SCALE: 0.3,    // world speed through the teeter
SLOMO_RAMP: 0.3,     // fraction of the post-teeter fall spent returning to 1.0
```

- [ ] **Step 1: Replace the four wall-clock advances with a settle helper**

In `tests/finale.test.js`, add next to `run`:

```js
/**
 * Advance until the statue is down and has stopped moving. The fall no longer takes
 * FALL_MS of wall clock — time dilates through the teeter — so tests must wait on the
 * state rather than on a duration. The cap fails loudly rather than hanging.
 */
function settle(g) {
  for (let i = 0; i < 4000 && !(g.finale.state === 'down' && g.finale.ms > FINALE.SETTLE_MS); i += 1) {
    update(g, 16);
  }
  return g;
}
```

Replace every `run(g, FINALE.FALL_MS + 100)` with `settle(g)` in the four tests that use it. The two tests that then assert on mid-settle rocking must instead run to the point they care about explicitly.

- [ ] **Step 2: Write the failing test**

```js
test('time dilates through the teeter and returns to normal for the fall', () => {
  assert.equal(monumentTimeScale({ state: 'standing', ms: 0 }), 1,
    'nothing may slow down while the player is still throwing');
  const teeter = monumentTimeScale({ state: 'falling', ms: FINALE.FALL_MS * 0.1 });
  assert.ok(teeter < 1, 'the tipping point must run slow');
  assert.ok(teeter > 0, 'but never stop');
  assert.equal(monumentTimeScale({ state: 'falling', ms: FINALE.FALL_MS }), 1,
    'and it must be back to full speed by the time it lands');
  assert.equal(monumentTimeScale({ state: 'down', ms: 0 }), 1);
});
```

- [ ] **Step 3: Run it — expect a failure**

Run: `npm test`
Expected: FAIL, `monumentTimeScale is not a function`.

- [ ] **Step 4: Implement**

```js
/**
 * How fast the world runs. Applied once in update() before the particles advance, so the
 * crowd, the debris and the statue all dilate together — slowing the statue alone slides
 * it against a world still at full speed, which reads as a frame-rate fault.
 */
export function monumentTimeScale(m) {
  if (!m || m.state !== 'falling') return 1;
  const p = Math.min(1, m.ms / FINALE.FALL_MS);
  if (p < FINALE.TEETER) return FINALE.SLOMO_SCALE;
  const q = Math.min(1, (p - FINALE.TEETER) / ((1 - FINALE.TEETER) * FINALE.SLOMO_RAMP));
  return FINALE.SLOMO_SCALE + (1 - FINALE.SLOMO_SCALE) * q;
}
```

In `state.js` `update()`, scale once at the top of the finale path — before `updateParticles`:

```js
if (g.phase === PHASE.PAUSED) return;
const dt = g.phase === PHASE.FINALE ? dtMs * monumentTimeScale(g.finale) : dtMs;
g.clock += dt;
g.phaseMs += dt;
updateParticles(g.particles, dt);
```

- [ ] **Step 5: Run the suite**

Run: `npm test`
Expected: all passing, including the migrated four.

- [ ] **Step 6: Commit**

```bash
git add src/entities/monument.js src/state.js src/config.js tests/finale.test.js
git commit -m "feat: dilate time through the teeter"
```

---

### Task 3: The head breaks off

**Files:**
- Modify: `src/entities/monument.js`, `src/config.js`
- Test: `tests/finale.test.js`

**Interfaces:**
- Produces: `m.head` — `{ x, y, vx, vy, angle, spin, resting }` in **world** coordinates, `null` until impact.

**Config additions:**

```js
HEAD_LOCAL: { x: -9, y: -82 },   // where it sits on the statue's own axis
HEAD_GRAVITY: 0.0006,
HEAD_RESTITUTION: 0.42,
HEAD_BOUNCE_FRICTION: 0.82,      // horizontal speed kept through each bounce
HEAD_ROLL_FRICTION: 0.0018,      // px/ms lost per ms once it is rolling
HEAD_FORWARD_KICK: 0.05,         // it shears forward, not just straight down
HEAD_STOP_V: 0.004,
HEAD_RADIUS: 7,
HEAD_REST_Y: 4,                  // above GROUND_Y, so it sits among the crowd
```

- [ ] **Step 1: Write the failing test**

```js
test('the head breaks off when it lands and comes to rest on the ground', () => {
  const g = atRound(ROUND.FINAL_ROUND);
  playRound(g, quotaForRound(ROUND.FINAL_ROUND));
  for (let i = 0; i < FINALE.HITS_TO_TOPPLE; i += 1) {
    const p = aimAt(g);
    throwAt(g, p.x, p.y);
  }
  assert.equal(g.finale.head, null, 'it is still attached on the way down');
  settle(g);
  const h = g.finale.head;
  assert.ok(h, 'the impact must break the head off');
  assert.ok(h.resting, 'and it must come to a stop rather than rolling forever');
  assert.ok(Math.abs(h.y - (VIEW.GROUND_Y - FINALE.HEAD_REST_Y)) < 1e-6,
    `the head is floating at ${h.y}`);
  assert.ok(h.x > FINALE.PLINTH.x, 'it rolls away from the plinth, in the direction of the fall');
});
```

- [ ] **Step 2: Run it — expect a failure**

Run: `npm test`
Expected: FAIL, head is `null` after settling.

- [ ] **Step 3: Implement detach at impact**

In the `falling` → `down` transition, launch it from the body's angular velocity:

```js
// The head leaves at whatever the body's tip was doing. omega is the derivative of the
// q-squared fall curve at q=1, so this is the real tangential speed rather than a guess.
const omega = 2 * (FINALE.FALL_ANGLE - m.rest) / ((1 - FINALE.TEETER) * FINALE.FALL_MS);
const r = Math.hypot(FINALE.HEAD_LOCAL.x, FINALE.HEAD_LOCAL.y);
const a = m.angle;
m.head = {
  x: FINALE.PLINTH.x + FINALE.PIVOT_DX + Math.sin(a) * r,
  y: FINALE.STATUE.footY + m.drop - Math.cos(a) * r,
  vx: omega * r * Math.cos(a) + FINALE.HEAD_FORWARD_KICK,
  vy: Math.abs(omega * r * Math.sin(a)) * 0.5,
  angle: a, spin: 0, resting: false
};
```

- [ ] **Step 4: Implement the bounce and roll**

```js
function updateHead(h, dtMs, fx) {
  if (!h || h.resting) return;
  const floor = VIEW.GROUND_Y - FINALE.HEAD_REST_Y;
  h.vy += FINALE.HEAD_GRAVITY * dtMs;
  h.x += h.vx * dtMs;
  h.y += h.vy * dtMs;
  if (h.y >= floor) {
    h.y = floor;
    if (Math.abs(h.vy) > FINALE.HEAD_STOP_V * 4) {
      h.vy = -h.vy * FINALE.HEAD_RESTITUTION;      // it bounces
      h.vx *= FINALE.HEAD_BOUNCE_FRICTION;
      fx.sound('headfall');
    } else {
      h.vy = 0;                                     // and then it rolls
      const drag = FINALE.HEAD_ROLL_FRICTION * dtMs;
      h.vx = Math.sign(h.vx) * Math.max(0, Math.abs(h.vx) - drag);
      if (Math.abs(h.vx) < FINALE.HEAD_STOP_V) { h.vx = 0; h.resting = true; }
    }
  }
  h.spin = h.vx / FINALE.HEAD_RADIUS;               // rolling without slipping
  h.angle += h.spin * dtMs;
}
```

- [ ] **Step 5: Run the suite**

Run: `npm test`
Expected: all passing.

- [ ] **Step 6: Commit**

```bash
git add src/entities/monument.js src/config.js tests/finale.test.js
git commit -m "feat: the head breaks off, bounces and rolls"
```

---

### Task 4: The camera

**Files:**
- Modify: `src/entities/monument.js`, `src/config.js`, `src/main.js`
- Test: `tests/finale.test.js`

**Interfaces:**
- Produces: `monumentCamera(m) -> { fx, fy, zoom, dx, dy }`.

**Config additions:**

```js
CAM_ZOOM: 1.35,
CAM_IN_MS: 900,      // finale-ms to reach full zoom once it starts going
CAM_HOLD_MS: 1200,   // held after impact, while the head rolls
CAM_OUT_MS: 900,     // and eased back out — must finish before CARD_DELAY_MS
CARD_DELAY_MS: 2400, // raised from 800: the camera has to be home before the card
```

- [ ] **Step 1: Write the failing test**

```js
test('the camera is identity while the player throws, and home again before the card', () => {
  const idle = monumentCamera({ state: 'standing', ms: 0, angle: 0, drop: 0 });
  assert.equal(idle.zoom, 1, 'no zoom may be applied while the finale is interactive');
  assert.equal(idle.dx, 0);
  assert.equal(idle.dy, 0);
  const g = atRound(ROUND.FINAL_ROUND);
  playRound(g, quotaForRound(ROUND.FINAL_ROUND));
  for (let i = 0; i < FINALE.HITS_TO_TOPPLE; i += 1) {
    const p = aimAt(g);
    throwAt(g, p.x, p.y);
  }
  settle(g);
  run(g, FINALE.CARD_DELAY_MS);
  assert.equal(finaleCardUp(g.finale), true);
  assert.ok(Math.abs(monumentCamera(g.finale).zoom - 1) < 1e-6,
    'the card must never be drawn under a zoom');
});
```

- [ ] **Step 2: Run it — expect a failure**

Run: `npm test`
Expected: FAIL, `monumentCamera is not a function`.

- [ ] **Step 3: Implement**

Zoom envelope: ramps in over `CAM_IN_MS` of the fall, holds `CAM_HOLD_MS` after impact, eases out over `CAM_OUT_MS`. Focal point is the statue's own midpoint while it falls and the head once detached — the figure is off-centre in the square, so zooming about the screen centre would push it toward the edge exactly as it goes.

- [ ] **Step 4: Apply it at the one seam in main.js**

```js
const cam = finale ? finaleCamera(finale) : { fx: 0, fy: 0, zoom: 1, dx: 0, dy: 0 };
const s = VIEW.SCALE * cam.zoom;
ctx.setTransform(s, 0, 0, s,
  (cam.fx * (1 - cam.zoom) + cam.dx + kick.dx) * VIEW.SCALE,
  (cam.fy * (1 - cam.zoom) + cam.dy + kick.dy) * VIEW.SCALE);
```

- [ ] **Step 5: Reset the transform before the overlays**

Overlays currently inherit the world transform. At 2px of shake that is invisible; at 1.35x it magnifies the pause menu and shoves it off-centre. Immediately before the `drawMenu`/`drawHud`/`drawFinaleOverlay`/`drawPauseMenu` block:

```js
// Overlays are screen furniture, not world: they must not ride the camera or the kick.
ctx.setTransform(VIEW.SCALE, 0, 0, VIEW.SCALE, 0, 0);
```

- [ ] **Step 6: Run the suite, then look at it**

Run: `npm test` — all passing. Then `npm start`: confirm the push-in, and that pausing mid-fall draws the pause menu square and centred.

- [ ] **Step 7: Commit**

```bash
git add src/entities/monument.js src/config.js src/main.js tests/finale.test.js
git commit -m "feat: a camera that pushes in on the fall"
```

---

### Task 5: Skip

**Files:**
- Modify: `src/entities/monument.js`, `src/config.js`, `src/state.js`
- Test: `tests/finale.test.js`

**Interfaces:**
- Produces: `skipToSettled(m)`.

**Config additions:** `SKIP_LOCKOUT_MS: 150` (finale-ms; ~500ms of wall clock at `SLOMO_SCALE`).

- [ ] **Step 1: Write the failing tests**

```js
test('a click during the fall skips to the card', () => {
  const g = toppled();
  run(g, 400);
  click(g, VIEW.W / 2, VIEW.H / 2);
  assert.equal(g.finale.state, 'down');
  assert.equal(finaleCardUp(g.finale), true, 'the card must be up immediately');
  assert.ok(g.finale.head?.resting, 'and the head parked where it would have stopped');
});

test('the skip is locked out at the very start of the fall', () => {
  const g = toppled();
  click(g, VIEW.W / 2, VIEW.H / 2);
  assert.equal(g.finale.state, 'falling',
    'a click still in flight when the sixth egg lands must not skip the topple');
});

test('clicking while it still stands throws an egg rather than skipping', () => {
  const g = atRound(ROUND.FINAL_ROUND);
  playRound(g, quotaForRound(ROUND.FINAL_ROUND));
  const before = g.eggs.length;
  click(g, 200, 120);
  assert.equal(g.eggs.length, before + 1);
  assert.equal(g.finale.state, 'standing');
});
```

Add a `toppled()` helper that reaches `falling` (the existing six-hit loop, extracted).

- [ ] **Step 2: Run — expect failures**

Run: `npm test`
Expected: FAIL on the first two.

- [ ] **Step 3: Implement**

```js
/** Snap the whole sequence to its settled frame. */
export function skipToSettled(m) {
  m.state = 'down';
  m.ms = FINALE.CARD_DELAY_MS;
  m.angle = FINALE.FALL_ANGLE;
  m.drop = FINALE.FALL_DROP;
  m.shake = 0;
  m.dust = 0;
  m.crack = 1;
  m.head = {
    x: FINALE.PLINTH.x + FINALE.HEAD_REST_DX, y: VIEW.GROUND_Y - FINALE.HEAD_REST_Y,
    vx: 0, vy: 0, angle: FINALE.HEAD_REST_ANGLE, spin: 0, resting: true
  };
}
```

In `state.js` `click()`, replacing `if (g.finale?.state !== 'standing') return;`:

```js
// Six seconds is long enough that protecting the moment costs more on a replay than it
// buys on a first watch — but not in the first instants: a player throwing quickly has a
// click in flight when the sixth egg lands, and that must not skip the topple they earned.
if (g.finale?.state !== 'standing') {
  if (g.finale && !(g.finale.state === 'falling' && g.finale.ms < FINALE.SKIP_LOCKOUT_MS)) {
    skipToSettled(g.finale);
  }
  return;
}
```

- [ ] **Step 4: Run the suite**

Run: `npm test`
Expected: all passing.

- [ ] **Step 5: Commit**

```bash
git add src/entities/monument.js src/state.js src/config.js tests/finale.test.js
git commit -m "feat: click to skip the finale sequence"
```

---

### Task 6: Sounds

**Files:** Modify `src/audio.js`, `src/entities/monument.js`

No tests: `audio.js` is Web Audio and has no harness. Verified by ear.

- [ ] **Step 1: Add three sounds to the SOUNDS table**

```js
crash:    () => { noise({ dur: 0.85, gain: 0.34, filterFreq: 700, sweepTo: 90 });
                  tone({ freq: 90, endFreq: 38, dur: 0.7, type: 'sine', gain: 0.30 });
                  tone({ freq: 140, endFreq: 52, dur: 0.35, type: 'triangle', gain: 0.16 }); },
headfall: () => { tone({ freq: 430, endFreq: 200, dur: 0.16, type: 'triangle', gain: 0.13 });
                  noise({ dur: 0.10, gain: 0.10, filterFreq: 1800, sweepTo: 400 }); },
roar:     () => noise({ dur: 1.6, gain: 0.15, filterFreq: 420, sweepTo: 900 })
```

- [ ] **Step 2: Play `crash` and `roar` at impact instead of `splat`**

A bronze figure hitting stone must not share a cue with an egg.

- [ ] **Step 3: Listen, then commit**

```bash
git add src/audio.js src/entities/monument.js
git commit -m "feat: the statue no longer lands with the sound of an egg"
```

---

### Task 7: The crowd surges

**Files:** Modify `src/render/background.js`, `src/render/finale.js`, `src/entities/monument.js`, `src/config.js`

**Interfaces:**
- `protesterSilhouette(ctx, c, tMs, baseY, s, tone, night, walk = 0, stridePhase = 0, surge = 0)`
- `drawTriumphCrowd(ctx, b, tMs, surge = 0)`, `drawTriumphForeRank(ctx, b, tMs, surge = 0)`
- Produces: `monumentSurge(m) -> 0..1`

The default of `0` is what makes this safe: the other five scenes pass nothing and are unchanged **by construction**, the same argument that already covers `walk` and `stridePhase`. No committed test — checked once with a throwaway stub-context harness whose `save()`/`restore()` push and pop `globalAlpha`.

- [ ] **Step 1: Add the surge parameter**

Raise both fists, add a jump offset (`-Math.round(surge * Math.abs(Math.sin(tMs * 0.012 + c.phase)) * u * 0.12)` on `baseY`), and scale the sway rate.

- [ ] **Step 2: Ramp it at impact**

To 1 over ~150ms, decaying to a raised baseline of ~0.35 that persists, so the crowd is still celebrating under the card rather than snapping back to an idle sway.

- [ ] **Step 3: Confetti from `sys.bits`**

`P.flag`, `P.flagEagle`, `P.egg`; upward velocity, low gravity, long ttl. No new particle type — the flag colours are already in the palette.

- [ ] **Step 4: Look at it, then commit**

```bash
git add src/render/background.js src/render/finale.js src/entities/monument.js src/config.js
git commit -m "feat: the crowd surges when it goes over"
```

---

### Task 8: The impact, and what the statue looks like

**Files:** Modify `src/render/finale.js`, `src/config.js`

All rendering. No tests — verified by running the game.

- [ ] **Step 1: Ankle stress cracks that deepen per hit**

So the figure carries its own damage rather than only the yolk, and the player can see how close the next throw is to finishing it without a progress bar.

- [ ] **Step 2: A breathing sway while standing**

An order of magnitude below the hit spring, so the bronze is never perfectly still.

- [ ] **Step 3: Draw the detached head and a torn neck stub**

Translate and rotate into the existing `statueHead()` — no new art, and it inherits the bronzed photograph and its fallback. The stub uses `P.bronzeLit`, matching the sheared metal `stumps()` already draws.

- [ ] **Step 4: A ground crack radiating from the impact**

- [ ] **Step 5: Replace the two dust ellipses with a directional plume**

Puffs along the fallen figure's length plus a fast ground-hugging ring, so the plume says the statue fell *that way*.

- [ ] **Step 6: Sharpen the shake**

```js
// Amplitude falls with the square of what is left, and the frequency is high enough to
// read as an impact. The old fixed-frequency sine decayed linearly and read as a wobble.
const k = Math.min(1, f.shake / F.SHAKE_MS);
const amp = F.SHAKE_PX * k * k;
```

Stays deterministic in `f.shake`, so a paused frame still does not jitter.

- [ ] **Step 7: Reuse `g.flash` for the impact flash** — do not add a second flash system.

- [ ] **Step 8: Look at it, then commit**

```bash
git add src/render/finale.js src/config.js
git commit -m "feat: the impact reads as bronze hitting stone"
```

---

### Task 9: The card, and shipping state

**Files:** Modify `src/render/finale.js`, `src/config.js`

- [ ] **Step 1: Punch the card up instead of fading it**

Scale from ~0.88 to 1 with a slight overshoot about the card's centre, alpha riding along.

- [ ] **Step 2: Set `DEBUG.START_IN_FINALE` back to `false`**

Its own comment in `config.js` requires this before release.

- [ ] **Step 3: Full verification**

Run: `npm test` — expected: all passing, no failures.
Then `npm start` and play the finale end to end: watch it once in full, then again skipping mid-fall.

- [ ] **Step 4: Commit**

```bash
git add src/render/finale.js src/config.js
git commit -m "feat: punch the victory card up, and restore shipping debug state"
```

---

## Self-Review

**Spec coverage.** Camera → Task 4. Time dilation → Task 2. Monument module → Task 1. Sculpture standing/falling/head → Tasks 3, 8. Impact → Task 8. Crowd + confetti → Task 7. Sounds → Task 6. Skip → Task 5. Card punch → Task 9. Test migration → Task 2 Step 1. Debug flag → Task 9. All covered.

**Type consistency.** `monumentBox`/`statueBox`, `monumentCardUp`/`finaleCardUp`, `monumentTimeScale`, `monumentCamera`, `monumentSurge`, `skipToSettled`, `hitMonument`, `updateMonument`, `createMonument` — each defined once and used under the same name throughout. `m.head` has the same seven fields in Tasks 3 and 5.

**Note carried into Task 5:** `skipToSettled` references `HEAD_REST_DX` and `HEAD_REST_ANGLE`, which Task 3's config block does not define. Add both to `config.js` in Task 3 and have the rolling sim clamp to them, so the skipped and the played resting positions agree.
