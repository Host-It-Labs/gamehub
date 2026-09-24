import { printedBoxArt } from './box-covers.ts';
import type { GameId } from './trio/engine';
import { standaloneGames } from './standalone/registry.ts';
import type { StandaloneId } from './standalone/types.ts';

/**
 * Library presentation data. The three real games carry their catalog ids; every
 * other entry is a placeholder that fills the shelves until more games ship.
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
  bookmark?: boolean;
  friendsThisWeek?: number;
  liveTables?: number;
};

export const friends: Friend[] = [
  { id: 'aiko', name: 'Aiko', hue: 18, online: true },
  { id: 'ren', name: 'Ren', hue: 152, online: true },
  { id: 'mara', name: 'Mara', hue: 276, online: true },
  { id: 'dev', name: 'Dev', hue: 34, online: true },
  { id: 'lina', name: 'Lina', hue: 204, online: true },
  { id: 'tomas', name: 'Tomás', hue: 92, online: true },
  { id: 'noor', name: 'Noor', hue: 330 },
  { id: 'eli', name: 'Eli', hue: 60 },
  { id: 'sana', name: 'Sana', hue: 240 },
  { id: 'kofi', name: 'Kofi', hue: 8 },
];
export const you: Friend = { id: 'you', name: 'You', hue: 44, online: true };
export const friendById = (id: string) =>
  friends.find((f) => f.id === id) ?? you;

const real = (
  gameId: GameId,
  name: string,
  rest: Omit<LibraryGame, 'id' | 'gameId' | 'name'>,
): LibraryGame => ({ id: gameId, gameId, name, ...rest, ...printedBoxArt(gameId) });

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
    playing: ['aiko', 'ren', 'mara'],
    friendsThisWeek: 4,
    liveTables: 3,
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
    playing: ['lina', 'tomas'],
    friendsThisWeek: 3,
    liveTables: 2,
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
    playing: ['dev', 'eli', 'noor'],
    friendsThisWeek: 6,
    liveTables: 4,
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
 * Games with their own rules and their own table. They have no box artwork
 * yet, so their covers still print a material and a motif the way the shelf
 * placeholders do — the difference is that these ones open and play.
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

const fake = (
  id: string,
  name: string,
  world: string,
  minutes: number,
  players: [number, number],
  mode: Mode,
  weight: LibraryGame['weight'],
  genre: string,
  material: Material,
  palette: [string, string, string],
  motif: string,
  playing: string[] = [],
  extra: Partial<LibraryGame> = {},
): LibraryGame => ({
  id,
  name,
  world,
  minutes,
  players,
  mode,
  weight,
  genre,
  material,
  palette,
  motif,
  playing,
  ...extra,
});

export const placeholderGames: LibraryGame[] = [
  fake(
    'kaldo',
    'Kaldo',
    'Mountain rail race',
    40,
    [2, 4],
    'Competitive',
    3,
    'Racing',
    'tin',
    ['#284157', '#9fb7c9', '#f2f5f7'],
    'train',
  ),
  fake(
    'pemba',
    'Pemba',
    'Spice-market bidding',
    35,
    [3, 5],
    'Competitive',
    3,
    'Auction',
    'cloth',
    ['#8a3a1e', '#e0893a', '#fbe4b8'],
    'scale',
    ['sana', 'kofi'],
  ),
  fake(
    'mavi',
    'Mavi',
    'Tide-pool collecting',
    15,
    [1, 4],
    'Competitive',
    1,
    'Family',
    'card',
    ['#0f6b6e', '#63c7bf', '#f3fbf7'],
    'shell',
    ['mara'],
  ),
  fake(
    'tolu',
    'Tolu',
    'Drum-circle rhythm bluffing',
    20,
    [3, 6],
    'Competitive',
    2,
    'Party',
    'wood',
    ['#7a1f1c', '#c8542c', '#f7d9a6'],
    'drum',
    ['dev', 'lina'],
  ),
  fake(
    'nima',
    'Nima',
    'Paper-lantern festival',
    45,
    [2, 5],
    'Competitive',
    3,
    'Strategy',
    'embossed',
    ['#2a1e4f', '#e6853a', '#ffe1a8'],
    'lantern',
    ['tomas', 'noor', 'eli'],
    { bookmark: true },
  ),
  fake(
    'rako',
    'Rako',
    'Desert caravan trading',
    25,
    [2, 5],
    'Competitive',
    2,
    'Economic',
    'kraft',
    ['#8b5a2b', '#d9a066', '#f8ead3'],
    'tent',
  ),
  fake(
    'imbi',
    'Imbi',
    'Mushroom-forest draft',
    20,
    [2, 4],
    'Competitive',
    2,
    'Draft',
    'kraft',
    ['#3d4a2a', '#b34a3c', '#f4e6c4'],
    'mushroom',
    [],
    { bookmark: true },
  ),
  fake(
    'sato',
    'Sato',
    'Tea-house tile laying',
    20,
    [2, 4],
    'Competitive',
    2,
    'Abstract',
    'woven',
    ['#5a6a3a', '#c9c08a', '#f9f3e3'],
    'cup',
    ['kofi'],
  ),
  fake(
    'lumo',
    'Lumo',
    'Firefly night',
    30,
    [1, 4],
    'Co-op',
    2,
    'Co-op',
    'cloth',
    ['#0e1f3a', '#3e6a8f', '#ffe08a'],
    'sparkle',
    ['ren', 'lina'],
    { liveTables: 2 },
  ),
  fake(
    'bora',
    'Bora',
    'Storm-chasing boats',
    30,
    [2, 5],
    'Co-op',
    3,
    'Adventure',
    'tin',
    ['#22313f', '#6e8aa3', '#e8eef2'],
    'waves',
    ['eli', 'mara'],
  ),
  fake(
    'tiko',
    'Tiko',
    'Street-cat territories',
    20,
    [2, 5],
    'Competitive',
    2,
    'Family',
    'board',
    ['#a8865a', '#e2c79a', '#3d3128'],
    'cat',
    ['noor', 'dev'],
  ),
  fake(
    'anoa',
    'Anoa',
    'River ferry logistics',
    40,
    [2, 4],
    'Competitive',
    3,
    'Strategy',
    'card',
    ['#2f5d50', '#9cc3a1', '#f7f1dc'],
    'ship',
    ['aiko'],
  ),
  fake(
    'zuri',
    'Zuri',
    'Bead-weaving patterns',
    30,
    [2, 4],
    'Competitive',
    2,
    'Abstract',
    'woven',
    ['#7d2f4f', '#e2a63a', '#2f6d8f'],
    'grid',
    ['tomas', 'sana'],
  ),
  fake(
    'pelo',
    'Pelo',
    'Snow-hare sledding',
    20,
    [2, 4],
    'Competitive',
    1,
    'Racing',
    'board',
    ['#6f8fb5', '#d9e6f2', '#ffffff'],
    'snow',
    ['kofi'],
  ),
  fake(
    'odu',
    'Odu',
    'Clay-kiln set collection',
    25,
    [2, 4],
    'Competitive',
    2,
    'Sets',
    'embossed',
    ['#8a4a2a', '#d08a55', '#f2dcc2'],
    'pot',
  ),
  fake(
    'kena',
    'Kena',
    'Bee-meadow engine',
    45,
    [1, 4],
    'Co-op',
    3,
    'Engine',
    'kraft',
    ['#5c6b2e', '#e6b31e', '#fbf3d5'],
    'hexagon',
    ['dev', 'noor'],
  ),
  fake(
    'suvi',
    'Suvi',
    'Northern-lights memory',
    20,
    [2, 4],
    'Co-op',
    1,
    'Memory',
    'tin',
    ['#0f2b3f', '#3fa88a', '#c6e8ff'],
    'moon',
  ),
  fake(
    'jalo',
    'Jalo',
    'Fish-market auction',
    25,
    [2, 5],
    'Competitive',
    2,
    'Auction',
    'card',
    ['#1e3a5f', '#d94f5c', '#f5e7c8'],
    'fish',
    ['eli', 'tomas', 'aiko'],
  ),
  fake(
    'tavi',
    'Tavi',
    'Moth-and-moon',
    30,
    [1, 4],
    'Co-op',
    2,
    'Co-op',
    'cloth',
    ['#3b2a5a', '#8c78b8', '#f6e7ff'],
    'moth',
    ['sana', 'kofi'],
  ),
];

export const libraryGames: LibraryGame[] = [
  {
    id: 'folio', name: 'Folio', href: '/folio', ...printedBoxArt('folio'),
    world: 'Ten famous daily puzzles on one branching trail. Beat the bosses and reach the summit together.',
    minutes: 25, durationLabel: '15–25 min', players: [1, 3], mode: 'Co-op', weight: 1,
    genre: 'Puzzle roguelike', material: 'card', palette: ['#193d79', '#c5472c', '#f1dc93'],
    motif: 'grid', playing: [],
  },
  {
    id: 'relic', name: 'Relic', href: '/relic', ...printedBoxArt('relic'),
    world: 'Scratch little surprises and discover a world of paper, luck and gentle skill',
    minutes: 0, durationLabel: 'At your pace', players: [1, 6], mode: 'Co-op', weight: 1,
    genre: 'Scratch tickets & growing workshop', material: 'kraft', palette: ['#76583d', '#a5c8a0', '#f6e3bb'],
    motif: 'gem', playing: [],
  },
  ...Object.values(realGames),
  standaloneLibraryGames.orin,
  standaloneLibraryGames.miro,
  ...placeholderGames,
];
export const playableGame = (id: string) =>
  libraryGames.find(
    (g) => g.id === id && (g.gameId || g.standaloneId || g.href),
  );
export const gameByLibraryId = (id: string) =>
  libraryGames.find((g) => g.id === id);

export const shelves: {
  id: string;
  title: string;
  icon: string;
  games: string[];
}[] = [
  {
    id: 'playable',
    title: 'Ready to play',
    icon: 'sparkles',
    games: [
      'folio',
      'relic',
      'undertow',
      'wildgrove',
      'midnight',
      'orin',
      'miro',
    ],
  },
  {
    id: 'new',
    title: 'New this week',
    icon: 'sparkles',
    games: ['kaldo', 'pemba', 'rako', 'nima', 'tiko', 'odu', 'zuri'],
  },
  {
    id: 'coop',
    title: 'Co-op',
    icon: 'handshake',
    games: ['folio', 'relic', 'lumo', 'bora', 'tavi', 'suvi', 'kena'],
  },
  {
    id: 'quick',
    title: 'Under 20 minutes',
    icon: 'zap',
    games: ['mavi', 'sato', 'tolu', 'imbi', 'pelo', 'anoa'],
  },
  {
    id: 'friends',
    title: 'Friends are playing',
    icon: 'users',
    games: ['jalo', 'nima', 'kena'],
  },
];

export const heroGameId: GameId = 'undertow';

export const openTables: {
  game: string;
  seated: number;
  capacity: number;
  players: string[];
}[] = [
  { game: 'midnight', seated: 3, capacity: 5, players: ['dev', 'eli', 'noor'] },
  { game: 'wildgrove', seated: 2, capacity: 4, players: ['lina', 'tomas'] },
  {
    game: 'orin',
    seated: 4,
    capacity: 4,
    players: ['aiko', 'ren', 'mara', 'sana'],
  },
];

export const weeklyLeaders: { friend: string; score: number }[] = [
  { friend: 'aiko', score: 42 },
  { friend: 'ren', score: 37 },
  { friend: 'mara', score: 31 },
  { friend: 'dev', score: 28 },
  { friend: 'lina', score: 24 },
];

export const filters = ['Quick', 'Co-op', 'Light', 'Friends', 'New'] as const;

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((part) => part[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();
export const playerRange = ([min, max]: [number, number]) =>
  min === max ? String(min) : `${min}–${max}`;
