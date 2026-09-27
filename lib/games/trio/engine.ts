import { boxCover } from '../box-covers.ts';
/** Platform-independent base rules. Content/scoring live here so expansions can compose them later. */
export type ContentSet = 'beginner' | 'intermediate';
export type GameOptions = {
  contentSet?: ContentSet;
  roamEnabled?: boolean;
  turningTide?: boolean;
  marketSeasons?: boolean;
  migration?: boolean;
  salvage?: boolean;
  specialtyStalls?: boolean;
};
/** Seat order shared by the rules and the table's direction indicator. */
export function passingStep(g: { round: number }): 1 | -1 {
  return g.round % 2 ? 1 : -1;
}
export function tableOrderStep(g: { phase: string; round: number }): 1 | -1 {
  return g.phase === 'pass' ? passingStep(g) : 1;
}

export type GameId = 'undertow' | 'wildgrove' | 'midnight';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type Card = { id: number; kind: number; rank: number };
export type Move =
  | {
      type: 'play';
      card: number;
      zone?: number;
      ward?: boolean;
      order?: number;
      stall?: boolean;
      roam?: boolean;
      migration?: { card: number; from: number; to: number };
    }
  | { type: 'pass'; cards: number[] }
  | { type: 'salvage'; claim: boolean }
  | { type: 'roll' }
  | { type: 'undo' };
/** How long Nox's table shows a completed trick before the next card may be played. */
export const trickRevealMs = 1500;
/** True while the latest completed trick is still being shown on the table. */
export function revealingTrick(g: { id: GameId; events: Event[] }) {
  if (g.id !== 'undertow') return false;
  const last = g.events.findLast((e) => e.type === 'play' || e.type === 'trick');
  return last?.type === 'trick';
}
export type Event = {
  id: number;
  type: 'deal' | 'pass' | 'roll' | 'play' | 'trick' | 'finish' | 'salvage';
  player: number;
  text: string;
  kind?: number;
  points?: number;
  trick?: Game['trick'];
  hazard?: number;
  scoreChanges?: number[];
  salvageChanges?: number[];
};
export type Player = {
  name: string;
  hand: Card[];
  zones: Card[][];
  score: number;
  wards: number;
  salvageClaims?: number;
  roams?: number;
  migrations?: number;
  seasonPoints?: number;
  packet: number;
  festival?: { orders: number[]; stalls: { kind: number; from: number }[] };
};
export type Game = GameOptions & {
  seasonForecast?: number[];
  version: 4;
  shields?: boolean;
  customerOrders?: boolean;
  sanctuaryGoalsEnabled?: boolean;
  sanctuaryGoals?: number[];
  firstPlayer?: number;
  festivalOffers?: number[][];
  fastMode?: boolean;
  duelDeck?: boolean;
  id: GameId;
  difficulty: Difficulty;
  rngState: number;
  reserve: Card[];
  players: Player[];
  active: number;
  phase: 'pass' | 'roll' | 'play' | 'salvage' | 'over';
  trickLeader?: number;
  salvageClaimants?: number[];
  round: number;
  pick: number;
  roller: number;
  hazard: number;
  die: number;
  passes: number[][];
  passCards?: number;
  pending?: (Move | null)[];
  ready?: boolean[];
  trick: { player: number; card: Card; ward: boolean }[];
  lastTrick: { player: number; card: Card; ward: boolean }[];
  seen: Card[];
  voids: number[][];
  memory: Record<number, Card[]>[];
  events: Event[];
  revision: number;
  tutorial: boolean;
  lesson: number;
};
export type PublicGame = Omit<
  Game,
  'rngState' | 'reserve' | 'memory' | 'passes' | 'pending'
