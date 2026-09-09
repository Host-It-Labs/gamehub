import { randomBytes, scrypt, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import type { DatabaseSync } from 'node:sqlite';
import type { IncomingMessage } from 'node:http';

const derive = promisify(scrypt);
export const token = () => randomBytes(24).toString('base64url');
export const digest = (value: string) =>
  createHash('sha256').update(value).digest('hex');
export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
export function check(
  condition: unknown,
  status: number,
  message: string,
): asserts condition {
  if (!condition) throw new HttpError(status, message);
}
export function displayName(value: unknown) {
  check(typeof value === 'string', 400, 'Enter your name.');
  const name = value.trim();
  check(
    name.length >= 1 &&
      name.length <= 30 &&
      !name
        .split('')
        .some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127),
    400,
    'Use a name of 1–30 characters.',
  );
  return name;
}
export function emailAddress(value: unknown) {
  check(
    typeof value === 'string' && value.length <= 254,
    400,
    'Enter a valid email.',
  );
  const email = value.trim().toLowerCase();
  check(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), 400, 'Enter a valid email.');
  return email;
}
export async function hashPassword(password: unknown) {
  check(
    typeof password === 'string' &&
      password.length >= 10 &&
      password.length <= 128,
    400,
    'Use a password of 10–128 characters.',
  );
  const salt = randomBytes(16).toString('hex');
  const key = (await derive(password, salt, 64)) as Buffer;
  return `${salt}:${key.toString('hex')}`;
}
export async function verifyPassword(password: unknown, stored: string) {
  check(
    typeof password === 'string' && password.length <= 128,
    400,
    'Enter your password.',
  );
  const [salt, hex] = stored.split(':');
  const key = (await derive(password, salt, 64)) as Buffer;
  return timingSafeEqual(key, Buffer.from(hex, 'hex'));
}
export type Identity = {
  id: string;
  name: string;
  userId: string | null;
  email?: string;
  sessionHash: string;
  expires: number;
};
export function identity(
  db: DatabaseSync,
  req: IncomingMessage,
): Identity | null {
  const raw = req.headers.cookie
    ?.split(';')
    .map((s) => s.trim())
    .find((s) => s.startsWith('gamehub_session='))
    ?.slice(16);
  if (!raw || raw.length > 100) return null;
  const sessionHash = digest(raw);
  const row = db
    .prepare(
      `SELECT s.user_id, s.guest_id, s.expires, COALESCE(u.name,g.name) name, u.email FROM sessions s LEFT JOIN users u ON u.id=s.user_id LEFT JOIN guests g ON g.id=s.guest_id WHERE s.hash=? AND s.expires>?`,
    )
    .get(sessionHash, Date.now()) as
    | {
        user_id: string | null;
        guest_id: string | null;
        name: string;
        email?: string;
        expires: number;
      }
    | undefined;
  return row
    ? {
        id: row.user_id ?? row.guest_id!,
        userId: row.user_id,
        name: row.name,
        email: row.email,
        sessionHash,
        expires: row.expires,
      }
    : null;
}
export function newSession(
  db: DatabaseSync,
  id: string,
  user: boolean,
  secure: boolean,
) {
  const raw = token(),
    seconds = 60 * 60 * 24 * (user ? 30 : 365);
  db.prepare('DELETE FROM sessions WHERE expires<?').run(Date.now());
  db.prepare('INSERT INTO sessions VALUES (?,?,?,?)').run(
    digest(raw),
    user ? id : null,
    user ? null : id,
    Date.now() + seconds * 1000,
  );
  return `gamehub_session=${raw}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${seconds}${secure ? '; Secure' : ''}`;
}
