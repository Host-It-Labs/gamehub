import {
  filled,
  longest,
  looseEnds,
  networks,
  neighbour,
  stationCount,
  type Sheet,
} from './board.ts';
import { RAIL, RIVER, ROAD, orient } from './pieces.ts';

/**
 * Rota's scoring and its Plans. Networks score by the exits they link,
 * the longest road and rail score a point a square, filled centre squares a
 * point each, and every loose end costs one.
 */
export const exitPoints = (linked: number, total: number) =>
  linked < 2 ? 0 : 4 * (linked - 1) + (linked === total ? 4 : 0);

/** Ridge: a peak holding a straight is a tunnel. */
export const TUNNEL_POINTS = 2;
/** Towns: a built town scores a point per exit its network links, up to this. */
export const TOWN_CAP = 5;
/** Rivers: each square of the longest river. */
export const RIVER_POINTS = 2;
/** Rivers: a river that leaves the map at both ends. */
export const OUTLET_POINTS = 3;

export type PlanId =
  | 'across'
  | 'corners'
  | 'stations'
  | 'highway'
  | 'mainline'
  | 'row'
  | 'column'
  | 'loop'
  | 'half'
  | 'centre'
  | 'mixed'
  | 'tidy';

export type Plan = {
  id: PlanId;
  name: string;
  text: string;
  /** Points to whoever completes it in the first round anyone does. */
  first: number;
  /** Points for completing it in a later round. */
  later: number;
  /** Progress now, out of `of`. Done when `have >= of`. */
  progress: (s: Sheet) => { have: number; of: number };
};

/** The line closest to full: fewest squares missing, rubble spoils a line. */
const lineProgress = (s: Sheet, axis: 'row' | 'column') => {
  const n = s.map.size;
  let best = { have: 0, of: n };
  for (let k = 0; k < n; k++) {
    let have = 0,
      of = 0,
      spoiled = false;
    for (let j = 0; j < n; j++) {
      const cell = axis === 'row' ? k * n + j : j * n + k;
      if (s.map.sea.includes(cell)) continue;
      if (s.blocked[cell]) spoiled = true;
      of++;
      if (s.cells[cell]) have++;
    }
    if (!spoiled && of - have < best.of - best.have) best = { have, of };
  }
  return best;
};

const bestNetwork = (s: Sheet, value: (exits: number[]) => number) =>
  Math.max(0, ...networks(s).map((g) => value(g.exits)));

