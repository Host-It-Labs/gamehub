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
      calm?: boolean;
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
};
export type Player = {
  name: string;
  hand: Card[];
  zones: Card[][];
  score: number;
  wards: number;
  calms?: number;
  packet: number;
};
export type Game = {
  version: 3;
  starter?: boolean;
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
  trick: { player: number; card: Card; ward: boolean; calm?: boolean }[];
  lastTrick: { player: number; card: Card; ward: boolean; calm?: boolean }[];
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
  'rngState' | 'reserve' | 'memory' | 'passes'
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
    rule: 'Each pair earns 7. An unmatched bun earns 0.',
    example: 'Five buns = two pairs = 14 points.',
  },
  {
    name: 'Berry fizz',
    formula: '1 · 4 · 8 · 13 · 19',
    rule: 'One through five fizz earn 1, 4, 8, 13, 19. Each extra adds 2.',
    example: 'Four fizz earn 13. Six earn 21.',
  },
  {
    name: 'Cloud cake',
    formula: '4 + 4 + 1…',
    rule: 'Your first two cakes earn 4 each. Every extra earns 1.',
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
    rule: 'Each tea earns 2. Sole tea leader earns 6 extra. Tied leaders with tea each earn 3 extra.',
    example: 'Three tea and sole lead earn 6 + 6 = 12.',
  },
  {
    name: 'Star skewer',
    formula: '3 → 12 · extra 1',
    rule: 'Each trio earns 12. Leftover skewers earn 1 each.',
    example: 'Five skewers earn 12 + 2 = 14.',
  },
];
export const habitats = [
  {
    name: 'Harmony Hollow',
    cap: 4,
    formula: 'Same species: 1 / 3 / 6 / 10',
    rule: 'Only your largest group of one species scores: 1 creature earns 1, two earn 3, three earn 6, four earn 10. Other species here add nothing.',
  },
  {
    name: 'Rainbow Ridge',
    cap: 4,
    formula: '3 per species · four +4',
    rule: '3 per different species plus 4 when four different species live here.',
  },
  {
    name: 'Moonlit Pairs',
    cap: 4,
    formula: 'pair 7 · single 1',
    rule: '7 per species appearing exactly twice. Singletons earn 1. Three or four of one species earn 0.',
  },
  {
    name: 'Lookout',
    cap: 3,
    formula: 'exclusive species ×5',
    rule: '5 per creature whose species appears nowhere else on your board.',
  },
  {
    name: 'Odd Garden',
    cap: 4,
    formula: '4 per odd-count species',
    rule: 'Each species with an odd number of creatures here earns 4. Even counts earn nothing. A second fox removes its 4 points; a third restores them.',
  },
  {
    name: 'Riverbank',
    cap: 12,
    formula: '1 point per creature',
    rule: 'An open overflow area: each creature earns 1 point. Always available, whatever the die shows.',
  },
  {
    name: 'Quiet Glade',
    cap: 3,
    formula: 'One creature alone = 8',
    rule: 'Exactly one creature earns 8 points. Two or three creatures earn nothing.',
  },
];
export const habitatOrder = [0, 1, 2, 3, 4, 6, 5];
export const dice = [
  {
    name: 'Top row',
    symbol: '↑',
    zones: [0, 1, 2],
    rule: 'Place in any of the three regions in the top row.',
  },
  {
    name: 'Bottom row',
    symbol: '↓',
    zones: [3, 4, 6],
    rule: 'Place in any of the three regions in the bottom row.',
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
    rule: 'A region with no creatures yet.',
  },
  {
    name: 'New species',
    symbol: '✦',
    zones: [],
    rule: 'A region without the species you are placing.',
  },
];
export const catalog = [
  {
    id: 'undertow' as GameId,
    name: 'Tide',
    genre: 'Trick taking',
    color: '#38baca',
    cover: '/art/tide-cover-v6.png',
  },
  {
    id: 'wildgrove' as GameId,
    name: 'Grove',
    genre: 'Draft & place',
    color: '#75b965',
    cover: '/art/grove-cover-v6.png',
  },
  {
    id: 'midnight' as GameId,
    name: 'Yatai',
    genre: 'Set collection',
    color: '#df84bb',
    cover: '/art/yatai-cover-v6.png',
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
export function deck(id: GameId, round = 1): Card[] {
  return Array.from({ length: id === 'undertow' ? 60 : 72 }, (_, i) => ({
    id: (id === 'undertow' ? round * 100 : 0) + i,
    kind: id === 'undertow' ? Math.floor(i / 12) : i % 6,
    rank: id === 'undertow' ? (i % 12) + 1 : 0,
  }));
}
export function totalRounds(g: Pick<Game, 'id' | 'players'>) {
  return g.id === 'undertow' ? g.players.length : 2;
}
export function handSize(g: Pick<Game, 'id' | 'players'>) {
  return g.id === 'undertow' ? 60 / g.players.length : 6;
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
    g.reserve = shuffled(deck(g.id, g.round), () => random(g));
  g.players.forEach((p, i) => {
    p.hand = g.reserve
      .splice(0, n)
      .sort((a, b) => a.kind - b.kind || a.rank - b.rank);
    p.wards = g.id === 'undertow' && g.starter !== false ? 2 : 0;
    p.calms = g.id === 'undertow' && g.starter === true ? 1 : 0;
    p.packet = (g.round - 1) * g.players.length + i;
  });
  g.passes = g.players.map(() => []);
  g.passCards = passCount({ players: g.players });
  g.voids = g.players.map(() => []);
  g.memory = g.players.map(() => ({}));
  if (g.id === 'undertow') g.seen = [];
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
): Game {
  if (!Number.isInteger(playerCount) || playerCount < 2 || playerCount > 6)
    throw new Error('Choose 2–6 players');
  const g: Game = {
    version: 3,
    starter: id === 'undertow' && starter,
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
  if (zone === 0) return [0, 1, 3, 6, 10][Math.max(...c)];
  if (zone === 1) return unique * 3 + (unique === 4 ? 4 : 0);
  if (zone === 2)
    return c.reduce((s, n) => s + (n === 2 ? 7 : n === 1 ? 1 : 0), 0);
  if (zone === 3)
    return (
      cards.filter(
        (c) =>
          !zones.some((z, i) => i !== 3 && z.some((x) => x.kind === c.kind)),
      ).length * 5
    );
  if (zone === 4) return c.filter((n) => n % 2 === 1).length * 4;
  if (zone === 6) return cards.length === 1 ? 8 : 0;
  return cards.length;
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
export function scores(g: Pick<Game, 'id' | 'players'>) {
  return g.players.map((p, i) =>
    g.id === 'undertow'
      ? p.score
      : g.id === 'wildgrove'
        ? p.zones.reduce((s, _, j) => s + zoneScore(p.zones, j), 0)
        : foodScore(
            p.zones[0],
            g.players.filter((_, j) => i !== j).map((p) => p.zones[0]),
          ),
  );
}
export function penalty(c: Card, hazard: number) {
  return c.kind === 4 ? c.rank : c.kind === hazard && c.rank === 9 ? 40 : 0;
}
export function allowedZone(
  g: Pick<Game, 'players' | 'roller' | 'die'>,
  p: number,
  c: Card,
  z: number,
) {
  if (!habitats[z] || (g.players[p].zones[z]?.length ?? 0) >= habitats[z].cap)
    return false;
  if (z === 5) return true;
  if (p === g.roller) return true;
  const region = g.players[p].zones[z] ?? [];
  return g.die < 4
    ? dice[g.die].zones.includes(z)
    : g.die === 4
      ? !region.length
      : !region.some((x) => x.kind === c.kind);
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
    return hand.flatMap<Move>((c) => [
      { type: 'play', card: c.id },
      ...(g.starter !== false && p.wards
        ? [{ type: 'play' as const, card: c.id, ward: true }]
        : []),
      ...(g.starter && p.calms
        ? [{ type: 'play' as const, card: c.id, calm: true }]
        : []),
      ...(g.starter && p.calms && p.wards
        ? [{ type: 'play' as const, card: c.id, ward: true, calm: true }]
        : []),
    ]);
  }
  if (g.id === 'midnight')
    return hand.map((c) => ({ type: 'play', card: c.id }));
  const moves = hand.flatMap((c) =>
    habitats.flatMap((_, z) =>
      allowedZone(g, g.active, c, z)
        ? [{ type: 'play' as const, card: c.id, zone: z }]
        : [],
    ),
  );
  return moves.length
    ? moves
    : hand
        .filter(() => p.zones[5].length < 12)
        .map((c) => ({ type: 'play', card: c.id, zone: 5 }));
}
/** Papayoo: 3–4 seats pass 5, 5 seats pass 4, 6 seats pass 3.
 * Nami extends the five-card exchange to its two-player variant.
 * https://www.gigamic.com/index.php?controller=attachment&id_attachment=77
 */
export function passCount(
  g: Pick<PublicGame, 'players' | 'passCards'> & { passes?: number[][] },
) {
  // Finish an exchange already started by a pre-update save at its original size.
  const started = g.passes?.find((cards) => cards.length)?.length;
  if (g.passCards !== undefined) return g.passCards;
  if (started) return started;
  return g.players.length <= 4 ? 5 : g.players.length === 5 ? 4 : 3;
}
export function validMove(g: PublicGame, m: Move) {
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
        !!x.calm === !!m.calm),
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
export function play(state: Game, m: Move): Game {
  if (!validMove(state, m)) return state;
  const g = structuredClone(state),
    n = g.players.length,
    p = g.players[g.active],
    actor = g.active;
  if (g.id === 'wildgrove')
    g.players.forEach((player) => {
      while (player.zones.length < 7) player.zones.push([]);
    });
  g.revision++;
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
      emit(g, 'roll', actor, `${suits[g.hazard]} 9 is worth 40 this round.`);
    } else {
      g.die = Math.floor(random(g) * 6);
      emit(g, 'roll', actor, `${dice[g.die].name}. ${p.name} is exempt.`);
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
    `${p.name}: ${cardName(g.id, card)}${m.zone !== undefined ? ` → ${habitats[m.zone].name}` : ''}${m.ward ? ' + shield' : ''}${m.calm ? ' + Calm' : ''}`,
    card.kind,
  );
  if (g.id === 'undertow') {
    if (m.ward) p.wards--;
    if (m.calm) p.calms = (p.calms ?? 0) - 1;
    if (
      g.trick.length &&
      card.kind !== g.trick[0].card.kind &&
      !g.voids[actor].includes(g.trick[0].card.kind)
    )
      g.voids[actor].push(g.trick[0].card.kind);
    g.trick.push({ player: actor, card, ward: !!m.ward, calm: !!m.calm });
    if (g.trick.length < n) {
      g.active = (actor + 1) % n;
      return g;
    }
    const win = g.trick
      .filter((t) => t.card.kind === g.trick[0].card.kind)
      .sort((a, b) => b.card.rank - a.card.rank)[0];
    let cost = g.trick.reduce((s, t) => s + penalty(t.card, g.hazard), 0);
    if (win.calm)
      cost -= Math.max(
        0,
        ...g.trick.filter((t) => t.card.kind === 4).map((t) => t.card.rank),
      );
    if (win.ward) cost = Math.ceil(cost / 2);
    g.players[win.player].score += cost;
    emit(
      g,
      'trick',
      win.player,
      `${g.players[win.player].name} takes ${cost} marks.`,
      undefined,
      cost,
    );
    g.active = win.player;
    g.lastTrick = g.trick;
    g.trick = [];
    g.pick++;
    if (!g.players[0].hand.length) finishRound(g);
  } else {
    p.zones[m.zone ?? 0].push(card);
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
    ...rest
  } = structuredClone(g);
  rest.players.forEach((p, i) => {
    if (i !== viewer)
      p.hand = p.hand.map((_, j) => ({ id: -j - 1, kind: -1, rank: -1 }));
  });
  return {
    ...rest,
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
      c.rank <= (g.id === 'undertow' ? 12 : 0);
    if (
      !g.players.every(
        (p) =>
          typeof p.name === 'string' &&
          Number.isFinite(p.score) &&
          Number.isInteger(p.wards) &&
          p.wards >= 0 &&
          p.wards <= 2 &&
          (p.calms === undefined ||
            (Number.isInteger(p.calms) && p.calms >= 0 && p.calms <= 1)) &&
          Number.isInteger(p.packet) &&
          p.hand.every(card) &&
          (p.zones.length === 6 ||
            (g.id === 'wildgrove' && p.zones.length === 7)) &&
          p.zones.every(
            (z, i) =>
              z.every(card) &&
              (g.id !== 'wildgrove' || z.length <= habitats[i].cap),
          ),
      )
    )
      return false;
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
