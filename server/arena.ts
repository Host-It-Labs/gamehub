import type { IncomingMessage, ServerResponse } from 'node:http';
import { randomInt } from 'node:crypto';
import { check, HttpError, token, type Identity } from './auth.ts';
import { cards } from '../lib/games/arena/cards.ts';
import {
  LENGTH,
  WIDTH,
  canPlayAt,
  createMatch,
  deploy,
  seatCount,
  step,
  type Difficulty,
  type Match,
  type Mode,
  type Side,
} from '../lib/games/arena/engine.ts';
import { botMemory, botStep, type BotMemory } from '../lib/games/arena/bot.ts';
import {
  CHECK_EVERY,
  checksum,
  snapshot,
  type Play,
  type TickMessage,
} from '../lib/games/arena/net.ts';
import type { ArenaRoomView, ArenaSnapshot } from '../lib/games/arena/room.ts';

/**
 * Online Arena rooms. A table launches one with its people seated and bots in
 * the empty seats; the room owns the clock and the one true match, steps it
 * thirty times a second and streams every tick with the cards played on it
 * (see lib/games/arena/net.ts). Rooms live in memory only: a restart ends the
 * running battles.
 */
export type ArenaOptions = {
  /** Milliseconds per simulation tick; tests run the clock faster. */
  tickMs?: number;
  /** How long a new battle waits for everyone's stream before it starts anyway. */
  startTimeoutMs?: number;
  /** Lead time from starting to the first tick, so every device is listening. */
  startDelayMs?: number;
  /** How long a person may be away before a bot plays their seat. */
  awayMs?: number;
  /** How long a room may sit with nobody watching before it is removed. */
  idleMs?: number;
  /** Whether a stream's session is still signed in, checked on each heartbeat. */
  authorized?: (req: IncomingMessage) => boolean;
};

type Participant = { id: string; name: string };
/** A person (their identity id) or a bot (id null). */
type Seat = { id: string | null; name: string };
type Stream = {
  req: IncomingMessage;
  res: ServerResponse;
  id: string;
  session: string;
};
type Queued = { player: number; slot: number; x: number; y: number };
export type ArenaRoom = {
  token: string;
  /** The table that launched the room. */
  table: string | null;
  /** The host: starts the next battle. */
  owner: string;
  mode: Mode;
  difficulty: Difficulty;
  /** Indexed by player; seat i plays for side i % 2. */
  seats: Seat[];
  status: ArenaRoomView['status'];
  round: number;
  seed: number;
  match: Match;
  /** Cards sent since the last tick, played at the start of the next. */
  queue: Queued[];
  /** One per seat, so a bot can stand in for anyone who drops out. */
  bots: BotMemory[];
  /** When each person's last stream closed; null while connected. */
  away: (number | null)[];
  streams: Set<Stream>;
  /** Clock time of tick 0, once playing. */
  startAt: number;
  startTimer: ReturnType<typeof setTimeout> | null;
  /** Since when nobody has had the room open. */
  emptySince: number | null;
};

/** A refused command, with the reason the client shows. */
export class ArenaRefusal extends HttpError {
  reason: 'phase' | 'card' | 'elixir' | 'place' | 'round';
  constructor(reason: ArenaRefusal['reason'], message: string) {
    super(409, message);
    this.reason = reason;
  }
}

const botNames: Record<Difficulty, string> = {
  easy: 'Rook',
  medium: 'Warden',
  hard: 'Marshal',
};
const difficulties: Difficulty[] = ['easy', 'medium', 'hard'];
const refusals = {
  phase: 'The battle is not on.',
  card: 'That card is not in your hand.',
  elixir: 'Not enough elixir.',
  place: 'You cannot deploy there.',
  round: 'That battle has ended.',
};
const refusal = (reason: ArenaRefusal['reason']) =>
  new ArenaRefusal(reason, refusals[reason]);
const clock = () => performance.now();

