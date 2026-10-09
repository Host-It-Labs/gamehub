import { DX, DY, RAIL, ROAD, type Route } from './pieces.ts';
import type { Net } from './routes.ts';
import {
  CARRIAGE_FLOOR,
  CARRIAGE_HALF,
  GRAND_HALL_HALF,
  GRAND_HALF,
  HALL_HALF,
  PAVEMENT_TOP,
  PLATFORM_EDGE,
  ROAD_TOP,
  STATION_LEVEL,
  STATION_STEPS,
} from './scale.ts';
import type { Mover, Spec, TrafficSim } from './traffic-sim.ts';
import { residentSeed, turnHeading } from './people.ts';

/**
 * The people who use Rota's stations (8 October 2026), as pure motion: a
 * car pulls up short of the station steps and its passengers duck out of
 * the kerb-side doors, step up onto the pavement, climb the steps and go
 * in at the booking-hall door; a railcar runs in beside the platforms and
 * its passengers step down from its doors and walk along the platform
 * into the station. Others come out of the station to wait on the
 * platform or at the kerb and get in when their train or car comes. The
 * traffic stands as long as its passengers need (`arrive`).
 *
 * Everything is in board units (a square is 25 m), x east, z south, y up;
 * a person is about 0.07 tall and walks about a metre a second. The 3D
 * board draws each walker with the residents' figures
 * (components/game/rota/three/passengers.ts).
 */

/** One street or track arriving at a station's bank. */
export type Stub = {
  /** The stub's edge id in the network. */
  id: string;
  cell: number;
  kind: Route;
  /** The station's centre. */
  x: number;
  z: number;
  /** Half its bank, and half its booking hall (doors in each wall). */
  half: number;
  hall: number;
  /** Outward from the centre along the stub ... */
  ux: number;
  uz: number;
  /** ... and across it: the kerb side for a car coming in (the right). */
  vx: number;
  vz: number;
};

type Leg =
  /** Walk to a point, on the ground there or at a fixed height. */
  | { k: 'walk'; x: number; z: number; y?: number }
  /** One step up or down between levels, with a little lift. */
  | { k: 'step'; x: number; z: number; y: number; time: number }
  /** Duck out of (or into) a car's doorway while moving. */
  | { k: 'duck'; x: number; z: number; time: number; to: number }
  /** Stand (for a while, or until told to move on), facing `face`. */
  | { k: 'wait'; time?: number; face?: number }
  /** Through a door or into a vehicle: gone. */
  | { k: 'gone' };

export type Walker = {
  id: number;
  stub: Stub;
  x: number;
  y: number;
  z: number;
  heading: number;
  size: number;
  /** 0 coat and cap, 1 coat and headscarf, 2 child. */
  style: number;
  colour: number;
  /** 0 nothing, 1 a suitcase, 2 a parcel under the arm. */
  bag: number;
  /** Gait cycle (0–1), and how much it is walking (0 standing, 1 walking). */
  phase: number;
  motion: number;
  stride: number;
  /** 1 ducking through a car's doorway, 0 upright. */
  crouch: number;
  visible: boolean;
  speed: number;
  velocity: number;
  legs: Leg[];
  at: number;
  /** Seconds into the current leg, and where it started. */
  t: number;
  from: { x: number; y: number; z: number; crouch: number };
  /** Seconds before it appears (still inside a vehicle). */
  delay: number;
  /** Waiting for a train or a car at its stub. */
  waiting: boolean;
  /** Seconds it has been waiting, to give up on a quiet station. */
  patience: number;
  /** The vehicle it is getting into or out of, and which. */
  vehicle?: number;
  boarding?: boolean;
  done: boolean;
};

/** A vehicle's doors while it stands at a station: which open, when. */
export type DoorPlan = {
  start: number;
  /** `car` is the vehicle's own car (trains reverse their order on arrival). */
  doors: { car: Spec; name: string; open: number; close: number }[];
};

export const PASSENGERS_MAX = 40;
/** Real size: they get in and out of cars and carriages. */
const SIZE = 1;
const WALK = 0.036;
/** A car's kerb-side (right) doors, from the models: where each stands
 *  along the car from its middle (forward positive) and its leaf's name.
 *  The two-door saloon has one; a bus is boarded at its back platform. */
