import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FIGURES, FACES } from '../src/config.js';
import { spawnTarget, targetBox } from '../src/entities/target.js';
import { drawTarget, HEADS } from '../src/render/sprites.js';
import { preloadFaces, faceFor } from '../src/render/faces.js';

/**
 * A minimal recording canvas context. It tracks the current transform exactly as a
 * real 2D context does (translate/scale/rotate compose, save/restore push/pop it),
 * and turns every fill/stroke/path primitive it sees into world-space points. That
 * lets a test compare what actually got drawn against a hitbox without hardcoding a
 * single pixel number of its own — the expectation always comes from the drawing.
 */
function make2D() {
  const mul = (m1, m2) => {
    const [a1, b1, c1, d1, e1, f1] = m1;
    const [a2, b2, c2, d2, e2, f2] = m2;
    return [
      a1 * a2 + c1 * b2, b1 * a2 + d1 * b2,
      a1 * c2 + c1 * d2, b1 * c2 + d1 * d2,
      a1 * e2 + c1 * f2 + e1, b1 * e2 + d1 * f2 + f1
    ];
  };

  return {
    imageSmoothingEnabled: false,
    minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity,
    ellipseCount: 0,
    drawImageCalls: [],
    // Clip modeling: `_clip` is the currently active clip path (or null), saved and
    // restored alongside the transform so a leaked clip (missing restore) is actually
    // detectable, rather than a call-counting mock that can't see the stack misbehave.
    _clip: null,
    _lastPath: null,
    clipCalls: [],
    _m: [1, 0, 0, 1, 0, 0],
    _stack: [],
    _last: [0, 0],
    _point(x, y) {
      const [a, b, c, d, e, f] = this._m;
      const px = a * x + c * y + e;
      const py = b * x + d * y + f;
      if (px < this.minX) this.minX = px;
      if (py < this.minY) this.minY = py;
      if (px > this.maxX) this.maxX = px;
      if (py > this.maxY) this.maxY = py;
    },
    save() { this._stack.push({ m: this._m.slice(), clip: this._clip }); },
    restore() {
      const top = this._stack.pop();
      if (top) { this._m = top.m; this._clip = top.clip; }
    },
    translate(x, y) { this._m = mul(this._m, [1, 0, 0, 1, x, y]); },
    scale(sx, sy) { this._m = mul(this._m, [sx, 0, 0, sy, 0, 0]); },
    rotate(a) { const c = Math.cos(a), s = Math.sin(a); this._m = mul(this._m, [c, s, -s, c, 0, 0]); },
    set fillStyle(_v) {}, get fillStyle() { return '#000'; },
    set strokeStyle(_v) {}, get strokeStyle() { return '#000'; },
    set lineWidth(_v) {}, set font(_v) {}, set textAlign(_v) {},
    fillRect(x, y, w, h) {
      this._lastPath = { type: 'rect', x, y, w, h };
      this._point(x, y); this._point(x + w, y); this._point(x, y + h); this._point(x + w, y + h);
    },
    strokeRect(x, y, w, h) { this.fillRect(x, y, w, h); },
    beginPath() { this._lastPath = null; },
    closePath() {},
    moveTo(x, y) { this._last = [x, y]; this._point(x, y); },
    lineTo(x, y) { this._last = [x, y]; this._point(x, y); },
    quadraticCurveTo(cx, cy, x, y) {
      const [x0, y0] = this._last;
      for (let i = 0; i <= 16; i += 1) {
        const t = i / 16;
        const xt = (1 - t) ** 2 * x0 + 2 * (1 - t) * t * cx + t ** 2 * x;
        const yt = (1 - t) ** 2 * y0 + 2 * (1 - t) * t * cy + t ** 2 * y;
        this._point(xt, yt);
      }
      this._last = [x, y];
    },
    fill() {}, stroke() {},
    ellipse(cx, cy, rx, ry, _rot, start, end) {
      this.ellipseCount += 1;
      this._lastPath = { type: 'ellipse', cx, cy, rx, ry };
      for (let i = 0; i <= 32; i += 1) {
        const a = start + (end - start) * (i / 32);
        this._point(cx + rx * Math.cos(a), cy + ry * Math.sin(a));
      }
    },
    arc(cx, cy, r, start, end) {
      this._lastPath = { type: 'arc', cx, cy, r };
      for (let i = 0; i <= 32; i += 1) {
        const a = start + (end - start) * (i / 32);
        this._point(cx + r * Math.cos(a), cy + r * Math.sin(a));
      }
    },
    // Records the shape being clipped to (so a test can assert it is the ellipse and not
    // the crop rectangle) and how many drawImage calls had happened so far (so a test can
    // assert clip() ran before drawImage, not after).
    clip() {
      this._clip = this._lastPath;
      this.clipCalls.push({ shape: this._lastPath, drawImageCallsSoFar: this.drawImageCalls.length });
    },
    fillText() {},
    drawImage(...args) {
      this.drawImageCalls.push(args);
      const [, , , , , dx, dy, dw, dh] = args;
      this._point(dx, dy); this._point(dx + dw, dy);
      this._point(dx, dy + dh); this._point(dx + dw, dy + dh);
    }
  };
}

