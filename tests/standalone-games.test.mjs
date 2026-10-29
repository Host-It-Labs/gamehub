import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  standaloneGames,
  standaloneIds,
  publicStandaloneIds,
} from '../lib/games/standalone/registry.ts';
import {
  gameByLibraryId,
  librarySections,
  libraryGames,
  playableGame,
  standaloneLibraryGames,
  tableSections,
  showcaseGames,
} from '../lib/games/library-fixtures.ts';
import { isHumanOnlyGame } from '../lib/games/player-policy.ts';

const source = (path) =>
  readFile(new URL(`../${path}`, import.meta.url), 'utf8');

/** Plays a whole match with bots, whatever shape the game's turn order takes. */
const finish = (entry, g) => {
  let guard = 0;
  while (!g.over) {
    assert.ok(guard++ < 2000, `${entry.id} finishes`);
    // Reveals wait on the table host rather than on a seat; seat 0 hosts here.
    if (g.phase === 'reveal') {
      g = entry.play(g, { type: 'next' }, 0);
      continue;
    }
    // Unless the table votes, the host (seat 0) picks what comes next.
    if (g.phase === 'vote' && g.vote?.host) {
      g = entry.play(
        g,
        {
          type: 'vote',
          choice: g.vote.opening
            ? g.vote.options[g.seats.length % g.vote.options.length]
            : g.round >= 2
              ? 'finish'
              : (g.vote.options ?? []).includes(g.kind)
                ? g.kind
                : 'more',
        },
        0,
      );
      continue;
    }
    const waiting = entry.actingSeats(g);
    assert.ok(waiting.length, `${entry.id} is always waiting on somebody`);
    for (const seat of waiting) {
      if (g.over) break;
      const move = entry.botMove(g, seat);
      if (move) g = entry.play(g, move, seat);
    }
  }
  return g;
};

await test('every standalone game plays through at every table size it offers', () => {
  for (const id of standaloneIds) {
    const entry = standaloneGames[id];
    assert.equal(entry.id, id, 'an entry knows its own id');
    assert.ok(entry.seatChoices.length, `${id} offers a table size`);
    assert.ok(
      entry.seatChoices.includes(entry.defaultSeats),
      `${id} defaults to a size it offers`,
    );
    for (const seats of entry.seatChoices) {
      const fresh = entry.create(seats, seats * 31 + 7, 'medium');
      // Every set match, under either id, opens on its team game's state.
      assert.equal(
        fresh.kind,
        ['dial', 'coins'].includes(id)
          ? 'orin'
          : ['size', 'year', 'order'].includes(id)
            ? 'miro'
            : id,
      );
      assert.equal(
        fresh.seats.length,
        seats,
        `${id} seats exactly the ${seats} it was asked for`,
      );
      assert.equal(fresh.over, false);
      assert.equal(fresh.revision, 0);
      assert.ok(entry.progress(fresh).label);
      const done = finish(entry, fresh);
      assert.equal(entry.actingSeats(done).length, 0);
      const result = entry.outcome(done);
      assert.ok(result.title && result.detail, `${id} says how it ended`);
      assert.ok(
        result.winners.every((s) => s >= 0 && s < seats),
        `${id} only crowns seats at the table`,
      );
    }
  }
});

await test('a saved match is recognised only by the game that wrote it', () => {
  const saves = publicStandaloneIds.map((id) =>
    JSON.parse(
      JSON.stringify(
        standaloneGames[id].create(
          standaloneGames[id].defaultSeats,
          99,
          'medium',
        ),
      ),
    ),
  );
  for (const [i, id] of publicStandaloneIds.entries())
    for (const [j, save] of saves.entries())
      assert.equal(
        standaloneGames[id].isSavedGame(save),
        i === j,
        `${id} accepts only its own saves`,
      );
  for (const id of standaloneIds) {
    assert.equal(standaloneGames[id].isSavedGame(null), false);
    assert.equal(standaloneGames[id].isSavedGame({}), false);
    assert.equal(standaloneGames[id].isSavedGame('miro'), false);
  }
});

await test('the library shelves them as playable games, not as placeholders', () => {
  // Old Dial tables open Tribu's box; Dial has no shelf entry of its own.
  assert.equal(standaloneLibraryGames.dial, standaloneLibraryGames.orin);
  assert.equal(gameByLibraryId('dial'), undefined);
  for (const id of publicStandaloneIds) {
    const game = standaloneLibraryGames[id];
    assert.ok(game, `${id} has a library entry`);
    assert.equal(game.id, id);
    assert.equal(game.standaloneId, id);
    assert.equal(game.gameId, undefined, 'it does not run on the trio engine');
    assert.equal(game.name, standaloneGames[id].name);
    assert.ok(playableGame(id), `${id} opens from the library`);
    assert.equal(gameByLibraryId(id), game);
    // The setup box offers the seats the rules support, so the two must agree.
    const [min, max] = game.players;
    const choices = standaloneGames[id].seatChoices;
    assert.equal(
      min,
      Math.min(...choices),
      `${id} advertises its smallest table`,
    );
    assert.equal(
      max,
      Math.max(...choices),
      `${id} advertises its largest table`,
    );
  }
  assert.equal(
    new Set(libraryGames.map((g) => g.id)).size,
    libraryGames.length,
    'no game is on the shelf twice',
  );
});

