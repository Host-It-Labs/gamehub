import type { CounterId } from './content.ts';

/**
 * The diner's floor plan, shared by the rules, the bots and the 3D view.
 * Units are metres-ish: x runs left to right (0..W), z from the back wall
 * (0) to the front edge (D), where the camera stands. The back counter holds
 * every station; the door is in the left wall near the front, the line of
 * waiting guests runs up the left wall, booths fill the middle.
 */
export const W = 11;
export const D = 11;
/** Front edge of the back counter; nobody walks behind it. */
export const COUNTER_Z = 1.4;
/** The low front rail; nobody walks past it. */
export const FRONT_Z = 10.75;
export const PLAYER_R = 0.3;
export const GUEST_R = 0.24;

/** Where guests come in and leave: just outside the door, and just inside. */
export const DOOR_OUT = { x: -0.8, z: 9.9 };
export const DOOR_IN = { x: 0.45, z: 9.9 };
/** The door's gap in the left wall. */
export const DOOR_GAP: [number, number] = [9.2, 10.6];

/** Counter spots along the back, left to right. */
export const COUNTER_X: Record<CounterId, number> = {
  grill: 1.3,
  fryer: 2.8,
  shake: 4.3,
  pie: 5.8,
  sink: 8.5,
  bin: 9.9,
};
/** Half the width of a counter spot you can reach. */
export const SPOT_HALF = 0.55;

export type TableSlot = { x: number; z: number; seats: 2 | 4 };
/** Booth slots: a chrome table between two mint benches. */
export const TABLES: TableSlot[] = [
  { x: 3.4, z: 4.5, seats: 2 },
  { x: 6.3, z: 4.5, seats: 4 },
  { x: 9.2, z: 4.5, seats: 4 },
  { x: 4.9, z: 7.9, seats: 2 },
  { x: 7.8, z: 7.9, seats: 4 },
];
/** Half extents of a whole booth (benches included). */
export const BOOTH_HX = 0.86;
export const boothHz = (seats: 2 | 4) => (seats === 2 ? 0.45 : 0.78);
/** Where a guest sits, relative to the table centre. */
export function seatOffset(seats: 2 | 4, i: number): [number, number] {
  const side = i % 2 === 0 ? -1 : 1;
  if (seats === 2) return [side * 0.62, 0];
  return [side * 0.62, i < 2 ? -0.36 : 0.36];
}

/** Queue spots for waiting parties, nearest the door first. */
export const QUEUE = [
  { x: 1.15, z: 9.15 },
  { x: 1.15, z: 7.55 },
  { x: 1.15, z: 5.95 },
];
/**
 * Where member `i` of a waiting party of `size` stands: side by side in one
 * row facing the room, so every outfit is in full view.
 */
export function queueSpot(
  slot: number,
  i: number,
  size: number,
): [number, number] {
  const q = QUEUE[slot];
  return [q.x + (i - (size - 1) / 2) * 0.5, q.z];
}

export const JUKEBOX = { x: 10.3, z: 10.15, r: 0.46 };
export const SPAWNS: [number, number][] = [
  [5.0, 2.4],
  [6.2, 2.4],
  [3.8, 2.4],
  [7.4, 2.4],
];

export type Rect = { x0: number; z0: number; x1: number; z1: number };
export type Circle = { x: number; z: number; r: number };
export type Obstacles = { rects: Rect[]; circles: Circle[] };

export function boothRect(t: TableSlot): Rect {
  const hz = boothHz(t.seats);
  return { x0: t.x - BOOTH_HX, z0: t.z - hz, x1: t.x + BOOTH_HX, z1: t.z + hz };
}

const cache = new Map<string, Obstacles>();
/** The solid things on the floor for a set of open tables. */
export function obstacles(tables: readonly number[]): Obstacles {
  const key = tables.join(',');
  let o = cache.get(key);
  if (!o) {
    o = {
      rects: tables.map((i) => boothRect(TABLES[i])),
      circles: [JUKEBOX],
    };
    cache.set(key, o);
  }
  return o;
}

/**
 * Moves a circle by (dx, dz) and pushes it out of everything solid. The
 * same code runs on the server and on your own device, so your waiter
 * moves the same in both places.
 */
export function slide(
  x: number,
  z: number,
  dx: number,
  dz: number,
  r: number,
  o: Obstacles,
): [number, number] {
  let nx = x + dx;
  let nz = z + dz;
  for (let pass = 0; pass < 3; pass++) {
    for (const b of o.rects) {
      const cx = Math.max(b.x0, Math.min(nx, b.x1));
      const cz = Math.max(b.z0, Math.min(nz, b.z1));
      const ex = nx - cx;
      const ez = nz - cz;
      const d2 = ex * ex + ez * ez;
      if (d2 >= r * r) continue;
      if (d2 > 1e-9) {
        const d = Math.sqrt(d2);
        nx = cx + (ex / d) * r;
        nz = cz + (ez / d) * r;
      } else {
        // Inside: leave by the nearest side.
        const left = nx - b.x0,
          right = b.x1 - nx,
          back = nz - b.z0,
          front = b.z1 - nz;
        const m = Math.min(left, right, back, front);
        if (m === left) nx = b.x0 - r;
        else if (m === right) nx = b.x1 + r;
        else if (m === back) nz = b.z0 - r;
        else nz = b.z1 + r;
      }
    }
    for (const c of o.circles) {
      const ex = nx - c.x;
      const ez = nz - c.z;
      const d2 = ex * ex + ez * ez;
      const min = c.r + r;
      if (d2 >= min * min || d2 < 1e-9) continue;
      const d = Math.sqrt(d2);
      nx = c.x + (ex / d) * min;
      nz = c.z + (ez / d) * min;
    }
    nx = Math.max(r, Math.min(W - r, nx));
    nz = Math.max(COUNTER_Z + r, Math.min(FRONT_Z - r, nz));
  }
  return [nx, nz];
}

