import test from 'node:test';
import assert from 'node:assert/strict';
import {
  habitatsFor,
  zoneScore,
  placementDieRule,
  dice,
} from '../lib/games/trio/engine.ts';
import {
  moraMapFor,
  habitatRelationships,
} from '../lib/games/trio/mora-map.ts';

const cards = (kinds) =>
  kinds.map((kind, id) => ({ id: `test-${id}`, kind, rank: 1 }));
for (const set of ['beginner', 'intermediate']) {
  await test(`${set} printed maxima agree with scoring for every local arrangement`, () => {
    // The beginner Glasshouse trail echoes other habitats, so it is checked below.
    for (let zone = 0; zone < (set === 'beginner' ? 3 : 4); zone++) {
      const habitat = habitatsFor(set)[zone];
      let max = 0;
      const visit = (kinds) => {
        const zones = Array.from({ length: 7 }, () => []);
        zones[zone] = cards(kinds);
        max = Math.max(max, zoneScore(zones, zone, set));
        if (kinds.length < habitat.cap)
          for (let kind = 0; kind < 6; kind++) visit([...kinds, kind]);
      };
      visit([]);
      assert.equal(max, habitat.maxScore, habitat.name);
    }
    const zones = Array.from({ length: 7 }, () => []);
    if (set === 'beginner') {
      zones[3] = cards([0, 1, 2]);
      zones[4] = cards([0, 1, 2]);
      zones[0] = cards([0, 1, 2]);
    } else {
      // Every cave creature echoes three of its species elsewhere.
      zones[4] = cards([0, 0, 0, 0]);
      zones[0] = cards([0, 0, 0]);
    }
    assert.equal(zoneScore(zones, 4, set), habitatsFor(set)[4].maxScore);
    if (set === 'beginner')
      assert.equal(zoneScore(zones, 3, set), habitatsFor(set)[3].maxScore);
    for (const zone of [0, 1, 2, 3, 4])
      zones[zone] = cards([set === 'beginner' ? 0 : 1]);
    zones[6] = cards(set === 'beginner' ? [0] : [0, 2]);
    assert.equal(zoneScore(zones, 6, set), habitatsFor(set)[6].maxScore);
  });
  await test(`${set} die descriptions name destinations without removed board glyphs`, () => {
    dice.forEach((die, face) => {
      const rule = placementDieRule(face, set);
      for (const zone of die.zones)
        assert.ok(rule.includes(habitatsFor(set)[zone].name));
      assert.doesNotMatch(rule, /marked with/);
    });
  });
  await test(`${set} scoring symbols stay between the appropriate pair spaces`, () => {
    const map = moraMapFor(set);
    const pair = map.habitats.find((h) => h.zone === 2);
    const mid = (a, b) => [
      (pair.slots[a][0] + pair.slots[b][0]) / 2,
      (pair.slots[a][1] + pair.slots[b][1]) / 2,
    ];
    // Root hollows are one pair; Mangrove roots want all three alike.
    assert.deepEqual(
      habitatRelationships(pair, set),
      (set === 'beginner' ? [[0, 1]] : [[0, 1], [1, 2]]).map(([a, b]) => ({ at: mid(a, b), symbol: '=' })),
    );
  });
}
