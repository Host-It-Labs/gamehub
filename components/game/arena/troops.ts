import * as THREE from 'three';
import { troopCards, troopDeck, type TroopId } from '@/lib/games/arena/cards';
import {
  DEPLOY_TIME,
  TICK,
  type Tower,
  type Unit,
} from '@/lib/games/arena/engine';
import { figureDimensions, toWorld } from '@/lib/games/arena/layout';
import { teamColours, type Team } from './materials';
import { find, standHeight, type ArenaWorld } from './world';

/**
 * Drawn troops. The models are jointed (see assets/arena/blender/troops.py
 * and figures.py; a collector figure from figures.glb replaces the older
 * troop model wherever one is built) and animated here in code. Each frame a
 * troop works out the pose it wants (a walk cycle driven by distance so feet
 * never slide, an attack timed to the engine's hit timer, a flinch when hit)
 * and every joint follows that pose through its own spring, so moves blend,
 * overshoot a little and settle, and heads, tails and arms trail the body.
 * Toys walk briskly with a bounce and a sway, drop onto the mat and bounce,
 * and topple over when they fall.
 *
 * Every troop part on the field is drawn through one BatchedMesh per
 * material, so a crowded team battle costs the same few draw calls as an
 * empty field. Each troop poses a shared copy of its model (its "kit"), and
 * the kit's part matrices are copied into the batches.
 */
type PartName =
  | 'legL'
  | 'legR'
  | 'torso'
  | 'head'
  | 'armL'
  | 'armR'
  | 'weapon'
  | 'offhand'
  | 'wingL'
  | 'wingR'
  | 'tail'
  | 'jaw'
  | 'spin'
  /** The tower guard's nocked arrow, pivoting on its nock. */
  | 'arrow';
const PARTS: PartName[] = [
  'legL',
  'legR',
  'torso',
  'head',
  'armL',
  'armR',
  'weapon',
  'offhand',
  'wingL',
  'wingR',
  'tail',
  'jaw',
  'spin',
  'arrow',
];
type Rig = Partial<
  Record<PartName, { node: THREE.Object3D; rest: THREE.Euler; y: number }>
>;

type Attack =
  | 'blaster'
  | 'chomp'
  | 'jab'
  | 'cleave'
  | 'rifle'
  | 'bomb'
  | 'cast';

/** How a toy moves. Strides are tiles per step; angles are radians. */
type Style = {
  stride: number;
  legSwing: number;
  armSwing: number;
  /** Hop height per step and side-to-side sway, in world units / radians. */
  bob: number;
  sway: number;
  /** Forward lean while walking. */
  lean: number;
  attack: Attack;
  /** Seconds of wind-up before a hit. */
  windup: number;
  /** How far the body lunges into a hit, world units. */
  lunge: number;
  /** Joint spring stiffness (1/s): higher is snappier. */
  snap: number;
  /** Heavy toys shake the camera a little when they land. */
  heavy?: boolean;
  /** Both hands on one weapon: the arms swing together. */
  twoHanded?: boolean;
};
const styles: Record<TroopId, Style> = {
  // Vinyl space cadets: light and bouncy, ray guns up.
  archers: {
    stride: 0.36,
    legSwing: 0.62,
    armSwing: 0.4,
    bob: 0.075,
    sway: 0.07,
    lean: 0.05,
    attack: 'blaster',
    windup: 0.22,
    lunge: 0,
    snap: 30,
  },
  // A rubber T-rex: heavy stomps, body rolling, tail swinging the other way.
  ogre: {
    stride: 0.52,
    legSwing: 0.5,
    armSwing: 0.35,
    bob: 0.1,
    sway: 0.1,
    lean: 0.04,
    attack: 'chomp',
    windup: 0.42,
    lunge: 0.35,
    snap: 20,
    heavy: true,
  },
  // Tin wind-up robots: scurrying little steps, rocking side to side.
  imps: {
    stride: 0.2,
    legSwing: 0.55,
    armSwing: 0.25,
    bob: 0.035,
    sway: 0.12,
    lean: 0.02,
    attack: 'jab',
    windup: 0.16,
    lunge: 0.14,
    snap: 42,
  },
  // A samurai figure: low, quick glide steps and a big overhead cut, the
  // katana held in both hands throughout.
  duelist: {
    stride: 0.42,
    legSwing: 0.62,
    armSwing: 0.1,
    twoHanded: true,
    bob: 0.05,
    sway: 0.05,
    lean: 0.12,
    attack: 'cleave',
    windup: 0.42,
    lunge: 0.4,
    snap: 34,
  },
  // A frontier gunslinger: a loose swagger, the rifle carried in both hands
  // and brought to the shoulder.
  ranger: {
    stride: 0.4,
    legSwing: 0.58,
    armSwing: 0.1,
    twoHanded: true,
    bob: 0.06,
    sway: 0.08,
    lean: 0.03,
    attack: 'rifle',
    windup: 0.25,
    lunge: 0,
    snap: 30,
  },
  // A tin biplane: banks into turns, dips to drop its bombs.
  drake: {
    stride: 1,
    legSwing: 0,
    armSwing: 0,
    bob: 0,
    sway: 0,
    lean: 0,
    attack: 'bomb',
    windup: 0.35,
    lunge: 0,
    snap: 10,
  },
  // A plastic wizard: robe swaying, staff raised to cast.
  mage: {
    stride: 0.36,
    legSwing: 0.5,
    armSwing: 0.22,
    bob: 0.05,
    sway: 0.06,
    lean: 0.03,
    attack: 'cast',
    windup: 0.4,
    lunge: 0.1,
    snap: 26,
  },
};

export const FLY_HEIGHT = 2.1;
/** Troops are drawn larger than their footprint so they read on screen; the
 *  view raises this on portrait phones (`troopScale` in layout.ts). */
