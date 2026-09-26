import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createResultsFeedback,
  scheduleResultsFeedback,
  viewerWon,
  winningSeats,
} from '../lib/games/results-feedback.ts';

await test('Nox celebrates lowest penalties, other games highest points, including ties', () => {
  assert.deepEqual(winningSeats([12, 4, 4], true), [1, 2]);
  assert.deepEqual(winningSeats([12, 4, 12]), [0, 2]);
  assert.equal(viewerWon(0, winningSeats([12, 4, 4], true)), false);
  assert.equal(viewerWon(2, winningSeats([12, 4, 4], true)), true);
  assert.deepEqual(winningSeats([]), []);
});

await test('party winners use actual seats; spectators and losing viewers never celebrate', () => {
  assert.equal(viewerWon(3, [1, 3]), true);
  assert.equal(viewerWon(0, [1, 3]), false);
  for (const spectator of [null, undefined, -1, NaN])
    assert.equal(viewerWon(spectator, [0]), false);
  assert.equal(viewerWon(0, []), false);
});

await test('only a visible final presentation sounds; unchanged polls, effect replay and reopening stay quiet', () => {
  const feedback = createResultsFeedback();
  assert.equal(feedback.update(false, true, 0.5), false); // Round result.
  assert.equal(feedback.update(true, false, 0.5), false); // Last capture still on board.
  assert.equal(feedback.update(true, true, 0.5), true); // Scores actually open.
  assert.equal(feedback.update(true, true, 0.5), false); // Poll / Strict Mode replay.
  assert.equal(feedback.update(true, false, 0.5), false);
  assert.equal(feedback.update(true, true, 0.9), false); // Reopen or change volume.
  assert.equal(feedback.update(false, false, 0.5), false); // Next match.
  assert.equal(feedback.update(true, true, 0.5), true);
});

await test('loading final scores announces once, while mute consumes the result without replay on unmute', () => {
  const loaded = createResultsFeedback();
  assert.equal(loaded.update(true, true, 0.5), true);
  assert.equal(loaded.update(true, true, 0.5), false);
  const muted = createResultsFeedback();
  assert.equal(muted.update(true, true, 0), false);
  assert.equal(muted.update(true, true, 0.5), false);
});

await test('a cancelled effect setup leaves the real final presentation eligible; unmount cancels pending audio', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const feedback = createResultsFeedback();
  let announcements = 0;
  const setup = () =>
    scheduleResultsFeedback(feedback, true, true, 0.5, () => announcements++);
  const probeCleanup = setup();
  probeCleanup();
  t.mock.timers.tick(0);
  assert.equal(announcements, 0);
  setup();
  t.mock.timers.tick(0);
  assert.equal(announcements, 1);
  setup();
  t.mock.timers.tick(0);
  assert.equal(announcements, 1);
  scheduleResultsFeedback(feedback, false, false, 0.5, () => announcements++);
  const unmount = setup();
  unmount();
  t.mock.timers.tick(0);
  assert.equal(announcements, 1);
});