>;
export type Observation = PublicGame & {
  /** Only this viewer's unrevealed placement, for their private board preview. */
  ownMove?: Move;
  reserveCount: number;
  knownPackets: Record<number, Card[]>;
};
export const names = ['You', 'Rook', 'Static', 'Moth', 'Echo', 'Patch'];
export const suits = ['♠', '♥', '♣', '♦', 'ϟ'];
export const suitNames = ['Spades', 'Hearts', 'Clubs', 'Diamonds', 'Storm'];
export const creatures = [
  'Rust Fox',
  'Dish Owl',
  'Moss Beetle',
  'Night Marten',
  'Glass Frog',
  'Antenna Hare',
];
export const foods = [
  {
    name: 'Gyoza',
    formula: '2 → 7',
    rule: 'Each pair earns 7. A portion without a partner earns 0.',
    example: '5 portions make 2 pairs: 14 points.',
  },
  {
    name: 'Ramen',
    formula: '1 · 4 · 8 · 13 · 19',
    rule: '1 to 5 portions earn 1, 4, 8, 13 or 19 in total. Each portion after the fifth adds 2.',
    example: '4 portions earn 13. 6 earn 21.',
  },
  {
    name: 'Yakitori',
    formula: '4 + 4 + 1…',
    rule: 'Your first 2 portions earn 4 each. Each one after that earns 1.',
    example: '4 portions earn 4 + 4 + 1 + 1 = 10.',
  },
  {
    name: 'Pickles',
    formula: '1 + variety · max 5',
    rule: 'Each portion earns 1 plus the number of dish types you have, up to 5 each.',
    example: '2 portions with 3 dish types earn 2 × 4 = 8.',
  },
  {
    name: 'Sesame',
    formula: '2 each · most +6',
    rule: 'Each portion earns 2. Having the most at the table earns +6, or +3 each when tied. You need at least 1.',
    example: '3 portions, more than anyone else: 6 + 6 = 12.',
  },
  {
    name: 'Pudding',
    formula: '3 → 12 · extra 1',
    rule: 'Each set of 3 earns 12. Leftover portions earn 1 each.',
    example: '5 portions earn 12 + 2 = 14.',
  },
];
export const habitats = [
  {
    name: 'Courtyard',
    cap: 4,
    maxScore: 17,
    formula:
      'Largest same-species group: 1 → 2 pts; 2 → 6 pts; 3 → 11 pts; 4 → 17 pts',
    rule: 'Only your biggest group of one species scores: 1, 2, 3 or 4 alike earn 2, 6, 11 or 17.',
  },
  {
    name: 'Garden',
    cap: 4,
    maxScore: 16,
    formula: '8 points per matching pair',
    rule: 'Each matching pair earns 8. A creature without a partner earns 0.',
  },
  {
    name: 'Hollow',
    cap: 2,
    maxScore: 9,
    formula: 'Matching pair: 9 points',
    rule: 'Two alike earn 9. Anything else earns 0.',
  },
  {
    name: 'Glasshouse',
    cap: 3,
    maxScore: 9,
    formula: '3 points each if its species lives in another habitat',
    rule: 'Each creature here earns 3 if its species also lives in another of your habitats.',
  },
  {
    name: 'Channel',
    cap: 3,
    maxScore: 6,
    formula: '2 points per creature',
    rule: 'Each creature here earns 2, whatever its species.',
  },
  {
    name: 'Release',
    cap: 12,
    maxScore: 0,
    formula: 'Release creature · 0 points',
    rule: 'Let a creature go instead of placing it. It scores 0 and never counts anywhere. Always allowed, whatever the die.',
  },
  {
    name: 'Watchpost',
    cap: 1,
    maxScore: 10,
    formula: '2 points per other habitat with this species',
    rule: 'The creature here earns 2 for each other habitat that holds its species, up to 10. Each habitat counts once.',
  },
];
export const habitatOrder = [0, 1, 2, 3, 4, 6, 5];
/** Die faces never name a board: shapes, capacities and occupancy exist on every Mora world. */
export type DieFace = {
  name: string;
  symbol: string;
  kind: 'zones' | 'company' | 'empty' | 'new';
  zones: number[];
  rule: string;
};
export const dice: DieFace[] = [
  {
    name: 'Square spaces',
    symbol: '□',
    kind: 'zones',
    zones: [0, 1, 2],
    rule: 'Place in a habitat with square spaces.',
  },
  {
    name: 'Round spaces',
    symbol: '●',
    kind: 'zones',
    zones: [3, 4, 6],
    rule: 'Place in a habitat with round spaces.',
  },
  {
    name: 'Big homes',
    symbol: '⁝',
    kind: 'zones',
    zones: [0, 1, 3, 4],
    rule: 'Place in one of your four biggest habitats.',
  },
  {
    name: 'Company',
    symbol: '◉',
    kind: 'company',
    zones: [],
    rule: 'Place in a habitat that already has a creature. While all your habitats are empty, place anywhere.',
  },
  {
    name: 'Emptiest',
    symbol: '○',
    kind: 'empty',
    zones: [],
    rule: 'Place in a habitat with the fewest creatures, among those with room.',
  },
  {
    name: 'New species',
    symbol: '✦',
    kind: 'new',
    zones: [],
    rule: 'Place in a habitat without this species.',
  },
];
export const catalog = [
  {
    id: 'undertow' as GameId,
    name: 'Nox',
    genre: 'Trick taking',
    color: '#38baca',
    cover: boxCover('undertow')!,
  },
  {
    id: 'wildgrove' as GameId,
    name: 'Mora',
    genre: 'Draft & place',
    color: '#75b965',
    cover: boxCover('wildgrove')!,
  },
  {
    id: 'midnight' as GameId,
    name: 'Yata',
    genre: 'Set collection',
    color: '#df84bb',
    cover: boxCover('midnight')!,
  },
];
export function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
export function shuffled<T>(list: T[], r: () => number): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function random(g: Game) {
  g.rngState = (Math.imul(g.rngState, 1664525) + 1013904223) >>> 0;
  return g.rngState / 4294967296;
}
export function tideRanks(g: Pick<Game, 'fastMode'>) {
  // Existing saves finish with their original deck and penalty rank.
  return g.fastMode ? 5 : 10;
}
export function tidePenaltyRank(g: Pick<Game, 'fastMode'>) {
  return g.fastMode ? 4 : 8;
}
export function tidePenaltyValue(g: Pick<Game, 'fastMode'>) {
  return g.fastMode === true ? 10 : 40;
}
export function deck(id: GameId, round = 1, ranks = 10, perKind = 12): Card[] {
  return Array.from({ length: id === 'undertow' ? 5 * ranks : 6 * perKind }, (_, i) => ({
    id: (id === 'undertow' ? round * 100 : 0) + i,
    kind: id === 'undertow' ? Math.floor(i / ranks) : i % 6,
    rank: id === 'undertow' ? (i % ranks) + 1 : 0,
  }));
}
export function tideDeck(g: Pick<Game, 'round' | 'fastMode' | 'duelDeck'>) {
  return deck('undertow', g.round, tideRanks(g)).filter((card) =>
    !g.duelDeck || (g.fastMode ? [1, 4, 5] : [1, 3, 5, 8, 10]).includes(card.rank));
}
/** Floodline Station is the longer Mora world: three rounds of six creatures. */
export function totalRounds(g: Pick<Game, 'id' | 'players'> & { contentSet?: ContentSet }) {
  return g.id === 'undertow'
    ? g.players.length
    : g.id === 'wildgrove' && g.contentSet === 'intermediate'
      ? 3
      : 2;
}
/** Creatures of each species in the shuffled supply: enough for every seat's hands. */
export function supplyPerKind(g: Pick<Game, 'id'> & { contentSet?: ContentSet }) {
  return g.id === 'wildgrove' && g.contentSet === 'intermediate' ? 18 : 12;
}
export function handSize(g: Pick<Game, 'id' | 'players' | 'fastMode' | 'duelDeck'>) {
  return g.id === 'undertow'
    ? Math.floor((5 * (g.duelDeck ? (g.fastMode ? 3 : 5) : tideRanks(g))) / g.players.length)
    : 6;
}
export function cardName(
  id: GameId,
  c: Card,
  contentSet: ContentSet = 'beginner',
) {
  return id === 'undertow'
    ? `${suitNames[c.kind]} ${c.rank}`
    : id === 'wildgrove'
      ? creaturesFor(contentSet)[c.kind]
      : foodsFor(contentSet)[c.kind].name;
}
function emit(
  g: Game,
  type: Event['type'],
  player: number,
  text: string,
  kind?: number,
  points?: number,
) {
  g.events.push({
    id:
      g.revision * 10 +
      g.events.filter((e) => Math.floor(e.id / 10) === g.revision).length,
    type,
    player,
    text,
    kind,
    points,
  });
  g.events = g.events.slice(-100);
}
function remember(g: Game) {
  g.players.forEach((p, i) => {
    g.memory[i][p.packet] = [...p.hand];
  });
}
function deal(g: Game) {
  const n = handSize(g);
  if (g.id === 'undertow')
    g.reserve = shuffled(tideDeck(g), () => random(g));
  // A Floodline match saved before its third round existed may lack a third hand.
  const short = n * g.players.length - g.reserve.length;
  if (g.id === 'wildgrove' && short > 0)
    g.reserve.push(
      ...shuffled(deck(g.id), () => random(g))
        .slice(0, short)
        .map((card, i) => ({ ...card, id: 1000 + g.round * 100 + i })),
    );
  g.players.forEach((p, i) => {
    p.hand = g.reserve
      .splice(0, n)
      .sort((a, b) => a.kind - b.kind || a.rank - b.rank);
    p.wards = g.id === 'undertow' && g.shields === true ? 2 : 0;
    p.salvageClaims = g.id === 'undertow' && g.salvage ? 1 : 0;
    p.packet = (g.round - 1) * g.players.length + i;
  });
  g.passes = g.players.map(() => []);
  g.passCards = passCount({ players: g.players, fastMode: g.fastMode, duelDeck: g.duelDeck });
  g.voids = g.players.map(() => []);
  g.memory = g.players.map(() => ({}));
  if (g.id === 'undertow') {
    g.seen = [];
    g.trick = [];
    g.lastTrick = [];
    g.hazard = -1;
    g.salvageClaimants = [];
    delete g.trickLeader;
  }
  remember(g);
  g.phase =
    g.id === 'undertow' ? 'pass' : g.id === 'wildgrove' ? 'roll' : 'play';
  g.active = g.phase === 'roll' ? g.roller : (g.firstPlayer ?? 0);
  emit(
    g,
    'deal',
    -1,
    `Round ${g.round}: ${n} ${g.id === 'wildgrove' ? 'creatures' : 'cards'} each.`,
  );
}
export function createGame(
  id: GameId,
  difficulty: Difficulty = 'medium',
  seed = 1,
  tutorial = false,
  playerCount = 3,
  shields = false,
  fastMode = false,
  customerOrders = false,
  sanctuaryGoalsEnabled = false,
  options: GameOptions = {},
): Game {
  if (!Number.isInteger(playerCount) || playerCount < 2 || playerCount > 6)
    throw new Error('Choose 2–6 players');
  const g: Game = {
    version: 4,
    contentSet:
      id === 'undertow' ? 'beginner' : (options.contentSet ?? 'beginner'),
    roamEnabled: id === 'wildgrove' && options.roamEnabled === true,
    migration: id === 'wildgrove' && options.migration === true,
    salvage: id === 'undertow' && options.salvage === true,
    specialtyStalls: id === 'midnight' && options.specialtyStalls === true,
    turningTide: id === 'undertow' && options.turningTide === true,
    marketSeasons: id === 'midnight' && options.marketSeasons === true,
    shields: id === 'undertow' && shields,
    customerOrders: id === 'midnight' && customerOrders,
    sanctuaryGoalsEnabled: id === 'wildgrove' && sanctuaryGoalsEnabled,
    fastMode: id === 'undertow' && fastMode,
    duelDeck: id === 'undertow' && playerCount === 2,
    id,
    difficulty,
    rngState: seed >>> 0,
    reserve: [],
    players: names.slice(0, playerCount).map((name) => ({
      name,
      hand: [],
      zones: Array.from({ length: id === 'wildgrove' ? 7 : 6 }, () => []),
      score: 0,
      wards: 2,
      ...(id === 'wildgrove'
        ? {
            roams: options.roamEnabled ? 1 : 0,
            migrations: options.migration ? 1 : 0,
          }
        : {}),
      ...(id === 'midnight' && options.marketSeasons
        ? { seasonPoints: 0 }
        : {}),
      packet: 0,
      ...(id === 'midnight' && (customerOrders || options.specialtyStalls)
        ? { festival: { orders: [], stalls: [] } }
        : {}),
    })),
    active: 0,
    phase: 'play',
    round: 1,
    pick: 1,
    roller: 0,
    hazard: -1,
    die: 0,
    passes: [],
    trick: [],
    lastTrick: [],
    seen: [],
    voids: [],
    memory: [],
    events: [],
    revision: 0,
    tutorial,
    lesson: 0,
  };
  if (g.marketSeasons)
    g.seasonForecast = [0, 1].flatMap(() =>
      shuffled([0, 1, 2, 3, 4, 5], () => random(g)),
    );
  if (g.customerOrders) {
    const menus = shuffled(
      festivalOrders.map((_, i) => i),
      () => random(g),
    );
    g.festivalOffers = [menus.slice(0, 3), menus.slice(3, 6)];
  }
  if (g.sanctuaryGoalsEnabled)
    g.sanctuaryGoals = shuffled(
      sanctuaryGoals.map((_, i) => i),
      () => random(g),
    ).slice(0, 3);
  if (id !== 'undertow')
    g.reserve = shuffled(deck(id, 1, 10, supplyPerKind(g)), () => random(g));
  g.firstPlayer = Math.floor(random(g) * playerCount);
  g.roller = g.firstPlayer;
  deal(g);
  return g;
}
export function counts(cards: Card[]) {
  return Array.from(
    { length: 6 },
    (_, k) => cards.filter((c) => c.kind === k).length,
  );
}
export function zoneScore(
  zones: Card[][],
  zone: number,
  contentSet: ContentSet = 'beginner',
) {
  const cards = zones[zone] ?? [],
    c = counts(cards),
    unique = c.filter(Boolean).length;
  if (contentSet === 'intermediate') {
    // Pools: every matching pair scores the same.
    if (zone === 0) return c.reduce((sum, n) => sum + Math.floor(n / 2), 0) * 7;
    // Beach: one score per different species.
    if (zone === 1) return unique * 3;
    // Mangroves: three of one species or nothing.
    if (zone === 2) return cards.length === 3 && unique === 1 ? 12 : 0;
    // Pier: filled in order; a full A–B–A–B alternation earns the bonus.
    if (zone === 3)
      return (
        cards.length * 2 +
        (cards.length === 4 &&
        cards[0].kind !== cards[1].kind &&
        cards[2].kind === cards[0].kind &&
        cards[3].kind === cards[1].kind
          ? 6
          : 0)
      );
    // Cave: a creature scores when its species also lives in another habitat.
    if (zone === 4) {
      const elsewhere = counts(zones.filter((_, i) => i !== 4 && i !== 5).flat());
      return cards.filter((card) => elsewhere[card.kind] > 0).length * 3;
    }
    // Lighthouse: a lamp keeper scores only if its species lives nowhere else.
    if (zone === 6) {
      const all = counts(zones.filter((_, i) => i !== 5).flat());
      return cards.filter((card) => all[card.kind] === 1).length * 4;
    }
    return 0;
  }
  if (zone === 0) return [0, 2, 6, 11, 17][Math.max(...c)] ?? 0;
  // Garden: every matching pair scores the same.
  if (zone === 1) return c.reduce((s, n) => s + Math.floor(n / 2), 0) * 8;
  // Hollow: a matching pair or nothing.
  if (zone === 2) return cards.length === 2 && unique === 1 ? 9 : 0;
  // Glasshouse: a creature scores when its species also lives in another habitat.
  if (zone === 3) {
    const elsewhere = counts(zones.filter((_, i) => i !== 3 && i !== 5).flat());
    return cards.filter((card) => elsewhere[card.kind] > 0).length * 3;
  }
  // Channel: any creature, 2 each.
  if (zone === 4) return cards.length * 2;
  if (zone === 6)
    return cards.length
      ? 2 *
          zones.filter(
            (area, i) =>
              i !== 5 &&
              i !== 6 &&
              area.some((creature) => creature.kind === cards[0].kind),
          ).length
      : 0;
  return 0;
}
export function foodBreakdown(
  cards: Card[],
  opponents: Card[][],
  contentSet: ContentSet = 'beginner',
): number[] {
  const c = counts(cards),
    max = Math.max(0, ...opponents.map((p) => counts(p)[4]));
  if (contentSet === 'intermediate')
    return [
      Math.floor(c[0] / 2) * 8 - (c[0] % 2),
      c[1] * 2 +
        (c[1] > 0 && c[1] < Math.min(...opponents.map((p) => counts(p)[1]))
          ? 7
          : 0),
      [0, 6, 10, 6][Math.min(3, c[2])] - Math.max(0, c[2] - 3) * 2,
      Math.min(c[3], c[0] + c[5]) * 5,
      c[4] * 2 + (c.filter(Boolean).length >= 5 ? c[4] * 2 : 0),
      Math.floor(c[5] / 3) * 15,
    ];
  return [
    Math.floor(c[0] / 2) * 7,
    [0, 1, 4, 8, 13, 19][Math.min(5, c[1])] + Math.max(0, c[1] - 5) * 2,
    Math.min(c[2], 2) * 4 + Math.max(0, c[2] - 2),
    c[3] * Math.min(5, 1 + c.filter(Boolean).length),
    c[4] * 2 + (c[4] > max ? 6 : c[4] > 0 && c[4] === max ? 3 : 0),
    Math.floor(c[5] / 3) * 12 + (c[5] % 3),
  ];
}
export function foodScore(
  cards: Card[],
  opponents: Card[][],
  contentSet: ContentSet = 'beginner',
) {
  return foodBreakdown(cards, opponents, contentSet).reduce((a, b) => a + b, 0);
}
/** Orders use only the six dishes drafted during their own round. */
export const festivalOrders = [
  { name: 'Two tickets', needs: [2, 0, 0, 0, 1, 0], points: 7 },
  { name: 'Soundcheck', needs: [0, 2, 1, 0, 0, 0], points: 7 },
  { name: 'Backstage supper', needs: [0, 0, 0, 1, 0, 2], points: 7 },
  { name: 'Last bus', needs: [1, 0, 0, 2, 0, 0], points: 7 },
  { name: 'Split bill', needs: [0, 0, 1, 0, 2, 0], points: 7 },
  { name: 'B-side special', needs: [0, 1, 0, 0, 0, 2], points: 7 },
  { name: 'Opening act', needs: [1, 1, 1, 0, 0, 0], points: 7 },
  { name: 'Flyer run', needs: [1, 1, 0, 1, 0, 0], points: 7 },
  { name: 'Late arrival', needs: [1, 1, 0, 0, 1, 0], points: 7 },
  { name: 'Paper cuts', needs: [1, 1, 0, 0, 0, 1], points: 7 },
  { name: 'Roof session', needs: [1, 0, 1, 1, 0, 0], points: 7 },
  { name: 'Loading dock', needs: [1, 0, 1, 0, 1, 0], points: 7 },
  { name: 'Three encores', needs: [1, 0, 1, 0, 0, 1], points: 7 },
  { name: 'Night courier', needs: [1, 0, 0, 1, 1, 0], points: 7 },
  { name: 'Cassette swap', needs: [1, 0, 0, 1, 0, 1], points: 7 },
  { name: 'Afterparty', needs: [1, 0, 0, 0, 1, 1], points: 7 },
  { name: 'Alley speakers', needs: [0, 1, 1, 1, 0, 0], points: 7 },
  { name: 'Closing set', needs: [0, 1, 1, 0, 1, 0], points: 7 },
  { name: 'Crew meal', needs: [0, 1, 1, 0, 0, 1], points: 7 },
  { name: 'Rooftop supper', needs: [0, 1, 0, 1, 1, 0], points: 7 },
  { name: 'Wired lights', needs: [0, 1, 0, 1, 0, 1], points: 7 },
  { name: 'Afterglow', needs: [0, 1, 0, 0, 1, 1], points: 7 },
  { name: 'Street parade', needs: [0, 0, 1, 1, 1, 0], points: 7 },
  { name: 'Moonrise menu', needs: [0, 0, 1, 1, 0, 1], points: 7 },
  { name: 'Wall of sound', needs: [0, 0, 1, 0, 1, 1], points: 7 },
  { name: 'Closing feast', needs: [0, 0, 0, 1, 1, 1], points: 7 },
];
export function availableOrders(
  round: number,
  g?: Pick<PublicGame, 'festivalOffers'>,
) {
  return (
    g?.festivalOffers?.[round - 1] ?? (round === 1 ? [0, 1, 2] : [3, 4, 5])
  );
}
export function orderProgress(cards: Card[], order: number) {
  const recipe = festivalOrders[order];
  const have = counts(cards);
  return recipe.needs.reduce(
    (sum, need, kind) => sum + Math.min(need, have[kind]),
    0,
  );
}
export function festivalBreakdown(p: Player) {
  const orders = (p.festival?.orders ?? []).map((order, round) => ({
    order,
    progress: orderProgress(p.zones[0].slice(round * 6, round * 6 + 6), order),
    points:
      orderProgress(p.zones[0].slice(round * 6, round * 6 + 6), order) === 3
        ? festivalOrders[order].points
        : 0,
  }));
  const stalls = (p.festival?.stalls ?? []).map((stall) => ({
    ...stall,
    points: Math.min(
      6,
      p.zones[0].slice(stall.from).filter((c) => c.kind === stall.kind).length *
        2,
    ),
  }));
  return {
    orders,
    stalls,
    total: [...orders, ...stalls].reduce((sum, item) => sum + item.points, 0),
  };
}
/** Only sheltered creatures count; duplicates in one habitat do not extend a trail. */
export function wildTrailsBreakdown(zones: Card[][]) {
  const habitatsBySpecies = creatures.map(
    (_, kind) =>
      zones.filter(
        (cards, zone) => zone !== 5 && cards.some((card) => card.kind === kind),
      ).length,
  );
  const trails = habitatsBySpecies.map((count) => (count >= 3 ? 3 : 0));
  const diversity = habitatsBySpecies.every((count) => count > 0) ? 5 : 0;
  return {
    habitatsBySpecies,
    trails,
    diversity,
    total: trails.reduce<number>((sum, points) => sum + points, 0) + diversity,
  };
}
export type SanctuaryGoal = {
  name: string;
  rule: string;
  points: number;
  target: number;
  kind?: number;
  zone?: number;
  /** 'full': the smallest habitat that counts. 'pairs': creatures per species. 'habitats': creatures per habitat. */
  min?: number;
  type:
    | 'full'
    | 'squares'
    | 'rounds'
    | 'herd'
    | 'mirror'
    | 'family'
    | 'diversity'
    | 'habitats'
    | 'pairs'
    | 'variety'
    | 'twins'
    | 'fill'
    | 'trail'
    | 'lookout'
    | 'spread'
    | 'lighthouse';
};
/** Every goal points the same way as the habitat rules it touches, never against them. */
export const sanctuaryGoals: SanctuaryGoal[] = [
  // Goals reward how you build, never which species you happened to draw.
  {
    name: 'Full houses',
    type: 'full',
    min: 3,
    target: 2,
    points: 4,
    rule: 'Fill 2 habitats that have 3 or more spaces.',
  },
  {
    name: 'Square country',
    type: 'squares',
    target: 8,
    points: 3,
    rule: 'Have 8 creatures in Courtyard, Garden and Hollow together.',
  },
  {
    name: 'Round country',
    type: 'rounds',
    target: 5,
    points: 4,
    rule: 'Have 5 creatures in Glasshouse, Channel and Watchpost together.',
  },
  {
    name: 'Mirror terraces',
    type: 'herd',
    target: 4,
    points: 4,
    rule: 'Have 4 creatures of one species in Courtyard and Garden together.',
  },
  {
    name: 'Channel colours',
    type: 'variety',
    zone: 4,
    target: 3,
    points: 3,
    rule: 'Have 3 different species in Channel.',
  },
  {
    name: 'Hollow twins',
    type: 'twins',
    zone: 2,
    target: 1,
    points: 3,
    rule: 'Fill Hollow with a matching pair.',
  },
  {
    name: 'Every species',
    type: 'diversity',
    target: 6,
    points: 4,
    rule: 'Have all 6 species on your board.',
  },
  {
    name: 'Lively sanctuary',
    type: 'habitats',
    target: 6,
    points: 4,
    rule: 'Have at least 1 creature in each of the 6 scoring habitats.',
  },
  {
    name: 'Four families',
    type: 'pairs',
    min: 2,
    target: 4,
    points: 4,
    rule: 'Have at least 2 creatures of each of 4 species.',
  },
  {
    name: 'Rooftop pairs',
    type: 'twins',
    zone: 1,
    target: 2,
    points: 3,
    rule: 'Fill Garden with 2 matching pairs.',
  },
  {
    name: 'Glass walk',
    type: 'fill',
    zone: 3,
    target: 3,
    points: 3,
    rule: 'Fill all 3 spaces of Glasshouse.',
  },
  {
    name: 'Watchpost friends',
    type: 'lookout',
    zone: 6,
    target: 3,
    points: 6,
    rule: 'Have a creature in Watchpost and its species in 3 other habitats.',
  },
];
export function sanctuaryGoalProgress(
  zones: Card[][],
  id: number,
  contentSet: ContentSet = 'beginner',
) {
  const goal = sanctuaryGoalsFor(contentSet)[id];
  const areas = habitatsFor(contentSet);
  const sheltered = zones.filter((_, zone) => zone !== 5);
  const kinds = counts(sheltered.flat());
  const inZone = (zone: number) => counts(zones[zone] ?? []);
  let progress = 0;
  switch (goal.type) {
    case 'full':
      progress = zones.filter(
        (cards, zone) =>
          zone !== 5 && areas[zone].cap >= (goal.min ?? 1) && cards.length >= areas[zone].cap,
      ).length;
      break;
    case 'squares':
      progress = [0, 1, 2].reduce((n, zone) => n + (zones[zone]?.length ?? 0), 0);
      break;
    case 'rounds':
      progress = [3, 4, 6].reduce((n, zone) => n + (zones[zone]?.length ?? 0), 0);
      break;
    case 'herd': {
      // Courtyard's herd and Garden's pairs both want one species in numbers.
      const court = inZone(0), roof = inZone(1);
      progress = Math.max(...court.map((n, kind) => n + roof[kind]));
      break;
    }
    case 'mirror': {
      // Floodline: a species with a pair in Pools that also lives on the Beach.
      const pools = inZone(0), beach = inZone(1);
      progress = pools.filter((n, kind) => n >= 2 && beach[kind] > 0).length;
      break;
    }
    case 'family':
      progress = Math.max(0, ...(goal.zone === undefined ? kinds : inZone(goal.zone)));
      break;
    case 'diversity':
      progress = kinds.filter(Boolean).length;
      break;
    case 'habitats':
      progress = sheltered.filter((cards) => cards.length >= (goal.min ?? 1)).length;
      break;
    case 'pairs':
      progress = kinds.filter((count) => count >= (goal.min ?? 2)).length;
      break;
    case 'variety':
      progress = inZone(goal.zone!).filter(Boolean).length;
      break;
    case 'twins':
      progress = inZone(goal.zone!).reduce((pairs, n) => pairs + Math.floor(n / 2), 0);
      break;
    case 'fill':
      progress = zones[goal.zone!]?.length ?? 0;
      break;
    case 'trail': {
      // The Pier, in placement order: A, then B, then A again, then B again.
      const path = zones[3] ?? [];
      progress = 0;
      for (let i = 0; i < path.length; i++) {
        const fits = i === 0 || (i === 1 ? path[1].kind !== path[0].kind : path[i].kind === path[i - 2].kind);
        if (!fits) break;
        progress = i + 1;
      }
      break;
    }
    case 'lookout': {
      const watcher = zones[6]?.[0];
      progress = watcher
        ? zones.filter(
            (cards, zone) =>
              zone !== 5 && zone !== 6 && cards.some((card) => card.kind === watcher.kind),
          ).length
        : 0;
      break;
    }
    case 'spread':
      progress = Math.max(
        ...creatures.map((_, kind) => sheltered.filter((cards) => cards.some((card) => card.kind === kind)).length),
      );
      break;
    case 'lighthouse':
      progress = (zones[6] ?? []).filter((card) => kinds[card.kind] === 1).length;
      break;
  }
  return {
    progress: Math.min(progress, goal.target),
    complete: progress >= goal.target,
    points: progress >= goal.target ? goal.points : 0,
  };
}
export function sanctuaryBonus(
  zones: Card[][],
  goals?: number[],
  contentSet: ContentSet = 'beginner',
) {
  return goals
    ? goals.reduce(
        (total, id) =>
          total + sanctuaryGoalProgress(zones, id, contentSet).points,
        0,
      )
    : 0;
}
export function scores(
  g: Pick<
    Game,
    | 'id'
    | 'players'
    | 'customerOrders'
    | 'sanctuaryGoalsEnabled'
    | 'sanctuaryGoals'
    | 'contentSet'
    | 'roamEnabled'
    | 'marketSeasons'
    | 'specialtyStalls'
  >,
) {
  return g.players.map((p, i) =>
    g.id === 'undertow'
      ? p.score
      : g.id === 'wildgrove'
        ? p.zones.reduce(
            (s, _, j) => s + zoneScore(p.zones, j, g.contentSet),
            0,
          ) +
          (g.sanctuaryGoalsEnabled
            ? sanctuaryBonus(p.zones, g.sanctuaryGoals, g.contentSet)
            : 0)
        : foodScore(
            p.zones[0],
            g.players.filter((_, j) => i !== j).map((p) => p.zones[0]),
            g.contentSet,
          ) +
          (g.marketSeasons ? (p.seasonPoints ?? 0) : 0) +
          (g.customerOrders || g.specialtyStalls
            ? festivalBreakdown(p).total
            : 0),
  );
}
export function lowTide(g: Pick<Game, 'turningTide' | 'pick'>) {
  return g.turningTide === true && g.pick % 2 === 0;
}
export function penalty(c: Card, hazard: number, rank = 8, value = 40) {
  return c.kind === 4
    ? c.rank
    : c.kind === hazard && c.rank === rank
      ? value
      : 0;
}
export function allowedZone(
  g: Pick<Game, 'players' | 'roller' | 'die' | 'contentSet'>,
  p: number,
  c: Card,
  z: number,
) {
  if (z === 5) return true; // Release has no capacity or die restriction.
  const area = habitatsFor(g.contentSet)[z];
  if (!area || (g.players[p].zones[z]?.length ?? 0) >= area.cap)
    return false;
  if (p === g.roller) return true;
  const region = g.players[p].zones[z] ?? [];
  const die = dice[g.die];
  switch (die.kind) {
    case 'zones':
      return die.zones.includes(z);
    case 'company':
      // Before the first creature is sheltered, Company cannot be met and imposes nothing.
      return (
        region.length > 0 ||
        !g.players[p].zones.some((area, i) => i !== 5 && area.length > 0)
      );
    case 'empty': {
      // The least crowded habitat with room: an empty one while any remain.
      const areas = habitatsFor(g.contentSet);
      const open = g.players[p].zones
        .map((area, i) => (i !== 5 && areas[i] && area.length < areas[i].cap ? area.length : Infinity));
      return region.length === Math.min(...open);
    }
    default:
      return !region.some((x) => x.kind === c.kind);
  }
}
export function simultaneous(g: Pick<PublicGame, 'phase' | 'id'>) {
  return (
    g.phase === 'salvage' ||
    g.phase === 'pass' ||
    (g.phase === 'play' && g.id !== 'undertow')
  );
}
export function decisionKey(g: PublicGame) {
  return `${g.round}:${g.pick}:${g.phase}`;
}
export function readySeats(g: PublicGame): boolean[] {
  return (
    g.ready ??
    g.players.map(
      (_, i) => g.firstPlayer === undefined && simultaneous(g) && i < g.active,
    )
  );
}
export function canAct(g: PublicGame, actor: number) {
  return (
    actor >= 0 &&
    actor < g.players.length &&
    g.phase !== 'over' &&
    (simultaneous(g) ? !readySeats(g)[actor] : actor === g.active)
  );
}
/** Local drafts survive other seats locking, but never survive a new decision/hand. */
export function preparationKey(g: PublicGame, viewer: number) {
  const player = g.players[viewer];
  return `${g.id}:${decisionKey(g)}:${viewer}:${player.packet}:${canAct(g, viewer)}:${player.hand.map((card) => card.id).join(',')}`;
}
export function legalMoves(g: PublicGame): Move[] {
  if (g.phase === 'over') return [];
  if (g.phase === 'roll') return [{ type: 'roll' }];
  if (g.phase === 'pass') return [];
  if (g.phase === 'salvage')
    return canAct(g, g.active)
      ? [
          { type: 'salvage', claim: false },
          { type: 'salvage', claim: true },
        ]
      : [];
  const p = g.players[g.active];
  let hand = p.hand;
  if (g.id === 'undertow') {
    if (g.trick.length) {
      const follow = hand.filter((c) => c.kind === g.trick[0].card.kind);
      if (follow.length) hand = follow;
    }
    const moves = hand.flatMap<Move>((c) => [
      { type: 'play', card: c.id },
      ...(g.shields === true && p.wards
        ? [{ type: 'play' as const, card: c.id, ward: true }]
        : []),
    ]);
    return moves;
  }
  if (g.id === 'midnight') {
    if (!g.customerOrders && !g.specialtyStalls)
      return hand.map((c) => ({ type: 'play', card: c.id }));
    const orders =
      g.customerOrders && p.festival!.orders.length < g.round
        ? availableOrders(g.round, g)
        : [undefined];
    return hand.flatMap((c) =>
      orders.flatMap((order) => {
        const move: Move = {
          type: 'play',
          card: c.id,
          ...(order === undefined ? {} : { order }),
        };
        const canBuild =
          g.specialtyStalls &&
          p.festival!.stalls.length < 2 &&
          !p.festival!.stalls.some((stall) => stall.kind === c.kind);
        return canBuild ? [move, { ...move, stall: true }] : [move];
      }),
    );
  }
  const moves: Move[] = [];
  const caps = habitatsFor(g.contentSet).map((h) => h.cap);
  const variants: {
    zones: Card[][];
    migration?: { card: number; from: number; to: number };
  }[] = [{ zones: p.zones }];
  if (g.migration && (p.migrations ?? 0) > 0) {
    p.zones.forEach((cards, from) => {
      if (from === 5) return;
      for (const resident of cards)
        for (const to of habitatOrder) {
          if (to === 5 || to === from || p.zones[to].length >= caps[to])
            continue;
          const migration = { card: resident.id, from, to };
          variants.push({
            zones: migratedZones(p.zones, migration),
            migration,
          });
        }
    });
  }
  for (const variant of variants) {
    const view = {
      ...g,
      players: g.players.map((player, i) =>
        i === g.active ? { ...player, zones: variant.zones } : player,
      ),
    };
    for (const c of hand)
      for (const z of habitatOrder) {
        const move: Move = {
          type: 'play',
          card: c.id,
          zone: z,
          ...(variant.migration ? { migration: variant.migration } : {}),
        };
        if (allowedZone(view, g.active, c, z)) moves.push(move);
        else if (
          g.roamEnabled &&
          (p.roams ?? 0) > 0 &&
          z !== 5 &&
          variant.zones[z].length < caps[z]
        )
          moves.push({ ...move, roam: true });
      }
  }
  return moves;
}
export function migratedZones(
  zones: Card[][],
  migration: { card: number; from: number; to: number },
): Card[][] {
  const next = zones.map((area) => [...area]);
  const index =
    next[migration.from]?.findIndex((card) => card.id === migration.card) ?? -1;
  if (index >= 0 && next[migration.to])
    next[migration.to].push(next[migration.from].splice(index, 1)[0]);
  return next;
}
function beginTrick(g: Game) {
  g.salvageClaimants = [];
  g.trickLeader = g.active;
  if (!g.salvage || g.players[0].hand.length <= 1) return;
  const eligible = g.players.map(
    (p, i) => i !== g.trickLeader && (p.salvageClaims ?? 0) > 0,
  );
  if (!eligible.some(Boolean)) return;
  g.phase = 'salvage';
  g.ready = eligible.map((value) => !value);
  g.pending = g.players.map(() => null);
  g.active = Array.from(
    { length: g.players.length },
    (_, offset) => ((g.firstPlayer ?? 0) + offset) % g.players.length,
  ).find((i) => eligible[i])!;
}

