import { wordPairs, livePairIds } from './impostor-words.ts';
import {
  shuffle,
  roll,
  note,
  type Difficulty,
  type StandaloneBase,
} from '../standalone/types.ts';
import {
  voteClosed,
  isChoice,
  validVote,
  closeRound,
  openVote,
  voters,
  maxRounds,
  type RoundChoice,
  type RoundVote,
} from './vote.ts';

/** Impostor: everyone gets the same secret word, except the impostor, who
 * gets a close neighbour (Cat and Fox) and is not told. Everyone draws their
 * word at once against the clock, then sees every drawing and writes one
 * word for it, then accuses one player. The reveal shows who drew what. The
 * table host picks another round or the end. */
export type Stroke = {
  /** Ink: 0 graphite, 1 red, 2 blue. */
  c: number;
  /** Nib: 0 fine, 1 marker, 2 broad. */
  w: number;
  /** The points, x then y, each 0–1000 on a square card, packed two
   * characters a number (see `packPoints`), so a stroke fits a request. */
  p: string;
};
export type Sketch = { strokes: Stroke[]; locked: boolean };
export type Clue = { text: string; locked: boolean };
export type Accusation = { target: number | null; locked: boolean };
export type ImpostorMove =
  /** Drawings are saved stroke by stroke as they grow, so the clock can
   * lock whatever is on the card. */
  | { type: 'stroke'; stroke: Stroke }
  | { type: 'undo' | 'clear' }
  | { type: 'clue'; text: string }
  | { type: 'accuse'; target: number }
  | { type: 'vote'; choice: RoundChoice }
  | { type: 'lock' | 'unlock' | 'next' };
export type ImpostorResult = {
  /** Accusations each seat received. */
  tally: number[];
  /** Impostors with the most accusations (a tie at the top counts). */
  caught: number[];
  gains: number[];
};
export type ImpostorGame = StandaloneBase & {
  kind: 'impostor';
  rules: 1;
  mode: 'individual';
  teams: number[];
  round: number;
  tutorial: boolean;
  lesson: number;
  /** `reveal` only once the match is over: the last reveal stays up. */
  phase: 'draw' | 'clue' | 'accuse' | 'vote' | 'reveal';
  /** Kept for the shared decision key; Impostor has no spotlight. */
  target: 0;
  /** The round's pair; -1 for a viewer until the reveal. */
  pair: number;
  /** Each seat's secret word; another seat's reads '' until the reveal. */
  words: string[];
  /** Hidden from everyone until the reveal. */
  impostors: number[];
  /** Rounds each seat has been the impostor, so the role goes round. */
  turns: number[];
  sketches: Sketch[];
  clues: Clue[];
  accusations: Accusation[];
  /** Server-owned; null in practice. */
  drawEndsAt: number | null;
  scores: number[];
  deck: number[];
  vote: RoundVote | null;
  /** Setup turned table votes on; otherwise the host picks what next. */
  votes?: true;
  /** Impostor plays on its own, never inside a set. */
  tribu?: never;
  handoff?: never;
  result: ImpostorResult | null;
};

export const seatChoices = [3, 4, 5, 6, 7, 8];
export const drawMs = 80_000;
export const clueLimit = 20;
export const maxStrokes = 160;
export const maxPoints = 3000;
export const maxStrokePoints = 400;
const digits =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
/** Packs 0–1000 coordinates two characters each. */
export function packPoints(points: number[]) {
  return points
    .map((v) => {
      const n = Math.round(Math.min(1000, Math.max(0, v)));
      return digits[n >> 6] + digits[n & 63];
    })
    .join('');
}
export function unpackPoints(p: string): number[] {
  const out: number[] = [];
  for (let i = 0; i + 1 < p.length; i += 2)
    out.push(digits.indexOf(p[i]) * 64 + digits.indexOf(p[i + 1]));
  return out;
}
const packed = /^[A-Za-z0-9_-]*$/;
/** Points: a player who accuses an impostor finds them; an impostor
 * without the most accusations escapes. */
export const foundPoints = 2;
export const escapePoints = 5;
export const inks = ['#2b2a33', '#d2372b', '#2457b8'] as const;
export const nibs = [5, 11, 22] as const;

