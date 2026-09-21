/** Orin — a cooperative watch over a fogged lighthouse coast.
 *
 * Seven lighthouses stand west to east on one rock band. A fog bank rolls in from
 * the west and takes one more lighthouse at the end of every watch, and the gale
 * puts out the westernmost lamp still burning. Keepers spend tools to hold the
 * line. A watch is always four keeper turns however many keepers are on duty, so
 * a solo coast is the same coast a full crew faces; the hand size scales the other
 * way, so every table size holds at roughly the same tension.
 *
 * The keepers share no information: hands are private and the only thing anyone
 * may say is one bell each, which marks a station and nothing more.
 */
import {
  type Difficulty,
  type LogEntry,
  type Outcome,
  type WorldBase,
  bools,
  ints,
  isBot,
  note,
  roll,
  shuffle,
  validBase,
} from './types.ts';

export const STATIONS = 7;
/** Watches survived to hold the coast. */
export const WATCHES = 5;
/** Lamps that must still burn when a watch ends. */
export const SURVIVE = 4;
/** Lamps the gale takes from the west at every watch end. */
export const GALE = 2;
/** Keeper turns in one watch, whatever the crew size. */
export const TURNS = 4;

/** wick, lamp, shutter, rope. The bell is not a card; it is the one word allowed. */
export type Tool = 0 | 1 | 2 | 3;
export const toolNames = ['Wick', 'Lamp', 'Shutter', 'Rope'] as const;
export const toolHelp = [
  'Relight one dark lighthouse the fog has not reached.',
  'Relight one dark lighthouse anywhere, fog or no fog.',
  'Shutter one burning lighthouse; the next gale passes it by.',
  'Anchor one lighthouse the fog holds; the fog lets that one go for good.',
] as const;

/** The deck the service issues. Lamps are scarce because they reach into the fog. */
const DECK: Tool[] = [
  ...Array<Tool>(14).fill(0),
  ...Array<Tool>(10).fill(1),
  ...Array<Tool>(10).fill(2),
  ...Array<Tool>(6).fill(3),
];

export type CoastGame = WorldBase & {
  kind: 'coast';
  /** Which lighthouses are burning, west to east. */
  lit: boolean[];
  /** Shuttered lighthouses survive the coming gale; cleared every watch. */
  shuttered: boolean[];
  /** Roped stations the fog no longer holds. Permanent, unlike a shutter. */
  anchored: boolean[];
  /** How far the fog has come from the west. It only ever grows. */
  fog: number;
  watch: number;
  /** Keeper turns left in this watch. */
  turns: number;
  /** The keeper whose turn it is. */
  actor: number;
  hands: Tool[][];
  deck: Tool[];
  discard: Tool[];
  /** One bell each, spent or not. */
  bells: boolean[];
  /** The station each keeper rang for, or -1. The only shared word in the game. */
  signals: number[];
  /** Set when the coast is held or lost. */
  held: boolean | null;
};

export type CoastMove =
  | { type: 'tool'; slot: number; station: number }
  | { type: 'bell'; station: number }
  /** Stand the watch. Always available, and the only move when nothing can be
   * played — without it a full, quiet coast would wedge the turn order. */
  | { type: 'stand' };

/** A solo keeper takes all four turns of a watch, so they hold a deeper hand. */
/** Four turns is a watch whatever the crew size, so a lone keeper makes every one
 * of those turns and a crew of four makes one each. Measurement, not instinct,
 * set these: a bigger crew needs the deeper hand, because each keeper chooses
 * from their own cards alone and may not say what they are holding. */
export const handSize = (seats: number) => Math.max(7, 5 + seats);

export const seatChoices = [1, 2, 3, 4];
export const defaultSeats = 2;

const inFog = (fog: number, anchored: boolean[], i: number) =>
  i < fog && !anchored[i];
const fogged = (g: CoastGame, i: number) => inFog(g.fog, g.anchored, i);
export const litCount = (g: CoastGame) => g.lit.filter(Boolean).length;

function draw(g: CoastGame, seat: number) {
  const want = handSize(g.seats.length);
  while (g.hands[seat].length < want) {
    if (!g.deck.length) {
      if (!g.discard.length) break;
      g.deck = shuffle(g.discard, () => roll(g));
      g.discard = [];
    }
    g.hands[seat].push(g.deck.shift()!);
  }
}

