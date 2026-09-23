import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRelic, actRelic } from '../lib/games/relic/engine.ts';
import {
  PACKS,
  UPGRADES,
  actScratch,
  scratchFor,
  rubTicket,
  technique,
  ticketReward,
  botReward,
  level,
  upgradeCost,
  upgradeReady,
  nextBook,
  brushRadius,
  crownClue,
} from '../lib/games/relic/scratch.ts';
import {
  actFactory,
  advanceFactory,
  machinePrice,
  floorSize,
} from '../lib/games/relic/factory.ts';
import { openDatabase } from '../server/database.ts';
import { Expeditions } from '../server/expeditions.ts';
const start = 1789992000000;
const game = (seed = 123) =>
  createRelic('Our scratch desk', 'dunes', seed, start);
const actor = (id) => ({
  id,
  name: id,
  userId: null,
  sessionHash: 'test',
  expires: start + 1e12,
});
const sweep = () =>
  Array.from({ length: 66 }, (_, i) => ({
    x: i % 4 < 2 ? 0.005 : 0.995,
    y: 0.005 + Math.floor(i / 2) * 0.03,
  }));
function unlock(g, pack) {
  for (const p of PACKS) {
    if (!g.scratch.unlocked.includes(p.id)) g.scratch.unlocked.push(p.id);
    if (p.id === pack) break;
  }
}
function open(g, pack = 'pocket', who = 'Jo') {
  actScratch(g, { type: 'scratch-open', pack }, who, start);
  return g.scratch.tickets[who];
}
function finish(g, who = 'Jo') {
  const t = g.scratch.tickets[who];
  actScratch(
    g,
    {
      type: 'scratch-stroke',
      ticket: t.id,
      sequence: t.sequence,
      tool: 'coin',
      points: sweep(),
    },
    who,
    start,
  );
  assert.ok(t.cells.every((c) => c.revealed));
  return actScratch(g, { type: 'scratch-claim', ticket: t.id }, who, start);
}
function scratchCell(t, state, index, direction = 'h') {
  const p = PACKS.find((p) => p.id === t.pack),
    col = index % p.columns,
    row = Math.floor(index / p.columns);
  // Separate strokes stay inside a seal: moving between seals with the coin lifted.
  const points = [];
  for (let line = 0; line < 12; line++) {
    const across = 0.14 + line * 0.06,
      from = line % 2 ? 0.84 : 0.14,
      to = line % 2 ? 0.14 : 0.84;
    points.push(
      direction === 'h'
        ? { x: (col + from) / p.columns, y: (row + across) / p.rows }
        : { x: (col + across) / p.columns, y: (row + from) / p.rows },
    );
    points.push(
      direction === 'h'
        ? { x: (col + to) / p.columns, y: (row + across) / p.rows }
        : { x: (col + across) / p.columns, y: (row + to) / p.rows },
    );
  }
  rubTicket(t, state, points);
}

