import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import ts from 'typescript';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const manifest = JSON.parse(
  readFileSync(new URL('../lib/games/arena/assets.json', import.meta.url)),
);
const data = readFileSync(
  resolve(root, `public${manifest.models.figures.path}`),
);
const figures = (
  await new GLTFLoader().parseAsync(
    data.buffer.slice(data.byteOffset, data.byteOffset + data.length),
    '',
  )
).scene;
const compiled = new Map();
const LEG_PARTS = ['legL', 'legR', 'kneeL', 'kneeR', 'footL', 'footR'];
const DT = 1 / 60;

/** Load the actual animator and moves. A level test field replaces only
 *  the browser/GPU world; leg geometry comes from the current shipped GLB. */
function runtime(random = 0.5) {
  const modules = new Map();
  const math = Object.create(Math);
  math.random = () => random;
  function load(file) {
    if (file === resolve(root, 'components/game/arena/world.ts'))
      return {
        find: (model, name) => model.getObjectByName(name),
        standHeight: () => 0,
      };
    if (modules.has(file)) return modules.get(file);
    const exports = {};
    modules.set(file, exports);
    if (!compiled.has(file))
      compiled.set(
        file,
        ts.transpileModule(readFileSync(file, 'utf8'), {
          compilerOptions: {
            module: ts.ModuleKind.CommonJS,
            target: ts.ScriptTarget.ES2022,
            esModuleInterop: true,
          },
        }).outputText,
      );
    vm.runInNewContext(compiled.get(file), {
      exports,
      Math: math,
      require(id) {
        if (id === 'three') return THREE;
        const base = id.startsWith('@/')
          ? resolve(root, id.slice(2))
          : resolve(dirname(file), id);
        const path = [base, `${base}.ts`, resolve(base, 'index.ts')].find(
          (candidate) =>
            statSync(candidate, { throwIfNoEntry: false })?.isFile(),
        );
        assert.ok(path, `animation dependency ${id}`);
        return load(path);
      },
    });
    return exports;
  }
  return {
    ...load(resolve(root, 'components/game/arena/troops.ts')),
    ...load(resolve(root, 'components/game/arena/moves/index.ts')),
    ...load(resolve(root, 'lib/games/arena/cards.ts')),
    ...load(resolve(root, 'lib/games/arena/layout.ts')),
    ...load(resolve(root, 'lib/games/arena/engine.ts')),
  };
}

