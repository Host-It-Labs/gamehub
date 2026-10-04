import * as THREE from 'three';
import type { Moves } from './types';

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
const S_R = B(0.155, 0, 0.952);
const E_R = S_R.clone().addScaledVector(B(0.04, 0.03, -1).normalize(), 0.235);
const C_R = E_R.clone().addScaledVector(B(0, 0.85, 0.32).normalize(), 0.25);
const W_R = C_R.clone().addScaledVector(
  C_R.clone().sub(E_R).normalize(),
  -0.04,
);
const S_L = B(-0.155, 0, 0.952);
const E_L = S_L.clone().addScaledVector(B(-0.06, 0, -1).normalize(), 0.235);
const C_L = E_L.clone().addScaledVector(
  B(-0.05, 0.35, -0.94).normalize(),
  0.25,
);
const POLE = B(-0.55, 0.13, 0.72);
const BOARD = B(0, -0.101, 0.06);
const _arm = new THREE.Quaternion();
const _fore = new THREE.Quaternion();
const _hand = new THREE.Quaternion();
const _euler = new THREE.Euler();
const _target = new THREE.Vector3();
const _v = new THREE.Vector3();
const _m0 = new THREE.Matrix4();
const _m1 = new THREE.Matrix4();

/** Reach the actual moving bellows, rather than pumping empty air beside
 * it. The same shoulder/elbow construction as the original Cowboy's arm
 * keeps the upper arm and forearm at their sculpted lengths. */
function bellowsReach(target: THREE.Vector3) {
  const upper = E_L.clone().sub(S_L);
  const lower = C_L.clone().sub(E_L);
  const upperLength = upper.length();
  const lowerLength = lower.length();
  const to = target.clone().sub(S_L);
  const length = Math.min(to.length(), (upperLength + lowerLength) * 0.998);
  const dir = to.normalize();
  const along =
    (upperLength ** 2 - lowerLength ** 2 + length * length) / (2 * length);
  const out = POLE.clone()
    .sub(S_L)
    .addScaledVector(dir, -POLE.clone().sub(S_L).dot(dir))
    .normalize();
  const elbow = S_L.clone()
    .addScaledVector(dir, along)
    .addScaledVector(
      out,
      Math.sqrt(Math.max(0, upperLength ** 2 - along * along)),
    );
  const u0 = upper.normalize();
  const f0 = lower.normalize();
  const n0 = new THREE.Vector3().crossVectors(u0, f0).normalize();
  const u1 = elbow.clone().sub(S_L).normalize();
  const f1 = target.clone().sub(elbow).normalize();
  const n1 = new THREE.Vector3().crossVectors(u1, f1).normalize();
  _m0.makeBasis(u0, n0, new THREE.Vector3().crossVectors(u0, n0));
  _m1.makeBasis(u1, n1, new THREE.Vector3().crossVectors(u1, n1));
  _arm.setFromRotationMatrix(_m1.multiply(_m0.transpose()));
  f1.applyQuaternion(_fore.copy(_arm).invert());
  const turn = Math.atan2(_v.crossVectors(f0, f1).dot(n0), f0.dot(f1));
  _fore.setFromAxisAngle(n0, turn);
}

/** A careful country walk under the hive's weight. Skirt and veil trail,
 * the hat settles, and her free hand actually squeezes the smoker. */
