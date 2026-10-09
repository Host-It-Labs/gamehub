import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import {
  THREE,
  root,
  runtime as r,
  runtimeSources,
  makeWorld,
  makeRenderer,
} from './arena-audit-runtime.mjs';
import {
  sanity,
  auditMesh,
  towerSolids,
  posedPositions,
  activeVertexIndices,
} from './arena-exact-solids.mjs';

const options = {};
for (let i = 2; i < process.argv.length; i++) {
  const key = process.argv[i];
  if (!key.startsWith('--')) throw new Error(`Unexpected argument ${key}`);
  options[key.slice(2)] =
    process.argv[i + 1]?.startsWith('--') || i + 1 === process.argv.length
      ? true
      : process.argv[++i];
}
if (options.help) {
  console.log(`node scripts/arena-character-audit.mjs
  --dino /absolute/isolated.glb --sumo /absolute/isolated.glb
  [--figures merged.glb] [--cards ogre,sumo]
  [--dino-art-scale .48] [--sumo-art-scale 1]
  [--mode all|counts|pose|bounds|cpu|contacts] [--suite standard|full|smoke] [--case-filter regex]
  [--frames 240] [--samples 800] [--warmup 200] [--bounds-pattern regex]
  [--vertices-only] (preliminary raw-master probe, never final acceptance)
  [--out /absolute/evidence.json] [--self-test]

Art-scale flags are additional temporary nested uniform factors. Omit a flag
when the export already includes that factor. They never modify a GLB.
Contact audit uses every frame and every posed mesh vertex, plus both directions
of triangle-edge crossings against the shipped closed tower triangles. No ideal
SDF is used as acceptance evidence. CPU timing excludes this expensive audit,
GLB parsing, geometry inventory, world/GPU creation and fixture movement code.
Natural fixtures use the actual30Hz simulation and60Hz interpolated poses;
near-wall stress fixtures use exported oriented projection. The legacy rear
drop is an explicit illegal negative control, never an accepted placement.`);
  process.exit(0);
}
const checks = sanity();
if (options['self-test']) {
  console.log(JSON.stringify(checks));
  process.exit(0);
}

const manifest = JSON.parse(
  fs.readFileSync(path.resolve(root, 'lib/games/arena/assets.json'), 'utf8'),
);
const assets = [];
const sha = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
async function glb(file, role) {
  const absolute = path.resolve(root, file);
  const bytes = fs.readFileSync(absolute);
  assets.push({
    role,
    path: absolute,
    bytes: bytes.length,
    sha256: sha(bytes),
  });
  return (
    await new GLTFLoader().parseAsync(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length),
      '',
    )
  ).scene;
}
const figures = await glb(
  options.figures ?? `public${manifest.models.figures.path}`,
  'base-figures',
);
const troops = await glb(
  `public${manifest.models.troops.path}`,
  'fallback-troops',
);
const towers = await glb(
  `public${manifest.models.cartoon_towers.path}`,
  'standing-cartoon-towers',
);
for (const [flag, id] of [
  ['dino', 'ogre'],
  ['sumo', 'sumo'],
])
  if (options[flag]) {
    const isolated = await glb(options[flag], id);
    const source = isolated.getObjectByName(id);
    if (!source) throw new Error(`${options[flag]} has no ${id} root`);
    figures.getObjectByName(id)?.removeFromParent();
    figures.add(cloneSkeleton(source));
  }
const extraScale = {};
for (const [flag, id] of [
  ['dino-art-scale', 'ogre'],
  ['sumo-art-scale', 'sumo'],
]) {
  const factor = options[flag] === undefined ? 1 : Number(options[flag]);
  if (!Number.isFinite(factor) || factor <= 0)
    throw new Error(`Invalid ${flag}`);
  extraScale[id] = factor;
  if (factor === 1) continue;
  const model = figures.getObjectByName(id);
  const parent = id === 'ogre' ? model.getObjectByName('ogrevisual') : model;
  if (!parent) throw new Error('Dino has no required ogrevisual root');
  const inner = new THREE.Group();
  inner.name = `${id}auditArtScale`;
  const children = [...parent.children];
  parent.add(inner);
  for (const child of children) inner.add(child);
  inner.scale.setScalar(factor);
}
figures.updateMatrixWorld(true);
const cards = String(options.cards ?? 'ogre,sumo').split(',');
for (const id of cards)
  if (!r.troopCards[id] || !figures.getObjectByName(id))
    throw new Error(`Missing troop/model ${id}`);
const world = makeWorld(figures, troops);
const savedRandom = Math.random;
Math.random = () => 0.5;
const setupStart = performance.now();
const renderer = makeRenderer(world);
const setupMs = performance.now() - setupStart;
const scales = {
  portrait: r.troopScale({ elevation: 70, fov: 26, wide: 0 }, true),
  landscape: r.troopScale(
    { elevation: 50, fov: 30, wide: 1, side: true },
    false,
  ),
};
const dt = 1 / 60;
let nextId = 100;

