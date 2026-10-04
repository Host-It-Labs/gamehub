/**
 * Camera framing for Arena's 3D field. The camera looks down the field from
 * behind your towers; this finds how far back it stands and where it aims so
 * the field, with its far tower tops, fills the space between the top bar and
 * the hand tray on any screen shape. Tall screens look steeply down so
 * troops coming at you read clearly all the way up the field. They keep the
 * whole field and its
 * walls on screen, level on both sides, centred in the room between the
 * top corners (the back button and clock float beside the far king) and
 * the hand; the far king's health bar is held on screen by the HUD.
 * Wide screens (2 October 2026) turn the field a quarter: the camera stands
 * off the near side wall and looks across it, your king at the left and the
 * other at the right, so the field's long axis lies along the screen's and
 * the battle fills the width instead of a narrow strip down the middle.
 * The near wall's ends may then drop beside the hand.
 *
 * World axes (three.js): x across the field, y up, z towards you. Field tile
 * (x, y) sits at world (x - 9, 0, 16 - y).
 */
export type Vec3 = [number, number, number];

export type Frame = {
  width: number;
  height: number;
  /** Pixels covered by the top bar and by the hand tray. */
  top: number;
  bottom: number;
  left?: number;
  right?: number;
  /** The hand tray's left and right edges, when it covers only the middle
   *  of the bottom: beside it the field may reach the screen's bottom. */
  dock?: { left: number; right: number };
};

export type Camera = {
  position: Vec3;
  target: Vec3;
  fov: number;
  /** Pixels per tile at the middle of the field, for sizing the HUD. */
  scale: number;
};

/** How the camera looks at the field: degrees of tilt and of lens, how
 *  far towards the wide look it is, and whether it looks across the field
 *  (`side`) rather than down it. */
export type Lens = {
  elevation: number;
  fov: number;
  wide: number;
  side?: boolean;
};
const tall: Lens = { elevation: 70, fov: 26, wide: 0 };
const wide: Lens = { elevation: 42, fov: 36, wide: 1 };
const across: Lens = { elevation: 50, fov: 30, wide: 1, side: true };

/** The free area's width over height from which the camera looks across
 *  the field: there the turned field is drawn larger. */
export const SIDE_FROM = 1.3;

/** Tall free areas keep the steep view looking down the field; wide ones
 *  look across it; the few in between blend towards the lower look. */
export function lensFor(frame: Frame): Lens {
  const free =
    (frame.width - (frame.left ?? 0) - (frame.right ?? 0)) /
    Math.max(1, frame.height - frame.top - frame.bottom);
  if (free >= SIDE_FROM) return across;
  const k = Math.min(1, Math.max(0, (free - 0.95) / 0.65));
  const mix = (a: number, b: number) => a + (b - a) * k;
  return {
    elevation: mix(tall.elevation, wide.elevation),
    fov: mix(tall.fov, wide.fov),
    wide: k,
  };
}

/** Figures grow 18% on every screen, and another 15% since 2 October 2026.
 *  Portrait phones look steeply down on a small screen, so their figures,
 *  rings, shots and bars grow; tall windows on bigger screens grow a
 *  little. */
export function troopScale(lens: Lens, phone: boolean) {
  const tallness = 1 - lens.wide;
  return (1.75 + tallness * (phone ? 0.55 : 0.2)) * 1.18 * 1.15;
}

/** Broader silhouettes from either end of the field, including previews. */
export function figureDimensions(scale: number): Vec3 {
  return [scale * 1.12, scale, scale * 1.12];
}

/** Points that must stay on screen: field corners and the far tower tops. */
export const keyPoints: Vec3[] = [
  [-9.6, 0, 16.7],
  [9.6, 0, 16.7],
  [-9.6, 0, -16.7],
  [9.6, 0, -16.7],
  [-5.5, 4.9, -9.5],
  [5.5, 4.9, -9.5],
  [0, 5.4, -13],
  [-1.8, 5.6, -14.8],
  [1.8, 5.6, -14.8],
  // The far king's health bar hangs above it.
  [0, 6.6, -13],
];

/** Every screen: the field's side walls (at ±9.8, their tops) from your
 *  king's back to the far end, the far towers' tops, the far king's
 *  turrets, and your king whole. The strip behind your king and the meadow
 *  beyond the walls may leave the screen. */
