import * as THREE from 'three';
import type { StationId } from '@/lib/games/diner/content';
import { COUNTER_X } from '@/lib/games/diner/layout';
import { pie as pieSlice } from './food';
import { Kit, meshes, type Materials } from './kit';
import { C, stationLaneX, type MachineRig } from './models';
import { STAGE } from './stage-contract';

/**
 * Everything on the counter that you use (8 October 2026, Claude's half of
 * the 3D split): chunky, colourful machines that read from the play camera,
 * each with the moving parts and status lamps the view animates. The
 * counter itself, the car and the patio come from `stage.ts`.
 */
export type CounterOptions = {
  stations: readonly StationId[];
  grillLanes: number;
  pass: boolean;
  coffee: boolean;
};
/** Where the view puts what is cooking and what is ready, per machine. */
export type StationAnchor = {
  /** Height and depth of a cooking item (patty, basket, cup). */
  cookY: number;
  cookZ: number;
  /** A lowered fryer basket. */
  downY?: number;
  /** A ready plate waiting at the front of the machine. */
  readyY: number;
  readyZ: number;
};
export type Counter = {
  group: THREE.Group;
  machines: Map<StationId, MachineRig>;
  anchors: Map<StationId, StationAnchor>;
  binLid: THREE.Object3D;
  water: THREE.Object3D;
  /** Where plates on the heat-lamp pass sit, oldest first. */
  passSpots: THREE.Vector3[];
  dispose: () => void;
};

const T = STAGE.counterTop;
const READY_Z = 1.2;
/** The same lanes the view places patties, cups and plates on. */
const laneX = stationLaneX;

type Keep = <T extends { dispose: () => void }>(x: T) => T;

function lamp(keep: Keep, at: [number, number, number]) {
  const m = new THREE.Mesh(
    keep(new THREE.SphereGeometry(0.03, 12, 10)),
    keep(new THREE.MeshBasicMaterial({ color: '#69dab7', toneMapped: false })),
  );
  m.position.set(...at);
  m.scale.z = 0.5;
  return m;
}

/** A round dial with a cherry needle; the view turns the needle. */
function dial(
  k: Kit,
  mats: Materials,
  group: THREE.Group,
  at: [number, number, number],
) {
  const [x, y, z] = at;
  k.cyl('chrome', C.chrome, 0.075, 0.075, 0.02, [x, y, z], { axis: 'z' });
  k.cyl('ceramic', C.cream, 0.064, 0.064, 0.022, [x, y, z + 0.008], {
    axis: 'z',
  });
  const needle = new THREE.Group();
  const nk = new Kit();
  nk.box('gloss', C.cherry, [0.01, 0.05, 0.008], [0, 0.02, 0]);
  nk.cyl('chrome', C.chrome, 0.01, 0.01, 0.012, [0, 0, 0], {
    axis: 'z',
    seg: 12,
  });
  needle.add(meshes(nk.build(), mats));
  needle.position.set(x, y, z + 0.024);
  group.add(needle);
  return needle;
}