function fixture(card, team = 0, existingUnit) {
  const stats = r.troopCards[card].unit;
  const unit = existingUnit ?? {
    id: nextId++,
    side: team,
    owner: team,
    card,
    x: 9,
    y: 16,
    px: 9,
    py: 16,
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
    maxShield: stats.shield ?? 0,
    shieldDelay: 0,
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
  const view = new r.TroopView(renderer, unit.id, card, team, 0);
  return { card, unit, view, kit: view.kit, stats, time: 0 };
}
function advance(f, configure, frame) {
  const { unit: u, stats } = f;
  u.px = u.x;
  u.py = u.y;
  configure(f, frame);
  u.sinceHit += dt;
  if (u.state === 'attacking' && !u.stun) {
    u.attackTimer -= dt * u.beat;
    if (u.attackTimer <= 0) {
      u.attackTimer += stats.hitSpeed;
      u.sinceHit = 0;
    }
  }
  f.time += dt;
}
function frame(f, buildings, stoneScale, alpha = 1) {
  f.alpha = alpha;
  f.view.update(f.unit, alpha, dt, f.time, buildings, stoneScale);
}
function release(f) {
  renderer.remove(f.kit, f.view.ids);
}

function colorChannels(mesh) {
  return Object.entries(mesh.geometry.attributes)
    .filter(([name]) => name.startsWith('color'))
    .map(([name, attribute]) => {
      const sums = [0, 0, 0],
        min = [Infinity, Infinity, Infinity],
        max = [-Infinity, -Infinity, -Infinity];
      let chromaticVertices = 0,
        nearWhiteVertices = 0;
      for (let i = 0; i < attribute.count; i++) {
        const rgb = [
          attribute.getComponent(i, 0),
          attribute.getComponent(i, 1),
          attribute.getComponent(i, 2),
        ];
        for (let j = 0; j < 3; j++) {
          sums[j] += rgb[j];
          min[j] = Math.min(min[j], rgb[j]);
          max[j] = Math.max(max[j], rgb[j]);
        }
        if (Math.max(...rgb) - Math.min(...rgb) > 0.03) chromaticVertices++;
        if (Math.min(...rgb) > 0.97) nearWhiteVertices++;
      }
      return {
        name,
        itemSize: attribute.itemSize,
        vertices: attribute.count,
        mean: sums.map((sum) => sum / attribute.count),
        min,
        max,
        chromaticVertices,
        nearWhiteVertices,
      };
    });
}
function inventory(id) {
  const model = figures.getObjectByName(id);
  const meshes = [],
    materials = new Set(),
    geometries = new Set(),
    skeletons = new Set();
  let triangles = 0,
    vertices = 0,
    skinnedVertices = 0,
    drawSubmissions = 0,
    skinSubmissions = 0;
  const names = new Map();
  model.traverse((node) => {
    names.set(node.name, (names.get(node.name) ?? 0) + 1);
    if (!node.isMesh) return;
    const list = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of list) materials.add(material);
    const vertexCount = node.geometry.attributes.position.count;
    const triangleCount = (node.geometry.index?.count ?? vertexCount) / 3;
    triangles += triangleCount;
    vertices += vertexCount;
    geometries.add(node.geometry);
    const submissions = Array.isArray(node.material)
      ? node.geometry.groups.length
      : 1;
    drawSubmissions += submissions;
    if (node.isSkinnedMesh) {
      skinSubmissions += submissions;
      skinnedVertices += vertexCount;
      skeletons.add(node.skeleton);
    }
    meshes.push({
      name: node.name,
      skinned: !!node.isSkinnedMesh,
      triangles: triangleCount,
      bufferVertices: vertexCount,
      referencedVertices: activeVertexIndices(node.geometry).length,
      materials: list.map((material) => ({
        name: material.name,
        color: material.color?.toArray(),
        roughness: material.roughness,
        metalness: material.metalness,
        vertexColors: material.vertexColors,
      })),
      colorChannels: node.isSkinnedMesh ? colorChannels(node) : [],
    });
  });
  const joints = {};
  for (const part of [
    'torso',
    'head',
    'jaw',
    'tail',
    'tail2',
    'tail3',
    'armL',
    'armR',
    'foreL',
    'foreR',
    'handL',
    'handR',
    'legL',
    'legR',
    'kneeL',
    'kneeR',
    'footL',
    'footR',
  ]) {
    const node = model.getObjectByName(`${id}${part}`);
    if (node)
      joints[part] = {
        type: node.type,
        parent: node.parent.name,
        position: node.position.toArray(),
        rotation: node.rotation.toArray().slice(0, 3),
        scale: node.scale.toArray(),
      };
  }
  const transforms = [];
  model.traverse((node) => {
    if (
      !node.isMesh &&
      node.scale.distanceTo(new THREE.Vector3(1, 1, 1)) > 1e-6
    )
      transforms.push({ name: node.name, scale: node.scale.toArray() });
  });
  const weights = [];
  model.traverse((mesh) => {
    if (!mesh.isSkinnedMesh) return;
    const indices = mesh.geometry.attributes.skinIndex,
      values = mesh.geometry.attributes.skinWeight;
    let badIndices = 0,
      invalidWeights = 0,
      maximumSumError = 0;
    for (let i = 0; i < values.count; i++) {
      let sum = 0;
      for (let j = 0; j < 4; j++) {
        const weight = values.getComponent(i, j),
          index = indices.getComponent(i, j);
        if (!Number.isFinite(weight) || weight < 0) invalidWeights++;
        if (
          weight > 1e-7 &&
          (!Number.isInteger(index) ||
            index < 0 ||
            index >= mesh.skeleton.bones.length)
        )
          badIndices++;
        sum += weight;
      }
      maximumSumError = Math.max(maximumSumError, Math.abs(sum - 1));
    }
    const ancestors = new Set();
    model.traverse((node) => ancestors.add(node));
    weights.push({
      mesh: mesh.name,
      bones: mesh.skeleton.bones.length,
      badIndices,
      invalidWeights,
      maximumSumError,
      foreignBones: mesh.skeleton.bones
        .filter((bone) => !ancestors.has(bone))
        .map((bone) => bone.name),
    });
  });
  const clone = cloneSkeleton(model);
  clone.scale.set(...r.figureDimensions(scales.portrait));
  clone.updateMatrixWorld(true);
  const bounds = new THREE.Box3();
  clone.traverse((mesh) => {
    if (!mesh.isMesh) return;
    const positions = posedPositions(mesh);
    for (const i of activeVertexIndices(mesh.geometry))
      bounds.expandByPoint(new THREE.Vector3().fromArray(positions, i * 3));
  });
  return {
    meshes: meshes.length,
    materialCount: materials.size,
    geometryCount: geometries.size,
    triangles,
    vertices,
    skinnedVertices,
    skeletons: skeletons.size,
    normalPassDirectDrawSubmissionsPerUnit: skinSubmissions,
    normalPassRigidPiecesBeforeBatching: drawSubmissions - skinSubmissions,
    normalPassAllPiecesBeforeBatching: drawSubmissions,
    drawCountScope:
      'Each skin primitive draws independently. Rigid attachments use shared material/layout batches; source piece counts are not the renderer GPU draw-call count.',
    existingTriangleGate:
      id === 'sumo'
        ? { requirement: 'triangles < 12500', passes: triangles < 12500 }
        : null,
    // Retain the old Sumo budget above as historical evidence. The reviewed
    // copies preserve faces, fingers and sculpted hair lost by smaller ones.
    reviewedTriangleGate:
      id === 'ogre' || id === 'sumo'
        ? { requirement: 'triangles < 40000', passes: triangles < 40000 }
        : null,
    duplicateNames: [...names].filter(([, count]) => count > 1),
    transforms,
    joints,
    weights,
    portraitNeutralBounds: {
      min: bounds.min.toArray(),
      max: bounds.max.toArray(),
      size: bounds.getSize(new THREE.Vector3()).toArray(),
    },
    pieces: meshes,
  };
}

