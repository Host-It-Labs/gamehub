/** Miro — a glassworks canal city where one trader wants the cargo to spoil.
 *
 * Five runs go out. The pilot of each run picks the crew and is always aboard
 * their own run, because a quay that let the pilot stay ashore would simply stop
 * sending whoever it suspected. Every trader aboard loads one cargo face down;
 * merchants can only load clean, and the smuggler may load rot. One rotten hold
 * spoils the whole run.
 *
 * Three clean runs are not enough on their own: the quay still has to name the
 * smuggler before the barge is signed off, so the merchants must identify as well
 * as deliver. Three spoiled runs and the smuggler simply walks away with it.
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

export const RUNS = 5;
/** Clean runs the quay needs to call the season in. */
export const TARGET = 3;
/** Spoiled runs the smuggler needs. At three traders they are aboard almost every
 * run, so the bar is measured rather than shared: without it the smallest table
 * belongs to the smuggler outright. */
export const spoilTarget = (seats: number) => (seats <= 3 ? 4 : 3);

export const seatChoices = [3, 4, 5];
export const defaultSeats = 4;

/** How many traders sail on each of the five runs, by table size. */
export const crewPlan: Record<number, number[]> = {
  3: [2, 2, 2, 2, 2],
  4: [2, 3, 3, 3, 4],
  5: [2, 3, 3, 4, 4],
};

export type CanalGame = WorldBase & {
  kind: 'canal';
  /** The smuggler's seat, or -1 when the viewer is not allowed to know. */
  smuggler: number;
  run: number;
  pilot: number;
  phase: 'crew' | 'approve' | 'load' | 'reveal' | 'accuse' | 'verdict';
  /** The quay's show of hands on the proposed crew: -1 none, 0 no, 1 yes. */
  votes: number[];
  /** Crews this run's quay has already turned away. The third one sails anyway. */
  refusals: number;
  /** Seats sailing this run. Empty until the pilot has chosen. */
  crew: number[];
  /** -1 not loaded, 0 clean, 1 rot. Hidden from everyone until the hold opens. */
  loads: number[];
  /** Per run: -1 still to sail, 0 delivered clean, 1 spoiled. */
  record: number[];
  /** Who sailed each run. Public: the whole quay watches the barge load. */
  crews: number[][];
  /** Who each trader names at the quay, or -1. */
  accusations: number[];
  ready: boolean[];
  /** 0 merchants, 1 smuggler. Null while the barge is still running. */
  winner: number | null;
  /** How the last run opened, kept for the reveal plate. */
  last: { crew: number[]; spoiled: number; run: number } | null;
};

export type CanalMove =
  | { type: 'crew'; seats: number[] }
  | { type: 'vote'; yes: boolean }
  | { type: 'load'; rot: boolean }
  | { type: 'ready' }
  | { type: 'accuse'; target: number };

export const crewSize = (g: CanalGame, run: number) =>
  crewPlan[g.seats.length][run - 1];
export const cleanRuns = (g: CanalGame) =>
  g.record.filter((r) => r === 0).length;
export const spoiledRuns = (g: CanalGame) =>
  g.record.filter((r) => r === 1).length;

export function createGame(
  seats: number,
  seed: number,
  difficulty: Difficulty,
  names?: string[],
): CanalGame {
  const g: CanalGame = {
    kind: 'canal',
    version: 1,
    rules: 1,
    rngState: seed >>> 0,
    difficulty,
    seats:
      names?.slice(0, seats) ??
      ['You', 'Dessa', 'Ferro', 'Lune', 'Batt'].slice(0, seats),
    revision: 0,
    log: [] as LogEntry[],
    over: false,
    smuggler: 0,
    run: 1,
    pilot: 0,
    phase: 'crew',
    crew: [],
    votes: Array<number>(seats).fill(-1),
    refusals: 0,
    loads: Array<number>(seats).fill(-1),
    record: Array<number>(RUNS).fill(-1),
    crews: Array.from({ length: RUNS }, () => [] as number[]),
    accusations: Array<number>(seats).fill(-1),
    ready: Array<boolean>(seats).fill(false),
    winner: null,
    last: null,
  };
  // It can be you. A canal city that never suspects the newcomer is not a city.
  g.smuggler = Math.floor(roll(g) * seats);
  g.pilot = Math.floor(roll(g) * seats);
  note(g, `Five runs to sign off. One trader wants the cargo to spoil.`);
  note(g, `${g.seats[g.pilot]} pilots the first run.`);
  return g;
}

