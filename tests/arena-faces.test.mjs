import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {
  applyFace,
  facePose,
  faceRig,
  TROOP_FACES,
} from '../components/game/arena/faces.ts';

const input = (id, extra = {}) => ({
  id,
  seed: 37,
  time: 2.5,
  aim: 0,
  wind: 0,
  strike: 0,
  hurt: 0,
  look: 0,
  ...extra,
});
const manifest = JSON.parse(
  readFileSync(new URL('../lib/games/arena/assets.json', import.meta.url)),
);
const bytes = readFileSync(
  new URL(`../public${manifest.models.figures.path}`, import.meta.url),
);
const figures = (
  await new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length),
    '',
  )
).scene;

await test('every troop carries independent eyes and pupils in the shipped model', () => {
  for (const id of TROOP_FACES) {
    const model = figures.getObjectByName(id);
    const rig = faceRig(model, id);
    const head = model.getObjectByName(`${id}head`);
    for (const side of ['L', 'R']) {
      assert.ok(rig[`eye${side}`], `${id} ${side} eye`);
      assert.ok(rig[`pupil${side}`], `${id} ${side} pupil`);
      assert.equal(rig[`eye${side}`].node.parent, head);
      assert.equal(rig[`pupil${side}`].node.parent, rig[`eye${side}`].node);
      assert.ok(rig[`eye${side}`].width > 0 && rig[`eye${side}`].height > 0);
      if (!['imps', 'bee'].includes(id))
        assert.ok(rig[`brow${side}`], `${id} expressive brow`);
    }
  }
});

await test('facial timing is continuous, bounded and different for different troops', () => {
  const lows = new Map();
  for (const seed of [17, 21, 39]) {
    let previous;
    let lowest = 1;
    let closedAt = 0;
    for (let i = 0; i < 16000; i++) {
      const pose = facePose(input('archers', { seed, time: i / 1000 }));
      for (const value of Object.values(pose))
        assert.ok(Number.isFinite(value));
      assert.ok(pose.left >= 0.04 && pose.left <= 1.25);
      if (previous)
        assert.ok(
          Math.abs(pose.left - previous.left) < 0.03,
          'no snapped blink',
        );
      if (pose.left < lowest) {
        lowest = pose.left;
        closedAt = i;
      }
      previous = pose;
    }
    assert.ok(
      lowest < 0.1,
      'the eye closes completely enough to read as a blink',
    );
    lows.set(seed, closedAt);
  }
  assert.equal(
    new Set(lows.values()).size,
    lows.size,
    'a pair or swarm never blinks in lockstep',
  );
});

await test('the Rex opens its eyes and raises its lids before biting, then tightens them', () => {
  const idle = facePose(input('ogre', { reduced: true }));
  const ready = facePose(input('ogre', { aim: 1, wind: 1, reduced: true }));
  const bite = facePose(input('ogre', { aim: 1, strike: 1, reduced: true }));
  assert.ok(ready.left > idle.left && ready.browL > idle.browL);
  assert.ok(bite.left < ready.left && bite.tilt > ready.tilt);
  const rig = faceRig(figures.getObjectByName('ogre'), 'ogre');
  applyFace(rig, ready);
  const before = rig.browL.node.position.clone();
  applyFace(rig, bite);
  assert.ok(
    before.distanceTo(rig.browL.node.position) > 0.002,
    'actual upper lid responds',
  );
});

await test('shared face kits fully reset between expressions and troops', () => {
  const rig = faceRig(figures.getObjectByName('archers'), 'archers');
  const rest = facePose(input('archers', { reduced: true }));
  applyFace(rig, rest);
  const snapshot = () =>
    Object.values(rig).map(({ node }) => [
      ...node.position.toArray(),
      ...node.quaternion.toArray(),
      ...node.scale.toArray(),
    ]);
  const before = snapshot();
  for (let i = 0; i < 100; i++) {
    applyFace(
      rig,
      facePose(
        input('archers', { time: i / 7, seed: i, aim: 1, hurt: 0.9, look: 1 }),
      ),
    );
  }
  applyFace(rig, rest);
  assert.deepEqual(
    snapshot(),
    before,
    'no accumulated scale, gaze or brow drift',
  );
});

await test('reduced motion holds every idle face still while keeping combat expressions', () => {
  for (const id of TROOP_FACES) {
    const a = facePose(input(id, { reduced: true }));
    const b = facePose(
      input(id, { reduced: true, time: 91, look: 1, seed: 22 }),
    );
    assert.deepEqual(
      a,
      b,
      `${id} has no idle blink or glance under reduced motion`,
    );
    const hit = facePose(input(id, { reduced: true, hurt: 1 }));
    assert.ok(hit.left < a.left, `${id} still reacts to damage`);
  }
});

await test('stunned faces hold a dazed expression through interrupted attacks and damage', () => {
  for (const id of TROOP_FACES) {
    const dazed = facePose(input(id, { stunned: true }));
    const later = facePose(
      input(id, {
        stunned: true,
        time: 19,
        aim: 1,
        wind: 1,
        strike: 1,
        hurt: 1,
        look: 1,
      }),
    );
    assert.deepEqual(later, dazed, `${id} stops its interrupted expression`);
    assert.ok(
      dazed.left < 0.6 && dazed.left > 0.3,
      `${id} eyes remain readable`,
    );
    assert.ok(dazed.gazeY < 0, `${id} looks dazed`);
    const rig = faceRig(figures.getObjectByName(id), id);
    applyFace(rig, dazed);
    for (const side of ['L', 'R']) {
      assert.ok(
        Math.abs(
          rig[`eye${side}`].node.scale.y / rig[`eye${side}`].scale.y -
            dazed.left,
        ) < 1e-6,
        `${id} ${side} dazed eye reaches the real sculpt`,
      );
    }
  }
});
