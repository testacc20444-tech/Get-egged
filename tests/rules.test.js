import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  quotaForRound, speedMultiplier, escapeMsForRound, targetsPerRelease,
  scoreForHit, applyPenalty, pointInBox, roundPassed
} from '../src/rules.js';
import { ROUND, SCORE } from '../src/config.js';

test('quota follows the spec table', () => {
  assert.equal(quotaForRound(1), 6);
  assert.equal(quotaForRound(2), 6);
  assert.equal(quotaForRound(3), 7);
  assert.equal(quotaForRound(5), 7);
  assert.equal(quotaForRound(6), 8);
  assert.equal(quotaForRound(9), 8);
  assert.equal(quotaForRound(10), 9);
  assert.equal(quotaForRound(99), 9);
});

test('round 1 has no speed ramp and later rounds ramp but stay capped', () => {
  assert.equal(speedMultiplier(1), 1);
  assert.ok(Math.abs(speedMultiplier(2) - ROUND.SPEED_RAMP) < 1e-9);
  assert.ok(speedMultiplier(3) > speedMultiplier(2));
  assert.equal(speedMultiplier(99), ROUND.SPEED_CAP);
});

test('escape time shrinks with rounds but never below the floor', () => {
  assert.equal(escapeMsForRound(1), ROUND.ESCAPE_MS_BASE);
  assert.equal(escapeMsForRound(2), ROUND.ESCAPE_MS_BASE - ROUND.ESCAPE_MS_STEP);
  assert.equal(escapeMsForRound(99), ROUND.ESCAPE_MS_MIN);
});

test('releases are singles early and pairs from round 3', () => {
  assert.equal(targetsPerRelease(1), 1);
  assert.equal(targetsPerRelease(2), 1);
  assert.equal(targetsPerRelease(3), 2);
  assert.equal(targetsPerRelease(12), 2);
});

test('scoring uses figure base points and the first-egg bonus', () => {
  assert.equal(scoreForHit('rama', false), 500);
  assert.equal(scoreForHit('rama', true), 750);
  assert.equal(scoreForHit('balla', false), 1200);
  assert.equal(scoreForHit('balla', true), 1800);
});

test('scoreForHit throws on an unknown figure rather than scoring zero', () => {
  assert.throws(() => scoreForHit('nobody', false), /unknown figure/i);
});

test('penalty subtracts and floors at zero', () => {
  assert.equal(applyPenalty(1000), 1000 - SCORE.DECOY_PENALTY);
  assert.equal(applyPenalty(100), 0);
  assert.equal(applyPenalty(0), 0);
});

test('pointInBox includes edges and excludes outside', () => {
  const box = { x: 10, y: 20, w: 30, h: 40 };
  assert.equal(pointInBox(10, 20, box), true);
  assert.equal(pointInBox(40, 60, box), true);
  assert.equal(pointInBox(25, 40, box), true);
  assert.equal(pointInBox(9.9, 40, box), false);
  assert.equal(pointInBox(25, 60.1, box), false);
});

test('roundPassed compares hits against the round quota', () => {
  assert.equal(roundPassed(5, 1), false);
  assert.equal(roundPassed(6, 1), true);
  assert.equal(roundPassed(8, 10), false);
  assert.equal(roundPassed(9, 10), true);
});
