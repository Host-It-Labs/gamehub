/**
 * Keeps the battle's motion smooth by fitting the drawing to the device.
 * Screens refresh 60 to 120 times a second, and a frame that misses its slot
 * shows as a stutter; an even 60 is smoother than a ragged 90. The pacer
 * watches how many frames arrive late. On a fast screen that cannot keep up
 * it first settles on a steady 60. If even that slips it steps down a
 * ladder of cheaper settings (`Rung`), the least visible first, and it
 * climbs back as soon as there is room again. A rung that slipped again
 * right after a climb is not retried for a while (twice as long each time),
 * so the picture never hunts up and down.
 *
 * Every device starts at the top: a powerful phone keeps the desktop's
 * look, a weaker one finds its level within a few seconds.
 */
export type Rung = {
  /** Fraction of the device's full pixel ratio to draw at. */
  resolution: number;
  /** Draw the sun's shadows every frame (1) or every other frame (2); the
   *  battle itself steps 30 times a second. */
  shadowEvery: 1 | 2;
  /** Shadow map size in texels. */
  shadowSize: number;
};

/** The ladder, best first. `full` is the device's shadow size; `min` the
 *  lowest resolution fraction allowed. */
export function ladder(full: number, min: number): Rung[] {
  const rungs: Rung[] = [
    { resolution: 1, shadowEvery: 1, shadowSize: full },
    { resolution: 1, shadowEvery: 2, shadowSize: full },
    { resolution: 0.85, shadowEvery: 2, shadowSize: full },
    { resolution: 0.72, shadowEvery: 2, shadowSize: full },
    { resolution: 0.72, shadowEvery: 2, shadowSize: Math.min(full, 2048) },
    { resolution: 0.6, shadowEvery: 2, shadowSize: Math.min(full, 2048) },
    { resolution: 0.5, shadowEvery: 2, shadowSize: Math.min(full, 2048) },
    { resolution: 0.4, shadowEvery: 2, shadowSize: Math.min(full, 2048) },
  ];
  const kept = rungs.filter((r) => r.resolution >= min - 0.001);
  return kept.filter(
    (r, i) =>
      i === 0 ||
      r.resolution !== kept[i - 1].resolution ||
      r.shadowEvery !== kept[i - 1].shadowEvery ||
      r.shadowSize !== kept[i - 1].shadowSize,
  );
}

/** Late-frame share above which the pacer steps down, and below which a
 *  window counts as calm. */
const SLIP = 0.08;
const CALM = 0.015;
/** Milliseconds per judged window; shorter at the start so a device finds
 *  its level quickly. */
const WINDOW = 1000;
const FIRST_WINDOW = 500;

export class Pacer {
  /** The rung drawn at now (index into `rungs`). */
  level = 0;
  /** Milliseconds between drawn frames, or 0 to draw on every refresh. */
  private cap = 0;
  private refresh = 1000 / 60;
  private deltas: number[] = [];
  private lastRaf = 0;
  private lastDraw = 0;
  private late = 0;
  private drawn = 0;
  private windowStart = 0;
  private windows = 0;
  private calm = 0;
  private uncapTries = 0;
  /** After a change the next window is not judged: it holds the hitch of
   *  resizing buffers. */
  private settle = false;
  /** Per rung: until when it may not be climbed back to, and how long the
   *  next ban lasts. */
  private bannedUntil: number[];
  private banFor: number[];
  /** When the last climb happened, and to which rung. */
  private climbedAt = -Infinity;
  private climbedTo = -1;

  readonly rungs: Rung[];
  private onRung: (rung: Rung) => void;

  constructor(rungs: Rung[], onRung: (rung: Rung) => void) {
    this.rungs = rungs;
    this.onRung = onRung;
    this.bannedUntil = rungs.map(() => 0);
    this.banFor = rungs.map(() => 20000);
  }

  /** Call on every animation frame; says whether to draw this one. */
  frame(now: number) {
    const raf = now - this.lastRaf;
    this.lastRaf = now;
    // A hidden tab or a breakpoint: start measuring afresh.
    if (raf > 250) {
      this.lastDraw = now;
      this.windowStart = now;
      this.late = this.drawn = 0;
      return true;
    }
    this.deltas.push(raf);
    if (this.deltas.length > 90) this.deltas.shift();
    // The quickest recent frames show the screen's own rate.
    this.refresh = Math.min(
      17.5,
      Math.max(6.5, Math.min(...this.deltas.slice(-45))),
    );
    if (this.cap && now - this.lastDraw < this.cap - this.refresh * 0.5)
      return false;
    const gap = now - this.lastDraw;
    this.lastDraw = now;
    this.drawn++;
    if (gap > (this.cap || this.refresh) * 1.45) this.late++;
    const span = this.windows < 6 ? FIRST_WINDOW : WINDOW;
    if (now - this.windowStart > span) this.judge(now);
    return true;
  }

  private judge(now: number) {
    const ratio = this.drawn ? this.late / this.drawn : 0;
    this.windowStart = now;
    this.late = this.drawn = 0;
    this.windows++;
    if (this.settle) {
      this.settle = false;
      return;
    }
    const fast = this.refresh < 12;
    if (ratio > SLIP) {
      this.calm = 0;
      // A climb that slipped straight away: that rung waits a while.
      if (this.level === this.climbedTo && now - this.climbedAt < 4000) {
        this.bannedUntil[this.level] = now + this.banFor[this.level];
        this.banFor[this.level] *= 2;
      }
      if (fast && !this.cap) {
        this.cap = 1000 / 60;
        this.settle = true;
      } else if (this.level < this.rungs.length - 1) this.go(this.level + 1);
      return;
    }
    if (ratio > CALM) {
      this.calm = 0;
      return;
    }
    this.calm++;
    const up = this.level - 1;
    if (this.calm >= 4 && up >= 0 && now >= this.bannedUntil[up]) {
      this.calm = 0;
      this.climbedAt = now;
      this.climbedTo = up;
      this.go(up);
    } else if (this.calm >= 8 && this.cap && this.level === 0) {
      // Plenty of room at 60: try the screen's full rate again, twice.
      if (this.uncapTries < 2) {
        this.calm = 0;
        this.uncapTries++;
        this.cap = 0;
        this.settle = true;
      }
    }
  }

  private go(level: number) {
    this.level = level;
    this.settle = true;
    this.onRung(this.rungs[level]);
  }
}
