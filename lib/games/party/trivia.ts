import type { SabiPart } from './tribu.ts';
import { maxRounds, openVote, sets, type RoundChoice } from './vote.ts';
import { roll } from '../standalone/types.ts';
import { places } from './geography.ts';
import { country, thing } from './size.ts';
import { yearEvents } from './year-events.ts';
import { orderSets } from './order-sets.ts';

export type TriviaMode = 'quick' | 'tower' | 'expedition';
export type TriviaRoute = 'trail' | 'river' | 'summit';
export type TriviaPurchase = 'trophy' | 'supplies';
export type TriviaPlan = {
  /** Null routes and purchases are retained for older Expedition saves. */
  route: TriviaRoute | null;
  purchase: TriviaPurchase | null;
};
export type TriviaMove =
  | ({ type: 'trivia-plan' } & TriviaPlan)
  | { type: 'trivia-unlock' }
  /** Rules 3 Expedition: take one find from the camp's offer, in turn. */
  | { type: 'trivia-pick'; find: number }
  /** The host takes the suggested find for a picker who is away. */
  | { type: 'trivia-pick-for' };
/** Rules 3 Expedition's finds: four kinds, one big find in every offer. */
export type TriviaFindKind = 'crystal' | 'fossil' | 'gold' | 'fern';
export type TriviaFind = { kind: TriviaFindKind; size: 1 | 2 };
/** One camp's draft, public: who picks in which order, the offer, and the
 * offer index each picker took, in order. The find nobody takes is lost. */
export type TriviaDraft = {
  order: number[];
  offer: TriviaFind[];
  picks: number[];
};
export type TriviaPlayer = {
  floors: number;
  victories: number;
  coins: number;
  distance: number;
  trophies: number;
  supplies: number;
  /** Rules 3 Expedition only: every find taken, in pick order. */
  finds?: TriviaFind[];
};
export type TriviaRound = {
  kind: (typeof sets.miro)[number];
  scores: number[];
  winners: number[];
  routes: (TriviaRoute | null)[];
  purchases: (TriviaPurchase | null)[];
  /** Rules 3 Tower: the blocks each seat earned by its placement. */
  blocks?: number[];
  /** Rules 3 Expedition: the camp's draft after this round. */
  draft?: TriviaDraft;
};
export type TriviaContent = {
  miro: number[];
  size: string[];
  year: number[];
  order: number[];
};
export type TriviaState = {
  /** Rules 3 (10 October 2026): Tower builds by placement, Expedition is a
   * draft, and fixed matches last 4 or 8 rounds with 4 more on request.
   * Rules 2 plays each game once and awards Expedition checkpoints.
   * Absent on older five/eight-round matches with a camp shop. */
  rules?: 2 | 3;
  /** Rules 3: the rounds this match plays; grows by 4 when the host asks
   * for more. Quick Play keeps the party limit. */
  length?: number;
  mode: TriviaMode;
  /** Camp uses the existing vote phase: players lock one private route,
   * then the host picks a game. The last camp needs only the host's Finish. */
  stage: 'challenge' | 'camp';
  completed: number;
  /** Explicit accounting makes repeated games and save reloads idempotent. */
  accountedRound: number;
  basePoints: number[];
  players: TriviaPlayer[];
  plans: (TriviaPlan | null)[];
  ready: boolean[];
  activeRoutes: (TriviaRoute | null)[];
  activePurchases: (TriviaPurchase | null)[];
  finalPurchases: (TriviaPurchase | null)[];
  roundScores: number[];
  roundWinners: number[];
  /** Completed, public results; also an auditable inventory ledger. */
  rounds: TriviaRound[];
  /** Only dealt content is remembered. Observation clears this internal
   * history alongside the mini-games' decks and random state. */
  content: TriviaContent;
};

export const triviaModes: {
  id: TriviaMode;
  name: string;
  rounds: number | null;
  duration: string;
}[] = [
  { id: 'quick', name: 'Quick Play', rounds: null, duration: '5 min+' },
  {
    id: 'tower',
    name: 'Tower',
    rounds: sets.miro.length,
    duration: '15–25 min',
  },
  {
    id: 'expedition',
    name: 'Expedition',
    rounds: sets.miro.length,
    duration: '15–25 min',
  },
];
export const triviaRoutes: {
  id: TriviaRoute;
  name: string;
  threshold: number;
  distance: number;
  missDistance: number;
}[] = [
  {
    id: 'trail',
    name: 'Trail',
    threshold: 0,
    distance: 1,
    missDistance: 1,
  },
  {
    id: 'river',
    name: 'River',
    threshold: 150,
    distance: 2,
    missDistance: 1,
  },
  {
    id: 'summit',
    name: 'Summit',
    threshold: 240,
    distance: 3,
    missDistance: 0,
  },
];
/** Only for presenting and replaying Expedition saves made with the shop. */
export const legacyTriviaRoutes = triviaRoutes.map((r, i) => ({
  ...r,
  coins: [3, 6, 10][i],
  missCoins: [3, 1, 0][i],
}));
export const triviaCosts = { trophy: 8, supplies: 6, maxSupplies: 3 } as const;
export const triviaTower = { pointsPerFloor: 100, victoryFloors: 2 } as const;
export const triviaExpedition = {
  checkpointSteps: 3,
  maxSteps: sets.miro.length * Math.max(...triviaRoutes.map((r) => r.distance)),
} as const;
export const triviaMaxRoundPoints = 300;
/** Rules 3 lengths: 4 or 8 rounds at setup, 4 more at a time after, never
 * past the party round limit. Every block of four plays each game once. */
