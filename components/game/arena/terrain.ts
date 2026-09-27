import * as THREE from 'three';
import type { Textures } from './materials';

/**
 * The diorama's landscape: a forested valley modelled on a slab that floats
 * in the studio void. The field is flat cobbled paving with moss and grass
 * in the gaps; the stream is carved across the valley; outside the field's
 * walls the ground rises gently into wooded hills, and the whole landscape
 * ends at the plinth in a clean cut showing its earth and rock. One shader
 * blends the tiles (meadow, cobbles, dirt on the banks, the pebbly riverbed
 * and the forest floor) with noisy, natural edges.
 */

// ---------------------------------------------------------------- noise

function hash(x: number, y: number) {
  const h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return h - Math.floor(h);
}
function valueNoise(x: number, y: number, period: number) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const w = (i: number, j: number) =>
    hash(
      (((xi + i) % period) + period) % period,
      (((yi + j) % period) + period) % period,
    );
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  return (
    w(0, 0) * (1 - u) * (1 - v) +
    w(1, 0) * u * (1 - v) +
    w(0, 1) * (1 - u) * v +
    w(1, 1) * u * v
  );
}
/** Tileable fractal noise in [0, 1]. */
export function fbm(x: number, y: number, period: number, octaves = 4) {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  let f = 1;
  for (let o = 0; o < octaves; o++) {
    sum += valueNoise(x * f, y * f, period * f) * amp;
    norm += amp;
    amp *= 0.5;
    f *= 2;
  }
  return sum / norm;
}

/** A tiling RGBA noise texture, four independent octave mixes. */
export function noiseTexture(size = 256) {
  const data = new Uint8Array(size * size * 4);
  const period = 8;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const u = (x / size) * period;
      const v = (y / size) * period;
      const i = (y * size + x) * 4;
      data[i] = fbm(u, v, period) * 255;
      data[i + 1] = fbm(u + 31.7, v + 17.3, period, 3) * 255;
      data[i + 2] = fbm(u * 2 + 5.1, v * 2 + 9.4, period * 2, 3) * 255;
      data[i + 3] = fbm(u * 4 + 1.3, v * 4 + 2.9, period * 4, 2) * 255;
    }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

/** A tiling normal map of small ripples, for the stream. */
export function rippleTexture(size = 256) {
  const heights = new Float32Array(size * size);
  const period = 6;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++)
      heights[y * size + x] = fbm(
        (x / size) * period,
        (y / size) * period,
        period,
        5,
      );
  const data = new Uint8Array(size * size * 4);
  const at = (x: number, y: number) =>
    heights[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * 6;
      const dy = (at(x, y + 1) - at(x, y - 1)) * 6;
      const len = Math.hypot(dx, dy, 1);
      const i = (y * size + x) * 4;
      data[i] = ((-dx / len) * 0.5 + 0.5) * 255;
      data[i + 1] = ((dy / len) * 0.5 + 0.5) * 255;
      data[i + 2] = ((1 / len) * 0.5 + 0.5) * 255;
      data[i + 3] = 255;
    }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

/** Read a noise texture like the shader does (bilinear, wrapping). */
export function sampleNoise(
  tex: THREE.DataTexture,
  u: number,
  v: number,
  channel = 0,
) {
  const { width, height, data } = tex.image as {
    width: number;
    height: number;
    data: Uint8Array;
  };
  const x = (((u % 1) + 1) % 1) * width - 0.5;
  const y = (((v % 1) + 1) % 1) * height - 0.5;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const at = (i: number, j: number) =>
    data[
      (((j + height) % height) * width + ((i + width) % width)) * 4 + channel
    ] / 255;
  return (
    at(x0, y0) * (1 - fx) * (1 - fy) +
    at(x0 + 1, y0) * fx * (1 - fy) +
    at(x0, y0 + 1) * (1 - fx) * fy +
    at(x0 + 1, y0 + 1) * fx * fy
  );
}

