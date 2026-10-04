import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// The living field (1 October 2026): the tower shells carry waving cloth
// whose second uv set says how free each point is, and the king a chimney.
const manifest = JSON.parse(
  readFileSync(new URL('../lib/games/arena/assets.json', import.meta.url)),
);
const data = readFileSync(
  new URL(`../public${manifest.models.cartoon_towers.path}`, import.meta.url),
);
const scene = (
  await new GLTFLoader().parseAsync(
    data.buffer.slice(data.byteOffset, data.byteOffset + data.length),
    '',
  )
).scene;

await test('every tower flies waving team cloth with a freedom map', () => {
  for (const kind of ['king', 'princess']) {
    const tower = scene.getObjectByName(kind);
    const cloth = [];
    tower.traverse((o) => {
      if (o.isMesh && o.material.name.startsWith('flag:')) cloth.push(o);
    });
    // A back banner and its crown, two side pennants, two corner flags.
    assert.ok(cloth.length >= 6, `${kind} has ${cloth.length} cloth meshes`);
    for (const mesh of cloth) {
      const wave = mesh.geometry.getAttribute('uv1');
      assert.ok(wave, `${mesh.name} carries the Wave uv set`);
      let fixed = false;
      let free = false;
      for (let i = 0; i < wave.count; i++) {
        const u = wave.getX(i);
        assert.ok(u >= -1e-4 && u <= 1 + 1e-4, `${mesh.name} freedom ${u}`);
        if (u < 0.05) fixed = true;
        if (u > 0.5) free = true;
      }
      if (!mesh.name.includes('crown')) {
        assert.ok(fixed, `${mesh.name} is fixed somewhere`);
        assert.ok(free, `${mesh.name} is free somewhere`);
      }
    }
  }
});

await test('the king keeps a chimney spot for its smoke', () => {
  const king = scene.getObjectByName('king');
  const spot = king.getObjectByName('chimney-smoke');
  assert.ok(spot, 'chimney-smoke empty');
  const p = spot.getWorldPosition(spot.position.clone());
  // Above the roof, within the keep.
  assert.ok(p.y > 4.4 && p.y < 5, `smoke rises from ${p.y}`);
});
