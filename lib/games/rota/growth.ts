import type { MapDef } from './maps.ts';
import { networks, sheet, type Placed } from './board.ts';
import { DX, DY, RAIL, RIVER, ROAD, pieces, type Route } from './pieces.ts';
import {
  cellCentre,
  pieceSegments,
  pointAt,
  segLength,
  stationHalf,
  type Segment,
} from './routes.ts';
import {
  HIDE_PER_HEIGHT,
  PLATFORM_OUT,
  STREET_HALF,
  STREET_SETBACK,
  TRACK_CLEAR,
  TRACK_SETBACK,
} from './scale.ts';

/**
 * The town that grows round what a player builds (3 October 2026).
 * Terraced houses line every street, mills, warehouses and sheds every
 * track, civic buildings the centre; corners take a pub or a corner shop.
 * The busier a network (the more exits it links), the grander its
 * buildings. Nothing stands on a route or leaves its own square, and a
 * building is never so tall that it hides a route or an empty square from
 * the camera: it steps down to a cottage instead. Pure and deterministic:
 * a square's buildings come from its piece and its neighbours, so placing
 * a piece elsewhere never reshuffles them. When the match is over the
 * empty squares fill in too (parks, allotments, more streets of houses).
 *
 * Board coordinates, as in routes.ts: square (col, row) spans
 * [col, col + 1] × [row, row + 1], x east, z south.
 */

export type Lot = {
  /** Model name (assets: town.glb, works.glb). */
  name: string;
  x: number;
  z: number;
  /** Turn about y: the model's front (+z at 0) faces the route. */
  rot: number;
  cell: number;
};

type Model = { w: number; d: number; h: number };
/** Footprints (along the frontage, depth) and heights from the brief. */
export const MODELS: Record<string, Model> = {
  terrace_a: { w: 0.2, d: 0.26, h: 0.33 },
  terrace_b: { w: 0.2, d: 0.26, h: 0.33 },
  terrace_tall: { w: 0.2, d: 0.26, h: 0.44 },
  cottage: { w: 0.2, d: 0.22, h: 0.22 },
  shop: { w: 0.2, d: 0.26, h: 0.31 },
  lockup: { w: 0.2, d: 0.2, h: 0.13 },
  corner_pub: { w: 0.26, d: 0.26, h: 0.33 },
  corner_shop: { w: 0.24, d: 0.24, h: 0.31 },
  town_hall: { w: 0.5, d: 0.38, h: 0.72 },
  market_hall: { w: 0.5, d: 0.34, h: 0.34 },
  chapel: { w: 0.3, d: 0.4, h: 0.4 },
  bank: { w: 0.26, d: 0.26, h: 0.32 },
  school: { w: 0.46, d: 0.3, h: 0.34 },
  mill_big: { w: 0.8, d: 0.34, h: 0.66 },
  mill_small: { w: 0.42, d: 0.3, h: 0.44 },
  warehouse_rail: { w: 0.42, d: 0.28, h: 0.35 },
  works_shed: { w: 0.3, d: 0.24, h: 0.22 },
  coal_drops: { w: 0.3, d: 0.16, h: 0.12 },
  engine_shed: { w: 0.46, d: 0.3, h: 0.26 },
  water_tower: { w: 0.12, d: 0.12, h: 0.32 },
  chimney: { w: 0.08, d: 0.08, h: 1.0 },
  allotment: { w: 0.4, d: 0.4, h: 0.06 },
  bandstand: { w: 0.16, d: 0.16, h: 0.13 },
  yard_wall: { w: 0.2, d: 0.012, h: 0.045 },
  privy: { w: 0.045, d: 0.045, h: 0.055 },
  gas_lamp: { w: 0.012, d: 0.012, h: 0.14 },
};

/** Mulberry32. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Corridor half-widths kept clear round each kind of route. */
const CLEAR: Record<number, number> = {
  [ROAD]: STREET_HALF + 0.004,
  [RAIL]: TRACK_CLEAR,
  [RIVER]: 0.2,
};
/** What must stay in view of each route: its middle, where the traffic
 *  runs (the near pavement may hide behind a low building). */
const CORE: Record<number, number> = {
  [ROAD]: 0.05,
  [RAIL]: 0.04,
  [RIVER]: 0.1,
};
const SETBACK: Record<number, number> = {
  [ROAD]: STREET_SETBACK,
  [RAIL]: TRACK_SETBACK,
  [RIVER]: 0.205,
};

type Rect = { x: number; z: number; rot: number; w: number; d: number };

