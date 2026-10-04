import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { prepareProductionPublic } from '../scripts/build-public.mjs';

await test('production staging copies selected assets, drops candidates and clears stale assets', async () => {
  const root = await mkdtemp(join(tmpdir(), 'gamehub-build-assets-'));
  try {
    await mkdir(join(root, 'public/art'), { recursive: true });
    await writeFile(join(root, 'public/art/selected.webp'), 'selected');
    await writeFile(join(root, 'public/art/source.png'), 'source candidate');
    await writeFile(join(root, 'public/art/box-diner-blind-v1.webp'), 'development cover');
    await writeFile(join(root, 'public/.DS_Store'), 'metadata');
    await writeFile(join(root, '.dockerignore'), 'public/**\n!public/\npublic/*\n!public/art/\npublic/art/*\n!public/art/selected.webp\n');
    const target = await prepareProductionPublic(root);
    assert.deepEqual(await readdir(target), ['art']);
    assert.deepEqual(await readdir(join(target, 'art')), ['selected.webp']);
    assert.equal(await readFile(join(target, 'art/selected.webp'), 'utf8'), 'selected');
    await writeFile(join(target, 'art/stale.webp'), 'old production asset');
    await prepareProductionPublic(root);
    assert.deepEqual(await readdir(join(target, 'art')), ['selected.webp']);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

await test('release allowlist excludes source assets and development-only Diner covers', async () => {
  const rules = await readFile(new URL('../.dockerignore', import.meta.url), 'utf8');
  assert.match(rules, /^assets$/m);
  assert.doesNotMatch(rules, /^!public\/.*box-diner-/m);
});
