import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { diver } from '../components/game/arena/moves/diver.ts';
import { sumo } from '../components/game/arena/moves/sumo.ts';
import { linebacker } from '../components/game/arena/moves/linebacker.ts';
import { beekeeper } from '../components/game/arena/moves/beekeeper.ts';
import { drummer } from '../components/game/arena/moves/drummer.ts';
import { firefighter } from '../components/game/arena/moves/firefighter.ts';
import { jetpack } from '../components/game/arena/moves/jetpack.ts';
import { explorer } from '../components/game/arena/moves/explorer.ts';
import { bee } from '../components/game/arena/moves/bee.ts';

const moves = {
  diver,
  sumo,
  linebacker,
  beekeeper,
  drummer,
  firefighter,
  jetpack,
  explorer,
  bee,
};
const ground = [
  'diver',
  'sumo',
  'linebacker',
  'beekeeper',
  'drummer',
  'firefighter',
  'explorer',
];
const legs = ['legL', 'legR', 'kneeL', 'kneeR', 'footL', 'footR'];
const poseNames = [
  'torsoX',
  'torsoY',
  'torsoZ',
  'headX',
  'headY',
  'armL',
  'armR',
  'armLz',
  'armRz',
  'weapon',
  'offhand',
  'jaw',
  'tailY',
  'lean',
  'roll',
  'lunge',
  'lift',
  'yawKick',
];

function frame(id, changes = {}, memo = {}) {
  const joints = new Map();
  const p = Object.fromEntries(poseNames.map((name) => [name, 0]));
  p.squash = 1;
  const c = {
    unit: { id: 7, card: id, hp: 200, maxHp: 200, charged: false },
    walk: 0,
    aim: 0,
    idle: 1,
    wind: 0,
    strike: 0,
    since: 99,
    toHit: 1,
    hits: 0,
    t: 0,
    dt: 1 / 60,
    cycle: 0,
    fwdL: 0,
    fwdR: 0,
    pass: 0,
    hipL: 0,
    hipR: 0,
    swingL: 0,
    swingR: 0,
    speed: 0,
    gait: {},
    size: 1,
    travel: 0,
    accel: 0,
    lateral: 0,
    vertical: 0,
    turn: 0,
    idleFor: 0,
    flinch: 0,
    time: 0,
    deploy: 1,
    reduced: false,
    ...changes,
    memo,
    want(part, x = 0, y = 0, z = 0, height = 0) {
      joints.set(part, [x, y, z, height]);
    },
  };
  const original = structuredClone(c.unit);
  moves[id].pose(c, p);
  assert.deepEqual(c.unit, original, `${id} motion cannot change the engine`);
  return { c, p, joints };
}

await test('October movement keeps every grounded gait leg under the planted solver', () => {
  for (const id of ground) {
    assert.ok(moves[id].style.gait, `${id} uses a planted gait`);
    for (let i = 0; i < 120; i++) {
      const cycle = i / 120;
      const f = frame(id, {
        walk: 1,
        idle: 0,
        cycle,
        hipL: Math.sin(cycle * Math.PI * 2) * 0.4,
        hipR: -Math.sin(cycle * Math.PI * 2) * 0.4,
        accel: Math.sin(cycle * Math.PI * 2) * 5,
        turn: 1.2,
      });
      for (const part of legs)
        assert.ok(
          !f.joints.has(part),
          `${id} cannot override ${part} while walking`,
        );
    }
  }
});

await test('October movement stays finite across deployment, turns, recoil and frame stalls', () => {
  for (const id of Object.keys(moves)) {
    const memo = {};
    for (let i = 0; i <= 240; i++) {
      const u = i / 240;
      const f = frame(
        id,
        {
          walk: 1 - u,
          aim: u,
          idle: 0,
          wind: u,
          strike: Math.sin(u * Math.PI) ** 2,
          since: u * 1.2,
          toHit: 1.2 - u * 1.2,
          hits: 1,
          t: u * 12,
          time: u * 12,
          cycle: u,
          deploy: u,
          dt: i % 17 === 0 ? 0.25 : 1 / 60,
          accel: Math.sin(u * 15) * 100,
          lateral: Math.cos(u * 13) * 100,
          vertical: Math.sin(u * 19) * 100,
          turn: Math.cos(u * 11) * 12,
          flinch: u > 0.5 && u < 0.6 ? 1 : 0,
        },
        memo,
      );
      for (const [key, value] of Object.entries(f.p))
        assert.ok(Number.isFinite(value), `${id} ${key} at ${u}`);
      for (const [key, values] of f.joints)
        assert.ok(values.every(Number.isFinite), `${id} ${key} at ${u}`);
      const arrival = moves[id].arrive(u);
      assert.ok(
        Object.values(arrival).every(Number.isFinite),
        `${id} arrival at ${u}`,
      );
      assert.ok(arrival.squash > 0, `${id} deployment never inverts the model`);
    }
    assert.ok(
      Math.abs(moves[id].arrive(1).drop) < 1e-8,
      `${id} reaches the field`,
    );
  }
});