function fixture(card, r = runtime(), dt = DT) {
  const source = figures.getObjectByName(card);
  assert.ok(source, `${card} has a collector model`);
  const model = source.clone(true);
  const group = new THREE.Group();
  const body = new THREE.Group();
  model.scale.set(...r.figureDimensions(r.TROOP_SCALE));
  body.add(model);
  group.add(body);
  const rig = {};
  model.traverse((node) => {
    const part = node.name.startsWith(card) ? node.name.slice(card.length) : '';
    // A one-material joint is itself a Mesh; multi-material joints have
    // child meshes with glTF suffixes (_1, 001). Both joint forms matter.
    if (/^[a-z]+[LR]?[23]?$/.test(part))
      rig[part] = {
        node,
        rest: node.rotation.clone(),
        y: node.position.y,
      };
  });
  const kit = {
    team: 0,
    group,
    body,
    model,
    rig,
    face: {},
    parts: [],
    poses: {},
    drapes: false,
    top: new THREE.Box3().setFromObject(model).max.y,
  };
  // The renderer consumes poses; it does not create or change them.
  const renderer = {
    scale: r.TROOP_SCALE,
    reducedMotion: false,
    modelOf: () => card,
    kit: () => kit,
    add: () => [],
    write: () => group.updateMatrixWorld(true),
    ring() {},
    blob() {},
    colour() {},
    flutter() {},
    remove() {},
  };
  const stats = r.troopCards[card].unit;
  const unit = {
    id: 7,
    side: 0,
    owner: 0,
    card,
    x: 9,
    y: 4,
    px: 9,
    py: 4,
    hp: stats.hp,
    maxHp: stats.hp,
    state: 'walking',
    deployLeft: 0,
    targetId: null,
    attackTimer: stats.firstHit,
    facing: 0,
    sinceHit: 99,
    lane: 0,
    bridge: 3.5,
    power: 1,
    pace: 1,
    shield: stats.shield ?? 0,
    stun: 0,
    dash: false,
    charged: false,
    cooldown: 0,
    raged: false,
    taunt: 0,
    tauntId: null,
    slow: 0,
    slowFactor: 1,
    beat: 1,
  };
  const view = new r.TroopView(renderer, unit.id, card, 0, 0);
  let time = 0;
  function frame({
    state = unit.state,
    speed = 0,
    deployLeft,
    alpha = 1,
    sinceHit,
  } = {}) {
    unit.state = state;
    if (deployLeft !== undefined) unit.deployLeft = deployLeft;
    unit.px = unit.x;
    unit.py = unit.y;
    if (unit.stun <= 0) unit.y += speed * dt;
    unit.sinceHit += dt;
    if (state === 'attacking' && unit.stun <= 0) {
      unit.attackTimer -= dt;
      if (unit.attackTimer <= 0) {
        unit.attackTimer += stats.hitSpeed;
        unit.sinceHit = 0;
      }
    }
    if (sinceHit !== undefined) unit.sinceHit = sinceHit;
    time += dt;
    view.update(unit, alpha, dt, time);
    return {
      angles: Object.fromEntries(
        Object.entries(rig).map(([part, { node, rest }]) => [
          part,
          ['x', 'y', 'z'].map((axis) => node.rotation[axis] - rest[axis]),
        ]),
      ),
      bodyY: body.position.y,
      bodyYaw: body.rotation.y,
      bodyTilt: [body.rotation.x, body.rotation.z],
      bodyScale: body.scale.toArray(),
      matrix: group.matrixWorld.toArray(),
      position: view.position.toArray(),
      phase: view.phase,
      travel: view.travel,
    };
  }
  function run(seconds, options = {}) {
    return Array.from({ length: Math.ceil(seconds / dt) }, () =>
      frame(options),
    );
  }
  function push(dx = 0, dy = 1) {
    const [fx, , fz] = r.toWorld(unit.x, unit.y);
    unit.px = unit.x;
    unit.py = unit.y;
    unit.x += dx;
    unit.y += dy;
    const [x, , z] = r.toWorld(unit.x, unit.y);
    view.knockback(fx, fz, x, z);
    return { from: [fx, fz], to: [x, z] };
  }
  function soles() {
    return ['L', 'R'].map((side) => {
      const foot = rig[`foot${side}`]?.node;
      assert.ok(foot, `${card} has a ${side} foot`);
      const bounds = new THREE.Box3().setFromObject(foot);
      return bounds.min.y;
    });
  }
  function legReach() {
    return ['L', 'R'].map((side) => {
      const hip = rig[`leg${side}`]?.node;
      const knee = rig[`knee${side}`]?.node;
      const foot = rig[`foot${side}`]?.node;
      assert.ok(hip && knee && foot, `${card} has a complete ${side} leg`);
      const a = new THREE.Vector3().setFromMatrixPosition(hip.matrixWorld);
      const b = new THREE.Vector3().setFromMatrixPosition(knee.matrixWorld);
      const c = new THREE.Vector3().setFromMatrixPosition(foot.matrixWorld);
      return {
        reach: a.distanceTo(c),
        length: a.distanceTo(b) + b.distanceTo(c),
      };
    });
  }
  return { view, unit, rig, frame, run, push, soles, legReach, stats };
}

function range(frames, part, axis = 0) {
  assert.ok(frames[0].angles[part], `${part} is present in the model`);
  const values = frames.map((f) => f.angles[part][axis]);
  return Math.max(...values) - Math.min(...values);
}

