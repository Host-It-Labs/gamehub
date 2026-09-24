import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import observatoryArt from '../lib/games/observatory-art.json' with { type: 'json' };
import { catalog, tokenImage, habitatsFor } from '../lib/games/trio/engine.ts';
import { moraMap, floodlineMap } from '../lib/games/trio/mora-map.ts';
const coastalMap = floodlineMap();

await test('production artwork resolves, responsive covers decode, and all tokens retain alpha', async () => {
  const previews = JSON.parse(
    await readFile(new URL('../lib/artwork-previews.json', import.meta.url)),
  );
  const metadata = (path) =>
    sharp(new URL(`../public${path}`, import.meta.url).pathname).metadata();
  for (const game of catalog) {
    assert.ok((await metadata(game.cover)).width > 900);
    const entry = previews[game.cover];
    assert.match(entry.preview, /^data:image\/webp;base64,/);
    for (const variant of entry.srcSet.split(', ')) {
      const [path, width] = variant.split(' ');
      assert.equal((await metadata(path)).width, parseInt(width));
    }
  }
  for (const food of [false, true])
    for (const set of ['beginner', 'intermediate'])
      for (let kind = 0; kind < 6; kind++) {
        const result = await metadata(tokenImage(kind, food, set));
        assert.equal(result.hasAlpha, true);
        assert.equal(result.width, 512);
        assert.equal(result.height, 512);
      }
  for (const map of [coastalMap, moraMap]) {
    const result = await metadata(map.image);
    assert.ok(result.width > result.height, 'landscape gameplay crop');
  }
  const css = await readFile(
    new URL('../app/globals.css', import.meta.url),
    'utf8',
  );
  for (const match of css.matchAll(/url\(['"]?(\/art\/[^'")]+)['"]?\)/g))
    await metadata(match[1]);
});
await test('independent Mora world geography preserves every capacity and accessible target', () => {
  assert.notDeepEqual(
    moraMap.habitats.map((h) => h.slots),
    coastalMap.habitats.map((h) => h.slots),
  );
  for (const [map, set] of [
    [moraMap, 'beginner'],
    [coastalMap, 'intermediate'],
  ]) {
    assert.deepEqual(
      map.habitats.map((h) => h.zone).sort(),
      [0, 1, 2, 3, 4, 6],
    );
    for (const h of map.habitats) {
      assert.equal(h.slots.length, habitatsFor(set)[h.zone].cap);
      const [x, y, w, height] = h.bounds;
      // Main habitat silhouettes may extend outside the logical camera crop.
      // Their bounds are fitted with the full landmark contract in paperWorldFrame.
      assert.ok(w > 0 && height > 0);
      // Cards hang below their pad group, outside the pad box.
      for (const [cx, cy] of h.slots)
        assert.ok(cx >= x && cx <= x + w && cy >= y && cy <= y + height);
    }
  }
});

await test('Observatory wide source and exact gameplay crop match their shared geometry', async () => {
  const metadata = (path) =>
    sharp(new URL(`../public${path}`, import.meta.url).pathname).metadata();
  const source = await metadata(observatoryArt.image);
  assert.equal(source.width, observatoryArt.width);
  assert.equal(source.height, observatoryArt.height);
  assert.ok(
    source.width > source.height,
    'the source supplies extra lateral scenery',
  );
  const board = await metadata(observatoryArt.boardImage);
  assert.equal(board.width, observatoryArt.crop.width);
  assert.equal(board.height, observatoryArt.crop.height);
  const css = await readFile(
    new URL('../app/globals.css', import.meta.url),
    'utf8',
  );
  for (const [, selector, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g))
    if (selector.includes(".table-layout[data-environment='observatory']"))
      assert.doesNotMatch(
        body,
        /url\(/,
        'the table must not paint a second separately scaled scene',
      );
});
