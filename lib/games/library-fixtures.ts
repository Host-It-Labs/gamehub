import { printedBoxArt } from './box-covers.ts';
import type { GameId } from './trio/engine';
import { standaloneGames } from './standalone/registry.ts';
import type { StandaloneId } from './standalone/types.ts';

/**
 * Library presentation data for the games that ship. There are no placeholder
 * games, fake friends or fake tables: every entry here opens and plays.
 * Nothing here is persisted or sent to the server.
 */
export type Mode = 'Competitive' | 'Co-op' | 'Teams';
export type Material =
  | 'kraft'
  | 'cloth'
  | 'tin'
  | 'card'
  | 'wood'
  | 'woven'
  | 'embossed'
  | 'board'
  | 'glass';
export type Friend = {
  id: string;
  name: string;
  hue: number;
  online?: boolean;
};
export type LibraryGame = {
  id: string;
  /** Set for the three games the trio engine runs, which carry box artwork. */
  gameId?: GameId;
  /** Set for games with their own rules module and their own table. */
  standaloneId?: StandaloneId;
  href?: string;
  durationLabel?: string;
  name: string;
  cover?: string;
  /** The cover image contains its own generated, styled game title. */
  coverIncludesTitle?: boolean;
  spine?: string;
  world: string;
  minutes: number;
  players: [number, number];
  mode: Mode;
  weight: 1 | 2 | 3 | 4;
  genre: string;
  material: Material;
  palette: [string, string, string];
  motif: string;
  playing: string[];
};

/** There are no accounts yet, so nobody is shown playing a game. */
export const friends: Friend[] = [];
export const you: Friend = { id: 'you', name: 'You', hue: 44, online: true };
export const friendById = (id: string) =>
  friends.find((f) => f.id === id) ?? you;

const real = (
  gameId: GameId,
  name: string,
  rest: Omit<LibraryGame, 'id' | 'gameId' | 'name'>,
): LibraryGame => ({
  id: gameId,
  gameId,
  name,
  ...rest,
  ...printedBoxArt(gameId),
});

export const realGames: Record<GameId, LibraryGame> = {
  undertow: real('undertow', 'Nox', {
    world: 'A smugglers’ cabin, a lantern, and a table of tricks nobody wants',
    minutes: 25,
    players: [2, 6],
    mode: 'Competitive',
    weight: 2,
    genre: 'Trick taking',
    material: 'wood',
    palette: ['#1d1a16', '#5a4523', '#e8c777'],
    motif: 'lantern',
    playing: [],
  }),
  wildgrove: real('wildgrove', 'Mora', {
    world: 'A paper observatory where wild creatures move back in',
    minutes: 30,
    players: [2, 6],
    mode: 'Competitive',
    weight: 2,
    genre: 'Draft & place',
    material: 'kraft',
    palette: ['#5a6b3c', '#a3b06a', '#f3efdf'],
    motif: 'leaf',
    playing: [],
  }),
  midnight: real('midnight', 'Yata', {
    world:
      'Lantern-lit night market, a red drum table, orders shouted over the canal',
    minutes: 20,
    players: [2, 6],
    mode: 'Competitive',
    weight: 1,
    genre: 'Set collection',
    material: 'card',
    palette: ['#1b2557', '#c9352d', '#ffd98a'],
    motif: 'flame',
    playing: [],
  }),
};

const own = (
  standaloneId: StandaloneId,
  rest: Omit<LibraryGame, 'id' | 'standaloneId' | 'name'>,
): LibraryGame => ({
  id: standaloneId,
  standaloneId,
  name: standaloneGames[standaloneId].name,
  ...printedBoxArt(standaloneId),
  ...rest,
});

/**
 * Games with their own rules and their own table. Their printed covers come
 * from box-covers.ts; material and motif only colour the box's edges.
 */
const partyBoxes = {
  orin: own('orin', {
    world: 'Party games about how well your group really knows each other',
    minutes: 20,
    players: [2, 6],
    mode: 'Competitive',
    weight: 1,
    genre: 'Knowing each other',
    material: 'card',
    palette: ['#b8432b', '#f2b531', '#fff6e2'],
    motif: 'grid',
    playing: [],
  }),
  miro: own('miro', {
    world: 'Quick trivia rounds: pin places on the globe, size things up',
    minutes: 20,
    players: [2, 6],
    mode: 'Competitive',
    weight: 1,
    genre: 'Trivia',
    material: 'tin',
    palette: ['#1f5a4a', '#ff5a3c', '#fbf6e9'],
    motif: 'flame',
    playing: [],
  }),
};
/** Dial is played inside Tribu and Sizes inside Sabi; their old tables open
 * the set's box. */
export const standaloneLibraryGames: Record<StandaloneId, LibraryGame> = {
  ...partyBoxes,
  dial: partyBoxes.orin,
  size: partyBoxes.miro,
};

export const libraryGames: LibraryGame[] = [
  {
    id: 'folio',
    name: 'Folio',
    href: '/folio',
    ...printedBoxArt('folio'),
    world:
      'Ten famous daily puzzles on one branching trail. Beat the bosses and reach the summit together.',
    minutes: 25,
    durationLabel: '15–25 min',
    players: [1, 3],
    mode: 'Co-op',
    weight: 1,
    genre: 'Puzzle roguelike',
    material: 'card',
    palette: ['#193d79', '#c5472c', '#f1dc93'],
    motif: 'grid',
    playing: [],
  },
  {
    id: 'relic',
    name: 'Relic',
    href: '/relic',
    ...printedBoxArt('relic'),
    world:
      'Scratch little surprises and discover a world of paper, luck and gentle skill',
    minutes: 0,
    durationLabel: 'At your pace',
    players: [1, 6],
    mode: 'Co-op',
    weight: 1,
    genre: 'Scratch tickets & growing workshop',
    material: 'kraft',
    palette: ['#76583d', '#a5c8a0', '#f6e3bb'],
    motif: 'gem',
    playing: [],
  },
  ...Object.values(realGames),
  standaloneLibraryGames.orin,
  standaloneLibraryGames.miro,
];
export const playableGame = (id: string) =>
  libraryGames.find(
    (g) => g.id === id && (g.gameId || g.standaloneId || g.href),
  );
export const gameByLibraryId = (id: string) =>
  libraryGames.find((g) => g.id === id);

/**
 * The library groups games by kind. Add a new game to `libraryGames` and list its
 * id in one section here; a new kind of game gets a new section.
 */
export type LibrarySection = { id: string; title: string; games: string[] };
export const librarySections: LibrarySection[] = [
  {
    id: 'strategy',
    title: 'Strategy',
    games: ['undertow', 'wildgrove', 'midnight'],
  },
  { id: 'party', title: 'Party', games: ['orin', 'miro'] },
  { id: 'solo', title: 'Solo & co-op', games: ['folio', 'relic'] },
];

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((part) => part[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();
export const playerRange = ([min, max]: [number, number]) =>
  min === max ? String(min) : `${min}–${max}`;
