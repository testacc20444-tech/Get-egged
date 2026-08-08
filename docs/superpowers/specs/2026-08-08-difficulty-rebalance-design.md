# Difficulty rebalance — the round-3 pair cliff

## The problem

From round 3 `targetsPerRelease` returns 2, but `release()` in `state.js` sets
`g.eggsLeft = ROUND.EGGS_PER_RELEASE` — a constant — however many politicians it just
put on screen. Eggs per target therefore halves from 3.0 to 1.5 at exactly the round
the quota rises from 6 to 7 and the speed multiplier passes 1.17. Four difficulty knobs
turn against the player on the same round, and the largest of them is invisible in the
config because it is emergent rather than written down.

`state.js:336` compounds it: the instant the last egg lands, every surviving target
flees, so a pair where one throw missed is a guaranteed lost target with no recovery.

### Measured, not guessed

500 simulated runs per skill level, driving the real engine (`state.js`) with a
synthetic player that leads the target and reads the sine bob. Aim error is Gaussian;
"good" is ±8px with decent bob tracking, "casual" ±12px with poor tracking.

| config | expert | good | casual | poor |
|---|---|---|---|---|
| as shipped | 69% | 3% | **0%** | 0% |
| chosen | 99% | 90% | 25% | 0.4% |

As shipped, a casual player wins **zero** runs out of 500 and dies on round 3 in 53% of
them. That is the reported bug, reproduced.

Two further findings shaped the fix:

- **The escape window is inert.** Lengthening it (`ESCAPE_MS_BASE` 4200→4800,
  `MIN` 1800→2600) changed the outcome at *every* skill level by 0.0%. Targets are
  hit or they fly off the edge; they almost never time out. Do not touch it.
- **Eggs and quota fix different players.** More eggs moves the casual wall
  (median round 3 → 10) but barely helps a good player. A softer quota takes a good
  player from 3% to 65% but leaves the casual wall exactly where it was.

## The design

### 1. Eggs follow targets, not releases

`ROUND.EGGS_PER_RELEASE: 3` becomes `ROUND.EGGS_PER_TARGET: 3`, and `release()` sets
`g.eggsLeft = count * ROUND.EGGS_PER_TARGET`.

A single target still gets 3, a pair gets 6, and eggs-per-target is now constant across
all twelve rounds. This is a structural fix rather than a compensating one: moving
`PAIRS_FROM_ROUND`, or a release that spawns one target because only one is left in the
round, can no longer reintroduce the cliff.

`g.eggsTotal` becomes per-release state (set in `release()`, reset in `startRound`)
because `hudView` can no longer read the total off the config.

### 2. A quota curve written for the pair game

`[[2,6],[5,7],[9,8],[∞,9]]` → `[[2,6],[5,6],[9,7],[∞,8]]`

The old curve was calibrated when every target got three eggs. Asking for 9 of 10 on
round 12 is why even a near-perfect player topped out at 69%.

### 3. Aim forgiveness

- `FEEL.HIT_PAD: 2` — px added to each side of the box an egg is tested against.
- `FEEL.BOB_AMPLITUDE: 0.06 → 0.045`.

The bob moves a figure up to ~30px vertically during an egg's 350ms flight, which is
larger than Balla's entire 22px hitbox; it is the single hardest thing to read and the
thing weak players read worst. Both levers help a poor aim far more than a good one,
which is what lifts casual players without making the game trivial for good ones — the
eggs-and-quota changes alone cannot do that, they only move everyone up together.

The pad gets its own `hitBox()` in `target.js` and is used **only** by `resolveLanding`.
It deliberately does not widen `targetBox()`, which `updateTarget` also uses for the
entry gate — padding that would make a figure take longer to count as "arrived" and
would quietly change escape timing.

### 4. HUD

Eggs are drawn at `236 + i * 9` with radius 3 and the hit-o-meter starts at `x = 276`.
Six eggs would end at 284 and overlap the pips, so the spacing goes 9 → 7 (six eggs end
at 274). The row visibly growing when pairs start is a feature, not a cost.

## Testing

Pure logic, `node:test`, per the project's existing split:

- A release hands out `count × EGGS_PER_TARGET`: 3 for a single, 6 for a pair.
- **The invariant that was silently violated:** for every round 1–12, driving a real
  release leaves `eggsLeft / targets.length === EGGS_PER_TARGET`.
- `hitBox` accepts a point outside the sprite but within the pad, rejects one beyond it,
  and `targetBox` — the entry gate — is unchanged by the pad.
- `hudView.eggsTotal` tracks the current release rather than a constant.
- Existing quota assertions in `rules.test.js` updated to the new curve.

Rendering has no permanent harness by project convention, so the HUD spacing gets a
throwaway stub-context check rather than a committed test.

## Explicitly not doing

- Touching the escape window or `PAIRS_FROM_ROUND` — measured as inert and unnecessary.
- Changing the flee-on-last-egg rule. With 6 eggs for a pair it stops being punishing,
  and it is what keeps a round moving.