export function actingSeats(g: CanalGame): number[] {
  if (g.over) return [];
  if (g.phase === 'crew') return [g.pilot];
  if (g.phase === 'approve')
    return g.seats.flatMap((_, s) => (g.votes[s] < 0 ? [s] : []));
  if (g.phase === 'load') return g.crew.filter((s) => g.loads[s] < 0);
  if (g.phase === 'reveal')
    return g.seats.flatMap((_, s) => (g.ready[s] ? [] : [s]));
  if (g.phase === 'accuse')
    return g.seats.flatMap((_, s) => (g.accusations[s] < 0 ? [s] : []));
  return [];
}

/** Who you are is yours alone, and a hold stays shut until the run is opened. */
export function observe(g: CanalGame, viewer: number): CanalGame {
  if (g.over) return g;
  return {
    ...g,
    smuggler: g.smuggler === viewer ? viewer : -1,
    loads:
      g.phase === 'reveal'
        ? g.loads
        : g.loads.map((l, s) => (s === viewer ? l : l < 0 ? -1 : -2)),
    accusations:
      g.phase === 'verdict'
        ? g.accusations
        : g.accusations.map((a, s) => (s === viewer ? a : a < 0 ? -1 : -2)),
    votes:
      g.phase === 'approve'
        ? g.votes.map((v, s) => (s === viewer ? v : v < 0 ? -1 : -2))
        : g.votes,
  };
}

export function validMove(g: CanalGame, m: unknown, seat: number): boolean {
  if (g.over || !m || typeof m !== 'object') return false;
  if (!Number.isInteger(seat) || seat < 0 || seat >= g.seats.length)
    return false;
  const move = m as CanalMove;
  if (move.type === 'crew') {
    if (g.phase !== 'crew' || seat !== g.pilot) return false;
    const want = crewSize(g, g.run);
    return (
      Array.isArray(move.seats) &&
      move.seats.length === want &&
      new Set(move.seats).size === want &&
      move.seats.every(
        (s) => Number.isInteger(s) && s >= 0 && s < g.seats.length,
      ) &&
      // The pilot never stays ashore while their own run goes out.
      move.seats.includes(g.pilot)
    );
  }
  if (move.type === 'vote')
    return (
      g.phase === 'approve' &&
      g.votes[seat] < 0 &&
      typeof move.yes === 'boolean'
    );
  if (move.type === 'load')
    return (
      g.phase === 'load' &&
      g.crew.includes(seat) &&
      g.loads[seat] < 0 &&
      typeof move.rot === 'boolean' &&
      // Only the smuggler carries anything that rots.
      (!move.rot || g.smuggler === seat)
    );
  if (move.type === 'ready') return g.phase === 'reveal' && !g.ready[seat];
  if (move.type === 'accuse')
    return (
      g.phase === 'accuse' &&
      g.accusations[seat] < 0 &&
      Number.isInteger(move.target) &&
      move.target >= 0 &&
      move.target < g.seats.length &&
      move.target !== seat
    );
  return false;
}

export function legalMoves(g: CanalGame, seat: number): CanalMove[] {
  const moves: CanalMove[] = [
    { type: 'ready' },
    { type: 'vote', yes: true },
    { type: 'vote', yes: false },
    { type: 'load', rot: false },
    { type: 'load', rot: true },
    ...g.seats.map((_, target) => ({ type: 'accuse' as const, target })),
  ];
  if (g.phase === 'crew' && seat === g.pilot) {
    const want = crewSize(g, g.run);
    const others = g.seats.flatMap((_, s) => (s === g.pilot ? [] : [s]));
    // Every crew the pilot could send, each one built around themselves.
    const pick = (start: number, chosen: number[]) => {
      if (chosen.length === want - 1) {
        moves.push({ type: 'crew', seats: [g.pilot, ...chosen] });
        return;
      }
      for (let i = start; i < others.length; i++)
        pick(i + 1, [...chosen, others[i]]);
    };
    pick(0, []);
  }
  return moves.filter((m) => validMove(g, m, seat));
}

