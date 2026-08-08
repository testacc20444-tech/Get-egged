import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame, update, click, hudView, pauseView, pause, resume, togglePause,
  pauseItems, pauseHover, movePauseSelection, activatePauseItem, PHASE
} from '../src/state.js';
import { EGG, FIGURES, ROUND, SCORE } from '../src/config.js';
import { quotaForRound } from '../src/rules.js';

const silent = { sound() {} };
const CLEAR_WAIT_MS = 2000;   // comfortably past state.js's CLEAR_MS

/** Advance the game in 16ms frames. */
function run(game, ms) {
  for (let i = 0; i < Math.ceil(ms / 16); i += 1) update(game, 16);
}

/**
 * Play round 1 with perfect aim: egg the first `quota` politicians, then stop
 * throwing and let the rest escape, so the round ends having met the quota.
 * The iteration cap is a guard — the closing assertions run regardless of why
 * the loop exited, so a round that never clears fails loudly.
 */
function playUntilClear(g) {
  const quota = quotaForRound(1);
  for (let i = 0; i < 8000 && g.phase === PHASE.PLAYING; i += 1) {
    const t = g.targets.find((x) => x.state === 'flying');
    if (t && g.hits < quota && g.eggsLeft > 0) {
      t.vx = 0; t.wobble = 0; t.scared = 0;   // hold it still so the throw is exact
      click(g, t.x, t.y);
      run(g, EGG.FLIGHT_MS + 32);
    } else {
      update(g, 16);
    }
  }
  return g;
}

/** Start a run and stop on the first PLAYING frame. */
function playing(g) {
  click(g, 100, 100);
  run(g, 1600);
  assert.equal(g.phase, PHASE.PLAYING);
  return g;
}

/** Point the pause highlight at an item by id, and hand back its box. */
function selectPauseItem(g, id) {
  const items = pauseItems();
  const i = items.findIndex((item) => item.id === id);
  assert.notEqual(i, -1, `no pause item called ${id}`);
  g.pauseIndex = i;
  return items[i].box;
}

/** The centre of a box, in logical coordinates — where a click on it would land. */
function centreOf(box) {
  return [box.x + box.w / 2, box.y + box.h / 2];
}

/**
 * Everything that must not have budged while the game was paused. Serialised whole
 * rather than field by field so it stays honest about entity internals it does not
 * know the names of — a new field on a target is covered the day it is added.
 */
function snapshot(g) {
  return JSON.stringify({
    clock: g.clock,
    phaseMs: g.phaseMs,
    releaseGap: g.releaseGap,
    toast: g.toast,
    flash: g.flash,
    targets: g.targets,
    eggs: g.eggs,
    decoys: g.decoys,
    particles: g.particles
  });
}

/** An in-memory stand-in for localStorage, which Node does not usefully provide. */
function installStore() {
  const map = new Map();
  globalThis.localStorage = {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v))
  };
  return map;
}

test('a new game starts on the menu with no entities', () => {
  const g = createGame(silent);
  assert.equal(g.phase, PHASE.MENU);
  assert.equal(g.targets.length, 0);
  assert.equal(g.score, 0);
  assert.equal(g.round, 1);
});

test('clicking the menu starts round 1', () => {
  const g = createGame(silent);
  click(g, 100, 100);
  assert.equal(g.phase, PHASE.INTRO);
  run(g, 1600);
  assert.equal(g.phase, PHASE.PLAYING);
  assert.equal(g.targets.length, 1, 'round 1 releases one politician at a time');
  assert.equal(g.eggsLeft, ROUND.EGGS_PER_TARGET);
});

test('a click during play spends an egg and spawns a projectile', () => {
  const g = createGame(silent);
  click(g, 100, 100);
  run(g, 1600);
  click(g, 200, 90);
  assert.equal(g.eggs.length, 1);
  assert.equal(g.eggsLeft, ROUND.EGGS_PER_TARGET - 1);
});

test('clicks are ignored once eggs run out', () => {
  const g = createGame(silent);
  click(g, 100, 100);
  run(g, 1600);
  for (let i = 0; i < 5; i += 1) click(g, 200, 90);
  assert.equal(g.eggsLeft, 0);
  assert.equal(g.eggs.length, ROUND.EGGS_PER_TARGET);
});

test('an egg landing on a target scores it and marks a hit pip', () => {
  const g = createGame(silent);
  click(g, 100, 100);
  run(g, 1600);
  const t = g.targets[0];
  t.vx = 0; // hold it still so the throw is deterministic
  t.wobble = 0;
  click(g, t.x, t.y);
  run(g, EGG.FLIGHT_MS + 32);
  assert.equal(g.hits, 1);
  assert.ok(g.score > 0, `score was ${g.score}`);
  assert.equal(g.pips[0], 'hit');
});

