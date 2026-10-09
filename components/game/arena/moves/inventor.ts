import { Euler, Quaternion, Vector3 } from 'three';
import { blend, reach, type ArmGoal, type HandRest } from './reach.ts';
import type { MoveContext, Moves } from './types';

/*
 * The Inventor (9 October 2026 rebuild, figure_inventor.py): a young
 * inventor in an open lab coat, a copper zapper wand in both hands and a
 * Tesla coil on her back whose ball crackles over her right shoulder.
 *
 * Both arms are posed with reach() (moves/reach.ts) from one description of
 * the wand: the right fist's grip centre on its pistol grip, the grip's
 * axis (up, towards the barrel) and the barrel's direction. The wand rides
 * the right fist (its `weapon` joint stays at rest), so the right palm and
 * fingers follow from the wand; the left fist closes on the front grip
 * FRONT along the barrel, palm mirrored. The wand is described in an
 * upright frame at the chest joint and turned back by the chest's own turn,
 * so it stays on the target while the body loads, braces and recoils.
 *
 * Standing about her gun hand hangs beside the thigh; now and then
 * she taps the wand's dial with her left hand, pushes her goggles up, or
 * glances back at the coil as it crackles. She walks briskly with it at a
 * low ready. To attack she steps into a braced, staggered stance and
 * raises it level at the target; on each charge she draws it in and the
 * coil crackles harder; the discharge punches it forward, then the recoil
 * kicks it up and drives her shoulders and chest back before she settles
 * on the aim again.
 *
 * Positions are in the chest's axes (three.js: x to her right, y up, z
 * back, so forward is -z), figure units, from the chest joint. Numbers can
 * be tuned live: window.__arenaTune = { inventor: {…} }.
 */

type V3 = readonly [number, number, number];
const add = (a: V3, b: V3, k = 1): V3 => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scale = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const norm = (a: V3): V3 => scale(a, 1 / Math.max(1e-9, Math.hypot(a[0], a[1], a[2])));
const lerp3 = (a: V3, b: V3, t: number): V3 => add(a, sub(b, a), t);
const clamp01 = (t: number) => Math.max(0, Math.min(1, t));
const clamp = (v: number, limit: number) => Math.max(-limit, Math.min(limit, v));
const ease = (t: number) => {
  const k = clamp01(t);
  return k * k * (3 - 2 * k);
};
const pulse = (t: number, a: number, b: number, end: number) =>
  ease((t - a) / (b - a)) * (1 - ease((t - b) / (end - b)));

/** The fists (figure_inventor_sculpt.py): the grip's centre lies GRIP_E1
 *  along the hand from the wrist and GRIP_E3 off the palm. The front grip
 *  is FRONT along the barrel from the pistol grip (figure_inventor_gear). */
const GRIP_E1 = 0.05;
const GRIP_E3 = 0.023;
const FRONT = 0.125;
/** The sculpt's left fist at rest: its palm (towards the thigh) and the
 *  hand's line (wrist to knuckles), three.js axes. */
const HAND: HandRest = {
  palm: [0.988, -0.142, -0.034],
  fingers: [-0.147, -0.962, -0.231],
};

/** Where the wand is: the right fist's grip centre `g`, the grip's axis
 *  `d` (up, towards the barrel) and the barrel's direction `f`. The right
 *  palm faces n = d x f, to her left when she aims. */
type Wand = { g: V3; d: V3; f: V3 };
const orthoD = (f: V3, hint: V3): V3 => norm(sub(hint, scale(f, dot(hint, f))));
const wand = (g: V3, f: V3, up: V3 = [0, 1, 0]): Wand => {
  const ff = norm(f);
  return { g, f: ff, d: orthoD(ff, up) };
};
const mixWand = (a: Wand, b: Wand, t: number): Wand => {
  const f = norm(lerp3(a.f, b.f, t));
  return { g: lerp3(a.g, b.g, t), f, d: orthoD(f, lerp3(a.d, b.d, t)) };
};

/** Held low in both hands while walking: across the belly, the barrel
 *  forward, down and a little to her left, ready to come up. */
const CARRY = wand([0.075, -0.13, -0.16], [-0.32, -0.42, -0.85], [0.25, 1, -0.2]);
/** Standing about: the right wrist is beside the thigh, exactly in the
 * authored relaxed hand frame. The free left arm hangs, rather than
 * spending every idle frame held across the abdomen. */
