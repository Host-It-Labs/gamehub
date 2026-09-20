import test from 'node:test';
import assert from 'node:assert/strict';
import * as ranking from '../lib/games/party/ranking.ts';
import { standaloneGames } from '../lib/games/standalone/registry.ts';
import { facts } from '../lib/games/party/facts.ts';
import { readFileSync } from 'node:fs';
const fill = (g) => {
  for (let s = 0; s < g.seats.length; s++) {
    g = ranking.play(g, { type: 'topic', target: g.offers[s][0] }, s);
    if (g.kind === 'vela')
      g = ranking.play(
        g,
        { type: 'decoy', text: facts[g.ballots[s].topic].botDecoy },
        s,
      );
    g = ranking.play(g, { type: 'lock' }, s);
  }
  return g;
};
await test('Top Tier supports 2–6 individuals and only 4/6 in two teams', () => {
  for (const n of [2, 3, 4, 5, 6]) {
    const g = fill(ranking.createGame('orin', n, 77));
    assert.equal(g.phase, 'guess');
    assert.equal(g.scores.length, n);
    assert.deepEqual(
      ranking.guessingTeams(g),
      Array.from({ length: n - 1 }, (_, i) => i + 1),
    );
    assert.ok(standaloneGames.orin.isSavedGame(g));
    if (![4, 6].includes(n))
      assert.throws(() => ranking.createGame('orin', n, 77, 'medium', 'teams'));
  }
  for (const n of [4, 6]) {
    const g = fill(ranking.createGame('orin', n, 77, 'medium', 'teams'));
    assert.deepEqual(ranking.guessingTeams(g), [1]);
    assert.equal(g.teams.filter((t) => t === 0).length, n / 2);
    assert.equal(ranking.validMove(g, { type: 'lock' }, 2), false);
  }
});
await test('Individual drafts are private and reveal waits for every guess', () => {
  let g = fill(ranking.createGame('orin', 5, 33));
  g = ranking.play(g, { type: 'arrange', order: [4, 3, 2, 1, 0] }, 1);
  assert.deepEqual(ranking.observe(g, 2).guesses[1].order, []);
  assert.deepEqual(ranking.observe(g, -1).ballots[0].order, []);
  for (let s = 1; s < 4; s++) {
    g = ranking.play(g, { type: 'lock' }, s);
    assert.equal(g.phase, 'guess');
  }
  g = ranking.play(g, { type: 'lock' }, 4);
  assert.equal(g.phase, 'reveal');
  assert.equal(g.result.gains.length, 5);
});
await test('Outfox offers two factual lists, requires a distinct decoy, and shuffles presentation', () => {
  let g = ranking.createGame('vela', 4, 123);
  assert.ok(g.offers.every((o) => o.length === 2));
  g = ranking.play(g, { type: 'topic', target: g.offers[0][0] }, 0);
  assert.equal(ranking.validMove(g, { type: 'lock' }, 0), false);
  assert.equal(
    ranking.validMove(
      g,
      { type: 'decoy', text: facts[g.ballots[0].topic].answers[0] },
      0,
    ),
    false,
  );
  g = fill(g);
  const ballot = g.ballots[0],
    fact = facts[ballot.topic];
  assert.deepEqual(
    ballot.order.map((i) => ballot.answers[i]),
    [...fact.answers, fact.botDecoy],
  );
  const other = ranking.observe(g, 1);
  assert.equal(other.ballots[0].decoy, undefined);
  assert.equal(other.ballots[0].answers.length, 6);
  assert.deepEqual(other.ballots[0].order, []);
  assert.ok(standaloneGames.vela.isSavedGame(g));
});
await test('Every factual card matches preserved source observations with strict unambiguous order', () => {
  assert.ok(facts.length >= 200);
  assert.equal(new Set(facts.map((f) => f.key)).size, facts.length);
  const evidence = JSON.parse(
    readFileSync(
      new URL(
        '../scripts/data/outfox-worldbank-evidence.json',
        import.meta.url,
      ),
    ),
  );
  for (const fact of facts) {
    const data = evidence.indicators.find(
      (i) => i.indicator === fact.indicator,
    );
    assert.ok(data);
    assert.equal(fact.answers.length, 5);
    for (let i = 0; i < 5; i++)
      assert.equal(
        data.observations.find((o) => o.name === fact.answers[i]).value,
        fact.values[i],
      );
    for (let i = 1; i < 5; i++)
      assert.ok(
        fact.direction === 'descending'
          ? fact.values[i - 1] > fact.values[i]
          : fact.values[i - 1] < fact.values[i],
      );
    assert.ok(!fact.answers.includes(fact.botDecoy));
    assert.match(fact.source, /^https:\/\/data.worldbank.org\/indicator\//);
    assert.equal(fact.year, 2023);
  }
});
await test('Every supported ranking table finishes two rounds without deadlocks or invalid saves', () => {
  for (const kind of ['orin', 'vela'])
    for (const mode of ['individual', 'teams'])
      for (const n of mode === 'teams' ? [4, 6] : [2, 3, 4, 5, 6]) {
        let g = ranking.createGame(kind, n, 829, 'medium', mode);
        let steps = 0;
        while (!g.over && steps++ < 1000) {
          const actor = ranking.actingSeats(g)[0];
          assert.notEqual(actor, undefined);
          const move = ranking.botMove(ranking.observe(g, actor), actor);
          assert.ok(move);
          const next = ranking.play(g, move, actor);
          assert.notEqual(next, g);
          g = next;
          assert.ok(
            standaloneGames[kind].isSavedGame(g),
            `${kind}/${mode}/${n}/${g.phase}`,
          );
        }
        assert.ok(g.over, `${kind}/${mode}/${n} should finish`);
      }
});