export const triviaLengths = [4, 8] as const;
export type TriviaLength = (typeof triviaLengths)[number];
export const triviaBlock = sets.miro.length;
export const triviaMaxLength = maxRounds;
export function isTriviaLength(value: unknown): value is TriviaLength {
  return value === 4 || value === 8;
}
export const triviaFinds: {
  id: TriviaFindKind;
  name: string;
}[] = [
  { id: 'crystal', name: 'Crystal' },
  { id: 'fossil', name: 'Fossil' },
  { id: 'gold', name: 'Gold' },
  { id: 'fern', name: 'Fern' },
];
const findKinds = triviaFinds.map((f) => f.id);
const stateKeys = [
  'mode',
  'stage',
  'completed',
  'accountedRound',
  'basePoints',
  'players',
  'plans',
  'ready',
  'activeRoutes',
  'activePurchases',
  'finalPurchases',
  'roundScores',
  'roundWinners',
  'rounds',
  'content',
] as const;
const rules2Keys = [...stateKeys, 'rules'] as const;
const currentStateKeys = [...stateKeys, 'rules', 'length'] as const;

type TriviaGame = {
  kind: string;
  tribu?: { trivia?: TriviaState; carry: number[]; mode: string; votes?: true };
  seats: string[];
  scores: number[];
  round: number;
  phase: string;
  over: boolean;
  mode: string;
  teams: number[];
  vote?: {
    endsAt: number | null;
    host?: true;
    opening?: true;
    options?: unknown[];
    choices: unknown[];
  } | null;
};
export function isTriviaMode(value: unknown): value is TriviaMode {
  return value === 'quick' || value === 'tower' || value === 'expedition';
}
export const validTriviaMode = isTriviaMode;
export function triviaOf(g: { tribu?: { trivia?: TriviaState } }) {
  return g.tribu?.trivia;
}
/** Metadata is absent on compatible saves made before the three modes. */
export function triviaModeOf(g: {
  tribu?: { trivia?: TriviaState };
}): TriviaMode {
  return triviaOf(g)?.mode ?? 'quick';
}
export function triviaRoundLimit(mode: TriviaMode) {
  return triviaModes.find((m) => m.id === mode)!.rounds ?? maxRounds;
}
/** Preserve the length agreed at the start of an older saved match. */
export function triviaGameRoundLimit(g: { tribu?: { trivia?: TriviaState } }) {
  const t = triviaOf(g);
  if (t && t.rules === undefined && t.mode !== 'quick')
    return t.mode === 'tower' ? 5 : 8;
  if (t?.rules === 3 && t.mode !== 'quick')
    return t.length ?? triviaRoundLimit(t.mode);
  return triviaRoundLimit(t?.mode ?? 'quick');
}
/** Where the current block of four rounds starts (rules 3), counted in
 * completed rounds. */
const blockStart = (completed: number) =>
  Math.floor(completed / triviaBlock) * triviaBlock;
/** Fixed matches play one whole round of every mini-game, in the host's
 * order; rules 3 plays each once in every block of four rounds. */
export function remainingTriviaGames(g: { tribu?: { trivia?: TriviaState } }) {
  const t = triviaOf(g);
  const played =
    !t || t.mode === 'quick' || t.rules === undefined
      ? []
      : t.rules === 3
        ? t.rounds.slice(blockStart(t.completed))
        : t.rounds;
  return sets.miro.filter((kind) => !played.some((r) => r.kind === kind));
}
export function isTriviaCamp(g: {
  tribu?: { trivia?: TriviaState };
  over: boolean;
}) {
  return !g.over && triviaOf(g)?.stage === 'camp';
}
export function finalTriviaCamp(g: { tribu?: { trivia?: TriviaState } }) {
  const t = triviaOf(g);
  return t?.mode === 'expedition' && t.completed === triviaGameRoundLimit(g);
}
export function campReady(g: { tribu?: { trivia?: TriviaState } }) {
  const t = triviaOf(g);
  if (t?.rules === 3)
    return (
      t.stage === 'camp' && !!t.rounds.at(-1)?.draft && draftPicker(g) === null
    );
  return (
    !!t &&
    t.stage === 'camp' &&
    ((t.rules === 2 && finalTriviaCamp(g)) || t.ready.every(Boolean))
  );
}
/** Rules 3: the draft of the camp the table is in, or null. */
export function currentDraft(g: { tribu?: { trivia?: TriviaState } }) {
  const t = triviaOf(g);
  return t?.rules === 3 && t.stage === 'camp'
    ? (t.rounds.at(-1)?.draft ?? null)
    : null;
}
/** Rules 3: the seat whose pick the camp waits on, or null once everyone
 * has picked. */
export function draftPicker(g: {
  tribu?: { trivia?: TriviaState };
}): number | null {
  const d = currentDraft(g);
  return d && d.picks.length < d.order.length ? d.order[d.picks.length] : null;
}
/** Who a Trivia camp waits on: each unlocked route (rules 2 and older), or
 * the one player whose turn it is to pick (rules 3). */
export function triviaCampSeats(g: {
  tribu?: { trivia?: TriviaState };
  seats: string[];
}) {
  const t = triviaOf(g);
  if (!t || t.stage !== 'camp' || campReady(g)) return [];
  if (t.rules === 3) {
    const s = draftPicker(g);
    return s === null ? [] : [s];
  }
  return g.seats.flatMap((_, s) => (t.ready[s] ? [] : [s]));
}
/** Rules 3 Tower: a round's blocks by placement. First place earns one
 * block per player, each place below one fewer; tied players share the
 * higher place, and the places below carry on counting (4, 4, 2, 1). */
