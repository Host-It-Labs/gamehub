import test from 'node:test';
import assert from 'node:assert/strict';
import {
  country,
  POOLS,
  findCountry,
  distanceKm,
  direction,
  proximity,
} from '../lib/games/folio/kinds/country.ts';
import { COUNTRY_DATA } from '../lib/games/folio/country-data.ts';
import { COUNTRY_NAMES } from '../lib/games/folio/country-names.ts';

const cases = [
  { level: 1, boss: false },
  { level: 2, boss: false },
  { level: 3, boss: false },
  { level: 4, boss: false },
  { level: 4, boss: true },
  { level: 3, boss: true },
];
const seeds = Array.from({ length: 30 }, (_, i) => i * 7919 + 3);

await test('data: names, points and outlines are sane and small', () => {
  assert.ok(COUNTRY_DATA.length >= 150);
  assert.deepEqual(
    [...COUNTRY_NAMES],
    COUNTRY_DATA.map((c) => c.name),
  );
  assert.equal(new Set(COUNTRY_NAMES).size, COUNTRY_NAMES.length);
  let bytes = 0;
  for (const c of COUNTRY_DATA) {
    bytes += c.path.length;
    assert.match(c.path, /^(M[\d.,L]+Z)+$/, c.name);
    assert.ok(Math.abs(c.lat) <= 90 && Math.abs(c.lon) <= 180, c.name);
    for (const n of c.path.match(/[\d.]+/g).map(Number))
      assert.ok(n >= 0 && n <= 200, c.name);
  }
  assert.ok(bytes < 400_000);
  for (const [pool, names] of Object.entries(POOLS)) {
    assert.ok(names.length >= 20, pool);
    for (const n of names) assert.ok(findCountry(n), `${pool}: ${n}`);
  }
  const all = Object.values(POOLS).flat();
  assert.equal(new Set(all).size, all.length, 'pools do not overlap');
});

await test('Worldle feedback: distance, direction and proximity', () => {
  const fr = findCountry('France'),
    es = findCountry('Spain'),
    jp = findCountry('Japan');
  assert.ok(distanceKm(fr, es) > 500 && distanceKm(fr, es) < 1200);
  assert.equal(direction(fr, es), 'SW');
  assert.equal(direction(es, fr), 'NE');
  assert.equal(proximity(0), 100);
  assert.equal(proximity(20000), 0);
  assert.equal(proximity(25000), 0);
  assert.equal(proximity(10000), 50);
  assert.ok(distanceKm(fr, jp) > 9000);
});

for (const { level, boss } of cases) {
  const label = boss ? 'boss' : `level ${level}`;
  await test(`${label}: deterministic, fast, no leaks`, () => {
    for (const seed of seeds) {
      const t = performance.now();
      const a = country.make({ level, boss, seed });
      assert.ok(performance.now() - t < 50);
      assert.deepEqual(country.make({ level, boss, seed }), a);
      assert.equal(a.allowance, 6);
      assert.ok(
        POOLS[boss || level === 4 ? 'boss' : level].includes(a.secret.answer),
      );
      assert.ok(!JSON.stringify(a.view).includes(a.secret.answer));
      if (boss) assert.ok(a.view.rotate >= 45 && a.view.rotate <= 315);
      else assert.equal(a.view.rotate, 0);
    }
  });
  await test(`${label}: win drill solves in one`, () => {
    for (const seed of seeds) {
      const { view, secret, allowance } = country.make({ level, boss, seed });
      const r = country.move(view, secret, country.win(view, secret));
      assert.ok(r.solved && r.cost <= allowance);
      assert.deepEqual(view.guesses.at(-1), {
        name: secret.answer,
        km: 0,
        dir: null,
        pct: 100,
      });
      assert.equal(country.reveal(view, secret, true), secret.answer);
      assert.equal(view.answer, secret.answer);
    }
  });
  await test(`${label}: lose drill spends all guesses`, () => {
    for (const seed of seeds) {
      const { view, secret, allowance } = country.make({ level, boss, seed });
      let spent = 0;
      while (spent < allowance) {
        const r = country.move(view, secret, country.lose(view, secret));
        assert.ok(!r.solved);
        spent += r.cost;
        const g = view.guesses.at(-1);
        assert.ok(g.km > 0 && g.dir && g.pct < 100 && g.pct >= 0);
      }
      assert.equal(view.guesses.length, 6);
    }
  });
  await test(`${label}: malformed, unknown and repeated guesses cost nothing`, () => {
    const { view, secret } = country.make({ level, boss, seed: 11 });
    country.move(view, secret, country.lose(view, secret));
    const before = structuredClone(view);
    const repeat = view.guesses[0].name;
    for (const m of [
      {},
      { guess: 3 },
      { guess: null },
      { guess: ['France'] },
      { guess: '' },
      { guess: 'Atlantis' },
      { guess: 'Fran' },
      { guess: repeat },
      { guess: repeat.toUpperCase() },
    ])
      assert.throws(() => country.move(view, secret, m));
    assert.throws(
      () => country.move(view, secret, { guess: 'Atlantis' }),
      /Unknown country!/,
    );
    assert.deepEqual(view, before);
    // Case-insensitive exact match is accepted.
    const other = COUNTRY_NAMES.find(
      (n) => n !== secret.answer && n !== repeat,
    );
    assert.equal(
      country.move(view, secret, { guess: other.toLowerCase() }).cost,
      1,
    );
    assert.equal(view.guesses.at(-1).name, other);
  });
}
