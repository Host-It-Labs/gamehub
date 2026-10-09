import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  BOSSES,
  nodeById,
  type RoadMap,
  type RoadNode,
} from '@/lib/games/diner/road';
import { Kit, makeMaterials, meshes, type Materials } from './kit';
import { disposeSurfaceMaterials } from './materials';
import {
  BIOME_DECOR,
  BIOME_LOOK,
  decor,
  placeLandmark,
  type Biome,
  type Landmark,
} from './overworld-models';
import {
  branch,
  COLUMN,
  columnIndex,
  columnZ,
  distanceToLine,
  junction,
  LANE_X,
  lotAt,
  LOT_R,
  roadPieces,
  roamBand,
  START,
  stopPoint,
  type P2,
} from './overworld-layout';
import { buildRig, RIG, type Rig } from './rig';
import type { Rung } from '../render-pacer';
import { nativeRatio } from '../render-quality';

/**
 * The campaign's road map (9 October 2026): a small toy world you drive the
 * diner rig around. At each fork the road splits toward two places; drive
 * into one's lot to stop there. The camera follows the truck from behind and
 * above, close enough to read the places, keeping both choices in view.
 */
export type OverworldState = {
  map: RoadMap;
  visited: readonly string[];
  /** Where the truck is parked; null before the first stop. */
  at: string | null;
  /** Stops you may drive to now; empty while a panel is open. */
  choices: readonly string[];
};

export type OverworldEvents = {
  /** The truck rolled into (or out of) a choice's lot. */
  onLot(id: string | null): void;
  /** The truck finished parking at a stop you chose. */
  onArrive(id: string): void;
};

/** A stop's sign, positioned by the overworld every frame. */
export type SignAnchor = { id: string; x: number; y: number; visible: boolean };

const SCALE = 0.62; // the rig at map scale
const MAX_SPEED = 11;
const OFF_ROAD = 0.72;
const ACCEL = 20;
const BIOMES: Biome[] = ['desert', 'coast', 'moon'];
const biomeOf = (leg: number): Biome => BIOMES[Math.min(2, leg)];
/**
 * Which stretch this z is in, as a blend 0..2 (desert → coast → moon): pure
 * through each leg, turning over only in the last stretch before the next.
 */
function biomeBlend(z: number) {
  const legLength = 5 * COLUMN;
  const d = (junction(0).z - z) / legLength;
  const leg = Math.floor(d);
  const u = d - leg;
  return Math.max(
    0,
    Math.min(2, leg + THREE.MathUtils.smoothstep(u, 0.86, 1.02)),
  );
}
const lerpColour = (a: string, b: string, t: number) =>
  new THREE.Color(a).lerp(new THREE.Color(b), t);
function look(z: number) {
  const b = biomeBlend(z);
  const i = Math.min(1, Math.floor(b));
  const t = b - i;
  const A = BIOME_LOOK[BIOMES[i]];
  const B = BIOME_LOOK[BIOMES[Math.min(2, i + 1)]];
  return {
    ground: lerpColour(A.ground, B.ground, t),
    groundFar: lerpColour(A.groundFar, B.groundFar, t),
    sky: lerpColour(A.sky, B.sky, t),
    horizon: lerpColour(A.horizon, B.horizon, t),
    sun: lerpColour(A.sun, B.sun, t),
    sunI: A.sunI + (B.sunI - A.sunI) * t,
    hemi: A.hemi + (B.hemi - A.hemi) * t,
  };
}

