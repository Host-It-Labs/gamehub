import * as THREE from 'three';
import { RAIL, ROAD, type Route } from '@/lib/games/rota/pieces';
import type { Net } from '@/lib/games/rota/routes';
import {
  TrafficSim,
  type CarPose,
  type Mover,
  type Spec,
} from '@/lib/games/rota/traffic-sim';
import type { Materials } from './materials';
import type { QualityTier } from '@/lib/games/rota/quality';
import { VehicleLights, type VehicleLampRig } from './vehicle-lights';

/**
 * The mill town's traffic, drawn: the motion is `TrafficSim`'s (lib), this
 * seats a model on every pose. Each car rests on its two axles, so it tilts
 * up the ramps of a bridge and down into a cutting; wheels turn with the
 * distance driven. Engines wear the sheet owner's colour. Every train runs
 * top and tail, an engine at each end facing out, so whichever way it
 * goes an engine leads. New vehicles arrive out of sight; one whose road
 * is taken up shrinks away.
 */

const STREET = [
  { model: 'car_retro', weight: 3 },
  { model: 'car_sedan', weight: 2 },
  { model: 'van', weight: 3 },
  { model: 'lorry', weight: 3 },
];
const WAGONS = ['wagon_box', 'wagon_box', 'wagon_tank', 'wagon_logs'];
/** 1950s paint: maroon, bottle green, navy, cream, black, tan, slate. */
const BODY_COLOURS = [
  '#7c2f2b',
  '#2f5040',
  '#26395a',
  '#d9cfb2',
  '#33363b',
  '#94703f',
  '#5a6c78',
  '#a24a32',
];

const WARM_STEPS = 15 * 30;

type Drawn = {
  /** In the mover's order of cars (it reverses when a train runs back). */
  pushed: boolean;
  objects: THREE.Group[];
  wheels: { mesh: THREE.Object3D; r: number; flip: boolean }[][];
  /** Doors that open (car and railcar doors), by name, per car. */
  doors: Map<string, THREE.Object3D>[];
  last: { x: number; z: number }[];
  lamps: (VehicleLampRig | null)[];
  live: number;
};

export class Traffic {
  readonly group = new THREE.Group();
  readonly sim: TrafficSim;
  private drawn = new Map<number, Drawn>();
  private sizes = new Map<string, { length: number; width: number }>();
  private livery: number;
  /** Fast-forward the first network's traffic on the next frame. */
  private warm = false;
  private lights = new VehicleLights();
  private frame = 0;
  /** How far open each door of a standing vehicle is (station calls). */
  doors: (id: number) => { car: Spec; name: string; open: number }[] | null =
    () => null;

  constructor(
    private models: Map<string, THREE.Object3D>,
    private mats: Materials,
    livery: number,
    offscreen: (x: number, z: number) => boolean,
  ) {
    this.livery = livery;
    this.sim = new TrafficSim({
      offscreen,
      make: (kind, rand, long) => this.make(kind, rand, long),
    });
    this.group.add(this.lights.pools);
  }

  setDusk(dusk: number) {
    this.lights.setDusk(dusk);
  }

  setQuality(tier: QualityTier) {
    this.lights.setQuality(tier);
  }

  setLivery(livery: number) {
    if (livery === this.livery) return;
    this.livery = livery;
    // Repaint the engines on the next frame.
    for (const id of this.drawn.keys()) this.drop(id);
  }

  setNetwork(net: Net, stationHalf: (cell: number) => number) {
    // The first network of a board starts with its traffic already about.
    if (!this.sim.movers.length && !this.sim.net) this.warm = true;
    this.sim.setNetwork(net, stationHalf);
  }

  private size(name: string) {
    let s = this.sizes.get(name);
    if (s) return s;
    const src = this.models.get(name);
    if (!src) return null;
    const box = new THREE.Box3().setFromObject(src);
    s = { length: box.max.z - box.min.z, width: box.max.x - box.min.x };
    this.sizes.set(name, s);
    return s;
  }

