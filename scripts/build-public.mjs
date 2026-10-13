import { copyFile, mkdir, readFile, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Use the same asset payload for local builds and Docker. The generated
 * allowlist and production-only public directory are checked by prebuild. */
export async function prepareProductionPublic(
  root = fileURLToPath(new URL('../', import.meta.url)),
) {
  const rules = await readFile(resolve(root, '.dockerignore'), 'utf8');
  const files = rules.split('\n').filter((line) =>
    line.startsWith('!public/') && !line.endsWith('/'),
  ).map((line) => line.slice('!public/'.length));
  if (!files.length) throw new Error('Production asset allowlist is empty.');
  const target = resolve(root, '.vinext/production-public');
  await rm(target, { recursive: true, force: true });
  for (const file of files) {
    const destination = resolve(target, file);
    await mkdir(dirname(destination), { recursive: true });
    await copyFile(resolve(root, 'public', file), destination);
  }
  return target;
}
