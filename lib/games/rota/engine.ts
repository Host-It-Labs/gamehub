import {
  canPlace,
  canPlaceAnywhere,
  emptyCells,
  looseEnds,
  sheet,
  withCells,
  type Placed,
  type Sheet,
} from './board.ts';
import { maps, rockfallSites, townSites, type MapId, MAP_IDS } from './maps.ts';
import {
  JUNCTION_DIE,
  PIECE_IDS,
  RIVER_DIE,
  ROUTE_DIE,
  SPECIALS,
  SPECIALS_PER_MATCH,
  orientations,
  type PieceId,
} from './pieces.ts';
import {
  PLAN_IDS,
  PLANS_PER_MATCH,
  planDone,
  plans as planDefs,
  score,
  type Breakdown,
  type PlanId,
} from './score.ts';

/**
 * Rota: everyone draws the same dice each round and builds roads and rails
 * on their own survey sheet, all at once. Three route dice and a junction
 * die must be placed whenever they can be; a special may be added, one a
 * round and three a match. After the last round, networks score by the
 * exits they link, the longest road and rail a point a square, the centre a
 * point a square, and loose ends cost a point each.
 *
 * Each seat builds in private and locks its round with Done; when every
 * seat has locked, Rockfall lands, Plans are checked and the next dice roll.
 * A seat's pieces from the round in play stay hidden from the others.
 */
export const ROTA_RULES = 1;
export type Difficulty = 'easy' | 'medium' | 'hard';
export type Extension = 'rivers' | 'plans' | 'towns' | 'rockfall';
export const EXTENSIONS: Extension[] = ['rivers', 'plans', 'towns', 'rockfall'];
export type Extensions = Record<Extension, boolean>;
export const noExtensions: Extensions = {
  rivers: false,
  plans: false,
  towns: false,
  rockfall: false,
};

export type Draft = {
  /** Index into the round's dice, or -1 for a special. */
  die: number;
  p: PieceId;
  cell: number;
  o: number;
};

export type RotaSeat = {
  name: string;
  bot: boolean;
  cells: (Placed | null)[];
  /** This round's pieces, in the order they went down. */
  draft: Draft[];
  /** Specials used, with the round of each. */
  specials: { p: PieceId; r: number }[];
  rubble: number[];
  /** Round each Plan was completed in, 0 while open. */
  plans: number[];
  locked: boolean;
  /** Pieces the others have not seen yet (only in an observation). */
  hidden?: number;
};

export type LogEntry = { id: number; seat?: number; text: string };

export type RotaGame = {
  kind: 'rota';
  version: 1;
  rules: typeof ROTA_RULES;
  revision: number;
  rngState: number;
  difficulty: Difficulty;
  map: MapId;
  ext: Extensions;
  round: number;
  rounds: number;
  /** This round's dice: three routes, the junction, then the river. */
  dice: PieceId[];
  /** Every round's dice, for the results and the log. */
  rolls: PieceId[][];
  towns: number[];
  plans: PlanId[];
  /** Rockfall's target for each round, -1 for none. */
  strikes: number[];
  seats: RotaSeat[];
  over: boolean;
  final: Breakdown[] | null;
  log: LogEntry[];
};

export type RotaMove =
  | { type: 'place'; die: number; cell: number; o: number }
  | { type: 'special'; p: PieceId; cell: number; o: number }
  | { type: 'turn'; o: number }
  | { type: 'undo' }
  | { type: 'done' }
  | { type: 'reopen' };

export type RotaOptions = {
  map?: MapId;
  ext?: Partial<Extensions>;
  difficulty?: Difficulty;
  names?: string[];
  /** Which seats are bots; seat 0 is always a person in solo play. */
  bots?: boolean[];
};

export const botNames = ['You', 'Ada', 'Brunel', 'Cato', 'Dora', 'Eiffel'];

function random(g: { rngState: number }) {
  g.rngState = (Math.imul(g.rngState, 1664525) + 1013904223) >>> 0;
  return g.rngState / 4294967296;
}
const pick = <T>(g: RotaGame, list: readonly T[]) =>
  list[Math.floor(random(g) * list.length)];

function note(g: RotaGame, text: string, seat?: number) {
  g.log.push(
    seat === undefined
      ? { id: g.log.length, text }
      : { id: g.log.length, seat, text },
  );
  if (g.log.length > 80) g.log = g.log.slice(-80);
}

