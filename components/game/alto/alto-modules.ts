import * as THREE from 'three';
import {
  Bins,
  TAU,
  cyl,
  dome,
  kitMats,
  rbox,
  rod,
  sphere,
  v3,
  vmat,
  type Upgrade,
} from './alto-kit';
import { m4 } from './alto-3d';

/** Small pieces of space hardware. Every module starts at its mounting flange,
 * uses the same scale, and bolts to the base; no terrain or domestic buildings. */
const WHITE = '#eee9dd';
const DARK = '#343e54';
const METAL = '#aab7cb';
const GOLD = '#efb958';
const BLUE = '#73caff';

function moduleKit(id: string, accent = GOLD) {
  const group = new THREE.Group();
  group.name = `base-module:${id}`;
  const mats = {
    ...kitMats(),
    light: vmat({ emissive: accent, emissiveIntensity: 0.6, roughness: 0.35 }),
    glass: new THREE.MeshPhysicalMaterial({
      color: '#a5e2f3',
      roughness: 0.14,
      transparent: true,
      opacity: 0.42,
      metalness: 0.08,
      depthWrite: false,
    }),
  };
  const b = new Bins(mats);
  b.add('metal', cyl(0.31, 0.34, 0.06, 24), DARK, m4(0, 0.03, 0));
  b.add('paint', cyl(0.29, 0.3, 0.025, 24), accent, m4(0, 0.071, 0));
  for (let k = 0; k < 4; k++) {
    const a = (k * TAU) / 4 + Math.PI / 4;
    b.add(
      'metal',
      cyl(0.014, 0.014, 0.014, 8),
      METAL,
      m4(Math.sin(a) * 0.27, 0.09, Math.cos(a) * 0.27),
    );
  }
  const finish = (update: Upgrade['update'] = () => {}) => {
    b.into(group);
    return { group, update };
  };
  return { group, b, mats, finish };
}

function capsule(b: Bins, w = 0.46, h = 0.36, d = 0.38, accent = GOLD) {
  b.add('paint', rbox(w, h, d, 0.065, 3), WHITE, m4(0, 0.09 + h / 2, 0));
  b.add(
    'paint',
    rbox(w + 0.012, 0.035, d + 0.012, 0.017, 2),
    accent,
    m4(0, 0.16, 0),
  );
  for (const s of [-1, 1]) {
    b.add(
      'metal',
      rbox(0.018, h * 0.64, 0.02, 0.004, 1),
      METAL,
      m4(s * w * 0.38, 0.09 + h / 2, d / 2 + 0.006),
    );
  }
}

function windows(b: Bins, r: number, y: number, count = 6) {
  for (let k = 0; k < count; k++) {
    const a = (k * TAU) / count;
    b.add(
      'light',
      sphere(0.036, 12, 8),
      BLUE,
      m4(Math.sin(a) * r, y, Math.cos(a) * r, 0, a, 0, [1, 0.72, 0.32]),
    );
  }
}