export function createGame(
  seats: number,
  seed: number,
  difficulty: Difficulty,
  names?: string[],
): CoastGame {
  const g: CoastGame = {
    kind: 'coast',
    version: 1,
    rules: 1,
    rngState: seed >>> 0,
    difficulty,
    seats:
      names?.slice(0, seats) ??
      ['You', 'Bris', 'Halla', 'Tove'].slice(0, seats),
    revision: 0,
    log: [] as LogEntry[],
    over: false,
    // Four burning, three dark: the coast is already short-handed at first light.
    lit: [false, false, true, true, true, true, false],
    shuttered: Array<boolean>(STATIONS).fill(false),
    anchored: Array<boolean>(STATIONS).fill(false),
    fog: 0,
    watch: 1,
    turns: TURNS,
    actor: 0,
    hands: Array.from({ length: seats }, () => [] as Tool[]),
    deck: [],
    discard: [],
    bells: Array<boolean>(seats).fill(false),
    signals: Array<number>(seats).fill(-1),
    held: null,
  };
  g.deck = shuffle(DECK, () => roll(g));
  for (let s = 0; s < seats; s++) draw(g, s);
  note(g, `Watch 1. Four lamps burning, three dark.`);
  return g;
}

export const actingSeats = (g: CoastGame) => (g.over ? [] : [g.actor]);

/** Hands are private; the bell is the only thing a keeper may share. */
export function observe(g: CoastGame, viewer: number): CoastGame {
  return {
    ...g,
    hands: g.hands.map((h, s) => (s === viewer ? h : h.map(() => -1 as Tool))),
    deck: g.deck.map(() => -1 as Tool),
    discard: g.discard.map(() => -1 as Tool),
  };
}

export function validMove(g: CoastGame, m: unknown, seat: number): boolean {
  if (g.over || !m || typeof m !== 'object') return false;
  const move = m as CoastMove;
  if (move.type === 'bell')
    return (
      !g.bells[seat] &&
      Number.isInteger(move.station) &&
      move.station >= 0 &&
      move.station < STATIONS
    );
  if (seat !== g.actor) return false;
  if (move.type === 'stand') return true;
  if (move.type !== 'tool') return false;
  const hand = g.hands[seat];
  if (!Number.isInteger(move.slot) || move.slot < 0 || move.slot >= hand.length)
    return false;
  const tool = hand[move.slot];
  // A hidden hand cannot be played from; observers never hold real slots.
  if (tool < 0) return false;
  if (
    !Number.isInteger(move.station) ||
    move.station < 0 ||
    move.station >= STATIONS
  )
    return false;
  if (tool === 3) return fogged(g, move.station);
  if (tool === 0) return !g.lit[move.station] && !fogged(g, move.station);
  if (tool === 1) return !g.lit[move.station];
  return g.lit[move.station] && !g.shuttered[move.station];
}

export function legalMoves(g: CoastGame, seat: number): CoastMove[] {
  const moves: CoastMove[] = [];
  for (let slot = 0; slot < g.hands[seat].length; slot++)
    for (let station = 0; station < STATIONS; station++) {
      const move: CoastMove = { type: 'tool', slot, station };
      if (validMove(g, move, seat)) moves.push(move);
    }
  if (!g.bells[seat])
    for (let station = 0; station < STATIONS; station++)
      moves.push({ type: 'bell', station });
  moves.push({ type: 'stand' });
  return moves.filter((m) => validMove(g, m, seat));
}

const place = (i: number) => `station ${i + 1}`;

/** What the gale and the fog leave behind when a watch ends. Pure: the bot reads
 * the same function the coast is actually resolved with. */