test('the first egg of a release earns the bonus', () => {
  const g = createGame(silent);
  click(g, 100, 100);
  run(g, 1600);
  const t = g.targets[0];
  t.vx = 0; t.wobble = 0;
  click(g, t.x, t.y);
  run(g, EGG.FLIGHT_MS + 32);
  const figure = g.pips.length ? g.score : 0;
  assert.ok(figure % 1 === 0 && figure >= 750, `expected a bonused score, got ${figure}`);
});

test('egging a decoy costs points and does not count as a hit', () => {
  const g = createGame(silent);
  click(g, 100, 100);
  run(g, 1600);
  g.score = 1000;
  // vx 0 holds the decoy still for the egg's 0.35s flight, exactly as the target
  // tests zero vx and wobble. A real decoy moves at DECOY.SPEED * 0.06 ~= 0.033
  // px/ms; a fixture carrying 0.5 drifts ~175px off the click point mid-flight,
  // so the egg lands on empty sky and the penalty never fires.
  g.decoys.push({ kind: 'flamingo', x: 240, y: 90, w: 24, h: 26, vx: 0, phase: 0, state: 'crossing', yolk: 0 });
  click(g, 240, 90);
  run(g, EGG.FLIGHT_MS + 32);
  assert.equal(g.score, 1000 - SCORE.DECOY_PENALTY);
  assert.equal(g.hits, 0);
  assert.ok(g.toast.text.length > 0, 'a penalty toast should be showing');
});

test('running out of eggs makes the survivors flee instead of loitering', () => {
  const g = createGame(silent);
  click(g, 100, 100);
  run(g, 1600);
  const t = g.targets[0];
  const escapeBefore = t.escapeMs;
  for (let i = 0; i < ROUND.EGGS_PER_TARGET; i += 1) click(g, 5, 5); // deliberate misses
  run(g, EGG.FLIGHT_MS + 48);
  assert.equal(g.eggsLeft, 0);
  assert.equal(t.fleeing, true);
  // escapeMs is when a politician decides to leave, and this one has already decided,
  // so flee() no longer pulls it in — goneAt is the deadline that matters now.
  assert.ok(t.goneAt !== null && t.goneAt < escapeBefore,
    'a fleeing politician should be gone before its own patience would have run out');
});

test('missing every egg in a round fails the quota and ends the game', () => {
  const g = createGame(silent);
  click(g, 100, 100);
  run(g, 1600);
  // Never throw: every politician escapes, so hits stay at 0.
  run(g, 120000);
  assert.equal(g.phase, PHASE.OVER);
  assert.equal(g.hits, 0);
  assert.equal(g.round, 1);
});

test('meeting the quota clears the round and advances', () => {
  const g = createGame(silent);
  click(g, 100, 100);
  run(g, 1600);
  const quota = quotaForRound(1);
  playUntilClear(g);
  assert.equal(g.phase, PHASE.CLEAR, `expected CLEAR, got ${g.phase} after ${g.hits} hits`);
  assert.ok(g.hits >= quota);
  assert.equal(g.mascot, 'cheer');
  const banked = g.score;
  assert.ok(banked > 0);
  run(g, CLEAR_WAIT_MS);
  assert.equal(g.phase, PHASE.INTRO, 'a cleared round leads into the next one');
  assert.equal(g.round, 2);
  assert.equal(g.score, banked, 'the score must carry into the next round');
  assert.equal(g.hits, 0, 'hits reset for the new round');
  assert.ok(g.pips.every((p) => p === 'pending'), 'pips reset for the new round');
});

test('clearing a round banks the high score', () => {
  // The bank goes through storage.js, so give it a store that actually works. Node
  // has no usable localStorage, so without this the write is a silent no-op and the
  // assertions below could never fail no matter what the CLEAR branch did.
  const store = installStore();
  try {
    const g = createGame(silent);
    assert.equal(g.best, 0, 'a fresh store starts with no record');
    click(g, 100, 100);
    run(g, 1600);
    playUntilClear(g);
    assert.equal(g.phase, PHASE.CLEAR);
    const banked = g.score;
    assert.ok(banked > 0);
    run(g, CLEAR_WAIT_MS);                    // the CLEAR branch banks on its way out
    assert.equal(g.best, banked, 'a cleared round must bank the score');
    assert.equal(Number(store.get('getegged.highscore')), banked, 'and persist it');
  } finally {
    delete globalThis.localStorage;
  }
});

