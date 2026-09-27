import { cards } from '@/lib/games/arena/cards';
import { canPlayAt, TICK, type Match } from '@/lib/games/arena/engine';
import {
  replay,
  checksum,
  type Play,
  type TickMessage,
} from '@/lib/games/arena/net';
import type { ArenaRoomView, ArenaSnapshot } from '@/lib/games/arena/room';
import { api, ApiError, withDevSession } from '@/lib/online/client';
import type { Pending, PlayResult, Session } from './session';

/** Ticks the picture trails the newest tick by, to ride out network jitter. */
const BUFFER = 2.5;
/** A card that has not come back after this long is given up on. */
const PENDING_MS = 4000;

type Sent = Pending & { at: number };

/**
 * An online room kept in lockstep with the server (see lib/games/arena/net.ts).
 * The server streams every tick; this replays the match up to a little behind
 * the newest one, speeding up or easing off to keep that small gap, and takes
 * a fresh snapshot whenever a checksum disagrees.
 */
export class OnlineSession implements Session {
  readonly kind = 'online';
  readonly canPause = false;
  match: Match;
  room: ArenaRoomView;
  /** 'gone' once the room was removed; 'lost' while reconnecting. */
  status: 'live' | 'lost' | 'gone' = 'live';
  /** When the server last refused a card, for a flash on the elixir bar. */
  refused = 0;
  private latest: number;
  private clock: number;
  private plays = new Map<number, Play[]>();
  private sums = new Map<number, number>();
  private sent: Sent[] = [];
  private events: EventSource | null = null;
  private listeners = new Set<() => void>();
  private resyncing = false;
  private disposed = false;

  constructor(
    readonly token: string,
    first: ArenaSnapshot,
  ) {
    this.room = first.room;
    this.match = first.match;
    this.latest = first.horizon;
    this.clock = first.horizon;
    this.connect();
  }

  get round() {
    return this.room.round;
  }
  get you() {
    return this.room.you;
  }
  get side() {
    return this.match.players[this.room.you].side;
  }
  get names() {
    return this.room.seats.map((s) => s.name);
  }
  get host() {
    return this.room.host;
  }

  private path(suffix = '') {
    return `/api/arena/${this.token}${suffix}`;
  }

  private emit() {
    for (const l of this.listeners) l();
  }

  private connect() {
    const events = new EventSource(withDevSession(this.path('/events')));
    this.events = events;
    events.onmessage = (e) => this.tick(JSON.parse(e.data) as TickMessage);
    events.addEventListener('snapshot', (e) =>
      this.adopt(JSON.parse((e as MessageEvent).data) as ArenaSnapshot),
    );
    events.addEventListener('room', (e) => {
      this.room = JSON.parse((e as MessageEvent).data) as ArenaRoomView;
      this.emit();
    });
    events.addEventListener('gone', () => this.gone());
    events.onopen = () => {
      if (this.status !== 'live') {
        this.status = 'live';
        this.emit();
      }
    };
    events.onerror = () => {
      if (this.disposed || this.status === 'gone') return;
      this.status = 'lost';
      this.emit();
      // The stream reconnects by itself; check the room still exists.
      void api<ArenaSnapshot>(this.path())
        .then((s) => this.adopt(s))
        .catch((e) => {
          if (e instanceof ApiError && [403, 404, 410].includes(e.status))
            this.gone();
        });
    };
  }

  private gone() {
    this.status = 'gone';
    this.events?.close();
    this.emit();
  }

  private tick(msg: TickMessage) {
    if (msg.h > this.latest) this.latest = msg.h;
    if (msg.c)
      for (const p of msg.c) {
        if (p[0] <= this.match.tick) continue;
        const list = this.plays.get(p[0]) ?? [];
        list.push(p);
        this.plays.set(p[0], list);
      }
    if (msg.k) this.sums.set(msg.k[0], msg.k[1]);
  }

  /** Start again from the server's own match. */
  private adopt(s: ArenaSnapshot) {
    const newRound = s.room.round !== this.room.round;
    this.room = s.room;
    this.match = s.match;
    if (newRound) {
      this.latest = s.horizon;
      this.plays.clear();
      this.sums.clear();
      this.sent = [];
    } else {
      this.latest = Math.max(this.latest, s.horizon);
      for (const tick of this.plays.keys())
        if (tick <= s.horizon) this.plays.delete(tick);
      for (const tick of this.sums.keys())
        if (tick <= s.horizon) this.sums.delete(tick);
    }
    this.clock = Math.max(s.horizon, this.latest - BUFFER);
    this.status = 'live';
    this.emit();
  }

  private resync() {
    if (this.resyncing) return;
    this.resyncing = true;
    void api<ArenaSnapshot>(this.path())
      .then((s) => this.adopt(s))
      .catch(() => {})
      .finally(() => {
        this.resyncing = false;
      });
  }

  advance(dt: number) {
    const m = this.match;
    const target = this.latest - BUFFER;
    if (target - this.clock > 24) this.clock = target;
    // Ease the playback speed to hold the gap behind the newest tick.
    const rate = Math.min(1.25, Math.max(0.8, 1 + (target - this.clock) * 0.1));
    this.clock = Math.min(this.latest, this.clock + (dt / TICK) * rate);
    const whole = Math.floor(this.clock);
    // Catch up over a few frames rather than freezing on a long replay.
    replay(m, Math.min(whole, m.tick + 240), this.plays, (at) => {
      const want = this.sums.get(at.tick);
      if (want !== undefined) {
        this.sums.delete(at.tick);
        if (checksum(at) !== want) this.resync();
      }
    });
    this.settle();
    return m.tick === whole ? this.clock - whole : 1;
  }

  /** Forget cards that came back in the stream, or never will. */
  private settle() {
    if (!this.sent.length) return;
    const now = Date.now();
    const back = this.match.events.filter(
      (e) => e.type === 'deploy' && e.player === this.you,
    );
    this.sent = this.sent.filter(
      (s) =>
        now - s.at < PENDING_MS &&
        !back.some((e) => e.type === 'deploy' && e.x === s.x && e.y === s.y),
    );
  }

  play(slot: number, x: number, y: number): PlayResult {
    const m = this.match;
    if (m.phase !== 'battle' && m.phase !== 'overtime') return 'phase';
    const seat = m.players[this.you];
    const card = seat.hand.cards[slot];
    if (!card || this.sent.some((s) => s.slot === slot)) return 'card';
    const owed = this.sent.reduce((sum, s) => sum + cards[s.card].cost, 0);
    if (seat.elixir - owed < cards[card].cost) return 'elixir';
    if (!canPlayAt(m, seat.side, card, x, y)) return 'place';
    const sent: Sent = { slot, card, x, y, at: Date.now() };
    this.sent.push(sent);
    void api(this.path('/commands'), {
      round: this.room.round,
      slot,
      x,
      y,
    }).catch(() => {
      this.sent = this.sent.filter((s) => s !== sent);
      this.refused = Date.now();
      this.emit();
    });
    return 'sent';
  }

  pending(): Pending[] {
    return this.sent;
  }

  again() {
    if (!this.room.host || this.room.status !== 'over') return;
    void api(this.path('/again'), {}).catch(() => {});
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  dispose() {
    this.disposed = true;
    this.events?.close();
    this.listeners.clear();
  }
}

/** Opens a room: the first snapshot, then the live stream. */
export async function joinRoom(token: string) {
  const first = await api<ArenaSnapshot>(`/api/arena/${token}`);
  return new OnlineSession(token, first);
}
