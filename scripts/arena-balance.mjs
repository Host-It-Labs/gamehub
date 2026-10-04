#!/usr/bin/env node
/**
 * Arena balance check: bots play many seeded duels with random legal decks
 * (eight different cards each) and the script reports, per card, how often
 * a deck holding it wins, how often it is played and the crowns such decks
 * take; then win rates by deck shape (with the Dino,
 * with another tank only, without a tank).
 *
 *   node --experimental-strip-types scripts/arena-balance.mjs \
 *     [--games=2000] [--level=hard] [--jobs=4] [--seed=1] [--mode=duel]
 *     [--tweak='{"diver":{"hp":2400},"sumo":{"cost":5}}'] [--open=1]
 *
 * Decks are drawn until playable: two troops that hit flyers and a tank or
 * a siege card, as the drafts guarantee; `--open=1` takes any eight.
 *
 * `--tweak` tries other numbers without editing cards.ts: unit stats by
 * name, and `cost` for the card itself.
 *
 * Every match is deterministic for its seed, so two runs with the same
 * flags print the same numbers.
 */
import os from 'node:os';
import {
  Worker,
  isMainThread,
  parentPort,
  workerData,
} from 'node:worker_threads';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(import.meta.url);

function flags() {
  const out = {
    games: 2000,
    level: 'hard',
    jobs: 0,
    seed: 1,
    mode: 'duel',
    tweak: '{}',
    open: 0,
  };
  for (const a of process.argv.slice(2)) {
    const i = a.indexOf('=');
    const k = a.slice(0, i).replace(/^--/, '');
    const v = a.slice(i + 1);
    if (k in out) out[k] = typeof out[k] === 'number' ? Number(v) : v;
  }
  if (!out.jobs) out.jobs = Math.max(1, Math.min(8, os.cpus().length - 2));
  return out;
}

