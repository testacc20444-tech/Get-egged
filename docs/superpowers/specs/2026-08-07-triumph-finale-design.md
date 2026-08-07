# The triumph finale — design

## Why

The game has no ending. `backdropForRound()` is `(round - 1) % SCENES.length`, so the six
scenes cycle forever, every difficulty dial is pinned by round 12, and the only way out of
a run is to lose. A satire about a protest that can only ever be lost has the wrong shape.

This adds the one thing the arc is missing: the protest wins. Clearing round 12 opens on a
dawn Sheshi Nënë Tereza with a bronze Edi Rama on a plinth, and the player brings it down
with the same eggs they have thrown for twelve rounds.

## Trigger

`ROUND.FINAL_ROUND = 12`. Round 12 is not arbitrary: `speedMultiplier` hits `SPEED_CAP`
and `escapeMsForRound` hits `ESCAPE_MS_MIN` there, so it is the exact round the game stops
getting harder. It is also two full passes of the six scenes, so every backdrop is seen
twice before the last one.

`endRound()` gains one branch: quota met **and** `isFinalRound(round)` enters `PHASE.FINALE`
instead of `PHASE.CLEAR`. Failing round 12 still goes to `PHASE.OVER` exactly as before, so
nothing about losing changes.

## The finale is played, not watched

The statue stands; the player throws; each egg that lands on it leans it further; the sixth
brings it down. Two rules keep it a reward rather than a new challenge:

- **Eggs are unlimited.** There is no `eggsLeft`, no quota, no timer, and no way to fail.
  The player has already won; the finale only decides *when* the statue falls.
- **Misses cost nothing.** A miss breaks on the paving and leaves a decal, the same as in
  play, and that is all.

The lean is a spring rather than a staircase. Each hit kicks `lean` past its new resting
angle and it settles back — a statue that lurches and rights itself reads as something
heavy being fought with, where a fixed step per hit reads as a progress bar.

## Phases

```
PLAYING --(round 12 quota met)--> FINALE
                                    |
  standing --(6th hit)--> falling --(FALL_MS)--> down --(CARD_DELAY_MS)--> card
                                                                            |
                                                                    click --+--> MENU
```

`FINALE` joins `PAUSABLE`: it is interactive, so ESC must work in it. The HUD bar is not
drawn — there is no round, quota or egg count left to report, and the card carries the
score.

## Modules

- `config.js` — `ROUND.FINAL_ROUND`, a `FINALE` block for every tunable, bronze and dawn
  entries in `PALETTE`, and the Albanian strings. Nothing is hardcoded elsewhere.
- `rules.js` — `isFinalRound(round)`.
- `state.js` — `PHASE.FINALE`, `startFinale`, the finale branch of `update`/`click`, and
  `statueBox(finale)`: the hitbox, derived from the lean, exported so the aim can be
  tested without a canvas.
- `render/finale.js` — **new**. The statue, the plinth, the dust and the victory card.
  It does not live in `background.js`: that file is already ~1300 lines, and this is a
  phase's whole presentation rather than another entry in `SCENES`.
- `render/background.js` — gains a `dawnSky` and exports exactly three composed functions:
  `drawTriumphSquare`, `drawTriumphCrowd` and `drawTriumphForeRank`. Composing them here
  rather than exporting the seven internals they call keeps the module's private helpers
  private, and puts the city drawing where all the other city drawing already lives. The
  crowd is split in two so the fallen statue can be drawn between the ranks — in front of
  the far ones, behind the near one. No existing behaviour changes.
- `main.js` — routes `FINALE` to the new scene, keeps the thrower drawn, skips the HUD.

## The statue

Drawn in the idiom `skanderbeg()` already established: design-unit `px`/`py` helpers, flat
`bar`/`poly` fills, and three tones doing the separating. Bronze rather than stone, so it
reads as a different monument in the same square.

The head reuses the game's own `FACES.rama` photograph through a bronze-tinted offscreen
canvas, built once and cached — consistent with the flying politicians, who already wear
their real faces, and unmistakable at 18 logical pixels where a caricature would not be.
If the photo has not loaded, it falls back to a sculpted head in the same tones, the same
way `drawTarget` falls back to the caricature.

The topple pivots about the front edge of the statue's feet, not its centre, because a
statue goes over its own base.

## Testing

`node:test` over the pure logic, as everywhere else in this project:

- round 12 cleared enters `FINALE`, round 11 cleared still enters `CLEAR`
- round 12 **failed** still enters `OVER`
- the high score is banked on winning
- hits accumulate lean; `HITS_TO_TOPPLE` hits start the fall; further eggs do not re-topple
- `statueBox` moves with the lean, so a throw that hit at rest misses once it is over
- it drops off the plinth as it goes over, and does not end up lying in mid-air
- eggs are unlimited: throwing never reduces a count or stops working
- `FINALE` is pausable and pause freezes it
- clicking the finished card returns to the menu

Rendering stays untested by design; `finale.js` is verified by running the game at
`DEBUG.START_ROUND = 12` and looking at it.

## Not doing

No new sound effects — the finale reuses `splat`, `miss`, `throw` and `clear`. No win
persistence, no unlock, no ending variations. The game is still a score attack; this gives
it a finish line.
