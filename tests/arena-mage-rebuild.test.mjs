import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import ts from 'typescript';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(
  readFileSync(resolve(root, 'lib/games/arena/assets.json')),
);
const data = readFileSync(
  resolve(root, `public${manifest.models.figures.path}`),
);
const figures = (
  await new GLTFLoader().parseAsync(
    data.buffer.slice(data.byteOffset, data.byteOffset + data.length),
    '',
  )
).scene;
// The manifest is the production input. An isolated authored candidate can
// be exercised with the same regression before root merges its figure.
if (process.env.MAGE_CANDIDATE) {
  const bytes=readFileSync(resolve(root,process.env.MAGE_CANDIDATE));
  const mage=(await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length),'')).scene.getObjectByName('mage');
  figures.remove(figures.getObjectByName('mage'));
  figures.add(mage);
}
const compiled = new Map();
const DT = 1 / 60;

/** Load the actual animator and moves. A level test field replaces only
 *  the browser/GPU world; leg geometry comes from the manifest or explicit isolated candidate. */
function runtime(random = 0.5, groundAt = () => 0) {
  const modules = new Map();
  const math = Object.create(Math);
  math.random = () => random;
  function load(file) {
    if (file === resolve(root, 'components/game/arena/world.ts'))
      return {
        find: (model, name) => model.getObjectByName(name),
        standHeight: groundAt,
      };
    if (modules.has(file)) return modules.get(file);
    const exports = {};
    modules.set(file, exports);
    if (!compiled.has(file))
      compiled.set(
        file,
        ts.transpileModule(readFileSync(file, 'utf8'), {
          compilerOptions: {
            module: ts.ModuleKind.CommonJS,
            target: ts.ScriptTarget.ES2022,
            esModuleInterop: true,
          },
        }).outputText,
      );
    vm.runInNewContext(compiled.get(file), {
      exports,
      Math: math,
      require(id) {
        if (id === 'three') return THREE;
        if (id === 'three/addons/utils/SkeletonUtils.js') return SkeletonUtils;
        const base = id.startsWith('@/')
          ? resolve(root, id.slice(2))
          : resolve(dirname(file), id);
        const path = [base, `${base}.ts`, resolve(base, 'index.ts')].find(
          (candidate) =>
            statSync(candidate, { throwIfNoEntry: false })?.isFile(),
        );
        assert.ok(path, `animation dependency ${id}`);
        return load(path);
      },
    });
    return exports;
  }
  return {
    ...load(resolve(root, 'components/game/arena/troops.ts')),
    ...load(resolve(root, 'components/game/arena/moves/mage.ts')),
    ...load(resolve(root, 'components/game/arena/moves/index.ts')),
    ...load(resolve(root, 'lib/games/arena/cards.ts')),
    ...load(resolve(root, 'lib/games/arena/layout.ts')),
    ...load(resolve(root, 'lib/games/arena/engine.ts')),
  };
}