/** Distance from a point to a rectangle (0 inside). */
export function rectDistance(x: number, z: number, b: Rect) {
  const ex = Math.max(b.x0 - x, 0, x - b.x1);
  const ez = Math.max(b.z0 - z, 0, z - b.z1);
  return Math.sqrt(ex * ex + ez * ez);
}

/** Distance from a point to a counter spot's reachable edge. */
export function spotDistance(x: number, z: number, id: CounterId) {
  const cx = COUNTER_X[id];
  return rectDistance(x, z, {
    x0: cx - SPOT_HALF,
    x1: cx + SPOT_HALF,
    z0: COUNTER_Z,
    z1: COUNTER_Z,
  });
}

// ---------------------------------------------------------------- paths

const CELL = 0.25;
const COLS = Math.round(W / CELL);
const ROWS = Math.round(D / CELL);
type Grid = { free: Uint8Array };
const grids = new Map<string, Grid>();

function gridFor(tables: readonly number[], r: number): Grid {
  const key = `${tables.join(',')}|${r}`;
  let g = grids.get(key);
  if (g) return g;
  const o = obstacles(tables);
  const free = new Uint8Array(COLS * ROWS);
  for (let row = 0; row < ROWS; row++)
    for (let col = 0; col < COLS; col++) {
      const x = (col + 0.5) * CELL;
      const z = (row + 0.5) * CELL;
      let ok = x >= r && x <= W - r && z >= COUNTER_Z + r && z <= FRONT_Z - r;
      for (const b of o.rects) if (ok && rectDistance(x, z, b) < r) ok = false;
      for (const c of o.circles)
        if (ok && Math.hypot(x - c.x, z - c.z) < c.r + r) ok = false;
      free[row * COLS + col] = ok ? 1 : 0;
    }
  g = { free };
  grids.set(key, g);
  return g;
}

const cellOf = (x: number, z: number) => [
  Math.max(0, Math.min(COLS - 1, Math.floor(x / CELL))),
  Math.max(0, Math.min(ROWS - 1, Math.floor(z / CELL))),
];

function nearestFree(g: Grid, col: number, row: number) {
  if (g.free[row * COLS + col]) return row * COLS + col;
  for (let ring = 1; ring < 12; ring++)
    for (let dr = -ring; dr <= ring; dr++)
      for (let dc = -ring; dc <= ring; dc++) {
        if (Math.max(Math.abs(dr), Math.abs(dc)) !== ring) continue;
        const c = col + dc,
          rr = row + dr;
        if (c < 0 || rr < 0 || c >= COLS || rr >= ROWS) continue;
        if (g.free[rr * COLS + c]) return rr * COLS + c;
      }
  return -1;
}

function clear(g: Grid, ax: number, az: number, bx: number, bz: number) {
  const steps = Math.ceil(Math.hypot(bx - ax, bz - az) / (CELL * 0.5));
  for (let i = 1; i < steps; i++) {
    const [c, r] = cellOf(
      ax + ((bx - ax) * i) / steps,
      az + ((bz - az) * i) / steps,
    );
    if (!g.free[r * COLS + c]) return false;
  }
  return true;
}

/**
 * A walkable route between two floor points around the booths, as a few
 * straight legs (the start point is not included; the end point is).
 * Deterministic, so the server and every device find the same one.
 */
export function route(
  tables: readonly number[],
  from: [number, number],
  to: [number, number],
  r = GUEST_R,
): [number, number][] {
  const g = gridFor(tables, r);
  const [sc, sr] = cellOf(...from);
  const [tc, tr] = cellOf(...to);
  const start = nearestFree(g, sc, sr);
  const goal = nearestFree(g, tc, tr);
  if (start < 0 || goal < 0 || clear(g, from[0], from[1], to[0], to[1]))
    return [to];
  const prev = new Int32Array(COLS * ROWS).fill(-1);
  prev[start] = start;
  const queue = new Int32Array(COLS * ROWS);
  let head = 0,
    tail = 0;
  queue[tail++] = start;
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ];
  while (head < tail) {
    const cur = queue[head++];
    if (cur === goal) break;
    const c = cur % COLS,
      rr = (cur - c) / COLS;
    for (const [dc, dr] of dirs) {
      const nc = c + dc,
        nr = rr + dr;
      if (nc < 0 || nr < 0 || nc >= COLS || nr >= ROWS) continue;
      const n = nr * COLS + nc;
      if (prev[n] >= 0 || !g.free[n]) continue;
      // No cutting corners past a blocked cell.
      if (dc && dr && (!g.free[rr * COLS + nc] || !g.free[nr * COLS + c]))
        continue;
      prev[n] = cur;
      queue[tail++] = n;
    }
  }
  if (prev[goal] < 0) return [to];
  const cells: [number, number][] = [];
  for (let at = goal; at !== start; at = prev[at]) {
    const c = at % COLS;
    cells.push([(c + 0.5) * CELL, ((at - c) / COLS + 0.5) * CELL]);
  }
  cells.reverse();
  // Pull the string: keep only the corners the straight line cannot skip.
  const points: [number, number][] = [];
  let ax = from[0],
    az = from[1];
  for (let i = 0; i < cells.length; i++) {
    const next = cells[i + 1] ?? to;
    if (!clear(g, ax, az, next[0], next[1])) {
      points.push(cells[i]);
      [ax, az] = cells[i];
    }
  }
  points.push(to);
  return points;
}
