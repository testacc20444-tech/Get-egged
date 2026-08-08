import {
  VIEW, FIGURES, ROUND, DECOY, SCORE, MARCH, FINALE, STRINGS as S, PALETTE as P
} from './config.js';
import {
  roundPassed, scoreForHit, applyPenalty, pointInBox, targetsPerRelease, isFinalRound
} from './rules.js';
import { spawnEgg, updateEgg } from './entities/egg.js';
import {
  spawnTarget, updateTarget, hitBox, hitTarget, nearMissScare, flee
} from './entities/target.js';
import { spawnDecoy, updateDecoy, decoyBox, hitDecoy, pickDecoyKind } from './entities/decoy.js';
import {
  createParticleSystem, spawnEggBreak, spawnFloatingText, spawnDecal, spawnSplat,
  spawnConfetti, updateParticles
} from './entities/particles.js';
import {
  createMonument, updateMonument, hitMonument, monumentBox, monumentCardUp,
  monumentTimeScale, skipToSettled
} from './entities/monument.js';
import { backdropForRound, createBackdrop } from './render/background.js';
import { loadHighScore, saveHighScore } from './storage.js';
import { isMuted, toggleMute } from './audio.js';

export const PHASE = {
  MENU: 'menu', INTRO: 'intro', PLAYING: 'playing', CLEAR: 'clear', OVER: 'over',
  PAUSED: 'paused', FINALE: 'finale'
};

// The phases a run can be paused from. INTRO and CLEAR are in the list because they
// are timed transitions that keep counting down unattended: alt-tabbing 1.2s into the
// 1.5s INTRO would otherwise hand back a round already in flight, and CLEAR banks the
// high score and starts the next round on its own. Leaving them out would also make
// ESC silently dead for ~3.3s of every round, which reads as a broken key.
// MENU and OVER stay out: there is no run to protect, and OVER is already a full-screen
// summary that a pause panel would only cover up.
// FINALE is in the list because it is played, not watched: the player is still throwing,
// so ESC has to stop it like any other live phase.
const PAUSABLE = [PHASE.INTRO, PHASE.PLAYING, PHASE.CLEAR, PHASE.FINALE];

// The pause menu's geometry in logical 480x272 space. It lives here, not in hud.js, so
// the drawing and the click hit-testing read the same numbers; two copies would drift
// the first time the panel moved.
const PAUSE_MENU = {
  panel: { x: 130, y: 46, w: 220, h: 180 },
  itemX: 150, itemY: 108, itemW: 180, itemH: 18, itemGap: 6
};
const PAUSE_ITEM_IDS = ['resume', 'restart', 'mute', 'quit'];

// A mouse-reachable pause affordance, tucked into the only gap the HUD bar has left:
// the quota text ends around x=398 and the right-aligned HESHTUR starts around x=447.
const PAUSE_BUTTON_BOX = { x: 400, y: VIEW.H - 15, w: 40, h: 12 };

const INTRO_MS = 1500;
const CLEAR_MS = 1800;
const RELEASE_GAP_MS = 500;
const TOAST_MS = 1400;
// The tail of TOAST_MS over which drawToast fades from opaque to transparent
// (main.js divides the remaining ms by this to get alpha). Must stay smaller
// than TOAST_MS, or a toast would spawn already partway faded.
export const TOAST_FADE_MS = 400;
const NEAR_MISS_R = 26;   // an egg landing this close scares a politician
const LANDED_LINGER_MS = 300;

export function createGame(hooks) {
  return {
    phase: PHASE.MENU,
    hooks,
    round: 1,
    score: 0,
    best: loadHighScore(),
    hits: 0,
    released: 0,
    pips: Array(ROUND.TARGETS_PER_ROUND).fill('pending'),
    eggsLeft: 0,
    // How many the current release started with. Per-release state rather than a config
    // constant, because a pair is paid for in eggs and a single is not.
    eggsTotal: 0,
    firstEggUsed: false,
    targets: [],
    eggs: [],
    decoys: [],
    particles: createParticleSystem(),
    backdrop: createBackdrop(),
    scene: backdropForRound(1),
    phaseMs: 0,
    clock: 0,
    releaseGap: 0,
    march: 0,
    finale: null,
    pausedFrom: null,
    pauseIndex: 0,
    mascot: 'idle',
    flash: 0,
    toast: { text: '', color: P.bad, ms: 0 }
  };
}