function skinProbe(id) {
  const source = figures.getObjectByName(id);
  const sourceSkins = [];
  source.traverse((node) => {
    if (node.isSkinnedMesh) sourceSkins.push(node);
  });
  if (!sourceSkins.length)
    return {
      skipped:
        'rigid figure intentionally uses shared posed kits and batched copies',
    };
  const a = renderer.kit(id, 0),
    b = renderer.kit(id, 0);
  const idsA = renderer.add(a),
    idsB = renderer.add(b);
  renderer.write(a, idsA);
  renderer.write(b, idsB);
  const meshesA = sourceSkins.map((mesh) => a.model.getObjectByName(mesh.name));
  const meshesB = sourceSkins.map((mesh) => b.model.getObjectByName(mesh.name));
  const beforeA = meshesA.map(posedPositions),
    beforeB = meshesB.map(posedPositions),
    beforeSource = sourceSkins.map(posedPositions);
  const results = {};
  for (const part of [
    'foreR',
    'kneeL',
    'footL',
    'head',
    'torso',
    ...(id === 'ogre' ? ['jaw', 'tail', 'tail2', 'tail3'] : []),
  ]) {
    const joint = a.rig[part];
    if (!joint) {
      results[part] = { missing: true };
      continue;
    }
    const rest = joint.node.rotation.clone();
    joint.node.rotation.x -= 0.4;
    renderer.write(a, idsA);
    let movedVertices = 0,
      maximumDisplacement = 0;
    const primitives = [];
    for (let n = 0; n < meshesA.length; n++) {
      const after = posedPositions(meshesA[n]);
      let primitiveMoved = 0,
        primitiveMax = 0;
      for (let i = 0; i < after.length; i += 3) {
        const delta = Math.hypot(
          after[i] - beforeA[n][i],
          after[i + 1] - beforeA[n][i + 1],
          after[i + 2] - beforeA[n][i + 2],
        );
        if (delta > 1e-6) primitiveMoved++;
        primitiveMax = Math.max(primitiveMax, delta);
      }
      movedVertices += primitiveMoved;
      maximumDisplacement = Math.max(maximumDisplacement, primitiveMax);
      primitives.push({
        mesh: meshesA[n].name,
        movedVertices: primitiveMoved,
        maximumDisplacement: primitiveMax,
      });
    }
    joint.node.rotation.copy(rest);
    renderer.write(a, idsA);
    results[part] = {
      xDeltaRadians: -0.4,
      movedVertices,
      maximumDisplacement,
      primitives,
    };
  }
  const maxDelta = (before, after) => {
    let maximum = 0;
    for (let i = 0; i < after.length; i++)
      maximum = Math.max(maximum, Math.abs(after[i] - before[i]));
    return maximum;
  };
  const subsetCounts = {};
  for (const part of ['torso', 'head', 'footL', 'footR', 'handL', 'handR']) {
    const surfaces = r.figureSurfaces(a.model, id, part);
    subsetCounts[part] = surfaces.map((surface) => ({
      mesh: surface.mesh.name,
      weightedSubsetVertices: surface.indices?.length ?? null,
      totalVertices: surface.mesh.geometry.attributes.position.count,
    }));
  }
  const result = {
    figureScale: renderer.scale,
    primitives: sourceSkins.length,
    independentKit: a !== b,
    independentSkeleton: meshesA.every(
      (mesh, i) =>
        mesh.skeleton !== meshesB[i].skeleton &&
        mesh.skeleton !== sourceSkins[i].skeleton,
    ),
    independentBones: meshesA.every(
      (mesh, i) =>
        mesh.skeleton.bones[0] !== meshesB[i].skeleton.bones[0] &&
        mesh.skeleton.bones[0] !== sourceSkins[i].skeleton.bones[0],
    ),
    sharedGeometry: meshesA.every(
      (mesh, i) =>
        mesh.geometry === meshesB[i].geometry &&
        mesh.geometry === sourceSkins[i].geometry,
    ),
    ownedMaterial: meshesA.every(
      (mesh, i) => mesh.material !== meshesB[i].material,
    ),
    otherUnitMaximumChange: Math.max(
      ...meshesB.map((mesh, i) => maxDelta(beforeB[i], posedPositions(mesh))),
    ),
    sourceMaximumChange: Math.max(
      ...sourceSkins.map((mesh, i) =>
        maxDelta(beforeSource[i], posedPositions(mesh)),
      ),
    ),
    joints: results,
    subsetCounts,
    bothCastAndReceiveShadow: a.direct.meshes.every(
      (mesh) => mesh.castShadow && mesh.receiveShadow,
    ),
    everyMeshOnOwnTeamXrayLayer: a.direct.meshes.every((mesh) =>
      mesh.layers.isEnabled(r.SKIN_XRAY_LAYERS[0]),
    ),
  };
  renderer.remove(a, idsA);
  renderer.remove(b, idsB);
  return result;
}