const FOREST_SCALE = '0.011';
const FOREST_OFFSET = '0.37';
/** How wooded the valley is at a world point, 0 (meadow) to 1 (woods). */
export function forestAt(noise: THREE.DataTexture, x: number, z: number) {
  const k = Number(FOREST_SCALE);
  const o = Number(FOREST_OFFSET);
  const v = sampleNoise(noise, x * k + o, z * k + o, 0);
  const t = Math.min(1, Math.max(0, (v - 0.44) / 0.16));
  return t * t * (3 - 2 * t);
}

// ---------------------------------------------------------------- shape

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** The landscape's slab: its extent in world units (the camera looks from
 *  +z, so the near side barely shows) and the plinth below it. */
export const PLINTH = {
  left: -48,
  right: 48,
  far: -46,
  near: 40,
  /** Where the landscape's cut face meets the graphite base. */
  base: -1.6,
  /** The graphite base's thickness, its margin round the cut and corners. */
  thick: 1.3,
  margin: 0.9,
  corner: 2.4,
};

/** Ground height at a world point. */
export function groundHeight(x: number, z: number) {
  const az = Math.abs(z);
  const river = -0.72 * (1 - smooth(0.78, 1.42, az));
  const outX = Math.max(0, Math.abs(x) - 10.6);
  const outZ = Math.max(0, az - 17.6);
  const wobble = 0.65 + 0.7 * fbm(x * 0.045 + 3, z * 0.045 + 7, 64, 3);
  let hills = (smooth(0, 12, outX) * 2.2 + smooth(0, 10, outZ) * 1.8) * wobble;
  // The valley floor stays low along the stream.
  hills *= smooth(2.2, 10, az);
  return hills + river;
}

export const TOWER_SPOTS: [number, number, number][] = [
  [-5.5, 9.5, 2.3],
  [5.5, 9.5, 2.3],
  [0, 13, 3.0],
  [-5.5, -9.5, 2.3],
  [5.5, -9.5, 2.3],
  [0, -13, 3.0],
];

/** Lane paths, as world segments (x1, z1, x2, z2). */
const PATHS: [number, number, number, number][] = [];
for (const s of [1, -1])
  for (const x of [-5.5, 5.5]) {
    PATHS.push([x, s * 9.5, x, s * 1.1]);
    PATHS.push([0, s * 13, x, s * 9.5]);
  }

/** The area of the distance texture: the field and its walls, in metres. */
const FIELD_BOX = { x: 11, z: 19, perMetre: 8 };

/**
 * How far each point of the field is from the nearest lane path and from the
 * nearest tower's edge, worked out once instead of per pixel per frame. The
 * shapes are fixed, so this is exact up to the texel size (12.5 cm), and the
 * noisy edges are still added live in the shader.
 */
function fieldDistances() {
  const w = FIELD_BOX.x * 2 * FIELD_BOX.perMetre;
  const h = FIELD_BOX.z * 2 * FIELD_BOX.perMetre;
  const data = new Uint8Array(w * h * 4);
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const px = ((i + 0.5) / w) * 2 * FIELD_BOX.x - FIELD_BOX.x;
      const pz = ((j + 0.5) / h) * 2 * FIELD_BOX.z - FIELD_BOX.z;
      let path = 1e3;
      for (const [ax, az, bx, bz] of PATHS) {
        const [dx, dz] = [bx - ax, bz - az];
        const t = Math.min(
          1,
          Math.max(0, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz)),
        );
        path = Math.min(path, Math.hypot(px - ax - dx * t, pz - az - dz * t));
      }
      let ring = 1e3;
      for (const [tx, tz, r] of TOWER_SPOTS)
        ring = Math.min(ring, Math.hypot(px - tx, pz - tz) - r);
      const k = (j * w + i) * 4;
      // Only the first few metres matter: paths as 0–4 m, rings as −2–4 m.
      data[k] = Math.round((Math.min(path, 4) / 4) * 255);
      data[k + 1] = Math.round(
        ((Math.min(Math.max(ring, -2), 4) + 2) / 6) * 255,
      );
      data[k + 3] = 255;
    }
  const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

