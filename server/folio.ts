import type { DatabaseSync } from 'node:sqlite';
import { randomInt } from 'node:crypto';
import { check, displayName, HttpError, token, type Identity } from './auth.ts';
import {
  actFolio,
  createFolio,
  observeFolio,
  round,
  startFolio,
} from '../lib/games/folio/engine.ts';
import {
  KINDS,
  type Action,
  type FolioGame,
  type FolioSummary,
  type FolioView,
  type Kind,
} from '../lib/games/folio/types.ts';
export class FolioRuns {
  private db: DatabaseSync;
  constructor(db: DatabaseSync) {
    this.db = db;
  }
  private transaction<T>(work: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const value = work();
      this.db.exec('COMMIT');
      return value;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }
  private load(invite: string) {
    const row = this.db
      .prepare('SELECT state FROM folio_runs WHERE token=?')
      .get(invite) as { state: string } | undefined;
    check(row, 404, 'This Folio run could not be found.');
    const g = JSON.parse(row.state) as FolioGame;
    check(
      g.version === 3,
      410,
      'This run belongs to an earlier test edition of Folio. Start a new one.',
    );
    return g;
  }
  private save(invite: string, g: FolioGame) {
    this.db
      .prepare('UPDATE folio_runs SET state=? WHERE token=?')
      .run(JSON.stringify(g), invite);
  }
  private isMember(invite: string, who: Identity | null) {
    return (
      !!who &&
      !!this.db
        .prepare('SELECT 1 FROM folio_members WHERE run=? AND actor=?')
        .get(invite, who.id)
    );
  }
  private count(invite: string) {
    return (
      this.db
        .prepare('SELECT count(*) AS n FROM folio_members WHERE run=?')
        .get(invite) as { n: number }
    ).n;
  }
  private view(
    invite: string,
    who: Identity | null,
    g: FolioGame,
    now: number,
  ): FolioView {
    const joined = this.isMember(invite, who);
    if (joined)
      this.db
        .prepare('UPDATE folio_members SET seen_at=? WHERE run=? AND actor=?')
        .run(now, invite, who!.id);
    const members = this.db
      .prepare(
        'SELECT actor,name,seen_at FROM folio_members WHERE run=? ORDER BY joined_at,actor',
      )
      .all(invite) as { actor: string; name: string; seen_at: number }[];
    return {
      token: invite,
      game: observeFolio(g),
      viewerId: who?.id ?? '',
      joined,
      members: members.map((m) => ({
        id: m.actor,
        name: m.name,
        online: now - m.seen_at < 15000,
      })),
    };
  }
  private seat(invite: string, who: Identity, name: unknown, now: number) {
    this.db
      .prepare('INSERT INTO folio_members VALUES (?,?,?,?,?)')
      .run(
        invite,
        who.id,
        name === undefined || name === '' ? who.name : displayName(name),
        now,
        now,
      );
  }
  list(who: Identity): FolioSummary[] {
    return (
      this.db
        .prepare(
          'SELECT r.token,r.state FROM folio_runs r JOIN folio_members m ON m.run=r.token WHERE m.actor=? ORDER BY m.seen_at DESC LIMIT 40',
        )
        .all(who.id) as { token: string; state: string }[]
    ).flatMap((row) => {
      const g = JSON.parse(row.state) as FolioGame;
      if (g.version !== 3) return [];
      const members = (
        this.db
          .prepare(
            'SELECT name FROM folio_members WHERE run=? ORDER BY joined_at,actor',
          )
          .all(row.token) as { name: string }[]
      ).map((m) => m.name);
      return [
        {
          token: row.token,
          seats: g.seats,
          members,
          phase: g.phase,
          round: round(g),
          lives: g.lives,
          difficulty: g.difficulty,
          victory: g.victory,
          practice: g.practice,
          updatedAt: g.updatedAt,
        },
      ];
    });
  }
  create(who: Identity, input: Record<string, unknown>, now = Date.now()) {
    const practice = input.practice as
      | { kind?: unknown; boss?: unknown }
      | undefined;
    check(
      practice === undefined ||
        (typeof practice === 'object' &&
          practice !== null &&
          KINDS.includes(practice.kind as Kind)),
      400,
      'Choose a practice puzzle.',
    );
    const seats = practice ? 1 : (input.seats ?? 1);
    check(
      Number.isInteger(seats) &&
        (seats as number) >= 1 &&
        (seats as number) <= 3,
      400,
      'Choose one to three seats.',
    );
    const difficulty = practice ? 1 : (input.difficulty ?? 1);
    check(
      difficulty === 1 || difficulty === 2 || difficulty === 3,
      400,
      'Choose a difficulty.',
    );
    return this.transaction(() => {
      const recent = this.db
        .prepare(
          'SELECT count(*) AS n FROM folio_runs r JOIN folio_members m ON m.run=r.token WHERE m.actor=? AND m.joined_at>?',
        )
        .get(who.id, now - 3600000) as { n: number };
      check(
        recent.n < 40,
        429,
        'Take a short break before starting more runs.',
      );
      const invite = token(),
        g = createFolio(
          randomInt(1, 2 ** 31),
          seats as number,
          now,
          practice
            ? { kind: practice.kind as Kind, boss: practice.boss === true }
            : undefined,
          difficulty,
        );
      this.db
        .prepare('INSERT INTO folio_runs VALUES (?,?)')
        .run(invite, JSON.stringify(g));
      this.seat(invite, who, input.name, now);
      return this.view(invite, who, g, now);
    });
  }
  join(
    invite: string,
    who: Identity,
    input: Record<string, unknown>,
    now = Date.now(),
  ) {
    return this.transaction(() => {
      const g = this.load(invite);
      if (!this.isMember(invite, who)) {
        check(
          g.phase === 'lobby',
          409,
          'This table is already locked. Ask for a new invitation.',
        );
        const count = this.count(invite);
        check(count < g.seats, 409, 'Every seat at this table is taken.');
        this.seat(invite, who, input.name, now);
        if (count + 1 === g.seats) {
          startFolio(g, g.seats, now);
          this.save(invite, g);
        }
      }
      return this.view(invite, who, g, now);
    });
  }
  get(invite: string, who: Identity | null, now = Date.now()) {
    return this.view(invite, who, this.load(invite), now);
  }
  command(
    invite: string,
    who: Identity,
    input: Record<string, unknown>,
    now = Date.now(),
  ) {
    check(
      typeof input.requestId === 'string' &&
        /^[A-Za-z0-9_-]{16,80}$/.test(input.requestId),
      400,
      'Invalid action identifier.',
    );
    check(
      Number.isInteger(input.revision),
      400,
      'Refresh the run before acting.',
    );
    check(
      input.action &&
        typeof input.action === 'object' &&
        !Array.isArray(input.action),
      400,
      'Choose an action.',
    );
    const body = JSON.stringify({
      revision: input.revision,
      action: input.action,
    });
    return this.transaction(() => {
      check(
        this.isMember(invite, who),
        403,
        'Join this run with its invitation first.',
      );
      const g = this.load(invite),
        old = this.db
          .prepare(
            'SELECT body FROM folio_commands WHERE run=? AND actor=? AND request_id=?',
          )
          .get(invite, who.id, input.requestId as string) as
          | { body: string }
          | undefined;
      if (old) {
        check(
          old.body === body,
          409,
          'That action identifier was already used.',
        );
        return this.view(invite, who, g, now);
      }
      check(
        g.revision === input.revision,
        409,
        'A teammate just changed the puzzle. Take a look and try again.',
      );
      const action = input.action as Action;
      check(
        action.type !== 'dev-win' || process.env.NODE_ENV === 'development',
        403,
        'Auto-win is only available in development.',
      );
      try {
        if (action.type === 'start') startFolio(g, this.count(invite), now);
        else actFolio(g, action, now);
      } catch (error) {
        throw new HttpError(
          400,
          error instanceof Error
            ? error.message
            : 'That action is not available.',
        );
      }
      this.save(invite, g);
      this.db
        .prepare('INSERT INTO folio_commands VALUES (?,?,?,?)')
        .run(invite, who.id, input.requestId as string, body);
      return this.view(invite, who, g, now);
    });
  }
}
