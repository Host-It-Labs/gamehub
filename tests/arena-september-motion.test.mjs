import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { pirate } from '../components/game/arena/moves/pirate.ts';
import { viking } from '../components/game/arena/moves/viking.ts';
import { gladiator } from '../components/game/arena/moves/gladiator.ts';
import { medic } from '../components/game/arena/moves/medic.ts';
import { miner } from '../components/game/arena/moves/miner.ts';
import { balloon } from '../components/game/arena/moves/balloon.ts';
import { inventor } from '../components/game/arena/moves/inventor.ts';
import { gunner } from '../components/game/arena/moves/gunner.ts';

const moves = {
  pirate,
  viking,
  gladiator,
  medic,
  miner,
  balloon,
  inventor,
  gunner,
};
const parts = {
  pirate: { hat: 'head', tail: 'head', tail2: 'tail', tail3: 'tail2' },
  viking: { beard: 'head' },
  gladiator: { hair: 'head' },
  medic: { hat: 'head', hair: 'head', foreL: 'armL', weapon: 'foreR' },
  miner: { hat: 'head', foreL: 'armL', weapon: 'foreR' },
  balloon: { hair: 'head', cape: 'basket', foreL: 'armL', foreR: 'armR' },
  inventor: { hat: 'head', hair: 'head', foreL: 'armL', weapon: 'foreR' },
  gunner: { hat: 'head', foreL: 'armL', foreR: 'armR' },
};

function pose(card, extra = {}, memo = {}) {
  const requested = new Map();
  const p = Object.fromEntries(
    [
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
      'yawKick',
      'lift',
    ].map((key) => [key, 0]),
  );
  p.squash = 1;
  const context = {
    unit: {
      id: 7,
      card,
      hp: 1000,
      maxHp: 1000,
      shield: 200,
      dash: false,
      cooldown: 1,
      facing: 0,
      state: 'walking',
    },
    walk: 0,
    aim: 0,
    idle: 1,
    wind: 0,
    strike: 0,
    since: 99,
    toHit: 1,
    hits: 0,
    t: 2,
    dt: 1 / 60,
    cycle: 0.2,
    fwdL: 0.6,
    fwdR: -0.6,
    pass: 0.7,
    hipL: 0.25,
    hipR: -0.25,
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
    idleFor: 4,
    flinch: 0,
    time: 2,
    reduced: false,
    deploy: 1,
    memo,
    want(part, x = 0, y = 0, z = 0, lift = 0) {
      requested.set(part, [x, y, z, lift]);
    },
    ...extra,
  };
  moves[card].pose(context, p);
  return { p, requested, context };
}

const values = ({ p, requested }) => [
  ...Object.values(p),
  ...[...requested.values()].flat(),
];
const distance = (a, b) => Math.max(...a.map((v, i) => Math.abs(v - b[i])));

await test('September troops retain finite poses through arrivals, attacks, impulses and recovery', () => {
  for (const card of Object.keys(moves)) {
    for (const hz of [30, 60, 120]) {
      const memo = {};
      for (let i = 0; i < hz * 6; i++) {
        const time = i / hz;
        const cycle = (time * 1.7) % 1;
        const c = pose(
          card,
          {
            dt: 1 / hz,
            t: time,
            time,
            deploy: Math.min(1, time * 2),
            walk: time > 1 && time < 2 ? 1 : 0,
            aim: time > 2 && time < 4 ? 1 : 0,
            idle: time >= 4 ? 1 : 0,
            cycle,
            pass: Math.abs(Math.sin(cycle * Math.PI * 2)),
            hipL: Math.sin(cycle * Math.PI * 2) * 0.4,
            hipR: -Math.sin(cycle * Math.PI * 2) * 0.4,
            since: time > 2 && time < 4 ? (time - 2) % 1.2 : 99,
            wind: time > 3.7 && time < 4 ? (time - 3.7) / 0.3 : 0,
            turn: Math.sin(time) * 2,
            accel: Math.sin(time * 2) * 8,
            lateral: Math.cos(time) * 5,
            vertical: Math.sin(time * 3) * 10,
            flinch: time > 4 && time < 4.25 ? 1 - (time - 4) * 4 : 0,
            idleFor: Math.max(0, time - 4),
          },
          memo,
        );
        assert.ok(
          values(c).every(Number.isFinite),
          `${card}, ${hz} Hz, ${time}`,
        );
        assert.ok(
          c.p.squash > 0.7 && c.p.squash < 1.3,
          `${card} stays proportionate`,
        );
      }
      for (let d = 0; d <= 1; d += 0.01) {
        const arrival = moves[card].arrive(d);
        assert.ok(
          Object.values(arrival).every(Number.isFinite),
          `${card} arrival`,
        );
      }
    }
  }
});

