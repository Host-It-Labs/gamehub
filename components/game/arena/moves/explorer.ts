import * as THREE from 'three';
import type { MoveContext, Moves, PartName } from './types';

const TAU = Math.PI * 2;
const clamp = (v: number, limit: number) =>
  Math.max(-limit, Math.min(limit, v));
const ease = (v: number) => {
  const t = Math.max(0, Math.min(1, v));
  return t * t * (3 - 2 * t);
};
const pulse = (t: number, a: number, b: number, end: number) =>
  ease((t - a) / (b - a)) * (1 - ease((t - b) / (end - b)));
const B = (x: number, y: number, z: number) => new THREE.Vector3(x, z, -y);
const D = B(-0.22, 1, 0.32).normalize();
const G_R = B(0.12, 0.13, 0.68);
const G_L = G_R.clone().addScaledVector(D, 0.27);
const UPPER = 0.235;
const FORE = 0.215;
const Y_AXIS = new THREE.Vector3(0, 1, 0);

/** The same two-bone construction as the source sculpt, including its
 * outwards elbow pole. It retains the actual lengths of the miniature. */
function elbow(
  s: THREE.Vector3,
  target: THREE.Vector3,
  l1: number,
  l2: number,
  pole: THREE.Vector3,
) {
  const dir = target.clone().sub(s);
  const length = Math.min(dir.length(), (l1 + l2) * 0.9995);
  dir.normalize();
  const along = (l1 * l1 - l2 * l2 + length * length) / (2 * length);
  const out = pole.clone().sub(s);
  out.addScaledVector(dir, -out.dot(dir)).normalize();
  return s
    .clone()
    .addScaledVector(dir, along)
    .addScaledVector(out, Math.sqrt(Math.max(0, l1 * l1 - along * along)));
}
function rest(side: 'L' | 'R') {
  const sx = side === 'R' ? 1 : -1;
  const s = B(sx * 0.17, 0, 0.95);
  const c = (side === 'R' ? G_R : G_L).clone();
  const pole = s
    .clone()
    .add(side === 'R' ? B(0.6, -0.5, -0.2) : B(-0.6, -0.1, -0.5));
  const e0 = elbow(s, c, UPPER, FORE + 0.042, pole);
  const across = c.clone().sub(e0);
  across.addScaledVector(D, -across.dot(D)).normalize();
  const w = c.clone().addScaledVector(across, -0.042);
  const e = elbow(s, w, UPPER, FORE, pole);
  // The source's reach clamp places its elbow while retaining the wrist
  // on the sculpted grip. Use those actual links when posing the rig.
  return { s, c, w, e, pole, upper: s.distanceTo(e), fore: e.distanceTo(w) };
}
const REST = { L: rest('L'), R: rest('R') };
const _m0 = new THREE.Matrix4();
const _m1 = new THREE.Matrix4();
const _e = new THREE.Euler();
const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();

/** Choose equivalent XYZ angles near the last request, so reaching past
 * an Euler branch cannot rush a mitten through a half-turn. */
function wantQ(c: MoveContext, part: PartName, q: THREE.Quaternion) {
  _e.setFromQuaternion(q, 'XYZ');
  const key = 'frost:' + part;
  const previous = [
    c.memo[key + ':x'] ?? 0,
    c.memo[key + ':y'] ?? 0,
    c.memo[key + ':z'] ?? 0,
  ];
  const near = (angle: number, old: number) =>
    angle + Math.round((old - angle) / TAU) * TAU;
  const direct = [_e.x, _e.y, _e.z].map((v, i) => near(v, previous[i]));
  const alternate = [_e.x + Math.PI, Math.PI - _e.y, _e.z + Math.PI].map(
    (v, i) => near(v, previous[i]),
  );
  const distance = (angles: number[]) =>
    angles.reduce((sum, v, i) => sum + (v - previous[i]) ** 2, 0);
  const angles = distance(direct) < distance(alternate) ? direct : alternate;
  for (let i = 0; i < 3; i++)
    c.memo[key + ':' + ['x', 'y', 'z'][i]] = angles[i];
  c.want(part, angles[0], angles[1], angles[2]);
}

/** Solve both wrists onto one rigid rifle frame. Forearm pronation takes
 * most of the roll so the wrists only need a small remaining turn. */
function hold(c: MoveContext, grip: THREE.Vector3, tool: THREE.Quaternion) {
  for (const side of ['L', 'R'] as const) {
    const r = REST[side];
    const target = r.w.clone().sub(G_R).applyQuaternion(tool).add(grip);
    const e1 = elbow(r.s, target, r.upper, r.fore, r.pole);
    const u0 = r.e.clone().sub(r.s).normalize();
    const f0 = r.w.clone().sub(r.e).normalize();
    const n0 = new THREE.Vector3().crossVectors(u0, f0).normalize();
    const u1 = e1.clone().sub(r.s).normalize();
    const f1 = target.clone().sub(e1).normalize();
    const n1 = new THREE.Vector3().crossVectors(u1, f1).normalize();
    _m0.makeBasis(u0, n0, new THREE.Vector3().crossVectors(u0, n0));
    _m1.makeBasis(u1, n1, new THREE.Vector3().crossVectors(u1, n1));
    const arm = new THREE.Quaternion().setFromRotationMatrix(
      _m1.multiply(_m0.transpose()),
    );
    const local = f1.applyQuaternion(arm.clone().invert());
    const bend = Math.atan2(_v.crossVectors(f0, local).dot(n0), f0.dot(local));
    const fore = new THREE.Quaternion().setFromAxisAngle(n0, bend);
    const world = arm.clone().multiply(fore);
    const wrist = world.clone().invert().multiply(tool);
    const twist =
      2 * Math.atan2(f0.x * wrist.x + f0.y * wrist.y + f0.z * wrist.z, wrist.w);
    fore.multiply(_q.setFromAxisAngle(f0, twist));
    world.copy(arm).multiply(fore);
    wantQ(c, ('arm' + side) as PartName, arm);
    wantQ(c, ('fore' + side) as PartName, fore);
    wantQ(c, ('hand' + side) as PartName, world.invert().multiply(tool));
  }
}

