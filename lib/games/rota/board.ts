import type { MapDef } from './maps.ts';
import {
  DX,
  DY,
  NONE,
  RAIL,
  RIVER,
  ROAD,
  opposite,
  orient,
  orientations,
  pieces,
  type PieceId,
  type Route,
} from './pieces.ts';

/**
 * One player's sheet: placement legality, loose ends, networks and the
 * longest routes. Everything here is pure and shared by the engine, the
 * table, the score sheet and the bots.
 */
export type Placed = {
  p: PieceId;
  o: number;
  /** The round it was drawn in. */
  r: number;
};

export type Sheet = {
  map: MapDef;
  cells: (Placed | null)[];
  /** Squares that take no piece: sea on the map, rubble from Rockfall. */
  blocked: Uint8Array;
  /** Route of the exit at `cell * 4 + dir`, or 0. */
  exits: Uint8Array;
  /** Town squares (Towns), which take only a junction piece. */
  towns: Uint8Array | null;
};

const exitCache = new WeakMap<MapDef, Uint8Array>();
export function exitTable(map: MapDef) {
  let t = exitCache.get(map);
  if (!t) {
    t = new Uint8Array(map.size * map.size * 4);
    for (const e of map.exits) t[e.cell * 4 + e.dir] = e.route;
    exitCache.set(map, t);
  }
  return t;
}

export function sheet(
  map: MapDef,
  cells: (Placed | null)[],
  rubble: readonly number[] = [],
  towns: readonly number[] = [],
): Sheet {
  const blocked = new Uint8Array(map.size * map.size);
  for (const i of map.sea) blocked[i] = 1;
  for (const i of rubble) blocked[i] = 1;
  let t: Uint8Array | null = null;
  if (towns.length) {
    t = new Uint8Array(map.size * map.size);
    for (const i of towns) t[i] = 1;
  }
  return { map, cells, blocked, exits: exitTable(map), towns: t };
}

/** Copies a sheet with new cells, keeping its rubble and towns. */
export const withCells = (s: Sheet, cells: (Placed | null)[]): Sheet => ({
  ...s,
  cells,
});

export const emptyCells = (map: MapDef): (Placed | null)[] =>
  Array.from({ length: map.size * map.size }, () => null);

export function neighbour(map: MapDef, cell: number, d: number) {
  const x = (cell % map.size) + DX[d],
    y = Math.floor(cell / map.size) + DY[d];
  if (x < 0 || y < 0 || x >= map.size || y >= map.size) return -1;
  return y * map.size + x;
}

export function edgesAt(s: Sheet, cell: number) {
  const c = s.cells[cell];
  return c ? orient(c.p, c.o).edges : null;
}

/** Where a side of a square leads: an exit, a matching neighbour, open ground, or nothing usable. */
function sideState(s: Sheet, cell: number, d: number, e: Route) {
  const ex = s.exits[cell * 4 + d];
  if (ex) return ex === e ? 'joined' : 'clash';
  const n = neighbour(s.map, cell, d);
  if (n < 0 || s.blocked[n]) return 'edge';
  const t = s.cells[n];
  if (!t) return 'open';
  const f = orient(t.p, t.o).edges[opposite(d)];
  if (f === NONE) return 'open';
  return f === e ? 'joined' : 'clash';
}

/** A piece may go on an empty, buildable square when it joins something
 * (an exit, a matching route, or for a river the edge of the map or the sea)
 * and no side of it meets a different kind of route. Peaks take only a
 * straight road or rail. */
export function canPlace(s: Sheet, id: PieceId, o: number, cell: number) {
  if (cell < 0 || cell >= s.cells.length || s.cells[cell] || s.blocked[cell])
    return false;
  if (s.map.peaks.includes(cell) && !pieces[id].tunnel) return false;
  if (s.towns?.[cell] && !pieces[id].junction) return false;
  const edges = orient(id, o).edges;
  let joined = false;
  for (let d = 0; d < 4; d++) {
    const e = edges[d];
    const ex = s.exits[cell * 4 + d];
    const n = neighbour(s.map, cell, d);
    const t = n >= 0 ? s.cells[n] : null;
    if (e === NONE) continue;
    if (ex) {
      if (ex !== e) return false;
      joined = true;
      continue;
    }
    if (n < 0 || s.blocked[n]) {
      if (e === RIVER) joined = true;
      continue;
    }
    if (!t) continue;
    const f = orient(t.p, t.o).edges[opposite(d)];
    if (f === NONE) continue;
    if (f !== e) return false;
    joined = true;
  }
  return joined;
}

export type Spot = { cell: number; o: number };

