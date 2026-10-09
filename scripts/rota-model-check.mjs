/** Compare the shipped, decoded GLBs with the untouched Blender exports.
 * node scripts/rota-model-check.mjs [--out=path.json]
 * Reorder only the reference's indices/vertices, so vertex correspondence is
 * exact even though Meshopt optimises their storage order. No nearest-point
 * matching that could conceal missing vertices or broken seams.
 */
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { NodeIO, Logger } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, reorder, getBounds } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import { Matrix4, Vector3 } from 'three';

const keep = {
  keepAttributes: true,
  keepLeaves: true,
  keepExtras: true,
  keepIndices: true,
};
const uvMetres = {
  grass: 1.2,
  field: 0.9,
  asphalt: 0.6,
  ballast: 0.3,
  brick: 0.14,
  roof: 0.12,
  slate: 0.12,
  plaster: 0.25,
  wood: 0.12,
  stone: 0.2,
  rock: 0.6,
  foliage: 0.22,
  bark: 0.1,
  sand: 0.8,
  cobble: 0.2,
};
const count = (document) =>
  document
    .getRoot()
    .listMeshes()
    .reduce(
      (total, mesh) =>
        total +
        mesh
          .listPrimitives()
          .reduce(
            (n, primitive) => n + primitive.getAttribute('POSITION').getCount(),
            0,
          ),
      0,
    );