export const tallPoints: Vec3[] = [
  [-10.3, 0.7, 15],
  [10.3, 0.7, 15],
  [-10.3, 0.7, -17.2],
  [10.3, 0.7, -17.2],
  [-5.5, 4.9, -9.5],
  [5.5, 4.9, -9.5],
  [0, 5.4, -13],
  [-1.8, 5.6, -14.8],
  [1.8, 5.6, -14.8],
  [-2, 0, 15],
  [2, 0, 15],
];

/** Looking across the field: both side walls' tops end to end, every
 *  tower's top and both kings whole. The near wall is sampled along its
 *  length so its middle stays above the hand while its ends may drop
 *  beside it. */
export const acrossPoints: Vec3[] = [
  [-10.3, 0.7, -17.2],
  [-10.3, 0.7, 17.2],
  ...[-17.2, -12, -6, 0, 6, 12, 17.2].map((z): Vec3 => [10.3, 0.7, z]),
  [-5.5, 4.9, -9.5],
  [5.5, 4.9, -9.5],
  [-5.5, 4.9, 9.5],
  [5.5, 4.9, 9.5],
  [0, 5.4, -13],
  [0, 5.4, 13],
  [-1.8, 5.6, -14.8],
  [1.8, 5.6, -14.8],
  [-1.8, 5.6, 14.8],
  [1.8, 5.6, 14.8],
];

/** The size towers are drawn at (their model's; the rules' footprint
 *  either way). Since 3 October 2026 they stand taller than the troops:
 *  1.05 looking across (0.8 before), 1.35 looking steeply down on portrait
 *  screens, where the troops grow too and the towers take more of the
 *  field. */
export function towerScale(lens?: Lens) {
  return 1.05 + (1 - (lens?.wide ?? 1)) * 0.3;
}
/** The tower tops in the key points were measured at 0.8. */
const MEASURED_TOWERS = 0.8;

/** The key points for a lens, the tower tops at its tower size. */
export function pointsFor(lens?: Lens): Vec3[] {
  const points = lens?.side ? acrossPoints : tallPoints;
  const k = towerScale(lens) / MEASURED_TOWERS;
  return points.map(([x, y, z]): Vec3 => [x, y > 3 ? y * k : y, z]);
}

/** The near ends of the side walls (the near wall, looking across): on
 *  wide screens, where the hand covers only the middle, they may sit
 *  beside it, below its top edge. */
export const isRim = ([x, , z]: Vec3, lens?: Lens) =>
  lens?.side ? x > 9 : z > 14 && Math.abs(x) > 9;

/** Turns a world point into the frame the camera is solved in, where it
 *  always looks down -z: looking across the field, a quarter turn puts the
 *  near (+x) wall nearest and your end (+z) at the left. */
const toSolve = ([x, y, z]: Vec3, lens: Lens): Vec3 =>
  lens.side ? [-z, y, x] : [x, y, z];
const fromSolve = ([x, y, z]: Vec3, lens: Lens): Vec3 =>
  lens.side ? [z, y, -x] : [x, y, z];

export const toWorld = (x: number, y: number): Vec3 => [x - 9, 0, 16 - y];
export const toField = (wx: number, wz: number): [number, number] => [
  wx + 9,
  16 - wz,
];

/** Project a point for a camera at `pos` aiming along -z tilted down by
 * `elevation` radians; returns normalised device coordinates. */
function project(
  p: Vec3,
  pos: Vec3,
  fov: number,
  aspect: number,
  elevation: number,
): [number, number] {
  const dx = p[0] - pos[0];
  const dy = p[1] - pos[1];
  const dz = p[2] - pos[2];
  // Camera basis: forward points down the field and down to the ground.
  const c = Math.cos(elevation);
  const s = Math.sin(elevation);
  const fx = 0;
  const fy = -s;
  const fz = -c;
  // up = (0, c, -s), right = (1, 0, 0)
  const depth = dx * fx + dy * fy + dz * fz;
  const up = dy * c + dz * -s;
  const right = dx;
  const t = Math.tan(((fov / 2) * Math.PI) / 180);
  return [right / (depth * t * aspect), up / (depth * t)];
}