const REST = wand([0.1936, -0.3544, -0.0383], [0.147, -0.962, -0.231], [0, 0.233, -0.973]);
/** Aimed: level at the target from just below the chest, the right elbow
 *  bent, the left arm reaching out to the front grip. */
const AIM = wand([0.05, -0.01, -0.285], [-0.03, 0.0, -1]);
/** Charging: drawn in towards the chest, the tip lifting a little. */
const CHARGE = wand([0.055, 0.015, -0.245], [-0.03, 0.1, -1]);
/** The discharge: punched out along the line of fire. */
const SHOT = wand([0.05, -0.005, -0.32], [-0.03, 0.01, -1]);
/** The recoil: kicked up and back towards her. */
const KICK = wand([0.06, 0.05, -0.245], [-0.02, 0.5, -1], [0, 1, 0.45]);

/** The left hand off the wand: tapping its dial (on the receiver, by the
 *  right fist) and up at the goggles on her forehead. */
const TAP: ArmGoal = {
  hand: [0.15, -0.2, -0.24],
  pole: [-0.7, -0.7, 0.1],
  palm: [0.2, -0.9, -0.2],
  fingers: [0.6, -0.3, -0.75],
};
const GOGGLES: ArmGoal = {
  hand: [0.11, 0.25, -0.13],
  pole: [-0.85, -0.25, -0.2],
  palm: [0.25, 0.1, -0.95],
  fingers: [0.25, 0.95, -0.1],
};

const T = {
  stepL: 0.26,
  stepR: -0.17,
  stepTime: 0.28,
  crouch: 0.035,
  aimBend: 0.06,
  recoilLean: 0.2,
  recoilPush: 0.07,
  chargeTwist: 0.12,
  blade: 0.24,
  steady: 0.9,
};
const live = () => {
  const t = (
    globalThis as { __arenaTune?: Record<string, Record<string, number>> }
  ).__arenaTune?.inventor;
  return t ? { ...T, ...t } : T;
};

const qc = new Quaternion();
const qb = new Quaternion();
const ec = new Euler();
const v = new Vector3();
const o = new Vector3();

/** Turn a wrist target and hand axes in the chest's frame into an ArmGoal
 *  in the arm's parent (the clavicle, turned by `clav`), mirrored for the
 *  right arm as reach() expects (the Miner's method). */
function goal(
  c: MoveContext,
  side: 'L' | 'R',
  wrist: V3,
  palm: V3,
  fingers: V3,
  pole: V3,
  clav: V3,
): ArmGoal | null {
  const cr = c.rest(`clav${side}`);
  const ar = c.rest(`arm${side}`);
  if (!cr || !ar) return null;
  qc.setFromEuler(ec.set(clav[0], clav[1], clav[2], 'XYZ')).invert();
  const local = (p: V3, offset?: readonly number[]): V3 => {
    v.set(p[0], p[1], p[2]);
    if (offset) v.sub(o.set(offset[0], offset[1], offset[2]));
    v.applyQuaternion(qc);
    return [v.x, v.y, v.z];
  };
  const m = side === 'R' ? -1 : 1;
  const mirror = (p: V3): V3 => [p[0] * m, p[1], p[2]];
  const hand = sub(local(wrist, cr), ar as V3);
  return {
    hand: mirror(hand),
    palm: mirror(local(palm)),
    fingers: mirror(local(fingers)),
    pole: mirror(local(pole)),
  };
}

/** The wand turned from the upright aim frame into the chest's frame (the
 *  inverse of the chest's turn), by `k` of it. */
function steadied(w: Wand, rx: number, ry: number, rz: number, k: number): Wand {
  qb.setFromEuler(ec.set(rx * k, ry * k, rz * k, 'XYZ')).invert();
  const turn = (p: V3): V3 => {
    v.set(p[0], p[1], p[2]).applyQuaternion(qb);
    return [v.x, v.y, v.z];
  };
  return { g: turn(w.g), d: turn(w.d), f: turn(w.f) };
}

/** The wrists and hand axes that put both fists on the wand. */
function grips(w: Wand) {
  const n = cross(w.d, w.f);
  const wristR = sub(sub(w.g, scale(w.f, GRIP_E1)), scale(n, GRIP_E3));
  const gl = add(w.g, w.f, FRONT);
  const wristL = add(sub(gl, scale(w.f, GRIP_E1)), n, GRIP_E3);
  return {
    right: { wrist: wristR, palm: n, fingers: w.f },
    left: { wrist: wristL, palm: scale(n, -1), fingers: w.f },
  };
}

