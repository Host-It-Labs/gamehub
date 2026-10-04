import * as THREE from 'three';
import type { Unit } from '@/lib/games/arena/engine';
import type { UnitStats } from '@/lib/games/arena/cards';
import { activeStatuses, type TroopStatus } from './status-state';

type Symbol = TroopStatus | 'heal';
const COLOURS: Record<Symbol, string> = {
  stun: '#ffe06a',
  slow: '#a1edff',
  taunt: '#ff7756',
  haste: '#c8ff77',
  shield: '#80cfff',
  rage: '#ffab53',
  heal: '#8affb6',
};

function polygon(points: [number, number][]) {
  const shape = new THREE.Shape();
  points.forEach(([x, y], i) => (i ? shape.lineTo(x, y) : shape.moveTo(x, y)));
  shape.closePath();
  return shape;
}

/** Chunky silhouettes remain recognisable on a phone, without text or a
 * texture download. Each symbol shares its instances and dark outline. */
function symbolGeometry(symbol: Symbol) {
  let shapes: THREE.Shape[];
  if (symbol === 'stun') {
    shapes = [
      polygon(
        Array.from({ length: 10 }, (_, i) => {
          const a = Math.PI / 2 + (i * Math.PI) / 5;
          const r = i % 2 ? 0.44 : 1;
          return [Math.cos(a) * r, Math.sin(a) * r];
        }),
      ),
    ];
  } else if (symbol === 'slow') {
    shapes = [];
    // A solid six-point snowflake, with a fork at every tip.
    const spoke = [
      [-0.1, 0],
      [-0.1, 0.5],
      [-0.34, 0.67],
      [-0.24, 0.81],
      [-0.1, 0.71],
      [-0.1, 1],
      [0.1, 1],
      [0.1, 0.71],
      [0.24, 0.81],
      [0.34, 0.67],
      [0.1, 0.5],
      [0.1, 0],
    ] as [number, number][];
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      shapes.push(
        polygon(
          spoke.map(([x, y]) => [
            x * Math.cos(a) - y * Math.sin(a),
            x * Math.sin(a) + y * Math.cos(a),
          ]),
        ),
      );
    }
  } else if (symbol === 'haste') {
    shapes = [-0.65, 0.25].map((y) =>
      polygon([
        [-0.85, y],
        [0, y + 0.7],
        [0.85, y],
        [0.65, y - 0.25],
        [0, y + 0.28],
        [-0.65, y - 0.25],
      ]),
    );
  } else if (symbol === 'taunt') {
    shapes = [
      polygon([
        [-0.26, -0.2],
        [-0.4, 1],
        [0.4, 1],
        [0.26, -0.2],
      ]),
      polygon([
        [-0.32, -0.85],
        [-0.32, -0.45],
        [0.32, -0.45],
        [0.32, -0.85],
      ]),
    ];
  } else if (symbol === 'shield') {
    const shield = polygon([
      [-0.8, 0.72],
      [0, 1],
      [0.8, 0.72],
      [0.7, -0.23],
      [0, -1],
      [-0.7, -0.23],
    ]);
    const hole = new THREE.Path();
    hole.moveTo(-0.43, 0.43);
    hole.lineTo(0, 0.58);
    hole.lineTo(0.43, 0.43);
    hole.lineTo(0.35, -0.1);
    hole.lineTo(0, -0.48);
    hole.lineTo(-0.35, -0.1);
    hole.closePath();
    shield.holes.push(hole);
    shapes = [shield];
  } else if (symbol === 'rage') {
    shapes = [
      polygon([
        [-0.65, -0.55],
        [-0.8, 0.1],
        [-0.22, -0.1],
        [0.15, 1],
        [0.43, 0.22],
        [0.75, 0.6],
        [0.7, -0.45],
        [0, -1],
      ]),
    ];
  } else {
    shapes = [
      polygon([
        [-0.25, -1],
        [0.25, -1],
        [0.25, -0.25],
        [1, -0.25],
        [1, 0.25],
        [0.25, 0.25],
        [0.25, 1],
        [-0.25, 1],
        [-0.25, 0.25],
        [-1, 0.25],
        [-1, -0.25],
        [-0.25, -0.25],
      ]),
    ];
  }
  return new THREE.ShapeGeometry(shapes);
}

class Symbols {
  fill: THREE.InstancedMesh;
  outline: THREE.InstancedMesh;
  private capacity = 64;
  private used = 0;
  private matrix = new THREE.Matrix4();
  private scale = new THREE.Vector3();

  constructor(
    private scene: THREE.Scene,
    symbol: Symbol,
  ) {
    const geometry = symbolGeometry(symbol);
    this.fill = this.make(geometry, COLOURS[symbol], 9);
    this.outline = this.make(geometry, '#172834', 8);
    this.fill.name = `status-${symbol}`;
    this.outline.name = `status-${symbol}-outline`;
  }

