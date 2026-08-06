import { PALETTE as P, VIEW, EGG, FACES, STRINGS as S } from '../config.js';
import { faceFor } from './faces.js';

// The caricature body/head coordinates below, and FACES's `h`, were authored as fixed
// design-space numbers, not relative to any figure's `h`. This is the reference height they
// assume; drawPolitician scales that whole fixed drawing -- caricature or photo, plus the
// yolk splat -- uniformly by `t.h / BODY_DESIGN_H`, so Large/Medium/Small figures actually
// render at different (undistorted) sizes and each stays inside its own `targetBox`.
const BODY_DESIGN_H = 36;

function rect(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

function ellipse(ctx, x, y, rx, ry, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * One limb segment: a quad between two joints, tapering from half-width `w0` to `w1`.
 * A stroked line reads as wire at this scale — a quad has mass, and the taper is what
 * makes shoulder → elbow → wrist look like an arm instead of a bent pipe.
 * Mirroring the endpoints in x mirrors the whole quad, which the decoy's symmetry
 * rule below depends on.
 */
function limb(ctx, x0, y0, x1, y1, w0, w1, color) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x0 + nx * w0, y0 + ny * w0);
  ctx.lineTo(x1 + nx * w1, y1 + ny * w1);
  ctx.lineTo(x1 - nx * w1, y1 - ny * w1);
  ctx.lineTo(x0 - nx * w0, y0 - ny * w0);
  ctx.closePath();
  ctx.fill();
}

/** A shoe: a wedge trailing back off the ankle. A rect reads as a brick at this size. */
function shoe(ctx, ax, ay, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(ax + 1.3, ay - 0.9);
  ctx.lineTo(ax - 2.3, ay - 0.6);
  ctx.lineTo(ax - 2.6, ay + 1.3);
  ctx.lineTo(ax + 1.1, ay + 0.9);
  ctx.closePath();
  ctx.fill();
}

/** Hip -> knee -> ankle plus a shoe. Trousers are the same cloth as the jacket. */
function leg(ctx, hx, hy, kx, ky, ax, ay, cloth, shoeColor) {
  limb(ctx, hx, hy, kx, ky, 1.9, 1.5, cloth);
  limb(ctx, kx, ky, ax, ay, 1.5, 1.1, cloth);
  shoe(ctx, ax, ay, shoeColor);
}

/**
 * Shoulder -> elbow -> wrist, with a cuff and a hand carried on past the wrist along
 * the forearm's OWN direction. That way a pose only has to name three joints and the
 * hand follows wherever the arm swings, instead of needing its own pair of numbers in
 * every pose (and being left behind in one of them, which is how hands end up detached).
 */
function arm(ctx, sx, sy, ex, ey, wx, wy, cloth, hand) {
  const dx = wx - ex;
  const dy = wy - ey;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  limb(ctx, sx, sy, ex, ey, 2.0, 1.6, cloth);
  limb(ctx, ex, ey, wx, wy, 1.6, 1.2, cloth);
  // A shirt cuff, a shade proud of the sleeve. Without it the sleeve runs straight into
  // the hand and the whole arm ends in a stub.
  limb(ctx, wx, wy, wx + ux * 1.4, wy + uy * 1.4, 1.35, 1.3, P.shirt);
  ellipse(ctx, wx + ux * 2.6, wy + uy * 2.6, 1.5, 1.4, hand);
}

/**
 * One jacket panel, flapping as a wing. `dir` is +1 for the near panel and -1 for the
 * far one, so every x is written once and mirrored by multiplication.
 *
 * The tip is the panel's widest point BY CONSTRUCTION: the leading edge's control sits
 * at half the span and every trailing control is inboard of the tip, so the curve --
 * which cannot leave its own control hull -- never reaches past x = tipX. That is what
 * lets the caller pass `wingTip` (exactly t.w/2 in design units) and trust the
 * silhouette to sit flush against the hitbox instead of poking through it.
 *
 * Shape, from the shoulder: a leading edge bowed up like a real wing, then two
 * scalloped coat-tails with a notch bitten out between them, then back to the hem.
 */
