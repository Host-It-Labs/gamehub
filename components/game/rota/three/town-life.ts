import * as THREE from 'three';
import type { QualityTier } from '@/lib/games/rota/quality';
import { qualityLevels } from '@/lib/games/rota/quality';
import { FRONTAGE, HOUSE_DEPTH } from '@/lib/games/rota/scale';
import { Materials, toon } from './materials';
import type { Row } from './scenery';

export type TerraceYard = {
  row: number;
  house: number;
  x: number;
  y: number;
  z: number;
  rot: number;
  width: number;
  /** Rear-wall to shared garden boundary, derived from the opposed row. */
  depth: number;
  shared: boolean;
  seed: number;
};

/** Derive the enclosed rear strips from actual opposed rows. In particular,
 * the entire perimeter terrace is eligible, rather than one in five rows.
 * A row without a measured rear neighbour gets no invented garden. */
export function planTerraceYards(rows: readonly Row[], n: number) {
  const out: TerraceYard[] = [];
  const away = (x: number, z: number) => Math.max(-x, -z, x - n, z - n);
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (away(row.x, row.z) < 0.7 || away(row.x, row.z) > 3.8) continue;
    const c = Math.cos(row.rot),
      s = Math.sin(row.rot);
    for (let h = 0; h < row.houses; h++) {
      const u = (h + 0.5 - row.houses / 2) * FRONTAGE;
      let best = -1,
        depth = 0,
        lo = u - FRONTAGE / 2,
        hi = u + FRONTAGE / 2;
      let width = 0;
      for (let j = 0; j < rows.length; j++) {
        if (
          j === i ||
          Math.cos(rows[j].rot - row.rot) > -0.99 ||
          Math.abs(row.y - rows[j].y) > 0.007
        )
          continue;
        const other = rows[j],
          dx = other.x - row.x,
          dz = other.z - row.z;
        const v = dx * s + dz * c;
        if (v > -0.37 || v < -0.49) continue;
        const along = dx * c - dz * s;
        const a = Math.max(
          u - FRONTAGE / 2,
          along - (other.houses * FRONTAGE) / 2,
        );
        const b = Math.min(
          u + FRONTAGE / 2,
          along + (other.houses * FRONTAGE) / 2,
        );
        if (b - a > width) {
          best = j;
          width = b - a;
          lo = a;
          hi = b;
          depth = (-v - HOUSE_DEPTH) / 2;
        }
      }
      if (best < 0 || width < 0.145 || depth < 0.055) continue;
      const along = (lo + hi) / 2;
      const x = row.x + along * c,
        z = row.z - along * s;
      const seed =
        (Math.imul(Math.round(x * 500), 73856093) ^
          Math.imul(Math.round(z * 500), 19349663) ^
          Math.imul(h + 11, 83492791)) >>>
        0;
      out.push({
        row: i,
        house: h,
        x,
        y: (row.y + rows[best].y) / 2,
        z,
        rot: row.rot,
        width,
        depth,
        shared: i < best,
        seed,
      });
    }
  }
  // Fill the perimeter first, then the nearest outer blocks. Sorting equal
  // distances by stable seeds distributes washing and outbuildings round it.
  out.sort((a, b) => away(a.x, a.z) - away(b.x, b.z) || a.seed - b.seed);
  return out.slice(0, 300);
}

/** Small domestic silhouettes in the yards, and a few pigeons above the
 * far terraces. Everything is merged/instanced; motion is one GPU uniform. */
export class TownLife {
  readonly group = new THREE.Group();
  private time = { value: 0 };
  private birds: THREE.InstancedMesh;
  private geometries: THREE.BufferGeometry[] = [];
  private materials: THREE.Material[] = [];
  private yardMaterials: Materials;
  private ownYardMaterials: boolean;
  private lineGeometry: THREE.BufferGeometry;
  private clothGeometry: THREE.BufferGeometry;
  private lineRanges: number[] = [];
  private clothRanges: number[] = [];

