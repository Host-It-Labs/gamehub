/**
 * The night's road: three legs of forks between places, each leg ending at a
 * boss. Plain data and a seeded generator, shared by the campaign rules, the
 * route map scene and the tests. Positions on screen belong to the map scene;
 * this file only says which stops exist and how they connect.
 */

export type PlaceId =
  | 'truckstop'
  | 'drivein'
  | 'fairground'
  | 'harbour'
  | 'oldtown'
  | 'moonmile';
export const PLACE_IDS: readonly PlaceId[] = [
  'truckstop',
  'drivein',
  'fairground',
  'harbour',
  'oldtown',
  'moonmile',
];
export const isPlaceId = (v: unknown): v is PlaceId =>
  typeof v === 'string' && (PLACE_IDS as readonly string[]).includes(v);

export type PlaceInfo = {
  name: string;
  /** The crowd, in a few words, for the fork card. */
  crowd: string;
  /** The place's own accent colour (map labels, fork cards). */
  colour: string;
};
export const PLACES: Record<PlaceId, PlaceInfo> = {
  truckstop: {
    name: 'Truck stop',
    crowd: 'Truckers: big parties',
    colour: '#f39a3d',
  },
  drivein: {
    name: 'Drive-in',
    crowd: 'Couples: rushes at intermission',
    colour: '#5aa7f0',
  },
  fairground: {
    name: 'Fairground',
    crowd: 'Families: impatient kids',
    colour: '#f2668f',
  },
  harbour: {
    name: 'Harbour',
    crowd: 'Sailors: a wet, slippery deck',
    colour: '#3fc1b0',
  },
  oldtown: {
    name: 'Old Town',
    crowd: 'Locals: lookalike parties',
    colour: '#e8b45a',
  },
  moonmile: {
    name: 'Moon Mile',
    crowd: 'Night owls: everything goes wrong',
    colour: '#b392f0',
  },
};

export type StopKind = 'shift' | 'boss' | 'garage' | 'motel';
/** What finishing a shift pays, shown on its fork before you choose it. */
export type Reward = 'gear' | 'cash' | 'life' | 'rare';
export const REWARD_NAMES: Record<Reward, string> = {
  gear: 'Equipment',
  cash: 'Cash ×1.5',
  life: 'A life',
  rare: 'Rare equipment',
};

export type BossId = 'last-bus' | 'critic' | 'feast';
export const BOSSES: Record<
  BossId,
  { name: string; place: PlaceId; line: string }
> = {
  'last-bus': {
    name: 'Last Bus',
    place: 'truckstop',
    line: 'A whole busload arrives at once.',
  },
  critic: {
    name: 'The Critic',
    place: 'oldtown',
    line: 'Every party is demanding.',
  },
  feast: {
    name: 'Midnight Feast',
    place: 'moonmile',
    line: 'Everything at once.',
  },
};

export type RoadNode = {
  /** `${leg}-${col}-${index}`; stable for one run. */
  id: string;
  leg: number;
  /** 0..3 forks, 4 the boss. */
  col: number;
  /** Across the road, -1 (left) .. 1 (right); a lone stop sits at 0. */
  lane: number;
  kind: StopKind;
  /** Shifts and bosses happen here; the Garage and Motel stand on this place's road too. */
  place: PlaceId;
  boss: BossId | null;
  /** Shifts only. */
  reward: Reward | null;
  /** How busy the shift is, 1..3. 0 for the Garage and Motel. */
  busy: 0 | 1 | 2 | 3;
  /** Coins to drive here. */
  gas: number;
  /** Stops reachable from here. */
  next: string[];
};

export type RoadLeg = {
  index: number;
  /** The landscape this leg crosses on the map. */
  region: 'desert' | 'coast' | 'moon';
  nodes: RoadNode[];
};
export type RoadMap = { seed: number; legs: RoadLeg[] };

/**
 * Stops per column of a leg: four forks of two, then the boss. Since
 * 9 October 2026 every fork is a choice between exactly two stops, and
 * either one leads on to both stops of the next fork.
 */
export const LEG_SHAPE = [2, 2, 2, 2, 1] as const;
export const LEG_STOPS = LEG_SHAPE.length;
export const ROAD_LEGS = 3;
export const REGIONS: RoadLeg['region'][] = ['desert', 'coast', 'moon'];
const LANES: Record<number, number[]> = { 1: [0], 2: [-1, 1] };
const LEG_PLACES: PlaceId[][] = [
  ['truckstop', 'drivein', 'fairground'],
  ['fairground', 'harbour', 'oldtown', 'drivein'],
  ['moonmile', 'drivein', 'fairground', 'harbour', 'oldtown', 'truckstop'],
];
const LEG_BOSS: BossId[] = ['last-bus', 'critic', 'feast'];

