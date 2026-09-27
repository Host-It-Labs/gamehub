/** Device-local familiarity; count completed games, never clicks or practice. */
const KEY = 'gamehub.completed-games.v1';
export function readCompletedGames(name: string): number {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) ?? '{}')[name];
    return Number.isSafeInteger(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}
export function recordCompletedGame(name: string) {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    const games =
      raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    games[name] = Math.min(2, readCompletedGames(name) + 1);
    localStorage.setItem(KEY, JSON.stringify(games));
  } catch {
    /* Learning remains available when device storage is blocked. */
  }
}