await test('October movement soft parts react to acceleration and impacts, not just a timer', () => {
  const secondary = {
    diver: 'handR',
    sumo: 'extra',
    linebacker: 'hair',
    beekeeper: 'cape',
    drummer: 'antenna',
    firefighter: 'hat',
    jetpack: 'antenna',
    explorer: 'extra',
    bee: 'antenna',
  };
  for (const [id, part] of Object.entries(secondary)) {
    const neutral = frame(id).joints.get(part);
    const moving = frame(id, {
      accel: 8,
      lateral: 6,
      turn: 1.5,
      vertical: 5,
    }).joints.get(part);
    const hurt = frame(id, { flinch: 1 }).joints.get(part);
    assert.notDeepEqual(
      moving,
      neutral,
      `${id} ${part} responds to body motion`,
    );
    assert.notDeepEqual(hurt, neutral, `${id} ${part} responds to impact`);
  }
});

await test('October movement suppresses optional idle gestures under reduced motion', () => {
  for (const id of Object.keys(moves)) {
    const memo = {};
    const reference = frame(id, { reduced: true, idleFor: 2 }, memo);
    for (let time = 0; time < 12; time += 0.1) {
      const f = frame(
        id,
        { reduced: true, idleFor: time, t: time, time },
        memo,
      );
      for (const [key, value] of Object.entries(f.p))
        assert.ok(
          Math.abs(value - reference.p[key]) < 1e-8,
          `${id} idle ${key}`,
        );
      for (const [key, values] of f.joints) {
        // Wingbeats communicate required flight; cosmetic bob and wander
        // are already covered by the body comparisons above.
        if (id === 'bee' && key.startsWith('wing')) continue;
        const rest = reference.joints.get(key);
        assert.ok(
          values.every((v, i) => Math.abs(v - rest[i]) < 1e-8),
          `${id} idle ${key}`,
        );
      }
    }
  }
});

await test('October movement Sumo keeps the anticipated palm through each alternating slap', () => {
  const wind = frame('sumo', { aim: 1, idle: 0, wind: 1, hits: 0 });
  const right = frame('sumo', {
    aim: 1,
    idle: 0,
    strike: 1,
    hits: 1,
    since: 0.1,
  });
  const left = frame('sumo', {
    aim: 1,
    idle: 0,
    strike: 1,
    hits: 2,
    since: 0.1,
  });
  assert.ok(wind.joints.get('foreR')[0] < wind.joints.get('foreL')[0]);
  assert.ok(right.p.armR > right.p.armL);
  assert.ok(right.joints.get('handR')[0] > right.joints.get('handL')[0]);
  assert.ok(left.p.armL > left.p.armR);
  assert.ok(left.joints.get('handL')[0] > left.joints.get('handR')[0]);
});

await test('October movement tackle memory belongs to one Linebacker and survives its impact', () => {
  const memo = {};
  frame(
    'linebacker',
    { aim: 1, idle: 0, wind: 1, unit: { id: 7, hp: 200, charged: true } },
    memo,
  );
  const tackle = frame(
    'linebacker',
    { aim: 1, idle: 0, strike: 1, hits: 1, since: 0.1 },
    memo,
  );
  const other = frame('linebacker', {
    aim: 1,
    idle: 0,
    strike: 1,
    hits: 1,
    since: 0.1,
  });
  assert.ok(
    tackle.p.lunge > other.p.lunge + 0.1,
    'a charged first hit keeps the full tackle',
  );
  const next = frame(
    'linebacker',
    { aim: 1, idle: 0, strike: 1, hits: 2, since: 0.1 },
    memo,
  );
  assert.equal(
    next.p.lunge,
    other.p.lunge,
    'later hits recover to the forearm blow',
  );
});

await test('October movement Explorer wrist and elbow requests remain continuous while raising the rifle', () => {
  const memo = {};
  let previous;
  for (let i = 0; i <= 360; i++) {
    const a = 0.5 - Math.cos((i / 360) * Math.PI * 2) * 0.5;
    const f = frame('explorer', { aim: a, idle: 1 - a }, memo);
    if (previous)
      for (const part of ['armL', 'armR', 'foreL', 'foreR', 'handL', 'handR']) {
        const now = f.joints.get(part);
        assert.ok(
          now.every((v, axis) => Math.abs(v - previous.get(part)[axis]) < 0.12),
          `${part} cannot flip through an Euler branch`,
        );
      }
    previous = f.joints;
  }
});

