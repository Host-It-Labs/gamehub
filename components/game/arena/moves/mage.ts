import type { MoveContext, Moves } from './types';
import type { Matrix4, Mesh, Object3D, Vector3 } from 'three';

const clamp = (x: number, lo: number, hi: number) =>
  x < lo ? lo : x > hi ? hi : x;
const clamp01 = (x: number) => clamp(x, 0, 1);
const ease = (x: number) => {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
};
/** 0 → 1 → 0 across the window [a, b]. */
const bump = (x: number, a: number, b: number) =>
  x <= a || x >= b ? 0 : Math.sin(((x - a) / (b - a)) * Math.PI);
/** A stable 0..1 number per troop and draw. */
const hash = (a: number, b: number) => {
  const s = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return s - Math.floor(s);
};

// The staff arm in the figure's side view (figure_mage.py, metres; y
// forward, z up): the waist (torso pivot), shoulder, elbow, the fist round
// the staff (its pivot) and the staff's foot at rest.
type P2 = [number, number];
const WAIST: P2 = [0, 0.56];
const SHOULDER: P2 = [-0.005, 0.865];
const ELBOW: P2 = [-0.0785, 0.7508];
const FIST: P2 = [0.1595, 0.72];
const FOOT: P2 = [0.2, 0.012];
const STAFF = Math.hypot(FOOT[0] - FIST[0], FOOT[1] - FIST[1]);
/** A down-pointing vector's forward angle (a +x turn adds to it). */
const angle = (y: number, z: number) => Math.atan2(y, -z);
const STAFF_ANGLE = angle(FOOT[0] - FIST[0], FOOT[1] - FIST[1]);
/** Model metres per world unit along the ground, at size 1 (TROOP_SCALE
 *  1.75 times the figure's 1.12 widening). */
const GROUND = 1.75 * 1.12;

type StaffPlant = {
  weapon: Object3D;
  hand: Object3D;
  fore: Object3D;
  contacts: Vector3[];
  inverse: Matrix4;
  point: Vector3;
  target: Vector3;
  lowest: Vector3;
};
const staffPlants = new WeakMap<Object3D, StaffPlant>();
const nearAngle = (angle: number, around: number) =>
  around + Math.atan2(Math.sin(angle - around), Math.cos(angle - around));

/** The ground solver changes pelvis height after the authored move runs.
 *  Plant the actual silver shoe from the final body/torso/forearm matrices,
 *  retaining deliberate taps and overhead sweeps and moving its closed hand
 *  by exactly the same wrist correction. Scratch geometry is cached once. */
