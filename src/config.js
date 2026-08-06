// Every tunable value and every player-facing string lives here.
// No imports: this module is pure data so tests can load it in Node.

export const VIEW = { W: 480, H: 272, GROUND_Y: 218, SCALE: 2, HUD_BAR_H: 18 };

export const PALETTE = {
  skyTop: '#2b1b4a',
  skyMid: '#c8477a',
  skyLow: '#ff9e6d',
  sun: '#ffe9a8',
  water: '#7d3f6b',
  waterHi: '#a95c85',
  saltFlat: '#e8dcc8',
  reed: '#2f4132',
  reedLight: '#48603f',
  ground: '#3b2b3a',
  pine: '#1f3a2e',
  pineDark: '#16291f',
  resortText: '#8d2f3a',
  nightTop: '#150f24',
  nightLow: '#4a2b50',
  star: '#fdf6e3',
  skyline: '#1c1430',
  pyramid: '#241a3d',
  crane: '#e8b13a',
  hoarding: '#d9d2c4',
  crowd: '#241a2e',
  crowdFar: '#3a2b4e',
  crowdNear: '#150e1c',
  flag: '#c8202e',
  flagShade: '#8f1620',
  flagEagle: '#1a0b10',
  phoneGlow: '#ffeeb0',
  flare: '#ff7a33',
  smoke: '#5a4a63',
  flamingo: '#ff8fb8',
  flamingoDark: '#e0648f',
  flamingoBeak: '#2b1b2a',
  suitDark: '#1d2433',
  suitNavy: '#243356',
  shirt: '#f2efe6',
  skin: '#e0a878',
  skinShade: '#c78a5c',
  hairWhite: '#eae6dc',
  hairDark: '#2a2320',
  tie: '#38507e',
  glassesRed: '#d8322c',
  tieMaroon: '#7d2231',
  egg: '#fdf6e3',
  eggShade: '#e6d9bd',
  yolk: '#ffc12e',
  yolkDark: '#e09b17',
  hudBg: '#140f1e',
  hudText: '#fdf6e3',
  hudDim: '#8d7f9c',
  good: '#4cc46a',
  bad: '#e0413f',
  crosshair: '#fdf6e3',
  mouth: '#3a2b22',
  tieAlt: '#2b3a5e',
  // The flying politicians' suits. Four tones per cloth, always used in the same order:
  // base, `Lit` (the leading lapel and the near wingtip), `Shade` (everything on the far
  // side of the body) and `Deep` (the trailing flank and the far panel's underside).
  // Depth is carried by tone alone -- the far wing is drawn full size so its tip still
  // reaches the hitbox edge, and only its colour says it is behind.
  suitDarkLit: '#2f3a4f',
  suitDarkShade: '#141a26',
  suitDarkDeep: '#0d1119',
  suitNavyLit: '#36497a',
  suitNavyShade: '#182444',
  suitNavyDeep: '#0f1730',
  shirtShade: '#cbc5b6',
  skinLit: '#f0c69c',
  neckShadow: '#1c1426',
  politicianShoe: '#14161d',
  // The march on the capital: Sheshi Nënë Tereza, the boulevard, the Kuvendi. These
  // three scenes deliberately share one architectural palette so they read as three
  // points along a single route rather than three unrelated pictures.
  daySkyTop: '#3f76ad',
  daySkyMid: '#8ab6d6',
  daySkyLow: '#e6d6b4',
  duskTop: '#241d46',
  duskMid: '#6f4570',
  duskLow: '#dd7a58',
  ridge: '#4a4266',
  facade: '#d6c6a4',
  facadeLit: '#ece0c4',
  facadeShade: '#b09c7c',
  pediment: '#c2b190',
  column: '#e4d6b8',
  columnShade: '#a8967a',
  steps: '#bfb192',
  windowDark: '#38314a',
  windowLit: '#f2cb6e',
  treeCanopy: '#41703f',
  treeCanopyDark: '#2b4a2d',
  treeTrunk: '#4a3a2c',
  paving: '#8d8276',
  pavingLine: '#796f66',
  statue: '#d2cabb',
  statuePlinth: '#9a8f80',
  asphalt: '#443f4e',
  asphaltLine: '#6b6377',
  barrier: '#909aa6',
  barrierPost: '#5c6470',
  // Sheshi Nënë Tereza and the Kuvendi in detail. The two square scenes needed depth
  // more than they needed new shapes, so most of these are haze steps: the same stone
  // and the same mountain, one step further away.
  statueLit: '#e6dfd0',
  statueShade: '#8e8676',
  statuePlinthShade: '#6f6659',
  facadeFar: '#b9ad95',
  farCity: '#9aa0b4',
  ridgeFar: '#6b6488',
  ridgeDusk: '#2e2749',
  pavingLight: '#a39889',
  kerb: '#b8ad9a',
  lampPost: '#3f3a4a',
  lampGlow: '#ffe3a0',
  roofTile: '#a4573f',
  roofTileShade: '#7b3f2d',
  duskGlow: '#f2a45f',
  duskCloud: '#4c2f53',
  duskCloudLit: '#c9756a',
  floodlight: '#ffdf9e',
  protester: '#3f5a7a',
  protesterLight: '#5b7ba1',
  protesterShade: '#2c405a',
  protesterLegs: '#2b3a4a',
  protesterShoe: '#1b2430',
  placardPole: '#6b5334',
  placardEdge: '#a89f8f',
  groundShadow: '#1a1220',
  throwerJacket: '#3d4f6b',
  throwerJacketLit: '#576a88',
  throwerJacketShade: '#26334a',
  throwerHair: '#231c1f',
  throwerHairHi: '#3b2f33',
  bandana: '#d8242f',
  bandanaShade: '#96131e'
};

