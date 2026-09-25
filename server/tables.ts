import { requiresHumanPlayers } from '../lib/games/player-policy.ts';

import { placeHistoryKey } from '../lib/games/party/geography.ts';
import type { StandaloneId } from '../lib/games/standalone/types.ts';
import { standaloneGames, isStandaloneId, observe as observeAdventure, botMove as adventureBot, decisionKey as adventureKey, tick as tickAdventure, type AnyGame } from '../lib/games/standalone/registry.ts';
import { practice, adventureLessons } from '../lib/games/adventures/lessons.ts';
import type { OnlineGameId, ShelfGameId } from '../lib/online/types.ts';
import { lessons } from '../lib/games/trio/lessons.ts';
import type { DatabaseSync } from 'node:sqlite';
import { randomInt } from 'node:crypto';
import {
  createGame,
  isSavedGame,
  festivalOrders,
  observe,
  play,
  validMove,
  canAct,
  canUndo,
  simultaneous,
  decisionKey,
  catalog,
  type Game,
  type Move,
  type Difficulty,
  preparationKey,
} from '../lib/games/trio/engine.ts';
import type { Command, GameView, Table } from '../lib/online/types.ts';
import { check, displayName, token, type Identity } from './auth.ts';
import { fallbackMove } from '../lib/games/trio/bot.ts';

type Participant = { id: string; name: string };
type Seat = Participant & { bot: boolean };
export type StoredTable = {
  token: string;
  /** Created the table and hosts it for good: configures, starts, closes. */
  owner: string;
  /** Member picked in the lobby to lead the next match only; cleared when it ends. */
  host?: string;
  gameId: OnlineGameId;
  difficulty: Difficulty;
  shields?: boolean;
  customerOrders?: boolean;
  sanctuaryGoalsEnabled?: boolean;
  contentSet?: 'beginner' | 'intermediate';
  roamEnabled?: boolean;
  turningTide?: boolean;
  marketSeasons?: boolean;
  migration?: boolean;
  salvage?: boolean;
  specialtyStalls?: boolean;
  ambienceEnabled?: boolean;
  fastMode?: boolean;
  capacity: number;
  revision: number;
  status: Table['status'];
  members: Participant[];
  seats: Seat[];
  matchId: string | null;
  game: Game | null;
  adventure?: AnyGame | null;
  botError: boolean;
  setupOpen?: boolean;
  votes?: Partial<Record<ShelfGameId, string[]>>;
  /** After a party match: ten seconds to vote which party game comes next. */
  nextVote?: NextVote | null;
  /** The table moved on to a game with its own online room (Folio, Relic). */
  handoff?: Handoff | null;
};
export type Handoff = { kind: 'folio' | 'relic'; url: string; at: number };
export type NextVote = { endsAt: number; ballots: Record<string, StandaloneId> };
export const nextGameMs = 10_000;
export const partyGames: StandaloneId[] = ['orin', 'miro'];
/** Marks a finished party match and opens the what-next vote. */
function finishAdventure(t: StoredTable, now = Date.now()) {
  if (t.status !== 'playing' || !t.adventure?.over || t.adventure.tutorial) return;
  t.status = 'finished';
  endMatch(t);
  t.nextVote = { endsAt: now + nextGameMs, ballots: {} };
}
/** The most votes wins; a tie is settled at random; silence starts nothing. */
export function nextGameWinner(v: NextVote, pick = (n: number) => randomInt(n)) {
  const tally = new Map<StandaloneId, number>();
  for (const id of Object.values(v.ballots)) tally.set(id, (tally.get(id) ?? 0) + 1);
  const top = Math.max(0, ...tally.values());
  const tied = partyGames.filter((id) => top > 0 && tally.get(id) === top);
  return tied.length ? tied[pick(tied.length)] : null;
}
export function parseMove(value: unknown): Move {
  check(value && typeof value === 'object', 400, 'Invalid move.');
  const m = value as Record<string, unknown>;
  check(
    !('tack' in m) && !('nurture' in m),
    400,
    'This action belongs to an older rules version.',
  );
  if (m.type === 'salvage') {
    check(typeof m.claim === 'boolean', 400, 'Choose Claim or Pass.');
    return { type: 'salvage', claim: m.claim };
  }
  if (m.type === 'roll') return { type: 'roll' };
  if (m.type === 'undo') return { type: 'undo' };
  if (m.type === 'pass') {
    check(
      Array.isArray(m.cards) &&
        m.cards.length >= 2 &&
        m.cards.length <= 5 &&
        m.cards.every(Number.isInteger),
      400,
      'Choose the required two to five cards.',
    );
    return { type: 'pass', cards: m.cards as number[] };
  }
  check(
    m.type === 'play' &&
      Number.isInteger(m.card) &&
      (m.zone === undefined ||
        (Number.isInteger(m.zone) &&
          Number(m.zone) >= 0 &&
          Number(m.zone) < 7)) &&
      (m.ward === undefined || typeof m.ward === 'boolean') &&
      (m.roam === undefined || typeof m.roam === 'boolean') &&
      (m.migration === undefined ||
        (m.migration !== null &&
          typeof m.migration === 'object' &&
          ['card', 'from', 'to'].every((key) =>
            Number.isInteger((m.migration as Record<string, unknown>)[key]),
          ))) &&
      (m.stall === undefined || typeof m.stall === 'boolean') &&
      (m.order === undefined ||
        (Number.isInteger(m.order) &&
          Number(m.order) >= 0 &&
          Number(m.order) < festivalOrders.length)),
    400,
    'Invalid move.',
  );
  return {
    type: 'play',
    card: m.card as number,
    ...(m.zone === undefined ? {} : { zone: m.zone as number }),
    ...(m.ward === undefined ? {} : { ward: m.ward as boolean }),
    ...(m.roam === undefined ? {} : { roam: m.roam as boolean }),
    ...(m.migration === undefined
      ? {}
      : {
          migration: m.migration as { card: number; from: number; to: number },
        }),
    ...(m.order === undefined ? {} : { order: m.order as number }),
    ...(m.stall === undefined ? {} : { stall: m.stall as boolean }),
  };
}
/** Who leads the game on screen: the member picked for this match while it
 *  is being played, otherwise the table's creator, who always hosts the table. */
