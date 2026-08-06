const KEY_SCORE = 'getegged.highscore';
const KEY_MUTED = 'getegged.muted';

/** Read a key, returning null on any failure (blocked, absent, private mode). */
function read(key) {
  try {
    return globalThis.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

/** Write a key, silently doing nothing on any failure. */
function write(key, value) {
  try {
    globalThis.localStorage?.setItem(key, String(value));
  } catch {
    /* storage unavailable: the game runs fine without persistence */
  }
}

export function loadHighScore() {
  const raw = Number.parseInt(read(KEY_SCORE) ?? '', 10);
  return Number.isFinite(raw) && raw > 0 ? raw : 0;
}

export function saveHighScore(score) {
  if (score > loadHighScore()) write(KEY_SCORE, Math.floor(score));
}

export function loadMuted() {
  return read(KEY_MUTED) === '1';
}

export function saveMuted(muted) {
  write(KEY_MUTED, muted ? '1' : '0');
}
