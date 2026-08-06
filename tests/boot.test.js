import { test } from 'node:test';
import assert from 'node:assert/strict';

/**
 * main.js is the only module with no other coverage, and it is the one that has to
 * survive being evaluated in a browser. A module-level `const` declared below the
 * `start()` call — which runs during evaluation — is still in its temporal dead zone
 * when the first frame reads it, so the whole module throws before anything is drawn
 * and the page shows a blank canvas. That shipped once. Function declarations hoist;
 * const does not, and nothing else in the suite would notice.
 *
 * So: evaluate the real entry module against a stub DOM, drive frames, and fire the
 * handlers. This asserts the thing a unit test of any single function cannot — that
 * the file boots at all.
 */

/** A 2D context that records nothing and refuses nothing. */
function stubCtx() {
  const ctx = {
    globalAlpha: 1, fillStyle: '', strokeStyle: '', lineWidth: 1,
    font: '', textAlign: '', imageSmoothingEnabled: false,
    save() {}, restore() {}
  };
  for (const m of ['beginPath', 'closePath', 'moveTo', 'lineTo', 'quadraticCurveTo',
    'bezierCurveTo', 'arc', 'ellipse', 'fill', 'stroke', 'fillRect', 'strokeRect',
    'clearRect', 'fillText', 'strokeText', 'clip', 'translate', 'rotate', 'scale',
    'setTransform', 'transform', 'drawImage', 'rect', 'setLineDash']) ctx[m] = () => {};
  ctx.createLinearGradient = () => ({ addColorStop() {} });
  ctx.measureText = () => ({ width: 10 });
  return ctx;
}

/** Everything main.js touches on the way up, and nothing it does not. */
function installDom({ coarse = false, width = 1280, height = 720 } = {}) {
  const listeners = new Map();
  const canvas = {
    width: 960, height: 544, style: {},
    getContext: () => stubCtx(),
    addEventListener: (t, fn) => listeners.set(`canvas:${t}`, fn),
    getBoundingClientRect: () => ({ left: 0, top: 0, width, height }),
    setAttribute() {}, removeAttribute() {}
  };
  const fallback = { textContent: '', removeAttribute() {}, setAttribute() {} };
  const frames = [];

  globalThis.localStorage = { getItem: () => null, setItem: () => {} };
  globalThis.document = {
    getElementById: (id) => (id === 'game' ? canvas : id === 'fallback' ? fallback : null),
    addEventListener: (t, fn) => listeners.set(`doc:${t}`, fn),
    hidden: false, fullscreenElement: null,
    documentElement: { requestFullscreen: () => Promise.resolve() }
  };
  globalThis.requestAnimationFrame = (cb) => frames.push(cb);
  globalThis.performance = { now: () => 0 };
  globalThis.matchMedia = (q) => ({ matches: coarse && q.includes('coarse'), media: q });
  globalThis.screen = { orientation: { lock: () => Promise.resolve() } };
  globalThis.innerWidth = width;
  globalThis.innerHeight = height;
  globalThis.addEventListener = (t, fn) => listeners.set(`win:${t}`, fn);
  globalThis.window = globalThis;
  // Audio is deliberately absent: music.js must survive a browser without it, and a
  // test that provides one would never find out.
  return { canvas, fallback, listeners, frames };
}

test('main.js evaluates and boots without throwing', async () => {
  const dom = installDom();
  // A cache-busting query keeps each test's evaluation independent; a module is only
  // ever evaluated once per specifier, and this file boots it more than once.
  await import(`../src/main.js?boot=${Date.now()}`);
  assert.ok(dom.frames.length > 0, 'start() must schedule a frame — a module that threw never gets here');
  assert.equal(dom.fallback.textContent, '', 'no fatal message should have been shown');
});

test('the first frames render without throwing', async () => {
  const dom = installDom();
  await import(`../src/main.js?frames=${Date.now()}`);
  let t = 0;
  for (let i = 0; i < 20 && dom.frames.length; i += 1) {
    const cb = dom.frames.shift();
    t += 16;
    cb(t);   // an exception here is caught by main.js, so assert on what it does instead
  }
  assert.equal(dom.fallback.textContent, '', `frames failed: ${dom.fallback.textContent}`);
});

test('a tap starts a run and renders, on a touch device', async () => {
  const dom = installDom({ coarse: true, width: 844, height: 390 });
  await import(`../src/main.js?touch=${Date.now()}`);
  const touch = dom.listeners.get('canvas:touchstart');
  assert.ok(touch, 'touchstart must be wired up, or the game is unplayable on a phone');
  touch({ preventDefault() {}, changedTouches: [{ clientX: 400, clientY: 200 }] });
  let t = 0;
  for (let i = 0; i < 30 && dom.frames.length; i += 1) { const cb = dom.frames.shift(); t += 16; cb(t); }
  assert.equal(dom.fallback.textContent, '', `frames failed after a tap: ${dom.fallback.textContent}`);
});

test('a phone gets the whole screen; a desktop keeps the exact aspect', async () => {
  const phone = installDom({ coarse: true, width: 844, height: 390 });
  await import(`../src/main.js?phone=${Date.now()}`);
  assert.equal(phone.canvas.style.width, '844px', 'a phone should fill the width, not letterbox it');
  assert.equal(phone.canvas.style.height, '390px', 'a phone should fill the height too');

  const desk = installDom({ coarse: false, width: 1280, height: 720 });
  await import(`../src/main.js?desk=${Date.now()}`);
  const w = parseInt(desk.canvas.style.width, 10);
  const h = parseInt(desk.canvas.style.height, 10);
  // 480x272 is 1.7647:1; a desktop must keep it rather than stretch.
  assert.ok(Math.abs(w / h - 480 / 272) < 0.01, `desktop aspect drifted: ${w}x${h}`);
  assert.ok(w <= 1280 && h <= 720, 'must fit inside the window');
});
