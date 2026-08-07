# The finale, made cinematic — design

Follows on from `2026-08-07-triumph-finale-design.md`, which built the triumph. That spec
got the statue standing, hit, leaning and down. This one is about what the moment *looks*
like, and it supersedes exactly one of that document's decisions — see "Sounds" below.

## Why

The finale works and reads as a reward, but three things undersell it.

The statue is **inert**. Between hits nothing moves; the spring settles and then the bronze
just stands there. Damage accumulates only as yolk — the figure itself never registers
that it is being brought down.

The fall is **one rigid body and one beat**. It teeters, rotates, lands, rocks to a stop.
Everything that makes a toppling monument worth watching happens at the impact, and at the
impact the current scene gives two dust ellipses, a 2px sinusoidal wobble, and the `splat`
cue an egg makes. A ninety-pixel bronze figure hits the paving and sounds like an egg.

And the head never comes off. A toppled statue's head snapping loose and rolling away is
*the* image the whole scene is reaching for — it is what the crowd is there for — and the
scene stops one beat short of it.

## The shape of the change

Six seconds from the last egg to the card, skippable with a click. The statue becomes two
bodies rather than one. The camera moves, but only once the player has stopped throwing.

```
0.0s   sixth egg lands, `falling` begins
0.0    teeter — time dilates to ~0.3x, camera pushes to ~1.35x
1.2    its weight takes it — time ramps back to 1.0x, rotation accelerates
2.6    IMPACT — flash, kick, ground crack, dust plume, crowd surge, confetti
2.6    head detaches: bounces, rolls, comes to rest
4.2    dust clears, camera eases back to identity
5.0    card punches up
6.0    settled
```

Those are wall-clock targets. The constants that hit them are tuned by looking at the
scene, the same way the rest of `finale.js` was — rendering stays untested by design.

## Camera, and why it cannot move while the player is throwing

The camera is identity for the whole of `standing`. It only takes over from the tipping
point, and by then `click()` already ignores every click until the card is up.

That single restriction is what keeps this contained. `statueBox()` returns world
coordinates with no notion of a camera; if the view drifted while the player was aiming,
every click would need an inverse transform and the hitbox could desync from the drawn
figure. Because the camera is identity for the entire interactive phase, **input and aim
math are untouched** — not carefully kept in sync, but genuinely unchanged.

It rides a seam that already exists. `main.js` bakes `finaleShake` into the base
`setTransform` because a kick applied to the scenery alone reads as a rendering fault
rather than an impact; the camera folds into the same call as a zoom about a focal point:

```js
const s = VIEW.SCALE * cam.zoom;
ctx.setTransform(s, 0, 0, s,
  (cam.fx * (1 - cam.zoom) + cam.dx + kick.dx) * VIEW.SCALE,
  (cam.fy * (1 - cam.zoom) + cam.dy + kick.dy) * VIEW.SCALE);
```

`monumentCamera` returns the focal point as well as the zoom, and it is the statue's own
midpoint rather than the screen's — the figure is off-centre in the square, and zooming
about the screen centre would push it toward the edge exactly as it falls. The focal point
tracks the body down and then holds on the resting head.

Background, statue, particles, eggs and thrower magnify together for free.

**This forces one fix.** Overlays currently draw inside that transform. At two pixels of
shake nobody notices; at 1.35x zoom, pausing mid-fall would render the pause menu
magnified and off-centre. The transform resets to plain `VIEW.SCALE` before the overlay
block. The victory card is unaffected either way — the camera is back at identity before
it appears — but the pause menu genuinely needs it.

## Time dilation

`monumentTimeScale(f)` is 1 while standing, dips through the teeter, and ramps back to 1
as the fall accelerates. It is applied **once**, at the top of the `FINALE` branch in
`update()`, before `updateParticles` — so the crowd's sway, the particles and the statue
all dilate together. Scaling the statue alone would slide it against a world still running
at full speed, which reads as a frame-rate problem rather than as slow motion.

`f.ms` therefore accumulates in *finale time*: `FALL_MS` stays the fall's own duration and
every curve inside `updateMonument` is unchanged in meaning. Only the wall-clock mapping
moves. This is what breaks four existing tests, and the fix is in "Testing" below.

