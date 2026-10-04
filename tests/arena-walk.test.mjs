import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GAITS,
  dutyFactor,
  footPitch,
  gaitOf,
  pelvis,
  smin,
  solveLeg,
  stepLength,
  swing,
  weightSide,
} from '../lib/games/arena/gait.ts';

// The Pirate's left leg as built (hip to knee, knee to ankle).
const leg = {
  thigh: { y: -0.27, z: -0.055 },
  shin: { y: -0.26, z: 0.0196 },
};

/** Where the ankle ends up for the solver's turns (forward kinematics). */
function ankle(shape, hip, knee) {
  const turn = ({ y, z }, a) => ({
    y: y * Math.cos(a) - z * Math.sin(a),
    z: y * Math.sin(a) + z * Math.cos(a),
  });
  const t = turn(shape.thigh, hip);
  const s = turn(shape.shin, hip + knee);
  return { y: t.y + s.y, z: t.z + s.z };
}

await test('the leg solver returns the sculpt at its own ankle', () => {
  const rest = {
    y: leg.thigh.y + leg.shin.y,
    z: leg.thigh.z + leg.shin.z,
  };
  const { hip, knee } = solveLeg(leg, rest.y, rest.z);
  assert.ok(Math.abs(hip) < 1e-9 && Math.abs(knee) < 1e-9);
});

await test('the leg solver puts the ankle on targets in reach, knee forward', () => {
  for (const [y, z] of [
    [-0.5, -0.15],
    [-0.45, 0.2],
    [-0.38, 0],
    [-0.3, -0.1],
  ]) {
    const { hip, knee } = solveLeg(leg, y, z);
    const a = ankle(leg, hip, knee);
    assert.ok(
      Math.abs(a.y - y) < 1e-6 && Math.abs(a.z - z) < 1e-6,
      `${y},${z}`,
    );
    assert.ok(knee <= 1e-9, 'the knee only ever bends, never hyperextends');
  }
  // Out of reach, the leg straightens towards the target.
  const far = solveLeg(leg, -0.7, -0.3);
  assert.ok(far.stretch > 1);
  assert.ok(far.hip > 0);
});

await test('the pelvis is lowest just after each heel strike, highest as the legs pass', () => {
  const g = GAITS.brisk;
  let low = 0;
  let high = 0;
  for (let i = 0; i < 100; i++) {
    const w = i / 100;
    if (pelvis(w, g) < pelvis(low, g)) low = w;
    if (pelvis(w, g) > pelvis(high, g)) high = w;
  }
  assert.ok(low > 0.05 && low < 0.3, `lowest at ${low}`);
  assert.ok(high > 0.45 && high < 0.8, `highest at ${high}`);
  // Periodic: no jump at the next strike.
  assert.ok(Math.abs(pelvis(0, g) - pelvis(0.99999, g)) < 1e-3);
  // Heavy bodies sink further than light ones.
  assert.ok(pelvis(low, GAITS.heavy) < pelvis(low, GAITS.light));
});

await test('the foot rolls heel to toe and its pitch never jumps', () => {
  for (const name of Object.keys(GAITS)) {
    const g = GAITS[name];
    const duty = dutyFactor(g);
    assert.ok(footPitch(0, duty, g) > 0, 'toe up at heel strike');
    assert.equal(footPitch(duty * 0.3, duty, g), 0, 'flat in mid-stance');
    assert.ok(footPitch(duty - 1e-4, duty, g) < 0, 'heel up at toe-off');
    for (let i = 0; i < 1000; i++) {
      const u = i / 1000;
      const d = Math.abs(footPitch(u + 0.001, duty, g) - footPitch(u, duty, g));
      assert.ok(d < 0.05, `${name} at ${u}`);
    }
  }
});

await test('a swing leaves from where the foot lifted and lands where it is going', () => {
  assert.equal(swing(0).travel, 0);
  assert.equal(swing(1).travel, 1);
  assert.ok(swing(0).height < 1e-9 && swing(1).height < 1e-9);
  let peak = 0;
  for (let i = 0; i <= 100; i++)
    if (swing(i / 100).height > swing(peak).height) peak = i / 100;
  assert.ok(peak > 0.3 && peak < 0.55, 'highest a little before mid-swing');
});

await test('gaits: presets, changes and step lengths', () => {
  const g = gaitOf({ like: 'heavy', stride: 0.5 }, 'brisk');
  assert.equal(g.stride, 0.5);
  assert.equal(g.weight, GAITS.heavy.weight);
  assert.equal(gaitOf(undefined, 'light'), GAITS.light);
  assert.equal(gaitOf('glide', 'brisk'), GAITS.glide);
  // At its own speed a troop steps its stride of leg; faster, longer steps
  // but not in proportion (the cadence rises too).
  const leg = 0.5;
  const stride = GAITS.brisk.stride * leg;
  assert.ok(Math.abs(stepLength(GAITS.brisk, leg, 1, 1) - stride) < 1e-9);
  const fast = stepLength(GAITS.brisk, leg, 2, 1);
  assert.ok(fast > stride && fast < 2 * stride);
  // A long leg at a slow pace steps short, never slower than its cadence.
  for (const g of Object.values(GAITS)) {
    const step = stepLength(g, 2.5, 0.75, 0.75);
    assert.ok(Math.abs(0.75 / step - g.cadence) < 1e-9);
  }
  // The weight is on the left foot in its mid-stance.
  const duty = dutyFactor(GAITS.brisk);
  assert.ok(Math.abs(weightSide(duty / 2, duty) - 1) < 1e-9);
  assert.ok(Math.abs(weightSide(duty / 2 + 0.5, duty) + 1) < 1e-9);
  assert.ok(smin(0, 1, 0.1) === 0 && smin(0, -1, 0.1) === -1);
  assert.ok(smin(0, 0, 0.1) < 0);
});
