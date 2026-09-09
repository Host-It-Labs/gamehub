import { backup } from 'node:sqlite';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { openDatabase } from '../server/database.ts';
const destination = process.argv[2];
if (!destination || existsSync(destination))
  throw new Error(
    'Pass a new backup file path; existing backups are never overwritten.',
  );
const db = openDatabase(process.env.DATABASE_PATH ?? '.data/gamehub.sqlite');
try {
  await backup(db, resolve(destination));
  console.log('Database backup completed.');
} finally {
  db.close();
}