export const plans: Record<PlanId, Plan> = {
  across: {
    id: 'across',
    name: 'Across',
    text: 'One network links two exits on opposite sides.',
    first: 8,
    later: 4,
    progress: (s) => ({
      have: bestNetwork(s, (exits) => {
        const sides = new Set(exits.map((i) => s.map.exits[i].dir));
        return (sides.has(0) && sides.has(2)) || (sides.has(1) && sides.has(3))
          ? 1
          : 0;
      }),
      of: 1,
    }),
  },
  corners: {
    id: 'corners',
    name: 'Corners',
    text: 'Build on every corner square.',
    first: 8,
    later: 4,
    progress: (s) => {
      const n = s.map.size;
      const corners = [0, n - 1, n * (n - 1), n * n - 1].filter(
        (i) => !s.map.sea.includes(i),
      );
      return {
        have: corners.filter((i) => s.cells[i]).length,
        of: corners.length,
      };
    },
  },
  stations: {
    id: 'stations',
    name: 'Stations',
    text: 'Build three stations.',
    first: 7,
    later: 3,
    progress: (s) => ({ have: Math.min(3, stationCount(s)), of: 3 }),
  },
  highway: {
    id: 'highway',
    name: 'Highway',
    text: 'Build a road eight squares long.',
    first: 8,
    later: 4,
    progress: (s) => ({
      have: Math.min(8, longest(s, ROAD, 60_000).length),
      of: 8,
    }),
  },
  mainline: {
    id: 'mainline',
    name: 'Main line',
    text: 'Build a rail eight squares long.',
    first: 8,
    later: 4,
    progress: (s) => ({
      have: Math.min(8, longest(s, RAIL, 60_000).length),
      of: 8,
    }),
  },
  row: {
    id: 'row',
    name: 'Full row',
    text: 'Fill a whole row. Sea is left out; rubble spoils a row.',
    first: 9,
    later: 4,
    progress: (s) => lineProgress(s, 'row'),
  },
  column: {
    id: 'column',
    name: 'Full column',
    text: 'Fill a whole column. Sea is left out; rubble spoils a column.',
    first: 9,
    later: 4,
    progress: (s) => lineProgress(s, 'column'),
  },
  loop: {
    id: 'loop',
    name: 'Loop',
    text: 'Close a loop: a route that comes back to where it started.',
    first: 8,
    later: 4,
    progress: (s) => ({ have: hasLoop(s) ? 1 : 0, of: 1 }),
  },
  half: {
    id: 'half',
    name: 'Hub',
    text: 'One network links half of the exits.',
    first: 10,
    later: 5,
    progress: (s) => {
      const of = Math.ceil(s.map.exits.length / 2);
      return {
        have: Math.min(
          of,
          bestNetwork(s, (e) => e.length),
        ),
        of,
      };
    },
  },
  centre: {
    id: 'centre',
    name: 'Centre',
    text: 'Build on every centre square.',
    first: 8,
    later: 4,
    progress: (s) => ({
      have: s.map.centre.filter((i) => s.cells[i]).length,
      of: s.map.centre.length,
    }),
  },
  mixed: {
    id: 'mixed',
    name: 'Both lines',
    text: 'One network links two road exits and two rail exits.',
    first: 7,
    later: 3,
    progress: (s) => ({
      have: bestNetwork(s, (exits) => {
        const roads = exits.filter((i) => s.map.exits[i].route === ROAD).length,
          rails = exits.filter((i) => s.map.exits[i].route === RAIL).length;
        return Math.min(2, roads) + Math.min(2, rails);
      }),
      of: 4,
    }),
  },
  tidy: {
    id: 'tidy',
    name: 'Tidy',
    text: 'End a round with twelve squares built and no loose ends.',
    first: 9,
    later: 4,
    progress: (s) => {
      const built = filled(s);
      return {
        have:
          looseEnds(s).length === 0 ? Math.min(12, built) : Math.min(11, built),
        of: 12,
      };
    },
  },
};
export const PLAN_IDS = Object.keys(plans) as PlanId[];
export const PLANS_PER_MATCH = 3;

export const planDone = (s: Sheet, id: PlanId) => {
  const p = plans[id].progress(s);
  return p.have >= p.of;
};

/** A cycle anywhere in the road and rail networks. */
export function hasLoop(s: Sheet) {
  const parent = new Map<string, string>();
  const find = (a: string): string => {
    let r = a;
    while (parent.get(r) !== r) r = parent.get(r)!;
    parent.set(a, r);
    return r;
  };
  const node = (cell: number, d: number) => {
    const c = s.cells[cell]!;
    const g = orient(c.p, c.o).links.findIndex((l) => l.includes(d));
    const k = `${cell}:${g}`;
    if (!parent.has(k)) parent.set(k, k);
    return k;
  };
  for (let cell = 0; cell < s.cells.length; cell++) {
    const c = s.cells[cell];
    if (!c) continue;
    const edges = orient(c.p, c.o).edges;
    for (const d of [1, 2]) {
      const e = edges[d];
      if (e !== ROAD && e !== RAIL) continue;
      const m = neighbour(s.map, cell, d);
      if (m < 0 || !s.cells[m]) continue;
      const t = s.cells[m]!;
      const back = (d + 2) % 4;
      if (orient(t.p, t.o).edges[back] !== e) continue;
      const a = find(node(cell, d)),
        b = find(node(m, back));
      if (a === b) return true;
      parent.set(a, b);
    }
  }
  return false;
}

