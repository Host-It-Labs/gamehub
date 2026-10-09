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

const shippedManifest = JSON.parse(
  readFileSync(new URL('../lib/games/arena/assets.json', import.meta.url)),
);
const shippedBytes = readFileSync(
  new URL(`../public${shippedManifest.models.figures.path}`, import.meta.url),
);
const shipped = (
  await new GLTFLoader().parseAsync(
    shippedBytes.buffer.slice(
      shippedBytes.byteOffset,
      shippedBytes.byteOffset + shippedBytes.length,
    ),
    '',
  )
).scene;

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
    // The runtime's rest offsets, read from the shipped figure.
    rest(part) {
      const node = shipped.getObjectByName(id)?.getObjectByName(id + part);
      return node ? [node.position.x, node.position.y, node.position.z] : null;
    },
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
    // The 9 October Diver grips his wrench through reach; his air hose
    // (cape) and beard are the parts that trail.
    diver: 'cape',
    sumo: 'extra',
    linebacker: 'hair',
    beekeeper: 'cape',
    drummer: 'antenna',
    firefighter: 'hat',
    jetpack: 'cape', // the 9 October rebuild's scarf
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

/** The shipped Sumo's arm joints in their parents (three.js axes), for
 *  the reach solver and for forward kinematics below. */
const SUMO_REST = {
  foreL: [-0.183, -0.244, -0.051],
  handL: [-0.037, -0.239, -0.045],
  foreR: [0.183, -0.244, -0.051],
  handR: [0.037, -0.239, -0.045],
};
/** The wrist (from the shoulder) and the palm's facing for one side. */
function sumoHand(f, side) {
  const q = (part) =>
    new THREE.Quaternion().setFromEuler(
      new THREE.Euler(...f.joints.get(part).slice(0, 3)),
    );
  const arm = q(`arm${side}`);
  const fore = arm.clone().multiply(q(`fore${side}`));
  const elbow = new THREE.Vector3(...SUMO_REST[`fore${side}`]).applyQuaternion(
    arm,
  );
  const wrist = elbow.add(
    new THREE.Vector3(...SUMO_REST[`hand${side}`]).applyQuaternion(fore),
  );
  const palm = new THREE.Vector3(0, 0, -1).applyQuaternion(
    fore.multiply(q(`hand${side}`)),
  );
  const upper = new THREE.Vector3(...SUMO_REST[`fore${side}`]).applyQuaternion(
    arm,
  );
  const hinge = new THREE.Vector3(1, 0, 0).applyQuaternion(arm);
  return { wrist, palm, upper, hinge };
}

await test('October movement Sumo chambers each palm, then drives it out flat and alternates hands (9 October)', () => {
  const rest = (part) => SUMO_REST[part] ?? null;
  for (const hits of [1, 2]) {
    const active = hits === 1 ? 'R' : 'L';
    const inactive = hits === 1 ? 'L' : 'R';
    const guard = frame('sumo', { aim: 1, idle: 0, hits: hits - 1, rest });
    const wind = frame('sumo', {
      aim: 1,
      idle: 0,
      wind: 1,
      hits: hits - 1,
      rest,
    });
    const impact = frame('sumo', {
      aim: 1,
      idle: 0,
      strike: 1,
      hits,
      since: 0.05,
      rest,
    });
    const g = sumoHand(guard, active);
    const w = sumoHand(wind, active);
    const i = sumoHand(impact, active);
    const other = sumoHand(impact, inactive);
    // Forward is -z: the striking wrist draws back to chamber, then drives
    // well past the guard, further forward than the other hand.
    assert.ok(
      w.wrist.z > g.wrist.z + 0.05,
      `${active} palm chambers before its hit`,
    );
    assert.ok(
      i.wrist.z < g.wrist.z - 0.08,
      `${active} palm drives out on the hit`,
    );
    assert.ok(
      i.wrist.z < other.wrist.z - 0.1,
      `${active} leads; ${inactive} is drawn back`,
    );
    // The heel of the hand leads: the palm faces forward on impact.
    assert.ok(i.palm.z < -0.6, `${active} palm faces the target on impact`);
    // The hands never swap mid-blow: the chambered hand is the one landing.
    assert.ok(
      sumoHand(wind, inactive).wrist.z < w.wrist.z,
      'the anticipated hand is the striking hand',
    );
  }
  // Elbows bend one way only: the forearm never folds behind the upper arm
  // (its bend about the arm's own hinge stays positive) through a cycle.
  for (let k = 0; k <= 20; k++) {
    const f = frame('sumo', {
      aim: 1,
      idle: 0,
      wind: k < 10 ? k / 10 : 0,
      strike: k >= 10 ? 1 - (k - 10) / 10 : 0,
      hits: k >= 10 ? 1 : 0,
      since: k >= 10 ? (k - 10) * 0.03 : 99,
      rest,
    });
    for (const side of ['L', 'R']) {
      const { wrist, upper, hinge } = sumoHand(f, side);
      const forearm = wrist.clone().sub(upper);
      // A forward flexion about the arm's own +x hinge puts the cross
      // product of upper arm and forearm along that hinge.
      const fold = upper.clone().normalize().cross(forearm.normalize());
      assert.ok(fold.dot(hinge) > -0.05, `${side} elbow never bends backwards`);
    }
  }
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
      assert.equal(pupil.parent?.name, eye?.name);
      if (id === 'bee') continue;
      const arm = root.getObjectByName(id + 'arm' + side);
      const fore = root.getObjectByName(id + 'fore' + side);
      const hand = root.getObjectByName(id + 'hand' + side);
      assert.ok(arm && fore && hand, `${id} ${side} arm has all three links`);
      assert.equal(fore.parent?.name, arm?.name);
      assert.equal(hand.parent?.name, fore?.name);
    }
    const weapon = root.getObjectByName(id + 'weapon');
    if (weapon)
      assert.equal(
        weapon.parent?.name,
        root.getObjectByName(id + 'handR')?.name,
      );
    if (id === 'drummer')
      assert.equal(
        root.getObjectByName(id + 'offhand').parent,
        root.getObjectByName(id + 'handL'),
      );
  }
});

// The two-hand tool test that lived here measured grip points on the
// 1 October Firefighter and Explorer sculpts; both were rebuilt on
// 9 October and their reach probes check the grips instead
// (work/arena/2026-10-08-roster/{firefighter,explorer}/probe-next.mjs).
