import type { Difficulty, Match, Mode, Side } from './engine.ts';

/**
 * The shapes an online Arena room sends. A table launches a room with its
 * players seated; empty seats get bots. Routes (see server/arena.ts):
 *
 * - `GET  /api/arena/<token>`          → ArenaSnapshot (joining, resyncing)
 * - `GET  /api/arena/<token>/events`   → event stream:
 *     `event: snapshot` ArenaSnapshot on connect and when a new battle starts,
 *     `event: room` ArenaRoomView when seats or status change,
 *     plain `data:` TickMessage (net.ts) every server step,
 *     `event: gone` when the room is removed.
 * - `POST /api/arena/<token>/commands` { round, slot, x, y } → { ok: true }
 *     or 409 with a `reason` ('phase' | 'card' | 'elixir' | 'place' | 'round').
 * - `POST /api/arena/<token>/again`    {} → host only, once a battle is over.
 */
export type ArenaSeat = {
  name: string;
  bot: boolean;
  /** A person with the room open; a bot stands in while they are away. */
  connected: boolean;
};

export type ArenaRoomView = {
  token: string;
  mode: Mode;
  difficulty: Difficulty;
  /** Indexed by player: seat i plays for side i % 2. */
  seats: ArenaSeat[];
  /** The viewer's seat. */
  you: number;
  /** The viewer may start the next battle. */
  host: boolean;
  status: 'waiting' | 'playing' | 'over';
  /** Counts battles in this room; commands name the one they are for. */
  round: number;
  /** The table that launched the room, to go back to. */
  table: string | null;
};

export type ArenaSnapshot = {
  room: ArenaRoomView;
  match: Match;
  /** The newest final tick; `match` is the state after it. */
  horizon: number;
};

/** How a table seats its players: member id → side. */
export type ArenaTeams = Record<string, Side>;

export type ArenaLaunch = {
  kind: 'arena';
  mode: Mode;
  difficulty: Difficulty;
  teams?: ArenaTeams;
};
