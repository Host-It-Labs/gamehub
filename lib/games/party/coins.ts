import { coinPrompts, liveCoinIds } from './coin-prompts.ts';
import { assertSeats } from './groups.ts';
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
  endRound,
  closeRound,
  botChoice,
  voters,
  type RoundChoice,
  type RoundVote,
  type SetGame,
} from './vote.ts';
import type { TribuState } from './tribu-state.ts';

/** Ten Coins: everyone at once gets a prompt of their own with four options
 * (A perfect weekend: Sleep, Friends, Adventure, Food), picks one of two,
 * and shares exactly ten coins between its options the way they really are.
 * Then everyone at once guesses every other player's split, one tab per
 * player, and locks once; the splits are revealed one after the other. A
 * perfect read scores ten, and every coin out of place costs two. Played
 * inside Know Me. */
export type CoinsMove =
  | { type: 'prompt'; target: number }
  /** Sets one option's coins: your own while answering, `author`'s while
   * guessing. */
  | { type: 'coins'; option: number; value: number; author?: number }
  | { type: 'vote'; choice: RoundChoice }
  | { type: 'lock' | 'unlock' | 'next' };
/** One player's own split. Hidden fields read -1 (or empty) for everyone
 * else until the table reaches it. */
export type CoinsCard = {
  /** Two prompts the author chooses between. */
  offers: number[];
  prompt: number;
  coins: number[];
  locked: boolean;
};
/** One player's guesses, `coins[author]`, locked together. */
export type CoinsGuess = { coins: number[][]; locked: boolean };
export type CoinsGame = StandaloneBase & {
  kind: 'coins';
  rules: 1;
  mode: 'individual';
  /** Everyone plays for themselves; kept so shared party screens can group seats. */
  teams: number[];
  round: number;
  tutorial: boolean;
  lesson: number;
  phase: 'answer' | 'guess' | 'reveal' | 'vote';
  cards: CoinsCard[];
  guesses: CoinsGuess[];
  /** Whose split is being revealed. */
  target: number;
  scores: number[];
  deck: number[];
  vote: RoundVote | null;
  result: null | {
    coins: number[];
    /** Every guesser's split for this author; null for the author. */
    guesses: (number[] | null)[];
    gains: number[];
  };
  tribu?: TribuState;
  handoff?: SetGame | null;
};
export const totalCoins = 10;
export const optionsPerPrompt = 4;
/** What a read of a split scores: ten for a perfect one, two less for every
 * coin out of place, never below nothing. */
