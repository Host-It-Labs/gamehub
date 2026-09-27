import * as THREE from 'three';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import type { Match, Tower } from '@/lib/games/arena/engine';
import { toWorld } from '@/lib/games/arena/layout';
import { MaterialLibrary, type Team, type Textures } from './materials';
import {
  bakeStatic,
  ScatterCuller,
  StaticMerge,
  type StaticPiece,
} from './static-batch';
import {
  PLINTH,
  forestAt,
  groundHeight,
  makeGround,
  makePlinth,
  makeWater,
  noiseTexture,
  rippleTexture,
} from './terrain';

import type { Quality } from './quality';
export type { Quality };

export type WorldAssets = {
  textures: Textures;
  towers: GLTF;
  troops: GLTF;
  props?: GLTF;
  /** Collector figures; each replaces the troop model of the same id. */
  figures?: GLTF;
};

export type TowerView = {
  id: number;
  side: Team;
  kind: 'king' | 'princess';
  root: THREE.Object3D;
  rubble: THREE.Object3D;
  cannon?: THREE.Object3D;
  barrel?: THREE.Object3D;
  guardSpot?: THREE.Object3D;
  /** How far the smaller platform lowers its full-size archer. */
  guardDrop: number;
  /** Where the health bar hangs, in world space. */
  top: THREE.Vector3;
  destroyed: boolean;
};

/** Deterministic random numbers for scattering scenery. */
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function find(root: THREE.Object3D, name: string) {
  let hit: THREE.Object3D | undefined;
  root.traverse((o) => {
    if (!hit && o.name === name) hit = o;
  });
  return hit;
}

/** Tower parts that move during play (the cannon turns, the guard spot
 * carries an archer); everything else in a tower is merged. */
const LIVE_TOWER_PARTS = new Set(['king-cannon', 'princess-guard']);
export const TOWER_SCALE = 0.7;

/** Freeze an object's matrices once it is placed for good. */
function freeze(o: THREE.Object3D) {
  o.updateMatrixWorld(true);
  o.traverse((n) => {
    n.matrixAutoUpdate = false;
  });
}

/** Whether a point lies on the diorama's slab, at least `margin` inside. */
const onSlab = (x: number, z: number, margin: number) =>
  x > PLINTH.left + margin &&
  x < PLINTH.right - margin &&
  z > PLINTH.far + margin &&
  z < PLINTH.near - margin;

/** The sky behind the valley: a clear bright blue overhead fading to a
 *  warm light haze at the horizon. */
