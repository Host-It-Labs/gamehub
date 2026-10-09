import {
  movePlayer,
  quantize,
  TICK,
  type DinerEvent,
  type Input,
  type Match,
  type Player,
} from '@/lib/games/diner/engine';
import { levelConfig } from '@/lib/games/diner/levels';
import {
  encodeFrame,
  unpackMatch,
  type DinerJoin,
  type DinerRoomView,
  type DinerSnapshot,
} from '@/lib/games/diner/room';
import { api, ApiError, withDevSession } from '@/lib/online/client';
import type { Controls, Session } from './session';

/** Server steps the others are drawn behind the newest snapshot. */
const DELAY = 4.5;
/** How often your input steps go out (ms). */
const SEND_MS = 50;

type Snap = { n: number; m: Match };

/**
 * An online shift. The server owns the match; this device sends its own
 * input steps and runs its own waiter's movement straight away (the same
 * code as the server), then, as each snapshot says which steps the server
 * has applied, starts again from the server's position and replays the
 * rest, easing any small difference away. Everyone else is drawn a few
 * steps behind the newest snapshot, between the two around that moment.
 */
export class OnlineSession implements Session {
  readonly kind = 'online';
  readonly canPause = false;
  room: DinerRoomView;
  link: 'live' | 'lost' | 'gone' = 'live';
  private snaps: Snap[] = [];
  private latest = 0;
  private clockN = 0;
  private events: DinerEvent[] = [];
  private listeners = new Set<() => void>();
  private source: EventSource | null = null;
  private disposed = false;
  // Your own waiter.
  private seq = 0;
  private history: { seq: number; input: Input }[] = [];
  private pred: Player | null = null;
  private base: Match;
  private acc = 0;
  private offset: [number, number] = [0, 0];
  private lastSend = 0;
  private inflight = 0;
  private render: Match;
  /** The round of the match being shown; it changes only with a new match in hand. */
  private shown: number;

  constructor(
    readonly token: string,
    join: DinerJoin,
  ) {
    this.room = join.room;
    const m = unpackMatch(join.snap.m, levelConfig(join.room.level));
    this.base = m;
    this.render = m;
    this.shown = join.snap.round;
    this.adopt(join.snap);
    this.connect();
  }

  get match() {
    return this.render;
  }
  get you() {
    return this.room.you;
  }
  get names() {
    return this.room.seats.map((s) => s.name);
  }
  get host() {
    return this.room.host;
  }
  get round() {
    return this.shown;
  }
  get level() {
    return this.room.level;
  }

  private path(suffix = '') {
    return `/api/diner/${this.token}${suffix}`;
  }
  private emit() {
    for (const l of this.listeners) l();
  }

  private connect() {
    const source = new EventSource(withDevSession(this.path('/events')));
    this.source = source;
    source.addEventListener('snap', (e) =>
      this.adopt(JSON.parse((e as MessageEvent).data) as DinerSnapshot),
    );
    source.addEventListener('room', (e) => {
      const next = JSON.parse((e as MessageEvent).data) as DinerRoomView;
      const fresh = next.round !== this.room.round;
      this.room = next;
      if (fresh) this.reset();
      this.emit();
    });
    source.addEventListener('gone', () => this.gone());
    source.onopen = () => {
      if (this.link !== 'live') {
        this.link = 'live';
        this.emit();
      }
    };
    source.onerror = () => {
      if (this.disposed || this.link === 'gone') return;
      this.link = 'lost';
      this.emit();
      void api<DinerJoin>(this.path())
        .then((j) => {
          this.room = j.room;
          this.adopt(j.snap);
        })
        .catch((e) => {
          if (e instanceof ApiError && [403, 404, 410].includes(e.status))
            this.gone();
        });
    };
  }

  private gone() {
    this.link = 'gone';
    this.source?.close();
    this.emit();
  }

  /** A new shift: forget the old one's steps and snapshots. */
  private reset() {
    this.snaps = [];
    this.history = [];
    this.seq = 0;
    this.pred = null;
    this.offset = [0, 0];
    this.latest = 0;
  }

