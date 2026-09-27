#!/usr/bin/env node
// Prints the newest Luna model Codex knows about (gpt-6-luna before
// gpt-5.6-luna), read from the model list Codex caches on every run.
// `--all` prints every Luna slug, newest first, for falling back when the
// newest one is refused.
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const cache = join(
  process.env.CODEX_HOME ?? join(homedir(), '.codex'),
  'models_cache.json',
);
const pattern = /^gpt-(\d+(?:\.\d+)*)-luna$/;

let slugs = [];
try {
  slugs = JSON.parse(readFileSync(cache, 'utf8'))
    .models.map((model) => model.slug)
    .filter((slug) => pattern.test(slug));
} catch {
  // No cache yet: fall through to the default below.
}

const version = (slug) => slug.match(pattern)[1].split('.').map(Number);
slugs.sort((a, b) => {
  const [x, y] = [version(a), version(b)];
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const diff = (y[i] ?? 0) - (x[i] ?? 0);
    if (diff) return diff;
  }
  return 0;
});
if (!slugs.length) slugs = ['gpt-6-luna'];

console.log(process.argv.includes('--all') ? slugs.join('\n') : slugs[0]);