/** Two impostors from seven players on; one below. */
export function impostorCount(n: number) {
  return n >= 7 ? 2 : 1;
}
export const pairKey = (id: number) => `pair:${id}`;

export function createGame(
  n: number,
  seed: number,
  difficulty: Difficulty = 'medium',
  seen: ReadonlySet<string> = new Set(),
  now = Date.now(),
  votes = false,
): ImpostorGame {
  if (!seatChoices.includes(n))
    throw new Error('Choose 3–8 players for Impostor.');
  const g: ImpostorGame = {
    kind: 'impostor',
    version: 1,
    rules: 1,
    rngState: seed >>> 0,
    difficulty,
    seats: Array.from({ length: n }, (_, i) => (i ? `Player ${i + 1}` : 'You')),
    revision: 0,
    log: [],
    over: false,
    mode: 'individual',
    teams: Array.from({ length: n }, (_, i) => i),
    round: 1,
    tutorial: false,
    lesson: 0,
    phase: 'draw',
    target: 0,
    pair: -1,
    words: Array(n).fill(''),
    impostors: [],
    turns: Array(n).fill(0),
    sketches: [],
    clues: [],
    accusations: [],
    drawEndsAt: null,
    scores: Array(n).fill(0),
    deck: [],
    vote: null,
    ...(votes ? { votes: true as const } : {}),
    result: null,
  };
  // Pairs this table has not drawn before come first.
  const fresh = (id: number) => Number(seen.has(pairKey(id)));
  g.deck = shuffle(livePairIds, () => roll(g)).sort(
    (a, b) => fresh(a) - fresh(b),
  );
  deal(g, now);
  return g;
}

/** A new pair, a new impostor, blank cards and the clock running. */
function deal(g: ImpostorGame, now: number) {
  if (!g.deck.length) g.deck = shuffle(livePairIds, () => roll(g));
  const pair = wordPairs[g.deck.shift()!];
  const flip = roll(g) < 0.5,
    crowd = pair.words[flip ? 1 : 0],
    odd = pair.words[flip ? 0 : 1];
  // The role goes to whoever has held it least, at random among them.
  const pool = g.seats.map((_, s) => s),
    picked: number[] = [];
  for (let k = 0; k < impostorCount(g.seats.length); k++) {
    const left = pool.filter((s) => !picked.includes(s)),
      least = Math.min(...left.map((s) => g.turns[s])),
      fair = left.filter((s) => g.turns[s] === least);
    picked.push(fair[Math.floor(roll(g) * fair.length)]);
  }
  picked.sort((a, b) => a - b);
  for (const s of picked) g.turns[s]++;
  g.pair = pair.id;
  g.impostors = picked;
  g.words = g.seats.map((_, s) => (picked.includes(s) ? odd : crowd));
  g.phase = 'draw';
  g.sketches = g.seats.map(() => ({ strokes: [], locked: false }));
  g.clues = g.seats.map(() => ({ text: '', locked: false }));
  g.accusations = g.seats.map(() => ({ target: null, locked: false }));
  g.drawEndsAt = g.tutorial ? null : now + drawMs;
  g.vote = null;
  g.result = null;
  note(g, `Round ${g.round}: everyone draws their secret word.`);
}

export function actingSeats(g: ImpostorGame): number[] {
  if (g.over) return [];
  const open = (list: { locked: boolean }[]) =>
    g.seats.flatMap((_, s) => (list[s].locked ? [] : [s]));
  if (g.phase === 'draw') return open(g.sketches);
  if (g.phase === 'clue') return open(g.clues);
  if (g.phase === 'accuse') return open(g.accusations);
  return voters(g);
}

export function cleanClue(text: string) {
  return text.replace(/\s+/g, ' ').trim();
}
const letters = (t: string) =>
  t
    .toLowerCase()
    .normalize('NFD')
    .replace(/[^a-z]/g, '');
/** A clue may not give your own word away: not the word, nor any long part
 * of it, inside the clue. */