function grill(
  k: Kit,
  mats: Materials,
  group: THREE.Group,
  keep: Keep,
  lanes: number,
) {
  const x = COUNTER_X.grill;
  const w = lanes === 3 ? 1.08 : 0.98;
  // Steel body, black griddle plate, splash guard and side cheeks.
  k.rbox('chrome', C.steel, [w + 0.06, 0.17, 0.74], 0.03, [x, T + 0.085, 0.64]);
  k.rbox('gloss', C.cherry, [w + 0.08, 0.1, 0.05], 0.02, [x, T + 0.07, 1.0]);
  k.box('paint', '#262224', [w - 0.04, 0.03, 0.6], [x, T + 0.18, 0.66]);
  k.rbox('chrome', C.chrome, [w + 0.06, 0.34, 0.05], 0.02, [x, T + 0.3, 0.28]);
  for (const side of [-1, 1])
    k.rbox('chrome', C.chrome, [0.04, 0.2, 0.66], 0.015, [
      x + side * (w / 2 + 0.01),
      T + 0.25,
      0.62,
    ]);
  // Grease trough and the knob rail in front, cherry knobs.
  k.box('chrome', '#9aa6ae', [w - 0.04, 0.03, 0.06], [x, T + 0.17, 0.98]);
  k.cyl('chrome', C.chrome, 0.018, 0.018, w + 0.04, [x, T + 0.12, 1.02], {
    axis: 'x',
  });
  for (let i = 0; i < lanes + 1; i++)
    k.cyl(
      'gloss',
      C.cherry,
      0.032,
      0.035,
      0.05,
      [x - w / 2 + 0.12 + (i * (w - 0.24)) / lanes, T + 0.07, 1.03],
      { axis: 'z' },
    );
  // The hood above: chrome with a cherry band, catching the steam.
  k.rbox('chrome', C.chrome, [w + 0.24, 0.3, 0.52], 0.06, [x, 2.02, 0.36]);
  k.rbox('gloss', C.cherry, [w + 0.25, 0.07, 0.53], 0.03, [x, 1.92, 0.36]);
  for (let i = 0; i < 6; i++)
    k.box(
      'paint',
      '#2f3138',
      [w + 0.1, 0.012, 0.03],
      [x, 1.87, 0.18 + i * 0.065],
    );
  const needle = dial(k, mats, group, [x + w / 2 - 0.12, T + 0.33, 0.31]);
  const indicators = Array.from({ length: lanes }, (_, i) => {
    const m = lamp(keep, [laneX('grill', i, lanes), T + 0.12, 1.045]);
    group.add(m);
    return m;
  });
  // Heat shimmer lines on the plate.
  const hk = new Kit();
  for (let i = 0; i < 4; i++)
    hk.tube(
      'glow',
      '#ffffff',
      [
        [-w / 2 + 0.06, 0, -0.22 + i * 0.145],
        [w / 2 - 0.06, 0, -0.22 + i * 0.145],
      ],
      0.01,
    );
  const heat = new THREE.Mesh(
    hk.build().glow!,
    keep(
      new THREE.MeshBasicMaterial({
        color: '#ff6a33',
        transparent: true,
        opacity: 0.1,
        toneMapped: false,
        depthWrite: false,
      }),
    ),
  );
  heat.position.set(x, T + 0.197, 0.66);
  group.add(heat);
  return {
    indicator: indicators[0],
    indicators,
    needle,
    heat,
    pulse: 0,
  } satisfies MachineRig;
}

function fryer(k: Kit, mats: Materials, group: THREE.Group, keep: Keep) {
  const x = COUNTER_X.fryer;
  k.rbox('chrome', C.steel, [0.92, 0.44, 0.7], 0.04, [x, T + 0.22, 0.66]);
  k.rbox('gloss', C.cherry, [0.94, 0.16, 0.04], 0.02, [x, T + 0.2, 1.01]);
  for (const side of [-1, 1])
    k.cyl(
      'chrome',
      C.chrome,
      0.03,
      0.03,
      0.03,
      [x + side * 0.22, T + 0.2, 1.04],
      { axis: 'z' },
    );
  k.rbox('chrome', C.chrome, [0.96, 0.04, 0.74], 0.02, [x, T + 0.44, 0.66]);
  // Two wells of golden oil, warm and faintly glowing.
  for (const side of [-1, 1]) {
    k.box(
      'paint',
      '#2b2422',
      [0.38, 0.02, 0.46],
      [x + side * 0.22, T + 0.452, 0.66],
    );
    k.box(
      'glow',
      '#c98a2a',
      [0.34, 0.012, 0.42],
      [x + side * 0.22, T + 0.455, 0.66],
    );
  }
  // A cherry control panel at the back, with a dial.
  k.rbox('gloss', C.cherry, [0.94, 0.3, 0.1], 0.03, [x, T + 0.6, 0.3]);
  k.rbox('chrome', C.chrome, [0.96, 0.05, 0.12], 0.02, [x, T + 0.77, 0.3]);
  // Hanging hooks for the baskets.
  for (const side of [-1, 1])
    k.cyl(
      'chrome',
      C.chrome,
      0.012,
      0.012,
      0.16,
      [x + side * 0.22, T + 0.8, 0.36],
      { axis: 'z' },
    );
  const needle = dial(k, mats, group, [x + 0.34, T + 0.62, 0.36]);
  const indicators = [0, 1].map((i) => {
    const m = lamp(keep, [laneX('fryer', i, 2), T + 0.55, 0.36]);
    group.add(m);
    return m;
  });
  return {
    indicator: indicators[0],
    indicators,
    needle,
    pulse: 0,
  } satisfies MachineRig;
}

