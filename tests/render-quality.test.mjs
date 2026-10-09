import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classify,
  floorAt,
  MAX_PIXELS,
  startLevel,
  startRatio,
  stillRatio,
} from '../components/game/render-quality.ts';
import { Pacer, ladder } from '../components/game/render-pacer.ts';

const device = (gpu, cores = 8, memory = 8) => ({
  gpu,
  cores,
  memory,
  webgl: true,
});

await test('graphics chips sort into power classes', () => {
  const cases = [
    ['Apple GPU', 'high'],
    ['ANGLE (Apple, ANGLE Metal Renderer: Apple M2 Pro, Unspecified Version)', 'high'],
    ['ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Direct3D11 vs_5_0 ps_5_0)', 'high'],
    ['ANGLE (AMD, AMD Radeon Pro 5500M OpenGL Engine, OpenGL 4.1)', 'high'],
    ['Adreno (TM) 740', 'high'],
    ['Mali-G715 Immortalis MC11', 'high'],
    ['ANGLE (Intel, Intel(R) Iris(R) Xe Graphics Direct3D11)', 'mid'],
    ['ANGLE (AMD, AMD Radeon(TM) Graphics Direct3D11)', 'mid'],
    ['Adreno (TM) 650', 'mid'],
    ['Mali-G78 MP14', 'mid'],
    ['ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11)', 'low'],
    ['Intel(R) HD Graphics 400', 'low'],
    ['Mali-G57 MC2', 'low'],
    ['Adreno (TM) 506', 'low'],
    ['PowerVR Rogue GE8320', 'low'],
    ['ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device))', 'low'],
  ];
  for (const [gpu, want] of cases) assert.equal(classify(device(gpu)), want, gpu);
});

await test('cores and memory cap the class, except on Apple chips', () => {
  // Safari on iOS reports few cores; iPhones still count as powerful.
  assert.equal(classify(device('Apple GPU', 2, undefined)), 'high');
  assert.equal(classify(device('NVIDIA GeForce RTX 3060', 4, 8)), 'mid');
  assert.equal(classify(device('NVIDIA GeForce RTX 3060', 8, 4)), 'mid');
  assert.equal(classify(device('Adreno (TM) 740', 8, 2)), 'low');
  assert.equal(classify({ gpu: '', cores: 8, webgl: false }), 'low');
  // A browser that hides its chip falls back on cores.
  assert.equal(classify(device('', 12, undefined)), 'high');
  assert.equal(classify(device('', 6, undefined)), 'mid');
});

await test('powerful devices draw every display pixel up to a 6K screen', () => {
  assert.equal(startRatio(390, 844, 3, 'high'), 3);
  assert.equal(startRatio(2560, 1440, 2, 'high'), 2);
  assert.equal(startRatio(3840, 2160, 1, 'high'), 1);
  const huge = startRatio(3840, 2160, 2, 'high');
  assert.ok(huge < 2 && 3840 * 2160 * huge * huge <= MAX_PIXELS + 1);
});

await test('weaker devices start lower but never under one pixel per CSS pixel', () => {
  // A 4K budget: native on a 1440p screen at 2×, capped on a 5K one.
  assert.equal(startRatio(1440, 900, 2, 'mid'), 2);
  assert.ok(startRatio(2560, 1440, 2, 'mid') < 2);
  const phone = startRatio(390, 844, 3, 'low');
  assert.ok(phone > 1 && phone < 3);
  assert.equal(startRatio(1920, 1080, 1, 'low'), 1);
  // A zoomed-out page (DPR under one) keeps its native density.
  assert.equal(startRatio(2400, 1350, 0.8, 'low'), 0.8);
  for (const p of ['high', 'mid', 'low'])
    for (const [w, h] of [[0, 0], [390, 844], [7680, 4320]])
      for (const dpr of [0.5, 1, 2, 3]) {
        const r = stillRatio(w, h, dpr, p);
        assert.ok(Number.isFinite(r) && r > 0 && r <= dpr, `${p} ${w} ${dpr}`);
        assert.ok(r >= Math.min(dpr, 1));
      }
});

await test('the pacer starts on the rung that fits the device', () => {
  const rungs = ladder(2048, floorAt(1, 3));
  assert.equal(startLevel(rungs, 390, 844, 3, 'high'), 0);
  const low = startLevel(rungs, 390, 844, 3, 'low');
  assert.ok(low > 0);
  assert.ok(rungs[low].resolution * 3 <= startRatio(390, 844, 3, 'low') + 1e-3);
  const seen = [];
  const pacer = new Pacer(rungs, (r) => seen.push(r), low);
  assert.equal(pacer.level, low);
  assert.equal(pacer.rung, rungs[low]);
  // Calm frames climb back towards native.
  let now = 0;
  for (let i = 0; i < 60 * 30; i++) pacer.frame((now += 16.7));
  assert.equal(pacer.level, 0);
  assert.ok(seen.length > 0);
});

await test('ladder floors keep a density in pixels per CSS pixel', () => {
  assert.ok(Math.abs(floorAt(1.2, 3) - 0.4) < 1e-9);
  assert.equal(floorAt(1.2, 1), 1);
  for (const r of ladder(2048, floorAt(1.5, 3)))
    assert.ok(r.resolution * 3 >= 1.5 - 1e-3);
});
