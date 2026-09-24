import photos from './geo-places.json' with { type: 'json' };
import names from './geo-names.json' with { type: 'json' };
import {
  shuffle,
  roll,
  note,
  type StandaloneBase,
  type Difficulty,
} from '../standalone/types.ts';
import { groups, groupName, assertSeats, type PartyMode } from './groups.ts';
import {
  openVote,
  voteClosed,
  voteResult,
  voteOptions,
  isChoice,
  validVote,
  maxRounds as matchRounds,
  type RoundChoice,
  type RoundVote,
  type SetGame,
} from './vote.ts';
import type { TribuState } from './tribu-state.ts';
export type Pin = { lat: number; lng: number };
export type Place = {
  name: string;
  country: string;
  region: string;
  difficulty: string;
  lat: number;
  lng: number;
  source: string;
  facts?: string[];
  photo?: string;
  photoSource?: string;
  artist?: string;
  license?: string;
  licenseUrl?: string;
  photoAlt?: string;
};
/** Every place Atlas can deal: the photographed finals first, then the named
 * places. Indices are stable within a release; saves hold them. */
export const places: Place[] = [...photos, ...names];
const isFinal = (id: number) => id < photos.length;
export type GeoMove =
  | { type: 'pin'; prompt: number; lat: number; lng: number }
  | { type: 'choose'; prompt: number; seat: number }
  | { type: 'vote'; choice: RoundChoice }
  | { type: 'lock' | 'next' };
/** Each round: an easier named place, a harder one, then a photograph with
 * two clues. */
export type GeoChallenge = 'easy' | 'hard' | 'final';
export type GeoPrompt = {
  difficulty: 'medium' | 'hard';
  title: string;
  photo: string | null;
  photoAlt: string | null;
  facts: string[];
};
export type GeoGame = StandaloneBase & {
  kind: 'miro';
  rules: 10;
  mode: PartyMode;
  teams: number[];
  scores: number[];
  round: number;
  phase: 'guess' | 'discuss' | 'reveal' | 'vote';
  /** The ten-second keep-going-or-finish vote after each round's last reveal. */
  vote?: RoundVote | null;
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
  /** Kept for saved games; reveals now advance on the host's single `next`. */
  ready: boolean[];
  totalDistance: number[];
  result: null | {
    places: Place[];
    pins: Pin[][];
    distances: number[][];
    gains: number[];
  };
  /** The match round this game's places began on, when Atlas joined a Sabi
   * match after Sizes; absent means round 1. */
  start?: number;
  /** Present while Atlas is played inside Sabi. */
  tribu?: TribuState;
  /** Set when the table voted to switch games; the registry swaps the state. */
  handoff?: SetGame | null;
};
/** Rounds are open-ended now: the table votes after each one. Three places a
 * round, so the catalog bounds how many rounds of places one deck holds. */
export function maxRounds(g: { deck: number[] }) {
  return Math.floor(g.deck.length / 3);
}
/** Which round of places this is: the match round, less any rounds played
 * before Atlas joined. */
