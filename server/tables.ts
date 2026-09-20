import { standaloneGames, isStandaloneId, observe as observeAdventure, botMove as adventureBot, decisionKey as adventureKey, tick as tickAdventure, type AnyGame } from '../lib/games/standalone/registry.ts';
import { practice, adventureLessons } from '../lib/games/adventures/lessons.ts';
import type { OnlineGameId } from '../lib/online/types.ts';
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
  owner: string;
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
  fastMode?: boolean;
  capacity: number;
  revision: number;
  status: Table['status'];
  members: Participant[];
  seats: Seat[];
  matchId: string | null;
  game: Game | null;
  adventure?: AnyGame | null;
  partyMode?: 'teams' | 'individual';
  botError: boolean;
  votes?: Partial<Record<OnlineGameId, string[]>>;
};
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
  save(t: StoredTable) {
    this.db
      .prepare('UPDATE tables SET state=? WHERE token=?')
      .run(JSON.stringify(t), t.token);
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
      partyMode: t.partyMode ?? 'individual',
      capacity: t.capacity,
      revision: t.revision,
      status: t.status,
      viewerId: who.id,
      isHost: t.owner === who.userId,
      viewerSeat: index < 0 ? null : index,
      matchId: t.matchId,
      game,
      adventure: t.adventure ? observeAdventure(t.adventure, index) : null,
      botError: t.botError,
      votes: t.votes ?? {},
      members: [
        ...t.members.map((m, i) => ({
          ...m,
          host: m.id === t.owner,
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
            (command.action.type === 'adventure-move' && t.adventure && command.action.key === adventureKey(t.adventure)) ||
            (command.action.type === 'move' &&
              t.game &&
              simultaneous(t.game) &&
              command.action.decision === decisionKey(t.game))),
        409,
        'The table changed. Try again.',
      );
      const a = command.action;
      if (!['move', 'adventure-move', 'rename', 'leave', 'vote'].includes(a.type))
        check(who.userId === t.owner, 403, 'Only the host can do that.');
      switch (a.type) {
        case 'adventure-move': {
          const game=t.adventure;check(t.status==='playing'&&game&&!game.over,409,'No adventure in progress.');
          const seat=t.seats.findIndex(s=>s.id===who.id&&!s.bot);check(seat>=0,403,'No player seat.');
          check(a.key===adventureKey(game),409,'The round has advanced.');
          check(standaloneGames[game.kind].validMove(game,a.move,seat),409,'That action is unavailable.');
          t.adventure=standaloneGames[game.kind].play(game,a.move,seat);check(t.adventure!==game,409,'Action could not be applied.');
          if(t.adventure.over&&!t.adventure.tutorial)t.status='finished';break;
        }
        case 'advance-practice': {
          if(t.adventure){const game=t.adventure;check(game.tutorial,409,'No practice in progress.');let next=game;
          for(let i=0;i<24;i++){const seat=standaloneGames[next.kind].actingSeats(next).find(s=>t.seats[s]?.bot);if(seat===undefined)break;const move=adventureBot(next,seat);if(!move)break;const played=standaloneGames[next.kind].play(next,move,seat);if(played===next)break;next=played;if(next.round!==game.round||next.over)break;}t.adventure=next;
          }else{check(t.game?.tutorial,409,'No practice in progress.');const seat=t.seats.findIndex((s,i)=>s.bot&&canAct(t.game!,i));if(seat>=0)t.game=play(t.game,fallbackMove(t.game,seat),seat);else if(t.game.phase==='roll'){const roller=t.game.players.findIndex((_,i)=>canAct(t.game!,i));if(roller>=0)t.game=play(t.game,{type:'roll'},roller);}}
          break;
        }
        case 'vote': {
          check(t.status === 'lobby', 409, 'Voting is open in the lobby.');
          check(
            (catalog.some((c) => c.id === a.gameId) || (typeof a.gameId === 'string' && isStandaloneId(a.gameId))),
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
        case 'lesson':
          if(t.adventure){check(t.adventure.tutorial,409,'No practice in progress.');check(Number.isInteger(a.step)&&a.step>=0&&a.step<adventureLessons[t.adventure.kind].length,400,'Invalid step.');t.adventure=practice(t.adventure.kind,t.capacity,t.difficulty,a.step,t.partyMode);t.adventure.seats=t.seats.map(s=>s.name);break;}
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
        case 'configure':
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
          check(a.partyMode === undefined || ['teams','individual'].includes(a.partyMode),400,'Invalid party mode.');
          t.partyMode = [4,6].includes(t.capacity) ? (a.partyMode ?? t.partyMode ?? 'individual') : 'individual';
          break;
        case 'begin-match':
        case 'start': {
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
          if (a.type === 'start')
            t.seats = t.members.map((m) => ({ ...m, bot: false }));
          while (t.seats.length < t.capacity)
            t.seats.push({
              id: token(),
              name: `Bot ${t.seats.length + 1}`,
              bot: true,
            });
          if(isStandaloneId(t.gameId)){
            t.game=null;t.adventure=a.type==='start'&&a.learning?practice(t.gameId,t.capacity,t.difficulty,0,t.partyMode):standaloneGames[t.gameId].create(t.capacity,randomInt(4294967296),t.difficulty,t.partyMode);
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
          if (t.game.phase === 'over') t.status = 'finished';
          break;
        }
        case 'replace': {
          check(t.status === 'playing', 409, 'No match is in progress.');
          const seat = t.seats.find((s) => s.id === a.memberId && !s.bot);
          check(
            seat && seat.id !== t.owner && !this.connected(t.token, seat.id),
            409,
            'Only a disconnected guest can be replaced.',
          );
          seat.bot = true;
          seat.name = `${seat.name} (bot)`;
          t.game!.players[t.seats.indexOf(seat)].name = seat.name;
          break;
        }
        case 'remove':
          check(
            t.status === 'lobby' && a.memberId !== t.owner,
            409,
            'Guests can only be removed in the lobby.',
          );
          t.members = t.members.filter((m) => m.id !== a.memberId);
          for (const id of Object.keys(t.votes ?? {}) as OnlineGameId[])
            t.votes![id] = t.votes![id]!.filter((v) => v !== a.memberId);
          break;
        case 'leave':
          check(
            t.status === 'lobby' && who.id !== t.owner,
            409,
            'Your seat is reserved until this match ends.',
          );
          t.members = t.members.filter((m) => m.id !== who.id);
          for (const id of Object.keys(t.votes ?? {}) as OnlineGameId[])
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
    t.adventure=next;t.revision++;this.save(t);
  }
  adventureBot(invite:string, key:string,seat:number) {
    const t=this.get(invite),g=t.adventure;
    if(t.status!=='playing'||!g||g.tutorial||!t.seats[seat]?.bot||adventureKey(g)!==key)return;
    const move=adventureBot(g,seat);if(!move)return;const next=standaloneGames[g.kind].play(g,move,seat);if(next===g)return;t.adventure=next;if(next.over)t.status='finished';t.revision++;this.save(t);
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
    if (t.game.phase === 'over') t.status = 'finished';
    t.revision++;
    this.save(t);
  }
}
