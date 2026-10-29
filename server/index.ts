import {standaloneGames, decisionKey as adventureKey, deadline as adventureDeadline} from '../lib/games/standalone/registry.ts';
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http';
import { statSync, createReadStream } from 'node:fs';
import { resolve, extname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Worker } from 'node:worker_threads';
import { openDatabase } from './database.ts';
import { Accounts } from './accounts.ts';
import { Leaderboards } from './leaderboards.ts';
import { leaderboardGames } from '../lib/games/leaderboards.ts';
import {
  check,
  HttpError,
  identity,
  hashPassword,
  verifyPassword,
  newSession,
  token,
  displayName,
  emailAddress,
  type Identity,
} from './auth.ts';
import { Tables, handOverMs, type StoredTable } from './tables.ts';
import { Expeditions } from './expeditions.ts';
import { DeskPresence } from './desk-presence.ts';
import { FolioRuns } from './folio.ts';
import { ArenaRooms, ArenaRefusal, type ArenaOptions } from './arena.ts';
import { RotaRooms, type RotaOptions } from './rota.ts';
import { MetroRooms, type MetroOptions } from './metro.ts';
import { AltoRooms, type AltoRoomOptions } from './alto.ts';
import { DinerRooms, type DinerOptions } from './diner.ts';
import { flagContent, flaggedTitle } from './content-flags.ts';
import {
  observe,
  canAct,
  preparationKey,
  revealingTrick,
  trickRevealMs,
  totalRounds,
  type Move,
} from '../lib/games/trio/engine.ts';
import type { Command } from '../lib/online/types.ts';

