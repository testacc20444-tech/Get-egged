import { PALETTE as P, VIEW, STRINGS as S } from '../config.js';

// What a protester is doing with their arms. Baked per person at creation; the draw
// path only reads it.
const POSE = { DOWN: 0, FIST: 1, BOTH: 2, HOLD: 3 };

// Crowd ranks, back to front. A flat tone per rank rather than a global alpha keeps the
// silhouettes crisp over the sky gradient and costs nothing per figure, and `dy` steps
// each rank lower down the ground strip so the crowd has volume instead of being one
// flat row.
const CROWD_RANKS = [
  { dy: -1, s: 0.74, tone: P.crowdFar },
  { dy: 3, s: 0.9, tone: P.crowd },
  { dy: 8, s: 1.06, tone: P.crowdNear }
];

const CROWD_SWAY_RATE = 0.0026;

// The walk cycle, used only by scenes that hand protesterSilhouette a stride; every
// other scene's crowd stands, and passes nothing.
// STRIDE is how far a foot swings from under the hip, as a fraction of drawn height:
// 0.24 throws a near-rank marcher's leg about 35 degrees off vertical, which reads as a
// purposeful march at 20px tall without tipping into a silly walk.
const WALK_STRIDE = 0.24;
// Arms get a fraction of that and a hard cap. They are 1px bars hanging off a shoulder
// only a pixel proud of the torso, so past ~2px a swinging arm is just a floating line.
const WALK_ARM_SWING = 0.45;
const WALK_ARM_MAX = 2;

/**
 * One protester's fixed data. Everything random is decided here, once, so the draw path
 * never calls Math.random() and nobody jitters or changes pose between frames.
 */
function crowdPerson(x, h, allowPlacard) {
  // One roll decides the accessory, so a protester never carries two of them.
  const roll = Math.random();
  const flag = roll < 0.14;
  const placard = allowPlacard && roll >= 0.14 && roll < 0.3;
  const light = roll >= 0.3 && roll < 0.44;
  const flare = roll >= 0.44 && roll < 0.48;
  const stance = Math.random();
  return {
    x,
    h,
    flag,
    placard,
    light,
    flare,
    phase: Math.random() * Math.PI * 2,
    sway: 0.4 + Math.random() * 0.9,
    build: 0.82 + Math.random() * 0.5,
    flip: Math.random() < 0.5 ? -1 : 1,
    // Carrying something means an arm is already up holding it.
    pose: flag || placard || light || flare
      ? POSE.HOLD
      : stance < 0.34 ? POSE.DOWN : stance < 0.72 ? POSE.FIST : POSE.BOTH,
    rank: 0
  };
}

/** Fixed random scenery, generated once so nothing jitters between frames. */
export function createBackdrop() {
  const rand = (n, fn) => Array.from({ length: n }, (_, i) => fn(i));
  return {
    reeds: rand(46, () => ({ x: Math.random() * VIEW.W, h: 10 + Math.random() * 22, lean: Math.random() * 2 - 1 })),
    farFlamingos: rand(5, () => ({ x: 20 + Math.random() * 440, y: 150 + Math.random() * 30, s: 0.5 + Math.random() * 0.35 })),
    glideFlamingos: rand(3, (i) => ({ x0: Math.random() * VIEW.W, y: 34 + i * 16, sp: 0.008 + Math.random() * 0.008, s: 0.45 + Math.random() * 0.2 })),
    pines: rand(14, () => ({ x: Math.random() * VIEW.W, h: 16 + Math.random() * 26 })),
    // The water band starts at GROUND_Y - 34, so pans sit just inside its top
    // edge: that band's far side reads as the opposite shore. Starting any
    // higher would float them in the sky above the water.
    saltPans: rand(20, () => ({ x: Math.random() * VIEW.W, y: VIEW.GROUND_Y - 33 + Math.random() * 8, w: 10 + Math.random() * 26, h: 2 + Math.random() * 3 })),
    // Sorted by rank at creation so the draw path paints far to near in a single pass,
    // without sorting or partitioning 60 people every frame.
    crowd: rand(60, () => {
      const p = crowdPerson(Math.random() * VIEW.W, 12 + Math.random() * 10, true);
      const depth = Math.random();
      p.rank = depth < 0.4 ? 0 : depth < 0.72 ? 1 : 2;
      return p;
    }).sort((a, b) => a.rank - b.rank),
    // A sparse near rank of fellow protesters for the ground line of EVERY scene — the
    // player is one of them. Slots step outward, alternating left and right of centre,
    // so a scene that draws only the first few still gets them spread across the frame,
    // and none of them lands on the thrower at VIEW.W / 2. No placards: the one sign
    // meant to be read belongs to the decoy you get penalised for hitting.
    foreCrowd: rand(12, (i) => crowdPerson(
      Math.round(VIEW.W / 2 + (i % 2 === 0 ? -1 : 1) * (38 + ((i / 2) | 0) * 34 + Math.random() * 16)),
      15 + Math.random() * 9,
      false
    )),
    stars: rand(30, () => ({ x: Math.random() * VIEW.W, y: Math.random() * 60, a: 0.2 + Math.random() * 0.5 })),
    // Trees flanking the two square scenes, in two banks hugging the left and right
    // edges. Deliberately nowhere near the middle: the building is what each of those
    // scenes is about, and a tree in front of it would be the one thing you cannot
    // move. Heights are capped so no canopy reaches FEEL.FLY_Y_MAX and hides a target.
    // The 18px spacing is tighter than the canopies are wide on purpose — overlapping
    // crowns read as a bank of plane trees, four spaced lollipops do not, and pulling
    // them this hard into the corners is what opens the slot the Skanderbeg monument
    // stands in. `dy` steps each tree a pixel deeper so the bank is not one flat row.
    squareTrees: rand(8, (i) => ({
      x: i < 4 ? 2 + i * 18 : VIEW.W - 2 - (i - 4) * 18,
      h: 40 + Math.random() * 22,
      dy: (i % 4) * 2
    })),
    // Cloud for the capital's sky, baked so neither square scene rolls dice per frame.
    // Kept high, thin and faint: this is the one piece of scenery that lives inside the
    // band the politicians fly through, so it may add atmosphere but never contrast.
    skyClouds: rand(4, (i) => ({
      x: 34 + i * 122 + Math.random() * 46,
      y: 16 + Math.random() * 22,
      w: 22 + Math.random() * 20,
      h: 4 + Math.random() * 3
    }))
  };
}

function sky(ctx) {
  const g = ctx.createLinearGradient(0, 0, 0, VIEW.GROUND_Y);
  g.addColorStop(0, P.skyTop);
  g.addColorStop(0.55, P.skyMid);
  g.addColorStop(1, P.skyLow);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIEW.W, VIEW.GROUND_Y);
}

