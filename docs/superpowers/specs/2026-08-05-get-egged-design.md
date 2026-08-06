# Get Egged — Design Spec

**Date:** 2026-08-05
**Status:** Approved
**Deliverable:** `C:\Users\User\Desktop\Games\get-egged\` — a browser game, no server logic, no database.

## 1. Concept

Get Egged is a Duck Hunt reskin set in Albania's Flamingo Revolution. The player is a
protester standing in the reeds of the Narta Lagoon. Politicians flap across the sky by
their suit jackets. The player lobs eggs in an arc and must lead moving targets. A pink
flamingo mascot stands in the reeds and takes the role Duck Hunt gave the dog: it cheers
when the player clears a round and hides its head under its wing when the player fails.

### Theme background

The Flamingo Revolution (*Revolucioni i Flamingove*) began 16 May 2026 in Zvërnec over the
Narta Lagoon and Sazan Island luxury resort project, escalated after 30 May into daily
anti-government protests in Tirana, and adopted the pink flamingo — which shelters in the
lagoon — as its symbol. The game draws its three backdrops, its slogans and its mascot from
this movement.

### Satire boundary

The three targets are named public figures depicted in their public political role. Hits are
comedic: yolk on the face, a wobble, and the figure flaps off screen. The game contains no
blood, no weapons, no injury, no death, and no depiction of real violence. The egg is used
strictly as the long-standing non-lethal protest gesture it is.

### Likeness and assets

Three source photographs (`assets/rama.jpg`, `assets/berisha.jpg`, `assets/balla.jpg`) ship
as face sprites, cropped at draw time to a small region over each figure's caricature body.
This was the owner's explicit direction after playtesting showed the three caricatures were
not distinguishable at the game's resolution; the owner was advised of the likeness and
third-party copyright implications of shipping press photographs and chose to proceed anyway.
If a photo is missing, blocked or still loading, the game falls back to the original
caricature head, which remains fully in place. Every other visual element — background,
bodies, wings, decoys, HUD, particles — is still drawn in code from canvas paths, gradients
and primitives; only the three faces are photographic.

## 2. Platform and constraints

| Constraint | Decision |
|---|---|
| Runtime | Browser only, desktop. Chromium/Firefox/Safari current versions. |
| Dependencies | None. No framework, no bundler, no build step. |
| Persistence | `localStorage` for the high score and the mute preference only. No database, no network calls. |
| Input | Mouse. Move to aim, left click to throw, `M` to mute, `Enter`/click to advance menus. Touch is explicitly out of scope. |
| Resolution | Logical canvas 480×272 — the PSP's native resolution — scaled up with `imageSmoothingEnabled = false` and letterboxed to preserve aspect ratio. |
| Serving | Any static host. Local development via `npx serve` (ES modules cannot load from `file://`). |
| Language | All player-facing text in Albanian. The title remains "Get Egged". |

## 3. Targets

Three politicians, drawn as caricatures and labelled with their real names.

| Figure | Caricature cues | Size | Speed | Points |
|---|---|---|---|---|
| Edi Rama | Very tall and lanky, bald with stubble, wide grin, patterned tie streaming behind | Large | Slow | 500 |
| Sali Berisha | Short, thick white swept-back hair, pocket square, stiff upright posture | Medium | Medium, erratic direction changes | 800 |
| Taulant Balla | Navy suit with a maroon tie, round face, dark hair | Small | Fast | 1200 |

Shared animation: jacket panels flap as wings on a two-phase cycle, the tie flutters, and the
figure wobbles briefly when an egg lands within a near-miss radius.

## 4. Rules

### Round structure

- A round consists of **10 politicians**.
- Politicians are released **one at a time in rounds 1–2**, and **two at a time from round 3**.
- Each release grants **3 eggs**. Eggs do not carry over; unused eggs are lost when the release ends.
- A release ends when all its politicians are hit or have escaped, or the eggs run out and all
  in-flight eggs have resolved.

### Quota

| Rounds | Hits required out of 10 |
|---|---|
| 1–2 | 6 |
| 3–5 | 7 |
| 6–9 | 8 |
| 10+ | 9 |

Failing the quota ends the game.

### Difficulty ramp

Per round, cumulative: flight speed ×1.08, direction-change frequency increases, and time on
screen before escape decreases. Values are clamped at a playable ceiling defined in
`config.js` so late rounds stay hard rather than impossible.

### Throwing

- A crosshair follows the mouse; the OS cursor is hidden over the canvas.
- A click spawns an egg at the thrower's hand at bottom-centre. The egg follows a parabola to
  the clicked point with a **fixed flight time of 0.35s**, independent of distance, so that
  leading a target is a learnable skill rather than guesswork.
- The egg resolves **on landing**: if a target's hitbox contains the landing point at that
  moment, it is a hit. The target's position at click time is irrelevant.
- Hit: yolk splat particles, a yolk mask on the figure, a tumbling fall with rotation, and a
  floating score number.
- Miss: the egg splats where it lands — a fading decal on the ground, a puff and drop in the air.

### Scoring

