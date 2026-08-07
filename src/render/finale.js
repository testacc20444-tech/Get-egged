import { VIEW, FINALE as F, FACES, PALETTE as P, STRINGS as S } from '../config.js';
import { drawTriumphSquare, drawTriumphCrowd, drawTriumphForeRank } from './background.js';
import { monumentSurge } from '../entities/monument.js';
import { faceFor } from './faces.js';

// The triumph's presentation. It lives outside background.js because it is a whole
// phase's art rather than another entry in SCENES: a monument, its plinth, what happens
// to the square when it comes down, and the card that closes the run.

const CARD = { x: 84, y: 62, w: 312, h: 124 };

function text(ctx, str, x, y, { size = 8, color = P.hudText, align = 'center', bold = false } = {}) {
  ctx.font = `${bold ? 'bold ' : ''}${size}px monospace`;
  ctx.textAlign = align;
  ctx.fillStyle = color;
  ctx.fillText(str, Math.round(x), Math.round(y));
}

/** Overshoots 1 and settles back. F.CARD_BACK is how far past it goes. */
function easeOutBack(t) {
  const u = t - 1;
  return 1 + (F.CARD_BACK + 1) * u * u * u + F.CARD_BACK * u * u;
}

function poly(ctx, pts, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i += 1) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  ctx.fill();
}

/**
 * The photograph, weathered into bronze, built once and kept.
 *
 * Two composite passes rather than a colour ramp: `saturation` against grey strips the
 * photo to its own light and shade, and `color` against the bronze puts a single hue
 * back over it. What survives is the modelling of the face — which is the whole reason
 * to use the photograph here — under one metal.
 *
 * Cached against the Image itself, so the first frames drawn before the face has decoded
 * fall back to the sculpted head below and are replaced the moment it arrives.
 */
let headCache = { img: null, canvas: null };
function bronzeHead() {
  const img = faceFor('rama');
  if (!img || typeof document === 'undefined') return null;
  if (headCache.img === img) return headCache.canvas;
  const spec = FACES.rama;
  const c = document.createElement('canvas');
  c.width = spec.sw;
  c.height = spec.sh;
  const x = c.getContext('2d');
  if (!x) return null;
  x.drawImage(img, spec.sx, spec.sy, spec.sw, spec.sh, 0, 0, spec.sw, spec.sh);
  x.globalCompositeOperation = 'saturation';
  x.fillStyle = '#808080';
  x.fillRect(0, 0, c.width, c.height);
  x.globalCompositeOperation = 'color';
  x.fillStyle = P.bronze;
  x.fillRect(0, 0, c.width, c.height);
  x.globalCompositeOperation = 'source-over';
  headCache = { img, canvas: c };
  return c;
}

/**
 * The head, at `cy` on the statue's own axis. The cast face goes inside a bronze skull
 * drawn a shade lighter, so the silhouette stays a head even before the photo loads and
 * even once the whole thing is upside down.
 */