/** Grid lines from `a` to `b`: 3.2 a unit within `fine` of the middle,
 *  thinning to 1.25 a unit further out. */
function steps(a: number, b: number, fine: number) {
  const out = [a];
  let v = a;
  while (v < b) {
    const out2 = Math.abs(v) - fine;
    v += out2 <= 0 ? 1 / 3.2 : Math.min(0.8, 1 / 3.2 + out2 * 0.06);
    out.push(Math.min(v, b));
  }
  return out;
}

/** A flat grid on y = 0 through the given x and z lines. */
function gradedGrid(xs: number[], zs: number[]) {
  const nx = xs.length;
  const nz = zs.length;
  const position = new Float32Array(nx * nz * 3);
  const uv = new Float32Array(nx * nz * 2);
  for (let j = 0; j < nz; j++)
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      position[k * 3] = xs[i];
      position[k * 3 + 2] = zs[j];
      uv[k * 2] = i / (nx - 1);
      uv[k * 2 + 1] = 1 - j / (nz - 1);
    }
  const index: number[] = [];
  for (let j = 0; j < nz - 1; j++)
    for (let i = 0; i < nx - 1; i++) {
      const a = j * nx + i;
      const b = a + 1;
      const c = a + nx;
      const d = c + 1;
      index.push(a, c, b, b, c, d);
    }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(position, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(index);
  return geo;
}

