import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame, update, click, startAtRound, statueBox, finaleCardUp, pause, PHASE
} from '../src/state.js';
import { monumentTimeScale, monumentCamera } from '../src/entities/monument.js';
import { EGG, FINALE, ROUND, VIEW } from '../src/config.js';
import { quotaForRound, isFinalRound } from '../src/rules.js';

const silent = { sound() {} };
const INTRO_WAIT_MS = 1600;   // comfortably past state.js's INTRO_MS

/** Advance the game in 16ms frames. */
function run(g, ms) {
  for (let i = 0; i < Math.ceil(ms / 16); i += 1) update(g, 16);
}

/**
 * Advance until `pred` holds, then stop.
 *
 * The fall no longer takes FALL_MS of wall clock: time dilates through the teeter, so
 * m.ms counts finale time and the mapping to seconds depends on tuning constants. A test
 * that waited on a duration would break every time the slow motion was retuned, which is
 * exactly the kind of test that gets deleted rather than fixed. These wait on the state
 * they actually care about. The cap fails loudly rather than hanging.
 */
function runUntil(g, pred, what) {
  for (let i = 0; i < 4000 && !pred(g); i += 1) update(g, 16);
  assert.ok(pred(g), `never reached: ${what}`);
  return g;
}

/** Advance to the frame the statue lands on, however long that takes in wall clock. */
function runUntilDown(g) {
  return runUntil(g, (x) => x.finale.state === 'down', 'the statue landing');
}

/** A run sitting on the first PLAYING frame of `round`. */
function atRound(round) {
  const g = createGame(silent);
  startAtRound(g, round);
  run(g, INTRO_WAIT_MS);
  return g;
}

/**
 * Play the current round with perfect aim until `hits` have landed, then stop throwing
 * and let the rest escape so the round ends. The iteration cap is a guard; the callers
 * assert on the outcome regardless of why the loop exited, so a round that never ends
 * fails loudly rather than hanging.
 */
function playRound(g, hits) {
  for (let i = 0; i < 40000 && g.phase === PHASE.PLAYING; i += 1) {
    const t = g.targets.find((x) => x.state === 'flying');
    if (t && g.hits < hits && g.eggsLeft > 0) {
      t.vx = 0; t.wobble = 0; t.scared = 0;   // hold it still so the throw is exact
      click(g, t.x, t.y);
      run(g, EGG.FLIGHT_MS + 32);
    } else {
      update(g, 16);
    }
  }
  return g;
}

/** The centre of the statue's hitbox right now. */
function aimAt(g) {
  const b = statueBox(g.finale);
  return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
}

/** Throw one egg at (x, y) and let it land. */
function throwAt(g, x, y) {
  click(g, x, y);
  run(g, EGG.FLIGHT_MS + 32);
}

test('clearing the final round opens the finale instead of the next round', () => {
  const g = atRound(ROUND.FINAL_ROUND);
  playRound(g, quotaForRound(ROUND.FINAL_ROUND));
  assert.equal(g.phase, PHASE.FINALE);
  assert.equal(g.round, ROUND.FINAL_ROUND, 'the run must not advance past the final round');
  assert.ok(g.finale, 'the finale state must exist');
  assert.equal(g.finale.state, 'standing');
});

test('clearing the round before the final one still just clears', () => {
  const g = atRound(ROUND.FINAL_ROUND - 1);
  playRound(g, quotaForRound(ROUND.FINAL_ROUND - 1));
  assert.equal(g.phase, PHASE.CLEAR);
  assert.equal(g.finale, null);
});

test('failing the final round is still an ordinary game over', () => {
  const g = atRound(ROUND.FINAL_ROUND);
  playRound(g, 0);                      // throw nothing; every politician escapes
  assert.equal(g.phase, PHASE.OVER);
  assert.equal(g.finale, null);
});

test('isFinalRound covers the final round and anything past it', () => {
  assert.equal(isFinalRound(ROUND.FINAL_ROUND - 1), false);
  assert.equal(isFinalRound(ROUND.FINAL_ROUND), true);
  assert.equal(isFinalRound(ROUND.FINAL_ROUND + 5), true);
});

