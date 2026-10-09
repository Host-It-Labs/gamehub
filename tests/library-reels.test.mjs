import test from 'node:test';
import assert from 'node:assert/strict';
import { statSync } from 'node:fs';
import {
  reelAssets,
  reelFor,
  reelSource,
  reelTier,
} from '../lib/games/library-reels.ts';
import { libraryGames } from '../lib/games/library-fixtures.ts';

const size = (path) =>
  statSync(new URL(`../public${path}`, import.meta.url)).size;

// Full-HD footage (1920×1080 wide, 1080×1920 tall): about 2–6 MB a clip.
await test('every listed footage file is served and stays light', () => {
  for (const path of reelAssets()) assert.ok(size(path) > 0, `${path} exists`);
  for (const game of libraryGames) {
    const reel = reelFor(game.id);
    if (!reel) continue;
    assert.ok(
      size(reel.wide) <= 8 * 1024 * 1024,
      `${game.id} wide clip is small`,
    );
    assert.ok(
      size(reel.tall) <= 8 * 1024 * 1024,
      `${game.id} tall clip is small`,
    );
    assert.ok(
      size(reel.wideStill) <= 640 * 1024,
      `${game.id} wide still is small`,
    );
  }
});

await test('footage is only listed for games in the library', () => {
  for (const path of reelAssets()) {
    const id = path.match(/\/reels\/(.+)-(wide|tall)(-\d+)?\./)[1];
    assert.ok(reelFor(id), `${id} is filmed`);
  }
});

await test('every clip has its lighter 720p and 360p cuts, each lighter than the last', () => {
  for (const game of libraryGames) {
    const reel = reelFor(game.id);
    if (!reel) continue;
    for (const shape of ['wide', 'tall']) {
      const [full, mid, small] = ['full', '720', '360'].map((t) =>
        size(reelSource(reel, shape, t)),
      );
      assert.ok(mid < full && small < mid, `${game.id} ${shape} cuts shrink`);
    }
  }
});

await test('each screen gets the lightest cut that covers it', () => {
  // A 4K-class desktop stage takes the full-HD master.
  assert.equal(reelTier('wide', 1200, 675, 2), 'full');
  assert.equal(reelTier('wide', 1600, 900, 1), 'full');
  // A 1× laptop stage and a phone take 720p.
  assert.equal(reelTier('wide', 900, 506, 1), '720');
  assert.equal(reelTier('tall', 360, 520, 2), '720');
  // A game card takes 360p; a big one on a dense screen 720p.
  assert.equal(reelTier('wide', 200, 200, 1), '360');
  assert.equal(reelTier('wide', 240, 240, 2), '720');
  // Weak devices stop at 720p; data saver takes the smallest.
  assert.equal(reelTier('wide', 1600, 900, 2, { power: 'low' }), '720');
  assert.equal(reelTier('wide', 1600, 900, 2, { saveData: true }), '360');
  assert.equal(
    reelSource(reelFor('arena'), 'tall', '360'),
    '/reels/arena-tall-360.mp4',
  );
});
