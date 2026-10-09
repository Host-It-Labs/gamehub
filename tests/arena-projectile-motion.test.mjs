import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as THREE from 'three';
import * as geometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import * as engine from '../lib/games/arena/engine.ts';
import * as cards from '../lib/games/arena/cards.ts';
import * as layout from '../lib/games/arena/layout.ts';

const exports = {};
vm.runInNewContext(
  ts.transpileModule(
    readFileSync(
      new URL('../components/game/arena/projectile-motion.ts', import.meta.url),
      'utf8',
    ),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText,
  {
    exports,
    require(id) {
      if (id === '@/lib/games/arena/engine') return engine;
      throw new Error(`unexpected projectile dependency ${id}`);
    },
  },
);
const { projectileAhead } = exports;

const effectExports = {};
vm.runInNewContext(
  ts.transpileModule(
    readFileSync(
      new URL('../components/game/arena/effects.ts', import.meta.url),
      'utf8',
    ),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText,
  {
    exports: effectExports,
    document: {
      createElement: () => ({
        getContext: () => ({
          createRadialGradient: () => ({ addColorStop() {} }),
          fillRect() {},
        }),
      }),
    },
    require(id) {
      const dependencies = {
        three: THREE,
        'three/addons/utils/BufferGeometryUtils.js': geometryUtils,
        '@/lib/games/arena/engine': engine,
        '@/lib/games/arena/cards': cards,
        '@/lib/games/arena/layout': layout,
        './materials': {},
        './troops': {},
        './world': {},
        './status': {},
        './projectile-motion': exports,
      };
      assert.ok(id in dependencies, `projectile renderer dependency ${id}`);
      return dependencies[id];
    },
  },
);

await test('drawing a fast ground shot cannot predict through a standing facade', () => {
  const m = engine.createMatch(1);
  const t = m.towers.find((t) => t.side === 1 && t.kind === 'princess');
  const half = engine.towerFootprint.princess.half;
  const p = {
    ...engine.plainShot,
    id: 99,
    sourceId: 98,
    targetId: t.id,
    side: 0,
    kind: 'bullet',
    x: t.x,
    y: t.y - half - 0.1,
    tx: t.x,
    ty: t.y,
    sx: t.x,
    sy: t.y - half - 1,
    sz: 0.8,
    speed: 16,
    distance: 4,
    travelled: 1,
    damage: 10,
  };
  const before = JSON.stringify(m);
  for (const alpha of [0.1, 0.5, 0.9, 1]) {
    const ahead = projectileAhead(m, p, alpha);
    assert.ok(ahead <= 0.1 + 1e-7, `alpha ${alpha}: predicted ${ahead}`);
    assert.ok(ahead >= 0);
  }
  assert.equal(
    JSON.stringify(m),
    before,
    'drawing does not mutate lockstep state',
  );
  t.destroyed = true;
  assert.ok(projectileAhead(m, p, 1) > 0.5, 'rubble no longer blocks drawing');
});

await test('elevated tower shots and lobbed shells keep their unobstructed arc', () => {
  const m = engine.createMatch(2);
  const t = m.towers.find((t) => t.kind === 'princess');
  const p = {
    ...engine.plainShot,
    x: t.x,
    y: t.y - 1.414,
    tx: t.x,
    ty: t.y,
    speed: 16,
    sz: 3.4,
    kind: 'arrow',
  };
  assert.ok(projectileAhead(m, p, 1) > 0.5);
  assert.ok(projectileAhead(m, { ...p, sz: 0.8, kind: 'shell' }, 1) > 0.5);
  assert.equal(projectileAhead(m, p, 0), 0);
});

await test('actual low shot tips and sheaths clear faces and corners after muzzle offsets at portrait scale', () => {
  const world = {
    scene: new THREE.Scene(),
    towers: new Map(),
    viewSide: 0,
    towerScale: 0.9,
  };
  const views = new effectExports.ProjectileViews(world, { trail() {}, muzzle() {} });
  // This is the largest existing figure-derived shot scale, not a test
  // replica of its meshes: ProjectileViews builds the actual game geometry.
  views.setScale(
    layout.troopScale({ elevation: 70, fov: 26, wide: 0 }, true) / 1.75,
  );
  let id = 99;
  let vertices = 0;
  const point = new THREE.Vector3();
  try {
    for (const kind of ['princess', 'king'])
      for (const angle of [0, Math.PI / 4, Math.PI / 2, Math.PI]) {
        const m = engine.createMatch(1);
        const tower = m.towers.find((t) => t.side === 1 && t.kind === kind);
        m.towers = [tower];
        const hx = Math.sin(angle),
          hy = Math.cos(angle);
        const { half, corner } = engine.towerFootprint[kind];
        const diagonal = Math.abs(hx) > 0.5 && Math.abs(hy) > 0.5;
        const distance =
          (diagonal ? Math.SQRT2 * (half - corner) + corner : half) + 0.1;
        for (const shot of [
          'laser',
          'bolt',
          'arrow',
          'cannon',
          'fire',
          'frost',
          'zap',
        ])
          for (const alpha of [0, 0.3, 0.8, 1])
            for (const [forward, lateral] of [
              [0, 0],
              [0.3, 0],
              [3, 0],
              [0.3, 0.45],
            ]) {
              const p = {
                ...engine.plainShot,
                id: id++,
                sourceId: 98,
                targetId: tower.id,
                side: 0,
                kind: shot,
                x: tower.x - hx * distance,
                y: tower.y - hy * distance,
                tx: tower.x,
                ty: tower.y,
                sx: tower.x - hx * (distance + 1),
                sy: tower.y - hy * (distance + 1),
                sz: 0.8,
                speed: 16,
                distance: 4,
                travelled: 1,
                damage: 10,
              };
              m.projectiles = [p];
              const before = JSON.stringify(m);
              views.sync(
                m,
                alpha,
                () => 0.8,
                () =>
                  new THREE.Vector3(
                    p.sx - 9 + hx * forward + hy * lateral,
                    p.sz,
                    16 - p.sy - hy * forward + hx * lateral,
                  ),
              );
              world.scene.updateMatrixWorld(true);
              views.meshes.get(p.id).traverse((node) => {
                if (!node.isMesh) return;
                const positions = node.geometry.attributes.position;
                for (let v = 0; v < positions.count; v++) {
                  point
                    .fromBufferAttribute(positions, v)
                    .applyMatrix4(node.matrixWorld);
                  const gap = engine.towerGap(tower, point.x + 9, 16 - point.z);
                  assert.ok(
                    gap >= -1e-7,
                    `${kind} ${shot} ${angle} alpha${alpha} offset${forward}/${lateral}: vertex gap${gap}`,
                  );
                  vertices++;
                }
              });
              assert.equal(
                JSON.stringify(m),
                before,
                'visual correction leaves authoritative state intact',
              );
            }
      }
    assert.ok(
      vertices > 10000,
      'real cores, sheaths, arrowheads and ice halos were checked',
    );
  } finally {
    views.dispose();
  }
});

await test('final origin correction preserves elevated and lobbed paths and clears destroyed towers', () => {
  const m = engine.createMatch(2);
  const t = m.towers.find((t) => t.kind === 'princess');
  const p = { ...engine.plainShot, x: t.x, y: t.y - 2, sz: 0.8, kind: 'laser' };
  for (const shot of [
    p,
    { ...p, kind: 'shell' },
    { ...p, kind: 'bomb' },
    { ...p, kind: 'drop' },
  ]) {
    if (shot === p) shot.sz = 3.4;
    assert.deepEqual(
      Array.from(exports.projectileOrigin(m, shot, t.x, t.y, 0.6)),
      [t.x, t.y],
    );
  }
  p.sz = 0.8;
  m.towers.forEach((tower) => {
    tower.destroyed = true;
  });
  assert.deepEqual(Array.from(exports.projectileOrigin(m, p, t.x, t.y, 0.6)), [
    t.x,
    t.y,
  ]);
});
