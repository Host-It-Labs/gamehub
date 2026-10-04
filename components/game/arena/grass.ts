import * as THREE from 'three';
import type { Textures } from './materials';
import { forestAt, groundHeight, laneAndRing, sampleNoise } from './terrain';
import { WIND_GLSL, type Wind } from './wind';

/**
 * Real grass over the meadow: about 150 000 blades (some 200 a square
 * metre on the field), each a
 * tapered three-triangle leaf standing on the painted turf and coloured by
 * the turf beneath its root, so the blades grow out of the ground's own
 * paint rather than sitting on it. They bend and flutter with the valley's
 * wind (wind.ts) and pale where a gust lays them over, the same gust that
 * puts a sheen on the turf, and they share its drifting cloud shadows.
 *
 * Grass grows over the field's meadow and a few metres beyond its walls,
 * thinner in the woods, never on the lanes, the river banks or under the
 * walls, and shorter where it meets a lane, so placement reads as before.
 * Blades are instances of one five-vertex leaf, with their root, height and
 * colour worked out once here. They draw after the scenery without writing
 * depth: they hide the ground and troops' feet where they stand in front,
 * but the x-ray pass never takes them for cover and the drop zone, rings
 * and ghost still draw over them. Chunks of six metres are culled by the
 * camera; `setDensity` thins every chunk evenly (blades are shuffled) for
 * the pacer's lower rungs.
 */

const CHUNK = 6;

function smooth(a: number, b: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** How thick (0–1) and how tall (a factor) the grass is at a point. */
export function grassAt(noise: THREE.DataTexture, x: number, z: number) {
  const ax = Math.abs(x);
  const az = Math.abs(z);
  // The river, its banks and the bridges.
  if (az < 1.6) return { dense: 0, tall: 0 };
  const bank = smooth(1.6, 2.05, az);
  // The walls themselves.
  const inWallX = ax > 9.5 && ax < 10.1 && az < 17.5;
  const inWallZ = az > 16.9 && az < 17.5 && ax < 10.1;
  if (inWallX || inWallZ) return { dense: 0, tall: 0 };
  const inside = ax < 9.5 && az < 16.9;
  if (inside) {
    const { path, ring } = laneAndRing(x, z);
    // Lanes are about half a metre wide with a worn shoulder; the tower
    // spots' rings reach past the buildings, so grass grows up to them.
    const lane = smooth(0.6, 0.95, path);
    // Thinning over the trodden earth at the towers' feet (terrain.ts).
    const tower = smooth(-1.15, -0.4, ring);
    const dense = lane * tower * bank;
    const tall =
      (0.55 + 0.45 * smooth(0.75, 1.7, path)) *
      (0.7 + 0.3 * bank) *
      (0.6 + 0.4 * smooth(-0.6, 0.4, ring));
    return { dense, tall };
  }
  // Beyond the walls: meadow clearings thick, the forest floor sparse,
  // fading out a few metres from the field where the scattered tufts and
  // the woods take over.
  const out = Math.hypot(Math.max(0, ax - 10.1), Math.max(0, az - 17.5));
  const woods = forestAt(noise, x, z);
  const fade = 1 - smooth(3, 6.5, out);
  const dense = (0.5 - 0.4 * woods) * fade * bank;
  return { dense, tall: 0.85 + 0.35 * (1 - woods) };
}

/** A small copy of the turf tile's pixels, to colour each blade by the
 *  paint under its root (linear RGB). */
function turfSampler(textures: Textures) {
  const image = textures.grass?.map.image as CanvasImageSource | undefined;
  const size = 256;
  let data: Uint8ClampedArray | undefined;
  if (image && typeof document !== 'undefined') {
    try {
      const c = document.createElement('canvas');
      c.width = c.height = size;
      const g = c.getContext('2d', { willReadFrequently: true });
      if (g) {
        g.drawImage(image, 0, 0, size, size);
        data = g.getImageData(0, 0, size, size).data;
      }
    } catch {
      data = undefined;
    }
  }
  const lin = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    const c = i / 255;
    lin[i] = c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }
  return (u: number, v: number, out: number[]) => {
    if (!data) {
      out[0] = 0.085;
      out[1] = 0.25;
      out[2] = 0.1;
      return;
    }
    const x = Math.floor((((u % 1) + 1) % 1) * size);
    const y = Math.floor((((v % 1) + 1) % 1) * size);
    const i = (y * size + x) * 4;
    out[0] = lin[data[i]];
    out[1] = lin[data[i + 1]];
    out[2] = lin[data[i + 2]];
  };
}

