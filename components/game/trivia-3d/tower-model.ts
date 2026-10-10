import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * A sandstone observatory miniature, authored at its final detail level.
 * The measured arcade, cornice, roof ribs and folded cloth are geometry.
 * A tier is an independently movable local 0..floorHeight group; the crown
 * can lift without deforming the masonry. The owning scene controls its RAF.
 * See docs/concepts/2026-10-04-trivia-3d/tower-brief.md for the source brief.
 */
export type TriviaTower = {
  root: THREE.Group;
  /** Initially hidden, already placed at baseHeight + index * floorHeight. */
  floors: THREE.Group[];
  /** Initially placed at baseHeight; move it above the visible tier count. */
  crown: THREE.Group;
  /** Cloth only, with a pivot on its fixed edge. */
  flag: THREE.Mesh;
  floorHeight: number;
  baseHeight: number;
  /** Restore the authored quiet folds by passing reducedMotion=true. */
  wave: (timeSeconds: number, reducedMotion?: boolean) => void;
  /** Disposes each shared resource once; safe to call more than once. */
  dispose: () => void;
};

export type SettledTowerFloors = {
  /** Owned by tower.root; uses the exact original geometries and materials. */
  root: THREE.Group;
  /**
   * Snapshot the first settledFloorCount visible floor groups. Only their
   * source mesh children become hidden; group transforms and visibility stay
   * under the scene's control. Call after landing, rather than in the RAF.
   */
  sync: (settledFloorCount: number) => void;
  /** Show source meshes again before resuming construction/drop animation. */
  release: () => void;
  /** Release instances and their matrix buffers, without disposing the source. */
  dispose: () => void;
};

type V3 = [number, number, number];
type Surface = 'stone' | 'enamel' | 'metal' | 'wood';
type Materials = Record<Surface, THREE.MeshStandardMaterial>;
type GeometrySet = Partial<Record<Surface, THREE.BufferGeometry>>;

const FLOOR_HEIGHT = 0.38;
const BASE_HEIGHT = 0.35;
const SIDES = 8;
const TAU = Math.PI * 2;
const C = {
  stone: '#dec597',
  cutStone: '#f0ddba',
  stoneShade: '#bba071',
  recess: '#453829',
  brass: '#dcaf65',
  brassShade: '#987044',
  copper: '#bc7651',
  patina: '#356d68',
  patinaShade: '#244e4b',
  lacquer: '#633f2b',
  lacquerLight: '#855738',
  clothMark: '#faeccc',
} as const;

/** Independent material finishes; color variation is authored vertex data. */
function materials(): Materials {
  return {
    stone: new THREE.MeshStandardMaterial({
      color: 'white',
      vertexColors: true,
      roughness: 0.8,
      metalness: 0.02,
    }),
    enamel: new THREE.MeshStandardMaterial({
      color: 'white',
      vertexColors: true,
      roughness: 0.39,
      metalness: 0.12,
    }),
    metal: new THREE.MeshStandardMaterial({
      color: 'white',
      vertexColors: true,
      roughness: 0.32,
      metalness: 0.78,
    }),
    wood: new THREE.MeshStandardMaterial({
      color: 'white',
      vertexColors: true,
      roughness: 0.47,
      metalness: 0,
    }),
  };
}

/**
 * Author in distinct surfaces, then join only pieces that share a finish.
 * Construction remains editable in the named modeling functions below.
 */
class Masonry {
  private readonly parts: Partial<Record<Surface, THREE.BufferGeometry[]>> = {};