test('the finale banks the score the moment it opens', () => {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v))
  };
  try {
    const g = atRound(ROUND.FINAL_ROUND);
    playRound(g, quotaForRound(ROUND.FINAL_ROUND));
    assert.equal(g.phase, PHASE.FINALE);
    assert.ok(g.score > 0, 'the round just cleared must have scored');
    assert.equal(g.best, g.score, 'the win must be on the board without waiting for a click');
  } finally {
    delete globalThis.localStorage;
  }
});

test('eggs are unlimited in the finale, so it can never stall', () => {
  const g = atRound(ROUND.FINAL_ROUND);
  playRound(g, quotaForRound(ROUND.FINAL_ROUND));
  assert.equal(g.eggsLeft, 0, 'the counter is zeroed and must not be what gates a throw');
  for (let i = 0; i < 12; i += 1) {
    const before = g.eggs.length;
    click(g, 40, 60);                   // deliberately nowhere near the statue
    assert.equal(g.eggs.length, before + 1, `throw ${i + 1} must still produce an egg`);
    run(g, EGG.FLIGHT_MS + 32);
  }
  assert.equal(g.finale.state, 'standing', 'missing must never end the finale');
  assert.equal(g.finale.hits, 0);
});

test('each landed egg leans the statue further', () => {
  const g = atRound(ROUND.FINAL_ROUND);
  playRound(g, quotaForRound(ROUND.FINAL_ROUND));
  const p = aimAt(g);
  throwAt(g, p.x, p.y);
  assert.equal(g.finale.hits, 1);
  assert.ok(Math.abs(g.finale.rest - FINALE.LEAN_PER_HIT) < 1e-9);
  const first = g.finale.rest;
  const q = aimAt(g);
  throwAt(g, q.x, q.y);
  assert.equal(g.finale.hits, 2);
  assert.ok(g.finale.rest > first, 'the second hit must lean it further than the first');
});

test('the lean springs back toward its resting angle between hits', () => {
  const g = atRound(ROUND.FINAL_ROUND);
  playRound(g, quotaForRound(ROUND.FINAL_ROUND));
  const p = aimAt(g);
  throwAt(g, p.x, p.y);
  const kicked = g.finale.angle;
  assert.ok(kicked > g.finale.rest, 'impact must kick it past the tilt it keeps');
  run(g, 600);
  assert.ok(g.finale.angle < kicked, 'it must settle back');
  assert.ok(Math.abs(g.finale.angle - g.finale.rest) < 0.01, 'and settle to the resting tilt');
});

test('HITS_TO_TOPPLE hits bring it down, and it lands', () => {
  const g = atRound(ROUND.FINAL_ROUND);
  playRound(g, quotaForRound(ROUND.FINAL_ROUND));
  for (let i = 0; i < FINALE.HITS_TO_TOPPLE; i += 1) {
    const p = aimAt(g);
    throwAt(g, p.x, p.y);
    assert.equal(g.finale.hits, i + 1, `hit ${i + 1} must register`);
  }
  assert.equal(g.finale.state, 'falling');
  runUntilDown(g);
  assert.equal(g.finale.state, 'down');
  // Landed, but still rocking — so the angle sits near FALL_ANGLE rather than exactly on
  // it, either side. Bounded by the rock so a runaway oscillation still fails.
  assert.ok(Math.abs(g.finale.angle - FINALE.FALL_ANGLE) <= FINALE.SETTLE_ROCK + 1e-6,
    `landed angle ${g.finale.angle} is not within a rock of ${FINALE.FALL_ANGLE}`);
  run(g, FINALE.SETTLE_MS + 50);
  assert.ok(Math.abs(g.finale.angle - FINALE.FALL_ANGLE) < 1e-6,
    'and it must come to rest all the way over');
});

