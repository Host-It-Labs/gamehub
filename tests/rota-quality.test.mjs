import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AdaptiveQuality,
  qualityLevels,
  renderDensity,
  renderSamples,
} from '../lib/games/rota/quality.ts';

/** Feed real frame intervals, retaining every observable tier change. */
function run(quality, frameMs, seconds) {
  const changes = [];
  const count = Math.floor((seconds * 1000) / frameMs);
  for (let i = 0; i < count; i++) {
    const next = quality.sample(frameMs);
    if (next) changes.push(next);
  }
  return changes;
}

function reach(quality, tier, frameMs) {
  for (let i = 1; i <= 2000; i++) {
    const next = quality.sample(frameMs);
    if (next === tier) return (i * frameMs) / 1000;
  }
  assert.fail(`did not reach ${tier} with ${frameMs} ms frames`);
}

await test('Rota starts with full detail and sharp rendering on high-DPR phones', () => {
  const quality = new AdaptiveQuality();
  assert.equal(quality.tier, 'high');
  assert.equal(qualityLevels[quality.tier].detail, 1);
  assert.equal(renderDensity(quality.tier, 3, 390, 844), 3);
  assert.equal(renderDensity(quality.tier, 4, 390, 844), 3);
  assert.equal(renderDensity(quality.tier, 2, 1440, 900), 2);
});

await test('actual drawing buffers respect tier pixel budgets across screen sizes', () => {
  const screens = [
    [320, 568],
    [390, 844],
    [820, 1180],
    [1440, 900],
    [2560, 1440],
    [3840, 2160],
    [1365.5, 767.75],
  ];
  for (const [tier, limits] of Object.entries(qualityLevels))
    for (const [width, height] of screens)
      for (const dpr of [1, 1.25, 1.5, 2, 3, 4]) {
        const density = renderDensity(tier, dpr, width, height);
        const pixels =
          Math.floor(width * density) * Math.floor(height * density);
        const context = `${tier}, ${width}×${height}, DPR ${dpr}`;
        assert.ok(Number.isFinite(density), context);
        assert.ok(density >= 1, context);
        assert.ok(density <= Math.min(dpr, limits.density), context);
        // One pixel per CSS pixel takes precedence on very large screens.
        assert.ok(pixels <= Math.max(limits.pixels, width * height), context);
      }
});

await test('large screens and unusual DPR values retain at least one pixel per CSS pixel', () => {
  for (const tier of Object.keys(qualityLevels)) {
    assert.equal(renderDensity(tier, 3, 7680, 4320), 1);
    for (const dpr of [0, 0.5, -1, NaN])
      assert.equal(renderDensity(tier, dpr, 390, 844), 1);
    assert.ok(Number.isFinite(renderDensity(tier, 3, 0, 0)));
  }
});

await test('dense displays avoid extra MSAA allocations at every tier', () => {
  for (const tier of Object.keys(qualityLevels))
    for (const dpr of [1.75, 1.8, 2, 3, 4])
      for (const supported of [0, 1, 2, 4, 8])
        assert.equal(renderSamples(tier, dpr, supported), 0);
});

await test('lower-DPR displays keep tier-appropriate AA within hardware support', () => {
  for (const dpr of [1, 1.25, 1.5, 1.749]) {
    assert.equal(renderSamples('high', dpr, 8), 4);
    assert.equal(renderSamples('balanced', dpr, 8), 2);
    assert.equal(renderSamples('low', dpr, 8), 0);
    for (const supported of [0, 1, 2]) {
      assert.equal(renderSamples('high', dpr, supported), supported);
      assert.equal(renderSamples('balanced', dpr, supported), supported);
      assert.equal(renderSamples('low', dpr, supported), 0);
    }
  }
  assert.equal(renderSamples('high', 1.75 - Number.EPSILON, 4), 4);
  assert.equal(renderSamples('high', 1.75, 4), 0);
});

await test('retina phone AA policy preserves the full canvas density and surface detail', () => {
  for (const dpr of [2, 3, 4]) {
    const quality = new AdaptiveQuality();
    const density = renderDensity(quality.tier, dpr, 390, 844);
    assert.equal(renderSamples(quality.tier, dpr, 4), 0);
    assert.equal(density, Math.min(dpr, 3));
    assert.equal(quality.tier, 'high');
    assert.equal(qualityLevels[quality.tier].detail, 1);
  }
});

