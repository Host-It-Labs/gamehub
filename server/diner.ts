import type { IncomingMessage, ServerResponse } from 'node:http';
import { randomInt } from 'node:crypto';
import { check, token, type Identity } from './auth.ts';
import { MAX_PLAYERS } from '../lib/games/diner/content.ts';
import { isLevelId, levelConfig } from '../lib/games/diner/levels.ts';
import {
  createConfiguredMatch,
  idle,
  movePlayer,
  open,
  step,
  type DinerEvent,
  type Input,
  type Match,
} from '../lib/games/diner/engine.ts';
import {
  decodeFrame,
  JOIN_MS,
  packMatch,
  validFrame,
  type DinerJoin,
  type DinerRoomView,
  type Frame,
} from '../lib/games/diner/room.ts';

/**
 * Online Diner rooms. A table launches a room with its people as waiters;
 * the server owns the one true shift and steps it thirty times a second.
 * Each device sends its own input steps (the stick and its presses) about
 * twenty times a second, and the server applies one step per tick from each
 * waiter's queue, so a device can replay its own steps exactly to predict
 * its waiter. Everyone gets a compact snapshot about twelve times a second
 * and draws the others from it. A waiter whose device is away stands still.
 * Rooms live in memory; a restart ends the running shifts.
 */
export type DinerOptions = {
  /** Milliseconds per step; tests run the clock faster. */
  tickMs?: number;
  /** How long a new shift waits for everyone's stream before opening anyway. */
  joinMs?: number;
  /** How long a room may sit with nobody watching before it is removed. */
  idleMs?: number;
  /** Whether a stream's session is still signed in, checked on each heartbeat. */
  authorized?: (req: IncomingMessage) => boolean;
};

type Stream = {
  req: IncomingMessage;
  res: ServerResponse;
  id: string;
  session: string;
};
type Seat = {
  id: string;
  name: string;
  /** Input steps waiting to be applied, oldest first. */
  queue: Frame[];
  /** The highest step received, and the last one applied. */
  received: number;
  applied: number;
  /** The last movement, held briefly if steps run late. */
  last: Input;
  late: number;
};
export type DinerRoom = {
  token: string;
  table: string | null;
  owner: string;
  level: number;
  seats: Seat[];
  status: DinerRoomView['status'];
  round: number;
  match: Match;
  /** Server steps since the room started (the snapshot clock). */
  n: number;
  /** Events since the last snapshot. */
  events: DinerEvent[];
  streams: Set<Stream>;
  startAt: number;
  joinTimer: ReturnType<typeof setTimeout> | null;
  emptySince: number | null;
};

const clock = () => performance.now();
/** How many steps a late device's last movement is held for. */
const HOLD = 4;

export class DinerRooms {
  readonly rooms = new Map<string, DinerRoom>();
  private readonly tickMs: number;
  private readonly joinMs: number;
  private readonly idleMs: number;
  private readonly authorized?: (req: IncomingMessage) => boolean;
  private pump: ReturnType<typeof setInterval> | null = null;
  private readonly heartbeat: ReturnType<typeof setInterval>;
  private readonly sweeper: ReturnType<typeof setInterval>;
  private stopping = false;

  constructor(options: DinerOptions = {}) {
    this.tickMs = options.tickMs ?? 1000 / 30;
    this.joinMs = options.joinMs ?? JOIN_MS;
    this.idleMs = options.idleMs ?? 10 * 60_000;
    this.authorized = options.authorized;
    this.heartbeat = setInterval(() => {
      for (const room of this.rooms.values())
        for (const s of room.streams) {
          if (this.authorized && !this.authorized(s.req)) {
            this.write(s, 'event: revoked\ndata: {}\n\n');
            s.res.end();
          } else this.write(s, ': heartbeat\n\n');
        }
    }, 15000);
    this.heartbeat.unref();
    this.sweeper = setInterval(
      () => this.sweep(),
      Math.min(30_000, this.idleMs),
    );
    this.sweeper.unref();
  }