export function givesAway(clue: string, word: string) {
  const c = letters(clue);
  if (!c) return true;
  return word
    .split(/\s+/)
    .map(letters)
    .some(
      (w) =>
        w.length >= 3 && (c.includes(w) || (c.length >= 4 && w.includes(c))),
    );
}
function validStroke(s: unknown): s is Stroke {
  if (
    !s ||
    typeof s !== 'object' ||
    Object.keys(s).some((k) => !['c', 'w', 'p'].includes(k))
  )
    return false;
  const { c, w, p } = s as Stroke;
  return (
    Number.isInteger(c) &&
    c >= 0 &&
    c < inks.length &&
    Number.isInteger(w) &&
    w >= 0 &&
    w < nibs.length &&
    typeof p === 'string' &&
    p.length >= 4 &&
    p.length % 4 === 0 &&
    p.length <= maxStrokePoints * 4 &&
    packed.test(p) &&
    unpackPoints(p).every((v) => v <= 1000)
  );
}
const points = (strokes: Stroke[]) =>
  strokes.reduce((t, s) => t + s.p.length / 4, 0);
function validStrokes(strokes: unknown): strokes is Stroke[] {
  return (
    Array.isArray(strokes) &&
    strokes.length <= maxStrokes &&
    strokes.every(validStroke) &&
    points(strokes) <= maxPoints
  );
}
const seatIndex = (g: ImpostorGame, v: unknown) =>
  Number.isInteger(v) && (v as number) >= 0 && (v as number) < g.seats.length;

export function validMove(
  g: ImpostorGame,
  move: unknown,
  seat: number,
): move is ImpostorMove {
  if (
    g.over ||
    !seatIndex(g, seat) ||
    !move ||
    typeof move !== 'object' ||
    Array.isArray(move)
  )
    return false;
  const m = move as ImpostorMove;
  if (
    Object.keys(m).some(
      (k) => !['type', 'stroke', 'text', 'target', 'choice'].includes(k),
    )
  )
    return false;
  if (g.phase === 'vote')
    return (
      m.type === 'vote' &&
      isChoice(m.choice, g.vote) &&
      g.vote?.choices[seat] !== m.choice
    );
  if (g.phase === 'draw') {
    const k = g.sketches[seat];
    if (m.type === 'unlock') return k.locked;
    if (k.locked) return false;
    if (m.type === 'stroke')
      return (
        validStroke(m.stroke) &&
        k.strokes.length < maxStrokes &&
        points(k.strokes) + m.stroke.p.length / 4 <= maxPoints
      );
    if (m.type === 'undo' || m.type === 'clear') return k.strokes.length > 0;
    return m.type === 'lock';
  }
  if (g.phase === 'clue') {
    const c = g.clues[seat];
    if (m.type === 'unlock') return c.locked;
    if (c.locked || m.type !== 'clue' || typeof m.text !== 'string')
      return false;
    const text = cleanClue(m.text);
    return (
      text.length > 0 &&
      text.length <= clueLimit &&
      !givesAway(text, g.words[seat])
    );
  }
  const a = g.accusations[seat];
  if (m.type === 'unlock') return a.locked;
  return (
    !a.locked &&
    m.type === 'accuse' &&
    seatIndex(g, m.target) &&
    m.target !== seat
  );
}

