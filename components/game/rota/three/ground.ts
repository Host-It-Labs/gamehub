import * as THREE from 'three';
import type { MapDef } from '@/lib/games/rota/maps';
import { toon } from './materials';
import { surfaceGLSL } from './surfaces';
import { CUTTING_HALF } from '@/lib/games/rota/scale';
export { LANE_HALF, RING } from '@/lib/games/rota/neighbourhood';
import { LANE_HALF, RING } from '@/lib/games/rota/neighbourhood';
import { lateDusk } from '@/lib/games/rota/daylight';

const CUT = CUTTING_HALF - 0.004;

/**
 * The ground under the mill town: one heightfield, flat through the town
 * that surrounds the board and rising into moorland hills beyond it.
 * Rivers carve channels into it and the docks sink it, so one water plane
 * under everything shows through both. The ground's shader draws the
 * board itself: a cleared site of cinder and rough grass with faint chalk
 * survey lines, sandstone flags on the centre squares, the yards and
 * setts of the old town round it, and the squares the chosen piece may go
 * on, which glow. Under an overpass the ground opens for the cutting.
 *
 * Board coordinates: square (col, row) spans [col, col + 1] × [row, row + 1]
 * on x and z; the world shifts them so the board's middle sits at the origin.
 */

export const WATER_Y = -0.024;
const SEA_DEPTH = -0.075;
const RIVER_DEPTH = -0.055;
/** The fine part of the grid reaches this far past the board's edge,
 *  beyond the ends of the streets that leave it. */
const FINE = 9;
const FAR = 26;
/** The town is flat this far out; the moors rise beyond. */
const TOWN = 8;
/** The old town's back lanes: half their width, and the ring lane round the
 *  site this far out, with terraces between it and the board. */

export type Polyline = { x: number; z: number }[];

/** Sea squares, with those on the edge running on off the board. */
function seaTest(map: MapDef) {
  const n = map.size;
  const sea = new Set(map.sea);
  return (col: number, row: number) => {
    const inside = col >= 0 && row >= 0 && col < n && row < n;
    const c = Math.min(n - 1, Math.max(0, col)),
      r = Math.min(n - 1, Math.max(0, row));
    if (inside) return sea.has(r * n + c);
    return sea.has(r * n + c);
  };
}

/** Distance from a point to a square, zero inside it. */
const rectDist = (x: number, z: number, c: number, r: number) => {
  const dx = Math.max(c - x, 0, x - (c + 1)),
    dz = Math.max(r - z, 0, z - (r + 1));
  return Math.hypot(dx, dz);
};

