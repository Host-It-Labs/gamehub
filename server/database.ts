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
  if (version > 5)
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
  return db;
}
