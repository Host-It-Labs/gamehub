import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Euler, Quaternion, Vector3 } from 'three';
import { pirate } from '../components/game/arena/moves/pirate.ts';
import { viking } from '../components/game/arena/moves/viking.ts';
import { gladiator } from '../components/game/arena/moves/gladiator.ts';
import { medic } from '../components/game/arena/moves/medic.ts';
import { miner } from '../components/game/arena/moves/miner.ts';
import { balloon } from '../components/game/arena/moves/balloon.ts';
import { inventor } from '../components/game/arena/moves/inventor.ts';
import { gunner } from '../components/game/arena/moves/gunner.ts';

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
  // The 4 October rebuild carries the flask in the hand.
  medic: { hat: 'head', hair: 'head', foreL: 'armL', weapon: 'handR' },
  // The 9 October rebuild carries the pick in the hand.
  miner: { hat: 'head', foreL: 'armL', weapon: 'handR' },
  // Since 9 October the cape joint is the balloonist's scarf, at her neck.
  balloon: { hair: 'head', cape: 'neck', foreL: 'armL', foreR: 'armR' },
  inventor: { hat: 'head', hair: 'head', foreL: 'armL', weapon: 'handR' },
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
    // The runtime's rest offsets, read from the shipped figure.
    rest(part) {
      const node = shipped.getObjectByName(card)?.getObjectByName(card + part);
      return node ? [node.position.x, node.position.y, node.position.z] : null;
    },
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
    // The instants either side of the hit (moves timed by `toHit` and
    // `since`, like the 9 October Pirate, and moves timed by `wind` and
    // `strike` agree here), sharing one memo as frames do.
    const memo = {};
    const before = pose(
      card,
      { aim: 1, idle: 0, wind: 1, hits: 0, toHit: 0.001 },
      memo,
    );
    const after = pose(
      card,
      { aim: 1, idle: 0, since: 0.001, wind: 0, hits: 1, toHit: 1 },
      memo,
    );
    assert.ok(
      distance(Object.values(before.p), Object.values(after.p)) < 0.12,
      `${card} does not reset to guard on the hit`,
    );
    // A fast cut (the Pirate's lands about a radian in its last 10 ms) is
    // allowed to move between these instants; snapping back to the guard
    // is not: each joint stays nearer its pre-hit goal than the guard's.
    const guard = pose(card, { aim: 1, idle: 0, toHit: 1 }, {});
    for (const [part, turns] of before.requested) {
      if (!after.requested.has(part)) continue;
      const moved = distance(turns, after.requested.get(part));
      const toGuard = guard.requested.has(part)
        ? distance(after.requested.get(part), guard.requested.get(part))
        : Infinity;
      assert.ok(
        moved < 0.12 || moved < toGuard,
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
  const rotation = (x, y = 0, z = 0, order = 'XYZ') =>
    new Quaternion().setFromEuler(new Euler(x, y, z, order));
  for (const stone of [0, 0.5, 1]) {
    for (const preparing of [false, true]) {
      for (const since of [0, 0.08, 0.2, 0.4, 0.65, 99]) {
        const c = pose(
          'medic',
          {
            walk: 1,
            idle: 0,
            since,
            swingR: 0.18,
            accel: 4,
            turn: 1,
            flinch: 0.3,
            unit: { id: 7, cooldown: preparing ? 0.1 : 1 },
          },
          { medicStoneGuard: stone },
        );
        const fore = c.requested.get('foreR')[0];
        const wrist = c.requested.get('handR');
        assert.ok(wrist, 'the complete tonic is carried by the wrist');
        // Follow the renderer's actual ordered joint chain. Pitch sums
        // miss the tilt introduced by the inward shoulder roll at stone.
        const p = c.p;
        const frame = rotation(-p.lean, 0, p.roll, 'YXZ')
          .multiply(rotation(-p.torsoX, p.torsoY, p.torsoZ))
          .multiply(rotation(p.armR, 0, p.armRz))
          .multiply(rotation(fore))
          .multiply(rotation(...wrist.slice(0, 3)))
          .multiply(rotation(p.weapon));
        const up = new Vector3(0, 1, 0).applyQuaternion(frame);
        assert.ok(
          up.distanceTo(new Vector3(0, 1, 0)) < 1e-10,
          `the complete grip is upright ${since}s after a pulse at guard ${stone}`,
        );
      }
    }
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
    // The balloonist sits in the basket: a flying unit has no walk solver,
    // and her moves hold the seated legs still themselves.
    if (card === 'balloon') continue;
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

// The Gunner's two-fists-on-the-bar kinematics test was retired on
// 9 October: the rebuilt Gunner (reach.ts) keeps one hand on the trail and
// signals the shot with the other, and its wrist contact is checked by the
// roster's motion audit (work/arena/2026-10-08-roster/gunner).

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
      // Compare names: a failing equality on scene nodes makes the test
      // runner diff two whole three.js graphs (tens of gigabytes).
      assert.equal(node.parent?.name, card + parent, `${card} ${joint} parent`);
    }
    for (const side of ['L', 'R']) {
      const eye = root.getObjectByName(card + 'eye' + side);
      const pupil = root.getObjectByName(card + 'pupil' + side);
      const brow = root.getObjectByName(card + 'brow' + side);
      assert.ok(eye && pupil && brow, `${card} ${side} face`);
      assert.equal(
        pupil.parent?.name,
        eye.name,
        `${card} iris follows the blink`,
      );
    }
  }
});
