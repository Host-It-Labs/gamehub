import type { RoadMap, RoadNode } from '../../../lib/games/diner/road.ts';
import { LEG_STOPS } from '../../../lib/games/diner/road.ts';

/**
 * Where everything stands on the campaign's road map (9 October 2026). Pure
 * numbers, no three.js, so the tests can check them.
 *
 * The road runs north (toward −z). Every column of the night's road (two
 * stops of a fork, or a boss) sits on one row; before each row the road
 * splits at a junction into one branch per stop, and the branches join again
 * at the next junction: a chain of diamonds. Units are metres at map scale.
 */
export const COLUMN = 34;
export const LANE_X = 9;
/** A stop's paved lot: drive into it to choose the stop. */
export const LOT_R = 4.6;
/** Half the width of the ground the truck may roam. */
export const ROAM_X = 23;

export type P2 = { x: number; z: number };

/** The column's place in the whole night: legs follow on from each other. */
export const columnIndex = (n: Pick<RoadNode, 'leg' | 'col'>) =>
  n.leg * LEG_STOPS + n.col;
export const columnZ = (g: number) => -g * COLUMN;
/** The junction where the road splits before column `g`. */
export const junction = (g: number): P2 => ({
  x: 0,
  z: columnZ(g) + COLUMN / 2,
});
/** Where a run's truck starts, south of the first junction. */
export const START: P2 = { x: 0, z: junction(0).z + 13 };

export function stopPoint(n: Pick<RoadNode, 'leg' | 'col' | 'lane'>): P2 {
  return { x: n.lane * LANE_X, z: columnZ(columnIndex(n)) };
}

/** A cubic Bézier sampled into points. */
function bezier(a: P2, b: P2, c: P2, d: P2, steps: number): P2[] {
  const out: P2[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    out.push({
      x:
        u * u * u * a.x +
        3 * u * u * t * b.x +
        3 * u * t * t * c.x +
        t * t * t * d.x,
      z:
        u * u * u * a.z +
        3 * u * u * t * b.z +
        3 * u * t * t * c.z +
        t * t * t * d.z,
    });
  }
  return out;
}

/** The road from a junction to a stop (or on from a stop to a junction). */
export function branch(from: P2, to: P2, steps = 24): P2[] {
  const dz = to.z - from.z;
  return bezier(
    from,
    { x: from.x, z: from.z + dz * 0.42 },
    { x: to.x, z: to.z - dz * 0.42 },
    to,
    steps,
  );
}

export type RoadPiece = {
  /** Centre line, south to north. */
  points: P2[];
  /** The piece leads into (or out of) this stop. */
  stop: string | null;
  /** Column of the stop it serves, or of the junction it leaves from. */
  column: number;
};

/**
 * Every piece of road for the legs built so far: from the start to the first
 * junction, each junction to each stop of its column and each stop to the
 * next junction, and a straight run out past the last column.
 */
export function roadPieces(map: RoadMap): RoadPiece[] {
  const pieces: RoadPiece[] = [];
  const columns = map.legs.flatMap((leg) =>
    Array.from({ length: LEG_STOPS }, (_, col) =>
      leg.nodes.filter((n) => n.col === col),
    ),
  );
  pieces.push({ points: [START, junction(0)], stop: null, column: 0 });
  columns.forEach((nodes, g) => {
    for (const n of nodes) {
      const p = stopPoint(n);
      pieces.push({ points: branch(junction(g), p), stop: n.id, column: g });
      pieces.push({
        points: branch(p, junction(g + 1)),
        stop: n.id,
        column: g,
      });
    }
  });
  const last = junction(columns.length);
  pieces.push({
    points: [last, { x: 0, z: last.z - COLUMN * 1.5 }],
    stop: null,
    column: columns.length,
  });
  return pieces;
}

/**
 * Where the truck may roam while choosing the stops of column `g`: from just
 * north of where it is parked to just short of the column's far side.
 */
export function roamBand(g: number) {
  const south = g === 0 ? START.z + 6 : columnZ(g - 1) + 7;
  const north = columnZ(g) - 8;
  return { south, north, west: -ROAM_X, east: ROAM_X };
}

/** The stop whose lot contains this point, among the given ones. */
export function lotAt(nodes: readonly RoadNode[], p: P2): RoadNode | null {
  let best: RoadNode | null = null;
  let bestD = LOT_R;
  for (const n of nodes) {
    const s = stopPoint(n);
    const d = Math.hypot(s.x - p.x, s.z - p.z);
    if (d < bestD) {
      bestD = d;
      best = n;
    }
  }
  return best;
}

/** Distance from a point to a polyline. */
export function distanceToLine(points: readonly P2[], p: P2) {
  let best = Infinity;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i],
      b = points[i + 1];
    const dx = b.x - a.x,
      dz = b.z - a.z;
    const len2 = dx * dx + dz * dz || 1;
    const t = Math.max(
      0,
      Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / len2),
    );
    best = Math.min(best, Math.hypot(a.x + dx * t - p.x, a.z + dz * t - p.z));
  }
  return best;
}
