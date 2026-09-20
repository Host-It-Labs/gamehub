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
  fastMode?: boolean;
  partyMode?: 'teams' | 'individual';
  capacity: number;
  revision: number;
  status: 'lobby' | 'playing' | 'finished' | 'closed';
  members: Member[];
  viewerId: string;
  isHost: boolean;
  viewerSeat: number | null;
  matchId: string | null;
  game: GameView | null;
  adventure?: AnyGame | null;
  botError: boolean;
  votes?: Partial<Record<OnlineGameId, string[]>>;
};
export type TableCommand =
  | {
      type: 'configure';
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
      partyMode?: 'teams' | 'individual';
  capacity: number;
    }
  | { type: 'adventure-move'; move: AnyMove; key: string }
  | { type: 'advance-practice' }
  | { type: 'vote'; gameId: OnlineGameId }
  | { type: 'lesson'; step: number }
  | { type: 'start'; learning?: boolean }
  | { type: 'begin-match' }
  | { type: 'abandon' | 'close' | 'leave' | 'retry-bot' }
  | { type: 'replace' | 'remove'; memberId: string }
  | { type: 'rename'; name: string }
  | { type: 'move'; move: Move; decision?: string };
export type Command = {
  requestId: string;
  matchId: string | null;
  revision: number;
  action: TableCommand;
};