## Modules

- **`src/entities/monument.js` — new.** The statue's whole simulation as pure functions:
  `createMonument`, `updateMonument`, `hitMonument`, `monumentBox`, `monumentTimeScale`,
  `monumentCamera`, `skipToSettled`.

  It is a new module for the same reason `finale.js` was split out of `background.js`:
  this is a simulation, not another field on a blob. `updateFinale` is ~50 lines today;
  head physics, camera, time scale and crack state would add ~70 more to a `state.js`
  already past 540. Pulling it out keeps `state.js` a router and makes the physics
  testable without a canvas — which is the whole reason `statueBox` was exported in the
  first place.

  `state.js` keeps exporting `statueBox` and `finaleCardUp` unchanged, so no existing
  test moves on account of the refactor.

- **`state.js`** — delegates to `monument.js`, applies the time scale in `update()`, and
  gains the skip branch in `click()`.
- **`render/finale.js`** — camera-aware draw, the detached head, the neck stub, the ground
  crack, the dust plume, and the card's punch.
- **`render/background.js`** — a `surge` parameter on the two triumph crowd functions.
- **`audio.js`** — `crash`, `headfall`, `roar`.
- **`main.js`** — the camera in `setTransform`, and the transform reset before overlays.
- **`config.js`** — every new tunable. Nothing is hardcoded elsewhere; this is enforced by
  a prior commit that stripped hex literals out of the render modules.

## The sculpture

**Standing.** Two additions, both of which exist to stop the bronze reading as scenery.
Stress cracks open at the ankles and deepen with each hit, so the figure carries its own
damage rather than only the yolk thrown at it — and it tells the player how close the next
throw is to finishing it, without a progress bar. And a slow breathing sway, an order of
magnitude below the hit spring, so it is never perfectly still.

**Falling.** The three-act structure stays; it was the right instinct and the comment in
`config.js` explains it well. What changes is proportion: the teeter gets long enough to
actually read as hesitation, and the second act whips rather than eases.

**The head comes off.** At impact the body's angular velocity launches it — gravity,
restitution around 0.42 over two or three bounces, roll friction, spin proportional to
horizontal speed, and a resting angle when it stops. It is drawn by translating and
rotating into the existing `statueHead()`, so it needs no new art and inherits the bronzed
photograph and its fallback. The body draws a torn neck stub where the head used to sit,
in the bright `P.bronzeLit` that `stumps()` already uses for sheared metal.

The head is the centrepiece of the sequence and the reason the camera pushes in.

**Impact.** The two dust ellipses become puffs spawned along the fallen figure's length
plus a fast ground-hugging ring, so the plume has a direction — the statue fell *that way*.
A ground crack radiates from where it struck. The shake becomes a sharp decaying kick,
amplitude proportional to the square of what remains, instead of the current fixed-frequency
sine, which reads as a wobble rather than a hit. It stays fully deterministic in `f.shake`,
so a paused frame still does not jitter.

The existing `g.flash` is reused for the impact flash rather than adding a second one.

## The crowd

`protesterSilhouette` gains a `surge` parameter defaulted to `0` — the same pattern `walk`
and `stridePhase` already use, which is what makes this safe: the other five scenes pass
nothing and are untouched by construction, not by inspection.

At impact `surge` ramps to 1 — fists up, a jump, faster sway — then decays to a raised
baseline that persists, so the crowd is still celebrating under the victory card rather
than snapping back to an idle sway the moment the dust settles.

Confetti reuses `sys.bits` with `P.flag`, `P.flagEagle` and `P.egg`: upward velocity, low
gravity, long ttl. No new particle type, and the flag colours are already in the palette.

## Sounds

**This supersedes "No new sound effects" in the triumph spec.** That decision was right
for a scene assembled from existing beats; it is wrong now that the sequence has an impact
and a second body in it. Three additions to the `SOUNDS` table in `audio.js`, built from
the `tone`/`noise` helpers already there:

- `crash` — low sine boom under a heavily filtered noise burst. What the statue lands with,
  in place of `splat`.
