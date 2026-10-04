import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import sharp from 'sharp';
import { foodsFor, tokenImage, yataContentSets } from '../lib/games/trio/engine.ts';

await test('every menu serves its card drawings on the counter', async () => {
  for (const set of yataContentSets)
    for (let kind = 0; kind < foodsFor(set).length; kind++) {
      const path = `public${tokenImage(kind, true, set)}`;
      assert.ok(existsSync(path), `${path} exists`);
      // Square, with a transparent rim: the counter's stacked servings rely on
      // it to stay inside their cell.
      const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      assert.equal(info.width, info.height, `${path}: square`);
      for (let y = 0; y < info.height; y++)
        for (let x = 0; x < info.width; x++)
          if (x < 4 || y < 4 || x >= info.width - 4 || y >= info.height - 4)
            assert.ok(data[(y * info.width + x) * 4 + 3] < 40, `${path}: transparent rim`);
    }
});
