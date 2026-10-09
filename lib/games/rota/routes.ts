import type { MapDef } from './maps.ts';
import type { Placed } from './board.ts';
import {
  DX,
  DY,
  RAIL,
  RIVER,
  ROAD,
  orient,
  pieces,
  type PieceId,
  type Route,
} from './pieces.ts';
import {
  CUTTING_DEPTH,
  GOODS_HALF,
  GRAND_HALF,
  OVERPASS_RISE,
  RAMP,
  STATION_STEPS,
} from './scale.ts';

/**
 * Rota's routes as geometry: where each piece's streets, tracks and rivers
 * run inside its square, how high their surface is, and the network the
 * trains and lorries drive on. Pure and shared by the 3D board (which
 * sweeps its meshes along these paths and seats its vehicles on the same
 * heights) and the tests.
 *
 * Coordinates are in squares on the ground plane: x runs east and z south,
 * the board's top-left corner is (0, 0) and square (col, row) spans
 * [col, col + 1] × [row, row + 1]. Directions are the pieces' own: 0 north
 * (-z), 1 east (+x), 2 south (+z), 3 west (-x).
 */

export type Vec = { x: number; z: number };

/** Side midpoints of a square centred on the origin. */
const MID: Vec[] = [
  { x: 0, z: -0.5 },
  { x: 0.5, z: 0 },
  { x: 0, z: 0.5 },
  { x: -0.5, z: 0 },
];

export type Shape =
  /** From side `a` straight across to the opposite side. */
  | { type: 'straight'; a: number }
  /** A quarter circle from side `a` to the adjacent side `b`. */
  | { type: 'bend'; a: number; b: number }
  /** From side `a` to the middle of the square. */
  | { type: 'stub'; a: number }
  /** A straight run off the board: from `from` towards `dir`, `length` long. */
  | { type: 'line'; from: Vec; dir: number; length: number };

/** How a segment leaves the ground: an overpass road climbing over the
 *  rail, the rail sinking into its cutting beneath, a bridge over a river. */
export type Lift = 'flat' | 'overpass' | 'cutting' | 'bridge';

export type Segment = {
  kind: Route;
  shape: Shape;
  /** The square's centre on the ground plane (unused for lines). */
  at: Vec;
  /** Raised over another route or sunk beneath it. */
  lift: Lift;
  /** Part of a junction of three or more sides of one kind. */
  junction: boolean;
  /** Ends at a station building in the middle of the square. */
  station: boolean;
};

export const segLength = (s: Shape) =>
  s.type === 'straight'
    ? 1
    : s.type === 'bend'
      ? Math.PI / 4
      : s.type === 'stub'
        ? 0.5
        : s.length;

export const BRIDGE_HEIGHT = 0.035;
/**
 * The one height profile of every route surface, relative to the ground, at
 * `t` along a segment. The meshes are swept on it and the vehicles ride on
 * it, so nothing sinks into a deck. An overpass is a flat-topped bridge:
 * smooth ramps over the outer `RAMP` of the square at each end and a level
 * deck across the cutting in the middle, where the rail runs as far below.
 */
export function liftAt(lift: Lift, t: number) {
  if (lift === 'flat') return 0;
  if (lift === 'bridge') {
    const c = Math.sin(Math.PI * t);
    return BRIDGE_HEIGHT * c * c;
  }
  const k = Math.min(1, Math.min(t, 1 - t) / RAMP);
  const s = k * k * (3 - 2 * k);
  if (!s) return 0;
  return lift === 'overpass' ? OVERPASS_RISE * s : -CUTTING_DEPTH * s;
}
/** Slope of the surface (height per unit along the path) at `t`. */
export function slopeAt(lift: Lift, t: number, length: number) {
  const e = 1e-3;
  return (
    (liftAt(lift, Math.min(1, t + e)) - liftAt(lift, Math.max(0, t - e))) /
    ((Math.min(1, t + e) - Math.max(0, t - e)) * length)
  );
}
/** Half a station building's footprint: its stubs stop at the walls. */
export const stationHalf = (p: PieceId) =>
  p === 'station-cross' ? GRAND_HALF : GOODS_HALF;
/** How far from a station's centre a stub of each kind ends: a track at
 *  the platform bank, a street at the foot of the station steps. */
