import type { CardId } from '@/lib/games/arena/cards';
import {
  TICK,
  createMatch,
  deploy,
  seatCount,
  sideOf,
  step,
  type DeployResult,
  type Difficulty,
  type Match,
  type Mode,
  type Side,
} from '@/lib/games/arena/engine';
import { botMemory, botStep, type BotMemory } from '@/lib/games/arena/bot';

export type PlayResult = 'ok' | 'sent' | Extract<DeployResult, { ok: false }>['reason'];

/** A card sent to the server and not yet back in the stream. */
export type Pending = { slot: number; card: CardId; x: number; y: number };

/**
 * What the battle screen drives: a match on this device against bots, or an
 * online room kept in lockstep with the server (online.ts). The screen asks
 * for the match each frame, since a resync or a new battle replaces it.
 */
export interface Session {
  readonly kind: 'solo' | 'online';
  readonly match: Match;
  /** Changes when a new battle starts in the same session. */
  readonly round: number;
  /** The viewer's seat and side. */
  readonly you: number;
  readonly side: Side;
  /** A name per seat. */
  readonly names: string[];
  readonly canPause: boolean;
  /** Whether the viewer may start the next battle. */
  readonly host: boolean;
  /** Advances by `dt` seconds of real time; returns how far into the next
   *  tick the picture is, for smooth drawing. */
  advance(dt: number, paused: boolean): number;
  play(slot: number, x: number, y: number): PlayResult;
  /** Cards on their way to the server (online only). */
  pending(): Pending[];
  again(): void;
  /** Called with nothing when anything outside the match changes. */
  subscribe(listener: () => void): () => void;
  dispose(): void;
}

const botNames: Record<Difficulty, string> = {
  easy: 'Rook',
  medium: 'Warden',
  hard: 'Marshal',
};

/** Names for bot seats: one per difficulty, numbered when two share it. */
export function botName(level: Difficulty, index: number, of: number) {
  return of > 1 ? `${botNames[level]} ${index + 1}` : botNames[level];
}

/** A battle on this device: you in seat 0, bots everywhere else. */
export class SoloSession implements Session {
  readonly kind = 'solo';
  readonly you = 0;
  readonly side: Side = 0;
  readonly canPause = true;
  readonly host = true;
  round = 0;
  match: Match;
  names: string[];
  private bots: BotMemory[] = [];
  private acc = 0;
  private listeners = new Set<() => void>();

  constructor(
    readonly difficulty: Difficulty,
    readonly mode: Mode,
  ) {
    const bots = seatCount(mode) - 1;
    this.names = [
      'You',
      ...Array.from({ length: bots }, (_, i) =>
        mode === 'team' && sideOf(i + 1) === 0
          ? 'Ally'
          : botName(difficulty, i === 0 ? 0 : 1, mode === 'team' ? 2 : 1),
      ),
    ];
    this.match = this.fresh();
  }

  private fresh() {
    const seed = crypto.getRandomValues(new Uint32Array(1))[0];
    const m = createMatch(seed, this.difficulty, this.mode);
    this.bots = m.players
      .map((_, i) => i)
      .filter((i) => i !== this.you)
      .map((i) => botMemory(i, this.difficulty, seed));
    this.acc = 0;
    return m;
  }

  advance(dt: number, paused: boolean) {
    const m = this.match;
    if (paused || m.phase === 'over') return 1;
    this.acc += dt;
    while (this.acc >= TICK) {
      for (const mem of this.bots) {
        const move = botStep(m, mem);
        if (move) deploy(m, move.player, move.slot, move.x, move.y);
      }
      step(m);
      this.acc -= TICK;
    }
    return this.acc / TICK;
  }

  play(slot: number, x: number, y: number): PlayResult {
    const result = deploy(this.match, this.you, slot, x, y);
    return result.ok ? 'ok' : result.reason;
  }

  pending() {
    return [];
  }

  again() {
    this.match = this.fresh();
    this.round++;
    for (const l of this.listeners) l();
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  dispose() {
    this.listeners.clear();
  }
}
