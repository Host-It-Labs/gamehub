import * as THREE from 'three';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import {
  dutyFactor,
  footPitch,
  gaitOf,
  legLowering,
  pelvis,
  smin,
  solveLeg,
  stepLength,
  swing as swingCurve,
  walkingLeg,
  weightSide,
  type GaitProfile,
  type LegShape,
} from '@/lib/games/arena/gait';
import { troopCards, troopDeck, type TroopId } from '@/lib/games/arena/cards';
import {
  DEPLOY_TIME,
  TICK,
  towerGap,
  towerNormal,
  towerFootprint,
  troopBuildingRadius,
  type Tower,
  type Unit,
} from '@/lib/games/arena/engine';
import { figureDimensions, toWorld } from '@/lib/games/arena/layout';
import { teamColours, type Team } from './materials';
import { find, KING_CANNON, standHeight, type ArenaWorld } from './world';
import { addDrape } from './wind';
import { applyFace, facePose, faceRig, type FaceRig } from './faces';
import { createSurfacePointReader } from './surface-contact';
export { createSurfacePointReader } from './surface-contact';
import { moves } from './moves';
import { plantMageStaff } from './moves/mage';
import { medicStoneGuard } from './moves/medic';
import { vikingSolePenetration, vikingStoneGuard } from './moves/viking';
import {
  gladiatorSolePenetration,
  gladiatorStoneGuard,
} from './moves/gladiator';
import type {
  Carriage,
  MoveContext,
  PartName,
  Pose,
  Style,
} from './moves/types';

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
 * Rigid troop parts share one BatchedMesh per material/layout. Connected
 * skins retain a posed copy per unit; their rigid attachments still use the
 * same batches, with matrices copied from that unit's own joints.
 */
const PARTS: PartName[] = [
  'legL',
  'legR',
  'kneeL',
  'kneeR',
  'footL',
  'footR',
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
  'foreL',
  'foreR',
  'skirtL',
  'skirtR',
  'cape',
  'shield',
  'wheels',
  'basket',
  'extra',
  'hat',
  'beard',
  'hair',
  'neck',
  'tail2',
  'tail3',
  'cape2',
  'antenna',
  'sleeveL',
  'sleeveR',
  'handL',
  'handR',
  'extra2',
  'chest',
  'clavL',
  'clavR',
];
type Rig = Partial<
  Record<PartName, { node: THREE.Object3D; rest: THREE.Euler; y: number }>
>;

/** How a troop without its own `carriage` carries itself. */
const CARRIAGE: Carriage = {
  twist: 0.13,
  hips: 0.06,
  chestRoll: 0.15,
  nod: 0.035,
  armOut: 0.08,
  bounce: 0.05,
  weaponArm: 0.75,
};

const STILL: Carriage = {
  twist: 0,
  hips: 0,
  chestRoll: 0,
  nod: 0,
  armOut: 0,
  bounce: 0,
  weaponArm: 1,
};

/** Every troop's style (moves/). A troop without moves yet (a new figure
 *  on its way) walks like the Cadets. */
const styles = Object.fromEntries(
  troopDeck.map((id) => [id, moves[id]?.style ?? moves.archers!.style]),
) as Record<TroopId, Style>;

export const FLY_HEIGHT = 2.1;
/** Troops are drawn larger than their footprint so they read on screen; the
 *  view raises this on portrait phones (`troopScale` in layout.ts). */
export const TROOP_SCALE = 1.75;
/** Figures drawn a little larger than the rest (9 October 2026: the Dino
 *  read too small beside the people). Multiplies the troops' scale. */
const FIGURE_SIZE: Partial<Record<string, number>> = { ogre: 1.12 };
/** How much larger than the troops' scale a figure is drawn. */
export const figureSize = (id: string) => FIGURE_SIZE[id] ?? 1;
const ease = (t: number) => t * t * (3 - 2 * t);
const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t);
/** An attack's strike out (seconds), its recovery, and the share of each
 *  style's wind-up it takes. */
const STRIKE_TIME = 0.06;
const RECOVER_TIME = 0.26;
const WINDUP_PACE = 0.75;
/** Out fast, settle slow: for strikes. */
const out3 = (t: number) => 1 - (1 - t) * (1 - t) * (1 - t);

/** One leg's place in its stride, `u` running 0 to 1: planted and sweeping
 *  back at an even speed for the first 60% (so the foot keeps pace with the
 *  ground), then lifted and swung forward. Returns how far forward the leg
 *  is (1 to -1) and how high the foot is lifted (0 to 1). */
const STANCE = 0.6;

/** How much of the profile's full stride a troop's step at its own speed
 *  is (1, or less where the cadence shortens it; see stepLength). */
function strideShare(g: GaitProfile, leg: number, own: number) {
  return Math.min(1, own / g.cadence / (g.stride * leg));
}
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

/** A drawn piece of a kit; `drape` for cloth that ripples (addDrape). */
type Part = {
  mesh: THREE.Mesh;
  /** Source traversal position, retained by SkeletonUtils.clone. */
  nodeIndex: number;
  batch: THREE.BatchedMesh;
  geometry: number;
  drape: boolean;
};
/** A rigid part, or only the vertices genuinely weighted to a skin joint. */
export type FigureSurface = {
  mesh: THREE.Mesh;
  indices?: number[];
};
const surfacesOf = new WeakMap<THREE.Object3D, Map<string, FigureSurface[]>>();
const readersOf = new WeakMap<
  FigureSurface,
  ReturnType<typeof createSurfacePointReader>
>();
function contactSurfaceReader(surface: FigureSurface) {
  let reader = readersOf.get(surface);
  if (!reader) {
    reader = createSurfacePointReader(surface);
    readersOf.set(surface, reader);
  }
  return reader;
}
function beneath(node: THREE.Object3D, parent: THREE.Object3D) {
  for (let at: THREE.Object3D | null = node; at; at = at.parent)
    if (at === parent) return true;
  return false;
}

/** Skin meshes are siblings of their bones, so walking a bone's children
 *  misses its actual anatomy. Keep its weighted surface, including blended
 *  seam vertices; the resulting points are evaluated in the current pose. */
export function figureSurfaces(
  model: THREE.Object3D,
  id: string,
  part: PartName,
) {
  let cached = surfacesOf.get(model);
  if (!cached) surfacesOf.set(model, (cached = new Map()));
  const key = `${id}:${part}`;
  const hit = cached.get(key);
  if (hit) return hit;
  const surfaces: FigureSurface[] = [];
  cached.set(key, surfaces);
  const joint = find(model, `${id}${part}`);
  if (!joint) return surfaces;
  // The chest and shoulder girdle are the torso's own upper half here: the
  // stone checks keep the whole trunk out of a tower.
  const trunk: PartName[] = ['torso', 'chest', 'clavL', 'clavR'];
  const others =
    part === 'torso'
      ? PARTS.filter((p) => !trunk.includes(p))
          .map((p) => find(model, `${id}${p}`))
          .filter((node): node is THREE.Object3D => !!node)
      : [];
  let skinned = false;
  model.traverse((node) => {
    if ((node as THREE.SkinnedMesh).isSkinnedMesh) skinned = true;
  });
  joint.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh || (mesh as THREE.SkinnedMesh).isSkinnedMesh) return;
    if (part === 'torso') {
      if (
        skinned
          ? others.some((other) => beneath(mesh, other))
          : mesh.name !== joint.name && !mesh.name.startsWith(`${joint.name}_`)
      )
        return;
    }
    surfaces.push({ mesh });
  });
  model.traverse((node) => {
    const mesh = node as THREE.SkinnedMesh;
    if (!mesh.isSkinnedMesh) return;
    const allowed = mesh.skeleton.bones.map(
      (bone) =>
        beneath(bone, joint) && !others.some((other) => beneath(bone, other)),
    );
    const weights = mesh.geometry.attributes.skinWeight;
    const bones = mesh.geometry.attributes.skinIndex;
    const indices: number[] = [];
    for (let i = 0; i < weights.count; i++)
      for (let component = 0; component < 4; component++)
        if (
          weights.getComponent(i, component) > 1e-6 &&
          allowed[bones.getComponent(i, component)]
        ) {
          indices.push(i);
          break;
        }
    if (indices.length) surfaces.push({ mesh, indices });
  });
  return surfaces;
}

/** A posed subset's bounds. Mesh.getVertexPosition includes bone and
 *  morph deformation; static geometry positions do not. */
export function posedSurfaceBounds(
  surface: FigureSurface,
  target: THREE.Box3,
  matrix = surface.mesh.matrixWorld,
) {
  const { mesh, indices } = surface;
  if (!indices) {
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    return target.copy(mesh.geometry.boundingBox!).applyMatrix4(matrix);
  }
  target.makeEmpty();
  for (const index of indices) {
    mesh.getVertexPosition(index, surfacePoint).applyMatrix4(matrix);
    target.expandByPoint(surfacePoint);
  }
  return target;
}

type BoneSurfaceBox = { bone: number; box: THREE.Box3 };
const influenceBounds = new WeakMap<FigureSurface, BoneSurfaceBox[] | null>();
const influencePoint = new THREE.Vector3();
const influenceMatrix = new THREE.Matrix4();
const influenceBox = new THREE.Box3();

/** A conservative bound of the posed skin subset. A blended vertex is a
 *  convex combination of its bone-transformed positions, all contained by
 *  the union of these cached influence boxes. Exact vertices are still
 *  evaluated whenever this broad bound can contact a building. */
export function surfaceBroadBounds(
  surface: FigureSurface,
  target: THREE.Box3,
  matrix = surface.mesh.matrixWorld,
) {
  const mesh = surface.mesh as THREE.SkinnedMesh;
  if (!mesh.isSkinnedMesh || !surface.indices)
    return posedSurfaceBounds(surface, target, matrix);
  if (mesh.morphTargetInfluences?.some((weight) => weight !== 0))
    return posedSurfaceBounds(surface, target, matrix);
  let boxes = influenceBounds.get(surface);
  if (boxes === undefined) {
    const geometry = mesh.geometry;
    const positions = geometry.attributes.position;
    const weights = geometry.attributes.skinWeight;
    const indices = geometry.attributes.skinIndex;
    const matrices = mesh.skeleton.boneInverses.map((inverse) =>
      inverse.clone().multiply(mesh.bindMatrix),
    );
    const made = matrices.map(() => new THREE.Box3());
    let valid = true;
    for (const index of surface.indices) {
      let sum = 0;
      surfacePoint.fromBufferAttribute(positions, index);
      for (let component = 0; component < 4; component++) {
        const weight = weights.getComponent(index, component);
        sum += weight;
        if (weight < 0) valid = false;
        if (weight <= 0) continue;
        const bone = indices.getComponent(index, component);
        influencePoint.copy(surfacePoint).applyMatrix4(matrices[bone]);
        made[bone].expandByPoint(influencePoint);
      }
      if (Math.abs(sum - 1) > 1e-6) valid = false;
    }
    boxes = valid
      ? made.flatMap((box, bone) => (box.isEmpty() ? [] : [{ bone, box }]))
      : null;
    influenceBounds.set(surface, boxes);
  }
  if (!boxes) return posedSurfaceBounds(surface, target, matrix);
  target.makeEmpty();
  for (const { bone, box } of boxes) {
    influenceMatrix
      .copy(matrix)
      .multiply(mesh.bindMatrixInverse)
      .multiply(mesh.skeleton.bones[bone].matrixWorld);
    influenceBox.copy(box).applyMatrix4(influenceMatrix);
    target.union(influenceBox);
  }
  return target.expandByScalar(1e-5);
}
const surfacePoint = new THREE.Vector3();
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
  face: FaceRig;
  parts: Part[];
  poses: Poses;
  /** Bound in the rest pose; each tower's skin copy owns its correction. */
  towerString?: TowerStringContact;
  /** Whether it has cloth that ripples (Part.drape). */
  drapes: boolean;
  /** Highest point of the rest sculpt at TROOP_SCALE, for status crowns. */
  top: number;
  /** How much larger than the troops' scale it is drawn (FIGURE_SIZE;
   *  1 when absent). */
  size?: number;
  /** Connected skins keep an independent posed copy for each field unit. */
  direct?: {
    meshes: THREE.Mesh[];
    skeletons: Set<THREE.Skeleton>;
    materials: THREE.Material[];
    colours: Map<THREE.Material, THREE.Color>;
    xray: boolean;
  };
};

/** Where a weapon's working end sits in its part's own space: the far end
 *  of its longest reach from the grip (a wand's tip, a barrel's mouth).
 *  Measured once per kit model, in the rest pose. */
/** Figures whose gun is not their `weapon` part (the Gunner's cannon). */
const TIP_PART: Partial<Record<string, PartName>> = { gunner: 'extra' };
const weaponTips = new WeakMap<THREE.Object3D, THREE.Vector3 | null>();
function weaponTip(node: THREE.Object3D) {
  if (weaponTips.has(node)) return weaponTips.get(node)!;
  node.updateWorldMatrix(true, true);
  const inverse = new THREE.Matrix4().copy(node.matrixWorld).invert();
  const bounds = new THREE.Box3();
  const part = new THREE.Box3();
  node.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh || (mesh as THREE.SkinnedMesh).isSkinnedMesh) return;
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    part
      .copy(mesh.geometry.boundingBox!)
      .applyMatrix4(tmpM.multiplyMatrices(inverse, mesh.matrixWorld));
    bounds.union(part);
  });
  let tip: THREE.Vector3 | null = null;
  if (!bounds.isEmpty()) {
    const centre = bounds.getCenter(new THREE.Vector3());
    const reach = [0, 1, 2].map((axis) =>
      Math.max(-bounds.min.getComponent(axis), bounds.max.getComponent(axis)),
    );
    const axis = reach.indexOf(Math.max(...reach));
    tip = centre.clone();
    tip.setComponent(
      axis,
      -bounds.min.getComponent(axis) > bounds.max.getComponent(axis)
        ? bounds.min.getComponent(axis)
        : bounds.max.getComponent(axis),
    );
  }
  weaponTips.set(node, tip);
  return tip;
}

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
/** Direct skins carry their team in separate x-ray layers. The ordinary
 *  batch silhouette reads an instance colour, which a skin does not have. */