function wingPanel(ctx, dir, tipX, tipY, cloth, shade, lit) {
  const leadCx = (4.2 + tipX) * 0.5;
  const leadCy = (tipY - 2.8) * 0.5 - 2.0;        // bowed up; more bow reads as a bird
  // The leading edge's own midpoint, by de Casteljau. Derived from the control point
  // rather than written out, so tuning the bow above cannot leave the shading behind
  // on a curve that has moved.
  const midX = (4.2 + 2 * leadCx + tipX) * 0.25;
  const midY = (-2.8 + 2 * leadCy + tipY) * 0.25;

  ctx.fillStyle = cloth;
  ctx.beginPath();
  ctx.moveTo(4.2 * dir, -2.8);
  ctx.quadraticCurveTo(leadCx * dir, leadCy, tipX * dir, tipY);
  ctx.quadraticCurveTo(tipX * 0.84 * dir, tipY * 0.72 + 1.6, tipX * 0.60 * dir, tipY * 0.55 + 3.6);
  ctx.quadraticCurveTo(tipX * 0.46 * dir, tipY * 0.40 + 3.4, tipX * 0.32 * dir, tipY * 0.26 + 6.8);
  ctx.lineTo(4.4 * dir, 8.0);
  ctx.closePath();
  ctx.fill();

  // The inner half in shadow: the body blocks the light, so the cloth nearest the
  // shoulder is the darkest part of the panel. Both of its outer corners are points
  // lying ON the outline already drawn -- the leading edge split at its own midpoint by
  // de Casteljau, and the midpoint of the hem line -- so this can never paint outside
  // the panel it is shading, at any flap position.
  ctx.fillStyle = shade;
  ctx.beginPath();
  ctx.moveTo(4.2 * dir, -2.8);
  ctx.quadraticCurveTo((4.2 + leadCx) * 0.5 * dir, (-2.8 + leadCy) * 0.5, midX * dir, midY);
  ctx.lineTo((tipX * 0.16 + 2.2) * dir, tipY * 0.13 + 7.4);
  ctx.lineTo(4.4 * dir, 8.0);
  ctx.closePath();
  ctx.fill();

  // The far panel passes `lit: null` and stops here: two tones on the far wing against
  // three on the near one is a good part of what separates them in depth.
  if (!lit) return;
  ctx.fillStyle = lit;
  ctx.beginPath();
  ctx.moveTo(midX * dir, midY);
  ctx.quadraticCurveTo((leadCx + tipX) * 0.5 * dir, (leadCy + tipY) * 0.5, tipX * dir, tipY);
  ctx.lineTo(tipX * 0.80 * dir, tipY * 0.74 + 1.9);
  ctx.closePath();
  ctx.fill();
}

/**
 * The suit: sloped shoulders, a taper to the waist, a shirt wedge and the trailing
 * flank in shadow.
 *
 * Every panel is an explicit polygon cut to fit the silhouette rather than a rect
 * trimmed by ctx.clip(). The photo head's oval is the one clip this figure takes and a
 * test pins that, so the shading is fitted by hand -- which is also cheaper, since this
 * runs for two politicians every frame.
 */
function suitTorso(ctx, cloth, deep) {
  ctx.fillStyle = cloth;
  ctx.beginPath();
  ctx.moveTo(-4.4, 10.5);
  ctx.lineTo(-5.4, 3.4);
  ctx.lineTo(-6.0, -0.6);
  ctx.lineTo(-4.4, -2.7);
  ctx.lineTo(-2.2, -3.7);
  ctx.lineTo(2.2, -3.7);
  ctx.lineTo(4.4, -2.7);
  ctx.lineTo(6.0, -0.6);
  ctx.lineTo(5.4, 3.4);
  ctx.lineTo(4.4, 10.5);
  ctx.closePath();
  ctx.fill();

  // Shirt front: a wedge, not a rectangle. A suit shows more shirt at the collar than
  // at the waist, and that taper is most of what stops the torso reading as a box.
  ctx.fillStyle = P.shirt;
  ctx.beginPath();
  ctx.moveTo(-2.6, -3.4);
  ctx.lineTo(2.6, -3.4);
  ctx.lineTo(1.6, 8.4);
  ctx.lineTo(-1.6, 8.4);
  ctx.closePath();
  ctx.fill();

  // The trailing flank, following the silhouette's own outer edge so it cannot spill.
  ctx.fillStyle = deep;
  ctx.beginPath();
  ctx.moveTo(-4.4, -2.7);
  ctx.lineTo(-6.0, -0.6);
  ctx.lineTo(-5.4, 3.4);
  ctx.lineTo(-4.4, 10.5);
  ctx.lineTo(-2.4, 10.5);
  ctx.lineTo(-3.2, 3.5);
  ctx.lineTo(-3.6, -0.8);
  ctx.closePath();
  ctx.fill();
}

/** The neck. With a photo head the oval covers most of it; with a caricature it is the
 *  whole join, which is why it is drawn for both rather than in the fallback heads. */
function neck(ctx) {
  ctx.fillStyle = P.skinShade;
  ctx.beginPath();
  ctx.moveTo(-2.3, 1.2);
  ctx.lineTo(-1.9, -5.0);
  ctx.lineTo(1.9, -5.0);
  ctx.lineTo(2.3, 1.2);
  ctx.closePath();
  ctx.fill();
  rect(ctx, -0.6, -5, 2, 6, P.skin);                // throat catching the light
}

/**
 * Collar, lapels and pocket square, drawn AFTER the head on purpose. The photograph is
 * clipped to a bare oval whose bottom edge cuts straight across the neck, and this is
 * what covers that cut: a jaw shadow, then two lapels and two collar tips overlapping
 * the join. Without them the head reads as a sticker pasted on the chest.
 */
function collar(ctx, lit, shade) {
  ctx.save();                                       // shadow the jaw casts on the chest
  ctx.globalAlpha = 0.55;                           // strong enough to break the run of
  ellipse(ctx, 0, -1.6, 4.1, 2.0, P.neckShadow);    // white from chin to shirt front
  ctx.restore();

  ctx.fillStyle = shade;                            // far lapel, in the body's shadow
  ctx.beginPath();
  ctx.moveTo(-1.7, -2.6);
  ctx.lineTo(-4.4, -2.4);
  ctx.lineTo(-3.2, 3.6);
  ctx.lineTo(-1.3, 1.4);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = lit;                              // near lapel, catching the light
  ctx.beginPath();
  ctx.moveTo(1.7, -2.6);
  ctx.lineTo(4.4, -2.4);
  ctx.lineTo(3.2, 3.6);
  ctx.lineTo(1.3, 1.4);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = P.shirtShade;                     // far collar tip
  ctx.beginPath();
  ctx.moveTo(-1.5, -2.8);
  ctx.lineTo(-3.4, -2.4);
  ctx.lineTo(-2.0, 0.8);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = P.shirt;                          // near collar tip
  ctx.beginPath();
  ctx.moveTo(1.5, -2.8);
  ctx.lineTo(3.4, -2.4);
  ctx.lineTo(2.0, 0.8);
  ctx.closePath();
  ctx.fill();

  rect(ctx, 2.4, 3.0, 1.9, 1.3, P.shirt);           // pocket square
}

