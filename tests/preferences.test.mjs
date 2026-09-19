import test from 'node:test';
import assert from 'node:assert/strict';
import { readSetup, saveSetup } from '../components/game/setup-preferences.ts';

await test('rules reset preserves setup preferences while splitting retained mechanics', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const values = new Map();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    },
  });
  try {
    const key = 'gamehub.setup.midnight.v1';
    values.set(
      key,
      JSON.stringify({
        nightMarket: true,
        players: 6,
        difficulty: 'hard',
        options: { contentSet: 'intermediate', marketSeasons: true },
      }),
    );
    const saved = readSetup('midnight');
    assert.equal(saved.customerOrders, true);
    assert.equal(saved.options.specialtyStalls, true);
    assert.equal(saved.options.marketSeasons, true);
    assert.equal(saved.options.contentSet, 'intermediate');
    assert.equal(saved.players, 6);
    assert.equal(saved.difficulty, 'hard');
    saveSetup('midnight', saved);
    assert.equal('nightMarket' in JSON.parse(values.get(key)), false);
    values.set(
      'gamehub.setup.wildgrove.v1',
      JSON.stringify({ wildTrails: true, options: { trailcraft: true } }),
    );
    const nature = readSetup('wildgrove');
    assert.equal(nature.sanctuaryGoalsEnabled, true);
    assert.equal(nature.options.roamEnabled, true);
    assert.equal(nature.options.migration, false);
    values.set(
      'gamehub.setup.undertow.v1',
      JSON.stringify({ starter: true, fastMode: true }),
    );
    const tide = readSetup('undertow');
    assert.equal(tide.shields, true);
    assert.equal(tide.fastMode, true);
    assert.equal(tide.options.salvage, false);
    values.set(
      key,
      JSON.stringify({
        nightMarket: true,
        customerOrders: false,
        options: { specialtyStalls: false },
      }),
    );
    assert.equal(readSetup('midnight').customerOrders, false);
    assert.equal(readSetup('midnight').options.specialtyStalls, false);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else delete globalThis.localStorage;
  }
});