function percentile(values, fraction) {
  return values[
    Math.min(values.length - 1, Math.floor(values.length * fraction))
  ];
}
function summarizeTimes(times, units) {
  const sorted = times.slice().sort((a, b) => a - b);
  const total = times.reduce((a, b) => a + b, 0);
  return {
    units,
    frames: times.length,
    meanMsPerFrame: total / times.length,
    meanMsPerUnitFrame: total / times.length / units,
    medianMsPerFrame: percentile(sorted, 0.5),
    p95MsPerFrame: percentile(sorted, 0.95),
    p99MsPerFrame: percentile(sorted, 0.99),
    maxMsPerFrame: sorted.at(-1),
  };
}
function contactPosition(
  f,
  building,
  angle,
  standOff = 0.002,
  direction = [-Math.cos(angle), -Math.sin(angle)],
  legacy = false,
) {
  const { half, corner } = r.towerFootprint[building.kind];
  const nx = Math.cos(angle),
    ny = Math.sin(angle);
  const diagonal = Math.abs(nx) > 0.1 && Math.abs(ny) > 0.1;
  const radius =
    r.troopBuildingRadius(f.card) + standOff + (diagonal ? corner : 0);
  const cx = diagonal ? Math.sign(nx) * (half - corner) : nx * half;
  const cy = diagonal ? Math.sign(ny) * (half - corner) : ny * half;
  const initial = [
    building.x + cx + nx * radius,
    building.y + cy + ny * radius,
  ];
  const legal = legacy
    ? initial
    : r.projectTroopBuildings(
        [building],
        f.card,
        ...initial,
        direction,
        standOff,
      );
  [f.unit.x, f.unit.y] = legal;
  f.unit.facing = Math.atan2(direction[0], direction[1]);
  if (f.card === 'ogre') f.unit.bodyDirection = [...direction];
  f.unit.px = f.unit.x;
  f.unit.py = f.unit.y;
  return {
    nx,
    ny,
    half,
    radius,
    initial,
    legal,
    direction,
    gap: r.troopTowerGap(building, f.card, ...legal, direction),
  };
}
function contactMotion(kind, angle = 0, pace = 1) {
  return (f, i) => {
    const u = f.unit;
    u.pace = u.beat = pace;
    if (kind === 'attack' || kind === 'back-attack') {
      u.state = 'attacking';
      u.facing = Math.atan2(
        kind === 'attack' ? -Math.cos(angle) : Math.cos(angle),
        kind === 'attack' ? -Math.sin(angle) : Math.sin(angle),
      );
    } else if (kind === 'deployment') {
      u.facing = 0;
      u.state = i < 36 ? 'deploying' : 'walking';
      u.deployLeft = Math.max(0, 0.6 - i * dt);
      if (i >= 36) u.y += f.stats.speed * pace * dt;
    } else if (kind === 'turn') {
      u.state = 'walking';
      u.facing = i < 50 ? 0 : i < 140 ? Math.PI : Math.PI / 2;
    } else if (kind === 'passing') {
      u.state = 'walking';
      u.facing = 0;
      u.y += f.stats.speed * pace * dt;
      if (i > 150) {
        u.facing = Math.PI / 2;
        u.x += f.stats.speed * pace * dt;
      }
    } else throw new Error(`Unknown motion ${kind}`);
  };
}

function poseAudit() {
  const results = {};
  renderer.setScale(scales.portrait);
  for (const card of cards) {
    const f = fixture(card);
    const meshes = [];
    f.kit.model.traverse((mesh) => {
      if (mesh.isMesh) meshes.push(mesh);
    });
    const skins = meshes.filter((mesh) => mesh.isSkinnedMesh);
    const inverse = new THREE.Matrix4(),
      point = new THREE.Vector3();
    const localPositions = (mesh) => {
      inverse.copy(f.kit.model.matrixWorld).invert();
      const count = mesh.geometry.attributes.position.count,
        values = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        mesh
          .getVertexPosition(i, point)
          .applyMatrix4(mesh.matrixWorld)
          .applyMatrix4(inverse);
        point.toArray(values, i * 3);
      }
      return values;
    };
    renderer.write(f.kit, f.view.ids);
    const before = skins.map(localPositions);
    const samples = [];
    const phases = [
      'walk',
      'walk',
      'haste',
      'strike-open',
      'strike-snap',
      'turn',
    ];
    for (let i = 0; i < phases.length; i++) {
      advance(
        f,
        (f, n) => {
          const u = f.unit;
          u.state = phases[n].startsWith('strike') ? 'attacking' : 'walking';
          u.pace = u.beat = phases[n] === 'haste' ? 1.35 : 1;
          u.facing = phases[n] === 'turn' ? Math.PI : 0;
          if (u.state === 'walking') u.y += f.stats.speed * u.pace * dt;
          if (u.state === 'attacking') {
            u.sinceHit = phases[n] === 'strike-snap' ? 0 : 0.22;
            u.attackTimer = f.stats.hitSpeed * 0.7;
          }
        },
        i,
      );
      frame(f, [], 0.9);
      renderer.flush();
      const bounds = new THREE.Box3();
      for (const mesh of meshes) {
        const positions = posedPositions(mesh);
        for (const j of activeVertexIndices(mesh.geometry))
          bounds.expandByPoint(point.fromArray(positions, j * 3));
      }
      const primitives = skins.map((mesh, n) => {
        const after = localPositions(mesh);
        let movedVertices = 0,
          maximumDisplacement = 0;
        for (let j = 0; j < after.length; j += 3) {
          const delta = Math.hypot(
            after[j] - before[n][j],
            after[j + 1] - before[n][j + 1],
            after[j + 2] - before[n][j + 2],
          );
          if (delta > 1e-6) movedVertices++;
          maximumDisplacement = Math.max(maximumDisplacement, delta);
        }
        return { mesh: mesh.name, movedVertices, maximumDisplacement };
      });
      samples.push({
        phase: phases[i],
        state: f.unit.state,
        sinceHit: f.unit.sinceHit,
        bounds: { min: bounds.min.toArray(), max: bounds.max.toArray() },
        primitives,
        joints: Object.fromEntries(
          Object.entries(f.kit.rig).map(([name, joint]) => [
            name,
            joint.node.rotation.toArray().slice(0, 3),
          ]),
        ),
      });
    }
    results[card] = {
      frames: phases.length,
      method:
        'six actual native free-motion updates; whole mesh bounds and skin deformation in model-local space; this short source interface check is not full-cycle or contact acceptance',
      samples,
    };
    release(f);
  }
  return results;
}

