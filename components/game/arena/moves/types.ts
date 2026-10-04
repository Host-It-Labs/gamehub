import type { Unit } from '@/lib/games/arena/engine';
import type { GaitChoice, GaitProfile } from '@/lib/games/arena/gait';

export type { GaitChoice, GaitName, GaitProfile } from '@/lib/games/arena/gait';

/**
 * The animation contract for a troop's own moves (one file per troop in
 * this folder, registered in index.ts).
 *
 * WALKING (1 October 2026): pick a gait, do not animate legs. Set
 * `style.gait` to a preset (`'light'`, `'brisk'`, `'swagger'`, `'march'`,
 * `'glide'`, `'heavy'`, `'beast'`, `'shuffle'`; see GAITS in
 * lib/games/arena/gait.ts) or a preset with changes,
 * `{ like: 'heavy', stride: 0.55, arms: 0.2 }`. troops.ts then plants
 * each foot on the field and solves hip, knee and ankle onto it every
 * frame (feet never slide, standing, walking, turning or lunging), drops
 * the pelvis at each contact and lifts it as the legs pass, shifts and
 * tilts the hips over the planted foot, turns pelvis and shoulders against
 * each other, swings the arms opposite the legs (elbows lagging), holds
 * the head steady and leans into speed and turns. The old `stride`,
 * `legSwing`, `bob` and `sway` numbers are ignored once `gait` is set.
 * A `pose` that asks for a leg, knee or foot (`c.want('legL', …)`) takes
 * that leg off the ground solver while it does (a leap, a braced stance);
 * the foot is planted again where it ends up. Skirts and coat tails read
 * `c.hipL` / `c.hipR`, the thighs' real swing.
 *
 * troops.ts computes the shared walk and the attack timing, then hands
 * the troop's `pose` the numbers below to change before they are sprung
 * onto the joints. Angles are radians added to the sculpt's rest pose,
 * turned the way three.js turns the parts: +x raises an arm or leg forward
 * (and tips a torso or head back); torsoX and headX count forward bends
 * and nods instead, as troops.ts writes them negated.
 */

/** Joints a figure may carry (Blender parts `<id>.<part>`). */
export type PartName =
  | 'legL'
  | 'legR'
  | 'kneeL'
  | 'kneeR'
  | 'footL'
  | 'footR'
  | 'torso'
  | 'head'
  | 'armL'
  | 'armR'
  /** Elbows: children of the arms, forearm and hand below them. */
  | 'foreL'
  | 'foreR'
  | 'weapon'
  | 'offhand'
  | 'wingL'
  | 'wingR'
  | 'tail'
  | 'jaw'
  /** Spun directly every frame (propellers, keys, wheels). */
  | 'spin'
  /** The tower guard's nocked arrow, pivoting on its nock. */
  | 'arrow'
  /** Coat tails and kilts: children of the torso or hips at the waist, so
   *  they trail the legs instead of swinging rigidly with them. */
  | 'skirtL'
  | 'skirtR'
  /** A cape or rear flap hanging from the shoulders. */
  | 'cape'
  | 'shield'
  | 'wheels'
  | 'basket'
  /** One free part per figure for anything else (a lamp, a tank, a coil). */
  | 'extra'
  /** Soft parts for secondary motion (3 October 2026). Each is an ordinary
   *  joint (`<id>.<part>` with its origin on the pivot) that troops.ts
   *  springs softly (see `stiff` and `damping` on Moves) and leaves at rest
   *  unless the troop's pose asks for it; `c.accel`, `c.lateral`,
   *  `c.vertical` and `c.turn` say how the body is moving so the pose can
   *  make them lag, swing and settle. A hat (or its tip), a beard, hair or
   *  a plume, the second and third links of a tail or a cape, a neck
   *  between torso and head, an antenna, sleeves, and the wrists (children
   *  of the elbows). */
  | 'hat'
  | 'beard'
  | 'hair'
  | 'neck'
  | 'tail2'
  | 'tail3'
  | 'cape2'
  | 'antenna'
  | 'sleeveL'
  | 'sleeveR'
  | 'handL'
  | 'handR'
  | 'extra2';

export type Attack =
  | 'blaster'
  | 'chomp'
  | 'jab'
  | 'cleave'
  | 'rifle'
  | 'bomb'
  | 'cast'
  /** Everything is the troop's own `pose`. */
  | 'custom';

/** How a troop moves. Angles are radians. */
export type Style = {
  /** How it walks (see the note at the top). Troops without one walk
   *  'brisk' ('heavy' when `heavy`). */
  gait?: GaitChoice;
  /** Shoulder swing while walking; overrides the gait's `arms` (a troop
   *  carrying something swings less). */
  armSwing?: number;
  /** Forward lean while walking; overrides the gait's `lean`. */
  lean?: number;
  /** Before gaits: tiles per step, leg swing, hop height and sway. Only
   *  the Robots' clockwork walk still reads them. */
  stride?: number;
  legSwing?: number;
  bob?: number;
  sway?: number;
  attack: Attack;
  /** Seconds of wind-up before a hit. */
  windup: number;
  /** How far the body lunges into a hit, world units. */
  lunge: number;
  /** Joint spring stiffness (1/s): higher is snappier. */
  snap: number;
  /** Heavy troops shake the camera a little when they land. */
  heavy?: boolean;
  /** Both hands on one weapon: the arms swing together. */
  twoHanded?: boolean;
  /** Flying troops hover at this height instead of FLY_HEIGHT. */
  flyHeight?: number;
};

