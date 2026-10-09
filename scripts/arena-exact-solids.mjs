import * as THREE from 'three';

const droppedKeep = new Set([
  'rear-keep',
  'hipped-roof',
  'roof-ridge',
  'roof-finial',
  'chimney',
  'chimney-cap',
  'chimney-smoke',
  'keep-window',
  'keep-sill',
  'pennant-pole',
  'roof-pennant',
]);
const direction = new THREE.Vector3(0.97, 0.216, 0.124).normalize();
const corner = new THREE.Vector3();
const closest = new THREE.Vector3();
const rayPoint = new THREE.Vector3();
const ray = new THREE.Ray();
const activeVertices = new WeakMap();

export function activeVertexIndices(geometry) {
  if (!activeVertices.has(geometry))
    activeVertices.set(
      geometry,
      geometry.index
        ? [...new Set(geometry.index.array)]
        : Array.from(
            { length: geometry.attributes.position.count },
            (_, i) => i,
          ),
    );
  return activeVertices.get(geometry);
}

function buildTree(triangles) {
  const box = new THREE.Box3();
  const centres = new THREE.Box3();
  for (const record of triangles) {
    box.union(record.box);
    centres.expandByPoint(record.centre);
  }
  if (triangles.length <= 12) return { box, triangles };
  const size = centres.getSize(new THREE.Vector3());
  const axis =
    size.x >= size.y && size.x >= size.z ? 'x' : size.y >= size.z ? 'y' : 'z';
  triangles.sort((a, b) => a.centre[axis] - b.centre[axis]);
  const half = Math.floor(triangles.length / 2);
  return {
    box,
    left: buildTree(triangles.slice(0, half)),
    right: buildTree(triangles.slice(half)),
  };
}

export class MeshSolid {
  constructor(name, positions, indices) {
    this.name = name;
    this.positions = positions;
    this.indices = indices;
    this.triangles = [];
    this.edges = [];
    const unique = new Set();
    for (let i = 0; i < indices.length; i += 3) {
      const ids = [indices[i], indices[i + 1], indices[i + 2]];
      const vertices = ids.map((index) =>
        new THREE.Vector3().fromArray(positions, index * 3),
      );
      const triangle = new THREE.Triangle(...vertices);
      if (triangle.getArea() < 1e-14) continue;
      const box = new THREE.Box3().setFromPoints(vertices);
      this.triangles.push({
        triangle,
        box,
        centre: triangle.getMidpoint(new THREE.Vector3()),
      });
      for (let side = 0; side < 3; side++) {
        let a = ids[side],
          b = ids[(side + 1) % 3];
        if (a > b) [a, b] = [b, a];
        const key = `${a}:${b}`;
        if (unique.has(key)) continue;
        unique.add(key);
        this.edges.push([a, b]);
      }
    }
    if (!this.triangles.length) throw new Error(`No solid triangles: ${name}`);
    this.tree = buildTree(this.triangles.slice());
    this.bounds = this.tree.box;
  }

  hits(origin, heading, maximum = Infinity, details = false) {
    ray.set(origin, heading);
    const hits = [];
    const visit = (node) => {
      if (!ray.intersectBox(node.box, rayPoint)) return;
      if (
        !node.box.containsPoint(origin) &&
        rayPoint.distanceTo(origin) > maximum + 1e-8
      )
        return;
      if (node.triangles) {
        for (const { triangle } of node.triangles) {
          const hit = ray.intersectTriangle(
            triangle.a,
            triangle.b,
            triangle.c,
            false,
            corner,
          );
          if (!hit) continue;
          const distance = hit.distanceTo(origin);
          if (distance > 1e-7 && distance <= maximum + 1e-8)
            hits.push({ distance, triangle });
        }
      } else {
        visit(node.left);
        visit(node.right);
      }
    };
    visit(this.tree);
    hits.sort((a, b) => a.distance - b.distance);
    const unique = hits.filter(
      (hit, i) => !i || hit.distance - hits[i - 1].distance > 1e-6,
    );
    return details ? unique : unique.map((hit) => hit.distance);
  }