export function plantMageStaff(
  model: Object3D,
  memo: Record<string, number>,
  groundAt: (x: number, z: number) => number,
  wristRestY: number,
) {
  memo.staffCanPlant = 0;
  if ((memo.staffDeploy ?? 1) < 0.9) return;
  let plant = staffPlants.get(model);
  if (!plant) {
    const weapon = model.getObjectByName('mageweapon');
    const hand = model.getObjectByName('magehandR');
    const shoe = model.getObjectByName('mage-shoe') as Mesh | undefined;
    if (!weapon?.parent || !hand || !shoe?.isMesh) return;
    model.updateWorldMatrix(true, true);
    const inverse = weapon.matrixWorld.clone().invert();
    const point = model.position.clone();
    const contacts: Vector3[] = [];
    for (let i = 0; i < shoe.geometry.attributes.position.count; i++) {
      shoe.getVertexPosition(i, point);
      contacts.push(
        point.clone().applyMatrix4(shoe.matrixWorld).applyMatrix4(inverse),
      );
    }
    plant = {
      weapon,
      hand,
      fore: weapon.parent,
      contacts,
      inverse,
      point,
      target: point.clone(),
      lowest: point.clone(),
    };
    staffPlants.set(model, plant);
  }
  const { weapon, hand, fore, contacts, inverse, point, target, lowest } =
    plant;
  model.updateWorldMatrix(true, true);
  inverse.copy(fore.matrixWorld).invert();
  const world = model.matrixWorld.elements;
  const lift = (memo.staffLift ?? 0) * Math.hypot(world[4], world[5], world[6]);
  const free = (memo.staffFree ?? 0) > 0.001;
  // The bridge slopes below the whole shoe. Select the smallest terrain
  // clearance, not the lowest world-space vertex, and converge again when
  // the corrected shaft moves that contact along the deck.
  for (let pass = 0; pass < 20; pass++) {
    let local = contacts[0];
    let clearance = Infinity;
    let ground = 0;
    for (const contact of contacts) {
      point.copy(contact).applyMatrix4(weapon.matrixWorld);
      const floor = groundAt(point.x, point.z);
      const gap = point.y - floor;
      if (gap < clearance) {
        clearance = gap;
        ground = floor;
        local = contact;
        lowest.copy(point);
      }
    }
    // The crystal staff is intentionally free in its overhead cast. Only a
    // below-ground shoe is corrected in that part of the cycle.
    if (free && clearance >= -0.0002) break;
    const height = ground + (free ? 0.001 : lift);
    if (Math.abs(clearance - (free ? 0.001 : lift)) < 0.0002) break;
    target.copy(lowest);
    target.y = height;
    target.applyMatrix4(inverse);
    const y = local.y * weapon.scale.y;
    const z = local.z * weapon.scale.z;
    const length = Math.hypot(y, z);
    const forward = clamp(target.z - weapon.position.z, -length, length);
    const down = -Math.sqrt(Math.max(0, length * length - forward * forward));
    const slide = target.y - down;
    const previousY = weapon.position.y;
    weapon.position.y = clamp(slide, wristRestY - 0.05, wristRestY + 0.05);
    // Solve the remaining height from the full transformed forearm plane.
    // Body roll, yaw, squash, chest turn and the planted pelvis are all in it.
    const m = fore.matrixWorld.elements;
    const constant =
      m[13] +
      m[1] * (weapon.position.x + local.x * weapon.scale.x) +
      m[5] * weapon.position.y +
      m[9] * weapon.position.z;
    const a = m[5] * y + m[9] * z;
    const b = -m[5] * z + m[9] * y;
    const radius = Math.hypot(a, b);
    if (radius > 1e-8) {
      // During a cast's spring recovery the fist can still be too high for
      // this length of staff to reach. Keep that lifted pose until it can
      // plant, rather than snapping the shaft straight down or stretching it.
      if (height < constant - radius - 0.0002 && clearance > 0) {
        weapon.position.y = previousY;
        break;
      }
      const phi = Math.atan2(b, a);
      const arc = Math.acos(clamp((height - constant) / radius, -1, 1));
      const left = nearAngle(phi - arc, weapon.rotation.x);
      const right = nearAngle(phi + arc, weapon.rotation.x);
      weapon.rotation.x =
        Math.abs(left - weapon.rotation.x) < Math.abs(right - weapon.rotation.x)
          ? left
          : right;
    }
    hand.rotation.x = weapon.rotation.x;
    hand.position.y = weapon.position.y;
    weapon.updateWorldMatrix(false, true);
    hand.updateWorldMatrix(false, true);
  }
  // Report contact only after the final transformed shoe is checked. A cast
  // recovery whose wrist is still too high must retain its lifted pose.
  let clearance = Infinity;
  for (const contact of contacts) {
    point.copy(contact).applyMatrix4(weapon.matrixWorld);
    clearance = Math.min(clearance, point.y - groundAt(point.x, point.z));
  }
  memo.staffGroundGap = clearance;
  memo.staffCanPlant = !free && Math.abs(clearance - lift) < 0.0002 ? 1 : 0;
}

function turn(p: P2, c: P2, a: number): P2 {
  const dy = p[0] - c[0];
  const dz = p[1] - c[1];
  const cs = Math.cos(a);
  const sn = Math.sin(a);
  return [c[0] + dy * cs - dz * sn, c[1] + dy * sn + dz * cs];
}

/** The staff's turn in the fist (and its slide along it) that puts its
 *  foot on `to`, for the body pitch, chest bend, shoulder and elbow turns
 *  given (all +x turns, as the joints take them). */
function plant(
  pitch: number,
  chest: number,
  arm: number,
  elbow: number,
  to: P2,
) {
  let f = turn(FIST, ELBOW, elbow);
  f = turn(f, SHOULDER, arm);
  f = turn(f, WAIST, chest);
  f = turn(f, [0, 0], pitch);
  const dy = to[0] - f[0];
  const dz = to[1] - f[1];
  const held = pitch + chest + arm + elbow;
  const staff = angle(dy, dz) - STAFF_ANGLE - held;
  // How far the staff must slide down through the fist to reach, along
  // the forearm's own up (the weapon's dy).
  const reach = Math.hypot(dy, dz) - STAFF;
  return { staff, slide: -reach * Math.cos(staff + STAFF_ANGLE) };
}

