import * as THREE from 'three';
import type { Unit } from '@/lib/games/arena/engine';
import type { UnitStats } from '@/lib/games/arena/cards';
import { activeStatuses, type TroopStatus } from './status-state';

type Symbol = Exclude<TroopStatus, 'shield'> | 'heal';
const COLOURS: Record<Symbol, string> = {
  stun: '#ffe06a',
  slow: '#a1edff',
  taunt: '#ff7756',
  haste: '#c8ff77',
  rage: '#ffab53',
  heal: '#8affb6',
};

function polygon(points: [number, number][]) {
  const shape = new THREE.Shape();
  points.forEach(([x, y], i) => (i ? shape.lineTo(x, y) : shape.moveTo(x, y)));
  shape.closePath();
  return shape;
}

/** Clean silhouettes inset into small enamel badges. */
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
  plate: THREE.InstancedMesh;
  private capacity = 64;
  private used = 0;
  private matrix = new THREE.Matrix4();
  private scale = new THREE.Vector3();

  constructor(
    private scene: THREE.Scene,
    symbol: Symbol,
  ) {
    const geometry = symbolGeometry(symbol);
    this.fill = this.make(
      geometry,
      new THREE.MeshBasicMaterial({
        color: COLOURS[symbol],
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      }),
      9,
    );
    this.plate = this.make(
      new THREE.CircleGeometry(1, 32),
      new THREE.ShaderMaterial({
        uniforms: { colour: { value: new THREE.Color(COLOURS[symbol]) } },
        vertexShader: `
          varying vec2 badge;
          void main() {
            badge = position.xy;
            gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
          }`,
        fragmentShader: `
          uniform vec3 colour;
          varying vec2 badge;
          void main() {
            float r = length(badge);
            float light = clamp(0.5 + badge.y * 0.38 - badge.x * 0.18, 0.0, 1.0);
            vec3 enamel = mix(vec3(0.025, 0.045, 0.075), colour * 0.2, light);
            vec3 metal = mix(colour * 0.4, mix(colour, vec3(1.0), 0.58), light);
            vec3 ink = mix(enamel, metal, smoothstep(0.78, 0.84, r));
            ink *= 1.0 - smoothstep(0.94, 1.0, r) * 0.62;
            gl_FragColor = vec4(ink, 1.0);
          }`,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      }),
      8,
    );
    this.fill.name = `status-${symbol}`;
    this.plate.name = `status-${symbol}-plate`;
  }

  private make(
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    order: number,
  ) {
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
      this.plate = grow(this.plate);
    }
    this.matrix.compose(at, facing, this.scale.setScalar(size));
    this.plate.setMatrixAt(this.used, this.matrix);
    this.matrix.compose(at, facing, this.scale.setScalar(size * 0.6));
    this.fill.setMatrixAt(this.used++, this.matrix);
  }

  end() {
    for (const mesh of [this.fill, this.plate]) {
      mesh.count = this.used;
      mesh.instanceMatrix.needsUpdate = true;
    }
  }

  dispose() {
    for (const mesh of [this.fill, this.plate]) {
      mesh.removeFromParent();
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
      mesh.dispose();
    }
  }
}

/** Persistent effects belong to the recipient, including flyers. Small
 * enamel badges share one calm row above the health and shield tracks.
 * Reduced motion holds them still while preserving every status signal. */
export class TroopStatuses {
  private pools: Record<Symbol, Symbols>;
  private healing = new Map<number, number>();
  private seen = new Set<number>();
  private time = 0;
  private reduced = false;
  private at = new THREE.Vector3();
  private right = new THREE.Vector3();
  private up = new THREE.Vector3();
  private projected = new THREE.Vector3();
  private facing = new THREE.Quaternion();
  private screenHeight = 0;
  private trackHeight = 0;
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

  /** Match the CSS health tracks even at distant/fractional viewports. */
  hud(height: number, trackHeight: number) {
    this.screenHeight = height;
    this.trackHeight = trackHeight;
  }

  begin(dt: number, reduced = false) {
    this.time += dt;
    this.reduced = reduced;
    this.seen.clear();
    this.camera.getWorldQuaternion(this.facing);
    this.right.set(1, 0, 0).applyQuaternion(this.facing);
    this.up.set(0, 1, 0).applyQuaternion(this.facing);
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
    const size = this.size * 0.12;
    let rise = this.size * 0.55;
    if (this.screenHeight > 0) {
      const y = this.projected.copy(head).project(this.camera).y;
      const unit = this.projected
        .copy(head)
        .add(this.up)
        .project(this.camera).y;
      const pixels = (Math.abs(unit - y) * this.screenHeight) / 2;
      const barY = this.projected.copy(head);
      barY.y += this.size * 0.13;
      const lift = ((barY.project(this.camera).y - y) * this.screenHeight) / 2;
      const tracks = stats.shield ? this.trackHeight * 2 + 5 : this.trackHeight;
      const icon = stats.shield
        ? Math.max(0, 7 - (this.trackHeight + 2) / 2)
        : 0;
      rise = Math.max(
        rise,
        size + (lift + tracks + icon + 5) / Math.max(1e-5, pixels),
      );
    }
    // Shield has a permanent track and icon in the health HUD.
    const badges: Symbol[] = statuses.filter(
      (s): s is Exclude<TroopStatus, 'shield'> => s !== 'shield',
    );
    if (this.healing.has(u.id)) badges.push('heal');
    badges.forEach((symbol, i) => {
      const drift =
        symbol === 'heal' && !this.reduced
          ? (0.7 - this.healing.get(u.id)!) * this.size * 0.13
          : 0;
      const breathe = this.reduced
        ? 0
        : Math.sin(this.time * 2.4 + u.id) * size * 0.035;
      this.at
        .copy(head)
        .addScaledVector(
          this.right,
          (i - (badges.length - 1) / 2) * size * 2.35,
        )
        .addScaledVector(this.up, rise + drift + breathe);
      this.pools[symbol].add(this.at, size, this.facing);
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
