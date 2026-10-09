import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  MeshSolid,
  auditMesh,
  geometryIndices,
  posedPositions,
  closedTopology,
} from '../scripts/arena-exact-solids.mjs';

function cube() {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2));
  mesh.updateMatrixWorld(true);
  const solid = new MeshSolid(
    'stone',
    posedPositions(mesh),
    geometryIndices(mesh.geometry),
  );
  solid.topology = closedTopology(solid);
  return solid;
}
function triangle(vertices) {
  const mesh = new THREE.Mesh(
    new THREE.BufferGeometry().setAttribute(
      'position',
      new THREE.Float32BufferAttribute(vertices, 3),
    ),
  );
  mesh.updateMatrixWorld(true);
  return mesh;
}

await test('closed stone includes its interior and allows anatomy above the real roof', () => {
  const solid = cube();
  assert.equal(solid.topology.closed, true);
  assert.equal(solid.contains(new THREE.Vector3(0.1, 0.2, 0.3)), true);
  assert.equal(solid.contains(new THREE.Vector3(0, 1.2, 0)), false);
  assert.ok(Math.abs(solid.distance(new THREE.Vector3()) - 1) < 1e-9);
});

await test('an outside-vertex triangle still fails when its edge passes through stone', () => {
  const result = auditMesh(triangle([-3, 0, 0, 3, 0, 0, 0, 3, 0]), [cube()]);
  assert.equal(result.containedVertices, 0);
  assert.ok(result.edgePenetrations > 0);
  assert.ok(result.deepestGap < -0.1);
});

await test('reverse stone edges detect a detail piercing a broad triangle without perimeter contact', () => {
  const result = auditMesh(triangle([-6, -6, 0, 6, -6, 0, 0, 6, 0]), [cube()]);
  assert.equal(result.containedVertices, 0);
  assert.equal(result.edgePenetrations, 0);
  assert.ok(result.surfaceCrossings > 0);
});

await test('an exactly touching triangle is contact while a slightly embedded one fails', () => {
  const touching = auditMesh(
    triangle([-0.4, 1, -0.4, 0.4, 1, -0.4, 0, 1, 0.4]),
    [cube()],
  );
  assert.equal(touching.containedVertices, 0);
  assert.equal(touching.edgePenetrations, 0);
  const embedded = auditMesh(
    triangle([-0.4, 0.99, -0.4, 0.4, 0.99, -0.4, 0, 0.99, 0.4]),
    [cube()],
  );
  assert.equal(embedded.containedVertices, 3);
  assert.ok(embedded.deepestGap <= -0.009);
});