/** Where the staff's foot goes while walking (metres forward of where it
 *  stands, and its lift): planted with the left foot and held there while
 *  the body walks past it, then swung forward to the next plant. */
function staffWalk(c: MoveContext): P2 {
  const m = c.memo;
  const PLANT = 0.52;
  const per = m.per || 1.1;
  const scale = GROUND * c.size;
  const half = (per * PLANT) / scale / 2;
  if (c.cycle < PLANT) {
    if (!m.planted) {
      // A new plant: learn the stride from the last one.
      if (m.at && c.travel - m.at > 0.2 && c.travel - m.at < 5)
        m.per = per * 0.5 + (c.travel - m.at) * 0.5;
      m.at = c.travel;
      m.planted = 1;
    }
    return [clamp(half - (c.travel - m.at) / scale, -half * 1.4, half), 0];
  }
  m.planted = 0;
  const k = (c.cycle - PLANT) / (1 - PLANT);
  return [-half + 2 * half * ease(k), Math.sin(Math.PI * k) * 0.07];
}

// Idle fidgets: what he does after standing a while, and how long each
// takes (seconds).
const TAP = 0;
const TOSS = 1;
const PEER = 2;
const LEAN = 3;
const FIDGET_TIME = [1.5, 1.7, 2.6, 2.6];

function fidget(c: MoveContext) {
  const m = c.memo;
  // A newly drawn stationary troop may start after a slow frame or resume;
  // its idle clock can already exceed the reset window on the first call.
  if (m.fKind === undefined || c.idleFor < 0.05) {
    m.fKind = -1;
    m.fNext = 1.2 + hash(c.unit.id, 1) * 1.6;
    return { kind: -1, t: 0, k: 0 };
  }
  if (m.fKind < 0 && c.idleFor > m.fNext) {
    m.fCount = (m.fCount || 0) + 1;
    // Never the same one twice running.
    const pick = Math.floor(hash(c.unit.id, m.fCount) * 3.999);
    m.fKind = pick === m.fLast ? (pick + 1) % 4 : pick;
    m.fLast = m.fKind;
    m.fStart = c.idleFor;
  }
  if (m.fKind < 0) return { kind: -1, t: 0, k: 0 };
  const t = c.idleFor - m.fStart;
  const time = FIDGET_TIME[m.fKind];
  if (t > time) {
    m.fKind = -1;
    m.fNext = c.idleFor + 2.2 + hash(c.unit.id, m.fCount + 50) * 2.8;
    return { kind: -1, t: 0, k: 0 };
  }
  return { kind: m.fKind, t, k: t / time };
}

/** A rate of change kept smooth between frames (for parts that lag it). */
function rate(c: MoveContext, key: string, value: number) {
  const m = c.memo;
  const last = m[key] ?? value;
  m[key] = value;
  const v = c.dt > 0 ? (value - last) / c.dt : 0;
  const rk = `${key}v`;
  m[rk] =
    (m[rk] ?? 0) + (clamp(v, -12, 12) - (m[rk] ?? 0)) * clamp01(c.dt * 10);
  return m[rk];
}

/** The Wizard: an old wizard who walks with his staff, planting it with
 *  each stride, the flame in his other palm. His cape trails and billows,
 *  the hat's tip flops, the beard swings; he casts with a big overhead
 *  sweep of the staff and an underhand toss of the flame, in turn. */
