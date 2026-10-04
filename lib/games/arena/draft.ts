import { allCards, cards, DECK_SIZE, type CardId } from './cards.ts';
import type { Mode } from './engine.ts';

/**
 * The Split draft (Versus with Draft on). Two quick rounds: every player
 * sees an offer of four cards at once, keeps two, and the two they leave go
 * to the player across from them (their lane opponent in 2 v 2: seat 0 and
 * seat 1, seat 2 and seat 3). After two rounds everyone holds 2 + 2 kept and
 * 2 + 2 received: eight cards.
 *
 * Pure and seeded, shared by the room (server/arena.ts) and battles on this
 * device: the same seed builds the same offers everywhere. Times are plain
 * milliseconds on whatever clock the caller passes as `now`.
 */

export const ROUNDS = 2;
export const OFFER = 4;
export const KEEP = 2;
/** How long a round's clock runs. */
export const PICK_MS = 12_000;
/** The pause after a round while the cards fly. */
export const REVEAL_MS = 1_200;
/** How long the final eight show before the battle. */
export const FINAL_MS = 1_500;

/**
 * What a card does for a deck. Every offer holds one card per role, so any
 * two kept from any offer leave a playable deck: a tank or win condition,
 * an answer to air, an answer to splash or swarms, and a spell or support.
 */
export type Role = 'win' | 'air' | 'splash' | 'support';
export const ROLES: Role[] = ['win', 'air', 'splash', 'support'];

type Loose = Record<string, unknown>;

/** The roles a card can fill, read from its tags and stats so new cards
 *  slot in without a list to keep up. */
export function rolesOf(id: CardId): Role[] {
  const c = cards[id];
  if (c.kind === 'spell') return ['support'];
  const u = c.unit as typeof c.unit & Loose;
  const tags = c.tags as string[];
  const spawned = (u.spawn as { unit?: CardId } | undefined)?.unit;
  const spawn =
    spawned && cards[spawned]?.kind === 'troop'
      ? (cards[spawned] as { unit: { targets: string; damage: number } }).unit
      : null;
  const roles: Role[] = [];
  if (
    tags.includes('tank') ||
    tags.includes('siege') ||
    u.targets === 'buildings'
  )
    roles.push('win');
  if (
    (u.targets === 'any' && u.damage > 0) ||
    (spawn && spawn.targets === 'any' && spawn.damage > 0)
  )
    roles.push('air');
  // Splash that only lands on towers (the Balloon's bomb) answers nothing.
  if (
    u.targets !== 'buildings' &&
    (tags.includes('splash') ||
      tags.includes('swarm') ||
      !!u.splash ||
      !!u.spin ||
      !!u.chain ||
      c.formation.length >= 3)
  )
    roles.push('splash');
  if (
    tags.includes('support') ||
    tags.includes('fighter') ||
    tags.includes('control') ||
    !!u.heal ||
    !roles.length
  )
    roles.push('support');
  return roles;
}

/** Cards that may appear in only one offer of a match (the Meteor). */
const single = (id: CardId) => cards[id].kind === 'spell';

/** Every card a draft may offer. */
export function draftPool(): CardId[] {
  return allCards.filter((id) => !(cards[id] as Loose).token);
}