function animated(frames, part, minimum = 0.02) {
  assert.ok(
    Math.max(...[0, 1, 2].map((axis) => range(frames, part, axis))) > minimum,
    `${part} moves through the animation`,
  );
}

function walkingLegs(frames, name) {
  for (const part of LEG_PARTS)
    assert.ok(
      range(frames, part) > 0.1,
      `${name} ${part} keeps walking: range ${range(frames, part)}`,
    );
}

function finite(frames, name) {
  for (const frame of frames)
    assert.ok(
      [
        frame.bodyY,
        frame.bodyYaw,
        ...frame.bodyTilt,
        ...frame.bodyScale,
        ...frame.matrix,
        ...frame.position,
        frame.phase,
        frame.travel,
        ...Object.values(frame.angles).flat(),
      ].every(Number.isFinite),
      `${name} produces finite transforms`,
    );
}

function grounded(f, name) {
  for (const [i, y] of f.soles().entries())
    assert.ok(
      y > -0.08 && y < 0.18,
      `${name} sole ${i} stays at the ground (${y})`,
    );
  for (const { reach, length } of f.legReach())
    assert.ok(
      reach > length * 0.35 && reach <= length * 1.001,
      `${name} keeps a formed leg (${reach} of ${length})`,
    );
}

await test('Cowboy and Samurai walk with both thighs, knees and ankles while their soft parts move', () => {
  for (const { card, accessories } of [
    {
      card: 'ranger',
      accessories: ['cape2', 'beard', 'skirtL', 'skirtR', 'hat'],
    },
    {
      card: 'duelist',
      accessories: ['sleeveL', 'sleeveR', 'skirtL', 'skirtR', 'beard', 'cape'],
    },
  ]) {
    const f = fixture(card);
    f.run(1, { state: 'walking', speed: f.stats.speed });
    const frames = f.run(3, { speed: f.stats.speed });
    walkingLegs(frames, card);
    for (const part of [...accessories, 'head', 'torso'])
      animated(frames, part);
  }
});

await test('secondary joint requests keep independent ownership of the body, head and every gait joint', () => {
  const r = runtime();
  const own = r.moves.ranger;
  const original = own.pose;
  own.pose = (c, p) => {
    original(c, p);
    p.torsoX = 0.17;
    p.torsoY = 0.22;
    p.torsoZ = -0.09;
    p.headX = 0.23;
    p.headY = -0.31;
    // These are legitimate named secondary joints in the animation API.
    // They used to suppress all six leg joints, the torso and the head.
    for (const part of [
      'cape2',
      'antenna',
      'sleeveL',
      'sleeveR',
      'handL',
      'handR',
      'extra2',
    ])
      c.want(part, 0.12, 0.08, -0.06);
  };
  const f = fixture('ranger', r);
  const first = f.frame();
  for (const [part, axis, expected] of [
    ['torso', 0, -0.17],
    ['torso', 1, 0.22],
    ['torso', 2, -0.09],
    ['head', 0, -0.23],
    ['head', 1, -0.31],
  ])
    assert.ok(Math.abs(first.angles[part][axis] - expected) < 1e-6, part);
  const frames = f.run(4, { state: 'walking', speed: f.stats.speed });
  walkingLegs(frames.slice(60), 'secondary joints');
});

await test('the Cowboy keeps his head alive and works the rifle lever between shots', () => {
  const f = fixture('ranger');
  f.run(2, { state: 'walking', speed: f.stats.speed });
  const frames = f.run(4, { state: 'attacking' }).slice(60);
  for (const part of ['head', 'torso', 'weapon', 'extra2'])
    animated(frames, part, 0.08);
});

