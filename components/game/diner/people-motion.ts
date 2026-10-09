import * as THREE from 'three';
import type { Figure } from './people';
import { HUMAN } from './people-geometry';

export type FigurePose = {
  time: number;
  phase: number;
  /** Smoothed public movement amount; still move under reduced motion. */
  moving: number;
  seed?: number;
  carry?: boolean;
  sitting?: boolean;
  eating?: boolean;
  impatient?: boolean;
  gesture?: number;
  mopping?: boolean;
  reduced?: boolean;
  dt?: number;
};

const TAU = Math.PI * 2;
const stance = 0.58;
const stride = 0.2;
export const HUMAN_STRIDE_DISTANCE = (stride * 2) / stance;
const cycleTravel = HUMAN_STRIDE_DISTANCE;
const down = new THREE.Vector3(0, -1, 0);
const clamp = THREE.MathUtils.clamp;
const smooth = (t: number) => t * t * (3 - 2 * t);
const wrap = (t: number) => ((t % 1) + 1) % 1;

/** Shaft centre between the authored finger bases and thumb, in wrist units. */
export const MOP_GRIP_LOCAL = Object.freeze([0, -0.061, 0.041] as const);

/**
 * The prop follows the line through these staggered grips, then intersects it
 * with the floor. This includes body lean, simulation yaw and actor scale;
 * the mop must not add a separate world-axis swing.
 */
export function mopGripPoint(
  figure: Figure,
  index: 0 | 1,
  target = new THREE.Vector3(),
): THREE.Vector3 | null {
  const wrist = figure.joints?.wrists[index];
  if (!wrist) return null;
  wrist.updateWorldMatrix(true, false);
  return target.fromArray(MOP_GRIP_LOCAL).applyMatrix4(wrist.matrixWorld);
}

type FootGoal = ReturnType<typeof footCycle> & { x?: number };
type FootGoals = [FootGoal, FootGoal];
type GaitState = {
  inputPhase: number;
  phase: number;
  moving: boolean;
  starting: number;
  stopping: number;
  offset: number;
  feet: FootGoals;
  world: [THREE.Vector3, THREE.Vector3];
  stopFeet: FootGoals | null;
  stopWorld: [THREE.Vector3, THREE.Vector3];
  support: number;
  root: THREE.Vector3;
  time: number;
};
const gait = new WeakMap<Figure, GaitState>();

/** Reset only presentation state when a review starts a new independent take. */
export function resetFigurePose(figure: Figure) {
  gait.delete(figure);
}

function locomotion(figure: Figure, pose: FigurePose) {
  const raw = clamp(pose.moving, 0, 1);
  let previous = gait.get(figure);
  const root = figure.root.getWorldPosition(new THREE.Vector3());
  if (
    previous &&
    (previous.root.distanceTo(root) > figure.root.scale.z * 0.8 ||
      pose.time < previous.time)
  )
    previous = undefined;
  const dt = pose.dt;
  const valid = dt !== undefined && dt > 0 && dt <= 0.12 && !pose.sitting;
  const walking = raw > 0.02;
  const state: GaitState = previous ?? {
    inputPhase: pose.phase,
    phase: pose.phase,
    moving: walking,
    starting: 0.14,
    stopping: 0.28,
    offset: 0,
    feet: [footCycle(pose.phase, 0, raw), footCycle(pose.phase, 1, raw)],
    world: [new THREE.Vector3(), new THREE.Vector3()],
    stopFeet: null,
    stopWorld: [new THREE.Vector3(), new THREE.Vector3()],
    support: 0,
    root,
    time: pose.time,
  };
  let amount = raw;
  let phase = pose.phase;
  let goals: FootGoals | undefined;
  if (valid && previous) {
    if (walking && !state.moving) {
      // Start the stance in its centre so both feet begin beneath the body.
      const travelled = wrap((pose.phase - state.inputPhase) / TAU) * TAU;
      state.offset = stance * 0.5 * TAU + travelled - pose.phase;
      state.starting = 0;
      state.stopFeet = null;
    }
    if (!walking && state.moving) {
      figure.root.updateWorldMatrix(true, false);
      state.stopFeet = state.feet.map((goal, i) => {
        state.stopWorld[i].copy(state.world[i]);
        const local = figure.root.worldToLocal(state.world[i].clone());
        return { ...goal, x: local.x, z: local.z };
      }) as FootGoals;
      state.support = state.feet[0].planted ? 0 : 1;
      state.stopping = 0;
    }
    if (walking) {
      phase += state.offset;
      state.starting = Math.min(0.14, state.starting + dt);
      const start = smooth(state.starting / 0.14);
      amount *= start;
      goals = [footCycle(phase, 0, 1), footCycle(phase, 1, 1)];
      for (const goal of goals) goal.lift *= start;
    } else if (state.stopFeet && state.stopping < 0.28) {
      phase = state.phase;
      state.stopping = Math.min(0.28, state.stopping + dt);
      const u = state.stopping / 0.28;
      amount = 1 - smooth(u);
      // The free foot lands first; then the supporting foot steps to neutral.
      goals = state.stopFeet.map((from, i) => {
        const step = smooth(clamp(u * 2 - (i === state.support ? 1 : 0), 0, 1));
        const x = figure.joints!.hips[i].position.x;
        const anchor = figure.root.worldToLocal(state.stopWorld[i].clone());
        return {
          x: THREE.MathUtils.lerp(anchor.x, x, step),
          z: anchor.z * (1 - step),
          lift: from.lift * (1 - step) + Math.sin(step * Math.PI) * 0.043,
          pitch: from.pitch * (1 - step),
          planted: step === 0 ? from.planted : step === 1,
        };
      }) as FootGoals;
    }
  } else {
    state.offset = 0;
    state.starting = 0.14;
    state.stopping = 0.28;
    state.stopFeet = null;
  }
  state.inputPhase = pose.phase;
  state.phase = phase;
  state.moving = walking;
  state.root.copy(root);
  state.time = pose.time;
  state.feet = goals ?? [footCycle(phase, 0, raw), footCycle(phase, 1, raw)];
  gait.set(figure, state);
  return { amount, phase, goals, state };
}

