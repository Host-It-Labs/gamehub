import test from 'node:test';
import assert from 'node:assert/strict';
import { SaleFx } from '../components/game/relic-factory/fx.ts';

/** DOM/Animation doubles: exercise real payout and cancellation behaviour. */
function stage() {
  const motions = [];
  const animation = (frames) => {
    const anim = { frames, cancelled: false, onfinish: null, oncancel: null };
    anim.cancel = () => {
      anim.cancelled = true;
      anim.oncancel?.();
    };
    motions.push(anim);
    return anim;
  };
  const purse = {
    animations: [],
    getBoundingClientRect: () => ({
      left: 600,
      top: 10,
      width: 180,
      height: 50,
    }),
  };
  purse.animate = (frames) => {
    purse.animations.push(frames);
    return animation(frames);
  };
  const layer = {
    children: [],
    getBoundingClientRect: () => ({
      left: 200,
      top: 100,
      width: 400,
      height: 300,
    }),
    append(el) {
      this.children.push(el);
    },
    replaceChildren() {
      this.children = [];
    },
  };
  layer.ownerDocument = {
    querySelector: () => purse,
    createElement: () => ({
      className: '',
      textContent: '',
      remove() {
        layer.children = layer.children.filter((el) => el !== this);
      },
      animate: animation,
    }),
  };
  return { layer, purse, motions };
}

await test('sales outside the zoomed canvas do not produce escaping page effects', (t) => {
  t.mock.method(performance, 'now', () => 1000);
  const { layer } = stage();
  const fx = new SaleFx(layer, false);
  for (const [x, y] of [
    [199, 200],
    [300, 99],
    [601, 200],
    [300, 401],
  ])
    fx.sale('offscreen', x, y, 42);
  assert.equal(layer.children.length, 0);
  fx.sale('visible', 350, 250, 42);
  assert.equal(layer.children.length, 1, 'a visible sale shows its amount');
  assert.equal(layer.children[0].className, 'rs-sale-label');
  fx.dispose();
});

await test('sales show only the amount over the till: no coin flies to the purse', (t) => {
  let now = 1000;
  t.mock.method(performance, 'now', () => now);
  const { layer, purse, motions } = stage();
  const fx = new SaleFx(layer, false);
  for (let i = 0; i < 8; i++) fx.sale(`till-${i}`, 350, 250, 42);
  assert.ok(layer.children.every((el) => el.className === 'rs-sale-label'));
  assert.equal(layer.children.length, 8);
  // Close sales on one till share its label.
  fx.sale('till-0', 350, 250, 8);
  assert.equal(layer.children.length, 8);
  assert.equal(layer.children[0].textContent, '+50');
  fx.clear();
  assert.equal(layer.children.length, 0);
  assert.ok(motions.every((motion) => motion.cancelled));
  assert.equal(purse.animations.length, 0, 'the wallet never bumps');
  now += 1000;
  fx.sale('till-0', 350, 250, 42);
  assert.equal(layer.children.length, 1);
  fx.dispose();
  assert.equal(layer.children.length, 0);
});

await test('reduced motion retains the payout label', (t) => {
  t.mock.method(performance, 'now', () => 1000);
  const { layer, purse } = stage();
  const fx = new SaleFx(layer, true);
  fx.sale('till', 350, 250, 42);
  assert.equal(layer.children.length, 1);
  assert.equal(layer.children[0].className, 'rs-sale-label');
  assert.equal(purse.animations.length, 0);
  fx.dispose();
  assert.equal(layer.children.length, 0);
});