export function placementBlocks(scores: number[]) {
  return scores.map(
    (score) => scores.length - scores.filter((other) => other > score).length,
  );
}
/** 1, 3, 6, 10…: a kind with n finds scores 1 + 2 + … + n. */
export const triangle = (n: number) => (n * (n + 1)) / 2;
/** How many of each kind a collection holds; a big find counts twice. */
export function findCounts(finds: readonly TriviaFind[] = []) {
  return findKinds.map((kind) =>
    finds.reduce((sum, f) => sum + (f.kind === kind ? f.size : 0), 0),
  );
}
export function collectionScore(finds: readonly TriviaFind[] = []) {
  return findCounts(finds).reduce((sum, n) => sum + triangle(n), 0);
}
/** What a find would add to a collection. */
export function findGain(finds: readonly TriviaFind[], find: TriviaFind) {
  return collectionScore([...finds, find]) - collectionScore(finds);
}
/** Rules 3 Expedition: the round's best score picks first. A tie picks in
 * order of who is behind on the expedition, then fewer total points, then
 * seat order, starting one seat later every round. */
export function draftOrder(
  scores: number[],
  collections: number[],
  points: number[],
  round: number,
) {
  const n = scores.length,
    turn = (s: number) => (s - (round % n) + n) % n;
  return scores
    .map((_, s) => s)
    .sort(
      (a, b) =>
        scores[b] - scores[a] ||
        collections[a] - collections[b] ||
        points[a] - points[b] ||
        turn(a) - turn(b),
    );
}
/** One find more than players, one of them big, kinds at random. */
function dealOffer(g: { rngState: number }, n: number): TriviaFind[] {
  const offer = Array.from({ length: n + 1 }, () => ({
    kind: findKinds[Math.floor(roll(g) * findKinds.length)],
    size: 1 as 1 | 2,
  }));
  offer[Math.floor(roll(g) * offer.length)].size = 2;
  return offer;
}
/** Rules 3: after the last round, the host may ask for four more, up to the
 * party round limit; Expedition's last draft must be finished first. */
export function canExtendTrivia(g: {
  tribu?: { trivia?: TriviaState };
  over: boolean;
}) {
  const t = triviaOf(g);
  return (
    !!t &&
    t.rules === 3 &&
    t.mode !== 'quick' &&
    !g.over &&
    triviaComplete(g) &&
    (t.length ?? 0) + triviaBlock <= triviaMaxLength
  );
}
/** What the host may pick after a fixed match's round. */
function fixedOptions(g: {
  tribu?: { trivia?: TriviaState };
  over: boolean;
}): RoundChoice[] {
  const t = triviaOf(g)!;
  if (!triviaComplete(g))
    return t.rules === undefined ? [...sets.miro] : remainingTriviaGames(g);
  return t.rules === 3 && canExtendTrivia(g) ? ['more', 'finish'] : ['finish'];
}
/** The host's 4 more: the same towers or collections carry on for another
 * block of four rounds, opening the pick of the next game. */
export function extendTrivia<G extends TriviaGame>(g: G): G {
  if (
    !canExtendTrivia(g) ||
    g.phase !== 'vote' ||
    !g.vote ||
    g.vote.opening ||
    (triviaOf(g)!.mode === 'expedition' && !campReady(g))
  )
    return g;
  const n = structuredClone(g) as G & { revision: number },
    t = triviaOf(n)!;
  n.revision++;
  t.length = t.length! + triviaBlock;
  n.vote = openVote(n.seats.length, 0, false, remainingTriviaGames(n), false, true);
  return n;
}
export function isTriviaExtension(g: TriviaGame, move: unknown) {
  return (
    !!move &&
    typeof move === 'object' &&
    (move as { type?: unknown }).type === 'vote' &&
    (move as { choice?: unknown }).choice === 'more' &&
    canExtendTrivia(g)
  );
}
export function triviaComplete(g: { tribu?: { trivia?: TriviaState } }) {
  const t = triviaOf(g);
  return !!t && t.mode !== 'quick' && t.completed === triviaGameRoundLimit(g);
}
const emptyPlayer = (): TriviaPlayer => ({
  floors: 0,
  victories: 0,
  coins: 0,
  distance: 0,
  trophies: 0,
  supplies: 0,
});
export function createTriviaState(
  n: number,
  mode: TriviaMode = 'quick',
  length: TriviaLength = 4,
): TriviaState {
  if (!isTriviaMode(mode)) throw new Error('Choose a Trivia mode.');
  if (!isTriviaLength(length)) throw new Error('Choose 4 or 8 rounds.');
  return {
    rules: 3,
    length: mode === 'quick' ? triviaMaxLength : length,
    mode,
    stage: 'challenge',
    completed: 0,
    accountedRound: 0,
    basePoints: Array(n).fill(0),
    players: Array.from({ length: n }, () => emptyCurrentPlayer(mode)),
    plans: Array(n).fill(null),
    ready: Array(n).fill(false),
    activeRoutes: Array(n).fill(null),
    activePurchases: Array(n).fill(null),
    finalPurchases: Array(n).fill(null),
    roundScores: Array(n).fill(0),
    roundWinners: [],
    rounds: [],
    content: { miro: [], size: [], year: [], order: [] },
  };
}
const emptyCurrentPlayer = (mode: TriviaMode): TriviaPlayer =>
  mode === 'expedition' ? { ...emptyPlayer(), finds: [] } : emptyPlayer();
