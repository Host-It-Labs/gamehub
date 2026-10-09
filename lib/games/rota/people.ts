import { walkSpanY, type WalkRoute } from './neighbourhood.ts';

/** Ambient residents use the authored pavements only. This simulation has no
 * access to the player's cells or traffic mutation API. Distances and speeds
 * are in the mill town's 25 m squares, time in seconds. */
export const PEOPLE_MAX = 28;
/** User-requested second-pass visibility scale; retain the authored anatomy. */
export const PEOPLE_PRESENTATION_SCALE = 1.3;
export type CrossingClearance = { blocked: boolean; clearance: number };

/** Modes are kept numeric because they are updated in a bounded hot loop. */
export const WALK = 0,
  PAUSE = 1,
  TURN = 2,
  ENTER = 3,
  INSIDE = 4,
  EXIT = 5,
  KERB = 6;

export type Resident = {
  route: WalkRoute;
  distance: number;
  direction: number;
  mode: number;
  timer: number;
  speed: number;
  velocity: number;
  motion: number;
  phase: number;
  travel: number;
  stride: number;
  size: number;
  style: number;
  seed: number;
  visible: boolean;
  x: number;
  y: number;
  z: number;
  heading: number;
  targetHeading: number;
  span: number;
  spanStart: number;
  crossing: number;
  cooldown: number;
  door: number;
  doorX: number;
  doorY: number;
  doorZ: number;
  doorProgress: number;
  visit: number;
  /** Extra forward envelope (the pram), included before entering crossings. */
  envelope: number;
};

