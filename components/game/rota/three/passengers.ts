import * as THREE from 'three';
import {
  PASSENGERS_MAX,
  groundAt,
  type Walker,
} from '@/lib/games/rota/passengers';
import type { QualityTier } from '@/lib/games/rota/quality';
import {
  box,
  clothes,
  coat,
  hand,
  head,
  headscarves,
  makeContactMaterial,
  makeScarfMaterial,
  merge,
  shoe,
  sleeve,
  trouser,
} from './people';
import { toon } from './materials';

/**
 * Rota's station passengers, drawn (motion: lib/games/rota/passengers.ts).
 * They share the residents' authored anatomy (coats shaped from hem to
 * shoulder, heads with jaw and brow planes, caps and headscarves), drawn
 * at true size so they fit the cars' and carriages' doors: legs solve for
 * planted feet on the kerbs, steps, bank and platforms; a passenger
 * ducking out of a car's doorway bends at the hips and knees as it rises;
 * a suitcase hangs from a straight arm, a parcel is carried in front.
 */

const BAG = '#6d4a33';
const STRAP = '#c9a46a';
const PARCEL = '#b89a6a';

function suitcase() {
  return merge([
    box(0.0105, 0.0128, 0.0046, 0, -0.0072, 0, BAG),
    box(0.0109, 0.0014, 0.005, 0, -0.0072, 0, STRAP),
    box(0.0036, 0.0016, 0.0012, 0, -0.0005, 0, '#3a2a20'),
  ]);
}
function parcel() {
  return merge([
    box(0.0105, 0.0072, 0.0078, 0, 0, 0, PARCEL),
    box(0.0107, 0.0074, 0.0009, 0, 0, 0, '#7a5f3e'),
    box(0.0009, 0.0074, 0.008, 0, 0, 0, '#7a5f3e'),
  ]);
}

export class PassengerFigures {
  readonly group = new THREE.Group();
  private readonly meshes: THREE.InstancedMesh[] = [];
  private readonly material = toon('#ffffff', { vertexColors: true });
  private readonly scarfMaterial = makeScarfMaterial();
  private readonly contactMaterial = makeContactMaterial();
  private readonly body: THREE.InstancedMesh[] = [];
  private readonly heads: THREE.InstancedMesh[] = [];
  private readonly scarves: THREE.InstancedBufferAttribute;
  private readonly upperArm: THREE.InstancedMesh;
  private readonly lowerArm: THREE.InstancedMesh;
  private readonly upperLeg: THREE.InstancedMesh;
  private readonly lowerLeg: THREE.InstancedMesh;
  private readonly shoes: THREE.InstancedMesh;
  private readonly hands: THREE.InstancedMesh;
  private readonly cases: THREE.InstancedMesh;
  private readonly parcels: THREE.InstancedMesh;
  private readonly contact: THREE.InstancedMesh;
  private readonly matrix = new THREE.Matrix4();
  private readonly position = new THREE.Vector3();
  private readonly rotation = new THREE.Euler();
  private readonly quaternion = new THREE.Quaternion();
  private readonly scale = new THREE.Vector3();
  private readonly colour = new THREE.Color();
  private max = PASSENGERS_MAX;

  constructor() {
    this.group.name = 'rota-station-passengers';
    const n = PASSENGERS_MAX;
    for (let i = 0; i < 3; i++) {
      this.body.push(this.batch(coat(i), n, `coat-${i}`, true));
      this.heads.push(
        this.batch(
          head(i),
          n,
          `head-${i}`,
          false,
          i === 1 ? this.scarfMaterial : this.material,
        ),
      );
    }
    this.scarves = new THREE.InstancedBufferAttribute(
      new Float32Array(n * 3),
      3,
    );
    this.heads[1].geometry.setAttribute('aScarfTint', this.scarves);
    this.upperArm = this.batch(sleeve(false), n * 2, 'upper-sleeves');
    this.lowerArm = this.batch(sleeve(true), n * 2, 'cuffs');
    this.upperLeg = this.batch(trouser(false), n * 2, 'thighs');
    this.lowerLeg = this.batch(trouser(true), n * 2, 'shins');
    this.shoes = this.batch(shoe(), n * 2, 'shoes');
    this.hands = this.batch(hand(), n * 2, 'hands');
    this.cases = this.batch(suitcase(), n, 'suitcases', true);
    this.parcels = this.batch(parcel(), n, 'parcels', true);
    this.contact = this.batch(
      new THREE.PlaneGeometry(0.028, 0.038).rotateX(-Math.PI / 2),
      n,
      'contact-shadow',
      false,
      this.contactMaterial,
    );
    this.contact.receiveShadow = false;
    this.contact.renderOrder = 1;
    for (const m of this.meshes) m.count = 0;
  }