function rollDice(g: RotaGame) {
  const dice = [
    pick(g, ROUTE_DIE),
    pick(g, ROUTE_DIE),
    pick(g, ROUTE_DIE),
    pick(g, JUNCTION_DIE),
  ];
  if (g.ext.rivers) dice.push(pick(g, RIVER_DIE));
  g.dice = dice;
  g.rolls.push(dice);
  if (g.ext.rockfall && g.round > 1 && g.round < g.rounds) {
    const struck = new Set(g.strikes.filter((c) => c >= 0));
    const sites = rockfallSites(maps[g.map], g.towns).filter(
      (c) => !struck.has(c),
    );
    g.strikes[g.round - 1] = sites.length ? pick(g, sites) : -1;
  } else g.strikes[g.round - 1] = -1;
}

export function createRota(
  seats: number,
  seed: number,
  opt: RotaOptions = {},
): RotaGame {
  const map = opt.map && MAP_IDS.includes(opt.map) ? opt.map : 'meadow';
  const m = maps[map];
  const ext = { ...noExtensions, ...opt.ext };
  const g: RotaGame = {
    kind: 'rota',
    version: 1,
    rules: ROTA_RULES,
    revision: 0,
    rngState: seed >>> 0 || 1,
    difficulty: opt.difficulty ?? 'medium',
    map,
    ext,
    round: 1,
    rounds: m.rounds,
    dice: [],
    rolls: [],
    towns: [],
    plans: [],
    strikes: [],
    seats: Array.from({ length: seats }, (_, s) => ({
      name: opt.names?.[s] ?? botNames[s] ?? `Player ${s + 1}`,
      bot: opt.bots?.[s] ?? s > 0,
      cells: emptyCells(m),
      draft: [],
      specials: [],
      rubble: [],
      plans: [],
      locked: false,
    })),
    over: false,
    final: null,
    log: [],
  };
  random(g);
  if (ext.towns) {
    const sites = townSites(m);
    const adjacent = (a: number, b: number) =>
      Math.abs((a % m.size) - (b % m.size)) <= 1 &&
      Math.abs(Math.floor(a / m.size) - Math.floor(b / m.size)) <= 1;
    for (let tries = 0; g.towns.length < m.towns && tries < 200; tries++) {
      const c = pick(g, sites);
      if (!g.towns.some((t) => adjacent(t, c))) g.towns.push(c);
    }
    g.towns.sort((a, b) => a - b);
  }
  if (ext.plans) {
    const pool = [...PLAN_IDS];
    while (g.plans.length < PLANS_PER_MATCH) {
      const i = Math.floor(random(g) * pool.length);
      g.plans.push(pool.splice(i, 1)[0]);
    }
    for (const s of g.seats) s.plans = g.plans.map(() => 0);
  }
  rollDice(g);
  note(g, `Round 1 of ${g.rounds}`);
  return g;
}

export const mapOf = (g: Pick<RotaGame, 'map'>) => maps[g.map];

export function sheetOf(g: RotaGame, seat: number): Sheet {
  const s = g.seats[seat];
  return sheet(maps[g.map], s.cells, s.rubble, g.ext.towns ? g.towns : []);
}

/** Dice still to place this round, by index. */
export function openDice(g: RotaGame, seat: number) {
  const used = new Set(g.seats[seat].draft.map((d) => d.die));
  return g.dice.map((_, i) => i).filter((i) => !used.has(i));
}

/** The river die is optional; the other four must go down when they can. */
export const mandatory = (g: RotaGame, die: number) => die < 4;

export function specialsLeft(g: RotaGame, seat: number): PieceId[] {
  const s = g.seats[seat];
  if (s.specials.length >= SPECIALS_PER_MATCH) return [];
  if (s.specials.some((u) => u.r === g.round)) return [];
  return SPECIALS.filter((p) => !s.specials.some((u) => u.p === p));
}

/** Dice that must still be placed: open, mandatory and placeable now. */
export function owed(g: RotaGame, seat: number) {
  const sh = sheetOf(g, seat);
  return openDice(g, seat).filter(
    (i) => mandatory(g, i) && canPlaceAnywhere(sh, g.dice[i]),
  );
}

export const canFinish = (g: RotaGame, seat: number) =>
  !g.over && !g.seats[seat].locked && owed(g, seat).length === 0;

export function actingSeats(g: RotaGame) {
  return g.over ? [] : g.seats.flatMap((s, i) => (s.locked ? [] : [i]));
}

const isInt = (v: unknown, lo: number, hi: number): v is number =>
  Number.isInteger(v) && (v as number) >= lo && (v as number) <= hi;