test('only the FIRST egg of a release earns the bonus', () => {
  const g = createGame(silent);
  click(g, 100, 100);
  run(g, 1600);
  click(g, 5, 5);                             // deliberate miss burns the first egg
  run(g, EGG.FLIGHT_MS + 32);
  assert.equal(g.hits, 0);
  const before = g.score;
  const t = g.targets.find((x) => x.state === 'flying');
  t.vx = 0; t.wobble = 0; t.scared = 0;
  click(g, t.x, t.y);                         // the second egg connects
  run(g, EGG.FLIGHT_MS + 32);
  assert.equal(g.hits, 1);
  const base = FIGURES.find((f) => f.id === t.id).points;
  assert.equal(g.score - before, base, 'a later egg scores base points, unbonused');
});

test('a finished round fills exactly ten pips and leaves none pending', () => {
  const g = createGame(silent);
  click(g, 100, 100);
  run(g, 1600);
  run(g, 120000);                             // never throw: all ten escape
  assert.equal(g.phase, PHASE.OVER);
  assert.equal(g.pips.length, ROUND.TARGETS_PER_ROUND);
  assert.equal(g.pips.filter((p) => p === 'miss').length, ROUND.TARGETS_PER_ROUND);
  assert.equal(g.pips.filter((p) => p === 'pending').length, 0);
});

test('hudView reports exactly what the HUD needs', () => {
  const g = createGame(silent);
  const v = hudView(g);
  assert.deepEqual(Object.keys(v).sort(),
    ['best', 'eggsLeft', 'eggsTotal', 'muted', 'pauseBox', 'pips', 'round', 'score'].sort());
  assert.equal(v.pips.length, ROUND.TARGETS_PER_ROUND);
});

test('clicking game over returns to the menu with a reset score', () => {
  const g = createGame(silent);
  g.phase = PHASE.OVER;
  g.score = 5000;
  click(g, 10, 10);
  assert.equal(g.phase, PHASE.MENU);
  assert.equal(g.score, 0);
  assert.equal(g.round, 1);
});

test('pausing stops the world and resuming gives back PLAYING untouched', () => {
  const g = playing(createGame(silent));
  click(g, 200, 90);                          // an egg mid-flight, to freeze as well
  update(g, 16);
  pause(g);
  assert.equal(g.phase, PHASE.PAUSED);
  // Without these the snapshot below could pass on an empty world and prove nothing.
  assert.ok(g.targets.length > 0, 'a politician should be in the air');
  assert.ok(g.eggs.length > 0, 'and an egg should be halfway to it');
  const frozen = snapshot(g);
  for (let i = 0; i < 400; i += 1) update(g, 16);
  assert.equal(snapshot(g), frozen, 'nothing may move while paused');
  resume(g);
  assert.equal(g.phase, PHASE.PLAYING, 'resume restores the phase it paused from');
  assert.equal(snapshot(g), frozen, 'and resuming alone must not move anything either');
});

test('a long pause applies no accumulated time on resume', () => {
  const g = playing(createGame(silent));
  pause(g);
  assert.ok(g.targets.length > 0);
  const frozen = snapshot(g);
  // Ten minutes of wall clock shoved in at once, and again in MAX_FRAME_MS-sized
  // slices: a pause that merely deferred dt would fail one or the other.
  update(g, 600000);
  for (let i = 0; i < 12000; i += 1) update(g, 50);
  assert.equal(snapshot(g), frozen);
  resume(g);
  update(g, 16);                              // the resume frame is an ordinary one
  assert.equal(g.clock - JSON.parse(frozen).clock, 16);
});

test('pausing preserves phaseMs so INTRO does not skip on resume', () => {
  const g = createGame(silent);
  click(g, 100, 100);
  run(g, 1408);                               // INTRO_MS is 1500: nearly there
  assert.equal(g.phase, PHASE.INTRO);
  const at = g.phaseMs;
  pause(g);
  for (let i = 0; i < 200; i += 1) update(g, 16);
  assert.equal(g.phaseMs, at, 'the paused-from phase keeps its clock');
  resume(g);
  assert.equal(g.phase, PHASE.INTRO, 'not PLAYING');
  update(g, 16);
  assert.equal(g.phase, PHASE.INTRO, 'and the banner still has its last frames to run');
  run(g, 100);
  assert.equal(g.phase, PHASE.PLAYING);
});

