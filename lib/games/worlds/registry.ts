/** The three illustrated worlds, behind one interface so the shared host never
 * has to know which one it is showing. They do not run on the trio engine and
 * they do not run on the party engine: each has its own rules module, its own
 * table and its own stylesheet, and they save under their own key. */
import * as coast from './orin.ts';
import * as meadow from './vela.ts';
import * as canal from './miro.ts';
import type { Difficulty, Outcome, WorldId } from './types.ts';

export type WorldGame = coast.CoastGame | meadow.MeadowGame | canal.CanalGame;
export type WorldMove = coast.CoastMove | meadow.MeadowMove | canal.CanalMove;

export type WorldEntry = {
  id: WorldId;
  /** The public name. The ID is storage; this is what a player reads. */
  name: string;
  seatChoices: number[];
  defaultSeats: number;
  create: (seats: number, seed: number, d: Difficulty) => WorldGame;
  progress: (g: WorldGame) => { label: string; detail: string };
  isSavedGame: (g: unknown) => g is WorldGame;
};

const rules = { coast, meadow, canal };
const of = (g: WorldGame) => rules[g.kind];

export function observe(g: WorldGame, viewer: number): WorldGame {
  return g.kind === 'coast'
    ? coast.observe(g, viewer)
    : g.kind === 'meadow'
      ? meadow.observe(g, viewer)
      : canal.observe(g, viewer);
}

export function actingSeats(g: WorldGame): number[] {
  return of(g).actingSeats(g as never);
}

export function validMove(g: WorldGame, m: unknown, seat: number): boolean {
  return of(g).validMove(g as never, m, seat);
}

export function play(g: WorldGame, m: WorldMove, seat: number): WorldGame {
  return of(g).play(g as never, m as never, seat);
}

export function botMove(g: WorldGame, seat: number): WorldMove | null {
  return of(g).botMove(g as never, seat) as WorldMove | null;
}

export function legalMoves(g: WorldGame, seat: number): WorldMove[] {
  return of(g).legalMoves(g as never, seat) as WorldMove[];
}

export function outcome(g: WorldGame): Outcome {
  return of(g).outcome(g as never);
}

export function progress(g: WorldGame) {
  return of(g).progress(g as never);
}

/** Keys the table can use to notice that the match has genuinely moved on. */
export function decisionKey(g: WorldGame) {
  return g.kind === 'coast'
    ? `coast:${g.watch}:${g.turns}:${g.actor}`
    : g.kind === 'meadow'
      ? `meadow:${g.round}:${g.phase}`
      : `canal:${g.run}:${g.phase}:${g.refusals}`;
}

export const worldGames: Record<WorldId, WorldEntry> = {
  coast: {
    id: 'coast',
    name: 'Orin',
    seatChoices: coast.seatChoices,
    defaultSeats: coast.defaultSeats,
    create: (seats, seed, d) => coast.createGame(seats, seed, d),
    progress: (g) => coast.progress(g as coast.CoastGame),
    isSavedGame: (g): g is WorldGame => coast.validState(g),
  },
  meadow: {
    id: 'meadow',
    name: 'Vela',
    seatChoices: meadow.seatChoices,
    defaultSeats: meadow.defaultSeats,
    create: (seats, seed, d) => meadow.createGame(seats, seed, d),
    progress: (g) => meadow.progress(g as meadow.MeadowGame),
    isSavedGame: (g): g is WorldGame => meadow.validState(g),
  },
  canal: {
    id: 'canal',
    name: 'Miro',
    seatChoices: canal.seatChoices,
    defaultSeats: canal.defaultSeats,
    create: (seats, seed, d) => canal.createGame(seats, seed, d),
    progress: (g) => canal.progress(g as canal.CanalGame),
    isSavedGame: (g): g is WorldGame => canal.validState(g),
  },
};

export const worldIds = Object.keys(worldGames) as WorldId[];
export const isWorldId = (id: string): id is WorldId =>
  Object.hasOwn(worldGames, id);
export { coast, meadow, canal };