function boundsAudit() {
  renderer.setScale(scales.portrait);
  const result = {};
  const point = new THREE.Vector3();
  for (const card of cards) {
    const phases = [];
    for (const [motion, pace, frames] of [
      ['attacking', 1, 300],
      ['attacking', 1.35, 300],
      ['attacking', 1.75, 300],
      ['idle', 1, 120],
      ['deployment', 1, 90],
      ['walking', 1, 360],
      ['walking', 1.35, 360],
      ['walking', 1.75, 360],
      ['turn', 1, 240],
    ]) {
      if (
        options['bounds-pattern'] &&
        !new RegExp(options['bounds-pattern']).test(`${motion}-${pace}`)
      )
        continue;
      const f = fixture(card);
      const meshes = [];
      f.kit.model.traverse((mesh) => {
        if (mesh.isMesh) meshes.push(mesh);
      });
      const dimensions = {
        front: 0,
        rear: 0,
        across: 0,
        highest: -Infinity,
        lowest: Infinity,
        capsuleExcess: 0,
        requiredFrontAxis: 0,
        requiredRearAxis: 0,
        uncoveredLateral: 0,
      };
      const subsets = Object.fromEntries(
        ['feet', 'torso', 'head'].map((name) => [
          name,
          {
            front: 0,
            rear: 0,
            across: 0,
            highest: -Infinity,
            lowest: Infinity,
          },
        ]),
      );
      const surfaces = {
        feet: ['L', 'R'].flatMap((side) =>
          r.figureSurfaces(f.kit.model, card, `foot${side}`),
        ),
        torso: r.figureSurfaces(f.kit.model, card, 'torso'),
        head: r.figureSurfaces(f.kit.model, card, 'head'),
      };
      const masks = new Map();
      for (const [name, pieces] of Object.entries(surfaces))
        for (const { mesh, indices } of pieces) {
          if (!masks.has(mesh)) masks.set(mesh, new Map());
          masks.get(mesh).set(name, indices ? new Set(indices) : null);
        }
      const cpuStart = process.threadCpuUsage();
      const measure = (dimensions, point, cx, cz, hx, hy) => {
        const dx = point.x - cx,
          dz = point.z - cz;
        const along = dx * hx - dz * hy,
          across = dx * hy + dz * hx;
        dimensions.front = Math.max(dimensions.front, along);
        dimensions.rear = Math.max(dimensions.rear, -along);
        dimensions.across = Math.max(dimensions.across, Math.abs(across));
        dimensions.highest = Math.max(dimensions.highest, point.y);
        dimensions.lowest = Math.min(dimensions.lowest, point.y);
        if ('capsuleExcess' in dimensions) {
          const profile = r.dinoBuildingFootprint;
          const centre = Math.max(
            -profile.rear,
            Math.min(profile.front, along),
          );
          const bodyGap = Math.hypot(dx, dz) - r.troopBuildingRadius(card);
          const capsuleGap =
            Math.hypot(along - centre, across) - profile.radius;
          const excess = Math.min(bodyGap, capsuleGap);
          if (excess > dimensions.capsuleExcess) {
            dimensions.capsuleExcess = excess;
            dimensions.worstCapsuleVertex = {
              along,
              across,
              height: point.y,
              position: point.toArray(),
              bodyGap,
              capsuleGap,
            };
          }
          if (bodyGap > 0) {
            if (Math.abs(across) > profile.radius)
              dimensions.uncoveredLateral = Math.max(
                dimensions.uncoveredLateral,
                Math.abs(across) - profile.radius,
              );
            else {
              const cap = Math.sqrt(profile.radius ** 2 - across ** 2);
              dimensions.requiredFrontAxis = Math.max(
                dimensions.requiredFrontAxis,
                along - cap,
              );
              dimensions.requiredRearAxis = Math.max(
                dimensions.requiredRearAxis,
                -along - cap,
              );
            }
          }
        }
      };
      for (let i = 0; i < frames; i++) {
        advance(
          f,
          (f, i) => {
            const u = f.unit;
            u.state =
              motion === 'turn'
                ? 'walking'
                : motion === 'deployment'
                  ? 'deploying'
                  : motion;
            u.pace = u.beat = pace;
            u.facing = motion === 'turn' ? Math.min(i / 60, 1) * Math.PI : 0;
            if (motion === 'walking' || motion === 'turn')
              u.y += f.stats.speed * pace * dt;
            if (motion === 'deployment')
              u.deployLeft = Math.max(0, 0.6 - i * dt);
          },
          i,
        );
        frame(f, [], 0.9);
        renderer.flush();
        const cx = f.unit.x - 9,
          cz = 16 - f.unit.y;
        const yaw = f.view.facing ?? -f.unit.facing;
        const hx = -Math.sin(yaw),
          hy = Math.cos(yaw);
        for (const mesh of meshes) {
          const positions = posedPositions(mesh);
          for (const index of activeVertexIndices(mesh.geometry)) {
            point.fromArray(positions, index * 3);
            measure(dimensions, point, cx, cz, hx, hy);
            for (const [name, indices] of masks.get(mesh) ?? [])
              if (!indices || indices.has(index))
                measure(subsets[name], point, cx, cz, hx, hy);
          }
        }
      }
      const cpu = process.threadCpuUsage(cpuStart);
      phases.push({
        motion,
        pace,
        frames,
        dimensions,
        subsets,
        diagnosticCpuMs: (cpu.user + cpu.system) / 1000,
      });
      release(f);
      evidence.fullNativeBounds ??= {};
      evidence.fullNativeBounds[card] = { phases };
      save();
      console.log(
        `BOUNDS ${card} ${motion} ${pace}: front${dimensions.front.toFixed(4)} rear${dimensions.rear.toFixed(4)} across${dimensions.across.toFixed(4)} capsuleExcess${dimensions.capsuleExcess.toFixed(4)}`,
      );
    }
    result[card] = {
      phases,
      method:
        'every actual posed active vertex and skin-weight anatomical subset over complete native free-motion cycles at largest portrait scale; measured relative to actual rendered facing; head/tail/limbs included, no additional art scale',
    };
    console.log(
      `BOUNDS ${card}: ${JSON.stringify(phases.map((x) => ({ motion: x.motion, pace: x.pace, ...x.dimensions })))}`,
    );
  }
  return result;
}

