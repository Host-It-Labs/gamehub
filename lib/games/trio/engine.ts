/** Platform-independent base rules. Content/scoring live here so expansions can compose them later. */
export type GameId = 'undertow' | 'wildgrove' | 'midnight';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type Card = { id: number; kind: number; rank: number };
export type Move =
  | {
      type: 'play';
      card: number;
      zone?: number;
      ward?: boolean;
      tack?: boolean;
      order?: number;
      stall?: boolean;
    }
  | { type: 'pass'; cards: number[] }
  | { type: 'roll' };
export type Event = {
  id: number;
  type: 'deal' | 'pass' | 'roll' | 'play' | 'trick' | 'finish';
  player: number;
  text: string;
  kind?: number;
  points?: number;
  trick?: Game['trick'];
  hazard?: number;
};
export type Player = {
  name: string;
  hand: Card[];
  zones: Card[][];
  score: number;
  wards: number;
  tacks?: number;
  packet: number;
  festival?: { orders: number[]; stalls: { kind: number; from: number }[] };
};
export type Game = {
  version: 3;
  starter?: boolean;
  nightMarket?: boolean;
  festivalOffers?: number[][];
  fastMode?: boolean;
  id: GameId;
  difficulty: Difficulty;
  rngState: number;
  reserve: Card[];
  players: Player[];
  active: number;
  phase: 'pass' | 'roll' | 'play' | 'over';
  round: number;
  pick: number;
  roller: number;
  hazard: number;
  die: number;
  passes: number[][];
  passCards?: number;
  pending?: (Move | null)[];
  ready?: boolean[];
  trick: { player: number; card: Card; ward: boolean; tack?: boolean }[];
  lastTrick: { player: number; card: Card; ward: boolean; tack?: boolean }[];
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
  reserveCount: number;
  knownPackets: Record<number, Card[]>;
};
export const names = ['You', 'Miso', 'Clover', 'Nova', 'Atlas', 'Pip'];
export const suits = ['♠', '♥', '♣', '♦', 'ϟ'];
export const suitNames = ['Spades', 'Hearts', 'Clubs', 'Diamonds', 'Storm'];
export const creatures = [
  'Mossling',
  'Cloudwing',
  'Emberfox',
  'Pebbleback',
  'Moonhare',
  'Dewfin',
];
export const foods = [
  {
    name: 'Moon bun',
    formula: '2 → 7',
    rule: 'Each pair of buns earns 7 points. A bun left without a partner earns 0.',
    example: 'Five buns = two pairs = 14 points.',
  },
  {
    name: 'Berry fizz',
    formula: '1 · 4 · 8 · 13 · 19',
    rule: 'Your total is 1, 4, 8, 13 or 19 points for one, two, three, four or five fizz. Each fizz after the fifth adds 2 points.',
    example: 'Four fizz earn 13. Six earn 21.',
  },
  {
    name: 'Cloud cake',
    formula: '4 + 4 + 1…',
    rule: 'Your first two cakes earn 4 points each. Each additional cake earns 1 point.',
    example: 'Four cakes earn 4 + 4 + 1 + 1 = 10.',
  },
  {
    name: 'Dumpling',
    formula: '1 + variety · max 5',
    rule: 'Each dumpling earns 1 plus your number of different dish types, up to 5 points per dumpling.',
    example: 'Two dumplings with three dish types earn 2 × 4 = 8.',
  },
  {
    name: 'Lantern tea',
    formula: '2 each · most +6',
    rule: 'Each tea earns 2 points. The player with the most tea earns 6 bonus points. If players tie for the most, each earns 3 bonus points. You need at least one tea to earn a bonus.',
    example:
      'Three tea earn 6 points, plus 6 if you have more tea than every other player: 12 points.',
  },
  {
    name: 'Star skewer',
    formula: '3 → 12 · extra 1',
    rule: 'Each group of three skewers earns 12 points. Leftover skewers earn 1 point each.',
    example: 'Five skewers earn 12 + 2 = 14.',
  },
];
export const habitats = [
  {
    name: 'Herd',
    cap: 4,
    formula: 'Largest same-species group: 1 → 2 pts; 2 → 6 pts; 3 → 11 pts; 4 → 17 pts',
    rule: 'Only your largest group of matching creatures scores. One earns 2 points, two earn 6, three earn 11, and four earn 17. Other species here add no points.',
  },
  {
    name: 'Variety',
    cap: 4,
    formula: '+3 points per different species; +2 bonus for all 4',
    rule: 'Each different species earns 3 points. Repeated species add nothing. Four different species earn 2 bonus points, for 14 points in total.',
  },
  {
    name: 'Pairs',
    cap: 2,
    formula: 'Matching pair: 8 points; a single: 1 point',
    rule: 'The two root hollows hold one creature each. Two matching creatures earn 8 points. A single creature earns 1 point; two different creatures earn 2 points.',
  },
  {
    name: 'Trail',
    cap: 3,
    formula: '2 per creature + 3 per different neighbour',
    rule: 'Fill the numbered spaces in order. Each creature earns 2 points. Each neighbouring pair of spaces earns 3 extra points if their species differ. A–B–A and A–B–C both earn 12 points; A–A–A earns 6.',
  },
  {
    name: 'Shared',
    cap: 3,
    formula: '+4 points per different species also found in another area',
    rule: 'Each different species earns 4 points if it also lives in another scoring area. Repeats here add nothing. Species found only here and trashed creatures never count.',
  },
  {
    name: 'Trash',
    cap: 12,
    formula: 'Trash creature · 0 points',
    rule: 'Remove a creature from your hand instead of placing it. It earns no points, never counts in any area, and uses your turn. Always available, regardless of the die.',
  },
  {
    name: 'Lookout',
    cap: 1,
    formula: '2 points per other habitat with this species',
    rule: 'Your lookout creature earns 2 points for each other scoring habitat containing its own species, up to 10 points. Several matches in one habitat still count only once. For example, a Mossling watching Mosslings in Herd and Trail earns 4 points. The Lookout itself and trash do not count.',
  },
];
export const habitatOrder = [0, 1, 2, 3, 4, 6, 5];
export const dice = [
  {
    name: 'Top row',
    symbol: '↑',
    zones: [0, 1, 2],
    rule: 'Place in any of the three habitats in the top row.',
  },
  {
    name: 'Bottom row',
    symbol: '↓',
    zones: [3, 4, 6],
    rule: 'Place in any of the three habitats in the bottom row.',
  },
  {
    name: 'Left two columns',
    symbol: '←',
    zones: [0, 1, 3, 4],
    rule: 'Place in either of the two leftmost columns.',
  },
  {
    name: 'Right two columns',
    symbol: '→',
    zones: [1, 2, 4, 6],
    rule: 'Place in either of the two rightmost columns.',
  },
  {
    name: 'Empty',
    symbol: '○',
    zones: [],
    rule: 'Place in a habitat that has no creatures yet.',
  },
  {
    name: 'New species',
    symbol: '✦',
    zones: [],
    rule: 'Place in a habitat that does not already contain this species.',
  },
];
export const catalog = [
  {
    id: 'undertow' as GameId,
    name: 'Tide',
    genre: 'Trick taking',
    color: '#38baca',
    cover: '/art/tide-cover-v8.webp',
  },
  {
    id: 'wildgrove' as GameId,
    name: 'Mora',
    genre: 'Draft & place',
    color: '#75b965',
    cover: '/art/mora-cover-v8.webp',
  },
  {
    id: 'midnight' as GameId,
    name: 'Yatai',
    genre: 'Set collection',
    color: '#df84bb',
    cover: '/art/yatai-cover-v6.webp',
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
  return g.fastMode === undefined ? 12 : g.fastMode ? 5 : 10;
}
export function tidePenaltyRank(g: Pick<Game, 'fastMode'>) {
  return g.fastMode === undefined ? 9 : g.fastMode ? 4 : 8;
}
export function tidePenaltyValue(g: Pick<Game, 'fastMode'>) {
  return g.fastMode === true ? 8 : 40;
}
export function deck(id: GameId, round = 1, ranks = 10): Card[] {
  return Array.from({ length: id === 'undertow' ? 5 * ranks : 72 }, (_, i) => ({
    id: (id === 'undertow' ? round * 100 : 0) + i,
    kind: id === 'undertow' ? Math.floor(i / ranks) : i % 6,
    rank: id === 'undertow' ? (i % ranks) + 1 : 0,
  }));
}
export function totalRounds(g: Pick<Game, 'id' | 'players'>) {
  return g.id === 'undertow' ? g.players.length : 2;
}
export function handSize(g: Pick<Game, 'id' | 'players' | 'fastMode'>) {
  return g.id === 'undertow'
    ? Math.floor((5 * tideRanks(g)) / g.players.length)
    : 6;
}
export function cardName(id: GameId, c: Card) {
  return id === 'undertow'
    ? `${suitNames[c.kind]} ${c.rank}`
    : id === 'wildgrove'
      ? creatures[c.kind]
      : foods[c.kind].name;
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
    g.reserve = shuffled(deck(g.id, g.round, tideRanks(g)), () => random(g));
  g.players.forEach((p, i) => {
    p.hand = g.reserve
      .splice(0, n)
      .sort((a, b) => a.kind - b.kind || a.rank - b.rank);
    p.wards = g.id === 'undertow' && g.starter !== false ? 2 : 0;
    p.tacks = g.id === 'undertow' && g.starter === true ? 1 : 0;
    p.packet = (g.round - 1) * g.players.length + i;
  });
  g.passes = g.players.map(() => []);
  g.passCards = passCount({ players: g.players, fastMode: g.fastMode });
  g.voids = g.players.map(() => []);
  g.memory = g.players.map(() => ({}));
  if (g.id === 'undertow') {
    g.seen = [];
    g.trick = [];
    g.lastTrick = [];
    g.hazard = -1;
  }
  remember(g);
  g.phase =
    g.id === 'undertow' ? 'pass' : g.id === 'wildgrove' ? 'roll' : 'play';
  g.active = g.phase === 'roll' ? g.roller : 0;
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
  starter = false,
  fastMode = false,
  nightMarket = false,
): Game {
  if (!Number.isInteger(playerCount) || playerCount < 2 || playerCount > 6)
    throw new Error('Choose 2–6 players');
  const g: Game = {
    version: 3,
    starter: id === 'undertow' && starter,
    nightMarket: id === 'midnight' && nightMarket,
    fastMode: id === 'undertow' && fastMode,
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
      packet: 0,
      ...(id === 'midnight' && nightMarket ? { festival: { orders: [], stalls: [] } } : {}),
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
  if (g.nightMarket) {
    const menus = shuffled(festivalOrders.map((_, i) => i), () => random(g));
    g.festivalOffers = [menus.slice(0, 3), menus.slice(3, 6)];
  }
  if (id !== 'undertow') g.reserve = shuffled(deck(id), () => random(g));
  deal(g);
  return g;
}
export function counts(cards: Card[]) {
  return Array.from(
    { length: 6 },
    (_, k) => cards.filter((c) => c.kind === k).length,
  );
}
export function zoneScore(zones: Card[][], zone: number) {
  const cards = zones[zone] ?? [],
    c = counts(cards),
    unique = c.filter(Boolean).length;
  if (zone === 0) return [0, 2, 6, 11, 17][Math.max(...c)] ?? 0;
  if (zone === 1) return unique * 3 + (unique === 4 ? 2 : 0);
  if (zone === 2)
    return c.reduce((s, n) => s + (n === 2 ? 8 : n === 1 ? 1 : 0), 0);
  const elsewhere = (kind: number) => zones.some(
    (area, i) => i !== zone && i !== 5 && area.some((card) => card.kind === kind),
  );
  if (zone === 3) return cards.length * 2 + cards.slice(1).reduce((sum, card, i) => sum + (card.kind !== cards[i].kind ? 3 : 0), 0);
  if (zone === 4) return c.filter((n, kind) => n > 0 && elsewhere(kind)).length * 4;
  if (zone === 6) return cards.length ? 2 * zones.filter((area, i) => i !== 5 && i !== 6 && area.some((creature) => creature.kind === cards[0].kind)).length : 0;
  return 0;
}
export function foodBreakdown(cards: Card[], opponents: Card[][]): number[] {
  const c = counts(cards),
    max = Math.max(0, ...opponents.map((p) => counts(p)[4]));
  return [
    Math.floor(c[0] / 2) * 7,
    [0, 1, 4, 8, 13, 19][Math.min(5, c[1])] + Math.max(0, c[1] - 5) * 2,
    Math.min(c[2], 2) * 4 + Math.max(0, c[2] - 2),
    c[3] * Math.min(5, 1 + c.filter(Boolean).length),
    c[4] * 2 + (c[4] > max ? 6 : c[4] > 0 && c[4] === max ? 3 : 0),
    Math.floor(c[5] / 3) * 12 + (c[5] % 3),
  ];
}
export function foodScore(cards: Card[], opponents: Card[][]) {
  return foodBreakdown(cards, opponents).reduce((a, b) => a + b, 0);
}
/** Orders use only the six dishes drafted during their own round. */
export const festivalOrders = [
  { name: 'Tea for two', needs: [2, 0, 0, 0, 1, 0], points: 7 },
  { name: 'Sweet escape', needs: [0, 2, 1, 0, 0, 0], points: 7 },
  { name: 'Street feast', needs: [0, 0, 0, 1, 0, 2], points: 7 },
  { name: 'Midnight picnic', needs: [1, 0, 0, 2, 0, 0], points: 7 },
  { name: 'Lantern date', needs: [0, 0, 1, 0, 2, 0], points: 7 },
  { name: 'Festival flight', needs: [0, 1, 0, 0, 0, 2], points: 7 },
  { name: 'Moonlit sampler', needs: [1, 1, 1, 0, 0, 0], points: 7 },
  { name: 'Market stroll', needs: [1, 1, 0, 1, 0, 0], points: 7 },
  { name: 'Evening treats', needs: [1, 1, 0, 0, 1, 0], points: 7 },
  { name: 'Paper lanterns', needs: [1, 1, 0, 0, 0, 1], points: 7 },
  { name: 'Festival garden', needs: [1, 0, 1, 1, 0, 0], points: 7 },
  { name: 'Riverside bites', needs: [1, 0, 1, 0, 1, 0], points: 7 },
  { name: 'Starlight trio', needs: [1, 0, 1, 0, 0, 1], points: 7 },
  { name: 'Night owl', needs: [1, 0, 0, 1, 1, 0], points: 7 },
  { name: 'Golden hour', needs: [1, 0, 0, 1, 0, 1], points: 7 },
  { name: 'Firefly picnic', needs: [1, 0, 0, 0, 1, 1], points: 7 },
  { name: 'Lantern lane', needs: [0, 1, 1, 1, 0, 0], points: 7 },
  { name: 'Twilight tasting', needs: [0, 1, 1, 0, 1, 0], points: 7 },
  { name: 'Festival friends', needs: [0, 1, 1, 0, 0, 1], points: 7 },
  { name: 'Rooftop supper', needs: [0, 1, 0, 1, 1, 0], points: 7 },
  { name: 'Summer lights', needs: [0, 1, 0, 1, 0, 1], points: 7 },
  { name: 'Afterglow', needs: [0, 1, 0, 0, 1, 1], points: 7 },
  { name: 'Night parade', needs: [0, 0, 1, 1, 1, 0], points: 7 },
  { name: 'Moonrise menu', needs: [0, 0, 1, 1, 0, 1], points: 7 },
  { name: 'Street delights', needs: [0, 0, 1, 0, 1, 1], points: 7 },
  { name: 'Closing feast', needs: [0, 0, 0, 1, 1, 1], points: 7 },
];
export function availableOrders(round: number, g?: Pick<PublicGame, 'festivalOffers'>) {
  return g?.festivalOffers?.[round - 1] ?? (round === 1 ? [0, 1, 2] : [3, 4, 5]);
}
export function orderProgress(cards: Card[], order: number) {
  const recipe = festivalOrders[order];
  const have = counts(cards);
  return recipe.needs.reduce((sum, need, kind) => sum + Math.min(need, have[kind]), 0);
}
export function festivalBreakdown(p: Player) {
  const orders = (p.festival?.orders ?? []).map((order, round) => ({
    order,
    progress: orderProgress(p.zones[0].slice(round * 6, round * 6 + 6), order),
    points: orderProgress(p.zones[0].slice(round * 6, round * 6 + 6), order) === 3
      ? festivalOrders[order].points : 0,
  }));
  const stalls = (p.festival?.stalls ?? []).map((stall) => ({
    ...stall,
    points: Math.min(6, p.zones[0].slice(stall.from).filter((c) => c.kind === stall.kind).length * 2),
  }));
  return { orders, stalls, total: [...orders, ...stalls].reduce((sum, item) => sum + item.points, 0) };
}
export function scores(g: Pick<Game, 'id' | 'players' | 'nightMarket'>) {
  return g.players.map((p, i) =>
    g.id === 'undertow'
      ? p.score
      : g.id === 'wildgrove'
        ? p.zones.reduce((s, _, j) => s + zoneScore(p.zones, j), 0)
        : foodScore(
            p.zones[0],
            g.players.filter((_, j) => i !== j).map((p) => p.zones[0]),
          ) + (g.nightMarket ? festivalBreakdown(p).total : 0),
  );
}
export function penalty(c: Card, hazard: number, rank = 8, value = 40) {
  return c.kind === 4
    ? c.rank
    : c.kind === hazard && c.rank === rank
      ? value
      : 0;
}
export function allowedZone(
  g: Pick<Game, 'players' | 'roller' | 'die'>,
  p: number,
  c: Card,
  z: number,
) {
  if (z === 5) return true; // Release has no capacity or die restriction.
  if (!habitats[z] || (g.players[p].zones[z]?.length ?? 0) >= habitats[z].cap)
    return false;
  if (p === g.roller) return true;
  const region = g.players[p].zones[z] ?? [];
  return g.die < 4
    ? dice[g.die].zones.includes(z)
    : g.die === 4
      ? !region.length
      : !region.some((x) => x.kind === c.kind);
}
export function simultaneous(g: Pick<PublicGame, 'phase' | 'id'>) {
  return g.phase === 'pass' || (g.phase === 'play' && g.id !== 'undertow');
}
export function decisionKey(g: PublicGame) {
  return `${g.round}:${g.pick}:${g.phase}`;
}
export function readySeats(g: PublicGame): boolean[] {
  return g.ready ?? g.players.map((_, i) => simultaneous(g) && i < g.active);
}
export function canAct(g: PublicGame, actor: number) {
  return (
    actor >= 0 &&
    actor < g.players.length &&
    g.phase !== 'over' &&
    (simultaneous(g) ? !readySeats(g)[actor] : actor === g.active)
  );
}
export function legalMoves(g: PublicGame): Move[] {
  if (g.phase === 'over') return [];
  if (g.phase === 'roll') return [{ type: 'roll' }];
  if (g.phase === 'pass') return [];
  const p = g.players[g.active];
  let hand = p.hand;
  if (g.id === 'undertow') {
    if (g.trick.length) {
      const follow = hand.filter((c) => c.kind === g.trick[0].card.kind);
      if (follow.length) hand = follow;
    }
    const moves = hand.flatMap<Move>((c) => [
      { type: 'play', card: c.id },
      ...(g.starter !== false && p.wards
        ? [{ type: 'play' as const, card: c.id, ward: true }]
        : []),
    ]);
    // Tack only spends a token when it actually breaks the follow-suit rule.
    if (g.starter && p.tacks && hand.length < p.hand.length)
      moves.push(...p.hand.filter((c) => !hand.includes(c)).map((c) => ({
        type: 'play' as const, card: c.id, tack: true,
      })));
    return moves;
  }
  if (g.id === 'midnight') {
    if (!g.nightMarket) return hand.map((c) => ({ type: 'play', card: c.id }));
    const orders = p.festival!.orders.length < g.round ? availableOrders(g.round, g) : [undefined];
    return hand.flatMap((c) => orders.flatMap((order) => {
      const move: Move = { type: 'play', card: c.id, ...(order === undefined ? {} : { order }) };
      const canBuild = p.festival!.stalls.length < 2 &&
        !p.festival!.stalls.some((stall) => stall.kind === c.kind);
      return canBuild ? [move, { ...move, stall: true }] : [move];
    }));
  }
  const moves = hand.flatMap((c) =>
    habitats.flatMap((_, z) =>
      allowedZone(g, g.active, c, z)
        ? [{ type: 'play' as const, card: c.id, zone: z }]
        : [],
    ),
  );
  return moves;
}
/** Papayoo: 3–4 seats pass 5, 5 seats pass 4, 6 seats pass 3.
 * Nami extends the five-card exchange to its two-player variant.
 * https://www.gigamic.com/index.php?controller=attachment&id_attachment=77
 */
export function passCount(
  g: Pick<PublicGame, 'players' | 'passCards' | 'fastMode'> & {
    passes?: number[][];
  },
) {
  // Finish an exchange already started by a pre-update save at its original size.
  const started = g.passes?.find((cards) => cards.length)?.length;
  if (g.passCards !== undefined) return g.passCards;
  if (started) return started;
  // Fast Tide has only 5 ranks per suit, so a three-card exchange keeps the
  // opening pass meaningful without consuming most of a hand.
  if (g.fastMode === true) return 3;
  return g.players.length <= 4 ? 5 : g.players.length === 5 ? 4 : 3;
}
export function validMove(state: PublicGame, m: Move, actor = state.active) {
  if (!canAct(state, actor)) return false;
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
        !!x.tack === !!m.tack &&
        x.order === m.order &&
        !!x.stall === !!m.stall),
  );
}
function finishRound(g: Game) {
  if (g.round === totalRounds(g)) {
    g.phase = 'over';
    emit(g, 'finish', -1, 'Final scores');
  } else {
    g.round++;
    g.pick = 1;
    g.roller = (g.round - 1) % g.players.length;
    deal(g);
  }
}
export function play(state: Game, m: Move, actor = state.active): Game {
  if (!validMove(state, m, actor)) return state;
  if (!simultaneous(state)) return applyMove(state, m);
  let g = structuredClone(state);
  g.ready = readySeats(g);
  g.pending ??= g.players.map(() => null);
  g.pending[actor] = structuredClone(m);
  g.ready[actor] = true;
  g.revision++;
  if (g.ready.some((ready) => !ready)) {
    g.active = g.ready.findIndex((ready) => !ready);
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
  return g;
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
        p.hand.push(...gifts[(i + (g.round % 2 ? n - 1 : 1)) % n]);
        p.hand.sort((a, b) => a.kind - b.kind || a.rank - b.rank);
      });
      emit(g, 'pass', -1, 'Cards move to the next seat.');
      g.passes = g.players.map(() => []);
      g.phase = 'roll';
      g.roller = (g.round - 1) % n;
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
    g.active = g.id === 'undertow' ? g.roller : 0;
    return g;
  }
  const card = p.hand.splice(
    p.hand.findIndex((c) => c.id === m.card),
    1,
  )[0];
  g.seen.push(card);
  emit(
    g,
    'play',
    actor,
    `${p.name}: ${cardName(g.id, card)}${m.zone !== undefined ? ` → ${habitats[m.zone].name}` : ''}${m.ward ? ' + shield' : ''}${m.tack ? ' + Tack' : ''}${m.order !== undefined ? ` · order: ${festivalOrders[m.order].name}` : ''}${m.stall ? ` · opens ${foods[card.kind].name} stall` : ''}`,
    card.kind,
  );
  if (g.id === 'undertow') {
    if (m.ward) p.wards--;
    if (m.tack) p.tacks = (p.tacks ?? 0) - 1;
    if (
      !m.tack &&
      g.trick.length &&
      card.kind !== g.trick[0].card.kind &&
      !g.voids[actor].includes(g.trick[0].card.kind)
    )
      g.voids[actor].push(g.trick[0].card.kind);
    g.trick.push({ player: actor, card, ward: !!m.ward, tack: !!m.tack });
    if (g.trick.length < n) {
      g.active = (actor + 1) % n;
      return g;
    }
    const win = g.trick
      .filter((t) => t.card.kind === g.trick[0].card.kind)
      .sort((a, b) => b.card.rank - a.card.rank)[0];
    let cost = g.trick.reduce(
      (s, t) =>
        s + penalty(t.card, g.hazard, tidePenaltyRank(g), tidePenaltyValue(g)),
      0,
    );
    if (win.ward) cost = Math.ceil(cost / 2);
    g.players[win.player].score += cost;
    emit(
      g,
      'trick',
      win.player,
      `${g.players[win.player].name} takes ${cost} penalty points.`,
      undefined,
      cost,
    );
    g.active = win.player;
    // Retain the complete reveal even when the final trick immediately deals a new round.
    Object.assign(g.events[g.events.length - 1], {
      trick: g.trick,
      hazard: g.hazard,
    });
    g.lastTrick = g.trick;
    g.trick = [];
    g.pick++;
    if (!g.players[0].hand.length) finishRound(g);
  } else {
    if (g.id === 'midnight' && g.nightMarket) {
      if (m.order !== undefined) {
        p.festival!.orders.push(m.order);
      }
      if (m.stall) {
        p.festival!.stalls.push({ kind: card.kind, from: p.zones[0].length + 1 });
      }
    }
    if (g.id !== 'wildgrove' || m.zone !== 5) p.zones[m.zone ?? 0].push(card);
    g.active++;
    if (g.active === n) {
      g.active = 0;
      g.pick++;
      if (!g.players[0].hand.length) finishRound(g);
      else {
        const hands = g.players.map((p) => p.hand),
          packets = g.players.map((p) => p.packet);
        g.players.forEach((p, i) => {
          const from = (i + (g.round === 1 ? n - 1 : 1)) % n;
          p.hand = hands[from];
          p.packet = packets[from];
        });
        emit(
          g,
          'pass',
          -1,
          `Packets pass ${g.round === 1 ? 'left' : 'right'} to the next player.`,
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
      g.version !== 3 ||
      (g.starter !== undefined && typeof g.starter !== 'boolean') ||
      (g.fastMode !== undefined && typeof g.fastMode !== 'boolean') ||
      (g.nightMarket !== undefined && typeof g.nightMarket !== 'boolean') ||
      (g.nightMarket === true && g.id !== 'midnight') ||
      (g.passCards !== undefined && ![3, 4, 5].includes(g.passCards)) ||
      !catalog.some((c) => c.id === g.id) ||
      !['easy', 'medium', 'hard'].includes(g.difficulty) ||
      !['pass', 'roll', 'play', 'over'].includes(g.phase)
    )
      return false;
    const n = g.players.length;
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
          (p.tacks === undefined ||
            (Number.isInteger(p.tacks) && p.tacks >= 0 && p.tacks <= 1)) &&
          Number.isInteger(p.packet) &&
          p.hand.every(card) &&
          (p.zones.length === 6 ||
            (g.id === 'wildgrove' && p.zones.length === 7)) &&
          p.zones.every(
            (z, i) =>
              z.every(card) &&
              // Older maps allowed larger habitats. Preserve those saved creatures;
              // allowedZone enforces the sanctuary limits for every new placement.
              (g.id !== 'wildgrove' || z.length <= [4, 4, 4, 3, 4, 12, 3][i]),
          ),
      )
    )
      return false;
    if (g.nightMarket) {
      if (g.festivalOffers !== undefined && (!Array.isArray(g.festivalOffers) || g.festivalOffers.length !== 2 ||
          !g.festivalOffers.every((offer) => Array.isArray(offer) && offer.length === 3 && new Set(offer).size === 3 &&
            offer.every((id) => Number.isInteger(id) && id >= 0 && id < festivalOrders.length)))) return false;
      for (const p of g.players) {
        const f = p.festival;
        if (!f || !Array.isArray(f.orders) || !Array.isArray(f.stalls) ||
            f.orders.length !== Math.ceil(p.zones[0].length / 6) ||
            !f.orders.every((order, round) => availableOrders(round + 1, g).includes(order)) ||
            f.stalls.length > 2 || new Set(f.stalls.map((stall) => stall.kind)).size !== f.stalls.length ||
            !f.stalls.every((stall) => Number.isInteger(stall.kind) && stall.kind >= 0 && stall.kind < 6 &&
              Number.isInteger(stall.from) && stall.from >= 1 && stall.from <= p.zones[0].length &&
              p.zones[0][stall.from - 1].kind === stall.kind)) return false;
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
        g.active !== g.ready.findIndex((v) => !v)
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
        if (move === null && g.ready[seat] && seat > g.active) return false;
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