function kerbDoors(model: string, length: number) {
  if (model === 'bus') return [{ name: '', along: -length / 2 + 0.03 }];
  if (model === 'car_retro')
    return [{ name: 'door_rf', along: -0.01 * length }];
  if (model === 'car_sedan')
    return [
      { name: 'door_rr', along: -0.171 * length },
      { name: 'door_rf', along: 0.062 * length },
    ];
  return [
    { name: 'door_rr', along: -0.12 * length },
    { name: 'door_rf', along: 0.14 * length },
  ];
}

/** The railcar's doors: either side of its middle, on both sides. */
export const RAILCAR_DOORS = 0.1;
const RAILCAR_HALF = 0.0715;

/** The stubs of every station on a network. */
export function stationStubs(net: Net, half: (cell: number) => number) {
  const out: Stub[] = [];
  for (const e of net.edges) {
    if (!e.seg.station || e.seg.shape.type !== 'stub') continue;
    const cell = Number(e.id.split(':')[0]);
    const d = e.seg.shape.a;
    const h = half(cell);
    out.push({
      id: e.id,
      cell,
      kind: e.seg.kind,
      x: e.seg.at.x,
      z: e.seg.at.z,
      half: h,
      hall: h >= GRAND_HALF - 1e-6 ? GRAND_HALL_HALF : HALL_HALF,
      ux: DX[d],
      uz: DY[d],
      vx: DY[d],
      vz: -DX[d],
    });
  }
  return out;
}

/** A point given along and across a stub, on the board. */
function point(s: Stub, a: number, l: number) {
  return { x: s.x + s.ux * a + s.vx * l, z: s.z + s.uz * a + s.vz * l };
}
function local(s: Stub, x: number, z: number) {
  const dx = x - s.x,
    dz = z - s.z;
  return { a: dx * s.ux + dz * s.uz, l: dx * s.vx + dz * s.vz };
}

/** The height of the ground a walker stands on near its stub: the street
 *  and its kerbs, the flight of steps, the bank and the platforms. */
export function groundAt(s: Stub, x: number, z: number) {
  const { a, l } = local(s, x, z);
  if (a <= s.half + 1e-6) return STATION_LEVEL;
  if (s.kind === RAIL)
    return Math.abs(l) >= PLATFORM_EDGE - 0.004 ? STATION_LEVEL : ROAD_TOP;
  const steps = STATION_STEPS;
  if (a < s.half + steps) {
    // Seven risers from the road up to the bank.
    const k = Math.floor(((a - s.half) / steps) * 7);
    return STATION_LEVEL - (k * (STATION_LEVEL - ROAD_TOP)) / 7;
  }
  return Math.abs(l) >= CARRIAGE_HALF ? PAVEMENT_TOP : ROAD_TOP;
}

const smooth = (u: number) => u * u * (3 - 2 * u);

export class Passengers {
  walkers: Walker[] = [];
  stubs = new Map<string, Stub>();
  /** Door plans by vehicle id. */
  doors = new Map<number, DoorPlan>();
  clock = 0;
  /** No one appears while the traffic is being run ahead unseen. */
  live = false;
  private nextId = 1;
  private spawnIn = new Map<string, number>();
  private seed = 1;

  private sim: TrafficSim;
  private opts: { still?: boolean; max?: number };

  constructor(sim: TrafficSim, opts: { still?: boolean; max?: number } = {}) {
    this.sim = sim;
    this.opts = opts;
  }

  private rand() {
    return residentSeed(this.seed++ * 7919 + 17);
  }
  private between(a: number, b: number) {
    return a + this.rand() * (b - a);
  }

  setNetwork(net: Net, half: (cell: number) => number) {
    const stubs = stationStubs(net, half);
    this.stubs = new Map(stubs.map((s) => [s.id, s]));
    // People at a station that has gone simply go; the rest belong to the
    // same station on the new board (calls match stubs by identity).
    this.walkers = this.walkers.filter((w) => this.stubs.has(w.stub.id));
    for (const w of this.walkers) w.stub = this.stubs.get(w.stub.id)!;
  }

  get max() {
    return this.opts.max ?? PASSENGERS_MAX;
  }

  // ------------------------------------------------------------ walkers

