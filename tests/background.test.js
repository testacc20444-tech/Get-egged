import { test } from 'node:test';
import assert from 'node:assert/strict';
import { backdropForRound, createBackdrop } from '../src/render/background.js';
import { VIEW, FEEL } from '../src/config.js';

// Scene order is the story the rounds tell, so it is pinned here: the coast, the
// island, the square, the march, the parliament, and Tirana at night last.
const LAGOON = 0, SAZAN = 1, SHESHI = 2, MARCH = 3, PARLAMENTI = 4, TIRANA = 5;
const SCENE_COUNT = 6;

test('rounds walk the six scenes in route order', () => {
  assert.equal(backdropForRound(1), LAGOON);
  assert.equal(backdropForRound(2), SAZAN);
  assert.equal(backdropForRound(3), SHESHI);
  assert.equal(backdropForRound(4), MARCH);
  assert.equal(backdropForRound(5), PARLAMENTI);
  assert.equal(backdropForRound(6), TIRANA);
});

test('the march sits between the square and the parliament', () => {
  // The middle scene is the journey between its two neighbours, so it is only
  // coherent immediately after the square and immediately before the parliament.
  // Reordering the scene list must not quietly break that.
  assert.equal(MARCH - SHESHI, 1);
  assert.equal(PARLAMENTI - MARCH, 1);
  assert.equal(backdropForRound(4) - backdropForRound(3), 1);
  assert.equal(backdropForRound(5) - backdropForRound(4), 1);
});

test('the rotation cycles and never leaves the scene list', () => {
  assert.equal(backdropForRound(7), LAGOON);
  assert.equal(backdropForRound(12), TIRANA);
  for (let round = 1; round <= 200; round += 1) {
    const i = backdropForRound(round);
    assert.ok(Number.isInteger(i) && i >= 0 && i < SCENE_COUNT, `round ${round} -> ${i}`);
  }
});

test('square trees hug the edges and leave the centre building clear', () => {
  // A tree standing in front of the Polytechnic or the Kuvendi is the one thing that
  // cannot be nudged at draw time, so the generator has to guarantee it.
  for (let attempt = 0; attempt < 40; attempt += 1) {
    for (const t of createBackdrop().squareTrees) {
      assert.ok(t.x >= 0 && t.x <= VIEW.W, `tree off frame at ${t.x}`);
      assert.ok(Math.abs(t.x - VIEW.W / 2) > 120, `tree at ${t.x} covers the facade`);
    }
  }
});

test('no tree canopy reaches the band the politicians fly through', () => {
  // boulevardTree tops out at baseY - h, drawn from VIEW.GROUND_Y + 2.
  for (let attempt = 0; attempt < 40; attempt += 1) {
    for (const t of createBackdrop().squareTrees) {
      const top = VIEW.GROUND_Y + 2 - t.h;
      assert.ok(top > FEEL.FLY_Y_MAX, `canopy top ${top} intrudes past ${FEEL.FLY_Y_MAX}`);
    }
  }
});
