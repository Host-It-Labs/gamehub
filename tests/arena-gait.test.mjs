import test from 'node:test';
import assert from 'node:assert/strict';
import { legLowering, walkingLeg } from '../lib/games/arena/gait.ts';

await test('walking bends the recovering knee and counter-rotates the ankle', () => {
  const stance = walkingLeg(0.2, 0.6);
  const swing = walkingLeg(0.8, 0.6);
  assert.ok(Math.abs(stance.knee) < 0.08);
  assert.ok(swing.knee < -0.8, 'heel folds behind the thigh during recovery');
  assert.ok(
    Math.abs(stance.hip + stance.knee + stance.ankle) < 1e-10,
    'planted sole stays level',
  );
  assert.ok(Math.abs(swing.hip + swing.knee + swing.ankle) < 1e-10);
});

await test('joint positions meet continuously at toe-off and the cycle wrap', () => {
  for (const phase of [0, 0.6, 1]) {
    const before = walkingLeg(phase - 1e-5, 0.6);
    const after = walkingLeg(phase + 1e-5, 0.6);
    for (const key of ['hip', 'knee', 'ankle'])
      assert.ok(
        Math.abs(before[key] - after[key]) < 0.001,
        `${key} at ${phase}`,
      );
  }
});

await test('stance correction preserves ankle height for a sculpted bent leg', () => {
  const upper = { y: -0.3, z: -0.025 };
  const lower = { y: -0.26, z: 0.03 };
  for (const phase of [0, 0.15, 0.3, 0.45, 0.59]) {
    const pose = walkingLeg(phase, 0.62);
    const angle = pose.hip + pose.knee;
    const y =
      upper.y * Math.cos(pose.hip) -
      upper.z * Math.sin(pose.hip) +
      lower.y * Math.cos(angle) -
      lower.z * Math.sin(angle) +
      legLowering(pose, upper, lower, 1);
    assert.ok(Math.abs(y - upper.y - lower.y) < 1e-9);
  }
});
