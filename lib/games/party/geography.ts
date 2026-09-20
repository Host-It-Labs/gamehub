import places from './places.json' with { type: 'json' };
import {
  shuffle,
  roll,
  note,
  type StandaloneBase,
  type Difficulty,
} from '../standalone/types.ts';
import { groups, groupName, assertSeats, type PartyMode } from './groups.ts';
import { permutation } from './ranking.ts';
export type GeoMove =
  | { type: 'arrange'; order: number[] }
  | { type: 'lock' | 'unlock' | 'ready' };
export type GeoChallenge = 'west-east' | 'north-south' | 'distance';
type Place = {
  name: string;
  country: string;
  lat: number;
  lng: number;
  source: string;
};
export type GeoChoice = { order: number[]; locked: boolean };
export type GeoGame = StandaloneBase & {
  kind: 'miro';
  rules: 5;
  mode: PartyMode;
  teams: number[];
  scores: number[];
  round: number;
  phase: 'guess' | 'reveal';
  tutorial: boolean;
  lesson: number;
  deck: number[];
  challenge: GeoChallenge;
  cities: Pick<Place, 'name' | 'country'>[];
  cityIds: number[];
  anchor: Place | null;
  guesses: (GeoChoice | null)[];
  ready: boolean[];
  result: null | {
    order: number[];
    values: number[];
    places: Place[];
    guesses: GeoChoice[];
    gains: number[];
  };
};
export const rounds = 6;
export const challengeLabels: Record<GeoChallenge, string> = {
  'west-east': 'West to east',
  'north-south': 'North to south',
  distance: 'Nearest to farthest',
};
export function distance(
  a: Pick<Place, 'lat' | 'lng'>,
  b: Pick<Place, 'lat' | 'lng'>,
) {
  const r = Math.PI / 180,
    dlat = (b.lat - a.lat) * r,
    dlng = (b.lng - a.lng) * r;
  const h =
    Math.sin(dlat / 2) ** 2 +
    Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dlng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))));
}
export function values(g: GeoGame) {
  return g.cityIds.map((id) =>
    g.challenge === 'west-east'
      ? places[id].lng
      : g.challenge === 'north-south'
        ? -places[id].lat
        : distance(g.anchor!, places[id]),
  );
}
export function solution(g: GeoGame) {
  const v = values(g);
  return [0, 1, 2, 3, 4].sort((a, b) => v[a] - v[b]);
}
const familiar = new Set([
  'London',
  'Paris',
  'Berlin',
  'Rome',
  'Madrid',
  'Lisbon',
  'Bern',
  'Vienna',
  'Prague',
  'Warsaw',
  'Athens',
  'Oslo',
  'Stockholm',
  'Helsinki',
  'Copenhagen',
  'Dublin',
  'Reykjavik',
  'Amsterdam',
  'Brussels',
  'Budapest',
  'Bucharest',
  'Ankara',
  'Cairo',
  'Rabat',
  'Tunis',
  'Nairobi',
  'Dakar',
  'Accra',
  'Abuja',
  'Addis Ababa',
  'Tokyo',
  'Beijing',
  'Seoul',
  'Bangkok',
  'Hanoi',
  'Jakarta',
  'Manila',
  'Kuala Lumpur',
  'Singapore',
  'New Delhi',
  'Kathmandu',
  'Dhaka',
  'Islamabad',
  'Riyadh',
  'Amman',
  'Muscat',
  'Abu Dhabi',
  'Canberra',
  'Wellington',
  'Ottawa',
  'Washington D.C.',
  'Mexico City',
  'Havana',
  'Panama City',
  'San Jose',
  'Bogota',
  'Quito',
  'Lima',
  'Santiago',
  'Buenos Aires',
  'Montevideo',
  'Brasilia',
]);
export const placeIds = places.flatMap((p, i) =>
  familiar.has(p.name) ? [i] : [],
);
export function createGame(
  n: number,
  seed: number,
  difficulty: Difficulty = 'medium',
  mode: PartyMode = 'individual',
): GeoGame {
  assertSeats(n, mode);
  const teams = groups(n, mode),
    g: GeoGame = {
      kind: 'miro',
      rules: 5,
      version: 1,
      rngState: seed >>> 0,
      difficulty,
      seats: Array.from({ length: n }, (_, i) =>
        i ? `Player ${i + 1}` : 'You',
      ),
      revision: 0,
      log: [],
      over: false,
      mode,
      teams,
      scores: Array(mode === 'teams' ? 2 : n).fill(0),
      round: 1,
      phase: 'guess',
      tutorial: false,
      lesson: 0,
      deck: [],
      challenge: 'west-east',
      cities: [],
      cityIds: [],
      anchor: null,
      guesses: [],
      ready: [],
      result: null,
    };
  g.deck = shuffle(placeIds, () => roll(g));
  deal(g);
  return g;
}
function deal(g: GeoGame) {
  g.phase = 'guess';
  g.result = null;
  g.guesses = g.scores.map(() => null);
  g.ready = g.seats.map(() => false);
  g.challenge = (['west-east', 'north-south', 'distance'] as const)[
    (g.round - 1) % 3
  ];
  // Each round is one public task for every participant, generated once on the server.
  const candidates = shuffle(g.deck.length >= 25 ? g.deck : placeIds, () =>
    roll(g),
  );
  g.anchor =
    g.challenge === 'distance' ? { ...places[candidates.pop()!] } : null;
  g.cityIds = [];
  for (const id of candidates) {
    const value =
      g.challenge === 'distance'
        ? distance(g.anchor!, places[id])
        : g.challenge === 'west-east'
          ? places[id].lng
          : places[id].lat;
    if (
      g.cityIds.every(
        (other) =>
          Math.abs(
            value -
              (g.challenge === 'distance'
                ? distance(g.anchor!, places[other])
                : g.challenge === 'west-east'
                  ? places[other].lng
                  : places[other].lat),
          ) > (g.challenge === 'distance' ? 150 : 3),
      )
    )
      g.cityIds.push(id);
    if (g.cityIds.length === 5) break;
  }
  if (g.cityIds.length !== 5)
    throw new Error('Not enough distinct geography values');
  g.deck = g.deck.filter(
    (id) => !g.cityIds.includes(id) && places[id].name !== g.anchor?.name,
  );
  g.cities = g.cityIds.map((i) => ({
    name: places[i].name,
    country: places[i].country,
  }));
  note(
    g,
    `Round ${g.round}: everyone orders the same five capitals ${challengeLabels[g.challenge].toLowerCase()}.`,
  );
}
export function captain(g: GeoGame, group: number) {
  const seats = g.teams.flatMap((t, s) => (t === group ? [s] : []));
  return seats[(g.round - 1) % seats.length];
}
export function actingSeats(g: GeoGame) {
  return g.over
    ? []
    : g.phase === 'reveal'
      ? g.seats.flatMap((_, s) => (g.ready[s] ? [] : [s]))
      : g.scores.flatMap((_, t) =>
          g.guesses[t]?.locked ? [] : [captain(g, t)],
        );
}
export function validMove(g: GeoGame, m: unknown, s: number): m is GeoMove {
  if (
    g.over ||
    !Number.isInteger(s) ||
    s < 0 ||
    s >= g.seats.length ||
    !m ||
    typeof m !== 'object' ||
    Array.isArray(m) ||
    Object.keys(m).some((k) => !['type', 'order'].includes(k))
  )
    return false;
  const move = m as GeoMove;
  if (g.phase === 'reveal') return move.type === 'ready' && !g.ready[s];
  const group = g.teams[s],
    guess = g.guesses[group];
  if (move.type === 'unlock') return !!guess?.locked && captain(g, group) === s;
  if (guess?.locked) return false;
  if (move.type === 'arrange') return permutation(move.order, 5);
  return move.type === 'lock' && captain(g, group) === s;
}
export function play(g: GeoGame, m: GeoMove, s: number): GeoGame {
  if (!validMove(g, m, s)) return g;
  const n = structuredClone(g);
  n.revision++;
  if (n.phase === 'reveal') {
    n.ready[s] = true;
    if (n.ready.every(Boolean)) {
      if (n.round === rounds) {
        n.over = true;
        note(n, 'Six shared challenges complete.');
      } else {
        n.round++;
        deal(n);
      }
    }
    return n;
  }
  const t = n.teams[s];
  if (m.type === 'arrange')
    n.guesses[t] = { order: [...m.order], locked: false };
  if (m.type === 'lock') {
    n.guesses[t] ??= { order: [0, 1, 2, 3, 4], locked: false };
    n.guesses[t]!.locked = true;
  }
  if (m.type === 'unlock') n.guesses[t]!.locked = false;
  if (n.guesses.every((b) => b?.locked)) {
    const order = solution(n),
      gains = n.guesses.map((b) => {
        const hits = b!.order.filter((v, i) => v === order[i]).length;
        return hits + (hits === 5 ? 2 : 0);
      });
    n.scores = n.scores.map((score, i) => score + gains[i]);
    n.result = {
      order,
      values: values(n),
      places: n.cityIds.map((id) => ({ ...places[id] })),
      guesses: structuredClone(n.guesses) as GeoChoice[],
      gains,
    };
    n.phase = 'reveal';
    note(
      n,
      `Route revealed: ${gains.map((gain, t) => `${groupName(n, t)} +${gain}`).join(', ')}.`,
    );
  }
  return n;
}
export function observe(g: GeoGame, viewer: number): GeoGame {
  const n = structuredClone(g);
  n.rngState = 0;
  n.deck = [];
  n.cityIds = [];
  n.guesses = n.guesses.map((b, t) =>
    b
      ? {
          ...b,
          order:
            n.phase === 'reveal' || n.teams[viewer] === t ? [...b.order] : [],
        }
      : null,
  );
  return n;
}
export function botMove(g: GeoGame, s: number): GeoMove | null {
  if (!actingSeats(g).includes(s)) return null;
  if (g.phase === 'reveal') return { type: 'ready' };
  if (g.guesses[g.teams[s]]) return { type: 'lock' };
  // Deterministic practice guesses use only public city names; no solution access.
  const order = [0, 1, 2, 3, 4].sort(
    (a, b) =>
      ((g.cities[a].name.length * 13 + s * 7 + a * 31 + g.round) % 47) -
      ((g.cities[b].name.length * 13 + s * 7 + b * 31 + g.round) % 47),
  );
  return { type: 'arrange', order };
}
export function validState(g: GeoGame) {
  return (
    ['guess', 'reveal'].includes(g.phase) &&
    g.cities.length === 5 &&
    g.cities.every(
      (c) => typeof c.name === 'string' && typeof c.country === 'string',
    ) &&
    Array.isArray(g.cityIds) &&
    g.cityIds.length === 5 &&
    new Set(g.cityIds).size === 5 &&
    g.cityIds.every((id) => Number.isInteger(id) && !!places[id]) &&
    Object.hasOwn(challengeLabels, g.challenge) &&
    g.guesses.length === g.scores.length &&
    g.guesses.every(
      (b) =>
        b === null ||
        (permutation(b.order, 5) && typeof b.locked === 'boolean'),
    ) &&
    (g.phase !== 'reveal' || g.guesses.every((b) => b?.locked)) &&
    (g.challenge !== 'distance' ||
      (g.anchor &&
        Number.isFinite(g.anchor.lat) &&
        Number.isFinite(g.anchor.lng))) &&
    (g.phase === 'guess'
      ? g.result === null
      : !!g.result &&
        permutation(g.result.order, 5) &&
        g.result.gains.length === g.scores.length &&
        g.result.gains.every((v) => Number.isInteger(v) && v >= 0 && v <= 7) &&
        g.result.places.length === 5 &&
        g.result.values.length === 5)
  );
}
