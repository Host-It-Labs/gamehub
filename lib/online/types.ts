import type { StandaloneId } from '../games/standalone/types.ts';
import type { AnyGame, AnyMove } from '../games/standalone/registry.ts';
export type OnlineGameId = GameId | StandaloneId;
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
  host: boolean;
  /** Created the table; stays at it even after handing hosting over. */
  owner?: boolean;
  seat: number | null;
  bot: boolean;
};
export type Table = GameOptions & {
  token: string;
  gameId: OnlineGameId;
  difficulty: Difficulty;
  shields?: boolean;
  customerOrders?: boolean;
  sanctuaryGoalsEnabled?: boolean;
  ambienceEnabled?: boolean;
  fastMode?: boolean;
  capacity: number;
  revision: number;
  status: 'lobby' | 'playing' | 'finished' | 'closed';
  members: Member[];
  viewerId: string;
  isHost: boolean;
  /** Whether this viewer may move reveals on: the host, or anyone seated while the host is away. */
  canAdvance: boolean;
  viewerSeat: number | null;
  matchId: string | null;
  game: GameView | null;
  adventure?: AnyGame | null;
  botError: boolean;
  setupOpen?: boolean;
  votes?: Partial<Record<OnlineGameId, string[]>>;
  /** Open for ten seconds after a party match: member id → the game they want next. */
  nextVote?: { endsAt: number; ballots: Record<string, StandaloneId> } | null;
};
export type TableCommand =
  | {
      type: 'configure';
      openSetup?: boolean;
      contentSet?: GameOptions['contentSet'];
      roamEnabled?: boolean;
      turningTide?: boolean;
      marketSeasons?: boolean;
      migration?: boolean;
      salvage?: boolean;
      specialtyStalls?: boolean;
      gameId: OnlineGameId;
      difficulty: Difficulty;
      shields?: boolean;
      customerOrders?: boolean;
      sanctuaryGoalsEnabled?: boolean;
      fastMode?: boolean;
      capacity: number;
    }
  | { type: 'adventure-move'; move: AnyMove; key: string }
  | { type: 'ambience'; enabled: boolean }
  | { type: 'advance-practice' }
  | { type: 'setup'; open: boolean }
  | { type: 'vote'; gameId: OnlineGameId }
  | { type: 'next-game'; gameId: StandaloneId }
  | { type: 'lesson'; step: number }
  | { type: 'start'; learning?: boolean }
  | { type: 'begin-match' }
  | { type: 'abandon' | 'close' | 'leave' | 'retry-bot' }
  | { type: 'replace' | 'remove' | 'host'; memberId: string }
  | { type: 'rename'; name: string }
  | { type: 'move'; move: Move; decision?: string };
export type Command = {
  requestId: string;
  matchId: string | null;
  revision: number;
  action: TableCommand;
};