/** Blades per clump, and the clump's side in metres. */
const CLUMP_BLADES = 28;
const CLUMP = 0.37;

/**
 * One clump: CLUMP_BLADES leaves, each two tapered segments and a point,
 * scattered over a CLUMP-metre square. Drawn as instances (one per clump);
 * a GPU wastes most of its work on instances of a single leaf.
 */
function clump(seedStart: number) {
  let seed = seedStart;
  const rnd = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const corner = [-0.5, 0, 0.5, 0, -0.34, 0.5, 0.34, 0.5, 0, 1];
  const position: number[] = [];
  const blade: number[] = [];
  const index: number[] = [];
  // Jittered cells, so blades spread evenly with no bald spots.
  const side = Math.ceil(Math.sqrt(CLUMP_BLADES));
  for (let b = 0; b < CLUMP_BLADES; b++) {
    const ox = ((b % side) + rnd()) / side;
    const oz = (Math.floor(b / side) + rnd()) / side;
    const angle = rnd();
    const r = rnd();
    for (let k = 0; k < 5; k++) {
      position.push(corner[k * 2], corner[k * 2 + 1], 0);
      blade.push(ox * CLUMP, oz * CLUMP, angle, r);
    }
    const o = b * 5;
    index.push(o, o + 1, o + 3, o, o + 3, o + 2, o + 2, o + 3, o + 4);
  }
  const geo = new THREE.InstancedBufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  // Lit straight up; the shader sets the real normal. (Without a normal
  // attribute three would shade the blades flat.)
  geo.setAttribute(
    'normal',
    new THREE.Float32BufferAttribute(
      position.map((_, i) => (i % 3 === 1 ? 1 : 0)),
      3,
    ),
  );
  geo.setAttribute('aBlade', new THREE.Float32BufferAttribute(blade, 4));
  geo.setIndex(index);
  return geo;
}

const VERTEX_PARS = /* glsl */ `
${WIND_GLSL}
attribute vec4 aBlade;
attribute vec4 aClump;
attribute vec4 aTint;
uniform float uGrassShare;
varying vec3 vGrass;
`;

const VERTEX_BLADE = /* glsl */ `
  vec2 root = aClump.xz + aBlade.xy;
  float rnd = aBlade.w;
  float rnd2 = fract(rnd * 7.31 + aClump.x * 0.173 + aClump.z * 0.311);
  float rnd3 = fract(rnd * 13.7 + aClump.z * 0.219);
  // Thinner where the clump is sparse (lane edges, the woods) and on the
  // pacer's lower rungs: a blade left out collapses to nothing.
  float grow = step(rnd2, aTint.a * uGrassShare);
  float bladeT = position.y;
  float bladeA = (aBlade.z + aClump.x * 0.37) * 6.2831853;
  vec2 across = vec2(cos(bladeA), sin(bladeA));
  vec2 facing = vec2(-across.y, across.x);
  float bladeH = aClump.w * (0.72 + 0.56 * rnd3) * grow;
  float bladeW = mix(0.032, 0.058, rnd) * grow;
  float gust = gustAt(root);
  // Its own lean, the wind's bend (stronger in the gusts) and a flutter.
  vec2 bend = facing * (rnd2 - 0.5) * 0.7 + windBend(root, gust) * 0.55;
  // (Fixed rates, livelier in a gust by mixing in the quicker one: time
  // times a changing rate would race ever faster as the match goes on.)
  bend += facing * (sin(uWindTime * 6.5 + rnd * 41.0) * (1.0 - 0.5 * gust)
      + sin(uWindTime * 10.5 + rnd * 23.0) * 0.5 * gust)
    * (0.05 + 0.08 * gust) * uFlutter;
  float lean = min(1.0, dot(bend, bend));
  vec3 bladeP = vec3(root.x, aClump.y, root.y)
    + vec3(across.x, 0.0, across.y) * position.x * bladeW
    + vec3(bend.x, 0.0, bend.y) * bladeH * bladeT * bladeT
    + vec3(0.0, bladeH * bladeT * (1.0 - 0.3 * lean), 0.0);
  // Lit like the ground beneath, with a hint of the blade's own face.
  vec3 objectNormal = normalize(vec3(facing.x * 0.3, 1.0, facing.y * 0.3));
  // The paint beneath, each blade a little lighter or darker, some
  // warmer; dark at the root, sunlit at the tip; paler in a gust.
  vec3 tint = aTint.rgb * aTint.rgb * (0.86 + 0.3 * rnd3);
  tint *= rnd < 0.18 ? vec3(1.12, 1.0, 0.8) : vec3(1.0);
  vec3 tipTint = tint * mix(vec3(1.12, 1.1, 0.82), vec3(1.0, 1.06, 0.9), rnd2);
  vGrass = mix(tint * 0.72, tipTint * 1.2, bladeT);
  vGrass = mix(vGrass, vGrass * vec3(1.13, 1.12, 0.94), gust * 0.6 * uWindAmp);
  float cloud = smoothstep(0.5, 0.8, texture2D(tWindNoise,
    root * 0.0105 + vec2(0.21, 0.63) - uWindDir * uWindTime * 0.0045).b);
  vGrass *= 1.0 - 0.14 * cloud;
`;

