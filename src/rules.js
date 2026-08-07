import { FIGURES, ROUND, SCORE } from './config.js';

/** Hits needed out of ROUND.TARGETS_PER_ROUND to advance past `round`. */
export function quotaForRound(round) {
  const tier = ROUND.QUOTA_TIERS.find(([upToRound]) => round <= upToRound);
  // Fall back to demanding every target if the tiers are ever edited into a gap,
  // so a malformed config fails loudly in play rather than returning undefined.
  return tier ? tier[1] : ROUND.TARGETS_PER_ROUND;
}

/** Cumulative flight-speed multiplier, clamped so late rounds stay playable. */
export function speedMultiplier(round) {
  const raw = ROUND.SPEED_RAMP ** (round - 1);
  return Math.min(raw, ROUND.SPEED_CAP);
}

/** How long a politician stays on screen before escaping, in milliseconds. */
export function escapeMsForRound(round) {
  const raw = ROUND.ESCAPE_MS_BASE - (round - 1) * ROUND.ESCAPE_MS_STEP;
  return Math.max(raw, ROUND.ESCAPE_MS_MIN);
}

/**
 * Is `round` the last one? Clearing it wins the game rather than starting the next.
 * Failing it is still an ordinary game over — winning is the only thing this changes.
 */
export function isFinalRound(round) {
  return round >= ROUND.FINAL_ROUND;
}

/** Politicians released together: singles early, pairs from PAIRS_FROM_ROUND. */
export function targetsPerRelease(round) {
  return round >= ROUND.PAIRS_FROM_ROUND ? 2 : 1;
}

/** Points for egging `figureId`, with the first-egg bonus applied if earned. */
export function scoreForHit(figureId, isFirstEgg) {
  const figure = FIGURES.find((f) => f.id === figureId);
  if (!figure) throw new Error(`unknown figure: ${figureId}`);
  const bonus = isFirstEgg ? 1 + SCORE.FIRST_EGG_BONUS : 1;
  return Math.round(figure.points * bonus);
}

/** Decoy penalty. Score never goes negative. */
export function applyPenalty(score) {
  return Math.max(0, score - SCORE.DECOY_PENALTY);
}

/** Inclusive point-in-rectangle test. */
export function pointInBox(px, py, box) {
  return px >= box.x && px <= box.x + box.w && py >= box.y && py <= box.y + box.h;
}

/** Did the player meet this round's quota? */
export function roundPassed(hits, round) {
  return hits >= quotaForRound(round);
}
