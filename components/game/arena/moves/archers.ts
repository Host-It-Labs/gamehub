import { Euler, Quaternion, Vector3 } from 'three';
import { blend, reach, type ArmGoal, type HandRest } from './reach.ts';
import type { MoveContext, Moves } from './types';

/** Cadets: padded pressure suits, a raked ray-gun grip and a cupped
 * support glove. Wrist targets drive both arms through the shared solver.
 * The right glove carries the gun; its weapon joint stays at rest. */
type V3 = readonly [number, number, number];
const add = (a: V3, b: V3, k = 1): V3 => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const sub = (a: V3, b: V3): V3 => add(a, b, -1);
const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: V3): V3 => mul(a, 1 / Math.max(1e-9, Math.hypot(...a)));
const mix = (a: V3, b: V3, t: number): V3 => add(a, sub(b, a), t);
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const clamp = (v: number, k: number) => Math.max(-k, Math.min(k, v));
const ease = (v: number) => { const t = clamp01(v); return t * t * (3 - 2 * t); };
const pulse = (t: number, a: number, b: number, end: number) => ease((t - a) / (b - a)) * (1 - ease((t - b) / (end - b)));

// Exact authored glove frames from figure_archers_body.hand_frame: the
// two gloves have different radial deviation (6° free / 14° gun hand).
// reach() mirrors its HandRest for R, so REST_R is expressed as a left hand.
const REST_L: HandRest = {
  palm: [0.999090909, -0.041837216, -0.008185542],
  fingers: [-0.042396922, -0.955058517, -0.293369613],
};
const REST_R: HandRest = {
  palm: [0.999090909, -0.041837216, -0.008185542],
  fingers: [-0.041364149, -0.904923613, -0.423559041],
};
const RAKE = 16 * Math.PI / 180;
const GRIP_E1 = 0.047;
const GRIP_E3 = 0.021;
const CUP_E1 = 0.058;
const CUP_E3 = 0.012;

type Gun = { g: V3; f: V3; up: V3 };
const gun = (g: V3, forward: V3, hint: V3 = [0, 1, 0]): Gun => {
  const f = norm(forward);
  return { g, f, up: norm(sub(hint, mul(f, dot(f, hint)))) };
};
const mixGun = (a: Gun, b: Gun, t: number) => gun(mix(a.g, b.g, t), mix(a.f, b.f, t), mix(a.up, b.up, t));
// Standing: authored gun-down pose beside the thigh, free arm hanging.
const REST = gun([0.210963206, -0.343409991, -0.040079171],
  [0.036919058, -0.753132521, -0.656832086], [-0.021315228, 0.656537169, -0.753992445]);
const CARRY = gun([0.095, -0.135, -0.17], [-0.12, -0.45, -1]);
const AIM = gun([0.0, 0.012, -0.315], [-0.025, 0.015, -1]);
const LOAD = gun([0.005, 0.005, -0.295], [-0.025, -0.02, -1]);
const FIRE = gun([-0.002, 0.014, -0.345], [-0.025, 0.015, -1]);
const RECOIL = gun([0.010, 0.030, -0.292], [-0.015, 0.20, -1]);