function shakeMachine(k: Kit, mats: Materials, group: THREE.Group, keep: Keep) {
  const x = COUNTER_X.shake;
  // A mint mixer in the 1950s style: wide base, a column, a two-spindle head.
  k.rbox('gloss', C.mint, [0.94, 0.09, 0.56], 0.04, [x, T + 0.045, 0.72]);
  k.rbox('chrome', C.chrome, [0.96, 0.02, 0.58], 0.01, [x, T + 0.095, 0.72]);
  k.rbox('gloss', C.mint, [0.3, 0.9, 0.28], 0.08, [x, T + 0.5, 0.42]);
  k.rbox('gloss', C.mint, [0.98, 0.2, 0.46], 0.08, [x, T + 0.98, 0.62]);
  k.rbox('chrome', C.chrome, [0.99, 0.03, 0.47], 0.015, [x, T + 0.89, 0.62]);
  for (let i = 0; i < 5; i++)
    k.box(
      'chrome',
      '#a8e0d4',
      [0.16, 0.014, 0.012],
      [x, T + 0.3 + i * 0.07, 0.565],
    );
  for (const side of [-1, 1]) {
    k.cyl(
      'gloss',
      C.cherry,
      0.04,
      0.04,
      0.06,
      [x + side * 0.28, T + 1.0, 0.86],
      { axis: 'z' },
    );
    k.torus('chrome', C.chrome, 0.11, 0.011, [x + side * 0.28, T + 0.11, 0.78]);
  }
  const needle = dial(k, mats, group, [x, T + 0.66, 0.565]);
  const indicators = [0, 1].map((i) => {
    const m = lamp(keep, [laneX('shake', i, 2), T + 0.98, 0.86]);
    group.add(m);
    return m;
  });
  const rotors = [0, 1].map((i) => {
    const rotor = new THREE.Group();
    const rk = new Kit();
    rk.cyl('chrome', C.chrome, 0.014, 0.014, 0.34, [0, 0, 0]);
    rk.box('chrome', C.chrome, [0.09, 0.022, 0.018], [0, -0.15, 0]);
    rk.torus('gloss', '#ffa2c4', 0.065, 0.01, [0, -0.16, 0]);
    rotor.add(meshes(rk.build(), mats));
    rotor.position.set(laneX('shake', i, 2), T + 0.72, 0.78);
    group.add(rotor);
    return rotor;
  });
  return {
    indicator: indicators[0],
    indicators,
    needle,
    rotor: rotors[0],
    rotors,
    pulse: 0,
  } satisfies MachineRig;
}

function pieCase(k: Kit, mats: Materials, group: THREE.Group, keep: Keep) {
  const x = COUNTER_X.pie;
  // A cake stand that turns slowly under a glass dome.
  k.cyl('chrome', C.chrome, 0.36, 0.4, 0.06, [x, T + 0.03, 0.7]);
  k.cyl('chrome', C.chrome, 0.05, 0.09, 0.22, [x, T + 0.17, 0.7]);
  k.cyl('ceramic', C.cream, 0.4, 0.38, 0.03, [x, T + 0.29, 0.7]);
  k.torus('gloss', C.cherry, 0.395, 0.012, [x, T + 0.305, 0.7]);
  const rotor = new THREE.Group();
  const pk = new Kit();
  // A whole pie with one slice already cut.
  for (let i = 0; i < 6; i++) {
    const sk = new Kit();
    pieSlice(sk);
    for (const [mat, geo] of Object.entries(sk.build()))
      if (geo && mat !== 'ceramic') {
        const g = geo.clone();
        g.translate(0.06, -0.018, 0);
        g.rotateY((i / 6) * Math.PI * 2 + 0.3);
        g.scale(1.6, 1.4, 1.6);
        pk.add(mat as Parameters<Kit['add']>[0], '#ffffff', g, [0, 0, 0]);
        geo.dispose();
      } else geo?.dispose();
  }
  rotor.add(meshes(pk.build(), mats));
  rotor.position.set(x, T + 0.31, 0.7);
  group.add(rotor);
  const cover = new THREE.Group();
  const ck = new Kit();
  ck.dome('glass', '#e2f4ff', 0.42, [0, 0, 0.28]);
  ck.sphere('chrome', C.chrome, 0.035, [0, 0.43, 0.28]);
  ck.torus('chrome', C.chrome, 0.42, 0.01, [0, 0, 0.28]);
  cover.add(meshes(ck.build(), mats));
  cover.position.set(x, T + 0.31, 0.42);
  group.add(cover);
  const needle = new THREE.Group();
  needle.visible = false;
  group.add(needle);
  const indicator = lamp(keep, [x, T + 0.04, 1.11]);
  group.add(indicator);
  return { indicator, needle, rotor, cover, pulse: 0 } satisfies MachineRig;
}

