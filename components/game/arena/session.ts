import type { CardId } from '@/lib/games/arena/cards';
import { presetFor } from '@/lib/games/arena/decks';
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
  type MatchOptions,
  type Mode,
  type Side,
} from '@/lib/games/arena/engine';
import { botMemory, botStep, type BotMemory } from '@/lib/games/arena/bot';
import {
  advance as advanceDraft,
  choose as chooseDraft,
  decksOf,
  draftView,
  holdClock,
  newDraft,
  type Draft,
  type DraftView,
} from '@/lib/games/arena/draft';
import type { ArenaDecks } from '@/lib/games/arena/room';

/**
 * The deck phase before a Versus battle, as the screen shows it: every
 * player picking a deck (`ready` per seat, the cap's end on this device's
 * `performance.now()` clock, 0 while it has not started), or the draft
 * (`at` is when `view.left` was measured).
 */
export type DeckPhase =
  | { kind: 'pick'; ready: boolean[]; ends: number }
  | { kind: 'draft'; view: DraftView | null; at: number };

export type PlayResult =
  | 'ok'
  | 'sent'
  | Extract<DeployResult, { ok: false }>['reason'];

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
  /** The deck phase before this battle, or null once the decks are in.
   *  The same object until it changes. */
  readonly phase: DeckPhase | null;
  /** Your deck in the deck phase; `ready` once you picked it and the
   *  battle has loaded on this device. */
  chooseDeck(deck: CardId[], ready: boolean): void;
  /** Your cards kept this draft round so far; two lock them in. */
  draftPick(picks: CardId[]): void;
  /** The battle has loaded on this device. */
  loaded(): void;
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

/** What a battle on this device may bring beyond the defaults: your deck,
 *  or a whole Quest setup (every seat's deck and boost, a foe's name). */
export type SoloSetup = {
  /** Your deck (Versus); bots then draw a ready-made one each. */
  deck?: CardId[];
  /** Every seat set up in full (Quest). */
  options?: MatchOptions;
  /** Names for the bot seats, overriding the difficulty's. */
  foe?: string;
  /** Versus: pick the deck before each battle, or draft every seat's. */
  decks?: ArenaDecks;
};

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
  phase: DeckPhase | null = null;
  private draft: Draft | null = null;
  /** Every seat's deck from the last draft. */
  private drafted: CardId[][] | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  /** Watches for stalls (the battle loading) that the draft clock skips. */
  private beat: ReturnType<typeof setInterval> | null = null;

  constructor(
    readonly difficulty: Difficulty,
    readonly mode: Mode,
    readonly setup: SoloSetup = {},
  ) {
    const bots = seatCount(mode) - 1;
    this.names = [
      'You',
      ...Array.from({ length: bots }, (_, i) =>
        mode === 'team' && sideOf(i + 1) === 0
          ? 'Ally'
          : setup.foe
            ? setup.foe
            : botName(difficulty, i === 0 ? 0 : 1, mode === 'team' ? 2 : 1),
      ),
    ];
    this.match = this.fresh();
    if (setup.decks && !setup.options) this.openPhase();
  }

  /** Before the battle: pick your deck, or draft with the bots. */
  private openPhase() {
    const seats = seatCount(this.mode);
    this.drafted = null;
    if (this.setup.decks === 'draft') {
      const now = performance.now();
      this.draft = newDraft(
        crypto.getRandomValues(new Uint32Array(1))[0],
        this.mode,
        Array.from({ length: seats }, (_, i) => i !== this.you),
        now,
      );
      // Time this device could not show the draft (a long stall while the
      // battle decodes) does not count against the clock.
      let last = now;
      if (this.beat) clearInterval(this.beat);
      this.beat = setInterval(() => {
        const t = performance.now();
        const stall = t - last - 100;
        last = t;
        if (!this.draft) return;
        if (stall > 150) {
          this.draft = holdClock(this.draft, stall);
          this.driveDraft();
        }
      }, 100);
      this.driveDraft();
    } else
      this.phase = {
        kind: 'pick',
        ready: Array.from({ length: seats }, (_, i) => i !== this.you),
        ends: 0,
      };
  }

  private driveDraft() {
    if (!this.draft) return;
    const now = performance.now();
    this.draft = advanceDraft(this.draft, now);
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (this.draft.stage === 'done') {
      this.drafted = decksOf(this.draft);
      this.draft = null;
      if (this.beat) clearInterval(this.beat);
      this.beat = null;
      return this.startBattle();
    }
    this.phase = {
      kind: 'draft',
      view: draftView(this.draft, this.you, now),
      at: now,
    };
    this.timer = setTimeout(
      () => this.driveDraft(),
      Math.max(0, this.draft.endsAt - now) + 5,
    );
    this.emit();
  }

  private startBattle() {
    this.phase = null;
    this.match = this.fresh();
    this.round++;
    this.emit();
  }

  private emit() {
    for (const l of this.listeners) l();
  }

  chooseDeck(deck: CardId[], ready: boolean) {
    if (this.phase?.kind !== 'pick') return;
    this.setup.deck = deck;
    if (ready) this.startBattle();
  }

  draftPick(picks: CardId[]) {
    if (!this.draft) return;
    const next = chooseDraft(this.draft, this.you, picks, performance.now());
    if (!next) return;
    this.draft = next;
    this.driveDraft();
  }

  loaded() {}

  private options(seed: number): MatchOptions {
    if (this.setup.options) return this.setup.options;
    // Versus: your deck, and each bot (an ally too) a ready-made deck of
    // its own; after a draft, everyone's drafted eight.
    if (this.drafted) return { decks: this.drafted };
    const seats = seatCount(this.mode);
    return {
      decks: Array.from({ length: seats }, (_, i) =>
        i === this.you ? this.setup.deck : presetFor(seed + i * 7).cards,
      ),
    };
  }

  private fresh() {
    const seed = crypto.getRandomValues(new Uint32Array(1))[0];
    const m = createMatch(seed, this.difficulty, this.mode, this.options(seed));
    this.bots = m.players
      .map((_, i) => i)
      .filter((i) => i !== this.you)
      .map((i) => botMemory(i, this.difficulty, seed));
    this.acc = 0;
    return m;
  }

  advance(dt: number, paused: boolean) {
    const m = this.match;
    if (paused || this.phase || m.phase === 'over') return 1;
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
    // Each Versus battle opens with its own deck pick or draft.
    if (this.setup.decks && !this.setup.options) this.openPhase();
    this.emit();
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  dispose() {
    if (this.timer) clearTimeout(this.timer);
    if (this.beat) clearInterval(this.beat);
    this.timer = this.beat = null;
    this.listeners.clear();
  }
}