  private batch(
    g: THREE.BufferGeometry,
    count: number,
    name: string,
    shadows = false,
    material: THREE.Material = this.material,
  ) {
    const mesh = new THREE.InstancedMesh(g, material, count);
    mesh.name = `rota-passengers-${name}`;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    mesh.castShadow = shadows;
    mesh.receiveShadow = true;
    this.meshes.push(mesh);
    this.group.add(mesh);
    return mesh;
  }

  setQuality(tier: QualityTier) {
    this.max = tier === 'low' ? 16 : tier === 'balanced' ? 28 : PASSENGERS_MAX;
    for (const b of this.body) b.castShadow = tier !== 'low';
  }

  private place(
    mesh: THREE.InstancedMesh,
    index: number,
    w: Walker,
    x = 0,
    y = 0,
    z = 0,
    rx = 0,
    ry = 0,
    rz = 0,
  ) {
    const q = w.size,
      c = Math.cos(w.heading),
      s = Math.sin(w.heading);
    this.position.set(
      w.x + (x * c + z * s) * q,
      w.y + y * q,
      w.z + (-x * s + z * c) * q,
    );
    this.rotation.set(rx, w.heading + ry, rz, 'YXZ');
    this.quaternion.setFromEuler(this.rotation);
    this.scale.set(q, q, q);
    this.matrix.compose(this.position, this.quaternion, this.scale);
    mesh.setMatrixAt(index, this.matrix);
  }

  /** A limb between two joints in the walker's sagittal plane. */
  private bone(
    mesh: THREE.InstancedMesh,
    index: number,
    w: Walker,
    x: number,
    y: number,
    z: number,
    endY: number,
    endZ: number,
    width: number,
    depth: number,
  ) {
    const c = Math.cos(w.heading),
      s = Math.sin(w.heading),
      dy = endY - y,
      dz = endZ - z,
      length = Math.hypot(dy, dz) || 1e-8,
      ny = dy / length,
      nz = dz / length,
      q = w.size;
    this.matrix.set(
      c * width * q,
      s * dz * q,
      s * ny * depth * q,
      w.x + (x * c + z * s) * q,
      0,
      dy * q,
      -nz * depth * q,
      w.y + y * q,
      -s * width * q,
      c * dz * q,
      c * ny * depth * q,
      w.z + (-x * s + z * c) * q,
      0,
      0,
      0,
      1,
    );
    mesh.setMatrixAt(index, this.matrix);
  }

  /** The ground under a point ahead of (or behind) a walker, relative to
   *  its own height: kerbs, steps and the platform edge. Inside a vehicle
   *  the floor it stands on. */
  private terrain(w: Walker, forward: number) {
    const x = w.x + Math.sin(w.heading) * forward * w.size,
      z = w.z + Math.cos(w.heading) * forward * w.size;
    const g = groundAt(w.stub, x, z) - w.y;
    return Math.abs(g) > 0.02 ? 0 : g / w.size;
  }

