import * as THREE from 'three';
import {
  HAIRS,
  HAT_COLOURS,
  SHIRTS,
  SKINS,
  type DishId,
  type Look,
  type NightId,
  type StationId,
} from '@/lib/games/diner/content';
import {
  boothHz,
  COUNTER_X,
  COUNTER_Z,
  D,
  DOOR_GAP,
  JUKEBOX,
  TABLES,
  W,
} from '@/lib/games/diner/layout';
import { Kit, meshes, type Mat, type Materials } from './kit';
import { SEAT_COLOURS } from './seats';

/**
 * Everything in the diner is modelled here in code: a 1950s roadside diner
 * at night, cherry-and-cream checkerboard, mint vinyl booths, chrome,
 * enamel and neon. Chunky toy proportions so guests' hats, shirts and
 * glasses read on a phone.
 */
export const C = {
  cherry: '#c8162f',
  cherryDark: '#8f0d22',
  cream: '#f6ecd6',
  creamDark: '#e6d6b3',
  mint: '#7fd6c2',
  mintDark: '#4fae9b',
  mintDeep: '#2f7f70',
  chrome: '#e9eef2',
  steel: '#9aa3ab',
  black: '#1d1b22',
  wood: '#7a4a2b',
  pink: '#ff4fa3',
  teal: '#35e6d8',
  gold: '#f4c542',
  goo: '#7d3cff',
  gooLight: '#b38bff',
  white: '#fbf7ef',
};

export { SEAT_COLOURS };

const sh = (pts: [number, number][]) => {
  const s = new THREE.Shape();
  pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
  s.closePath();
  return s;
};

// ---------------------------------------------------------------- textures