  private spec(name: string): Spec | null {
    const s = this.size(name);
    return s ? { model: name, ...s } : null;
  }

  private make(kind: Route, rand: () => number, long: boolean): Spec[] | null {
    if (kind === ROAD) {
      const pool = long ? [...STREET, { model: 'bus', weight: 1.5 }] : STREET;
      let r = rand() * pool.reduce((s, p) => s + p.weight, 0);
      let name = pool[0].model;
      for (const p of pool) {
        r -= p.weight;
        if (r <= 0) {
          name = p.model;
          break;
        }
      }
      const s = this.spec(name);
      return s ? [s] : null;
    }
    if (kind !== RAIL) return null;
    // A two-car diesel railcar for the passengers, cab at each end ...
    const dmu = this.spec('dmu_car');
    if (dmu && rand() < 0.55) return [dmu, { ...dmu, flip: true }];
    // ... or a wagon or two between a pair of engines; a short goods train
    // on a line that runs through.
    const loco = this.spec(long || rand() < 0.6 ? 'loco_steam' : 'loco_diesel');
    if (!loco) return null;
    // Two engines and at most two wagons: the whole train must fit in the
    // tunnel beyond the board's edge (RAIL_RUN) before it leaves.
    const n = long ? 2 : 1 + Math.floor(rand() * 2);
    const out = [loco];
    for (let i = 0; i < n; i++) {
      const w = this.spec(WAGONS[Math.floor(rand() * WAGONS.length)]);
      if (w) out.push(w);
    }
    out.push({ ...loco, flip: true });
    return out;
  }

  private draw(m: Mover): Drawn {
    const hit = this.drawn.get(m.id);
    if (hit) return hit;
    const body = BODY_COLOURS[m.id % BODY_COLOURS.length];
    const d: Drawn = {
      pushed: m.pushed,
      objects: [],
      wheels: [],
      doors: [],
      last: [],
      lamps: [],
      live: this.frame,
    };
    for (const c of m.cars) {
      const src = this.models.get(c.model)!;
      const object = src.clone(true);
      this.mats.dress(object, this.livery, body);
      d.lamps.push(this.lights.attach(object, c, m.kind === RAIL));
      object.position.set(0, 0, 0);
      // The tail engine faces back along the train.
      object.rotation.set(0, c.flip ? Math.PI : 0, 0);
      const wheels: Drawn['wheels'][number] = [];
      const doors = new Map<string, THREE.Object3D>();
      object.traverse((o) => {
        // The leaves themselves (door_l0, door_rf …), not the per-material
        // meshes the loader splits under them.
        if (/^door_[lr][01fr]$/.test(o.name)) {
          doors.set(o.name, o);
          o.userData.shut = o.rotation.y;
        }
        if (!o.name.startsWith('wheel')) return;
        const b = new THREE.Box3().setFromObject(o);
        const r =
          (o.userData as { radius?: number }).radius ?? (b.max.y - b.min.y) / 2;
        wheels.push({ mesh: o, r: Math.max(0.004, r), flip: !!c.flip });
      });
      const wrap = new THREE.Group();
      wrap.rotation.order = 'YXZ';
      wrap.add(object);
      this.group.add(wrap);
      d.objects.push(wrap);
      d.wheels.push(wheels);
      d.doors.push(doors);
      d.last.push({ x: NaN, z: NaN });
    }
    this.drawn.set(m.id, d);
    return d;
  }

  private drop(id: number) {
    const d = this.drawn.get(id);
    if (!d) return;
    for (const o of d.objects) this.group.remove(o);
    this.drawn.delete(id);
  }

