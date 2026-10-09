import * as THREE from 'three';
import { reach, type ArmGoal, type HandRest } from './reach.ts';
import type { MoveContext, Moves } from '@/components/game/arena/moves/types';

const ease = (value: number) => {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
};
const clamp = (v: number, n: number) => Math.max(-n, Math.min(n, v));
const pulse = (t: number, a: number, b: number, end: number) =>
  ease((t - a) / (b - a)) * (1 - ease((t - b) / (end - b)));
const B = (x: number, y: number, z: number) => new THREE.Vector3(x, z, -y);
const SHOULDER = { L: B(-0.181, -0.003, 0.957), R: B(0.181, -0.003, 0.957) };
const CLAV = { L: B(-0.052, -0.003, 0.973), R: B(0.052, -0.003, 0.973) };
const WRIST = { L: B(-0.257, 0.061, 0.526), R: B(0.257, 0.123, 0.526) };
const ELBOW = { L: B(-0.227, 0.011, 0.735), R: B(0.227, 0.011, 0.735) };
const REST_POLE = Object.fromEntries(
  (['L', 'R'] as const).map((side) => {
    const hand = WRIST[side].clone().sub(SHOULDER[side]);
    const elbow = ELBOW[side].clone().sub(SHOULDER[side]);
    return [
      side,
      elbow
        .addScaledVector(hand, -elbow.dot(hand) / hand.lengthSq())
        .normalize(),
    ];
  }),
) as Record<'L' | 'R', THREE.Vector3>;
const D = B(0, 0.894427191, 0.4472135955).normalize();
const UP = B(0, -0.4472135955, 0.894427191).normalize();
const GRIP = WRIST.R.clone()
  .addScaledVector(UP, -0.047)
  .add(B(-0.055, 0, 0));
const FREE_FINGERS = B(-0.03, 0.05, -0.209).normalize();
const FREE_PALM = new THREE.Vector3(1, 0, 0)
  .addScaledVector(FREE_FINGERS, -FREE_FINGERS.x)
  .normalize();
const CARRY_FINGERS = UP.clone().negate();
const AIM_D = new THREE.Vector3(-0.5, 0, -Math.sqrt(0.75));
const AIM_UP = new THREE.Vector3(0, 1, 0);
const frame = (d: THREE.Vector3, up: THREE.Vector3) =>
  new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(d, up), d, up);
const AIM_Q = new THREE.Quaternion().setFromRotationMatrix(
  frame(AIM_D, AIM_UP).multiply(frame(D, UP).transpose()),
);
const SUPPORT_Q = new THREE.Quaternion().setFromRotationMatrix(
  frame(D, UP).multiply(frame(FREE_FINGERS, FREE_PALM).transpose()),
);
const LEFT_AIM_Q = AIM_Q.clone().multiply(SUPPORT_Q);
const SUPPORT_DOWN = 0.0616; // Actual left pad surface clears the fore-end by ~0.94 mm.
const HAND_L: HandRest = {
  palm: FREE_PALM.toArray() as [number, number, number],
  fingers: FREE_FINGERS.toArray() as [number, number, number],
};
const HAND_R: HandRest = {
  palm: [1, 0, 0],
  fingers: CARRY_FINGERS.toArray() as [number, number, number],
};
const q = new THREE.Quaternion(),
  inverse = new THREE.Quaternion();
const tool = new THREE.Quaternion(),
  recoil = new THREE.Quaternion();
const euler = new THREE.Euler();
const X = new THREE.Vector3(1, 0, 0);

function raisedProgress(c: MoveContext, target: number) {
  const key = 'explorer.raise',
    velocityKey = 'explorer.raiseVelocity';
  const previous = c.memo[key];
  // Fresh stopped-pose review contexts use the requested target directly.
  if (previous === undefined) {
    c.memo[key] = target;
    c.memo[velocityKey] = 0;
    return target;
  }
  const dt = Math.max(1e-4, Math.min(c.dt, 1 / 20));
  const difference = target - previous;
  const desired = clamp(difference / dt, 4);
  const velocity =
    (c.memo[velocityKey] ?? 0) +
    clamp(desired - (c.memo[velocityKey] ?? 0), 32 * dt);
  let progress = previous + velocity * dt;
  if (difference === 0 || difference * (target - progress) <= 0) {
    progress = target;
    c.memo[velocityKey] = 0;
  } else c.memo[velocityKey] = velocity;
  c.memo[key] = Math.max(0, Math.min(1, progress));
  return c.memo[key];
}

/** The paired wrists are solved in a chest frame. Explicit clavicle goals
 * then transform each target into its own shoulder frame before shared
 * reach, so shoulder protraction cannot pull a supporting mitten off the
 * rigid rifle. Organic sleeves still carry the clavicle weight. */