export const stubEnd = (half: number, kind: Route) =>
  kind === ROAD ? half + STATION_STEPS : half;

/** Point and unit tangent at `t` (0–1) along a shape, in board coordinates. */
export function pointAt(seg: Pick<Segment, 'shape' | 'at'>, t: number) {
  const s = seg.shape;
  if (s.type === 'line')
    return {
      x: s.from.x + DX[s.dir] * s.length * t,
      z: s.from.z + DY[s.dir] * s.length * t,
      tx: DX[s.dir],
      tz: DY[s.dir],
    };
  const { at } = seg;
  if (s.type === 'straight' || s.type === 'stub') {
    const a = MID[s.a];
    const b = s.type === 'stub' ? { x: 0, z: 0 } : MID[(s.a + 2) % 4];
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    return {
      x: at.x + a.x + (b.x - a.x) * t,
      z: at.z + a.z + (b.z - a.z) * t,
      tx: (b.x - a.x) / len,
      tz: (b.z - a.z) / len,
    };
  }
  // A bend: a quarter circle of radius one half about the shared corner.
  const a = MID[s.a],
    b = MID[s.b];
  const c = { x: a.x + b.x, z: a.z + b.z };
  const a0 = Math.atan2(a.z - c.z, a.x - c.x);
  let a1 = Math.atan2(b.z - c.z, b.x - c.x);
  let d = a1 - a0;
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  a1 = a0 + d * t;
  const sign = Math.sign(d);
  return {
    x: at.x + c.x + Math.cos(a1) * 0.5,
    z: at.z + c.z + Math.sin(a1) * 0.5,
    tx: -Math.sin(a1) * sign,
    tz: Math.cos(a1) * sign,
  };
}

export const cellCentre = (map: Pick<MapDef, 'size'>, cell: number): Vec => ({
  x: (cell % map.size) + 0.5,
  z: Math.floor(cell / map.size) + 0.5,
});

/** The carried route of an overpass or a bridge. */
export const upperOf = (p: PieceId): Route | null =>
  p === 'overpass' || p === 'road-bridge'
    ? ROAD
    : p === 'rail-bridge'
      ? RAIL
      : null;

/** The segments a piece draws in its square. */
export function pieceSegments(p: PieceId, o: number, at: Vec): Segment[] {
  const t = orient(p, o);
  const def = pieces[p];
  const upper = upperOf(p);
  const out: Segment[] = [];
  for (const g of t.links) {
    const kinds = [...new Set(g.map((d) => t.edges[d]))];
    for (const kind of kinds) {
      const sides = g.filter((d) => t.edges[d] === kind);
      const lift: Lift =
        kind === upper
          ? p === 'overpass'
            ? 'overpass'
            : 'bridge'
          : p === 'overpass'
            ? 'cutting'
            : 'flat';
      const base = { kind, at, lift, junction: false, station: false };
      if (def.station || sides.length === 1) {
        for (const a of sides)
          out.push({
            ...base,
            shape: { type: 'stub', a },
            station: !!def.station,
          });
      } else if (sides.length === 2) {
        const [a, b] = sides;
        out.push({
          ...base,
          shape:
            (a + 2) % 4 === b
              ? { type: 'straight', a }
              : { type: 'bend', a, b },
        });
      } else if (sides.length === 4 && kind === RAIL) {
        // A rail cross: two lines crossing, no turns.
        for (const a of [sides[0], sides[1]])
          out.push({ ...base, junction: true, shape: { type: 'straight', a } });
      } else {
        // Three or four sides of one kind: every pair is a way through.
        for (let i = 0; i < sides.length; i++)
          for (let j = i + 1; j < sides.length; j++) {
            const a = sides[i],
              b = sides[j];
            out.push({
              ...base,
              junction: true,
              shape:
                (a + 2) % 4 === b
                  ? { type: 'straight', a }
                  : { type: 'bend', a, b },
            });
          }
      }
    }
  }
  return out;
}

/** How far the streets run off the board into the old town: past the
 *  frame's edge, where the traffic comes and goes unseen. */
export const EXIT_RUN = 9;
/** A railway exit runs into a tunnel mouth this far off the board ... */
export const TUNNEL_AT = 2.4;
/** ... and on inside it, where trains arrive and leave out of sight. */
export const RAIL_RUN = TUNNEL_AT + 1.4;
/** A pier (a wharf) reaches one square into the sea. */
export const PIER_RUN = 1;