await test('held movement removes foil geometrically; dots and repeated strokes cannot mint coins', () => {
  const g = game(),
    t = open(g);
  assert.equal(g.coins, 0);
  const dot = {
    type: 'scratch-stroke',
    ticket: t.id,
    sequence: 0,
    points: [{ x: 0.5, y: 0.5 }],
  };
  actScratch(g, dot, 'Jo', start);
  assert.ok(t.cells.some((c) => c.mask.includes('1')));
  assert.ok(t.cells.every((c) => !c.revealed));
  assert.throws(
    () => actScratch(g, { type: 'scratch-claim', ticket: t.id }, 'Jo', start),
    /every seal/,
  );
  assert.throws(() => actScratch(g, dot, 'Jo', start), /syncing/);
  assert.throws(
    () => actScratch(g, { ...dot, sequence: 1, tool: 'edge' }, 'Jo', start),
    /coin/,
  );
  const result = finish(g);
  assert.ok(result.scratchCoins > 0);
  const coins = g.coins;
  actScratch(g, { type: 'scratch-claim', ticket: t.id }, 'Jo', start);
  assert.equal(g.coins, coins);
  assert.equal(g.scratch.completed, 1);
});
await test('fast strokes fill the entire intervening path, but lifting the coin never creates a bridge', () => {
  const g = game(),
    t = open(g);
  rubTicket(t, g.scratch, [
    { x: 0.05, y: 0.5 },
    { x: 0.95, y: 0.5 },
  ]);
  for (let i = 3; i < 6; i++) assert.ok(t.cells[i].mask.includes('1'));
  const other = open(game(4));
  rubTicket(other, g.scratch, [{ x: 0.05, y: 0.5 }]);
  rubTicket(other, g.scratch, [{ x: 0.95, y: 0.5 }]);
  assert.ok(!other.cells[4].mask.includes('1'));
});
await test('the first book is luck-only and free, with varying seeded rewards', () => {
  const rewards = new Set();
  for (let seed = 1; seed < 12; seed++) {
    const g = game(seed),
      t = open(g);
    rewards.add(finish(g).scratchCoins);
    assert.equal(t.quality, 0);
    open(g);
  }
  assert.ok(rewards.size > 3);
});
await test('books are bought in order with coins, from hundreds to hundreds of billions', () => {
  const g = game();
  assert.deepEqual(g.scratch.unlocked, ['pocket']);
  assert.throws(
    () => actScratch(g, { type: 'scratch-book', pack: 'garden' }, 'Jo', start),
    /order/,
  );
  assert.throws(
    () => actScratch(g, { type: 'scratch-book', pack: 'ribbon' }, 'Jo', start),
    /more coins/,
  );
  const prices = PACKS.map((p) => p.price);
  assert.equal(prices[0], 0);
  for (let i = 2; i < prices.length; i++)
    assert.ok(prices[i] / prices[i - 1] >= 20, PACKS[i].id);
  assert.ok(prices.at(-1) >= 1e11);
  g.coins = 1e14;
  for (const p of PACKS.slice(1)) {
    const before = g.coins;
    actScratch(g, { type: 'scratch-book', pack: p.id }, 'Jo', start);
    assert.equal(g.coins, before - p.price);
  }
  assert.equal(nextBook(g.scratch), undefined);
  assert.throws(
    () => actScratch(g, { type: 'scratch-book', pack: 'crown' }, 'Jo', start),
    /order/,
  );
});
await test('ordered ribbon sweeps earn a technique bonus over reversed sweeps', () => {
  const g = game();
  unlock(g, 'ribbon');
  const t = open(g, 'ribbon'),
    bad = structuredClone(t);
  for (let i = 0; i < t.cells.length; i++) scratchCell(t, g.scratch, i);
  for (let i = bad.cells.length - 1; i >= 0; i--)
    scratchCell(bad, g.scratch, i);
  assert.equal(technique(t, g.scratch), 1);
  assert.equal(technique(bad, g.scratch), 0);
  assert.ok(ticketReward(t, g.scratch) > ticketReward(bad, g.scratch));
});
await test('visible trail order and stamp matching reward deliberate scratch choices', () => {
  for (const pack of ['garden', 'twins']) {
    const g = game();
    unlock(g, pack);
    const t = open(g, pack),
      bad = structuredClone(t);
    const order =
      pack === 'garden'
        ? [
            ...t.trail,
            ...t.cells.map((_, i) => i).filter((i) => !t.trail.includes(i)),
          ]
        : t.cells
            .map((_, i) => i)
            .sort((a, b) => t.cells[a].symbol - t.cells[b].symbol);
    for (const i of order) scratchCell(t, g.scratch, i);
    for (const i of order.toReversed()) scratchCell(bad, g.scratch, i);
    assert.equal(technique(t, g.scratch), 1, pack);
    if (pack === 'garden') assert.ok(technique(bad, g.scratch) < 0.3);
  }
});
await test('foil grain measures stroke direction; atlas combines grain and visible routes', () => {
  for (const pack of ['grain', 'atlas']) {
    const g = game();
    unlock(g, pack);
    const t = open(g, pack),
      bad = structuredClone(t);
    const order =
      pack === 'atlas'
        ? [
            ...t.trail,
            ...t.cells.map((_, i) => i).filter((i) => !t.trail.includes(i)),
          ]
        : t.cells.map((_, i) => i);
    for (const i of order) scratchCell(t, g.scratch, i, t.cells[i].direction);
    for (const i of [...order].reverse())
      scratchCell(
        bad,
        g.scratch,
        i,
        bad.cells[i].direction === 'h' ? 'v' : 'h',
      );
    assert.ok(
      technique(t, g.scratch) > 0.8,
      `${pack}: ${technique(t, g.scratch)}`,
    );
    assert.ok(technique(bad, g.scratch) < 0.3);
  }
});
await test('the lantern pays for finding it early; crown clues count neighbouring crowns', () => {
  const g = game(9);
  unlock(g, 'crown');
  const lantern = open(g, 'lantern'),
    late = structuredClone(lantern);
  const at = lantern.cells.findIndex((c) => c.special);
  assert.equal(lantern.cells.filter((c) => c.special).length, 1);
  const rest = lantern.cells.map((_, i) => i).filter((i) => i !== at);
  for (const i of [at, ...rest]) scratchCell(lantern, g.scratch, i);
  for (const i of [...rest, at]) scratchCell(late, g.scratch, i);
  assert.equal(technique(lantern, g.scratch), 1);
  assert.equal(technique(late, g.scratch), 0);
  finish(g);
  const crown = open(g, 'crown'),
    crowns = crown.cells.flatMap((c, i) => (c.special ? [i] : []));
  assert.equal(crowns.length, 3);
  for (let i = 0; i < crown.cells.length; i++) {
    const col = i % 5,
      row = Math.floor(i / 5);
    const expected = crowns.filter(
      (j) =>
        j !== i &&
        Math.abs((j % 5) - col) <= 1 &&
        Math.abs(Math.floor(j / 5) - row) <= 1,
    ).length;
    assert.equal(crownClue(crown, i), expected);
  }
  const first = structuredClone(crown);
  for (const i of [
    ...crowns,
    ...crown.cells.map((_, i) => i).filter((i) => !crowns.includes(i)),
  ])
    scratchCell(first, g.scratch, i);
  assert.equal(technique(first, g.scratch), 1);
});
await test('every upgrade names one number and changes it; paths unlock in order up to every rank', () => {
  assert.equal(new Set(UPGRADES.map((u) => u.id)).size, UPGRADES.length);
  const g = game();
  g.coins = 1e300;
  assert.throws(
    () => actScratch(g, { type: 'scratch-upgrade', id: 'foil' }, 'Jo', start),
    /before it/,
  );
  assert.throws(
    () =>
      actScratch(g, { type: 'scratch-upgrade', id: 'printers' }, 'Jo', start),
    /before it|factory/,
  );
  actFactory(g, { type: 'factory-blueprint', id: 'starter' });
  for (const u of UPGRADES) {
    assert.ok(upgradeReady(g.scratch, u), u.id);
    const before = u.show(0);
    while (level(g.scratch, u.id) < u.max) {
      const cost = upgradeCost(g.scratch, u),
        coins = g.coins;
      actScratch(g, { type: 'scratch-upgrade', id: u.id }, 'Jo', start);
      assert.equal(g.coins, coins - cost);
    }
    assert.notEqual(u.show(u.max), before, u.id);
    assert.throws(
      () => actScratch(g, { type: 'scratch-upgrade', id: u.id }, 'Jo', start),
      /complete/,
    );
  }
  assert.ok(brushRadius(g.scratch) > 0.05);
  assert.deepEqual(floorSize(g.scratch), { width: 16, height: 9 });
  assert.throws(() =>
    actScratch(g, { type: 'scratch-upgrade', id: '__proto__' }, 'Jo', start),
  );
});
await test('bad strokes, locked books and unaffordable upgrades reject without changing rewards', () => {
  const g = game(),
    t = open(g),
    before = JSON.stringify(t);
  for (const points of [
    [],
    [{ x: NaN, y: 0.5 }],
    [{ x: 2, y: 0.5 }],
    Array(81).fill({ x: 0.5, y: 0.5 }),
  ])
    assert.throws(() =>
      actScratch(
        g,
        { type: 'scratch-stroke', ticket: t.id, sequence: 0, points },
        'Jo',
        start,
      ),
    );
  assert.equal(JSON.stringify(t), before);
  assert.throws(
    () => actScratch(g, { type: 'scratch-open', pack: 'pocket' }, 'Jo', start),
    /Finish/,
  );
  assert.throws(
    () => actScratch(g, { type: 'scratch-open', pack: 'atlas' }, 'Jo', start),
    /Unlock/,
  );
  assert.throws(
    () => actScratch(g, { type: 'scratch-upgrade', id: 'coin' }, 'Jo', start),
    /more coins/,
  );
});
await test('upgrades change what tickets pay; quick finish clears the last seals', () => {
  const g = game(),
    t = open(g);
  finish(g);
  const plain = ticketReward(t, g.scratch);
  for (const [id, completed] of [
    ['value', 0],
    ['foilpay', 0],
    ['tenth', 9],
    ['golden', 0],
  ]) {
    const other = structuredClone(g.scratch);
    other.upgrades[id] = 1;
    other.completed = completed;
    assert.ok(ticketReward(t, other) > plain, id);
  }
  g.scratch.upgrades.quick = 5;
  const q = open(g);
  for (let i = 0; i < 7; i++) scratchCell(q, g.scratch, i);
  assert.ok(q.cells.every((c) => c.revealed));
});
await test('old room investments are refunded exactly once while purse and keepsakes survive', () => {
  const g = game();
  delete g.scratch;
  g.coins = 123;
  g.arcade = {
    skills: { 'darts-power': 2, 'forge-auto': 1 },
    rooms: { forge: { unlocked: true }, bells: { unlocked: true } },
  };
  const s = scratchFor(g);
  assert.equal(s.migrationCredit, 25 + 47 + 180 + 350 + 1500);
  assert.equal(g.coins, 123 + s.migrationCredit);
  assert.equal(g.arcade, undefined);
  const coins = g.coins;
  scratchFor(g);
  assert.equal(g.coins, coins);
  assert.throws(() =>
    actRelic(g, { type: 'arcade-shot', room: 'darts' }, 'Jo', start),
  );
});