export const FIGURES = [
  { id: 'rama',    name: 'EDI RAMA',     points: 500,  w: 34, h: 30, speed: 0.9, wobble: 0.6 },
  { id: 'berisha', name: 'SALI BERISHA', points: 800,  w: 28, h: 26, speed: 1.15, wobble: 1.5 },
  { id: 'balla',   name: 'TAULANT BALLA', points: 1200, w: 22, h: 22, speed: 1.45, wobble: 1.0 }
];

export const ROUND = {
  TARGETS_PER_ROUND: 10,
  // Hits needed to advance, as [upToRound, hitsRequired] tiers read in order.
  // The final tier applies to every round beyond it.
  QUOTA_TIERS: [[2, 6], [5, 7], [9, 8], [Infinity, 9]],
  EGGS_PER_RELEASE: 3,
  PAIRS_FROM_ROUND: 3,
  SPEED_RAMP: 1.08,
  SPEED_CAP: 2.2,
  ESCAPE_MS_BASE: 4200,
  ESCAPE_MS_MIN: 1800,
  ESCAPE_MS_STEP: 240
};

export const EGG = { FLIGHT_MS: 350, RADIUS: 4, HAND_X: 240, HAND_Y: 250, ASPECT: 1.4 };

export const SCORE = { FIRST_EGG_BONUS: 0.5, DECOY_PENALTY: 200 };

// FOOT_DY stands the walking protester decoy on the same line as the near rank of the
// crowd (foreRank draws at GROUND_Y + 11), instead of on GROUND_Y itself. Drawn at
// foreground size but planted in the far rank's row, it floated above everyone else.
export const DECOY = { FROM_ROUND: 2, CHANCE: 0.35, SPEED: 0.55, FOOT_DY: 10 };

// Everything that governs how the game FEELS, gathered so it can be tuned in one
// place instead of hunted through the entity modules. Rates are per millisecond.
export const FEEL = {
  SPEED_SCALE: 0.06,        // a figure's `speed` in config units -> px per ms
  SPAWN_Y_MIN: 60,          // politicians enter somewhere in this vertical band
  SPAWN_Y_SPAN: 70,
  FLY_Y_MIN: 24,            // and are clamped to this band while flying
  FLY_Y_MAX: 150,
  BOB_RATE: 0.004,          // sine phase advance, scaled by the figure's wobble
  BOB_AMPLITUDE: 0.06,
  SWERVE_CHANCE: 0.00035,   // chance per ms of reversing direction, x wobble
  FLAP_MS: 140,             // wing-flap period
  SCARE_MS: 260,            // how long a near miss panics a politician
  SCARE_CLIMB: 0.03,        // upward px per ms while panicking
  FLEE_BOOST: 2.2,          // speed multiplier once the player is out of eggs
  FLEE_WINDOW_MS: 700,      // and how long until it is gone for good
  // How long a figure must have been fully inside the view before leaving by an
  // edge counts as an escape. Roughly a reaction plus one egg's EGG.FLIGHT_MS, so
  // a figure that turns straight back around still gives the player one aimed
  // throw. Keep it well under ROUND.ESCAPE_MS_MIN (1800) so the round's own escape
  // timer, not this floor, is always what ends a slow or loitering figure.
  MIN_ON_SCREEN_MS: 600,
  HIT_LAUNCH_VY: -0.05,     // small upward kick at the moment of the splat
  HIT_DRAG: 0.25,           // fraction of horizontal speed kept when hit
  FALL_ACCEL: 0.0012,       // px per ms^2 while tumbling
  TUMBLE_RATE: 0.012,       // spin rate while tumbling
  DECOY_BOB_RATE: 0.006,    // gliding flamingo bob
  DECOY_BOB_AMPLITUDE: 0.02
};