test('it teeters before it goes, instead of starting to rotate immediately', () => {
  const g = atRound(ROUND.FINAL_ROUND);
  playRound(g, quotaForRound(ROUND.FINAL_ROUND));
  for (let i = 0; i < FINALE.HITS_TO_TOPPLE; i += 1) {
    const p = aimAt(g);
    throwAt(g, p.x, p.y);
  }
  const rest = g.finale.rest;
  // Half way through the teeter in FINALE time, which is what TEETER is a fraction of.
  // Advancing a wall-clock duration here would land somewhere else entirely once the
  // slow motion is retuned.
  runUntil(g, (x) => x.finale.ms >= FINALE.FALL_MS * FINALE.TEETER * 0.5, 'mid-teeter');
  assert.equal(g.finale.drop, 0, 'it is still on its plinth while it hangs');
  assert.ok(g.finale.angle > rest, 'it rocks at the tipping point');
  assert.ok(g.finale.angle < rest + FINALE.TEETER_ROCK + 1e-6, 'but has not gone over yet');
  // Still far nearer the tilt it was left at than the ground it is heading for.
  assert.ok(g.finale.angle - rest < (FINALE.FALL_ANGLE - rest) * 0.1, 'nowhere near down');
});

test('it comes off the pedestal as it goes over, not just around', () => {
  const g = atRound(ROUND.FINAL_ROUND);
  playRound(g, quotaForRound(ROUND.FINAL_ROUND));
  assert.equal(g.finale.drop, 0, 'standing, it is on its plinth');
  for (let i = 0; i < FINALE.HITS_TO_TOPPLE; i += 1) {
    const p = aimAt(g);
    throwAt(g, p.x, p.y);
  }
  runUntilDown(g);
  assert.ok(Math.abs(g.finale.drop - FINALE.FALL_DROP) < 1e-6, 'it must have dropped');
  // Rotation about the plinth top alone would leave it lying a plinth's height in the
  // air. The head has to end up somewhere a fallen statue could actually be.
  const head = statueBox(g.finale);
  assert.ok(head.y + head.h > VIEW.GROUND_Y - 40,
    `the fallen statue is floating: box bottom ${head.y + head.h} vs ground ${VIEW.GROUND_Y}`);
});

test('a statue already going over cannot be thrown at or re-toppled', () => {
  const g = atRound(ROUND.FINAL_ROUND);
  playRound(g, quotaForRound(ROUND.FINAL_ROUND));
  for (let i = 0; i < FINALE.HITS_TO_TOPPLE; i += 1) {
    const p = aimAt(g);
    throwAt(g, p.x, p.y);
  }
  assert.equal(g.finale.state, 'falling');
  const hits = g.finale.hits;
  const before = g.eggs.length;
  click(g, VIEW.W / 2, 120);
  assert.equal(g.eggs.length, before, 'no egg may be thrown once it is falling');
  assert.equal(g.finale.hits, hits);
});

test('the hitbox swings with the lean, so aim has to follow it over', () => {
  const upright = statueBox({ angle: 0 });
  const leaning = statueBox({ angle: 0.6 });
  assert.ok(leaning.x > upright.x, 'leaning must carry the box away from centre');
  assert.ok(leaning.y > upright.y, 'and down, as the top swings toward the ground');
  const wasCentre = { x: upright.x + upright.w / 2, y: upright.y + upright.h / 2 };
  const stillHits = wasCentre.x >= leaning.x && wasCentre.x <= leaning.x + leaning.w
    && wasCentre.y >= leaning.y && wasCentre.y <= leaning.y + leaning.h;
  assert.equal(stillHits, false, 'the upright aim point must miss once it has gone over');
});

test('the victory card waits for the statue to be down and still', () => {
  const g = atRound(ROUND.FINAL_ROUND);
  playRound(g, quotaForRound(ROUND.FINAL_ROUND));
  assert.equal(finaleCardUp(g.finale), false);
  for (let i = 0; i < FINALE.HITS_TO_TOPPLE; i += 1) {
    const p = aimAt(g);
    throwAt(g, p.x, p.y);
  }
  runUntilDown(g);
  assert.equal(g.finale.state, 'down');
  assert.equal(finaleCardUp(g.finale), false, 'not while the dust is still settling');
  click(g, VIEW.W / 2, VIEW.H / 2);
  assert.equal(g.phase, PHASE.FINALE, 'and a click before it is up must not leave');
  run(g, FINALE.CARD_DELAY_MS + 50);
  assert.equal(finaleCardUp(g.finale), true);
  click(g, VIEW.W / 2, VIEW.H / 2);
  assert.equal(g.phase, PHASE.MENU, 'the card dismisses to the title');
});

