import * as THREE from 'three';

/** Each connected pane is a real model aperture. The extra attribute keeps
 * its seed/curtains continuous across its triangles, including arched panes.
 * Geometry remains shared with the asset library; no copies or frame uploads. */
export function prepareWindows(g: THREE.BufferGeometry) {
  if (g.hasAttribute('aRotaWindow')) return;
  const p = g.getAttribute('position');
  const parents = new Int32Array(p.count);
  for (let i = 0; i < p.count; i++) parents[i] = i;
  const find = (i: number): number => {
    while (parents[i] !== i) {
      parents[i] = parents[parents[i]];
      i = parents[i];
    }
    return i;
  };
  const join = (a: number, b: number) => {
    parents[find(b)] = find(a);
  };
  // GLTF may split vertices at normals or quantize the entire material mesh.
  // Use decoded accessor values, not the raw integer attribute arrays.
  const weld = new Map<string, number>();
  for (let i = 0; i < p.count; i++) {
    const k = `${p.getX(i).toFixed(6)},${p.getY(i).toFixed(6)},${p.getZ(i).toFixed(6)}`;
    const other = weld.get(k);
    if (other !== undefined) join(i, other);
    else weld.set(k, i);
  }
  const idx = g.index;
  const count = idx?.count ?? p.count;
  for (let i = 0; i < count; i += 3) {
    const a = idx ? idx.getX(i) : i;
    join(a, idx ? idx.getX(i + 1) : i + 1);
    join(a, idx ? idx.getX(i + 2) : i + 2);
  }
  const bounds = new Map<number, THREE.Box3>();
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    const root = find(i);
    let b = bounds.get(root);
    if (!b) {
      b = new THREE.Box3();
      bounds.set(root, b);
    }
    b.expandByPoint(v.fromBufferAttribute(p, i));
  }
  const data = new Float32Array(p.count * 4);
  for (let i = 0; i < p.count; i++) {
    const b = bounds.get(find(i))!;
    const acrossX = b.max.x - b.min.x > b.max.z - b.min.z;
    const w = Math.max(
      0.000001,
      acrossX ? b.max.x - b.min.x : b.max.z - b.min.z,
    );
    const h = Math.max(0.000001, b.max.y - b.min.y);
    const u = acrossX ? p.getX(i) - b.min.x : p.getZ(i) - b.min.z;
    const seed =
      Math.sin(
        (b.min.x + b.max.x) * 37.3 +
          (b.min.y + b.max.y) * 73.1 +
          (b.min.z + b.max.z) * 41.7,
      ) * 43758.5453;
    data[i * 4] = u / w;
    data[i * 4 + 1] = (p.getY(i) - b.min.y) / h;
    data[i * 4 + 2] = seed - Math.floor(seed);
    data[i * 4 + 3] = h / w;
  }
  g.setAttribute('aRotaWindow', new THREE.BufferAttribute(data, 4));
}

/** A slow lighting schedule per opening AND per building instance. All
 * scheduling runs in the vertex shader, never a CPU traversal of the town. */
export function lightWindows(
  material: THREE.MeshToonMaterial,
  time: { value: number },
  dusk: { value: number },
  home: boolean,
) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTownTime = time;
    shader.uniforms.uTownDusk = dusk;
    shader.vertexShader = shader.vertexShader.replace(
      'void main() {',
      `attribute vec4 aRotaWindow;
varying vec4 vRotaWindow;
varying float vWindowLit;
uniform float uTownTime, uTownDusk;
void main() {
  vec4 house = vec4(0.0, 0.0, 0.0, 1.0);
  #ifdef USE_INSTANCING
    house = instanceMatrix * house;
  #endif
  house = modelMatrix * house;
  float seed = fract(aRotaWindow.z + sin(dot(house.xz, vec2(127.1, 311.7))) * 43758.5453);
  vRotaWindow = vec4(aRotaWindow.xy, seed, aRotaWindow.w);
  float period = 38.0 + 86.0 * fract(seed * 31.71);
  float cycle = fract(uTownTime / period + fract(seed * 17.17));
  float occupied = smoothstep(0.01, 0.035, cycle) * (1.0 - smoothstep(0.79, 0.815, cycle));
  float threshold = fract(seed * 7.31) * 0.96;
  float on = smoothstep(threshold - 0.035, threshold + 0.035, 0.025 + uTownDusk * 0.85);
  vWindowLit = on * occupied;
`,
    );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        'void main() {',
        'varying vec4 vRotaWindow;\nvarying float vWindowLit;\nvoid main() {',
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
  vec2 pane = vRotaWindow.xy;
  float seed = vRotaWindow.z;
  float curtain = 0.0;
  ${
    home
      ? `// Gathered side curtains and a narrow pelmet, confined to the glass.
  if (vRotaWindow.w > 0.65 && fract(seed * 13.7) > 0.23) {
    float width = 0.13 + 0.13 * fract(seed * 23.7) + 0.065 * pow(1.0 - pane.y, 2.0);
    curtain = max(1.0 - smoothstep(width, width + 0.018, min(pane.x, 1.0 - pane.x)), smoothstep(0.9, 0.93, pane.y));
  }`
      : ''
  }
  vec3 warm = mix(vec3(1.0, 0.60, 0.25), vec3(1.0, 0.79, 0.46), fract(seed * 19.31));
  vec3 cloth = mix(vec3(0.48, 0.40, 0.27), vec3(0.7, 0.62, 0.45), step(0.5, fract(pane.x * 13.0)));
  diffuseColor.rgb = mix(diffuseColor.rgb, cloth, curtain * 0.82);
  totalEmissiveRadiance += warm * vWindowLit * mix(1.65, 0.36, curtain);
`,
      );
  };
  material.customProgramCacheKey = () => `rota-window-light-v1|${home}`;
  return material;
}

/** Existing gas-lamp/headlight lenses, gently luminous in daylight and
 * distinctly warm at dusk. No actual point light per tiny lantern. */
export function lightLens(
  material: THREE.MeshBasicMaterial,
  dusk: { value: number },
  stationary = false,
) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTownDusk = dusk;
    shader.vertexShader = shader.vertexShader.replace(
      'void main() {',
      `varying float vRotaLens;
uniform float uTownDusk;
void main() {
  ${
    stationary
      ? `// Fixed lanterns light at slightly different hours. Moving vehicle
  // lenses use a common dusk threshold so travel cannot change their light.
  vec4 lamp = vec4(0.0, 0.0, 0.0, 1.0);
  #ifdef USE_INSTANCING
    lamp = instanceMatrix * lamp;
  #endif
  lamp = modelMatrix * lamp;
  float threshold = 0.14 + 0.08 * fract(sin(dot(lamp.xz, vec2(127.1, 311.7))) * 43758.5453);`
      : 'float threshold = 0.28;'
  }
  vRotaLens = smoothstep(threshold, threshold + 0.28, uTownDusk);
`,
    );
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', 'varying float vRotaLens;\nvoid main() {')
      .replace(
        '#include <color_fragment>',
        '#include <color_fragment>\n diffuseColor.rgb *= mix(0.7, 2.5, vRotaLens);',
      );
  };
  material.customProgramCacheKey = () => `rota-lens-dusk-v3|${stationary}`;
  return material;
}
