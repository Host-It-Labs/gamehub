/**
 * Start the stand-alone Arena lab server (vite.config.mts beside this) in
 * the background unless it is already answering. Its pid and log go to
 * work/arena/lab-server.{pid,log}; stop it with
 * `kill $(cat work/arena/lab-server.pid)`.
 *
 *   node scripts/arena-lab/serve.mjs [--port 3027]
 */
import { spawn } from 'node:child_process';
import { mkdirSync, openSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const at = process.argv.indexOf('--port');
const port = at > 0 ? Number(process.argv[at + 1]) : 3027;
const repo = fileURLToPath(new URL('../../', import.meta.url));
const url = `http://127.0.0.1:${port}/`;
const up = async () => {
  try {
    return (await fetch(url)).ok;
  } catch {
    return false;
  }
};
if (await up()) {
  console.log(`Arena lab already running at ${url}`);
  process.exit(0);
}
mkdirSync(`${repo}work/arena`, { recursive: true });
const log = openSync(`${repo}work/arena/lab-server.log`, 'a');
const child = spawn(
  process.execPath,
  [
    `${repo}node_modules/vite/bin/vite.js`,
    '--config',
    `${repo}scripts/arena-lab/vite.config.mts`,
  ],
  {
    cwd: repo,
    detached: true,
    stdio: ['ignore', log, log],
    env: { ...process.env, ARENA_LAB_PORT: String(port) },
  },
);
child.unref();
writeFileSync(`${repo}work/arena/lab-server.pid`, String(child.pid));
for (let i = 0; i < 120; i++) {
  if (await up()) {
    console.log(`Arena lab at ${url} (pid ${child.pid})`);
    process.exit(0);
  }
  await new Promise((r) => setTimeout(r, 500));
}
console.error('Arena lab did not start; see work/arena/lab-server.log');
process.exit(1);
