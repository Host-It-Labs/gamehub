/**
 * Replace figure roots in the shipped Arena figures bundle with separately
 * built and reviewed ones, keeping every other root byte-identical (checked
 * by canonical root hashes), and optionally install the result.
 *
 *   node scripts/arena-merge-figures.mjs --base public/3d/arena/models/figures-<hash>.glb \
 *     --replace bee=public/3d/arena/dev/bee-v3.glb [--replace id=path ...] \
 *     (--out merged.glb | --install)
 *
 * `--install` writes public/3d/arena/models/figures-<sha8>.glb and points
 * lib/games/arena/assets.json at it (the previous bundle stays on disk).
 * Each replacement GLB must contain a root named after its id (a
 * single-figure collector build: ARENA_FIGURES=<id> ... figures.py -- out.glb).
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const argv = process.argv.slice(2);
const flag = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const replaceArgs = argv.flatMap((value, i) =>
  argv[i - 1] === '--replace' ? [value] : [],
);
const install = argv.includes('--install');
const args = { base: flag('base') && resolve(flag('base')) };
assert.ok(args.base, 'Missing --base');
assert.ok(replaceArgs.length, 'Missing --replace id=path');
assert.ok(install || flag('out'), 'Missing --out or --install');
const replacePaths = Object.fromEntries(
  replaceArgs.map((pair) => {
    const [id, path] = pair.split('=');
    assert.ok(id && path, `Bad --replace ${pair}`);
    return [id, resolve(path)];
  }),
);
args.out = install ? resolve('work/arena/figures-merge-candidate.glb') : resolve(flag('out'));

function glb(file) {
  const bytes = readFileSync(file);
  assert.equal(bytes.readUInt32LE(0), 0x46546c67);
  assert.equal(bytes.readUInt32LE(4), 2);
  const jsonLength = bytes.readUInt32LE(12);
  const json = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString());
  const binary = bytes.subarray(28 + jsonLength);
  assert.deepEqual(
    Object.keys(json).filter((key) => !['asset', 'extensionsUsed', 'extensionsRequired', 'scene', 'scenes', 'nodes', 'meshes', 'materials', 'accessors', 'bufferViews', 'buffers', 'skins'].includes(key)),
    [],
    'This merger handles the texture-free Arena figure contract, including skinning',
  );
  assert.equal(json.buffers.length, 1);
  return { json, binary };
}

const original = glb(args.base);
const replacements = Object.fromEntries(
  Object.entries(replacePaths).map(([id, path]) => [id, glb(path)]),
);
const out = {
  asset: structuredClone(original.json.asset),
  extensionsUsed: [...new Set([original, ...Object.values(replacements)].flatMap((model) => model.json.extensionsUsed ?? []))],
  scene: 0,
  scenes: [{ nodes: [] }],
  nodes: [],
  materials: [],
  meshes: [],
  skins: [],
  accessors: [],
  bufferViews: [],
  buffers: [],
};
const binaryParts = [];
let binaryLength = 0;
const maps = new Map();
const materials = new Map();

function copy(model, section, oldIndex) {
  let map = maps.get(model);
  if (!map) maps.set(model, (map = {}));
  map[section] ??= new Map();
  if (map[section].has(oldIndex)) return map[section].get(oldIndex);
  const value = structuredClone(model.json[section][oldIndex]);
  const index = out[section].length;
  map[section].set(oldIndex, index);
  out[section].push(value);
  if (section === 'nodes') {
    if (value.skin !== undefined) value.skin = copy(model, 'skins', value.skin);
    if (value.children) value.children = value.children.map((n) => copy(model, 'nodes', n));
    if (value.mesh !== undefined) value.mesh = copy(model, 'meshes', value.mesh);
  } else if (section === 'skins') {
    value.joints = value.joints.map((node) => copy(model, 'nodes', node));
    if (value.skeleton !== undefined) value.skeleton = copy(model, 'nodes', value.skeleton);
    if (value.inverseBindMatrices !== undefined)
      value.inverseBindMatrices = copy(model, 'accessors', value.inverseBindMatrices);
  } else if (section === 'meshes') {
    for (const primitive of value.primitives) {
      assert.equal(primitive.extensions, undefined);
      for (const key of Object.keys(primitive.attributes)) primitive.attributes[key] = copy(model, 'accessors', primitive.attributes[key]);
      if (primitive.indices !== undefined) primitive.indices = copy(model, 'accessors', primitive.indices);
      if (primitive.material !== undefined) primitive.material = copy(model, 'materials', primitive.material);
      for (const target of primitive.targets ?? []) for (const key of Object.keys(target)) target[key] = copy(model, 'accessors', target[key]);
    }
  } else if (section === 'accessors') {
    if (value.bufferView !== undefined) value.bufferView = copy(model, 'bufferViews', value.bufferView);
    if (value.sparse) {
      value.sparse.indices.bufferView = copy(model, 'bufferViews', value.sparse.indices.bufferView);
      value.sparse.values.bufferView = copy(model, 'bufferViews', value.sparse.values.bufferView);
    }
  } else if (section === 'bufferViews') {
    assert.equal(value.buffer, 0);
    const data = model.binary.subarray(value.byteOffset ?? 0, (value.byteOffset ?? 0) + value.byteLength);
    assert.equal(data.length, value.byteLength);
    const padding = (4 - (binaryLength % 4)) % 4;
    if (padding) binaryParts.push(Buffer.alloc(padding));
    binaryLength += padding;
    value.byteOffset = binaryLength;
    binaryParts.push(data);
    binaryLength += data.length;
  } else if (section === 'materials') {
    const key = JSON.stringify(value);
    if (materials.has(key)) {
      out[section].pop();
      const shared = materials.get(key);
      map[section].set(oldIndex, shared);
      return shared;
    }
    materials.set(key, index);
  }
  return index;
}

for (const oldRoot of original.json.scenes[original.json.scene ?? 0].nodes) {
  const name = original.json.nodes[oldRoot].name;
  const replacement = replacements[name];
  const source = replacement ?? original;
  const sourceRoot = replacement ? source.json.scenes[source.json.scene ?? 0].nodes.find((i) => source.json.nodes[i].name === name) : oldRoot;
  assert.notEqual(sourceRoot, undefined, name);
  out.scenes[0].nodes.push(copy(source, 'nodes', sourceRoot));
}

out.buffers = [{ byteLength: binaryLength }];
const binaryPadding = (4 - (binaryLength % 4)) % 4;
if (binaryPadding) binaryParts.push(Buffer.alloc(binaryPadding));
const binary = Buffer.concat(binaryParts);
if (!out.skins.length) delete out.skins;
const jsonData = Buffer.from(JSON.stringify(out));
const json = Buffer.concat([jsonData, Buffer.alloc((4 - (jsonData.length % 4)) % 4, 0x20)]);
const header = Buffer.alloc(20);
header.writeUInt32LE(0x46546c67, 0);
header.writeUInt32LE(2, 4);
header.writeUInt32LE(28 + json.length + binary.length, 8);
header.writeUInt32LE(json.length, 12);
header.writeUInt32LE(0x4e4f534a, 16);
const binaryHeader = Buffer.alloc(8);
binaryHeader.writeUInt32LE(binary.length, 0);
binaryHeader.writeUInt32LE(0x004e4942, 4);
const merged = Buffer.concat([header, json, binaryHeader, binary]);
writeFileSync(args.out, merged);

// Hash a canonical root including every transform, material, accessor contract
// and raw vertex/index buffer. Index renumbering and binary packing are ignored.
function rootHash(model, root) {
  const hash = createHash('sha256');
  function accessor(index) {
    const value = structuredClone(model.json.accessors[index]);
    const view = model.json.bufferViews[value.bufferView];
    delete value.bufferView;
    hash.update(JSON.stringify(value));
    const meta = { ...view };
    delete meta.byteOffset;
    delete meta.buffer;
    hash.update(JSON.stringify(meta));
    hash.update(model.binary.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength));
  }
  function node(index) {
    const value = structuredClone(model.json.nodes[index]);
    const children = value.children ?? [];
    const mesh = value.mesh === undefined ? undefined : model.json.meshes[value.mesh];
    delete value.children;
    delete value.mesh;
    if (value.skin !== undefined) {
      const skin = structuredClone(model.json.skins[value.skin]);
      skin.joints = skin.joints.map((joint) => model.json.nodes[joint].name);
      if (skin.skeleton !== undefined) skin.skeleton = model.json.nodes[skin.skeleton].name;
      const bind = skin.inverseBindMatrices;
      delete skin.inverseBindMatrices;
      value.skin = skin;
      if (bind !== undefined) accessor(bind);
    }
    hash.update(JSON.stringify(value));
    if (mesh) {
      hash.update(JSON.stringify({ ...mesh, primitives: undefined }));
      for (const primitive of mesh.primitives) {
        hash.update(JSON.stringify({ ...primitive, attributes: undefined, indices: undefined, material: undefined }));
        hash.update(JSON.stringify(model.json.materials[primitive.material]));
        for (const key of Object.keys(primitive.attributes)) { hash.update(key); accessor(primitive.attributes[key]); }
        if (primitive.indices !== undefined) accessor(primitive.indices);
      }
    }
    for (const child of children) node(child);
  }
  node(root);
  return hash.digest('hex');
}

const packed = glb(args.out);
const unchanged = [];
for (const oldRoot of original.json.scenes[original.json.scene ?? 0].nodes) {
  const name = original.json.nodes[oldRoot].name;
  if (replacements[name]) continue;
  const newRoot = packed.json.scenes[packed.json.scene ?? 0].nodes.find((i) => packed.json.nodes[i].name === name);
  assert.equal(rootHash(original, oldRoot), rootHash(packed, newRoot), `${name} was preserved exactly`);
  unchanged.push(name);
}
const replaced = {};
for (const [name, source] of Object.entries(replacements)) {
  const find = (model) => model.json.scenes[model.json.scene ?? 0].nodes.find((i) => model.json.nodes[i].name === name);
  assert.equal(rootHash(source, find(source)), rootHash(packed, find(packed)), `${name} matches its reviewed standalone source`);
  replaced[name] = rootHash(packed, find(packed));
}
const evidence = {
  originalBytes: readFileSync(args.base).length,
  mergedBytes: merged.length,
  sha256: createHash('sha256').update(merged).digest('hex'),
  replaced,
  unchangedRootHashes: Object.fromEntries(unchanged.map((name) => {
    const index = packed.json.scenes[packed.json.scene ?? 0].nodes.find((i) => packed.json.nodes[i].name === name);
    return [name, rootHash(packed, index)];
  })),
  skins: packed.json.skins?.length ?? 0,
  sources: { ...args, replace: replacePaths },
  unchanged,
  validation: 'All unchanged root transforms, materials, accessor contracts and raw geometry/index/AO buffers and skin joints/weights/bind matrices are byte-identical; each replaced root matches its reviewed standalone source.',
};
writeFileSync(`${args.out}.evidence.json`, JSON.stringify(evidence, null, 2) + '\n');
console.log(JSON.stringify(evidence, null, 2));

if (install) {
  const { renameSync, existsSync } = await import('node:fs');
  const name = `figures-${evidence.sha256.slice(0, 8)}.glb`;
  const target = resolve('public/3d/arena/models', name);
  if (!existsSync(target)) renameSync(args.out, target);
  writeFileSync(`${target}.evidence.json`, JSON.stringify(evidence, null, 2) + '\n');
  const manifestPath = resolve('lib/games/arena/assets.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  manifest.models.figures = {
    path: `/3d/arena/models/${name}`,
    bytes: readFileSync(target).length,
  };
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`Installed ${name}`);
}
