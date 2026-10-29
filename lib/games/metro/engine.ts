import {
  LINE_COUNT,
  MAP_IDS,
  SHAPES,
  SIDES,
  maps,
  otherEnd,
  type CityMap,
  type MapId,
  type Shape,
  type Side,
} from './map.ts';
import {
  BONUS_IDS,
  GOAL_IDS,
  component,
  finalScore,
  lineScore,
  type BonusId,
  type Final,
  type GoalId,
  type LineScore,
  type Section,
} from './score.ts';

/**
 * Metro: everyone draws metro lines on their own map of the same city, all
 * at once. Each round is one line colour, and every colour starts from two
 * stations, one on each bank. Each turn a card flips: it names a bank and a
 * station shape, and you may draw one section from an end of that bank's
 * line to the next station of that shape. A round ends on the turn the fifth
 * card of either bank flips. Lines score districts times their busiest
 * district, plus 10 for joining both starts; stations on several lines score
 * at the end of the fourth round.
 *
 * Each seat draws in private and locks its turn with Done; when every seat
 * has, the next card flips. A seat's sections from the turn in play stay
 * hidden from the others.
 */
export const METRO_RULES = 1;
export const ROUNDS = 4;
/** A round ends on the turn this many cards of one bank have flipped. */
export const BANK_CARDS = 5;
export type Difficulty = 'easy' | 'medium' | 'hard';
export type Extension = 'goals' | 'express';
export const EXTENSIONS: Extension[] = ['goals', 'express'];
export type Extensions = Record<Extension, boolean>;
export const noExtensions: Extensions = { goals: false, express: false };

/** A bank card names a shape or any station; `sw` is the railway switch. */
export type Card = 'sw' | `${Side}:${Shape | 'any'}`;
export const DECK: Card[] = [
  ...SIDES.flatMap((side) =>
    [...SHAPES, 'any' as const].map((s) => `${side}:${s}` as Card),
  ),
  'sw',
];
export const cardSide = (c: Card): Side | null =>
  c === 'sw' ? null : (c.split(':')[0] as Side);
export const cardShape = (c: Card): Shape | 'any' | null =>
  c === 'sw' ? null : (c.split(':')[1] as Shape | 'any');

export type MetroSeat = {
  name: string;
  bot: boolean;
  /** The colour this seat draws in each round. */
  order: number[];
  sections: Section[];
  /** Stations boxed by wild cards. */
  boxed: number[];
  locked: boolean;
  /** Each finished round's line. */
  lines: LineScore[];
  /** Sections the others have not seen yet (only in an observation). */
  hidden?: number;
};

export type LogEntry = { id: number; seat?: number; text: string };

export type MetroGame = {
  kind: 'metro';
  version: 1;
  rules: typeof METRO_RULES;
  revision: number;
  rngState: number;
  difficulty: Difficulty;
  map: MapId;
  ext: Extensions;
  round: number;
  rounds: typeof ROUNDS;
  /** Turn within the round, from 1. */
  turn: number;
  /** Cards still to flip, top first. An observation keeps only what the
   *  table may see (the top card under Peek). */
  deck: Card[];
  /** How many cards are left, in an observation. */
  deckSize?: number;
  /** Cards flipped this round, in order. */
  shown: Card[];
  /** This turn's cards: one bank card, or the switch and the card after it. */
  cards: Card[];
  /** This turn is the round's last. */
  last: boolean;
  /** Express's Repeat has put the switch back once this round. */
  repeated: boolean;
  goals: GoalId[];
  /** Express: the bonus of each round. */
  express: BonusId[];
  seats: MetroSeat[];
  over: boolean;
  final: Final[] | null;
  log: LogEntry[];
};

export type MetroMove =
  | { type: 'draw'; from: number; to: number }
  | { type: 'undo' }
  | { type: 'done' }
  | { type: 'reopen' };

export type MetroOptions = {
  map?: MapId;
  ext?: Partial<Extensions>;
  difficulty?: Difficulty;
  names?: string[];
  /** Which seats are bots; seat 0 is always a person in solo play. */
  bots?: boolean[];
};

export const botNames = ['You', 'Iris', 'Otto', 'Lena', 'Milo', 'Nora'];
export const MAX_SEATS = 6;