/** Fast exchanges stay small; normal exchanges use about a quarter of the hand. */
export function passCount(
  g: Pick<PublicGame, 'players' | 'passCards' | 'fastMode'> & {
    passes?: number[][];
    duelDeck?: boolean;
  },
) {
  // Finish an exchange already started by a pre-update save at its original size.
  const started = g.passes?.find((cards) => cards.length)?.length;
  if (g.passCards !== undefined) return g.passCards;
  if (started) return started;
  if (g.fastMode) return g.players.length <= 3 ? 3 : 2;
  const cards = Math.floor((g.duelDeck ? 25 : 50) / g.players.length);
  return Math.max(2, Math.min(4, Math.ceil(cards / 4)));
}
export function validMove(state: PublicGame, m: Move, actor = state.active) {
  if (
    !m ||
    typeof m !== 'object' ||
    !['play', 'roll', 'pass', 'salvage', 'undo'].includes(m.type)
  )
    return false;
  const fields =
    m.type === 'play'
      ? ['type', 'card', 'zone', 'ward', 'order', 'stall', 'roam', 'migration']
      : m.type === 'pass'
        ? ['type', 'cards']
        : m.type === 'salvage'
          ? ['type', 'claim']
          : ['type'];
  if (Object.keys(m).some((key) => !fields.includes(key))) return false;
  if (
    m.type === 'play' &&
    m.migration !== undefined &&
    (!m.migration ||
      !['card', 'from', 'to'].every((key) =>
        Number.isInteger(m.migration![key as keyof typeof m.migration]),
      ))
  )
    return false;
  if (m.type === 'undo') return canUndo(state, actor);
  if (!canAct(state, actor)) return false;
  if (state.phase === 'salvage')
    return (
      m.type === 'salvage' &&
      typeof m.claim === 'boolean' &&
      actor !== state.trickLeader &&
      (state.players[actor].salvageClaims ?? 0) > 0
    );
  const g = { ...state, active: actor };
  if (g.phase === 'pass')
    return (
      m.type === 'pass' &&
      m.cards.length === passCount(g) &&
      new Set(m.cards).size === passCount(g) &&
      m.cards.every((id) => g.players[g.active].hand.some((c) => c.id === id))
    );
  return legalMoves(g).some(
    (x) =>
      JSON.stringify(x) === JSON.stringify(m) ||
      (x.type === 'play' &&
        m.type === 'play' &&
        x.card === m.card &&
        x.zone === m.zone &&
        !!x.ward === !!m.ward &&
        x.order === m.order &&
        !!x.stall === !!m.stall &&
        !!x.roam === !!m.roam &&
        x.migration?.card === m.migration?.card &&
        x.migration?.from === m.migration?.from &&
        x.migration?.to === m.migration?.to),
  );
}
function finishRound(g: Game) {
  if (g.round === totalRounds(g)) {
    g.phase = 'over';
    emit(g, 'finish', -1, 'Final scores');
  } else {
    g.round++;
    g.pick = 1;
    g.roller = ((g.firstPlayer ?? 0) + g.round - 1) % g.players.length;
    deal(g);
  }
}
/** Only a still-secret simultaneous commitment can be withdrawn. */
export function canUndo(state: PublicGame, actor: number) {
  return Number.isInteger(actor) && actor >= 0 && actor < state.players.length &&
    simultaneous(state) && state.ready?.[actor] === true && state.ready.some((ready) => !ready);
}
export function play(state: Game, m: Move, actor = state.active): Game {
  if (!validMove(state, m, actor)) return state;
  if (m.type === 'undo') {
    if (!state.pending?.[actor]) return state;
    const g = structuredClone(state);
    g.pending![actor] = null;
    g.ready![actor] = false;
    g.active = actor;
    g.revision++;
    return g;
  }
  if (!simultaneous(state)) return applyMove(state, m);
  let g = structuredClone(state);
  g.ready = readySeats(g);
  g.pending ??= g.players.map(() => null);
  g.pending[actor] = structuredClone(m);
  g.ready[actor] = true;
  g.revision++;
  if (g.ready.some((ready) => !ready)) {
    g.active = Array.from(
      { length: g.players.length },
      (_, offset) => ((g.firstPlayer ?? 0) + offset) % g.players.length,
    ).find((seat) => !g.ready![seat])!;
    return g;
  }
  if (g.phase === 'salvage') {
    g.salvageClaimants = g.pending.flatMap((move, seat) =>
      move?.type === 'salvage' && move.claim ? [seat] : [],
    );
    for (const seat of g.salvageClaimants) g.players[seat].salvageClaims!--;
    emit(
      g,
      'salvage',
      -1,
      g.salvageClaimants.length
        ? `Salvage: ${g.salvageClaimants.map((i) => g.players[i].name).join(', ')} committed.`
        : 'No salvage claims.',
    );
    delete g.pending;
    delete g.ready;
    g.phase = 'play';
    g.active = g.trickLeader!;
    return g;
  }
  // Reveal and resolve the complete batch only when every seat has locked a choice.
  const pending = g.pending;
  delete g.pending;
  delete g.ready;
  for (let i = 0; i < pending.length; i++) {
    if (!pending[i]) continue; // A legacy saved round may already have resolved early seats.
    g.active = i;
    g = applyMove(g, pending[i]!, false);
  }
  if (g.firstPlayer !== undefined && simultaneous(g)) {
    g.active = g.firstPlayer;
  }
  return g;
}
/** Apply only a drafter's pieces/resources; never reveal or rotate the packet. */
function placeDraftCard(g: PublicGame, p: Player, m: Extract<Move, { type: 'play' }>) {
  if (g.id === 'wildgrove') while (p.zones.length < 7) p.zones.push([]);
  if (m.migration) {
    p.zones = migratedZones(p.zones, m.migration);
    p.migrations!--;
  }
  const card = p.hand.splice(
    p.hand.findIndex((c) => c.id === m.card),
    1,
  )[0];
  if (m.roam) p.roams!--;
  if (
    g.marketSeasons &&
    card.kind === g.seasonForecast?.[(g.round - 1) * 6 + g.pick - 1]
  )
    p.seasonPoints = (p.seasonPoints ?? 0) + 2;
  if (g.id === 'midnight' && (g.customerOrders || g.specialtyStalls)) {
    if (m.order !== undefined) {
      p.festival!.orders.push(m.order);
    }
    if (m.stall) {
      p.festival!.stalls.push({
        kind: card.kind,
        from: p.zones[0].length + 1,
      });
    }
  }
  if (g.id !== 'wildgrove' || m.zone !== 5) p.zones[m.zone ?? 0].push(card);
  return card;
}

