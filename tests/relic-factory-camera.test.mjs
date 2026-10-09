import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { FactoryCamera } from '../components/game/relic-factory/camera.ts';
import { MAX_ZOOM, MIN_ZOOM } from '../components/game/relic-factory/limits.ts';
import { FactoryGestures } from '../components/game/relic-factory/gestures.ts';
import { factoryQuality } from '../components/game/relic-factory/quality.ts';

const near = (a, b, epsilon = 1e-6) =>
  assert.ok(Math.abs(a - b) < epsilon, `${a} ≈ ${b}`);
const viewports = [
  [1590, 700],
  [1100, 520],
  [760, 545],
  [600, 750],
  [354, 540],
  [354, 360],
  [620.4, 430.8],
  [390, 190],
];

await test('Fit protects the complete floor frame and tall machines at every overview size', () => {
  for (const [w, h] of viewports)
    for (const [width, height] of [
      [8, 5],
      [16, 9],
    ]) {
      const rig = new FactoryCamera();
      rig.fit(width, height, w, h);
      for (const x of [-0.4, width + 0.4])
        for (const z of [-0.4, height + 0.4])
          for (const y of [-0.35, 0.9]) {
            const p = new THREE.Vector3(x, y, z).project(rig.camera);
            assert.ok(
              Math.abs(p.x) <= 1 - 16 / w + 1e-5,
              `${w}×${h} horizontal frame`,
            );
            assert.ok(
              Math.abs(p.y) <= 1 - 16 / h + 1e-5,
              `${w}×${h} vertical frame`,
            );
            assert.ok(p.z > -1 && p.z < 1, 'inside camera depth range');
          }
    }
});

await test('zoom stays anchored to the inspected floor point and picking follows the camera', () => {
  for (const [w, h] of viewports) {
    const rig = new FactoryCamera();
    rig.fit(16, 9, w, h);
    const anchor = { x: 0.18, y: -0.12 };
    const floor = rig.floorPoint(anchor);
    rig.zoomTo(2.2, anchor);
    const after = rig.floorPoint(anchor);
    near(floor.x, after.x);
    near(floor.z, after.z);
    const screen = floor.clone().project(rig.camera);
    near(screen.x, anchor.x);
    near(screen.y, anchor.y);
    rig.fit(16, 9, w * 0.8, h * 0.8);
    near(rig.zoom, 2.2);
  }
});

await test('pan follows the drag on both floor orientations and Fit restores the overview', () => {
  for (const [w, h] of [
    [1300, 600],
    [350, 600],
  ]) {
    const rig = new FactoryCamera();
    rig.fit(16, 9, w, h);
    const overview = rig.camera.position.clone();
    const direction = new THREE.Vector3();
    rig.camera.getWorldDirection(direction);
    rig.zoomTo(3);
    const from = { x: 0, y: 0 },
      to = { x: 0.1, y: 0.14 };
    const held = rig.floorPoint(from);
    rig.pan(from, to);
    const screen = held.project(rig.camera);
    near(screen.x, to.x);
    near(screen.y, to.y);
    const afterDirection = new THREE.Vector3();
    rig.camera.getWorldDirection(afterDirection);
    assert.ok(
      afterDirection.distanceTo(direction) < 1e-8,
      'angle remains fixed',
    );
    rig.zoomTo(Infinity);
    near(rig.zoom, 3);
    rig.zoomTo(999);
    near(rig.zoom, MAX_ZOOM);
    for (let i = 0; i < 100; i++) rig.pan(from, { x: 0.8, y: 0.8 });
    const centre = rig.floorPoint(from);
    assert.ok(
      centre.x >= -0.5 &&
        centre.x <= 16.5 &&
        centre.z >= -0.5 &&
        centre.z <= 9.5,
      'cannot lose the floor',
    );
    rig.reset();
    near(rig.zoom, MIN_ZOOM);
    assert.ok(rig.camera.position.distanceTo(overview) < 1e-6);
    rig.pan(from, to);
    assert.ok(
      rig.camera.position.distanceTo(overview) < 1e-6,
      'overview stays framed',
    );
  }
});

await test('every edge machine can be inspected completely, including its roof', () => {
  for (const [w, h] of viewports) {
    const rig = new FactoryCamera();
    rig.fit(16, 9, w, h);
    rig.zoomTo(MAX_ZOOM);
    for (const x of [0.5, 15.5])
      for (const z of [0.5, 8.5]) {
        const screen = new THREE.Vector3(x, 0, z).project(rig.camera);
        rig.pan({ x: screen.x, y: screen.y }, { x: 0, y: 0 });
        const centre = rig.floorPoint({ x: 0, y: 0 });
        near(centre.x, x);
        near(centre.z, z);
        for (const dx of [-0.4, 0.4])
          for (const dz of [-0.4, 0.4])
            for (const y of [0, 0.9]) {
              const roof = new THREE.Vector3(x + dx, y, z + dz).project(
                rig.camera,
              );
              assert.ok(
                Math.abs(roof.x) < 1 && Math.abs(roof.y) < 1,
                `${w}×${h}: edge machine remains complete`,
              );
            }
      }
  }
});