function rawPoints(g: TriviaGame): number[] {
  const carry = g.tribu?.carry ?? g.seats.map(() => 0);
  return g.seats.map(
    (_, s) => carry[s] + g.scores[g.mode === 'teams' ? g.teams[s] : s],
  );
}
function roundWinners(scores: number[]) {
  const best = Math.max(...scores);
  return scores.flatMap((score, s) => (score === best ? [s] : []));
}
export function triviaReward(route: TriviaRoute, points: number) {
  const r = triviaRoutes.find((r) => r.id === route)!;
  const success = points >= r.threshold;
  return {
    distance: success ? r.distance : r.missDistance,
    success,
  };
}
function legacyTriviaReward(
  route: TriviaRoute,
  points: number,
  supplies: number,
) {
  const r = legacyTriviaRoutes.find((r) => r.id === route)!;
  return {
    ...triviaReward(route, points),
    coins: (points >= r.threshold ? r.coins : r.missCoins) + supplies,
  };
}
function buy(player: TriviaPlayer, purchase: TriviaPurchase | null) {
  if (purchase === null) return;
  player.coins -= triviaCosts[purchase];
  if (purchase === 'trophy') player.trophies++;
  else player.supplies++;
}
function affordable(
  player: TriviaPlayer,
  purchase: unknown,
): purchase is TriviaPurchase | null {
  return (
    purchase === null ||
    (purchase === 'trophy' && player.coins >= triviaCosts.trophy) ||
    (purchase === 'supplies' &&
      player.coins >= triviaCosts.supplies &&
      player.supplies < triviaCosts.maxSupplies)
  );
}
const isRoute = (r: unknown): r is TriviaRoute =>
  triviaRoutes.some((route) => route.id === r);
export function validTriviaMove(
  g: TriviaGame,
  move: unknown,
  seat: number,
): move is TriviaMove {
  const t = triviaOf(g);
  if (t?.rules === 3) return validPick(g, move, seat);
  if (
    !t ||
    t.mode !== 'expedition' ||
    t.stage !== 'camp' ||
    (t.rules === 2 && finalTriviaCamp(g)) ||
    g.phase !== 'vote' ||
    g.over ||
    !Number.isInteger(seat) ||
    seat < 0 ||
    seat >= g.seats.length ||
    !move ||
    typeof move !== 'object' ||
    Array.isArray(move)
  )
    return false;
  const m = move as TriviaMove;
  if (m.type === 'trivia-unlock')
    return Object.keys(m).length === 1 && t.ready[seat] && !campReady(g);
  return (
    m.type === 'trivia-plan' &&
    Object.keys(m).length === 3 &&
    Object.keys(m).every((k) => ['type', 'route', 'purchase'].includes(k)) &&
    !t.ready[seat] &&
    (finalTriviaCamp(g) ? m.route === null : isRoute(m.route)) &&
    (t.rules === 2
      ? m.purchase === null
      : affordable(t.players[seat], m.purchase)) &&
    (!finalTriviaCamp(g) || m.purchase !== 'supplies')
  );
}
/** The find a picker who is away gets: the one adding most to their
 * collection, the first such on the mat. */
export function suggestedFind(g: { tribu?: { trivia?: TriviaState } }) {
  const d = currentDraft(g),
    picker = draftPicker(g);
  if (!d || picker === null) return null;
  const finds = triviaOf(g)!.players[picker].finds ?? [];
  let best: number | null = null;
  d.offer.forEach((find, i) => {
    if (d.picks.includes(i)) return;
    if (best === null || findGain(finds, find) > findGain(finds, d.offer[best]))
      best = i;
  });
  return best;
}
/** Rules 3: only the player whose turn it is may take a find still on offer.
 * Picking for an away player is checked against the table by the server. */
function validPick(g: TriviaGame, move: unknown, seat: number) {
  const t = triviaOf(g),
    d = currentDraft(g);
  if (
    !t ||
    t.mode !== 'expedition' ||
    !d ||
    g.phase !== 'vote' ||
    g.over ||
    !move ||
    typeof move !== 'object' ||
    Array.isArray(move)
  )
    return false;
  const m = move as { type?: unknown; find?: unknown };
  if (m.type === 'trivia-pick-for')
    return (
      Object.keys(m).length === 1 &&
      Number.isInteger(seat) &&
      seat >= 0 &&
      seat < g.seats.length &&
      draftPicker(g) !== null
    );
  return (
    m.type === 'trivia-pick' &&
    Object.keys(m).length === 2 &&
    Object.hasOwn(m, 'find') &&
    draftPicker(g) === seat &&
    Number.isInteger(m.find) &&
    (m.find as number) >= 0 &&
    (m.find as number) < d.offer.length &&
    !d.picks.includes(m.find as number)
  );
}
export function playTriviaMove<G extends TriviaGame>(
  g: G,
  m: TriviaMove,
  seat: number,
): G {
  if (!validTriviaMove(g, m, seat)) return g;
  const n = structuredClone(g) as G & { revision: number },
    t = triviaOf(n)!;
  n.revision++;
  if (m.type === 'trivia-pick' || m.type === 'trivia-pick-for') {
    const d = t.rounds.at(-1)!.draft!,
      picker = m.type === 'trivia-pick' ? seat : draftPicker(g)!,
      find = m.type === 'trivia-pick' ? m.find : suggestedFind(g)!;
    d.picks.push(find);
    t.players[picker].finds!.push({ ...d.offer[find] });
  } else if (m.type === 'trivia-unlock') t.ready[seat] = false;
  else {
    t.plans[seat] = { route: m.route, purchase: m.purchase };
    t.ready[seat] = true;
  }
  return n;
}
/** The host starts a challenge atomically: routes become public and the
 * mini-game deals or hands over. Only legacy matches have purchases. */