  private walker(stub: Stub, x: number, z: number, y: number): Walker {
    const id = this.nextId++;
    const child = this.rand() < 0.1;
    const size = (child ? 0.72 : this.between(0.95, 1.05)) * SIZE;
    return {
      id,
      stub,
      x,
      y,
      z,
      heading: 0,
      size,
      style: child ? 2 : this.rand() < 0.45 ? 1 : 0,
      colour: Math.floor(this.rand() * 7),
      bag: child ? 0 : this.rand() < 0.3 ? 1 : this.rand() < 0.15 ? 2 : 0,
      phase: this.rand(),
      motion: 0,
      stride: (child ? 0.03 : 0.044) * size,
      crouch: 0,
      visible: true,
      speed: WALK * (child ? 0.9 : this.between(0.9, 1.15)),
      velocity: 0,
      legs: [],
      at: 0,
      t: 0,
      from: { x, y, z, crouch: 0 },
      delay: 0,
      waiting: false,
      patience: 0,
      done: false,
    };
  }

  private add(w: Walker) {
    if (this.walkers.length >= this.max) return false;
    this.walkers.push(w);
    return true;
  }

  /** The legs from a point on a stub's bank into its booking hall. */
  private intoHall(s: Stub, jitter: number): Leg[] {
    const front = point(s, s.hall + 0.018, jitter);
    const inside = point(s, s.hall - 0.03, jitter * 0.6);
    return [{ k: 'walk', ...front }, { k: 'walk', ...inside }, { k: 'gone' }];
  }

  /** Out of the booking hall onto the bank by this stub. */
  private outOfHall(s: Stub, jitter: number) {
    const inside = point(s, s.hall - 0.03, jitter * 0.6);
    const front = point(s, s.hall + 0.02, jitter);
    return { start: inside, legs: [{ k: 'walk', ...front }] as Leg[] };
  }

  // ------------------------------------------------------------ calls

  /** The sim's hook: a vehicle has stopped at a station. Plans who gets off
   *  and on and returns how long it stands, or undefined for the usual. */
  arrive(m: Mover): number | undefined {
    if (!this.live || this.opts.still) return undefined;
    const stub = this.stubOf(m);
    if (!stub) return undefined;
    if (stub.kind === ROAD) {
      const model = m.cars[0].model;
      if (model.startsWith('car')) return this.carCall(m, stub, 0.42, 2);
      if (model === 'bus') return this.carCall(m, stub, 0.62, 4);
      return undefined;
    }
    if (m.cars.some((c) => c.model.startsWith('dmu')))
      return this.trainCall(m, stub);
    return undefined;
  }

  private stubOf(m: Mover) {
    for (let i = m.steps.length - 1; i >= 0; i--) {
      const e = m.steps[i].edge;
      if (e.seg.station) return this.stubs.get(e.id);
    }
    return undefined;
  }

  /** Where a stopped vehicle's car stands: its middle and axis. */
  private frame(m: Mover, car: number) {
    const p = this.sim.poses(m)[car];
    const x = (p.front.x + p.back.x) / 2,
      z = (p.front.z + p.back.z) / 2;
    let fx = p.front.x - p.back.x,
      fz = p.front.z - p.back.z;
    const l = Math.hypot(fx, fz) || 1;
    fx /= l;
    fz /= l;
    if (m.cars[car].flip) {
      fx = -fx;
      fz = -fz;
    }
    return { x, z, fx, fz, rx: -fz, rz: fx };
  }

