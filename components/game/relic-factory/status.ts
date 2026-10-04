import {
  DIRS,
  MACHINES,
  TICK_MS,
  boost,
  machineAt,
  printTicks,
  scratchTicks,
  type FactoryState,
  type Machine,
} from '@/lib/games/relic/factory';
import { level, type ScratchState } from '@/lib/games/relic/scratch';

/** What a machine is doing, as its lamp shows it: working, idle (nothing to
 * do), full (its output waits for room) or stuck (it can never pass on). */
export type MachineStatus = 'work' | 'idle' | 'full' | 'stuck';
export const STATUS_WORD: Record<MachineStatus, string> = {
  work: 'Working',
  idle: 'Idle',
  full: 'Full',
  stuck: 'Stuck',
};

/** A machine holding a ticket it can never pass on: nothing in front, a
 * machine that takes no tickets, or a belt pointing back at it. A queue
 * behind a slow bot is not stuck. */
export function deadEnd(f: FactoryState, m: Machine) {
  if ((m.stuck ?? 0) <= 20 || m.kind === 'splitter') return false;
  const [dx, dy] = DIRS[m.dir],
    next = machineAt(f, m.x + dx, m.y + dy);
  if (!next) return true;
  if (['printer', 'lamp', 'ink', 'charm'].includes(next.kind)) return true;
  const [bx, by] = DIRS[next.dir];
  return (
    MACHINES[next.kind].turns && next.x + bx === m.x && next.y + by === m.y
  );
}

/** The job a machine is on: progress 0–1 at the snapshot and progress per
 * millisecond, so a gauge can run smoothly between ticks. */
export function job(s: ScratchState, f: FactoryState, m: Machine) {
  if (m.kind === 'printer' && !m.output) {
    const ticks = printTicks(m.book ?? 'seven');
    return {
      work: m.t / ticks,
      perMs:
        (1.5 ** level(s, 'printers') * boost(f, m).speed) / ticks / TICK_MS,
    };
  }
  if (m.kind === 'bot' && m.item && !m.output) {
    const ticks = scratchTicks(m.item.book);
    return {
      work: m.t / ticks,
      perMs: (1.5 ** level(s, 'bots') * boost(f, m).speed) / ticks / TICK_MS,
    };
  }
  if ((m.kind === 'stamper' || m.kind === 'gilder') && m.item && !m.output)
    return { work: m.t / 2, perMs: 1 / 2 / TICK_MS };
  if (m.kind === 'bundler' && (m.hold?.length ?? 0) >= 3 && !m.output)
    return { work: m.t / 2, perMs: 1 / 2 / TICK_MS };
  return null;
}

const BOOSTS = { lamp: 'bot', ink: 'printer', charm: 'printer' } as const;
/** The machines a booster is helping. */
export function boosted(f: FactoryState, m: Machine) {
  const target = BOOSTS[m.kind as keyof typeof BOOSTS];
  if (!target) return [];
  return DIRS.map(([dx, dy]) => machineAt(f, m.x + dx, m.y + dy)).filter(
    (n): n is Machine => n?.kind === target,
  );
}

/** A machine's state at a snapshot. Cashiers are working while they sell,
 * which only the floor sees; here they count as idle. */
export function statusOf(f: FactoryState, m: Machine): MachineStatus {
  switch (m.kind) {
    case 'lamp':
    case 'ink':
    case 'charm':
      return boosted(f, m).length ? 'work' : 'idle';
    case 'belt':
    case 'splitter':
    case 'cashier':
      return m.item && (m.stuck ?? 0) > 2 ? 'full' : 'idle';
  }
  if (m.output)
    return deadEnd(f, m) ? 'stuck' : (m.stuck ?? 0) > 2 ? 'full' : 'work';
  if (m.kind === 'printer') return 'work';
  if (m.kind === 'bundler') return (m.hold?.length ?? 0) >= 3 ? 'work' : 'idle';
  return m.item ? 'work' : 'idle';
}