async function cpuAudit() {
  const samples = Number(options.samples ?? 800),
    warmup = Number(options.warmup ?? 200);
  const results = {};
  renderer.setScale(scales.portrait);
  const tower = {
    id: 1,
    kind: 'king',
    side: 1,
    x: 9,
    y: 22,
    hp: 1000,
    maxHp: 1000,
    destroyed: false,
  };
  const bench = (label, fixtures, motion, buildings) => {
    const times = [],
      cpuTimes = [];
    for (let i = 0; i < warmup + samples; i++) {
      for (let n = 0; n < fixtures.length; n++)
        advance(fixtures[n], motion[n], i);
      const start = performance.now();
      const cpuStart = process.threadCpuUsage();
      for (const f of fixtures) frame(f, buildings, 0.9);
      renderer.flush();
      const cpu = process.threadCpuUsage(cpuStart);
      const elapsed = performance.now() - start;
      if (i >= warmup) {
        times.push(elapsed);
        cpuTimes.push((cpu.user + cpu.system) / 1000);
      }
    }
    results[label] = summarizeTimes(times, fixtures.length);
    results[label].mainThreadCpu = summarizeTimes(cpuTimes, fixtures.length);
    for (const f of fixtures) release(f);
    console.log(
      `CPU ${label}: ${results[label].mainThreadCpu.meanMsPerFrame.toFixed(3)} ms CPU, ${results[label].meanMsPerFrame.toFixed(3)} ms elapsed/frame (${fixtures.length} units)`,
    );
  };
  for (const card of cards)
    for (const contact of [false, true]) {
      const f = fixture(card);
      if (contact) contactPosition(f, tower, 0, 0.3);
      else {
        f.unit.x = 1;
        f.unit.y = 4;
      }
      const motion = contact
        ? contactMotion('attack')
        : (f, i) => {
            f.unit.state = i % 360 < 240 ? 'walking' : 'attacking';
            if (f.unit.state === 'walking') {
              f.unit.facing = Math.floor(i / 120) % 2 ? Math.PI : 0;
              f.unit.y +=
                (Math.floor(i / 120) % 2 ? -1 : 1) * f.stats.speed * dt;
            }
          };
      bench(
        `${card}-${contact ? 'near-wall' : 'free'}`,
        [f],
        [motion],
        contact ? [tower] : [],
      );
    }
  for (const card of cards) {
    const f = fixture(card);
    contactPosition(f, tower, 0, 0.002, [0, 1]);
    const y = f.unit.y;
    bench(
      `${card}-near-wall-walk-haste`,
      [f],
      [
        (f, i) => {
          const phase = i * f.stats.speed * 1.35 * dt;
          f.unit.state = 'walking';
          f.unit.pace = f.unit.beat = 1.35;
          f.unit.y = y + Math.sin(phase);
          f.unit.facing = 0;
        },
      ],
      [tower],
    );
  }
  const dense = [],
    motion = [];
  for (const card of cards) {
    const count = card === 'sumo' ? 8 : card === 'ogre' ? 4 : 2;
    for (let i = 0; i < count; i++) {
      const f = fixture(card, i % 2);
      if (i % 2) {
        contactPosition(f, tower, ((i % 4) * Math.PI) / 2, 0.3);
        motion.push(
          contactMotion('attack', ((i % 4) * Math.PI) / 2, i % 3 ? 1 : 1.35),
        );
      } else {
        f.unit.x = 2 + (i % 3) * 4;
        f.unit.y = 4;
        motion.push((f, frame) => {
          f.unit.state = 'walking';
          f.unit.facing = Math.floor(frame / 120) % 2 ? Math.PI : 0;
          f.unit.y +=
            (Math.floor(frame / 120) % 2 ? -1 : 1) * f.stats.speed * dt;
        });
      }
      dense.push(f);
    }
  }
  bench('mixed-density', dense, motion, [tower]);
  return results;
}

function contactCases() {
  const suite = options.suite ?? 'standard';
  if (suite === 'smoke')
    return [
      {
        name: 'preserved-coping-regression',
        motion: 'attack',
        kind: 'king',
        scale: 'portrait',
        angle: 0,
        pace: 1,
        standOff: 0.27,
        legacy: true,
      },
    ];
  const cases = [];
  for (const kind of ['princess', 'king'])
    for (const scale of ['portrait', 'landscape']) {
      for (const [motion, angle, standOff, pace] of [
        ['attack', -Math.PI / 2, 0.3, 1],
        ['attack', (-3 * Math.PI) / 4, 0.002, 1.35],
        ['back-attack', Math.PI / 2, 0.002, 1.75],
      ])
        cases.push({
          name: `${motion}-${kind}-${scale}-${angle.toFixed(3)}-${pace}`,
          motion,
          kind,
          scale,
          angle,
          pace,
          standOff,
        });
      for (const [motion, angle, pace, frames] of [
        ['natural-attack', -Math.PI / 2, 1, 360],
        ['natural-deployment', 0, 1, 1200],
        ['natural-turn', 0, 1.75, 1200],
        ['natural-passing', 0, 1.35, 1200],
      ])
        cases.push({
          name: `${motion}-${kind}-${scale}-${pace}`,
          motion,
          kind,
          scale,
          angle,
          pace,
          standOff: 0.002,
          frames,
        });
      cases.push({
        name: `natural-side-deployment-${kind}-${scale}-1`,
        motion: 'natural-side-deployment',
        kind,
        scale,
        angle: 0,
        pace: 1,
        standOff: 0.002,
        frames: 180,
        cards: ['sumo'],
      });
    }
  if (suite === 'full')
    for (const kind of ['princess', 'king'])
      for (const scale of ['portrait', 'landscape'])
        for (const motion of ['attack', 'back-attack', 'natural-attack'])
          for (const angle of [0, Math.PI / 4, Math.PI / 2, (5 * Math.PI) / 4])
            for (const pace of [1, 1.35, 1.75])
              cases.push({
                name: `expanded-${motion}-${kind}-${scale}-${angle.toFixed(3)}-${pace}`,
                motion,
                kind,
                scale,
                angle,
                pace,
                standOff: motion === 'attack' ? 0.3 : 0.002,
              });
  cases.push({
    name: 'legacy-illegal-rear-drop-negative-control',
    motion: 'legacy-deployment',
    kind: 'king',
    scale: 'portrait',
    angle: Math.PI / 2,
    pace: 1,
    standOff: 0.002,
    frames: 1,
    expectedFailure: true,
    cards: ['ogre'],
  });
  return options['case-filter']
    ? cases.filter((spec) => new RegExp(options['case-filter']).test(spec.name))
    : cases;
}

function naturalFixture(card, spec) {
  const match = r.createMatch(73);
  match.phase = 'battle';
  match.time = 0;
  for (const tower of match.towers) {
    tower.active = false;
    tower.damage = 0;
    tower.hp = tower.maxHp = 1e9;
  }
  let building, requested;
  if (spec.motion === 'natural-attack') {
    building = match.towers.find((t) => t.side === 1 && t.kind === spec.kind);
    Object.assign(building, { x: 9, y: 26 });
    match.towers = [building];
    requested = [
      building.x + Math.cos(spec.angle) * 6.5,
      building.y + Math.sin(spec.angle) * 6.5,
    ];
  } else {
    building = match.towers.find((t) => t.side === 0 && t.kind === spec.kind);
    const half = r.towerFootprint[spec.kind].half;
    requested =
      spec.motion === 'natural-deployment'
        ? [building.x, building.y + half + r.troopBuildingRadius(card) + 0.002]
        : spec.motion === 'natural-passing'
          ? [building.x, building.y - half - r.troopBuildingRadius(card) - 0.1]
          : [
              building.x + half + r.troopBuildingRadius(card) + 0.02,
              building.y,
            ];
  }
  const direction = [0, 1];
  const legal = r.projectTroopBuildings(
    match.towers,
    card,
    ...requested,
    direction,
    0.002,
  );
  const unit = r.summon(match, 0, card, ...legal);
  unit.pace = spec.pace;
  if (!spec.motion.includes('deployment')) {
    unit.deployLeft = 0;
    unit.state = 'walking';
  }
  const f = fixture(card, 0, unit);
  f.match = match;
  f.building = building;
  f.placement = { requested, legal, direction };
  f.initialSnapshot = JSON.parse(JSON.stringify(match));
  return f;
}