/** The straight run off the board beyond each exit. */
export function exitSegments(map: MapDef): Segment[] {
  return map.exits.map((e) => {
    const c = cellCentre(map, e.cell);
    const from = { x: c.x + DX[e.dir] * 0.5, z: c.z + DY[e.dir] * 0.5 };
    return {
      kind: e.route,
      shape: {
        type: 'line',
        from,
        dir: e.dir,
        length: e.pier ? PIER_RUN : e.route === RAIL ? RAIL_RUN : EXIT_RUN,
      },
      at: c,
      lift: 'flat',
      junction: false,
      station: false,
    } satisfies Segment;
  });
}

// ---------------------------------------------------------------- network

/** One way along a segment between two nodes, for the vehicles. */
export type Edge = {
  id: string;
  seg: Segment;
  /** Node keys at t = 0 and t = 1. */
  a: string;
  b: string;
  length: number;
  /** Off the board: an exit's run, with `b` its far end. */
  exit?: { index: number; pier: boolean };
};

export type Net = {
  edges: Edge[];
  /** Edges touching each node. */
  at: Map<string, Edge[]>;
  /** Far ends of exit runs that join the board's routes. */
  gates: { node: string; edge: Edge; kind: Route; pier: boolean }[];
};

/** Key of the point on the side `d` of square `cell`, shared with its neighbour. */
function sideKey(map: MapDef, cell: number, d: number, kind: Route) {
  const x = cell % map.size,
    y = Math.floor(cell / map.size);
  // North and west sides belong to this square; south and east to the next.
  if (d === 2) return `h:${x}:${y + 1}:${kind}`;
  if (d === 1) return `v:${x + 1}:${y}:${kind}`;
  if (d === 0) return `h:${x}:${y}:${kind}`;
  return `v:${x}:${y}:${kind}`;
}

/** Ends of a segment as node keys. */
function ends(
  map: MapDef,
  cell: number,
  s: Segment,
  group: number,
): [string, string] {
  const sh = s.shape;
  if (sh.type === 'straight')
    return [
      sideKey(map, cell, sh.a, s.kind),
      sideKey(map, cell, (sh.a + 2) % 4, s.kind),
    ];
  if (sh.type === 'bend')
    return [sideKey(map, cell, sh.a, s.kind), sideKey(map, cell, sh.b, s.kind)];
  if (sh.type === 'stub')
    return [sideKey(map, cell, sh.a, s.kind), `c:${cell}:${group}:${s.kind}`];
  return ['', ''];
}

/** The drivable network: every placed piece plus the exits' runs. */
export function network(map: MapDef, cells: readonly (Placed | null)[]): Net {
  const edges: Edge[] = [];
  cells.forEach((c, cell) => {
    if (!c) return;
    const segs = pieceSegments(c.p, c.o, cellCentre(map, cell));
    segs.forEach((s, i) => {
      if (s.kind === RIVER) return;
      const [a, b] = ends(map, cell, s, 0);
      edges.push({
        id: `${cell}:${c.p}:${c.o}:${i}`,
        seg: s,
        a,
        b,
        length: segLength(s.shape),
      });
    });
  });
  const exitSegs = exitSegments(map);
  map.exits.forEach((e, i) => {
    edges.push({
      id: `x:${i}`,
      seg: exitSegs[i],
      a: sideKey(map, e.cell, e.dir, e.route),
      b: `x:${i}`,
      length: segLength(exitSegs[i].shape),
      exit: { index: i, pier: !!e.pier },
    });
  });
  const at = new Map<string, Edge[]>();
  const add = (k: string, e: Edge) => {
    const list = at.get(k);
    if (list) list.push(e);
    else at.set(k, [e]);
  };
  for (const e of edges) {
    add(e.a, e);
    add(e.b, e);
  }
  const gates: Net['gates'] = [];
  for (const e of edges)
    if (e.exit && (at.get(e.a)?.length ?? 0) > 1)
      gates.push({ node: e.b, edge: e, kind: e.seg.kind, pier: e.exit.pier });
  return { edges, at, gates };
}

/** The other end of an edge. */
export const across = (e: Edge, node: string) => (e.a === node ? e.b : e.a);