const q = new Quaternion();
const e = new Euler();
const v = new Vector3();
function inverseTurn(a: V3, rotation: V3): V3 {
  q.setFromEuler(e.set(...rotation, 'XYZ')).invert();
  v.set(...a).applyQuaternion(q);
  return [v.x, v.y, v.z];
}
function armGoal(c: MoveContext, side: 'L' | 'R', wrist: V3, palm: V3, fingers: V3, pole: V3, clav: V3): ArmGoal | null {
  const cr = c.rest(`clav${side}`), ar = c.rest(`arm${side}`);
  if (!cr || !ar) return null;
  const m = side === 'L' ? 1 : -1;
  const mirror = (p: V3): V3 => [p[0] * m, p[1], p[2]];
  return {
    hand: mirror(sub(inverseTurn(sub(wrist, cr), clav), ar)),
    palm: mirror(inverseTurn(palm, clav)),
    fingers: mirror(inverseTurn(fingers, clav)),
    pole: mirror(inverseTurn(pole, clav)),
  };
}
function cycle(c: MoveContext) {
  // Extension finishes at the engine's hit; recoil and recovery follow.
  // No clocks, ability state, first-hit delay or hit interval are changed.
  if (c.since < 0.085) {
    const t = ease(c.since / 0.085);
    return { gun: mixGun(FIRE, RECOIL, t), load: 0, fire: 1 - t, recoil: t };
  }
  if (c.since < 0.34) {
    const t = ease((c.since - 0.085) / 0.255);
    return { gun: mixGun(RECOIL, AIM, t), load: 0, fire: 0, recoil: 1 - t };
  }
  if (c.toHit < 0.045) {
    const t = ease(1 - c.toHit / 0.045);
    return { gun: mixGun(LOAD, FIRE, t), load: 1 - t, fire: t, recoil: 0 };
  }
  if (c.toHit < 0.22) {
    const t = ease((0.22 - c.toHit) / (0.22 - 0.045));
    return { gun: mixGun(AIM, LOAD, t), load: t, fire: 0, recoil: 0 };
  }
  return { gun: AIM, load: 0, fire: 0, recoil: 0 };
}

