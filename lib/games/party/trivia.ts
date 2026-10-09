import type { SabiPart } from './tribu.ts';
import { maxRounds, sets } from './vote.ts';
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
  | { type: 'trivia-unlock' };
export type TriviaPlayer = {
  floors: number;
  victories: number;
  coins: number;
  distance: number;
  trophies: number;
  supplies: number;
};
export type TriviaRound = {
  kind: (typeof sets.miro)[number];
  scores: number[];
  winners: number[];
  routes: (TriviaRoute | null)[];
  purchases: (TriviaPurchase | null)[];
};
export type TriviaContent = {
  miro: number[];
  size: string[];
  year: number[];
  order: number[];
};
export type TriviaState = {
  /** Rules 2 plays each game once and awards Expedition checkpoints.
   * Absent on older five/eight-round matches with a camp shop. */
  rules?: 2;
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
const currentStateKeys = [...stateKeys, 'rules'] as const;

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
  return triviaRoundLimit(t?.mode ?? 'quick');
}
/** Fixed matches play one whole round of every mini-game, in the host's order. */
export function remainingTriviaGames(g: { tribu?: { trivia?: TriviaState } }) {
  const t = triviaOf(g);
  return sets.miro.filter(
    (kind) =>
      !t ||
      t.rules !== 2 ||
      t.mode === 'quick' ||
      !t.rounds.some((round) => round.kind === kind),
  );
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
  return (
    !!t &&
    t.stage === 'camp' &&
    ((t.rules === 2 && finalTriviaCamp(g)) || t.ready.every(Boolean))
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
): TriviaState {
  if (!isTriviaMode(mode)) throw new Error('Choose a Trivia mode.');
  return {
    rules: 2,
    mode,
    stage: mode === 'expedition' ? 'camp' : 'challenge',
    completed: 0,
    accountedRound: 0,
    basePoints: Array(n).fill(0),
    players: Array.from({ length: n }, emptyPlayer),
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
export function playTriviaMove<G extends TriviaGame>(
  g: G,
  m: TriviaMove,
  seat: number,
): G {
  if (!validTriviaMove(g, m, seat)) return g;
  const n = structuredClone(g) as G & { revision: number },
    t = triviaOf(n)!;
  n.revision++;
  if (m.type === 'trivia-unlock') t.ready[seat] = false;
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
    t.rounds.push({
      kind: g.kind,
      scores,
      winners,
      routes:
        t.mode === 'expedition' ? [...t.activeRoutes] : g.seats.map(() => null),
      purchases:
        t.mode === 'expedition'
          ? [...t.activePurchases]
          : g.seats.map(() => null),
    });
    for (let s = 0; s < g.seats.length; s++) {
      const player = t.players[s];
      if (t.mode === 'tower') {
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
    g.vote!.options = triviaComplete(g)
      ? ['finish']
      : t.rules === 2
        ? remainingTriviaGames(g)
        : (g.vote!.options ?? [...sets.miro]).filter(
            (choice) => choice !== 'finish',
          );
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
    if (!(currentStateKeys as readonly string[]).includes(key))
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
              ? t?.rules === 2
                ? p.distance
                : p.trophies
              : points[s],
      };
    })
    .sort((a, b) => compareStandings(a, b, mode, t?.rules === 2));
}
function compareStandings(
  a: TriviaStanding,
  b: TriviaStanding,
  mode: TriviaMode,
  current: boolean,
) {
  return mode === 'tower'
    ? b.floors - a.floors || b.rawPoints - a.rawPoints
    : mode === 'expedition'
      ? current
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
        compareStandings(
          s,
          first,
          triviaModeOf(g),
          triviaOf(g)?.rules === 2,
        ) === 0,
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
  const n = g.seats.length,
    current = t?.rules === 2,
    keys = current ? currentStateKeys : stateKeys,
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
