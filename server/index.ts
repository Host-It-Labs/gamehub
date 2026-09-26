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
import { Tables } from './tables.ts';
import { Expeditions } from './expeditions.ts';
import { FolioRuns } from './folio.ts';
import { flagContent, flaggedTitle } from './content-flags.ts';
import {
  observe,
  canAct,
  preparationKey,
  revealingTrick,
  trickRevealMs,
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
  } = {},
) {
  const origin = new URL(
    options.origin ?? process.env.PUBLIC_ORIGIN ?? 'http://localhost:3017',
  ).origin;
  const secure = origin.startsWith('https:');
  const db = openDatabase(
    options.database ?? process.env.DATABASE_PATH ?? '.data/gamehub.sqlite',
  );
  const expeditions = new Expeditions(db);
  const folio = new FolioRuns(db);
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
      if ((JSON.parse(state) as { status: string }).status === 'closed') {
        drop(invite);
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
      if(t.status==='finished'&&t.nextVote){
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
        if (stopping) return;
        tables.botMove(invite, decision, move, seat);
        publish(invite);
      };
      const job: BotJob = {
        decision,
        timer: setTimeout(() => {
          try {
            job.worker = new Worker(
              new URL('./bot-worker.ts', import.meta.url),
              {
                workerData: { ...observe(game, seat), active: seat },
                execArgv: ['--experimental-strip-types'],
              },
            );
            job.worker.once('message', (move: Move) => finish(move));
            job.worker.once('error', () => finish(null));
            job.worker.once('exit', () => {
              if (!done) finish(null);
            });
            job.timer = setTimeout(() => finish(null), 10000);
          } catch {
            finish(null);
          }
          // Let clients finish showing a completed Nox trick before a bot plays into the next one.
        }, revealingTrick(game) ? trickRevealMs + 120 : 120),
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
      limit(`${path.startsWith('/api/expeditions') ? 'expedition' : 'request'}:${ip}`, path.startsWith('/api/expeditions') ? 3600 : 600);
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
      if (path === '/api/folio' || path.startsWith('/api/folio/')) {
        const match = /^\/api\/folio\/([A-Za-z0-9_-]{32})(?:\/(join|commands|delete))?$/.exec(path);
        check(path === '/api/folio' || match, 404, 'Folio route not found.');
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
        const match = /^\/api\/expeditions\/([A-Za-z0-9_-]{32})(?:\/(join|commands|activity|delete))?$/.exec(path);
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
        limit(`expedition-actor:${who.id}`, 1200);
        if (path === '/api/expeditions' && req.method === 'POST') { send(res, 200, expeditions.create(who, input)); return; }
        if (match && req.method === 'POST' && match[2] === 'join') { send(res, 200, expeditions.join(match[1], who)); return; }
        if (match && req.method === 'POST' && match[2] === 'activity') { send(res, 200, expeditions.activity(match[1], who, input)); return; }
        if (match && req.method === 'POST' && match[2] === 'commands') { send(res, 200, expeditions.command(match[1], who, input)); return; }
        if (match && req.method === 'POST' && match[2] === 'delete') { send(res, 200, expeditions.remove(match[1], who)); return; }
        if (match && req.method === 'GET' && !match[2]) { send(res, 200, expeditions.get(match[1], who)); return; }
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
      if (
        (path === '/api/auth/signup' || path === '/api/auth/login') &&
        req.method === 'POST'
      ) {
        limit(`auth:${ip}`, 20, 15 * 60000);
        const input = await body(req),
          email = emailAddress(input.email);
        limit(`email:${email}`, 10, 15 * 60000);
        let id: string;
        if (path.endsWith('signup')) {
          const name = displayName(input.name),
            password = await hashPassword(input.password);
          check(
            !db.prepare('SELECT id FROM users WHERE email=?').get(email),
            409,
            'An account already exists. Log in instead.',
          );
          id = token();
          db.prepare('INSERT INTO users VALUES (?,?,?,?)').run(
            id,
            email,
            name,
            password,
          );
        } else {
          const user = db
            .prepare('SELECT id,password FROM users WHERE email=?')
            .get(email) as { id: string; password: string } | undefined;
          const valid = await verifyPassword(
            input.password,
            user?.password ?? dummyPassword,
          );
          check(user && valid, 401, 'Email or password is incorrect.');
          id = user.id;
        }
        if (who)
          db.prepare('DELETE FROM sessions WHERE hash=?').run(who.sessionHash);
        res.setHeader('Set-Cookie', newSession(db, id, true, secure));
        send(res, 200, { ok: true });
        return;
      }
      if (path === '/api/auth/logout' && req.method === 'POST') {
        if (who) {
          db.prepare('DELETE FROM sessions WHERE hash=?').run(who.sessionHash);
          for (const c of clients)
            if (c.who.sessionHash === who.sessionHash) c.res.end();
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
      const preference =
        /^\/api\/preferences\/(confirm-moves\.(?:undertow|wildgrove|midnight))$/.exec(
          path,
        );
      if (preference) {
        if (!who?.userId) {
          send(res, 200, { account: false, value: null });
          return;
        }
        const key = preference[1];
        if (req.method === 'GET') {
          const row = db
            .prepare(
              'SELECT value FROM user_preferences WHERE user_id=? AND key=?',
            )
            .get(who.userId, key) as { value: string } | undefined;
          send(res, 200, {
            account: true,
            value: row ? row.value === 'true' : null,
          });
          return;
        }
        if (req.method === 'POST') {
          const input = await body(req);
          check(typeof input.value === 'boolean', 400, 'Invalid preference.');
          db.prepare(
            'INSERT INTO user_preferences VALUES (?,?,?) ON CONFLICT(user_id,key) DO UPDATE SET value=excluded.value',
          ).run(who.userId, key, String(input.value));
          send(res, 200, { account: true, value: input.value });
          return;
        }
        throw new HttpError(405, 'Method not allowed.');
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
        // Folio and Relic run in their own rooms: open one, seat everyone at
        // the table in it, and send the table there.
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
        check(t.members.length <= 3, 409, 'Solo and co-op games seat up to three players.');
        check(input.token === undefined || (typeof input.token === 'string' && /^[A-Za-z0-9_-]{32}$/.test(input.token)), 400, 'Choose a saved game.');
        const players = t.members.map(guest);
        let url: string;
        if (input.kind === 'folio') {
          check(t.members.length <= 3, 409, 'Folio seats one to three players.');
          const run = input.token
            ? folio.seatTable(input.token as string, who, players)
            : folio.create(who, { seats: t.members.length, difficulty: input.difficulty ?? 1 }) as { token: string };
          if (!input.token) folio.seatTable(run.token, who, players);
          url = `/folio/${run.token}`;
        } else {
          check(input.kind === 'relic', 400, 'Unknown game.');
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
          if (!stopping) publish(invite);
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
      path === '/tables' ||
      path === '/relic' ||
      path === '/folio' ||
      path === '/sound-lab' ||
      /^\/folio\/[A-Za-z0-9_-]{32}$/.test(path) ||
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
    };
    res.writeHead(200, {
      'Content-Type': mime[extname(file)] ?? 'application/octet-stream',
      'Content-Length': size,
      'Cache-Control':
        extname(file) === '.html'
          ? 'no-cache'
          : /^\/art\/(?:optimized\/)?[a-z0-9-]+-v\d+(?:-\d+)?\.webp$/.test(path)
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
  return { server, close, tables, db, sweep };
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
