import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  DIRS,
  ORDER,
  MACHINES,
  TICK_MS,
  floorSize,
  intakes,
  itemValue,
  outlets,
  type Dir,
  type FactoryState,
  type Item,
  type Machine,
  type MachineKind,
} from '@/lib/games/relic/factory';
import {
  PACKS,
  packFor,
  type PackId,
  type ScratchState,
} from '@/lib/games/relic/scratch';
import { TICKET_ART } from '../relic-scratch-art';
import { Pacer, type Rung } from '../render-pacer';
import { nativeRatio, startLevel } from '../render-quality';
import { FactoryCamera, type Insets, type ScreenPoint } from './camera';
import { factoryQuality } from './quality';
import { Kit, type MatKey } from './kit';
import {
  BELT_TOP,
  C,
  STATUS,
  beltModel,
  buildModel,
  pose,
  type BeltShape,
  type Ctx,
  type ModelDef,
  type PartDef,
  type Pose,
} from './models';
import {
  arrowTexture,
  badgeTexture,
  chevronTexture,
  glowTexture,
  FLOOR_TILES_PER_REPEAT,
  REACH_STYLE,
  floorBumpTexture,
  floorTexture,
  reachTexture,
  gridTexture,
  makeMaterials,
  markTexture,
  shadowTexture,
  starGeometry,
} from './look';
import { boosted, job, statusOf, type MachineStatus } from './status';
import { SaleFx } from './fx';
import type { Overlay as EditorOverlay } from './editor';

/**
 * Lucky's ticket factory in 3D (3 October 2026): a brass-framed enamel
 * floor seen from a three-quarter camera that fits the whole floor
 * into the stage (turned a quarter on tall screens), with every machine a
 * modelled toy whose moving parts show what it does and whose lamp shows
 * how it is doing. The engine still steps every 500 ms; between snapshots
 * tickets glide, gauges fill and parts move on the frame clock.
 *
 * Cost stays flat however big the factory grows: every machine kind is a
 * few instanced meshes (one per material, plus one per moving part), the
 * belts are three instanced shapes whose tops scroll in the shader, and
 * the tickets are one instanced mesh per book. A frame pacer lowers the
 * shadow updates first, retaining sharp rendering on devices under load.
 */

export type Cell = { x: number; y: number };
/** What the editor draws over the floor; see `editor.ts`. */
export type Overlay = EditorOverlay;
const EMPTY: Overlay = {
  mode: 'select',
  hover: null,
  selected: [],
  erasing: [],
  ghosts: [],
  lifted: null,
  marquee: null,
  reach: [],
  handle: null,
};

type Kind = Exclude<MachineKind, 'belt'>;
/** Machines are picked up to this height: higher, thinner parts such as a
 * lamp's head or the cashier's sign leave the cells behind them clickable. */
const PICK_TOP = 0.72;
const KINDS = ORDER.filter((kind): kind is Kind => kind !== 'belt');
const MAX_LINKS = 16 * 9 * 8;
const SHAPES: BeltShape[] = ['straight', 'left', 'right'];
const TICKET_LONG = 0.44;
const STEP_S = TICK_MS / 1000;

type MView = {
  key: string;
  m: Machine;
  kind: MachineKind;
  angle: number;
  matrix: THREE.Matrix4;
  index: number;
  seed: number;
  status: MachineStatus;
  job: { work: number; perMs: number } | null;
  snapAt: number;
  /** World time of the last finished job. */
  last: number;
  turn: number;
  boost: boolean;
  /** Boosters: eased 0..1 boost and accumulated spin, so turns never jump. */
  energy: number;
  spin: number;
  shape: BeltShape;
  phase: number;
  running: boolean;
  height: number;
};
type Batch = {
  def: ModelDef;
  body: THREE.InstancedMesh[];
  parts: { def: PartDef; meshes: THREE.InstancedMesh[] }[];
  cap: number;
  list: MView[];
};
type BeltBatch = {
  geo: {
    body: Partial<Record<MatKey, THREE.BufferGeometry>>;
    top: THREE.BufferGeometry;
  };
  body: THREE.InstancedMesh[];
  top: THREE.InstancedMesh | null;
  phase: THREE.InstancedBufferAttribute | null;
  cap: number;
  list: MView[];
};
type P = { x: number; y: number; z: number; s: number };
type Ticket = {
  id: number;
  item: Item;
  a: P;
  b: P;
  t0: number;
  dur: number;
  smooth: boolean;
  /** Where it sat at the last snapshot: what made it, or where it went. */
  host: string;
  slot: 'item' | 'output' | 'hold';
  end?: () => void;
  gone?: boolean;
  tilt: number;
};
type Particle = {
  kind: 'spark';
  p: THREE.Vector3;
  v: THREE.Vector3;
  born: number;
  life: number;
  colour?: THREE.Color;
};

const tmpM = new THREE.Matrix4(),
  tmpM2 = new THREE.Matrix4(),
  tmpQ = new THREE.Quaternion(),
  tmpV = new THREE.Vector3(),
  tmpV2 = new THREE.Vector3(),
  tmpS = new THREE.Vector3(),
  tmpC = new THREE.Color(),
  yAxis = new THREE.Vector3(0, 1, 0);
const smoothstep = (x: number) =>
  x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x);
const cellKey = (x: number, y: number) => `${x},${y}`;
const hash = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

