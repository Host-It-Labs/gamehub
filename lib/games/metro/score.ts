import { LINE_COUNT, type CityMap } from './map.ts';

/** A section of line on a seat's map: one hop between two stations. */
export type Section = {
  /** The hop, as an edge id of the map. */
  e: number;
  /** Line colour. */
  c: number;
  /** Round and turn it was drawn in. */
  r: number;
  t: number;
  /** The station it was drawn from, for the drawing's direction. */
  from: number;
  /** Set when a wild card boxed the station it reached. */
  box?: 1;
};

/** Express: one bonus a round, the same for everyone. */
export type BonusId = 'peek' | 'outskirts' | 'double' | 'repeat' | 'parallel';
export const BONUS_IDS: BonusId[] = [
  'peek',
  'outskirts',
  'double',
  'repeat',
  'parallel',
];
/** Goals: two a match, 10 each to everyone who reaches them. */
export type GoalId = 'whole' | 'grand' | 'spread' | 'corners' | 'every';
export const GOAL_IDS: GoalId[] = [
  'whole',
  'grand',
  'spread',
  'corners',
  'every',
];
export const GOAL_POINTS = 10;
export const JOIN_BONUS = 10;
/** Points for a station on 2, 3 and 4 lines; a boxed one counts twice. */
export const INTERCHANGE_POINTS: Record<number, number> = { 2: 2, 3: 5, 4: 9 };

export type LinePart = {
  stations: number;
  districts: number;
  most: number;
  points: number;
};
export type LineScore = {
  colour: number;
  /** One part for a joined line, up to two for separate halves. */
  parts: LinePart[];
  joined: boolean;
  bonus: number;
  total: number;
};
export type Interchanges = {
  /** Counted stations on 2, 3 and 4 lines, boxed ones twice. */
  counts: Record<2 | 3 | 4, number>;
  points: number;
};
export type Final = {
  lines: number;
  interchanges: Interchanges;
  goals: GoalId[];
  goalPoints: number;
  total: number;
  /** The best single colour, which breaks a tie. */
  best: number;
};

const neighbours = (m: CityMap, secs: Section[]) => {
  const adj = new Map<number, number[]>();
  for (const s of secs) {
    const { a, b } = m.edges[s.e];
    (adj.get(a) ?? adj.set(a, []).get(a)!).push(b);
    (adj.get(b) ?? adj.set(b, []).get(b)!).push(a);
  }
  return adj;
};

/** Stations joined to `from` by these sections, `from` included. */
export function component(m: CityMap, secs: Section[], from: number) {
  const adj = neighbours(m, secs);
  const seen = new Set([from]);
  const queue = [from];
  while (queue.length) {
    const u = queue.pop()!;
    for (const v of adj.get(u) ?? [])
      if (!seen.has(v)) {
        seen.add(v);
        queue.push(v);
      }
  }
  return seen;
}

/** How one stretch of line scores: districts it passes through times the
 *  most stations it has in a single district. */
export function partScore(
  m: CityMap,
  stations: Iterable<number>,
  bonus: BonusId | null,
): LinePart {
  const per = new Map<number, number>();
  let n = 0;
  for (const s of stations) {
    n++;
    const d = m.stations[s].district;
    per.set(d, (per.get(d) ?? 0) + 1);
  }
  let districts = 0;
  for (const d of per.keys())
    districts += bonus === 'outskirts' && m.districts[d].outer ? 3 : 1;
  const most = Math.max(0, ...per.values()) * (bonus === 'double' ? 2 : 1);
  return { stations: n, districts, most, points: districts * most };
}

/** One colour's score at the end of its round. */
export function lineScore(
  m: CityMap,
  sections: Section[],
  colour: number,
  bonus: BonusId | null = null,
): LineScore {
  const secs = sections.filter((s) => s.c === colour);
  const [moon, sun] = m.starts[colour];
  const a = component(m, secs, moon);
  const joined = a.has(sun);
  const halves = joined ? [a] : [a, component(m, secs, sun)];
  // A start with no section is not a line yet and scores nothing.
  const parts = halves
    .filter((h) => h.size > 1)
    .map((h) => partScore(m, h, bonus));
  const bonusPoints = joined ? JOIN_BONUS : 0;
  return {
    colour,
    parts,
    joined,
    bonus: bonusPoints,
    total: parts.reduce((t, p) => t + p.points, 0) + bonusPoints,
  };
}

/** The colours whose sections touch each station. */
export function coloursAt(m: CityMap, sections: Section[]) {
  const at = new Map<number, Set<number>>();
  for (const s of sections)
    for (const st of [m.edges[s.e].a, m.edges[s.e].b])
      (at.get(st) ?? at.set(st, new Set()).get(st)!).add(s.c);
  return at;
}

export function interchanges(
  m: CityMap,
  sections: Section[],
  boxed: number[],
): Interchanges {
  const counts: Record<2 | 3 | 4, number> = { 2: 0, 3: 0, 4: 0 };
  let points = 0;
  for (const [st, cs] of coloursAt(m, sections)) {
    if (cs.size < 2) continue;
    const n = Math.min(cs.size, LINE_COUNT) as 2 | 3 | 4;
    const weight = boxed.includes(st) ? 2 : 1;
    counts[n] += weight;
    points += INTERCHANGE_POINTS[n] * weight;
  }
  return { counts, points };
}

/** Whether a sheet has reached a goal, and how close it is. */
export function goalProgress(
  m: CityMap,
  id: GoalId,
  sections: Section[],
  boxed: number[],
): { have: number; need: number } {
  const at = coloursAt(m, sections);
  const on = new Set(at.keys());
  const mains = m.districts.filter((d) => !d.outer);
  switch (id) {
    case 'whole': {
      // Every station of two main districts on the network.
      const full = mains.filter((d) =>
        m.stations.every((s) => s.district !== d.id || on.has(s.id)),
      ).length;
      return { have: full, need: 2 };
    }
    case 'grand': {
      // Three boxed stations on one colour.
      let best = 0;
      for (let c = 0; c < LINE_COUNT; c++)
        best = Math.max(
          best,
          boxed.filter((b) => at.get(b)?.has(c)).length,
        );
      return { have: best, need: 3 };
    }
    case 'spread': {
      const ds = new Set(
        boxed.filter((b) => on.has(b)).map((b) => m.stations[b].district),
      );
      return { have: ds.size, need: 6 };
    }
    case 'corners': {
      const n = m.stations.filter(
        (s) => m.districts[s.district].outer && (at.get(s.id)?.size ?? 0) >= 2,
      ).length;
      return { have: n, need: 2 };
    }
    case 'every': {
      const ds = new Set([...on].map((s) => m.stations[s].district));
      return { have: ds.size, need: m.districts.length };
    }
  }
}

export const goalDone = (
  m: CityMap,
  id: GoalId,
  sections: Section[],
  boxed: number[],
) => {
  const p = goalProgress(m, id, sections, boxed);
  return p.have >= p.need;
};

export function finalScore(
  m: CityMap,
  lines: LineScore[],
  sections: Section[],
  boxed: number[],
  goals: GoalId[],
): Final {
  const lineTotal = lines.reduce((t, l) => t + l.total, 0);
  const inter = interchanges(m, sections, boxed);
  const reached = goals.filter((g) => goalDone(m, g, sections, boxed));
  const goalPoints = reached.length * GOAL_POINTS;
  return {
    lines: lineTotal,
    interchanges: inter,
    goals: reached,
    goalPoints,
    total: lineTotal + inter.points + goalPoints,
    best: Math.max(0, ...lines.map((l) => l.total)),
  };
}