function seeded(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A flat ribbon along a polyline, `y` above the ground. */
function ribbon(
  points: readonly P2[],
  width: number,
  y: number,
  from = 0,
  to = 1,
): THREE.BufferGeometry | null {
  const n = points.length;
  const a = Math.floor(from * (n - 1));
  const b = Math.ceil(to * (n - 1));
  if (b - a < 1) return null;
  const pos: number[] = [];
  const idx: number[] = [];
  for (let i = a; i <= b; i++) {
    const p = points[i];
    const q = points[Math.min(n - 1, i + 1)];
    const o = points[Math.max(0, i - 1)];
    let dx = q.x - o.x,
      dz = q.z - o.z;
    const len = Math.hypot(dx, dz) || 1;
    dx /= len;
    dz /= len;
    // The normal to the left of travel.
    const nx = -dz,
      nz = dx;
    pos.push(
      p.x + (nx * width) / 2,
      y,
      p.z + (nz * width) / 2,
      p.x - (nx * width) / 2,
      y,
      p.z - (nz * width) / 2,
    );
    if (i > a) {
      const k = (i - a) * 2;
      idx.push(k - 2, k, k - 1, k - 1, k, k + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  // Make every face point up whatever the winding.
  const normals = g.getAttribute('normal');
  for (let i = 0; i < normals.count; i++) normals.setXYZ(i, 0, 1, 0);
  return g;
}

/** A polyline lengthened a little at both ends, so joints overlap. */
function extend(points: readonly P2[], by: number): P2[] {
  const a = points[0],
    b = points[1];
  const y = points[points.length - 1],
    z = points[points.length - 2];
  const la = Math.hypot(b.x - a.x, b.z - a.z) || 1;
  const lz = Math.hypot(y.x - z.x, y.z - z.z) || 1;
  return [
    { x: a.x - ((b.x - a.x) / la) * by, z: a.z - ((b.z - a.z) / la) * by },
    ...points,
    { x: y.x + ((y.x - z.x) / lz) * by, z: y.z + ((y.z - z.z) / lz) * by },
  ];
}

/** Resample a polyline at even spacing. */
function resample(points: readonly P2[], step: number): P2[] {
  const out: P2[] = [points[0]];
  let carry = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i],
      b = points[i + 1];
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    let d = step - carry;
    while (d <= len) {
      const t = d / len;
      out.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t });
      d += step;
    }
    carry = len - (d - step);
  }
  const last = points[points.length - 1];
  if (
    Math.hypot(out[out.length - 1].x - last.x, out[out.length - 1].z - last.z) >
    step * 0.3
  )
    out.push(last);
  return out;
}

type Placed = {
  node: RoadNode;
  landmark: Landmark;
  at: THREE.Vector3;
  ring: THREE.Mesh;
  flag: THREE.Object3D | null;
};

export class Overworld {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(38, 1, 0.5, 400);
  private mats: Materials;
  private rig: Rig;
  private truck = new THREE.Group();
  private world = new THREE.Group();
  private placed = new Map<string, Placed>();
  private builtLegs = 0;
  private colliders: { x: number; z: number; r: number }[] = [];
  private roads: P2[][] = [];
  private barriers = new THREE.Group();
  private hemi: THREE.HemisphereLight;
  private sun: THREE.DirectionalLight;
  private base = nativeRatio();
  private env: THREE.Texture;
  private state: OverworldState | null = null;
  private pos = new THREE.Vector2(START.x, START.z);
  private vel = new THREE.Vector2();
  /** Facing: -π/2 is up the road (north). */
  private heading = -Math.PI / 2;
  private camTarget = new THREE.Vector3(START.x, 0, START.z - 8);
  private lot: string | null = null;
  private auto: { path: P2[]; id: string; commit: boolean } | null = null;
  private parked: string | null = null;
  private owned: { dispose(): void }[] = [];
  /** A light speckle the ground's colours are multiplied by. */
  private detail = groundDetail();
  private time = 0;
  private wheelSpin = 0;
  reduced = false;
  /** The stick, set by the screen: x right, z down the screen. */
  stick = { x: 0, z: 0 };
  /** Called every frame with each choice's sign position. */
  onSigns: ((anchors: SignAnchor[]) => void) | null = null;

