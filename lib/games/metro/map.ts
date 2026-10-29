/**
 * Metro's city: a grid of stations, each drawn as one of four shapes, set in
 * twelve districts on two banks of a river (Moon to the west, Sun to the
 * east). Guide lines run along every row and column, and along diagonal
 * avenues every third step. A section runs straight along a guide from a
 * station to the next station in that direction; it never passes through a
 * station. Everything below is worked out once from the layout strings.
 */
export type Shape = 'circle' | 'square' | 'triangle' | 'diamond';
export const SHAPES: Shape[] = ['circle', 'square', 'triangle', 'diamond'];
export type Side = 'moon' | 'sun';
export const SIDES: Side[] = ['moon', 'sun'];
/** The four line colours, by index: one a round, in each seat's own order. */
export const LINE_COUNT = 4;

export type Station = {
  id: number;
  x: number;
  y: number;
  shape: Shape;
  district: number;
  side: Side;
};
export type District = {
  id: number;
  /** Main districts hold several stations; outer ones are a single corner. */
  outer: boolean;
  side: Side;
  /** Grid points (x, y) inside, for drawing its plate. */
  points: [number, number][];
};
/** A guide-line hop between two neighbouring stations, a < b. */
export type Edge = {
  id: number;
  a: number;
  b: number;
  /** Empty grid points the hop passes over, as y * cols + x. */
  via: number[];
  /** Diagonal unit cells crossed: cell index * 2 + (0 for \, 1 for /). */
  diag: number[];
};
export type CityMap = {
  id: MapId;
  cols: number;
  rows: number;
  stations: Station[];
  districts: District[];
  /** Departure stations: starts[colour][0] on the Moon bank, [1] on the Sun. */
  starts: [number, number][];
  edges: Edge[];
  /** Edge ids touching each station. */
  adj: number[][];
  /** Edge ids each edge crosses. */
  crosses: number[][];
  /** Edge id for a station pair, keyed a * 1000 + b with a < b. */
  pair: Map<number, number>;
  /** Diagonal guide cells: '\\', '/', 'x' or ' ' per unit cell, row by row. */
  diagonals: string[];
};

export type MapId = 'city';
export const MAP_IDS: MapId[] = ['city'];

type Layout = {
  id: MapId;
  /** One string per row: '.' empty, o circle, s square, t triangle, d diamond. */
  stations: string[];
  /** One string per row: a letter per grid point naming its district;
   *  lower-case letters are the outer (single-station) districts. */
  districts: string[];
  /** Per colour: the Moon start then the Sun start, as [x, y]. */
  starts: [[number, number], [number, number]][];
  /** Which diagonals exist in unit cell (x, y). */
  diagonal: (x: number, y: number) => { down: boolean; up: boolean };
};

const shapeOf: Record<string, Shape> = {
  o: 'circle',
  s: 'square',
  t: 'triangle',
  d: 'diamond',
};

const DIRS: [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [-1, -1],
  [1, -1],
  [-1, 1],
];