export class Grass {
  readonly meshes: THREE.Mesh[] = [];
  readonly material: THREE.MeshLambertMaterial;
  private geometries: THREE.InstancedBufferGeometry[] = [];
  private totals: number[] = [];
  private density = 1;
  /** Share of each clump's blades drawn (the pacer thins the meadow). */
  private share = { value: 1 };
  readonly blades: number;

  constructor(
    textures: Textures,
    noise: THREE.DataTexture,
    wind: Wind,
    /** Only grow where this says (phones skip what they never see). */
    keep: (x: number, z: number) => boolean = () => true,
  ) {
    // Lambert: the meadow covers much of the screen, and a blade needs no
    // reflections. Brightened to match the ground's sky light.
    const material = new THREE.MeshLambertMaterial({
      color: new THREE.Color(1.14, 1.14, 1.14),
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, wind);
      shader.uniforms.uGrassShare = this.share;
      shader.vertexShader = shader.vertexShader
        .replace('void main() {', `${VERTEX_PARS}\nvoid main() {`)
        .replace('#include <beginnormal_vertex>', VERTEX_BLADE)
        .replace('#include <begin_vertex>', 'vec3 transformed = bladeP;')
        .replace(
          '#include <project_vertex>',
          `vec4 mvPosition = viewMatrix * vec4(transformed, 1.0);
          gl_Position = projectionMatrix * mvPosition;`,
        )
        .replace(
          '#include <worldpos_vertex>',
          `vec4 worldPosition = vec4(transformed, 1.0);`,
        );
      shader.fragmentShader = shader.fragmentShader
        .replace('void main() {', 'varying vec3 vGrass;\nvoid main() {')
        .replace('#include <color_fragment>', 'diffuseColor.rgb *= vGrass;')
        // Both faces lit as the side facing the sun.
        .replace(
          '#include <normal_fragment_begin>',
          '#include <normal_fragment_begin>\nnormal = normalize(vNormal);',
        );
    };
    material.customProgramCacheKey = () => 'arena-grass';
    this.material = material;

    // Clumps by chunk, from a jittered grid over the valley near the field.
    const turf = turfSampler(textures);
    const rgb = [0, 0, 0];
    const chunks = new Map<string, number[]>();
    let seed = 20261001;
    const rnd = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const reachX = 19;
    const reachZ = 26;
    let blades = 0;
    for (let z = -reachZ; z < reachZ; z += CLUMP)
      for (let x = -reachX; x < reachX; x += CLUMP) {
        const cx = x + CLUMP / 2;
        const cz = z + CLUMP / 2;
        // Thickest anywhere in the clump decides whether it grows; each
        // blade then thins by the clump's own thickness.
        let dense = 0;
        let tall = 0;
        for (const [dx, dz] of [
          [0, 0],
          [-0.5, -0.5],
          [0.5, -0.5],
          [-0.5, 0.5],
          [0.5, 0.5],
        ]) {
          const g = grassAt(noise, cx + dx * CLUMP, cz + dz * CLUMP);
          dense = Math.max(dense, g.dense);
          tall += g.tall / 5;
        }
        const here = grassAt(noise, cx, cz);
        if (dense <= 0.02 || !keep(cx, cz)) continue;
        // Out in the woods clumps grow in scattered tufts.
        if (dense < 0.6 && rnd() > dense * 1.4) continue;
        // Height: a broad drift of longer and shorter meadow.
        const drift = sampleNoise(noise, cx * 0.05 + 0.4, cz * 0.05 + 0.1, 1);
        const h = (0.1 + 0.12 * drift) * Math.max(tall, here.tall * 0.8);
        // The colour of the paint beneath, as the ground shader mixes it.
        turf(cx / 5.6, cz / 5.6, rgb);
        const big = sampleNoise(noise, cx * 0.021 + 0.13, cz * 0.021 + 0.13, 0);
        const mid = sampleNoise(noise, cx * 0.07 + 0.52, cz * 0.07 + 0.52, 1);
        const d = smooth(0.3, 0.72, big);
        const lift = 0.98 + 0.16 * smooth(0.25, 0.75, mid);
        const tint = [
          (0.085 * 0.38 + rgb[0] * 0.62) * (0.86 + 0.24 * d) * lift,
          (0.25 * 0.38 + rgb[1] * 0.62) * (0.95 + 0.09 * d) * lift,
          (0.1 * 0.38 + rgb[2] * 0.62) * (1 - 0.14 * d) * lift,
        ];
        const key = `${Math.floor(cx / CHUNK)},${Math.floor(cz / CHUNK)}`;
        const list = chunks.get(key) ?? [];
        // Per-blade thinning reads the clump's own (centre) thickness, so
        // the lane edges fade blade by blade.
        const share = dense < 0.6 ? 1 : Math.max(0.15, here.dense);
        list.push(
          x,
          groundHeight(cx, cz) - 0.015,
          z,
          h,
          Math.sqrt(Math.min(1, tint[0])),
          Math.sqrt(Math.min(1, tint[1])),
          Math.sqrt(Math.min(1, tint[2])),
          share,
        );
        chunks.set(key, list);
        blades += Math.round(CLUMP_BLADES * share);
      }
    this.blades = blades;
    const base = clump(77);
    for (const list of chunks.values()) {
      const n = list.length / 8;
      // Shuffle, so thinning keeps an even spread.
      const order = [...Array(n).keys()];
      for (let i = n - 1; i > 0; i--) {
        const j = Math.floor(rnd() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }
      const at = new Float32Array(n * 4);
      const tint = new Uint8Array(n * 4);
      const box = new THREE.Box3();
      const p = new THREE.Vector3();
      order.forEach((k, i) => {
        const o = k * 8;
        at.set([list[o], list[o + 1], list[o + 2], list[o + 3]], i * 4);
        for (let c = 0; c < 4; c++)
          tint[i * 4 + c] = Math.round(list[o + 4 + c] * 255);
        box.expandByPoint(p.set(list[o], list[o + 1], list[o + 2]));
        box.expandByPoint(
          p.set(list[o] + CLUMP, list[o + 1], list[o + 2] + CLUMP),
        );
      });
      const geo = new THREE.InstancedBufferGeometry();
      geo.index = base.index;
      for (const name of ['position', 'normal', 'aBlade'])
        geo.setAttribute(name, base.getAttribute(name));
      geo.setAttribute('aClump', new THREE.InstancedBufferAttribute(at, 4));
      geo.setAttribute(
        'aTint',
        new THREE.InstancedBufferAttribute(tint, 4, true),
      );
      geo.instanceCount = n;
      box.expandByScalar(0.6);
      geo.boundingBox = box;
      geo.boundingSphere = box.getBoundingSphere(new THREE.Sphere());
      const mesh = new THREE.Mesh(geo, material);
      mesh.name = 'grass';
      mesh.receiveShadow = true;
      mesh.castShadow = false;
      // After the opaque scenery and troops, before the water and effects.
      mesh.renderOrder = 1;
      mesh.matrixAutoUpdate = false;
      this.meshes.push(mesh);
      this.geometries.push(geo);
      this.totals.push(n);
    }
  }

  /** Draw this share of the blades (1 is all of them). */
  setDensity(share: number) {
    if (share === this.density) return;
    this.density = share;
    // Fewer blades in every clump: thinner, never patchy.
    this.share.value = share;
  }

  dispose() {
    for (const g of this.geometries) g.dispose();
    this.material.dispose();
  }
}