export const perfectRead = 10;
export const coinCost = 2;
export function readPoints(guess: number[], coins: number[]) {
  const off = guess.reduce((sum, v, i) => sum + Math.abs(v - coins[i]), 0) / 2;
  return Math.max(0, perfectRead - coinCost * off);
}
export const spent = (coins: number[]) => coins.reduce((a, b) => a + b, 0);
const empty = () => Array<number>(optionsPerPrompt).fill(0);
export function createGame(
  n: number,
  seed: number,
  difficulty: Difficulty = 'medium',
): CoinsGame {
  assertSeats(n, 'individual');
  const g: CoinsGame = {
    kind: 'coins',
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
    phase: 'answer',
    cards: [],
    guesses: [],
    target: 0,
    scores: Array(n).fill(0),
    deck: [],
    vote: null,
    result: null,
  };
  deal(g);
  return g;
}
function draw(g: CoinsGame) {
  g.deck = g.deck.filter((id) => coinPrompts[id] && !coinPrompts[id].retired);
  if (g.deck.length < 2)
    g.deck.push(
      ...shuffle(
        liveCoinIds.filter((id) => !g.deck.includes(id)),
        () => roll(g),
      ),
    );
  return g.deck.splice(0, 2);
}
/** Everyone gets two prompts at once, and every split starts empty. */
function deal(g: CoinsGame) {
  g.phase = 'answer';
  g.target = 0;
  g.cards = g.seats.map(() => {
    const offers = draw(g);
    return { offers, prompt: offers[0], coins: empty(), locked: false };
  });
  g.guesses = g.seats.map(() => ({
    coins: g.seats.map(() => empty()),
    locked: false,
  }));
  g.vote = null;
  g.result = null;
  note(g, `Round ${g.round}: everyone splits ten coins at once.`);
}
export function actingSeats(g: CoinsGame): number[] {
  if (g.over) return [];
  if (g.phase === 'answer')
    return g.seats.flatMap((_, s) => (g.cards[s].locked ? [] : [s]));
  if (g.phase === 'guess')
    return g.seats.flatMap((_, s) => (g.guesses[s].locked ? [] : [s]));
  if (g.phase === 'vote') return voters(g);
  return [];
}
/** Whether a guesser has spent all ten coins on every other player. */
export function guessedAll(g: CoinsGame, s: number) {
  return g.guesses[s].coins.every(
    (row, a) => a === s || spent(row) === totalCoins,
  );
}
export function validMove(
  g: CoinsGame,
  move: unknown,
  seat: number,
): move is CoinsMove {
  if (
    g.over ||
    !Number.isInteger(seat) ||
    seat < 0 ||
    seat >= g.seats.length ||
    !move ||
    typeof move !== 'object' ||
    Array.isArray(move)
  )
    return false;
  const m = move as CoinsMove;
  const keys =
    m.type === 'prompt'
      ? ['type', 'target']
      : m.type === 'coins'
        ? ['type', 'option', 'value', 'author']
        : m.type === 'vote'
          ? ['type', 'choice']
          : ['type'];
  if (Object.keys(m).some((k) => !keys.includes(k))) return false;
  if (g.phase === 'reveal') return m.type === 'next';
  if (g.phase === 'vote')
    return (
      m.type === 'vote' &&
      isChoice(m.choice, g.vote) &&
      g.vote?.choices[seat] !== m.choice
    );
  const own = g.phase === 'answer',
    b = own ? g.cards[seat] : g.guesses[seat];
  if (m.type === 'unlock') return b.locked;
  if (b.locked) return false;
  if (m.type === 'prompt')
    return (
      own &&
      Number.isInteger(m.target) &&
      g.cards[seat].offers.includes(m.target)
    );
  if (m.type === 'coins') {
    const author = own ? seat : m.author;
    if (
      (own ? m.author !== undefined : !Number.isInteger(author)) ||
      author === undefined ||
      (!own && (author === seat || author < 0 || author >= g.seats.length)) ||
      !Number.isInteger(m.option) ||
      m.option < 0 ||
      m.option >= optionsPerPrompt ||
      !Number.isInteger(m.value) ||
      m.value < 0
    )
      return false;
    const row = own ? g.cards[seat].coins : g.guesses[seat].coins[author];
    // A pile can grow only while coins are left.
    return spent(row) - row[m.option] + m.value <= totalCoins;
  }
  return (
    m.type === 'lock' &&
    (own ? spent(g.cards[seat].coins) === totalCoins : guessedAll(g, seat))
  );
}
export function play(
  g: CoinsGame,
  m: CoinsMove,
  s: number,
  now = Date.now(),
): CoinsGame {
  if (!validMove(g, m, s)) return g;
  if (g.phase === 'vote' && g.vote && voteClosed(g.vote, now))
    return tick(g, now);
  const n = structuredClone(g);
  n.revision++;
  if (n.phase === 'answer' || n.phase === 'guess') {
    const b = n.phase === 'answer' ? n.cards[s] : n.guesses[s];
    if (m.type === 'prompt') {
      // The coins sat on the other prompt's options.
      n.cards[s].prompt = m.target;
      n.cards[s].coins = empty();
    }
    if (m.type === 'coins') {
      if (n.phase === 'answer') n.cards[s].coins[m.option] = m.value;
      else n.guesses[s].coins[m.author!][m.option] = m.value;
    }
    if (m.type === 'lock') b.locked = true;
    if (m.type === 'unlock') b.locked = false;
    if (n.phase === 'answer' && n.cards.every((c) => c.locked)) {
      n.phase = 'guess';
      note(n, 'Everyone guesses every other split at once.');
    } else if (n.phase === 'guess' && n.guesses.every((x) => x.locked)) {
      n.target = 0;
      reveal(n);
    }
  } else if (n.phase === 'reveal') {
    if (n.target < n.seats.length - 1) {
      n.target++;
      reveal(n);
    } else endRound(n, now);
  } else if (m.type === 'vote') {
    n.vote!.choices[s] = m.choice;
    if (voteClosed(n.vote!, now)) return close(n);
  }
  return n;
}
function reveal(g: CoinsGame) {
  const coins = [...g.cards[g.target].coins],
    guesses = g.seats.map((_, s) =>
      s === g.target ? null : [...g.guesses[s].coins[g.target]],
    ),
    gains = guesses.map((row) => (row ? readPoints(row, coins) : 0));
  g.scores = g.scores.map((v, i) => v + gains[i]);
  g.result = { coins, guesses, gains };
  g.phase = 'reveal';
  note(
    g,
    `${g.seats[g.target]}'s split was ${coins.join('-')}. ${g.seats.map((name, i) => `${name} +${gains[i]}`).join(', ')}.`,
  );
}
function close(g: CoinsGame) {
  return closeRound(g, deal);
}
export function tick(g: CoinsGame, now = Date.now()): CoinsGame {
  if (g.over || g.phase !== 'vote' || !g.vote || !voteClosed(g.vote, now))
    return g;
  const n = structuredClone(g);
  n.revision++;
  return close(n);
}
/** Players see their own split and guesses; every prompt once the guessing
 * starts; and each split as its player is revealed. */
