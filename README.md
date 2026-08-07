# Get Egged

A Duck Hunt-style browser game set in Albania's Flamingo Revolution. Politicians flap across the
sky; you throw eggs. Protect the flamingos.

Rendered at 480×272 — the PSP's native resolution — and scaled up with nearest-neighbour
filtering. No dependencies, no build step, no database.

## Run it

ES modules cannot load from `file://`, so serve the folder:

```bash
npm start          # npx --yes serve -l 5173 .
```

Then open <http://localhost:5173/>. Any static host works — GitHub Pages, Netlify, `python -m http.server`.

## Controls

| Input | Action |
|---|---|
| Mouse move | Aim |
| Left click | Throw an egg |
| `M` | Mute / unmute |
| `Esc` or `P` | Pause and resume |
| `↑` `↓` or `W` `S` | Move the pause-menu selection |
| `Enter` | Start; activate the highlighted pause item; return to the menu from game over — restarting from game over is therefore two presses, not one |

The pause menu offers VAZHDO (resume), RIFILLO (restart the run), TINGULLI (mute toggle) and
DIL NË MENU (quit), and doubles as a status screen. Items respond to both the crosshair and the
keyboard. There is also a pause button in the HUD bar.

The game pauses itself when the tab is hidden or loses focus, since a backgrounded tab stops
receiving animation frames. It never auto-resumes: coming back to a live round with a politician
already halfway across is worse than one extra keypress.

### Touch

| Gesture | Action |
|---|---|
| Tap | Aim and throw at that point |
| Drag | Move the crosshair without throwing, then lift to line up the next tap |
| Pause button in the HUD bar | Open the pause menu — there is no `Esc` key to reach for |

Aiming and firing are the same gesture because a touchscreen has no hover: there is nothing
to move a crosshair with before committing. Dragging is the escape hatch when you want to
line a shot up first, and the crosshair deliberately stays where your finger left it rather
than disappearing, since it is the only sign of where the next tap will land.

The playfield is a 480×272 landscape frame, so **portrait shows a prompt to rotate** rather
than an unplayable letterboxed sliver. The prompt is keyed to a coarse pointer as well as
the orientation, so it never appears on a narrow desktop window.

The menu swaps its own prompts for touch wording when a touch is seen — the mouse and
keyboard line is wrong in every particular on a phone.

## How to play

Each round releases 10 politicians, 3 eggs per release. Eggs fly in an arc with a constant
0.35s flight time, so **aim ahead of a moving target**. Meet the round's hit quota (6, then 7,
8, and 9 from round 10) or the game ends.

| Target | Points |
|---|---|
| Edi Rama — big and slow | 500 |
| Sali Berisha — erratic | 800 |
| Taulant Balla — small and fast | 1200 |

Land it with your first egg of a release for +50%. Egging a flamingo or a fellow protester costs
200 points — they're on your side.

**Clear round 12 and you win.** Round 12 is where `speedMultiplier` hits `SPEED_CAP` and
`escapeMsForRound` hits `ESCAPE_MS_MIN`, so it is the exact round the game stops getting
harder — and it is two full passes of the six scenes. Clearing it opens the finale; failing it
is an ordinary game over, like any other round. Set by `ROUND.FINAL_ROUND`.

## Tuning

Almost everything you might want to change lives in `src/config.js`:

| Block | What it controls |
|---|---|
| `FEEL` | How the game feels — flight speed scale, bob and swerve rates, the panic climb after a near miss, the flee boost when you run out of eggs, fall acceleration and tumble spin |
| `ROUND` | Targets per round, eggs per release, when pairs start, the quota curve, the speed ramp and its ceiling, how long a politician stays on screen |
| `SCORE` | The first-egg bonus and the decoy penalty |
| `DECOY` | Which round decoys start appearing, how often, how fast |
| `FIGURES` | Each politician's size, speed, erraticness and points |
| `EGG` | Egg flight time, size, and where it leaves your hand |
| `VIEW` | Logical resolution and the ground line |
| `MUSIC` | Background track: source path, volume, the level it ducks to behind the pause menu, and the fade times |
| `MARCH` | How the marching backdrop paces itself: nominal crossing time, and how hard it leans on the round's real progress |
| `PALETTE` | Every colour |
| `STRINGS` | Every word of Albanian the game draws |

If the difficulty ramp feels wrong, `ROUND.SPEED_RAMP` and `ROUND.ESCAPE_MS_STEP` are
the two dials that matter most; `ROUND.QUOTA_TIERS` sets how many hits each round
demands.

A handful of internal constants remain in their own modules rather than `config.js` —
phase durations at the top of `src/state.js`, a few physics/tuning knobs local to the
module they affect (egg arc rise, particle gravity, the frame-time clamp, and so on),
and each decoy kind's size in `src/entities/decoy.js` — and the artwork is drawn in
`src/render/`. The two Albanian fallback messages for a browser without canvas are in
`index.html`, since they have to work before any script runs.

## Tests

```bash
npm test           # node --test "tests/**/*.test.js"
```