test('the head breaks off when it lands, and rolls to a stop on the ground', () => {
  const g = atRound(ROUND.FINAL_ROUND);
  playRound(g, quotaForRound(ROUND.FINAL_ROUND));
  for (let i = 0; i < FINALE.HITS_TO_TOPPLE; i += 1) {
    const p = aimAt(g);
    throwAt(g, p.x, p.y);
  }
  assert.equal(g.finale.head, null, 'it is still attached the whole way down');
  runUntilDown(g);
  const h = g.finale.head;
  assert.ok(h, 'the impact must shear the head off');
  const from = h.x;
  runUntil(g, (x) => x.finale.head.resting, 'the head coming to rest');
  assert.ok(Math.abs(g.finale.head.y - (VIEW.GROUND_Y - FINALE.HEAD_REST_Y)) < 1e-6,
    `the head came to rest floating at y=${g.finale.head.y}`);
  assert.ok(g.finale.head.x > from, 'it must travel away from the plinth, not drop at its feet');
  assert.ok(g.finale.head.bounces > 0, 'and bounce rather than landing dead');
});

test('the head stays inside the view, however it is tuned', () => {
  const g = atRound(ROUND.FINAL_ROUND);
  playRound(g, quotaForRound(ROUND.FINAL_ROUND));
  for (let i = 0; i < FINALE.HITS_TO_TOPPLE; i += 1) {
    const p = aimAt(g);
    throwAt(g, p.x, p.y);
  }
  runUntilDown(g);
  // The launch and friction constants are tuned by eye, and it would be very easy to tune
  // the head straight off the right-hand edge of a 480px view without noticing in a test
  // that only checked it landed. The whole point is that the player watches it stop.
  runUntil(g, (x) => x.finale.head.resting, 'the head coming to rest');
  const h = g.finale.head;
  assert.ok(h.x > 0 && h.x < VIEW.W - FINALE.HEAD_RADIUS,
    `the head rolled out of view, to x=${h.x} in a ${VIEW.W}px scene`);
});

/** A run whose statue has just been toppled and is on its way over. */
function toppled() {
  const g = atRound(ROUND.FINAL_ROUND);
  playRound(g, quotaForRound(ROUND.FINAL_ROUND));
  for (let i = 0; i < FINALE.HITS_TO_TOPPLE; i += 1) {
    const p = aimAt(g);
    throwAt(g, p.x, p.y);
  }
  assert.equal(g.finale.state, 'falling');
  return g;
}

test('a click during the fall skips to the finished frame', () => {
  const g = toppled();
  run(g, 600);
  click(g, VIEW.W / 2, VIEW.H / 2);
  assert.equal(g.finale.state, 'down');
  assert.equal(finaleCardUp(g.finale), true, 'the card must be up at once, not after a wait');
  assert.ok(g.finale.head?.resting, 'and the head parked where it would have stopped');
  assert.equal(monumentCamera(g.finale).zoom, 1, 'with the camera home');
});

test('the skipped ending is the same frame the played one reaches', () => {
  // The skip fast-forwards the real head simulation rather than parking it at a stored
  // position, so the two must agree exactly. A hardcoded rest position would drift out of
  // agreement the first time the launch or the friction was retuned.
  const played = toppled();
  runUntilDown(played);
  runUntil(played, (x) => x.finale.head.resting, 'the head coming to rest');

  const skipped = toppled();
  run(skipped, 600);
  click(skipped, VIEW.W / 2, VIEW.H / 2);

  assert.ok(Math.abs(played.finale.head.x - skipped.finale.head.x) < 1e-9,
    `skipped head rests at ${skipped.finale.head.x}, played at ${played.finale.head.x}`);
  assert.ok(Math.abs(played.finale.head.y - skipped.finale.head.y) < 1e-9);
  assert.equal(played.finale.head.bounces, skipped.finale.head.bounces);
});

