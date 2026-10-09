import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

const root = new URL('../', import.meta.url).href;
register(
  `data:text/javascript,${encodeURIComponent(`
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = ${JSON.stringify(root)};
export async function resolve(spec, ctx, next) {
  let base = null;
  if (spec.startsWith('@/')) base = fileURLToPath(root + spec.slice(2));
  else if (/^\\.\\.?\\//.test(spec) && ctx.parentURL?.startsWith('file:') && !/\\.[cm]?[jt]sx?$/.test(spec)) base = fileURLToPath(new URL(spec, ctx.parentURL));
  if (base) for (const ext of ['.ts', '.tsx']) if (existsSync(base + ext)) return next(pathToFileURL(base + ext).href, ctx);
  return next(spec, ctx);
}
export async function load(url, ctx, next) {
  if (['view.ts', 'fx.ts'].some(file => url === root + 'components/game/diner/' + file)) {
    const { readFile } = await import('node:fs/promises');
    const { default: ts } = await import(root + 'node_modules/typescript/lib/typescript.js');
    return { format: 'module', shortCircuit: true, source: ts.transpileModule(await readFile(new URL(url), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    }).outputText };
  }
  return next(url, ctx);
}`)}`,
);

const THREE = await import('three');
const { Kit, makeMaterials } = await import('../components/game/diner/kit.ts');
const { guestFigure, waiterFigure, expression } =
  await import('../components/game/diner/people.ts');
const { cached, shared, releaseShared, modelCacheSize, disposeCache } =
  await import('../components/game/diner/model-cache.ts');
const { disposeSurfaceMaterials } =
  await import('../components/game/diner/materials.ts');
const { fitDinerCamera, DINER_LANDMARKS } =
  await import('../components/game/diner/framing.ts');
const { DinerView } = await import('../components/game/diner/view.ts');
const { W, D, TABLES, QUEUE, COUNTER_X } =
  await import('../lib/games/diner/layout.ts');

await test('the deck, hatch, queue and booths fill a landscape screen clear of the HUD', () => {
  // Insets as the shift screen measures them (diner-game.tsx): a sideways
  // phone floats its controls over the planter corners; desktops keep a strip
  // of key hints at the bottom.
  const cases = [
    { size: [1920, 969], top: 60, bottom: 50, min: 80 },
    { size: [1440, 900], top: 60, bottom: 50, min: 70 },
    { size: [1536, 730], top: 60, bottom: 50, min: 55 },
    { size: [1280, 720], top: 60, bottom: 50, min: 55 },
    { size: [1180, 820], top: 60, bottom: 8, min: 60 },
    { size: [1133, 744], top: 60, bottom: 8, min: 55 },
    { size: [932, 430], top: 26, bottom: 4, min: 36 },
    { size: [844, 390], top: 26, bottom: 4, min: 33 },
    { size: [667, 375], top: 26, bottom: 4, min: 32 },
    { size: [1123.4, 659.5], top: 60, bottom: 50, min: 48 },
  ];
  for (const c of cases) {
    const [width, height] = c.size;
    const frame = {
      width,
      height,
      top: c.top,
      bottom: c.bottom,
      left: height < 500 ? 6 : 12,
      right: height < 500 ? 6 : 12,
    };
    const camera = new THREE.OrthographicCamera();
    const { pixelsPerUnit } = fitDinerCamera(camera, frame);
    const points = [
      ...DINER_LANDMARKS,
      // Machine bubbles, high in the hatch.
      ...Object.values(COUNTER_X).map((x) => [x, 2.12, 1.1]),
      ...TABLES.map((table) => [table.x, 1.85, table.z]),
      ...QUEUE.flatMap((q) => [
        [q.x - 0.9, 1.85, q.z],
        [q.x + 0.9, 1.85, q.z],
      ]),
    ];
    for (const point of points) {
      const p = new THREE.Vector3(...point).project(camera);
      const x = ((p.x + 1) * width) / 2;
      const y = ((1 - p.y) * height) / 2;
      assert.ok(
        x >= frame.left - 0.01 && x <= width - frame.right + 0.01,
        `${width}×${height} horizontal ${point.join(',')}`,
      );
      assert.ok(
        y >= frame.top - 0.01 && y <= height - frame.bottom + 0.01,
        `${width}×${height} vertical ${point.join(',')}`,
      );
    }
    assert.ok(
      pixelsPerUnit >= c.min,
      `${width}×${height}: ${pixelsPerUnit.toFixed(1)} px per metre`,
    );
    // The place around the deck covers every canvas edge rather than a void.
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const ray = new THREE.Raycaster();
    for (const x of [-1, 1])
      for (const y of [-1, 1]) {
        ray.setFromCamera(new THREE.Vector2(x, y), camera);
        const hit = ray.ray.intersectPlane(plane, new THREE.Vector3());
        assert.ok(
          hit && Math.abs(hit.x - W / 2) <= 60 && Math.abs(hit.z - D / 2) <= 45,
          `${width}×${height} ground coverage`,
        );
      }
  }
});

await test('merged tactile geometry keeps finite UVs and outward-facing sculpted profiles', () => {
  const kit = new Kit();
  kit.rbox('vinyl', '#7fd6c2', [2, 0.4, 1], 0.06, [0, 0.3, 0]);
  kit.profile(
    'skin',
    '#e8b48c',
    [
      [-0.2, 0.01, 0.01],
      [0, 0.2, 0.15],
      [0.25, 0.01, 0.01],
    ],
    [0, 1, 0],
  );
  const parts = kit.build();
  for (const geometry of Object.values(parts)) {
    const position = geometry.getAttribute('position');
    const uv = geometry.getAttribute('uv');
    assert.equal(uv.count, position.count);
    assert.ok([...uv.array].every(Number.isFinite));
    assert.ok(
      [...geometry.getAttribute('normal').array].every(Number.isFinite),
    );
  }
  const profile = parts.skin;
  const position = profile.getAttribute('position');
  const normal = profile.getAttribute('normal');
  let front = 0;
  for (let i = 0; i < position.count; i++) {
    if (position.getZ(i) > 0.13) {
      assert.ok(normal.getZ(i) > 0, 'front of the head faces the viewer');
      front++;
    }
  }
  assert.ok(front > 0);
  for (const geometry of Object.values(parts)) geometry.dispose();
});

await test('every outfit has independently rigged joints; expression changes preserve outfit geometry', () => {
  const materials = makeMaterials();
  try {
    const figures = ['none', 'cap', 'bowler', 'beanie', 'cowboy'].flatMap(
      (hat, i) =>
        [false, true].map((glasses) =>
          guestFigure(materials, {
            skin: i,
            hair: i,
            hat,
            shirt: i,
            stripes: i % 2 === 0,
            glasses,
          }),
        ),
    );
    figures.push(...[0, 1, 2, 3].map((seat) => waiterFigure(materials, seat)));
    for (const figure of figures) {
      assert.equal(figure.head.parent, figure.body);
      assert.ok(figure.arms.length === 2 && figure.arms[0] !== figure.arms[1]);
      assert.ok(figure.legs[0] !== figure.legs[1]);
      let calls = 0;
      figure.root.traverseVisible((node) => {
        if (node.isMesh) calls++;
      });
      assert.ok(calls <= 20, `shared outfit draw-call budget (${calls})`);
      const geometries = [];
      figure.root.traverse((node) => {
        if (!node.isMesh) return;
        geometries.push(node.geometry);
        for (const attribute of ['position', 'normal', 'color', 'uv'])
          assert.ok(
            node.geometry.getAttribute(attribute),
            `${attribute} present in every figure part`,
          );
      });
      expression(figure, 'frown', 2.1, 3, false);
      assert.equal(figure.face.mouths.frown.visible, true);
      const after = [];
      figure.root.traverse((node) => {
        if (node.isMesh) after.push(node.geometry);
      });
      assert.deepEqual(
        after,
        geometries,
        'public mood does not rebuild clothing or reveal a mimic',
      );
      expression(figure, 'rest', 0.09, 0, true);
      assert.equal(
        figure.face.lids.visible,
        false,
        'reduced motion disables the blink',
      );
    }
  } finally {
    disposeCache();
    disposeSurfaceMaterials(materials);
  }
});

await test('surface textures repeat with mipmaps and each owned map is freed once', () => {
  const materials = makeMaterials();
  const seen = new Set();
  const disposed = new Map();
  for (const material of Object.values(materials)) {
    for (const map of [
      material.map,
      material.normalMap,
      material.roughnessMap,
    ]) {
      if (!map || seen.has(map)) continue;
      seen.add(map);
      assert.equal(map.wrapS, THREE.RepeatWrapping);
      assert.equal(map.wrapT, THREE.RepeatWrapping);
      assert.ok(map.generateMipmaps);
      map.addEventListener('dispose', () =>
        disposed.set(map, (disposed.get(map) ?? 0) + 1),
      );
    }
  }
  assert.ok(
    seen.size >= 21,
    'each physical surface has colour, normal and roughness maps',
  );
  disposeSurfaceMaterials(materials);
  assert.ok([...seen].every((map) => disposed.get(map) === 1));
});

await test('endless shifts evict unused geometry without freeing a currently visible actor', () => {
  const materials = makeMaterials();
  try {
    const live = shared(
      cached('live-shift', (k) =>
        k.box('paint', '#ffffff', [1, 1, 1], [0, 0, 0]),
      ),
      materials,
    );
    let freed = 0;
    live.children[0].geometry.addEventListener('dispose', () => freed++);
    for (let i = 0; i < 130; i++) {
      const prop = shared(
        cached(`temporary-shift:${i}`, (k) =>
          k.box('paint', '#ffffff', [0.1, 0.1, 0.1], [0, 0, 0]),
        ),
        materials,
      );
      releaseShared(prop);
    }
    assert.ok(modelCacheSize() <= 96);
    assert.equal(freed, 0, 'a shared live mesh survives cache pressure');
    releaseShared(live);
  } finally {
    disposeCache();
    disposeSurfaceMaterials(materials);
  }
});

await test('leaving a room releases every remaining actor bone texture', () => {
  const materials = makeMaterials();
  const scene = new THREE.Scene();
  const figures = [
    waiterFigure(materials, 0),
    guestFigure(materials, {
      skin: 1,
      hair: 2,
      hat: 'cap',
      shirt: 0,
      stripes: false,
      glasses: false,
    }),
  ];
  const freed = new Map();
  for (const figure of figures) {
    scene.add(figure.root);
    figure.root.traverse((node) => {
      if (!node.isSkinnedMesh) return;
      node.skeleton.computeBoneTexture();
      const texture = node.skeleton.boneTexture;
      freed.set(texture, 0);
      texture.addEventListener('dispose', () =>
        freed.set(texture, freed.get(texture) + 1),
      );
    });
  }
  const disposable = () => ({ dispose() {} });
  const view = Object.assign(Object.create(DinerView.prototype), {
    scene,
    waiters: [{ figure: figures[0] }],
    guests: new Map([[1, { figure: figures[1] }]]),
    mats: materials,
    stage: disposable(),
    counter: disposable(),
    rig: disposable(),
    bloom: disposable(),
    output: disposable(),
    composer: disposable(),
    passProps: [],
    fx: disposable(),
    extra: [],
    ringGeo: disposable(),
    discGeo: disposable(),
    mop: new THREE.Group(),
    renderer: disposable(),
  });
  view.dispose();
  assert.equal(freed.size, 8, 'four private skin textures per actor');
  assert.ok([...freed.values()].every((count) => count === 1));
  assert.ok(figures.every((figure) => figure.root.parent === null));
  assert.equal(view.waiters.length, 0);
  assert.equal(view.guests.size, 0);
});