export const beekeeper: Moves = {
  style: {
    gait: { like: 'brisk', stride: 0.62, arms: 0.34, weight: 0.5 },
    attack: 'custom',
    windup: 0.3,
    lunge: 0,
    snap: 30,
  },
  carriage: {
    twist: 0.11,
    hips: 0.07,
    chestRoll: 0.2,
    nod: 0.03,
    armOut: 0.06,
    bounce: 0.03,
    weaponArm: 0.2,
  },
  stiff: {
    hat: 0.42,
    cape: 0.28,
    skirtL: 0.44,
    skirtR: 0.44,
    extra: 0.5,
    extra2: 1.4,
    armL: 1,
    foreL: 1,
    handR: 0.85,
    weapon: 1,
  },
  damping: {
    hat: 0.45,
    cape: 0.35,
    skirtL: 0.45,
    skirtR: 0.45,
    extra: 0.55,
    armL: 1,
    foreL: 1,
    handR: 0.85,
    weapon: 1,
  },
  pose(c, p) {
    const cosmetic = c.reduced ? 0 : 1;
    const release = ease(c.since / 0.14) * (1 - ease((c.since - 0.58) / 0.42));
    const pump = release * Math.max(0, Math.sin(c.since * 22));
    const t = c.idleFor > 1.5 ? (c.idleFor + c.unit.id * 0.27) % 8.5 : -1;
    const inspect = pulse(t, 2.1, 2.8, 4.2) * c.idle * cosmetic;
    const listen = pulse(t, 5.2, 6, 7.4) * c.idle * cosmetic;
    const landing = c.deploy < 1 ? pulse(c.deploy, 0.35, 0.6, 1) : 0;
    const lift = Math.max(release, inspect * 0.55);
    const step = Math.cos((c.cycle - 0.14) * TAU * 2) * c.walk;
    p.armR -= c.swingR * 0.8;
    p.armR += lift * 0.46 + landing * 0.15;
    p.armRz += release * 0.08;
    const foreR = -lift * 0.2 + pump * 0.05;
    const handR = -lift * 0.1 - pump * 0.04 + clamp(-c.accel * 0.012, 0.07);
    c.want('foreR', foreR);
    c.want('handR', handR);
    p.weapon = 0;

    // Right shoulder -> elbow -> wrist -> smoker -> the bellows board.
    // Follow that full chain before solving the free arm's contact.
    _arm.setFromEuler(_euler.set(p.armR, 0, p.armRz));
    _fore.setFromEuler(_euler.set(foreR, 0, 0));
    _hand.copy(_arm).multiply(_fore);
    _target.copy(E_R).sub(S_R).applyQuaternion(_arm).add(S_R);
    _v.copy(W_R).sub(E_R).applyQuaternion(_hand);
    _target.add(_v);
    _hand.multiply(_fore.setFromEuler(_euler.set(handR, 0, 0)));
    _v.copy(C_R).sub(W_R).add(BOARD).applyQuaternion(_hand);
    _target.add(_v);
    bellowsReach(_target);
    _euler.setFromQuaternion(_arm, 'XYZ');
    c.want(
      'armL',
      p.armL * (1 - release) + _euler.x * release,
      _euler.y * release,
      p.armLz * (1 - release) + _euler.z * release,
    );
    _euler.setFromQuaternion(_fore, 'XYZ');
    c.want(
      'foreL',
      _euler.x * release - c.walk * 0.09 * (1 - release),
      _euler.y * release,
      _euler.z * release,
    );
    c.want('handL', 0);
    c.want('extra2', -pump * 0.16);

    p.headX += inspect * 0.2 + release * 0.06;
    p.headY += listen * 0.4 - inspect * 0.18;
    p.torsoY += release * 0.08 - listen * 0.1;
    p.torsoX +=
      Math.sin(c.t * 1.6) * 0.012 * c.idle * cosmetic - c.flinch * 0.07;
    const surge = clamp(-c.accel * 0.025, 0.2);
    const side = clamp(-c.lateral * 0.025 - c.turn * 0.08, 0.24);
    c.want('skirtL', c.hipL * 0.6 + surge, -p.torsoY * 0.8, side);
    c.want('skirtR', c.hipR * 0.6 + surge, -p.torsoY * 0.8, side);
    c.want(
      'hat',
      clamp(-c.accel * 0.013 + c.vertical * 0.006, 0.075) +
        step * 0.016 * cosmetic +
        c.flinch * 0.08,
      clamp(-c.turn * 0.04, 0.08),
      clamp(-c.lateral * 0.016, 0.08),
    );
    c.want(
      'cape',
      clamp(-c.accel * 0.04, 0.24) + release * 0.05,
      clamp(-c.turn * 0.14, 0.3),
      side + c.flinch * 0.12,
    );
    c.want(
      'extra',
      step * 0.025 * cosmetic +
        clamp(-c.accel * 0.017, 0.1) +
        release * Math.sin(c.since * 24) * 0.025,
      clamp(-c.turn * 0.04, 0.1),
      clamp(-c.lateral * 0.016, 0.09),
    );
  },
  arrive(d) {
    return {
      drop: (1 - ease(d / 0.3)) * 1.8 + pulse(d, 0.32, 0.48, 0.68) * 0.1,
      squash: 1 - pulse(d, 0.3, 0.36, 0.54) * 0.1,
      twirl: (1 - ease(d / 0.55)) * 0.35,
    };
  },
};
