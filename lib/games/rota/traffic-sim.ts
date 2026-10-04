import { RAIL, ROAD, type Route } from './pieces.ts';
import { across, liftAt, pointAt, type Edge, type Net } from './routes.ts';
import { CARRIAGE_HALF, LANE, ROAD_TOP } from './scale.ts';

/**
 * The mill town's traffic as pure motion, without any drawing: lorries,
 * vans and cars on the streets, shunting engines and goods trains on the
 * works railway. The 3D board seats a model on each pose; the tests run the
 * same code for minutes of play and check that nothing overlaps, sinks or
 * vanishes in view.
 *
 * - Everything rides on the routes' own height profile (`liftAt`), front
 *   and back axles separately, so a vehicle tilts up and over a bridge.
 * - Trains hold the squares they stand on and the next one before they
 *   enter it, so two trains never meet; a train kept waiting backs off
 *   and takes another way, as shunting does. Street crossings are held the
 *   same way by one vehicle at a time; behind one another, vehicles keep
 *   their distance by looking along their way.
 * - Goods stations are destinations: a lorry pulls up at the shed door, a
 *   train at its platform; they wait while the load goes across and leave
 *   the way they came. A street that stops short is turned in, a siding's
 *   buffers met gently and backed off from.
 * - Vehicles arrive and leave only out of sight: trains inside their
 *   tunnels, street traffic past the edge of the picture.
 */

export type Spec = {
  model: string;
  /** Along the way, and across it. */
  length: number;
  width: number;
};
export type P3 = { x: number; y: number; z: number };
/** The vehicle's physical front and back axles, also when a train backs up. */
export type CarPose = { front: P3; back: P3 };

type Step = { edge: Edge; dir: 1 | -1 };

/** A car's three steering arcs, with a stop between each change of gear. */
type Turn = {
  keys: { x: number; z: number; yaw: number; reverse: boolean }[];
  radii: number[];
  y: number;
  t: number;
};

export type Mover = {
  id: number;
  kind: Route;
  cars: Spec[];
  steps: Step[];
  /** Distance at the start of steps[0]. */
  offset: number;
  /** Distance of the front of the first car. */
  head: number;
  speed: number;
  max: number;
  /** Seconds left of a stop. */
  wait: number;
  /** Seconds spent held up by something ahead. */
  held: number;
  /** The vehicle ahead, or the current owner of the crossing being awaited. */
  waitingFor?: number;
  turn?: Turn;
  /** A street vehicle waiting for room to turn round. */
  pending?: boolean;
  /** The patch of street a turning vehicle keeps clear. */
  zone?: { x: number; z: number; r: number };
  /** Seconds since a train met its buffers, for the bump. */
  bump?: number;
  age: number;
  /** Fading out (its route was taken up): seconds left. */
  dying?: number;
  dead: boolean;
  /** The station or dead end it has just served, so it turns back once. */
  served?: string;
  /** Squares this vehicle holds. */
  blocks: Set<string>;
  /** Never leaves (it lives on a network with no way out). */
  resident: boolean;
  /** A train running with its engine at the back. */
  pushed: boolean;
};

export type SimOptions = {
  /** Is a board point outside the picture? Traffic only comes and goes there. */
  offscreen: (x: number, z: number) => boolean;
  /** The cars of a new vehicle, front first. */
  make: (kind: Route, rand: () => number, long: boolean) => Spec[] | null;
  rand?: () => number;
};

const COUPLING = 0.018;
const BRAKE = 0.45;
const ACCEL = 0.42;
/** Stop this far short of a buffer stop or a barrier at the square's edge. */
const LOOSE_SHORT = 0.1;
/** How far short of a shed's wall the front of a vehicle stops. */
const DOOR_GAP = 0.018;
const PHASE = 0.85;
/** Clearance kept to the vehicle ahead. */
const GAP = 0.05;
const LOOK = 0.5;
/** A tight three-point turn: most of the turn is driven forwards. */
const TURN_ANGLE = Math.PI / 3;
const TURN_MARGIN = 0.002;

/** A bumper-to-bumper consist has no coupling behind its last car. */
const consistLength = (cars: Spec[]) =>
  cars.reduce((s, c) => s + c.length, 0) + COUPLING * (cars.length - 1);

type TurnRoom = { min: number; max: number; fits: boolean };
const turnRooms = new Map<string, TurnRoom>();

/** Exact circular steering arcs: the body always faces along its movement. */
function turnPath(x: number, z: number, yaw: number, c: Spec): Turn {
  const back = Math.max(LANE, c.length / 2);
  const forward =
    (LANE + back * Math.cos(TURN_ANGLE)) / (1 - Math.cos(TURN_ANGLE));
  const radii = [forward, back, forward];
  const keys = [{ x, z, yaw, reverse: false }];
  for (const [i, angle] of [
    TURN_ANGLE,
    Math.PI - TURN_ANGLE * 2,
    TURN_ANGLE,
  ].entries()) {
    const a = keys[i];
    const b = a.yaw + angle;
    const reverse = i === 1;
    const r = radii[i] * (reverse ? -1 : 1);
    keys.push({
      x: a.x + r * (Math.cos(b) - Math.cos(a.yaw)),
      z: a.z + r * (Math.sin(a.yaw) - Math.sin(b)),
      yaw: b,
      reverse,
    });
  }
  return { keys, radii, y: 0, t: 0 };
}