export const STRINGS = {
  title: 'GET EGGED',
  subtitle: 'REVOLUCIONI I FLAMINGOVE',
  start: 'KLIKO PËR TË FILLUAR',
  controls: 'MIU = SHËNJO DHE GJUAJ   M = HESHT   ESC = PAUZË',
  // Shown instead of the line above on a touchscreen, where every word of it is wrong.
  controlsTouch: 'PREKE PËR TË GJUAJTUR   TËRHIQ PËR TË SHËNJUAR',
  startTouch: 'PREKE PËR TË FILLUAR',
  round: 'RRETHI',
  score: 'REZULTATI',
  best: 'REKORDI',
  roundIntro: 'RRETHI',
  roundClear: 'RRETHI I KALUAR!',
  gameOver: 'MBAROI LOJA',
  quotaLabel: 'DUHEN',
  hits: 'GODITJE',
  restart: 'KLIKO PËR TË RILUAJTUR',
  escaped: 'IKU!',
  hitFlamingo: 'MOS E GODIT FLAMINGON!',
  hitProtester: 'AI ËSHTË NJËRI PREJ TANËVE!',
  muted: 'HESHTUR',
  paused: 'PAUZË',
  pauseResume: 'VAZHDO',
  pauseRestart: 'RIFILLO',
  pauseSound: 'TINGULLI',
  pauseSoundOn: 'NDEZUR',
  pauseSoundOff: 'FIKUR',
  pauseQuit: 'DIL NË MENU',
  pauseHint: 'ESC=PAUZË',
  pauseKeys: 'SHIGJETAT + ENTER   ESC = VAZHDO',
  fatal: 'GABIM: LOJA U NDAL.',
  placard: 'RnB BnB',
  placardTop: 'RnB',
  placardBottom: 'BnB'
};

// The politicians' actual faces, cropped from the source photographs at draw time so no
// image-processing step is needed. sx/sy/sw/sh are source pixels; `h` is the drawn height
// in LOGICAL pixels and is kept small enough that the head stays inside the figure's
// hitbox, so what you see is what you can hit.
export const FACES = {
  rama:    { src: 'assets/rama.jpg',    sx: 202, sy: 18, sw: 196, sh: 268, h: 18 },
  berisha: { src: 'assets/berisha.jpg', sx: 120, sy: 48, sw: 232, sh: 318, h: 18 },
  balla:   { src: 'assets/balla.jpg',   sx: 150, sy: 42, sw: 136, sh: 182, h: 18 }
};

// Background music. GAIN sits under the effect gains in audio.js (0.10-0.26) because
// those are short peaks while this is a continuous full mix — at 0.10 the track's
// average level lands roughly 10dB below the quietest effect, so the splat and the
// penalty still cut through. DUCK_GAIN is where it drops to behind the pause menu.
// TEMPORARY, for testing the capital scenes. A run starts on this round instead of 1.
// A run starts on this round. 1 is the shipping value and the normal path — the override
// branch in main.js does not fire at all when it is 1. Raise it (3 = the square, 4 = the
// march, 5 = the Kuvendi, 6 = Tirana at night) to reach a later scene without playing up
// to it, and put it back to 1 before releasing: it also skips the gentle opening rounds.
export const DEBUG = { START_ROUND: 1 };

export const MUSIC = {
  SRC: 'assets/music.mp3',
  GAIN: 0.10,
  DUCK_GAIN: 0.03,
  FADE_IN_MS: 900,      // gentle rise on the first click, not a slam
  RAMP_MS: 250,         // duck, unduck and mute changes; long enough not to click
  MUTE_POLL_MS: 300     // how often music.js re-reads audio.js's muted flag
};

// How the marching backdrop walks the boulevard. state.js keeps the value (0 at Sheshi
// Nënë Tereza, 1 at the Kuvendi); these are the only numbers that decide its pace.
// CROSS_MS is how long the whole boulevard takes at nominal speed, set near the real
// length of a march round — rounds 4, 10, 16 run about 10s played perfectly and about
// 20s if every politician is left to escape — so the correction below only ever has to
// trim the pace, never rescue it. CATCH_UP is how hard the walk leans on how far
// through the round the player actually is: too low and a fast player arrives at the
// Kuvendi halfway down the boulevard, too high and it lurches at every release, which
// is the stepped behaviour this replaced. PACE_MIN and PACE_MAX bound the result, so
// the city can neither stop dead between releases nor teleport when the player is
// quick; keep PACE_MIN above zero, since a march that halts is the whole bug.
export const MARCH = {
  CROSS_MS: 12500,
  CATCH_UP: 5,
  PACE_MIN: 0.35,
  PACE_MAX: 2.4
};