function sensor(id: string, dish: boolean): Upgrade {
  const { group, b, mats, finish } = moduleKit(id, BLUE);
  b.add('paint', cyl(0.13, 0.18, 0.21, 24), WHITE, m4(0, 0.19, 0));
  b.add('metal', cyl(0.07, 0.09, 0.15, 16), DARK, m4(0, 0.36, 0));
  const head = new THREE.Group();
  head.position.y = 0.43;
  head.rotation.x = -0.65;
  const parts = new Bins(mats);
  if (dish) {
    // An open parabolic reflector, with its feed supported by three ribs.
    const reflector = new THREE.BufferGeometry();
    const points: number[] = [];
    const normals: number[] = [];
    const index: number[] = [];
    const rows = 12,
      cols = 40;
    for (let i = 0; i <= rows; i++)
      for (let j = 0; j <= cols; j++) {
        const r = (i / rows) * 0.27,
          a = (j / cols) * TAU;
        points.push(Math.sin(a) * r, Math.cos(a) * r, r * r * 2.4);
        const n = v3(
          -Math.sin(a) * r * 4.8,
          -Math.cos(a) * r * 4.8,
          1,
        ).normalize();
        normals.push(n.x, n.y, n.z);
        if (i < rows && j < cols) {
          const p = i * (cols + 1) + j;
          index.push(p, p + cols + 1, p + 1, p + 1, p + cols + 1, p + cols + 2);
        }
      }
    reflector.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(points, 3),
    );
    reflector.setAttribute(
      'normal',
      new THREE.Float32BufferAttribute(normals, 3),
    );
    reflector.setIndex(index);
    const material = new THREE.MeshStandardMaterial({
      color: WHITE,
      metalness: 0.5,
      roughness: 0.3,
      side: THREE.DoubleSide,
    });
    head.add(new THREE.Mesh(reflector, material));
    parts.add('metal', new THREE.TorusGeometry(0.27, 0.012, 6, 40), METAL);
    for (let k = 0; k < 3; k++) {
      const a = (k * TAU) / 3;
      parts.add(
        'metal',
        rod(
          0.008,
          v3(Math.sin(a) * 0.26, Math.cos(a) * 0.26, 0.16),
          v3(0, 0, 0.29),
          8,
        ),
        DARK,
      );
    }
    parts.add('light', sphere(0.03, 12, 8), BLUE, m4(0, 0, 0.29));
  } else {
    parts.add('paint', cyl(0.11, 0.13, 0.4, 24).rotateX(Math.PI / 2), WHITE);
    parts.add(
      'metal',
      cyl(0.125, 0.125, 0.035, 24).rotateX(Math.PI / 2),
      DARK,
      m4(0, 0, 0.19),
    );
    parts.add(
      'light',
      cyl(0.085, 0.085, 0.01, 24).rotateX(Math.PI / 2),
      BLUE,
      m4(0, 0, 0.212),
    );
    parts.add(
      'paint',
      cyl(0.112, 0.112, 0.045, 24).rotateX(Math.PI / 2),
      GOLD,
      m4(0, 0, -0.11),
    );
  }
  parts.into(head);
  group.add(head);
  return finish((t) => {
    head.rotation.y = Math.sin(t * 0.4) * 0.22;
  });
}

function signal(id: string, tall: boolean): Upgrade {
  const { group, b, mats, finish } = moduleKit(id);
  const height = tall ? 0.61 : 0.31;
  b.add(
    'paint',
    cyl(0.095, 0.17, height, 24),
    WHITE,
    m4(0, 0.09 + height / 2, 0),
  );
  for (let k = 0; k < (tall ? 3 : 2); k++) {
    b.add(
      'metal',
      cyl(0.16 - k * 0.018, 0.16 - k * 0.018, 0.025, 24),
      DARK,
      m4(0, 0.14 + (k * height) / 3, 0),
    );
  }
  const lamp = new THREE.Mesh(sphere(0.13, 20, 12), mats.light);
  lamp.position.y = height + 0.15;
  group.add(lamp);
  b.add('paint', dome(0.145, 24, 8), WHITE, m4(0, height + 0.23, 0));
  return finish((t) => {
    mats.light.emissiveIntensity = 0.55 + Math.sin(t * 2) * 0.2;
  });
}

function habitat(id: string, garden: boolean): Upgrade {
  const { group, b, mats, finish } = moduleKit(id, garden ? '#90bd79' : GOLD);
  b.add('paint', cyl(0.26, 0.27, 0.16, 28), WHITE, m4(0, 0.17, 0));
  windows(b, 0.265, 0.18);
  if (garden) {
    const glass = new THREE.Mesh(dome(0.26, 28, 12), mats.glass);
    glass.position.y = 0.25;
    group.add(glass);
    for (let k = -1; k <= 1; k++) {
      b.add(
        'paint',
        rbox(0.07, 0.035, 0.28, 0.012, 1),
        DARK,
        m4(k * 0.1, 0.27, 0),
      );
      for (let j = -1; j <= 1; j++) {
        b.add(
          'paint',
          sphere(0.042, 10, 6),
          '#70a858',
          m4(
            k * 0.1,
            0.32 + (j + 1) * 0.009,
            j * 0.09,
            0,
            0,
            0,
            [0.7, 1.3, 0.7],
          ),
        );
      }
    }
  } else b.add('paint', dome(0.27, 28, 12), WHITE, m4(0, 0.25, 0));
  return finish();
}

