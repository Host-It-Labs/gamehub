import {
  createMatch,
  open,
  step,
  TICK,
  type DinerEvent,
  type Input,
  type Match,
} from '@/lib/games/diner/engine';
import type { NightId } from '@/lib/games/diner/content';

/** What the controls hold between frames: the stick, and presses not yet used. */
export type Controls = {
  mx: number;
  mz: number;
  use: boolean;
  out: boolean;
};

/**
 * A shift being played: on this device against nobody (solo), or in an
 * online room (online.ts). The screen asks it to move time on, reads the
 * match it should draw and the events to play.
 */
export interface Session {
  readonly kind: 'solo' | 'online';
  readonly canPause: boolean;
  /** Your waiter. */
  readonly you: number;
  readonly names: string[];
  /** You start the next shift. */
  readonly host: boolean;
  /** Changes when a new shift starts. */
  readonly round: number;
  night: NightId;
  /** The match to draw this frame. */
  readonly match: Match;
  /** Moves time on; returns how far between two steps to draw (0..1). */
  advance(dt: number, paused: boolean, controls: Controls): number;
  /** Events since the last call. */
  drain(): DinerEvent[];
  /** Opens the doors (solo; online rooms open themselves). */
  start(): void;
  again(night?: NightId): void;
  subscribe(listener: () => void): () => void;
  dispose(): void;
}

function seed() {
  return crypto.getRandomValues(new Uint32Array(1))[0];
}

export class SoloSession implements Session {
  readonly kind = 'solo';
  readonly canPause = true;
  readonly you = 0;
  readonly names = ['You'];
  readonly host = true;
  round = 1;
  match: Match;
  private acc = 0;
  private events: DinerEvent[] = [];
  private listeners = new Set<() => void>();
  constructor(public night: NightId) {
    this.match = createMatch(seed(), night, this.names);
  }
  advance(dt: number, paused: boolean, c: Controls) {
    if (paused) return 1;
    this.acc = Math.min(this.acc + dt, TICK * 6);
    while (this.acc >= TICK) {
      this.acc -= TICK;
      const input: Input = { mx: c.mx, mz: c.mz, use: c.use, out: c.out };
      c.use = false;
      c.out = false;
      step(this.match, [input]);
      if (this.match.events.length)
        this.events.push(...this.match.events.splice(0));
    }
    return this.acc / TICK;
  }
  drain() {
    return this.events.splice(0);
  }
  start() {
    open(this.match);
    this.events.push(...this.match.events.splice(0));
  }
  again(night: NightId = this.night) {
    this.night = night;
    this.match = createMatch(seed(), night, this.names);
    this.round++;
    this.acc = 0;
    this.events = [];
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
