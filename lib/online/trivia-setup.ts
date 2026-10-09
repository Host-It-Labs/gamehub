import { isTriviaMode, type TriviaMode } from '../games/party/trivia.ts';
import { partySeats } from '../games/party/groups.ts';
import type { Table, TableCommand } from './types.ts';

const queryKey = 'trivia';

/** A library pick can travel through sign-in without accepting arbitrary redirects. */
export function triviaSetupMode(search: string): TriviaMode | null {
  const values = new URLSearchParams(search).getAll(queryKey);
  return values.length === 1 && isTriviaMode(values[0]) ? values[0] : null;
}

/** Only the mode travels; existing query and development-session fragments stay intact. */
export function triviaSetupLink(path: string, mode: TriviaMode | null): string {
  const url = new URL(path, 'https://gamehub.invalid');
  if (isTriviaMode(mode)) url.searchParams.set(queryKey, mode);
  else url.searchParams.delete(queryKey);
  return `${url.pathname}${url.search}${url.hash}`;
}

/** The one-shot library request opens setup, never an active match or another admin's table. */
export function triviaSetupConfiguration(
  table: Table,
  mode: unknown,
): Extract<TableCommand, { type: 'configure' }> | null {
  if (
    !isTriviaMode(mode) ||
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
    triviaMode: mode,
    capacity,
    difficulty: table.difficulty,
    openSetup: true,
  };
}
