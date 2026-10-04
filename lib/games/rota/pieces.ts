/**
 * Rota's route pieces. A piece has four sides (north, east, south, west);
 * each side carries nothing, a road, a rail or a river. `links` groups the
 * sides that are joined inside the square: an overpass keeps its road and its
 * rail apart, a station joins them. Every piece may be turned and flipped,
 * which gives up to eight orientations.
 */
export const NONE = 0;
export const ROAD = 1;
export const RAIL = 2;
export const RIVER = 3;
export type Route = 0 | 1 | 2 | 3;
/** 0 north, 1 east, 2 south, 3 west. */
export type Dir = 0 | 1 | 2 | 3;
export const DX = [0, 1, 0, -1] as const;
export const DY = [-1, 0, 1, 0] as const;
export const opposite = (d: number) => ((d + 2) % 4) as Dir;

export const PIECE_IDS = [
  'road-straight',
  'road-curve',
  'road-tee',
  'rail-straight',
  'rail-curve',
  'rail-tee',
  'overpass',
  'station-straight',
  'station-curve',
  'road-cross',
  'rail-cross',
  'station-tee-road',
  'station-tee-rail',
  'station-cross',
  'station-corner',
  'river-straight',
  'river-curve',
  'road-bridge',
  'rail-bridge',
] as const;
export type PieceId = (typeof PIECE_IDS)[number];

export type PieceGroup = 'route' | 'junction' | 'special' | 'river';
export type Piece = {
  id: PieceId;
  name: string;
  group: PieceGroup;
  /** North, east, south, west. */
  edges: [Route, Route, Route, Route];
  /** Sides joined inside the square. */
  links: number[][];
  /** Takes a peak square (Ridge): one straight road or rail. */
  tunnel?: boolean;
  /** Road and rail meet here. */
  station?: boolean;
  /** Carries both road and rail: an overpass or a station. Towns take only these. */
  junction?: boolean;
};

const piece = (
  id: PieceId,
  name: string,
  group: PieceGroup,
  edges: [Route, Route, Route, Route],
  links?: number[][],
  extra: Partial<Piece> = {},
): Piece => ({
  id,
  name,
  group,
  edges,
  links: links ?? [edges.flatMap((e, d) => (e ? [d] : []))],
  junction: edges.includes(ROAD) && edges.includes(RAIL),
  ...extra,
});

const R = ROAD,
  L = RAIL,
  W = RIVER,
  _ = NONE;

export const pieces: Record<PieceId, Piece> = {
  'road-straight': piece('road-straight', 'Road', 'route', [R, _, R, _], undefined, { tunnel: true }),
  'road-curve': piece('road-curve', 'Road bend', 'route', [R, R, _, _]),
  'road-tee': piece('road-tee', 'Road fork', 'route', [R, R, R, _]),
  'rail-straight': piece('rail-straight', 'Rail', 'route', [L, _, L, _], undefined, { tunnel: true }),
  'rail-curve': piece('rail-curve', 'Rail bend', 'route', [L, L, _, _]),
  'rail-tee': piece('rail-tee', 'Rail fork', 'route', [L, L, L, _]),
  overpass: piece('overpass', 'Overpass', 'junction', [R, L, R, L], [[0, 2], [1, 3]]),
  'station-straight': piece('station-straight', 'Station', 'junction', [R, _, L, _], undefined, { station: true }),
  'station-curve': piece('station-curve', 'Corner station', 'junction', [R, L, _, _], undefined, { station: true }),
  'road-cross': piece('road-cross', 'Crossroads', 'special', [R, R, R, R]),
  'rail-cross': piece('rail-cross', 'Rail cross', 'special', [L, L, L, L]),
  'station-tee-road': piece('station-tee-road', 'Road halt', 'special', [R, L, R, _], undefined, { station: true }),
  'station-tee-rail': piece('station-tee-rail', 'Rail halt', 'special', [L, R, L, _], undefined, { station: true }),
  'station-cross': piece('station-cross', 'Grand station', 'special', [R, L, R, L], undefined, { station: true }),
  'station-corner': piece('station-corner', 'Junction', 'special', [R, R, L, L], undefined, { station: true }),
  'river-straight': piece('river-straight', 'River', 'river', [W, _, W, _]),
  'river-curve': piece('river-curve', 'River bend', 'river', [W, W, _, _]),
  'road-bridge': piece('road-bridge', 'Road bridge', 'river', [R, W, R, W], [[0, 2], [1, 3]]),
  'rail-bridge': piece('rail-bridge', 'Rail bridge', 'river', [L, W, L, W], [[0, 2], [1, 3]]),
};

/** The six specials: at most one a round and three a match, each once. */
export const SPECIALS: PieceId[] = [
  'road-cross',
  'rail-cross',
  'station-tee-road',
  'station-tee-rail',
  'station-cross',
  'station-corner',
];
export const SPECIALS_PER_MATCH = 3;

/** Three route dice, one junction die, and the river die with Rivers. */
export const ROUTE_DIE: PieceId[] = [
  'road-straight',
  'road-curve',
  'road-tee',
  'rail-straight',
  'rail-curve',
  'rail-tee',
];
export const JUNCTION_DIE: PieceId[] = [
  'overpass',
  'overpass',
  'station-straight',
  'station-straight',
  'station-curve',
  'station-curve',
];
export const RIVER_DIE: PieceId[] = [
  'river-straight',
  'river-straight',
  'river-curve',
  'river-curve',
  'road-bridge',
  'rail-bridge',
];

/** Orientation 0–7: 4–7 are flipped east–west first, then all turn clockwise. */
export function dirAfter(d: number, o: number): Dir {
  const m = o >= 4 ? (4 - d) % 4 : d;
  return ((m + (o % 4)) % 4) as Dir;
}

export type Oriented = {
  edges: [Route, Route, Route, Route];
  links: number[][];
};

function build(id: PieceId, o: number): Oriented {
  const p = pieces[id];
  const edges: [Route, Route, Route, Route] = [0, 0, 0, 0];
  p.edges.forEach((e, d) => {
    edges[dirAfter(d, o)] = e;
  });
  return {
    edges,
    links: p.links.map((g) => g.map((d) => dirAfter(d, o)).sort((a, b) => a - b)),
  };
}
const oriented = Object.fromEntries(
  PIECE_IDS.map((id) => [id, Array.from({ length: 8 }, (_, o) => build(id, o))]),
) as Record<PieceId, Oriented[]>;

export const orient = (id: PieceId, o: number): Oriented => oriented[id][o];

/** The distinct orientations of a piece, in a stable order. */
const distinctCache = new Map<PieceId, number[]>();
export function orientations(id: PieceId): number[] {
  const hit = distinctCache.get(id);
  if (hit) return hit;
  const seen = new Set<string>();
  const out: number[] = [];
  for (let o = 0; o < 8; o++) {
    const t = orient(id, o);
    const key = `${t.edges.join('')}|${t.links
      .map((g) => g.join(''))
      .sort((a, b) => a.localeCompare(b))
      .join('/')}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(o);
  }
  distinctCache.set(id, out);
  return out;
}