  constructor(
    canvas: HTMLCanvasElement,
    private events: OverworldEvents,
    private quality: 'high' | 'low',
  ) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(this.base);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.mats = makeMaterials();
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const room = new RoomEnvironment();
    this.env = pmrem.fromScene(room, 0.04).texture;
    room.dispose();
    pmrem.dispose();
    this.scene.environment = this.env;
    this.scene.environmentIntensity = 0.35;
    this.hemi = new THREE.HemisphereLight('#bcd0ff', '#6b5040', 0.9);
    this.sun = new THREE.DirectionalLight('#ffd2a0', 2.3);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sun.shadow.camera, {
      left: -32,
      right: 32,
      top: 32,
      bottom: -32,
      near: 1,
      far: 120,
    });
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.04;
    this.scene.add(this.hemi, this.sun, this.sun.target);
    this.scene.fog = new THREE.Fog('#f0b48a', 70, 150);
    this.rig = buildRig(this.mats, {
      length: 5.2,
      open: false,
      toy: true,
      quality,
    });
    this.rig.group.scale.setScalar(SCALE);
    // The rig's origin is the trailer's front end; centre the whole truck.
    this.rig.group.position.set((-(5.2 - 2.7) / 2) * SCALE, 0, 0);
    this.rig.group.traverse((o) => {
      if (o instanceof THREE.Mesh) o.castShadow = true;
    });
    this.truck.add(this.rig.group);
    this.scene.add(this.world, this.barriers, this.truck);
  }

  /** The night's road, where the truck stands and what may be chosen. */
  setState(s: OverworldState) {
    const before = this.state;
    this.state = s;
    while (this.builtLegs < s.map.legs.length)
      this.buildLeg(s.map, this.builtLegs++);
    if (!before || before.at !== s.at) {
      // Parked somewhere new (a new run, a restored run, a shift banked).
      const node = s.at ? nodeById(s.map, s.at) : null;
      const p = node ? stopPoint(node) : START;
      if (this.parked !== s.at) {
        this.pos.set(p.x, p.z);
        this.vel.set(0, 0);
        this.heading = -Math.PI / 2;
        this.camTarget.set(p.x, 0, p.z - 8);
      }
      this.parked = s.at;
      this.auto = null;
    }
    this.lot = null;
    this.refreshMarks();
  }

  private choiceColumn(): number | null {
    const s = this.state;
    if (!s || !s.choices.length) return null;
    const n = nodeById(s.map, s.choices[0]);
    return n ? columnIndex(n) : null;
  }

  private buildLeg(map: RoadMap, leg: number) {
    const k = new Kit();
    const rand = seeded(map.seed * 31 + leg * 977);
    const biome = biomeOf(leg);
    const g0 = leg * 5;
    const zNorth = junction(g0 + 5).z - (leg === map.legs.length - 1 ? 60 : 0);
    const zSouth = leg === 0 ? START.z + 40 : junction(g0).z;
    const length = zSouth - zNorth;

    // Ground: one strip, gently hilly away from the road, tinted by stretch.
    const segX = this.quality === 'high' ? 64 : 36;
    const segZ = Math.max(
      8,
      Math.round(length / (this.quality === 'high' ? 2.4 : 4)),
    );
    const geo = new THREE.PlaneGeometry(150, length, segX, segZ);
    // The speckle repeats every 9 m whatever the strip's length.
    const uv = geo.getAttribute('uv');
    for (let i = 0; i < uv.count; i++)
      uv.setXY(i, (uv.getX(i) * 150) / 9, (uv.getY(i) * length) / 9);
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, 0, (zSouth + zNorth) / 2);
    const pos = geo.getAttribute('position');
    const colours = new Float32Array(pos.count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i),
        z = pos.getZ(i);
      const L = look(z);
      const far = THREE.MathUtils.smoothstep(Math.abs(x), 22, 45);
      const hill =
        far *
        (1.4 +
          Math.sin(x * 0.11 + z * 0.07) * 1.1 +
          Math.sin(z * 0.05 - x * 0.04) * 0.9);
      pos.setY(i, Math.max(0, hill));
      const n = Math.sin(x * 0.37 + z * 0.21) * Math.sin(z * 0.13 - x * 0.09);
      c.copy(L.ground)
        .lerp(L.groundFar, far * 0.8)
        .offsetHSL(0, 0, n * 0.025);
      colours.set([c.r, c.g, c.b], i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colours, 3));
    geo.computeVertexNormals();
    const groundMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.95,
      metalness: 0,
      map: this.detail,
    });
    const ground = new THREE.Mesh(geo, groundMat);
    ground.receiveShadow = true;
    this.world.add(ground);
    this.owned.push(geo, groundMat);

    // Water east of the coast road.
    if (biome === 'coast') {
      const wg = new THREE.PlaneGeometry(70, length, 1, 1);
      const wm = new THREE.MeshStandardMaterial({
        color: '#3d7e98',
        roughness: 0.18,
        metalness: 0.15,
      });
      const water = new THREE.Mesh(wg, wm);
      water.rotation.x = -Math.PI / 2;
      water.position.set(70, 0.9, (zSouth + zNorth) / 2);
      this.world.add(water);
      this.owned.push(wg, wm);
    }

    // Roads and lots for this leg's columns.
    const pieces = roadPieces(map).filter(
      (p) =>
        p.column >= g0 &&
        p.column < g0 + 5 + (leg === map.legs.length - 1 ? 1 : 0),
    );
    if (leg === 0) pieces.unshift(roadPieces(map)[0]);
    const asphalt: THREE.BufferGeometry[] = [];
    const lots: THREE.BufferGeometry[] = [];
    const lines: THREE.BufferGeometry[] = [];
    for (const piece of pieces) {
      const pts = resample(extend(piece.points, 1.6), 0.8);
      this.roads.push(pts);
      const r = ribbon(pts, 3.4, 0.04);
      const straight = piece.points.length <= 2;
      if (r) asphalt.push(r);
      const len = pts.length;
      if (len < 8) continue;
      // Cream edge lines, and a dashed centre line, kept off the junctions.
      for (const side of [-1, 1]) {
        const off = pts.map((p, i) => {
          const q = pts[Math.min(len - 1, i + 1)],
            o = pts[Math.max(0, i - 1)];
          const dx = q.x - o.x,
            dz = q.z - o.z;
          const l = Math.hypot(dx, dz) || 1;
          return {
            x: p.x + (-dz / l) * 1.5 * side,
            z: p.z + (dx / l) * 1.5 * side,
          };
        });
        // Edge lines stay clear of the splits, where branches cross.
        const e = ribbon(
          off,
          0.12,
          0.05,
          straight ? 0.08 : 0.34,
          straight ? 0.92 : 0.66,
        );
        if (e) lines.push(e);
      }
      for (
        let i = Math.ceil(len * (straight ? 0.08 : 0.2));
        i < len * (straight ? 0.92 : 0.8) - 2;
        i += 4
      ) {
        const d = ribbon(pts.slice(i, i + 3), 0.16, 0.05);
        if (d) lines.push(d);
      }
    }
    const lotGeo = new THREE.CircleGeometry(LOT_R, 40);
    lotGeo.rotateX(-Math.PI / 2);
    const lotRing = new THREE.RingGeometry(LOT_R - 0.22, LOT_R - 0.08, 48);
    lotRing.rotateX(-Math.PI / 2);
    for (const node of map.legs[leg].nodes) {
      const p = stopPoint(node);
      lots.push(lotGeo.clone().translate(p.x, 0.045, p.z));
      lines.push(lotRing.clone().translate(p.x, 0.055, p.z));
    }
    lotGeo.dispose();
    lotRing.dispose();
    const roadMat = new THREE.MeshStandardMaterial({
      color: '#55565f',
      roughness: 0.92,
      metalness: 0,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    const lineMat = new THREE.MeshStandardMaterial({
      color: '#efe3c6',
      roughness: 0.7,
      metalness: 0,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
    });
    const lotMat = new THREE.MeshStandardMaterial({
      color: '#77757c',
      roughness: 0.9,
      metalness: 0,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -3,
    });
    this.owned.push(roadMat, lineMat, lotMat);
    for (const [list, mat] of [
      [asphalt, roadMat],
      [lots, lotMat],
      [lines, lineMat],
    ] as const) {
      const merged = mergeFlat(list);
      if (!merged) continue;
      const mesh = new THREE.Mesh(merged, mat);
      mesh.receiveShadow = true;
      this.world.add(mesh);
      this.owned.push(merged);
    }

    // Landmarks beside each stop, on the outer side of its lot.
    for (const node of map.legs[leg].nodes) {
      const p = stopPoint(node);
      const kind =
        node.kind === 'garage' || node.kind === 'motel'
          ? node.kind
          : node.place;
      const landmark = placeLandmark(this.mats, kind, this.quality);
      const side = node.lane === 0 ? -1 : Math.sign(node.lane);
      const at = new THREE.Vector3(
        p.x + side * (LOT_R + landmark.radius * 0.85),
        0,
        p.z - 2.2,
      );
      landmark.group.position.copy(at);
      // Face the road.
      landmark.group.rotation.y = -side * 0.5;
      if (node.boss) landmark.group.scale.setScalar(1.25);
      landmark.group.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.castShadow = true;
          o.receiveShadow = true;
        }
      });
      this.world.add(landmark.group);
      this.colliders.push({
        x: at.x,
        z: at.z,
        r: landmark.radius * (node.boss ? 1.25 : 1),
      });
      const ringGeo = new THREE.RingGeometry(LOT_R - 0.05, LOT_R + 0.35, 56);
      ringGeo.rotateX(-Math.PI / 2);
      const ringMat = new THREE.MeshBasicMaterial({
        color: '#ffd38a',
        transparent: true,
        opacity: 0.85,
        toneMapped: false,
        depthWrite: false,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.set(p.x, 0.07, p.z);
      ring.visible = false;
      this.world.add(ring);
      this.owned.push(ringGeo, ringMat);
      this.placed.set(node.id, { node, landmark, at, ring, flag: null });
    }

    // Scenery scattered around, clear of the roads, lots and landmarks.
    const kinds = BIOME_DECOR[biome];
    const total = kinds.reduce((a, [, w]) => a + w, 0);
    const count = this.quality === 'high' ? 300 : 160;
    for (let i = 0; i < count; i++) {
      // Two in three close to the road, where the camera looks.
      const near = rand() < 0.66;
      const x = near
        ? (rand() < 0.5 ? -1 : 1) * (5 + rand() * 24)
        : (rand() - 0.5) * 130;
      const z = zNorth + rand() * length;
      const p = { x, z };
      if (this.roads.some((r) => distanceToLine(r, p) < 3.6)) continue;
      if (
        map.legs[leg].nodes.some((n) => {
          const s = stopPoint(n);
          return Math.hypot(s.x - x, s.z - z) < LOT_R + 2;
        })
      )
        continue;
      if (
        [...this.placed.values()].some(
          (pl) => Math.hypot(pl.at.x - x, pl.at.z - z) < pl.landmark.radius + 2,
        )
      )
        continue;
      if (biome === 'coast' && x > 32) continue;
      let r = rand() * total;
      let kind = kinds[0][0];
      for (const [kk, w] of kinds) {
        r -= w;
        if (r < 0) {
          kind = kk;
          break;
        }
      }
      const s = 0.8 + rand() * 0.6;
      decor(k, kind, x, z, s, rand() * Math.PI * 2);
      if (Math.abs(x) < 26 && kind !== 'crater')
        this.colliders.push({ x, z, r: 0.7 * s });
    }
    if (biome === 'desert')
      for (let i = 0; i < 6; i++)
        decor(
          k,
          'mesa',
          (rand() < 0.5 ? -1 : 1) * (42 + rand() * 20),
          zNorth + rand() * length,
          1 + rand() * 0.8,
          rand() * 3,
        );
    const decorGroup = meshes(k.build(), this.mats);
    decorGroup.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    this.world.add(decorGroup);
  }

  /** Rings round the stops you may choose, flags on the ones you passed. */
  private refreshMarks() {
    const s = this.state;
    if (!s) return;
    for (const [id, pl] of this.placed) {
      pl.ring.visible = s.choices.includes(id);
      const visited = s.visited.includes(id);
      if (visited && !pl.flag) {
        const fk = new Kit();
        fk.cyl('chrome', RIG.chrome, 0.05, 0.05, 2.2, [0, 1.1, 0], { seg: 8 });
        const flag = new THREE.Shape();
        flag.moveTo(0, 0);
        flag.lineTo(1.1, -0.3);
        flag.lineTo(0, -0.6);
        flag.closePath();
        fk.add(
          'cloth',
          RIG.cherry,
          new THREE.ShapeGeometry(flag),
          [0.03, 2.2, 0],
        );
        pl.flag = meshes(fk.build(), this.mats);
        const p = stopPoint(pl.node);
        pl.flag.position.set(
          p.x + (pl.node.lane >= 0 ? -LOT_R : LOT_R) * 0.75,
          0,
          p.z - LOT_R * 0.5,
        );
        this.world.add(pl.flag);
      }
    }
    // Road-closed barriers past the stops being chosen.
    this.barriers.clear();
    const g = this.choiceColumn();
    if (g === null) return;
    const bk = new Kit();
    for (const id of s.choices) {
      const n = nodeById(s.map, id)!;
      const p = stopPoint(n);
      const ahead = { x: p.x * 0.85, z: p.z - LOT_R - 3.2 };
      barrier(bk, ahead.x, ahead.z);
    }
    const j = junction(g + 1);
    barrier(bk, j.x, j.z + 2);
    this.barriers.add(meshes(bk.build(), this.mats));
  }

  /** Drive into a stop's lot on your own (a tap on its sign, or a key). */
  driveTo(id: string, commit = false) {
    const s = this.state;
    const node = s ? nodeById(s.map, id) : null;
    if (!s || !node || !s.choices.includes(id)) return;
    const p = stopPoint(node);
    const j = junction(columnIndex(node));
    const path: P2[] = [];
    if (this.pos.y > j.z + 1) path.push({ x: j.x, z: j.z });
    // Then along the branch to the lot, from wherever the truck joins it.
    for (const q of resample(branch(j, p), 2.5))
      if (q.z < Math.min(this.pos.y, j.z) - 0.5) path.push(q);
    path.push(p);
    this.auto = { path, id, commit };
  }

  /** Park in this stop's lot, facing on up the road, then report back. */
  commit(id: string) {
    const s = this.state;
    const node = s ? nodeById(s.map, id) : null;
    if (!node) return;
    const p = stopPoint(node);
    if (Math.hypot(p.x - this.pos.x, p.z - this.pos.y) > LOT_R + 0.5) {
      this.driveTo(id, true);
      return;
    }
    this.auto = { path: [p], id, commit: true };
  }

  /** Draw at a pacer rung: a share of native density and a shadow size. */
  setRung(r: Rung) {
    this.renderer.setPixelRatio(this.base * r.resolution);
    if (this.sun.shadow.mapSize.x !== r.shadowSize) {
      this.sun.shadow.mapSize.set(r.shadowSize, r.shadowSize);
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
    }
  }

  resize() {
    const r = this.renderer.domElement.getBoundingClientRect();
    const w = Math.max(1, r.width),
      h = Math.max(1, r.height);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // Short screens (a sideways phone) see a little more up and down.
    this.camera.fov = h < 500 ? 46 : 38;
    this.camera.updateProjectionMatrix();
  }

  /** One frame: the truck, the camera, the light, the signs. */
  frame(dt: number) {
    const s = this.state;
    if (!s) return;
    if (!this.reduced) this.time += dt;
    let ix = this.stick.x,
      iz = this.stick.z;
    if (this.auto) {
      const next = this.auto.path[0];
      if (!next) {
        const done = this.auto;
        this.auto = null;
        this.vel.set(0, 0);
        if (done.commit) {
          this.parked = done.id;
          this.events.onArrive(done.id);
        }
      } else {
        const dx = next.x - this.pos.x,
          dz = next.z - this.pos.y;
        const d = Math.hypot(dx, dz);
        const last = this.auto.path.length === 1;
        if (d < (last ? 0.25 : 1.4)) this.auto.path.shift();
        const slow = last ? Math.min(1, d / 3 + 0.15) : 1;
        ix = (dx / (d || 1)) * slow;
        iz = (dz / (d || 1)) * slow;
      }
      // A push on the stick takes the wheel back.
      if (Math.hypot(this.stick.x, this.stick.z) > 0.3 && !this.auto?.commit)
        this.auto = null;
    }
    const len = Math.hypot(ix, iz);
    if (len > 1) {
      ix /= len;
      iz /= len;
    }
    const here = { x: this.pos.x, z: this.pos.y };
    const onRoad =
      this.roads.some((r) => distanceToLine(r, here) < 2.2) ||
      lotAt(
        [...this.placed.values()].map((p) => p.node),
        here,
      ) !== null;
    const top = MAX_SPEED * (onRoad ? 1 : OFF_ROAD);
    const want = new THREE.Vector2(ix * top, iz * top);
    const dv = want.sub(this.vel);
    const maxDv = ACCEL * dt * (len < 0.05 ? 1.3 : 1);
    if (dv.length() > maxDv) dv.setLength(maxDv);
    this.vel.add(dv);
    this.pos.addScaledVector(this.vel, dt);
    // Stay in the band of the fork being chosen, and out of solid things.
    const g = this.choiceColumn();
    if (g !== null && !this.auto?.commit) {
      const band = roamBand(g);
      if (this.pos.y > band.south) {
        this.pos.y = band.south;
        this.vel.y = Math.min(0, this.vel.y);
      }
      if (this.pos.y < band.north) {
        this.pos.y = band.north;
        this.vel.y = Math.max(0, this.vel.y);
      }
      this.pos.x = THREE.MathUtils.clamp(this.pos.x, band.west, band.east);
    }
    for (const c of this.colliders) {
      const dx = this.pos.x - c.x,
        dz = this.pos.y - c.z;
      const min = c.r + 1.4;
      const d = Math.hypot(dx, dz);
      if (d < min && d > 1e-6) {
        this.pos.x = c.x + (dx / d) * min;
        this.pos.y = c.z + (dz / d) * min;
        const nx = dx / d,
          nz = dz / d;
        const into = this.vel.x * nx + this.vel.y * nz;
        if (into < 0)
          this.vel.set(this.vel.x - into * nx, this.vel.y - into * nz);
      }
    }
    const speed = this.vel.length();
    if (speed > 0.4) {
      const goal = Math.atan2(this.vel.y, -this.vel.x);
      let d = goal - this.heading;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      this.heading += d * Math.min(1, dt * 7);
    } else if (this.auto?.commit && this.auto.path.length <= 1) {
      // Settle facing on up the road.
      let d = -Math.PI / 2 - this.heading;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      this.heading += d * Math.min(1, dt * 4);
    }
    this.truck.position.set(this.pos.x, 0, this.pos.y);
    this.truck.rotation.y = this.heading;
    // A little body roll and bounce, and the wheels turning.
    const turn =
      speed > 0.5 ? THREE.MathUtils.clamp(this.vel.x * 0.004, -0.05, 0.05) : 0;
    this.rig.group.rotation.x = this.reduced
      ? 0
      : Math.sin(this.time * 18) * 0.006 * Math.min(1, speed / 4) + turn;
    this.wheelSpin += (speed / (0.55 * SCALE)) * dt;
    for (const w of this.rig.wheels) w.rotation.z = this.wheelSpin;

    // Which lot are you in?
    const choiceNodes = s.choices
      .map((id) => nodeById(s.map, id))
      .filter((n): n is RoadNode => !!n);
    const inLot =
      lotAt(choiceNodes, { x: this.pos.x, z: this.pos.y })?.id ?? null;
    if (inLot !== this.lot) {
      this.lot = inLot;
      this.events.onLot(inLot);
    }

    // Camera: behind and above, drawn toward the fork being chosen.
    // The truck low in the frame, the fork's two stops high in it.
    const fork =
      g !== null
        ? new THREE.Vector3(0, 0, columnZ(g) - 2)
        : new THREE.Vector3(this.pos.x, 0, this.pos.y - 12);
    const truck = new THREE.Vector3(this.pos.x * 0.6, 0, this.pos.y);
    const gap = Math.max(0, truck.z - fork.z);
    // Never more than 8 m ahead of the truck, so it stays on screen.
    const goal = truck
      .clone()
      .lerp(fork, g !== null && gap > 0 ? Math.min(0.6, 8 / gap) : 0);
    this.camTarget.lerp(goal, this.reduced ? 1 : Math.min(1, dt * 2.5));
    const aspect = this.camera.aspect;
    const need = LANE_X + 7; // about half the width both choices take
    const base = 30 + Math.max(0, gap - 12) * 0.55;
    const fit = Math.max(
      1,
      need /
        (base *
          Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) *
          aspect),
    );
    const dist = base * fit;
    const pitch = THREE.MathUtils.degToRad(43);
    this.camera.position.set(
      this.camTarget.x,
      Math.sin(pitch) * dist,
      this.camTarget.z + Math.cos(pitch) * dist,
    );
    this.camera.lookAt(this.camTarget);

    // Light and air follow the stretch of road.
    const L = look(this.camTarget.z);
    this.hemi.color.copy(L.sky).lerp(new THREE.Color('#ffffff'), 0.45);
    this.hemi.groundColor.copy(L.ground).multiplyScalar(0.55);
    this.hemi.intensity = L.hemi;
    this.sun.color.copy(L.sun);
    this.sun.intensity = L.sunI;
    this.sun.position.set(this.camTarget.x - 30, 42, this.camTarget.z + 18);
    this.sun.target.position.copy(this.camTarget);
    (this.scene.fog as THREE.Fog).color.copy(L.horizon);
    this.scene.background = L.horizon;

    for (const pl of this.placed.values()) {
      pl.landmark.update(this.time);
      if (pl.ring.visible) {
        const m = pl.ring.material as THREE.MeshBasicMaterial;
        const on = pl.node.id === this.lot;
        m.opacity = on
          ? 1
          : 0.55 + (this.reduced ? 0 : Math.sin(this.time * 3.2) * 0.25);
        m.color.set(on ? '#9df0d6' : '#ffd38a');
        pl.ring.scale.setScalar(on ? 1.04 : 1);
      }
    }
    this.renderer.render(this.scene, this.camera);

    if (this.onSigns) {
      const r = this.renderer.domElement.getBoundingClientRect();
      const anchors: SignAnchor[] = [];
      const v = new THREE.Vector3();
      for (const id of s.choices) {
        const pl = this.placed.get(id);
        if (!pl) continue;
        // Floating over the lot itself.
        const p = stopPoint(pl.node);
        v.set(p.x, 2.6, p.z - 1);
        v.project(this.camera);
        anchors.push({
          id,
          x: ((v.x + 1) / 2) * r.width,
          y: ((1 - v.y) / 2) * r.height,
          visible: v.z < 1,
        });
      }
      this.onSigns(anchors);
    }
  }

  /** Name of the boss at a stop, for signs. */
  static bossName(node: RoadNode) {
    return node.boss ? BOSSES[node.boss].name : null;
  }

  dispose() {
    for (const pl of this.placed.values()) pl.landmark.dispose();
    this.world.traverse((o) => {
      if (o instanceof THREE.Mesh && !this.owned.includes(o.geometry))
        o.geometry.dispose();
    });
    this.barriers.traverse((o) => {
      if (o instanceof THREE.Mesh) o.geometry.dispose();
    });
    for (const d of this.owned) d.dispose();
    this.rig.dispose();
    disposeSurfaceMaterials(this.mats);
    this.env.dispose();
    this.detail.dispose();
    this.renderer.dispose();
  }
}