/** The whole body, including its corners, must fit between the kerbs. */
function turnRoom(c: Spec): TurnRoom {
  const key = `${c.length}:${c.width}`;
  const hit = turnRooms.get(key);
  if (hit) return hit;
  const turn = turnPath(0, 0, Math.PI, c);
  let min = Infinity,
    max = -Infinity,
    fits = true;
  for (let i = 0; i <= 120; i++) {
    turn.t = i / 120;
    const p = turning(turn);
    for (const along of [-c.length / 2, c.length / 2])
      for (const side of [-c.width / 2, c.width / 2]) {
        const f = p.z - Math.cos(p.yaw) * along + Math.sin(p.yaw) * side;
        const l = p.x - Math.sin(p.yaw) * along - Math.cos(p.yaw) * side;
        min = Math.min(min, f);
        max = Math.max(max, f);
        if (Math.abs(l - LANE) > CARRIAGE_HALF - TURN_MARGIN) fits = false;
      }
  }
  const room = { min, max, fits };
  turnRooms.set(key, room);
  return room;
}

const straightStreet = (e: Edge) =>
  e.seg.lift === 'flat' && e.seg.shape.type !== 'bend';

const blockOf = (e: Edge) => (e.exit ? `x${e.exit.index}` : e.id.split(':')[0]);
const cellOf = (e: Edge) => (e.exit ? -1 : Number(e.id.split(':')[0]));

export class TrafficSim {
  movers: Mover[] = [];
  net: Net | null = null;
  private rand: () => number;
  private spawnIn = 0.4;
  private nextId = 1;
  /** Squares held, by kind and square, to the mover holding them. */
  private holds = new Map<string, number>();
  /** Station centres: destinations, never a way through. */
  private stations = new Map<string, number>();
  /** Road squares where three or more ways meet. */
  private crossings = new Set<number>();
  private comps: Comp[] = [];
  private compOf = new Map<string, Comp>();
  private bodies = new Map<number, { a: P3; b: P3; r: number }[]>();

  private opts: SimOptions;

  constructor(opts: SimOptions) {
    this.opts = opts;
    this.rand = opts.rand ?? Math.random;
  }

  private pick<T>(list: T[]) {
    return list[Math.floor(this.rand() * list.length)];
  }
  private between(a: number, b: number) {
    return a + this.rand() * (b - a);
  }

  // ------------------------------------------------------------ network

  /** A new network: vehicles on removed routes fade, the rest drive on. */
  setNetwork(net: Net, stationHalf: (cell: number) => number) {
    this.net = net;
    this.stations = new Map();
    for (const e of net.edges)
      if (e.seg.station) {
        const centre = e.a.startsWith('c:') ? e.a : e.b;
        this.stations.set(centre, stationHalf(cellOf(e)));
      }
    this.crossings = new Set();
    const roadSides = new Map<number, Set<string>>();
    for (const e of net.edges) {
      if (e.exit || e.seg.kind !== ROAD) continue;
      const c = cellOf(e);
      const set = roadSides.get(c) ?? new Set<string>();
      set.add(e.a).add(e.b);
      roadSides.set(c, set);
    }
    for (const [c, set] of roadSides) if (set.size >= 3) this.crossings.add(c);
    const byId = new Map(net.edges.map((e) => [e.id, e]));
    for (const m of this.movers) {
      if (m.steps.some((s) => !byId.has(s.edge.id))) this.fade(m);
      else
        m.steps = m.steps.map((s) => ({
          edge: byId.get(s.edge.id)!,
          dir: s.dir,
        }));
    }
    this.components(net);
    for (const m of this.movers)
      if (m.resident && !m.dying) {
        const comp = this.compOf.get(m.steps[0].edge.id);
        if (comp?.gates.length) m.resident = false;
      }
  }

  private components(net: Net) {
    const parent = new Map<string, string>();
    const find = (k: string): string => {
      let r = k;
      while (parent.get(r) !== r) r = parent.get(r)!;
      parent.set(k, r);
      return r;
    };
    for (const e of net.edges) parent.set(e.id, e.id);
    for (const e of net.edges)
      for (const node of [e.a, e.b])
        for (const next of this.ways(node, e, e.seg.kind))
          parent.set(find(next.id), find(e.id));
    const comps = new Map<string, Comp>();
    this.compOf = new Map();
    for (const e of net.edges) {
      const r = find(e.id);
      let c = comps.get(r);
      if (!c) {
        c = { kind: e.seg.kind, edges: [], length: 0, gates: [] };
        comps.set(r, c);
      }
      c.edges.push(e);
      if (!e.exit) c.length += e.length;
      this.compOf.set(e.id, c);
    }
    for (const g of net.gates) {
      const c = this.compOf.get(g.edge.id);
      if (c && !g.pier) c.gates.push(g.edge);
    }
    this.comps = [...comps.values()].filter((c) => c.length > 0);
  }