await test('the whole Cowboy rifle clears his shirt and coat while lifting, lowering and reversing', () => {
  // Closed cross-sections of the approved shirt and upper duster, from
  // figure_ranger.py: height, half-width, front depth, back depth. Testing
  // every gun/lever vertex against these envelopes is linear in the rifle
  // geometry, rather than comparing every rifle and torso triangle pair.
  const shirt = [
    [0.575, 0.126, 0.097, 0.1],
    [0.64, 0.13, 0.1, 0.098],
    [0.7, 0.136, 0.104, 0.098],
    [0.78, 0.148, 0.112, 0.1],
    [0.86, 0.157, 0.118, 0.103],
    [0.92, 0.161, 0.12, 0.105],
    [0.965, 0.154, 0.106, 0.099],
    [1, 0.108, 0.078, 0.074],
    [1.035, 0.056, 0.052, 0.052],
  ];
  const coat = [
    [0.47, 0.216, 0.162, 0.167],
    [0.56, 0.2, 0.15, 0.152],
    [0.64, 0.19, 0.143, 0.141],
    [0.72, 0.184, 0.14, 0.133],
    [0.8, 0.186, 0.142, 0.131],
    [0.88, 0.19, 0.143, 0.131],
    [0.94, 0.203, 0.138, 0.129],
    [0.98, 0.218, 0.125, 0.121],
    [1.006, 0.188, 0.105, 0.105],
    [1.021, 0.128, 0.087, 0.091],
    [1.032, 0.084, 0.07, 0.08],
  ];
  const phases = [
    { name: 'ready', seconds: 0.3, moving: false, aiming: false },
    { name: 'lift', seconds: 1.4, moving: true, aiming: false },
    { name: 'lower', seconds: 1.4, moving: false, aiming: false },
    { name: 'partial lift', seconds: 0.24, moving: true, aiming: false },
    { name: 'reverse down', seconds: 0.2, moving: false, aiming: false },
    { name: 'reverse up', seconds: 0.24, moving: true, aiming: false },
    { name: 'settle', seconds: 0.8, moving: false, aiming: false },
    { name: 'carry', seconds: 1.4, moving: true, aiming: false },
    { name: 'lower to aim', seconds: 0.2, moving: false, aiming: true },
    { name: 'reverse to carry', seconds: 0.3, moving: true, aiming: false },
    { name: 'aim and fire', seconds: 1.4, moving: false, aiming: true },
    { name: 'return to carry', seconds: 1.4, moving: true, aiming: false },
  ];
  function clearance(rows, power, point, waist) {
    // glTF is y-up and faces -z; the sculpture's sections are z-up,
    // facing +y, with the torso pivot at the waist.
    const height = point.y + waist;
    if (height < rows[0][0] || height > rows.at(-1)[0]) return Infinity;
    let i = 1;
    while (rows[i][0] < height) i++;
    const a = rows[i - 1];
    const b = rows[i];
    const t = (height - a[0]) / (b[0] - a[0]);
    const width = a[1] + (b[1] - a[1]) * t;
    const depth = point.z <= 0 ? 2 : 3;
    const radius = a[depth] + (b[depth] - a[depth]) * t;
    return (
      ((Math.abs(point.x) / width) ** power +
        (Math.abs(point.z) / radius) ** power) **
        (1 / power) -
      1
    );
  }
  const r = runtime();
  const inverse = new THREE.Matrix4();
  const local = new THREE.Matrix4();
  const point = new THREE.Vector3();
  for (const hz of [30, 60, 120]) {
    const f = fixture('ranger', r, 1 / hz);
    const meshes = [];
    f.rig.weapon.node.traverse((node) => {
      if (node.isMesh) meshes.push(node);
    });
    assert.ok(
      meshes.some((mesh) => mesh === f.rig.extra2.node),
      'the lever is checked too',
    );
    let minimum = Infinity;
    let worst = '';
    const holds = {};
    for (const phase of phases) {
      for (let frame = 0; frame < Math.ceil(phase.seconds * hz); frame++) {
        f.frame({
          state: phase.aiming ? 'attacking' : 'walking',
          speed: phase.moving ? f.stats.speed : 0,
        });
        inverse.copy(f.rig.torso.node.matrixWorld).invert();
        for (const mesh of meshes) {
          local.copy(inverse).multiply(mesh.matrixWorld);
          const positions = mesh.geometry.getAttribute('position');
          for (let i = 0; i < positions.count; i++) {
            point.fromBufferAttribute(positions, i).applyMatrix4(local);
            const gap = Math.min(
              clearance(shirt, 2.3, point, f.rig.torso.y),
              clearance(coat, 2.2, point, f.rig.torso.y),
            );
            if (gap < minimum) {
              minimum = gap;
              worst = `${phase.name}, frame ${frame}, ${mesh.name}`;
            }
          }
        }
      }
      holds[phase.name] = new THREE.Quaternion().setFromRotationMatrix(
        local.copy(inverse).multiply(f.rig.weapon.node.matrixWorld),
      );
    }
    assert.ok(
      holds.ready.angleTo(holds.lift) > 1,
      'the rifle reaches its shoulder hold',
    );
    assert.ok(
      holds.ready.angleTo(holds.lower) < 0.2,
      'the rifle returns to the ready hold',
    );
    assert.ok(
      Number.isFinite(minimum),
      'the rifle crosses the body-height range',
    );
    assert.ok(
      minimum >= 0,
      `${hz} Hz: rifle penetrates the body at ${worst} (${minimum})`,
    );
  }
});

