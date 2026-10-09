import { sameOutfit, stationDish, type DishId, type Look } from './content.ts';
import {
  membersOf,
  outTarget,
  step,
  actionFor,
  cookSeconds,
  clock,
  freeHands,
  matchEffects,
  matchSpec,
  dishDemand,
  PASS_SIZE,
  type Group,
  mayStart,
  stationOpenSlot,
  stationSlots,
  stationStock,
  type Input,
  type Match,
  type UseKind,
} from './engine.ts';
import {
  boothRect,
  COUNTER_X,
  COUNTER_Z,
  JUKEBOX,
  PLAYER_R,
  QUEUE,
  route,
} from './layout.ts';

/**
 * A greedy waiter for tests, balancing and an empty seat: it picks the most
 * useful job it can see, walks there around the booths and presses Use or
 * Out. It spots mimics the fair way, by the one outfit that does not match
 * the rest of its party, never by peeking at the answer.
 */
export type BotMemory = {
  goal: string;
  path: [number, number][];
  replan: number;
  wait: number;
  /** Where it stood a moment ago, to notice being stuck. */
  was: [number, number, number];
};
export const botMemory = (): BotMemory => ({
  goal: '',
  path: [],
  replan: 0,
  wait: 0,
  was: [0, 0, 0],
});
/** Jobs other bots took this tick, so two do not chase the same one. */
export type Claims = Set<string>;

type Job = {
  key: string;
  to: [number, number];
  /** The Use it waits for there, or 'out' for a guest to throw out. */
  kind: UseKind | 'out';
  /** The guest to throw out, the party to lead or the table to use. */
  target?: number;
  /** The counter spot to use. */
  counter?: string;
  group?: number;
  puddle?: number;
};

const counterPoint = (id: keyof typeof COUNTER_X): [number, number] => [
  COUNTER_X[id],
  COUNTER_Z + 0.48,
];

function tablePoint(
  m: Match,
  slot: number,
  x: number,
  z: number,
): [number, number] {
  const t = m.tables.find((s) => s.slot === slot)!;
  const r = boothRect(t);
  const options: [number, number][] = [
    [t.x, r.z1 + 0.42],
    [t.x, r.z0 - 0.42],
    [r.x0 - 0.42, t.z],
    [r.x1 + 0.42, t.z],
  ];
  let best = options[0];
  let d = Infinity;
  for (const o of options) {
    const e = Math.hypot(o[0] - x, o[1] - z);
    if (e < d && o[0] > 0.4 && o[0] < 10.6) {
      d = e;
      best = o;
    }
  }
  return best;
}

/** The guest whose outfit differs from everyone else's in a party of 3+. */
export function oddOneOut(looks: { id: number; look: Look }[]): number | null {
  if (looks.length < 3) return null;
  for (const a of looks) {
    const others = looks.filter((b) => b !== a);
    if (
      others.every((b) => sameOutfit(b.look, others[0].look)) &&
      !sameOutfit(a.look, others[0].look)
    )
      return a.id;
  }
  return null;
}

