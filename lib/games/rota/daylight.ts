/** Scene colour changes use the match's existing 0..1 dusk value. The
 * lighting floor is deliberately generous: this is early blue hour. */
export const DAYLIGHT = {
  afternoon: {
    sun: '#ffdcaa',
    sky: '#e9e2d4',
    ground: '#8f8272',
    haze: '#e4d6bd',
    background: '#e4d6bd',
  },
  evening: {
    sun: '#ffc68b',
    sky: '#ccd4dc',
    ground: '#948d84',
    haze: '#a0a8ad',
    background: '#969ca4',
  },
  blueHour: {
    sun: '#ffb172',
    sky: '#c0d3ee',
    ground: '#93949e',
    haze: '#6d829a',
    background: '#3d5675',
  },
} as const;

/** Late-only correction from the reviewed round-five palette. Cool fill is
 * almost neutral so slate, brick and setts retain their own hue. */
export const BLUE_HOUR = {
  sun: '#ffd0a1',
  sky: '#d6dcdf',
  ground: '#b7ad9e',
  haze: '#89959d',
  background: '#5f6f7d',
} as const;

export function lateDusk(dusk: number) {
  const t = Math.max(0, Math.min(1, (dusk - 0.55) / 0.45));
  return t * t * (3 - 2 * t);
}

export type DuskLighting = {
  late: number;
  sunHeight: number;
  sunIntensity: number;
  skyIntensity: number;
  shadowIntensity: number;
  shadowRadius: number;
};

/** Write into the world's persistent state: no per-frame objects. The sun
 * stays at least 26 degrees high; short faint shadows give way to sky fill. */
export function duskLighting(dusk: number, out: DuskLighting) {
  const d = Number.isFinite(dusk) ? Math.max(0, Math.min(1, dusk)) : 0;
  const late = lateDusk(d);
  out.late = late;
  out.sunHeight = 0.95 - d * 0.65 + late * 0.22;
  out.sunIntensity = 2.5 - d * 1.3 - late * 0.82;
  out.skyIntensity = 1.5 + d * 0.4 + late * 0.45;
  out.shadowIntensity = 1 - late * 0.84;
  out.shadowRadius = 1 + late * 2;
  return out;
}

export const DUSK_SECONDS = 2.2;

/** No frame allocations; repeated board updates do not restart a fade.
 * Snapshot/reduced-motion callers set immediately. */
export class DuskTransition {
  value = 0;
  target = 0;
  from = 0;
  elapsed = DUSK_SECONDS;

  set(dusk: number | undefined, immediate = false) {
    const next = Number.isFinite(dusk) ? Math.max(0, Math.min(1, dusk!)) : 0;
    if (immediate) {
      this.value = this.target = this.from = next;
      this.elapsed = DUSK_SECONDS;
    } else if (next !== this.target) {
      this.from = this.value;
      this.target = next;
      this.elapsed = 0;
    }
  }

  tick(dt: number) {
    if (this.value === this.target) return false;
    this.elapsed = Math.min(
      DUSK_SECONDS,
      this.elapsed + Math.max(0, Number.isFinite(dt) ? dt : 0),
    );
    const t = this.elapsed / DUSK_SECONDS;
    this.value = this.from + (this.target - this.from) * t * t * (3 - 2 * t);
    return true;
  }
}