export async function checkRotaModels() {
  await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready]);
  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({
      'meshopt.decoder': MeshoptDecoder,
    });
  const manifest = JSON.parse(
    await readFile('lib/games/rota/assets.json', 'utf8'),
  );
  const report = { models: {}, maxPositionError: 0, maxPositionErrorMm: 0 };
  for (const [name, file] of Object.entries(manifest.models)) {
    const source = await readFile(`assets/rota/build/${name}.glb`);
    const shipped = await readFile(`public${file.path}`);
    assert.equal(shipped.length, file.bytes, `${name}: manifest bytes`);
    const json = JSON.parse(
      shipped.subarray(20, 20 + shipped.readUInt32LE(12)),
    );
    assert.ok(json.extensionsRequired.includes('EXT_meshopt_compression'));
    assert.ok(json.extensionsRequired.includes('KHR_mesh_quantization'));
    assert.equal(
      json.buffers
        .filter((b) => b.extensions?.EXT_meshopt_compression?.fallback)
        .filter((b) => b.uri !== undefined).length,
      0,
      `${name}: no fallback download`,
    );
    const reference = await io.readBinary(source);
    reference.setLogger(new Logger(Logger.Verbosity.ERROR));
    const beforeVertices = count(reference);
    await reference.transform(
      dedup({ keepUniqueNames: true }),
      prune(keep),
      reorder({ encoder: MeshoptEncoder, target: 'size', cleanup: false }),
      prune(keep),
    );
    const actual = await io.readBinary(shipped);
    assert.deepEqual(
      actual.getRoot().getExtras(),
      reference.getRoot().getExtras(),
    );
    assert.deepEqual(
      actual.getRoot().listScenes()[0].getExtras(),
      reference.getRoot().listScenes()[0].getExtras(),
    );
    assert.equal(
      count(reference),
      beforeVertices,
      `${name}: reference vertices`,
    );
    assert.equal(count(actual), beforeVertices, `${name}: shipped vertices`);
    assert.equal(
      actual.getRoot().listNodes().length,
      reference.getRoot().listNodes().length,
    );
    const model = {
      beforeBytes: source.length,
      afterBytes: shipped.length,
      vertices: beforeVertices,
      nodes: reference.getRoot().listNodes().length,
      compressedViews: json.bufferViews.length,
      roots: [],
      meshes: [],
      maxPositionError: 0,
      maxPositionErrorMm: 0,
      maxNormalErrorDegrees: 0,
      maxUvError: 0,
      maxSurfaceErrorMm: 0,
      maxColorError: 0,
    };
    const point = new Vector3(),
      decoded = new Vector3();
    const originalElement = [],
      newElement = [];
    function compareNodes(a, b, path) {
      assert.equal(b.getName(), a.getName(), `${path}: name`);
      assert.deepEqual(b.getExtras(), a.getExtras(), `${path}: extras`);
      assert.equal(
        b.listChildren().length,
        a.listChildren().length,
        `${path}: children`,
      );
      assert.equal(!!b.getMesh(), !!a.getMesh(), `${path}: mesh`);
      if (a.getName().startsWith('wheel')) {
        // Wheel compensation may move along X, its spin axis; Y/Z must stay put.
        assert.deepEqual(
          b.getTranslation().slice(1),
          a.getTranslation().slice(1),
          `${path}: wheel pivot`,
        );
        assert.deepEqual(
          b.getRotation(),
          a.getRotation(),
          `${path}: wheel rotation`,
        );
      }
      if (a.getMesh()) {
        assert.equal(
          b.getMesh().getName(),
          a.getMesh().getName(),
          `${path}: mesh name`,
        );
        assert.deepEqual(
          b.getMesh().getExtras(),
          a.getMesh().getExtras(),
          `${path}: mesh extras`,
        );
        const ap = a.getMesh().listPrimitives(),
          bp = b.getMesh().listPrimitives();
        assert.equal(bp.length, ap.length, `${path}: primitive count`);
        const matrixA = new Matrix4().fromArray(a.getWorldMatrix());
        const matrixB = new Matrix4().fromArray(b.getWorldMatrix());
        const meshReport = {
          path,
          mesh: a.getMesh().getName(),
          vertices: 0,
          triangles: 0,
          maxPositionError: 0,
        };
        for (let p = 0; p < ap.length; p++) {
          const old = ap[p],
            next = bp[p];
          assert.deepEqual(
            next.listSemantics().sort(),
            old.listSemantics().sort(),
            `${path}: attributes`,
          );
          assert.equal(
            next.getMaterial()?.getName(),
            old.getMaterial()?.getName(),
            `${path}: material name`,
          );
          assert.deepEqual(
            next.getMaterial()?.getExtras(),
            old.getMaterial()?.getExtras(),
            `${path}: material extras`,
          );
          const indicesA = old.getIndices().getArray(),
            indicesB = next.getIndices().getArray();
          assert.equal(indicesB.length, indicesA.length, `${path}: indices`);
          for (let i = 0; i < indicesA.length; i += 3) {
            // The index codec may cyclically rotate a triangle, preserving winding.
            let equal = false;
            for (let r = 0; r < 3; r++)
              equal ||= [0, 1, 2].every(
                (k) => indicesA[i + k] === indicesB[i + ((k + r) % 3)],
              );
            assert.ok(equal, `${path}: triangle ${i / 3}`);
          }
          const position = old.getAttribute('POSITION'),
            quantized = next.getAttribute('POSITION');
          assert.equal(
            quantized.getCount(),
            position.getCount(),
            `${path}: vertices`,
          );
          meshReport.vertices += position.getCount();
          meshReport.triangles += indicesA.length / 3;
          const normal = old.getAttribute('NORMAL'),
            normalB = next.getAttribute('NORMAL');
          const uv = old.getAttribute('TEXCOORD_0'),
            uvB = next.getAttribute('TEXCOORD_0');
          const color = old.getAttribute('COLOR_0'),
            colorB = next.getAttribute('COLOR_0');
          const physicalUv =
            uvMetres[old.getMaterial().getName().split(':')[0]] ?? 0;
          for (let i = 0; i < position.getCount(); i++) {
            position.getElement(i, originalElement);
            quantized.getElement(i, newElement);
            point.fromArray(originalElement).applyMatrix4(matrixA);
            decoded.fromArray(newElement).applyMatrix4(matrixB);
            meshReport.maxPositionError = Math.max(
              meshReport.maxPositionError,
              point.distanceTo(decoded),
            );
            normal.getElement(i, originalElement);
            normalB.getElement(i, newElement);
            point.fromArray(originalElement).normalize();
            decoded.fromArray(newElement).normalize();
            model.maxNormalErrorDegrees = Math.max(
              model.maxNormalErrorDegrees,
              (point.angleTo(decoded) * 180) / Math.PI,
            );
            uv.getElement(i, originalElement);
            uvB.getElement(i, newElement);
            for (let k = 0; k < 2; k++) {
              const error = Math.abs(originalElement[k] - newElement[k]);
              model.maxUvError = Math.max(model.maxUvError, error);
              model.maxSurfaceErrorMm = Math.max(
                model.maxSurfaceErrorMm,
                error * physicalUv * 25000,
              );
            }
            color.getElement(i, originalElement);
            colorB.getElement(i, newElement);
            for (let k = 0; k < color.getElementSize(); k++)
              model.maxColorError = Math.max(
                model.maxColorError,
                Math.abs(originalElement[k] - newElement[k]),
              );
          }
        }
        meshReport.maxPositionErrorMm = meshReport.maxPositionError * 25000;
        model.maxPositionError = Math.max(
          model.maxPositionError,
          meshReport.maxPositionError,
        );
        model.meshes.push(meshReport);
      }
      a.listChildren().forEach((node, i) =>
        compareNodes(node, b.listChildren()[i], `${path}/${node.getName()}`),
      );
    }
    const rootsA = reference.getRoot().listScenes()[0].listChildren();
    const rootsB = actual.getRoot().listScenes()[0].listChildren();
    assert.equal(rootsB.length, rootsA.length);
    rootsA.forEach((root, i) => {
      compareNodes(root, rootsB[i], root.getName());
      const before = getBounds(root),
        after = getBounds(rootsB[i]);
      const maxError = Math.max(
        ...['min', 'max'].flatMap((key) =>
          before[key].map((v, k) => Math.abs(v - after[key][k])),
        ),
      );
      model.roots.push({
        name: root.getName(),
        before,
        after,
        maxBoundError: maxError,
      });
    });
    model.maxBoundError = Math.max(
      ...model.roots.map((root) => root.maxBoundError),
    );
    model.maxPositionErrorMm = model.maxPositionError * 25000;
    report.maxPositionError = Math.max(
      report.maxPositionError,
      model.maxPositionError,
    );
    report.models[name] = model;
  }
  report.maxPositionErrorMm = report.maxPositionError * 25000;
  return report;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const report = await checkRotaModels();
  const out = process.argv.find((arg) => arg.startsWith('--out='))?.slice(6);
  if (out) await writeFile(out, JSON.stringify(report, null, 2) + '\n');
  for (const [name, model] of Object.entries(report.models))
    console.log(
      `${name}: ${model.vertices} vertices, ${model.nodes} nodes, ${model.roots.length} roots; max position error ${model.maxPositionError.toExponential(6)} units / ${model.maxPositionErrorMm.toFixed(6)} mm; normal ${model.maxNormalErrorDegrees.toFixed(4)}°; UV ${model.maxUvError.toExponential(4)}; colour ${model.maxColorError.toExponential(4)}`,
    );
}
