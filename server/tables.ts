import type { DatabaseSync } from 'node:sqlite';
import { randomInt } from 'node:crypto';
import {
  createGame,
  observe,
  play,
  validMove,
  catalog,
  type Game,
  type Move,
  type Difficulty,
  type GameId,
} from '../lib/games/trio/engine.ts';
import type { Command, GameView, Table } from '../lib/online/types.ts';
import { check, displayName, token, type Identity } from './auth.ts';

type Participant = { id: string; name: string };
type Seat = Participant & { bot: boolean };
export type StoredTable = {
  token: string;
  owner: string;
  gameId: GameId;
  difficulty: Difficulty;
  capacity: number;
  revision: number;
  status: Table['status'];
  members: Participant[];
  seats: Seat[];
  matchId: string | null;
  game: Game | null;
  botError: boolean;
};
export function parseMove(value: unknown): Move {
  check(value && typeof value === 'object', 400, 'Invalid move.');
  const m = value as Record<string, unknown>;
  if (m.type === 'roll') return { type: 'roll' };
  if (m.type === 'pass') {
    check(
      Array.isArray(m.cards) &&
        m.cards.length === 3 &&
        m.cards.every(Number.isInteger),
      400,
      'Choose three cards.',
    );
    return { type: 'pass', cards: m.cards as number[] };
  }
  check(
    m.type === 'play' &&
      Number.isInteger(m.card) &&
      (m.zone === undefined ||
        (Number.isInteger(m.zone) &&
          Number(m.zone) >= 0 &&
          Number(m.zone) < 6)) &&
      (m.ward === undefined || typeof m.ward === 'boolean'),
    400,
    'Invalid move.',
  );
  return {
    type: 'play',
    card: m.card as number,
    ...(m.zone === undefined ? {} : { zone: m.zone as number }),
    ...(m.ward === undefined ? {} : { ward: m.ward as boolean }),
  };
}
export class Tables {
  db: DatabaseSync;
  connected: (table: string, member: string) => boolean;
  constructor(db: DatabaseSync, connected: Tables['connected']) {
    this.db = db;
    this.connected = connected;
  }
  get(invite: string) {
    const row = this.db
      .prepare('SELECT state FROM tables WHERE token=?')
      .get(invite) as { state: string } | undefined;
    check(row, 404, 'This table does not exist.');
    return JSON.parse(row.state) as StoredTable;
  }
  save(t: StoredTable) {
    this.db
      .prepare('UPDATE tables SET state=? WHERE token=?')
      .run(JSON.stringify(t), t.token);
  }
  create(who: Identity) {
    check(who.userId, 401, 'Sign in to create a table.');
    const existing = this.list(who);
    check(
      existing.length < 30,
      409,
      'Close an existing table before creating another.',
    );
    const t: StoredTable = {
      token: token(),
      owner: who.userId,
      gameId: 'undertow',
      difficulty: 'medium',
      capacity: 6,
      revision: 0,
      status: 'lobby',
      members: [{ id: who.id, name: who.name }],
      seats: [],
      matchId: null,
      game: null,
      botError: false,
    };
    this.db
      .prepare('INSERT INTO tables VALUES (?,?,?)')
      .run(t.token, t.owner, JSON.stringify(t));
    return t;
  }
  list(who: Identity) {
    if (!who.userId) return [];
    return (
      this.db
        .prepare('SELECT state FROM tables WHERE owner=?')
        .all(who.userId) as { state: string }[]
    )
      .map((r) => JSON.parse(r.state) as StoredTable)
      .filter((t) => t.status !== 'closed')
      .map((t) => ({
        token: t.token,
        gameId: t.gameId,
        status: t.status,
        count: t.members.length,
      }));
  }
  join(invite: string, who: Identity) {
    const t = this.get(invite);
    check(t.status !== 'closed', 410, 'This table has closed.');
    if (!t.members.some((m) => m.id === who.id)) {
      check(
        t.members.length < (t.status === 'lobby' ? t.capacity : 24),
        409,
        'This table is full.',
      );
      t.members.push({ id: who.id, name: who.name });
      t.revision++;
      this.save(t);
    }
    return t;
  }
  view(t: StoredTable, who: Identity): Table {
    check(
      t.members.some((m) => m.id === who.id),
      403,
      'Join the table first.',
    );
    const index = t.seats.findIndex((s) => s.id === who.id && !s.bot);
    let game: GameView | null = null;
    if (t.game && index >= 0 && t.status !== 'closed') {
      const { knownPackets: _privateMemory, ...visible } = observe(
        t.game,
        index,
      );
      game = visible;
    }
    return {
      token: t.token,
      gameId: t.gameId,
      difficulty: t.difficulty,
      capacity: t.capacity,
      revision: t.revision,
      status: t.status,
      viewerId: who.id,
      isHost: t.owner === who.userId,
      viewerSeat: index < 0 ? null : index,
      matchId: t.matchId,
      game,
      botError: t.botError,
      members: [
        ...t.members.map((m, i) => ({
          ...m,
          host: m.id === t.owner,
          connected: this.connected(t.token, m.id),
          bot: false,
          seat:
            t.status === 'lobby'
              ? i < t.capacity
                ? i
                : null
              : ((n) => (n < 0 ? null : n))(
                  t.seats.findIndex((s) => s.id === m.id && !s.bot),
                ),
        })),
        ...t.seats.flatMap((s, i) =>
          s.bot ? [{ ...s, host: false, connected: true, seat: i }] : [],
        ),
      ],
    };
  }
  command(invite: string, who: Identity, command: Command) {
    check(
      command &&
        typeof command === 'object' &&
        typeof command.requestId === 'string' &&
        /^[a-zA-Z0-9_-]{16,80}$/.test(command.requestId) &&
        Number.isInteger(command.revision) &&
        command.action &&
        typeof command.action === 'object',
      400,
      'Invalid command.',
    );
    const body = JSON.stringify(command);
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const t = this.get(invite);
      check(
        t.members.some((m) => m.id === who.id),
        403,
        'Join the table first.',
      );
      const old = this.db
        .prepare(
          'SELECT body FROM commands WHERE table_token=? AND actor=? AND request_id=?',
        )
        .get(invite, who.id, command.requestId) as { body: string } | undefined;
      if (old) {
        check(old.body === body, 409, 'This request ID was already used.');
        this.db.exec('COMMIT');
        return t;
      }
      check(t.status !== 'closed', 410, 'This table has closed.');
      check(
        command.revision === t.revision && command.matchId === t.matchId,
        409,
        'The table changed. Try again.',
      );
      const a = command.action;
      if (!['move', 'rename', 'leave'].includes(a.type))
        check(who.userId === t.owner, 403, 'Only the host can do that.');
      switch (a.type) {
        case 'configure':
          check(t.status === 'lobby', 409, 'Return to the lobby first.');
          check(
            catalog.some((c) => c.id === a.gameId) &&
              ['easy', 'medium', 'hard'].includes(a.difficulty) &&
              Number.isInteger(a.capacity) &&
              a.capacity >= 2 &&
              a.capacity <= 6 &&
              a.capacity >= t.members.length,
            400,
            'Choose 2–6 seats, enough for everyone at the table.',
          );
          t.gameId = a.gameId;
          t.difficulty = a.difficulty;
          t.capacity = a.capacity;
          break;
        case 'start': {
          check(t.status === 'lobby', 409, 'Return to the lobby first.');
          check(
            t.members.length <= t.capacity,
            409,
            'Remove waiting guests or increase the seat count first.',
          );
          t.seats = t.members.map((m) => ({ ...m, bot: false }));
          while (t.seats.length < t.capacity)
            t.seats.push({
              id: token(),
              name: `Bot ${t.seats.length + 1}`,
              bot: true,
            });
          t.game = createGame(
            t.gameId,
            t.difficulty,
            randomInt(4294967296),
            false,
            t.capacity,
          );
          t.game.players.forEach((p, i) => {
            p.name = t.seats[i].name;
          });
          t.matchId = token();
          t.status = 'playing';
          t.botError = false;
          break;
        }
        case 'move': {
          check(
            t.status === 'playing' && t.game,
            409,
            'No match is in progress.',
          );
          const seat = t.seats[t.game.active];
          check(seat.id === who.id && !seat.bot, 403, 'Wait for your turn.');
          const move = parseMove(a.move);
          check(validMove(t.game, move), 400, 'That move is not allowed.');
          t.game = play(t.game, move);
          if (t.game.phase === 'over') t.status = 'finished';
          break;
        }
        case 'replace': {
          check(t.status === 'playing', 409, 'No match is in progress.');
          const seat = t.seats.find((s) => s.id === a.memberId && !s.bot);
          check(
            seat && seat.id !== t.owner && !this.connected(t.token, seat.id),
            409,
            'Only a disconnected guest can be replaced.',
          );
          seat.bot = true;
          seat.name = `${seat.name} (bot)`;
          t.game!.players[t.seats.indexOf(seat)].name = seat.name;
          break;
        }
        case 'remove':
          check(
            t.status === 'lobby' && a.memberId !== t.owner,
            409,
            'Guests can only be removed in the lobby.',
          );
          t.members = t.members.filter((m) => m.id !== a.memberId);
          break;
        case 'leave':
          check(
            t.status === 'lobby' && who.id !== t.owner,
            409,
            'Your seat is reserved until this match ends.',
          );
          t.members = t.members.filter((m) => m.id !== who.id);
          break;
        case 'rename': {
          const name = displayName(a.name);
          t.members.find((m) => m.id === who.id)!.name = name;
          const seat = t.seats.find((s) => s.id === who.id && !s.bot);
          if (seat) {
            seat.name = name;
            t.game!.players[t.seats.indexOf(seat)].name = name;
          }
          this.db
            .prepare(
              who.userId
                ? 'UPDATE users SET name=? WHERE id=?'
                : 'UPDATE guests SET name=? WHERE id=?',
            )
            .run(name, who.id);
          break;
        }
        case 'abandon':
          t.status = 'lobby';
          t.game = null;
          t.matchId = null;
          t.seats = [];
          t.botError = false;
          break;
        case 'close':
          t.status = 'closed';
          t.game = null;
          t.seats = [];
          break;
        case 'retry-bot':
          t.botError = false;
          break;
        default:
          check(false, 400, 'Unknown command.');
      }
      t.revision++;
      this.save(t);
      this.db
        .prepare('INSERT INTO commands VALUES (?,?,?,?)')
        .run(invite, who.id, command.requestId, body);
      this.db.exec('COMMIT');
      return t;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }
  botMove(invite: string, revision: number, move: Move | null) {
    const t = this.get(invite);
    if (
      t.revision !== revision ||
      t.status !== 'playing' ||
      !t.game ||
      !t.seats[t.game.active].bot
    )
      return;
    if (!move || !validMove(t.game, move)) t.botError = true;
    else {
      t.game = play(t.game, move);
      if (t.game.phase === 'over') t.status = 'finished';
    }
    t.revision++;
    this.save(t);
  }
}
