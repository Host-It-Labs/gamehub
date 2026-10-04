import type { DatabaseSync } from 'node:sqlite';
import { Worker } from 'node:worker_threads';
import { check, token, type Identity } from './auth.ts';
import {
  EXTENSIONS,
  createRota,
  isRotaGame,
  observe,
  play,
  validMove,
  type Difficulty,
  type Extensions,
  type RotaGame,
  type RotaMove,
} from '../lib/games/rota/engine.ts';
import { botRound } from '../lib/games/rota/bot.ts';
import { MAP_IDS, type MapId } from '../lib/games/rota/maps.ts';
import type { RotaView } from '../lib/games/rota/room.ts';

/**
 * Online Rota rooms. A table launches a room with everyone seated and bots
 * in the empty seats; each person builds their round in private and locks it
 * with Done, and the round resolves once every seat has. Bots think on a
 * worker thread so a busy round never stalls the server's other games. A
 * player away for a while has their round built by a bot, so the table never
 * waits on an empty chair; they take their seat back when they return.
 * Rooms are saved in SQLite and survive a restart.
 */
export type RotaMember = { id: string; name: string };
export type RotaRoomState = {
  version: 1;
  token: string;
  table: string | null;
  owner: string;
  /** The person in each seat, or null for a bot. */
  seats: (string | null)[];
  members: RotaMember[];
  game: RotaGame;
  setup: { map: MapId; ext: Extensions; difficulty: Difficulty; seats: number };
  createdAt: number;
  updatedAt: number;
};
export type RotaOptions = {
  /** Think in the request instead of on a worker (tests). */
  inline?: boolean;
  /** How long a seat may stay away before a bot builds its round. */
  awayMs?: number;
  /** A page counts as here while it has polled within this time. */
  onlineMs?: number;
};

const difficulties: Difficulty[] = ['easy', 'medium', 'hard'];

export class RotaRooms {
  private db: DatabaseSync;
  private seen = new Map<string, Map<string, number>>();
  private thinking = new Set<string>();
  private done = new Map<string, Set<string>>();
  private inline: boolean;
  private awayMs: number;
  private onlineMs: number;
  /** Called after a background bot changes a room (the server may publish). */
  onChange?: (room: string) => void;
  constructor(db: DatabaseSync, options: RotaOptions = {}) {
    this.db = db;
    this.inline = options.inline ?? false;
    this.awayMs = options.awayMs ?? 45_000;
    this.onlineMs = options.onlineMs ?? 12_000;
    db.exec(
      'CREATE TABLE IF NOT EXISTS rota_rooms (token TEXT PRIMARY KEY, state TEXT NOT NULL, updated_at INTEGER NOT NULL)',
    );
  }
  private load(room: string): RotaRoomState {
    const row = this.db
      .prepare('SELECT state FROM rota_rooms WHERE token=?')
      .get(room) as { state: string } | undefined;
    check(row, 404, 'This Rota room could not be found.');
    const r = JSON.parse(row.state) as RotaRoomState;
    check(
      r.version === 1 && isRotaGame(r.game),
      410,
      'This match belongs to an earlier edition of Rota.',
    );
    return r;
  }
  private save(r: RotaRoomState) {
    r.updatedAt = Date.now();
    this.db
      .prepare(
        'INSERT INTO rota_rooms VALUES (?,?,?) ON CONFLICT(token) DO UPDATE SET state=excluded.state, updated_at=excluded.updated_at',
      )
      .run(r.token, JSON.stringify(r), r.updatedAt);
  }
  private touch(room: string, who: string, now: number) {
    let m = this.seen.get(room);
    if (!m) this.seen.set(room, (m = new Map()));
    m.set(who, now);
  }
  private lastSeen(room: string, who: string) {
    return this.seen.get(room)?.get(who) ?? 0;
  }

  /** Opens a room for a table's members; bots fill the seats nobody takes. */
  launch(
    table: string,
    owner: string,
    members: RotaMember[],
    input: Record<string, unknown>,
    now = Date.now(),
  ) {
    const map = input.map as MapId;
    check(MAP_IDS.includes(map), 400, 'Choose a map.');
    const difficulty = input.difficulty as Difficulty;
    check(difficulties.includes(difficulty), 400, 'Choose a difficulty.');
    const extIn = input.ext as Record<string, unknown> | undefined;
    check(
      !!extIn &&
        typeof extIn === 'object' &&
        EXTENSIONS.every((e) => typeof extIn[e] === 'boolean'),
      400,
      'Choose the extensions.',
    );
    const ext = Object.fromEntries(EXTENSIONS.map((e) => [e, extIn![e]])) as Extensions;
    const seats = input.seats;
    check(
      Number.isInteger(seats) &&
        (seats as number) >= Math.max(1, members.length) &&
        (seats as number) <= 6,
      409,
      'Rota seats one to six players.',
    );
    // The admin first, then everyone in the order they joined.
    const people = [
      ...members.filter((m) => m.id === owner),
      ...members.filter((m) => m.id !== owner),
    ];
    const n = seats as number;
    const names = Array.from(
      { length: n },
      (_, i) => people[i]?.name ?? `Bot ${i + 1}`,
    );
    const game = createRota(n, Math.floor(Math.random() * 4294967295) + 1, {
      map,
      ext,
      difficulty,
      names,
      bots: names.map((_, i) => !people[i]),
    });
    const r: RotaRoomState = {
      version: 1,
      token: token(),
      table,
      owner,
      seats: names.map((_, i) => people[i]?.id ?? null),
      members: people.map((m) => ({ id: m.id, name: m.name })),
      game,
      setup: { map, ext, difficulty, seats: n },
      createdAt: now,
      updatedAt: now,
    };
    this.save(r);
    for (const p of people) this.touch(r.token, p.id, now);
    this.think(r);
    return r.token;
  }