function sound(g, name) {
  g.hooks?.sound?.(name);
}

function toast(g, text, color) {
  g.toast = { text, color, ms: TOAST_MS };
}

function startRound(g, round) {
  g.round = round;
  g.scene = backdropForRound(round);
  g.hits = 0;
  g.released = 0;
  g.pips = Array(ROUND.TARGETS_PER_ROUND).fill('pending');
  g.targets = [];
  g.eggs = [];
  g.decoys = [];
  // A losing toast or ground decals from the previous round/game must not
  // bleed into the next one.
  g.particles = createParticleSystem();
  g.toast = { text: '', color: P.bad, ms: 0 };
  g.flash = 0;
  g.eggsLeft = 0;
  g.eggsTotal = 0;
  g.releaseGap = 0;
  g.march = 0;                 // the marching backdrop restarts at the square
  g.finale = null;
  g.mascot = 'idle';
  g.phase = PHASE.INTRO;
  g.pausedFrom = null;
  g.phaseMs = 0;
}

/** Begin a fresh run at round 1. The menu and the pause menu's RIFILLO share it. */
function startNewRun(g) {
  g.score = 0;
  startRound(g, 1);
}

/**
 * Begin a run on a specific round. Only main.js's DEBUG.START_ROUND override uses this;
 * the normal path is startNewRun(), which always begins at round 1. Kept separate for
 * exactly that reason — a testing aid must not be able to change how a real run starts.
 */
export function startAtRound(g, round) {
  g.score = 0;
  startRound(g, round);
}

/**
 * Open the triumph straight from the title, on the round that would have earned it.
 *
 * Only main.js's DEBUG.START_IN_FINALE override calls this; the real path is clearing
 * ROUND.FINAL_ROUND. Kept separate from startFinale() for exactly the reason
 * startAtRound() is kept separate from startNewRun(): a testing aid must not be able to
 * change how a real run reaches its ending. The score is whatever the player has, which
 * from the title is zero — the finale is being looked at, not won.
 */
export function startAtFinale(g) {
  g.score = 0;
  startRound(g, ROUND.FINAL_ROUND);
  startFinale(g);
}

/** Abandon whatever is on screen and go back to the title. */
function toMainMenu(g) {
  g.score = 0;
  g.round = 1;
  g.phase = PHASE.MENU;
  g.pausedFrom = null;
  g.phaseMs = 0;
  g.mascot = 'idle';
  g.targets = [];
  g.eggs = [];
  g.decoys = [];
}

/** Release the next politician or pair, plus a possible decoy. */
function release(g) {
  const count = Math.min(targetsPerRelease(g.round), ROUND.TARGETS_PER_ROUND - g.released);
  for (let i = 0; i < count; i += 1) {
    const figureIndex = Math.floor(Math.random() * FIGURES.length);
    const side = Math.random() < 0.5 ? 'left' : 'right';
    g.targets.push(spawnTarget(figureIndex, g.round, side));
    g.released += 1;
  }
  if (g.round >= DECOY.FROM_ROUND && Math.random() < DECOY.CHANCE) {
    g.decoys.push(spawnDecoy(pickDecoyKind(), g.round));
  }
  // Eggs are counted per politician released, not per release. A flat allowance meant a
  // pair arrived with a single's three eggs, which halved eggs per target on the round
  // pairs begin and made the game unwinnable from there. `count`, not targetsPerRelease,
  // so the last release of a round — which can be a single when only one is left — is
  // paid for correctly too.
  g.eggsTotal = count * ROUND.EGGS_PER_TARGET;
  g.eggsLeft = g.eggsTotal;
  g.firstEggUsed = false;
}

function markPip(g, kind) {
  const i = g.pips.indexOf('pending');
  if (i !== -1) g.pips[i] = kind;
}

