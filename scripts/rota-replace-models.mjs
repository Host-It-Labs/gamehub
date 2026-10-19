/** Replace named roots in a Rota Blender export, preserving every other model.
 * node scripts/rota-replace-models.mjs works assets/rota/build/mills.glb
 * Then node scripts/rota-assets.mjs to compress and publish the new archive.
 */
import assert from 'node:assert/strict';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { mergeDocuments, prune, unpartition } from '@gltf-transform/functions';

const [name, patchPath] = process.argv.slice(2);
assert.ok(
  ['vehicles', 'nature', 'town', 'works'].includes(name),
  'Rota archive',
);
assert.ok(patchPath?.endsWith('.glb'), 'replacement GLB');
const archivePath = `assets/rota/build/${name}.glb`;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const archive = await io.read(archivePath);
const patch = await io.read(patchPath);
assert.equal(archive.getRoot().listScenes().length, 1, 'one archive scene');
assert.equal(patch.getRoot().listScenes().length, 1, 'one replacement scene');
const scene = archive.getRoot().listScenes()[0];
const replacements = patch.getRoot().listScenes()[0].listChildren();
const names = replacements.map((node) => node.getName());
assert.equal(new Set(names).size, names.length, 'unique replacement roots');
assert.ok(names.length > 0, 'nonempty replacement');
for (const root of replacements) {
  const old = scene
    .listChildren()
    .find((node) => node.getName() === root.getName());
  assert.ok(old, `existing root ${root.getName()}`);
}
// Capture the old order before removing roots: archive checks deliberately
// compare its structure, not a nearest-vertex approximation.
const order = scene.listChildren().map((node) => node.getName());
for (const old of scene.listChildren()) {
  if (!names.includes(old.getName())) continue;
  const nodes = [];
  old.traverse((node) => nodes.push(node));
  for (const node of nodes.reverse()) node.dispose();
}
const mapping = mergeDocuments(archive, patch);
const importedScene = mapping.get(patch.getRoot().listScenes()[0]);
for (const node of importedScene.listChildren()) scene.addChild(node);
importedScene.dispose();
const roots = new Map(
  scene.listChildren().map((node) => [node.getName(), node]),
);
for (const node of roots.values()) scene.removeChild(node);
for (const rootName of order) scene.addChild(roots.get(rootName));
await archive.transform(
  prune({ keepAttributes: true, keepLeaves: true, keepExtras: true }),
  unpartition(),
);
await io.write(archivePath, archive);
console.log(`Replaced ${names.join(', ')} in ${archivePath}`);