await test('an attack passes continuously from anticipation into its matching strike', () => {
  for (const card of [
    'pirate',
    'viking',
    'gladiator',
    'miner',
    'inventor',
    'balloon',
  ]) {
    const before = pose(card, { aim: 1, idle: 0, wind: 1, hits: 0 });
    const after = pose(card, { aim: 1, idle: 0, since: 0, wind: 0, hits: 1 });
    assert.ok(
      distance(Object.values(before.p), Object.values(after.p)) < 0.12,
      `${card} does not reset to guard on the hit`,
    );
    for (const [part, turns] of before.requested) {
      if (!after.requested.has(part)) continue;
      assert.ok(
        distance(turns, after.requested.get(part)) < 0.12,
        `${card} ${part} keeps the wound pose as the strike begins`,
      );
    }
  }
});

await test('every September troop suppresses discretionary idle motion when reduced motion is on', () => {
  for (const card of Object.keys(moves)) {
    const a = pose(card, { reduced: true, t: 1, idleFor: 2 });
    const b = pose(card, { reduced: true, t: 81, idleFor: 82 });
    assert.ok(distance(values(a), values(b)) < 1e-12, `${card} idle is still`);
  }
});

await test('ground troops have visible idle gestures without idle hops', () => {
  for (const card of Object.keys(moves).filter((id) => id !== 'balloon')) {
    const memo = {};
    const frames = Array.from({ length: 720 }, (_, i) =>
      pose(card, { t: i / 60, idleFor: i / 60 }, memo),
    );
    const gesture = Math.max(
      ...['headY', 'headX', 'armL', 'armR'].map((key) => {
        const angles = frames.map((frame) => frame.p[key]);
        return Math.max(...angles) - Math.min(...angles);
      }),
    );
    assert.ok(gesture > 0.1, `${card} has a deliberate idle gesture`);
    assert.ok(
      frames.every(({ p }) => Math.abs(p.lift) < 0.03),
      `${card} keeps its feet on the field while waiting`,
    );
  }
});

await test('the Medic keeps her flask upright through steps, preparation, healing and recovery', () => {
  for (const since of [0, 0.08, 0.2, 0.4, 0.65, 99]) {
    const c = pose('medic', {
      walk: 1,
      idle: 0,
      since,
      swingR: 0.18,
      accel: 4,
      turn: 1,
      flinch: 0.3,
    });
    const fore = c.requested.get('foreR')[0];
    const tilt = c.p.armR + fore + c.p.weapon - c.p.torsoX - c.p.lean;
    assert.ok(
      Math.abs(tilt) < 1e-10,
      `the flask is level ${since}s after a pulse`,
    );
  }
});

await test('secondary motion responds to actual starts, turns and hits while leaving walking legs to the solver', () => {
  const secondary = {
    pirate: 'tail2',
    viking: 'beard',
    gladiator: 'hair',
    medic: 'hair',
    miner: 'hat',
    balloon: 'basket',
    inventor: 'extra',
    gunner: 'hat',
  };
  for (const [card, joint] of Object.entries(secondary)) {
    const a = pose(card, { walk: 1, idle: 0 });
    const impulses = [{ accel: 8 }, { turn: 3 }, { flinch: 0.9 }].map(
      (impulse) => pose(card, { walk: 1, idle: 0, ...impulse }),
    );
    assert.ok(
      Math.max(
        ...impulses.map((b) =>
          distance(a.requested.get(joint), b.requested.get(joint)),
        ),
      ) > 0.02,
      `${card} ${joint} responds to the body`,
    );
    for (const b of impulses)
      for (const part of ['legL', 'legR', 'kneeL', 'kneeR', 'footL', 'footR'])
        assert.ok(
          !b.requested.has(part),
          `${card} ${part} remains planted by the walk solver`,
        );
  }
});

