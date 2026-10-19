import type { StandaloneId } from '../games/standalone/types.ts';
import type { AnyGame, AnyMove } from '../games/standalone/registry.ts';
import type { TriviaLength, TriviaMode } from '../games/party/trivia.ts';
export type OnlineGameId = GameId | StandaloneId;
/** Everything the table shelf offers: its own games plus Folio and Relic, which run in their own rooms. */
export type ShelfGameId = OnlineGameId | 'folio' | 'relic' | 'arena' | 'rota' | 'alto' | 'diner';
import type {
  Difficulty,
  GameOptions,
  GameId,
  Move,
  Observation,
} from '../games/trio/engine.ts';

export type User = { id: string; name: string; email: string };
export type GameView = Omit<Observation, 'knownPackets'>;
export type Member = {
  id: string;
  name: string;
  connected: boolean;
  /** Leads the game on screen: the match's picked leader while it is played, the creator otherwise. */
  host: boolean;
  /** The table's admin: its creator until they leave or stay away, then the next player. */
  owner?: boolean;
  /** Picked in the lobby to lead the next match. */
  nextHost?: boolean;
  seat: number | null;
  bot: boolean;
};
export type Table = GameOptions & {
  token: string;
  gameId: OnlineGameId;
  difficulty: Difficulty;
  customerOrders?: boolean;
  sanctuaryGoalsEnabled?: boolean;
  ambienceEnabled?: boolean;
  fastMode?: boolean;
  /** Private, account-owned solo match; return to its standings and saved games. */
  rankedSolo?: boolean;
  /** Party games: the table votes between rounds; otherwise the host picks. */
  partyVotes?: boolean;
  /** Trivia's match format; its minigames share this mode for the whole match. */
  triviaMode?: TriviaMode;
  /** Tower and Expedition: 4 or 8 rounds. */
  triviaRounds?: TriviaLength;
  capacity: number;
  revision: number;
  status: 'lobby' | 'playing' | 'finished' | 'closed';
  members: Member[];
  viewerId: string;
  /** The viewer is the table's admin: they set it up, start games and close it.
   *  The creator holds it until they leave or stay away; then it passes on. */
  isHost: boolean;
  /** Whether this viewer may move reveals on: the host, or anyone seated while the host is away. */
  canAdvance: boolean;
  viewerSeat: number | null;
  matchId: string | null;
  game: GameView | null;
  adventure?: AnyGame | null;
  botError: boolean;
  setupOpen?: boolean;
  votes?: Partial<Record<ShelfGameId, string[]>>;
  /** After a party match: member id → the game they want next. Open for ten
   *  seconds when the table votes; without a deadline the host picks alone. */
  nextVote?: NextGameVote | null;
  /** The table moved on to Folio, Relic or Arena, which run in their own rooms. */
  handoff?: { kind: 'folio' | 'relic' | 'arena' | 'rota' | 'alto' | 'diner'; url: string; at: number } | null;
};
export type NextGameVote = {
  endsAt: number | null;
  ballots: Record<string, StandaloneId>;
  host?: true;
};
export type TableCommand =
  | {
      type: 'configure';
      openSetup?: boolean;
      contentSet?: GameOptions['contentSet'];
      roamEnabled?: boolean;
      gold?: boolean;
      marketSeasons?: boolean;
      census?: boolean;
      anchor?: boolean;
      dawn?: boolean;
      specialtyStalls?: boolean;
      gameId: OnlineGameId;
      difficulty: Difficulty;
      customerOrders?: boolean;
      sanctuaryGoalsEnabled?: boolean;
      fastMode?: boolean;
      partyVotes?: boolean;
      triviaMode?: TriviaMode;
      triviaRounds?: TriviaLength;
      capacity: number;
    }
  | { type: 'adventure-move'; move: AnyMove; key: string }
  | { type: 'ambience'; enabled: boolean }
  | { type: 'advance-practice' }
  | { type: 'setup'; open: boolean }
  | { type: 'vote'; gameId: ShelfGameId }
  | { type: 'next-game'; gameId: StandaloneId }
  | { type: 'lesson'; step: number }
  | { type: 'start'; learning?: boolean }
  | { type: 'begin-match' }
  | { type: 'abandon' | 'close' | 'leave' | 'retry-bot' }
  | { type: 'replace' | 'remove' | 'host' | 'owner'; memberId: string }
  | { type: 'rename'; name: string }
  | { type: 'move'; move: Move; decision?: string };
export type Command = {
  requestId: string;
  matchId: string | null;
  revision: number;
  action: TableCommand;
};