export const TROOP_SCALE = 1.75;
const ease = (t: number) => t * t * (3 - 2 * t);
const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t);
/** Out fast, settle slow: for strikes. */
const out3 = (t: number) => 1 - (1 - t) * (1 - t) * (1 - t);

/** One leg's place in its stride, `u` running 0 to 1: planted and sweeping
 *  back at an even speed for the first 60% (so the foot keeps pace with the
 *  ground), then lifted and swung forward. Returns how far forward the leg
 *  is (1 to -1) and how high the foot is lifted (0 to 1). */
const STANCE = 0.6;
function stride(u: number): [number, number] {
  if (u < STANCE) return [1 - (2 * u) / STANCE, 0];
  const k = (u - STANCE) / (1 - STANCE);
  return [-1 + 2 * ease(k), Math.sin(Math.PI * k)];
}

function rig(model: THREE.Object3D, id: string): Rig {
  const out: Rig = {};
  for (const p of PARTS) {
    const node = find(model, `${id}${p}`);
    if (node)
      out[p] = { node, rest: node.rotation.clone(), y: node.position.y };
  }
  return out;
}

type Part = { mesh: THREE.Mesh; batch: THREE.BatchedMesh; geometry: number };
/** Named poses a figure carries (the tower guard's draw and loose): each
 *  part's turn from its rest. */
type Poses = Record<string, Partial<Record<PartName, THREE.Quaternion>>>;
/** A posable copy of one model: troop root → body → model → parts. */
type Kit = {
  team: Team;
  group: THREE.Group;
  body: THREE.Group;
  model: THREE.Object3D;
  rig: Rig;
  parts: Part[];
  poses: Poses;
};

/** Poses stored on a model's root by Blender (`root["poses"]`, a JSON
 *  object of part → [w, x, y, z] in Blender's axes). glTF turns Blender's
 *  (x, y, z) into (x, z, -y); a rotation's axis turns the same way. */
function posesOf(model: THREE.Object3D): Poses {
  const raw = model.userData.poses;
  if (typeof raw !== 'string') return {};
  const out: Poses = {};
  const data = JSON.parse(raw) as Record<string, Record<string, number[]>>;
  for (const [name, parts] of Object.entries(data)) {
    out[name] = {};
    for (const [part, [w, x, y, z]] of Object.entries(parts))
      if ((PARTS as string[]).includes(part))
        out[name][part as PartName] = new THREE.Quaternion(
          x,
          z,
          -y,
          w,
        ).normalize();
  }
  return out;
}

/** The camera layer the x-ray pass draws (view.ts): troop batches and the
 *  placement ghost. */
export const XRAY_LAYER = 1;
const WHITE = new THREE.Color(1, 1, 1);
/** Silhouette colours as the viewer sees them: blue for yours, red. */
const xrayColours: Record<Team, THREE.Color> = {
  0: new THREE.Color(teamColours[0].light),
  1: new THREE.Color(teamColours[1].light),
};

/** Ring colours: your troops, the enemy's, and a teammate's. */
export type RingStyle = 0 | 1 | 2;
const ringColours: Record<RingStyle, string> = {
  0: teamColours[0].main,
  1: teamColours[1].main,
  2: teamColours[0].light,
};

/** An instanced mesh refilled every frame, growing when it runs out. */
class Pool {
  mesh: THREE.InstancedMesh;
  private used = 0;
  constructor(
    private scene: THREE.Scene,
    private geometry: THREE.BufferGeometry,
    private material: THREE.Material,
    private order: number,
    capacity = 32,
  ) {
    this.mesh = this.make(capacity);
  }
  private make(capacity: number) {
    const mesh = new THREE.InstancedMesh(
      this.geometry,
      this.material,
      capacity,
    );
    mesh.frustumCulled = false;
    mesh.renderOrder = this.order;
    mesh.count = 0;
    this.scene.add(mesh);
    return mesh;
  }
  push(matrix: THREE.Matrix4) {
    if (this.used >= this.mesh.instanceMatrix.count) {
      const bigger = this.make(this.mesh.instanceMatrix.count * 2);
      bigger.instanceMatrix.array.set(this.mesh.instanceMatrix.array);
      this.scene.remove(this.mesh);
      this.mesh.dispose();
      this.mesh = bigger;
    }
    this.mesh.setMatrixAt(this.used++, matrix);
  }
  flush() {
    this.mesh.count = this.used;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.used = 0;
  }
  dispose() {
    this.scene.remove(this.mesh);
    this.mesh.dispose();
  }
}

function blobTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(0,0,0,0.55)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

/** Geometries in one batch must share their attribute layout. */
function layout(geometry: THREE.BufferGeometry) {
  const names = Object.keys(geometry.attributes).sort();
  return `${names
    .map((n) => {
      const a = geometry.getAttribute(n) as THREE.BufferAttribute;
      return `${n}${a.itemSize}${a.normalized ? 'n' : ''}${a.array.constructor.name}`;
    })
    .join(',')}|${geometry.index ? 'i' : ''}`;
}

/**
 * The batches, the team rings and the flyers' ground shadows. Kits for every
 * troop and both colours are built up front so every batch and shader exists
 * before the first card lands.
 */
export class TroopRenderer {
  private kits = new Map<string, Kit>();
  private batches = new Map<string, THREE.BatchedMesh>();
  private live = new Map<THREE.BatchedMesh, number>();
  private rings: Record<RingStyle, Pool>;
  private blobs: Pool;
  private disposables: { dispose(): void }[] = [];
  private m = new THREE.Matrix4();
  /** Per batch, each instance's team for the x-ray pass, or -1 (the tower
   *  guards, which never show through). */
  private tags = new Map<THREE.BatchedMesh, Map<number, Team | -1>>();
  /** How much larger than its footprint a figure is drawn. */
  scale = TROOP_SCALE;