export function observe(g: CoinsGame, viewer: number): CoinsGame {
  const n = structuredClone(g);
  n.rngState = 0;
  n.deck = [];
  const shown = n.phase === 'reveal' || n.phase === 'vote';
  n.cards = n.cards.map((c, s) =>
    s === viewer || (shown && s <= n.target)
      ? c
      : {
          offers: [],
          prompt: n.phase === 'answer' ? -1 : c.prompt,
          coins: c.coins.map(() => -1),
          locked: c.locked,
        },
  );
  n.guesses = n.guesses.map((b, s) =>
    s === viewer
      ? b
      : { coins: b.coins.map((row) => row.map(() => 0)), locked: b.locked },
  );
  return n;
}
function hash(...parts: number[]) {
  let h = 2166136261;
  for (const p of parts) h = Math.imul(h ^ p, 16777619) >>> 0;
  return h;
}
/** A practice bot's split: a lean towards one or two options, stable per
 * seed. */
function botSplit(...seed: number[]) {
  const coins = empty();
  for (let c = 0; c < totalCoins; c++)
    coins[hash(...seed, c) % (c < 6 ? 2 : optionsPerPrompt)]++;
  const turn = hash(...seed) % optionsPerPrompt;
  return coins.map((_, i) => coins[(i + turn) % optionsPerPrompt]);
}
export function botMove(g: CoinsGame, s: number): CoinsMove | null {
  if (!actingSeats(g).includes(s)) return null;
  if (g.phase === 'vote') return { type: 'vote', choice: botChoice(g, s) };
  if (g.phase === 'answer') {
    const c = g.cards[s],
      want = botSplit(s, c.prompt);
    // Empty piles first, so a pile never needs coins that are not left.
    const option = want.findIndex((v, i) => v !== c.coins[i]);
    if (option < 0) return { type: 'lock' };
    return { type: 'coins', option, value: want[option] };
  }
  // Bots never see anyone's split: a stable hunch per author.
  for (let author = 0; author < g.seats.length; author++) {
    if (author === s) continue;
    const row = g.guesses[s].coins[author],
      want = botSplit(s, author, g.cards[author].prompt, g.round),
      option = want.findIndex((v, i) => v !== row[i]);
    if (option >= 0) {
      // Lower a pile before raising another so the total never passes ten.
      const lower = want.findIndex((v, i) => v < row[i]);
      const at = lower >= 0 ? lower : option;
      return { type: 'coins', option: at, value: want[at], author };
    }
  }
  return { type: 'lock' };
}
export function validState(g: CoinsGame) {
  const n = g.seats.length,
    id = (i: unknown) => Number.isInteger(i) && !!coinPrompts[i as number],
    split = (r: unknown) =>
      Array.isArray(r) &&
      r.length === optionsPerPrompt &&
      r.every((v) => Number.isInteger(v) && v >= 0 && v <= totalCoins) &&
      spent(r) <= totalCoins;
  return (
    g.rules === 1 &&
    g.mode === 'individual' &&
    Array.isArray(g.teams) &&
    g.teams.length === n &&
    g.teams.every((t, s) => t === s) &&
    Array.isArray(g.scores) &&
    g.scores.length === n &&
    g.scores.every((v) => Number.isFinite(v) && v >= 0 && v <= 1e5) &&
    ['answer', 'guess', 'reveal', 'vote'].includes(g.phase) &&
    (g.phase === 'vote' ? validVote(g.vote, n) : !g.vote) &&
    Number.isInteger(g.target) &&
    g.target >= 0 &&
    g.target < n &&
    Array.isArray(g.deck) &&
    g.deck.every(id) &&
    Array.isArray(g.cards) &&
    g.cards.length === n &&
    g.cards.every(
      (c) =>
        !!c &&
        Array.isArray(c.offers) &&
        c.offers.length === 2 &&
        c.offers.every(id) &&
        c.offers.includes(c.prompt) &&
        split(c.coins) &&
        typeof c.locked === 'boolean' &&
        (!c.locked || spent(c.coins) === totalCoins) &&
        (g.phase === 'answer' || c.locked),
    ) &&
    Array.isArray(g.guesses) &&
    g.guesses.length === n &&
    g.guesses.every(
      (b) =>
        !!b &&
        typeof b.locked === 'boolean' &&
        Array.isArray(b.coins) &&
        b.coins.length === n &&
        b.coins.every(split),
    ) &&
    (g.phase === 'reveal' || g.phase === 'vote') === !!g.result
  );
}