  contains(point) {
    if (!this.bounds.containsPoint(point) || this.topology?.sealed === false)
      return false;
    let winding = 0;
    const normal = new THREE.Vector3();
    for (const hit of this.hits(point, direction, Infinity, true)) {
      hit.triangle.getNormal(normal);
      winding += Math.sign(normal.dot(direction));
    }
    // Signed crossings also handle a crest made of overlapping closed
    // components, for which an even/odd test would cancel the overlap.
    return winding !== 0;
  }

  distance(point, limit = Infinity) {
    let best = limit;
    const visit = (node) => {
      if (node.box.distanceToPoint(point) > best) return;
      if (node.triangles) {
        for (const { triangle, box } of node.triangles) {
          if (box.distanceToPoint(point) > best) continue;
          best = Math.min(
            best,
            triangle.closestPointToPoint(point, closest).distanceTo(point),
          );
        }
      } else {
        const a = node.left.box.distanceToPoint(point),
          b = node.right.box.distanceToPoint(point);
        if (a < b) {
          visit(node.left);
          visit(node.right);
        } else {
          visit(node.right);
          visit(node.left);
        }
      }
    };
    visit(this.tree);
    return best;
  }
}

export function posedPositions(mesh) {
  const count = mesh.geometry.attributes.position.count;
  const positions = new Float64Array(count * 3);
  const point = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    mesh.getVertexPosition(i, point).applyMatrix4(mesh.matrixWorld);
    point.toArray(positions, i * 3);
  }
  return positions;
}

export function geometryIndices(geometry) {
  return geometry.index
    ? geometry.index.array
    : Uint32Array.from(
        { length: geometry.attributes.position.count },
        (_, i) => i,
      );
}

export function closedTopology(solid) {
  const canonical = new Map();
  const remap = [];
  for (let i = 0; i < solid.positions.length; i += 3) {
    const key = [0, 1, 2]
      .map((axis) => Math.round(solid.positions[i + axis] * 1e6))
      .join(':');
    if (!canonical.has(key)) canonical.set(key, canonical.size);
    remap.push(canonical.get(key));
  }
  const edges = new Map();
  for (let i = 0; i < solid.indices.length; i += 3) {
    const ids = [
      remap[solid.indices[i]],
      remap[solid.indices[i + 1]],
      remap[solid.indices[i + 2]],
    ];
    if (new Set(ids).size < 3) continue;
    for (let j = 0; j < 3; j++) {
      const a = ids[j],
        b = ids[(j + 1) % 3];
      const key = a < b ? `${a}:${b}` : `${b}:${a}`;
      edges.set(key, (edges.get(key) ?? 0) + 1);
    }
  }
  const boundaryEdges = [...edges.values()].filter(
    (count) => count === 1,
  ).length;
  const nonManifoldEdges = [...edges.values()].filter(
    (count) => count > 2,
  ).length;
  return {
    closed: boundaryEdges === 0 && nonManifoldEdges === 0,
    sealed: boundaryEdges === 0,
    boundaryEdges,
    nonManifoldEdges,
  };
}

export function towerSolids(
  models,
  kind,
  scale,
  side = 1,
  position = [0, 0, 0],
) {
  const tower = models.getObjectByName(kind).clone(true);
  const removals = [];
  if (kind === 'king')
    tower.traverse((node) => {
      if (droppedKeep.has(node.name.replace(/\.\d+$/, ''))) removals.push(node);
    });
  for (const node of removals) node.removeFromParent();
  tower.scale.setScalar(scale);
  tower.rotation.y = side === 1 ? Math.PI : 0;
  tower.position.fromArray(position);
  tower.updateMatrixWorld(true);
  const solids = [];
  tower.traverse((mesh) => {
    if (!mesh.isMesh || /banner|flag|pennant/.test(mesh.name)) return;
    const materials = Array.isArray(mesh.material)
      ? mesh.material
      : [mesh.material];
    if (materials.some((material) => /flag/.test(material.name))) return;
    const solid = new MeshSolid(
      mesh.name,
      posedPositions(mesh),
      geometryIndices(mesh.geometry),
    );
    solid.topology = closedTopology(solid);
    solids.push(solid);
  });
  return solids;
}

