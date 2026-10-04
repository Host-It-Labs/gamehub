import type { DatabaseSync } from 'node:sqlite';
import { check, token, type Identity } from './auth.ts';
import {
  actingSeats,
  createAlto,
  defaultOptions,
  extensionKeys,
  isAltoSave,
  observe,
  play,
  validMove,
  type AltoGame,
  type AltoMove,
  type AltoOptions,
  type Difficulty,
} from '../lib/games/alto/engine.ts';
import { botMove } from '../lib/games/alto/bot.ts';
import { lengths } from '../lib/games/alto/content.ts';
import type { AltoView } from '../lib/games/alto/room.ts';

/**
 * Online Alto rooms. A table launches a room with everyone seated and bots
 * in the empty seats. Everyone picks their island at once; the turn resolves
 * when the last seat locks in. Bots pick after a short pause so their locks
 * arrive one by one, and a player away for a while has a bot fly for them
 * until they return. Rooms are saved in SQLite and survive a restart.
 */
export type AltoMember = { id: string; name: string };
export type AltoRoomState = {
  version: 1;
  token: string;
  table: string | null;
  owner: string;
  /** The person in each seat, or null for a bot. */
  seats: (string | null)[];
  members: AltoMember[];
  game: AltoGame;
  setup: { options: AltoOptions; difficulty: Difficulty; seats: number };
  createdAt: number;
  updatedAt: number;
};
export type AltoRoomOptions = {
  /** Bots answer at once (tests). */
  inline?: boolean;
  /** How long a seat may stay away before a bot flies for it. */
  awayMs?: number;
  /** A page counts as here while it has polled within this time. */
  onlineMs?: number;
  /** How long a bot takes to pick. */
  botMs?: number;
};

const difficulties: Difficulty[] = ['easy', 'medium', 'hard'];

/** A table's launch request, checked field by field. */
export function launchOptions(input: Record<string, unknown>): AltoOptions {
  const raw = input.options as Record<string, unknown> | undefined;
  check(!!raw && typeof raw === 'object', 400, 'Choose the voyage.');
  check(typeof raw!.length === 'string' && raw!.length in lengths, 400, 'Choose the voyage length.');
  check(raw!.plans === 'first' || raw!.plans === 'random', 400, 'Choose the plans.');
  const options: AltoOptions = { ...defaultOptions(), length: raw!.length as AltoOptions['length'], plans: raw!.plans };
  for (const key of extensionKeys) {
    check(raw![key] === undefined || typeof raw![key] === 'boolean', 400, 'Invalid extension.');
    if (raw![key]) options[key] = true;
  }
  return options;
}

