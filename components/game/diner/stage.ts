import * as THREE from 'three';
import {
  boothHz,
  COUNTER_Z,
  D,
  DOOR_GAP,
  FRONT_Z,
  JUKEBOX,
  TABLES,
  W,
  type TableSlot,
} from '@/lib/games/diner/layout';
import { checkerTexture, deckTexture, groundTexture } from './grounds';
import { Kit, meshes } from './kit';
import { buildRig, RIG, TRAILER_DEPTH, TRAILER_ROOF } from './rig';
import { buildScenery } from './scenery';
import { STAGE, type BuildStage } from './stage-contract';

/**
 * A shift's stage (9 October 2026): the rig parked along the back with its
 * kitchen hatch open, the patio deck unfolded in front of it, and the place
 * around. Everything a guest or a waiter touches sits on the deck; the place
 * only frames it, quietly, beyond the rail.
 */

const P = {
  bench: '#4f7c73',
  benchDark: '#3c625a',
  benchPiping: '#d9cdb2',
  table: '#efe6d3',
  rail: '#c9d0d4',
  post: '#3d474c',
  deckEdge: '#6a5040',
  planter: '#a26a5c',
  leaf: '#5e8460',
  leafLight: '#7aa078',
};

function booth(k: Kit, t: TableSlot) {
  const length = boothHz(t.seats) * 2 - 0.04;
  // Table: a chrome-edged cream top on one pedestal.
  k.rbox('chrome', RIG.chrome, [0.74, 0.05, length - 0.08], 0.024, [
    t.x,
    STAGE.tableTop - 0.045,
    t.z,
  ]);
  k.rbox('laminate', P.table, [0.7, 0.04, length - 0.12], 0.02, [
    t.x,
    STAGE.tableTop - 0.02,
    t.z,
  ]);
  k.cyl('chrome', RIG.steel, 0.045, 0.06, 0.66, [t.x, 0.35, t.z], { seg: 16 });
  k.cyl('chrome', RIG.steel, 0.17, 0.21, 0.04, [t.x, 0.02, t.z], { seg: 20 });
  // A napkin holder and a sugar pourer, so tables are not bare.
  k.rbox('chrome', RIG.chrome, [0.12, 0.09, 0.05], 0.015, [
    t.x,
    STAGE.tableTop + 0.045,
    t.z - length / 2 + 0.16,
  ]);
  k.cyl(
    'glass',
    '#eef4f6',
    0.03,
    0.03,
    0.1,
    [t.x + 0.14, STAGE.tableTop + 0.05, t.z - length / 2 + 0.16],
    { seg: 10 },
  );
  for (const side of [-1, 1]) {
    const x = t.x + side * 0.62;
    // Seat box, a rounded cushion and a tall rounded back with piping.
    k.rbox('paint', P.benchDark, [0.4, 0.3, length], 0.04, [x, 0.17, t.z]);
    k.rbox('vinyl', P.bench, [0.44, 0.14, length - 0.02], 0.06, [
      x,
      STAGE.seatTop - 0.06,
      t.z,
    ]);
    k.rbox('vinyl', P.bench, [0.17, 0.56, length - 0.02], 0.08, [
      x + side * 0.17,
      0.72,
      t.z,
    ]);
    k.rbox('vinyl', P.benchDark, [0.19, 0.06, length], 0.03, [
      x + side * 0.17,
      0.99,
      t.z,
    ]);
    k.rbox('chrome', RIG.chrome, [0.46, 0.03, length + 0.01], 0.012, [
      x,
      0.33,
      t.z,
    ]);
  }
}

