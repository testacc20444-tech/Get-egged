import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnTarget, updateTarget, targetBox, hitTarget, nearMissScare, flee } from '../src/entities/target.js';
import { VIEW, FIGURES, FEEL, ROUND } from '../src/config.js';

const BERISHA = FIGURES.findIndex((f) => f.id === 'berisha'); // the most erratic figure
const FRAME_MS = 16;

/**
 * Run `body` with Math.random replaced by `stub` (a function, or a fixed value),
 * restoring the real one even if `body` throws, so no stub can leak into another test.
 */
function withRandom(stub, body) {
  const real = Math.random;
  Math.random = typeof stub === 'function' ? stub : () => stub;
  try {
    return body();
  } finally {
    Math.random = real;
  }
}

/** Rolls one 0 — below any swerve chance — then only 1s: exactly one swerve, then straight. */
function swerveOnce() {
  let rolls = 0;
  return () => (rolls++ === 0 ? 0 : 1);
}

/** The whole hitbox is inside the view: the figure has genuinely arrived. */
function fullyInsideView(t) {
  const box = targetBox(t);
  return box.x >= 0 && box.x + box.w <= VIEW.W;
}

/** No part of the hitbox is drawn: there is nothing for the player to aim at. */
function completelyOutsideView(t) {
  const box = targetBox(t);
  return box.x + box.w <= 0 || box.x >= VIEW.W;
}

/** Step until the target reports a terminal result or `maxMs` runs out. */
function runUntilDone(t, { stepMs = FRAME_MS, maxMs = 20000 } = {}) {
  for (let ms = stepMs; ms <= maxMs; ms += stepMs) {
    const result = updateTarget(t, stepMs);
    if (result === 'escaped' || result === 'landed') return { result, ms };
  }
  return { result: 'never', ms: maxMs };
}

/** Fly a freshly spawned target in until its whole hitbox is inside the view. */
function flyIn(t) {
  withRandom(1, () => {
    for (let i = 0; i < 400 && !fullyInsideView(t); i += 1) updateTarget(t, FRAME_MS);
  });
  assert.equal(fullyInsideView(t), true, 'fixture failed to bring the figure into view');
}

test('a figure forced to swerve on its first frame never escapes before it has entered the view', () => {
  const t = spawnTarget(BERISHA, 1, 'left');
  withRandom(swerveOnce(), () => {
    // Capped below escapeMs so only the off-screen route can end this figure.
    for (let elapsed = 0; elapsed < 4000 && !fullyInsideView(t); elapsed += FRAME_MS) {
      const result = updateTarget(t, FRAME_MS);
      assert.notEqual(
        result,
        'escaped',
        `escaped after ${t.life}ms at x=${t.x.toFixed(1)}, before ever entering the view`
      );
    }
  });
  assert.equal(fullyInsideView(t), true, 'the figure should commit to its entrance');
});

test('a figure that reverses the instant it enters still gets a beat before its exit counts', () => {
  const t = spawnTarget(BERISHA, 1, 'left');
  t.escapeMs = 60000; // isolate the off-screen route from the timeout backstop
  flyIn(t);

  t.vx = -4; // a lurch straight back out: off-screen again on the very next frame
  const early = runUntilDone(t, { maxMs: 400 });
  assert.equal(early.result, 'never', `escaped after only ${early.ms}ms on screen`);

  const later = runUntilDone(t, { maxMs: 4000 });
  assert.equal(later.result, 'escaped', 'the dwell floor must delay the escape, not cancel it');
});

test('a figure that has entered and then flies off an edge does escape', () => {
  const t = spawnTarget(BERISHA, 1, 'left');
  t.escapeMs = 60000; // isolate the off-screen route from the timeout backstop
  flyIn(t);

  t.x = VIEW.W - t.w; // still travelling right, now at the far edge
  const { result } = withRandom(1, () => runUntilDone(t, { maxMs: 6000 }));
  assert.equal(result, 'escaped');
  assert.ok(completelyOutsideView(t), `left the view; x was ${t.x.toFixed(1)}`);
  assert.ok(t.life < t.escapeMs, 'it should be the edge that ended it, not the timer');
});

test('the escape timer still fires for a figure that never entered the view', () => {
  const t = spawnTarget(BERISHA, 1, 'left');
  t.vx = 0;           // stalled just off the left edge: it will never enter
  t.escapeMs = 500;
  const { result, ms } = runUntilDone(t, { maxMs: 4000 });
  assert.equal(result, 'escaped');
  assert.equal(fullyInsideView(t), false, 'the fixture is meant to never enter');
  assert.ok(ms <= 500 + FRAME_MS, `the backstop fired late, at ${ms}ms`);
});

