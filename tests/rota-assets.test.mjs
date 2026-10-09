import test from 'node:test';
import assert from 'node:assert/strict';
import { checkRotaModels } from '../scripts/rota-model-check.mjs';

await test('Rota compressed models preserve geometry, roots, wheel pivots and runtime attributes', async () => {
  const report = await checkRotaModels();
  const models = Object.values(report.models);
  const before = models.reduce((sum, model) => sum + model.beforeBytes, 0);
  const after = models.reduce((sum, model) => sum + model.afterBytes, 0);
  assert.ok(
    before / after >= 3,
    'at least 3x smaller without HTTP compression',
  );
  for (const model of models) {
    assert.equal(
      model.compressedViews,
      4,
      'four large streams instead of tiny per-primitive views',
    );
    assert.ok(model.maxPositionErrorMm < 1, 'sub-millimetre position accuracy');
    assert.ok(
      model.maxNormalErrorDegrees < 1.2,
      '8-bit octahedral normal accuracy',
    );
    assert.ok(
      model.maxSurfaceErrorMm < 2,
      'sub-pixel procedural UV accuracy at board scale',
    );
    assert.ok(
      model.maxColorError <= 0.5 / 255 + 1 / 65535,
      '8-bit AO accuracy',
    );
  }
});