export function hostOf(t: StoredTable) {
  return t.status === 'playing' && t.members.some((m) => m.id === t.host)
    ? t.host!
    : t.owner;
}
/** The member picked in the lobby to lead the next match, if not the creator. */
export function nextHostOf(t: StoredTable) {
  return t.host !== t.owner && t.members.some((m) => m.id === t.host)
    ? t.host!
    : null;
}
/** A finished match hands the lead back to the table's creator. */
function endMatch(t: StoredTable) {
  t.host = undefined;
}
/** Match-running commands the picked leader may use alongside the creator. */
const leaderCommands = ['lesson', 'advance-practice', 'begin-match', 'retry-bot'];
/** The host moves reveals on; if they drop, any connected seated player may. */
export function mayAdvance(
  t: StoredTable,
  who: string,
  connected: (member: string) => boolean,
) {
  const host = hostOf(t);
  return (
    who === host ||
    (!connected(host) && t.seats.some((s) => s.id === who && !s.bot))
  );
}
export class Tables {
  db: DatabaseSync;
  connected: (table: string, member: string) => boolean;
  constructor(db: DatabaseSync, connected: Tables['connected']) {
    this.db = db;
    this.connected = connected;
    // A rules-version reset ends live games without creating match results.
    for (const row of db.prepare('SELECT state FROM tables').all() as {
      state: string;
    }[]) {
      const table = JSON.parse(row.state) as StoredTable;
      const legacy = { ...table } as unknown as Record<string, unknown>;
      let changed = false;
      // Dial is played inside Tribu and Sizes inside Sabi; their tables open
      // the set's box.
      if (table.gameId === 'dial') { table.gameId = 'orin'; changed = true; }
      if (table.gameId === 'size') { table.gameId = 'miro'; changed = true; }
      if (!catalog.some(c => c.id === table.gameId) && !isStandaloneId(table.gameId)) {
        table.gameId = 'undertow';
        table.game = null;
        table.adventure = null;
        table.matchId = null;
        table.seats = [];
        if (table.status !== 'closed') table.status = 'lobby';
        table.botError = false;
        table.setupOpen = false;
        table.votes = {};
        changed = true;
      }
      // Keep preferences for retained mechanics; new mechanics start disabled.
      for (const [oldKey, newKey, gameId] of [
        ['starter', 'shields', 'undertow'],
        ['nightMarket', 'customerOrders', 'midnight'],
        ['nightMarket', 'specialtyStalls', 'midnight'],
        ['wildTrails', 'sanctuaryGoalsEnabled', 'wildgrove'],
        ['trailcraft', 'roamEnabled', 'wildgrove'],
      ] as const) {
        if (!(oldKey in legacy)) continue;
        if (table[newKey] === undefined)
          table[newKey] = table.gameId === gameId && legacy[oldKey] === true;
        delete (table as unknown as Record<string, unknown>)[oldKey];
        changed = true;
      }
      if (
        table.status === 'playing' &&
        table.game &&
        !isSavedGame(table.game)
      ) {
        table.game = null;
        table.matchId = null;
        table.status = 'lobby';
        table.botError = false;
        changed = true;
      }
      if(isStandaloneId(table.gameId)&&!standaloneGames[table.gameId].seatChoices.includes(table.capacity)){table.capacity=standaloneGames[table.gameId].defaultSeats;changed=true;}
      if(table.adventure && !standaloneGames[table.adventure.kind]?.isSavedGame(table.adventure)){table.adventure=null;table.game=null;table.status='lobby';table.matchId=null;table.seats=[];changed=true;}
      if (changed) {
        table.revision++;
        this.save(table);
      }
    }
  }
  get(invite: string) {
    const row = this.db
      .prepare('SELECT state FROM tables WHERE token=?')
      .get(invite) as { state: string } | undefined;
    check(row, 404, 'This table does not exist.');
    return JSON.parse(row.state) as StoredTable;
  }
  contentUsers(t: StoredTable): string[] {
    const ids = new Set([t.owner, ...t.members.map(m => m.id)]);
    const exists = this.db.prepare('SELECT id FROM users WHERE id=?');
    return [...ids].filter(id => !!exists.get(id));
  }
  contentHistory(t: StoredTable): Set<string> {
    const seen = new Set<string>();
    if (t.gameId !== 'miro') return seen;
    const query = this.db.prepare('SELECT content_key FROM user_content_history WHERE user_id=? AND game_id=?');
    for (const id of this.contentUsers(t))
      for (const row of query.all(id, t.gameId) as { content_key: string }[])
        seen.add(row.content_key);
    return seen;
  }
  save(t: StoredTable) {
    // Savepoints also work inside command's transaction and cover bot/timer saves.
    this.db.exec('SAVEPOINT table_content');
    try {
      const game = t.adventure;
      if (game && !game.tutorial && (game.kind === 'miro')) {
        const keys = game.cityIds.map(placeHistoryKey);
        const insert = this.db.prepare('INSERT OR IGNORE INTO user_content_history (user_id, game_id, content_key) VALUES (?,?,?)');
        for (const id of this.contentUsers(t))
          for (const key of new Set(keys)) insert.run(id, game.kind, key);
      }
      this.db.prepare('UPDATE tables SET state=? WHERE token=?').run(JSON.stringify(t), t.token);
      this.db.exec('RELEASE table_content');
    } catch (error) {
      this.db.exec('ROLLBACK TO table_content; RELEASE table_content');
      throw error;
    }
  }
  exists(invite: string) {
    return !!this.db.prepare('SELECT 1 FROM tables WHERE token=?').get(invite);
  }
  /** Deletes a table outright, so its invite link stops resolving. */
  remove(invite: string) {
    this.db.prepare('DELETE FROM commands WHERE table_token=?').run(invite);
    this.db.prepare('DELETE FROM tables WHERE token=?').run(invite);
  }
  /** Checks the table may move everyone on to a game with its own room. */
  checkLaunch(t: StoredTable, who: Identity) {
    check(t.status !== 'closed', 410, 'This table has closed.');
    check(who.id === t.owner, 403, 'Only the host can do that.');
    check(t.status === 'lobby', 409, 'Return to the lobby first.');
    const offline = t.members.filter((m) => m.id !== who.id && !this.connected(t.token, m.id));
    check(!offline.length, 409, `Disconnected players: ${offline.map((m) => m.name).join(', ')}.`);
  }
  /** Records the room everyone was sent to; the lobby offers it to latecomers. */
  handOff(invite: string, handoff: Omit<Handoff, 'at'>, now = Date.now()) {
    const t = this.get(invite);
    t.handoff = { ...handoff, at: now };
    t.setupOpen = false;
    t.host = undefined;
    t.revision++;
    this.save(t);
    return t;
  }
  create(who: Identity) {
    check(who.userId, 401, 'Sign in to create a table.');
    const existing = this.list(who);
    check(
      existing.length < 30,
      409,
      'Close an existing table before creating another.',
    );
    const t: StoredTable = {
      token: token(),
      owner: who.userId,
      gameId: 'undertow',
      ambienceEnabled: false,
      difficulty: 'medium',
      capacity: 6,
      revision: 0,
      status: 'lobby',
      members: [{ id: who.id, name: who.name }],
      seats: [],
      matchId: null,
      game: null,
      botError: false,
    };
    this.db
      .prepare('INSERT INTO tables VALUES (?,?,?)')
      .run(t.token, t.owner, JSON.stringify(t));
    return t;
  }
  list(who: Identity) {
    if (!who.userId) return [];
    return (
      this.db
        .prepare('SELECT state FROM tables WHERE owner=?')
        .all(who.userId) as { state: string }[]
    )
      .map((r) => JSON.parse(r.state) as StoredTable)
      .filter((t) => t.status !== 'closed')
      .map((t) => ({
        token: t.token,
        gameId: t.gameId,
        status: t.status,
        count: t.members.length,
      }));
  }
  join(invite: string, who: Identity) {
    const t = this.get(invite);
    check(t.status !== 'closed', 410, 'This table has closed.');
    if (!t.members.some((m) => m.id === who.id)) {
      check(
        t.members.length < (t.status === 'lobby' ? t.capacity : 24),
        409,
        'This table is full.',
      );
      t.members.push({ id: who.id, name: who.name });
      t.revision++;
      this.save(t);
    }
    return t;
  }
  view(t: StoredTable, who: Identity): Table {
    check(
      t.members.some((m) => m.id === who.id),
      403,
      'Join the table first.',
    );
    const index = t.seats.findIndex((s) => s.id === who.id && !s.bot);
    let game: GameView | null = null;
    if (t.game && index >= 0 && t.status !== 'closed') {
      const { knownPackets: _privateMemory, ...visible } = observe(
        t.game,
        index,
      );
      game = visible;
    }
    return {
      token: t.token,
      gameId: t.gameId,
      difficulty: t.difficulty,
      shields: t.shields ?? false,
      customerOrders: t.customerOrders ?? false,
      sanctuaryGoalsEnabled: t.sanctuaryGoalsEnabled ?? false,
      contentSet: t.contentSet ?? 'beginner',
      roamEnabled: t.roamEnabled ?? false,
      turningTide: t.turningTide ?? false,
      migration: t.migration,
      salvage: t.salvage,
      specialtyStalls: t.specialtyStalls,
      marketSeasons: t.marketSeasons ?? false,
      fastMode: t.fastMode ?? false,
      ambienceEnabled: t.ambienceEnabled === true,
      capacity: t.capacity,
      revision: t.revision,
      status: t.status,
      viewerId: who.id,
      isHost: t.owner === who.id,
      canAdvance: mayAdvance(t, who.id, (id) => this.connected(t.token, id)),
      viewerSeat: index < 0 ? null : index,
      matchId: t.matchId,
      game,
      adventure: t.adventure ? observeAdventure(t.adventure, index) : null,
      botError: t.botError,
      setupOpen: t.status === 'lobby' && (t.setupOpen ?? false),
      votes: t.votes ?? {},
      nextVote: t.status === 'finished' ? (t.nextVote ?? null) : null,
      handoff: t.handoff ?? null,
      members: [
        ...t.members.map((m, i) => ({
          ...m,
          host: m.id === hostOf(t),
          owner: m.id === t.owner,
          nextHost: t.status === 'lobby' && m.id === nextHostOf(t),
          connected: this.connected(t.token, m.id),
          bot: false,
          seat:
            t.status === 'lobby'
              ? i < t.capacity
                ? i
                : null
              : ((n) => (n < 0 ? null : n))(
                  t.seats.findIndex((s) => s.id === m.id && !s.bot),
                ),
        })),
        ...t.seats.flatMap((s, i) =>
          s.bot ? [{ ...s, host: false, connected: true, seat: i }] : [],
        ),
      ],
    };
  }
  command(invite: string, who: Identity, command: Command) {
    check(
      command &&
        typeof command === 'object' &&
        typeof command.requestId === 'string' &&
        /^[a-zA-Z0-9_-]{16,80}$/.test(command.requestId) &&
        Number.isInteger(command.revision) &&
        command.action &&
        typeof command.action === 'object',
      400,
      'Invalid command.',
    );
    const body = JSON.stringify(command);
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const t = this.get(invite);
      check(
        t.members.some((m) => m.id === who.id),
        403,
        'Join the table first.',
      );
      const old = this.db
        .prepare(
          'SELECT body FROM commands WHERE table_token=? AND actor=? AND request_id=?',
        )
        .get(invite, who.id, command.requestId) as { body: string } | undefined;
      if (old) {
        check(old.body === body, 409, 'This request ID was already used.');
        this.db.exec('COMMIT');
        return t;
      }
      check(t.status !== 'closed', 410, 'This table has closed.');
      check(
        command.matchId === t.matchId &&
          (command.revision === t.revision ||
            command.action.type === 'next-game' ||
            (command.action.type === 'adventure-move' && t.adventure && command.action.key === adventureKey(t.adventure)) ||
            (command.action.type === 'move' &&
              t.game &&
              simultaneous(t.game) &&
              command.action.decision === decisionKey(t.game))),
        409,
        'The table changed. Try again.',
      );
      const a = command.action;
      if (!['move', 'adventure-move', 'rename', 'leave', 'vote', 'next-game'].includes(a.type))
        check(
          who.id === t.owner ||
            (leaderCommands.includes(a.type) && who.id === hostOf(t)),
          403,
          'Only the host can do that.',
        );
      switch (a.type) {
        case 'ambience':
          check(typeof a.enabled === 'boolean', 400, 'Invalid ambience setting.');
          t.ambienceEnabled = a.enabled;
          break;
        case 'adventure-move': {
          check(!requiresHumanPlayers(t.gameId) || !t.seats.some(s => s.bot), 409, 'This saved match includes bots. Return to the lobby and start with human players.');
          const game=t.adventure;check(t.status==='playing'&&game&&!game.over,409,'No adventure in progress.');
          const seat=t.seats.findIndex(s=>s.id===who.id&&!s.bot);check(seat>=0,403,'No player seat.');
          check(a.key===adventureKey(game),409,'The round has advanced.');
          check(standaloneGames[game.kind].validMove(game,a.move,seat),409,'That action is unavailable.');
          // Players only lock in their own choices; moving the table on belongs to the host.
          check(a.move.type!=='next'||mayAdvance(t,who.id,id=>this.connected(t.token,id)),403,'The host moves the table on.');
          t.adventure=standaloneGames[game.kind].play(game,a.move,seat);check(t.adventure!==game,409,'Action could not be applied.');
          finishAdventure(t);break;
        }
        case 'advance-practice': {
          check(!requiresHumanPlayers(t.gameId) || !t.seats.some(s => s.bot), 409, 'This game requires human players.');
          if(t.adventure){const game=t.adventure;check(game.tutorial,409,'No practice in progress.');let next=game;
          for(let i=0;i<24;i++){const seat=standaloneGames[next.kind].actingSeats(next).find(s=>t.seats[s]?.bot);if(seat===undefined)break;const move=adventureBot(next,seat);if(!move)break;const played=standaloneGames[next.kind].play(next,move,seat);if(played===next)break;next=played;if(next.round!==game.round||next.over)break;}t.adventure=next;
          }else{check(t.game?.tutorial,409,'No practice in progress.');const seat=t.seats.findIndex((s,i)=>s.bot&&canAct(t.game!,i));if(seat>=0)t.game=play(t.game,fallbackMove(t.game,seat),seat);else if(t.game.phase==='roll'){const roller=t.game.players.findIndex((_,i)=>canAct(t.game!,i));if(roller>=0)t.game=play(t.game,{type:'roll'},roller);}}
          break;
        }
        case 'vote': {
          check(t.status === 'lobby', 409, 'Voting is open in the lobby.');
          check(
            (catalog.some((c) => c.id === a.gameId) ||
              a.gameId === 'folio' ||
              a.gameId === 'relic' ||
              (typeof a.gameId === 'string' && isStandaloneId(a.gameId))),
            400,
            'Unknown game.',
          );
          t.votes ??= {};
          const voters = t.votes[a.gameId] ?? [];
          t.votes[a.gameId] = voters.includes(who.id)
            ? voters.filter((id) => id !== who.id)
            : [...voters, who.id];
          break;
        }
        case 'next-game': {
          const v = t.nextVote;
          check(t.status === 'finished' && v && Date.now() < v.endsAt, 409, 'The vote has closed.');
          check(t.seats.some((s) => s.id === who.id && !s.bot), 403, 'Only players vote.');
          check(typeof a.gameId === 'string' && partyGames.includes(a.gameId as StandaloneId) && standaloneGames[a.gameId as StandaloneId].seatChoices.includes(t.seats.length), 400, 'Unknown game.');
          v.ballots[who.id] = a.gameId as StandaloneId;
          if (t.seats.every((s) => s.bot || v.ballots[s.id] || !this.connected(t.token, s.id)))
            this.startNext(t);
          break;
        }
        case 'lesson':
          if(t.adventure){check(t.adventure.tutorial,409,'No practice in progress.');check(Number.isInteger(a.step)&&a.step>=0&&a.step<adventureLessons[t.adventure.kind].length,400,'Invalid step.');t.adventure=practice(t.adventure.kind,t.capacity,t.difficulty,a.step);t.adventure.seats=t.seats.map(s=>s.name);break;}
          check(t.game?.tutorial, 409, 'No lesson is in progress.');
          check(
            Number.isInteger(a.step) &&
              a.step >= 0 &&
              a.step < lessons[t.game!.id].length,
            400,
            'Unknown lesson step.',
          );
          t.game!.lesson = a.step;
          break;
        case 'setup':
          check(t.status === 'lobby', 409, 'Return to the lobby first.');
          check(typeof a.open === 'boolean', 400, 'Invalid setup state.');
          t.setupOpen = a.open;
          break;
        case 'configure':
          check(a.openSetup === undefined || typeof a.openSetup === 'boolean', 400, 'Invalid setup state.');
          if (a.openSetup !== undefined) t.setupOpen = a.openSetup;
          check(t.status === 'lobby', 409, 'Return to the lobby first.');
          check(
            (catalog.some((c) => c.id === a.gameId) || (typeof a.gameId === 'string' && isStandaloneId(a.gameId))) &&
              ['easy', 'medium', 'hard'].includes(a.difficulty) &&
              Number.isInteger(a.capacity) &&
              a.capacity >= 2 &&
              a.capacity <= 6 &&
              a.capacity >= t.members.length,
            400,
            'Choose 2–6 seats, enough for everyone at the table.',
          );
          check(
            a.shields === undefined || typeof a.shields === 'boolean',
            400,
            'Invalid expansion.',
          );
          check(
            a.fastMode === undefined || typeof a.fastMode === 'boolean',
            400,
            'Invalid fast mode.',
          );
          check(
            a.contentSet === undefined ||
              ['beginner', 'intermediate'].includes(a.contentSet),
            400,
            'Invalid content set.',
          );
          for (const [key, game] of [
            ['migration', 'wildgrove'],
            ['salvage', 'undertow'],
            ['specialtyStalls', 'midnight'],
            ['roamEnabled', 'wildgrove'],
            ['turningTide', 'undertow'],
            ['marketSeasons', 'midnight'],
          ] as const) {
            check(
              a[key] === undefined || typeof a[key] === 'boolean',
              400,
              'Invalid extension.',
            );
            t[key] =
              a.gameId === game &&
              (a[key] ?? (t.gameId === a.gameId && t[key]) ?? false);
          }
          t.contentSet =
            a.gameId === 'undertow'
              ? 'beginner'
              : (a.contentSet ??
                (t.gameId === a.gameId ? t.contentSet : 'beginner') ??
                'beginner');
          check(
            a.customerOrders === undefined ||
              typeof a.customerOrders === 'boolean',
            400,
            'Invalid Customer Orders extension.',
          );
          check(
            a.sanctuaryGoalsEnabled === undefined ||
              typeof a.sanctuaryGoalsEnabled === 'boolean',
            400,
            'Invalid Sanctuary Goals expansion.',
          );
          t.sanctuaryGoalsEnabled =
            a.gameId === 'wildgrove' &&
            (a.sanctuaryGoalsEnabled ??
              (t.gameId === a.gameId && t.sanctuaryGoalsEnabled) ??
              false);
          t.customerOrders =
            a.gameId === 'midnight' &&
            (a.customerOrders ??
              (t.gameId === a.gameId && t.customerOrders) ??
              false);
          t.fastMode =
            a.gameId === 'undertow' && (a.fastMode ?? t.fastMode ?? false);
          t.shields =
            a.gameId === 'undertow' &&
            (a.shields ?? (t.gameId === a.gameId && t.shields) ?? false);
          t.gameId = a.gameId;
          t.difficulty = a.difficulty;
          const allowed=isStandaloneId(a.gameId)?standaloneGames[a.gameId].seatChoices:[2,3,4,5,6];
          check(allowed.some(n=>n>=t.members.length),409,'Too many players for this game.');
          t.capacity = allowed.includes(a.capacity)?a.capacity:allowed.find(n=>n>=t.members.length)!;
          break;
        case 'begin-match':
        case 'start': {
          if (a.type === 'start') {
            const offline = t.members.filter(m => m.id !== who.id && !this.connected(t.token, m.id));
            check(!offline.length, 409, `Disconnected players: ${offline.map(m => m.name).join(', ')}. Wait for them to reconnect or remove them before starting.`);
          }
          t.setupOpen = false;
          check(
            a.type === 'begin-match'
              ? !!(t.game?.tutorial||t.adventure?.tutorial)
              : t.status === 'lobby',
            409,
            'Return to the lobby or finish learning first.',
          );
          check(
            a.type !== 'start' ||
              a.learning === undefined ||
              typeof a.learning === 'boolean',
            400,
            'Invalid learning mode.',
          );
          check(
            a.type === 'begin-match' || t.members.length <= t.capacity,
            409,
            'Remove waiting guests or increase the seat count first.',
          );
          if (requiresHumanPlayers(t.gameId)) {
            check(t.members.length === t.capacity && (a.type === 'start' || !t.seats.some(s => s.bot)), 409, 'This game needs a human in every seat. Invite players or reduce the seat count.');
          }
          t.handoff = null;
          if (a.type === 'start')
            t.seats = t.members.map((m) => ({ ...m, bot: false }));
          while (t.seats.length < t.capacity)
            t.seats.push({
              id: token(),
              name: `Bot ${t.seats.length + 1}`,
              bot: true,
            });
          if(isStandaloneId(t.gameId)){
            t.game=null;t.adventure=a.type==='start'&&a.learning?practice(t.gameId,t.capacity,t.difficulty,0):standaloneGames[t.gameId].create(t.capacity,randomInt(4294967296),t.difficulty,'individual',this.contentHistory(t));
            t.adventure.seats=t.seats.map(s=>s.name);t.matchId=token();t.status='playing';t.botError=false;break;
          }
          t.adventure=null;
          t.game = createGame(
            t.gameId,
            t.difficulty,
            randomInt(4294967296),
            a.type === 'start' && (a.learning ?? false),
            t.capacity,
            t.shields ?? false,
            t.fastMode ?? false,
            t.customerOrders ?? false,
            t.sanctuaryGoalsEnabled ?? false,
            {
              contentSet: t.contentSet,
              roamEnabled: t.roamEnabled,
              turningTide: t.turningTide,
              migration: t.migration,
              salvage: t.salvage,
              specialtyStalls: t.specialtyStalls,
              marketSeasons: t.marketSeasons,
            },
          );
          t.game.players.forEach((p, i) => {
            p.name = t.seats[i].name;
          });
          t.matchId = token();
          t.status = 'playing';
          t.botError = false;
          break;
        }
        case 'move': {
          check(
            t.status === 'playing' && t.game,
            409,
            'No match is in progress.',
          );
          const actor = t.seats.findIndex(
            (seat) => seat.id === who.id && !seat.bot,
          );
          const move = parseMove(a.move);
          check(
            move.type === 'undo' ? canUndo(t.game, actor) : canAct(t.game, actor),
            403,
            'Your choice is already locked or it is not your turn.',
          );
          check(
            validMove(t.game, move, actor),
            400,
            'That move is not allowed.',
          );
          t.game = play(t.game, move, actor);
          if (t.game.phase === 'over') {
            t.status = 'finished';
            endMatch(t);
          }
          break;
        }
        case 'replace': {
          check(!requiresHumanPlayers(t.gameId), 409, 'This game cannot replace players with bots.');
          check(t.status === 'playing', 409, 'No match is in progress.');
          const seat = t.seats.find((s) => s.id === a.memberId && !s.bot);
          check(
            seat && seat.id !== hostOf(t) && !this.connected(t.token, seat.id),
            409,
            'Only a disconnected guest can be replaced.',
          );
          seat.bot = true;
          seat.name = `${seat.name} (bot)`;
          t.game!.players[t.seats.indexOf(seat)].name = seat.name;
          break;
        }
        case 'host': {
          const next = t.members.find((m) => m.id === a.memberId);
          check(t.status === 'lobby', 409, 'Pick who leads the next game in the lobby.');
          check(next, 404, 'That player is not at this table.');
          // Picking the creator, or the current pick again, clears the pick.
          t.host = next.id === t.owner || next.id === t.host ? undefined : next.id;
          break;
        }
        case 'remove':
          check(
            t.status === 'lobby' && a.memberId !== t.owner,
            409,
            'Guests can only be removed in the lobby.',
          );
          t.members = t.members.filter((m) => m.id !== a.memberId);
          if (t.host === a.memberId) t.host = undefined;
          for (const id of Object.keys(t.votes ?? {}) as ShelfGameId[])
            t.votes![id] = t.votes![id]!.filter((v) => v !== a.memberId);
          break;
        case 'leave':
          check(
            t.status === 'lobby' && who.id !== t.owner,
            409,
            who.id === t.owner
              ? 'The host closes the table instead.'
              : 'Your seat is reserved until this match ends.',
          );
          t.members = t.members.filter((m) => m.id !== who.id);
          if (t.host === who.id) t.host = undefined;
          for (const id of Object.keys(t.votes ?? {}) as ShelfGameId[])
            t.votes![id] = t.votes![id]!.filter((v) => v !== who.id);
          break;
        case 'rename': {
          const name = displayName(a.name);
          t.members.find((m) => m.id === who.id)!.name = name;
          const seat = t.seats.find((s) => s.id === who.id && !s.bot);
          if (seat) {
            seat.name = name;
            if(t.game)t.game.players[t.seats.indexOf(seat)].name=name;
            if(t.adventure)t.adventure.seats[t.seats.indexOf(seat)]=name;
          }
          this.db
            .prepare(
              who.userId
                ? 'UPDATE users SET name=? WHERE id=?'
                : 'UPDATE guests SET name=? WHERE id=?',
            )
            .run(name, who.id);
          break;
        }
        case 'abandon':
          endMatch(t);
          t.handoff = null;
          t.nextVote = null;
          t.status = 'lobby';
          t.game = null;
          t.adventure = null;
          t.matchId = null;
          t.seats = [];
          t.botError = false;
          break;
        case 'close':
          t.status = 'closed';
          t.game = null;
          t.adventure = null;
          t.seats = [];
          break;
        case 'retry-bot':
          t.botError = false;
          break;
        default:
          check(false, 400, 'Unknown command.');
      }
      t.revision++;
      this.save(t);
      this.db
        .prepare('INSERT INTO commands VALUES (?,?,?,?)')
        .run(invite, who.id, command.requestId, body);
      this.db.exec('COMMIT');
      return t;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }
  adventureTick(invite: string, key: string) {
    const t=this.get(invite),g=t.adventure;
    if(t.status!=='playing'||!g||g.tutorial||adventureKey(g)!==key)return;
    const next=tickAdventure(g);if(next===g)return;
    t.adventure=next;finishAdventure(t);t.revision++;this.save(t);
  }
  /** Closes the what-next vote once its ten seconds are up. */
  nextGameTick(invite: string) {
    const t = this.get(invite);
    if (t.status !== 'finished' || !t.nextVote || Date.now() < t.nextVote.endsAt) return;
    this.startNext(t);
    t.revision++;
    this.save(t);
  }
  /** Starts the voted party game with the same players, or leaves the table on
   *  the results when nobody voted or somebody has left. */
  private startNext(t: StoredTable) {
    const v = t.nextVote;
    t.nextVote = null;
    const id = v && nextGameWinner(v);
    if (!id || !t.seats.every((s) => t.members.some((m) => m.id === s.id))) return;
    const n = t.seats.length;
    if (!standaloneGames[id].seatChoices.includes(n)) return;
    t.gameId = id;
    t.capacity = n;
    t.adventure = standaloneGames[id].create(n, randomInt(4294967296), t.difficulty, 'individual', this.contentHistory(t));
    t.adventure.seats = t.seats.map((s) => s.name);
    t.game = null;
    t.matchId = token();
    t.status = 'playing';
    t.botError = false;
  }
  adventureBot(invite:string, key:string,seat:number) {
    const t=this.get(invite),g=t.adventure;
    if(t.status!=='playing'||!g||requiresHumanPlayers(t.gameId)||g.tutorial||!t.seats[seat]?.bot||adventureKey(g)!==key)return;
    const move=adventureBot(g,seat);if(!move)return;const next=standaloneGames[g.kind].play(g,move,seat);if(next===g)return;t.adventure=next;finishAdventure(t);t.revision++;this.save(t);
  }
  /** Applies a bot's reply while that seat still faces the decision it was
   *  asked about; other seats committing meanwhile do not discard it. */
  botMove(invite: string, decision: string, move: Move | null, seat: number) {
    const t = this.get(invite);
    if (
      t.status !== 'playing' ||
      !t.game ||
      !t.seats[seat]?.bot ||
      !canAct(t.game, seat) ||
      preparationKey(t.game, seat) !== decision
    )
      return;
    const safeMove =
      move && validMove(t.game, move, seat) ? move : fallbackMove(t.game, seat);
    t.game = play(t.game, safeMove, seat);
    t.botError = false;
    if (t.game.phase === 'over') {
      t.status = 'finished';
      endMatch(t);
    }
    t.revision++;
    this.save(t);
  }
}