export class ArenaRooms {
  readonly rooms = new Map<string, ArenaRoom>();
  private readonly tickMs: number;
  private readonly startTimeoutMs: number;
  private readonly startDelayMs: number;
  private readonly awayMs: number;
  private readonly idleMs: number;
  private readonly authorized?: (req: IncomingMessage) => boolean;
  private pump: ReturnType<typeof setInterval> | null = null;
  private readonly heartbeat: ReturnType<typeof setInterval>;
  private readonly sweeper: ReturnType<typeof setInterval>;
  private stopping = false;
  constructor(options: ArenaOptions = {}) {
    this.tickMs = options.tickMs ?? 1000 / 30;
    this.startTimeoutMs = options.startTimeoutMs ?? 20_000;
    this.startDelayMs = options.startDelayMs ?? 700;
    this.awayMs = options.awayMs ?? 5000;
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

  /**
   * Opens a room for a table: `members` are its people, `owner` the host.
   * `input` is the table's launch request (ArenaLaunch).
   */
  launch(
    table: string,
    owner: string,
    members: Participant[],
    input: Record<string, unknown>,
  ) {
    const { mode, difficulty, teams } = input;
    check(
      mode === 'duel' || mode === 'team',
      400,
      'Choose a duel or a team battle.',
    );
    check(
      difficulties.includes(difficulty as Difficulty),
      400,
      'Choose a difficulty.',
    );
    check(
      teams === undefined ||
        (!!teams && typeof teams === 'object' && !Array.isArray(teams)),
      400,
      'Invalid teams.',
    );
    const sideOf = new Map<string, Side>();
    for (const [id, side] of Object.entries(teams ?? {})) {
      check(
        members.some((m) => m.id === id) && (side === 0 || side === 1),
        400,
        'Invalid teams.',
      );
      sideOf.set(id, side);
    }
    const count = seatCount(mode);
    check(
      members.length <= count,
      409,
      mode === 'duel'
        ? 'A duel seats two players.'
        : 'A team battle seats four players.',
    );
    // The host first, then everyone else in the order they joined.
    const people = [
      ...members.filter((m) => m.id === owner),
      ...members.filter((m) => m.id !== owner),
    ];
    const sides: [Participant[], Participant[]] = [[], []];
    if (teams === undefined) people.forEach((p, i) => sides[i % 2].push(p));
    else {
      for (const p of people) {
        const side = sideOf.get(p.id);
        if (side !== undefined) sides[side].push(p);
      }
      // Anyone the teams leave out joins the smaller side.
      for (const p of people)
        if (!sideOf.has(p.id))
          sides[sides[1].length < sides[0].length ? 1 : 0].push(p);
    }
    check(
      sides.every((s) => s.length <= count / 2),
      409,
      mode === 'duel'
        ? 'A duel seats one player a side.'
        : 'A team battle seats two players a side.',
    );
    // Side 0 takes players 0 and 2, side 1 players 1 and 3.
    const seats: Seat[] = Array.from({ length: count }, (_, i) => {
      const p = sides[i % 2][Math.floor(i / 2)];
      return p ? { id: p.id, name: p.name } : { id: null, name: '' };
    });
    const bots = seats.filter((s) => !s.id);
    const name = botNames[difficulty as Difficulty];
    bots.forEach((s, i) => {
      s.name = bots.length > 1 ? `${name} ${i + 1}` : name;
    });
    // A table plays one battle at a time; its earlier room is abandoned.
    for (const room of this.rooms.values())
      if (room.table === table) this.remove(room);
    check(
      this.rooms.size < 1000,
      503,
      'Too many battles are running. Please try again soon.',
    );
    const now = Date.now();
    const room: ArenaRoom = {
      token: token(),
      table,
      owner,
      mode,
      difficulty: difficulty as Difficulty,
      seats,
      status: 'waiting',
      round: 1,
      seed: 0,
      match: createMatch(0),
      queue: [],
      bots: [],
      away: seats.map(() => now),
      streams: new Set(),
      startAt: 0,
      startTimer: null,
      emptySince: now,
    };
    this.reset(room);
    this.rooms.set(room.token, room);
    return room.token;
  }

  /** A fresh battle with the same seats, waiting for everyone to connect. */
  private reset(room: ArenaRoom) {
    room.seed = randomInt(4294967296);
    room.match = createMatch(room.seed, room.difficulty, room.mode);
    room.bots = room.seats.map((_, i) =>
      botMemory(i, room.difficulty, room.seed),
    );
    room.queue = [];
    room.status = 'waiting';
    if (room.startTimer) clearTimeout(room.startTimer);
    room.startTimer = setTimeout(() => this.begin(room), this.startTimeoutMs);
    room.startTimer.unref();
  }

  /** Starts the clock: the first tick follows a short lead time. */
  private begin(room: ArenaRoom, announce = true) {
    if (this.stopping || room.status !== 'waiting') return;
    if (room.startTimer) clearTimeout(room.startTimer);
    room.startTimer = null;
    room.status = 'playing';
    room.startAt = clock() + this.startDelayMs;
    if (!this.pump) {
      this.pump = setInterval(() => this.advance(), 5);
      this.pump.unref();
    }
    if (announce) this.broadcastRoom(room);
  }

  /** Steps every playing room up to the tick its clock has reached. */
  private advance() {
    const now = clock();
    let playing = false;
    for (const room of this.rooms.values()) {
      if (room.status !== 'playing') continue;
      const target = Math.floor((now - room.startAt) / this.tickMs);
      // After a stall, catch up over a few pumps rather than all at once.
      for (
        let n = 0;
        n < 90 && room.status === 'playing' && room.match.tick < target;
        n++
      )
        this.tick(room);
      if (room.status === 'playing') playing = true;
    }
    if (!playing && this.pump) {
      clearInterval(this.pump);
      this.pump = null;
    }
  }

  /** One server step: the tick, then its cards, then one message. */
  private tick(room: ArenaRoom) {
    const m = room.match;
    step(m);
    m.events.length = 0;
    const n = m.tick;
    const plays: Play[] = [];
    // Cards that fail now (spent elixir, a card already played) are dropped.
    for (const c of room.queue.splice(0))
      if (deploy(m, c.player, c.slot, c.x, c.y).ok)
        plays.push([n, c.player, c.slot, c.x, c.y]);
    const now = Date.now();
    room.seats.forEach((seat, i) => {
      // Bots, and a stand-in for anyone away for a while.
      const away = room.away[i];
      if (seat.id && (away === null || now - away <= this.awayMs)) return;
      const move = botStep(m, room.bots[i]);
      if (move && deploy(m, move.player, move.slot, move.x, move.y).ok)
        plays.push([n, move.player, move.slot, move.x, move.y]);
    });
    const message: TickMessage = { h: n };
    if (plays.length) message.c = plays;
    // The final tick carries a checksum too, so the result can be checked.
    if (n % CHECK_EVERY === 0 || m.phase === 'over')
      message.k = [n, checksum(m)];
    const line = `data: ${JSON.stringify(message)}\n\n`;
    for (const s of room.streams) this.write(s, line);
    if (m.phase === 'over') {
      room.status = 'over';
      room.queue = [];
      this.broadcastRoom(room);
    }
  }

  private find(invite: string) {
    const room = this.rooms.get(invite);
    check(room, 404, 'This battle could not be found.');
    return room;
  }
  private seatOf(room: ArenaRoom, who: Identity | null) {
    const seat = who ? room.seats.findIndex((s) => s.id === who.id) : -1;
    check(seat >= 0, 403, 'Only players seated in this battle can open it.');
    return seat;
  }
  private connected(room: ArenaRoom, seat: number) {
    const id = room.seats[seat].id;
    return !!id && [...room.streams].some((s) => s.id === id);
  }
  private ready(room: ArenaRoom) {
    return room.seats.every((s, i) => !s.id || this.connected(room, i));
  }

  view(room: ArenaRoom, id: string): ArenaRoomView {
    return {
      token: room.token,
      mode: room.mode,
      difficulty: room.difficulty,
      seats: room.seats.map((s, i) => ({
        name: s.name,
        bot: !s.id,
        connected: !s.id || this.connected(room, i),
      })),
      you: room.seats.findIndex((s) => s.id === id),
      host: id === room.owner,
      status: room.status,
      round: room.round,
      table: room.table,
    };
  }
  private snapshotFor(
    room: ArenaRoom,
    id: string,
    match = snapshot(room.match),
  ) {
    return {
      room: this.view(room, id),
      match,
      horizon: room.match.tick,
    } satisfies ArenaSnapshot;
  }
  get(invite: string, who: Identity | null): ArenaSnapshot {
    const room = this.find(invite);
    this.seatOf(room, who);
    return this.snapshotFor(room, who!.id);
  }

  /** Writes to one stream, letting go of a client that stopped reading. */
  private write(s: Stream, text: string) {
    if (s.res.destroyed || s.res.writableEnded) return;
    if (s.res.writableLength > 256000) {
      s.res.destroy();
      return;
    }
    s.res.write(text);
  }
  private broadcastRoom(room: ArenaRoom) {
    for (const s of room.streams)
      this.write(
        s,
        `event: room\ndata: ${JSON.stringify(this.view(room, s.id))}\n\n`,
      );
  }
  private broadcastSnapshot(room: ArenaRoom) {
    const match = snapshot(room.match);
    for (const s of room.streams)
      this.write(
        s,
        `event: snapshot\ndata: ${JSON.stringify(this.snapshotFor(room, s.id, match))}\n\n`,
      );
  }

  /** Opens a seated player's event stream. */
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
    const joined = !this.connected(room, seat);
    const stream: Stream = { req, res, id: who!.id, session: who!.sessionHash };
    room.streams.add(stream);
    room.emptySince = null;
    room.away[seat] = null;
    this.write(
      stream,
      `event: snapshot\ndata: ${JSON.stringify(this.snapshotFor(room, who!.id))}\n\n`,
    );
    res.on('close', () => this.drop(room, stream));
    if (!joined) return;
    if (room.status === 'waiting' && this.ready(room)) this.begin(room);
    else this.broadcastRoom(room);
  }
  private drop(room: ArenaRoom, stream: Stream) {
    if (!room.streams.delete(stream) || this.stopping) return;
    const now = Date.now();
    if (!room.streams.size) room.emptySince = now;
    const seat = room.seats.findIndex((s) => s.id === stream.id);
    if (seat >= 0 && !this.connected(room, seat)) {
      room.away[seat] = now;
      this.broadcastRoom(room);
    }
  }

