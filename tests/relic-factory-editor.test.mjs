import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

const root = new URL('../', import.meta.url).href;
// The editor imports through `@/`; resolve it like the app does.
register(
  `data:text/javascript,${encodeURIComponent(`
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = ${JSON.stringify(root)};
export async function resolve(spec, ctx, next) {
  let base = null;
  if (spec.startsWith('@/')) base = fileURLToPath(root + spec.slice(2));
  else if (/^\\.\\.?\\//.test(spec) && ctx.parentURL?.startsWith('file:') && !/\\.[cm]?[jt]sx?$/.test(spec))
    base = fileURLToPath(new URL(spec, ctx.parentURL));
  if (base)
    for (const ext of ['.ts', '.tsx'])
      if (existsSync(base + ext)) return next(pathToFileURL(base + ext).href, ctx);
  return next(spec, ctx);
}`)}`,
);

const E = await import('../components/game/relic-factory/editor.ts');
const { actFactory, createFactory } =
  await import('../lib/games/relic/factory.ts');
const { createRelic } = await import('../lib/games/relic/engine.ts');

const floor = { width: 8, height: 5 };
const machine = (kind, x, y, dir = 0, extra = {}) => ({
  kind,
  x,
  y,
  dir,
  t: 0,
  item: null,
  output: null,
  ...extra,
});
const factory = (...machines) => ({ ...createFactory(), machines });
const cells = (list) => list.map((c) => [c.x, c.y]);

await test('a new machine faces away from what feeds it, toward what takes from it', () => {
  // Printer → (belt?) : the belt continues the printer's flow.
  const f = factory(machine('printer', 0, 0, 0));
  assert.equal(E.autoDir(f, 'belt', { x: 1, y: 0 }, 3), 0);
  // A bot at the end of a belt pointing down faces down.
  const g = factory(machine('belt', 2, 1, 1));
  assert.equal(E.autoDir(g, 'bot', { x: 2, y: 2 }, 0), 1);
  // A printer beside a cashier faces it; nothing around keeps the fallback.
  const h = factory(machine('cashier', 3, 3));
  assert.equal(E.autoDir(h, 'printer', { x: 3, y: 2 }, 0), 1);
  assert.equal(E.autoDir(h, 'printer', { x: 0, y: 0 }, 2), 2);
  // A corner: fed from the left, a cashier above takes from it.
  const k = factory(machine('belt', 0, 1, 0), machine('cashier', 1, 0));
  assert.equal(E.autoDir(k, 'belt', { x: 1, y: 1 }, 1), 3);
  // Straight through wins over a corner when both take.
  const s = factory(
    machine('belt', 0, 1, 0),
    machine('cashier', 1, 0),
    machine('cashier', 2, 1),
  );
  assert.equal(E.autoDir(s, 'belt', { x: 1, y: 1 }, 1), 0);
  // Cashiers, lamps and charms never turn.
  assert.equal(E.autoDir(f, 'cashier', { x: 1, y: 0 }, 2), 0);
});

await test('a drawn belt points along its path, turns corners and can be walked back', () => {
  let path = E.startPath({ x: 0, y: 0 }, 2);
  path = E.extendPath(path, { x: 3, y: 0 });
  assert.deepEqual(
    path.cells.map((c) => c.dir),
    [0, 0, 0, 0],
  );
  path = E.extendPath(path, { x: 3, y: 2 });
  assert.deepEqual(cells(path.cells), [
    [0, 0],
    [1, 0],
    [2, 0],
    [3, 0],
    [3, 1],
    [3, 2],
  ]);
  assert.equal(path.cells[3].dir, 1, 'the corner belt now points down');
  path = E.extendPath(path, { x: 3, y: 1 });
  assert.equal(path.cells.length, 5, 'walking back takes the last belt away');
  // Existing belts are turned, other machines are skipped, nothing doubles.
  const f = factory(machine('belt', 1, 0, 3), machine('bot', 2, 0, 0));
  const edit = E.pathEdit(
    f,
    E.extendPath(E.startPath({ x: 0, y: 0 }, 0), { x: 3, y: 0 }),
    floor,
  );
  assert.deepEqual(cells(edit.build), [
    [0, 0],
    [3, 0],
  ]);
  assert.deepEqual(edit.arrange, [{ x: 1, y: 0, to: { x: 1, y: 0 }, dir: 0 }]);
});

await test('groups move and turn as a whole, staying on the floor', () => {
  const a = machine('printer', 0, 0, 0),
    b = machine('belt', 1, 0, 0),
    c = machine('cashier', 2, 0);
  const f = factory(a, b, c, machine('bot', 0, 2, 0));
  // A row of three turns into a column around its middle.
  const turned = E.turnMoves([a, b, c], floor);
  assert.deepEqual(
    turned.map((m) => [m.to.x, m.to.y, m.dir]),
    [
      [1, 0, 1],
      [1, 1, 1],
      [1, 2, 0],
    ],
  );
  assert.ok(E.movesFit(f, turned, floor));
  // One machine turns where it stands.
  assert.deepEqual(E.turnMoves([b], floor), [
    { x: 1, y: 0, to: { x: 1, y: 0 }, dir: 1 },
  ]);
  // Moving onto a machine left behind does not fit; swapping places does.
  assert.ok(!E.movesFit(f, E.shiftMoves([a], 0, 2), floor));
  assert.ok(
    E.movesFit(
      f,
      [
        { x: 0, y: 0, to: { x: 1, y: 0 }, dir: 0 },
        { x: 1, y: 0, to: { x: 0, y: 0 }, dir: 0 },
      ],
      floor,
    ),
  );
  assert.ok(!E.movesFit(f, E.shiftMoves([c], 6, 0), floor));
  // Turning a group pressed against the edge pulls it back inside.
  const edge = [machine('belt', 7, 3, 0), machine('belt', 7, 4, 0)];
  const back = E.turnMoves(edge, floor);
  assert.ok(back.every((m) => E.inside(m.to, floor)));
  assert.deepEqual(
    E.realMoves(f, [{ x: 1, y: 0, to: { x: 1, y: 0 }, dir: 0 }]),
    [],
  );
});

await test('a copy keeps its shape and books, turns, and lands on free floor', () => {
  const machines = [
    machine('printer', 2, 1, 0, { book: 'twins' }),
    machine('belt', 3, 1, 0),
    machine('cashier', 4, 1),
  ];
  const f = factory(...machines);
  const clip = E.copyOf(machines);
  assert.equal(clip.w, 3);
  assert.equal(clip.h, 1);
  assert.equal(clip.pieces[0].book, 'twins');
  assert.equal(clip.pieces[1].book, undefined);
  const turned = E.turnClip(clip);
  assert.equal(turned.w, 1);
  assert.equal(turned.h, 3);
  assert.deepEqual(
    turned.pieces.map((p) => [p.x, p.y, p.dir]),
    [
      [0, 0, 1],
      [0, 1, 1],
      [0, 2, 0],
    ],
  );
  assert.deepEqual(E.turnClip(E.turnClip(E.turnClip(turned))), clip);
  // Centred on the pointer, the middle piece sits under it.
  const pieces = E.placeClip(clip, E.clipCorner(clip, { x: 3, y: 3 }));
  assert.deepEqual(cells(pieces), [
    [2, 3],
    [3, 3],
    [4, 3],
  ]);
  assert.deepEqual(E.piecesFit(f, E.placeClip(clip, { x: 2, y: 1 }), floor), [
    false,
    false,
    false,
  ]);
  assert.deepEqual(E.piecesFit(f, E.placeClip(clip, { x: 6, y: 0 }), floor), [
    true,
    true,
    false,
  ]);
  const corner = E.freeCorner(f, clip, { x: 2, y: 1 }, floor);
  assert.ok(E.piecesFit(f, E.placeClip(clip, corner), floor).every(Boolean));
  assert.equal(Math.abs(corner.x - 2) + Math.abs(corner.y - 1), 1);
});

await test('every edit has an inverse that restores the factory and the purse', () => {
  const g = createRelic('Undo desk', 'dunes', 9, Date.UTC(2026, 9, 8));
  g.coins = 1e7;
  actFactory(g, { type: 'factory-blueprint', id: 'starter' });
  const run = (edit) => {
    const inverse = E.inverseEdit(g.scratch.factory, edit);
    actFactory(g, { type: 'factory-edit', ...edit });
    return inverse;
  };
  const shape = () =>
    g.scratch.factory.machines
      .map(
        (m) => `${m.kind}@${m.x},${m.y}>${m.dir}${m.book ? `:${m.book}` : ''}`,
      )
      .sort();
  run({
    build: [
      { kind: 'printer', x: 0, y: 0, dir: 0 },
      { kind: 'belt', x: 1, y: 0, dir: 0 },
      { kind: 'bot', x: 2, y: 0, dir: 0 },
      { kind: 'belt', x: 3, y: 0, dir: 0 },
      { kind: 'cashier', x: 4, y: 0, dir: 0 },
    ],
  });
  const before = shape(),
    coins = g.coins;
  const edits = [
    { remove: [{ x: 2, y: 0 }] },
    {
      build: [
        { kind: 'bot', x: 2, y: 2, dir: 1 },
        { kind: 'belt', x: 5, y: 0, dir: 3 },
      ],
    },
    { arrange: E.turnMoves(g.scratch.factory.machines.slice(0, 3), floor) },
    {
      remove: [{ x: 4, y: 0 }],
      arrange: [{ x: 0, y: 0, to: { x: 0, y: 3 }, dir: 3 }],
      build: [{ kind: 'cashier', x: 0, y: 0, dir: 0 }],
    },
  ];
  for (const edit of edits) {
    const inverse = run(edit);
    assert.notDeepEqual(shape(), before);
    actFactory(g, { type: 'factory-edit', ...inverse });
    assert.deepEqual(shape(), before);
    assert.equal(g.coins, coins, 'undoing costs nothing');
  }
});

await test('four turns about one middle bring a group back, and revisiting a trail cuts it there', () => {
  const group = [machine('belt', 2, 2, 0), machine('belt', 3, 2, 0)];
  const pivot = E.turnPivot(group);
  let cellsNow = group;
  for (let i = 0; i < 4; i++)
    cellsNow = E.turnMoves(cellsNow, floor, pivot).map((m) => ({
      ...machine('belt', m.to.x, m.to.y, m.dir),
    }));
  assert.deepEqual(cells(cellsNow), [
    [2, 2],
    [3, 2],
  ]);
  assert.deepEqual(
    cellsNow.map((m) => m.dir),
    [0, 0],
  );
  // A loop back to the start and on: the trail continues from the start.
  let path = E.startPath({ x: 0, y: 0 }, 0);
  for (const c of [
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
    { x: 0, y: 0 },
    { x: 2, y: 0 },
  ])
    path = E.extendPath(path, c);
  assert.deepEqual(cells(path.cells), [
    [0, 0],
    [1, 0],
    [2, 0],
  ]);
  assert.deepEqual(
    path.cells.map((c) => c.dir),
    [0, 0, 0],
  );
});

await test('an undo only runs on the machines it left behind', () => {
  const f = factory(machine('belt', 0, 0, 0), machine('printer', 2, 0, 0));
  const edit = {
    remove: [{ x: 0, y: 0 }],
    arrange: [{ x: 2, y: 0, to: { x: 2, y: 1 }, dir: 1 }],
    build: [{ kind: 'bot', x: 4, y: 0, dir: 0 }],
  };
  const before = E.expectBefore(f, edit),
    after = E.expectAfter(f, edit);
  assert.ok(E.meets(f, before));
  const done = factory(machine('printer', 2, 1, 1), machine('bot', 4, 0, 0));
  assert.ok(E.meets(done, after));
  // Someone replaced the bot with a cashier, or built where the belt was.
  assert.ok(
    !E.meets(
      factory(machine('printer', 2, 1, 1), machine('cashier', 4, 0)),
      after,
    ),
  );
  assert.ok(
    !E.meets(
      factory(
        machine('printer', 2, 1, 1),
        machine('bot', 4, 0, 0),
        machine('lamp', 0, 0),
      ),
      after,
    ),
  );
});