  /** Opens a room for a table's people (one to four), the host first. */
  launch(
    table: string,
    owner: string,
    members: { id: string; name: string }[],
    input: Record<string, unknown>,
  ) {
    check(isLevelId(input.level), 400, 'Choose a level.');
    check(
      members.length >= 1 && members.length <= MAX_PLAYERS,
      409,
      `Diner seats one to ${MAX_PLAYERS} waiters.`,
    );
    const people = [
      ...members.filter((m) => m.id === owner),
      ...members.filter((m) => m.id !== owner),
    ];
    // A table runs one shift at a time; its earlier room is let go.
    for (const room of this.rooms.values())
      if (room.table === table) this.remove(room);
    check(
      this.rooms.size < 1000,
      503,
      'Too many diners are open. Please try again soon.',
    );
    const level = input.level as number;
    const room: DinerRoom = {
      token: token(),
      table,
      owner,
      level,
      seats: people.map((p) => ({
        id: p.id,
        name: p.name,
        queue: [],
        received: 0,
        applied: 0,
        last: idle,
        late: 0,
      })),
      status: 'waiting',
      round: 1,
      match: createConfiguredMatch(
        randomInt(1, 2 ** 31),
        levelConfig(level),
        people.map((p) => p.name),
      ),
      n: 0,
      events: [],
      streams: new Set(),
      startAt: clock(),
      joinTimer: null,
      emptySince: Date.now(),
    };
    this.rooms.set(room.token, room);
    this.arm(room);
    return room.token;
  }

  /** Starts the shift once everyone is here, or after the join wait. */
  private arm(room: DinerRoom) {
    if (room.joinTimer) clearTimeout(room.joinTimer);
    room.joinTimer = setTimeout(() => this.begin(room), this.joinMs);
    room.joinTimer.unref?.();
  }

  private begin(room: DinerRoom) {
    if (
      this.stopping ||
      room.status !== 'waiting' ||
      !this.rooms.has(room.token)
    )
      return;
    if (room.joinTimer) clearTimeout(room.joinTimer);
    room.joinTimer = null;
    room.status = 'playing';
    open(room.match, true);
    this.ensurePump();
    this.broadcastRoom(room);
  }

  private ensurePump() {
    if (this.pump) return;
    this.pump = setInterval(() => this.advance(), 5);
    this.pump.unref();
  }

  private advance() {
    const now = clock();
    let running = false;
    for (const room of this.rooms.values()) {
      // Before the doors open, waiters who are here can already walk about.
      const live =
        room.status === 'playing' ||
        (room.status === 'waiting' && room.streams.size > 0);
      if (!live) {
        room.startAt = now - room.n * this.tickMs;
        continue;
      }
      const target = Math.floor((now - room.startAt) / this.tickMs);
      for (let k = 0; k < 30 && room.status !== 'over' && room.n < target; k++)
        this.tick(room);
      if (room.status !== 'over') running = true;
    }
    if (!running && this.pump) {
      clearInterval(this.pump);
      this.pump = null;
    }
  }

  /** One server step: each waiter's next input, the rules, maybe a snapshot. */
  private tick(room: DinerRoom) {
    const m = room.match;
    const inputs = room.seats.map((seat, i) => {
      if (!seat.queue.length) {
        // Running late: keep walking a moment, then stand still.
        seat.late++;
        return seat.late <= HOLD
          ? { ...seat.last, use: false, out: false }
          : idle;
      }
      seat.late = 0;
      // A device that ran ahead catches up two or three steps at a time.
      const take = seat.queue.length > 12 ? 3 : seat.queue.length > 5 ? 2 : 1;
      let use = false;
      let out = false;
      let input: Input = idle;
      for (let k = 0; k < take && seat.queue.length; k++) {
        const f = seat.queue.shift()!;
        input = decodeFrame(f);
        use ||= input.use;
        out ||= input.out;
        seat.applied = f[0];
        if (k < take - 1 && seat.queue.length) movePlayer(m, i, input);
      }
      seat.last = input;
      return { ...input, use, out };
    });
    room.match.players.forEach((p, i) => (p.seq = room.seats[i].applied));
    step(m, inputs);
    room.n++;
    if (m.events.length) room.events.push(...m.events.splice(0));
    // About twelve snapshots a second: two in every five steps.
    if ((room.n * 2) % 5 < 2 || m.phase === 'over') this.broadcastSnap(room);
    if (m.phase === 'over') {
      room.status = 'over';
      this.broadcastRoom(room);
    }
  }

