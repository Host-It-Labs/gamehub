import test from 'node:test';
import assert from 'node:assert/strict';
import { cards } from '../lib/games/arena/cards.ts';
import {
  DRAFT_ROUNDS,
  LOCKED,
  START_DECK,
  isAirAnswer,
  isWinCard,
  newQuest,
  playableDeck,
  questAct,
  upgradeQuest,
  validQuest,
} from '../lib/games/arena/quest.ts';

/** Drafts a run to the map, taking the bundle `choose` picks each round. */
function draft(q, choose = () => 0) {
  const offers = [];
  while (q.screen.kind === 'draft') {
    offers.push(q.screen.bundles);
    q = questAct(q, { type: 'bundle', bundle: choose(q.screen) });
    assert.ok(q);
  }
  return { q, offers };
}

await test('a quest starts with a draft of three rounds of three pairs', () => {
  const q = newQuest(7);
  assert.equal(q.screen.kind, 'draft');
  assert.equal(q.screen.round, 0);
  assert.deepEqual(q.deck, []);
  assert.deepEqual(q.charms, []);
  const { q: after, offers } = draft(q, (s) => s.round % 3);
  assert.equal(offers.length, DRAFT_ROUNDS);
  for (const bundles of offers) {
    assert.equal(bundles.length, 3);
    for (const b of bundles) assert.equal(b.length, 2);
    // Six different cards in each round.
    assert.equal(new Set(bundles.flat()).size, 6);
  }
  assert.equal(after.deck.length, 6);
  assert.equal(new Set(after.deck).size, 6);
  assert.equal(after.screen.kind, 'map');
  // Each pick added exactly the two cards of the bundle taken.
  offers.forEach((bundles, i) =>
    assert.deepEqual(after.deck.slice(i * 2, i * 2 + 2), bundles[i % 3]),
  );
});

await test('the offers follow the seed, so every device agrees', () => {
  for (const seed of [1, 99, 123456]) {
    const a = draft(newQuest(seed), (s) => (s.round + 1) % 3);
    const b = draft(newQuest(seed), (s) => (s.round + 1) % 3);
    assert.deepEqual(a.offers, b.offers);
    assert.deepEqual(a.q, b.q);
  }
  assert.notDeepEqual(
    newQuest(1).screen.bundles,
    newQuest(2).screen.bundles,
    'different seeds, different offers',
  );
});

await test('whatever is taken, the deck ends playable', () => {
  // Every path through the three rounds, for many seeds.
  for (let seed = 1; seed <= 120; seed++) {
    const unlocked = seed % 4 === 0 ? LOCKED : [];
    const walk = (q) => {
      if (q.screen.kind !== 'draft') {
        assert.equal(q.deck.length, 6, `seed ${seed}`);
        assert.ok(
          playableDeck(q.deck),
          `seed ${seed}: ${q.deck.join(', ')} is not playable`,
        );
        assert.ok(q.deck.some(isWinCard) && q.deck.some(isAirAnswer));
        return;
      }
      for (let i = 0; i < q.screen.bundles.length; i++)
        walk(questAct(q, { type: 'bundle', bundle: i }));
    };
    walk(newQuest(seed, 1, unlocked));
  }
});

await test('cards still locked are never offered; unlocked ones may be', () => {
  let seenUnlocked = false;
  for (let seed = 1; seed <= 200; seed++) {
    const { offers } = draft(newQuest(seed), () => seed % 3);
    for (const c of offers.flat(2)) {
      assert.ok(!LOCKED.includes(c), `seed ${seed} offered locked ${c}`);
      assert.ok(c in cards);
    }
    const open = draft(newQuest(seed, 1, LOCKED)).offers.flat(2);
    if (open.some((c) => LOCKED.includes(c))) seenUnlocked = true;
  }
  assert.ok(seenUnlocked, 'unlocked cards join the draft');
});

await test('the choices are hard: rounds mix standouts, tanks, air and the Meteor', () => {
  let tankVsAir = 0;
  let meteorVsTroops = 0;
  for (let seed = 1; seed <= 300; seed++) {
    const { offers } = draft(newQuest(seed));
    for (const bundles of offers) {
      // A tank or win condition with nothing for the air, against two
      // bundles that each bring an air answer.
      const bare = bundles.filter(
        (b) => b.some(isWinCard) && !b.some(isAirAnswer),
      );
      const air = bundles.filter((b) => b.some(isAirAnswer));
      if (bare.length === 1 && air.length === 2) tankVsAir++;
      if (bundles.some((b) => b.includes('meteor'))) meteorVsTroops++;
    }
  }
  assert.ok(tankVsAir > 50, `tank against air ${tankVsAir}`);
  assert.ok(meteorVsTroops > 50, `meteor offered ${meteorVsTroops}`);
});

await test('only the draft takes bundles, and only ones on offer', () => {
  const q = newQuest(3);
  assert.equal(questAct(q, { type: 'bundle', bundle: 3 }), null);
  assert.equal(questAct(q, { type: 'bundle', bundle: -1 }), null);
  const { q: map } = draft(q);
  assert.equal(questAct(map, { type: 'bundle', bundle: 0 }), null);
  // The state it came from is untouched.
  assert.deepEqual(q.deck, []);
  // A run in its draft saves and loads like any other.
  const half = questAct(q, { type: 'bundle', bundle: 1 });
  assert.ok(validQuest(JSON.parse(JSON.stringify(half))));
});

await test('a run saved on the old charm pick loads into the draft', () => {
  // The shape saved before 1 October 2026: the fixed six and a charm pick.
  const old = JSON.parse(JSON.stringify(newQuest(11)));
  old.deck = [...START_DECK];
  old.screen = { kind: 'start', offers: ['well', 'brew', 'walls'] };
  assert.ok(validQuest(old));
  const up = upgradeQuest(old);
  assert.equal(up.screen.kind, 'draft');
  assert.equal(up.screen.round, 0);
  assert.deepEqual(up.deck, []);
  assert.deepEqual(up.stops, old.stops, 'the map is kept');
  // It plays on to a playable six.
  const { q } = draft(up, () => 2);
  assert.equal(q.deck.length, 6);
  assert.ok(playableDeck(q.deck));
  // Runs past the start are left as they were.
  assert.equal(upgradeQuest(q), q);
});
