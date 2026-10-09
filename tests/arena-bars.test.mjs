import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const filename = 'arena-game.tsx';
const source = readFileSync(
  new URL('../components/game/arena/arena-game.tsx', import.meta.url),
  'utf8',
);
const tree = ts.createSourceFile(
  filename,
  source,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);
let drawBars;
let newRound;
function visit(node) {
  if (
    ts.isVariableDeclaration(node) &&
    ts.isIdentifier(node.name) &&
    node.name.text === 'drawBars'
  )
    drawBars = node.initializer;
  if (
    ts.isIfStatement(node) &&
    node.expression.getText(tree) === 'session.round !== shownRound'
  )
    newRound = node;
  ts.forEachChild(node, visit);
}
visit(tree);
assert.ok(drawBars, 'extract the actual bar drawing function');
assert.ok(newRound, 'extract the actual new-round cleanup branch');

function fixture() {
  const layer = {
    children: [],
    appendChild(el) {
      this.children.push(el);
      el.parentNode = this;
    },
  };
  const bars = new Map();
  const context = {
    bars,
    barsLayer: { current: layer },
    marks: [],
    barFloor: 0,
    document: {
      createElement() {
        return {
          dataset: {},
          style: {
            values: {},
            setProperty(name, value) {
              this.values[name] = value;
            },
          },
          querySelector(selector) {
            return selector === 'b' && this.innerHTML.includes('<b>')
              ? (this.label ??= { textContent: '' })
              : null;
          },
          remove() {
            const at = this.parentNode?.children.indexOf(this) ?? -1;
            if (at !== -1) this.parentNode.children.splice(at, 1);
            this.parentNode = null;
          },
        };
      },
    },
    session: { round: 1, pending: () => [] },
    shownRound: 1,
    shownMatch: null,
    m: {},
    v: { start() {}, reconcile() {} },
    resultsAt: 0,
    setShowResults() {},
    setSelected() {},
  };
  // Execute production behavior with only the DOM/projection boundary stubbed.
  // A later-round snapshot can replace a match before an empty frame is drawn.
  vm.createContext(context);
  vm.runInContext(
    ts.transpileModule(
      `globalThis.draw = ${drawBars.getText(tree)};\n` +
        `globalThis.changeRound = () => { ${newRound.getText(tree)} };`,
      { compilerOptions: { target: ts.ScriptTarget.ES2022 } },
    ).outputText,
    context,
  );
  return { layer, bars, context, draw: context.draw };
}

const troop = (extra = {}) => ({
  id: 7,
  kind: 'troop',
  team: 0,
  x: 100,
  y: 100,
  hp: 850,
  max: 850,
  visible: true,
  ...extra,
});

await test('a reused troop ID updates its shield track without an empty frame', () => {
  const { draw, bars, layer } = fixture();
  draw([troop()]);
  const el = bars.get(7).el;
  assert.equal(el.dataset.shielded, 'false');

  draw([troop({ shield: 1 })]);
  assert.equal(bars.get(7).el, el, 'reuse the existing element');
  assert.equal(el.dataset.shielded, 'true', 'show the new shield capacity');
  assert.equal(el.style.values['--shield'], '1');

  draw([troop({ shield: 0 })]);
  assert.equal(el.dataset.shielded, 'true', 'keep the depleted recharge track');
  assert.equal(el.style.values['--shield'], '0');

  draw([troop()]);
  assert.equal(el.dataset.shielded, 'false', 'hide it for a plain troop');
  assert.equal(layer.children.length, 1);
});

await test('a new round clears cached bars before reused IDs change teams', () => {
  const { draw, bars, layer, context } = fixture();
  draw([
    troop({ shield: 0.6 }),
    troop({ id: 1, kind: 'king', hp: 1000, max: 1000 }),
  ]);
  const oldTroop = bars.get(7).el;
  assert.equal(bars.size, 2);

  context.session.round = 2;
  context.changeRound();
  assert.equal(bars.size, 0, 'discard IDs from the previous battle');
  assert.equal(layer.children.length, 0, 'remove their old DOM elements');

  draw([troop({ team: 1 }), troop({ id: 1, kind: 'king', team: 1 })]);
  const newTroop = bars.get(7).el;
  assert.notEqual(newTroop, oldTroop);
  assert.equal(newTroop.className, 'arena-bar troop team-1');
  assert.equal(newTroop.dataset.shielded, 'false');
  assert.equal(bars.get(1).el.className, 'arena-bar king team-1');
});