export function prepareTriviaPick<G extends TriviaGame>(g: G): G {
  if (!isTriviaCamp(g) || !campReady(g)) return g;
  const n = structuredClone(g),
    t = triviaOf(n)!;
  if (t.rules === 3) {
    t.stage = 'challenge';
    return n;
  }
  if (t.rules === undefined)
    for (let s = 0; s < n.seats.length; s++)
      buy(t.players[s], t.plans[s]!.purchase);
  if (finalTriviaCamp(n)) {
    if (t.rules === undefined)
      t.finalPurchases = t.plans.map((p) => p!.purchase);
  } else {
    t.activeRoutes = t.plans.map((p) => p!.route);
    t.activePurchases = t.plans.map((p) => p!.purchase);
  }
  t.stage = 'challenge';
  t.plans.fill(null);
  t.ready.fill(false);
  return n;
}
function remember(g: SabiPart, content: TriviaContent) {
  if (g.kind === 'miro') {
    const localRound = g.round - (g.start ?? 1) + 1;
    content.miro = [
      ...new Set([...content.miro, ...g.deck.slice(0, localRound * 3)]),
    ];
  } else if (g.kind === 'size')
    content.size = [...new Set([...content.size, ...g.used])];
  else content[g.kind] = [...new Set([...content[g.kind], ...g.used])];
}
/** Called after an ordinary mini-game move. A completed challenge is paid
 * once, while the table remains waiting for its host. */
export function settleTrivia<G>(value: G): G {
  const g = value as unknown as SabiPart,
    t = triviaOf(g);
  if (!t || g.over || g.phase !== 'vote' || g.vote?.opening) return value;
  if (t.accountedRound < g.round) {
    const totals = rawPoints(g),
      scores = totals.map((points, s) => points - t.basePoints[s]),
      winners = roundWinners(scores);
    const current = t.rules === 3,
      blocks = current && t.mode === 'tower' ? placementBlocks(scores) : null;
    t.rounds.push({
      kind: g.kind,
      scores,
      winners,
      routes:
        t.mode === 'expedition' && !current
          ? [...t.activeRoutes]
          : g.seats.map(() => null),
      purchases:
        t.mode === 'expedition' && !current
          ? [...t.activePurchases]
          : g.seats.map(() => null),
      ...(blocks ? { blocks } : {}),
      ...(current && t.mode === 'expedition'
        ? {
            draft: {
              order: draftOrder(
                scores,
                t.players.map((p) => collectionScore(p.finds)),
                t.basePoints,
                g.round,
              ),
              offer: dealOffer(g, g.seats.length),
              picks: [],
            },
          }
        : {}),
    });
    for (let s = 0; s < g.seats.length; s++) {
      const player = t.players[s];
      if (blocks) {
        player.floors += blocks[s];
        if (winners.includes(s)) player.victories++;
      } else if (current) {
        // Rules 3 Expedition scores only what its players pick.
      } else if (t.mode === 'tower') {
        const victory = winners.includes(s);
        player.floors +=
          Math.floor(scores[s] / triviaTower.pointsPerFloor) +
          (victory ? triviaTower.victoryFloors : 0);
        if (victory) player.victories++;
      } else if (t.mode === 'expedition') {
        if (t.rules === 2) {
          player.distance += triviaReward(
            t.activeRoutes[s]!,
            scores[s],
          ).distance;
          player.trophies = Math.floor(
            player.distance / triviaExpedition.checkpointSteps,
          );
        } else {
          const reward = legacyTriviaReward(
            t.activeRoutes[s]!,
            scores[s],
            player.supplies,
          );
          player.coins += reward.coins;
          player.distance += reward.distance;
        }
      }
    }
    t.completed = g.round;
    t.accountedRound = g.round;
    t.basePoints = totals;
    t.roundScores = [...scores];
    t.roundWinners = winners;
    remember(g, t.content);
  }
  if (t.mode !== 'quick') {
    g.vote!.host = true;
    g.vote!.endsAt = null;
    g.vote!.options =
      t.rules === undefined && !triviaComplete(g)
        ? (g.vote!.options ?? [...sets.miro]).filter(
            (choice) => choice !== 'finish',
          )
        : fixedOptions(g);
    if (t.mode === 'expedition') {
      t.stage = 'camp';
      t.plans.fill(null);
      t.ready.fill(false);
    }
  }
  return value;
}
/** Removes private plans, including their purchase, even from the host's
 * view. Readiness remains public and only each seat receives its own plan. */
export function observeTrivia<G extends { tribu?: { trivia?: TriviaState } }>(
  g: G,
  viewer: number,
): G {
  const t = triviaOf(g);
  if (!t) return g;
  t.plans = t.plans.map((p, s) => (s === viewer ? p : null));
  t.content = { miro: [], size: [], year: [], order: [] };
  // Ignore unknown metadata even if an unvalidated caller observes it.
  for (const key of Object.keys(t))
    if (
      !(
        (t.rules === 3 ? currentStateKeys : rules2Keys) as readonly string[]
      ).includes(key)
    )
      delete (t as unknown as Record<string, unknown>)[key];
  return g;
}
export type TriviaStanding = TriviaPlayer & {
  seat: number;
  points: number;
  rawPoints: number;
  score: number;
};
export function triviaStandings(g: TriviaGame): TriviaStanding[] {
  const t = triviaOf(g),
    mode = triviaModeOf(g),
    points = rawPoints(g);
  return g.seats
    .map((_, s) => {
      const p = t?.players[s] ?? emptyPlayer();
      return {
        ...p,
        seat: s,
        points: points[s],
        rawPoints: points[s],
        score:
          mode === 'tower'
            ? p.floors
            : mode === 'expedition'
              ? t?.rules === 3
                ? collectionScore(p.finds)
                : t?.rules === 2
                  ? p.distance
                  : p.trophies
              : points[s],
      };
    })
    .sort((a, b) => compareStandings(a, b, mode, t?.rules));
}
function compareStandings(
  a: TriviaStanding,
  b: TriviaStanding,
  mode: TriviaMode,
  rules: TriviaState['rules'],
) {
  return mode === 'tower'
    ? b.floors - a.floors || b.rawPoints - a.rawPoints
    : mode === 'expedition'
      ? rules === 3
        ? b.score - a.score || b.rawPoints - a.rawPoints
        : rules === 2
        ? b.distance - a.distance || b.rawPoints - a.rawPoints
        : b.trophies - a.trophies ||
          b.distance - a.distance ||
          b.coins - a.coins ||
          b.rawPoints - a.rawPoints
      : b.rawPoints - a.rawPoints;
}
export function triviaWinners(g: TriviaGame) {
  const standings = triviaStandings(g),
    first = standings[0];
  return standings
    .filter(
      (s) =>
        compareStandings(s, first, triviaModeOf(g), triviaOf(g)?.rules) ===
        0,
    )
    .map((s) => s.seat);
}

