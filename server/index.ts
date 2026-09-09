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
import { observe, type Move } from '../lib/games/trio/engine.ts';
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
  } = {},
) {
  const origin = new URL(
    options.origin ?? process.env.PUBLIC_ORIGIN ?? 'http://localhost:3017',
  ).origin;
  const secure = origin.startsWith('https:');
  const db = openDatabase(
    options.database ?? process.env.DATABASE_PATH ?? '.data/gamehub.sqlite',
  );
  const clients = new Set<Client>();
  const jobs = new Map<
    string,
    { timer: ReturnType<typeof setTimeout>; worker?: Worker }
  >();
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
  function schedule(invite: string) {
    if (stopping || options.bots === false || jobs.has(invite)) return;
    const t = tables.get(invite);
    if (
      t.status !== 'playing' ||
      !t.game ||
      t.botError ||
      !t.seats[t.game.active].bot
    )
      return;
    const job: { timer: ReturnType<typeof setTimeout>; worker?: Worker } = {
      timer: setTimeout(() => {
        const latest = tables.get(invite);
        if (latest.revision !== t.revision) {
          jobs.delete(invite);
          schedule(invite);
          return;
        }
        let done = false;
        const finish = (move: Move | null) => {
          if (done) return;
          done = true;
          clearTimeout(job.timer);
          void job.worker?.terminate();
          jobs.delete(invite);
          if (stopping) return;
          tables.botMove(invite, t.revision, move);
          publish(invite);
        };
        try {
          job.worker = new Worker(new URL('./bot-worker.ts', import.meta.url), {
            workerData: observe(latest.game!),
            execArgv: ['--experimental-strip-types'],
          });
          job.worker.once('message', (move: Move) => finish(move));
          job.worker.once('error', () => finish(null));
          job.worker.once('exit', () => {
            if (!done) finish(null);
          });
          job.timer = setTimeout(() => finish(null), 10000);
        } catch {
          finish(null);
        }
      }, 350),
    };
    jobs.set(invite, job);
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
          req.headers.origin === origin,
          403,
          'Request origin is not allowed.',
        );
      const ip = req.socket.remoteAddress ?? 'unknown';
      limit(`request:${ip}`, 600);
      let who = identity(db, req);
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
      const match =
        /^\/api\/tables\/([A-Za-z0-9_-]{32})(?:\/(join|events|commands))?$/.exec(
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
      if (action === 'commands' && req.method === 'POST') {
        limit(`command:${who.id}`, 120);
        const changed = tables.command(
          invite,
          who,
          (await body(req)) as unknown as Command,
        );
        publish(invite);
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
          !req.headers.origin || req.headers.origin === origin,
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
      '.svg': 'image/svg+xml',
      '.woff2': 'font/woff2',
      '.json': 'application/json',
      '.ico': 'image/x-icon',
    };
    res.writeHead(200, {
      'Content-Type': mime[extname(file)] ?? 'application/octet-stream',
      'Content-Length': size,
      'Cache-Control':
        extname(file) === '.html' ? 'no-cache' : 'public, max-age=3600',
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
  for (const row of db.prepare('SELECT token FROM tables').all() as {
    token: string;
  }[])
    schedule(row.token);
  async function close() {
    stopping = true;
    clearInterval(heartbeat);
    for (const j of jobs.values()) {
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
  return { server, close, tables, db };
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