function fixture(card, r = runtime(), dt = DT) {
  const source = figures.getObjectByName(card);
  assert.ok(source, `${card} has a collector model`);
  const model = SkeletonUtils.clone(source);
  const group = new THREE.Group();
  const body = new THREE.Group();
  model.scale.set(...r.figureDimensions(r.TROOP_SCALE));
  body.add(model);
  group.add(body);
  group.updateMatrixWorld(true);
  const rig = {};
  model.traverse((node) => {
    const part = node.name.startsWith(card) ? node.name.slice(card.length) : '';
    // A one-material joint is itself a Mesh; multi-material joints have
    // child meshes with glTF suffixes (_1, 001). Both joint forms matter.
    if (/^[a-z]+[LR]?[23]?$/.test(part))
      rig[part] = {
        node,
        rest: node.rotation.clone(),
        y: node.position.y,
      };
  });
  const kit = {
    team: 0,
    group,
    body,
    model,
    rig,
    face: {},
    parts: [],
    poses: {},
    drapes: false,
    top: new THREE.Box3().setFromObject(model).max.y,
  };
  model.traverse((node) => {
    if (node.isSkinnedMesh)
      kit.direct = {
        meshes: [],
        skeletons: new Set(),
        materials: [],
        colours: new Map(),
        xray: true,
      };
  });
  // The renderer consumes poses; it does not create or change them.
  const renderer = {
    scale: r.TROOP_SCALE,
    reducedMotion: false,
    modelOf: () => card,
    kit: () => kit,
    add: () => [],
    write: () => group.updateMatrixWorld(true),
    ring() {},
    blob() {},
    colour() {},
    flutter() {},
    remove() {},
  };
  const stats = r.troopCards[card].unit;
  const unit = {
    id: 7,
    side: 0,
    owner: 0,
    card,
    x: 9,
    y: 4,
    px: 9,
    py: 4,
    hp: stats.hp,
    maxHp: stats.hp,
    state: 'walking',
    deployLeft: 0,
    targetId: null,
    attackTimer: stats.firstHit,
    facing: 0,
    sinceHit: 99,
    lane: 0,
    bridge: 3.5,
    power: 1,
    pace: 1,
    shield: stats.shield ?? 0,
    stun: 0,
    dash: false,
    charged: false,
    cooldown: 0,
    raged: false,
    taunt: 0,
    tauntId: null,
    slow: 0,
    slowFactor: 1,
    beat: 1,
  };
  const view = new r.TroopView(renderer, unit.id, card, 0, 0);
  let time = 0;
  function frame({
    state = unit.state,
    speed = 0,
    speedX = 0,
    deployLeft,
    alpha = 1,
    sinceHit,
    buildings = [],
    stoneScale = 0.9,
  } = {}) {
    unit.state = state;
    if (deployLeft !== undefined) unit.deployLeft = deployLeft;
    unit.px = unit.x;
    unit.py = unit.y;
    if (unit.stun <= 0) {
      unit.y += speed * dt;
      unit.x += speedX * dt;
    }
    unit.sinceHit += dt;
    if (state === 'attacking' && unit.stun <= 0) {
      unit.attackTimer -= dt;
      if (unit.attackTimer <= 0) {
        unit.attackTimer += stats.hitSpeed;
        unit.sinceHit = 0;
      }
    }
    if (sinceHit !== undefined) unit.sinceHit = sinceHit;
    time += dt;
    view.update(unit, alpha, dt, time, buildings, stoneScale);
    return {
      angles: Object.fromEntries(
        Object.entries(rig).map(([part, { node, rest }]) => [
          part,
          ['x', 'y', 'z'].map((axis) => node.rotation[axis] - rest[axis]),
        ]),
      ),
      bodyY: body.position.y,
      bodyYaw: body.rotation.y,
      bodyTilt: [body.rotation.x, body.rotation.z],
      bodyScale: body.scale.toArray(),
      matrix: group.matrixWorld.toArray(),
      position: view.position.toArray(),
      phase: view.phase,
      travel: view.travel,
    };
  }
  function run(seconds, options = {}) {
    return Array.from({ length: Math.ceil(seconds / dt) }, () =>
      frame(options),
    );
  }
  function push(dx = 0, dy = 1) {
    const [fx, , fz] = r.toWorld(unit.x, unit.y);
    unit.px = unit.x;
    unit.py = unit.y;
    unit.x += dx;
    unit.y += dy;
    const [x, , z] = r.toWorld(unit.x, unit.y);
    view.knockback(fx, fz, x, z);
    return { from: [fx, fz], to: [x, z] };
  }
  function soles() {
    return ['L', 'R'].map((side) => {
      const foot = rig[`foot${side}`]?.node;
      assert.ok(foot, `${card} has a ${side} foot`);
      const bounds = new THREE.Box3();
      for (const surface of r.figureSurfaces(model, card, `foot${side}`))
        bounds.union(r.posedSurfaceBounds(surface, new THREE.Box3()));
      return bounds.min.y;
    });
  }
  function legReach() {
    return ['L', 'R'].map((side) => {
      const hip = rig[`leg${side}`]?.node;
      const knee = rig[`knee${side}`]?.node;
      const foot = rig[`foot${side}`]?.node;
      assert.ok(hip && knee && foot, `${card} has a complete ${side} leg`);
      const a = new THREE.Vector3().setFromMatrixPosition(hip.matrixWorld);
      const b = new THREE.Vector3().setFromMatrixPosition(knee.matrixWorld);
      const c = new THREE.Vector3().setFromMatrixPosition(foot.matrixWorld);
      return {
        reach: a.distanceTo(c),
        length: a.distanceTo(b) + b.distanceTo(c),
      };
    });
  }
  function staffDiagnostic() {
    const hand=rig.handR.node.matrixWorld.elements;
    const staff=rig.weapon.node.matrixWorld.elements;
    const matrixGap=Math.max(...hand.map((v,i)=>Math.abs(v-staff[i])));
    const shoe=model.getObjectByName('mage-shoe');
    assert.ok(shoe?.isMesh,'the natural staff retains its silver planted shoe');
    const point=new THREE.Vector3();let min=Infinity,max=-Infinity;
    for(let i=0;i<shoe.geometry.attributes.position.count;i++) {
      shoe.getVertexPosition(i,point).applyMatrix4(shoe.matrixWorld);
      min=Math.min(min,point.y);max=Math.max(max,point.y);
    }
    const bounds=r.posedSurfaceBounds({mesh:shoe},new THREE.Box3());
    return {matrixGap,soleY:soles(),staffShoeY:[min,max],staffBroadY:[bounds.min.y,bounds.max.y],fidget:view.memo.fKind};
  }
  return {
    view,
    unit,
    rig,
    kit,
    renderer,
    frame,
    run,
    push,
    soles,
    legReach,
    staffDiagnostic,
    stats,
  };
}