export class AltoRooms {
  private db: DatabaseSync;
  private seen = new Map<string, Map<string, number>>();
  private thinking = new Map<string, ReturnType<typeof setTimeout>>();
  private done = new Map<string, Set<string>>();
  private inline: boolean;
  private awayMs: number;
  private onlineMs: number;
  private botMs: number;
  /** Called after a bot changes a room in the background. */
  onChange?: (room: string) => void;
  constructor(db: DatabaseSync, options: AltoRoomOptions = {}) {
    this.db = db;
    this.inline = options.inline ?? false;
    this.awayMs = options.awayMs ?? 45_000;
    this.onlineMs = options.onlineMs ?? 12_000;
    this.botMs = options.botMs ?? 900;
    db.exec(
      'CREATE TABLE IF NOT EXISTS alto_rooms (token TEXT PRIMARY KEY, state TEXT NOT NULL, updated_at INTEGER NOT NULL)',
    );
  }
  private load(room: string): AltoRoomState {
    const row = this.db.prepare('SELECT state FROM alto_rooms WHERE token=?').get(room) as { state: string } | undefined;
    check(row, 404, 'This Alto room could not be found.');
    const r = JSON.parse(row.state) as AltoRoomState;
    check(r.version === 1 && isAltoSave(r.game), 410, 'This match belongs to an earlier edition of Alto.');
    return r;
  }
  private save(r: AltoRoomState) {
    r.updatedAt = Date.now();
    this.db
      .prepare(
        'INSERT INTO alto_rooms VALUES (?,?,?) ON CONFLICT(token) DO UPDATE SET state=excluded.state, updated_at=excluded.updated_at',
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
  launch(table: string, owner: string, members: AltoMember[], input: Record<string, unknown>, now = Date.now()) {
    const options = launchOptions(input);
    const difficulty = input.difficulty as Difficulty;
    check(difficulties.includes(difficulty), 400, 'Choose how the bots play.');
    const n = input.seats;
    check(
      Number.isInteger(n) && (n as number) >= Math.max(2, members.length) && (n as number) <= 6,
      409,
      'Alto seats two to six players.',
    );
    // The admin first, then everyone in the order they joined.
    const people = [...members.filter((m) => m.id === owner), ...members.filter((m) => m.id !== owner)];
    const seats = n as number;
    const game = createAlto(seats, Math.floor(Math.random() * 4294967295) + 1, difficulty, options);
    game.seats = Array.from({ length: seats }, (_, i) => people[i]?.name ?? `Bot ${i + 1}`);
    const r: AltoRoomState = {
      version: 1,
      token: token(),
      table,
      owner,
      seats: game.seats.map((_, i) => people[i]?.id ?? null),
      members: people.map((m) => ({ id: m.id, name: m.name })),
      game,
      setup: { options, difficulty, seats },
      createdAt: now,
      updatedAt: now,
    };
    this.save(r);
    for (const p of people) this.touch(r.token, p.id, now);
    this.think(r, now);
    return r.token;
  }

  private view(r: AltoRoomState, who: Identity | null, now: number): AltoView {
    const seat = who ? r.seats.indexOf(who.id) : -1;
    return {
      token: r.token,
      game: observe(r.game, seat >= 0 ? seat : null),
      viewerId: who?.id ?? '',
      viewerSeat: seat >= 0 ? seat : null,
      ownerId: r.owner,
      isOwner: !!who && who.id === r.owner,
      seats: r.seats.map((id, i) => {
        const seen = id ? this.lastSeen(r.token, id) : now;
        return {
          name: r.game.seats[i],
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
    this.think(r, now);
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
    const key = `${who.id}:${input.requestId}`;
    const replayed = this.done.get(room);
    if (replayed?.has(key)) return this.view(r, who, now);
    const move = input.move as AltoMove;
    check(validMove(r.game, move, seat), 409, 'That choice is no longer open.');
    r.game = play(r.game, move, seat);
    let set = replayed;
    if (!set) this.done.set(room, (set = new Set()));
    set.add(key);
    if (set.size > 400) this.done.set(room, new Set([...set].slice(-200)));
    this.save(r);
    this.think(r, now);
    return this.view(r, who, now);
  }

  /** The admin starts a new match with the same setup and seats. */
  again(room: string, who: Identity | null, now = Date.now()) {
    check(who, 401, 'Enter your name to join.');
    const r = this.load(room);
    check(who.id === r.owner, 403, 'Only the table admin can start another match.');
    check(r.game.over, 409, 'The match is still on.');
    const names = r.game.seats;
    r.game = createAlto(r.setup.seats, Math.floor(Math.random() * 4294967295) + 1, r.setup.difficulty, r.setup.options);
    r.game.seats = names;
    this.save(r);
    this.think(r, now);
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

  /** Seats a bot plays now: bots, and people away too long. */
  private covered(r: AltoRoomState, now: number) {
    return actingSeats(r.game).filter((s) => {
      const id = r.seats[s];
      return !id || now - this.lastSeen(r.token, id) >= this.awayMs;
    });
  }

  /** Lets a bot choose for every covered seat, each after its own pause. */
  private think(r: AltoRoomState, now = Date.now()) {
    this.covered(r, now).forEach((seat, k) => {
      const job = `${r.token}:${r.game.season}:${r.game.turn}:${r.game.phase}:${seat}`;
      if (this.thinking.has(job)) return;
      const apply = () => {
        this.thinking.delete(job);
        let cur: AltoRoomState;
        try {
          cur = this.load(r.token);
        } catch {
          return;
        }
        if (!this.covered(cur, Date.now()).includes(seat)) return;
        const move = botMove(cur.game, seat);
        if (!move || !validMove(cur.game, move, seat)) return;
        cur.game = play(cur.game, move, seat);
        this.save(cur);
        this.onChange?.(cur.token);
        this.think(cur);
      };
      if (this.inline) {
        this.thinking.set(job, setTimeout(() => {}, 0));
        apply();
        return;
      }
      const timer = setTimeout(apply, this.botMs + k * 350 + Math.random() * 400);
      timer.unref?.();
      this.thinking.set(job, timer);
    });
  }

  close() {
    for (const timer of this.thinking.values()) clearTimeout(timer);
    this.thinking.clear();
  }
}