/** Distance, rather than a timer, advances the gait so a stopped foot stops. */
export function advanceStride(figure: Figure, phase: number, distance: number) {
  const stable = Number.isFinite(phase) ? wrap(phase / TAU) * TAU : 0;
  // A first frame or a large online reconciliation is a placement, not a step.
  if (
    !Number.isFinite(distance) ||
    distance < 0 ||
    distance > figure.root.scale.z * 0.8
  )
    return stable;
  return stable + (distance / (cycleTravel * figure.root.scale.z)) * TAU;
}

export function footCycle(phase: number, side: number, moving: number) {
  const u = wrap(phase / TAU + side * 0.5);
  const planted = u < stance;
  const swing = clamp((u - stance) / (1 - stance), 0, 1);
  const z = planted
    ? stride * (1 - (2 * u) / stance)
    : stride * (2 * smooth(swing) - 1);
  return {
    planted: planted || moving < 0.02,
    z: z * moving,
    lift: planted ? 0 : Math.sin(swing * Math.PI) * 0.075 * moving,
    pitch: planted ? 0 : -Math.sin(swing * Math.PI * 2) * 0.13 * moving,
  };
}

/**
 * Analytic two-link IK in the body's frame. The anatomical hint sets the knee
 * or elbow side, and both links retain their authored lengths throughout.
 */
function chain(
  upper: THREE.Object3D,
  lower: THREE.Object3D,
  end: THREE.Object3D,
  target: THREE.Vector3,
  a: number,
  b: number,
  hint: THREE.Vector3,
  orientation: THREE.Quaternion,
) {
  const direction = target.clone().sub(upper.position);
  const distance = clamp(
    direction.length(),
    Math.abs(a - b) + 0.0001,
    a + b - 0.0001,
  );
  direction.normalize();
  const along = (a * a + distance * distance - b * b) / (2 * distance);
  const height = Math.sqrt(Math.max(0, a * a - along * along));
  const bend = hint
    .clone()
    .addScaledVector(direction, -hint.dot(direction))
    .normalize();
  const knee = direction
    .clone()
    .multiplyScalar(along)
    .addScaledVector(bend, height);
  upper.quaternion.setFromUnitVectors(down, knee.clone().normalize());
  const shin = direction.clone().multiplyScalar(distance).sub(knee).normalize();
  const worldLower = new THREE.Quaternion().setFromUnitVectors(down, shin);
  lower.quaternion.copy(upper.quaternion).invert().multiply(worldLower);
  end.quaternion.copy(worldLower).invert().multiply(orientation);
}