function registerHit(g, target, egg) {
  hitTarget(target);
  const gained = scoreForHit(target.id, egg.isFirstEgg);
  g.score += gained;
  g.hits += 1;
  markPip(g, 'hit');
  spawnEggBreak(g.particles, egg.x, egg.y);
  spawnFloatingText(g.particles, egg.x, egg.y - 8, `+${gained}`, P.yolk);
  sound(g, 'splat');
}

function registerDecoyHit(g, decoy, egg) {
  hitDecoy(decoy);
  g.score = applyPenalty(g.score);
  spawnEggBreak(g.particles, egg.x, egg.y);
  spawnFloatingText(g.particles, egg.x, egg.y - 8, `-${SCORE.DECOY_PENALTY}`, P.bad);
  toast(g, decoy.kind === 'flamingo' ? S.hitFlamingo : S.hitProtester, P.bad);
  g.flash = 0.45;
  sound(g, 'penalty');
}

/** Resolve a landed egg against targets, then decoys, then the ground. */
function resolveLanding(g, egg) {
  const target = g.targets.find((t) => t.state === 'flying' && pointInBox(egg.x, egg.y, hitBox(t)));
  if (target) { registerHit(g, target, egg); return; }

  const decoy = g.decoys.find((d) => d.state === 'crossing' && !d.yolk && pointInBox(egg.x, egg.y, decoyBox(d)));
  if (decoy) { registerDecoyHit(g, decoy, egg); return; }

  spawnEggBreak(g.particles, egg.x, egg.y);
  if (egg.y > VIEW.GROUND_Y - 12) spawnDecal(g.particles, egg.x, egg.y);
  g.targets.forEach((t) => {
    if (Math.hypot(t.x - egg.x, t.y - egg.y) < NEAR_MISS_R) nearMissScare(t);
  });
  sound(g, 'miss');
}

function endRound(g) {
  if (roundPassed(g.hits, g.round)) {
    // The last round cleared ends the run in triumph instead of starting another.
    // Failing it is untouched below: winning is the only thing this branch changes.
    if (isFinalRound(g.round)) { startFinale(g); return; }
    g.phase = PHASE.CLEAR;
    g.phaseMs = 0;
    g.mascot = 'cheer';
    sound(g, 'clear');
  } else {
    g.phase = PHASE.OVER;
    g.phaseMs = 0;
    g.mascot = 'sad';
    saveHighScore(g.score);
    g.best = loadHighScore();
  }
}

/**
 * Open the triumph. The run is already won by the time this is called, so the finale
 * banks the score immediately: whatever the player does with the statue, and however they
 * leave, the round they just cleared is already on the board.
 */
function startFinale(g) {
  g.phase = PHASE.FINALE;
  g.phaseMs = 0;
  g.mascot = 'cheer';
  g.targets = [];
  g.eggs = [];
  g.decoys = [];
  g.particles = createParticleSystem();
  g.toast = { text: '', color: P.bad, ms: 0 };
  g.flash = 0;
  // Zeroed so nothing downstream can read a stale count as an egg limit. The finale
  // deliberately does not spend eggs — see click().
  g.eggsLeft = 0;
  g.eggsTotal = 0;
  g.finale = createMonument();
  saveHighScore(g.score);
  g.best = loadHighScore();
  sound(g, 'clear');
}

// The statue's simulation lives in entities/monument.js. These two keep their old names
// because they are what main.js and the tests already import; the module underneath is
// what changed, not the contract.
export const statueBox = monumentBox;
export const finaleCardUp = monumentCardUp;

/**
 * The side-effect sink monument.js draws through. It knows nothing about particles or
 * audio, so everything it wants to happen in the world comes back through here.
 */
function finaleFx(g) {
  return {
    splat: (x, y, color) => spawnSplat(g.particles, x, y, color),
    sound: (name) => sound(g, name),
    text: (x, y, str, color) => spawnFloatingText(g.particles, x, y, str, color),
    confetti: (x, y, n, spread) => spawnConfetti(g.particles, x, y, n, spread),
    // The existing flash, reused rather than a second one bolted on: main.js already
    // draws it and update() already decays it.
    flash: () => { g.flash = 1; }
  };
}