export function residentSeed(n: number) {
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

/** Shortest arc. No Vector3, matrices or temporary objects are allocated. */
export function turnHeading(from: number, to: number, amount: number) {
  const delta = Math.atan2(Math.sin(to - from), Math.cos(to - from));
  return from + Math.max(-amount, Math.min(amount, delta));
}

/** Sample the existing route close to a resident, without constructing a
 * point. Feet and the pram's axles follow the same authoritative ramp as the
 * actor; a planted stance therefore keeps its height as well as its position. */
export function heightOnRoute(r: Resident, forward: number) {
  const route = r.route,
    spans = route.spans;
  let distance = r.distance + r.direction * forward;
  distance = route.loop
    ? ((distance % route.length) + route.length) % route.length
    : Math.min(route.length, Math.max(0, distance));
  let i = r.span,
    start = r.spanStart;
  while (i > 0 && distance < start) start -= spans[--i].length;
  while (i < spans.length - 1 && distance > start + spans[i].length)
    start += spans[i++].length;
  const s = spans[i],
    t = Math.min(1, Math.max(0, (distance - start) / s.length));
  return walkSpanY(s, t);
}

function locate(r: Resident) {
  const spans = r.route.spans;
  let start = 0;
  for (let i = 0; i < spans.length; i++) {
    const s = spans[i];
    if (r.distance < start + s.length - 1e-9 || i === spans.length - 1) {
      const t = Math.min(1, Math.max(0, (r.distance - start) / s.length));
      r.x = s.a.x + (s.b.x - s.a.x) * t;
      r.y = walkSpanY(s, t);
      r.z = s.a.z + (s.b.z - s.a.z) * t;
      r.span = i;
      r.spanStart = start;
      r.targetHeading = Math.atan2(
        (s.b.x - s.a.x) * r.direction,
        (s.b.z - s.a.z) * r.direction,
      );
      return;
    }
    start += s.length;
  }
}

/** Seed actors away from crossings, at assorted naturally planted poses. */
export function makeResident(
  route: WalkRoute,
  index: number,
  spawnDistance?: number,
): Resident {
  const seed = residentSeed(index * 97 + 1950);
  const child = index === 1;
  const pram = index === 0;
  const r: Resident = {
    route,
    distance: spawnDistance ?? route.length * residentSeed(index * 113 + 731),
    direction: index % 3 === 1 ? -1 : 1,
    mode: index % 11 === 7 ? PAUSE : WALK,
    timer: 1.2 + seed * 3,
    speed: pram ? 0.032 : 0.033 + seed * 0.012,
    velocity: pram ? 0.032 : 0.033 + seed * 0.012,
    motion: index % 11 === 7 ? 0 : 1,
    phase: residentSeed(index * 37 + 301),
    travel: 0,
    stride: (child ? 0.028 : pram ? 0.038 : 0.044) * PEOPLE_PRESENTATION_SCALE,
    size: (child ? 0.68 : 0.955 + seed * 0.07) * PEOPLE_PRESENTATION_SCALE,
    style: child ? 2 : pram || index % 4 === 3 ? 1 : 0,
    seed,
    visible: true,
    x: 0,
    y: 0,
    z: 0,
    heading: 0,
    targetHeading: 0,
    span: 0,
    spanStart: 0,
    crossing: -1,
    cooldown: 14 + seed * 40,
    door: -1,
    doorX: 0,
    doorY: 0,
    doorZ: 0,
    doorProgress: 0,
    visit: 0,
    envelope:
      (pram ? 0.069 : index === 2 ? 0.057 : 0.022) * PEOPLE_PRESENTATION_SCALE,
  };
  locate(r);
  if (route.spans[r.span].crossing >= 0) {
    // The kerb and everyone in it are outside the swept train/car body.
    r.distance = Math.max(0, r.spanStart - r.envelope - 0.003);
    locate(r);
  }
  r.heading = r.targetHeading;
  return r;
}

function finishTurn(r: Resident) {
  r.mode = WALK;
  r.velocity = 0;
  r.timer = 0;
  r.crossing = -1;
}

function stop(r: Resident, dt: number) {
  r.velocity = Math.max(0, r.velocity - dt * 0.17);
  r.motion = Math.max(0, r.motion - dt * 4.5);
}

/** A tiny, bounded path search. It checks the whole crossing plus the pram's
 * leading wheels before entry; occupants always finish after a late closure. */
function crossingLimit(r: Resident, clearances: readonly CrossingClearance[]) {
  const spans = r.route.spans;
  let start = 0;
  let limit = r.direction > 0 ? Infinity : -Infinity;
  for (let i = 0; i < spans.length; i++) {
    const s = spans[i];
    const end = start + s.length;
    if (s.crossing >= 0) {
      const occupied = r.distance > start + 1e-8 && r.distance < end - 1e-8;
      const alreadyAdmitted = r.crossing === s.crossing;
      const entry = r.direction > 0 ? start : end;
      const ahead = (entry - r.distance) * r.direction;
      const state = clearances[s.crossing];
      const duration = (s.length + 2 * r.envelope) / r.speed + 1.5;
      if (
        !occupied &&
        !alreadyAdmitted &&
        ahead >= -1e-8 &&
        (!state || state.blocked || state.clearance < duration)
      ) {
        const kerb = entry - r.direction * (r.envelope + 0.004);
        if (r.direction > 0) limit = Math.min(limit, kerb);
        else limit = Math.max(limit, kerb);
      } else if (
        !occupied &&
        ahead >= -1e-8 &&
        ahead <= r.envelope + 0.01 &&
        state &&
        !state.blocked &&
        state.clearance >= duration
      ) {
        r.crossing = s.crossing;
      }
      // Hold admission until the trailing dog/pram/coat clears the exit.
      if (
        alreadyAdmitted &&
        (r.direction > 0
          ? r.distance > end + r.envelope
          : r.distance < start - r.envelope)
      )
        r.crossing = -1;
    }
    start = end;
  }
  return limit;
}

function visitDoor(r: Resident, before: number) {
  if (r.cooldown > 0 || r.crossing >= 0) return;
  const doors = r.route.doors;
  for (let i = 0; i < doors.length; i++) {
    const d = doors[i];
    if (
      (d.distance - before) * r.direction >= 0 &&
      (d.distance - r.distance) * r.direction <= 0
    ) {
      r.distance = d.distance;
      locate(r);
      r.doorX = r.x;
      r.doorY = r.y;
      r.doorZ = r.z;
      r.door = i;
      r.doorProgress = 0;
      r.mode = ENTER;
      r.timer = 0.7;
      r.targetHeading = Math.atan2(d.point.x - r.x, d.point.z - r.z);
      return;
    }
  }
}

/** Update one persistent resident. No per-tick allocations; safe to run the
 * same residents at every quality while only their drawing budget changes. */
export function stepResident(
  r: Resident,
  dt: number,
  clearances: readonly CrossingClearance[],
  pavementGap = Infinity,
) {
  dt = Math.max(0, Math.min(0.125, dt));
  if (!dt) return;
  r.cooldown -= dt;

  if (r.mode === INSIDE) {
    r.timer -= dt;
    if (r.timer <= 0) {
      r.visible = true;
      r.mode = EXIT;
      r.doorProgress = 1;
      r.targetHeading = Math.atan2(r.doorX - r.x, r.doorZ - r.z);
      r.timer = 0.5;
    }
    return;
  }

  if (r.mode === ENTER || r.mode === EXIT) {
    const d = r.route.doors[r.door].point;
    const distance = Math.hypot(d.x - r.doorX, d.z - r.doorZ);
    r.heading = turnHeading(r.heading, r.targetHeading, dt * 2.2);
    if (r.timer > 0) {
      r.timer -= dt;
      stop(r, dt);
    } else {
      const amount = (dt * r.speed * 0.65) / Math.max(0.005, distance);
      r.doorProgress = Math.max(
        0,
        Math.min(1, r.doorProgress + (r.mode === ENTER ? amount : -amount)),
      );
      r.x = r.doorX + (d.x - r.doorX) * r.doorProgress;
      r.y = r.doorY + (d.y - r.doorY) * r.doorProgress;
      r.z = r.doorZ + (d.z - r.doorZ) * r.doorProgress;
      r.motion = Math.min(0.65, r.motion + dt * 3);
      r.phase = (r.phase + (dt * r.speed * 0.65) / r.stride) % 1;
      r.travel += dt * r.speed * 0.65;
      if (r.mode === ENTER && r.doorProgress >= 1) {
        // Do not dissolve along a street: the facade is the only vanish point.
        r.visible = false;
        r.mode = INSIDE;
        r.timer = 10 + residentSeed(++r.visit * 101 + r.seed * 1e7) * 22;
        r.motion = 0;
      } else if (r.mode === EXIT && r.doorProgress <= 0) {
        r.door = -1;
        r.cooldown = 25 + r.seed * 55;
        r.mode = TURN;
        r.timer = 0.9;
        locate(r);
      }
    }
    return;
  }

  if (r.mode === PAUSE || r.mode === TURN) {
    stop(r, dt);
    r.timer -= dt;
    r.heading = turnHeading(r.heading, r.targetHeading, dt * 2.4);
    if (r.timer <= 0 && Math.abs(Math.sin(r.heading - r.targetHeading)) < 0.08)
      finishTurn(r);
    return;
  }

  const limit = crossingLimit(r, clearances);
  const distanceToLimit = Math.min(
    (limit - r.distance) * r.direction,
    pavementGap,
  );
  if (distanceToLimit <= 0.0002) {
    r.mode = KERB;
    stop(r, dt);
    return;
  }
  r.mode = WALK;
  const before = r.distance;
  const endDistance = r.direction > 0 ? r.route.length - before : before;
  const ease = r.route.loop
    ? 1
    : Math.min(1, Math.max(0.16, endDistance / 0.025));
  const safeSpeed = Math.min(r.speed * ease, Math.max(0, distanceToLimit / dt));
  r.velocity = Math.min(safeSpeed, r.velocity + dt * 0.12);
  r.distance += r.direction * r.velocity * dt;
  const moved = Math.abs(r.distance - before);
  r.travel += moved;
  r.phase = (r.phase + moved / r.stride) % 1;
  r.motion += (r.velocity / r.speed - r.motion) * Math.min(1, dt * 6);

  if (r.distance >= r.route.length || r.distance <= 0) {
    if (r.route.loop) {
      r.distance = (r.distance + r.route.length) % r.route.length;
      r.crossing = -1;
    } else {
      r.distance = Math.min(r.route.length, Math.max(0, r.distance));
      r.direction *= -1;
      r.mode = TURN;
      r.timer = 1.45;
      stop(r, dt);
    }
  }
  locate(r);
  r.heading = turnHeading(r.heading, r.targetHeading, dt * 2.6);
  visitDoor(r, before);

  // An occasional pause belongs on a pavement, never on a crossing.
  if (
    r.mode === WALK &&
    r.crossing < 0 &&
    r.route.spans[r.span].crossing < 0 &&
    r.cooldown < -28
  ) {
    r.mode = PAUSE;
    r.timer = 1.5 + r.seed * 3;
    r.cooldown = 20 + r.seed * 40;
  }
}
