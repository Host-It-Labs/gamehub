import places from './geo-places.json' with { type: 'json' };
import {
  shuffle,
  roll,
  note,
  type StandaloneBase,
  type Difficulty,
} from '../standalone/types.ts';
import { groups, groupName, assertSeats, type PartyMode } from './groups.ts';
export type Pin = { lat: number; lng: number };
export type GeoMove =
  | { type: 'pin'; prompt: number; lat: number; lng: number }
  | { type: 'choose'; prompt: number; seat: number }
  | { type: 'lock' | 'ready' };
export type GeoChallenge = 'named' | 'photo' | 'facts';
export type GeoPrompt = {
  difficulty: 'medium' | 'hard';
  title: string;
  photo: string | null;
  photoAlt: string | null;
  facts: string[];
};
export type GeoGame = StandaloneBase & {
  kind: 'miro';
  rules: 9;
  mode: PartyMode;
  teams: number[];
  scores: number[];
  round: number;
  phase: 'guess' | 'discuss' | 'reveal';
  tutorial: boolean;
  lesson: number;
  deck: number[];
  cityIds: number[];
  challenge: GeoChallenge;
  prompts: GeoPrompt[];
  guesses: { pins: (Pin | null)[]; locked: boolean }[];
  choices: { seats: (number | null)[]; locked: boolean }[];
  discussionEndsAt: number | null;
  firstTeam: number;
  turn: number;
  ready: boolean[];
  totalDistance: number[];
  result: null | {
    places: (typeof places)[number][];
    pins: Pin[][];
    distances: number[][];
    gains: number[];
  };
};
export const rounds = 2;
export const challenges = ['named', 'photo', 'facts'] as const;
export function stage(g: GeoGame) {
  return (g.round - 1) * challenges.length + challenges.indexOf(g.challenge);
}
export const challengeLabels: Record<GeoChallenge, string> = {
  named: 'Name the place',
  photo: 'Read the landscape',
  facts: 'Follow three clues',
};
export function distance(a: Pin, b: Pin) {
  const r = Math.PI / 180,
    dlat = (b.lat - a.lat) * r,
    dlng = (b.lng - a.lng) * r;
  const h =
    Math.sin(dlat / 2) ** 2 +
    Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dlng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))));
}
export function isPin(p: unknown): p is Pin {
  if (!p || typeof p !== 'object') return false;
  const v = p as Pin;
  return (
    Number.isFinite(v.lat) &&
    Math.abs(v.lat) <= 90 &&
    Number.isFinite(v.lng) &&
    Math.abs(v.lng) <= 180
  );
}
export function createGame(
  n: number,
  seed: number,
  difficulty: Difficulty = 'medium',
  mode: PartyMode = 'individual',
  seen: ReadonlySet<string> = new Set(),
  teams?: number[],
): GeoGame {
  assertSeats(n, mode);
  const g: GeoGame = {
    kind: 'miro',
    rules: 9,
    version: 1,
    rngState: seed >>> 0,
    difficulty,
    seats: Array.from({ length: n }, (_, i) => (i ? `Player ${i + 1}` : 'You')),
    revision: 0,
    log: [],
    over: false,
    mode,
    teams: groups(n, mode, teams),
    scores: Array(mode === 'teams' ? 2 : n).fill(0),
    round: 1,
    phase: 'guess',
    tutorial: false,
    lesson: 0,
    deck: [],
    cityIds: [],
    challenge: 'named',
    prompts: [],
    guesses: [],
    choices: [],
    discussionEndsAt: null,
    firstTeam: 0,
    turn: 0,
    ready: [],
    totalDistance: Array(mode === 'teams' ? 2 : n).fill(0),
    result: null,
  };
  const medium = shuffle(
    places.flatMap((p, i) => (p.difficulty === 'medium' ? [i] : [])),
    () => roll(g),
  );
  const hard = shuffle(
    places.flatMap((p, i) => (p.difficulty === 'hard' ? [i] : [])),
    () => roll(g),
  );
  const unseenFirst = (a: number, b: number) =>
    Number(seen.has(placeHistoryKey(a))) - Number(seen.has(placeHistoryKey(b)));
  medium.sort(unseenFirst);
  hard.sort(unseenFirst);
  if (medium.length < 3 || hard.length < 3)
    throw new Error('Atlas needs at least three places per difficulty.');
  g.deck = [...medium.slice(0, 3), ...hard.slice(0, 3)];
  g.firstTeam = Math.floor(roll(g) * g.scores.length);
  deal(g);
  return g;
}
function deal(g: GeoGame) {
  g.phase = 'guess';
  g.discussionEndsAt = null;
  g.result = null;
  g.turn = 0;
  g.guesses = g.seats.map(() => ({ pins: [null, null, null], locked: false }));
  g.choices = g.scores.map(() => ({
    seats: [null, null, null],
    locked: false,
  }));
  g.ready = g.seats.map(() => false);
  g.cityIds = g.deck.slice((g.round - 1) * 3, g.round * 3);
  g.prompts = g.cityIds.map((id, p) => ({
    difficulty: g.round === 1 ? 'medium' : 'hard',
    title:
      challenges[p] === 'named'
        ? `${places[id].name}, ${places[id].country}`
        : challenges[p] === 'photo'
          ? 'Where was this photographed?'
          : 'Which town or city fits?',
    photo: challenges[p] === 'photo' ? places[id].photo : null,
    photoAlt: challenges[p] === 'photo' ? places[id].photoAlt : null,
    facts: challenges[p] === 'facts' ? [...places[id].facts] : [],
  }));
  note(
    g,
    `Round ${g.round}: Complete Places, Photos and Three facts privately before discussing.`,
  );
}
export function captain(g: GeoGame, team: number) {
  const seats = g.teams.flatMap((t, s) => (t === team ? [s] : []));
  return seats[(g.round - 1) % seats.length];
}
export function activeTeam(g: GeoGame) {
  return (g.firstTeam + g.round - 1 + g.turn) % g.scores.length;
}
export function actingSeats(g: GeoGame) {
  if (g.over) return [];
  if (g.phase === 'reveal')
    return g.seats.flatMap((_, s) => (g.ready[s] ? [] : [s]));
  if (g.phase === 'discuss') return [captain(g, activeTeam(g))];
  return g.seats.flatMap((_, s) => (g.guesses[s].locked ? [] : [s]));
}
export function validMove(g: GeoGame, m: unknown, s: number): m is GeoMove {
  if (
    g.over ||
    !Number.isInteger(s) ||
    s < 0 ||
    s >= g.seats.length ||
    !m ||
    typeof m !== 'object' ||
    Array.isArray(m)
  )
    return false;
  const v = m as GeoMove;
  const keys =
    v.type === 'pin'
      ? ['type', 'prompt', 'lat', 'lng']
      : v.type === 'choose'
        ? ['type', 'prompt', 'seat']
        : ['type'];
  if (Object.keys(v).some((k) => !keys.includes(k))) return false;
  if (g.phase === 'reveal') return v.type === 'ready' && !g.ready[s];
  if (g.phase === 'guess') {
    if (g.guesses[s].locked) return false;
    if (v.type === 'pin') return [0, 1, 2].includes(v.prompt) && isPin(v);
    return v.type === 'lock' && g.guesses[s].pins.every(isPin);
  }
  const t = activeTeam(g);
  if (captain(g, t) !== s || g.choices[t].locked) return false;
  if (v.type === 'choose')
    return (
      [0, 1, 2].includes(v.prompt) &&
      Number.isInteger(v.seat) &&
      v.seat >= 0 &&
      v.seat < g.seats.length &&
      g.teams[v.seat] === t
    );
  return (
    v.type === 'lock' &&
    g.choices[t].seats.every((seat) => seat !== null && g.teams[seat] === t)
  );
}
function reveal(g: GeoGame) {
  const prompt = challenges.indexOf(g.challenge);
  const targets = [places[g.cityIds[prompt]]];
  const pins = g.choices.map((c) => [
    { ...g.guesses[c.seats[prompt]!].pins[prompt]! },
  ]);
  const distances = pins.map((pair) =>
    pair.map((pin, p) => distance(pin, targets[p])),
  );
  // One point for the closest pin, one precision bonus within 100 km. Equal metre-rounded distances share the point.
  const gains = distances.map((pair) =>
    pair.reduce(
      (sum, d, p) =>
        sum +
        (Math.round(d * 1000) ===
        Math.min(...distances.map((ds) => Math.round(ds[p] * 1000)))
          ? 1
          : 0) +
        (d <= 100 ? 1 : 0),
      0,
    ),
  );
  g.totalDistance = g.totalDistance.map(
    (total, t) => total + distances[t].reduce((a, b) => a + b, 0),
  );
  g.scores = g.scores.map((score, t) => score + gains[t]);
  g.result = { places: structuredClone(targets), pins, distances, gains };
  g.phase = 'reveal';
  g.discussionEndsAt = null;
  note(
    g,
    `Location revealed: ${gains.map((gain, t) => `${groupName(g, t)} +${gain}`).join(', ')}.`,
  );
}
export function play(
  g: GeoGame,
  m: GeoMove,
  s: number,
  now = Date.now(),
): GeoGame {
  if (!validMove(g, m, s)) return g;
  if (
    g.phase === 'discuss' &&
    g.discussionEndsAt !== null &&
    now >= g.discussionEndsAt
  )
    return tick(g, now);
  const n = structuredClone(g);
  n.revision++;
  if (m.type === 'ready') {
    n.ready[s] = true;
    if (n.ready.every(Boolean)) {
      if (n.round === rounds && n.challenge === 'facts') {
        n.over = true;
        note(n, 'Two rounds, six destinations complete.');
      } else {
        if (n.challenge === 'facts') {
          n.round++;
          n.challenge = 'named';
          deal(n);
        } else {
          n.challenge = challenges[challenges.indexOf(n.challenge) + 1];
          n.ready = n.seats.map(() => false);
          reveal(n);
        }
      }
    }
  } else if (n.phase === 'guess') {
    if (m.type === 'pin')
      n.guesses[s].pins[m.prompt] = { lat: m.lat, lng: m.lng };
    if (m.type === 'lock') n.guesses[s].locked = true;
    if (n.guesses.every((b) => b.locked)) {
      startDiscussion(n, now);
    }
  } else {
    const t = activeTeam(n);
    if (m.type === 'choose') n.choices[t].seats[m.prompt] = m.seat;
    if (m.type === 'lock') finishDiscussion(n, now);
  }
  return n;
}
function startDiscussion(g: GeoGame, now: number) {
  g.result = null;
  g.turn = 0;
  g.ready = g.seats.map(() => false);
  g.choices = g.scores.map(() => ({
    seats: [null, null, null],
    locked: false,
  }));
  if (g.mode === 'individual') {
    g.choices = g.seats.map((_, seat) => ({
      seats: [seat, seat, seat],
      locked: true,
    }));
    reveal(g);
  } else {
    g.phase = 'discuss';
    g.discussionEndsAt = g.tutorial ? null : now + 60_000;
    note(
      g,
      `${groupName(g, activeTeam(g))} discusses first. Choose all three frozen teammate pins, then confirm together.`,
    );
  }
}
function finishDiscussion(g: GeoGame, now: number) {
  g.choices[activeTeam(g)].locked = true;
  g.turn++;
  if (g.turn === g.scores.length) reveal(g);
  else {
    g.discussionEndsAt = g.tutorial ? null : now + 60_000;
    note(
      g,
      `${groupName(g, activeTeam(g))}: your turn to choose all three team pins.`,
    );
  }
}
/** The server owns the deadline. Missing selections fall back to the captain's frozen pins. */
export function tick(g: GeoGame, now = Date.now()): GeoGame {
  if (
    g.over ||
    g.tutorial ||
    g.phase !== 'discuss' ||
    g.discussionEndsAt === null ||
    now < g.discussionEndsAt
  )
    return g;
  const n = structuredClone(g),
    team = activeTeam(n);
  n.revision++;
  n.choices[team].seats = n.choices[team].seats.map(
    (s) => s ?? captain(n, team),
  );
  finishDiscussion(n, now);
  return n;
}
export function observe(g: GeoGame, viewer: number): GeoGame {
  const n = structuredClone(g);
  n.rngState = 0;
  n.deck = [];
  n.cityIds = [];
  n.guesses = n.guesses.map((guess, seat) => ({
    ...guess,
    pins:
      seat === viewer ||
      (n.phase !== 'guess' && n.teams[seat] === n.teams[viewer])
        ? guess.pins
        : guess.pins.map((pin, p) =>
            n.phase === 'reveal' && p === challenges.indexOf(n.challenge)
              ? pin
              : null,
          ),
  }));
  n.choices = n.choices.map((choice, t) => ({
    ...choice,
    seats:
      n.phase === 'reveal' || n.teams[viewer] === t
        ? choice.seats
        : [null, null, null],
  }));
  return n;
}
export function botMove(g: GeoGame, s: number): GeoMove | null {
  if (!actingSeats(g).includes(s)) return null;
  if (g.phase === 'reveal') return { type: 'ready' };
  if (g.phase === 'discuss') {
    const t = activeTeam(g),
      prompt = g.choices[t].seats.findIndex((seat) => seat === null);
    if (prompt < 0) return { type: 'lock' };
    const members = g.teams.flatMap((team, seat) => (team === t ? [seat] : []));
    return {
      type: 'choose',
      prompt,
      seat: members[(g.round + prompt) % members.length],
    };
  }
  const prompt = g.guesses[s].pins.findIndex((p) => !p);
  if (prompt < 0) return { type: 'lock' };
  // Practice uses only public clues: no hidden target IDs or answer coordinates.
  const text = [g.prompts[prompt].title, ...g.prompts[prompt].facts].join(' ');
  let hash = s * 97 + g.round * 131 + prompt * 43;
  for (const ch of text) hash = (Math.imul(hash, 31) + ch.charCodeAt(0)) >>> 0;
  return {
    type: 'pin',
    prompt,
    lat: (hash % 13000) / 100 - 60,
    lng: ((hash >>> 8) % 36000) / 100 - 180,
  };
}
export function validState(g: GeoGame) {
  const single = (a: unknown): a is unknown[] =>
    Array.isArray(a) && a.length === 1;
  const triple = (a: unknown): a is unknown[] =>
    Array.isArray(a) && a.length === 3;
  const ids = (a: number[], length: number) =>
    Array.isArray(a) &&
    a.length === length &&
    new Set(a).size === length &&
    a.every((id) => Number.isInteger(id) && !!places[id]);
  return (
    g.rules === 9 &&
    ['guess', 'discuss', 'reveal'].includes(g.phase) &&
    (g.phase === 'discuss' && !g.tutorial
      ? typeof g.discussionEndsAt === 'number' &&
        Number.isFinite(g.discussionEndsAt) &&
        g.discussionEndsAt > 0
      : g.discussionEndsAt === null) &&
    Number.isInteger(g.round) &&
    g.round >= 1 &&
    g.round <= rounds &&
    challenges.includes(g.challenge) &&
    (g.phase === 'reveal' || g.challenge === 'named') &&
    ids(g.deck, 6) &&
    ids(g.cityIds, 3) &&
    g.cityIds.every((id, p) => id === g.deck[(g.round - 1) * 3 + p]) &&
    g.deck.every(
      (id, p) => places[id].difficulty === (p < 3 ? 'medium' : 'hard'),
    ) &&
    triple(g.prompts) &&
    g.prompts.every(
      (p) =>
        p &&
        p.difficulty === (g.round === 1 ? 'medium' : 'hard') &&
        typeof p.title === 'string' &&
        (p.photo === null || typeof p.photo === 'string') &&
        Array.isArray(p.facts) &&
        p.facts.every((f) => typeof f === 'string'),
    ) &&
    Number.isInteger(g.firstTeam) &&
    g.firstTeam >= 0 &&
    g.firstTeam < g.scores.length &&
    Number.isInteger(g.turn) &&
    g.turn >= 0 &&
    g.turn <= g.scores.length &&
    g.guesses.length === g.seats.length &&
    g.guesses.every(
      (b) =>
        b &&
        typeof b.locked === 'boolean' &&
        triple(b.pins) &&
        b.pins.every((p) => p === null || isPin(p)) &&
        (!b.locked || b.pins.every(isPin)),
    ) &&
    g.choices.length === g.scores.length &&
    g.choices.every(
      (c, t) =>
        c &&
        typeof c.locked === 'boolean' &&
        triple(c.seats) &&
        c.seats.every(
          (s) =>
            s === null ||
            (Number.isInteger(s) &&
              s >= 0 &&
              s < g.seats.length &&
              g.teams[s] === t),
        ) &&
        (!c.locked || c.seats.every((s) => s !== null)),
    ) &&
    g.totalDistance.length === g.scores.length &&
    g.totalDistance.every((d) => Number.isFinite(d) && d >= 0) &&
    (g.phase === 'guess' || g.guesses.every((b) => b.locked)) &&
    (g.phase !== 'discuss' ||
      (g.mode === 'teams' &&
        g.turn < g.scores.length &&
        !g.choices[activeTeam(g)].locked)) &&
    (g.phase === 'reveal'
      ? g.choices.every((c) => c.locked) &&
        !!g.result &&
        single(g.result.places) &&
        g.result.places.every(isPin) &&
        g.result.pins.length === g.scores.length &&
        g.result.pins.every((p) => single(p) && p.every(isPin)) &&
        g.result.distances.length === g.scores.length &&
        g.result.distances.every(
          (ds) =>
            single(ds) &&
            ds.every((d) => Number.isFinite(d) && d >= 0 && d <= 20016),
        ) &&
        g.result.gains.length === g.scores.length &&
        g.result.gains.every((v) => Number.isInteger(v) && v >= 0 && v <= 2)
      : g.result === null) &&
    (!g.over ||
      (g.round === rounds &&
        g.challenge === 'facts' &&
        g.phase === 'reveal' &&
        g.ready.every(Boolean)))
  );
}

export function placeHistoryKey(id: number): string {
  const place = places[id];
  return `${place.country}:${place.name}`;
}
