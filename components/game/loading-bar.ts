'use client';
import { useLayoutEffect, useRef, type RefObject } from 'react';
import {
  blendPaths,
  pathAt,
  planPath,
  type PathGoal,
  type PathPoint,
} from './loading-path';

/** New reports replan at most this often (ms); the bar keeps moving between. */
const REPLAN = 90;
/** A frame this late (ms) means the page is busy; for a while after one,
 *  and whenever a new stage begins (heavy work usually starts with it), a
 *  new path keeps to the old one long enough to absorb a stall (seconds),
 *  otherwise only briefly. The finish never waits long. */
const LATE = 120;
const BUSY_FOR = 2000;
const HOLD_BUSY = 0.9;
const HOLD = 0.2;
const HOLD_DONE = 0.3;

type Options = {
  /** The bar has reached 100% after `done`: time to hand over. */
  onFull?: () => void;
  /** Finish at once when done, without first keeping to the old path, for
   *  a screen that is already fading out by then (seconds; default 0.3). */
  finishHold?: number;
  /** The fill shown, about every frame while the page is free (for a
   *  number or marks that follow the bar). */
  onFrame?: (shown: number) => void;
};

const still = () =>
  typeof window !== 'undefined' &&
  !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Drives one loading bar element along `planPath`: its fill is
 * `transform: scaleX()` from one Web Animation per plan, which the
 * compositor plays on its own, so the bar keeps its pace while scripts
 * decode files or build a 3D scene.
 *
 * A new report replans at the start of the next frame, from exactly where
 * the bar is on screen in that frame and at its pace, and the new plan
 * starts in that same frame. If the page stalls before that frame reaches
 * the screen, the screen stays on the old plan meanwhile; the new plan
 * keeps to the old one at first (`blendPaths`), longer while the page is
 * busy, so they meet wherever the stall ends. Under reduced motion the bar
 * simply shows the progress.
 */
export class LoadingBar {
  private goal: PathGoal = { value: 0 };
  private path: PathPoint[] = [{ t: 0, x: 0, v: 0 }];
  private anim: Animation | null = null;
  private last = -Infinity;
  private timer = 0;
  private due = 0;
  private frame = 0;
  private lastTick = 0;
  private busyAt = -Infinity;
  private newStage = false;
  private shown = -1;
  private full = false;
  private gone = false;

  constructor(
    private el: HTMLElement,
    private options: Options = {},
  ) {
    el.style.transformOrigin ||= '0 50%';
    el.style.transform = 'scaleX(0)';
    this.frame = requestAnimationFrame(this.tick);
  }

  /** Report progress; the bar follows at its own pace. */
  set(goal: PathGoal) {
    if (this.gone || this.full) return;
    const was = this.goal;
    this.goal = {
      value: Math.max(was.value, goal.value),
      ceiling: Math.max(was.ceiling ?? 0, goal.ceiling ?? 0),
      done: was.done || goal.done,
    };
    if (this.goal.ceiling !== was.ceiling) this.newStage = true;
    const same =
      this.goal.value === was.value &&
      this.goal.ceiling === was.ceiling &&
      this.goal.done === was.done;
    if ((same && this.anim) || this.due) return;
    // Done goes at the next frame; other reports at most every REPLAN ms.
    if (this.goal.done) {
      clearTimeout(this.timer);
      this.timer = 0;
    } else if (this.timer) return;
    const wait = this.goal.done ? 0 : this.last + REPLAN - performance.now();
    const schedule = () => {
      this.timer = 0;
      this.due = requestAnimationFrame(() => {
        this.due = 0;
        this.replan();
      });
    };
    if (wait > 0) this.timer = window.setTimeout(schedule, wait);
    else schedule();
  }

  /** The fill on screen now. */
  value() {
    return pathAt(this.path, this.elapsed()).x;
  }

  dispose() {
    this.gone = true;
    clearTimeout(this.timer);
    cancelAnimationFrame(this.due);
    cancelAnimationFrame(this.frame);
    this.anim?.cancel();
    this.anim = null;
  }

  private elapsed() {
    const t = Number(this.anim?.currentTime ?? 0);
    return Number.isFinite(t) ? t / 1000 : 0;
  }

  private replan() {
    if (this.gone) return;
    this.last = performance.now();
    const from = this.elapsed();
    const at = pathAt(this.path, from);
    if (still()) {
      const x = this.goal.done ? 1 : Math.max(at.x, this.goal.value);
      this.path = [{ t: 0, x, v: 0 }];
      this.anim?.cancel();
      this.anim = null;
      this.el.style.transform = `scaleX(${x})`;
      if (this.goal.done) this.finish();
      return;
    }
    const busy = this.newStage || performance.now() - this.busyAt < BUSY_FOR;
    this.newStage = false;
    const hold = this.goal.done
      ? Math.min(this.options.finishHold ?? HOLD_DONE, busy ? HOLD_BUSY : HOLD)
      : busy
        ? HOLD_BUSY
        : HOLD;
    const path = this.anim
      ? blendPaths(this.path, from, this.goal, hold)
      : planPath(at.x, at.v, this.goal);
    const end = path[path.length - 1].t;
    const next = this.el.animate(
      path.map((p) => ({
        offset: end ? p.t / end : 1,
        transform: `scaleX(${p.x.toFixed(4)})`,
      })),
      { duration: Math.max(1, end * 1000), fill: 'forwards', easing: 'linear' },
    );
    // It starts in this frame, the one `at` was read for.
    const now = document.timeline?.currentTime;
    if (typeof now === 'number') next.startTime = now;
    // Replaced in the same task, so no frame ever shows the gap.
    this.anim?.cancel();
    this.anim = next;
    this.path = path;
    this.el.style.transform = `scaleX(${path[0].x.toFixed(4)})`;
    if (this.goal.done)
      next.finished.then(
        () => this.anim === next && this.finish(),
        () => {},
      );
  }

  private finish() {
    if (this.full || this.gone) return;
    this.full = true;
    this.options.onFrame?.(1);
    this.options.onFull?.();
  }

  private tick = (now: number) => {
    if (this.gone || this.full) return;
    this.frame = requestAnimationFrame(this.tick);
    if (this.lastTick && now - this.lastTick > LATE) this.busyAt = now;
    this.lastTick = now;
    if (!this.options.onFrame) return;
    const x = this.value();
    if (Math.abs(x - this.shown) < 0.001 && x < 1) return;
    this.shown = x;
    this.options.onFrame?.(x);
  };
}

/**
 * A `LoadingBar` on the element in `ref`, fed from props. Keep the
 * element mounted until `onFull` has fired (and any fade-out is over).
 */
export function useLoadingBar(
  ref: RefObject<HTMLElement | null>,
  goal: PathGoal,
  options: Options = {},
) {
  const bar = useRef<LoadingBar | null>(null);
  const latest = useRef(options);
  useLayoutEffect(() => {
    latest.current = options;
  });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const b = new LoadingBar(el, {
      finishHold: latest.current.finishHold,
      onFull: () => latest.current.onFull?.(),
      onFrame: latest.current.onFrame
        ? (x) => latest.current.onFrame?.(x)
        : undefined,
    });
    bar.current = b;
    return () => {
      b.dispose();
      bar.current = null;
    };
  }, [ref]);
  const { value, ceiling, done } = goal;
  useLayoutEffect(() => {
    bar.current?.set({ value, ceiling, done });
  }, [value, ceiling, done]);
  return bar;
}
