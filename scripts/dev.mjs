import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createServer } from 'node:net';
if (existsSync('.env')) process.loadEnvFile('.env');
const frontend = Number(process.env.DEV_PORT ?? 3017),
  backend = Number(process.env.API_PORT ?? 3018);
const origin = process.env.PUBLIC_ORIGIN ?? `http://localhost:${frontend}`;
for (const port of [frontend, backend]) {
  await new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once('error', () =>
      reject(
        new Error(
          `Port ${port} is already in use. Stop the existing Gamehub dev action, or set DEV_PORT and API_PORT to free ports.`,
        ),
      ),
    );
    probe.listen(port, '0.0.0.0', () => probe.close(resolve));
  });
}
const env = {
  ...process.env,
  PUBLIC_ORIGIN: origin,
  API_PORT: String(backend),
  PORT: String(backend),
  NODE_ENV: 'development',
};
const children = [
  spawn(
    process.execPath,
    ['--experimental-strip-types', '--watch', 'server/index.ts'],
    { stdio: 'inherit', env },
  ),
  spawn(
    process.execPath,
    ['node_modules/vinext/dist/cli.js', 'dev', '--port', String(frontend)],
    { stdio: 'inherit', env },
  ),
];
console.log(
  `Gamehub: ${origin}\nFrontend hot reload and backend watch are running. Ctrl+C stops both.`,
);
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill('SIGTERM');
  const timer = setTimeout(() => {
    for (const child of children) child.kill('SIGKILL');
    process.exit(code);
  }, 5000);
  void Promise.all(
    children.map((c) =>
      c.exitCode !== null
        ? Promise.resolve()
        : new Promise((r) => c.once('exit', r)),
    ),
  ).then(() => {
    clearTimeout(timer);
    process.exit(code);
  });
}
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => stop());
for (const child of children) {
  child.on('error', (error) => {
    console.error(error.message);
    stop(1);
  });
  child.on('exit', (code) => {
    if (!stopping) stop(code ?? 1);
  });
}