/** A camera-facing quad shader: gauges, halos, sparks and badges. */
function billboard(
  frag: string,
  opts: { additive?: boolean; map?: THREE.Texture } = {},
) {
  return new THREE.ShaderMaterial({
    uniforms: { uMap: { value: opts.map ?? null }, uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      attribute vec4 aData;
      attribute vec3 aTint;
      varying vec2 vUv;
      varying vec4 vData;
      varying vec3 vTint;
      void main() {
        vUv = uv;
        vData = aData;
        vTint = aTint;
        vec4 mv = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        float size = length(instanceMatrix[0].xyz);
        mv.xy += position.xy * size;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: frag,
    transparent: true,
    depthWrite: false,
    blending: opts.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    toneMapped: false,
  });
}
const GAUGE_FRAG = /* glsl */ `
  varying vec2 vUv;
  varying vec4 vData;
  varying vec3 vTint;
  void main() {
    vec2 p = vUv * 2.0 - 1.0;
    float r = length(p);
    float a = atan(p.x, p.y);
    float frac = (a < 0.0 ? a + 6.28318 : a) / 6.28318;
    float ring = smoothstep(0.56, 0.62, r) * (1.0 - smoothstep(0.92, 0.98, r));
    float disc = 1.0 - smoothstep(0.92, 0.98, r);
    float fill = step(frac, vData.x);
    vec3 col = mix(vec3(0.06, 0.1, 0.09), vTint, fill * ring);
    float alpha = max(disc * 0.55, ring * mix(0.5, 1.0, fill)) * vData.y;
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(col, alpha);
  }`;
const GLOW_FRAG = /* glsl */ `
  uniform sampler2D uMap;
  varying vec2 vUv;
  varying vec4 vData;
  varying vec3 vTint;
  void main() {
    vec4 t = texture2D(uMap, vUv);
    float a = t.a * vData.x;
    if (a < 0.005) discard;
    gl_FragColor = vec4(vTint * t.rgb * a, a);
  }`;
const BADGE_FRAG = /* glsl */ `
  uniform sampler2D uMap;
  varying vec2 vUv;
  varying vec4 vData;
  void main() {
    vec4 t = texture2D(uMap, vUv);
    if (t.a < 0.05) discard;
    gl_FragColor = vec4(t.rgb, t.a * vData.x);
  }`;

class Billboards {
  readonly mesh: THREE.InstancedMesh;
  private data: THREE.InstancedBufferAttribute;
  private tint: THREE.InstancedBufferAttribute;
  n = 0;
  constructor(
    material: THREE.ShaderMaterial,
    private cap: number,
  ) {
    const g = new THREE.PlaneGeometry(1, 1);
    this.data = new THREE.InstancedBufferAttribute(
      new Float32Array(cap * 4),
      4,
    );
    this.tint = new THREE.InstancedBufferAttribute(
      new Float32Array(cap * 3),
      3,
    );
    g.setAttribute('aData', this.data);
    g.setAttribute('aTint', this.tint);
    this.mesh = new THREE.InstancedMesh(g, material, cap);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.mesh.renderOrder = 5;
  }
  begin() {
    this.n = 0;
  }
  push(
    x: number,
    y: number,
    z: number,
    size: number,
    d0: number,
    d1: number,
    tint: THREE.Color,
  ) {
    if (this.n >= this.cap) return;
    tmpM.makeScale(size, size, size).setPosition(x, y, z);
    this.mesh.setMatrixAt(this.n, tmpM);
    this.data.setXYZW(this.n, d0, d1, 0, 0);
    this.tint.setXYZ(this.n, tint.r, tint.g, tint.b);
    this.n++;
  }
  end() {
    this.mesh.count = this.n;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.data.needsUpdate = true;
    this.tint.needsUpdate = true;
  }
  dispose() {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
    this.mesh.dispose();
  }
}

export type WorldOpts = {
  /** The Watch TV: someone else's factory, drawn small and cheaply. */
  mirror: boolean;
  reduced: boolean;
  /** Tells the page when the floor turns a quarter for a tall stage. */
  onTurn?: (turned: boolean) => void;
  onZoom?: (zoom: number) => void;
  /** The view moved: refit, zoom or pan. */
  onCamera?: () => void;
};

export class FactoryWorld {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private cameraRig = new FactoryCamera();
  private camera = this.cameraRig.camera;
  private mats = makeMaterials();
  private sun: THREE.DirectionalLight;
  private pmrem: THREE.PMREMGenerator;
  private defs = new Map<Kind, ModelDef>();
  private batches = new Map<Kind, Batch>();
  private belts = new Map<BeltShape, BeltBatch>();
  private beltTop: THREE.MeshStandardMaterial;
  private views = new Map<string, MView>();
  private signature = '';
  private f: FactoryState | null = null;
  private s: ScratchState | null = null;
  private overlay: Overlay = EMPTY;
  private hidden = new Set<string>();
  private floorGroup = new THREE.Group();
  private floor = { width: 0, height: 0 };
  private floorTextures: THREE.Texture[] = [];
  private grid: THREE.Mesh | null = null;
  private size = { w: 1, h: 1 };
  private insets: Insets = { top: 0, right: 0, bottom: 0, left: 0 };
  turned = false;
  private time = 0;
  private lastFrame = 0;
  private raf = 0;
  private disposed = false;
  private paused = false;
  private pacer: Pacer | null = null;
  private shadowEvery = 1;
  private frameNo = 0;
  private shadowDirty = true;
  private baseRatio = 1;
  private closeDetail = false;
  // Tickets.
  private ticketTex = new Map<PackId, THREE.Texture>();
  private ticketMeshes = new Map<PackId, THREE.InstancedMesh>();
  private ticketCaps = new Map<PackId, number>();
  private tickets = new Map<number, Ticket>();
  private coinMesh: THREE.InstancedMesh;
  private stampMesh: THREE.InstancedMesh;
  private starMesh: THREE.InstancedMesh;
  private ribbonMesh: THREE.InstancedMesh;
  // Effects.
  private gauges: Billboards;
  private halos: Billboards;
  private sparks: Billboards;
  private badges: Billboards;
  private links: THREE.InstancedMesh;
  private linkData: THREE.InstancedBufferAttribute;
  private reachPools: THREE.InstancedMesh;
  private poolData: THREE.InstancedBufferAttribute;
  private poolClip: THREE.InstancedBufferAttribute;
  private particles: Particle[] = [];
  private fx: SaleFx | null;
  // Overlay.
  private marks: THREE.InstancedMesh;
  private arrows: THREE.InstancedMesh;
  private marquee: THREE.Mesh;
  /** The box's four bright edges, drawn over the machines. */
  private marqueeEdges: THREE.Mesh[];
  private ghostRoot = new THREE.Group();
  private ghostMat: THREE.MeshStandardMaterial;
  private ghostBad: THREE.MeshStandardMaterial;
  private ghostSolid: THREE.MeshStandardMaterial;
  private ghostGeos = new Map<
    MachineKind,
    { geo: THREE.BufferGeometry; pivot?: THREE.Vector3 }[]
  >();
  private ghostPool: THREE.Group[] = [];
  private textures: THREE.Texture[] = [];
  private raycaster = new THREE.Raycaster();
  private ctx: Ctx = {
    t: 0,
    work: -1,
    status: 'idle',
    since: 99,
    turn: 0,
    boost: false,
    hold: 0,
    seed: 0,
    energy: 0,
    spin: 0,
  };
  private poseOut: Pose = {
    p: new THREE.Vector3(),
    r: new THREE.Euler(),
    s: 1,
  };
  private stillCtx: Ctx = {
    t: 0,
    work: -1,
    status: 'idle',
    since: 99,
    turn: 0,
    boost: false,
    hold: 0,
    seed: 0,
    energy: 0,
    spin: 0,
  };

  constructor(
    private canvas: HTMLCanvasElement,
    fxLayer: HTMLElement | null,
    private opts: WorldOpts,
  ) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.96;
    this.renderer.shadowMap.enabled = !opts.mirror;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.shadowMap.autoUpdate = false;
    this.baseRatio = opts.mirror ? 1 : Math.max(1, nativeRatio());
    this.renderer.setPixelRatio(this.baseRatio);

    this.pmrem = new THREE.PMREMGenerator(this.renderer);
    const room = new RoomEnvironment();
    const env = this.pmrem.fromScene(room, 0.04).texture;
    room.dispose();
    this.scene.environment = env;
    this.scene.environmentIntensity = 0.38;
    this.textures.push(env);

    this.scene.add(new THREE.HemisphereLight('#f4f2e2', '#4f5d52', 1.2));
    this.sun = new THREE.DirectionalLight('#fff1dd', 2.15);
    this.sun.castShadow = !opts.mirror;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.012;
    this.scene.add(this.sun, this.sun.target);
    const fill = new THREE.DirectionalLight('#bfe0d2', 0.3);
    fill.position.set(20, 8, -14);
    this.scene.add(fill);
    this.scene.add(this.floorGroup, this.ghostRoot);

    for (const kind of KINDS) this.defs.set(kind, buildModel(kind));
    const chevron = chevronTexture();
    chevron.anisotropy = Math.min(
      16,
      this.renderer.capabilities.getMaxAnisotropy(),
    );
    this.textures.push(chevron);
    this.beltTop = new THREE.MeshStandardMaterial({
      map: chevron,
      roughness: 0.75,
      metalness: 0,
    });
    this.beltTop.onBeforeCompile = (shader) => {
      shader.vertexShader =
        'attribute float aPhase;\n' +
        shader.vertexShader.replace(
          '#include <uv_vertex>',
          '#include <uv_vertex>\n#ifdef USE_MAP\n  vMapUv.x -= aPhase * 2.0;\n#endif',
        );
    };
    for (const shape of SHAPES) {
      const model = beltModel(shape);
      this.belts.set(shape, {
        geo: { body: model.body, top: model.top },
        body: [],
        top: null,
        phase: null,
        cap: 0,
        list: [],
      });
    }

    // Tickets: one instanced mesh per book, plus what rides on them.
    const loader = new THREE.TextureLoader();
    for (const p of PACKS) {
      const tex = loader.load(
        opts.mirror ? TICKET_ART[p.id].small : TICKET_ART[p.id].src,
      );
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = Math.min(
        16,
        this.renderer.capabilities.getMaxAnisotropy(),
      );
      this.ticketTex.set(p.id, tex);
      this.textures.push(tex);
    }
    const one = (mat: MatKey, build: (k: Kit) => void) => {
      const k = new Kit();
      build(k);
      return k.merged()[mat]!;
    };
    const coinGeo = one('metal', (k) =>
      k.cyl('metal', C.gold, 0.06, 0.06, 0.016, [0, 0, 0], { seg: 16 }),
    );
    this.coinMesh = this.instanced(coinGeo, this.mats.metal, 256);
    const stampGeo = one('gloss', (k) =>
      k
        .cyl('gloss', C.red, 0.045, 0.045, 0.008, [0, 0, 0], { seg: 24 })
        .torus('gloss', C.redDark, 0.046, 0.006, [0, 0.003, 0], { seg: 24 })
        .chevron('gloss', C.cream, 0.028, 0.029, 0.003, [0.003, 0.006, 0]),
    );
    this.stampMesh = this.instanced(stampGeo, this.mats.gloss, 128);
    const star = starGeometry(0.075);
    star.setAttribute(
      'color',
      new THREE.BufferAttribute(
        new Float32Array(star.getAttribute('position').count * 3).fill(1),
        3,
      ),
    );
    this.starMesh = this.instanced(
      star,
      new THREE.MeshBasicMaterial({ color: '#ecd48e', toneMapped: false }),
      128,
    );
    const ribbonGeo = one('gloss', (k) =>
      k.box('gloss', C.ribbon, [0.05, 0.02, 0.44], [0, 0, 0]),
    );
    this.ribbonMesh = this.instanced(ribbonGeo, this.mats.gloss, 64);

    const glow = glowTexture(),
      badge = badgeTexture();
    this.textures.push(glow, badge);
    this.gauges = new Billboards(billboard(GAUGE_FRAG), 160);
    this.halos = new Billboards(
      billboard(GLOW_FRAG, { additive: true, map: glow }),
      200,
    );
    this.sparks = new Billboards(
      billboard(GLOW_FRAG, { additive: true, map: glow }),
      240,
    );
    this.badges = new Billboards(billboard(BADGE_FRAG, { map: badge }), 64);
    this.badges.mesh.renderOrder = 8;
    this.scene.add(
      this.gauges.mesh,
      this.halos.mesh,
      this.sparks.mesh,
      this.badges.mesh,
    );

    // Always-visible 3x3 reach, clipped to the workshop, one instanced pass.
    const warmPool = reachTexture(),
      charmPool = reachTexture(true);
    this.textures.push(warmPool, charmPool);
    const poolGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    this.poolData = new THREE.InstancedBufferAttribute(
      new Float32Array(144 * 4),
      4,
    );
    this.poolClip = new THREE.InstancedBufferAttribute(
      new Float32Array(144 * 4),
      4,
    );
    poolGeo.setAttribute('aPool', this.poolData);
    poolGeo.setAttribute('aClip', this.poolClip);
    this.reachPools = new THREE.InstancedMesh(
      poolGeo,
      new THREE.ShaderMaterial({
        uniforms: { uWarm: { value: warmPool }, uCharm: { value: charmPool } },
        vertexShader: /* glsl */ `
        attribute vec4 aPool;
        attribute vec4 aClip;
        varying vec2 vUv;
        varying vec4 vPool;
        void main() {
          vUv = aClip.xy + uv * aClip.zw;
          vPool = aPool;
          gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
        }`,
        fragmentShader: /* glsl */ `
        uniform sampler2D uWarm;
        uniform sampler2D uCharm;
        varying vec2 vUv;
        varying vec4 vPool;
        void main() {
          float charm = step(vPool.r, vPool.g);
          float a = mix(texture2D(uWarm, vUv).a, texture2D(uCharm, vUv).a, charm) * vPool.a;
          if (a < 0.004) discard;
          gl_FragColor = vec4(vPool.rgb, a);
          #include <colorspace_fragment>
        }`,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
      }),
      144,
    );
    this.reachPools.count = 0;
    this.reachPools.frustumCulled = false;
    this.reachPools.renderOrder = 1;
    this.scene.add(this.reachPools);

    // Boost links: arcs from a booster to each machine it helps, with pulses.
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0.5, 0.32, 0),
      new THREE.Vector3(1, 0, 0),
    );
    const linkGeo = new THREE.TubeGeometry(curve, 16, 0.018, 5, false);
    this.linkData = new THREE.InstancedBufferAttribute(
      new Float32Array(MAX_LINKS * 4),
      4,
    );
    linkGeo.setAttribute('aLink', this.linkData);
    this.links = new THREE.InstancedMesh(
      linkGeo,
      new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 } },
        vertexShader: /* glsl */ `
          attribute vec4 aLink;
          varying float vU;
          varying vec4 vLink;
          void main() {
            vU = uv.x;
            vLink = aLink;
            gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
          }`,
        fragmentShader: /* glsl */ `
          uniform float uTime;
          varying float vU;
          varying vec4 vLink;
          void main() {
            float pulse = pow(fract(vU - uTime * 0.9 + vLink.w), 6.0);
            float ends = smoothstep(0.0, 0.12, vU) * smoothstep(1.0, 0.85, vU);
            float a = (0.22 + pulse * 0.9) * ends;
            gl_FragColor = vec4(vLink.rgb * a, a);
          }`,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
      MAX_LINKS,
    );
    this.links.frustumCulled = false;
    this.links.count = 0;
    this.scene.add(this.links);

    // Overlay marks on the floor.
    const mark = markTexture(),
      arrow = arrowTexture();
    this.textures.push(mark, arrow);
    const flat = (tex: THREE.Texture) => {
      const g = new THREE.PlaneGeometry(1, 1);
      g.rotateX(-Math.PI / 2);
      const m = new THREE.InstancedMesh(
        g,
        new THREE.MeshBasicMaterial({
          map: tex,
          transparent: true,
          depthWrite: false,
          toneMapped: false,
        }),
        320,
      );
      m.frustumCulled = false;
      m.count = 0;
      m.renderOrder = 3;
      m.setColorAt(0, new THREE.Color('#fff'));
      return m;
    };
    this.marks = flat(mark);
    this.arrows = flat(arrow);
    const mq = new THREE.PlaneGeometry(1, 1);
    mq.rotateX(-Math.PI / 2);
    this.marquee = new THREE.Mesh(
      mq,
      new THREE.MeshBasicMaterial({
        color: '#ffd25e',
        transparent: true,
        opacity: 0.3,
        depthWrite: false,
      }),
    );
    this.marquee.renderOrder = 4;
    this.marquee.visible = false;
    const edge = new THREE.MeshBasicMaterial({
      color: '#ffe08a',
      depthTest: false,
      depthWrite: false,
    });
    this.marqueeEdges = Array.from({ length: 4 }, () => {
      const m = new THREE.Mesh(mq, edge);
      m.renderOrder = 5;
      m.visible = false;
      return m;
    });
    this.scene.add(this.marks, this.arrows, this.marquee, ...this.marqueeEdges);
    this.ghostMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.62,
      roughness: 0.4,
      emissive: '#3b2a10',
      depthWrite: false,
    });
    this.ghostBad = new THREE.MeshStandardMaterial({
      color: '#ff6a5c',
      vertexColors: true,
      transparent: true,
      opacity: 0.55,
      roughness: 0.4,
      emissive: '#5a0d08',
      depthWrite: false,
    });
    // Just built or moved: nearly solid until the server confirms it.
    this.ghostSolid = new THREE.MeshStandardMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.92,
      roughness: 0.45,
    });

    this.fx =
      fxLayer && !opts.mirror ? new SaleFx(fxLayer, opts.reduced) : null;
    if (!opts.mirror) {
      const rungs = factoryQuality(this.baseRatio, false);
      this.pacer = new Pacer(
        rungs,
        (r) => this.applyRung(r),
        startLevel(rungs, window.innerWidth, window.innerHeight, this.baseRatio),
      );
      if (this.pacer.level) this.applyRung(this.pacer.rung);
    }
    this.lastFrame = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  private instanced(
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    cap: number,
  ) {
    const m = new THREE.InstancedMesh(geo, mat, cap);
    m.count = 0;
    m.frustumCulled = false;
    m.receiveShadow = true;
    this.scene.add(m);
    return m;
  }

  private applyRung(r: Rung) {
    this.renderer.setPixelRatio(this.baseRatio * r.resolution);
    this.renderer.setSize(this.size.w, this.size.h, false);
    this.shadowEvery = r.shadowEvery;
    if (this.sun.shadow.mapSize.x !== r.shadowSize) {
      this.sun.shadow.mapSize.set(r.shadowSize, r.shadowSize);
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
      this.shadowDirty = true;
    }
  }

  /** The floor's size in cells, once built. */
  get floorSize() {
    return this.floor;
  }

  /** Stops drawing while another tab covers the factory. */
  setPaused(paused: boolean) {
    if (paused === this.paused) return;
    this.paused = paused;
    // The first frame back must not count the hidden time.
    if (!paused) this.lastFrame = performance.now();
  }

  /** Room taken by floating controls; the overview fits the floor beside it. */
  setInsets(insets: Insets) {
    const same = (Object.keys(insets) as (keyof Insets)[]).every(
      (k) => Math.abs(insets[k] - this.insets[k]) < 1,
    );
    if (same) return;
    this.insets = insets;
    this.fx?.clear();
    this.fit();
  }

  resize(w: number, h: number) {
    if (w < 2 || h < 2) return;
    this.size = { w, h };
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.fx?.clear();
    this.fit();
  }

  /** The floor and its frame; rebuilt when the floor grows. */
  private buildFloor(width: number, height: number) {
    for (const texture of this.floorTextures) texture.dispose();
    this.floorTextures = [];
    while (this.floorGroup.children.length) {
      const child = this.floorGroup.children[0];
      this.floorGroup.remove(child);
      const mesh = child as THREE.Mesh;
      mesh.geometry?.dispose();
      if ((child as THREE.InstancedMesh).isInstancedMesh)
        (child as THREE.InstancedMesh).dispose();
      const mat = mesh.material as THREE.Material & {
        map?: THREE.Texture | null;
      };
      if (
        mat &&
        mat !== this.mats.glow &&
        mat !== this.mats.metal &&
        mat !== this.mats.gloss
      ) {
        mat.dispose();
      }
    }
    this.floor = { width, height };
    const tex = floorTexture();
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(
      width / FLOOR_TILES_PER_REPEAT,
      height / FLOOR_TILES_PER_REPEAT,
    );
    tex.anisotropy = Math.min(
      16,
      this.renderer.capabilities.getMaxAnisotropy(),
    );
    const bump = this.opts.mirror ? null : floorBumpTexture();
    if (bump) {
      bump.repeat.copy(tex.repeat);
      bump.anisotropy = tex.anisotropy;
      this.floorTextures.push(bump);
    }
    this.floorTextures.push(tex);
    const tiles = new THREE.Mesh(
      new THREE.PlaneGeometry(width, height).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({
        map: tex,
        bumpMap: bump,
        bumpScale: 0.005,
        roughness: 0.94,
        metalness: 0,
        envMapIntensity: 0.2,
        color: '#a9b8a2',
      }),
    );
    tiles.position.set(width / 2, 0, height / 2);
    tiles.receiveShadow = true;
    const gridTex = gridTexture();
    this.floorTextures.push(gridTex);
    gridTex.repeat.set(width, height);
    this.grid = new THREE.Mesh(
      new THREE.PlaneGeometry(width, height).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({
        map: gridTex,
        transparent: true,
        opacity: 0.12,
        depthWrite: false,
      }),
    );
    this.grid.position.set(width / 2, 0.003, height / 2);
    this.grid.renderOrder = 1;
    const k = new Kit(),
      t = 0.24,
      rimH = 0.13;
    // A bottle-green enamel rim with a thin satin brass cap, like the
    // desk's own plates, and a dark apron under it.
    for (const [size, at] of [
      [
        [width + t * 2, rimH, t],
        [width / 2, rimH / 2 - 0.02, -t / 2],
      ],
      [
        [width + t * 2, rimH, t],
        [width / 2, rimH / 2 - 0.02, height + t / 2],
      ],
      [
        [t, rimH, height],
        [-t / 2, rimH / 2 - 0.02, height / 2],
      ],
      [
        [t, rimH, height],
        [width + t / 2, rimH / 2 - 0.02, height / 2],
      ],
    ] as [[number, number, number], [number, number, number]][]) {
      k.rbox('paint', '#2b5246', size, 0.04, at);
      k.rbox(
        'paint',
        '#a08957',
        [size[0] - 0.02, 0.014, size[2] - 0.02],
        0.006,
        [at[0], rimH - 0.02 + 0.004, at[2]],
      );
    }
    k.rbox(
      'paint',
      '#1d3d34',
      [width + t * 2 + 0.04, 0.42, height + t * 2 + 0.04],
      0.05,
      [width / 2, -0.23, height / 2],
    );
    k.box(
      'paint',
      '#142e27',
      [width + t * 2 + 0.06, 0.03, height + t * 2 + 0.06],
      [width / 2, -0.33, height / 2],
    );
    const frame = k.merged();
    for (const [mat, geo] of Object.entries(frame) as [
      MatKey,
      THREE.BufferGeometry,
    ][]) {
      const mesh = new THREE.Mesh(geo, this.mats[mat]);
      mesh.receiveShadow = true;
      mesh.castShadow = true;
      this.floorGroup.add(mesh);
    }
    const shadowMap = shadowTexture();
    this.floorTextures.push(shadowMap);
    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(width + 4, height + 4).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({
        map: shadowMap,
        transparent: true,
        depthWrite: false,
        color: '#000',
      }),
    );
    shadow.position.set(width / 2, -0.45, height / 2 + 0.3);
    shadow.renderOrder = -1;
    this.floorGroup.add(tiles, this.grid, shadow);
    // The sun covers the floor.
    const r = Math.max(width, height) * 0.75 + 2;
    this.sun.position.set(
      width / 2 - width * 0.35 - 4,
      14,
      height / 2 + height * 0.25 + 3,
    );
    this.sun.target.position.set(width / 2, 0, height / 2);
    const cam = this.sun.shadow.camera;
    cam.left = cam.bottom = -r;
    cam.right = cam.top = r;
    cam.near = 1;
    cam.far = 40;
    cam.updateProjectionMatrix();
    this.shadowDirty = true;
    this.fit();
  }

  /** Fit the overview while retaining the current zoom and inspected area. */
  private fit() {
    if (!this.floor.width) return;
    this.cameraRig.fit(
      this.floor.width,
      this.floor.height,
      this.size.w,
      this.size.h,
      this.insets,
    );
    this.opts.onCamera?.();
    const turned = this.cameraRig.turned;
    if (turned !== this.turned) {
      this.turned = turned;
      this.signature = '';
      this.opts.onTurn?.(turned);
      if (this.f && this.s) this.update(this.f, this.s, true);
    }
  }

  get zoom() {
    return this.cameraRig.zoom;
  }

  private screenPoint(clientX: number, clientY: number): ScreenPoint {
    const r = this.canvas.getBoundingClientRect();
    return {
      x: ((clientX - r.left) / Math.max(1, r.width)) * 2 - 1,
      y: -((clientY - r.top) / Math.max(1, r.height)) * 2 + 1,
    };
  }

  zoomTo(value: number, at?: { x: number; y: number }) {
    if (this.opts.mirror) return;
    const previous = this.zoom;
    this.cameraRig.zoomTo(value, at && this.screenPoint(at.x, at.y));
    this.opts.onZoom?.(this.zoom);
    if (this.zoom !== previous) {
      this.fx?.clear();
      this.opts.onCamera?.();
    }
    // Hysteresis prevents reallocating the shadow buffer during tiny pinches.
    const close = this.zoom > (this.closeDetail ? 1.3 : 1.6);
    if (close !== this.closeDetail) {
      this.closeDetail = close;
      // Keep the density the pacer had found; only the shadows change.
      const rungs = factoryQuality(this.baseRatio, close);
      const was = this.pacer?.rung.resolution ?? 1;
      const at = Math.max(
        0,
        rungs.findIndex((r) => r.resolution <= was + 0.001),
      );
      this.pacer = new Pacer(rungs, (r) => this.applyRung(r), at);
      this.applyRung(rungs[at]);
    }
  }

  pan(from: { x: number; y: number }, to: { x: number; y: number }) {
    if (!this.opts.mirror) {
      this.cameraRig.pan(
        this.screenPoint(from.x, from.y),
        this.screenPoint(to.x, to.y),
      );
      this.fx?.clear();
      this.opts.onCamera?.();
    }
  }

  resetView() {
    this.fx?.clear();
    this.cameraRig.reset();
    this.zoomTo(1);
  }

  /** The cell under a pointer (the machine drawn there first), and the
   * floor point under it in cells. */
  pick(
    clientX: number,
    clientY: number,
  ): { cell: Cell | null; point: { x: number; y: number } | null } {
    const r = this.canvas.getBoundingClientRect();
    if (!r.width || !this.floor.width) return { cell: null, point: null };
    const ndc = new THREE.Vector2(
      ((clientX - r.left) / r.width) * 2 - 1,
      -((clientY - r.top) / r.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(ndc, this.camera);
    const ray = this.raycaster.ray;
    const hit = ray.intersectPlane(
      new THREE.Plane(yAxis, 0),
      new THREE.Vector3(),
    );
    let best = hit ? ray.origin.distanceTo(hit) : Infinity,
      cell: Cell | null = null;
    const box = new THREE.Box3(),
      out = new THREE.Vector3();
    for (const v of this.views.values()) {
      if (this.hidden.has(v.key)) continue;
      box.min.set(v.m.x + 0.08, 0, v.m.y + 0.08);
      box.max.set(v.m.x + 0.92, Math.min(v.height, PICK_TOP), v.m.y + 0.92);
      if (ray.intersectBox(box, out)) {
        const d = ray.origin.distanceTo(out);
        if (d < best - 1e-6) {
          best = d;
          cell = { x: v.m.x, y: v.m.y };
        }
      }
    }
    const { width, height } = this.floor;
    if (!cell && hit) {
      const x = Math.floor(hit.x),
        y = Math.floor(hit.z);
      if (x >= 0 && y >= 0 && x < width && y < height) cell = { x, y };
    }
    return { cell, point: hit ? { x: hit.x, y: hit.z } : null };
  }

  /** Where a floor point (in cells) is on the page. */
  project(x: number, y: number, h = 0) {
    const r = this.canvas.getBoundingClientRect();
    tmpV.set(x, h, y).project(this.camera);
    return {
      x: r.left + ((tmpV.x + 1) / 2) * r.width,
      y: r.top + ((1 - tmpV.y) / 2) * r.height,
    };
  }

  setOverlay(o: Overlay) {
    const was = this.hidden;
    this.overlay = o;
    this.hidden = new Set(
      o.lifted ? o.lifted.from.map((c) => cellKey(c.x, c.y)) : [],
    );
    if (
      was.size !== this.hidden.size ||
      [...this.hidden].some((k) => !was.has(k))
    ) {
      this.signature = '';
      if (this.f && this.s) this.update(this.f, this.s, true);
    }
    this.drawOverlay();
  }

  /** A new snapshot of the factory (each tick, or from the server). */
  update(f: FactoryState, s: ScratchState, force = false) {
    if (!force && f === this.f && s === this.s) return;
    const prev = this.f;
    this.f = f;
    this.s = s;
    const { width, height } = floorSize(s);
    if (width !== this.floor.width || height !== this.floor.height)
      this.buildFloor(width, height);
    const signature =
      `${this.turned}|${[...this.hidden].join(';')}|` +
      f.machines
        .map((m) => `${m.kind}${m.x},${m.y},${m.dir},${m.book ?? ''}`)
        .join(';');
    const now = this.time;
    const seen = new Set<string>();
    for (const m of f.machines) {
      const key = cellKey(m.x, m.y);
      seen.add(key);
      let v = this.views.get(key);
      if (!v || v.kind !== m.kind) {
        v = {
          key,
          m,
          kind: m.kind,
          angle: 0,
          matrix: new THREE.Matrix4(),
          index: 0,
          seed: hash(m.x * 31 + m.y * 17),
          status: 'idle',
          job: null,
          snapAt: now,
          last: -99,
          turn: 0,
          boost: false,
          energy: 0,
          spin: 0,
          shape: 'straight',
          phase: 0,
          running: true,
          height:
            m.kind === 'belt'
              ? 0.14
              : (this.defs.get(m.kind as Kind)?.height ?? 0.6),
        };
        this.views.set(key, v);
      } else if (v.m !== m) {
        // Jobs finished since the last snapshot.
        const old = v.m;
        if (m.kind === 'printer' && (m.printed ?? 0) > (old.printed ?? 0))
          v.last = now;
        if (m.output && m.output.id !== old.output?.id && m.kind !== 'printer')
          v.last = now;
      }
      v.m = m;
      const turns = MACHINES[m.kind].turns;
      v.angle = turns ? (-m.dir * Math.PI) / 2 : this.turned ? Math.PI / 2 : 0;
      v.matrix.makeRotationY(v.angle).setPosition(m.x + 0.5, 0, m.y + 0.5);
      v.status = statusOf(f, m);
      v.job = job(s, f, m);
      v.snapAt = now;
      v.boost =
        v.status === 'work' && (m.kind === 'lamp' || m.kind === 'charm');
      v.running = !(m.item && (m.stuck ?? 0) > 0);
    }
    // Deleting while iterating a Map is safe.
    for (const key of this.views.keys())
      if (!seen.has(key)) this.views.delete(key);
    for (const v of this.views.values()) {
      if (v.kind === 'belt') v.shape = beltShape(f, v.m);
      if (v.kind === 'splitter') {
        const target = splitterAngle(v.m);
        // Turn the short way round.
        let d = target - v.turn;
        d =
          ((((d + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) -
          Math.PI;
        v.turn += d;
      }
    }
    if (signature !== this.signature) {
      this.signature = signature;
      this.rebuild();
    }
    this.updateTickets(prev, f, s);
    this.drawLinks();
  }

  /** Lays every machine into its kind's instanced meshes. */
  private rebuild() {
    const byKind = new Map<MachineKind, MView[]>(),
      byShape = new Map<BeltShape, MView[]>();
    for (const v of this.views.values()) {
      if (this.hidden.has(v.key)) continue;
      if (v.kind === 'belt') {
        const list = byShape.get(v.shape) ?? [];
        list.push(v);
        byShape.set(v.shape, list);
      } else {
        const list = byKind.get(v.kind) ?? [];
        list.push(v);
        byKind.set(v.kind, list);
      }
    }
    for (const kind of KINDS) {
      const list = byKind.get(kind) ?? [];
      const b = this.batch(kind, list.length);
      b.list = list;
      list.forEach((v, i) => {
        v.index = i;
        for (const mesh of b.body) mesh.setMatrixAt(i, v.matrix);
        for (const p of b.parts)
          if (p.def.tint === 'book')
            for (const mesh of p.meshes)
              mesh.setColorAt(
                i,
                tmpC
                  .set(packFor(v.m.book ?? 'seven').color)
                  .lerp(new THREE.Color('#ffffff'), 0.08),
              );
      });
      for (const mesh of b.body) {
        mesh.count = list.length;
        mesh.instanceMatrix.needsUpdate = true;
      }
      for (const p of b.parts)
        for (const mesh of p.meshes) {
          mesh.count = list.length;
          if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        }
    }
    for (const shape of SHAPES) {
      const list = byShape.get(shape) ?? [];
      const b = this.beltBatch(shape, list.length);
      b.list = list;
      list.forEach((v, i) => {
        v.index = i;
        for (const mesh of b.body) mesh.setMatrixAt(i, v.matrix);
        b.top!.setMatrixAt(i, v.matrix);
      });
      for (const mesh of [...b.body, b.top!]) {
        mesh.count = list.length;
        mesh.instanceMatrix.needsUpdate = true;
      }
    }
    this.shadowDirty = true;
  }

  private batch(kind: Kind, n: number) {
    let b = this.batches.get(kind);
    if (b && b.cap >= n) return b;
    const def = this.defs.get(kind)!,
      cap = Math.max(4, 2 ** Math.ceil(Math.log2(Math.max(1, n))));
    if (b)
      for (const mesh of [...b.body, ...b.parts.flatMap((p) => p.meshes)])
        this.dropMesh(mesh);
    const make = (geo: THREE.BufferGeometry, mat: MatKey, tinted: boolean) => {
      const mesh = new THREE.InstancedMesh(geo, this.mats[mat], cap);
      mesh.frustumCulled = false;
      mesh.castShadow = mat !== 'glow' && mat !== 'glass';
      mesh.receiveShadow = mat !== 'glow';
      mesh.count = 0;
      if (tinted) mesh.setColorAt(0, tmpC.set('#fff'));
      if (mat === 'glass') mesh.renderOrder = 2;
      this.scene.add(mesh);
      return mesh;
    };
    b = {
      def,
      cap,
      list: [],
      body: (Object.entries(def.body) as [MatKey, THREE.BufferGeometry][]).map(
        ([mat, geo]) => make(geo, mat, false),
      ),
      parts: def.parts.map((p) => ({
        def: p,
        meshes: (
          Object.entries(p.geos) as [MatKey, THREE.BufferGeometry][]
        ).map(([mat, geo]) => make(geo, mat, !!p.tint)),
      })),
    };
    this.batches.set(kind, b);
    return b;
  }

  private beltBatch(shape: BeltShape, n: number) {
    const b = this.belts.get(shape)!;
    if (b.cap >= n && b.top) return b;
    const cap = Math.max(16, 2 ** Math.ceil(Math.log2(Math.max(1, n))));
    for (const mesh of b.body) this.dropMesh(mesh);
    if (b.top) this.dropMesh(b.top);
    b.cap = cap;
    b.body = (
      Object.entries(b.geo.body) as [MatKey, THREE.BufferGeometry][]
    ).map(([mat, geo]) => {
      const mesh = new THREE.InstancedMesh(geo, this.mats[mat], cap);
      mesh.frustumCulled = false;
      mesh.castShadow = mat === 'metal';
      mesh.receiveShadow = true;
      mesh.count = 0;
      this.scene.add(mesh);
      return mesh;
    });
    b.phase = new THREE.InstancedBufferAttribute(new Float32Array(cap), 1);
    b.geo.top.setAttribute('aPhase', b.phase);
    b.top = new THREE.InstancedMesh(b.geo.top, this.beltTop, cap);
    b.top.frustumCulled = false;
    b.top.receiveShadow = true;
    b.top.count = 0;
    this.scene.add(b.top);
    return b;
  }

  private dropMesh(mesh: THREE.InstancedMesh) {
    this.scene.remove(mesh);
    mesh.dispose();
  }

  // ——— Tickets ———

  /** Where a ticket sits in a machine, in floor space. */
  private placeOf(v: MView, slot: 'item' | 'output' | 'hold', i = 0): P {
    const m = v.m,
      cx = m.x + 0.5,
      cz = m.y + 0.5;
    if (slot === 'output') {
      const [dx, dy] = DIRS[m.dir];
      return { x: cx + dx * 0.36, y: 0.185, z: cz + dy * 0.36, s: 1 };
    }
    if (m.kind === 'belt') {
      let lx = 0,
        lz = 0;
      if (v.shape !== 'straight') {
        // On a curve the ticket rides the middle of the arc.
        lx = 0.146;
        lz = v.shape === 'left' ? -0.146 : 0.146;
      }
      const c = Math.cos(v.angle),
        s = Math.sin(v.angle);
      return {
        x: cx + lx * c + lz * s,
        y: BELT_TOP + 0.004,
        z: cz - lx * s + lz * c,
        s: 1,
      };
    }
    if (m.kind === 'splitter') return { x: cx, y: 0.17, z: cz, s: 1 };
    const rest =
      this.defs.get(m.kind as Kind)?.rest ?? new THREE.Vector3(0, 0.2, 0);
    const c = Math.cos(v.angle),
      s = Math.sin(v.angle);
    const lx = rest.x + (slot === 'hold' ? (i - 1) * 0.03 : 0),
      lz = rest.z + (slot === 'hold' ? (i - 1) * 0.02 : 0);
    return {
      x: cx + lx * c + lz * s,
      y: rest.y + 0.004 + (slot === 'hold' ? i * 0.016 : 0),
      z: cz - lx * s + lz * c,
      s: 1,
    };
  }

  private poseOf(t: Ticket, now: number, out: P) {
    const k = Math.min(1, Math.max(0, (now - t.t0) / t.dur)),
      e = t.smooth ? smoothstep(k) : k;
    out.x = t.a.x + (t.b.x - t.a.x) * e;
    out.y = t.a.y + (t.b.y - t.a.y) * e;
    out.z = t.a.z + (t.b.z - t.a.z) * e;
    out.s = t.a.s + (t.b.s - t.a.s) * e;
    // A ticket entering or leaving a machine dips under its lip.
    if (t.smooth && t.a.y !== t.b.y) out.y += Math.sin(Math.PI * k) * 0.02;
    return k;
  }

  private updateTickets(
    prev: FactoryState | null,
    f: FactoryState,
    s: ScratchState,
  ) {
    const now = this.time,
      dur = STEP_S * 0.97;
    const placed = new Map<
      number,
      { item: Item; p: P; v: MView; slot: Ticket['slot'] }
    >();
    for (const v of this.views.values()) {
      if (this.hidden.has(v.key)) continue;
      const m = v.m;
      if (m.item)
        placed.set(m.item.id, {
          item: m.item,
          p: this.placeOf(v, 'item'),
          v,
          slot: 'item',
        });
      if (m.output)
        placed.set(m.output.id, {
          item: m.output,
          p: this.placeOf(v, 'output'),
          v,
          slot: 'output',
        });
      m.hold?.forEach((item, i) =>
        placed.set(item.id, {
          item,
          p: this.placeOf(v, 'hold', i),
          v,
          slot: 'hold',
        }),
      );
    }
    const cur: P = { x: 0, y: 0, z: 0, s: 1 };
    for (const [id, at] of placed) {
      const t = this.tickets.get(id);
      if (t && !t.gone) {
        this.poseOf(t, now, cur);
        const far = Math.hypot(cur.x - at.p.x, cur.z - at.p.z) > 1.7 || !prev;
        t.item = at.item;
        t.a = far ? { ...at.p, s: 0.2 } : { ...cur };
        t.b = at.p;
        t.t0 = now;
        const moved = t.host !== at.v.key || t.slot !== at.slot;
        t.smooth =
          moved &&
          !(at.v.kind === 'belt' && this.views.get(t.host)?.kind === 'belt');
        t.dur = far ? 0.25 : moved ? dur : 0.2;
        t.host = at.v.key;
        t.slot = at.slot;
        continue;
      }
      // A new ticket: printed, packed, or seen for the first time.
      let a: P = { ...at.p, s: 0.2 };
      if (
        prev &&
        at.slot === 'output' &&
        (at.v.kind === 'printer' || at.v.kind === 'bundler')
      ) {
        const inside =
          at.v.kind === 'printer'
            ? { x: at.v.m.x + 0.5, y: 0.22, z: at.v.m.y + 0.5, s: 0.7 }
            : this.placeOf(at.v, 'hold', 1);
        a = inside;
      }
      this.tickets.set(id, {
        id,
        item: at.item,
        a,
        b: at.p,
        t0: now,
        dur: prev ? dur : 0.3,
        smooth: true,
        host: at.v.key,
        slot: at.slot,
        tilt: (((id * 37) % 13) - 6) * (Math.PI / 180),
      });
    }
    // Tickets that left the floor: sold, packed or removed.
    for (const t of this.tickets.values()) {
      if (t.gone || placed.has(t.id)) continue;
      t.gone = true;
      this.poseOf(t, now, cur);
      t.a = { ...cur };
      t.t0 = now;
      const host = this.views.get(t.host),
        till = host && t.slot !== 'hold' ? this.tillFor(f, host) : undefined;
      if (till) {
        const value = itemValue(s, t.item);
        t.b = { x: till.m.x + 0.5, y: 0.2, z: till.m.y + 0.5, s: 0.45 };
        t.dur = 0.34;
        t.smooth = false;
        t.end = () => this.sold(till, value);
      } else if (host?.kind === 'bundler' && t.slot === 'hold') {
        t.b = { ...this.placeOf(host, 'hold', 1), s: 0.3 };
        t.dur = 0.3;
        t.smooth = true;
      } else {
        t.b = { ...cur, s: 0 };
        t.dur = 0.25;
        t.smooth = true;
      }
    }
  }

  /** The till a ticket was handed to: in front of where it sat. */
  private tillFor(f: FactoryState, host: MView) {
    const m = host.m;
    const dirs =
      m.kind === 'splitter'
        ? [m.dir, (m.dir + 3) % 4, (m.dir + 1) % 4]
        : [m.dir];
    for (const d of dirs) {
      const [dx, dy] = DIRS[d],
        v = this.views.get(cellKey(m.x + dx, m.y + dy));
      if (v?.kind === 'cashier' && f.machines.includes(v.m)) return v;
    }
    return undefined;
  }

  private sold(till: MView, value: number) {
    till.last = this.time;
    const x = till.m.x + 0.5,
      z = till.m.y + 0.5;
    if (this.fx) {
      const at = this.project(x, z, 0.7);
      this.fx.sale(till.key, at.x, at.y, value);
    }
  }

  private burst(x: number, y: number, z: number, colour: string, n: number) {
    const c = new THREE.Color(colour);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      this.particles.push({
        kind: 'spark',
        p: new THREE.Vector3(x, y, z),
        v: new THREE.Vector3(
          Math.cos(a) * 0.7,
          0.6 + Math.random() * 0.8,
          Math.sin(a) * 0.7,
        ),
        born: this.time,
        life: 0.55 + Math.random() * 0.3,
        colour: c,
      });
    }
  }

  // ——— Overlay ———

  private drawOverlay() {
    const o = this.overlay,
      f = this.f;
    let n = 0,
      a = 0;
    // Marks ride above plinths and belts; their outline rings the machine.
    const mark = (
      x: number,
      y: number,
      colour: string,
      size = 1,
      lift = 0.13,
    ) => {
      if (n >= 320) return;
      tmpM.makeScale(size, 1, size).setPosition(x + 0.5, lift, y + 0.5);
      this.marks.setMatrixAt(n, tmpM);
      this.marks.setColorAt(n++, tmpC.set(colour));
    };
    const arrow = (
      x: number,
      y: number,
      dir: number,
      colour: string,
      inward: boolean,
      reach = 0.56,
      size = 0.28,
    ) => {
      if (a >= 320) return;
      const [dx, dy] = DIRS[dir];
      const angle = (-(inward ? (dir + 2) % 4 : dir) * Math.PI) / 2;
      tmpM
        .makeRotationY(angle)
        .scale(tmpS.set(size, 1, size))
        .setPosition(x + 0.5 + dx * reach, 0.16, y + 0.5 + dy * reach);
      this.arrows.setMatrixAt(a, tmpM);
      this.arrows.setColorAt(a++, tmpC.set(colour));
    };
    /** Where a machine takes tickets in (green) and sends them (orange). */
    const flow = (kind: MachineKind, x: number, y: number, dir: number) => {
      const d = (MACHINES[kind].turns ? dir : 0) as Dir;
      for (const side of outlets(kind, d)) arrow(x, y, side, '#ff8a3d', false);
      for (const side of intakes(kind, d)) arrow(x, y, side, '#74f0a0', true);
    };
    const building = o.mode === 'build' || o.mode === 'paste';
    // A booster's reach, under everything else.
    const booster = o.reach.length
      ? (o.ghosts.find((g) => g.kind === 'lamp' || g.kind === 'charm')?.kind ??
        (o.selected.length === 1 &&
          f?.machines.find(
            (m) => m.x === o.selected[0].x && m.y === o.selected[0].y,
          )?.kind))
      : null;
    for (const c of o.reach)
      mark(c.x, c.y, booster === 'charm' ? '#7df0a4' : '#ffd36b', 0.96, 0.02);
    if (o.hover && !building)
      mark(
        o.hover.x,
        o.hover.y,
        o.mode === 'erase' ? '#ff6b5c' : '#fff3d6',
        0.94,
      );
    for (const c of o.selected) mark(c.x, c.y, '#ffd25e', 1.04);
    for (const c of o.erasing) mark(c.x, c.y, '#ff4a3a', 1);
    if (f && o.selected.length && o.selected.length <= 24)
      for (const c of o.selected) {
        const m = f.machines.find((m) => m.x === c.x && m.y === c.y);
        if (m && m.kind !== 'belt') flow(m.kind, m.x, m.y, m.dir);
      }
    // The outlet handle: drag it to pull a belt out of the machine.
    if (o.handle) {
      mark(o.handle.x, o.handle.y, '#ff9a4a', 0.9, 0.03);
      arrow(o.handle.x, o.handle.y, o.handle.dir, '#ff9a4a', false, 0, 0.5);
    }
    for (const g of o.ghosts)
      if (!g.solid) mark(g.x, g.y, g.bad ? '#ff5a4a' : '#fff3d6', 0.94);
    const fresh = o.ghosts.filter((g) => !g.solid && g.kind !== 'belt');
    if (fresh.length && fresh.length <= 8)
      for (const g of fresh) flow(g.kind, g.x, g.y, g.dir);
    if (o.lifted)
      for (const c of o.lifted.to)
        mark(c.x, c.y, o.lifted.ok ? '#f6c64f' : '#ff4a3a', 1);
    this.marks.count = n;
    this.arrows.count = a;
    this.marks.instanceMatrix.needsUpdate =
      this.arrows.instanceMatrix.needsUpdate = true;
    if (this.marks.instanceColor) this.marks.instanceColor.needsUpdate = true;
    if (this.arrows.instanceColor) this.arrows.instanceColor.needsUpdate = true;
    if (o.marquee) {
      const { x0, y0, x1, y1 } = o.marquee;
      this.marquee.visible = true;
      this.marquee.scale.set(x1 - x0 + 1, 1, y1 - y0 + 1);
      this.marquee.position.set((x0 + x1 + 1) / 2, 0.015, (y0 + y1 + 1) / 2);
      const w = x1 - x0 + 1,
        h = y1 - y0 + 1,
        t = 0.07,
        cx = (x0 + x1 + 1) / 2,
        cy = (y0 + y1 + 1) / 2;
      const sides: [number, number, number, number][] = [
        [cx, y0 + t / 2, w, t],
        [cx, y1 + 1 - t / 2, w, t],
        [x0 + t / 2, cy, t, h],
        [x1 + 1 - t / 2, cy, t, h],
      ];
      sides.forEach(([x, y, sx, sy], i) => {
        const e = this.marqueeEdges[i];
        e.visible = true;
        e.scale.set(sx, 1, sy);
        e.position.set(x, 0.02, y);
      });
    } else {
      this.marquee.visible = false;
      for (const e of this.marqueeEdges) e.visible = false;
    }
    if (this.grid)
      (this.grid.material as THREE.MeshBasicMaterial).opacity =
        o.mode === 'select' && !o.lifted ? 0.08 : 0.22;
    // Ghost machines, in their own colours: red where they cannot go.
    const wanted: {
      kind: MachineKind;
      x: number;
      y: number;
      dir: number;
      look: 'ghost' | 'bad' | 'solid';
      lift: number;
    }[] = [];
    for (const g of o.ghosts)
      wanted.push({
        ...g,
        look: g.solid ? 'solid' : g.bad ? 'bad' : 'ghost',
        lift: g.lift ? 0.04 : 0,
      });
    if (o.lifted && f)
      o.lifted.from.forEach((c, i) => {
        const m = f.machines.find((m) => m.x === c.x && m.y === c.y),
          to = o.lifted!.to[i];
        if (m && to)
          wanted.push({
            kind: m.kind,
            x: to.x,
            y: to.y,
            dir: o.lifted!.dirs?.[i] ?? m.dir,
            look: o.lifted!.ok ? 'ghost' : 'bad',
            lift: 0.06,
          });
      });
    while (this.ghostPool.length < wanted.length) {
      const g = new THREE.Group();
      this.ghostPool.push(g);
      this.ghostRoot.add(g);
    }
    const looks = {
      ghost: this.ghostMat,
      bad: this.ghostBad,
      solid: this.ghostSolid,
    };
    this.ghostPool.forEach((g, i) => {
      const w = wanted[i];
      if (!w) {
        g.visible = false;
        return;
      }
      if (g.userData.kind !== w.kind) {
        g.clear();
        for (const { geo, pivot } of this.ghostParts(w.kind)) {
          const mesh = new THREE.Mesh(geo, this.ghostMat);
          if (pivot) mesh.position.copy(pivot);
          g.add(mesh);
        }
        g.userData.kind = w.kind;
      }
      for (const child of g.children)
        (child as THREE.Mesh).material = looks[w.look];
      g.visible = true;
      const turns = MACHINES[w.kind].turns;
      g.rotation.y = turns
        ? (-w.dir * Math.PI) / 2
        : this.turned
          ? Math.PI / 2
          : 0;
      g.position.set(w.x + 0.5, w.lift, w.y + 0.5);
    });
  }

  private ghostParts(kind: MachineKind) {
    let parts = this.ghostGeos.get(kind);
    if (parts) return parts;
    if (kind === 'belt') {
      const b = this.belts.get('straight')!.geo;
      parts = [...Object.values(b.body), b.top].map((geo) => ({ geo: geo! }));
    } else {
      const def = this.defs.get(kind as Kind)!;
      parts = [
        ...Object.values(def.body).map((geo) => ({ geo: geo! })),
        ...def.parts.flatMap((p) =>
          Object.values(p.geos).map((geo) => ({ geo: geo!, pivot: p.pivot })),
        ),
      ];
    }
    this.ghostGeos.set(kind, parts);
    return parts;
  }

  /** Each booster owns exactly its 3x3 square, even when idle. */
  private drawReach() {
    let n = 0;
    for (const v of this.views.values()) {
      if ((v.kind !== 'lamp' && v.kind !== 'charm') || this.hidden.has(v.key))
        continue;
      const x0 = Math.max(0, v.m.x - 1),
        x1 = Math.min(this.floor.width, v.m.x + 2);
      const z0 = Math.max(0, v.m.y - 1),
        z1 = Math.min(this.floor.height, v.m.y + 2);
      tmpM
        .makeScale(x1 - x0, 1, z1 - z0)
        .setPosition((x0 + x1) / 2, 0.007, (z0 + z1) / 2);
      this.reachPools.setMatrixAt(n, tmpM);
      const style = REACH_STYLE[v.kind];
      tmpC.set(style.colour);
      const pulse = this.opts.reduced
        ? 1
        : 1 + Math.sin(this.time * 2 + v.seed * 6) * 0.055;
      this.poolData.setXYZW(
        n,
        tmpC.r,
        tmpC.g,
        tmpC.b,
        v.boost ? style.boost * pulse : style.idle,
      );
      this.poolClip.setXYZW(
        n,
        (x0 - v.m.x + 1) / 3,
        (v.m.y + 2 - z1) / 3,
        (x1 - x0) / 3,
        (z1 - z0) / 3,
      );
      n++;
    }
    this.reachPools.count = n;
    this.reachPools.instanceMatrix.needsUpdate = true;
    this.poolData.needsUpdate = this.poolClip.needsUpdate = true;
  }

  private drawLinks() {
    const f = this.f;
    if (!f) return;
    let n = 0;
    for (const v of this.views.values()) {
      if (!v.boost || this.hidden.has(v.key)) continue;
      const colour = new THREE.Color(v.kind === 'lamp' ? '#efdcaa' : '#a6e2b6');
      for (const t of boosted(f, v.m)) {
        if (n >= MAX_LINKS || this.hidden.has(cellKey(t.x, t.y))) continue;
        const dx = t.x - v.m.x,
          dz = t.y - v.m.y,
          len = Math.hypot(dx, dz);
        const startY = Math.min(v.height, 0.5);
        const endY = Math.min(
          this.views.get(cellKey(t.x, t.y))?.height ?? 0.5,
          0.5,
        );
        // Full displacement in the first column fits diagonals as well as sides.
        tmpM
          .makeBasis(
            tmpV.set(dx, endY - startY, dz),
            tmpV2.set(0, 1, 0),
            tmpS.set(-dz / len, 0, dx / len),
          )
          .setPosition(v.m.x + 0.5, startY, v.m.y + 0.5);
        this.links.setMatrixAt(n, tmpM);
        this.linkData.setXYZW(n, colour.r, colour.g, colour.b, v.seed);
        n++;
      }
    }
    this.links.count = n;
    this.links.instanceMatrix.needsUpdate = true;
    this.linkData.needsUpdate = true;
  }

  // ——— Frame ———

  private frame = (now: number) => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.frame);
    if (document.hidden || this.paused) return;
    if (this.opts.mirror && now - this.lastFrame < 30) return;
    if (this.pacer && !this.pacer.frame(now)) return;
    const dt = Math.min(0.1, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    this.time += dt;
    this.frameNo++;
    if (!this.floor.width) return;
    this.animateMachines(dt);
    this.animateTickets();
    this.animateEffects(dt);
    if (
      this.renderer.shadowMap.enabled &&
      (this.shadowDirty || this.frameNo % this.shadowEvery === 0)
    ) {
      this.renderer.shadowMap.needsUpdate = true;
      this.shadowDirty = false;
    }
    this.renderer.render(this.scene, this.camera);
  };

  private animateMachines(dt: number) {
    const t = this.time,
      c = this.ctx,
      o = this.poseOut;
    this.gauges.begin();
    this.halos.begin();
    this.badges.begin();
    const blink = this.opts.reduced || Math.sin(t * 9) > 0;
    for (const kind of KINDS) {
      const b = this.batches.get(kind);
      if (!b || !b.list.length) continue;
      let tinted = false;
      for (const v of b.list) {
        c.t = t;
        c.seed = v.seed;
        c.status = v.status;
        c.since = t - v.last;
        c.boost = v.boost;
        if (kind === 'lamp' || kind === 'charm') {
          v.energy += ((v.boost ? 1 : 0) - v.energy) * Math.min(1, dt * 2.2);
          v.spin += dt * (0.05 + 0.95 * v.energy);
        }
        c.energy = v.energy;
        c.spin = v.spin;
        c.hold = v.m.hold?.length ?? 0;
        c.work = v.job
          ? Math.min(1, v.job.work + v.job.perMs * (t - v.snapAt) * 1000)
          : -1;
        if (kind === 'cashier' && c.since < 1.1) c.status = 'work';
        if (kind === 'splitter') c.turn = v.turn;
        this.stillCtx.turn = c.turn;
        this.stillCtx.hold = c.hold;
        this.stillCtx.seed = c.seed;
        this.stillCtx.energy = v.boost ? 1 : 0;
        for (const p of b.parts) {
          pose(kind, p.def.name, this.opts.reduced ? this.stillCtx : c, o);
          tmpM2.makeRotationFromEuler(o.r).scale(tmpS.set(o.s, o.s, o.s));
          tmpM2.setPosition(tmpV.copy(p.def.pivot).add(o.p));
          tmpM.multiplyMatrices(v.matrix, tmpM2);
          for (const mesh of p.meshes) {
            mesh.setMatrixAt(v.index, tmpM);
            if (p.def.tint === 'status') {
              const lit =
                c.status === 'stuck'
                  ? blink
                    ? STATUS.stuck
                    : STATUS.idle
                  : STATUS[c.status];
              mesh.setColorAt(v.index, lit);
              tinted = true;
            } else if (p.def.tint === 'boost') {
              mesh.setColorAt(v.index, boostColour(kind, v.boost));
              tinted = true;
            }
          }
        }
        // Gauges over slow jobs; halos over working lamps; badges over stuck machines.
        const top = v.height;
        if (c.work >= 0 && (kind === 'printer' || kind === 'bot'))
          this.gauges.push(
            v.m.x + 0.5,
            top + 0.16,
            v.m.y + 0.5,
            0.26,
            c.work,
            1,
            GAUGE_TINT[kind],
          );
        if (
          kind === 'bundler' &&
          c.hold > 0 &&
          c.hold < 3 &&
          v.status !== 'work'
        )
          this.gauges.push(
            v.m.x + 0.5,
            top + 0.16,
            v.m.y + 0.5,
            0.22,
            c.hold / 3,
            0.85,
            GAUGE_TINT.bundler,
          );
        const source =
          kind === 'charm' && v.energy > 0.02
            ? b.def.parts.find((p) => p.tint === 'boost')
            : undefined;
        if (source) {
          tmpV.copy(source.pivot).applyMatrix4(v.matrix);
          const pulse = this.opts.reduced
            ? 0.75
            : 0.75 + Math.sin(t * 3 + v.seed * 6) * 0.15;
          this.halos.push(
            tmpV.x,
            tmpV.y,
            tmpV.z,
            0.5,
            pulse * 0.28 * v.energy,
            0,
            HALO[kind],
          );
        }
        if (
          v.status === 'work' &&
          kind !== 'lamp' &&
          kind !== 'charm' &&
          b.parts.some((p) => p.def.tint === 'status')
        )
          this.halos.push(...lightSpot(v, b.def), 0.16, 0.5, 0, STATUS.work);
        if (v.status === 'stuck') {
          this.badges.push(
            v.m.x + 0.5,
            top + 0.3 + (this.opts.reduced ? 0 : Math.sin(t * 4) * 0.03),
            v.m.y + 0.5,
            0.3,
            1,
            0,
            STATUS.stuck,
          );
          if (blink)
            this.halos.push(...lightSpot(v, b.def), 0.3, 0.9, 0, STATUS.stuck);
        }
        if (v.status === 'full')
          this.halos.push(...lightSpot(v, b.def), 0.16, 0.45, 0, STATUS.full);
      }
      for (const p of b.parts)
        for (const mesh of p.meshes) {
          mesh.instanceMatrix.needsUpdate = true;
          if (tinted && mesh.instanceColor)
            mesh.instanceColor.needsUpdate = true;
        }
    }
    this.drawReach();
    this.gauges.end();
    this.badges.end();
    // Belts scroll while they run.
    for (const shape of SHAPES) {
      const b = this.belts.get(shape)!;
      if (!b.phase || !b.list.length) continue;
      for (const v of b.list) {
        if (v.running && !this.opts.reduced)
          v.phase = (v.phase + dt / STEP_S) % 1000;
        b.phase.setX(v.index, v.phase);
      }
      b.phase.needsUpdate = true;
    }
  }

  private animateTickets() {
    const now = this.time,
      p: P = { x: 0, y: 0, z: 0, s: 1 };
    const counts = new Map<PackId, number>();
    let coins = 0,
      stamps = 0,
      stars = 0,
      ribbons = 0;
    const yaw = this.turned ? Math.PI / 2 : 0;
    const put = (
      book: PackId,
      x: number,
      y: number,
      z: number,
      s: number,
      tilt: number,
      gilded: boolean,
    ) => {
      const n = counts.get(book) ?? 0;
      const mesh = this.ticketMesh(book, n + 1);
      tmpQ.setFromAxisAngle(yAxis, yaw + tilt);
      tmpM.compose(tmpV.set(x, y, z), tmpQ, tmpS.set(s, s, s));
      mesh.setMatrixAt(n, tmpM);
      mesh.setColorAt(n, gilded ? GILDED : WHITE);
      counts.set(book, n + 1);
    };
    for (const t of this.tickets.values()) {
      const k = this.poseOf(t, now, p);
      if (t.gone && k >= 1) {
        this.tickets.delete(t.id);
        t.end?.();
        continue;
      }
      if (p.s < 0.02) continue;
      const it = t.item,
        y = p.y + (t.id % 5) * 0.0015;
      if (it.value) {
        // A bundle: three tickets tied with a ribbon.
        put(
          it.book,
          p.x - 0.015,
          y - 0.014,
          p.z + 0.012,
          p.s,
          t.tilt - 0.08,
          !!it.gilded,
        );
        put(
          it.book,
          p.x + 0.012,
          y - 0.007,
          p.z - 0.01,
          p.s,
          t.tilt + 0.06,
          !!it.gilded,
        );
        put(it.book, p.x, y, p.z, p.s, t.tilt, !!it.gilded);
        if (ribbons < 64) {
          tmpQ.setFromAxisAngle(yAxis, yaw + t.tilt);
          tmpM.compose(
            tmpV.set(p.x, y + 0.006, p.z),
            tmpQ,
            tmpS.set(p.s, p.s, p.s * 0.95),
          );
          this.ribbonMesh.setMatrixAt(ribbons++, tmpM);
        }
      } else put(it.book, p.x, y, p.z, p.s, t.tilt, !!it.gilded);
      if (it.done && coins < 256) {
        tmpM.makeScale(p.s, p.s, p.s).setPosition(p.x, y + 0.012, p.z);
        this.coinMesh.setMatrixAt(coins++, tmpM);
      }
      if (it.stamped && stamps < 128) {
        const off = 0.07 * p.s;
        tmpM
          .makeScale(p.s, p.s, p.s)
          .setPosition(p.x - off, y + 0.006, p.z + off);
        this.stampMesh.setMatrixAt(stamps++, tmpM);
      }
      if (it.star && stars < 128) {
        tmpQ.setFromAxisAngle(yAxis, this.opts.reduced ? t.id : now * 2 + t.id);
        tmpM.compose(
          tmpV.set(
            p.x + 0.08 * p.s,
            y +
              0.03 +
              (this.opts.reduced ? 0 : Math.sin(now * 4 + t.id) * 0.01),
            p.z - 0.1 * p.s,
          ),
          tmpQ,
          tmpS.set(p.s, p.s, p.s),
        );
        this.starMesh.setMatrixAt(stars++, tmpM);
        this.halos.push(
          p.x + 0.08 * p.s,
          y + 0.04,
          p.z - 0.1 * p.s,
          0.28 * p.s,
          0.55,
          0,
          STAR_GLOW,
        );
      }
    }
    // The book ticket sits on the small display, leaving the cobalt shell visible.
    const printers = this.batches.get('printer');
    if (printers)
      for (const v of printers.list) {
        const c = Math.cos(v.angle),
          s = Math.sin(v.angle);
        const display = printers.def.display!;
        put(
          v.m.book ?? 'seven',
          v.m.x + 0.5 + display.x * c + display.z * s,
          display.y + this.printerCoverLift(v),
          v.m.y + 0.5 - display.x * s + display.z * c,
          0.52,
          0,
          false,
        );
      }
    for (const [book, mesh] of this.ticketMeshes) {
      mesh.count = counts.get(book) ?? 0;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    for (const [mesh, n] of [
      [this.coinMesh, coins],
      [this.stampMesh, stamps],
      [this.starMesh, stars],
      [this.ribbonMesh, ribbons],
    ] as const) {
      mesh.count = n;
      mesh.instanceMatrix.needsUpdate = true;
    }
  }

  private printerCoverLift(v: MView) {
    if (this.opts.reduced) return 0;
    return v.status === 'work' && v.job ? 0.0015 * Math.sin(this.time * 16) : 0;
  }

  private ticketMesh(book: PackId, need: number) {
    let mesh = this.ticketMeshes.get(book);
    const cap = this.ticketCaps.get(book) ?? 0;
    if (mesh && cap >= need) return mesh;
    const next = Math.max(32, cap * 2, 2 ** Math.ceil(Math.log2(need)));
    let geo: THREE.BufferGeometry, mat: THREE.Material;
    if (mesh) {
      geo = mesh.geometry;
      mat = mesh.material as THREE.Material;
      const old = mesh;
      mesh = new THREE.InstancedMesh(geo, mat, next);
      // Keep what was already written this frame.
      for (let i = 0; i < cap; i++) {
        old.getMatrixAt(i, tmpM);
        mesh.setMatrixAt(i, tmpM);
        if (old.instanceColor) {
          old.getColorAt(i, tmpC);
          mesh.setColorAt(i, tmpC);
        }
      }
      this.dropMesh(old);
    } else {
      const aspect = TICKET_ART[book].aspect;
      // The longer side is always the same, whatever the ticket's shape.
      const tall = aspect <= 1;
      geo = new THREE.PlaneGeometry(
        tall ? TICKET_LONG * aspect : TICKET_LONG,
        tall ? TICKET_LONG : TICKET_LONG / aspect,
      ).rotateX(-Math.PI / 2);
      mat = new THREE.MeshStandardMaterial({
        map: this.ticketTex.get(book)!,
        alphaTest: 0.5,
        roughness: 0.55,
        metalness: 0,
        envMapIntensity: 0.4,
      });
      mesh = new THREE.InstancedMesh(geo, mat, next);
    }
    mesh.frustumCulled = false;
    mesh.receiveShadow = true;
    mesh.setColorAt(0, WHITE);
    this.scene.add(mesh);
    this.ticketMeshes.set(book, mesh);
    this.ticketCaps.set(book, next);
    return mesh;
  }

  private animateEffects(dt: number) {
    const t = this.time;
    this.sparks.begin();
    const g = -6.5;
    this.particles = this.particles.filter((q) => t - q.born < q.life);
    for (const q of this.particles) {
      q.v.y += g * dt;
      q.p.addScaledVector(q.v, dt);
      const age = (t - q.born) / q.life;
      this.sparks.push(
        q.p.x,
        q.p.y,
        q.p.z,
        0.1 * (1 - age * 0.6),
        0.5 * (1 - age),
        0,
        q.colour ?? WHITE,
      );
    }
    // Machines that just finished something give off a puff of sparks.
    for (const [kind, colour] of [
      ['stamper', '#e6a08f'],
      ['gilder', '#efd9a0'],
      ['bundler', '#e3b3c4'],
      ['bot', '#d6ead9'],
    ] as const) {
      const b = this.batches.get(kind);
      if (!b) continue;
      for (const v of b.list) {
        const since = t - v.last;
        if (since >= 0 && since < dt + 1e-4 && !this.opts.reduced) {
          const rest = b.def.rest ?? new THREE.Vector3();
          this.burst(
            v.m.x + 0.5 + rest.x,
            0.3,
            v.m.y + 0.5 + rest.z,
            colour,
            3,
          );
        }
      }
    }
    this.sparks.end();
    this.halos.end();
    (this.links.material as THREE.ShaderMaterial).uniforms.uTime.value = this
      .opts.reduced
      ? 0
      : t;
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.fx?.dispose();
    this.scene.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const mat = mesh.material as
        | THREE.Material
        | THREE.Material[]
        | undefined;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else mat?.dispose();
      if ((node as THREE.InstancedMesh).isInstancedMesh)
        (node as THREE.InstancedMesh).dispose();
    });
    for (const def of this.defs.values()) {
      for (const g of Object.values(def.body)) g?.dispose();
      for (const p of def.parts)
        for (const g of Object.values(p.geos)) g?.dispose();
    }
    for (const b of this.belts.values()) {
      for (const g of Object.values(b.geo.body)) g?.dispose();
      b.geo.top.dispose();
    }
    for (const m of Object.values(this.mats)) m.dispose();
    this.beltTop.dispose();
    this.ghostMat.dispose();
    this.ghostBad.dispose();
    this.ghostSolid.dispose();
    for (const t of this.textures) t.dispose();
    for (const t of this.floorTextures) t.dispose();
    this.sun.shadow.map?.dispose();
    this.pmrem.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}

const WHITE = new THREE.Color('#ffffff');
const GILDED = new THREE.Color('#ead09a');
const STAR_GLOW = new THREE.Color('#efd58e');
const GAUGE_TINT: Record<string, THREE.Color> = {
  printer: new THREE.Color('#a6c0e2'),
  bot: new THREE.Color('#e9bf96'),
  bundler: new THREE.Color('#e2abc4'),
};
const HALO: Record<string, THREE.Color> = {
  lamp: new THREE.Color('#e8d7a8'),
  charm: new THREE.Color('#9fdcae'),
};
const BOOST_ON: Record<string, THREE.Color> = {
  lamp: new THREE.Color('#ffffff'),
  charm: new THREE.Color('#5fb27a'),
};
const BOOST_OFF: Record<string, THREE.Color> = {
  lamp: new THREE.Color('#ffffff'),
  charm: new THREE.Color('#4c9566'),
};
function boostColour(kind: MachineKind, on: boolean) {
  return (on ? BOOST_ON : BOOST_OFF)[kind] ?? WHITE;
}
/** The world position of a machine's status light. */
function lightSpot(v: MView, def: ModelDef): [number, number, number] {
  const light = def.parts.find((p) => p.tint === 'status');
  const at = light?.pivot ?? new THREE.Vector3(0, v.height, 0);
  const c = Math.cos(v.angle),
    s = Math.sin(v.angle);
  return [
    v.m.x + 0.5 + at.x * c + at.z * s,
    at.y,
    v.m.y + 0.5 - at.x * s + at.z * c,
  ];
}

/** The splitter's next exit as an angle in its own frame. */
function splitterAngle(m: Machine) {
  const order = [0, Math.PI / 2, -Math.PI / 2];
  return order[(m.turn ?? 0) % 3];
}

const FEEDS = new Set<MachineKind>([
  'belt',
  'printer',
  'bot',
  'stamper',
  'gilder',
  'bundler',
]);
/** A belt fed only from one side curves round to its front. */
function beltShape(f: FactoryState, m: Machine): BeltShape {
  const feeds = (side: number) => {
    const d = (m.dir + side) % 4,
      [dx, dy] = DIRS[d],
      n = f.machines.find((o) => o.x === m.x + dx && o.y === m.y + dy);
    if (!n) return false;
    const into = (dir: number) =>
      n.x + DIRS[dir][0] === m.x && n.y + DIRS[dir][1] === m.y;
    if (n.kind === 'splitter')
      return into(n.dir) || into((n.dir + 1) % 4) || into((n.dir + 3) % 4);
    return FEEDS.has(n.kind) && into(n.dir);
  };
  if (feeds(2)) return 'straight';
  const left = feeds(3),
    right = feeds(1);
  if (left && !right) return 'left';
  if (right && !left) return 'right';
  return 'straight';
}