function rootSpace(figure: Figure, point: THREE.Vector3) {
  const matrix = new THREE.Matrix4()
    .compose(figure.body.position, figure.body.quaternion, figure.body.scale)
    .invert();
  return point.applyMatrix4(matrix);
}

function feet(
  figure: Figure,
  phase: number,
  moving: number,
  sitting: boolean,
  goals?: FootGoals,
) {
  const joints = figure.joints;
  if (!joints) return;
  const floor = -figure.root.position.y / figure.root.scale.y;
  const contacts: boolean[] = [];
  for (let i = 0; i < 2; i++) {
    const cycle: FootGoal = goals?.[i] ?? footCycle(phase, i, moving);
    const target = new THREE.Vector3(
      cycle.x ?? joints.hips[i].position.x,
      floor + HUMAN.ankle + cycle.lift,
      sitting ? 0.225 : cycle.z,
    );
    const orientation = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(sitting ? 0 : cycle.pitch, 0, 0),
    );
    const localOrientation = figure.body.quaternion
      .clone()
      .invert()
      .multiply(orientation);
    chain(
      joints.hips[i],
      joints.knees[i],
      joints.ankles[i],
      rootSpace(figure, target),
      HUMAN.thigh,
      HUMAN.shin,
      new THREE.Vector3(0, 0, 1),
      localOrientation,
    );
    contacts.push(sitting || cycle.planted);
  }
  figure.root.userData.dinerFootContact = contacts;
}

function handTarget(
  figure: Figure,
  i: number,
  target: THREE.Vector3,
  pitch: number,
) {
  const joints = figure.joints;
  if (!joints) return;
  const side = i === 0 ? -1 : 1;
  const orientation = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(pitch, 0, -side * 0.04),
  );
  chain(
    joints.shoulders[i],
    joints.elbows[i],
    joints.wrists[i],
    target,
    HUMAN.upperArm,
    HUMAN.forearm,
    new THREE.Vector3(side * 0.8, -0.65, -0.15),
    orientation,
  );
}

