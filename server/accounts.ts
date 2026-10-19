import type { DatabaseSync } from 'node:sqlite';
import { check, digest, displayName, emailAddress, hashPassword, token, verifyPassword, type Identity } from './auth.ts';
import { Leaderboards } from './leaderboards.ts';

/** Account changes live beside the existing cookie/session implementation. */
export class Accounts {
  private db: DatabaseSync;
  constructor(db: DatabaseSync) { this.db = db; }

  recoveryCode(userId: string) {
    const code = token();
    this.db.prepare('INSERT INTO account_recovery VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET hash=excluded.hash, created_at=excluded.created_at')
      .run(userId, digest(code), Date.now());
    return code;
  }

  private user(who: Identity | null) {
    check(who?.userId, 401, 'Log in to manage your account.');
    const user = this.db.prepare('SELECT id,name,email,password FROM users WHERE id=?').get(who.userId) as
      { id: string; name: string; email: string; password: string } | undefined;
    check(user, 401, 'Log in to manage your account.');
    return user;
  }

  private stillCurrent(who: Identity, password: string) {
    check(this.db.prepare('SELECT 1 FROM users u JOIN sessions s ON s.user_id=u.id WHERE u.id=? AND u.password=? AND s.hash=? AND s.expires>?')
      .get(who.userId!, password, who.sessionHash, Date.now()), 401, 'Your account changed. Log in again.');
  }

  profile(who: Identity | null, input: Record<string, unknown>) {
    const user = this.user(who), name = displayName(input.name);
    this.db.prepare('UPDATE users SET name=? WHERE id=?').run(name, user.id);
    return { user: { id: user.id, name, email: user.email } };
  }

  async password(who: Identity | null, input: Record<string, unknown>) {
    const user = this.user(who);
    check(await verifyPassword(input.currentPassword, user.password), 401, 'Current password is incorrect.');
    const password = await hashPassword(input.password);
    this.stillCurrent(who!, user.password);
    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.db.prepare('UPDATE users SET password=? WHERE id=?').run(password, user.id);
      this.db.prepare('DELETE FROM sessions WHERE user_id=?').run(user.id);
      this.db.exec('COMMIT');
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
    return user.id;
  }

  async generateRecovery(who: Identity | null, input: Record<string, unknown>) {
    const user = this.user(who);
    check(await verifyPassword(input.password, user.password), 401, 'Password is incorrect.');
    this.stillCurrent(who!, user.password);
    return { recoveryCode: this.recoveryCode(user.id) };
  }

  async recover(input: Record<string, unknown>) {
    const email = emailAddress(input.email);
    check(typeof input.recoveryCode === 'string' && input.recoveryCode.length <= 128, 400, 'Enter your recovery code.');
    const hash = digest(input.recoveryCode.trim());
    const row = this.db.prepare('SELECT u.id FROM users u JOIN account_recovery r ON r.user_id=u.id WHERE u.email=? AND r.hash=?').get(email, hash) as { id: string } | undefined;
    // Perform password work on both paths, without disclosing whether the email exists.
    const password = await hashPassword(input.password);
    check(row, 401, 'Email or recovery code is incorrect.');
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const consumed = this.db.prepare('DELETE FROM account_recovery WHERE user_id=? AND hash=?').run(row.id, hash);
      check(consumed.changes === 1, 401, 'Email or recovery code is incorrect.');
      this.db.prepare('UPDATE users SET password=? WHERE id=?').run(password, row.id);
      this.db.prepare('DELETE FROM sessions WHERE user_id=?').run(row.id);
      const recoveryCode = this.recoveryCode(row.id);
      this.db.exec('COMMIT');
      return { id: row.id, recoveryCode };
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }

