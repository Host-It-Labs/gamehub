import test from 'node:test';
import assert from 'node:assert/strict';
import { illustratedBoardScale } from '../lib/games/viewport.ts';

for (const boardWidth of [660, 540]) {
  test(`portrait ${boardWidth}px board fills the available height on phone and tablet`, () => {
    for (const [width, height] of [
      [360, 430],
      [720, 700],
    ]) {
      const scale = illustratedBoardScale(boardWidth, width, height, true);
      const renderedWidth = boardWidth * scale;
      const renderedHeight = ((boardWidth * 2) / 3) * scale;
      assert.ok(Math.abs(renderedHeight - (height - 16)) < 0.001);
      assert.ok(
        renderedWidth > width,
        'the board stays tall and can pan horizontally',
      );
      assert.ok(
        renderedHeight < height,
        'the board does not require vertical panning',
      );
    }
  });
  test(`landscape ${boardWidth}px board fits without clipping`, () => {
    for (const [width, height] of [
      [980, 440],
      [650, 160],
      [1200, 900],
    ]) {
      const scale = illustratedBoardScale(boardWidth, width, height, false);
      assert.ok(boardWidth * scale <= width);
      assert.ok(((boardWidth * 2) / 3) * scale <= height);
    }
  });
}
test('a temporarily collapsed viewport does not invert or hide the board', () => {
  assert.ok(illustratedBoardScale(660, 0, 0, true) > 0);
  assert.ok(illustratedBoardScale(660, 0, 0, false) > 0);
});