function vector(
  value: unknown,
  n: number,
  test: (v: unknown) => boolean,
): value is unknown[] {
  return Array.isArray(value) && value.length === n && value.every(test);
}
const natural = (v: unknown, max: number) =>
  Number.isInteger(v) && (v as number) >= 0 && (v as number) <= max;
const equal = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);
function validContent(c: unknown): c is TriviaContent {
  if (!c || typeof c !== 'object' || Array.isArray(c)) return false;
  const content = c as TriviaContent;
  return (
    Object.keys(content).length === 4 &&
    ['miro', 'size', 'year', 'order'].every((kind) =>
      Object.hasOwn(content, kind),
    ) &&
    ['miro', 'year', 'order'].every((kind) => {
      const ids = content[kind as 'miro'];
      return (
        Array.isArray(ids) &&
        ids.length <= maxRounds * 3 &&
        new Set(ids).size === ids.length &&
        ids.every(
          (id) =>
            natural(id, 1e6) &&
            !!(kind === 'miro'
              ? places[id]
              : kind === 'year'
                ? yearEvents[id]
                : orderSets[id]),
        )
      );
    }) &&
    Array.isArray(content.size) &&
    content.size.length <= maxRounds * 18 &&
    new Set(content.size).size === content.size.length &&
    content.size.every(
      (id) =>
        typeof id === 'string' &&
        id.length <= 200 &&
        id.split('>').every((part) => !!country(part) || !!thing(part)),
    )
  );
}
/** Replays the public awards. Saved fields cannot create floors or steps,
 * award a checkpoint early, or introduce purchases in the current rules. */
