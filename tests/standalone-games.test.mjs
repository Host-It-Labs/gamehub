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
} from '../lib/games/library-fixtures.ts';

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
        id === 'dial' ? 'orin' : id === 'size' ? 'miro' : id,
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

await test('the library shows only games that play, each in exactly one section', () => {
  for (const game of libraryGames)
    assert.ok(playableGame(game.id), `${game.id} opens and plays`);
  const listed = librarySections.flatMap((s) => s.games);
  for (const id of listed)
    assert.ok(gameByLibraryId(id), `a section lists a game that exists: ${id}`);
  assert.equal(
    new Set(listed).size,
    listed.length,
    'no game is in two sections',
  );
  for (const game of libraryGames)
    assert.ok(
      listed.includes(game.id),
      `${game.id} is in a section where somebody will find it`,
    );
  for (const id of publicStandaloneIds)
    assert.ok(listed.includes(id), `${id} is on the library page`);
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