  constructor(private world: ArenaWorld) {
    const models = [...new Set(troopDeck.map((id) => this.modelOf(id)))];
    if (this.built('guard')) models.push('guard');
    const sources: { key: string; model: THREE.Object3D; id: string }[] = [];
    for (const id of models)
      for (const team of [0, 1] as Team[])
        sources.push({
          key: `${id}:${team}`,
          id,
          model: world.instance(this.sourceOf(id), id, team),
        });
    // Size each batch for the unique geometries that will live in it.
    const sizes = new Map<
      string,
      { material: THREE.Material; geometries: Set<THREE.BufferGeometry> }
    >();
    const keyOf = (mesh: THREE.Mesh) =>
      `${(mesh.material as THREE.Material).uuid}|${layout(mesh.geometry)}`;
    for (const { model } of sources)
      model.traverse((node) => {
        const mesh = node as THREE.Mesh;
        if (!mesh.isMesh) return;
        const key = keyOf(mesh);
        const entry = sizes.get(key) ?? {
          material: mesh.material as THREE.Material,
          geometries: new Set(),
        };
        entry.geometries.add(mesh.geometry);
        sizes.set(key, entry);
      });
    const geometryIds = new Map<THREE.BufferGeometry, number>();
    for (const [key, { material, geometries }] of sizes) {
      let vertices = 0;
      let indices = 0;
      for (const g of geometries) {
        vertices += g.getAttribute('position').count;
        indices += g.index?.count ?? 0;
      }
      const batch = new THREE.BatchedMesh(
        64,
        vertices,
        Math.max(indices, 1),
        material,
      );
      batch.frustumCulled = false;
      batch.perObjectFrustumCulled = false;
      batch.sortObjects = false;
      batch.castShadow = true;
      batch.receiveShadow = true;
      batch.layers.enable(XRAY_LAYER);
      batch.visible = false;
      this.tags.set(batch, new Map());
      for (const g of geometries) geometryIds.set(g, batch.addGeometry(g));
      this.batches.set(key, batch);
      this.live.set(batch, 0);
      world.scene.add(batch);
    }
    for (const { key, model, id } of sources) {
      const group = new THREE.Group();
      const body = new THREE.Group();
      model.scale.set(...figureDimensions(TROOP_SCALE));
      body.add(model);
      group.add(body);
      const parts: Part[] = [];
      model.traverse((node) => {
        const mesh = node as THREE.Mesh;
        if (!mesh.isMesh) return;
        parts.push({
          mesh,
          batch: this.batches.get(keyOf(mesh))!,
          geometry: geometryIds.get(mesh.geometry)!,
        });
      });
      this.kits.set(key, {
        team: key.endsWith(':1') ? 1 : 0,
        group,
        body,
        model,
        rig: rig(model, id),
        parts,
        poses: posesOf(model),
      });
    }
    const ring = new THREE.RingGeometry(0.82, 1, 40).rotateX(-Math.PI / 2);
    const plane = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    const blob = blobTexture();
    const ringMaterial = (style: RingStyle) =>
      new THREE.MeshBasicMaterial({
        color: ringColours[style],
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
      });
    const blobMaterial = new THREE.MeshBasicMaterial({
      map: blob,
      transparent: true,
      depthWrite: false,
    });
    const materials = [ringMaterial(0), ringMaterial(1), ringMaterial(2)];
    this.rings = {
      0: new Pool(world.scene, ring, materials[0], 3),
      1: new Pool(world.scene, ring, materials[1], 3),
      2: new Pool(world.scene, ring, materials[2], 3),
    };
    this.blobs = new Pool(world.scene, plane, blobMaterial, 2);
    this.disposables.push(ring, plane, blob, blobMaterial, ...materials);
  }

  /** Whether a collector figure is built for an id. */
  built(id: string) {
    const { figures } = this.world.assets;
    return !!figures && !!find(figures.scene, id);
  }

  private sourceOf(id: string) {
    const { figures, troops } = this.world.assets;
    return figures && this.built(id) ? figures : troops;
  }

  /** A troop whose model is not built yet borrows the Cadets'. */
  modelOf(card: string) {
    return this.built(card) || find(this.world.assets.troops.scene, card)
      ? card
      : 'archers';
  }

  kit(model: string, team: Team) {
    return this.kits.get(`${model}:${team}`)!;
  }

  /** Draw every figure at a new size (portrait phones draw them larger). */
  setScale(scale: number) {
    if (scale === this.scale) return;
    this.scale = scale;
    for (const kit of this.kits.values())
      kit.model.scale.set(...figureDimensions(scale));
  }

  /** Room in the batches for one more copy of a kit; `xray` false keeps
   *  it from showing through what hides it. */
  add(kit: Kit, xray = true) {
    return kit.parts.map((p) => {
      const live = this.live.get(p.batch)!;
      if (live >= p.batch.maxInstanceCount)
        p.batch.setInstanceCount(p.batch.maxInstanceCount * 2);
      this.live.set(p.batch, live + 1);
      const id = p.batch.addInstance(p.geometry);
      p.batch.visible = true;
      // Every instance carries a colour, white for the normal pass, so the
      // batch's shader exists from the first troop on.
      p.batch.setColorAt(id, WHITE);
      this.tags.get(p.batch)!.set(id, xray ? kit.team : -1);
      return id;
    });
  }

  remove(kit: Kit, ids: number[]) {
    kit.parts.forEach((p, i) => {
      p.batch.deleteInstance(ids[i]);
      this.tags.get(p.batch)!.delete(ids[i]);
      const live = this.live.get(p.batch)! - 1;
      this.live.set(p.batch, live);
      // An empty batch costs a draw call for nothing.
      p.batch.visible = live > 0;
    });
  }

