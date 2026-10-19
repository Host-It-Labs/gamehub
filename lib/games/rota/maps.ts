import { RAIL, ROAD, type Dir } from './pieces.ts';

/**
 * Rota's survey sheets. Each map is a square grid with exits on its edges;
 * some maps add sea (no building) or peaks (only a straight tunnel). The
 * centre squares score one point each when built on.
 */
/** Capital remains readable in saved matches, but is never a new-game choice. */
export const SAVED_MAP_IDS = ['meadow', 'harbour', 'ridge', 'capital'] as const;
export type MapId = (typeof SAVED_MAP_IDS)[number];
export const MAP_IDS: readonly MapId[] = ['meadow', 'harbour', 'ridge'];
export const MAP_VERSION = 2;

export type Exit = {
  cell: number;
  /** The side of `cell` the exit leaves by. */
  dir: Dir;
  route: typeof ROAD | typeof RAIL;
  /** A pier into the sea rather than a road off the map. */
  pier?: boolean;
};

export type MapDef = {
  id: MapId;
  name: string;
  level: 'Beginner' | 'Intermediate' | 'Advanced';
  size: number;
  rounds: number;
  exits: Exit[];
  sea: number[];
  peaks: number[];
  centre: number[];
  /** Towns laid out at the start of a match with Towns. */
  towns: number;
};

const R = ROAD,
  L = RAIL;

/** Exits on all four sides, read clockwise from the top-left corner:
 * the top from left to right, the right from top to bottom, the bottom from
 * right to left and the left from bottom to top. */
function ring(
  size: number,
  at: number[],
  sides: (typeof R | typeof L)[][],
): Exit[] {
  const out: Exit[] = [];
  const last = size - 1;
  sides.forEach((routes, side) =>
    at.forEach((k, i) => {
      const route = routes[i];
      if (!route) return;
      const [x, y] =
        side === 0
          ? [k, 0]
          : side === 1
            ? [last, k]
            : side === 2
              ? [last - k, last]
              : [0, last - k];
      out.push({ cell: y * size + x, dir: side as Dir, route });
    }),
  );
  return out;
}

const square = (size: number, from: number, to: number) =>
  Array.from({ length: size * size }, (_, i) => i).filter((i) => {
    const x = i % size,
      y = Math.floor(i / size);
    return x >= from && x <= to && y >= from && y <= to;
  });

const at = (size: number, cells: [number, number][]) =>
  cells.map(([x, y]) => y * size + x);

/** Original geometry: unversioned saves must keep their original cell indices. */
export const legacyMaps: Record<MapId, MapDef> = {
  meadow: {
    id: 'meadow',
    name: 'Meadow',
    level: 'Beginner',
    size: 7,
    rounds: 7,
    exits: ring(
      7,
      [1, 3, 5],
      [
        [R, L, R],
        [L, R, L],
        [R, L, R],
        [L, R, L],
      ],
    ),
    sea: [],
    peaks: [],
    centre: square(7, 2, 4),
    towns: 3,
  },
  harbour: {
    id: 'harbour',
    name: 'Harbour',
    level: 'Intermediate',
    size: 7,
    rounds: 7,
    // The sea takes the lower-right corner; two piers reach into it.
    exits: [
      ...ring(7, [1, 3, 5], [[R, L, R], [L, R], [], [L, R, L]]),
      ...ring(7, [3, 5], [[], [], [L, R], []]),
      { cell: 4 * 7 + 5, dir: 1, route: R, pier: true },
      { cell: 5 * 7 + 4, dir: 2, route: L, pier: true },
    ],
    sea: at(7, [
      [6, 4],
      [6, 5],
      [6, 6],
      [5, 5],
      [5, 6],
      [4, 6],
    ]),
    peaks: [],
    centre: square(7, 2, 4),
    towns: 3,
  },
  ridge: {
    id: 'ridge',
    name: 'Ridge',
    level: 'Intermediate',
    size: 7,
    rounds: 7,
    exits: ring(
      7,
      [1, 3, 5],
      [
        [L, R, L],
        [R, L, R],
        [L, R, L],
        [R, L, R],
      ],
    ),
    sea: [],
    // A broken ridge runs from the top left to the bottom right.
    peaks: at(7, [
      [1, 2],
      [2, 1],
      [4, 5],
      [5, 4],
    ]),
    centre: square(7, 2, 4),
    towns: 3,
  },
  capital: {
    id: 'capital',
    name: 'Capital',
    level: 'Advanced',
    size: 8,
    rounds: 8,
    exits: ring(
      8,
      [1, 3, 4, 6],
      [
        [R, L, R, L],
        [L, R, L, R],
        [R, L, R, L],
        [L, R, L, R],
      ],
    ),
    sea: [],
    peaks: [],
    // The middle four by four without its corners.
    centre: square(8, 2, 5).filter((i) => ![18, 21, 42, 45].includes(i)),
    towns: 4,
  },
};