export function fitCamera(frame: Frame, lens = lensFor(frame)): Camera {
  const { width, height } = frame;
  const fov = lens.fov;
  const elevation = (lens.elevation * Math.PI) / 180;
  const world = pointsFor(lens);
  const points = world.map((p) => toSolve(p, lens));
  const rims = world.map((p) => isRim(p, lens));
  const aspect = width / height;
  const left = frame.left ?? 0;
  const right = frame.right ?? 0;
  // The free rectangle in device coordinates, with a little breathing room.
  const pad = 6;
  const x0 = ((left + pad) / width) * 2 - 1;
  const x1 = 1 - ((right + pad) / width) * 2;
  const y1 = 1 - ((frame.top + pad) / height) * 2;
  const y0 = ((frame.bottom + pad) / height) * 2 - 1;
  const dir: Vec3 = [0, Math.sin(elevation), Math.cos(elevation)];
  const place = (distance: number, tz: number, tx: number): Vec3 => [
    tx,
    dir[1] * distance,
    tz + dir[2] * distance,
  ];
  // Beside a hand that covers only the middle, the near wall ends may drop
  // to the screen's bottom edge.
  const floor = (pad / height) * 2 - 1;
  const dock =
    frame.dock && lens.wide >= 0.5
      ? [
          ((frame.dock.left - pad) / width) * 2 - 1,
          ((frame.dock.right + pad) / width) * 2 - 1,
        ]
      : null;
  /** How much room is left above and below the points, and their width. */
  const bounds = (pos: Vec3) => {
    let minX = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let below = Infinity;
    for (let i = 0; i < points.length; i++) {
      const [nx, ny] = project(points[i], pos, fov, aspect, elevation);
      minX = Math.min(minX, nx);
      maxX = Math.max(maxX, nx);
      maxY = Math.max(maxY, ny);
      const beside = dock && rims[i] && (nx < dock[0] || nx > dock[1]);
      below = Math.min(below, ny - (beside ? floor : y0));
    }
    return { minX, maxX, above: y1 - maxY, below };
  };
  const midX = (x0 + x1) / 2;
  /** Aim so the field sits centred in the free rectangle, the room left
   *  over (on tall screens, from the width) split above and below. */
  const aim = (distance: number) => {
    let lo = -40;
    let hi = 40;
    for (let i = 0; i < 40; i++) {
      const tz = (lo + hi) / 2;
      const b = bounds(place(distance, tz, 0));
      // Aiming nearer your side moves the picture up the screen.
      if (b.below > b.above) hi = tz;
      else lo = tz;
    }
    return (lo + hi) / 2;
  };
  let lo = 5;
  let hi = 400;
  for (let i = 0; i < 40; i++) {
    const d = (lo + hi) / 2;
    const b = bounds(place(d, aim(d), 0));
    const fits = b.above + b.below >= 0 && b.maxX - b.minX <= x1 - x0;
    if (fits) hi = d;
    else lo = d;
  }
  const distance = hi;
  const tz = aim(distance);
  // Centre sideways in the free rectangle (it may be off-centre).
  const t = Math.tan(((fov / 2) * Math.PI) / 180);
  const depthAtTarget = distance;
  const tx = -midX * depthAtTarget * t * aspect;
  const position = place(distance, tz, tx);
  // The HUD's size unit: the whole field's height on screen over 30 tiles,
  // or, looking across, its width on screen (side wall to side wall) over
  // 19.2 tiles.
  let lowY = Infinity;
  let highY = -Infinity;
  const nearZ = 16.7 - lens.wide * 2.2;
  const wallToWall: Vec3[] = [
    [-9.6, 0, 0],
    [9.6, 0, 0],
  ];
  for (const [x, y, z] of lens.side ? wallToWall : keyPoints) {
    const p: Vec3 = [x, y, z > 16 ? nearZ : z];
    const [, ny] = project(toSolve(p, lens), position, fov, aspect, elevation);
    lowY = Math.min(lowY, ny);
    highY = Math.max(highY, ny);
  }
  const scale = ((highY - lowY) * (height / 2)) / (lens.side ? 19.2 : 30);
  return {
    position: fromSolve(position, lens),
    target: fromSolve([tx, 0, tz], lens),
    fov,
    scale,
  };
}

/** The same framing seen from the other end, for a player on side 1. */
export function mirrorCamera(cam: Camera): Camera {
  const [px, py, pz] = cam.position;
  const [tx, ty, tz] = cam.target;
  return { ...cam, position: [-px, py, -pz], target: [-tx, ty, -tz] };
}