/** A private presentation copy. Authoritative state and other seats stay untouched. */
export function previewPlacement<T extends PublicGame>(g: T, viewer: number, move?: Move): T {
  if (g.phase !== 'play' || g.id === 'undertow' || move?.type !== 'play' || !g.players[viewer]) return g;
  const ready = readySeats(g).map((value, seat) => seat === viewer ? false : value);
  if (!validMove({ ...g, ready }, move, viewer)) return g;
  const player = structuredClone(g.players[viewer]);
  placeDraftCard(g, player, move);
  ready[viewer] = true;
  return { ...g, ready, players: g.players.map((p, seat) => seat === viewer ? player : p) };
}

function applyMove(state: Game, m: Move, increment = true): Game {
  if (!validMove(state, m)) return state;
  const g = structuredClone(state),
    n = g.players.length,
    p = g.players[g.active],
    actor = g.active;
  if (g.id === 'wildgrove')
    g.players.forEach((player) => {
      while (player.zones.length < 7) player.zones.push([]);
    });
  if (increment) g.revision++;
  if (m.type === 'pass') {
    g.passes[actor] = m.cards;
    emit(g, 'pass', actor, `${p.name} chose ${passCount(g)} cards to pass.`);
    if (actor < n - 1) g.active++;
    else {
      const gifts = g.players.map((p, i) =>
        p.hand.filter((c) => g.passes[i].includes(c.id)),
      );
      g.players.forEach((p, i) => {
        p.hand = p.hand.filter((c) => !g.passes[i].includes(c.id));
        p.hand.push(...gifts[(i - passingStep(g) + n) % n]);
        p.hand.sort((a, b) => a.kind - b.kind || a.rank - b.rank);
      });
      emit(g, 'pass', -1, 'Cards move to the next seat.');
      g.passes = g.players.map(() => []);
      g.phase = 'roll';
      g.roller = ((g.firstPlayer ?? 0) + g.round - 1) % n;
      g.active = g.roller;
      remember(g);
    }
    return g;
  }
  if (m.type === 'roll') {
    if (g.id === 'undertow') {
      g.hazard = Math.floor(random(g) * 4);
      emit(
        g,
        'roll',
        actor,
        `${suits[g.hazard]} ${tidePenaltyRank(g)} is worth ${tidePenaltyValue(g)} this round.`,
      );
    } else {
      g.die = Math.floor(random(g) * 6);
      emit(
        g,
        'roll',
        actor,
        `${dice[g.die].name}. ${p.name} can use any habitat with space.`,
      );
    }
    g.phase = 'play';
    g.active = g.id === 'undertow' ? g.roller : (g.firstPlayer ?? 0);
    if (g.id === 'undertow') beginTrick(g);
    return g;
  }
  if (m.type !== 'play') return state;
  const card = g.id === 'undertow'
    ? p.hand.splice(p.hand.findIndex((c) => c.id === m.card), 1)[0]
    : placeDraftCard(g, p, m);
  g.seen.push(card);
  emit(
    g,
    'play',
    actor,
    `${p.name}: ${cardName(g.id, card, g.contentSet)}${m.zone !== undefined ? ` → ${habitatsFor(g.contentSet)[m.zone].name}` : ''}${m.ward ? ' + shield' : ''}${m.order !== undefined ? ` · order: ${festivalOrders[m.order].name}` : ''}${m.stall ? ` · opens ${foodsFor(g.contentSet)[card.kind].name} stall` : ''}${m.roam ? ' · Roam' : ''}${m.migration ? ' · Migration' : ''}`,
    card.kind,
  );
  if (g.id === 'undertow') {
    if (m.ward) p.wards--;
    if (
      g.trick.length &&
      card.kind !== g.trick[0].card.kind &&
      !g.voids[actor].includes(g.trick[0].card.kind)
    )
      g.voids[actor].push(g.trick[0].card.kind);
    g.trick.push({ player: actor, card, ward: !!m.ward });
    if (g.trick.length < n) {
      g.active = (actor + tableOrderStep(g) + n) % n;
      return g;
    }
    const win = g.trick
      .filter((t) => t.card.kind === g.trick[0].card.kind)
      .sort((a, b) =>
        lowTide(g) ? a.card.rank - b.card.rank : b.card.rank - a.card.rank,
      )[0];
    let cost = g.trick.reduce(
      (s, t) =>
        s + penalty(t.card, g.hazard, tidePenaltyRank(g), tidePenaltyValue(g)),
      0,
    );
    if (win.ward) cost = Math.ceil(cost / 2);
    const scoreChanges = g.players.map(
      (_, seat) =>
        (seat === win.player ? cost : 0) +
        ((g.salvageClaimants ?? []).includes(seat)
          ? seat === win.player
            ? -6
            : 3
          : 0),
    );
    g.players.forEach((player, seat) => {
      player.score += scoreChanges[seat];
    });
    emit(
      g,
      'trick',
      win.player,
      `${g.players[win.player].name} takes ${cost} penalty points.${(g.salvageClaimants ?? []).length ? ' Salvage: ' + g.salvageClaimants!.map((seat) => `${g.players[seat].name} ${seat === win.player ? '−6' : '+3'}`).join(', ') + '.' : ''}`,
      undefined,
      cost,
    );
    g.active = win.player;
    // Retain the complete reveal even when the final trick immediately deals a new round.
    Object.assign(g.events[g.events.length - 1], {
      trick: g.trick,
      hazard: g.hazard,
      scoreChanges,
      salvageChanges: g.players.map((_, seat) =>
        (g.salvageClaimants ?? []).includes(seat)
          ? seat === win.player
            ? -6
            : 3
          : 0,
      ),
    });
    g.lastTrick = g.trick;
    g.trick = [];
    g.pick++;
    if (!g.players[0].hand.length) finishRound(g);
    else beginTrick(g);
  } else {
    g.active++;
    if (g.active === n) {
      g.active = 0;
      g.pick++;
      if (!g.players[0].hand.length) finishRound(g);
      else {
        const hands = g.players.map((p) => p.hand),
          packets = g.players.map((p) => p.packet);
        g.players.forEach((p, i) => {
          const from = (i + (g.round % 2 ? n - 1 : 1)) % n;
          p.hand = hands[from];
          p.packet = packets[from];
        });
        emit(
          g,
          'pass',
          -1,
          `Packets pass ${g.round % 2 ? 'left' : 'right'} to the next player.`,
        );
        remember(g);
        if (g.id === 'wildgrove') {
          g.roller = (g.roller + 1) % n;
          g.phase = 'roll';
          g.active = g.roller;
        }
      }
    }
  }
  return g;
}
export function observe(g: Game, viewer = g.active): Observation {
  const {
    rngState: _rng,
    reserve,
    memory,
    passes: _passes,
    pending: _pending,
    ...rest
  } = structuredClone(g);
  rest.players.forEach((p, i) => {
    if (i !== viewer)
      p.hand = p.hand.map((_, j) => ({ id: -j - 1, kind: -1, rank: -1 }));
  });
  return {
    ...rest,
    ...(g.pending?.[viewer]?.type === 'play' ? { ownMove: structuredClone(g.pending[viewer]!) } : {}),
    ready: readySeats(g),
    passCards: passCount(g),
    reserveCount: reserve.length,
    knownPackets: g.id === 'undertow' ? {} : memory[viewer],
  };
}
export function isSavedGame(x: unknown): x is Game {
  try {
    if (!x || typeof x !== 'object') return false;
    const g = x as Game;
    if (
      g.version !== 4 ||
      (g.shields !== undefined && typeof g.shields !== 'boolean') ||
      (g.fastMode !== undefined && typeof g.fastMode !== 'boolean') ||
      (g.duelDeck !== undefined && typeof g.duelDeck !== 'boolean') ||
      (g.customerOrders !== undefined &&
        typeof g.customerOrders !== 'boolean') ||
      (g.customerOrders === true && g.id !== 'midnight') ||
      (g.sanctuaryGoalsEnabled !== undefined &&
        typeof g.sanctuaryGoalsEnabled !== 'boolean') ||
      (g.sanctuaryGoalsEnabled === true && g.id !== 'wildgrove') ||
      (g.passCards !== undefined && ![2, 3, 4, 5].includes(g.passCards)) ||
      !catalog.some((c) => c.id === g.id) ||
      !['easy', 'medium', 'hard'].includes(g.difficulty) ||
      !['pass', 'roll', 'play', 'salvage', 'over'].includes(g.phase)
    )
      return false;
    if (
      g.contentSet !== undefined &&
      !['beginner', 'intermediate'].includes(g.contentSet)
    )
      return false;
    if (g.id === 'undertow' && g.contentSet === 'intermediate') return false;
    for (const [key, id] of [
      ['migration', 'wildgrove'],
      ['salvage', 'undertow'],
      ['specialtyStalls', 'midnight'],
      ['roamEnabled', 'wildgrove'],
      ['turningTide', 'undertow'],
      ['marketSeasons', 'midnight'],
    ] as const) {
      if (
        (g[key] !== undefined && typeof g[key] !== 'boolean') ||
        (g[key] && g.id !== id)
      )
        return false;
    }
    if (
      g.marketSeasons &&
      (!Array.isArray(g.seasonForecast) ||
        g.seasonForecast.length !== 12 ||
        !g.seasonForecast.every(
          (k) => Number.isInteger(k) && k >= 0 && k < 6,
        ) ||
        [0, 6].some(
          (start) =>
            new Set(g.seasonForecast!.slice(start, start + 6)).size !== 6,
        ))
    )
      return false;
    if (
      g.id === 'wildgrove' &&
      !g.players.every(
        (p) =>
          Number.isInteger(p.roams) &&
          p.roams! >= 0 &&
          p.roams! <= (g.roamEnabled ? 2 : 0) &&
          Number.isInteger(p.migrations) &&
          p.migrations! >= 0 &&
          p.migrations! <= (g.migration ? 1 : 0),
      )
    )
      return false;
    if (
      g.marketSeasons &&
      !g.players.every(
        (p) =>
          p.seasonPoints ===
          p.zones[0].reduce(
            (sum, card, index) =>
              sum + (card.kind === g.seasonForecast![index] ? 2 : 0),
            0,
          ),
      )
    )
      return false;
    const n = g.players.length;
    if (
      g.salvageClaimants !== undefined &&
      (!Array.isArray(g.salvageClaimants) ||
        new Set(g.salvageClaimants).size !== g.salvageClaimants.length ||
        g.salvageClaimants.some(
          (seat) => !Number.isInteger(seat) || seat < 0 || seat >= n,
        ))
    )
      return false;
    if (
      g.phase === 'salvage' &&
      (!g.salvage ||
        !Number.isInteger(g.trickLeader) ||
        g.trickLeader! < 0 ||
        g.trickLeader! >= n ||
        g.trick.length ||
        g.players[0].hand.length <= 1 ||
        !g.pending ||
        !g.ready ||
        (g.salvageClaimants?.length ?? 0) > 0)
    )
      return false;
    if (
      g.firstPlayer !== undefined &&
      (!Number.isInteger(g.firstPlayer) ||
        g.firstPlayer < 0 ||
        g.firstPlayer >= n)
    )
      return false;
    if (g.sanctuaryGoalsEnabled && !g.sanctuaryGoals) return false;
    if (g.customerOrders && !g.festivalOffers) return false;
    if (
      g.sanctuaryGoals !== undefined &&
      (!g.sanctuaryGoalsEnabled ||
        !Array.isArray(g.sanctuaryGoals) ||
        g.sanctuaryGoals.length !== 3 ||
        new Set(g.sanctuaryGoals).size !== 3 ||
        g.sanctuaryGoals.some(
          (id) => !Number.isInteger(id) || !sanctuaryGoals[id],
        ))
    )
      return false;
    if (
      n < 2 ||
      n > 6 ||
      !Number.isInteger(g.active) ||
      g.active < 0 ||
      g.active >= n ||
      !Number.isInteger(g.round) ||
      g.round < 1 ||
      g.round > totalRounds(g) ||
      !Number.isInteger(g.rngState) ||
      !Number.isInteger(g.revision) ||
      !Number.isInteger(g.lesson) ||
      typeof g.tutorial !== 'boolean' ||
      !Number.isInteger(g.pick) ||
      g.pick < 1 ||
      g.pick > handSize(g) + 1 ||
      !Number.isInteger(g.roller) ||
      g.roller < 0 ||
      g.roller >= n ||
      !Number.isInteger(g.hazard) ||
      g.hazard < -1 ||
      g.hazard > 3 ||
      !Number.isInteger(g.die) ||
      g.die < 0 ||
      g.die > 5
    )
      return false;
    const card = (c: Card) =>
      c &&
      Number.isInteger(c.id) &&
      Number.isInteger(c.kind) &&
      c.kind >= 0 &&
      c.kind < (g.id === 'undertow' ? 5 : 6) &&
      Number.isInteger(c.rank) &&
      c.rank >= (g.id === 'undertow' ? 1 : 0) &&
      c.rank <= (g.id === 'undertow' ? tideRanks(g) : 0);
    if (
      !g.players.every(
        (p) =>
          typeof p.name === 'string' &&
          Number.isFinite(p.score) &&
          Number.isInteger(p.wards) &&
          p.wards >= 0 &&
          p.wards <= 2 &&
          (p.salvageClaims === undefined ||
            (Number.isInteger(p.salvageClaims) &&
              p.salvageClaims >= 0 &&
              p.salvageClaims <= 1)) &&
          Number.isInteger(p.packet) &&
          p.hand.every(card) &&
          p.zones.length === (g.id === 'wildgrove' ? 7 : 6) &&
          p.zones.every(
            (z, i) =>
              z.every(card) &&
              (g.id !== 'wildgrove' || z.length <= habitatsFor(g.contentSet)[i].cap),
          ),
      )
    )
      return false;
    if (g.customerOrders || g.specialtyStalls) {
      if (
        g.festivalOffers !== undefined &&
        (!Array.isArray(g.festivalOffers) ||
          g.festivalOffers.length !== 2 ||
          !g.festivalOffers.every(
            (offer) =>
              Array.isArray(offer) &&
              offer.length === 3 &&
              new Set(offer).size === 3 &&
              offer.every(
                (id) =>
                  Number.isInteger(id) && id >= 0 && id < festivalOrders.length,
              ),
          ))
      )
        return false;
      for (const p of g.players) {
        const f = p.festival;
        if (
          !f ||
          !Array.isArray(f.orders) ||
          !Array.isArray(f.stalls) ||
          f.orders.length !==
            (g.customerOrders ? Math.ceil(p.zones[0].length / 6) : 0) ||
          !f.orders.every((order, round) =>
            availableOrders(round + 1, g).includes(order),
          ) ||
          f.stalls.length > (g.specialtyStalls ? 2 : 0) ||
          new Set(f.stalls.map((stall) => stall.kind)).size !==
            f.stalls.length ||
          !f.stalls.every(
            (stall) =>
              Number.isInteger(stall.kind) &&
              stall.kind >= 0 &&
              stall.kind < 6 &&
              Number.isInteger(stall.from) &&
              stall.from >= 1 &&
              stall.from <= p.zones[0].length &&
              p.zones[0][stall.from - 1].kind === stall.kind,
          )
        )
          return false;
      }
    }
    if (g.pending !== undefined || g.ready !== undefined) {
      if (
        !simultaneous(g) ||
        !Array.isArray(g.pending) ||
        !Array.isArray(g.ready) ||
        g.pending.length !== n ||
        g.ready.length !== n ||
        !g.ready.every((v) => typeof v === 'boolean') ||
        g.ready.every(Boolean) ||
        g.active !==
          Array.from(
            { length: n },
            (_, offset) => ((g.firstPlayer ?? 0) + offset) % n,
          ).find((seat) => !g.ready![seat])
      )
        return false;
      const validation = { ...g, ready: g.players.map(() => false) };
      for (let seat = 0; seat < n; seat++) {
        const move = g.pending[seat];
        if (
          move !== null &&
          (!g.ready[seat] || !validMove(validation, move, seat))
        )
          return false;
        // Null ready entries are allowed for already-resolved seats in legacy saves.
        if (
          move === null &&
          g.ready[seat] &&
          !(
            g.phase === 'salvage' &&
            (seat === g.trickLeader || !g.players[seat].salvageClaims)
          )
        )
          return false;
      }
    }
    const all = [
      ...g.reserve,
      ...g.players.flatMap((p) => [...p.hand, ...p.zones.flat()]),
      ...(g.id === 'undertow' ? g.seen : []),
    ];
    if (!all.every(card) || new Set(all.map((c) => c.id)).size !== all.length)
      return false;
    return (
      g.seen.every(card) &&
      g.voids.length === n &&
      g.voids.every((v) =>
        v.every((k) => Number.isInteger(k) && k >= 0 && k < 5),
      ) &&
      g.passes.length === n &&
      g.passes.every((v) => v.every(Number.isInteger)) &&
      g.memory.length === n &&
      g.memory.every((m) => Object.values(m).every((cs) => cs.every(card))) &&
      g.events.every(
        (e) => Number.isInteger(e.id) && typeof e.text === 'string',
      ) &&
      g.trick.length < n &&
      [...g.trick, ...g.lastTrick].every(
        (t) =>
          card(t.card) &&
          Number.isInteger(t.player) &&
          t.player >= 0 &&
          t.player < n &&
          typeof t.ward === 'boolean',
      )
    );
  } catch {
    return false;
  }
}

