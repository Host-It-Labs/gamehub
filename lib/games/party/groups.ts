export type PartyMode = 'individual' | 'teams';
export const individualSeats = [2, 3, 4, 5, 6];
export const teamSeats = [2, 3, 4, 5, 6];
export const partySeats = [...new Set([...individualSeats, ...teamSeats])].sort(
  (a, b) => a - b,
);
export const teamNames = ['Team A', 'Team B'];
export function assertSeats(n: number, mode: PartyMode) {
  if (
    !['individual', 'teams'].includes(mode) ||
    !(mode === 'teams' ? teamSeats : individualSeats).includes(n)
  )
    throw new Error(
      mode === 'teams'
        ? 'Choose 2–6 players for two teams.'
        : 'Choose 2–6 individual players.',
    );
}
export function validTeams(value: unknown, n: number): value is number[] {
  return Array.isArray(value) && value.length === n &&
    value.every(t => t === 0 || t === 1) && value.includes(0) && value.includes(1);
}
export function groups(n: number, mode: PartyMode, teams?: number[]) {
  assertSeats(n, mode);
  if (mode === 'teams' && teams !== undefined) {
    if (!validTeams(teams, n)) throw new Error('Put at least one player on each team.');
    return [...teams];
  }
  return Array.from({ length: n }, (_, i) => (mode === 'teams' ? i % 2 : i));
}
export function groupName(
  g: { mode: PartyMode; seats: string[] },
  group: number,
) {
  return g.mode === 'teams' ? teamNames[group] : g.seats[group];
}