  /** How many of each kind the network carries. */
  private wanted(c: Comp) {
    if (c.kind === ROAD)
      return c.gates.length
        ? Math.max(1, Math.min(9, Math.round(c.length / 1.6)))
        : c.length >= 2
          ? 1
          : 0;
    if (c.kind === RAIL)
      return c.gates.length
        ? Math.min(c.gates.length, c.length >= 4 ? 2 : 1)
        : c.length >= 1.5
          ? 1
          : 0;
    return 0;
  }

  // ------------------------------------------------------------ spawning

  private spawn() {
    const want = this.comps
      .map((c) => ({
        c,
        short:
          this.wanted(c) -
          this.movers.filter(
            (m) =>
              !m.dead && !m.dying && this.compOf.get(m.steps[0].edge.id) === c,
          ).length,
      }))
      .filter((w) => w.short > 0);
    if (!want.length) return;
    // Trains first: a siding without its engine looks abandoned.
    const rail = want.filter((w) => w.c.kind === RAIL);
    const { c } = this.pick(rail.length ? rail : want);
    const long = c.length > 6;
    const made = this.opts.make(c.kind, this.rand, long);
    if (!made?.length) return;
    // The model factory may return shared specs; shortening a consist must
    // not take wagons out of any existing train.
    const cars = [...made];
    const total = consistLength(cars);
    if (c.gates.length) {
      // In from the far end of a way out, where nobody sees it arrive.
      const gate = this.pick(c.gates);
      const far = pointAt(gate.seg, 1);
      if (c.kind === ROAD && !this.opts.offscreen(far.x, far.z)) return;
      if (!this.blockFree(c.kind, gate)) return;
      const m = this.mover(c.kind, cars, [{ edge: gate, dir: -1 }], 0);
      if (m.kind === ROAD && !this.roadWay(m.steps[0], m.cars[0], 0)) return;
      if (total + 0.04 > gate.length) return;
      m.head = total + 0.02;
      if (this.overlapsAny(m, 0.25)) return;
      this.claim(m, gate);
      this.movers.push(m);
      return;
    }
    // A network with no way out keeps one resident: it appears where it
    // stands, once, and stays.
    const edges = c.edges.filter((e) => !e.seg.station && e.length >= 0.5);
    if (!edges.length) return;
    const e = this.pick(edges);
    if (c.kind === RAIL && this.holds.has(`${RAIL}:${blockOf(e)}`)) return;
    const m = this.mover(
      c.kind,
      cars,
      [{ edge: e, dir: this.rand() < 0.5 ? 1 : -1 }],
      0,
    );
    m.head = e.length * 0.5;
    m.resident = true;
    // Start with the whole body on real track. A short siding receives a
    // short consist, rather than clamping several wagons to its last point.
    while (!this.extendBack(m, this.length(m) + 0.05)) {
      if (m.kind !== RAIL || m.cars.length <= 1) return;
      m.cars.pop();
    }
    if (
      m.kind === ROAD &&
      !this.roadWay(m.steps[m.steps.length - 1], m.cars[0], 0)
    )
      return;
    for (const s of m.steps) if (!this.blockFree(m.kind, s.edge)) return;
    for (const s of m.steps) this.claim(m, s.edge);
    if (this.overlapsAny(m)) {
      this.release(m);
      return;
    }
    this.movers.push(m);
  }

  private mover(kind: Route, cars: Spec[], steps: Step[], head: number): Mover {
    const max =
      kind === ROAD ? this.between(0.26, 0.34) : this.between(0.15, 0.2);
    return {
      id: this.nextId++,
      kind,
      cars,
      steps,
      offset: 0,
      head,
      speed: kind === ROAD ? max * 0.8 : max * 0.5,
      max,
      wait: 0,
      held: 0,
      age: 0,
      dead: false,
      blocks: new Set(),
      resident: false,
      pushed: false,
    };
  }

  // ------------------------------------------------------------ holds

  private key(kind: Route, e: Edge) {
    return `${kind}:${blockOf(e)}`;
  }
  /** Does this way need holding before it is entered? */
  private exclusive(kind: Route, e: Edge) {
    if (kind === RAIL) return true;
    // Crossings and shed yards are one at a time. Keep their curved and
    // raised connectors clear too: a stopped vehicle there cannot turn
    // safely, and its tail could prevent the opposite queue from leaving.
    return (
      !e.exit &&
      (this.crossings.has(cellOf(e)) || e.seg.station || !straightStreet(e))
    );
  }
  private blockFree(kind: Route, e: Edge, by?: Mover) {
    if (!this.exclusive(kind, e)) return true;
    const h = this.holds.get(this.key(kind, e));
    return h === undefined || h === by?.id;
  }
  private claim(m: Mover, e: Edge) {
    if (!this.exclusive(m.kind, e)) return true;
    const k = this.key(m.kind, e);
    const h = this.holds.get(k);
    if (h !== undefined && h !== m.id) return false;
    this.holds.set(k, m.id);
    m.blocks.add(k);
    return true;
  }
  private release(m: Mover, keep?: Set<string>) {
    for (const k of m.blocks)
      if (!keep?.has(k)) {
        if (this.holds.get(k) === m.id) this.holds.delete(k);
        m.blocks.delete(k);
      }
  }