function sink(k: Kit) {
  const x = COUNTER_X.sink;
  k.rbox('chrome', C.steel, [0.96, 0.14, 0.66], 0.03, [x, T + 0.07, 0.68]);
  k.rbox('paint', '#4f5862', [0.78, 0.05, 0.48], 0.04, [x, T + 0.12, 0.7]);
  k.tube(
    'chrome',
    C.chrome,
    [
      [x, T + 0.14, 0.3],
      [x, T + 0.62, 0.3],
      [x, T + 0.72, 0.45],
      [x, T + 0.58, 0.66],
    ],
    0.035,
  );
  for (const side of [-1, 1])
    k.cyl('gloss', side < 0 ? '#3a8fe0' : C.cherry, 0.04, 0.045, 0.06, [
      x + side * 0.17,
      T + 0.17,
      0.3,
    ]);
  // Clean plates drying and a soap bottle.
  for (let i = 0; i < 4; i++)
    k.cyl(
      'ceramic',
      '#f8f3e8',
      0.14,
      0.14,
      0.02,
      [x + 0.62, T + 0.2 + i * 0.002, 0.42 + i * 0.07],
      { rot: [Math.PI / 2 - 0.25, 0, 0] },
    );
  k.rbox('chrome', C.chrome, [0.06, 0.3, 0.36], 0.01, [
    x + 0.62,
    T + 0.12,
    0.5,
  ]);
  k.cyl('gloss', '#7fd6c2', 0.035, 0.04, 0.16, [x - 0.4, T + 0.22, 0.92]);
}

function coffeeUrn(k: Kit) {
  const x = COUNTER_X.coffee;
  k.cyl('chrome', C.chrome, 0.19, 0.22, 0.06, [x, T + 0.03, 0.62]);
  k.cyl('chrome', C.chrome, 0.17, 0.18, 0.6, [x, T + 0.36, 0.62]);
  k.dome('chrome', C.chrome, 0.17, [x, T + 0.66, 0.62]);
  k.sphere('gloss', '#2b2b33', 0.035, [x, T + 0.84, 0.62]);
  k.cyl('glass', '#e8f4f8', 0.02, 0.02, 0.32, [x + 0.16, T + 0.38, 0.62]);
  k.cyl('paint', '#4a2a18', 0.012, 0.012, 0.22, [x + 0.16, T + 0.34, 0.62]);
  k.cyl('gloss', '#2b2b33', 0.025, 0.025, 0.12, [x, T + 0.16, 0.83], {
    axis: 'z',
  });
  k.sphere('glow', '#ff3b3b', 0.02, [x - 0.1, T + 0.2, 0.79]);
  for (let i = 0; i < 3; i++)
    k.cyl('ceramic', '#fffaf0', 0.05, 0.04, 0.07, [
      x + 0.05 * (i - 1),
      T + 0.035 + i * 0.065,
      1.0,
    ]);
}