function random(g: { rngState: number }) {
  g.rngState = (Math.imul(g.rngState, 1664525) + 1013904223) >>> 0;
  return g.rngState / 4294967296;
}
function shuffled<T>(g: { rngState: number }, list: readonly T[]): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random(g) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function note(g: MetroGame, text: string, seat?: number) {
  g.log.push(
    seat === undefined
      ? { id: g.log.length, text }
      : { id: g.log.length, seat, text },
  );
  if (g.log.length > 80) g.log = g.log.slice(-80);
}

export const mapOf = (g: Pick<MetroGame, 'map'>): CityMap => maps[g.map];
export const bonusOf = (g: MetroGame): BonusId | null =>
  g.ext.express ? (g.express[g.round - 1] ?? null) : null;
export const colourOf = (g: MetroGame, seat: number) =>
  g.seats[seat].order[g.round - 1];

/** Flips the turn's card, and the next one too after the switch. */
function flip(g: MetroGame) {
  const c = g.deck.shift()!;
  g.shown.push(c);
  if (c === 'sw') {
    const next = g.deck.shift()!;
    g.shown.push(next);
    g.cards = ['sw', next];
  } else g.cards = [c];
  g.last = SIDES.some(
    (side) => g.shown.filter((x) => cardSide(x) === side).length >= BANK_CARDS,
  );
}

function startRound(g: MetroGame) {
  g.turn = 1;
  g.deck = shuffled(g, DECK);
  g.shown = [];
  g.repeated = false;
  flip(g);
}

export function createMetro(
  seats: number,
  seed: number,
  opt: MetroOptions = {},
): MetroGame {
  const map = opt.map && MAP_IDS.includes(opt.map) ? opt.map : 'city';
  const g: MetroGame = {
    kind: 'metro',
    version: 1,
    rules: METRO_RULES,
    revision: 0,
    rngState: seed >>> 0 || 1,
    difficulty: opt.difficulty ?? 'medium',
    map,
    ext: { ...noExtensions, ...opt.ext },
    round: 1,
    rounds: ROUNDS,
    turn: 1,
    deck: [],
    shown: [],
    cards: [],
    last: false,
    repeated: false,
    goals: [],
    express: [],
    seats: [],
    over: false,
    final: null,
    log: [],
  };
  random(g);
  // Alone, the colours come in a random order; at a table each seat starts
  // one colour on from its neighbour, so everyone draws all four.
  const solo = shuffled(
    g,
    Array.from({ length: LINE_COUNT }, (_, i) => i),
  );
  const offset = Math.floor(random(g) * LINE_COUNT);
  g.seats = Array.from({ length: seats }, (_, s) => ({
    name: opt.names?.[s] ?? botNames[s] ?? `Player ${s + 1}`,
    bot: opt.bots?.[s] ?? s > 0,
    order:
      seats === 1
        ? solo
        : Array.from(
            { length: ROUNDS },
            (_, r) => (offset + s + r) % LINE_COUNT,
          ),
    sections: [],
    boxed: [],
    locked: false,
    lines: [],
  }));
  if (g.ext.goals) g.goals = shuffled(g, GOAL_IDS).slice(0, 2);
  if (g.ext.express) {
    const b = shuffled(g, BONUS_IDS).slice(0, ROUNDS);
    // Parallel needs lines already drawn: never in the first round.
    if (b[0] === 'parallel') [b[0], b[1]] = [b[1], b[0]];
    g.express = b;
  }
  startRound(g);
  note(g, `Round 1 of ${ROUNDS}`);
  return g;
}

/** This turn's sections on a seat's map. */
export const draftOf = (g: MetroGame, seat: number) =>
  g.seats[seat].sections.filter((s) => s.r === g.round && s.t === g.turn);

export type LineState = {
  colour: number;
  sections: Section[];
  /** Stations on each bank's half: [moon, sun]. One set when joined. */
  halves: Set<number>[];
  joined: boolean;
  /** How many sections of the colour touch each station. */
  degree: Map<number, number>;
};