await test('changing orientation or browser zoom preserves the inspected floor centre', () => {
  const rig = new FactoryCamera();
  rig.fit(16, 9, 1590, 700);
  rig.zoomTo(3, { x: 0.25, y: -0.35 });
  const focus = rig.floorPoint({ x: 0, y: 0 });
  for (const [w, h] of viewports) {
    rig.fit(16, 9, w, h);
    const after = rig.floorPoint({ x: 0, y: 0 });
    near(after.x, focus.x);
    near(after.z, focus.z);
    near(rig.zoom, 3);
  }
});

await test('pinching or panning cannot commit any pending placement, drag or erasure', () => {
  const input = new FactoryGestures();
  assert.equal(input.begin(1, { x: 100, y: 100 }, false), false);
  assert.equal(
    input.move(1, { x: 105, y: 100 }),
    null,
    'single finger still edits',
  );
  assert.equal(
    input.begin(2, { x: 205, y: 100 }, false),
    true,
    'second finger cancels edit',
  );
  const gesture = input.move(2, { x: 305, y: 100 });
  near(gesture.factor, 2);
  assert.equal(input.end(2), true);
  assert.ok(input.move(1, { x: 110, y: 120 }), 'remaining finger pans');
  assert.equal(input.end(1), true, 'remaining finger cannot commit');
  assert.equal(input.begin(3, { x: 100, y: 100 }, false), false);
  assert.equal(input.end(3), false, 'the next ordinary tap can edit');
  assert.equal(input.begin(4, { x: 100, y: 100 }, true), true);
  assert.equal(input.end(4), true, 'explicit pan never edits');
  input.begin(5, { x: 100, y: 100 }, false);
  input.consume();
  assert.equal(input.end(5), true, 'wheel zoom interrupts an edit safely');
  input.begin(6, { x: 100, y: 100 }, true);
  input.cancel();
  assert.equal(input.begin(7, { x: 100, y: 100 }, false), false);
  assert.equal(input.end(7), false, 'cancelled gestures leave no stuck state');
});

await test('detail adaptation keeps sharp pixels and shadows at overview and inspection zoom', () => {
  for (const ratio of [0.67, 0.8, 1, 1.25, 1.5, 2, 3])
    for (const close of [false, true]) {
      const rungs = factoryQuality(ratio, close);
      assert.ok(rungs.length > 0);
      assert.equal(rungs[0].resolution, 1);
      assert.equal(rungs[0].shadowSize, close ? 4096 : 2048);
      for (const rung of rungs) {
        const native = Math.max(1, ratio);
        // Native on top; never under 85% of the old 2× cap.
        assert.ok(rung.resolution * native >= 0.85 * Math.min(native, 2) - 1e-3);
        assert.ok(rung.resolution * native >= 1);
        assert.ok(rung.shadowSize >= 2048);
      }
    }
});

await test('Fit keeps the floor clear of the floating controls along each edge', () => {
  for (const { w, h, insets } of [
    { w: 1440, h: 900, insets: { top: 66, right: 0, bottom: 170, left: 0 } },
    { w: 390, h: 844, insets: { top: 64, right: 0, bottom: 230, left: 0 } },
    { w: 1024, h: 768, insets: { top: 70, right: 0, bottom: 150, left: 0 } },
  ])
    for (const [width, height] of [
      [8, 5],
      [16, 9],
    ]) {
      const rig = new FactoryCamera();
      rig.fit(width, height, w, h, insets);
      let top = Infinity,
        bottom = -Infinity;
      for (const x of [-0.4, width + 0.4])
        for (const z of [-0.4, height + 0.4])
          for (const y of [-0.35, 0.9]) {
            const p = new THREE.Vector3(x, y, z).project(rig.camera);
            top = Math.min(top, ((1 - p.y) / 2) * h);
            bottom = Math.max(bottom, ((1 - p.y) / 2) * h);
            assert.ok(Math.abs(p.x) <= 1 + 1e-5, `${w}×${h} horizontal`);
          }
      assert.ok(
        top >= insets.top + 15.9,
        `${w}×${h} clears the top bar (${top})`,
      );
      assert.ok(
        bottom <= h - insets.bottom - 15.9,
        `${w}×${h} clears the dock (${bottom})`,
      );
    }
});