function finite(frames, name) {
  for (const frame of frames)
    assert.ok(
      [
        frame.bodyY,
        frame.bodyYaw,
        ...frame.bodyTilt,
        ...frame.bodyScale,
        ...frame.matrix,
        ...frame.position,
        frame.phase,
        frame.travel,
        ...Object.values(frame.angles).flat(),
      ].every(Number.isFinite),
      `${name} produces finite transforms`,
    );
}

function grounded(f, name) {
  for (const [i, y] of f.soles().entries())
    assert.ok(
      y > -0.08 && y < 0.18,
      `${name} sole ${i} stays at the ground (${y})`,
    );
  for (const { reach, length } of f.legReach())
    assert.ok(
      reach > length * 0.35 && reach <= length * 1.001,
      `${name} keeps a formed leg (${reach} of ${length})`,
    );
}

await test('Wizard keeps its whole posed figure finite when a stationary phone troop starts on a slow frame', () => {
  // A new troop can first draw after the RAF's 50ms cap or a slow resume.
  // Its idle clock has already advanced before the move gets its first call.
  const scale = 3.1211;
  for (const firstDt of [.05, .1, .25]) {
    const r = runtime(), f = fixture('mage', r);
    f.renderer.scale = scale;
    f.kit.model.scale.set(...r.figureDimensions(scale));
    Object.assign(f.unit, {
      id: 34, x: 11.2, px: 11.2, y: 11, py: 11,
      state: 'walking', targetId: null, deployLeft: 0, sinceHit: 99,
    });
    let time = 20;
    const point = new THREE.Vector3();
    function draw(dt, stage) {
      f.view.update(f.unit, 1, dt, time);
      const label = `${stage} after ${firstDt}s first frame`;
      f.kit.model.traverse((node) => {
        assert.ok(node.matrixWorld.elements.every(Number.isFinite),
          `${node.name} retains a finite world frame in ${label}`);
        if (!node.isMesh) return;
        if (node.isSkinnedMesh) {
          node.skeleton.update();
          assert.ok(node.skeleton.boneMatrices.every(Number.isFinite),
            `${node.name} retains its finite GPU palette in ${label}`);
        }
        // Actual blended skin and rigid surfaces must remain on screen;
        // finite root matrices alone missed the poisoned torso subtree.
        for (const vertex of [0, node.geometry.attributes.position.count - 1]) {
          node.getVertexPosition(vertex, point).applyMatrix4(node.matrixWorld);
          assert.ok(point.toArray().every(Number.isFinite),
            `${node.name} has drawable vertices in ${label}`);
        }
      });
      assert.ok(Number.isFinite(f.view.memo.staffGroundGap),
        `Wizard keeps a measurable staff contact in ${label}`);
    }
    draw(firstDt, 'creation');
    for (let frame = 0; frame < 240; frame++) {
      time += DT;
      draw(DT, 'subsequent idle');
    }
    assert.ok(f.view.memo.fKind >= -1 && f.view.memo.fKind <= 3,
      'fresh fidget state starts and progresses without an initial fast frame');
  }
});


