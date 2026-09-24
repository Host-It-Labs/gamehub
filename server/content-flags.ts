import type { DatabaseSync } from 'node:sqlite';
import { topics } from '../lib/games/party/catalog.ts';
import { spectrums } from '../lib/games/party/spectrums.ts';

/** Players mark prompts that fall flat; the log steers the next catalog pass. */
export function flaggedTitle(gameId: unknown, key: unknown): string | null {
  if (typeof key !== 'number' || !Number.isInteger(key)) return null;
  if (gameId === 'orin') return topics[key]?.title ?? null;
  if (gameId === 'dial') {
    const s = spectrums[key];
    return s ? `${s.left} – ${s.right}` : null;
  }
  return null;
}
export function flagContent(
  db: DatabaseSync,
  who: { id: string; userId: string | null },
  gameId: 'orin' | 'dial',
  key: number,
  title: string,
) {
  db.prepare(
    'INSERT OR IGNORE INTO content_flags (game_id, content_key, title, actor, user_id, created_at) VALUES (?,?,?,?,?,?)',
  ).run(gameId, String(key), title, who.id, who.userId, Date.now());
}