await test('a Samurai deployment owns its crouched legs, then releases them back to walking', () => {
  const r = runtime();
  const own = r.moves.duelist;
  const original = own.pose;
  const requested = new Map();
  own.pose = (c, p) => {
    requested.clear();
    original(
      {
        ...c,
        want(part, ...turns) {
          requested.set(part, turns);
          c.want(part, ...turns);
        },
      },
      p,
    );
  };
  const f = fixture('duelist', r);
  const crouch = f.frame({ state: 'deploying', deployLeft: 0.5 });
  for (const part of LEG_PARTS) {
    assert.ok(requested.has(part), `${part} belongs to the landing crouch`);
    assert.ok(
      Math.abs(crouch.angles[part][0] - requested.get(part)[0]) < 1e-6,
      `${part} keeps its requested deployment pose`,
    );
  }
  f.unit.deployLeft = 0;
  f.run(1, { state: 'walking', speed: f.stats.speed });
  const frames = f.run(3, { speed: f.stats.speed });
  assert.ok(LEG_PARTS.every((part) => !requested.has(part)));
  walkingLegs(frames, 'landed Samurai');
});

await test('Cadets land once without a second hop or spin, then walk with a moving wrist', () => {
  const r = runtime();
  const f = fixture('archers', r);
  for (let i = 0; i <= 60; i++) {
    const d = i / 60;
    const frame = f.frame({
      state: 'deploying',
      deployLeft: (1 - d) * r.DEPLOY_TIME,
    });
    assert.ok(
      Math.abs(frame.bodyYaw) < 1e-6,
      'arrival keeps the cadet facing forward',
    );
    if (d >= 0.26)
      assert.ok(
        frame.bodyY < 0.03,
        `no airborne rebound after contact at ${d}`,
      );
  }
  f.run(1, { state: 'walking', speed: f.stats.speed });
  const frames = f.run(3, { speed: f.stats.speed });
  walkingLegs(frames, 'Cadet');
  animated(frames, 'handL', 0.08);
  animated(frames, 'antenna');
});

await test('every Cadet idle fidget stays grounded while the hands and head keep moving', () => {
  // Fixed random choices cover the four fidgets and the former hopping
  // choice near the top of the random range, without nondeterministic QA.
  for (const random of [0.02, 0.26, 0.51, 0.98]) {
    const f = fixture('archers', runtime(random));
    const frames = f.run(18);
    assert.ok(
      frames.every((frame) => frame.bodyY < 0.03),
      `idle choice ${random} never lifts the body into a hop`,
    );
    animated(frames, 'head', 0.1);
    animated(frames, 'weapon', 0.1);
  }
});