function statueHead(ctx, cx, cy) {
  const h = 20, w = 15;
  ctx.fillStyle = P.bronzeShade;                     // the skull, and the ears either side
  ctx.beginPath();
  ctx.ellipse(cx, cy, w * 0.56, h * 0.54, 0, 0, Math.PI * 2);
  ctx.fill();
  const cast = bronzeHead();
  if (cast) {
    ctx.save();
    ctx.beginPath();                                 // the same oval mask sprites.js uses
    ctx.ellipse(cx, cy, w * 0.46, h * 0.48, 0, 0, Math.PI * 2);
    ctx.clip();
    const prev = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(cast, 0, 0, cast.width, cast.height, cx - w / 2, cy - h / 2, w, h);
    ctx.imageSmoothingEnabled = prev;
    ctx.restore();
  } else {
    // No photo yet: a plain cast head in the same tones, the way drawTarget falls back
    // to the caricature rather than drawing nothing.
    ctx.fillStyle = P.bronze;
    ctx.beginPath();
    ctx.ellipse(cx, cy, w * 0.44, h * 0.46, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = P.bronzeLit;                       // the brow, catching the east light
  ctx.fillRect(Math.round(cx - w * 0.42), Math.round(cy - h * 0.5), Math.round(w * 0.84), 1);
}

/**
 * The figure, in a greatcoat, drawn upward from the origin.
 *
 * Called inside a transform whose origin is the front edge of its own feet and whose
 * rotation is the lean, so everything here is in the statue's frame and nothing needs to
 * know which way up it currently is. Three tones separate it exactly as they do on
 * Skanderbeg: the coat, its return face away from the dawn, and the lit leading edge.
 */
/**
 * The yolk the player has already put on it. Held in the statue's own frame by state.js,
 * so it rides the bronze all the way over instead of hanging in the air where the hit
 * landed — and it is the running score of the fight, readable at a glance.
 */
function statueSplats(ctx, f) {
  f.splats?.forEach((s, i) => {
    ctx.fillStyle = P.yolk;
    ctx.beginPath();
    ctx.ellipse(s.x, s.y, s.r * 1.35, s.r, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = P.yolkDark;
    ctx.beginPath();
    ctx.ellipse(s.x + 1, s.y + 1, s.r * 0.5, s.r * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
    // A short run down the bronze from every other one, so it reads as something wet
    // thrown at a vertical surface. Deliberately one pixel of dark yolk and not a bar of
    // shell white: white is the highest-contrast thing on the whole statue, and at two
    // pixels wide it stopped reading as a drip and started reading as a matchstick
    // sticking out of him — which is glaring once he is lying on his side.
    if (i % 2 === 0) {
      ctx.fillStyle = P.yolkDark;
      ctx.fillRect(Math.round(s.x), Math.round(s.y + s.r * 0.6), 1, Math.round(2 + s.r * 0.6));
    }
  });
}

/**
 * Where the head was. Drawn in the statue's own frame, so it rides the bronze exactly as
 * the yolk does. The bright edge is the same trick `stumps()` uses for torn metal: a
 * highlight along the break is what separates a sheared surface from a painted-out shape.
 */
function tornNeck(ctx, ax) {
  ctx.fillStyle = P.bronzeShade;
  ctx.fillRect(ax - 4, -78, 8, 5);
  ctx.fillStyle = P.bronzeLit;                       // the tear itself, catching the dawn
  ctx.fillRect(ax - 4, -78, 8, 1);
  ctx.fillRect(ax - 5, -77, 1, 2);
  ctx.fillRect(ax + 4, -78, 1, 3);
  ctx.fillStyle = P.bronzeDeep;                      // and the hollow inside the casting
  ctx.fillRect(ax - 2, -77, 4, 2);
}

/**
 * The damage at the ankles, deepening with every hit.
 *
 * This is the only thing on the statue that reports progress. The yolk accumulates but
 * says nothing about how close the thing is to going over, and a bar across the top of the
 * screen would say it in the language of a HUD the finale deliberately does not draw. Metal
 * tearing where it is bolted down says it in the language of the scene.
 */
function ankleDamage(ctx, hits) {
  if (hits <= 0) return;
  // Fixed offsets rather than random ones: a crack that reshuffled every frame would
  // crawl. Each hit opens the next one along.
  const cracks = [[-11, 0, 4], [7, -1, 5], [-3, -2, 6], [11, -3, 4], [-15, -1, 5], [1, -4, 7]];
  for (let i = 0; i < Math.min(hits, cracks.length); i += 1) {
    const [x, y, h] = cracks[i];
    ctx.fillStyle = P.bronzeDeep;
    ctx.fillRect(x, -6 + y, 1, h);
    if (i % 2 === 0) ctx.fillRect(x + 1, -6 + y + (h >> 1), 1, 2);
    ctx.fillStyle = P.bronzeLit;                     // the lip of the tear
    ctx.fillRect(x - 1, -6 + y, 1, 1);
  }
}

/** What is left standing once it goes: sheared-off boots, and an empty pedestal. */
function stumps(ctx) {
  const x = F.PLINTH.x;
  const y = F.STATUE.footY;
  ctx.fillStyle = P.bronzeShade;
  ctx.fillRect(Math.round(x - 13), Math.round(y - 6), 11, 6);
  ctx.fillRect(Math.round(x + 1), Math.round(y - 5), 10, 5);
  ctx.fillStyle = P.bronzeLit;                       // the bright torn metal on top
  ctx.fillRect(Math.round(x - 13), Math.round(y - 6), 11, 1);
  ctx.fillRect(Math.round(x + 1), Math.round(y - 5), 10, 1);
}

function statueFigure(ctx, f) {
  const AX = -9;                                     // the body's axis, behind the pivot
  // The coat is widest at the shoulders AND at the hem, and pulled in at the waist. That
  // double taper is the whole difference between a figure in a greatcoat and a pillar
  // with a head on it — a single taper from hem to head reads as a bollard at any size.
  poly(ctx, [
    [AX - 19, -2], [AX + 19, -2], [AX + 16, -34], [AX + 17, -60],
    [AX + 13, -66], [AX - 13, -66], [AX - 16, -60], [AX - 15, -34]
  ], P.bronze);
  poly(ctx, [                                        // return face, away from the dawn
    [AX - 19, -2], [AX - 8, -2], [AX - 6, -34], [AX - 7, -60], [AX - 13, -66],
    [AX - 16, -60], [AX - 15, -34]
  ], P.bronzeShade);
  poly(ctx, [                                        // leading edge, catching the east
    [AX + 13, -4], [AX + 19, -2], [AX + 16, -34], [AX + 17, -60], [AX + 13, -66],
    [AX + 10, -63], [AX + 13, -34]
  ], P.bronzeLit);
  // The opening of the coat, off the centre line so the figure reads as turned slightly
  // into the square rather than facing straight out of the screen.
  poly(ctx, [[AX + 2, -63], [AX + 6, -61], [AX + 4, -30], [AX, -30]], P.bronzeShade);
  // Arms. Both break the coat's outline by two or three pixels — an arm drawn inside the
  // silhouette is not an arm, it is a shading stripe, which is what the first pass had.
  poly(ctx, [[AX + 13, -62], [AX + 21, -59], [AX + 22, -32], [AX + 16, -32]], P.bronze);
  poly(ctx, [[AX + 19, -59], [AX + 21, -58], [AX + 22, -34], [AX + 19, -34]], P.bronzeLit);
  poly(ctx, [[AX - 13, -62], [AX - 21, -59], [AX - 22, -32], [AX - 16, -32]], P.bronzeShade);
  ctx.fillStyle = P.bronzeDeep;                      // the shoulder line, and its shadow
  ctx.fillRect(AX - 13, -68, 26, 2);
  ctx.fillStyle = P.bronzeShade;                     // neck, set into the collar
  ctx.fillRect(AX - 4, -74, 8, 8);
  ctx.fillStyle = P.bronzeDeep;
  ctx.fillRect(AX - 6, -68, 12, 1);
  // Once the impact has sheared it off, the head is its own body in world coordinates and
  // is drawn by drawFinaleScene. What is left here is the break.
  if (f.head) tornNeck(ctx, AX);
  else statueHead(ctx, AX, -82);
  ankleDamage(ctx, f.hits);
  statueSplats(ctx, f);                              // over the bronze, under nothing
}

/** The plinth. It is drawn whatever the statue is doing, and stays when it is gone. */
function plinth(ctx) {
  const b = F.PLINTH;
  const half = b.w / 2;
  ctx.fillStyle = P.statuePlinthShade;
  ctx.fillRect(Math.round(b.x - half - 4), Math.round(b.baseY - 5), Math.round(b.w + 8), 5);
  ctx.fillStyle = P.statuePlinth;
  ctx.fillRect(Math.round(b.x - half + 5), Math.round(b.baseY - b.h + 4),
    Math.round(b.w - 10), Math.round(b.h - 9));
  ctx.fillStyle = P.statuePlinthShade;               // the return face
  ctx.fillRect(Math.round(b.x + half - 11), Math.round(b.baseY - b.h + 4), 6,
    Math.round(b.h - 9));
  ctx.fillStyle = P.statueLit;                       // cornice the statue stands on
  ctx.fillRect(Math.round(b.x - half), Math.round(b.baseY - b.h), Math.round(b.w), 4);
  ctx.fillStyle = P.statuePlinthShade;
  ctx.fillRect(Math.round(b.x - half), Math.round(b.baseY - b.h + 4), Math.round(b.w), 1);
}

/**
 * The paving, broken where the statue struck it.
 *
 * Driven off `f.ms` in the `down` state rather than its own timer: it opens fast and then
 * stays, because a crack that faded out with the dust would say the square repaired itself.
 * That also means the skip — which jumps f.ms straight to CARD_DELAY_MS — gets the finished
 * crack for free.
 *
 * The fork offsets are fixed. A crack rebuilt from random numbers every frame crawls, which
 * is the single most obvious way to make a still object look like a rendering fault.
 */
const CRACKS = [
  [[0, 0], [18, 3], [39, 1], [58, 6], [79, 4]],
  [[0, 0], [-16, 4], [-34, 2], [-52, 7], [-71, 5]],
  [[0, 0], [11, -3], [27, -5], [44, -4]],
  [[0, 0], [-9, -3], [-23, -6], [-38, -5]],
  [[0, 0], [4, 7], [12, 13], [25, 16]],
  [[0, 0], [-5, 6], [-14, 12], [-26, 15]]
];

function groundCrack(ctx, f) {
  if (f.state !== 'down') return;
  const p = Math.min(1, f.ms / F.CRACK_MS);
  const ox = F.PLINTH.x + F.CRACK_DX;
  const oy = VIEW.GROUND_Y + F.CRACK_DY;
  ctx.strokeStyle = P.pavingCrack;
  ctx.lineWidth = 1;
  CRACKS.forEach((line) => {
    // Each fork draws only as far along itself as `p` has got, so they all open together
    // out from the impact instead of appearing whole.
    const reach = 1 + (line.length - 1) * p;
    ctx.beginPath();
    ctx.moveTo(ox + 0.5, oy + 0.5);
    for (let i = 1; i < reach; i += 1) {
      const [dx, dy] = line[Math.min(i, line.length - 1)];
      const t = Math.min(1, reach - i);               // the leading segment grows smoothly
      const [px, py] = line[i - 1];
      ctx.lineTo(Math.round(ox + px + (dx - px) * t) + 0.5,
        Math.round(oy + py + (dy - py) * t) + 0.5);
    }
    ctx.stroke();
  });
}

/**
 * Dust. Driven by the countdown in `f.dust` rather than a clock, so it inherits pause for
 * free like everything else in the finale.
 *
 * Puffs along the length of the fallen figure rather than two clouds at its ends: the
 * statue came down along a line, and a plume that knows which way it fell is the difference
 * between an impact and a smoke machine. Each puff rises and spreads on its own offset,
 * and a fast low ring runs out along the ground under all of them.
 */
const PUFFS = [
  [4, 1.0, 0.0], [22, 0.8, 0.10], [42, 0.9, 0.05], [60, 0.75, 0.18],
  [78, 0.85, 0.12], [96, 0.9, 0.06], [112, 0.6, 0.24]
];

function dust(ctx, f) {
  if (f.dust <= 0) return;
  const p = 1 - f.dust / F.DUST_MS;                  // 0 at impact, 1 when it has cleared

  // The ground ring: wide, flat and quick, gone well before the puffs are.
  const ring = Math.min(1, p / 0.35);
  if (ring < 1) {
    ctx.globalAlpha = (1 - ring) * 0.5;
    ctx.fillStyle = P.dust;
    ctx.beginPath();
    ctx.ellipse(F.PLINTH.x + 56, VIEW.GROUND_Y - 2, 30 + ring * 120, 5 + ring * 9,
      0, 0, Math.PI * 2);
    ctx.fill();
  }

  PUFFS.forEach(([dx, s, delay], i) => {
    const q = (p - delay) / (1 - delay);              // its own life, started late
    if (q <= 0) return;
    const spread = (10 + q * 54) * s;
    ctx.globalAlpha = (1 - q) * 0.8 * s;
    ctx.fillStyle = P.dust;
    ctx.beginPath();
    ctx.ellipse(F.PLINTH.x + dx, VIEW.GROUND_Y - 4 - q * 26 * s, spread, spread * 0.78,
      0, 0, Math.PI * 2);
    ctx.fill();
    // A darker core, offset the other way, so the cloud has some depth to it rather than
    // reading as one flat blob per puff.
    ctx.globalAlpha = (1 - q) * 0.45 * s;
    ctx.fillStyle = P.rubble;
    ctx.beginPath();
    ctx.ellipse(F.PLINTH.x + dx + (i % 2 ? 5 : -5), VIEW.GROUND_Y - 2 - q * 16 * s,
      spread * 0.5, spread * 0.34, 0, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
}

/**
 * The screen kick. Deterministic in `f.shake`, so a paused frame never jitters.
 *
 * The amplitude falls with the SQUARE of what is left, not linearly: an impact is violent
 * and then over, where a linear decay spends most of its life at a middling amplitude and
 * reads as a wobble rather than as a hit. The frequencies are high and mutually prime-ish
 * so the two axes do not fall into step and turn the kick into a diagonal slide.
 */
export function finaleShake(f) {
  if (!f || f.shake <= 0) return { dx: 0, dy: 0 };
  const k = Math.min(1, f.shake / (f.state === 'down' ? F.LAND_SHAKE_MS : F.SHAKE_MS));
  const amp = F.SHAKE_PX * k * k;
  return {
    dx: Math.round(Math.sin(f.shake * 0.31) * amp),
    dy: Math.round(Math.cos(f.shake * 0.47) * amp * 0.7)
  };
}

/**
 * The barely-there idle while it still stands. Deliberately render-only and deliberately
 * tiny: statueBox() derives the hitbox from f.angle, and anything the simulation does not
 * know about would put what the player can hit slightly out of step with what they see. At
 * this amplitude the top of the statue moves a third of a pixel, inside a hitbox 46 wide,
 * so nothing can disagree — it exists only so the bronze is never perfectly still.
 */
function breath(f, tMs) {
  return f.state === 'standing' ? Math.sin(tMs * 0.0011) * 0.004 : 0;
}

export function drawFinaleScene(ctx, f, backdrop, tMs) {
  const surge = monumentSurge(f);
  drawTriumphSquare(ctx, backdrop, tMs);
  plinth(ctx);
  drawTriumphCrowd(ctx, backdrop, tMs, surge);
  if (f) {
    if (f.state !== 'standing') stumps(ctx);         // the pedestal, and what it kept
    groundCrack(ctx, f);                             // under the figure lying on it
    ctx.save();
    // `drop` is what takes it off the pedestal; rotation alone leaves it lying in
    // mid-air at the height of the plinth it was standing on.
    ctx.translate(F.PLINTH.x + F.PIVOT_DX, F.STATUE.footY + (f.drop ?? 0));
    ctx.rotate(f.angle + breath(f, tMs));
    statueFigure(ctx, f);
    ctx.restore();
    // The head, once it is its own body. Drawn after the figure so it passes in front of
    // the fallen greatcoat as it rolls clear, and before the dust so the plume covers it.
    if (f.head) {
      ctx.save();
      ctx.translate(Math.round(f.head.x), Math.round(f.head.y));
      ctx.rotate(f.head.angle);
      statueHead(ctx, 0, 0);
      ctx.restore();
    }
    dust(ctx, f);
  }
  drawTriumphForeRank(ctx, backdrop, tMs, surge);
}

/**
 * What sits over the scene: the standing instruction while it is up, the victory card
 * once it is down. `now` is the wall clock, so the blink keeps going while the world
 * behind it does not — a prompt that stops moving reads as a lock-up, not as a pause.
 */
export function drawFinaleOverlay(ctx, f, view, now) {
  if (!f) return;

  if (f.state !== 'down' || f.ms < F.CARD_DELAY_MS) {
    if (f.state !== 'standing') return;              // nothing to say while it goes over
    if (Math.floor(now / 500) % 2 === 0) {
      text(ctx, S.topple, VIEW.W / 2, 30, { size: 13, bold: true, color: P.yolk });
    }
    // How far there is to go, as the pips the HUD would have carried.
    for (let i = 0; i < F.HITS_TO_TOPPLE; i += 1) {
      ctx.fillStyle = i < f.hits ? P.good : P.hudDim;
      ctx.fillRect(VIEW.W / 2 - (F.HITS_TO_TOPPLE * 8) / 2 + i * 8, 38, 6, 4);
    }
    return;
  }

  const a = Math.min(1, (f.ms - F.CARD_DELAY_MS) / F.CARD_FADE_MS);
  ctx.save();
  // The card arrives rather than appearing. It overshoots very slightly and settles — a
  // plain alpha fade after six seconds of the square coming apart reads as the game going
  // quiet, and this is the one moment that should not.
  const cardCx = CARD.x + CARD.w / 2;
  const cardCy = CARD.y + CARD.h / 2;
  const grow = F.CARD_FROM + (1 - F.CARD_FROM) * easeOutBack(a);
  ctx.translate(cardCx, cardCy);
  ctx.scale(grow, grow);
  ctx.translate(-cardCx, -cardCy);
  ctx.globalAlpha = a;
  ctx.fillStyle = P.hudBg;
  ctx.globalAlpha = a * 0.9;
  ctx.fillRect(CARD.x, CARD.y, CARD.w, CARD.h);
  ctx.globalAlpha = a;
  ctx.strokeStyle = P.yolk;
  ctx.lineWidth = 1;
  ctx.strokeRect(CARD.x + 0.5, CARD.y + 0.5, CARD.w - 1, CARD.h - 1);
  const cx = CARD.x + CARD.w / 2;
  text(ctx, S.won, cx, CARD.y + 36, { size: 28, bold: true, color: P.yolk });
  text(ctx, S.wonSub, cx, CARD.y + 54, { size: 8, color: P.flamingo });
  text(ctx, `${view.round} ${S.wonRound}`, cx, CARD.y + 72, { size: 7, color: P.hudDim });
  text(ctx, `${S.score} ${view.score}`, cx, CARD.y + 90, { size: 11 });
  text(ctx, `${S.best} ${view.best}`, cx, CARD.y + 103, { size: 8, color: P.yolk });
  if (Math.floor(now / 500) % 2 === 0) {
    text(ctx, S.restart, cx, CARD.y + 117, { size: 7, color: P.hudDim });
  }
  ctx.restore();
}