const hash = (x: number, z: number) => {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
};
function noise(x: number, z: number) {
  const xi = Math.floor(x),
    zi = Math.floor(z);
  const xf = x - xi,
    zf = z - zi;
  const u = xf * xf * (3 - 2 * xf),
    v = zf * zf * (3 - 2 * zf);
  const a = hash(xi, zi),
    b = hash(xi + 1, zi),
    c = hash(xi, zi + 1),
    d = hash(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function axis(n: number) {
  const out: number[] = [];
  for (let x = -FAR; x < -FINE; x += 0.5) out.push(x);
  for (let x = -FINE; x < n + FINE; x += 1 / 12) out.push(x);
  for (let x = n + FINE; x <= n + FAR + 1e-6; x += 0.5) out.push(x);
  return out;
}

/** Buckets of river points by square, for quick distance queries. */
function bucket(lines: Polyline[]) {
  const b = new Map<string, { x: number; z: number }[]>();
  for (const line of lines)
    for (const p of line) {
      const k = `${Math.floor(p.x)},${Math.floor(p.z)}`;
      const list = b.get(k);
      if (list) list.push(p);
      else b.set(k, [p]);
    }
  return b;
}

export type GroundOptions = {
  map: MapDef;
  rivers: Polyline[];
  /** Straight corridors kept flat for the exits' roads and rails. */
  corridors: { x0: number; z0: number; x1: number; z1: number }[];
  /** Raised land (Ridge's hills), as centres and radii in squares. */
  hills?: { x: number; z: number; r: number; h: number }[];
};

export class Ground {
  readonly mesh: THREE.Mesh;
  readonly water: THREE.Mesh;
  readonly cells: THREE.DataTexture;
  private readonly cellData: Uint8Array;
  private readonly uniforms: {
    uTime: { value: number };
    uN: { value: number };
    uCells: { value: THREE.DataTexture };
    uCuts: { value: THREE.DataTexture };
    uDusk: { value: number };
    uLateDusk: { value: number };
  };
  private readonly cutData: Uint8Array;
  private readonly cuts: THREE.DataTexture;
  private readonly xs: number[];
  private readonly zs: number[];
  private riverKey = '';
  private readonly waterNormal: THREE.Texture;
  private waterDay = new THREE.Color('#3f7f86');
  private waterEvening = new THREE.Color('#456b85');

  constructor(
    private map: MapDef,
    detail = { value: 1 },
  ) {
    const n = map.size;
    this.xs = axis(n);
    this.zs = axis(n);
    const nx = this.xs.length,
      nz = this.zs.length;
    const pos = new Float32Array(nx * nz * 3);
    const uv = new Float32Array(nx * nz * 2);
    for (let j = 0; j < nz; j++)
      for (let i = 0; i < nx; i++) {
        const k = j * nx + i;
        pos[k * 3] = this.xs[i];
        pos[k * 3 + 2] = this.zs[j];
        uv[k * 2] = this.xs[i] / 1.2;
        uv[k * 2 + 1] = this.zs[j] / 1.2;
      }
    const index: number[] = [];
    for (let j = 0; j < nz - 1; j++)
      for (let i = 0; i < nx - 1; i++) {
        const a = j * nx + i,
          b = a + 1,
          c = a + nx,
          d = c + 1;
        index.push(a, c, b, b, c, d);
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(index);

    this.cellData = new Uint8Array(n * n * 4);
    for (const c of map.centre) this.cellData[c * 4 + 2] = 255;
    this.cells = new THREE.DataTexture(this.cellData, n, n, THREE.RGBAFormat);
    this.cells.magFilter = this.cells.minFilter = THREE.NearestFilter;
    this.cells.needsUpdate = true;
    this.cutData = new Uint8Array(n * n * 4);
    this.cuts = new THREE.DataTexture(this.cutData, n, n, THREE.RGBAFormat);
    this.cuts.magFilter = this.cuts.minFilter = THREE.NearestFilter;
    this.cuts.needsUpdate = true;
    this.uniforms = {
      uTime: { value: 0 },
      uN: { value: n },
      uCells: { value: this.cells },
      uCuts: { value: this.cuts },
      uDusk: { value: 0 },
      uLateDusk: { value: 0 },
    };

    // Full-resolution procedural materials over the town's three light tones.
    const material = toon('#ffffff');
    const u = this.uniforms;
    const tone = {
      uMoor: { value: new THREE.Color('#7f8a4f') },
      uHeather: { value: new THREE.Color('#8d7280') },
      uYard: { value: new THREE.Color('#8f8676') },
      uYardLight: { value: new THREE.Color('#9b927f') },
      uSetts: { value: new THREE.Color('#77716a') },
      uCinder: { value: new THREE.Color('#8a8172') },
      uGrass: { value: new THREE.Color('#8f9866') },
      uLine: { value: new THREE.Color('#e7dfca') },
      uFlags: { value: new THREE.Color('#c4b494') },
      uSand: { value: new THREE.Color('#a39a86') },
      uBed: { value: new THREE.Color('#4b6f72') },
      uFoam: { value: new THREE.Color('#d9dfd8') },
    };
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, u, tone, { uSurfaceDetail: detail });
      shader.vertexShader = shader.vertexShader
        .replace('void main() {', 'varying vec3 vRota;\nvoid main() {')
        .replace(
          '#include <project_vertex>',
          '#include <project_vertex>\n  vRota = (modelMatrix * vec4(transformed, 1.0)).xyz;',
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          'void main() {',
          `varying vec3 vRota;
uniform float uTime;
uniform float uN;
uniform float uDusk, uLateDusk;
uniform sampler2D uCells;
uniform sampler2D uCuts;
uniform vec3 uMoor, uHeather, uYard, uYardLight, uCinder, uGrass, uLine, uFlags, uSand, uBed, uFoam, uSetts;
${surfaceGLSL}
// Explicit gradients keep these material choices filtered at their edges.
vec3 rotaTownColour(RotaSurface surface, float away) {
  vec2 b = surface.p;
  vec2 lane = abs(fract(b) - 0.5);
  // Narrow back lanes, paler than the routes you build. None reach the
  // site: the first ring round it is terraces and their yards, closed off
  // by a lane all the way round, so only the ways out touch the board.
  float near = min(lane.x, lane.y);
  float reach = smoothstep(${(RING - LANE_HALF - 0.012).toFixed(3)}, ${(RING - LANE_HALF).toFixed(3)}, away);
  float street = (1.0 - smoothstep(${LANE_HALF.toFixed(3)} - 0.012, ${LANE_HALF.toFixed(3)}, near)) * reach;
  float patchy = rotaNoise(b * 0.5) * 0.6 + rotaNoise(b * 2.3) * 0.4;
  vec3 town = mix(uYard, uYardLight, smoothstep(0.45, 0.6, patchy)) * rotaEarth(surface);
  float pave = (1.0 - smoothstep(${(LANE_HALF + 0.03).toFixed(3)}, ${(LANE_HALF + 0.042).toFixed(3)}, near))
    * smoothstep(${(RING - LANE_HALF - 0.054).toFixed(3)}, ${(RING - LANE_HALF - 0.042).toFixed(3)}, away);
  if (pave > 0.0)
    town = mix(town, uLine * 0.82 * rotaFlags(surface), pave * 0.9);
  if (street > 0.0)
    town = mix(town, uSetts * rotaSetts(surface), street);
  return town;
}
vec3 rotaMoorColour(RotaSurface surface) {
  return mix(uMoor, uHeather, smoothstep(0.55, 0.7, rotaNoise(surface.p * 0.35))) * rotaGrass(surface);
}
void main() {
  // Capture before Three.js clipping and our own cutting/region branches.
  vec2 b = vRota.xz + vec2(uN * 0.5);
  RotaSurface surface = rotaSurface(b);`,
        )
        .replace(
          '#include <map_fragment>',
          `vec2 pixelWidth = abs(surface.dx) + abs(surface.dy);
  float lineAA = max(pixelWidth.x, pixelWidth.y);
  float inside = step(0.0, b.x) * step(0.0, b.y) * step(b.x, uN) * step(b.y, uN);
  vec2 f = fract(b);
  vec2 g2 = min(f, 1.0 - f);
  float edge = min(g2.x, g2.y);
  vec4 cell = texture2D(uCells, (floor(clamp(b, 0.0, uN - 0.001)) + 0.5) / uN);
  // Under an overpass the ground opens for the cutting.
  vec4 cut = texture2D(uCuts, (floor(clamp(b, 0.0, uN - 0.001)) + 0.5) / uN);
  if (inside > 0.5 && ((cut.r > 0.5 && abs(f.y - 0.5) < ${CUT.toFixed(3)}) || (cut.g > 0.5 && abs(f.x - 0.5) < ${CUT.toFixed(3)}))) discard;
  float away = max(max(-b.x, -b.y), max(b.x - uN, b.y - uN));
  vec3 col;
  if (inside > 0.5) {
    // The site: rough grass over cinder, squares told apart by a faint
    // checker, with chalk survey lines. Centre flags replace the soil.
    vec2 sq = floor(b);
    float check = mod(sq.x + sq.y, 2.0);
    if (cell.b > 0.5) {
      col = uFlags * rotaFlags(surface) * mix(0.97, 1.03, check);
    } else {
      float rough = rotaNoise(b * 2.2) * 0.55 + rotaNoise(b * 7.0) * 0.45;
      col = mix(uCinder * rotaEarth(surface), uGrass * rotaGrass(surface), 0.25 + 0.5 * smoothstep(0.3, 0.75, rough));
      col *= mix(0.97, 1.035, check);
    }
    float line = 1.0 - smoothstep(0.006 - lineAA * 0.5, 0.012 + lineAA * 0.5, edge);
    col = mix(col, uLine, line * 0.7);
  } else if (away >= ${(TOWN + 0.5).toFixed(1)}) {
    col = rotaMoorColour(surface);
  } else {
    // The old town: cobbled lanes on the half-squares beyond the first
    // ring, yards between them, and moors beyond. Only the transition needs both materials.
    col = rotaTownColour(surface, away);
    if (away > ${(TOWN - 1.5).toFixed(1)})
      col = mix(col, rotaMoorColour(surface), smoothstep(${(TOWN - 1.5).toFixed(1)}, ${(TOWN + 0.5).toFixed(1)}, away));
  }
  // Sand under the water's edge, a turquoise bed deeper down, and a band
  // of white foam where the land meets the water.
  float wet = smoothstep(-0.006, -0.016, vRota.y);
  col = mix(col, uSand, wet);
  col = mix(col, uBed, smoothstep(-0.03, -0.05, vRota.y));
  float foam = smoothstep(-0.016, -0.02, vRota.y) * (1.0 - smoothstep(-0.026, -0.03, vRota.y));
  col = mix(col, uFoam, foam * 0.9);
  diffuseColor.rgb = col;`,
        )
        .replace(
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>
  {
    float pulse = 0.62 + 0.38 * sin(uTime * 3.2);
    float rim = smoothstep(0.035, 0.06, edge) * (1.0 - smoothstep(0.06, 0.12, edge));
    float fill = smoothstep(0.04, 0.12, edge);
    vec3 warm = vec3(1.0, 0.86, 0.36);
    totalEmissiveRadiance += warm * cell.r * inside * (rim * 1.1 * pulse + fill * 0.16);
    // Cool twilight fill has a small colour-preserving floor on the site.
    // No dark grade over streets, survey lines or the target overlay.
    totalEmissiveRadiance += col * (inside * uDusk * 0.09 + uLateDusk * 0.10);
    // The square the dragged piece would land on, and the one to turn.
    totalEmissiveRadiance += vec3(1.0, 0.95, 0.8) * cell.a * inside * fill * 0.26;
    // Rockfall's mark: a red ring in the middle of the square.
    vec2 m = fract(b) - 0.5;
    float r = length(m);
    float ring = smoothstep(0.03, 0.0, abs(r - 0.33)) + smoothstep(0.022, 0.0, min(abs(m.x - m.y), abs(m.x + m.y))) * step(r, 0.3);
    totalEmissiveRadiance += vec3(1.0, 0.18, 0.1) * cell.g * inside * ring * (0.55 + 0.45 * pulse);
  }`,
        );
    };
    material.customProgramCacheKey = () => 'rota-ground-surfaces-v3';
    this.mesh = new THREE.Mesh(g, material);
    this.mesh.receiveShadow = true;
    this.mesh.position.set(-n / 2, 0, -n / 2);

    // The water: a gently rippling plane under the whole landscape.
    this.waterNormal = rippleTexture();
    const water = new THREE.MeshStandardMaterial({
      color: '#3f7f86',
      roughness: 0.25,
      metalness: 0,
      normalMap: this.waterNormal,
      normalScale: new THREE.Vector2(0.25, 0.25),
      transparent: true,
      opacity: 0.8,
      envMapIntensity: 0.9,
    });
    // The water never shows through the ground's opening for a cutting.
    water.onBeforeCompile = (shader) => {
      shader.uniforms.uCuts = this.uniforms.uCuts;
      shader.uniforms.uN = this.uniforms.uN;
      shader.vertexShader = shader.vertexShader
        .replace('void main() {', 'varying vec3 vRota;\nvoid main() {')
        .replace(
          '#include <project_vertex>',
          '#include <project_vertex>\n  vRota = (modelMatrix * vec4(transformed, 1.0)).xyz;',
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          'void main() {',
          'varying vec3 vRota;\nuniform sampler2D uCuts;\nuniform float uN;\nvoid main() {',
        )
        .replace(
          '#include <clipping_planes_fragment>',
          `#include <clipping_planes_fragment>
  {
    vec2 b = vRota.xz + vec2(uN * 0.5);
    vec2 f = fract(b);
    float inside = step(0.0, b.x) * step(0.0, b.y) * step(b.x, uN) * step(b.y, uN);
    vec4 cut = texture2D(uCuts, (floor(clamp(b, 0.0, uN - 0.001)) + 0.5) / uN);
    if (inside > 0.5 && ((cut.r > 0.5 && abs(f.y - 0.5) < ${(CUT + 0.03).toFixed(3)}) || (cut.g > 0.5 && abs(f.x - 0.5) < ${(CUT + 0.03).toFixed(3)}))) discard;
  }`,
        );
    };
    water.customProgramCacheKey = () => 'rota-water-cut';
    this.water = new THREE.Mesh(
      new THREE.PlaneGeometry(FAR * 2 + n * 2, FAR * 2 + n * 2).rotateX(
        -Math.PI / 2,
      ),
      water,
    );
    this.water.position.y = WATER_Y;
    this.water.receiveShadow = true;
  }

  /** Set the heights for the current rivers (and the map's sea and hills). */
  shape(opts: GroundOptions) {
    const key = JSON.stringify(
      opts.rivers.map((l) => [l[0], l[l.length - 1], l.length]),
    );
    if (key === this.riverKey && this.mesh.geometry.getAttribute('normal'))
      return;
    this.riverKey = key;
    const n = this.map.size;
    const sea = seaTest(this.map);
    const hasSea = this.map.sea.length > 0;
    const rivers = bucket(opts.rivers);
    const pos = this.mesh.geometry.getAttribute(
      'position',
    ) as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    const nx = this.xs.length;
    for (let j = 0; j < this.zs.length; j++)
      for (let i = 0; i < nx; i++) {
        const x = this.xs[i],
          z = this.zs[j];
        let h = 0;
        const outside = Math.max(-x, -z, x - n, z - n);
        // The town is flat; the moors roll up beyond it. Ridge's hills come
        // nearer, but never under a route that leaves the board.
        if (outside > 0.6) {
          let flat = 1;
          for (const c of opts.corridors)
            flat = Math.min(flat, smooth(0.3, 0.8, segDist(x, z, c)));
          // Only ever up: the water stays in the rivers and the docks.
          const roll =
            Math.pow(noise(x * 0.14, z * 0.14), 2) * 1.1 +
            noise(x * 0.5, z * 0.5) * 0.08;
          h += roll * smooth(TOWN, TOWN + 4, outside) * flat;
          for (const hill of opts.hills ?? []) {
            const d = Math.hypot(x - hill.x, z - hill.z) / hill.r;
            if (d < 1) h += hill.h * (1 - d * d) * (1 - d * d) * flat;
          }
        }
        if (hasSea) {
          const c = Math.floor(x),
            r = Math.floor(z);
          const wet = sea(c, r);
          let d = 2;
          for (let dr = -2; dr <= 2; dr++)
            for (let dc = -2; dc <= 2; dc++)
              if (sea(c + dc, r + dr) !== wet)
                d = Math.min(d, rectDist(x, z, c + dc, r + dr));
          // Outside the board the coast wanders a little.
          const wobble =
            outside > 0.3
              ? (noise(x * 1.7, z * 1.7) - 0.5) *
                0.35 *
                smooth(0.3, 1.5, outside)
              : 0;
          const s = (wet ? d : -d) + wobble;
          if (s > -0.08) h = Math.min(h, SEA_DEPTH * smooth(-0.08, 0.35, s));
        }
        if (rivers.size) {
          const c = Math.floor(x),
            r = Math.floor(z);
          let d = 9;
          for (let dr = -1; dr <= 1; dr++)
            for (let dc = -1; dc <= 1; dc++) {
              const list = rivers.get(`${c + dc},${r + dr}`);
              if (list)
                for (const p of list)
                  d = Math.min(d, Math.hypot(p.x - x, p.z - z));
            }
          if (d < 0.24)
            h = Math.min(h, RIVER_DEPTH * (1 - smooth(0.11, 0.22, d)));
        }
        arr[(j * nx + i) * 3 + 1] = h;
      }
    pos.needsUpdate = true;
    this.mesh.geometry.computeVertexNormals();
    this.mesh.geometry.computeBoundingSphere();
  }

  /** Height of the ground at a board point (bilinear on the grid). */
  heightAt(x: number, z: number) {
    const xs = this.xs,
      zs = this.zs;
    const i = Math.max(0, Math.min(xs.length - 2, upper(xs, x) - 1));
    const j = Math.max(0, Math.min(zs.length - 2, upper(zs, z) - 1));
    const fx = (x - xs[i]) / (xs[i + 1] - xs[i]),
      fz = (z - zs[j]) / (zs[j + 1] - zs[j]);
    const arr = (
      this.mesh.geometry.getAttribute('position') as THREE.BufferAttribute
    ).array as Float32Array;
    const nx = xs.length;
    const h = (a: number, b: number) => arr[(b * nx + a) * 3 + 1];
    return (
      h(i, j) * (1 - fx) * (1 - fz) +
      h(i + 1, j) * fx * (1 - fz) +
      h(i, j + 1) * (1 - fx) * fz +
      h(i + 1, j + 1) * fx * fz
    );
  }

  /** The overpass squares, whose ground opens for the rail's cutting:
   *  `x` when the rail runs east–west, `z` north–south. */
  setCuts(cuts: Map<number, 'x' | 'z'>) {
    this.cutData.fill(0);
    for (const [c, axis] of cuts)
      this.cutData[c * 4 + (axis === 'x' ? 0 : 1)] = 255;
    this.cuts.needsUpdate = true;
  }

  /** Per square: lit as a target, Rockfall's mark, highlighted. */
  setCells(targets: Set<number> | undefined, strike: number, focus: number[]) {
    const n = this.map.size;
    for (let c = 0; c < n * n; c++) {
      this.cellData[c * 4] = targets?.has(c) ? 255 : 0;
      this.cellData[c * 4 + 1] = c === strike ? 255 : 0;
      this.cellData[c * 4 + 3] = focus.includes(c) ? 255 : 0;
    }
    this.cells.needsUpdate = true;
  }

  tick(time: number) {
    this.uniforms.uTime.value = time;
    this.waterNormal.offset.set(time * 0.013, time * 0.008);
  }

  setDusk(dusk: number) {
    this.uniforms.uDusk.value = dusk;
    this.uniforms.uLateDusk.value = lateDusk(dusk);
    (this.water.material as THREE.MeshStandardMaterial).color
      .copy(this.waterDay)
      .lerp(this.waterEvening, dusk);
  }

  dispose() {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
    this.water.geometry.dispose();
    (this.water.material as THREE.Material).dispose();
    this.cells.dispose();
    this.cuts.dispose();
    this.waterNormal.dispose();
  }
}

function upper(list: number[], v: number) {
  let lo = 0,
    hi = list.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (list[mid] <= v) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function segDist(
  x: number,
  z: number,
  c: { x0: number; z0: number; x1: number; z1: number },
) {
  const dx = c.x1 - c.x0,
    dz = c.z1 - c.z0;
  const t = Math.max(
    0,
    Math.min(1, ((x - c.x0) * dx + (z - c.z0) * dz) / (dx * dx + dz * dz || 1)),
  );
  return Math.hypot(x - (c.x0 + dx * t), z - (c.z0 + dz * t));
}

/** A tiling normal map of soft ripples. */
function rippleTexture() {
  const size = 256;
  const data = new Uint8Array(size * size * 4);
  const height = (x: number, y: number) => {
    const u = (x / size) * Math.PI * 2,
      v = (y / size) * Math.PI * 2;
    return (
      Math.sin(u * 3 + v * 2) * 0.5 +
      Math.sin(u * 7 - v * 5) * 0.25 +
      Math.sin(u * 2 - v * 9) * 0.18 +
      Math.sin(u * 13 + v * 11) * 0.08
    );
  };
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const dx = height(x + 1, y) - height(x - 1, y);
      const dy = height(x, y + 1) - height(x, y - 1);
      const nx = -dx * 2,
        ny = -dy * 2,
        nz = 1;
      const l = Math.hypot(nx, ny, nz);
      const k = (y * size + x) * 4;
      data[k] = ((nx / l) * 0.5 + 0.5) * 255;
      data[k + 1] = ((ny / l) * 0.5 + 0.5) * 255;
      data[k + 2] = ((nz / l) * 0.5 + 0.5) * 255;
      data[k + 3] = 255;
    }
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(40, 40);
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}