  // ------------------------------------------------------------ the trail

  private length(m: Mover) {
    return consistLength(m.cars);
  }
  private endNode(s: Step) {
    return s.dir === 1 ? s.edge.b : s.edge.a;
  }
  private startNode(s: Step) {
    return s.dir === 1 ? s.edge.a : s.edge.b;
  }
  private stepsEnd(m: Mover) {
    return m.offset + m.steps.reduce((s, st) => s + st.edge.length, 0);
  }

  /** The ways on from a node, with continuous direction at the join.
   *  Forks contain several curves sharing a side. Changing between those
   *  curves at that side would send a vehicle straight back into the tile. */
  private ways(node: string, from: Edge, kind: Route) {
    if (this.stations.has(node)) return [];
    const incoming = pointAt(from.seg, from.b === node ? 1 : 0);
    const inDir = from.b === node ? 1 : -1;
    return (this.net?.at.get(node) ?? []).filter((e) => {
      if (e.id === from.id || e.seg.kind !== kind) return false;
      const outgoing = pointAt(e.seg, e.a === node ? 0 : 1);
      const outDir = e.a === node ? 1 : -1;
      return (
        (incoming.tx * outgoing.tx + incoming.tz * outgoing.tz) *
          inDir *
          outDir >
        0.999
      );
    });
  }

  private stopShort(kind: Route, node: string, car?: Spec) {
    const wall = this.stations.get(node);
    if (wall !== undefined) {
      // A goods shed's door stays clear of the forward part of the turn.
      const swing =
        kind === ROAD && car ? turnRoom(car).max - car.length / 2 : 0;
      return (
        wall + DOOR_GAP + Math.max(0, swing) + (kind === ROAD ? TURN_MARGIN : 0)
      );
    }
    return kind === ROAD && car
      ? Math.max(
          LOOSE_SHORT,
          DOOR_GAP + turnRoom(car).max - car.length / 2 + TURN_MARGIN,
        )
      : LOOSE_SHORT;
  }

  /** A car only enters a branch if it can leave it or turn within a flat,
   *  straight stretch. A narrow bend, bridge or too-short shed approach is
   *  a perfectly valid game route, but unsuitable for this vehicle. */
  private roadWay(
    step: Step,
    car: Spec,
    before: number,
    seen = new Set<string>(),
  ): boolean {
    if (step.edge.exit?.pier) return false;
    const node = this.endNode(step);
    if (node.startsWith('x:')) return true;
    const k = `${step.edge.id}/${step.dir}`;
    if (seen.has(k)) return true;
    if (seen.size >= 64) return false;
    const trail = new Set(seen).add(k);
    const run = straightStreet(step.edge) ? before + step.edge.length : 0;
    const ways = this.ways(node, step.edge, ROAD);
    if (!ways.length) {
      const room = turnRoom(car);
      return (
        straightStreet(step.edge) &&
        room.fits &&
        run >= this.stopShort(ROAD, node, car) + car.length / 2 - room.min
      );
    }
    return ways.some((e) =>
      this.roadWay({ edge: e, dir: e.a === node ? 1 : -1 }, car, run, trail),
    );
  }

  /** Enough track beyond a switch for the whole train to stand clear of it. */
  private railWay(step: Step, need: number, seen = new Set<string>()): boolean {
    if (step.edge.exit?.pier) return false;
    const node = this.endNode(step);
    if (node.startsWith('x:')) return true;
    const k = `${step.edge.id}/${step.dir}`;
    if (seen.has(k)) return true;
    if (seen.size >= 64) return false;
    const ways = this.ways(node, step.edge, RAIL);
    const room =
      step.edge.length - (!ways.length ? this.stopShort(RAIL, node) : 0);
    if (room >= need) return true;
    if (!ways.length) return false;
    const trail = new Set(seen).add(k);
    return ways.some((e) =>
      this.railWay({ edge: e, dir: e.a === node ? 1 : -1 }, need - room, trail),
    );
  }

  private straightBehind(m: Mover, from: Edge) {
    let run = 0;
    for (let i = m.steps.findIndex((s) => s.edge === from); i >= 0; i--) {
      const s = m.steps[i];
      if (!straightStreet(s.edge)) break;
      run += s.edge.length;
    }
    return run;
  }