  /** A car (or a bus, at its back platform) at the kerb before the steps. */
  private carCall(m: Mover, s: Stub, room: number, most: number) {
    const f = this.frame(m, 0);
    const spec = m.cars[0];
    const bus = spec.model === 'bus';
    const kerb = kerbDoors(spec.model, spec.length);
    const doorsAt = kerb.map((d) => d.along);
    const r = this.rand();
    const off =
      r < 0.14
        ? 0
        : r < 0.7
          ? 1
          : Math.min(most, 2 + Math.floor(this.rand() * (most - 1)));
    const plan: DoorPlan = { start: this.clock, doors: [] };
    let end = 0.8;
    const open = 0.3;
    const used = new Set<number>();
    let alighted = 0;
    for (let i = 0; i < off; i++) {
      const d = bus ? 0 : i % doorsAt.length;
      const along = doorsAt[d];
      const dx = f.x + f.fx * along,
        dz = f.z + f.fz * along;
      const jitter = this.between(-0.012, 0.012);
      const w = this.walker(s, dx - f.rx * 0.016, dz - f.rz * 0.016, ROAD_TOP);
      w.delay =
        open +
        0.25 +
        Math.floor(i / doorsAt.length) * 1.2 +
        (bus ? i * 0.9 : 0);
      w.crouch = bus ? 0 : 1;
      w.from.crouch = w.crouch;
      w.heading = Math.atan2(f.rx, f.rz);
      const out = { x: dx + f.rx * 0.03, z: dz + f.rz * 0.03 };
      const here = local(s, out.x, out.z);
      const kerb = point(s, here.a, CARRIAGE_HALF - 0.008);
      const up = point(s, here.a, CARRIAGE_HALF + 0.016);
      const foot = point(s, s.half + STATION_STEPS + 0.006, 0.17 + jitter);
      const top = point(s, s.half - 0.006, 0.12 + jitter);
      w.vehicle = m.id;
      w.legs = [
        bus
          ? { k: 'step', x: out.x, z: out.z, y: ROAD_TOP, time: 0.5 }
          : { k: 'duck', x: out.x, z: out.z, time: 0.85, to: 0 },
        { k: 'walk', ...kerb },
        { k: 'step', ...up, y: PAVEMENT_TOP, time: 0.4 },
        { k: 'walk', ...foot },
        { k: 'walk', ...top },
        ...this.intoHall(s, jitter * 3),
      ];
      // A door opens only for someone actually getting out.
      if (!this.add(w)) break;
      used.add(d);
      alighted++;
      end = Math.max(end, w.delay + 1.5);
    }
    // Whoever waits at this kerb gets in.
    const waiting = this.walkers.filter(
      (w) => w.waiting && w.stub === s && !w.done,
    );
    let boarded = 0;
    for (const w of waiting) {
      if (boarded >= (bus ? 3 : alighted < 2 ? 1 : 0)) break;
      const d = bus ? 0 : (boarded + 1) % doorsAt.length;
      used.add(d);
      const along = doorsAt[d];
      const dx = f.x + f.fx * along,
        dz = f.z + f.fz * along;
      const here = local(s, dx + f.rx * 0.03, dz + f.rz * 0.03);
      const kerbTop = point(s, here.a, CARRIAGE_HALF + 0.016);
      const kerb = point(s, here.a, CARRIAGE_HALF - 0.008);
      const door = { x: dx + f.rx * 0.03, z: dz + f.rz * 0.03 };
      const inside = { x: dx - f.rx * 0.016, z: dz - f.rz * 0.016 };
      w.waiting = false;
      w.vehicle = m.id;
      w.boarding = true;
      w.legs = [
        { k: 'walk', ...kerbTop },
        { k: 'step', ...kerb, y: ROAD_TOP, time: 0.4 },
        { k: 'walk', ...door },
        bus
          ? { k: 'step', ...inside, y: ROAD_TOP, time: 0.5 }
          : { k: 'duck', ...inside, time: 0.85, to: 1 },
        { k: 'gone' },
      ];
      w.at = 0;
      w.t = 0;
      w.delay = Math.max(0, end - 1.2) + boarded * 1.1;
      const walk = Math.hypot(kerbTop.x - w.x, kerbTop.z - w.z) + 0.06;
      end = Math.max(end, w.delay + walk / w.speed + 1.6);
      boarded++;
    }
    if (!alighted && !boarded) return undefined;
    const close = end + 0.2;
    for (const d of used)
      plan.doors.push({
        car: m.cars[0],
        name: kerb[d].name,
        open,
        close,
      });
    if (plan.doors.length) this.doors.set(m.id, plan);
    return Math.max(room * 4, close + 0.5);
  }

