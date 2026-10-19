/** Public leaderboard data, shared by the server and the client. Internal
 *  game ids and saves remain stable; public names come from here. */
export type LeaderboardGameId =
  | 'undertow'
  | 'wildgrove'
  | 'midnight'
  | 'rota'
  | 'folio'
  | 'relic';
/** rating: skill against the Hard bots. score: best solo score. puzzles:
 *  puzzles solved in a run. progress: book levels gained on a desk. */
export type LeaderboardMetric = 'rating' | 'score' | 'puzzles' | 'progress';
export type LeaderboardGame = {
  id: LeaderboardGameId;
  name: string;
  /** How a result gets onto this board, in a few words. */
  how: string;
};
export const leaderboardGames: LeaderboardGame[] = [
  { id: 'undertow', name: 'Nox', how: 'Play solo against Hard bots.' },
  { id: 'wildgrove', name: 'Mora', how: 'Play solo against Hard bots.' },
  { id: 'midnight', name: 'Yata', how: 'Play solo against Hard bots.' },
  { id: 'rota', name: 'Rota', how: 'Play against Hard bots, or alone for a best score.' },
  { id: 'folio', name: 'Puzzles', how: 'Finish a solo run.' },
  { id: 'relic', name: 'Lucky', how: 'Grow books on a solo desk.' },
];
export const leaderboardGame = (id: string) =>
  leaderboardGames.find((g) => g.id === id);

/** One board of a game: its rating, or one best-score/run board. */
export type LeaderboardView = {
  key: string;
  label: string;
  metric: LeaderboardMetric;
  unit: string;
};
export type LeaderboardEntry = {
  rank: number;
  userId: string;
  name: string;
  value: number;
  games: number;
  wins: number;
  streak: number;
  bestStreak: number;
  updatedAt: number;
};
/** The viewer's own line. A guest's is private: `rank` is the place it
 *  would take, shown only to them until they join. */
export type PersonalEntry = LeaderboardEntry & { public: boolean };
export type LeaderboardResponse = {
  game: LeaderboardGame;
  views: LeaderboardView[];
  selectedView: string;
  entries: LeaderboardEntry[];
  personal: PersonalEntry | null;
  /** Public players on this board. */
  total: number;
};
/** The viewer's standing in each game they have played (GET /api/leaderboards/me). */
export type LeaderboardSummary = {
  gameId: LeaderboardGameId;
  view: string;
  label: string;
  metric: LeaderboardMetric;
  unit: string;
  value: number;
  rank: number;
  total: number;
  games: number;
  wins: number;
  streak: number;
  bestStreak: number;
  public: boolean;
};
/** What a finished rated game did (GET /api/leaderboards/result). */
export type RatedResult = {
  gameId: LeaderboardGameId;
  view: string;
  metric: LeaderboardMetric;
  unit: string;
  /** The board value before this game; null on a first result. */
  before: number | null;
  after: number;
  delta: number;
  /** This game's own number: points in a rated game, the run's score or
   *  puzzles solved on a best-result board (which may not be a new best). */
  runValue: number;
  rank: number;
  previousRank: number | null;
  total: number;
  public: boolean;
  streak: number;
  bestStreak: number;
  newBest: boolean;
  counted: boolean;
  reason?: string;
};
/** An unfinished rated game (GET /api/solo/ranked). */
export type ActiveRatedGame = {
  gameId: LeaderboardGameId;
  /** rating: replacing it counts as a loss. score: a Rota town alone, dropped without one. */
  kind: 'rating' | 'score';
  url: string;
  label: string;
  round: number;
  rounds: number;
  startedAt: number;
};

/** Every rating starts here. Keep in step with the server's constant. */
export const STARTING_RATING = 1000;

const grouping = new Intl.NumberFormat('en-US');
/** The number as it reads on a board. */
export function formatValue(value: number) {
  return grouping.format(Math.round(value));
}
/** A short unit after a number, singular where it should be. */
export function unitLabel(metric: LeaderboardMetric, value: number) {
  if (metric === 'rating') return 'rating';
  if (metric === 'score') return value === 1 ? 'point' : 'points';
  if (metric === 'puzzles') return 'solved';
  return value === 1 ? 'level' : 'levels';
}
/** Signed change, with a real minus sign. */
export function formatDelta(delta: number) {
  const n = Math.round(delta);
  return n > 0 ? `+${grouping.format(n)}` : n < 0 ? `−${grouping.format(-n)}` : '±0';
}