/** Where a seat's line of this round stands. */
export function lineState(g: MetroGame, seat: number): LineState {
  const m = mapOf(g);
  const colour = colourOf(g, seat);
  const sections = g.seats[seat].sections.filter((s) => s.c === colour);
  const [moon, sun] = m.starts[colour];
  const a = component(m, sections, moon);
  const joined = a.has(sun);
  const degree = new Map<number, number>();
  for (const s of sections)
    for (const st of [m.edges[s.e].a, m.edges[s.e].b])
      degree.set(st, (degree.get(st) ?? 0) + 1);
  return {
    colour,
    sections,
    halves: joined ? [a] : [a, component(m, sections, sun)],
    joined,
    degree,
  };
}

/** The ends of one half: stations with at most one section of the colour. */
export const endsOf = (ls: LineState, half: Set<number>) =>
  [...half].filter((s) => (ls.degree.get(s) ?? 0) <= 1);

/** The stations a section may start from this turn. */
export function fromStations(g: MetroGame, seat: number): number[] {
  if (g.over || g.seats[seat].locked) return [];
  const ls = lineState(g, seat);
  const draft = draftOf(g, seat);
  if (g.cards[0] === 'sw') {
    if (draft.length >= 2) return [];
    // The switch: one section on each half, from any of its stations; two
    // anywhere on a joined line.
    if (ls.joined) return [...ls.halves[0]];
    const used = ls.halves.map((h) => draft.some((d) => h.has(d.from)));
    return ls.halves.flatMap((h, i) => (used[i] ? [] : [...h]));
  }
  if (draft.length >= 1) return [];
  if (ls.joined) return endsOf(ls, ls.halves[0]);
  const side = cardSide(g.cards[0]);
  return endsOf(ls, ls.halves[side === 'moon' ? 0 : 1]);
}

/** The shape a section must reach this turn. */
export const targetShape = (g: MetroGame): Shape | 'any' =>
  cardShape(g.cards[g.cards.length - 1])!;

/** Whether `to` may be reached from `from` this turn. */
function canDraw(
  g: MetroGame,
  seat: number,
  ls: LineState,
  from: number,
  edge: number,
): boolean {
  const m = mapOf(g);
  const to = otherEnd(m, edge, from);
  const shape = targetShape(g);
  if (shape !== 'any' && m.stations[to].shape !== shape) return false;
  // No loops: the station must not already be on this half. The other
  // half of the same colour may be met: that joins the line.
  const half = ls.halves.find((h) => h.has(from))!;
  if (half.has(to)) return false;
  const own = g.seats[seat].sections;
  const parallel = bonusOf(g) === 'parallel';
  for (const s of own) {
    if (s.e === edge && (!parallel || s.c === ls.colour)) return false;
    if (m.crosses[edge].includes(s.e)) return false;
  }
  return true;
}

export type Draw = { from: number; to: number };

/** Every section this seat may draw next. */
export function legalDraws(g: MetroGame, seat: number): Draw[] {
  const froms = fromStations(g, seat);
  if (!froms.length) return [];
  const m = mapOf(g);
  const ls = lineState(g, seat);
  const out: Draw[] = [];
  for (const from of froms)
    for (const e of m.adj[from])
      if (canDraw(g, seat, ls, from, e))
        out.push({ from, to: otherEnd(m, e, from) });
  return out;
}

export function actingSeats(g: MetroGame) {
  return g.over ? [] : g.seats.flatMap((s, i) => (s.locked ? [] : [i]));
}

const isInt = (v: unknown, lo: number, hi: number): v is number =>
  Number.isInteger(v) && (v as number) >= lo && (v as number) <= hi;

export function validMove(
  g: MetroGame,
  m: unknown,
  seat: number,
): m is MetroMove {
  if (!m || typeof m !== 'object' || g.over) return false;
  const s = g.seats[seat];
  if (!s) return false;
  const mv = m as Record<string, unknown>;
  const n = mapOf(g).stations.length;
  switch (mv.type) {
    case 'draw':
      return (
        !s.locked &&
        isInt(mv.from, 0, n - 1) &&
        isInt(mv.to, 0, n - 1) &&
        legalDraws(g, seat).some((d) => d.from === mv.from && d.to === mv.to)
      );
    case 'undo':
      return !s.locked && draftOf(g, seat).length > 0;
    case 'done':
      return !s.locked;
    case 'reopen':
      return s.locked;
    default:
      return false;
  }
}