  /**
   * A guest logged in to an existing account on this device. Their results
   * join the account's (replayed in play order), and the rooms only they
   * played in come along: their unfinished rated games, solo Puzzles runs and
   * solo Lucky desks. Shared rooms keep the guest seat, as before. A rated
   * game settled because the account already had one of that game is
   * removed; returns those tables so their timers and streams can stop.
   */
  adoptGuest(guest: string, account: string, now = Date.now()): string[] {
    if (guest === account) return [];
    const swap = (state: string) => state.split(JSON.stringify(guest)).join(JSON.stringify(account));
    const removed: string[] = [];
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const settled = new Set(new Leaderboards(this.db).merge(guest, account, now));
      for (const row of this.db.prepare('SELECT token,state FROM tables WHERE owner=?').all(guest) as { token: string; state: string }[]) {
        if (!(JSON.parse(row.state) as { rankedSolo?: boolean }).rankedSolo) continue;
        if (settled.has(`/table/${row.token}`)) {
          this.db.prepare('DELETE FROM commands WHERE table_token=?').run(row.token);
          this.db.prepare('DELETE FROM tables WHERE token=?').run(row.token);
          removed.push(row.token);
          continue;
        }
        this.db.prepare('UPDATE tables SET owner=?, state=? WHERE token=?').run(account, swap(row.state), row.token);
        this.db.prepare('UPDATE commands SET actor=? WHERE table_token=? AND actor=?').run(account, row.token, guest);
      }
      if (this.db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='rota_rooms'").get())
        for (const row of this.db.prepare('SELECT token,state FROM rota_rooms WHERE instr(state, ?) > 0').all(guest) as { token: string; state: string }[]) {
          const state = JSON.parse(row.state) as { rankedSolo?: boolean; owner?: string };
          if (!state.rankedSolo || state.owner !== guest) continue;
          if (settled.has(`/rota/${row.token}`)) this.db.prepare('DELETE FROM rota_rooms WHERE token=?').run(row.token);
          else this.db.prepare('UPDATE rota_rooms SET state=? WHERE token=?').run(swap(row.state), row.token);
        }
      for (const [rooms, members, key, commands] of [['folio_runs', 'folio_members', 'run', 'folio_commands'], ['expeditions', 'expedition_members', 'expedition', 'expedition_commands']] as const) {
        const solo = this.db
          .prepare(`SELECT m.${key} AS token FROM ${members} m WHERE m.actor=? AND (SELECT COUNT(*) FROM ${members} o WHERE o.${key}=m.${key})=1`)
          .all(guest) as { token: string }[];
        for (const { token: room } of solo) {
          const row = this.db.prepare(`SELECT state FROM ${rooms} WHERE token=?`).get(room) as { state: string } | undefined;
          if (row) this.db.prepare(`UPDATE ${rooms} SET state=? WHERE token=?`).run(swap(row.state), room);
          this.db.prepare(`UPDATE ${members} SET actor=? WHERE ${key}=? AND actor=?`).run(account, room, guest);
          // Receipts move too, so a retried action is still recognised.
          this.db.prepare(`UPDATE ${commands} SET actor=? WHERE ${key}=? AND actor=?`).run(account, room, guest);
        }
      }
      // The guest's other cookies must not keep acting as this player.
      this.db.prepare('DELETE FROM sessions WHERE guest_id=?').run(guest);
      this.db.exec('COMMIT');
      return removed;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  async delete(who: Identity | null, input: Record<string, unknown>) {
    const user = this.user(who);
    check(await verifyPassword(input.password, user.password), 401, 'Password is incorrect.');
    this.stillCurrent(who!, user.password);
    const removedTables: string[] = [];
    const anonymous = `deleted-${token()}`;
    // Keep other players' shared games, replacing this person's identity in them.
    const scrub = (value: unknown): unknown => {
      if (value === user.id) return anonymous;
      if (Array.isArray(value)) return value.map(scrub);
      if (!value || typeof value !== 'object') return value;
      const object = value as Record<string, unknown>;
      const belongs = object.id === user.id || object.actor === user.id;
      return Object.fromEntries(Object.entries(object).map(([key, child]) => [key === user.id ? anonymous : key,
        belongs && key === 'name' ? 'Deleted player' : scrub(child)]));
    };
    // Engines store names by seat, separately from the table's identity list.
    // Updating only members would leave the old name on boards and results.
    const scrubSeatedState = (state: Record<string, unknown>) => {
      const seats = Array.isArray(state.seats) ? state.seats : [];
      const indexes = seats.flatMap((seat, index) =>
        seat === user.id || (seat && typeof seat === 'object' && seat.id === user.id) ? [index] : []);
      for (const key of ['game', 'adventure']) {
        const game = state[key] as { players?: { name?: string }[]; seats?: (string | { name?: string })[]; log?: { text: string }[]; events?: { text: string }[] } | undefined;
        if (!game) continue;
        const names = new Set<string>();
        for (const index of indexes) {
          const player = game.players?.[index];
          if (typeof player?.name === 'string') { names.add(player.name); player.name = 'Deleted player'; }
          const seat = game.seats?.[index];
          if (typeof seat === 'string') { names.add(seat); game.seats![index] = 'Deleted player'; }
          else if (typeof seat?.name === 'string') { names.add(seat.name); seat.name = 'Deleted player'; }
        }
        // Party history may combine all players' names in one sentence. It
        // does not affect scoring; remove the lines naming the deleted seat.
        if (game.log && names.size) game.log = game.log.filter((entry) => ![...names].some((name) => name && entry.text.includes(name)));
        // Trio events also drive trick reveals and motion. Preserve every
        // event and its engine metadata, replacing only the displayed name.
        const escapedNames = [...names].filter(Boolean).sort((a, b) => b.length - a.length)
          .map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
        if (game.events && escapedNames.length) {
          const namePattern = new RegExp(`(?<![\\p{L}\\p{N}_])(?:${escapedNames.join('|')})(?![\\p{L}\\p{N}_])`, 'gu');
          for (const event of game.events) event.text = event.text.replace(namePattern, 'Deleted player');
        }
      }
      return scrub(state);
    };
    this.db.exec('BEGIN IMMEDIATE');
    try {
      for (const row of this.db.prepare('SELECT token,owner,state FROM tables').all() as { token: string; owner: string; state: string }[]) {
        if (row.owner === user.id) {
          this.db.prepare('DELETE FROM commands WHERE table_token=?').run(row.token);
          this.db.prepare('DELETE FROM tables WHERE token=?').run(row.token);
          removedTables.push(row.token);
        } else if (row.state.includes(user.id)) {
          this.db.prepare('UPDATE tables SET state=? WHERE token=?').run(JSON.stringify(scrubSeatedState(JSON.parse(row.state))), row.token);
        }
      }
      for (const [table, memberTable, key] of [['folio_runs', 'folio_members', 'run'], ['expeditions', 'expedition_members', 'expedition']] as const) {
        const rooms = this.db.prepare(`SELECT ${key} token FROM ${memberTable} WHERE actor=?`).all(user.id) as { token: string }[];
        for (const room of rooms) {
          const remaining = (this.db.prepare(`SELECT actor FROM ${memberTable} WHERE ${key}=? AND actor<>? ORDER BY joined_at,actor`).all(room.token, user.id) as { actor: string }[])
            .filter((member) => !member.actor.startsWith('deleted-'));
          if (!remaining.length) this.db.prepare(`DELETE FROM ${table} WHERE token=?`).run(room.token);
          else {
            const row = this.db.prepare(`SELECT state FROM ${table} WHERE token=?`).get(room.token) as { state: string };
            const state = JSON.parse(row.state);
            if (state.host === user.id) state.host = remaining[0].actor;
            this.db.prepare(`UPDATE ${table} SET state=? WHERE token=?`).run(JSON.stringify(scrub(state)), room.token);
            this.db.prepare(`UPDATE ${memberTable} SET actor=?,name=? WHERE ${key}=? AND actor=?`).run(anonymous, 'Deleted player', room.token, user.id);
          }
        }
      }
      for (const table of ['rota_rooms', 'alto_rooms']) {
        if (!this.db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table)) continue;
        for (const row of this.db.prepare(`SELECT token,state FROM ${table}`).all() as { token: string; state: string }[]) {
          if (!row.state.includes(user.id)) continue;
          const state = JSON.parse(row.state);
          const remaining = state.members?.filter((m: { id: string }) => m.id !== user.id && !m.id.startsWith('deleted-')) ?? [];
          if (!remaining.length) this.db.prepare(`DELETE FROM ${table} WHERE token=?`).run(row.token);
          else {
            if (state.owner === user.id) state.owner = remaining[0].id;
            if (removedTables.includes(state.table)) state.table = null;
            this.db.prepare(`UPDATE ${table} SET state=? WHERE token=?`).run(JSON.stringify(scrubSeatedState(state)), row.token);
          }
        }
      }
      for (const table of ['commands', 'folio_commands', 'expedition_commands']) this.db.prepare(`DELETE FROM ${table} WHERE actor=?`).run(user.id);
      this.db.prepare('DELETE FROM content_flags WHERE actor=?').run(user.id);
      new Leaderboards(this.db).forget(user.id);
      this.db.prepare('DELETE FROM sessions WHERE user_id=? OR guest_id=?').run(user.id, user.id);
      this.db.prepare('DELETE FROM guests WHERE id=?').run(user.id);
      this.db.prepare('DELETE FROM users WHERE id=?').run(user.id);
      this.db.exec('COMMIT');
      return { removedTables, userId: user.id };
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
}