function jukebox(k: Kit, lit: Kit) {
  const { x, z } = JUKEBOX;
  // A Wurlitzer-style cabinet turned toward the front-left of the deck: a
  // rounded top with a lit arch, a window onto the records, a speaker grille.
  const yaw = -0.75;
  const c = Math.cos(yaw),
    s = Math.sin(yaw);
  const at = (dx: number, dy: number, dz: number): [number, number, number] => [
    x + dx * c + dz * s,
    dy,
    z - dx * s + dz * c,
  ];
  const rot = { rot: [0, yaw, 0] as [number, number, number] };
  k.rbox('wood', '#6a4146', [0.66, 1.05, 0.44], 0.08, at(0, 0.55, 0), rot);
  k.cyl('wood', '#6a4146', 0.33, 0.33, 0.44, at(0, 1.08, 0), {
    axis: 'z',
    rot: [0, yaw, 0],
    seg: 28,
  });
  k.rbox('chrome', RIG.chrome, [0.58, 0.9, 0.05], 0.03, at(0, 0.55, 0.22), rot);
  k.cyl('glass', '#f3e6c6', 0.24, 0.24, 0.05, at(0, 1.02, 0.22), {
    axis: 'z',
    rot: [0, yaw, 0],
    seg: 24,
  });
  k.box('paint', '#3c3337', [0.4, 0.32, 0.03], at(0, 0.38, 0.245), rot);
  for (let i = 0; i < 6; i++)
    k.box(
      'chrome',
      '#b9ad92',
      [0.36, 0.012, 0.035],
      at(0, 0.25 + i * 0.05, 0.255),
      rot,
    );
  const arch: [number, number, number][] = [];
  for (let i = 0; i <= 18; i++) {
    const a = Math.PI - (i / 18) * Math.PI;
    arch.push(at(Math.cos(a) * 0.3, 1.04 + Math.sin(a) * 0.3, 0.24));
  }
  lit.tube('glow', '#ffb88a', arch, 0.018);
  for (let i = 0; i < 5; i++)
    lit.box(
      'glow',
      i % 2 ? '#8fd8c4' : '#ffd38a',
      [0.05, 0.04, 0.02],
      at(-0.14 + i * 0.07, 0.72, 0.25),
      rot,
    );
}

function planter(k: Kit, x: number, z: number, scale = 1) {
  k.cyl(
    'ceramic',
    P.planter,
    0.28 * scale,
    0.21 * scale,
    0.46 * scale,
    [x, 0.23 * scale, z],
    { seg: 18 },
  );
  k.cyl(
    'chrome',
    RIG.steel,
    0.29 * scale,
    0.29 * scale,
    0.03,
    [x, 0.45 * scale, z],
    { seg: 18 },
  );
  k.cyl(
    'paint',
    '#3b3330',
    0.25 * scale,
    0.25 * scale,
    0.02,
    [x, 0.44 * scale, z],
    { seg: 18 },
  );
  for (let i = 0; i < 9; i++) {
    const a = i * 2.4;
    const r = (0.08 + (i % 3) * 0.06) * scale;
    k.sphere(
      'paint',
      i % 2 ? P.leaf : P.leafLight,
      0.15 * scale,
      [
        x + Math.sin(a) * r,
        (0.62 + (i % 3) * 0.12) * scale,
        z + Math.cos(a) * r,
      ],
      { scale: [1, 0.8, 1], seg: 12 },
    );
  }
}

/** A sagging string of warm bulbs between two points. */
function festoon(
  k: Kit,
  lit: Kit,
  a: [number, number, number],
  b: [number, number, number],
  sag: number,
  bulbs: number,
) {
  const points: [number, number, number][] = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    points.push([
      a[0] + (b[0] - a[0]) * t,
      a[1] + (b[1] - a[1]) * t - Math.sin(t * Math.PI) * sag,
      a[2] + (b[2] - a[2]) * t,
    ]);
  }
  k.tube('paint', '#2b2a2e', points, 0.008);
  for (let i = 1; i < bulbs; i++) {
    const t = i / bulbs;
    lit.sphere(
      'glow',
      RIG.warm,
      0.05,
      [
        a[0] + (b[0] - a[0]) * t,
        a[1] + (b[1] - a[1]) * t - Math.sin(t * Math.PI) * sag - 0.06,
        a[2] + (b[2] - a[2]) * t,
      ],
      { scale: [1, 1.25, 1], seg: 10 },
    );
  }
}

function lampPost(k: Kit, lit: Kit, x: number, z: number, h: number) {
  k.cyl('paint', P.post, 0.05, 0.07, h, [x, h / 2, z], { seg: 14 });
  k.cyl('paint', P.post, 0.13, 0.16, 0.1, [x, 0.05, z], { seg: 16 });
  k.cyl('paint', P.post, 0.12, 0.05, 0.14, [x, h + 0.02, z], { seg: 16 });
  lit.sphere('glow', RIG.warm, 0.1, [x, h - 0.08, z], { seg: 14 });
}