function updateFinale(g, dtMs) {
  const f = g.finale;
  if (!f) return;
  const fx = finaleFx(g);

  for (let i = g.eggs.length - 1; i >= 0; i -= 1) {
    if (updateEgg(g.eggs[i], dtMs)) {
      const egg = g.eggs[i];
      spawnEggBreak(g.particles, egg.x, egg.y);
      if (hitMonument(f, egg.x, egg.y, fx) === 'miss') {
        if (egg.y > VIEW.GROUND_Y - 12) spawnDecal(g.particles, egg.x, egg.y);
        sound(g, 'miss');
      }
      g.eggs.splice(i, 1);
    }
  }

  updateMonument(f, dtMs, fx);
}

/**
 * Decoys cross the sky/ground on their own schedule (a flamingo takes ~15.6s)
 * independent of the round's ~4s release, so they must keep moving and retire
 * in every phase, not just PLAYING — otherwise one nearly always hangs frozen
 * mid-crossing through the CLEAR banner, or through OVER until the next click.
 */
function updateDecoys(g, dtMs) {
  for (let i = g.decoys.length - 1; i >= 0; i -= 1) {
    if (updateDecoy(g.decoys[i], dtMs) === 'gone') g.decoys.splice(i, 1);
  }
}

function updatePlaying(g, dtMs) {
  // Eggs first: a landing this frame should hit the target's current position.
  for (let i = g.eggs.length - 1; i >= 0; i -= 1) {
    const egg = g.eggs[i];
    if (updateEgg(egg, dtMs)) {
      resolveLanding(g, egg);
      g.eggs.splice(i, 1);
    }
  }

  // Out of eggs with nothing in flight: the survivors bolt for the edge.
  if (g.eggsLeft === 0 && g.eggs.length === 0) g.targets.forEach(flee);

  for (let i = g.targets.length - 1; i >= 0; i -= 1) {
    const t = g.targets[i];
    const result = updateTarget(t, dtMs);
    if (result === 'escaped') {
      markPip(g, 'miss');
      sound(g, 'escape');
      toast(g, S.escaped, P.hudDim);
      t.removeAt = g.clock;
    } else if (result === 'landed') {
      // Keep the splatted figure on the ground a moment so the hit reads.
      t.removeAt = g.clock + LANDED_LINGER_MS;
    }
    if (t.removeAt !== null && g.clock >= t.removeAt) g.targets.splice(i, 1);
  }

  if (g.targets.length === 0 && g.eggs.length === 0) {
    g.releaseGap += dtMs;
    if (g.releaseGap >= RELEASE_GAP_MS) {
      g.releaseGap = 0;
      if (g.released >= ROUND.TARGETS_PER_ROUND) endRound(g);
      else release(g);
    }
  }

  advanceMarch(g, dtMs);
}

/**
 * How far the marching backdrop has walked, 0 at the square and 1 at the parliament.
 *
 * It cannot simply track `released / TARGETS_PER_ROUND`: that is a ten-step staircase
 * — two steps at a time once pairs start — so the boulevard sat perfectly still, lurched
 * at a release, and sat still again. Ten shoves is a slide deck, not a march.
 *
 * So the walk has its own constant nominal speed and keeps moving on every frame, and
 * the round's real progress only leans on the PACE. Between releases the base speed is
 * all there is, so it never stalls; a player racing through the round pulls the pace up,
 * a player dawdling pushes it down, and the march still arrives as the round ends rather
 * than stopping short or standing at the Kuvendi for the last ten seconds. Both ends of
 * the pace are clamped, so nothing here can teleport the city or freeze it, and the
 * result is clamped at 1 so it can never overrun the parliament the next scene opens on.
 * The pace floor is above zero, so `march` is strictly increasing until it arrives —
 * the boulevard cannot run backwards however far ahead of schedule it gets.
 *
 * Living in state.js rather than the renderer means it inherits pause for free:
 * update() has already returned by this point if the game is paused, and no wall clock
 * is consulted, so a ten-minute pause resumes exactly where it stopped.
 */
function advanceMarch(g, dtMs) {
  const done = Math.min(1, g.released / ROUND.TARGETS_PER_ROUND);
  const pace = Math.max(
    MARCH.PACE_MIN,
    Math.min(MARCH.PACE_MAX, 1 + (done - g.march) * MARCH.CATCH_UP)
  );
  g.march = Math.min(1, g.march + (dtMs / MARCH.CROSS_MS) * pace);
}

