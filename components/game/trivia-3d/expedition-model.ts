import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * Editable source for the Expedition miniature. Y is up. The landscape is
 * authored around one trail, and progress samples the same surface the trail
 * and bridge use. Lighting, framing and token travel belong to the scene.
 *
 * Secondary forms are kept as named pieces for source review. No quality LOD
 * or material merging is applied here; those need actual renderer evidence.
 */

const TAU = Math.PI * 2;
const UP = new THREE.Vector3(0, 1, 0);
const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const clamp = (x: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, x));
const smooth = (x: number) => {
  const n = clamp(x);
  return n * n * (3 - 2 * n);
};

type Palette = Record<string, THREE.MeshStandardMaterial>;
type DisposableRoot = {
  root: THREE.Group;
  dispose: () => void;
};

function grainTexture(kind: 'wood' | 'canvas' | 'stone') {
  const size = 128;
  const pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let value: number;
      if (kind === 'wood') {
        const warp = Math.sin(y * 0.09) * 1.2 + Math.sin(y * 0.025) * 3;
        const broad = Math.sin((x + warp) * 0.38);
        const fine = Math.sin((x + warp) * 1.72 + Math.sin(y * 0.05));
        value = 225 + broad * 13 + fine * 4;
      } else if (kind === 'canvas') {
        const weave = ((x & 1) === 0 ? 1 : -1) * ((y & 1) === 0 ? 1 : -1);
        value = 238 + weave * 7 + Math.sin(x * 0.24) * 2;
      } else {
        const vein = Math.sin(x * 0.035 + Math.sin(y * 0.06) * 2);
        value = 239 + vein * 6 + Math.sin(x * 0.17 + y * 0.11) * 3;
      }
      const k = (y * size + x) * 4;
      pixels[k] = pixels[k + 1] = pixels[k + 2] = Math.round(value);
      pixels[k + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(pixels, size, size, THREE.RGBAFormat);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

function palette() {
  const wood = grainTexture('wood');
  wood.repeat.set(3, 1);
  const canvas = grainTexture('canvas');
  canvas.repeat.set(3, 3);
  const stone = grainTexture('stone');
  stone.repeat.set(1.4, 1.4);
  const make = (
    color: string,
    roughness: number,
    metalness = 0,
    map?: THREE.Texture,
  ) =>
    new THREE.MeshStandardMaterial({
      color,
      roughness,
      metalness,
      ...(map ? { map } : {}),
    });
  const materials: Palette = {
    walnut: make('#6d4130', 0.43, 0, wood),
    walnutEdge: make('#37261e', 0.52, 0, wood),
    oak: make('#b38554', 0.55, 0, wood),
    oakEnd: make('#dbb483', 0.61, 0, wood),
    bark: make('#645140', 0.92, 0, wood),
    brass: make('#d4aa5c', 0.27, 0.78),
    brassDark: make('#8e733f', 0.44, 0.7),
    enamel: make('#15565d', 0.34, 0.11),
    moss: make('#65834f', 0.97),
    mossLight: make('#91a467', 0.98),
    grass: make('#87946b', 0.95),
    pine: make('#254f45', 0.91),
    pineLight: make('#44725a', 0.89),
    rock: make('#8d8d80', 0.96, 0, stone),
    rockLight: make('#c1bba5', 0.96, 0, stone),
    rockDark: make('#6b746c', 0.96, 0, stone),
    earth: make('#ab9771', 0.93, 0, stone),
    path: make('#d9c99c', 0.87, 0, stone),
    snow: make('#f4f1df', 0.89),
    canvas: make('#d6a457', 0.97, 0, canvas),
    canvasSeam: make('#f0d7a6', 0.94, 0, canvas),
    canvasDark: make('#91643c', 0.99, 0, canvas),
    rope: make('#ddcaa3', 0.93),
    leather: make('#a6673b', 0.72, 0, wood),
    sole: make('#343531', 0.88),
    water: new THREE.MeshStandardMaterial({
      color: '#3caca8',
      roughness: 0.19,
      metalness: 0.22,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
    }),
    current: new THREE.MeshStandardMaterial({
      color: '#b9ede0',
      roughness: 0.25,
      metalness: 0.18,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
    }),
  };
  return { materials, textures: [wood, canvas, stone] };
}

function sourceRoot(name: string): DisposableRoot & {
  materials: Palette;
  geometries: Set<THREE.BufferGeometry>;
  mesh: (
    name: string,
    geometry: THREE.BufferGeometry,
    material: THREE.Material | THREE.Material[],
    at?: THREE.Vector3,
    parent?: THREE.Object3D,
  ) => THREE.Mesh;
} {
  const root = new THREE.Group();
  root.name = name;
  const { materials, textures } = palette();
  const geometries = new Set<THREE.BufferGeometry>();
  const mesh = (
    label: string,
    geometry: THREE.BufferGeometry,
    material: THREE.Material | THREE.Material[],
    at = v(),
    parent: THREE.Object3D = root,
  ) => {
    geometries.add(geometry);
    const part = new THREE.Mesh(geometry, material);
    part.name = label;
    part.position.copy(at);
    part.castShadow = true;
    part.receiveShadow = true;
    parent.add(part);
    return part;
  };
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    for (const geometry of geometries) geometry.dispose();
    for (const material of Object.values(materials)) material.dispose();
    for (const texture of textures) texture.dispose();
  };
  return { root, materials, mesh, dispose, geometries };
}

type Source = ReturnType<typeof sourceRoot>;

type ModelOptions = { runtime?: boolean };

/** A separately built runtime copy: retain every authored triangle and material,
 * but submit static pieces together. Animation boundaries remain real pivots.
 * The default factories below always retain the full editable source hierarchy. */
function consolidateRuntime(source: Source, boundary: THREE.Group) {
  boundary.updateWorldMatrix(true, true);
  const inverse = boundary.matrixWorld.clone().invert();
  const buckets = new Map<
    string,
    {
      parts: THREE.BufferGeometry[];
      material: THREE.Material;
      cast: boolean;
      receive: boolean;
      order: number;
    }
  >();
  const originals: THREE.Mesh[] = [];
  const add = (
    part: THREE.BufferGeometry,
    material: THREE.Material,
    object: THREE.Mesh,
  ) => {
    for (const attribute of Object.keys(part.attributes)) {
      if (!['position', 'normal', 'uv', 'color'].includes(attribute))
        part.deleteAttribute(attribute);
    }
    const count = part.getAttribute('position').count;
    if (!part.getAttribute('normal')) part.computeVertexNormals();
    if (!part.getAttribute('uv'))
      part.setAttribute(
        'uv',
        new THREE.Float32BufferAttribute(new Float32Array(count * 2), 2),
      );
    if (!part.getAttribute('color'))
      part.setAttribute(
        'color',
        new THREE.Float32BufferAttribute(
          new Float32Array(count * 3).fill(1),
          3,
        ),
      );
    part.clearGroups();
    const key = `${material.uuid}/${object.castShadow}/${object.receiveShadow}/${object.renderOrder}`;
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = {
        parts: [],
        material,
        cast: object.castShadow,
        receive: object.receiveShadow,
        order: object.renderOrder,
      };
      buckets.set(key, bucket);
    }
    bucket.parts.push(part);
  };
  const collect = (object: THREE.Object3D) => {
    if (object !== boundary && object.userData.triviaDynamic) return;
    if (object instanceof THREE.Mesh) {
      const part = object.geometry.index
        ? object.geometry.toNonIndexed()
        : object.geometry.clone();
      part.applyMatrix4(inverse.clone().multiply(object.matrixWorld));
      if (Array.isArray(object.material)) {
        const groups = part.groups.length
          ? part.groups
          : [
              {
                start: 0,
                count: part.getAttribute('position').count,
                materialIndex: 0,
              },
            ];
        for (const group of groups) {
          const subset = new THREE.BufferGeometry();
          for (const name of Object.keys(part.attributes)) {
            const attribute = part.getAttribute(name);
            const data = new Float32Array(group.count * attribute.itemSize);
            for (let i = 0; i < group.count; i++) {
              const index = group.start + i;
              for (
                let component = 0;
                component < attribute.itemSize;
                component++
              ) {
                data[i * attribute.itemSize + component] =
                  attribute.getComponent(index, component);
              }
            }
            subset.setAttribute(
              name,
              new THREE.Float32BufferAttribute(data, attribute.itemSize),
            );
          }
          add(subset, object.material[group.materialIndex ?? 0], object);
        }
        part.dispose();
      } else add(part, object.material, object);
      originals.push(object);
    }
    for (const child of object.children) collect(child);
  };
  collect(boundary);
  for (const bucket of buckets.values()) {
    const merged = mergeGeometries(bucket.parts, false);
    if (!merged)
      throw new Error('Expedition static geometry cannot be consolidated');
    const mesh = source.mesh(
      `Runtime static ${boundary.name} — ${bucket.material.name || bucket.material.type}`,
      merged,
      bucket.material,
      v(),
      boundary,
    );
    mesh.castShadow = bucket.cast;
    mesh.receiveShadow = bucket.receive;
    mesh.renderOrder = bucket.order;
    bucket.parts.forEach((part) => part.dispose());
  }
  originals.forEach((object) => object.removeFromParent());
}

function releaseSupersededGeometry(source: Source) {
  const used = new Set<THREE.BufferGeometry>();
  source.root.traverse((object) => {
    if (object instanceof THREE.Mesh) used.add(object.geometry);
  });
  for (const part of source.geometries) {
    if (!used.has(part)) {
      part.dispose();
      source.geometries.delete(part);
    }
  }
  source.root.userData.runtimeMerged = true;
}

function box(
  source: Source,
  name: string,
  size: number[],
  at: number[],
  material: THREE.Material,
  radius = 0.04,
  parent?: THREE.Object3D,
) {
  return source.mesh(
    name,
    new RoundedBoxGeometry(size[0], size[1], size[2], 3, radius),
    material,
    v(at[0], at[1], at[2]),
    parent,
  );
}

