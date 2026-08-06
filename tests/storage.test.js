import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { loadHighScore, saveHighScore, loadMuted, saveMuted } from '../src/storage.js';

function installStorage(impl) {
  globalThis.localStorage = impl;
}

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v))
  };
}

beforeEach(() => { delete globalThis.localStorage; });

test('high score is 0 when nothing is stored', () => {
  installStorage(memoryStorage());
  assert.equal(loadHighScore(), 0);
});

test('high score round-trips', () => {
  installStorage(memoryStorage());
  saveHighScore(4200);
  assert.equal(loadHighScore(), 4200);
});

test('saveHighScore keeps the larger value', () => {
  installStorage(memoryStorage());
  saveHighScore(4200);
  saveHighScore(100);
  assert.equal(loadHighScore(), 4200);
  saveHighScore(9001);
  assert.equal(loadHighScore(), 9001);
});

test('garbage in storage reads as 0', () => {
  const store = memoryStorage();
  store.setItem('getegged.highscore', 'not-a-number');
  installStorage(store);
  assert.equal(loadHighScore(), 0);
});

test('mute flag round-trips and defaults to false', () => {
  installStorage(memoryStorage());
  assert.equal(loadMuted(), false);
  saveMuted(true);
  assert.equal(loadMuted(), true);
  saveMuted(false);
  assert.equal(loadMuted(), false);
});

test('a throwing localStorage does not propagate', () => {
  installStorage({
    getItem() { throw new Error('blocked'); },
    setItem() { throw new Error('blocked'); }
  });
  assert.equal(loadHighScore(), 0);
  assert.equal(loadMuted(), false);
  assert.doesNotThrow(() => saveHighScore(500));
  assert.doesNotThrow(() => saveMuted(true));
});

test('a missing localStorage does not throw', () => {
  assert.equal(loadHighScore(), 0);
  assert.doesNotThrow(() => saveHighScore(500));
});