export const SKIN_XRAY_LAYERS = [3, 4] as const;
const WHITE = new THREE.Color(1, 1, 1);
/** A slowed troop's icy tint (TroopView.frost). */
const FROST = new THREE.Color(0.68, 0.88, 1.18);
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
  private directKits = new Set<Kit>();
  private directIds = new Map<Kit, number[]>();
  private batches = new Map<string, THREE.BatchedMesh>();
  private live = new Map<THREE.BatchedMesh, number>();
  private rings: Record<RingStyle, Pool>;
  private blobs: Pool;
  private disposables: { dispose(): void }[] = [];
  private disposed = false;
  private m = new THREE.Matrix4();
  private rgba = new THREE.Vector4();
  /** Per batch, each instance's team for the x-ray pass, or -1 (the tower
   *  guards, which never show through). */
  private tags = new Map<THREE.BatchedMesh, Map<number, Team | -1>>();
  /** Normal colours survive the temporary team silhouette pass. */
  private batchColours = new Map<THREE.BatchedMesh, Map<number, THREE.Color>>();
  /** How much larger than its footprint a figure is drawn. */
  scale = TROOP_SCALE;
  private motion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
  get reducedMotion() {
    return this.motion?.matches ?? false;
  }

  constructor(private world: ArenaWorld) {
    const models = [...new Set(troopDeck.map((id) => this.modelOf(id)))];
    if (this.built('guard')) models.push('guard');
    const sources: {
      key: string;
      model: THREE.Object3D;
      id: string;
      direct: boolean;
    }[] = [];
    for (const id of models)
      for (const team of [0, 1] as Team[]) {
        const model = world.instance(this.sourceOf(id), id, team);
        let direct = false;
        model.traverse((node) => {
          if ((node as THREE.SkinnedMesh).isSkinnedMesh) direct = true;
        });
        sources.push({
          key: `${id}:${team}`,
          id,
          model,
          direct,
        });
      }
    // Size each batch for the unique geometries that will live in it.
    const sizes = new Map<
      string,
      { material: THREE.Material; geometries: Set<THREE.BufferGeometry> }
    >();
    const keyOf = (mesh: THREE.Mesh) =>
      `${(mesh.material as THREE.Material).uuid}|${layout(mesh.geometry)}`;
    for (const { model } of sources) {
      model.traverse((node) => {
        const mesh = node as THREE.Mesh;
        if (!mesh.isMesh || (mesh as THREE.SkinnedMesh).isSkinnedMesh) return;
        const key = keyOf(mesh);
        const entry = sizes.get(key) ?? {
          material: mesh.material as THREE.Material,
          geometries: new Set(),
        };
        entry.geometries.add(mesh.geometry);
        sizes.set(key, entry);
      });
    }
    const geometryIds = new Map<string, Map<THREE.BufferGeometry, number>>();
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
      // Glass (the Jetpack's and Cadets' bubbles) casts no solid shadow.
      batch.castShadow = !material.transparent;
      batch.receiveShadow = true;
      batch.layers.enable(XRAY_LAYER);
      batch.visible = false;
      // Cloth casts the shadow of where it has rippled to.
      if (material.name.startsWith('drape')) {
        batch.customDepthMaterial = addDrape(
          new THREE.MeshDepthMaterial(),
          world.wind,
        );
        this.disposables.push(batch.customDepthMaterial);
      }
      this.tags.set(batch, new Map());
      this.batchColours.set(batch, new Map());
      const ids = new Map<THREE.BufferGeometry, number>();
      for (const g of geometries) ids.set(g, batch.addGeometry(g));
      geometryIds.set(key, ids);
      this.batches.set(key, batch);
      this.live.set(batch, 0);
      world.scene.add(batch);
    }
    for (const { key, model, id, direct } of sources) {
      const group = new THREE.Group();
      const body = new THREE.Group();
      const size = figureSize(id);
      model.scale.set(...figureDimensions(TROOP_SCALE * size));
      body.add(model);
      group.add(body);
      group.updateMatrixWorld(true);
      const parts: Part[] = [];
      const meshes: THREE.Mesh[] = [];
      const skeletons = new Set<THREE.Skeleton>();
      let nodeIndex = 0;
      model.traverse((node) => {
        const index = nodeIndex++;
        const mesh = node as THREE.Mesh;
        if (!mesh.isMesh) return;
        if ((mesh as THREE.SkinnedMesh).isSkinnedMesh) {
          meshes.push(mesh);
          skeletons.add((mesh as THREE.SkinnedMesh).skeleton);
          return;
        }
        const key = keyOf(mesh);
        parts.push({
          mesh,
          nodeIndex: index,
          batch: this.batches.get(key)!,
          geometry: geometryIds.get(key)!.get(mesh.geometry)!,
          drape: (mesh.material as THREE.Material).name.startsWith('drape'),
        });
      });
      this.kits.set(key, {
        team: key.endsWith(':1') ? 1 : 0,
        drapes:
          parts.some((p) => p.drape) ||
          meshes.some((mesh) =>
            (mesh.material as THREE.Material).name.startsWith('drape'),
          ),
        group,
        body,
        model,
        rig: rig(model, id),
        face: faceRig(model, id),
        parts,
        poses: posesOf(model),
        towerString: id === 'guard' ? TowerStringContact.bind(model) : undefined,
        top: new THREE.Box3().setFromObject(model).max.y,
        size,
        direct: direct
          ? {
              meshes,
              skeletons,
              materials: [],
              colours: new Map(),
              xray: false,
            }
          : undefined,
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
    const source = this.kits.get(`${model}:${team}`)!;
    if (!source.direct) return source;
    const copy = cloneSkeleton(source.model);
    const group = new THREE.Group();
    const body = new THREE.Group();
    copy.scale.set(...figureDimensions(this.scale * (source.size ?? 1)));
    body.add(copy);
    group.add(body);
    const meshes: THREE.Mesh[] = [];
    const parts: Part[] = [];
    const sourceParts = new Map(source.parts.map((p) => [p.nodeIndex, p]));
    let nodeIndex = 0;
    const skeletons = new Set<THREE.Skeleton>();
    const materials = new Map<THREE.Material, THREE.Material>();
    const depthMaterials: THREE.Material[] = [];
    const colours = new Map<THREE.Material, THREE.Color>();
    const own = (material: THREE.Material) => {
      const hit = materials.get(material);
      if (hit) return hit;
      const made = material.clone();
      // Material.clone does not carry the library's surface/wind hooks.
      made.onBeforeCompile = material.onBeforeCompile.bind(material);
      made.customProgramCacheKey =
        material.customProgramCacheKey.bind(material);
      materials.set(material, made);
      const colour = (made as THREE.MeshStandardMaterial).color;
      if (colour) colours.set(made, colour.clone());
      return made;
    };
    copy.traverse((node) => {
      const index = nodeIndex++;
      const mesh = node as THREE.Mesh;
      if (!mesh.isMesh) return;
      if (!(mesh as THREE.SkinnedMesh).isSkinnedMesh) {
        parts.push({ ...sourceParts.get(index)!, mesh });
        // A rigid mesh can carry child joints or skins. Keep traversing its
        // subtree while excluding only this geometry from every render pass.
        mesh.layers.disableAll();
        mesh.castShadow = mesh.receiveShadow = false;
        return;
      }
      mesh.material = Array.isArray(mesh.material)
        ? mesh.material.map(own)
        : own(mesh.material);
      if (
        !Array.isArray(mesh.material) &&
        mesh.material.name.startsWith('drape')
      ) {
        mesh.customDepthMaterial = addDrape(
          new THREE.MeshDepthMaterial(),
          this.world.wind,
        );
        depthMaterials.push(mesh.customDepthMaterial);
      }
      mesh.frustumCulled = false;
      meshes.push(mesh);
      if ((mesh as THREE.SkinnedMesh).isSkinnedMesh)
        skeletons.add((mesh as THREE.SkinnedMesh).skeleton);
    });
    return {
      team,
      group,
      body,
      model: copy,
      rig: rig(copy, model),
      face: faceRig(copy, model),
      parts,
      poses: source.poses,
      towerString: model === 'guard' ? TowerStringContact.bind(copy) : undefined,
      drapes: source.drapes,
      top: source.top,
      size: source.size,
      direct: {
        meshes,
        skeletons,
        materials: [...materials.values(), ...depthMaterials],
        colours,
        xray: false,
      },
    } satisfies Kit;
  }

  /** Draw every figure at a new size (portrait phones draw them larger). */
  setScale(scale: number) {
    if (scale === this.scale) return;
    this.scale = scale;
    for (const kit of this.kits.values())
      kit.model.scale.set(...figureDimensions(scale * (kit.size ?? 1)));
    for (const kit of this.directKits)
      kit.model.scale.set(...figureDimensions(scale * (kit.size ?? 1)));
  }

  /** Room in the batches for one more copy of a kit; `xray` false keeps
   *  it from showing through what hides it. */
  add(kit: Kit, xray = true) {
    if (kit.direct) {
      const existing = this.directIds.get(kit);
      if (existing) return existing;
      kit.direct.xray = xray;
      for (const mesh of kit.direct.meshes) {
        mesh.receiveShadow = true;
        mesh.castShadow = !(Array.isArray(mesh.material)
          ? mesh.material.every((m) => m.transparent)
          : mesh.material.transparent);
        mesh.layers.disable(XRAY_LAYER);
        for (const layer of SKIN_XRAY_LAYERS) mesh.layers.disable(layer);
        if (xray) mesh.layers.enable(SKIN_XRAY_LAYERS[kit.team]);
      }
      this.directKits.add(kit);
      this.world.scene.add(kit.group);
    }
    const ids = kit.parts.map((p) => {
      const live = this.live.get(p.batch)!;
      if (live >= p.batch.maxInstanceCount)
        p.batch.setInstanceCount(p.batch.maxInstanceCount * 2);
      this.live.set(p.batch, live + 1);
      const id = p.batch.addInstance(p.geometry);
      p.batch.visible = true;
      // Every instance carries a colour, white for the normal pass, so the
      // batch's shader exists from the first troop on.
      p.batch.setColorAt(id, WHITE);
      this.batchColours.get(p.batch)!.set(id, WHITE.clone());
      this.tags.get(p.batch)!.set(id, xray ? kit.team : -1);
      return id;
    });
    if (kit.direct) this.directIds.set(kit, ids);
    return ids;
  }

  remove(kit: Kit, ids: number[]) {
    if (kit.direct) {
      if (!this.directKits.delete(kit)) return;
      ids = this.directIds.get(kit)!;
      this.directIds.delete(kit);
      this.world.scene.remove(kit.group);
      for (const skeleton of kit.direct.skeletons) skeleton.dispose();
      for (const material of kit.direct.materials) material.dispose();
    }
    kit.parts.forEach((p, i) => {
      p.batch.deleteInstance(ids[i]);
      this.tags.get(p.batch)!.delete(ids[i]);
      this.batchColours.get(p.batch)!.delete(ids[i]);
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
          // (The colour only: cloth keeps its flutter in the alpha, so
          // the x-ray pass moves it as the colour pass did.)
          batch.setColorAt(
            id,
            on
              ? xrayColours[tag as Team]
              : this.batchColours.get(batch)!.get(id)!,
          );
          shown = true;
        }
      }
      // Batches holding only guards (or nothing) sit the pass out.
      batch.visible = on ? shown : tags.size > 0;
    }
  }

  /** Avoid an extra silhouette pass when no direct unit of a team is alive. */
  hasSkinTeam(team: Team) {
    for (const kit of this.directKits)
      if (kit.team === team && kit.direct!.xray && kit.group.visible)
        return true;
    return false;
  }

  /** One troop's batch colour (white, or the frost tint). */
  colour(kit: Kit, ids: number[], colour: THREE.Color) {
    if (kit.direct) {
      ids = this.directIds.get(kit) ?? ids;
      for (const [material, base] of kit.direct.colours)
        (material as THREE.MeshStandardMaterial).color
          .copy(base)
          .multiply(colour);
    }
    kit.parts.forEach((p, i) => {
      this.batchColours.get(p.batch)!.get(ids[i])!.copy(colour);
      p.batch.setColorAt(ids[i], colour);
    });
  }

  /** How much a troop's cloth ripples (0..1), sent as its batch colour's
   *  alpha above 1 (wind.ts, addDrape), with the troop's colour. */
  flutter(kit: Kit, ids: number[], amount: number, colour: THREE.Color) {
    if (kit.direct) {
      ids = this.directIds.get(kit) ?? ids;
      this.colour(kit, ids, colour);
    }
    this.rgba.set(colour.r, colour.g, colour.b, 1 + amount);
    kit.parts.forEach((p, i) => {
      if (p.drape) {
        this.batchColours.get(p.batch)!.get(ids[i])!.copy(colour);
        p.batch.setColorAt(ids[i], this.rgba);
      }
    });
  }

  /** Copies a posed kit into the batches. */
  write(kit: Kit, ids: number[]) {
    kit.group.updateMatrixWorld(true);
    if (kit.direct) {
      ids = this.directIds.get(kit) ?? ids;
      for (const skeleton of kit.direct.skeletons) skeleton.update();
    }
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
    if (this.disposed) return;
    this.disposed = true;
    for (const kit of this.directKits) this.remove(kit, []);
    for (const batch of this.batches.values()) {
      this.world.scene.remove(batch);
      batch.dispose();
    }
    this.batches.clear();
    this.tags.clear();
    this.batchColours.clear();
    this.live.clear();
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
  kneeL: 1.7,
  kneeR: 1.7,
  footL: 1.9,
  footR: 1.9,
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
  foreL: 1,
  foreR: 1,
  skirtL: 0.5,
  skirtR: 0.5,
  cape: 0.35,
  shield: 1,
  wheels: 0,
  basket: 0.45,
  extra: 1,
  // Soft parts for secondary motion: they trail the body.
  hat: 0.42,
  beard: 0.4,
  hair: 0.4,
  neck: 0.7,
  tail2: 0.28,
  tail3: 0.24,
  cape2: 0.3,
  antenna: 0.3,
  sleeveL: 0.5,
  sleeveR: 0.5,
  handL: 1.1,
  handR: 1.1,
  extra2: 1,
  // The spine's upper half follows a beat behind the lower; the shoulder
  // girdle a touch softer than the arm it carries.
  chest: 0.7,
  clavL: 0.85,
  clavR: 0.85,
};
/** Damping below 1 lets strikes overshoot a touch before they settle. */
const DAMPING = 0.62;
const CHANNELS = 4;
/** Leg parts the ground solver writes, and their side. */
const LEG_SIDE: Partial<Record<PartName, 'L' | 'R'>> = {
  legL: 'L',
  kneeL: 'L',
  footL: 'L',
  legR: 'R',
  kneeR: 'R',
  footR: 'R',
};

/** A leg as built, in the figure's own units (before it is scaled onto
 *  the field): hip and ankle pivots, the leg's shape for the solver, and
 *  the foot's ankle height, heel and toe (gait.ts). */
type LegGeometry = {
  hip: THREE.Vector3;
  ankle: THREE.Vector3;
  shape: LegShape;
  sole: number;
  heel: number;
  toe: number;
  /** Conservative foot corners, in the ankle joint's own space. */
  corners: THREE.Vector3[];
  surfaces: FigureSurface[];
};
type Legs = {
  L: LegGeometry;
  R: LegGeometry;
  /** Hip height above the soles, and half the hips' width. */
  length: number;
  width: number;
};
const legsOf = new WeakMap<object, Legs | null>();
const tmpM = new THREE.Matrix4();
const tmpInv = new THREE.Matrix4();
const tmpV = new THREE.Vector3();
const tmpQ = new THREE.Quaternion();
const tmpE = new THREE.Euler(0, 0, 0, 'YXZ');
const tmpS = new THREE.Vector3();
const tmpP = new THREE.Vector3();
const box = new THREE.Box3();
const wallPoint = new THREE.Vector3();
const wallAnkle = new THREE.Vector3();
const wallStart = new THREE.Vector3();
const wallTarget = new THREE.Vector3();
const wallError = new THREE.Vector3();
const wallProbe = new THREE.Vector3();
const wallJacobian = [
  new THREE.Vector3(),
  new THREE.Vector3(),
  new THREE.Vector3(),
];
const wallMatrix = new THREE.Matrix3();
const wallFootRotation = new THREE.Quaternion();
const wallParentRotation = new THREE.Quaternion();
const wallCorners = new Float64Array(16);
const WALL_JOINTS = [
  ['leg', 'x'],
  ['leg', 'z'],
  ['knee', 'x'],
] as const;
const SUMO_ARM_GUARDS = [
  { shoulder: -0.35, inward: 0.25, elbow: 0.5, wrist: 0.15 },
  { shoulder: 0.7, inward: 1.1, elbow: 1.5, wrist: 0.15 },
  // Forearms folded across the front of the belly (8 October 2026): the
  // lower, waddling stance rolls the shoulders towards a passing facade.
  { shoulder: 0.3, inward: 0.75, elbow: 1.25, wrist: 0.1 },
] as const;
type SumoArmGuard = (typeof SUMO_ARM_GUARDS)[number];
function stoneShape(w: number, deck: number, badgeWidth: number) {
  const profile = [
    [0, 0.99],
    [0.06, 1.015],
    [0.16, 1.02],
    [0.3, 1.01],
    [0.48, 0.98],
    [0.8, 0.95],
    [1.2, 0.93],
    [1.6, 0.915],
    [2, 0.91],
    [deck - 0.48, 0.92],
    [deck - 0.32, 0.94],
    [deck - 0.22, 1.015],
    [deck - 0.13, 1.04],
    [deck - 0.04, 1.035],
    [deck, 1.01],
  ];
  const blocks: number[][] = [];
  const block = (
    cx: number,
    cy: number,
    cz: number,
    sx: number,
    sy: number,
    sz: number,
    bevel: number,
  ) => {
    const b = Math.min(bevel, sx / 2, sy / 2, sz / 2);
    blocks.push([cx, cy, cz, sx / 2 - b, sy / 2 - b, sz / 2 - b, b]);
  };
  block(0, deck - 0.02, 0, w * 0.78, 0.08, w * 0.78, 0.04);
  const crowns: number[][] = [];
  for (const side of [-1, 1]) {
    block(0, deck + 0.09, side * w * 0.45, w * 0.73, 0.3, 0.23, 0.1);
    block(side * w * 0.45, deck + 0.09, 0, 0.23, 0.3, w * 0.73, 0.1);
    for (const other of [-1, 1]) {
      const cx = side * w * 0.405;
      const cz = other * w * 0.405;
      block(cx, deck + 0.2, cz, 0.55, 0.55, 0.55, 0.13);
      crowns.push([cx, cz]);
    }
  }
  const quoins: number[][] = [];
  let z = 0.12;
  for (let row = 0; z < deck - 0.62; row++) {
    const tall = row % 2 === 0 ? 0.3 : 0.24;
    const long = row % 2 === 0 ? 0.5 : 0.34;
    const cy = z + tall / 2;
    let factor = profile[0][1];
    for (let i = 1; i < profile.length; i++) {
      const [h, f] = profile[i];
      const [h0, f0] = profile[i - 1];
      factor = f0 + (f - f0) * clamp01((cy - h0) / (h - h0));
      if (cy <= h) break;
    }
    const corner = ((w * factor) / 2) * Math.pow(0.5, 0.2) + 0.01;
    quoins.push([
      corner,
      cy,
      long / 2 - 0.045,
      (tall - 0.035) / 2 - 0.045,
      0.13 / 2 - 0.045,
      0.045,
    ]);
    z += tall;
  }
  const shieldSlope = 0.8 / badgeWidth;
  const heraldry = {
    front: w * 0.465,
    half: badgeWidth / 2,
    slope: shieldSlope,
    normal: Math.hypot(shieldSlope, 1),
    crestHalf: (badgeWidth * 0.29) / 2 - 0.0325,
  };
  return { w, deck, profile, blocks, crowns, quoins, heraldry };
}
const STONE_SHAPES = {
  king: stoneShape(3.55, 3.2, 1.05),
  princess: stoneShape(2.7, 2.9, 0.86),
};

/** The shipped cartoon shell, including its tapered body and coping.
 *  Unlike the ground footprint this has a roof: a bite over it is clear.
 *  Dimensions match cartoon_towers.py; the king's rear keep is removed. */
export function towerStoneGap(
  t: Tower,
  wx: number,
  wy: number,
  wz: number,
  scale: number,
) {
  const x = (wx - (t.x - 9)) / scale;
  const y = wy / scale;
  const z = (wz - (16 - t.y)) / scale;
  const { w, deck, profile, blocks, crowns } = STONE_SHAPES[t.kind];
  let factor = profile[0][1];
  for (let i = 1; i < profile.length; i++) {
    const [h, f] = profile[i];
    const [h0, f0] = profile[i - 1];
    factor = f0 + (f - f0) * clamp01((y - h0) / (h - h0));
    if (y <= h) break;
  }
  let gap = Math.max(
    -y,
    y - deck,
    Math.pow(Math.pow(Math.abs(x), 5) + Math.pow(Math.abs(z), 5), 0.2) -
      (w * factor) / 2,
  );
  for (const [cx, cy, cz, hx, hy, hz, b] of blocks) {
    const qx = Math.abs(x - cx) - hx;
    const qy = Math.abs(y - cy) - hy;
    const qz = Math.abs(z - cz) - hz;
    gap = Math.min(
      gap,
      Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) +
        Math.min(Math.max(qx, qy, qz), 0) -
        b,
    );
  }
  for (const [cx, cz] of crowns)
    gap = Math.min(gap, Math.hypot(x - cx, y - deck - 0.54, z - cz) - 0.085);
  return gap * scale;
}