export function validMove(g: RotaGame, m: unknown, seat: number): m is RotaMove {
  if (!m || typeof m !== 'object' || g.over) return false;
  const s = g.seats[seat];
  if (!s) return false;
  const mv = m as Record<string, unknown>;
  const cells = s.cells.length;
  switch (mv.type) {
    case 'place': {
      if (s.locked || !isInt(mv.die, 0, g.dice.length - 1)) return false;
      if (!isInt(mv.cell, 0, cells - 1) || !isInt(mv.o, 0, 7)) return false;
      if (s.draft.some((d) => d.die === mv.die)) return false;
      const p = g.dice[mv.die as number];
      return (
        orientations(p).includes(mv.o as number) &&
        canPlace(sheetOf(g, seat), p, mv.o as number, mv.cell as number)
      );
    }
    case 'special': {
      if (s.locked || !isInt(mv.cell, 0, cells - 1) || !isInt(mv.o, 0, 7))
        return false;
      const p = mv.p as PieceId;
      if (!specialsLeft(g, seat).includes(p)) return false;
      return (
        orientations(p).includes(mv.o as number) &&
        canPlace(sheetOf(g, seat), p, mv.o as number, mv.cell as number)
      );
    }
    case 'turn': {
      if (s.locked || !isInt(mv.o, 0, 7) || !s.draft.length) return false;
      const last = s.draft[s.draft.length - 1];
      if (!orientations(last.p).includes(mv.o as number) || mv.o === last.o)
        return false;
      const cellsWithout = [...s.cells];
      cellsWithout[last.cell] = null;
      return canPlace(
        withCells(sheetOf(g, seat), cellsWithout),
        last.p,
        mv.o as number,
        last.cell,
      );
    }
    case 'undo':
      return !s.locked && s.draft.length > 0;
    case 'done':
      return canFinish(g, seat);
    case 'reopen':
      return s.locked;
    default:
      return false;
  }
}

export function planPoints(g: RotaGame, seat: number) {
  if (!g.ext.plans) return 0;
  return g.plans.reduce((sum, id, k) => {
    const r = g.seats[seat].plans[k];
    if (!r) return sum;
    const first = Math.min(
      ...g.seats.map((s) => s.plans[k] || Infinity),
    );
    return sum + (r === first ? planDefs[id].first : planDefs[id].later);
  }, 0);
}

export function scoreSeat(g: RotaGame, seat: number, budget?: number): Breakdown {
  return score(sheetOf(g, seat), {
    rivers: g.ext.rivers,
    towns: g.ext.towns ? g.towns : undefined,
    plansPoints: planPoints(g, seat),
    budget,
  });
}

function resolveRound(g: RotaGame) {
  const strike = g.strikes[g.round - 1] ?? -1;
  g.seats.forEach((s, i) => {
    if (strike >= 0 && !s.cells[strike]) s.rubble.push(strike);
    if (g.ext.plans) {
      const sh = sheetOf(g, i);
      g.plans.forEach((id, k) => {
        if (!s.plans[k] && planDone(sh, id)) s.plans[k] = g.round;
      });
    }
    s.draft = [];
    s.locked = false;
  });
  if (g.ext.plans)
    g.plans.forEach((id, k) => {
      const who = g.seats.flatMap((s, i) => (s.plans[k] === g.round ? [i] : []));
      if (who.length)
        note(g, `${who.map((i) => g.seats[i].name).join(' & ')}: ${planDefs[id].name}`);
    });
  if (g.round >= g.rounds) {
    g.over = true;
    g.final = g.seats.map((_, i) => scoreSeat(g, i, 3_000_000));
    note(g, 'Final scores');
    return;
  }
  g.round++;
  rollDice(g);
  note(g, `Round ${g.round} of ${g.rounds}`);
}