export function validTriviaState(g: TriviaGame): boolean {
  const t = triviaOf(g);
  if (t === undefined) return true;
  if (t && typeof t === 'object' && t.rules === 3) return validCurrentTrivia(g);
  const n = g.seats.length,
    current = t?.rules === 2,
    keys = current ? rules2Keys : stateKeys,
    limit = isTriviaMode(t?.mode) ? triviaGameRoundLimit(g) : maxRounds;
  if (
    !t ||
    typeof t !== 'object' ||
    Array.isArray(t) ||
    Object.keys(t).length !== keys.length ||
    Object.keys(t).some((key) => !(keys as readonly string[]).includes(key)) ||
    (t.rules !== undefined && t.rules !== 2) ||
    !natural(n, 6) ||
    n < 2 ||
    !(sets.miro as readonly string[]).includes(g.kind) ||
    !isTriviaMode(t.mode) ||
    !['challenge', 'camp'].includes(t.stage) ||
    g.mode !== 'individual' ||
    g.tribu?.mode !== 'individual' ||
    (t.mode !== 'quick' && g.tribu?.votes !== undefined) ||
    !natural(t.completed, limit) ||
    t.accountedRound !== t.completed ||
    g.round < t.completed ||
    g.round > t.completed + 1 ||
    (t.mode !== 'quick' && g.round > limit) ||
    !vector(t.basePoints, n, (v) =>
      natural(v, triviaMaxRoundPoints * t.completed),
    ) ||
    !vector(
      t.players,
      n,
      (p) => !!p && typeof p === 'object' && !Array.isArray(p),
    ) ||
    !vector(
      t.plans,
      n,
      (p) => p === null || (!!p && typeof p === 'object' && !Array.isArray(p)),
    ) ||
    !vector(t.ready, n, (v) => typeof v === 'boolean') ||
    !vector(t.activeRoutes, n, (r) => r === null || isRoute(r)) ||
    !vector(
      t.activePurchases,
      n,
      (p) => p === null || p === 'trophy' || p === 'supplies',
    ) ||
    !vector(t.finalPurchases, n, (p) => p === null || p === 'trophy') ||
    !vector(t.roundScores, n, (v) => natural(v, triviaMaxRoundPoints)) ||
    !Array.isArray(t.roundWinners) ||
    !Array.isArray(t.rounds) ||
    t.rounds.length !== t.completed ||
    !validContent(t.content)
  )
    return false;
  if (
    current &&
    t.mode !== 'quick' &&
    new Set(t.rounds.map((round) => round?.kind)).size !== t.rounds.length
  )
    return false;
  if (
    current &&
    [...t.activePurchases, ...t.finalPurchases].some((p) => p !== null)
  )
    return false;
  const players = Array.from({ length: n }, emptyPlayer),
    sums = Array(n).fill(0) as number[];
  for (const round of t.rounds) {
    if (
      !round ||
      typeof round !== 'object' ||
      Array.isArray(round) ||
      Object.keys(round).length !== 5 ||
      !(sets.miro as readonly string[]).includes(round.kind) ||
      !vector(round.scores, n, (v) => natural(v, triviaMaxRoundPoints)) ||
      !equal(round.winners, roundWinners(round.scores)) ||
      !vector(round.routes, n, (r) =>
        t.mode === 'expedition' ? isRoute(r) : r === null,
      ) ||
      !vector(
        round.purchases,
        n,
        (p) => p === null || p === 'trophy' || p === 'supplies',
      ) ||
      ((current || t.mode !== 'expedition') &&
        round.purchases.some((p) => p !== null))
    )
      return false;
    for (let s = 0; s < n; s++) {
      const p = players[s];
      sums[s] += round.scores[s];
      if (t.mode === 'tower') {
        const won = round.winners.includes(s);
        p.floors +=
          Math.floor(round.scores[s] / triviaTower.pointsPerFloor) +
          (won ? triviaTower.victoryFloors : 0);
        p.victories += Number(won);
      } else if (t.mode === 'expedition') {
        if (current) {
          p.distance += triviaReward(
            round.routes[s]!,
            round.scores[s],
          ).distance;
          p.trophies = Math.floor(
            p.distance / triviaExpedition.checkpointSteps,
          );
        } else {
          if (!affordable(p, round.purchases[s])) return false;
          buy(p, round.purchases[s]);
          const reward = legacyTriviaReward(
            round.routes[s]!,
            round.scores[s],
            p.supplies,
          );
          p.coins += reward.coins;
          p.distance += reward.distance;
        }
      }
    }
  }
  if (!equal(sums, t.basePoints)) return false;
  const last = t.rounds.at(-1);
  if (
    !equal(t.roundScores, last?.scores ?? Array(n).fill(0)) ||
    !equal(t.roundWinners, last?.winners ?? [])
  )
    return false;
  const opening = g.phase === 'vote' && g.vote?.opening === true,
    camp = t.stage === 'camp',
    underway = !opening && t.completed < g.round;
  if (
    (opening && (g.round !== 1 || t.completed !== 0 || g.over)) ||
    (g.phase === 'vote' && !opening && t.completed !== g.round) ||
    (g.over && (g.phase !== 'reveal' || t.completed !== g.round)) ||
    (!g.over && !opening && g.phase !== 'vote' && !underway)
  )
    return false;
  if (
    current &&
    t.mode !== 'quick' &&
    ((!underway && last && last.kind !== g.kind) ||
      (underway && t.rounds.some((round) => round.kind === g.kind)))
  )
    return false;
  if (t.mode === 'expedition') {
    if (
      (camp || g.over) &&
      (!equal(t.activeRoutes, last?.routes ?? Array(n).fill(null)) ||
        !equal(t.activePurchases, last?.purchases ?? Array(n).fill(null)))
    )
      return false;
    if (camp) {
      if (
        g.over ||
        g.phase !== 'vote' ||
        (t.completed === 0 ? !opening : t.completed !== g.round)
      )
        return false;
      if (
        current &&
        finalTriviaCamp(g) &&
        (t.plans.some((p) => p !== null) || t.ready.some(Boolean))
      )
        return false;
      for (let s = 0; s < n; s++) {
        const p = t.plans[s];
        if (t.ready[s] && p === null) return false;
        if (
          p !== null &&
          (Object.keys(p).length !== 2 ||
            !Object.keys(p).every((key) =>
              ['route', 'purchase'].includes(key),
            ) ||
            (finalTriviaCamp(g)
              ? p.route !== null || p.purchase === 'supplies'
              : !isRoute(p.route)) ||
            (current
              ? p.purchase !== null
              : !affordable(players[s], p.purchase)))
        )
          return false;
      }
    } else if (underway) {
      if (t.activeRoutes.some((r) => !isRoute(r))) return false;
      if (!current)
        for (let s = 0; s < n; s++) {
          if (!affordable(players[s], t.activePurchases[s])) return false;
          buy(players[s], t.activePurchases[s]);
        }
    } else if (!g.over) return false;
    if (g.over) {
      if (t.completed !== limit || camp) return false;
      if (!current)
        for (let s = 0; s < n; s++) {
          if (!affordable(players[s], t.finalPurchases[s])) return false;
          buy(players[s], t.finalPurchases[s]);
        }
    } else if (t.finalPurchases.some((p) => p !== null)) return false;
  } else {
    if (
      camp ||
      t.activeRoutes.some((r) => r !== null) ||
      t.activePurchases.some((p) => p !== null) ||
      t.finalPurchases.some((p) => p !== null)
    )
      return false;
    if (t.mode === 'tower' && g.over && t.completed !== limit) return false;
  }
  if (!camp && (t.plans.some((p) => p !== null) || t.ready.some(Boolean)))
    return false;
  if (!equal(t.players, players)) return false;
  const totals = rawPoints(g);
  if (
    totals.some(
      (points, s) =>
        !natural(points - t.basePoints[s], underway ? triviaMaxRoundPoints : 0),
    )
  )
    return false;
  if (g.phase === 'vote') {
    if (
      !g.vote ||
      (t.mode !== 'quick' && (!g.vote.host || g.vote.endsAt !== null))
    )
      return false;
    if (t.mode !== 'quick') {
      const options = g.vote.options;
      if (
        !options ||
        (triviaComplete(g)
          ? !equal(options, ['finish'])
          : current
            ? !equal(options, remainingTriviaGames(g))
            : options.length === 0 ||
              options.some(
                (o) => !(sets.miro as readonly unknown[]).includes(o),
              ))
      )
        return false;
    }
  }
  return true;
}

const validFind = (f: unknown): f is TriviaFind =>
  !!f &&
  typeof f === 'object' &&
  !Array.isArray(f) &&
  Object.keys(f).length === 2 &&
  findKinds.includes((f as TriviaFind).kind) &&
  ((f as TriviaFind).size === 1 || (f as TriviaFind).size === 2);
/** Rules 3: replays every placement award and every draft pick, so a saved
 * field can never add a floor or a find, skip a turn or reorder a draft. */