function canvasTexture(
  w: number,
  h: number,
  draw: (c: CanvasRenderingContext2D) => void,
  srgb = true,
) {
  const el = document.createElement('canvas');
  el.width = w;
  el.height = h;
  draw(el.getContext('2d')!);
  const t = new THREE.CanvasTexture(el);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** Two by two linoleum tiles, cherry and cream, with grout and wear. */
export function checkerTexture() {
  const t = canvasTexture(256, 256, (c) => {
    const tile = 128;
    for (let y = 0; y < 2; y++)
      for (let x = 0; x < 2; x++) {
        const red = (x + y) % 2 === 0;
        const g = c.createLinearGradient(
          x * tile,
          y * tile,
          (x + 1) * tile,
          (y + 1) * tile,
        );
        g.addColorStop(0, red ? '#b9172f' : '#f3e6c9');
        g.addColorStop(1, red ? '#9c1027' : '#e6d6b4');
        c.fillStyle = g;
        c.fillRect(x * tile, y * tile, tile, tile);
      }
    let seed = 41;
    for (let i = 0; i < 1600; i++) {
      seed = (seed * 16807) % 2147483647;
      const px = seed % 256;
      seed = (seed * 16807) % 2147483647;
      const py = seed % 256;
      c.fillStyle = i % 3 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)';
      c.fillRect(px, py, 2, 2);
    }
    c.strokeStyle = 'rgba(60,20,20,0.35)';
    c.lineWidth = 2;
    for (let i = 0; i <= 2; i++) {
      c.beginPath();
      c.moveTo(i * tile, 0);
      c.lineTo(i * tile, 256);
      c.moveTo(0, i * tile);
      c.lineTo(256, i * tile);
      c.stroke();
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(W, D);
  return t;
}

/** The night through the windows: sky, stars, a moon, a far-off town. */
export function skyTexture(night: NightId) {
  return canvasTexture(1024, 256, (c) => {
    const sky = c.createLinearGradient(0, 0, 0, 256);
    const tops = {
      1: ['#2a1d4f', '#7b3b6e', '#f08a5d'],
      2: ['#0d1638', '#1f3270', '#4a4f8f'],
      3: ['#070a1d', '#1a1a4a', '#3d2f6b'],
    }[night];
    sky.addColorStop(0, tops[0]);
    sky.addColorStop(0.62, tops[1]);
    sky.addColorStop(1, tops[2]);
    c.fillStyle = sky;
    c.fillRect(0, 0, 1024, 256);
    let seed = 7 + night;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const stars = night === 1 ? 30 : 110;
    for (let i = 0; i < stars; i++) {
      c.fillStyle = `rgba(255,255,240,${0.3 + rnd() * 0.7})`;
      const r = rnd() < 0.1 ? 1.6 : 0.9;
      c.beginPath();
      c.arc(rnd() * 1024, rnd() * 150, r, 0, Math.PI * 2);
      c.fill();
    }
    // The moon: a sliver, a half, then full and huge on Night 3.
    const mx = 780,
      my = 70,
      mr = night === 3 ? 46 : 26;
    const glow = c.createRadialGradient(mx, my, mr * 0.5, mx, my, mr * 3.2);
    glow.addColorStop(
      0,
      night === 3 ? 'rgba(255,248,214,0.55)' : 'rgba(255,248,214,0.25)',
    );
    glow.addColorStop(1, 'rgba(255,248,214,0)');
    c.fillStyle = glow;
    c.fillRect(mx - mr * 4, my - mr * 4, mr * 8, mr * 8);
    c.fillStyle = '#fff6d8';
    c.beginPath();
    c.arc(mx, my, mr, 0, Math.PI * 2);
    c.fill();
    if (night !== 3) {
      c.fillStyle = tops[0];
      c.beginPath();
      c.arc(mx + (night === 1 ? 16 : 26), my - 6, mr, 0, Math.PI * 2);
      c.fill();
    } else {
      c.fillStyle = 'rgba(200,190,160,0.35)';
      for (const [dx, dy, r] of [
        [-14, -8, 9],
        [12, 10, 7],
        [-4, 16, 5],
        [16, -14, 4],
      ]) {
        c.beginPath();
        c.arc(mx + dx, my + dy, r, 0, Math.PI * 2);
        c.fill();
      }
    }
    // A far-off town on the horizon with warm windows.
    c.fillStyle = night === 1 ? '#3a2240' : '#0a0c1c';
    let x = 0;
    while (x < 1024) {
      const w = 30 + rnd() * 70,
        h = 20 + rnd() * 55;
      c.fillRect(x, 256 - 40 - h, w, h + 40);
      for (let wy = 256 - 40 - h + 8; wy < 216; wy += 12)
        for (let wx = x + 6; wx < x + w - 6; wx += 11)
          if (rnd() < 0.3) {
            c.fillStyle = rnd() < 0.5 ? '#ffd27a' : '#ffb35c';
            c.fillRect(wx, wy, 4, 5);
            c.fillStyle = night === 1 ? '#3a2240' : '#0a0c1c';
          }
      x += w + rnd() * 20;
    }
    // The road and a line of street lamps.
    c.fillStyle = '#16131f';
    c.fillRect(0, 216, 1024, 40);
    c.fillStyle = '#e9c46a';
    for (let lx = 30; lx < 1024; lx += 90) c.fillRect(lx, 234, 36, 3);
    for (let lx = 60; lx < 1024; lx += 180) {
      const lamp = c.createRadialGradient(lx, 200, 0, lx, 200, 26);
      lamp.addColorStop(0, 'rgba(255,214,140,0.9)');
      lamp.addColorStop(1, 'rgba(255,214,140,0)');
      c.fillStyle = lamp;
      c.fillRect(lx - 26, 174, 52, 52);
    }
  });
}

/** Asphalt with parking lines around the diner. */
export function lotTexture() {
  const t = canvasTexture(512, 512, (c) => {
    c.fillStyle = '#262c44';
    c.fillRect(0, 0, 512, 512);
    let seed = 3;
    for (let i = 0; i < 5000; i++) {
      seed = (seed * 16807) % 2147483647;
      const x = seed % 512;
      seed = (seed * 16807) % 2147483647;
      const y = seed % 512;
      c.fillStyle = i % 2 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.12)';
      c.fillRect(x, y, 2, 2);
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(10, 10);
  return t;
}

/** A soft warm disc for pools of lamplight. */
export function poolTexture() {
  return canvasTexture(128, 128, (c) => {
    const g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,0.9)');
    g.addColorStop(0.45, 'rgba(255,255,255,0.4)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, 128, 128);
  });
}
/** Darker towards the walls, like light falling off in a room. */
function shadeTexture() {
  return canvasTexture(256, 256, (c) => {
    const edge = (x0: number, y0: number, x1: number, y1: number) => {
      const g = c.createLinearGradient(x0, y0, x1, y1);
      g.addColorStop(0, 'rgba(30,8,20,0.42)');
      g.addColorStop(1, 'rgba(30,8,20,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, 256, 256);
    };
    edge(0, 0, 0, 46);
    edge(0, 0, 40, 0);
    edge(256, 0, 216, 0);
    edge(0, 256, 0, 226);
  });
}

/** A soft round glow, for halos, steam and sparkles. */
export function glowTexture() {
  return canvasTexture(64, 64, (c) => {
    const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, 64, 64);
  });
}
/** A four-pointed twinkle. */
export function starTexture() {
  return canvasTexture(64, 64, (c) => {
    c.translate(32, 32);
    const g = c.createRadialGradient(0, 0, 0, 0, 0, 30);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const r = i % 2 ? 6 : 30;
      c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    c.closePath();
    c.fill();
  });
}
/** A puff of smoke or steam with a soft lumpy edge. */
export function puffTexture() {
  return canvasTexture(64, 64, (c) => {
    for (const [x, y, r] of [
      [32, 34, 20],
      [22, 28, 13],
      [42, 26, 12],
      [30, 22, 12],
    ]) {
      const g = c.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(255,255,255,0.9)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g;
      c.beginPath();
      c.arc(x, y, r, 0, Math.PI * 2);
      c.fill();
    }
  });
}

// ---------------------------------------------------------------- the room

const WALL_H = 2.5;
/** Windows in the back wall: [x0, x1]. */
const WINDOWS: [number, number][] = [
  [0.55, 3.35],
  [4.05, 6.95],
  [7.65, 10.45],
];
const SILL = 1.22;
const HEAD = 2.24;

export type Shell = {
  group: THREE.Group;
  door: THREE.Object3D;
  binLid: THREE.Object3D;
  jukebox: THREE.Mesh;
  neon: THREE.Mesh;
  neonStar: THREE.Mesh;
  dispose: () => void;
};

/** The room: floor, walls, windows, counter, fridge, bin, jukebox, neon. */
export function buildShell(
  mats: Materials,
  night: NightId,
  stations: StationId[],
  open: number[],
): Shell {
  const group = new THREE.Group();
  const disposables: { dispose: () => void }[] = [];
  const keep = <T extends { dispose: () => void }>(x: T) => (
    disposables.push(x),
    x
  );

  // Outside: the lot, a sidewalk along the front.
  const lotTex = keep(lotTexture());
  const lot = new THREE.Mesh(
    keep(new THREE.PlaneGeometry(80, 80)),
    keep(
      new THREE.MeshStandardMaterial({
        map: lotTex,
        roughness: 0.95,
        color: '#c9d2ff',
      }),
    ),
  );
  lot.rotation.x = -Math.PI / 2;
  lot.position.set(W / 2, -0.06, D / 2);
  lot.receiveShadow = true;
  group.add(lot);

  // The checkerboard floor.
  const floorTex = keep(checkerTexture());
  const floor = new THREE.Mesh(
    keep(new THREE.PlaneGeometry(W, D)),
    keep(
      new THREE.MeshPhysicalMaterial({
        map: floorTex,
        roughness: 0.32,
        clearcoat: 0.5,
        clearcoatRoughness: 0.25,
      }),
    ),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(W / 2, 0, D / 2);
  floor.receiveShadow = true;
  group.add(floor);

  // Warm pools of light under the lamps, and the corners falling into shade.
  const pool = keep(poolTexture());
  const poolMat = keep(
    new THREE.MeshBasicMaterial({
      map: pool,
      transparent: true,
      opacity: 0.16,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      color: '#ff9f4a',
    }),
  );
  const poolGeo = keep(new THREE.PlaneGeometry(1, 1));
  for (const [x, z, r] of [
    [3.4, 4.5, 3.2],
    [6.3, 4.5, 3.4],
    [9.2, 4.5, 3.2],
    [4.9, 7.9, 3.2],
    [7.8, 7.9, 3.4],
    [5.0, 2.2, 4.2],
    [1.2, 8.0, 2.6],
  ] as [number, number, number][]) {
    const m = new THREE.Mesh(poolGeo, poolMat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.004, z);
    m.scale.set(r, r, 1);
    m.renderOrder = 1;
    group.add(m);
  }
  const shade = new THREE.Mesh(
    keep(new THREE.PlaneGeometry(W, D)),
    keep(
      new THREE.MeshBasicMaterial({
        map: keep(shadeTexture()),
        transparent: true,
        depthWrite: false,
      }),
    ),
  );
  shade.rotation.x = -Math.PI / 2;
  shade.position.set(W / 2, 0.006, D / 2);
  shade.renderOrder = 1;
  group.add(shade);
  // Light spills out of the diner onto the lot.
  const spill = new THREE.Mesh(
    keep(new THREE.PlaneGeometry(W + 9, D + 9)),
    keep(
      new THREE.MeshBasicMaterial({
        map: pool,
        transparent: true,
        opacity: 0.55,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        color: night === 1 ? '#ff9a7a' : '#7f8cff',
      }),
    ),
  );
  spill.rotation.x = -Math.PI / 2;
  spill.position.set(W / 2, -0.05, D / 2);
  group.add(spill);

  // The sky behind the back windows.
  const skyTex = keep(skyTexture(night));
  const sky = new THREE.Mesh(
    keep(new THREE.PlaneGeometry(W, HEAD - SILL)),
    keep(new THREE.MeshBasicMaterial({ map: skyTex, toneMapped: false })),
  );
  sky.position.set(W / 2, (SILL + HEAD) / 2, -0.24);
  group.add(sky);

  const k = new Kit();
  // A plinth under the whole room, so it sits on the lot like a model.
  k.box(
    'paint',
    '#3b3242',
    [W + 0.6, 0.12, D + 0.5],
    [W / 2, -0.075, D / 2 - 0.05],
  );
  k.box('chrome', C.chrome, [W + 0.62, 0.03, 0.05], [W / 2, -0.005, D + 0.2]);

  // Back wall around three windows.
  const back = (
    x0: number,
    x1: number,
    y0: number,
    y1: number,
    colour = '#f6c3cf',
  ) =>
    k.box(
      'paint',
      colour,
      [x1 - x0, y1 - y0, 0.22],
      [(x0 + x1) / 2, (y0 + y1) / 2, -0.11],
    );
  back(-0.22, W + 0.22, 0, SILL, C.mint);
  back(-0.22, W + 0.22, HEAD, WALL_H);
  let x = -0.22;
  for (const [a, b] of WINDOWS) {
    back(x, a, SILL, HEAD);
    x = b;
  }
  back(x, W + 0.22, SILL, HEAD);
  // A cherry stripe and chrome trims.
  k.box('gloss', C.cherry, [W + 0.44, 0.1, 0.24], [W / 2, HEAD + 0.12, -0.1]);
  k.cyl('chrome', C.chrome, 0.035, 0.035, W + 0.44, [W / 2, SILL, 0.02], {
    axis: 'x',
  });
  k.cyl('chrome', C.chrome, 0.04, 0.04, W + 0.44, [W / 2, WALL_H, 0.0], {
    axis: 'x',
  });
  for (const [a, b] of WINDOWS) {
    // Chrome frames with a centre mullion.
    k.box(
      'chrome',
      C.chrome,
      [b - a, 0.05, 0.08],
      [(a + b) / 2, SILL + 0.02, 0.01],
    );
    k.box(
      'chrome',
      C.chrome,
      [b - a, 0.05, 0.08],
      [(a + b) / 2, HEAD - 0.02, 0.01],
    );
    k.box(
      'chrome',
      C.chrome,
      [0.05, HEAD - SILL, 0.08],
      [a + 0.02, (SILL + HEAD) / 2, 0.01],
    );
    k.box(
      'chrome',
      C.chrome,
      [0.05, HEAD - SILL, 0.08],
      [b - 0.02, (SILL + HEAD) / 2, 0.01],
    );
    k.box(
      'chrome',
      C.chrome,
      [0.035, HEAD - SILL, 0.06],
      [(a + b) / 2, (SILL + HEAD) / 2, 0.0],
    );
    k.box(
      'glass',
      '#9fc9ff',
      [b - a, HEAD - SILL, 0.02],
      [(a + b) / 2, (SILL + HEAD) / 2, -0.04],
    );
  }
  // Wall sconces between the windows: chrome arm, warm glass shade.
  for (const sx of [3.7, 7.3]) {
    k.cyl('chrome', C.chrome, 0.02, 0.02, 0.22, [sx, 1.82, 0.1], { axis: 'z' });
    k.dome('glow', '#ffe3a6', 0.13, [sx, 1.86, 0.22], Math.PI / 2, {
      rot: [Math.PI, 0, 0],
    });
    k.cyl('chrome', C.chrome, 0.14, 0.14, 0.03, [sx, 1.87, 0.22]);
  }

  // Side walls (seen from above as thick caps) and the door gap.
  const side = (wx: number, z0: number, z1: number) => {
    k.box(
      'paint',
      C.cream,
      [0.22, WALL_H, z1 - z0],
      [wx, WALL_H / 2, (z0 + z1) / 2],
    );
    k.box(
      'paint',
      C.mint,
      [0.24, SILL, z1 - z0],
      [wx, SILL / 2, (z0 + z1) / 2],
    );
    k.box(
      'gloss',
      C.cherry,
      [0.26, 0.1, z1 - z0],
      [wx, WALL_H - 0.04, (z0 + z1) / 2],
    );
  };
  side(-0.11, -0.22, DOOR_GAP[0]);
  side(-0.11, DOOR_GAP[1], D + 0.12);
  side(W + 0.11, -0.22, D + 0.12);
  // Door posts and a little awning.
  for (const z of DOOR_GAP)
    k.cyl('chrome', C.chrome, 0.05, 0.05, WALL_H, [-0.11, WALL_H / 2, z]);
  // The welcome mat.
  k.rbox('paint', C.cherryDark, [0.7, 0.02, 1.2], 0.05, [0.42, 0.01, 9.9]);
  k.rbox('paint', C.cream, [0.56, 0.025, 1.06], 0.04, [0.42, 0.012, 9.9]);
  k.rbox('paint', C.cherry, [0.48, 0.03, 0.98], 0.04, [0.42, 0.014, 9.9]);

  // The low front rail: the cutaway edge of the room.
  k.box('paint', C.mint, [W + 0.44, 0.34, 0.16], [W / 2, 0.17, D + 0.1]);
  k.cyl('chrome', C.chrome, 0.05, 0.05, W + 0.44, [W / 2, 0.36, D + 0.1], {
    axis: 'x',
  });

  // The counter: cherry enamel with chrome bands and a cream speckled top.
  const cx1 = 9.3;
  k.box(
    'gloss',
    C.cherry,
    [cx1, 0.88, COUNTER_Z - 0.06],
    [cx1 / 2, 0.44, (COUNTER_Z - 0.06) / 2],
  );
  k.box(
    'chrome',
    C.chrome,
    [cx1, 0.1, 0.04],
    [cx1 / 2, 0.06, COUNTER_Z - 0.04],
  );
  k.box(
    'chrome',
    C.chrome,
    [cx1, 0.04, 0.03],
    [cx1 / 2, 0.5, COUNTER_Z - 0.04],
  );
  for (let px = 0.5; px < cx1; px += 0.9)
    k.box('chrome', C.chrome, [0.02, 0.3, 0.02], [px, 0.3, COUNTER_Z - 0.035]);
  k.rbox('paint', C.cream, [cx1 + 0.1, 0.07, COUNTER_Z + 0.06], 0.02, [
    cx1 / 2,
    0.915,
    COUNTER_Z / 2,
  ]);
  k.cyl(
    'chrome',
    C.chrome,
    0.04,
    0.04,
    cx1 + 0.1,
    [cx1 / 2, 0.915, COUNTER_Z + 0.02],
    { axis: 'x' },
  );
  // The fridge in the back corner.
  k.rbox('gloss', C.mint, [1.2, 2.0, 0.9], 0.16, [10.35, 1.0, 0.45]);
  k.rbox('gloss', C.white, [1.08, 1.0, 0.04], 0.06, [10.35, 1.38, 0.91]);
  k.rbox('gloss', C.white, [1.08, 0.72, 0.04], 0.06, [10.35, 0.5, 0.91]);
  k.box('chrome', C.chrome, [0.06, 0.4, 0.06], [9.9, 1.32, 0.96]);
  k.box('chrome', C.chrome, [0.06, 0.3, 0.06], [9.9, 0.62, 0.96]);
  // A potted palm by the right wall.
  k.cyl('gloss', C.cherry, 0.22, 0.17, 0.4, [10.6, 0.2, 6.3]);
  k.cyl('paint', '#3b2a1e', 0.2, 0.2, 0.02, [10.6, 0.4, 6.3]);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    k.capsule(
      'paint',
      i % 2 ? '#3e9a52' : '#2f7e43',
      0.06,
      0.5,
      [10.6 + Math.cos(a) * 0.22, 0.75, 6.3 + Math.sin(a) * 0.22],
      {
        rot: [Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9],
      },
    );
  }
  // Counter decor where a night has no station.
  if (!stations.includes('fryer')) coffeeUrn(k, COUNTER_X.fryer);
  if (!stations.includes('pie')) donutStand(k, COUNTER_X.pie);
  register(k, 7.1);
  for (const id of stations) station(k, id);
  sink(k, COUNTER_X.sink);
  // Napkins, ketchup and mustard at the counter's end.
  k.rbox('chrome', C.chrome, [0.16, 0.14, 0.1], 0.02, [8.0, 1.02, 1.05]);
  k.cyl('gloss', C.cherry, 0.04, 0.045, 0.2, [7.75, 1.05, 1.1]);
  k.cyl('gloss', C.gold, 0.04, 0.045, 0.2, [8.25, 1.05, 1.1]);

  // Booths that are open tonight.
  for (const slot of open) booth(k, slot);

  // The bin on the floor at the end of the counter.
  k.cyl('gloss', C.cherry, 0.24, 0.21, 0.62, [COUNTER_X.bin, 0.31, 0.95]);
  k.cyl('chrome', C.chrome, 0.245, 0.245, 0.05, [COUNTER_X.bin, 0.05, 0.95]);
  k.box('chrome', C.chrome, [0.12, 0.03, 0.12], [COUNTER_X.bin, 0.03, 1.22]);

  // The jukebox, turned a little towards the room.
  const jk = new Kit();
  jk.rbox('gloss', '#7a2416', [0.86, 0.95, 0.56], 0.06, [0, 0.475, 0]);
  jk.cyl('gloss', '#7a2416', 0.43, 0.43, 0.56, [0, 0.95, 0], {
    axis: 'z',
    seg: 32,
  });
  jk.rbox('chrome', C.chrome, [0.66, 0.42, 0.04], 0.03, [0, 0.38, 0.28]);
  for (let i = 0; i < 6; i++)
    jk.box('paint', '#2a1a14', [0.56, 0.025, 0.05], [0, 0.22 + i * 0.06, 0.29]);
  jk.cyl('chrome', C.chrome, 0.08, 0.08, 0.05, [-0.22, 0.75, 0.28], {
    axis: 'z',
  });
  jk.cyl('chrome', C.chrome, 0.08, 0.08, 0.05, [0.22, 0.75, 0.28], {
    axis: 'z',
  });
  jk.rbox('glass', '#ffe9b0', [0.5, 0.3, 0.04], 0.05, [0, 0.98, 0.28]);
  const jbox = meshes(jk.build(), mats);
  jbox.position.set(JUKEBOX.x, 0, JUKEBOX.z);
  jbox.rotation.y = -0.45;
  group.add(jbox);
  // Its glowing tubes: one mesh whose colour cycles.
  const tubes = new Kit();
  tubes.torus('glow', '#ffffff', 0.4, 0.035, [0, 0.95, 0.29], {
    arc: Math.PI,
    rot: [-Math.PI / 2, 0, 0],
  });
  tubes.box('glow', '#ffffff', [0.045, 0.62, 0.05], [-0.4, 0.62, 0.29]);
  tubes.box('glow', '#ffffff', [0.045, 0.62, 0.05], [0.4, 0.62, 0.29]);
  const tubeGeo = tubes.build().glow!;
  const jukebox = new THREE.Mesh(
    tubeGeo,
    keep(new THREE.MeshBasicMaterial({ color: '#ff9a3c', toneMapped: false })),
  );
  jbox.add(jukebox);

  // The neon sign in the middle window: a coffee cup with steam, and a star.
  const nk = new Kit();
  const ny = 1.72,
    nz = -0.02,
    ncx = 5.25;
  nk.tube(
    'glow',
    '#ffffff',
    [
      [ncx - 0.32, ny + 0.18, nz],
      [ncx - 0.3, ny - 0.12, nz],
      [ncx - 0.18, ny - 0.26, nz],
      [ncx + 0.18, ny - 0.26, nz],
      [ncx + 0.3, ny - 0.12, nz],
      [ncx + 0.32, ny + 0.18, nz],
    ],
    0.022,
  );
  nk.tube(
    'glow',
    '#ffffff',
    [
      [ncx - 0.36, ny + 0.18, nz],
      [ncx + 0.36, ny + 0.18, nz],
    ],
    0.022,
  );
  nk.tube(
    'glow',
    '#ffffff',
    [
      [ncx + 0.31, ny + 0.08, nz],
      [ncx + 0.46, ny + 0.06, nz],
      [ncx + 0.46, ny - 0.08, nz],
      [ncx + 0.28, ny - 0.12, nz],
    ],
    0.02,
  );
  for (const sx of [-0.12, 0.08]) {
    nk.tube(
      'glow',
      '#ffffff',
      [
        [ncx + sx, ny + 0.24, nz],
        [ncx + sx + 0.06, ny + 0.32, nz],
        [ncx + sx - 0.02, ny + 0.4, nz],
        [ncx + sx + 0.05, ny + 0.48, nz],
      ],
      0.016,
    );
  }
  const neon = new THREE.Mesh(
    nk.build().glow!,
    keep(new THREE.MeshBasicMaterial({ color: C.pink, toneMapped: false })),
  );
  group.add(neon);
  const sk = new Kit();
  const star: [number, number, number][] = [];
  for (let i = 0; i <= 10; i++) {
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
    const r = i % 2 ? 0.08 : 0.19;
    star.push([5.95 + Math.cos(a) * r, 1.92 + Math.sin(a) * r, nz]);
  }
  sk.tube('glow', '#ffffff', star, 0.018, true);
  const neonStar = new THREE.Mesh(
    sk.build().glow!,
    keep(new THREE.MeshBasicMaterial({ color: C.teal, toneMapped: false })),
  );
  group.add(neonStar);

  const statics = meshes(k.build(), mats);
  group.add(statics);

  // The door: a glass panel on a chrome frame, hinged at its back post.
  const dk = new Kit();
  const dl = DOOR_GAP[1] - DOOR_GAP[0];
  dk.box('chrome', C.chrome, [0.05, 2.1, 0.05], [0, 1.05, dl - 0.03]);
  dk.box('chrome', C.chrome, [0.05, 0.08, dl], [0, 2.08, dl / 2]);
  dk.box('chrome', C.chrome, [0.05, 0.14, dl], [0, 0.07, dl / 2]);
  dk.box('glass', '#bfe4ff', [0.02, 1.9, dl - 0.06], [0, 1.08, dl / 2]);
  dk.box('chrome', C.chrome, [0.12, 0.04, 0.24], [0.06, 1.05, dl - 0.25]);
  const door = new THREE.Group();
  door.add(meshes(dk.build(), mats));
  door.position.set(-0.11, 0, DOOR_GAP[0]);
  group.add(door);
  // The bin's lid flips open on use.
  const lk = new Kit();
  lk.dome('chrome', C.chrome, 0.25, [0, 0, 0.25], Math.PI / 2, {
    scale: [1, 0.35, 1],
  });
  const binLid = new THREE.Group();
  binLid.add(meshes(lk.build(), mats));
  binLid.position.set(COUNTER_X.bin, 0.64, 0.7);
  group.add(binLid);

  return {
    group,
    door,
    binLid,
    jukebox,
    neon,
    neonStar,
    dispose: () => {
      group.traverse((o) => {
        if (o instanceof THREE.Mesh) o.geometry.dispose();
      });
      for (const d of disposables) d.dispose();
    },
  };
}

function coffeeUrn(k: Kit, x: number) {
  k.cyl('chrome', C.chrome, 0.18, 0.2, 0.55, [x, 1.23, 0.6]);
  k.dome('chrome', C.chrome, 0.18, [x, 1.5, 0.6]);
  k.sphere('paint', C.black, 0.04, [x, 1.69, 0.6]);
  k.cyl('paint', C.black, 0.025, 0.025, 0.12, [x, 1.05, 0.82], { axis: 'z' });
  for (let i = 0; i < 3; i++)
    k.cyl('gloss', C.white, 0.06, 0.05, 0.09, [
      x + 0.35 + (i % 2) * 0.05,
      1.0 + i * 0.09,
      0.9,
    ]);
}
function donutStand(k: Kit, x: number) {
  k.cyl('chrome', C.chrome, 0.3, 0.3, 0.02, [x, 1.15, 0.75]);
  k.cyl('chrome', C.chrome, 0.03, 0.06, 0.2, [x, 1.05, 0.75]);
  const icing = ['#f59ac0', '#6b3d1f', '#f4e0b8', '#f59ac0'];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    k.torus('paint', '#d9a35b', 0.07, 0.04, [
      x + Math.cos(a) * 0.16,
      1.19,
      0.75 + Math.sin(a) * 0.16,
    ]);
    k.torus('gloss', icing[i], 0.07, 0.03, [
      x + Math.cos(a) * 0.16,
      1.21,
      0.75 + Math.sin(a) * 0.16,
    ]);
  }
}
function register(k: Kit, x: number) {
  k.rbox('chrome', C.chrome, [0.55, 0.32, 0.45], 0.05, [x, 1.11, 0.6]);
  k.rbox('chrome', C.chrome, [0.4, 0.2, 0.06], 0.03, [x, 1.38, 0.48], {
    rot: [-0.3, 0, 0],
  });
  k.rbox('paint', C.black, [0.32, 0.1, 0.03], 0.02, [x, 1.38, 0.52], {
    rot: [-0.3, 0, 0],
  });
  for (let i = 0; i < 4; i++)
    for (let j = 0; j < 2; j++)
      k.cyl('gloss', C.white, 0.03, 0.03, 0.03, [
        x - 0.15 + i * 0.1,
        1.29,
        0.72 + j * 0.08,
      ]);
  k.rbox('gloss', C.cherry, [0.5, 0.08, 0.42], 0.02, [x, 0.98, 0.62]);
}
function sink(k: Kit, x: number) {
  k.rbox('chrome', C.steel, [0.95, 0.06, 0.7], 0.03, [x, 0.97, 0.7]);
  k.rbox('paint', '#55606a', [0.78, 0.04, 0.52], 0.04, [x, 0.985, 0.7]);
  k.tube(
    'chrome',
    C.chrome,
    [
      [x, 0.97, 0.25],
      [x, 1.5, 0.25],
      [x, 1.62, 0.4],
      [x, 1.48, 0.6],
    ],
    0.035,
  );
  k.cyl('chrome', C.chrome, 0.05, 0.05, 0.08, [x - 0.18, 1.02, 0.25]);
  k.cyl('chrome', C.chrome, 0.05, 0.05, 0.08, [x + 0.18, 1.02, 0.25]);
  k.cyl('gloss', '#cbe8f2', 0.04, 0.04, 0.16, [x + 0.42, 1.04, 1.0]);
}

/** A station's fixed body on the counter. */
function station(k: Kit, id: StationId) {
  const x = COUNTER_X[id];
  if (id === 'grill') {
    k.rbox('chrome', C.steel, [1.08, 0.14, 0.82], 0.03, [x, 1.0, 0.68]);
    k.box('paint', '#24252b', [0.94, 0.03, 0.66], [x, 1.08, 0.7]);
    k.rbox('chrome', C.chrome, [1.08, 0.36, 0.06], 0.02, [x, 1.22, 0.28]);
    for (let i = 0; i < 3; i++)
      k.cyl(
        'gloss',
        C.cherry,
        0.04,
        0.04,
        0.05,
        [x - 0.3 + i * 0.3, 0.97, 1.1],
        { axis: 'z' },
      );
    k.box('chrome', C.chrome, [1.08, 0.03, 0.08], [x, 1.07, 1.08]);
  } else if (id === 'fryer') {
    k.rbox('chrome', C.steel, [0.86, 0.36, 0.72], 0.04, [x, 1.13, 0.66]);
    k.box('gloss', '#c78a22', [0.66, 0.02, 0.5], [x, 1.3, 0.66]);
    k.rbox('chrome', C.chrome, [0.86, 0.3, 0.06], 0.02, [x, 1.42, 0.3]);
    k.cyl('gloss', C.cherry, 0.04, 0.04, 0.04, [x - 0.25, 1.05, 1.03], {
      axis: 'z',
    });
  } else if (id === 'shake') {
    k.rbox('gloss', C.mint, [0.62, 0.1, 0.42], 0.04, [x, 1.0, 0.75]);
    k.rbox('gloss', C.mint, [0.22, 0.7, 0.24], 0.08, [x, 1.35, 0.55]);
    k.rbox('gloss', C.mint, [0.26, 0.16, 0.5], 0.07, [x, 1.68, 0.72]);
    k.cyl('chrome', C.chrome, 0.02, 0.02, 0.24, [x, 1.5, 0.88]);
    k.rbox('chrome', C.chrome, [0.24, 0.05, 0.26], 0.02, [x, 1.0, 0.55]);
  } else if (id === 'pie') {
    k.cyl('chrome', C.chrome, 0.34, 0.36, 0.05, [x, 0.98, 0.72]);
    k.cyl('chrome', C.chrome, 0.05, 0.08, 0.14, [x, 1.06, 0.72]);
    k.cyl('chrome', C.chrome, 0.36, 0.36, 0.03, [x, 1.14, 0.72]);
    // The pie: golden crust, cherry filling, lattice.
    k.cyl('paint', '#e0a24c', 0.3, 0.27, 0.08, [x, 1.2, 0.72]);
    k.cyl('gloss', '#b3122b', 0.26, 0.26, 0.02, [x, 1.245, 0.72]);
    for (let i = -2; i <= 2; i++) {
      k.box(
        'paint',
        '#f0bf6a',
        [0.04, 0.025, 0.5 - Math.abs(i) * 0.08],
        [x + i * 0.1, 1.26, 0.72],
      );
      k.box(
        'paint',
        '#f0bf6a',
        [0.5 - Math.abs(i) * 0.08, 0.025, 0.04],
        [x, 1.262, 0.72 + i * 0.1],
      );
    }
    k.dome('glass', '#d8f1ff', 0.36, [x, 1.15, 0.72]);
    k.sphere('chrome', C.chrome, 0.04, [x, 1.52, 0.72]);
  }
}

/** A booth: a chrome-edged table between two mint vinyl benches. */
function booth(k: Kit, slot: number) {
  const t = TABLES[slot];
  const hz = boothHz(t.seats);
  const len = hz * 2 - 0.08;
  // Table.
  k.rbox('chrome', C.chrome, [0.74, 0.05, len - 0.08], 0.02, [t.x, 0.7, t.z]);
  k.rbox('paint', C.cream, [0.7, 0.045, len - 0.12], 0.02, [t.x, 0.73, t.z]);
  k.box(
    'gloss',
    C.cherry,
    [0.71, 0.012, 0.06],
    [t.x, 0.75, t.z - len / 2 + 0.14],
  );
  k.box(
    'gloss',
    C.cherry,
    [0.71, 0.012, 0.06],
    [t.x, 0.75, t.z + len / 2 - 0.14],
  );
  k.cyl('chrome', C.chrome, 0.05, 0.05, 0.66, [t.x, 0.35, t.z]);
  k.cyl('chrome', C.chrome, 0.2, 0.22, 0.03, [t.x, 0.015, t.z]);
  // Salt and pepper.
  k.cyl('glass', '#ffffff', 0.025, 0.025, 0.08, [
    t.x - 0.04,
    0.79,
    t.z - len / 2 + 0.24,
  ]);
  k.cyl('chrome', C.chrome, 0.026, 0.026, 0.02, [
    t.x - 0.04,
    0.84,
    t.z - len / 2 + 0.24,
  ]);
  k.cyl('glass', '#ffffff', 0.025, 0.025, 0.08, [
    t.x + 0.04,
    0.79,
    t.z - len / 2 + 0.24,
  ]);
  k.cyl('paint', C.black, 0.026, 0.026, 0.02, [
    t.x + 0.04,
    0.84,
    t.z - len / 2 + 0.24,
  ]);
  for (const s of [-1, 1]) {
    const bx = t.x + s * 0.62;
    // Seat cushion with piping.
    k.rbox('paint', C.mintDeep, [0.42, 0.34, len], 0.04, [bx, 0.17, t.z]);
    k.rbox('gloss', C.mint, [0.42, 0.12, len], 0.05, [bx, 0.42, t.z]);
    k.box('chrome', C.chrome, [0.44, 0.02, len + 0.02], [bx, 0.36, t.z]);
    // Tufted back.
    const backX = t.x + s * 0.79;
    k.rbox('gloss', C.mint, [0.14, 0.62, len], 0.06, [backX, 0.72, t.z]);
    k.cyl('chrome', C.chrome, 0.03, 0.03, len, [backX, 1.04, t.z], {
      axis: 'z',
    });
    for (let i = 0; i < Math.round(len / 0.32); i++)
      k.sphere(
        'gloss',
        C.mintDark,
        0.022,
        [backX - s * 0.07, 0.78, t.z - len / 2 + 0.18 + i * 0.32],
        { seg: 8 },
      );
  }
}

// ---------------------------------------------------------------- figures

export type Figure = {
  root: THREE.Group;
  /** Turns with the walk and sways. */
  body: THREE.Group;
  legs: [THREE.Object3D, THREE.Object3D];
  arms?: [THREE.Object3D, THREE.Object3D];
  /** Where a carried dish sits. */
  hold?: THREE.Group;
};

const geoCache = new Map<string, Partial<Record<Mat, THREE.BufferGeometry>>>();
function cached(key: string, build: (k: Kit) => void) {
  let g = geoCache.get(key);
  if (!g) {
    const k = new Kit();
    build(k);
    g = k.build();
    geoCache.set(key, g);
  }
  return g;
}
/** Frees every cached figure and dish geometry (on unmount). */
export function disposeCache() {
  for (const parts of geoCache.values())
    for (const g of Object.values(parts)) g?.dispose();
  geoCache.clear();
}

function shared(
  parts: Partial<Record<Mat, THREE.BufferGeometry>>,
  mats: Materials,
  cast = true,
) {
  const group = new THREE.Group();
  for (const [mat, geo] of Object.entries(parts) as [
    Mat,
    THREE.BufferGeometry,
  ][]) {
    const mesh = new THREE.Mesh(geo, mats[mat]);
    mesh.castShadow = cast && mat !== 'glow' && mat !== 'glass';
    mesh.receiveShadow = false;
    group.add(mesh);
  }
  return group;
}

const HEAD_Y = 0.98;
const HEAD_R = 0.215;

function luminance(hex: string) {
  const c = new THREE.Color(hex);
  return 0.3 * c.r + 0.59 * c.g + 0.11 * c.b;
}

/** A guest's head and torso for a look: the parts that make the clue. */
function guestTop(k: Kit, look: Look) {
  const shirt = SHIRTS[look.shirt];
  const skin = SKINS[look.skin];
  // Torso, a chunky rounded shirt with a collar.
  k.capsule('paint', shirt, 0.2, 0.2, [0, 0.54, 0]);
  k.torus('paint', shirt, 0.11, 0.035, [0, 0.74, 0.02]);
  if (look.stripes) {
    const ink = luminance(shirt) > 0.55 ? '#2b2b40' : '#fbf7ef';
    for (const y of [0.44, 0.54, 0.64])
      k.torus('paint', ink, 0.205, 0.024, [0, y, 0]);
  }
  // Hands.
  k.sphere('paint', skin, 0.06, [-0.24, 0.45, 0.02]);
  k.sphere('paint', skin, 0.06, [0.24, 0.45, 0.02]);
  k.capsule('paint', shirt, 0.065, 0.14, [-0.22, 0.58, 0], {
    rot: [0, 0, 0.25],
  });
  k.capsule('paint', shirt, 0.065, 0.14, [0.22, 0.58, 0], {
    rot: [0, 0, -0.25],
  });
  // Head and face.
  k.sphere('paint', skin, HEAD_R, [0, HEAD_Y, 0], { seg: 22 });
  k.sphere('paint', skin, 0.045, [-HEAD_R - 0.01, HEAD_Y, 0]);
  k.sphere('paint', skin, 0.045, [HEAD_R + 0.01, HEAD_Y, 0]);
  k.sphere('paint', '#e07a6a', 0.03, [0, HEAD_Y - 0.03, HEAD_R - 0.01], {
    seg: 8,
  });
  if (!look.glasses) {
    k.sphere(
      'gloss',
      '#1b1720',
      0.03,
      [-0.075, HEAD_Y + 0.02, HEAD_R - 0.025],
      { seg: 10 },
    );
    k.sphere('gloss', '#1b1720', 0.03, [0.075, HEAD_Y + 0.02, HEAD_R - 0.025], {
      seg: 10,
    });
  } else {
    // Big wraparound shades, readable from the front and the side.
    k.rbox('gloss', '#121018', [0.4, 0.085, 0.06], 0.03, [
      0,
      HEAD_Y + 0.025,
      HEAD_R - 0.02,
    ]);
    k.box(
      'gloss',
      '#121018',
      [0.03, 0.04, 0.24],
      [-HEAD_R - 0.005, HEAD_Y + 0.03, 0.06],
    );
    k.box(
      'gloss',
      '#121018',
      [0.03, 0.04, 0.24],
      [HEAD_R + 0.005, HEAD_Y + 0.03, 0.06],
    );
    k.sphere(
      'gloss',
      '#2a3b6a',
      0.065,
      [-0.085, HEAD_Y + 0.02, HEAD_R + 0.005],
      { scale: [1, 0.75, 0.45] },
    );
    k.sphere(
      'gloss',
      '#2a3b6a',
      0.065,
      [0.085, HEAD_Y + 0.02, HEAD_R + 0.005],
      { scale: [1, 0.75, 0.45] },
    );
  }
  k.sphere('paint', '#ff9a9a', 0.035, [-0.13, HEAD_Y - 0.05, HEAD_R - 0.05], {
    scale: [1, 0.6, 0.5],
    seg: 8,
  });
  k.sphere('paint', '#ff9a9a', 0.035, [0.13, HEAD_Y - 0.05, HEAD_R - 0.05], {
    scale: [1, 0.6, 0.5],
    seg: 8,
  });
  hat(k, look);
}

function hat(k: Kit, look: Look) {
  const y = HEAD_Y;
  if (look.hat === 'none') {
    k.dome('paint', HAIRS[look.hair], HEAD_R + 0.012, [0, y, -0.01], 1.25, {
      rot: [-0.45, 0, 0],
    });
    return;
  }
  const c = HAT_COLOURS[look.hat];
  if (look.hat === 'cap') {
    k.dome('gloss', c, HEAD_R + 0.02, [0, y + 0.02, 0], Math.PI / 2);
    k.cyl('gloss', c, 0.17, 0.17, 0.025, [0, y + 0.05, HEAD_R + 0.04], {
      scale: [1.15, 1, 1],
    });
    k.sphere('gloss', c, 0.025, [0, y + HEAD_R + 0.03, 0]);
    k.dome('paint', HAIRS[look.hair], HEAD_R + 0.005, [0, y, -0.02], 1.5, {
      rot: [-0.9, 0, 0],
    });
  } else if (look.hat === 'bowler') {
    k.dome('gloss', c, HEAD_R + 0.02, [0, y + 0.06, 0], Math.PI / 2, {
      scale: [1, 1.25, 1],
    });
    k.cyl('gloss', c, 0.3, 0.3, 0.03, [0, y + 0.07, 0]);
    k.cyl('paint', '#7a1f2a', HEAD_R + 0.025, HEAD_R + 0.025, 0.05, [
      0,
      y + 0.1,
      0,
    ]);
  } else if (look.hat === 'beanie') {
    k.dome('paint', c, HEAD_R + 0.025, [0, y + 0.01, 0], 1.45);
    k.torus('paint', '#d97f12', HEAD_R + 0.01, 0.045, [0, y + 0.03, 0]);
    k.sphere('paint', '#fff1d6', 0.075, [0, y + HEAD_R + 0.07, 0]);
  } else {
    k.cyl('paint', c, 0.31, 0.31, 0.03, [0, y + 0.12, 0], {
      scale: [1, 1, 0.82],
    });
    k.cyl('paint', c, 0.15, 0.2, 0.22, [0, y + 0.24, 0]);
    k.cyl('paint', '#5a3a1e', 0.205, 0.205, 0.045, [0, y + 0.155, 0]);
    k.dome('paint', HAIRS[look.hair], HEAD_R + 0.005, [0, y, -0.02], 1.4, {
      rot: [-0.8, 0, 0],
    });
  }
}

function leg(k: Kit, colour: string, shoe: string) {
  // Built hanging down from the hip at the origin.
  k.capsule('paint', colour, 0.075, 0.14, [0, -0.13, 0]);
  k.rbox('gloss', shoe, [0.13, 0.08, 0.2], 0.035, [0, -0.29, 0.03]);
}

function makeLegs(
  mats: Materials,
  key: string,
  colour: string,
  shoe: string,
): [THREE.Group, THREE.Group] {
  const parts = cached(`leg:${key}`, (k) => leg(k, colour, shoe));
  const l = shared(parts, mats);
  const r = shared(parts, mats);
  l.position.set(-0.1, 0.33, 0);
  r.position.set(0.1, 0.33, 0);
  return [l, r];
}

const lookKey = (l: Look) =>
  `${l.skin}${l.hair}${l.hat}${l.shirt}${+l.stripes}${+l.glasses}`;
const PANTS = ['#2f3a5e', '#4a3b33', '#2a2a30', '#59504a'];

export function guestFigure(mats: Materials, look: Look): Figure {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  body.add(
    shared(
      cached(`guest:${lookKey(look)}`, (k) => guestTop(k, look)),
      mats,
    ),
  );
  const pants = PANTS[(look.skin + look.hair) % PANTS.length];
  const legs = makeLegs(mats, pants, pants, '#2a1d18');
  body.add(...legs);
  return { root, body, legs };
}

/** A waiter in a white shirt with an apron, bow tie and paper cap in the seat colour. */
export function waiterFigure(mats: Materials, seat: number): Figure {
  const colour = SEAT_COLOURS[seat % SEAT_COLOURS.length];
  const skin = SKINS[[1, 3, 0, 2][seat % 4]];
  const hair = HAIRS[[0, 2, 1, 3][seat % 4]];
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const top = cached(`waiter:${seat}`, (k) => {
    k.capsule('paint', C.white, 0.21, 0.2, [0, 0.54, 0]);
    k.rbox('paint', colour, [0.34, 0.36, 0.05], 0.03, [0, 0.47, 0.19]);
    k.box('paint', colour, [0.04, 0.24, 0.02], [-0.12, 0.66, 0.18], {
      rot: [0, 0, 0.3],
    });
    k.box('paint', colour, [0.04, 0.24, 0.02], [0.12, 0.66, 0.18], {
      rot: [0, 0, -0.3],
    });
    // Bow tie.
    k.cyl('gloss', colour, 0.0, 0.06, 0.08, [-0.045, 0.75, 0.19], {
      axis: 'x',
    });
    k.cyl('gloss', colour, 0.06, 0.0, 0.08, [0.045, 0.75, 0.19], { axis: 'x' });
    k.sphere('gloss', colour, 0.025, [0, 0.75, 0.2]);
    // Head.
    k.sphere('paint', skin, HEAD_R, [0, HEAD_Y, 0], { seg: 22 });
    k.sphere('paint', skin, 0.045, [-HEAD_R - 0.01, HEAD_Y, 0]);
    k.sphere('paint', skin, 0.045, [HEAD_R + 0.01, HEAD_Y, 0]);
    k.sphere(
      'gloss',
      '#1b1720',
      0.032,
      [-0.075, HEAD_Y + 0.02, HEAD_R - 0.025],
      { seg: 10 },
    );
    k.sphere(
      'gloss',
      '#1b1720',
      0.032,
      [0.075, HEAD_Y + 0.02, HEAD_R - 0.025],
      { seg: 10 },
    );
    k.sphere('paint', '#e07a6a', 0.03, [0, HEAD_Y - 0.03, HEAD_R - 0.01], {
      seg: 8,
    });
    k.torus(
      'paint',
      '#7a2d22',
      0.05,
      0.012,
      [0, HEAD_Y - 0.08, HEAD_R - 0.04],
      { arc: Math.PI, rot: [Math.PI / 2 + 0.3, 0, Math.PI] },
    );
    k.dome('paint', hair, HEAD_R + 0.012, [0, HEAD_Y, -0.01], 1.3, {
      rot: [-0.5, 0, 0],
    });
    // Soda-fountain paper cap.
    k.extrude(
      'paint',
      colour,
      sh([
        [-0.2, 0],
        [0.2, 0],
        [0.13, 0.13],
        [-0.13, 0.13],
      ]),
      0.2,
      [0, HEAD_Y + 0.15, -0.1],
      { rot: [Math.PI / 2, 0, 0] },
    );
    k.box('paint', C.white, [0.405, 0.03, 0.205], [0, HEAD_Y + 0.165, 0]);
  });
  body.add(shared(top, mats));
  // Arms on shoulder pivots, so a carried plate is held up in front.
  const armParts = cached(`arm:${seat}`, (k) => {
    k.capsule('paint', C.white, 0.07, 0.18, [0, -0.14, 0]);
    k.sphere('paint', skin, 0.065, [0, -0.3, 0]);
  });
  const armL = shared(armParts, mats);
  const armR = shared(armParts, mats);
  armL.position.set(-0.25, 0.7, 0);
  armR.position.set(0.25, 0.7, 0);
  body.add(armL, armR);
  const legs = makeLegs(mats, `waiter`, '#2b2d3a', '#141218');
  body.add(...legs);
  const hold = new THREE.Group();
  hold.position.set(0, 0.62, 0.34);
  body.add(hold);
  root.scale.setScalar(1.32);
  return { root, body, legs, arms: [armL, armR], hold };
}

/** A mimic's true form: glossy purple goo with one big eye. */
export function gooFigure(mats: Materials): Figure {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  body.add(
    shared(
      cached('goo', (k) => {
        k.sphere('gloss', C.goo, 0.34, [0, 0.3, 0], {
          scale: [1, 0.82, 1],
          seg: 24,
        });
        k.sphere('gloss', C.gooLight, 0.22, [0, 0.24, 0.16], {
          scale: [1, 0.7, 0.6],
        });
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          k.sphere(
            'gloss',
            C.goo,
            0.09,
            [Math.cos(a) * 0.3, 0.06, Math.sin(a) * 0.3],
            { scale: [1, 0.6, 1] },
          );
        }
        k.sphere('gloss', '#ffffff', 0.15, [0, 0.42, 0.22], { seg: 20 });
        k.sphere('gloss', '#121018', 0.075, [0, 0.42, 0.35], { seg: 14 });
        k.sphere('glow', '#ffffff', 0.025, [0.03, 0.46, 0.42], { seg: 8 });
        k.capsule('gloss', C.goo, 0.03, 0.12, [0.12, 0.62, 0], {
          rot: [0, 0, -0.4],
        });
        k.sphere('gloss', C.gooLight, 0.045, [0.17, 0.72, 0]);
      }),
      mats,
    ),
  );
  const nub = new THREE.Group();
  return { root, body, legs: [nub, nub] };
}

// ---------------------------------------------------------------- dishes

export type Prop = DishId | 'burnt' | 'dirty' | 'menu' | 'coins';

function plate(k: Kit, y = 0) {
  k.cyl('gloss', C.white, 0.17, 0.13, 0.025, [0, y + 0.012, 0]);
  k.torus('gloss', '#e9e1d0', 0.15, 0.012, [0, y + 0.026, 0]);
}

function dishParts(k: Kit, p: Prop) {
  if (p === 'burger') {
    plate(k);
    k.cyl('paint', '#e3a557', 0.11, 0.1, 0.05, [0, 0.055, 0]);
    k.cyl('paint', '#6b3a1f', 0.115, 0.115, 0.045, [0, 0.1, 0]);
    k.box('gloss', '#ffcc33', [0.17, 0.012, 0.17], [0, 0.127, 0], {
      rot: [0, 0.6, 0],
    });
    k.torus('paint', '#56b04a', 0.105, 0.02, [0, 0.135, 0]);
    k.dome('gloss', '#e8a24f', 0.115, [0, 0.14, 0], Math.PI / 2, {
      scale: [1, 0.75, 1],
    });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      k.sphere(
        'paint',
        '#fff2d0',
        0.01,
        [Math.cos(a) * 0.055, 0.215, Math.sin(a) * 0.055],
        { seg: 6 },
      );
    }
  } else if (p === 'shake') {
    k.cyl('glass', '#ffffff', 0.08, 0.055, 0.2, [0, 0.1, 0], { open: true });
    k.cyl('gloss', '#ff8fbf', 0.072, 0.052, 0.17, [0, 0.09, 0]);
    k.cyl('chrome', C.chrome, 0.05, 0.06, 0.02, [0, 0.01, 0]);
    k.sphere('paint', C.white, 0.075, [0, 0.2, 0], { scale: [1, 0.8, 1] });
    k.sphere('paint', C.white, 0.05, [0, 0.25, 0]);
    k.sphere('gloss', '#d1102c', 0.028, [0, 0.3, 0]);
    k.cyl('gloss', '#e3313f', 0.012, 0.012, 0.22, [0.04, 0.27, 0], {
      rot: [0, 0, -0.35],
    });
  } else if (p === 'pie') {
    plate(k);
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.lineTo(0.15, -0.06);
    s.absarc(0, 0, 0.16, -0.38, 0.38, false);
    s.lineTo(0, 0);
    k.extrude('paint', '#e6a64e', s, 0.07, [-0.07, 0.025, 0]);
    k.extrude('gloss', '#b3122b', s, 0.015, [-0.07, 0.09, 0], {
      scale: [0.92, 1, 0.92],
    });
    k.sphere('paint', C.white, 0.035, [0.02, 0.12, 0]);
  } else if (p === 'fries') {
    k.cyl('gloss', C.cherry, 0.09, 0.065, 0.13, [0, 0.065, 0], {
      seg: 4,
      rot: [0, Math.PI / 4, 0],
    });
    k.box('paint', C.white, [0.11, 0.03, 0.11], [0, 0.07, 0], {
      rot: [0, Math.PI / 4, 0],
    });
    for (let i = 0; i < 9; i++) {
      const a = i * 2.4;
      k.box(
        'paint',
        i % 3 ? '#f7c948' : '#e9b232',
        [0.022, 0.15, 0.022],
        [Math.cos(a) * 0.035, 0.17, Math.sin(a) * 0.035],
        {
          rot: [Math.sin(a) * 0.25, 0, Math.cos(a) * 0.25],
        },
      );
    }
  } else if (p === 'burnt') {
    plate(k);
    k.sphere('paint', '#1c1714', 0.11, [0, 0.06, 0], { scale: [1, 0.55, 1] });
    k.sphere('paint', '#2b221d', 0.06, [0.04, 0.1, 0.02], {
      scale: [1, 0.6, 1],
    });
  } else if (p === 'dirty') {
    for (let i = 0; i < 3; i++) {
      k.cyl(
        'gloss',
        C.white,
        0.16,
        0.12,
        0.025,
        [i * 0.01, 0.015 + i * 0.03, -i * 0.01],
        { rot: [0.05 * i, 0, 0.06 * i] },
      );
      k.sphere(
        'paint',
        i % 2 ? '#a0632f' : '#d9a35b',
        0.03,
        [0.05 - i * 0.03, 0.035 + i * 0.03, 0.03],
        { scale: [1.4, 0.3, 1] },
      );
    }
    k.box('chrome', C.chrome, [0.02, 0.01, 0.2], [0.06, 0.11, 0], {
      rot: [0, 0.5, 0],
    });
  } else if (p === 'menu') {
    k.rbox('gloss', C.cherry, [0.26, 0.34, 0.03], 0.02, [0, 0.12, 0], {
      rot: [-0.25, 0, 0],
    });
    k.box('paint', C.cream, [0.2, 0.26, 0.01], [0, 0.12, 0.018], {
      rot: [-0.25, 0, 0],
    });
  } else if (p === 'coins') {
    for (let i = 0; i < 5; i++)
      k.cyl(
        'chrome',
        C.gold,
        0.05,
        0.05,
        0.018,
        [(i % 2) * 0.02 - 0.01, 0.01 + i * 0.019, (i % 3) * 0.01],
        { seg: 16 },
      );
    k.cyl('chrome', C.gold, 0.05, 0.05, 0.018, [0.09, 0.01, 0.03], { seg: 16 });
  }
}

/** A dish (or a stack of dirty plates, a menu, coins) as a small group. */
export function propMesh(mats: Materials, p: Prop) {
  return shared(
    cached(`prop:${p}`, (k) => dishParts(k, p)),
    mats,
    true,
  );
}

/** A flat glossy splat of goo, for puddles. */
export function puddleMesh(mats: Materials) {
  return shared(
    cached('puddle', (k) => {
      k.cyl('gloss', C.goo, 0.5, 0.52, 0.02, [0, 0.01, 0], {
        seg: 28,
        scale: [1, 1, 0.8],
      });
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2 + 0.3;
        const r = 0.45 + (i % 3) * 0.08;
        k.cyl(
          'gloss',
          i % 2 ? C.goo : '#6a2ee0',
          0.14 + (i % 2) * 0.05,
          0.15,
          0.022,
          [Math.cos(a) * r, 0.011, Math.sin(a) * r * 0.8],
          { seg: 14 },
        );
      }
      k.sphere('gloss', C.gooLight, 0.08, [0.15, 0.02, -0.1], {
        scale: [1.6, 0.25, 1],
      });
      k.sphere('gloss', C.gooLight, 0.05, [-0.2, 0.02, 0.12], {
        scale: [1.4, 0.25, 1],
      });
    }),
    mats,
    false,
  );
}

/** Station props that change with its state. */
export function pattyMesh(mats: Materials, burnt: boolean) {
  return shared(
    cached(`patty:${burnt}`, (k) => {
      k.cyl(
        'paint',
        burnt ? '#1c1714' : '#7a4426',
        0.13,
        0.13,
        0.045,
        [0, 0.022, 0],
        { seg: 20 },
      );
      if (!burnt)
        k.box('gloss', '#ffcc33', [0.18, 0.012, 0.18], [0, 0.05, 0], {
          rot: [0, 0.4, 0],
        });
    }),
    mats,
  );
}
export function basketMesh(mats: Materials) {
  return shared(
    cached('basket', (k) => {
      k.box('chrome', C.steel, [0.42, 0.16, 0.3], [0, 0.08, 0]);
      k.box('paint', '#f2c14b', [0.38, 0.06, 0.26], [0, 0.15, 0]);
      k.cyl('chrome', C.chrome, 0.02, 0.02, 0.36, [0, 0.2, 0.32], {
        axis: 'z',
      });
      k.cyl('paint', C.black, 0.03, 0.03, 0.1, [0, 0.22, 0.52], { axis: 'z' });
    }),
    mats,
  );
}
export function shakeCupMesh(mats: Materials) {
  return shared(
    cached('shakecup', (k) => {
      k.cyl('chrome', C.chrome, 0.09, 0.07, 0.3, [0, 0.15, 0]);
      k.cyl('gloss', '#ff9cc5', 0.08, 0.08, 0.02, [0, 0.29, 0]);
    }),
    mats,
  );
}
