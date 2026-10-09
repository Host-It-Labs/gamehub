import { RAIL, ROAD, type Route } from './pieces.ts';
import {
  across,
  liftAt,
  pointAt,
  stubEnd,
  type Edge,
  type Net,
} from './routes.ts';
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
 *   and takes another way, as shunting does.
 * - Streets flow as real traffic does (8 October 2026): drivers follow the
 *   car ahead with a smooth following model (gentle starts after a short
 *   reaction, easing off for bends) and share a junction with anyone whose
 *   path does not cross theirs. Only crossing or merging movements give
 *   way, first come first served, and nobody enters a junction without
 *   room beyond it. Bends and bridges are never held.
 * - Stations are destinations: a car pulls up short of the station steps,
 *   a train at its platform; they wait while people get off and on, and
 *   leave the way they came. Cars queue for a station like a taxi rank,
 *   as many as its street holds. A street that stops short is turned in,
 *   a siding's buffers met gently and backed off from.
 * - Vehicles arrive and leave only out of sight: trains inside their
 *   tunnels, street traffic past the edge of the picture.
 * - Only live networks carry traffic: one that runs off the board, or one
 *   that links two goods stations, at least one of them served from a live
 *   network of the other kind. A siding or a street that leads nowhere
 *   stays empty.
 */

export type Spec = {
  model: string;
  /** Turned round on its bogies: the engine at the back of a train. */
  flip?: boolean;
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
  /** A street vehicle's chosen way on from the next node, kept until it
   *  is taken (drivers do not change their minds at the stop line). */
  intent?: { node: string; plan: Step[]; since: number };
  /** Seconds before a stopped street vehicle moves off (its reaction). */
  go?: number;
  /** The stop it is making now: a station's or a dead end's node. */
  call?: { node: string; cell: number; station: boolean };
  /** Why a street vehicle is waiting (for the tests and tuning). */
  why?: string;
  /** The junction boxes on its trail ahead, in order. */
  boxes?: Box[];
};