export function placeRound(g: { round: number; start?: number }) {
  return g.round - (g.start ?? 1) + 1;
}
/** Joins a Sabi match at `round`; the places deal from the top of the deck. */
export function startAt(g: GeoGame, round: number) {
  g.round = round;
  if (round > 1) g.start = round;
  return g;
}
export const challenges = ['easy', 'hard', 'final'] as const;
export function stage(g: GeoGame) {
  return (
    (placeRound(g) - 1) * challenges.length + challenges.indexOf(g.challenge)
  );
}
export const challengeLabels: Record<GeoChallenge, string> = {
  easy: 'Place',
  hard: 'Harder',
  final: 'Final',
};
/** Points for the closest pin and for landing within 100 km. */
export const closestPoints = 50,
  nearPoints = 50;
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
    rules: 10,
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
    challenge: 'easy',
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
  const unseenFirst = (a: number, b: number) =>
    Number(seen.has(placeHistoryKey(a))) - Number(seen.has(placeHistoryKey(b)));
  const pool = (keep: (p: Place, i: number) => boolean) =>
    shuffle(
      places.flatMap((p, i) => (keep(p, i) ? [i] : [])),
      () => roll(g),
    ).sort(unseenFirst);
  const easy = pool((p, i) => !isFinal(i) && p.difficulty === 'medium'),
    hard = pool((p, i) => !isFinal(i) && p.difficulty === 'hard'),
    final = pool((_, i) => isFinal(i));
  const rounds = Math.min(easy.length, hard.length, final.length);
  if (rounds < 2) throw new Error('Atlas needs at least two rounds of places.');
  // Three places a round: easier, harder, then the photographed final.
  g.deck = Array.from({ length: rounds }, (_, r) => [
    easy[r],
    hard[r],
    final[r],
  ]).flat();
  g.firstTeam = Math.floor(roll(g) * g.scores.length);
  deal(g);
  return g;
}
function deal(g: GeoGame) {
  g.phase = 'guess';
  g.vote = null;
  g.discussionEndsAt = null;
  g.result = null;
  g.turn = 0;
  g.guesses = g.seats.map(() => ({ pins: [null, null, null], locked: false }));
  g.choices = g.scores.map(() => ({
    seats: [null, null, null],
    locked: false,
  }));
  g.ready = g.seats.map(() => false);
  g.cityIds = g.deck.slice((placeRound(g) - 1) * 3, placeRound(g) * 3);
  g.prompts = g.cityIds.map((id, p) => ({
    difficulty: places[id].difficulty as 'medium' | 'hard',
    title:
      challenges[p] === 'final'
        ? ''
        : `${places[id].name}, ${places[id].country}`,
    photo: challenges[p] === 'final' ? (places[id].photo ?? null) : null,
    photoAlt: challenges[p] === 'final' ? (places[id].photoAlt ?? null) : null,
    facts: challenges[p] === 'final' ? [...(places[id].facts ?? [])] : [],
  }));
  note(g, `Round ${g.round}: two places and a final, pinned privately.`);
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
  // Reveals wait on the table host only; see `next`.
  if (g.phase === 'reveal') return [];
  if (g.phase === 'vote')
    return g.seats.flatMap((_, s) => (g.vote?.choices[s] ? [] : [s]));
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
        : v.type === 'vote'
          ? ['type', 'choice']
          : ['type'];
  if (Object.keys(v).some((k) => !keys.includes(k))) return false;
  // The engine accepts `next` from any seat; the table decides who hosts.
  if (g.phase === 'reveal') return v.type === 'next';
  if (g.phase === 'vote')
    return (
      v.type === 'vote' &&
      isChoice(v.choice, g.vote) &&
      g.vote?.choices[s] !== v.choice
    );
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
  // Points for the closest pin, and a precision bonus within 100 km. Equal metre-rounded distances share the closest points.
  const gains = distances.map((pair) =>
    pair.reduce(
      (sum, d, p) =>
        sum +
        (Math.round(d * 1000) ===
        Math.min(...distances.map((ds) => Math.round(ds[p] * 1000)))
          ? closestPoints
          : 0) +
        (d <= 100 ? nearPoints : 0),
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
  if (g.phase === 'vote' && g.vote && voteClosed(g.vote, now))
    return tick(g, now);
  const n = structuredClone(g);
  n.revision++;
  if (m.type === 'vote') {
    n.vote!.choices[s] = m.choice;
    if (voteClosed(n.vote!, now)) closeRound(n);
  } else if (m.type === 'next') {
    const last = placeRound(n) >= maxRounds(n);
    if (n.challenge === 'final' && last && !n.tribu) {
      n.over = true;
      note(n, `All ${placeRound(n) * 3} destinations complete.`);
    } else if (n.challenge === 'final') {
      // Inside Sabi, an Atlas out of places can still hand over to Sizes.
      n.phase = 'vote';
      n.vote = openVote(
        n.seats.length,
        now,
        !n.tutorial,
        n.tribu
          ? last
            ? ['size', 'finish']
            : ['miro', 'size', 'finish']
          : undefined,
      );
      note(n, `Round ${n.round} complete. Another round?`);
    } else {
      n.challenge = challenges[challenges.indexOf(n.challenge) + 1];
      reveal(n);
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
function closeRound(g: GeoGame) {
  const opening = !!g.vote!.opening,
    options = voteOptions(g.vote);
  const keep = opening
    ? null
    : g.tribu
      ? options.includes('miro')
        ? 'miro'
        : 'size'
      : 'more';
  const choice = voteResult(g.vote!, keep, (n) => Math.floor(roll(g) * n));
  g.vote = null;
  if (opening) {
    // Sabi's first vote: the places are dealt, or the table goes to Sizes.
    if (choice === 'size') g.handoff = 'size';
    else g.phase = 'guess';
    note(g, `The table chose ${choice === 'size' ? 'Sizes' : 'Atlas'}.`);
    return;
  }
  if (choice === 'finish' || g.round >= matchRounds) {
    // The finished table keeps the last reveal on screen.
    g.phase = 'reveal';
    g.over = true;
    note(
      g,
      `The table finished after ${g.round} round${g.round === 1 ? '' : 's'}.`,
    );
    return;
  }
  g.round++;
  if (choice === 'size') {
    g.handoff = 'size';
    return;
  }
  g.challenge = 'easy';
  deal(g);
}
/** The server owns the deadlines. Missing selections fall back to the
 * captain's frozen pins; silent voters don't count. */
export function tick(g: GeoGame, now = Date.now()): GeoGame {
  if (g.phase === 'vote') {
    if (g.over || !g.vote || !voteClosed(g.vote, now)) return g;
    const n = structuredClone(g);
    n.revision++;
    closeRound(n);
    return n;
  }
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
  // Practice bots play the classic two rounds, then vote to finish.
  if (g.phase === 'vote')
    return {
      type: 'vote',
      choice: g.vote?.opening
        ? s % 2
          ? 'size'
          : 'miro'
        : g.round >= 2
          ? 'finish'
          : g.tribu
            ? voteOptions(g.vote)[0]
            : 'more',
    };
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
  const opening = g.phase === 'vote' && !!g.vote?.opening;
  return (
    g.rules === 10 &&
    ['guess', 'discuss', 'reveal', 'vote'].includes(g.phase) &&
    (g.phase === 'vote'
      ? validVote(g.vote, g.seats.length)
      : g.vote === undefined || g.vote === null) &&
    (g.phase === 'discuss' && !g.tutorial
      ? typeof g.discussionEndsAt === 'number' &&
        Number.isFinite(g.discussionEndsAt) &&
        g.discussionEndsAt > 0
      : g.discussionEndsAt === null) &&
    Number.isInteger(g.round) &&
    g.round >= 1 &&
    (g.start === undefined ||
      (Number.isInteger(g.start) && g.start > 1 && g.start <= g.round)) &&
    placeRound(g) <= maxRounds(g) &&
    challenges.includes(g.challenge) &&
    (g.phase === 'reveal' || g.phase === 'vote' || g.challenge === 'easy') &&
    Array.isArray(g.deck) &&
    g.deck.length >= 6 &&
    g.deck.length % 3 === 0 &&
    ids(g.deck, g.deck.length) &&
    ids(g.cityIds, 3) &&
    g.cityIds.every((id, p) => id === g.deck[(placeRound(g) - 1) * 3 + p]) &&
    g.deck.every((id, i) =>
      i % 3 === 2
        ? isFinal(id)
        : !isFinal(id) &&
          places[id].difficulty === (i % 3 === 0 ? 'medium' : 'hard'),
    ) &&
    triple(g.prompts) &&
    g.prompts.every(
      (p) =>
        p &&
        p.difficulty === places[g.cityIds[g.prompts.indexOf(p)]]?.difficulty &&
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
    (g.phase === 'guess' || opening || g.guesses.every((b) => b.locked)) &&
    (g.phase !== 'discuss' ||
      (g.mode === 'teams' &&
        g.turn < g.scores.length &&
        !g.choices[activeTeam(g)].locked)) &&
    (g.phase === 'reveal' || (g.phase === 'vote' && !opening)
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
        g.result.gains.every(
          (v) =>
            Number.isInteger(v) && v >= 0 && v <= closestPoints + nearPoints,
        )
      : g.result === null) &&
    (!g.over || (g.challenge === 'final' && g.phase !== 'guess'))
  );
}

export function placeHistoryKey(id: number): string {
  const place = places[id];
  return `${place.country}:${place.name}`;
}