await test('budget-limited retina canvases keep AA disabled despite lower rendering density', () => {
  const capped = renderDensity('high', 3, 2560, 1440);
  assert.ok(capped >= 1 && capped < 1.75);
  assert.equal(renderSamples('high', 3, 4), 0);
  assert.equal(renderSamples('high', 3, 2), 0);
  // A downshift crosses the canvas threshold; display DPR stays the same.
  const high = renderDensity('high', 1.8, 1000, 1000);
  const balanced = renderDensity('balanced', 1.8, 1000, 1000);
  assert.ok(high >= 1.75 && balanced < 1.75);
  for (const tier of Object.keys(qualityLevels))
    assert.equal(renderSamples(tier, 1.8, 4), 0);
});

await test('AA sample work never increases as a client lowers its quality tier', () => {
  const tiers = Object.keys(qualityLevels);
  for (const dpr of [1, 1.25, 1.5, 1.749, 1.75, 1.8, 2, 3, 4])
    for (const supported of [0, 1, 2, 4, 8])
      for (const [width, height] of [
        [390, 844],
        [1000, 1000],
        [1440, 900],
        [2560, 1440],
      ]) {
        let previousSamples = Infinity;
        let previousWork = Infinity;
        for (const tier of tiers) {
          const samples = renderSamples(tier, dpr, supported);
          const density = renderDensity(tier, dpr, width, height);
          const pixels =
            Math.floor(width * density) * Math.floor(height * density);
          const work = pixels * Math.max(1, samples);
          const context = `${tier}, ${width}×${height}, DPR ${dpr}, support ${supported}`;
          assert.ok(samples <= previousSamples, context);
          assert.ok(work <= previousWork, context);
          previousSamples = samples;
          previousWork = work;
        }
      }
});

await test('each lower tier reduces every rendering budget and fine surface detail', () => {
  const levels = Object.values(qualityLevels);
  for (let i = 1; i < levels.length; i++)
    for (const budget of ['density', 'pixels', 'shadow', 'samples', 'detail'])
      assert.ok(levels[i][budget] < levels[i - 1][budget], budget);
  assert.equal(levels.at(-1).samples, 0);
  for (const [width, height] of [
    [390, 844],
    [1440, 900],
    [2560, 1440],
  ]) {
    const densities = Object.keys(qualityLevels).map((tier) =>
      renderDensity(tier, 3, width, height),
    );
    assert.ok(densities[0] >= densities[1] && densities[1] >= densities[2]);
  }
});

await test('loading and a brief slow burst do not lower startup quality', () => {
  const quality = new AdaptiveQuality();
  assert.deepEqual(run(quality, 120, 2.8), []);
  assert.equal(quality.tier, 'high');
  assert.deepEqual(run(quality, 16, 3), []);
  assert.deepEqual(run(quality, 40, 1.5), []);
  assert.deepEqual(run(quality, 16, 3), []);
  assert.equal(quality.tier, 'high');
});

await test('sustained slow frames lower one tier at a time with a fresh grace period', () => {
  const quality = new AdaptiveQuality();
  reach(quality, 'balanced', 40);
  assert.equal(quality.tier, 'balanced');
  assert.deepEqual(run(quality, 40, 2.8), []);
  assert.equal(quality.tier, 'balanced');
  assert.deepEqual(run(quality, 40, 3), ['low']);
  assert.deepEqual(run(quality, 40, 30), []);
  assert.equal(quality.tier, 'low');
});

await test('downgrade timing follows elapsed time rather than a fixed frame count', () => {
  for (const frameMs of [30, 50, 100]) {
    const elapsed = reach(new AdaptiveQuality(), 'balanced', frameMs);
    assert.ok(elapsed >= 5.5 && elapsed <= 5.9, `${frameMs} ms: ${elapsed} s`);
  }
});

await test('even a consistently two-FPS client eventually lowers rendering cost', () => {
  for (const frameMs of [300, 500, 1500]) {
    const quality = new AdaptiveQuality();
    const first = reach(quality, 'balanced', frameMs);
    const second = reach(quality, 'low', frameMs);
    assert.ok(
      first < 90 && second < 90,
      `${frameMs} ms adaptation took too long`,
    );
    assert.equal(quality.tier, 'low');
  }
});

await test('isolated frame spikes and a long pause do not force a downgrade', () => {
  const quality = new AdaptiveQuality();
  run(quality, 16, 4);
  for (let i = 0; i < 120; i++) {
    assert.equal(quality.sample(140), null);
    assert.deepEqual(run(quality, 16, 0.25), []);
  }
  assert.equal(quality.sample(30_000), null);
  assert.deepEqual(run(quality, 16, 8), []);
  assert.equal(quality.tier, 'high');
});