/** Soft blotches and grains, near white: the ground's colours show through. */
function groundDetail() {
  const n = 256;
  const el = document.createElement('canvas');
  el.width = el.height = n;
  const c = el.getContext('2d')!;
  c.fillStyle = '#ffffff';
  c.fillRect(0, 0, n, n);
  const rand = seeded(5);
  for (let i = 0; i < 26; i++) {
    const x = rand() * n,
      y = rand() * n,
      r = 18 + rand() * 50;
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(120,100,90,${0.08 + rand() * 0.08})`);
    g.addColorStop(1, 'rgba(120,100,90,0)');
    c.fillStyle = g;
    for (const dx of [-n, 0, n])
      for (const dy of [-n, 0, n]) {
        c.save();
        c.translate(dx, dy);
        c.fillRect(x - r, y - r, r * 2, r * 2);
        c.restore();
      }
  }
  for (let i = 0; i < 2600; i++) {
    const v = rand() < 0.5 ? 150 : 255;
    c.fillStyle = `rgba(${v},${v - 10},${v - 20},${0.12 + rand() * 0.2})`;
    c.fillRect(rand() * n, rand() * n, 1 + rand() * 2, 1 + rand() * 1.5);
  }
  const t = new THREE.CanvasTexture(el);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

/** A striped sawhorse with two cones: the road ahead is closed. */
function barrier(k: Kit, x: number, z: number) {
  for (const dx of [-1, 1]) {
    k.cyl('wood', '#3a3438', 0.06, 0.06, 1.1, [x + dx * 1.0, 0.55, z - 0.2], {
      rot: [0.25, 0, 0],
      seg: 6,
    });
    k.cyl('wood', '#3a3438', 0.06, 0.06, 1.1, [x + dx * 1.0, 0.55, z + 0.2], {
      rot: [-0.25, 0, 0],
      seg: 6,
    });
  }
  for (let i = 0; i < 6; i++)
    k.box(
      'paint',
      i % 2 ? '#f3ead8' : RIG.cherry,
      [0.4, 0.34, 0.08],
      [x - 1.0 + 0.2 + i * 0.4, 0.95, z],
    );
  for (const dx of [-1.8, 1.8]) {
    k.add('gloss', '#e8833a', new THREE.ConeGeometry(0.28, 0.75, 14), [
      x + dx,
      0.38,
      z + 0.5,
    ]);
    k.cyl('gloss', '#f3ead8', 0.17, 0.2, 0.1, [x + dx, 0.42, z + 0.5], {
      seg: 14,
    });
  }
}

function mergeFlat(list: THREE.BufferGeometry[]) {
  if (!list.length) return null;
  let count = 0;
  for (const g of list)
    count += g.index ? g.index.count : g.getAttribute('position').count;
  const pos = new Float32Array(count * 3);
  let o = 0;
  for (const g of list) {
    const ng = g.index ? g.toNonIndexed() : g;
    const a = ng.getAttribute('position').array as ArrayLike<number>;
    pos.set(a as Float32Array, o);
    o += a.length;
    if (ng !== g) ng.dispose();
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const n = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) n[i * 3 + 1] = 1;
  out.setAttribute('normal', new THREE.BufferAttribute(n, 3));
  return out;
}
