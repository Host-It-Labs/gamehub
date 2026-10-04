import type { Unit } from '@/lib/games/arena/engine';
import type { UnitStats } from '@/lib/games/arena/cards';

export type TroopStatus =
  | 'stun'
  | 'slow'
  | 'taunt'
  | 'haste'
  | 'shield'
  | 'rage';

/** Read the live simulation, including after a reconnect. Event latches
 * (notably `raged`) do not describe how long an effect is active. */
export function activeStatuses(u: Unit, stats: UnitStats): TroopStatus[] {
  if (u.hp <= 0) return [];
  const out: TroopStatus[] = [];
  if (u.stun > 0) out.push('stun');
  if (u.slow > 0 && u.slowFactor < 1) out.push('slow');
  if (u.taunt > 0 && u.tauntId !== null) out.push('taunt');
  if (u.beat > 1) out.push('haste');
  if (stats.shield && u.shield > 0) out.push('shield');
  if (stats.rage && u.hp < u.maxHp * stats.rage.below) out.push('rage');
  return out;
}