await test('the library shows only games that play, each on one shelf unless it has a long mode', () => {
  for (const game of libraryGames)
    assert.ok(playableGame(game.id), `${game.id} opens and plays`);
  const listed = librarySections.flatMap((s) => s.games);
  for (const id of listed)
    assert.ok(gameByLibraryId(id), `a section lists a game that exists: ${id}`);
  for (const id of new Set(listed)) {
    const shelves = listed.filter((other) => other === id).length;
    assert.equal(
      shelves,
      gameByLibraryId(id).longMode ? 2 : 1,
      `${id} is on ${shelves} shelves`,
    );
  }
  for (const game of libraryGames)
    assert.ok(
      listed.includes(game.id),
      `${game.id} is in a section where somebody will find it`,
    );
  for (const id of publicStandaloneIds)
    assert.ok(listed.includes(id), `${id} is on the library page`);
});

await test('quick games lead the landing page; party games lead a table', () => {
  assert.deepEqual(
    librarySections.map((s) => s.id),
    ['quick', 'long', 'friends'],
  );
  assert.deepEqual(
    tableSections.map((s) => s.id),
    ['party', 'games'],
  );
  const table = tableSections.flatMap((s) => s.games);
  assert.equal(
    new Set(table).size,
    table.length,
    'a table lists each game once',
  );
  assert.deepEqual(
    [...table].sort(),
    [...new Set(librarySections.flatMap((s) => s.games))].sort(),
    'a table offers the same games as the landing page',
  );
  const shelf = (id) => librarySections.find((s) => s.id === id).games;
  for (const id of shelf('friends'))
    assert.ok(
      isHumanOnlyGame(id),
      `${id} needs people, so it waits for friends`,
    );
  for (const id of [...shelf('quick'), ...shelf('long')])
    assert.ok(!isHumanOnlyGame(id), `${id} starts on your own`);
  assert.ok(
    shelf('quick').includes('arena') && shelf('long').includes('arena'),
    'Arena is quick to play and has its Quest',
  );
  for (const id of ['relic', 'folio'])
    assert.ok(shelf('long').includes(id), `${id} is one to settle into`);
});

await test('the showcase can turn through every game', () => {
  assert.deepEqual(
    [...showcaseGames].sort(),
    libraryGames.map((g) => g.id).sort(),
  );
});

await test('every game shows one short kind, never its crowd or theme', () => {
  for (const game of libraryGames) {
    assert.equal(typeof game.kind, 'string', `${game.id} has a kind`);
    // One badge of a word or two that fits a phone shelf tile beside the
    // time.
    assert.ok(
      game.kind.length > 0 &&
        game.kind.length <= 14 &&
        game.kind.split(' ').filter((w) => w !== '&').length <= 2,
      `${game.id}'s kind "${game.kind}" is short`,
    );
    assert.ok(!/party|space/i.test(game.kind), `${game.id}'s kind is the play`);
  }
});

await test('every box shows its match length on the time badge', () => {
  const length = Object.fromEntries(
    libraryGames.map((g) => [g.id, g.duration]),
  );
  assert.deepEqual(length, {
    undertow: '5–10 min',
    wildgrove: '5–10 min',
    midnight: '5 min',
    orin: '5–60 min+',
    miro: '5–60 min+',
    folio: '5–60 min+',
    relic: '60 min+',
    arena: '5 min',
    rota: '10–20 min',
    metro: '10–20 min',
    alto: '20–35 min',
    diner: '2–3 min / shift',
    impostor: '10–40 min',
  });
  for (const game of libraryGames) {
    assert.doesNotMatch(game.duration, /\bh\b/, `${game.id} counts minutes`);
    assert.ok(game.durationSpoken, `${game.id} reads its length aloud`);
  }
});

await test('the shelf and the table agree about which games open', async () => {
  const solo = await source('components/game/solo.tsx');
  assert.match(
    solo,
    /onStandalone=\{openOwnSetup\}/,
    'the library can open them',
  );
  assert.match(solo, /StandaloneTable/, 'and the table renders them');
  assert.match(
    solo,
    /OWN_SAVE = 'gamehub\.standalone\.v1'/,
    'their saves live under their own key',
  );
  const box = await source('components/game/game-box.tsx');
  // Any box with printed art shows it, including Folio and Relic, which have no engine id.
  assert.match(box, /cover \? \(/);
  assert.match(
    box,
    /game\.cover \?\? \(developed && printedBoxArt\(developed\)\.cover\)/,
  );
  assert.match(box, /game\.gameId \?\? game\.standaloneId \?\? 'placeholder'/);
});
