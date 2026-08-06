import { VIEW, PALETTE as P, STRINGS as S, DEBUG } from './config.js';
import {
  createGame, update, click as gameClick, hudView, pauseView, pause, togglePause,
  pauseHover, movePauseSelection, activatePauseItem, startAtRound, PHASE, TOAST_FADE_MS
} from './state.js';
import { createInput } from './input.js';
import { initAudio, play, toggleMute } from './audio.js';
import { initMusic, setMusicDucked } from './music.js';
import { preloadFaces } from './render/faces.js';
import { drawBackground } from './render/background.js';
import { drawTarget, drawDecoy, drawEgg, drawCrosshair, drawThrower, drawMascot } from './render/sprites.js';
import {
  drawHud, drawMenu, drawRoundIntro, drawRoundClear, drawGameOver, drawPauseMenu,
  drawToast, drawFlash
} from './render/hud.js';

const MAX_FRAME_MS = 50; // clamp so an alt-tab pause cannot teleport entities

// How far either axis may be stretched past a uniform fit before a black bar is the
// better trade. A phone in landscape is around 2.17:1 against the playfield's 1.76:1,
// so filling it costs about 23% of horizontal stretch — noticeable if you look for it,
// and worth it on a screen this small. Past ~1.3 the distortion is uglier than the bar.
//
// It MUST be declared above the start() call below, not next to fit() where it is used.
// start() runs during module evaluation, so a const declared further down the file is
// still in its temporal dead zone when fit() first reads it, and the whole module throws
// `Cannot access 'MAX_STRETCH' before initialization` — leaving a blank canvas showing
// nothing but its own background colour. Function declarations hoist; const does not.
const MAX_STRETCH = 1.3;

const canvas = document.getElementById('game');
const ctx = canvas?.getContext('2d');

if (!ctx) {
  document.getElementById('fallback')?.removeAttribute('hidden');
  canvas?.setAttribute('hidden', '');
} else {
  ctx.imageSmoothingEnabled = false;
  start();
}

/**
 * Go fullscreen on a touch device, and lock to landscape once there.
 *
 * Asking a player to turn their phone and then leaving the URL bar and system chrome
 * eating a third of the screen is half a fix, so this fires on the first tap — the one
 * that starts the game — because the Fullscreen API only works inside a user gesture.
 *
 * Everything here is best effort and nothing may throw into the tap that started the
 * game: iPhone Safari has no Fullscreen API at all (only iPad does), orientation.lock
 * is unsupported on iOS and rejects on some Android browsers, and lock() only works
 * while already fullscreen — hence the chaining. Desktop is left alone: a mouse player
 * who wanted fullscreen would have pressed F11.
 */
function goFullscreen() {
  if (!matchMedia('(pointer: coarse)').matches) return;
  if (document.fullscreenElement || document.webkitFullscreenElement) return;
  const el = document.documentElement;
  const request = el.requestFullscreen ?? el.webkitRequestFullscreen;
  if (!request) return;                       // iPhone Safari: nothing to do
  try {
    const p = request.call(el);
    // Older engines return undefined rather than a promise, so guard before chaining.
    if (p?.then) {
      p.then(() => screen.orientation?.lock?.('landscape')?.catch(() => {})).catch(() => {});
    }
  } catch {
    /* fullscreen refused; the game is still perfectly playable windowed */
  }
}

/**
 * Size the canvas to the window.
 *
 * Desktop keeps the exact 480x272 aspect: there is plenty of screen, so a black border
 * costs nothing and the pixel grid stays square. A phone fills the screen instead, since
 * letterboxing a 5-inch display to preserve geometry nobody is measuring wastes the one
 * resource that is actually scarce. The stretch is clamped so an unusually wide device
 * still letterboxes rather than smearing the art.
 *
 * Stretching is safe for aiming: input.js converts pointer coordinates through
 * getBoundingClientRect, dividing by the element's real width and height separately, so
 * a tap still maps to the logical pixel under the finger whatever the axes are doing.
 */