/** A small seeded generator, apart from the match's own dice. */
function dice(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function playable(deck, troopCards) {
  const troops = deck.map((id) => troopCards[id]).filter(Boolean);
  const air = troops.filter((c) => c.unit.targets === 'any').length;
  const front = troops.some(
    (c) => c.tags.includes('tank') || c.tags.includes('siege'),
  );
  return air >= 2 && front;
}

/** Applies `--tweak` to the card table of this thread. */
function tweak(troopCards, json) {
  for (const [id, over] of Object.entries(JSON.parse(json))) {
    const { cost, ...unit } = over;
    if (cost !== undefined) troopCards[id].cost = cost;
    Object.assign(troopCards[id].unit, unit);
  }
}

async function play(from, to, opts) {
  const { allCards, troopCards } = await import('../lib/games/arena/cards.ts');
  tweak(troopCards, opts.tweak);
  const { createMatch, deploy, step } =
    await import('../lib/games/arena/engine.ts');
  const { botMemory, botStep } = await import('../lib/games/arena/bot.ts');
  const results = [];
  for (let g = from; g < to; g++) {
    const seed = opts.seed * 100003 + g;
    const roll = dice(seed);
    const seats = opts.mode === 'team' ? 4 : 2;
    const decks = [];
    for (let i = 0; i < seats; i++) {
      // Drawn again until playable (unless --open): two troops that hit
      // flyers and a tank or win condition, as the drafts guarantee.
      let deck;
      do {
        const pool = [...allCards];
        deck = [];
        while (deck.length < 8)
          deck.push(pool.splice(Math.floor(roll() * pool.length), 1)[0]);
      } while (!opts.open && !playable(deck, troopCards));
      decks.push(deck);
    }
    const m = createMatch(seed, opts.level, opts.mode, { decks });
    const bots = m.players.map((_, p) => botMemory(p, opts.level, seed));
    const plays = m.players.map(() => ({}));
    let guard = 0;
    while (m.phase !== 'over' && guard++ < 30 * 400) {
      for (const mem of bots) {
        const move = botStep(m, mem);
        if (!move) continue;
        const card = m.players[move.player].hand.cards[move.slot];
        const r = deploy(m, move.player, move.slot, move.x, move.y);
        if (r.ok)
          plays[move.player][card] = (plays[move.player][card] ?? 0) + 1;
      }
      step(m);
      m.events.length = 0;
    }
    results.push({
      decks,
      plays,
      winner: m.winner,
      crowns: [...m.crowns],
      time: m.time,
    });
  }
  return results;
}

if (!isMainThread) {
  const { from, to, opts } = workerData;
  parentPort.postMessage(await play(from, to, opts));
} else {
  const opts = flags();
  const started = Date.now();
  const per = Math.ceil(opts.games / opts.jobs);
  const parts = await Promise.all(
    Array.from({ length: opts.jobs }, (_, j) => {
      const from = j * per;
      const to = Math.min(opts.games, from + per);
      if (from >= to) return Promise.resolve([]);
      return new Promise((resolve, reject) => {
        const w = new Worker(here, {
          workerData: { from, to, opts },
          execArgv: ['--experimental-strip-types', '--no-warnings'],
        });
        w.once('message', resolve);
        w.once('error', reject);
      });
    }),
  );
  const results = parts.flat();
  const { allCards, troopCards, cards } =
    await import('../lib/games/arena/cards.ts');
  tweak(troopCards, opts.tweak);
  if (opts.tweak !== '{}') console.log(`tweaks: ${opts.tweak}`);
  const card = Object.fromEntries(
    allCards.map((id) => [id, { n: 0, score: 0, played: 0, crowns: 0 }]),
  );
  const shapes = {};
  const shapeOf = (deck) => {
    if (deck.includes('ogre')) return 'Dino';
    const tanks = deck.filter(
      (id) => id !== 'ogre' && troopCards[id]?.tags.includes('tank'),
    );
    return tanks.length ? 'other tank, no Dino' : 'no tank';
  };
  const newTanks = ['diver', 'sumo', 'linebacker'];
  let draws = 0;
  let overtime = 0;
  for (const r of results) {
    if (r.winner === 'draw') draws++;
    if (r.time > 180) overtime++;
    r.decks.forEach((deck, p) => {
      const side = p % 2;
      const score = r.winner === 'draw' ? 0.5 : r.winner === side ? 1 : 0;
      for (const id of deck) {
        const c = card[id];
        c.n++;
        c.score += score;
        c.played += r.plays[p][id] ?? 0;
        c.crowns += r.crowns[side];
      }
      const keys = [shapeOf(deck)];
      if (!deck.includes('ogre') && deck.some((id) => newTanks.includes(id)))
        keys.push('a new tank, no Dino');
      for (const k of keys) {
        const s = (shapes[k] ??= { n: 0, score: 0 });
        s.n++;
        s.score += score;
      }
    });
  }
  const pct = (v) => `${(v * 100).toFixed(1)}%`.padStart(6);
  console.log(
    `${results.length} ${opts.mode} matches, bots on ${opts.level}, ` +
      `${draws} draws, ${overtime} went to overtime, ` +
      `${((Date.now() - started) / 1000).toFixed(0)} s\n`,
  );
  console.log('card          cost   decks    win  plays/match  crowns');
  const rows = allCards
    .map((id) => ({ id, ...card[id] }))
    .sort((a, b) => b.score / b.n - a.score / a.n);
  for (const r of rows)
    console.log(
      `${(cards[r.id].name + ` (${r.id})`).padEnd(26).slice(0, 26)}` +
        `${String(cards[r.id].cost).padStart(2)}` +
        `${String(r.n).padStart(7)} ${pct(r.score / r.n)}` +
        `${(r.played / r.n).toFixed(2).padStart(10)}` +
        `${(r.crowns / r.n).toFixed(2).padStart(9)}`,
    );
  console.log('\ndeck shape                 decks    win');
  for (const [k, s] of Object.entries(shapes))
    console.log(
      `${k.padEnd(26)}${String(s.n).padStart(6)} ${pct(s.score / s.n)}`,
    );
}