export const archers: Moves = {
  style: {
    gait: { like: 'march', stride: 0.53, cadence: 2.15, bounce: 0.018,
      lift: 0.085, crouch: 0.025, arms: 0.05, elbow: 0.10,
      lean: 0.055, sway: 0.4, roll: 0.045, twist: 0.065, width: 1.0, nod: 0.015 },
    armSwing: 0.05, lean: 0.055, attack: 'custom', windup: 0.22,
    lunge: 0.035, snap: 30, twoHanded: true,
  },
  carriage: { twist: 0.065, hips: 0.055, chestRoll: 0.12, nod: 0.015,
    armOut: 0, bounce: 0, weaponArm: 0 },
  stiff: { clavL: 1.2, clavR: 1.2, armL: 1.6, armR: 1.6,
    foreL: 1.6, foreR: 1.6, handL: 1.6, handR: 1.6, antenna: 0.35 },
  damping: { armL: 0.76, armR: 0.76, foreL: 0.76, foreR: 0.76,
    handL: 0.76, handR: 0.76, antenna: 0.38 },
  arrive(d) {
    const t = ease(d / 0.32), contact = pulse(d, 0.32, 0.39, 0.72);
    return { drop: (1 - t) * 2.1, squash: 1 - contact * 0.025, twirl: 0 };
  },
  pose(c, p) {
    const cosmetic = c.reduced ? 0 : 1;
    const hold = ease(c.aim), support = ease(Math.max(c.walk, c.aim));
    const shot = cycle(c);
    const load = shot.load * hold, fire = shot.fire * hold, recoil = shot.recoil * hold;
    const breath = Math.sin(c.t * 1.35 + c.unit.id * 0.23) * c.idle * cosmetic;
    const lap = c.idleFor > 1.3 ? (c.idleFor + c.unit.id * 0.67) % 10.5 : -1;
    const awake = ease(c.idleFor - 1.3) * c.idle * cosmetic;
    // A brief check of the chest gauge and a look towards the companion.
    const check = pulse(lap, 2.0, 2.5, 3.8) * awake;
    const glance = pulse(lap, 6.5, 7.1, 8.7) * awake;
    const side = c.unit.id % 2 ? -1 : 1;
    p.torsoX += (0.035 + 0.035 * load - 0.11 * recoil - 0.025 * fire) * hold + breath * 0.009;
    p.torsoY += (-0.17 + 0.08 * load - 0.03 * recoil) * hold;
    p.lunge += 0.025 * fire - 0.042 * recoil;
    // The planted-foot solver absorbs this crouch; do not pose walking legs.
    p.lift -= c.size * (0.026 * hold + 0.012 * load);
    p.headX += (-0.025 + 0.05 * recoil) * hold + 0.22 * check;
    p.headY += (0.08 * hold + side * 0.28 * glance);
    const hurt = c.flinch * c.flinch;
    p.torsoX -= hurt * 0.14;
    p.torsoZ += side * hurt * 0.05;
    p.headX -= hurt * 0.09;
    p.headY += side * hurt * 0.12;
    p.lunge -= hurt * 0.04;

    const low = mixGun(REST, CARRY, c.walk);
    const held = mixGun(low, shot.gun, hold);
    // The carried gun bobs with each step and sways a little with the
    // stride, so the arms carry it rather than locking it in place.
    held.g = add(held.g, [
      c.walk * Math.sin(c.cycle * Math.PI * 2) * 0.006 * (1 - hold),
      breath * 0.002 + c.walk * Math.cos(c.cycle * Math.PI * 4) * 0.011,
      c.walk * Math.sin(c.cycle * Math.PI * 2) * 0.012 * (1 - hold),
    ]);
    const body: V3 = [-(p.torsoX + p.lean) * hold * 0.94,
      p.torsoY * hold * 0.94, (p.torsoZ + p.roll) * hold * 0.94];
    const g = inverseTurn(held.g, body), f = inverseTurn(held.f, body), up = inverseTurn(held.up, body);
    const palmR = norm(cross(up, f));
    const fingersR = norm(sub(mul(f, Math.cos(RAKE)), mul(up, Math.sin(RAKE))));
    const wristR = sub(sub(g, mul(fingersR, GRIP_E1)), mul(palmR, GRIP_E3));
    // Cupped left glove nests below the chrome body, behind its fin rings.
    const cup = add(add(g, f, 0.052), up, 0.029);
    const wristL = sub(sub(cup, mul(f, CUP_E1)), mul(up, CUP_E3));
    const clavR: V3 = [0, (0.055 - 0.04 * recoil) * hold, 0.025 * hold];
    const clavL: V3 = [0, -0.10 * hold, -0.025 * hold];
    c.want('clavR', ...clavR);
    c.want('clavL', ...clavL);
    c.want('weapon', 0, 0, 0);
    // Reach forward from tucked elbows so the padded cuffs follow the gun.
    const poleR = mix(c.rest('foreR') ?? [0.75, -0.85, 0.25], [0.75, -0.85, 0.25], support);
    const right = armGoal(c, 'R', wristR, palmR, fingersR, poleR, clavR);
    let left = armGoal(c, 'L', wristL, up, f, [-0.55, -0.85, 0.1], clavL);
    const elbow = c.rest('foreL'), wrist = c.rest('handL');
    if (left && elbow && wrist) {
      left = blend({ hand: add(elbow, wrist), pole: elbow,
        palm: REST_L.palm, fingers: REST_L.fingers }, left, support);
      if (check > 0.001) {
        const gauge = armGoal(c, 'L', [-0.04, -0.04, -0.155], [0, 0, -1], [0.3, 0.8, -0.2],
          [-0.8, -0.8, 0.15], clavL);
        if (gauge) left = blend(left, gauge, ease(check));
      }
    }
    if (right) reach(c, 'R', right, REST_R);
    if (left) reach(c, 'L', left, REST_L);

    // Pack antenna lags acceleration, steps and recoil, within a short arc.
    const soft = c.reduced ? 0 : 1;
    c.want('antenna', clamp((-c.accel * 0.015 - c.vertical * 0.008 + recoil * 0.13
      + Math.sin(c.t * 2.7) * 0.03 * c.idle + Math.cos(c.cycle * Math.PI * 4) * 0.05 * c.walk) * soft, 0.22),
      clamp(-c.turn * 0.04 * soft, 0.12), clamp((-c.lateral * 0.015 + c.turn * 0.035) * soft, 0.18));
    if (c.deploy < 1) {
      const land = pulse(c.deploy, 0.32, 0.39, 0.72);
      p.lift -= c.size * 0.075 * land;
      p.torsoX += 0.12 * land;
      p.headX -= 0.06 * land;
    }
  },
};
