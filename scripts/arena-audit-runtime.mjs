import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import ts from 'typescript';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as THREE from 'three';

export const root = fileURLToPath(new URL('../', import.meta.url));
const runtimeFolder = fs.mkdtempSync(
  path.join(os.tmpdir(), 'arena-native-audit-'),
);
const output = pathToFileURL(runtimeFolder + path.sep);
process.on('exit', () =>
  fs.rmSync(runtimeFolder, { recursive: true, force: true }),
);
const compiled = new Map();
const hashes = new Map();

// Native ESM avoids the VM/Proxy cost of the test loader. The only runtime
// substitution is level ground. The actual renderer, library, cloning,
// animator, IK and contact code run unchanged in the same JS realm.
function compile(file) {
  if (compiled.has(file)) return compiled.get(file);
  const target = new URL(
    path.relative(root, file).replace(/\.ts$/, '.mjs'),
    output,
  );
  compiled.set(file, target.href);
  fs.mkdirSync(path.dirname(fileURLToPath(target)), { recursive: true });
  let source = fs.readFileSync(file, 'utf8');
  hashes.set(path.relative(root, file), source);
  if (file.endsWith('/components/game/arena/world.ts')) {
    const start = source.indexOf('export function standHeight(');
    const end = source.indexOf('\nexport class ArenaWorld', start);
    if (start < 0 || end < 0) throw new Error('standHeight seam changed');
    source =
      source.slice(0, start) +
      'export function standHeight() { return 0; }\n' +
      source.slice(end);
  }
  let code = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  code = code.replace(
    /(from\s+|import\s*)(['"])([^'"]+)\2/g,
    (match, prefix, quote, id) => {
      if (!id.startsWith('@/') && !id.startsWith('.'))
        return `${prefix}${quote}${import.meta.resolve(id)}${quote}`;
      const base = id.startsWith('@/')
        ? path.resolve(root, id.slice(2))
        : path.resolve(path.dirname(file), id);
      const dependency = [
        base,
        `${base}.ts`,
        path.resolve(base, 'index.ts'),
      ].find((candidate) =>
        fs.statSync(candidate, { throwIfNoEntry: false })?.isFile(),
      );
      if (!dependency) throw new Error(`Missing dependency ${id} in ${file}`);
      return `${prefix}${quote}${compile(dependency)}${quote}`;
    },
  );
  fs.writeFileSync(target, code);
  return target.href;
}

export const runtime = Object.assign(
  {},
  ...(await Promise.all(
    [
      'components/game/arena/troops.ts',
      'components/game/arena/world.ts',
      'components/game/arena/materials.ts',
      'components/game/arena/wind.ts',
      'lib/games/arena/cards.ts',
      'lib/games/arena/layout.ts',
      'lib/games/arena/engine.ts',
    ].map((file) => import(compile(path.resolve(root, file)))),
  )),
);
export const runtimeSources = hashes;

export function makeWorld(figures, troops) {
  const world = {
    scene: new THREE.Scene(),
    assets: {
      figures: { scene: figures },
      troops: { scene: troops },
      textures: {},
    },
    materials: new runtime.MaterialLibrary({}),
    wind: runtime.createWind(),
  };
  world.materials.wind = world.wind;
  world.instance = (gltf, name, team) =>
    runtime.ArenaWorld.prototype.instance.call(world, gltf, name, team);
  return world;
}

export function makeRenderer(world) {
  const previous = globalThis.document;
  const canvasDocument = {
    createElement: () => ({
      width: 0,
      height: 0,
      getContext: () => ({
        createRadialGradient: () => ({ addColorStop() {} }),
        fillRect() {},
      }),
    }),
  };
  globalThis.document = canvasDocument;
  try {
    return new runtime.TroopRenderer(world);
  } finally {
    if (previous === undefined) delete globalThis.document;
    else globalThis.document = previous;
  }
}

export { THREE, pathToFileURL };
