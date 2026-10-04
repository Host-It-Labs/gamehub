import test from 'node:test';
import assert from 'node:assert/strict';
import { cards } from '../lib/games/arena/cards.ts';
import { createMatch } from '../lib/games/arena/engine.ts';
import {
  DECK_MAX,
  LOCKED,
  ROWS,
  START_DECK,
  battleSetup,
  charms,
  newQuest,
  playerBoost,
  questAct,
  reachable,
  validQuest,
} from '../lib/games/arena/quest.ts';

const stopOf = (q, id) => q.stops.find((s) => s.id === id);
// A run past its draft (the draft itself: arena-quest-start.test.mjs),
// holding the fixed six the older tests were written for.
const begin = (seed = 5, players = 1, unlocked = []) => {
  let q = newQuest(seed, players, unlocked);
  while (q.screen.kind === 'draft')
    q = questAct(q, { type: 'bundle', bundle: 0 });
  q.deck = [...START_DECK];
  return q;
};

await test('a run starts with an empty deck, three hearts, no charm and a draft', () => {
  const q = newQuest(1);
  assert.deepEqual(q.deck, []);
  assert.equal(q.hearts, 3);
  assert.deepEqual(q.charms, []);
  assert.equal(q.screen.kind, 'draft');
  assert.equal(questAct(q, { type: 'charm', charm: 'well' }), null);
});

await test('every map is walkable from the first row to its boss', () => {
  for (let seed = 1; seed <= 60; seed++) {
    const q = newQuest(seed);
    const boss = q.stops.find((s) => s.kind === 'boss');
    assert.ok(boss && boss.row === ROWS);
    // Every stop is reachable from row 0 and leads on to the boss.
    const seen = new Set(q.stops.filter((s) => s.row === 0).map((s) => s.id));
    for (let row = 0; row < ROWS; row++)
      for (const s of q.stops.filter((x) => x.row === row && seen.has(x.id)))
        for (const n of s.next) seen.add(n);
    assert.equal(seen.size, q.stops.length, `seed ${seed}`);
    for (const s of q.stops) {
      if (s.kind !== 'boss') assert.ok(s.next.length >= 1);
      for (const n of s.next) assert.equal(stopOf(q, n).row, s.row + 1);
      if (['battle', 'elite', 'boss'].includes(s.kind)) assert.ok(s.foe);
    }
    assert.ok(q.stops.some((s) => s.row === ROWS - 1 && s.kind === 'camp'));
    assert.ok(q.stops.some((s) => s.kind === 'shop'));
  }
});

await test('a won battle pays gold and offers new cards or an upgrade', () => {
  let q = begin(9);
  const first = reachable(q)[0];
  assert.equal(stopOf(q, first).kind, 'battle');
  q = questAct(q, { type: 'go', stop: first });
  assert.equal(q.screen.kind, 'battle');
  assert.equal(questAct(q, { type: 'go', stop: first }), null);
  q = questAct(q, { type: 'result', won: true, crowns: 2 });
  assert.equal(q.screen.kind, 'reward');
  assert.ok(q.gold >= 30);
  assert.equal(q.screen.offers.length, 3);
  const card = q.screen.offers.findIndex((o) => o.kind === 'card');
  const picked = q.screen.offers[card].card;
  q = questAct(q, { type: 'take', offer: card });
  assert.ok(q.deck.includes(picked));
  assert.equal(q.screen.kind, 'map');
  assert.ok(reachable(q).every((id) => stopOf(q, id).row === 1));
});

await test('a lost battle costs a heart; the last heart ends the run', () => {
  let q = begin(3);
  for (let heart = 3; heart > 0; heart--) {
    const next = reachable(q).find((id) => stopOf(q, id).foe);
    if (next === undefined) break;
    q = questAct(q, { type: 'go', stop: next });
    q = questAct(q, { type: 'result', won: false, crowns: 0 });
    assert.equal(q.hearts, heart - 1);
    if (q.screen.kind === 'lost') break;
    q = questAct(q, { type: 'skip' });
  }
  if (q.hearts === 0) assert.equal(q.screen.kind, 'lost');
});

await test('a full deck swaps a card for a new one', () => {
  let q = begin(4);
  q.deck = [
    'imps',
    'archers',
    'pirate',
    'gladiator',
    'ranger',
    'meteor',
    'ogre',
    'mage',
  ];
  q.screen = {
    kind: 'reward',
    stop: 0,
    won: true,
    gold: 0,
    offers: [{ kind: 'card', card: 'drake' }],
    boss: false,
  };
  q = questAct(q, { type: 'take', offer: 0 });
  assert.equal(q.screen.kind, 'swap');
  q = questAct(q, { type: 'swap', out: 'ogre' });
  assert.ok(q.deck.includes('drake') && !q.deck.includes('ogre'));
  assert.equal(q.deck.length, DECK_MAX);
});

