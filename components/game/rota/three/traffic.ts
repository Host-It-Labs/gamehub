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

/**
 * The mill town's traffic, drawn: the motion is `TrafficSim`'s (lib), this
 * seats a model on every pose. Each car rests on its two axles, so it tilts
 * up the ramps of a bridge and down into a cutting; wheels turn with the
 * distance driven. Engines wear the sheet owner's colour. New vehicles
 * arrive out of sight; one whose road is taken up shrinks away.
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

type Drawn = {
  /** In the mover's order of cars (it reverses when a train runs back). */
  pushed: boolean;
  objects: THREE.Group[];
  wheels: { mesh: THREE.Object3D; r: number }[][];
  last: { x: number; z: number }[];
};

export class Traffic {
  readonly group = new THREE.Group();
  readonly sim: TrafficSim;
  private drawn = new Map<number, Drawn>();
  private sizes = new Map<string, { length: number; width: number }>();
  private livery: number;

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
  }

  setLivery(livery: number) {
    if (livery === this.livery) return;
    this.livery = livery;
    // Repaint the engines on the next frame.
    for (const id of this.drawn.keys()) this.drop(id);
  }

  setNetwork(net: Net, stationHalf: (cell: number) => number) {
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
    // A shunting engine with a wagon or two; a short goods train on a line
    // that runs through.
    const loco = this.spec(long || rand() < 0.6 ? 'loco_steam' : 'loco_diesel');
    if (!loco) return null;
    const n = long ? 3 : 1 + Math.floor(rand() * 2);
    const out = [loco];
    for (let i = 0; i < n; i++) {
      const w = this.spec(WAGONS[Math.floor(rand() * WAGONS.length)]);
      if (w) out.push(w);
    }
    return out;
  }

  private draw(m: Mover): Drawn {
    const hit = this.drawn.get(m.id);
    if (hit) return hit;
    const body = BODY_COLOURS[m.id % BODY_COLOURS.length];
    const d: Drawn = { pushed: m.pushed, objects: [], wheels: [], last: [] };
    for (const c of m.cars) {
      const src = this.models.get(c.model)!;
      const object = src.clone(true);
      this.mats.dress(object, this.livery, body);
      object.position.set(0, 0, 0);
      object.rotation.set(0, 0, 0);
      const wheels: Drawn['wheels'][number] = [];
      object.traverse((o) => {
        if (!o.name.startsWith('wheel')) return;
        const b = new THREE.Box3().setFromObject(o);
        const r =
          (o.userData as { radius?: number }).radius ?? (b.max.y - b.min.y) / 2;
        wheels.push({ mesh: o, r: Math.max(0.004, r) });
      });
      const wrap = new THREE.Group();
      wrap.rotation.order = 'YXZ';
      wrap.add(object);
      this.group.add(wrap);
      d.objects.push(wrap);
      d.wheels.push(wheels);
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
    this.sim.tick(dt, moving);
    const live = new Set<number>();
    for (const m of this.sim.movers) {
      live.add(m.id);
      const d = this.draw(m);
      if (d.pushed !== m.pushed) {
        d.pushed = m.pushed;
        d.objects.reverse();
        d.wheels.reverse();
        d.last.reverse();
      }
      this.sim.poses(m).forEach((p, i) => this.seat(d, i, p, m));
    }
    for (const id of this.drawn.keys()) if (!live.has(id)) this.drop(id);
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
    // Wheels turn with the distance actually covered.
    const last = d.last[i];
    const moved = Number.isNaN(last.x)
      ? 0
      : Math.hypot(o.position.x - last.x, o.position.z - last.z);
    const back = m.turn ? isReversing(m) : false;
    const pushed = m.kind === RAIL && m.pushed;
    for (const w of d.wheels[i])
      w.mesh.rotation.x -= ((back !== pushed ? -1 : 1) * moved) / w.r;
    last.x = o.position.x;
    last.z = o.position.z;
  }

  clear() {
    for (const id of this.drawn.keys()) this.drop(id);
    this.sim.clear();
  }
}

function isReversing(m: Mover) {
  const t = m.turn!;
  const n = t.keys.length - 1;
  const i = Math.min(n - 1, Math.floor(Math.min(0.99999, t.t) * n));
  return t.keys[i + 1].reverse;
}