/** Sample points over a footprint (corners, edges, middle). */
function footprintPoints(r: Rect) {
  const c = Math.cos(r.rot),
    s = Math.sin(r.rot);
  const out: { x: number; z: number }[] = [];
  const nu = Math.max(2, Math.ceil(r.w / 0.04)),
    nv = Math.max(2, Math.ceil(r.d / 0.04));
  for (let i = 0; i <= nu; i++)
    for (let j = 0; j <= nv; j++) {
      const u = (i / nu - 0.5) * r.w,
        v = (j / nv - 0.5) * r.d;
      // Local x along the frontage, z out of the front (+z faces the route).
      out.push({ x: r.x + u * c + v * s, z: r.z - u * s + v * c });
    }
  return out;
}

type Geo =
  | { arc: false; ax: number; az: number; dx: number; dz: number; l2: number }
  | {
      arc: true;
      ax: number;
      az: number;
      bx: number;
      bz: number;
      cx: number;
      cz: number;
      mx: number;
      mz: number;
    };
const geoCache = new WeakMap<Segment, Geo>();
function geo(seg: Segment): Geo {
  let g = geoCache.get(seg);
  if (g) return g;
  const a = pointAt(seg, 0),
    b = pointAt(seg, 1);
  if (seg.shape.type === 'bend') {
    // A quarter circle of radius one half about the square's corner.
    const cx = a.x + b.x - seg.at.x,
      cz = a.z + b.z - seg.at.z;
    const mx = seg.at.x - cx,
      mz = seg.at.z - cz;
    const ml = Math.hypot(mx, mz);
    g = {
      arc: true,
      ax: a.x,
      az: a.z,
      bx: b.x,
      bz: b.z,
      cx,
      cz,
      mx: mx / ml,
      mz: mz / ml,
    };
  } else {
    const dx = b.x - a.x,
      dz = b.z - a.z;
    g = { arc: false, ax: a.x, az: a.z, dx, dz, l2: dx * dx + dz * dz || 1 };
  }
  geoCache.set(seg, g);
  return g;
}

const len2 = (x: number, z: number) => Math.sqrt(x * x + z * z);

/** Distance from a point to a segment's centre line. */
function segDistance(seg: Segment, x: number, z: number) {
  return geoDistance(geo(seg), x, z);
}
function geoDistance(g: Geo, x: number, z: number) {
  if (g.arc) {
    const vx = x - g.cx,
      vz = z - g.cz;
    const d = len2(vx, vz);
    if (d > 1e-9 && (vx * g.mx + vz * g.mz) / d >= Math.SQRT1_2 - 1e-9)
      return Math.abs(d - 0.5);
    return Math.min(len2(x - g.ax, z - g.az), len2(x - g.bx, z - g.bz));
  }
  const t = Math.max(
    0,
    Math.min(1, ((x - g.ax) * g.dx + (z - g.az) * g.dz) / g.l2),
  );
  return len2(x - (g.ax + g.dx * t), z - (g.az + g.dz * t));
}

const CORNERS = [
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, 1],
] as const;

/** Raster of the board, 50 to a square, for the height limits. */
const RES = 50;

type Square = {
  cell: number;
  placed: Placed;
  segs: Segment[];
  centre: { x: number; z: number };
  /** Half the station building's footprint, if any. */
  shed: number;
};

export type GrowthInput = {
  map: MapDef;
  cells: readonly (Placed | null)[];
  rubble?: readonly number[];
  /** Mill sites (the Mills extension, id `towns`). */
  towns?: readonly number[];
  /** The match is over: the empty squares fill in too. */
  finished?: boolean;
};

