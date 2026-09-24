import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {
  tableWorldFor,
  tableWorldFrame,
  tableWorldPlayBox,
  tableWorldTarget,
  tableWorldVariants,
  tallWorldQuery,
  cropPercent,
} from '../lib/games/table-world.ts';
import { paperWorldFor, paperWorldFrame } from '../lib/games/mora-world.ts';
import { readFileSync } from 'node:fs';

const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`);
const inside = (box, outer) =>
  box.left >= outer.left && box.top >= outer.top &&
  box.left + box.width <= outer.left + outer.width && box.top + box.height <= outer.top + outer.height;
// The same device set the Observatory is checked against, including browser-zoomed desktops.
const devices = [[320, 568], [375, 667], [390, 844], [430, 932], [768, 1024], [568, 320], [667, 375], [844, 390], [932, 430], [1133, 744], [1194, 834], [1280, 720], [1440, 900], [1912, 952], [3440, 1440], ...[1.1, 1.25, 1.5].map((z) => [1512 / z, 850 / z])];
// The plate each game shows: tallWorldQuery in lib/games/table-world.ts.
const tallFor = (game, w, h) => h > w || (game === 'midnight' && w / h <= 1.3 && h > 500);
// Fixed stage reserves, mirroring components/game/table-worlds.css.
const stageFor = (game, w, h) => {
  const tall = tallFor(game, w, h), phone = !tall && h <= 500;
  if (phone) return { x: 104, y: 8, width: w - 336, height: h - 16 };
  // Yata's counter stage reaches the bottom gap: the ledge the hand lies on is part of its play box.
  if (game === 'midnight' && !tall) return { x: 0, y: 58, width: w, height: h - 58 - 18 };
  // Wide tall Yata screens take one row of tickets under one dock row.
  if (game === 'midnight' && w >= 720) return { x: 0, y: 58, width: w, height: h - 58 - 156 - 18 - 84 };
  const short = tall && h <= 700;
  const hand = tall ? (game === 'undertow' ? (short ? 184 : 212) : short ? 216 : 250) : game === 'undertow' ? 196 : 176;
  const top = tall ? (game === 'undertow' ? (short ? 52 : 56) : short ? 96 : 104) : 58;
  // Portrait also reserves the wrapping dock rows between the stage and the hand (--world-dock-reserve).
  const reserve = tall ? (game === 'undertow' ? (short ? 128 : 164) : short ? 150 : 186) : 10;
  return { x: 0, y: top, width: w, height: h - top - hand - 18 - reserve };
};

for (const game of ['undertow', 'midnight']) {
  for (const tall of [false, true]) {
    const art = tableWorldFor(game, tall);
    await test(`${game} ${tall ? 'portrait' : 'landscape'}: shipped files match the measured metadata`, async () => {
      assert.equal(art.game, game);
      // Source PNGs live in the art archive outside the repo; the shipped plate carries the same size.
      assert.equal(tall, art.height > art.width);
      const full = await sharp(`public${art.image}`).metadata();
      assert.equal(full.width, art.width); assert.equal(full.height, art.height);
      const mini = await sharp(`public${art.overviewImage}`).metadata();
      assert.equal(mini.width, art.overview.width); assert.equal(mini.height, art.overview.height);
      for (const v of tableWorldVariants(game, tall)) {
        const image = await sharp(`public${v.image}`).metadata();
        assert.equal(image.width, art.width); assert.equal(image.height, art.height);
      }
    });
    await test(`${game} ${tall ? 'portrait' : 'landscape'}: the painted table sits inside the gameplay crop and the play box`, () => {
      assert.ok(inside(art.table, art.crop), 'table inside crop');
      const play = tableWorldPlayBox(art);
      assert.ok(inside(art.table, play), 'table inside play box');
      // Yata's counter keeps its menu boards and ledge on screen too; those lie outside the gameplay crop.
      if (art.ledge) {
        for (const box of [art.ledge, ...(art.signboards ?? [])]) assert.ok(inside(box, play), 'ledge and boards inside play box');
        assert.ok(inside(art.ledge, { left: 0, top: art.table.top + art.table.height, width: art.width, height: art.height }), 'ledge below the counter');
      } else assert.ok(inside(play, art.crop), 'play box inside crop');
      for (const l of art.landmarks.protectedBounds) {
        const [x, y, w, h] = l.bounds;
        assert.ok(x >= 0 && y >= 0 && x + w <= art.width && y + h <= art.height, l.name);
      }
      for (const box of art.signboards ?? []) assert.ok(inside(box, { left: 0, top: 0, width: art.width, height: art.height }));
      const pct = cropPercent(art, art.table);
      for (const v of Object.values(pct)) { const n = parseFloat(v); assert.ok(n >= 0 && n <= 100, v); }
      for (const layer of art.animation.water) for (const [x, y] of layer.polygon) assert.ok(x >= 0 && y >= 0 && x <= art.width && y <= art.height);
      for (const g of art.animation.glows) assert.ok(g.x >= 0 && g.y >= 0 && g.x <= art.width && g.y <= art.height && g.radius > 0);
    });
  }
  await test(`${game}: the play box stays inside the stage on every device while the plate covers wherever it can`, () => {
    for (const [w, h] of [...devices, [1100, 900], [1040, 800], [1045, 800], [1024, 768]]) {
      const tall = tallFor(game, w, h);
      const art = tableWorldFor(game, tall);
      const stage = stageFor(game, w, h);
      const f = tableWorldFrame(art, { width: w, height: h }, stage), target = tableWorldTarget(art, f);
      close(target.width / art.width, target.height / art.height);
      close(target.x, f.image.x); close(target.y, f.image.y);
      const lean = tall || art.ledge ? 0 : stage.height * 0.05;
      const play = tableWorldPlayBox(art);
      for (const [x, y] of [[play.left, play.top], [play.left + play.width, play.top + play.height]]) {
        const px = target.x + x * f.scale, py = target.y + y * f.scale;
        assert.ok(px >= stage.x - 1e-6 && px <= stage.x + stage.width + 1e-6, `${game} ${w}×${h}: x ${px}`);
        assert.ok(py >= stage.y - lean - 1e-6 && py <= stage.y + stage.height + lean + 1e-6, `${game} ${w}×${h}: y ${py}`);
      }
      const fit = Math.min(stage.width / play.width, (stage.height + 2 * lean) / play.height);
      const cover = Math.max(w / art.width, h / art.height);
      assert.ok(f.scale <= fit + 1e-9);
      if (cover <= fit) assert.ok(Math.abs(f.scale - cover) < 1e-9, `${game} ${w}×${h} should use the cover scale`);
      else assert.ok(Math.abs(f.scale - fit) < 1e-9, `${game} ${w}×${h} should fill the stage`);
      assert.equal(f.covers, target.x <= 1e-6 && target.y <= 1e-6 && target.x + target.width >= w - 1e-6 && target.y + target.height >= h - 1e-6);
    }
  });
  await test(`${game}: desktops and landscape tablets are covered edge to edge`, () => {
    // Yata also covers squarish windows on either side of its 13:10 switch to the tall counter.
    const extra = game === 'midnight' ? [[1920, 1080], [1024, 768], [1045, 800], [1040, 800], [1100, 900], [1000, 800], [834, 1194]] : [];
    for (const [w, h] of [[1440, 900], [1512, 982], [1280, 720], [1194, 834], [1133, 744], ...extra]) {
      const f = tableWorldFrame(tableWorldFor(game, tallFor(game, w, h)), { width: w, height: h }, stageFor(game, w, h));
      assert.ok(f.covers, `${game} ${w}×${h}`);
    }
  });
}
await test('candidate variants share geometry and differ only in imagery', () => {
  for (const v of tableWorldVariants('undertow', false)) {
    const base = tableWorldFor('undertow', false), world = tableWorldFor('undertow', false, v.id);
    assert.deepEqual(world.table, base.table); assert.deepEqual(world.crop, base.crop);
    assert.equal(world.image, v.image);
    assert.equal(tableWorldFor('undertow', false, v.id), world, 'stable identity');
  }
  assert.equal(tableWorldFor('midnight', true, 'nox-cabin-b'), tableWorldFor('midnight', true), 'unknown ids fall back to the base plate');
});
await test('the Observatory framing is unchanged by the shared scene framing', () => {
  const art = paperWorldFor(false);
  const f = paperWorldFrame(art, { width: 1440, height: 900 }, { x: 0, y: 144, width: 1440, height: 638 });
  assert.ok(f.covers && Number.isFinite(f.scale) && f.scale > 0);
});

await test('accepted Counter B and Floodline B override old candidate selections without changing geometry', () => {
  for (const tall of [false, true]) {
    const counter = tableWorldFor('midnight', tall, 'yata-counter-a');
    assert.match(counter.image, /v2-b\.webp$/);
  }
  // Floodline's accepted board is the three-round v5-b art; candidate ids never override it.
  for (const [tall, id] of [[false, 'floodline-landscape-v2-b'], [true, 'floodline-portrait-v2-a']])
    assert.match(paperWorldFor(tall, id, 'floodline').image, /-v5-b\.webp$/);
});

await test('Yata switches its plate and its layout at the same breakpoint', () => {
  const css = readFileSync('components/game/table-worlds.css', 'utf8');
  const tall = tallWorldQuery('midnight');
  assert.equal(tall, '(orientation: portrait), (max-aspect-ratio: 13/10) and (min-height: 501px)');
  assert.ok(css.includes(`@media ${tall} {`), 'tall layout uses the plate query');
  assert.ok(css.includes('@media (min-aspect-ratio: 1301/1000) and (min-height: 501px) {'), 'counter layout is its complement');
  assert.equal(tallWorldQuery('undertow'), '(orientation: portrait)');
});
