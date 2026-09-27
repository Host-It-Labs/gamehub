import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dice } from '../lib/games/trio/engine.ts';
const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

await test('Mora die faces never name a board: shapes, capacities and occupancy only', () => {
  // Square and round pads are painted on every world; Big homes counts spaces, the rest read occupancy.
  assert.deepEqual(dice.map((face) => face.kind), ['zones', 'zones', 'zones', 'company', 'empty', 'new']);
  assert.deepEqual(dice.slice(0, 3).map((face) => face.zones), [[0, 1, 2], [3, 4, 6], [0, 1, 3, 4]]);
  for (const face of dice) assert.doesNotMatch(face.rule, /paving|timber|log|Courtyard|Garden|Glasshouse|Channel|Watchpost|Pools|Pier|Lighthouse/);
  assert.equal(dice[0].symbol, '□');
  // Die captions come from the engine; static faces engrave a map of square and round pads.
  const symbols = source('components/game/mora-symbols.tsx');
  assert.match(symbols, /moraDieLabels = dice\.map\(\(d\) => d\.name\)/);
  // Faces depict the restriction itself: square pad, round pad, three pads, occupied pad, empty pad, newcomer.
  for (const face of [0, 1, 2, 3, 4]) assert.match(symbols, new RegExp(`case ${face}:`));
  assert.match(symbols, /ink-dash/);
  assert.doesNotMatch(source('components/game/boards.tsx'), /MoraHabitatMarks|mora-relationship/);
});

await test('the board games never reserve an opponent column, and Advanced view is gone', () => {
  for (const path of ['components/game/solo.tsx', 'components/online/match.tsx']) {
    const text = source(path);
    assert.doesNotMatch(text, /with-opponents|fitBoardWidth=|<OpponentBoards/);
    assert.doesNotMatch(text, /advanced=\{|useAdvancedView|confirmMoves|useMoveConfirmation/);
  }
  const boards = source('components/game/boards.tsx');
  // Others opens every board in one inspection; player badges only preview.
  assert.match(boards, /<Dialog\s+open=\{boardSeat !== null\}/);
  assert.doesNotMatch(boards, /advanced/);
  const inspection = source('components/game/opponent-boards.tsx');
  assert.match(inspection, /length: g.players.length/);
  assert.match(inspection, /filter\(player => player !== viewer\)/);
  assert.match(inspection, /PlayerResources/);
  assert.match(inspection, /passing-loop/);
  // Mats are drawn like the viewer's own board: miniatures track the tall plate too.
  assert.doesNotMatch(boards, /if \(mini\) return;\s*const query = window\.matchMedia\(tallWorldQuery/);
  assert.match(boards, /mini-market/);
});

await test('leaving a saved game asks once, says it is saved, and never swaps its buttons', () => {
  const dialog = source('components/game/leave-dialog.tsx');
  // Leave comes first, Keep playing second, in every game.
  assert.ok(dialog.indexOf('className="leave-go"') < dialog.indexOf('className="leave-stay"'));
  assert.match(dialog, /className="leave-stay"[\s\S]*?Keep playing/);
  for (const path of ['components/game/solo.tsx', 'components/online/table.tsx', 'components/game/folio.tsx']) {
    const text = source(path);
    assert.match(text, /<LeaveDialog/);
    assert.match(text, /saved=/);
    assert.doesNotMatch(text, /SavingScreen|useSaveAndLeave/);
  }
});

await test('habitat headings keep their score together and inspection has a large close control', () => {
  const css = source('components/game/mora-refresh.css');
  assert.match(css, /\.mora-ground-label > strong \{ white-space: nowrap/);
  assert.match(css, /dialog-close'\] \{ width: 52px; height: 52px/);
});
