import {
  dishes,
  sameOutfit,
  stationDish,
  type DishId,
  type Look,
} from './content.ts';
import {
  membersOf,
  outTarget,
  step,
  actionFor,
  type Input,
  type Match,
  type UseKind,
} from './engine.ts';
import {
  boothRect,
  COUNTER_X,
  COUNTER_Z,
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
): Job | null {
  const p = m.players[pi];
  const carry = p.carry;
  const free = (key: string) => !claims.has(key);
  // Throw out a mimic while its party waits in line.
  if (spot && !carry)
    for (const g of m.groups) {
      if (
        g.state !== 'queue' &&
        g.state !== 'read' &&
        g.state !== 'order' &&
        g.state !== 'food'
      )
        continue;
      const odd = oddOneOut(
        membersOf(m, g).map((x) => ({ id: x.id, look: x.look })),
      );
      if (odd === null || !free(`out:${odd}`)) continue;
      const x = m.guests.find((y) => y.id === odd)!;
      // Face the guest from the front (a waiting row) or the booth's end.
      const to: [number, number] = [
        x.x,
        x.z + (x.state === 'sit' ? 0.75 : 0.5),
      ];
      return { key: `out:${odd}`, to, kind: 'out', target: odd };
    }
  if (carry?.k === 'dish') {
    if (carry.burnt)
      return { key: 'bin', to: counterPoint('bin'), kind: 'bin' };
    for (const t of m.tables) {
      const g = m.groups.find((x) => x.id === t.group);
      if (g?.state !== 'food') continue;
      if (membersOf(m, g).some((x) => x.dish === carry.dish && !x.served))
        return {
          key: `serve:${t.slot}:${pi}`,
          to: tablePoint(m, t.slot, p.x, p.z),
          kind: 'serve',
          target: t.slot,
        };
    }
    // Nobody wants it yet: wait near the booths for an order.
    if (
      m.groups.some(
        (g) =>
          g.state === 'read' || g.state === 'order' || g.state === 'follow',
      )
    )
      return { key: `hold:${pi}`, to: [5.6, 6.2], kind: 'serve' };
    return { key: 'bin', to: counterPoint('bin'), kind: 'bin' };
  }
  if (carry?.k === 'dirty')
    return { key: `sink:${pi}`, to: counterPoint('sink'), kind: 'wash' };
  if (carry?.k === 'lead') {
    const g = m.groups.find((x) => x.id === carry.group);
    const size = g?.guests.length ?? 1;
    const tables = m.tables
      .filter(
        (t) =>
          t.group < 0 && !t.dirty && t.seats >= size && free(`seat:${t.slot}`),
      )
      .sort(
        (a, b) =>
          a.seats - b.seats ||
          Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z),
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
      return { key: `return:${g.id}`, to: [q.x + 0.9, q.z], kind: 'return' };
    }
    return null;
  }
  // Empty hands.
  const wanted = new Map<DishId, number>();
  for (const g of m.groups)
    if (g.state === 'food')
      for (const x of membersOf(m, g))
        if (x.dish && !x.served)
          wanted.set(x.dish, (wanted.get(x.dish) ?? 0) + 1);
  for (const q of m.players)
    if (q.carry?.k === 'dish' && !q.carry.burnt)
      wanted.set(q.carry.dish, (wanted.get(q.carry.dish) ?? 0) - 1);
  for (const s of m.stations) {
    const dish = stationDish[s.id];
    if (
      (s.state === 'ready' && (wanted.get(dish) ?? 0) > 0) ||
      s.state === 'burnt'
    )
      if (free(`take:${s.id}`))
        return {
          key: `take:${s.id}`,
          to: counterPoint(s.id),
          kind: 'take',
          counter: s.id,
        };
  }
  for (const t of m.tables) {
    const g = m.groups.find((x) => x.id === t.group);
    if (g?.state === 'order' && free(`order:${t.slot}`))
      return {
        key: `order:${t.slot}`,
        to: tablePoint(m, t.slot, p.x, p.z),
        kind: 'order',
        target: t.slot,
      };
  }
  for (const s of m.stations) {
    const dish = stationDish[s.id];
    const cooking = m.stations.filter(
      (x) => x.id === s.id && (x.state === 'cook' || x.state === 'ready'),
    ).length;
    if (s.state !== 'idle' || (wanted.get(dish) ?? 0) - cooking <= 0) continue;
    if (!free(`cook:${s.id}`)) continue;
    return {
      key: `cook:${s.id}`,
      to: counterPoint(s.id),
      kind: dishes[dish].cook === 0 ? 'take' : 'cook',
      counter: s.id,
    };
  }
  const waiting = m.groups
    .filter((g) => g.state === 'queue' && free(`lead:${g.id}`))
    .sort((a, b) => a.patience - b.patience);
  for (const g of waiting) {
    const fits = m.tables.some(
      (t) => t.group < 0 && !t.dirty && t.seats >= g.guests.length,
    );
    if (!fits) continue;
    // Stand just in front of the row.
    const q = QUEUE[g.slot];
    const to: [number, number] = [q.x + 0.3, q.z + 0.6];
    return { key: `lead:${g.id}`, to, kind: 'lead', target: g.id };
  }
  for (const t of m.tables)
    if (t.dirty && t.group < 0 && free(`clear:${t.slot}`))
      return {
        key: `clear:${t.slot}`,
        to: tablePoint(m, t.slot, p.x, p.z),
        kind: 'clear',
        target: t.slot,
      };
  for (const u of m.puddles)
    if (free(`mop:${u.id}`))
      return { key: `mop:${u.id}`, to: [u.x, u.z], kind: 'mop' };
  return null;
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
  const none: Input = { mx: 0, mz: 0, use: false, out: false };
  if (m.phase !== 'open' || p.mop > 0) return none;
  if (mem.wait > 0) {
    mem.wait--;
    return none;
  }
  const job = chooseJob(m, pi, claims, spot);
  if (!job) {
    mem.goal = '';
    return none;
  }
  claims.add(job.key);
  if (job.kind === 'out') {
    const target = outTarget(m, pi);
    if (target === job.target) {
      mem.wait = pause;
      return { ...none, out: true };
    }
  } else {
    const a = actionFor(m, pi);
    const id =
      job.kind === 'lead' ? a?.group : job.counter ? a?.counter : a?.table;
    if (
      a &&
      a.kind === job.kind &&
      !job.key.startsWith('hold') &&
      (job.target === undefined && job.counter === undefined
        ? true
        : id === (job.counter ?? job.target))
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
    Math.hypot(mem.path[0][0] - p.x, mem.path[0][1] - p.z) < 0.12
  )
    mem.path.shift();
  const next = mem.path[0];
  if (!next) {
    // There already: turn to face the job.
    const target =
      job.kind === 'out'
        ? m.guests.find((x) => x.id === job.target)
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
  return { ...none, mx: (dx / d) * slow, mz: (dz / d) * slow };
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
