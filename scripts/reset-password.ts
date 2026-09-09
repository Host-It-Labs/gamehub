import { openDatabase } from '../server/database.ts';
import { emailAddress, hashPassword } from '../server/auth.ts';
const email = emailAddress(process.argv[2]);
if (process.stdin.isTTY)
  throw new Error(
    'Pipe the new password on standard input; do not put passwords in command arguments.',
  );
let password = '';
for await (const chunk of process.stdin) {
  password += chunk;
  if (password.length > 256) throw new Error('Password too long.');
}
const hash = await hashPassword(password.replace(/\r?\n$/, ''));
const db = openDatabase(process.env.DATABASE_PATH ?? '.data/gamehub.sqlite');
try {
  db.exec('BEGIN IMMEDIATE');
  const user = db.prepare('SELECT id FROM users WHERE email=?').get(email) as
    | { id: string }
    | undefined;
  if (!user) throw new Error('Account not found.');
  db.prepare('UPDATE users SET password=? WHERE id=?').run(hash, user.id);
  db.prepare('DELETE FROM sessions WHERE user_id=?').run(user.id);
  db.exec('COMMIT');
  console.log('Password updated and existing sessions revoked.');
} finally {
  db.close();
}