/** Palms pass close to the corner stones and raised heraldry which
 *  stand proud of the shell. Cache their dimensions from cartoon_towers.py;
 *  testing only the tapered body would miss these low protrusions. */
export function towerArmGap(
  t: Tower,
  wx: number,
  wy: number,
  wz: number,
  scale: number,
) {
  let gap = towerStoneGap(t, wx, wy, wz, scale) / scale;
  const x = (wx - (t.x - 9)) / scale;
  const y = wy / scale;
  const z = (wz - (16 - t.y)) / scale;
  for (const [corner, cy, hx, hy, hz, bevel] of STONE_SHAPES[t.kind].quoins) {
    const qy = Math.abs(y - cy) - hy;
    if (qy - bevel >= gap) continue;
    for (let sx = -1; sx <= 1; sx += 2)
      for (let sz = -1; sz <= 1; sz += 2) {
        const dx = x - sx * corner;
        const dz = z - sz * corner;
        const qx = Math.abs((sx * dx - sz * dz) * Math.SQRT1_2) - hx;
        const qz = Math.abs((sx * dx + sz * dz) * Math.SQRT1_2) - hz;
        gap = Math.min(
          gap,
          Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) +
            Math.min(Math.max(qx, qy, qz), 0) -
            bevel,
        );
      }
  }
  const heraldry = STONE_SHAPES[t.kind].heraldry;
  const front = t.side === 1 ? z : -z;
  // A shallow five-sided shield. Its un-bevelled outline conservatively
  // contains the shipped bevel, including the two sloping bottom edges.
  gap = Math.min(
    gap,
    Math.max(
      Math.abs(x) - heraldry.half,
      y - 2.08,
      (heraldry.slope * Math.abs(x) - (y - 1.63) - 0.52) / heraldry.normal,
      Math.abs(front - heraldry.front - 0.05) - 0.05,
    ),
  );
  // The small raised square crest is turned 45 degrees in its face plane.
  const qx = Math.abs((x + y - 1.67) * Math.SQRT1_2) - heraldry.crestHalf;
  const qy = Math.abs((x - y + 1.67) * Math.SQRT1_2) - heraldry.crestHalf;
  const qz = Math.abs(front - heraldry.front - 0.135);
  gap = Math.min(
    gap,
    Math.hypot(Math.max(qx, 0), Math.max(qy, 0), qz) +
      Math.min(Math.max(qx, qy, qz), 0) -
      0.0325,
  );
  return gap * scale;
}

/** Same primitive union as towerArmGap, with an early exit at the
 * requested clearance. Bounds only skip provably distant primitives. */
export function towerArmBlocked(
  t: Tower,
  wx: number,
  wy: number,
  wz: number,
  scale: number,
  clearance: number,
) {
  const x = (wx - (t.x - 9)) / scale;
  const y = wy / scale;
  const z = (wz - (16 - t.y)) / scale;
  const threshold = clearance / scale;
  const { w, deck, profile, blocks, crowns, quoins, heraldry } =
    STONE_SHAPES[t.kind];
  const cushion = 1e-12;
  if (Math.max(-y, y - deck) < threshold + cushion) {
    let factor = profile[0][1];
    for (let i = 1; i < profile.length; i++) {
      const [h, f] = profile[i];
      const [h0, f0] = profile[i - 1];
      const q = (y - h0) / (h - h0);
      factor = f0 + (f - f0) * (q < 0 ? 0 : q > 1 ? 1 : q);
      if (y <= h) break;
    }
    const distance = Math.max(
      -y,
      y - deck,
      Math.pow(Math.pow(Math.abs(x), 5) + Math.pow(Math.abs(z), 5), 0.2) -
        (w * factor) / 2,
    );
    // The old arm predicate obtains the base shell in world scale,
    // divides back to native units, then scales the union once more.
    // Retain that round trip even at a floating-point threshold.
    if (((distance * scale) / scale) * scale < clearance) return true;
  }
  for (const [cx, cy, cz, hx, hy, hz, bevel] of blocks) {
    const qx = Math.abs(x - cx) - hx;
    const qy = Math.abs(y - cy) - hy;
    const qz = Math.abs(z - cz) - hz;
    const largest = Math.max(qx, qy, qz);
    if (largest - bevel > threshold + cushion) continue;
    const distance =
      Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) +
      Math.min(largest, 0) -
      bevel;
    if (((distance * scale) / scale) * scale < clearance) return true;
  }
  for (const [cx, cz] of crowns) {
    const dx = x - cx;
    const dy = y - deck - 0.54;
    const dz = z - cz;
    if (
      Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz)) - 0.085 >
      threshold + cushion
    )
      continue;
    const distance = Math.hypot(dx, dy, dz) - 0.085;
    if (((distance * scale) / scale) * scale < clearance) return true;
  }
  for (const [corner, cy, hx, hy, hz, bevel] of quoins) {
    const qy = Math.abs(y - cy) - hy;
    if (qy - bevel > threshold + cushion) continue;
    for (let sx = -1; sx <= 1; sx += 2)
      for (let sz = -1; sz <= 1; sz += 2) {
        const dx = x - sx * corner;
        const dz = z - sz * corner;
        const qx = Math.abs((sx * dx - sz * dz) * Math.SQRT1_2) - hx;
        const qz = Math.abs((sx * dx + sz * dz) * Math.SQRT1_2) - hz;
        const largest = Math.max(qx, qy, qz);
        if (largest - bevel > threshold + cushion) continue;
        if (
          (Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) +
            Math.min(largest, 0) -
            bevel) *
            scale <
          clearance
        )
          return true;
      }
  }
  const front = t.side === 1 ? z : -z;
  if (
    Math.max(
      Math.abs(x) - heraldry.half,
      y - 2.08,
      (heraldry.slope * Math.abs(x) - (y - 1.63) - 0.52) / heraldry.normal,
      Math.abs(front - heraldry.front - 0.05) - 0.05,
    ) *
      scale <
    clearance
  )
    return true;
  const qx = Math.abs((x + y - 1.67) * Math.SQRT1_2) - heraldry.crestHalf;
  const qy = Math.abs((x - y + 1.67) * Math.SQRT1_2) - heraldry.crestHalf;
  const qz = Math.abs(front - heraldry.front - 0.135);
  const largest = Math.max(qx, qy, qz);
  if (largest - 0.0325 > threshold + cushion) return false;
  return (
    (Math.hypot(Math.max(qx, 0), Math.max(qy, 0), qz) +
      Math.min(largest, 0) -
      0.0325) *
      scale <
    clearance
  );
}

/** Measure a kit's legs at rest, once. Figures without a full hip, knee
 *  and ankle on both sides (the Robots, the flyers) get none. */
function measureLegs(kit: Kit): Legs | null {
  if (legsOf.has(kit.model)) return legsOf.get(kit.model)!;
  const { rig, model } = kit;
  const parts = ['legL', 'kneeL', 'footL', 'legR', 'kneeR', 'footR'] as const;
  if (parts.some((p) => !rig[p])) {
    legsOf.set(model, null);
    return null;
  }
  for (const p of parts) {
    rig[p]!.node.rotation.copy(rig[p]!.rest);
    rig[p]!.node.position.y = rig[p]!.y;
  }
  model.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(model.matrixWorld).invert();
  const at = (node: THREE.Object3D) =>
    new THREE.Vector3()
      .setFromMatrixPosition(node.matrixWorld)
      .applyMatrix4(inv);
  const side = (s: 'L' | 'R'): LegGeometry => {
    const hip = at(rig[`leg${s}`]!.node);
    const knee = at(rig[`knee${s}`]!.node);
    const ankle = at(rig[`foot${s}`]!.node);
    // The foot's extent: the lowest point is the sole, the ends heel and toe.
    let low = Infinity;
    let front = Infinity;
    let back = -Infinity;
    const corners: THREE.Vector3[] = [];
    const footInv = rig[`foot${s}`]!.node.matrixWorld.clone().invert();
    const surfaces = figureSurfaces(model, model.name, `foot${s}`);
    for (const surface of surfaces) {
      const { mesh } = surface;
      const m = tmpM.copy(inv).multiply(mesh.matrixWorld);
      const footM = footInv.clone().multiply(mesh.matrixWorld);
      posedSurfaceBounds(surface, box, m);
      low = Math.min(low, box.min.y);
      front = Math.min(front, box.min.z);
      back = Math.max(back, box.max.z);
      posedSurfaceBounds(surface, box, footM);
      for (let i = 0; i < 8; i++) {
        corners.push(
          new THREE.Vector3(
            i & 1 ? box.max.x : box.min.x,
            i & 2 ? box.max.y : box.min.y,
            i & 4 ? box.max.z : box.min.z,
          ),
        );
      }
    }
    if (!Number.isFinite(low)) low = 0;
    return {
      hip,
      ankle,
      shape: {
        thigh: { y: knee.y - hip.y, z: knee.z - hip.z },
        shin: { y: ankle.y - knee.y, z: ankle.z - knee.z },
      },
      sole: Math.max(0.01, ankle.y - low),
      heel: Math.max(0.01, Number.isFinite(back) ? back - ankle.z : 0.03),
      toe: Math.max(0.02, Number.isFinite(front) ? ankle.z - front : 0.08),
      corners,
      surfaces,
    };
  };
  const L = side('L');
  const R = side('R');
  const legs: Legs = {
    L,
    R,
    length:
      (L.hip.y + R.hip.y) / 2 -
      Math.min(L.ankle.y - L.sole, R.ankle.y - R.sole),
    width: Math.abs(R.hip.x - L.hip.x) / 2,
  };
  legsOf.set(model, legs);
  return legs;
}

/** One foot on the field: where its ankle sits when the sole is flat
 *  (world units; `y` the ground under it) and which way it points, and
 *  while it is in the air, where it left from. */
type Foot = {
  planted: boolean;
  air: boolean;
  /** A balancing step timed by the clock (standing), not by the cycle. */
  timed: boolean;
  x: number;
  y: number;
  z: number;
  yaw: number;
  fromX: number;
  fromY: number;
  fromZ: number;
  fromYaw: number;
  /** Through the swing (0..1), where it started, and the cycle last frame. */
  k: number;
  k0: number;
  u: number;
};
const newFoot = (): Foot => ({
  planted: false,
  air: false,
  timed: false,
  x: 0,
  y: 0,
  z: 0,
  yaw: 0,
  fromX: 0,
  fromY: 0,
  fromZ: 0,
  fromYaw: 0,
  k: 0,
  k0: 0,
  u: 0,
});
const wrapAngle = (a: number) => {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
};

export class TroopView {
  /** Where the troop stands, in world space. */
  readonly position = new THREE.Vector3();
  /** Cached before another troop reuses the shared kit. */
  readonly statusAnchor = new THREE.Vector3();
  readonly style: Style;
  private carriage: Carriage;
  readonly flying: boolean;
  private kit: Kit;
  /** World units per figure unit for this troop: the troops' scale times
   *  its figure's own size. */
  private get scale() {
    return this.troops.scale * (this.kit.size ?? 1);
  }
  /** A gun's tip (an empty named `<id>.muzzle` on the weapon bone) on this
   *  unit's own skin copy, so shots leave the barrel. */
  private muzzleNode: THREE.Object3D | null;
  /** The weapon's tip in its part's space (weaponTip), and where it was
   *  when this unit was last drawn. */
  private tipLocal: THREE.Vector3 | null;
  private tipAt = new THREE.Vector3();
  private tipSeen = false;
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
  private faceWind = 0;
  private faceStrike = 0;
  private faceTime = 0;
  private phase = Math.random() * Math.PI * 2;
  /** World units walked, for wheels. */
  private travel = 0;
  private facing: number | null = null;
  private turnRate = 0;
  private last: THREE.Vector3 | null = null;
  private flinch = 0;
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
  /** The walk (gait.ts): the troop's profile, its legs as built, each
   *  foot on the field, and how much of each leg the ground solver has
   *  back after a move or a fall took it (0..1). */
  private gait: GaitProfile;
  private clockwork: boolean;
  private legs: Legs | null;
  private collisionLegs: Legs | null;
  private buildings: readonly Tower[] = [];
  private stoneScale = 0.9;
  private feet = { L: newFoot(), R: newFoot() };
  private legFree = { L: 0, R: 0 };
  private footYaw = { L: 0, R: 0 };
  private hipAngles = { L: 0, R: 0 };
  /** Where the solver puts each ankle (world) and each foot's pitch. */
  private ankles = { L: [0, 0, 0], R: [0, 0, 0] };
  private pitches = { L: 0, R: 0 };
  /** Leg parts the solver wrote this frame (bits of PART_INDEX). */
  private ikMask = 0;
  /** Ground speed and its change (world units a second), and the way it
   *  is going. */
  private speed = 0;
  private accel = 0;
  private velX = 0;
  private velZ = 0;
  /** Cycles a second while walking, and world units per cycle. */
  private rate = 1;
  private cycleLength = 1;
  /** The body's turn from moves last frame (a spin), for the feet. */
  private kick = 0;
  /** The pelvis shifted sideways over the planted foot (world units). */
  private side = 0;
  private sideGoal = 0;
  /** Each joint's spring stiffness (against the snap) and damping, with
   *  the troop's own changes (moves/). */
  private stiff = new Float32Array(PARTS.length);
  private damp = new Float32Array(PARTS.length);
  /** How the body moves, for soft parts (MoveContext): speeding up along
   *  and across its facing, up and down, and how long it has stood idle. */
  private accelFwd = 0;
  private accelSide = 0;
  private accelUp = 0;
  private lastBodyY = 0;
  private bodyVY = 0;
  private idleFor = 0;
  /** The troop's scratch numbers for its moves (MoveContext.memo). */
  private memo: Record<string, number> = {};
  /** Joint ownership cannot use a bit mask: JS shifts wrap after 32 parts,
   *  so scarf, sleeves and wrists used to claim the legs and head too. */
  private claimed = new Set<PartName>();
  /** Its cloth (drape) parts' flutter, 0..1, sent to the batches. */
  private flutter = 0;
  private stunPose: Float32Array | null = null;
  private stunned = false;
  private pushLeft = 0;
  private pushDuration = 0.16;
  private pushOffset = new THREE.Vector3();
  private pushDirection = new THREE.Vector3();

