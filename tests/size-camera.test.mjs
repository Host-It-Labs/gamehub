import test from 'node:test';
import assert from 'node:assert/strict';
import { sizeCameraZoom } from '../lib/games/party/size-camera.ts';

await test('Sizes camera follows growth and shrinkage back to the initial zoom', () => {
  for (const available of [
    { w: 800, h: 400 },
    { w: 300, h: 500 },
  ]) {
    const reference = { w: 100, h: 100 };
    const left = 118;
    const base = Math.min(available.w / 198, available.h / 100);
    const zoom = (size) =>
      sizeCameraZoom(base, available, reference, { w: size, h: size }, left);
    assert.equal(zoom(80), 1);
    assert.ok(zoom(400) < zoom(200));
    assert.ok(zoom(200) < 1);
    assert.equal(zoom(80), 1);
    assert.equal(zoom(1), 1, 'shrinking below the start cannot zoom closer');
    assert.equal(zoom(1e9), 1 / 40, 'keep the existing far zoom limit');
  }
});

await test('Sizes camera fits the reference and an offset target together', () => {
  const available = { w: 800, h: 400 };
  const reference = { w: 100, h: 200 };
  const target = { w: 100, h: 50 };
  const scale = 2 * sizeCameraZoom(2, available, reference, target, 500);
  assert.ok(scale * reference.h <= available.h);
  assert.ok(scale * (500 + target.w) <= available.w);
});
