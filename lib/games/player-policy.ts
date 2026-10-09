/** Shared setup and server policy: these games depend on human decisions.
 *  Development relaxes it so bot-filled tables can exercise the full flow. */
export const humanOnlyGames = ['orin', 'miro', 'dial', 'size', 'coins', 'year', 'order', 'impostor'] as const;
/** Whether a game is played only by people, whatever the environment: the
 *  library's With friends shelf reads this, so the shelves never change in dev. */
export const isHumanOnlyGame = (id: string | undefined) =>
  (humanOnlyGames as readonly string[]).includes(id ?? '');
export function requiresHumanPlayers(id: string | undefined): boolean {
  return isHumanOnlyGame(id) && process.env.NODE_ENV !== 'development';
}