- Base points per figure as tabled above.
- **First-egg bonus:** +50% when the hit lands with the first egg of a release.
- **Decoy penalty:** −200. Score floors at 0 and never goes negative.

### Decoys

From round 2, a decoy occasionally crosses the screen alongside the politicians:

- A **flamingo** — egging it shows *"Mos e godit flamingon!"*
- A **protester** with a placard — egging it shows *"Ai është njëri prej tanëve!"*

Egging a decoy costs 200 points, consumes the egg, and flashes the screen red. Decoys are
never required targets and never count toward the quota. Letting a decoy pass has no penalty.

## 5. Presentation

### Backdrops

Three, cycling by round, all drawn in code:

1. **Narta Lagoon** — pink sunset gradient, reeds, salt-flat silhouettes.
2. **Zvërnec / Sazan** — pines, island profile, a construction crane behind a `RESORT` hoarding.
3. **Tirana boulevard** — protest crowd silhouettes with placards and flags, smoke haze.

A parallax layer of decorative flamingos wades and glides behind the action. These are
**cosmetic only** — never targets, never interactive, present as the movement's symbol.

### HUD

Albanian throughout: `RRETHI` (round), `REZULTATI` (score), `REKORDI` (high score), remaining
eggs as filled and hollow circles, and a ten-pip hit-o-meter that fills green for hits and red
for misses, as in the original.

Screen text: `RRETHI I KALUAR!` between rounds, `MBAROI LOJA` at the end with final and best
score, and a start screen carrying the title and controls.

### Audio

Synthesized in WebAudio, no audio files: throw whoosh (filtered noise sweep), wet splat (noise
burst plus low thud), miss plop, descending escape tone, four-note major arpeggio on round
clear, buzzer on decoy penalty. `M` toggles mute; the mute state persists in `localStorage`.
The `AudioContext` is created and resumed on the first user gesture to satisfy autoplay policy.

## 6. Architecture

State machine, fixed-timestep update, single render pass per frame.

```
MENU ──click──▶ ROUND_INTRO ──▶ PLAYING ──quota met──▶ ROUND_CLEAR ──▶ ROUND_INTRO
                                    └────quota missed──▶ GAME_OVER ──click──▶ MENU
```

### Modules

Each file has one responsibility and a narrow interface.

```
get-egged/
  index.html            canvas element, module entry point
  styles.css            page frame, letterboxing, hidden cursor
  README.md             how to run, controls, manual QA checklist
  src/
    main.js             bootstrap, canvas sizing, requestAnimationFrame loop, wiring
    config.js           every tunable — speeds, quotas, points, palette, Albanian strings
    rules.js            pure rules — quota, difficulty ramp, scoring, hit tests
    state.js            state machine, round and release lifecycle, quota evaluation
    input.js            mouse position and clicks translated to logical canvas coordinates
    audio.js            WebAudio synthesis, mute toggle
    storage.js          localStorage read/write with a try/catch guard
    entities/
      target.js         politician spawn, flight AI, hit and escape, tumble
      egg.js            arced projectile, landing resolution, splat spawning
      decoy.js          flamingo and protester crossers
      particles.js      splat fragments, floating score text
    render/
      sprites.js        code-drawn caricatures, flamingo, protester, egg, crosshair
      background.js     three backdrops plus the parallax flamingo layer
      hud.js            HUD, hit-o-meter, overlay screens
  tests/
    *.test.js           node:test assertions over the pure logic
```

### Data flow

`input.js` reports pointer state. `main.js` advances the clock and calls `state.js`, which owns
the arrays of targets, eggs, decoys and particles and updates each entity module. Entity
modules mutate their own objects and return events (hit, escape, penalty) that `state.js`
turns into score and quota changes. Render modules read state and draw; they never mutate it.

### Error handling

- `localStorage` access is wrapped in try/catch — a private-mode or blocked-storage browser
  runs fine with an in-memory high score.
- WebAudio unavailable or blocked degrades to silence without breaking the game loop.
- Canvas 2D context unavailable shows a plain HTML message instead of a blank screen.
- `requestAnimationFrame` delta is clamped so an alt-tab pause cannot teleport entities.

## 7. Testing

Pure logic lives in exported functions so it can be verified rather than eyeballed. `node:test`,
no dependencies, run with `node --test tests/`:

- **Trajectory:** an egg thrown at a point lands at that point, and flight time is constant
  regardless of distance.
- **Hit resolution:** landing inside and outside a hitbox, and boundary cases at the hitbox edge.
- **Quota progression:** the correct quota for representative rounds, and pass/fail evaluation
  at the boundary.
- **Scoring:** base points, first-egg bonus arithmetic, decoy penalty, and the floor at zero.
- **Storage:** a throwing `localStorage` does not propagate an exception.

Feel-based behaviour — animation, audio, difficulty curve — is covered by a manual QA
checklist in the README rather than automated tests.

## 8. Out of scope

Touch and mobile controls, multiplayer, online leaderboards, any backend or database, music
beyond the listed sound effects, additional political figures, and a bundled single-file
distribution.