export function update(g, dtMs) {
  // The whole of pause is this line. Nothing in the game advances outside this
  // function: g.clock, g.phaseMs, the particle/decoy/toast/flash timers and every
  // entity's own age — the target clock its escape deadline is measured against, an
  // egg's flight time, a decoy's crossing — only ever move inside an update() call,
  // so declining to make one freezes all of them at once. dtMs is dropped rather
  // than banked: a ten-minute pause resumes with a ten-minute-old world, not with
  // ten minutes of physics still to run.
  if (g.phase === PHASE.PAUSED) return;

  // The finale's slow motion is this line, and it is applied here rather than inside
  // updateFinale so that EVERYTHING dilates together: the crowd's sway and the sun both
  // ride g.clock, and the dust and confetti ride updateParticles. Slowing only the statue
  // would slide it against a world still at full speed, which reads as a dropped frame
  // rate rather than as slow motion. It is 1 in every phase but the fall.
  const dt = g.phase === PHASE.FINALE ? dtMs * monumentTimeScale(g.finale) : dtMs;

  g.clock += dt;
  g.phaseMs += dt;
  updateParticles(g.particles, dt);
  updateDecoys(g, dt);
  if (g.toast.ms > 0) g.toast.ms = Math.max(0, g.toast.ms - dt);
  if (g.flash > 0) g.flash = Math.max(0, g.flash - dt * 0.0025);

  if (g.phase === PHASE.INTRO && g.phaseMs >= INTRO_MS) {
    g.phase = PHASE.PLAYING;
    g.phaseMs = 0;
    release(g);
    return;
  }
  if (g.phase === PHASE.PLAYING) { updatePlaying(g, dt); return; }
  if (g.phase === PHASE.FINALE) { updateFinale(g, dt); return; }
  if (g.phase === PHASE.CLEAR && g.phaseMs >= CLEAR_MS) {
    saveHighScore(g.score);
    g.best = loadHighScore();
    startRound(g, g.round + 1);
  }
}

export function click(g, x, y) {
  // Before anything else: while paused every click belongs to the menu, and this
  // branch always returns, so no route out of the pause screen can fall through to
  // the throw at the bottom and cost the player an egg on the way.
  if (g.phase === PHASE.PAUSED) {
    const i = pauseItems().findIndex((item) => pointInBox(x, y, item.box));
    if (i !== -1) {
      g.pauseIndex = i;
      activatePauseItem(g);
    } else if (pointInBox(x, y, PAUSE_BUTTON_BOX)) {
      resume(g);
    }
    return;
  }
  if (g.phase === PHASE.MENU) {
    startNewRun(g);
    return;
  }
  if (g.phase === PHASE.OVER) {
    toMainMenu(g);
    return;
  }
  // The HUD's pause button is checked before the throw for the same reason: opening
  // the pause menu must not also lob an egg at the bottom of the screen.
  if (isPausable(g.phase) && pointInBox(x, y, PAUSE_BUTTON_BOX)) {
    pause(g);
    return;
  }
  // The finale, after the pause button so opening the menu cannot also lob an egg.
  // Eggs are unlimited here on purpose: the run has been won, so nothing in this phase
  // may be able to fail, stall, or run the player out of ways to finish it.
  if (g.phase === PHASE.FINALE) {
    if (finaleCardUp(g.finale)) { toMainMenu(g); return; }
    // Already going over. This used to just let it go, which was right when the sequence
    // was two seconds long; at six it costs more on a replay than it buys on a first
    // watch, so a click cuts to the end. Not in the opening moments, though: a player
    // throwing quickly has a click in flight when the sixth egg lands, and skipping the
    // topple they just earned is the one thing this must never do.
    if (g.finale?.state !== 'standing') {
      const early = g.finale?.state === 'falling' && g.finale.ms < FINALE.SKIP_LOCKOUT_MS;
      if (g.finale && !early) skipToSettled(g.finale);
      return;
    }
    g.eggs.push(spawnEgg(x, y, false));
    sound(g, 'throw');
    return;
  }
  if (g.phase !== PHASE.PLAYING || g.eggsLeft <= 0) return;

  const isFirst = !g.firstEggUsed;
  g.firstEggUsed = true;
  g.eggsLeft -= 1;
  g.eggs.push(spawnEgg(x, y, isFirst));
  sound(g, 'throw');
}