export function nightfall(
  lit: boolean[],
  shuttered: boolean[],
  anchored: boolean[],
  fog: number,
): { lit: boolean[]; fog: number; gale: number[] } {
  const next = [...lit];
  // The gale takes the westernmost lamps still burning that nobody shuttered.
  const gale: number[] = [];
  for (let i = 0; i < STATIONS && gale.length < GALE; i++)
    if (next[i] && !shuttered[i]) {
      next[i] = false;
      gale.push(i);
    }
  const grown = Math.min(fog + 1, STATIONS);
  // Everything the fog still holds goes out, unless shuttered against the night.
  for (let i = 0; i < grown; i++)
    if (inFog(grown, anchored, i) && !shuttered[i]) next[i] = false;
  return { lit: next, fog: grown, gale };
}

function endWatch(g: CoastGame) {
  const before = [...g.lit];
  const { lit, fog, gale } = nightfall(g.lit, g.shuttered, g.anchored, g.fog);
  if (gale.length)
    note(g, `The gale puts out ${gale.map(place).join(' and ')}.`);
  const swallowed = before.flatMap((on, i) =>
    on && !lit[i] && !gale.includes(i) ? [i] : [],
  );
  if (swallowed.length)
    note(g, `The fog swallows ${swallowed.map(place).join(' and ')}.`);
  else if (fog > g.fog) note(g, `The fog reaches ${place(fog - 1)}.`);
  g.lit = lit;
  g.fog = fog;
  g.shuttered = g.shuttered.map(() => false);
  const burning = litCount(g);
  if (burning < SURVIVE) {
    g.over = true;
    g.held = false;
    note(g, `Only ${burning} lamps left. The coast is lost.`);
    return;
  }
  if (g.watch >= WATCHES) {
    g.over = true;
    g.held = true;
    note(g, `Dawn. ${burning} lamps still burning; the coast held.`);
    return;
  }
  g.watch += 1;
  g.turns = TURNS;
  note(g, `Watch ${g.watch}. ${burning} lamps burning.`);
}

export function play(g: CoastGame, m: CoastMove, seat: number): CoastGame {
  if (!validMove(g, m, seat)) return g;
  const next: CoastGame = {
    ...g,
    lit: [...g.lit],
    shuttered: [...g.shuttered],
    anchored: [...g.anchored],
    hands: g.hands.map((h) => [...h]),
    deck: [...g.deck],
    discard: [...g.discard],
    bells: [...g.bells],
    signals: [...g.signals],
    log: [...g.log],
    revision: g.revision + 1,
  };
  if (m.type === 'stand') {
    note(next, `${next.seats[seat]} stands the watch.`, seat);
    next.turns -= 1;
    next.actor = (next.actor + 1) % next.seats.length;
    if (next.turns <= 0) endWatch(next);
    return next;
  }
  if (m.type === 'bell') {
    next.bells[seat] = true;
    next.signals[seat] = m.station;
    note(
      next,
      `${next.seats[seat]} rings the bell for ${place(m.station)}.`,
      seat,
    );
    return next;
  }
  const tool = next.hands[seat].splice(m.slot, 1)[0];
  next.discard.push(tool);
  if (tool === 0 || tool === 1) {
    next.lit[m.station] = true;
    note(
      next,
      `${next.seats[seat]} relights ${place(m.station)}${tool === 1 ? ' through the fog' : ''}.`,
      seat,
    );
  } else if (tool === 2) {
    next.shuttered[m.station] = true;
    note(next, `${next.seats[seat]} shutters ${place(m.station)}.`, seat);
  } else {
    next.anchored[m.station] = true;
    note(
      next,
      `${next.seats[seat]} ropes ${place(m.station)} out of the fog.`,
      seat,
    );
  }
  draw(next, seat);
  next.turns -= 1;
  next.actor = (next.actor + 1) % next.seats.length;
  if (next.turns <= 0) endWatch(next);
  return next;
}

/** How much a coast is worth holding. What matters is not how many lamps burn
 * now but how many survive the night, so the bot scores the coast through the
 * same nightfall the watch will actually be resolved with. */
function value(g: CoastGame) {
  const survivors = nightfall(g.lit, g.shuttered, g.anchored, g.fog).lit.filter(
    Boolean,
  ).length;
  let score = survivors * 14 + (survivors >= SURVIVE ? 40 : 0);
  for (let i = 0; i < STATIONS; i++) {
    if (g.lit[i]) score += 3 + (fogged(g, i) ? 0 : 1);
    // Ground the fog cannot take is ground a wick can still reach next watch.
    if (!inFog(STATIONS, g.anchored, i) || i >= g.fog) score += 2;
  }
  return score;
}