/** The attack for a moment: the wand's pose, and how far into the charge,
 *  the shot and the recoil it is. */
function attack(c: MoveContext) {
  const W = 0.3;
  const since = c.since;
  const toHit = c.toHit;
  // The fast extension ENDS on the gameplay hit. Before and after that
  // exact instant use the same SHOT target, including body coefficients.
  if (since < 0.12) {
    const u = ease(since / 0.12);
    return { w: mixWand(SHOT, KICK, u), charge: 0, shot: 1 - u, kick: u };
  }
  if (since < 0.6) {
    const u = ease((since - 0.12) / 0.48);
    // Settling back onto the aim, unless the next charge has begun.
    const back = mixWand(KICK, AIM, u);
    if (toHit < W) {
      const ch = ease(1 - toHit / W);
      return { w: mixWand(back, CHARGE, ch), charge: ch, shot: 0, kick: 1 - u };
    }
    return { w: back, charge: 0, shot: 0, kick: 1 - u };
  }
  if (toHit < 0.055) {
    const u = ease(1 - toHit / 0.055);
    return { w: mixWand(CHARGE, SHOT, u), charge: 1 - u, shot: u, kick: 0 };
  }
  if (toHit < W) {
    const ch = ease((W - toHit) / (W - 0.055));
    return { w: mixWand(AIM, CHARGE, ch), charge: ch, shot: 0, kick: 0 };
  }
  return { w: AIM, charge: 0, shot: 0, kick: 0 };
}

