import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

const root = new URL('../', import.meta.url).href;
// The game code imports without extensions and through `@/`; resolve both.
register(
  `data:text/javascript,${encodeURIComponent(`
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = ${JSON.stringify(root)};
export async function resolve(spec, ctx, next) {
  let base = null;
  if (spec.startsWith('@/')) base = fileURLToPath(root + spec.slice(2));
  else if (/^\\.\\.?\\//.test(spec) && ctx.parentURL?.startsWith('file:') && !/\\.[cm]?[jt]sx?$/.test(spec))
    base = fileURLToPath(new URL(spec, ctx.parentURL));
  if (base)
    for (const ext of ['.ts', '.tsx'])
      if (existsSync(base + ext)) return next(pathToFileURL(base + ext).href, ctx);
  return next(spec, ctx);
}`)}`,
);

const THREE = await import('three');
const { buildShip } = await import('../components/game/alto/alto-ship.ts');
const { shipPreviewFrame } =
  await import('../components/game/alto/alto-framing.ts');
const { plans } = await import('../lib/games/alto/content.ts');
const turn = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.25, -1, 0));

void test('base modules and their previews never shrink or shift a ship preview', () => {
  const baseIds = plans.filter((p) => p.family === 'base').map((p) => p.id);
  const shipIds = plans.filter((p) => p.family === 'ship').map((p) => p.id);
  for (const kit of [[], shipIds.slice(0, 4), shipIds]) {
    const ship = buildShip('#e0584c');
    ship.setKit(kit);
    ship.setLanded(1);
    ship.update(2, 0.016);
    const expected = shipPreviewFrame(ship.group, turn);
    assert.ok(Number.isFinite(expected.span) && expected.span > 1);
    for (const id of baseIds) {
      ship.setKit([...kit, id], id);
      const frame = shipPreviewFrame(ship.group, turn);
      assert.equal(
        frame.span,
        expected.span,
        `ship frame with base module ${id}`,
      );
      assert.ok(
        frame.centre.equals(expected.centre),
        `ship centre with base module ${id}`,
      );
    }
    ship.setKit([...kit, ...baseIds]);
    assert.equal(shipPreviewFrame(ship.group, turn).span, expected.span);
    ship.dispose();
  }
});

void test('measuring a preview preserves a flying ship transform and visibility', () => {
  const ship = buildShip('#e0584c');
  ship.setKit(['rigging', 'windmill']);
  ship.update(2, 0.016);
  ship.group.position.set(17, 29, 11);
  ship.group.quaternion.setFromEuler(new THREE.Euler(0.7, -0.6, 0.2));
  ship.group.scale.setScalar(13);
  ship.group.visible = false;
  const before = {
    p: ship.group.position.clone(),
    q: ship.group.quaternion.clone(),
    s: ship.group.scale.clone(),
  };
  const frame = shipPreviewFrame(ship.group, turn);
  assert.ok(Number.isFinite(frame.span) && frame.span > 1);
  assert.ok(ship.group.position.equals(before.p));
  assert.ok(ship.group.quaternion.equals(before.q));
  assert.ok(ship.group.scale.equals(before.s));
  assert.equal(ship.group.visible, false);
  ship.dispose();
});
