import { loadMuted, saveMuted } from './storage.js';

let ctx = null;
let muted = loadMuted();

export function isMuted() {
  return muted;
}

export function toggleMute() {
  muted = !muted;
  saveMuted(muted);
  return muted;
}

/** Must be called from a user gesture. Safe to call on every click. */
export function initAudio() {
  try {
    const Ctor = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    if (!Ctor) return;
    if (!ctx) ctx = new Ctor();
    // resume() is async and may reject; swallow it so nothing surfaces as an
    // unhandled rejection. `?.` covers older engines that return undefined.
    if (ctx.state === 'suspended') ctx.resume()?.catch(() => {});
  } catch {
    ctx = null;
  }
}

/** The shared AudioContext, or null until initAudio() makes one (or if it cannot). */
export function getAudioContext() {
  return ctx;
}

function tone({ freq, endFreq = freq, dur, type = 'square', gain = 0.12, delay = 0 }) {
  const t0 = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (endFreq !== freq) osc.frequency.exponentialRampToValueAtTime(endFreq, t0 + dur);
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noise({ dur, gain = 0.2, filterFreq = 1200, sweepTo = null }) {
  const t0 = ctx.currentTime;
  const frames = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, frames, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < frames; i += 1) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(filterFreq, t0);
  if (sweepTo) filter.frequency.exponentialRampToValueAtTime(sweepTo, t0 + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filter).connect(g).connect(ctx.destination);
  src.start(t0);
}

const SOUNDS = {
  throw:   () => noise({ dur: 0.16, gain: 0.10, filterFreq: 2600, sweepTo: 500 }),
  splat:   () => { noise({ dur: 0.22, gain: 0.26, filterFreq: 900, sweepTo: 180 });
                   tone({ freq: 150, endFreq: 60, dur: 0.18, type: 'sine', gain: 0.18 }); },
  miss:    () => tone({ freq: 320, endFreq: 120, dur: 0.12, type: 'sine', gain: 0.10 }),
  escape:  () => { tone({ freq: 520, endFreq: 500, dur: 0.10, type: 'triangle', gain: 0.10 });
                   tone({ freq: 400, endFreq: 180, dur: 0.22, type: 'triangle', gain: 0.10, delay: 0.10 }); },
  clear:   () => [523, 659, 784, 1046].forEach((f, i) =>
                   tone({ freq: f, dur: 0.14, type: 'square', gain: 0.11, delay: i * 0.09 })),
  penalty: () => { tone({ freq: 180, endFreq: 90, dur: 0.30, type: 'sawtooth', gain: 0.16 });
                   tone({ freq: 90, dur: 0.30, type: 'square', gain: 0.10 }); },
  // The finale. The statue used to land on `splat`, which is the cue an egg makes: a
  // ninety-pixel bronze figure hitting stone sounded exactly like the thing thrown at it,
  // and it was the most jarring moment in the sequence.
  //
  // `crash` is long and low where splat is short and wet — a filtered noise burst sweeping
  // down for the stone, under two sine bodies for the mass of the bronze.
  crash:    () => { noise({ dur: 0.85, gain: 0.34, filterFreq: 700, sweepTo: 90 });
                    tone({ freq: 90, endFreq: 38, dur: 0.70, type: 'sine', gain: 0.30 });
                    tone({ freq: 140, endFreq: 52, dur: 0.35, type: 'triangle', gain: 0.16 }); },
  // Each bounce of the head. Metallic and short, so two of them in a second read as one
  // object hitting twice rather than as the statue landing again.
  headfall: () => { tone({ freq: 430, endFreq: 200, dur: 0.16, type: 'triangle', gain: 0.13 });
                    noise({ dur: 0.10, gain: 0.10, filterFreq: 1800, sweepTo: 400 }); },
  // The crowd. Noise swept UP rather than down, which is what separates a cheer from
  // debris; long and quiet enough to sit under the crash instead of competing with it.
  roar:     () => noise({ dur: 1.60, gain: 0.15, filterFreq: 420, sweepTo: 900 })
};

export function play(name) {
  if (muted || !ctx) return;
  try {
    // Do NOT gate on ctx.state === 'running'. resume() resolves asynchronously,
    // so a click handler that calls initAudio() then play() synchronously would
    // still read 'suspended' and silently drop the first sound of every session.
    // Scheduling against a resuming context is safe; it plays as soon as it runs.
    if (ctx.state === 'suspended') ctx.resume()?.catch(() => {});
    SOUNDS[name]?.();
  } catch {
    /* a failed sound must never break the frame */
  }
}