// Every posed vertex is checked against the shipped triangles. The optional
// edge pass also detects a thin tower piercing a figure triangle while all
// of that triangle's vertices remain outside. The signed gap is computed
// from exact triangles, never from the runtime's idealized SDF.
export function auditMesh(
  mesh,
  solids,
  { edgePass = true, samples = 12 } = {},
) {
  const positions = posedPositions(mesh);
  const bounds = new THREE.Box3().setFromBufferAttribute(
    new THREE.BufferAttribute(positions, 3),
  );
  const near = bounds.clone().expandByScalar(0.25);
  const candidates = solids.filter((solid) => solid.bounds.intersectsBox(near));
  const vertexIndices = activeVertexIndices(mesh.geometry);
  const result = {
    positions,
    vertexIndices,
    vertices: vertexIndices.length,
    containedVertices: 0,
    edgePenetrations: 0,
    surfaceCrossings: 0,
    openDetailCrossings: 0,
    deepestGap: 0,
    minimumSignedVertexGapCapped: 0.25,
    contacts: [],
    worst: null,
  };
  if (!candidates.length) return result;
  const point = new THREE.Vector3();
  for (const i of vertexIndices) {
    point.fromArray(positions, i * 3);
    for (const solid of candidates) {
      if (!solid.contains(point)) {
        if (
          result.minimumSignedVertexGapCapped > 0 &&
          solid.bounds.distanceToPoint(point) <
            result.minimumSignedVertexGapCapped
        )
          result.minimumSignedVertexGapCapped = solid.distance(
            point,
            result.minimumSignedVertexGapCapped,
          );
        continue;
      }
      const depth = solid.distance(point);
      // Exact boundary points are contact, not volume penetration.
      if (depth <= 1e-6) continue;
      result.containedVertices++;
      result.deepestGap = Math.min(result.deepestGap, -depth);
      result.minimumSignedVertexGapCapped = Math.min(
        result.minimumSignedVertexGapCapped,
        -depth,
      );
      const contact = {
        part: mesh.name,
        solid: solid.name,
        vertex: i,
        gap: -depth,
        point: point.toArray(),
      };
      if (!result.worst || contact.gap < result.worst.gap)
        result.worst = contact;
      if (result.contacts.length < samples) result.contacts.push(contact);
    }
  }
  if (!edgePass || !solids.some((solid) => solid.bounds.intersectsBox(bounds)))
    return result;
  const figure = new MeshSolid(
    mesh.name,
    positions,
    geometryIndices(mesh.geometry),
  );
  const a = new THREE.Vector3(),
    b = new THREE.Vector3(),
    heading = new THREE.Vector3();
  const barycentric = new THREE.Vector3(),
    normal = new THREE.Vector3();
  const edgeBox = new THREE.Box3();
  for (const [i, j] of figure.edges) {
    a.fromArray(positions, i * 3);
    b.fromArray(positions, j * 3);
    edgeBox.setFromPoints([a, b]);
    heading.subVectors(b, a);
    const length = heading.length();
    if (length < 1e-9) continue;
    heading.multiplyScalar(1 / length);
    for (const solid of candidates) {
      if (!solid.bounds.intersectsBox(edgeBox)) continue;
      if (solid.topology?.sealed === false) {
        for (const { distance: hit, triangle } of solid.hits(
          a,
          heading,
          length,
          true,
        )) {
          if (hit <= 1e-6 || hit >= length - 1e-6) continue;
          point.copy(heading).multiplyScalar(hit).add(a);
          triangle.getBarycoord(point, barycentric);
          triangle.getNormal(normal);
          if (
            Math.min(barycentric.x, barycentric.y, barycentric.z) <= 1e-7 ||
            Math.abs(normal.dot(heading)) <= 1e-7
          )
            continue;
          result.surfaceCrossings++;
          result.openDetailCrossings++;
          if (result.contacts.length < samples)
            result.contacts.push({
              part: mesh.name,
              solid: solid.name,
              openDetail: true,
              edge: [i, j],
              point: point.toArray(),
            });
        }
        continue;
      }
      const hits = solid.hits(a, heading, length);
      const cuts = [0, ...hits, length];
      for (let k = 1; k < cuts.length; k++) {
        if (cuts[k] - cuts[k - 1] < 1e-6) continue;
        point
          .copy(heading)
          .multiplyScalar((cuts[k] + cuts[k - 1]) / 2)
          .add(a);
        if (!solid.contains(point)) continue;
        const depth = solid.distance(point);
        if (depth <= 1e-6) continue;
        result.edgePenetrations++;
        result.deepestGap = Math.min(result.deepestGap, -depth);
        const contact = {
          part: mesh.name,
          solid: solid.name,
          edge: [i, j],
          gap: -depth,
          point: point.toArray(),
        };
        if (!result.worst || contact.gap < result.worst.gap)
          result.worst = contact;
        if (result.contacts.length < samples) result.contacts.push(contact);
      }
    }
  }
  // Reverse edge/triangle intersections catch small stone details that
  // pierce a broad body triangle without crossing its perimeter.
  for (const solid of candidates)
    for (const [i, j] of solid.edges) {
      a.fromArray(solid.positions, i * 3);
      b.fromArray(solid.positions, j * 3);
      edgeBox.setFromPoints([a, b]);
      if (!figure.bounds.intersectsBox(edgeBox)) continue;
      heading.subVectors(b, a);
      const length = heading.length();
      if (length < 1e-9) continue;
      heading.multiplyScalar(1 / length);
      for (const { distance: hit, triangle } of figure.hits(
        a,
        heading,
        length,
        true,
      )) {
        if (hit <= 1e-6 || hit >= length - 1e-6) continue;
        point.copy(heading).multiplyScalar(hit).add(a);
        // A stone edge crosses the interior of a nonparallel figure
        // triangle. Exclude tangency and edge/vertex-only touching. This
        // also works when glTF splits one closed skin by material.
        triangle.getBarycoord(point, barycentric);
        triangle.getNormal(normal);
        if (
          Math.min(barycentric.x, barycentric.y, barycentric.z) <= 1e-7 ||
          Math.abs(normal.dot(heading)) <= 1e-7
        )
          continue;
        result.surfaceCrossings++;
        if (solid.topology?.sealed === false) result.openDetailCrossings++;
        if (result.contacts.length < samples)
          result.contacts.push({
            part: mesh.name,
            solid: solid.name,
            stoneEdge: [i, j],
            point: point.toArray(),
          });
      }
    }
  return result;
}