  /** Tint every troop its team's silhouette colour (and hide the guards)
   *  for the x-ray pass, or back to normal. */
  xray(on: boolean) {
    for (const [batch, tags] of this.tags) {
      let shown = false;
      for (const [id, tag] of tags) {
        if (tag < 0) batch.setVisibleAt(id, !on);
        else {
          batch.setColorAt(id, on ? xrayColours[tag as Team] : WHITE);
          shown = true;
        }
      }
      // Batches holding only guards (or nothing) sit the pass out.
      batch.visible = on ? shown : tags.size > 0;
    }
  }

  /** Copies a posed kit into the batches. */
  write(kit: Kit, ids: number[]) {
    kit.group.updateMatrixWorld(true);
    kit.parts.forEach((p, i) =>
      p.batch.setMatrixAt(ids[i], p.mesh.matrixWorld),
    );
  }

  ring(style: RingStyle, x: number, y: number, z: number, radius: number) {
    this.m.makeScale(radius, 1, radius).setPosition(x, y, z);
    this.rings[style].push(this.m);
  }

  blob(x: number, y: number, z: number, size: number) {
    this.m.makeScale(size, 1, size).setPosition(x, y, z);
    this.blobs.push(this.m);
  }

  /** Call once a frame after every troop is drawn. */
  flush() {
    for (const pool of Object.values(this.rings)) pool.flush();
    this.blobs.flush();
  }

  dispose() {
    for (const batch of this.batches.values()) {
      this.world.scene.remove(batch);
      batch.dispose();
    }
    for (const pool of Object.values(this.rings)) pool.dispose();
    this.blobs.dispose();
    for (const d of this.disposables) d.dispose();
  }
}

const PART_INDEX = Object.fromEntries(PARTS.map((p, i) => [p, i])) as Record<
  PartName,
  number
>;
/** Each joint's spring against the style's snap: legs track the cycle
 *  closely, heads and tails trail the body, spinning parts are driven
 *  directly. */
const STIFF: Record<PartName, number> = {
  legL: 1.7,
  legR: 1.7,
  torso: 0.8,
  head: 0.55,
  armL: 1,
  armR: 1,
  weapon: 1.2,
  offhand: 1,
  wingL: 1.4,
  wingR: 1.4,
  tail: 0.32,
  jaw: 1.6,
  spin: 0,
  arrow: 1,
};
/** Damping below 1 lets strikes overshoot a touch before they settle. */
const DAMPING = 0.62;
const CHANNELS = 4;

export class TroopView {
  /** Where the troop stands, in world space. */
  readonly position = new THREE.Vector3();
  readonly style: Style;
  readonly flying: boolean;
  private kit: Kit;
  private ids: number[];
  /** Per part: the pose it wants, where its spring is and how fast it moves
   *  (four channels: turns about x, y, z and a lift). */
  private goal = new Float32Array(PARTS.length * CHANNELS);
  private pose = new Float32Array(PARTS.length * CHANNELS);
  private vel = new Float32Array(PARTS.length * CHANNELS);
  private fresh = true;
  private bodyY = 0;
  private squash = 1;
  private shrink = 1;
  /** Body lean forward and roll to the side, sprung like the joints. */
  private pitch = 0;
  private roll = 0;
  private pitchV = 0;
  private rollV = 0;
  private yawKick = 0;
  /** How far the body is thrown forward into a hit (negative: recoil). */
  private lunge = 0;
  private walkMix = 0;
  private aimMix = 0;
  private phase = Math.random() * Math.PI * 2;
  private facing: number | null = null;
  private turnRate = 0;
  private last: THREE.Vector3 | null = null;
  private flinch = 0;
  private spinAngle = Math.random() * 6;
  /** A little variety so a crowd never moves in lockstep. */
  private tempo = 0.92 + Math.random() * 0.16;
  private seed = Math.random() * 100;
  private hits = 0;
  private lastSince = 99;
  private fallDir = Math.random() < 0.5 ? -1 : 1;
  private fallFrom = 0;
  /** Seconds since death, or -1 while alive. */
  dying = -1;
  landed = false;

  constructor(
    private troops: TroopRenderer,
    readonly id: number,
    readonly card: TroopId,
    readonly team: Team,
    readonly ringStyle: RingStyle,
  ) {
    const model = troops.modelOf(card);
    this.kit = troops.kit(model, team);
    this.ids = troops.add(this.kit);
    this.style = styles[card];
    this.flying = troopCards[card].unit.flying;
  }

  /** Where projectiles leave and land: chest height in world space. */
  chest(target = new THREE.Vector3()) {
    const h =
      (this.flying ? FLY_HEIGHT : troopCards[this.card].unit.radius * 1.4) *
      (this.troops.scale / 1.3);
    return target.set(
      this.position.x,
      this.position.y + this.bodyY + h * 0.6,
      this.position.z,
    );
  }

  /** It was hit: flinch. */
  hit() {
    this.flinch = 1;
  }