/** A seat's score for the round in play, as it stands. */
export const liveLine = (g: MetroGame, seat: number) =>
  lineScore(mapOf(g), g.seats[seat].sections, colourOf(g, seat), bonusOf(g));

/** A seat's whole score so far: finished rounds, the round in play,
 *  stations on several lines and goals reached. */
export function scoreSeat(g: MetroGame, seat: number): Final {
  const s = g.seats[seat];
  const lines =
    g.over || s.lines.length >= g.round
      ? s.lines
      : [...s.lines, liveLine(g, seat)];
  return finalScore(mapOf(g), lines, s.sections, s.boxed, g.goals);
}

function endRound(g: MetroGame) {
  const m = mapOf(g);
  const bonus = bonusOf(g);
  g.seats.forEach((s, i) => {
    s.lines.push(lineScore(m, s.sections, colourOf(g, i), bonus));
  });
  if (g.round >= ROUNDS) {
    g.over = true;
    g.final = g.seats.map((s) =>
      finalScore(m, s.lines, s.sections, s.boxed, g.goals),
    );
    note(g, 'Final scores');
    return;
  }
  g.round++;
  startRound(g);
  note(g, `Round ${g.round} of ${ROUNDS}`);
}

function endTurn(g: MetroGame) {
  for (const s of g.seats) s.locked = false;
  if (g.last) return endRound(g);
  // Repeat sends the switch back into the pile once a round.
  if (g.cards[0] === 'sw' && bonusOf(g) === 'repeat' && !g.repeated) {
    g.repeated = true;
    const at = Math.floor(random(g) * (g.deck.length + 1));
    g.deck.splice(at, 0, 'sw');
  }
  g.turn++;
  flip(g);
}

/** Applies a valid move. Returns a new state; the input is not changed. */
export function play(g0: MetroGame, m: MetroMove, seat: number): MetroGame {
  if (!validMove(g0, m, seat)) return g0;
  const g = structuredClone(g0);
  const s = g.seats[seat];
  const map = mapOf(g);
  switch (m.type) {
    case 'draw': {
      const e = map.pair.get(
        Math.min(m.from, m.to) * 1000 + Math.max(m.from, m.to),
      )!;
      const sec: Section = {
        e,
        c: colourOf(g, seat),
        r: g.round,
        t: g.turn,
        from: m.from,
      };
      // A wild card makes the station reached a grand station (boxed).
      if (targetShape(g) === 'any' && !s.boxed.includes(m.to)) {
        s.boxed.push(m.to);
        sec.box = 1;
      }
      s.sections.push(sec);
      break;
    }
    case 'undo': {
      const draft = draftOf(g, seat);
      const last = draft[draft.length - 1];
      s.sections.splice(s.sections.lastIndexOf(last), 1);
      if (last.box) {
        const to = otherEnd(map, last.e, last.from);
        s.boxed = s.boxed.filter((b) => b !== to);
      }
      break;
    }
    case 'done':
      s.locked = true;
      break;
    case 'reopen':
      s.locked = false;
      break;
  }
  g.revision++;
  if (m.type === 'done' && g.seats.every((x) => x.locked)) endTurn(g);
  return g;
}

/** What `viewer` may see: others' sections from the turn in play are
 *  hidden, and the cards to come stay unknowable (but for Peek's top card). */
export function observe(g: MetroGame, viewer: number): MetroGame {
  const deckSize = g.deck.length;
  const deck = g.over ? [] : bonusOf(g) === 'peek' ? g.deck.slice(0, 1) : [];
  if (g.over) return { ...g, rngState: 0, deck, deckSize };
  return {
    ...g,
    rngState: 0,
    deck,
    deckSize,
    seats: g.seats.map((s, i) => {
      if (i === viewer) return s;
      const hidden = s.sections.filter(
        (x) => x.r === g.round && x.t === g.turn,
      );
      if (!hidden.length) return s;
      const m = mapOf(g);
      const unboxed = new Set(
        hidden.filter((x) => x.box).map((x) => otherEnd(m, x.e, x.from)),
      );
      return {
        ...s,
        sections: s.sections.filter((x) => !hidden.includes(x)),
        boxed: s.boxed.filter((b) => !unboxed.has(b)),
        hidden: hidden.length,
      };
    }),
  };
}