/**
 * Shared politician body: a suit torso with its jacket panels flapping as wings, arms
 * and legs trailing in the airstream, a fluttering tie, and a head drawn by the
 * caller's `head` callback (or the real photograph, when one has loaded).
 *
 * The figure is drawn flying to the RIGHT -- drawTarget mirrors the whole thing when
 * `t.vx < 0` -- so -x is behind it, and everything loose streams that way. At Balla's 22
 * logical pixels that trailing mass is most of what tells you which way he is going.
 *
 * Depth is carried by tone and never by size: every part of the far side is one step
 * darker than its near twin. Drawing the far side smaller would read as depth too, but
 * it would leave the far wingtip short of the hitbox edge and make that side of the box
 * a lie.
 */
function drawPolitician(ctx, t, opts) {
  const suit = opts.suit;
  const falling = t.state === 'falling';
  // Read `t.h`: Large/Medium/Small figures render at genuinely different sizes, and
  // the fixed-coordinate caricature below scales down to fit inside its own hitbox.
  // Uniform in both axes so nothing -- least of all a photo -- renders distorted.
  const s = t.h / BODY_DESIGN_H;
  // Drawn in design units so the tip lands exactly on the hitbox edge after the
  // uniform scale below: (t.w / 2) / s * s === t.w / 2.
  const wingTip = (t.w / 2) / s;

  // `t.flap` runs 0..2 over FEEL.FLAP_MS. The old code read only `t.flap < 1` -- a hard
  // two-frame toggle, up or down and nothing in between. A sine of the cycle eases the
  // wing through the top and bottom of the stroke where a real wing dwells, and rounding
  // that to quarter steps turns it into five fixed poses: enough to read as a flap, and
  // still crisp. An unrounded tween would slide the silhouette by fractions of a pixel
  // at a 2x nearest-neighbour upscale, which shimmers rather than animates.
  const f = falling ? 0 : Math.round(Math.sin(t.flap * Math.PI) * 2) / 2;
  // The far panel runs an eighth of a cycle ahead of the near one, so the two agree only
  // part of the time. Two panels in perfect sync are exactly what made the old wings read
  // as one flat mirrored shape.
  const fFar = falling ? 0 : Math.round(Math.sin((t.flap + 0.25) * Math.PI) * 2) / 2;
  // `t.phase` is the same wave target.js bobs the figure on, so this leans the body into
  // its own climb and dive -- and since every figure spawns with its own phase, it also
  // keeps two politicians released together from flapping like one animation. It has to
  // come off `t`: Math.random() here would re-roll every frame and the figure would buzz.
  const sway = Math.sin(t.phase);
  const swing = 9.4 + sway * 1.1;                   // how far this one's wingtip travels

  // Hit: the wings collapse, the limbs fly loose and the tie goes over one shoulder, so
  // a splat reads at a glance even before drawTarget starts tumbling the whole sprite.
  const nearTipX = falling ? wingTip * 0.46 : wingTip;
  const farTipX = falling ? wingTip * 0.38 : wingTip;
  const nearTipY = falling ? -3.4 : -0.6 - f * swing;
  // The far panel's sweep is foreshortened as well as offset: same wing, further away.
  const farTipY = falling ? 6.2 : -0.6 - fFar * swing * 0.86;

  ctx.save();
  ctx.scale(s, s);

  // Far side first and a tone darker throughout, so the torso paints over its roots.
  // The arms take the far side's DEEPEST tone and the near side's lightest: a sleeve
  // painted the same colour as the jacket panel it swings across merges into it, and
  // all you see is a cuff and a hand floating in mid-air.
  wingPanel(ctx, -1, farTipX, farTipY, opts.suitShade, opts.suitDeep, null);
  arm(ctx, -3.6, -1.4,
    falling ? -6.8 : -6.4, falling ? 2.6 : 1.2 - fFar * 1.2,
    falling ? -9.4 : -8.6, falling ? 6.4 : 0.2 - fFar * 2.4,
    opts.suitDeep, P.skinShade);
  leg(ctx, -1.6, 8.8,
    falling ? -4.8 : -3.0 + sway * 0.3, falling ? 13.0 : 13.0 + f * 1.2,
    falling ? -8.6 : -5.8 + sway * 0.5, falling ? 14.2 : 14.8 + f * 1.6,
    opts.suitShade, P.politicianShoe);

  // Near leg still goes UNDER the torso, so the jacket hem covers the hip. The two legs
  // pedal in opposition -- +f against -f -- which is what makes them read as legs
  // trailing and kicking rather than as one pair of struts swinging together. They hang
  // BELOW the coat-tails rather than behind them: against the jacket they were three
  // shades of the same navy and disappeared, against the sky they are a silhouette.
  leg(ctx, 1.8, 9.0,
    falling ? 5.0 : 0.2 + sway * 0.3, falling ? 12.4 : 13.4 - f * 1.2,
    falling ? 8.2 : -2.2 + sway * 0.5, falling ? 13.6 : 15.4 - f * 1.0,
    suit, P.politicianShoe);

  suitTorso(ctx, suit, opts.suitDeep);
  neck(ctx);

  wingPanel(ctx, 1, nearTipX, nearTipY, suit, opts.suitShade, opts.suitLit);
  arm(ctx, 3.8, -1.6,
    falling ? 6.6 : 7.0, falling ? -4.4 : 1.0 + f * 1.8,
    falling ? 7.6 : 9.6, falling ? -9.0 : -0.4 + f * 3.4,
    opts.suitLit, P.skin);

  // The caricature head and the photo head both draw in the same scaled frame, so
  // whichever one is showing lines up with the yolk splat drawn right after it.
  const face = faceFor(t.id);
  if (face) drawPhotoHead(ctx, face, FACES[t.id]);
  else opts.head(ctx);

  collar(ctx, opts.suitLit, opts.suitShade);

  // Tie, streaming back and fluttering opposite the flap. `tie: null` means an open
  // collar and no tie at all. `??` alone cannot express that: null is nullish, so it
  // would fall straight through to the default colour and draw the tie anyway.
  if (opts.tie !== null) {
    const tipX = falling ? -4.4 : -1.4 - f * 1.8 + sway * 0.5;
    ctx.fillStyle = opts.tie ?? P.tie;
    ctx.beginPath();
    ctx.moveTo(-1.4, -0.4);
    ctx.lineTo(1.4, -0.4);
    ctx.lineTo(tipX + 1.0, 9.4);
    ctx.lineTo(tipX - 1.0, 10.2);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();                                // knot, sitting in the collar's V
    ctx.moveTo(-1.5, -1.8);
    ctx.lineTo(1.5, -1.8);
    ctx.lineTo(1.2, 0.4);
    ctx.lineTo(-1.2, 0.4);
    ctx.closePath();
    ctx.fill();
  }

  if (t.yolk > 0) drawYolk(ctx, t.w);

  ctx.restore();
}

