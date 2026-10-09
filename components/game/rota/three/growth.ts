import * as THREE from 'three';
import type { Lot } from '@/lib/games/rota/growth';
import type { Materials } from './materials';
import type { QualityTier } from '@/lib/games/rota/quality';
import { LanternPools } from './lanterns';
import { Smoke } from './smoke';

/**
 * The growing town, drawn: one InstancedMesh per model part for every
 * building, lamp and yard on the board, rebuilt when the lots change.
 * A building that is new rises out of the ground over half a second (at
 * once under reduced motion or in a snapshot); one that goes is gone.
 */

const RISE = 0.5;

type Slot = { mesh: THREE.InstancedMesh; rel: THREE.Matrix4 };

export class TownLayer {
  readonly group = new THREE.Group();
  private born = new Map<string, number>();
  private lots: Lot[] = [];
  private slots = new Map<string, Slot[]>();
  private rising: { lot: Lot; index: number; key: string }[] = [];
  private m = new THREE.Matrix4();
  private t = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private up = new THREE.Vector3(0, 1, 0);
  private v = new THREE.Vector3();
  private s = new THREE.Vector3();
  private lanterns: LanternPools | null = null;
  private smoke: Smoke | null = null;
  private smokeScale = 600;
  private tier: QualityTier = 'high';

  constructor(
    private models: Map<string, THREE.Object3D>,
    private mats: Materials,
  ) {}

  /** The town's lots; new ones rise from `now` unless `quiet`. */
  set(lots: Lot[], now: number, quiet: boolean) {
    const keys = new Set<string>();
    for (const l of lots) {
      const k = key(l);
      keys.add(k);
      if (!this.born.has(k)) this.born.set(k, quiet ? -10 : now);
    }
    for (const k of this.born.keys()) if (!keys.has(k)) this.born.delete(k);
    this.lots = lots;
    this.rebuild(now);
  }

  private rebuild(now: number) {
    if (this.lanterns) {
      this.group.remove(this.lanterns.mesh);
      this.lanterns.dispose();
      this.lanterns = null;
    }
    if (this.smoke) {
      this.group.remove(this.smoke.points);
      this.smoke.dispose();
      this.smoke = null;
    }
    for (const list of this.slots.values())
      for (const s of list) {
        this.group.remove(s.mesh);
        s.mesh.dispose();
      }
    this.slots.clear();
    this.rising = [];
    const byName = new Map<string, Lot[]>();
    for (const l of this.lots) {
      const list = byName.get(l.name);
      if (list) list.push(l);
      else byName.set(l.name, [l]);
    }
    for (const [name, list] of byName) {
      const src = this.models.get(name);
      if (!src) continue;
      const root = src.clone(true);
      this.mats.dress(root);
      root.position.set(0, 0, 0);
      root.rotation.set(0, 0, 0);
      root.scale.set(1, 1, 1);
      root.updateMatrixWorld(true);
      const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
      const slots: Slot[] = [];
      root.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        const rel = new THREE.Matrix4().multiplyMatrices(inv, mesh.matrixWorld);
        const inst = new THREE.InstancedMesh(
          mesh.geometry,
          mesh.material,
          list.length,
        );
        inst.castShadow = true;
        inst.receiveShadow = true;
        // Instances move as they rise: keep the bounds generous.
        inst.frustumCulled = false;
        slots.push({ mesh: inst, rel });
        this.group.add(inst);
      });
      this.slots.set(name, slots);
      list.forEach((lot, i) => {
        const k = key(lot);
        const age = now - (this.born.get(k) ?? -10);
        if (age < RISE) this.rising.push({ lot, index: i, key: k });
        this.write(slots, i, lot, Math.min(1, Math.max(0, age / RISE)));
      });
      for (const s of slots) s.mesh.instanceMatrix.needsUpdate = true;
    }
    const lamps = this.lots.filter((l) => l.name === 'gas_lamp');
    if (lamps.length) {
      this.lanterns = new LanternPools(lamps, this.mats.dusk);
      this.lanterns.setQuality(this.tier);
      this.group.add(this.lanterns.mesh);
    }
    const stacks = this.lots
      .filter((l) => l.name === 'chimney')
      .map((l) => ({ x: l.x, y: 1, z: l.z }));
    if (stacks.length) {
      this.smoke = new Smoke(stacks);
      this.smoke.setScale(this.smokeScale);
      this.smoke.setQuality(this.tier);
      this.group.add(this.smoke.points);
    }
  }

  private write(slots: Slot[], i: number, lot: Lot, k: number) {
    // Rises out of the ground with a touch of overshoot.
    const e =
      k >= 1 ? 1 : 1 - Math.pow(1 - k, 3) * (1 - 0.6 * Math.sin(k * Math.PI));
    this.q.setFromAxisAngle(this.up, lot.rot);
    this.v.set(lot.x, 0, lot.z);
    this.s.set(1, Math.max(0.001, e), 1);
    this.t.compose(this.v, this.q, this.s);
    for (const s of slots) {
      this.m.multiplyMatrices(this.t, s.rel);
      s.mesh.setMatrixAt(i, this.m);
    }
  }

  tick(now: number) {
    if (!this.rising.length) return;
    let keep = 0;
    for (const r of this.rising) {
      const slots = this.slots.get(r.lot.name);
      if (!slots) continue;
      const age = now - (this.born.get(r.key) ?? -10);
      const k = Math.min(1, Math.max(0, age / RISE));
      this.write(slots, r.index, r.lot, k);
      for (const s of slots) s.mesh.instanceMatrix.needsUpdate = true;
      if (k < 1) this.rising[keep++] = r;
    }
    this.rising.length = keep;
  }

  setSmokeScale(pixels: number) {
    this.smokeScale = pixels;
    this.smoke?.setScale(pixels);
  }

  atmosphere(time: number, dusk: number, fog: THREE.Fog) {
    this.smoke?.tick(time);
    this.smoke?.setDusk(dusk);
    this.smoke?.setFog(fog);
  }

  setQuality(tier: QualityTier) {
    this.tier = tier;
    this.lanterns?.setQuality(tier);
    this.smoke?.setQuality(tier);
  }

  /** Finish every rise at once (snapshots, reduced motion). */
  settle() {
    for (const k of this.born.keys()) this.born.set(k, -10);
    this.rebuild(0);
  }

  dispose() {
    this.lanterns?.dispose();
    this.smoke?.dispose();
    this.lanterns = null;
    this.smoke = null;
    for (const list of this.slots.values())
      for (const s of list) {
        this.group.remove(s.mesh);
        s.mesh.dispose();
      }
    this.slots.clear();
    this.group.clear();
  }
}

const key = (l: Lot) =>
  `${l.name}@${l.x.toFixed(3)},${l.z.toFixed(3)},${l.rot.toFixed(2)}`;