  private usableWays(m: Mover, node: string, from: Edge) {
    const before = this.straightBehind(m, from);
    return this.ways(node, from, m.kind).filter((e) => {
      // A wharf is scenery, not a hidden exit: never disappear into it.
      if (e.exit?.pier) return false;
      const step: Step = { edge: e, dir: e.a === node ? 1 : -1 };
      return m.kind === ROAD
        ? this.roadWay(step, m.cars[0], before)
        : this.railWay(step, this.length(m) + 0.03);
    });
  }

  /** Pick a way on: free ones first, stations liked, exits now and then. */
  private choose(m: Mover, node: string, from: Edge): Step | null {
    const list = this.usableWays(m, node, from);
    if (!list.length) return null;
    const free = list.filter((e) => this.blockFree(m.kind, e, m));
    const pool = free.length ? free : list;
    const weights = pool.map((e): number => {
      if (e.exit) return m.resident ? 0 : 0.45;
      if (e.seg.station) return 1.6;
      const far = across(e, node);
      const dead = !this.ways(far, e, m.kind).length;
      if (dead && pool.length > 1) return 0.25;
      return 1;
    });
    const total = weights.reduce((a, b) => a + b, 0);
    if (total <= 0) return null;
    let r = this.rand() * total;
    let e = pool[pool.length - 1];
    for (let i = 0; i < pool.length; i++) {
      r -= weights[i];
      if (r <= 0) {
        e = pool[i];
        break;
      }
    }
    return { edge: e, dir: e.a === node ? 1 : -1 };
  }

  /** Lay trail behind a vehicle so its last car has somewhere to be. */
  private extendBack(m: Mover, need: number) {
    let guard = 0;
    while (m.head - need < m.offset && guard++ < 12) {
      const first = m.steps[0];
      const node = this.startNode(first);
      const list = this.ways(node, first.edge, m.kind);
      if (!list.length) return false;
      const e = list[Math.floor(this.rand() * list.length)];
      const into: Step = { edge: e, dir: e.b === node ? 1 : -1 };
      m.steps.unshift(into);
      m.offset -= e.length;
    }
    return m.head - need >= m.offset;
  }

  /** Where along the trail distance `s` is: a point, its heading and height. */
  private at(m: Mover, s: number) {
    let start = m.offset;
    let step = m.steps[0];
    for (const st of m.steps) {
      step = st;
      if (s <= start + st.edge.length) break;
      start += st.edge.length;
    }
    const local = Math.min(1, Math.max(0, (s - start) / step.edge.length));
    const t = step.dir === 1 ? local : 1 - local;
    const p = pointAt(step.edge.seg, t);
    return {
      x: p.x,
      z: p.z,
      tx: p.tx * step.dir,
      tz: p.tz * step.dir,
      y: liftAt(step.edge.seg.lift, t),
    };
  }

  /** A point on the vehicle's own lane at trail distance `s`. */
  private lanePoint(m: Mover, s: number): P3 {
    const c = this.at(m, s);
    if (m.kind !== ROAD) return { x: c.x, y: c.y, z: c.z };
    // Keep to the right of the street.
    return { x: c.x - c.tz * LANE, y: c.y + ROAD_TOP, z: c.z + c.tx * LANE };
  }

  // ------------------------------------------------------------ poses

  /** Every car of a vehicle, front first. */
  poses(m: Mover): CarPose[] {
    const out: CarPose[] = [];
    if (m.turn) {
      const p = turning(m.turn);
      const half = m.cars[0].length * 0.28;
      const fx = -Math.sin(p.yaw),
        fz = -Math.cos(p.yaw);
      out.push({
        front: { x: p.x + fx * half, y: m.turn.y, z: p.z + fz * half },
        back: { x: p.x - fx * half, y: m.turn.y, z: p.z - fz * half },
      });
      return out;
    }
    const b = m.bump ?? 9;
    let s = m.head + (b < 0.6 ? -0.014 * Math.sin(b * 16) * (1 - b / 0.6) : 0);
    for (const c of m.cars) {
      // Axles (or bogies) a fifth of the way in from each end.
      const inset = c.length * (m.kind === RAIL ? 0.2 : 0.22);
      const pose = {
        front: this.lanePoint(m, s - inset),
        back: this.lanePoint(m, s - c.length + inset),
      };
      out.push(
        m.kind === RAIL && m.pushed
          ? { front: pose.back, back: pose.front }
          : pose,
      );
      s -= c.length + COUPLING;
    }
    return out;
  }

  private body(m: Mover) {
    const list: { a: P3; b: P3; r: number }[] = [];
    const poses = this.poses(m);
    poses.forEach((p, i) => {
      const c = m.cars[i];
      const dx = p.front.x - p.back.x,
        dz = p.front.z - p.back.z;
      const l = Math.hypot(dx, dz) || 1;
      // Out from the axles to the bumpers, less the capsule's round ends.
      const out = Math.max(0, c.length / 2 - l / 2 - c.width / 2);
      list.push({
        a: {
          x: p.front.x + (dx / l) * out,
          y: 0,
          z: p.front.z + (dz / l) * out,
        },
        b: { x: p.back.x - (dx / l) * out, y: 0, z: p.back.z - (dz / l) * out },
        r: c.width / 2,
      });
    });
    return list;
  }