export function sanity() {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2));
  mesh.updateMatrixWorld(true);
  const cube = new MeshSolid(
    'cube',
    posedPositions(mesh),
    geometryIndices(mesh.geometry),
  );
  if (!cube.contains(new THREE.Vector3(0.1, 0.2, 0.3)))
    throw new Error('closed-solid inside test failed');
  if (cube.contains(new THREE.Vector3(0, 2, 0)))
    throw new Error('closed-solid roof test failed');
  if (Math.abs(cube.distance(new THREE.Vector3(0, 0, 0)) - 1) > 1e-8)
    throw new Error('closed-solid distance failed');
  const patch = new THREE.Mesh(
    new THREE.BufferGeometry().setAttribute(
      'position',
      new THREE.Float32BufferAttribute([-3, 0, 0, 3, 0, 0, 0, 3, 0], 3),
    ),
  );
  patch.updateMatrixWorld(true);
  const crossing = auditMesh(patch, [cube]);
  if (crossing.containedVertices !== 0 || crossing.edgePenetrations === 0)
    throw new Error('triangle edge negative control failed');
  const broad = new THREE.Mesh(
    new THREE.BufferGeometry().setAttribute(
      'position',
      new THREE.Float32BufferAttribute([-6, -6, 0, 6, -6, 0, 0, 6, 0], 3),
    ),
  );
  broad.updateMatrixWorld(true);
  const reverse = auditMesh(broad, [cube]);
  if (
    reverse.containedVertices !== 0 ||
    reverse.edgePenetrations !== 0 ||
    reverse.surfaceCrossings === 0
  )
    throw new Error('inverse triangle-edge negative control failed');
  return {
    cubeInsideAndRoof: true,
    nearestTriangleDistance: true,
    outsideVertexEdgeCrossing: true,
    reverseEdgeCrossing: true,
    cubeClosedTopology: closedTopology(cube).closed,
  };
}