async function contactAudit() {
  const results = [];
  const solidsCache = new Map();
  for (const card of cards)
    for (const spec of contactCases()) {
      if (spec.cards && !spec.cards.includes(card)) continue;
      const frameCount = Number(
        options.frames ?? spec.frames ?? (options.suite === 'smoke' ? 91 : 240),
      );
      renderer.setScale(scales[spec.scale]);
      const natural = spec.motion.startsWith('natural-');
      const f = natural ? naturalFixture(card, spec) : fixture(card);
      const building = natural
        ? f.building
        : {
            id: 1,
            kind: spec.kind,
            side: spec.expectedFailure ? 0 : 1,
            x: 9,
            y: spec.expectedFailure || spec.legacy ? 16 : 22,
            hp: 1000,
            maxHp: 1000,
            destroyed: false,
          };
      const buildings = natural ? f.match.towers : [building];
      const stoneScale = spec.scale === 'portrait' ? 0.9 : 0.85;
      const solids = buildings.flatMap((t) => {
        const key = `${t.id}:${t.kind}:${stoneScale}:${t.side}:${t.x}:${t.y}`;
        if (!solidsCache.has(key))
          solidsCache.set(
            key,
            towerSolids(towers, t.kind, stoneScale, t.side, [
              t.x - 9,
              0,
              16 - t.y,
            ]),
          );
        return solidsCache.get(key);
      });
      const direction =
        spec.motion === 'back-attack' || spec.expectedFailure
          ? [Math.cos(spec.angle), Math.sin(spec.angle)]
          : [-Math.cos(spec.angle), -Math.sin(spec.angle)];
      const placed = natural
        ? f.placement
        : contactPosition(
            f,
            building,
            spec.angle,
            spec.standOff,
            direction,
            spec.expectedFailure || spec.legacy,
          );
      const motion = natural
        ? null
        : contactMotion(
            spec.expectedFailure ? 'deployment' : spec.motion,
            spec.angle,
            spec.pace,
          );
      const configure = (f, i) => {
        motion(f, i);
        if (spec.name === 'preserved-coping-regression' && i < 20)
          f.unit.state = 'walking';
      };
      const metrics = {
        card,
        ...spec,
        frames: frameCount,
        figureScale: renderer.scale,
        stoneScale,
        placement: placed,
        initialSnapshot: f.initialSnapshot,
        trajectory: [],
        minimumAuthoritativeHullGap: Infinity,
        minimumRenderedHullGap: Infinity,
        maximumOrdinaryStep: 0,
        maximumArmJointStep: 0,
        stonePieces: solids.length,
        stoneTopology: solids.map((solid) => ({
          name: solid.name,
          ...solid.topology,
        })),
        containedVertices: 0,
        edgePenetrations: 0,
        surfaceCrossings: 0,
        openDetailCrossings: 0,
        deepestGap: 0,
        minimumSignedVertexGapCapped: 0.25,
        maximumHeadHeight: -Infinity,
        minimumHeadBarClearance: Infinity,
        lowestGroundVertex: Infinity,
        maximumRearExtent: 0,
        contacts: [],
        byPart: {},
      };
      const meshes = [];
      f.kit.model.traverse((mesh) => {
        if (mesh.isMesh) meshes.push(mesh);
      });
      const point = new THREE.Vector3();
      let previousArms;
      for (let i = 0; i < frameCount; i++) {
        if (natural) {
          if (i % 2 === 0) {
            const oldX = f.unit.x,
              oldY = f.unit.y;
            r.step(f.match);
            f.match.events.length = 0;
            metrics.maximumOrdinaryStep = Math.max(
              metrics.maximumOrdinaryStep,
              Math.hypot(f.unit.x - oldX, f.unit.y - oldY),
            );
          }
          f.time += dt;
          frame(f, buildings, stoneScale, (i % 2) / 2);
        } else {
          advance(f, configure, i);
          frame(f, buildings, stoneScale);
        }
        renderer.flush();
        const armPose = ['armL', 'armR', 'foreL', 'foreR'].flatMap((part) => {
          const joint = f.kit.rig[part];
          return joint
            ? [
                joint.node.rotation.x,
                joint.node.rotation.y,
                joint.node.rotation.z,
              ]
            : [];
        });
        if (previousArms)
          for (let j = 0; j < armPose.length; j++) {
            let delta = armPose[j] - previousArms[j];
            while (delta > Math.PI) delta -= Math.PI * 2;
            while (delta < -Math.PI) delta += Math.PI * 2;
            if (Math.abs(delta) > metrics.maximumArmJointStep) {
              metrics.maximumArmJointStep = Math.abs(delta);
              metrics.worstArmStep = {
                frame: i,
                part: ['armL', 'armR', 'foreL', 'foreR'][Math.floor(j / 3)],
                axis: ['x', 'y', 'z'][j % 3],
                before: previousArms[j],
                after: armPose[j],
                state: f.unit.state,
                centre: [f.unit.x, f.unit.y],
              };
            }
          }
        else metrics.initialArmPose = armPose;
        previousArms = armPose;
        const renderedX = f.unit.px + (f.unit.x - f.unit.px) * f.alpha;
        const renderedY = f.unit.py + (f.unit.y - f.unit.py) * f.alpha;
        const yaw = f.view.facing ?? -f.unit.facing;
        const renderedDirection = [-Math.sin(yaw), Math.cos(yaw)];
        for (const t of buildings) {
          metrics.minimumAuthoritativeHullGap = Math.min(
            metrics.minimumAuthoritativeHullGap,
            r.troopTowerGap(
              t,
              card,
              f.unit.x,
              f.unit.y,
              r.unitBodyDirection(f.unit),
            ),
          );
          metrics.minimumRenderedHullGap = Math.min(
            metrics.minimumRenderedHullGap,
            r.troopTowerGap(t, card, renderedX, renderedY, renderedDirection),
          );
        }
        if (i % 10 === 0 || i === frameCount - 1)
          metrics.trajectory.push({
            frame: i,
            tick: f.match?.tick,
            state: f.unit.state,
            centre: [f.unit.x, f.unit.y],
            alpha: f.alpha,
            bodyDirection: f.unit.bodyDirection,
            renderedDirection,
          });
        for (const mesh of meshes) {
          const measured = auditMesh(mesh, solids, {
            edgePass: !options['vertices-only'],
          });
          metrics.containedVertices += measured.containedVertices;
          metrics.edgePenetrations += measured.edgePenetrations;
          metrics.surfaceCrossings += measured.surfaceCrossings;
          metrics.openDetailCrossings += measured.openDetailCrossings;
          metrics.deepestGap = Math.min(
            metrics.deepestGap,
            measured.deepestGap,
          );
          metrics.minimumSignedVertexGapCapped = Math.min(
            metrics.minimumSignedVertexGapCapped,
            measured.minimumSignedVertexGapCapped,
          );
          if (
            measured.worst &&
            (!metrics.worstContact ||
              measured.worst.gap < metrics.worstContact.gap)
          )
            metrics.worstContact = {
              frame: i,
              state: f.unit.state,
              enginePosition: [f.unit.x, f.unit.y],
              ...measured.worst,
            };
          if (
            measured.containedVertices ||
            measured.edgePenetrations ||
            measured.surfaceCrossings
          ) {
            const part = (metrics.byPart[mesh.name] ??= {
              containedVertices: 0,
              edgePenetrations: 0,
              surfaceCrossings: 0,
              deepestGap: 0,
              firstFrame: i,
            });
            for (const key of [
              'containedVertices',
              'edgePenetrations',
              'surfaceCrossings',
            ])
              part[key] += measured[key];
            part.deepestGap = Math.min(part.deepestGap, measured.deepestGap);
            for (const contact of measured.contacts)
              if (metrics.contacts.length < 24)
                metrics.contacts.push({
                  frame: i,
                  state: f.unit.state,
                  enginePosition: [f.unit.x, f.unit.y],
                  ...contact,
                });
          }
          for (const j of measured.vertexIndices) {
            point.fromArray(measured.positions, j * 3);
            metrics.lowestGroundVertex = Math.min(
              metrics.lowestGroundVertex,
              point.y,
            );
            const centreX = renderedX - 9,
              centreZ = 16 - renderedY;
            metrics.maximumRearExtent = Math.max(
              metrics.maximumRearExtent,
              -(point.x - centreX) * renderedDirection[0] +
                (point.z - centreZ) * renderedDirection[1],
            );
          }
        }
        for (const surface of r.figureSurfaces(f.kit.model, card, 'head')) {
          const { mesh, indices } = surface;
          const count =
            indices?.length ?? mesh.geometry.attributes.position.count;
          for (let j = 0; j < count; j++) {
            mesh
              .getVertexPosition(indices?.[j] ?? j, point)
              .applyMatrix4(mesh.matrixWorld);
            metrics.maximumHeadHeight = Math.max(
              metrics.maximumHeadHeight,
              point.y,
            );
            metrics.minimumHeadBarClearance = Math.min(
              metrics.minimumHeadBarClearance,
              f.view.statusAnchor.y - point.y,
            );
          }
        }
      }
      release(f);
      results.push(metrics);
      evidence.contacts = results;
      save();
      console.log(
        `CONTACT ${card} ${spec.name}: ${metrics.containedVertices} contained vertices, ${metrics.edgePenetrations} edge interiors, ${metrics.surfaceCrossings} reverse crossings, minimum ${metrics.deepestGap.toFixed(6)}`,
      );
    }
  return results;
}