  // ------------------------------------------------------------ motion

  /** How far ahead is clear of other vehicles (Infinity if all of it). */
  private clearAhead(m: Mover) {
    const own = m.cars[0].width / 2;
    const reach = Math.min(LOOK, this.stepsEnd(m) - m.head);
    const front = this.lanePoint(m, m.head);
    // Turning vehicles keep their patch of street: wait outside it.
    const zones = this.movers.filter(
      (o) =>
        o !== m &&
        o.zone &&
        !o.dead &&
        Math.hypot(front.x - o.zone.x, front.z - o.zone.z) > o.zone.r,
    );
    for (let g = 0.02; g <= reach + 1e-6; g += 0.03) {
      const p = this.lanePoint(m, m.head + g);
      for (const o of zones)
        if (Math.hypot(p.x - o.zone!.x, p.z - o.zone!.z) < o.zone!.r + own) {
          m.waitingFor = o.id;
          return g;
        }
      for (const o of this.movers) {
        if (o === m || o.dead || o.kind !== m.kind) continue;
        for (const seg of this.bodies.get(o.id) ?? [])
          if (segDist(p.x, p.z, seg.a, seg.b) < own + seg.r + 0.012) {
            m.waitingFor = o.id;
            return g;
          }
      }
    }
    return Infinity;
  }

  private overlapsAny(m: Mover, room = 0) {
    const mine = this.body(m);
    for (const o of this.movers) {
      if (o === m || o.dead || o.kind !== m.kind) continue;
      for (const a of mine)
        for (const b of this.bodies.get(o.id) ?? this.body(o))
          if (capsuleDist(a, b) < a.r + b.r + room) return true;
    }
    return false;
  }

  private fade(m: Mover) {
    if (m.dying === undefined) m.dying = 0.4;
    this.release(m);
  }

  private advance(m: Mover, dt: number) {
    if (m.bump !== undefined) m.bump += dt;
    if (m.wait > 0) {
      m.wait -= dt;
      m.speed = 0;
      return;
    }
    if (m.turn) {
      m.turn.t += dt / (PHASE * (m.turn.keys.length - 1));
      if (m.turn.t >= 1) {
        m.turn = undefined;
        m.zone = undefined;
      }
      return;
    }
    if (m.pending) {
      // Turn round once the street is clear of the swing.
      if (this.turnRound(m)) m.pending = false;
      else m.wait = 0.25;
      return;
    }
    m.zone = undefined;
    m.waitingFor = undefined;
    // Keep a way chosen ahead, holding it before entering.
    let guard = 0;
    while (this.stepsEnd(m) - m.head < 0.45 && guard++ < 4) {
      const tail = m.steps[m.steps.length - 1];
      const node = this.endNode(tail);
      if (node.startsWith('x:')) break;
      if (m.served === node) break;
      // A queued car must not reserve the junction before the car ahead
      // has reached it. That would hold the front car in place forever.
      if (m.kind === ROAD && this.clearAhead(m) < Infinity) break;
      const next = this.choose(m, node, tail.edge);
      if (!next) break;
      const plan = [next];
      if (m.kind === ROAD) {
        // Junctions joined by curves or bridges form one corridor: reserve
        // a way out before entering it. Cars on opposite approaches must
        // not each hold one end and prevent the other from leaving.
        const seen = new Set([next.edge.id]);
        // Unique edge IDs guarantee an outlet, terminal or cycle before
        // this bound; never reserve a corridor truncated by a fixed cap.
        const bound = (this.net?.edges.length ?? 0) + 1;
        while (plan.length < bound && this.exclusive(ROAD, plan.at(-1)!.edge)) {
          const last = plan.at(-1)!;
          const end = this.endNode(last);
          if (end.startsWith('x:')) break;
          const on = this.choose(
            { ...m, steps: [...m.steps, ...plan] },
            end,
            last.edge,
          );
          if (!on || seen.has(on.edge.id)) break;
          plan.push(on);
          seen.add(on.edge.id);
        }
      }
      const blocked = plan.find((s) => !this.blockFree(m.kind, s.edge, m));
      if (blocked) {
        m.waitingFor = this.holds.get(this.key(m.kind, blocked.edge));
        break;
      }
      for (const s of plan) this.claim(m, s.edge);
      m.steps.push(...plan);
    }
    const last = m.steps[m.steps.length - 1];
    const end = this.endNode(last);
    const leaving = end.startsWith('x:');
    const ways = leaving ? 1 : this.usableWays(m, end, last.edge).length;
    // Stop where the trail ends: at a shed door, before the buffers or the
    // barrier, or at the edge of a square someone else holds.
    let stopShort = 0;
    if (!leaving) {
      if (this.stations.has(end) || !ways)
        stopShort = this.stopShort(m.kind, end, m.cars[0]);
      else stopShort = m.kind === RAIL ? 0.06 : 0.12;
    }
    const stopAt = leaving ? Infinity : this.stepsEnd(m) - stopShort;
    let target = m.max;
    if (stopAt < Infinity)
      target = Math.min(
        target,
        Math.sqrt(2 * BRAKE * Math.max(0, stopAt - m.head)) + 0.01,
      );
    const clear = this.clearAhead(m);
    if (clear < Infinity)
      target = Math.min(
        target,
        Math.sqrt(2 * BRAKE * Math.max(0, clear - GAP)),
      );
    // Slow on the bends and over the bridges.
    target *= m.kind === RAIL ? 1 : 0.9;
    m.speed += Math.max(-1.2 * dt, Math.min(ACCEL * dt, target - m.speed));
    if (m.speed < 0) m.speed = 0;
    m.head = Math.min(m.head + m.speed * dt, stopAt);

    if (leaving && m.head >= this.stepsEnd(m)) {
      m.dead = true;
      return;
    }
    const atStop = m.head >= stopAt - 0.003 && m.speed < 0.05;
    if (atStop && (this.stations.has(end) || !ways)) {
      // Served: wait while the load goes across, then go back.
      const station = this.stations.has(end);
      m.served = end;
      m.wait = station
        ? m.kind === RAIL
          ? this.between(2.2, 3.4)
          : this.between(1.6, 2.6)
        : this.between(0.2, 0.5);
      if (m.kind === ROAD) m.pending = true;
      else this.reverse(m);
      return;
    }
    // Held up: by a square someone else holds, or by the vehicle ahead.
    const ahead = this.movers.find((o) => o.id === m.waitingFor);
    const yielding = ahead && (ahead.speed > 0.02 || ahead.turn);
    m.held =
      m.speed < 0.02 && !yielding && (atStop || clear < Infinity)
        ? m.held + dt
        : 0;
    if (m.kind === RAIL && m.held > 3 + (m.id % 3)) this.reverse(m);
    else if (m.kind === ROAD && m.held > 7 + (m.id % 4)) {
      // Keep waiting on a bend or bridge. A failed turn must not leave a
      // parked vehicle permanently holding the next junction.
      if (this.turnRound(m)) {
        m.pending = false;
        return;
      }
      m.zone = undefined;
      m.held = 0;
    }
    this.trimBehind(m);
  }