await test('every field troop keeps finite poses through deployment, walking, fighting, stopping and hits', () => {
  const r = runtime();
  for (const card of r.troopDeck) {
    const f = fixture(card, r);
    const deploying = Array.from({ length: 61 }, (_, i) =>
      f.frame({
        state: 'deploying',
        deployLeft: (1 - i / 60) * (f.stats.burrow ?? r.DEPLOY_TIME),
      }),
    );
    const frames = [
      ...deploying,
      ...f.run(2, { state: 'walking', speed: f.stats.speed }),
      ...f.run(2, { state: 'attacking' }),
      ...f.run(2, { state: 'walking' }),
    ];
    f.view.hit();
    frames.push(...f.run(1));
    finite(frames, card);
  }
});

await test('stun stops every custom action and walk even when the engine keeps its last state', () => {
  for (const state of ['walking', 'attacking']) {
    const r = runtime();
    for (const card of r.troopDeck) {
      const own = r.moves[card];
      const original = own.pose;
      let calls = 0;
      own.pose = (c, p) => {
        calls++;
        original(c, p);
      };
      const f = fixture(card, r);
      f.run(0.8, { state, speed: state === 'walking' ? f.stats.speed : 0 });
      const before = f.view.position.clone();
      const called = calls;
      assert.ok(called > 0, `${card} has its own action before the stun`);
      f.unit.stun = 3;
      // An apparent fresh swing/pulse must not restart the custom move
      // while the stopped unit still has its old walking/attacking state.
      const frames = f.run(2, { state, speed: f.stats.speed, sinceHit: 0 });
      assert.equal(
        calls,
        called,
        `${card} custom actions stop during ${state}`,
      );
      assert.ok(
        frames.every((frame) =>
          new THREE.Vector3(...frame.position).equals(before),
        ),
        `${card} stops moving while stunned`,
      );
      assert.equal(f.view.faceWind, 0, `${card} has no false wind-up`);
      assert.equal(f.view.faceStrike, 0, `${card} has no false strike`);
      const held = frames.slice(90);
      for (const part of [
        'armL',
        'armR',
        'foreL',
        'foreR',
        'weapon',
        'offhand',
        'extra',
      ]) {
        if (!f.rig[part]) continue;
        assert.ok(
          Math.max(...[0, 1, 2].map((axis) => range(held, part, axis))) < 0.005,
          `${card} ${part} holds its interrupted action`,
        );
      }
      finite(frames, `${card} stunned ${state}`);
      f.unit.stun = 0;
      const resumed = f.run(1.2, {
        state,
        speed: state === 'walking' ? f.stats.speed : 0,
      });
      assert.ok(
        calls > called,
        `${card} resumes its own actions after the stun`,
      );
      if (state === 'walking')
        assert.ok(!f.view.position.equals(before), `${card} walks again`);
      finite(resumed, `${card} resumed ${state}`);
    }
  }
});

await test('stopping for a stun settles planted feet without a continuing stride and lets them walk again', () => {
  const r = runtime();
  for (const card of [
    'archers',
    'duelist',
    'pirate',
    'sumo',
    'linebacker',
    'medic',
    'drummer',
    'firefighter',
  ]) {
    const f = fixture(card, r);
    f.run(0.73, { speed: f.stats.speed });
    f.unit.stun = 3;
    const stopped = f.run(1.5);
    const stable = stopped.slice(60);
    assert.ok(
      stable.every((frame) => frame.phase === stable[0].phase),
      `${card} ends its last step`,
    );
    grounded(f, `${card} stunned`);
    f.unit.stun = 0;
    const resumed = f.run(2, { speed: f.stats.speed });
    walkingLegs(resumed.slice(30), `${card} resumed`);
    finite(resumed, `${card} after stun`);
  }
});