function sun(ctx, x, y) {
  ctx.fillStyle = P.sun;
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  ctx.arc(x, y, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

/** Small decorative flamingo used in the parallax layers. Never a target. */
function miniFlamingo(ctx, x, y, s, gliding, tMs) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.fillStyle = P.flamingo;
  ctx.beginPath();
  ctx.ellipse(0, 0, 6, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = P.flamingo;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(3, -2);
  ctx.quadraticCurveTo(7, -6, 4, -9);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(3.5, -10, 2, 1.6, 0, 0, Math.PI * 2);
  ctx.fill();
  if (gliding) {
    const w = Math.sin(tMs * 0.01 + x) * 4;
    ctx.fillStyle = P.flamingoDark;
    ctx.beginPath();
    ctx.moveTo(-1, -1);
    ctx.lineTo(-8, -1 + w);
    ctx.lineTo(-1, 2);
    ctx.fill();
  } else {
    ctx.strokeStyle = P.flamingoDark;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 4);
    ctx.lineTo(0, 11);
    ctx.stroke();
  }
  ctx.restore();
}

/** `count` trims the far end of the list rather than slicing it: this runs every frame. */
function reeds(ctx, list, count = list.length) {
  const n = Math.min(count, list.length);
  for (let i = 0; i < n; i += 1) {
    const r = list[i];
    ctx.strokeStyle = i % 3 === 0 ? P.reedLight : P.reed;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(r.x, VIEW.GROUND_Y + 8);
    ctx.quadraticCurveTo(r.x + r.lean * 3, VIEW.GROUND_Y + 8 - r.h / 2, r.x + r.lean * 6, VIEW.GROUND_Y + 8 - r.h);
    ctx.stroke();
  }
}

/** Red flag on a raised pole. At this size a two-headed blob is the whole eagle, and
 *  it is enough to read as the flag. */
function crowdFlag(ctx, x, fistY, u, flip, wob) {
  const fw = Math.max(6, Math.round(u * 0.42));
  const fh = Math.max(4, Math.round(u * 0.26));
  const top = fistY - Math.round(u * 0.4);
  // Poles are the wood tone, not the crowd tone: a silhouette pole on a dark ground
  // vanishes and leaves the flag hanging in mid-air.
  ctx.fillStyle = P.placardPole;
  ctx.fillRect(x, top, 1, fistY - top + 2);
  const px = flip > 0 ? x + 1 : x - 1;                 // edge on the pole
  const ex = flip > 0 ? x + 1 + fw : x - 1 - fw;       // free edge, the one that waves
  const wave = Math.round(wob * 1.5);
  ctx.fillStyle = P.flag;
  ctx.beginPath();
  ctx.moveTo(px, top);
  ctx.lineTo(ex, top + wave);
  ctx.lineTo(ex, top + fh + wave);
  ctx.lineTo(px, top + fh);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = P.flagShade;                         // fold along the lower edge
  ctx.beginPath();
  ctx.moveTo(px, top + fh - 1.5);
  ctx.lineTo(ex, top + fh + wave - 1.5);
  ctx.lineTo(ex, top + fh + wave);
  ctx.lineTo(px, top + fh);
  ctx.closePath();
  ctx.fill();
  const eagleX = Math.round((px + ex) / 2) - 1;
  const eagleY = Math.round(top + fh * 0.35 + wave * 0.5);
  ctx.fillStyle = P.flagEagle;
  ctx.fillRect(eagleX, eagleY, 2, Math.max(1, fh - 4));
  ctx.fillRect(eagleX - 1, eagleY - 1, 1, 1);
  ctx.fillRect(eagleX + 2, eagleY - 1, 1, 1);
}

function crowdPlacard(ctx, x, fistY, u) {
  const bw = Math.max(10, Math.round(u * 0.8));
  const bh = Math.max(7, Math.round(u * 0.5));
  const top = fistY - 1 - bh;
  const left = x - (bw >> 1);
  ctx.fillStyle = P.placardPole;                       // see crowdFlag: a dark pole vanishes
  ctx.fillRect(x, top + bh, 1, fistY - top - bh + 2);
  ctx.fillStyle = P.hoarding;
  ctx.fillRect(left, top, bw, bh);
  ctx.fillStyle = P.placardEdge;
  ctx.fillRect(left, top, bw, 1);
  ctx.fillRect(left, top + bh - 1, bw, 1);
  // The slogan only goes on boards with room for it — below that it is illegible noise
  // and two more fillText calls per frame.
  if (bw >= 13 && bh >= 9) {
    ctx.save();
    ctx.font = 'bold 4px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = P.crowd;
    ctx.fillText(S.placardTop, left + bw / 2, top + 5);
    ctx.fillText(S.placardBottom, left + bw / 2, top + 9);
    ctx.restore();
  }
}

/** A phone held up in the dark. The glow is most of what makes a night crowd read — but
 *  it stays small: a wide flat-alpha disc reads as a ball stuck to someone's head. */
function crowdPhone(ctx, x, fistY, tone) {
  ctx.fillStyle = tone;
  ctx.fillRect(x - 1, fistY - 4, 2, 3);
  ctx.fillStyle = P.phoneGlow;
  ctx.fillRect(x - 1, fistY - 4, 2, 1);
  ctx.save();
  ctx.globalAlpha = 0.2;
  ctx.beginPath();
  ctx.arc(x, fistY - 4, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function crowdFlare(ctx, x, fistY, tMs, phase) {
  ctx.fillStyle = P.flare;
  ctx.fillRect(x - 1, fistY - 5, 3, 4);
  ctx.save();
  ctx.globalAlpha = 0.24;
  ctx.beginPath();                                     // halo
  ctx.arc(x, fistY - 4, 4, 0, Math.PI * 2);
  ctx.fill();
  // Smoke on a short rising loop, deliberately capped: a longer plume would climb into
  // the band the politicians fly through and fog a target.
  const rise = (tMs * 0.012 + phase * 12) % 16;
  ctx.globalAlpha = 0.18 * (1 - rise / 16);
  ctx.fillStyle = P.smoke;
  ctx.beginPath();
  ctx.ellipse(x + rise * 0.2, fistY - 7 - rise, 2.5 + rise * 0.25, 2 + rise * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * A hanging arm, hinged at the elbow: the shoulder end takes half the fist's throw so a
 * swinging arm still touches the body. A single displaced rect is one op cheaper but at
 * full swing it is a 1px line floating beside a shoulder. `sw` 0 is the standing arm,
 * and is deliberately the same single fillRect it always was.
 */
function hangingArm(ctx, x, y, h, sw) {
  if (sw === 0) { ctx.fillRect(x, y, 1, h); return; }
  const mid = h >> 1;
  ctx.fillRect(x + ((sw / 2) | 0), y, 1, mid + 1);     // 1px overlap, or the elbow seams
  ctx.fillRect(x + sw, y + mid, 1, h - mid);
}

/**
 * One background protester: a flat silhouette assembled from a handful of fillRects and
 * a single arc, or from one path and that arc once it is walking. 60+ of these draw every
 * frame, so each body has to be this cheap and every random choice was already baked into
 * `c` by crowdPerson(). `night` turns on the phone lights and flares, which only read in
 * the dark Tirana scene.
 *
 * `walk` and `stridePhase` are the walk cycle, and default to standing still: only the
 * march scene passes them, because only there is the crowd going anywhere. `walk` scales
 * the stride (a nearer rank throws a longer leg), and `stridePhase` is a phase in
 * radians the scene derives from the distance the road has actually travelled, so the
 * legs and the ground under them cannot disagree however fast the round is played.
 */
function protesterSilhouette(ctx, c, tMs, baseY, s, tone, night, walk = 0, stridePhase = 0) {
  const u = Math.round(c.h * s);                       // drawn height
  const wob = Math.sin(tMs * CROWD_SWAY_RATE + c.phase);
  const cx = Math.round(c.x + wob * c.sway);           // whole body sways off its own phase
  // c.phase staggers each person off the shared stride clock. A crowd stepping in unison
  // reads as one hinged object being dragged along, not as sixty people.
  const stride = walk > 0 ? Math.sin(stridePhase + c.phase) : 0;
  const swing = Math.round(stride * u * WALK_STRIDE * walk);
  const armSwing = Math.max(-WALK_ARM_MAX,
    Math.min(WALK_ARM_MAX, Math.round(swing * WALK_ARM_SWING)));
  const holdSwing = (armSwing / 2) | 0;                // truncates toward 0, so symmetric
  // Hips drop a pixel with the legs apart and lift as they pass, twice per stride. The
  // feet stay planted and everything above rides it together: at this size a head with a
  // bob of its own is a nodding puppet, and one held still while the shoulders move
  // reads as a head coming off.
  const bob = Math.abs(stride) > 0.5 ? 1 : 0;
  const lean = walk > 0 ? 1 : 0;
  const headR = Math.max(1, Math.round(u * 0.09));
  const headY = baseY - u + headR + bob;
  const shY = headY + headR + 2;                       // shoulder line
  const hipY = Math.round(baseY - u * 0.42) + bob;
  const bw = Math.max(3, Math.round(u * 0.2 * c.build));
  const half = bw >> 1;
  const bx = cx - half;
  const tx = bx + lean;                                // hips stay put, the trunk leads
  const legW = Math.max(1, Math.round(bw * 0.34));
  const armH = Math.round(u * 0.28);
  const fistY = headY - headR - 2 - Math.round(wob + 1);   // fists pump 0-2px
  const holdX = cx + lean + c.flip * (half + 1) + holdSwing;
  const otherX = cx + lean - c.flip * (half + 1) - holdSwing;

  ctx.fillStyle = tone;
  if (walk > 0) {
    // Legs have to be quads hinged at the hip. A displaced fillRect leg is a pixel
    // cheaper but at a full marching stride — 8px of throw on a 2px-wide leg — it walks
    // straight off the body, and splitting it into thigh and shin only moves the break
    // to the knee. Once they are a path the torso rides along in the same fill, so the
    // whole trunk is one fill where it used to be four rects.
    const hipR = bx + bw - legW;
    ctx.beginPath();
    ctx.moveTo(bx, hipY);
    ctx.lineTo(bx + legW, hipY);
    ctx.lineTo(bx + legW + swing, baseY);
    ctx.lineTo(bx + swing, baseY);
    ctx.moveTo(hipR, hipY);                            // the other leg, opposite throw
    ctx.lineTo(hipR + legW, hipY);
    ctx.lineTo(hipR + legW - swing, baseY);
    ctx.lineTo(hipR - swing, baseY);
    ctx.rect(tx, shY, bw, hipY - shY);                 // torso
    ctx.rect(tx - 1, shY, bw + 2, 2);                  // shoulders, a pixel proud of it
    ctx.fill();
  } else {
    ctx.fillRect(bx, hipY, legW, baseY - hipY);        // legs
    ctx.fillRect(bx + bw - legW, hipY, legW, baseY - hipY);
    ctx.fillRect(tx, shY, bw, hipY - shY);             // torso
    ctx.fillRect(tx - 1, shY, bw + 2, 2);              // shoulders, a pixel proud of it
  }
  ctx.beginPath();
  ctx.arc(cx + lean, headY, headR, 0, Math.PI * 2);
  ctx.fill();

  if (c.pose === POSE.DOWN) {
    // Each arm swings against its own side's leg. Without it a walking silhouette reads
    // as a mannequin being slid along the pavement, legs or no legs.
    hangingArm(ctx, tx - 1, shY + 2, armH, -armSwing);
    hangingArm(ctx, tx + bw, shY + 2, armH, armSwing);
  } else {
    ctx.fillRect(holdX, fistY, 1, shY - fistY);        // raised arm
    ctx.fillRect(holdX - 1, fistY - 2, 3, 3);          // fist
    if (c.pose === POSE.BOTH) {
      ctx.fillRect(otherX, fistY + 1, 1, shY - fistY - 1);
      ctx.fillRect(otherX - 1, fistY - 1, 3, 3);
    } else {
      hangingArm(ctx, otherX, shY + 2, armH, armSwing);   // the other arm hangs
    }
  }

  if (c.flag) crowdFlag(ctx, holdX, fistY, u, c.flip, wob);
  else if (c.placard) crowdPlacard(ctx, holdX, fistY, u);
  else if (night && c.light) crowdPhone(ctx, holdX, fistY, tone);
  else if (night && c.flare) crowdFlare(ctx, holdX, fistY, tMs, c.phase);
}

/**
 * The near rank that stands on the ground line of every scene. `count` is the per-scene
 * density — Sazan is a near-empty island, Tirana is a city square. They sit low and
 * short enough that nothing they hold reaches the band the politicians fly through.
 */
function foreRank(ctx, b, tMs, count, night, walk = 0, stridePhase = 0) {
  for (let i = 0; i < count; i += 1) {
    protesterSilhouette(ctx, b.foreCrowd[i], tMs, VIEW.GROUND_Y + 11, 1.18, P.crowdNear,
      night, walk, stridePhase);
  }
}

function lagoon(ctx, b, tMs) {
  sky(ctx);
  sun(ctx, 396, 62);
  ctx.fillStyle = P.water;
  ctx.fillRect(0, VIEW.GROUND_Y - 34, VIEW.W, 34);
  for (let i = 0; i < 7; i += 1) {
    ctx.fillStyle = P.waterHi;
    ctx.globalAlpha = 0.35;
    const y = VIEW.GROUND_Y - 30 + i * 4;
    ctx.fillRect((Math.sin(tMs * 0.0008 + i) * 20 + 40) | 0, y, 90 + i * 14, 1);
    ctx.globalAlpha = 1;
  }
  // Salt flats: pale crusted pans along the far shore, the Narta salt pans.
  b.saltPans.forEach((s) => {
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = P.saltFlat;
    ctx.fillRect(s.x, s.y, s.w, s.h);
    ctx.globalAlpha = 1;
  });
  b.farFlamingos.forEach((f) => miniFlamingo(ctx, f.x, f.y, f.s, false, tMs));
  ctx.fillStyle = P.ground;
  ctx.fillRect(0, VIEW.GROUND_Y, VIEW.W, VIEW.H - VIEW.GROUND_Y);
  reeds(ctx, b.reeds);
  foreRank(ctx, b, tMs, 6, false);
}

function sazan(ctx, b, tMs) {
  sky(ctx);
  sun(ctx, 90, 54);
  ctx.fillStyle = P.pine;                            // island profile
  ctx.beginPath();
  ctx.moveTo(0, VIEW.GROUND_Y - 30);
  ctx.lineTo(120, VIEW.GROUND_Y - 78);
  ctx.lineTo(250, VIEW.GROUND_Y - 40);
  ctx.lineTo(VIEW.W, VIEW.GROUND_Y - 62);
  ctx.lineTo(VIEW.W, VIEW.GROUND_Y);
  ctx.lineTo(0, VIEW.GROUND_Y);
  ctx.fill();
  b.pines.forEach((p) => {                           // pines
    ctx.fillStyle = P.pineDark;
    ctx.beginPath();
    ctx.moveTo(p.x, VIEW.GROUND_Y - 2);
    ctx.lineTo(p.x - 5, VIEW.GROUND_Y - 2);
    ctx.lineTo(p.x - 2.5, VIEW.GROUND_Y - 2 - p.h);
    ctx.fill();
  });
  ctx.strokeStyle = P.crane;                         // construction crane
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(330, VIEW.GROUND_Y - 10);
  ctx.lineTo(330, VIEW.GROUND_Y - 90);
  ctx.lineTo(420, VIEW.GROUND_Y - 90);
  ctx.moveTo(330, VIEW.GROUND_Y - 78);
  ctx.lineTo(300, VIEW.GROUND_Y - 90);
  ctx.stroke();
  ctx.fillStyle = P.hoarding;                        // RESORT hoarding
  ctx.fillRect(270, VIEW.GROUND_Y - 26, 120, 26);
  ctx.save();
  ctx.fillStyle = P.resortText;
  ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('RESORT', 330, VIEW.GROUND_Y - 9);
  ctx.restore();
  ctx.fillStyle = P.ground;
  ctx.fillRect(0, VIEW.GROUND_Y, VIEW.W, VIEW.H - VIEW.GROUND_Y);
  reeds(ctx, b.reeds, 20);
  foreRank(ctx, b, tMs, 4, false);                     // a near-empty island: a handful, no more
}

function tirana(ctx, b, tMs) {
  const g = ctx.createLinearGradient(0, 0, 0, VIEW.GROUND_Y);
  g.addColorStop(0, P.nightTop);
  g.addColorStop(1, P.nightLow);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIEW.W, VIEW.GROUND_Y);
  b.stars.forEach((s) => {
    ctx.globalAlpha = s.a;
    ctx.fillStyle = P.star;
    ctx.fillRect(s.x | 0, s.y | 0, 1, 1);
    ctx.globalAlpha = 1;
  });
  ctx.fillStyle = P.skyline;                          // skyline blocks
  [[10, 60], [70, 84], [140, 50], [200, 96], [280, 68], [350, 110], [430, 56]].forEach(([x, h]) => {
    ctx.fillRect(x, VIEW.GROUND_Y - h, 46, h);
  });
  ctx.fillStyle = P.pyramid;                           // pyramid silhouette
  ctx.beginPath();
  ctx.moveTo(180, VIEW.GROUND_Y);
  ctx.lineTo(240, VIEW.GROUND_Y - 54);
  ctx.lineTo(300, VIEW.GROUND_Y);
  ctx.fill();
  for (let i = 0; i < 5; i += 1) {                    // smoke haze
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = P.smoke;
    const x = (i * 110 + tMs * 0.006) % (VIEW.W + 120) - 60;
    ctx.beginPath();
    ctx.ellipse(x, VIEW.GROUND_Y - 60, 50, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = P.ground;
  ctx.fillRect(0, VIEW.GROUND_Y, VIEW.W, VIEW.H - VIEW.GROUND_Y);
  protestCrowd(ctx, b, tMs, true);                     // the protest itself
  foreRank(ctx, b, tMs, 9, true);                      // the city square, so the densest rank
}

// ---------------------------------------------------------------------------
// The march on the capital: Sheshi Nënë Tereza -> the boulevard -> the Kuvendi.
// One route in three scenes, so they share a vocabulary — the same classical
// facade, the same boulevard trees, the same ministry block — at different
// distances along it.
// ---------------------------------------------------------------------------

/**
 * Bright afternoon over the square, distinct from the coast's sunset `sky()`. The cumulus
 * is what stops two hundred pixels of gradient reading as a painted wall. `b` is optional
 * only so a caller without a backdrop still gets the gradient; the cloud is baked in
 * createBackdrop, kept high and drawn at a fifth alpha, because this is the one piece of
 * scenery that sits inside the band the politicians fly through.
 */
function daySky(ctx, b) {
  const g = ctx.createLinearGradient(0, 0, 0, VIEW.GROUND_Y);
  g.addColorStop(0, P.daySkyTop);
  g.addColorStop(0.6, P.daySkyMid);
  g.addColorStop(1, P.daySkyLow);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIEW.W, VIEW.GROUND_Y);
  if (!b) return;
  ctx.save();
  ctx.globalAlpha = 0.2;
  ctx.fillStyle = P.star;                            // the whitest thing in the palette
  b.skyClouds.forEach((c) => {
    // Two lobes in one path: nonzero winding unions them, so a cloud costs one fill.
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, c.w, c.h, 0, 0, Math.PI * 2);
    ctx.ellipse(c.x - c.w * 0.55, c.y + c.h * 0.5, c.w * 0.5, c.h * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

/**
 * The hour after sunset on the boulevard: the sun has gone behind Dajti but the western
 * sky is still burning, and only the top of the dome is dark enough to hold stars yet.
 * A flat three-stop gradient reads as "night"; this has to read as a specific hour, so
 * the afterglow is placed to one side and the stars thin out as they approach it.
 */
function duskSky(ctx, b) {
  const g = ctx.createLinearGradient(0, 0, 0, VIEW.GROUND_Y);
  g.addColorStop(0, P.duskTop);
  g.addColorStop(0.55, P.duskMid);
  g.addColorStop(1, P.duskLow);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIEW.W, VIEW.GROUND_Y);
  ctx.save();
  ctx.globalAlpha = 0.3;                             // the afterglow, low and to the west
  ctx.fillStyle = P.duskGlow;
  ctx.beginPath();
  ctx.ellipse(104, VIEW.GROUND_Y - 40, 200, 44, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = P.star;
  b.stars.forEach((s) => {
    const fade = 1 - s.y / 62;                       // gone by the time they reach the glow
    if (fade <= 0) return;
    ctx.globalAlpha = s.a * fade * 0.85;
    ctx.fillRect(s.x | 0, s.y | 0, 1, 1);
  });
  // Cloud bars lit along their undersides. Light coming from below the cloud is the one
  // cue that says evening rather than morning, and it costs two rects.
  b.skyClouds.forEach((c, i) => {
    const y = c.y + 26 + i * 9;
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = P.duskCloud;
    ctx.beginPath();
    ctx.ellipse(c.x, y, c.w * 1.5, c.h * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = P.duskCloudLit;
    ctx.beginPath();
    ctx.ellipse(c.x + 3, y + c.h * 0.5, c.w * 1.25, c.h * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

/** Blend two #rrggbb colours. The march's sky rides this from afternoon to dusk. */
function mix(a, b, t) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const r = Math.round(((pa >> 16) & 255) * (1 - t) + ((pb >> 16) & 255) * t);
  const g = Math.round(((pa >> 8) & 255) * (1 - t) + ((pb >> 8) & 255) * t);
  const bl = Math.round((pa & 255) * (1 - t) + (pb & 255) * t);
  return `#${((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1)}`;
}

// One tile of the range, as (fraction across the span, px above GROUND_Y). Fixed rather
// than rolled, because the march scrolls this every frame and a random skyline would
// boil. The tallest peak is 56px above the ground line, which puts the whole horizon
// clear of FEEL.FLY_Y_MAX: no politician ever flies against a mountain.
const RIDGE_SPAN = 240;
const RIDGE_PROFILE = [[0, 34], [0.16, 52], [0.3, 42], [0.46, 56], [0.62, 40], [0.78, 50], [1, 34]];

function ridgeBand(ctx, off, tone, scale) {
  const x0 = -((off % RIDGE_SPAN) + RIDGE_SPAN) % RIDGE_SPAN;   // negative for any sign
  ctx.fillStyle = tone;
  ctx.beginPath();
  ctx.moveTo(x0 - RIDGE_SPAN, VIEW.GROUND_Y);
  for (let i = 0; i * RIDGE_SPAN + x0 <= VIEW.W; i += 1) {
    const x = x0 + i * RIDGE_SPAN;
    for (const [f, d] of RIDGE_PROFILE) ctx.lineTo(x + f * RIDGE_SPAN, VIEW.GROUND_Y - d * scale);
  }
  ctx.lineTo(VIEW.W + RIDGE_SPAN, VIEW.GROUND_Y);
  ctx.closePath();
  ctx.fill();
}

/**
 * Dajti behind the capital: a hazy far range with the near ridge cut in front of it, so
 * the horizon has depth instead of being one flat sawtooth. `off` scrolls both as the
 * slowest parallax layer, and the far one at a little over half the rate because it is
 * genuinely further away. The tones are arguments so the same mountain can be an
 * afternoon blue-grey over the square and a near-black cut-out at dusk.
 */
function ridge(ctx, off = 0, near = P.ridge, far = P.ridgeFar) {
  ridgeBand(ctx, off * 0.55 + 96, far, 1.16);
  ridgeBand(ctx, off, near, 1);
}

/**
 * A row of windows. The lit/dark pattern is a deterministic function of position, not
 * Math.random(): this runs every frame, and a random one would make the whole city
 * flicker.
 */
function windowRow(ctx, x, y, count, gap, w, h, night) {
  for (let i = 0; i < count; i += 1) {
    ctx.fillStyle = night && (i * 7 + y) % 3 === 0 ? P.windowLit : P.windowDark;
    ctx.fillRect(Math.round(x + i * gap), Math.round(y), w, h);
  }
}

/**
 * The facade the Polytechnic on Sheshi Nënë Tereza and the Kuvendi share: low wings,
 * a colonnade under a pediment, and a flight of steps. It is one drawing with knobs
 * rather than two near-identical ones — they really are the same architecture at two
 * sizes, and the repeat is what makes the boulevard read as one place.
 */
function classicalFacade(ctx, cx, baseY, w, h, cols, opts = {}) {
  const { night = false } = opts;
  const left = Math.round(cx - w / 2);
  const top = Math.round(baseY - h);
  const wingW = Math.round(w * 0.4);
  const wingH = Math.round(h * 0.58);

  // Wings first, so the portico reads as standing proud of them.
  ctx.fillStyle = P.facadeShade;
  ctx.fillRect(left - wingW, baseY - wingH, wingW, wingH);
  ctx.fillRect(left + w, baseY - wingH, wingW, wingH);
  const wingCols = Math.max(2, (wingW / 13) | 0);
  windowRow(ctx, left - wingW + 4, baseY - wingH + 7, wingCols, 13, 4, 6, night);
  windowRow(ctx, left + w + 4, baseY - wingH + 7, wingCols, 13, 4, 6, night);

  ctx.fillStyle = P.facade;
  ctx.fillRect(left, top, w, h);
  ctx.fillStyle = P.facadeLit;                       // sunlit band along the top
  ctx.fillRect(left, top, w, 3);

  const pedH = Math.round(h * 0.2);
  ctx.fillStyle = P.pediment;
  ctx.beginPath();
  ctx.moveTo(left - 3, top);
  ctx.lineTo(cx, top - pedH);
  ctx.lineTo(left + w + 3, top);
  ctx.closePath();
  ctx.fill();

  const colTop = top + Math.round(h * 0.2);
  const colH = baseY - colTop - 5;
  const gap = (w - 8) / cols;
  const colW = Math.max(2, Math.round(gap * 0.46));
  for (let i = 0; i < cols; i += 1) {
    const x = Math.round(left + 4 + i * gap + (gap - colW) / 2);
    ctx.fillStyle = P.column;
    ctx.fillRect(x, colTop, colW, colH);
    ctx.fillStyle = P.columnShade;                   // one shaded edge gives them round
    ctx.fillRect(x + colW - 1, colTop, 1, colH);
  }
  ctx.fillStyle = P.pediment;                        // architrave over the columns
  ctx.fillRect(left, colTop - 3, w, 3);

  ctx.fillStyle = P.steps;
  for (let i = 0; i < 3; i += 1) {
    ctx.fillRect(left - 6 - i * 3, baseY - 6 + i * 2, w + 12 + i * 6, 2);
  }

}

/** The national flag over the Kuvendi, using the crowd's own eagle shorthand. */
function flagpole(ctx, x, topY, tMs) {
  const poleH = 20;
  const y = topY - poleH;
  ctx.fillStyle = P.placardPole;
  ctx.fillRect(Math.round(x), y, 1, poleH);
  const wave = Math.round(Math.sin(tMs * 0.003) * 1.5);
  const fx = Math.round(x) + 1;
  ctx.fillStyle = P.flag;
  ctx.beginPath();
  ctx.moveTo(fx, y + 1);
  ctx.lineTo(fx + 14, y + 1 + wave);
  ctx.lineTo(fx + 14, y + 9 + wave);
  ctx.lineTo(fx, y + 9);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = P.flagEagle;
  const ey = y + 3 + (wave >> 1);
  ctx.fillRect(fx + 6, ey, 2, 4);
  ctx.fillRect(fx + 5, ey - 1, 1, 1);
  ctx.fillRect(fx + 8, ey - 1, 1, 1);
}

/** A plane tree on the boulevard. Capped short of the flight band by its callers. */
function boulevardTree(ctx, x, baseY, h) {
  const cx = Math.round(x);
  const trunkH = Math.round(h * 0.45);
  ctx.fillStyle = P.treeTrunk;
  ctx.fillRect(cx - 1, baseY - trunkH, 3, trunkH);
  const cy = baseY - h + Math.round(h * 0.28);
  const r = Math.round(h * 0.3);
  ctx.fillStyle = P.treeCanopyDark;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = P.treeCanopy;                      // light catching one shoulder
  ctx.beginPath();
  ctx.arc(cx - r * 0.3, cy - r * 0.3, r * 0.72, 0, Math.PI * 2);
  ctx.fill();
}

/** An ochre ministry block: two rows of windows over a ground-floor arcade. */
function ministryBlock(ctx, x, baseY, w, h, night) {
  const left = Math.round(x);
  ctx.fillStyle = P.facadeShade;
  ctx.fillRect(left, baseY - h, w, h);
  ctx.fillStyle = P.facade;
  ctx.fillRect(left, baseY - h, w, 3);
  const cols = Math.max(2, (w / 14) | 0);
  windowRow(ctx, left + 5, baseY - h + 10, cols, 14, 5, 7, night);
  windowRow(ctx, left + 5, baseY - h + 24, cols, 14, 5, 7, night);
  ctx.fillStyle = P.windowDark;                      // arcade
  for (let i = 0; i < Math.max(2, (w / 16) | 0); i += 1) {
    const ax = left + 6 + i * 16;
    ctx.beginPath();
    ctx.arc(ax + 4, baseY - 12, 4, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(ax, baseY - 12, 8, 12);
  }
}

/**
 * The Skanderbeg monument. Two details do all the recognising at this size — the
 * goat-head helmet and the sword held high — so both are drawn as large as the silhouette
 * will bear, and everything else is just enough horse to read as equestrian. `face` is +1
 * for a rider looking right and -1 for left; always point him into the square rather than
 * out of frame.
 *
 * The design is laid out in units above the base of the plinth and multiplied by `s`, so
 * the whole monument can be moved further up the square by shrinking it. The tallest
 * solid part is the helmet at 62 units: at s = 1 standing on the near paving that lands
 * it below FEEL.FLY_Y_MAX, and the only thing above the flight band is a one-pixel blade.
 */
function skanderbeg(ctx, x, baseY, s = 1, face = 1) {
  const px = (n) => Math.round(x + face * n * s);
  const py = (n) => Math.round(baseY - n * s);
  // A bar centred on `c`, standing on height `b`, `w` wide and `h` tall, in design units.
  const bar = (c, b, w, h) => {
    const ww = Math.max(1, Math.round(w * s));
    ctx.fillRect(px(c) - (ww >> 1), py(b + h), ww, Math.max(1, py(b) - py(b + h)));
  };
  const poly = (pts) => {
    ctx.beginPath();
    ctx.moveTo(px(pts[0][0]), py(pts[0][1]));
    for (let i = 1; i < pts.length; i += 1) ctx.lineTo(px(pts[i][0]), py(pts[i][1]));
    ctx.closePath();
    ctx.fill();
  };

  // Three tones do the separating, because at this size shape alone will not: the plinth
  // is stone, the horse is the mid bronze, and the rider is a step lighter so he reads as
  // a figure sitting on an animal rather than as more of the same silhouette.
  ctx.fillStyle = P.statuePlinthShade;
  bar(0, 0, 26, 3);                                  // base slab
  bar(0, 25, 22, 1);                                 // shadow under the cornice
  ctx.fillStyle = P.statuePlinth;
  bar(0, 3, 18, 22);
  bar(0, 26, 22, 2);                                 // cornice
  ctx.fillStyle = P.statueShade;                     // the return face, away from the sun
  bar(5, 3, 4, 22);

  // Horse, in profile and mid-stride. Legs first and long — ten units of leg with daylight
  // between them is what makes the animal read; six-unit stubs just weld the barrel to the
  // plinth. The off pair goes down in the darkest tone in the set, not the middle one, so
  // all four legs stay separate even where the background is the same value as the bronze.
  ctx.fillStyle = P.statuePlinthShade;
  bar(4, 28, 2, 10);
  bar(-8, 28, 2, 10);
  ctx.fillStyle = P.statue;
  bar(7.5, 28, 2.5, 10);
  bar(-5.5, 28, 2.5, 10);
  ctx.beginPath();                                   // barrel
  ctx.ellipse(px(0), py(42), 10.5 * s, 4.5 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  poly([[6, 38], [10.5, 40], [10, 45], [6, 45]]);    // chest, carried forward of the barrel
  poly([[6.5, 44], [9.5, 43], [14.5, 52], [12, 53]]);  // neck, a narrow bar on the diagonal
  poly([[11.5, 53], [15, 52], [18, 48.5], [15.5, 47], [12, 49]]);  // head, muzzle forward
  poly([[-9, 45], [-14, 33], [-11.5, 32], [-7, 44]]);  // tail
  ctx.fillStyle = P.statuePlinthShade;
  bar(0, 37, 20, 1);                                 // shadow along the barrel's belly
  bar(-0.5, 45.5, 9, 1);                             // saddle: the rider has to sit ON something

  // Rider. Two things stop him reading as a post on a horse: the gap between his back and
  // the horse's neck, so nothing at all is drawn between units 3 and 6, and the dark
  // collar band under the head, which is what turns one column into a body and a head.
  ctx.fillStyle = P.statueShade;
  poly([[-1.5, 56], [-5.5, 46], [-3, 45], [-0.5, 55]]);  // cloak, a dark edge behind him
  bar(2.5, 38, 2.5, 9);                              // near leg down the flank
  ctx.fillStyle = P.statueLit;
  poly([[-3, 54.5], [2.5, 54.5], [2, 45.5], [-2, 45.5]]);  // torso, shoulders down to saddle
  poly([[1, 53.5], [2.5, 52.5], [6.5, 58.5], [5, 59.5]]);  // sword arm, raised
  ctx.fillStyle = P.statuePlinthShade;
  bar(0, 54.5, 3.5, 1);                              // collar
  ctx.fillStyle = P.statueLit;
  bar(0, 55.5, 2.5, 2.5);                            // head

  // The goat's head: a domed skull, a muzzle pushed forward and two horns sweeping back
  // over his shoulders. Four pixels of helmet, but the horns are the whole tell, and they
  // are strokes rather than fills so they stay one pixel wide at any scale.
  bar(0, 58, 4.5, 2.5);
  bar(2.5, 58.5, 2.5, 1.5);
  ctx.strokeStyle = P.statueLit;
  ctx.lineWidth = Math.max(1, s);
  ctx.beginPath();
  ctx.moveTo(px(-0.5), py(60.5));
  ctx.quadraticCurveTo(px(-3.5), py(64), px(-6), py(62.5));
  ctx.moveTo(px(1.5), py(61));
  ctx.quadraticCurveTo(px(-1.5), py(64.5), px(-4), py(63.5));
  ctx.stroke();

  // The sword. Held high and clear of everything else, which is exactly how it reads at a
  // glance and exactly why a blade is allowed above the flight band when nothing else is.
  poly([[3.6, 59.4], [7, 58], [7.4, 59], [4, 60.4]]);        // crossguard
  poly([[4.8, 59], [6.4, 58.4], [11.4, 74.4], [10.2, 75]]);  // blade
}

/**
 * The steel crowd-control line across the boulevard. Every fourth panel is a pixel out of
 * true and the whole run casts one shadow: a perfectly even fence reads as a texture, and
 * this has to read as objects somebody carried out and a crowd has been leaning on.
 */
function barrierLine(ctx, y) {
  ctx.save();
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = P.groundShadow;
  ctx.fillRect(0, y, VIEW.W, 2);
  ctx.restore();
  ctx.fillStyle = P.barrierPost;                     // the feet, one rect for the whole run
  ctx.fillRect(0, y - 1, VIEW.W, 1);
  for (let x = -10; x < VIEW.W + 10; x += 26) {
    const lean = ((x + 10) / 26) % 4 === 0 ? 1 : 0;
    ctx.fillStyle = P.barrierPost;
    ctx.fillRect(x, y - 11 - lean, 2, 11 + lean);
    ctx.fillRect(x + 20, y - 11 - lean, 2, 11 + lean);
    ctx.fillStyle = P.barrier;
    ctx.fillRect(x, y - 10 - lean, 22, 2);
    ctx.fillRect(x, y - 6 - lean, 22, 1);
  }
}

/**
 * The ground plane the two square scenes stand on, drawn as a plane rather than a wall.
 * Courses spread as they come toward the camera and the joints converge on a vanishing
 * point at the far kerb, so the fifty pixels below the buildings read as a square you
 * could walk across. `farY` is where the paving meets the buildings — everything that
 * stands on the square is drawn after this and lower down it.
 */
function paving(ctx, farY, tone, lineTone, kerbTone) {
  ctx.fillStyle = tone;
  ctx.fillRect(0, farY, VIEW.W, VIEW.H - farY);
  ctx.fillStyle = kerbTone;                          // the far kerb, catching the sky
  ctx.fillRect(0, farY, VIEW.W, 2);
  ctx.fillStyle = lineTone;
  // Course spacing widens toward the camera; the numbers are a perspective run, not a
  // constant step, and that is the whole reason the strip reads as receding.
  for (const d of [5, 12, 21, 33, 48]) ctx.fillRect(0, farY + d, VIEW.W, 1);
  ctx.strokeStyle = lineTone;
  ctx.lineWidth = 1;
  ctx.beginPath();                                   // one path for all seven joints
  for (let i = -3; i <= 3; i += 1) {
    ctx.moveTo(VIEW.W / 2 + i * 30, farY);
    ctx.lineTo(VIEW.W / 2 + i * 104, VIEW.H);
  }
  ctx.stroke();
}

// The city beyond whichever square you are standing in. Most of this is hidden behind the
// buildings that close the square; the point is the slivers that show between them, which
// is the difference between a square you can see past and a painted backdrop.
const FAR_BLOCKS = [[-4, 40, 26], [40, 30, 34], [76, 46, 22], [126, 34, 30], [166, 54, 18],
  [226, 38, 28], [270, 44, 20], [320, 32, 32], [358, 48, 24], [412, 36, 30], [454, 34, 20]];

function farBlocks(ctx, baseY, night) {
  ctx.fillStyle = night ? P.skyline : P.farCity;
  FAR_BLOCKS.forEach(([x, w, h]) => ctx.fillRect(x, baseY - h, w, h));
  if (!night) return;
  FAR_BLOCKS.forEach(([x, w, h]) => windowRow(ctx, x + 5, baseY - h + 6, 2, 13, 2, 3, true));
}

/**
 * The blocks that close the sides of Sheshi Nënë Tereza — the Archaeological Museum to the
 * west, the science faculties to the east. Hazed one step back from the building in the
 * middle on purpose: that is what puts the Polytechnic in front of them rather than beside
 * them, and it is cheaper than any amount of extra detail.
 */
function squareWing(ctx, x, baseY, w, h, night) {
  const left = Math.round(x);
  const bays = Math.max(2, (w / 17) | 0);
  ctx.fillStyle = P.facadeFar;
  ctx.fillRect(left, baseY - h, w, h);
  ctx.fillStyle = P.facade;                          // cornice catching the afternoon
  ctx.fillRect(left, baseY - h, w, 3);
  windowRow(ctx, left + 7, baseY - h + 9, bays, 17, 5, 8, night);
  ctx.fillStyle = P.columnShade;                     // a pilastered ground floor
  for (let i = 0; i < bays; i += 1) ctx.fillRect(left + 6 + i * 17, baseY - h + 23, 3, h - 26);
  ctx.fillStyle = P.steps;
  ctx.fillRect(left, baseY - 3, w, 3);
}

/**
 * A square lamp: post, cross arm, two heads. Verticals like this are the cheapest way to
 * give a square height, and at two pixels wide they cannot hide anything. `lit` is for the
 * dusk scene, where the glow is doing more work than the lamp is.
 */
function squareLamp(ctx, x, baseY, h, lit) {
  const cx = Math.round(x);
  ctx.fillStyle = P.lampPost;
  ctx.fillRect(cx, baseY - h, 2, h);
  ctx.fillRect(cx - 3, baseY - 2, 8, 2);
  ctx.fillRect(cx - 4, baseY - h, 10, 2);
  ctx.fillStyle = lit ? P.lampGlow : P.barrier;
  ctx.fillRect(cx - 4, baseY - h + 2, 3, 2);
  ctx.fillRect(cx + 3, baseY - h + 2, 3, 2);
  if (!lit) return;
  ctx.save();
  ctx.globalAlpha = 0.2;
  ctx.fillStyle = P.lampGlow;
  ctx.beginPath();
  ctx.arc(cx + 1, baseY - h + 3, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 0.12;                            // and the pool it throws on the ground
  ctx.beginPath();
  ctx.ellipse(cx + 1, baseY, 16, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * Floodlights washing up the Kuvendi's front. Two faint splayed quads rather than a
 * gradient: it costs eight ops and it is the whole difference between a building at dusk
 * and a building cut out of card.
 */
function floodlights(ctx, cx, baseY, footY) {
  ctx.save();
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = P.floodlight;
  [-70, 70].forEach((d) => {
    ctx.beginPath();
    ctx.moveTo(cx + d - 7, footY);
    ctx.lineTo(cx + d + 7, footY);
    ctx.lineTo(cx + d + 36, baseY - 46);
    ctx.lineTo(cx + d - 36, baseY - 46);
    ctx.closePath();
    ctx.fill();
  });
  ctx.restore();
}

/**
 * The Kuvendi i Shqipërisë on Bulevardi Dëshmorët e Kombit — deliberately NOT the
 * Polytechnic's temple front. The real building is a modest 1920s club: two low storeys
 * of cream render under a shallow tiled roof, articulated with FLAT pilasters, capitals
 * and cornices rather than a free-standing colonnade, with a small four-column porch over
 * the door and a paved forecourt in front. Low and wide is the entire character — it is a
 * building you walk up to, not one you look up at — so the wings are only 34px tall and
 * the porch clears them by twelve. Nothing here reaches the flight band; the flagpoles are
 * the only thing that gets near it, and they are one pixel wide.
 */
function kuvendiFacade(ctx, cx, baseY, w, opts = {}) {
  const { night = false, tMs = 0 } = opts;
  const wingH = 34;
  const left = Math.round(cx - w / 2);
  const top = Math.round(baseY - wingH);
  const bays = Math.max(4, Math.round(w / 19));
  const bayW = w / bays;

  ctx.fillStyle = P.facade;
  ctx.fillRect(left, top, w, wingH);
  ctx.fillStyle = P.facadeShade;                     // plinth course, the full length
  ctx.fillRect(left, baseY - 6, w, 6);
  for (let i = 0; i <= bays; i += 1) {               // pilasters and their capitals
    const x = Math.round(left + i * bayW);
    ctx.fillStyle = P.columnShade;
    ctx.fillRect(x - 1, top + 5, 3, wingH - 11);
    ctx.fillStyle = P.facadeLit;
    ctx.fillRect(x - 2, top + 4, 5, 2);
  }
  for (let i = 0; i < bays; i += 1) {                // two storeys of tall windows
    const x = Math.round(left + i * bayW + bayW / 2) - 2;
    ctx.fillStyle = night && (i * 5) % 3 === 0 ? P.windowLit : P.windowDark;
    ctx.fillRect(x, top + 9, 4, 9);
    ctx.fillStyle = night && (i * 5 + 2) % 3 === 0 ? P.windowLit : P.windowDark;
    ctx.fillRect(x, top + 21, 4, 6);
  }
  ctx.fillStyle = P.pediment;                        // main cornice, projecting either side
  ctx.fillRect(left - 3, top - 3, w + 6, 4);
  // A shallow hipped roof of terracotta pantiles. This is the single detail that stops the
  // building reading as one more marble portico, so it gets its own two tones.
  ctx.fillStyle = P.roofTile;
  ctx.beginPath();
  ctx.moveTo(left - 4, top - 3);
  ctx.lineTo(left + 30, top - 11);
  ctx.lineTo(left + w - 30, top - 11);
  ctx.lineTo(left + w + 4, top - 3);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = P.roofTileShade;
  ctx.fillRect(left + 30, top - 11, w - 60, 1);

  // The entrance bay: proud of the wings by a storey, and no more than that.
  const pw = Math.round(w * 0.3);
  const pl = Math.round(cx - pw / 2);
  const pTop = top - 12;
  const colH = baseY - pTop - 18;
  ctx.fillStyle = P.facadeLit;
  ctx.fillRect(pl, pTop, pw, baseY - pTop);
  ctx.fillStyle = P.windowDark;                      // recessed loggia, so the piers read free
  ctx.fillRect(pl + 4, pTop + 12, pw - 8, colH);
  const cols = 4;
  const gap = (pw - 8) / cols;
  for (let i = 0; i < cols; i += 1) {
    const x = Math.round(pl + 4 + i * gap + (gap - 4) / 2);
    ctx.fillStyle = P.column;
    ctx.fillRect(x, pTop + 12, 4, colH);
    ctx.fillStyle = P.columnShade;
    ctx.fillRect(x + 3, pTop + 12, 1, colH);
  }
  // The lit doorway is the warm centre the whole dusk scene needs; at night it is also
  // the only thing stopping the loggia behind the piers reading as a hole cut in the sky.
  ctx.fillStyle = night ? P.windowLit : P.windowDark;
  ctx.fillRect(Math.round(cx) - 8, baseY - 20, 16, 14);
  if (night) {
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = P.floodlight;
    ctx.fillRect(Math.round(cx) - 16, baseY - 6, 32, 8);   // light spilling down the steps
    ctx.restore();
  }
  ctx.fillStyle = P.pediment;                        // entablature over the porch
  ctx.fillRect(pl - 2, pTop + 8, pw + 4, 4);
  ctx.fillStyle = P.facade;                          // and a low gable, not a temple front
  ctx.beginPath();
  ctx.moveTo(pl - 4, pTop + 8);
  ctx.lineTo(cx, pTop - 2);
  ctx.lineTo(pl + pw + 4, pTop + 8);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = P.facadeLit;
  ctx.fillRect(pl - 4, pTop + 7, pw + 8, 1);

  ctx.fillStyle = P.steps;                           // steps down onto the forecourt
  for (let i = 0; i < 3; i += 1) {
    ctx.fillRect(pl - 8 - i * 6, baseY - 1 + i * 2, pw + 16 + i * 12, 2);
  }

  // The flags stand in the forecourt on real poles rather than on the roof, which is where
  // they actually are and which keeps a red rectangle out of the sky over the building.
  ctx.fillStyle = P.placardPole;
  [cx - 84, cx + 84].forEach((fx) => {
    ctx.fillRect(Math.round(fx), baseY - 32, 1, 40);
    flagpole(ctx, fx, baseY - 32, tMs);
  });
}

/** The far rank of the protest, painted far-to-near from the pre-sorted list. */
function protestCrowd(ctx, b, tMs, night, walk = 0, stridePhase = 0) {
  b.crowd.forEach((c) => {
    const r = CROWD_RANKS[c.rank];
    // No per-rank stride multiplier: the stride is a fraction of drawn height, and the
    // ranks already scale that, so the near rank throws the longer leg for free.
    protesterSilhouette(ctx, c, tMs, VIEW.GROUND_Y + r.dy, r.s, r.tone, night, walk, stridePhase);
  });
}

// The far side of the square: where the paving meets the buildings. Everything that
// closes the square stands on this line and everything standing IN the square is drawn
// after it and lower down, which is the whole depth cue — the old scene put the buildings
// and the people on the same line and read as one flat wall of stuff.
const SQUARE_FAR_Y = VIEW.GROUND_Y - 10;

function sheshi(ctx, b, tMs) {
  daySky(ctx, b);
  sun(ctx, 52, 38);
  ridge(ctx);
  farBlocks(ctx, SQUARE_FAR_Y - 4, false);
  paving(ctx, SQUARE_FAR_Y, P.paving, P.pavingLine, P.pavingLight);
  // The square is closed on three sides: the Archaeological Museum west, the science
  // faculties east, and the Polytechnic's colonnade shutting the south end. The colonnade
  // is what identifies the place, so it keeps the middle and the flanks stay hazed back.
  // The west block stops short of the monument's slot on purpose. Pale bronze in front of
  // a pale wall is one shape; the gap puts mountain and distant city behind Skanderbeg
  // instead, and a square with a street running out of one corner is a real square.
  squareWing(ctx, -10, SQUARE_FAR_Y, 88, 38, false);
  squareWing(ctx, 362, SQUARE_FAR_Y, 126, 40, false);
  classicalFacade(ctx, 240, SQUARE_FAR_Y, 140, 46, 8);
  squareLamp(ctx, 128, VIEW.GROUND_Y + 2, 44, false);
  squareLamp(ctx, 352, VIEW.GROUND_Y + 2, 44, false);
  b.squareTrees.forEach((t) => boulevardTree(ctx, t.x, VIEW.GROUND_Y + 2 + t.dy, t.h));
  // Skanderbeg, off to the west side of the square. He is placed here rather than in the
  // middle for three reasons: he must not stand in front of the colonnade that says which
  // square this is, he must not sit under the crosshair's resting ground, and a monument
  // seen from three-quarters on is a monument rather than a diagram. Facing right turns
  // him into the square instead of out of frame.
  skanderbeg(ctx, 96, VIEW.GROUND_Y + 4, 1, 1);
  protestCrowd(ctx, b, tMs, false);
  foreRank(ctx, b, tMs, 10, false);
}

// World px between the square and the parliament steps. The landmarks below are
// placed along this line; `progress` 0..1 walks it.
//
// Down from 1600 now that the crowd genuinely walks rather than being slid along. A
// march round runs about 10s played perfectly and about 20s if every politician is left
// to escape, and 1600px inside that dragged the tarmac under the marchers at up to
// 170px/s — no stride a 20px silhouette can throw keeps up with that, so the ground
// outran the feet and the whole scene skated. 900 is still nearly two frames of city,
// and it is the number MARCH_STRIDE_SPAN below is tuned against.
const MARCH_SPAN = 900;

// Parallax rates. The ridge is a mountain. The trees are close enough to overtake the
// facades, but only just: 1.3 sent them past faster than anybody could have walked.
// MARCH_GROUND_RATE is the tarmac the marchers are standing on — the road markings and
// the stride clock both read it, so those two can never drift apart.
const MARCH_RIDGE_RATE = 0.15;
const MARCH_TREE_RATE = 1.12;
const MARCH_GROUND_RATE = 1;

// Ground px per full stride cycle, plus an idle rate in radians per ms. Driving the
// stride off distance rather than off the clock is what keeps the feet honest: a round
// raced through scrolls fast and steps fast, a round dawdled over does both slowly, and
// neither skates. At 900px over a typical 14s round that lands near 1.8 cycles a second
// — a quick march, which is what this crowd is doing. The idle term is the only part
// that is time-based, and it exists so the crowd is not frozen mid-step during the round
// intro at progress 0, or once it has arrived at 1.
const MARCH_STRIDE_SPAN = 40;
const MARCH_STRIDE_IDLE = 0.0015;

// The near rank stands a whole rank closer than the crowd behind it, and closer things
// read as moving faster, so it throws a longer leg.
const MARCH_FORE_STRIDE = 1.25;

// The route, in world coordinates. The Polytechnic is behind you almost at once; the
// Kuvendi lands dead centre at progress 1 (1140 - MARCH_SPAN = 240 = VIEW.W / 2), so
// its `world` and MARCH_SPAN have to move together.
const MARCH_LANDMARKS = [
  { world: 120, draw: (ctx, x, night) => classicalFacade(ctx, x, VIEW.GROUND_Y, 130, 50, 7, { night }) },
  { world: 420, draw: (ctx, x, night) => ministryBlock(ctx, x - 70, VIEW.GROUND_Y, 140, 56, night) },
  { world: 680, draw: (ctx, x, night) => ministryBlock(ctx, x - 60, VIEW.GROUND_Y, 120, 48, night) },
  // Sits just off the left edge when the march arrives, clear of the Kuvendi's wing.
  { world: 880, draw: (ctx, x, night) => ministryBlock(ctx, x - 75, VIEW.GROUND_Y, 150, 60, night) },
  // Called directly rather than through classicalFacade: the march has to arrive at the
  // same building the very next round opens on, and the Kuvendi is not a temple front.
  { world: 1140, draw: (ctx, x, night, tMs) => kuvendiFacade(ctx, x, VIEW.GROUND_Y, 160, { night, tMs }) }
];

/**
 * The boulevard between the two. `progress` (0..1) is how far through the round the
 * player is, so the city slides past as the round is played: the Polytechnic leaves
 * to the left, ministries pass, and the Kuvendi arrives. The crowd deliberately does
 * NOT scroll — the player is marching with it, so it is the city that moves — but it
 * does walk on the spot, which is the only reason any of this reads as a march rather
 * than as a photograph of a crowd being panned across a photograph of a city.
 */
function march(ctx, b, tMs, progress) {
  const p = Math.max(0, Math.min(1, progress));
  const worldX = p * MARCH_SPAN;
  // The sky carries the journey too: an afternoon that has become dusk by the time
  // the parliament is in sight, which is what the next scene opens on.
  const g = ctx.createLinearGradient(0, 0, 0, VIEW.GROUND_Y);
  g.addColorStop(0, mix(P.daySkyTop, P.duskTop, p));
  g.addColorStop(0.55, mix(P.daySkyMid, P.duskMid, p));
  g.addColorStop(1, mix(P.daySkyLow, P.duskLow, p));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIEW.W, VIEW.GROUND_Y);

  ridge(ctx, worldX * MARCH_RIDGE_RATE);

  const night = p > 0.55;
  MARCH_LANDMARKS.forEach((l) => {
    const x = l.world - worldX;
    if (x < -280 || x > VIEW.W + 280) return;        // cull: most of the route is off-frame
    l.draw(ctx, x, night, tMs);
  });

  const step = 132;
  const treeOff = ((worldX * MARCH_TREE_RATE) % step + step) % step;
  for (let i = -1; i * step - treeOff < VIEW.W + step; i += 1) {
    boulevardTree(ctx, i * step - treeOff + 40, VIEW.GROUND_Y + 2, 52);
  }

  ctx.fillStyle = P.asphalt;
  ctx.fillRect(0, VIEW.GROUND_Y, VIEW.W, VIEW.H - VIEW.GROUND_Y);
  // The centre line sliding under the marchers reads as the ground they are walking
  // over, so it can no longer have a rate of its own: at the old 1.5 it outran the
  // stride by half again and the crowd looked like it was on a travelator.
  const groundX = worldX * MARCH_GROUND_RATE;
  ctx.fillStyle = P.asphaltLine;
  const dashOff = ((groundX % 40) + 40) % 40;
  for (let i = -1; i * 40 - dashOff < VIEW.W; i += 1) {
    ctx.fillRect(i * 40 - dashOff, VIEW.GROUND_Y + 15, 20, 2);
  }

  // One stride per MARCH_STRIDE_SPAN of that same tarmac, so the legs are driven by the
  // road rather than by the clock and the two cannot disagree at any playing speed.
  const stridePhase = (groundX / MARCH_STRIDE_SPAN) * Math.PI * 2 + tMs * MARCH_STRIDE_IDLE;
  protestCrowd(ctx, b, tMs, night, 1, stridePhase);
  foreRank(ctx, b, tMs, 12, night, MARCH_FORE_STRIDE, stridePhase);
}

// Where the Kuvendi's forecourt gives out onto the boulevard. The barrier stands on this
// kerb, which is the arrangement the whole scene turns on: paved apron and floodlights
// behind the line, tarmac and the march in front of it.
const KUVENDI_KERB_Y = VIEW.GROUND_Y + 6;

function parlamenti(ctx, b, tMs) {
  duskSky(ctx, b);
  ridge(ctx, 0, P.ridgeDusk, P.ridge);
  farBlocks(ctx, SQUARE_FAR_Y - 4, true);            // the city behind, its lights coming on
  paving(ctx, SQUARE_FAR_Y, P.paving, P.pavingLine, P.kerb);
  ctx.fillStyle = P.asphalt;                         // the boulevard, past the forecourt kerb
  ctx.fillRect(0, KUVENDI_KERB_Y, VIEW.W, VIEW.H - KUVENDI_KERB_Y);
  ctx.fillStyle = P.kerb;
  ctx.fillRect(0, KUVENDI_KERB_Y, VIEW.W, 2);
  ctx.fillStyle = P.asphaltLine;
  ctx.fillRect(0, KUVENDI_KERB_Y + 18, VIEW.W, 1);
  // Government blocks either side, the Kuvendi itself between them. It is the lowest and
  // plainest thing on this boulevard and that is the point: the modest building is the
  // one the whole march has been walking toward.
  ministryBlock(ctx, -12, SQUARE_FAR_Y, 120, 44, true);
  ministryBlock(ctx, 372, SQUARE_FAR_Y, 120, 40, true);
  kuvendiFacade(ctx, 240, SQUARE_FAR_Y, 236, { night: true, tMs });
  b.squareTrees.forEach((t) => boulevardTree(ctx, t.x, SQUARE_FAR_Y + 6 + t.dy, t.h * 0.9));
  floodlights(ctx, 240, SQUARE_FAR_Y, KUVENDI_KERB_Y - 2);
  // The lamps stand in the gaps between the Kuvendi and its neighbours, which is the only
  // place on this frontage where a warm glow has dark sky behind it to register against.
  squareLamp(ctx, 114, KUVENDI_KERB_Y - 2, 44, true);
  squareLamp(ctx, 366, KUVENDI_KERB_Y - 2, 44, true);
  // The barrier goes between the two ranks rather than in front of both: the protest is
  // pressed up against the line, and the near rank — the player among them — is this side
  // of it. Drawing it before the crowd put the whole march on the parliament's lawn.
  protestCrowd(ctx, b, tMs, true);
  barrierLine(ctx, KUVENDI_KERB_Y + 2);
  foreRank(ctx, b, tMs, 12, true);                   // the whole march, arrived
}

// Order is the story: the coast, the island, then the square, the march and the
// parliament, and Tirana at night as the last word — the whole city out after the
// boulevard has been walked. sheshi -> march -> parlamenti must stay contiguous and
// in that order: the middle scene is literally the journey between its neighbours.
// backdropForRound reads the length, so adding a scene here is the only edit needed
// to put it in the rotation.
const SCENES = [lagoon, sazan, sheshi, march, parlamenti, tirana];

/** Which scene round `round` is played against. Cycles once past the last one. */
export function backdropForRound(round) {
  return (round - 1) % SCENES.length;
}

export function drawBackground(ctx, backdrop, index, tMs, progress = 0) {
  SCENES[index % SCENES.length](ctx, backdrop, tMs, progress);
  // Decorative gliding flamingos, drawn over every scene. Cosmetic only.
  backdrop.glideFlamingos.forEach((f) => {
    const x = (f.x0 + tMs * f.sp) % (VIEW.W + 40) - 20;
    miniFlamingo(ctx, x, f.y + Math.sin(tMs * 0.002 + f.x0) * 3, f.s, true, tMs);
  });
}