  private find(invite: string) {
    const room = this.rooms.get(invite);
    check(room, 404, 'This diner could not be found.');
    return room;
  }
  private seatOf(room: DinerRoom, who: Identity | null) {
    const seat = who ? room.seats.findIndex((s) => s.id === who.id) : -1;
    check(seat >= 0, 403, 'Only the waiters of this diner can open it.');
    return seat;
  }
  private connected(room: DinerRoom, seat: number) {
    const id = room.seats[seat].id;
    return [...room.streams].some((s) => s.id === id);
  }

  view(room: DinerRoom, id: string): DinerRoomView {
    return {
      token: room.token,
      level: room.level,
      seats: room.seats.map((s, i) => ({
        name: s.name,
        connected: this.connected(room, i),
      })),
      you: room.seats.findIndex((s) => s.id === id),
      host: id === room.owner,
      status: room.status,
      round: room.round,
      table: room.table,
    };
  }

  private snapLine(room: DinerRoom) {
    const a = JSON.stringify(room.seats.map((s) => s.applied));
    const e = JSON.stringify(room.events);
    room.events = [];
    return `{"n":${room.n},"round":${room.round},"a":${a},"e":${e},"m":${packMatch(room.match)}}`;
  }

  get(invite: string, who: Identity | null): DinerJoin {
    const room = this.find(invite);
    this.seatOf(room, who);
    const a = room.seats.map((s) => s.applied);
    return {
      room: this.view(room, who!.id),
      snap: {
        n: room.n,
        round: room.round,
        a,
        e: [],
        m: JSON.parse(packMatch(room.match)),
      },
    };
  }

  private write(s: Stream, text: string) {
    if (s.res.destroyed || s.res.writableEnded) return;
    if (s.res.writableLength > 512_000) {
      s.res.destroy();
      return;
    }
    s.res.write(text);
  }
  private broadcastRoom(room: DinerRoom) {
    for (const s of room.streams)
      this.write(
        s,
        `event: room\ndata: ${JSON.stringify(this.view(room, s.id))}\n\n`,
      );
  }
  private broadcastSnap(room: DinerRoom) {
    if (!room.streams.size) {
      room.events = [];
      return;
    }
    const line = `event: snap\ndata: ${this.snapLine(room)}\n\n`;
    for (const s of room.streams) this.write(s, line);
  }

  /** Opens a waiter's event stream. */
  connect(
    invite: string,
    who: Identity | null,
    req: IncomingMessage,
    res: ServerResponse,
  ) {
    const room = this.find(invite);
    const seat = this.seatOf(room, who);
    let mine = 0,
      total = 0;
    for (const r of this.rooms.values())
      for (const s of r.streams) {
        total++;
        if (s.id === who!.id) mine++;
      }
    check(mine < 12 && total < 2000, 429, 'Too many open connections.');
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    const stream: Stream = { req, res, id: who!.id, session: who!.sessionHash };
    room.streams.add(stream);
    room.emptySince = null;
    this.write(
      stream,
      `event: room\ndata: ${JSON.stringify(this.view(room, who!.id))}\n\n`,
    );
    res.on('close', () => this.drop(room, stream));
    room.seats[seat].late = 0;
    if (
      room.status === 'waiting' &&
      room.seats.every((_, i) => this.connected(room, i))
    )
      this.begin(room);
    else this.broadcastRoom(room);
    this.ensurePump();
  }

  private drop(room: DinerRoom, stream: Stream) {
    if (!room.streams.delete(stream) || this.stopping) return;
    if (!room.streams.size) room.emptySince = Date.now();
    const seat = room.seats.findIndex((s) => s.id === stream.id);
    if (seat >= 0 && !this.connected(room, seat)) {
      room.seats[seat].queue = [];
      room.seats[seat].late = HOLD + 1;
      this.broadcastRoom(room);
    }
  }

