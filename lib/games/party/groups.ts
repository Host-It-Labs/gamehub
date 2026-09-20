export type PartyMode = 'individual' | 'teams';
export const individualSeats = [2, 3, 4, 5, 6];
export const teamSeats = [4, 6];
export const partySeats = [...new Set([...individualSeats, ...teamSeats])].sort(
  (a, b) => a - b,
);
export const teamNames = ['Sun', 'Moon'];
export function assertSeats(n: number, mode: PartyMode) {
  if (
    !['individual', 'teams'].includes(mode) ||
    !(mode === 'teams' ? teamSeats : individualSeats).includes(n)
  )
    throw new Error(
      mode === 'teams'
        ? 'Choose 4 or 6 players for two equal teams.'
        : 'Choose 2–6 individual players.',
    );
}
export function groups(n: number, mode: PartyMode) {
  assertSeats(n, mode);
  return Array.from({ length: n }, (_, i) => (mode === 'teams' ? i % 2 : i));
}
export function groupName(
  g: { mode: PartyMode; seats: string[] },
  group: number,
) {
  return g.mode === 'teams' ? `${teamNames[group]} team` : g.seats[group];
}