  private view(r: RotaRoomState, who: Identity | null, now: number): RotaView {
    const seat = who ? r.seats.indexOf(who.id) : -1;
    return {
      token: r.token,
      game: observe(r.game, seat),
      viewerId: who?.id ?? '',
      viewerSeat: seat >= 0 ? seat : null,
      ownerId: r.owner,
      isOwner: !!who && who.id === r.owner,
      seats: r.seats.map((id, i) => {
        const seen = id ? this.lastSeen(r.token, id) : now;
        return {
          name: r.game.seats[i].name,
          bot: !id,
          online: !id || now - seen < this.onlineMs,
          away: !!id && now - seen >= this.awayMs,
        };
      }),
    };
  }

  get(room: string, who: Identity | null, now = Date.now()) {
    const r = this.load(room);
    check(
      !!who && (r.members.some((m) => m.id === who.id) || r.seats.includes(who.id)),
      403,
      'Only the players at this table can open the match.',
    );
    this.touch(room, who!.id, now);
    this.cover(r, now);
    return this.view(r, who, now);
  }

  command(room: string, who: Identity | null, input: Record<string, unknown>, now = Date.now()) {
    check(who, 401, 'Enter your name to join.');
    check(
      typeof input.requestId === 'string' && /^[A-Za-z0-9_-]{8,80}$/.test(input.requestId),
      400,
      'Invalid request.',
    );
    const r = this.load(room);
    const seat = r.seats.indexOf(who.id);
    check(seat >= 0, 403, 'You have no seat in this match.');
    this.touch(room, who.id, now);
    const replayed = this.done.get(room);
    const key = `${who.id}:${input.requestId}`;
    if (replayed?.has(key)) return this.view(r, who, now);
    const move = input.move as RotaMove;
    check(validMove(r.game, move, seat), 409, 'That move no longer fits.');
    r.game = play(r.game, move, seat);
    let set = replayed;
    if (!set) this.done.set(room, (set = new Set()));
    set.add(key);
    if (set.size > 400) this.done.set(room, new Set([...set].slice(-200)));
    this.save(r);
    this.think(r);
    return this.view(r, who, now);
  }

  /** The admin starts a new match with the same setup and seats. */
  again(room: string, who: Identity | null, now = Date.now()) {
    check(who, 401, 'Enter your name to join.');
    const r = this.load(room);
    check(who.id === r.owner, 403, 'Only the table admin can start another match.');
    check(r.game.over, 409, 'The match is still on.');
    r.game = createRota(r.setup.seats, Math.floor(Math.random() * 4294967295) + 1, {
      map: r.setup.map,
      ext: r.setup.ext,
      difficulty: r.setup.difficulty,
      names: r.game.seats.map((s) => s.name),
      bots: r.seats.map((id) => !id),
    });
    this.save(r);
    this.think(r);
    return this.view(r, who, now);
  }

  /** The table has a new admin; they lead the room too. */
  follow(room: string, actor: string) {
    try {
      const r = this.load(room);
      if (r.owner === actor || !r.members.some((m) => m.id === actor)) return;
      r.owner = actor;
      this.save(r);
    } catch {
      // A missing or retired room has nobody to lead.
    }
  }

  /** Seats a bot plays this round: bots, and people away too long. */
  private covered(r: RotaRoomState, now: number) {
    if (r.game.over) return [];
    return r.game.seats.flatMap((s, i) => {
      if (s.locked) return [];
      const id = r.seats[i];
      if (!id) return [i];
      return now - this.lastSeen(r.token, id) >= this.awayMs ? [i] : [];
    });
  }
  private cover(r: RotaRoomState, now: number) {
    const away = this.covered(r, now).filter((i) => r.seats[i]);
    if (away.length) this.think(r, now);
  }

  /** Lets the bots build every covered seat's round. */
  private think(r: RotaRoomState, now = Date.now()) {
    for (const seat of this.covered(r, now)) {
      const job = `${r.token}:${r.game.round}:${seat}`;
      if (this.thinking.has(job)) continue;
      this.thinking.add(job);
      const seen = observe(r.game, seat);
      // An away person's half-built round is kept; the bot adds to it.
      const apply = (moves: RotaMove[]) => {
        this.thinking.delete(job);
        let cur: RotaRoomState;
        try {
          cur = this.load(r.token);
        } catch {
          return;
        }
        if (cur.game.over || cur.game.round !== seen.round || cur.game.seats[seat].locked) return;
        for (const m of moves) {
          if (!validMove(cur.game, m, seat)) break;
          cur.game = play(cur.game, m, seat);
        }
        this.save(cur);
        this.onChange?.(cur.token);
        this.think(cur);
      };
      if (this.inline) {
        apply(botRound(seen, seat));
        continue;
      }
      const worker = new Worker(new URL('./rota-bot-worker.ts', import.meta.url), {
        workerData: { game: seen, seat },
        execArgv: ['--experimental-strip-types'],
      });
      worker.once('message', (moves: RotaMove[]) => {
        void worker.terminate();
        apply(moves);
      });
      worker.once('error', () => {
        void worker.terminate();
        // Fall back to thinking here rather than stalling the round.
        apply(botRound(seen, seat));
      });
    }
  }
}
