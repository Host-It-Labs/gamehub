import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { openDatabase } from '../server/database.ts';
import {
  hashPassword,
  verifyPassword,
  newSession,
  digest,
} from '../server/auth.ts';

test('password reset revokes sessions; consistent backups restore and refuse overwrite', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'gamehub-recovery-')),
    path = join(dir, 'live.sqlite'),
    backup = join(dir, 'backup.sqlite');
  const db = openDatabase(path);
  try {
    const original = await hashPassword('original-password');
    db.prepare('INSERT INTO users VALUES (?,?,?,?)').run(
      'user',
      'user@example.com',
      'User',
      original,
    );
    const cookie = newSession(db, 'user', true, true);
    assert.match(cookie, /; Secure$/);
    const raw = cookie.split(';')[0].slice('gamehub_session='.length);
    assert.ok(
      db.prepare('SELECT hash FROM sessions WHERE hash=?').get(digest(raw)),
    );
    assert.equal(
      db.prepare('SELECT hash FROM sessions WHERE hash=?').get(raw),
      undefined,
    );
    execFileSync(
      process.execPath,
      [
        '--experimental-strip-types',
        'scripts/reset-password.ts',
        'user@example.com',
      ],
      {
        env: { ...process.env, DATABASE_PATH: path },
        input: 'replacement-password',
        stdio: ['pipe', 'pipe', 'pipe'],
      },
    );
    const saved = db.prepare('SELECT password FROM users').get().password;
    assert.notEqual(saved, 'replacement-password');
    assert.equal(await verifyPassword('replacement-password', saved), true);
    assert.equal(db.prepare('SELECT count(*) n FROM sessions').get().n, 0);
    execFileSync(
      process.execPath,
      ['--experimental-strip-types', 'scripts/backup.ts', backup],
      { env: { ...process.env, DATABASE_PATH: path }, stdio: 'pipe' },
    );
    assert.throws(() =>
      execFileSync(
        process.execPath,
        ['--experimental-strip-types', 'scripts/backup.ts', backup],
        { env: { ...process.env, DATABASE_PATH: path }, stdio: 'pipe' },
      ),
    );
    const restored = openDatabase(backup);
    try {
      assert.deepEqual(
        restored.prepare('SELECT * FROM users').all(),
        db.prepare('SELECT * FROM users').all(),
      );
    } finally {
      restored.close();
    }
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
