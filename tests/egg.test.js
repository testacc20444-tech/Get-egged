import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnEgg, updateEgg, eggArcHeight } from '../src/entities/egg.js';
import { EGG } from '../src/config.js';

/** Run an egg to completion in fixed steps; return ms elapsed when it landed. */
function flyToLanding(egg, stepMs = 10) {
  let elapsed = 0;
  for (let i = 0; i < 1000; i += 1) {
    elapsed += stepMs;
    if (updateEgg(egg, stepMs)) return elapsed;
  }
  throw new Error('egg never landed');
}

test('egg spawns at the hand position', () => {
  const egg = spawnEgg(100, 80, true);
  assert.equal(egg.x, EGG.HAND_X);
  assert.equal(egg.y, EGG.HAND_Y);
  assert.equal(egg.landed, false);
  assert.equal(egg.isFirstEgg, true);
});

test('egg lands exactly on the clicked point', () => {
  const egg = spawnEgg(100, 80, false);
  flyToLanding(egg);
  assert.ok(Math.abs(egg.x - 100) < 1e-6, `x was ${egg.x}`);
  assert.ok(Math.abs(egg.y - 80) < 1e-6, `y was ${egg.y}`);
  assert.equal(egg.landed, true);
});

test('flight time is constant regardless of distance', () => {
  const near = flyToLanding(spawnEgg(EGG.HAND_X + 5, EGG.HAND_Y - 5, false), 5);
  const far = flyToLanding(spawnEgg(10, 10, false), 5);
  assert.equal(near, far);
  assert.ok(near >= EGG.FLIGHT_MS && near < EGG.FLIGHT_MS + 5);
});

test('updateEgg reports landing exactly once', () => {
  const egg = spawnEgg(200, 100, false);
  let landings = 0;
  for (let i = 0; i < 100; i += 1) if (updateEgg(egg, 20)) landings += 1;
  assert.equal(landings, 1);
});

test('egg rises above the straight line mid-flight', () => {
  const egg = spawnEgg(400, EGG.HAND_Y, false);
  updateEgg(egg, EGG.FLIGHT_MS / 2);
  // Target is at hand height, so any negative offset from HAND_Y is arc rise.
  assert.ok(egg.y < EGG.HAND_Y - 10, `expected arc rise, y was ${egg.y}`);
});

test('eggArcHeight matches the peak rise the trajectory actually applies', () => {
  const egg = spawnEgg(EGG.HAND_X + 200, EGG.HAND_Y, false);
  updateEgg(egg, EGG.FLIGHT_MS / 2);
  // Target sits at hand height, so the straight-line y at mid-flight is HAND_Y.
  assert.equal(EGG.HAND_Y - egg.y, eggArcHeight());
});