  constructor(
    private troops: TroopRenderer,
    readonly id: number,
    readonly card: TroopId,
    readonly team: Team,
    readonly ringStyle: RingStyle,
  ) {
    const model = troops.modelOf(card);
    this.kit = troops.kit(model, team);
    this.muzzleNode = this.kit.direct
      ? (this.kit.model.getObjectByName(`${card}muzzle`) ??
        this.kit.model.getObjectByName(`${card}.muzzle`) ??
        null)
      : null;
    const weapon = this.kit.rig[TIP_PART[card] ?? 'weapon']?.node;
    this.tipLocal = weapon ? weaponTip(weapon) : null;
    // A card that deploys two people (the Cadets) carries both heads on its
    // head bone, `<id>.lookA` and `<id>.lookB` (shipped at scale 0). A
    // card's formation is summoned in one go, so its units have consecutive
    // ids and parity always gives one of each, the same on every client.
    const lookA = this.kit.direct && this.kit.model.getObjectByName(`${card}lookA`);
    const lookB = this.kit.direct && this.kit.model.getObjectByName(`${card}lookB`);
    if (lookA && lookB) {
      const second = id % 2 === 1;
      // Both heads were built in one frame on the same neck point, but the
      // look shipped at scale 0 also exports its head group collapsed (and
      // misplaced), so the shown look takes the head transform of the other.
      const show = (look: THREE.Object3D, other: THREE.Object3D, on: boolean) => {
        look.scale.setScalar(on ? 1 : 0);
        if (!on) return;
        look.children.forEach((head, i) => {
          const ref = other.children[i];
          if (head.scale.x !== 0 || !ref) return;
          head.position.copy(ref.position);
          head.quaternion.copy(ref.quaternion);
          head.scale.copy(ref.scale);
        });
      };
      show(lookA, lookB, !second);
      show(lookB, lookA, second);
    }
    this.ids = troops.add(this.kit);
    this.style = styles[card];
    this.carriage = moves[card]?.carriage ?? CARRIAGE;
    const own = moves[card];
    PARTS.forEach((part, i) => {
      this.stiff[i] = own?.stiff?.[part] ?? STIFF[part];
      this.damp[i] = own?.damping?.[part] ?? DAMPING;
    });
    this.flying = troopCards[card].unit.flying;
    this.gait = gaitOf(this.style.gait, this.style.heavy ? 'heavy' : 'brisk');
    this.clockwork = this.style.gait === 'clockwork';
    this.collisionLegs = this.flying ? null : measureLegs(this.kit);
    this.legs = this.clockwork ? null : this.collisionLegs;
  }

  /** Where projectiles leave and land: chest height in world space. */
  chest(target = new THREE.Vector3()) {
    const h = this.kit.top * (this.troops.scale / TROOP_SCALE) * 0.58;
    return target.set(
      this.position.x,
      this.position.y + this.bodyY + h,
      this.position.z,
    );
  }

  /** Where a gun's shot leaves: its muzzle in world space, or null for a
   *  troop without one (shots then leave the chest). */
  muzzle(target = new THREE.Vector3()) {
    if (!this.muzzleNode) return null;
    this.muzzleNode.updateWorldMatrix(true, false);
    return target.setFromMatrixPosition(this.muzzleNode.matrixWorld);
  }

  /** Its weapon's tip (a wand, a barrel) where the unit was last drawn,
   *  or null for a troop without a weapon part. */
  tip(target = new THREE.Vector3()) {
    return this.tipSeen ? target.copy(this.tipAt) : null;
  }

  /** It was hit: flinch. */
  hit() {
    this.flinch = 1;
  }

  /** Draw the engine's instantaneous impulse as a short skid. It never
   * advances a walking stride or leaves a foot stretched behind the body. */
  knockback(fx: number, fz: number, x: number, z: number) {
    const dx = x - fx;
    const dz = z - fz;
    const distance = Math.hypot(dx, dz);
    if (distance < 1e-5) return;
    this.pushDuration = Math.min(0.22, 0.1 + distance * 0.055);
    this.pushLeft = this.pushDuration;
    this.pushOffset.set(
      this.last ? this.position.x - x : -dx,
      0,
      this.last ? this.position.z - z : -dz,
    );
    this.pushDirection.set(dx / distance, 0, dz / distance);
    this.hit();
  }

  /** Frosted by an Explorer's shot (the unit's `slow`): an icy tint on the
   *  figure's batch colour while it lasts. The x-ray pass resets every
   *  colour to white after each frame, so the tint is written each frame. */
  private frosted = false;
  frost(on: boolean) {
    if (!on && !this.frosted) return;
    this.frosted = on;
    this.troops.colour(this.kit, this.ids, on ? FROST : WHITE);
  }