let figures;
async function models() {
  if (figures) return figures;
  const manifest = JSON.parse(
    readFileSync(new URL('../lib/games/arena/assets.json', import.meta.url)),
  );
  const data = readFileSync(
    new URL(`../public${manifest.models.figures.path}`, import.meta.url),
  );
  figures = (
    await new GLTFLoader().parseAsync(
      data.buffer.slice(data.byteOffset, data.byteOffset + data.length),
      '',
    )
  ).scene;
  return figures;
}

await test('October model joints articulate actual wrists, accessories and facial paint', async () => {
  const scene = await models();
  for (const id of Object.keys(moves)) {
    const root = scene.getObjectByName(id);
    assert.ok(root, `${id} model exists`);
    const f = frame(id, {
      accel: 5,
      turn: 1,
      deploy: 0.5,
      aim: 0.8,
      since: 0.3,
    });
    for (const part of f.joints.keys())
      assert.ok(
        root.getObjectByName(id + part),
        `${id} requests an actual ${part} joint`,
      );
    for (const side of ['L', 'R']) {
      const eye = root.getObjectByName(id + 'eye' + side);
      const pupil = root.getObjectByName(id + 'pupil' + side);
      assert.ok(eye && pupil, `${id} has an expressive ${side} eye`);
      assert.equal(pupil.parent, eye);
      if (id === 'bee') continue;
      const arm = root.getObjectByName(id + 'arm' + side);
      const fore = root.getObjectByName(id + 'fore' + side);
      const hand = root.getObjectByName(id + 'hand' + side);
      assert.ok(arm && fore && hand, `${id} ${side} arm has all three links`);
      assert.equal(fore.parent, arm);
      assert.equal(hand.parent, fore);
    }
    const weapon = root.getObjectByName(id + 'weapon');
    if (weapon) assert.equal(weapon.parent, root.getObjectByName(id + 'handR'));
    if (id === 'drummer')
      assert.equal(
        root.getObjectByName(id + 'offhand').parent,
        root.getObjectByName(id + 'handL'),
      );
  }
});

function applyPose(root, f, rest) {
  for (const [name, [x, y, z]] of f.joints) {
    const joint = root.getObjectByName(root.name + name);
    const r = rest.get(name);
    joint.rotation.set(r.x + x, r.y + y, r.z + z);
  }
  for (const side of ['L', 'R'])
    if (!f.joints.has('arm' + side)) {
      const r = rest.get('arm' + side);
      root
        .getObjectByName(root.name + 'arm' + side)
        .rotation.set(
          r.x + f.p['arm' + side],
          r.y,
          r.z + f.p['arm' + side + 'z'],
        );
    }
  const torso = rest.get('torso');
  root
    .getObjectByName(root.name + 'torso')
    .rotation.set(
      torso.x - f.p.torsoX,
      torso.y + f.p.torsoY,
      torso.z + f.p.torsoZ,
    );
  root.updateMatrixWorld(true);
}

await test('October model Firefighter and Explorer keep both hands on a level tool throughout aim and recoil', async () => {
  const scene = await models();
  const B = (x, y, z) => new THREE.Vector3(x, z, -y);
  for (const { id, right, direction, span } of [
    {
      id: 'firefighter',
      right: B(0.13, 0.17, 0.7),
      direction: B(-0.2, 1, 0.05).normalize(),
      span: 0.24,
    },
    {
      id: 'explorer',
      right: B(0.12, 0.13, 0.68),
      direction: B(-0.22, 1, 0.32).normalize(),
      span: 0.27,
    },
  ]) {
    const root = scene.getObjectByName(id).clone(true);
    root.updateMatrixWorld(true);
    const rest = new Map();
    root.traverse((o) => rest.set(o.name.slice(id.length), o.rotation.clone()));
    const hand = root.getObjectByName(id + 'handL');
    const tool = root.getObjectByName(id + 'weapon');
    const left = right.clone().addScaledVector(direction, span);
    const onHand = hand.worldToLocal(left.clone());
    const onTool = tool.worldToLocal(left.clone());
    const memo = {};
    for (let i = 0; i <= 120; i++) {
      const a = i / 120;
      const f = frame(
        id,
        { aim: a, idle: 1 - a, since: 0.2, strike: a * 0.6, wind: 0.4 * a },
        memo,
      );
      applyPose(root, f, rest);
      const gap = hand
        .localToWorld(onHand.clone())
        .distanceTo(tool.localToWorld(onTool.clone()));
      assert.ok(gap < 0.0005, `${id} left grip gap ${gap}`);
    }
    const f = frame(id, { aim: 1, idle: 0 }, memo);
    applyPose(root, f, rest);
    const forward = direction
      .clone()
      .applyQuaternion(tool.getWorldQuaternion(new THREE.Quaternion()));
    assert.ok(
      Math.abs(forward.y) < 0.15,
      `${id} aims across the field, pitch ${forward.y}`,
    );
  }
});
