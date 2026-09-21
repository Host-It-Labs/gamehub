import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  standaloneGames,
  standaloneIds,
} from '../lib/games/standalone/registry.ts';
import {
  gameByLibraryId,
  libraryGames,
  placeholderGames,
  playableGame,
  shelves,
  standaloneLibraryGames,
} from '../lib/games/library-fixtures.ts';

const source = (path) =>
  readFile(new URL(`../${path}`, import.meta.url), 'utf8');

/** Plays a whole match with bots, whatever shape the game's turn order takes. */
const finish = (entry, g) => {
  let guard = 0;
  while (!g.over) {
    assert.ok(guard++ < 2000, `${entry.id} finishes`);
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
      assert.equal(fresh.kind, id);
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
  const saves = standaloneIds.map((id) =>
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
  for (const [i, id] of standaloneIds.entries())
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
  for (const id of standaloneIds) {
    const game = standaloneLibraryGames[id];
    assert.ok(game, `${id} has a library entry`);
    assert.equal(game.id, id);
    assert.equal(game.standaloneId, id);
    assert.equal(game.gameId, undefined, 'it does not run on the trio engine');
    assert.equal(game.name, standaloneGames[id].name);
    assert.ok(playableGame(id), `${id} opens from the library`);
    assert.equal(gameByLibraryId(id), game);
    assert.equal(
      placeholderGames.some((p) => p.id === id),
      false,
      `${id} is no longer standing in for itself`,
    );
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

await test('every shelf entry still resolves, including the promoted three', () => {
  for (const shelf of shelves)
    for (const id of shelf.games)
      assert.ok(
        gameByLibraryId(id),
        `${shelf.id} lists a game that exists: ${id}`,
      );
  const shelved = new Set(shelves.flatMap((s) => s.games));
  for (const id of standaloneIds)
    assert.ok(
      shelved.has(id),
      `${id} is on a shelf where somebody will find it`,
    );
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
  // Only retained trio and standalone games have playable covers.
  assert.match(box, /developed \? \(/);
  assert.match(box, /game\.gameId \?\? game\.standaloneId \?\? 'placeholder'/);
});
