import type * as THREE from 'three';
import type { NightId } from '@/lib/games/diner/content';
import type { PlaceId } from '@/lib/games/diner/road';

/**
 * The seam between the two halves of the shift scene (8 October 2026 split):
 * the environment (`stage.ts`: the diner car opened up, its counter, the patio,
 * furniture and the place around it) and the things you touch (`stations.ts`,
 * `food.ts`, people and effects, placed by `view.ts`).
 *
 * Units are metres. x runs left to right along the counter (0..W), y up,
 * z from the counter's back (0) toward the camera (D). The gameplay numbers
 * (counter spots, booths, queue, entrance, jukebox) live in
 * `lib/games/diner/layout.ts`; this file adds the heights and clearances the
 * environment must respect.
 */

/** Free play's three nights each park at one place. */
export const NIGHT_PLACE: Record<NightId, PlaceId> = {
  1: 'truckstop',
  2: 'fairground',
  3: 'moonmile',
};

export const STAGE = Object.freeze({
  /** Height of the counter's worktop, where every machine stands. */
  counterTop: 0.93,
  /** The worktop runs from the car's inner wall to the waiters' side. */
  counterBack: 0.05,
  /** Machines may rise to this height above the worktop's spots. */
  machineCeiling: 2.35,
  /** Booth seat cushions (seated guests' hips) and table tops. */
  seatTop: 0.47,
  tableTop: 0.755,
  /** The patio deck is the floor plane y = 0 inside the play rectangle. */
  floor: 0,
});

/**
 * What the car and stage show from the Workshop. Every field is optional: the
 * stage draws the plain car without it.
 */
export type CarUpgrades = {
  spareTires?: number;
  biggerPatio?: boolean;
  neonSign?: boolean;
  jukebox?: boolean;
  heatLampPass?: boolean;
  coffeeUrn?: boolean;
  twinGrill?: boolean;
  rollerSkates?: boolean;
  chromeTray?: boolean;
  gasCan?: boolean;
  luckyDice?: boolean;
  roadAtlas?: boolean;
};

export type StageQuality = 'high' | 'low';

export type StageOptions = {
  place: PlaceId;
  /** Open booth slots (layout TABLES indexes). Unopened slots stay empty deck. */
  tables: readonly number[];
  upgrades: CarUpgrades;
  quality: StageQuality;
};

/** Live gameplay cues the environment reacts to, sent every frame. */
export type StageCues = {
  /** Seconds since the shift view started; frozen under reduced motion. */
  time: number;
  dt: number;
  reduced: boolean;
  /** False during a brownout: the car's and patio's lights dim and flicker. */
  power: boolean;
  /** A rush is on: signs and string lights pulse a little faster. */
  rush: boolean;
  /** 0..1, raised when someone walks through the entrance, decaying. */
  gate: number;
  /** The jukebox is playing (the Workshop's jukebox ability, or ambience). */
  jukebox: boolean;
};

export type Stage = {
  group: THREE.Group;
  /** World points the camera must keep fully in view (roof sign, awning). */
  landmarks: readonly THREE.Vector3[];
  /** Called once per drawn frame. */
  update(cues: StageCues): void;
  dispose(): void;
};

/** Implemented in `stage.ts`. */
export type BuildStage = (
  materials: import('./kit').Materials,
  options: StageOptions,
) => Stage;