function line(g) {
  g.coins = 1e6;
  actFactory(g, { type: 'factory-blueprint', id: 'starter' });
  actFactory(g, {
    type: 'factory-build',
    pieces: [
      { kind: 'printer', x: 0, y: 0, dir: 0 },
      { kind: 'belt', x: 1, y: 0, dir: 0 },
      { kind: 'bot', x: 2, y: 0, dir: 0 },
      { kind: 'belt', x: 3, y: 0, dir: 0 },
      { kind: 'cashier', x: 4, y: 0, dir: 0 },
    ],
  });
  g.coins = 0;
}
await test('a printer, a bot and a cashier linked by belts sell scratched tickets', () => {
  const g = game();
  line(g);
  advanceFactory(g, 60000);
  const f = g.scratch.factory;
  // The bot is the bottleneck: one pocket ticket every 6 seconds.
  assert.ok(f.sold >= 9 && f.sold <= 10, String(f.sold));
  assert.ok(g.coins > 0);
  // Each sale pays the average ticket, three times for the odd star ticket.
  const each = botReward(g.scratch, 'pocket'),
    stars = Math.round((g.coins - f.sold * each) / (2 * each));
  assert.ok(Math.abs(g.coins - (f.sold + 2 * stars) * each) < 1e-6);
  assert.ok(f.machines.find((m) => m.kind === 'belt' && m.x === 1).item);
});
await test('layout matters: blank tickets never reach a cashier, turning a belt stops the line', () => {
  const g = game();
  g.coins = 1e6;
  actFactory(g, { type: 'factory-blueprint', id: 'starter' });
  actFactory(g, {
    type: 'factory-build',
    pieces: [
      { kind: 'printer', x: 0, y: 0, dir: 0 },
      { kind: 'belt', x: 1, y: 0, dir: 0 },
      { kind: 'cashier', x: 2, y: 0, dir: 0 },
    ],
  });
  const coins = g.coins;
  advanceFactory(g, 30000);
  assert.equal(g.coins, coins);
  assert.equal(g.scratch.factory.sold, 0);
  const h = game();
  line(h);
  actFactory(h, { type: 'factory-rotate', x: 3, y: 0 });
  advanceFactory(h, 30000);
  assert.equal(h.scratch.factory.sold, 0);
});
await test('lamps next to bots and a splitter to a second bot raise throughput', () => {
  const base = game();
  line(base);
  advanceFactory(base, 120000);
  const lit = game();
  line(lit);
  lit.coins = 1e7;
  actFactory(lit, { type: 'factory-blueprint', id: 'lamp' });
  actFactory(lit, {
    type: 'factory-build',
    pieces: [
      { kind: 'lamp', x: 2, y: 1, dir: 0 },
      { kind: 'lamp', x: 2, y: 2, dir: 0 },
    ],
  });
  advanceFactory(lit, 120000);
  assert.ok(lit.scratch.factory.sold > base.scratch.factory.sold * 1.25);
  const moved = game();
  line(moved);
  moved.coins = 1e7;
  actFactory(moved, { type: 'factory-blueprint', id: 'lamp' });
  actFactory(moved, {
    type: 'factory-build',
    pieces: [{ kind: 'lamp', x: 6, y: 3, dir: 0 }],
  });
  advanceFactory(moved, 120000);
  assert.equal(moved.scratch.factory.sold, base.scratch.factory.sold);
});
await test('building is paid, validated and atomic; removing refunds the last price', () => {
  const g = game();
  assert.throws(
    () =>
      actFactory(g, {
        type: 'factory-build',
        pieces: [{ kind: 'belt', x: 0, y: 0, dir: 0 }],
      }),
    /Buy/,
  );
  g.coins = 1000;
  actFactory(g, { type: 'factory-blueprint', id: 'starter' });
  assert.equal(g.coins, 0);
  g.coins = 2000;
  for (const pieces of [
    [{ kind: 'belt', x: 8, y: 0, dir: 0 }],
    [{ kind: 'belt', x: 0, y: 0, dir: 4 }],
    [
      { kind: 'belt', x: 0, y: 0, dir: 0 },
      { kind: 'belt', x: 0, y: 0, dir: 1 },
    ],
    [{ kind: 'lamp', x: 0, y: 0, dir: 0 }],
    [
      { kind: 'bot', x: 0, y: 0, dir: 0 },
      { kind: 'bot', x: 1, y: 0, dir: 0 },
    ],
  ])
    assert.throws(() => actFactory(g, { type: 'factory-build', pieces }));
  assert.equal(g.coins, 2000);
  assert.equal(g.scratch.factory.machines.length, 0);
  const price = machinePrice(g.scratch.factory, 'bot');
  actFactory(g, {
    type: 'factory-build',
    pieces: [{ kind: 'bot', x: 0, y: 0, dir: 0 }],
  });
  assert.ok(machinePrice(g.scratch.factory, 'bot') > price);
  actFactory(g, { type: 'factory-remove', cells: [{ x: 0, y: 0 }] });
  assert.equal(g.coins, 2000);
  assert.throws(
    () => actFactory(g, { type: 'factory-book', x: 0, y: 0, book: 'pocket' }),
    /no machine/,
  );
});
await test('printers print the chosen unlocked book, and better books sell for more', () => {
  const g = game();
  line(g);
  assert.throws(
    () => actFactory(g, { type: 'factory-book', x: 0, y: 0, book: 'ribbon' }),
    /Unlock/,
  );
  unlock(g, 'ribbon');
  actFactory(g, { type: 'factory-book', x: 0, y: 0, book: 'ribbon' });
  advanceFactory(g, 120000);
  assert.ok(g.coins > 5 * botReward(g.scratch, 'ribbon'));
  assert.ok(
    botReward(g.scratch, 'ribbon') > botReward(g.scratch, 'pocket') * 5,
  );
});
await test('version 1 saves keep their books and get their atlas ranks back', () => {
  const g = game();
  g.coins = 10;
  g.scratch = {
    version: 1,
    skills: { 'tools-0': 2, 'feature-ribbon': 1, 'feature-press': 1 },
    tickets: {},
    nextId: 4,
    completed: 30,
    earned: 999,
    activeMs: 0,
    pressEarned: 0,
    books: { pocket: 30 },
    best: 50,
    migrationCredit: 0,
  };
  const s = scratchFor(g);
  assert.equal(s.version, 2);
  assert.deepEqual(s.unlocked, ['pocket', 'ribbon']);
  assert.equal(s.migrationCredit, 16 + 23 + 160);
  assert.equal(g.coins, 10 + 199);
  assert.equal(s.completed, 30);
  scratchFor(g);
  assert.equal(g.coins, 209);
});
await test('server scratch sessions are per member, purchases are atomic, retries do not pay twice, and reloading keeps foil', () => {
  const db = openDatabase(':memory:');
  try {
    let e = new Expeditions(db);
    const host = actor('Jo'),
      guest = actor('Mara');
    const made = e.create(host, { title: 'Scratch', world: 'dunes' }, start);
    e.join(made.token, guest, start);
    const command = (who, action, id = randomUUID()) =>
      e.command(made.token, who, { requestId: id, action }, start);
    const h = command(host, { type: 'scratch-open', pack: 'pocket' }),
      gt = command(guest, { type: 'scratch-open', pack: 'pocket' });
    const ht = h.game.scratch.tickets.Jo;
    assert.notEqual(ht.id, gt.game.scratch.tickets.Mara.id);
    const stroke = {
        type: 'scratch-stroke',
        ticket: ht.id,
        sequence: 0,
        points: sweep(),
      },
      id = randomUUID();
    command(host, stroke, id);
    const repeated = command(host, stroke, id);
    assert.equal(repeated.game.scratch.tickets.Jo.sequence, 1);
    assert.equal(repeated.game.scratch.tickets.Mara.sequence, 0);
    assert.throws(() => command(guest, stroke), /changed/);
    e = new Expeditions(db);
    const resumed = e.get(made.token, host, start);
    assert.ok(resumed.game.scratch.tickets.Jo.cells.every((c) => c.revealed));
    const claim = { type: 'scratch-claim', ticket: ht.id },
      cid = randomUUID();
    const paid = command(host, claim, cid);
    const retry = command(host, claim, cid);
    assert.equal(retry.game.coins, paid.game.coins);
    assert.equal(retry.game.scratch.completed, 1);
    const old = paid.game;
    old.coins = 40;
    db.prepare('UPDATE expeditions SET state=? WHERE token=?').run(
      JSON.stringify(old),
      made.token,
    );
    command(host, { type: 'scratch-upgrade', id: 'coin' });
    assert.throws(
      () => command(guest, { type: 'scratch-upgrade', id: 'coin' }),
      /more coins/,
    );
    assert.equal(e.get(made.token, host, start).game.scratch.upgrades.coin, 1);
  } finally {
    db.close();
  }
});
await test('activity is counted once across members and tabs, with no earnings after absence or restart', () => {
  const db = openDatabase(':memory:');
  try {
    let e = new Expeditions(db);
    const host = actor('Jo'),
      guest = actor('Mara'),
      made = e.create(host, { title: 'Scratch', world: 'dunes' }, start);
    e.join(made.token, guest, start);
    line(made.game);
    db.prepare('UPDATE expeditions SET state=? WHERE token=?').run(
      JSON.stringify(made.game),
      made.token,
    );
    const reference = (ms) => {
      const copy = structuredClone(made.game);
      advanceFactory(copy, ms);
      return copy.coins;
    };
    const one = randomUUID(),
      two = randomUUID();
    const pulse = (who, id, ms, playing = true) =>
      e.activity(made.token, who, { sessionId: id, playing }, start + ms).game;
    const active = (g) => g.scratch.activeMs;
    assert.equal(active(pulse(host, one, 1000)), 0);
    assert.equal(active(pulse(guest, two, 1000)), 0);
    assert.equal(active(pulse(host, one, 2000)), 1000);
    assert.equal(active(pulse(guest, two, 2000)), 1000);
    pulse(host, one, 2500, false);
    assert.equal(active(pulse(guest, two, 3000)), 2000);
    pulse(guest, two, 4000, false);
    assert.equal(active(pulse(host, one, 86400000)), 2000);
    let g = pulse(host, one, 86401000);
    assert.equal(active(g), 3000);
    assert.equal(g.coins, reference(3000));
    e = new Expeditions(db);
    assert.equal(active(pulse(host, one, 86402000)), 3000);
    for (let s = 2; s < 40; s++) g = pulse(host, one, 86401000 + s * 1000);
    assert.equal(active(g), 41000);
    assert.equal(g.coins, reference(41000));
    assert.ok(g.coins > 0);
  } finally {
    db.close();
  }
});
await test('a player who scratches and builds simple factory lines reaches every book in hours, not minutes', () => {
  const g = game(7),
    s = g.scratch,
    reached = {};
  let lines = 0;
  function buy(minute) {
    for (let bought = true; bought;) {
      bought = false;
      const book = nextBook(s);
      if (book && g.coins >= book.price) {
        actScratch(g, { type: 'scratch-book', pack: book.id }, 'Jo', start);
        reached[book.id] = minute;
        for (const m of s.factory.machines)
          if (m.kind === 'printer')
            actFactory(g, {
              type: 'factory-book',
              x: m.x,
              y: m.y,
              book: book.id,
            });
        bought = true;
        continue;
      }
      if (!s.factory.blueprints.includes('starter')) {
        if (g.coins >= 1000) {
          actFactory(g, { type: 'factory-blueprint', id: 'starter' });
          bought = true;
        }
        continue;
      }
      const f = s.factory,
        cost =
          machinePrice(f, 'printer') +
          machinePrice(f, 'bot') +
          machinePrice(f, 'cashier') +
          machinePrice(f, 'belt') +
          machinePrice(f, 'belt', 1);
      if (
        lines < floorSize(s).height &&
        g.coins >= cost &&
        (!book || cost < book.price / 2)
      ) {
        const y = lines++;
        actFactory(g, {
          type: 'factory-build',
          pieces: [
            { kind: 'printer', x: 0, y, dir: 0 },
            { kind: 'belt', x: 1, y, dir: 0 },
            { kind: 'bot', x: 2, y, dir: 0 },
            { kind: 'belt', x: 3, y, dir: 0 },
            { kind: 'cashier', x: 4, y, dir: 0 },
          ],
        });
        bought = true;
        continue;
      }
      const u = UPGRADES.filter(
        (u) => upgradeReady(s, u) && level(s, u.id) < u.max,
      ).sort((a, b) => upgradeCost(s, a) - upgradeCost(s, b))[0];
      if (
        u &&
        g.coins >= upgradeCost(s, u) &&
        (!book || upgradeCost(s, u) < book.price / 4)
      ) {
        actScratch(g, { type: 'scratch-upgrade', id: u.id }, 'Jo', start);
        bought = true;
      }
    }
  }
  for (let minute = 1; minute <= 16 * 60 && nextBook(s); minute++) {
    for (let i = 0; i < 6; i++) {
      open(g, [...s.unlocked].pop());
      finish(g);
    }
    advanceFactory(g, 60000);
    buy(minute);
  }
  assert.equal(nextBook(s), undefined);
  assert.ok(reached.ribbon <= 15, `ribbon at ${reached.ribbon} min`);
  assert.ok(reached.twins >= 20, `twins at ${reached.twins} min`);
  assert.ok(reached.crown >= 4 * 60, `crown at ${reached.crown} min`);
});
