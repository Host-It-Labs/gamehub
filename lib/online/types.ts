import type {
  Difficulty,
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
export type Table = {
  token: string;
  gameId: GameId;
  difficulty: Difficulty;
  starter?: boolean;
  nightMarket?: boolean;
  fastMode?: boolean;
  capacity: number;
  revision: number;
  status: 'lobby' | 'playing' | 'finished' | 'closed';
  members: Member[];
  viewerId: string;
  isHost: boolean;
  viewerSeat: number | null;
  matchId: string | null;
  game: GameView | null;
  botError: boolean;
  votes?: Partial<Record<GameId, string[]>>;
};
export type TableCommand =
  | {
      type: 'configure';
      gameId: GameId;
      difficulty: Difficulty;
      starter?: boolean;
  nightMarket?: boolean;
      fastMode?: boolean;
      capacity: number;
    }
  | { type: 'vote'; gameId: GameId }
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