export function play(
  g: ImpostorGame,
  m: ImpostorMove,
  s: number,
  now = Date.now(),
): ImpostorGame {
  // A move after the clock ran out lands on the locked cards instead.
  const due = deadline(g);
  if (due !== null && now >= due) return tick(g, now);
  if (!validMove(g, m, s)) return g;
  const n = structuredClone(g);
  n.revision++;
  if (n.phase === 'draw') {
    const k = n.sketches[s];
    if (m.type === 'stroke')
      k.strokes.push({ c: m.stroke.c, w: m.stroke.w, p: m.stroke.p });
    if (m.type === 'undo') k.strokes.pop();
    if (m.type === 'clear') k.strokes = [];
    if (m.type === 'lock') k.locked = true;
    if (m.type === 'unlock') k.locked = false;
    if (n.sketches.every((k) => k.locked)) toClues(n);
  } else if (n.phase === 'clue') {
    const c = n.clues[s];
    if (m.type === 'clue') {
      c.text = cleanClue(m.text);
      c.locked = true;
    }
    if (m.type === 'unlock') c.locked = false;
    if (n.clues.every((c) => c.locked)) {
      n.phase = 'accuse';
      note(n, 'Everyone accuses one player.');
    }
  } else if (n.phase === 'accuse') {
    const a = n.accusations[s];
    if (m.type === 'accuse') {
      a.target = m.target;
      a.locked = true;
    }
    if (m.type === 'unlock') a.locked = false;
    if (n.accusations.every((a) => a.locked)) reveal(n, now);
  } else if (m.type === 'vote') {
    n.vote!.choices[s] = m.choice;
    if (voteClosed(n.vote!, now)) return close(n, now);
  }
  return n;
}
function toClues(g: ImpostorGame) {
  for (const k of g.sketches) k.locked = true;
  g.phase = 'clue';
  g.drawEndsAt = null;
  note(g, 'Every drawing is on the board. Everyone writes one word.');
}
function reveal(g: ImpostorGame, now: number) {
  const tally = g.seats.map(() => 0);
  for (const a of g.accusations) if (a.target !== null) tally[a.target]++;
  const top = Math.max(...tally);
  const caught = g.impostors.filter((s) => top > 0 && tally[s] === top);
  const gains = g.seats.map((_, s) => {
    if (g.impostors.includes(s)) return caught.includes(s) ? 0 : escapePoints;
    const t = g.accusations[s].target;
    return t !== null && g.impostors.includes(t) ? foundPoints : 0;
  });
  g.scores = g.scores.map((v, i) => v + gains[i]);
  g.result = { tally, caught, gains };
  const names = g.impostors.map((s) => g.seats[s]).join(' and ');
  note(
    g,
    `${names} drew ${g.words[g.impostors[0]]}; everyone else drew ${g.words.find((_, s) => !g.impostors.includes(s))}. ${caught.length === g.impostors.length ? 'Caught.' : caught.length ? 'One was caught.' : 'Escaped.'}`,
  );
  // The reveal stays on the table while the host picks what next.
  g.phase = 'vote';
  g.vote = openVote(
    g.seats.length,
    now,
    !g.tutorial,
    undefined,
    false,
    !g.votes,
  );
}
function close(g: ImpostorGame, now: number): ImpostorGame {
  return closeRound(g as never, (x: ImpostorGame) => deal(x, now)) as never;
}
/** The server owns the drawing clock and the timed what-next vote. */
export function tick(g: ImpostorGame, now = Date.now()): ImpostorGame {
  const due = deadline(g);
  if (due === null || now < due) return g;
  if (g.phase === 'draw') {
    const n = structuredClone(g);
    n.revision++;
    toClues(n);
    return n;
  }
  if (g.phase === 'vote' && g.vote && voteClosed(g.vote, now)) {
    const n = structuredClone(g);
    n.revision++;
    return close(n, now);
  }
  return g;
}
export function deadline(g: ImpostorGame): number | null {
  if (g.over || g.tutorial) return null;
  if (g.phase === 'draw') return g.drawEndsAt;
  return g.phase === 'vote' ? (g.vote?.endsAt ?? null) : null;
}

/** What one seat may see: their own word, and nothing of anyone else's
 * card until the table reaches it. The pair and the impostors stay hidden
 * until the reveal. */
export function observe(g: ImpostorGame, viewer: number): ImpostorGame {
  const n = structuredClone(g);
  n.rngState = 0;
  n.deck = [];
  if (n.phase === 'vote' || n.over) return n;
  n.pair = -1;
  n.impostors = [];
  n.words = n.words.map((w, s) => (s === viewer ? w : ''));
  if (n.phase === 'draw')
    n.sketches = n.sketches.map((k, s) =>
      s === viewer ? k : { strokes: [], locked: k.locked },
    );
  if (n.phase === 'draw' || n.phase === 'clue')
    n.clues = n.clues.map((c, s) =>
      s === viewer ? c : { text: '', locked: c.locked },
    );
  n.accusations = n.accusations.map((a, s) =>
    s === viewer ? a : { target: null, locked: a.locked },
  );
  return n;
}