/** A small seeded generator (mulberry32), so offers repeat by seed. */
function dice(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const seatsOf = (mode: Mode) => (mode === 'team' ? 4 : 2);
/** The player across: leftovers go to them. Seats alternate sides, so seat
 *  0 faces 1 and seat 2 faces 3. */
export const opponentOf = (seat: number) => seat ^ 1;
/** The teammate in 2 v 2, or null in a duel. */
export const mateOf = (seat: number, mode: Mode) =>
  mode === 'team' ? (seat + 2) % 4 : null;

/**
 * The offers of a match, `[round][seat]`, each four cards in role order
 * (win, air, splash, support). A lane (a player and the one across) never
 * sees a card twice, so every deck holds eight different cards; within a
 * round no card is offered twice where the pool allows it, and the Meteor
 * appears in only one offer of the match.
 */
export function buildOffers(
  seed: number,
  mode: Mode,
  pool: CardId[] = draftPool(),
): CardId[][][] {
  // A rare unlucky draw cannot fill a role: draw again from the same dice.
  const roll = dice(seed);
  let best: CardId[][][] | null = null;
  for (let attempt = 0; attempt < 40; attempt++) {
    const { offers, complete } = tryOffers(roll, mode, pool);
    if (complete) return offers;
    best ??= offers;
  }
  return best!;
}

function tryOffers(roll: () => number, mode: Mode, pool: CardId[]) {
  const seats = seatsOf(mode);
  const lanes = seats / 2;
  const laneUsed = Array.from({ length: lanes }, () => new Set<CardId>());
  const singles = new Set<CardId>();
  const offers: CardId[][][] = [];
  let complete = true;
  const roleSets = new Map(pool.map((id) => [id, rolesOf(id)]));
  for (let r = 0; r < ROUNDS; r++) {
    const roundUsed = new Set<CardId>();
    const row: CardId[][] = [];
    for (let seat = 0; seat < seats; seat++) {
      const lane = seat >> 1;
      const offer: (CardId | undefined)[] = Array(OFFER).fill(undefined);
      const taken = new Set<CardId>();
      const free = (id: CardId, strict: boolean) =>
        !taken.has(id) &&
        !laneUsed[lane].has(id) &&
        !(single(id) && singles.has(id)) &&
        !(strict && roundUsed.has(id));
      // Fill the scarcest role first, so a card good at several roles is
      // not spent on one that had plenty.
      const open = [...ROLES.keys()];
      while (open.length) {
        const counts = open.map(
          (ri) =>
            pool.filter(
              (id) => free(id, true) && roleSets.get(id)!.includes(ROLES[ri]),
            ).length,
        );
        let at = 0;
        for (let i = 1; i < open.length; i++)
          if (counts[i] < counts[at]) at = i;
        const ri = open.splice(at, 1)[0];
        const role = ROLES[ri];
        let choices = pool.filter(
          (id) => free(id, true) && roleSets.get(id)!.includes(role),
        );
        if (!choices.length)
          choices = pool.filter(
            (id) => free(id, false) && roleSets.get(id)!.includes(role),
          );
        if (!choices.length) {
          complete = false;
          choices = pool.filter((id) => free(id, false));
        }
        const id = choices[Math.floor(roll() * choices.length)];
        if (!id) continue;
        offer[ri] = id;
        taken.add(id);
      }
      const filled = offer.filter((id): id is CardId => !!id);
      if (filled.length < OFFER) complete = false;
      for (const id of filled) {
        laneUsed[lane].add(id);
        roundUsed.add(id);
        if (single(id)) singles.add(id);
      }
      row.push(filled);
    }
    offers.push(row);
  }
  return { offers, complete };
}

/**
 * How good a card is on its own: hit points and damage for its elixir,
 * with a lift for splash, reach and hitting air. Only the order matters;
 * it picks for the clock and for bots.
 */
export function worth(id: CardId): number {
  const c = cards[id];
  if (c.kind === 'spell')
    return ((c.spell.damage / 150) * (c.spell.radius / 2.5)) / c.cost + 0.1;
  const u = c.unit as typeof c.unit & Loose;
  const n = c.formation.length;
  const hp = n * (u.hp + ((u.shield as number | undefined) ?? 0));
  let dps = u.hitSpeed > 0 ? (n * u.damage) / u.hitSpeed : 0;
  if (u.splash || u.spin) dps *= 1.4;
  const chain = u.chain as { count: number } | undefined;
  if (chain) dps *= 1 + (chain.count - 1) * 0.4;
  if (u.targets === 'any') dps *= 1.15;
  dps *= 1 + Math.min(u.range, 8) / 12;
  const heal = u.heal as { amount: number; every: number } | undefined;
  if (heal) dps += (heal.amount / heal.every) * 2.5;
  const spawn = u.spawn as { unit: CardId; count: number; every: number };
  if (spawn && cards[spawn.unit]?.kind === 'troop') {
    const b = (cards[spawn.unit] as { unit: { hp: number; damage: number } })
      .unit;
    dps += ((spawn.count * (b.damage + b.hp / 4)) / spawn.every) * 1.2;
  }
  if (u.aura) dps += 80;
  const value = hp / 1200 + dps / 160;
  return value / c.cost;
}

/**
 * A card's rating for a deck that already holds `have`: its worth, raised
 * when it fills a role the deck still lacks and lowered when the deck is
 * already heavy. The clock's pick and the bots both use it.
 */
export function rate(id: CardId, have: CardId[]): number {
  const roles = rolesOf(id);
  const count = (role: Role) =>
    have.filter((h) => rolesOf(h).includes(role)).length;
  let score = worth(id);
  if (roles.includes('win') && !count('win')) score += 0.45;
  if (roles.includes('air') && count('air') < 2) score += 0.35;
  if (roles.includes('splash') && !count('splash')) score += 0.3;
  if (
    cards[id].kind === 'spell' &&
    !have.some((h) => cards[h].kind === 'spell')
  )
    score += 0.25;
  const heavy = have.filter((h) => cards[h].cost >= 5).length;
  if (cards[id].cost >= 5 && heavy >= 2) score -= 0.4;
  return score;
}

export type DraftStage = 'pick' | 'reveal' | 'final' | 'done';

export type Draft = {
  mode: Mode;
  /** `[round][seat]`: four cards each. */
  offers: CardId[][][];
  /** `[round][seat]`: the cards kept so far, at most two. */
  picks: CardId[][][];
  /** `[round][seat]`: whose two are in. */
  locked: boolean[][];
  round: number;
  stage: DraftStage;
  /** When the current stage ends, on the caller's clock. */
  endsAt: number;
  /** Seats a bot drafts for (instantly, at each round's start). */
  bots: boolean[];
  /** Stage lengths in milliseconds (tests run them faster). */
  times: DraftTimes;
};

export type DraftTimes = { pick: number; reveal: number; final: number };
export const DRAFT_TIMES: DraftTimes = {
  pick: PICK_MS,
  reveal: REVEAL_MS,
  final: FINAL_MS,
};

const clone = (d: Draft): Draft => ({
  ...d,
  offers: d.offers.map((r) => r.map((o) => [...o])),
  picks: d.picks.map((r) => r.map((p) => [...p])),
  locked: d.locked.map((r) => [...r]),
  bots: [...d.bots],
  times: { ...d.times },
});

/** A new draft, its first round open from `now`; bots pick at once. */
export function newDraft(
  seed: number,
  mode: Mode,
  bots: boolean[],
  now: number,
  options: { pool?: CardId[]; times?: DraftTimes } = {},
): Draft {
  const seats = seatsOf(mode);
  const times = { ...DRAFT_TIMES, ...options.times };
  const d: Draft = {
    mode,
    offers: buildOffers(seed, mode, options.pool),
    picks: Array.from({ length: ROUNDS }, () =>
      Array.from({ length: seats }, () => []),
    ),
    locked: Array.from({ length: ROUNDS }, () => Array(seats).fill(false)),
    round: 0,
    stage: 'pick',
    endsAt: now + times.pick,
    bots: Array.from({ length: seats }, (_, i) => !!bots[i]),
    times,
  };
  botsPick(d);
  return settle(d, now);
}

/** What a seat holds after the rounds settled so far: kept, then received,
 *  round by round. */
export function deckOf(d: Draft, seat: number): CardId[] {
  const out: CardId[] = [];
  for (let r = 0; r < ROUNDS; r++) {
    if (!settled(d, r)) break;
    out.push(...d.picks[r][seat], ...receivedOf(d, r, seat));
  }
  return out;
}

/** Whether round `r` is over (its cards have gone where they go). */
export const settled = (d: Draft, r: number) =>
  r < d.round || (r === d.round && d.stage !== 'pick');

/** What the player across left for `seat` in round `r`. */
export function receivedOf(d: Draft, r: number, seat: number): CardId[] {
  const from = opponentOf(seat);
  return d.offers[r][from].filter((id) => !d.picks[r][from].includes(id));
}

/** The two the clock keeps for a seat: what it already chose, then the
 *  highest-rated of the rest. */
export function autoPick(d: Draft, seat: number): CardId[] {
  const r = d.round;
  const picks = [...d.picks[r][seat]];
  const have = [...deckOf(d, seat), ...picks];
  while (picks.length < KEEP) {
    let best: CardId | null = null;
    let score = -Infinity;
    for (const id of d.offers[r][seat]) {
      if (picks.includes(id)) continue;
      const s = rate(id, have);
      if (s > score) {
        score = s;
        best = id;
      }
    }
    if (!best) break;
    picks.push(best);
    have.push(best);
  }
  return picks;
}

function botsPick(d: Draft) {
  const r = d.round;
  d.bots.forEach((bot, seat) => {
    if (!bot || d.locked[r][seat]) return;
    d.picks[r][seat] = autoPick(d, seat);
    d.locked[r][seat] = true;
  });
}

/** Once everyone is in, the round settles straight away. */
function settle(d: Draft, now: number): Draft {
  if (d.stage === 'pick' && d.locked[d.round].every(Boolean)) {
    d.stage = 'reveal';
    d.endsAt = now + d.times.reveal;
  }
  return d;
}

/**
 * A seat's choice this round: up to two cards of its offer. Two locks it in
 * (and settles the round when everyone is in); fewer is a choice in
 * progress, shown live to a teammate. Null when it is not allowed.
 */
export function choose(
  d: Draft,
  seat: number,
  picks: unknown,
  now: number,
): Draft | null {
  if (d.stage !== 'pick' || seat < 0 || seat >= d.bots.length) return null;
  const r = d.round;
  if (d.locked[r][seat]) return null;
  const offer = d.offers[r][seat];
  if (
    !Array.isArray(picks) ||
    picks.length > KEEP ||
    new Set(picks).size !== picks.length ||
    !picks.every((id) => offer.includes(id as CardId))
  )
    return null;
  const next = clone(d);
  next.picks[r][seat] = [...(picks as CardId[])];
  next.locked[r][seat] = picks.length === KEEP;
  return settle(next, now);
}

/**
 * Moves the draft on to `now`: a round whose clock ran out keeps the
 * highest-rated cards for whoever is not in, the cards fly, the next round
 * opens (bots pick at once), the final eight show, then it is done. Returns
 * the same object when nothing changed.
 */
export function advance(d: Draft, now: number): Draft {
  if (d.stage === 'done' || now < d.endsAt) return d;
  const next = clone(d);
  while (next.stage !== 'done' && now >= next.endsAt) {
    const r = next.round;
    if (next.stage === 'pick') {
      next.locked[r].forEach((locked, seat) => {
        if (locked) return;
        next.picks[r][seat] = autoPick(next, seat);
        next.locked[r][seat] = true;
      });
      next.stage = 'reveal';
      next.endsAt += next.times.reveal;
    } else if (next.stage === 'reveal') {
      if (r + 1 < ROUNDS) {
        next.round = r + 1;
        next.stage = 'pick';
        next.endsAt += next.times.pick;
        botsPick(next);
        // A round of bots only settles at once.
        if (next.locked[next.round].every(Boolean)) {
          next.stage = 'reveal';
          next.endsAt += next.times.reveal - next.times.pick;
        }
      } else {
        next.stage = 'final';
        next.endsAt += next.times.final;
      }
    } else {
      next.stage = 'done';
    }
  }
  return next;
}

/** Holds the current stage's clock back by `ms` (time the device could
 *  not show it, such as a stall while the battle loads), so a round, the
 *  flying cards and the final eight all get their full time on screen. */
export function holdClock(d: Draft, ms: number): Draft {
  if (d.stage === 'done' || ms <= 0) return d;
  return { ...clone(d), endsAt: d.endsAt + ms };
}

/** Every seat's eight once the draft is done. */
export function decksOf(d: Draft): CardId[][] {
  return d.bots.map((_, seat) => deckOf(d, seat));
}

/** One round as a seat sees it. */
export type DraftRoundView = {
  offer: CardId[];
  picks: CardId[];
  locked: boolean;
  /** What came over from across, once the round settled. */
  received: CardId[] | null;
  /** The teammate's offer and live picks (2 v 2). */
  mate: { offer: CardId[]; picks: CardId[]; locked: boolean } | null;
};

/**
 * The draft as one seat sees it: its own offers and picks, its teammate's
 * live, and only what came over from across (never the other side's
 * offers). `left` is the time to the current stage's end.
 */
export type DraftView = {
  mode: Mode;
  you: number;
  mate: number | null;
  opponent: number;
  round: number;
  stage: DraftStage;
  left: number;
  /** The current stage's whole length, for the draining ring. */
  total: number;
  rounds: DraftRoundView[];
  /** The cards held so far. */
  deck: CardId[];
  /** Whose two are in, this round, per seat. */
  locked: boolean[];
};

export function draftView(d: Draft, seat: number, now: number): DraftView {
  const mate = mateOf(seat, d.mode);
  const rounds: DraftRoundView[] = [];
  for (let r = 0; r <= d.round; r++)
    rounds.push({
      offer: [...d.offers[r][seat]],
      picks: [...d.picks[r][seat]],
      locked: d.locked[r][seat],
      received: settled(d, r) ? receivedOf(d, r, seat) : null,
      mate:
        mate === null
          ? null
          : {
              offer: [...d.offers[r][mate]],
              picks: [...d.picks[r][mate]],
              locked: d.locked[r][mate],
            },
    });
  return {
    mode: d.mode,
    you: seat,
    mate,
    opponent: opponentOf(seat),
    round: d.round,
    stage: d.stage,
    left: Math.max(0, d.endsAt - now),
    total: d.stage === 'done' ? 0 : d.times[d.stage],
    rounds,
    deck: deckOf(d, seat),
    locked: [...d.locked[d.round]],
  };
}

/** Whether a finished draft gave every seat a full deck of different cards. */
export const fullDeck = (deck: CardId[]) =>
  deck.length === DECK_SIZE && new Set(deck).size === DECK_SIZE;