  update(u: Unit, alpha: number, dt: number, time: number) {
    const x = u.px + (u.x - u.px) * alpha;
    const y = u.py + (u.y - u.py) * alpha;
    const [wx, , wz] = toWorld(x, y);
    const ground = this.flying ? 0 : standHeight(wx, wz);
    this.position.set(wx, ground, wz);
    // Walk cycle from distance travelled, so feet do not slide.
    const here = this.position;
    const moved = this.last
      ? Math.hypot(here.x - this.last.x, here.z - this.last.z)
      : 0;
    if (this.last) this.last.copy(here);
    else this.last = here.clone();
    // A figure drawn larger takes longer strides.
    const size = this.troops.scale / TROOP_SCALE;
    // A stride is one foot's time on the ground (`stride` below).
    if (u.state === 'walking')
      this.phase +=
        (moved / (this.style.stride * size * this.tempo)) *
        Math.PI *
        2 *
        STANCE;
    // Turn smoothly towards the engine's facing, and remember how fast, so
    // the body can lean into the turn.
    const want = -u.facing;
    if (this.facing === null) this.facing = want;
    let turn = want - this.facing;
    while (turn > Math.PI) turn -= Math.PI * 2;
    while (turn < -Math.PI) turn += Math.PI * 2;
    const step = turn * Math.min(1, dt * 12);
    this.facing += step;
    this.turnRate +=
      (step / Math.max(dt, 1e-3) - this.turnRate) * Math.min(1, dt * 8);
    this.flinch = Math.max(0, this.flinch - dt * 4.5);
    this.animate(u, alpha, dt, time, moved > 0.0005);
    this.settle(dt);
    this.begin();
    this.apply();
    this.draw();
    const radius =
      troopCards[this.card].unit.radius * 1.05 * (this.troops.scale / 1.3);
    this.troops.ring(this.ringStyle, wx, ground + 0.04, wz, radius);
    if (this.flying) {
      const k = 1 - Math.min(1, this.bodyY / 7);
      this.troops.blob(wx, 0.05, wz, radius * 2.5 * (0.7 + k * 0.4));
    }
  }

  /** Reset the shared kit's joints before this troop poses it. */
  private begin() {
    for (const p of PARTS) {
      const r = this.kit.rig[p];
      if (!r) continue;
      r.node.rotation.copy(r.rest);
      r.node.position.y = r.y;
    }
  }

  /** Put this troop's sprung pose on the shared kit. */
  private apply() {
    const p = this.pose;
    PARTS.forEach((part, i) => {
      const r = this.kit.rig[part];
      if (!r) return;
      const at = i * CHANNELS;
      r.node.rotation.set(
        r.rest.x + p[at],
        r.rest.y + p[at + 1],
        r.rest.z + p[at + 2],
      );
      r.node.position.y = r.y + p[at + 3];
    });
  }

  private draw() {
    const { group, body } = this.kit;
    const facing = this.facing ?? 0;
    // Forward is the model's -z; a lunge throws the whole toy that way.
    group.position.set(
      this.position.x - Math.sin(facing) * this.lunge,
      this.position.y,
      this.position.z - Math.cos(facing) * this.lunge,
    );
    body.position.y = this.bodyY;
    body.rotation.order = 'YXZ';
    body.rotation.set(-this.pitch, facing + this.yawKick, this.roll);
    const s = this.shrink;
    const wide = 1 + (1 - this.squash) * 0.6;
    body.scale.set(wide * s, this.squash * s, wide * s);
    this.troops.write(this.kit, this.ids);
  }

  /** Ask a joint for a pose this frame. */
  private want(part: PartName, rx = 0, ry = 0, rz = 0, dy = 0) {
    const at = PART_INDEX[part] * CHANNELS;
    this.goal[at] = rx;
    this.goal[at + 1] = ry;
    this.goal[at + 2] = rz;
    this.goal[at + 3] = dy;
  }

  /** Move every joint's spring towards its goal. */
  private settle(dt: number) {
    const { goal, pose, vel } = this;
    if (this.fresh) {
      pose.set(goal);
      vel.fill(0);
      this.fresh = false;
      return;
    }
    const snap = this.style.snap;
    PARTS.forEach((part, i) => {
      const k = snap * STIFF[part];
      const at = i * CHANNELS;
      if (k === 0) {
        for (let c = 0; c < CHANNELS; c++) pose[at + c] = goal[at + c];
        return;
      }
      const steps = Math.max(1, Math.ceil((dt * k) / 0.35));
      const h = dt / steps;
      for (let c = 0; c < CHANNELS; c++) {
        let x = pose[at + c];
        let v = vel[at + c];
        const g = goal[at + c];
        for (let n = 0; n < steps; n++) {
          v += (k * k * (g - x) - 2 * DAMPING * k * v) * h;
          x += v * h;
        }
        pose[at + c] = x;
        vel[at + c] = v;
      }
    });
  }

  /** A sprung body angle. */
  private spring(
    value: number,
    velocity: number,
    goal: number,
    k: number,
    dt: number,
  ): [number, number] {
    const steps = Math.max(1, Math.ceil((dt * k) / 0.35));
    const h = dt / steps;
    let x = value;
    let v = velocity;
    for (let n = 0; n < steps; n++) {
      v += (k * k * (goal - x) - 2 * 0.8 * k * v) * h;
      x += v * h;
    }
    return [x, v];
  }