  tick(dt: number, moving: boolean) {
    if (this.warm && moving) {
      // Half a minute of the town's day, run before anyone sees it.
      this.warm = false;
      for (let i = 0; i < WARM_STEPS; i++) this.sim.tick(1 / 15, true);
    }
    this.sim.tick(dt, moving);
    this.frame++;
    this.lights.begin();
    for (const m of this.sim.movers) {
      const d = this.draw(m);
      d.live = this.frame;
      if (d.pushed !== m.pushed) {
        d.pushed = m.pushed;
        d.objects.reverse();
        d.wheels.reverse();
        d.doors.reverse();
        d.last.reverse();
        d.lamps.reverse();
      }
      const poses = this.sim.poses(m);
      for (let i = 0; i < poses.length; i++) this.seat(d, i, poses[i], m);
      this.swing(d, m);
    }
    this.lights.end();
    for (const id of this.drawn.keys())
      if (this.drawn.get(id)!.live !== this.frame) this.drop(id);
  }

  private seat(d: Drawn, i: number, p: CarPose, m: Mover) {
    const o = d.objects[i];
    if (!o) return;
    const dx = p.front.x - p.back.x,
      dy = p.front.y - p.back.y,
      dz = p.front.z - p.back.z;
    const flat = Math.hypot(dx, dz) || 1e-6;
    o.position.set(
      (p.front.x + p.back.x) / 2,
      (p.front.y + p.back.y) / 2,
      (p.front.z + p.back.z) / 2,
    );
    // Models face −z; a car's nose lifts with the slope under its axles.
    o.rotation.set(Math.atan2(dy, flat), Math.atan2(-dx, -dz), 0);
    // The simulation keeps physical axle order when a train runs back, so
    // its body keeps the same heading and pitch through the reversal.
    // Pops in with a small overshoot, shrinks away when dying.
    const grow = Math.min(1, m.age / 0.4);
    const pop = grow < 1 ? grow * (1 + 0.4 * Math.sin(grow * Math.PI)) : 1;
    const gone = m.dying !== undefined ? Math.max(0, m.dying / 0.4) : 1;
    o.scale.setScalar(Math.min(1.15, pop) * gone);
    if (m.kind === ROAD) this.lights.road(o, m.cars[i]);
    else if (m.kind === RAIL)
      this.lights.train(d.lamps[i], i, m.cars.length, m.pushed);
    // Wheels turn with the distance actually covered.
    const last = d.last[i];
    const moved = Number.isNaN(last.x)
      ? 0
      : Math.hypot(o.position.x - last.x, o.position.z - last.z);
    const back = m.turn ? isReversing(m) : false;
    const pushed = m.kind === RAIL && m.pushed;
    for (const w of d.wheels[i])
      w.mesh.rotation.x -=
        (((back !== pushed) !== w.flip ? -1 : 1) * moved) / w.r;
    last.x = o.position.x;
    last.z = o.position.z;
  }

  /** Doors open while people get in and out at a station: car doors swing
   *  out on their front hinges, the railcar's slam doors on theirs. */
  private swing(d: Drawn, m: Mover) {
    const plan = this.doors(m.id);
    for (let i = 0; i < d.doors.length; i++)
      for (const [name, door] of d.doors[i]) {
        // Drawn cars follow the vehicle's order, which a train reverses.
        const open =
          plan?.find((p) => p.name === name && p.car === m.cars[i])?.open ?? 0;
        // Outward about its hinge: car doors hang on their front edge, a
        // railcar's on the edge nearer its end (door_*0 the front one).
        const right = name.startsWith('door_r');
        const front = /^door_[lr](f|r|0)$/.test(name);
        const sign =
          (door.userData.open as number | undefined) ??
          (right ? 1 : -1) * (front ? 1 : -1);
        door.rotation.y = (door.userData.shut as number) + sign * open * 1.15;
      }
  }

  clear() {
    for (const id of this.drawn.keys()) this.drop(id);
    this.sim.clear();
    this.lights.clear();
  }

  dispose() {
    this.clear();
    this.group.remove(this.lights.pools);
    this.lights.dispose();
  }
}

function isReversing(m: Mover) {
  const t = m.turn!;
  const n = t.keys.length - 1;
  const i = Math.min(n - 1, Math.floor(Math.min(0.99999, t.t) * n));
  return t.keys[i + 1].reverse;
}