test('the escape timer still ends a figure that entered and then loitered', () => {
  const t = spawnTarget(BERISHA, 1, 'left');
  flyIn(t);
  t.vx = 0; // hovering in the middle of the sky, never reaching an edge
  const { result } = runUntilDone(t, { maxMs: 8000 });
  assert.equal(result, 'escaped');
  assert.ok(t.life >= t.escapeMs, 'the timeout is what should have ended it');
});

test('flee boosts the figure in the direction it is already travelling and pulls its deadline in', () => {
  const t = spawnTarget(BERISHA, 1, 'left'); // travelling right, away from its nearest edge
  withRandom(1, () => updateTarget(t, 200));
  const vxBefore = t.vx;
  const escapeBefore = t.escapeMs;

  flee(t);

  assert.equal(t.fleeing, true);
  assert.ok(Math.abs(t.vx - vxBefore * FEEL.FLEE_BOOST) < 1e-9, `vx was ${t.vx}`);
  assert.ok(t.vx > 0, 'the direction of travel is kept deliberately, not turned toward the near edge');
  assert.equal(t.escapeMs, t.life + FEEL.FLEE_WINDOW_MS);
  assert.ok(t.escapeMs < escapeBefore);
});

test('a fleeing figure that has not yet entered still leaves within the flee window', () => {
  const t = spawnTarget(BERISHA, 1, 'left');
  flee(t);
  assert.equal(fullyInsideView(t), false, 'it flees before it has arrived');
  const { result, ms } = runUntilDone(t, { maxMs: 8000 });
  assert.equal(result, 'escaped');
  assert.ok(ms <= FEEL.FLEE_WINDOW_MS + FRAME_MS, `it lingered for ${ms}ms`);
});

test('a near miss panics a flying figure and is ignored once it is falling', () => {
  const t = spawnTarget(BERISHA, 1, 'left');
  const phaseBefore = t.phase;
  nearMissScare(t);
  assert.equal(t.scared, FEEL.SCARE_MS);
  assert.ok(Math.abs(t.phase - (phaseBefore + Math.PI / 2)) < 1e-9);

  hitTarget(t);
  t.scared = 0;
  nearMissScare(t);
  assert.equal(t.scared, 0, 'a tumbling figure cannot be scared');
});

test('an egged figure tumbles to the ground and reports landed', () => {
  const t = spawnTarget(BERISHA, 1, 'left');
  flyIn(t);
  hitTarget(t);
  assert.equal(t.state, 'falling');

  const { result } = runUntilDone(t, { maxMs: 4000 });
  assert.equal(result, 'landed');
  assert.equal(t.y, VIEW.GROUND_Y);
  assert.equal(t.state, 'gone');
  assert.ok(t.rot > 0, 'it should have tumbled on the way down');
});

test('an egged figure still lands even if it was hit before it entered the view', () => {
  const t = spawnTarget(BERISHA, 1, 'left');
  hitTarget(t);
  const { result } = runUntilDone(t, { maxMs: 4000 });
  assert.equal(result, 'landed');
});

test('no spawn can be stranded: every figure escapes or lands by its escape deadline', () => {
  // 0 swerves on every roll, 1 never swerves: the two extremes of the wobble.
  for (const roll of [0, 0.5, 1]) {
    for (let figure = 0; figure < FIGURES.length; figure += 1) {
      for (const side of ['left', 'right']) {
        for (const round of [1, 12]) {
          const t = spawnTarget(figure, round, side);
          const { result, ms } = withRandom(roll, () => runUntilDone(t, { maxMs: 30000 }));
          const where = `${FIGURES[figure].id} from ${side}, round ${round}, roll ${roll}`;
          assert.ok(result === 'escaped' || result === 'landed', `${where} never finished`);
          assert.ok(ms <= t.escapeMs + FRAME_MS, `${where} outlived its deadline by ${ms - t.escapeMs}ms`);
        }
      }
    }
  }
});

test('the entry gate cannot outlast the round escape floor', () => {
  // A figure must be able to arrive, dwell and still be killable by the round's
  // own timer, which bottoms out at ROUND.ESCAPE_MS_MIN.
  for (let figure = 0; figure < FIGURES.length; figure += 1) {
    for (const side of ['left', 'right']) {
      const t = spawnTarget(figure, 1, side); // round 1 = slowest figures of all
      withRandom(1, () => {
        for (let i = 0; i < 400 && !fullyInsideView(t); i += 1) updateTarget(t, FRAME_MS);
      });
      assert.equal(fullyInsideView(t), true, `${FIGURES[figure].id} from ${side} never entered`);
      assert.ok(
        t.life < ROUND.ESCAPE_MS_MIN,
        `${FIGURES[figure].id} from ${side} took ${t.life}ms to enter, past the ${ROUND.ESCAPE_MS_MIN}ms floor`
      );
    }
  }
});