  update(
    u: Unit,
    alpha: number,
    dt: number,
    time: number,
    buildings: readonly Tower[] = [],
    stoneScale = 0.9,
  ) {
    this.buildings = buildings;
    this.stoneScale = stoneScale;
    this.faceTime = time;
    const pushed = this.pushLeft > 0;
    const x = pushed ? u.x : u.px + (u.x - u.px) * alpha;
    const y = pushed ? u.y : u.py + (u.y - u.py) * alpha;
    let [wx, , wz] = toWorld(x, y);
    if (pushed) {
      this.pushLeft = Math.max(0, this.pushLeft - dt);
      const left = this.pushLeft / this.pushDuration;
      wx += this.pushOffset.x * left * left;
      wz += this.pushOffset.z * left * left;
    }
    const ground = this.flying ? 0 : standHeight(wx, wz);
    this.position.set(wx, ground, wz);
    // Walk cycle from distance travelled, so feet do not slide.
    const here = this.position;
    const dx = this.last ? here.x - this.last.x : 0;
    const dz = this.last ? here.z - this.last.z : 0;
    let moved = Math.hypot(dx, dz);
    if (pushed) {
      for (const f of [this.feet.L, this.feet.R]) {
        f.x += dx;
        f.z += dz;
        f.fromX += dx;
        f.fromZ += dz;
      }
      moved = 0;
    }
    if (this.last) this.last.copy(here);
    else this.last = here.clone();
    // A jump across the field (a new match, a resync) re-plants the feet.
    if (moved > 1.5) {
      moved = 0;
      this.feet.L.planted = this.feet.R.planted = false;
    }
    if (dt > 0) {
      const k = Math.min(1, dt * 6);
      const was = this.speed;
      const vx0 = this.velX;
      const vz0 = this.velZ;
      this.speed += (moved / dt - this.speed) * k;
      this.velX += ((pushed ? 0 : dx / dt) - this.velX) * k;
      this.velZ += ((pushed ? 0 : dz / dt) - this.velZ) * k;
      this.accel +=
        ((this.speed - was) / dt - this.accel) * Math.min(1, dt * 4);
      // The body's acceleration along and across its facing, for the parts
      // that lag it (a jump across the field is not a push).
      if (moved > 0 || this.speed > 0.01) {
        const ax = (this.velX - vx0) / dt;
        const az = (this.velZ - vz0) / dt;
        const f = this.facing ?? 0;
        const fwd = -ax * Math.sin(f) - az * Math.cos(f);
        const right = ax * Math.cos(f) - az * Math.sin(f);
        const a = Math.min(1, dt * 8);
        const cap = (v: number) => Math.max(-12, Math.min(12, v));
        this.accelFwd += (cap(fwd) - this.accelFwd) * a;
        this.accelSide += (cap(right) - this.accelSide) * a;
      } else {
        this.accelFwd *= 1 - Math.min(1, dt * 8);
        this.accelSide *= 1 - Math.min(1, dt * 8);
      }
    }
    // A figure drawn larger takes longer strides.
    const size = this.scale / TROOP_SCALE;
    this.travel += moved;
    // The clockwork walk's cycle; the others advance theirs in `advance`.
    if (u.state === 'walking' && !this.legs)
      this.phase +=
        (moved / ((this.style.stride ?? 0.3) * size * this.tempo)) *
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
    if (this.card === 'viking')
      this.memo.vikingStoneGuard = vikingStoneGuard(
        this.buildings.reduce(
          (gap, tower) =>
            tower.destroyed ? gap : Math.min(gap, towerGap(tower, x, y)),
          Infinity,
        ),
        this.scale / TROOP_SCALE,
      );
    if (this.card === 'gladiator')
      this.memo.gladiatorStoneGuard = gladiatorStoneGuard(
        this.buildings.reduce(
          (gap, tower) =>
            tower.destroyed ? gap : Math.min(gap, towerGap(tower, x, y)),
          Infinity,
        ),
        this.scale / TROOP_SCALE,
      );
    if (this.card === 'medic')
      this.memo.medicStoneGuard = medicStoneGuard(
        this.buildings.reduce(
          (gap, tower) =>
            tower.destroyed ? gap : Math.min(gap, towerGap(tower, x, y)),
          Infinity,
        ),
        this.scale / TROOP_SCALE,
      );
    this.animate(u, alpha, dt, time, moved);
    this.anticipateArmContact(u);
    this.clearBodyOffset();
    // The body's rise and fall, for the parts that lag it.
    if (dt > 0) {
      const vy = (this.bodyY - this.lastBodyY) / dt;
      const ay = Math.max(-30, Math.min(30, (vy - this.bodyVY) / dt));
      this.accelUp += (ay - this.accelUp) * Math.min(1, dt * 10);
      this.bodyVY = vy;
    }
    this.lastBodyY = this.bodyY;
    this.settle(dt);
    this.begin();
    this.apply();
    this.clearFeet(u.state === 'deploying');
    if (this.card === 'viking') this.clearVikingBoots();
    if (this.card === 'gladiator' || this.card === 'medic')
      this.clearWeightedSoles();
    this.draw();
    let top =
      ground +
      this.bodyY +
      (this.kit.top ?? TROOP_SCALE * 1.4) *
        (this.troops.scale / TROOP_SCALE) *
        this.squash;
    // A guarded bite can raise the Dino's snout above its neutral height.
    // Both HP tracks and status badges follow that actually posed head.
    if (this.card === 'ogre' || this.card === 'viking' || this.kit.direct)
      for (const surface of this.headSurfaces()) {
        surfaceBroadBounds(surface, box);
        top = Math.max(top, box.max.y);
      }
    this.statusAnchor.set(wx, top, wz);
    if (this.kit.drapes)
      this.troops.flutter(
        this.kit,
        this.ids,
        this.flutter,
        this.frosted ? FROST : WHITE,
      );
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
  private apply(p = this.pose) {
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
    applyFace(
      this.kit.face,
      facePose({
        id: this.card,
        seed: this.id,
        time: this.faceTime,
        aim: this.aimMix,
        wind: this.faceWind,
        strike: this.faceStrike,
        hurt: this.dying >= 0 ? 1 : this.flinch,
        look: this.pose[PART_INDEX.head * CHANNELS + 1],
        reduced: this.troops.reducedMotion,
        stunned: this.stunned,
      }),
    );
    this.placeBody();
    if (this.card === 'mage' && this.dying < 0)
      plantMageStaff(
        this.kit.model,
        this.memo,
        standHeight,
        this.kit.rig.weapon?.y ?? 0,
      );
    this.troops.write(this.kit, this.ids);
    // The kit is shared by every unit of a rigid figure: keep this unit's
    // own weapon tip while its matrices are fresh.
    const weapon = this.kit.rig[TIP_PART[this.card] ?? 'weapon']?.node;
    if (weapon && this.tipLocal) {
      this.tipAt.copy(this.tipLocal).applyMatrix4(weapon.matrixWorld);
      this.tipSeen = true;
    }
  }

  private placeBody() {
    const { group, body } = this.kit;
    const facing = this.facing ?? 0;
    // Forward is the model's -z; a lunge throws the whole toy that way.
    group.position.set(
      this.position.x - Math.sin(facing) * this.lunge,
      this.position.y,
      this.position.z - Math.cos(facing) * this.lunge,
    );
    // The pelvis shifted over the planted foot, along the figure's right.
    group.position.x += Math.cos(facing) * this.side;
    group.position.z -= Math.sin(facing) * this.side;
    body.position.y = this.bodyY;
    body.rotation.order = 'YXZ';
    body.rotation.set(-this.pitch, facing + this.yawKick, this.roll);
    const s = this.shrink;
    const wide = 1 + (1 - this.squash) * 0.6;
    body.scale.set(wide * s, this.squash * s, wide * s);
  }

  /** Ask a joint for a pose this frame. */
  /** Shoulder blades follow the arms (scapulohumeral rhythm): beyond about
   *  thirty degrees a raised arm takes a third of further lift in a shrug,
   *  a forward reach brings the shoulder forward and a pull draws it back.
   *  The arm gives back what the clavicle took, so the hand ends where the
   *  pose asked, but the shoulder line moves like a body's, not a socket on
   *  a post. Arms the pose drives with `want` are read back from their
   *  goals, so custom attacks get the same shoulders. */
  private shoulderGirdle(mine: (part: PartName) => boolean) {
    for (const [side, sign] of [
      ['L', -1],
      ['R', 1],
    ] as const) {
      const clav = `clav${side}` as const;
      if (!this.kit.rig[clav] || mine(clav)) continue;
      const arm = PART_INDEX[`arm${side}`] * CHANNELS;
      const forward = this.goal[arm];
      const out = this.goal[arm + 2] * sign;
      const lift = Math.max(forward, out);
      const shrug = Math.min(0.32, Math.max(0, lift - 0.5) * 0.33);
      const reach =
        forward > 0
          ? Math.min(0.22, Math.max(0, forward - 0.25) * 0.2)
          : Math.max(-0.12, forward * 0.18);
      this.want(clav, 0, sign * reach, sign * shrug);
      // The arm keeps its total: the shrug is part of its sideways or
      // forward lift, whichever is larger.
      if (out >= forward) this.goal[arm + 2] -= sign * shrug;
      else this.goal[arm] -= shrug;
    }
  }

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
      const k = snap * this.stiff[i];
      const damping = this.damp[i];
      const at = i * CHANNELS;
      if (k === 0) {
        for (let c = 0; c < CHANNELS; c++) pose[at + c] = goal[at + c];
        return;
      }
      // Legs on the ground solver follow it exactly (a spring's lag would
      // let planted feet slide), blending in after a move let go of them.
      const side = this.ikMask & (1 << i) ? LEG_SIDE[part] : undefined;
      const direct = side ? this.legFree[side] : 0;
      const steps = Math.max(1, Math.ceil((dt * k) / 0.35));
      const h = dt / steps;
      for (let c = 0; c < CHANNELS; c++) {
        const before = pose[at + c];
        let x = before;
        let v = vel[at + c];
        const g = goal[at + c];
        for (let n = 0; n < steps; n++) {
          v += (k * k * (g - x) - 2 * damping * k * v) * h;
          x += v * h;
        }
        if (direct > 0) {
          x += (g - x) * direct;
          if (direct >= 1 && dt > 0) v = (g - before) / dt;
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
    moved: number,
  ) {
    const s = this.style;
    const stats = troopCards[this.card].unit;
    this.stunned = u.stun > 0 && u.state !== 'deploying';
    if (this.stunned) {
      // Hold the interrupted action. Custom spins, support pulses and
      // wind-ups must stop too, whatever state the engine last left on it.
      this.stunPose ??= this.pose.slice();
      this.goal.set(this.stunPose);
      this.goal[PART_INDEX.head * CHANNELS] += 0.12;
      this.goal[PART_INDEX.torso * CHANNELS] -= 0.06;
      this.walkMix = this.aimMix = this.faceWind = this.faceStrike = 0;
      this.idleFor = 0;
      this.claimed.clear();
      this.ikMask = 0;
      this.bodyY = this.flying ? (s.flyHeight ?? FLY_HEIGHT) : 0;
      this.squash = 0.98;
      this.lunge *= Math.exp(-dt * 14);
      const f = this.facing ?? 0;
      const recoil = this.pushLeft / this.pushDuration;
      const tilt =
        (-Math.sin(f) * this.pushDirection.x -
          Math.cos(f) * this.pushDirection.z) *
        recoil *
        0.22;
      [this.pitch, this.pitchV] = this.spring(
        this.pitch,
        this.pitchV,
        -0.04 + tilt,
        s.snap * 0.6,
        dt,
      );
      [this.roll, this.rollV] = this.spring(
        this.roll,
        this.rollV,
        -(
          Math.cos(f) * this.pushDirection.x -
          Math.sin(f) * this.pushDirection.z
        ) *
          recoil *
          0.15,
        s.snap * 0.6,
        dt,
      );
      if (this.legs) {
        this.advance(0, dt, stats.speed);
        const cycle = (((this.phase / (Math.PI * 2)) % 1) + 1) % 1;
        this.plantFeet(
          dt,
          this.flying ? this.bodyY : 0,
          this.claimed,
          0,
          0,
          false,
          cycle,
        );
      }
      return;
    }
    this.stunPose = null;
    const moving = moved > 0.0005;
    this.goal.fill(0);
    this.ikMask = 0;
    this.sideGoal = 0;
    const walking = u.state === 'walking' && moving ? 1 : 0;
    this.walkMix += (walking - this.walkMix) * Math.min(1, dt * 10);
    const attacking = u.state === 'attacking';
    this.aimMix += ((attacking ? 1 : 0) - this.aimMix) * Math.min(1, dt * 9);
    const walk = this.walkMix;
    const aim = this.aimMix;
    const idle = (1 - walk) * (1 - aim);
    this.idleFor =
      idle > 0.9 && u.state !== 'deploying' ? this.idleFor + dt : 0;
    const t = time * this.tempo + this.seed;

    // Timing of the attack: a wind-up before the hit, a fast strike on it
    // (with the engine's hit timer, so blows land on the hit), a recovery.
    // Kept brisk: the figures are drawn large, and large things moving at
    // a real person's pace read as slow motion.
    const toHit = Math.max(0, u.attackTimer - alpha * TICK);
    const since = u.sinceHit + alpha * TICK;
    if (since < this.lastSince && attacking) this.hits++;
    this.lastSince = since;
    const W = Math.min(s.windup * WINDUP_PACE, stats.hitSpeed * 0.6);
    let strike = 0;
    let wind = 0;
    if (attacking) {
      if (since < STRIKE_TIME) strike = out3(since / STRIKE_TIME);
      else if (since < STRIKE_TIME + RECOVER_TIME)
        strike = 1 - ease((since - STRIKE_TIME) / RECOVER_TIME);
      else if (toHit < W) wind = ease(1 - toHit / W);
    }
    this.faceWind = wind;
    this.faceStrike = strike;

    // Deploying: the toy drops onto the mat with a twirl, squashes, bounces
    // twice and stands ready.
    let drop = 0;
    let squash = 1;
    let twirl = 0;
    const custom = moves[this.card];
    const deployed =
      u.state === 'deploying'
        ? clamp01(1 - u.deployLeft / (stats.burrow ?? DEPLOY_TIME))
        : 1;
    if (u.state === 'deploying' && custom?.arrive) {
      ({ drop, squash, twirl } = custom.arrive(deployed));
      this.landed = deployed >= 0.26;
      // Tunnelling, the troop is out of sight (the x-ray pass would show
      // it through the ground); only its dirt marks the spot.
      this.shrink = stats.burrow && deployed < 0.72 ? 0.001 : 1;
    } else if (u.state === 'deploying') {
      const d = deployed;
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

    // The walk. Each foot is planted on the field and the leg is solved
    // onto it every frame (`plantFeet`, after the body has moved), so feet
    // never slide. The cycle, advanced by the distance covered, times the
    // rest: the pelvis drops as each heel strikes and rises as the legs
    // pass, shifts over the planted foot and dips on the swinging side;
    // the pelvis turns with the forward leg and the shoulders against it,
    // so each arm swings with the opposite leg, a moment behind; the head
    // is held steady; the body leans into its speed. The Robots keep their
    // clockwork walk (`walkingLeg` in gait.ts).
    const size = this.scale / TROOP_SCALE;
    // Nothing to carry without legs (the Biplane, the Balloon).
    const c = this.flying || !this.legs ? STILL : this.carriage;
    const TAU = Math.PI * 2;
    const g = this.gait;
    const planted = !this.flying && !this.clockwork && !!this.legs;
    // The pace against the troop's own (slowed, sped up), and how much of
    // the walk shows: building up as it sets off, dying away as it stops.
    const own = Math.max(0.05, stats.speed);
    const ratio = Math.min(1.6, this.speed / own);
    const amp = walk * Math.min(1.25, Math.sqrt(ratio));
    if (planted) this.advance(moved, dt, own);
    const cycle = (((this.phase / TAU) % 1) + 1) % 1;
    const [fwdL] = stride(cycle);
    const [fwdR] = stride((cycle + 0.5) % 1);
    // Lowest while both feet are down (just after each strike), highest as
    // the legs pass.
    const pass = 0.5 - 0.5 * Math.cos((cycle - 0.05) * TAU * 2);
    // +1 with the left leg forward, -1 with the right.
    const step = Math.cos(cycle * TAU);
    // Just after each landing, for things that lag the body's dip.
    const settle = Math.cos((cycle - 0.14) * TAU * 2);
    const breathe = Math.sin(t * 2.3) * 0.012;
    let hop = 0;
    let hipTurn = 0;
    let headDy = 0;
    const hips = this.hipAngles;
    let torsoX = breathe * 0.4;
    let torsoY = 0;
    let torsoZ = 0;
    let headX = Math.sin(t * 1.3) * 0.04 * idle;
    // Standing about, a toy looks around now and then.
    let headY = (Math.sin(t * 0.61) * 0.3 + Math.sin(t * 1.7) * 0.08) * idle;
    let armL = 0;
    let armR = 0;
    let armLz = 0;
    let armRz = 0;
    let lean = 0;
    let roll = Math.sin(t * 0.9) * 0.02 * idle;
    // Arms swing with the opposite leg, a moment late, further forward than
    // back, and hang a little out from the body. Two hands on one weapon
    // swing it together with the stride and dip after each landing.
    const armSwing = s.armSwing ?? g.arms;
    const swingPhase = -Math.cos((cycle - 0.06) * TAU);
    let swingL = 0;
    let swingR = 0;
    if (planted) {
      const legs = this.legs!;
      const L = legs.length * this.scale;
      const ws = weightSide(cycle, dutyFactor(g));
      // Steps cut short of the full stride to keep the cadence (see
      // stepLength) swing the hips, shoulders and arms less, so the quicker
      // step reads as a walk rather than a stagger.
      const ampS = amp * (0.45 + 0.55 * strideShare(g, L, own));
      // Up and down through each step, a little crouched throughout.
      const w = (cycle * 2) % 1;
      hop = (g.bounce * pelvis(w, g) * amp - g.crouch * (0.5 + 0.5 * walk)) * L;
      headDy =
        (-g.bounce * pelvis(w - 0.04, g) * amp * L * 0.35) / this.scale;
      // Over the planted foot, the other hip dropping; the chest stays
      // nearly level and the head level.
      this.sideGoal =
        -g.sway * legs.width * this.scale * 1.12 * ws * ampS;
      roll += -g.roll * ws * ampS;
      torsoZ += g.roll * ws * ampS * 1.4;
      hipTurn = -step * g.twist * ampS;
      torsoY += step * g.twist * 1.8 * ampS;
      headY -= step * g.twist * 0.75 * ampS;
      // Leaning into the walk from the waist, a little more at push-off and
      // while picking up speed; back a touch while slowing down.
      const surge = Math.max(-0.06, Math.min(0.08, this.accel * 0.05));
      const walkLean =
        ((s.lean ?? g.lean) * Math.min(1.3, ratio) + (1 - pass) * 0.02) * walk +
        surge;
      torsoX += walkLean;
      lean = walkLean * 0.35;
      headX += -walkLean * 0.6 + settle * g.nod * amp;
      const armWalk = armSwing * ampS * (1 - aim * 0.8);
      if (s.twoHanded) {
        armL = armR =
          step * armWalk * 0.6 - settle * c.bounce * walk * (1 - aim);
      } else {
        const weaponArm = this.kit.rig.weapon ? c.weaponArm : 1;
        swingL = swingPhase * armWalk + 0.12 * armWalk;
        swingR = (-swingPhase * armWalk + 0.12 * armWalk) * weaponArm;
        armL = swingL;
        armR = swingR;
        const out = c.armOut * walk * (1 - aim);
        armLz = -out * (1 + Math.max(0, -swingPhase) * 0.6);
        armRz = out * (1 + Math.max(0, swingPhase) * 0.6);
      }
      // Elbows (where a figure has them) bend on the forward swing, after
      // the shoulder.
      const late = -Math.cos((cycle - 0.14) * TAU);
      if (this.kit.rig.foreL)
        this.want('foreL', g.elbow * (0.45 + 0.55 * Math.max(0, late)) * amp);
      if (this.kit.rig.foreR)
        this.want('foreR', g.elbow * (0.45 + 0.55 * Math.max(0, -late)) * amp);
    } else {
      // The Robots' clockwork walk, as it was: joint poses from the cycle.
      const weight = Math.cos((cycle - 0.3) * TAU);
      const sw = s.legSwing ?? 0.55;
      hop = pass * (s.bob ?? 0.04) * 0.55 * size * walk;
      if (!this.flying)
        for (const [side, phase] of [
          ['L', cycle],
          ['R', (cycle + 0.5) % 1],
        ] as const) {
          const gait = walkingLeg(phase, sw);
          const knee = this.kit.rig[`knee${side}`];
          const foot = this.kit.rig[`foot${side}`];
          const support =
            phase < 0.6 ? 1 : 1 - Math.sin(((phase - 0.6) / 0.4) * Math.PI);
          const lower =
            knee && foot
              ? legLowering(
                  gait,
                  knee.node.position,
                  foot.node.position,
                  support,
                )
              : 0;
          hips[side] = gait.hip * walk;
          this.want(`leg${side}`, gait.hip * walk, 0, 0, lower * walk);
          this.want(`knee${side}`, gait.knee * walk);
          this.want(`foot${side}`, gait.ankle * walk, 0, -this.roll * walk);
        }
      const walkLean = ((s.lean ?? 0.04) + (1 - pass) * 0.03) * walk;
      torsoX += walkLean;
      torsoY += step * (c.twist + c.hips) * walk;
      torsoZ += weight * (s.sway ?? 0) * c.chestRoll * walk;
      headX += -walkLean * 0.6 + settle * c.nod * walk;
      headY -= step * c.twist * 0.75 * walk;
      const armWalk = armSwing * walk * (1 - aim * 0.8);
      const sp = -Math.cos((cycle - 0.07) * TAU);
      const weaponArm = this.kit.rig.weapon ? c.weaponArm : 1;
      swingL = sp * armWalk + 0.12 * armWalk;
      swingR = -sp * armWalk * weaponArm + 0.12 * armWalk;
      armL = swingL;
      armR = swingR;
      const out = c.armOut * walk * (1 - aim);
      armLz = -out * (1 + Math.max(0, -sp) * 0.6);
      armRz = out * (1 + Math.max(0, sp) * 0.6);
      lean = (s.lean ?? 0.04) * walk * 0.35;
      roll += weight * (s.sway ?? 0) * walk;
      hipTurn = -step * c.hips * walk;
    }
    let weapon = this.kit.rig.weapon
      ? -Math.cos((cycle - 0.2) * TAU * 2) * c.bounce * 0.6 * walk * (1 - aim)
      : 0;
    let offhand = 0;
    let jaw = 0;
    let tailY = 0;
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
      case 'custom':
        break;
    }
    let lift = 0;
    // Parts a troop's own pose turned itself (the shared hang leaves them).
    const claimed = this.claimed;
    claimed.clear();
    if (custom?.pose) {
      const ctx: MoveContext = {
        unit: u,
        walk,
        aim,
        idle,
        wind,
        strike,
        since,
        toHit,
        hits: this.hits,
        t,
        dt,
        cycle,
        fwdL,
        fwdR,
        pass,
        hipL: hips.L,
        hipR: hips.R,
        swingL,
        swingR,
        speed: this.speed,
        gait: g,
        size,
        travel: this.travel,
        accel: this.accelFwd,
        lateral: this.accelSide,
        vertical: this.accelUp,
        turn: this.turnRate,
        idleFor: this.idleFor,
        flinch: this.flinch,
        time,
        reduced: this.troops.reducedMotion,
        memo: this.memo,
        deploy: deployed,
        rest: (part: PartName) => {
          const joint = this.kit.rig[part];
          if (!joint) return null;
          const { x, z } = joint.node.position;
          return [x, joint.y, z] as const;
        },
        want: (part: PartName, rx = 0, ry = 0, rz = 0, dy = 0) => {
          claimed.add(part);
          this.want(part, rx, ry, rz, dy);
        },
      };
      const p: Pose = {
        torsoX,
        torsoY,
        torsoZ,
        headX,
        headY,
        armL,
        armR,
        armLz,
        armRz,
        weapon,
        offhand,
        jaw,
        tailY,
        lean,
        roll,
        lunge,
        yawKick,
        lift: 0,
        squash: 1,
      };
      custom.pose(ctx, p);
      ({
        torsoX,
        torsoY,
        torsoZ,
        headX,
        headY,
        armL,
        armR,
        armLz,
        armRz,
        weapon,
        offhand,
        jaw,
        tailY,
        lean,
        roll,
        lunge,
        yawKick,
      } = p);
      lift = p.lift;
      squash *= p.squash;
    }

    // Hit: a jolt back and a squeeze, the head thrown back.
    const f = this.flinch * this.flinch;
    lean -= f * 0.22;
    headX -= f * 0.3;
    squash *= 1 - f * 0.08;
    const recoil = this.pushLeft / this.pushDuration;
    if (recoil > 0) {
      const facing = this.facing ?? 0;
      lean +=
        (-Math.sin(facing) * this.pushDirection.x -
          Math.cos(facing) * this.pushDirection.z) *
        recoil *
        0.22;
      roll -=
        (Math.cos(facing) * this.pushDirection.x -
          Math.sin(facing) * this.pushDirection.z) *
        recoil *
        0.15;
    }

    // A joint the troop's own pose asked for itself keeps that (below).
    const mine = (part: PartName) => claimed.has(part);
    // Joints turn about x with the model facing +y (Blender): positive tips
    // a torso or head back and raises an arm or leg forward; here torsoX
    // and headX count forward bends and nods, hence the minus.
    // With an upper spine the bend and twist are shared: the lower back
    // takes a little under half and the chest the rest, so the trunk curves
    // instead of hinging at the waist. The chest is the torso's child, so
    // the head and arms end where they would have.
    const spine = this.kit.rig.chest && !mine('chest') ? 0.45 : 1;
    if (!mine('torso'))
      this.want(
        'torso',
        -torsoX * spine,
        torsoY * spine,
        torsoZ * spine,
        breathe * 0.4,
      );
    if (spine < 1 && !mine('torso'))
      this.want(
        'chest',
        -torsoX * (1 - spine) - breathe * 0.6,
        torsoY * (1 - spine),
        torsoZ * (1 - spine),
      );
    // The head stays level as the body rolls.
    if (!mine('head'))
      this.want(
        'head',
        -headX,
        headY,
        -(roll + torsoZ) * (planted ? 0.8 : 0.55) * walk,
        headDy,
      );
    // Coat tails and kilts hang from the waist: each half swings after its
    // leg by a share of the hip's turn (a little more back, where the thigh
    // pushes it, than forward, where the coat is open) and flares out a
    // little as it goes (a rigid half flared further opens its rear vent);
    // its own soft spring makes it trail. It takes back the
    // chest's lean and most of its roll, so it hangs from the hips, but
    // only half its turn: turning further against the coat above would
    // bare the coat's hidden lining under the seam.
    for (const [side, out] of [
      ['L', -1],
      ['R', 1],
    ] as const) {
      const part = `skirt${side}` as const;
      if (!this.kit.rig[part] || mine(part)) continue;
      const hip = hips[side];
      this.want(
        part,
        hip * (hip > 0 ? 0.56 : 0.62) + torsoX - 0.04 * walk,
        -torsoY * 0.5,
        out * (0.012 * walk + Math.abs(hip) * 0.07) - torsoZ * 0.8,
      );
    }
    if (this.kit.rig.cape && !mine('cape'))
      // A cape trails the walk and lifts a little at each push-off.
      this.want('cape', torsoX * 0.5 - (0.1 + (1 - pass) * 0.05) * walk);
    if (!mine('armL')) this.want('armL', armL, 0, armLz);
    if (!mine('armR')) this.want('armR', armR, 0, armRz);
    this.shoulderGirdle(mine);
    if (!mine('weapon')) this.want('weapon', weapon);
    if (!mine('offhand')) this.want('offhand', offhand);
    if (!mine('tail')) this.want('tail', 0, tailY, 0);
    // A jaw opens with a negative turn.
    if (!mine('jaw')) this.want('jaw', -jaw);

    const flyY = this.flying ? (s.flyHeight ?? FLY_HEIGHT) : 0;

    this.bodyY = drop + flyY + hop + lift;
    // A little squash as each foot strikes, more for heavy troops.
    // (The planted walk's knees take most of it.)
    const thud = planted ? 0.008 + g.weight * 0.022 : s.heavy ? 0.07 : 0.035;
    this.squash = squash * (1 - Math.pow(1 - pass, 4) * thud * walk);
    // Cloth ripples more on the move, turning, striking and when hit.
    const stir = Math.min(
      1,
      walk * Math.min(1.2, ratio) * 0.75 +
        Math.min(0.4, Math.abs(this.turnRate) * 0.12) +
        aim * (strike + wind) * 0.35 +
        this.flinch * 0.5 +
        (this.flying ? 0.5 : 0),
    );
    this.flutter += (stir - this.flutter) * Math.min(1, dt * 3);
    const kBody = this.flying ? 6 : this.style.snap * 0.6;
    [this.pitch, this.pitchV] = this.spring(
      this.pitch,
      this.pitchV,
      lean,
      kBody,
      dt,
    );
    // Walkers lean into a turn (a + roll leans left, a + turn is to the
    // left; it leaned out until 3 October 2026).
    const bank = this.flying
      ? 0
      : Math.max(-0.12, Math.min(0.12, this.turnRate * 0.05));
    [this.roll, this.rollV] = this.spring(
      this.roll,
      this.rollV,
      roll + bank,
      kBody,
      dt,
    );
    this.lunge += (lunge * size - this.lunge) * Math.min(1, dt * 30);
    // The hips turn with the forward leg (the chest turns back against
    // them, above).
    this.yawKick = yawKick + twirl + hipTurn;
    // A move that turns the whole body round (the Viking's spin) pivots
    // the feet with it rather than wringing the legs.
    const kick = yawKick + twirl;
    if (planted && (Math.abs(kick) > 0.3 || Math.abs(this.kick) > 0.3))
      this.pivotFeet(wrapAngle(kick - this.kick));
    this.kick = kick;
    this.side += (this.sideGoal - this.side) * Math.min(1, dt * 10);
    this.clearBodyOffset();
    // A pose that lowers the body (`lift` below 0) crouches on planted
    // feet: only rising off the field takes the legs off the ground.
    if (planted)
      this.plantFeet(
        dt,
        drop + flyY + Math.max(0, lift),
        claimed,
        amp,
        walk,
        moving,
        cycle,
      );
  }

  /** Advance the walk cycle (two steps): by the distance covered, and by
   *  the clock while a foot that was in the air when the troop stopped
   *  finishes its step. */
  private advance(moved: number, dt: number, own: number) {
    const g = this.gait;
    const L = this.legs!.length * this.scale;
    const step = stepLength(
      g,
      L,
      Math.max(this.speed, own * 0.5),
      own,
      this.tempo,
    );
    this.cycleLength = 2 * step;
    const TAU = Math.PI * 2;
    if (moved > 0.0005) {
      this.phase += (moved / this.cycleLength) * TAU;
      if (this.speed > own * 0.3) this.rate = this.speed / this.cycleLength;
      return;
    }
    const duty = dutyFactor(g);
    const u = (((this.phase / TAU) % 1) + 1) % 1;
    for (const [side, uLeg] of [
      ['L', u],
      ['R', (u + 0.5) % 1],
    ] as const) {
      const f = this.feet[side];
      if (!f.air || f.timed || uLeg < duty) continue;
      const left = 1 - uLeg + 1e-4;
      this.phase += Math.min(left, dt * Math.max(0.9, this.rate) * 1.4) * TAU;
      break;
    }
  }

  /** Turn the planted feet about the troop by `turn` (radians). */
  private pivotFeet(turn: number) {
    if (!turn) return;
    const cos = Math.cos(turn);
    const sin = Math.sin(turn);
    const { x: cx, z: cz } = this.position;
    for (const f of [this.feet.L, this.feet.R]) {
      const x = f.x - cx;
      const z = f.z - cz;
      f.x = cx + x * cos + z * sin;
      f.z = cz - x * sin + z * cos;
      f.yaw += turn;
      const fx = f.fromX - cx;
      const fz = f.fromZ - cz;
      f.fromX = cx + fx * cos + fz * sin;
      f.fromZ = cz - fx * sin + fz * cos;
      f.fromYaw += turn;
    }
  }

  /** The figure's own units → world, for the body as it will be drawn
   *  with the pelvis at `bodyY`. */
  private bodyMatrix(bodyY: number) {
    const facing = this.facing ?? 0;
    const { model } = this.kit;
    const sin = Math.sin(facing);
    const cos = Math.cos(facing);
    tmpP.set(
      this.position.x - sin * this.lunge + cos * this.side,
      this.position.y + bodyY,
      this.position.z - cos * this.lunge - sin * this.side,
    );
    tmpE.set(-this.pitch, facing + this.yawKick, this.roll, 'YXZ');
    tmpQ.setFromEuler(tmpE);
    const wide = 1 + (1 - this.squash) * 0.6;
    tmpS.set(wide * this.shrink, this.squash * this.shrink, wide * this.shrink);
    tmpM.compose(tmpP, tmpQ, tmpS);
    model.updateMatrix();
    tmpM.multiply(model.matrix);
    tmpInv.copy(tmpM).invert();
    return tmpM;
  }

  /** A strike or a weight shift can use the space left by the engine's
   *  body clearance, but cannot throw the body into the stone. */
  private clearBodyOffset() {
    if (this.flying || !this.buildings.length) return;
    const facing = this.facing ?? 0;
    const dx = -Math.sin(facing) * this.lunge + Math.cos(facing) * this.side;
    const dz = -Math.cos(facing) * this.lunge - Math.sin(facing) * this.side;
    if (Math.abs(dx) + Math.abs(dz) < 1e-6) return;
    const x = this.position.x + 9;
    const y = 16 - this.position.z;
    const radius = troopBuildingRadius(this.card);
    const clear = (fraction: number) =>
      this.buildings.every(
        (t) =>
          t.destroyed ||
          towerGap(t, x + dx * fraction, y - dz * fraction) >=
            Math.min(radius, towerGap(t, x, y)) - 1e-6,
      );
    if (clear(1)) return;
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 10; i++) {
      const mid = (lo + hi) / 2;
      if (clear(mid)) lo = mid;
      else hi = mid;
    }
    this.lunge *= lo;
    this.side *= lo;
  }

  /** Finish the ground IK against the actual foot geometry. A hasted
   *  swing, a turn or a claimed attack pose can extend beyond the body's
   *  gameplay radius; only the contacting leg shortens its step. The
   *  ankle keeps its pitch and heading and the body stays on its path. */
  private clearFeet(deploying = false) {
    const legs = this.collisionLegs;
    if (!legs || !this.buildings.length || this.shrink < 0.5) return;
    const x = this.position.x + 9;
    const y = 16 - this.position.z;
    // Most troops have no nearby stone. Bounds and IK are paid only at
    // contact, not for every walking figure on every frame.
    if (!this.buildings.some((t) => !t.destroyed && towerGap(t, x, y) < 3.5))
      return;
    this.placeBody();
    this.kit.group.updateMatrixWorld(true);
    this.clearTorso();
    if (this.card === 'ogre') {
      this.clearHead();
      this.clearTorso();
    }
    this.clearArms(deploying);
    for (const side of ['L', 'R'] as const) {
      const surfaces = legs[side].surfaces;
      const nearby = surfaces.some((surface) => {
        surfaceBroadBounds(surface, box);
        return this.buildings.some((t) => {
          if (t.destroyed) return false;
          const half = towerFootprint[t.kind].half + 0.008;
          return !(
            box.min.x + 9 > t.x + half ||
            box.max.x + 9 < t.x - half ||
            16 - box.max.z > t.y + half ||
            16 - box.min.z < t.y - half
          );
        });
      });
      if (!nearby) continue;
      const foot = this.kit.rig[`foot${side}`]!.node;
      wallStart.setFromMatrixPosition(foot.matrixWorld);
      foot.getWorldQuaternion(wallFootRotation);
      let corrected = false;
      for (let pass = 0; pass < 8; pass++) {
        // A blended ankle deforms as its knee and foot turn. Rebuild only
        // the skinned subset's foot-local box in the current connected pose.
        tmpInv.copy(foot.matrixWorld).invert();
        for (let i = 0; i < surfaces.length; i++) {
          const surface = surfaces[i];
          if (!surface.indices) continue;
          tmpM.copy(tmpInv).multiply(surface.mesh.matrixWorld);
          posedSurfaceBounds(surface, box, tmpM);
          for (let j = 0; j < 8; j++)
            legs[side].corners[i * 8 + j].set(
              j & 1 ? box.max.x : box.min.x,
              j & 2 ? box.max.y : box.min.y,
              j & 4 ? box.max.z : box.min.z,
            );
        }
        let contact: Tower | undefined;
        let gap = 0.008;
        let cx = 0;
        let cy = 0;
        const check = (t: Tower, fx: number, fy: number) => {
          const d = towerGap(t, fx, fy);
          if (d >= gap) return;
          gap = d;
          contact = t;
          cx = fx;
          cy = fy;
        };
        const corners = legs[side].corners;
        for (let boxAt = 0; boxAt < corners.length; boxAt += 8) {
          let minX = Infinity;
          let minY = Infinity;
          let maxX = -Infinity;
          let maxY = -Infinity;
          for (let j = 0; j < 8; j++) {
            wallPoint.copy(corners[boxAt + j]).applyMatrix4(foot.matrixWorld);
            const fx = wallPoint.x + 9;
            const fy = 16 - wallPoint.z;
            wallCorners[j * 2] = fx;
            wallCorners[j * 2 + 1] = fy;
            minX = Math.min(minX, fx);
            minY = Math.min(minY, fy);
            maxX = Math.max(maxX, fx);
            maxY = Math.max(maxY, fy);
          }
          for (const t of this.buildings) {
            if (t.destroyed) continue;
            const { half, corner } = towerFootprint[t.kind];
            if (
              minX > t.x + half + 0.008 ||
              maxX < t.x - half - 0.008 ||
              minY > t.y + half + 0.008 ||
              maxY < t.y - half - 0.008
            )
              continue;
            for (let j = 0; j < 8; j++)
              check(t, wallCorners[j * 2], wallCorners[j * 2 + 1]);
            // A curved wall can enter a foot between two clear corners.
            // Check the closest point on each projected box edge to the
            // tower's four corner centres as well as its eight vertices.
            const core = half - corner;
            for (let j = 0; j < 8; j++)
              for (const bit of [1, 2, 4]) {
                if (j & bit) continue;
                const ax = wallCorners[j * 2];
                const ay = wallCorners[j * 2 + 1];
                const bx = wallCorners[(j | bit) * 2];
                const by = wallCorners[(j | bit) * 2 + 1];
                const ex = bx - ax;
                const ey = by - ay;
                const length2 = ex * ex + ey * ey;
                if (length2 < 1e-12) continue;
                for (const sx of [-1, 1])
                  for (const sy of [-1, 1]) {
                    const u = clamp01(
                      ((t.x + sx * core - ax) * ex +
                        (t.y + sy * core - ay) * ey) /
                        length2,
                    );
                    check(t, ax + ex * u, ay + ey * u);
                  }
              }
          }
        }
        if (!contact) break;
        const [nx, ny] = towerNormal(contact, cx, cy);
        wallAnkle.setFromMatrixPosition(foot.matrixWorld);
        wallTarget.copy(wallAnkle);
        wallTarget.x += nx * (0.008 - gap);
        wallTarget.z -= ny * (0.008 - gap);
        this.solveFootContact(side);
        corrected = true;
      }
      if (!corrected) continue;
      // Keep a planted foot where the contact solver put it, rather than
      // asking the next frame to push the same long step into the wall.
      wallAnkle.setFromMatrixPosition(foot.matrixWorld);
      const f = this.feet[side];
      if (f.planted && !f.air) {
        f.x += wallAnkle.x - wallStart.x;
        f.z += wallAnkle.z - wallStart.z;
      }
      for (const part of [
        `leg${side}`,
        `knee${side}`,
        `foot${side}`,
      ] as const) {
        const rig = this.kit.rig[part]!;
        const at = PART_INDEX[part] * CHANNELS;
        for (const [i, axis] of ['x', 'y', 'z'].entries()) {
          const a =
            rig.node.rotation[axis as 'x' | 'y' | 'z'] -
            rig.rest[axis as 'x' | 'y' | 'z'];
          this.pose[at + i] = this.goal[at + i] = a;
          this.vel[at + i] = 0;
        }
      }
    }
  }

  /** Keep the chest and coat out of stone too: upper-body lean can cross
   *  the footprint even when the hips and feet are clear. At contact the
   *  toy straightens or leans a few degrees away, with no path offset. */
  private clearTorso() {
    const surfaces = figureSurfaces(
      this.kit.model,
      this.kit.model.name,
      'torso',
    );
    for (let pass = 0; pass < 5; pass++) {
      let contact: Tower | undefined;
      let gap = 0.008;
      let cx = 0;
      let cy = 0;
      let height = 1;
      for (const surface of surfaces) {
        const { mesh, indices } = surface;
        surfaceBroadBounds(surface, box);
        for (const t of this.buildings) {
          if (t.destroyed) continue;
          const half = towerFootprint[t.kind].half;
          if (
            box.min.x + 9 > t.x + half + gap ||
            box.max.x + 9 < t.x - half - gap ||
            16 - box.max.z > t.y + half + gap ||
            16 - box.min.z < t.y - half - gap
          )
            continue;
          const vertices = mesh.geometry.attributes.position;
          for (let i = 0; i < (indices?.length ?? vertices.count); i++) {
            mesh
              .getVertexPosition(indices?.[i] ?? i, wallPoint)
              .applyMatrix4(mesh.matrixWorld);
            const fx = wallPoint.x + 9;
            const fy = 16 - wallPoint.z;
            const d = towerGap(t, fx, fy);
            if (d >= gap) continue;
            gap = d;
            contact = t;
            cx = fx;
            cy = fy;
            height = Math.max(0.4, wallPoint.y - this.position.y - this.bodyY);
          }
        }
      }
      if (!contact) break;
      const [nx, ny] = towerNormal(contact, cx, cy);
      const yaw = (this.facing ?? 0) + this.yawKick;
      const lean = Math.min(0.06, (0.009 - gap) / height);
      this.pitch -= (nx * Math.sin(yaw) - ny * Math.cos(yaw)) * lean;
      this.roll -= (nx * Math.cos(yaw) + ny * Math.sin(yaw)) * lean;
      this.placeBody();
      this.kit.group.updateMatrixWorld(true);
    }
  }

  private headSurfaces() {
    return figureSurfaces(this.kit.model, this.kit.model.name, 'head');
  }

  /** Retain the two planted soles through the Viking's full body turn.
   *  Only the contacting leg's IK changes; the sculpt and path stay fixed. */
  private clearVikingBoots() {
    if (!this.collisionLegs || this.shrink < 0.5) return;
    this.placeBody();
    this.kit.group.updateMatrixWorld(true);
    const modelInverse = this.kit.model.matrixWorld.clone().invert();
    const localFootMatrix = new THREE.Matrix4();
    for (const side of ['L', 'R'] as const) {
      const foot = this.kit.rig[`foot${side}`]!.node;
      const soleRotation = new THREE.Quaternion();
      localFootMatrix
        .copy(modelInverse)
        .multiply(foot.matrixWorld)
        .decompose(tmpP, soleRotation, tmpS);
      let corrected = false;
      for (let pass = 0; pass < 5; pass++) {
        const lift = vikingSolePenetration(foot, standHeight);
        if (lift < 1e-6) break;
        foot.getWorldQuaternion(wallFootRotation);
        wallTarget.setFromMatrixPosition(foot.matrixWorld);
        wallTarget.y += lift + 0.002;
        this.solveFootContact(side);
        // Preserve sole orientation before the portrait's anisotropic
        // figure scale. A world-quaternion decomposition under that scale
        // can shear the rolled sole as its knee bends.
        localFootMatrix
          .copy(modelInverse)
          .multiply(foot.parent!.matrixWorld)
          .decompose(tmpP, wallParentRotation, tmpS);
        foot.quaternion
          .copy(wallParentRotation.invert())
          .multiply(soleRotation);
        foot.updateWorldMatrix(false, true);
        corrected = true;
      }
      if (!corrected) continue;
      for (const part of [
        `leg${side}`,
        `knee${side}`,
        `foot${side}`,
      ] as const) {
        const rig = this.kit.rig[part]!;
        const at = PART_INDEX[part] * CHANNELS;
        for (const [i, axis] of ['x', 'y', 'z'].entries()) {
          const angle =
            rig.node.rotation[axis as 'x' | 'y' | 'z'] -
            rig.rest[axis as 'x' | 'y' | 'z'];
          this.pose[at + i] = this.goal[at + i] = angle;
          this.vel[at + i] = 0;
        }
      }
    }
  }

  /** Keep sandals, boots and their blended toes above ground during turns.
   *  Correct only the contacting leg, retaining the authored sole heading. */
  private clearWeightedSoles() {
    const legs = this.collisionLegs;
    if (!legs || this.shrink < 0.5) return;
    this.placeBody();
    this.kit.group.updateMatrixWorld(true);
    const modelInverse = this.kit.model.matrixWorld.clone().invert();
    const localFootMatrix = new THREE.Matrix4();
    for (const side of ['L', 'R'] as const) {
      const foot = this.kit.rig[`foot${side}`]!.node;
      const soleRotation = new THREE.Quaternion();
      localFootMatrix
        .copy(modelInverse)
        .multiply(foot.matrixWorld)
        .decompose(tmpP, soleRotation, tmpS);
      let corrected = false;
      for (let pass = 0; pass < 5; pass++) {
        const lift = gladiatorSolePenetration(legs[side].surfaces, standHeight);
        if (lift < 1e-6) break;
        foot.getWorldQuaternion(wallFootRotation);
        wallTarget.setFromMatrixPosition(foot.matrixWorld);
        wallTarget.y += lift + 0.002;
        this.solveFootContact(side);
        localFootMatrix
          .copy(modelInverse)
          .multiply(foot.parent!.matrixWorld)
          .decompose(tmpP, wallParentRotation, tmpS);
        foot.quaternion
          .copy(wallParentRotation.invert())
          .multiply(soleRotation);
        foot.updateWorldMatrix(false, true);
        corrected = true;
      }
      if (!corrected) continue;
      for (const part of [
        `leg${side}`,
        `knee${side}`,
        `foot${side}`,
      ] as const) {
        const rig = this.kit.rig[part]!;
        const at = PART_INDEX[part] * CHANNELS;
        for (const [i, axis] of ['x', 'y', 'z'].entries()) {
          const angle =
            rig.node.rotation[axis as 'x' | 'y' | 'z'] -
            rig.rest[axis as 'x' | 'y' | 'z'];
          this.pose[at + i] = this.goal[at + i] = angle;
          this.vel[at + i] = 0;
        }
      }
    }
  }

  /** Project the next arm target before the springs carry it into stone.
   *  Current poses still receive the final contact check below. */
  private anticipateArmContact(u: Unit) {
    if (this.card !== 'sumo') return;
    const x = this.position.x + 9;
    const y = 16 - this.position.z;
    if (!this.buildings.some((t) => !t.destroyed && towerGap(t, x, y) < 3.5))
      return;
    this.begin();
    this.apply(this.goal);
    this.placeBody();
    this.kit.group.updateMatrixWorld(true);
    const dx = u.x - u.px;
    const dy = u.y - u.py;
    // Engine yaw eases towards the walking direction. Prepare the arms
    // for that direction while the body is still turning beside stone.
    const pending =
      u.state === 'walking' && Math.hypot(dx, dy) > 1e-5
        ? -Math.atan2(dx, dy)
        : -u.facing;
    this.clearArms(u.state === 'deploying', true, pending);
  }

  /** Beside stone the wrestler folds only the contacting arm into a
   *  forward palm guard. Shoulder, elbow and wrist keep their anatomical
   *  attachments. A rear shoulder coil keeps a positive elbow flex when
   *  stone is ahead; the forward palm guard fits beside or behind stone.
   *  The closest clear target preserves the authored strike and springs. */
  private clearArms(
    deploying: boolean,
    predictive = false,
    pendingFacing = this.facing ?? 0,
  ) {
    if (this.card !== 'sumo') return;
    let turn = pendingFacing - (this.facing ?? 0);
    while (turn > Math.PI) turn -= Math.PI * 2;
    while (turn < -Math.PI) turn += Math.PI * 2;
    // A friendly facade can move from ahead to beside the palm during a
    // turn. Pick a guard for that sweep before the springs enter stone.
    const turns =
      predictive && Math.abs(turn) > 0.03 ? [turn, turn / 2, 0] : [0];
    for (const side of ['L', 'R'] as const) {
      let clearance = predictive ? 0.18 : 0.04;
      const arm = this.kit.rig[`arm${side}`];
      const fore = this.kit.rig[`fore${side}`];
      const hand = this.kit.rig[`hand${side}`];
      if (!arm || !fore || !hand) continue;
      const surfaces = figureSurfaces(
        this.kit.model,
        this.kit.model.name,
        `arm${side}`,
      );
      const relevant = surfaces.filter((surface) => {
        if (turns.length > 1) return true;
        surfaceBroadBounds(surface, box);
        return this.buildings.some((t) => {
          if (t.destroyed) return false;
          const half = towerFootprint[t.kind].half + clearance;
          return !(
            box.min.x + 9 > t.x + half ||
            box.max.x + 9 < t.x - half ||
            16 - box.max.z > t.y + half ||
            16 - box.min.z < t.y - half
          );
        });
      });
      if (!relevant.length) continue;
      const clearPose = () => {
        for (const surface of surfaces) {
          const reader = contactSurfaceReader(surface);
          reader.refresh();
          for (let i = 0; i < reader.count; i++) {
            reader.read(i, wallPoint);
            // Guard the landing pose throughout the entrance drop. An
            // elevated palm in ordinary play may pass above the coping.
            const height =
              wallPoint.y - (deploying ? Math.max(0, this.bodyY) : 0);
            for (const t of this.buildings) {
              if (t.destroyed) continue;
              const above =
                height - (t.kind === 'king' ? 3.825 : 3.525) * this.stoneScale;
              const beside = towerGap(t, wallPoint.x + 9, 16 - wallPoint.z);
              // The footprint prism is a cheap conservative first pass.
              // Its constant width can reject a clear bent palm beside
              // the tapered facade, leaving no usable guard at a corner.
              if (
                Math.max(beside, above) < clearance &&
                towerArmBlocked(
                  t,
                  wallPoint.x,
                  height,
                  wallPoint.z,
                  this.stoneScale,
                  clearance,
                )
              )
                return false;
            }
          }
        }
        return true;
      };
      const clear = () => {
        if (turns.length === 1) return clearPose();
        const body = this.kit.body;
        const yaw = body.rotation.y;
        let safe = true;
        for (const offset of turns) {
          body.rotation.y = yaw + offset;
          // Attached skins refresh bindMatrixInverse in this traversal;
          // updateWorldMatrix would sample the new yaw with the old inverse.
          body.updateMatrixWorld(true);
          if (!clearPose()) {
            safe = false;
            break;
          }
        }
        body.rotation.y = yaw;
        body.updateMatrixWorld(true);
        return safe;
      };
      if (clear()) continue;
      const armBefore = arm.node.rotation.clone();
      const foreBefore = fore.node.rotation.clone();
      const handBefore = hand.node.rotation.clone();
      const sign = side === 'L' ? 1 : -1;
      const blend = (fraction: number, target: SumoArmGuard) => {
        arm.node.rotation.set(
          armBefore.x + (arm.rest.x + target.shoulder - armBefore.x) * fraction,
          armBefore.y + (arm.rest.y - armBefore.y) * fraction,
          armBefore.z +
            (arm.rest.z + sign * target.inward - armBefore.z) * fraction,
        );
        // The forearm's and wrist's roll (a pose turning the palm, see
        // moves/reach.ts) stays: it barely moves the arm, and undoing it
        // in one frame would flip the hand.
        fore.node.rotation.set(
          foreBefore.x + (fore.rest.x + target.elbow - foreBefore.x) * fraction,
          foreBefore.y,
          foreBefore.z + (fore.rest.z - foreBefore.z) * fraction,
        );
        hand.node.rotation.set(
          handBefore.x + (hand.rest.x + target.wrist - handBefore.x) * fraction,
          handBefore.y,
          handBefore.z + (hand.rest.z - handBefore.z) * fraction,
        );
        arm.node.updateWorldMatrix(true, true);
      };
      const at = PART_INDEX[`arm${side}`] * CHANNELS;
      const elbowAt = PART_INDEX[`fore${side}`] * CHANNELS;
      const cost = (target: SumoArmGuard) =>
        Math.pow(this.pose[at] - target.shoulder, 2) +
        Math.pow(this.pose[at + 2] - sign * target.inward, 2) +
        Math.pow(this.pose[elbowAt] - target.elbow, 2);
      let chosen: SumoArmGuard | undefined;
      let best = Infinity;
      const choose = () => {
        for (const target of SUMO_ARM_GUARDS) {
          const distance = cost(target);
          if (distance >= best) continue;
          blend(1, target);
          if (!clear()) continue;
          chosen = target;
          best = distance;
        }
      };
      choose();
      if (!chosen && predictive) {
        // Look-ahead padding must not discard a reviewed guard which
        // already clears the whole turn by the actual contact margin.
        clearance = 0.04;
        choose();
      }
      if (!chosen) {
        arm.node.rotation.copy(armBefore);
        fore.node.rotation.copy(foreBefore);
        hand.node.rotation.copy(handBefore);
        arm.node.updateWorldMatrix(true, true);
        continue;
      }
      let lo = 0;
      let hi = 1;
      for (let i = 0; i < 8; i++) {
        const mid = (lo + hi) / 2;
        blend(mid, chosen);
        if (clear()) hi = mid;
        else lo = mid;
      }
      blend(hi, chosen);
      for (const part of [
        `arm${side}`,
        `fore${side}`,
        `hand${side}`,
      ] as const) {
        const joint = this.kit.rig[part]!;
        const at = PART_INDEX[part] * CHANNELS;
        for (const [i, axis] of ['x', 'y', 'z'].entries()) {
          const angle =
            joint.node.rotation[axis as 'x' | 'y' | 'z'] -
            joint.rest[axis as 'x' | 'y' | 'z'];
          this.goal[at + i] = angle;
          if (!predictive) {
            this.pose[at + i] = angle;
            this.vel[at + i] = 0;
          }
        }
      }
    }
  }

  /** The Dino's deep bite bends chest and neck down together. Beside
   *  stone it rears just enough to keep the chin over the coping while
   *  its jaw still opens and snaps. Free bites keep their full gesture. */
  private clearHead() {
    if (this.card !== 'ogre') return;
    const surfaces = this.headSurfaces();
    const clear = () => {
      for (const surface of surfaces) {
        const { mesh, indices } = surface;
        surfaceBroadBounds(surface, box);
        for (const t of this.buildings) {
          if (t.destroyed) continue;
          const half = towerFootprint[t.kind].half;
          if (
            box.min.y >
              (t.kind === 'king' ? 3.825 : 3.525) * this.stoneScale + 0.008 ||
            box.min.x + 9 > t.x + half ||
            box.max.x + 9 < t.x - half ||
            16 - box.max.z > t.y + half ||
            16 - box.min.z < t.y - half
          )
            continue;
          const vertices = mesh.geometry.attributes.position;
          for (let i = 0; i < (indices?.length ?? vertices.count); i++) {
            mesh
              .getVertexPosition(indices?.[i] ?? i, wallPoint)
              .applyMatrix4(mesh.matrixWorld);
            if (
              towerStoneGap(
                t,
                wallPoint.x,
                wallPoint.y,
                wallPoint.z,
                this.stoneScale,
              ) < 0.008
            )
              return false;
          }
        }
      }
      return true;
    };
    if (clear()) return;
    const head = this.kit.rig.head!;
    const torso = this.kit.rig.torso!;
    const hx = head.node.rotation.x;
    const tx = torso.node.rotation.x;
    const blend = (fraction: number) => {
      head.node.rotation.x =
        head.rest.x + 0.45 * (1 - fraction) + (hx - head.rest.x) * fraction;
      torso.node.rotation.x = torso.rest.x + (tx - torso.rest.x) * fraction;
      torso.node.updateWorldMatrix(true, true);
    };
    blend(0);
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 8; i++) {
      const mid = (lo + hi) / 2;
      blend(mid);
      if (clear()) lo = mid;
      else hi = mid;
    }
    blend(lo);
    for (const part of ['head', 'torso'] as const) {
      const rig = this.kit.rig[part]!;
      const at = PART_INDEX[part] * CHANNELS;
      this.pose[at] = this.goal[at] = rig.node.rotation.x - rig.rest.x;
      this.vel[at] = 0;
    }
  }