  private animate(
    u: Unit,
    alpha: number,
    dt: number,
    time: number,
    moving: boolean,
  ) {
    const s = this.style;
    const stats = troopCards[this.card].unit;
    this.goal.fill(0);
    const walking = u.state === 'walking' && moving ? 1 : 0;
    this.walkMix += (walking - this.walkMix) * Math.min(1, dt * 10);
    const attacking = u.state === 'attacking';
    this.aimMix += ((attacking ? 1 : 0) - this.aimMix) * Math.min(1, dt * 9);
    const walk = this.walkMix;
    const aim = this.aimMix;
    const idle = (1 - walk) * (1 - aim);
    const t = time * this.tempo + this.seed;

    // Timing of the attack: a wind-up before the hit, a fast strike on it
    // (with the engine's hit timer, so blows land on the hit), a recovery.
    const toHit = Math.max(0, u.attackTimer - alpha * TICK);
    const since = u.sinceHit + alpha * TICK;
    if (since < this.lastSince && attacking) this.hits++;
    this.lastSince = since;
    const W = Math.min(s.windup, stats.hitSpeed * 0.6);
    let strike = 0;
    let wind = 0;
    if (attacking) {
      if (since < 0.08) strike = out3(since / 0.08);
      else if (since < 0.42) strike = 1 - ease((since - 0.08) / 0.34);
      else if (toHit < W) wind = ease(1 - toHit / W);
    }

    // Deploying: the toy drops onto the mat with a twirl, squashes, bounces
    // twice and stands ready.
    let drop = 0;
    let squash = 1;
    let twirl = 0;
    if (u.state === 'deploying') {
      const d = clamp01(1 - u.deployLeft / DEPLOY_TIME);
      const fall = clamp01(d / 0.26);
      drop = (1 - fall * fall) * 3.4;
      twirl = (1 - fall) * (1 - fall) * 2.4 * this.fallDir;
      if (d >= 0.26) {
        const b1 = clamp01((d - 0.26) / 0.2);
        const b2 = clamp01((d - 0.46) / 0.12);
        drop += Math.sin(b1 * Math.PI) * 0.45 + Math.sin(b2 * Math.PI) * 0.1;
        const land = clamp01((d - 0.26) / 0.1);
        squash = 1 - Math.sin(land * Math.PI) * 0.26;
        const land2 = clamp01((d - 0.46) / 0.08);
        squash -= Math.sin(land2 * Math.PI) * 0.08;
      } else squash = 1.06;
      this.landed = d >= 0.26;
    } else this.landed = true;

    // The walk: each foot is planted and sweeps back at the ground's speed
    // (so it never slides), then lifts and swings through quickly. The body
    // dips as a foot strikes and rises as the legs pass, rolls onto the
    // planted foot, the chest turns against the hips and each arm swings
    // with the opposite leg.
    const size = this.troops.scale / TROOP_SCALE;
    const cycle = (this.phase / (Math.PI * 2)) % 1;
    const [fwdL, liftL] = stride(cycle);
    const [fwdR, liftR] = stride((cycle + 0.5) % 1);
    const pass = 0.5 - 0.5 * Math.cos(cycle * Math.PI * 4);
    const hop = pass * s.bob * size * walk;
    const lift = s.legSwing * 0.09 * walk;
    // A lifted leg also tucks forward a little, as a knee would.
    this.want('legL', (fwdL * s.legSwing + liftL * 0.25) * walk, 0, 0, liftL * lift);
    this.want('legR', (fwdR * s.legSwing + liftR * 0.25) * walk, 0, 0, liftR * lift);
    const armWalk = s.armSwing * walk * (1 - aim * 0.8);
    const breathe = Math.sin(t * 2.3) * 0.012;
    let torsoX = breathe * 0.4 + s.lean * walk * 0.5 + (1 - pass) * 0.03 * walk;
    let torsoY = (fwdR - fwdL) * 0.5 * 0.13 * walk;
    const torsoZ = (fwdL - fwdR) * 0.5 * 0.03 * walk;
    // The head stays steady against the bob.
    let headX =
      Math.sin(t * 1.3) * 0.04 * idle -
      s.lean * walk * 0.4 -
      (1 - pass) * 0.04 * walk;
    // Standing about, a toy looks around now and then.
    let headY = (Math.sin(t * 0.61) * 0.3 + Math.sin(t * 1.7) * 0.08) * idle;
    let armL = s.twoHanded ? fwdL * armWalk : fwdR * armWalk;
    let armR = fwdL * armWalk;
    const armLz = 0;
    const armRz = 0;
    let weapon = 0;
    let offhand = 0;
    let jaw = 0;
    let tailY = 0;
    let lean = s.lean * walk;
    // Onto the planted foot: left while the left leg is down.
    let roll =
      (fwdL - fwdR) * 0.5 * s.sway * walk + Math.sin(t * 0.9) * 0.02 * idle;
    let lunge = 0;
    let yawKick = 0;
    const jabRight = this.hits % 2 === 0;

    switch (s.attack) {
      case 'blaster': {
        // Ray gun up and steady; each shot kicks the arm and the shoulders.
        armR += aim * (1.45 + wind * 0.05 + strike * 0.35);
        armL += aim * (0.45 - strike * 0.1);
        torsoY += aim * 0.18;
        headX += aim * 0.06;
        lean -= strike * 0.1;
        lunge -= strike * 0.06;
        break;
      }
      case 'rifle': {
        // Rifle to the shoulder, the left shoulder leading and the eye along
        // the barrel; both arms rise together so both fists stay on it. A
        // hard kick per shot tosses the head back, and the lever is worked
        // between shots.
        armR += aim * (1.3 + strike * 0.2);
        armL += aim * (1.3 + strike * 0.2);
        torsoY += aim * -0.55;
        headX -= strike * 0.1;
        headY += aim * 0.45;
        weapon += strike * -0.25 + (since > 0.25 && since < 0.5 ? 0.15 : 0);
        lean -= strike * 0.14;
        lunge -= strike * 0.09;
        break;
      }
      case 'chomp': {
        // Head down and snarling; rear up with the jaw wide, then slam down
        // and snap it shut, tail whipping round.
        // The head pivots at the neck's root: small turns swing a lot.
        headX += aim * 0.12 - wind * 0.4 + strike * 0.42;
        jaw += aim * 0.12 + wind * 0.75 - strike * 0.12;
        torsoX += -wind * 0.18 + strike * 0.22;
        tailY += strike * 0.45 * this.fallDir;
        armL += aim * 0.4 + wind * 0.3;
        armR += aim * 0.4 + wind * 0.3;
        lean += -wind * 0.08 + strike * 0.12;
        lunge += strike * s.lunge;
        break;
      }
      case 'jab': {
        // Claws up; alternate jabs, the body twisting behind each.
        const pull = wind * 0.35;
        const thrust = strike * 1.3;
        armL += aim * 0.7 + (jabRight ? 0 : thrust - pull);
        armR += aim * 0.7 + (jabRight ? thrust - pull : 0);
        torsoY += (jabRight ? -1 : 1) * strike * 0.35;
        lunge += strike * s.lunge;
        roll += (jabRight ? 1 : -1) * strike * 0.08;
        break;
      }
      case 'cleave': {
        // Guard in the middle; lift the blade high over the head, then one
        // fast cut down and through, stepping into it.
        const lift = aim * 0.85 + wind * 1.9 - strike * 0.75;
        armR += lift;
        armL += lift;
        // The blade rocks back over the shoulders, then follows the cut
        // through, forward and down.
        weapon += -wind * 0.35 - strike * 0.3;
        torsoX += -wind * 0.16 + strike * 0.34;
        torsoY += -wind * 0.3 + strike * 0.28;
        lean += -wind * 0.06 + strike * 0.16;
        lunge += strike * s.lunge;
        yawKick += strike * 0.12;
        break;
      }
      case 'cast': {
        // Staff up with the orb blazing, then thrust it forward.
        armR += aim * 0.45 + wind * 1.9 - strike * 0.5;
        armL += aim * 0.75 + wind * 0.45 + strike * 0.6;
        // The staff stays upright as the arm lifts it, crystal to the sky.
        weapon -= (wind * 1.9 - strike * 0.5) * 0.9;
        offhand += wind * 0.3;
        torsoX += -wind * 0.12 + strike * 0.16;
        lean += strike * 0.08;
        lunge += strike * s.lunge;
        break;
      }
      case 'bomb':
        break;
    }

    // Hit: a jolt back and a squeeze, the head thrown back.
    const f = this.flinch * this.flinch;
    lean -= f * 0.22;
    headX -= f * 0.3;
    squash *= 1 - f * 0.08;

    // Joints turn about x with the model facing +y (Blender): positive tips
    // a torso or head back and raises an arm or leg forward; here torsoX
    // and headX count forward bends and nods, hence the minus.
    this.want('torso', -torsoX, torsoY, torsoZ, breathe * 0.4);
    this.want('head', -headX, headY, 0);
    this.want('armL', armL, 0, armLz);
    this.want('armR', armR, 0, armRz);
    this.want('weapon', weapon);
    this.want('offhand', offhand);

    let flyY = 0;
    if (this.card === 'ogre') {
      // The tail swings against the hips and sways at rest; the jaw
      // breathes.
      tailY +=
        (fwdR - fwdL) * 0.5 * 0.3 * walk +
        Math.sin(t * 1.1) * 0.12 * (1 - walk);
      jaw += (Math.sin(t * 1.9) * 0.5 + 0.5) * 0.08 * idle;
      this.want('tail', Math.sin(t * 0.8) * 0.04, tailY, 0);
      // A jaw opens with a negative turn.
      this.want('jaw', -jaw);
    }
    if (this.card === 'imps') {
      // The wind-up key turns, faster on the move.
      this.spinAngle += dt * (2.2 + walk * 7 + aim * 3);
      this.want('spin', 0, 0, -this.spinAngle);
    }
    if (this.flying) {
      // The biplane: propeller flat out, bobbing on the air, banking into
      // turns, nosing down to drop its bombs and pulling up after.
      this.spinAngle += dt * 38;
      this.want('spin', 0, 0, -this.spinAngle);
      flyY = FLY_HEIGHT + Math.sin(t * 2.2) * 0.16 + Math.sin(t * 0.7) * 0.08;
      roll =
        Math.max(-0.6, Math.min(0.6, -this.turnRate * 0.5)) +
        Math.sin(t * 1.3) * 0.06;
      lean = Math.sin(t * 1.7) * 0.04 + wind * 0.2 - strike * 0.25;
      this.want('head', 0, Math.sin(t * 0.8) * 0.5 * (1 - aim), 0);
    }

    this.bodyY = drop + flyY + hop;
    // A little squash as each foot strikes, more for heavy troops.
    this.squash =
      squash * (1 - Math.pow(1 - pass, 4) * (s.heavy ? 0.07 : 0.035) * walk);
    const kBody = this.flying ? 6 : this.style.snap * 0.6;
    [this.pitch, this.pitchV] = this.spring(
      this.pitch,
      this.pitchV,
      lean,
      kBody,
      dt,
    );
    const bank = this.flying
      ? 0
      : Math.max(-0.12, Math.min(0.12, this.turnRate * -0.05));
    [this.roll, this.rollV] = this.spring(
      this.roll,
      this.rollV,
      roll + bank,
      kBody,
      dt,
    );
    this.lunge += (lunge * size - this.lunge) * Math.min(1, dt * 30);
    this.yawKick = yawKick + twirl;
  }