test('pausing preserves phaseMs during CLEAR too', () => {
  const g = playing(createGame(silent));
  playUntilClear(g);
  assert.equal(g.phase, PHASE.CLEAR);
  run(g, 800);
  const at = g.phaseMs;
  pause(g);
  for (let i = 0; i < 200; i += 1) update(g, 16);
  resume(g);
  assert.equal(g.phase, PHASE.CLEAR);
  assert.equal(g.phaseMs, at);
  assert.equal(g.round, 1, 'a pause must not advance the round on its own');
  run(g, CLEAR_WAIT_MS);
  assert.equal(g.round, 2, 'the round still advances once CLEAR finishes');
});

test('pause is a no-op on the menu and on game over', () => {
  const menu = createGame(silent);
  togglePause(menu);
  assert.equal(menu.phase, PHASE.MENU);
  assert.equal(menu.pausedFrom, null);

  const over = createGame(silent);
  over.phase = PHASE.OVER;
  togglePause(over);
  assert.equal(over.phase, PHASE.OVER);
  assert.equal(over.pausedFrom, null);
});

test('restart from the pause menu resets the score and the round', () => {
  const g = playing(createGame(silent));
  g.score = 4200;
  g.round = 6;
  pause(g);
  selectPauseItem(g, 'restart');
  activatePauseItem(g);
  assert.equal(g.score, 0);
  assert.equal(g.round, 1);
  assert.equal(g.phase, PHASE.INTRO, 'restart takes the same route the menu does');
  assert.equal(g.pausedFrom, null);
  assert.equal(g.targets.length, 0);
});

test('quit from the pause menu returns to the menu', () => {
  const g = playing(createGame(silent));
  g.score = 4200;
  pause(g);
  selectPauseItem(g, 'quit');
  activatePauseItem(g);
  assert.equal(g.phase, PHASE.MENU);
  assert.equal(g.score, 0);
  assert.equal(g.round, 1);
  assert.equal(g.pausedFrom, null);
  assert.equal(g.targets.length, 0);
});

test('the mute item flips the sound and says which way it is', () => {
  const g = playing(createGame(silent));
  pause(g);
  const before = hudView(g).muted;
  const labelBefore = pauseItems().find((item) => item.id === 'mute').label;
  activatePauseItem(g);                       // 'mute' is not the default selection
  assert.equal(hudView(g).muted, before, 'the default selection is VAZHDO, not the toggle');

  pause(g);
  selectPauseItem(g, 'mute');
  activatePauseItem(g);
  try {
    assert.equal(hudView(g).muted, !before);
    assert.notEqual(pauseItems().find((item) => item.id === 'mute').label, labelBefore);
    assert.equal(g.phase, PHASE.PAUSED, 'toggling sound must not close the menu');
  } finally {
    activatePauseItem(g);                     // put the module-level mute back
  }
});

test('a click on the pause menu neither spends nor spawns an egg', () => {
  const g = playing(createGame(silent));
  pause(g);
  const eggsLeft = g.eggsLeft;

  click(g, 5, 5);                             // the dimmed backdrop: does nothing at all
  assert.equal(g.phase, PHASE.PAUSED);
  assert.equal(g.eggs.length, 0);

  const [x, y] = centreOf(selectPauseItem(g, 'resume'));
  click(g, x, y);
  assert.equal(g.phase, PHASE.PLAYING, 'clicking VAZHDO resumes');
  assert.equal(g.eggs.length, 0, 'and the click that dismissed the menu threw nothing');
  assert.equal(g.eggsLeft, eggsLeft);
});

test('the HUD pause button pauses without throwing an egg', () => {
  const g = playing(createGame(silent));
  const [x, y] = centreOf(hudView(g).pauseBox);
  click(g, x, y);
  assert.equal(g.phase, PHASE.PAUSED);
  assert.equal(g.eggs.length, 0, 'opening the menu must not cost an egg');
  assert.equal(g.eggsLeft, ROUND.EGGS_PER_TARGET);
  click(g, x, y);
  assert.equal(g.phase, PHASE.PLAYING, 'and it toggles back');
  assert.equal(g.eggs.length, 0);
});

test('the pause selection wraps and follows the crosshair', () => {
  const g = playing(createGame(silent));
  pause(g);
  const items = pauseItems();
  assert.equal(g.pauseIndex, 0, 'a fresh pause starts on VAZHDO');
  movePauseSelection(g, -1);
  assert.equal(g.pauseIndex, items.length - 1, 'up from the top wraps to the bottom');
  movePauseSelection(g, 1);
  assert.equal(g.pauseIndex, 0);

  const [x, y] = centreOf(items[2].box);
  pauseHover(g, x, y);
  assert.equal(g.pauseIndex, 2);
  pauseHover(g, 2, 2);                        // off the panel
  assert.equal(g.pauseIndex, 2, 'a pointer off the items leaves the selection alone');
  assert.equal(pauseView(g).selected, 2, 'and the renderer is told the same index');
});