export function placements(s: Sheet, id: PieceId): Spot[] {
  const out: Spot[] = [];
  const os = orientations(id);
  for (let cell = 0; cell < s.cells.length; cell++) {
    if (s.cells[cell] || s.blocked[cell]) continue;
    for (const o of os) if (canPlace(s, id, o, cell)) out.push({ cell, o });
  }
  return out;
}

export function canPlaceAnywhere(s: Sheet, id: PieceId) {
  const os = orientations(id);
  for (let cell = 0; cell < s.cells.length; cell++) {
    if (s.cells[cell] || s.blocked[cell]) continue;
    for (const o of os) if (canPlace(s, id, o, cell)) return true;
  }
  return false;
}

/** Every loose road or rail end: it runs into open ground, the map edge
 * away from an exit, the sea, rubble or a blank side. River ends never
 * count. */
export function looseEnds(s: Sheet): { cell: number; dir: number }[] {
  const out: { cell: number; dir: number }[] = [];
  s.cells.forEach((c, cell) => {
    if (!c) return;
    const edges = orient(c.p, c.o).edges;
    for (let d = 0; d < 4; d++) {
      const e = edges[d];
      if (e !== ROAD && e !== RAIL) continue;
      if (sideState(s, cell, d, e) !== 'joined') out.push({ cell, dir: d });
    }
  });
  return out;
}

export type Network = {
  cells: number[];
  /** Indices into `map.exits`. */
  exits: number[];
};

/** Road and rail networks. Stations join the two; overpasses and bridges
 * keep their crossings apart; rivers are not networks. */
export function networks(s: Sheet): Network[] {
  const n = s.cells.length;
  // A node per (square, link group) that carries road or rail.
  const nodeOf = new Int32Array(n * 4).fill(-1);
  const nodeCell: number[] = [];
  s.cells.forEach((c, cell) => {
    if (!c) return;
    const t = orient(c.p, c.o);
    for (const g of t.links) {
      if (!g.some((d) => t.edges[d] === ROAD || t.edges[d] === RAIL)) continue;
      const id = nodeCell.length;
      nodeCell.push(cell);
      for (const d of g) nodeOf[cell * 4 + d] = id;
    }
  });
  const parent = nodeCell.map((_, i) => i);
  const find = (a: number): number => {
    while (parent[a] !== a) a = parent[a] = parent[parent[a]];
    return a;
  };
  for (let cell = 0; cell < n; cell++) {
    const c = s.cells[cell];
    if (!c) continue;
    const edges = orient(c.p, c.o).edges;
    for (const d of [1, 2]) {
      const e = edges[d];
      if (e !== ROAD && e !== RAIL) continue;
      const m = neighbour(s.map, cell, d);
      if (m < 0 || !s.cells[m]) continue;
      const t = s.cells[m]!;
      if (orient(t.p, t.o).edges[opposite(d)] !== e) continue;
      const a = find(nodeOf[cell * 4 + d]),
        b = find(nodeOf[m * 4 + opposite(d)]);
      if (a !== b) parent[a] = b;
    }
  }
  const groups = new Map<number, Network>();
  nodeCell.forEach((cell, i) => {
    const r = find(i);
    let g = groups.get(r);
    if (!g) groups.set(r, (g = { cells: [], exits: [] }));
    if (!g.cells.includes(cell)) g.cells.push(cell);
  });
  s.map.exits.forEach((ex, i) => {
    const c = s.cells[ex.cell];
    if (!c) return;
    if (orient(c.p, c.o).edges[ex.dir] !== ex.route) return;
    const node = nodeOf[ex.cell * 4 + ex.dir];
    if (node < 0) return;
    const g = groups.get(find(node))!;
    if (!g.exits.includes(i)) g.exits.push(i);
  });
  return [...groups.values()];
}

/** Adjacency of squares joined by one kind of route. */
function routeGraph(s: Sheet, kind: Route) {
  const adj: number[][] = s.cells.map(() => []);
  const has: boolean[] = s.cells.map(() => false);
  s.cells.forEach((c, cell) => {
    if (!c) return;
    const edges = orient(c.p, c.o).edges;
    if (edges.includes(kind)) has[cell] = true;
    for (const d of [1, 2]) {
      if (edges[d] !== kind) continue;
      const m = neighbour(s.map, cell, d);
      if (m < 0 || !s.cells[m]) continue;
      const t = s.cells[m]!;
      if (orient(t.p, t.o).edges[opposite(d)] !== kind) continue;
      adj[cell].push(m);
      adj[m].push(cell);
    }
  });
  return { adj, has };
}

/** Squares with a river side facing off the map or into the sea. */
function mouths(s: Sheet) {
  const out = new Set<number>();
  s.cells.forEach((c, cell) => {
    if (!c) return;
    const edges = orient(c.p, c.o).edges;
    for (let d = 0; d < 4; d++) {
      if (edges[d] !== RIVER) continue;
      const m = neighbour(s.map, cell, d);
      if (m < 0 || s.map.sea.includes(m)) out.add(cell);
    }
  });
  return out;
}

