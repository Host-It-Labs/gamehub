import type { Object3D, Quaternion, Vector3 } from 'three';

/** The first eight collector sculpts (the archer stands on the towers). */
export const ORIGINAL_FACES = [
  'guard',
  'archers',
  'ogre',
  'imps',
  'duelist',
  'ranger',
  'drake',
  'mage',
] as const;
export const TROOP_FACES = [
  ...ORIGINAL_FACES,
  'pirate',
  'viking',
  'gladiator',
  'medic',
  'miner',
  'balloon',
  'inventor',
  'gunner',
  'diver',
  'sumo',
  'linebacker',
  'beekeeper',
  'drummer',
  'firefighter',
  'jetpack',
  'explorer',
  'bee',
] as const;
type Character = (typeof TROOP_FACES)[number];

const SQUINTS: Partial<Record<Character, number>> = {
  ranger: 0.23,
  duelist: 0.17,
  guard: 0.17,
  pirate: 0.18,
  viking: 0.24,
  gladiator: 0.21,
  medic: 0.06,
  miner: 0.15,
  balloon: 0.09,
  inventor: 0.1,
  gunner: 0.22,
  diver: 0.14,
  sumo: 0.2,
  linebacker: 0.18,
  beekeeper: 0.06,
  drummer: 0.1,
  firefighter: 0.21,
  jetpack: 0.2,
  explorer: 0.2,
  bee: 0.12,
};

type Feature =
  | 'eyeL'
  | 'eyeR'
  | 'pupilL'
  | 'pupilR'
  | 'browL'
  | 'browR'
  | 'mouth';
type Joint = {
  node: Object3D;
  position: Vector3;
  quaternion: Quaternion;
  scale: Vector3;
  width: number;
  height: number;
};
export type FaceRig = Partial<Record<Feature, Joint>>;
const FEATURES: Feature[] = [
  'eyeL',
  'eyeR',
  'pupilL',
  'pupilR',
  'browL',
  'browR',
  'mouth',
];

/** Features are ordinary jointed meshes, so batching, shadows, x-ray and
 *  placement previews continue to use the same sculpt and materials. */
export function faceRig(model: Object3D, id: string): FaceRig {
  const rig: FaceRig = {};
  for (const feature of FEATURES) {
    const node = model.getObjectByName(`${id}${feature}`);
    if (!node) continue;
    rig[feature] = {
      node,
      position: node.position.clone(),
      quaternion: node.quaternion.clone(),
      scale: node.scale.clone(),
      width: Number(node.userData.faceWidth) || 0.03,
      height: Number(node.userData.faceHeight) || 0.02,
    };
  }
  return rig;
}

const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));
const ease = (v: number) => v * v * (3 - 2 * v);
/** A quick close, slower open, with continuous first derivatives. */
function blinkAt(t: number) {
  if (t < 0 || t >= 0.18) return 0;
  return t < 0.065 ? ease(t / 0.065) : 1 - ease((t - 0.065) / 0.115);
}

export type FaceInput = {
  id: string;
  seed: number;
  time: number;
  aim: number;
  wind: number;
  strike: number;
  hurt: number;
  look: number;
  reduced?: boolean;
  stunned?: boolean;
};
export type FacePose = {
  left: number;
  right: number;
  gazeX: number;
  gazeY: number;
  browL: number;
  browR: number;
  tilt: number;
  mouth: number;
};

/** Individual expressions, timed by the game clock, never simulation state.
 *  Reduced motion keeps the combat expression and stops idle eye/fidget motion. */
export function facePose(c: FaceInput): FacePose {
  const id = c.id as Character;
  if (c.stunned)
    return {
      left: 0.48,
      right: 0.48,
      gazeX: 0,
      gazeY: -0.15,
      browL: 0.1,
      browR: 0.1,
      tilt: -0.04,
      mouth: 0.1,
    };
  const focus = clamp(c.aim, 0, 1);
  const hurt = clamp(c.hurt, 0, 1);
  const wind = clamp(c.wind, 0, 1);
  const kick = clamp(c.strike, 0, 1);
  const period = 3.8 + ((c.seed * 13) % 17) * 0.09;
  const t = c.time + ((c.seed * 0.618) % period);
  const lap = Math.floor(t / period);
  const phase = t % period;
  const blink = c.reduced
    ? 0
    : Math.max(
        blinkAt(phase),
        lap % 3 === 1 ? blinkAt(phase - 0.28) * 0.85 : 0,
      );
  const curious = c.reduced
    ? 0
    : Math.sin(c.time * 0.73 + c.seed) * (1 - focus);
  const squint = SQUINTS[id] ?? 0.1;
  // A Rex opens its eyes as it rears and tightens them on the bite. Its
  // upper lids are the eyebrows, so they lift independently of the jaw.
  const wide =
    id === 'ogre'
      ? wind * 0.28
      : id === 'mage'
        ? wind * 0.15
        : id === 'inventor'
          ? wind * 0.2
          : 0;
  const close =
    Math.max(blink, hurt * 0.8, focus * squint + kick * 0.13) - wide;
  const eyebrow =
    (id === 'mage' ? 0.25 : id === 'ogre' ? 0.35 : 0.12) * curious;
  const raise =
    (id === 'ogre' ? 0.12 : 0) + wide * 1.4 - focus * 0.1 + hurt * 0.2;
  return {
    left: clamp(1 - close - (id === 'ranger' ? focus * 0.17 : 0), 0.04, 1.25),
    right: clamp(1 - close, 0.04, 1.25),
    gazeX: c.reduced
      ? 0
      : clamp(c.look * 0.4 + curious * 0.25, -1, 1) * (1 - focus * 0.85),
    gazeY: c.reduced
      ? 0
      : Math.sin(c.time * 0.49 + c.seed) * 0.16 * (1 - focus),
    browL: raise + eyebrow,
    browR: raise - eyebrow * 0.65,
    tilt: focus * 0.1 + kick * 0.06 - hurt * 0.05,
    mouth:
      id === 'ranger'
        ? curious * 0.12 - hurt * 0.2
        : focus * 0.12 + hurt * 0.25,
  };
}

/** Reset every feature before applying a face: several troops share a kit,
 *  so one cadet's blink must never become the next cadet's rest pose. */
export function applyFace(rig: FaceRig, pose: FacePose) {
  for (const feature of FEATURES) {
    const r = rig[feature];
    if (!r) continue;
    const n = r.node;
    n.position.copy(r.position);
    n.quaternion.copy(r.quaternion);
    n.scale.copy(r.scale);
    if (feature === 'eyeL' || feature === 'eyeR') {
      n.scale.y *= feature === 'eyeL' ? pose.left : pose.right;
    } else if (feature === 'pupilL' || feature === 'pupilR') {
      n.position.x += pose.gazeX * r.width * 0.16;
      n.position.y += pose.gazeY * r.height * 0.15;
    } else if (feature === 'browL' || feature === 'browR') {
      const left = feature === 'browL';
      n.position.y += (left ? pose.browL : pose.browR) * r.height;
      n.rotateZ(pose.tilt * (left ? 1 : -1));
    } else {
      n.scale.y *= 1 + pose.mouth;
      n.rotateZ(pose.mouth * 0.16);
    }
  }
}
