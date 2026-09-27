import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import {
  tileGeometry,
  polarGeometry,
  mercatorLimit,
  imageryZoom,
} from '../components/game/geo-globe-geometry.ts';

function latitudes(g) {
  const p = g.getAttribute('position');
  return Array.from(
    { length: p.count },
    (_, i) =>
      (Math.atan2(p.getY(i), Math.hypot(p.getX(i), p.getZ(i))) / Math.PI) * 180,
  );
}
await test('Mercator tiles never stretch beyond their native latitude at any zoom', () => {
  for (const z of [3, 4, 6, 10, 16])
    for (const y of [0, 2 ** z - 1]) {
      const g = tileGeometry(z, 0, y);
      assert.ok(
        latitudes(g).every((lat) => Math.abs(lat) <= mercatorLimit + 0.0001),
      );
      g.dispose();
    }
});
await test('polar surfaces keep stable spherical geometry and global-image UVs', () => {
  for (const north of [true, false]) {
    const g = polarGeometry(north),
      p = g.getAttribute('position'),
      uv = g.getAttribute('uv');
    const lat = latitudes(g);
    for (let i = 0; i < p.count; i++) {
      assert.ok(
        Math.abs(new Vector3().fromBufferAttribute(p, i).length() - 1) < 1e-6,
      );
      assert.ok(Math.abs(uv.getY(i) - (lat[i] + 90) / 180) < 1e-6);
      assert.ok(
        north
          ? lat[i] >= mercatorLimit - 0.0001
          : lat[i] <= -mercatorLimit + 0.0001,
      );
    }
    // Every rendered triangle faces outwards and has area (no pole degeneracy).
    for (let i = 0; i < g.index.count; i += 3) {
      const [a, b, c] = [0, 1, 2].map((j) =>
        new Vector3().fromBufferAttribute(p, g.index.getX(i + j)),
      );
      const normal = b.clone().sub(a).cross(c.clone().sub(a));
      assert.ok(normal.dot(a) > 0);
    }
    assert.ok(lat.some((v) => Math.abs(v) == 90));
    g.dispose();
  }
});
await test('phone imagery gets the same detail floor as desktop and sharpens with zoom', () => {
  for (const lat of [0, 45, 84])
    for (const distance of [2, 0.5, 0.1, 0.0095]) {
      assert.equal(
        imageryZoom(400, 40, distance, lat),
        imageryZoom(1080, 40, distance, lat),
      );
      assert.ok(
        imageryZoom(1600, 40, distance, lat) >=
          imageryZoom(400, 40, distance, lat),
      );
    }
  assert.ok(imageryZoom(400, 40, 0.0095) > imageryZoom(400, 40, 0.1));
});