function skyTexture() {
  const c = document.createElement('canvas');
  c.width = 16;
  c.height = 256;
  const g = c.getContext('2d')!;
  const v = g.createLinearGradient(0, 0, 0, 256);
  v.addColorStop(0, '#6fb4ec');
  v.addColorStop(0.5, '#a9d6f2');
  v.addColorStop(1, '#e4f0e6');
  g.fillStyle = v;
  g.fillRect(0, 0, 16, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Bridges sit a little into the banks so troops step onto them. */
export const BRIDGE_DROP = 0.3;
const BRIDGE_XS = [-5.5, 5.5];
/** Height of the ground a troop stands on, including bridge decks. */
export function standHeight(wx: number, wz: number) {
  for (const bx of BRIDGE_XS) {
    if (Math.abs(wx - bx) <= 1.2 && Math.abs(wz) <= 1.95) {
      const t = wz / 1.95;
      return 0.42 + 0.28 * (1 - t * t) - BRIDGE_DROP;
    }
  }
  return Math.max(0, groundHeight(wx, wz));
}

export class ArenaWorld {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(30, 1, 1, 400);
  readonly renderer: THREE.WebGLRenderer;
  readonly materials: MaterialLibrary;
  readonly sun: THREE.DirectionalLight;
  readonly towers = new Map<number, TowerView>();
  readonly water: THREE.Mesh;
  readonly noise: THREE.DataTexture;
  private disposables: { dispose(): void }[] = [];
  /** This match's towers and rubble, merged by material across towers. */
  private towerStatics?: StaticMerge;
  private scatter?: ScatterCuller;

  /**
   * `viewSide` is the side the player watches from: its towers are blue
   * and the camera and sun look up the field from its end.
   */
  constructor(
    readonly canvas: HTMLCanvasElement,
    readonly assets: WorldAssets,
    readonly quality: Quality,
    readonly viewSide: Team = 0,
  ) {
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
      alpha: false,
      // The x-ray pass (view.ts) marks visible troops in the stencil.
      stencil: true,
    });
    renderer.setPixelRatio(quality.pixelRatio);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    // A neutral curve keeps the bright cartoon colours saturated.
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = 0.98;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer = renderer;

    const anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    for (const set of Object.values(assets.textures))
      for (const t of [set.map, set.normalMap, set.ormMap]) {
        t.anisotropy = anisotropy;
        t.needsUpdate = true;
      }

    const scene = this.scene;
    // Seen from side 1 the whole world is turned round, sun included.
    const turn = viewSide === 1 ? -1 : 1;
    // A bright day: clear sky behind the valley and a light haze in the
    // distance, so the far woods fade out rather than into the dark.
    const backdrop = skyTexture();
    scene.background = backdrop;
    scene.fog = new THREE.Fog('#d6e9ee', 80, 175);
    this.disposables.push(backdrop);
    // Reflections come from an open sky: blue above, the sun's warm disc up
    // to the left, a bright rim behind and green light off the meadow, so
    // stone, slate, water and metal catch soft cheerful highlights.
    const pmrem = new THREE.PMREMGenerator(renderer);
    const studio = new THREE.Scene();
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(50, 64, 32),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: {
          uKey: {
            value: new THREE.Vector3(-17 * turn, 34, 15 * turn).normalize(),
          },
          uRim: {
            value: new THREE.Vector3(6 * turn, 14, -30 * turn).normalize(),
          },
        },
        vertexShader: `varying vec3 vDir;
          void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `varying vec3 vDir;
          uniform vec3 uKey;
          uniform vec3 uRim;
          void main() {
            float h = vDir.y;
            vec3 ground = vec3(0.32, 0.38, 0.22);
            vec3 sky = mix(vec3(0.78, 0.88, 0.95), vec3(0.42, 0.66, 0.92), smoothstep(0.0, 0.8, h));
            vec3 col = mix(ground, sky, smoothstep(-0.15, 0.1, h));
            float key = smoothstep(0.86, 0.96, dot(vDir, uKey));
            float rim = smoothstep(0.9, 0.97, dot(vDir, uRim));
            col += vec3(5.2, 4.8, 4.3) * key + vec3(1.2, 1.4, 1.6) * rim;
            gl_FragColor = vec4(col, 1.0);
          }`,
      }),
    );
    studio.add(dome);
    const env = pmrem.fromScene(studio, 0.02).texture;
    scene.environment = env;
    scene.environmentIntensity = 0.75;
    this.disposables.push(env, pmrem);
    dome.geometry.dispose();
    (dome.material as THREE.Material).dispose();

    scene.add(new THREE.HemisphereLight('#e6f3ff', '#6f7d4a', 1.15));
    const sun = new THREE.DirectionalLight('#fff3de', 2.8);
    sun.position.set(-17 * turn, 34, 15 * turn);
    sun.target.position.set(0, 0, 0);
    sun.castShadow = true;
    sun.shadow.mapSize.set(quality.shadowSize, quality.shadowSize);
    const cam = sun.shadow.camera;
    cam.left = -24;
    cam.right = 24;
    cam.top = 24;
    cam.bottom = -24;
    cam.near = 5;
    cam.far = 90;
    // three does this on the first shadow pass; the prop culling needs the
    // box before that.
    cam.updateProjectionMatrix();
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.025;
    scene.add(sun, sun.target);
    this.sun = sun;
    // A cool rim light from behind the far side outlines towers and trees.
    const rim = new THREE.DirectionalLight('#cddcff', 0.9);
    rim.position.set(6 * turn, 14, -30 * turn);
    scene.add(rim);

    this.materials = new MaterialLibrary(assets.textures);
    this.noise = noiseTexture();
    const ripples = rippleTexture();
    this.disposables.push(this.noise, ripples);
    const ground = makeGround(
      assets.textures,
      this.noise,
      quality.tier === 'lite',
    );
    scene.add(ground);
    this.disposables.push(
      ground.material as THREE.Material,
      ...(ground.userData.textures as THREE.Texture[]),
    );
    const plinth = makePlinth(assets.textures);
    scene.add(plinth);
    this.disposables.push(...(plinth.userData.owned as { dispose(): void }[]));
    this.water = makeWater(this.noise, ripples);
    scene.add(this.water);
    const dressing: StaticPiece[] = [];
    this.buildBridgesAndWalls(dressing);
    if (assets.props) this.scatterProps(assets.props, dressing);
    // Bridges, torches and banner posts never move: one mesh per material.
    for (const mesh of new StaticMerge(dressing).meshes) {
      scene.add(mesh);
      freeze(mesh);
    }
  }

  /** A dressed copy of a node from one of the model files. */
  instance(gltf: GLTF, name: string, team: Team) {
    const source = find(gltf.scene, name);
    if (!source) throw new Error(`Missing model ${name}`);
    const copy = source.clone(true);
    copy.position.set(0, 0, 0);
    copy.rotation.set(0, 0, 0);
    this.materials.dress(copy, team);
    return copy;
  }

  private buildBridgesAndWalls(dressing: StaticPiece[]) {
    const { towers } = this.assets;
    const has = (name: string) => !!find(towers.scene, name);
    // The river's stone embankments along the field.
    if (has('river'))
      dressing.push(...bakeStatic(this.instance(towers, 'river', 0)));
    // An old stone arch on the left, a timber-decked bridge on the right.
    BRIDGE_XS.forEach((x, i) => {
      const name = i === 1 && has('bridge-b') ? 'bridge-b' : 'bridge';
      const bridge = this.instance(towers, name, 0);
      bridge.position.set(x, -BRIDGE_DROP, 0);
      dressing.push(...bakeStatic(bridge));
    });
    const spots: THREE.Matrix4[] = [];
    const up = new THREE.Vector3(0, 1, 0);
    const addWall = (x: number, z: number, turn: boolean) =>
      spots.push(
        new THREE.Matrix4().compose(
          new THREE.Vector3(x, 0, z),
          new THREE.Quaternion().setFromAxisAngle(up, turn ? Math.PI / 2 : 0),
          new THREE.Vector3(1, 1, 1),
        ),
      );
    for (let z = -16; z <= 16; z += 2) {
      if (Math.abs(z) < 2) continue;
      addWall(-9.8, z, true);
      addWall(9.8, z, true);
    }
    for (let x = -8.8; x <= 8.8; x += 2) {
      addWall(x, 17.2, false);
      addWall(x, -17.2, false);
    }
    // One instanced mesh per wall part for the whole ring.
    const wall = this.instance(towers, 'wall', 0);
    wall.updateMatrixWorld(true);
    wall.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (!mesh.isMesh) return;
      const inst = new THREE.InstancedMesh(
        mesh.geometry,
        mesh.material,
        spots.length,
      );
      spots.forEach((m, i) =>
        inst.setMatrixAt(i, m.clone().multiply(mesh.matrixWorld)),
      );
      inst.castShadow = mesh.castShadow;
      inst.receiveShadow = mesh.receiveShadow;
      inst.name = 'wall';
      inst.computeBoundingSphere();
      this.scene.add(inst);
      freeze(inst);
    });
  }

  /** Towers for a new match, one view per engine tower. */
  placeTowers(m: Match) {
    const { towers } = this.assets;
    const pieces: StaticPiece[] = [];
    for (const t of m.towers) {
      const [x, , z] = toWorld(t.x, t.y);
      // Colours follow the viewer: your towers are blue from either end.
      const team: Team = t.side === this.viewSide ? 0 : 1;
      const root = this.instance(towers, t.kind, team);
      const rubble = this.instance(towers, `${t.kind}-rubble`, team);
      const guardSpot = find(root, 'princess-guard');
      const guardDrop = guardSpot
        ? guardSpot.getWorldPosition(new THREE.Vector3()).y * (1 - TOWER_SCALE)
        : 0;
      root.scale.multiplyScalar(TOWER_SCALE);
      rubble.scale.multiplyScalar(TOWER_SCALE);
      // Lower the archer with its platform, but cancel the inherited scale.
      guardSpot?.scale.multiplyScalar(1 / TOWER_SCALE);
      root.position.set(x, 0, z);
      rubble.position.set(x, 0, z);
      // Your towers face up the field; the bot's are turned round.
      if (t.side === 1) {
        root.rotation.y = Math.PI;
        rubble.rotation.y = Math.PI;
      }
      rubble.visible = t.destroyed;
      root.visible = !t.destroyed;
      this.scene.add(root, rubble);
      // Their meshes merge with the other towers' below and follow the
      // root's and rubble's visibility from there.
      pieces.push(
        ...bakeStatic(root, root, LIVE_TOWER_PARTS),
        ...bakeStatic(rubble, rubble),
      );
      const view: TowerView = {
        id: t.id,
        side: t.side,
        kind: t.kind,
        root,
        rubble,
        cannon: find(root, 'king-cannon'),
        barrel: find(root, 'king-cannon-barrel'),
        guardSpot,
        guardDrop,
        top: new THREE.Vector3(
          x,
          t.kind === 'king' ? 6.1 * TOWER_SCALE : 5.2 - guardDrop,
          z,
        ),
        destroyed: t.destroyed,
      };
      this.towers.set(t.id, view);
    }
    this.towerStatics = new StaticMerge(pieces);
    for (const mesh of this.towerStatics.meshes) {
      this.scene.add(mesh);
      freeze(mesh);
    }
  }

  clearTowers() {
    for (const v of this.towers.values()) this.scene.remove(v.root, v.rubble);
    this.towers.clear();
    this.towerStatics?.dispose();
    this.towerStatics = undefined;
  }

  towerView(t: Tower) {
    return this.towers.get(t.id);
  }

  private scatterProps(props: GLTF, dressing: StaticPiece[]) {
    const rnd = seeded(20260926);
    const has = (name: string) => !!find(props.scene, name);
    const kinds = {
      oaks: ['tree-oak-1', 'tree-oak-2', 'tree-oak-3'].filter(has),
      pines: ['tree-pine-1', 'tree-pine-2'].filter(has),
      rocks: ['rock-1', 'rock-2', 'rock-3'].filter(has),
      boulders: ['rock-3', 'rock-4'].filter(has),
      cliffs: ['cliff-1', 'cliff-2'].filter(has),
      bushes: ['bush-1', 'bush-2'].filter(has),
      flowers: ['flowers-1', 'flowers-2'].filter(has),
      tufts: ['tufts'].filter(has),
      deadwood: ['stump', 'log'].filter(has),
    };
    const placed: { name: string; m: THREE.Matrix4 }[] = [];
    const up = new THREE.Vector3(0, 1, 0);
    const alongZ = new THREE.Vector3(0, 0, 1);
    const lean = new THREE.Quaternion();
    const tip = new THREE.Euler();
    /**
     * Place one prop: a random turn unless `turn` is given, an optional lean
     * (`tilt`, radians either way), a roll along its length (`roll`, for
     * fences on a slope) and a taller or squatter build (`stretch`).
     */
    const put = (
      name: string,
      x: number,
      z: number,
      scale: number,
      y?: number,
      o: { turn?: number; tilt?: number; roll?: number; stretch?: number } = {},
    ) => {
      const q = new THREE.Quaternion().setFromAxisAngle(
        up,
        o.turn ?? rnd() * Math.PI * 2,
      );
      if (o.roll) q.multiply(lean.setFromAxisAngle(alongZ, o.roll));
      if (o.tilt)
        q.premultiply(
          lean.setFromEuler(
            tip.set((rnd() - 0.5) * 2 * o.tilt, 0, (rnd() - 0.5) * 2 * o.tilt),
          ),
        );
      const m = new THREE.Matrix4().compose(
        new THREE.Vector3(x, y ?? groundHeight(x, z) - 0.05, z),
        q,
        new THREE.Vector3(scale, scale * (o.stretch ?? 1), scale),
      );
      placed.push({ name, m });
    };
    const pick = (list: string[]) => list[Math.floor(rnd() * list.length)];
    const shuffled = <T>(list: T[]) => {
      for (let i = list.length - 1; i > 0; i--) {
        const j = Math.floor(rnd() * (i + 1));
        [list[i], list[j]] = [list[j], list[i]];
      }
      return list;
    };
    /** Jittered points over the whole slab, `step` apart, in random order. */
    const sample = (step: number) => {
      const out: [number, number][] = [];
      for (let x = PLINTH.left; x < PLINTH.right; x += step)
        for (let z = PLINTH.far; z < PLINTH.near; z += step)
          out.push([x + rnd() * step, z + rnd() * step]);
      return shuffled(out);
    };
    // Everything that wants room of its own (cliffs, trees, bushes, rocks,
    // camp dressing) claims a circle; later props keep out of earlier ones.
    const CELL = 4;
    const claims = new Map<number, number[]>();
    const cellOf = (x: number, z: number) =>
      (Math.floor(x / CELL) + 64) * 256 + Math.floor(z / CELL) + 64;
    const claim = (x: number, z: number, r: number) => {
      const k = cellOf(x, z);
      const list = claims.get(k) ?? [];
      list.push(x, z, r);
      claims.set(k, list);
    };
    /** Whether a circle is free of every claim (`slack` < 1 lets them overlap). */
    const roomy = (x: number, z: number, r: number, slack = 1) => {
      for (let i = -2; i <= 2; i++)
        for (let j = -2; j <= 2; j++) {
          const list = claims.get(cellOf(x + i * CELL, z + j * CELL));
          if (!list) continue;
          for (let k = 0; k < list.length; k += 3)
            if (
              Math.hypot(x - list[k], z - list[k + 1]) <
              (r + list[k + 2]) * slack
            )
              return false;
        }
      return true;
    };
    // Camp dressing by the field, placed by hand; the woods keep clear.
    // Tents fly their side's colours, so they are merged per side below.
    const spots: [string, number, number, number][] = [
      ['well', -14.2, 7.5, 0.4],
      ['haybale', -15.8, 4.6, 1.1],
      ['cart', -13.4, 3.9, 2.6],
      ['well', 14.4, -7.2, 3.6],
      ['haybale', 15.9, -4.4, 4.2],
      ['cart', 13.6, -3.8, 5.7],
      ['haybale', -9.2, -22.6, 0.9],
      ['cart', 9.4, -23.2, 3.4],
    ];
    const camp = spots.filter(([name]) => has(name));
    // Off to the side behind each king, clear of the phone's top edge.
    const tents: [number, number, 0 | 1][] = [
      [-15.5, 21.5, 0],
      [6.6, -23.4, 1],
    ];
    const keepOut: [number, number, number][] = [
      ...camp.map(([, x, z]) => [x, z, 2.4] as [number, number, number]),
      ...tents.map(([x, z]) => [x, z, 3.2] as [number, number, number]),
      // Inside the paddocks by the side camps.
      [-16, 6.8, 3.4],
      [16, -6.8, 3.4],
      // Torches and banner posts by the walls.
      ...[-10.4, 10.4].flatMap((x) =>
        [17.8, 2.2, -2.2, -17.8].map(
          (z) => [x, z, 0.8] as [number, number, number],
        ),
      ),
      ...[-10.6, 10.6].flatMap((x) =>
        [11, -11].map((z) => [x, z, 1.1] as [number, number, number]),
      ),
    ];
    const clear = (x: number, z: number) =>
      !keepOut.some(([kx, kz, r]) => Math.hypot(x - kx, z - kz) < r);
    for (const [name, x, z, turn] of camp) {
      const m = new THREE.Matrix4().compose(
        new THREE.Vector3(x, groundHeight(x, z) - 0.04, z),
        new THREE.Quaternion().setFromAxisAngle(
          new THREE.Vector3(0, 1, 0),
          turn,
        ),
        new THREE.Vector3(1, 1, 1),
      );
      placed.push({ name, m });
    }
    if (has('tent'))
      for (const [x, z, side] of tents) {
        const team: Team = side === this.viewSide ? 0 : 1;
        const tent = this.instance(props, 'tent', team);
        tent.position.set(x, groundHeight(x, z) - 0.04, z);
        tent.rotation.y = side ? Math.PI : 0;
        dressing.push(...bakeStatic(tent));
      }
    // Camp clutter round the carts, wells and tents: barrels, stacked
    // crates, firewood and a chopping stump, and split-rail paddocks by the
    // side camps. Placed by hand in side 0's frame; side 1's is turned round.
    const clutter: [string, number, number, number, number?][] = [
      // By the well, the hay and the cart on the left.
      ['barrel', -12.4, 5.3, 0.3],
      ['barrel', -12.1, 6.1, 1.9],
      ['crate', -17.2, 8.9, 0.2],
      ['crate', -17.25, 8.9, 0.5, 0.76],
      ['crate', -16.4, 9.2, 1.1],
      ['log', -18.2, 5.6, 1.62],
      ['log', -18.75, 5.7, 1.5],
      ['log', -18.45, 5.65, 1.56, 0.36],
      ['stump', -12.5, 9.2, 0.7],
      // Behind the far king: the hay and the cart by the tent.
      ['crate', -10.9, -21.4, 0.4],
      ['barrel', -7.6, -21.6, 2.2],
      ['barrel', 11.7, -22.4, 0.8],
      ['crate', 12.4, -23.3, 0.3],
      ['crate', 12.4, -23.3, 1.2, 0.76],
      ['log', 10.2, -25.6, 0.1],
      ['log', 10.3, -26.15, 0.2],
    ];
    // Round each tent, in its own frame: barrels, crates and a woodpile.
    const tentKit: [string, number, number, number, number?][] = [
      ['barrel', 2.4, 0.9, 0.2],
      ['barrel', 2.9, 0.2, 1.3],
      ['crate', -2.5, 1.1, 0.3],
      ['crate', -2.5, 1.1, 0.9, 0.76],
      ['stump', 1.6, 2.7, 0.4],
      ['log', -1.3, 2.8, 0.1],
    ];
    for (const [x, z, side] of tents)
      for (const [name, dx, dz, turn, lift] of tentKit)
        clutter.push([
          name,
          x + (side ? -dx : dx),
          z + (side ? -dz : dz),
          turn + (side ? Math.PI : 0),
          lift,
        ]);
    // The right-hand camp is the left one turned round the field's centre.
    for (const item of clutter.slice(0, 9)) {
      const [name, x, z, turn, lift] = item;
      clutter.push([name, -x, -z, turn + Math.PI, lift]);
    }
    for (const [name, x, z, turn, lift] of clutter) {
      if (!has(name)) continue;
      const base = groundHeight(x, z) - 0.04;
      put(name, x, z, 1, base + (lift ?? 0), { turn });
      claim(x, z, 0.5);
    }
    // Paddock fences: panels 2.5 m long, following the slope, with a gate.
    const fences: [number, number, boolean][] = [
      [-18.35, 10.3, false],
      [-15.85, 10.3, false],
      [-13.35, 10.3, false],
      [-19.6, 9.05, true],
      [-19.6, 6.55, true],
      // A short run by the far king's hay.
      [-12.4, -20.4, false],
      [-9.9, -20.4, false],
    ];
    for (const [x, z, alongSide] of fences.slice(0, 5))
      fences.push([-x, -z, alongSide]);
    if (has('fence-wood'))
      for (const [x, z, alongSide] of fences) {
        const [dx, dz] = alongSide ? [0, -1.25] : [1.25, 0];
        const rise =
          groundHeight(x + dx, z + dz) - groundHeight(x - dx, z - dz);
        put('fence-wood', x, z, 1, groundHeight(x, z) - 0.03, {
          turn: (alongSide ? Math.PI / 2 : 0) + (rnd() - 0.5) * 0.08,
          roll: Math.atan2(rise, 2.5),
        });
        for (const s of [-1, 0, 1]) claim(x + dx * s, z + dz * s, 0.6);
      }

    const density = this.quality.props;
    // Phones look steeply down on the field and never see the valley's
    // sides; their trees stop where a shadow could still reach the field.
    const lite = this.quality.tier === 'lite';
    const phoneMiss = (x: number) => lite && Math.abs(x) > 16.5;
    // +1 when the viewer sits at the slab's +z end. The band on their end
    // stays low, so nothing tall stands between the camera and the field.
    const toward = this.viewSide === 1 ? -1 : 1;
    const nearBand = (x: number, z: number) =>
      z * toward > 17.6 && Math.abs(x) < 13.5;
    /** How far a point lies outside the field's walls. */
    const outside = (x: number, z: number) =>
      Math.hypot(
        Math.max(0, Math.abs(x) - 10.6),
        Math.max(0, Math.abs(z) - 18),
      );
    // A second noise, for which woods are pine and which are oak.
    const groveAt = (x: number, z: number) =>
      forestAt(this.noise, x * 1.9 + 83, z * 1.9 - 41);

    // Crags first: stacked outcrops out in the far woods and the hills.
    let crags = 0;
    for (let i = 0; i < 400 && crags < (lite ? 3 : 8); i++) {
      if (!kinds.cliffs.length) break;
      const x = PLINTH.left + rnd() * (PLINTH.right - PLINTH.left);
      const z = PLINTH.far + rnd() * (PLINTH.near - PLINTH.far);
      const s = 0.9 + rnd() * 0.6;
      // Not straight behind the far king, where a crag reads as a chimney
      // over its roof.
      if (outside(x, z) < 7 || z * toward > 6 || Math.abs(z) < 6) continue;
      if (Math.abs(x) < 14) continue;
      if (!onSlab(x, z, 3) || !clear(x, z) || phoneMiss(x)) continue;
      if (!roomy(x, z, 2.6 * s, 1.6)) continue;
      claim(x, z, 2.6 * s);
      put(pick(kinds.cliffs), x, z, s, groundHeight(x, z) - 0.12);
      crags++;
    }

    // The woods: dense stands of oak and pine that close in round the
    // field, thin to lone trees in the clearings and grow taller towards
    // the back of the valley. Trunks keep off the walls, the stream and
    // the camps; crowns may touch.
    const trees: [number, number, number][] = [];
    const smooth = (a: number, b: number, v: number) => {
      const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
      return t * t * (3 - 2 * t);
    };
    for (const [x, z] of sample(1.2)) {
      const d = outside(x, z);
      const az = Math.abs(z);
      if (d < 1.8 || az < 3.2 || phoneMiss(x)) continue;
      if (nearBand(x, z) && z * toward < 23.5) continue;
      if (!clear(x, z)) continue;
      const wood = forestAt(this.noise, x, z);
      const edge = smooth(1.8, 5.5, d);
      const back = smooth(6, 15, d);
      let p = Math.max(edge * (0.62 + 0.38 * wood), back * 0.95);
      // The stream's banks and the near band stay more open.
      p *= 0.45 + 0.55 * smooth(3.2, 6, az);
      if (nearBand(x, z)) p *= 0.45;
      if (rnd() > p * density) continue;
      const pineShare =
        0.2 +
        0.25 * smooth(0.8, 2.1, groundHeight(x, z)) +
        0.4 * (groveAt(x, z) - 0.4);
      const pine = kinds.pines.length > 0 && rnd() < pineShare;
      const list = pine || !kinds.oaks.length ? kinds.pines : kinds.oaks;
      if (!list.length) break;
      let s = (0.76 + rnd() * 0.36) * (1 + 0.3 * back);
      // Saplings where the woods open onto the meadow.
      if (edge < 0.75 && rnd() < 0.4) s *= 0.66;
      if (nearBand(x, z)) s = Math.min(s, 0.9);
      const r = (pine ? 1.35 : 2) * s;
      if (!onSlab(x, z, 0.5 + 0.45 * r) || !roomy(x, z, r * 0.5)) continue;
      claim(x, z, r * 0.5);
      trees.push([x, z, r]);
      // Far from the camera a tree covers a few dozen pixels: its far
      // model has a third of the triangles. Judged from the desktop
      // camera's spot, so every device places the same trees.
      const name = pick(list);
      const far = `${name}-far`;
      const away = Math.hypot(x, 22, z - 38 * toward) > 50 && has(far);
      put(away ? far : name, x, z, s, undefined, {
        tilt: 0.05,
        stretch: 0.9 + rnd() * 0.24,
      });
    }
    /** How deep under a crown a point is: 0 in the open, 1 at a trunk. */
    const shade = (x: number, z: number) => {
      let deep = 0;
      for (const [tx, tz, r] of trees) {
        const dx = x - tx;
        const dz = z - tz;
        if (Math.abs(dx) > r || Math.abs(dz) > r) continue;
        deep = Math.max(deep, 1 - Math.hypot(dx, dz) / r);
      }
      return deep;
    };

    // Rock clusters out in the meadows and the woods, big stones among
    // small ones.
    for (let i = 0, made = 0; i < 300 && made < 30 * density; i++) {
      if (!kinds.rocks.length) break;
      const x = PLINTH.left + rnd() * (PLINTH.right - PLINTH.left);
      const z = PLINTH.far + rnd() * (PLINTH.near - PLINTH.far);
      if (outside(x, z) < 2.4 || Math.abs(z) < 2.4 || phoneMiss(x)) continue;
      if (nearBand(x, z) || !onSlab(x, z, 1.5) || !clear(x, z)) continue;
      made++;
      const n = 2 + Math.floor(rnd() * 3);
      for (let k = 0; k < n; k++) {
        const a = rnd() * Math.PI * 2;
        const at = k ? 0.6 + rnd() * 0.8 : 0;
        const [rx, rz] = [x + Math.cos(a) * at, z + Math.sin(a) * at];
        const big = k === 0 && kinds.boulders.length > 0 && rnd() < 0.5;
        const s = big ? 0.8 + rnd() * 0.5 : 0.5 + rnd() * 0.6;
        if (!roomy(rx, rz, 0.55 * s, 0.8)) continue;
        claim(rx, rz, 0.55 * s);
        put(pick(big ? kinds.boulders : kinds.rocks), rx, rz, s, undefined, {
          tilt: 0.25,
        });
      }
    }

    // The understory: a hedge of bushes and stones along the walls, bushes
    // where the woods meet the meadow, rocks on the stream's banks, and
    // stumps and fallen logs in the woods.
    for (const [x, z] of sample(0.9)) {
      const d = outside(x, z);
      const az = Math.abs(z);
      if (d < 0.35 || az < 1.8 || phoneMiss(x)) continue;
      const low = nearBand(x, z);
      if (low && z * toward < 19.2) continue;
      if (!onSlab(x, z, 0.9) || !clear(x, z)) continue;
      const deep = shade(x, z);
      const hedge = 1 - smooth(0.6, 2.8, d);
      const rim = deep > 0 && deep < 0.4 ? 1 : 0;
      const bank = 1 - smooth(2, 3.4, az);
      const p =
        0.5 * hedge + 0.45 * rim + 0.35 * bank + (deep >= 0.4 ? 0.06 : 0.05);
      if (rnd() > p * density) continue;
      const roll = rnd();
      let name: string | undefined;
      let s = 1;
      if (deep >= 0.4) {
        // Under the canopy only deadwood and stones show between trunks.
        name = pick(roll < 0.55 ? kinds.deadwood : kinds.rocks);
        s = 0.8 + rnd() * 0.4;
      } else if (bank > 0.3 && roll < 0.6) {
        name = pick(kinds.rocks);
        s = 0.5 + rnd() * 0.6;
      } else if (roll < 0.74) {
        name = pick(kinds.bushes);
        s = hedge > 0.5 ? 0.6 + rnd() * 0.4 : 0.7 + rnd() * 0.55;
      } else if (roll < 0.92 || !rim) {
        // Out on the open meadow only stones; logs lie by the woods.
        name = pick(kinds.rocks);
        s = 0.55 + rnd() * 0.7;
      } else {
        name = pick(kinds.deadwood);
        s = 0.8 + rnd() * 0.35;
      }
      if (!name) continue;
      if (low) s = Math.min(s, 0.85);
      const r = 0.6 * s;
      if (!roomy(x, z, r, 0.85)) continue;
      claim(x, z, r);
      put(name, x, z, s, undefined, {
        tilt: name.startsWith('rock') ? 0.25 : 0.06,
      });
    }
    // Grass tufts and flowers along the walls and banks inside the field.
    for (let i = 0; i < 700 * density; i++) {
      const x = (rnd() - 0.5) * 19;
      const z = (rnd() - 0.5) * 34;
      const nearWall = Math.abs(x) > 8.3 || Math.abs(z) > 15.8;
      const nearBank = Math.abs(Math.abs(z) - 1.5) < 0.35;
      if (!nearWall && !nearBank) continue;
      if (Math.abs(Math.abs(x) - 5.5) < 1.5 && Math.abs(z) < 3) continue;
      if (rnd() < 0.7 && kinds.tufts.length)
        put('tufts', x, z, 0.8 + rnd() * 0.6, 0);
      else if (kinds.flowers.length)
        put(pick(kinds.flowers), x, z, 0.8 + rnd() * 0.5, 0);
    }
    // Static grass and wild flowers over the valley: thick along the walls
    // and the woods' edges, in drifts of flowers on the meadows, sparse
    // under the canopy where nobody sees them. Their fibres are many tiny
    // triangles, so they thin out away from the field, and none hide
    // inside a bush or under a stone.
    for (let i = 0; i < 1700 * density; i++) {
      const x = PLINTH.left + rnd() * (PLINTH.right - PLINTH.left);
      const z = PLINTH.far + rnd() * (PLINTH.near - PLINTH.far);
      const d = outside(x, z);
      if (d < 0.2 || Math.abs(z) < 1.7 || phoneMiss(x)) continue;
      if (rnd() > 1 - 0.7 * smooth(3, 15, d)) continue;
      if (!onSlab(x, z, 0.7) || !clear(x, z)) continue;
      if (shade(x, z) > 0.4 && rnd() < 0.9) continue;
      if (!roomy(x, z, 0, 0.8)) continue;
      const drift = groveAt(x * 1.4 + 17, z * 1.4 - 9) > 0.55;
      if (drift ? rnd() < 0.55 : rnd() < 0.15) {
        if (kinds.flowers.length)
          put(pick(kinds.flowers), x, z, 0.9 + rnd() * 0.6);
      } else if (kinds.tufts.length) put('tufts', x, z, 0.9 + rnd() * 0.9);
    }
    // One instanced mesh per prop part keeps the draw calls low; culling
    // each instance for the camera and for the sun's shadow box skips the
    // woods nobody sees.
    const byName = new Map<string, THREE.Matrix4[]>();
    for (const p of placed) {
      const list = byName.get(p.name) ?? [];
      list.push(p.m);
      byName.set(p.name, list);
    }
    const scatter = new ScatterCuller();
    for (const [name, matrices] of byName) {
      const source = this.instance(props, name, 0);
      source.updateMatrixWorld(true);
      const small = name === 'tufts' || name.startsWith('flowers');
      source.traverse((node) => {
        const mesh = node as THREE.Mesh;
        if (!mesh.isMesh) return;
        const local = mesh.matrixWorld;
        scatter.add(
          name,
          mesh.geometry,
          mesh.material as THREE.Material,
          matrices.map((m) => m.clone().multiply(local)),
          !small,
          true,
        );
      });
    }
    for (const mesh of scatter.meshes) {
      this.scene.add(mesh);
      freeze(mesh);
    }
    this.scatter = scatter;
    // Torches at the field's corners.
    if (has('torch')) {
      for (const [x, z] of [
        [-10.4, 17.8],
        [10.4, 17.8],
        [-10.4, -17.8],
        [10.4, -17.8],
        [-10.4, 2.2],
        [10.4, 2.2],
        [-10.4, -2.2],
        [10.4, -2.2],
      ]) {
        const torch = this.instance(props, 'torch', 0);
        torch.position.set(x, 0, z);
        dressing.push(...bakeStatic(torch));
      }
    }
    if (has('banner-post')) {
      for (const [x, z, side] of [
        [-10.6, 11, 0],
        [10.6, 11, 0],
        [-10.6, -11, 1],
        [10.6, -11, 1],
      ] as const) {
        const team: Team = side === this.viewSide ? 0 : 1;
        const post = this.instance(props, 'banner-post', team);
        post.position.set(x, 0, z);
        post.rotation.y = side ? Math.PI : 0;
        dressing.push(...bakeStatic(post));
      }
    }
  }

  resize(width: number, height: number) {
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  setCamera(
    position: [number, number, number],
    target: [number, number, number],
    fov: number,
  ) {
    this.camera.fov = fov;
    this.camera.position.set(...position);
    this.camera.lookAt(new THREE.Vector3(...target));
    this.camera.updateProjectionMatrix();
    // Keep the sun's shadow box on the field, shining from the same corner
    // of the screen from either end.
    const turn = this.viewSide === 1 ? -1 : 1;
    this.sun.target.position.set(target[0], 0, target[2] - 2 * turn);
    this.sun.position.set(target[0] - 17 * turn, 34, target[2] + 13 * turn);
    this.sun.target.updateMatrixWorld();
  }

  /** Draw the sun's shadows every frame (1) or every other one (2), as
   *  the pacer chooses. */
  shadowEvery: 1 | 2 = 1;
  private frames = 0;

  /** A new shadow map size; the next frame builds the map afresh. */
  setShadowSize(size: number) {
    const shadow = this.sun.shadow;
    if (shadow.mapSize.x === size) return;
    shadow.mapSize.set(size, size);
    shadow.map?.dispose();
    shadow.map = null;
  }

  render() {
    this.towerStatics?.sync();
    // Props are culled for this camera; another camera would need its own.
    this.scatter?.update(this.camera, this.sun);
    const shadows = this.renderer.shadowMap;
    shadows.autoUpdate = this.shadowEvery === 1;
    if (this.shadowEvery > 1 && this.frames % this.shadowEvery === 0)
      shadows.needsUpdate = true;
    this.frames++;
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.towerStatics?.dispose();
    this.materials.dispose();
    for (const d of this.disposables) d.dispose();
    this.scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) mesh.geometry.dispose();
    });
    this.scatter?.dispose();
    for (const set of Object.values(this.assets.textures))
      for (const t of [set.map, set.normalMap, set.ormMap]) t.dispose();
    this.renderer.dispose();
  }
}