function validCurrentTrivia(g: TriviaGame): boolean {
  const t = triviaOf(g)!,
    n = g.seats.length,
    fixed = t.mode !== 'quick',
    expedition = t.mode === 'expedition';
  if (
    Object.keys(t).length !== currentStateKeys.length ||
    Object.keys(t).some(
      (key) => !(currentStateKeys as readonly string[]).includes(key),
    ) ||
    !natural(n, 6) ||
    n < 2 ||
    !(sets.miro as readonly string[]).includes(g.kind) ||
    !isTriviaMode(t.mode) ||
    !['challenge', 'camp'].includes(t.stage) ||
    g.mode !== 'individual' ||
    g.tribu?.mode !== 'individual' ||
    (fixed && g.tribu?.votes !== undefined) ||
    !Number.isInteger(t.length) ||
    (fixed
      ? t.length! % triviaBlock !== 0 ||
        t.length! < triviaBlock ||
        t.length! > triviaMaxLength
      : t.length !== triviaMaxLength)
  )
    return false;
  const limit = t.length!;
  if (
    !natural(t.completed, limit) ||
    t.accountedRound !== t.completed ||
    g.round < t.completed ||
    g.round > t.completed + 1 ||
    g.round > limit ||
    !vector(t.basePoints, n, (v) =>
      natural(v, triviaMaxRoundPoints * t.completed),
    ) ||
    !vector(
      t.players,
      n,
      (p) => !!p && typeof p === 'object' && !Array.isArray(p),
    ) ||
    !vector(t.plans, n, (p) => p === null) ||
    !vector(t.ready, n, (v) => v === false) ||
    !vector(t.activeRoutes, n, (r) => r === null) ||
    !vector(t.activePurchases, n, (p) => p === null) ||
    !vector(t.finalPurchases, n, (p) => p === null) ||
    !vector(t.roundScores, n, (v) => natural(v, triviaMaxRoundPoints)) ||
    !Array.isArray(t.roundWinners) ||
    !Array.isArray(t.rounds) ||
    t.rounds.length !== t.completed ||
    !validContent(t.content)
  )
    return false;
  const opening = g.phase === 'vote' && g.vote?.opening === true,
    underway = !opening && t.completed < g.round,
    camp = expedition && g.phase === 'vote' && !opening && !g.over;
  if (t.stage !== (camp ? 'camp' : 'challenge')) return false;
  const players = Array.from({ length: n }, () => emptyCurrentPlayer(t.mode)),
    sums = Array(n).fill(0) as number[];
  for (let i = 0; i < t.rounds.length; i++) {
    const round = t.rounds[i];
    const extra = t.mode === 'tower' ? 'blocks' : expedition ? 'draft' : null;
    if (
      !round ||
      typeof round !== 'object' ||
      Array.isArray(round) ||
      Object.keys(round).length !== (extra ? 6 : 5) ||
      (extra !== null && !Object.hasOwn(round, extra)) ||
      !(sets.miro as readonly string[]).includes(round.kind) ||
      !vector(round.scores, n, (v) => natural(v, triviaMaxRoundPoints)) ||
      !equal(round.winners, roundWinners(round.scores)) ||
      !vector(round.routes, n, (r) => r === null) ||
      !vector(round.purchases, n, (p) => p === null) ||
      (fixed &&
        t.rounds
          .slice(blockStart(i), i)
          .some((earlier) => earlier.kind === round.kind))
    )
      return false;
    if (t.mode === 'tower') {
      if (!equal(round.blocks, placementBlocks(round.scores))) return false;
      for (let s = 0; s < n; s++) {
        players[s].floors += round.blocks![s];
        players[s].victories += Number(round.winners.includes(s));
      }
    } else if (expedition) {
      const d = round.draft;
      if (
        !d ||
        typeof d !== 'object' ||
        Array.isArray(d) ||
        Object.keys(d).length !== 3 ||
        !equal(
          d.order,
          draftOrder(
            round.scores,
            players.map((p) => collectionScore(p.finds)),
            sums,
            i + 1,
          ),
        ) ||
        !Array.isArray(d.offer) ||
        d.offer.length !== n + 1 ||
        !d.offer.every(validFind) ||
        d.offer.filter((f) => f.size === 2).length !== 1 ||
        !Array.isArray(d.picks) ||
        d.picks.length > n ||
        new Set(d.picks).size !== d.picks.length ||
        !d.picks.every((v) => natural(v, n)) ||
        // Only the camp the table is in may still be picking.
        (d.picks.length < n && !(camp && i === t.rounds.length - 1))
      )
        return false;
      d.picks.forEach((find, k) =>
        players[d.order[k]].finds!.push({ ...d.offer[find] }),
      );
    }
    for (let s = 0; s < n; s++) sums[s] += round.scores[s];
  }
  if (!equal(sums, t.basePoints)) return false;
  const last = t.rounds.at(-1);
  if (
    !equal(t.roundScores, last?.scores ?? Array(n).fill(0)) ||
    !equal(t.roundWinners, last?.winners ?? []) ||
    (camp && !last)
  )
    return false;
  if (
    (opening && (g.round !== 1 || t.completed !== 0 || g.over)) ||
    (g.phase === 'vote' && !opening && t.completed !== g.round) ||
    (g.over && (g.phase !== 'reveal' || t.completed !== g.round)) ||
    (!g.over && !opening && g.phase !== 'vote' && !underway) ||
    (fixed && g.over && t.completed !== limit)
  )
    return false;
  if (
    fixed &&
    ((!underway && last && last.kind !== g.kind) ||
      (underway &&
        t.rounds
          .slice(blockStart(t.completed))
          .some((round) => round.kind === g.kind)))
  )
    return false;
  if (!equal(t.players, players)) return false;
  const totals = rawPoints(g);
  if (
    totals.some(
      (points, s) =>
        !natural(points - t.basePoints[s], underway ? triviaMaxRoundPoints : 0),
    )
  )
    return false;
  if (g.phase === 'vote' && fixed) {
    if (!g.vote || !g.vote.host || g.vote.endsAt !== null) return false;
    if (!equal(g.vote.options, opening ? [...sets.miro] : fixedOptions(g)))
      return false;
  }
  return true;
}