/** The quay can refuse a crew twice. The third proposal sails whatever it thinks,
 * so refusing is a real check and not a way to stall the season. */
function settleVote(g: CanalGame) {
  const yes = g.votes.filter((v) => v === 1).length;
  const forced = g.refusals >= 2;
  if (yes * 2 > g.seats.length || forced) {
    note(
      g,
      forced && yes * 2 <= g.seats.length
        ? `The quay is out of refusals; the crew sails anyway.`
        : `The quay approves the crew, ${yes} hands to ${g.seats.length - yes}.`,
    );
    g.phase = 'load';
    return;
  }
  g.refusals += 1;
  g.pilot = (g.pilot + 1) % g.seats.length;
  g.crew = [];
  g.votes = g.seats.map(() => -1);
  g.phase = 'crew';
  note(
    g,
    `The quay turns the crew away. ${g.seats[g.pilot]} takes the tiller.`,
  );
}

function openHold(g: CanalGame) {
  const rot = g.crew.filter((s) => g.loads[s] === 1).length;
  g.record[g.run - 1] = rot > 0 ? 1 : 0;
  g.crews[g.run - 1] = [...g.crew];
  g.last = { crew: [...g.crew], spoiled: rot, run: g.run };
  note(
    g,
    rot > 0
      ? `Run ${g.run} opens rotten. The quay lights go out.`
      : `Run ${g.run} delivers clean. Another pane lights.`,
  );
  g.phase = 'reveal';
  g.ready = g.seats.map(() => false);
}

function afterReveal(g: CanalGame) {
  if (spoiledRuns(g) >= spoilTarget(g.seats.length)) {
    g.over = true;
    g.winner = 1;
    note(g, `Three spoiled runs. The smuggler walks away with it.`);
    return;
  }
  if (cleanRuns(g) >= TARGET) {
    g.phase = 'accuse';
    g.accusations = g.seats.map(() => -1);
    note(g, `Three clean runs. The quay must name the smuggler.`);
    return;
  }
  if (g.run >= RUNS) {
    // The season is out and the quay never got its three clean runs, so there is
    // nothing to sign off and nobody to name.
    g.over = true;
    g.winner = 1;
    note(g, `The season ends unsigned. ${g.seats[g.smuggler]} is long gone.`);
    return;
  }
  g.run += 1;
  g.pilot = (g.pilot + 1) % g.seats.length;
  g.crew = [];
  g.votes = g.seats.map(() => -1);
  g.refusals = 0;
  g.loads = g.seats.map(() => -1);
  g.phase = 'crew';
  note(g, `Run ${g.run}. ${g.seats[g.pilot]} takes the tiller.`);
}

function verdict(g: CanalGame) {
  const tally = g.seats.map(
    (_, s) => g.accusations.filter((a) => a === s).length,
  );
  const most = Math.max(...tally);
  const named = g.seats.flatMap((_, s) => (tally[s] === most ? [s] : []));
  // A split quay names nobody, and the smuggler simply finishes the season.
  const caught = named.length === 1 && named[0] === g.smuggler;
  g.over = true;
  g.winner = caught ? 0 : 1;
  g.phase = 'verdict';
  note(
    g,
    caught
      ? `The quay names ${g.seats[g.smuggler]}, and the quay is right.`
      : named.length === 1
        ? `The quay names ${g.seats[named[0]]}. It was ${g.seats[g.smuggler]}.`
        : `The quay cannot agree. ${g.seats[g.smuggler]} slips away.`,
  );
}