- `headfall` — a short metallic clang on the head's first bounce.
- `roar` — a filtered noise swell for the crowd.

## Skip

A click during `falling` or `down` calls `skipToSettled`: the body snaps to `FALL_ANGLE`,
the head parks at rest, dust and camera clear, and `f.ms` jumps to `CARD_DELAY_MS`.

It is locked out for the first ~400ms of the fall. A player throwing quickly at the end has
a click in flight when the sixth egg lands, and without the lockout that click would skip
the topple they just earned.

This replaces the `if (f.state !== 'standing') return;` branch in `click()`. The comment
there — "already going over; let it go" — was protecting the moment from being interrupted;
six seconds is long enough that protecting it costs more on a replay than it buys on the
first watch.

## Testing

`node:test` over pure logic, as everywhere else here.

**Existing tests that move.** Four do `run(g, FINALE.FALL_MS + 100)` and assert `down`.
Under dilation that wall-clock advance no longer completes the fall. They move to a
`settle(g)` helper that runs until the statue is down and at rest, with a cap that fails
loudly rather than hanging — the same guard style `playRound` already uses. This also makes
them immune to any future timing change, which the current form is not.

**New coverage:**

- the time scale is 1 while standing, and below 1 through the teeter
- the head detaches at impact and comes to rest on the ground, not in the air
- the camera is identity throughout `standing`, and identity again before the card is up
- skip reaches card-ready from mid-fall
- skip is locked out in the first moments of the fall
- skip is a no-op while standing — a click there must still throw an egg

The `surge` parameter deliberately gets no committed test. It defaults to `0` and the five
non-triumph scenes pass nothing, so they are unchanged by construction rather than by
assertion — the same argument that already covers `walk` and `stridePhase`. It is checked
once during implementation with a throwaway stub-context harness, which is this project's
established technique for render changes; if that harness stubs `save()`/`restore()`, they
must push and pop `globalAlpha`, or correctly-scoped fades read as false leaks.

Rendering stays untested by design. `finale.js` is verified by running the game with
`DEBUG.START_IN_FINALE = true` and looking at it.

## Not doing

No change to how the finale is entered, to the score, or to the card's contents. No camera
motion during `standing`. No new particle type. No generalised rigid-body helper — the head
is the only new body, and one body does not justify an engine.

## Before shipping

`DEBUG.START_IN_FINALE` is currently `true` in `config.js`. It is needed throughout this
work and must be back to `false` before release, as its own comment in `config.js` says.

---

## What changed during implementation

Recorded here rather than silently, because each of these contradicts something above.

**`monumentCamera` returns `{fx, fy, zoom}`, not `{fx, fy, zoom, dx, dy}`.** The pan offset
was never used: the focal point already places the view, and the shake supplies the only
translation there is. Two dead fields threaded through `main.js` is worse than none.

**`skipToSettled` fast-forwards the real head simulation** instead of parking the head at
`HEAD_REST_DX`/`HEAD_REST_ANGLE`. The physics is deterministic, so running it forward lands
the head on exactly the pixel it would have reached — where stored constants would drift out
of agreement the first time the launch or friction was retuned, and the skipped ending would
quietly stop matching the played one. Those two constants no longer exist, and there is a
test asserting the two endings are identical.

**Two things were only found by photographing the real game**, which is the argument for
doing that rather than trusting the tests:

- The impact flash was drawing `P.bad` — the penalty red — because that is `drawFlash`'s
  default colour. The single moment in the game where the player has won something was
  washing the screen in the colour of being hit. It now flashes `P.dawnGlow`.
- The ground crack was invisible. It was drawn level with the statue, which put every fork
  underneath the fallen greatcoat, in `P.pavingLine` — a colour picked to look like the
  joint between slabs. It now opens across the open paving between the wreck and the
  viewer, in a new, much darker `P.pavingCrack`.

**Measured against the timeline above** (headless probe, wall clock from the sixth egg):
impact 2.51s, head at rest 3.79s, camera home 4.62s, card up 4.91s. Every beat inside half a
second of target; the whole sequence runs ~4.9s rather than the 6s sketched.