test('the pause menu draws from the same boxes it hit-tests', () => {
  const g = playing(createGame(silent));
  pause(g);
  const view = pauseView(g);
  assert.deepEqual(view.items.map((item) => item.box), pauseItems().map((item) => item.box));
  view.items.forEach((item, i) => {
    const [x, y] = centreOf(item.box);
    pauseHover(g, x, y);
    assert.equal(g.pauseIndex, i, `${item.id}'s drawn box must be its own hit box`);
    assert.ok(item.label.length > 0, `${item.id} needs a label`);
  });
  assert.equal(view.round, g.round);
  assert.equal(view.score, g.score);
});

test('the marching backdrop starts at the square and arrives without overrunning', () => {
  const g = playing(createGame(silent));
  assert.equal(createGame(silent).march, 0, 'a fresh game starts at the square');
  let worst = 0;
  let backwards = 0;
  for (let i = 0; i < 8000 && g.phase === PHASE.PLAYING; i += 1) {
    const before = g.march;
    update(g, 16);
    worst = Math.max(worst, g.march);
    if (g.march < before) backwards += 1;
  }
  assert.ok(worst <= 1, `march overran the boulevard at ${worst}`);
  assert.equal(backwards, 0, 'the boulevard must never walk backwards');
  assert.equal(g.march, 1, `a played-out round must arrive at the parliament, got ${g.march}`);
});

test('the marching backdrop advances continuously, not in release-sized steps', () => {
  const g = playing(createGame(silent));
  const early = g.march;
  run(g, 4000);
  assert.ok(g.march > early, 'the boulevard should have moved after four seconds of play');
  // A steady walk, not a shove: one frame is a fraction of a percent of the boulevard.
  // The old model snapped toward released / TARGETS_PER_ROUND and could move a tenth of
  // the route in a single frame the moment a pair went out.
  const g2 = playing(createGame(silent));
  const beforeOneFrame = g2.march;
  update(g2, 16);
  assert.ok(g2.march - beforeOneFrame < 0.02, 'a single frame must not teleport the city');
});

test('the march keeps walking through the still stretches between releases', () => {
  // Precisely the bug this replaced. `march` used to ease toward
  // released / TARGETS_PER_ROUND, a ten-step staircase, so it closed its gap early in a
  // release and then all but stopped until the next one shoved it: measured the same
  // way, the old model moves under 0.008 where this one is floored at 0.022.
  const g = playing(createGame(silent));
  let still = 0;
  let mark = null;
  let measured = 0;
  let worst = Infinity;
  for (let i = 0; i < 4000 && g.phase === PHASE.PLAYING; i += 1) {
    const released = g.released;
    update(g, 16);
    if (g.released !== released) { still = 0; mark = null; continue; }
    still += 16;
    // Judge only the TAIL of a stretch, a second and a half in, and only well short of
    // the parliament — arriving and then standing there is the one time stopping is
    // the correct thing for the boulevard to do.
    if (mark === null && still >= 1500 && g.march < 0.7) mark = { at: still, march: g.march };
    if (mark && still - mark.at >= 800) {
      measured += 1;
      worst = Math.min(worst, g.march - mark.march);
      mark = null;
    }
  }
  assert.ok(measured >= 3, `needed still stretches to judge this, found ${measured}`);
  assert.ok(worst > 0.015, `the city all but stopped between releases: ${worst}`);
});

test('a new round walks the boulevard again from the start', () => {
  const g = playUntilClear(playing(createGame(silent)));
  assert.equal(g.phase, PHASE.CLEAR);
  run(g, CLEAR_WAIT_MS);
  assert.equal(g.phase, PHASE.INTRO, 'the next round has begun');
  assert.equal(g.march, 0, 'and its backdrop is back at the square');
});

test('the march does not advance while the game is paused', () => {
  const g = playing(createGame(silent));
  run(g, 2000);
  pause(g);
  const frozen = g.march;
  run(g, 20000);
  assert.equal(g.march, frozen, 'a paused march must not walk the boulevard');
  resume(g);
  run(g, 2000);
  assert.ok(g.march > frozen, 'and must carry on once resumed');
});
