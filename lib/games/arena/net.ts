import { allCards } from './cards.ts';
import {
  ARENA_MATCH_VERSION,
  deploy,
  step,
  upgradeMatch,
  type Match,
} from './engine.ts';

/**
 * Online Arena runs in lockstep. The server owns the clock and the one true
 * match: it steps it thirty times a second, plays every card at the start of
 * the tick after it arrives, and streams each tick's number with the cards
 * played on it. Every device runs the same simulation on the same cards, so
 * the battles match without sending troop positions. Now and then the server
 * adds a checksum; a device that drifted takes a fresh snapshot.
 */

/** A card played on a tick: [tick, player, slot, x, y]. */
export type Play = [number, number, number, number, number];

/** One server message per step: the newest tick, cards and a checksum. */
export type TickMessage = {
  /** Every tick up to this one is final. */
  h: number;
  c?: Play[];
  /** [tick, checksum] of the match after that tick's cards. */
  k?: [number, number];
};

/** How often, in ticks, the server sends a checksum. */
export const CHECK_EVERY = 30;

/** Plays the cards recorded for the match's current tick. */
export function applyPlays(m: Match, plays: Play[]) {
  for (const [tick, player, slot, x, y] of plays)
    if (tick === m.tick) deploy(m, player, slot, x, y);
}

/**
 * Steps a match forward to `tick`, playing each tick's cards after the step
 * that reaches it, exactly as the server did.
 */
export function replay(
  m: Match,
  tick: number,
  plays: Map<number, Play[]>,
  onTick?: (m: Match) => void,
) {
  // A restored match may already be at this tick (or finished), so migration
  // cannot rely solely on stepping the clock forward.
  if (m.version !== ARENA_MATCH_VERSION) upgradeMatch(m);
  while (m.tick < tick && m.phase !== 'over') {
    step(m);
    const due = plays.get(m.tick);
    if (due) {
      applyPlays(m, due);
      plays.delete(m.tick);
    }
    onTick?.(m);
  }
}

// FNV-1a over the bytes of each number, so a one-bit drift shows.
const buffer = new DataView(new ArrayBuffer(8));
function mix(h: number, v: number) {
  buffer.setFloat64(0, v);
  for (let i = 0; i < 8; i++) h = Math.imul(h ^ buffer.getUint8(i), 16777619);
  return h;
}

/**
 * A fingerprint of everything that decides the battle. Facing is left out:
 * it is only a drawing hint and uses trigonometry that browsers round
 * differently. The Dino's arithmetic body direction is authoritative.
 */
export function checksum(m: Match) {
  let h = 2166136261;
  h = mix(h, m.version);
  h = mix(h, m.tick);
  h = mix(h, m.nextId);
  h = mix(h, m.crowns[0] * 4 + m.crowns[1]);
  for (const p of m.players) {
    h = mix(h, p.elixir);
    h = mix(h, p.hand.cards.length + p.hand.queue.length);
    // The hand and deck order, so a card played on one device only shows.
    for (const id of p.hand.cards) h = mix(h, allCards.indexOf(id));
    for (const id of p.hand.queue) h = mix(h, allCards.indexOf(id));
  }
  for (const u of m.units) {
    h = mix(h, u.id);
    h = mix(h, u.x);
    h = mix(h, u.y);
    h = mix(h, u.hp);
    h = mix(h, u.attackTimer);
    h = mix(h, u.targetId ?? -1);
    h = mix(h, u.shield);
    h = mix(h, u.maxShield);
    h = mix(h, u.shieldDelay);
    h = mix(h, u.stun);
    if (u.card === 'ogre') {
      const direction = u.bodyDirection ?? [0, u.side === 0 ? 1 : -1];
      h = mix(h, direction[0]);
      h = mix(h, direction[1]);
    }
    h = mix(h, u.detour ? 1 : 0);
    if (u.detour) {
      h = mix(h, u.detour.x);
      h = mix(h, u.detour.y);
      h = mix(h, u.detour.target ?? -1);
    }
  }
  for (const t of m.towers) {
    h = mix(h, t.hp);
    h = mix(h, t.cooldown);
    h = mix(h, t.targetId ?? -1);
  }
  for (const p of m.projectiles) {
    h = mix(h, p.x);
    h = mix(h, p.y);
    // Launch height and shot kind decide whether a facade is solid.
    h = mix(h, p.sz);
    h = mix(h, p.kind.length);
    for (let i = 0; i < p.kind.length; i++) h = mix(h, p.kind.charCodeAt(i));
  }
  // Falling spells: where and when each one lands.
  h = mix(h, m.spells.length);
  for (const s of m.spells) {
    h = mix(h, s.id);
    h = mix(h, s.x);
    h = mix(h, s.y);
    h = mix(h, s.left);
  }
  return h >>> 0;
}

/** A copy of the match to send: plain data without pending events. */
export function snapshot(m: Match): Match {
  return structuredClone({ ...m, events: [] });
}