export function play(g: CanalGame, m: CanalMove, seat: number): CanalGame {
  if (!validMove(g, m, seat)) return g;
  const next: CanalGame = {
    ...g,
    crew: [...g.crew],
    votes: [...g.votes],
    loads: [...g.loads],
    record: [...g.record],
    crews: g.crews.map((c) => [...c]),
    accusations: [...g.accusations],
    ready: [...g.ready],
    log: [...g.log],
    revision: g.revision + 1,
  };
  if (m.type === 'crew') {
    next.crew = [...m.seats].sort((a, b) => a - b);
    next.phase = 'approve';
    next.votes = next.seats.map(() => -1);
    note(
      next,
      `${next.seats[seat]} sends ${next.crew.map((s) => next.seats[s]).join(', ')}.`,
      seat,
    );
    return next;
  }
  if (m.type === 'vote') {
    next.votes[seat] = m.yes ? 1 : 0;
    if (next.votes.every((v) => v >= 0)) settleVote(next);
    return next;
  }
  if (m.type === 'load') {
    next.loads[seat] = m.rot ? 1 : 0;
    if (next.crew.every((s) => next.loads[s] >= 0)) openHold(next);
    return next;
  }
  if (m.type === 'accuse') {
    next.accusations[seat] = m.target;
    if (next.accusations.every((a) => a >= 0)) verdict(next);
    return next;
  }
  next.ready[seat] = true;
  if (next.ready.every(Boolean)) afterReveal(next);
  return next;
}

/** How much each trader smells of rot, from the runs the quay has watched. */
export function suspicion(g: CanalGame): number[] {
  const score = g.seats.map(() => 0);
  for (let r = 0; r < RUNS; r++) {
    if (g.record[r] < 0) continue;
    // A spoiled run damns everyone who sailed it; a clean one clears them a little.
    const weight = g.record[r] === 1 ? 3 : -1;
    for (const s of g.crews[r]) score[s] += weight;
  }
  return score;
}

const care: Record<Difficulty, number> = { easy: 0.3, medium: 0.7, hard: 1 };

export function botMove(g: CanalGame, seat: number): CanalMove | null {
  if (g.over) return null;
  const dice = { rngState: (g.rngState + seat * 2654435761) >>> 0 };
  const careful = roll(dice) < care[g.difficulty];
  const moves = legalMoves(g, seat);
  if (!moves.length) return null;
  const random = () => moves[Math.floor(roll(dice) * moves.length)];
  if (g.phase === 'reveal') return { type: 'ready' };
  if (g.phase === 'approve') {
    const smell = suspicion(g);
    if (seat === g.smuggler)
      // The smuggler wants to be aboard, and wants clean-looking company.
      return { type: 'vote', yes: g.crew.includes(seat) || g.refusals >= 2 };
    if (!careful) return { type: 'vote', yes: roll(dice) < 0.6 };
    const worst = Math.max(...g.crew.map((s) => smell[s]));
    return { type: 'vote', yes: worst < 3 || g.refusals >= 2 };
  }
  if (g.phase === 'load') {
    if (g.smuggler !== seat) return { type: 'load', rot: false };
    const spoiled = spoiledRuns(g),
      clean = cleanRuns(g);
    // Spoil when it takes the season, or when a clean run would end it.
    const decisive =
      spoiled === spoilTarget(g.seats.length) - 1 || clean === TARGET - 1;
    if (!careful) return { type: 'load', rot: roll(dice) < 0.5 };
    if (decisive) return { type: 'load', rot: true };
    // Early rot is cheap: nobody has a record to read yet.
    return { type: 'load', rot: roll(dice) < (g.run <= 2 ? 0.55 : 0.4) };
  }
  if (g.phase === 'crew') {
    const crews = moves.filter((m) => m.type === 'crew');
    if (!crews.length) return null;
    if (!careful) return crews[Math.floor(roll(dice) * crews.length)];
    const smell = suspicion(g);
    // A smuggler piloting wants company they can blame; a merchant wants clean
    // hands aboard. Both read the same quay record, from opposite ends.
    const want = seat === g.smuggler ? 1 : -1;
    return crews.reduce((best, m) => {
      const cost = (c: CanalMove) =>
        c.type === 'crew'
          ? c.seats.reduce((a, s) => a + smell[s] * want, 0)
          : 0;
      return cost(m) > cost(best) ? m : best;
    });
  }
  if (g.phase === 'accuse') {
    const targets = moves.filter((m) => m.type === 'accuse');
    if (!targets.length) return null;
    if (seat === g.smuggler) {
      // Point at the quietest merchant and hope the quay splits.
      const smell = suspicion(g);
      return targets.reduce((best, m) =>
        smell[m.target] > smell[best.target] ? m : best,
      );
    }
    if (!careful) return targets[Math.floor(roll(dice) * targets.length)];
    const smell = suspicion(g);
    return targets.reduce((best, m) =>
      smell[m.target] > smell[best.target] ? m : best,
    );
  }
  return random();
}