function cylinder(
  source: Source,
  name: string,
  bottom: number,
  top: number,
  height: number,
  at: number[],
  material: THREE.Material,
  parent?: THREE.Object3D,
  sides = 16,
) {
  return source.mesh(
    name,
    new THREE.CylinderGeometry(top, bottom, height, sides, 1),
    material,
    v(at[0], at[1], at[2]),
    parent,
  );
}

function beam(
  source: Source,
  name: string,
  a: THREE.Vector3,
  b: THREE.Vector3,
  width: number,
  depth: number,
  material: THREE.Material,
  parent?: THREE.Object3D,
) {
  const direction = b.clone().sub(a);
  const part = box(
    source,
    name,
    [width, direction.length(), depth],
    a.clone().add(b).multiplyScalar(0.5).toArray(),
    material,
    Math.min(width, depth) * 0.16,
    parent,
  );
  part.quaternion.setFromUnitVectors(UP, direction.normalize());
  return part;
}

function tube(
  source: Source,
  name: string,
  points: THREE.Vector3[],
  radius: number,
  material: THREE.Material,
  parent?: THREE.Object3D,
  segments = 20,
) {
  const curve = new THREE.CatmullRomCurve3(points);
  return source.mesh(
    name,
    new THREE.TubeGeometry(curve, segments, radius, 6, false),
    material,
    v(),
    parent,
  );
}

function torus(
  source: Source,
  name: string,
  radius: number,
  thickness: number,
  at: number[],
  material: THREE.Material,
  parent?: THREE.Object3D,
) {
  return source.mesh(
    name,
    new THREE.TorusGeometry(radius, thickness, 8, 48),
    material,
    v(at[0], at[1], at[2]),
    parent,
  );
}

function geometry(positions: number[], indices?: number[], uv?: number[]) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  if (indices) g.setIndex(indices);
  if (uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}

function islandEdge(angle: number, scale = 1) {
  const scallop =
    1 + Math.sin(angle * 3 + 0.25) * 0.035 + Math.cos(angle * 7) * 0.017;
  return v(
    Math.cos(angle) * 6.0 * scallop * scale,
    0,
    Math.sin(angle) * 2.92 * scallop * scale,
  );
}

function islandShape(scale = 1) {
  const shape = new THREE.Shape();
  for (let i = 0; i <= 80; i++) {
    const p = islandEdge((i / 80) * TAU, scale);
    if (i === 0) shape.moveTo(p.x, -p.z);
    else shape.lineTo(p.x, -p.z);
  }
  return shape;
}

function plinth(source: Source) {
  const { mesh, materials: m } = source;
  const body = mesh(
    'Walnut plinth — bevelled complete outline',
    new THREE.ExtrudeGeometry(islandShape(1.045), {
      depth: 0.36,
      bevelEnabled: true,
      bevelSegments: 4,
      bevelThickness: 0.075,
      bevelSize: 0.07,
      steps: 1,
      curveSegments: 80,
    }),
    m.walnut,
    v(0, -0.41, 0),
  );
  body.rotation.x = -Math.PI / 2;
  const lower = mesh(
    'Dark recessed plinth base',
    new THREE.ExtrudeGeometry(islandShape(1.027), {
      depth: 0.08,
      bevelEnabled: true,
      bevelSegments: 3,
      bevelThickness: 0.03,
      bevelSize: 0.04,
      steps: 1,
    }),
    m.walnutEdge,
    v(0, -0.54, 0),
  );
  lower.rotation.x = -Math.PI / 2;
  for (const height of [-0.28, -0.09]) {
    const points = Array.from({ length: 81 }, (_, i) => {
      const p = islandEdge((i / 80) * TAU, 1.045);
      p.y = height;
      return p;
    });
    tube(
      source,
      'Routed walnut edge line',
      points,
      0.014,
      m.walnutEdge,
      undefined,
      100,
    );
  }
  for (const x of [-4.1, 4.1]) {
    for (const z of [-1.55, 1.55]) {
      cylinder(
        source,
        'Recessed brass plinth foot',
        0.22,
        0.19,
        0.16,
        [x, -0.6, z],
        m.brassDark,
        undefined,
        24,
      );
      torus(
        source,
        'Foot turned rim',
        0.197,
        0.015,
        [x, -0.57, z],
        m.brass,
      ).rotation.x = -Math.PI / 2;
    }
  }
}

function riverX(z: number) {
  return -1.25 + Math.sin(z * 1.12 + 0.38) * 0.47;
}

/** The terrain's authored contour, used by mesh, vegetation and movement. */
function terrainHeight(x: number, z: number) {
  const right = smooth((x - 1.2) / 4.6);
  const shoulder = Math.exp(-((x - 4.35) ** 2 / 3.2 + (z + 0.9) ** 2 / 3.5));
  const meadow =
    Math.sin(x * 0.63 + z * 0.34) * 0.048 +
    Math.cos(z * 1.08 - x * 0.26) * 0.031;
  const grove =
    Math.exp(-((x + 4.05) ** 2 / 2.3 + (z + 1.15) ** 2 / 0.95)) * 0.23;
  const camp =
    Math.exp(-((x - 0.6) ** 2 / 1.25 + (z + 1.45) ** 2 / 0.85)) * 0.08;
  const channel = Math.abs(x - riverX(z));
  const bed = 0.17 * (1 - smooth((channel - 0.17) / 0.22));
  return 0.41 + meadow + right * 0.65 + shoulder * 0.86 + grove + camp - bed;
}