test('the skip is locked out at the very start of the fall', () => {
  const g = toppled();
  click(g, VIEW.W / 2, VIEW.H / 2);
  assert.equal(g.finale.state, 'falling',
    'a click already in flight when the sixth egg lands must not skip the topple');
  assert.equal(g.finale.head, null);
});

test('clicking while it still stands throws an egg rather than skipping', () => {
  const g = atRound(ROUND.FINAL_ROUND);
  playRound(g, quotaForRound(ROUND.FINAL_ROUND));
  const before = g.eggs.length;
  click(g, 200, 120);
  assert.equal(g.eggs.length, before + 1, 'the finale is played, not watched');
  assert.equal(g.finale.state, 'standing');
});

test('the camera never moves while the player is throwing', () => {
  // The whole feature rests on this. statueBox() returns world coordinates with no notion
  // of a camera, so any zoom during the interactive phase would need an inverse transform
  // on every click and could desync the hitbox from the drawn figure.
  const g = atRound(ROUND.FINAL_ROUND);
  playRound(g, quotaForRound(ROUND.FINAL_ROUND));
  for (let i = 0; i < FINALE.HITS_TO_TOPPLE - 1; i += 1) {
    const p = aimAt(g);
    throwAt(g, p.x, p.y);
    assert.equal(monumentCamera(g.finale).zoom, 1, `zoomed after hit ${i + 1}`);
  }
  run(g, 1200);
  assert.equal(monumentCamera(g.finale).zoom, 1, 'nor while it settles between throws');
});

test('the camera is home again before the victory card is drawn', () => {
  const g = atRound(ROUND.FINAL_ROUND);
  playRound(g, quotaForRound(ROUND.FINAL_ROUND));
  for (let i = 0; i < FINALE.HITS_TO_TOPPLE; i += 1) {
    const p = aimAt(g);
    throwAt(g, p.x, p.y);
  }
  runUntil(g, (x) => monumentCamera(x.finale).zoom > 1, 'the camera pushing in');
  runUntilDown(g);
  runUntil(g, (x) => finaleCardUp(x.finale), 'the victory card');
  assert.equal(monumentCamera(g.finale).zoom, 1,
    'the card is drawn at identity scale, so the world under it must be too');
  assert.ok(FINALE.CAM_HOLD_MS + FINALE.CAM_OUT_MS < FINALE.CARD_DELAY_MS,
    'the camera must finish easing out before the card is due');
});

test('time dilates through the teeter and is back to normal before it lands', () => {
  assert.equal(monumentTimeScale({ state: 'standing', ms: 0 }), 1,
    'nothing may slow down while the player is still throwing');
  const teeter = monumentTimeScale({ state: 'falling', ms: FINALE.FALL_MS * 0.1 });
  assert.ok(teeter < 1, 'the tipping point must run slow');
  assert.ok(teeter > 0, 'but never stop');
  assert.equal(monumentTimeScale({ state: 'falling', ms: FINALE.FALL_MS }), 1,
    'an impact in slow motion reads as weightless, so it must be at full speed by then');
  assert.equal(monumentTimeScale({ state: 'down', ms: 0 }), 1);
  assert.equal(monumentTimeScale(null), 1, 'and no monument at all is not slow motion');
});

test('the finale can be paused, and pausing genuinely stops it', () => {
  const g = atRound(ROUND.FINAL_ROUND);
  playRound(g, quotaForRound(ROUND.FINAL_ROUND));
  const p = aimAt(g);
  click(g, p.x, p.y);
  pause(g);
  assert.equal(g.phase, PHASE.PAUSED);
  assert.equal(g.pausedFrom, PHASE.FINALE);
  const egg = { ...g.eggs[0] };
  const angle = g.finale.angle;
  run(g, 2000);
  assert.deepEqual({ ...g.eggs[0] }, egg, 'the egg in flight must not move');
  assert.equal(g.finale.angle, angle, 'and the statue must not settle');
});