  private make(geometry: THREE.BufferGeometry, colour: string, order: number) {
    const material = new THREE.MeshBasicMaterial({
      color: colour,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    const mesh = new THREE.InstancedMesh(geometry, material, this.capacity);
    mesh.count = 0;
    mesh.frustumCulled = false;
    mesh.renderOrder = order;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.scene.add(mesh);
    return mesh;
  }

  begin() {
    this.used = 0;
  }

  add(at: THREE.Vector3, size: number, facing: THREE.Quaternion) {
    if (this.used === this.capacity) {
      // Keep every affected troop visible even in a dense bee swarm.
      this.capacity *= 2;
      const grow = (old: THREE.InstancedMesh) => {
        const next = new THREE.InstancedMesh(
          old.geometry,
          old.material,
          this.capacity,
        );
        next.name = old.name;
        next.frustumCulled = false;
        next.renderOrder = old.renderOrder;
        next.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        next.instanceMatrix.array.set(old.instanceMatrix.array);
        old.removeFromParent();
        old.dispose();
        this.scene.add(next);
        return next;
      };
      this.fill = grow(this.fill);
      this.outline = grow(this.outline);
    }
    this.matrix.compose(at, facing, this.scale.setScalar(size * 1.22));
    this.outline.setMatrixAt(this.used, this.matrix);
    this.matrix.compose(at, facing, this.scale.setScalar(size));
    this.fill.setMatrixAt(this.used++, this.matrix);
  }

  end() {
    for (const mesh of [this.fill, this.outline]) {
      mesh.count = this.used;
      mesh.instanceMatrix.needsUpdate = true;
    }
  }

  dispose() {
    this.fill.geometry.dispose();
    for (const mesh of [this.fill, this.outline]) {
      mesh.removeFromParent();
      (mesh.material as THREE.Material).dispose();
      mesh.dispose();
    }
  }
}

/** Persistent effects belong to the recipient, including flyers. Stun
 * has a crown of stars; the others have distinct, outlined silhouettes.
 * Reduced motion holds them still while preserving every status signal. */
export class TroopStatuses {
  private pools: Record<Symbol, Symbols>;
  private healing = new Map<number, number>();
  private seen = new Set<number>();
  private time = 0;
  private reduced = false;
  private at = new THREE.Vector3();
  private right = new THREE.Vector3();
  private facing = new THREE.Quaternion();
  size = 1.75;

  constructor(
    scene: THREE.Scene,
    private camera: THREE.Camera,
  ) {
    this.pools = Object.fromEntries(
      Object.keys(COLOURS).map((symbol) => [
        symbol,
        new Symbols(scene, symbol as Symbol),
      ]),
    ) as Record<Symbol, Symbols>;
  }

  heal(ids: number[]) {
    for (const id of ids) this.healing.set(id, 0.7);
  }

  begin(dt: number, reduced = false) {
    this.time += dt;
    this.reduced = reduced;
    this.seen.clear();
    this.camera.getWorldQuaternion(this.facing);
    this.right.set(1, 0, 0).applyQuaternion(this.facing);
    for (const pool of Object.values(this.pools)) pool.begin();
    for (const [id, left] of this.healing) {
      if (left <= dt) this.healing.delete(id);
      else this.healing.set(id, left - dt);
    }
  }

  show(u: Unit, stats: UnitStats, head: THREE.Vector3) {
    if (u.hp <= 0 || (u.state === 'deploying' && stats.burrow)) return;
    this.seen.add(u.id);
    const statuses = activeStatuses(u, stats);
    const top = this.size * 0.24;
    if (statuses.includes('stun')) {
      const turn = this.reduced ? 0 : this.time * 2.6 + u.id;
      for (let i = 0; i < 3; i++) {
        const a = turn + (i * Math.PI * 2) / 3;
        this.at
          .copy(head)
          .addScaledVector(this.right, Math.cos(a) * top * 1.65);
        this.at.y += top * (1.2 + Math.sin(a) * 0.3);
        this.pools.stun.add(this.at, top * 0.52, this.facing);
      }
    }
    const badges: Symbol[] = statuses.filter((s) => s !== 'stun');
    if (this.healing.has(u.id)) badges.push('heal');
    badges.forEach((symbol, i) => {
      const drift =
        symbol === 'heal' && !this.reduced
          ? (0.7 - this.healing.get(u.id)!) * this.size * 0.5
          : 0;
      this.at
        .copy(head)
        .addScaledVector(
          this.right,
          (i - (badges.length - 1) / 2) * top * 1.85,
        );
      this.at.y += top * (statuses.includes('stun') ? 3.4 : 1.4) + drift;
      this.pools[symbol].add(this.at, top * 0.72, this.facing);
    });
  }

  end() {
    for (const id of this.healing.keys())
      if (!this.seen.has(id)) this.healing.delete(id);
    for (const pool of Object.values(this.pools)) pool.end();
  }

  dispose() {
    for (const pool of Object.values(this.pools)) pool.dispose();
    this.healing.clear();
  }
}