export function growTown(input: GrowthInput): Lot[] {
  const { map, cells } = input;
  const n = map.size;
  const rubble = new Set(input.rubble ?? []);
  const towns = new Set(input.towns ?? []);
  const centre = new Set(map.centre);
  const squares = new Map<number, Square>();
  cells.forEach((c, cell) => {
    if (!c) return;
    const at = cellCentre(map, cell);
    squares.set(cell, {
      cell,
      placed: c,
      segs: pieceSegments(c.p, c.o, at),
      centre: at,
      shed: pieces[c.p].station ? stationHalf(c.p) : 0,
    });
  });

  // How grand each square's network is: the exits it links.
  const grand = new Map<number, number>();
  const sh = sheet(map, cells as (Placed | null)[], [...rubble], [...towns]);
  for (const net of networks(sh))
    for (const c of net.cells)
      grand.set(c, Math.max(grand.get(c) ?? 0, net.exits.length));
  const level = (cell: number) => {
    const g = grand.get(cell) ?? 0;
    return g >= 4 ? 2 : g >= 2 ? 1 : 0;
  };

  // Rasters of the board, 50 to a square: where the routes (with their
  // pavements and clearances) run, and their middles.
  const N = n * RES;
  const route = new Uint8Array(N * N);
  const core = new Uint8Array(N * N);
  const stamp = (
    x0: number,
    z0: number,
    x1: number,
    z1: number,
    test: (x: number, z: number) => void,
  ) => {
    const c0 = Math.max(0, Math.floor(x0 * RES)),
      c1 = Math.min(N - 1, Math.ceil(x1 * RES)),
      r0 = Math.max(0, Math.floor(z0 * RES)),
      r1 = Math.min(N - 1, Math.ceil(z1 * RES));
    for (let row = r0; row <= r1; row++)
      for (let col = c0; col <= c1; col++)
        test((col + 0.5) / RES, (row + 0.5) / RES);
  };
  for (const sq of squares.values()) {
    const { x, z } = sq.centre;
    for (const seg of sq.segs) {
      const clear = CLEAR[seg.kind],
        mid = CORE[seg.kind];
      const g = geo(seg);
      stamp(
        x - 0.5 - clear,
        z - 0.5 - clear,
        x + 0.5 + clear,
        z + 0.5 + clear,
        (px, pz) => {
          const d = geoDistance(g, px, pz);
          const k = Math.floor(pz * RES) * N + Math.floor(px * RES);
          if (d < clear) route[k] = 1;
          if (d < mid) core[k] = 1;
        },
      );
    }
    if (sq.shed) {
      stamp(x - sq.shed, z - sq.shed, x + sq.shed, z + sq.shed, (px, pz) => {
        route[Math.floor(pz * RES) * N + Math.floor(px * RES)] = 1;
      });
      // The side platforms along each of its tracks.
      for (const seg of sq.segs) {
        if (seg.kind !== RAIL || seg.shape.type !== 'stub') continue;
        const d = seg.shape.a;
        const ax = DX[d],
          az = DY[d];
        const near = sq.shed,
          far = 0.5;
        const x0 =
            x + Math.min(ax * near, ax * far) - Math.abs(az) * PLATFORM_OUT,
          x1 = x + Math.max(ax * near, ax * far) + Math.abs(az) * PLATFORM_OUT,
          z0 = z + Math.min(az * near, az * far) - Math.abs(ax) * PLATFORM_OUT,
          z1 = z + Math.max(az * near, az * far) + Math.abs(ax) * PLATFORM_OUT;
        stamp(x0, z0, x1, z1, (px, pz) => {
          route[Math.floor(pz * RES) * N + Math.floor(px * RES)] = 1;
        });
      }
    }
  }
  const at = (x: number, z: number) =>
    Math.min(N - 1, Math.max(0, Math.floor(z * RES))) * N +
    Math.min(N - 1, Math.max(0, Math.floor(x * RES)));
  /** Is a board point on a route or its pavements (or a shed)? */
  const onRoute = (x: number, z: number) => route[at(x, z)] === 1;
  /** Squares still open to build on. */
  const open = Array.from(
    { length: n * n },
    (_, cell) =>
      !cells[cell] &&
      !map.sea.includes(cell) &&
      !rubble.has(cell) &&
      !map.peaks.includes(cell),
  );
  // What must stay in view: the middle of every route, and the squares
  // still open (the southern third of one may be overlooked). For each raster
  // point, how far north is clear of them.
  const north = new Float32Array(N * N);
  for (let col = 0; col < N; col++) {
    let free = 0.9 * RES;
    const sqCol = Math.floor(col / RES);
    for (let row = 0; row < N; row++) {
      north[row * N + col] = free;
      const sqRow = Math.floor(row / RES);
      // An open square may be overlooked along its southern edge.
      const blocks =
        core[row * N + col] === 1 ||
        (open[sqRow * n + sqCol] && row - sqRow * RES < RES * 0.65);
      free = blocks ? 0 : free + 1;
    }
  }
  /** The tallest a building may be here without hiding what lies behind
   *  it (north, away from the camera). */
  const tallest = (r: Rect) => {
    let free = Infinity;
    for (const p of footprintPoints(r)) {
      const col = Math.min(N - 1, Math.max(0, Math.floor(p.x * RES))),
        row = Math.min(N - 1, Math.max(0, Math.floor(p.z * RES)));
      free = Math.min(free, north[row * N + col] / RES);
    }
    return free / HIDE_PER_HEIGHT;
  };

  const out: Lot[] = [];
  for (const sq of squares.values()) {
    if (map.peaks.includes(sq.cell)) continue;
    out.push(...growSquare(sq));
  }
  if (input.finished)
    for (let cell = 0; cell < n * n; cell++)
      if (
        !cells[cell] &&
        !map.sea.includes(cell) &&
        !rubble.has(cell) &&
        !map.peaks.includes(cell)
      )
        out.push(...fillEmpty(cell));
  return out;

  // ------------------------------------------------------------ one square

  function growSquare(sq: Square): Lot[] {
    const r = rng(sq.cell * 7919 + sq.placed.o * 131 + sq.placed.p.length * 17);
    const lots: Lot[] = [];
    const taken: Rect[] = [];
    const x0 = sq.centre.x - 0.5,
      z0 = sq.centre.z - 0.5;
    const inSquare = (p: { x: number; z: number }) =>
      p.x > x0 + 0.004 &&
      p.x < x0 + 0.996 &&
      p.z > z0 + 0.004 &&
      p.z < z0 + 0.996;
    const fits = (rect: Rect) => {
      const c = Math.cos(rect.rot),
        sn = Math.sin(rect.rot);
      // Inside the square: its four corners are.
      for (const [i, j] of CORNERS) {
        const u = (i * rect.w) / 2,
          v = (j * rect.d) / 2;
        if (
          !inSquare({ x: rect.x + u * c + v * sn, z: rect.z - u * sn + v * c })
        )
          return false;
      }
      // Off the routes, sampled every 0.03.
      const nu = Math.max(2, Math.ceil(rect.w / 0.03)),
        nv = Math.max(2, Math.ceil(rect.d / 0.03));
      for (let a = 0; a <= nu; a++)
        for (let b = 0; b <= nv; b++) {
          const u = (a / nu - 0.5) * rect.w,
            v = (b / nv - 0.5) * rect.d;
          if (onRoute(rect.x + u * c + v * sn, rect.z - u * sn + v * c))
            return false;
        }
      const rad = Math.hypot(rect.w, rect.d) / 2;
      for (const t of taken)
        if (
          Math.hypot(t.x - rect.x, t.z - rect.z) <
            rad + Math.hypot(t.w, t.d) / 2 &&
          overlap(rect, t)
        )
          return false;
      return true;
    };
    const lvl = level(sq.cell);
    const isCentre = centre.has(sq.cell);
    const mill = towns.has(sq.cell);
    const put = (name: string, rect: Rect) => {
      taken.push(rect);
      lots.push({ name, x: rect.x, z: rect.z, rot: rect.rot, cell: sq.cell });
    };
    /** The first of `names` that fits here and is low enough. */
    const tryPut = (names: string[], at: (m: Model) => Rect) => {
      for (const name of names) {
        const m = MODELS[name];
        const rect = at(m);
        if (!fits(rect)) continue;
        if (m.h > tallest(rect) + 0.005) continue;
        put(name, rect);
        return m;
      }
      return null;
    };

    // Corners where routes meet or bend take a pub, a corner shop or a
    // shed, its chamfered door towards the meeting.
    const kinds = new Set(sq.segs.map((s) => s.kind));
    const meets =
      sq.segs.some((s) => s.shape.type === 'bend' || s.junction) ||
      sq.shed > 0 ||
      sq.placed.p === 'overpass';
    for (const [sx, sz] of meets
      ? [
          [-1, -1],
          [1, -1],
          [-1, 1],
          [1, 1],
        ]
      : []) {
      const streets = kinds.has(ROAD) && !kinds.has(RAIL) && !sq.shed;
      const roll = r();
      const names = streets
        ? isCentre
          ? roll < 0.4
            ? ['bank', 'corner_shop', 'cottage']
            : ['corner_shop', 'corner_pub', 'bank', 'cottage']
          : roll < 0.5
            ? ['corner_pub', 'corner_shop', 'cottage']
            : ['corner_shop', 'corner_pub', 'cottage']
        : roll < 0.15 && !lots.some((l) => l.name === 'water_tower')
          ? ['water_tower']
          : roll < 0.6
            ? ['works_shed', 'coal_drops']
            : ['coal_drops', 'works_shed'];
      tryPut(names, (m) => {
        const h = Math.max(m.w, m.d) / 2 + 0.006;
        return {
          x: sq.centre.x + sx * (0.5 - h),
          z: sq.centre.z + sz * (0.5 - h),
          rot: cornerTurn(sx, sz),
          w: m.w,
          d: m.d,
        };
      });
    }

    // Frontage along each route, on both sides.
    for (const seg of sq.segs) {
      if (seg.kind !== ROAD && seg.kind !== RAIL && seg.kind !== RIVER)
        continue;
      const len = segLength(seg.shape);
      for (const side of [-1, 1]) {
        const choice = r();
        const rows = (): string[] => {
          if (seg.kind === ROAD) {
            if (isCentre)
              return choice < 0.3
                ? [
                    'town_hall',
                    'market_hall',
                    'chapel',
                    'shop',
                    'terrace_a',
                    'cottage',
                  ]
                : choice < 0.6
                  ? [
                      'market_hall',
                      'chapel',
                      'school',
                      'shop',
                      'terrace_b',
                      'cottage',
                    ]
                  : [
                      'chapel',
                      'school',
                      'bank',
                      'shop',
                      'terrace_a',
                      'cottage',
                    ];
            if (lvl === 2)
              return choice < 0.6
                ? ['terrace_tall', 'terrace_a', 'cottage']
                : ['terrace_a', 'shop', 'terrace_b', 'cottage'];
            if (lvl === 1)
              return choice < 0.75
                ? ['terrace_a', 'terrace_b', 'cottage']
                : ['shop', 'terrace_b', 'cottage'];
            return choice < 0.7 ? ['cottage', 'lockup'] : ['lockup', 'cottage'];
          }
          if (seg.kind === RAIL) {
            if (mill || lvl === 2)
              return [
                'mill_big',
                'mill_small',
                'warehouse_rail',
                'engine_shed',
                'works_shed',
                'coal_drops',
              ];
            if (lvl === 1)
              return choice < 0.5
                ? ['mill_small', 'warehouse_rail', 'works_shed', 'coal_drops']
                : ['warehouse_rail', 'engine_shed', 'works_shed', 'coal_drops'];
            return choice < 0.5
              ? ['works_shed', 'coal_drops']
              : ['coal_drops', 'works_shed'];
          }
          // A mill race: works beside the river.
          return ['mill_small', 'works_shed', 'lockup'];
        };
        const names = rows();
        let s = 0.002;
        let alt = choice < 0.5;
        while (s < len - 0.05) {
          let placed: Model | null = null;
          // Terraces alternate their doors along a row.
          const pool = names.map((nm) =>
            nm === 'terrace_a' && alt
              ? 'terrace_b'
              : nm === 'terrace_b' && alt
                ? 'terrace_a'
                : nm,
          );
          placed = tryPut(pool, (m) => frontage(seg, side, s, m, len));
          if (placed) {
            alt = !alt;
            // A mill's chimney stands behind it, where there is room.
            const last = lots[lots.length - 1];
            if (last.name.startsWith('mill_') && r() < 0.8)
              tryPut(['chimney'], () =>
                behind(seg, side, s, MODELS[last.name], len),
              );
            s += placed.w;
          } else s += 0.04;
        }
      }
    }

    // Gas lamps along the pavements of a street.
    for (const seg of sq.segs) {
      if (seg.kind !== ROAD || seg.shape.type === 'stub') continue;
      const len = segLength(seg.shape);
      for (const [t, side] of [
        [0.25, 1],
        [0.75, -1],
      ]) {
        const p = pointAt(seg, t);
        const off = STREET_HALF - 0.02;
        const x = p.x - p.tz * off * side,
          z = p.z + p.tx * off * side;
        if (!inSquare({ x, z })) continue;
        // Not out in a crossing's carriageway.
        let ok = true;
        for (const o of sq.segs)
          if (
            o !== seg &&
            o.kind === ROAD &&
            segDistance(o, x, z) < STREET_HALF - 0.04
          )
            ok = false;
        if (ok && len > 0.5)
          lots.push({ name: 'gas_lamp', x, z, rot: 0, cell: sq.cell });
      }
    }
    return lots;
  }

  /** A lot fronting a route at distance `s` along it, on one side. */
  function frontage(
    seg: Segment,
    side: number,
    s: number,
    m: Model,
    len: number,
  ): Rect {
    const mid = Math.min(len, s + m.w / 2);
    const p = pointAt(seg, mid / len);
    // Right of travel is (−tz, tx).
    const nx = -p.tz * side,
      nz = p.tx * side;
    const off = SETBACK[seg.kind] + m.d / 2;
    return {
      x: p.x + nx * off,
      z: p.z + nz * off,
      // The front (+z) faces back towards the route.
      rot: Math.atan2(-nx, -nz),
      w: m.w,
      d: m.d,
    };
  }

  /** Behind a building fronting a route: a chimney's yard. */
  function behind(
    seg: Segment,
    side: number,
    s: number,
    b: Model,
    len: number,
  ): Rect {
    const c = MODELS.chimney;
    const p = pointAt(seg, Math.min(1, (s + b.w * 0.8) / len));
    const nx = -p.tz * side,
      nz = p.tx * side;
    const off = SETBACK[seg.kind] + b.d + c.d / 2 + 0.01;
    return { x: p.x + nx * off, z: p.z + nz * off, rot: 0, w: c.w, d: c.d };
  }

  /** An empty square at the end of the match: a park, allotments or a
   *  block of houses round a yard. */
  function fillEmpty(cell: number): Lot[] {
    const r = rng(cell * 4241 + 77);
    const at = cellCentre(map, cell);
    const roll = r();
    const lots: Lot[] = [];
    if (roll < 0.35) {
      lots.push({
        name: 'allotment',
        x: at.x - 0.22,
        z: at.z - 0.22,
        rot: 0,
        cell,
      });
      lots.push({
        name: 'allotment',
        x: at.x + 0.22,
        z: at.z + 0.22,
        rot: Math.PI / 2,
        cell,
      });
      lots.push({ name: 'privy', x: at.x + 0.3, z: at.z - 0.3, rot: 0, cell });
    } else if (roll < 0.6) {
      lots.push({
        name: 'bandstand',
        x: at.x,
        z: at.z,
        rot: r() * Math.PI,
        cell,
      });
      for (const [dx, dz] of [
        [-0.32, -0.32],
        [0.32, -0.3],
        [-0.3, 0.32],
        [0.3, 0.3],
      ])
        lots.push({
          name: r() < 0.5 ? 'oak_a' : 'oak_b',
          x: at.x + dx,
          z: at.z + dz,
          rot: r() * 6,
          cell,
        });
    } else {
      // Back-to-back houses facing out on all four sides, low enough not
      // to hide their northern neighbours.
      for (let side = 0; side < 4; side++)
        for (let k = 0; k < 4; k++) {
          const u = -0.3 + k * 0.2;
          const v = 0.5 - 0.13;
          const [x, z, rot] =
            side === 0
              ? [at.x + u, at.z - v, Math.PI]
              : side === 1
                ? [at.x + v, at.z + u, Math.PI / 2]
                : side === 2
                  ? [at.x - u, at.z + v, 0]
                  : [at.x - v, at.z - u, -Math.PI / 2];
          if ((side === 1 || side === 3) && (k === 0 || k === 3)) continue;
          lots.push({
            name: side === 0 ? 'cottage' : 'terrace_a',
            x,
            z,
            rot,
            cell,
          });
        }
    }
    return lots;
  }
}