export type SimOptions = {
  /** Is a board point outside the picture? Traffic only comes and goes there. */
  offscreen: (x: number, z: number) => boolean;
  /** The cars of a new vehicle, front first. */
  make: (kind: Route, rand: () => number, long: boolean) => Spec[] | null;
  rand?: () => number;
  /** A vehicle has pulled up at a station (its doors at the platform or
   *  the kerb): how many seconds it stands there, if not the default. */
  arrive?: (m: Mover, cell: number) => number | undefined;
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
/** How far ahead a street vehicle looks for the car in front. */
const ROAD_LOOK = 0.62;

// Street driving: the intelligent driver model, in squares and seconds.
/** Comfortable braking. */
const IDM_BRAKE = 0.32;
/** Time headway kept to the car in front. */
const HEADWAY = 0.55;
/** Hardest braking ever used (an emergency stop never shows). */
const HARD = 1.4;
/** Sideways acceleration taken round a bend. */
const BEND_GRIP = 0.085;
/** Movements through a junction whose lanes pass closer than this cross. */
const CONFLICT = 0.14;
/** A junction box reaches this far either side of where lanes meet. */
const BOX_PAD = 0.045;
/** A road dead end is turned in by one car at a time; a station's street
 *  queues like a taxi rank, with this much room kept to its mouth. */
const RANK_MOUTH = 0.12;
/** A tight three-point turn: most of the turn is driven forwards. */
const TURN_ANGLE = Math.PI / 3;
const TURN_MARGIN = 0.002;
const ROAD_CAP = 22;
const ROAD_DIV = 0.7;

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
  private roadNext = false;
  private nextId = 1;
  /** Squares held, by kind and square, to the mover holding them. */
  private holds = new Map<string, number>();
  /** Station centres: destinations, never a way through. */
  private stations = new Map<string, number>();
  /** Road squares where three or more ways meet. */
  private crossings = new Set<number>();
  /** Each junction's movements (a way through it, one direction) and the
   *  movements whose lanes cross or merge with it. */
  private moves = new Map<string, Move>();
  /** Who is in (or committed to) each junction, on which movement. */
  private inJunction = new Map<number, Map<number, string>>();
  /** Drivers waiting at a junction's mouth, in order of arrival. */
  private queue = new Map<
    number,
    Map<number, { key: string; since: number; ready: boolean; seen: number }>
  >();
  private clock = 0;
  private comps: Comp[] = [];
  private compOf = new Map<string, Comp>();
  private bodies = new Map<number, { a: P3; b: P3; r: number }[]>();
  /** Dead-end streets, by entry, for this network. */
  private culs = new Map<string, Cul | null>();

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
        this.stations.set(centre, stubEnd(stationHalf(cellOf(e)), e.seg.kind));
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
    // A station's stubs share its centre but never join: not a junction.
    const stationCells = new Set(
      net.edges.filter((e) => e.seg.station).map(cellOf),
    );
    for (const [c, set] of roadSides)
      if (set.size >= 3 && !stationCells.has(c)) this.crossings.add(c);
    this.junctionMoves(net);
    const byId = new Map(net.edges.map((e) => [e.id, e]));
    for (const m of this.movers) {
      if (m.steps.some((s) => !byId.has(s.edge.id))) this.fade(m);
      else
        m.steps = m.steps.map((s) => ({
          edge: byId.get(s.edge.id)!,
          dir: s.dir,
        }));
    }
    this.culs = new Map();
    this.components(net);
    for (const m of this.movers)
      if (m.resident && m.dying === undefined) {
        const comp = this.compOf.get(m.steps[0].edge.id);
        if (comp?.gates.length) m.resident = false;
        // Its stations no longer link up: it goes, as it came.
        else if (!comp?.live) this.fade(m);
      }
  }

  /** Every way through every junction, both directions, with the others
   *  it crosses or merges with. Movements from the same mouth follow one
   *  another (the car ahead is simply followed); lanes that pass apart,
   *  such as two right turns or opposite straights, go together. */
  private junctionMoves(net: Net) {
    const old = this.inJunction;
    this.moves = new Map();
    const byCell = new Map<number, Move[]>();
    for (const e of net.edges) {
      if (e.exit || e.seg.kind !== ROAD) continue;
      const cell = cellOf(e);
      if (!this.crossings.has(cell)) continue;
      for (const dir of [1, -1] as const) {
        const pts: { x: number; z: number }[] = [];
        for (let i = 0; i <= 24; i++) {
          const t = dir === 1 ? i / 24 : 1 - i / 24;
          const p = pointAt(e.seg, t);
          const tx = p.tx * dir,
            tz = p.tz * dir;
          pts.push({ x: p.x - tz * LANE, z: p.z + tx * LANE });
        }
        const m: Move = {
          key: moveKey(e, dir),
          cell,
          from: dir === 1 ? e.a : e.b,
          to: dir === 1 ? e.b : e.a,
          pts,
          conflicts: new Set(),
          length: e.length,
          inAt: -1,
          outAt: -1,
        };
        this.moves.set(m.key, m);
        const list = byCell.get(cell) ?? [];
        list.push(m);
        byCell.set(cell, list);
      }
    }
    for (const list of byCell.values())
      for (const a of list) {
        // Where along `a` some other movement comes close: its box.
        let first = Infinity,
          last = -Infinity;
        for (const b of list) {
          if (a === b || a.from === b.from) continue;
          let near = false;
          a.pts.forEach((p, i) => {
            for (const q of b.pts)
              if (Math.hypot(p.x - q.x, p.z - q.z) < CONFLICT) {
                near = true;
                first = Math.min(first, i);
                last = Math.max(last, i);
                break;
              }
          });
          if (a.to === b.to) {
            near = true;
            last = a.pts.length - 1;
            first = Math.min(first, a.pts.length - 2);
          }
          if (near) a.conflicts.add(b.key);
        }
        if (first <= last) {
          const n = a.pts.length - 1;
          a.inAt = Math.max(0, (first / n) * a.length - BOX_PAD);
          a.outAt = Math.min(a.length, (last / n) * a.length + BOX_PAD);
        }
      }
    // Keep who is in a junction across a rebuild, where the way still is.
    this.inJunction = new Map();
    for (const [cell, who] of old)
      for (const [id, key] of who)
        if (this.moves.has(key)) {
          const map = this.inJunction.get(cell) ?? new Map<number, string>();
          map.set(id, key);
          this.inJunction.set(cell, map);
        }
    this.queue = new Map();
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
        c = {
          kind: e.seg.kind,
          edges: [],
          length: 0,
          gates: [],
          stations: new Set(),
          live: false,
        };
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
    // Goods stations join a street network to a railway: which networks
    // each station serves.
    const served = new Map<number, Set<Comp>>();
    for (const c of comps.values())
      for (const e of c.edges)
        if (e.seg.station) {
          c.stations.add(cellOf(e));
          const set = served.get(cellOf(e)) ?? new Set<Comp>();
          set.add(c);
          served.set(cellOf(e), set);
        }
    // Live from the outside in: a network running off the board, then one
    // linking two stations where another live network delivers.
    for (const c of comps.values()) c.live = c.gates.length > 0;
    for (let changed = true; changed;) {
      changed = false;
      for (const c of comps.values()) {
        if (c.live || c.stations.size < 2) continue;
        const fed = [...c.stations].some((cell) =>
          [...served.get(cell)!].some((o) => o !== c && o.live),
        );
        if (fed) c.live = changed = true;
      }
    }
    this.comps = [...comps.values()].filter((c) => c.length > 0);
  }

  /** How many of each kind a live network carries: busy streets, a train
   *  or two on the railway. */
  private wanted(c: Comp) {
    if (!c.live) return 0;
    if (c.kind === ROAD)
      return c.gates.length
        ? Math.max(2, Math.min(ROAD_CAP, Math.round(c.length / ROAD_DIV)))
        : // A closed goods route keeps one resident. Several visitors to its
          // terminal branches could each await the other's return passage.
          1;
    if (c.kind === RAIL)
      return c.gates.length
        ? Math.min(c.gates.length + 1, c.length >= 4 ? 2 : 1)
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
    // Trains first, then alternate when both kinds need traffic. A full
    // railway gate must never prevent any street vehicle being attempted.
    const rail = want.filter((w) => w.c.kind === RAIL);
    const road = want.filter((w) => w.c.kind === ROAD);
    const pool =
      rail.length && road.length ? (this.roadNext ? road : rail) : want;
    this.roadNext = !this.roadNext;
    const { c } = this.pick(pool);
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
      if (m.kind === ROAD) m.head = this.justOutOfSight(gate, total);
      if (this.overlapsAny(m, 0.25)) return;
      this.claim(m, gate);
      this.movers.push(m);
      return;
    }
    // A live network with no way out keeps one resident, where it can
    // travel in both directions without obstructing a crossing.
    const edges = c.edges.filter(
      (e) =>
        !e.seg.station &&
        e.length >= 0.5 &&
        (c.kind !== ROAD || !this.exclusive(ROAD, e)),
    );
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
      if (m.kind !== RAIL) return;
      // Wagons go first; the engines at both ends stay.
      const wagon = m.cars.findLastIndex((car, i) => i > 0 && !car.flip);
      if (wagon < 0) return;
      m.cars.splice(wagon, 1);
    }
    if (
      m.kind === ROAD &&
      (!this.roadWay(m.steps[m.steps.length - 1], m.cars[0], 0) ||
        !this.roadWay(
          { edge: e, dir: m.steps[0].dir === 1 ? -1 : 1 },
          m.cars[0],
          0,
        ))
    )
      return;
    if (
      m.kind === ROAD &&
      m.steps.some(
        (s) =>
          this.culFull(m, this.startNode(s), s.edge, true) ||
          this.culFull(m, this.endNode(s), s.edge, true),
      )
    )
      return;
    for (const s of m.steps)
      if (!this.blockFree(m.kind, s.edge, undefined, s.dir)) return;
    for (const s of m.steps) this.claim(m, s.edge, s.dir);
    if (this.overlapsAny(m)) {
      this.release(m);
      return;
    }
    this.movers.push(m);
  }

  /** How far in along a way out (driven from its far end) a street
   *  vehicle can start with its whole body still out of the picture, so
   *  the streets fill quickly rather than from the far end of the town. */
  private justOutOfSight(gate: Edge, total: number) {
    const hidden = (d: number) => {
      const p = pointAt(gate.seg, 1 - d / gate.length);
      return this.opts.offscreen(p.x, p.z);
    };
    let head = total + 0.02;
    for (let d = head + 0.25; d < gate.length - 0.3; d += 0.25) {
      if (!hidden(d) || !hidden(d - total)) break;
      head = d;
    }
    // Keep a little way back from the edge of the picture.
    return Math.max(total + 0.02, head - 0.3);
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

  private key(kind: Route, e: Edge, dir: 1 | -1 = 1) {
    // A street junction is held movement by movement, not as a square.
    if (kind === ROAD) return `j:${moveKey(e, dir)}`;
    return `${kind}:${blockOf(e)}`;
  }
  /** Does this way need holding before it is entered? Every track; on the
   *  streets, only a way through a junction. */
  private exclusive(kind: Route, e: Edge) {
    if (kind === RAIL) return true;
    return !e.exit && this.crossings.has(cellOf(e));
  }
  /** Whoever holds a way that conflicts with this one (or this one). */
  private holder(kind: Route, e: Edge, dir: 1 | -1, by?: Mover) {
    if (!this.exclusive(kind, e)) return undefined;
    if (kind !== ROAD) {
      const h = this.holds.get(this.key(kind, e));
      return h === by?.id ? undefined : h;
    }
    const move = this.moves.get(moveKey(e, dir));
    if (!move) return undefined;
    for (const [id, key] of this.inJunction.get(move.cell) ?? [])
      if (id !== by?.id && move.conflicts.has(key)) return id;
    return undefined;
  }
  private blockFree(kind: Route, e: Edge, by?: Mover, dir: 1 | -1 = 1) {
    return this.holder(kind, e, dir, by) === undefined;
  }
  private claim(m: Mover, e: Edge, dir: 1 | -1 = 1) {
    if (!this.exclusive(m.kind, e)) return true;
    if (this.holder(m.kind, e, dir, m) !== undefined) return false;
    const k = this.key(m.kind, e, dir);
    if (m.kind === ROAD) {
      const cell = cellOf(e);
      const who = this.inJunction.get(cell) ?? new Map<number, string>();
      who.set(m.id, k.slice(2));
      this.inJunction.set(cell, who);
      for (const line of this.queue.values()) line.delete(m.id);
    } else this.holds.set(k, m.id);
    m.blocks.add(k);
    return true;
  }
  private release(m: Mover, keep?: Set<string>) {
    for (const k of m.blocks)
      if (!keep?.has(k)) {
        if (k.startsWith('j:')) {
          const move = this.moves.get(k.slice(2));
          const cell = move?.cell ?? Number(k.slice(2).split(':')[0]);
          const who = this.inJunction.get(cell);
          if (who?.get(m.id) === k.slice(2)) who.delete(m.id);
        } else if (this.holds.get(k) === m.id) this.holds.delete(k);
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
    // A junction is no place to stand while calling or turning round.
    const run =
      straightStreet(step.edge) && !this.exclusive(ROAD, step.edge)
        ? before + step.edge.length
        : 0;
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
    // A station is a terminus: the train runs in to its platform and stands
    // with its tail on the track behind, which it holds.
    if (this.stations.has(node)) return true;
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
      if (!straightStreet(s.edge) || this.exclusive(m.kind, s.edge)) break;
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

  /** The street from `node` along `e` when it only leads to a dead end or
   *  a station, where everyone turns round: its complete stem, its end
   *  node and length. */
  private culDeSac(node: string, e: Edge) {
    const k = `${e.id}@${node}`;
    if (this.culs.has(k)) return this.culs.get(k)!;
    let out: Cul | null = {
      edges: new Set(),
      end: '',
      station: false,
      length: 0,
    };
    let at = node,
      edge = e;
    for (let guard = 0; guard <= (this.net?.edges.length ?? 0); guard++) {
      if (edge.exit || out.edges.has(edge.id)) {
        out = null;
        break;
      }
      out.edges.add(edge.id);
      out.length += edge.length;
      at = across(edge, at);
      const on = this.ways(at, edge, ROAD);
      if (!on.length) break;
      if (on.length > 1) {
        out = null;
        break;
      }
      edge = on[0];
    }
    if (out) {
      out.end = at;
      out.station = this.stations.has(at);
    }
    if (out && !this.exclusive(ROAD, e)) {
      // Use the whole stem even when queried half-way along it (resident
      // spawning and the return trip), rather than separate suffix quotas.
      at = node;
      edge = e;
      for (;;) {
        const back = this.ways(at, edge, ROAD);
        if (
          back.length !== 1 ||
          back[0].exit ||
          this.exclusive(ROAD, back[0]) ||
          out.edges.has(back[0].id)
        )
          break;
        edge = back[0];
        out.edges.add(edge.id);
        out.length += edge.length;
        at = across(edge, at);
      }
    }
    this.culs.set(k, out);
    return out;
  }

  /** A street that leads only to a station or a dead end is a rank: cars
   *  queue nose to tail on the way in, as many as fit short of the stop,
   *  and each turns round at the front in turn (its swing never reaches
   *  back past its own tail, so the queue never blocks it). */
  private culFull(m: Mover, node: string, e: Edge, joining = false) {
    if (m.kind !== ROAD) return false;
    const cul = this.culDeSac(node, e);
    if (!cul) return false;
    // Its visitor must be able to finish the call and leave. Queues on a
    // shared approach cannot veto a vehicle already committed to the stem.
    if (!joining && m.steps.some((s) => cul.edges.has(s.edge.id))) return false;
    const others = this.movers.filter(
      (o) =>
        o.id !== m.id &&
        o.kind === ROAD &&
        !o.dead &&
        o.dying === undefined &&
        o.steps.some((s) => cul.edges.has(s.edge.id)),
    );
    if (!others.length) return false;
    if (!turnRoom(m.cars[0]).fits) {
      m.waitingFor = others[0].id;
      return true;
    }
    // Those on their way out keep to the other lane.
    const inbound = others.filter((o) => o.served !== cul.end && !o.turn);
    if (!inbound.length) return false;
    let used = 0;
    for (const o of inbound) used += this.length(o) + GAP + 0.02;
    const room =
      cul.length - this.stopShort(ROAD, cul.end, m.cars[0]) - RANK_MOUTH;
    if (used + this.length(m) + GAP <= room) return false;
    m.waitingFor = inbound[inbound.length - 1].id;
    return true;
  }

  /** Pick a way on: free ones first, stations liked, exits now and then. */
  private choose(
    m: Mover,
    node: string,
    from: Edge,
    avoid?: Set<string>,
  ): Step | null {
    const list = this.usableWays(m, node, from).filter(
      (e) => !avoid?.has(e.id) && !this.culFull(m, node, e),
    );
    if (!list.length) return null;
    const free = list.filter((e) =>
      this.blockFree(m.kind, e, m, e.a === node ? 1 : -1),
    );
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

  /** Is a car ahead driving on, so that it will have cleared the way by
   *  the time this one gets there (as any driver assumes)? Not one standing
   *  or about to stop: at a line just ahead, or behind a standing car. */
  private clearing(o: Mover | undefined, need: number) {
    if (!o || o.speed <= 0.08 || o.turn || o.pending || o.wait > 0)
      return false;
    const out = this.endNode(o.steps[o.steps.length - 1]).startsWith('x:');
    const box = o.boxes?.find((b) => !b.claimed);
    const free = Math.min(
      this.stepsEnd(o) - (out ? 0 : 0.12),
      box ? box.sIn : Infinity,
    );
    if (free - o.head < need + 0.2) return false;
    const ahead = this.movers.find((v) => v.id === o.waitingFor);
    return !ahead || ahead.speed > 0.05;
  }

  /** Room for this car's whole body just beyond a junction box, so it
   *  never stands in the box waiting for the car in front. */
  private landing(m: Mover, box: Box) {
    const need = this.length(m) + GAP + 0.02;
    const next = m.boxes?.find((b) => !b.claimed && b.sIn > box.sOut);
    const end = this.endNode(m.steps[m.steps.length - 1]);
    const limit = Math.min(
      next ? next.sIn : Infinity,
      end.startsWith('x:') ? Infinity : this.stepsEnd(m) - 0.12,
    );
    if (limit - box.sOut < need) return false;
    const probe = { ...m, head: box.sOut, waitingFor: undefined };
    const clear = this.clearAhead(probe);
    if (clear < need) {
      const o = this.movers.find((v) => v.id === probe.waitingFor);
      if (!this.clearing(o, need)) {
        m.waitingFor = probe.waitingFor;
        return false;
      }
    }
    return true;
  }

  /** How far ahead is clear of other vehicles (Infinity if all of it). */
  private clearAhead(m: Mover) {
    const own = m.cars[0].width / 2;
    const reach = Math.min(
      m.kind === ROAD ? ROAD_LOOK : LOOK,
      this.stepsEnd(m) - m.head,
    );
    const front = this.lanePoint(m, m.head);
    // Turning vehicles keep their patch of street: wait outside it.
    const zones = this.movers.filter(
      (o) =>
        o.id !== m.id &&
        o.zone &&
        !o.dead &&
        Math.hypot(front.x - o.zone.x, front.z - o.zone.z) > o.zone.r,
    );
    for (let g = 0.02; g <= reach + 1e-6; g += 0.03) {
      const p = this.lanePoint(m, m.head + g);
      // Only on the way into a turning car's patch, never on the way out.
      for (const o of zones) {
        const d = Math.hypot(p.x - o.zone!.x, p.z - o.zone!.z);
        if (
          d < o.zone!.r + own &&
          d < Math.hypot(front.x - o.zone!.x, front.z - o.zone!.z)
        ) {
          m.waitingFor = o.id;
          return g;
        }
      }
      for (const o of this.movers) {
        if (o.id === m.id || o.dead || o.kind !== m.kind) continue;
        for (const seg of this.bodies.get(o.id) ?? []) {
          const margin = own + seg.r + 0.012;
          // Dense streets have many distant bodies. Reject only points
          // outside the capsule's bounds before measuring its exact gap.
          if (
            p.x < Math.min(seg.a.x, seg.b.x) - margin ||
            p.x > Math.max(seg.a.x, seg.b.x) + margin ||
            p.z < Math.min(seg.a.z, seg.b.z) - margin ||
            p.z > Math.max(seg.a.z, seg.b.z) + margin
          )
            continue;
          if (segDist(p.x, p.z, seg.a, seg.b) < margin) {
            m.waitingFor = o.id;
            return g;
          }
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
      if (this.turnRound(m)) {
        m.pending = false;
        m.call = undefined;
      } else m.wait = 0.25;
      return;
    }
    m.zone = undefined;
    m.waitingFor = undefined;
    if (m.call && m.kind === RAIL) m.call = undefined;
    if (m.kind === ROAD) {
      this.drive(m, dt);
      return;
    }
    // A train keeps a way chosen ahead, holding it before entering.
    let guard = 0;
    while (this.stepsEnd(m) - m.head < 0.45 && guard++ < 4) {
      const tail = m.steps[m.steps.length - 1];
      const node = this.endNode(tail);
      if (node.startsWith('x:')) break;
      if (m.served === node) break;
      const next = this.choose(m, node, tail.edge);
      if (!next) break;
      const holder = this.holder(m.kind, next.edge, next.dir, m);
      if (holder !== undefined) {
        m.waitingFor = holder;
        break;
      }
      this.claim(m, next.edge, next.dir);
      m.steps.push(next);
    }
    const last = m.steps[m.steps.length - 1];
    const end = this.endNode(last);
    const leaving = end.startsWith('x:');
    const ways = leaving ? 1 : this.usableWays(m, end, last.edge).length;
    // Stop where the trail ends: at the platform, before the buffers, or
    // at the edge of a square someone else holds.
    let stopShort = 0;
    if (!leaving) {
      if (this.stations.has(end) || !ways)
        stopShort = this.stopShort(m.kind, end, m.cars[0]);
      else stopShort = 0.06;
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
    m.speed += Math.max(-1.2 * dt, Math.min(ACCEL * dt, target - m.speed));
    if (m.speed < 0) m.speed = 0;
    m.head = Math.min(m.head + m.speed * dt, stopAt);

    if (leaving && m.head >= this.stepsEnd(m)) {
      m.dead = true;
      return;
    }
    const atStop = m.head >= stopAt - 0.003 && m.speed < 0.05;
    if (atStop && (this.stations.has(end) || !ways)) {
      // At the platform: people get off and on, then it runs back.
      const station = this.stations.has(end);
      m.served = end;
      let wait = station ? this.between(2.2, 3.4) : this.between(0.2, 0.5);
      if (station) {
        m.call = { node: end, cell: nodeCell(end), station };
        wait = this.opts.arrive?.(m, nodeCell(end)) ?? wait;
      }
      m.wait = wait;
      this.reverse(m);
      return;
    }
    // Held up: by a square someone else holds, or by the train ahead.
    const ahead = this.movers.find((o) => o.id === m.waitingFor);
    const yielding = ahead && (ahead.speed > 0.02 || ahead.turn);
    m.held =
      m.speed < 0.02 && !yielding && (atStop || clear < Infinity)
        ? m.held + dt
        : 0;
    if (m.held > 3 + (m.id % 3)) this.reverse(m);
    this.trimBehind(m);
  }

  // ------------------------------------------------------------ driving

  /** The way on from `node` this driver has decided on: through any
   *  junctions that touch, and one way beyond. Kept until taken; chosen
   *  again only once it can no longer be driven. A way through junctions
   *  never loops back onto the street the car (and its queue) is on. */
  private intent(m: Mover, node: string, from: Edge): Step[] | null {
    const kept = m.intent;
    if (
      kept &&
      kept.node === node &&
      this.clock - kept.since < 8 &&
      this.usableWays(m, node, from).includes(kept.plan[0].edge) &&
      !this.culFull(m, node, kept.plan[0].edge)
    )
      return kept.plan;
    const own = new Set(m.steps.map((s) => s.edge.id));
    const tried = new Set<string>();
    for (let attempt = 0; attempt < 4; attempt++) {
      const next = this.choose(m, node, from, tried);
      if (!next) break;
      tried.add(next.edge.id);
      const plan = [next];
      const seen = new Set([next.edge.id]);
      const bound = (this.net?.edges.length ?? 0) + 1;
      let stuck = false;
      while (plan.length < bound && this.exclusive(ROAD, plan.at(-1)!.edge)) {
        const last = plan.at(-1)!;
        const end = this.endNode(last);
        if (end.startsWith('x:')) break;
        const probe = { ...m, steps: [...m.steps, ...plan] };
        const on = this.choose(
          probe,
          end,
          last.edge,
          new Set([...own, ...seen]),
        );
        if (!on) {
          // The only way out is a full dead end, or back round onto this
          // street: wait before the junction, or try another way.
          if (this.usableWays(probe, end, last.edge).length) {
            m.waitingFor = probe.waitingFor;
            stuck = true;
          }
          break;
        }
        plan.push(on);
        seen.add(on.edge.id);
      }
      if (stuck) continue;
      m.intent = { node, plan, since: this.clock };
      return plan;
    }
    m.intent = undefined;
    return null;
  }

  /** Who this driver must give way to before entering these boxes:
   *  someone in one on a crossing movement, or someone who reached its
   *  mouth first and is only waiting for that. */
  private giveWay(m: Mover, group: Box[]) {
    const mine = this.queue.get(group[0].cell)?.get(m.id)?.since;
    for (const b of group) {
      const move = this.moves.get(b.key)!;
      for (const [id, key] of this.inJunction.get(b.cell) ?? [])
        if (id !== m.id && move.conflicts.has(key)) return { id, inside: true };
      for (const [id, w] of this.queue.get(b.cell) ?? []) {
        if (id === m.id || !w.ready || !move.conflicts.has(w.key)) continue;
        if (mine === undefined || w.since < mine) return { id, inside: false };
      }
    }
    return undefined;
  }

  /** Stand in line at these boxes (once at their mouth), so a stream
   *  through any of them lets this driver in its turn. */
  private join(m: Mover, group: Box[], ready: boolean) {
    if (group[0].sIn - m.head > 0.25 && m.speed > 0.03) return;
    const since = this.queue.get(group[0].cell)?.get(m.id)?.since ?? this.clock;
    for (const b of group) {
      const line = this.queue.get(b.cell) ?? new Map();
      line.set(m.id, { key: b.key, since, ready, seen: this.clock });
      this.queue.set(b.cell, line);
    }
  }

  private claimBox(m: Mover, b: Box) {
    const who = this.inJunction.get(b.cell) ?? new Map<number, string>();
    who.set(m.id, b.key);
    this.inJunction.set(b.cell, who);
    m.blocks.add(`j:${b.key}`);
    b.claimed = true;
    for (const line of this.queue.values()) line.delete(m.id);
  }

  /** The speed this driver is happy to cruise at here: its own pace, less
   *  for a bend ahead (sooner for a tight one) and over a bridge. */
  private cruise(m: Mover) {
    let v0 = m.max;
    let start = m.offset;
    for (const st of m.steps) {
      const end = start + st.edge.length;
      if (end > m.head && start < m.head + 0.45) {
        const seg = st.edge.seg;
        if (seg.lift !== 'flat') v0 = Math.min(v0, m.max * 0.88);
        if (seg.shape.type === 'bend') {
          const r = laneRadius(st);
          const bend = Math.sqrt(BEND_GRIP * r);
          const d = Math.max(0, start - m.head);
          v0 = Math.min(v0, Math.sqrt(bend * bend + 1.4 * IDM_BRAKE * d));
        }
      }
      start = end;
    }
    return Math.max(0.05, v0);
  }

  /** The speed of the vehicle ahead along this driver's way (0 when it
   *  crosses, stands or turns). */
  private leadSpeed(m: Mover, lead: Mover | undefined) {
    if (!lead || lead.turn || lead.wait > 0 || lead.kind !== m.kind) return 0;
    const body = this.bodies.get(lead.id)?.[0];
    if (!body) return 0;
    const dx = body.a.x - body.b.x,
      dz = body.a.z - body.b.z;
    const l = Math.hypot(dx, dz);
    if (l < 1e-6) return 0;
    const here = this.at(m, m.head);
    const dot = (dx * here.tx + dz * here.tz) / l;
    return dot > 0.3 ? lead.speed * dot : 0;
  }

  /** A street vehicle's step: choose the way ahead, get into the next
   *  junction box when it is its turn, then follow the car in front (or
   *  come to the box's mouth) smoothly. */
  private drive(m: Mover, dt: number) {
    const heavy = m.cars[0].length > 0.22;
    const A = heavy ? 0.13 : m.cars[0].length > 0.175 ? 0.17 : 0.2;
    // Look far enough ahead that a free junction never makes anyone brake.
    const horizon =
      0.25 + m.speed * HEADWAY + (m.speed * m.speed) / (2 * IDM_BRAKE) + 0.12;
    m.why = undefined;
    m.boxes ??= [];
    let guard = 0;
    while (
      this.stepsEnd(m) - m.head < horizon &&
      !m.boxes.some((b) => !b.claimed) &&
      guard++ < 4
    ) {
      const tail = m.steps[m.steps.length - 1];
      const node = this.endNode(tail);
      if (node.startsWith('x:')) break;
      if (m.served === node) break;
      const plan = this.intent(m, node, tail.edge);
      if (!plan) {
        m.why = 'no way';
        break;
      }
      let start = this.stepsEnd(m);
      for (const st of plan) {
        const move = this.exclusive(ROAD, st.edge)
          ? this.moves.get(moveKey(st.edge, st.dir))
          : undefined;
        if (move && move.inAt >= 0)
          m.boxes.push({
            key: move.key,
            cell: move.cell,
            sIn: start + move.inAt,
            sOut: start + move.outAt,
            claimed: false,
          });
        start += st.edge.length;
      }
      if (plan.some((st) => this.exclusive(ROAD, st.edge)))
        // Out of the stem it called at: it may call there again later.
        m.served = undefined;
      m.steps.push(...plan);
      m.intent = undefined;
    }
    // The next box ahead: in when it is this driver's turn and there is
    // room beyond. Boxes too close together to stand between go as one.
    const at = m.boxes.findIndex((b) => !b.claimed);
    if (at >= 0 && m.boxes[at].sIn - m.head < horizon) {
      const group = [m.boxes[at]];
      for (let k = at + 1; k < m.boxes.length; k++) {
        const gap = m.boxes[k].sIn - m.boxes[k - 1].sOut;
        if (gap >= this.length(m) + GAP + 0.04) break;
        group.push(m.boxes[k]);
      }
      const first = group[0];
      let go = true;
      // Behind another car, wait until it is in the box itself: a queued
      // car must not take the junction from the car in front.
      if (this.clearAhead(m) < first.sIn - m.head + 0.02) {
        const lead = m.waitingFor;
        if (lead === undefined || !this.inJunction.get(first.cell)?.has(lead)) {
          m.why = 'behind';
          go = false;
        }
      }
      if (go) {
        const yieldTo = this.giveWay(m, group);
        if (yieldTo) {
          m.waitingFor = yieldTo.id;
          m.why = yieldTo.inside ? 'crossing' : 'first come';
          this.join(m, group, true);
          go = false;
        } else if (!this.landing(m, group[group.length - 1])) {
          const why = m.waitingFor;
          this.join(m, group, false);
          m.waitingFor = why;
          m.why = 'no room beyond';
          go = false;
        }
      }
      if (go) for (const b of group) this.claimBox(m, b);
    }
    const last = m.steps[m.steps.length - 1];
    const end = this.endNode(last);
    const leaving = end.startsWith('x:');
    const ways = leaving ? 1 : this.usableWays(m, end, last.edge).length;
    const terminal = !leaving && (this.stations.has(end) || !ways);
    // Stop where the trail ends (short of a station's steps, before the
    // barrier at a dead end) or at the mouth of a box not yet ours.
    let stopAt = leaving
      ? Infinity
      : this.stepsEnd(m) -
        (terminal ? this.stopShort(ROAD, end, m.cars[0]) : 0.12);
    const box = m.boxes.find((b) => !b.claimed);
    if (box) stopAt = Math.min(stopAt, box.sIn - 0.012);
    const yieldTo = m.waitingFor;
    m.waitingFor = undefined;
    const clear = this.clearAhead(m);
    const lead = this.movers.find((o) => o.id === m.waitingFor);
    m.waitingFor ??= yieldTo;
    // The intelligent driver model: free-road acceleration less the
    // interaction with whatever is ahead (the car in front, or the line).
    const v = m.speed;
    const v0 = this.cruise(m);
    const calm = 2 * Math.sqrt(A * IDM_BRAKE);
    let ratio = 0;
    if (stopAt < Infinity) {
      const s = Math.max(1e-4, stopAt - m.head + 0.008);
      const want = 0.008 + v * HEADWAY + (v * v) / calm;
      ratio = Math.max(ratio, (want / s) ** 2);
    }
    if (clear < Infinity) {
      const dv = v - this.leadSpeed(m, lead);
      const want = Math.max(0, GAP + v * HEADWAY + (v * dv) / calm);
      ratio = Math.max(ratio, (want / Math.max(1e-4, clear)) ** 2);
    }
    let a = A * (1 - (v / v0) ** 4 - ratio);
    // A stopped driver moves off a moment after the way clears.
    if (v < 0.01 && a > 0.02) {
      m.go ??= this.between(0.25, 0.65) * (heavy ? 1.3 : 1);
      m.go -= dt;
      if (m.go > 0) a = 0;
    } else if (v > 0.03) m.go = undefined;
    a = Math.max(-HARD, Math.min(A, a));
    m.speed = Math.max(0, v + a * dt);
    // Never into the car in front, never over the line.
    if (clear < Infinity)
      m.speed = Math.min(
        m.speed,
        Math.sqrt(2 * HARD * Math.max(0, clear - 0.015)),
      );
    m.head = Math.min(m.head + m.speed * dt, stopAt);
    if (m.why === undefined && box && m.head >= box.sIn - 0.05) m.why = 'box';

    if (leaving && m.head >= this.stepsEnd(m)) {
      m.dead = true;
      return;
    }
    // A street vehicle on its way out is gone once the picture has lost
    // it, rather than driving on through the old town.
    if (leaving && m.steps.length === 1 && m.steps[0].edge.exit) {
      const front = this.lanePoint(m, m.head);
      const back = this.lanePoint(m, m.head - this.length(m) - 0.02);
      if (
        this.opts.offscreen(front.x, front.z) &&
        this.opts.offscreen(back.x, back.z)
      ) {
        m.dead = true;
        return;
      }
    }
    const atStop = m.head >= stopAt - 0.003 && m.speed < 0.05;
    if (atStop && terminal && !box) {
      // At the station: people get out (and in); then it turns round.
      const station = this.stations.has(end);
      m.served = end;
      m.speed = 0;
      let wait = station ? this.between(1.6, 2.6) : this.between(0.2, 0.5);
      if (station) {
        m.call = { node: end, cell: nodeCell(end), station };
        wait = this.opts.arrive?.(m, nodeCell(end)) ?? wait;
      }
      m.wait = wait;
      m.pending = true;
      return;
    }
    // Held up: by the junction, or by the vehicle ahead.
    const yielding = lead && (lead.speed > 0.02 || lead.turn);
    m.held =
      m.speed < 0.02 && !yielding && (atStop || clear < Infinity)
        ? m.held + dt
        : 0;
    this.trimBehind(m);
  }

  /** Forget the trail and the holds the last car has left. */
  private trimBehind(m: Mover) {
    const back = m.head - this.length(m) - 0.03;
    while (m.steps.length > 1 && m.offset + m.steps[0].edge.length < back) {
      m.offset += m.steps[0].edge.length;
      m.steps.shift();
    }
    if (m.kind === ROAD) {
      // A junction box is let go as soon as the tail is out of it.
      const tail = m.head - this.length(m) - 0.01;
      m.boxes = (m.boxes ?? []).filter((b) => !(b.claimed && b.sOut < tail));
      this.release(
        m,
        new Set(m.boxes.filter((b) => b.claimed).map((b) => `j:${b.key}`)),
      );
      return;
    }
    const keep = new Set(
      m.steps
        .filter((s) => this.exclusive(m.kind, s.edge))
        .map((s) => this.key(m.kind, s.edge, s.dir)),
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
    m.boxes = [];
    m.turn = turn;
    m.speed = 0;
    m.held = 0;
    return true;
  }

  // ------------------------------------------------------------ the clock

  tick(dt: number, moving = true) {
    if (!this.net) return;
    if (moving) this.clock += dt;
    // Whoever has stopped waiting at a junction's mouth leaves its line.
    for (const line of this.queue.values())
      for (const [id, w] of line)
        if (this.clock - w.seen > 0.3) line.delete(id);
    if (moving) {
      this.spawnIn -= dt;
      if (this.spawnIn <= 0) {
        this.spawnIn = this.between(0.2, 0.45);
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

  /** Does traffic run on the network of this edge (a station's stub)? */
  servedAt(edgeId: string) {
    return !!this.compOf.get(edgeId)?.live;
  }

  /** Is a vehicle like this running on the network of this edge now? */
  runsAt(edgeId: string, like: (m: Mover) => boolean) {
    const comp = this.compOf.get(edgeId);
    return (
      !!comp?.live &&
      this.movers.some(
        (m) =>
          !m.dead &&
          m.dying === undefined &&
          like(m) &&
          this.compOf.get(m.steps[0].edge.id) === comp,
      )
    );
  }

  /** Called when a vehicle stops at a station; returns how long it stands. */
  onArrive(arrive: SimOptions['arrive']) {
    this.opts.arrive = arrive;
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

/** One way through a junction in one direction, as its lane runs. */
type Move = {
  key: string;
  cell: number;
  from: string;
  to: string;
  pts: { x: number; z: number }[];
  /** Movements whose lanes cross or merge with this one. */
  conflicts: Set<string>;
  length: number;
  /** The stretch of this movement (distances along it) where it crosses or
   *  merges with another: the box held while in it; -1 when it has none. */
  inAt: number;
  outAt: number;
};
/** A junction box on a street vehicle's trail, in trail distances. */
type Box = {
  key: string;
  cell: number;
  sIn: number;
  sOut: number;
  claimed: boolean;
};
const moveKey = (e: Edge, dir: 1 | -1) => `${e.id}/${dir}`;
/** The square of a station's centre node (`c:<cell>:<group>:<kind>`). */
const nodeCell = (node: string) => Number(node.split(':')[1]);

const radii = new Map<string, number>();
/** The radius a car's own lane takes round a bend: tighter turning right
 *  (the inside, as they drive on the right), wider turning left. */
function laneRadius(st: Step) {
  const k = moveKey(st.edge, st.dir);
  let r = radii.get(k);
  if (r !== undefined) return r;
  const a = pointAt(st.edge.seg, st.dir === 1 ? 0 : 1),
    b = pointAt(st.edge.seg, st.dir === 1 ? 1 : 0);
  const right = a.tx * b.tz - a.tz * b.tx > 0;
  r = 0.5 + (right ? -LANE : LANE);
  radii.set(k, r);
  return r;
}

/** A street that only leads to a dead end or a station. */
type Cul = {
  edges: Set<string>;
  /** Its far end: the station's centre, or where the street stops. */
  end: string;
  station: boolean;
  length: number;
};

type Comp = {
  kind: Route;
  edges: Edge[];
  length: number;
  gates: Edge[];
  /** The goods stations (their squares) this network serves. */
  stations: Set<number>;
  /** Runs off the board, or links two stations fed by a live network. */
  live: boolean;
};

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