/** Stops driven so far in the night, counting overtime legs. */
export const stopIndex = (leg: number, col: number) => leg * LEG_STOPS + col;

function random(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Gas for the drive to a stop: a good share of what a shift there takes. */
export const gasFor = (leg: number, col: number, busy: number) =>
  col === 0 && leg === 0
    ? 0
    : Math.round((35 + stopIndex(leg, col) * 13 + busy * 8) / 5) * 5;

/**
 * One leg of the road. Overtime legs (index 3+) reuse the Moon Mile's places.
 * Deterministic for a seed and leg. The two stops of a fork always differ in
 * place, and a shift pair is a real trade: one calmer road that pays cash or
 * a life, one busier road that pays equipment. The third fork pairs a shift
 * with a rest (the Garage on the first leg, the Motel on the second, either
 * later on).
 */
export function makeLeg(seed: number, index: number): RoadLeg {
  const rand = random((seed ^ Math.imul(index + 1, 0x9e3779b1)) >>> 0);
  const pick = <T>(list: readonly T[]) =>
    list[Math.floor(rand() * list.length)];
  const places = LEG_PLACES[Math.min(index, 2)];
  const nodes: RoadNode[] = [];
  const columns: RoadNode[][] = [];
  const hard = index >= 2 ? 1 : 0;
  LEG_SHAPE.forEach((count, col) => {
    const lanes = LANES[count];
    const column: RoadNode[] = [];
    const boss = col === LEG_STOPS - 1 ? LEG_BOSS[Math.min(index, 2)] : null;
    const restAt = col === 2 ? Math.floor(rand() * 2) : -1;
    const restKind: StopKind =
      index === 0
        ? 'garage'
        : index === 1
          ? 'motel'
          : rand() < 0.5
            ? 'garage'
            : 'motel';
    // Which side is the busy road this time.
    const busySide = Math.floor(rand() * 2);
    const used = new Set<string>();
    lanes.forEach((lane, i) => {
      const kind: StopKind = boss ? 'boss' : i === restAt ? restKind : 'shift';
      let place = boss ? BOSSES[boss].place : pick(places);
      for (let tries = 0; tries < 8 && used.has(place) && !boss; tries++)
        place = pick(places);
      if (used.has(place) && !boss)
        place = PLACE_IDS.find((p) => !used.has(p)) ?? place;
      used.add(place);
      const busier = i === busySide || restAt >= 0;
      const busy: RoadNode['busy'] =
        kind === 'garage' || kind === 'motel'
          ? 0
          : boss
            ? 3
            : (Math.min(3, (busier ? 2 : 1) + hard) as 1 | 2 | 3);
      let reward: Reward | null = null;
      if (kind === 'shift') {
        // A full-health run has no use for a life on its first stops.
        const early = index === 0 && col < 2;
        reward = busier
          ? busy === 3 && rand() < 0.5
            ? 'rare'
            : 'gear'
          : early || rand() < 0.6
            ? 'cash'
            : 'life';
      } else if (kind === 'boss') reward = 'rare';
      const node: RoadNode = {
        id: `${index}-${col}-${i}`,
        leg: index,
        col,
        lane,
        kind,
        place,
        boss,
        reward,
        busy,
        gas:
          kind === 'garage' || kind === 'motel' ? 0 : gasFor(index, col, busy),
        next: [],
      };
      column.push(node);
      nodes.push(node);
    });
    columns.push(column);
  });
  for (let col = 0; col < columns.length - 1; col++)
    for (const a of columns[col]) a.next = columns[col + 1].map((b) => b.id);
  return { index, region: REGIONS[Math.min(index, 2)], nodes };
}

export function makeRoad(seed: number, legs = ROAD_LEGS): RoadMap {
  return {
    seed: seed >>> 0,
    legs: Array.from({ length: legs }, (_, i) => makeLeg(seed, i)),
  };
}

export const nodeById = (map: RoadMap, id: string) =>
  map.legs.flatMap((l) => l.nodes).find((n) => n.id === id);

/** The first stops of a leg (where a run starts, and where a boss leads). */
export const legStart = (map: RoadMap, leg: number) =>
  map.legs[leg]?.nodes.filter((n) => n.col === 0) ?? [];

/** Where you can drive from a stop: its forks, or the next leg after a boss. */
export function choicesFrom(map: RoadMap, at: RoadNode | null): RoadNode[] {
  if (!at) return legStart(map, 0);
  if (at.kind === 'boss') return legStart(map, at.leg + 1);
  return at.next
    .map((id) => nodeById(map, id))
    .filter((n): n is RoadNode => !!n);
}