  draw(walkers: readonly Walker[]) {
    const slots = [0, 0, 0];
    let i = 0,
      cases = 0,
      parcels = 0;
    for (const w of walkers) {
      if (i >= this.max) break;
      if (!w.visible) continue;
      const style = w.style;
      const slot = slots[style]++;
      const phase = w.phase * Math.PI * 2,
        moving = w.motion,
        duck = w.crouch,
        bob = -Math.cos(phase * 2) * moving * 0.00055 - duck * 0.012,
        sway = Math.sin(phase) * moving * 0.025;
      this.colour.set(clothes[w.colour % clothes.length]);
      this.body[style].setColorAt(slot, this.colour);
      if (style === 1) {
        this.colour.set(headscarves[w.id % headscarves.length]);
        this.scarves.setXYZ(slot, this.colour.r, this.colour.g, this.colour.b);
        this.colour.set(clothes[w.colour % clothes.length]);
      }
      this.place(this.contact, i, w, 0, 0.0003);
      // Ducking through a car's doorway: bent at the hips, head low.
      const lean = moving * 0.025 + duck * 0.55;
      this.place(this.body[style], slot, w, 0, bob, 0, lean, 0, sway);
      this.place(
        this.heads[style],
        slot,
        w,
        0,
        bob - duck * 0.004,
        duck * 0.012,
        lean * 0.7,
        Math.sin(phase * 0.5) * moving * 0.018,
        sway * 0.4,
      );
      const carrying = w.bag === 1 ? 1 : w.bag === 2 ? 2 : 0;
      for (let side = 0; side < 2; side++) {
        const index = i * 2 + side,
          sign = side === 0 ? -1 : 1,
          p = (w.phase + side * 0.5) % 1;
        let footZ: number,
          lift = 0;
        if (p < 0.6) footZ = w.stride * (0.3 - p);
        else {
          const t = (p - 0.6) / 0.4;
          footZ = w.stride * (-0.3 + 0.6 * t * t * (3 - 2 * t));
          lift = Math.sin(t * Math.PI) * 0.0075;
        }
        footZ *= moving / w.size;
        lift *= moving;
        const terrain = this.terrain(w, footZ),
          hipY = 0.0325 + bob,
          ankleY = 0.0034 + lift + terrain,
          dy = ankleY - hipY,
          distance = Math.min(0.0329, Math.max(0.001, Math.hypot(dy, footZ))),
          along = (0.017 ** 2 - 0.016 ** 2 + distance ** 2) / (2 * distance),
          bend = Math.sqrt(Math.max(0, 0.017 ** 2 - along ** 2)),
          kneeY = hipY + (dy * along) / distance + (footZ * bend) / distance,
          kneeZ = (footZ * along) / distance - (dy * bend) / distance,
          legX = sign * 0.0039;
        this.bone(
          this.upperLeg,
          index,
          w,
          legX,
          hipY,
          0,
          kneeY,
          kneeZ,
          0.0031,
          0.0032,
        );
        this.bone(
          this.lowerLeg,
          index,
          w,
          legX,
          kneeY,
          kneeZ,
          ankleY,
          footZ,
          0.0028,
          0.0028,
        );
        this.place(
          this.shoes,
          index,
          w,
          legX,
          lift + terrain,
          footZ,
          p > 0.6 ? -Math.sin(((p - 0.6) / 0.4) * Math.PI) * 0.25 * moving : 0,
        );
        // Arms: a suitcase hangs from a straight right arm; a parcel is
        // held in front in both hands; otherwise they swing.
        const holdsCase = carrying === 1 && side === 1;
        const shoulderY = 0.0527 + bob,
          swing = holdsCase
            ? Math.sin(phase) * moving * 0.0012
            : Math.sin(phase + side * Math.PI) * moving * 0.006,
          armX = sign * (holdsCase ? 0.0092 : 0.0082),
          wristY =
            carrying === 2
              ? 0.039 + bob
              : holdsCase
                ? 0.0315 + bob
                : 0.0329 + Math.abs(swing) * 0.3 + bob * 0.6,
          wristZ =
            carrying === 2 ? 0.0085 + duck * 0.01 : -swing + duck * 0.014,
          elbowY = carrying === 2 ? 0.043 + bob : (shoulderY + wristY) / 2,
          elbowZ = carrying === 2 ? 0.003 : wristZ * 0.45 + 0.001;
        this.bone(
          this.upperArm,
          index,
          w,
          armX,
          shoulderY,
          duck * 0.008,
          elbowY,
          elbowZ,
          0.003,
          0.003,
        );
        this.bone(
          this.lowerArm,
          index,
          w,
          armX,
          elbowY,
          elbowZ,
          wristY,
          wristZ,
          0.0028,
          0.0028,
        );
        this.place(
          this.hands,
          index,
          w,
          armX,
          wristY + 0.0003,
          wristZ,
          Math.PI,
        );
        if (holdsCase)
          this.place(
            this.cases,
            cases++,
            w,
            armX + 0.0012,
            wristY - 0.001,
            wristZ,
            0,
            Math.PI / 2,
            swing * 3,
          );
      }
      if (carrying === 2)
        this.place(
          this.parcels,
          parcels++,
          w,
          0,
          0.0405 + bob,
          0.0125,
          lean * 0.4,
        );
      i++;
    }
    for (let s = 0; s < 3; s++) {
      this.body[s].count = this.heads[s].count = slots[s];
      const tint = this.body[s].instanceColor;
      if (tint) tint.needsUpdate = true;
    }
    this.scarves.needsUpdate = true;
    this.upperArm.count =
      this.lowerArm.count =
      this.upperLeg.count =
      this.lowerLeg.count =
      this.shoes.count =
      this.hands.count =
        i * 2;
    this.contact.count = i;
    this.cases.count = cases;
    this.parcels.count = parcels;
    for (const m of this.meshes) m.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    for (const mesh of this.meshes) {
      mesh.geometry.dispose();
      mesh.dispose();
    }
    this.material.dispose();
    this.scarfMaterial.dispose();
    this.contactMaterial.dispose();
    this.group.clear();
  }
}