/** Can `phase` be paused at all? MENU and OVER cannot. */
function isPausable(phase) {
  return PAUSABLE.includes(phase);
}

/**
 * Freeze the run. No-op unless the current phase is pausable, so ESC on the menu or
 * on game over does nothing at all. This and resume() are the only two places the
 * PAUSED phase is entered or left.
 */
export function pause(g) {
  if (!isPausable(g.phase)) return;
  g.pausedFrom = g.phase;
  g.phase = PHASE.PAUSED;
  g.pauseIndex = 0;
  // g.phaseMs is deliberately left where it is: it belongs to pausedFrom, and resume()
  // hands it back untouched. Zeroing it here would restart the INTRO banner; clearing
  // it on resume would make a pause 1400ms into the 1500ms INTRO fire the transition
  // on the very next frame.
}

/** Hand the run back to the phase it was paused from — never straight to PLAYING. */
export function resume(g) {
  if (g.phase !== PHASE.PAUSED) return;
  g.phase = g.pausedFrom ?? PHASE.PLAYING;
  g.pausedFrom = null;
}

/** ESC / P / the HUD pause button all come through here. */
export function togglePause(g) {
  if (g.phase === PHASE.PAUSED) resume(g);
  else pause(g);
}

function pauseItemLabel(id) {
  if (id === 'resume') return S.pauseResume;
  if (id === 'restart') return S.pauseRestart;
  if (id === 'mute') return `${S.pauseSound} ${isMuted() ? S.pauseSoundOff : S.pauseSoundOn}`;
  return S.pauseQuit;
}

/** The pause menu's items and their hit boxes — the one place that layout exists. */
export function pauseItems() {
  return PAUSE_ITEM_IDS.map((id, i) => ({
    id,
    label: pauseItemLabel(id),
    box: {
      x: PAUSE_MENU.itemX,
      y: PAUSE_MENU.itemY + i * (PAUSE_MENU.itemH + PAUSE_MENU.itemGap),
      w: PAUSE_MENU.itemW,
      h: PAUSE_MENU.itemH
    }
  }));
}

/** Move the highlight by `delta`, wrapping at both ends. */
export function movePauseSelection(g, delta) {
  if (g.phase !== PHASE.PAUSED) return;
  const n = PAUSE_ITEM_IDS.length;
  g.pauseIndex = (g.pauseIndex + delta + n) % n;
}

/** Highlight whatever the crosshair is over. Logical 480x272 coordinates. */
export function pauseHover(g, x, y) {
  if (g.phase !== PHASE.PAUSED) return;
  const i = pauseItems().findIndex((item) => pointInBox(x, y, item.box));
  // Only move the highlight when the pointer is actually on an item: otherwise a
  // mouse parked off the panel would fight the arrow keys for the selection.
  if (i !== -1) g.pauseIndex = i;
}

/** Run the highlighted pause item. Enter and a click on the item share this. */
export function activatePauseItem(g) {
  if (g.phase !== PHASE.PAUSED) return;
  const id = PAUSE_ITEM_IDS[g.pauseIndex];
  if (id === 'resume') resume(g);
  else if (id === 'restart') startNewRun(g);
  else if (id === 'mute') toggleMute();
  else if (id === 'quit') toMainMenu(g);
}

export function hudView(g) {
  return {
    round: g.round,
    score: g.score,
    best: g.best,
    eggsLeft: g.eggsLeft,
    eggsTotal: g.eggsTotal,
    pips: g.pips,
    muted: isMuted(),
    pauseBox: PAUSE_BUTTON_BOX
  };
}

/** Everything drawPauseMenu needs, and the only channel it gets it through. */
export function pauseView(g) {
  return {
    panel: PAUSE_MENU.panel,
    items: pauseItems(),
    selected: g.pauseIndex,
    round: g.round,
    score: g.score,
    best: g.best
  };
}
