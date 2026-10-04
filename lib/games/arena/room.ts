import type { CardId } from './cards.ts';
import type { Difficulty, Match, Mode, Side } from './engine.ts';
import type { QuestAction, QuestState } from './quest.ts';
import type { DraftView } from './draft.ts';

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
 * - `POST /api/arena/<token>/deck`     { deck, ready? } → your Versus deck for
 *     the next battle (while one waits, it replaces your hand at once). In
 *     the deck phase `ready` says you picked it and loaded; in a draft it
 *     says only that you loaded (the deck is the draft's).
 * - `POST /api/arena/<token>/draft`    { round, picks } → your cards kept
 *     this draft round so far; two lock them in.
 * - `POST /api/arena/<token>/quest`    QuestAction → host only, a Quest
 *     choice; { suggest } from anyone else marks what they would pick.
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
  /** 'map': a Quest between battles. 'deck': everyone picks a deck of
   *  eight before the battle; 'draft': the Split draft runs first. */
  status: 'deck' | 'draft' | 'waiting' | 'playing' | 'over' | 'map';
  /** Counts battles in this room; commands name the one they are for. */
  round: number;
  /** The table that launched the room, to go back to. */
  table: string | null;
  /** A Quest room: the run the table shares, between and around battles. */
  quest: QuestState | null;
  /** What each seated person last suggested in a Quest. */
  suggestions: { key: string; name: string }[];
  /** How a Versus room deals decks: picked before each battle, drafted, or
   *  (null) the ones sent. */
  decks?: ArenaDecks | null;
  /** Per seat: picked and loaded (the deck phase), or loaded (a draft).
   *  Bots are always ready. */
  ready?: boolean[];
  /** Milliseconds left in the deck phase (its cap), when it runs. */
  left?: number;
  /** The draft as you see it, once it has started. */
  draft?: DraftView | null;
};

/** How a Versus room deals decks: 'pick' opens a deck picker before each
 *  battle, 'draft' runs the Split draft (lib/games/arena/draft.ts). */
export type ArenaDecks = 'pick' | 'draft';

/** How long the deck phase waits for everyone's Ready. */
export const DECK_MS = 30_000;

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
  /** The host's Versus deck; everyone else sends theirs on joining. */
  deck?: CardId[];
  /** Pick decks before each battle, or draft them (the setup's Draft). */
  decks?: ArenaDecks;
  /** A Quest for the table's one or two people. */
  quest?: boolean;
  /** Cards the host's earlier quests unlocked. */
  unlocked?: CardId[];
};

export type { QuestAction };