/**
 * The skull the three caricatures share: skin, the trailing flank in shadow, both ears,
 * a nose and two eyes. Each face then adds only the one or two marks that make it that
 * man, because at Balla's 22 pixels anything finer than about two design units turns to
 * mush -- the caricature has to lose gracefully, since it is the fallback that shows
 * while the photographs load or when they are blocked.
 */
function headBase(ctx, cy, rx, ry) {
  ellipse(ctx, 0, cy, rx, ry, P.skin);
  ellipse(ctx, -rx * 0.52, cy + 0.8, rx * 0.44, ry * 0.72, P.skinShade);   // flank in shade
  ellipse(ctx, -rx * 0.94, cy + 0.8, 1.1, 1.5, P.skinShade);               // far ear
  ellipse(ctx, rx * 0.92, cy + 0.6, 1.2, 1.6, P.skin);                     // near ear
  ellipse(ctx, 1.4, cy + 2.2, 1.1, 1.4, P.skinShade);                      // nose
  ellipse(ctx, -1.9, cy - 0.6, 0.9, 0.9, P.mouth);                         // eyes
  ellipse(ctx, 2.1, cy - 0.6, 0.9, 0.9, P.mouth);
}

function ramaHead(ctx) {
  headBase(ctx, -9.6, 6.2, 7.0);
  ellipse(ctx, 0.6, -14.0, 3.2, 1.5, P.skinLit);    // bald crown catching the sky
  // Trimmed white beard. It stops short of the jaw on purpose: run down to the chin and
  // it meets the white collar and the white shirt below it, and the whole front of the
  // figure becomes one pale column with a pair of glasses on top.
  ctx.fillStyle = P.hairWhite;
  ctx.beginPath();
  ctx.moveTo(-4.8, -8.2);
  ctx.quadraticCurveTo(-4.9, -3.2, 0, -3.6);
  ctx.quadraticCurveTo(4.9, -3.2, 4.8, -8.2);
  ctx.quadraticCurveTo(0, -6.0, -4.8, -8.2);
  ctx.closePath();
  ctx.fill();
  rect(ctx, -2, -6, 4, 1, P.mouth);                 // mouth, cut into the beard
  // The red round glasses are most of the likeness, so they carry the weight here.
  // Filled discs with a dark lens inside, not a 1px stroked ring: a ring that thin lands
  // on about half a pixel once the figure is scaled down and blurs into a red smear
  // across the eyes. A disc with a hole survives the downscale as a red rim.
  ellipse(ctx, -2.7, -10.6, 2.4, 2.4, P.glassesRed);
  ellipse(ctx, 2.7, -10.6, 2.4, 2.4, P.glassesRed);
  rect(ctx, -1, -11, 2, 1, P.glassesRed);           // bridge
  ellipse(ctx, -2.7, -10.6, 1.3, 1.3, P.mouth);     // lenses, with the eyes behind them
  ellipse(ctx, 2.7, -10.6, 1.3, 1.3, P.mouth);
}