function terrain(source: Source) {
  const positions: number[] = [0, terrainHeight(0, 0), 0];
  const colors: number[] = [];
  const uv: number[] = [0.5, 0.5];
  const indices: number[] = [];
  const rings = 34;
  const sides = 96;
  const green = new THREE.Color('#829766');
  const forest = new THREE.Color('#50734c');
  const bank = new THREE.Color('#68794f');
  const high = new THREE.Color('#b6b398');
  const shade = new THREE.Color();
  const paint = (x: number, z: number) => {
    shade.copy(green).lerp(high, smooth((x - 1.1) / 4.8) * 0.82);
    const grove = Math.exp(-((x + 3.86) ** 2 / 3.3 + (z + 0.71) ** 2 / 3.0));
    shade.lerp(forest, grove * 0.46);
    shade.lerp(bank, Math.exp(-((x - riverX(z)) ** 2) / 0.14) * 0.28);
    shade.multiplyScalar(
      0.98 + Math.sin(x * 2.6 + z * 1.4) * 0.035 + Math.cos(z * 2.2) * 0.018,
    );
    colors.push(shade.r, shade.g, shade.b);
  };
  paint(0, 0);
  for (let ring = 1; ring <= rings; ring++) {
    const radius = ring / rings;
    for (let i = 0; i < sides; i++) {
      const p = islandEdge((i / sides) * TAU, radius);
      positions.push(p.x, terrainHeight(p.x, p.z), p.z);
      uv.push(p.x / 12 + 0.5, p.z / 6 + 0.5);
      paint(p.x, p.z);
      if (ring === 1) indices.push(0, 1 + ((i + 1) % sides), 1 + i);
      else {
        const a = 1 + (ring - 2) * sides + i;
        const b = 1 + (ring - 2) * sides + ((i + 1) % sides);
        const c = a + sides;
        const d = b + sides;
        indices.push(a, b, c, b, d, c);
      }
    }
  }
  const top = geometry(positions, indices, uv);
  top.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const ground = source.materials.grass.clone();
  ground.color.set('#ffffff');
  ground.vertexColors = true;
  source.materials.terrain = ground;
  source.mesh('Continuous sculpted moss and mountain shoulder', top, ground);

  const strata = [
    {
      top: 0.0,
      bottom: -0.1,
      scale: 1.005,
      material: source.materials.rockDark,
    },
    { top: 0.16, bottom: 0.0, scale: 1.0, material: source.materials.earth },
    {
      top: 1,
      bottom: 0.16,
      scale: 0.998,
      material: source.materials.rockLight,
    },
  ];
  for (let layer = 0; layer < strata.length; layer++) {
    const { top: topFraction, bottom, scale, material } = strata[layer];
    const edgePositions: number[] = [];
    const edgeUv: number[] = [];
    const edgeIndices: number[] = [];
    for (let i = 0; i <= sides; i++) {
      const angle = (i / sides) * TAU;
      const p = islandEdge(angle, scale);
      const h = terrainHeight(p.x, p.z);
      const crease = Math.sin(angle * 8) * 0.018;
      const yTop = topFraction === 1 ? h - 0.006 : topFraction + crease;
      const yBottom = bottom + (layer > 0 ? crease : 0);
      edgePositions.push(p.x, yBottom, p.z, p.x, yTop, p.z);
      edgeUv.push((i / sides) * 6, 0, (i / sides) * 6, 1);
      if (i < sides) {
        const a = i * 2;
        edgeIndices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    source.mesh(
      `Carved geology stratum ${layer + 1}`,
      geometry(edgePositions, edgeIndices, edgeUv),
      material,
    );
  }
}

const pathNodes = [
  [-4.8, 1.03],
  [-4.44, 0.64],
  [-4.12, 0.2],
  [-3.44, -0.71],
  [-2.81, -0.53],
  [-2.01, -0.09],
  [-1.16, -0.06],
  [-0.28, -0.03],
  [0.7, 0.59],
  [1.73, 1.23],
  [2.64, 0.8],
  [3.73, -0.16],
  [4.91, -0.62],
];
const trailCurve = new THREE.CatmullRomCurve3(
  pathNodes.map(([x, z]) => v(x, 0, z)),
  false,
  'centripetal',
  0.45,
);
const BRIDGE_MIN = -1.96;
const BRIDGE_MAX = -0.35;
const BRIDGE_WIDTH = 1.45;
function bridgeDeck(x: number) {
  const t = clamp((x - BRIDGE_MIN) / (BRIDGE_MAX - BRIDGE_MIN));
  const near = terrainHeight(BRIDGE_MIN, -0.06) - 0.016;
  const far = terrainHeight(BRIDGE_MAX, -0.06) - 0.016;
  return THREE.MathUtils.lerp(near, far, t) + Math.sin(t * Math.PI) * 0.26;
}

function surfaceHeight(x: number, z: number) {
  return x >= BRIDGE_MIN &&
    x <= BRIDGE_MAX &&
    Math.abs(z + 0.06) < BRIDGE_WIDTH * 0.5 - 0.027
    ? bridgeDeck(x) + 0.045
    : terrainHeight(x, z) + 0.028;
}

function surfaceAt(x: number, z: number) {
  return v(x, surfaceHeight(x, z), z);
}

function normalAt(x: number, z: number) {
  const sample = 0.028;
  const dx =
    (surfaceHeight(x + sample, z) - surfaceHeight(x - sample, z)) /
    (sample * 2);
  const dz =
    (surfaceHeight(x, z + sample) - surfaceHeight(x, z - sample)) /
    (sample * 2);
  return v(-dx, 1, -dz).normalize();
}

function trailPoint(distance: number, lateral = 0) {
  const progress = clamp(Number.isNaN(distance) ? 0 : distance, 0, 12) / 12;
  const p = trailCurve.getPoint(progress);
  if (lateral) {
    const direction = trailCurve.getTangent(progress);
    p.addScaledVector(v(-direction.z, 0, direction.x).normalize(), lateral);
  }
  p.y = surfaceHeight(p.x, p.z);
  return p;
}

function trail(source: Source) {
  const positions: number[] = [];
  const uv: number[] = [];
  const indices: number[] = [];
  const divisions = 240;
  for (let i = 0; i <= divisions; i++) {
    const d = (i / divisions) * 12;
    const center = trailPoint(d);
    const tangent = trailPoint(Math.min(12, d + 0.02)).sub(
      trailPoint(Math.max(0, d - 0.02)),
    );
    const cross = v(-tangent.z, 0, tangent.x).normalize();
    const width = 0.18 + Math.sin(d * 2.2) * 0.007;
    for (const side of [-1, 1]) {
      const p = center.clone().addScaledVector(cross, side * width);
      p.y =
        center.x >= BRIDGE_MIN && center.x <= BRIDGE_MAX
          ? bridgeDeck(p.x) + 0.049
          : terrainHeight(p.x, p.z) + 0.033;
      positions.push(p.x, p.y, p.z);
      uv.push(d / 2, side === -1 ? 0 : 1);
    }
    if (
      i < divisions &&
      (center.x < BRIDGE_MIN - 0.01 || center.x > BRIDGE_MAX + 0.01)
    ) {
      const a = i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  source.mesh(
    'Pale continuous inlaid trail',
    geometry(positions, indices, uv),
    source.materials.path,
  );
  for (let step = 0; step <= 12; step++) {
    const p = trailPoint(step);
    const major = step > 0 && step % 3 === 0;
    const inlay = new THREE.Group();
    inlay.name = 'Terrain-following milestone inlay';
    inlay.position.copy(p);
    inlay.quaternion.setFromUnitVectors(UP, normalAt(p.x, p.z));
    source.root.add(inlay);
    const marker = cylinder(
      source,
      major ? `Round landmark ${step / 3}` : `Trail step ${step}`,
      major ? 0.23 : 0.125,
      major ? 0.23 : 0.125,
      0.018,
      [0, -0.009, 0],
      major ? source.materials.brassDark : source.materials.rockLight,
      inlay,
      32,
    );
    marker.receiveShadow = true;
    if (major) {
      const rim = torus(
        source,
        'Brass inlaid milestone rim',
        0.198,
        0.007,
        [0, 0.0015, 0],
        source.materials.brass,
        inlay,
      );
      rim.rotation.x = -Math.PI / 2;
      for (let n = 0; n < step / 3; n++) {
        const angle = (n - (step / 3 - 1) / 2) * 0.4;
        cylinder(
          source,
          'Milestone enamel dot',
          0.022,
          0.022,
          0.008,
          [Math.sin(angle) * 0.115, 0.001, Math.cos(angle) * 0.115],
          source.materials.enamel,
          inlay,
          10,
        );
      }
    }
  }
  for (let i = 0; i < 26; i++) {
    const d = 0.3 + i * 0.445;
    const p = trailPoint(d);
    if (p.x > BRIDGE_MIN - 0.18 && p.x < BRIDGE_MAX + 0.18) continue;
    const tangent = trailPoint(Math.min(12, d + 0.03)).sub(
      trailPoint(Math.max(0, d - 0.03)),
    );
    const normal = v(-tangent.z, 0, tangent.x).normalize();
    const a = p.clone().addScaledVector(normal, -0.115);
    const b = p.clone().addScaledVector(normal, 0.115);
    a.y = terrainHeight(a.x, a.z) + 0.041;
    b.y = terrainHeight(b.x, b.z) + 0.041;
    tube(
      source,
      'Recessed trail paving joint',
      [a, b],
      0.005,
      source.materials.earth,
      undefined,
      1,
    );
  }
}

function pine(
  source: Source,
  x: number,
  z: number,
  height: number,
  turn: number,
) {
  const tree = new THREE.Group();
  tree.name = 'Layered mountain pine';
  tree.position.set(x, terrainHeight(x, z), z);
  tree.rotation.y = turn;
  source.root.add(tree);
  const trunkPositions: number[] = [];
  const trunkIndices: number[] = [];
  const trunkUv: number[] = [];
  const ringProfile = [
    [0, 0.1],
    [0.1, 0.065],
    [0.55, 0.046],
    [0.92, 0.021],
    [1, 0.003],
  ];
  const sides = 10;
  for (let ring = 0; ring < ringProfile.length; ring++) {
    const [rise, radius] = ringProfile[ring];
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * TAU;
      const r = radius * height * (1 + Math.cos(a * 5) * 0.15);
      trunkPositions.push(
        Math.cos(a) * r + rise * 0.034,
        rise * height,
        Math.sin(a) * r,
      );
      trunkUv.push(i / sides, rise);
      if (ring > 0) {
        const p = (ring - 1) * sides + i;
        const q = (ring - 1) * sides + ((i + 1) % sides);
        trunkIndices.push(p, p + sides, q, q, p + sides, q + sides);
      }
    }
  }
  source.mesh(
    'Tapered trunk with buttressed base',
    geometry(trunkPositions, trunkIndices, trunkUv),
    source.materials.bark,
    v(),
    tree,
  );
  for (let root = 0; root < 4; root++) {
    const a = turn + (root * TAU) / 4;
    tube(
      source,
      'Exposed pine root',
      [
        v(0, 0.07, 0),
        v(Math.cos(a) * 0.09, 0.04, Math.sin(a) * 0.09),
        v(Math.cos(a) * 0.23, 0.017, Math.sin(a) * 0.23),
      ],
      height * 0.015,
      source.materials.bark,
      tree,
      12,
    );
  }
  for (let layer = 0; layer < 5; layer++) {
    const y = height * (0.35 + layer * 0.13);
    const radius = height * (0.26 - layer * 0.043);
    const vertices: number[] = [];
    const indices: number[] = [];
    const uv: number[] = [];
    const boughs = 9;
    for (let bough = 0; bough < boughs; bough++) {
      const a = (bough / boughs) * TAU + layer * 0.47;
      const da = (TAU / boughs) * 0.43;
      const r = radius * (1 + Math.sin(bough * 2.7 + layer) * 0.085);
      const tipY = y - height * (0.064 + Math.cos(bough * 1.9) * 0.006);
      const base = vertices.length / 3;
      vertices.push(
        Math.cos(a) * r * 0.09,
        y + height * 0.2,
        Math.sin(a) * r * 0.09,
        Math.cos(a - da) * r * 0.67,
        y - height * 0.02,
        Math.sin(a - da) * r * 0.67,
        Math.cos(a) * r,
        tipY,
        Math.sin(a) * r,
        Math.cos(a + da) * r * 0.67,
        y - height * 0.02,
        Math.sin(a + da) * r * 0.67,
        Math.cos(a) * r * 0.09,
        y + height * 0.135,
        Math.sin(a) * r * 0.09,
      );
      uv.push(0.5, 1, 0, 0.4, 0.5, 0, 1, 0.4, 0.5, 0.9);
      indices.push(
        base,
        base + 2,
        base + 1,
        base,
        base + 3,
        base + 2,
        base + 4,
        base + 1,
        base + 2,
        base + 4,
        base + 2,
        base + 3,
      );
    }
    const g = geometry(vertices, indices, uv).toNonIndexed();
    g.computeVertexNormals();
    source.mesh(
      'Scalloped needle bough whorl',
      g,
      layer % 2 === 0 ? source.materials.pine : source.materials.pineLight,
      v(),
      tree,
    );
  }
  return tree;
}

function rock(
  source: Source,
  x: number,
  z: number,
  size: number,
  turn: number,
  material = source.materials.rock,
) {
  const g = new THREE.IcosahedronGeometry(1, 1);
  const positions = g.getAttribute('position');
  for (let i = 0; i < positions.count; i++) {
    const x0 = positions.getX(i);
    const y0 = positions.getY(i);
    const z0 = positions.getZ(i);
    const scale = 1 + Math.sin(x0 * 3.4 + z0 * 2.7 + turn) * 0.11;
    positions.setXYZ(
      i,
      x0 * scale * size,
      Math.max(-0.35, y0 * scale) * size * 0.65,
      z0 * scale * size * 0.75,
    );
  }
  g.computeVertexNormals();
  const stone = source.mesh(
    'Cleaved riverbank stone',
    g,
    material,
    v(x, terrainHeight(x, z) + size * 0.25, z),
  );
  stone.rotation.y = turn;
}

function fernPatch(
  source: Source,
  x: number,
  z: number,
  scale: number,
  turn: number,
) {
  const positions: number[] = [];
  const indices: number[] = [];
  const uv: number[] = [];
  const base = v(x, terrainHeight(x, z) + 0.023, z);
  for (let frond = 0; frond < 6; frond++) {
    const angle = turn + (frond / 6) * TAU;
    const direction = v(Math.cos(angle), 0, Math.sin(angle));
    const side = v(-direction.z, 0, direction.x);
    const length = (0.26 + (frond % 2) * 0.045) * scale;
    const height = (0.13 + (frond % 3) * 0.023) * scale;
    const curve = new THREE.QuadraticBezierCurve3(
      base,
      base
        .clone()
        .addScaledVector(direction, length * 0.46)
        .add(v(0, height * 1.8, 0)),
      base
        .clone()
        .addScaledVector(direction, length)
        .add(v(0, height * 0.55, 0)),
    );
    const stem = Array.from({ length: 8 }, (_, i) => curve.getPoint(i / 7));
    tube(
      source,
      'Fern curved central rib',
      stem,
      0.003 * scale,
      source.materials.mossLight,
      undefined,
      12,
    );
    for (let leaflet = 1; leaflet <= 7; leaflet++) {
      const t = leaflet / 8;
      const root = curve.getPoint(t);
      const width = Math.sin(t * Math.PI) * 0.052 * scale;
      for (const sign of [-1, 1]) {
        const bladeTip = curve
          .getPoint(Math.min(1, t + 0.065))
          .addScaledVector(side, sign * width)
          .add(v(0, -0.012 * scale, 0));
        const directionToTip = bladeTip.clone().sub(root);
        const breadth = v(-directionToTip.z, 0, directionToTip.x)
          .normalize()
          .multiplyScalar(0.017 * scale * Math.sin(t * Math.PI));
        const ridge = root
          .clone()
          .lerp(bladeTip, 0.57)
          .add(v(0, 0.01 * scale, 0));
        const lower = ridge
          .clone()
          .sub(breadth)
          .add(v(0, -0.011 * scale, 0));
        const upper = ridge
          .clone()
          .add(breadth)
          .add(v(0, -0.011 * scale, 0));
        const n = positions.length / 3;
        positions.push(
          ...root.toArray(),
          ...lower.toArray(),
          ...bladeTip.toArray(),
          ...upper.toArray(),
          ...ridge.toArray(),
        );
        uv.push(0.5, 0, 0, 0.5, 0.5, 1, 1, 0.5, 0.5, 0.55);
        indices.push(
          n,
          n + 1,
          n + 4,
          n + 1,
          n + 2,
          n + 4,
          n + 2,
          n + 3,
          n + 4,
          n + 3,
          n,
          n + 4,
        );
      }
    }
  }
  if (!source.materials.fern) {
    const fern = source.materials.moss.clone();
    fern.color.set('#496e46');
    fern.side = THREE.DoubleSide;
    source.materials.fern = fern;
  }
  source.mesh(
    'Authored arching fern leaflets',
    geometry(positions, indices, uv),
    source.materials.fern,
  );
}

function fallenLog(source: Source) {
  const x = -3.28;
  const z = 1.59;
  const y = terrainHeight(x, z) + 0.105;
  const log = cylinder(
    source,
    'Grove fallen pine log',
    0.125,
    0.103,
    0.63,
    [x, y, z],
    source.materials.bark,
    undefined,
    18,
  );
  log.rotation.z = Math.PI / 2;
  log.rotation.y = -0.23;
  const axis = v(Math.cos(-0.23), 0, -Math.sin(-0.23));
  for (const side of [-1, 1]) {
    const p = v(x, y, z).addScaledVector(axis, side * 0.321);
    const end = cylinder(
      source,
      'Log pale cut end grain',
      0.104,
      0.104,
      0.007,
      p.toArray(),
      source.materials.oakEnd,
      undefined,
      28,
    );
    end.quaternion.setFromUnitVectors(UP, axis);
    for (const radius of [0.029, 0.059, 0.088]) {
      const ring = torus(
        source,
        'Log concentric growth ring',
        radius,
        0.003,
        p.toArray(),
        source.materials.walnut,
      );
      ring.quaternion.setFromUnitVectors(v(0, 0, 1), axis);
    }
  }
  beam(
    source,
    'Log broken branch spur',
    v(x + 0.04, y + 0.07, z),
    v(x + 0.16, y + 0.18, z - 0.1),
    0.036,
    0.028,
    source.materials.bark,
  );
}

function riverBanks(source: Source) {
  const segments = 104;
  for (const side of [-1, 1]) {
    const positions: number[] = [];
    const uv: number[] = [];
    const indexBands: number[][] = [[], [], []];
    for (let row = 0; row <= segments; row++) {
      const z = -2.83 + (row / segments) * 5.57;
      const x = riverX(z);
      const normal = v(
        1,
        0,
        -0.47 * 1.12 * Math.cos(z * 1.12 + 0.38),
      ).normalize();
      const waterWidth = 0.245 + Math.sin(z * 2.3) * 0.025;
      for (let band = 0; band < 4; band++) {
        const width = waterWidth + [-0.011, 0.046, 0.128, 0.232][band];
        const p = v(x, 0, z).addScaledVector(normal, width * side);
        const ripple = Math.sin(z * 5.0 + side) * 0.009;
        const waterY = terrainHeight(x, z) + 0.12;
        p.y =
          band === 0
            ? waterY - 0.017
            : Math.max(
                waterY + 0.01,
                terrainHeight(p.x, p.z) +
                  [0, 0.025, 0.04, 0.004][band] +
                  ripple,
              );
        positions.push(...p.toArray());
        uv.push(band / 3, (row / segments) * 5);
        if (row < segments && band < 3) {
          const a = row * 4 + band;
          if (side === -1)
            indexBands[band].push(a, a + 1, a + 4, a + 1, a + 5, a + 4);
          else indexBands[band].push(a, a + 4, a + 1, a + 1, a + 4, a + 5);
        }
      }
    }
    const bank = geometry(positions, indexBands.flat(), uv);
    let start = 0;
    indexBands.forEach((indices, material) => {
      bank.addGroup(start, indices.length, material);
      start += indices.length;
    });
    source.mesh('Cut riverbank — stone, soil and rooted moss lip', bank, [
      source.materials.rockDark,
      source.materials.earth,
      source.materials.moss,
    ]);
  }
}

function meadow(source: Source) {
  const trees = [
    [-4.9, -1.02, 1.45, 0.2],
    [-4.52, -1.88, 1.9, 0.8],
    [-2.05, -2.16, 1.65, 1.5],
    [-2.69, -1.73, 1.33, 0.1],
    [-5.32, 0.07, 1.03, 0.7],
    [-2.68, 1.59, 1.49, 1.1],
    [-3.77, 1.74, 1.18, 1.7],
    [0.02, -2.2, 1.22, 0.8],
  ];
  trees.forEach(([x, z, h, turn]) => pine(source, x, z, h, turn));
  for (const [x, z, scale, turn] of [
    [-4.63, -1.47, 1.25, 0.4],
    [-4.25, -1.89, 1.15, 1.0],
    [-3.73, -1.97, 1.08, 0.7],
    [-2.84, -1.4, 1.3, 0.4],
    [-5.06, -0.34, 0.88, 1.3],
    [-4.51, 1.46, 1.05, 0.6],
    [-3.41, 1.55, 1.16, 1.4],
    [-2.94, 1.7, 1.0, 1.0],
    [-1.87, -1.77, 1.18, 0.4],
    [-0.49, -1.86, 1.04, 0.7],
    [-1.02, 1.58, 0.9, 1.3],
    [-1.38, 2.18, 0.95, 1.5],
    [0.22, -1.9, 0.9, 1.0],
    [0.24, 1.87, 0.92, 0.4],
  ])
    fernPatch(source, x, z, scale, turn);
  fallenLog(source);
  for (let i = 0; i < 34; i++) {
    const sourceZ = -2.62 + (i / 33) * 5.22;
    if (Math.abs(sourceZ + 0.06) < 0.5) continue;
    const z =
      Math.abs(sourceZ + 0.06) < 0.76
        ? sourceZ + (sourceZ < -0.06 ? -0.32 : 0.32)
        : sourceZ;
    const side = i % 2 === 0 ? 1 : -1;
    const x = riverX(z) + side * (0.29 + Math.sin(i * 1.7) * 0.04);
    rock(
      source,
      x,
      z,
      0.085 + (i % 5) * 0.012,
      i * 0.8,
      i % 3 === 0 ? source.materials.rockDark : source.materials.rockLight,
    );
  }
  for (const [x, z, size, turn] of [
    [-5.25, -0.08, 0.24, 0.1],
    [-3.52, 2.12, 0.18, 1.5],
    [-2.52, -2.02, 0.23, 0.3],
    [0.1, 1.66, 0.2, 2],
    [2.98, 1.95, 0.32, 0.5],
    [4.51, 0.54, 0.29, 1.5],
    [5.43, -0.12, 0.22, 0.3],
    [2.49, -1.7, 0.28, 0.3],
  ])
    rock(source, x, z, size, turn);
  for (let i = 0; i < 20; i++) {
    const x = -4.9 + (i % 7) * 0.44;
    const z = 0.87 + Math.floor(i / 7) * 0.3;
    const grass = source.mesh(
      'Small layered moss cushion',
      new THREE.SphereGeometry(0.08 + (i % 3) * 0.015, 10, 6),
      i % 2 === 0 ? source.materials.moss : source.materials.mossLight,
      v(x, terrainHeight(x, z) + 0.025, z),
    );
    grass.scale.y = 0.32;
  }
}

function stream(source: Source) {
  const positions: number[] = [];
  const uv: number[] = [];
  const indices: number[] = [];
  const segments = 120;
  for (let i = 0; i <= segments; i++) {
    const z = -2.85 + (i / segments) * 5.61;
    const x = riverX(z);
    const slope = 0.47 * 1.12 * Math.cos(z * 1.12 + 0.38);
    const normal = v(1, 0, -slope).normalize();
    const width = 0.245 + Math.sin(z * 2.3) * 0.025;
    for (const side of [-1, 1]) {
      const p = v(x, 0, z).addScaledVector(normal, side * width);
      p.y = terrainHeight(x, z) + 0.12;
      positions.push(p.x, p.y, p.z);
      uv.push(side === -1 ? 0 : 1, (i / segments) * 5);
    }
    if (i < segments) {
      const a = i * 2;
      indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  const water = source.mesh(
    'Sinuous recessed turquoise river',
    geometry(positions, indices, uv),
    source.materials.water,
  );
  water.castShadow = false;
  water.renderOrder = 1;
  const currents: { mesh: THREE.Mesh; base: number; lane: number }[] = [];
  for (let i = 0; i < 13; i++) {
    const length = 0.09 + (i % 3) * 0.045;
    const line = source.mesh(
      'Stable river-current reflection',
      new THREE.PlaneGeometry(0.015 + (i % 2) * 0.006, length),
      source.materials.current,
    );
    line.userData.triviaDynamic = true;
    line.rotation.x = -Math.PI / 2;
    line.castShadow = line.receiveShadow = false;
    line.renderOrder = 2;
    currents.push({ mesh: line, base: i / 13, lane: ((i % 3) - 1) * 0.083 });
  }
  return (time: number, reduced: boolean) => {
    for (const current of currents) {
      const progress = (current.base + (reduced ? 0 : time * 0.017)) % 1;
      const z = -2.76 + progress * 5.4;
      const x = riverX(z) + current.lane;
      current.mesh.position.set(x, terrainHeight(riverX(z), z) + 0.126, z);
      current.mesh.rotation.z = -Math.atan(
        0.47 * 1.12 * Math.cos(z * 1.12 + 0.38),
      );
      current.mesh.visible = Math.abs(z + 0.06) > 0.43;
    }
  };
}

function bridge(source: Source) {
  const m = source.materials;
  const centerZ = -0.06;
  const width = BRIDGE_WIDTH;
  const count = 16;
  for (let i = 0; i < count; i++) {
    const x = BRIDGE_MIN + ((i + 0.5) / count) * (BRIDGE_MAX - BRIDGE_MIN);
    const deckY = bridgeDeck(x);
    const plank = box(
      source,
      'Individually laid arched oak plank',
      [(BRIDGE_MAX - BRIDGE_MIN) / count - 0.008, 0.08, width],
      [x, deckY, centerZ],
      m.oak,
      0.012,
    );
    const t = (x - BRIDGE_MIN) / (BRIDGE_MAX - BRIDGE_MIN);
    plank.rotation.z = Math.atan(
      (Math.cos(t * Math.PI) * 0.26 * Math.PI) / (BRIDGE_MAX - BRIDGE_MIN),
    );
    for (const z of [-width * 0.38, width * 0.38]) {
      const pin = cylinder(
        source,
        'Plank brass pin',
        0.009,
        0.009,
        0.012,
        [x, deckY + 0.047, centerZ + z],
        m.brassDark,
        undefined,
        8,
      );
      pin.rotation.z = plank.rotation.z;
    }
  }
  for (const side of [-1, 1]) {
    const z = centerZ + side * width * 0.44;
    const timberPoints = Array.from({ length: 8 }, (_, i) => {
      const x = BRIDGE_MIN + (i / 7) * (BRIDGE_MAX - BRIDGE_MIN);
      return v(x, bridgeDeck(x) - 0.11, z);
    });
    tube(
      source,
      'Bent structural oak stringer',
      timberPoints,
      0.057,
      m.walnut,
      undefined,
      32,
    );
    const railPoints: THREE.Vector3[] = [];
    for (let post = 0; post < 5; post++) {
      const x = BRIDGE_MIN + (post / 4) * (BRIDGE_MAX - BRIDGE_MIN);
      const y = bridgeDeck(x);
      const zPost = centerZ + side * (width * 0.46);
      const timber = box(
        source,
        'Bridge pegged railing upright',
        [0.06, 0.48, 0.07],
        [x, y + 0.205, zPost],
        m.walnut,
        0.014,
      );
      timber.rotation.z = post === 0 ? -0.045 : post === 4 ? 0.045 : 0;
      box(
        source,
        'Railing cap with softened end grain',
        [0.085, 0.055, 0.09],
        [x, y + 0.45, zPost],
        m.oakEnd,
        0.014,
      );
      railPoints.push(v(x, y + 0.4, zPost));
      if (post < 4) {
        const next = BRIDGE_MIN + ((post + 1) / 4) * (BRIDGE_MAX - BRIDGE_MIN);
        railPoints.push(
          v((x + next) / 2, (y + bridgeDeck(next)) / 2 + 0.36, zPost),
        );
      }
    }
    tube(
      source,
      'Continuous braided bridge hand rope',
      railPoints,
      0.017,
      m.rope,
      undefined,
      56,
    );
    beam(
      source,
      'End bent diagonal bridge brace',
      v(BRIDGE_MIN - 0.12, 0.31, z),
      v(BRIDGE_MIN + 0.28, 0.6, z),
      0.06,
      0.055,
      m.walnut,
    );
    beam(
      source,
      'Far bent diagonal bridge brace',
      v(BRIDGE_MAX + 0.12, 0.31, z),
      v(BRIDGE_MAX - 0.28, 0.6, z),
      0.06,
      0.055,
      m.walnut,
    );
  }
  for (const x of [BRIDGE_MIN, BRIDGE_MAX]) {
    for (const z of [centerZ - width * 0.42, centerZ + width * 0.42]) {
      box(
        source,
        'Bridge stone bearing abutment',
        [0.25, 0.17, 0.36],
        [x, bridgeDeck(x) - 0.095, z],
        m.rockDark,
        0.045,
      );
    }
  }
}

function globe(source: Source) {
  const group = new THREE.Group();
  group.name = 'Atlas — compass globe in the pine grove';
  const x = -3.44;
  const z = -1.78;
  group.position.set(x, terrainHeight(x, z), z);
  source.root.add(group);
  const m = source.materials;
  cylinder(
    source,
    'Globe stone dais',
    0.4,
    0.38,
    0.11,
    [0, 0.045, 0],
    m.rockLight,
    group,
    40,
  );
  cylinder(
    source,
    'Turned globe brass foot',
    0.24,
    0.22,
    0.06,
    [0, 0.13, 0],
    m.brassDark,
    group,
    32,
  );
  const stand = source.mesh(
    'Globe turned pedestal',
    new THREE.LatheGeometry(
      [
        new THREE.Vector2(0.18, 0),
        new THREE.Vector2(0.18, 0.03),
        new THREE.Vector2(0.11, 0.07),
        new THREE.Vector2(0.07, 0.16),
        new THREE.Vector2(0.07, 0.26),
        new THREE.Vector2(0.12, 0.29),
      ],
      40,
    ),
    m.brass,
    v(0, 0.16, 0),
    group,
  );
  stand.receiveShadow = true;
  const ball = source.mesh(
    'Teal enamel terrestrial globe',
    new THREE.SphereGeometry(0.35, 48, 32),
    m.enamel,
    v(0, 0.77, 0),
    group,
  );
  const mapPoint = (longitude: number, latitude: number, radius = 0.356) =>
    v(
      Math.cos(latitude) * Math.sin(longitude) * radius,
      Math.sin(latitude) * radius + 0.77,
      Math.cos(latitude) * Math.cos(longitude) * radius,
    );
  const continents = [
    [
      [-1.9, 0.67],
      [-1.64, 0.92],
      [-1.12, 0.98],
      [-0.88, 0.75],
      [-1.03, 0.41],
      [-0.92, 0.14],
      [-1.28, 0.07],
      [-1.5, 0.4],
    ],
    [
      [-1.12, 0.02],
      [-0.91, -0.11],
      [-0.76, -0.53],
      [-1.01, -0.96],
      [-1.19, -0.67],
      [-1.39, -0.24],
    ],
    [
      [-0.1, 0.54],
      [0.16, 0.65],
      [0.37, 0.47],
      [0.43, 0.18],
      [0.3, -0.17],
      [0.06, -0.58],
      [-0.12, -0.27],
      [-0.27, 0.18],
    ],
    [
      [0.27, 0.53],
      [0.42, 0.87],
      [0.95, 0.95],
      [1.53, 0.82],
      [1.68, 0.47],
      [1.29, 0.24],
      [1.04, 0.12],
      [0.73, 0.36],
    ],
    [
      [1.31, -0.53],
      [1.64, -0.43],
      [1.95, -0.6],
      [1.79, -0.86],
      [1.41, -0.81],
    ],
  ];
  for (const polygon of continents) {
    const outline = polygon.map(
      ([longitude, latitude]) => new THREE.Vector2(longitude, latitude),
    );
    const triangles = THREE.ShapeUtils.triangulateShape(outline, []);
    const positions: number[] = [];
    const subdivision = 8;
    for (const triangle of triangles) {
      const [a, b, c] = triangle.map((index) => polygon[index]);
      const projected = (i: number, j: number) => {
        const weightB = i / subdivision;
        const weightC = j / subdivision;
        const weightA = 1 - weightB - weightC;
        return mapPoint(
          a[0] * weightA + b[0] * weightB + c[0] * weightC,
          a[1] * weightA + b[1] * weightB + c[1] * weightC,
        );
      };
      for (let row = 0; row < subdivision; row++) {
        for (let column = 0; column < subdivision - row; column++) {
          positions.push(
            ...projected(row, column).toArray(),
            ...projected(row + 1, column).toArray(),
            ...projected(row, column + 1).toArray(),
          );
          if (column < subdivision - row - 1)
            positions.push(
              ...projected(row + 1, column).toArray(),
              ...projected(row + 1, column + 1).toArray(),
              ...projected(row, column + 1).toArray(),
            );
        }
      }
    }
    const land = source.mesh(
      'Curved inlaid brass globe continent',
      geometry(positions),
      m.brass,
      v(),
      group,
    );
    land.castShadow = false;
  }
  for (const latitude of [-0.55, 0, 0.55]) {
    const ring = torus(
      source,
      'Globe latitude engraving',
      Math.cos(latitude) * 0.353,
      0.003,
      [0, 0.77 + Math.sin(latitude) * 0.353, 0],
      m.brassDark,
      group,
    );
    ring.rotation.x = Math.PI / 2;
  }
  const gimbal = torus(
    source,
    'Tilted globe meridian gimbal',
    0.415,
    0.023,
    [0, 0.77, 0],
    m.brass,
    group,
  );
  gimbal.rotation.z = -0.32;
  const horizon = torus(
    source,
    'Globe horizon support ring',
    0.4,
    0.012,
    [0, 0.69, 0],
    m.brassDark,
    group,
  );
  horizon.rotation.x = Math.PI / 2;
  cylinder(
    source,
    'Globe axis top finial',
    0.033,
    0.013,
    0.075,
    [0.12, 1.17, 0],
    m.brass,
    group,
  );
  ball.rotation.y = 0.3;
}

function tent(source: Source) {
  const camp = new THREE.Group();
  camp.name = 'Years — canvas camp and time dial';
  const x = 0.73;
  const z = -1.43;
  camp.position.set(x, terrainHeight(x, z) + 0.018, z);
  camp.rotation.y = -0.11;
  source.root.add(camp);
  const m = source.materials;
  box(
    source,
    'Camp sewn groundsheet',
    [1.55, 0.035, 1.08],
    [0, 0.01, 0],
    m.canvasDark,
    0.025,
    camp,
  );
  const halfWidth = 0.68;
  const halfDepth = 0.48;
  const ridgeHeight = 0.95;
  const segments = 20;
  for (const side of [-1, 1]) {
    const positions: number[] = [];
    const uv: number[] = [];
    const indices: number[] = [];
    for (let row = 0; row <= segments; row++) {
      const along = row / segments;
      const z0 = -halfDepth + along * halfDepth * 2;
      for (let cross = 0; cross <= 12; cross++) {
        const t = cross / 12;
        const y =
          ridgeHeight * (1 - t) +
          0.085 * t -
          Math.sin(t * Math.PI) * Math.sin(along * Math.PI) * 0.035;
        const x0 = t * halfWidth * side;
        positions.push(x0, y, z0);
        uv.push(along, t);
        if (row < segments && cross < 12) {
          const a = row * 13 + cross;
          if (side === 1) indices.push(a, a + 13, a + 1, a + 1, a + 13, a + 14);
          else indices.push(a, a + 1, a + 13, a + 1, a + 14, a + 13);
        }
      }
    }
    const canvas = source.mesh(
      'Tensioned woven tent fly',
      geometry(positions, indices, uv),
      m.canvas,
      v(),
      camp,
    );
    canvas.material = m.canvas;
    for (const z0 of [-halfDepth, halfDepth]) {
      tube(
        source,
        'Raised tent panel binding',
        [
          v(0, ridgeHeight + 0.006, z0),
          v(halfWidth * side * 0.5, ridgeHeight * 0.52, z0),
          v(halfWidth * side, 0.09, z0),
        ],
        0.012,
        m.canvasSeam,
        camp,
        20,
      );
    }
    tube(
      source,
      'Tent lower hem and stitch welt',
      [
        v(halfWidth * side, 0.09, -halfDepth),
        v(halfWidth * side, 0.075, 0),
        v(halfWidth * side, 0.09, halfDepth),
      ],
      0.012,
      m.canvasSeam,
      camp,
      18,
    );
    for (const end of [-1, 1]) {
      const a = v(halfWidth * side * 0.83, 0.23, halfDepth * end);
      const b = v(halfWidth * side * 1.27, 0.012, halfDepth * end * 1.45);
      tube(
        source,
        'Anchored tent guy rope',
        [
          a,
          a
            .clone()
            .lerp(b, 0.5)
            .add(v(0, -0.018, 0)),
          b,
        ],
        0.008,
        m.rope,
        camp,
        14,
      );
      const peg = cylinder(
        source,
        'Brass angled tent stake',
        0.016,
        0.011,
        0.105,
        [b.x, 0.026, b.z],
        m.brassDark,
        camp,
        8,
      );
      peg.rotation.z = side * 0.26;
    }
  }
  const back = geometry(
    [
      -halfWidth,
      0.083,
      -halfDepth,
      halfWidth,
      0.083,
      -halfDepth,
      0,
      ridgeHeight,
      -halfDepth,
    ],
    [0, 2, 1],
    [0, 0, 1, 0, 0.5, 1],
  );
  source.mesh('Closed rear tent panel', back, m.canvasDark, v(), camp);
  for (const side of [-1, 1]) {
    const positions = [
      0,
      ridgeHeight,
      halfDepth + 0.008,
      side * halfWidth,
      0.082,
      halfDepth + 0.008,
      side * 0.21,
      0.075,
      halfDepth + 0.035,
      side * 0.07,
      0.74,
      halfDepth + 0.02,
    ];
    source.mesh(
      'Tied-back entrance fly',
      geometry(
        positions,
        side === 1 ? [0, 1, 3, 1, 2, 3] : [0, 3, 1, 1, 3, 2],
        [0.5, 1, 1, 0, 0.7, 0, 0.55, 0.7],
      ),
      m.canvasSeam,
      v(),
      camp,
    );
    tube(
      source,
      'Tent entrance folded edge',
      [
        v(0, ridgeHeight, halfDepth + 0.011),
        v(side * 0.07, 0.74, halfDepth + 0.029),
        v(side * 0.21, 0.075, halfDepth + 0.039),
      ],
      0.008,
      m.canvasDark,
      camp,
      12,
    );
  }
  for (const z0 of [-halfDepth, halfDepth]) {
    beam(
      source,
      'Tent rigid ridge support',
      v(0, 0.027, z0),
      v(0, ridgeHeight + 0.065, z0),
      0.027,
      0.027,
      m.walnut,
      camp,
    );
    cylinder(
      source,
      'Ridge brass finial',
      0.026,
      0.015,
      0.08,
      [0, ridgeHeight + 0.07, z0],
      m.brass,
      camp,
      12,
    );
  }
  tube(
    source,
    'Tent taut ridge binding',
    [
      v(0, ridgeHeight + 0.012, -halfDepth),
      v(0, ridgeHeight - 0.011, 0),
      v(0, ridgeHeight + 0.012, halfDepth),
    ],
    0.013,
    m.canvasSeam,
    camp,
    22,
  );
  const rolled = cylinder(
    source,
    'Rolled sleeping mat',
    0.09,
    0.09,
    0.4,
    [-0.31, 0.12, 0.29],
    m.pineLight,
    camp,
    24,
  );
  rolled.rotation.z = Math.PI / 2;
  for (const x0 of [-0.43, -0.18]) {
    const binding = torus(
      source,
      'Bedroll leather cinch',
      0.091,
      0.009,
      [x0, 0.12, 0.29],
      m.leather,
      camp,
    );
    binding.rotation.y = Math.PI / 2;
  }
  const flag = new THREE.Group();
  flag.name = 'Tent wind pennant';
  flag.userData.triviaDynamic = true;
  flag.position.set(0, ridgeHeight + 0.27, -halfDepth);
  camp.add(flag);
  beam(
    source,
    'Pennant brass pole',
    v(0, ridgeHeight + 0.04, -halfDepth),
    v(0, ridgeHeight + 0.32, -halfDepth),
    0.012,
    0.012,
    m.brass,
    camp,
  );
  const flagGeometry = geometry(
    [0, 0, 0, 0.25, -0.018, 0, 0.175, -0.07, 0, 0.25, -0.13, 0, 0, -0.13, 0],
    [0, 1, 2, 0, 2, 4, 2, 3, 4],
  );
  const flagMaterial = m.enamel.clone();
  flagMaterial.side = THREE.DoubleSide;
  source.materials.flag = flagMaterial;
  const pennant = source.mesh(
    'Stitched teal camp pennant',
    flagGeometry,
    flagMaterial,
    v(),
    flag,
  );
  const originalFlag = flagGeometry.getAttribute('position').array.slice();

  const dialX = 1.61;
  // The dial lives in the camp clearing, outside both complete traveller lanes.
  const dialZ = 2.3;
  const dialY = terrainHeight(dialX, dialZ);
  source.mesh(
    'Time-dial carved tapered stone pedestal',
    new THREE.LatheGeometry(
      [
        new THREE.Vector2(0.27, 0),
        new THREE.Vector2(0.28, 0.04),
        new THREE.Vector2(0.23, 0.08),
        new THREE.Vector2(0.18, 0.29),
        new THREE.Vector2(0.23, 0.32),
        new THREE.Vector2(0.27, 0.34),
      ],
      32,
    ),
    m.rockLight,
    v(dialX, dialY, dialZ),
  );
  const dialFace = dialY + 0.37;
  cylinder(
    source,
    'Bronze sundial circular face',
    0.27,
    0.27,
    0.035,
    [dialX, dialFace, dialZ],
    m.brassDark,
    undefined,
    40,
  );
  const dialRim = torus(
    source,
    'Sundial turned outer lip',
    0.255,
    0.014,
    [dialX, dialFace + 0.024, dialZ],
    m.brass,
  );
  dialRim.rotation.x = Math.PI / 2;
  for (let tick = 0; tick < 12; tick++) {
    const a = (tick / 12) * TAU;
    const b = box(
      source,
      'Sundial cast hour notch',
      [0.013, 0.008, tick % 3 === 0 ? 0.05 : 0.032],
      [
        dialX + Math.sin(a) * 0.207,
        dialFace + 0.023,
        dialZ + Math.cos(a) * 0.207,
      ],
      m.brass,
      0.002,
    );
    b.rotation.y = a;
  }
  const gnomon = source.mesh(
    'Sundial triangular brass gnomon',
    new THREE.ExtrudeGeometry(
      new THREE.Shape([
        new THREE.Vector2(-0.15, 0),
        new THREE.Vector2(0.13, 0),
        new THREE.Vector2(0.05, 0.25),
      ]),
      {
        depth: 0.017,
        bevelEnabled: true,
        bevelSegments: 2,
        bevelSize: 0.003,
        bevelThickness: 0.003,
      },
    ),
    m.brass,
    v(dialX, dialFace + 0.026, dialZ - 0.008),
  );
  gnomon.rotation.y = -0.25;
  return (time: number, reduced: boolean) => {
    const positions = flagGeometry.getAttribute('position');
    for (let i = 0; i < positions.count; i++) {
      const x0 = originalFlag[i * 3] as number;
      positions.setZ(
        i,
        reduced ? 0 : Math.sin(time * 1.5 + x0 * 11) * x0 * 0.13,
      );
    }
    positions.needsUpdate = true;
    flagGeometry.computeVertexNormals();
    pennant.rotation.y = reduced ? 0 : Math.sin(time * 0.7) * 0.035;
  };
}

function mountain(
  source: Source,
  x: number,
  z: number,
  radius: number,
  height: number,
  seed: number,
) {
  const group = new THREE.Group();
  group.name = 'Authored alpine ridge and snow planes';
  group.position.set(x, terrainHeight(x, z) - 0.04, z);
  source.root.add(group);
  const rings = [0, 0.17, 0.4, 0.68, 0.85, 1];
  const radii = [1, 0.88, 0.61, 0.36, 0.14, 0];
  const sides = 14;
  const positions: number[] = [];
  const indices: number[] = [];
  const uv: number[] = [];
  for (let ring = 0; ring < rings.length; ring++) {
    const rise = rings[ring];
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * TAU + Math.sin(i * 2.31 + seed) * 0.05;
      const ridge =
        1 + Math.sin(i * 2.7 + seed) * 0.12 + (i % 2 === 0 ? 0.07 : -0.03);
      const r = radius * radii[ring] * ridge;
      const y =
        height * rise +
        (ring === 0 || ring === rings.length - 1
          ? 0
          : Math.sin(i * 2.1 + ring * 0.5 + seed) * height * 0.028);
      positions.push(
        Math.cos(a) * r + rise * radius * 0.12,
        y,
        Math.sin(a) * r * 0.7 - rise * radius * 0.06,
      );
      uv.push(i / sides, rise);
      if (ring > 0) {
        const a0 = (ring - 1) * sides + i;
        const b0 = (ring - 1) * sides + ((i + 1) % sides);
        indices.push(a0, a0 + sides, b0, b0, a0 + sides, b0 + sides);
      }
    }
  }
  const facets = geometry(positions, indices, uv).toNonIndexed();
  facets.computeVertexNormals();
  facets.clearGroups();
  const trianglesPerBand = sides * 6;
  facets.addGroup(0, trianglesPerBand * 3, 0);
  facets.addGroup(trianglesPerBand * 3, trianglesPerBand * 2, 1);
  source.mesh(
    'Cleaved rock faces and angular snow cornice',
    facets,
    [source.materials.rock, source.materials.snow],
    v(),
    group,
  );
  for (let ledge = 0; ledge < 3; ledge++) {
    const a = seed + ledge * 1.9;
    const dx = Math.cos(a) * radius * 0.6;
    const dz = Math.sin(a) * radius * 0.45;
    const spur = source.mesh(
      'Ridge angular lower buttress',
      new THREE.DodecahedronGeometry(radius * 0.25, 0),
      ledge === 1 ? source.materials.rockDark : source.materials.rockLight,
      v(dx, height * 0.16, dz),
      group,
    );
    spur.scale.set(1, 1.2, 0.7);
    spur.rotation.set(0.12, a, 0.15);
  }
}

function starGeometry(radius = 0.1, thickness = 0.025) {
  const shape = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 2 + (i / 10) * TAU;
    const r = i % 2 === 0 ? radius : radius * 0.44;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: true,
    bevelSegments: 3,
    bevelSize: thickness * 0.25,
    bevelThickness: thickness * 0.25,
  });
}

function summit(source: Source) {
  mountain(source, 3.13, -1.69, 0.83, 1.75, 0.3);
  mountain(source, 4.18, -1.96, 1.06, 2.43, 1.3);
  mountain(source, 5.22, -1.66, 0.69, 1.53, 2.8);
  const p = trailPoint(12);
  const x = p.x + 0.15;
  const z = p.z + 1.08;
  const y = terrainHeight(x, z) + 0.012;
  const trophy = new THREE.Group();
  trophy.name = 'Order — summit brass trophy beacon';
  trophy.position.set(x, y, z);
  source.root.add(trophy);
  const m = source.materials;
  cylinder(
    source,
    'Summit trophy stone dais',
    0.32,
    0.3,
    0.14,
    [0, 0.07, 0],
    m.rockLight,
    trophy,
    40,
  );
  box(
    source,
    'Trophy inset walnut foot',
    [0.34, 0.1, 0.31],
    [0, 0.19, 0],
    m.walnut,
    0.035,
    trophy,
  );
  cylinder(
    source,
    'Trophy turned brass base',
    0.19,
    0.18,
    0.045,
    [0, 0.267, 0],
    m.brassDark,
    trophy,
    40,
  );
  const cupProfile = [
    [0.16, 0],
    [0.16, 0.025],
    [0.105, 0.05],
    [0.063, 0.085],
    [0.052, 0.2],
    [0.078, 0.24],
    [0.145, 0.29],
    [0.205, 0.39],
    [0.224, 0.52],
    [0.218, 0.55],
    [0.197, 0.55],
    [0.19, 0.43],
    [0.132, 0.32],
    [0.063, 0.29],
  ].map(([r, h]) => new THREE.Vector2(r, h));
  source.mesh(
    'Hollow trophy cup with turned stem',
    new THREE.LatheGeometry(cupProfile, 64),
    m.brass,
    v(0, 0.29, 0),
    trophy,
  );
  const lip = torus(
    source,
    'Trophy rolled cup lip',
    0.207,
    0.015,
    [0, 0.84, 0],
    m.brass,
    trophy,
  );
  lip.rotation.x = Math.PI / 2;
  for (const side of [-1, 1]) {
    tube(
      source,
      'Swept trophy open handle',
      [
        v(side * 0.18, 0.78, 0),
        v(side * 0.31, 0.76, 0),
        v(side * 0.34, 0.65, 0),
        v(side * 0.26, 0.56, 0),
        v(side * 0.15, 0.61, 0),
      ],
      0.023,
      m.brass,
      trophy,
      36,
    );
  }
  for (let flute = 0; flute < 12; flute++) {
    const a = (flute / 12) * TAU;
    tube(
      source,
      'Restrained trophy cup fluting',
      [
        v(Math.cos(a) * 0.143, 0.59, Math.sin(a) * 0.143),
        v(Math.cos(a) * 0.199, 0.72, Math.sin(a) * 0.199),
        v(Math.cos(a) * 0.221, 0.8, Math.sin(a) * 0.221),
      ],
      0.0034,
      m.brassDark,
      trophy,
      10,
    );
  }
  beam(
    source,
    'Trophy star narrow stem',
    v(0, 0.81, 0),
    v(0, 1.025, 0),
    0.012,
    0.012,
    m.brass,
    trophy,
  );
  const star = source.mesh(
    'Summit trophy polished star',
    starGeometry(0.13, 0.03),
    m.brass,
    v(0, 1.04, -0.015),
    trophy,
  );
  star.userData.triviaDynamic = true;
  const gleamMaterial = m.brass.clone();
  gleamMaterial.color.set('#fff4b9');
  gleamMaterial.emissive.set('#c79e4b');
  gleamMaterial.emissiveIntensity = 0.2;
  source.materials.gleam = gleamMaterial;
  const gleam = source.mesh(
    'Controlled trophy star highlight',
    starGeometry(0.032, 0.006),
    gleamMaterial,
    v(0.067, 1.104, 0.023),
    trophy,
  );
  gleam.userData.triviaDynamic = true;
  gleam.castShadow = false;
  return (time: number, reduced: boolean) => {
    const strength = reduced ? 0.25 : (Math.sin(time * 0.75) + 1) * 0.5;
    gleamMaterial.emissiveIntensity = 0.08 + strength * 0.32;
    gleam.scale.setScalar(0.84 + strength * 0.22);
    star.rotation.y = reduced ? 0 : Math.sin(time * 0.55) * 0.017;
  };
}

export function createTriviaExpedition({
  runtime = false,
}: ModelOptions = {}): DisposableRoot & {
  point: (distance: number, lateral?: number) => THREE.Vector3;
  surfaceAt: (x: number, z: number) => THREE.Vector3;
  normalAt: (x: number, z: number) => THREE.Vector3;
  update: (time: number, reduced: boolean) => void;
} {
  const source = sourceRoot(
    'Trivia Expedition — four-landmark carved miniature',
  );
  plinth(source);
  terrain(source);
  const updateWater = stream(source);
  riverBanks(source);
  trail(source);
  bridge(source);
  meadow(source);
  globe(source);
  const updateCamp = tent(source);
  const updateSummit = summit(source);
  const update = (time: number, reduced: boolean) => {
    updateWater(time, reduced);
    updateCamp(time, reduced);
    updateSummit(time, reduced);
  };
  update(0, true);
  if (runtime) {
    consolidateRuntime(source, source.root);
    releaseSupersededGeometry(source);
  }
  source.root.userData.triviaBounds = { width: 12.8, depth: 6.4, height: 5.4 };
  source.root.userData.dispose = source.dispose;
  return {
    root: source.root,
    point: trailPoint,
    surfaceAt,
    normalAt,
    update,
    dispose: source.dispose,
  };
}

function soleShape() {
  const shape = new THREE.Shape();
  shape.moveTo(-0.15, -0.25);
  shape.bezierCurveTo(-0.24, -0.29, -0.265, -0.03, -0.215, 0.23);
  shape.bezierCurveTo(-0.2, 0.36, -0.12, 0.405, 0, 0.4);
  shape.bezierCurveTo(0.13, 0.41, 0.23, 0.36, 0.235, 0.23);
  shape.bezierCurveTo(0.275, -0.08, 0.23, -0.29, 0.145, -0.25);
  shape.quadraticCurveTo(0, -0.27, -0.15, -0.25);
  shape.closePath();
  return shape;
}

function bootUpper() {
  const profile = [
    { z: -0.37, width: 0.07, crown: 0.145 },
    { z: -0.3, width: 0.2, crown: 0.205 },
    { z: -0.14, width: 0.22, crown: 0.265 },
    { z: 0.015, width: 0.21, crown: 0.36 },
    { z: 0.14, width: 0.18, crown: 0.55 },
    { z: 0.27, width: 0.175, crown: 0.56 },
  ];
  const positions: number[] = [];
  const uv: number[] = [];
  const indices: number[] = [];
  const sides = 20;
  for (let ring = 0; ring < profile.length; ring++) {
    const { z, width, crown } = profile[ring];
    for (let i = 0; i <= sides; i++) {
      const a = (i / sides) * Math.PI;
      const x = Math.cos(a) * width;
      const y = 0.076 + Math.sin(a) ** 0.8 * crown;
      const pinch = ring === 3 ? Math.sin(a) * 0.014 : 0;
      positions.push(x, y, z + pinch);
      uv.push(i / sides, ring / (profile.length - 1));
      if (ring > 0 && i < sides) {
        const p = (ring - 1) * (sides + 1) + i;
        const q = p + sides + 1;
        indices.push(p, p + 1, q, p + 1, q + 1, q);
      }
    }
  }
  return geometry(positions, indices, uv);
}

export function createTriviaTraveller(
  color: string,
  { runtime = false }: ModelOptions = {},
): DisposableRoot & {
  update: (time: number, moving: boolean, reduced: boolean) => void;
} {
  const source = sourceRoot(
    'Expedition traveller — stitched leather compass boot',
  );
  const m = source.materials;
  const boot = new THREE.Group();
  boot.name = 'Grounded boot rocking pivot';
  boot.userData.triviaDynamic = true;
  boot.position.y = 0.035;
  source.root.add(boot);
  const enamel = m.enamel.clone();
  enamel.color.set(color);
  source.materials.seat = enamel;
  const plate = cylinder(
    source,
    'Traveller satin brass contact plate',
    0.3,
    0.29,
    0.025,
    [0, 0.015, 0],
    m.brassDark,
    undefined,
    48,
  );
  plate.scale.z = 1.25;
  const plateEnamel = cylinder(
    source,
    'Traveller visible seat-colour enamel footplate',
    0.274,
    0.274,
    0.008,
    [0, 0.03, 0],
    enamel,
    undefined,
    48,
  );
  plateEnamel.scale.z = 1.25;
  const footRing = torus(
    source,
    'Traveller contact plate rolled rim',
    0.289,
    0.013,
    [0, 0.027, 0],
    m.brass,
  );
  footRing.rotation.x = -Math.PI / 2;
  footRing.scale.y = 1.25;
  const sole = source.mesh(
    'Shaped rubber boot tread sole',
    new THREE.ExtrudeGeometry(soleShape(), {
      depth: 0.062,
      bevelEnabled: true,
      bevelSegments: 3,
      bevelSize: 0.014,
      bevelThickness: 0.01,
      curveSegments: 20,
    }),
    m.sole,
    v(0, 0.015, 0),
    boot,
  );
  sole.rotation.x = -Math.PI / 2;
  const welt = source.mesh(
    'Boot stitched leather welt',
    new THREE.ExtrudeGeometry(soleShape(), {
      depth: 0.018,
      bevelEnabled: true,
      bevelSegments: 3,
      bevelSize: 0.01,
      bevelThickness: 0.006,
      curveSegments: 20,
    }),
    m.leather,
    v(0, 0.084, 0),
    boot,
  );
  welt.rotation.x = -Math.PI / 2;
  source.mesh(
    'Authored shaped leather boot upper',
    bootUpper(),
    m.leather,
    v(),
    boot,
  );
  const toe = source.mesh(
    'Boot reinforced rounded toe panel',
    new THREE.SphereGeometry(1, 28, 14, 0, TAU, 0, Math.PI / 2),
    m.leather,
    v(0, 0.073, -0.24),
    boot,
  );
  toe.scale.set(0.218, 0.205, 0.145);
  const cuffColour = enamel.clone();
  cuffColour.roughness = 0.84;
  cuffColour.metalness = 0;
  cuffColour.map = m.canvas.map;
  source.materials.cuffColour = cuffColour;
  const ankle = source.mesh(
    'Boot rolled seat-colour woven ankle cuff',
    new THREE.TorusGeometry(0.17, 0.037, 12, 48),
    cuffColour,
    v(0, 0.579, 0.194),
    boot,
  );
  ankle.rotation.x = Math.PI / 2;
  ankle.scale.y = 0.63;
  const cuffInterior = cylinder(
    source,
    'Boot dark inset cuff interior',
    0.133,
    0.13,
    0.03,
    [0, 0.568, 0.194],
    m.sole,
    boot,
    32,
  );
  cuffInterior.scale.z = 0.7;
  tube(
    source,
    'Boot heel reinforced seam',
    [
      v(-0.14, 0.1, 0.27),
      v(-0.155, 0.31, 0.27),
      v(-0.11, 0.54, 0.26),
      v(0.11, 0.54, 0.26),
      v(0.155, 0.31, 0.27),
      v(0.14, 0.1, 0.27),
    ],
    0.006,
    m.canvasSeam,
    boot,
    26,
  );
  tube(
    source,
    'Boot curved toe-cap seam',
    [
      v(-0.205, 0.118, -0.2),
      v(-0.13, 0.236, -0.18),
      v(0, 0.278, -0.18),
      v(0.13, 0.236, -0.18),
      v(0.205, 0.118, -0.2),
    ],
    0.005,
    m.canvasSeam,
    boot,
    26,
  );
  const eyelets: THREE.Vector3[][] = [];
  for (let row = 0; row < 4; row++) {
    const z = -0.08 + row * 0.062;
    const y = 0.329 + row * 0.067;
    const span = 0.11 - row * 0.008;
    eyelets.push([v(-span, y, z), v(span, y, z)]);
    for (const side of [-1, 1]) {
      const eyelet = torus(
        source,
        'Boot brass lace eyelet',
        0.016,
        0.005,
        [side * span, y, z],
        m.brass,
        boot,
      );
      eyelet.rotation.x = -0.65;
    }
  }
  for (let row = 0; row < 3; row++) {
    for (const side of [0, 1]) {
      const a = eyelets[row][side];
      const b = eyelets[row + 1][1 - side];
      const mid = a
        .clone()
        .lerp(b, 0.5)
        .add(v(0, 0.014, -0.009));
      tube(
        source,
        'Boot crossed braided lace',
        [a, mid, b],
        0.007,
        m.rope,
        boot,
        14,
      );
    }
  }
  for (const side of [-1, 1]) {
    tube(
      source,
      'Boot tied lace loop',
      [
        v(0, 0.557, 0.13),
        v(side * 0.042, 0.576, 0.14),
        v(side * 0.057, 0.55, 0.11),
        v(0, 0.557, 0.13),
      ],
      0.006,
      m.rope,
      boot,
      16,
    );
  }
  for (let stitch = 0; stitch < 20; stitch++) {
    const a = (stitch / 20) * TAU;
    const x = Math.cos(a) * 0.212;
    const z = Math.sin(a) * 0.304 - 0.023;
    const detail = box(
      source,
      'Boot individual welt stitch',
      [0.005, 0.004, 0.022],
      [x, 0.108, z],
      m.canvasSeam,
      0.001,
      boot,
    );
    detail.rotation.y = -a + Math.PI / 2;
  }
  for (let tread = 0; tread < 6; tread++) {
    box(
      source,
      'Boot molded tread rib',
      [0.36, 0.025, 0.026],
      [0, 0.025, -0.22 + tread * 0.092],
      m.sole,
      0.007,
      boot,
    );
  }
  const badge = new THREE.Group();
  badge.name = 'Seat-colour compass enamel badge';
  badge.userData.triviaDynamic = true;
  badge.position.set(-0.183, 0.38, 0.175);
  badge.rotation.z = -Math.PI / 2;
  boot.add(badge);
  cylinder(
    source,
    'Traveller brass compass surround',
    0.093,
    0.093,
    0.022,
    [0, 0, 0],
    m.brass,
    badge,
    40,
  );
  cylinder(
    source,
    'Traveller seat enamel compass face',
    0.078,
    0.078,
    0.007,
    [0, 0.016, 0],
    enamel,
    badge,
    40,
  );
  const badgeRim = torus(
    source,
    'Traveller compass dial rim',
    0.076,
    0.005,
    [0, 0.022, 0],
    m.brass,
    badge,
  );
  badgeRim.rotation.x = Math.PI / 2;
  const needle = source.mesh(
    'Traveller compass brass needle',
    geometry(
      [-0.009, 0.023, 0, 0, 0.023, -0.061, 0.009, 0.023, 0, 0, 0.023, 0.048],
      [0, 1, 2, 0, 2, 3],
    ),
    m.brass,
    v(),
    badge,
  );
  needle.castShadow = false;
  cylinder(
    source,
    'Traveller compass centre pin',
    0.011,
    0.011,
    0.009,
    [0, 0.027, 0],
    m.brassDark,
    badge,
    12,
  );
  const update = (time: number, moving: boolean, reduced: boolean) => {
    const roll = !reduced && moving ? Math.sin(time * 12) * 0.045 : 0;
    const pitch = !reduced && moving ? Math.sin(time * 12 + 0.5) * 0.018 : 0;
    boot.rotation.z = roll;
    // Compensate the rolling sole edge: the contact plate remains on ground.
    boot.position.y =
      0.035 +
      Math.abs(Math.sin(roll)) * 0.245 +
      Math.abs(Math.sin(pitch)) * 0.405;
    boot.rotation.x = pitch;
    badge.rotation.y =
      !reduced && moving ? Math.sin(time * 12 - 0.5) * 0.035 : 0;
  };
  update(0, false, true);
  if (runtime) {
    consolidateRuntime(source, badge);
    consolidateRuntime(source, boot);
    consolidateRuntime(source, source.root);
    releaseSupersededGeometry(source);
  }
  source.root.userData.dispose = source.dispose;
  return { root: source.root, update, dispose: source.dispose };
}