function workstation(id: string, machine: boolean): Upgrade {
  const { b, finish } = moduleKit(id, '#f0a040');
  capsule(b, 0.45, 0.34, 0.36, '#f0a040');
  b.add('paint', rbox(0.27, 0.14, 0.022, 0.018, 2), DARK, m4(0, 0.3, 0.19));
  b.add('light', rbox(0.21, 0.08, 0.006, 0.01, 1), BLUE, m4(0, 0.32, 0.207));
  for (const s of [-1, 1]) {
    if (machine) {
      b.add(
        'metal',
        rod(0.026, v3(s * 0.18, 0.42, 0), v3(s * 0.22, 0.58, 0), 12),
        METAL,
      );
      b.add(
        'paint',
        rbox(0.06, 0.08, 0.1, 0.014, 2),
        GOLD,
        m4(s * 0.22, 0.56, 0.05),
      );
    } else
      b.add('paint', cyl(0.045, 0.06, 0.15, 16), DARK, m4(s * 0.15, 0.49, 0));
  }
  return finish();
}

function tank(id: string, safe: boolean): Upgrade {
  const { b, finish } = moduleKit(id, safe ? GOLD : BLUE);
  b.add('paint', cyl(0.215, 0.23, 0.36, 28), WHITE, m4(0, 0.27, 0));
  b.add('paint', dome(0.215, 28, 10), safe ? DARK : BLUE, m4(0, 0.45, 0));
  for (const y of [0.15, 0.4])
    b.add('metal', cyl(0.233, 0.233, 0.028, 28), METAL, m4(0, y, 0));
  b.add(
    'metal',
    cyl(0.092, 0.092, 0.025, 20).rotateX(Math.PI / 2),
    DARK,
    m4(0, 0.29, 0.228),
  );
  b.add(
    safe ? 'metal' : 'light',
    cyl(0.067, 0.067, 0.014, 20).rotateX(Math.PI / 2),
    safe ? GOLD : BLUE,
    m4(0, 0.29, 0.246),
  );
  if (safe)
    for (let k = 0; k < 3; k++) {
      const a = (k * TAU) / 3;
      b.add(
        'metal',
        rod(
          0.012,
          v3(0, 0.29, 0.26),
          v3(Math.sin(a) * 0.055, 0.29 + Math.cos(a) * 0.055, 0.26),
          8,
        ),
        DARK,
      );
    }
  return finish();
}

function domeSensor(): Upgrade {
  const { group, b, mats, finish } = moduleKit('observatory', BLUE);
  b.add('paint', cyl(0.25, 0.27, 0.22, 28), WHITE, m4(0, 0.2, 0));
  windows(b, 0.255, 0.2);
  b.add('paint', dome(0.26, 28, 12), WHITE, m4(0, 0.31, 0));
  const arm = new THREE.Group();
  arm.position.y = 0.44;
  const p = new Bins(mats);
  p.add(
    'metal',
    cyl(0.07, 0.09, 0.23, 20).rotateX(Math.PI / 2),
    DARK,
    m4(0, 0, 0.13),
  );
  p.add(
    'light',
    cyl(0.06, 0.06, 0.015, 20).rotateX(Math.PI / 2),
    BLUE,
    m4(0, 0, 0.255),
  );
  p.into(arm);
  group.add(arm);
  return finish((t) => {
    arm.rotation.y = Math.sin(t * 0.3) * 0.32;
  });
}

