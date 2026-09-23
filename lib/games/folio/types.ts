/**
 * Ten famous daily games, each keeping the loss rule of its original.
 * Order is the order shown in practice.
 */
export const KINDS = [
  'word',
  'groups',
  'four',
  'waffle',
  'country',
  'equation',
  'sudoku',
  'mines',
  'nonogram',
  'code',
] as const;
export type Kind = (typeof KINDS)[number];
/** 1 easy, 2 medium, 3 hard, 4 very hard. */
export type Level = 1 | 2 | 3 | 4;
/** The level a run starts at; each boss beaten raises it by one, up to 4. */
export type Difficulty = 1 | 2 | 3;
export type NodeType = 'puzzle' | 'boss';
/** A small change to the trail, offered after each boss but the last. */
export type Edit = {
  /** Strike removes `kind` from every later stop; swap changes one stop. */
  type: 'strike' | 'swap';
  kind: Kind;
  changes: { node: string; to: Kind }[];
};
export type MapNode = {
  id: string;
  row: number;
  lane: number;
  type: NodeType;
  kind: Kind;
  level: Level;
  next: string[];
};
/** Public state of the puzzle in play; `view` is owned by the kind module. */
export type Puzzle = {
  kind: Kind;
  boss: boolean;
  level: Level;
  remaining: number;
  allowance: number;
  /** Plural noun for the allowance, e.g. "guesses", "mistakes", "swaps". */
  budget: string;
  status: 'playing' | 'won' | 'lost';
  view: unknown;
};
export type FolioGame = {
  version: 3;
  revision: number;
  seed: number;
  practice?: { kind: Kind; boss: boolean };
  seats: number;
  difficulty: Difficulty;
  phase: 'lobby' | 'map' | 'puzzle' | 'result' | 'over';
  lives: number;
  maxLives: number;
  map: MapNode[];
  /** Games struck from the trail by an edit. */
  struck: Kind[];
  /** Node currently being played or just finished. */
  at?: string;
  /** Visited node ids in order, with the outcome of each. */
  path: { id: string; won: boolean }[];
  puzzle?: Puzzle;
  secret?: unknown;
  /** Edits on offer after a boss; empty otherwise. */
  edits: Edit[];
  result?: { won: boolean; message: string; answer: string };
  victory: boolean;
  startedAt: number;
  updatedAt: number;
};
export type PublicGame = Omit<FolioGame, 'secret' | 'seed'>;
export type Action =
  | { type: 'node'; id: string }
  | { type: 'move'; move: Record<string, unknown> }
  | { type: 'give-up' | 'continue' | 'start' }
  /** Development only: the server refuses it outside `npm run dev`. */
  | { type: 'dev-win' }
  | { type: 'edit'; index: number };
export type FolioMember = { id: string; name: string; online: boolean };
export type FolioView = {
  token: string;
  game: PublicGame;
  viewerId: string;
  /** Present only for someone who can see the run but has not joined it. */
  joined: boolean;
  members: FolioMember[];
};
export type FolioSummary = {
  token: string;
  seats: number;
  members: string[];
  phase: FolioGame['phase'];
  round: number;
  lives: number;
  difficulty: Difficulty;
  victory: boolean;
  practice?: { kind: Kind; boss: boolean };
  updatedAt: number;
};
