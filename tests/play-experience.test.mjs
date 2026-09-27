import test from 'node:test';
import assert from 'node:assert/strict';
import {
  readCompletedGames,
  recordCompletedGame,
} from '../components/game/play-experience.ts';

await test('learning familiarity is per game, counts completions and caps at two', () => {
  let stored = null;
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: () => stored,
      setItem: (_key, value) => {
        stored = value;
      },
    },
  });
  try {
    assert.equal(readCompletedGames('Yata'), 0);
    recordCompletedGame('Yata');
    assert.equal(readCompletedGames('Yata'), 1);
    assert.equal(readCompletedGames('Mora'), 0);
    recordCompletedGame('Yata');
    recordCompletedGame('Yata');
    assert.equal(readCompletedGames('Yata'), 2);
    recordCompletedGame('Mora');
    assert.equal(readCompletedGames('Mora'), 1);
    assert.equal(readCompletedGames('Yata'), 2);
    for (const invalid of [
      'broken',
      'null',
      '[]',
      '{"Yata":-1}',
      '{"Yata":"2"}',
    ]) {
      stored = invalid;
      assert.equal(readCompletedGames('Yata'), 0);
    }
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('Storage blocked');
      },
    });
    assert.equal(readCompletedGames('Yata'), 0);
    assert.doesNotThrow(() => recordCompletedGame('Yata'));
  } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else delete globalThis.localStorage;
  }
});