/** A careful planted walk in fur boots. The frost rifle comes to a level
 * shoulder hold with both mittens still on it, recoils, and settles back
 * onto its sight. Her hood, coat hem and pouch respond independently. */
export const explorer: Moves = {
  style: {
    gait: { like: 'brisk', stride: 0.58, arms: 0.14, weight: 0.5 },
    twoHanded: true,
    attack: 'custom',
    windup: 0.35,
    lunge: 0,
    snap: 32,
  },
  carriage: {
    twist: 0.1,
    hips: 0.06,
    chestRoll: 0.2,
    nod: 0.025,
    armOut: 0,
    bounce: 0.02,
    weaponArm: 1,
  },
  stiff: {
    armL: 1,
    armR: 1,
    foreL: 1,
    foreR: 1,
    handL: 1,
    handR: 1,
    weapon: 1,
    skirtL: 0.45,
    extra: 0.38,
    hat: 0.5,
  },
  damping: {
    armL: 1,
    armR: 1,
    foreL: 1,
    foreR: 1,
    handL: 1,
    handR: 1,
    weapon: 1,
    skirtL: 0.52,
    extra: 0.4,
    hat: 0.65,
  },
  pose(c, p) {
    const cosmetic = c.reduced ? 0 : 1;
    const t = c.idleFor > 1.7 ? (c.idleFor + c.unit.id * 0.33) % 8.5 : -1;
    const inspect = pulse(t, 2.3, 3, 4.4) * c.idle * cosmetic;
    const scan = pulse(t, 5.5, 6.1, 7.8) * c.idle * cosmetic;
    const land = c.deploy < 1 ? pulse(c.deploy, 0.3, 0.55, 0.96) : 0;
    const a = ease(c.aim);
    const hit = c.strike * c.aim;
    const reload = pulse(c.since, 0.17, 0.28, 0.6) * c.aim;
    const settle = c.wind * c.aim;
    const step = Math.cos((c.cycle - 0.13) * TAU * 2) * c.walk * cosmetic;
    // At aim the grip is near the right cheek and the barrel points
    // forward, instead of adding an upward pitch to an already-up rifle.
    const grip = G_R.clone().lerp(B(0.14, 0.17, 0.93), a);
    grip.y +=
      step * 0.008 * (1 - a) -
      hit * 0.008 -
      reload * 0.035 +
      inspect * 0.035 +
      land * 0.008;
    grip.z += hit * 0.015;
    const pitch =
      -Math.atan2(0.32, 1) * a + hit * 0.085 - reload * 0.1 + inspect * 0.08;
    // Across a bladed chest the supporting mitten can reach the fore-end
    // at its real arm length. The chest counters this turn so the muzzle
    // still faces the target, as a person's two-hand shoulder hold does.
    const tool = new THREE.Quaternion()
      .setFromAxisAngle(Y_AXIS, a * 0.42)
      .multiply(_q.setFromEuler(_e.set(pitch, 0, 0)));
    hold(c, grip, tool);
    p.weapon = 0;
    p.torsoY += -c.aim * 0.62 - reload * 0.06;
    p.headX += c.aim * 0.08 - hit * 0.09 + inspect * 0.17;
    p.headY += c.aim * 0.58 + scan * 0.36;
    p.torsoX += settle * 0.03 - hit * 0.07 - c.flinch * 0.08;
    p.lean -= hit * 0.055;
    p.lunge -= hit * 0.065;
    p.torsoZ += c.flinch * 0.07;
    // Coat at the belt; the one broad hem stays outside both thighs.
    c.want(
      'skirtL',
      -Math.max(0, c.hipL, c.hipR) * 0.22 + clamp(-c.accel * 0.016, 0.1),
      clamp(-c.turn * 0.07, 0.16),
      clamp(-c.lateral * 0.015, 0.1),
    );
    c.want(
      'extra',
      clamp(-c.accel * 0.025 + c.vertical * 0.012, 0.18) +
        hit * 0.08 +
        c.flinch * 0.13,
      clamp(-c.turn * 0.13, 0.2),
      clamp(-c.lateral * 0.027, 0.18),
    );
    c.want(
      'hat',
      clamp(-c.accel * 0.007 + c.vertical * 0.004, 0.035) +
        step * 0.01 +
        hit * 0.012,
      clamp(-c.turn * 0.02, 0.035),
      clamp(-c.lateral * 0.006, 0.03),
    );
  },
  arrive(d) {
    return {
      drop: (1 - ease(d / 0.3)) * 2.2 + pulse(d, 0.35, 0.48, 0.69) * 0.09,
      squash: 1 - pulse(d, 0.3, 0.37, 0.54) * 0.12,
      twirl: (1 - ease(d / 0.55)) * -0.3,
    };
  },
};