/** The exits a town's network links, up to the cap; an overpass town takes its better network. */
export const townPoints = (
  nets: { cells: number[]; exits: number[] }[],
  town: number,
) =>
  Math.min(
    TOWN_CAP,
    Math.max(
      0,
      ...nets.filter((n) => n.cells.includes(town)).map((n) => n.exits.length),
    ),
  );

export type Breakdown = {
  exits: number;
  road: number;
  rail: number;
  centre: number;
  errors: number;
  tunnels: number;
  river: number;
  towns: number;
  plans: number;
  total: number;
};
export const BREAKDOWN_KEYS = [
  'exits',
  'road',
  'rail',
  'centre',
  'tunnels',
  'river',
  'towns',
  'plans',
  'errors',
] as const;

export type ScoreOptions = {
  rivers?: boolean;
  towns?: number[];
  plansPoints?: number;
  /** Search budget for longest routes; bots use a smaller one. */
  budget?: number;
};

export function score(s: Sheet, opt: ScoreOptions = {}): Breakdown {
  const nets = networks(s);
  const total = s.map.exits.length;
  const exits = nets.reduce((a, g) => a + exitPoints(g.exits.length, total), 0);
  const road = longest(s, ROAD, opt.budget).length;
  const rail = longest(s, RAIL, opt.budget).length;
  const centre = s.map.centre.filter((i) => s.cells[i]).length;
  const errors = 0 - looseEnds(s).length;
  const tunnels = s.map.peaks.filter((i) => s.cells[i]).length * TUNNEL_POINTS;
  let river = 0;
  if (opt.rivers) {
    const r = longest(s, RIVER, opt.budget);
    river = r.length * RIVER_POINTS + (r.outlet ? OUTLET_POINTS : 0);
  }
  let towns = 0;
  if (opt.towns?.length) {
    towns = opt.towns.reduce((sum, t) => sum + townPoints(nets, t), 0);
  }
  const plansPoints = opt.plansPoints ?? 0;
  return {
    exits,
    road,
    rail,
    centre,
    errors,
    tunnels,
    river,
    towns,
    plans: plansPoints,
    total:
      exits +
      road +
      rail +
      centre +
      errors +
      tunnels +
      river +
      towns +
      plansPoints,
  };
}

/** The workings behind a sheet's score, category by category, for the
 *  points panel: which networks link how many exits, how long the longest
 *  routes run, what each mill links. */
export type ScoreParts = {
  /** Networks linking two exits or more, best first. */
  networks: { exits: number; points: number }[];
  exitsOnMap: number;
  road: number;
  rail: number;
  centre: { built: number; of: number };
  tunnels: number;
  river: { length: number; outlet: boolean };
  towns: { cell: number; points: number }[];
  loose: number;
};

export function scoreParts(s: Sheet, opt: ScoreOptions = {}): ScoreParts {
  const nets = networks(s);
  const total = s.map.exits.length;
  const r = opt.rivers ? longest(s, RIVER, opt.budget) : null;
  return {
    networks: nets
      .filter((g) => g.exits.length >= 2)
      .map((g) => ({
        exits: g.exits.length,
        points: exitPoints(g.exits.length, total),
      }))
      .sort((a, b) => b.points - a.points),
    exitsOnMap: total,
    road: longest(s, ROAD, opt.budget).length,
    rail: longest(s, RAIL, opt.budget).length,
    centre: {
      built: s.map.centre.filter((i) => s.cells[i]).length,
      of: s.map.centre.length,
    },
    tunnels: s.map.peaks.filter((i) => s.cells[i]).length,
    river: { length: r?.length ?? 0, outlet: !!r?.outlet },
    towns: (opt.towns ?? []).map((cell) => ({
      cell,
      points: townPoints(nets, cell),
    })),
    loose: looseEnds(s).length,
  };
}
