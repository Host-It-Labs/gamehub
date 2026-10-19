import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export function openDatabase(path: string) {
  if (path !== ':memory:')
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path);
  db.exec(
    'PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;',
  );
  const version = (
    db.prepare('PRAGMA user_version').get() as { user_version: number }
  ).user_version;
  if (version > 8)
    throw new Error(
      'Database is newer than this application; restore a compatible backup before downgrading.',
    );
  if (version === 0)
    db.exec(`
    BEGIN IMMEDIATE;
    CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL, password TEXT NOT NULL);
    CREATE TABLE guests (id TEXT PRIMARY KEY, name TEXT NOT NULL);
    CREATE TABLE sessions (hash TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id), guest_id TEXT REFERENCES guests(id), expires INTEGER NOT NULL);
    CREATE INDEX sessions_expiry ON sessions(expires);
    CREATE TABLE tables (token TEXT PRIMARY KEY, owner TEXT NOT NULL REFERENCES users(id), state TEXT NOT NULL);
    CREATE INDEX tables_owner ON tables(owner);
    CREATE TABLE commands (table_token TEXT NOT NULL REFERENCES tables(token), actor TEXT NOT NULL, request_id TEXT NOT NULL, body TEXT NOT NULL, PRIMARY KEY(table_token, actor, request_id));
    CREATE TABLE user_preferences (user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, key TEXT NOT NULL, value TEXT NOT NULL, PRIMARY KEY(user_id, key));
    PRAGMA user_version=2;
    COMMIT;
  `);
  if (version === 1)
    db.exec(`
    BEGIN IMMEDIATE;
    CREATE TABLE user_preferences (user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, key TEXT NOT NULL, value TEXT NOT NULL, PRIMARY KEY(user_id, key));
    PRAGMA user_version=2;
    COMMIT;
  `);
  if (version < 3)
    db.exec(`
      BEGIN IMMEDIATE;
      CREATE TABLE user_content_history (
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        game_id TEXT NOT NULL,
        content_key TEXT NOT NULL,
        PRIMARY KEY(user_id, game_id, content_key)
      );
      PRAGMA user_version=3;
      COMMIT;
    `);
  if (version < 4)
    db.exec(`
      BEGIN IMMEDIATE;
      CREATE TABLE expeditions (token TEXT PRIMARY KEY, state TEXT NOT NULL);
      CREATE TABLE expedition_members (
        expedition TEXT NOT NULL REFERENCES expeditions(token) ON DELETE CASCADE,
        actor TEXT NOT NULL, name TEXT NOT NULL, joined_at INTEGER NOT NULL, seen_at INTEGER NOT NULL,
        PRIMARY KEY(expedition, actor)
      );
      CREATE INDEX expedition_members_actor ON expedition_members(actor);
      CREATE TABLE expedition_commands (
        expedition TEXT NOT NULL REFERENCES expeditions(token) ON DELETE CASCADE,
        actor TEXT NOT NULL, request_id TEXT NOT NULL, body TEXT NOT NULL, result TEXT NOT NULL,
        PRIMARY KEY(expedition, actor, request_id)
      );
      PRAGMA user_version=4;
      COMMIT;
    `);
  if (version < 5)
    db.exec(`
      BEGIN IMMEDIATE;
      CREATE TABLE folio_runs (token TEXT PRIMARY KEY, state TEXT NOT NULL);
      CREATE TABLE folio_members (
        run TEXT NOT NULL REFERENCES folio_runs(token) ON DELETE CASCADE,
        actor TEXT NOT NULL, name TEXT NOT NULL, joined_at INTEGER NOT NULL, seen_at INTEGER NOT NULL,
        PRIMARY KEY(run, actor)
      );
      CREATE INDEX folio_members_actor ON folio_members(actor);
      CREATE TABLE folio_commands (
        run TEXT NOT NULL REFERENCES folio_runs(token) ON DELETE CASCADE,
        actor TEXT NOT NULL, request_id TEXT NOT NULL, body TEXT NOT NULL,
        PRIMARY KEY(run, actor, request_id)
      );
      PRAGMA user_version=5;
      COMMIT;
    `);
  if (version < 6)
    db.exec(`
      BEGIN IMMEDIATE;
      CREATE TABLE content_flags (
        id INTEGER PRIMARY KEY,
        game_id TEXT NOT NULL, content_key TEXT NOT NULL, title TEXT NOT NULL,
        actor TEXT NOT NULL, user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        created_at INTEGER NOT NULL,
        UNIQUE(game_id, content_key, actor)
      );
      CREATE INDEX content_flags_content ON content_flags(game_id, content_key);
      PRAGMA user_version=6;
      COMMIT;
    `);
  if (version < 7)
    db.exec(`
      BEGIN IMMEDIATE;
      CREATE TABLE account_recovery (
        user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        hash TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      PRAGMA user_version=7;
      COMMIT;
    `);
  if (version < 8) {
    // Rankings that just happen (19 October 2026). Guests own private rated
    // tables, so a table's owner is any player id, not only an account; the
    // table is rebuilt without that foreign key. Rankings are keyed by player
    // id too, and are public once that id has an account. The leaderboard
    // tables of the unreleased first layout are replaced.
    db.exec('PRAGMA foreign_keys=OFF');
    try {
      db.exec(`
        BEGIN IMMEDIATE;
        DROP TABLE IF EXISTS leaderboard_records;
        DROP TABLE IF EXISTS leaderboard_runs;
        DROP TABLE IF EXISTS leaderboard_boards;
        CREATE TABLE tables_v8 (token TEXT PRIMARY KEY, owner TEXT NOT NULL, state TEXT NOT NULL);
        INSERT INTO tables_v8 (token, owner, state) SELECT token, owner, state FROM tables;
        DROP TABLE tables;
        ALTER TABLE tables_v8 RENAME TO tables;
        CREATE INDEX tables_owner ON tables(owner);
        DELETE FROM commands WHERE table_token NOT IN (SELECT token FROM tables);
        CREATE TABLE leaderboard_runs (
          id TEXT PRIMARY KEY,
          actor_id TEXT NOT NULL,
          game_id TEXT NOT NULL,
          board_key TEXT NOT NULL,
          kind TEXT NOT NULL CHECK(kind IN ('rating','score','puzzles','progress')),
          room TEXT NOT NULL,
          label TEXT NOT NULL,
          opponents INTEGER NOT NULL DEFAULT 0,
          status TEXT NOT NULL CHECK(status IN ('active','finished','forfeit','abandoned','disqualified')),
          value INTEGER,
          won INTEGER NOT NULL DEFAULT 0,
          outcome TEXT,
          rating_before INTEGER,
          rating_after INTEGER,
          started_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          finished_at INTEGER
        );
        CREATE UNIQUE INDEX leaderboard_runs_one_active_game
          ON leaderboard_runs(actor_id, game_id)
          WHERE status = 'active' AND kind IN ('rating','score');
        CREATE INDEX leaderboard_runs_history ON leaderboard_runs(actor_id, game_id, finished_at);
        CREATE INDEX leaderboard_runs_room ON leaderboard_runs(room, actor_id);
        CREATE TABLE leaderboard_standings (
          board_key TEXT NOT NULL,
          actor_id TEXT NOT NULL,
          value INTEGER NOT NULL,
          games INTEGER NOT NULL,
          wins INTEGER NOT NULL,
          streak INTEGER NOT NULL,
          best_streak INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          PRIMARY KEY(board_key, actor_id)
        );
        CREATE INDEX leaderboard_standings_rank ON leaderboard_standings(board_key, value DESC, updated_at);
        CREATE TABLE leaderboard_launches (
          actor_id TEXT NOT NULL,
          request_id TEXT NOT NULL,
          payload TEXT NOT NULL,
          url TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          PRIMARY KEY(actor_id, request_id)
        );
        CREATE INDEX leaderboard_launches_age ON leaderboard_launches(created_at);
        PRAGMA user_version=8;
        COMMIT;
      `);
    } catch (error) {
      if (db.isTransaction) db.exec('ROLLBACK');
      throw error;
    } finally {
      db.exec('PRAGMA foreign_keys=ON');
    }
  } else if (version === 8) {
    // Development databases opened by an earlier draft of v8 limited one
    // unfinished run per kind; it is one per game now.
    try {
      db.exec(`DROP INDEX IF EXISTS leaderboard_runs_one_active;
        CREATE UNIQUE INDEX IF NOT EXISTS leaderboard_runs_one_active_game
          ON leaderboard_runs(actor_id, game_id) WHERE status = 'active' AND kind IN ('rating','score');`);
    } catch {
      /* Two unfinished runs of one game: the next start settles them. */
    }
  }
  return db;
}