await test('Wizard plants its actual staff shoe through idle fidgets and casts while its gripping wrist stays attached',()=>{
  const r=runtime(),f=fixture('mage',r),fidgets=new Set();
  assert.ok(f.rig.handR,'Wizard has an independently driven gripping wrist');
  let checked=0,airborneCasts=0;
  function frame(stage,options) {
    const pose=f.frame(options);finite([pose],`Wizard ${stage}`);
    const hand=f.rig.handR.node.matrixWorld.elements;
    const staff=f.rig.weapon.node.matrixWorld.elements;
    const gap=Math.max(...hand.map((v,i)=>Math.abs(v-staff[i])));
    assert.ok(gap<1e-7,`Wizard wrist and staff retain the same world frame in ${stage}`);
    if(f.view.memo.fKind>=0)fidgets.add(f.view.memo.fKind);
    // Physical vertices matter here; a transformed bounding box exaggerates
    // the clearance of a rolled shoe and would miss the actual contact.
    if(checked++%12===0 && f.view.memo.staffDeploy>=.9) {
      const contact=f.staffDiagnostic();
      assert.ok(contact.staffShoeY[0]>-.001,`Wizard ${stage} staff foot stays above the ground (${contact.staffShoeY[0]})`);
      if(stage==='cast' && f.view.memo.staffFree>.25 && contact.staffShoeY[0]>.15)
        airborneCasts++;
      if((f.view.memo.staffFree??0)<=.001 && f.view.memo.staffCanPlant) {
        const m=f.kit.model.matrixWorld.elements;
        const lift=(f.view.memo.staffLift??0)*Math.hypot(m[4],m[5],m[6]);
        assert.ok(Math.abs(contact.staffShoeY[0]-lift)<.002,`Wizard ${stage} staff meets its planted or deliberately lifted height (${contact.staffShoeY[0]} vs ${lift})`);
      }
    }
  }
  for(let i=0;i<61;i++)frame('deploy',{state:'deploying',deployLeft:r.DEPLOY_TIME*(1-i/60)});
  for(let i=0;i<180;i++)frame('walk',{state:'walking',speed:f.stats.speed});
  for(let i=0;i<600;i++)frame('cast',{state:'attacking'});
  for(let i=0;i<2700;i++)frame('idle',{state:'walking'});
  assert.deepEqual([...fidgets].sort((a,b)=>a-b),[0,1,2,3],'tap, toss, peer and staff lean are all exercised');
  assert.ok(airborneCasts>5,'the deliberate overhead casts retain their free airborne staff');
  grounded(f,'Wizard after full motion and idle');
});

await test('Wizard resolves its whole staff shoe against the production bridge approach in one draw', () => {
  // Exact bridge deck from world.standHeight for the left valley lane.
  const bridge = (x, z) => Math.abs(x + 5.5) <= 1.2 && Math.abs(z) <= 1.95
    ? .42 + .28 * (1 - (z / 1.95) ** 2) - .3 : 0;
  const r = runtime(.5, bridge), f = fixture('mage', r);
  f.unit.x = f.unit.px = 3.5;
  f.unit.y = f.unit.py = 13;
  const shoe = f.kit.model.getObjectByName('mage-shoe');
  assert.ok(shoe?.isMesh, 'the staff retains its physical silver shoe');
  const point = new THREE.Vector3();
  let planted = 0, bridgeContacts = 0;
  for (let frame = 0; frame < 900; frame++) {
    finite([f.frame({state: 'walking', speed: f.stats.speed})], 'Wizard bridge approach');
    let clearance = Infinity, floor = 0;
    for (let vertex = 0; vertex < shoe.geometry.attributes.position.count; vertex++) {
      shoe.getVertexPosition(vertex, point).applyMatrix4(shoe.matrixWorld);
      const terrain = bridge(point.x, point.z), gap = point.y - terrain;
      if (gap < clearance) { clearance = gap; floor = terrain; }
    }
    assert.ok(clearance > -.001, `Wizard bridge frame ${frame} shoe clears the deck (${clearance})`);
    const m = f.kit.model.matrixWorld.elements;
    const lift = (f.view.memo.staffLift ?? 0) * Math.hypot(m[4], m[5], m[6]);
    if (f.view.memo.staffCanPlant) {
      planted++;
      if (floor > .1) bridgeContacts++;
      assert.ok(Math.abs(clearance - lift) < .0002,
        `Wizard bridge frame ${frame} validates its final planted contact (${clearance} vs ${lift})`);
    }
    const hand = f.rig.handR.node.matrixWorld.elements;
    const staff = f.rig.weapon.node.matrixWorld.elements;
    assert.ok(hand.every((value, i) => Math.abs(value - staff[i]) < 1e-7),
      `Wizard bridge frame ${frame} keeps the staff and gripping wrist together`);
  }
  assert.ok(planted > 400 && bridgeContacts > 40,
    `Wizard makes reachable contacts on both the ground and bridge (${planted}, ${bridgeContacts})`);
});