  /** Topple over like a knocked toy, bounce once, then vanish in a puff. */
  fade(dt: number) {
    if (this.dying === 0) this.fallFrom = this.bodyY;
    this.dying += dt;
    const t = this.dying;
    if (this.flying) {
      // The plane noses over and spirals down.
      const k = clamp01(t / 0.6);
      this.bodyY = this.fallFrom * (1 - k * k);
      this.pitch = k * 0.9;
      this.roll += dt * 9 * this.fallDir;
    } else {
      const k = clamp01(t / 0.28);
      const bounce =
        t > 0.28 ? Math.sin(clamp01((t - 0.28) / 0.16) * Math.PI) * 0.14 : 0;
      this.roll = this.fallDir * (1.45 * k * k - bounce);
      this.bodyY = Math.max(0, this.fallFrom * (1 - k)) + bounce * 0.25;
    }
    this.squash = 1;
    this.lunge = 0;
    const gone = clamp01((t - (this.flying ? 0.55 : 0.5)) / 0.22);
    this.shrink = Math.max(0.001, 1 - ease(gone));
    this.begin();
    this.apply();
    this.draw();
    return gone >= 1;
  }

  dispose() {
    this.troops.remove(this.kit, this.ids);
  }
}

/** The Cadet on top of a small tower and the king's toy cannon. */
export class TowerCrew {
  private guard?: { kit: Kit; ids: number[]; spot: THREE.Object3D };
  private aim = 0;
  private raise = 0;
  private recoil = 0;
  private m = new THREE.Matrix4();
  private turn = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private xAxis = new THREE.Vector3(1, 0, 0);
  private yAxis = new THREE.Vector3(0, 1, 0);