  /** A small damped IK correction on the already posed hip/knee. Using
   *  the real transforms also handles the non-uniform portrait scale and
   *  attacks which own a leg. No joint or whole figure is translated. */
  private solveFootContact(side: 'L' | 'R') {
    const foot = this.kit.rig[`foot${side}`]!.node;
    const epsilon = 0.001;
    for (let step = 0; step < 5; step++) {
      foot.updateWorldMatrix(true, false);
      wallAnkle.setFromMatrixPosition(foot.matrixWorld);
      wallError.copy(wallTarget).sub(wallAnkle);
      if (wallError.lengthSq() < 1e-8) break;
      for (let j = 0; j < WALL_JOINTS.length; j++) {
        const [part, axis] = WALL_JOINTS[j];
        const joint = this.kit.rig[`${part}${side}`]!.node;
        joint.rotation[axis] += epsilon;
        foot.updateWorldMatrix(true, false);
        wallProbe.setFromMatrixPosition(foot.matrixWorld);
        wallJacobian[j]
          .copy(wallProbe)
          .sub(wallAnkle)
          .multiplyScalar(1 / epsilon);
        joint.rotation[axis] -= epsilon;
      }
      const [a, b, c] = wallJacobian;
      const damping = 0.002;
      const xx = a.x * a.x + b.x * b.x + c.x * c.x + damping;
      const xy = a.x * a.y + b.x * b.y + c.x * c.y;
      const xz = a.x * a.z + b.x * b.z + c.x * c.z;
      const yy = a.y * a.y + b.y * b.y + c.y * c.y + damping;
      const yz = a.y * a.z + b.y * b.z + c.y * c.z;
      const zz = a.z * a.z + b.z * b.z + c.z * c.z + damping;
      wallMatrix.set(xx, xy, xz, xy, yy, yz, xz, yz, zz).invert();
      wallError.applyMatrix3(wallMatrix);
      for (let j = 0; j < WALL_JOINTS.length; j++) {
        const [part, axis] = WALL_JOINTS[j];
        const joint = this.kit.rig[`${part}${side}`]!.node;
        const delta = wallJacobian[j].dot(wallError);
        joint.rotation[axis] += Math.max(-0.25, Math.min(0.25, delta));
      }
    }
    // The thigh and knee changed; counter their turn at the ankle so a
    // planted sole remains flat and a swinging toe keeps its toe roll.
    foot.parent!.getWorldQuaternion(wallParentRotation);
    foot.quaternion
      .copy(wallParentRotation.invert())
      .multiply(wallFootRotation);
    foot.updateWorldMatrix(true, true);
  }