/** The pose owns local joints only; simulation translation and yaw stay on root. */
export function poseFigure(figure: Figure, pose: FigurePose) {
  if (!figure.joints) return;
  const {
    time,
    seed = 0,
    carry = false,
    sitting = false,
    eating = false,
    impatient = false,
    gesture = 0,
    mopping = false,
    reduced = false,
  } = pose;
  const motion = locomotion(figure, pose);
  const moving = motion.amount;
  const phase = motion.phase;
  const t = time + seed * 0.717;
  const body = figure.body;
  body.scale.set(1, 1, 1);
  if (sitting) {
    // Cushion top is 0.48 world units. Pelvis underside is native y=0.50.
    body.position.y =
      (0.48 - figure.root.position.y) / figure.root.scale.y - 0.5;
    body.rotation.set(0.015, 0, 0);
  } else {
    const cycles = motion.goals ?? [
      footCycle(phase, 0, moving),
      footCycle(phase, 1, moving),
    ];
    const reach =
      Math.max(...cycles.filter((c) => c.planted).map((c) => Math.abs(c.z))) /
      stride;
    body.position.y = -0.008 - 0.012 * moving - 0.029 * reach * reach;
    body.rotation.set(
      moving * 0.035,
      0,
      reduced ? 0 : Math.sin(phase) * 0.012 * moving,
    );
    if (!reduced && moving < 0.02)
      body.position.y += Math.sin(t * 1.9) * 0.0023;
    if (!reduced && impatient) body.rotation.z += Math.sin(t * 2.5) * 0.012;
    if (mopping)
      body.rotation.x = reduced ? 0.055 : 0.055 + Math.sin(t * 7) * 0.014;
    // Forward lean changes hip reach as well as height. Respect the actual
    // leg length before IK, including a catch step during interpolation.
    for (let i = 0; i < 2; i++) {
      const goal: FootGoal = cycles[i];
      const hip = figure.joints.hips[i].position
        .clone()
        .applyQuaternion(body.quaternion);
      const horizontal = (goal.x ?? hip.x) - hip.x;
      const depth = goal.z - hip.z;
      const reach = Math.sqrt(
        Math.max(
          0,
          (HUMAN.thigh + HUMAN.shin - 0.0006) ** 2 -
            horizontal ** 2 -
            depth ** 2,
        ),
      );
      const height =
        -figure.root.position.y / figure.root.scale.y +
        HUMAN.ankle +
        goal.lift +
        reach -
        hip.y;
      body.position.y = Math.min(body.position.y, height - 0.0015);
    }
  }
  feet(figure, phase, moving, sitting, motion.goals);
  figure.root.updateWorldMatrix(true, false);
  for (let i = 0; i < 2; i++) {
    const cycle = motion.state.feet[i];
    motion.state.world[i]
      .set(
        cycle.x ?? figure.joints.hips[i].position.x,
        -figure.root.position.y / figure.root.scale.y +
          HUMAN.ankle +
          cycle.lift,
        cycle.z,
      )
      .applyMatrix4(figure.root.matrixWorld);
  }

  const { shoulders, elbows, wrists } = figure.joints;
  for (let i = 0; i < 2; i++) {
    const side = i === 0 ? -1 : 1;
    if (carry) {
      // Palms meet the plate's underside instead of two whole arms jutting out.
      handTarget(
        figure,
        i,
        new THREE.Vector3(side * 0.105, 0.724, 0.301),
        -Math.PI / 2,
      );
    } else if (sitting) {
      const restY =
        (0.768 - figure.root.position.y) / figure.root.scale.y -
        body.position.y;
      const bite =
        eating && i === 1 && !reduced ? smooth((1 + Math.sin(t * 2.2)) / 2) : 0;
      const target = new THREE.Vector3(
        side * (0.117 - bite * 0.071),
        THREE.MathUtils.lerp(restY, 0.985, bite),
        THREE.MathUtils.lerp(0.215, 0.176, bite),
      );
      handTarget(
        figure,
        i,
        target,
        THREE.MathUtils.lerp(-Math.PI / 2, -2.25, bite),
      );
    } else if (gesture > 0 && i === 1) {
      const reach = Math.sin(clamp(gesture, 0, 1) * Math.PI);
      handTarget(
        figure,
        i,
        new THREE.Vector3(
          side * 0.174,
          0.59 + reach * 0.23,
          0.07 + reach * 0.205,
        ),
        (-reach * Math.PI) / 2,
      );
    } else if (mopping) {
      // Opposing side grips: local knuckle-width X follows the shaft's Y,
      // fingers turn inward and both thumbs point upward. Offset the wrist
      // from the shared shaft centre, rather than attaching a prop to an
      // open palm's approximate position.
      const orientation = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 0, 1),
        (-side * Math.PI) / 2,
      );
      const target = new THREE.Vector3(
        0,
        (i === 0 ? 0.752 : 0.641) + (reduced ? 0 : Math.sin(t * 7) * 0.025),
        0.213,
      ).sub(
        new THREE.Vector3()
          .fromArray(MOP_GRIP_LOCAL)
          .applyQuaternion(orientation),
      );
      chain(
        shoulders[i],
        elbows[i],
        wrists[i],
        target,
        HUMAN.upperArm,
        HUMAN.forearm,
        new THREE.Vector3(side * 0.8, -0.65, -0.15),
        orientation,
      );
    } else {
      shoulders[i].rotation.set(
        Math.sin(phase + i * Math.PI) * 0.34 * moving,
        0,
        side * 0.052,
      );
      elbows[i].rotation.set(
        -0.065 -
          (moving ? (0.5 + 0.5 * Math.cos(phase + i * Math.PI)) * 0.14 : 0),
        0,
        0,
      );
      wrists[i].rotation.set(0.07, 0, 0);
    }
  }
  if (figure.hold) {
    figure.hold.position.set(0, 0.746, 0.329);
    // Counter body tilt so a served plate stays level and doesn't bounce.
    figure.hold.quaternion.copy(body.quaternion).invert();
  }
  if (figure.head) {
    const glance =
      !reduced && moving < 0.02
        ? Math.sin(t * 0.55) * (sitting ? 0.07 : 0.045)
        : 0;
    figure.head.rotation.set(
      eating && !reduced
        ? 0.025 + Math.sin(t * 2.2) * 0.017
        : impatient
          ? -0.025
          : carry
            ? 0.015
            : 0,
      glance,
      0,
    );
  }
}

/** Focused locomotion helper for callers that own all upper-body actions. */
export function poseWalk(
  figure: Figure,
  phase: number,
  moving: number,
  time = 0,
  reduced = false,
) {
  poseFigure(figure, { phase, moving, time, reduced });
}
