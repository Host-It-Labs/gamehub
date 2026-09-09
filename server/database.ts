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
  if (version > 1)
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
    PRAGMA user_version=1;
    COMMIT;
  `);
  return db;
}