function chooseJob(
  m: Match,
  pi: number,
  claims: Claims,
  spot: boolean,
  goal: string,
): Job | null {
  const p = m.players[pi];
  const fx = matchEffects(m);
  const hands = p.hands;
  const free = freeHands(m, p);
  const claim = (key: string) => !claims.has(key);
  const distance = (to: [number, number]) =>
    Math.hypot(to[0] - p.x, to[1] - p.z);
  const counter = (id: keyof typeof COUNTER_X, kind: UseKind): Job => ({
    key: `${kind}:${id}`,
    to: counterPoint(id),
    kind,
    counter: id,
  });
  // Finish seating and washing rather than leaving these half done.
  if (p.lead >= 0) {
    const g = m.groups.find((x) => x.id === p.lead);
    const tables = m.tables
      .filter(
        (t) =>
          t.group < 0 &&
          !t.dirty &&
          t.seats >= (g?.guests.length ?? 1) &&
          claim(`seat:${t.slot}`),
      )
      .sort(
        (a, b) =>
          a.seats - b.seats ||
          distance(tablePoint(m, a.slot, p.x, p.z)) -
            distance(tablePoint(m, b.slot, p.x, p.z)),
      );
    if (tables[0])
      return {
        key: `seat:${tables[0].slot}`,
        to: tablePoint(m, tables[0].slot, p.x, p.z),
        kind: 'seat',
        target: tables[0].slot,
      };
    if (g && g.slot >= 0) {
      const q = QUEUE[g.slot];
      return {
        key: `return:${g.id}`,
        to: [q.x + 0.9, q.z],
        kind: 'return',
        group: g.id,
      };
    }
    return null;
  }
  if (hands.some((i) => i.k === 'dirty')) return counter('sink', 'wash');
  if (hands.some((i) => i.k === 'dish' && i.burnt))
    return counter('bin', 'bin');

  // Patience bars, dish bubbles and outfits are public. Do not consult a
  // guest's mimic flag, future arrivals, RNG, or an unrevealed order.
  const waiting = m.groups.filter((g) =>
    ['queue', 'order', 'food'].includes(g.state),
  );
  const secondsLeft = (g: Group) => {
    const key =
      g.state === 'queue' ? 'queue' : g.state === 'order' ? 'order' : 'food';
    return (
      g.patience *
      matchSpec(m).patience[key] *
      fx.patience[key] *
      (g.demanding ? (m.config?.mechanics.demanding?.patience ?? 1) : 1)
    );
  };
  const urgent = (g: Group) => Math.max(0, 24 - secondsLeft(g)) * 1.8;
  const held = hands.filter(
    (i): i is Extract<typeof i, { k: 'dish' }> => i.k === 'dish' && !i.burnt,
  );
  const pot = hands.find((i) => i.k === 'pot');
  const wanted = (dish: DishId) =>
    dishDemand(m, dish) -
    m.players.reduce(
      (n, q) =>
        n +
        q.hands.filter((i) => i.k === 'dish' && i.dish === dish && !i.burnt)
          .length,
      0,
    );
  const dishUrgency = (dish: DishId) =>
    Math.max(
      0,
      ...waiting
        .filter(
          (g) =>
            g.state === 'food' &&
            membersOf(m, g).some(
              (x) => x.dish === dish && !x.served && x.state !== 'goo',
            ),
        )
        .map(urgent),
    );
  let best: Job | null = null;
  let score = -Infinity;
  const offer = (job: Job, priority: number) => {
    if (!claim(job.key)) return;
    // A small commitment bonus prevents a waiter changing direction every
    // tick. An urgent party can still interrupt a long walk.
    const s = priority - distance(job.to) * 5 + (goal === job.key ? 7 : 0);
    if (s > score) {
      score = s;
      best = job;
    }
  };
  if (spot)
    for (const g of m.groups) {
      if (!['queue', 'read', 'order', 'food'].includes(g.state)) continue;
      const odd = oddOneOut(
        membersOf(m, g).map((x) => ({ id: x.id, look: x.look })),
      );
      if (odd === null) continue;
      const x = m.guests.find((y) => y.id === odd)!;
      offer(
        {
          key: `out:${odd}`,
          to: [x.x, x.z + (x.state === 'sit' ? 0.75 : 0.5)],
          kind: 'out',
          target: odd,
        },
        125,
      );
    }

  for (const t of m.tables) {
    const g = m.groups.find((x) => x.id === t.group);
    const to = tablePoint(m, t.slot, p.x, p.z);
    if (
      g?.state === 'food' &&
      membersOf(m, g).some(
        (x) =>
          !x.served && x.state !== 'goo' && held.some((i) => i.dish === x.dish),
      )
    )
      offer(
        { key: `serve:${t.slot}`, to, kind: 'serve', target: t.slot },
        96 + urgent(g),
      );
    if (g?.state === 'order')
      offer(
        { key: `order:${t.slot}`, to, kind: 'order', target: t.slot },
        78 + urgent(g),
      );
    if (t.dirty && t.group < 0 && !hands.length) {
      const needed = waiting.some(
        (q) =>
          q.state === 'queue' &&
          q.guests.length <= t.seats &&
          !m.tables.some(
            (b) => !b.dirty && b.group < 0 && b.seats >= q.guests.length,
          ),
      );
      offer(
        { key: `clear:${t.slot}`, to, kind: 'clear', target: t.slot },
        (clock(m) <= 22 && t.coins > 0 ? 125 : 62) + (needed ? 25 : 0),
      );
    }
  }

  const low = waiting.filter((g) => g.patience < 0.65);
  if (fx.jukebox && !m.juke.play && !m.juke.rest && low.length >= 2)
    offer(
      { key: 'juke', to: [JUKEBOX.x - 0.9, JUKEBOX.z], kind: 'juke' },
      110 + Math.max(...low.map(urgent)),
    );
  if (pot) {
    for (const g of low) {
      // Serving is the first Use at a booth; do not wait for a pour when
      // Use would give a held plate instead.
      if (
        g.state === 'food' &&
        membersOf(m, g).some(
          (x) => !x.served && held.some((i) => i.dish === x.dish),
        )
      )
        continue;
      const to: [number, number] =
        g.state === 'queue'
          ? [QUEUE[g.slot].x + 0.3, QUEUE[g.slot].z + 0.6]
          : tablePoint(m, g.table, p.x, p.z);
      offer(
        { key: `pour:${g.id}`, to, kind: 'pour', group: g.id },
        104 + urgent(g),
      );
    }
    if (
      pot.pours === 1 &&
      low.length >= 2 &&
      distance(counterPoint('coffee')) < 1.1
    )
      offer(counter('coffee', 'refill'), 92);
  } else if (fx.coffee && free > 0 && low.length && clock(m) > 12) {
    // Fetch only for an actual low bar, not simply because the urn exists.
    offer(counter('coffee', 'pot'), 72 + Math.max(...low.map(urgent)));
  }

  for (const s of m.stations) {
    const dish = stationDish[s.id];
    const need = wanted(dish);
    const urgency = dishUrgency(dish);
    if (s.jam) {
      offer(counter(s.id, 'repair'), need > 0 ? 92 + urgency : 35);
      continue;
    }
    const slots = stationSlots(s);
    const ready = slots.some((lane) => lane.state === 'ready');
    const instant = cookSeconds(m, s.id) === 0;
    if (free > 0 && need > 0 && (ready || (instant && mayStart(m, dish)))) {
      // Batch two or three useful plates at the counter while the table
      // has time. Once out on the floor, finish delivery first.
      const batch = held.length && p.z < 3 ? 17 : 0;
      offer(counter(s.id, 'take'), 86 + urgency + batch);
    } else if (
      free > 0 &&
      !ready &&
      slots.some((lane) => lane.state === 'burnt')
    )
      offer(counter(s.id, 'take'), need > 0 ? 73 + urgency : 25);
    if (
      !instant &&
      stationOpenSlot(s) !== null &&
      mayStart(m, dish) &&
      (!slots.some(
        (lane) => lane.state === 'ready' || lane.state === 'burnt',
      ) ||
        free === 0)
    )
      offer(counter(s.id, 'cook'), need > stationStock(s) ? 82 + urgency : 18);
  }
  if (fx.pass && free > 0 && m.pass[0]?.k === 'dish') {
    const first = m.pass[0];
    if (!first.burnt && wanted(first.dish) > 0)
      offer(
        counter('pass', 'pick'),
        91 + dishUrgency(first.dish) + (held.length && p.z < 3 ? 17 : 0),
      );
    else if (first.burnt) offer(counter('pass', 'pick'), 26);
    // An unwanted plate at the front blocks a wanted one behind it: take it
    // off the shelf (the spare logic below bins it when hands fill up).
    else if (
      m.pass
        .slice(1)
        .some((i) => i.k === 'dish' && !i.burnt && wanted(i.dish) > 0)
    )
      offer(counter('pass', 'pick'), 60);
  }
  const spare = held.find((i) => dishDemand(m, i.dish) === 0);
  if (spare) {
    const future =
      clock(m) > 22 &&
      m.groups.some((g) =>
        ['queue', 'follow', 'read', 'order', 'arrive'].includes(g.state),
      );
    // The pass accepts the oldest plate, only with full hands; it is FIFO.
    // Never put then immediately pick the same unwanted plate back up.
    if (
      fx.pass &&
      free === 0 &&
      m.pass.length < PASS_SIZE &&
      held[0] === spare &&
      future
    )
      offer(counter('pass', 'put'), 80);
    else if (!future || free === 0) offer(counter('bin', 'bin'), 55);
  }
  for (const g of waiting) {
    if (g.state !== 'queue') continue;
    if (
      !m.tables.some(
        (t) => t.group < 0 && !t.dirty && t.seats >= g.guests.length,
      )
    )
      continue;
    const q = QUEUE[g.slot];
    // Leading does not occupy a hand: do it while holding food as well.
    // Coffee must be poured before a low party can be led.
    if (pot && g.patience < 0.65) continue;
    offer(
      {
        key: `lead:${g.id}`,
        to: [q.x + 0.3, q.z + 0.6],
        kind: 'lead',
        group: g.id,
      },
      68 + urgent(g),
    );
  }
  for (const u of m.puddles)
    offer(
      { key: `mop:${u.id}`, to: [u.x, u.z], kind: 'mop', puddle: u.id },
      fx.rubberBoots ? 1 : 12,
    );
  // Wait by a needed plate instead of walking away just before it finishes.
  for (const s of m.stations)
    if (
      !s.jam &&
      free > 0 &&
      wanted(stationDish[s.id]) > 0 &&
      stationSlots(s).some((lane) => lane.state === 'cook')
    )
      offer({ ...counter(s.id, 'take'), key: `hold:${s.id}` }, 22);
  return best;
}