function solve(
  c: MoveContext,
  side: 'L' | 'R',
  hand: THREE.Vector3,
  palm: THREE.Vector3,
  fingers: THREE.Vector3,
  pole: THREE.Vector3,
  raised: number,
) {
  const sign = side === 'L' ? -1 : 1;
  const yaw = sign * 0.055 * raised,
    shrug = sign * 0.038 * raised;
  q.setFromEuler(euler.set(0, yaw, shrug));
  inverse.copy(q).invert();
  const shoulder = SHOULDER[side]
    .clone()
    .sub(CLAV[side])
    .applyQuaternion(q)
    .add(CLAV[side]);
  const goalHand = hand.clone().sub(shoulder).applyQuaternion(inverse);
  const goalPalm = palm.clone().applyQuaternion(inverse);
  const goalFingers = fingers.clone().applyQuaternion(inverse);
  const goalPole = pole.clone().applyQuaternion(inverse);
  const mirror = side === 'R' ? -1 : 1;
  const local = (v: THREE.Vector3): [number, number, number] => [
    v.x * mirror,
    v.y,
    v.z,
  ];
  const goal: ArmGoal = {
    hand: local(goalHand),
    pole: local(goalPole),
    palm: local(goalPalm),
    fingers: local(goalFingers),
    forearmRoll: 0.7,
  };
  c.want(`clav${side}`, 0, yaw, shrug);
  reach(c, side, goal, side === 'L' ? HAND_L : HAND_R);
}

/** A cautious polar walk; rifle rises outside the coat, left mitten joins
 * the fore-end, then both grips follow one rigid frame through the shot.
 * The 0.35 s windup and frost-shot gameplay are unchanged. Private draft. */