export function buildMap(layout: Layout): CityMap {
  const rows = layout.stations.length;
  const cols = layout.stations[0].length;
  const half = cols / 2;
  const letters = [...new Set(layout.districts.join(''))].sort();
  const districts: District[] = letters.map((l, id) => ({
    id,
    outer: l === l.toLowerCase(),
    side: 'moon',
    points: [],
  }));
  const districtAt = (x: number, y: number) =>
    letters.indexOf(layout.districts[y][x]);
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < cols; x++) {
      const d = districts[districtAt(x, y)];
      d.points.push([x, y]);
      d.side = x < half ? 'moon' : 'sun';
    }
  const stations: Station[] = [];
  const at = new Map<number, number>();
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < cols; x++) {
      const ch = layout.stations[y][x];
      if (ch === '.') continue;
      const id = stations.length;
      stations.push({
        id,
        x,
        y,
        shape: shapeOf[ch],
        district: districtAt(x, y),
        side: x < half ? 'moon' : 'sun',
      });
      at.set(y * cols + x, id);
    }
  const diagonals: string[] = [];
  for (let y = 0; y < rows - 1; y++) {
    let row = '';
    for (let x = 0; x < cols - 1; x++) {
      const d = layout.diagonal(x, y);
      row += d.down && d.up ? 'x' : d.down ? '\\' : d.up ? '/' : ' ';
    }
    diagonals.push(row);
  }
  const hasDiag = (x: number, y: number, down: boolean) => {
    const ch = diagonals[y]?.[x];
    return ch === 'x' || ch === (down ? '\\' : '/');
  };
  const edges: Edge[] = [];
  const pair = new Map<number, number>();
  const adj: number[][] = stations.map(() => []);
  for (const s of stations)
    for (const [dx, dy] of DIRS) {
      let x = s.x,
        y = s.y;
      const via: number[] = [];
      const diag: number[] = [];
      for (;;) {
        const nx = x + dx,
          ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) break;
        if (dx && dy) {
          // The unit cell this diagonal step crosses, by its top-left corner.
          const cx = Math.min(x, nx),
            cy = Math.min(y, ny);
          const down = dx === dy;
          if (!hasDiag(cx, cy, down)) break;
          diag.push((cy * (cols - 1) + cx) * 2 + (down ? 0 : 1));
        }
        x = nx;
        y = ny;
        const hit = at.get(y * cols + x);
        if (hit === undefined) {
          via.push(y * cols + x);
          continue;
        }
        const a = Math.min(s.id, hit),
          b = Math.max(s.id, hit);
        if (!pair.has(a * 1000 + b)) {
          const id = edges.length;
          edges.push({ id, a, b, via, diag });
          pair.set(a * 1000 + b, id);
          adj[a].push(id);
          adj[b].push(id);
        }
        break;
      }
    }
  const crosses: number[][] = edges.map(() => []);
  for (let i = 0; i < edges.length; i++)
    for (let j = i + 1; j < edges.length; j++) {
      const e = edges[i],
        f = edges[j];
      const shareVia = e.via.some((p) => f.via.includes(p));
      // Opposite diagonals in one cell make an X.
      const x = e.diag.some((c) => f.diag.includes(c ^ 1));
      if (shareVia || x) {
        crosses[i].push(j);
        crosses[j].push(i);
      }
    }
  const starts = layout.starts.map(
    ([m, s]) =>
      [at.get(m[1] * cols + m[0])!, at.get(s[1] * cols + s[0])!] as [
        number,
        number,
      ],
  );
  return {
    id: layout.id,
    cols,
    rows,
    stations,
    districts,
    starts,
    edges,
    adj,
    crosses,
    pair,
    diagonals,
  };
}

export const edgeBetween = (m: CityMap, a: number, b: number) =>
  m.pair.get(Math.min(a, b) * 1000 + Math.max(a, b));

export const otherEnd = (m: CityMap, edge: number, from: number) =>
  m.edges[edge].a === from ? m.edges[edge].b : m.edges[edge].a;

/** Diagonal avenues every third step, one family each way. */
const avenues = (x: number, y: number) => ({
  down: (((x - y) % 3) + 3) % 3 === 0,
  up: (x + y) % 3 === 1,
});

const city: Layout = {
  id: 'city',
  stations: [
    'o.sd...d.s',
    '.s..t.o.o.',
    't..o.t.o.s',
    't.d.s.s.d.',
    '.t.d.d.t.o',
    't.o.o.t.t.',
    '.t.s.t.d.o',
    's.d...d.s.',
    '.s.o.o.d.t',
    'o.t...d.o.',
    '.d.d.s.s..',
    'd.s.o.s..t',
  ],
  // Each bank has four main districts in steps down the map, one outer
  // corner at each end; every main district holds all four shapes.
  districts: [
    'aNNNNPPPPb',
    'NNNNNPPPPP',
    'NNNNWPPPPP',
    'NWWWWQQQQQ',
    'WWWWWQQQQQ',
    'WWWWXQQQQR',
    'XXXXXRRRRR',
    'XXXXXRRRRR',
    'XXXYYRRRSS',
    'YYYYYSSSSS',
    'YYYYYSSSSS',
    'cYYYYSSSSd',
  ],
  // One start in each main district; each colour's pair shares a shape and
  // sits five to seven steps apart across the river.
  starts: [
    [
      [3, 2],
      [5, 8],
    ],
    [
      [4, 3],
      [7, 10],
    ],
    [
      [1, 6],
      [5, 2],
    ],
    [
      [1, 10],
      [8, 3],
    ],
  ],
  diagonal: avenues,
};

export const maps: Record<MapId, CityMap> = { city: buildMap(city) };