/** The pose numbers a troop's `pose` may change. */
export type Pose = {
  torsoX: number;
  torsoY: number;
  torsoZ: number;
  headX: number;
  headY: number;
  armL: number;
  armR: number;
  /** Arms out to the side (about z). */
  armLz: number;
  armRz: number;
  weapon: number;
  offhand: number;
  jaw: number;
  tailY: number;
  /** Whole-body forward pitch and side roll (sprung). */
  lean: number;
  roll: number;
  /** Whole body thrown forward (world units; negative is recoil). */
  lunge: number;
  /** Whole body turned about the vertical. */
  yawKick: number;
  /** Whole body raised, world units (a leap, a hover). */
  lift: number;
  /** Vertical squash of the whole body (1 is none). */
  squash: number;
};

export type MoveContext = {
  /** The engine's troop. Ability state lives on it: `dash` (leaping at a
   *  target), `shield` (hit points left on a shield), `stun` (seconds
   *  stopped), and for the Medic `sinceHit` resets on every heal pulse. */
  unit: Unit;
  /** 0..1 blends: walking, attacking, standing idle. */
  walk: number;
  aim: number;
  idle: number;
  /** 0..1 wind-up before a hit, the strike on it (fast out, slow back). */
  wind: number;
  strike: number;
  /** Seconds since the last hit, and until the next. */
  since: number;
  toHit: number;
  /** Hits so far this attack, to alternate sides. */
  hits: number;
  /** Per-troop time (seconds, tempo-scaled and offset), and frame time. */
  t: number;
  dt: number;
  /** The walk: 0..1 through the cycle, each leg's forward swing (1 to -1)
   *  and the passing moment (0 at foot strike, 1 as the legs pass). */
  cycle: number;
  fwdL: number;
  fwdR: number;
  pass: number;
  /** Each thigh's turn this frame (radians, + forward), from the ground
   *  solver: what a skirt half or coat tail should trail. */
  hipL: number;
  hipR: number;
  /** The shared arm swing already in `p.armL` / `p.armR` (radians), so a
   *  carrying arm can take back a share of it. */
  swingL: number;
  swingR: number;
  /** Ground speed (world units a second) and the troop's gait. */
  speed: number;
  gait: GaitProfile;
  /** How much larger than usual the figure is drawn (phones). */
  size: number;
  /** World units walked so far (for wheels and treads). */
  travel: number;
  /** How the body is moving, for parts that should lag it (hats, capes,
   *  tails, beards), all smoothed: its speeding up along its facing
   *  (world units/s², + speeding up forward), sideways (+ towards its
   *  right), up and down (+ up), and its turn (radians a second, + to its
   *  left). */
  accel: number;
  lateral: number;
  vertical: number;
  turn: number;
  /** Seconds it has stood still and idle (0 while it walks or fights), to
   *  time idle fidgets. */
  idleFor: number;
  /** 0..1, just hit (falls away in about a quarter second). */
  flinch: number;
  /** The game clock (seconds), the same for every troop. */
  time: number;
  /** Keep optional fidgets and secondary flourishes still. */
  reduced: boolean;
  /** This troop's own scratch numbers, kept between frames (a spin angle,
   *  a fidget's choice). Moves objects are shared by every troop of a card,
   *  so state that belongs to one troop lives here. */
  memo: Record<string, number>;
  /** 0..1 through deploying (1 once it stands on the field). */
  deploy: number;
  /** Ask any joint for a turn (and lift) this frame. */
  want(
    part: PartName,
    rx?: number,
    ry?: number,
    rz?: number,
    dy?: number,
  ): void;
};

/** How a figure carries itself on the move, beyond its Style. */
export type Carriage = {
  /** Chest turned against the stride, radians each way (the shoulder over
   *  the forward leg goes back, the arm with it). */
  twist: number;
  /** The hips turned with the forward leg (the whole figure turns). */
  hips: number;
  /** The chest's roll with the body's roll onto the planted foot: 1 rides
   *  with it, 0 stays upright, negative counters it. */
  chestRoll: number;
  /** Nod of the head a moment after each foot lands. */
  nod: number;
  /** Arms held out from the sides while walking (about z). */
  armOut: number;
  /** Arms carrying a weapon between them dip after each step and spring
   *  back, the weapon a moment later. */
  bounce: number;
  /** A weapon arm swings this share of the free arm's swing. */
  weaponArm: number;
};

/** A troop's own moves. */
export type Moves = {
  style: Style;
  /** How it carries itself on the move (troops.ts has a default). */
  carriage?: Carriage;
  /** Per joint, its spring's stiffness against the style's `snap`
   *  (troops.ts's STIFF has the defaults: legs 1.7, head 0.55, cape 0.35,
   *  tail 0.32, the soft parts about 0.3–0.45). */
  stiff?: Partial<Record<PartName, number>>;
  /** Per joint, its spring's damping (default 0.62; lower swings and
   *  overshoots longer, for cloth, tails and antennae). */
  damping?: Partial<Record<PartName, number>>;
  /** Called each frame after the shared walk and attack timing. */
  pose?(c: MoveContext, p: Pose): void;
  /** Replaces the drop-onto-the-field arrival: body height, squash and
   *  twirl for `d` 0..1 through deploying. */
  arrive?(d: number): { drop: number; squash: number; twirl: number };
};