await test('returning from a hidden page forgets earlier slow frames but retains its tier', () => {
  const quality = new AdaptiveQuality();
  reach(quality, 'balanced', 40);
  run(quality, 16, 3.2);
  assert.deepEqual(run(quality, 40, 2), []);
  // RotaWorld calls reset while document.hidden, independently of RAF pauses.
  quality.reset();
  assert.equal(quality.tier, 'balanced');
  assert.deepEqual(run(quality, 40, 4.8), []);
  assert.equal(quality.tier, 'balanced');
});

await test('invalid clocks cannot trigger quality changes or preserve partial evidence', () => {
  for (const frameMs of [NaN, Infinity, -Infinity, 0, -16]) {
    const quality = new AdaptiveQuality();
    run(quality, 40, 5);
    assert.equal(quality.sample(frameMs), null);
    assert.deepEqual(run(quality, 40, 4.8), []);
    assert.equal(quality.tier, 'high');
  }
});

await test('recovery requires sustained headroom and returns one tier at a time', () => {
  const quality = new AdaptiveQuality();
  reach(quality, 'balanced', 40);
  reach(quality, 'low', 40);
  assert.deepEqual(run(quality, 16, 14), []);
  assert.equal(quality.tier, 'low');
  assert.deepEqual(run(quality, 16, 2), ['balanced']);
  assert.equal(quality.tier, 'balanced');
  assert.deepEqual(run(quality, 16, 10), []);
  assert.deepEqual(run(quality, 16, 6), ['high']);
  assert.equal(quality.tier, 'high');
});

await test('mixed frame times prevent repeated upshifts and avoid tier oscillation', () => {
  const quality = new AdaptiveQuality();
  reach(quality, 'balanced', 40);
  run(quality, 16, 3.2);
  for (let i = 0; i < 8; i++) {
    assert.deepEqual(run(quality, 16, 10), []);
    assert.equal(quality.sample(22), null);
  }
  assert.equal(quality.tier, 'balanced');
  assert.deepEqual(run(quality, 16, 13), ['high']);
});

await test('GPU pressure restores small buffers even before slow-frame evidence exists', () => {
  const quality = new AdaptiveQuality();
  quality.pressure();
  assert.equal(quality.tier, 'low');
  assert.equal(renderDensity(quality.tier, 3, 390, 844), 1.25);
  assert.equal(renderSamples(quality.tier, 1, 4), 0);
  assert.deepEqual(run(quality, 16, 14), []);
  assert.deepEqual(run(quality, 16, 2), ['balanced']);
});

await test('repeated GPU pressure clears previous recovery evidence', () => {
  const quality = new AdaptiveQuality();
  reach(quality, 'balanced', 40);
  run(quality, 16, 14);
  quality.pressure();
  assert.deepEqual(run(quality, 16, 14), []);
  quality.pressure();
  assert.deepEqual(run(quality, 16, 14), []);
  assert.equal(quality.tier, 'low');
  assert.deepEqual(run(quality, 16, 2), ['balanced']);
});

await test('powerful devices start at native density, a step above high', () => {
  const quality = new AdaptiveQuality('high');
  assert.equal(quality.tier, 'high');
  assert.equal(quality.native, true);
  // A 5K screen at 2× and a 3.5× phone draw every pixel.
  assert.equal(renderDensity('high', 2, 2560, 1440, true), 2);
  assert.equal(renderDensity('high', 3.5, 390, 844, true), 3.5);
  // Beyond a 6K screen the buffer is capped, never under one pixel per CSS px.
  assert.ok(renderDensity('high', 2, 3840, 2160, true) < 2);
  assert.equal(renderDensity('high', 2, 7680, 4320, true), 1);
  // Native only lifts the high tier.
  assert.equal(
    renderDensity('balanced', 3, 390, 844, true),
    renderDensity('balanced', 3, 390, 844),
  );
});

await test('native is the first thing a slow powerful device gives up, and it comes back', () => {
  const quality = new AdaptiveQuality('high');
  reach(quality, 'high', 40);
  assert.equal(quality.native, false);
  assert.equal(quality.tier, 'high');
  reach(quality, 'balanced', 40);
  reach(quality, 'high', 16);
  assert.equal(quality.native, false);
  reach(quality, 'high', 16);
  assert.equal(quality.native, true);
  // Never above native.
  assert.deepEqual(run(quality, 16, 30), []);
  quality.pressure();
  assert.equal(quality.native, false);
  assert.equal(quality.tier, 'low');
});

await test('weak devices start at balanced; mid devices keep the old start', () => {
  assert.equal(new AdaptiveQuality('low').tier, 'balanced');
  assert.equal(new AdaptiveQuality('low').native, false);
  const mid = new AdaptiveQuality('mid');
  assert.equal(mid.tier, 'high');
  assert.equal(mid.native, false);
  assert.deepEqual(run(mid, 16, 30), []);
});