/** A practice doodle: a few loose loops around the card, different per seat. */
function doodle(seed: number): Stroke[] {
  const strokes: Stroke[] = [];
  for (let k = 0; k < 3; k++) {
    const p: number[] = [],
      cx = 500 + ((seed * 97 + k * 151) % 300) - 150,
      cy = 500 + ((seed * 61 + k * 89) % 300) - 150,
      r = 90 + ((seed * 37 + k * 53) % 160);
    for (let i = 0; i <= 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      p.push(
        Math.round(Math.min(1000, Math.max(0, cx + Math.cos(a) * r))),
        Math.round(Math.min(1000, Math.max(0, cy + Math.sin(a) * r * 0.8))),
      );
    }
    strokes.push({ c: k === 2 ? 1 : 0, w: 1, p: packPoints(p) });
  }
  return strokes;
}
export function botMove(g: ImpostorGame, s: number): ImpostorMove | null {
  if (!actingSeats(g).includes(s)) return null;
  if (g.phase === 'vote') {
    const options = g.vote?.options ?? ['more', 'finish'];
    return { type: 'vote', choice: g.round >= 2 ? 'finish' : options[0] };
  }
  if (g.phase === 'draw') {
    const done = g.sketches[s].strokes.length,
      plan = doodle(s + g.round * 7);
    return done < plan.length
      ? { type: 'stroke', stroke: plan[done] }
      : { type: 'lock' };
  }
  if (g.phase === 'clue') {
    const pair = wordPairs.find((p) => p.words.includes(g.words[s]));
    const hint = pair ? pair.hints[pair.words.indexOf(g.words[s])] : 'hmm';
    return { type: 'clue', text: givesAway(hint, g.words[s]) ? 'hmm' : hint };
  }
  const others = g.seats.flatMap((_, t) => (t === s ? [] : [t]));
  return {
    type: 'accuse',
    target: others[(s * 3 + g.round) % others.length],
  };
}

export function validState(g: ImpostorGame) {
  const n = g.seats.length,
    seat = (v: unknown) =>
      Number.isInteger(v) && (v as number) >= 0 && (v as number) < n,
    list = (a: unknown) => Array.isArray(a) && a.length === n;
  return (
    g.rules === 1 &&
    seatChoices.includes(n) &&
    g.mode === 'individual' &&
    list(g.teams) &&
    g.teams.every((t, s) => t === s) &&
    ['draw', 'clue', 'accuse', 'vote', 'reveal'].includes(g.phase) &&
    (g.phase === 'reveal') === g.over &&
    (g.phase === 'vote' ? validVote(g.vote, n) : !g.vote) &&
    g.target === 0 &&
    (g.votes === undefined || g.votes === true) &&
    !!wordPairs[g.pair] &&
    list(g.words) &&
    g.words.every((w) => wordPairs[g.pair].words.includes(w)) &&
    Array.isArray(g.impostors) &&
    g.impostors.length === impostorCount(n) &&
    g.impostors.every(seat) &&
    g.words.every((w, s) =>
      g.impostors.includes(s)
        ? w === g.words[g.impostors[0]]
        : w !== g.words[g.impostors[0]],
    ) &&
    list(g.turns) &&
    g.turns.every((t) => Number.isInteger(t) && t >= 0 && t <= maxRounds) &&
    Array.isArray(g.deck) &&
    g.deck.every((id) => Number.isInteger(id) && !!wordPairs[id]) &&
    list(g.sketches) &&
    g.sketches.every(
      (k) =>
        !!k &&
        typeof k.locked === 'boolean' &&
        validStrokes(k.strokes) &&
        (g.phase === 'draw' || k.locked),
    ) &&
    list(g.clues) &&
    g.clues.every(
      (c) =>
        !!c &&
        typeof c.locked === 'boolean' &&
        typeof c.text === 'string' &&
        c.text.length <= clueLimit &&
        (!c.locked || c.text.length > 0) &&
        (g.phase === 'draw' || g.phase === 'clue' || c.locked),
    ) &&
    list(g.accusations) &&
    g.accusations.every(
      (a, s) =>
        !!a &&
        typeof a.locked === 'boolean' &&
        (a.target === null || (seat(a.target) && a.target !== s)) &&
        (!a.locked || a.target !== null) &&
        (!g.result || a.locked),
    ) &&
    (g.drawEndsAt === null || Number.isFinite(g.drawEndsAt)) &&
    (g.phase === 'vote' || g.phase === 'reveal') === !!g.result
  );
}
