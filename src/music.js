import { MUSIC } from './config.js';
import { getAudioContext, isMuted } from './audio.js';

// Background music streams from an <audio> element routed through the shared
// AudioContext. Deliberately NOT fetch + decodeAudioData: the track is a 4.4 MB
// mp3, which decodes to ~45 MB of Float32 and would hold up the first note until
// the whole file had decoded. A media element starts on the first few packets.

let el = null;            // the streaming element; created once, reused forever
let gain = null;          // volume, mute and duck are all this one node
let routed = false;       // element already wired into the graph
let routeFailed = false;  // ...and wiring it threw, so never try again
let dead = false;         // file missing or undecodable; stop retrying
let ducked = false;
let pollId = 0;
let lastMuted = false;

/** The level the music should sit at right now, in gain units. */
function levelNow() {
  if (isMuted()) return 0;
  return ducked ? MUSIC.DUCK_GAIN : MUSIC.GAIN;
}

/** Ramp to the current level over `rampMs`. Safe before the graph exists. */
function applyLevel(rampMs) {
  const target = levelNow();
  const ctx = getAudioContext();
  if (gain && ctx) {
    const t = ctx.currentTime;
    // cancelScheduledValues alone would leave the param snapping to whatever the
    // cancelled ramp was aiming at, so pin the value we are actually at first.
    // (cancelAndHoldAtTime does this in one call but is missing on older Safari.)
    gain.gain.cancelScheduledValues(t);
    gain.gain.setValueAtTime(gain.gain.value, t);
    gain.gain.linearRampToValueAtTime(target, t + Math.max(rampMs, 1) / 1000);
  } else if (el) {
    // No graph: the element's own volume is the only control we have. It jumps
    // rather than ramps, which is acceptable on a path that only runs when the
    // browser has no Web Audio at all.
    el.volume = target;
  }
}

/** Create the element. Never throws; a failure just leaves the game silent. */
function ensureElement() {
  if (el || dead) return;
  if (typeof Audio === 'undefined') { dead = true; return; } // Node has no DOM
  const a = new Audio();
  a.loop = true;
  a.preload = 'auto';
  a.volume = levelNow();          // in case we never get routed (see applyLevel)
  a.addEventListener('error', () => {
    // A missing or undecodable track is not fatal — the game plays silent, the
    // same way a missing face falls back to the caricature.
    dead = true;
    console.warn('Get Egged: music failed to load, playing without it');
  });
  a.src = MUSIC.SRC;              // relative, like FACES, so any static host works
  el = a;
}

/** Wire the element into the shared graph, if there is a context yet. */
function ensureRouting() {
  if (routed || routeFailed || !el) return;
  const ctx = getAudioContext();
  // initAudio() creates the context from the same click handler that calls us, so
  // on the very first gesture it may not exist yet. Do nothing and pick it up on
  // the next call rather than latching into a dead state.
  if (!ctx) return;
  try {
    gain = ctx.createGain();
    gain.gain.setValueAtTime(0, ctx.currentTime);   // start silent, then fade in
    ctx.createMediaElementSource(el).connect(gain).connect(ctx.destination);
    el.volume = 1;                                  // the gain node owns the level now
    routed = true;
  } catch {
    // createMediaElementSource throws if this element is already routed, and can
    // fail on a cross-origin-tainted source. Fall back to the element's own
    // volume and stop trying: a second attempt throws for the same reason.
    gain = null;
    routeFailed = true;
    applyLevel(0);
  }
}

/** Watch audio.js's muted flag on a coarse timer. Started once. */
function ensureMutePoll() {
  if (pollId || typeof setInterval === 'undefined') return;
  lastMuted = isMuted();
  // main.js owns the M key and calls audio.js's toggleMute() directly. Having
  // audio.js notify us would mean audio.js importing music.js while music.js
  // imports audio.js — a cycle. A boolean compare a few times a second costs
  // nothing next to a 60fps render loop, and never touches the frame path.
  pollId = setInterval(() => {
    try {
      const m = isMuted();
      if (m === lastMuted) return;
      lastMuted = m;
      applyLevel(MUSIC.RAMP_MS);
    } catch {
      /* a level change must never spam the console every tick */
    }
  }, MUSIC.MUTE_POLL_MS);
}

/** Start or resume playback, swallowing an autoplay block so it can be retried. */
function startPlayback() {
  const ctx = getAudioContext();
  // Do NOT gate on ctx.state === 'running' — resume() resolves asynchronously, so
  // the click that calls initAudio() then initMusic() would still read 'suspended'
  // and skip the very first play of every session. Same trap as audio.js's play().
  if (ctx?.state === 'suspended') ctx.resume()?.catch(() => {});
  if (!el.paused) return;                        // already running; nothing to do
  const p = el.play();
  // play() rejects when the autoplay policy blocks it, and the element goes back
  // to paused, so the next gesture retries from scratch. Swallow the rejection —
  // and the AbortError from two fast clicks racing — so neither surfaces as an
  // unhandled rejection. Only fade in once playback has actually been allowed.
  if (p?.then) p.then(() => applyLevel(MUSIC.FADE_IN_MS)).catch(() => {});
  else applyLevel(MUSIC.FADE_IN_MS);             // pre-promise browsers
}

/** Must be called from a user gesture. Safe and cheap to call on every click. */
export function initMusic() {
  try {
    ensureElement();
    if (!el || dead) return;
    ensureRouting();
    ensureMutePoll();
    startPlayback();
  } catch {
    /* music is decoration: it must never break the click that started it */
  }
}

/** Duck the music under the pause menu (true) or bring it back (false). */
export function setMusicDucked(on) {
  try {
    ducked = !!on;
    applyLevel(MUSIC.RAMP_MS);
  } catch {
    /* a level change must never break the frame */
  }
}

/** Pause the music, keeping the element and graph for the next initMusic(). */
export function stopMusic() {
  try {
    // Nothing is torn down on purpose: createMediaElementSource throws if it is
    // ever called twice for the same element, so the graph has to outlive a stop.
    el?.pause();
  } catch {
    /* nothing to do; it is already not playing */
  }
}

/** Whether the music is actually running and audible right now. */
export function isMusicOn() {
  return !!el && !el.paused && !isMuted();
}