/** Cards that may still flip this round, from what everyone has seen. */
export function unseen(g: MetroGame): Card[] {
  const left = [...DECK];
  for (const c of g.shown) {
    const i = left.indexOf(c);
    if (i >= 0) left.splice(i, 1);
  }
  // Repeat put the switch back after its first flip.
  if (g.repeated && !left.includes('sw') && g.shown.filter((c) => c === 'sw').length < 2)
    left.push('sw');
  return left;
}

export type MetroOutcome = {
  title: string;
  detail: string;
  winners: number[];
  rows: { name: string; value: string; seat: number; points: number }[];
};

/** Most points wins; the best single colour breaks a tie. */
export function outcome(g: MetroGame): MetroOutcome {
  const finals = g.final ?? g.seats.map((_, i) => scoreSeat(g, i));
  const key = (i: number) => finals[i].total * 1000 + finals[i].best;
  const top = Math.max(...finals.map((_, i) => key(i)));
  const winners = g.seats.flatMap((_, i) => (key(i) === top ? [i] : []));
  const names = winners.map((i) => g.seats[i].name);
  const solo = g.seats.length === 1;
  return {
    title: solo
      ? `${finals[0].total} points`
      : `${names.join(' & ')} ${names.length > 1 ? 'tie' : names[0] === 'You' ? 'win' : 'wins'}`,
    detail: `${ROUNDS} lines`,
    winners,
    rows: g.seats
      .map((s, i) => ({
        name: s.name,
        value: `${finals[i].total}`,
        seat: i,
        points: finals[i].total,
      }))
      .sort((a, b) => key(b.seat) - key(a.seat)),
  };
}

const isCard = (c: unknown): c is Card => DECK.includes(c as Card);

/** Checks a saved or received state before it is trusted. */
export function isMetroGame(v: unknown): v is MetroGame {
  try {
    const g = v as MetroGame;
    if (!g || g.kind !== 'metro' || g.version !== 1 || g.rules !== METRO_RULES)
      return false;
    if (!MAP_IDS.includes(g.map)) return false;
    const m = mapOf(g);
    const n = m.stations.length;
    return (
      Number.isInteger(g.revision) &&
      Number.isInteger(g.rngState) &&
      ['easy', 'medium', 'hard'].includes(g.difficulty) &&
      !!g.ext &&
      EXTENSIONS.every((e) => typeof g.ext[e] === 'boolean') &&
      g.rounds === ROUNDS &&
      isInt(g.round, 1, ROUNDS) &&
      isInt(g.turn, 1, 20) &&
      Array.isArray(g.deck) &&
      g.deck.every(isCard) &&
      Array.isArray(g.shown) &&
      g.shown.every(isCard) &&
      Array.isArray(g.cards) &&
      g.cards.length >= 1 &&
      g.cards.length <= 2 &&
      g.cards.every(isCard) &&
      typeof g.last === 'boolean' &&
      typeof g.repeated === 'boolean' &&
      Array.isArray(g.goals) &&
      g.goals.every((x) => GOAL_IDS.includes(x)) &&
      Array.isArray(g.express) &&
      g.express.every((x) => BONUS_IDS.includes(x)) &&
      typeof g.over === 'boolean' &&
      Array.isArray(g.log) &&
      Array.isArray(g.seats) &&
      g.seats.length >= 1 &&
      g.seats.length <= MAX_SEATS &&
      g.seats.every(
        (s) =>
          typeof s.name === 'string' &&
          typeof s.bot === 'boolean' &&
          typeof s.locked === 'boolean' &&
          Array.isArray(s.order) &&
          s.order.length === ROUNDS &&
          s.order.every((c) => isInt(c, 0, LINE_COUNT - 1)) &&
          Array.isArray(s.sections) &&
          s.sections.every(
            (x) =>
              isInt(x.e, 0, m.edges.length - 1) &&
              isInt(x.c, 0, LINE_COUNT - 1) &&
              isInt(x.r, 1, ROUNDS) &&
              isInt(x.from, 0, n - 1),
          ) &&
          Array.isArray(s.boxed) &&
          s.boxed.every((b) => isInt(b, 0, n - 1)) &&
          Array.isArray(s.lines),
      )
    );
  } catch {
    return false;
  }
}