  /**
   * Feet on the ground. Each foot is planted where it landed and the leg
   * solved onto it (hip, knee, ankle, and a little splay to keep the sole
   * under the hip), so nothing slides: walking, turning on the spot,
   * lunging into a blow, a shove. Walking, the cycle lifts each foot at
   * toe-off and sets it down a half stance ahead of where the hip will be;
   * standing, a foot left too far behind steps back under the body. The
   * heel strikes toe up, the foot rolls flat and peels off the toe. The
   * pelvis sinks if a planted foot would be out of reach (the knee nearly
   * straight at contact, a deeper bend in a lunge).
   */
  private plantFeet(
    dt: number,
    air: number,
    claimed: ReadonlySet<PartName>,
    amp: number,
    walk: number,
    moving: boolean,
    cycle: number,
  ) {
    const legs = this.legs!;
    const g = this.gait;
    const sc = this.scale;
    const L = legs.length * sc;
    const duty = dutyFactor(g);
    const facing = this.facing ?? 0;
    const own = Math.max(0.05, troopCards[this.card].unit.speed);
    // Stopped, a foot still in the air comes down under the body.
    const go = moving ? Math.min(1.4, this.speed / own) : 0;
    // Where the body is going, for the step ahead.
    let dirX = -Math.sin(facing);
    let dirZ = -Math.cos(facing);
    const vLen = Math.hypot(this.velX, this.velZ);
    if (vLen > own * 0.2) {
      dirX = this.velX / vLen;
      dirZ = this.velZ / vLen;
    }
    const grounded = Math.abs(air) < 0.04 * L && this.shrink > 0.5;
    const pose = this.pose;
    const footWide = sc * 1.12;
    // Ankle positions (world) this frame, per side.
    const ankles = this.ankles;
    const pitches = this.pitches;
    this.ikMask = 0;
    this.bodyMatrix(this.bodyY);
    for (const side of ['L', 'R'] as const) {
      const geo = legs[side];
      const f = this.feet[side];
      const other = this.feet[side === 'L' ? 'R' : 'L'];
      const uLeg = side === 'L' ? cycle : (cycle + 0.5) % 1;
      if (
        claimed.has(`leg${side}`) ||
        claimed.has(`knee${side}`) ||
        claimed.has(`foot${side}`) ||
        !grounded
      ) {
        f.planted = false;
        f.air = false;
        this.legFree[side] = 0;
        f.u = uLeg;
        continue;
      }
      // Home: under the hip, the feet a little closer than the hips.
      tmpV
        .set(geo.ankle.x * g.width, geo.ankle.y, geo.ankle.z)
        .applyMatrix4(tmpM);
      // Without the lunge: a blow thrown forward leaves the feet planted.
      const sin = Math.sin(facing);
      const cos = Math.cos(facing);
      const homeX = tmpV.x + sin * this.lunge;
      const homeZ = tmpV.z + cos * this.lunge;
      if (!f.planted) {
        // Down where the leg is now (after a leap, a fall, a braced stance).
        const th = pose[PART_INDEX[`leg${side}`] * CHANNELS];
        const tk = th + pose[PART_INDEX[`knee${side}`] * CHANNELS];
        const { thigh, shin } = geo.shape;
        const y =
          thigh.y * Math.cos(th) -
          thigh.z * Math.sin(th) +
          shin.y * Math.cos(tk) -
          shin.z * Math.sin(tk);
        const z =
          thigh.y * Math.sin(th) +
          thigh.z * Math.cos(th) +
          shin.y * Math.sin(tk) +
          shin.z * Math.cos(tk);
        tmpV.set(geo.ankle.x, geo.hip.y + y, geo.hip.z + z).applyMatrix4(tmpM);
        f.x = tmpV.x;
        f.z = tmpV.z;
        f.y = standHeight(f.x, f.z);
        f.yaw = facing;
        f.planted = true;
        f.air = false;
        f.u = uLeg;
      }
      const prevU = f.u;
      f.u = uLeg;
      const lift = (timed: boolean, k0: number) => {
        f.air = true;
        f.timed = timed;
        f.k = k0;
        f.k0 = k0;
        f.fromX = f.x;
        f.fromY = f.y;
        f.fromZ = f.z;
        f.fromYaw = f.yaw;
      };
      // (A frame without time, a pause or a redraw, changes nothing.)
      if (!f.air && dt > 0) {
        if (walk > 0.05 && uLeg >= duty)
          lift(false, (uLeg - duty) / (1 - duty));
        else if (walk < 0.3 && !other.air && other.planted) {
          // Standing: a foot far from under the body, or turned well away
          // from where the body faces, steps back under it.
          const off = Math.hypot(f.x - homeX, f.z - homeZ);
          const twist = Math.abs(wrapAngle(f.yaw - facing));
          if (off > 0.32 * L || twist > 0.75) lift(true, 0);
        }
      }
      // Where the foot is going: a half stance ahead of where the hip
      // will be when it lands, or under the body when it stops.
      let tx = homeX;
      let tz = homeZ;
      // Landed once the cycle wraps round (or slips back into stance).
      const landed = uLeg < prevU - 0.5 || uLeg < duty;
      if (f.air && !f.timed) {
        const left = landed ? 0 : 1 - uLeg;
        const ahead =
          (left * this.cycleLength + duty * this.cycleLength * 0.5) * go;
        tx += dirX * ahead;
        tz += dirZ * ahead;
      }
      let height = 0;
      let q = 0;
      if (f.air) {
        let k: number;
        let travel: number;
        if (f.timed) {
          f.k = Math.min(1, f.k + dt / (0.2 + 0.12 * g.weight));
          k = f.k;
          travel = ease(k);
          height = Math.sin(Math.PI * k) * g.lift * L * 0.55;
          q = -Math.sin(Math.PI * k) * 0.25;
        } else {
          k = landed ? 1 : (uLeg - duty) / (1 - duty);
          f.k = k;
          const s0 = swingCurve(f.k0).travel;
          const sw = swingCurve(k);
          travel = s0 < 1 ? (sw.travel - s0) / (1 - s0) : 1;
          height =
            sw.height *
            g.lift *
            L *
            Math.min(1, 0.35 + amp) *
            (0.6 + 0.4 * strideShare(g, L, own));
          q = footPitch(landed ? 0 : uLeg, duty, g) * Math.min(1, amp * 1.2);
        }
        const ty = standHeight(tx, tz);
        const e = clamp01(travel);
        ankles[side][0] = f.fromX + (tx - f.fromX) * e;
        ankles[side][1] = f.fromY + (ty - f.fromY) * e;
        ankles[side][2] = f.fromZ + (tz - f.fromZ) * e;
        const yaw = f.fromYaw + wrapAngle(facing - f.fromYaw) * e;
        if (k >= 1) {
          f.air = false;
          f.timed = false;
          f.x = tx;
          f.z = tz;
          f.y = ty;
          f.yaw = facing;
        }
        pitches[side] = q;
        this.footYaw[side] = yaw;
      } else {
        q = footPitch(uLeg, duty, g) * Math.min(1, amp * 1.2);
        ankles[side][0] = f.x;
        ankles[side][1] = f.y;
        ankles[side][2] = f.z;
        pitches[side] = q;
        this.footYaw[side] = f.yaw;
      }
      // Roll heel to toe: the heel stays put while the toe is up, the toe
      // while the heel is up.
      const a = geo.sole * sc;
      const yaw = this.footYaw[side];
      let offF = 0;
      let offU = 0;
      if (q > 0) {
        const hb = geo.heel * footWide;
        offF = hb * Math.cos(q) - a * Math.sin(q) - hb;
        offU = hb * Math.sin(q) + a * Math.cos(q) - a;
      } else if (q < 0) {
        const tf = geo.toe * footWide;
        offF = -tf * Math.cos(q) - a * Math.sin(q) + tf;
        offU = -tf * Math.sin(q) + a * Math.cos(q) - a;
      }
      ankles[side][0] += -Math.sin(yaw) * offF;
      ankles[side][2] += -Math.cos(yaw) * offF;
      ankles[side][1] += a + offU + height;
      this.legFree[side] = Math.min(1, this.legFree[side] + dt * 7);
    }
    // The pelvis no higher than the planted legs reach, sinking smoothly.
    let reach = Infinity;
    for (const side of ['L', 'R'] as const) {
      const f = this.feet[side];
      if (!f.planted || f.air) continue;
      const geo = legs[side];
      const [x, y, z] = ankles[side];
      tmpV.set(x, y, z).applyMatrix4(tmpInv);
      const { thigh, shin } = geo.shape;
      const R =
        0.992 * (Math.hypot(thigh.y, thigh.z) + Math.hypot(shin.y, shin.z));
      const dz = tmpV.z - geo.hip.z;
      const dx = tmpV.x - geo.ankle.x;
      const h2 = dz * dz + dx * dx;
      const up = tmpV.y + Math.sqrt(Math.max(0, R * R - h2)) - geo.hip.y;
      reach = Math.min(reach, up);
    }
    if (Number.isFinite(reach)) {
      const k = 0.025 * L;
      const sink = smin(0, reach * sc * this.squash, k);
      this.bodyY += Math.max(-0.35 * L, sink);
    }
    this.bodyMatrix(this.bodyY);
    const bodyYaw = facing + this.yawKick;
    for (const side of ['L', 'R'] as const) {
      const f = this.feet[side];
      if (!f.planted) continue;
      const geo = legs[side];
      const [x, y, z] = ankles[side];
      tmpV.set(x, y, z).applyMatrix4(tmpInv);
      const dy = tmpV.y - geo.hip.y;
      const dz = tmpV.z - geo.hip.z;
      const splay = Math.atan2(tmpV.x - geo.ankle.x, -dy);
      const leg = solveLeg(geo.shape, dy, dz);
      const ankle = pitches[side] + this.pitch - leg.hip - leg.knee;
      const turn = Math.max(
        -0.6,
        Math.min(0.6, wrapAngle(this.footYaw[side] - bodyYaw)),
      );
      this.want(`leg${side}`, leg.hip, 0, splay);
      this.want(`knee${side}`, leg.knee);
      this.want(`foot${side}`, ankle, turn, -this.roll - splay);
      this.hipAngles[side] = leg.hip;
      this.ikMask |=
        (1 << PART_INDEX[`leg${side}`]) |
        (1 << PART_INDEX[`knee${side}`]) |
        (1 << PART_INDEX[`foot${side}`]);
    }
  }