/**
 * The bot's input for this tick. `spot` turns mimic spotting on; `claims`
 * is shared between bots in one diner.
 */
export function botInput(
  m: Match,
  pi: number,
  mem: BotMemory,
  claims: Claims = new Set(),
  spot = true,
  /** Ticks it pauses after each action (a person reads, a bot does not). */
  pause = 3,
): Input {
  const p = m.players[pi];
  const none: Input = { mx: 0, mz: 0, use: false, out: false, dash: false };
  if (m.phase !== 'open' || p.mop > 0) return none;
  if (mem.wait > 0) {
    mem.wait--;
    return none;
  }
  const job = chooseJob(m, pi, claims, spot, mem.goal);
  if (!job) {
    mem.goal = '';
    return none;
  }
  claims.add(job.key);
  if (job.kind === 'out' && p.dash === 0) {
    const target = outTarget(m, pi);
    if (target === job.target) {
      mem.wait = pause;
      return { ...none, out: true };
    }
  } else {
    const a = actionFor(m, pi);
    const id =
      job.group !== undefined
        ? a?.group
        : job.puddle !== undefined
          ? a?.puddle
          : job.counter
            ? a?.counter
            : a?.table;
    if (
      a &&
      p.dash === 0 &&
      a.kind === job.kind &&
      !job.key.startsWith('hold') &&
      (job.target === undefined &&
      job.counter === undefined &&
      job.group === undefined &&
      job.puddle === undefined
        ? true
        : id === (job.group ?? job.puddle ?? job.counter ?? job.target))
    ) {
      mem.wait = pause;
      return { ...none, use: true };
    }
  }
  // Not moved for a second while walking somewhere: find another way.
  if (mem.was[2]++ > 30) {
    if (Math.hypot(mem.was[0] - p.x, mem.was[1] - p.z) < 0.2 && mem.path.length)
      mem.path = [];
    mem.was = [p.x, p.z, 0];
  }
  if (mem.goal !== job.key || mem.replan <= 0 || !mem.path.length) {
    mem.goal = job.key;
    mem.path = route(
      m.tables.map((t) => t.slot),
      [p.x, p.z],
      job.to,
      PLAYER_R + 0.03,
    );
    mem.replan = 20;
  }
  mem.replan--;
  while (
    mem.path.length &&
    Math.hypot(mem.path[0][0] - p.x, mem.path[0][1] - p.z) <
      (p.dash > 0 ? 0.38 : 0.12)
  )
    mem.path.shift();
  const next = mem.path[0];
  if (!next) {
    // There already: turn to face the job.
    const target =
      job.kind === 'out'
        ? m.guests.find((x) => x.id === job.target)
        : job.kind === 'juke'
          ? JUKEBOX
          : undefined;
    const fx = (target?.x ?? job.to[0]) - p.x;
    const fz = (target?.z ?? job.to[1] - 0.5) - p.z;
    const d = Math.hypot(fx, fz) || 1;
    return { ...none, mx: (fx / d) * 0.1, mz: (fz / d) * 0.1 };
  }
  const dx = next[0] - p.x,
    dz = next[1] - p.z;
  const d = Math.hypot(dx, dz) || 1;
  const slow = Math.min(1, d / 0.3 + 0.35);
  return {
    ...none,
    mx: (dx / d) * slow,
    mz: (dz / d) * slow,
    // A dash travels about 2.5 floor units. Start only on a long straight
    // path segment, leaving room to stop before a corner or an action.
    dash: matchEffects(m).dash && !p.dashCool && d > 2.9,
  };
}

/** Plays a whole shift with a bot in every seat; returns the finished match. */
export function playShift(m: Match, spot = true, pause = 3, limit = 200 * 30) {
  const mems = m.players.map(() => botMemory());
  for (let i = 0; i < limit && m.phase !== 'over'; i++) {
    const claims: Claims = new Set();
    const inputs = m.players.map((_, pi) =>
      botInput(m, pi, mems[pi], claims, spot, pause),
    );
    step(m, inputs);
    m.events.length = 0;
  }
  return m;
}