export function outcome(g: CanalGame): Outcome {
  const merchants = g.winner === 0;
  return {
    title: merchants ? 'The quay signs off' : 'The smuggler slips away',
    detail: merchants
      ? `Three clean runs, and ${g.seats[g.smuggler]} named at the quay.`
      : spoiledRuns(g) >= spoilTarget(g.seats.length)
        ? `${spoiledRuns(g)} runs opened rotten.`
        : cleanRuns(g) < TARGET
          ? `The season ended without three clean runs.`
          : `${g.seats[g.smuggler]} was never named.`,
    winners: merchants
      ? g.seats.flatMap((_, s) => (s === g.smuggler ? [] : [s]))
      : [g.smuggler],
    rows: [
      { name: 'Clean runs', value: `${cleanRuns(g)} of ${TARGET}` },
      {
        name: 'Spoiled runs',
        value: `${spoiledRuns(g)} of ${spoilTarget(g.seats.length)}`,
      },
      { name: 'The smuggler', value: g.seats[g.smuggler] ?? 'unknown' },
    ],
  };
}

export function progress(g: CanalGame) {
  return {
    label: `Run ${Math.min(g.run, RUNS)} / ${RUNS}`,
    detail: g.over
      ? outcome(g).detail
      : g.phase === 'crew'
        ? `${g.seats[g.pilot]} is choosing the crew`
        : g.phase === 'approve'
          ? 'The quay decides whether this crew sails'
          : g.phase === 'load'
            ? 'The holds are being loaded'
            : g.phase === 'accuse'
              ? 'Name the smuggler'
              : `${cleanRuns(g)} clean · ${spoiledRuns(g)} spoiled`,
  };
}

export function validState(g: unknown): g is CanalGame {
  if (!validBase(g, 'canal')) return false;
  const c = g as CanalGame;
  const n = c.seats.length;
  return (
    seatChoices.includes(n) &&
    Number.isInteger(c.smuggler) &&
    c.smuggler >= -1 &&
    c.smuggler < n &&
    Number.isInteger(c.run) &&
    c.run >= 1 &&
    c.run <= RUNS &&
    Number.isInteger(c.pilot) &&
    c.pilot >= 0 &&
    c.pilot < n &&
    ['crew', 'approve', 'load', 'reveal', 'accuse', 'verdict'].includes(
      c.phase,
    ) &&
    ints(c.votes, n, -2, 1) &&
    Number.isInteger(c.refusals) &&
    c.refusals >= 0 &&
    c.refusals <= 3 &&
    Array.isArray(c.crew) &&
    c.crew.length <= n &&
    new Set(c.crew).size === c.crew.length &&
    c.crew.every((s) => Number.isInteger(s) && s >= 0 && s < n) &&
    ints(c.loads, n, -2, 1) &&
    ints(c.record, RUNS, -1, 1) &&
    Array.isArray(c.crews) &&
    c.crews.length === RUNS &&
    c.crews.every(
      (crew) =>
        Array.isArray(crew) &&
        crew.length <= n &&
        new Set(crew).size === crew.length &&
        crew.every((s) => Number.isInteger(s) && s >= 0 && s < n),
    ) &&
    ints(c.accusations, n, -2, n - 1) &&
    bools(c.ready, n) &&
    (c.winner === null || c.winner === 0 || c.winner === 1) &&
    (c.over ? c.winner !== null : c.winner === null) &&
    (c.last === null ||
      (Number.isInteger(c.last.run) &&
        c.last.run >= 1 &&
        c.last.run <= RUNS &&
        Number.isInteger(c.last.spoiled) &&
        Array.isArray(c.last.crew)))
  );
}

export { isBot, shuffle };