export function makeGround(
  textures: Textures,
  noise: THREE.Texture,
  lite = false,
) {
  // Fine over the field, its walls and the banks, coarser out in the
  // valley, whose hills are gentle.
  const geo = gradedGrid(
    steps(PLINTH.left, PLINTH.right, 13),
    steps(PLINTH.far, PLINTH.near, 19),
  );
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++)
    pos.setY(i, groundHeight(pos.getX(i), pos.getZ(i)));
  geo.computeVertexNormals();
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.92,
    metalness: 0,
    envMapIntensity: 0.5,
  });
  const layers = ['grass', 'cobble', 'dirt', 'pebbles', 'forest'] as const;
  const distances = fieldDistances();
  material.onBeforeCompile = (shader) => {
    if (lite) shader.defines = { ...shader.defines, GROUND_LITE: '' };
    for (const l of layers) {
      const t = textures[l] ?? textures.cloth;
      shader.uniforms[`t_${l}`] = { value: t?.map };
      shader.uniforms[`n_${l}`] = { value: t?.normalMap };
    }
    shader.uniforms.tNoise = { value: noise };
    shader.uniforms.tField = { value: distances };
    shader.vertexShader = shader.vertexShader
      .replace(
        'void main() {',
        'varying vec3 vW;\nvarying vec3 vWN;\nvoid main() {',
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vW = (modelMatrix * vec4(transformed, 1.0)).xyz;
        vWN = normalize(mat3(modelMatrix) * objectNormal);`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        'void main() {',
        `varying vec3 vW;
        varying vec3 vWN;
        ${layers.map((l) => `uniform sampler2D t_${l}; uniform sampler2D n_${l};`).join('\n')}
        uniform sampler2D tNoise;
        uniform sampler2D tField;
        vec2 rot(vec2 v, float a) { float c = cos(a), s = sin(a); return vec2(c * v.x - s * v.y, s * v.x + c * v.y); }
        vec3 unpackN(vec4 t) { return t.xyz * 2.0 - 1.0; }
        float gW[5];
        vec2 gUV[5];
        // Screen derivatives of the world uv, taken before any branch so the
        // branched samples below still pick the right mip level.
        vec2 gDx;
        vec2 gDy;
        float gOutside;
        vec4 layer(sampler2D t, vec2 uv, float scale) {
          return textureGrad(t, uv, gDx * scale, gDy * scale);
        }
        void groundWeights(vec2 p) {
          vec4 big = texture2D(tNoise, p * 0.03);
          vec4 small = texture2D(tNoise, p * 0.19 + 0.31);
          float edge = (small.r - 0.5) * 0.55 + (big.g - 0.5) * 0.3;
          float az = abs(p.y);
          vec2 fd = texture2D(tField, vec2(
            (p.x + ${FIELD_BOX.x.toFixed(1)}) / ${(FIELD_BOX.x * 2).toFixed(1)},
            (p.y + ${FIELD_BOX.z.toFixed(1)}) / ${(FIELD_BOX.z * 2).toFixed(1)})).rg;
          float pathD = fd.r * 4.0;
          float wPeb = 1.0 - smoothstep(0.86, 1.12, az + edge * 0.5);
          float ring = fd.g * 6.0 - 2.0;
          float bank = (1.0 - smoothstep(1.15, 1.6, az + edge)) * (1.0 - wPeb);
          float wDirt = bank;
          float outside = max(smoothstep(9.6, 10.6, abs(p.x) + edge * 1.6),
                              smoothstep(16.8, 17.8, az + edge * 1.6));
          // The field is cobbled; grass and moss take over the stones in
          // patches, thickest along the walls, never on the lanes or round
          // the towers.
          float lane = 1.0 - smoothstep(0.7, 1.4, pathD + edge * 0.6);
          float pad = 1.0 - smoothstep(0.2, 1.2, ring + edge);
          float wall = max(smoothstep(7.4, 9.4, abs(p.x)), smoothstep(14.6, 16.6, az));
          float patchy = smoothstep(0.5, 0.64, big.b * 0.7 + small.b * 0.45 + wall * 0.3);
          float grassy = patchy * (1.0 - max(lane, pad) * 0.9);
          float wPath = (1.0 - outside) * (1.0 - grassy) * (1.0 - wPeb) * (1.0 - bank);
          // Beyond the walls: meadow clearings and woods (the scatter of
          // trees reads the same noise, see forestAt).
          vec4 macro = texture2D(tNoise, p * ${FOREST_SCALE} + ${FOREST_OFFSET});
          float patches = smoothstep(0.44, 0.6, macro.r + (small.g - 0.5) * 0.12);
          float wForest = outside * patches * (1.0 - wPeb);
          gOutside = outside;
          // Paint order: meadow, forest floor, dirt, paths, pebbles.
          gW[4] = wPeb;
          gW[1] = wPath;
          gW[2] = wDirt * (1.0 - wPath) * (1.0 - wPeb);
          gW[3] = wForest * (1.0 - gW[2]) * (1.0 - wPath) * (1.0 - wPeb);
          gW[0] = max(0.0, 1.0 - gW[1] - gW[2] - gW[3] - gW[4]);
          vec2 uv = vec2(p.x, -p.y);
          gDx = dFdx(uv);
          gDy = dFdy(uv);
          gUV[0] = uv / 3.2;
          gUV[1] = uv / 2.4;
          gUV[2] = uv / 3.4;
          gUV[3] = uv / 3.0;
          gUV[4] = uv / 2.2;
        }
        void main() {`,
      )
      .replace(
        '#include <map_fragment>',
        `groundWeights(vW.xz);
        vec4 big = texture2D(tNoise, vW.xz * 0.03);
        // Meadow sampled twice at unrelated scales so its repeat never shows.
        vec3 grass = vec3(0.0);
        if (gW[0] > 0.0) {
          grass = layer(t_grass, gUV[0], 1.0 / 3.2).rgb;
          #ifndef GROUND_LITE
          vec3 grass2 = textureGrad(t_grass, rot(gUV[0] * 0.43, 0.7) + 0.37,
            rot(gDx * (0.43 / 3.2), 0.7), rot(gDy * (0.43 / 3.2), 0.7)).rgb;
          grass = mix(grass, grass2, 0.5 * smoothstep(0.35, 0.65, big.b));
          #endif
        }
        grass *= mix(vec3(0.9, 0.95, 0.88), vec3(1.05, 1.03, 0.9), smoothstep(0.3, 0.75, big.r));
        // Moss on the field is a little deeper so the pale cobbles stand
        // out on it; the valley's meadow is a calmer green.
        grass *= mix(vec3(0.84, 0.92, 0.84), vec3(0.86, 0.9, 0.76), gOutside);
        // A faint checker on the field helps judge where troops land.
        vec2 tile = floor(vec2(vW.x + 9.0, 16.0 - vW.z));
        float inField = step(abs(vW.x), 9.0) * step(abs(vW.z), 16.0);
        grass *= 1.0 - 0.035 * inField * mod(tile.x + tile.y, 2.0);
        // Layers are painted in patches, so most pixels skip most layers:
        // a layer without weight is never sampled (same picture, less work).
        vec3 ground = grass * gW[0];
        if (gW[1] > 0.0) ground += layer(t_cobble, gUV[1], 1.0 / 2.4).rgb * gW[1];
        if (gW[2] > 0.0) ground += layer(t_dirt, gUV[2], 1.0 / 3.4).rgb * gW[2];
        if (gW[3] > 0.0) {
          vec3 forest = layer(t_forest, gUV[3], 1.0 / 3.0).rgb;
          #ifndef GROUND_LITE
          vec3 forest2 = textureGrad(t_forest, rot(gUV[3] * 0.51, 1.9) + 0.21,
            rot(gDx * (0.51 / 3.0), 1.9), rot(gDy * (0.51 / 3.0), 1.9)).rgb;
          forest = mix(forest, forest2, 0.45 * smoothstep(0.35, 0.65, big.a));
          #endif
          ground += forest * gW[3];
        }
        if (gW[4] > 0.0) ground += layer(t_pebbles, gUV[4], 1.0 / 2.2).rgb * gW[4];
        // Wet stones under the water are darker and richer.
        ground *= mix(1.0, 0.72, smoothstep(-0.2, -0.6, vW.y));
        diffuseColor.rgb *= ground;`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `float roughnessFactor = mix(0.94, 0.5, gW[4] * smoothstep(-0.15, -0.5, vW.y));`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `{
          #ifdef GROUND_LITE
          // Phones: relief from the meadow and the stones only.
          vec3 level = vec3(0.0, 0.0, 1.0);
          vec3 tn = level * (gW[2] + gW[3]);
          if (gW[0] > 0.0) tn += unpackN(layer(n_grass, gUV[0], 1.0 / 3.2)) * gW[0];
          if (gW[1] > 0.0) tn += unpackN(layer(n_cobble, gUV[1], 1.0 / 2.4)) * gW[1];
          if (gW[4] > 0.0) tn += unpackN(layer(n_pebbles, gUV[4], 1.0 / 2.2)) * gW[4];
          #else
          vec3 tn = vec3(0.0);
          if (gW[0] > 0.0) tn += unpackN(layer(n_grass, gUV[0], 1.0 / 3.2)) * gW[0];
          if (gW[1] > 0.0) tn += unpackN(layer(n_cobble, gUV[1], 1.0 / 2.4)) * gW[1];
          if (gW[2] > 0.0) tn += unpackN(layer(n_dirt, gUV[2], 1.0 / 3.4)) * gW[2];
          if (gW[3] > 0.0) tn += unpackN(layer(n_forest, gUV[3], 1.0 / 3.0)) * gW[3];
          if (gW[4] > 0.0) tn += unpackN(layer(n_pebbles, gUV[4], 1.0 / 2.2)) * gW[4];
          #endif
          // Tiles load unflipped, so their green points towards +z here.
          tn.y = -tn.y;
          tn.xy *= 0.9;
          vec3 N = normalize(vWN);
          vec3 T = normalize(vec3(1.0, 0.0, 0.0) - N * N.x);
          vec3 B = cross(N, T);
          vec3 wn = normalize(T * tn.x + B * tn.y + N * tn.z);
          normal = normalize((viewMatrix * vec4(wn, 0.0)).xyz);
        }`,
      );
  };
  material.customProgramCacheKey = () => `arena-ground${lite ? '-lite' : ''}`;
  const mesh = new THREE.Mesh(geo, material);
  mesh.receiveShadow = true;
  mesh.name = 'ground';
  mesh.userData.textures = [distances];
  return mesh;
}

/**
 * The plinth: the landscape's cut face, earth over rock, running round the
 * slab from the ground's own edge down to a bevelled graphite base.
 */
export function makePlinth(textures: Textures) {
  const group = new THREE.Group();
  group.name = 'plinth';
  const owned: { dispose(): void }[] = [];
  const P = PLINTH;
  // The cut face follows the ground along the slab's four edges.
  const edge: [number, number][] = [];
  const step = 0.4;
  for (let x = P.left; x < P.right; x += step) edge.push([x, P.near]);
  for (let z = P.near; z > P.far; z -= step) edge.push([P.right, z]);
  for (let x = P.right; x > P.left; x -= step) edge.push([x, P.far]);
  for (let z = P.far; z < P.near; z += step) edge.push([P.left, z]);
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  let run = 0;
  edge.forEach(([x, z], i) => {
    const [nx, nz] = edge[(i + 1) % edge.length];
    const top = groundHeight(x, z);
    pos.push(x, top, z, x, P.base, z);
    // v is the depth below the ground's edge.
    uv.push(run, 0, run, top - P.base);
    run += Math.hypot(nx - x, nz - z);
    const a = i * 2;
    const b = ((i + 1) % edge.length) * 2;
    idx.push(a, a + 1, b, b, a + 1, b + 1);
  });
  const faceGeo = new THREE.BufferGeometry();
  faceGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  faceGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  faceGeo.setIndex(idx);
  faceGeo.computeVertexNormals();
  const rock = textures.rock ?? textures.dirt;
  const faceMat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    roughness: 0.95,
    side: THREE.DoubleSide,
  });
  faceMat.onBeforeCompile = (shader) => {
    shader.uniforms.tRock = { value: rock?.map };
    shader.uniforms.tDirt = { value: textures.dirt?.map ?? rock?.map };
    shader.vertexShader = shader.vertexShader
      .replace('void main() {', 'varying vec2 vCut;\nvoid main() {')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvCut = uv;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        'void main() {',
        `varying vec2 vCut;
        uniform sampler2D tRock;
        uniform sampler2D tDirt;
        void main() {`,
      )
      .replace(
        '#include <map_fragment>',
        `// A lip of turf, then dark topsoil and packed earth, then rock.
        float below = vCut.y;
        vec3 soil = texture2D(tDirt, vCut * vec2(0.35, 0.5)).rgb * vec3(0.5, 0.4, 0.32);
        vec3 stone = texture2D(tRock, vCut * vec2(0.22, 0.3)).rgb * 0.6;
        float band = smoothstep(0.55, 1.2, below + sin(vCut.x * 0.7) * 0.18);
        vec3 cut = mix(soil, stone, band);
        float turf = 1.0 - smoothstep(0.05, 0.13, below);
        cut = mix(cut, vec3(0.2, 0.3, 0.13), turf);
        diffuseColor.rgb *= cut;`,
      );
  };
  faceMat.customProgramCacheKey = () => 'arena-cut';
  const face = new THREE.Mesh(faceGeo, faceMat);
  face.receiveShadow = true;
  group.add(face);
  owned.push(faceGeo, faceMat);

  // The graphite base with a soft bevel, a little larger than the cut.
  const w = P.right - P.left + P.margin * 2;
  const d = P.near - P.far + P.margin * 2;
  const r = P.corner;
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2 + r, -d / 2);
  shape.lineTo(w / 2 - r, -d / 2);
  shape.quadraticCurveTo(w / 2, -d / 2, w / 2, -d / 2 + r);
  shape.lineTo(w / 2, d / 2 - r);
  shape.quadraticCurveTo(w / 2, d / 2, w / 2 - r, d / 2);
  shape.lineTo(-w / 2 + r, d / 2);
  shape.quadraticCurveTo(-w / 2, d / 2, -w / 2, d / 2 - r);
  shape.lineTo(-w / 2, -d / 2 + r);
  shape.quadraticCurveTo(-w / 2, -d / 2, -w / 2 + r, -d / 2);
  const baseGeo = new THREE.ExtrudeGeometry(shape, {
    depth: P.thick,
    bevelEnabled: true,
    bevelThickness: 0.18,
    bevelSize: 0.18,
    bevelSegments: 4,
    curveSegments: 10,
  });
  baseGeo.rotateX(Math.PI / 2);
  baseGeo.translate((P.left + P.right) / 2, P.base, (P.far + P.near) / 2);
  const baseMat = new THREE.MeshPhysicalMaterial({
    color: '#26272b',
    roughness: 0.42,
    metalness: 0.15,
    clearcoat: 0.4,
    clearcoatRoughness: 0.3,
  });
  const base = new THREE.Mesh(baseGeo, baseMat);
  base.receiveShadow = true;
  base.castShadow = true;
  group.add(base);
  owned.push(baseGeo, baseMat);
  group.userData.owned = owned;
  return group;
}

export function makeWater(noise: THREE.Texture, ripples: THREE.Texture) {
  const geo = new THREE.PlaneGeometry(
    PLINTH.right - PLINTH.left,
    2.7,
    Math.round((PLINTH.right - PLINTH.left) * 2),
    6,
  );
  geo.rotateX(-Math.PI / 2);
  const uniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    {
      uTime: { value: 0 },
      tNoise: { value: null },
      tRipple: { value: null },
      uSun: { value: new THREE.Vector3(-0.45, 0.8, 0.4).normalize() },
      // Bright cartoon water: a clear blue deep, turquoise shallows and
      // the sky in the reflections.
      uDeep: { value: new THREE.Color('#1f6fae') },
      uShallow: { value: new THREE.Color('#3fb2c4') },
      uSky: { value: new THREE.Color('#bfe3f5') },
    },
  ]);
  uniforms.tNoise.value = noise;
  uniforms.tRipple.value = ripples;
  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    fog: true,
    vertexShader: `
      varying vec3 vW;
      #include <fog_pars_vertex>
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vW = world.xyz;
        vec4 mvPosition = viewMatrix * world;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `
      uniform float uTime;
      uniform sampler2D tNoise;
      uniform sampler2D tRipple;
      uniform vec3 uSun, uDeep, uShallow, uSky;
      varying vec3 vW;
      #include <fog_pars_fragment>
      void main() {
        vec2 p = vW.xz;
        vec3 r1 = texture2D(tRipple, p * vec2(0.16, 0.3) + vec2(uTime * 0.06, 0.0)).xyz * 2.0 - 1.0;
        vec3 r2 = texture2D(tRipple, p * vec2(0.31, 0.52) + vec2(uTime * 0.11, uTime * 0.017)).xyz * 2.0 - 1.0;
        vec2 slope = (r1.xy + r2.xy) * 0.42;
        vec3 N = normalize(vec3(slope.x, 1.0, -slope.y));
        vec3 V = normalize(cameraPosition - vW);
        float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
        float depth = 1.0 - smoothstep(0.15, 1.05, abs(p.y));
        vec3 col = mix(uShallow, uDeep, depth);
        col = mix(col, uSky, clamp(fres * 0.75 + 0.08, 0.0, 1.0));
        vec3 H = normalize(uSun + V);
        col += vec3(1.0, 0.96, 0.85) * pow(max(dot(N, H), 0.0), 140.0) * 1.6;
        // Foam along the banks and streaks drifting downstream.
        float f1 = texture2D(tNoise, p * vec2(0.35, 1.4) + vec2(uTime * 0.16, 0.0)).r;
        float f2 = texture2D(tNoise, p * vec2(0.9, 2.2) + vec2(uTime * 0.26, 0.4)).g;
        float bank = smoothstep(0.62, 1.02, abs(p.y));
        float foam = bank * smoothstep(0.42, 0.62, f1 + bank * 0.25);
        foam += smoothstep(0.7, 0.78, f2) * 0.35 * (1.0 - bank);
        col = mix(col, vec3(0.96, 0.98, 1.0), clamp(foam, 0.0, 1.0));
        float alpha = mix(0.62, 0.9, depth) + foam * 0.2;
        gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.y = -0.3;
  mesh.name = 'water';
  mesh.renderOrder = 2;
  return mesh;
}