export const buildStage: BuildStage = (mats, options) => {
  const { place, quality, tables } = options;
  const group = new THREE.Group();
  const owned: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(x: T) => (owned.push(x), x);
  const k = new Kit();
  const lit = new Kit();

  // The rig, its hatch just behind the machines; the worktop reaches out to
  // the counter line as a serving ledge.
  const hatch = 1.2;
  const rig = buildRig(mats, {
    length: W + 0.8,
    open: true,
    quality,
    ledge: COUNTER_Z - hatch,
  });
  rig.group.position.set(-0.4, 0, hatch - TRAILER_DEPTH / 2);
  group.add(rig.group);

  // The deck: warm planks, with the diner's checker as a runner along the
  // counter, where the waiters stand.
  const deckTex = keep(deckTexture());
  const deckW = W + 0.6;
  const deckD = D - COUNTER_Z + 0.4;
  deckTex.repeat.set(deckW / 2.4, deckD / 2.4);
  const deckMat = keep(
    new THREE.MeshStandardMaterial({
      map: deckTex,
      roughness: 0.78,
      metalness: 0,
    }),
  );
  const deckGeo = keep(new THREE.PlaneGeometry(deckW, deckD));
  const deck = new THREE.Mesh(deckGeo, deckMat);
  deck.rotation.x = -Math.PI / 2;
  deck.position.set(W / 2, 0, COUNTER_Z - 0.35 + deckD / 2);
  deck.receiveShadow = true;
  group.add(deck);
  const runnerTex = keep(checkerTexture());
  const runnerD = 1.05;
  runnerTex.repeat.set(W / 0.84, runnerD / 0.84);
  const runnerMat = keep(
    new THREE.MeshStandardMaterial({
      map: runnerTex,
      roughness: 0.55,
      metalness: 0,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    }),
  );
  const runnerGeo = keep(new THREE.PlaneGeometry(W, runnerD));
  const runner = new THREE.Mesh(runnerGeo, runnerMat);
  runner.rotation.x = -Math.PI / 2;
  runner.position.set(W / 2, 0.002, COUNTER_Z + runnerD / 2 + 0.02);
  runner.receiveShadow = true;
  group.add(runner);
  k.box(
    'chrome',
    RIG.steel,
    [W, 0.012, 0.05],
    [W / 2, 0.006, COUNTER_Z + runnerD + 0.045],
  );
  const edge = (x0: number, z0: number, x1: number, z1: number) =>
    k.rbox(
      'wood',
      P.deckEdge,
      [Math.abs(x1 - x0) + 0.16, 0.2, Math.abs(z1 - z0) + 0.16],
      0.03,
      [(x0 + x1) / 2, -0.1, (z0 + z1) / 2],
    );
  edge(-0.3, D, W + 0.3, D);
  edge(-0.3, COUNTER_Z, -0.3, D);
  edge(W + 0.3, COUNTER_Z, W + 0.3, D);

  // A low rail with a gate on the left, round the front and the right.
  const rail = (x0: number, z0: number, x1: number, z1: number) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const n = Math.max(1, Math.round(len / 1.3));
    k.rbox(
      'chrome',
      P.rail,
      [Math.abs(x1 - x0) + 0.05, 0.05, Math.abs(z1 - z0) + 0.05],
      0.022,
      [(x0 + x1) / 2, 0.7, (z0 + z1) / 2],
    );
    k.rbox(
      'gloss',
      RIG.cherry,
      [Math.abs(x1 - x0) + 0.04, 0.05, Math.abs(z1 - z0) + 0.04],
      0.02,
      [(x0 + x1) / 2, 0.2, (z0 + z1) / 2],
    );
    for (let i = 0; i <= n; i++)
      k.cyl(
        'chrome',
        P.rail,
        0.025,
        0.032,
        0.7,
        [x0 + ((x1 - x0) * i) / n, 0.35, z0 + ((z1 - z0) * i) / n],
        { seg: 10 },
      );
  };
  const fz = FRONT_Z + 0.12;
  rail(-0.18, COUNTER_Z + 0.1, -0.18, DOOR_GAP[0]);
  rail(-0.18, DOOR_GAP[1], -0.18, fz);
  rail(-0.18, fz, W + 0.18, fz);
  rail(W + 0.18, COUNTER_Z + 0.1, W + 0.18, fz);
  const gate = new THREE.Group();
  gate.position.set(-0.18, 0, DOOR_GAP[0]);
  const gk = new Kit();
  const gap = DOOR_GAP[1] - DOOR_GAP[0];
  gk.rbox('gloss', RIG.cherry, [0.06, 0.34, gap - 0.08], 0.03, [
    0,
    0.4,
    gap / 2,
  ]);
  gk.rbox('chrome', P.rail, [0.07, 0.05, gap - 0.04], 0.02, [0, 0.62, gap / 2]);
  gate.add(meshes(gk.build(), mats));
  group.add(gate);

  for (const i of new Set(tables)) {
    const t = TABLES[i];
    if (t) booth(k, t);
  }
  jukebox(k, lit);

  // Planters in both front corners (touch controls sit over them) and by
  // the gate; lamp posts at the deck's corners with bulbs strung down the sides.
  planter(k, 0.55, FRONT_Z - 0.45);
  planter(k, W - 0.55, FRONT_Z - 0.45);
  planter(k, -0.75, DOOR_GAP[1] + 0.55, 0.9);
  for (const x of [-0.42, W + 0.42]) {
    lampPost(k, lit, x, COUNTER_Z + 0.25, 3.1);
    lampPost(k, lit, x, FRONT_Z + 0.32, 3.1);
    festoon(
      k,
      lit,
      [x, 3.0, COUNTER_Z + 0.25],
      [x, 3.0, FRONT_Z + 0.32],
      0.45,
      12,
    );
  }
  // A chalkboard by the gate: today's specials.
  k.rbox(
    'wood',
    '#5b3d2b',
    [0.07, 0.95, 0.62],
    0.02,
    [-1.15, 0.47, DOOR_GAP[0] - 0.55],
    { rot: [0, 0, 0.12] },
  );
  k.rbox(
    'paint',
    '#2d3330',
    [0.04, 0.72, 0.5],
    0.02,
    [-1.105, 0.55, DOOR_GAP[0] - 0.55],
    { rot: [0, 0, 0.12] },
  );
  for (let i = 0; i < 4; i++)
    k.box(
      'paint',
      i ? '#d9d4c4' : '#e8a77f',
      [0.01, 0.025, 0.3 - i * 0.04],
      [-1.08 + i * 0.012, 0.8 - i * 0.12, DOOR_GAP[0] - 0.55],
      { rot: [0, 0, 0.12] },
    );

  // The place: its ground and a few things around the patio.
  const ground = groundTexture(place);
  keep(ground.texture);
  ground.texture.repeat.set(120 / ground.size, 90 / ground.size);
  const groundMat = keep(
    new THREE.MeshStandardMaterial({
      map: ground.texture,
      roughness: 0.95,
      metalness: 0,
    }),
  );
  const groundGeo = keep(new THREE.PlaneGeometry(120, 90));
  const groundMesh = new THREE.Mesh(groundGeo, groundMat);
  groundMesh.rotation.x = -Math.PI / 2;
  groundMesh.position.set(W / 2, -0.2, 6);
  groundMesh.receiveShadow = true;
  group.add(groundMesh);
  const scenery = buildScenery(mats, place, quality);
  group.add(scenery.group);

  group.add(meshes(k.build(), mats));
  const glow = keep(
    new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
  );
  for (const geo of Object.values(lit.build()))
    if (geo) group.add(new THREE.Mesh(geo, glow));

  const signTop = TRAILER_ROOF + 0.32 + 0.82;
  return {
    group,
    landmarks: [
      new THREE.Vector3(W / 2 - 2.3, signTop, hatch - 0.35),
      new THREE.Vector3(W / 2 + 2.3, signTop, hatch - 0.35),
    ],
    update(cues) {
      const level = cues.power
        ? 1
        : 0.45 +
          (cues.reduced
            ? 0
            : 0.1 * Math.sin(cues.time * 23) * Math.sin(cues.time * 7));
      glow.color.setScalar(1.6 * level);
      for (const m of rig.lights)
        (m as THREE.MeshBasicMaterial).color.setScalar(1.5 * level);
      const hum = cues.reduced
        ? 1
        : 0.94 +
          0.06 * Math.sin(cues.time * 2.1) +
          (Math.sin(cues.time * 37) > 0.995 ? -0.4 : 0);
      rig.neon.color.set('#ff6f6a').multiplyScalar(1.7 * level * hum);
      gate.rotation.y = -THREE.MathUtils.clamp(cues.gate, 0, 1) * 1.3;
      scenery.update(cues);
    },
    dispose() {
      rig.dispose();
      scenery.dispose();
      group.traverse((n) => {
        if (
          n instanceof THREE.Mesh &&
          n.geometry !== deckGeo &&
          n.geometry !== groundGeo &&
          n.geometry !== runnerGeo
        )
          n.geometry.dispose();
      });
      for (const d of owned) d.dispose();
    },
  };
};