  constructor(
    rows: Row[],
    n: number,
    private still: boolean,
    materials?: Materials,
  ) {
    this.yardMaterials = materials ?? new Materials();
    this.ownYardMaterials = !materials;
    const fittings: number[] = [];
    const cloth: number[] = [],
      colours: number[] = [],
      pins: number[] = [];
    const matrix = new THREE.Matrix4(),
      q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0),
      p = new THREE.Vector3();
    const colour = new THREE.Color();
    const bins = new Map<string, { position: number[]; colour: number[] }>();
    const vertex = (arr: number[], x: number, y: number, z: number) => {
      p.set(x, y, z).applyMatrix4(matrix);
      arr.push(p.x, p.y, p.z);
    };
    const unitBox = new THREE.BoxGeometry(1, 1, 1).toNonIndexed();
    const boxPoints = unitBox.getAttribute('position');
    const box = (
      family: string,
      x: number,
      y: number,
      z: number,
      w: number,
      h: number,
      d: number,
      tint: string,
      rx = 0,
    ) => {
      let bin = bins.get(family);
      if (!bin) {
        bin = { position: [], colour: [] };
        bins.set(family, bin);
      }
      colour.set(tint);
      const c = Math.cos(rx),
        s = Math.sin(rx);
      for (let i = 0; i < boxPoints.count; i++) {
        const u = boxPoints.getX(i) * w,
          v = boxPoints.getY(i) * h,
          t = boxPoints.getZ(i) * d;
        vertex(bin.position, x + u, y + v * c - t * s, z + v * s + t * c);
        bin.colour.push(colour.r, colour.g, colour.b);
      }
    };
    const triangle = (family: string, vertices: number[][], tint: string) => {
      let bin = bins.get(family);
      if (!bin) {
        bin = { position: [], colour: [] };
        bins.set(family, bin);
      }
      colour.set(tint);
      for (const [x, y, z] of vertices) {
        vertex(bin.position, x, y, z);
        bin.colour.push(colour.r, colour.g, colour.b);
      }
    };
    const beam = (
      x: number,
      y: number,
      z: number,
      w: number,
      h: number,
      d: number,
    ) => {
      for (let i = 0; i < boxPoints.count; i++)
        vertex(
          fittings,
          x + boxPoints.getX(i) * w,
          y + boxPoints.getY(i) * h,
          z + boxPoints.getZ(i) * d,
        );
    };
    const walls = new Set<string>();
    const wall = (x: number, z: number, w: number, d: number, tint: string) => {
      p.set(x, 0, z).applyMatrix4(matrix);
      const swapped = Math.abs(matrix.elements[0]) < 0.5;
      const key = `${Math.round(p.x * 2000)}:${Math.round(p.z * 2000)}:${Math.round((swapped ? d : w) * 2000)}:${Math.round((swapped ? w : d) * 2000)}`;
      if (walls.has(key)) return;
      walls.add(key);
      box('brick', x, 0.022, z, w, 0.044, d, tint);
      box('stone', x, 0.046, z, w + 0.003, 0.004, d + 0.003, '#ad9c81');
    };
    let made = 0;
    const yards = planTerraceYards(rows, n);
    for (const yard of yards) {
      q.setFromAxisAngle(up, yard.rot);
      matrix.compose(
        new THREE.Vector3(yard.x, yard.y, yard.z),
        q,
        new THREE.Vector3(1, 1, 1),
      );
      const rear = -HOUSE_DEPTH / 2,
        far = rear - yard.depth;
      const side = yard.width / 2;
      const brick = ['#794b3c', '#855444', '#6b493d', '#8a5845'][yard.seed % 4];
      for (const sign of [-1, 1])
        wall(
          sign * side,
          rear - yard.depth / 2,
          0.007,
          yard.depth - 0.003,
          brick,
        );
      if (yard.shared) {
        const opening = 0.028,
          offset = yard.width * 0.18;
        wall(
          (-side + offset - opening / 2) / 2,
          far,
          side + offset - opening / 2,
          0.008,
          brick,
        );
        wall(
          (side + offset + opening / 2) / 2,
          far,
          side - offset - opening / 2,
          0.008,
          brick,
        );
        box('wood', offset, 0.013, far, opening, 0.005, 0.004, '#665c47');
        box('wood', offset, 0.036, far, opening, 0.004, 0.004, '#665c47');
        for (let k = 0; k < 4; k++)
          box(
            'wood',
            offset - opening / 2 + ((k + 0.5) * opening) / 4,
            0.025,
            far,
            0.004,
            0.043,
            0.003,
            '#786b50',
          );
      }
      const privy = yard.seed % 4 < 2;
      const bx = -Math.min(0.054, side - 0.035);
      const bz = far + 0.026;
      if (privy) {
        const w = 0.046,
          d = 0.046,
          h = 0.074;
        box('brick', bx - w / 2 + 0.003, h / 2, bz, 0.006, h, d, brick);
        for (const sign of [-1, 1]) {
          box(
            'brick',
            bx,
            h / 2,
            bz + sign * (d / 2 - 0.003),
            w,
            h,
            0.006,
            brick,
          );
          box(
            'brick',
            bx + w / 2 - 0.003,
            h / 2,
            bz + sign * 0.0185,
            0.006,
            h,
            0.009,
            brick,
          );
        }
        box('brick', bx + w / 2 - 0.003, 0.069, bz, 0.006, 0.01, d, brick);
        box(
          'wood',
          bx + w / 2 - 0.004,
          0.033,
          bz,
          0.003,
          0.061,
          0.027,
          yard.seed % 3 ? '#52645b' : '#74624d',
        );
        box(
          'stone',
          bx + w / 2 + 0.006,
          0.003,
          bz,
          0.019,
          0.006,
          0.033,
          '#aaa087',
        );
        box(
          'coal',
          bx + w / 2 - 0.001,
          0.033,
          bz + 0.008,
          0.002,
          0.003,
          0.002,
          '#292b2b',
        );
        box(
          'slate',
          bx,
          0.078,
          bz,
          w + 0.006,
          0.005,
          d + 0.006,
          '#626a70',
          0.12,
        );
        // A little vent under the high edge gives the outbuilding a purpose.
        box(
          'coal',
          bx,
          0.065,
          bz + d / 2 + 0.0005,
          0.014,
          0.006,
          0.001,
          '#303332',
        );
      }
      if (yard.seed % 5 !== 0) {
        const cx = Math.min(0.049, side - 0.028),
          cz = far + 0.022;
        const w = 0.05,
          d = 0.034;
        for (const sign of [-1, 1]) {
          box(
            'wood',
            cx + sign * (w / 2 - 0.002),
            0.013,
            cz,
            0.004,
            0.026,
            d,
            '#625e4d',
          );
          box(
            'wood',
            cx,
            0.013,
            cz + sign * (d / 2 - 0.002),
            w,
            0.026,
            0.004,
            '#6e6550',
          );
        }
        const heap = [
          [cx - 0.021, 0.023, cz - 0.012],
          [cx + 0.021, 0.023, cz - 0.012],
          [cx + 0.021, 0.023, cz + 0.012],
          [cx - 0.021, 0.023, cz + 0.012],
        ];
        const top = [cx - 0.006, 0.035, cz + 0.002];
        for (let j = 0; j < 4; j++)
          triangle(
            'coal',
            [heap[(j + 1) % 4], heap[j], top],
            j % 2 ? '#41413a' : '#2a3030',
          );
        box(
          'coal',
          cx - 0.016,
          0.011,
          cz + d / 2 + 0.001,
          0.002,
          0.024,
          0.002,
          '#41413a',
        );
        box(
          'coal',
          cx + 0.016,
          0.011,
          cz + d / 2 + 0.001,
          0.002,
          0.024,
          0.002,
          '#41413a',
        );
      }
      for (let k = 0; k < 2; k++)
        box(
          'stone',
          0.005 + k * 0.0015,
          0.0012,
          rear - 0.013 - k * 0.023,
          0.031,
          0.0024,
          0.021,
          k ? '#a39980' : '#b2a58b',
        );
      if (privy || yard.seed % 3 === 0 || made >= 44) continue;
      const lineZ = rear - yard.depth * 0.52;
      const reach = Math.min(0.08, side - 0.014);
      for (const s of [-1, 1])
        beam(s * reach, 0.036, lineZ, 0.003, 0.072, 0.003);
      beam(0, 0.069, lineZ, reach * 2, 0.0012, 0.0012);
      for (let k = 0; k < 4; k++) {
        const x = -reach * 0.72 + k * reach * 0.48;
        const shirt = k % 3 === 1;
        const outline = shirt
          ? [
              [-0.012, 0],
              [-0.018, -0.008],
              [-0.013, -0.015],
              [-0.009, -0.011],
              [-0.009, -0.036],
              [0.009, -0.036],
              [0.009, -0.011],
              [0.013, -0.015],
              [0.018, -0.008],
              [0.012, 0],
            ]
          : [
              [-0.014, 0],
              [-0.014, -0.039],
              [0.014, -0.039],
              [0.014, 0],
            ];
        colour.set(
          ['#d6d0bb', '#89979a', '#b59d96', '#e3d8ba'][(k + yard.seed) % 4],
        );
        // Concave sleeves need proper topology; pegged tops remain fixed.
        const contour = outline.map(([u, v]) => new THREE.Vector2(u, v));
        const triangles = THREE.ShapeUtils.triangulateShape(contour, []);
        for (const tri of triangles)
          for (const index of tri) {
            const v = outline[index];
            vertex(
              cloth,
              x + v[0],
              0.068 + v[1],
              lineZ + Math.sin(v[0] * 90) * 0.0007,
            );
            colours.push(colour.r, colour.g, colour.b);
            pins.push(Math.min(1, Math.max(0, -v[1] / 0.039)));
          }
      }
      made++;
      this.lineRanges.push(fittings.length / 3);
      this.clothRanges.push(cloth.length / 3);
    }
    unitBox.dispose();
    const geometry = (pos: number[]) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.computeVertexNormals();
      this.geometries.push(g);
      return g;
    };
    const iron = toon('#665b4b');
    this.materials.push(iron);
    this.lineGeometry = geometry(fittings);
    const poles = new THREE.Mesh(this.lineGeometry, iron);
    poles.name = 'rota-yard-washing-posts';
    this.group.add(poles);
    for (const [family, bin] of bins) {
      const g = geometry(bin.position);
      g.setAttribute('color', new THREE.Float32BufferAttribute(bin.colour, 3));
      const mat = this.yardMaterials.tiled(
        family === 'coal' ? 'metal' : family,
        '#ffffff',
        { vertexColors: true },
      );
      const mesh = new THREE.Mesh(g, mat);
      mesh.name = `rota-yard-${family}`;
      mesh.castShadow = family !== 'stone';
      mesh.receiveShadow = true;
      this.group.add(mesh);
    }
    this.group.userData.yards = yards;
    this.group.userData.washingLines = made;
    const linen = toon('#ffffff', { vertexColors: true });
    linen.side = THREE.DoubleSide;
    linen.onBeforeCompile = (shader) => {
      shader.uniforms.uLifeTime = this.time;
      shader.vertexShader = shader.vertexShader
        .replace(
          'void main() {',
          'attribute float aClothPin;\nuniform float uLifeTime;\nvoid main() {',
        )
        .replace(
          '#include <begin_vertex>',
          '#include <begin_vertex>\n transformed.z += sin(uLifeTime * 1.35 + position.x * 11.0 + position.z * 9.0) * 0.005 * aClothPin;',
        );
    };
    linen.customProgramCacheKey = () => 'rota-yard-cloth-v1';
    const sheets = geometry(cloth);
    this.clothGeometry = sheets;
    sheets.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
    sheets.setAttribute('aClothPin', new THREE.Float32BufferAttribute(pins, 1));
    this.materials.push(linen);
    const washing = new THREE.Mesh(sheets, linen);
    washing.castShadow = true;
    washing.name = 'rota-yard-washing';
    this.group.add(washing);

    // A charcoal/grey pigeon silhouette: pointed wings fold at the shoulder,
    // a separate tail fan and a small body. True wingspan about 0.65 m.
    const bird = geometry([
      -0.006, 0, -0.002, 0.006, 0.001, 0, -0.006, 0, 0.002, -0.006, 0, -0.002,
      -0.006, 0, 0.002, -0.009, 0, 0, 0.003, 0, 0, -0.007, 0, -0.013, -0.003, 0,
      0, -0.003, 0, 0, -0.007, 0, 0.013, 0.003, 0, 0,
    ]);
    const phase = new Float32Array(8);
    for (let i = 0; i < 8; i++) phase[i] = i * 0.71;
    bird.setAttribute(
      'aBirdPhase',
      new THREE.InstancedBufferAttribute(phase, 1),
    );
    const feathers = toon('#525862');
    feathers.side = THREE.DoubleSide;
    feathers.onBeforeCompile = (shader) => {
      shader.uniforms.uLifeTime = this.time;
      shader.vertexShader = shader.vertexShader
        .replace(
          'void main() {',
          'attribute float aBirdPhase;\nuniform float uLifeTime;\nvoid main() {',
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          float t = uLifeTime * 0.22 + aBirdPhase;
          float flap = sin(uLifeTime * 6.4 + aBirdPhase * 4.0);
          transformed.y += abs(position.z) * flap * 0.68;
          float heading = atan(sin(t) * 0.3, cos(t) * 0.7);
          float c = cos(heading), s = sin(heading);
          transformed.xz = mat2(c, -s, s, c) * transformed.xz;
          transformed.x += sin(t) * 0.7;
          transformed.z += cos(t) * 0.3;
          transformed.y += sin(t * 2.0) * 0.07;`,
        );
    };
    feathers.customProgramCacheKey = () => 'rota-pigeons-v1';
    this.materials.push(feathers);
    this.birds = new THREE.InstancedMesh(bird, feathers, 8);
    const tf = new THREE.Matrix4();
    for (let i = 0; i < 8; i++) {
      tf.makeTranslation(
        -1.1 + (i / 7) * (n + 2.2),
        1.05 + (i % 3) * 0.09,
        -2.3 - (i % 2) * 0.28,
      );
      this.birds.setMatrixAt(i, tf);
    }
    // Vertex motion has wider bounds than the tiny source bird.
    this.birds.frustumCulled = false;
    this.group.add(this.birds);
  }

  tick(time: number) {
    this.time.value = this.still ? 2.7 : time;
  }

  setQuality(tier: QualityTier) {
    const lines = { high: 44, balanced: 28, low: 14 }[tier];
    this.lineGeometry.setDrawRange(
      0,
      this.lineRanges[Math.min(lines, this.lineRanges.length) - 1] ?? 0,
    );
    this.clothGeometry.setDrawRange(
      0,
      this.clothRanges[Math.min(lines, this.clothRanges.length) - 1] ?? 0,
    );
    if (this.ownYardMaterials)
      this.yardMaterials.detail.value = qualityLevels[tier].detail;
    this.birds.count = qualityLevels[tier].birds;
    this.birds.visible = this.birds.count > 0;
  }

  dispose() {
    this.birds.dispose();
    for (const g of this.geometries) g.dispose();
    for (const m of this.materials) m.dispose();
    if (this.ownYardMaterials) this.yardMaterials.dispose();
    this.group.clear();
  }
}