function fit() {
  const dw = VIEW.W * VIEW.SCALE;
  const dh = VIEW.H * VIEW.SCALE;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const uniform = Math.min(vw / dw, vh / dh);

  if (!matchMedia('(pointer: coarse)').matches) {
    canvas.style.width = `${Math.floor(dw * uniform)}px`;
    canvas.style.height = `${Math.floor(dh * uniform)}px`;
    return;
  }

  // Grow each axis toward the viewport, but never past MAX_STRETCH of the uniform fit.
  // Whichever axis the uniform fit already filled is unaffected — it is capped by the
  // viewport itself — so in practice this stretches exactly the axis with the bars.
  const w = Math.min(vw, dw * uniform * MAX_STRETCH);
  const h = Math.min(vh, dh * uniform * MAX_STRETCH);
  canvas.style.width = `${Math.floor(w)}px`;
  canvas.style.height = `${Math.floor(h)}px`;
}

function start() {
  preloadFaces();

  const game = createGame({ sound: play });

  // TEMPORARY testing aid, switched by DEBUG.START_ROUND in config.js: begin a run on a
  // later round so the capital scenes can be reached without playing up to them. At the
  // shipping value of 1 this branch never fires and starting is exactly what it was.
  // Deliberately lives here rather than in startNewRun(): state.js is what the tests
  // drive, and a debug switch must not be able to change how a real run begins.
  function startRun() {
    if (DEBUG.START_ROUND > 1) startAtRound(game, DEBUG.START_ROUND);
    else gameClick(game, VIEW.W / 2, VIEW.H / 2);
  }

  const input = createInput(canvas, {
    onClick(x, y) {
      initAudio();
      initMusic();   // needs the same user gesture; cheap and idempotent after the first
      goFullscreen();
      if (game.phase === PHASE.MENU) { startRun(); return; }
      gameClick(game, x, y);
    },
    onMove(x, y) {
      pauseHover(game, x, y);   // no-op unless the pause menu is up
    },
    // Every branch returns, so no key ever does two things in one press. In
    // particular Enter activates a pause item while paused and never reaches
    // gameClick, which is what would otherwise throw an egg on the way out.
    onKey(key) {
      if (key === 'm') { toggleMute(); return; }
      if (key === 'escape' || key === 'p') { togglePause(game); return; }
      if (game.phase === PHASE.PAUSED) {
        if (key === 'arrowup' || key === 'w') movePauseSelection(game, -1);
        else if (key === 'arrowdown' || key === 's') movePauseSelection(game, 1);
        else if (key === 'enter') activatePauseItem(game);
        return;
      }
      if (key === 'enter' && game.phase === PHASE.MENU) { startRun(); return; }
      if (key === 'enter' && game.phase === PHASE.OVER) {
        gameClick(game, VIEW.W / 2, VIEW.H / 2);
      }
    }
  });

  fit();
  window.addEventListener('resize', fit);
  // Rotating a phone does not reliably fire `resize` before the new viewport is settled,
  // so refit on the orientation change too, and once more on the next frame — the
  // reported innerWidth/innerHeight are often still the old ones at this instant.
  window.addEventListener('orientationchange', () => {
    fit();
    requestAnimationFrame(fit);
  });

  // A hidden or unfocused tab stops getting animation frames, so a run left in the
  // background is a run the player can neither see nor play — the commonest way to
  // come back to a dead game. pause() is a no-op off the menu, so this is safe to
  // fire from anywhere. Deliberately never auto-resumes: returning to a live round
  // with a politician already halfway across is worse than one extra keypress.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pause(game);
  });
  window.addEventListener('blur', () => pause(game));

  let last = performance.now();
  let consecutiveErrors = 0;
  let wasPaused = false;
  function frame(now) {
    // While paused the elapsed real time is thrown away frame by frame rather than
    // banked, and `last` still moves to `now`, so nothing is left to be applied on the
    // resume frame however long the pause was. This does not lean on MAX_FRAME_MS: the
    // clamp only bounds a single frame, and a two-minute pause fed back in 50ms slices
    // would still march every entity across the screen.
    const dt = game.phase === PHASE.PAUSED ? 0 : Math.min(now - last, MAX_FRAME_MS);
    last = now;
    try {
      update(game, dt);
      render(ctx, game, input, now);
      // Duck on the PAUSED edge rather than on the pause/resume calls themselves:
      // restart and quit leave PAUSED without going through resume(), and an edge
      // catches every route in and out for free. Only on a change — setMusicDucked
      // starts a fresh ramp each call, so firing it every frame would restart the
      // 250ms ramp 60 times a second and never let it arrive.
      const paused = game.phase === PHASE.PAUSED;
      if (paused !== wasPaused) {
        wasPaused = paused;
        setMusicDucked(paused);
      }
      consecutiveErrors = 0;
    } catch (err) {
      consecutiveErrors += 1;
      console.error('Get Egged: frame failed', err);
      if (consecutiveErrors >= 3) {
        // Three in a row is not transient. Say so on the page rather than leave a
        // frozen picture with no explanation of why the game stopped.
        showFatal(err);
        return;
      }
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

/** Surface a fatal frame error on the page instead of freezing silently. */
function showFatal(err) {
  const el = document.getElementById('fallback');
  if (!el) return;
  el.textContent = `${S.fatal} ${err?.message ?? err}`;
  el.removeAttribute('hidden');
}

function drawParticles(ctx, sys) {
  sys.decals.forEach((d) => {
    ctx.globalAlpha = 1 - d.life / d.ttl;
    ctx.fillStyle = P.yolk;
    ctx.beginPath();
    ctx.ellipse(d.x, d.y, d.r * 1.6, d.r * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  });
  sys.bits.forEach((b) => {
    ctx.globalAlpha = 1 - b.life / b.ttl;
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x | 0, b.y | 0, b.r, b.r);
    ctx.globalAlpha = 1;
  });
  sys.floats.forEach((f) => {
    ctx.save();
    ctx.globalAlpha = 1 - f.life / f.ttl;
    ctx.font = 'bold 8px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x | 0, f.y | 0);
    ctx.restore();
  });
}

function render(ctx, game, input, now) {
  // Everything below draws in logical 480x272 space; this is the only place the
  // device resolution is acknowledged. setTransform, not scale, so the factor
  // cannot compound across frames.
  ctx.setTransform(VIEW.SCALE, 0, 0, VIEW.SCALE, 0, 0);

  // Ambient world animation runs off game.clock, not `now`: g.clock stops advancing
  // the moment update() sees PHASE.PAUSED, so the water, smoke, gliding flamingos,
  // crowd sway and mascot freeze with everything else instead of shimmering on
  // behind the dim. The overlays below stay on `now` — a menu prompt that stops
  // blinking reads as a lock-up, not as a pause.
  drawBackground(ctx, game.backdrop, game.scene, game.clock, game.march);
  drawMascot(ctx, game.mascot, game.clock);

  game.decoys.forEach((d) => drawDecoy(ctx, d));
  game.targets.forEach((t) => drawTarget(ctx, t));
  game.eggs.forEach((e) => drawEgg(ctx, e));
  drawParticles(ctx, game.particles);

  // Also while paused out of PLAYING: the thrower blinking out of the frozen scene the
  // moment the panel opens reads as a glitch, not as a pause.
  if (game.phase === PHASE.PLAYING || game.pausedFrom === PHASE.PLAYING) {
    // game.clock for the same reason as the background; eggsLeft draws an open,
    // empty hand once the player is out, which is also the cue that the survivors
    // are about to bolt.
    drawThrower(ctx, input.x, game.clock, game.eggsLeft);
  }

  drawFlash(ctx, game.flash);

  if (game.phase === PHASE.MENU) drawMenu(ctx, game.best, now, input.touch);
  if (game.phase === PHASE.INTRO) drawRoundIntro(ctx, game.round, now);
  if (game.phase === PHASE.CLEAR) drawRoundClear(ctx, game.round, game.hits, now);
  if (game.phase === PHASE.OVER) drawGameOver(ctx, game.score, game.best, game.round);

  if (game.phase !== PHASE.MENU && game.phase !== PHASE.OVER) drawHud(ctx, hudView(game));

  if (game.toast.ms > 0) drawToast(ctx, game.toast.text, game.toast.color, game.toast.ms / TOAST_FADE_MS);

  // Last of the overlays, so the dim falls over the HUD bar and any frozen toast too.
  if (game.phase === PHASE.PAUSED) drawPauseMenu(ctx, pauseView(game));

  // The OS cursor is hidden (styles.css: cursor: none) in every phase, so the
  // crosshair must stand in for it everywhere the pointer is over the canvas —
  // not just while PLAYING, or the menu/intro/clear/over screens show no
  // pointer indicator at all.
  if (input.inside) drawCrosshair(ctx, input.x, input.y);
}