function berishaHead(ctx) {
  headBase(ctx, -9.0, 5.8, 6.6);
  ctx.fillStyle = P.hairWhite;                      // thick white hair, swept back
  ctx.beginPath();
  ctx.moveTo(-6.2, -10.4);
  ctx.quadraticCurveTo(-4.0, -17.4, 2.0, -16.2);
  ctx.quadraticCurveTo(6.6, -15.2, 6.2, -9.2);
  ctx.quadraticCurveTo(3.2, -13.0, -1.0, -12.6);
  ctx.quadraticCurveTo(-4.4, -12.4, -6.2, -10.4);
  ctx.closePath();
  ctx.fill();
  rect(ctx, 4, -13, 2, 4, P.hairWhite);             // sideburn on the near side
  rect(ctx, -3, -11, 2, 1, P.hairWhite);            // heavy brows
  rect(ctx, 1, -11, 2, 1, P.hairWhite);
  rect(ctx, -2.5, -5.4, 5, 1, P.mouth);
}

function ballaHead(ctx) {
  headBase(ctx, -8.8, 5.4, 6.0);
  ctx.fillStyle = P.hairDark;                       // short dark hair, low fringe
  ctx.beginPath();
  ctx.moveTo(-5.4, -10.6);
  ctx.quadraticCurveTo(-5.0, -15.6, 0.4, -14.8);
  ctx.quadraticCurveTo(5.2, -14.2, 5.4, -9.6);
  ctx.quadraticCurveTo(3.2, -12.2, -0.6, -11.8);
  ctx.quadraticCurveTo(-3.6, -11.6, -5.4, -10.6);
  ctx.closePath();
  ctx.fill();
  rect(ctx, -3, -10, 2, 1, P.hairDark);             // brows
  rect(ctx, 1, -10, 2, 1, P.hairDark);
  rect(ctx, -2, -5.2, 4, 1, P.mouth);
}

// Four tones per suit, so near and far sides of the same figure can be told apart.
// See PALETTE in config.js for what each tone is for.
export const HEADS = {
  rama: {
    suit: P.suitDark, suitLit: P.suitDarkLit, suitShade: P.suitDarkShade,
    suitDeep: P.suitDarkDeep, head: ramaHead
  },
  berisha: {
    suit: P.suitDark, suitLit: P.suitDarkLit, suitShade: P.suitDarkShade,
    suitDeep: P.suitDarkDeep, head: berishaHead, tie: P.tieAlt
  },
  balla: {
    suit: P.suitNavy, suitLit: P.suitNavyLit, suitShade: P.suitNavyShade,
    suitDeep: P.suitNavyDeep, head: ballaHead, tie: P.tieMaroon
  }
};

/**
 * The politician's real face, cropped from the source photo. Smoothing is enabled for
 * just this call: nearest-neighbour downscaling a photograph produces aliased noise,
 * while every other sprite in the game wants hard pixels.
 */
function drawPhotoHead(ctx, img, spec) {
  const w = spec.h * (spec.sw / spec.sh);
  const prev = ctx.imageSmoothingEnabled;
  ctx.save();
  // Clip to a head-shaped oval so none of the photo's own background shows. This is
  // deliberately NOT a colour key: the three sources have green, studio and pale-blue
  // backgrounds, so there is no single colour to remove — and keying white would eat
  // Rama's white beard, which is most of his likeness.
  ctx.beginPath();
  ctx.ellipse(0, -spec.h / 2, w * 0.47, spec.h * 0.5, 0, 0, Math.PI * 2);
  ctx.clip();
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(img, spec.sx, spec.sy, spec.sw, spec.sh, -w / 2, -spec.h, w, spec.h);
  ctx.imageSmoothingEnabled = prev;
  ctx.restore();
}

/** Yolk overlay for an egged figure. */
function drawYolk(ctx, w) {
  ellipse(ctx, 0, -8, w * 0.24, w * 0.2, P.yolk);
  ellipse(ctx, 2, -6, w * 0.12, w * 0.1, P.yolkDark);
  ellipse(ctx, -3, -10, w * 0.09, w * 0.08, P.yolkDark);
}

export function drawTarget(ctx, t) {
  const spec = HEADS[t.id];
  if (!spec) return;
  ctx.save();
  ctx.translate(Math.round(t.x), Math.round(t.y));
  if (t.state === 'falling') ctx.rotate(t.rot);
  if (t.vx < 0) ctx.scale(-1, 1);
  drawPolitician(ctx, t, spec);
  ctx.restore();

  // Name tag under the figure while it is still flying. Wrapped in save/restore
  // so the font and alignment do not leak into whatever draws next.
  if (t.state === 'flying') {
    ctx.save();
    ctx.font = '5px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = P.hudDim;
    ctx.fillText(t.name, Math.round(t.x), Math.round(t.y + t.h / 2 + 7));
    ctx.restore();
  }
}

function drawFlamingoBody(ctx, bob) {
  ellipse(ctx, 0, 2, 7, 5, P.flamingo);             // body
  ctx.strokeStyle = P.flamingo;
  ctx.lineWidth = 1.6;
  ctx.beginPath();                                   // S-neck
  ctx.moveTo(2, -1);
  ctx.quadraticCurveTo(7, -6 + bob, 3, -10 + bob);
  ctx.stroke();
  ellipse(ctx, 2.5, -11 + bob, 2.2, 1.8, P.flamingo);
  ctx.fillStyle = P.flamingoBeak;                    // downturned beak
  ctx.beginPath();
  ctx.moveTo(0.5, -11 + bob);
  ctx.lineTo(-3, -9.5 + bob);
  ctx.lineTo(0.5, -9 + bob);
  ctx.fill();
  ellipse(ctx, -3, 2, 4, 3.4, P.flamingoDark);       // wing
}