/** A flying target positioned at the origin, so its own local draw coordinates are world coordinates. */
function targetAtOrigin(figureIndex) {
  const t = spawnTarget(figureIndex, 1, 'left');
  t.x = 0;
  t.y = 0;
  return t;
}

test('faces degrade to the caricature, crop exactly what FACES specifies once loaded, and every figure fits its own hitbox', () => {
  // Node has no DOM: faces.js must stay inert rather than throw or block.
  assert.equal(typeof Image, 'undefined', 'sanity check: this environment has no Image constructor');
  assert.equal(faceFor('rama'), null);
  assert.doesNotThrow(() => preloadFaces());
  assert.equal(faceFor('rama'), null, 'preloadFaces() must not fabricate a face without a DOM Image');

  // --- No photo has loaded: drawTarget must still draw the caricature head, and it
  // --- must stay inside targetBox now that drawPolitician reads t.h. ---
  const caricatureHeights = FIGURES.map((f, i) => {
    const t = targetAtOrigin(i);
    const ctx = make2D();
    drawTarget(ctx, t);

    assert.ok(ctx.ellipseCount > 0, `${f.id}: caricature head should draw at least one ellipse with no photo loaded`);
    assert.equal(ctx.drawImageCalls.length, 0, `${f.id}: must not call drawImage before any photo has loaded`);

    const box = targetBox(t);
    assert.ok(ctx.minY >= -box.h / 2 - 1e-6, `${f.id}: caricature top (${ctx.minY.toFixed(2)}) must stay inside targetBox top (${(-box.h / 2).toFixed(2)})`);
    assert.ok(ctx.maxY <= box.h / 2 + 1e-6, `${f.id}: caricature bottom (${ctx.maxY.toFixed(2)}) must stay inside targetBox bottom (${(box.h / 2).toFixed(2)})`);
    assert.ok(ctx.minX >= -box.w / 2 - 1e-6, `${f.id}: caricature left edge must stay inside targetBox`);
    assert.ok(ctx.maxX <= box.w / 2 + 1e-6, `${f.id}: caricature right edge must stay inside targetBox`);

    return ctx.maxY - ctx.minY;
  });

  // Large / Medium / Small must actually render at different sizes, ordered the same
  // way FIGURES orders them -- the whole point of reading t.h in drawPolitician.
  assert.ok(caricatureHeights[0] > caricatureHeights[1] && caricatureHeights[1] > caricatureHeights[2],
    `expected Rama > Berisha > Balla drawn heights, got ${caricatureHeights.join(', ')}`);

  // FACES, FIGURES and HEADS must all agree on every id: drawTarget looks up `HEADS[t.id]`
  // and returns early -- silently, with no error -- if the id is missing, which would make
  // that figure vanish from the game entirely rather than fail loudly.
  const figureIds = FIGURES.map((f) => f.id).sort();
  assert.deepEqual(Object.keys(FACES).sort(), figureIds, 'FACES keys must exactly match FIGURES ids');
  assert.deepEqual(Object.keys(HEADS).sort(), figureIds, 'HEADS keys must exactly match FIGURES ids');
  assert.ok(figureIds.includes('balla'), 'balla must be a known figure id');
  assert.ok(!figureIds.includes('veliaj'), 'veliaj must not survive the rename to balla');

  // --- Now simulate every photo finishing its load. ---
  class StubImage {
    addEventListener(type, handler) {
      this[`on${type}`] = handler;
    }
    set src(value) {
      this._src = value;
      this.onload?.();
    }
    get src() { return this._src; }
  }
  global.Image = StubImage;
  try {
    preloadFaces();
    FIGURES.forEach((f) => assert.ok(faceFor(f.id), `${f.id}: face should be loaded via the stub Image`));

    FIGURES.forEach((f, i) => {
      const t = targetAtOrigin(i);
      const ctx = make2D();
      ctx.imageSmoothingEnabled = false; // the game's boot-time default
      drawTarget(ctx, t);

      assert.equal(ctx.drawImageCalls.length, 1, `${f.id}: exactly one drawImage once its photo has loaded`);
      const spec = FACES[f.id];
      const [, sx, sy, sw, sh, , , dw, dh] = ctx.drawImageCalls[0];
      assert.deepEqual([sx, sy, sw, sh], [spec.sx, spec.sy, spec.sw, spec.sh],
        `${f.id}: drawImage must crop the exact source rectangle from FACES`);
      assert.equal(ctx.imageSmoothingEnabled, false,
        `${f.id}: imageSmoothingEnabled must be restored once the photo head is drawn`);

      // The mask must actually clip, and clip *before* drawing the photo: exactly one
      // clip() call, its path an ellipse (not the crop rectangle), and made while zero
      // drawImage calls had happened yet.
      assert.equal(ctx.clipCalls.length, 1, `${f.id}: drawPhotoHead must clip exactly once`);
      assert.equal(ctx.clipCalls[0].shape?.type, 'ellipse',
        `${f.id}: the clip path must be the head-shaped ellipse, not the crop rectangle`);
      assert.equal(ctx.clipCalls[0].drawImageCallsSoFar, 0,
        `${f.id}: clip() must run before drawImage, not after`);

      // A leaked clip silently blanks every later draw in the frame -- assert it does not
      // survive past drawTarget, using a mock that models the real save/restore stack
      // rather than one that only counts calls.
      assert.equal(ctx._clip, null, `${f.id}: the head clip must be restored, not leaked past drawTarget`);

      // The crop's aspect ratio must survive end to end: source sw/sh versus the actual
      // rendered destination width/height, within 2%.
      const wantAspect = spec.sw / spec.sh;
      const gotAspect = dw / dh;
      assert.ok(Math.abs(gotAspect / wantAspect - 1) <= 0.02,
        `${f.id}: rendered aspect ${gotAspect.toFixed(3)} must be within 2% of source aspect ${wantAspect.toFixed(3)}`);

      const box = targetBox(t);
      assert.ok(ctx.minY >= -box.h / 2 - 1e-6 && ctx.maxY <= box.h / 2 + 1e-6,
        `${f.id}: photo head vertical extent [${ctx.minY.toFixed(2)}, ${ctx.maxY.toFixed(2)}] must stay inside targetBox height +/-${box.h / 2}`);
      assert.ok(ctx.minX >= -box.w / 2 - 1e-6 && ctx.maxX <= box.w / 2 + 1e-6,
        `${f.id}: photo head horizontal extent must stay inside targetBox width +/-${box.w / 2}`);
    });
  } finally {
    delete global.Image;
  }
});
