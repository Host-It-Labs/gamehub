import {
  isTriviaLength,
  isTriviaMode,
  type TriviaLength,
  type TriviaMode,
} from '../games/party/trivia.ts';
import { partySeats } from '../games/party/groups.ts';
import type { Table, TableCommand } from './types.ts';

const queryKey = 'trivia';

/** A library pick: the mode, with `-8` when Tower or Expedition should last
 * eight rounds instead of four. */
export type TriviaSetupPick =
  | TriviaMode
  | `${Exclude<TriviaMode, 'quick'>}-${Exclude<TriviaLength, 4>}`;

/** The pick for a mode and a length; four rounds is the plain mode. */
export function triviaSetupPick(
  mode: TriviaMode,
  rounds: TriviaLength = 4,
): TriviaSetupPick {
  return mode !== 'quick' && rounds !== 4 ? `${mode}-${rounds}` : mode;
}

function parsePick(
  value: unknown,
): { mode: TriviaMode; rounds: TriviaLength } | null {
  if (isTriviaMode(value)) return { mode: value, rounds: 4 };
  if (typeof value !== 'string') return null;
  const [mode, rounds, ...rest] = value.split('-');
  const length = Number(rounds);
  return rest.length === 0 &&
    isTriviaMode(mode) &&
    mode !== 'quick' &&
    isTriviaLength(length) &&
    length !== 4 &&
    rounds === String(length)
    ? { mode, rounds: length }
    : null;
}

/** A library pick can travel through sign-in without accepting arbitrary redirects. */
export function triviaSetupMode(search: string): TriviaSetupPick | null {
  const values = new URLSearchParams(search).getAll(queryKey);
  return values.length === 1 && parsePick(values[0])
    ? (values[0] as TriviaSetupPick)
    : null;
}

/** Only the pick travels; existing query and development-session fragments stay intact. */
export function triviaSetupLink(
  path: string,
  mode: TriviaSetupPick | null,
): string {
  const url = new URL(path, 'https://gamehub.invalid');
  if (parsePick(mode)) url.searchParams.set(queryKey, mode!);
  else url.searchParams.delete(queryKey);
  return `${url.pathname}${url.search}${url.hash}`;
}

/** The one-shot library request opens setup, never an active match or another admin's table. */
export function triviaSetupConfiguration(
  table: Table,
  mode: unknown,
): Extract<TableCommand, { type: 'configure' }> | null {
  const pick = parsePick(mode);
  if (
    !pick ||
    !table.isHost ||
    table.status !== 'lobby' ||
    table.game ||
    table.adventure ||
    table.handoff
  )
    return null;
  const people = table.members.filter((member) => !member.bot).length;
  const choices = partySeats.filter((seats) => seats >= people);
  if (!choices.length) return null;
  const capacity = choices.reduce((nearest, seats) =>
    Math.abs(seats - table.capacity) < Math.abs(nearest - table.capacity)
      ? seats
      : nearest,
  );
  return {
    type: 'configure',
    gameId: 'miro',
    triviaMode: pick.mode,
    ...(pick.mode === 'quick' ? {} : { triviaRounds: pick.rounds }),
    capacity,
    difficulty: table.difficulty,
    openSetup: true,
  };
}