/**
 * A fellow protester, drawn to be recognisably one of yours: a face under a red
 * bandana, a jacket over a shirt, both fists on the placard pole.
 *
 * EVERY shape here is symmetric around x = 0. decoyBox() is centred on d.x and gets
 * mirrored by the ctx.scale(-1,1) in drawDecoy along with the drawing, so only a
 * symmetric drawing lines up with its box in BOTH facing directions — shifting the box
 * instead would fix one direction and break the other. That rules out a one-armed grip
 * and a walking leg cycle, so the arms are a matched pair on a centred pole and the
 * march is a vertical bob, which mirrors to itself. Mirrored rects are written as
 * explicit integer pairs (left [-6,-1] against right [1,6]) because rect() rounds, and
 * rounding a mirrored pair of floats can land the two sides a pixel apart.
 *
 * The pole, the board and the raised hands sit outside the hitbox on purpose: this is a
 * figure you are PENALISED for hitting, so parts an egg passes through are forgiving,
 * whereas widening the box to cover the sign would make it a trap.
 */
function drawProtesterDecoy(ctx, d, mirrored) {
  const bob = Math.round(Math.sin(d.phase) * 0.6);   // marching on the spot
  // One flat tone, the same one the near rank of the background crowd is painted in.
  // This figure used to be a fully modelled sprite -- jacket panels, lapels, skin, hair,
  // eyes -- standing among flat silhouettes, so it read as a different kind of object
  // from the very people it is supposed to belong to. The whole point of the decoy is
  // that the player recognises it as one of their own and holds their throw, and that
  // reads fastest when it is unmistakably the same drawing as the crowd behind it.
  const tone = P.crowdNear;

  ctx.save();                                        // contact shadow, so they stand ON the ground
  ctx.globalAlpha = 0.3;
  ellipse(ctx, 0, 15, 6.5, 1.6, P.groundShadow);
  ctx.restore();

  rect(ctx, -4, 4, 3, 11, tone);                     // legs, down to the box's bottom edge
  rect(ctx, 1, 4, 3, 11, tone);

  ctx.save();
  ctx.translate(0, bob);

  // Pole first: the head and torso paint over its lower half, which is what makes the
  // sign look held rather than pasted on top of the figure.
  rect(ctx, -1, -22, 2, 16, P.placardPole);
  rect(ctx, -12, -32, 24, 10, P.hoarding);           // board, wide enough to read
  rect(ctx, -12, -32, 24, 1, P.placardEdge);
  rect(ctx, -12, -23, 24, 1, P.placardEdge);
  rect(ctx, -12, -32, 1, 10, P.placardEdge);
  rect(ctx, 11, -32, 1, 10, P.placardEdge);
  ctx.save();
  // drawDecoy mirrors the whole figure with scale(-1, 1) when it walks left. Every other
  // shape here is symmetric so it mirrors to itself, but text does not: the slogan came
  // out backwards for half of every crossing. Undo the flip for the text alone -- it is
  // centred on x=0, so counter-scaling about the origin leaves it exactly where it was.
  if (mirrored) ctx.scale(-1, 1);
  ctx.font = 'bold 7px monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = P.crowd;
  ctx.fillText(S.placard, 0, -24.5);
  ctx.restore();

  rect(ctx, -5, -7, 10, 11, tone);                   // torso
  rect(ctx, -6, -7, 12, 2, tone);                    // shoulders, a pixel proud of it

  rect(ctx, -6, -17, 2, 11, tone);                   // both arms up to the pole
  rect(ctx, 4, -17, 2, 11, tone);
  rect(ctx, -7, -19, 4, 3, tone);                    // fists gripping it
  rect(ctx, 3, -19, 4, 3, tone);

  ctx.fillStyle = tone;                              // head
  ctx.beginPath();
  ctx.arc(0, -11, 3.4, 0, Math.PI * 2);
  ctx.fill();

  // The one mark of colour: the same red bandana the player's own thrower wears, which is
  // what says "on your side" at a glance without breaking the silhouette.
  rect(ctx, -3, -11, 6, 2, P.bandana);

  ctx.restore();
}

export function drawDecoy(ctx, d) {
  ctx.save();
  ctx.translate(Math.round(d.x), Math.round(d.y));
  if (d.vx < 0) ctx.scale(-1, 1);

  if (d.kind === 'flamingo') {
    const bob = Math.sin(d.phase) * 1.5;
    drawFlamingoBody(ctx, bob);
    ctx.strokeStyle = P.flamingoDark;                // trailing legs
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-2, 5);
    ctx.lineTo(-9, 9);
    ctx.stroke();
  } else {
    drawProtesterDecoy(ctx, d, d.vx < 0);
  }
  if (d.yolk > 0) drawYolk(ctx, d.w);
  ctx.restore();
}