  constructor(
    private world: ArenaWorld,
    private troops: TroopRenderer,
    tower: Tower,
    team: Team,
  ) {
    const view = world.towers.get(tower.id);
    if (view?.guardSpot) {
      // The longbow archer figure, or a Cadet before it is built.
      const kit = troops.kit(troops.built('guard') ? 'guard' : 'archers', team);
      this.guard = { kit, ids: troops.add(kit, false), spot: view.guardSpot };
    }
  }

  shot() {
    this.recoil = 1;
  }

  update(t: Tower, target: THREE.Vector3 | null, dt: number, time: number) {
    const view = this.world.towers.get(t.id);
    if (!view) return;
    this.recoil = Math.max(0, this.recoil - dt * 5);
    const [wx, , wz] = toWorld(t.x, t.y);
    // Rotations are local to the tower, which side 1 turns round. With
    // nothing in range the crew looks calmly out over the field.
    const local = target
      ? Math.atan2(-(target.x - wx), -(target.z - wz)) -
        (t.side === 1 ? Math.PI : 0)
      : Math.sin(time * 0.35 + t.id * 1.7) * 0.4;
    let turn = local - this.aim;
    while (turn > Math.PI) turn -= Math.PI * 2;
    while (turn < -Math.PI) turn += Math.PI * 2;
    this.aim += turn * Math.min(1, dt * (target ? 10 : 2.5));
    if (this.aim > Math.PI) this.aim -= Math.PI * 2;
    if (this.aim < -Math.PI) this.aim += Math.PI * 2;
    this.raise += ((target ? 1 : 0) - this.raise) * Math.min(1, dt * 9);
    if (this.guard) {
      const { kit, ids, spot } = this.guard;
      for (const p of PARTS) {
        const r = kit.rig[p];
        if (!r) continue;
        r.node.rotation.copy(r.rest);
        r.node.position.y = r.y;
      }
      const g = kit.rig;
      const kick = this.recoil * this.recoil;
      const { draw, loose } = kit.poses;
      if (draw) {
        // The archer turns side-on and draws with a target in range; each
        // release flicks the string hand back past the ear (loose) and it
        // comes forward to draw again.
        for (const p of PARTS) {
          const r = g[p];
          if (!r) continue;
          const q = this.q.identity();
          if (draw[p]) q.slerp(draw[p], this.raise);
          if (loose?.[p]) q.slerp(loose[p], kick * this.raise);
          r.node.quaternion.setFromEuler(r.rest).multiply(q);
        }
        // The loosed arrow is gone until the hand comes back to the string.
        if (g.arrow) g.arrow.node.scale.setScalar(kick > 0.25 ? 0 : 1);
        if (g.head)
          g.head.node.quaternion.multiply(
            this.q.setFromAxisAngle(
              this.yAxis,
              (1 - this.raise) * Math.sin(time * 0.5 + t.id) * 0.35,
            ),
          );
        if (g.torso)
          g.torso.node.quaternion.multiply(
            this.q.setFromAxisAngle(
              this.xAxis,
              Math.sin(time * 1.6 + t.id) * 0.015,
            ),
          );
      } else {
        // A Cadet: ray gun up and a kick on each shot.
        if (g.armR)
          g.armR.node.rotation.x =
            g.armR.rest.x + this.raise * (1.45 + kick * 0.35);
        if (g.armL) g.armL.node.rotation.x = g.armL.rest.x + this.raise * 0.45;
        if (g.torso)
          g.torso.node.rotation.set(
            g.torso.rest.x + Math.sin(time * 2 + t.id) * 0.012 + kick * 0.08,
            g.torso.rest.y + this.raise * 0.18,
            g.torso.rest.z,
          );
        if (g.head)
          g.head.node.rotation.y =
            g.head.rest.y +
            (1 - this.raise) * Math.sin(time * 0.5 + t.id) * 0.3;
      }
      // The kit is scaled for troops on the field; guards stand a little
      // smaller on their platform, and grow less than troops on phones.
      const s = this.troops.scale;
      const guard = (1.35 * (1 + (s / TROOP_SCALE - 1) * 0.6)) / s;
      spot.updateWorldMatrix(true, false);
      this.m
        .copy(spot.matrixWorld)
        .multiply(this.turn.makeRotationY(this.aim))
        .multiply(this.turn.makeScale(guard, guard, guard));
      kit.group.position.set(0, 0, 0);
      kit.body.position.set(0, 0, 0);
      kit.body.rotation.set(0, 0, 0);
      kit.body.scale.set(1, 1, 1);
      kit.group.matrixAutoUpdate = false;
      kit.group.matrix.copy(this.m);
      this.troops.write(kit, ids);
      kit.group.matrixAutoUpdate = true;
    }
    if (view.cannon) {
      view.cannon.rotation.y = this.aim;
      if (view.barrel) {
        // Asleep, the barrel rests nose down.
        const sleep = t.active ? 0 : 0.35;
        view.barrel.rotation.x = -sleep + this.recoil * 0.15;
        view.barrel.position.z = this.recoil * 0.12;
      }
      view.cannon.updateMatrixWorld(true);
    }
  }

  dispose() {
    if (this.guard) this.troops.remove(this.guard.kit, this.guard.ids);
    this.guard = undefined;
  }
}