  /** Forget the trail and the holds the last car has left. */
  private trimBehind(m: Mover) {
    const back = m.head - this.length(m) - 0.03;
    while (m.steps.length > 1 && m.offset + m.steps[0].edge.length < back) {
      m.offset += m.steps[0].edge.length;
      m.steps.shift();
    }
    const keep = new Set(
      m.steps
        .filter((s) => this.exclusive(m.kind, s.edge))
        .map((s) => this.key(m.kind, s.edge)),
    );
    this.release(m, keep);
  }

  /** Reverse the trail in place: every distance mirrors along it. */
  private flip(m: Mover) {
    const length = this.length(m);
    const end = this.stepsEnd(m);
    m.steps = m.steps
      .map((s) => ({ edge: s.edge, dir: (s.dir * -1) as 1 | -1 }))
      .reverse();
    m.head = m.offset + (end - m.head) + length;
  }

  /** A train at its buffers or held up: a bump, then it runs back. */
  private reverse(m: Mover) {
    this.flip(m);
    m.cars.reverse();
    m.pushed = !m.pushed;
    m.bump = 0;
    m.speed = 0;
    m.held = 0;
    if (m.wait <= 0) m.wait = this.between(0.8, 1.4);
    this.trimBehind(m);
  }

  /** A street vehicle turns round where it stands: forward across the
   *  street, back, and away in the other lane. Only when nobody stands in
   *  the way of its swing (false otherwise). */
  private turnRound(m: Mover) {
    m.waitingFor = undefined;
    const len = m.cars[0].length;
    const room = turnRoom(m.cars[0]);
    if (!room.fits) return false;
    const centre = m.head - len / 2;
    const c = this.at(m, centre);
    const p = this.lanePoint(m, centre);
    const yaw = Math.atan2(-c.tx, -c.tz);
    // Keep the whole manoeuvre on one flat, straight stretch, even when
    // that stretch crosses a square boundary. Bridges and curves are not
    // turning yards.
    let start = m.offset;
    let here = 0;
    for (; here < m.steps.length - 1; here++) {
      if (centre <= start + m.steps[here].edge.length) break;
      start += m.steps[here].edge.length;
    }
    if (!straightStreet(m.steps[here].edge)) return false;
    let lo = start,
      hi = start + m.steps[here].edge.length;
    for (let i = here - 1; i >= 0 && straightStreet(m.steps[i].edge); i--)
      lo -= m.steps[i].edge.length;
    let last = here;
    for (
      let i = here + 1;
      i < m.steps.length && straightStreet(m.steps[i].edge);
      i++
    ) {
      hi += m.steps[i].edge.length;
      last = i;
    }
    const end = this.endNode(m.steps[last]);
    if (this.stations.has(end)) hi -= this.stations.get(end)! + DOOR_GAP;
    else if (!this.ways(end, m.steps[last].edge, ROAD).length) hi -= DOOR_GAP;
    if (centre + room.min < lo - 1e-9 || centre + room.max > hi + 1e-9)
      return false;
    // Left of the way of travel.
    const lx = c.tz,
      lz = -c.tx;
    const turn = turnPath(p.x, p.z, yaw, m.cars[0]);
    turn.y = p.y;
    // Reserve the complete swept body, including the forward steering arc.
    m.zone = {
      x: p.x + lx * LANE,
      z: p.z + lz * LANE,
      r: Math.hypot(Math.max(-room.min, room.max), CARRIAGE_HALF),
    };
    // The reserved circle is deliberately generous for approaching cars.
    // Cars already behind it only prevent the turn when their actual body
    // intersects the swept body, including cars queued in the other lane.
    const sweep = [];
    const half = (len - m.cars[0].width) / 2;
    for (let i = 0; i <= 120; i++) {
      const pose = turning({ ...turn, t: i / 120 });
      const dx = -Math.sin(pose.yaw) * half,
        dz = -Math.cos(pose.yaw) * half;
      sweep.push({
        a: { x: pose.x + dx, y: 0, z: pose.z + dz },
        b: { x: pose.x - dx, y: 0, z: pose.z - dz },
      });
    }
    for (const o of this.movers) {
      if (o === m || o.dead || o.kind !== ROAD) continue;
      if (o.zone && o.turn) {
        if (
          Math.hypot(o.zone.x - m.zone.x, o.zone.z - m.zone.z) <
          o.zone.r + m.zone.r
        ) {
          m.waitingFor = o.id;
          return false;
        }
      }
      for (const b of this.bodies.get(o.id) ?? []) {
        if (
          sweep.some(
            (s) => capsuleDist(s, b) < m.cars[0].width / 2 + b.r + 0.012,
          )
        ) {
          m.waitingFor = o.id;
          return false;
        }
      }
    }
    this.flip(m);
    m.turn = turn;
    m.speed = 0;
    m.held = 0;
    return true;
  }