/** The turn that points a corner building's chamfered door (its model's
 *  −x, +z corner) at the middle of a square from its (sx, sz) corner. */
function cornerTurn(sx: number, sz: number) {
  if (sx > 0) return sz > 0 ? -Math.PI / 2 : 0;
  return sz > 0 ? Math.PI : Math.PI / 2;
}

/** Do two footprints overlap (separating axes)? */
function overlap(a: Rect, b: Rect) {
  const axes = (r: Rect) => [
    { x: Math.cos(r.rot), z: -Math.sin(r.rot) },
    { x: Math.sin(r.rot), z: Math.cos(r.rot) },
  ];
  const corners = (r: Rect) => {
    const [u, v] = axes(r);
    return [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ].map(([i, j]) => ({
      x: r.x + (u.x * i * r.w) / 2 + (v.x * j * r.d) / 2,
      z: r.z + (u.z * i * r.w) / 2 + (v.z * j * r.d) / 2,
    }));
  };
  const ca = corners(a),
    cb = corners(b);
  for (const ax of [...axes(a), ...axes(b)]) {
    const pa = ca.map((p) => p.x * ax.x + p.z * ax.z);
    const pb = cb.map((p) => p.x * ax.x + p.z * ax.z);
    if (
      Math.max(...pa) <= Math.min(...pb) + 1e-6 ||
      Math.max(...pb) <= Math.min(...pa) + 1e-6
    )
      return false;
  }
  return true;
}

export type { Route };
