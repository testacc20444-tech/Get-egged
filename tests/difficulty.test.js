import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, update, click, hudView, startAtRound, PHASE } from '../src/state.js';
import { ROUND, FEEL, FIGURES } from '../src/config.js';
import { targetsPerRelease } from '../src/rules.js';
import { spawnTarget, targetBox, hitBox } from '../src/entities/target.js';

/**
 * The round-3 cliff. `release()` used to hand out a flat EGGS_PER_RELEASE however many
 * politicians it had just spawned, so eggs per target silently halved from 3.0 to 1.5
 * on the round pairs begin — on the same round the quota rose and the speed ramped.
 * Simulated against the real engine, a casual player won 0 of 500 runs and died on
 * round 3 in 53% of them.
 *
 * The fix is structural rather than compensating: eggs are counted per TARGET, so no
 * future change to PAIRS_FROM_ROUND — and no release that spawns a single because only
 * one is left in the round — can bring the cliff back. These tests pin that invariant,
 * not the particular numbers around it.
 */

const silent = { sound() {} };

const run = (g, ms) => { for (let i = 0; i < Math.ceil(ms / 16); i += 1) update(g, 16); };

/** Start a run at `round` and stop on the first frame of play. */
function playingAt(round) {
  const g = createGame(silent);
  startAtRound(g, round);
  for (let i = 0; i < 400 && g.phase !== PHASE.PLAYING; i += 1) update(g, 16);
  assert.equal(g.phase, PHASE.PLAYING, `round ${round} never reached play`);
  return g;
}

test('a release hands out eggs for every politician in it, not a flat three', () => {
  const single = playingAt(1);
  assert.equal(single.targets.length, 1, 'round 1 releases one at a time');
  assert.equal(single.eggsLeft, ROUND.EGGS_PER_TARGET);

  const pair = playingAt(3);
  assert.equal(pair.targets.length, 2, 'round 3 releases a pair');
  assert.equal(pair.eggsLeft, 2 * ROUND.EGGS_PER_TARGET,
    'a pair must come with a pair\'s worth of eggs');
});

test('eggs per target never changes across the whole game', () => {
  for (let round = 1; round <= ROUND.FINAL_ROUND; round += 1) {
    const g = playingAt(round);
    assert.equal(g.targets.length, targetsPerRelease(round), `round ${round} spawn count`);
    assert.equal(g.eggsLeft / g.targets.length, ROUND.EGGS_PER_TARGET,
      `round ${round} gave ${g.eggsLeft} eggs for ${g.targets.length} targets`);
  }
});

test('the HUD reports the current release total, not a constant', () => {
  const single = hudView(playingAt(1));
  assert.equal(single.eggsTotal, ROUND.EGGS_PER_TARGET);
  assert.equal(single.eggsLeft, ROUND.EGGS_PER_TARGET);

  const pair = playingAt(3);
  assert.equal(hudView(pair).eggsTotal, 2 * ROUND.EGGS_PER_TARGET,
    'six slots for six eggs, or the row lies about what is left');
  click(pair, 5, 5);
  assert.equal(hudView(pair).eggsTotal, 2 * ROUND.EGGS_PER_TARGET, 'the total is not the remainder');
  assert.equal(hudView(pair).eggsLeft, 2 * ROUND.EGGS_PER_TARGET - 1);
});

/**
 * The hitbox an egg is tested against is padded; the box that decides whether a figure
 * has ARRIVED is not. Padding both would quietly delay the entry gate and change escape
 * timing, which is why these are two functions rather than one with a wider box.
 */
test('the hit box is padded on every side and the sprite box is not', () => {
  const t = spawnTarget(0, 1, 'left');
  t.x = 200; t.y = 100;
  const sprite = targetBox(t);
  const hit = hitBox(t);

  assert.equal(sprite.w, FIGURES[0].w, 'the sprite box must stay the drawn size');
  assert.equal(sprite.h, FIGURES[0].h);
  assert.equal(hit.w, sprite.w + FEEL.HIT_PAD * 2, 'padded on both sides, not just one');
  assert.equal(hit.h, sprite.h + FEEL.HIT_PAD * 2);
  assert.equal(hit.x, sprite.x - FEEL.HIT_PAD, 'and centred on the same point');
  assert.equal(hit.y, sprite.y - FEEL.HIT_PAD);
});

test('an egg just outside the sprite still counts, one well outside does not', () => {
  const g = playingAt(1);
  const t = g.targets[0];
  t.x = 200; t.y = 100; t.vx = 0; t.wobble = 0;

  // Just past the sprite edge but inside the pad: generous, and invisible in play.
  const edge = t.x + t.w / 2 + FEEL.HIT_PAD - 0.5;
  click(g, edge, t.y);
  run(g, 400);
  assert.equal(g.hits, 1, 'a throw within the pad must land');

  const g2 = playingAt(1);
  const t2 = g2.targets[0];
  t2.x = 200; t2.y = 100; t2.vx = 0; t2.wobble = 0;
  click(g2, t2.x + t2.w / 2 + FEEL.HIT_PAD + 4, t2.y);
  run(g2, 400);
  assert.equal(g2.hits, 0, 'the pad must not become a free hit anywhere near the figure');
});
