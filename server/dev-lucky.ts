import type { RelicGame } from '../lib/games/relic/engine.ts';
import {
  BOOKS,
  BOOK_LEVEL_STEP,
  EARLY,
  UPGRADES,
  scratchFor,
} from '../lib/games/relic/scratch.ts';
import {
  BLUEPRINTS,
  advanceFactory,
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
  // A big, busy workshop with queues and room to improve: too many fast
  // printers, slower bots, long routes, mixed books and imperfect boosters.
  s.upgrades.floor = 4;
  s.upgrades.printers = 7;
  s.upgrades.bots = 4;
  const step = Math.ceil(BOOK_LEVEL_STEP * EARLY[s.upgrades.early]);
  s.completed = 0;
  BOOKS.forEach((b, i) => {
    const ranks = 9 + i;
    const hard =
      (step * ranks * (ranks + 1)) / 2 + Math.floor((step * (ranks + 1)) / 2);
    (s.top ??= {})[b.id] = hard;
    s.books[b.id] = 25 + hard;
    s.completed += 25 + hard;
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
    book = BOOKS[0].id as (typeof BOOKS)[number]['id'],
  ) =>
    f.machines.push({
      kind,
      x,
      y,
      dir: 0,
      book: kind === 'printer' ? book : undefined,
      t: 0,
      item: null,
      output: null,
    });
  BOOKS.forEach((b, i) => {
    const x = (i % 2) * 8,
      y = Math.floor(i / 2) * 2;
    const line: MachineKind[] = [
      'printer',
      'belt',
      'stamper',
      'bot',
      i % 3 === 0 ? 'bundler' : 'belt',
      'gilder',
      'cashier',
    ];
    line.forEach((kind, offset) => add(kind, x + offset, y, b.id));
    add(i % 3 === 0 ? 'lamp' : i % 3 === 1 ? 'ink' : 'charm', x + 1, y + 1);
  });
  // A visibly unfinished side line; it prints and queues but cannot sell.
  add('printer', 0, 8, 'twins');
  add('belt', 1, 8);
  add('splitter', 2, 8);
  add('belt', 3, 8);
  f.machines.sort((a, b) => a.y - b.y || a.x - b.x);
  // Fill real buffers by simulation so the saved floor is active on arrival.
  advanceFactory(game, 60_000);
}