  private adopt(s: DinerSnapshot) {
    if (s.round !== this.room.round) {
      if (s.round < this.room.round) return;
      this.room = { ...this.room, round: s.round };
      this.reset();
    }
    const m = unpackMatch(s.m, levelConfig(this.room.level));
    // A new shift is shown only once its own match is here, so the room is
    // never rebuilt from the previous night's booths and machines.
    const fresh = s.round !== this.shown;
    if (fresh) {
      this.shown = s.round;
      this.render = m;
      queueMicrotask(() => this.emit());
    }
    if (s.e.length) this.events.push(...s.e);
    this.snaps.push({ n: s.n, m });
    if (this.snaps.length > 12) this.snaps.shift();
    this.latest = Math.max(this.latest, s.n);
    if (Math.abs(this.clockN - (this.latest - DELAY)) > 24)
      this.clockN = this.latest - DELAY;
    this.base = m;
    // Start your waiter again from where the server has it, then replay
    // the steps it has not applied yet.
    const you = this.room.you;
    const server = m.players[you];
    if (!server) return;
    const ack = s.a[you] ?? 0;
    // After a refresh the server already holds this round's earlier steps:
    // carry on numbering above them, or new steps would be ignored.
    if (ack > this.seq) this.seq = ack;
    this.history = this.history.filter((h) => h.seq > ack);
    const before = this.pred
      ? [this.pred.x + this.offset[0], this.pred.z + this.offset[1]]
      : null;
    this.pred = { ...server, trail: [] };
    const scratch: Match = {
      ...m,
      players: m.players.map((p, i) => (i === you ? this.pred! : p)),
    };
    if (m.phase !== 'over')
      for (const h of this.history) movePlayer(scratch, you, h.input);
    if (before) {
      const dx = before[0] - this.pred.x;
      const dz = before[1] - this.pred.z;
      // A big jump (a goo puddle, a stall) snaps; small ones ease away.
      this.offset = Math.hypot(dx, dz) > 1.2 ? [0, 0] : [dx, dz];
    }
  }

  advance(dt: number, _paused: boolean, c: Controls) {
    const you = this.room.you;
    // Your own steps, thirty a second, moved at once and sent.
    this.acc = Math.min(this.acc + dt, TICK * 6);
    while (this.acc >= TICK) {
      this.acc -= TICK;
      const [mx, mz] = quantize(c.mx, c.mz);
      const input: Input = { mx, mz, use: c.use, out: c.out, dash: !!c.dash };
      c.use = false;
      c.out = false;
      c.dash = false;
      this.seq++;
      this.history.push({ seq: this.seq, input });
      if (this.history.length > 120) this.history.shift();
      if (this.pred && this.base.phase !== 'over') {
        const scratch: Match = {
          ...this.base,
          players: this.base.players.map((p, i) =>
            i === you ? this.pred! : p,
          ),
        };
        movePlayer(scratch, you, input);
      }
    }
    const now = performance.now();
    if (
      now - this.lastSend >= SEND_MS &&
      this.history.length &&
      this.inflight < 2 &&
      this.link !== 'gone'
    ) {
      this.lastSend = now;
      this.inflight++;
      const frames = this.history
        .slice(-20)
        .map((h) => encodeFrame(h.seq, h.input));
      void api(this.path('/input'), { round: this.room.round, frames })
        .catch(() => {})
        .finally(() => this.inflight--);
    }
    // Everyone else a few steps behind the newest snapshot.
    const target = this.latest - DELAY;
    const rate = Math.min(
      1.25,
      Math.max(0.8, 1 + (target - this.clockN) * 0.08),
    );
    this.clockN += (dt / TICK) * rate;
    let a = this.snaps[0];
    let b = this.snaps[this.snaps.length - 1];
    for (let i = 0; i < this.snaps.length; i++)
      if (this.snaps[i].n >= this.clockN) {
        b = this.snaps[i];
        a = this.snaps[Math.max(0, i - 1)];
        break;
      }
    if (!b) return 1;
    const span = b.n - a.n;
    const alpha =
      span > 0 ? Math.max(0, Math.min(1, (this.clockN - a.n) / span)) : 1;
    const r = b.m;
    if (a !== b) {
      const before = new Map(a.m.guests.map((g) => [g.id, g]));
      for (const g of r.guests) {
        const p = before.get(g.id);
        g.px = p ? p.x : g.x;
        g.pz = p ? p.z : g.z;
      }
      r.players.forEach((p, i) => {
        const q = a.m.players[i];
        p.px = q ? q.x : p.x;
        p.pz = q ? q.z : p.z;
      });
    }
    // Your waiter: predicted, with the latest server state for what it holds.
    const mine = r.players[you];
    if (mine && this.pred) {
      this.offset[0] *= Math.pow(0.002, dt);
      this.offset[1] *= Math.pow(0.002, dt);
      const x = this.pred.x + this.offset[0];
      const z = this.pred.z + this.offset[1];
      const latest = this.base.players[you];
      mine.x = mine.px = x;
      mine.z = mine.pz = z;
      mine.fx = this.pred.fx;
      mine.fz = this.pred.fz;
      mine.moving = this.pred.moving;
      if (latest) {
        mine.hands = latest.hands;
        mine.lead = latest.lead;
        mine.mop = latest.mop;
        mine.mopping = latest.mopping;
      }
    }
    this.render = r;
    return alpha;
  }

  drain() {
    return this.events.splice(0);
  }
  start() {
    // The room opens the doors once everyone is here.
  }
  again(level?: number) {
    if (!this.room.host) return;
    void api(this.path('/again'), level ? { level } : {}).catch(() => {});
  }
  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  dispose() {
    this.disposed = true;
    this.source?.close();
    this.listeners.clear();
  }
}

/** Opens a room: the first snapshot, then the live stream. */
export async function joinDiner(token: string) {
  const join = await api<DinerJoin>(`/api/diner/${token}`);
  return new OnlineSession(token, join);
}