  /** A railcar at the platforms: its leading car's doors open on both
   *  sides; people step down and walk in, those waiting step up. */
  private trainCall(m: Mover, s: Stub) {
    const car = m.cars.findIndex((c) => c.model.startsWith('dmu'));
    if (car !== 0) return undefined;
    const f = this.frame(m, 0);
    const plan: DoorPlan = { start: this.clock, doors: [] };
    const open = 0.6;
    let end = 2;
    // The doors that stand beside a platform.
    const doors: { a: number; side: 1 | -1; name: string; free: number }[] = [];
    for (const k of [1, -1] as const) {
      const x = f.x + f.fx * k * RAILCAR_DOORS,
        z = f.z + f.fz * k * RAILCAR_DOORS;
      const { a } = local(s, x, z);
      if (a < s.half + 0.016 || a > 0.49) continue;
      for (const side of [1, -1] as const) {
        // Which of the model's doors this is: its own right, its own front.
        const px = s.vx * side,
          pz = s.vz * side;
        const right = px * f.rx + pz * f.rz > 0;
        doors.push({
          a,
          side,
          name: `door_${right ? 'r' : 'l'}${k > 0 ? 0 : 1}`,
          free: open + 0.35,
        });
      }
    }
    if (!doors.length) return undefined;
    const off = Math.min(
      doors.length * 2,
      1 + Math.floor(this.rand() * 4) + (this.rand() < 0.3 ? 2 : 0),
    );
    const used = new Set<(typeof doors)[number]>();
    for (let i = 0; i < off; i++) {
      const d = doors[Math.floor(this.rand() * doors.length)];
      const l = d.side;
      const inside = point(s, d.a, l * (RAILCAR_HALF - 0.026));
      const sill = point(s, d.a, l * (RAILCAR_HALF - 0.004));
      const down = point(s, d.a, l * (PLATFORM_EDGE + 0.016));
      const jitter = this.between(-0.02, 0.02);
      const off1 = point(s, d.a + jitter * 0.5, l * (0.128 + jitter * 0.4));
      const end1 = point(s, s.half + 0.012, l * (0.11 + jitter));
      const w = this.walker(s, inside.x, inside.z, CARRIAGE_FLOOR);
      w.delay = d.free;
      d.free += 1.05;
      w.heading = Math.atan2(down.x - inside.x, down.z - inside.z);
      w.vehicle = m.id;
      w.legs = [
        { k: 'walk', ...sill, y: CARRIAGE_FLOOR },
        { k: 'step', ...down, y: STATION_LEVEL, time: 0.5 },
        { k: 'walk', ...off1 },
        { k: 'walk', ...end1 },
        ...this.intoHall(s, l * this.between(0.004, 0.016)),
      ];
      if (!this.add(w)) {
        d.free -= 1.05;
        break;
      }
      used.add(d);
      end = Math.max(end, w.delay + 1.6);
    }
    // Everyone waiting on these platforms gets on at the nearest door.
    for (const w of this.walkers) {
      if (!w.waiting || w.stub !== s || w.done) continue;
      const { a, l } = local(s, w.x, w.z);
      const mine = doors.filter((d) => Math.sign(l) === d.side);
      if (!mine.length) continue;
      const d = mine.reduce((p, q) =>
        Math.abs(q.a - a) < Math.abs(p.a - a) ? q : p,
      );
      used.add(d);
      const side = d.side;
      const by = point(s, d.a, side * (PLATFORM_EDGE + 0.018));
      const sill = point(s, d.a, side * (RAILCAR_HALF - 0.004));
      const inside = point(s, d.a, side * (RAILCAR_HALF - 0.03));
      w.waiting = false;
      w.vehicle = m.id;
      w.boarding = true;
      w.at = 0;
      w.t = 0;
      w.delay = Math.max(0, d.free - 0.8);
      d.free += 1;
      w.legs = [
        { k: 'walk', ...by },
        { k: 'step', ...sill, y: CARRIAGE_FLOOR, time: 0.5 },
        { k: 'walk', ...inside, y: CARRIAGE_FLOOR },
        { k: 'gone' },
      ];
      const walk = Math.hypot(by.x - w.x, by.z - w.z);
      end = Math.max(end, w.delay + walk / w.speed + 1.4);
    }
    const close = end + 0.3;
    for (const d of used)
      plan.doors.push({ car: m.cars[0], name: d.name, open, close });
    this.doors.set(m.id, plan);
    return close + 0.9;
  }