export const inventor: Moves = {
  style: {
    // Brisk and purposeful: quick steps, not long ones, the wand held
    // ready in both hands, so the arms hardly swing.
    gait: {
      like: 'brisk',
      stride: 0.6,
      cadence: 2.25,
      bounce: 0.026,
      crouch: 0.02,
      lift: 0.09,
      arms: 0.06,
      elbow: 0.1,
      lean: 0.08,
      sway: 0.5,
      roll: 0.05,
      twist: 0.08,
      width: 0.92,
      nod: 0.02,
    },
    armSwing: 0.06,
    lean: 0.08,
    attack: 'custom',
    windup: 0.4,
    lunge: 0.06,
    snap: 28,
    twoHanded: true,
  },
  carriage: {
    twist: 0.08,
    hips: 0.08,
    chestRoll: 0.15,
    nod: 0.02,
    armOut: 0,
    bounce: 0,
    weaponArm: 0,
  },
  // Both arms on matched, firm springs so the fists stay on the wand
  // through the recoil; the coat's tails, the puffs and the coil's ball on
  // soft ones.
  stiff: {
    armL: 1.5,
    armR: 1.5,
    foreL: 1.5,
    foreR: 1.5,
    handL: 1.5,
    handR: 1.5,
    clavL: 1.2,
    clavR: 1.2,
    skirtL: 0.5,
    skirtR: 0.5,
    hair: 0.42,
    hat: 0.42,
    extra: 0.6,
  },
  damping: {
    armL: 0.72,
    armR: 0.72,
    foreL: 0.72,
    foreR: 0.72,
    handL: 0.72,
    handR: 0.72,
    skirtL: 0.42,
    skirtR: 0.42,
    hair: 0.36,
    hat: 0.36,
    extra: 0.3,
  },
  arrive(d) {
    // Dropped onto the field: down onto her boots, a deep landing crouch,
    // up again.
    const fall = clamp01(d / 0.3);
    const land = pulse(d, 0.3, 0.36, 0.62);
    return { drop: (1 - fall * fall) * 2.2, squash: 1 - land * 0.05, twirl: 0 };
  },
  pose(c, p) {
    const k = live();
    const cosmetic = c.reduced ? 0 : 1;
    const breath = Math.sin(c.t * 1.5) * cosmetic;
    const aim = c.aim;
    const walk = c.walk;
    const mem = c.memo;

    // ---- the braced stance: as she starts to fight, the left foot steps
    // forward and the right back (each leg is posed for the step, then the
    // ground solver plants it where it ends up).
    if (aim < 0.05) mem.brace = 0;
    else if (walk < 0.3) mem.brace = (mem.brace ?? 0) + c.dt;
    const brace = mem.brace ?? 0;
    const stepping = aim > 0.05 && brace < k.stepTime && walk < 0.3;
    if (stepping) {
      const uL = clamp01(brace / (k.stepTime * 0.7));
      const uR = clamp01((brace - k.stepTime * 0.4) / (k.stepTime * 0.6));
      c.want('legL', k.stepL * ease(uL), 0, 0);
      c.want('kneeL', -0.45 * Math.sin(Math.PI * uL));
      c.want('footL', 0.25 * Math.sin(Math.PI * uL));
      c.want('legR', k.stepR * ease(uR), 0, 0);
      c.want('kneeR', -0.3 * Math.sin(Math.PI * uR));
      c.want('footR', -0.1 * ease(uR));
    }
    const braced = aim * clamp01(brace / k.stepTime);

    // ---- idle fidgets (standing about): tapping the wand's dial, pushing
    // the goggles up, a glance back at the crackling coil.
    const lap = c.idleFor > 1.0 ? (c.idleFor + c.unit.id * 0.77) % 11 : -1;
    const awake = ease(c.idleFor - 1.0) * c.idle * cosmetic;
    const tap = pulse(lap, 1.6, 2.0, 3.6) * awake;
    const tapBeat = tap * Math.max(0, Math.sin((lap - 2.0) * Math.PI * 5)) * (lap > 2.0 && lap < 3.2 ? 1 : 0);
    const goggles = pulse(lap, 5.2, 5.7, 6.9) * awake;
    const shove = pulse(lap, 5.85, 6.05, 6.3) * awake;
    const glance = pulse(lap, 8.4, 8.9, 10.0) * awake;
    const crackle = pulse(lap, 8.2, 8.3, 9.4) * awake;

    // ---- the wand: low in both hands, or raised at the target.
    const bob = Math.cos(c.cycle * Math.PI * 4) * walk;
    const low = mixWand(REST, CARRY, walk);
    const lowered: Wand = { ...low, g: add(low.g, [0, 0.005 * bob + 0.003 * breath + 0.012 * tap, 0]) };
    const fight = attack(c);
    const hold = ease(aim * 1.15);
    const upright = mixWand(lowered, fight.w, hold);

    // The body: aimed down the barrel, a little crouched once braced.
    const charge = fight.charge * aim;
    const shot = fight.shot * aim;
    const kick = fight.kick * aim;
    p.torsoX += (k.aimBend + 0.03 * charge - k.recoilLean * kick - 0.04 * shot) * aim;
    // Bladed like a shooter: the right shoulder back, the left forward.
    p.torsoY += (-k.blade + k.chargeTwist * charge - 0.04 * kick) * aim;
    p.lean += (-0.05 * kick + 0.015 * charge) * aim;
    p.lunge += (0.03 * shot - k.recoilPush * kick) * aim;
    p.lift -= c.size * (k.crouch * braced + 0.012 * charge);
    p.headX += (-0.05 - 0.03 * charge + 0.12 * kick) * aim;
    p.roll += -0.02 * kick * aim;

    // Idle body: breathing, the head following the fidgets.
    p.torsoX += breath * 0.012 * (1 - aim);
    p.squash *= 1 + breath * 0.005 * (1 - aim);
    p.headX += 0.16 * tap + 0.1 * goggles;
    p.headY += -0.25 * tap - 0.6 * glance;
    p.torsoY += -0.14 * glance;

    // Hit: rocked back, the head snapped round, the wand jerked.
    const hurt = c.flinch * c.flinch;
    p.torsoX -= hurt * 0.15;
    p.torsoZ += hurt * 0.07;
    p.headY += hurt * 0.15;
    p.headX -= hurt * 0.1;
    p.lunge -= hurt * 0.06;

    // The wand is described upright; turn it into the chest's frame so it
    // stays on target while the chest loads and recoils.
    const w = steadied(
      upright,
      -(p.torsoX + p.lean),
      p.torsoY,
      p.torsoZ + p.roll,
      k.steady * hold,
    );
    const g = grips(w);

    // Shoulders: forward to the wand when she aims, up as the recoil
    // drives them back, a shrug as the left hand reaches the goggles.
    const clavR: V3 = [0, (0.07 - 0.1 * kick) * hold, (0.03 + 0.06 * kick) * hold + 0.05 * shove];
    const clavL: V3 = [0, (-0.12 + 0.08 * kick) * hold, (-0.03 - 0.05 * kick) * hold - 0.12 * goggles];
    c.want('clavR', clavR[0], clavR[1], clavR[2]);
    c.want('clavL', clavL[0], clavL[1], clavL[2]);
    c.want('weapon', 0, 0, 0);

    const poleR = norm(lerp3(c.rest('foreR') ?? [0.55, -0.9, 0.35],
      [0.75, -0.75, 0.2], ease(Math.max(walk, aim))));
    const poleL = norm(lerp3([-0.6, -0.9, 0.3], [-0.55, -0.85, 0.1], hold));
    const right = goal(c, 'R', g.right.wrist, g.right.palm, g.right.fingers, poleR, clavR);
    let left = goal(c, 'L', g.left.wrist, g.left.palm, g.left.fingers, poleL, clavL);
    if (left) {
      // Follow the figure's real hanging forearm/wrist offsets. Only the
      // walking carry and aim lift the support hand onto the front grip.
      const elbow = c.rest('foreL');
      const wrist = c.rest('handL');
      if (elbow && wrist) {
        const relaxed: ArmGoal = {
          hand: add(elbow, wrist),
          pole: elbow,
          palm: HAND.palm,
          fingers: HAND.fingers,
        };
        left = blend(relaxed, left, ease(Math.max(walk, aim)));
      }
    }
    // The left hand leaves the wand for its fidgets (never while fighting).
    const off = Math.max(tap, goggles) * (1 - aim);
    if (left && off > 0.001) {
      const tapGoal: ArmGoal = { ...TAP, hand: add(TAP.hand, [0, 0.012 * tapBeat, -0.01 * tapBeat]) };
      const goggleGoal: ArmGoal = { ...GOGGLES, hand: add(GOGGLES.hand, [0, 0.025 * shove, -0.01 * shove]) };
      const fidget = goggles > tap ? goggleGoal : tapGoal;
      left = blend(left, fidget, ease(off * 1.2));
    }
    if (right) reach(c, 'R', right, HAND);
    if (left) reach(c, 'L', left, HAND);

    // ---- secondary motion.
    const soft = c.reduced ? 0.3 : 1;
    const ahead = clamp(c.accel * 0.02, 0.22) * soft;
    const across = clamp(c.lateral * 0.02, 0.2) * soft;
    const turn = clamp(c.turn * 0.05, 0.22) * soft;
    const up = clamp(c.vertical * 0.012, 0.2) * soft;
    const land = Math.pow(1 - c.pass, 4) * walk;
    // The coat's tails trail the thighs and hang plumb against the chest's
    // bend; the shot whips them back.
    const hang = (p.torsoX + p.lean) * 0.5;
    const whip = (0.25 * kick + 0.08 * shot) * soft;
    c.want('skirtL', c.hipL * 0.62 + hang - ahead + whip * 0.6, -p.torsoY * 0.6,
      -land * 0.03 - across + turn - whip * 0.25);
    c.want('skirtR', c.hipR * 0.62 + hang - ahead + whip * 0.6, -p.torsoY * 0.6,
      land * 0.03 - across + turn + whip * 0.25);
    // The puffs lag the head: each footfall, a turn, the recoil.
    for (const [part, side] of [
      ['hair', -1],
      ['hat', 1],
    ] as const)
      c.want(
        part,
        clamp(-ahead * 0.3 + land * 0.04 - c.vertical * 0.006 * soft - 0.1 * kick * soft + hurt * 0.08, 0.14),
        clamp(-turn * 0.3, 0.1),
        clamp(-across * 0.35 + turn * 0.4 + side * (land * 0.02 + up * 0.1), 0.12),
      );
    // The coil's ball: a gentle throb, a bob lagging each step, a shiver
    // that grows through the charge, kicked on the shot, and the crackle.
    const buzz = cosmetic * (charge + crackle) *
      (Math.sin(c.t * 47) * 0.05 + Math.sin(c.t * 31 + 1.3) * 0.04);
    c.want(
      'extra',
      clamp(-ahead * 0.6 - land * 0.05 + buzz + 0.12 * kick * soft + hurt * 0.1, 0.35),
      buzz * 1.5,
      clamp(-across * 0.6 + turn * 0.5 + buzz, 0.3),
      Math.sin(c.t * 2.4) * 0.002 * cosmetic - c.pass * 0.006 * walk,
    );

    // Landing from the drop: the knees take it, the head and chest follow.
    if (c.deploy < 1) {
      const dip = pulse(c.deploy, 0.3, 0.37, 0.7);
      p.lift -= c.size * 0.1 * dip;
      p.torsoX += 0.22 * dip;
      p.headX -= 0.12 * dip;
    }
  },
};