/** The three current maps grow with their match length. */
export const maps: Record<MapId, MapDef> = {
  ...legacyMaps,
  harbour: {
    id: 'harbour',
    name: 'Harbour',
    level: 'Intermediate',
    size: 9,
    rounds: 10,
    // A deep, stepped basin makes four distinct wharves along the east bank.
    exits: [
      ...ring(9, [1, 4, 7], [[R, L, R], [], [], [L, R, L]]),
      { cell: 8 * 9 + 1, dir: 2, route: R },
      { cell: 8 * 9 + 4, dir: 2, route: L },
      { cell: 3 * 9 + 7, dir: 1, route: R, pier: true },
      { cell: 4 * 9 + 6, dir: 1, route: L, pier: true },
      { cell: 5 * 9 + 5, dir: 1, route: R, pier: true },
      { cell: 7 * 9 + 6, dir: 0, route: L, pier: true },
    ],
    sea: at(9, [
      [8, 3],
      [7, 4],
      [8, 4],
      [6, 5],
      [7, 5],
      [8, 5],
      [6, 6],
      [7, 6],
      [8, 6],
      [7, 7],
      [8, 7],
      [8, 8],
    ]),
    peaks: [],
    centre: square(9, 3, 5),
    towns: 4,
  },
  ridge: {
    id: 'ridge',
    name: 'Ridge',
    level: 'Advanced',
    size: 10,
    rounds: 14,
    exits: ring(
      10,
      [1, 3, 6, 8],
      [
        [L, R, L, R],
        [R, L, R, L],
        [L, R, L, R],
        [R, L, R, L],
      ],
    ),
    sea: [],
    // Two broken rock bands frame the central valley; straight routes tunnel through.
    peaks: at(10, [
      [1, 2],
      [2, 1],
      [2, 3],
      [3, 2],
      [2, 4],
      [8, 7],
      [7, 8],
      [7, 6],
      [6, 7],
      [7, 5],
    ]),
    centre: square(10, 3, 6).filter((i) => ![33, 36, 63, 66].includes(i)),
    towns: 4,
  },
};

/** Squares a town may be laid on: inland, off the centre and the terrain. */
export function townSites(m: MapDef) {
  const last = m.size - 1;
  return Array.from({ length: m.size * m.size }, (_, i) => i).filter((i) => {
    const x = i % m.size,
      y = Math.floor(i / m.size);
    return (
      x > 0 &&
      y > 0 &&
      x < last &&
      y < last &&
      !m.centre.includes(i) &&
      !m.sea.includes(i) &&
      !m.peaks.includes(i)
    );
  });
}

/** Squares Rockfall may strike: open land without an exit, town or peak. */
export function rockfallSites(m: MapDef, towns: number[]) {
  const exitCells = new Set(m.exits.map((e) => e.cell));
  return Array.from({ length: m.size * m.size }, (_, i) => i).filter(
    (i) =>
      !exitCells.has(i) &&
      !m.sea.includes(i) &&
      !m.peaks.includes(i) &&
      !towns.includes(i),
  );
}