function cargoHub(): Upgrade {
  const { b, finish } = moduleKit('bazaar');
  for (let k = 0; k < 4; k++) {
    const x = k % 2 ? 0.115 : -0.115,
      z = k > 1 ? 0.115 : -0.115;
    const colour = ['#96bf76', '#e99959', '#7ccbed', '#b894ed'][k];
    b.add('paint', cyl(0.086, 0.095, 0.31, 20), colour, m4(x, 0.25, z));
    for (const y of [0.13, 0.36])
      b.add('metal', cyl(0.098, 0.098, 0.025, 20), DARK, m4(x, y, z));
    b.add('metal', dome(0.087, 20, 6), METAL, m4(x, 0.405, z));
  }
  return finish();
}

function archive(): Upgrade {
  const { group, b, mats, finish } = moduleKit('skytower', '#b894ed');
  capsule(b, 0.48, 0.25, 0.35, '#b894ed');
  const glass = new THREE.Mesh(rbox(0.37, 0.2, 0.24, 0.04, 2), mats.glass);
  glass.position.y = 0.43;
  group.add(glass);
  for (let k = -1; k <= 1; k++) {
    b.add(
      'light',
      new THREE.OctahedronGeometry(0.052, 0),
      '#b894ed',
      m4(k * 0.11, 0.43, 0),
    );
  }
  b.add('paint', rbox(0.42, 0.035, 0.29, 0.015, 2), WHITE, m4(0, 0.55, 0));
  return finish();
}

function hangar(): Upgrade {
  const { b, finish } = moduleKit('archive');
  capsule(b, 0.5, 0.38, 0.4);
  b.add('paint', rbox(0.35, 0.28, 0.016, 0.035, 3), DARK, m4(0, 0.25, 0.21));
  for (let k = 0; k < 4; k++)
    b.add(
      'metal',
      rbox(0.31, 0.008, 0.008, 0.002, 1),
      METAL,
      m4(0, 0.15 + k * 0.052, 0.224),
    );
  b.add('light', rbox(0.24, 0.018, 0.012, 0.004, 1), GOLD, m4(0, 0.41, 0.216));
  return finish();
}

function refinery(): Upgrade {
  const { b, finish } = moduleKit('guildhall', '#f0a040');
  capsule(b, 0.49, 0.24, 0.38, '#f0a040');
  for (let k = -1; k <= 1; k++) {
    b.add(
      'metal',
      cyl(0.065, 0.08, 0.23 + (k === 0 ? 0.1 : 0), 20),
      METAL,
      m4(k * 0.13, 0.42, -0.06),
    );
    b.add(
      'paint',
      cyl(0.084, 0.084, 0.025, 20),
      DARK,
      m4(k * 0.13, 0.49, -0.06),
    );
  }
  b.add('light', rbox(0.28, 0.04, 0.012, 0.008, 2), GOLD, m4(0, 0.23, 0.199));
  return finish();
}

function memorial(): Upgrade {
  const { b, finish } = moduleKit('bridge');
  b.add('metal', cyl(0.15, 0.2, 0.13, 24), DARK, m4(0, 0.15, 0));
  b.add('paint', cyl(0.07, 0.11, 0.33, 24), GOLD, m4(0, 0.38, 0));
  b.add(
    'paint',
    new THREE.ConeGeometry(0.07, 0.14, 24),
    WHITE,
    m4(0, 0.615, 0),
  );
  for (const s of [-1, 1])
    b.add(
      'paint',
      rbox(0.035, 0.18, 0.14, 0.014, 2),
      WHITE,
      m4(s * 0.094, 0.29, 0, 0, 0, s * -0.3),
    );
  return finish();
}

export const baseModuleMakers: Record<string, () => Upgrade> = {
  shrine: () => sensor('shrine', false),
  beacon: () => signal('beacon', false),
  post: () => workstation('post', true),
  belltower: () => sensor('belltower', true),
  gardens: () => habitat('gardens', true),
  bridge: memorial,
  market: () => workstation('market', false),
  lighthouse: () => signal('lighthouse', true),
  palace: () => habitat('palace', false),
  guildhall: refinery,
  observatory: domeSensor,
  archive: hangar,
  fountain: () => tank('fountain', false),
  treasury: () => tank('treasury', true),
  skytower: archive,
  bazaar: cargoHub,
};
