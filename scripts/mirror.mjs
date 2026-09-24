// Mirrors this checkout, uncommitted changes included, into a permanent
// sibling worktree (../gamehub-mirror) and runs its dev server on the next
// free port pair. Each run makes the mirror match this tree one-to-one,
// restarts its server, and leaves the mirror's database in .data alone.
import { execFileSync, spawn } from 'node:child_process';
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  rmSync,
  symlinkSync,
} from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';

const source = resolve(
  execFileSync('git', ['rev-parse', '--show-toplevel'], {
    encoding: 'utf8',
  }).trim(),
);
const mirror = resolve(
  process.env.MIRROR_DIR ?? join(dirname(source), `${basename(source)}-mirror`),
);
const base = Number(process.env.DEV_PORT ?? 3017);
const frontend = Number(process.env.MIRROR_PORT ?? base + 2),
  backend = Number(process.env.MIRROR_API_PORT ?? frontend + 1);

const git = (cwd, ...args) =>
  execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 1 << 28 });
const paths = (output) => output.split('\0').filter(Boolean);

// 1. Stop a mirror server left running by a previous run.
const lines = (command, args) => {
  try {
    return execFileSync(command, args, { encoding: 'utf8' })
      .split('\n')
      .filter(Boolean);
  } catch {
    return [];
  }
};
const listeners = new Set(
  lines('lsof', ['-ti', `tcp:${frontend},${backend}`, '-sTCP:LISTEN']),
);
for (const pid of listeners) {
  const cwd = lines('lsof', ['-a', '-p', pid, '-d', 'cwd', '-Fn'])
    .find((line) => line.startsWith('n'))
    ?.slice(1);
  if (cwd && cwd !== mirror && !cwd.startsWith(`${mirror}/`)) {
    console.error(
      `Port ${frontend} or ${backend} is used by another process (pid ${pid}, ${cwd}). Set MIRROR_PORT to a free port.`,
    );
    process.exit(1);
  }
}
for (const pid of listeners) {
  try {
    process.kill(Number(pid), 'SIGTERM');
  } catch {}
}
for (let i = 0; i < 50; i++) {
  try {
    execFileSync('lsof', ['-ti', `tcp:${frontend},${backend}`, '-sTCP:LISTEN']);
    await new Promise((r) => setTimeout(r, 100));
  } catch {
    break;
  }
}

// 2. Create the worktree once, then reset it to this checkout's commit.
const head = git(source, 'rev-parse', 'HEAD').trim();
if (!existsSync(join(mirror, '.git'))) {
  git(source, 'worktree', 'add', '--detach', mirror, head);
  console.log(`Created mirror worktree at ${mirror}`);
}
git(mirror, 'checkout', '--detach', '--force', head);
git(mirror, 'clean', '-fdq');

// 3. Overlay every uncommitted change: staged, unstaged, deleted, untracked.
const changed = new Set([
  ...paths(git(source, 'diff', 'HEAD', '--name-only', '--no-renames', '-z')),
  ...paths(git(source, 'ls-files', '--others', '--exclude-standard', '-z')),
]);
let copied = 0,
  removed = 0;
for (const path of changed) {
  const from = join(source, path),
    to = join(mirror, path);
  if (existsSync(from) || isSymlink(from)) {
    mkdirSync(dirname(to), { recursive: true });
    rmSync(to, { recursive: true, force: true });
    cpSync(from, to, { verbatimSymlinks: true });
    copied++;
  } else {
    rmSync(to, { force: true });
    removed++;
  }
}
for (const file of ['.env']) {
  if (existsSync(join(source, file)))
    cpSync(join(source, file), join(mirror, file));
}

// 4. Share installed packages entry by entry so Vite caches stay separate.
const modules = join(mirror, 'node_modules');
rmSync(modules, { recursive: true, force: true });
mkdirSync(modules);
for (const entry of readdirSync(join(source, 'node_modules'))) {
  if (entry === '.vite' || entry === '.cache') continue;
  symlinkSync(join(source, 'node_modules', entry), join(modules, entry));
}

console.log(
  `Mirrored ${head.slice(0, 7)} + ${copied} changed, ${removed} deleted file(s) into ${mirror}`,
);

// 5. Run the mirror's dev server in the foreground.
const origin = `http://localhost:${frontend}`;
const child = spawn(process.execPath, ['scripts/dev.mjs'], {
  cwd: mirror,
  stdio: 'inherit',
  env: {
    ...process.env,
    DEV_PORT: String(frontend),
    API_PORT: String(backend),
    PUBLIC_ORIGIN: origin,
    VINEXT_NO_DEV_LOCK: '1',
  },
});
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => child.kill(signal));
child.on('exit', (code) => process.exit(code ?? 0));

function isSymlink(path) {
  try {
    return lstatSync(path).isSymbolicLink();
  } catch {
    return false;
  }
}