export const mage: Moves = {
  style: {
    // Unhurried, a little rolling: the robe swings with each step.
    gait: {
      like: 'brisk',
      stride: 0.6,
      weight: 0.45,
      sway: 0.5,
      roll: 0.05,
      twist: 0.12,
    },
    armSwing: 0.24,
    lean: 0.07,
    attack: 'custom',
    windup: 0.62,
    lunge: 0.14,
    snap: 26,
  },
  carriage: {
    twist: 0.15,
    hips: 0.08,
    chestRoll: 0.35,
    nod: 0.016,
    armOut: 0,
    bounce: 0.018,
    weaponArm: 0.5,
  },
  // Soft cloth, felt and hair: low stiffness and damping so they swing
  // past and settle. The staff tracks its plant closely.
  stiff: {
    cape: 0.34,
    cape2: 0.3,
    hat: 0.42,
    beard: 0.4,
    extra2: 0.55,
    extra: 0.9,
    weapon: 2.6,
    handR: 2.6,
    foreR: 1.4,
    armR: 1.1,
    foreL: 1.1,
  },
  damping: {
    cape: 0.34,
    cape2: 0.3,
    hat: 0.36,
    beard: 0.34,
    extra2: 0.42,
    extra: 0.5,
  },
  pose(c, p) {
    const { aim, wind, strike, walk, flinch } = c;
    const idle = c.reduced ? 0 : c.idle;
    const m = c.memo;
    const deploying = c.deploy < 1;
    const d = c.deploy;
    p.headX *= 1 - c.idle;
    p.headY *= 1 - c.idle;
    p.roll *= 1 - c.idle;

    // ---------------------------------------------------------- attack
    // Even hits: the staff swept up over his head and down to point the
    // crystal at the target. Odd hits: the flame drawn back and tossed
    // underhand. The wind-up belongs to the coming hit, the strike and
    // the follow-through to the one just made.
    const nextStaff = (c.hits + 1) % 2 === 0;
    const lastStaff = c.hits % 2 === 0;
    // The strike is held a moment (the figures are drawn large: a pose
    // flashed for a tenth of a second never reads), then eased back to
    // the ready stance; the follow-through carries past it first.
    const hit =
      aim > 0.02
        ? c.since < 0.075
          ? 1 - Math.pow(1 - clamp01(c.since / 0.075), 3)
          : c.since < 0.14
            ? 1
            : 1 - ease((c.since - 0.14) / 0.48)
        : 0;
    const after = aim > 0.02 ? bump(c.since, 0.045, 0.36) : 0;
    // Continue the loaded pose across the engine hit, then release it.
    // Previously the raised staff reset to rest on the first hit frame.
    const releaseWind = c.since < 0.075 ? (1 - hit) * aim : 0;
    const windA = Math.max(nextStaff ? wind : 0, lastStaff ? releaseWind : 0);
    const windB = Math.max(nextStaff ? 0 : wind, lastStaff ? 0 : releaseWind);
    const hitA = lastStaff ? hit * aim : 0;
    const hitB = lastStaff ? 0 : hit * aim;
    const afterA = lastStaff ? after : 0;
    const afterB = lastStaff ? 0 : after;
    // Anticipation: up, back and a crouch; then thrown through.
    p.torsoX += -windA * 0.16 + hitA * 0.26 + afterA * 0.12;
    p.torsoX += -windB * 0.06 + hitB * 0.18 + afterB * 0.08;
    p.torsoY += aim * -0.08;
    // Between casts, a slow gathering sway.
    p.torsoY += c.reduced ? 0 : Math.sin(c.t * 1.9) * 0.018 * aim * (1 - wind);
    p.armL += c.reduced
      ? 0
      : Math.sin(c.t * 1.9 + 0.8) * 0.032 * aim * (1 - wind);
    p.torsoY += -windA * 0.28 + hitA * 0.24 + afterA * 0.1;
    p.torsoY += windB * 0.34 - hitB * 0.3 - afterB * 0.12;
    p.headX += windA * 0.12 - hitA * 0.06 + windB * 0.04;
    // The eyes stay on the target while the shoulders turn.
    p.headY -= (p.torsoY + 0.08 * aim) * 0.6;
    p.lean += -(windA + windB) * 0.05 + hit * 0.12 + after * 0.06;
    p.lunge += strike * 0.14 + after * 0.05;
    p.squash *= 1 - (windA + windB) * 0.035 + hit * 0.025;
    p.roll += windB * 0.04 - hitB * 0.03;

    // ---------------------------------------------------------- idle
    const f = c.reduced ? { kind: -1, t: 0, k: 0 } : fidget(c);
    const fk = f.kind;
    const fe = f.kind >= 0 ? bump(f.k, 0, 1) : 0;
    const settleIn = ease(c.idleFor / 0.8) * idle;
    // Breathing and a slow shift of weight from foot to foot.
    const breath = Math.sin(c.t * 1.7);
    p.torsoX += breath * 0.012 * idle;
    p.roll += Math.sin(c.t * 0.45) * 0.018 * settleIn;
    p.torsoZ -= Math.sin(c.t * 0.45) * 0.012 * settleIn;
    // Taps: the staff lifted and knocked down twice, a nod with each.
    const tap =
      fk === TAP ? bump(f.t, 0.25, 0.55) + bump(f.t, 0.7, 1.0) * 0.8 : 0;
    // The moments it knocks the ground.
    const knockTap =
      fk === TAP ? bump(f.t, 0.5, 0.62) + bump(f.t, 0.95, 1.07) * 0.8 : 0;
    p.squash *= 1 - knockTap * 0.015;
    p.headX +=
      fk === TAP ? (bump(f.t, 0.45, 0.65) + bump(f.t, 0.9, 1.1)) * 0.07 : 0;
    // The toss: the flame thrown up a hand's height and caught, his eyes
    // following it.
    const tossT = fk === TOSS ? clamp01((f.t - 0.3) / 0.85) : 0;
    const toss = fk === TOSS ? 4 * tossT * (1 - tossT) : 0;
    const dipBefore = fk === TOSS ? bump(f.t, 0.05, 0.38) : 0;
    const catchDip = fk === TOSS ? bump(f.t, 1.1, 1.5) : 0;
    p.headX -= toss * 0.22;
    p.headY *= 1 - (fk === TOSS ? fe : 0);
    // Peering: leaning in, the flame held up like a lantern, looking one
    // way, then the other.
    const peer =
      fk === PEER ? ease(f.t / 0.4) * (1 - ease((f.t - 2.1) / 0.5)) : 0;
    p.torsoX += peer * 0.14;
    p.headX += peer * 0.06;
    p.headY +=
      fk === PEER
        ? peer * 0.5 * Math.sin(clamp01((f.t - 0.3) / 2) * Math.PI * 2)
        : 0;
    // Leaning on the staff, with a long breath out.
    const lean =
      fk === LEAN ? ease(f.t / 0.6) * (1 - ease((f.t - 1.9) / 0.7)) : 0;
    p.roll -= lean * 0.05;
    p.torsoZ -= lean * 0.08;
    p.torsoX +=
      lean * (0.06 - Math.sin(clamp01((f.t - 0.6) / 1.4) * Math.PI) * 0.05);
    p.headX -= lean * 0.04;
    p.headY += lean * 0.18;

    // ---------------------------------------------------------- deploy
    // Floating down with arms out, the cape blown up; a soft landing,
    // then he stands and knocks the staff down once.
    const falling = deploying ? 1 - clamp01((d - 0.12) / 0.2) : 0;
    const landing = deploying ? bump(d, 0.24, 0.48) : 0;
    const thump = deploying ? bump(d, 0.5, 0.74) : 0;
    const knock = deploying ? bump(d, 0.7, 0.86) : 0;
    p.torsoX += landing * 0.18 - thump * 0.06;
    p.headX += landing * 0.1 - thump * 0.08;
    p.armLz -= falling * 0.18;
    p.armL += falling * 0.14;

    // ---------------------------------------------------------- hit
    // Hit: the flame arm flung up, a twist away and a stagger back (the
    // shared flinch already throws the head back).
    p.armL += flinch * flinch * 0.32;
    p.armLz -= flinch * flinch * 0.2;
    p.torsoY += flinch * 0.16;
    p.lunge -= flinch * 0.05;
    p.roll += flinch * 0.04;

    // ---------------------------------------------------------- staff arm
    // Everywhere but in A the staff's foot stays on the ground (or steps
    // forward with the walk), the fist turning to keep it there. Ready, it
    // is planted further forward and he leans on it a little.
    const [step, stepLift] = staffWalk(c);
    const fwd = step * walk + 0.04 * walk + aim * 0.09;
    const lift = stepLift * walk + tap * 0.11 + thump * 0.12;
    let armR = aim * 0.25 + fwd * 0.9 + lift * 0.9 + lean * 0.12 + peer * 0.08;
    let foreR = -aim * 0.1 + fwd * 0.3 + lift * 1.2 - lean * 0.15 + 0.05 * walk;
    armR += falling * 0.35 + windB * 0.08;
    // A: the fist up over his head, the crystal laid back behind him; then
    // the arm swept down and forward to shoulder height, the crystal
    // pointing at the target, on past it and back.
    armR += windA * 2.05 + hitA * 0.85 - afterA * 0.25;
    foreR += windA * 0.45 + hitA * 0.15 - afterA * 0.05;
    const sol = plant(-p.lean, -p.torsoX, armR, foreR, [
      FOOT[0] + fwd,
      FOOT[1] + lift,
    ]);
    // The staff's whole turn in A (shoulder, elbow and fist), as a turn in
    // the fist.
    const heldA = windA * 0.45 + hitA * -0.85 + afterA * -0.25;
    const inA = clamp01(windA + hitA + afterA * 2);
    let staffTurn =
      sol.staff * (1 - inA) + (heldA - armR - foreR + p.torsoX + p.lean) * inA;
    const slide = sol.slide * (1 - inA);
    m.staffFree = inA;
    m.staffLift = lift;
    m.staffDeploy = d;
    // A hit knocks the staff about.
    staffTurn += flinch * 0.25;
    c.want('armR', armR, 0, p.armRz + falling * 0.1 + knock * 0.02);
    c.want('foreR', foreR);
    c.want('weapon', staffTurn, 0, 0, clamp(slide, -0.05, 0.05));
    // The closed hand follows the same wrist frame as the staff. Keeping
    // it fixed on the forearm let the shaft turn through the fingers during
    // the overhead cast. The two sibling frames share a rest pivot and the
    // same spring, so contact survives planting, casting and recovery.
    c.want('handR', staffTurn, 0, 0, clamp(slide, -0.05, 0.05));
    p.squash *= 1 - knock * 0.05;

    // ---------------------------------------------------------- flame arm
    // Carried steady in front of him: less swing than the shared walk,
    // the elbow giving with each step.
    p.armL -= c.swingL * 0.6;
    p.armL -= idle * 0.12;
    p.armLz += idle * 0.04;
    let foreL = walk * (1 - aim) * 0.07 * (1 + c.fwdR) - idle * 0.08;
    // Ready: held forward. B: drawn back by the hip, then tossed forward
    // and up from below, palm up. A: swung out for balance.
    // (The sculpt holds the forearm bent 1.8 up from the upper arm: the
    // hand by the hip is the upper arm back with the elbow as it is; the
    // throw is the upper arm forward with the elbow opened out, so the
    // forearm points at the target, palm and flame up.)
    p.armL += aim * 0.35 - windB * 0.95 + hitB * 0.85 + afterB * 0.2;
    foreL += aim * -0.1 + windB * 0.1 - hitB * 1.3 - afterB * 0.2;
    p.armL += -windA * 0.25 + hitA * 0.15;
    p.armLz += -windA * 0.15 - hitA * 0.45 - afterA * 0.2;
    foreL += windA * 0.4;
    // Toss: down a little, up with the flame, a dip on the catch.
    p.armL += -dipBefore * 0.12 + toss * 0.22 - catchDip * 0.1;
    foreL += dipBefore * 0.1 - toss * 0.05 + catchDip * 0.12;
    // The lantern.
    p.armL += peer * 0.75;
    foreL -= peer * 0.25;
    foreL += lean * 0.25;
    foreL += flinch * 0.3;
    c.want('foreL', foreL);
    // The wrist keeps the palm level, flame up.
    const handTilt = p.armL + foreL - p.torsoX - p.lean;
    p.offhand += -clamp(handTilt, -0.6, 2.2) * 0.6;

    // ---------------------------------------------------------- flame
    // Turning and bobbing; it spins up as he gathers a cast and leaps up
    // off the palm as he throws; tossed up while he waits.
    m.spin =
      (m.spin ?? hash(c.unit.id, 7) * 6) +
      c.dt * ((c.reduced ? 0 : 2.4) + 3 * (windB + windA * 0.5));
    const flameDy =
      (c.reduced ? 0 : Math.sin(c.t * 3.3) * 0.005) +
      toss * 0.16 +
      windB * 0.015 +
      afterB * 0.08 +
      flinch * 0.02 +
      knock * 0.03;
    // It burns upward whatever the hand does.
    const upright = -(handTilt + p.offhand) * 0.85;
    c.want(
      'extra',
      upright,
      m.spin,
      c.reduced ? 0 : Math.sin(c.t * 2.3) * 0.08,
      flameDy,
    );

    // ---------------------------------------------------------- cloth
    // The body's motion, eased into -1..1 so a sudden turn or a stop
    // swings the cloth hard but never flings it about.
    const acc = Math.tanh(c.accel / 5);
    const trn = Math.tanh(c.turn / 3);
    const lat = Math.tanh(c.lateral / 5);
    const vert = Math.tanh(c.vertical / 6);
    const hv = Math.tanh(rate(c, 'hx', p.headX) / 3);
    const sway = (c.fwdL - c.fwdR) * walk;
    const bodyRoll = p.roll + p.torsoZ;
    // The cape: trailing on the move, swinging back as he sets off and
    // forward as he stops, out in turns, up as he drops, flying back on a
    // cast, hanging plumb when he bends. Its lower link takes a share of
    // the same swing on top of the upper's, a moment later (its own
    // softer spring), so it curls rather than tilting flat.
    const swing =
      -(0.02 + 0.04 * (1 - c.pass)) * walk -
      0.2 * acc -
      0.14 * Math.abs(trn) +
      0.15 * Math.min(0, vert) -
      windA * 0.2 -
      strike * 0.25 -
      after * 0.2 -
      flinch * 0.3 -
      (0.02 + 0.02 * Math.sin(c.t * 0.8)) * idle -
      falling * 0.55 -
      landing * 0.1;
    const capeX = clamp(swing * 0.65 + (p.torsoX + p.lean) * 0.6, -0.7, 0.035);
    const capeZ = clamp(
      0.22 * trn -
        0.1 * lat -
        bodyRoll * 0.8 +
        sway * 0.045 +
        Math.sin(c.t * 0.6) * 0.02 * idle,
      -0.4,
      0.4,
    );
    c.want('cape', capeX, -p.torsoY * 0.4 + 0.06 * trn, capeZ);
    c.want(
      'cape2',
      clamp(swing * 0.6 - 0.015 * walk, -0.8, 0.04),
      0,
      clamp(0.12 * trn - 0.05 * lat + sway * 0.03, -0.3, 0.3),
    );
    // The skirt hangs from the belt: plumb whatever the chest does, pushed
    // round by the striding thighs, lagging turns and starts.
    c.want(
      'extra2',
      p.torsoX * 0.85 + p.lean * 0.4 - 0.03 * walk - 0.05 * acc - strike * 0.05,
      -(c.hipL - c.hipR) * 0.2 - p.torsoY * 0.55,
      -p.torsoZ * 0.8 - p.roll * 0.3 - 0.04 * lat + 0.06 * trn,
    );
    // The hat's tip: tipping back as he sets off and forward as he stops,
    // flopping on each step and with every nod, out in turns.
    const hatX = clamp(
      0.2 * acc +
        0.1 * vert +
        0.07 * (1 - c.pass) * walk +
        hv * 0.15 +
        windA * 0.25 -
        strike * 0.2 +
        flinch * 0.35 +
        falling * 0.4 -
        thump * 0.15 +
        knockTap * 0.2 +
        Math.sin(c.t * 1.1) * 0.03 * idle,
      -0.35,
      0.45,
    );
    const hatZ = clamp(
      -0.22 * trn + 0.1 * lat + bodyRoll * 0.5 + sway * 0.05 + lean * 0.1,
      -0.3,
      0.3,
    );
    c.want('hat', hatX, 0, hatZ);
    // The beard hangs from his chin over the chest: it may swing forward
    // freely, back only a touch.
    const beardX = Math.max(
      -0.03,
      0.03 +
        Math.max(0, p.headX) * 0.9 +
        p.torsoX * 0.3 -
        0.12 * acc +
        0.05 * (1 - c.pass) * walk -
        hv * 0.12 +
        flinch * 0.3 +
        falling * 0.35 +
        windA * 0.1 -
        strike * 0.08 +
        (fk === PEER ? Math.sin(f.t * 9) * 0.03 * peer : 0),
    );
    const beardZ = clamp(
      0.16 * trn - 0.08 * lat - bodyRoll * 0.6 + sway * 0.03,
      -0.3,
      0.3,
    );
    c.want('beard', beardX, 0, beardZ);
  },
  arrive(d) {
    // Settle once with the staff held. No airborne A-pose, full turn or
    // rebound after contact; the planted legs absorb the arrival.
    const k = clamp01(d / 0.27);
    const fall = 1 - (1 - k) * (1 - k);
    const drop = (1 - fall) * 3.2;
    const twirl = 0;
    let squash = 1 + (1 - k) * 0.04;
    if (d >= 0.27) {
      squash = 1 - bump(d, 0.27, 0.42) * 0.055;
    }
    squash -= bump(d, 0.7, 0.8) * 0.015;
    return { drop, squash, twirl };
  },
};