/**
 * An egg outline: narrow at the top, round at the bottom. An ellipse of these
 * proportions reads as a snowball at this size, and its rotation is invisible
 * because it is nearly symmetrical — the asymmetry is the whole point.
 */
function eggPath(ctx, rx, ry) {
  ctx.beginPath();
  ctx.moveTo(0, -ry);
  ctx.bezierCurveTo(rx * 0.72, -ry, rx, -ry * 0.30, rx, ry * 0.10);
  ctx.bezierCurveTo(rx, ry * 0.72, rx * 0.58, ry, 0, ry);
  ctx.bezierCurveTo(-rx * 0.58, ry, -rx, ry * 0.72, -rx, ry * 0.10);
  ctx.bezierCurveTo(-rx, -ry * 0.30, -rx * 0.72, -ry, 0, -ry);
  ctx.closePath();
}

export function drawEgg(ctx, egg) {
  const ry = EGG.RADIUS;
  const rx = ry / EGG.ASPECT;
  ctx.save();
  ctx.translate(Math.round(egg.x), Math.round(egg.y));
  ctx.rotate(egg.rot);
  ctx.fillStyle = P.egg;
  eggPath(ctx, rx, ry);
  ctx.fill();
  // A crescent of shade down one side, clipped to the shell so it cannot spill.
  ctx.clip();
  ellipse(ctx, rx * 0.65, ry * 0.30, rx * 0.7, ry * 0.7, P.eggShade);
  ctx.restore();
}

export function drawCrosshair(ctx, x, y) {
  ctx.strokeStyle = P.crosshair;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x - 7, y); ctx.lineTo(x - 2, y);
  ctx.moveTo(x + 2, y); ctx.lineTo(x + 7, y);
  ctx.moveTo(x, y - 7); ctx.lineTo(x, y - 2);
  ctx.moveTo(x, y + 2); ctx.lineTo(x, y + 7);
  ctx.stroke();
  ctx.strokeRect(x - 3.5, y - 3.5, 7, 7);
}

/** The player's jacket: sloped shoulders, a waist, and a hem cut off by the frame.
 *  Left as a bare path so the shading can fill and then clip to the same silhouette. */
function throwerJacketPath(ctx) {
  ctx.beginPath();
  ctx.moveTo(-9, 0);
  ctx.lineTo(-10, -16);
  ctx.lineTo(-11.5, -25);
  ctx.lineTo(-8, -29.5);
  ctx.lineTo(-3, -31.5);
  ctx.lineTo(3, -31.5);
  ctx.lineTo(8, -29.5);
  ctx.lineTo(11.5, -25);
  ctx.lineTo(10, -16);
  ctx.lineTo(9, 0);
  ctx.closePath();
}

/**
 * The player's head, seen from behind: a dark hair mass under a red bandana, with both
 * ears just catching light. `turn` is the lean as -1..1.
 */
function throwerHead(ctx, turn, tMs) {
  ellipse(ctx, 0, -41, 5.2, 5.6, P.throwerHair);
  ellipse(ctx, 0, -45.2, 3.4, 1.4, P.throwerHairHi);   // crown catching the sky
  ellipse(ctx, -5, -41, 1.3, 1.9, P.skinShade);        // ears
  ellipse(ctx, 5, -41, 1.3, 1.9, P.skinShade);
  // A sliver of cheek appears on whichever side the head is turning toward. It is what
  // makes the head read as TURNING rather than sliding sideways with the torso.
  if (Math.abs(turn) > 0.2) {
    ellipse(ctx, turn > 0 ? 4 : -4, -39.6, 0.8 + Math.abs(turn) * 1.4, 2.3, P.skin);
  }

  ctx.save();                                          // bandana, trimmed to the skull
  ctx.beginPath();
  ctx.ellipse(0, -41, 5.2, 5.6, 0, 0, Math.PI * 2);
  ctx.clip();
  rect(ctx, -6, -44, 12, 3, P.bandana);
  rect(ctx, -6, -41, 12, 1, P.bandanaShade);
  ctx.restore();
  ellipse(ctx, -4.6, -42.4, 1.8, 1.6, P.bandana);      // knot at the back of the head
  ctx.fillStyle = P.bandanaShade;                      // and its tail, flicking
  ctx.beginPath();
  ctx.moveTo(-5, -43.5);
  ctx.lineTo(-9, -40 + Math.round(Math.sin(tMs * 0.004) * 1.5));
  ctx.lineTo(-5, -39.5);
  ctx.closePath();
  ctx.fill();
}

/**
 * Shoulder → elbow → forearm → hand, cocked back over the shoulder mid-wind-up, with
 * the egg held in the fingers. `eggsLeft === 0` empties the hand.
 */
function throwerArm(ctx, cock, eggsLeft) {
  const ex = 13;
  const ey = -31 - cock * 0.5;
  const hx = 9;
  const hy = -38 - cock;
  // Sleeves are the jacket's shadow tone, not its base: an arm painted the same colour
  // as the torso it crosses merges into it and the forearm reads as a floating stub.
  // No armband — a third red accent this small just reads as a stray mark on the arm.
  limb(ctx, 7, -26, ex, ey, 3, 2.4, P.throwerJacketShade);
  limb(ctx, ex, ey, hx, hy, 2.1, 1.7, P.skin);         // forearm, sleeve rolled up
  ellipse(ctx, hx, hy, 2.2, 2.3, P.skin);              // hand

  if (eggsLeft === 0) {
    rect(ctx, hx - 3, hy - 3, 2, 3, P.skinShade);      // fingers open, nothing left to throw
    return;
  }
  ctx.save();
  ctx.translate(hx - 0.5, hy - 2.6);
  ctx.rotate(-0.45);
  ctx.fillStyle = P.egg;
  eggPath(ctx, 2.2, 3);
  ctx.fill();
  ctx.clip();                                          // shade stays inside the shell
  ellipse(ctx, 1.1, 0.9, 1.7, 1.8, P.eggShade);
  ctx.restore();
  rect(ctx, hx - 3, hy - 2, 3, 2, P.skinShade);        // fingers curled over the shell
}