  /** How far open each of a vehicle's doors is now (0 shut, 1 open). */
  doorsOf(id: number): { car: Spec; name: string; open: number }[] | null {
    const plan = this.doors.get(id);
    if (!plan) return null;
    const t = this.clock - plan.start;
    return plan.doors.map((d) => ({
      car: d.car,
      name: d.name,
      open: smooth(
        Math.max(
          0,
          Math.min(1, Math.min((t - d.open) / 0.35, (d.close - t) / 0.35)),
        ),
      ),
    }));
  }

  // ------------------------------------------------------------ waiting

  /** People come out to wait on a station's platforms and at its kerb
   *  while trains and cars call there. */
  private spawnWaiting(dt: number) {
    const waiting = this.walkers.filter(
      (w) => w.waiting || w.legs.some((l) => l.k === 'wait'),
    ).length;
    for (const s of this.stubs.values()) {
      // Never more than half the station crowd waiting, so arrivals always
      // have room; and only where trains with passengers, or cars, run.
      if (waiting >= this.max / 2) break;
      const left = (this.spawnIn.get(s.id) ?? this.between(2, 8)) - dt;
      if (left > 0) {
        this.spawnIn.set(s.id, left);
        continue;
      }
      const rail = s.kind === RAIL;
      this.spawnIn.set(s.id, rail ? this.between(5, 11) : this.between(14, 28));
      const runs = rail
        ? this.sim.runsAt(s.id, (m) =>
            m.cars.some((c) => c.model.startsWith('dmu')),
          )
        : this.sim.runsAt(s.id, (m) => m.cars[0].model.startsWith('car'));
      if (!runs) continue;
      const here = this.walkers.filter((w) => w.stub === s && w.waiting);
      if (here.length >= (rail ? 4 : 1)) continue;
      const jitter = this.between(-0.012, 0.012);
      const { start, legs } = this.outOfHall(s, jitter);
      const w = this.walker(s, start.x, start.z, STATION_LEVEL);
      let spot: { x: number; z: number } | null = null;
      for (let tries = 0; tries < 6 && !spot; tries++) {
        const p = rail
          ? point(
              s,
              this.between(s.half + 0.05, 0.45),
              (this.rand() < 0.5 ? 1 : -1) * this.between(0.128, 0.165),
            )
          : point(s, this.between(0.52, 0.6), this.between(0.168, 0.182));
        if (here.every((o) => Math.hypot(o.x - p.x, o.z - p.z) > 0.035))
          spot = p;
      }
      if (!spot) continue;
      const sp = local(s, spot.x, spot.z);
      // Facing the track, or the street.
      const face = Math.atan2(-s.vx * Math.sign(sp.l), -s.vz * Math.sign(sp.l));
      w.legs = rail
        ? [
            ...legs,
            { k: 'walk', ...point(s, s.half + 0.012, Math.sign(sp.l) * 0.12) },
            { k: 'walk', ...spot },
            { k: 'wait', face },
          ]
        : [
            ...legs,
            { k: 'walk', ...point(s, s.half - 0.006, 0.13 + jitter) },
            { k: 'walk', ...point(s, s.half + STATION_STEPS + 0.006, 0.172) },
            { k: 'walk', ...spot },
            { k: 'wait', face },
          ];
      w.heading = Math.atan2(s.ux, s.uz);
      w.from = { x: w.x, y: w.y, z: w.z, crouch: 0 };
      this.add(w);
    }
  }

  // ------------------------------------------------------------ the clock

  tick(dt: number) {
    if (this.opts.still) return;
    this.live = true;
    this.clock += dt;
    this.spawnWaiting(dt);
    for (const w of this.walkers) this.step(w, dt);
    this.walkers = this.walkers.filter((w) => !w.done);
    for (const [id, plan] of this.doors) {
      const last = Math.max(...plan.doors.map((d) => d.close), 0);
      if (this.clock - plan.start > last + 1) this.doors.delete(id);
    }
  }

