import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dice } from '../lib/games/trio/engine.ts';
const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

await test('Mora die faces never name a board: shapes, capacities and occupancy only', () => {
  // Square and round pads are painted on every world; Big homes counts spaces, the rest read occupancy.
  assert.deepEqual(dice.map((face) => face.kind), ['zones', 'zones', 'zones', 'company', 'empty', 'new']);
  assert.deepEqual(dice.slice(0, 3).map((face) => face.zones), [[0, 1, 2], [3, 4, 6], [0, 1, 3, 4]]);
  for (const face of dice) assert.doesNotMatch(face.rule, /paving|timber|log|Courtyard|Roof garden|Glasshouse|channel|Watchpost|Rock pools|Pier|Lighthouse/);
  assert.equal(dice[0].symbol, '□');
  // Die captions come from the engine; static faces engrave a map of square and round pads.
  const symbols = source('components/game/mora-symbols.tsx');
  assert.match(symbols, /moraDieLabels = dice\.map\(\(d\) => d\.name\)/);
  // Faces depict the restriction itself: square pad, round pad, three pads, occupied pad, empty pad, newcomer.
  for (const face of [0, 1, 2, 3, 4]) assert.match(symbols, new RegExp(`case ${face}:`));
  assert.match(symbols, /ink-dash/);
  assert.doesNotMatch(source('components/game/boards.tsx'), /MoraHabitatMarks|mora-relationship/);
});

await test('solo and online advanced view never reserve an opponent column', () => {
  for (const path of ['components/game/solo.tsx', 'components/online/match.tsx']) {
    const text = source(path);
    assert.doesNotMatch(text, /with-opponents|fitBoardWidth=\{advanced\}|<OpponentBoards/);
    assert.match(text, /advanced=\{advanced\}/);
  }
  const boards = source('components/game/boards.tsx');
  assert.match(boards, /<Dialog\s+open=\{boardSeat !== null\}/);
  assert.match(boards, /advanced && g.id !== 'undertow'\s*\? setBoardSeat\(i\)/);
  const inspection = source('components/game/opponent-boards.tsx');
  assert.match(inspection, /length: g.players.length/);
  assert.match(inspection, /filter\(player => player !== viewer\)/);
  assert.match(inspection, /PlayerResources/);
  assert.match(inspection, /table-passing-order/);
});

await test('habitat headings keep their score together and inspection has a large close control', () => {
  const css = source('components/game/mora-refresh.css');
  assert.match(css, /\.mora-ground-label > strong \{ white-space: nowrap/);
  assert.match(css, /dialog-close'\] \{ width: 52px; height: 52px/);
});