  /** Queues a card for the next tick once it would be legal now. */
  command(
    invite: string,
    who: Identity | null,
    input: Record<string, unknown>,
  ) {
    const room = this.find(invite);
    const player = this.seatOf(room, who);
    const { round, slot, x, y } = input;
    check(
      Number.isInteger(slot) && (slot as number) >= 0 && (slot as number) <= 3,
      400,
      'Choose a card.',
    );
    check(
      typeof x === 'number' &&
        typeof y === 'number' &&
        Number.isInteger(x * 2) &&
        Number.isInteger(y * 2) &&
        x >= 0.5 &&
        x <= WIDTH - 0.5 &&
        y >= 0.5 &&
        y <= LENGTH - 0.5,
      400,
      'Choose a spot on the field.',
    );
    check(Number.isInteger(round), 400, 'Name the battle.');
    if (round !== room.round) throw refusal('round');
    const m = room.match;
    if (
      room.status !== 'playing' ||
      (m.phase !== 'battle' && m.phase !== 'overtime')
    )
      throw refusal('phase');
    const seat = m.players[player];
    const card = seat.hand.cards[slot as number];
    if (!card) throw refusal('card');
    if (seat.elixir < cards[card].cost) throw refusal('elixir');
    // Troops on your half; a spell anywhere on the field.
    if (!canPlayAt(m, seat.side, card, x, y)) throw refusal('place');
    check(room.queue.length < 64, 429, 'Too many cards at once.');
    room.queue.push({ player, slot: slot as number, x, y });
    return { ok: true };
  }

  /** The host starts the next battle in the same seats once one is over. */
  again(invite: string, who: Identity | null) {
    const room = this.find(invite);
    this.seatOf(room, who);
    check(
      who!.id === room.owner,
      403,
      'Only the host can start the next battle.',
    );
    check(room.status === 'over', 409, 'The battle is still on.');
    room.round++;
    this.reset(room);
    if (this.ready(room)) this.begin(room, false);
    this.broadcastSnapshot(room);
    return { ok: true };
  }

  /** Ends the streams of a session that signed out. */
  revoke(session: string) {
    for (const room of this.rooms.values())
      for (const s of room.streams) if (s.session === session) s.res.end();
  }

  private remove(room: ArenaRoom) {
    if (room.startTimer) clearTimeout(room.startTimer);
    this.rooms.delete(room.token);
    const left = [...room.streams];
    room.streams.clear();
    for (const s of left) {
      this.write(s, 'event: gone\ndata: {}\n\n');
      s.res.end();
    }
  }

  /** Removes rooms nobody has had open for the idle period. */
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
      if (room.startTimer) clearTimeout(room.startTimer);
      for (const s of room.streams) s.res.end();
      room.streams.clear();
    }
    this.rooms.clear();
  }
}
