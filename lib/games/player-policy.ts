/** Shared setup and server policy: these games depend on human decisions.
 *  Development relaxes it so bot-filled tables can exercise the full flow. */
export function requiresHumanPlayers(id: string | undefined): boolean {
  return (
    ['orin', 'miro', 'dial', 'size', 'coins', 'year', 'order', 'impostor'].includes(id ?? '') && process.env.NODE_ENV !== 'development'
  );
}