export const explorer: Moves = {
  style: {
    gait: {
      like: 'brisk',
      stride: 0.56,
      arms: 0.18,
      weight: 0.52,
      cadence: 2.15,
      lift: 0.06,
      bounce: 0.018,
      nod: 0.025,
    },
    attack: 'custom',
    windup: 0.35,
    lunge: 0,
    snap: 32,
  },
  carriage: {
    twist: 0.09,
    hips: 0.065,
    chestRoll: 0.25,
    nod: 0.023,
    armOut: 0,
    bounce: 0.012,
    weaponArm: 0.18,
  },
  stiff: {
    armL: 1.1,
    armR: 1.1,
    foreL: 1.1,
    foreR: 1.1,
    handL: 1.1,
    handR: 1.1,
    clavL: 1.1,
    clavR: 1.1,
    weapon: 1.1,
    skirtL: 0.43,
    skirtR: 0.43,
    extra: 0.4,
    hat: 0.55,
    hair: 0.42,
  },
  damping: {
    armL: 1,
    armR: 1,
    foreL: 1,
    foreR: 1,
    handL: 1,
    handR: 1,
    clavL: 1,
    clavR: 1,
    weapon: 1,
    skirtL: 0.64,
    skirtR: 0.64,
    extra: 0.58,
    hat: 0.8,
    hair: 0.7,
  },
  pose(c, p) {
    const cosmetic = c.reduced ? 0 : 1;
    const phase = c.idleFor > 2 ? (c.idleFor + c.unit.id * 0.29) % 10.5 : -1;
    const scan = pulse(phase, 4.6, 5.8, 7.7) * c.idle * cosmetic;
    const inspect = pulse(phase, 1.4, 2.5, 3.7) * c.idle * cosmetic;
    const breath = Math.sin(c.t * 1.7) * c.idle * cosmetic;
    // The troop's aimMix can jump by .15 on its first 60 Hz frame. A flat
    // start avoids asking a near-rest elbow for its whole flexion at once.
    const ready = raisedProgress(c, ease(c.aim) ** 2);
    const hit = c.strike * ready;
    const check = pulse(c.since, 0.14, 0.24, 0.58) * ready;
    const landing = c.deploy < 1 ? pulse(c.deploy, 0.3, 0.38, 0.62) : 0;
    const step = Math.cos((c.cycle - 0.12) * Math.PI * 4) * c.walk;
    const grip = GRIP.clone();
    const outside = new THREE.Vector3(0.26, 0.802, -0.342);
    const aimed = new THREE.Vector3(0.115, 1.018, -0.235);
    // A straight line raises the long butt through the parka. Lift around
    // its front-right edge, then pull the stock back onto the shoulder.
    if (ready < 0.62) grip.lerp(outside, ease(ready / 0.62));
    else grip.copy(outside).lerp(aimed, ease((ready - 0.62) / 0.38));
    grip.y +=
      (step * 0.005 + c.walk * 0.015 - landing * 0.012) * (1 - ready) +
      inspect * 0.015 +
      breath * 0.002 -
      check * 0.009;
    grip.z += hit * 0.014;
    tool.identity().slerp(AIM_Q, ready);
    recoil.setFromAxisAngle(X, hit * 0.044 - check * 0.021 + inspect * 0.018);
    tool.premultiply(recoil);
    const d = D.clone().applyQuaternion(tool);
    const up = UP.clone().applyQuaternion(tool);
    const rightWrist = WRIST.R.clone()
      .sub(GRIP)
      .applyQuaternion(tool)
      .add(grip);
    const rightPalm = new THREE.Vector3(-1, 0, 0).applyQuaternion(tool);
    const rightFingers = CARRY_FINGERS.clone().applyQuaternion(tool);
    const rightPole = REST_POLE.R.clone().lerp(
      new THREE.Vector3(0.55, -0.55, 0.15),
      ready,
    );
    const freeWrist = WRIST.L.clone();
    freeWrist.z -= c.swingL * 0.15 * (1 - ready);
    // Keep a real elbow bend through the stride. Sending an almost
    // straight hanging link farther forward crosses the hinge's minimum
    // bend and can flip its shoulder-plane frame during recovery.
    freeWrist.y +=
      breath * 0.002 - landing * 0.009 + c.walk * 0.02 * (1 - ready);
    const supportWrist = grip
      .clone()
      .addScaledVector(d, 0.151)
      .addScaledVector(up, -SUPPORT_DOWN);
    const join = ease(ready);
    // Address the final fore-end beside the chest. Chasing its outside
    // carry arc first overextends the left arm, then folds it abruptly.
    const finalSupport = aimed
      .clone()
      .addScaledVector(D.clone().applyQuaternion(AIM_Q), 0.151)
      .addScaledVector(UP.clone().applyQuaternion(AIM_Q), -SUPPORT_DOWN);
    const settle = ease((ready - 0.95) / 0.05);
    finalSupport.lerp(supportWrist, settle);
    const leftWrist = freeWrist.lerp(finalSupport, join);
    leftWrist.x -= Math.sin(join * Math.PI) * 0.025;
    leftWrist.y += Math.sin(join * Math.PI) * 0.015;
    // Anchor the turn at the final grip, then add the tool's small current
    // difference. Slerping identity directly to a moving support frame
    // crossed its 180° shortest-path boundary midway through the raise.
    const leftOrientation = new THREE.Quaternion().slerp(LEFT_AIM_Q, join);
    const toolDifference = tool.clone().multiply(AIM_Q.clone().invert());
    leftOrientation.premultiply(
      new THREE.Quaternion().slerp(toolDifference, join),
    );
    const leftPalm = FREE_PALM.clone().applyQuaternion(leftOrientation);
    const leftFingers = FREE_FINGERS.clone().applyQuaternion(leftOrientation);
    const leftPole = REST_POLE.L.clone().lerp(
      new THREE.Vector3(-0.7, -0.8, 0.12),
      join,
    );
    solve(c, 'R', rightWrist, rightPalm, rightFingers, rightPole, ready);
    solve(c, 'L', leftWrist, leftPalm, leftFingers, leftPole, join);
    p.weapon = 0;
    c.want('weapon', 0, 0, 0); // A fixed physical stock grip, no tool spring flex.
    p.torsoY -= (ready * Math.PI) / 6;
    p.headY += ready * 0.47 + scan * 0.25;
    p.headX += ready * 0.04 + inspect * 0.08 - hit * 0.035;
    p.torsoX += c.wind * ready * 0.025 - hit * 0.055 + breath * 0.006;
    p.torsoZ += c.flinch * 0.07;
    p.lean -= hit * 0.04;
    p.lunge -= hit * 0.048;
    p.lift -= c.size * (ready * 0.014 + landing * 0.036);
    p.roll += scan * 0.008;
    for (const side of ['L', 'R'] as const)
      c.want(
        `skirt${side}`,
        (-Math.max(0, side === 'L' ? c.hipL : c.hipR) * 0.2 +
          clamp(-c.accel * 0.011, 0.09)) *
          cosmetic,
        clamp(-c.turn * 0.04, 0.1) * cosmetic,
        clamp(-c.lateral * 0.009, 0.06) * cosmetic,
      );
    c.want(
      'extra',
      (clamp(-c.accel * 0.019 + c.vertical * 0.008, 0.12) + c.flinch * 0.06) *
        cosmetic,
      clamp(-c.turn * 0.07, 0.14) * cosmetic,
      clamp(-c.lateral * 0.018, 0.12) * cosmetic,
    );
    c.want(
      'hat',
      (clamp(-c.accel * 0.005, 0.024) + hit * 0.008) * cosmetic,
      clamp(-c.turn * 0.015, 0.025) * cosmetic,
      clamp(-c.lateral * 0.004, 0.025) * cosmetic,
    );
    c.want(
      'hair',
      clamp(-c.accel * 0.012 + c.vertical * 0.006, 0.07) * cosmetic,
      clamp(-c.turn * 0.035, 0.09) * cosmetic,
      clamp(-c.lateral * 0.008, 0.055) * cosmetic,
    );
  },
  arrive(d) {
    return {
      drop: (1 - ease(d / 0.3)) * 2.0,
      squash: 1 - pulse(d, 0.3, 0.37, 0.6) * 0.085,
      twirl: (1 - ease(d / 0.5)) * -0.18,
    };
  },
};