type Client = {
  req: IncomingMessage;
  res: ServerResponse;
  who: Identity;
  invite: string;
};
export async function makeServer(
  options: {
    database?: string;
    origin?: string;
    staticDir?: string;
    bots?: boolean;
    /** How long a table may sit with nobody connected before it is deleted. */
    idleTableMs?: number;
    /** Arena clock and timeouts; tests shorten them. */
    arena?: ArenaOptions;
    /** Rota bots and away seats; tests think inline. */
    rota?: RotaOptions;
    /** Metro bots and away seats; tests think inline. */
    metro?: MetroOptions;
    /** Alto bots and away seats; tests answer at once. */
    alto?: AltoRoomOptions;
    /** Diner's clock and waits; tests shorten them. */
    diner?: DinerOptions;
    /** How long a table's admin may be away before the table passes on. */
    handOverMs?: number;
  } = {},
) {
  const origin = new URL(
    options.origin ?? process.env.PUBLIC_ORIGIN ?? 'http://localhost:3017',
  ).origin;
  const secure = origin.startsWith('https:');
  const db = openDatabase(
    options.database ?? process.env.DATABASE_PATH ?? '.data/gamehub.sqlite',
  );
  const deskPresence = new DeskPresence();
  const accounts = new Accounts(db);
  const leaderboards = new Leaderboards(db);
  const expeditions = new Expeditions(db, deskPresence);
  const folio = new FolioRuns(db);
  const rota = new RotaRooms(db, options.rota);
  const metro = new MetroRooms(db, options.metro);
  const alto = new AltoRooms(db, options.alto);
  const diner = new DinerRooms({
    ...options.diner,
    authorized: (req) => !!identity(db, req),
  });
  const arena = new ArenaRooms({
    ...options.arena,
    authorized: (req) => !!identity(db, req),
  });
  const clients = new Set<Client>();
  type BotJob = {
    decision: string;
    timer: ReturnType<typeof setTimeout>;
    worker?: Worker;
  };
  // One job per thinking seat, so simultaneous phases resolve in parallel.
  const jobs = new Map<string, Map<number, BotJob>>();
  const limits = new Map<string, { count: number; until: number }>();
  const tables = new Tables(db, (invite, id) =>
    [...clients].some((c) => c.invite === invite && c.who.id === id),
  );
  const dummyPassword = await hashPassword(token());
  let stopping = false;
  function send(res: ServerResponse, status: number, value: unknown) {
    res.writeHead(status, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    });
    res.end(JSON.stringify(value));
  }
  function limit(key: string, max: number, window = 60000) {
    const now = Date.now();
    for (const [k, entry] of limits) if (entry.until <= now) limits.delete(k);
    const entry = limits.get(key) ?? { count: 0, until: now + window };
    check(
      entry.count < max && (limits.has(key) || limits.size < 10000),
      429,
      'Too many requests. Please wait and try again.',
    );
    entry.count++;
    limits.set(key, entry);
  }
  async function body(req: IncomingMessage) {
    check(
      req.headers['content-type']?.split(';')[0] === 'application/json',
      415,
      'Send JSON.',
    );
    let size = 0;
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      size += chunk.length;
      check(size <= 8192, 413, 'Request is too large.');
      chunks.push(chunk);
    }
    try {
      const value = JSON.parse(Buffer.concat(chunks).toString());
      check(
        value && typeof value === 'object' && !Array.isArray(value),
        400,
        'Invalid JSON.',
      );
      return value as Record<string, unknown>;
    } catch {
      throw new HttpError(400, 'Invalid JSON.');
    }
  }
  function publish(invite: string) {
    if (!tables.exists(invite)) {
      // The table was removed: tell anyone still listening, then let go.
      for (const c of clients)
        if (c.invite === invite) {
          c.res.write('event: gone\ndata: {}\n\n');
          c.res.end();
          clients.delete(c);
        }
      return;
    }
    const t = tables.get(invite);
    for (const c of clients)
      if (c.invite === invite) {
        const fresh = identity(db, c.req);
        if (!fresh || !t.members.some((m) => m.id === fresh.id)) {
          c.res.write('event: revoked\ndata: {}\n\n');
          c.res.end();
          clients.delete(c);
          continue;
        }
        if (c.res.writableLength > 256000) {
          c.res.destroy();
          clients.delete(c);
          continue;
        }
        c.res.write(`data: ${JSON.stringify(tables.view(t, fresh))}\n\n`);
        if (t.status === 'closed') {
          c.res.end();
          clients.delete(c);
        }
      }
    schedule(invite);
  }
  /** A run or room the table moved on to follows the table's admin. */
  function followAdmin(t: StoredTable) {
    const run = t.handoff?.kind === 'folio' && /^\/folio\/([A-Za-z0-9_-]{32})$/.exec(t.handoff.url);
    if (run) folio.follow(run[1], t.owner);
    const room = t.handoff?.kind === 'rota' && /^\/rota\/([A-Za-z0-9_-]{32})$/.exec(t.handoff.url);
    if (room) rota.follow(room[1], t.owner);
    const metroRoom = t.handoff?.kind === 'metro' && /^\/metro\/([A-Za-z0-9_-]{32})$/.exec(t.handoff.url);
    if (metroRoom) metro.follow(metroRoom[1], t.owner);
    const voyage = t.handoff?.kind === 'alto' && /^\/alto\/([A-Za-z0-9_-]{32})$/.exec(t.handoff.url);
    if (voyage) alto.follow(voyage[1], t.owner);
    const shift = t.handoff?.kind === 'diner' && /^\/diner\/([A-Za-z0-9_-]{32})$/.exec(t.handoff.url);
    if (shift) diner.follow(shift[1], t.owner);
  }
  /** Once the admin has been gone a while, a player still here takes the table. */
  function handOverLater(invite: string) {
    const timer = setTimeout(() => {
      if (stopping) return;
      const t = tables.handOverIfAway(invite);
      if (!t) return;
      followAdmin(t);
      publish(invite);
    }, options.handOverMs ?? handOverMs);
    timer.unref?.();
  }
  /** A guest's sessions are about to go (they joined or logged in): their
   *  live streams close too, so an old tab stops hearing the rooms. */
  function revokeGuest(guest: string) {
    const hashes = (db.prepare('SELECT hash FROM sessions WHERE guest_id=?').all(guest) as { hash: string }[]).map((s) => s.hash);
    for (const c of clients) if (c.who.id === guest) c.res.end();
    for (const hash of hashes) { arena.revoke(hash); diner.revoke(hash); }
    deskPresence.revokeMember(guest);
  }
  /** Deletes a table and forgets its timers; its link then leads nowhere. */
  function drop(invite: string) {
    for (const job of jobs.get(invite)?.values() ?? []) {
      clearTimeout(job.timer);
      void job.worker?.terminate();
    }
    jobs.delete(invite);
    emptySince.delete(invite);
    tables.remove(invite);
  }
  // Tables nobody is connected to are removed once the grace period runs out,
  // so a sleeping phone or a quick refresh does not lose the table.
  const idleTableMs = options.idleTableMs ?? 10 * 60_000;
  const emptySince = new Map<string, number>();
  function sweep(now = Date.now()) {
    for (const { token: invite, state } of db
      .prepare('SELECT token, state FROM tables')
      .all() as { token: string; state: string }[]) {
      const stored = JSON.parse(state) as StoredTable;
      if (stored.status === 'closed') {
        drop(invite);
        continue;
      }
      // Ranked runs are durable saves; an absent player is not an abandoned run.
      if (stored.rankedSolo && stored.status === 'playing' && db.prepare("SELECT 1 FROM leaderboard_runs WHERE id=? AND status='active'").get(`table:${stored.matchId}`)) {
        emptySince.delete(invite);
        continue;
      }
      if ([...clients].some((c) => c.invite === invite)) {
        emptySince.delete(invite);
        continue;
      }
      const since = emptySince.get(invite) ?? now;
      emptySince.set(invite, since);
      if (now - since >= idleTableMs) drop(invite);
    }
  }
  function schedule(invite: string) {
    if (stopping) return;
    const t = tables.get(invite);
    const seats = jobs.get(invite) ?? new Map<number, BotJob>();
    if(t.adventure){
      const g=t.adventure,key=adventureKey(g);
      for(const [seat,job]of seats)if(job.decision!==key||(seat!==-1&&!standaloneGames[g.kind].actingSeats(g).includes(seat))){clearTimeout(job.timer);void job.worker?.terminate();seats.delete(seat);}
      // The host's pick has no clock; it waits on the host alone.
      if(t.status==='finished'&&t.nextVote&&t.nextVote.endsAt!==null){
        const nextKey=`next:${t.matchId}`;
        for(const [seat,job]of seats)if(job.decision!==nextKey){clearTimeout(job.timer);seats.delete(seat);}
        if(!seats.has(-2))seats.set(-2,{decision:nextKey,timer:setTimeout(()=>{seats.delete(-2);if(stopping)return;tables.nextGameTick(invite);publish(invite);},Math.max(0,t.nextVote.endsAt-Date.now())+25)});
        jobs.set(invite,seats);return;
      }
      if(t.status!=='playing'||g.tutorial){for(const job of seats.values())clearTimeout(job.timer);jobs.delete(invite);return;}
      for(const seat of standaloneGames[g.kind].actingSeats(g)){if(options.bots===false||!t.seats[seat]?.bot||seats.has(seat))continue;const job:BotJob={decision:key,timer:setTimeout(()=>{seats.delete(seat);if(stopping)return;tables.adventureBot(invite,key,seat);publish(invite);},650)};seats.set(seat,job);}
      const due=adventureDeadline(g);
      if(due!==null&&!seats.has(-1)){
        const job:BotJob={decision:key,timer:setTimeout(()=>{seats.delete(-1);if(stopping)return;tables.adventureTick(invite,key);publish(invite);},Math.max(0,due-Date.now())+25)};
        seats.set(-1,job);
      }
      jobs.set(invite,seats);return;
    }
    if(options.bots===false)return;
    // Drop thoughts about decisions that no longer exist.
    for (const [seat, job] of seats)
      if (
        !t.game ||
        !canAct(t.game, seat) ||
        preparationKey(t.game, seat) !== job.decision
      ) {
        clearTimeout(job.timer);
        void job.worker?.terminate();
        seats.delete(seat);
      }
    if (t.status !== 'playing' || !t.game || t.game.tutorial) {
      jobs.delete(invite);
      return;
    }
    const game = t.game;
    t.seats.forEach((who, seat) => {
      if (!who.bot || !canAct(game, seat) || seats.has(seat)) return;
      const decision = preparationKey(game, seat);
      let done = false;
      const finish = (move: Move | null) => {
        if (done) return;
        done = true;
        clearTimeout(job.timer);
        void job.worker?.terminate();
        if (jobs.get(invite)?.get(seat) === job) jobs.get(invite)!.delete(seat);
        if (stopping || !tables.exists(invite)) return;
        tables.botMove(invite, decision, move, seat);
        publish(invite);
      };
      // A fallback move voids a rated game, so a rated table's bot gets a
      // longer think and a second try before it settles for one.
      const rated = t.rankedSolo === true;
      const think = (attempt: number) => {
        let settled = false;
        const retry = () => {
          if (done || settled) return;
          settled = true;
          clearTimeout(job.timer);
          void job.worker?.terminate();
          // A cancelled job (the table moved on or was removed) never retries.
          if (rated && attempt === 0 && !stopping && jobs.get(invite)?.get(seat) === job && tables.exists(invite)) think(1);
          else finish(null);
        };
        try {
          const worker = new Worker(
            new URL('./bot-worker.ts', import.meta.url),
            {
              workerData: { ...observe(game, seat), active: seat },
              execArgv: ['--experimental-strip-types'],
            },
          );
          job.worker = worker;
          worker.once('message', (move: Move) => finish(move));
          worker.once('error', retry);
          worker.once('exit', () => {
            if (job.worker === worker) retry();
          });
          job.timer = setTimeout(retry, rated ? 20000 : 10000);
        } catch {
          retry();
        }
      };
      const job: BotJob = {
        decision,
        // Let clients finish showing a completed Nox trick before a bot plays into the next one.
        timer: setTimeout(() => think(0), revealingTrick(game) ? trickRevealMs + 120 : 120),
      };
      seats.set(seat, job);
    });
    if (seats.size) jobs.set(invite, seats);
    else jobs.delete(invite);
  }
  const server = createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Frame-Options', 'DENY');
    try {
      const url = new URL(req.url ?? '/', origin),
        path = url.pathname;
      if (!path.startsWith('/api/')) {
        serveStatic(path, req, res);
        return;
      }
      if (path === '/api/health' && req.method === 'GET') {
        db.prepare('SELECT 1').get();
        send(res, 200, { ok: true });
        return;
      }
      if (req.method !== 'GET')
        check(
          process.env.NODE_ENV === 'development' ||
            req.headers.origin === origin,
          403,
          'Request origin is not allowed.',
        );
      const ip = req.socket.remoteAddress ?? 'unknown';
      // Eight waiters at 20 inputs/second use 9,600/minute; allow 25% headroom.
      if (req.method === 'POST' && /^\/api\/diner\/[A-Za-z0-9_-]{32}\/input$/.test(path))
        limit(`diner-input:${ip}`, 12_000);
      // Lucky's live pointer and view updates have their own budget.
      else if (/^\/api\/expeditions\/[A-Za-z0-9_-]{32}\/presence$/.test(path)) limit(`presence:${ip}`, 3000);
      else limit(`${path.startsWith('/api/expeditions') ? 'expedition' : 'request'}:${ip}`, path.startsWith('/api/expeditions') ? 3600 : 600);
      // Development: a test-player tab sends its own guest session, since
      // every localhost tab shares the one cookie.
      const devSession =
        process.env.NODE_ENV === 'development'
          ? (req.headers['x-gamehub-dev-session'] ??
            url.searchParams.get('dev_session'))
          : null;
      if (typeof devSession === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(devSession))
        req.headers.cookie = `gamehub_session=${devSession}`;
      let who = identity(db, req);
      if (path === '/api/leaderboards' && req.method === 'GET') {
        const game = url.searchParams.get('game');
        send(res, 200, game ? leaderboards.board(game, url.searchParams.get('view'), who?.id) : leaderboardGames);
        return;
      }
      if (path === '/api/leaderboards/me' && req.method === 'GET') {
        send(res, 200, leaderboards.me(who?.id));
        return;
      }
      if (path === '/api/leaderboards/result' && req.method === 'GET') {
        const room = url.searchParams.get('url') ?? '';
        check(/^\/(table|rota|folio|expedition)\/[A-Za-z0-9_-]{8,80}$/.test(room), 400, 'Choose a game.');
        send(res, 200, leaderboards.result(room, who?.id));
        return;
      }
      if (path === '/api/guest' && req.method === 'POST') {
        // Rated games need no account: a first-time guest is known from here
        // on, under the name this device remembers (or Guest). Anyone already
        // known keeps their session.
        const input = await body(req);
        who = identity(db, req);
        if (!who) {
          limit(`guest:${ip}`, 30, 15 * 60000);
          const id = token(),
            name = input.name === undefined || input.name === '' ? 'Guest' : displayName(input.name);
          db.prepare('INSERT INTO guests VALUES (?,?)').run(id, name);
          res.setHeader('Set-Cookie', newSession(db, id, false, secure));
          send(res, 200, { name, guest: true });
          return;
        }
        send(res, 200, { name: who.name, guest: !who.userId });
        return;
      }
      if (path === '/api/solo/ranked/abandon') {
        check(req.method === 'POST', 405, 'Method not allowed.');
        const input = await body(req);
        who = identity(db, req);
        check(who, 401, 'This rated game is not yours.');
        limit(`ranked-abandon:${who.id}`, 60, 60_000);
        check(typeof input.url === 'string', 400, 'Choose a rated game.');
        const target = /^\/(table|rota)\/([A-Za-z0-9_-]{32})$/.exec(input.url);
        check(target, 400, 'Choose a rated game.');
        const [, kind, invite] = target;
        if (kind === 'rota') rota.removeRanked(invite, who);
        else {
          const row = db.prepare('SELECT state FROM tables WHERE token=?').get(invite) as { state: string } | undefined;
          // Deletion is idempotent so retrying a lost response never records another loss.
          if (row) {
            const table = JSON.parse(row.state) as StoredTable;
            check(table.rankedSolo && table.owner === who.id, 403, 'This rated game is not yours.');
            check(table.status === 'playing', 409, 'This rated game is already over.');
            db.exec('SAVEPOINT ranked_abandon');
            try {
              if (table.matchId) leaderboards.forfeit(`table:${table.matchId}`);
              drop(invite);
              db.exec('RELEASE ranked_abandon');
            } catch (error) {
              db.exec('ROLLBACK TO ranked_abandon; RELEASE ranked_abandon');
              throw error;
            }
            publish(invite);
          }
        }
        send(res, 200, { abandoned: true });
        return;
      }
      if (path === '/api/solo/ranked') {
        if (req.method === 'GET') {
          // Unfinished rated games, with where they stand, for Continue.
          const active: { gameId: string; kind: string; url: string; label: string; round: number; rounds: number; startedAt: number }[] = [];
          for (const run of leaderboards.active(who?.id)) {
            const [, kind, invite] = run.room.split('/');
            if (kind === 'table') {
              if (!tables.exists(invite)) continue;
              const t = tables.get(invite);
              if (!t.game || t.status !== 'playing') continue;
              active.push({ gameId: run.gameId, kind: run.kind, url: run.room, label: run.label, round: t.game.round, rounds: totalRounds(t.game), startedAt: run.startedAt });
            } else if (kind === 'rota') {
              const row = db.prepare('SELECT state FROM rota_rooms WHERE token=?').get(invite) as { state: string } | undefined;
              if (!row) continue;
              const r = JSON.parse(row.state) as { game: { round: number; rounds: number; over: boolean } };
              if (r.game.over) continue;
              active.push({ gameId: run.gameId, kind: run.kind, url: run.room, label: run.label, round: r.game.round, rounds: r.game.rounds, startedAt: run.startedAt });
            }
          }
          send(res, 200, active);
          return;
        }
        check(req.method === 'POST', 405, 'Method not allowed.');
        const input = await body(req);
        who = identity(db, req);
        // The client makes sure of a session first (POST /api/guest), so a
        // retried launch always comes from the same player.
        check(who, 401, 'Your session ended. Try again.');
        const player = who;
        const launchId = input.requestId;
        check(typeof launchId === 'string' && /^[A-Za-z0-9_-]{16,80}$/.test(launchId), 400, 'Invalid rated launch request.');
        const normalized = (value: unknown): unknown => Array.isArray(value)
          ? value.map(normalized)
          : value && typeof value === 'object'
            ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, normalized(item)]))
            : value;
        const payload = JSON.stringify(normalized(Object.fromEntries(Object.entries(input).filter(([key]) => key !== 'requestId' && key !== 'name'))));
        const previous = leaderboards.launch(player.id, launchId);
        if (previous) {
          check(previous.payload === payload, 409, 'This launch request was already used for another setup.');
          const [, kind, invite] = previous.url.split('/');
          const owner = kind === 'table'
            ? tables.exists(invite) ? tables.get(invite).owner : null
            : (() => {
                const row = db.prepare('SELECT state FROM rota_rooms WHERE token=?').get(invite) as { state: string } | undefined;
                return row ? (JSON.parse(row.state) as { owner: string }).owner : null;
              })();
          check(owner === player.id, 410, 'This rated game is no longer available. Choose a new setup to start again.');
          send(res, 200, { url: previous.url });
          return;
        }
        limit(`ranked:${player.id}`, 12, 60_000);
        const launched = (url: string) => {
          leaderboards.recordLaunch(player.id, launchId, payload, url);
          send(res, 201, { url });
        };
        check(['undertow', 'wildgrove', 'midnight', 'rota'].includes(String(input.gameId)), 400, 'Choose a rated game.');
        // Alone in Rota there are no bots; every other rated game is against Hard.
        const alone = input.gameId === 'rota' && input.seats === 1;
        check(alone || input.difficulty === 'hard', 400, 'Rated games use Hard bots.');
        if (input.gameId === 'rota') {
          const room = rota.launch(null, player.id, [{ id: player.id, name: player.name }], { ...input, rankedSolo: true });
          launched(`/rota/${room}`);
          return;
        }
        const t = tables.createSolo(player);
        try {
          const keys = ['contentSet', 'roamEnabled', 'gold', 'marketSeasons', 'census', 'anchor', 'dawn', 'specialtyStalls', 'fastMode', 'customerOrders', 'sanctuaryGoalsEnabled'] as const;
          const settings = Object.fromEntries(keys.filter((key) => input[key] !== undefined).map((key) => [key, input[key]]));
          const configured = tables.command(t.token, player, {
            requestId: token(), revision: t.revision, matchId: null,
            action: { ...settings, type: 'configure', gameId: input.gameId, difficulty: 'hard', capacity: input.seats },
          } as Command);
          tables.command(t.token, player, { requestId: token(), revision: configured.revision, matchId: null, action: { type: 'start' } });
          publish(t.token);
          launched(`/table/${t.token}`);
        } catch (error) { tables.remove(t.token); throw error; }
        return;
      }
      if (path === '/api/folio' || path.startsWith('/api/folio/')) {
        const match = /^\/api\/folio\/([A-Za-z0-9_-]{32})(?:\/(join|commands|delete))?$/.exec(path);
        check(path === '/api/folio' || match, 404, 'Puzzles route not found.');
        if (path === '/api/folio' && req.method === 'GET') { send(res, 200, who ? folio.list(who) : []); return; }
        const input = req.method === 'POST' ? await body(req) : {};
        if (!who && req.method === 'POST' && (path === '/api/folio' || match?.[2] === 'join')) {
          limit(`folio-guest:${ip}`, 30);
          const name = displayName(input.name), id = token();
          db.prepare('INSERT INTO guests VALUES (?,?)').run(id, name);
          const cookie = newSession(db, id, false, secure);
          res.setHeader('Set-Cookie', cookie);
          req.headers.cookie = cookie.split(';')[0];
          who = identity(db, req)!;
        }
        if (match && req.method === 'GET' && !match[2]) { send(res, 200, folio.get(match[1], who)); return; }
        check(who, 401, 'Enter your name to join the run.');
        if (path === '/api/folio' && req.method === 'POST') { send(res, 200, folio.create(who, input)); return; }
        if (match && req.method === 'POST' && match[2] === 'join') { send(res, 200, folio.join(match[1], who, input)); return; }
        if (match && req.method === 'POST' && match[2] === 'commands') { send(res, 200, folio.command(match[1], who, input)); return; }
        if (match && req.method === 'POST' && match[2] === 'delete') { send(res, 200, folio.remove(match[1], who)); return; }
        throw new HttpError(405, 'Method not allowed.');
      }
      if (path === '/api/expeditions' || path.startsWith('/api/expeditions/')) {
        const match = /^\/api\/expeditions\/([A-Za-z0-9_-]{32})(?:\/(join|commands|activity|delete|events|presence))?$/.exec(path);
        check(path === '/api/expeditions' || match, 404, 'Expedition route not found.');
        if (path === '/api/expeditions' && req.method === 'GET') {
          send(res, 200, who ? expeditions.list(who) : []); return;
        }
        const input = req.method === 'POST' ? await body(req) : {};
        if (!who && req.method === 'POST' && (path === '/api/expeditions' || match?.[2] === 'join')) {
          limit(`expedition-guest:${ip}`, 30);
          const name = displayName(input.name), id = token();
          db.prepare('INSERT INTO guests VALUES (?,?)').run(id, name);
          const cookie = newSession(db, id, false, secure);
          res.setHeader('Set-Cookie', cookie);
          req.headers.cookie = cookie.split(';')[0];
          who = identity(db, req)!;
        }
        check(who, 401, 'Enter your name to join the expedition.');
        if (match && (match[2] === 'events' || match[2] === 'presence')) {
          expeditions.assertMember(match[1], who);
          if (req.method === 'POST' && match[2] === 'presence') {
            limit(`presence-actor:${who.id}`, 1500);
            send(res, 200, deskPresence.post(match[1], who, input)); return;
          }
          if (req.method === 'GET' && match[2] === 'events') {
            limit(`presence-stream:${who.id}`, 60);
            deskPresence.connect(match[1], who, url.searchParams.get('session') ?? '', res); return;
          }
          throw new HttpError(405, 'Method not allowed.');
        }
        limit(`expedition-actor:${who.id}`, 1200);
        if (path === '/api/expeditions' && req.method === 'POST') { send(res, 200, expeditions.create(who, input)); return; }
        if (match && req.method === 'POST' && match[2] === 'join') { send(res, 200, expeditions.join(match[1], who)); return; }
        if (match && req.method === 'POST' && match[2] === 'activity') { send(res, 200, expeditions.activity(match[1], who, input)); return; }
        if (match && req.method === 'POST' && match[2] === 'commands') { send(res, 200, expeditions.command(match[1], who, input)); return; }
        if (match && req.method === 'POST' && match[2] === 'delete') { send(res, 200, expeditions.remove(match[1], who)); return; }
        if (match && req.method === 'GET' && !match[2]) { send(res, 200, expeditions.get(match[1], who)); return; }
        throw new HttpError(405, 'Method not allowed.');
      }
      if (path.startsWith('/api/diner/')) {
        // Diner shifts run in memory; only the waiters seated there may open one.
        const match = /^\/api\/diner\/([A-Za-z0-9_-]{32})(?:\/(events|input|again))?$/.exec(path);
        check(match, 404, 'Diner route not found.');
        const [, room, action] = match;
        if (!action && req.method === 'GET') { send(res, 200, diner.get(room, who)); return; }
        if (action === 'events' && req.method === 'GET') {
          check(!req.headers.origin || process.env.NODE_ENV === 'development' || req.headers.origin === origin, 403, 'Request origin is not allowed.');
          diner.connect(room, who, req, res);
          return;
        }
        if (action === 'input' && req.method === 'POST') {
          // Input steps arrive about twenty times a second per waiter.
          limit(`diner:${who?.id ?? ip}`, 700, 10_000);
          send(res, 200, diner.input(room, who, await body(req)));
          return;
        }
        if (action === 'again' && req.method === 'POST') {
          limit(`command:${who?.id ?? ip}`, 120);
          send(res, 200, diner.again(room, who, await body(req)));
          return;
        }
        throw new HttpError(405, 'Method not allowed.');
      }
      if (path.startsWith('/api/alto/')) {
        // Alto rooms open from a table; only the people seated there may play.
        const match = /^\/api\/alto\/([A-Za-z0-9_-]{32})(?:\/(commands|again))?$/.exec(path);
        check(match, 404, 'Alto route not found.');
        const [, room, action] = match;
        if (!action && req.method === 'GET') { send(res, 200, alto.get(room, who)); return; }
        if (action === 'commands' && req.method === 'POST') {
          limit(`alto:${who?.id ?? ip}`, 120);
          send(res, 200, alto.command(room, who, await body(req)));
          return;
        }
        if (action === 'again' && req.method === 'POST') {
          limit(`command:${who?.id ?? ip}`, 120);
          await body(req);
          send(res, 200, alto.again(room, who));
          return;
        }
        throw new HttpError(405, 'Method not allowed.');
      }
      if (path.startsWith('/api/rota/')) {
        // Rota rooms open from a table; only the people seated there may play.
        const match = /^\/api\/rota\/([A-Za-z0-9_-]{32})(?:\/(commands|again))?$/.exec(path);
        check(match, 404, 'Rota route not found.');
        const [, room, action] = match;
        if (!action && req.method === 'GET') { send(res, 200, rota.get(room, who)); return; }
        if (action === 'commands' && req.method === 'POST') {
          limit(`rota:${who?.id ?? ip}`, 120);
          send(res, 200, rota.command(room, who, await body(req)));
          return;
        }
        if (action === 'again' && req.method === 'POST') {
          limit(`command:${who?.id ?? ip}`, 120);
          await body(req);
          send(res, 200, rota.again(room, who));
          return;
        }
        throw new HttpError(405, 'Method not allowed.');
      }
      if (path.startsWith('/api/metro/')) {
        // Metro rooms open from a table; only the people seated there may play.
        const match = /^\/api\/metro\/([A-Za-z0-9_-]{32})(?:\/(commands|again))?$/.exec(path);
        check(match, 404, 'Metro route not found.');
        const [, room, action] = match;
        if (!action && req.method === 'GET') { send(res, 200, metro.get(room, who)); return; }
        if (action === 'commands' && req.method === 'POST') {
          limit(`metro:${who?.id ?? ip}`, 120);
          send(res, 200, metro.command(room, who, await body(req)));
          return;
        }
        if (action === 'again' && req.method === 'POST') {
          limit(`command:${who?.id ?? ip}`, 120);
          await body(req);
          send(res, 200, metro.again(room, who));
          return;
        }
        throw new HttpError(405, 'Method not allowed.');
      }
      if (path.startsWith('/api/arena/')) {
        // Arena battles run in memory; only seated players may open one.
        const match = /^\/api\/arena\/([A-Za-z0-9_-]{32})(?:\/(events|commands|again|deck|quest|draft))?$/.exec(path);
        check(match, 404, 'Arena route not found.');
        const [, room, action] = match;
        if (!action && req.method === 'GET') { send(res, 200, arena.get(room, who)); return; }
        if (action === 'events' && req.method === 'GET') {
          check(!req.headers.origin || process.env.NODE_ENV === 'development' || req.headers.origin === origin, 403, 'Request origin is not allowed.');
          arena.connect(room, who, req, res);
          return;
        }
        if (action === 'commands' && req.method === 'POST') {
          limit(`arena:${who?.id ?? ip}`, 20, 10_000);
          send(res, 200, arena.command(room, who, await body(req)));
          return;
        }
        if (action === 'again' && req.method === 'POST') {
          limit(`command:${who?.id ?? ip}`, 120);
          await body(req);
          send(res, 200, arena.again(room, who));
          return;
        }
        if ((action === 'deck' || action === 'quest' || action === 'draft') && req.method === 'POST') {
          limit(`command:${who?.id ?? ip}`, 120);
          const input = await body(req);
          send(res, 200, action === 'deck' ? arena.deck(room, who, input) : action === 'draft' ? arena.draftPick(room, who, input) : arena.questCommand(room, who, input));
          return;
        }
        throw new HttpError(405, 'Method not allowed.');
      }
      if (path === '/api/session' && req.method === 'GET') {
        send(res, 200, {
          user: who?.userId
            ? { id: who.id, name: who.name, email: who.email }
            : null,
          guest: who && !who.userId ? { name: who.name } : null,
        });
        return;
      }
      if (path === '/api/auth/recover' && req.method === 'POST') {
        limit(`auth:${ip}`, 20, 15 * 60000);
        const input = await body(req);
        const email = emailAddress(input.email);
        limit(`email:${email}`, 10, 15 * 60000);
        const oldSessions = db.prepare('SELECT s.hash FROM sessions s JOIN users u ON u.id=s.user_id WHERE u.email=?').all(email) as { hash: string }[];
        const recovered = await accounts.recover(input);
        for (const c of clients) if (c.who.userId === recovered.id) c.res.end();
        arena.revokeUser(recovered.id);
        diner.revokeUser(recovered.id);
        for (const session of oldSessions) { arena.revoke(session.hash); diner.revoke(session.hash); }
        res.setHeader('Set-Cookie', newSession(db, recovered.id, true, secure));
        send(res, 200, { ok: true, recoveryCode: recovered.recoveryCode });
        return;
      }
      if (path.startsWith('/api/account/')) {
        check(req.method === 'POST', 405, 'Method not allowed.');
        check(who?.userId, 401, 'Log in to manage your account.');
        limit(`account:${who.userId}`, 20, 15 * 60000);
        const input = await body(req);
        who = identity(db, req);
        check(who?.userId, 401, 'Log in to manage your account.');
        if (path === '/api/account/profile') { send(res, 200, accounts.profile(who, input)); return; }
        if (path === '/api/account/recovery-code') { send(res, 200, await accounts.generateRecovery(who, input)); return; }
        if (path === '/api/account/password' || path === '/api/account/delete') {
          const sessions = db.prepare('SELECT hash FROM sessions WHERE user_id=?').all(who.userId) as { hash: string }[];
          if (path.endsWith('/password')) {
            const id = await accounts.password(who, input);
            res.setHeader('Set-Cookie', newSession(db, id, true, secure));
          } else {
            const deleted = await accounts.delete(who, input);
            arena.forgetUser(deleted.userId, deleted.removedTables);
            diner.forgetUser(deleted.userId, deleted.removedTables);
            for (const invite of deleted.removedTables) { drop(invite); publish(invite); }
            res.setHeader('Set-Cookie', `gamehub_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? '; Secure' : ''}`);
          }
          for (const c of clients) if (c.who.userId === who.userId) c.res.end();
          arena.revokeUser(who.userId);
          diner.revokeUser(who.userId);
          for (const session of sessions) { arena.revoke(session.hash); diner.revoke(session.hash); }
          send(res, 200, { ok: true });
          return;
        }
        throw new HttpError(404, 'Account route not found.');
      }
      if (
        (path === '/api/auth/signup' || path === '/api/auth/login') &&
        req.method === 'POST'
      ) {
        limit(`auth:${ip}`, 20, 15 * 60000);
        const input = await body(req),
          email = emailAddress(input.email);
        limit(`email:${email}`, 10, 15 * 60000);
        let id: string, recoveryCode: string | undefined;
        if (path.endsWith('signup')) {
          const name = displayName(input.name),
            password = await hashPassword(input.password);
          check(
            !db.prepare('SELECT id FROM users WHERE email=?').get(email),
            409,
            'An account already exists. Log in instead.',
          );
          // A guest upgrading keeps their existing saved games, table seats
          // and results, which go public with the account.
          id = who && !who.userId ? who.id : token();
          db.prepare('INSERT INTO users VALUES (?,?,?,?)').run(
            id,
            email,
            name,
            password,
          );
          // Other cookies of that guest must not keep acting as the account.
          if (who && !who.userId) {
            revokeGuest(id);
            db.prepare('DELETE FROM sessions WHERE guest_id=?').run(id);
          }
          recoveryCode = accounts.recoveryCode(id);
        } else {
          const user = db
            .prepare('SELECT id,password FROM users WHERE email=?')
            .get(email) as { id: string; password: string } | undefined;
          const valid = await verifyPassword(
            input.password,
            user?.password ?? dummyPassword,
          );
          check(user && valid, 401, 'Email or password is incorrect.');
          check(db.prepare('SELECT 1 FROM users WHERE id=? AND password=?').get(user.id, user.password), 401, 'Email or password is incorrect.');
          id = user.id;
          // A guest logging in brings their results and solo rooms along, if
          // that guest session is still valid after the password check.
          const still = who && !who.userId ? identity(db, req) : null;
          if (still && !still.userId && still.id === who!.id && still.id !== id) {
            revokeGuest(still.id);
            const removed = accounts.adoptGuest(still.id, id);
            for (const invite of removed) { drop(invite); publish(invite); }
          }
        }
        if (who)
          db.prepare('DELETE FROM sessions WHERE hash=?').run(who.sessionHash);
        res.setHeader('Set-Cookie', newSession(db, id, true, secure));
        send(res, 200, { ok: true, ...(recoveryCode ? { recoveryCode } : {}) });
        return;
      }
      if (
        path === '/api/auth/dev' &&
        req.method === 'POST' &&
        process.env.NODE_ENV === 'development'
      ) {
        // Development only: Play with friends signs you in to one shared dev account.
        const email = 'dev@gamehub.localhost';
        let user = db.prepare('SELECT id FROM users WHERE email=?').get(email) as
          | { id: string }
          | undefined;
        if (!user) {
          user = { id: token() };
          // A random, forgotten password: the account never opens through Log in.
          db.prepare('INSERT INTO users VALUES (?,?,?,?)').run(
            user.id,
            email,
            'Dev',
            await hashPassword(token()),
          );
        }
        if (who)
          db.prepare('DELETE FROM sessions WHERE hash=?').run(who.sessionHash);
        res.setHeader('Set-Cookie', newSession(db, user.id, true, secure));
        send(res, 200, { ok: true });
        return;
      }
      if (path === '/api/auth/logout' && req.method === 'POST') {
        if (who) {
          db.prepare('DELETE FROM sessions WHERE hash=?').run(who.sessionHash);
          for (const c of clients)
            if (c.who.sessionHash === who.sessionHash) c.res.end();
          arena.revoke(who.sessionHash);
          diner.revoke(who.sessionHash);
        }
        res.setHeader(
          'Set-Cookie',
          `gamehub_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? '; Secure' : ''}`,
        );
        send(res, 200, { ok: true });
        return;
      }
      if (path === '/api/tables') {
        check(who?.userId, 401, 'Sign in to manage tables.');
        if (req.method === 'GET') {
          send(res, 200, tables.list(who));
          return;
        }
        if (req.method === 'POST') {
          limit(`create:${who.id}`, 10);
          const t = tables.create(who);
          send(res, 201, { token: t.token });
          return;
        }
      }
      if (path === '/api/content-flags') {
        check(req.method === 'POST', 405, 'Method not allowed.');
        check(who, 401, 'Sign in or join a table first.');
        limit(`flag:${who.id}`, 60);
        const input = await body(req),
          title = flaggedTitle(input.gameId, input.key);
        check(title, 400, 'Unknown prompt.');
        flagContent(db, who, input.gameId as 'orin' | 'dial', input.key as number, title);
        send(res, 200, { flagged: true });
        return;
      }
      const devPlayer =
        process.env.NODE_ENV === 'development' && req.method === 'POST'
          ? /^\/api\/tables\/([A-Za-z0-9_-]{32})\/dev-player$/.exec(path)
          : null;
      if (devPlayer) {
        // Development only: seat a fresh guest and hand its session to a new tab.
        const t = tables.get(devPlayer[1]);
        check(who?.userId === t.owner, 403, 'Only the host can add test players.');
        check(t.status === 'lobby', 409, 'Add test players in the lobby.');
        const id = token();
        db.prepare('INSERT INTO guests VALUES (?,?)').run(
          id,
          `Player ${t.members.length + 1}`,
        );
        const session = newSession(db, id, false, secure)
          .split(';')[0]
          .slice('gamehub_session='.length);
        tables.join(devPlayer[1], identity(db, { headers: { cookie: `gamehub_session=${session}` } } as IncomingMessage)!);
        publish(devPlayer[1]);
        send(res, 200, { session });
        return;
      }
      const match =
        /^\/api\/tables\/([A-Za-z0-9_-]{32})(?:\/(join|events|commands|launch))?$/.exec(
          path,
        );
      check(match, 404, 'Not found.');
      const [, invite, action] = match;
      const t = tables.get(invite);
      check(t.status !== 'closed', 410, 'This table has closed.');
      if (action === 'join' && req.method === 'POST') {
        const input = await body(req);
        if (!who) {
          limit(`guest:${ip}`, 30, 15 * 60000);
          const name = displayName(input.name),
            id = token();
          check(
            t.members.length < (t.status === 'lobby' ? t.capacity : 24),
            409,
            'This table is full.',
          );
          db.prepare('INSERT INTO guests VALUES (?,?)').run(id, name);
          const cookie = newSession(db, id, false, secure);
          res.setHeader('Set-Cookie', cookie);
          req.headers.cookie = cookie.split(';')[0];
          who = identity(db, req)!;
        }
        const joined = tables.join(invite, who);
        publish(invite);
        send(res, 200, tables.view(joined, who));
        return;
      }
      check(who, 401, 'Enter your name to join.');
      const view = tables.view(t, who);
      if (!action && req.method === 'GET') {
        send(res, 200, view);
        return;
      }
      if (action === 'launch' && req.method === 'POST') {
        // Folio, Relic and Arena run in their own rooms: open one, seat
        // everyone at the table in it, and send the table there.
        limit(`command:${who.id}`, 120);
        const input = await body(req);
        tables.checkLaunch(t, who);
        const guest = (m: { id: string; name: string }): Identity => ({
          id: m.id,
          name: m.name,
          userId: null,
          sessionHash: '',
          expires: 0,
        });
        check(input.token === undefined || (typeof input.token === 'string' && /^[A-Za-z0-9_-]{32}$/.test(input.token)), 400, 'Choose a saved game.');
        const players = t.members.map(guest);
        let url: string;
        if (input.kind === 'arena') {
          // Arena seats two in a duel and four in a team battle; bots fill the rest.
          url = `/arena/${arena.launch(invite, t.owner, t.members, input)}`;
        } else if (input.kind === 'diner') {
          // Diner seats everyone at the table as waiters, one to four.
          url = `/diner/${diner.launch(invite, t.owner, t.members, input)}`;
        } else if (input.kind === 'alto') {
          // Alto seats everyone at the table; bots take any seats left over.
          url = `/alto/${alto.launch(invite, t.owner, t.members, input)}`;
        } else if (input.kind === 'rota') {
          // Rota seats everyone at the table; bots take any seats left over.
          url = `/rota/${rota.launch(invite, t.owner, t.members, input)}`;
        } else if (input.kind === 'metro') {
          // Metro seats everyone at the table; bots take any seats left over.
          url = `/metro/${metro.launch(invite, t.owner, t.members, input)}`;
        } else if (input.kind === 'folio') {
          check(t.members.length <= 3, 409, 'Puzzles seats one to three players.');
          const run = input.token
            ? folio.seatTable(input.token as string, who, players)
            : folio.create(who, { seats: t.members.length, difficulty: input.difficulty ?? 1 }) as { token: string };
          if (!input.token) folio.seatTable(run.token, who, players);
          url = `/folio/${run.token}`;
        } else {
          check(input.kind === 'relic', 400, 'Unknown game.');
          check(t.members.length <= 3, 409, 'Solo and co-op games seat up to three players.');
          const owner = t.members.find((m) => m.id === t.owner)?.name ?? who.name;
          const room = input.token
            ? expeditions.seatTable(input.token as string, who, players)
            : expeditions.create(who, { title: input.title ?? `${owner}’s table`.slice(0, 40), world: input.world ?? 'dunes' }) as { token: string };
          if (!input.token) expeditions.seatTable(room.token, who, players);
          url = `/expedition/${room.token}`;
        }
        const launched = tables.handOff(invite, { kind: input.kind, url });
        publish(invite);
        send(res, 200, { url, at: launched.handoff!.at });
        return;
      }
      if (action === 'commands' && req.method === 'POST') {
        limit(`command:${who.id}`, 120);
        const changed = tables.command(
          invite,
          who,
          (await body(req)) as unknown as Command,
        );
        followAdmin(changed);
        publish(invite);
        if (changed.status === 'closed') drop(invite);
        send(
          res,
          200,
          changed.members.some((m) => m.id === who!.id)
            ? tables.view(changed, who)
            : { left: true },
        );
        return;
      }
      if (action === 'events' && req.method === 'GET') {
        check(
          !req.headers.origin ||
            process.env.NODE_ENV === 'development' ||
            req.headers.origin === origin,
          403,
          'Request origin is not allowed.',
        );
        check(
          [...clients].filter((c) => c.who.id === who!.id).length < 12 &&
            clients.size < 2000,
          429,
          'Too many open connections.',
        );
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
          'X-Accel-Buffering': 'no',
        });
        const c = { req, res, who, invite };
        clients.add(c);
        publish(invite);
        res.on('close', () => {
          clients.delete(c);
          if (stopping) return;
          publish(invite);
          handOverLater(invite);
        });
        return;
      }
      throw new HttpError(405, 'Method not allowed.');
    } catch (error) {
      if (res.headersSent) {
        res.end();
        return;
      }
      if (!(error instanceof HttpError))
        console.error('Request failed:', error);
      send(res, error instanceof HttpError ? error.status : 500, {
        error:
          error instanceof HttpError
            ? error.message
            : 'Something went wrong. Please try again.',
        ...(error instanceof ArenaRefusal ? { reason: error.reason } : {}),
      });
    }
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  const publicDir = resolve(options.staticDir ?? 'dist/client');
  function serveStatic(
    path: string,
    req: IncomingMessage,
    res: ServerResponse,
  ) {
    check(
      req.method === 'GET' || req.method === 'HEAD',
      405,
      'Method not allowed.',
    );
    let file: string;
    if (
      path === '/' ||
      path === '/auth' ||
      path === '/account' ||
      path === '/leaderboards' ||
      path === '/tables' ||
      path === '/relic' ||
      path === '/folio' ||
      path === '/arena' ||
      path === '/rota' ||
      path === '/metro' ||
      path === '/alto' ||
      path === '/diner' ||
      path === '/sound-lab' ||
      /^\/folio\/[A-Za-z0-9_-]{32}$/.test(path) ||
      /^\/arena\/[A-Za-z0-9_-]{32}$/.test(path) ||
      /^\/rota\/[A-Za-z0-9_-]{32}$/.test(path) ||
      /^\/metro\/[A-Za-z0-9_-]{32}$/.test(path) ||
      /^\/alto\/[A-Za-z0-9_-]{32}$/.test(path) ||
      /^\/diner\/[A-Za-z0-9_-]{32}$/.test(path) ||
      /^\/expedition\/[A-Za-z0-9_-]{32}$/.test(path) ||
      /^\/table\/[A-Za-z0-9_-]{32}$/.test(path)
    )
      file = join(publicDir, 'index.html');
    else {
      const decoded = decodeURIComponent(path);
      check(
        !decoded.split('/').some((p) => p.startsWith('.')) &&
          !decoded.includes('\\'),
        404,
        'Not found.',
      );
      file = resolve(publicDir, `.${decoded}`);
      check(file.startsWith(publicDir + '/'), 404, 'Not found.');
    }
    let size: number;
    try {
      const stat = statSync(file);
      check(stat.isFile(), 404, 'Not found.');
      size = stat.size;
    } catch {
      throw new HttpError(404, 'Not found.');
    }
    const mime: Record<string, string> = {
      '.html': 'text/html; charset=utf-8',
      '.js': 'text/javascript',
      '.css': 'text/css',
      '.png': 'image/png',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      '.woff2': 'font/woff2',
      '.json': 'application/json',
      '.ico': 'image/x-icon',
      '.mp3': 'audio/mpeg',
      '.m4a': 'audio/mp4',
      '.glb': 'model/gltf-binary',
    };
    res.writeHead(200, {
      'Content-Type': mime[extname(file)] ?? 'application/octet-stream',
      'Content-Length': size,
      'Cache-Control':
        extname(file) === '.html'
          ? 'no-cache'
          : /^\/art\/(?:optimized\/)?[a-z0-9-]+-v\d+(?:-\d+)?\.webp$/.test(path) ||
              // Arena's and Rota's 3D files carry content hashes in their names.
              /^\/3d\/(?:arena|rota)\/[a-z]+\/[a-z0-9-]+-[0-9a-f]{8}\.(?:webp|glb)$/.test(path)
            ? 'public, max-age=31536000, immutable'
            : 'public, max-age=3600',
    });
    if (req.method === 'HEAD') res.end();
    else
      createReadStream(file)
        .on('error', () => res.destroy())
        .pipe(res);
  }
  const heartbeat = setInterval(() => {
    for (const c of clients) {
      if (!identity(db, c.req)) {
        c.res.write('event: revoked\ndata: {}\n\n');
        c.res.end();
      } else c.res.write(': heartbeat\n\n');
    }
  }, 15000);
  heartbeat.unref();
  const sweeper = setInterval(() => sweep(), Math.min(30_000, idleTableMs));
  sweeper.unref();
  for (const row of db.prepare('SELECT token FROM tables').all() as {
    token: string;
  }[])
    schedule(row.token);
  async function close() {
    stopping = true;
    clearInterval(heartbeat);
    clearInterval(sweeper);
    arena.close();
    alto.close();
    diner.close();
    deskPresence.close();
    for (const seats of jobs.values())
      for (const j of seats.values()) {
        clearTimeout(j.timer);
        await j.worker?.terminate();
      }
    jobs.clear();
    for (const c of clients) c.res.end();
    clients.clear();
    await new Promise<void>((done) => {
      server.close(() => done());
      server.closeIdleConnections();
    });
    db.close();
  }
  return { server, close, tables, db, sweep, arena, diner };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  if (process.env.NODE_ENV === 'production' && !process.env.PUBLIC_ORIGIN)
    throw new Error('Set PUBLIC_ORIGIN to the public URL.');
  const app = await makeServer();
  const port = Number(process.env.PORT ?? 3018);
  app.server.listen(port, process.env.HOST ?? '0.0.0.0', () =>
    console.log(`Gamehub backend listening on ${port}`),
  );
  let exiting = false;
  for (const signal of ['SIGINT', 'SIGTERM'])
    process.on(signal, () => {
      if (!exiting) {
        exiting = true;
        void app.close().then(() => process.exit(0));
      }
    });
}
