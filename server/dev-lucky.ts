import type { RelicGame } from '../lib/games/relic/engine.ts';
import {
  BOOKS,
  UPGRADES,
  bookExperience,
  bookXpAt,
  scratchFor,
  type PackId,
} from '../lib/games/relic/scratch.ts';
import {
  BLUEPRINTS,
  advanceFactory,
  type Dir,
  type MachineKind,
} from '../lib/games/relic/factory.ts';

/** A separate playable development desk. Never overwrites an existing run. */
export function seedLuckyWorkshop(game: RelicGame) {
  if (process.env.NODE_ENV !== 'development')
    throw new Error('Dev saves are only available in development.');
  const s = scratchFor(game);
  s.unlocked = BOOKS.map((b) => b.id);
  for (const u of UPGRADES)
    s.upgrades[u.id] = Math.min(u.max, Math.max(1, u.max - 1));
  // A busy showcase with queues and room to improve: fast printers, slower
  // bots, every book and complete routes for each working machine.
  s.upgrades.floor = 4;
  s.upgrades.printers = 7;
  s.upgrades.bots = 4;
  s.completed = 0;
  // Book levels 10–16 with ∞ open, part way to the next level; Crown Jewels
  // stays at level 3, most of the way to ∞, so its lock can be seen.
  BOOKS.forEach((b, i) => {
    const last = i === BOOKS.length - 1,
      lvl = last ? 3 : 10 + i;
    s.xp[b.id] = bookXpAt(s, lvl);
    s.xp[b.id]! += Math.floor(
      bookExperience(s, b.id).needed * (last ? 0.6 : 0.5),
    );
    s.books[b.id] = 25 + 30 * (lvl - 3);
    s.completed += s.books[b.id]!;
  });
  game.coins = 500_000_000_000_000_000;
  s.earned = game.coins;
  s.activeMs = 20 * 60 * 60 * 1000;
  const f = s.factory;
  f.blueprints = BLUEPRINTS.map((b) => b.id);
  const add = (
    kind: MachineKind,
    x: number,
    y: number,
    dir: Dir = 0,
    book: PackId = BOOKS[0].id,
  ) =>
    f.machines.push({
      kind,
      x,
      y,
      dir,
      book: kind === 'printer' ? book : undefined,
      t: 0,
      item: null,
      output: null,
    });
  const line = (x: number, y: number, kinds: MachineKind[], book: PackId) =>
    kinds.forEach((kind, offset) => add(kind, x + offset, y, 0, book));

  // Two straight routes across the top: marks stack before a sale, and a
  // bundle is a new ticket that can receive both marks of its own.
  line(
    0,
    1,
    ['printer', 'belt', 'stamper', 'bot', 'gilder', 'belt', 'cashier'],
    'seven',
  );
  line(
    8,
    1,
    [
      'printer',
      'belt',
      'bot',
      'bundler',
      'stamper',
      'gilder',
      'belt',
      'cashier',
    ],
    'twins',
  );

  // The splitter faces right. Its front, left and right outlets feed bots
  // facing right, up and down, each with a separate cashier at its outlet.
  line(1, 5, ['printer', 'belt', 'splitter', 'bot', 'cashier'], 'path');
  add('bot', 3, 4, 3);
  add('cashier', 3, 3);
  add('bot', 3, 6, 1);
  add('cashier', 3, 7);

  // The later books have short, independent routes on the right half.
  for (const [book, x, y] of [
    ['ladder', 8, 3],
    ['mine', 12, 3],
    ['sunmoon', 8, 5],
    ['chart', 12, 5],
    ['crown', 8, 7],
  ] as const)
    line(x, y, ['printer', 'bot', 'belt', 'cashier'], book);

  // Lamps and charms sit beside and between routes. The lamp at (2,4),
  // for example, reaches the Garden printer and its upper bot diagonally.
  for (const [x, y] of [
    [0, 0],
    [3, 0],
    [8, 0],
    [10, 0],
    [2, 4],
    [4, 6],
    [9, 2],
    [13, 2],
    [9, 4],
    [13, 4],
    [9, 6],
    [12, 6],
  ])
    add('lamp', x, y);
  for (const [x, y] of [
    [1, 0],
    [9, 0],
    [0, 4],
    [8, 2],
    [12, 2],
    [8, 4],
    [12, 4],
    [8, 6],
  ])
    add('charm', x, y);

  // A visibly unfinished side line; it prints and queues but cannot sell.
  line(0, 8, ['printer', 'belt', 'belt', 'belt'], 'twins');
  f.machines.sort((a, b) => a.y - b.y || a.x - b.x);
  // Fill real buffers by simulation so the saved floor is active on arrival.
  advanceFactory(game, 120_000);
}