export type LongestPath = { length: number; cells: number[]; outlet?: boolean };

/**
 * The longest run of squares along one kind of route, each square once. It
 * is a search over simple paths, bounded by `budget` steps; the boards are
 * small enough that the bound only bites on contrived sheets, and then the
 * best path found so far stands.
 */
export function longest(
  s: Sheet,
  kind: Route,
  budget = 400_000,
): LongestPath {
  const { adj, has } = routeGraph(s, kind);
  const river = kind === RIVER;
  const mouth = river ? mouths(s) : null;
  // Components, so a search never beats its own component's size.
  const comp = new Int32Array(s.cells.length).fill(-1);
  const sizes: number[] = [];
  for (let i = 0; i < s.cells.length; i++) {
    if (!has[i] || comp[i] >= 0) continue;
    const id = sizes.length;
    let count = 0;
    const stack = [i];
    comp[i] = id;
    while (stack.length) {
      const a = stack.pop()!;
      count++;
      for (const b of adj[a])
        if (comp[b] < 0) {
          comp[b] = id;
          stack.push(b);
        }
    }
    sizes.push(count);
  }
  let best: LongestPath = { length: 0, cells: [] };
  const value = (len: number, outlet: boolean) => len + (outlet ? 3 : 0);
  const bestValue = () => value(best.length, !!best.outlet);
  const visited = new Uint8Array(s.cells.length);
  const path: number[] = [];
  let steps = 0;
  const walk = (a: number, startMouth: boolean) => {
    if (++steps > budget) return;
    visited[a] = 1;
    path.push(a);
    const outlet =
      river && path.length > 1 && startMouth && mouth!.has(a);
    if (value(path.length, outlet) > bestValue())
      best = { length: path.length, cells: [...path], outlet: river ? outlet : undefined };
    for (const b of adj[a]) if (!visited[b]) walk(b, startMouth);
    path.pop();
    visited[a] = 0;
  };
  // Leaves first: the longest path in a tree starts at one.
  const order = [...Array(s.cells.length).keys()]
    .filter((i) => has[i])
    .sort((a, b) => adj[a].length - adj[b].length);
  for (const i of order) {
    const cap = sizes[comp[i]] + (river ? 3 : 0);
    if (bestValue() >= cap) continue;
    if (steps > budget) break;
    walk(i, river ? mouth!.has(i) : false);
  }
  return best;
}

/** Squares with a station: road and rail joined in one square. */
export const stationCount = (s: Sheet) =>
  s.cells.filter((c) => c && pieces[c.p].station).length;

export const filled = (s: Sheet) => s.cells.filter(Boolean).length;

/** A quick lower bound on `longest` for the bots: the farthest pair found
 * by two breadth-first sweeps per component (exact on trees). */
export function quickLongest(s: Sheet, kind: Route): number {
  const n = s.cells.length;
  const size = s.map.size;
  const adj = new Int8Array(n * 4).fill(-1);
  const has = new Uint8Array(n);
  for (let cell = 0; cell < n; cell++) {
    const c = s.cells[cell];
    if (!c) continue;
    const edges = orient(c.p, c.o).edges;
    for (let d = 0; d < 4; d++) {
      if (edges[d] !== kind) continue;
      has[cell] = 1;
      const x = (cell % size) + DX[d],
        y = ((cell / size) | 0) + DY[d];
      if (x < 0 || y < 0 || x >= size || y >= size) continue;
      const m = y * size + x;
      const t = s.cells[m];
      if (t && orient(t.p, t.o).edges[(d + 2) % 4] === kind) adj[cell * 4 + d] = 1;
    }
  }
  const dist = new Int16Array(n);
  const queue = new Int16Array(n);
  const seen = new Uint8Array(n);
  const sweep = (from: number) => {
    dist.fill(-1);
    let head = 0,
      tail = 0,
      far = from;
    queue[tail++] = from;
    dist[from] = 0;
    while (head < tail) {
      const a = queue[head++];
      seen[a] = 1;
      if (dist[a] > dist[far]) far = a;
      for (let d = 0; d < 4; d++) {
        if (adj[a * 4 + d] < 0) continue;
        const b = a + (d === 0 ? -size : d === 1 ? 1 : d === 2 ? size : -1);
        if (dist[b] < 0) {
          dist[b] = dist[a] + 1;
          queue[tail++] = b;
        }
      }
    }
    return far;
  };
  let best = 0;
  for (let i = 0; i < n; i++) {
    if (!has[i] || seen[i]) continue;
    const a = sweep(i);
    const b = sweep(a);
    best = Math.max(best, dist[b] + 1);
  }
  return best;
}