  // ------------------------------------------------------------ the clock

  tick(dt: number, moving = true) {
    if (!this.net) return;
    if (moving) {
      this.spawnIn -= dt;
      if (this.spawnIn <= 0) {
        this.spawnIn = this.between(0.6, 1.6);
        this.spawn();
      }
    }
    for (const m of this.movers)
      if (!m.dead) this.bodies.set(m.id, this.body(m));
    for (const m of this.movers) {
      if (m.dead) continue;
      m.age += dt;
      if (m.dying !== undefined) {
        m.dying -= dt;
        if (m.dying <= 0) m.dead = true;
        continue;
      }
      if (moving) this.advance(m, dt);
      if (!m.dead) this.bodies.set(m.id, this.body(m));
    }
    const keep: Mover[] = [];
    for (const m of this.movers) {
      if (m.dead) {
        this.release(m);
        this.bodies.delete(m.id);
      } else keep.push(m);
    }
    this.movers = keep;
  }

  /** Each live vehicle's capsules, for tests. */
  footprint(m: Mover) {
    return this.body(m);
  }

  clear() {
    for (const m of this.movers) this.release(m);
    this.movers = [];
    this.bodies.clear();
  }
}

type Comp = { kind: Route; edges: Edge[]; length: number; gates: Edge[] };

/** A turning car's pose: smooth through its key poses. */
export function turning(turn: Turn) {
  const n = turn.keys.length - 1;
  const t = Math.min(1, Math.max(0, turn.t)) * n;
  const i = Math.min(n - 1, Math.floor(t));
  const u = t - i;
  const a = turn.keys[i],
    b = turn.keys[i + 1];
  const k = u * u * (3 - 2 * u);
  const yaw = a.yaw + (b.yaw - a.yaw) * k;
  const r = turn.radii[i] * (b.reverse ? -1 : 1);
  return {
    x: a.x + r * (Math.cos(yaw) - Math.cos(a.yaw)),
    z: a.z + r * (Math.sin(a.yaw) - Math.sin(yaw)),
    yaw,
    reverse: b.reverse,
  };
}

function segDist(x: number, z: number, a: P3, b: P3) {
  const dx = b.x - a.x,
    dz = b.z - a.z;
  const t = Math.max(
    0,
    Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz || 1)),
  );
  return Math.hypot(x - (a.x + dx * t), z - (a.z + dz * t));
}

/** Closest distance between two capsules' core segments (sampled). */
export function capsuleDist(p: { a: P3; b: P3 }, q: { a: P3; b: P3 }) {
  let d = Infinity;
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    d = Math.min(
      d,
      segDist(
        p.a.x + (p.b.x - p.a.x) * t,
        p.a.z + (p.b.z - p.a.z) * t,
        q.a,
        q.b,
      ),
      segDist(
        q.a.x + (q.b.x - q.a.x) * t,
        q.a.z + (q.b.z - q.a.z) * t,
        p.a,
        p.b,
      ),
    );
  }
  return d;
}