  /** Topple over like a knocked toy, bounce once, then vanish in a puff. */
  fade(dt: number) {
    if (this.dying === 0) this.fallFrom = this.bodyY;
    this.dying += dt;
    const t = this.dying;
    if (this.card === 'balloon') {
      // The Balloon loses its air: it sags, tips over to one side and
      // drops, faster as it goes, crashing onto whatever is below.
      const k = clamp01(t / 0.5);
      this.bodyY = this.fallFrom * (1 - k * k * k);
      this.roll = this.fallDir * k * 0.7;
      this.pitch = Math.sin(k * Math.PI) * 0.15;
      this.squash = 1 - k * 0.25;
    } else if (this.flying) {
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
    if (this.card !== 'balloon') this.squash = 1;
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

/** The middle of a part's meshes, in the part's own units. */
function middleOf(node: THREE.Object3D) {
  const box = new THREE.Box3();
  const inverse = node.matrixWorld.clone().invert();
  const local = new THREE.Matrix4();
  node.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry.computeBoundingBox();
    local.multiplyMatrices(inverse, mesh.matrixWorld);
    box.union(mesh.geometry.boundingBox!.clone().applyMatrix4(local));
  });
  return box.isEmpty()
    ? new THREE.Vector3()
    : box.getCenter(new THREE.Vector3());
}

/** Keep the weighted string centre on the brace or moving arrow nock.
 *  Translation belongs to the controller's parent frame, including the
 *  tower's turn and the figure's nonuniform screen scale. */
class TowerStringContact {
  private readonly rest: THREE.Vector3;
  private readonly current = new THREE.Vector3();
  private readonly brace = new THREE.Vector3();
  private readonly nock = new THREE.Vector3();
  private readonly target = new THREE.Vector3();
  private readonly offset = new THREE.Vector3();

  static bind(model: THREE.Object3D) {
    const raw = model.userData.bowStringMarkers;
    if (!raw) return undefined; // The legacy guard has no string controls.
    const markers = (typeof raw === 'string' ? JSON.parse(raw) : raw) as Record<
      'controller' | 'centre' | 'brace' | 'nock',
      string
    >;
    const node = (name: string) => {
      const full = name.startsWith(model.name) ? name : `${model.name}.${name}`;
      const found =
        find(model, full) ??
        find(model, THREE.PropertyBinding.sanitizeNodeName(full));
      if (!found) throw new Error(`Missing tower string node ${full}`);
      return found;
    };
    return new TowerStringContact(
      node(markers.controller),
      node(markers.centre),
      node(markers.brace),
      node(markers.nock),
    );
  }

  constructor(
    private readonly controller: THREE.Object3D,
    private readonly centreNode: THREE.Object3D,
    private readonly braceNode: THREE.Object3D,
    private readonly nockNode: THREE.Object3D,
  ) {
    if (!controller.parent) throw new Error('String controller has no parent');
    this.rest = controller.position.clone();
  }

  reset() {
    this.controller.position.copy(this.rest);
  }

  follow(raise: number, kick: number) {
    // Acquire late in the raise. Stay at the nock while the arrow is
    // visible, then return to the brace as the release hides it.
    const amount =
      ease(clamp01((raise - 0.7) / 0.25)) *
      (1 - ease(clamp01((kick - 0.25) / 0.75)));
    const parent = this.controller.parent!;
    parent.updateWorldMatrix(true, true);
    this.centreNode.getWorldPosition(this.current);
    this.braceNode.getWorldPosition(this.brace);
    this.nockNode.getWorldPosition(this.nock);
    this.target.lerpVectors(this.brace, this.nock, amount);
    this.offset.copy(this.target);
    parent.worldToLocal(this.offset);
    parent.worldToLocal(this.current);
    this.controller.position.add(this.offset.sub(this.current));
    this.controller.updateWorldMatrix(false, true);
  }
}

/** The Cadet on top of a small tower and the king's cannon. */
export class TowerCrew {
  private guard?: { kit: Kit; ids: number[]; spot: THREE.Object3D };
  private aim = 0;
  private raise = 0;
  private recoil = 0;
  /** How far the king's cannon has risen out of its deck: hidden while
   *  the king sleeps, it springs up when the king wakes. */
  private rise = 0;
  private risen = 0;
  /** The nocked arrow's middle (world), while the archer holds one, and
   *  where that is on the arrow (its own units). */
  private nock = new THREE.Vector3();
  private muzzle = new THREE.Vector3();
  private nocked = false;
  private arrowMid?: THREE.Vector3;
  private m = new THREE.Matrix4();
  private turn = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private xAxis = new THREE.Vector3(1, 0, 0);
  private yAxis = new THREE.Vector3(0, 1, 0);

  constructor(
    private world: ArenaWorld,
    private troops: TroopRenderer,
    private tower: Tower,
    team: Team,
  ) {
    const view = world.towers.get(tower.id);
    this.rise = this.risen = tower.active ? 1 : 0;
    if (view?.guardSpot) {
      // The longbow archer figure, or a Cadet before it is built.
      const kit = troops.kit(troops.built('guard') ? 'guard' : 'archers', team);
      this.guard = { kit, ids: troops.add(kit, false), spot: view.guardSpot };
    }
  }

  shot() {
    this.recoil = 1;
  }

  /** Where the archer's arrow leaves from: the one on the bow just before
   *  it is loosed. */
  bow() {
    if (this.nocked) return this.nock;
    const barrel = this.world.towers.get(this.tower.id)?.barrel;
    // The barrel points down local -z; its bore ends 0.633 from its pivot.
    return barrel
      ? this.muzzle.set(0, 0, -0.633).applyMatrix4(barrel.matrixWorld)
      : null;
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
      kit.towerString?.reset();
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
      applyFace(
        kit.face,
        facePose({
          id: 'guard',
          seed: t.id,
          time,
          aim: this.raise,
          wind: this.raise * (1 - kick),
          strike: kick,
          hurt: 0,
          look: (1 - this.raise) * Math.sin(time * 0.5 + t.id) * 0.35,
          reduced: this.troops.reducedMotion,
        }),
      );
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
      if (kit.towerString) {
        kit.group.updateMatrixWorld(true);
        kit.towerString.follow(this.raise, kick);
      }
      this.troops.write(kit, ids);
      // A skin remains in the scene at this tower's matrix. A shared
      // rigid kit can resume automatic transforms after its batch write.
      kit.group.matrixAutoUpdate = !kit.direct;
      // Both towers share a source kit, with their own posed skin copies.
      // Cache this one's arrow origin after its matrices are written.
      const arrow = draw ? g.arrow?.node : undefined;
      if (arrow && kick <= 0.25) {
        this.arrowMid ??= middleOf(arrow);
        this.nock.copy(this.arrowMid).applyMatrix4(arrow.matrixWorld);
        this.nocked = true;
      }
    }
    if (view.cannon) {
      // Rising takes about two thirds of a second and overshoots a little.
      this.risen = Math.min(
        1,
        Math.max(0, this.risen + (t.active ? dt : -dt) * 1.6),
      );
      const r = this.risen;
      this.rise = r >= 1 ? 1 : 1 + 2.7 * (r - 1) ** 3 + 1.7 * (r - 1) ** 2;
      const cannon = view.cannon;
      cannon.visible = this.rise > 0.01;
      cannon.position.y = KING_CANNON.y - (1 - Math.min(1, this.rise)) * 0.9;
      cannon.scale.setScalar(KING_CANNON.size * Math.max(0.01, this.rise));
      cannon.rotation.y = this.aim;
      if (view.barrel) {
        view.barrel.rotation.x = this.recoil * 0.15;
        view.barrel.position.z = this.recoil * 0.12;
      }
      cannon.updateMatrixWorld(true);
    }
  }

  dispose() {
    if (this.guard) this.troops.remove(this.guard.kit, this.guard.ids);
    this.guard = undefined;
  }
}