function best(g: CoastGame, seat: number): CoastMove | null {
  const moves = legalMoves(g, seat).filter((m) => m.type !== 'bell');
  if (!moves.length) return null;
  let top: CoastMove = moves[0],
    bestScore = -Infinity;
  for (const m of moves) {
    // Score the coast the move leaves behind, one watch-end deep.
    const after = play(g, m, seat);
    let score = value(after) + (after.over && after.held ? 100 : 0);
    if (after.over && after.held === false) score -= 200;
    if (score > bestScore) {
      bestScore = score;
      top = m;
    }
  }
  return top;
}

/** In a cooperative game bot difficulty is bot *skill*: careless keepers lose the
 * coast, so an easy crew makes Orin harder rather than easier. */
const care: Record<Difficulty, number> = { easy: 0.3, medium: 0.7, hard: 1 };

export function botMove(g: CoastGame, seat: number): CoastMove | null {
  if (g.over || seat !== g.actor) return null;
  const tools = legalMoves(g, seat).filter((m) => m.type !== 'bell');
  if (!tools.length) return null;
  // Deciding must not advance the match's own stream, or a replay would diverge.
  const dice = { rngState: g.rngState };
  const careful = roll(dice) < care[g.difficulty];
  if (!careful) {
    const played = tools.filter((m) => m.type === 'tool');
    // A careless keeper still prefers doing something to doing nothing.
    const pool = played.length ? played : tools;
    return pool[Math.floor(roll(dice) * pool.length)];
  }
  return best(g, seat) ?? tools[0];
}

export function outcome(g: CoastGame): Outcome {
  const burning = litCount(g);
  return {
    title: g.held ? 'The coast held' : 'The coast went dark',
    detail: g.held
      ? `Four watches, ${burning} lamps still burning at dawn.`
      : `The fog took the coast in watch ${g.watch}.`,
    // A co-op is won or lost by everyone at once.
    winners: g.held ? g.seats.map((_, s) => s) : [],
    rows: [
      { name: 'Lamps burning', value: `${burning} of ${STATIONS}` },
      {
        name: 'Watches held',
        value: `${g.held ? WATCHES : g.watch - 1} of ${WATCHES}`,
      },
    ],
  };
}

export function progress(g: CoastGame) {
  return {
    label: `Watch ${Math.min(g.watch, WATCHES)} / ${WATCHES}`,
    detail: g.over
      ? outcome(g).detail
      : `${litCount(g)} lamps burning · ${g.turns} turn${g.turns === 1 ? '' : 's'} left in this watch`,
  };
}

export function validState(g: unknown): g is CoastGame {
  if (!validBase(g, 'coast')) return false;
  const c = g as CoastGame;
  const n = c.seats.length;
  const tools = (a: unknown, hidden = false): a is Tool[] =>
    Array.isArray(a) &&
    a.every((t) => Number.isInteger(t) && t >= (hidden ? -1 : 0) && t <= 3);
  return (
    seatChoices.includes(n) &&
    bools(c.lit, STATIONS) &&
    bools(c.shuttered, STATIONS) &&
    bools(c.anchored, STATIONS) &&
    Number.isInteger(c.fog) &&
    c.fog >= 0 &&
    c.fog <= STATIONS &&
    Number.isInteger(c.watch) &&
    c.watch >= 1 &&
    c.watch <= WATCHES &&
    Number.isInteger(c.turns) &&
    c.turns >= 0 &&
    c.turns <= TURNS &&
    Number.isInteger(c.actor) &&
    c.actor >= 0 &&
    c.actor < n &&
    Array.isArray(c.hands) &&
    c.hands.length === n &&
    c.hands.every((h) => h.length <= handSize(n) && tools(h, true)) &&
    tools(c.deck, true) &&
    tools(c.discard, true) &&
    bools(c.bells, n) &&
    ints(c.signals, n, -1, STATIONS - 1) &&
    (c.held === null || typeof c.held === 'boolean') &&
    (c.over ? c.held !== null : c.held === null)
  );
}

export { isBot };