await test('a reused troop id cannot inherit another Pirate leap or Gladiator shield state', () => {
  const firstPirate = {};
  const firstGladiator = {};
  const unit = { id: 7, hp: 1000, maxHp: 1000, shield: 200, dash: true };
  pose('pirate', { unit }, firstPirate);
  const otherPirate = pose('pirate', { unit: { ...unit, dash: false } });
  assert.ok(
    !otherPirate.requested.has('legL'),
    'the next Pirate keeps its planted legs',
  );
  pose('gladiator', { unit, aim: 1, idle: 0 }, firstGladiator);
  let spent;
  for (let i = 0; i < 90; i++)
    spent = pose(
      'gladiator',
      { unit: { ...unit, shield: 0 }, aim: 1, idle: 0 },
      firstGladiator,
    );
  const preview = pose('gladiator', {
    unit: { ...unit, shield: 0 },
    aim: 1,
    idle: 0,
  });
  assert.ok(
    preview.p.armL > spent.p.armL + 0.3,
    'a fresh preview keeps its shield while the old troop lowers the spent one',
  );
});

await test('the Pirate releases both legs after her leap so the shared walk can plant them again', () => {
  const memo = {};
  const unit = { id: 7, hp: 1000, maxHp: 1000, shield: 0, dash: true };
  const airborne = pose('pirate', { unit, walk: 1, idle: 0 }, memo);
  assert.ok(airborne.requested.has('legL') && airborne.requested.has('legR'));
  let landed;
  for (let i = 0; i < 60; i++)
    landed = pose(
      'pirate',
      { unit: { ...unit, dash: false }, walk: 1, idle: 0 },
      memo,
    );
  assert.ok(!landed.requested.has('legL') && !landed.requested.has('legR'));
});

await test('the Gunner arm goals keep both fists on the cannon bar through bracing and recoil', () => {
  // Independent forward kinematics of the sculpt, in Blender's forward/up
  // coordinates. These values come from the builder's actual shoulder,
  // elbow and grip, including the wrist rather than only the forearm.
  const shoulder = [0.05819674358984617, 0.9793962909515376];
  const upper = [0.08680141806954098, -0.2199351928550488];
  const lower = [0.20500183834061284, -0.11946109809648875];
  const rotate = ([y, z], a) => [
    y * Math.cos(a) - z * Math.sin(a),
    y * Math.sin(a) + z * Math.cos(a),
  ];
  for (let i = 0; i <= 210; i++) {
    const since = i / 60;
    const c = pose('gunner', {
      aim: 1,
      idle: 0,
      since,
      wind: since > 2.9 ? (since - 2.9) / 0.6 : 0,
    });
    const bar = rotate([-0.25, 0.47], c.p.offhand);
    const expected = [bar[0] + 0.6, bar[1] + 0.17];
    for (const side of ['L', 'R']) {
      const arm = c.requested.get(`arm${side}`)[0];
      const fore = c.requested.get(`fore${side}`)[0];
      const u = rotate(upper, arm);
      const f = rotate(lower, arm + fore);
      const hand = rotate(
        [shoulder[0] + u[0] + f[0], shoulder[1] + u[1] + f[1] - 0.68],
        -c.p.torsoX,
      );
      hand[1] += 0.68;
      assert.ok(
        Math.hypot(hand[0] - expected[0], hand[1] - expected[1]) < 1e-7,
        `${side} fist stays on the bar at ${since}s`,
      );
    }
  }
});

await test('September shipped sculpts contain the nested soft parts, real elbows and animated facial features', async () => {
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
  for (const [card, expected] of Object.entries(parts)) {
    const root = figures.getObjectByName(card);
    assert.ok(root, card);
    for (const [joint, parent] of Object.entries(expected)) {
      const node = root.getObjectByName(card + joint);
      assert.ok(node, `${card} ${joint} exists in the delivered model`);
      assert.equal(
        node.parent,
        root.getObjectByName(card + parent),
        `${card} ${joint} parent`,
      );
    }
    for (const side of ['L', 'R']) {
      const eye = root.getObjectByName(card + 'eye' + side);
      const pupil = root.getObjectByName(card + 'pupil' + side);
      const brow = root.getObjectByName(card + 'brow' + side);
      assert.ok(eye && pupil && brow, `${card} ${side} face`);
      assert.equal(pupil.parent, eye, `${card} iris follows the blink`);
    }
  }
});