Covers the pure logic: trajectory, hit resolution, quota progression, scoring, storage guards,
the state machine, the pause phase (that time genuinely stops and that no elapsed time is banked
across a pause), and target entry/escape. Animation, audio and difficulty feel are covered by the
manual checklist below.

## Manual QA checklist

- [ ] Title screen shows `GET EGGED` / `REVOLUCIONI I FLAMINGOVE`, prompt blinks.
- [ ] Crosshair tracks the mouse; OS cursor hidden; thrower leans toward the aim.
- [ ] Egg arc is visible and lands exactly where you clicked.
- [ ] Leading a moving target is necessary and feels fair.
- [ ] All three caricatures are distinguishable at a glance.
- [ ] Hit: yolk mask, splat particles, `+points`, tumble to ground.
- [ ] Miss on the ground leaves a fading yolk decal.
- [ ] A near miss makes the figure swerve and climb in panic.
- [ ] Spending all three eggs makes the survivor bolt for the edge rather than loiter.
- [ ] Escape shows `IKU!` and a red pip.
- [ ] Backdrop changes each round: lagoon → Sazan → Sheshi Nënë Tereza → the march → the Kuvendi → Tirana at night, then repeating.
- [ ] On the march round the city scrolls past as the round is played, and the sky goes from afternoon to dusk.
- [ ] On the march the crowd walks on the spot while the city slides past — the player marches with them.
- [ ] The marchers' stride keeps pace with the road markings and does not look like skating.
- [ ] The march moves continuously, not in ten lurches — it keeps going between releases, while nothing is being thrown.
- [ ] The Skanderbeg monument reads as a horse and rider with a helmet and raised sword, not a pale blob.
- [ ] The Kuvendi reads as a low, wide, articulated building with a tiled roof — not a second Polytechnic.
- [ ] The march arrives at the same building round 5 opens on.
- [ ] A politician reads as a man in a suit with coat-tail wings at every size, including Balla's smallest.
- [ ] A hit politician's tumble pose is clearly different from its flying pose.
- [ ] The march arrives with the Kuvendi centred by the last release, and the next round starts back at the square.
- [ ] No tree or building hides a politician; the Kuvendi's flag sits under the flight band.
- [ ] Decorative flamingos glide in the background and are never targets.
- [ ] Decoy penalty: red flash, Albanian toast, −200, no hit pip.
- [ ] Round clear: mascot cheers. Game over: mascot droops.
- [ ] Difficulty is noticeably harder by round 5 and still playable at round 12.
- [ ] Music starts on the first click, loops, and sits under the effects — the splat still cuts through.
- [ ] `Esc` / `P` pause and resume; the scene freezes completely, including water, smoke and crowd sway.
- [ ] A two-minute pause resumes without anything teleporting across the screen.
- [ ] Pausing during the round intro or the round-clear banner does not skip the transition.
- [ ] Pause-menu items highlight under the crosshair and under the arrow keys; clicking one never throws an egg.
- [ ] Music ducks behind the pause menu and comes back on resume, restart and quit alike.
- [ ] Alt-tabbing away pauses the run; coming back does not auto-resume.
- [ ] The thrower reads as a person from behind — jacket, hood, bandana, both arms — and leans into the aim.
- [ ] The thrower's hand is empty once the last egg of a release is spent.
- [ ] Crowd reads as a crowd with depth, not one flat row; flags wave and placards are legible.
- [ ] A politician never enters and immediately turns back out — no `IKU!` before it has been on screen.
- [ ] On a phone: a tap throws exactly one egg — never two — and lands where you tapped.
- [ ] Dragging moves the crosshair without throwing; it stays put when you lift.
- [ ] Nothing scrolls, zooms, pull-to-refreshes, highlights or selects on any gesture.
- [ ] Portrait shows the rotate prompt; landscape fills the screen, and rotating back refits correctly.
- [ ] The menu shows the touch wording, not `MIU`/`ESC`, once the screen has been touched.
- [ ] The HUD pause button is reachable by thumb, and the pause menu items are tappable.
- [ ] Music starts on the first tap (iOS will not play a note before one).
- [ ] Switching apps pauses the run; coming back does not auto-resume.
- [ ] `M` toggles `HESHTUR` and silences audio and music; state survives a reload.
- [ ] High score survives a reload; works in private browsing (score just doesn't persist).
- [ ] Window resize keeps the canvas centred and correctly proportioned.
- [ ] No console errors during a full game.

## Scenes

Six backdrops cycle, one per round, in `src/render/background.js`:

| Round | Scene |
|---|---|
| 1 | The Narta lagoon — salt pans, reeds, flamingos |
| 2 | Sazan — pines, a crane and a RESORT hoarding |
| 3 | Sheshi Nënë Tereza — the Polytechnic's colonnade, with the Skanderbeg monument on the square |
| 4 | The march down the boulevard, square → parliament |
| 5 | The Kuvendi at dusk, behind a barrier line |
| 6 | Tirana at night — the pyramid, the skyline, the whole city out |

Round 7 is the lagoon again. `backdropForRound()` reads `SCENES.length`, so adding a scene to
that array is the only edit needed to put it in the rotation — but **`sheshi`, `march` and
`parlamenti` must stay contiguous and in that order**, since the middle one is literally the
journey between its two neighbours. A test pins that.

The march scrolls rather than cross-fading, and it moves **continuously** — that is the point of
it. `state.js` advances a `march` value every frame at a constant nominal speed, multiplied by a
clamped pace that leans on how far through the round the player actually is. An earlier version
chased `released / TARGETS_PER_ROUND` directly; because `released` only changes on a release, and
jumps two at a time once pairs start, the city sat still and lurched ten times a round, which read
as a slideshow rather than a march.

The pace term exists because a march round's real length varies about twofold — roughly ten
seconds played perfectly, twenty if everything is left to escape. Pure time-based progress either
falls short on a fast round, which matters because the *next* round opens on the Kuvendi this one
has to reach, or arrives early and parks at 1 for the last third of a slow one. Since the minimum
pace is above zero the value is strictly increasing: it can never stall, never run backwards, and
`Math.min(…, 1)` bounds arrival.

The crowd does not scroll — the player is marching with it, so it is the city that moves. It does
now **walk on the spot**: legs scissoring, hips bobbing twice per stride with the feet planted, and
arms swinging against their own leg, staggered off each protester's baked phase so the crowd is not
one object stepping in unison. The stride is driven by ground distance rather than by time, so the
feet keep pace with the road markings however fast the round is being played — drive it off a clock
instead and the crowd skates. The walk is behind an off-by-default parameter, so the standing
crowds in the other scenes are unaffected.

Because the progress value lives in `state.js` rather than the renderer, it inherits pause for free.

Tuning: `MARCH` in `config.js` (`CROSS_MS`, `CATCH_UP`, `PACE_MIN`, `PACE_MAX`) governs the pace;
`MARCH_SPAN`, `MARCH_LANDMARKS`, the three parallax rates (`MARCH_RIDGE_RATE`, `MARCH_TREE_RATE`,
`MARCH_GROUND_RATE`) and the stride constants (`MARCH_STRIDE_SPAN`, `MARCH_STRIDE_IDLE`,
`MARCH_FORE_STRIDE`) live in `background.js`. If the crowd ever looks like it is skating, those
last two groups are what disagree — `MARCH_SPAN` sets how much boulevard passes per round, and too
much of it is what no stride can keep up with.

## The finale

Clearing `ROUND.FINAL_ROUND` enters `PHASE.FINALE` instead of `PHASE.CLEAR`: Sheshi Nënë Tereza
at dawn, with a bronze Edi Rama on a plinth where the square's monument slot usually sits. The
player brings it down with the same eggs — six hits, each one leaning it further — and then the
victory card closes the run.

It is played rather than watched, and it cannot be failed. There is no egg count, no timer and
no quota: the run has already been won, so the finale only decides *when* the statue falls. The
score is banked the moment it opens, before a single egg is thrown, so leaving early cannot cost
the player the round they just cleared.

Two things are easy to get wrong if you touch it:

- **The lean is a spring, not a staircase.** Each hit kicks `angle` past the resting tilt
  (`hits * LEAN_PER_HIT`) and `SETTLE_RATE` pulls it back. A flat step per hit reads as a
  progress bar rather than as something heavy being fought with.
- **`FALL_DROP` is not decoration.** Rotating about the top of the plinth alone leaves the
  statue lying in mid-air at the height of the pedestal it was standing on; it has to come off
  the plinth as well as turn.

`statueBox()` in `state.js` derives the hitbox from the current lean, so what you can hit is
always what you can see. Tuning lives in `FINALE` in `config.js`; the art is `render/finale.js`,
which borrows the square itself from `background.js` (`drawTriumphSquare`, `drawTriumphCrowd`,
`drawTriumphForeRank`) so the triumph happens in a square the player has already played in twice.
The statue's head is the same `assets/rama.jpg` the flying politicians wear, desaturated and
tinted to bronze, with a sculpted head as the fallback if the photo has not loaded.

## Content note

The three figures are public political figures depicted in caricature for satire. Their faces
are photographs of the real public figures, cropped from source images at draw time at the
owner's explicit request, with a drawn-caricature fallback if a photo is missing, blocked or
still loading; everything else — bodies, backgrounds, decoys, HUD — is drawn in code. Hits are
comedic egg splats; the game contains no blood, weapons, injury or violence.

The background track at `assets/music.mp3` was supplied by the project owner, who is responsible
for holding the rights to distribute it with the game. Swapping it is a one-line change to
`MUSIC.SRC` in `src/config.js`; if the file is missing or will not decode, the game plays silently
rather than failing. Note that the track is a 4.4 MB binary in a repository that otherwise holds
only source and three small photographs — git keeps every version of it forever and mp3 does not
delta-compress, so replace it in place sparingly, or host it outside the repo.