/**
 * The player: a protester seen from behind at the bottom of the frame, winding up.
 *
 * Head, torso and arms lean by different amounts so the figure twists toward the aim
 * instead of sliding across as one flat cut-out. Every offset is rounded — at a 2x
 * nearest-neighbour upscale a sub-pixel silhouette edge shimmers as the mouse moves,
 * and a stepped lean is the lesser evil.
 *
 * `tMs` drives an idle breathe and wind-up sway; `eggsLeft` empties the hand when the
 * player is out of eggs. Both are optional and both default to a correct neutral pose,
 * so `drawThrower(ctx, aimX)` still renders.
 */
export function drawThrower(ctx, aimX, tMs = 0, eggsLeft = null) {
  const lean = Math.max(-8, Math.min(8, (aimX - VIEW.W / 2) * 0.04));
  const torsoX = Math.round(lean * 0.45);
  const headX = Math.round(lean * 0.95);
  const armX = Math.round(lean * 1.25);
  const offX = Math.round(lean * 0.8);
  // Chest rise: 0 or -1, never positive, so the jacket hem cannot lift off the bottom
  // edge of the frame and show a seam under the HUD bar.
  const breathe = Math.round(Math.sin(tMs * 0.0024) * 0.5 - 0.5);
  const windup = Math.sin(tMs * 0.0016);
  const cock = Math.round(windup * 2);                 // throwing hand rides up and back
  const brace = Math.round(windup * 1.5);              // off hand counterbalances it

  ctx.save();
  ctx.translate(VIEW.W / 2, VIEW.H);

  // Off arm first: it is the far side of the body, so the torso paints over its
  // shoulder end. A bracing arm is most of what sells the wind-up, so the elbow is
  // thrown wide enough to clear the torso — tucked in, the sleeve disappears into the
  // jacket and only a stub of forearm shows.
  ctx.save();
  ctx.translate(offX, breathe);
  limb(ctx, -8, -26, -13, -28.5, 2.6, 2.1, P.throwerJacketShade);
  limb(ctx, -13, -28.5, -16, -34 - brace, 2.1, 1.6, P.skin);
  ellipse(ctx, -16.4, -34.8 - brace, 2.1, 2.2, P.skin);
  ctx.restore();

  ctx.save();
  ctx.translate(torsoX, breathe);
  throwerJacketPath(ctx);
  ctx.fillStyle = P.throwerJacket;
  ctx.fill();
  ctx.clip();                                          // no panel below can spill past the silhouette
  ctx.fillStyle = P.throwerJacketLit;                  // light across the upper back
  ctx.beginPath();
  ctx.moveTo(-7.5, -29);
  ctx.lineTo(7.5, -29);
  ctx.lineTo(6, -14);
  ctx.lineTo(-6, -14);
  ctx.closePath();
  ctx.fill();
  rect(ctx, -1, -31, 2, 31, P.throwerJacketShade);     // back seam
  rect(ctx, -12, -31, 3, 31, P.throwerJacketShade);    // flanks turning away from the light
  rect(ctx, 9, -31, 3, 31, P.throwerJacketShade);
  rect(ctx, -12, -32, 24, 3, P.throwerJacketShade);    // collar
  ctx.restore();

  rect(ctx, Math.round(headX * 0.7) - 3, -37, 6, 7, P.skinShade);   // neck
  ellipse(ctx, Math.round((torsoX + headX) / 2), -29.5, 7.5, 3, P.throwerJacketShade); // hood, pushed back

  ctx.save();
  ctx.translate(headX, breathe);
  throwerHead(ctx, lean / 8, tMs);
  ctx.restore();

  ctx.save();
  ctx.translate(armX, breathe);
  throwerArm(ctx, cock, eggsLeft);
  ctx.restore();

  ctx.restore();
}

export function drawMascot(ctx, mood, tMs) {
  const cheer = mood === 'cheer';
  const bob = cheer ? Math.sin(tMs * 0.012) * 3 : Math.sin(tMs * 0.002) * 0.8;
  ctx.save();
  ctx.translate(38, VIEW.GROUND_Y - 14 - (cheer ? Math.abs(bob) : 0));

  if (mood === 'sad') {
    // Head tucked under the wing.
    ellipse(ctx, 0, 2, 7, 5, P.flamingo);
    ellipse(ctx, -2, 0, 5, 4, P.flamingoDark);
  } else {
    drawFlamingoBody(ctx, bob);
  }

  ctx.strokeStyle = P.flamingoDark;                  // one leg, tucked
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(0, 6);
  ctx.lineTo(0, 14);
  ctx.stroke();
  ctx.restore();
}