  /** A waiter's recent input steps; the ones not seen yet join the queue. */
  input(invite: string, who: Identity | null, body: Record<string, unknown>) {
    const room = this.find(invite);
    const i = this.seatOf(room, who);
    check(Number.isInteger(body.round), 400, 'Name the shift.');
    check(
      Array.isArray(body.frames) &&
        body.frames.length <= 24 &&
        body.frames.every(validFrame),
      400,
      'Send input steps.',
    );
    if (body.round !== room.round) return { ok: false };
    const seat = room.seats[i];
    for (const f of body.frames as Frame[]) {
      if (f[0] <= seat.received) continue;
      seat.received = f[0];
      seat.queue.push(f);
    }
    // A device far ahead (a stalled tab waking up) drops its oldest steps.
    if (seat.queue.length > 45) seat.queue.splice(0, seat.queue.length - 45);
    return { ok: true };
  }

  /** The host starts the next shift (the same level, or another). */
  again(invite: string, who: Identity | null, body: Record<string, unknown>) {
    const room = this.find(invite);
    this.seatOf(room, who);
    check(
      who!.id === room.owner,
      403,
      'Only the host can start the next shift.',
    );
    check(room.status === 'over', 409, 'The shift is still on.');
    check(
      body.level === undefined || isLevelId(body.level),
      400,
      'Choose a level.',
    );
    if (isLevelId(body.level)) room.level = body.level;
    room.round++;
    room.match = createConfiguredMatch(
      randomInt(1, 2 ** 31),
      levelConfig(room.level),
      room.seats.map((s) => s.name),
    );
    room.events = [];
    for (const s of room.seats) {
      s.queue = [];
      s.received = 0;
      s.applied = 0;
      s.last = idle;
      s.late = HOLD + 1;
    }
    room.status = 'waiting';
    this.broadcastRoom(room);
    this.begin(room);
    this.broadcastSnap(room);
    return { ok: true };
  }

  /** The table has a new admin; they host the room too. */
  follow(invite: string, actor: string) {
    const room = this.rooms.get(invite);
    if (room && room.seats.some((s) => s.id === actor)) room.owner = actor;
  }

  revoke(session: string) {
    for (const room of this.rooms.values())
      for (const s of room.streams) if (s.session === session) s.res.end();
  }

  /** Revoke every live stream after a password change, including new sessions. */
  revokeUser(userId: string) {
    for (const room of this.rooms.values())
      for (const stream of room.streams)
        if (stream.id === userId) {
          this.write(stream, 'event: revoked\ndata: {}\n\n');
          stream.res.end();
        }
  }

  /** Keep the remaining crew's shift, removing the deleted player's identity. */
  forgetUser(userId: string, removedTables: readonly string[] = []) {
    for (const room of this.rooms.values()) {
      const index = room.seats.findIndex((s) => s.id === userId);
      if (index < 0) continue;
      const next = room.seats.find((s) => s.id && s.id !== userId);
      if (!next) { this.remove(room); continue; }
      for (const stream of room.streams) {
        if (stream.id !== userId) continue;
        room.streams.delete(stream);
        this.write(stream, 'event: revoked\ndata: {}\n\n');
        stream.res.end();
      }
      const seat = room.seats[index];
      seat.id = ''; // No identity can claim a deleted seat.
      seat.name = 'Deleted player';
      seat.queue = [];
      seat.last = idle;
      seat.late = HOLD + 1;
      room.match.players[index].name = 'Deleted player';
      if (room.owner === userId) room.owner = next.id;
      if (room.table && removedTables.includes(room.table)) room.table = null;
      if (!room.streams.size) room.emptySince = Date.now();
      this.broadcastRoom(room);
      this.broadcastSnap(room);
    }
  }

  private remove(room: DinerRoom) {
    if (room.joinTimer) clearTimeout(room.joinTimer);
    this.rooms.delete(room.token);
    const left = [...room.streams];
    room.streams.clear();
    for (const s of left) {
      this.write(s, 'event: gone\ndata: {}\n\n');
      s.res.end();
    }
  }

  sweep(now = Date.now()) {
    for (const room of this.rooms.values())
      if (
        !room.streams.size &&
        room.emptySince !== null &&
        now - room.emptySince >= this.idleMs
      )
        this.remove(room);
  }

  close() {
    this.stopping = true;
    clearInterval(this.heartbeat);
    clearInterval(this.sweeper);
    if (this.pump) clearInterval(this.pump);
    this.pump = null;
    for (const room of this.rooms.values()) {
      if (room.joinTimer) clearTimeout(room.joinTimer);
      for (const s of room.streams) s.res.end();
      room.streams.clear();
    }
    this.rooms.clear();
  }
}