export function buildCounter(mats: Materials, o: CounterOptions): Counter {
  const group = new THREE.Group();
  const owned: { dispose: () => void }[] = [];
  const keep: Keep = (x) => (owned.push(x), x);
  const k = new Kit();
  const machines = new Map<StationId, MachineRig>();
  const anchors = new Map<StationId, StationAnchor>();
  for (const id of o.stations) {
    if (id === 'grill') {
      machines.set(id, grill(k, mats, group, keep, o.grillLanes));
      anchors.set(id, {
        cookY: T + 0.195,
        cookZ: 0.68,
        readyY: T + 0.02,
        readyZ: READY_Z,
      });
    } else if (id === 'fryer') {
      machines.set(id, fryer(k, mats, group, keep));
      anchors.set(id, {
        cookY: T + 0.62,
        downY: T + 0.33,
        cookZ: 0.62,
        readyY: T + 0.02,
        readyZ: READY_Z,
      });
    } else if (id === 'shake') {
      machines.set(id, shakeMachine(k, mats, group, keep));
      anchors.set(id, {
        cookY: T + 0.11,
        cookZ: 0.78,
        readyY: T + 0.02,
        readyZ: READY_Z,
      });
    } else {
      machines.set(id, pieCase(k, mats, group, keep));
      anchors.set(id, {
        cookY: T + 0.31,
        cookZ: 0.7,
        readyY: T + 0.02,
        readyZ: READY_Z,
      });
    }
  }
  sink(k);
  if (o.coffee) coffeeUrn(k);
  const passSpots: THREE.Vector3[] = [];
  if (o.pass) {
    const x = COUNTER_X.pass;
    k.rbox('chrome', C.chrome, [1.0, 0.04, 0.52], 0.015, [x, T + 0.2, 0.9]);
    for (const side of [-1, 1]) {
      k.cyl('chrome', C.chrome, 0.02, 0.02, 0.2, [
        x + side * 0.46,
        T + 0.1,
        0.9,
      ]);
      k.cyl('chrome', C.chrome, 0.018, 0.018, 0.95, [
        x + side * 0.5,
        T + 0.47,
        0.66,
      ]);
    }
    k.rbox('chrome', C.steel, [1.08, 0.07, 0.36], 0.02, [x, T + 0.96, 0.84]);
    for (let i = 0; i < 3; i++) {
      const lx = x - 0.32 + i * 0.32;
      k.cyl('glow', '#ffb36b', 0.075, 0.095, 0.05, [lx, T + 0.9, 0.86]);
      passSpots.push(new THREE.Vector3(lx, T + 0.22, 0.92));
    }
  }
  // A cherry waste bin on the counter's end, with a lid that flips.
  const bx = COUNTER_X.bin;
  k.cyl('gloss', C.cherry, 0.24, 0.21, 0.5, [bx, T + 0.25, 0.72]);
  k.cyl('chrome', C.chrome, 0.245, 0.245, 0.04, [bx, T + 0.02, 0.72]);
  k.torus('chrome', C.chrome, 0.24, 0.012, [bx, T + 0.5, 0.72]);
  group.add(meshes(k.build(), mats));

  const waterKit = new Kit();
  waterKit.cyl(
    'glass',
    '#d6fbff',
    0.014,
    0.025,
    0.44,
    [COUNTER_X.sink, T + 0.36, 0.66],
    { seg: 14 },
  );
  for (let i = 0; i < 3; i++)
    waterKit.torus('glass', '#dcffff', 0.07 + i * 0.055, 0.008, [
      COUNTER_X.sink,
      T + 0.13,
      0.7,
    ]);
  const water = meshes(waterKit.build(), mats, { cast: false, receive: false });
  water.visible = false;
  group.add(water);
  const lk = new Kit();
  lk.dome('chrome', C.chrome, 0.25, [0, 0, 0.25], Math.PI / 2, {
    scale: [1, 0.35, 1],
  });
  const binLid = new THREE.Group();
  binLid.add(meshes(lk.build(), mats));
  binLid.position.set(bx, T + 0.51, 0.47);
  group.add(binLid);
  return {
    group,
    machines,
    anchors,
    binLid,
    water,
    passSpots,
    dispose() {
      group.traverse((n) => {
        if (n instanceof THREE.Mesh) n.geometry.dispose();
      });
      for (const d of owned) d.dispose();
    },
  };
}