await test('camps rest or train, shops sell and remove', () => {
  const q = begin(6);
  q.hearts = 2;
  q.screen = { kind: 'camp', stop: 0 };
  assert.equal(questAct(q, { type: 'rest' }).hearts, 3);
  assert.equal(questAct(q, { type: 'train', card: 'imps' }).levels.imps, 2);
  assert.equal(questAct(q, { type: 'train', card: 'viking' }), null);
  q.gold = 500;
  q.screen = {
    kind: 'shop',
    stop: 0,
    wares: [
      { kind: 'card', card: 'drake', price: 65, sold: false },
      { kind: 'charm', charm: 'walls', price: 110, sold: false },
    ],
  };
  let s = questAct(q, { type: 'buy', ware: 0 });
  assert.ok(s.deck.includes('drake'));
  assert.equal(s.gold, 435);
  assert.equal(questAct(s, { type: 'buy', ware: 0 }), null, 'sold');
  s = questAct(s, { type: 'buy', ware: 1 });
  assert.ok(s.charms.includes('walls'));
  s = questAct(s, { type: 'remove', card: 'imps' });
  assert.ok(!s.deck.includes('imps'));
  assert.equal(s.screen.kind, 'shop');
  s = questAct(s, { type: 'leave' });
  assert.equal(s.screen.kind, 'map');
});

await test('charms and levels become the battle’s boosts; the foe gets its own', () => {
  const q = begin(8);
  q.charms = ['walls', 'hide', 'steel', 'well'];
  q.levels = { imps: 3 };
  const b = playerBoost(q);
  assert.equal(b.towerHp, 1.25);
  assert.ok(Math.abs(b.troopHp - 1.12) < 1e-9);
  assert.equal(b.elixirStart, 9);
  assert.equal(b.levels.imps, 3);
  const stop = q.stops.find((s) => s.foe);
  const setup = battleSetup(q, stop);
  assert.equal(setup.mode, 'duel');
  assert.equal(setup.options.regulation, 120);
  const m = createMatch(1, setup.difficulty, setup.mode, setup.options);
  assert.deepEqual([...m.players[0].deck].sort(), [...q.deck].sort());
  assert.equal(m.players[0].elixir, 9);
  // Two players share the run and fight two against two.
  const duo = begin(8, 2);
  const team = battleSetup(
    duo,
    duo.stops.find((s) => s.foe),
  );
  assert.equal(team.mode, 'team');
  assert.equal(team.options.decks.length, 4);
  for (const id of Object.keys(charms))
    assert.ok(charms[id].name && charms[id].text);
});

await test('beating a boss moves on, heals and unlocks a card', () => {
  let q = begin(12);
  const boss = q.stops.find((s) => s.kind === 'boss');
  q.at = q.stops.find((s) => s.next.includes(boss.id)).id;
  q.hearts = 2;
  q = questAct(q, { type: 'go', stop: boss.id });
  q = questAct(q, { type: 'result', won: true, crowns: 3 });
  assert.equal(q.hearts, 3);
  assert.deepEqual(q.unlocked, [LOCKED[0]]);
  assert.ok(q.pool.includes(LOCKED[0]));
  assert.ok(q.screen.offers.every((o) => o.kind === 'charm'));
  q = questAct(q, { type: 'skip' });
  assert.equal(q.region, 1);
  assert.equal(q.at, null);
  assert.equal(q.screen.kind, 'map');
  // The third boss ends the run in victory.
  q.region = 2;
  const last = q.stops.find((s) => s.kind === 'boss');
  q.at = q.stops.find((s) => s.next.includes(last.id)).id;
  q = questAct(q, { type: 'go', stop: last.id });
  q = questAct(q, { type: 'result', won: true, crowns: 1 });
  q = questAct(q, { type: 'skip' });
  assert.equal(q.screen.kind, 'won');
});

await test('a whole run can be played through with random choices', () => {
  for (let seed = 1; seed <= 40; seed++) {
    let q = begin(seed, 1, seed % 2 ? LOCKED : []);
    let rng = seed;
    const r = () => (rng = (rng * 1103515245 + 12345) >>> 0) / 4294967296;
    for (let n = 0; n < 200 && !['won', 'lost'].includes(q.screen.kind); n++) {
      const s = q.screen;
      const tries =
        s.kind === 'map'
          ? reachable(q).map((stop) => ({ type: 'go', stop }))
          : s.kind === 'battle'
            ? [{ type: 'result', won: r() < 0.75, crowns: Math.floor(r() * 4) }]
            : s.kind === 'reward'
              ? [
                  ...s.offers.map((_, offer) => ({ type: 'take', offer })),
                  { type: 'skip' },
                ]
              : s.kind === 'swap'
                ? [
                    { type: 'swap', out: q.deck[0] },
                    { type: 'swap', out: null },
                  ]
                : s.kind === 'camp'
                  ? [
                      { type: 'rest' },
                      ...q.deck.map((card) => ({ type: 'train', card })),
                      { type: 'leave' },
                    ]
                  : s.kind === 'shop'
                    ? [
                        ...s.wares.map((_, ware) => ({ type: 'buy', ware })),
                        { type: 'leave' },
                      ]
                    : [
                        { type: 'choose', option: 0 },
                        { type: 'choose', option: 1 },
                      ];
      const order = tries.sort(() => r() - 0.5);
      const next = order.map((a) => questAct(q, a)).find(Boolean);
      assert.ok(next, `stuck on ${s.kind} (seed ${seed})`);
      q = next;
      assert.ok(q.deck.length >= 5 && q.deck.length <= DECK_MAX);
      assert.ok(q.deck.every((c) => c in cards));
      assert.equal(new Set(q.deck).size, q.deck.length);
      assert.ok(q.gold >= 0, `gold ${q.gold}`);
    }
    assert.ok(
      ['won', 'lost'].includes(q.screen.kind),
      `seed ${seed} ended on ${q.screen.kind}`,
    );
    assert.ok(validQuest(JSON.parse(JSON.stringify(q))));
  }
});