  add(
    surface: Surface,
    color: THREE.ColorRepresentation,
    source: THREE.BufferGeometry,
    at: V3 = [0, 0, 0],
    rotation: V3 = [0, 0, 0],
  ) {
    const g = source.index ? source.toNonIndexed() : source;
    if (g !== source) source.dispose();
    for (const name of Object.keys(g.attributes))
      if (name !== 'position' && name !== 'normal' && name !== 'uv')
        g.deleteAttribute(name);
    if (!g.getAttribute('uv'))
      g.setAttribute(
        'uv',
        new THREE.BufferAttribute(
          new Float32Array(g.getAttribute('position').count * 2),
          2,
        ),
      );
    g.rotateX(rotation[0]);
    g.rotateY(rotation[1]);
    g.rotateZ(rotation[2]);
    g.translate(...at);
    const rgb = new THREE.Color(color);
    const count = g.getAttribute('position').count;
    const colors = new Float32Array(count * 3);
    for (let n = 0; n < count; n++) {
      colors[n * 3] = rgb.r;
      colors[n * 3 + 1] = rgb.g;
      colors[n * 3 + 2] = rgb.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    (this.parts[surface] ??= []).push(g);
  }

  box(surface: Surface, color: string, size: V3, at: V3, radius = 0.006) {
    // Extruded rounded footprints spend detail on the visible edge instead
    // of subdividing hidden faces as a rounded-box lattice would do.
    const s = roundedRectangle(size[0], size[2], radius);
    const g = new THREE.ExtrudeGeometry(s, {
      depth: Math.max(0.001, size[1] - radius * 2),
      bevelEnabled: radius > 0,
      bevelThickness: radius,
      bevelSize: radius,
      bevelSegments: 2,
      steps: 1,
      curveSegments: 4,
    });
    g.rotateX(-Math.PI / 2);
    this.add(surface, color, g, [at[0], at[1] - size[1] / 2 + radius, at[2]]);
  }

  lathe(
    surface: Surface,
    color: THREE.ColorRepresentation,
    profile: [number, number][],
    at: V3 = [0, 0, 0],
    segments = 40,
  ) {
    this.add(
      surface,
      color,
      new THREE.LatheGeometry(
        profile.map(([r, y]) => new THREE.Vector2(r, y)),
        segments,
      ),
      at,
    );
  }

  /** Profile follows a softly rounded octagon, preserving the broad flats. */
  octagon(
    surface: Surface,
    color: THREE.ColorRepresentation,
    profile: [number, number][],
  ) {
    this.add(surface, color, roundedOctagonalProfile(profile));
  }

  finish(): GeometrySet {
    const result: GeometrySet = {};
    for (const [surface, pieces] of Object.entries(this.parts) as [
      Surface,
      THREE.BufferGeometry[],
    ][]) {
      const g = mergeGeometries(pieces, false);
      pieces.forEach((piece) => piece.dispose());
      if (g) result[surface] = g;
    }
    return result;
  }
}

function roundedRectangle(
  width: number,
  height: number,
  radius: number,
  centerY = 0,
) {
  const x = -width / 2;
  const y = -height / 2 + centerY;
  const r = Math.min(radius, width * 0.24, height * 0.24);
  const s = new THREE.Shape();
  s.moveTo(x + r, y);
  s.lineTo(x + width - r, y);
  s.quadraticCurveTo(x + width, y, x + width, y + r);
  s.lineTo(x + width, y + height - r);
  s.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  s.lineTo(x + r, y + height);
  s.quadraticCurveTo(x, y + height, x, y + height - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  s.closePath();
  return s;
}

/** Horizontal rounded octagon of unit radius, with real flat faces. */
function octagonalOutline() {
  const corners = Array.from({ length: SIDES }, (_, n) => {
    const a = Math.PI / 8 + (n * TAU) / SIDES;
    return new THREE.Vector2(Math.sin(a), Math.cos(a));
  });
  const shape = new THREE.Shape();
  for (let n = 0; n < SIDES; n++) {
    const corner = corners[n];
    const previous = corners[(n + SIDES - 1) % SIDES];
    const next = corners[(n + 1) % SIDES];
    const enter = corner.clone().lerp(previous, 0.075);
    const leave = corner.clone().lerp(next, 0.075);
    if (n === 0) shape.moveTo(enter.x, enter.y);
    else shape.lineTo(enter.x, enter.y);
    shape.quadraticCurveTo(corner.x, corner.y, leave.x, leave.y);
  }
  shape.closePath();
  const points = shape.getPoints(4);
  // Close once through the index buffer, not a duplicate seam vertex.
  if (points[0].distanceToSquared(points.at(-1)!) < 0.000001) points.pop();
  return points;
}

/** Sweeps the authored molding profile instead of stacking cylinder discs. */
function roundedOctagonalProfile(profile: [number, number][]) {
  const outline = octagonalOutline();
  const around = outline.length;
  const positions: number[] = [];
  const uv: number[] = [];
  const indices: number[] = [];
  profile.forEach(([radius, y], row) => {
    outline.forEach((p, n) => {
      positions.push(p.x * radius, y, p.y * radius);
      uv.push(n / around, row / (profile.length - 1));
    });
  });
  for (let row = 0; row < profile.length - 1; row++) {
    for (let n = 0; n < around; n++) {
      const next = (n + 1) % around;
      const a = row * around + n;
      const b = row * around + next;
      const c = (row + 1) * around + n;
      const d = (row + 1) * around + next;
      indices.push(a, b, c, b, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

/** Closed arch, centered on x; h includes its semicircular head. */
function traceArch(
  path: THREE.Path,
  width: number,
  height: number,
  bottom = 0,
) {
  const r = width / 2;
  const spring = bottom + height - r;
  path.moveTo(-r, bottom);
  path.lineTo(r, bottom);
  path.lineTo(r, spring);
  path.absarc(0, spring, r, 0, Math.PI, false);
  path.lineTo(-r, bottom);
  path.closePath();
}

function arch(width: number, height: number) {
  const shape = new THREE.Shape();
  traceArch(shape, width, height);
  return shape;
}

/** The wall panel has an actual opening; the dark niche sits behind it. */
function arcadePanel() {
  const panel = roundedRectangle(0.341, 0.284, 0.004, 0.142);
  const hole = new THREE.Path();
  traceArch(hole, 0.127, 0.203, 0.02);
  panel.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(panel, {
    depth: 0.066,
    bevelEnabled: true,
    bevelThickness: 0.003,
    bevelSize: 0.003,
    bevelSegments: 2,
    curveSegments: 12,
    steps: 1,
  });
  g.translate(0, 0, -0.066);
  return g;
}

function archivolt() {
  const outer = arch(0.178, 0.23);
  const hole = new THREE.Path();
  traceArch(hole, 0.128, 0.204, 0.003);
  outer.holes.push(hole);
  return new THREE.ExtrudeGeometry(outer, {
    depth: 0.015,
    bevelEnabled: true,
    bevelThickness: 0.002,
    bevelSize: 0.002,
    bevelSegments: 2,
    curveSegments: 14,
    steps: 1,
  });
}

function onFace(
  masonry: Masonry,
  surface: Surface,
  color: THREE.ColorRepresentation,
  geometry: THREE.BufferGeometry,
  face: number,
  at: V3,
) {
  const angle = (face * TAU) / SIDES;
  const x = at[0] * Math.cos(angle) + at[2] * Math.sin(angle);
  const z = -at[0] * Math.sin(angle) + at[2] * Math.cos(angle);
  masonry.add(surface, color, geometry, [x, at[1], z], [0, angle, 0]);
}

/** Voussoirs are wedge-shaped arch stones, not round dots over a window. */
function archStone(index: number) {
  const a = (index * Math.PI) / 7 + 0.028;
  const b = ((index + 1) * Math.PI) / 7 - 0.028;
  const r0 = 0.067;
  const r1 = index === 3 ? 0.097 : 0.09;
  const spring = 0.141;
  const s = new THREE.Shape();
  s.moveTo(Math.cos(a) * r0, spring + Math.sin(a) * r0);
  s.lineTo(Math.cos(a) * r1, spring + Math.sin(a) * r1);
  s.absarc(0, spring, r1, a, b, false);
  s.lineTo(Math.cos(b) * r0, spring + Math.sin(b) * r0);
  s.absarc(0, spring, r0, b, a, true);
  s.closePath();
  return new THREE.ExtrudeGeometry(s, {
    depth: index === 3 ? 0.018 : 0.012,
    bevelEnabled: true,
    bevelThickness: 0.0015,
    bevelSize: 0.0015,
    bevelSegments: 1,
    curveSegments: 5,
    steps: 1,
  });
}

/** A restrained turned column has an entasis, foot and distinct capital. */
function columnGeometry() {
  return new THREE.LatheGeometry(
    [
      [0, 0],
      [0.023, 0],
      [0.023, 0.012],
      [0.019, 0.019],
      [0.015, 0.025],
      [0.014, 0.065],
      [0.0154, 0.092],
      [0.014, 0.139],
      [0.015, 0.16],
      [0.021, 0.166],
      [0.023, 0.176],
      [0.022, 0.187],
      [0, 0.187],
    ].map(([r, y]) => new THREE.Vector2(r, y)),
    16,
  );
}

function buildFloor(seatColor: THREE.Color, milestone: boolean) {
  const k = new Masonry();
  const tint = seatColor.clone().lerp(new THREE.Color(C.cutStone), 0.09);
  k.octagon('stone', C.stoneShade, [
    [0, 0],
    [0.395, 0],
    [0.418, 0.008],
    [0.431, 0.024],
    [0.416, 0.043],
    [0.394, 0.055],
    [0, 0.055],
  ]);
  // The interior is visibly deeper than the window reveal.
  k.lathe(
    'stone',
    C.recess,
    [
      [0, 0.045],
      [0.343, 0.045],
      [0.343, 0.304],
      [0, 0.304],
    ],
    [0, 0, 0],
    48,
  );

  const panel = arcadePanel();
  const frame = archivolt();
  const niche = new THREE.ShapeGeometry(arch(0.129, 0.205), 16);
  const column = columnGeometry();
  const shutters = new THREE.ShapeGeometry(arch(0.088, 0.149), 12);
  for (let face = 0; face < SIDES; face++) {
    const stone = face % 2 ? C.stone : C.cutStone;
    onFace(k, 'stone', stone, panel.clone(), face, [0, 0.048, 0.414]);
    onFace(k, 'stone', C.recess, niche.clone(), face, [0, 0.068, 0.35]);
    onFace(k, 'stone', C.cutStone, frame.clone(), face, [0, 0.065, 0.416]);
    // An enamel shutter lives deep inside each arched opening, leaving a
    // warm dark reveal around it; its brass centre mullion is structural.
    onFace(k, 'enamel', tint, shutters.clone(), face, [0, 0.077, 0.354]);
    onFace(
      k,
      'metal',
      C.brassShade,
      new THREE.BoxGeometry(0.006, 0.128, 0.006),
      face,
      [0, 0.139, 0.36],
    );
    for (const x of [-0.106, 0.106])
      onFace(k, 'stone', C.cutStone, column.clone(), face, [x, 0.066, 0.421]);
    for (let n = 0; n < 7; n++)
      onFace(
        k,
        'stone',
        n === 3 ? C.cutStone : n % 2 ? C.stone : C.stoneShade,
        archStone(n),
        face,
        [0, 0.068, 0.433],
      );
    onFace(
      k,
      'stone',
      C.stoneShade,
      new THREE.BoxGeometry(0.168, 0.019, 0.047),
      face,
      [0, 0.068, 0.422],
    );
    onFace(
      k,
      'metal',
      C.brass,
      new THREE.BoxGeometry(0.169, 0.004, 0.014),
      face,
      [0, 0.079, 0.445],
    );
    // Raised corner ribs bridge the arcade panels, providing a continuous
    // vertical structure and visible depth from every camera direction.
    const a = (face * TAU) / SIDES + Math.PI / 8;
    const rib = new THREE.LatheGeometry(
      [
        [0, 0],
        [0.026, 0],
        [0.026, 0.02],
        [0.018, 0.031],
        [0.018, 0.229],
        [0.027, 0.24],
        [0.027, 0.256],
        [0, 0.256],
      ].map(([r, y]) => new THREE.Vector2(r, y)),
      12,
    );
    k.add('stone', C.stoneShade, rib, [
      Math.sin(a) * 0.444,
      0.051,
      Math.cos(a) * 0.444,
    ]);
  }
  [panel, frame, niche, column, shutters].forEach((g) => g.dispose());

  k.octagon('stone', C.cutStone, [
    [0.393, 0.287],
    [0.397, 0.296],
    [0.414, 0.306],
    [0.447, 0.319],
    [0.466, 0.332],
    [0.47, 0.346],
    [0.461, 0.356],
    [0.432, 0.369],
    [0.432, FLOOR_HEIGHT],
    [0, FLOOR_HEIGHT],
  ]);
  k.octagon(
    'enamel',
    milestone ? tint : new THREE.Color(C.patinaShade).lerp(tint, 0.22),
    [
      [0.443, 0.316],
      [0.453, 0.321],
      [0.457, milestone ? 0.339 : 0.329],
      [0.453, milestone ? 0.343 : 0.333],
    ],
  );
  k.octagon('metal', C.brass, [
    [0.468, 0.344],
    [0.472, 0.346],
    [0.472, 0.35],
    [0.466, 0.353],
  ]);
  return k.finish();
}

function buildBase(seatColor: THREE.Color) {
  const k = new Masonry();
  // This entire silhouette is a single authored series of beveled profiles.
  k.octagon('wood', C.lacquer, [
    [0, 0],
    [0.544, 0],
    [0.581, 0.012],
    [0.604, 0.028],
    [0.606, 0.072],
    [0.596, 0.09],
    [0.557, 0.113],
    [0, 0.113],
  ]);
  k.octagon('metal', C.brass, [
    [0.598, 0.022],
    [0.611, 0.025],
    [0.611, 0.033],
    [0.602, 0.038],
  ]);
  k.octagon('wood', C.lacquerLight, [
    [0.556, 0.113],
    [0.559, 0.121],
    [0.559, 0.137],
    [0.548, 0.148],
    [0, 0.148],
  ]);
  k.octagon('enamel', seatColor.clone().multiplyScalar(0.6), [
    [0.56, 0.077],
    [0.563, 0.081],
    [0.564, 0.103],
    [0.56, 0.108],
  ]);
  k.octagon('stone', C.stoneShade, [
    [0, 0.144],
    [0.493, 0.144],
    [0.511, 0.154],
    [0.51, 0.201],
    [0.485, 0.219],
    [0.44, 0.239],
    [0.416, 0.262],
    [0.416, 0.331],
    [0.433, 0.342],
    [0.433, BASE_HEIGHT],
    [0, BASE_HEIGHT],
  ]);
  k.octagon('stone', C.cutStone, [
    [0.493, 0.187],
    [0.515, 0.192],
    [0.518, 0.201],
    [0.488, 0.219],
  ]);
  // Broad compass points are carved/inlaid into the ledge, legible close up
  // without applying artificial texture noise to every stone face.
  for (let n = 0; n < SIDES; n++) {
    const angle = (n * TAU) / SIDES;
    const point = new THREE.Shape();
    point.moveTo(-0.016, 0.441);
    point.lineTo(0, n % 2 ? 0.492 : 0.509);
    point.lineTo(0.016, 0.441);
    point.lineTo(0, 0.456);
    point.closePath();
    const g = new THREE.ShapeGeometry(point);
    g.rotateX(-Math.PI / 2);
    g.rotateY(angle);
    k.add('metal', C.brassShade, g, [0, 0.218, 0]);
    // Cut faces on the base are quiet long panels, not random faux scratches.
    onFace(
      k,
      'stone',
      C.stone,
      new THREE.BoxGeometry(0.185, 0.052, 0.009),
      n,
      [0, 0.291, 0.388],
    );
  }
  // The stair is shallow enough to stay inside the base's 1.25-unit footprint.
  k.box('stone', C.stoneShade, [0.324, 0.05, 0.225], [0, 0.172, 0.476], 0.007);
  k.box('stone', C.stone, [0.304, 0.045, 0.15], [0, 0.219, 0.465], 0.006);
  k.box('stone', C.cutStone, [0.284, 0.038, 0.08], [0, 0.26, 0.448], 0.005);
  for (let n = 0; n < 3; n++)
    k.box(
      'metal',
      C.brassShade,
      [0.269 - n * 0.019, 0.003, 0.006],
      [0, 0.198 + n * 0.042, 0.574 - n * 0.036],
      0.001,
    );
  return k.finish();
}

/** Main dome profile, also used by its copper ribs, keeps both in contact. */
const DOME_PROFILE: [number, number][] = [
  [0.473, 0.272],
  [0.477, 0.287],
  [0.446, 0.305],
  [0.395, 0.322],
  [0.376, 0.357],
  [0.36, 0.401],
  [0.325, 0.449],
  [0.277, 0.488],
  [0.216, 0.523],
  [0.153, 0.554],
  [0.107, 0.582],
  [0.079, 0.606],
  [0.067, 0.625],
  [0.066, 0.636],
  [0, 0.642],
];

function buildCrown(seatColor: THREE.Color) {
  const k = new Masonry();
  k.octagon('stone', C.cutStone, [
    [0, 0],
    [0.416, 0],
    [0.436, 0.012],
    [0.458, 0.025],
    [0.458, 0.047],
    [0.421, 0.065],
    [0.392, 0.075],
    [0, 0.075],
  ]);
  k.octagon('metal', C.brass, [
    [0.456, 0.04],
    [0.462, 0.044],
    [0.46, 0.051],
    [0.446, 0.055],
  ]);
  // Eight small lantern arches leave a pale rim and visible dark reveal.
  const frame = archivolt();
  const opening = new THREE.ShapeGeometry(arch(0.128, 0.194), 14);
  const glass = new THREE.ShapeGeometry(arch(0.098, 0.165), 14);
  k.lathe(
    'stone',
    C.recess,
    [
      [0, 0.073],
      [0.252, 0.073],
      [0.252, 0.283],
      [0, 0.283],
    ],
    [0, 0, 0],
    40,
  );
  for (let face = 0; face < SIDES; face++) {
    const frameGeo = frame.clone().scale(0.88, 0.88, 1);
    onFace(k, 'stone', C.cutStone, frameGeo, face, [0, 0.066, 0.311]);
    onFace(
      k,
      'stone',
      C.recess,
      opening.clone().scale(0.88, 0.88, 1),
      face,
      [0, 0.07, 0.287],
    );
    onFace(
      k,
      'enamel',
      new THREE.Color(C.patina).lerp(seatColor, 0.23),
      glass.clone(),
      face,
      [0, 0.076, 0.289],
    );
    onFace(
      k,
      'metal',
      C.brass,
      new THREE.BoxGeometry(0.005, 0.138, 0.006),
      face,
      [0, 0.142, 0.296],
    );
    const angle = Math.PI / 8 + (face * TAU) / SIDES;
    k.lathe(
      'stone',
      C.cutStone,
      [
        [0, 0],
        [0.032, 0],
        [0.026, 0.013],
        [0.018, 0.024],
        [0.018, 0.17],
        [0.029, 0.187],
        [0.03, 0.201],
        [0, 0.201],
      ],
      [Math.sin(angle) * 0.327, 0.075, Math.cos(angle) * 0.327],
      16,
    );
  }
  [frame, opening, glass].forEach((g) => g.dispose());

  // Copper underneath the broad eaves, patinated teal above: silhouette and
  // material transition remain readable even when the tower is quite small.
  k.lathe(
    'metal',
    C.copper,
    [
      [0, 0.259],
      [0.445, 0.259],
      [0.468, 0.267],
      [0.48, 0.279],
      [0.48, 0.288],
      [0.457, 0.296],
      [0, 0.296],
    ],
    [0, 0, 0],
    64,
  );
  k.lathe('enamel', C.patina, DOME_PROFILE, [0, 0, 0], 64);
  for (let n = 0; n < 12; n++) {
    const angle = (n * TAU) / 12;
    const points = DOME_PROFILE.slice(0, -1).map(
      ([radius, y]) =>
        new THREE.Vector3(
          Math.sin(angle) * (radius + 0.003),
          y + 0.003,
          Math.cos(angle) * (radius + 0.003),
        ),
    );
    const path = new THREE.CatmullRomCurve3(points, false, 'centripetal');
    k.add(
      'metal',
      n % 3 ? C.copper : C.brassShade,
      new THREE.TubeGeometry(path, 36, 0.006, 5, false),
    );
  }
  // A few horizontal roof seams follow the curved material, not a second
  // set of stacked geometric bands masking a simple cone.
  for (const [r, y] of [
    [0.358, 0.405],
    [0.217, 0.524],
    [0.081, 0.606],
  ] as [number, number][]) {
    const seam = new THREE.TorusGeometry(r, 0.0025, 4, 64);
    seam.rotateX(Math.PI / 2);
    k.add('metal', C.brassShade, seam, [0, y, 0]);
  }
  k.lathe(
    'metal',
    C.brass,
    [
      [0, 0.632],
      [0.052, 0.632],
      [0.061, 0.644],
      [0.06, 0.655],
      [0.04, 0.67],
      [0.021, 0.701],
      [0.026, 0.724],
      [0.034, 0.738],
      [0.03, 0.758],
      [0.012, 0.78],
      [0, 0.786],
    ],
    [0, 0, 0],
    32,
  );
  // The pennant pole anchors into the centre finial, with two tiny collars.
  k.lathe(
    'metal',
    C.brassShade,
    [
      [0, 0.734],
      [0.009, 0.734],
      [0.009, 1.039],
      [0.007, 1.045],
      [0, 1.045],
    ],
    [0, 0, 0],
    16,
  );
  k.lathe(
    'metal',
    C.brass,
    [
      [0, 1.033],
      [0.014, 1.037],
      [0.017, 1.047],
      [0.012, 1.059],
      [0, 1.064],
    ],
    [0, 0, 0],
    20,
  );
  for (const y of [0.849, 1.006])
    k.lathe(
      'metal',
      C.brass,
      [
        [0.009, y - 0.004],
        [0.013, y - 0.003],
        [0.013, y + 0.003],
        [0.009, y + 0.004],
      ],
      [0, 0, 0],
      16,
    );
  return k.finish();
}

function attachMeshes(
  group: THREE.Group,
  geometries: GeometrySet,
  mats: Materials,
  name: string,
) {
  for (const [surface, geometry] of Object.entries(geometries) as [
    Surface,
    THREE.BufferGeometry,
  ][]) {
    const mesh = new THREE.Mesh(geometry, mats[surface]);
    mesh.name = `${name}-${surface}`;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
}

/** Separate cloth, already folded in its resting pose, never a rigid plane. */
function createPennant(seatColor: THREE.Color) {
  const across = 28;
  const down = 12;
  const width = 0.332;
  const height = 0.165;
  const positions = new Float32Array((across + 1) * (down + 1) * 3);
  const colors = new Float32Array(positions.length);
  const uv = new Float32Array((across + 1) * (down + 1) * 2);
  const restU = new Float32Array((across + 1) * (down + 1));
  const restV = new Float32Array(restU.length);
  const indices: number[] = [];
  const hem = seatColor.clone().multiplyScalar(0.64);
  const mark = new THREE.Color(C.clothMark);
  for (let row = 0; row <= down; row++) {
    const v = row / down;
    const tail = 1 - 0.27 * (1 - Math.abs(v * 2 - 1));
    for (let column = 0; column <= across; column++) {
      const u = column / across;
      const n = row * (across + 1) + column;
      restU[n] = u * tail;
      restV[n] = v;
      uv[n * 2] = u;
      uv[n * 2 + 1] = v;
      const diamond =
        Math.abs((u - 0.41) / 0.18) + Math.abs((v - 0.5) / 0.33) < 1;
      const inset =
        column < 2 || row < 1 || row > down - 1 || column > across - 1;
      const c = inset ? hem : diamond ? mark : seatColor;
      colors[n * 3] = c.r;
      colors[n * 3 + 1] = c.g;
      colors[n * 3 + 2] = c.b;
      if (row < down && column < across) {
        const a = n;
        const b = n + 1;
        const c = n + across + 1;
        const d = c + 1;
        indices.push(a, c, b, b, c, d);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage),
  );
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geometry.setIndex(indices);
  const material = new THREE.MeshStandardMaterial({
    color: 'white',
    vertexColors: true,
    roughness: 0.94,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  const flag = new THREE.Mesh(geometry, material);
  flag.name = 'tower-cloth-pennant';
  flag.position.set(0.011, 1.01, 0);
  flag.castShadow = true;
  flag.receiveShadow = true;
  // The bound covers the complete deformation; waving does not recalculate
  // bounding boxes or permit the animated free edge to disappear by culling.
  geometry.boundingBox = new THREE.Box3(
    new THREE.Vector3(0, -height - 0.038, -0.058),
    new THREE.Vector3(width, 0.01, 0.058),
  );
  geometry.boundingSphere = new THREE.Sphere(
    new THREE.Vector3(width / 2, -height / 2, 0),
    0.235,
  );

  let wasReduced = false;
  function wave(timeSeconds: number, reducedMotion = false) {
    if (reducedMotion && wasReduced) return;
    wasReduced = reducedMotion;
    const time = reducedMotion ? 0 : timeSeconds;
    for (let n = 0; n < restU.length; n++) {
      const u = restU[n];
      const v = restV[n];
      const fold = Math.sin(u * 10.4 - v * 1.2) * 0.0085 * u;
      const breeze = reducedMotion
        ? 0
        : Math.sin(u * 8.5 - time * 2.9 + v * 0.5) * 0.029 * u * u;
      positions[n * 3] = u * width;
      positions[n * 3 + 1] =
        -v * height -
        0.025 * u * u +
        (reducedMotion ? 0 : Math.sin(time * 2.1 - u * 4.1) * 0.0035 * u * u);
      positions[n * 3 + 2] = fold + breeze;
    }
    geometry.getAttribute('position').needsUpdate = true;
    geometry.computeVertexNormals();
  }
  wave(0, true);
  return { flag, wave, geometry, material };
}

/** Rules 3 builds a block per place: up to six a round for twelve rounds. */
export const maxTowerFloors = 72;
export function createTriviaTower(color: string, maxFloors = 20): TriviaTower {
  const count = Math.max(
    0,
    Math.min(
      maxTowerFloors,
      Math.floor(Number.isFinite(maxFloors) ? maxFloors : 20),
    ),
  );
  const seatColor = new THREE.Color(color);
  const mats = materials();
  const baseGeometry = buildBase(seatColor);
  // Full-detail shared masters are never decimated. Ordinary and milestone
  // tiers reuse their exact geometry throughout this one tower instance.
  const commonFloor = buildFloor(seatColor, false);
  const fifthFloor = buildFloor(seatColor, true);
  // Only the enamel belt differs on a fifth tier. Share the unchanged stone
  // and brass masters too, so settled floors need four finish batches rather
  // than six. No topology, vertex data, material or source hook is altered.
  for (const surface of ['stone', 'metal'] as const) {
    fifthFloor[surface]?.dispose();
    fifthFloor[surface] = commonFloor[surface];
  }
  const crownGeometry = buildCrown(seatColor);
  const {
    flag,
    wave,
    geometry: clothGeometry,
    material: clothMaterial,
  } = createPennant(seatColor);
  const root = new THREE.Group();
  root.name = 'trivia-observatory-tower';
  const base = new THREE.Group();
  base.name = 'tower-foot-and-stair';
  attachMeshes(base, baseGeometry, mats, 'foundation');
  root.add(base);
  const floors = Array.from({ length: count }, (_, index) => {
    const group = new THREE.Group();
    group.name = `tower-floor-${index + 1}`;
    group.position.y = BASE_HEIGHT + index * FLOOR_HEIGHT;
    group.visible = false;
    group.userData.floor = index + 1;
    group.userData.restY = group.position.y;
    attachMeshes(
      group,
      (index + 1) % 5 === 0 ? fifthFloor : commonFloor,
      mats,
      'arcade',
    );
    root.add(group);
    return group;
  });
  const crown = new THREE.Group();
  crown.name = 'tower-lantern-dome-and-pennant';
  crown.position.y = BASE_HEIGHT;
  attachMeshes(crown, crownGeometry, mats, 'crown');
  crown.add(flag);
  root.add(crown);
  let disposed = false;
  const tower: TriviaTower = {
    root,
    floors,
    crown,
    flag,
    floorHeight: FLOOR_HEIGHT,
    baseHeight: BASE_HEIGHT,
    wave,
    dispose() {
      if (disposed) return;
      settledBatches.get(tower)?.dispose();
      disposed = true;
      const geometries = new Set<THREE.BufferGeometry>([clothGeometry]);
      for (const set of [baseGeometry, commonFloor, fifthFloor, crownGeometry])
        Object.values(set).forEach((geometry) => geometries.add(geometry));
      geometries.forEach((geometry) => geometry.dispose());
      Object.values(mats).forEach((material) => material.dispose());
      clothMaterial.dispose();
    },
  };
  return tower;
}

const settledBatches = new WeakMap<TriviaTower, SettledTowerFloors>();

/**
 * Optional fidelity-preserving draw batching, after the source has been
 * reviewed. Editable floors and their meshes remain in the source hierarchy;
 * only settled mesh visibility changes. The cloth and crown stay dynamic.
 * Instance transforms are captured in tower-local space, so subsequently
 * moving/rotating the complete tower preserves its original world placement.
 */
export function batchSettledTowerFloors(
  tower: TriviaTower,
): SettledTowerFloors {
  const previous = settledBatches.get(tower);
  if (previous) return previous;
  type Source = {
    floor: THREE.Group;
    index: number;
    mesh: THREE.Mesh;
    originalVisible: boolean;
  };
  type Batch = {
    sources: Source[];
    mesh: THREE.InstancedMesh;
  };
  const sources: Source[] = [];
  tower.floors.forEach((floor, index) => {
    floor.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      sources.push({
        floor,
        index,
        mesh: object,
        originalVisible: object.visible,
      });
    });
  });
  // Match by resource identity, not by appearance or approximate geometry.
  // Array materials (e.g. a review override) keep their source identity too.
  const groups = new Map<
    THREE.BufferGeometry,
    Map<THREE.Material | THREE.Material[], Source[]>
  >();
  for (const source of sources) {
    let materials = groups.get(source.mesh.geometry);
    if (!materials) {
      materials = new Map();
      groups.set(source.mesh.geometry, materials);
    }
    let list = materials.get(source.mesh.material);
    if (!list) {
      list = [];
      materials.set(source.mesh.material, list);
    }
    list.push(source);
  }
  const root = new THREE.Group();
  root.name = 'tower-settled-floor-instances';
  root.visible = false;
  tower.root.add(root);
  const batches: Batch[] = [];
  for (const [geometry, materials] of groups) {
    for (const [material, list] of materials) {
      const exemplar = list[0].mesh;
      const mesh = new THREE.InstancedMesh(geometry, material, list.length);
      mesh.name = `settled-${exemplar.name}`;
      mesh.count = 0;
      mesh.visible = false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.castShadow = exemplar.castShadow;
      mesh.receiveShadow = exemplar.receiveShadow;
      mesh.renderOrder = exemplar.renderOrder;
      mesh.layers.mask = exemplar.layers.mask;
      root.add(mesh);
      batches.push({ sources: list, mesh });
    }
  }
  const inverseRoot = new THREE.Matrix4();
  const instance = new THREE.Matrix4();
  let disposed = false;

  function release() {
    root.visible = false;
    for (const { mesh } of batches) {
      mesh.count = 0;
      mesh.visible = false;
    }
    sources.forEach(({ mesh, originalVisible }) => {
      mesh.visible = originalVisible;
    });
  }

  const result: SettledTowerFloors = {
    root,
    sync(settledFloorCount) {
      if (disposed) return;
      const count = Math.max(
        0,
        Math.min(
          tower.floors.length,
          Math.floor(
            Number.isFinite(settledFloorCount) ? settledFloorCount : 0,
          ),
        ),
      );
      release();
      if (count === 0) return;
      tower.root.updateWorldMatrix(true, true);
      inverseRoot.copy(tower.root.matrixWorld).invert();
      let any = false;
      for (const { mesh, sources: members } of batches) {
        let used = 0;
        for (const source of members) {
          if (
            source.index >= count ||
            !source.floor.visible ||
            !source.originalVisible
          )
            continue;
          instance.multiplyMatrices(inverseRoot, source.mesh.matrixWorld);
          mesh.setMatrixAt(used++, instance);
          source.mesh.visible = false;
        }
        mesh.count = used;
        mesh.visible = used > 0;
        if (used > 0) {
          mesh.instanceMatrix.needsUpdate = true;
          // Correct bounds on every sync protect silhouettes when floors
          // arrive, counts shrink, or the source has rotated at rest.
          mesh.computeBoundingBox();
          mesh.computeBoundingSphere();
          any = true;
        }
      }
      root.visible = any;
    },
    release() {
      if (!disposed) release();
    },
    dispose() {
      if (disposed) return;
      release();
      disposed = true;
      batches.forEach(({ mesh }) => mesh.dispose());
      root.clear();
      root.removeFromParent();
      settledBatches.delete(tower);
    },
  };
  settledBatches.set(tower, result);
  return result;
}
