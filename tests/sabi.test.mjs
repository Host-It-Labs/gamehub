import test from 'node:test';
import assert from 'node:assert/strict';
import {
  standaloneGames,
  play,
  botMove,
} from '../lib/games/standalone/registry.ts';
import * as geo from '../lib/games/party/geography.ts';
import { seatTotals } from '../lib/games/party/tribu.ts';
import { skipOpening } from './tribu-helpers.mjs';

const entry = standaloneGames.miro;
/** Plays bots through one round until its vote opens. */
function toVote(g) {
  for (let i = 0; i < 400 && g.phase !== 'vote' && !g.over; i++) {
    if (g.phase === 'reveal') g = play(g, { type: 'next' }, 0, 1000);
    else {
      const s = entry.actingSeats(g)[0];
      g = play(g, botMove(g, s), s, 1000);
    }
  }
  return g;
}
function voteAll(g, choice) {
  for (let s = 0; s < g.seats.length; s++)
    g = play(g, { type: 'vote', choice }, s, 1000);
  return g;
}

await test('Sabi opens with a vote between Atlas and Sizes', () => {
  const g = entry.create(3, 5, 'medium');
  assert.equal(entry.name, 'Quiz');
  assert.equal(standaloneGames.size.name, 'Quiz');
  assert.equal(g.kind, 'miro');
  assert.equal(g.phase, 'vote');
  assert.deepEqual(g.vote.options, ['miro', 'size']);
  assert.ok(g.vote.opening);
  assert.ok(entry.isSavedGame(JSON.parse(JSON.stringify(g))));
  assert.equal(skipOpening(g, 'miro').phase, 'guess');
  const sizes = skipOpening(g, 'size');
  assert.equal(sizes.kind, 'size');
  assert.equal(sizes.round, 1);
  assert.deepEqual(
    sizes.questions.map((q) => q.kind),
    ['thing', 'thing', 'country'],
  );
  assert.ok(entry.isSavedGame(sizes), 'the Sabi box recognises its Sizes save');
});

await test('switching carries every player’s points both ways', () => {
  let g = skipOpening(entry.create(3, 8, 'medium'), 'miro');
  g = toVote(g);
  assert.deepEqual(g.vote.options, ['miro', 'size', 'finish']);
  const atlas = seatTotals(g);
  g = voteAll(g, 'size');
  assert.equal(g.kind, 'size');
  assert.equal(g.round, 2);
  assert.deepEqual(seatTotals(g), atlas);
  g = toVote(g);
  const both = seatTotals(g);
  g = voteAll(g, 'miro');
  assert.equal(g.kind, 'miro');
  assert.equal(g.round, 3);
  assert.equal(g.start, 3, 'Atlas deals from the top of its deck');
  assert.equal(geo.placeRound(g), 1);
  assert.deepEqual(g.cityIds, g.deck.slice(0, 3));
  assert.deepEqual(seatTotals(g), both);
  assert.ok(entry.isSavedGame(JSON.parse(JSON.stringify(g))));
  g = toVote(g);
  g = voteAll(g, 'finish');
  assert.ok(g.over);
  const result = entry.outcome(g);
  assert.equal(result.rows.length, 3);
});

await test('Atlas holds enough places for a whole match', () => {
  const g = skipOpening(entry.create(2, 13, 'medium'), 'miro');
  assert.ok(geo.maxRounds(g) >= 12);
});

