import * as THREE from 'three';
import { COUNTER_Z, D, W } from '../../../lib/games/diner/layout.ts';

export type Frame = {
  width: number;
  height: number;
  top: number;
  bottom: number;
  left: number;
  right: number;
};

/**
 * Everything play needs in view (9 October 2026): the deck from rail to
 * rail, and the kitchen hatch with the tops of its machines. The trailer's
 * roof and the place around are framing: they show where the screen has
 * room, and are cut where it has not.
 */
export const DINER_LANDMARKS: readonly [number, number, number][] = [
  [-0.35, 0, D + 0.05],
  [W + 0.35, 0, D + 0.05],
  [-0.35, 0, COUNTER_Z],
  [W + 0.35, 0, COUNTER_Z],
  // The hatch's top edge: machines and plates stand below it.
  [0.2, 2.5, 1.2],
  [W - 0.2, 2.5, 1.2],
];

/**
 * Fits the play area inside the frame's free part, as large as it goes.
 * `extra` adds the stage's own landmarks (the roof sign) where the screen
 * has height to spare. Landscape screens look across the deck from a lower
 * angle (faces and machine fronts read); tall ones look down more.
 */
export function fitDinerCamera(
  camera: THREE.OrthographicCamera,
  frame: Frame,
  extra: readonly THREE.Vector3[] = [],
) {
  const width = Math.max(1, frame.width);
  const height = Math.max(1, frame.height);
  const availableWidth = Math.max(40, width - frame.left - frame.right);
  const availableHeight = Math.max(40, height - frame.top - frame.bottom);
  const aspect = availableWidth / availableHeight;
  // 44° on landscape, rising to 56° on a square or tall frame.
  const tall = Math.min(1, Math.max(0, (1.6 - aspect) / 0.6));
  const elevation = ((44 + tall * 12) * Math.PI) / 180;
  const target = new THREE.Vector3(W / 2, 0, (COUNTER_Z + D) / 2);
  camera.position.set(
    target.x,
    Math.sin(elevation) * 40,
    target.z + Math.cos(elevation) * 40,
  );
  camera.up.set(0, 1, 0);
  camera.lookAt(target);
  camera.updateMatrixWorld(true);
  const v = new THREE.Vector3();
  const measure = (points: Iterable<THREE.Vector3>) => {
    const b = new THREE.Box2();
    for (const p of points) {
      v.copy(p).applyMatrix4(camera.matrixWorldInverse);
      b.expandByPoint(new THREE.Vector2(v.x, v.y));
    }
    return b;
  };
  const play = measure(DINER_LANDMARKS.map((p) => new THREE.Vector3(...p)));
  let bounds = play;
  // The roof sign joins the fit only when that costs little of the play area.
  if (extra.length) {
    const withSign = measure([
      ...DINER_LANDMARKS.map((p) => new THREE.Vector3(...p)),
      ...extra,
    ]);
    const scale = (b: THREE.Box2) => {
      const s = b.getSize(new THREE.Vector2());
      return Math.max(s.x / availableWidth, s.y / availableHeight);
    };
    if (scale(withSign) <= scale(play) * 1.005) bounds = withSign;
  }
  const size = bounds.getSize(new THREE.Vector2());
  const unitsPerPixel =
    Math.max(size.x / availableWidth, size.y / availableHeight) * 1.01;
  const centre = bounds.getCenter(new THREE.Vector2());
  const screenX = frame.left + availableWidth / 2;
  const screenY = frame.top + availableHeight / 2;
  camera.left = centre.x - screenX * unitsPerPixel;
  camera.right = camera.left + width * unitsPerPixel;
  camera.top = centre.y + screenY * unitsPerPixel;
  camera.bottom = camera.top - height * unitsPerPixel;
  camera.near = 1;
  camera.far = 160;
  camera.updateProjectionMatrix();
  return { pixelsPerUnit: 1 / unitsPerPixel, bounds };
}
