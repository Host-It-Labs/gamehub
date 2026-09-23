import { scratchFor } from '../lib/games/relic/scratch.ts';
import type { DatabaseSync } from 'node:sqlite';
import { randomBytes } from 'node:crypto';
import { check, HttpError, token, type Identity } from './auth.ts';
import {
  actRelic,
  advanceRelic,
  createRelic,
  WORLDS,
  type RelicAction,
  type RelicGame,
} from '../lib/games/relic/engine.ts';
import type {
  ExpeditionSummary,
  ExpeditionView,
} from '../lib/games/relic/types.ts';

/** Synchronous SQLite transactions serialize shared purchases and dig actions. */
export class Expeditions {
  private readonly db: DatabaseSync;
  // Ephemeral, per-tab activity. Restarting a server never resumes an idle clock.
  private activitySessions = new Map<string, number>();
  private activityPaid = new Map<string, number>();
  constructor(db: DatabaseSync) {
    this.db = db;
  }
  private transaction<T>(work: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result = work();
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }
  private load(invite: string): RelicGame {
    const row = this.db
      .prepare('SELECT state FROM expeditions WHERE token=?')
      .get(invite) as { state: string } | undefined;
    check(
      row,
      404,
      'This expedition could not be found. Check the invitation link.',
    );
    const game = JSON.parse(row.state) as RelicGame;
    scratchFor(game);
    return game;
  }
  private save(invite: string, game: RelicGame) {
    this.db
      .prepare('UPDATE expeditions SET state=? WHERE token=?')
      .run(JSON.stringify(game), invite);
  }
  private member(invite: string, who: Identity) {
    check(
      this.db
        .prepare(
          'SELECT 1 FROM expedition_members WHERE expedition=? AND actor=?',
        )
        .get(invite, who.id),
      403,
      'Join this expedition using its invitation first.',
    );
  }
  private view(
    invite: string,
    who: Identity,
    game: RelicGame,
    now: number,
  ): ExpeditionView {
    this.db
      .prepare(
        'UPDATE expedition_members SET seen_at=?, name=? WHERE expedition=? AND actor=?',
      )
      .run(now, who.name, invite, who.id);
    const rows = this.db
      .prepare(
        'SELECT actor, name, seen_at FROM expedition_members WHERE expedition=? ORDER BY joined_at, actor',
      )
      .all(invite) as { actor: string; name: string; seen_at: number }[];
    return {
      token: invite,
      game,
      viewerId: who.id,
      serverNow: now,
      members: rows.map((r) => ({
        id: r.actor,
        name: r.name,
        online: now - r.seen_at < 15000,
      })),
    };
  }
  list(who: Identity): ExpeditionSummary[] {
    const rows = this.db
      .prepare(
        'SELECT e.token,e.state FROM expeditions e JOIN expedition_members m ON m.expedition=e.token WHERE m.actor=? ORDER BY m.seen_at DESC',
      )
      .all(who.id) as { token: string; state: string }[];
    return rows.map((row) => {
      const g = JSON.parse(row.state) as RelicGame;
      const members = this.db
        .prepare(
          'SELECT name FROM expedition_members WHERE expedition=? ORDER BY joined_at, actor',
        )
        .all(row.token) as { name: string }[];
      return {
        token: row.token,
        name: g.name,
        world: g.world,
        finds: Object.keys(g.collection).length,
        tickets: scratchFor(g).completed,
        layer: g.layers[g.world],
        members: members.map((m) => m.name),
        lastAt: g.lastAt,
      };
    });
  }
  create(who: Identity, input: Record<string, unknown>, now = Date.now()) {
    check(
      this.list(who).length < 50,
      400,
      'You already have 50 expeditions. Resume one of your existing groups.',
    );
    check(
      typeof input.title === 'string' &&
        input.title.trim().length > 0 &&
        input.title.trim().length <= 40 &&
        !input.title
          .split('')
          .some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127),
      400,
      'Name your expedition using 1–40 characters.',
    );
    const world = WORLDS.find((w) => w.id === input.world);
    check(world, 400, 'Choose a landscape.');
    const invite = token();
    const game = createRelic(
      input.title.trim(),
      world.id,
      randomBytes(4).readUInt32LE(),
      now,
    );
    return this.transaction(() => {
      this.db
        .prepare('INSERT INTO expeditions VALUES (?,?)')
        .run(invite, JSON.stringify(game));
      this.db
        .prepare('INSERT INTO expedition_members VALUES (?,?,?,?,?)')
        .run(invite, who.id, who.name, now, now);
      return this.view(invite, who, game, now);
    });
  }
  join(invite: string, who: Identity, now = Date.now()) {
    return this.transaction(() => {
      const g = this.load(invite);
      const member = this.db
        .prepare(
          'SELECT 1 FROM expedition_members WHERE expedition=? AND actor=?',
        )
        .get(invite, who.id);
      if (!member) {
        const count = this.db
          .prepare(
            'SELECT count(*) AS n FROM expedition_members WHERE expedition=?',
          )
          .get(invite) as { n: number };
        check(
          count.n < 6,
          409,
          'This expedition already has six explorers. Start a new expedition for this group.',
        );
        this.db
          .prepare('INSERT INTO expedition_members VALUES (?,?,?,?,?)')
          .run(invite, who.id, who.name, now, now);
      }
      advanceRelic(g, now);
      this.save(invite, g);
      return this.view(invite, who, g, now);
    });
  }
  get(invite: string, who: Identity, now = Date.now()) {
    return this.transaction(() => {
      this.member(invite, who);
      const g = this.load(invite);
      advanceRelic(g, now);
      this.save(invite, g);
      return this.view(invite, who, g, now);
    });
  }
  activity(
    invite: string,
    who: Identity,
    input: Record<string, unknown>,
    now = Date.now(),
  ) {
    check(
      typeof input.sessionId === 'string' &&
        /^[A-Za-z0-9_-]{16,80}$/.test(input.sessionId),
      400,
      'Invalid play session.',
    );
    check(typeof input.playing === 'boolean', 400, 'Choose an activity state.');
    this.member(invite, who);
    const key = `${invite}:${who.id}:${input.sessionId}`;
    const previous = this.activitySessions.get(key);
    const activeMs =
      input.playing &&
      previous !== undefined &&
      now >= previous &&
      now - previous <= 2500
        ? Math.max(
            0,
            now - Math.max(previous, this.activityPaid.get(invite) ?? previous),
          )
        : 0;
    const result = this.transaction(() => {
      const g = this.load(invite);
      advanceRelic(g, now, activeMs);
      this.save(invite, g);
      return this.view(invite, who, g, now);
    });
    if (input.playing) this.activitySessions.set(key, now);
    else this.activitySessions.delete(key);
    if (activeMs) this.activityPaid.set(invite, now);
    for (const [session, at] of this.activitySessions)
      if (now - at > 5000) this.activitySessions.delete(session);
    for (const [token, at] of this.activityPaid)
      if (now - at > 5000) this.activityPaid.delete(token);
    return result;
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
      input.action &&
        typeof input.action === 'object' &&
        !Array.isArray(input.action),
      400,
      'Choose an expedition action.',
    );
    const body = JSON.stringify(input.action);
    return this.transaction(() => {
      this.member(invite, who);
      const g = this.load(invite);
      const previous = this.db
        .prepare(
          'SELECT body,result FROM expedition_commands WHERE expedition=? AND actor=? AND request_id=?',
        )
        .get(invite, who.id, input.requestId as string) as
        | { body: string; result: string }
        | undefined;
      if (previous) {
        check(
          previous.body === body,
          409,
          'This action identifier has already been used.',
        );
        advanceRelic(g, now);
        this.save(invite, g);
        return {
          ...this.view(invite, who, g, now),
          result: JSON.parse(previous.result),
        };
      }
      check(
        (input.action as RelicAction).type !== 'dev-unlimited' ||
          process.env.NODE_ENV === 'development',
        403,
        'Unlimited coins are only available in development.',
      );
      let result;
      try {
        result = actRelic(
          g,
          input.action as RelicAction,
          who.name,
          now,
          who.id,
        );
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
        .prepare('INSERT INTO expedition_commands VALUES (?,?,?,?,?)')
        .run(
          invite,
          who.id,
          input.requestId as string,
          body,
          JSON.stringify(result),
        );
      return { ...this.view(invite, who, g, now), result };
    });
  }
}
