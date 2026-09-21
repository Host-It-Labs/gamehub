/** Shared setup and server policy: these games depend on human decisions. */
export function requiresHumanPlayers(id: string | undefined): boolean {
  return id === 'orin' || id === 'miro';
}
