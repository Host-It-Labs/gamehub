import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { troopDeck } from '../lib/games/arena/cards.ts';

// The eight troops of 1 October 2026 and the Beekeeper's bee
// (assets/arena/blender/figure_<id>.py, components/game/arena/moves/<id>.ts).
const PEOPLE = [
  'diver',
  'sumo',
  'linebacker',
  'beekeeper',
  'drummer',
  'firefighter',
  'jetpack',
  'explorer',
];
const manifest = JSON.parse(
  readFileSync(new URL('../lib/games/arena/assets.json', import.meta.url)),
);
const data = readFileSync(
  new URL(`../public${manifest.models.figures.path}`, import.meta.url),
);
const figures = (
  await new GLTFLoader().parseAsync(
    data.buffer.slice(data.byteOffset, data.byteOffset + data.length),
    '',
  )
).scene;

function triangles(root) {
  let n = 0;
  root.traverse((node) => {
    if (!node.isMesh) return;
    const g = node.geometry;
    n += (g.index ? g.index.count : g.getAttribute('position').count) / 3;
  });
  return n;
}

/** Rebuilt figures already in the shipped bundle (8 October roster). */
const REBUILT = new Set(['firefighter', 'diver', 'explorer', 'beekeeper', 'linebacker', 'drummer', 'jetpack']);

await test('every troop on the field, the bee too, has a collector figure', () => {
  for (const id of troopDeck)
    assert.ok(figures.getObjectByName(id), `${id} is built into figures.glb`);
});

await test('the eight figures retain their joints and bounded runtime geometry', () => {
  for (const id of PEOPLE) {
    const root = figures.getObjectByName(id);
    for (const part of ['torso', 'head', 'armL', 'armR'])
      assert.ok(root.getObjectByName(`${id}${part}`), `${id} ${part}`);
    for (const side of ['L', 'R']) {
      const hip = root.getObjectByName(`${id}leg${side}`);
      const knee = root.getObjectByName(`${id}knee${side}`);
      const foot = root.getObjectByName(`${id}foot${side}`);
      assert.ok(hip && knee && foot, `${id} ${side} leg joints`);
      assert.equal(knee.parent?.name, hip?.name);
      assert.equal(foot.parent?.name, knee?.name);
    }
    const tris = triangles(root);
    // Sumo's separately reviewed source reduction preserves the face,
    // fingers and combed hair that the old 12.5k copy visibly flattened.
    // Figures rebuilt in the 8 October roster round carry a sculpted
    // runtime copy (20–30k triangles, brief in
    // docs/concepts/2026-10-08-arena-roster); the rest keep their limit.
    const limit = id === 'sumo' ? 40000 : REBUILT.has(id) ? 32000 : 12500;
    assert.ok(tris < limit, `${id}: ${tris} triangles exceeds ${limit}`);
  }
  const bee = figures.getObjectByName('bee');
  for (const part of ['torso', 'wingL', 'wingR'])
    assert.ok(bee.getObjectByName(`bee${part}`), `bee ${part}`);
  // The 8 October bee (shaped cuticle, six legs, four wings) stays under
  // the round's 1.5k budget: a swarm of six is still under 9k triangles.
  assert.ok(triangles(bee) < 1500, 'a swarm stays cheap');
});

await test('each new troop registers its own moves', () => {
  const index = readFileSync(
    new URL('../components/game/arena/moves/index.ts', import.meta.url),
    'utf8',
  );
  for (const id of [...PEOPLE, 'bee'])
    assert.match(index, new RegExp(`import \\{ ${id} \\} from './${id}'`));
});
