/** Shared setup and server policy: these games depend on human decisions.
 *  Development relaxes it so bot-filled tables can exercise the full flow. */
export function requiresHumanPlayers(id: string | undefined): boolean {
  return (
    (id === 'orin' || id === 'miro' || id === 'dial' || id === 'size') && process.env.NODE_ENV !== 'development'
  );
}