const evidence = {
  generatedAt: new Date().toISOString(),
  host: {
    platform: os.platform(),
    arch: os.arch(),
    node: process.version,
    cpu: os.cpus()[0]?.model,
    cpuCount: os.cpus().length,
    loadAverageAtStart: os.loadavg(),
  },
  assets,
  extraScale,
  viewportFigureScale: scales,
  rendererSetupMs: setupMs,
  method: {
    runtime:
      'current native ESM renderer/library/clone/animator/IK/contact; only flat-ground standHeight and canvas texture construction substitute browser/GPU',
    cpu: 'warm native TroopView.update for all units plus renderer.flush; elapsed and process.threadCpuUsage measured separately to expose scheduler contention; excludes fixture advance, parsing, setup and contact audit; desktop CPU only, no mobile/GPU claim',
    contact: options['vertices-only']
      ? 'PRELIMINARY RAW-MASTER VERTEX-ONLY PROBE: all referenced posed vertices versus sealed shipped stone; omitted triangle-edge crossings, not final acceptance'
      : 'all referenced posed mesh vertices using getVertexPosition, every 60 Hz frame plus bidirectional triangle-edge intersections with all retained shipped stone/detail triangles; sealed shapes use signed winding intersections, open decals have surface crossing checks; boundary tolerance 0.000001 tile; positive vertex clearance capped at .25',
    limits:
      'discrete 60 Hz poses do not prove continuous-time swept clearance; shader-only wind/cloth displacement and live cannon/archer rigs are outside the retained stone audit',
  },
  sanity: checks,
  runtimeSourceHashes: Object.fromEntries(
    [...runtimeSources].map(([file, source]) => [file, sha(source)]),
  ),
  inventory: Object.fromEntries(cards.map((card) => [card, inventory(card)])),
  skinRuntimeProbes: Object.fromEntries(
    cards.map((card) => [card, skinProbe(card)]),
  ),
};
const out = path.resolve(
  root,
  options.out ?? 'work/arena/2026-10-04-contact/export-audit-evidence.json',
);
fs.mkdirSync(path.dirname(out), { recursive: true });
function save() {
  fs.writeFileSync(out, JSON.stringify(evidence, null, 2) + '\n');
}
try {
  save();
  const mode = options.mode ?? 'all';
  if (mode === 'all' || mode === 'pose') {
    evidence.shortNativePoses = poseAudit();
    save();
  }
  if (mode === 'all' || mode === 'bounds') {
    evidence.fullNativeBounds = boundsAudit();
    save();
  }
  if (mode === 'all' || mode === 'cpu') {
    evidence.cpu = await cpuAudit();
    save();
  }
  if (mode === 'all' || mode === 'contacts') {
    evidence.contacts = await contactAudit();
    save();
  }
  evidence.host.loadAverageAtEnd = os.loadavg();
  save();
  console.log(`Evidence saved ${out}`);
} finally {
  renderer.dispose();
  Math.random = savedRandom;
}