/** Applies a valid move. Returns a new state; the input is not changed. */
export function play(g0: RotaGame, m: RotaMove, seat: number): RotaGame {
  if (!validMove(g0, m, seat)) return g0;
  const g = structuredClone(g0);
  const s = g.seats[seat];
  switch (m.type) {
    case 'place': {
      const p = g.dice[m.die];
      s.cells[m.cell] = { p, o: m.o, r: g.round };
      s.draft.push({ die: m.die, p, cell: m.cell, o: m.o });
      break;
    }
    case 'special':
      s.cells[m.cell] = { p: m.p, o: m.o, r: g.round };
      s.draft.push({ die: -1, p: m.p, cell: m.cell, o: m.o });
      s.specials.push({ p: m.p, r: g.round });
      break;
    case 'turn': {
      const last = s.draft[s.draft.length - 1];
      last.o = m.o;
      s.cells[last.cell] = { p: last.p, o: m.o, r: g.round };
      break;
    }
    case 'undo': {
      const last = s.draft.pop()!;
      s.cells[last.cell] = null;
      if (last.die < 0) s.specials = s.specials.filter((u) => !(u.p === last.p && u.r === g.round));
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
  if (m.type === 'done' && g.seats.every((x) => x.locked)) resolveRound(g);
  return g;
}

/** What `viewer` may see: others' pieces from the round in play are hidden,
 * and the dice to come stay unknowable. */
export function observe(g: RotaGame, viewer: number): RotaGame {
  if (g.over) return { ...g, rngState: 0 };
  return {
    ...g,
    rngState: 0,
    seats: g.seats.map((s, i) => {
      if (i === viewer) return s;
      const hidden = s.draft.length;
      if (!hidden) return s;
      const cells = s.cells.map((c) => (c && c.r === g.round ? null : c));
      return {
        ...s,
        cells,
        draft: [],
        specials: s.specials.filter((u) => u.r !== g.round),
        hidden,
      };
    }),
  };
}

export type RotaOutcome = {
  title: string;
  detail: string;
  winners: number[];
  rows: { name: string; value: string; seat: number; points: number }[];
};

/** Most points wins; fewer loose ends breaks a tie. */
export function outcome(g: RotaGame): RotaOutcome {
  const finals = g.final ?? g.seats.map((_, i) => scoreSeat(g, i));
  const key = (i: number) => finals[i].total * 1000 + finals[i].errors;
  const top = Math.max(...finals.map((_, i) => key(i)));
  const winners = g.seats.flatMap((_, i) => (key(i) === top ? [i] : []));
  const names = winners.map((i) => g.seats[i].name);
  const solo = g.seats.length === 1;
  return {
    title: solo
      ? `${finals[0].total} points`
      : `${names.join(' & ')} ${names.length > 1 ? 'tie' : names[0] === 'You' ? 'win' : 'wins'}`,
    detail: `${maps[g.map].name}, ${g.rounds} rounds`,
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

/** Checks a saved or received state before it is trusted. */
export function isRotaGame(v: unknown): v is RotaGame {
  try {
    const g = v as RotaGame;
    if (!g || g.kind !== 'rota' || g.version !== 1 || g.rules !== ROTA_RULES)
      return false;
    if (!MAP_IDS.includes(g.map)) return false;
    const m = maps[g.map];
    const n = m.size * m.size;
    const piece = (p: unknown) => PIECE_IDS.includes(p as PieceId);
    return (
      Number.isInteger(g.revision) &&
      Number.isInteger(g.rngState) &&
      ['easy', 'medium', 'hard'].includes(g.difficulty) &&
      !!g.ext &&
      EXTENSIONS.every((e) => typeof g.ext[e] === 'boolean') &&
      g.rounds === m.rounds &&
      isInt(g.round, 1, g.rounds) &&
      Array.isArray(g.dice) &&
      g.dice.length === (g.ext.rivers ? 5 : 4) &&
      g.dice.every(piece) &&
      Array.isArray(g.rolls) &&
      Array.isArray(g.towns) &&
      g.towns.every((t) => isInt(t, 0, n - 1)) &&
      Array.isArray(g.plans) &&
      g.plans.every((p) => PLAN_IDS.includes(p)) &&
      Array.isArray(g.strikes) &&
      typeof g.over === 'boolean' &&
      Array.isArray(g.log) &&
      Array.isArray(g.seats) &&
      g.seats.length >= 1 &&
      g.seats.length <= 6 &&
      g.seats.every(
        (s) =>
          typeof s.name === 'string' &&
          typeof s.bot === 'boolean' &&
          typeof s.locked === 'boolean' &&
          Array.isArray(s.cells) &&
          s.cells.length === n &&
          s.cells.every(
            (c) =>
              c === null ||
              (piece(c.p) && isInt(c.o, 0, 7) && isInt(c.r, 1, g.rounds)),
          ) &&
          Array.isArray(s.draft) &&
          Array.isArray(s.specials) &&
          s.specials.length <= SPECIALS_PER_MATCH &&
          Array.isArray(s.rubble) &&
          Array.isArray(s.plans) &&
          s.plans.length === g.plans.length,
      )
    );
  } catch {
    return false;
  }
}

/** Loose ends on a seat's sheet, for the red marks on the table. */
export const errorsOf = (g: RotaGame, seat: number) => looseEnds(sheetOf(g, seat));