await test('knockback skids ground and flying troops to the exact destination without adding a walk stride', () => {
  const r = runtime();
  for (const hz of [30, 60, 120]) {
    for (const card of [
      'archers',
      'ranger',
      'pirate',
      'firefighter',
      'drake',
      'jetpack',
      'bee',
    ]) {
      const f = fixture(card, r, 1 / hz);
      const before = f.run(1.3).at(-1);
      const impulse = f.push(0.4, 1.5);
      const first = f.frame({ alpha: 0.25 });
      const start = new THREE.Vector2(...impulse.from);
      const end = new THREE.Vector2(...impulse.to);
      const shown = new THREE.Vector2(first.position[0], first.position[2]);
      const distance = start.distanceTo(end);
      assert.ok(shown.distanceTo(start) > 0, `${card} starts its skid`);
      assert.ok(
        shown.distanceTo(end) > distance * 0.3,
        `${card} does not teleport on the first frame at ${hz} Hz`,
      );
      const frames = [first, ...f.run(0.45)];
      assert.ok(
        frames.every((frame) => frame.travel === before.travel),
        `${card} does not walk the shove distance`,
      );
      assert.ok(
        frames.every((frame) => frame.phase === before.phase),
        `${card} does not stride during the shove`,
      );
      assert.ok(
        frames.some(
          (frame) =>
            Math.hypot(
              frame.bodyTilt[0] - before.bodyTilt[0],
              frame.bodyTilt[1] - before.bodyTilt[1],
            ) > 0.01,
        ),
        `${card} recoils from the impulse`,
      );
      assert.deepEqual(
        [frames.at(-1).position[0], frames.at(-1).position[2]],
        impulse.to,
        `${card} finishes at the engine destination at ${hz} Hz`,
      );
      if (!f.stats.flying) grounded(f, `${card} after knockback at ${hz} Hz`);
      else
        assert.ok(
          frames.every((frame) => frame.bodyY > 0.8),
          `${card} remains airborne`,
        );
      finite(frames, `${card} pushed at ${hz} Hz`);
      const resumed = f.run(1.5, { speed: f.stats.speed });
      assert.ok(
        resumed.at(-1).travel > before.travel,
        `${card} moves normally after the skid`,
      );
      if (!f.stats.flying) walkingLegs(resumed.slice(30), `${card} after push`);
    }
  }
});

await test('repeated small water impulses remain continuous while normal or stunned, including flyers', () => {
  const r = runtime();
  for (const card of ['pirate', 'jetpack']) {
    for (const stunned of [false, true]) {
      const f = fixture(card, r);
      const before = f.run(1.3).at(-1);
      if (stunned) f.unit.stun = 3;
      const frames = [];
      let destination;
      for (let i = 0; i < 8; i++) {
        const prior = f.view.position.clone();
        destination = f.push(0.04, 0.18).to;
        const first = f.frame();
        assert.ok(
          f.view.position.distanceTo(prior) < 0.2,
          `${card} keeps the previous skid continuous instead of jumping to the next impulse`,
        );
        frames.push(first, ...f.run(2 * DT));
      }
      frames.push(...f.run(0.3));
      assert.deepEqual([f.view.position.x, f.view.position.z], destination);
      assert.ok(
        frames.every((frame) => frame.travel === before.travel),
        `${card} water impulses add no walked distance`,
      );
      if (!f.stats.flying) grounded(f, `${card} after repeated water impulses`);
      finite(
        frames,
        `${card} repeated pushes ${stunned ? 'stunned' : 'awake'}`,
      );
    }
  }
});

await test('a sideways impulse recoils to the side while stunned, without restarting a move', () => {
  const f = fixture('pirate');
  f.run(1.3);
  f.unit.stun = 3;
  const before = f.run(1).at(-1);
  const impulse = f.push(1.5, 0);
  const frames = f.run(0.4);
  assert.ok(
    frames.some(
      (frame) => Math.abs(frame.bodyTilt[1] - before.bodyTilt[1]) > 0.01,
    ),
    'a stunned body still reacts in the lateral direction of the push',
  );
  assert.equal(f.view.faceStrike, 0, 'the recoil does not restart a strike');
  assert.deepEqual([f.view.position.x, f.view.position.z], impulse.to);
  grounded(f, 'sideways stunned Pirate');
});