  private step(w: Walker, dt: number) {
    if (w.delay > 0) {
      w.delay -= dt;
      // Still inside the car until its turn: unseen.
      w.visible = w.y >= CARRIAGE_FLOOR - 1e-6 || w.crouch < 0.5;
      if (w.crouch >= 0.5 && w.legs[0]?.k === 'duck') w.visible = false;
      return;
    }
    w.visible = true;
    const leg = w.legs[w.at];
    if (!leg || leg.k === 'gone') {
      w.done = true;
      return;
    }
    if (leg.k === 'wait') {
      w.waiting = true;
      w.patience += dt;
      w.velocity = 0;
      w.motion = Math.max(0, w.motion - dt * 3);
      if (leg.face !== undefined) {
        // A glance along the platform now and then.
        const glance = Math.sin(this.clock * 0.4 + w.id * 1.7) > 0.93 ? 0.6 : 0;
        w.heading = turnHeading(w.heading, leg.face + glance, dt * 2.5);
      }
      // Nobody came: back inside.
      if (w.patience > 45) {
        w.waiting = false;
        w.legs = this.homeward(w);
        w.at = 0;
        w.t = 0;
      }
      return;
    }
    w.waiting = false;
    w.t += dt;
    if (leg.k === 'step' || leg.k === 'duck') {
      const u = Math.min(1, w.t / leg.time),
        e = smooth(u);
      w.x = w.from.x + (leg.x - w.from.x) * e;
      w.z = w.from.z + (leg.z - w.from.z) * e;
      if (leg.k === 'step') {
        w.y = w.from.y + (leg.y - w.from.y) * e + Math.sin(Math.PI * u) * 0.004;
        w.motion = 1;
        w.phase = (w.phase + (dt / leg.time) * 0.5) % 1;
      } else {
        w.crouch = w.from.crouch + (leg.to - w.from.crouch) * e;
        w.motion = 0.6;
        w.phase = (w.phase + (dt / leg.time) * 0.5) % 1;
        w.y = ROAD_TOP;
      }
      const dx = leg.x - w.from.x,
        dz = leg.z - w.from.z;
      if (Math.hypot(dx, dz) > 0.004)
        w.heading = turnHeading(w.heading, Math.atan2(dx, dz), dt * 5);
      if (u >= 1) this.next(w);
      return;
    }
    // Walking: turn towards the next point (on the spot if it is behind),
    // ease in and out, and plant the feet on the ground there.
    const dx = leg.x - w.x,
      dz = leg.z - w.z;
    const d = Math.hypot(dx, dz);
    const want = Math.atan2(dx, dz);
    const off = Math.abs(
      Math.atan2(Math.sin(want - w.heading), Math.cos(want - w.heading)),
    );
    w.heading = turnHeading(w.heading, want, dt * 4.5);
    const last = w.legs[w.at + 1]?.k !== 'walk';
    const target =
      off > 1.6 ? 0 : last ? Math.min(w.speed, d * 2.4 + 0.008) : w.speed;
    w.velocity += Math.max(
      -0.12 * dt,
      Math.min(0.09 * dt, target - w.velocity),
    );
    const move = Math.min(d, Math.max(0, w.velocity) * dt);
    if (d > 1e-6) {
      w.x += (dx / d) * move;
      w.z += (dz / d) * move;
    }
    w.phase = (w.phase + move / w.stride) % 1;
    w.motion = Math.min(
      1,
      Math.max(off > 1.6 ? 0.3 : 0, w.velocity / (WALK * 0.6)),
    );
    const ground = leg.y ?? groundAt(w.stub, w.x, w.z);
    w.y += (ground - w.y) * Math.min(1, dt * 16);
    if (d < 0.0025) this.next(w);
  }

  private next(w: Walker) {
    w.at++;
    w.t = 0;
    w.from = { x: w.x, y: w.y, z: w.z, crouch: w.crouch };
  }

  /** From where a walker waits, back into the booking hall. */
  private homeward(w: Walker): Leg[] {
    const s = w.stub;
    const { l } = local(s, w.x, w.z);
    if (s.kind === RAIL)
      return [
        { k: 'walk', ...point(s, s.half + 0.012, Math.sign(l) * 0.12) },
        ...this.intoHall(s, Math.sign(l) * 0.01),
      ];
    return [
      { k: 'walk', ...point(s, s.half + STATION_STEPS + 0.006, 0.172) },
      { k: 'walk', ...point(s, s.half - 0.006, 0.13) },
      ...this.intoHall(s, 0.01),
    ];
  }

  clear() {
    this.walkers = [];
    this.doors.clear();
  }
}