/** Content identity is independent of extensions; kind indices are local to a set. */
export const coastalCreatures = [
  'Signal Crab',
  'Lagoon Turtle',
  'Harbour Seal',
  'Reef Octopus',
  'Storm Tern',
  'Kelp Seahorse',
];
export const intermediateFoods = [
  {
    name: 'Bao',
    formula: 'Pair 8 · leftover −1',
    rule: 'Each pair earns 8. A portion without a partner loses 1.',
    example: '3 portions earn 8 − 1 = 7.',
  },
  {
    name: 'Roti',
    formula: '2 each · sole least +7',
    rule: 'Each portion earns 2. Have at least 1 and fewer than every other player for +7.',
    example: '1 portion against 2 and 3 earns 9. Against 0 and 3 it earns 2.',
  },
  {
    name: 'Chilli',
    formula: '6 · 10 · 6 · 4 · 2…',
    rule: '1 portion earns 6, 2 earn 10, 3 earn 6. Each portion after the third takes away 2.',
    example: '4 portions earn 4. 7 earn −2.',
  },
  {
    name: 'Rice',
    formula: 'Bao or Coconut pair: 5',
    rule: 'Each Rice earns 5 if it has its own Bao or Coconut. That dish still scores as usual.',
    example: '3 Rice with 1 Bao and 1 Coconut earn 10.',
  },
  {
    name: 'Corn',
    formula: '2 each · 5 types: 4 each',
    rule: 'Each portion earns 2, or 4 if you have at least 5 dish types.',
    example: '3 portions with 5 dish types earn 12.',
  },
  {
    name: 'Coconut',
    formula: '3 → 15 · leftovers 0',
    rule: 'Each set of 3 earns 15. Leftover portions earn 0.',
    example: '5 portions earn 15. 6 earn 30.',
  },
];
/** Floodline Station: the same pad shapes and die groups, more room and sharper questions over three rounds. */
const coastalRules = [
  [
    'Pools',
    'Each matching pair earns 7. A creature without a partner earns 0.',
    '7 per matching pair',
  ],
  [
    'Beach',
    'Each different species here earns 3. Repeats earn nothing more.',
    '3 per different species',
  ],
  [
    'Mangroves',
    '3 of one species earn 12. Anything else earns 0.',
    'Three of a kind: 12',
  ],
  [
    'Pier',
    'Spaces fill in order. Each creature earns 2. Alternate two species all the way, A–B–A–B, for +6.',
    '2 each · A–B–A–B +6',
  ],
  [
    'Cave',
    'Each creature here earns 3 if its species also lives in another of your habitats.',
    '3 each if its species lives in another habitat',
  ],
  [
    'Release',
    'Let a creature go instead of placing it. It scores 0 and never counts anywhere. Always allowed, whatever the die.',
    '0 points',
  ],
  [
    'Lighthouse',
    'Each creature here earns 4 if its species lives nowhere else on your board, the other lighthouse space included.',
    '4 each if its species lives only here',
  ],
];
const coastalCaps = [5, 5, 3, 4, 4, 12, 2];
export const intermediateHabitats = habitats.map((h, i) => ({
  ...h,
  name: coastalRules[i][0],
  rule: coastalRules[i][1],
  formula: coastalRules[i][2],
  cap: coastalCaps[i],
  maxScore: [14, 15, 12, 14, 12, 0, 8][i],
}));
const coastal = (...zones: number[]) => zones.map((zone) => coastalRules[zone][0]);
const andList = (names: string[]) => `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
/** Same twelve ids as the Observatory goals, so saved matches keep a valid draw. */
export const coastalGoals: SanctuaryGoal[] = [
  { name: 'Full houses', type: 'full', min: 4, target: 2, points: 4, rule: 'Fill 2 habitats that have 4 or more spaces.' },
  { name: 'Square country', type: 'squares', target: 10, points: 4, rule: `Have 10 creatures in ${andList(coastal(0, 1, 2))} together.` },
  { name: 'Round country', type: 'rounds', target: 8, points: 3, rule: `Have 8 creatures in ${andList(coastal(3, 4, 6))} together.` },
  { name: 'Mirror shores', type: 'mirror', target: 2, points: 6, rule: `Have 2 species that each make a pair in ${coastal(0)[0]} and also live on the ${coastal(1)[0]}.` },
  { name: 'Mangrove trio', type: 'family', zone: 2, target: 3, points: 3, rule: `Fill ${coastal(2)[0]} with 3 of one species.` },
  { name: 'Big family', type: 'family', target: 6, points: 4, rule: 'Have 6 creatures of one species on your board.' },
  { name: 'Five families', type: 'pairs', min: 2, target: 5, points: 4, rule: 'Have at least 2 creatures of each of 5 species.' },
  { name: 'Crowded coast', type: 'habitats', min: 3, target: 4, points: 5, rule: 'Have at least 3 creatures in each of 4 scoring habitats.' },
  { name: 'Twin lights', type: 'lighthouse', target: 2, points: 3, rule: `Fill the ${coastal(6)[0]} with 2 species that live nowhere else on your board.` },
  { name: 'Beach parade', type: 'variety', zone: 1, target: 5, points: 5, rule: `Fill the ${coastal(1)[0]} with 5 different species.` },
  { name: 'Pier pattern', type: 'trail', zone: 3, target: 4, points: 4, rule: `Fill the ${coastal(3)[0]} with two species taking turns: A–B–A–B.` },
  { name: 'Tideline', type: 'spread', target: 4, points: 3, rule: 'Have one species in 4 different habitats.' },
];
export const creaturesFor = (set?: ContentSet) =>
  set === 'intermediate' ? coastalCreatures : creatures;
export const foodsFor = (set?: ContentSet) =>
  set === 'intermediate' ? intermediateFoods : foods;
export const habitatsFor = (set?: ContentSet) =>
  set === 'intermediate' ? intermediateHabitats : habitats;
const orList = (names: string[]) => `${names.slice(0, -1).join(', ')} or ${names.at(-1)}`;
/** Name the actual destinations; habitat labels no longer carry die-group glyphs. */
export function placementDieRule(face: number, set?: ContentSet) {
  const die = dice[face];
  return die.kind === 'zones'
    ? `Place in ${orList(die.zones.map((zone) => habitatsFor(set)[zone].name))}.`
    : die.rule;
}
export function tokenImage(kind: number, food = false, set?: ContentSet) {
  // Yata's dishes follow the toon cover style since 25 September 2026 (v3).
  const version = food ? 3 : 2;
  return `/art/optimized/${food ? (set === 'intermediate' ? 'yata-counter-alley' : 'yata-counter-lane') : set === 'intermediate' ? 'mora-paper-coast' : 'mora-paper-inland'}-${kind}-v${version}.webp`;
}
export function sanctuaryGoalsFor(set?: ContentSet) {
  return set === 'intermediate' ? coastalGoals : sanctuaryGoals;
}
